import { describe, expect, it } from 'vitest'
import { mapPermissionMode, validateCursorAgentIdentity } from '../src/mapping.js'

describe('cursor ACP mapping', () => {
  it('maps DSH permission modes onto Cursor session mode agent', () => {
    expect(mapPermissionMode('approval-required')).toBe('agent')
    expect(mapPermissionMode('auto-accept-edits')).toBe('agent')
    expect(mapPermissionMode('full-access')).toBe('agent')
  })

  it('accepts cursor-like initialize identities', () => {
    const identity = validateCursorAgentIdentity({
      protocolVersion: 1,
      agentInfo: { name: 'cursor-agent', version: '2026.09.02' },
      agentCapabilities: { loadSession: true },
    })
    expect(identity.agentName).toBe('cursor-agent')
    expect(identity.resumeMethod).toBe('load')
  })

  it('accepts official cursor-agent initialize with cursor_login and no agentInfo', () => {
    const identity = validateCursorAgentIdentity({
      protocolVersion: 1,
      agentCapabilities: { loadSession: true, promptCapabilities: { image: true } },
      authMethods: [{ id: 'cursor_login', name: 'Cursor Login' }],
    })
    expect(identity.agentName).toBe('cursor-agent')
    expect(identity.resumeMethod).toBe('load')
  })
})
