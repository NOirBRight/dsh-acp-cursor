import {
  ManagedExternalAgentSession,
  consumeExternalAgentOpenAuthorization,
  providerId,
  type ExternalAgentFilesystem,
  type ExternalAgentModel,
  type ExternalAgentOpenRequest,
  type ExternalAgentProvider,
  type ExternalAgentSession,
} from '@deepseek-ai/dsh-acp-provider'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAbsolute } from 'node:path'
import { cursorAgentSessionScope, decodeCursorAgentCursor } from './native-ref.js'
import { cursorAgentSignInRequiredMessage, clearCursorAgentProfile, redactCursorAgentText, resolveCursorAgentProfileDirectory } from './auth.js'
import { cursorCliEnvironment, readCursorCliStatus, startCursorCliLogin } from './cli-auth.js'
import { errorMessage, isRecord } from './decode.js'
import { buildCursorAgentLaunchSpec, type CursorAgentLaunchSpec, validateCursorAgentInstallation, type CursorAgentInstallationProbe } from './installation.js'
import { mapPermissionMode, validateCursorAgentIdentity } from './mapping.js'
import { spawnCursorAgentAcp, type AcpConnection, type StdioAcpOptions } from './protocol.js'
import { CursorAgentSession } from './session.js'
import { discoverCursorAcpModels, selectCursorAcpModel } from './model-config.js'
import {
  cursorAgentClientCapabilities,
  CURSOR_AGENT_DEFAULT_MODEL,
  type CursorAgentAuthorizationRequest,
  type CursorAgentClientFilesystem,
  type CursorAgentHealth,
  type CursorAgentIdentity,
  type CursorAgentProviderConfig,
} from './types.js'

/** Dependencies that keep installation, process, and OAuth notification seams injectable. */
export interface CursorAgentProviderDependencies {
  readonly cwd?: string
  readonly installationProbe?: CursorAgentInstallationProbe
  readonly launchSpec?: (config: CursorAgentProviderConfig, cwd: string) => Promise<CursorAgentLaunchSpec>
  readonly connectionFactory?: (spec: CursorAgentLaunchSpec, options?: StdioAcpOptions) => AcpConnection
  readonly onAuthorizationUrl?: (request: CursorAgentAuthorizationRequest) => void
}

/** Provider-owned CursorAgent ACP implementation. */
export class CursorAgentProvider implements ExternalAgentProvider {
  readonly info
  private readonly profileDirectory: string
  private identity: CursorAgentIdentity | undefined
  private status: CursorAgentHealth
  private disposed = false
  private disposePromise: Promise<void> | undefined
  private readonly sessions = new Set<ManagedExternalAgentSession>()
  private readonly connections = new Set<AcpConnection>()

