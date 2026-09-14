import { describe, expect, it } from 'vitest'
import { createCursorAgentUsageReader } from '../src/web/usage-reader.ts'

describe('usage reader headline', () => {
  it('publishes every quota window, including third-party models', async () => {
    const reader = createCursorAgentUsageReader()
    const rpc = {
      call: async () => ({
        ok: true as const,
        value: {
          status: 'ready',
          observedAt: '2026-09-09T00:00:00.000Z',
          groups: [{
            displayName: 'Cursor',
            buckets: [
              { displayName: '5h', remainingFraction: 0.555, resetTime: '2026-09-09T05:00:00.000Z' },
              { displayName: 'weekly', remainingFraction: 0.2 },
            ],
          }],
        },
      }),
    }
    const snapshot = await reader.read(rpc, false, new AbortController().signal)
    expect(snapshot.status).toBe('ready')
    if (snapshot.status !== 'ready') return
    expect(snapshot.windows).toHaveLength(2)
    expect(snapshot.windows[1]?.remainingPercent).toBe(20)
    expect(snapshot.windows[0]?.remainingPercent).toBe(56)
    expect(snapshot.windows[0]?.id).not.toBe(snapshot.windows[1]?.id)
  })
})
