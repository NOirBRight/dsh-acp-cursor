import type {
  ExternalAgentAttachment,
  ExternalAgentEvent,
  ExternalAgentModel,
  ExternalAgentOpenRequest,
  ExternalAgentPermissionDecision,
  ExternalAgentPermissionRequest,
  ExternalAgentProvider,
  ExternalAgentSession,
  ExternalAgentSessionId,
  ExternalAgentSessionRef,
  ExternalAgentTurnHost,
  ExternalAgentTurnRequest,
  ExternalAgentTurnResult,
  ExternalAgentUserInputAnswers,
  ExternalAgentUserInputRequest,
  ExternalAgentPermissionMode,
  ExternalAgentProviderInstanceId,
} from '@deepseek-ai/dsh-acp-provider'

/** Official CursorAgent native permission mode values. */
export type CursorAgentNativeMode = 'agent' | 'plan' | 'ask'

/** Stable alias accepted for the account's current default model. */
export const CURSOR_AGENT_DEFAULT_MODEL = 'default'

/** First-release authentication method. */
export type CursorAgentAuthMethod = 'oauth-personal'

/** Provider setup status shown by Settings. */
export type CursorAgentStatus = 'missing-installation' | 'invalid-installation' | 'authentication-required' | 'ready' | 'error'

/** User-provided executable pair and isolated mutable profile. */
export interface CursorAgentInstallationConfig {
  readonly executablePath: string
  readonly harnessPath: string
  readonly stateDirectory: string
  readonly instanceId: ExternalAgentProviderInstanceId
  readonly platform?: NodeJS.Platform
}

/** Provider configuration for one independently mounted instance. */
export interface CursorAgentProviderConfig extends CursorAgentInstallationConfig {
  readonly authMethod?: CursorAgentAuthMethod
  /** Deadline for native initialization, OAuth and model discovery; defaults to 30 seconds. */
  readonly modelDiscoveryTimeoutMs?: number
  readonly model?: string
  readonly clientName?: string
  readonly clientVersion?: string
  readonly maxEventTextBytes?: number
  readonly maxEventPayloadBytes?: number
  readonly cancelGraceMs?: number
}

/** Result of validating the explicit executable pair. */
export interface CursorAgentInstallationStatus {
  readonly status: Exclude<CursorAgentStatus, 'authentication-required' | 'ready'>
  readonly executablePath: string
  readonly harnessPath: string
  readonly version?: string
  readonly message: string
}

/** ACP identity and capabilities required by this provider. */
export interface CursorAgentIdentity {
  readonly protocolVersion: number
  readonly agentName: string
  readonly agentVersion?: string
  readonly supportsResume: boolean
  readonly resumeMethod?: 'resume' | 'load'
}

/** Provider status and account metadata with no secret values. */
export interface CursorAgentHealth {
  readonly status: CursorAgentStatus
  readonly message?: string
  readonly version?: string
  /** Deadline for native initialization, OAuth and model discovery; defaults to 30 seconds. */
  readonly modelDiscoveryTimeoutMs?: number
  readonly model?: string
  readonly profileDirectory: string
  readonly email?: string
}

/** A parsed public OAuth link; tokens and codes never enter this type. */
export interface CursorAgentAuthorizationRequest {
  readonly authorizationUrl: string
  readonly redirectUri: string
  readonly state: string
}

/** Filesystem roots a provider may request through DSH. */
export interface CursorAgentClientFilesystem {
  readonly workspaceRoot: string
  readonly workspaceRoots?: readonly string[]
  readonly attachmentRoots: readonly string[]
  readTextFile(path: string, signal?: AbortSignal): Promise<string>
  writeTextFile(path: string, content: string, signal?: AbortSignal): Promise<void>
  /** Optional host-owned realpath/policy check for symlink and write containment. */
  resolvePath?(path: string, operation: 'read' | 'write'): Promise<string> | string
}

/** Advertise DSH filesystem methods only for sessions that receive its adapter. */
export function cursorAgentClientCapabilities(filesystem: boolean): Readonly<Record<string, unknown>> {
  return { _meta: { parameterizedModelPicker: true }, ...(filesystem ? { fs: { readTextFile: true, writeTextFile: true } } : {}) }
}

/** Native mode values supported by the provider. */
export const CURSOR_AGENT_PERMISSION_MODES: readonly ExternalAgentPermissionMode[] = [
  'approval-required',
  'auto-accept-edits',
  'full-access',
]

/** Re-export the provider-neutral types used by CursorAgent adapters. */
export type {
  ExternalAgentAttachment,
  ExternalAgentEvent,
  ExternalAgentModel,
  ExternalAgentOpenRequest,
  ExternalAgentPermissionDecision,
  ExternalAgentPermissionRequest,
  ExternalAgentProvider,
  ExternalAgentSession,
  ExternalAgentSessionId,
  ExternalAgentSessionRef,
  ExternalAgentTurnHost,
  ExternalAgentTurnRequest,
  ExternalAgentTurnResult,
  ExternalAgentUserInputAnswers,
  ExternalAgentUserInputRequest,
  ExternalAgentPermissionMode,
}
