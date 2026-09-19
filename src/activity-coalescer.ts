/** Bounded per-session coalescing for CursorAgent native activity.
 *
 * Transient presentation records (thought/text deltas and a running tool row's
 * output growth) are merged in memory and written as one durable batch, so a
 * fast native turn no longer causes one JSONL append per delta. Every other
 * record keeps today's semantics: it is written before anything that follows
 * it, and it flushes the records it followed, so session readiness, audit,
 * trajectory discovery, user answers, usage, tool starts and every tool
 * lifecycle change — including a terminal completed/failed state — can never be
 * reordered behind buffered text or delayed behind the window.
 *
 * Each session buffer is bounded independently by three ceilings: buffered
 * records, one text record, and the serialized bytes of the whole buffer.
 * Crossing any of them forces a flush; a required record is never dropped.
 *
 * The module is pure apart from the injected sink and clock: no filesystem, no
 * ACP, no imports from the host, so a fake timer fully determines its behavior.
 */
import { Buffer } from 'node:buffer'
import {
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_TOOL_UPDATE,
  type CursorAgentAgentTextData,
  type CursorAgentToolUpdateData,
} from './tool-events.js'
import type { CursorAgentActivityEvent } from './activity-store.js'
import { CursorAgentActivityMetrics, nowMs } from './activity-metrics.js'

/** Transient delivery window; a closed paragraph still flushes immediately. */
export const ACTIVITY_COALESCE_WINDOW_MS = 400
/** Hard ceiling on buffered records per session; reaching it forces a flush. */
export const ACTIVITY_MAX_PENDING_RECORDS = 64
/** Hard ceiling on one text record; a longer delta starts a new pending record. */
export const ACTIVITY_MAX_TEXT_CHARS = 8192
/** Fixed ceiling on the serialized bytes buffered for one session.
 *
 * The record and text ceilings bound how many records and characters may wait,
 * not their size: JSON escaping can turn one character into six bytes, and a
 * tool row carries input, output and error. Crossing this ceiling forces a
 * flush, never a dropped record. It sits above the largest record the per-record
 * limits can produce (ACTIVITY_MAX_TEXT_CHARS, and the tool text truncation),
 * so flushing can always restore the budget. */
export const ACTIVITY_MAX_PENDING_BYTES = 256 * 1024
/** Non-growing updates a pending tool row absorbs before it is written anyway, so
 * a progress line that only redraws in place still advances for the reader. */
export const ACTIVITY_TOOL_SKIP_FLUSH = 32

/** Durable write seam: one call per batch, throwing fail-closed like today. */
export interface ActivityCoalescerSink {
  append(sessionId: string, events: readonly CursorAgentActivityEvent[]): void
}

interface TextPending {
  readonly kind: 'text'
  readonly key: string
  data: CursorAgentAgentTextData & { text: string }
  /** Serialized bytes of this record, kept so the buffer total stays incremental. */
  bytes: number
}

interface ToolPending {
  readonly kind: 'tool'
  readonly toolId: string
  data: CursorAgentToolUpdateData
  /** Output length of the first update this record absorbed. */
  readonly base: number
  /** Non-growing updates folded into this record since it last carried progress. */
  skipped: number
  /** Serialized bytes of this record, kept so the buffer total stays incremental. */
  bytes: number
}

type Pending = TextPending | ToolPending

interface SessionBuffer {
  readonly sessionId: string
  queue: Pending[]
  /** Serialized bytes of `queue`, so the byte ceiling check is O(1) per append. */
  bytes: number
  timer: ReturnType<typeof setTimeout> | undefined
  /** A timer-driven flush failed; the next caller-owned operation rethrows it. */
  deferred: Error | undefined
}

/** Statuses that settle a tool row: they are durable when they arrive. */
function isTerminalToolStatus(status: CursorAgentToolUpdateData['status']): boolean {
  return status === 'completed' || status === 'failed'
}

/** Whether this record may wait in the buffer for its window.
 *
 * Text deltas and a running row's output growth coalesce. A terminal tool state
 * does not: a reader must see completed/failed durably as soon as it arrives,
 * not up to one window later, and it is an ordering barrier in {@link append}.
 */
function isCoalescible(event: CursorAgentActivityEvent): boolean {
  if (event.type === CURSOR_AGENT_TEXT) return true
  if (event.type !== CURSOR_AGENT_TOOL_UPDATE) return false
  return !isTerminalToolStatus(event.data.status)
}

