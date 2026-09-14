/** Browser-safe activity DTOs, endpoints, and decoders shared by the store and the settings RPC. */
import * as AcpProvider from '@deepseek-ai/dsh-acp-provider'
import { providerId, sessionId, type ExternalAgentSessionRef, type ExternalAgentFullAccessAudit } from '@deepseek-ai/dsh-acp-provider'
import { isRecord, stringValue } from './decode.js'
import { decodeRequestTelemetry, decodeUsageSnapshots, type NativeRequestTelemetry, type NativeUsageSnapshots } from './request-telemetry.js'
import {
  CURSOR_AGENT_REQUEST_TELEMETRY,
  CURSOR_AGENT_USAGE_SNAPSHOTS,
  CURSOR_AGENT_OBSERVED,
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_USER_QUESTION_ANSWER,
  CURSOR_AGENT_SESSION_READY,
  CURSOR_AGENT_TOOL_START,
  CURSOR_AGENT_TOOL_UPDATE,
  type CursorAgentAgentTextData,
  type CursorAgentUserQuestionAnswerData,
  type CursorAgentSessionReadyData,
  type CursorAgentToolLocation,
  isToolOwnership,
  type CursorAgentToolOwnership,
  type CursorAgentToolStartData,
  type CursorAgentToolUpdateData,
} from './tool-events.js'

/** Settings-channel endpoint returning one session history. */
export const ACTIVITY_ENDPOINT = 'activity/read'

/** Settings-channel endpoint returning the native binding for one session. */
export const ACTIVITY_BINDING_ENDPOINT = 'activity/binding'

/** Schema version written on every history line and returned by reads. */
export const ACTIVITY_SCHEMA_VERSION = 1

/** Value-free authorization recorded before native full-access execution. */
export const CURSOR_AGENT_FULL_ACCESS_AUTHORIZED = 'cursor-agent/full-access-authorized' as const
export type CursorAgentFullAccessEvent = { readonly type: typeof CURSOR_AGENT_FULL_ACCESS_AUTHORIZED; readonly data: ExternalAgentFullAccessAudit }

/** One persisted history line with replay order and wall-clock time. */
export type CursorAgentActivityRecord =
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_USAGE_SNAPSHOTS; readonly data: NativeUsageSnapshots }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_REQUEST_TELEMETRY; readonly data: NativeRequestTelemetry }
  | ({ readonly seq: number; readonly time: string } & CursorAgentFullAccessEvent)
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_SESSION_READY; readonly data: CursorAgentSessionReadyData }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_TOOL_START; readonly data: CursorAgentToolStartData }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_TOOL_UPDATE; readonly data: CursorAgentToolUpdateData }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_OBSERVED; readonly data: CursorAgentToolOwnership }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_TEXT; readonly data: CursorAgentAgentTextData }
  | { readonly seq: number; readonly time: string; readonly type: typeof CURSOR_AGENT_USER_QUESTION_ANSWER; readonly data: CursorAgentUserQuestionAnswerData }

/** History snapshot: schema version plus records in seq order. */
export interface CursorAgentActivityHistory {
  readonly version: number
  readonly records: readonly CursorAgentActivityRecord[]
}

/** Read the latest native binding; legacy ready-only histories intentionally have no cursor.
 * @param history - Validated sidecar history.
 * @param id - DSH conversation owning the history.
 * @returns Its native reference, or undefined for a conversation never opened natively.
 */
export function nativeSessionBinding(history: CursorAgentActivityHistory, id: string): ExternalAgentSessionRef | undefined {
  const shared = Reflect.get(AcpProvider, 'latestNativeSessionBinding')
  if (typeof shared === 'function') return (shared as LatestNativeSessionBinding)(history.records, id, CURSOR_AGENT_SESSION_READY, 'cursor-agent')
  for (let index = history.records.length - 1; index >= 0; index--) {
    const record = history.records[index]
    if (record?.type !== CURSOR_AGENT_SESSION_READY) continue
    const ref = record.data.ref
    if (ref === undefined) return { provider: providerId('cursor-agent'), session: sessionId(id) }
    if (ref.session !== id) throw corrupt('native binding belongs to another DSH session')
    return ref
  }
  return undefined
}

