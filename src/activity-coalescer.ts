/** Bounded per-session coalescing for CursorAgent native activity.
 *
 * Transient presentation records (thought/text deltas and same-status tool
 * output growth) are merged in memory and written as one durable batch, so a
 * fast native turn no longer causes one JSONL append per delta. Every other
 * record keeps today's semantics: it is written before anything that follows
 * it, and it flushes the records it followed, so session readiness, audit,
 * trajectory discovery, user answers, usage, tool starts, tool lifecycle
 * changes and terminal states can never be reordered behind buffered text.
 *
 * The module is pure apart from the injected sink and clock: no filesystem, no
 * ACP, no imports from the host, so a fake timer fully determines its behavior.
 */
import {
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_TOOL_UPDATE,
  type CursorAgentAgentTextData,
  type CursorAgentToolUpdateData,
} from './tool-events.js'
import type { CursorAgentActivityEvent } from './activity-store.js'

/** Transient delivery window; a closed paragraph still flushes immediately. */
export const ACTIVITY_COALESCE_WINDOW_MS = 400
/** Hard ceiling on buffered records per session; reaching it forces a flush.
 * With the text ceiling below it also bounds the buffered serialized size. */
export const ACTIVITY_MAX_PENDING_RECORDS = 64
/** Hard ceiling on one text record; a longer delta starts a new pending record. */
export const ACTIVITY_MAX_TEXT_CHARS = 8192
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
}

interface ToolPending {
  readonly kind: 'tool'
  readonly toolId: string
  data: CursorAgentToolUpdateData
  /** Output length of the first update this record absorbed. */
  readonly base: number
  /** Non-growing updates folded into this record since it last carried progress. */
  skipped: number
}

type Pending = TextPending | ToolPending

interface SessionBuffer {
  queue: Pending[]
  timer: ReturnType<typeof setTimeout> | undefined
  /** A timer-driven flush failed; the next caller-owned operation rethrows it. */
  deferred: Error | undefined
}

