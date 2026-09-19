import { expect, it, vi } from 'vitest'
import { ExternalAgentProviderRegistry, optionId, providerId, providerInstanceId, sessionId, turnId, type ExternalAgentTurnHost } from '@deepseek-ai/dsh-acp-provider'
import type { AcpRequestHandler } from '../src/protocol.js'
import { createCursorAgentInteractionHandler } from '../src/interaction.js'
import { createCursorAgentLlmBridge } from '../src/llm-bridge.js'
import { CursorAgentSession } from '../src/session.js'

const createPlan = {
  toolCallId: 'call_124',
  name: 'Refactor tabs layout',
  overview: 'Tighten layout behavior and preserve existing UX.',
  plan: '1. Inspect current tab sizing logic.\n2. Update layout calculations.',
  todos: [{ id: 'todo-1', content: 'Inspect current tab sizing logic', status: 'completed' }],
}

function hangUntilAborted(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = (): void => reject(new DOMException('The operation was aborted', 'AbortError'))
    if (signal?.aborted === true) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

function isModeParams(params: unknown): params is { modeId: string } {
  return typeof params === 'object' && params !== null && 'modeId' in params && typeof params.modeId === 'string'
}

it('answers cursor/create_plan during a prompt so the native turn can finish', async () => {
  let handler: AcpRequestHandler | undefined
  const request = vi.fn(async (method: string, _params?: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (method === 'session/prompt') {
      if (handler === undefined) throw new Error('ACP client handler missing during prompt')
      try {
        const result = await handler('cursor/create_plan', createPlan, 7)
        expect(result).toEqual({ outcome: { outcome: 'accepted' } })
      } catch {
        // Cursor does not finish session/prompt when create_plan is unanswered or errors.
        await hangUntilAborted(signal)
      }
      return { stopReason: 'end_turn' }
    }
    return { sessionId: 's' }
  })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: (next: typeof handler) => { handler = next },
    setNotificationHandler: vi.fn(),
    close: async () => undefined,
  }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('plan'),
  }, 'scope')
  const host: ExternalAgentTurnHost = {
    publish: vi.fn(),
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: ['Approve'] }),
  }
  const result = await session.runTurn({
    turn: turnId('plan'),
    prompt: 'Plan the refactor.',
    permissionMode: 'approval-required',
    signal: AbortSignal.timeout(1_000),
  }, host)
  expect(result.status).toBe('completed')
  await session.dispose()
})

it('switches Cursor to agent before accepting create_plan so execution can start', async () => {
  let handler: AcpRequestHandler | undefined
  const modes: string[] = []
  const request = vi.fn(async (method: string, params?: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (method === 'session/set_mode' && isModeParams(params)) modes.push(params.modeId)
    if (method === 'session/prompt') {
      if (handler === undefined) throw new Error('ACP client handler missing during prompt')
      const result = await handler('cursor/create_plan', createPlan, 7)
      expect(result).toEqual({ outcome: { outcome: 'accepted' } })
      return { stopReason: 'end_turn' }
    }
    return { sessionId: 's', configOptions: [] }
  })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: (next: typeof handler) => { handler = next },
    setNotificationHandler: vi.fn(),
    close: async () => undefined,
  }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('plan-exec'),
  }, 'scope')
  const host: ExternalAgentTurnHost = {
    publish: vi.fn(),
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: ['Approve'] }),
  }
  const turn = {
    turn: turnId('plan-exec'),
    prompt: 'Plan the refactor.',
    permissionMode: 'approval-required' as const,
    nativeMode: 'plan' as const,
    signal: AbortSignal.timeout(1_000),
  }
  expect((await session.runTurn(turn, host)).status).toBe('completed')
  expect(modes).toEqual(['plan', 'agent'])
  await session.dispose()
})

