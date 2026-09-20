/** CursorAgent event adapter for the shared bounded activity coalescer. */
import {
  ActivityCoalescer,
  ACTIVITY_COALESCE_WINDOW_MS,
  ACTIVITY_MAX_PENDING_BYTES,
  ACTIVITY_MAX_PENDING_RECORDS,
  ACTIVITY_MAX_TEXT_CHARS,
  ACTIVITY_TOOL_SKIP_FLUSH,
  type ActivityCoalescerCodec,
  type ActivityCoalescerSink as SharedActivityCoalescerSink,
  type CoalescibleActivityRecord,
} from '@deepseek-ai/dsh-acp-provider/activity-coalescer'
import {
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_TOOL_UPDATE,
  type CursorAgentAgentTextData,
  type CursorAgentToolUpdateData,
} from './tool-events.js'
import type { CursorAgentActivityEvent } from './activity-store.js'

export {
  ACTIVITY_COALESCE_WINDOW_MS,
  ACTIVITY_MAX_PENDING_BYTES,
  ACTIVITY_MAX_PENDING_RECORDS,
  ACTIVITY_MAX_TEXT_CHARS,
  ACTIVITY_TOOL_SKIP_FLUSH,
}
export type ActivityCoalescerSink = SharedActivityCoalescerSink<CursorAgentActivityEvent>

const codec: ActivityCoalescerCodec<CursorAgentActivityEvent> = {
  decode: event => {
    if (event.type === CURSOR_AGENT_TEXT) {
      const { text, ...fields } = event.data
      return {
        kind: 'text',
        key: event.data.trajectoryId + '\u0000' + (event.data.parentTrajectoryId ?? '') + '\u0000' + event.data.kind + '\u0000' + (event.data.source ?? ''),
        fields,
        text,
      }
    }
    if (event.type !== CURSOR_AGENT_TOOL_UPDATE || event.data.status === 'completed' || event.data.status === 'failed') return undefined
    const { toolId, status, output, error, ...fields } = event.data
    return { kind: 'tool', toolId, status, fields, ...(output === undefined ? {} : { output }), ...(error === undefined ? {} : { error }) }
  },
  encode: (record: CoalescibleActivityRecord): CursorAgentActivityEvent => record.kind === 'text'
    ? { type: CURSOR_AGENT_TEXT, data: { ...record.fields, text: record.text } as CursorAgentAgentTextData }
    : { type: CURSOR_AGENT_TOOL_UPDATE, data: {
      toolId: record.toolId,
      status: record.status,
      ...record.fields,
      ...(record.output === undefined ? {} : { output: record.output }),
      ...(record.error === undefined ? {} : { error: record.error }),
    } as CursorAgentToolUpdateData },
}

/** Bounded writer retaining CursorAgent's public constructor and event types. */
export class CursorAgentActivityCoalescer extends ActivityCoalescer<CursorAgentActivityEvent> {
  constructor(sink: ActivityCoalescerSink, windowMs: number = ACTIVITY_COALESCE_WINDOW_MS) {
    super({ sink, codec, windowMs })
  }
}
