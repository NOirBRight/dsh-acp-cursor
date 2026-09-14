/** Read-only Cursor dashboard quota. Missing fields stay absent; never fill 0. */
import type { CursorAgentQuotaSnapshot } from './client-contract.js'
import type { CursorCliToken } from './cli-token.js'

const AUTH_USAGE = 'https://api2.cursor.sh/auth/usage'
const USAGE_SUMMARY = 'https://cursor.com/api/usage-summary'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function remainingFromUsedLimit(used: number, limit: number | undefined): number | undefined {
  if (limit === undefined || limit <= 0 || used < 0) return undefined
  const left = (limit - used) / limit
  if (!Number.isFinite(left)) return undefined
  return Math.min(1, Math.max(0, left))
}

export function quotaFromDashboardPayloads(authUsage: unknown, summary: unknown, observedAt: string): CursorAgentQuotaSnapshot {
  const buckets: { displayName: string; remainingFraction: number; resetTime?: string }[] = []
  const reset = isRecord(summary) && typeof summary.billingCycleEnd === 'string' && Number.isFinite(Date.parse(summary.billingCycleEnd))
    ? new Date(summary.billingCycleEnd).toISOString()
    : undefined
  if (isRecord(summary) && isRecord(summary.individualUsage)) {
    const individual = summary.individualUsage
    const plan = isRecord(individual.plan) ? individual.plan : undefined
    const auto = plan === undefined ? undefined : toNumber(plan.autoPercentUsed)
    const api = plan === undefined ? undefined : toNumber(plan.apiPercentUsed)
    if (auto !== undefined) {
      const remaining = remainingFromUsedLimit(auto, 100)
      if (remaining !== undefined) buckets.push({ displayName: 'Cursor Models', remainingFraction: remaining, ...(reset === undefined ? {} : { resetTime: reset }) })
    }
    if (api !== undefined) {
      const remaining = remainingFromUsedLimit(api, 100)
      if (remaining !== undefined) buckets.push({ displayName: 'Other Models', remainingFraction: remaining, ...(reset === undefined ? {} : { resetTime: reset }) })
    }
  }
  if (buckets.length === 0 && isRecord(authUsage)) {
    for (const [key, value] of Object.entries(authUsage)) {
      if (!isRecord(value)) continue
      const used = toNumber(value.numRequests) ?? toNumber(value.used)
      const limit = toNumber(value.maxRequestUsage) ?? toNumber(value.limit)
      if (used === undefined || limit === undefined || limit <= 0) continue
      if (used === 0 && limit === 0) continue
      const remaining = remainingFromUsedLimit(used, limit)
      if (remaining === undefined) continue
      buckets.push({ displayName: key, remainingFraction: remaining, ...(reset === undefined ? {} : { resetTime: reset }) })
    }
  }
  if (buckets.length === 0) {
    return {
      status: 'not-entitled',
      groups: [],
      observedAt,
      message: 'Cursor did not return remaining quota.',
    }
  }
  return {
    status: 'ready',
    observedAt,
    groups: [{ displayName: 'Cursor', buckets }],
  }
}

async function readJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { headers, redirect: 'error', ...(signal === undefined ? {} : { signal }) })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('quota HTTP ' + String(response.status))
  }
  return await response.json()
}

export async function readCursorDashboardQuota(token: CursorCliToken, signal?: AbortSignal): Promise<CursorAgentQuotaSnapshot> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: 'Bearer ' + token.accessToken,
  }
  const cookie = token.userId === undefined ? undefined : 'WorkosCursorSessionToken=' + encodeURIComponent(token.userId + '::' + token.accessToken)
  const sessionHeaders: Record<string, string> = {
    accept: 'application/json',
    ...(cookie === undefined ? {} : { cookie }),
  }
  let authUsage: unknown
  let summary: unknown
  let authFailed = false
  let summaryFailed = false
  try {
    authUsage = await readJson(AUTH_USAGE, headers, signal)
  } catch (error) {
    if (isAbort(error)) throw error
    if (isUnauthorized(error)) return { status: 'authentication-required', groups: [], observedAt: new Date().toISOString() }
    authFailed = true
  }
  try {
    summary = cookie === undefined ? undefined : await readJson(USAGE_SUMMARY, sessionHeaders, signal)
  } catch (error) {
    if (isAbort(error)) throw error
    if (isUnauthorized(error)) return { status: 'authentication-required', groups: [], observedAt: new Date().toISOString() }
    summaryFailed = true
  }
  const mapped = quotaFromDashboardPayloads(authUsage, summary, new Date().toISOString())
  if (mapped.status === 'not-entitled' && (authFailed || summaryFailed)) {
    return { status: 'error', groups: [], observedAt: mapped.observedAt, message: 'Cursor quota request failed.' }
  }
  return mapped
}

function isAbort(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError'
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && /quota HTTP 401$/.test(error.message)
}
