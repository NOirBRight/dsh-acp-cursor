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

/** Provider cursor read, resolved structurally because the release carrying it may not be installed yet. */
type ProviderCursorRead = (sessionId: string, afterSeq: number, limit: number) => Omit<CursorAgentActivityPage, 'version'>

/** Minimal durable store independent of runtime and auth directories. */
export class CursorAgentActivityStore extends ExternalAgentActivityStore<CursorAgentActivityEvent, CursorAgentActivityRecord> {
  /** Capture the history root; directories are created lazily on append.
   * @param rootDirectory - Explicit history root, e.g. home/plugin-data/cursor-agent/history.
   */
  constructor(rootDirectory: string) {
    super({ rootDirectory, schemaVersion: ACTIVITY_SCHEMA_VERSION, decodeRecord: decodeActivityRecord })
  }

  /** Read one bounded page strictly after an exclusive cursor, validating from that base sequence.
   * The provider release that owns the cursor read is resolved on the base prototype, so the pinned
   * tarball keeps working: until that release is consumed, one validated full read is sliced here
   * instead, which bounds the payload but not the host-side scan.
   * @param sessionId - Required session id.
   * @param afterSeq - Exclusive cursor; 0 starts at the first record.
   * @returns Ordered records, the cursor to pass next, and whether more remain.
   */
  readActivityPage(sessionId: string, afterSeq: number): CursorAgentActivityPage {
    const cursorRead = Reflect.get(ExternalAgentActivityStore.prototype, 'readAfter') as ProviderCursorRead | undefined
    if (cursorRead !== undefined) {
      try {
        const page = cursorRead.call(this, sessionId, afterSeq, ACTIVITY_PAGE_RECORD_LIMIT)
        return { version: ACTIVITY_SCHEMA_VERSION, records: page.records, nextCursor: page.nextCursor, hasMore: page.hasMore }
      } catch (error) {
        throw cursorAhead(error, afterSeq) ?? error
      }
    }
    // ponytail: pinned provider release has no cursor read; one full validated read is sliced here.
    // Delete this branch (and the reflective lookup) once the dependency bump lands.
    const history = this.read(sessionId)
    if (afterSeq > history.records.length) throw new ActivityCursorStaleError(afterSeq, history.records.length)
    const records = history.records.slice(afterSeq, afterSeq + ACTIVITY_PAGE_RECORD_LIMIT)
    return {
      version: ACTIVITY_SCHEMA_VERSION,
      records,
      nextCursor: records.at(-1)?.seq ?? afterSeq,
      hasMore: history.records.length > afterSeq + records.length,
    }
  }
}

/** Normalize the provider's plain ahead-of-history failure into the shared stale-cursor error. */
function cursorAhead(error: unknown, afterSeq: number): ActivityCursorStaleError | undefined {
  if (!(error instanceof Error)) return undefined
  const match = /^External agent activity cursor \d+ is ahead of the (\d+)-record history$/.exec(error.message)
  return match === null ? undefined : new ActivityCursorStaleError(afterSeq, Number(match[1]))
}
