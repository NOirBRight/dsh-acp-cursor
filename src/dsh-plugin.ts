/** Cordis host plugin: External Agents Settings through settings.section RPC. */
import { ExternalAgentProviderRegistry, providerInstanceId } from '@deepseek-ai/dsh-acp-provider'
import { ExternalAgentSettingsEditorRegistry } from '@deepseek-ai/dsh-acp-provider/settings'
import { join } from 'node:path'
import type { AdapterRegistrationHandle } from '@deepseek-ai/dsh-llm'
import type { ActivityBindingHostContext } from './activity-binding.js'
import { CURSOR_AGENT_FULL_ACCESS_AUTHORIZED, nativeSessionBinding } from './activity-contract.js'
import { CursorAgentActivityStore, type CursorAgentActivityEvent } from './activity-store.js'
import type { AcpCursorAgentSettingsConfig, AcpSettingsRow, AcpSettingsSnapshot } from './client-contract.js'
import { deriveCursorAgentHarnessPath, validateCursorAgentInstallation } from './installation.js'

import { applyCatalogOverlay, pickerGroupsFromCursorCatalog } from './catalog.js'
import { createCursorAgentLlmBridge } from './llm-bridge.js'
import { installManagedCursorAgentRuntime, type ManagedInstallProgress } from './managed-install.js'
import { probeCursorAgentInstallation } from './probe.js'
import { installCursorAgentProvider, type InstalledCursorAgentProvider } from './plugin.js'
import { createCursorAgentQuotaReader, type CursorAgentQuotaReader } from './quota.js'
import { registerAcpSettingsRpc } from './rpc.js'
import { dshHome, loadPersistedConfig, loadPersistedModels, savePersistedConfig, savePersistedModels } from './store.js'
import type { CursorAgentAuthorizationRequest } from './types.js'
import { CURSOR_AGENT_SESSION_READY, type CursorAgentToolEvent } from './tool-events.js'

/** Loader-supplied Settings values. Empty paths stay on the page until the user locates them. */
export interface DshPluginConfig {
  readonly executablePath?: string
  readonly harnessPath?: string
  readonly stateDirectory?: string
  readonly instanceId?: string
  /** Deadline for native initialization, OAuth and model discovery; defaults to 30 seconds. */
  readonly modelDiscoveryTimeoutMs?: number
  readonly model?: string
  readonly enabled?: boolean
}

/** Host context used by the Settings RPC plugin. */
export interface DshPluginContext extends ActivityBindingHostContext {
  on: ActivityBindingHostContext['on'] & ((event: 'session/disposed', listener: (session: { readonly id: string }) => void | Promise<void>) => () => void)
  effect(fn: () => unknown, name?: string): void
  inject?(deps: string[], fn: (scope: { effect: (fn: () => unknown) => unknown; llm: { registerAdapter: (providers: string[], adapter: unknown) => AdapterRegistrationHandle }; connection: DshPluginContext['connection']; modelSwitch?: { adapters: { register: (entry: { provider: string; role: 'agent' }) => () => void } } }) => void): void
  get?(name: string): unknown
  connection: { rpc: { handle(channel: string, handler: (endpoint: string, payload: unknown, signal?: AbortSignal) => Promise<unknown>): unknown } }
}

export const name = 'dsh-acp-cursor'
export const inject = ['connection']

function defaultStateDirectory(): string {
  return join(dshHome(), 'profiles', 'web', 'cursor-agent')
}

function resolvePluginConfig(config: DshPluginConfig, persisted?: AcpCursorAgentSettingsConfig): AcpCursorAgentSettingsConfig {
  const merged = { ...config, ...persisted }
  const instanceId = (merged.instanceId ?? 'default').trim() || 'default'
  return {
    executablePath: merged.executablePath ?? '',
    harnessPath: merged.harnessPath ?? '',
    stateDirectory: (merged.stateDirectory ?? '').trim() || defaultStateDirectory(),
    instanceId,
    ...(merged.model === undefined || merged.model.trim() === '' ? {} : { model: merged.model.trim() }),
    ...(merged.modelDiscoveryTimeoutMs === undefined ? {} : { modelDiscoveryTimeoutMs: merged.modelDiscoveryTimeoutMs }),
    enabled: merged.enabled !== false,
    catalogOrder: merged.catalogOrder ?? [],
    ...(merged.catalogOverrides === undefined ? {} : { catalogOverrides: merged.catalogOverrides }),
  }
}