/** Serialized size of one durable event, the unit the byte ceiling counts. */
function recordBytes(event: CursorAgentActivityEvent): number {
  return Buffer.byteLength(JSON.stringify(event), 'utf8')
}

/** Serialized bytes one appended string value adds to a record, escaping included. */
function escapedBytes(value: string): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8') - 2
}

/**
 * Whether buffered text has reached a paragraph or closed-code-block boundary.
 *
 * The window is a ceiling, not a delay: text that already forms a visible block
 * is written now, so streaming still shows the first paragraph promptly. Only a
 * fence that is still open defers, because its remainder is still being typed.
 */
function atTextBoundary(text: string): boolean {
  if (/\n[ \t]*\n/.test(text)) return true
  if (!text.startsWith('```')) return false
  const fence = text.indexOf('\n')
  if (fence === -1) return false
  const closer = text.indexOf('\n```', fence)
  return closer !== -1 && /^\n?[ \t]*$/.test(text.slice(closer + 4))
}

/** Stable merge key: trajectory, parent and kind must match, undefined included. */
function textKey(data: CursorAgentAgentTextData): string {
  return data.trajectoryId + '\u0000' + (data.parentTrajectoryId ?? '') + '\u0000' + data.kind
}

/**
 * Whether one tool update can be folded into the buffered record for its row as
 * unbounded, order-preserving growth.
 *
 * The mergeable change is output that extends the string already buffered:
 * terminal output is cumulative, so the merged record folds to the same state as
 * the updates it replaces while keeping the first update's fields. A status,
 * name, ownership or location change materializes a record instead, so a
 * lifecycle transition is never hidden behind the window. A redraw that does not
 * extend the buffered value is handled by the bounded replacement policy below:
 * the latest row is retained and emitted after a finite skip count, so terminal
 * redraws cannot flood persistence.
 */
function toolMergeable(pending: ToolPending, next: CursorAgentToolUpdateData): boolean {
  const previous = pending.data
  if (next.toolId !== previous.toolId || next.status !== previous.status) return false
  if (next.ownership !== undefined && JSON.stringify(next.ownership) !== JSON.stringify(previous.ownership)) return false
  if (next.name !== undefined && next.name !== previous.name) return false
  if (next.location !== undefined && JSON.stringify(next.location) !== JSON.stringify(previous.location)) return false
  if (next.input !== undefined && next.input !== previous.input) return false
  const output = next.output ?? ''
  return output.length > pending.base && output.startsWith(previous.output ?? '')
}

/** Field-wise merge that reproduces folding both updates in order. */
function mergeToolUpdate(pending: ToolPending, next: CursorAgentToolUpdateData): ToolPending {
  const previous = pending.data
  return {
    kind: 'tool',
    toolId: pending.toolId,
    base: pending.base,
    skipped: 0,
    bytes: pending.bytes,
    data: {
      toolId: next.toolId,
      ...(next.name === undefined && previous.name === undefined ? {} : { name: next.name ?? previous.name }),
      status: next.status,
      ...(next.ownership === undefined && previous.ownership === undefined ? {} : { ownership: next.ownership ?? previous.ownership }),
      ...(next.location === undefined && previous.location === undefined ? {} : { location: next.location ?? previous.location }),
      ...(next.input === undefined && previous.input === undefined ? {} : { input: next.input ?? previous.input }),
      ...(next.output === undefined && previous.output === undefined ? {} : { output: next.output ?? previous.output }),
      ...(next.error === undefined && previous.error === undefined ? {} : { error: next.error ?? previous.error }),
    },
  }
}

/** Output already visible in a pending row; the fold a redraw must extend to count as progress. */
function tailOutput(pending: ToolPending): string {
  return pending.data.output ?? ''
}

/**
 * Whether an update repeats the pending row field for field, so folding it in
 * leaves the folded row unchanged.
 *
 * Undefined matches only undefined: the fold keeps a prior value when an update
 * omits a field, so absorbing an update that omits one would erase it from the
 * durable row instead of preserving the state the stream folded to.
 */
