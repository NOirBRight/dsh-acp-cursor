import { HostExpiredError, TurnAbortedError, UnscopedAllowAlwaysError, boundExternalAgentUserInputRequest, optionId, type ExternalAgentEventBounds, type ExternalAgentPermissionRequest, type ExternalAgentTurnHost, type ExternalAgentUserInputRequest } from '@deepseek-ai/dsh-acp-provider'
import { isRecord, stringValue } from './decode.js'
import { createCursorAgentFilesystemHandler } from './filesystem.js'
import type { AcpRequestHandler } from './protocol.js'
import { CURSOR_PLAN_APPROVE_LABEL, CURSOR_PLAN_KEEP_PLANNING_LABEL, CURSOR_PLAN_REVIEW_ID, CURSOR_PLAN_REVIEW_QUESTION, isCursorPlanApproval, type CursorAgentClientFilesystem } from './types.js'

const agentModeSwitches = new Map<string, (signal?: AbortSignal) => Promise<void>>()

/** Register this native session's ACP `session/set_mode` for a later Approve. */
export function registerCursorAgentModeSwitch(sessionId: string, fn: (signal?: AbortSignal) => Promise<void>): () => void {
  agentModeSwitches.set(sessionId, fn)
  return () => { if (agentModeSwitches.get(sessionId) === fn) agentModeSwitches.delete(sessionId) }
}

/** Switch Cursor to agent; no-op when this DSH session has no live ACP turn. */
export async function switchCursorSessionToAgent(sessionId: string | undefined, signal?: AbortSignal): Promise<void> {
  if (sessionId === undefined) return
  await agentModeSwitches.get(sessionId)?.(signal)
}

/** Build ACP server-request handling from one turn-scoped DSH host. */
export function createCursorAgentInteractionHandler(host: ExternalAgentTurnHost, filesystem?: CursorAgentClientFilesystem, bounds?: ExternalAgentEventBounds): AcpRequestHandler {
  const fileHandler = filesystem === undefined ? undefined : createCursorAgentFilesystemHandler(filesystem, host.signal)
  let sequence = 0
  return async (method, params, id) => {
    const currentSequence = ++sequence
    const requestKey = interactionRequestId(params, id, currentSequence)
    if (method === 'session/request_permission') {
      if (isInteractionQuestion(params)) return handleInteractionQuestion(host, params, String(id) + ':' + String(currentSequence), bounds)
      return handlePermission(host, params, requestKey)
    }
    if (method === 'session/request_user_input' || method === 'elicitation/create') return questionResponse(await host.requestUserInput(parseQuestionRequest(params, requestKey)))
    if (method.startsWith('interaction_') || method.startsWith('interaction/')) {
      if (method.includes('permission')) return handlePermission(host, params, requestKey)
      return questionResponse(await host.requestUserInput(parseQuestionRequest(params, requestKey)))
    }
    if (method === 'cursor/create_plan') return handleCreatePlan(host, params, bounds)
    if (method === 'cursor/ask_question') return handleAskQuestion(host, params, requestKey, bounds)
    // Unanswered cursor/* client methods leave session/prompt hanging.
    if (method.startsWith('cursor/')) return { outcome: { outcome: 'cancelled' } }
    if (method.startsWith('terminal/')) throw new Error('CursorAgent terminal capability is disabled')
    if ((method === 'fs/read_text_file' || method === 'fs/write_text_file') && fileHandler !== undefined) return fileHandler(method, params, id)
    throw new Error('CursorAgent client method is unavailable: ' + method)
  }
}

function isInteractionAbort(error: unknown): boolean { return error instanceof TurnAbortedError || error instanceof HostExpiredError || error instanceof DOMException && error.name === 'AbortError' }

type HostUserAnswer = Awaited<ReturnType<ExternalAgentTurnHost['requestUserInput']>>

async function askUser(host: ExternalAgentTurnHost, rawRequest: ExternalAgentUserInputRequest, bounds: ExternalAgentEventBounds | undefined): Promise<{ answer: HostUserAnswer; presented: ExternalAgentUserInputRequest } | undefined> {
  const presented = bounds === undefined ? rawRequest : boundExternalAgentUserInputRequest(rawRequest, bounds)
  try {
    return { answer: await host.requestUserInput(presented), presented }
  } catch (error) {
    if (isInteractionAbort(error)) return undefined
    throw error
  }
}

