import { expect, it, vi } from 'vitest'
import { apply, type DshPluginContext } from '../src/dsh-plugin.js'
import { registerAcpSettingsRpc } from '../src/rpc.js'

vi.mock('../src/activity-binding.js', () => ({ installActivityBindingGuard: vi.fn() }))
vi.mock('../src/rpc.js', () => ({ registerAcpSettingsRpc: vi.fn() }))
vi.mock('../src/plugin.js', () => ({ installCursorAgentProvider: () => ({
  provider: {
    info: { id: 'cursor-agent', name: 'Cursor' }, health: { status: 'ready' },
    validateInstallation: async () => ({}),
    listModels: async () => [{ id: 'gpt-5-high', name: 'GPT 5 High' }, { id: 'gpt-5-low', name: 'GPT 5 Low' }],
  }, dispose: async () => undefined,
}) }))

it('re-announces saved membership to Host and returns it on the first cold catalog request', async () => {
  const handle = Object.assign(vi.fn(), { replace: vi.fn() })
  const registerAdapter = vi.fn((_providers: string[], _adapter: unknown) => handle)
  const effect = (fn: () => unknown) => { fn() }
  const scope = { effect, llm: { registerAdapter }, connection: { rpc: { handle: vi.fn() } } }
  const ctx = { ...scope, get: () => undefined, on: vi.fn(), inject: (_deps: string[], fn: (value: typeof scope) => void) => fn(scope) }
  await apply(ctx as unknown as DshPluginContext)
  const rpc = vi.mocked(registerAcpSettingsRpc).mock.calls[0]![1]
  const initialNotifications = handle.replace.mock.calls.length
  await rpc.applyConfig({ executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp-test', instanceId: 'default', enabled: true, catalogOrder: ['gpt-5'] })
  expect(handle.replace.mock.calls.length).toBeGreaterThan(initialNotifications)
  expect(handle.replace).toHaveBeenLastCalledWith(['cursor-agent'])
  const adapter = registerAdapter.mock.calls[0]?.[1] as unknown as {listModels(provider: string): Promise<{id:string}[]>; providerInfo(provider: string): {id:string; name:string}}
  expect(adapter.providerInfo('cursor-agent')).toEqual({id:'cursor-agent',name:'Cursor'})
  expect((await adapter.listModels('cursor-agent')).map(model => model.id)).toEqual(['gpt-5'])
  await rpc.applyConfig({ executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp-test', instanceId: 'default', enabled: true, catalogOrder: [] })
  expect(await adapter.listModels('cursor-agent')).toEqual([])
})
