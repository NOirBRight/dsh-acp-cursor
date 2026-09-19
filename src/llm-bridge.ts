/** Plugin LLM adapter: same picker/turn seams as other providers, ACP behind stream(). */
import {
  createExternalAgentTurnHost,
  ExternalAgentTurnRunner,
  type ExternalAgentProviderRegistry,
  createSessionModelRoute,
  sessionId,
  turnId,
  type ExternalAgentPermissionDecision,
  type ExternalAgentPermissionRequest,
  type ExternalAgentPermissionMode,
  type ExternalAgentProvider,
  type ExternalAgentAttachment,
  type ExternalAgentSessionRef,
  type ExternalAgentTurnRequest,
  type ExternalAgentTurnResult,
  type ExternalAgentUserInputAnswers,
  type ExternalAgentUserInputRequest,
} from '@deepseek-ai/dsh-acp-provider'
import type { StreamChunk, ResolvedRetryPolicy } from '@deepseek-ai/dsh-llm'
import { applyCatalogOverlay, nativeCursorAgentModelId, peelEffort, pickerGroupsFromCursorCatalog, type CatalogOverlay, type CursorCatalogRow } from './catalog.js'
import { CURSOR_PLAN_APPROVE_LABEL, CURSOR_PLAN_KEEP_PLANNING_LABEL, CURSOR_PLAN_REVIEW_ID, CURSOR_PLAN_REVIEW_QUESTION, isCursorPlanApproval, isCursorPlanReview, type CursorAgentNativeMode } from './types.js'
import { switchCursorSessionToAgent } from './interaction.js'

export interface CursorResolvedModel {
  readonly provider: string
  readonly id: string
  readonly name: string
  readonly inputModalities?: readonly ('text' | 'image')[]
  readonly context?: { readonly contextWindow: number }
  readonly reasoning?: { readonly efforts: readonly { readonly id: string; readonly name: string }[]; readonly defaultEffort?: string }
}

function findCollapsed(collapsed: readonly CursorCatalogRow[], model: string): CursorCatalogRow | undefined {
  return collapsed.find(item => item.id === model)
    ?? collapsed.find(item => item.nativeIds?.includes(model) === true)
    ?? collapsed.find(item => item.id === peelEffort(model).logical)
}

function toResolvedModel(provider: string, requested: string, found: CursorCatalogRow): CursorResolvedModel {
  const efforts = found.reasoning?.efforts ?? []
  return {
    provider,
    id: requested,
    name: found.name,
    ...(found.vision === true ? { inputModalities: ['text', 'image'] as const } : found.vision === false ? { inputModalities: ['text'] as const } : {}),
    ...(found.contextWindow === undefined ? {} : { context: { contextWindow: found.contextWindow } }),
    ...(efforts.length === 0 ? {} : {
      reasoning: {
        efforts,
        ...(found.reasoning?.defaultEffort === undefined ? {} : { defaultEffort: found.reasoning.defaultEffort }),
      },
    }),
  }
}
import { isRecord } from './decode.js'
import { dumpFailedNativeTurn } from './transport-dump.js'
import { CURSOR_AGENT_USER_QUESTION_ANSWER, CURSOR_AGENT_OBSERVED, CURSOR_AGENT_TEXT, CURSOR_AGENT_PARENT_TRAJECTORY, toDurableAgentEvents, toDurableToolEvents, type CursorAgentToolEvent, type CursorAgentOwnedEvent } from './tool-events.js'

export interface BridgeAskRequest {
  questions: {
    id: string
    header?: string
    question: string
    detail?: string
    options?: { label: string; description?: string }[]
    multiSelect?: boolean
    intent?: { kind: 'plan-review'; approve: string }
  }[]
  signal?: AbortSignal
  sessionId?: string
}

