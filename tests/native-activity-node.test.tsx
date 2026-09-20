import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const disclosure: Array<{ keepContentWhenOpen?: boolean }> = []

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  DisclosureRow: (props: { title: string; keepContentWhenOpen?: boolean; collapsedContent?: unknown; children?: unknown }) => {
    disclosure.push(props)
    return <div data-disclosure-row="">{props.title}{props.collapsedContent}{props.children}</div>
  },
  MarkdownText: (props: { text: string }) => <div>{props.text}</div>,
  IconSparkle16: () => null,
  IconAgentPresetOutline16: () => null,
}))

vi.mock('@deepseek-ai/dsh-acp-provider/native-ui', () => ({
  NativeToolCard: () => <div data-native-tool-card="" />,
}))

import { NativeActivityNode } from '../src/web/NativeActivityNode.tsx'

const labels = {
  t: (key: string) => key,
  conversationT: ((key: string) => key) as never,
}

describe('native thought disclosure', () => {
  it('hides the one-line summary when the thought row is expanded', () => {
    disclosure.length = 0
    renderToStaticMarkup(<NativeActivityNode
      t={labels.t}
      conversationT={labels.conversationT}
      branch={{
        kind: 'text',
        key: '1',
        text: '这是一条 idea → ship 主路径',
        thought: true,
        order: 1,
        firstSeenAt: '2026-09-18T00:00:00.000Z',
      }}
    />)
    expect(disclosure).toHaveLength(1)
    expect(disclosure[0]?.keepContentWhenOpen).toBeFalsy()
  })
})
