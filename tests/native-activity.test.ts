import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVITY_ENDPOINT,
  ACTIVITY_READ_AFTER_ENDPOINT,
  ACTIVITY_SCHEMA_VERSION,
  ACTIVITY_STALE_CURSOR,
  decodeActivityHistory,
  decodeActivityPage,
} from '../src/activity-contract.ts'
import {
  NATIVE_HISTORY_MAX_FOLLOW_UP_PAGES,
  NATIVE_HISTORY_POLL_MS,
  applyActivityRecords,
  createNativeActivityFoldState,
  foldActivityRecords,
  foldAgentRecords,
  foldAgentTextRecords,
  getNativeHistoryStore,
  type ActivityRpc,
} from '../src/web/native-activity.ts'

const SESSION = 'session-1'

type Reply = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

function rpcFace(reply: (endpoint: string) => Reply): { rpc: ActivityRpc; calls: Array<{ endpoint: string; payload: unknown }> } {
  const calls: Array<{ endpoint: string; payload: unknown }> = []
  const rpc: ActivityRpc = {
    call: async (_channel, endpoint, payload) => {
      calls.push({ endpoint, payload })
      return reply(endpoint)
    },
  }
  return { rpc, calls }
}

function at(seq: number): string {
  return new Date(Date.UTC(2026, 8, 19, 0, 0, 0, seq)).toISOString()
}

const ready = (seq: number): unknown => ({ seq, time: at(seq), type: 'cursor-agent/session-ready', data: { provider: 'cursor-agent' } })
const start = (seq: number, toolId: string, ownership?: unknown): unknown => ({ seq, time: at(seq), type: 'cursor-agent/tool-start', data: { toolId, name: 'shell', status: 'pending', ...(ownership === undefined ? {} : { ownership }) } })
const update = (seq: number, toolId: string, status: string, ownership?: unknown): unknown => ({ seq, time: at(seq), type: 'cursor-agent/tool-update', data: { toolId, status, ...(ownership === undefined ? {} : { ownership }) } })
const text = (seq: number, value: string, kind: 'text' | 'thought' = 'thought'): unknown => ({ seq, time: at(seq), type: 'cursor-agent/agent-text', data: { trajectoryId: 'traj-1', kind, text: value } })

const owned = { trajectoryId: 'traj-1' }
const history = (records: readonly unknown[]): Reply => ({ ok: true, value: { version: 1, records } })
const page = (records: readonly unknown[], nextCursor: number, hasMore: boolean): Reply => ({ ok: true, value: { version: 1, records, nextCursor, hasMore } })
const stale = (): Reply => ({ ok: false, error: { code: ACTIVITY_STALE_CURSOR, message: 'CursorAgent activity cursor is stale; the history must be reloaded.' } })

/** Drain the promise chain a poll schedules; no timers involved. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve()
}

/** Run the next poll: the store schedules it one poll interval ahead. */
async function pollAgain(): Promise<void> {
  await vi.advanceTimersByTimeAsync(NATIVE_HISTORY_POLL_MS)
  await settle()
}

