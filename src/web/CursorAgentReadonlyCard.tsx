/* DSH ToolRow chrome for folded native sidecar rows: DisclosureRow 24px, type icon, title + summary. */
import { useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import {
  DisclosureRow,
  IconApiOutline14,
  IconBrowseOutline16,
  IconEditOutline16,
  IconGlobeOutline14,
  IconSearchOutline16,
  IconSparkle16,
  IconChecklistOutline14,
  ReadBlock,
  DiffBlock,
  TerminalBlock,
  type DiffHunk,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AcpSettingsKey } from './locales.js'
import { isRecord } from '../decode.js'

const TITLE_KEYS = {
  read: 'tool.title.read',
  todo_write: 'todo.rowTitle',
  bash: 'tool.title.bash',
  grep: 'tool.title.search',
  glob: 'tool.title.search',
  web_search: 'tool.title.search',
  web_fetch: 'tool.title.search',
  write: 'tool.title.write',
  edit: 'tool.title.edit',
} as const

const sep = ' \u00b7 '

export function CursorAgentReadonlyCard({ callId, toolName, nativeName, summary, block, t, conversationT }: {
  readonly callId: string
  readonly toolName: string
  readonly nativeName: string
  readonly summary: string
  readonly block: ToolCallBlock
  readonly t: (key: AcpSettingsKey) => string
  readonly conversationT: TranslateNS<'conversation'>
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [inspect, setInspect] = useState(false)
  let rowState: 'running' | 'ok' | 'error' = 'running'
  let args = ''
  let result: string | undefined
  if ('kind' in block) {
    rowState = block.isError ? 'error' : 'ok'
    args = block.call?.argsRaw ?? ''
    result = block.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')
  } else {
    args = block.argsRaw
  }
  const rawTodos = toolName === 'todo_write' ? record(parse(args)).todos : undefined
  const todos = Array.isArray(rawTodos) ? rawTodos.map(item => ({ ...record(item), status: String(record(item).status).replace(/^TODO_STATUS_/u, '').toLowerCase() })) : undefined
  if (Array.isArray(todos) && todos.every(item => typeof record(item).content === 'string' && ['pending', 'in_progress', 'completed'].includes(String(record(item).status)))) {
    const done = todos.filter(item => record(item).status === 'completed').length
    const active = todos.find(item => record(item).status === 'in_progress')
    summary = conversationT('todo.completed', { done, total: todos.length }) + (active === undefined ? '' : sep + String(record(active).content))
  }
  const title = titleOf(toolName, conversationT)
  const expandable = args !== '' || result !== undefined
  const renamed = nativeName !== '' && nativeName !== toolName && nativeName !== title
  return <div data-native-tool-card={callId} data-state={rowState} title={renamed ? nativeName : title} aria-label={title + (summary === '' ? '' : sep + summary)}>
    <DisclosureRow
      icon={iconOf(toolName)}
      title={title}
      open={open}
      expandable={expandable}
      expandOnRowClick
      keepContentWhenOpen
      onToggle={() => { setOpen(value => !value) }}
      collapsedContent={summary === '' ? null : <span data-card-summary={summary} style={{ minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-tertiary)', fontSize: 14, lineHeight: '24px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sep + summary}</span>}
    >
      <div style={{ minWidth: 0, paddingTop: 6 }}>
        <ToolBody toolName={toolName} args={args} result={result} state={rowState} t={conversationT} />
        <button type="button" aria-expanded={inspect} onClick={() => { setInspect(value => !value) }}
          style={{ marginTop: 8, padding: '2px 8px', borderRadius: 12, border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', fontSize: 11, cursor: 'pointer' }}>{conversationT('row.inspect')}</button>
        {inspect ? <IOCard args={args} result={result} state={rowState} t={conversationT} /> : null}
      </div>
    </DisclosureRow>
  </div>
}

function titleOf(toolName: string, conversationT: TranslateNS<'conversation'>): string {
  const key = TITLE_KEYS[toolName as keyof typeof TITLE_KEYS]
  return key === undefined ? conversationT('tool.title.generic') : conversationT(key)
}

function iconOf(toolName: string): ReactNode {
  switch (toolName) {
    case 'todo_write': return <IconChecklistOutline14 size={14} />
    case 'read': return <IconBrowseOutline16 size={14} />
    case 'grep':
    case 'glob':
    case 'web_search': return <IconSearchOutline16 size={14} />
    case 'bash': return <IconApiOutline14 size={14} />
    case 'write':
    case 'edit': return <IconEditOutline16 size={14} />
    case 'web_fetch': return <IconGlobeOutline14 size={14} />
    default: return <IconSparkle16 size={14} />
  }
}

const ioSection: CSSProperties = { display: 'flex', gap: 12, padding: '10px 16px', minWidth: 0 }
const ioText: CSSProperties = { margin: 0, minWidth: 0, flex: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'auto', maxHeight: 240, font: 'inherit' }

function parse(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/** Unwrap only known ACP text envelopes; unknown payloads stay visible in IN/OUT. */
function outputText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  const object = record(value)
  if (typeof object.content === 'string') return object.content
  if (object.type === 'text' && typeof object.text === 'string') return object.text
  if (object.type === 'content') return outputText(object.content)
  if (Array.isArray(value)) {
    const parts = value.map(outputText)
    if (parts.every(part => part !== undefined)) return parts.join('\n')
  }
  return undefined
}

function pretty(text: string): string {
  const value = parse(text)
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function ToolBody({ toolName, args, result, state, t }: {
  toolName: string; args: string; result: string | undefined; state: 'running' | 'ok' | 'error'; t: TranslateNS<'conversation'>
}): ReactNode {
  const input = record(parse(args))
  const output = result === undefined ? undefined : parse(result)
  // Legacy history cut JSON mid-string; never present that fragment as file content.
  const unparsedJson = typeof output === 'string' && output === result && /^[\s]*[\[{]/u.test(output)
  const text = unparsedJson ? undefined : outputText(output)
  if (toolName === 'read' && state !== 'error' && result === '') return <div data-card-empty-result style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>{t('terminal.noOutput')}</div>
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.path === 'string' ? input.path : undefined
  const labels = (kind: 'read' | 'diff' | 'terminal') => ({
    copy: t('copy'), copied: t('copied'), collapse: t('collapse'),
    collapseAria: t(`${kind}.collapseAria`),
    expandAria: (count: number) => t(`${kind}.expandAria`, kind === 'terminal' ? { n: count } : { count }),
    expand: (count: number) => t(`${kind}.expandRest`, kind === 'terminal' ? { n: count } : { count }),
  })
  if (state !== 'error') {
    if (toolName === 'read' && path !== undefined && text !== undefined) {
      const offset = typeof input.offset === 'number' && Number.isSafeInteger(input.offset) && input.offset > 0 ? input.offset : 1
      const lines = (text === '' ? [] : text.replace(/\n$/u, '').split('\n')).map((line, index) => ({ number: offset + index, text: line }))
      return <ReadBlock label={path} lines={lines} totalLines={lines.length} maxLines={8}
        labels={{ ...labels('read'), window: (shown, total) => t('read.window', { shown, total }) }} />
    }
    if (toolName === 'edit' || toolName === 'write') {
      const diffs: DiffHunk[] = []
      if (Array.isArray(output)) {
        for (const item of output) {
          const diff = record(item)
          if (diff.type !== 'diff' || typeof diff.path !== 'string' || typeof diff.newText !== 'string' || !(diff.oldText === null || typeof diff.oldText === 'string')) { diffs.length = 0; break }
          diffs.push({ path: diff.path, oldText: diff.oldText, newText: diff.newText })
        }
      }
      if (diffs.length === 0 && path !== undefined) {
        if (toolName === 'write' && typeof input.content === 'string') diffs.push({ path, oldText: null, newText: input.content })
        if (toolName === 'edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') diffs.push({ path, oldText: input.old_string, newText: input.new_string })
      }
      if (diffs.length > 0) return <DiffBlock diffs={diffs} maxLines={9}
        labels={{ ...labels('diff'), files: count => t(count === 1 ? 'diff.files.one' : 'diff.files.other', { count }) }} />
    }
    const command = input.command ?? input.cmd
    const shell = record(output)
    const terminalOutput = text ?? (typeof shell.stdout === 'string' || typeof shell.stderr === 'string'
      ? [shell.stdout, shell.stderr].filter((part): part is string => typeof part === 'string').join('') : undefined)
    if (toolName === 'bash' && typeof command === 'string' && (result === undefined || terminalOutput !== undefined)) {
      const exitCode = shell.exitCode ?? shell.exit_code
      return <TerminalBlock command={command} output={terminalOutput} running={state === 'running'} maxLines={Infinity}
        cwd={typeof input.workdir === 'string' ? input.workdir : undefined}
        exitCode={typeof exitCode === 'number' && Number.isInteger(exitCode) ? exitCode : undefined}
        labels={{ ...labels('terminal'), signal: signal => t('terminal.signal', { signal }), exitCode: code => t('terminal.exitCode', { code }),
          running: t('terminal.running'), failed: t('terminal.failed'), done: t('terminal.done'), noOutput: t('terminal.noOutput') }} />
    }
  }
  return <IOCard args={args} result={result === undefined ? undefined : text ?? result} state={state} t={t} />
}

function IOCard({ args, result, state, t }: { args: string; result: string | undefined; state: string; t: TranslateNS<'conversation'> }): ReactNode {
  return <div data-native-io style={{ border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, overflow: 'hidden', font: 'var(--dsw-font-markdown-code-block)', color: 'var(--dsw-alias-label-secondary)' }}>
    {args === '' ? null : <div style={ioSection}><span style={{ color: 'var(--dsw-alias-label-caption)', flexShrink: 0 }}>{t('row.input')}</span><pre style={ioText}>{pretty(args)}</pre></div>}
    {result === undefined ? null : <div data-card-result={state} style={{ ...ioSection, borderTop: args === '' ? undefined : '1px solid var(--dsw-alias-border-l2)' }}>
      <span style={{ color: 'var(--dsw-alias-label-caption)', flexShrink: 0 }}>{t('row.output')}</span>
      <pre style={{ ...ioText, color: state === 'error' ? 'var(--dsw-alias-state-error-primary)' : undefined }}>{pretty(result)}</pre>
    </div>}
  </div>
}