function repeatsPendingRow(previous: CursorAgentToolUpdateData, next: CursorAgentToolUpdateData): boolean {
  const equal = (left: unknown, right: unknown): boolean => left === undefined || right === undefined
    ? left === right
    : JSON.stringify(left) === JSON.stringify(right)
  return next.status === previous.status
    && equal(next.name, previous.name)
    && equal(next.ownership, previous.ownership)
    && equal(next.location, previous.location)
    && equal(next.input, previous.input)
    && equal(next.output, previous.output)
    && equal(next.error, previous.error)
}

/** A same-row replacement can wait for the finite repaint bound. */
function repaintMergeable(previous: CursorAgentToolUpdateData, next: CursorAgentToolUpdateData): boolean {
  const equal = (left: unknown, right: unknown): boolean => left === undefined || right === undefined
    ? left === right
    : JSON.stringify(left) === JSON.stringify(right)
  return next.toolId === previous.toolId
    && next.status === previous.status
    && equal(next.name, previous.name)
    && equal(next.ownership, previous.ownership)
    && equal(next.location, previous.location)
    && equal(next.input, previous.input)
    && (next.output !== undefined || next.error !== undefined)
}

/** Materialize one pending record back into its durable event. */
function toEvent(pending: Pending): CursorAgentActivityEvent {
  return pending.kind === 'tool'
    ? { type: CURSOR_AGENT_TOOL_UPDATE, data: pending.data }
    : { type: CURSOR_AGENT_TEXT, data: pending.data }
}

/**
 * Per-session bounded activity buffer with ordering barriers.
 *
 * Construct once per activity store and route every append through it: the
 * barriers only hold if all writers share the same buffer.
 */
export class CursorAgentActivityCoalescer {
  private readonly sessions = new Map<string, SessionBuffer>()
  /** Buffered records across all sessions, kept so the counters stay O(1) per append. */
  private pendingTotal = 0
  /** Buffered serialized bytes across all sessions, mirroring {@link pendingTotal}. */
  private pendingBytes = 0

  /** Capture the durable sink and optional timer injection for tests.
   * @param sink - Durable writer; must throw (not reject) so failures reach the turn.
   * @param windowMs - Maximum time a transient record may stay buffered.
   * @param metrics - Optional value-free counters; omit to skip measurement entirely.
   */
  constructor(
    private readonly sink: ActivityCoalescerSink,
    private readonly windowMs: number = ACTIVITY_COALESCE_WINDOW_MS,
    private readonly metrics?: CursorAgentActivityMetrics,
  ) {}

  /**
   * Route one batch of durable events for one session.
   *
   * Coalescible records join the buffer; any other record — a terminal tool
   * state included — is an ordering barrier that materializes the buffer first
   * and is then written on arrival. A previous failed flush stays fail-closed:
   * nothing is retried and the original error is rethrown.
   * @param sessionId - DSH session owning the history.
   * @param events - Durable events in publish order.
   */
  append(sessionId: string, events: readonly CursorAgentActivityEvent[]): void {
    let buffer = this.sessions.get(sessionId)
    for (const event of events) {
      if (buffer?.deferred !== undefined) throw buffer.deferred
      if (!isCoalescible(event)) {
        // Every non-coalescible record is an ordering barrier, including a
        // terminal tool state and the session-ready record that opens the next
        // native epoch.
        if (buffer !== undefined && buffer.queue.length > 0) this.flush(sessionId)
        this.sink.append(sessionId, [event])
        continue
      }
      buffer ??= this.open(sessionId)
      if (buffer.queue.length >= ACTIVITY_MAX_PENDING_RECORDS) this.flush(sessionId)
      // Charge the arrival before it joins the buffer: when it would cross the
      // byte ceiling, what is buffered is written first and the arrival starts a
      // new record instead. Nothing is ever dropped to fit.
      const bytes = recordBytes(event)
      this.reserve(buffer, bytes)
      const bounded = event.type === CURSOR_AGENT_TEXT
        ? this.bufferText(buffer, event.data, bytes)
        : this.bufferToolUpdate(buffer, event.data as CursorAgentToolUpdateData, bytes)
      // A boundary or skip-count flush writes the record just buffered, so the
      // appended content is already durable and still in emitted order.
      if (bounded) this.flush(sessionId)
      else this.schedule(sessionId, buffer)
    }
  }

