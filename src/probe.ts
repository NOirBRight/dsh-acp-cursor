/** Suggest an explicit cursor-agent path. Never silently pick a colliding `agent` binary. */
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

export interface CursorAgentProbeResult {
  readonly executablePath?: string
  readonly harnessPath?: string
  readonly message: string
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function probeCursorAgentInstallation(): Promise<CursorAgentProbeResult> {
  const home = process.env.HOME ?? ''
  const candidates = [
    join(home, '.local/bin/cursor-agent'),
    join(home, '.local/share/cursor-agent/versions', process.env.CURSOR_AGENT_VERSION ?? '', 'cursor-agent'),
    '/usr/local/bin/cursor-agent',
  ].filter(path => !path.includes('//'))
  for (const executablePath of candidates) {
    if (await isExecutableFile(executablePath)) {
      return { executablePath, harnessPath: '', message: 'Found cursor-agent at ' + executablePath }
    }
  }
  return { message: 'cursor-agent not found. Install the official CLI and set an absolute path.' }
}
