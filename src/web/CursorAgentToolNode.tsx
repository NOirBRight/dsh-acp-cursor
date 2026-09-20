/* One folded native sidecar row through the shared ACP read-only tool card. */
import type { JSX } from 'react'
import { NativeToolCard, type NativeToolTranslate } from '@deepseek-ai/dsh-acp-provider/native-ui'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CursorAgentToolRowData } from './native-activity.js'
import { nativeToolCardModel, nativeToolDisplaySummary } from './native-tool-card.js'

export function CursorAgentToolNode({ row, conversationT }: {
  readonly row: CursorAgentToolRowData
  readonly conversationT: TranslateNS<'conversation'>
}): JSX.Element {
  const translate: NativeToolTranslate = conversationT
  const model = nativeToolCardModel(row.state)
  return <NativeToolCard {...model} summary={nativeToolDisplaySummary(row.state, model.toolName, translate)} t={translate} />
}