type LatestNativeSessionBinding = (
  records: readonly { readonly type: string; readonly data: unknown }[],
  boundSession: string,
  readyType: string,
  fallbackProvider: string,
) => ExternalAgentSessionRef | undefined

/** Native binding for one session: the provider when a ready record exists, else null. */
export interface CursorAgentActivityBinding {
  readonly provider: 'cursor-agent' | null
}

/** Decode a strict activity wire payload to its session id.
 * @param value - Wire payload, exactly { sessionId } with a non-empty id.
 * @returns The session id, or undefined for any other shape.
 */
export function decodeActivitySessionId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'sessionId') return undefined
  const sessionId = value.sessionId
  return typeof sessionId === 'string' && sessionId.trim() !== '' ? sessionId : undefined
}

/** Decode one history record.
 * @param line - One raw JSONL history line.
 * @param seq - Expected 1-based position; records must stay contiguous.
 * @returns The validated record.
 */
export function decodeActivityRecord(line: string, seq: number): CursorAgentActivityRecord {
  let value: unknown
  try {
    value = JSON.parse(line) as unknown
  } catch {
    throw corrupt('line ' + String(seq) + ' is not JSON')
  }
  return decodeRecordValue(value, seq)
}

/** Decode a history snapshot, throwing on any invalid version or record.
 * @param value - Wire snapshot claiming { version, records }.
 * @returns The validated history.
 */
export function decodeActivityHistory(value: unknown): CursorAgentActivityHistory {
  if (!isRecord(value)) throw corrupt('history is not an object')
  if (value.version !== ACTIVITY_SCHEMA_VERSION) throw corrupt('history has an unknown version')
  if (!Array.isArray(value.records)) throw corrupt('history has invalid records')
  return { version: ACTIVITY_SCHEMA_VERSION, records: value.records.map((record, index) => decodeRecordValue(withVersion(record, index + 1), index + 1)) }
}

function withVersion(record: unknown, seq: number): Record<string, unknown> {
  if (!isRecord(record)) throw corrupt('line ' + String(seq) + ' is not an object')
  return { ...record, v: ACTIVITY_SCHEMA_VERSION }
}

function corrupt(reason: string): Error {
  return new Error('CursorAgent activity history is corrupt: ' + reason)
}

function decodeRecordValue(value: unknown, seq: number): CursorAgentActivityRecord {
  if (!isRecord(value)) throw corrupt('line ' + String(seq) + ' is not an object')
  if (value.v !== ACTIVITY_SCHEMA_VERSION) throw corrupt('line ' + String(seq) + ' has an unknown version')
  if (value.seq !== seq) throw corrupt('line ' + String(seq) + ' breaks the sequence')
  const time = value.time
  if (typeof time !== 'string' || Number.isNaN(Date.parse(time))) throw corrupt('line ' + String(seq) + ' has an invalid time')
  const type = value.type
  if (type === CURSOR_AGENT_USAGE_SNAPSHOTS) {
    const data = decodeUsageSnapshots(value.data)
    if (data !== undefined) return { seq, time, type, data }
  }
  if (type === CURSOR_AGENT_REQUEST_TELEMETRY) {
    const data = decodeRequestTelemetry(value.data)
    if (data !== undefined) return { seq, time, type, data }
  }
  if (type === CURSOR_AGENT_FULL_ACCESS_AUTHORIZED && isRecord(value.data) && stringValue(value.data.provider) !== undefined && stringValue(value.data.session) !== undefined && value.data.mode === 'full-access' && (value.data.auditId === undefined || stringValue(value.data.auditId) !== undefined)) return { seq, time, type, data: value.data as unknown as ExternalAgentFullAccessAudit }
  if (type === CURSOR_AGENT_SESSION_READY && isSessionReadyData(value.data)) return { seq, time, type, data: value.data }
  if (type === CURSOR_AGENT_TOOL_START && isToolStartData(value.data)) return { seq, time, type, data: value.data }
  if (type === CURSOR_AGENT_TOOL_UPDATE && isToolUpdateData(value.data)) return { seq, time, type, data: value.data }
  if (type === CURSOR_AGENT_OBSERVED && isToolOwnership(value.data)) return { seq, time, type, data: value.data }
  if (type === CURSOR_AGENT_TEXT && isAgentTextData(value.data)) return { seq, time, type, data: value.data }
  if (type === CURSOR_AGENT_USER_QUESTION_ANSWER && isUserQuestionAnswerData(value.data)) return { seq, time, type, data: value.data }
  throw corrupt('line ' + String(seq) + ' has an unknown type or data')
}