function agentFor(ctx: DshPluginContext, sessionId: string | undefined): unknown {
  if (sessionId === undefined) return undefined
  const agents = ctx.get?.('agents') as { get?: (id: string) => unknown } | undefined
  return agents?.get?.(sessionId)
}

/** File-effect policy modes shared with the sandbox-policy service (structural, no new dependency). */
type SandboxPolicyMode = 'read-only' | 'workspace-write' | 'danger-full-access'

/**
 * Resolve the authoritative sandbox policy for the exact session. A missing
 * service, unresolvable session, failed read, or unknown shape fails closed;
 * user and tool text never selects policy. No first-root fallback.
 */
function resolveSandboxPolicy(ctx: DshPluginContext, sessionId: string | undefined): { mode: SandboxPolicyMode; workspaceRoot: string } | undefined {
  const policy = ctx.get?.('sandboxPolicy') as { resolve?: (request?: { session?: unknown }) => { mode?: unknown; workspaceRoot?: unknown } } | undefined
  if (typeof policy?.resolve !== 'function') return undefined
  const agents = ctx.get?.('agents') as { get?: (id: string) => { session?: unknown } | undefined } | undefined
  const session = sessionId === undefined ? undefined : agents?.get?.(sessionId)?.session
  if (session === undefined) return undefined
  let resolved: { mode?: unknown; workspaceRoot?: unknown }
  try {
    resolved = policy.resolve({ session })
  } catch {
    // Unreadable sandbox policy fails closed to approval-required at the bridge.
    return undefined
  }
  if (resolved.mode !== 'read-only' && resolved.mode !== 'workspace-write' && resolved.mode !== 'danger-full-access') return undefined
  if (typeof resolved.workspaceRoot !== 'string' || resolved.workspaceRoot === '') return undefined
  return { mode: resolved.mode, workspaceRoot: resolved.workspaceRoot }
}

/** Closed approval outcome shared with the bridge (structural, no new dependency). */
export type NativeApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/** Native permission ask routed through the canonical approval service. */
export interface NativeApprovalInput {
  readonly sessionId: string | undefined
  readonly toolName: string
  readonly reason?: string
  readonly signal?: AbortSignal
}

/**
 * Ask the canonical approval service for one native permission. Routes the exact
 * session agent; the service enforces session policy and audits itself. Never
 * passes a native tool id as the Core call id. A missing service or session
 * cancels; a throwing service is unavailable. Generic ask is not consulted.
 */
