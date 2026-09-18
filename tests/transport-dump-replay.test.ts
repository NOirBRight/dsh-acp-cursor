import { expect, it } from 'vitest'
import {
  ExternalAgentProviderRegistry,
  providerId,
  sessionId,
  toolId,
  type ExternalAgentSession,
  type ExternalAgentTurnRequest,
} from '@deepseek-ai/dsh-acp-provider'
import { FakeExternalAgentProvider } from '@deepseek-ai/dsh-acp-provider/fake'
import { createCursorAgentLlmBridge } from '../src/llm-bridge.js'

const CANCEL = 'Error: RetriableError: [canceled] http/2 stream closed with error code CANCEL (0x8)'
const MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const

async function collect(stream: AsyncIterable<unknown>) {
  const chunks: unknown[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function finishOf(chunks: unknown[]) {
  const last = chunks.at(-1)
  return last !== null && typeof last === 'object' && 'type' in last && last.type === 'finish' ? last as { type: 'finish'; reason: { kind: string; failure?: { code: string } } } : undefined
}

async function streamDump(scripts: Parameters<FakeExternalAgentProvider['enqueue']>[0][]) {
  const prompts: string[] = []
  const fake = new FakeExternalAgentProvider('cursor-agent', [
    { id: 'composer-2.5', name: 'Composer 2.5', supportedModes: [...MODES] },
  ], { scripts })
  const provider = {
    info: fake.info,
    listModels: (signal?: AbortSignal) => fake.listModels(signal),
    openSession: async (request: Parameters<FakeExternalAgentProvider['openSession']>[0]) => {
      const session = await fake.openSession(request)
      return {
        ref: session.ref,
        supportedModes: session.supportedModes,
        runTurn: async (turn: ExternalAgentTurnRequest, host: Parameters<ExternalAgentSession['runTurn']>[1]) => {
          prompts.push(turn.prompt)
          return session.runTurn(turn, host)
        },
        dispose: () => session.dispose(),
      }
    },
    dispose: () => fake.dispose(),
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge({ registry, getProvider: () => provider as never })
  const chunks = await collect(adapter.stream({
    provider: 'cursor-agent',
    model: 'composer-2.5',
    sessionId: String(sessionId('replay')),
    messages: [{ source: { kind: 'user' }, content: 'Ship the fix.' }],
  }))
  await adapter.dispose()
  await unregister()
  await fake.dispose()
  return { chunks, prompts, finish: finishOf(chunks) }
}

it('replays the original prompt once after a transport-dump failed native turn', async () => {
  const { prompts, finish } = await streamDump([
    { result: { status: 'failed', text: CANCEL, error: CANCEL } },
    { events: [{ type: 'assistant-delta', text: 'Shipped.' }], result: { status: 'completed', text: 'Shipped.' } },
  ])
  expect(prompts).toEqual(['Ship the fix.', 'Ship the fix.'])
  expect(finish?.reason.kind).toBe('stop')
})

it('replays the original prompt even when the dumped turn already ran tools', async () => {
  const { prompts, finish } = await streamDump([
    {
      events: [{ type: 'tool-activity', toolId: toolId('t1'), name: 'edit', status: 'completed' }],
      result: { status: 'failed', text: CANCEL, error: CANCEL },
    },
    { events: [{ type: 'assistant-delta', text: 'Shipped.' }], result: { status: 'completed', text: 'Shipped.' } },
  ])
  expect(prompts).toEqual(['Ship the fix.', 'Ship the fix.'])
  expect(finish?.reason.kind).toBe('stop')
})

it('fails the stream when the replay is also a transport dump', async () => {
  const { prompts, finish } = await streamDump([
    { result: { status: 'failed', text: CANCEL, error: CANCEL } },
    { result: { status: 'failed', text: CANCEL, error: CANCEL } },
  ])
  expect(prompts).toEqual(['Ship the fix.', 'Ship the fix.'])
  expect(finish?.reason).toEqual({ kind: 'error', failure: { code: 'NATIVE_TURN_FAILED', message: CANCEL } })
})

it('does not replay a cancelled turn, a healthy answer, or a non-dump failure', async () => {
  const cancelled = await streamDump([{ result: { status: 'cancelled', text: CANCEL } }])
  expect(cancelled.prompts).toEqual(['Ship the fix.'])
  expect(cancelled.finish?.reason.kind).toBe('aborted')
  const ok = await streamDump([{ events: [{ type: 'assistant-delta', text: 'Done.' }], result: { status: 'completed', text: 'Done.' } }])
  expect(ok.prompts).toEqual(['Ship the fix.'])
  expect(ok.finish?.reason.kind).toBe('stop')
  const other = await streamDump([{ result: { status: 'failed', text: 'native exploded', error: 'native exploded' } }])
  expect(other.prompts).toEqual(['Ship the fix.'])
  expect(other.finish?.reason.kind).toBe('error')
})
