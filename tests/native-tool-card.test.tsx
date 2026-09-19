import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  DisclosureRow: (props: { title: string; collapsedContent?: unknown; children?: unknown }) => <div data-disclosure-row="">{props.title}{props.collapsedContent}{props.children}</div>,
  ReadBlock: (props: unknown) => <div data-read-block="">{JSON.stringify(props)}</div>,
  DiffBlock: (props: unknown) => <div data-diff-block="">{JSON.stringify(props)}</div>,
  TerminalBlock: (props: unknown) => <div data-terminal-block="">{JSON.stringify(props)}</div>,
  writeClipboard: async () => true,
  IconApiOutline14: () => null,
  IconBrowseOutline16: () => null,
  IconEditOutline16: () => null,
  IconGlobeOutline14: () => null,
  IconSearchOutline16: () => null,
  IconSparkle16: () => null,
  IconChecklistOutline14: () => null,
}))

import { CursorAgentToolNode } from '../src/web/CursorAgentToolNode.tsx'
import { nativeToolName, nativeToolSummary } from '../src/web/native-tool-card.ts'
import { nativeTurnDefinition } from '../src/web/native-turn.ts'
import { toDurableToolEvents, CURSOR_AGENT_TOOL_UPDATE, CURSOR_AGENT_MAX_TOOL_TEXT_CHARS } from '../src/tool-events.ts'

const t = (key: string) => key
const conversationT = (key: string) => key.split('.').pop() ?? key

