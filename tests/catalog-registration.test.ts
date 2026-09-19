import { expect, it, vi } from 'vitest'
import { mountPlugin, runtimeConfig } from './support/mount-plugin.js'

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
  const { adapter, handle, deps } = await mountPlugin()
  const initialNotifications = handle.replace.mock.calls.length
  await deps.applyConfig(runtimeConfig('/tmp/acp-test', { catalogOrder: ['gpt-5'] }))
  expect(handle.replace.mock.calls.length).toBeGreaterThan(initialNotifications)
  expect(handle.replace).toHaveBeenLastCalledWith(['cursor-agent'])
  expect(adapter.providerInfo('cursor-agent')).toEqual({id:'cursor-agent',name:'Cursor'})
  expect((await adapter.listModels('cursor-agent')).map(model => model.id)).toEqual(['gpt-5'])
  await deps.applyConfig(runtimeConfig('/tmp/acp-test', { catalogOrder: [] }))
  expect(await adapter.listModels('cursor-agent')).toEqual([])
})
