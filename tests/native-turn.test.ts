import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { nativeTurnDefinition } from '../src/web/native-turn.js'

function turnStart(seq: number, turn: number) {
  return { type: 'turn/start', seq: SessionSeq(seq), time: seq, data: { turn } } as const
}

function stepStart(seq: number, turn: number, step: number) {
  return { type: 'step/start', seq: SessionSeq(seq), time: seq, data: { turn, step } } as const
}

const event = (type: string, seq: number, data: Record<string, unknown>) => ({ type, seq, time: seq, data })

function startTurn(seq = 5): { type: string; seq: number; time: number; data: { turn: number } } {
  const start = turnStart(seq, 1)
  nativeTurnDefinition.start({} as never, { event: start } as never, {} as never)
  return start
}

function nodeFrom(matches: readonly { event: unknown }[]) {
  return nativeTurnDefinition.buildViewNode?.({
    key: 'k',
    id: '1',
    state: { turn: 1, startMs: 0, endMs: null },
    start: { event: matches[0]?.event, location: { kind: 'unresolved' } },
    matches,
  } as never) ?? null
}

describe('CursorAgent native turn definition', () => {
  it('emits at most one start Match per turn across a multi-step window', () => {
    const events = [
      turnStart(1, 1),
      stepStart(2, 1, 1),
      stepStart(3, 1, 2),
      turnStart(4, 2),
      stepStart(5, 2, 1),
    ]
    const starts = new Map<string, string>()
    for (const event of events) {
      const result = nativeTurnDefinition.match(event)
      if (result?.role !== 'start') continue
      expect(starts.has(result.id)).toBe(false)
      starts.set(result.id, event.type)
    }
    expect([...starts.entries()]).toEqual([['1', 'turn/start'], ['2', 'turn/start']])
  })
})

describe('native turn mix-in with /ask-matt context injections', () => {
  it('binds skill-catalog, skill-invocation, and agent-instructions, not only plugin sources', () => {
    startTurn()
    expect(nativeTurnDefinition.match(event('user/message', 10, {
      source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' },
    }) as never)).toEqual({ id: '1', role: 'update' })
    expect(nativeTurnDefinition.match(event('user/message', 11, {
      source: { kind: 'skill-catalog' },
    }) as never)).toEqual({ id: '1', role: 'update' })
    expect(nativeTurnDefinition.match(event('user/message', 12, {
      source: { kind: 'skill-invocation', name: 'ask-matt' },
    }) as never)).toEqual({ id: '1', role: 'update' })
    expect(nativeTurnDefinition.match(event('user/message', 13, {
      source: { kind: 'agent-instructions' },
    }) as never)).toEqual({ id: '1', role: 'update' })
    expect(nativeTurnDefinition.match(event('user/message', 9, {
      source: { kind: 'user' },
    }) as never)).toBeNull()
  })

  it('anchors after the last context injection, not between dsh-system-prompt and skill-catalog', () => {
    const start = startTurn(5)
    const step = event('step/start', 7, { turn: 1, step: 1 })
    const system = event('system/message', 8, { turn: 1, step: 1 })
    const plugin = event('user/message', 10, {
      source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' },
    })
    const catalog = event('user/message', 11, { source: { kind: 'skill-catalog' } })
    const skill = event('user/message', 12, {
      source: { kind: 'skill-invocation', name: 'ask-matt' },
    })
    const matched = [start, step, system, plugin, catalog, skill]
      .filter(item => nativeTurnDefinition.match(item as never) !== null)
      .map(item => ({ event: item }))
    const node = nodeFrom(matched)
    expect(node).not.toBeNull()
    if (node === null || !('anchorSeq' in node) || typeof node.anchorSeq !== 'number') throw new Error('native turn view did not expose an anchor sequence')
    expect(node.anchorSeq).toBeGreaterThan(12)
  })
})
