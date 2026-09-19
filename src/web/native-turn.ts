/** Per-turn native activity container for the Chat transcript.
 *
 * Starts on turn/start. The Chat assembler allows one start Match per Context
 * id; id is the turn number, so a later step/start in the same turn must be an
 * update. Matching every step/start as start throws and drops the whole
 * transcript. Later step/chunk/message events stay updates so the mixed
 * timeline can still raise the anchor past every context injection.
 */
import type {
  ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { CursorAgentAgentTextRow, CursorAgentToolRowData } from './native-activity.js'

/** One turn's native activity window: turn/end wall clock while the turn is open. */
export interface CursorAgentNativeTurn {
  readonly turn: number
  /** turn/start wall clock, unix epoch milliseconds. */
  readonly startMs: number
  /** turn/end wall clock, unix epoch milliseconds; null while the turn is open. */
  readonly endMs: number | null
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** Per-turn native tool container: windowed sidecar rows, never DSH tool calls. */
    'cursor-agent-native': CursorAgentNativeTurn
  }
}

/** Folded row definition registered on the Chat conversation target. */
/* Injected user/message events have no turn field. Sequential assembler: one open turn at a time. */
let openNativeTurn: number | undefined

function sourceKindOf(event: { readonly data?: unknown }): unknown {
  return (event.data as { source?: { kind?: unknown } } | undefined)?.source?.kind
}

/** Direct user/steering bubbles stay off this node. Every other source is a context injection. */
function isInjectedContext(event: { readonly type: string; readonly data?: unknown }): boolean {
  if (event.type !== 'user/message') return false
  const kind = sourceKindOf(event)
  return typeof kind === 'string' && kind !== 'user'
}

function turnOf(event: { readonly type: string; readonly data?: unknown }): number | undefined {
  if (event.type === 'user/message') {
    return isInjectedContext(event) ? openNativeTurn : undefined
  }
  const turn = (event.data as { turn?: unknown } | undefined)?.turn
  if (typeof turn === 'number' && Number.isSafeInteger(turn) && turn >= 1) return turn
  return undefined
}

export const nativeTurnDefinition: ConversationNodeDefinition<CursorAgentNativeTurn> = {
  kind: 'cursor-agent-native',
  target: 'chat',
  match: event => {
    const turn = turnOf(event)
    if (turn === undefined) return null
    const id = String(turn)
    if (event.type === 'turn/start') return { id, role: 'start' }
    if (event.type === 'turn/end'
      || event.type === 'step/start'
      || event.type === 'step/end'
      || event.type === 'system/message'
      || event.type === 'user/message'
      || event.type === 'assistant/live-chunk'
      || event.type === 'assistant/chunk'
      || event.type === 'assistant/message') return { id, role: 'update' }
    return null
  },
  start: (context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('CursorAgent native turn starts on turn/start')
    void context
    const turn = turnOf(match.event)
    if (turn === undefined) throw new Error('CursorAgent native turn starts on turn/start')
    openNativeTurn = turn
    return { turn, startMs: match.event.time, endMs: null }
  },
  update: (context, match) => {
    if (match.event.type !== 'turn/end') return context.state
    if (openNativeTurn === context.state.turn) openNativeTurn = undefined
    return { ...context.state, endMs: match.event.time }
  },
  publication: () => 'immediate',
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'cursor-agent-native',
      id: context.id,
      target: 'chat',
      anchorSeq: anchorOf(context),
      location: context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' },
      visibility: 'visible',
      data: context.state,
    }
  },
}

/** One loaded turn start in timeline order. */
export interface TurnStart {
  readonly turn: number
  readonly startMs: number
}

/** Next loaded turn start after the current turn, or null when current is last/unknown.
 * @param orderedStarts - Loaded turn starts in timeline order.
 * @param currentTurn - Turn number owning the querying container.
 * @returns Next start wall clock, or null.
 */