it('rejects cursor/create_plan when the user keeps planning', async () => {
  const handler = createCursorAgentInteractionHandler({
    signal: new AbortController().signal,
    publish: async () => undefined,
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: ['Keep planning'] }),
  })
  await expect(handler('cursor/create_plan', createPlan, 1)).resolves.toEqual({ outcome: { outcome: 'rejected' } })
})

it('answers cursor/ask_question with selected option ids', async () => {
  const handler = createCursorAgentInteractionHandler({
    signal: new AbortController().signal,
    publish: async () => undefined,
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: ['Plan'] }),
  })
  await expect(handler('cursor/ask_question', {
    toolCallId: 'call_123',
    title: 'Need input',
    questions: [{
      id: 'q1',
      prompt: 'Which mode should I use?',
      options: [{ id: 'agent', label: 'Agent' }, { id: 'plan', label: 'Plan' }],
    }],
  }, 2)).resolves.toEqual({
    outcome: { outcome: 'answered', answers: [{ questionId: 'q1', selectedOptionIds: ['plan'] }] },
  })
})

it('sets Cursor session mode plan when the turn carries nativeMode plan', async () => {
  const request = vi.fn(async (method: string, _params?: unknown): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : { sessionId: 's' })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: vi.fn(),
    setNotificationHandler: vi.fn(),
    close: async () => undefined,
  }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('plan-mode'),
  }, 'scope')
  const host: ExternalAgentTurnHost = {
    publish: vi.fn(),
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: [] }),
  }
  const turn = {
    turn: turnId('plan-mode'),
    prompt: 'Plan first.',
    permissionMode: 'approval-required' as const,
    nativeMode: 'plan' as const,
    signal: new AbortController().signal,
  }
  expect((await session.runTurn(turn, host)).status).toBe('completed')
  expect(request.mock.calls.filter(call => call[0] === 'session/set_mode').map(call => call[1])).toEqual([
    { sessionId: 's', modeId: 'plan' },
  ])
  await session.dispose()
})

it('follows an approved plan with an agent-mode turn', async () => {
  const VALID_MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const
  const turns: { prompt: string; nativeMode?: string }[] = []
  const setPlanMode = vi.fn()
  const provider = {
    info: { id: providerId('cursor-agent'), name: 'Cursor' },
    health: { status: 'ready' as const },
    listModels: async () => [{ id: 'gpt-5', name: 'GPT 5', supportedModes: [...VALID_MODES] }],
    openSession: async () => ({
      ref: { provider: providerId('cursor-agent'), session: sessionId('s'), nativeSession: sessionId('n') },
      supportedModes: [...VALID_MODES],
      dispose: async () => undefined,
      runTurn: async (request: { prompt: string; nativeMode?: string }, host: ExternalAgentTurnHost) => {
        turns.push({ prompt: request.prompt, ...(request.nativeMode === undefined ? {} : { nativeMode: request.nativeMode }) })
        if (turns.length === 1) {
          await host.requestUserInput({ requestId: optionId('plan-review'), question: '# Plan', options: [optionId('Approve'), optionId('Keep planning')] })
        }
        return { status: 'completed' as const, text: 'ok' }
      },
    }),
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never }, undefined, undefined, {
    isPlanMode: () => true,
    ask: async () => ({ answers: [{ id: 'plan-review', selected: ['Approve'] }] }),
    setPlanMode,
  })
  const chunks: unknown[] = []
  for await (const chunk of adapter.stream({
    provider: 'cursor-agent',
    model: 'gpt-5',
    sessionId: 's',
    messages: [{ source: { kind: 'user' }, content: 'Plan the refactor.' }],
  })) chunks.push(chunk)
  expect(turns.map(turn => turn.nativeMode)).toEqual(['plan', 'agent'])
  expect(turns[1]?.prompt).toBe('The user approved the plan. Carry it out now.')
  expect(setPlanMode).toHaveBeenCalledWith('s', false)
  await adapter.dispose()
  await unregister()
})

