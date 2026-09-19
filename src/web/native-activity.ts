/** Fold plugin-owned native tool history into transcript rows.
 *
 * Browser-safe fold over the activity sidecar: one row per native tool launch,
 * oldest first, plus first observations and thought/text rows. A launch
 * completion (or failure) is the launch tool's own outcome; it never claims a
 * child outcome, and no row is ever inferred from thought text. Reuses the
 * canonical fold, so display state cannot drift from durable state.
 *
 * The subscription retains one fold and one sequence cursor per connection and
 * session: it bootstraps once with a full validated read, then requests only
 * records after its cursor. Epoch, row routing, and text merging survive page
 * boundaries; a stale cursor or a backlog deeper than the page budget
 * resynchronizes with one full read instead of an unbounded number of pages.
 */
import {
  CURSOR_AGENT_SESSION_READY,
  CURSOR_AGENT_REQUEST_TELEMETRY,
  CURSOR_AGENT_USAGE_SNAPSHOTS,
  CURSOR_AGENT_OBSERVED,
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_USER_QUESTION_ANSWER,
  type CursorAgentToolOwnership,
  CURSOR_AGENT_TOOL_START,
  foldCursorAgentToolEvent,
  type CursorAgentToolState,
} from '../tool-events.js'
import { ACP_SETTINGS_RPC_CHANNEL } from '../client-contract.js'
import {
  ACTIVITY_ENDPOINT,
  ACTIVITY_READ_AFTER_ENDPOINT,
  ACTIVITY_STALE_CURSOR,
  CURSOR_AGENT_FULL_ACCESS_AUTHORIZED,
  decodeActivityHistory,
  decodeActivityPage,
  type CursorAgentActivityPage,
  type CursorAgentActivityRecord,
} from '../activity-contract.js'

/** One folded row: stable key, display state, and last-event time. */
export interface CursorAgentToolRowData {
  readonly key: string
  readonly epoch: number
  readonly state: CursorAgentToolState
  readonly time: string
  readonly firstSeenAt: string
}

/** Retained fold row: display state updates in place as later records arrive. */
export interface NativeActivityRow {
  readonly key: string
  readonly epoch: number
  state: CursorAgentToolState
  time: string
  readonly firstSeenAt: string
}

export interface CursorAgentAgentData {
  readonly key: string
  readonly epoch: number
  readonly firstSeenAt: string
  readonly ownership: CursorAgentToolOwnership
}

/** Sidecar thought/text row, parent or child. */
export interface CursorAgentAgentTextRow {
  readonly key: string
  readonly epoch: number
  readonly firstSeenAt: string
  readonly trajectoryId: string
  readonly parentTrajectoryId?: string
  readonly kind: 'text' | 'thought'
  readonly text: string
}

/** Retained text row: adjacent same-key deltas append in place across pages. */
export interface NativeActivityTextRow {
  readonly key: string
  readonly epoch: number
  readonly firstSeenAt: string
  readonly trajectoryId: string
  readonly parentTrajectoryId?: string
  readonly kind: 'text' | 'thought'
  text: string
}

/** Fold state retained across incremental pages and replaced only by a full bootstrap. */
export interface NativeActivityFoldState {
  readonly rows: NativeActivityRow[]
  readonly indexById: Map<string, number>
  readonly agents: Map<string, CursorAgentAgentData>
  readonly texts: NativeActivityTextRow[]
  epoch: number
}

/** Empty fold state for a new bootstrap; epoch 0 until the first session-ready record.
 * @returns Mutable fold state owned by one subscription.
 */
export function createNativeActivityFoldState(): NativeActivityFoldState {
  return { rows: [], indexById: new Map(), agents: new Map(), texts: [], epoch: 0 }
}

/** Apply decoded records in seq order to retained fold state.
 * The caller keeps records ordered; rows, agents, and text merge into that state, so
 * an incremental page behaves exactly like the same records in a full history.
 * @param state - State retained across pages.
 * @param records - Decoded records continuing after the state's last record.
 * @returns The same state, updated.
 */
