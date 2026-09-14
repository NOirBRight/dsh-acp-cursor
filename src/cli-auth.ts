/** Official Cursor CLI login/status. Remote clients get the printed URL; the host never xdg-opens it. */
import { spawn } from 'node:child_process'

export interface CursorCliStatus {
  readonly isAuthenticated: boolean
  readonly email?: string
}

/** All ACP subprocesses use the CLI session, not a host LLM API-key override. */
export function cursorCliEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_OPEN_BROWSER: '1' }
  delete env.CURSOR_API_KEY
  return env
}

const LOGIN_URL = /https:\/\/cursor\.com\/loginDeepControl\?\S+/

export function parseCursorLoginUrl(text: string): string | undefined {
  const match = LOGIN_URL.exec(text)
  const url = match?.[0]
  return url !== undefined && url.startsWith('https://') ? url.replace(/[.,;]+$/, '') : undefined
}

export function parseCursorCliStatus(value: unknown): CursorCliStatus {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { isAuthenticated: false }
  const record = value as Record<string, unknown>
  const authenticated = record.isAuthenticated === true || record.status === 'authenticated'
  const info = record.userInfo
  const email = typeof info === 'object' && info !== null && !Array.isArray(info) && typeof (info as { email?: unknown }).email === 'string'
    ? (info as { email: string }).email
    : undefined
  return { isAuthenticated: authenticated, ...(email === undefined ? {} : { email }) }
}

export async function readCursorCliStatus(executablePath: string, signal?: AbortSignal): Promise<CursorCliStatus> {
  const child = spawn(executablePath, ['status', '--format', 'json'], { shell: false, env: cursorCliEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] })
  const chunks: Buffer[] = []
  child.stdout.on('data', chunk => { chunks.push(chunk as Buffer) })
  child.stderr.on('data', () => undefined)
  const exit = await new Promise<number | null>((resolve, reject) => {
    const abort = () => { child.kill('SIGTERM'); reject(new DOMException('The operation was aborted', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
    child.once('error', reject)
    child.once('exit', code => { signal?.removeEventListener('abort', abort); resolve(code) })
  })
  if (exit !== 0) return { isAuthenticated: false }
  try {
    return parseCursorCliStatus(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch {
    return { isAuthenticated: false }
  }
}

export function startCursorCliLogin(executablePath: string, onUrl: (url: string) => void): { stop(): void; done: Promise<void> } {
  const env = cursorCliEnvironment()
  const child = spawn(executablePath, ['login'], { shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let buf = ''
  let stopped = false
  const feed = (chunk: Buffer) => {
    buf += chunk.toString('utf8')
    if (buf.length > 16_384) buf = buf.slice(-8_192)
    const url = parseCursorLoginUrl(buf)
    if (url !== undefined) onUrl(url)
  }
  child.stdout.on('data', feed)
  child.stderr.on('data', feed)
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => {
      if (stopped) reject(new DOMException('The operation was aborted', 'AbortError'))
      else if (code === 0) resolve()
      else reject(new Error('cursor-agent login exited ' + String(code)))
    })
  })
  return {
    stop() { stopped = true; try { child.kill('SIGTERM') } catch { /* already gone */ } },
    done,
  }
}
