/** Append-only per-session history for CursorAgent native tool activity. */
import { ExternalAgentActivityCursorAheadError, ExternalAgentActivityStore, type ExternalAgentActivityPage } from '@deepseek-ai/dsh-acp-provider/activity-store'
import {
  ACTIVITY_PAGE_RECORD_LIMIT,
  ACTIVITY_SCHEMA_VERSION,
  ActivityCursorStaleError,
  decodeActivityRecord,
  type CursorAgentActivityHistory,
  type CursorAgentActivityPage,
  type CursorAgentActivityRecord,
  type CursorAgentFullAccessEvent,
} from './activity-contract.js'
import type { CursorAgentSessionReadyEvent, CursorAgentToolEvent } from './tool-events.js'
import { CursorAgentActivityMetrics, nowMs } from './activity-metrics.js'

export { ACTIVITY_SCHEMA_VERSION } from './activity-contract.js'
export type { CursorAgentActivityHistory, CursorAgentActivityRecord } from './activity-contract.js'

/** Events the store persists: session readiness plus tool start/update rows. */
export type CursorAgentActivityEvent = CursorAgentSessionReadyEvent | CursorAgentToolEvent | CursorAgentFullAccessEvent

/** Minimal durable store independent of runtime and auth directories. */
export class CursorAgentActivityStore extends ExternalAgentActivityStore<CursorAgentActivityEvent, CursorAgentActivityRecord> {
  /** Capture the history root; directories are created lazily on append.
   * @param rootDirectory - Explicit history root, e.g. home/plugin-data/cursor-agent/history.
   * @param metrics - Optional value-free counters; omit to skip measurement entirely.
   */
  constructor(rootDirectory: string, private readonly metrics?: CursorAgentActivityMetrics) {
    super({ rootDirectory, schemaVersion: ACTIVITY_SCHEMA_VERSION, decodeRecord: decodeActivityRecord })
  }

  /** Append through the base store, counting the batch and its write latency.
   * @param sessionId - DSH session owning the history.
   * @param events - Durable typed events.
   */
  override append(sessionId: string, events: readonly CursorAgentActivityEvent[]): void {
    const started = nowMs()
    try {
      super.append(sessionId, events)
    } finally {
      this.metrics?.recordAppend(events.length, nowMs() - started)
    }
  }

  /** Read the full validating history, counting it as the one O(history) read.
   * The first append for a session also lands here, which is exactly the
   * one-time cursor initialization the counters should show.
   * @param sessionId - Required session id.
   * @returns The schema version plus validated records.
   */
  override read(sessionId: string): CursorAgentActivityHistory {
    this.metrics?.recordFullRead()
    return super.read(sessionId)
  }

  /** Read one bounded page strictly after an exclusive cursor, validating from that base sequence.
   * Delegates to the provider's `readAfter`, so only the returned records are decoded and the
   * already-seen prefix is never rescanned into memory. A cursor past an existing history and a
   * cursor whose history was deleted both surface as {@link ActivityCursorStaleError}, so a client
   * resynchronizes instead of treating an empty page as caught up; `afterSeq` 0 keeps returning an
   * ordinary empty page, because nothing was being followed yet.
   * @param sessionId - Required session id.
   * @param afterSeq - Exclusive cursor; 0 starts at the first record.
   * @returns Ordered records, the cursor to pass next, and whether more remain.
   * @throws ActivityCursorStaleError - When the history cannot satisfy the cursor.
   */
  readActivityPage(sessionId: string, afterSeq: number): CursorAgentActivityPage {
    const started = nowMs()
    let page: ExternalAgentActivityPage<CursorAgentActivityRecord>
    try {
      page = this.readAfter(sessionId, afterSeq, ACTIVITY_PAGE_RECORD_LIMIT)
    } catch (error) {
      const stale = cursorAhead(error)
      // A refused cursor is what makes a client resynchronize, so count it here
      // rather than where the wire error code is minted.
      if (stale !== undefined) this.metrics?.recordStaleCursor()
      throw stale ?? error
    }
    if (afterSeq > 0 && page.historyMissing === true) {
      // The history file is gone, so this empty page would read as caught up and the
      // client would never resynchronize. The store boundary refuses the cursor
      // instead of widening the DSH page DTO with a provider-only field.
      this.metrics?.recordStaleCursor()
      throw new ActivityCursorStaleError(afterSeq, 0)
    }
    this.metrics?.recordPage(page.records.length, nowMs() - started)
    return { version: ACTIVITY_SCHEMA_VERSION, records: page.records, nextCursor: page.nextCursor, hasMore: page.hasMore }
  }
}

/** Normalize the provider's typed ahead-of-history failure into the shared stale-cursor error.
 * The exported class covers the normal case; the stable `kind` plus the numeric fields cover a
 * provider copy loaded from another module realm, where `instanceof` cannot match across classes.
 * @param error - Whatever `readAfter` threw.
 * @returns The stale-cursor error to surface, or undefined for any other failure.
 */
function cursorAhead(error: unknown): ActivityCursorStaleError | undefined {
  if (error instanceof ExternalAgentActivityCursorAheadError) return new ActivityCursorStaleError(error.afterSeq, error.historyLength)
  if (!(error instanceof Error) || Reflect.get(error, 'kind') !== 'cursor-ahead') return undefined
  const afterSeq = Reflect.get(error, 'afterSeq')
  const historyLength = Reflect.get(error, 'historyLength')
  if (!isSequence(afterSeq) || !isSequence(historyLength)) return undefined
  return new ActivityCursorStaleError(afterSeq, historyLength)
}

/** True for a record count or cursor: a non-negative safe integer. */
function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
