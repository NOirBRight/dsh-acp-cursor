/* One folded native sidecar row through the plugin-owned read-only card. */
import type { JSX } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { AcpSettingsKey } from './locales.js'
import type { CursorAgentToolRowData } from './native-activity.js'
import { CursorAgentReadonlyCard } from './CursorAgentReadonlyCard.js'
import { nativeToolBlock, nativeToolSummary } from './native-tool-card.js'

export function CursorAgentToolNode({ row, t, conversationT }: {
  readonly row: CursorAgentToolRowData
  readonly t: (key: AcpSettingsKey) => string
  readonly conversationT: TranslateNS<'conversation'>
}): JSX.Element {
  const parsed = Date.parse(row.firstSeenAt)
  const { toolName, nativeName, callId, block } = nativeToolBlock(row.state, Number.isFinite(parsed) ? parsed : 0)
  return <CursorAgentReadonlyCard callId={callId} toolName={toolName} nativeName={nativeName} summary={nativeToolSummary(row.state, toolName)} block={block} t={t} conversationT={conversationT} />
}