export function applyActivityRecords(state: NativeActivityFoldState, records: readonly CursorAgentActivityRecord[]): NativeActivityFoldState {
  for (const record of records) {
    if (record.type === CURSOR_AGENT_SESSION_READY) {
      state.epoch += 1
      continue
    }
    if (record.type === CURSOR_AGENT_OBSERVED) {
      const key = `${state.epoch}\n${record.data.trajectoryId}`
      if (!state.agents.has(key)) state.agents.set(key, { key: String(record.seq), epoch: state.epoch, firstSeenAt: record.time, ownership: record.data })
      continue
    }
    if (record.type === CURSOR_AGENT_TEXT) {
      const last = state.texts.at(-1)
      if (last !== undefined && last.epoch === state.epoch && last.kind === record.data.kind && last.trajectoryId === record.data.trajectoryId && last.parentTrajectoryId === record.data.parentTrajectoryId) {
        last.text += record.data.text
        continue
      }
      state.texts.push({
        key: String(record.seq),
        epoch: state.epoch,
        firstSeenAt: record.time,
        trajectoryId: record.data.trajectoryId,
        ...(record.data.parentTrajectoryId === undefined ? {} : { parentTrajectoryId: record.data.parentTrajectoryId }),
        kind: record.data.kind,
        text: record.data.text,
      })
      continue
    }
    if (record.type === CURSOR_AGENT_USER_QUESTION_ANSWER || record.type === CURSOR_AGENT_FULL_ACCESS_AUTHORIZED || record.type === CURSOR_AGENT_REQUEST_TELEMETRY || record.type === CURSOR_AGENT_USAGE_SNAPSHOTS) continue
    // Native tool ids can repeat across startups: the (epoch, tool id) pair only
    // routes updates, while every new row keys on its record seq, so ids
    // containing newlines can never collide.
    const id = String(state.epoch) + '\n' + record.data.toolId
    if (record.type === CURSOR_AGENT_TOOL_START) {
      state.indexById.set(id, state.rows.length)
      state.rows.push({ key: String(record.seq), epoch: state.epoch, state: record.data, time: record.time, firstSeenAt: record.time })
      continue
    }
    const index = state.indexById.get(id)
    if (index === undefined) {
      state.indexById.set(id, state.rows.length)
      state.rows.push({
        key: String(record.seq),
        epoch: state.epoch,
        state: foldCursorAgentToolEvent(undefined, { type: record.type, data: record.data }),
        time: record.time,
        firstSeenAt: record.time,
      })
      continue
    }
    const current = state.rows[index]
    if (current === undefined) continue
    current.state = foldCursorAgentToolEvent(current.state, { type: record.type, data: record.data })
    current.time = record.time
  }
  return state
}

/** Rows a snapshot exposes: unowned pending previews remain in the fold until native execution supplies their placement.
 * @param rows - Retained fold rows, including rows the transcript must not show yet.
 * @returns The visible subset, in fold order.
 */
export function visibleActivityRows(rows: readonly CursorAgentToolRowData[]): readonly CursorAgentToolRowData[] {
  return rows.filter(row => row.state.status !== 'pending' || row.state.ownership !== undefined)
}

/** Fold first observations independently of tool launches, including zero-tool children.
 * @param records - Decoded sidecar history in sequence order.
 * @returns Agent observations scoped to native runtime epochs.
 */
export function foldAgentRecords(records: readonly CursorAgentActivityRecord[]): CursorAgentAgentData[] {
  return [...applyActivityRecords(createNativeActivityFoldState(), records).agents.values()]
}

/** Fold sidecar thought/text records in sequence order, coalescing adjacent
 * same-kind deltas on one trajectory.
 * @param records - Decoded sidecar history.
 * @returns Text rows scoped to native runtime epochs.
 */
