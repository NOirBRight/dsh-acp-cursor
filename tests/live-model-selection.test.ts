import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import { mountPlugin, runtimeConfig } from './support/mount-plugin.js'

// The provider's activity store lives under DSH_HOME and is read back as the resume
// binding, so keep this file's sessions out of the shared profile directory.
const home = mkdtempSync(join(tmpdir(), 'dsh-acp-live-selection-'))
process.env.DSH_HOME = home
afterAll(() => { rmSync(home, { recursive: true, force: true }) })

const STATE_DIRECTORY = '/tmp/acp-live-selection'
const SUPPORTED_MODES = ['approval-required', 'auto-accept-edits', 'full-access']
/** Native Cursor model ids the fake provider opened, in call order. */
const opened = vi.hoisted(() => ({ models: [] as string[] }))

vi.mock('../src/activity-binding.js', () => ({ installActivityBindingGuard: vi.fn() }))
vi.mock('../src/rpc.js', () => ({ registerAcpSettingsRpc: vi.fn() }))
vi.mock('../src/plugin.js', () => ({
  installCursorAgentProvider: (services: { externalAgents: { register(provider: unknown): () => void } }) => {
    const provider = {
      info: { id: 'cursor-agent', name: 'Cursor' },
      health: { status: 'ready' },
      validateInstallation: async () => ({}),
      listModels: async () => [
        { id: 'grok-4.6', name: 'Cursor Grok 4.6', supportedModes: [...SUPPORTED_MODES] },
        { id: 'grok-4.6-high', name: 'Cursor Grok 4.6 High', supportedModes: [...SUPPORTED_MODES] },
        { id: 'composer-2.5', name: 'Composer 2.5', supportedModes: [...SUPPORTED_MODES] },
      ],
      openSession: async (request: { route: { model: string }, session: string }) => {
        opened.models.push(String(request.route.model))
        return {
          ref: { provider: 'cursor-agent', session: request.session, nativeSession: 'native-' + String(request.route.model) },
          supportedModes: [...SUPPORTED_MODES],
          dispose: async () => undefined,
          runTurn: async () => ({ status: 'completed' as const, text: 'ok' }),
        }
      },
    }
    services.externalAgents.register(provider)
    return { provider, dispose: async () => undefined }
  },
}))

/** One modelSelection projection entry. */
type Selection = { provider: string; model: string; reasoningEffort?: string }
/** The projection's internal state; `stateOf` serves this shape, not the serialized view. */
type Projection = { lastUsed?: Selection | null; pending?: Selection | null }
/** The Agent's own route, the default it was created with. */
type AgentRoute = Partial<Selection>

/** Mount the plugin with the given Agent route and modelSelection projection, then run one turn. */
async function runTurn(input: {
  session: string
  state: Projection
  route: AgentRoute
  model: string
}): Promise<{ status: 'resolved' | 'rejected'; error?: string }> {
  const base = runtimeConfig(STATE_DIRECTORY)
  const { adapter, deps } = await mountPlugin(name => {
    if (name === 'agents') return { get: () => ({ session: {}, options: input.route }) }
    if (name === 'sessionProjections') return { stateOf: () => input.state }
    return undefined
  }, base)
  await deps.applyConfig({ ...base, catalogOrder: ['grok-4.6', 'composer-2.5'] })
  try {
    for await (const _chunk of adapter.stream({
      provider: 'cursor-agent',
      model: input.model,
      sessionId: input.session,
      messages: [{ source: { kind: 'user' }, content: '继续' }],
    })) { /* drain */ }
    return { status: 'resolved' }
  } catch (error) {
    return { status: 'rejected', error: error instanceof Error ? error.message : String(error) }
  }
}

it('opens a native turn with the committed Cursor selection, not the route model', async () => {
  opened.models.length = 0
  const result = await runTurn({
    session: 'live-selection-route',
    state: { lastUsed: { provider: 'cursor-agent', model: 'grok-4.6', reasoningEffort: 'high' }, pending: null },
    route: { provider: 'grok', model: 'composer-2.5' },
    model: 'composer-2.5',
  })
  expect(result).toEqual({ status: 'resolved' })
  expect(opened.models).toEqual(['grok-4.6-high'])
})

it('refuses a live selection that belongs to another provider', async () => {
  const result = await runTurn({
    session: 'live-selection-guard',
    state: { lastUsed: { provider: 'cursor-agent', model: 'grok-4.6' }, pending: { provider: 'deepseek', model: 'deepseek-chat' } },
    route: { provider: 'grok', model: 'grok-4.6' },
    model: 'grok-4.6',
  })
  expect(result).toEqual({ status: 'rejected', error: 'Cursor native turn refused: deepseek/deepseek-chat' })
})

it('prefers a Cursor picker change over the selection already in use', async () => {
  opened.models.length = 0
  const result = await runTurn({
    session: 'live-selection-pending',
    state: { lastUsed: { provider: 'cursor-agent', model: 'grok-4.6' }, pending: { provider: 'cursor-agent', model: 'composer-2.5' } },
    route: { provider: 'grok', model: 'grok-4.6' },
    model: 'grok-4.6',
  })
  expect(result).toEqual({ status: 'resolved' })
  expect(opened.models).toEqual(['composer-2.5'])
})

it('keeps the route model when the session has no committed selection', async () => {
  opened.models.length = 0
  const result = await runTurn({
    session: 'live-selection-fresh',
    state: { lastUsed: null, pending: null },
    route: { provider: 'grok', model: 'grok-4.6' },
    model: 'grok-4.6',
  })
  expect(result).toEqual({ status: 'resolved' })
  expect(opened.models).toEqual(['grok-4.6-high'])
})
