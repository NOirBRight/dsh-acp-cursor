/** Validate an explicit cursor-agent binary. No PATH search for `agent`. */
import { access, constants, realpath, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type { CursorAgentProviderConfig } from './types.js'
import { cursorCliEnvironment } from './cli-auth.js'
import { resolveCursorAgentProfileDirectory } from './auth.js'

export interface CursorAgentLaunchSpec {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

export type CursorAgentInstallationProbe = (config: CursorAgentProviderConfig) => Promise<CursorAgentInstallationResult>

export type CursorAgentInstallationResult =
  | { readonly status: 'missing-installation' | 'invalid-installation'; readonly executablePath: string; readonly harnessPath: string; readonly message: string }
  | { readonly executablePath: string; readonly harnessPath: string; readonly version?: string }

export function deriveCursorAgentHarnessPath(_executablePath: string): string {
  return ''
}

export async function validateCursorAgentInstallation(
  config: CursorAgentProviderConfig,
  probe?: CursorAgentInstallationProbe,
): Promise<CursorAgentInstallationResult> {
  if (probe !== undefined) return probe(config)
  const executablePath = config.executablePath.trim()
  if (executablePath === '') {
    return { status: 'missing-installation', executablePath: '', harnessPath: '', message: 'Set the cursor-agent executable path.' }
  }
  if (!isAbsolute(executablePath)) {
    return { status: 'invalid-installation', executablePath, harnessPath: '', message: 'cursor-agent path must be absolute.' }
  }
  try {
    await access(executablePath, constants.X_OK)
    const info = await stat(await realpath(executablePath))
    if (!info.isFile() && !info.isSymbolicLink()) {
      return { status: 'invalid-installation', executablePath, harnessPath: '', message: 'cursor-agent path is not a file.' }
    }
  } catch {
    return { status: 'missing-installation', executablePath, harnessPath: '', message: 'cursor-agent executable was not found.' }
  }
  return { executablePath, harnessPath: '' }
}

export async function buildCursorAgentLaunchSpec(config: CursorAgentProviderConfig, cwd: string): Promise<CursorAgentLaunchSpec> {
  const installed = await validateCursorAgentInstallation(config)
  if ('status' in installed) throw new Error(installed.message)
  const env = { ...cursorCliEnvironment(), CURSOR_CONFIG_DIR: resolveCursorAgentProfileDirectory(config.stateDirectory, config.instanceId) }
  return { command: installed.executablePath, args: ['acp'], cwd, env }
}
