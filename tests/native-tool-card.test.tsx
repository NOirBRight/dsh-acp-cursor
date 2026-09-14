import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  DisclosureRow: (props: { title: string; collapsedContent?: unknown; children?: unknown }) => <div data-disclosure-row="">{props.title}{props.collapsedContent}{props.children}</div>,
  writeClipboard: async () => true,
  IconApiOutline14: () => null,
  IconBrowseOutline16: () => null,
  IconEditOutline16: () => null,
  IconGlobeOutline14: () => null,
  IconSearchOutline16: () => null,
  IconSparkle16: () => null,
}))

import { CursorAgentToolNode } from '../src/web/CursorAgentToolNode.tsx'
import { nativeToolName, nativeToolSummary } from '../src/web/native-tool-card.ts'
import { nativeTurnDefinition } from '../src/web/native-turn.ts'

const t = (key: string) => key
const conversationT = (key: string) => key.split('.').pop() ?? key

describe('nativeToolName', () => {
  it('maps ACP titles onto DSH wire names', () => {
    expect(nativeToolName('Read /tmp/a')).toBe('read')
    expect(nativeToolName('Find `docs/agents/issue-tracker.md`')).toBe('grep')
    expect(nativeToolName('git status -sb')).toBe('bash')
    expect(nativeToolName('unknown', JSON.stringify({ command: 'echo hi' }))).toBe('bash')
    expect(nativeToolName('Running view file')).toBe('read')
  })
  it('summarizes Read path from the ACP title when args omit it', () => {
    expect(nativeToolSummary({ toolId: '1', name: 'Read /tmp/a', status: 'completed' }, 'read')).toBe('/tmp/a')
  })
})

it('renders DSH disclosure chrome instead of a custom details card', () => {
  const html = renderToStaticMarkup(<CursorAgentToolNode t={t} conversationT={conversationT as never} row={{
    key: '1', epoch: 1, firstSeenAt: '', time: '',
    state: { toolId: '1', name: 'Read /tmp/a', status: 'completed', input: JSON.stringify({ file_path: '/tmp/a' }), output: 'ok' },
  }} />)
  expect(html).toContain('data-disclosure-row')
  expect(html).not.toContain('<details')
  expect(html).toContain('>read<')
  expect(html).toContain('/tmp/a')
  expect(html).toContain('data-native-copy')
  expect(html).toContain('data-native-download')
  expect(html).toContain('margin-left:auto')
})

it('starts once per turn on turn/start; later steps in the same turn are updates', () => {
  const event = (type: string, seq: number, step = 1) => ({ type, seq, time: seq, data: { turn: 1, step } }) as never
  expect(nativeTurnDefinition.match(event('turn/start', 0))).toEqual({ id: '1', role: 'start' })
  expect(nativeTurnDefinition.match(event('step/start', 2, 1))).toEqual({ id: '1', role: 'update' })
  expect(nativeTurnDefinition.match(event('step/start', 4, 2))).toEqual({ id: '1', role: 'update' })
  expect(nativeTurnDefinition.match(event('assistant/live-chunk', 3))).toEqual({ id: '1', role: 'update' })
  const starts = [event('turn/start', 0), event('step/start', 2, 1), event('step/start', 4, 2)]
    .map(item => nativeTurnDefinition.match(item))
    .filter(result => result?.role === 'start')
  expect(starts).toEqual([{ id: '1', role: 'start' }])
})

it('anchors the mixed timeline after plugin context injection', () => {
  const start = { type: 'turn/start', seq: 0, time: 0, data: { turn: 1 } }
  const step = { type: 'step/start', seq: 2, time: 2, data: { turn: 1, step: 1 } }
  nativeTurnDefinition.start({} as never, { event: start } as never)
  expect(nativeTurnDefinition.match({ type: 'user/message', seq: 9, time: 9, data: { source: { kind: 'plugin' } } } as never)).toEqual({ id: '1', role: 'update' })
  expect(nativeTurnDefinition.match({ type: 'user/message', seq: 9, time: 9, data: { turn: 99, source: { kind: 'user' } } } as never)).toBeNull()
  expect(nativeTurnDefinition.match({ type: 'user/message', seq: 9, time: 9, data: { turn: 99, source: { kind: 'plugin' } } } as never)).toEqual({ id: '1', role: 'update' })
  const node = nativeTurnDefinition.buildViewNode({
    key: 'k',
    id: '1',
    state: { turn: 1, startMs: 0, endMs: null },
    start: { event: start, location: { kind: 'unresolved' } },
    matches: [
      { event: start },
      { event: step },
      { event: { type: 'user/message', seq: 9, data: { source: { kind: 'plugin' } } } },
    ],
  } as never)
  expect(node?.anchorSeq).toBeGreaterThan(9)
})
