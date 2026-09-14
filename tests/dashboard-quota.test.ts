import { describe, expect, it } from 'vitest'
import { quotaFromDashboardPayloads } from '../src/dashboard-quota.js'

describe('dashboard quota mapping', () => {
  it('maps percent-used plan windows to remainingFraction without inventing extras', () => {
    const snap = quotaFromDashboardPayloads({}, {
      billingCycleEnd: '2026-09-30T00:00:00.000Z',
      individualUsage: { plan: { autoPercentUsed: 25, apiPercentUsed: 10 } },
    }, '2026-09-10T00:00:00.000Z')
    expect(snap.status).toBe('ready')
    expect(snap.groups[0]?.buckets).toHaveLength(2)
    expect(snap.groups[0]?.buckets[0]?.remainingFraction).toBe(0.75)
    expect(snap.groups[0]?.buckets[1]?.remainingFraction).toBe(0.9)
    expect(snap.tier).toBeUndefined()
  })

  it('returns not-entitled with no buckets when payloads have no remaining figures', () => {
    const snap = quotaFromDashboardPayloads({ 'gpt-4': { numRequests: 0 } }, {}, '2026-09-10T00:00:00.000Z')
    expect(snap.status).toBe('not-entitled')
    expect(snap.groups).toEqual([])
  })
})