it('applies a picker change made during plan review to the following native turn', async () => {
  const VALID_MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const
  const turns: { prompt: string; model?: string }[] = []
  let selected = { model: 'grok-4.6' }
  const provider = {
    info: { id: providerId('cursor-agent'), name: 'Cursor' },
    health: { status: 'ready' as const },
    listModels: async () => [
      { id: 'grok-4.6', name: 'Cursor Grok 4.6', supportedModes: [...VALID_MODES] },
      { id: 'composer-2.5', name: 'Composer 2.5', supportedModes: [...VALID_MODES] },
    ],
    openSession: async () => ({
      ref: { provider: providerId('cursor-agent'), session: sessionId('s'), nativeSession: sessionId('n') },
      supportedModes: [...VALID_MODES],
      dispose: async () => undefined,
      runTurn: async (request: { prompt: string; model?: string }, host: ExternalAgentTurnHost) => {
        turns.push({ prompt: request.prompt, ...(request.model === undefined ? {} : { model: String(request.model) }) })
        if (turns.length === 1) {
          await host.requestUserInput({ requestId: optionId('plan-review'), question: '# Plan', options: [optionId('Approve'), optionId('Keep planning')] })
        }
        return { status: 'completed' as const, text: 'ok' }
      },
    }),
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never }, undefined, undefined, {
    isPlanMode: () => true,
    ask: async () => {
      selected = { model: 'composer-2.5' }
      return { answers: [{ id: 'plan-review', selected: ['Approve'] }] }
    },
    setPlanMode: () => undefined,
    resolveSelectedModel: () => selected,
  })
  for await (const _chunk of adapter.stream({
    provider: 'cursor-agent',
    model: 'grok-4.6',
    sessionId: 's',
    messages: [{ source: { kind: 'user' }, content: 'Plan first.' }],
  })) { /* drain */ }
  expect(turns.map(turn => turn.model)).toEqual(['grok-4.6', 'composer-2.5'])
  await adapter.dispose()
  await unregister()
})

it('cancels create_plan when switching to agent fails instead of accepting while still in plan', async () => {
  let handler: AcpRequestHandler | undefined
  const request = vi.fn(async (method: string, params?: unknown, signal?: AbortSignal): Promise<unknown> => {
    if (method === 'session/set_mode' && isModeParams(params) && params.modeId === 'agent') throw new Error('set_mode failed')
    if (method === 'session/prompt') {
      if (handler === undefined) throw new Error('ACP client handler missing during prompt')
      const result = await handler('cursor/create_plan', createPlan, 7)
      expect(result).toEqual({ outcome: { outcome: 'cancelled' } })
      return { stopReason: 'end_turn' }
    }
    return { sessionId: 's', configOptions: [] }
  })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: (next: typeof handler) => { handler = next },
    setNotificationHandler: vi.fn(),
    close: async () => undefined,
  }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('plan-switch-fail'),
  }, 'scope')
  const host: ExternalAgentTurnHost = {
    publish: vi.fn(),
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: ['Approve'] }),
  }
  const turn = {
    turn: turnId('plan-switch-fail'),
    prompt: 'Plan the refactor.',
    permissionMode: 'approval-required' as const,
    nativeMode: 'plan' as const,
    signal: AbortSignal.timeout(1_000),
  }
  expect((await session.runTurn(turn, host)).status).toBe('completed')
  await session.dispose()
})

it('cancels create_plan when the host question fails instead of leaving the native turn hanging', async () => {
  const handler = createCursorAgentInteractionHandler({
    signal: new AbortController().signal,
    publish: async () => undefined,
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => { throw new Error('host failed') },
  })
  await expect(handler('cursor/create_plan', createPlan, 1)).resolves.toEqual({ outcome: { outcome: 'cancelled' } })
})

it('answers an unknown cursor method with cancelled so the native turn does not hang', async () => {
  const handler = createCursorAgentInteractionHandler({
    signal: new AbortController().signal,
    publish: async () => undefined,
    requestPermission: async () => ({ kind: 'cancel' }),
    requestUserInput: async () => ({ answers: [] }),
  })
  await expect(handler('cursor/unknown_method', {}, 1)).resolves.toEqual({ outcome: { outcome: 'cancelled' } })
})