export function nextStartMs(orderedStarts: readonly TurnStart[], currentTurn: number): number | null {
  const index = orderedStarts.findIndex(item => item.turn === currentTurn)
  if (index < 0) return null
  return orderedStarts[index + 1]?.startMs ?? null
}

/** Whether a row is owned by its turn's actual Core window (vs recorded between turns).
 * @param firstSeenMs - Row firstSeenAt wall clock.
 * @param startMs - Owning turn/start wall clock.
 * @param endMs - Owning turn/end wall clock, or null for the open turn.
 * @returns True when the row falls inside Core [start, end).
 */
export function isOwnedByTurn(firstSeenMs: number, startMs: number, endMs: number | null): boolean {
  if (!Number.isFinite(firstSeenMs) || !Number.isFinite(startMs)) return false
  if (firstSeenMs < startMs) return false
  return endMs === null || firstSeenMs < endMs
}

/** Rows partitioned to one turn by loaded starts, oldest first.
 * Later tool updates do not move a row into another turn (callers pass
 * firstSeenAt-derived rows). The earliest loaded turn may include earlier
 * records (explicitly unassigned); each following turn takes
 * [start, nextStart); the last turn is unbounded to now. Gaps and trailing
 * records therefore never vanish, and loading the next turn re-partitions
 * without duplicates.
 * @param rows - Folded session rows in seq order.
 * @param startMs - Owning turn/start wall clock.
 * @param nextStartMsValue - Next loaded turn/start wall clock, or null for last/unknown.
 * @param nowMs - Now for the open-ended window; defaults to the wall clock.
 * @param includeEarlier - True for the earliest loaded turn: include records before startMs.
 * @returns The owning turn's rows.
 */
export function rowsForTurnWindow<T extends { readonly firstSeenAt: string }>(
  rows: readonly T[],
  startMs: number,
  nextStartMsValue: number | null,
  nowMs: number = Date.now(),
  includeEarlier = false,
): readonly T[] {
  return rows.filter(row => {
    const ms = Date.parse(row.firstSeenAt)
    if (!Number.isFinite(ms)) return false
    if (!includeEarlier && ms < startMs) return false
    if (nextStartMsValue !== null) return ms < nextStartMsValue
    return ms <= nowMs
  })
}

function anchorOf(context: ConversationNodeContext<CursorAgentNativeTurn>): number {
  let seq = context.start?.event.seq
  let chunk: number | undefined
  let step: number | undefined
  let after = Number.NEGATIVE_INFINITY
  for (const match of context.matches) {
    const next = match.event.seq
    if (typeof next !== 'number' || !Number.isFinite(next)) continue
    if ((match.event.type === 'assistant/live-chunk' || match.event.type === 'assistant/chunk') && chunk === undefined) chunk = next
    else if (match.event.type === 'step/start' && step === undefined) step = next
    if (match.event.type === 'system/message' || match.event.type === 'user/message') after = Math.max(after, next)
  }
  const chosen = chunk ?? step ?? seq
  const base = typeof chosen === 'number' && Number.isFinite(chosen) ? chosen : 0
  return after > base ? after + 0.001 : base
}

/** Keep independent activity while the assistant-step renders its own answer.
 * Older records have no source: only remove an exact duplicate or answer suffix.
 * Uncertain legacy content stays visible rather than losing a plan or progress.
 */
export function visibleNativeTexts(rows: readonly CursorAgentAgentTextRow[], answers: readonly string[]): readonly CursorAgentAgentTextRow[] {
  const nonempty = answers.filter(answer => answer.length > 0).reverse()
  if (nonempty.length === 0) return rows
  return rows.flatMap(row => {
    if (row.kind === 'thought' || row.parentTrajectoryId !== undefined || row.source === 'plan') return [row]
    if (row.source === 'assistant') return []
    let text = row.text
    for (const answer of nonempty) {
      if (answer.includes(text)) return []
      if (text.endsWith(answer)) text = text.slice(0, -answer.length)
    }
    return text === row.text ? [row] : [{ ...row, text }]
  })
}