async function askUserOrCancel(host: ExternalAgentTurnHost, rawRequest: ExternalAgentUserInputRequest, bounds: ExternalAgentEventBounds | undefined): Promise<HostUserAnswer | undefined> {
  try {
    return (await askUser(host, rawRequest, bounds))?.answer
  } catch {
    return undefined
  }
}

function isInteractionQuestion(params: unknown): boolean {
  if (!isRecord(params) || !isRecord(params.toolCall)) return false
  return stringValue(params.toolCall.toolCallId)?.startsWith('interaction_') === true
}

async function handleInteractionQuestion(host: ExternalAgentTurnHost, params: unknown, id: string, bounds: ExternalAgentEventBounds | undefined): Promise<unknown> {
  if (!isRecord(params) || !isRecord(params.toolCall) || !Array.isArray(params.options) || params.options.length === 0) throw new Error('CursorAgent user question is malformed')
  const options = params.options.map(value => {
    if (!isRecord(value)) throw new Error('CursorAgent user question option is malformed')
    const native = stringValue(value.optionId)
    if (native === undefined || native.trim() === '') throw new Error('CursorAgent user question option has no optionId')
    return { native, label: stringValue(value.name)?.trim() || native }
  })
  if (new Set(options.map(option => option.native)).size !== options.length) throw new Error('CursorAgent user question option IDs must be unique')
  const rawRequest: ExternalAgentUserInputRequest = { requestId: optionId(id), question: stringValue(params.toolCall.title)?.trim() || 'Choose an option.', options: options.map(option => option.label), multiple: false }
  const asked = await askUser(host, rawRequest, bounds)
  if (asked === undefined) return { outcome: { outcome: 'cancelled' } }
  const { answer, presented } = asked
  if (answer.answers.length !== 1) return { outcome: { outcome: 'cancelled' } }
  const exact = options.find(option => option.native === answer.answers[0])
  const matchingLabels = options.filter((_option, index) => presented.options?.[index] === answer.answers[0])
  const selected = answer.custom === undefined ? exact ?? (matchingLabels.length === 1 ? matchingLabels[0] : undefined) : undefined
  if (selected !== undefined) return { outcome: { outcome: 'selected', optionId: selected.native } }
  // Stock ACP has no freeform: Other cancels this ask; the bridge sends the text as a later prompt.
  return { outcome: { outcome: 'cancelled' } }
}

async function handleCreatePlan(host: ExternalAgentTurnHost, params: unknown, bounds: ExternalAgentEventBounds | undefined): Promise<unknown> {
  const plan = formatCreatePlan(params)
  const rawRequest: ExternalAgentUserInputRequest = {
    requestId: optionId(CURSOR_PLAN_REVIEW_ID),
    question: plan.length > 0 ? plan : CURSOR_PLAN_REVIEW_QUESTION,
    options: [CURSOR_PLAN_APPROVE_LABEL, CURSOR_PLAN_KEEP_PLANNING_LABEL],
    multiple: false,
  }
  const answer = await askUserOrCancel(host, rawRequest, bounds)
  if (answer === undefined) return { outcome: { outcome: 'cancelled' } }
  if (answer.custom !== undefined && answer.custom.length > 0) return { outcome: { outcome: 'cancelled' } }
  if (isCursorPlanApproval(rawRequest, answer)) return { outcome: { outcome: 'accepted' } }
  if (answer.answers.length === 1 && answer.answers[0] === CURSOR_PLAN_KEEP_PLANNING_LABEL) return { outcome: { outcome: 'rejected' } }
  return { outcome: { outcome: 'cancelled' } }
}

function formatCreatePlan(params: unknown): string {
  if (!isRecord(params)) return ''
  const parts = [stringValue(params.name), stringValue(params.overview), stringValue(params.plan)].filter((part): part is string => part !== undefined && part.length > 0)
  const todos = Array.isArray(params.todos) ? params.todos : []
  for (const todo of todos) {
    if (!isRecord(todo)) continue
    const content = stringValue(todo.content)
    if (content !== undefined && content.length > 0) parts.push('- ' + content)
  }
  return parts.join(String.fromCharCode(10))
}

