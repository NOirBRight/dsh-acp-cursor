import { describe, expect, it } from 'vitest'
import { optionId } from '@deepseek-ai/dsh-acp-provider'
import { createCursorAgentInteractionHandler } from '../src/interaction.js'

describe('stock Other handling', () => {
  it('cancels the native question when the user submits custom text', async () => {
    const handler = createCursorAgentInteractionHandler({
      signal: new AbortController().signal,
      publish: async () => { /* unused */ },
      requestPermission: async () => ({ kind: 'cancel' }),
      requestUserInput: async () => ({ answers: ['typed'], custom: 'typed' }),
    })
    const result = await handler('session/request_permission', {
      toolCall: { toolCallId: 'interaction_1', title: 'Choose' },
      options: [{ optionId: 'a', name: 'A' }, { optionId: 'b', name: 'B' }],
    }, 1)
    expect(result).toEqual({ outcome: { outcome: 'cancelled' } })
    expect(optionId('ok')).toBe('ok')
  })
})
