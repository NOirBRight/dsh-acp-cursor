import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVITY_COALESCE_WINDOW_MS,
  ACTIVITY_MAX_PENDING_RECORDS,
  ACTIVITY_MAX_TEXT_CHARS,
  ACTIVITY_TOOL_SKIP_FLUSH,
  CursorAgentActivityCoalescer,
  type ActivityCoalescerSink,
} from '../src/activity-coalescer.js'
import type { CursorAgentActivityEvent } from '../src/activity-store.js'
import { CURSOR_AGENT_SESSION_READY, CURSOR_AGENT_TEXT, CURSOR_AGENT_TOOL_START, CURSOR_AGENT_TOOL_UPDATE } from '../src/tool-events.js'

const SESSION = 'session-a'

interface Batch {
  readonly sessionId: string
  readonly events: readonly CursorAgentActivityEvent[]
}

/** Recording sink: one entry per durable append, in call order. */
function recorder(): { batches: Batch[]; sink: ActivityCoalescerSink; flat: () => CursorAgentActivityEvent[] } {
  const batches: Batch[] = []
  return {
    batches,
    sink: { append: (sessionId, events) => { batches.push({ sessionId, events: [...events] }) } },
    flat: () => batches.flatMap(batch => [...batch.events]),
  }
}

function text(data: string, kind: 'text' | 'thought' = 'text', trajectoryId = 'root'): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TEXT, data: { trajectoryId, kind, text: data } }
}

function toolUpdate(toolId: string, status: 'pending' | 'running' | 'completed' | 'failed', output?: string): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TOOL_UPDATE, data: { toolId, status, ...(output === undefined ? {} : { output }) } }
}

function toolStart(toolId: string): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_TOOL_START, data: { toolId, name: 'Shell', status: 'running' } }
}

function ready(): CursorAgentActivityEvent {
  return { type: CURSOR_AGENT_SESSION_READY, data: { provider: 'cursor-agent' } }
}

