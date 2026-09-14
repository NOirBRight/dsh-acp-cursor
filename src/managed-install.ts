/** Official Cursor CLI install: curl https://cursor.com/install | bash, then probe. */
import { spawn } from 'node:child_process'
import { probeCursorAgentInstallation } from './probe.js'

export interface ManagedInstallProgress {
  readonly phase: 'idle' | 'downloading' | 'succeeded' | 'failed'
  readonly downloadedBytes?: number
  readonly totalBytes?: number
  readonly message?: string
  readonly executablePath?: string
  readonly harnessPath?: string
}

const INSTALL_COMMAND = 'set -e; tmp=$(mktemp); curl -fsSL https://cursor.com/install -o "$tmp"; bash "$tmp"; rm -f "$tmp"'

export async function installManagedCursorAgentRuntime(input: {
  readonly onProgress?: (progress: ManagedInstallProgress) => void
  readonly run?: () => Promise<{ readonly code: number; readonly output: string }>
  readonly probe?: typeof probeCursorAgentInstallation
} = {}): Promise<ManagedInstallProgress> {
  const probe = input.probe ?? probeCursorAgentInstallation
  const already = await probe()
  if (already.executablePath !== undefined) {
    const done: ManagedInstallProgress = { phase: 'succeeded', message: already.message, executablePath: already.executablePath, harnessPath: already.harnessPath ?? '' }
    input.onProgress?.(done)
    return done
  }
  input.onProgress?.({ phase: 'downloading', message: 'Installing official Cursor CLI…' })
  const run = input.run ?? runOfficialInstaller
  const result = await run()
  if (result.code !== 0) {
    const failed: ManagedInstallProgress = { phase: 'failed', message: result.output.trim() || 'Cursor CLI install failed.' }
    input.onProgress?.(failed)
    return failed
  }
  const found = await probe()
  if (found.executablePath === undefined) {
    const failed: ManagedInstallProgress = { phase: 'failed', message: found.message || 'Install finished but cursor-agent was not found.' }
    input.onProgress?.(failed)
    return failed
  }
  const done: ManagedInstallProgress = { phase: 'succeeded', message: found.message, executablePath: found.executablePath, harnessPath: found.harnessPath ?? '' }
  input.onProgress?.(done)
  return done
}

function runOfficialInstaller(): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    const child = spawn('bash', ['-lc', INSTALL_COMMAND], { shell: false, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    const chunks: Buffer[] = []
    child.stdout.on('data', chunk => { chunks.push(chunk as Buffer) })
    child.stderr.on('data', chunk => { chunks.push(chunk as Buffer) })
    const reap = (): void => { try { if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM') } catch { try { child.kill('SIGTERM') } catch { /* gone */ } } }
    const timer = setTimeout(() => { reap(); resolve({ code: 1, output: 'Cursor CLI install timed out.' }) }, 300_000)
    child.once('error', error => { clearTimeout(timer); resolve({ code: 1, output: error.message }) })
    child.once('exit', code => { clearTimeout(timer); resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString('utf8') }) })
  })
}