  constructor(readonly config: CursorAgentProviderConfig, private readonly dependencies: CursorAgentProviderDependencies = {}) {
    for (const [name, value] of [['maxEventTextBytes', config.maxEventTextBytes], ['maxEventPayloadBytes', config.maxEventPayloadBytes], ['cancelGraceMs', config.cancelGraceMs]] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) throw new RangeError(name + ' must be a positive safe integer')
    }
    if (config.modelDiscoveryTimeoutMs !== undefined && (!Number.isInteger(config.modelDiscoveryTimeoutMs) || config.modelDiscoveryTimeoutMs < 1 || config.modelDiscoveryTimeoutMs > 0xffffffff)) throw new RangeError('modelDiscoveryTimeoutMs must be an integer from 1 to 4294967295')
    this.profileDirectory = resolveCursorAgentProfileDirectory(config.stateDirectory, config.instanceId)
    const providerName = config.instanceId === 'default' ? 'cursor-agent' : 'cursor-agent:' + config.instanceId
    this.info = { id: providerId(providerName), name: 'CursorAgent', description: 'Official Cursor Agent ACP' }
    this.status = { status: 'missing-installation', profileDirectory: this.profileDirectory }
  }

  /** Value-free installation and protocol health for Settings. */
  get health(): CursorAgentHealth { return this.status }
  /** Whether this provider currently owns an ACP connection or session. */
  get live(): boolean { return this.connections.size > 0 || this.sessions.size > 0 }

  /** Discover account-visible models without creating or mutating a native session. */
  async listModels(signal?: AbortSignal): Promise<readonly ExternalAgentModel[]> {
    this.assertActive()
    const timeout = AbortSignal.timeout(this.config.modelDiscoveryTimeoutMs ?? 30_000)
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    const cwd = this.workingDirectory()
    let connection: AcpConnection | undefined
    try {
      connection = await this.openConnection(cwd, combined)
      const models = await discoverCursorAcpModels(connection, combined)
      this.assertActive()
      this.status = { ...this.status, status: 'ready', profileDirectory: this.profileDirectory, ...(this.identity?.agentVersion === undefined ? {} : { version: this.identity.agentVersion }), model: this.config.model ?? CURSOR_AGENT_DEFAULT_MODEL }
      return models
    } catch (error) {
      this.setFailureStatus(error)
      throw error
    } finally {
      await this.closeConnection(connection)
    }
  }

  /** Open one ACP native session for the exact route and permission mode. */
  async openSession(request: ExternalAgentOpenRequest): Promise<ExternalAgentSession> {
    this.assertActive()
    consumeExternalAgentOpenAuthorization(request)
    if (request.route.kind !== 'external-agent' || request.route.provider !== this.info.id) throw new Error('CursorAgent received a route for another provider')
    if (request.signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const cwd = this.workingDirectory(request.workspaceRoot)
    const filesystem = request.clientFilesystem === undefined ? undefined : adaptFilesystem(request.clientFilesystem)
    let connection: AcpConnection | undefined
    try {
      connection = await this.openConnection(cwd, request.signal, filesystem !== undefined)
      const response = await this.openNativeSession(connection, request, cwd, filesystem)
      const selectedModel = String(request.route.model)
      const native = request.resumeCursor === undefined ? nativeSessionId(response) : decodeCursorAgentCursor(request.resumeCursor, cursorAgentSessionScope(this.config, cwd))
      await selectCursorAcpModel(connection, { ...(isRecord(response) ? response : {}), sessionId: native }, selectedModel, request.signal)
      await connection.request('session/set_mode', { sessionId: native, modeId: mapPermissionMode(request.permissionMode) }, request.signal)
      this.assertActive()
      const rawSession = new CursorAgentSession(connection, this.info.id, request.session, native, this.config, cursorAgentSessionScope(this.config, cwd), filesystem, selectedModel)
      const session = new ManagedExternalAgentSession(rawSession)
      this.sessions.add(session)
      let disposal: Promise<void> | undefined
      const trackedSession: ExternalAgentSession = {
        ref: session.ref,
        supportedModes: session.supportedModes,
        runTurn: (turnRequest, turnHost) => session.runTurn(turnRequest, turnHost),
        dispose: () => {
          disposal ??= session.dispose().finally(() => { this.sessions.delete(session) })
          return disposal
        },
      }
      this.connections.delete(connection)
      connection = undefined
      this.status = { ...this.status, status: 'ready', profileDirectory: this.profileDirectory, ...(this.identity?.agentVersion === undefined ? {} : { version: this.identity.agentVersion }), model: selectedModel }
      return trackedSession
    } catch (error) {
      await this.closeConnection(connection)
      this.setFailureStatus(error)
      throw error
    }
  }

  /** Dispose all provider sessions and live ACP connections. */
  dispose(): Promise<void> {
    if (this.disposePromise !== undefined) return this.disposePromise
    this.disposed = true
    this.disposePromise = (async () => {
      await Promise.all([...this.sessions].map(session => session.dispose().catch(() => undefined)))
      await Promise.all([...this.connections].map(connection => connection.close().catch(() => undefined)))
      this.sessions.clear()
      this.connections.clear()
    })()
    return this.disposePromise
  }

  private setFailureStatus(error: unknown): void {
    if (this.disposed) return
    if ((error instanceof DOMException || error instanceof Error) && error.name === 'AbortError') return
    const authenticationRequired = isAuthenticationError(error)
    this.status = { status: authenticationRequired ? 'authentication-required' : 'error', profileDirectory: this.profileDirectory, message: authenticationRequired ? cursorAgentSignInRequiredMessage() : redactCursorAgentText(errorMessage(error)) }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('CursorAgent provider is disposed')
  }

  private async closeConnection(connection: AcpConnection | undefined): Promise<void> {
    if (connection === undefined) return
    try { await connection.close() } finally { this.connections.delete(connection) }
  }

  /** Validate the executable pair and negotiate ACP identity for Settings. */
  async validateInstallation(): Promise<Awaited<ReturnType<typeof validateCursorAgentInstallation>>> {
    this.assertActive()
    const result = await validateCursorAgentInstallation(this.config, this.dependencies.installationProbe)
    this.assertActive()
    if ('status' in result) {
      this.status = { status: result.status, profileDirectory: this.profileDirectory, message: result.message }
      return result
    }
    const signal = AbortSignal.timeout(this.config.modelDiscoveryTimeoutMs ?? 30_000)
    let connection: AcpConnection | undefined
    try {
      connection = await this.startConnection(this.workingDirectory(), signal)
      const version = this.identity?.agentVersion ?? result.version
      const model = this.status.model
      if (await this.adoptExistingCliLogin(connection, signal)) return { ...result, ...(version === undefined ? {} : { version }) }
      this.status = { status: 'authentication-required', profileDirectory: this.profileDirectory, message: 'Sign in on this device with the Cursor login link. The host will not open a browser.', ...(version === undefined ? {} : { version }), ...(model === undefined ? {} : { model }) }
      return { ...result, ...(version === undefined ? {} : { version }) }
    } catch (error) {
      this.setFailureStatus(error)
      throw error
    } finally {
      await this.closeConnection(connection)
    }
  }

  /** Start the provider OAuth flow from Settings and close the temporary connection. */
  async signIn(signal?: AbortSignal): Promise<void> {
    this.assertActive()
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const connection = await this.startConnection(this.workingDirectory(), signal)
    let login: ReturnType<typeof startCursorCliLogin> | undefined
    try {
      if (await this.adoptExistingCliLogin(connection, signal)) return
      login = startCursorCliLogin(this.config.executablePath, url => {
        this.dependencies.onAuthorizationUrl?.({ authorizationUrl: url, redirectUri: 'cursor-agent://login', state: 'cli-login' })
      })
      const onAbort = (): void => { login?.stop() }
      signal?.addEventListener('abort', onAbort, { once: true })
      try { await login.done } finally { signal?.removeEventListener('abort', onAbort) }
      if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
      if (!await this.adoptExistingCliLogin(connection, signal)) throw new Error(cursorAgentSignInRequiredMessage())
    } catch (error) {
      this.setFailureStatus(error)
      throw error
    } finally {
      login?.stop()
      await this.closeConnection(connection)
    }
  }

  /** Clear local profile only after the official CLI confirms logout succeeded. */
  async signOut(signal?: AbortSignal): Promise<void> {
    this.assertActive()
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    await Promise.all([...this.sessions].map(session => session.dispose().catch(() => undefined)))
    this.sessions.clear()
    await promisify(execFile)(this.config.executablePath, ['logout'], { env: cursorCliEnvironment(), timeout: 15_000, killSignal: 'SIGKILL', ...(signal === undefined ? {} : { signal }) })
    this.assertActive()
    await clearCursorAgentProfile(this.config)
    this.assertActive()
    this.status = { status: 'authentication-required', profileDirectory: this.profileDirectory, message: 'CursorAgent account signed out.' }
  }

  private workingDirectory(workspaceRoot?: string): string {
    const cwd = workspaceRoot ?? this.dependencies.cwd ?? process.cwd()
    const platform = this.config.platform ?? process.platform
    if (!isAbsoluteForPlatform(cwd, platform)) throw new Error('CursorAgent ACP working directory must be absolute')
    return cwd
  }

  private async openConnection(cwd: string, signal?: AbortSignal, filesystem = false): Promise<AcpConnection> {
    const connection = await this.startConnection(cwd, signal, filesystem)
    try {
      if (!await this.adoptExistingCliLogin(connection, signal)) throw new Error(cursorAgentSignInRequiredMessage())
      return connection
    } catch (error) {
      await this.closeConnection(connection)
      throw error
    }
  }

  private async startConnection(cwd: string, signal?: AbortSignal, filesystem = false): Promise<AcpConnection> {
    const spec = this.dependencies.launchSpec === undefined ? await buildCursorAgentLaunchSpec(this.config, cwd) : await this.dependencies.launchSpec(this.config, cwd)
    this.assertActive()
    const options = {
      ...(this.config.maxEventPayloadBytes === undefined ? {} : { maxLineBytes: this.config.maxEventPayloadBytes }),
      ...(this.config.cancelGraceMs === undefined ? {} : { cancelGraceMs: this.config.cancelGraceMs }),
      ...(this.dependencies.onAuthorizationUrl === undefined ? {} : { onAuthorizationUrl: this.dependencies.onAuthorizationUrl }),
    }
    const connection = this.dependencies.connectionFactory === undefined ? spawnCursorAgentAcp(spec, options) : this.dependencies.connectionFactory(spec, options)
    this.connections.add(connection)
    try {
      const response = await connection.request('initialize', {
        protocolVersion: 1,
        clientCapabilities: cursorAgentClientCapabilities(filesystem),
        clientInfo: { name: this.config.clientName ?? 'dsh-acp-cursor', version: this.config.clientVersion ?? '0.1.0' },
      }, signal)
      const identity = validateCursorAgentIdentity(response)
      this.assertActive()
      this.identity = identity
      return connection
    } catch (error) {
      await this.closeConnection(connection)
      throw error
    }
  }

  private async adoptExistingCliLogin(connection: AcpConnection, signal?: AbortSignal): Promise<boolean> {
    const cli = await readCursorCliStatus(this.config.executablePath, signal)
    if (!cli.isAuthenticated) return false
    if (!await this.authenticateIfConfigured(connection, signal)) return false
    this.assertActive()
    this.status = {
      status: 'ready',
      profileDirectory: this.profileDirectory,
      ...(this.identity?.agentVersion === undefined ? {} : { version: this.identity.agentVersion }),
      ...(this.status.model === undefined ? {} : { model: this.status.model }),
      ...(cli.email === undefined ? {} : { email: cli.email }),
      message: cli.email === undefined ? 'Signed in with Cursor CLI.' : 'Signed in as ' + cli.email,
    }
    return true
  }

  private async authenticateIfConfigured(connection: AcpConnection, signal?: AbortSignal): Promise<boolean> {
    if ((this.config.authMethod ?? 'oauth-personal') !== 'oauth-personal') throw new Error('CursorAgent authentication method is unsupported')
    try {
      await connection.request('authenticate', { methodId: 'cursor_login' }, signal)
      return true
    } catch (error) {
      if (isMethodUnavailable(error)) return false
      throw error
    }
  }

  private async openNativeSession(connection: AcpConnection, request: ExternalAgentOpenRequest, cwd: string, filesystem?: CursorAgentClientFilesystem): Promise<unknown> {
    const attachmentRoots = request.attachmentRoots ?? filesystem?.attachmentRoots ?? []
    const workspaceRoots = filesystem?.workspaceRoots ?? (filesystem === undefined ? [] : [filesystem.workspaceRoot])
    const additionalDirectories = [...new Set([...workspaceRoots, ...attachmentRoots])].filter(root => root !== cwd)
    const params = { cwd, mcpServers: [], ...(additionalDirectories.length === 0 ? {} : { additionalDirectories }) }
    if (request.resumeCursor !== undefined) {
      if (request.resumeCursor.provider !== this.info.id) throw new Error('CursorAgent resume cursor belongs to another provider')
      const nativeId = decodeCursorAgentCursor(request.resumeCursor, cursorAgentSessionScope(this.config, cwd))
      if (this.identity?.resumeMethod === 'resume') return connection.request('session/resume', { ...params, sessionId: nativeId }, request.signal)
      if (this.identity?.resumeMethod === 'load') return connection.request('session/load', { ...params, sessionId: nativeId }, request.signal)
      throw new Error('CursorAgent ACP does not advertise session resume')
    }
    return connection.request('session/new', params, request.signal)
  }
}