  /**
   * Write every buffered record for one session now.
   *
   * An empty queue still reports a deferred timer-flush failure: the batch that
   * failed is gone, but its error is owed to this caller-owned operation.
   * @param sessionId - DSH session whose buffer must materialize.
   */
  flush(sessionId: string): void {
    const buffer = this.sessions.get(sessionId)
    if (buffer === undefined) return
    if (buffer.queue.length === 0) {
      if (buffer.deferred !== undefined) throw buffer.deferred
      return
    }
    const batch = buffer.queue
    const batchBytes = buffer.bytes
    buffer.queue = []
    buffer.bytes = 0
    this.pendingDelta(-batch.length, -batchBytes)
    const started = nowMs()
    try {
      // Drop the timer first: a throwing sink must not leave a live timer that
      // re-enters the same failed batch.
      buffer.deferred = undefined
      this.clearTimer(buffer)
      this.sink.append(sessionId, batch.map(toEvent))
      this.metrics?.recordFlush(batch.length, nowMs() - started)
    } catch (error) {
      this.metrics?.recordFlushFailure()
      buffer.deferred = error instanceof Error ? error : new Error('CursorAgent activity flush failed')
      throw buffer.deferred
    }
  }

  /** Flush every session; used before adapter teardown.
   *
   * One session's failure never abandons another's buffered records: every
   * buffer is attempted and the first failure is rethrown afterwards.
   * @returns The ids that had buffered records, for diagnostics.
   */
  flushAll(): readonly string[] {
    const flushed: string[] = []
    let failure: unknown
    for (const [sessionId, buffer] of [...this.sessions]) {
      if (buffer.queue.length === 0 && buffer.deferred === undefined) continue
      flushed.push(sessionId)
      try {
        this.flush(sessionId)
      } catch (error) {
        failure ??= error
      }
    }
    if (failure !== undefined) throw failure
    return flushed
  }

  /**
   * Flush one session and drop its buffer; called when the session is disposed.
   * A pending flush failure — deferred or fresh — is reported, then the buffer
   * is dropped either way.
   * @param sessionId - DSH session being disposed.
   */
  release(sessionId: string): void {
    const buffer = this.sessions.get(sessionId)
    if (buffer === undefined) return
    this.clearTimer(buffer)
    try {
      this.flush(sessionId)
    } finally {
      this.sessions.delete(sessionId)
    }
  }

  /** Flush every session and drop all buffers; called on adapter reset.
   * A flush failure is rethrown after every buffer was attempted and dropped.
   */
  reset(): void {
    try {
      this.flushAll()
    } finally {
      for (const buffer of this.sessions.values()) this.clearTimer(buffer)
      this.sessions.clear()
      this.pendingTotal = 0
      this.pendingBytes = 0
      this.metrics?.recordPending(0, 0)
    }
  }

