import { describe, expect, it } from 'vitest'
import { createCursorAgentLlmBridge } from '../src/llm-bridge.js'
import { ExternalAgentProviderRegistry, providerId } from '@deepseek-ai/dsh-acp-provider'

const VALID_MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const

describe('Cursor resolveModel Host shape', () => {
  it('echoes the requested id and nests contextWindow', async () => {
    const listed = [
      { id: 'claude-opus-5-thinking-high', name: 'Claude Opus 5 High', supportedModes: [...VALID_MODES] },
      { id: 'claude-opus-5-thinking-low', name: 'Claude Opus 5 Low', supportedModes: [...VALID_MODES] },
    ]
    const provider = {
      info: { id: providerId('cursor-agent'), name: 'Cursor' },
      health: { status: 'ready' as const },
      listModels: async () => listed,
      openSession: async () => ({
        ref: { provider: providerId('cursor-agent'), session: 's', nativeSession: 'n' },
        supportedModes: [...VALID_MODES],
        dispose: async () => undefined,
        runTurn: async () => ({ status: 'completed' as const, text: '' }),
      }),
    }
    const registry = new ExternalAgentProviderRegistry()
    const unregister = registry.register(provider as never)
    const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never })
    const resolved = await adapter.resolveModel('cursor-agent', 'claude-opus-5-thinking-high')
    expect(resolved.id).toBe('claude-opus-5-thinking-high')
    expect(resolved.context).toEqual({ contextWindow: expect.any(Number) })
    const listedIds = await adapter.listModels('cursor-agent')
    expect(listedIds.every(row => 'id' in row && 'name' in row && 'provider' in row)).toBe(true)
    expect(listedIds.some(row => 'contextWindow' in row)).toBe(false)
    await adapter.dispose()
    await unregister()
  })
})
