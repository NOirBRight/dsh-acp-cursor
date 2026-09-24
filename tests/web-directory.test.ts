import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/web/index.ts'

vi.mock('../src/web/NativeTurnContainer.tsx', () => ({ NativeTurnContainer: () => null }))

type EntrySpec = {
  name?: unknown
  key?: unknown
  inject?: (...args: string[]) => Record<string, unknown>
}

function registrationBench() {
  const entries: Array<{ spec: EntrySpec; component: unknown }> = []
  const registerProvider = vi.fn((_declaration: { account: () => { state: string } }) => vi.fn())
  const rpcCall = vi.fn()
  const effect = (register: () => unknown) => register()
  const ctx = {
    locale: { register: vi.fn(() => vi.fn()), bind: vi.fn(() => (key: string) => key) },
    slots: {
      inject: (_name: string, register: () => unknown) => register(),
      register: (spec: EntrySpec, component: unknown) => { entries.push({ spec, component }); return vi.fn() },
      entries: () => [],
      subscribe: () => () => undefined,
    },
    connection: { rpc: { call: rpcCall } },
    uiConversation: { events: { register: () => vi.fn() } },
    get: () => ({ invalidateUsage: vi.fn(), update: vi.fn() }),
    inject: (_dependencies: string[], callback: (scope: object) => unknown) => callback({ providerDirectory: { register: registerProvider }, effect }),
    effect,
  }
  apply(ctx as never)
  return { entries, registerProvider, rpcCall }
}

describe('Cursor Agent directory account and binding', () => {
  it('publishes the native binding descriptor', () => {
    const { registerProvider } = registrationBench()
    expect(registerProvider).toHaveBeenCalledWith(expect.objectContaining({
      key: 'cursor-agent',
      role: 'agent',
      catalogId: 'cursor-agent',
      binding: { channel: 'plugin-rpc/cursor', endpoint: 'activity/binding' },
    }))
  })

  it('resolves overview account from the settings snapshot, not quota', async () => {
    const { entries, registerProvider, rpcCall } = registrationBench()
    const account = (registerProvider.mock.calls[0]?.[0] as { account: () => { state: string } }).account
    expect(account()).toEqual({ state: 'unknown' })
    const face = (entries[0]!.spec.inject as () => { load: () => Promise<unknown>; quota: () => Promise<unknown>; run: (action: string) => Promise<unknown> })()
    const row = { provider: 'cursor-agent', instanceId: 'default', title: 'Cursor', enabled: true, executablePath: '/cursor', harnessPath: '/harness', stateDirectory: '/profile', models: [], installed: true, authenticated: true, live: false, ready: true }
    rpcCall.mockResolvedValueOnce({ ok: true, value: { title: 'External Agents', rows: [row] } })
    await face.load()
    expect(account()).toEqual({ state: 'connected' })
    rpcCall.mockResolvedValueOnce({ ok: true, value: { status: 'ready', observedAt: '2026-09-06T03:00:00Z', groups: [] } })
    await face.quota()
    expect(account()).toEqual({ state: 'connected' })
    rpcCall.mockResolvedValueOnce({ ok: true, value: {} })
    await face.run('sign-out')
    expect(account()).toEqual({ state: 'unconnected' })
  })
})