describe('native history subscription', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('bootstraps once from a full read, then transfers only records after the cursor', async () => {
    const { rpc, calls } = rpcFace(endpoint => endpoint === ACTIVITY_ENDPOINT
      ? history([ready(1), start(2, 't1', owned)])
      : page([update(3, 't1', 'completed')], 3, false))
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    expect(store.getSnapshot().rows.map(row => row.key)).toEqual(['2'])

    await pollAgain()
    expect(store.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'completed']])
    expect(calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(1)
    expect(calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT).map(call => call.payload)).toEqual([
      { sessionId: SESSION, afterSeq: 2 },
    ])
  })

  it('keeps snapshot identity while a poll returns no new records', async () => {
    const { rpc } = rpcFace(endpoint => endpoint === ACTIVITY_ENDPOINT ? history([ready(1), start(2, 't1', owned)]) : page([], 2, false))
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    const first = store.getSnapshot()
    await pollAgain()
    await pollAgain()
    expect(store.getSnapshot()).toBe(first)
  })

  it('retains pending unowned rows and reveals them at their original key once owned', async () => {
    const { rpc } = rpcFace(endpoint => endpoint === ACTIVITY_ENDPOINT
      ? history([ready(1), start(2, 't1')])
      : page([update(3, 't1', 'running', owned)], 3, false))
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    // Unowned pending previews stay out of the transcript but never leave the fold.
    expect(store.getSnapshot().rows).toEqual([])

    await pollAgain()
    expect(store.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'running']])
  })

  it('carries epoch and text merging across page boundaries', async () => {
    const { rpc } = rpcFace(endpoint => {
      if (endpoint === ACTIVITY_ENDPOINT) return history([ready(1), text(2, 'a')])
      return page([text(3, 'b'), text(4, 'c', 'text'), ready(5), text(6, 'd'), start(7, 't2', owned)], 7, false)
    })
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    expect(store.getSnapshot().texts.map(row => row.text)).toEqual(['a'])

    await pollAgain()
    const snapshot = store.getSnapshot()
    // Adjacent same-kind deltas merge across the page boundary; a new kind and a new
    // epoch each start their own row.
    expect(snapshot.texts.map(row => [row.key, row.epoch, row.kind, row.text])).toEqual([
      ['2', 1, 'thought', 'ab'],
      ['4', 1, 'text', 'c'],
      ['6', 2, 'thought', 'd'],
    ])
    expect(snapshot.rows.map(row => [row.key, row.epoch])).toEqual([['7', 2]])
  })

  it('follows bounded pages within one poll', async () => {
    const { rpc, calls } = rpcFace(endpoint => {
      if (endpoint === ACTIVITY_ENDPOINT) return history([ready(1)])
      return calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT).length === 1
        ? page([start(2, 't1', owned)], 2, true)
        : page([update(3, 't1', 'completed')], 3, false)
    })
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    await pollAgain()
    expect(store.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'completed']])
    expect(calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT)).toHaveLength(2)
  })

  it('resynchronizes from a full read when the cursor is stale', async () => {
    let bootstraps = 0
    const { rpc, calls } = rpcFace(endpoint => {
      if (endpoint === ACTIVITY_ENDPOINT) {
        bootstraps += 1
        return bootstraps === 1
          ? history([ready(1), start(2, 't1', owned)])
          : history([ready(1), start(2, 't9', owned), update(3, 't9', 'completed')])
      }
      return stale()
    })
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    expect(store.getSnapshot().rows.map(row => row.state.status)).toEqual(['pending'])
    await pollAgain()
    expect(store.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'completed']])
    expect(store.getSnapshot().error).toBeUndefined()
    expect(calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(2)
  })

  it('resynchronizes when the backlog exceeds the follow-up page budget', async () => {
    let cursor = 3
    const { rpc, calls } = rpcFace(endpoint => {
      if (endpoint === ACTIVITY_ENDPOINT) return history([ready(1), start(2, 't1', owned), update(3, 't1', 'completed')])
      cursor += 1
      return page([start(cursor, 't' + String(cursor), owned)], cursor, true)
    })
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    await pollAgain()
    expect(calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT)).toHaveLength(NATIVE_HISTORY_MAX_FOLLOW_UP_PAGES)
    expect(calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(2)
    expect(store.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'completed']])
  })

  it('surfaces a failed read and recovers on refresh', async () => {
    let failing = true
    const { rpc, calls } = rpcFace(endpoint => {
      if (endpoint === ACTIVITY_ENDPOINT) return failing
        ? { ok: false, error: { code: 'internal', message: 'CursorAgent activity history is unavailable' } }
        : history([ready(1), start(2, 't1', owned)])
      return page([], 0, false)
    })
    const store = getNativeHistoryStore(rpc, SESSION)
    store.subscribe(() => undefined)
    await settle()
    expect(store.getSnapshot()).toMatchObject({ rows: [], error: 'CursorAgent activity history is unavailable' })

    failing = false
    store.refresh()
    await settle()
    expect(store.getSnapshot().error).toBeUndefined()
    expect(store.getSnapshot().rows.map(row => row.key)).toEqual(['2'])
    expect(calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(2)
  })

  it('resets the cursor on unsubscribe so a remount bootstraps again', async () => {
    const { rpc, calls } = rpcFace(endpoint => endpoint === ACTIVITY_ENDPOINT ? history([ready(1), start(2, 't1', owned)]) : page([], 2, false))
    const store = getNativeHistoryStore(rpc, SESSION)
    const unsubscribe = store.subscribe(() => undefined)
    await settle()
    unsubscribe()
    expect(store.getSnapshot().rows).toEqual([])

    store.subscribe(() => undefined)
    await settle()
    expect(store.getSnapshot().rows.map(row => row.key)).toEqual(['2'])
    expect(calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(2)
    expect(calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT)).toHaveLength(0)
  })

  it('drops a bootstrap superseded by unsubscribe so a remount starts clean', async () => {
    const calls: string[] = []
    let release: (() => void) | undefined
    const held = new Promise<void>(resolve => { release = resolve })
    const rpc: ActivityRpc = {
      call: async (_channel, endpoint) => {
        calls.push(endpoint)
        if (calls.length === 1) await held
        return history([ready(1), start(2, 't1', owned)])
      },
    }
    const store = getNativeHistoryStore(rpc, SESSION)
    const unsubscribe = store.subscribe(() => undefined)
    await settle()
    unsubscribe()
    release?.()
    await settle()
    // The superseded read must not resurrect the torn-down fold or its cursor.
    expect(store.getSnapshot().rows).toEqual([])

    store.subscribe(() => undefined)
    await settle()
    expect(calls).toEqual([ACTIVITY_ENDPOINT, ACTIVITY_ENDPOINT])
    expect(store.getSnapshot().rows.map(row => row.key)).toEqual(['2'])
  })

  it('gives a reconnecting connection its own bootstrap', async () => {
    const first = rpcFace(() => history([ready(1), start(2, 't1', owned)]))
    const second = rpcFace(() => history([ready(1), start(2, 't1', owned), update(3, 't1', 'completed')]))
    const store = getNativeHistoryStore(first.rpc, SESSION)
    const unsubscribe = store.subscribe(() => undefined)
    await settle()
    unsubscribe()

    const reconnected = getNativeHistoryStore(second.rpc, SESSION)
    reconnected.subscribe(() => undefined)
    await settle()
    expect(reconnected.getSnapshot().rows.map(row => [row.key, row.state.status])).toEqual([['2', 'completed']])
    expect(second.calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(1)
    expect(first.calls.filter(call => call.endpoint === ACTIVITY_ENDPOINT)).toHaveLength(1)
    expect(first.calls.filter(call => call.endpoint === ACTIVITY_READ_AFTER_ENDPOINT)).toHaveLength(0)
  })
})

