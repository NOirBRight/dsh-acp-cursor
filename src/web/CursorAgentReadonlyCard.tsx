/* DSH ToolRow chrome for folded native sidecar rows: DisclosureRow 24px, type icon, title + summary. */
import { useState, type JSX, type ReactNode } from 'react'
import {
  DisclosureRow,
  IconApiOutline14,
  IconBrowseOutline16,
  IconEditOutline16,
  IconGlobeOutline14,
  IconSearchOutline16,
  IconSparkle16,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AcpSettingsKey } from './locales.js'

const TITLE_KEYS = {
  read: 'tool.title.read',
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
      {args === '' ? null : <PayloadBlock label={t('activityInput')} text={pretty(args)} filename="input.json" t={t} />}
      {result === undefined ? null : result === ''
        ? <div data-card-empty-result={true} style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>{t('activityNoOutput')}</div>
        : <div data-card-result={rowState === 'error' ? 'error' : 'ok'}><PayloadBlock label={t('activityOutput')} text={pretty(result)} filename="output.txt" t={t} /></div>}
    </DisclosureRow>
  </div>
}

function titleOf(toolName: string, conversationT: TranslateNS<'conversation'>): string {
  const key = TITLE_KEYS[toolName as keyof typeof TITLE_KEYS]
  return key === undefined ? conversationT('tool.title.generic') : conversationT(key)
}

function iconOf(toolName: string): ReactNode {
  switch (toolName) {
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

const banner: { display: 'flex'; alignItems: 'center'; gap: number; width: '100%'; boxSizing: 'border-box'; padding: string } = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '9px 14px',
}
const actions: { display: 'flex'; marginLeft: 'auto'; flexShrink: number; gap: number } = {
  display: 'flex', marginLeft: 'auto', flexShrink: 0, gap: 8,
}
const ghost: { background: 'transparent'; border: 0; padding: 0; cursor: 'pointer'; color: 'var(--dsw-alias-label-secondary)'; font: string } = {
  background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'var(--dsw-alias-label-secondary)', font: '11px/18px var(--dsw-font-family)',
}

function PayloadBlock({ label, text, filename, t }: {
  readonly label: string
  readonly text: string
  readonly filename: string
  readonly t: (key: AcpSettingsKey) => string
}): JSX.Element {
  const [copied, setCopied] = useState(false)
  return <div data-native-payload={label} style={{ width: '100%', minWidth: 0, borderRadius: 12, background: 'var(--dsw-alias-markdown-code-block)' }}>
    <div style={banner}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div data-native-payload-actions style={actions}>
        <button type="button" data-native-copy style={ghost} onClick={() => {
          void writeClipboard(text).then(ok => {
            if (!ok) return
            setCopied(true)
            window.setTimeout(() => { setCopied(false) }, 1000)
          })
        }}>{copied ? t('markdownCopied') : t('markdownCopy')}</button>
        <button type="button" data-native-download style={ghost} onClick={() => { downloadText(filename, text) }}>{t('activityDownload')}</button>
      </div>
    </div>
    <pre style={{ margin: 0, padding: '0 14px 14px', overflow: 'auto', maxHeight: 240, font: 'var(--dsw-font-markdown-code-block)' }}>{text}</pre>
  </div>
}

function pretty(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}