export function foldAgentTextRecords(records: readonly CursorAgentActivityRecord[]): CursorAgentAgentTextRow[] {
  return applyActivityRecords(createNativeActivityFoldState(), records).texts
}

/** Fold history records into display rows, oldest first.
 * @param records - Decoded history records in seq order.
 * @returns Display rows, oldest first, keyed by record seq.
 */
export function foldActivityRecords(records: readonly CursorAgentActivityRecord[]): readonly CursorAgentToolRowData[] {
  return visibleActivityRows(applyActivityRecords(createNativeActivityFoldState(), records).rows)
}

/** Minimal RPC face the transcript container needs: logical-channel call with caller cancellation. */
export interface ActivityRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<{
    readonly ok: boolean
    readonly value?: unknown
    readonly error?: { readonly code?: string; readonly message: string }
  }>
}

/** Read the full validated history; the bootstrap and resynchronization read. */
async function loadActivityRecords(rpc: ActivityRpc, sessionId: string, signal?: AbortSignal, metrics?: NativeActivityMetrics): Promise<readonly CursorAgentActivityRecord[]> {
  if (metrics !== undefined) metrics.fullReadCalls += 1
  const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, ACTIVITY_ENDPOINT, { sessionId }, signal)
  if (!result.ok) throw new Error(result.error?.message ?? 'CursorAgent activity history is unavailable')
  return decodeActivityHistory(result.value).records
}

/** Read one bounded page strictly after the retained cursor. */
async function loadActivityPage(rpc: ActivityRpc, sessionId: string, afterSeq: number, signal: AbortSignal, metrics?: NativeActivityMetrics): Promise<CursorAgentActivityPage> {
  const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, ACTIVITY_READ_AFTER_ENDPOINT, { sessionId, afterSeq }, signal)
  if (!result.ok) {
    const message = result.error?.message ?? 'CursorAgent activity history is unavailable'
    if (result.error?.code === ACTIVITY_STALE_CURSOR) throw new StaleActivityCursorError(message)
    throw new Error(message)
  }
  const page = decodeActivityPage(result.value, afterSeq)
  if (metrics !== undefined) {
    metrics.pageCalls += 1
    metrics.pageRecords += page.records.length
  }
  return page
}

/** Host history no longer contains the retained cursor: resynchronize instead of retrying it. */
class StaleActivityCursorError extends Error {}

/** Poll interval for the session-scoped native history subscription. */
export const NATIVE_HISTORY_POLL_MS = 1000

/** Page budget for one poll: a deeper backlog than this resynchronizes instead of chasing pages. */
export const NATIVE_HISTORY_MAX_FOLLOW_UP_PAGES = 4

/** Snapshot shared by every mounted turn container in one session. */
export interface NativeHistorySnapshot {
  readonly rows: readonly CursorAgentToolRowData[]
  readonly agents: readonly CursorAgentAgentData[]
  readonly texts: readonly CursorAgentAgentTextRow[]
  readonly error?: string
}

/** Value-free browser-side counters for bounded reads and resynchronizations. */
export interface NativeActivityMetricsSnapshot {
  readonly fullReadCalls: number
  readonly pageCalls: number
  readonly pageRecords: number
  readonly resynchronizations: number
}

interface NativeActivityMetrics {
  fullReadCalls: number
  pageCalls: number
  pageRecords: number
  resynchronizations: number
}

function copyNativeActivityMetrics(metrics: NativeActivityMetrics): NativeActivityMetricsSnapshot {
  return { ...metrics }
}

/** Shared empty snapshot until the first successful history read. */
const EMPTY_NATIVE_HISTORY: NativeHistorySnapshot = { rows: [], agents: [], texts: [] }

