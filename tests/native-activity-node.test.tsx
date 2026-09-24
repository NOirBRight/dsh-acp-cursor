import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  DisclosureRow: (props: { icon: ReactNode; title: string; collapsedContent?: ReactNode; children?: ReactNode }) =>
    <div>{props.icon}{props.title}{props.collapsedContent}{props.children}</div>,
  MarkdownText: (props: { text: string }) => <div>{props.text}</div>,
  IconSparkleRegular: () => <svg />,
  IconAgentPresetOutlineRegular: () => <svg />,
}))

vi.mock('@deepseek-ai/dsh-acp-provider/native-ui', () => ({ NativeToolCard: () => null }))
import { NativeActivityNode } from '../src/web/NativeActivityNode.tsx'

const labels = {
  t: (key: string) => key,
  conversationT: ((key: string) => key) as never,
}

describe('native activity with the Alpha2 primitive exports', () => {
  it('renders thought and child-agent disclosures without an invalid React element', () => {
    const thought = renderToStaticMarkup(<NativeActivityNode
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
    expect(thought).toContain('activityThink')
    expect(thought).toContain('这是一条 idea → ship 主路径')

    const agent = renderToStaticMarkup(<NativeActivityNode
      t={labels.t}
      conversationT={labels.conversationT}
      branch={{
        kind: 'agent',
        key: 'agent-1',
        trajectoryId: 'child-trajectory-1',
        firstSeenAt: '2026-09-18T00:00:00.000Z',
        order: 2,
        toolCount: 0,
        running: false,
        children: [],
      }}
    />)
    expect(agent).toContain('activitySubagent')
  })
})