export interface BridgeHost {
  /** Read the exact session’s current DSH Plan flag; absent state never authorizes plan review. */
  isPlanMode?(sessionId: string | undefined): boolean
  ask?(request: BridgeAskRequest): Promise<{ answers: { id: string; selected: string[]; custom?: string }[] }>
  appendSessionReady?(sessionId: string | undefined, ref: ExternalAgentSessionRef): void
  loadSession?(sessionId: string): ExternalAgentSessionRef | undefined
  appendToolEvents?(sessionId: string | undefined, events: readonly CursorAgentToolEvent[]): void
  /**
   * Write every coalesced activity record still buffered for this session.
   * Called before the finish chunk so a settled turn never leaves its last
   * text or tool state only in memory, and before the buffer is dropped.
   * A throw fails the turn through the existing stream error path.
   */
  flushActivity?(sessionId: string): void
  /** Flush every session's buffered activity; called before adapter teardown. */
  flushActivityAll?(): void
  /** Flush and drop one session's buffer; called after the native session is released. */
  releaseActivity?(sessionId: string): void
  /**
   * Resolve the authoritative sandbox policy for one stream call. The host reads
   * ctx.sandboxPolicy for the exact session; user and tool text never selects policy.
   * Absent or unresolvable policy fails closed to approval-required.
   */
  resolvePolicy?(sessionId: string | undefined): CursorAgentSandboxPolicy | undefined
  /**
   * Ask the canonical approval service for one native permission. The plugin routes
   * the exact session agent via ctx.approval, which enforces session policy and
   * audits itself. Generic ask stays for plan review and user-input questions.
   * Only 'allowed-once' grants; every other outcome denies.
   */
  requestApproval?(input: { sessionId: string | undefined; toolName: string; reason?: string; signal?: AbortSignal }): Promise<CursorAgentApprovalOutcome>
  /** Set DSH Plan after the user approved or a failed agent-mode switch undoes that approval. */
  setPlanMode?(sessionId: string | undefined, active: boolean): void
  /**
   * Live picker selection for this session. Plan review can commit a later
   * Cursor model before Approve; the in-flight stream still carries the model
   * from prompt assembly.
   */
  resolveSelectedModel?(sessionId: string | undefined): { model: string; reasoningEffort?: string } | undefined
  /**
   * Resolve one durable DSH image reference to bytes. Required when the last
   * user message contains `{ type: 'image', attachment }`.
   */
  readImage?(attachment: unknown, signal?: AbortSignal): Promise<{ data: Uint8Array; mimeType: string; name?: string }>
}

/** Closed outcome of one canonical approval ask. Structural mirror of the approval-service vocabulary. */
export type CursorAgentApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/**
 * File-effect policy resolved by the host for one stream call. Structural mirror
 * of the sandbox-policy service shape; no new dependency.
 */
export interface CursorAgentSandboxPolicy {
  readonly mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  readonly workspaceRoot: string
}

function lastUserMessage(messages: readonly unknown[]): unknown {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!isRecord(message)) continue
    if (isRecord(message.source) && message.source.kind === 'user') return message
  }
  return undefined
}

export function lastUserText(messages: readonly unknown[]): string {
  const message = lastUserMessage(messages)
  return isRecord(message) ? textOf(message.content) : ''
}

export function lastSkillText(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!isRecord(message)) continue
    if (!(isRecord(message.source) && message.source.kind === 'skill-invocation')) continue
    const text = textOf(message.content)
    if (text.length > 0) return text
  }
  return ''
}

export function acpPrompt(messages: readonly unknown[]): string {
  const user = lastUserText(messages)
  const skill = lastSkillText(messages)
  if (skill.length === 0) return user
  if (user.length === 0) return skill
  return skill + String.fromCharCode(10) + String.fromCharCode(10) + user
}

