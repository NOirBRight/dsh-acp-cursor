import { describe, expect, it } from 'vitest'
import { parseCursorCliStatus, parseCursorLoginUrl } from '../src/cli-auth.js'

describe('cursor CLI auth', () => {
  it('parses the NO_OPEN_BROWSER DeepControl URL', () => {
    const text = "Waiting for browser authentication...\nOpen a browser and navigate to this link: https://cursor.com/loginDeepControl?challenge=abc&uuid=1&mode=login&redirectTarget=cli\n"
    expect(parseCursorLoginUrl(text)).toBe('https://cursor.com/loginDeepControl?challenge=abc&uuid=1&mode=login&redirectTarget=cli')
  })

  it('reads whoami from status JSON', () => {
    expect(parseCursorCliStatus({
      status: 'authenticated',
      isAuthenticated: true,
      userInfo: { email: 'paul.qu@ayaneo.com' },
    })).toEqual({ isAuthenticated: true, email: 'paul.qu@ayaneo.com' })
    expect(parseCursorCliStatus({ isAuthenticated: false })).toEqual({ isAuthenticated: false })
  })
})