it('does not keep the stream-start model when a later picker selection is not in the catalog', async () => {
  const VALID_MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const
  let selected = { model: 'grok-4.6' }
  const provider = {
    info: { id: providerId('cursor-agent'), name: 'Cursor' },
    health: { status: 'ready' as const },
    listModels: async () => [
      { id: 'grok-4.6', name: 'Cursor Grok 4.6', supportedModes: [...VALID_MODES] },
    ],
    openSession: async () => ({
      ref: { provider: providerId('cursor-agent'), session: sessionId('s'), nativeSession: sessionId('n') },
      supportedModes: [...VALID_MODES],
      dispose: async () => undefined,
      runTurn: async (_request: { prompt: string }, host: ExternalAgentTurnHost) => {
        await host.requestUserInput({ requestId: optionId('plan-review'), question: '# Plan', options: [optionId('Approve'), optionId('Keep planning')] })
        return { status: 'completed' as const, text: 'ok' }
      },
    }),
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never }, undefined, undefined, {
    isPlanMode: () => true,
    ask: async () => {
      selected = { model: 'composer-2.5' }
      return { answers: [{ id: 'plan-review', selected: ['Approve'] }] }
    },
    setPlanMode: () => undefined,
    resolveSelectedModel: () => selected,
  })
  await expect(async () => {
    for await (const _chunk of adapter.stream({
      provider: 'cursor-agent',
      model: 'grok-4.6',
      sessionId: 's',
      messages: [{ source: { kind: 'user' }, content: 'Plan first.' }],
    })) { /* drain */ }
  }).rejects.toThrow('Cursor model is not enabled: composer-2.5')
  await adapter.dispose()
  await unregister()
})

it('does not carry out the plan when switching to agent fails', async () => {
  const VALID_MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const
  let handler: AcpRequestHandler | undefined
  const prompts: string[] = []
  const setPlanMode = vi.fn()
  const request = vi.fn(async (method: string, params?: unknown, _signal?: AbortSignal): Promise<unknown> => {
    if (method === 'session/set_mode' && isModeParams(params) && params.modeId === 'agent') throw new Error('set_mode failed')
    if (method === 'session/prompt') {
      if (handler === undefined) throw new Error('ACP client handler missing during prompt')
      prompts.push('prompt')
      const result = await handler('cursor/create_plan', createPlan, 7)
      expect(result).toEqual({ outcome: { outcome: 'cancelled' } })
      return { stopReason: 'end_turn' }
    }
    return { sessionId: 'n', configOptions: [] }
  })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: (next: typeof handler) => { handler = next },
    setNotificationHandler: vi.fn(),
    close: async () => undefined,
  }
  const nativeSession = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('s'), 'n', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('plan-revert'),
  }, 'scope')
  const provider = {
    info: { id: providerId('cursor-agent'), name: 'Cursor' },
    health: { status: 'ready' as const },
    listModels: async () => [{ id: 'gpt-5', name: 'GPT 5', supportedModes: [...VALID_MODES] }],
    openSession: async () => nativeSession,
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never }, undefined, undefined, {
    isPlanMode: () => true,
    ask: async () => ({ answers: [{ id: 'plan-review', selected: ['Approve'] }] }),
    setPlanMode,
  })
  for await (const _chunk of adapter.stream({
    provider: 'cursor-agent',
    model: 'gpt-5',
    sessionId: 's',
    messages: [{ source: { kind: 'user' }, content: 'Plan the refactor.' }],
  })) { /* drain */ }
  expect(prompts).toEqual(['prompt'])
  expect(setPlanMode).not.toHaveBeenCalled()
  await adapter.dispose()
  await nativeSession.dispose()
  await unregister()
})