describe('retained fold', () => {
  it('matches the pure full-history folds and keeps its rows in state', () => {
    const wire = [ready(1), start(2, 't1'), update(3, 't1', 'running', owned), text(4, 'a'), text(5, 'b')]
    const full = decodeActivityHistory({ version: ACTIVITY_SCHEMA_VERSION, records: wire }).records
    // The pure folds are thin wrappers over one retained reducer, so both paths agree.
    expect(foldActivityRecords(full).map(row => [row.key, row.state.status])).toEqual([['2', 'running']])
    expect(foldAgentTextRecords(full).map(row => row.text)).toEqual(['ab'])
    expect(foldAgentRecords(full)).toEqual([])

    const state = createNativeActivityFoldState()
    applyActivityRecords(state, decodeActivityPage({ version: ACTIVITY_SCHEMA_VERSION, records: wire.slice(0, 3), nextCursor: 3, hasMore: true }, 0).records)
    expect(state.rows.map(row => row.key)).toEqual(['2'])
    applyActivityRecords(state, decodeActivityPage({ version: ACTIVITY_SCHEMA_VERSION, records: wire.slice(3), nextCursor: 5, hasMore: false }, 3).records)
    expect(state.rows.map(row => row.key)).toEqual(['2'])
    expect(state.texts.map(row => row.text)).toEqual(['ab'])
  })
})
