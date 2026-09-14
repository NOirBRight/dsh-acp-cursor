/** Read only the official Cursor CLI credential file, never the LLM plugin store. */
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

export interface CursorCliToken {
  readonly accessToken: string
  readonly userId?: string
}

function decodeJwtUserId(accessToken: string): string | undefined {
  const parts = accessToken.split('.')
  if (parts.length < 2 || parts[1] === undefined) return undefined
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json) as Record<string, unknown>
    if (typeof payload.sub === 'string' && payload.sub.length > 0) return (payload.sub.split('|')[1] ?? payload.sub).trim() || undefined
    if (typeof payload.user_id === 'string' && payload.user_id.length > 0) return payload.user_id
    if (typeof payload.userId === 'number') return String(payload.userId)
  } catch {
    return undefined
  }
  return undefined
}

export function cursorAuthJsonPath(): string {
  if (platform() === 'darwin') return join(homedir(), '.cursor', 'auth.json')
  if (platform() === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Cursor', 'auth.json')
  const xdg = process.env.XDG_CONFIG_HOME
  return join(xdg && xdg.length > 0 ? xdg : join(homedir(), '.config'), 'cursor', 'auth.json')
}

export async function readCursorCliToken(): Promise<CursorCliToken | undefined> {
  try {
    const raw = JSON.parse(await readFile(cursorAuthJsonPath(), 'utf8')) as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
    const accessToken = (raw as { accessToken?: unknown }).accessToken
    if (typeof accessToken !== 'string' || accessToken.length === 0) return undefined
    const userId = decodeJwtUserId(accessToken)
    return { accessToken, ...(userId === undefined ? {} : { userId }) }
  } catch {
    return undefined
  }
}
