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
  writeClipboard,
  type DiffHunk,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AcpSettingsKey } from './locales.js'
import { isRecord } from '../decode.js'
import { parseRecord } from './native-tool-card.js'

type RowState = 'running' | 'ok' | 'error'

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
  let rowState: RowState = 'running'
  let args = ''
  let result: string | undefined
  if ('kind' in block) {
    rowState = block.isError ? 'error' : 'ok'
    args = block.call?.argsRaw ?? ''
    result = block.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('')
  } else {
    args = block.argsRaw
  }
  const rawTodos = toolName === 'todo_write' ? parseRecord(args)?.todos : undefined
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
  toolName: string; args: string; result: string | undefined; state: RowState; t: TranslateNS<'conversation'>
}): ReactNode {
  const [inspect, setInspect] = useState(false)
  const inspectable = (body: ReactNode) => <>{body}
    <button type="button" aria-expanded={inspect} onClick={() => { setInspect(value => !value) }}
      style={{ marginTop: 8, padding: '2px 8px', borderRadius: 12, border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', fontSize: 11, cursor: 'pointer' }}>{t('row.inspect')}</button>
    {inspect ? <IOCard args={args} result={result} state={state} t={t} /> : null}
  </>
  const input = parseRecord(args) ?? {}
  const output = result === undefined ? undefined : parse(result)
  // Legacy history cut JSON mid-string; never present that fragment as file content.
  const unparsedJson = toolName === 'read' && typeof output === 'string' && output === result && /^[\s]*[\[{]/u.test(output)
  const text = unparsedJson ? undefined : outputText(output)
  if (toolName === 'read' && state !== 'error' && result === '') return inspectable(<div data-card-empty-result style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>{t('terminal.noOutput')}</div>)
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
      const total = record(output).totalLines
      const totalLines = typeof total === 'number' && Number.isSafeInteger(total) && total >= offset + lines.length - 1 ? total : lines.length
      return inspectable(<ReadBlock label={path} lines={lines} totalLines={totalLines} maxLines={8}
        labels={{ ...labels('read'), window: (shown, total) => t('read.window', { shown, total }) }} />)
    }
    if (toolName === 'edit' || toolName === 'write') {
      const diffs: DiffHunk[] = []
      if (Array.isArray(output)) {
        for (const item of output) {
          const diff = record(item)
          if (diff.type !== 'diff' || typeof diff.path !== 'string' || typeof diff.newText !== 'string' || !(diff.oldText === null || typeof diff.oldText === 'string')) { diffs.length = 0; break }
          // Cursor's new-file adapter can leave these paired unified-diff headers in ACP content.
          const header = `++ b/${diff.path}`
          const created = diff.oldText === '-- /dev/null' && (diff.newText === header || diff.newText.startsWith(header + '\n'))
          diffs.push({ path: diff.path, oldText: created ? null : diff.oldText, newText: created ? diff.newText.slice(header.length + 1) : diff.newText })
        }
      }
      if (diffs.length === 0 && path !== undefined) {
        if (toolName === 'write' && typeof input.content === 'string') diffs.push({ path, oldText: null, newText: input.content })
        if (toolName === 'edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') diffs.push({ path, oldText: input.old_string, newText: input.new_string })
      }
      if (diffs.length > 0) return inspectable(<DiffBlock diffs={diffs} maxLines={9}
        labels={{ ...labels('diff'), files: count => t(count === 1 ? 'diff.files.one' : 'diff.files.other', { count }) }} />)
    }
    const command = input.command ?? input.cmd
    const shell = record(output)
    const terminalOutput = text ?? (typeof shell.stdout === 'string' || typeof shell.stderr === 'string'
      ? [shell.stdout, shell.stderr].filter((part): part is string => typeof part === 'string').join('') : undefined)
    if (toolName === 'bash' && typeof command === 'string' && (result === undefined || terminalOutput !== undefined)) {
      const exitCode = shell.exitCode ?? shell.exit_code
      return inspectable(<TerminalBlock command={command} output={terminalOutput} running={state === 'running'}
        cwd={typeof input.workdir === 'string' ? input.workdir : undefined}
        exitCode={typeof exitCode === 'number' && Number.isInteger(exitCode) ? exitCode : undefined}
        labels={{ ...labels('terminal'), signal: signal => t('terminal.signal', { signal }), exitCode: code => t('terminal.exitCode', { code }),
          running: t('terminal.running'), failed: t('terminal.failed'), done: t('terminal.done'), noOutput: t('terminal.noOutput') }} />)
    }
  }
  return <IOCard args={args} result={result} state={state} t={t} />
}

function IOCard({ args, result, state, t }: { args: string; result: string | undefined; state: RowState; t: TranslateNS<'conversation'> }): ReactNode {
  const [copied, setCopied] = useState<string>()
  return <div data-native-io style={{ border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, overflow: 'hidden', font: 'var(--dsw-font-markdown-code-block)', color: 'var(--dsw-alias-label-secondary)' }}>
    {([['row.input', args || undefined], ['row.output', result]] as const).map(([label, text]) => text === undefined ? null : <div key={label}
      data-card-result={label === 'row.output' ? state : undefined}
      style={{ ...ioSection, borderTop: label === 'row.output' && args !== '' ? '1px solid var(--dsw-alias-border-l2)' : undefined }}>
      <span style={{ color: 'var(--dsw-alias-label-caption)', flexShrink: 0 }}>{t(label)}</span>
      <pre style={{ ...ioText, color: label === 'row.output' && state === 'error' ? 'var(--dsw-alias-state-error-primary)' : undefined }}>{pretty(text)}</pre>
      <button type="button" data-native-copy aria-label={`${t('copy')} ${t(label)}`}
        style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        onClick={() => { void writeClipboard(pretty(text)).then(ok => { if (ok) setCopied(text) }) }}>{copied === text ? t('copied') : t('copy')}</button>
    </div>)}
  </div>
}
