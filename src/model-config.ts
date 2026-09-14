/** Official ACP parameterized model selection. Internal IDs are never sent as model values. */
import { modelId, type ExternalAgentModel } from '@deepseek-ai/dsh-acp-provider'
import type { AcpConnection } from './protocol.js'
import { isRecord } from './decode.js'
import { CURSOR_AGENT_PERMISSION_MODES } from './types.js'

import { clusterOf, contextTokens, cursorBaseFamilyId, parameterKind, parseCursorContextSuffix, parseModelSelection, selectionId } from './catalog-group.js'

type Select = { id: string; currentValue?: string; values: string[] }
function selects(response: unknown): Select[] {
  if (!isRecord(response) || !Array.isArray(response.configOptions)) throw new Error('Cursor ACP configOptions are missing')
  return response.configOptions.flatMap(option => {
    if (!isRecord(option) || option.type !== 'select' || typeof option.id !== 'string' || !Array.isArray(option.options)) return []
    const entries = option.options.flatMap(entry => isRecord(entry) && Array.isArray(entry.options) ? entry.options : [entry])
    const values = entries.flatMap(entry => isRecord(entry) && typeof entry.value === 'string' ? [entry.value] : [])
    return [{ id: option.id, values, ...(typeof option.currentValue === 'string' ? { currentValue: option.currentValue } : {}) }]
  })
}

/** Read the official bulk catalog extension; discovery never changes the selected model. */
export async function discoverCursorAcpModels(connection: Pick<AcpConnection, 'request'>, signal?: AbortSignal): Promise<readonly ExternalAgentModel[]> {
  const catalog = await connection.request('cursor/list_available_models', {}, signal)
  if (!isRecord(catalog) || !Array.isArray(catalog.models)) throw new Error('Cursor bulk model catalog is missing')
  const modes = CURSOR_AGENT_PERMISSION_MODES
  const models: ExternalAgentModel[] = [{ id: modelId('default'), name: 'Account default', supportedModes: modes }]
  for (const family of catalog.models) {
    signal?.throwIfAborted()
    if (!isRecord(family) || typeof family.value !== 'string' || typeof family.name !== 'string' || !Array.isArray(family.configOptions)) continue
    const options = selects(family).filter(option => parameterKind(option.id) !== undefined)
    let combinations: Record<string, string>[] = [{}]
    for (const option of options) {
      const values = [...option.values].sort((a, b) => Number(b === option.currentValue) - Number(a === option.currentValue))
      if (combinations.length * values.length > 4096) throw new Error('Cursor model parameter catalog is too large')
      combinations = combinations.flatMap(parameters => values.map(value => ({ ...parameters, [option.id]: value })))
    }
    for (const parameters of combinations) models.push({ id: modelId(selectionId({ model: family.value, parameters })), name: family.name, supportedModes: modes })
  }
  return models
}

function nativeFamily(model: string, values: string[] | undefined): string {
  if (values?.includes(model)) return model
  const family = clusterOf(model)
  if (values === undefined || values.includes(family)) return family
  throw new Error('Cursor model is unavailable: ' + model)
}

/** Validate every value against this live session, including after model changes. */
export async function selectCursorAcpModel(connection: Pick<AcpConnection, 'request'>, response: unknown, requested: string, signal?: AbortSignal): Promise<void> {
  if (!isRecord(response) || typeof response.sessionId !== 'string') throw new Error('Cursor ACP session id is missing')
  if (requested === 'default') return
  const selection = parseModelSelection(requested)
  const modelValues = Array.isArray(response.configOptions) ? selects(response).find(option => option.id === 'model')?.values : undefined
  const family = nativeFamily(selection.model, modelValues)
  let configured = await connection.request('session/set_config_option', { sessionId: response.sessionId, configId: 'model', value: family }, signal)
  const parameters = { ...selection.parameters }
  if (!requested.includes('[')) {
    const live = selects(configured)
    const tokens = parseCursorContextSuffix(requested).tokens
    const contextOption = live.find(option => parameterKind(option.id) === 'context')
    if (contextOption !== undefined && tokens !== undefined && parameters[contextOption.id] === undefined) {
      const match = contextOption.values.find(value => contextTokens(value) === tokens)
      if (match !== undefined) parameters[contextOption.id] = match
    }
    const fastOption = live.find(option => parameterKind(option.id) === 'fast')
    const fast = cursorBaseFamilyId(requested).endsWith('-fast')
    if (fastOption !== undefined && fast && parameters[fastOption.id] === undefined) {
      const on = fastOption.values.find(value => value === 'true' || value === 'on')
      if (on !== undefined) parameters[fastOption.id] = on
    }
  }
  for (const [id, value] of Object.entries(parameters)) {
    const option = selects(configured).find(option => option.id === id)
    if (parameterKind(id) === undefined || !option?.values.includes(value)) throw new Error('Cursor model parameter is unavailable: ' + id + '=' + value)
    configured = await connection.request('session/set_config_option', { sessionId: response.sessionId, configId: id, value }, signal)
  }
}
