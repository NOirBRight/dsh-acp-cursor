import { createCursorAgentSettingsEditor } from './settings.js'
import type { CursorAgentProvider } from './provider.js'
import type { CursorAgentProviderConfig } from './types.js'

/** Client-plugin metadata consumed by a DSH web profile adapter. */
export const CURSOR_AGENT_CLIENT_PLUGIN_ID = 'dsh-acp-cursor'

/** Provider-owned Settings card factory; generic Settings owns placement and persistence. */
export function createCursorAgentClientContribution(config: CursorAgentProviderConfig, provider: CursorAgentProvider) {
  return { id: CURSOR_AGENT_CLIENT_PLUGIN_ID, settingsEditor: createCursorAgentSettingsEditor(config, provider) }
}
