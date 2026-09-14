import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSessionModelRoute, providerInstanceId, sessionId, turnId, type ExternalAgentTurnHost } from '@deepseek-ai/dsh-acp-provider'
import { expect, it } from 'vitest'
import { CursorAgentProvider } from '../src/provider.js'
import { nativeCursorAgentModelId } from '../src/catalog.js'

const executablePath = process.env.CURSOR_AGENT_EXECUTABLE ?? '/home/noirbright/.local/bin/cursor-agent'
const runLive = process.env.DSH_CURSOR_E2E === '1'

it.skipIf(!runLive)('validates the official cursor-agent binary', async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'dsh-acp-cursor-smoke-'))
  const provider = new CursorAgentProvider({
    executablePath,
    harnessPath: '',
    stateDirectory,
    instanceId: providerInstanceId('real-binary-smoke'),
  })
  try {
    await expect(provider.validateInstallation()).resolves.toMatchObject({ executablePath })
  } finally {
    try { await provider.dispose() } finally { await rm(stateDirectory, { recursive: true, force: true }) }
  }
}, 30_000)

it.skipIf(!runLive)('lists models or runs a read-only turn against signed-in cursor-agent acp', async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'dsh-acp-cursor-live-'))
  const provider = new CursorAgentProvider({
    executablePath,
    harnessPath: '',
    stateDirectory,
    instanceId: providerInstanceId('real-api-smoke'),
  })
  const host: ExternalAgentTurnHost = {
    publish: () => undefined,
    requestPermission: async request => {
      const rejection = request.options.find(option => option.kind === 'reject') ?? request.options.find(option => option.kind === 'cancel')
      return rejection === undefined ? { kind: 'cancel' } : { kind: 'reject', optionId: rejection.optionId }
    },
    requestUserInput: async () => ({ answers: [] }),
  }
  try {
    const models = await provider.listModels()
    expect(models.length).toBeGreaterThan(0)
    const selected = nativeCursorAgentModelId(process.env.DSH_CURSOR_MODEL_ID ?? 'composer-2.5', undefined, models.map(model => String(model.id)), models)
    const route = createSessionModelRoute('external-agent', String(provider.info.id), selected)
    const session = await provider.openSession({ route, session: sessionId('real-api-smoke'), permissionMode: 'approval-required' })
    const first = await session.runTurn({
      turn: turnId('real-api-read-only'),
      prompt: 'Reply with exactly: DSH Cursor ACP smoke. Do not use tools or modify files.',
      permissionMode: 'approval-required',
      model: route.model,
      signal: AbortSignal.timeout(90_000),
    }, host)
    expect(first.status, 'Native turn should complete: ' + ('error' in first ? first.error : '')).toBe('completed')
    if (first.status === 'completed') expect(first.text.toLowerCase()).toContain('smoke')
    await session.dispose()
  } finally {
    try { await provider.dispose() } finally { await rm(stateDirectory, { recursive: true, force: true }) }
  }
}, 120_000)
