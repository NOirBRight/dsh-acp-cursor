/** Plugin-level regression for a failing activity flush during mount.
 *
 * The bridge now resets its runner even when the flush fails, and the plugin's
 * mount guard must be released either way: if a failed reset left the guard set,
 * every later configuration change would be refused with "configuration is
 * changing" and the provider could never be remounted.
 */
import { expect, it, vi } from 'vitest'
import { apply, type DshPluginContext } from '../src/dsh-plugin.js'
import { registerAcpSettingsRpc } from '../src/rpc.js'

const bridgeState = vi.hoisted(() => ({ failReset: false, resets: 0 }))

vi.mock('../src/activity-binding.js', () => ({ installActivityBindingGuard: vi.fn() }))
vi.mock('../src/rpc.js', () => ({ registerAcpSettingsRpc: vi.fn() }))
vi.mock('../src/plugin.js', () => ({
  installCursorAgentProvider: () => ({
    provider: {
      info: { id: 'cursor-agent', name: 'Cursor' },
      health: { status: 'ready' },
      validateInstallation: async () => ({}),
      listModels: async () => [],
    },
    dispose: async () => undefined,
  }),
}))
vi.mock('../src/llm-bridge.js', () => ({
  createCursorAgentLlmBridge: () => ({
    reset: async () => {
      bridgeState.resets += 1
      if (bridgeState.failReset) throw new Error('Unable to persist CursorAgent activity; native execution stopped.')
    },
    dispose: async () => undefined,
  }),
}))

it('releases the mount guard after a failed bridge reset so the next mount proceeds', async () => {
  const handle = Object.assign(vi.fn(), { replace: vi.fn() })
  const registerAdapter = vi.fn((_providers: string[], _adapter: unknown) => handle)
  const effect = (fn: () => unknown) => { fn() }
  const scope = { effect, llm: { registerAdapter }, connection: { rpc: { handle: vi.fn() } } }
  const ctx = { ...scope, get: () => undefined, on: vi.fn(), inject: (_deps: string[], fn: (value: typeof scope) => void) => fn(scope) }
  await apply(ctx as unknown as DshPluginContext)
  const rpc = vi.mocked(registerAcpSettingsRpc).mock.calls[0]![1]
  const base = { executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp-mount-reset', instanceId: 'default', enabled: true, catalogOrder: [] }

  bridgeState.failReset = true
  await expect(rpc.applyConfig({ ...base, model: 'gpt-5' })).rejects.toThrow('Unable to persist CursorAgent activity; native execution stopped.')

  // The guard was released, so a later runtime change mounts instead of being
  // refused while the adapter is unrecoverable.
  bridgeState.failReset = false
  await expect(rpc.applyConfig({ ...base, model: 'gpt-5-low' })).resolves.toBeUndefined()
  expect(bridgeState.resets).toBe(2)
})
