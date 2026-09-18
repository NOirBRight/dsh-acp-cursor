/** Compatibility coverage for CursorAgent native activity (#12).
 *
 * The performance fix changed how records are written and read, never what a
 * record means: histories written by an older build stay readable without a
 * migration or a rewrite, a restarted store continues the same sequence, the
 * binding/authorization/lifecycle records a native turn depends on survive
 * coalescing, and the provider dependency stays pinned to the v0.1.5 source of
 * the store contract.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { providerId, sessionId, type ExternalAgentOwnership, type ExternalAgentSessionRef } from '@deepseek-ai/dsh-acp-provider'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_PAGE_RECORD_LIMIT,
  ACTIVITY_SCHEMA_VERSION,
  ACTIVITY_STALE_CURSOR,
  ActivityCursorStaleError,
  CURSOR_AGENT_FULL_ACCESS_AUTHORIZED,
  nativeSessionBinding,
  type CursorAgentActivityRecord,
} from '../src/activity-contract.js'
import { CursorAgentActivityStore, type CursorAgentActivityEvent } from '../src/activity-store.js'
import { createCursorAgentActivityWriter } from '../src/dsh-plugin.js'
import { encodeCursorAgentCursor } from '../src/native-ref.js'
import { createAcpSettingsRpcHandler, type AcpSettingsRpcDeps } from '../src/rpc.js'
import { foldActivityRecords, foldAgentTextRecords } from '../src/web/native-activity.js'
import {
  CURSOR_AGENT_OBSERVED,
  CURSOR_AGENT_SESSION_READY,
  CURSOR_AGENT_TEXT,
  CURSOR_AGENT_TOOL_START,
  CURSOR_AGENT_TOOL_UPDATE,
  CURSOR_AGENT_USER_QUESTION_ANSWER,
} from '../src/tool-events.js'

const time = '2026-09-19T00:00:00.000Z'
const PROVIDER = providerId('cursor-agent')

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'cursor-agent-compat-'))
}

function pathFor(root: string, id: string): string {
  return join(root, createHash('sha256').update(id, 'utf8').digest('hex') + '.jsonl')
}

function writeHistory(root: string, id: string, lines: readonly unknown[]): void {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeFileSync(pathFor(root, id), lines.map(line => JSON.stringify(line)).join('\n') + '\n', { mode: 0o600 })
}

/** One wire record exactly as a pre-fix build wrote it. */
function line(seq: number, type: string, data: unknown): Record<string, unknown> {
  return { v: ACTIVITY_SCHEMA_VERSION, seq, time, type, data }
}

function ready(ref?: ExternalAgentSessionRef): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_SESSION_READY, data: { provider: 'cursor-agent', ...(ref === undefined ? {} : { ref }) } }
}

function start(toolId: string, status: 'pending' | 'running' = 'running', ownership?: ExternalAgentOwnership): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TOOL_START, data: { toolId, name: 'Shell', status, ...(ownership === undefined ? {} : { ownership }) } }
}

function update(toolId: string, status: 'running' | 'completed' | 'failed', output?: string, error?: string): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TOOL_UPDATE, data: { toolId, status, ...(output === undefined ? {} : { output }), ...(error === undefined ? {} : { error }) } }
}

function text(value: string, kind: 'text' | 'thought' = 'thought'): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TEXT, data: { trajectoryId: 'traj-1', kind, text: value } }
}

const owned: ExternalAgentOwnership = { trajectoryId: 'traj-1', depth: 1, parentTrajectoryId: 'root' }

