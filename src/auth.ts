/** Cursor CLI auth helpers. Credentials stay in the official global store. */
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import type { CursorAgentAuthorizationRequest, CursorAgentProviderConfig } from './types.js'

export const CURSOR_AGENT_AUTH_STDOUT_PREFIX = ''

export function cursorAgentSignInRequiredMessage(): string {
  return 'Cursor Agent is not signed in. Run cursor-agent login.'
}

export function redactCursorAgentText(value: string): string {
  return value.replace(/(bearer\s+)\S+/gi, '$1[redacted]').replace(/sk-[A-Za-z0-9._-]+/g, '[redacted]')
}

export function resolveCursorAgentProfileDirectory(stateDirectory: string, instanceId: string): string {
  return join(stateDirectory, instanceId)
}

/** Cursor login is global CLI state; only drop this instance's plugin files. */
export async function clearCursorAgentProfile(config: CursorAgentProviderConfig): Promise<void> {
  const dir = resolveCursorAgentProfileDirectory(config.stateDirectory, config.instanceId)
  await rm(dir, { recursive: true, force: true })
}

export function parseCursorAgentAuthPrelude(_raw: string): CursorAgentAuthorizationRequest | null {
  return null
}
