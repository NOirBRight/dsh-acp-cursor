/** No request telemetry on stock Cursor ACP. */

export type NativeRequestTelemetry = { readonly sessionKey: string; readonly promptId: string }
export type NativeUsageSnapshots = unknown
export type RequestThroughput = { readonly outputTokens: number; readonly elapsedMs: number; readonly requestCount: number }
export type CursorAgentUsageEvent = { readonly type: 'usage' }

export function decodeRequestTelemetry(_value: unknown): undefined {
  return undefined
}

export function decodeUsageSnapshots(_value: unknown): undefined {
  return undefined
}

export function requestThroughput(_value: unknown): undefined {
  return undefined
}

export function sdkUsage(_value: unknown): undefined {
  return undefined
}