describe('store restart continuity', () => {
  it('continues an existing history with contiguous sequences and exact order', () => {
    const root = tempRoot()
    const first = new CursorAgentActivityStore(root)
    first.append('dsh', [ready(), start('t1')])
    first.append('dsh', [update('t1', 'completed', 'done')])

    // Restart: a fresh store over the same root must validate, then continue.
    const second = new CursorAgentActivityStore(root)
    second.append('dsh', [start('t2')])
    second.append('dsh', [ready()])

    const records = second.read('dsh').records
    expect(records.map(record => record.seq)).toEqual([1, 2, 3, 4, 5])
    expect(records.map(record => record.type)).toEqual([
      CURSOR_AGENT_SESSION_READY,
      CURSOR_AGENT_TOOL_START,
      CURSOR_AGENT_TOOL_UPDATE,
      CURSOR_AGENT_TOOL_START,
      CURSOR_AGENT_SESSION_READY,
    ])
    expect(records[2]).toMatchObject({ data: { toolId: 't1', status: 'completed', output: 'done' } })
  })

  it('fails closed instead of appending past a history a restart cannot validate', () => {
    const root = tempRoot()
    writeHistory(root, 'torn', [line(1, CURSOR_AGENT_SESSION_READY, { provider: 'cursor-agent' })])
    writeFileSync(pathFor(root, 'torn'), readFileSync(pathFor(root, 'torn'), 'utf8') + '{"v":1,', { mode: 0o600 })
    const store = new CursorAgentActivityStore(root)
    expect(() => store.append('torn', [start('t1')])).toThrow(/incomplete trailing record|not JSON/)
  })
})

