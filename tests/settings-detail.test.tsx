import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CursorAgentCardBody, type CursorAgentCardBodyProps } from '../src/web/ExternalAgentsSection.tsx'
import { providerDetailCopy, type ProviderDetailProps } from 'dsh-llm-providers-ui/provider-detail'

vi.mock('dsh-llm-providers-ui/model-catalog', async importOriginal => ({
  ...await importOriginal<typeof import('dsh-llm-providers-ui/model-catalog')>(),
  ModelPickerDialog: () => <div data-model-picker="mounted" />,
}))

it('keeps login actions inside account card, mounts picker in detail and hides signed-out quota', () => {
  let detail: ProviderDetailProps | undefined
  const row = { provider: 'cursor-agent', instanceId: 'default', title: 'Cursor', enabled: true, executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', models: [], installed: true, authenticated: false, live: false, ready: false }
  const props: CursorAgentCardBodyProps = {
    row, snapshot: { title: 'External Agents', rows: [row] }, state: 'login', t: key => key,
    quotaLoading: false, working: false, polling: false, saving: false, dirty: false,
    onAction: vi.fn(), onRefresh: vi.fn(), onRefreshModels: async () => [], onRefreshQuota: vi.fn(), onCatalogChange: vi.fn(), onPersist: vi.fn(), onDiscard: vi.fn(),
    mode: 'detail', detailCopy: providerDetailCopy.en,
    sharedUsage: { status: 'ready', windows: [{ id: 'stale', label: 'Stale quota', remainingPercent: 45, valueText: '45%' }] },
    sharedTemplate: value => { detail = value; return <section>{value.account?.actions}</section> },
  }
  const html = renderToStaticMarkup(<CursorAgentCardBody {...props} />)
  expect(html).toContain('signIn')
  expect(html).toContain('data-model-picker="mounted"')
  expect(detail?.quota.status).toBe('logged-out')
  expect(detail?.quota.windows).toEqual([])
})

it('does not force every catalog row open; chevrons follow the expanded set', () => {
  let detail: ProviderDetailProps | undefined
  const row = {
    provider: 'cursor-agent', instanceId: 'default', title: 'Cursor', enabled: true,
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp',
    models: [{ id: 'composer-2.5', name: 'Composer 2.5' }, { id: 'kimi-k3', name: 'Kimi K3' }],
    installed: true, authenticated: true, live: true, ready: true,
  }
  const props: CursorAgentCardBodyProps = {
    row, snapshot: { title: 'External Agents', rows: [row] }, state: 'connected', t: key => key,
    quotaLoading: false, working: false, polling: false, saving: false, dirty: false,
    onAction: vi.fn(), onRefresh: vi.fn(), onRefreshModels: async () => [], onRefreshQuota: vi.fn(), onCatalogChange: vi.fn(), onPersist: vi.fn(), onDiscard: vi.fn(),
    mode: 'detail', detailCopy: providerDetailCopy.en,
    sharedTemplate: value => { detail = value; return <section /> },
  }
  renderToStaticMarkup(<CursorAgentCardBody {...props} />)
  expect(detail?.models?.allOpen).toBe(false)
  expect(detail?.models?.expanded).toEqual([])
})
