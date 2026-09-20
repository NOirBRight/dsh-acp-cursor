import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

vi.mock('@deepseek-ai/dsh-acp-provider/native-ui', () => ({
  NativeToolCard: (props: { callId: string; toolName: string; detail?: { kind: string }; state: string }) =>
    <pre data-native-tool-card={props.callId} data-state={props.state} data-tool-name={props.toolName} data-detail={props.detail?.kind ?? 'generic'}>{JSON.stringify(props)}</pre>,
}))

import { CursorAgentToolNode } from '../src/web/CursorAgentToolNode.tsx'
import { nativeToolName, nativeToolSummary } from '../src/web/native-tool-card.ts'
import { nativeTurnDefinition } from '../src/web/native-turn.ts'
import { toDurableToolEvents, CURSOR_AGENT_TOOL_UPDATE, CURSOR_AGENT_MAX_TOOL_TEXT_CHARS } from '../src/tool-events.ts'

const conversationT: TranslateNS<'conversation'> = key => key.split('.').pop() ?? key

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

it('passes a normalized model to the shared card', () => {
  const html = renderToStaticMarkup(<CursorAgentToolNode conversationT={conversationT} row={{
    key: '1', epoch: 1, firstSeenAt: '', time: '',
    state: { toolId: '1', name: 'Read /tmp/a', status: 'completed', input: JSON.stringify({ file_path: '/tmp/a' }), output: 'ok' },
  }} />)
  expect(html).toContain('data-tool-name="read"')
  expect(html).toContain('data-detail="read"')
  expect(html).toContain('/tmp/a')
})

it('classifies expanded native payloads rather than showing two JSON code blocks', () => {
  const render = (name: string, input: object, output: string, status: 'completed' | 'failed' = 'completed') => renderToStaticMarkup(<CursorAgentToolNode conversationT={conversationT} row={{
    key: '1', epoch: 1, firstSeenAt: '', time: '',
    state: { toolId: '1', name, status, input: JSON.stringify(input), output },
  }} />)
  const read = render('Read', { path: '/tmp/spec.md', offset: 3 }, JSON.stringify({ content: 'first\nsecond' }))
  expect(read).toContain('data-detail="read"')
  expect(read).toContain('&quot;number&quot;:3')
  expect(render('Edit', { path: '/tmp/a', old_string: 'before', new_string: 'after' }, 'ok')).toContain('data-detail="diff"')
  expect(render('Shell', { command: 'pwd' }, JSON.stringify({ stdout: '/tmp\n', exitCode: 0 }))).toContain('data-detail="terminal"')
  const generic = render('todo_write', { todos: [] }, 'Updated todo list')
  expect(generic).toContain('data-detail="generic"')
  expect(generic).toContain('&quot;input&quot;')
  expect(generic).toContain('&quot;output&quot;')
  const failed = render('Read', { path: '/tmp/a' }, 'Permission denied', 'failed')
  expect(failed).not.toContain('data-detail="read"')
  expect(failed).toContain('Permission denied')
  const acpText = render('Read', { path: '/tmp/a' }, JSON.stringify([{ type: 'content', content: { type: 'text', text: 'file body' } }]))
  expect(acpText).toContain('data-detail="read"')
  expect(acpText).toContain('file body')
  expect(render('Edit', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: 'before', newText: 'after' }]))).toContain('data-detail="diff"')
  expect(render('Write', { path: '/tmp/a', content: 'new file' }, 'ok')).toContain('data-detail="diff"')
  const unknown = render('Read', { path: '/tmp/a' }, JSON.stringify({ unrecognized: ['do not hide'] }))
  expect(unknown).toContain('data-detail="generic"')
  expect(unknown).toContain('do not hide')
  const mixed = render('Read', { path: '/tmp/a' }, JSON.stringify([{ type: 'text', text: 'text' }, { type: 'image', data: 'retained' }]))
  expect(mixed).toContain('data-detail="generic"')
  expect(mixed).toContain('retained')
  expect(render('todo_write', { todos: [{ content: 'next task', status: 'in_progress' }] }, 'ok')).toContain('next task')
  expect(render('Update TODOs: original summary', { todos: [{ content: 'current task', status: 'TODO_STATUS_IN_PROGRESS' }] }, 'ok')).toContain('completed · current task')
  expect(render('Read', { path: '/tmp/a' }, '{"content":"cut off')).not.toContain('data-detail="read"')
  expect(render('Read', { path: '/tmp/a' }, '')).toContain('data-detail="empty"')
  expect(render('Update TODOs: native plan', { todos: [{ content: 'native task', status: 'TODO_STATUS_PENDING' }] }, '')).toContain('data-detail="generic"')
  expect(render('Write', { path: '/tmp/a', content: 'new file' }, '')).toContain('data-detail="diff"')
  const created = render('Write', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: '++ b//tmp/a\nnew file' }]))
  expect(created).toContain('&quot;oldText&quot;:null')
  expect(created).toContain('&quot;newText&quot;:&quot;new file&quot;')
  expect(render('Write', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: '++ b//tmp/a' }]))).toContain('&quot;oldText&quot;:null,&quot;newText&quot;:&quot;&quot;')
  // Literal file content must not be rewritten just because it resembles one header.
  expect(render('Edit', {}, JSON.stringify([{ type: 'diff', path: '/tmp/a', oldText: '-- /dev/null', newText: 'literal text' }]))).toContain('-- /dev/null')
  expect(render('Read', { path: '/tmp/a', offset: 5 }, JSON.stringify({ content: 'line', totalLines: 90 }))).toContain('&quot;totalLines&quot;:90')
  expect(render('Shell', { command: 'run' }, '[INFO] real log')).toContain('data-detail="terminal"')
  for (const fragment of ['{"stdout":"cut off', '[{"type":"content","content":']) {
    const shell = render('Shell', { command: 'run' }, fragment)
    expect(shell).toContain('data-detail="generic"')
    expect(shell).not.toContain('data-detail="terminal"')
  }
  for (const name of ['grep', 'glob', 'web_search', 'web_fetch'] as const) {
    const search = render(name, { query: 'needle' }, 'matches')
    expect(search).toContain(`data-tool-name="${name}"`)
    expect(search).toContain('data-detail="generic"')
  }
})

it('keeps bounded recorded read and diff payloads valid JSON for the real render path', () => {
  for (const [name, output, marker] of [
    ['Read', { content: 'file line\n'.repeat(2000) }, 'data-detail="read"'],
    ['Edit', [{ type: 'diff', path: '/tmp/a', oldText: 'before\n'.repeat(2000), newText: 'after\n'.repeat(2000) }], 'data-detail="diff"'],
    ['Read', Array.from({ length: 150 }, (_, i) => ({ type: 'content', content: { type: 'text', text: `short line ${i}` } })), 'data-detail="generic"'],
  ] as const) {
    const events = toDurableToolEvents({ toolId: '1', name, status: 'completed', input: JSON.stringify({ path: '/tmp/a' }), output: JSON.stringify(output) }, new Set(['1']))
    const update = events.find(event => event.type === CURSOR_AGENT_TOOL_UPDATE)!
    expect(update.data.output!.length).toBeLessThanOrEqual(CURSOR_AGENT_MAX_TOOL_TEXT_CHARS)
    expect(() => JSON.parse(update.data.output!)).not.toThrow()
    expect(update.data.output).toContain('[truncated]')
    const html = renderToStaticMarkup(<CursorAgentToolNode conversationT={conversationT} row={{ key: '1', epoch: 1, firstSeenAt: '', time: '', state: { ...update.data, name } }} />)
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
