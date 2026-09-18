import { expect, it, vi } from 'vitest'
import { modelId, providerId, providerInstanceId, sessionId, turnId, type ExternalAgentTurnHost } from '@deepseek-ai/dsh-acp-provider'
import { CursorAgentSession } from '../src/session.js'
import { discoverCursorAcpModels, selectCursorAcpModel } from '../src/model-config.js'
import { nativeCursorAgentModelId, pickerGroupsFromCursorCatalog } from '../src/catalog.js'
import { cursorAgentClientCapabilities } from '../src/types.js'

const select = (id: string, values: string[], currentValue = values[0]) => ({ id, type: 'select', currentValue, options: values.map(value => ({ value, name: value })) })
const response = { sessionId: 's', configOptions: [select('model', ['claude-opus-5']), select('mode', ['agent', 'ask']), select('context', ['200k', '1m']), select('fast', ['false', 'true']), select('effort', ['low', 'high'])] }

it('discovers and dispatches real ACP context, Fast and effort dimensions', async () => {
  const request = vi.fn(async (method: string, _params?: unknown, _signal?: AbortSignal): Promise<unknown> => method === 'cursor/list_available_models' ? { models: [{value:'claude-opus-5',name:'Claude Opus 5',configOptions:response.configOptions.filter(option => !['model','mode'].includes(option.id))}] } : response)
  const connection = { request }
  const native = await discoverCursorAcpModels(connection)
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('cursor/list_available_models', {}, undefined)
  const rows = pickerGroupsFromCursorCatalog(native)
  expect(cursorAgentClientCapabilities(false)).toMatchObject({ _meta: { parameterizedModelPicker: true } })
  expect(rows.map(row => row.id)).toEqual(expect.arrayContaining(['claude-opus-5', 'claude-opus-5-1m', 'claude-opus-5-fast', 'claude-opus-5-fast-1m']))
  expect(rows.find(row => row.id === 'claude-opus-5-fast-1m')?.contextWindow).toBe(1_000_000)
  const selected = nativeCursorAgentModelId('claude-opus-5-fast-1m', 'high', native.map(model => String(model.id)), native)
  request.mockClear()
  await selectCursorAcpModel(connection, response, selected)
  expect(request.mock.calls.map(call => call[1])).toEqual([
    {sessionId:'s',configId:'model',value:'claude-opus-5'},
    {sessionId:'s',configId:'context',value:'1m'},
    {sessionId:'s',configId:'effort',value:'high'},
    {sessionId:'s',configId:'fast',value:'true'},
  ])
  await expect(selectCursorAcpModel(connection, response, 'claude-opus-5[context=2m]')).rejects.toThrow('unavailable')
})

it('uses published defaults only when Cursor documents the family, otherwise unknown', () => {
  const rows = pickerGroupsFromCursorCatalog([
    { id: 'composer-2.5[fast=false]', name: 'Composer 2.5' },
    { id: 'grok-4.6[fast=true,reasoning=high]', name: 'Cursor Grok 4.6' },
    { id: 'kimi-k3[reasoning=max]', name: 'Kimi K3' },
  ])
  expect(rows.find(row => row.id === 'composer-2.5')).toMatchObject({ contextWindow: 200_000, sources: { contextWindow: 'default' } })
  expect(rows.find(row => row.id === 'grok-4.6-fast')).toMatchObject({ contextWindow: 256_000, sources: { contextWindow: 'default' } })
  expect(rows.find(row => row.id === 'kimi-k3')).toMatchObject({ contextWindow: 200_000, sources: { contextWindow: 'default' } })
  expect(rows.find(row => row.id === 'kimi-k3-1m')).toMatchObject({ name: 'Kimi K3 Max', contextWindow: 1_000_000, sources: { contextWindow: 'default' } })
  expect(rows.find(row => row.id === 'kimi-k3-1m')?.nativeIds).toEqual(['kimi-k3[reasoning=max]'])
})

it('does not send an unadvertised context value when selecting a documented Max row', async () => {
  const request = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
    if (method === 'session/set_config_option') return { sessionId: 's', configOptions: [select('model', ['kimi-k3']), select('reasoning', ['low', 'max'], 'max')] }
    return { sessionId: 's', configOptions: [select('model', ['kimi-k3']), select('reasoning', ['low', 'max'], 'max')] }
  })
  await selectCursorAcpModel({ request }, { sessionId: 's', configOptions: [select('model', ['kimi-k3']), select('reasoning', ['low', 'max'], 'max')] }, 'kimi-k3-1m')
  expect(request.mock.calls.map(call => call[1])).toEqual([{ sessionId: 's', configId: 'model', value: 'kimi-k3' }])
})

