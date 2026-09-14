import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { nativeTurnDefinition } from '../src/web/native-turn.js'

function turnStart(seq: number, turn: number) {
  return { type: 'turn/start', seq: SessionSeq(seq), time: seq, data: { turn } } as const
}

function stepStart(seq: number, turn: number, step: number) {
  return { type: 'step/start', seq: SessionSeq(seq), time: seq, data: { turn, step } } as const
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
