import { expect, it, vi } from 'vitest'
import { providerId, providerInstanceId, sessionId, turnId, type ExternalAgentTurnHost } from '@deepseek-ai/dsh-acp-provider'
import type { AcpNotificationHandler } from '../src/protocol.js'
import { CursorAgentSession } from '../src/session.js'

const CANCEL = 'Error: RetriableError: [canceled] http/2 stream closed with error code CANCEL (0x8)'
const ITERABLE = 'Error: RetriableError: WritableIterable is closed'
const UNAVAILABLE = 'Error: ConnectError: [unavailable] transport closed'
const ABORTED = 'Error: ConnectError: [aborted] aborted'
const CANCELED_CONNECT = 'Error: ConnectError: [canceled] http/2 stream closed with error code CANCEL (0x8)'
const DEADLINE = 'Error: ConnectError: [deadline_exceeded] timed out'
const SERVER = 'Something went wrong communicating with the server. Please try again.'
const INTERNAL = 'Error: RetriableError: [internal] Failed to run step, exceeded max retries'

function host(): ExternalAgentTurnHost {
  return { publish: vi.fn(), requestPermission: async () => ({ kind: 'cancel' }), requestUserInput: async () => ({ answers: [] }) }
}

function sessionWithChunks(chunks: string[], promptResult: unknown = { stopReason: 'end_turn' }) {
  let notify: AcpNotificationHandler | undefined
  const request = vi.fn(async (method: string): Promise<unknown> => {
    if (method === 'session/prompt') {
      for (const chunk of chunks) {
        notify?.('session/update', {
          sessionId: 's',
          update: { sessionUpdate: 'agent_message_chunk', content: { text: chunk } },
        })
      }
      return promptResult
    }
    return { sessionId: 's' }
  })
  const connection = {
    request,
    notify: vi.fn(),
    setRequestHandler: vi.fn(),
    setNotificationHandler: (next: AcpNotificationHandler | undefined) => { notify = next },
    close: async () => undefined,
  }
  const session = new CursorAgentSession(connection, providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('dump'),
  }, 'scope')
  return { session, request }
}

async function runDump(chunks: string[], promptResult?: unknown) {
  const { session } = sessionWithChunks(chunks, promptResult)
  const turnHost = host()
  const result = await session.runTurn({
    turn: turnId('dump'),
    prompt: 'Continue.',
    permissionMode: 'approval-required',
    signal: new AbortController().signal,
  }, turnHost)
  await session.dispose()
  const published = vi.mocked(turnHost.publish).mock.calls.flatMap(([event]) => (
    event.type === 'assistant-delta' ? [event.text] : []
  )).join('')
  return { ...result, published }
}

it('fails a native turn whose assistant text is only a CANCEL transport dump', async () => {
  const result = await runDump([CANCEL])
  expect(result.status).toBe('failed')
  expect(result.error).toBe(CANCEL)
  expect(result.text).toBe(CANCEL)
  expect(result.resumeCursor).toBeDefined()
})

it('redacts secrets in the dump error while keeping the resume cursor', async () => {
  const dumped = `${CANCEL} sk-secret.token_value`
  const result = await runDump([dumped])
  expect(result.status).toBe('failed')
  expect(result.error).toBe(`${CANCEL} [redacted]`)
  expect(result.text).toBe(dumped)
  expect(result.resumeCursor).toBeDefined()
})

it('fails WritableIterable and ConnectError unavailable dumps', async () => {
  expect((await runDump([ITERABLE])).status).toBe('failed')
  expect((await runDump([UNAVAILABLE])).status).toBe('failed')
  expect((await runDump([ABORTED])).status).toBe('failed')
  expect((await runDump([CANCELED_CONNECT])).status).toBe('failed')
  expect((await runDump([DEADLINE])).status).toBe('failed')
  expect((await runDump([SERVER])).status).toBe('failed')
})

it('fails a dump delivered in streamed chunks or with a stack', async () => {
  expect((await runDump([...CANCEL])).status).toBe('failed')
  expect((await runDump([CANCEL, '\n    at send (cli.js:1:2)\n'])).status).toBe('failed')
})

it('strips a trailing CANCEL dump after a real answer and keeps the turn completed', async () => {
  const result = await runDump(['I inspected the files.\n\n' + CANCEL])
  expect(result.status).toBe('completed')
  expect(result.text).toBe('I inspected the files.')
  expect(result.published).toBe('I inspected the files.')
  expect(result.published.includes('RetriableError')).toBe(false)
})

it('strips a trailing CANCEL dump streamed after a real answer', async () => {
  const result = await runDump(['occupant 注册，并让后到的声明跳过已占用的 hole。\n\n', ...CANCEL])
  expect(result.status).toBe('completed')
  expect(result.text).toBe('occupant 注册，并让后到的声明跳过已占用的 hole。')
  expect(result.published.includes('RetriableError')).toBe(false)
  expect(result.published.includes('CANCEL')).toBe(false)
})

it('completes fenced dumps, quoted dumps, and agent-loop exhaustion', async () => {
  expect((await runDump(['```text\n' + CANCEL + '\n```'])).status).toBe('completed')
  expect((await runDump(['the error was "' + CANCEL + '"'])).status).toBe('completed')
  expect((await runDump([INTERNAL])).status).toBe('completed')
})

it('fails a RetriableError that is not the agent-loop exhaustion line', async () => {
  expect((await runDump(['Error: RetriableError: [internal] boom'])).status).toBe('failed')
})

it('keeps a cancelled turn cancelled even when the text looks like a dump', async () => {
  expect((await runDump([CANCEL], { stopReason: 'cancelled' })).status).toBe('cancelled')
})

it('keeps structured ACP errors and stopReason error/refusal as ordinary failed native turns', async () => {
  const structured = await runDump([CANCEL], { stopReason: 'end_turn', error: 'structured boom' })
  expect(structured.status).toBe('failed')
  expect(structured.error).toBe('structured boom')
  expect((await runDump([CANCEL], { stopReason: 'error' })).error).toBe('error')
  expect((await runDump([CANCEL], { stopReason: 'refusal' })).error).toBe('refusal')
  const dumpShaped = await runDump([CANCEL], { stopReason: 'end_turn', error: CANCEL })
  expect(dumpShaped.status).toBe('failed')
  expect(dumpShaped.error).toBe('provider turn failed')
})

it('completes an ordinary answer', async () => {
  expect((await runDump(['Done.'])).status).toBe('completed')
})

it('keeps a last line that only looks like an in-progress dump prefix', async () => {
  const result = await runDump(['The build failed.\nError'])
  expect(result.status).toBe('completed')
  expect(result.text).toBe('The build failed.\nError')
  expect(result.published).toBe('The build failed.\nError')
  const streamed = await runDump(['The build failed.\n', 'Error'])
  expect(streamed.text).toBe('The build failed.\nError')
  expect(streamed.published).toBe('The build failed.\nError')
})