describe('CursorAgent activity coalescer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('merges deltas by trajectory, parent and kind and preserves exact text', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('Hel'), text('lo '), text('world', 'thought'), text('!', 'thought')])
    coalescer.append(SESSION, [{ type: CURSOR_AGENT_TEXT, data: { trajectoryId: 'child', parentTrajectoryId: 'root', kind: 'text', text: 'sub' } }])
    coalescer.append(SESSION, [text('second', 'text')])
    // Different parent is a different key, even on the same trajectory and kind.
    coalescer.append(SESSION, [{ type: CURSOR_AGENT_TEXT, data: { trajectoryId: 'root', parentTrajectoryId: 'root', kind: 'text', text: 'owned' } }])
    coalescer.flush(SESSION)
    expect(flat().map(event => event.type === CURSOR_AGENT_TEXT ? event.data.text : '<other>')).toEqual(['Hello ', 'world!', 'sub', 'second', 'owned'])
    expect(flat().filter(event => event.type === CURSOR_AGENT_TEXT).map(event => event.data.kind)).toEqual(['text', 'thought', 'text', 'text', 'text'])
  })

  it('delivers on the window without an explicit flush', () => {
    const { sink, batches, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('a'), text('b')])
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(ACTIVITY_COALESCE_WINDOW_MS - 1)
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(batches).toHaveLength(1)
    expect(flat().map(event => event.type === CURSOR_AGENT_TEXT ? event.data.text : '<other>')).toEqual(['ab'])
    expect(coalescer.pendingCount(SESSION)).toBe(0)
  })

  it('flushes buffered text before a non-coalescible ordering barrier', () => {
    const { sink, batches, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('before')])
    coalescer.append(SESSION, [ready()])
    coalescer.append(SESSION, [text('after')])
    coalescer.append(SESSION, [toolStart('t1')])
    coalescer.flush(SESSION)
    expect(flat().map(event => event.type)).toEqual([CURSOR_AGENT_TEXT, CURSOR_AGENT_SESSION_READY, CURSOR_AGENT_TEXT, CURSOR_AGENT_TOOL_START])
    expect(batches.map(batch => batch.events.length)).toEqual([1, 1, 1, 1])
    expect(coalescer.pendingCount(SESSION)).toBe(0)
  })

  it('bounds the buffer by forcing a flush at the record ceiling', () => {
    const { sink, batches } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    for (let index = 0; index <= ACTIVITY_MAX_PENDING_RECORDS; index++) coalescer.append(SESSION, [text('x', 'text', 'trajectory-' + String(index))])
    expect(batches).toHaveLength(1)
    expect(batches[0]?.events).toHaveLength(ACTIVITY_MAX_PENDING_RECORDS)
    expect(coalescer.pendingCount(SESSION)).toBe(1)
    coalescer.flush(SESSION)
    expect(batches).toHaveLength(2)
  })

  it('flushes on a paragraph boundary without waiting for the window', () => {
    const { sink, batches, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('first paragraph\n\n')])
    // The window never elapsed: the closed paragraph is a visible block already.
    expect(batches).toHaveLength(1)
    expect(flat().map(event => event.type === CURSOR_AGENT_TEXT ? event.data.text : '')).toEqual(['first paragraph\n\n'])
    coalescer.append(SESSION, [text('still typing')])
    expect(batches).toHaveLength(1)
    coalescer.append(SESSION, [text(' the rest\n\n')])
    expect(batches).toHaveLength(2)
    expect(coalescer.pendingCount(SESSION)).toBe(0)
  })

  it('defers an open code fence and flushes it once the fence closes', () => {
    const { sink, batches, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('```ts\nconst x = 1\n')])
    expect(batches).toHaveLength(0)
    coalescer.append(SESSION, [text('const y = 2\n```\n')])
    expect(batches).toHaveLength(1)
    expect(flat().map(event => event.type === CURSOR_AGENT_TEXT ? event.data.text : '')).toEqual(['```ts\nconst x = 1\nconst y = 2\n```\n'])
  })

  it('splits text at the record ceiling without losing or reordering content', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    const half = 'a'.repeat(ACTIVITY_MAX_TEXT_CHARS - 1)
    coalescer.append(SESSION, [text(half), text('bc')])
    coalescer.flush(SESSION)
    const records = flat()
    expect(records).toHaveLength(2)
    expect(records.map(event => event.type === CURSOR_AGENT_TEXT ? event.data.text : '').join('')).toBe(half + 'bc')
  })

  it('keeps tool lifecycle lossless and merges same-status output growth', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [toolStart('t1')])
    coalescer.append(SESSION, [toolUpdate('t1', 'running', 'line 1')])
    coalescer.append(SESSION, [toolUpdate('t1', 'running', 'line 1\nline 2')])
    coalescer.append(SESSION, [toolUpdate('t1', 'running', 'line 1\nline 2\nline 3')])
    coalescer.append(SESSION, [toolUpdate('t1', 'completed', 'line 1\nline 2\nline 3')])
    coalescer.flush(SESSION)
    expect(flat().map(event => event.type)).toEqual([CURSOR_AGENT_TOOL_START, CURSOR_AGENT_TOOL_UPDATE, CURSOR_AGENT_TOOL_UPDATE])
    const updates = flat().filter(event => event.type === CURSOR_AGENT_TOOL_UPDATE)
    expect(updates.map(event => event.data.status)).toEqual(['running', 'completed'])
    expect(updates[0]?.data.output).toBe('line 1\nline 2\nline 3')
    expect(updates[1]?.data.output).toBe('line 1\nline 2\nline 3')
  })

  it('keeps a redraw that is not output growth', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    for (let index = 0; index < 4; index++) coalescer.append(SESSION, [toolUpdate('t1', 'running', String(index).repeat(4))])
    coalescer.flush(SESSION)
    // A constant-length redraw replaces the value instead of growing it, so it is
    // written rather than hidden behind the window.
    expect(flat().map(event => event.type === CURSOR_AGENT_TOOL_UPDATE ? event.data.output : '')).toEqual(['0000', '1111', '2222', '3333'])
  })

  it('collapses a repaint that repeats the same value and flushes at the skip count', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    for (let index = 0; index <= ACTIVITY_TOOL_SKIP_FLUSH; index++) coalescer.append(SESSION, [toolUpdate('t1', 'running', 'repaint')])
    // Identical repaints fold into one row; the count forces one durable write.
    expect(flat().map(event => event.type === CURSOR_AGENT_TOOL_UPDATE ? event.data.output : '')).toEqual(['repaint'])
    coalescer.flush(SESSION)
    expect(coalescer.pendingCount(SESSION)).toBe(0)
  })

  it('keeps per-tool updates separate and preserves terminal states', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [toolStart('t1'), toolUpdate('t1', 'completed', 'ok'), toolStart('t2'), toolUpdate('t2', 'failed')])
    coalescer.flush(SESSION)
    expect(flat().map(event => event.type === CURSOR_AGENT_TOOL_UPDATE ? event.data.toolId + ':' + event.data.status : event.type)).toEqual([
      CURSOR_AGENT_TOOL_START,
      't1:completed',
      CURSOR_AGENT_TOOL_START,
      't2:failed',
    ])
  })

  it('fails closed after a flush failure and never retries the batch', () => {
    const { batches, sink } = recorder()
    let fail = true
    const failing: ActivityCoalescerSink = {
      append: (sessionId, events) => {
        if (fail) throw new Error('disk full')
        sink.append(sessionId, events)
      },
    }
    const coalescer = new CursorAgentActivityCoalescer(failing)
    coalescer.append(SESSION, [text('lost')])
    expect(() => coalescer.flush(SESSION)).toThrow('disk full')
    fail = false
    expect(() => coalescer.append(SESSION, [ready()])).toThrow('disk full')
    expect(() => coalescer.flush(SESSION)).not.toThrow()
    coalescer.flush(SESSION)
    expect(batches).toHaveLength(0)
    expect(coalescer.pendingCount(SESSION)).toBe(0)
  })

  it('reports a timer-driven flush failure on the next append', () => {
    const coalescer = new CursorAgentActivityCoalescer({ append: () => { throw new Error('write refused') } })
    coalescer.append(SESSION, [text('buffered')])
    vi.advanceTimersByTime(ACTIVITY_COALESCE_WINDOW_MS)
    expect(() => coalescer.append(SESSION, [text('next')])).toThrow('write refused')
  })

  it('flushes on release and reset', () => {
    const { sink, flat } = recorder()
    const coalescer = new CursorAgentActivityCoalescer(sink)
    coalescer.append(SESSION, [text('released')])
    coalescer.release(SESSION)
    expect(flat()).toHaveLength(1)
    expect(coalescer.pendingCount(SESSION)).toBe(0)
    coalescer.append('session-b', [text('reset')])
    coalescer.reset()
    expect(flat()).toHaveLength(2)
    expect(coalescer.pendingCount('session-b')).toBe(0)
  })
})
