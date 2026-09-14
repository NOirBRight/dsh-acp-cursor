/** Quota belongs to the authenticated ACP account, not ambient LLM credentials. */
import { createHash } from 'node:crypto'
import type { CursorAgentQuotaSnapshot } from './client-contract.js'
import { readCursorCliToken } from './cli-token.js'
import { readCursorDashboardQuota } from './dashboard-quota.js'

export type CursorAgentQuotaReader = ReturnType<typeof createCursorAgentQuotaReader>

export function createCursorAgentQuotaReader(isAuthenticated: () => boolean) {
  let cached: { key: string; expiresAt: number; value: CursorAgentQuotaSnapshot } | undefined
  let inflight: { key: string; controller: AbortController; work: Promise<CursorAgentQuotaSnapshot> } | undefined
  let generation = 0
  const loggedOut = (): CursorAgentQuotaSnapshot => ({ status: 'authentication-required', groups: [], observedAt: new Date().toISOString() })
  const invalidate = (): void => {
    generation++
    cached = undefined
    inflight?.controller.abort()
    inflight = undefined
  }
  return {
    invalidate,
    async snapshot(signal?: AbortSignal): Promise<CursorAgentQuotaSnapshot> {
      signal?.throwIfAborted()
      if (!isAuthenticated()) { invalidate(); return loggedOut() }
      const started = generation
      const token = await readCursorCliToken()
      if (started !== generation || !isAuthenticated() || token === undefined) return loggedOut()
      const key = createHash('sha256').update(token.accessToken).digest('hex')
      if (cached?.key === key && cached.expiresAt > Date.now()) return cached.value
      if (inflight !== undefined && inflight.key !== key) { invalidate(); return this.snapshot(signal) }
      if (inflight === undefined) {
        const controller = new AbortController()
        const work = (async () => {
          try {
            const value = await readCursorDashboardQuota(token, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
            const current = await readCursorCliToken()
            if (started !== generation || !isAuthenticated() || current?.accessToken !== token.accessToken) return loggedOut()
            if (value.status === 'ready') cached = { key, expiresAt: Date.now() + 30_000, value }
            return value
          } catch (error) {
            if (started !== generation || !isAuthenticated()) return loggedOut()
            throw error
          }
        })().finally(() => { if (inflight?.work === work) inflight = undefined })
        inflight = { key, controller, work }
      }
      const work = inflight.work
      if (signal === undefined) return work
      return new Promise((resolve, reject) => {
        const abort = (): void => { reject(signal.reason) }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
        void work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
      })
    },
  }
}
