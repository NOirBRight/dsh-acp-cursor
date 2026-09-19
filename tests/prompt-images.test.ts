import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import {
  ExternalAgentProviderRegistry,
  providerId,
  providerInstanceId,
  sessionId,
  turnId,
  type ExternalAgentTurnHost,
  type ExternalAgentTurnRequest,
} from '@deepseek-ai/dsh-acp-provider'
import { createCursorAgentLlmBridge } from '../src/llm-bridge.js'
import { CursorAgentSession } from '../src/session.js'
import type { CursorAgentClientFilesystem } from '../src/types.js'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const MODES = ['approval-required', 'auto-accept-edits', 'full-access'] as const
const IMAGE_REF = { attachmentId: 'att-1', mediaType: 'image/png', bytes: PNG.byteLength, width: 1, height: 1, name: 'palm.png' }

function host(): ExternalAgentTurnHost {
  return { publish: vi.fn(), requestPermission: async () => ({ kind: 'cancel' }), requestUserInput: async () => ({ answers: [] }) }
}

async function collect(stream: AsyncIterable<unknown>) {
  const chunks: unknown[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

async function streamTurns(messages: readonly unknown[], readImage?: (attachment: unknown) => Promise<{ data: Uint8Array; mimeType: string; name?: string }>) {
  const turns: ExternalAgentTurnRequest[] = []
  const provider = {
    info: { id: providerId('cursor-agent'), name: 'Cursor' },
    listModels: async () => [{ id: 'composer-2.5', name: 'Composer 2.5', supportedModes: [...MODES] }],
    openSession: async () => ({
      ref: { provider: providerId('cursor-agent'), session: sessionId('s'), nativeSession: sessionId('n') },
      supportedModes: [...MODES],
      dispose: async () => undefined,
      runTurn: async (request: ExternalAgentTurnRequest) => {
        turns.push(request)
        return { status: 'completed' as const, text: 'ok' }
      },
    }),
  }
  const registry = new ExternalAgentProviderRegistry()
  const unregister = registry.register(provider as never)
  const adapter = createCursorAgentLlmBridge(
    { registry, getProvider: () => provider as never },
    undefined,
    undefined,
    readImage === undefined ? undefined : { readImage },
  )
  await collect(adapter.stream({
    provider: 'cursor-agent',
    model: 'composer-2.5',
    sessionId: 's',
    messages,
  }))
  await adapter.dispose()
  await unregister()
  return turns
}

it('forwards the last user image as an ACP attachment instead of dropping it', async () => {
  const turns = await streamTurns([
    { source: { kind: 'user' }, content: [{ type: 'text', text: 'What is this?' }, { type: 'image', attachment: IMAGE_REF }] },
  ], async () => ({ data: PNG, mimeType: 'image/png', name: 'palm.png' }))
  expect(turns[0]?.prompt).toBe('What is this?')
  expect(turns[0]?.attachments).toEqual([{ name: 'palm.png', mimeType: 'image/png', data: PNG.toString('base64') }])
})

it('keeps an image-only follow-up on that message instead of using earlier user text', async () => {
  const turns = await streamTurns([
    { source: { kind: 'user' }, content: 'Previous question.' },
    { source: { kind: 'user' }, content: [{ type: 'image', attachment: IMAGE_REF }] },
  ], async () => ({ data: PNG, mimeType: 'image/png', name: 'palm.png' }))
  expect(turns[0]?.prompt).toBe('')
  expect(turns[0]?.attachments).toHaveLength(1)
})

it('does not start a native turn for plugin-only title prompts', async () => {
  const turns = await streamTurns([
    { source: { kind: 'plugin', plugin: 'dsh-session-title-llm' }, role: 'user', content: [{ type: 'text', text: 'Generate the session title' }] },
  ])
  expect(turns).toEqual([])
})

it('fails closed when a user image is present without the attachment store', async () => {
  await expect(streamTurns([
    { source: { kind: 'user' }, content: [{ type: 'image', attachment: IMAGE_REF }] },
  ])).rejects.toThrow('durable attachment service')
})

it('sends inline image data as ACP image content, not a resource_link', async () => {
  const request = vi.fn(async (method: string): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : { sessionId: 's' })
  const session = new CursorAgentSession(connectionOf(request), providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('image-data'),
  }, 'scope')
  const result = await session.runTurn({
    turn: turnId('image'),
    prompt: 'See this.',
    attachments: [{ name: 'palm.png', mimeType: 'image/png', data: PNG.toString('base64') }],
    permissionMode: 'approval-required',
    signal: new AbortController().signal,
  }, host())
  expect(result.status).toBe('completed')
  expect(promptOf(request)).toEqual([
    { type: 'text', text: 'See this.' },
    { type: 'image', data: PNG.toString('base64'), mimeType: 'image/png' },
  ])
  await session.dispose()
})

it('reads a path image into ACP image bytes instead of a text resource_link', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-acp-cursor-image-'))
  const path = join(root, 'palm.png')
  await writeFile(path, PNG)
  try {
    const request = vi.fn(async (method: string): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : { sessionId: 's' })
    const filesystem: CursorAgentClientFilesystem = {
      workspaceRoot: root,
      attachmentRoots: [root],
      readTextFile: async () => { throw new Error('image path must not use readTextFile') },
      writeTextFile: async () => undefined,
      resolvePath: value => value,
    }
    const session = new CursorAgentSession(connectionOf(request), providerId('cursor-agent'), sessionId('host'), 's', {
      executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('image-path'),
    }, 'scope', filesystem)
    const result = await session.runTurn({
      turn: turnId('image-path'),
      prompt: 'See this file.',
      attachments: [{ name: 'palm.png', path, mimeType: 'image/png' }],
      permissionMode: 'approval-required',
      signal: new AbortController().signal,
    }, host())
    expect(result.status).toBe('completed')
    expect(promptOf(request)).toEqual([
      { type: 'text', text: 'See this file.' },
      { type: 'image', data: PNG.toString('base64'), mimeType: 'image/png', uri: path },
    ])
    await session.dispose()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps non-image path attachments as resource_link', async () => {
  const request = vi.fn(async (method: string): Promise<unknown> => method === 'session/prompt' ? { stopReason: 'end_turn' } : { sessionId: 's' })
  const filesystem: CursorAgentClientFilesystem = {
    workspaceRoot: '/tmp',
    attachmentRoots: ['/tmp'],
    readTextFile: async () => '',
    writeTextFile: async () => undefined,
    resolvePath: value => value,
  }
  const session = new CursorAgentSession(connectionOf(request), providerId('cursor-agent'), sessionId('host'), 's', {
    executablePath: '/bin/cursor-agent', harnessPath: '', stateDirectory: '/tmp/acp', instanceId: providerInstanceId('note'),
  }, 'scope', filesystem)
  await session.runTurn({
    turn: turnId('note'),
    prompt: 'Read the note.',
    attachments: [{ name: 'note.txt', path: '/tmp/note.txt', mimeType: 'text/plain' }],
    permissionMode: 'approval-required',
    signal: new AbortController().signal,
  }, host())
  expect(promptOf(request)).toEqual([
    { type: 'text', text: 'Read the note.' },
    { type: 'resource_link', name: 'note.txt', uri: '/tmp/note.txt', mimeType: 'text/plain' },
  ])
  await session.dispose()
})

function connectionOf(request: ReturnType<typeof vi.fn>) {
  return { request, notify: vi.fn(), setRequestHandler: vi.fn(), setNotificationHandler: vi.fn(), close: async () => undefined }
}

function promptOf(request: ReturnType<typeof vi.fn>): unknown {
  const prompt = request.mock.calls.find(call => call[0] === 'session/prompt')?.[1] as { prompt?: unknown } | undefined
  return prompt?.prompt
}