  /** Buffered record count for one session, for tests and diagnostics. */
  pendingCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.queue.length ?? 0
  }

  private open(sessionId: string): SessionBuffer {
    const buffer: SessionBuffer = { sessionId, queue: [], bytes: 0, timer: undefined, deferred: undefined }
    this.sessions.set(sessionId, buffer)
    return buffer
  }

  /** Move the buffered gauges and mirror them into the counters. */
  private pendingDelta(records: number, bytes: number): void {
    this.pendingTotal += records
    this.pendingBytes += bytes
    this.metrics?.recordPending(this.pendingTotal, this.pendingBytes)
  }

  /**
   * Hold `bytes` in one session buffer, writing the buffer out first when the
   * per-session serialized ceiling would be crossed.
   *
   * Called before an arrival joins or grows the buffer, so a merged record
   * cannot push the buffer past the ceiling. Crossing it always means a flush,
   * never a dropped record; a lone record larger than the ceiling is still
   * buffered and written, because the per-record limits keep that from being
   * reachable in practice.
   * @param buffer - Session buffer that must hold the arrival.
   * @param bytes - Serialized size of the arrival, charged before it is applied.
   */
  private reserve(buffer: SessionBuffer, bytes: number): void {
    if (buffer.bytes + bytes <= ACTIVITY_MAX_PENDING_BYTES) return
    if (buffer.queue.length === 0) return
    // The flushed tail is gone, so a merge finds no record to fold into and
    // starts a new one: the arrival is never reflected onto a written row.
    this.flush(buffer.sessionId)
  }

  /** Merge one delta into the pending tail, or start a new record for it.
   * @param buffer - Session buffer that owns the queue tail.
   * @param data - Decoded native text delta.
   * @param bytes - Serialized size of the arrival, charged by the caller.
   * @returns Whether the merged text reached a paragraph or closed code block.
   */
  private bufferText(buffer: SessionBuffer, data: CursorAgentAgentTextData, bytes: number): boolean {
    const key = textKey(data)
    // Only the queue tail may merge: a record emitted between two deltas must
    // stay between them, or the fold would concatenate across it.
    const last = buffer.queue.at(-1)
    const pending = last?.kind === 'text' && last.key === key ? last : undefined
    if (pending !== undefined && pending.data.text.length + data.text.length <= ACTIVITY_MAX_TEXT_CHARS) {
      const growth = escapedBytes(data.text)
      pending.data.text += data.text
      pending.bytes += growth
      buffer.bytes += growth
      this.pendingDelta(0, growth)
      this.metrics?.recordCoalesced(1)
      return atTextBoundary(pending.data.text)
    }
    buffer.queue.push({ kind: 'text', key, data: { ...data }, bytes })
    buffer.bytes += bytes
    this.pendingDelta(1, bytes)
    return atTextBoundary(data.text)
  }

  /** Merge one tool update into the pending tail, or start a new record for it.
   * @param buffer - Session buffer that owns the queue tail.
   * @param data - Decoded native tool update; never a terminal state.
   * @param bytes - Serialized size of the arrival, charged by the caller.
   * @returns Whether the row hit its skip-count flush and must be written now.
   */
  private bufferToolUpdate(buffer: SessionBuffer, data: CursorAgentToolUpdateData, bytes: number): boolean {
    // Same tail rule: a tool update may only fold into the row's own latest
    // record while nothing else was emitted after it.
    const last = buffer.queue.at(-1)
    const pending = last?.kind === 'tool' && last.toolId === data.toolId ? last : undefined
    if (pending !== undefined && toolMergeable(pending, data)) {
      const merged = mergeToolUpdate(pending, data)
      merged.bytes = recordBytes(toEvent(merged))
      const growth = merged.bytes - pending.bytes
      buffer.bytes += growth
      this.pendingDelta(0, growth)
      buffer.queue[buffer.queue.length - 1] = merged
      this.metrics?.recordCoalesced(1)
      return false
    }
    if (pending !== undefined && repaintMergeable(pending.data, data)) {
      // A same-row repaint replaces the pending display value, then advances at
      // the finite skip bound. Fields omitted by the repaint stay preserved.
      const replacement = mergeToolUpdate(pending, data)
      replacement.skipped = pending.skipped + 1
      replacement.bytes = recordBytes(toEvent(replacement))
      const growth = replacement.bytes - pending.bytes
      buffer.bytes += growth
      this.pendingDelta(0, growth)
      buffer.queue[buffer.queue.length - 1] = replacement
      this.metrics?.recordCoalesced(1)
      return replacement.skipped >= ACTIVITY_TOOL_SKIP_FLUSH
    }
    if (pending !== undefined
      && (data.output ?? '').length <= pending.base
      && (data.output ?? '').startsWith(tailOutput(pending))
      && repeatsPendingRow(pending.data, data)) {
      // A repaint that omits fields is absorbed only when it folds to the same
      // row, so no omitted value can erase the durable state.
      pending.skipped += 1
      this.metrics?.recordCoalesced(1)
      return pending.skipped >= ACTIVITY_TOOL_SKIP_FLUSH
    }
    buffer.queue.push({ kind: 'tool', toolId: data.toolId, data: { ...data }, base: data.output?.length ?? 0, skipped: 0, bytes })
    buffer.bytes += bytes
    this.pendingDelta(1, bytes)
    return false
  }

  private schedule(sessionId: string, buffer: SessionBuffer): void {
    if (buffer.timer !== undefined) return
    const timer = setTimeout(() => {
      buffer.timer = undefined
      try {
        this.flush(sessionId)
      } catch {
        // Fail closed without an unhandled rejection: no retry, and the next
        // append or explicit flush reports the original error to the caller.
      }
    }, this.windowMs)
    // A buffered record must never hold the host process open by itself.
    if (typeof (timer as { unref?: () => void }).unref === 'function') (timer as { unref: () => void }).unref()
    buffer.timer = timer
  }

  private clearTimer(buffer: SessionBuffer): void {
    if (buffer.timer === undefined) return
    clearTimeout(buffer.timer)
    buffer.timer = undefined
  }
}
