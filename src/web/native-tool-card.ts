/** Adapt folded native sidecar rows to DSH ToolRow presentation.
 *
 * Pure browser-safe mapping from the activity/read sidecar. The block is
 * presentation only: never a durable executable DSH tool event.
 */
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CursorAgentToolState } from '../tool-events.js'

/** Folded native title to canonical wire name. Prefixes, a small command regex,
 * and a command/cmd arg fill gaps Cursor leaves as "Read /path" / raw git lines.
 * Anything else stays verbatim. */
const NATIVE_TOOL_NAMES: Record<string, string> = {
  'run command': 'bash',
  'view file': 'read',
  'read file': 'read',
  'fetch page': 'web_fetch',
  fetch: 'web_fetch',
  search: 'web_search',
  grep: 'grep',
  glob: 'glob',
  'write file': 'write',
  'edit file': 'edit',
  edit: 'edit',
  write: 'write',
  'str replace': 'edit',
  'str replace editor': 'edit',
  'todo write': 'todo_write',
  'update todos': 'todo_write',
}

/** Native argument aliases to canonical DSH argument keys, each verified
 * against the card models that read them: command feeds the terminal shell
 * call, file_path is what the read model requires (path alone never
 * qualifies), url feeds web_fetch and renders as summary text without result
 * metadata. Unknown keys survive verbatim. */
const ARG_KEY_ALIASES: Record<string, string> = {
  CommandLine: 'command',
  commandLine: 'command',
  command_line: 'command',
  AbsolutePath: 'file_path',
  URL: 'url',
  uri: 'url',
}

/** Path-ish keys a location fallback must not override. */
const PATH_KEYS = ['path', 'file_path', 'directory_path'] as const

function foldName(name: string): string {
  return name.trim().replace(/[_-]+/gu, ' ').replace(/\s+/gu, ' ').toLowerCase()
}

function aliasArgs(parsed: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (parsed === undefined) return undefined
  const args: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed)) {
    const canonical = ARG_KEY_ALIASES[key] ?? key
    if (args[canonical] === undefined) args[canonical] = value
  }
  return args
}

export function parseRecord(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Map a recorded native tool name to its canonical DSH wire name.
 * Table, title prefixes, a small command regex, then command/cmd args.
 * Unknown names stay verbatim.
 */
export function nativeToolName(name: string, input?: string): string {
  const core = name.startsWith('Running ') ? name.slice('Running '.length) : name
  const folded = foldName(core)
  const known = NATIVE_TOOL_NAMES[folded]
  if (known !== undefined) return known
  if (folded === 'grep' || folded.startsWith('grep ') || folded === 'find' || folded.startsWith('find ')) return 'grep'
  if (folded === 'glob' || folded.startsWith('glob ')) return 'glob'
  if (folded === 'read' || folded.startsWith('read ') || folded.startsWith('read/')) return 'read'
  if (folded.startsWith('update todos:')) return 'todo_write'
  if (folded.startsWith('edit ')) return 'edit'
  if (folded.startsWith('write ')) return 'write'
  if (folded === 'shell' || folded === 'terminal' || folded === 'command') return 'bash'
  if (folded.startsWith('web fetch') || folded.startsWith('fetch ')) return 'web_fetch'
  if (folded.startsWith('search ')) return 'web_search'
  if (/^(git|echo|ls|cat|npm|pnpm|yarn|python|node|curl|bash|sh)(\s|$)/u.test(folded) || folded.includes(' && ')) return 'bash'
  const parsed = input === undefined ? undefined : parseRecord(input)
  if (parsed !== undefined && (typeof parsed.command === 'string' || typeof parsed.cmd === 'string')) return 'bash'
  return name
}

const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'glob', 'query', 'url', 'directory_path'] as const

/** One-line ToolRow summary: canonical args, then location, then the ACP title remainder. */
export function nativeToolSummary(state: CursorAgentToolState, toolName: string): string {
  const aliased = state.input === undefined ? undefined : aliasArgs(parseRecord(state.input))
  if (aliased !== undefined) {
    for (const key of SUMMARY_KEYS) {
      const value = aliased[key]
      if (typeof value === 'string' && value !== '') return value
    }
  }
  if (state.location !== undefined) return state.location.target
  const core = state.name.startsWith('Running ') ? state.name.slice('Running '.length) : state.name
  if (toolName === 'read') return core.replace(/^Read\s+/u, '').replace(/^read\s+/u, '')
  if (toolName === 'grep' || toolName === 'glob') return core.replace(/^Find\s+/u, '').replace(/^find\s+/u, '').replace(/^[`']|['`]$/gu, '')
  return core
}

/**
 * Build the canonical args JSON for one folded row. Known native keys move to
 * their canonical slots; every other key survives verbatim, so unknowns keep
 * their data. A sidecar location fills a missing path/url on a structured
 * args object only: raw non-JSON input passes through untouched (the generic
 * summary and body read it verbatim), and then a location has no canonical
 * slot — the output text still carries the readable result.
 * @param state - folded native row state.
 * @returns argsRaw for the presentation block: canonical JSON or raw input.
 */
export function nativeToolArgs(state: CursorAgentToolState): string {
  if (state.input === undefined) {
    if (state.location === undefined) return ''
    return JSON.stringify(state.location.kind === 'file' ? { path: state.location.target } : { url: state.location.target })
  }
  const parsed = parseRecord(state.input)
  if (parsed === undefined) return state.input
  const args = aliasArgs(parsed) ?? {}
  const location = state.location
  if (location !== undefined) {
    if (location.kind === 'file' && !PATH_KEYS.some(key => typeof args[key] === 'string' && args[key] !== '')) {
      args.path = location.target
    }
    if (location.kind === 'url' && typeof args.url !== 'string') args.url = location.target
  }
  return JSON.stringify(args)
}

/**
 * Build presentation props for one folded row: the normalized wire name plus a
 * running block while pending/running, or a settled block honoring the actual
 * outcome (failed settles isError, completed does not). The verbatim native
 * name is the card title attribute when the canonical label renames it.
 * No result metadata is ever synthesized, so rich cards trigger only off
 * genuine canonical arguments.
 * @param state - folded native row state.
 * @param timeMs - row wall clock for the block timestamps; defaults to 0.
 * @returns wire name, verbatim native name and tool id, and the presentation-only block.
 */
export function nativeToolBlock(state: CursorAgentToolState, timeMs = 0): {
  readonly toolName: string
  readonly nativeName: string
  readonly callId: string
  readonly block: ToolCallBlock
} {
  const toolName = nativeToolName(state.name, state.input)
  const argsRaw = nativeToolArgs(state)
  const callId = state.toolId
  if (state.status !== 'completed' && state.status !== 'failed') {
    return {
      toolName,
      nativeName: state.name,
      callId,
      block: { callId, name: toolName, argsRaw, turn: 0, step: 0, time: timeMs, subCalls: [] },
    }
  }
  const text = state.status === 'failed'
    ? (state.error ?? state.output ?? '')
    : (state.output ?? state.error ?? '')
  return {
    toolName,
    nativeName: state.name,
    callId,
    block: {
      kind: 'tool-result',
      seq: 0,
      time: timeMs,
      callId,
      call: { name: toolName, argsRaw },
      callTime: null,
      content: text === '' ? [] : [{ type: 'text' as const, text }],
      isError: state.status === 'failed',
      subCalls: [],
    },
  }
}
