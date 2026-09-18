/** Append-only per-session history for CursorAgent native tool activity. */
import { ExternalAgentActivityStore } from '@deepseek-ai/dsh-acp-provider/activity-store'
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

export { ACTIVITY_SCHEMA_VERSION } from './activity-contract.js'
export type { CursorAgentActivityHistory, CursorAgentActivityRecord } from './activity-contract.js'

/** Events the store persists: session readiness plus tool start/update rows. */
export type CursorAgentActivityEvent = CursorAgentSessionReadyEvent | CursorAgentToolEvent | CursorAgentFullAccessEvent

/** Minimal durable store independent of runtime and auth directories. */
export class CursorAgentActivityStore extends ExternalAgentActivityStore<CursorAgentActivityEvent, CursorAgentActivityRecord> {
  /** Capture the history root; directories are created lazily on append.
   * @param rootDirectory - Explicit history root, e.g. home/plugin-data/cursor-agent/history.
   */
  constructor(rootDirectory: string) {
    super({ rootDirectory, schemaVersion: ACTIVITY_SCHEMA_VERSION, decodeRecord: decodeActivityRecord })
  }

  /** Read one bounded page strictly after an exclusive cursor, validating from that base sequence.
   * Delegates to the provider's `readAfter`, so only the returned records are decoded and the
   * already-seen prefix is never rescanned into memory.
   * @param sessionId - Required session id.
   * @param afterSeq - Exclusive cursor; 0 starts at the first record.
   * @returns Ordered records, the cursor to pass next, and whether more remain.
   */
  readActivityPage(sessionId: string, afterSeq: number): CursorAgentActivityPage {
    try {
      const page = this.readAfter(sessionId, afterSeq, ACTIVITY_PAGE_RECORD_LIMIT)
      return { version: ACTIVITY_SCHEMA_VERSION, records: page.records, nextCursor: page.nextCursor, hasMore: page.hasMore }
    } catch (error) {
      throw cursorAhead(error, afterSeq) ?? error
    }
  }
}

/** Normalize the provider's plain ahead-of-history failure into the shared stale-cursor error. */
function cursorAhead(error: unknown, afterSeq: number): ActivityCursorStaleError | undefined {
  if (!(error instanceof Error)) return undefined
  const match = /^External agent activity cursor \d+ is ahead of the (\d+)-record history$/.exec(error.message)
  return match === null ? undefined : new ActivityCursorStaleError(afterSeq, Number(match[1]))
}