async function handleAskQuestion(host: ExternalAgentTurnHost, params: unknown, id: string, bounds: ExternalAgentEventBounds | undefined): Promise<unknown> {
  if (!isRecord(params) || !Array.isArray(params.questions) || params.questions.length === 0) return { outcome: { outcome: 'cancelled' } }
  const answers: { questionId: string; selectedOptionIds: string[] }[] = []
  for (const raw of params.questions) {
    if (!isRecord(raw)) continue
    const questionId = stringValue(raw.id)
    const prompt = stringValue(raw.prompt) ?? 'Choose an option.'
    const choices = Array.isArray(raw.options) ? raw.options.flatMap(option => {
      if (!isRecord(option)) return []
      const optionIdValue = stringValue(option.id)
      const label = stringValue(option.label) ?? optionIdValue
      return optionIdValue === undefined || label === undefined ? [] : [{ id: optionIdValue, label }]
    }) : []
    if (questionId === undefined || choices.length === 0) continue
    const rawRequest: ExternalAgentUserInputRequest = {
      requestId: optionId(id + ':' + questionId),
      question: prompt,
      options: choices.map(choice => choice.label),
      ...(raw.allowMultiple === true ? { multiple: true } : { multiple: false }),
    }
    const answer = await askUserOrCancel(host, rawRequest, bounds)
    if (answer === undefined) return { outcome: { outcome: 'cancelled' } }
    if (answer.custom !== undefined && answer.custom.length > 0) return { outcome: { outcome: 'cancelled' } }
    if (answer.answers.length === 0) return { outcome: { outcome: 'cancelled' } }
    const selectedOptionIds = answer.answers.flatMap(selected => {
      const matches = choices.filter(choice => choice.label === selected || choice.id === selected)
      const only = matches.length === 1 ? matches[0] : undefined
      return only === undefined ? [] : [only.id]
    })
    if (selectedOptionIds.length === 0) return { outcome: { outcome: 'cancelled' } }
    answers.push({ questionId, selectedOptionIds })
  }
  if (answers.length === 0) return { outcome: { outcome: 'cancelled' } }
  return { outcome: { outcome: 'answered', answers } }
}

async function handlePermission(host: ExternalAgentTurnHost, params: unknown, id: string): Promise<unknown> {
  const request = parsePermissionRequest(params, id)
  try { return permissionResponse(await host.requestPermission(request), request) } catch (error) {
    if (isInteractionAbort(error)) return { outcome: { outcome: 'cancelled' } }
    throw error
  }
}


function permissionReason(toolCall: Record<string, unknown>, toolName: string): string {
  const explicit = stringValue(toolCall.rawInput) ?? stringValue(toolCall.input)
  if (explicit !== undefined && explicit.trim() !== '') return explicit.trim()
  const details: string[] = []
  if (toolName !== 'native tool') details.push(toolName)
  const input = describeToolInput(toolCall.rawInput) ?? describeToolInput(toolCall.input)
  if (input !== undefined) details.push(input)
  const locations = describeLocations(toolCall.locations, details.join(' '))
  if (locations !== undefined) details.push(locations)
  if (details.length === 0) return 'CursorAgent requested permission for a native action.'
  return 'CursorAgent requested permission: ' + details.join(' · ')
}

function describeToolInput(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return JSON.stringify(value)
  return Object.entries(value).map(([key, input]) => key + ': ' + (typeof input === 'string' ? input : JSON.stringify(input))).join(', ') || undefined
}

function describeLocations(value: unknown, already: string): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const paths: string[] = []
  for (const item of value) {
    const path = typeof item === 'string' ? item.trim() : isRecord(item) ? stringValue(item.path)?.trim() : undefined
    if (path !== undefined && path !== '' && !already.includes(path) && !paths.includes(path)) paths.push(path)
  }
  return paths.length === 0 ? undefined : paths.join(', ')
}

function parsePermissionRequest(params: unknown, id: string): ExternalAgentPermissionRequest {
  if (!isRecord(params) || !Array.isArray(params.options)) throw new Error('CursorAgent permission request is malformed')
  const toolCall = isRecord(params.toolCall) ? params.toolCall : {}
  const toolName = stringValue(toolCall.title) ?? stringValue(toolCall.name) ?? stringValue(toolCall.kind) ?? 'native tool'
  const reason = permissionReason(toolCall, toolName)
  const requestScope: 'session' | 'thread' | undefined = stringValue(params.threadId) === undefined ? stringValue(params.sessionId) === undefined ? undefined : 'session' : 'thread'
  const options = params.options.map(value => {
    if (!isRecord(value)) throw new Error('CursorAgent permission option is malformed')
    const native = stringValue(value.optionId)
    const kind = permissionKind(value.kind)
    const label = stringValue(value.name)?.trim() || kind
    const scope: 'session' | 'thread' | undefined = value.scope === 'session' || value.scope === 'thread' ? value.scope : kind === 'allow_always' ? requestScope : undefined
    if (native === undefined || native.trim() === '') throw new Error('CursorAgent permission option has no optionId')
    if (kind === 'allow_always' && scope === undefined) throw new UnscopedAllowAlwaysError()
    return { optionId: optionId(native), kind, label, ...(scope === undefined ? {} : { scope }) }
  })
  if (options.length === 0) throw new Error('CursorAgent permission request has no options')
  const warning = securityWarning(params)
  return {
    requestId: optionId(String(id)),
    toolName,
    reason,
    options,
    ...(warning === undefined ? {} : { securityWarning: { message: warning } }),
  }
}

