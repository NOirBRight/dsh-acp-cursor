/** Append-only per-session history for CursorAgent native tool activity. */
import { ExternalAgentActivityStore } from '@deepseek-ai/dsh-acp-provider/activity-store'
import {
  ACTIVITY_SCHEMA_VERSION,
  decodeActivityRecord,
  type CursorAgentActivityHistory,
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
}