interface NativeHistoryEntry {
  state: NativeActivityFoldState
  snapshot: NativeHistorySnapshot
  metrics: NativeActivityMetrics
  /** Exclusive cursor of the retained state: 0 until a bootstrap completes. */
  cursor: number
  bootstrapped: boolean
  listeners: Set<() => void>
  timer: ReturnType<typeof setTimeout> | undefined
  controller: AbortController | undefined
}

/** One entry per live connection and session: keying by the RPC face keeps
 * concurrent connections from sharing or resurrecting each other's history,
 * so a reconnecting connection bootstraps from its own full read.
 * Unsubscribed entries retain history but no timer or active request.
 * ponytail: histories live for the RPC lifetime; add inactive-session LRU eviction
 * if browsing many large sessions makes retained memory significant.
 */
const nativeHistoryStores = new WeakMap<ActivityRpc, Map<string, NativeHistoryEntry>>()

function entryFor(rpc: ActivityRpc, sessionId: string): NativeHistoryEntry {
  let bySession = nativeHistoryStores.get(rpc)
  if (bySession === undefined) {
    bySession = new Map()
    nativeHistoryStores.set(rpc, bySession)
  }
  let entry = bySession.get(sessionId)
  if (entry === undefined) {
    entry = {
      state: createNativeActivityFoldState(),
      snapshot: EMPTY_NATIVE_HISTORY,
      metrics: { fullReadCalls: 0, pageCalls: 0, pageRecords: 0, resynchronizations: 0 },
      cursor: 0,
      bootstrapped: false,
      listeners: new Set(),
      timer: undefined,
      controller: undefined,
    }
    bySession.set(sessionId, entry)
  }
  return entry
}

function snapshotOf(state: NativeActivityFoldState, error?: string): NativeHistorySnapshot {
  return {
    rows: visibleActivityRows(state.rows),
    agents: [...state.agents.values()],
    texts: state.texts.slice(),
    ...(error === undefined ? {} : { error }),
  }
}

function notifyEntry(entry: NativeHistoryEntry): void {
  for (const listener of [...entry.listeners]) listener()
}

/** Replace retained state with a full validated read; assigned only after the read resolves and
 * only while this poll is still the active one, so a failed or superseded bootstrap never leaves
 * a partial snapshot or resurrects a torn-down fold.
 * @returns True when the retained state was replaced.
 */
async function bootstrapNativeHistory(sessionId: string, entry: NativeHistoryEntry, rpc: ActivityRpc, controller: AbortController): Promise<boolean> {
  const records = await loadActivityRecords(rpc, sessionId, controller.signal, entry.metrics)
  if (entry.controller !== controller) return false
  entry.state = applyActivityRecords(createNativeActivityFoldState(), records)
  entry.cursor = records.at(-1)?.seq ?? 0
  entry.bootstrapped = true
  return true
}

/** Apply bounded pages after the retained cursor.
 * @returns True when at least one record or a resynchronization changed the state.
 */
async function followNativeHistory(sessionId: string, entry: NativeHistoryEntry, rpc: ActivityRpc, controller: AbortController): Promise<boolean> {
  let changed = false
  for (let page = 0; page < NATIVE_HISTORY_MAX_FOLLOW_UP_PAGES; page++) {
    const next = await loadActivityPage(rpc, sessionId, entry.cursor, controller.signal, entry.metrics)
    if (entry.controller !== controller) return changed
    changed = changed || next.records.length > 0
    applyActivityRecords(entry.state, next.records)
    entry.cursor = next.nextCursor
    // A later page can be cancelled on navigation: keep the snapshot aligned
    // with every committed cursor, not only with a fully completed poll.
    if (next.records.length > 0) entry.snapshot = snapshotOf(entry.state)
    if (!next.hasMore) return changed
  }
  entry.metrics.resynchronizations += 1
  return (await bootstrapNativeHistory(sessionId, entry, rpc, controller)) || changed
}