it('never synthesizes Max or Fast for a legacy ACP variant-only server', () => {
  const native = [{id:'claude-opus-5-thinking-high',name:'Claude Opus 5 High'},{id:'claude-opus-5-thinking-high-fast',name:'Claude Opus 5 High Fast'}]
  expect(pickerGroupsFromCursorCatalog(native).map(row=>row.id)).toEqual(['claude-opus-5','claude-opus-5-fast'])
  expect(nativeCursorAgentModelId('claude-opus-5-fast','high',native.map(row=>row.id),native)).toBe(native[1]?.id)
  expect(()=>nativeCursorAgentModelId('claude-opus-5-1m','high',native.map(row=>row.id),native)).toThrow('unavailable')
})

it('keeps Fast Max parameters on the actual first and subsequent turns', async () => {
  const request = vi.fn(async (method: string, _params?: unknown): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : response)
  const connection = { request, notify: vi.fn(), setRequestHandler: vi.fn(), setNotificationHandler: vi.fn(), close: async () => undefined }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', { executablePath:'/bin/cursor-agent', harnessPath:'', stateDirectory:'/tmp/acp', instanceId:providerInstanceId('test') }, 'scope')
  const host: ExternalAgentTurnHost = { publish: vi.fn(), requestPermission: async () => ({kind:'cancel'}), requestUserInput: async () => ({answers:[]}) }
  const turn = { turn:turnId('first'), model:modelId('claude-opus-5[context=1m,effort=high,fast=true]'), prompt:'test', permissionMode:'approval-required' as const, signal:new AbortController().signal }
  expect((await session.runTurn(turn,host)).status).toBe('completed')
  const configured = request.mock.calls.filter(call=>call[0]==='session/set_config_option').map(call=>call[1])
  expect(configured).toEqual([
    {sessionId:'s',configId:'model',value:'claude-opus-5'},
    {sessionId:'s',configId:'context',value:'1m'},
    {sessionId:'s',configId:'effort',value:'high'},
    {sessionId:'s',configId:'fast',value:'true'},
  ])
  request.mockClear()
  expect((await session.runTurn({...turn,turn:turnId('second')},host)).status).toBe('completed')
  expect(request.mock.calls.some(call=>call[0]==='session/set_config_option')).toBe(false)
  await session.dispose()
})

it('applies a later model selection on a plan-mode turn', async () => {
  const request = vi.fn(async (method: string, _params?: unknown): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : response)
  const connection = { request, notify: vi.fn(), setRequestHandler: vi.fn(), setNotificationHandler: vi.fn(), close: async () => undefined }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', { executablePath:'/bin/cursor-agent', harnessPath:'', stateDirectory:'/tmp/acp', instanceId:providerInstanceId('plan-model') }, 'scope')
  const host: ExternalAgentTurnHost = { publish: vi.fn(), requestPermission: async () => ({kind:'cancel'}), requestUserInput: async () => ({answers:[]}) }
  const turn = {
    turn: turnId('plan-first'),
    model: modelId('claude-opus-5'),
    prompt: 'plan',
    permissionMode: 'approval-required' as const,
    nativeMode: 'plan' as const,
    signal: new AbortController().signal,
  }
  expect((await session.runTurn(turn, host)).status).toBe('completed')
  request.mockClear()
  expect((await session.runTurn({
    ...turn,
    turn: turnId('plan-second'),
    model: modelId('claude-opus-5[context=1m,effort=high,fast=true]'),
  }, host)).status).toBe('completed')
  expect(request.mock.calls.filter(call => call[0] === 'session/set_config_option').map(call => call[1])).toEqual([
    {sessionId:'s',configId:'model',value:'claude-opus-5'},
    {sessionId:'s',configId:'context',value:'1m'},
    {sessionId:'s',configId:'effort',value:'high'},
    {sessionId:'s',configId:'fast',value:'true'},
  ])
  expect(request.mock.calls.filter(call => call[0] === 'session/set_mode').map(call => call[1])).toEqual([
    { sessionId: 's', modeId: 'plan' },
  ])
  await session.dispose()
})