/** Whether this record may be merged with a buffered record of the same kind. */
function isCoalescible(event: CursorAgentActivityEvent): boolean {
  return event.type === CURSOR_AGENT_TEXT || event.type === CURSOR_AGENT_TOOL_UPDATE
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
  return closer !== -1 && /(?:^|\n)[ \t]*$/.test(text.slice(closer + 1))
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
 * extend the buffered value is handled by the skip-count policy in
 * {@link CursorAgentActivityCoalescer} rather than merged here, because folding
 * it would replace the visible value instead of appending to it.
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

  /** Capture the durable sink and optional timer injection for tests.
   * @param sink - Durable writer; must throw (not reject) so failures reach the turn.
   * @param windowMs - Maximum time a transient record may stay buffered.
   */
  constructor(
    private readonly sink: ActivityCoalescerSink,
    private readonly windowMs: number = ACTIVITY_COALESCE_WINDOW_MS,
  ) {}

  /**
   * Route one batch of durable events for one session.
   *
   * Coalescible records join the buffer; any other record is an ordering
   * barrier that materializes the buffer first. A previous failed flush stays
   * fail-closed: nothing is retried and the original error is rethrown.
   * @param sessionId - DSH session owning the history.
   * @param events - Durable events in publish order.
   */
  append(sessionId: string, events: readonly CursorAgentActivityEvent[]): void {
    let buffer = this.sessions.get(sessionId)
    for (const event of events) {
      if (buffer?.deferred !== undefined) throw buffer.deferred
      if (!isCoalescible(event)) {
        // Every non-coalescible record is an ordering barrier, including the
        // session-ready record that opens the next native epoch.
        if (buffer !== undefined && buffer.queue.length > 0) this.flush(sessionId)
        this.sink.append(sessionId, [event])
        continue
      }
      buffer ??= this.open(sessionId)
      if (buffer.queue.length >= ACTIVITY_MAX_PENDING_RECORDS) this.flush(sessionId)
      const bounded = event.type === CURSOR_AGENT_TEXT
        ? this.bufferText(buffer, event.data)
        : this.bufferToolUpdate(buffer, event.data as CursorAgentToolUpdateData)
      // A boundary or skip-count flush writes the record just buffered, so the
      // appended content is already durable and still in emitted order.
      if (bounded) this.flush(sessionId)
      else this.schedule(sessionId, buffer)
    }
  }

  /**
   * Write every buffered record for one session now.
   * @param sessionId - DSH session whose buffer must materialize.
   */
  flush(sessionId: string): void {
    const buffer = this.sessions.get(sessionId)
    if (buffer === undefined || buffer.queue.length === 0) return
    const batch = buffer.queue
    buffer.queue = []
    try {
      // Drop the timer first: a throwing sink must not leave a live timer that
      // re-enters the same failed batch.
      buffer.deferred = undefined
      this.clearTimer(buffer)
      this.sink.append(sessionId, batch.map(toEvent))
    } catch (error) {
      buffer.deferred = error instanceof Error ? error : new Error('CursorAgent activity flush failed')
      throw buffer.deferred
    }
  }

  /** Flush every session; used before adapter teardown.
   * @returns The ids that had buffered records, for diagnostics.
   */
  flushAll(): readonly string[] {
    const flushed: string[] = []
    for (const [sessionId, buffer] of [...this.sessions]) {
      if (buffer.queue.length === 0 && buffer.deferred === undefined) continue
      this.flush(sessionId)
      flushed.push(sessionId)
    }
    return flushed
  }

  /**
   * Flush one session and drop its buffer; called when the session is disposed.
   * A pending flush failure is reported, then the buffer is dropped either way.
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

  /** Flush every session and drop all buffers; called on adapter reset. */
  reset(): void {
    try {
      this.flushAll()
    } finally {
      for (const buffer of this.sessions.values()) this.clearTimer(buffer)
      this.sessions.clear()
    }
  }

  /** Buffered record count for one session, for tests and diagnostics. */
  pendingCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.queue.length ?? 0
  }

  private open(sessionId: string): SessionBuffer {
    const buffer: SessionBuffer = { queue: [], timer: undefined, deferred: undefined }
    this.sessions.set(sessionId, buffer)
    return buffer
  }

  /** Merge one delta into the pending tail.
   * @param buffer - Session buffer that owns the queue tail.
   * @param data - Decoded native text delta.
   * @returns Whether the merged text reached a paragraph or closed code block.
   */
  private bufferText(buffer: SessionBuffer, data: CursorAgentAgentTextData): boolean {
    const key = textKey(data)
    // Only the queue tail may merge: a record emitted between two deltas must
    // stay between them, or the fold would concatenate across it.
    const last = buffer.queue.at(-1)
    const pending = last?.kind === 'text' && last.key === key ? last : undefined
    if (pending !== undefined && pending.data.text.length + data.text.length <= ACTIVITY_MAX_TEXT_CHARS) {
      pending.data.text += data.text
      return atTextBoundary(pending.data.text)
    }
    buffer.queue.push({ kind: 'text', key, data: { ...data } })
    return atTextBoundary(data.text)
  }

  /** Merge one tool update into the pending tail.
   * @param buffer - Session buffer that owns the queue tail.
   * @param data - Decoded native tool update.
   * @returns Whether the row hit its skip-count flush and must be written now.
   */
  private bufferToolUpdate(buffer: SessionBuffer, data: CursorAgentToolUpdateData): boolean {
    // Same tail rule: a tool update may only fold into the row's own latest
    // record while nothing else was emitted after it.
    const last = buffer.queue.at(-1)
    const pending = last?.kind === 'tool' && last.toolId === data.toolId ? last : undefined
    if (pending !== undefined && toolMergeable(pending, data)) {
      buffer.queue[buffer.queue.length - 1] = mergeToolUpdate(pending, data)
      return false
    }
    if (pending !== undefined
      && (data.output ?? '').length <= pending.base
      && (data.output ?? '').startsWith(tailOutput(pending))
      && repeatsPendingRow(pending.data, data)) {
      // A repaint that repeats the row is not written again: the record stands as
      // it is, so a field this update omits cannot be erased from the durable row.
      // A redraw that changes the value or the row still materializes a record.
      pending.skipped += 1
      return pending.skipped >= ACTIVITY_TOOL_SKIP_FLUSH
    }
    buffer.queue.push({ kind: 'tool', toolId: data.toolId, data: { ...data }, base: data.output?.length ?? 0, skipped: 0 })
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