describe('nativeToolName', () => {
  it('maps ACP titles onto DSH wire names', () => {
    expect(nativeToolName('Read /tmp/a')).toBe('read')
    expect(nativeToolName('Find `docs/agents/issue-tracker.md`')).toBe('grep')
    expect(nativeToolName('git status -sb')).toBe('bash')
    expect(nativeToolName('unknown', JSON.stringify({ command: 'echo hi' }))).toBe('bash')
    expect(nativeToolName('Running view file')).toBe('read')
    expect(nativeToolName('Edit /tmp/a')).toBe('edit')
    expect(nativeToolName('Write /tmp/a')).toBe('write')
    expect(nativeToolName('Todo_write')).toBe('todo_write')
    expect(nativeToolName('Update TODOs: next task')).toBe('todo_write')
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
  expect(html).toContain('data-read-block')
  expect(html).not.toContain('data-native-download')
})

it('classifies expanded native payloads rather than showing two JSON code blocks', () => {
  const render = (name: string, input: object, output: string, status: 'completed' | 'failed' = 'completed') => renderToStaticMarkup(<CursorAgentToolNode t={t} conversationT={conversationT as never} row={{
    key: '1', epoch: 1, firstSeenAt: '', time: '',
    state: { toolId: '1', name, status, input: JSON.stringify(input), output },
  }} />)
  const read = render('Read', { path: '/tmp/spec.md', offset: 3 }, JSON.stringify({ content: 'first\nsecond' }))
  expect(read).toContain('data-read-block')
  expect(read).toContain('&quot;number&quot;:3')
  expect(read).not.toContain('\\\\n')
  expect(render('Edit', { path: '/tmp/a', old_string: 'before', new_string: 'after' }, 'ok')).toContain('data-diff-block')
  expect(render('Shell', { command: 'pwd' }, JSON.stringify({ stdout: '/tmp\n', exitCode: 0 }))).toContain('data-terminal-block')
  const generic = render('todo_write', { todos: [] }, 'Updated todo list')
  expect(generic).toContain('data-native-io')
  expect(generic).toContain('>input<')
  expect(generic).toContain('>output<')
  expect(generic).not.toContain('data-native-download')
  const failed = render('Read', { path: '/tmp/a' }, 'Permission denied', 'failed')
  expect(failed).not.toContain('data-read-block')
  expect(failed).toContain('Permission denied')
  const acpText = render('Read', { path: '/tmp/a' }, JSON.stringify([{ type: 'content', content: { type: 'text', text: 'file body' } }]))
  expect(acpText).toContain('data-read-block')
  expect(acpText).toContain('file body')
  expect(render('Edit', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: 'before', newText: 'after' }]))).toContain('data-diff-block')
  expect(render('Write', { path: '/tmp/a', content: 'new file' }, 'ok')).toContain('data-diff-block')
  const unknown = render('Read', { path: '/tmp/a' }, JSON.stringify({ unrecognized: ['do not hide'] }))
  expect(unknown).toContain('data-native-io')
  expect(unknown).toContain('do not hide')
  const mixed = render('Read', { path: '/tmp/a' }, JSON.stringify([{ type: 'text', text: 'text' }, { type: 'image', data: 'retained' }]))
  expect(mixed).toContain('data-native-io')
  expect(mixed).toContain('retained')
  expect(render('todo_write', { todos: [{ content: 'next task', status: 'in_progress' }] }, 'ok')).toContain('next task')
  expect(render('Update TODOs: original summary', { todos: [{ content: 'current task', status: 'TODO_STATUS_IN_PROGRESS' }] }, 'ok')).toContain('data-card-summary="completed · current task"')
  expect(render('Read', { path: '/tmp/a' }, '{"content":"cut off')).not.toContain('data-read-block')
  expect(render('Read', { path: '/tmp/a' }, '')).toContain('data-card-empty-result')
  expect(render('Update TODOs: native plan', { todos: [{ content: 'native task', status: 'TODO_STATUS_PENDING' }] }, '')).toContain('data-native-io')
  expect(render('Write', { path: '/tmp/a', content: 'new file' }, '')).toContain('data-diff-block')
  const created = render('Write', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: '++ b//tmp/a\nnew file' }]))
  expect(created).toContain('&quot;oldText&quot;:null')
  expect(created).toContain('&quot;newText&quot;:&quot;new file&quot;')
  expect(render('Write', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: '++ b//tmp/a' }]))).toContain('&quot;oldText&quot;:null,&quot;newText&quot;:&quot;&quot;')
  // Literal file content must not be rewritten just because it resembles one header.
  expect(render('Edit', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: 'literal text' }]))).toContain('-- /dev/null')
  expect(render('Read', { path: '/tmp/a', offset: 5 }, JSON.stringify({ content: 'line', totalLines: 90 }))).toContain('&quot;totalLines&quot;:90')
  expect(render('Shell', { command: 'run' }, '[INFO] real log')).toContain('data-terminal-block')
  for (const fragment of ['{"stdout":"cut off', '[{"type":"content","content":']) {
    const shell = render('Shell', { command: 'run' }, fragment)
    expect(shell).toContain('data-native-io')
    expect(shell).not.toContain('data-terminal-block')
  }
  for (const [name, title] of [['grep', 'grep'], ['glob', 'glob'], ['web_search', 'webSearch'], ['web_fetch', 'webFetch']] as const) {
    const search = render(name, { query: 'needle' }, 'matches')
    expect(search).toContain(`>${title}<`)
    expect(search).toContain('data-native-io')
  }
  expect(generic).not.toContain('aria-expanded') // no duplicate Inspect surface on a fallback
  expect(generic.match(/data-native-copy/g)).toHaveLength(2)
})

it('keeps bounded recorded read and diff payloads valid JSON for the real render path', () => {
  for (const [name, output, marker] of [
    ['Read', { content: 'file line\n'.repeat(2000) }, 'data-read-block'],
    ['Edit', [{ type: 'diff', path: '/tmp/a', oldText: 'before\n'.repeat(2000), newText: 'after\n'.repeat(2000) }], 'data-diff-block'],
    ['Read', Array.from({ length: 150 }, (_, i) => ({ type: 'content', content: { type: 'text', text: `short line ${i}` } })), 'data-native-io'],
  ] as const) {
    const events = toDurableToolEvents({ toolId: '1', name, status: 'completed', input: JSON.stringify({ path: '/tmp/a' }), output: JSON.stringify(output) }, new Set(['1']))
    const update = events.find(event => event.type === CURSOR_AGENT_TOOL_UPDATE)!
    expect(update.data.output!.length).toBeLessThanOrEqual(CURSOR_AGENT_MAX_TOOL_TEXT_CHARS)
    expect(() => JSON.parse(update.data.output!)).not.toThrow()
    expect(update.data.output).toContain('[truncated]')
    const html = renderToStaticMarkup(<CursorAgentToolNode t={t} conversationT={conversationT as never} row={{ key: '1', epoch: 1, firstSeenAt: '', time: '', state: { ...update.data, name } }} />)
    expect(html).toContain(marker)
  }
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
