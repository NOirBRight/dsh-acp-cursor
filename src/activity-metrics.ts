/** Value-free counters for the CursorAgent native activity pipeline.
 *
 * Every field is a count or a millisecond total, so a snapshot cannot carry a
 * session id, prompt, tool output, or credential: the shape is the redaction.
 * One instance belongs to one activity writer and is read by tests and
 * diagnostics; it is deliberately not an RPC endpoint, a user setting, or a
 * log stream, so instrumenting the hot path stays free of I/O and of any new
 * external contract.
 */

/** Flat counter snapshot: totals only, never a per-session breakdown. */
export interface CursorAgentActivityMetricsSnapshot {
  /** Durable append calls that reached the store. */
  readonly appendCalls: number
  /** Records handed to those appends. */
  readonly appendRecords: number
  readonly appendMsTotal: number
  readonly appendMsPeak: number
  /** Coalescer flush calls that wrote a non-empty batch. */
  readonly flushCalls: number
  readonly flushRecords: number
  readonly flushMsTotal: number
  readonly flushMsPeak: number
  /** Bounded incremental page reads. */
  readonly pageCalls: number
  readonly pageRecords: number
  readonly pageMsTotal: number
  /** Full validating history reads, the browser bootstrap and resynchronization read. */
  readonly fullReadCalls: number
  /** Cursor reads refused as ahead of the history, which makes a client resynchronize. */
  readonly staleCursorCalls: number
  /** Transient records merged into a pending record instead of written on arrival. */
  readonly coalescedRecords: number
  readonly failedFlushes: number
  /** Buffered records across all sessions right now. */
  readonly pendingRecords: number
  readonly pendingRecordsPeak: number
}

const ZERO: CursorAgentActivityMetricsSnapshot = {
  appendCalls: 0,
  appendRecords: 0,
  appendMsTotal: 0,
  appendMsPeak: 0,
  flushCalls: 0,
  flushRecords: 0,
  flushMsTotal: 0,
  flushMsPeak: 0,
  pageCalls: 0,
  pageRecords: 0,
  pageMsTotal: 0,
  fullReadCalls: 0,
  staleCursorCalls: 0,
  coalescedRecords: 0,
  failedFlushes: 0,
  pendingRecords: 0,
  pendingRecordsPeak: 0,
}

/** Monotonic milliseconds for one operation; the counters only ever store the difference. */
export function nowMs(): number {
  return performance.now()
}

/** Mutable counters; {@link snapshot} is the only read path.
 *
 * Not thread-safe by construction and not meant to be: the activity pipeline is
 * synchronous and single-owner per history root.
 */
export class CursorAgentActivityMetrics {
  private readonly counts: { -readonly [K in keyof CursorAgentActivityMetricsSnapshot]: number } = { ...ZERO }

  /** Record one durable append and the time it took.
   * @param records - Records in the batch.
   * @param ms - Elapsed milliseconds.
   */
  recordAppend(records: number, ms: number): void {
    this.counts.appendCalls += 1
    this.counts.appendRecords += records
    this.counts.appendMsTotal += ms
    if (ms > this.counts.appendMsPeak) this.counts.appendMsPeak = ms
  }

  /** Record one coalescer flush and the time it took.
   * @param records - Records written in the batch.
   * @param ms - Elapsed milliseconds.
   */
  recordFlush(records: number, ms: number): void {
    this.counts.flushCalls += 1
    this.counts.flushRecords += records
    this.counts.flushMsTotal += ms
    if (ms > this.counts.flushMsPeak) this.counts.flushMsPeak = ms
  }

  /** Record records that were merged instead of written on arrival.
   * @param records - Merged record count.
   */
  recordCoalesced(records: number): void {
    this.counts.coalescedRecords += records
  }

  /** Record a flush that failed and left its batch unwritten. */
  recordFlushFailure(): void {
    this.counts.failedFlushes += 1
  }

  /** Set the buffered-record gauge and track its peak.
   * @param records - Buffered records across all sessions.
   */
  recordPending(records: number): void {
    this.counts.pendingRecords = records
    if (records > this.counts.pendingRecordsPeak) this.counts.pendingRecordsPeak = records
  }

  /** Record one bounded incremental page read.
   * @param records - Records returned.
   * @param ms - Elapsed milliseconds.
   */
  recordPage(records: number, ms: number): void {
    this.counts.pageCalls += 1
    this.counts.pageRecords += records
    this.counts.pageMsTotal += ms
  }

  /** Record one full validating history read. */
  recordFullRead(): void {
    this.counts.fullReadCalls += 1
  }

  /** Record one cursor refused as ahead of the history. */
  recordStaleCursor(): void {
    this.counts.staleCursorCalls += 1
  }

  /** Copy the current counters; a snapshot never aliases live state.
   * @returns Flat totals, safe to log or assert on.
   */
  snapshot(): CursorAgentActivityMetricsSnapshot {
    return { ...this.counts }
  }

  /** Clear every counter and gauge, keeping the same instance. */
  reset(): void {
    Object.assign(this.counts, ZERO)
  }
}