export async function acpAttachments(
  messages: readonly unknown[],
  readImage: BridgeHost['readImage'] | undefined,
  signal?: AbortSignal,
): Promise<readonly ExternalAgentAttachment[]> {
  const message = lastUserMessage(messages)
  const content = isRecord(message) ? message.content : undefined
  if (!Array.isArray(content)) return []
  const attachments: ExternalAgentAttachment[] = []
  for (const block of content) {
    if (!isRecord(block) || block.type !== 'image') continue
    if (typeof block.data === 'string' && typeof block.mimeType === 'string') {
      attachments.push({
        name: typeof block.name === 'string' ? block.name : 'image',
        mimeType: block.mimeType,
        data: block.data,
      })
      continue
    }
    if (!isRecord(block.attachment)) throw new Error('CursorAgent image block has no attachment or data')
    if (readImage === undefined) throw new Error('CursorAgent image input requires the durable attachment service')
    const stored = await readImage(block.attachment, signal)
    attachments.push({
      name: stored.name ?? (typeof block.attachment.name === 'string' ? block.attachment.name : 'image'),
      mimeType: stored.mimeType,
      data: Buffer.from(stored.data).toString('base64'),
    })
  }
  return attachments
}

function formatPlanUpdate(event: { summary: string; steps: readonly string[] }): string {
  const lines = [event.summary, ...event.steps.map(step => '- ' + step)]
  return lines.join(String.fromCharCode(10)) + String.fromCharCode(10)
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).filter(part => part.length > 0).join(String.fromCharCode(10))
  if (isRecord(value) && typeof value.text === 'string') return value.text
  if (isRecord(value) && typeof value.content === 'string') return value.content
  if (isRecord(value) && Array.isArray(value.content)) return textOf(value.content)
  return ''
}

type StreamOptions = {
  provider: string
  model: string
  messages: readonly unknown[]
  signal?: AbortSignal
  sessionId?: string
  tools?: readonly { name?: string }[]
  reasoningEffort?: string
}

type Chunk = StreamChunk

