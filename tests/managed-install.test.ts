import { describe, expect, it } from 'vitest'
import { installManagedCursorAgentRuntime } from '../src/managed-install.js'

describe('official CLI install', () => {
  it('skips download when cursor-agent is already on disk', async () => {
    const result = await installManagedCursorAgentRuntime({
      probe: async () => ({ executablePath: '/home/x/.local/bin/cursor-agent', harnessPath: '', message: 'found' }),
      run: async () => { throw new Error('should not install') },
    })
    expect(result.phase).toBe('succeeded')
    expect(result.executablePath).toBe('/home/x/.local/bin/cursor-agent')
  })

  it('probes after a successful installer run', async () => {
    let probed = 0
    const result = await installManagedCursorAgentRuntime({
      probe: async () => {
        probed += 1
        if (probed === 1) return { message: 'missing' }
        return { executablePath: '/opt/cursor-agent', harnessPath: '', message: 'found' }
      },
      run: async () => ({ code: 0, output: 'ok' }),
    })
    expect(result).toMatchObject({ phase: 'succeeded', executablePath: '/opt/cursor-agent' })
  })
})