async function pollNativeHistory(sessionId: string, entry: NativeHistoryEntry, rpc: ActivityRpc): Promise<void> {
  if (entry.controller !== undefined || entry.listeners.size === 0) return
  const controller = new AbortController()
  entry.controller = controller
  let changed = false
  let error: string | undefined
  try {
    try {
      if (!entry.bootstrapped) {
        changed = await bootstrapNativeHistory(sessionId, entry, rpc, controller)
      } else {
        changed = await followNativeHistory(sessionId, entry, rpc, controller)
      }
    } catch (caught) {
      if (!(caught instanceof StaleActivityCursorError)) throw caught
      // The host history no longer contains this cursor: resynchronize once from a full read.
      entry.metrics.resynchronizations += 1
      changed = await bootstrapNativeHistory(sessionId, entry, rpc, controller)
    }
  } catch (caught) {
    if (entry.controller !== controller) return
    error = caught instanceof Error ? caught.message : 'CursorAgent activity history is unavailable'
  } finally {
    if (entry.controller !== controller) return
    entry.controller = undefined
  }
  // An unchanged poll keeps the snapshot identity, so React only re-renders on real activity.
  if (changed || error !== entry.snapshot.error) entry.snapshot = snapshotOf(entry.state, error)
  notifyEntry(entry)
  scheduleNativeHistory(sessionId, entry, rpc)
}

function scheduleNativeHistory(sessionId: string, entry: NativeHistoryEntry, rpc: ActivityRpc): void {
  if (entry.listeners.size === 0) return
  if (entry.timer !== undefined) return
  entry.timer = setTimeout(() => {
    entry.timer = undefined
    void pollNativeHistory(sessionId, entry, rpc)
  }, NATIVE_HISTORY_POLL_MS)
}

/** Session-scoped abortable subscription over native history: one poll loop
 * per connection and session no matter how many turn containers mount, so
 * trailing records after a turn ends still arrive while any native view stays
 * mounted. The first poll bootstraps from the full history; later polls apply
 * only records after the retained cursor. Late tool updates never move rows
 * (partition keys on firstSeenAt). Refresh and resubscribe cancel the active
 * read and start a new one, so a superseded promise can never stall the loop.
 * No new framework dependency: plain subscribe/getSnapshot for useSyncExternalStore.
 * @param rpc - Logical-channel RPC face scoping the store lifetime.
 * @param sessionId - DSH session scoping the sidecar read.
 * @returns Shared subscription, snapshot, refresh, and value-free metrics seams.
 */
export function getNativeHistoryStore(rpc: ActivityRpc, sessionId: string): {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => NativeHistorySnapshot
  readonly getMetrics: () => NativeActivityMetricsSnapshot
  readonly refresh: () => void
} {
  const entry = entryFor(rpc, sessionId)
  return {
    subscribe: (listener: () => void): (() => void) => {
      entry.listeners.add(listener)
      if (entry.listeners.size === 1) void pollNativeHistory(sessionId, entry, rpc)
      else scheduleNativeHistory(sessionId, entry, rpc)
      return () => {
        entry.listeners.delete(listener)
        if (entry.listeners.size === 0) {
          if (entry.timer !== undefined) { clearTimeout(entry.timer); entry.timer = undefined }
          entry.controller?.abort()
          entry.controller = undefined
          // Keep the fold and cursor together: remounts display history immediately
          // and fetch only activity received while this session was offscreen.
        }
      }
    },
    getSnapshot: (): NativeHistorySnapshot => entry.snapshot,
    getMetrics: (): NativeActivityMetricsSnapshot => copyNativeActivityMetrics(entry.metrics),
    refresh: (): void => {
      entry.controller?.abort()
      entry.controller = undefined
      if (entry.timer !== undefined) { clearTimeout(entry.timer); entry.timer = undefined }
      // The next poll bootstraps from the full history and swaps it in atomically.
      entry.bootstrapped = false
      if (entry.listeners.size > 0) void pollNativeHistory(sessionId, entry, rpc)
    },
  }
}