function nativeSessionId(response: unknown): string {
  if (!isRecord(response) || typeof response.sessionId !== 'string' || response.sessionId.length === 0) throw new Error('CursorAgent session response has no session id')
  return response.sessionId
}
function adaptFilesystem(filesystem: ExternalAgentFilesystem): CursorAgentClientFilesystem {
  const workspaceRoot = filesystem.workspaceRoots[0]
  if (workspaceRoot === undefined) throw new Error('CursorAgent client filesystem has no workspace root')
  if (filesystem.resolvePath === undefined) throw new Error('CursorAgent client filesystem requires a host path resolver')
  return { workspaceRoot, workspaceRoots: filesystem.workspaceRoots, attachmentRoots: filesystem.attachmentRoots, readTextFile: (path, signal) => filesystem.readTextFile(path, signal), writeTextFile: (path, content, signal) => filesystem.writeTextFile(path, content, signal), resolvePath: filesystem.resolvePath }
}
function isAbsoluteForPlatform(value: string, platform: NodeJS.Platform): boolean { return platform === 'win32' ? /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') : isAbsolute(value) }
function isAuthenticationError(error: unknown): boolean { return /auth|unauthori|sign.?in|credential/i.test(errorMessage(error)) }
function isMethodUnavailable(error: unknown): boolean { return /method|not found|unavailable/i.test(errorMessage(error)) }

/** Construct a provider instance for a configured CursorAgent installation. */
export function createCursorAgentProvider(config: CursorAgentProviderConfig, dependencies?: CursorAgentProviderDependencies): CursorAgentProvider { return new CursorAgentProvider(config, dependencies) }
