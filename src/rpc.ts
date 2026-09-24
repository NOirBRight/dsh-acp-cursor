/** Host RPC for the External Agents settings page. */
import { clientRequestSchema, type ConnectionRpcAttachment, type HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  ACTIVITY_BINDING_ENDPOINT,
  ACTIVITY_ENDPOINT,
  ACTIVITY_READ_AFTER_ENDPOINT,
  ACTIVITY_STALE_CURSOR,
  ActivityCursorStaleError,
  decodeActivityPageRequest,
  decodeActivitySessionId,
  nativeSessionBinding,
  type CursorAgentActivityHistory,
  type CursorAgentActivityPage,
} from './activity-contract.js'
import {
  CURSOR_PLUGIN_RPC_ENDPOINT,
  PICK_ENDPOINT,
  QUOTA_ENDPOINT,
  RUN_ENDPOINT,
  SAVE_ENDPOINT,
  CATALOG_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  decodeConfig,
  type AcpCursorAgentSettingsConfig,
  type AcpSettingsSnapshot,
  type CursorAgentQuotaSnapshot,
} from './client-contract.js'

type RpcResult = { readonly ok: true; readonly value: unknown; readonly attachments?: readonly ConnectionRpcAttachment[] } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details?: object } }

type SettingsRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal, operator: HostConnectionHandle['operator']) => Promise<RpcResult>

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function responseFor(rpcId: string, result: RpcResult): Response {
  const resultEnvelope = result.ok
    ? { ok: true as const, value: result.value }
    : { ok: false as const, error: { ...result.error, details: result.error.details ?? {} } }
  const envelope = { type: 'server-response' as const, rpcId, result: resultEnvelope }
  if (!result.ok || result.attachments === undefined || result.attachments.length === 0) return Response.json(envelope)

  const parts = new FormData()
  const attachments = result.attachments.map((attachment, index) => {
    const part = `bytes-${index}`
    parts.set(part, new Blob([new Uint8Array(attachment.bytes)]))
    return { path: [...attachment.path], codec: 'bytes', part }
  })
  parts.set('metadata', JSON.stringify({ ...envelope, attachments }))
  return new Response(parts)
}


function fail(message: string): RpcResult {
  return { ok: false, error: { code: 'internal', message } }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function activityError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith('CursorAgent activity history') ? message : 'CursorAgent activity history is unavailable'
}

/** Live Settings operations owned by the host plugin. */
export interface AcpSettingsRpcDeps {
  snapshot(): Promise<AcpSettingsSnapshot>
  catalog(): Promise<{ groups: readonly { id: string; name: string; models: readonly { id: string; name: string; reasoning?: { efforts: readonly { id: string; name: string }[]; defaultEffort: string } }[] }[] }>
  quota(signal?: AbortSignal): Promise<CursorAgentQuotaSnapshot>
  readActivity(sessionId: string): CursorAgentActivityHistory
  readActivityAfter(sessionId: string, afterSeq: number): CursorAgentActivityPage
  applyConfig(config: AcpCursorAgentSettingsConfig): Promise<void>
  run(action: string, value?: unknown, signal?: AbortSignal): Promise<unknown>
}

/** Handle snapshot, save, provider actions, and executable picking. */
export function createAcpSettingsRpcHandler(deps: AcpSettingsRpcDeps): SettingsRpcHandler {
  return async (endpoint, payload, signal, _operator) => {
    if (endpoint === SNAPSHOT_ENDPOINT) return { ok: true, value: await deps.snapshot() }
    if (endpoint === CATALOG_ENDPOINT) return { ok: true, value: await deps.catalog() }
    if (endpoint === QUOTA_ENDPOINT) {
      try {
        return { ok: true, value: await deps.quota(signal) }
      } catch (error) {
        return fail(errorText(error))
      }
    }
    if (endpoint === ACTIVITY_ENDPOINT || endpoint === ACTIVITY_BINDING_ENDPOINT) {
      const sessionId = decodeActivitySessionId(payload)
      if (sessionId === undefined) return fail('invalid CursorAgent activity request')
      try {
        const history = await deps.readActivity(sessionId)
        if (endpoint === ACTIVITY_BINDING_ENDPOINT) {
          const bound = nativeSessionBinding(history, sessionId) !== undefined
          return { ok: true, value: { provider: bound ? 'cursor-agent' : null } }
        }
        return { ok: true, value: history }
      } catch (error) {
        return fail(activityError(error))
      }
    }
    if (endpoint === ACTIVITY_READ_AFTER_ENDPOINT) {
      const request = decodeActivityPageRequest(payload)
      if (request === undefined) return fail('invalid CursorAgent activity request')
      try {
        return { ok: true, value: await deps.readActivityAfter(request.sessionId, request.afterSeq) }
      } catch (error) {
        if (error instanceof ActivityCursorStaleError) return { ok: false, error: { code: ACTIVITY_STALE_CURSOR, message: 'CursorAgent activity cursor is stale; the history must be reloaded.' } }
        return fail(activityError(error))
      }
    }
    if (endpoint === SAVE_ENDPOINT) {
      const decoded = decodeConfig(payload)
      if (decoded === undefined) return fail('invalid CursorAgent settings')
      try {
        await deps.applyConfig(decoded)
        return { ok: true, value: { saved: true } }
      } catch (error) {
        return fail('CursorAgent settings were not applied: ' + errorText(error))
      }
    }
    if (endpoint === RUN_ENDPOINT) {
      if (payload === null || typeof payload !== 'object' || typeof (payload as { action?: unknown }).action !== 'string') return fail('CursorAgent settings action is missing')
      try {
        const value = await deps.run((payload as { action: string; value?: unknown }).action, (payload as { value?: unknown }).value, signal)
        return { ok: true, value: value ?? { ok: true } }
      } catch (error) {
        return fail(errorText(error))
      }
    }
    if (endpoint === PICK_ENDPOINT) {
      try {
        const { stdout } = await promisify(execFile)('zenity', ['--file-selection', '--title=Select executable'], { encoding: 'utf8', timeout: 120_000 })
        const path = stdout.trim()
        return { ok: true, value: { path: path.length > 0 ? path : null } }
      } catch {
        return { ok: true, value: { path: null } }
      }
    }
    return fail('unknown CursorAgent settings endpoint: ' + endpoint)
  }
}

/** Register the exact authenticated Fetch route and attach its disposer to this fiber. */
export function registerAcpSettingsRpc(ctx: { effect(fn: () => unknown, name?: string): void; connection: Pick<HostConnectionHandle, 'fetch' | 'operator'> }, deps: AcpSettingsRpcDeps): void {
  const handler = createAcpSettingsRpcHandler(deps)
  ctx.effect(
    () => ctx.connection.fetch.register({
      path: '/api/plugin-rpc/cursor',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async request => {
        const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
        if (contentType !== 'application/json') return new Response(null, { status: 415 })
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return new Response(null, { status: 400 })
        }
        const parsed = clientRequestSchema.safeParse(body)
        const wrapper = parsed.success ? record(parsed.data.payload) : undefined
        if (!parsed.success || parsed.data.method !== CURSOR_PLUGIN_RPC_ENDPOINT
          || wrapper === undefined || typeof wrapper.endpoint !== 'string') {
          return new Response(null, { status: 400 })
        }
        try {
          const result = await handler(wrapper.endpoint, wrapper.payload, request.signal, ctx.connection.operator)
          return responseFor(parsed.data.rpcId, result)
        } catch {
          return new Response(null, { status: 500 })
        }
      },
    }),
    'dsh-acp-cursor: settings RPC',
  )
}
