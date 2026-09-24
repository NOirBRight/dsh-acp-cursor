/** Normalize the provider-owned account quota RPC for the shared usage directory. */
import type { ProviderUsageReader } from 'dsh-llm-providers-ui/usage-readers'
import { callCursorPluginRpc, QUOTA_ENDPOINT, decodeQuotaSnapshot } from '../client-contract.js'

/** One-decimal remaining percent shared by the card header, body, and sidebar writer. */
export function headlineRemainingPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10
}

export function createCursorAgentUsageReader(): ProviderUsageReader {
  return { providerKey: 'cursor-agent', name: 'Cursor', async read(rpc, _refresh, signal) {
    const result = await callCursorPluginRpc(rpc, QUOTA_ENDPOINT, {}, signal)
    if (!result.ok) return { status: 'error', message: result.error.message }
    const quota = decodeQuotaSnapshot(result.value)
    if (quota === undefined) return { status: 'error', message: 'Invalid Cursor quota response' }
    if (quota.status === 'authentication-required' || quota.status === 'account-changed') return { status: 'logged-out' }
    if (quota.status === 'not-entitled') return { status: 'unsupported' }
    if (quota.status !== 'ready') return { status: 'error', ...(quota.message === undefined ? {} : { message: quota.message }) }
    const resetsPrefix = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? '重置时间 ' : 'Resets '
    return {
      status: 'ready', fetchedAt: quota.observedAt,
      windows: quota.groups.flatMap((group, gi) => group.buckets.flatMap((bucket, bi) => {
        if (bucket.disabled || bucket.remainingFraction === undefined) return []
        const remaining = headlineRemainingPercent(bucket.remainingFraction)
        const label = bucket.displayName ?? bucket.window ?? group.displayName ?? 'Cursor'
        const resetsAt = bucket.resetTime === undefined ? undefined : resetsPrefix + new Date(bucket.resetTime).toLocaleString()
        return [{
          id: bucket.bucketId ?? String(gi) + ':' + String(bi), label, shortLabel: label,
          valueText: String(remaining) + '%', remainingPercent: remaining,
          ...(resetsAt === undefined ? {} : { resetsAt }),
        }]
      })),
    }
  } }
}
