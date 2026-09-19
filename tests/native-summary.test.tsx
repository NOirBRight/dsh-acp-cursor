import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { CursorAgentAgentTextRow } from '../src/web/native-activity.js'

const state = vi.hoisted(() => ({ texts: [] as CursorAgentAgentTextRow[] }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}))
vi.mock('../src/web/native-activity.js', () => ({
  getNativeHistoryStore: () => ({
    subscribe: () => () => {},
    getSnapshot: () => ({ rows: [], agents: [], texts: state.texts }),
  }),
}))
vi.mock('../src/web/NativeActivityNode.js', () => ({
  NativeActivityNode: ({ branch }: { branch: { text?: string } }) => <div>{branch.text}</div>,
}))
import { NativeTurnContainer } from '../src/web/NativeTurnContainer.js'

function renderSummary(activity: string, answer: string, visibility: 'visible' | 'hidden' = 'visible', answerTurn = 1, source: 'assistant' | 'plan' | null = 'assistant') {
  state.texts = ['thinking', activity].map((text, index) => ({
    key: String(index + 1), epoch: 1, firstSeenAt: '2026-09-19T00:00:01.000Z',
    ...(source === null ? {} : { source }),
    trajectoryId: 'cursor-agent-parent', kind: index === 0 ? 'thought' : 'text', text,
  }))
  const assistant = {
    kind: 'assistant-step', visibility,
    data: { turn: answerTurn, status: 'settled', blocks: [{ kind: 'text', text: answer }] },
  }
  const snapshot = {
    timeline: { turnOrder: [1], turns: new Map([[1, { start: { time: Date.parse('2026-09-19T00:00:00.000Z') } }]]) },
    locations: { getTurn: (turn: number) => turn === answerTurn ? ['answer'] : [] },
    nodes: { get: () => assistant },
  } as unknown as ChatSnapshot
  return renderToStaticMarkup(<>
    <NativeTurnContainer
      node={{ data: { turn: 1, startMs: Date.parse('2026-09-19T00:00:00.000Z'), endMs: null } } as ChatNode<'cursor-agent-native'>}
      t={key => key} conversationT={((key: string) => key) as never}
      rpc={{} as never} sessionId={'summary' as never}
      uiConversation={{ binding: () => ({ target: () => ({ subscribe: () => () => {}, getSnapshot: () => snapshot }) }) } as never}
    />
    {visibility === 'visible' && answerTurn === 1 ? <div>{answer}</div> : null}
  </>)
}

describe('native summary presentation', () => {
  it.each([
    ['SUMMARY', 'SUMMARY'],
    ['SUMMARY' + 'x'.repeat(4000), 'SUMMARY' + 'x'.repeat(8000)],
    ['firstSUMMARY', 'first\nSUMMARY'],
    ['failed prefixSUMMARY', 'SUMMARY'],
    ['', 'SUMMARY'],
  ])('shows the authoritative answer once and retains thoughts (%#)', (activity, answer) => {
    const markup = renderSummary(activity, answer)
    expect(markup.split('SUMMARY')).toHaveLength(2)
    expect(markup).toContain('thinking')
    expect(markup).toContain(answer)
  })

  it('retains legacy plan text absent from the final answer', () => {
    expect(renderSummary('Independent plan', 'SUMMARY', 'visible', 1, null)).toContain('Independent plan')
    expect(renderSummary('Independent planSUMMARY', 'SUMMARY', 'visible', 1, null)).toContain('Independent plan')
  })

  it('retains a plan even when its wording matches the answer', () => {
    expect(renderSummary('PLAN', 'PLAN', 'visible', 1, 'plan').split('PLAN')).toHaveLength(3)
  })

  it('deduplicates legacy replies without hiding their unique prefix', () => {
    expect(renderSummary('SUMMARY', 'SUMMARY', 'visible', 1, null).split('SUMMARY')).toHaveLength(2)
    const markup = renderSummary('Independent planSUMMARY', 'SUMMARY', 'visible', 1, null)
    expect(markup.split('SUMMARY')).toHaveLength(2)
    expect(markup).toContain('Independent plan')
  })

  it('keeps live text before an answer is available', () => {
    expect(renderSummary('SUMMARY', '').split('SUMMARY')).toHaveLength(2)
  })

  it('does not suppress text for a hidden answer or another turn', () => {
    expect(renderSummary('SUMMARY', 'SUMMARY', 'hidden').split('SUMMARY')).toHaveLength(2)
    expect(renderSummary('SUMMARY', 'SUMMARY', 'visible', 2).split('SUMMARY')).toHaveLength(2)
  })
})