export async function requestNativeApproval(ctx: DshPluginContext, input: NativeApprovalInput): Promise<NativeApprovalOutcome> {
  const service = ctx.get?.('approval') as { request?: (req: { agent: unknown; toolName: string; reason?: string; signal?: AbortSignal }) => Promise<NativeApprovalOutcome> } | undefined
  const agent = agentFor(ctx, input.sessionId)
  if (typeof service?.request !== 'function' || agent === undefined) return 'cancelled'
  try {
    return await service.request({
      agent,
      toolName: input.toolName,
      ...(input.reason === undefined || input.reason === '' ? {} : { reason: input.reason }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  } catch {
    // A throwing approval service cannot grant or deny; the bridge treats this as unavailable.
    return 'unavailable'
  }
}

function toProviderConfig(config: AcpCursorAgentSettingsConfig) {
  return {
    executablePath: config.executablePath,
    harnessPath: config.harnessPath,
    stateDirectory: config.stateDirectory,
    instanceId: providerInstanceId(config.instanceId),
    ...(config.modelDiscoveryTimeoutMs === undefined ? {} : { modelDiscoveryTimeoutMs: config.modelDiscoveryTimeoutMs }),
    ...(config.model === undefined ? {} : { model: config.model }),
  }
}

/** Mount the CursorAgent provider and the External Agents Settings RPC. */
export async function apply(ctx: DshPluginContext, config: DshPluginConfig = {}): Promise<void> {
  ctx.inject?.(['modelSwitch'], scope => {
    const runtime = scope.modelSwitch
    if (runtime !== undefined) scope.effect(() => runtime.adapters.register({ provider: 'cursor-agent', role: 'agent' }))
  })
  const home = dshHome()
  const activity = new CursorAgentActivityStore(join(home, 'plugin-data', 'cursor-agent', 'history'))
  const { installActivityBindingGuard } = await import('./activity-binding.js')
  installActivityBindingGuard(ctx, activity, sessionId => {
    const agent = agentFor(ctx, sessionId) as { session?: { snapshotEvents?: () => readonly { readonly type: string; readonly data?: unknown }[] } } | undefined
    return agent?.session?.snapshotEvents?.()
  })
  const appendActivity = (sessionId: string | undefined, events: readonly CursorAgentActivityEvent[]): void => {
    if (sessionId === undefined) throw new Error('Native activity requires an explicit DSH session id')
    try {
      activity.append(sessionId, events)
    } catch {
      throw new Error('Unable to persist CursorAgent activity; native execution stopped.')
    }
  }
  let live = resolvePluginConfig(config, loadPersistedConfig(home))
  let authorizationUrl: string | undefined
  let probeMessage: string | undefined
  let install: ManagedInstallProgress | undefined
  let installJob: Promise<void> | undefined
  let signingIn = false
  let signInJob: Promise<void> | undefined
  let signInAbort: AbortController | undefined
  const registry = new ExternalAgentProviderRegistry({
    auditFullAccess: entry => appendActivity(entry.session, [{ type: CURSOR_AGENT_FULL_ACCESS_AUTHORIZED, data: entry }]),
  })
  let bridge: ReturnType<typeof createCursorAgentLlmBridge> | undefined
  let changing = false
  const editors = new ExternalAgentSettingsEditorRegistry()
  let installed: InstalledCursorAgentProvider | undefined
  let models: { id: string; name: string }[] = loadPersistedModels(home)
  let registration: AdapterRegistrationHandle | undefined
  const publishModels = (next: readonly { id: string; name: string }[]): void => {
    models = [...next]
    savePersistedModels(home, models)
    registration?.replace(['cursor-agent'])
  }
  let quotaReader: CursorAgentQuotaReader = createCursorAgentQuotaReader(() => !changing && live.enabled && installed?.provider.health.status === 'ready')

  const mount = async (next: AcpCursorAgentSettingsConfig): Promise<void> => {
    if (changing) throw new Error('CursorAgent configuration is changing')
    changing = true
    const previous = installed
    installed = undefined
    try {
      await bridge?.reset()
      await previous?.dispose()
      models = loadPersistedModels(home)
      authorizationUrl = undefined
      live = next
      quotaReader.invalidate()
      quotaReader = createCursorAgentQuotaReader(() => !changing && live.enabled && installed?.provider.health.status === 'ready')
      installed = installCursorAgentProvider(
        { externalAgents: registry, settingsEditors: editors },
        toProviderConfig(next),
        { onAuthorizationUrl: (request: CursorAgentAuthorizationRequest) => {
          authorizationUrl = request.authorizationUrl
        } },
      )
      const provider = installed.provider
      void provider.validateInstallation().finally(() => { if (installed?.provider === provider) registration?.replace(['cursor-agent']) }).catch(() => undefined)
    } finally { changing = false }
  }

  const snapshot = async (): Promise<AcpSettingsSnapshot> => {
    const editor = installed === undefined ? undefined : editors.require(installed.provider.info.id, providerInstanceId(live.instanceId)).snapshot()
    const health = installed?.provider.health
    const row: AcpSettingsRow = {
      provider: String(installed?.provider.info.id ?? 'cursor-agent'),
      instanceId: live.instanceId,
      title: editor?.title ?? (live.instanceId === 'default' ? 'CursorAgent' : 'CursorAgent (' + live.instanceId + ')'),
      enabled: live.enabled,
      executablePath: live.executablePath,
      harnessPath: live.harnessPath,
      stateDirectory: live.stateDirectory,
      ...(live.model === undefined ? {} : { model: live.model }),
      ...(live.modelDiscoveryTimeoutMs === undefined ? {} : { modelDiscoveryTimeoutMs: live.modelDiscoveryTimeoutMs }),
      models: applyCatalogOverlay(pickerGroupsFromCursorCatalog(models), live.catalogOrder, live.catalogOverrides),
      installed: !('status' in await validateCursorAgentInstallation(toProviderConfig(live))),
      authenticated: editor?.status.authenticated ?? health?.status === 'ready',
      live: editor?.status.live ?? false,
      ready: editor?.status.ready ?? health?.status === 'ready',
      ...((): { message?: string } => {
        const managed = live.executablePath.trim() !== ''
        const message = editor?.status.message ?? health?.message ?? (managed ? undefined : probeMessage)
        return message === undefined ? {} : { message }
      })(),
      ...(health?.version === undefined ? {} : { version: health.version }),
      ...(health?.profileDirectory === undefined ? {} : { profileDirectory: health.profileDirectory }),
      ...(authorizationUrl === undefined ? {} : { authorizationUrl }),
      ...(installed?.provider.health.email === undefined ? {} : { accountEmail: installed.provider.health.email }),
      ...(health?.status === 'error' ? { probeFailed: true } : {}),
    }
    return {
      title: 'External Agents',
      rows: [row],
      ...(signingIn ? { signingIn: true as const } : {}),
      ...(install === undefined || install.phase === 'idle' ? {} : {
        install: {
          phase: install.phase,
          downloadedBytes: install.downloadedBytes ?? 0,
          totalBytes: install.totalBytes ?? 0,
          message: install.message ?? '',
        },
      }),
    }
  }

  await mount(live)
  void (async () => {
    try {
      if (installed === undefined) return
      const provider = installed.provider
      const listed = await provider.listModels()
      if (installed?.provider === provider && !changing) publishModels(listed.map(model => ({ id: String(model.id), name: model.name })))
    } catch {
      // Picker keeps the persisted catalog until a later refresh succeeds.
    }
  })()
  if (typeof ctx.inject === 'function') {
    ctx.inject(['llm'], (scope: { effect: (fn: () => unknown) => unknown; llm: { registerAdapter: (providers: string[], adapter: unknown) => AdapterRegistrationHandle } }) => {
      const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => changing || !live.enabled ? undefined : installed?.provider, getOverlay: () => ({ ...(live.catalogOrder === undefined ? {} : { order: live.catalogOrder }), ...(live.catalogOverrides === undefined ? {} : { overrides: live.catalogOverrides }) }) }, () => models, publishModels, {
        ask: async request => {
          const service = ctx.get?.('userQuestions') as { ask?: (payload: Record<string, unknown>) => Promise<{ answers: { id: string; selected: string[]; custom?: string }[] }> } | undefined
          if (service?.ask === undefined) return { answers: [] }
          const agent = agentFor(ctx, request.sessionId)
          const { sessionId: _ignored, ...rest } = request
          return service.ask({ ...rest, ...(agent === undefined ? {} : { agent }) })
        },
        appendSessionReady: (sessionId, ref) => { appendActivity(sessionId, [{ type: CURSOR_AGENT_SESSION_READY, data: { provider: 'cursor-agent', ref } }]) },
        loadSession: id => nativeSessionBinding(activity.read(id), id),
        appendToolEvents: (sessionId, events: readonly CursorAgentToolEvent[]) => { appendActivity(sessionId, events) },
        isPlanMode: sessionId => {
          const agent = agentFor(ctx, sessionId) as { session: unknown } | undefined
          const projections = ctx.get?.('sessionProjections') as { stateOf(session: unknown, key: 'plan'): { active: boolean } | undefined } | undefined
          return agent !== undefined && projections?.stateOf(agent.session, 'plan')?.active === true
        },
        resolvePolicy: sessionId => resolveSandboxPolicy(ctx, sessionId),
        requestApproval: input => requestNativeApproval(ctx, input),
      })
      bridge = adapter
      scope.effect(() => {
        const handle = scope.llm.registerAdapter(['cursor-agent'], adapter)
        registration = handle
        return async () => {
          if (registration === handle) registration = undefined
          handle()
          if (bridge === adapter) bridge = undefined
          await adapter.dispose()
        }
      })
    })
  }
  ctx.on('session/disposed', session => bridge?.release(session.id))
  const registerSettings = (scope: { effect: (fn: () => unknown, name?: string) => unknown; connection: DshPluginContext['connection'] }): void => { registerAcpSettingsRpc(scope, {
    snapshot,
    quota: async (signal) => quotaReader.snapshot(signal),
    readActivity: sessionId => activity.read(sessionId),
    readActivityAfter: (sessionId, afterSeq) => activity.readActivityPage(sessionId, afterSeq),
    catalog: async () => {
      if (installed === undefined) return { groups: [] }
      if ('status' in await validateCursorAgentInstallation(toProviderConfig(live))) return { groups: [] }
      if (models.length === 0) return { groups: [] }
      return { groups: [{ id: String(installed.provider.info.id), name: live.instanceId === 'default' ? 'Cursor' : 'Cursor (' + live.instanceId + ')', models: applyCatalogOverlay(pickerGroupsFromCursorCatalog(models), live.catalogOrder, live.catalogOverrides) }] }
    },
    applyConfig: async next => {
      const runtimeKeys = ['enabled', 'executablePath', 'harnessPath', 'stateDirectory', 'instanceId', 'model', 'modelDiscoveryTimeoutMs'] as const
      if (runtimeKeys.some(key => live[key] !== next[key])) await mount(next)
      else live = next
      savePersistedConfig(home, next)
      registration?.replace(['cursor-agent'])
    },
    run: async (action, value, signal) => {
      if (changing) throw new Error('CursorAgent configuration is changing')
      if (installed === undefined) throw new Error('CursorAgent provider is unavailable')
      const editor = editors.require(installed.provider.info.id, providerInstanceId(live.instanceId))
      if (action === 'refresh-status') {
        await installed.provider.validateInstallation()
        quotaReader.invalidate()
        return { refreshed: true }
      }
      if (action === 'refresh-models') {
        const listed = await installed.provider.listModels(signal)
        publishModels(listed.map(model => ({ id: String(model.id), name: model.name })))
        // Fetch overlay source: every collapsed native row, not the saved membership.
        return pickerGroupsFromCursorCatalog(models)
      }
      if (action === 'pick-harness-sibling' && typeof value === 'string') {
        return { path: deriveCursorAgentHarnessPath(value) }
      }
      if (action === 'open-login') {
        if (authorizationUrl === undefined) throw new Error('Cursor login URL is not available yet')
        return { url: authorizationUrl }
      }
      if (action === 'sign-in') {
        if (signInJob === undefined) {
          signingIn = true
          const provider = installed.provider
          signInAbort = new AbortController()
          signInJob = provider.signIn(signInAbort.signal).then(async () => {
            try { const listed = await provider.listModels(); if (installed?.provider === provider && !changing) publishModels(listed.map(model => ({ id: String(model.id), name: model.name }))) } catch { /* picker stays empty until a later catalog load */ }
          }).catch((error) => { if ((error instanceof DOMException || error instanceof Error) && error.name === 'AbortError') return; /* keep health from setFailureStatus */ }).finally(() => { signingIn = false; signInJob = undefined; signInAbort = undefined; quotaReader.invalidate() })
        }
        return { started: true }
      }
      if (action === 'install-runtime') {
        if (installJob === undefined) {
          installJob = (async () => {
            const result = await installManagedCursorAgentRuntime({
              onProgress: (progress: ManagedInstallProgress) => { install = progress },
            })
            install = result
            if (result.phase === 'succeeded' && result.executablePath !== undefined) {
              const next = { ...live, executablePath: result.executablePath, harnessPath: result.harnessPath ?? '' }
              await mount(next)
              savePersistedConfig(home, next)
            }
          })().catch((error) => { install = { phase: 'failed', message: error instanceof Error ? error.message : 'Cursor CLI install failed.' } }).finally(() => { installJob = undefined })
        }
        return install ?? { phase: 'downloading', downloadedBytes: 0, totalBytes: 0, message: 'Starting CursorAgent install.' }
      }
      if (action === 'probe-installation') {
        const found = await probeCursorAgentInstallation()
        probeMessage = found.message
        const empty = live.executablePath.trim() === ''
        if (empty && found.executablePath !== undefined) {
          const next = { ...live, executablePath: found.executablePath, harnessPath: found.harnessPath ?? '' }
          await mount(next)
          savePersistedConfig(home, next)
        }
        return found
      }
      // Sign-in is handled above with a coalesced provider.signIn job; only sign-out reaches the editor here.
      if (action === 'sign-out') {
        signInAbort?.abort()
        await signInJob
        changing = true
        quotaReader.invalidate()
        try {
          await bridge?.reset()
          const result = await editor.run(action, signal)
          registration?.replace(['cursor-agent'])
          authorizationUrl = undefined
          return result
        } finally {
          changing = false
          quotaReader.invalidate()
        }
      }
      if (action === 'cancel-login') {
        signInAbort?.abort()
        return { cancelled: true }
      }
      return editor.run(action, signal)
    },
  }) }
  if (typeof ctx.inject === 'function') ctx.inject(['connection'], registerSettings)
  else registerSettings(ctx)
  ctx.effect(() => async () => {
    changing = true
    quotaReader.invalidate()
    await bridge?.dispose()
    await installed?.dispose()
  }, 'dsh-acp-cursor: provider')
}
