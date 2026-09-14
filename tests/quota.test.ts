import { beforeEach, expect, it, vi } from 'vitest'
import { createCursorAgentQuotaReader } from '../src/quota.js'
import { readCursorCliToken } from '../src/cli-token.js'
import { readCursorDashboardQuota } from '../src/dashboard-quota.js'
import type { CursorAgentQuotaSnapshot } from '../src/client-contract.js'

vi.mock('../src/cli-token.js', () => ({ readCursorCliToken: vi.fn() }))
vi.mock('../src/dashboard-quota.js', () => ({ readCursorDashboardQuota: vi.fn() }))
const ready: CursorAgentQuotaSnapshot = { status: 'ready', groups: [], observedAt: '2026-09-12T00:00:00Z' }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(readCursorCliToken).mockResolvedValue({ accessToken: 'cli-token-a', userId: 'same-user' }); vi.mocked(readCursorDashboardQuota).mockResolvedValue(ready) })

it('never reads ambient credentials or quota when ACP is signed out', async () => {
  const reader = createCursorAgentQuotaReader(() => false)
  expect((await reader.snapshot()).status).toBe('authentication-required')
  expect(readCursorCliToken).not.toHaveBeenCalled()
  expect(readCursorDashboardQuota).not.toHaveBeenCalled()
})

it('invalidates on token rotation even for the same user', async () => {
  const reader = createCursorAgentQuotaReader(() => true)
  await reader.snapshot(); await reader.snapshot()
  expect(readCursorDashboardQuota).toHaveBeenCalledTimes(1)
  vi.mocked(readCursorCliToken).mockResolvedValue({ accessToken: 'cli-token-b', userId: 'same-user' })
  await reader.snapshot()
  expect(readCursorDashboardQuota).toHaveBeenCalledTimes(2)
})

it('drops a late quota response after logout and coalesces concurrent reads', async () => {
  let authenticated = true
  let complete!: (value: CursorAgentQuotaSnapshot) => void
  vi.mocked(readCursorDashboardQuota).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const reader = createCursorAgentQuotaReader(() => authenticated)
  const first = reader.snapshot(), second = reader.snapshot()
  await vi.waitFor(() => expect(readCursorDashboardQuota).toHaveBeenCalledTimes(1))
  authenticated = false
  reader.invalidate()
  complete(ready)
  expect((await first).status).toBe('authentication-required')
  expect((await second).status).toBe('authentication-required')
})
