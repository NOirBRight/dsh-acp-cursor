import { describe, expect, it } from 'vitest'
import { groupNativeActivity } from '../src/web/native-tree.ts'

describe('stock tool chrome', () => {
  it('flattens tools and does not emit Subagent branches', () => {
    const branches = groupNativeActivity([
      {
        key: '1',
        epoch: 1,
        firstSeenAt: '2026-09-09T00:00:00.000Z',
        time: '2026-09-09T00:00:00.000Z',
        state: {
          toolId: 't1',
          name: 'Read',
          status: 'completed',
          ownership: { trajectoryId: 'child', parentTrajectoryId: 'parent' },
        },
      },
      {
        key: '2',
        epoch: 1,
        firstSeenAt: '2026-09-09T00:00:01.000Z',
        time: '2026-09-09T00:00:01.000Z',
        state: { toolId: 't2', name: 'Shell', status: 'running' },
      },
    ])
    expect(branches.every(branch => branch.kind === 'tool')).toBe(true)
    expect(branches).toHaveLength(2)
  })

  it('interleaves parent text with tools by seq', () => {
    const branches = groupNativeActivity([
      { key: '2', epoch: 1, firstSeenAt: '2026-09-09T00:00:01.000Z', time: '2026-09-09T00:00:01.000Z', state: { toolId: 't1', name: 'Read', status: 'completed' } },
    ], [], [
      { key: '1', epoch: 1, firstSeenAt: '2026-09-09T00:00:00.000Z', trajectoryId: 'cursor-agent-parent', kind: 'thought', text: 'planning' },
      { key: '3', epoch: 1, firstSeenAt: '2026-09-09T00:00:02.000Z', trajectoryId: 'cursor-agent-parent', kind: 'text', text: 'done' },
    ])
    expect(branches.map(branch => branch.kind)).toEqual(['text', 'tool', 'text'])
    expect(branches[0]).toMatchObject({ thought: true, text: 'planning' })
  })
})
