import type { ExternalAgentProviderRegistry } from '@deepseek-ai/dsh-acp-provider'
import { ExternalAgentSettingsEditorRegistry } from '@deepseek-ai/dsh-acp-provider/settings'
import { CursorAgentProvider, type CursorAgentProviderDependencies } from './provider.js'
import { createCursorAgentSettingsEditor } from './settings.js'
import type { CursorAgentProviderConfig } from './types.js'

/** Host methods required by the out-of-tree composition adapter. */
export interface CursorAgentPluginHost {
  readonly externalAgents: ExternalAgentProviderRegistry
  readonly settingsEditors?: ExternalAgentSettingsEditorRegistry
}
/** Installed provider and its quiescent disposer. */
export interface InstalledCursorAgentProvider {
  readonly provider: CursorAgentProvider
  readonly dispose: () => Promise<void>
}
/** Install one CursorAgent provider and its live provider-owned Settings card. */
export function installCursorAgentProvider(host: CursorAgentPluginHost, config: CursorAgentProviderConfig, dependencies?: CursorAgentProviderDependencies): InstalledCursorAgentProvider {
  const provider = new CursorAgentProvider(config, dependencies)
  const disposeEditor = host.settingsEditors?.register(createCursorAgentSettingsEditor(config, provider))
  let disposeProvider: () => Promise<void>
  try { disposeProvider = host.externalAgents.register(provider) } catch (error) { disposeEditor?.(); throw error }
  let active = true
  return {
    provider,
    dispose: async () => {
      if (!active) return
      active = false
      disposeEditor?.()
      await disposeProvider()
    },
  }
}