export function createCursorAgentLlmBridge(
  runtime: { readonly registry: ExternalAgentProviderRegistry; readonly getProvider: () => ExternalAgentProvider | undefined; readonly getOverlay?: () => { readonly order?: readonly string[]; readonly overrides?: Readonly<Record<string, CatalogOverlay>> } },
  getCachedModels?: () => readonly { id: string; name: string }[],
  setCachedModels?: (models: readonly { id: string; name: string }[]) => void,
  hostAsk?: BridgeHost,
): {
  providerInfo(provider: string): { id: string; name: string }
  providerRetryPolicy(_provider: string): ResolvedRetryPolicy
  imageRequestPricing(_provider: string, _model: string): undefined
  listModels(provider: string): Promise<readonly { provider: string; id: string; name: string }[]>
  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<CursorResolvedModel>
  prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{ model: CursorResolvedModel; stream: (options: StreamOptions) => AsyncIterable<Chunk> }>
  stream(options: StreamOptions): AsyncIterable<Chunk>
  reset(): Promise<void>
  release(session: string): Promise<void>
  dispose(): Promise<void>
} {
  const { getProvider, getOverlay } = runtime
  const emittedToolIds = new Map<string, Set<string>>()
  const observedAgentTrajectories = new Map<string, Set<string>>()
  let turns = 0
  const runner = new ExternalAgentTurnRunner(runtime.registry, {
    loadSession: id => hostAsk?.loadSession?.(id),
    saveSession: ref => {
      hostAsk?.appendSessionReady?.(ref.session, ref)
      emittedToolIds.delete(ref.session)
      observedAgentTrajectories.delete(ref.session)
    },
  })
  let listing: Promise<readonly { id: string; name: string }[]> | undefined
  let localModels: readonly { id: string; name: string }[] = []
  /** The first catalog request waits for discovery; later requests reuse its result. */
  function nativeModels(): Promise<readonly { id: string; name: string }[]> {
    const installed = getProvider()
    if (installed === undefined) return Promise.resolve([])
    const cached = getCachedModels?.() ?? localModels
    if (cached.length > 0) return Promise.resolve(cached)
    if (listing !== undefined) return listing
    const work = installed.listModels().then(listed => {
      if (getProvider() !== installed) return []
      const models = listed.map(model => ({ id: String(model.id), name: model.name }))
      localModels = models
      setCachedModels?.(models)
      return models
    }).catch(() => []).finally(() => { if (listing === work) listing = undefined })
    listing = work
    return work
  }
  return {
    // A failing flush must not skip the runner teardown: the caller's mount
    // guard has to see a fully reset runner even when buffered activity could
    // not be written, so the next mount cannot re-enter a half-reset adapter.
    // The flush error still propagates once the runner is reset.
    async reset() {
      listing = undefined
      localModels = []
      try {
        hostAsk?.flushActivityAll?.()
      } finally {
        await runner.reset()
        emittedToolIds.clear()
        observedAgentTrajectories.clear()
      }
    },
    async release(id) {
      await runner.release(sessionId(id))
      hostAsk?.releaseActivity?.(id)
      emittedToolIds.delete(id)
      observedAgentTrajectories.delete(id)
    },
    async dispose() {
      listing = undefined
      localModels = []
      try {
        hostAsk?.flushActivityAll?.()
      } finally {
        await runner.dispose()
        emittedToolIds.clear()
        observedAgentTrajectories.clear()
      }
    },
    providerInfo: provider => ({ id: provider, name: 'Cursor' }),
    // Native prompts can already have executed tools before a transport failure.
    providerRetryPolicy: () => ({ mode: 'normal', maxRetries: 0, retryableCodes: [], initialDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 }),
    imageRequestPricing: () => undefined,
    listModels: async provider => {
      const overlay = getOverlay?.()
      if (overlay?.order?.length === 0) return []
      const native = await nativeModels()
      return applyCatalogOverlay(pickerGroupsFromCursorCatalog(native), overlay?.order, overlay?.overrides).map(model => ({ provider, id: model.id, name: model.name }))
    },
    resolveModel: async (provider, model) => {
      const natives = await nativeModels()
      const overlay = getOverlay?.()
      const collapsed = applyCatalogOverlay(pickerGroupsFromCursorCatalog(natives), overlay?.order, overlay?.overrides)
      const found = findCollapsed(collapsed, model)
      if (found === undefined) {
        if (natives.length === 0) throw new Error('CursorAgent model catalog is unavailable')
        throw new Error('Unknown CursorAgent model: ' + model)
      }
      return toResolvedModel(provider, model, found)
    },
    async prepareCall(provider, model, signal) {
      const selected = getProvider()
      const resolved = await this.resolveModel(provider, model, signal)
      if (getProvider() !== selected) throw new Error('CursorAgent configuration changed while preparing the turn')
      return {
        model: resolved,
        stream: options => {
          if (getProvider() !== selected) throw new Error('CursorAgent configuration changed before dispatch')
          return this.stream(options)
        },
      }
    },
    stream: async function* (options) {
      const installed = getProvider()
      if (installed === undefined) throw new Error('CursorAgent is not configured')
      if (options.sessionId === undefined) throw new Error('Native turns require an explicit DSH session id')
      const key = options.sessionId
      const controller = new AbortController()
      const signal = options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal])
      const policy = hostAsk?.resolvePolicy?.(options.sessionId)
      const permissionMode: ExternalAgentPermissionMode = policy?.mode === 'danger-full-access' ? 'full-access' : policy?.mode === 'workspace-write' ? 'auto-accept-edits' : 'approval-required'
      const natives = await nativeModels()
      if (natives.length === 0) throw new Error('CursorAgent model catalog is unavailable')
      const overlay = getOverlay?.()
      const collapsed = applyCatalogOverlay(pickerGroupsFromCursorCatalog(natives), overlay?.order, overlay?.overrides)
      const row = findCollapsed(collapsed, options.model)
      if (row === undefined) throw new Error('Cursor model is not enabled: ' + options.model)
      const toNative = (logical: string, effort?: string): string => {
        const found = findCollapsed(collapsed, logical)
        if (found === undefined) throw new Error('Cursor model is not enabled: ' + logical)
        return nativeCursorAgentModelId(logical, effort ?? found.reasoning?.defaultEffort, natives.map(model => model.id), natives)
      }
      let nativeModel = toNative(options.model, options.reasoningEffort)
      const workspaceRoot = policy?.workspaceRoot
      if (getProvider() !== installed) throw new Error('CursorAgent configuration changed before native execution')
      const nativePlan = hostAsk?.isPlanMode?.(options.sessionId) === true
      let nativeMode: CursorAgentNativeMode | undefined = nativePlan ? 'plan' : undefined
      let planApproved = false
      const nativeTurnOpen = () => {
        const live = hostAsk?.resolveSelectedModel?.(options.sessionId)
        if (live?.model !== undefined && live.model !== '') nativeModel = toNative(live.model, live.reasoningEffort)
        return {
          route: createSessionModelRoute('external-agent', String(installed.info.id), nativeModel),
          session: sessionId(key),
          permissionMode,
          fullAccessConfirmed: permissionMode === 'full-access',
          ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
          ...(nativeMode === undefined ? {} : { nativeMode }),
          signal,
        }
      }
      type Pending = { kind: 'thought' | 'text'; text: string }
      const pending: Pending[] = []
      let pendingOther: string | undefined
      let reviewedPlan = false
      let wake: (() => void) | undefined
      // Disclose a child trajectory once per native session from its first owned
      // text/thought linkage. Scoped like emittedToolIds and reset on native open,
      // so a restarted native session discloses its trajectories again. No text stored.
      const childOwned = (carrier: CursorAgentOwnedEvent): boolean => {
        const ownership = carrier.ownership
        return ownership !== undefined && ownership.parentTrajectoryId !== undefined && ownership.trajectoryId !== ownership.parentTrajectoryId
      }
      const observeAgent = (carrier: CursorAgentOwnedEvent): void => {
        const seen = observedAgentTrajectories.get(key) ?? new Set<string>()
        observedAgentTrajectories.set(key, seen)
        const events = toDurableAgentEvents(carrier.ownership, seen)
        if (events.length === 0) return
        for (const event of events) if (event.type === CURSOR_AGENT_OBSERVED) seen.add(event.data.trajectoryId)
        hostAsk?.appendToolEvents?.(options.sessionId, events)
      }
      const turnHost = createExternalAgentTurnHost(signal, {
        publish: event => {
          if (event.type === 'thought-delta' || event.type === 'assistant-delta') {
            observeAgent(event)
            if (event.text.length === 0) return
            const kind = event.type === 'thought-delta' ? 'thought' as const : 'text' as const
            const text = event.text.length > 4000 ? event.text.slice(0, 4000) : event.text
            if (childOwned(event) && event.ownership !== undefined) {
              hostAsk?.appendToolEvents?.(options.sessionId, [{ type: CURSOR_AGENT_TEXT, data: {
                trajectoryId: event.ownership.trajectoryId,
                ...(event.ownership.parentTrajectoryId === undefined ? {} : { parentTrajectoryId: event.ownership.parentTrajectoryId }),
                kind,
                text,
              } }])
              return
            }
            hostAsk?.appendToolEvents?.(options.sessionId, [{ type: CURSOR_AGENT_TEXT, data: { trajectoryId: CURSOR_AGENT_PARENT_TRAJECTORY, kind, source: 'assistant', text } }])
          }
          else if (event.type === 'tool-activity') {
            const seen = emittedToolIds.get(key) ?? new Set<string>()
            emittedToolIds.set(key, seen)
            const events = toDurableToolEvents(event, seen, workspaceRoot)
            if (!seen.has(event.toolId)) seen.add(event.toolId)
            hostAsk?.appendToolEvents?.(options.sessionId, events)
          }
          else if (event.type === 'plan-update') {
            const text = formatPlanUpdate(event)
            if (text.length > 0) hostAsk?.appendToolEvents?.(options.sessionId, [{ type: CURSOR_AGENT_TEXT, data: { trajectoryId: CURSOR_AGENT_PARENT_TRAJECTORY, kind: 'text', source: 'plan', text } }])
          }
          // Stock Agent chrome: drop ACP usage. Do not yield TokenUsage.
        },
        requestPermission: request => decidePermission(request, permissionMode, hostAsk, signal, options.sessionId),
        requestUserInput: async request => {
          const answers = await decideUserInput(request, hostAsk, signal, options.sessionId)
          if (isCursorPlanReview(request)) {
            reviewedPlan = true
            if (isCursorPlanApproval(request, answers)) {
              try {
                await switchCursorSessionToAgent(options.sessionId, signal)
              } catch {
                return { answers: [] }
              }
              planApproved = true
              nativeMode = 'agent'
              hostAsk?.setPlanMode?.(options.sessionId, false)
            }
          }
          if (answers.custom !== undefined && answers.custom.length > 0) pendingOther = answers.custom
          return answers
        },
      })
      const prompt = acpPrompt(options.messages)
      async function* drain(running: Promise<{ status: string; text: string }>, start: { thought: string; text: string; thoughtOpen: boolean; textOpen: boolean }): AsyncGenerator<Chunk, { thought: string; text: string; thoughtOpen: boolean; textOpen: boolean }> {
        let { thought, text, thoughtOpen, textOpen } = start
        while (true) {
          if (pending.length === 0) {
            const settled = await Promise.race([running.then(() => 'done' as const), new Promise<'more'>(resolve => { wake = () => resolve('more') })])
            if (settled === 'done' && pending.length === 0) break
          }
          const item = pending.shift()
          if (item === undefined) break
          if (item.kind === 'thought') {
            if (!thoughtOpen) {
              yield { type: 'block-start', index: 0, blockType: 'reasoning' }
              thoughtOpen = true
            }
            thought += item.text
            yield { type: 'reasoning-delta', index: 0, text: item.text }
          } else {
            if (!textOpen) {
              yield { type: 'block-start', index: 1, blockType: 'text' }
              textOpen = true
            }
            text += item.text
            yield { type: 'text-delta', index: 1, text: item.text }
          }
        }
        await running
        return { thought, text, thoughtOpen, textOpen }
      }
      let active: Promise<ExternalAgentTurnResult> | undefined
      const run = (text: string, promptAttachments: readonly ExternalAgentAttachment[] = []): Promise<ExternalAgentTurnResult> => {
        const turn: ExternalAgentTurnRequest = {
          turn: turnId('t' + String(++turns)),
          prompt: text,
          permissionMode,
          signal,
          ...(promptAttachments.length > 0 ? { attachments: promptAttachments } : {}),
        }
        const nativeTurn = nativeMode === undefined ? turn : Object.assign({}, turn, { nativeMode })
        active = runner.runTurn(nativeTurnOpen(), nativeTurn, turnHost)
        return active
      }
      type DrainState = { thought: string; text: string; thoughtOpen: boolean; textOpen: boolean }
      const continueNativeTurn = async function* (text: string, start: DrainState, assembledSoFar: string): AsyncGenerator<Chunk, DrainState & { status: ExternalAgentTurnResult['status']; error: string | undefined; assembled: string }> {
        const running = run(text)
        const nextState = yield* drain(running, start)
        const next = await running
        return {
          ...nextState,
          status: next.status,
          error: next.error,
          assembled: nextState.text.length > 0 ? nextState.text : assembledSoFar + (next.text.length > 0 ? String.fromCharCode(10) + next.text : ''),
        }
      }
      try {
        const attachments = await acpAttachments(options.messages, hostAsk?.readImage, signal)
        if (prompt.trim().length === 0 && attachments.length === 0) {
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        const first = run(prompt, attachments)
        let state = yield* drain(first, { thought: '', text: '', thoughtOpen: false, textOpen: false })
        const result = await first
        let finalStatus = result.status
        let finalError = result.error
        let assembled = state.text.length > 0 ? state.text : result.text
        // Replay the original prompt once when the native turn already failed as a transport dump.
        if (!signal.aborted && dumpFailedNativeTurn(result)) {
          const replay = run(prompt, attachments)
          state = yield* drain(replay, { thought: '', text: '', thoughtOpen: false, textOpen: false })
          const next = await replay
          finalStatus = next.status
          finalError = next.error
          assembled = state.text.length > 0 ? state.text : next.text
        }
        if (pendingOther !== undefined && pendingOther.length > 0) {
          const extra = pendingOther
          pendingOther = undefined
          const followed = yield* continueNativeTurn(extra, state, assembled)
          state = followed
          finalStatus = followed.status
          finalError = followed.error
          assembled = followed.assembled
        }
        if (result.status === 'completed' && planApproved) {
          const followed = yield* continueNativeTurn('The user approved the plan. Carry it out now.', state, assembled)
          state = followed
          finalStatus = followed.status
          finalError = followed.error
          assembled = followed.assembled
        } else if (result.status === 'completed' && !reviewedPlan && hostAsk?.isPlanMode?.(options.sessionId) === true && hostAsk.ask !== undefined) {
          let approved = false
          try {
            approved = await reviewPlan(assembled, hostAsk, signal, options.sessionId)
          } catch {
            approved = false
          }
          if (approved) {
            nativeMode = 'agent'
            hostAsk.setPlanMode?.(options.sessionId, false)
            const followed = yield* continueNativeTurn('The user approved the plan. Carry it out now.', state, assembled)
            state = followed
            finalStatus = followed.status
            finalError = followed.error
            assembled = followed.assembled
          }
        }
        if (state.thoughtOpen) yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: state.thought } }
        if (state.textOpen || assembled.length > 0) {
          if (!state.textOpen) yield { type: 'block-start', index: 1, blockType: 'text' }
          yield { type: 'block-end', index: 1, block: { type: 'text', text: assembled } }
        }
        // Buffered, coalesced activity must be durable before the turn result:
        // the Core turn/end follows this chunk, so a later flush would fall
        // outside the turn window and lose the last text or tool state.
        // A throw here fails the turn through the existing stream path.
        hostAsk?.flushActivity?.(options.sessionId)
        yield { type: 'finish', reason: finalStatus === 'cancelled'
          ? { kind: 'aborted', failure: { code: 'ABORTED', message: 'Native turn cancelled' } }
          : finalStatus === 'failed'
            ? { kind: 'error', failure: { code: 'NATIVE_TURN_FAILED', message: finalError ?? 'Native turn failed' } }
            : { kind: 'stop' } }
      } finally {
        controller.abort()
        turnHost.expire()
        await active?.catch(() => undefined) // The stream already reports the execution error.
      }
    },
  }
}

