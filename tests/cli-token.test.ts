import { expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { readCursorCliToken } from '../src/cli-token.js'
import { cursorCliEnvironment } from '../src/cli-auth.js'
import { redactCursorAgentText } from '../src/auth.js'
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

it('normalizes Cursor JWT subjects like the LLM reference without reading its credential store', async () => {
  const accessToken = 'header.' + Buffer.from(JSON.stringify({ sub: 'auth0|user_123' })).toString('base64url') + '.signature'
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ accessToken }))
  expect(await readCursorCliToken()).toEqual({ accessToken, userId: 'user_123' })
  expect(String(vi.mocked(readFile).mock.calls[0]?.[0])).toMatch(/cursor[\/]auth\.json$/i)
})

it('does not let a host API-key override choose another account for ACP', () => {
  vi.stubEnv('CURSOR_API_KEY', 'unrelated-host-key')
  try {
    const env = cursorCliEnvironment()
    expect(env.CURSOR_API_KEY).toBeUndefined()
    expect(env.NO_OPEN_BROWSER).toBe('1')
    expect(redactCursorAgentText('Authorization: Bearer secret-token')).toBe('Authorization: Bearer [redacted]')
    expect(process.env.CURSOR_API_KEY).toBe('unrelated-host-key')
  } finally { vi.unstubAllEnvs() }
})