function isUserQuestionAnswerData(value: unknown): value is CursorAgentUserQuestionAnswerData {
  if (!isRecord(value) || stringValue(value.requestId) === undefined || typeof value.question !== 'string') return false
  if (!Array.isArray(value.selected) || value.selected.some(item => typeof item !== 'string')) return false
  return value.custom === undefined || typeof value.custom === 'string'
}

function isAgentTextData(value: unknown): value is CursorAgentAgentTextData {
  if (!isRecord(value) || stringValue(value.trajectoryId) === undefined) return false
  if (value.parentTrajectoryId !== undefined && stringValue(value.parentTrajectoryId) === undefined) return false
  if (value.kind !== 'text' && value.kind !== 'thought') return false
  return typeof value.text === 'string' && value.text.length > 0
}

function isSessionReadyData(value: unknown): value is CursorAgentSessionReadyData {
  if (!isRecord(value) || value.provider !== 'cursor-agent') return false
  if (value.ref === undefined) return true
  const ref = value.ref
  if (!isRecord(ref) || ref.provider !== value.provider || stringValue(ref.provider) === undefined || stringValue(ref.session) === undefined || (ref.nativeSession !== undefined && stringValue(ref.nativeSession) === undefined)) return false
  const cursor = ref.resumeCursor
  return cursor === undefined || (isRecord(cursor) && cursor.provider === ref.provider && stringValue(cursor.value) !== undefined)
}

function isToolStatus(value: unknown): value is CursorAgentToolStartData['status'] {
  return value === 'pending' || value === 'running' || value === 'completed' || value === 'failed'
}

function isToolLocation(value: unknown): value is CursorAgentToolLocation {
  return isRecord(value) && stringValue(value.target) !== undefined && (value.kind === 'file' || value.kind === 'url')
}

function isToolStartData(value: unknown): value is CursorAgentToolStartData {
  if (!isRecord(value)) return false
  if (stringValue(value.toolId) === undefined || stringValue(value.name) === undefined) return false
  if (!isToolStatus(value.status)) return false
  if (value.input !== undefined && typeof value.input !== 'string') return false
  if (value.location !== undefined && !isToolLocation(value.location)) return false
  return value.ownership === undefined || isToolOwnership(value.ownership)
}

function isToolUpdateData(value: unknown): value is CursorAgentToolUpdateData {
  if (!isRecord(value)) return false
  if (stringValue(value.toolId) === undefined || !isToolStatus(value.status)) return false
  if (value.name !== undefined && stringValue(value.name) === undefined) return false
  if (value.input !== undefined && typeof value.input !== 'string') return false
  if (value.location !== undefined && !isToolLocation(value.location)) return false
  if (value.output !== undefined && typeof value.output !== 'string') return false
  if (value.error !== undefined && typeof value.error !== 'string') return false
  return value.ownership === undefined || isToolOwnership(value.ownership)
}