describe('legacy JSONL histories', () => {
  it('reads an old v1 history without rewriting it and appends after its last sequence', () => {
    const root = tempRoot()
    writeHistory(root, 'legacy', [
      line(1, CURSOR_AGENT_SESSION_READY, { provider: 'cursor-agent' }),
      line(2, CURSOR_AGENT_OBSERVED, owned),
      line(3, CURSOR_AGENT_TEXT, { trajectoryId: 'root', kind: 'text', text: 'before the fix' }),
      line(4, CURSOR_AGENT_TOOL_START, { toolId: 't1', name: 'Shell', status: 'running' }),
      line(5, CURSOR_AGENT_TOOL_UPDATE, { toolId: 't1', status: 'failed', error: 'boom' }),
      line(6, CURSOR_AGENT_USER_QUESTION_ANSWER, { requestId: 'q1', question: 'continue?', selected: ['yes'] }),
      line(7, CURSOR_AGENT_FULL_ACCESS_AUTHORIZED, { provider: PROVIDER, session: 'legacy', mode: 'full-access' }),
    ])
    const before = readFileSync(pathFor(root, 'legacy'), 'utf8')

    const store = new CursorAgentActivityStore(root)
    const records = store.read('legacy').records
    expect(records).toHaveLength(7)
    expect(records.map(record => record.type)).toEqual([
      CURSOR_AGENT_SESSION_READY,
      CURSOR_AGENT_OBSERVED,
      CURSOR_AGENT_TEXT,
      CURSOR_AGENT_TOOL_START,
      CURSOR_AGENT_TOOL_UPDATE,
      CURSOR_AGENT_USER_QUESTION_ANSWER,
      CURSOR_AGENT_FULL_ACCESS_AUTHORIZED,
    ])
    // Reading is not a migration: the file is byte-identical afterwards.
    expect(readFileSync(pathFor(root, 'legacy'), 'utf8')).toBe(before)

    store.append('legacy', [start('t2')])
    expect(store.read('legacy').records.map(record => record.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    // Legacy binding: a ready record without a resume ref stays provider-only.
    expect(nativeSessionBinding({ version: ACTIVITY_SCHEMA_VERSION, records }, 'legacy')).toEqual({ provider: PROVIDER, session: sessionId('legacy') })
  })

  it('pages and binds a history that also carries a resumable native reference', () => {
    const root = tempRoot()
    const ref = { provider: PROVIDER, session: sessionId('dsh'), resumeCursor: encodeCursorAgentCursor(PROVIDER, 'native-9', 'profile/workspace') }
    writeHistory(root, 'dsh', [
      line(1, CURSOR_AGENT_SESSION_READY, { provider: 'cursor-agent' }),
      line(2, CURSOR_AGENT_SESSION_READY, { provider: 'cursor-agent', ref }),
      line(3, CURSOR_AGENT_TOOL_START, { toolId: 't1', name: 'Shell', status: 'running' }),
    ])
    const store = new CursorAgentActivityStore(root)
    expect(nativeSessionBinding(store.read('dsh'), 'dsh')).toEqual(ref)

    // An old client polling from zero still gets ordered bounded pages.
    const page = store.readActivityPage('dsh', 0)
    expect(page.records.map(record => record.seq)).toEqual([1, 2, 3])
    expect(page.nextCursor).toBe(3)
    expect(page.hasMore).toBe(false)
    // A cursor from a history the host no longer holds is refused, never resumed at 1.
    expect(() => store.readActivityPage('dsh', 9)).toThrow(ActivityCursorStaleError)
  })

  it('fails closed on a legacy history whose sequence breaks', () => {
    const root = tempRoot()
    writeHistory(root, 'gapped', [
      line(1, CURSOR_AGENT_SESSION_READY, { provider: 'cursor-agent' }),
      line(3, CURSOR_AGENT_TOOL_START, { toolId: 't1', name: 'Shell', status: 'running' }),
    ])
    const store = new CursorAgentActivityStore(root)
    expect(() => store.read('gapped')).toThrow('breaks the sequence')
    expect(() => store.append('gapped', [start('t2')])).toThrow('breaks the sequence')
  })
})

describe('records a native turn depends on', () => {
  it('keeps authorization, answers, lifecycle, failure, and final tool state durable and ordered', () => {
    const root = tempRoot()
    const writer = createCursorAgentActivityWriter(root)
    writer.append('dsh', [{ type: CURSOR_AGENT_FULL_ACCESS_AUTHORIZED, data: { provider: PROVIDER, session: sessionId('dsh'), mode: 'full-access' } }])
    // Buffered text must land before the tool start that follows it.
    writer.append('dsh', [text('thinking')])
    writer.append('dsh', [start('t1', 'running', owned)])
    writer.append('dsh', [update('t1', 'running', 'partial output')])
    writer.append('dsh', [{ type: CURSOR_AGENT_USER_QUESTION_ANSWER, data: { requestId: 'q1', question: 'continue?', selected: ['yes'], custom: 'go on' } }])
    writer.append('dsh', [start('t2')])
    writer.append('dsh', [update('t2', 'failed', undefined, 'boom')])
    writer.append('dsh', [update('t1', 'completed', 'partial output done')])
    writer.flushAll()

    const records = writer.store.read('dsh').records
    expect(records.map(record => record.type)).toEqual([
      CURSOR_AGENT_FULL_ACCESS_AUTHORIZED,
      CURSOR_AGENT_TEXT,
      CURSOR_AGENT_TOOL_START,
      CURSOR_AGENT_TOOL_UPDATE,
      CURSOR_AGENT_USER_QUESTION_ANSWER,
      CURSOR_AGENT_TOOL_START,
      CURSOR_AGENT_TOOL_UPDATE,
      CURSOR_AGENT_TOOL_UPDATE,
    ])
    expect(records[4]?.data).toMatchObject({ requestId: 'q1', custom: 'go on' })
    // The fold a reader sees: the failed row keeps its error, the finished row
    // keeps the final output, and neither state was swallowed by coalescing.
    expect(foldActivityRecords(records).map(row => [row.state.toolId, row.state.status, row.state.output, row.state.error])).toEqual([
      ['t1', 'completed', 'partial output done', undefined],
      ['t2', 'failed', undefined, 'boom'],
    ])
    expect(foldAgentTextRecords(records).map(row => row.text)).toEqual(['thinking'])
    // Authorization and the answer are durable without being foldable rows.
    expect(nativeSessionBinding({ version: ACTIVITY_SCHEMA_VERSION, records }, 'dsh')).toBeUndefined()
  })

  it('keeps a flushed-but-open native turn recoverable across a store restart', () => {
    const root = tempRoot()
    const writer = createCursorAgentActivityWriter(root)
    writer.append('dsh', [ready(), start('t1')])
    writer.append('dsh', [update('t1', 'running', 'still running')])
    writer.flushAll()

    // A restart mid-turn must still see the latest tool state and the bound session.
    const restarted = new CursorAgentActivityStore(root)
    expect(nativeSessionBinding(restarted.read('dsh'), 'dsh')).toEqual({ provider: PROVIDER, session: sessionId('dsh') })
    expect(foldActivityRecords(restarted.read('dsh').records).map(row => [row.state.status, row.state.output])).toEqual([['running', 'still running']])
  })
})

describe('cursor reads across a stale history', () => {
  it('reports the stale cursor over RPC and resynchronizes with one full read', async () => {
    const root = tempRoot()
    const writer = createCursorAgentActivityWriter(root)
    for (let index = 0; index < ACTIVITY_PAGE_RECORD_LIMIT + 3; index++) writer.append('dsh', [start('t' + String(index))])
    const deps = {
      snapshot: async () => ({ rows: [] }),
      catalog: async () => ({ groups: [] }),
      quota: async () => ({}),
      readActivity: (id: string) => writer.store.read(id),
      readActivityAfter: (id: string, afterSeq: number) => writer.store.readActivityPage(id, afterSeq),
      applyConfig: async () => undefined,
      run: async () => undefined,
    }
    const call = createAcpSettingsRpcHandler(deps as unknown as AcpSettingsRpcDeps)

    const stale = await call('activity/read-after', { sessionId: 'dsh', afterSeq: 9999 })
    expect(stale).toMatchObject({ ok: false, error: { code: ACTIVITY_STALE_CURSOR } })
    expect(writer.metrics.snapshot().staleCursorCalls).toBe(1)

    const full = await call('activity/read', { sessionId: 'dsh' })
    expect(full.ok).toBe(true)
    const records = (full.ok ? full.value : undefined) as { records: readonly CursorAgentActivityRecord[] }
    expect(records.records).toHaveLength(ACTIVITY_PAGE_RECORD_LIMIT + 3)
    // The resynchronized client resumes from the new tail, not from the stale cursor.
    const next = await call('activity/read-after', { sessionId: 'dsh', afterSeq: records.records.at(-1)?.seq ?? 0 })
    expect(next).toMatchObject({ ok: true, value: { records: [], hasMore: false } })
  })
})

describe('provider resolution', () => {
  it('pins the published v0.1.5 tarball and resolves the store contract from it', async () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string> }
    expect(manifest.dependencies['@deepseek-ai/dsh-acp-provider']).toBe(
      'https://github.com/NOirBRight/dsh-acp-provider/releases/download/v0.1.5/deepseek-ai-dsh-acp-provider-0.1.5.tgz',
    )
    const installed = JSON.parse(readFileSync(new URL('../node_modules/@deepseek-ai/dsh-acp-provider/package.json', import.meta.url), 'utf8')) as { version: string }
    expect(installed.version).toBe('0.1.5')

    // The local store is the provider's store, so the O(1) cursor contract follows the pin.
    const provider = await import('@deepseek-ai/dsh-acp-provider/activity-store')
    expect(Object.getPrototypeOf(CursorAgentActivityStore.prototype)).toBe(provider.ExternalAgentActivityStore.prototype)
    expect(ACTIVITY_PAGE_RECORD_LIMIT).toBe(provider.EXTERNAL_AGENT_ACTIVITY_MAX_PAGE_RECORDS)
    // v0.1.5 surfaces a deleted history and types the refused cursor; the store maps both,
    // so a pin that lost either export must fail here rather than at runtime.
    expect(typeof provider.ExternalAgentActivityCursorAheadError).toBe('function')
    expect(new provider.ExternalAgentActivityCursorAheadError(9, 4)).toMatchObject({ kind: 'cursor-ahead', afterSeq: 9, historyLength: 4 })
  })

  it.runIf(process.env.DSH_ACP_PROVIDER_SRC !== undefined)('aliases the same provider from the source checkout when asked', async () => {
    const source = process.env.DSH_ACP_PROVIDER_SRC ?? ''
    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')) as { name: string; exports: Record<string, unknown> }
    // The vitest alias only rewrites a package whose exports map it can mirror.
    expect(manifest.name).toBe('@deepseek-ai/dsh-acp-provider')
    expect(Object.keys(manifest.exports)).toContain('./activity-store')
    expect(readFileSync(join(source, 'src', 'activity-store.ts'), 'utf8')).toContain('ExternalAgentActivityStore')
  })
})