async function decidePermission(
  request: ExternalAgentPermissionRequest,
  mode: 'approval-required' | 'auto-accept-edits' | 'full-access',
  hostAsk: BridgeHost | undefined,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<ExternalAgentPermissionDecision> {
  if (mode === 'full-access') {
    const once = request.options.find(option => option.kind === 'allow_once') ?? request.options.find(option => option.kind === 'allow_always')
    return once === undefined ? { kind: 'unavailable' } : once.kind === 'allow_always' ? { kind: 'allowed-for-session', optionId: once.optionId } : { kind: 'allow-once', optionId: once.optionId }
  }
  const rejectOf = (): ExternalAgentPermissionDecision => {
    const deny = request.options.find(option => option.kind === 'reject') ?? request.options.find(option => option.kind === 'cancel')
    return deny === undefined ? { kind: 'reject' } : { kind: 'reject', optionId: deny.optionId }
  }
  if (hostAsk?.requestApproval === undefined) {
    const cancel = request.options.find(option => option.kind === 'cancel')
    return cancel === undefined ? rejectOf() : { kind: 'cancel', optionId: cancel.optionId }
  }
  let outcome: CursorAgentApprovalOutcome
  try {
    outcome = await hostAsk.requestApproval({
      sessionId,
      toolName: request.toolName,
      ...(request.reason.length > 0 ? { reason: request.reason } : {}),
      ...(signal === undefined ? {} : { signal }),
    })
  } catch {
    // A throwing approval service cannot grant; native permission stays rejected.
    return rejectOf()
  }
  if (outcome === 'allowed-once') {
    const once = request.options.find(option => option.kind === 'allow_once')
    return once === undefined ? rejectOf() : { kind: 'allow-once', optionId: once.optionId }
  }
  if (outcome === 'cancelled') {
    const cancel = request.options.find(option => option.kind === 'cancel')
    return cancel === undefined ? rejectOf() : { kind: 'cancel', optionId: cancel.optionId }
  }
  return rejectOf()
}

function planReviewQuestion(detail: string): BridgeAskRequest['questions'][number] {
  return {
    id: CURSOR_PLAN_REVIEW_ID,
    header: 'Plan review',
    question: CURSOR_PLAN_REVIEW_QUESTION,
    ...(detail.length > 0 ? { detail } : {}),
    options: [
      { label: CURSOR_PLAN_APPROVE_LABEL, description: 'Leave plan mode; the plan is carried out from the next step.' },
      { label: CURSOR_PLAN_KEEP_PLANNING_LABEL, description: 'Stay in plan mode; feedback goes back to the model.' },
    ],
    intent: { kind: 'plan-review', approve: CURSOR_PLAN_APPROVE_LABEL },
  }
}

async function decideUserInput(
  request: ExternalAgentUserInputRequest,
  hostAsk: BridgeHost | undefined,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<ExternalAgentUserInputAnswers> {
  if (hostAsk?.ask === undefined) return { answers: [] }
  const planReview = isCursorPlanReview(request)
  const result = await hostAsk.ask({
    questions: [planReview ? planReviewQuestion(request.question) : {
      id: String(request.requestId),
      question: request.question,
      ...(request.options === undefined ? {} : { options: request.options.map(label => ({ label })) }),
      ...(request.multiple === undefined ? {} : { multiSelect: request.multiple }),
    }],
    ...(signal === undefined ? {} : { signal }),
    ...(sessionId === undefined ? {} : { sessionId }),
  })
  const item = result.answers[0]
  if (item === undefined) return { answers: [] }
  hostAsk.appendToolEvents?.(sessionId, [{ type: CURSOR_AGENT_USER_QUESTION_ANSWER, data: {
    requestId: String(request.requestId), question: request.question, selected: [...item.selected],
    ...(item.custom === undefined ? {} : { custom: item.custom }),
  } }])
  if (item.custom !== undefined && item.custom.length > 0) return { answers: [...item.selected, item.custom], custom: item.custom }
  return { answers: item.selected }
}

async function reviewPlan(plan: string, hostAsk: BridgeHost, signal?: AbortSignal, sessionId?: string): Promise<boolean> {
  const result = await hostAsk.ask!({
    questions: [planReviewQuestion(plan)],
    ...(signal === undefined ? {} : { signal }),
    ...(sessionId === undefined ? {} : { sessionId }),
  })
  const item = result.answers.find(entry => entry.id === CURSOR_PLAN_REVIEW_ID)
  return item?.selected.length === 1 && item.selected[0] === CURSOR_PLAN_APPROVE_LABEL && item.custom === undefined
}