function parseQuestionRequest(params: unknown, id: string): ExternalAgentUserInputRequest {
  if (!isRecord(params)) throw new Error('CursorAgent user question is malformed')
  const question = stringValue(params.question) ?? stringValue(params.message) ?? stringValue(params.prompt)
  if (question === undefined) throw new Error('CursorAgent user question has no text')
  const rawOptions = Array.isArray(params.options) ? params.options : undefined
  const options = rawOptions?.map(value => typeof value === 'string' ? value : isRecord(value) ? stringValue(value.label) ?? stringValue(value.name) ?? '' : '').filter(value => value.length > 0)
  return {
    requestId: optionId(String(id)),
    question,
    ...(options === undefined || options.length === 0 ? {} : { options }),
    ...(typeof params.multiple === 'boolean' ? { multiple: params.multiple } : {}),
  }
}

function interactionRequestId(params: unknown, id: number | string, sequence: number): string {
  if (isRecord(params)) {
    const explicit = params.requestId
    if (typeof explicit === 'string' || typeof explicit === 'number') return String(explicit)
    const session = stringValue(params.sessionId)
    const toolCall = isRecord(params.toolCall) ? params.toolCall : undefined
    const tool = stringValue(toolCall?.toolCallId)
    if (session !== undefined || tool !== undefined) return [session ?? 'session', tool ?? 'interaction', String(sequence)].join(':')
  }
  return String(id) + ':' + String(sequence)
}

function securityWarning(params: Record<string, unknown>): string | undefined {
  for (const value of Array.isArray(params.options) ? params.options : []) {
    if (isRecord(value)) {
      const warning = warningFromMeta(value._meta)
      if (warning !== undefined) return warning
    }
  }
  return warningFromMeta(params._meta)
}

function warningFromMeta(value: unknown): string | undefined {
  const meta = isRecord(value) ? value : {}
  const direct = meta['agy.security.warning']
  if (isRecord(direct)) return stringValue(direct.message) ?? stringValue(direct.title)
  if (typeof direct === 'string') return stringValue(direct)
  const agy = isRecord(meta.agy) ? meta.agy : {}
  return stringValue(agy.securityWarning) ?? stringValue(agy['security.warning'])
}

function permissionKind(value: unknown): ExternalAgentPermissionRequest['options'][number]['kind'] {
  switch (value) {
    case 'allow_once': return 'allow_once'
    case 'allow_always': return 'allow_always'
    case 'reject': case 'reject_once': case 'reject_always': return 'reject'
    case 'cancel': return 'cancel'
    default: throw new Error('CursorAgent permission option kind is unsupported')
  }
}

function permissionResponse(decision: Awaited<ReturnType<ExternalAgentTurnHost['requestPermission']>>, request: ExternalAgentPermissionRequest): { readonly outcome: Record<string, string> } {
  const selected = decision.optionId === undefined ? undefined : request.options.find(option => option.optionId === decision.optionId)
  if (decision.kind === 'allow-once' || decision.kind === 'allowed-for-session') {
    const expected = decision.kind === 'allow-once' ? 'allow_once' : 'allow_always'
    if (selected === undefined || selected.kind !== expected || expected === 'allow_always' && selected.scope === undefined) throw new Error('CursorAgent host returned an unoffered permission option')
    return { outcome: { outcome: 'selected', optionId: String(selected.optionId) } }
  }
  if (decision.kind === 'reject') {
    const rejection = selected ?? request.options.find(option => option.kind === 'reject')
    if (rejection === undefined) throw new Error('CursorAgent offered no native reject option')
    if (rejection.kind !== 'reject') throw new Error('CursorAgent host returned an unoffered permission option')
    return { outcome: { outcome: 'selected', optionId: String(rejection.optionId) } }
  }
  return { outcome: { outcome: 'cancelled' } }
}

function questionResponse(answer: Awaited<ReturnType<ExternalAgentTurnHost['requestUserInput']>>): { readonly answer: string; readonly answers: readonly string[] } {
  const answers = [...answer.answers]
  return { answer: answers[0] ?? '', answers }
}
