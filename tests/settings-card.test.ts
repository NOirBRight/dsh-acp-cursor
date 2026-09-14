import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('settings card copy', () => {
  const source = readFileSync(new URL('../src/web/ExternalAgentsSection.tsx', import.meta.url), 'utf8')
  const locales = readFileSync(new URL('../src/web/locales.ts', import.meta.url), 'utf8')
  it('uses the shared ProviderDetail template', () => {
    expect(source).toContain('sharedTemplate')
    expect(source).toContain('dsh-llm-providers-ui/provider-detail')
    expect(source).not.toContain("t('enableProvider')")
    expect(source).not.toContain("t('defaultModel')")
    expect(source).not.toContain('CallbackPaste')
  })
  it('uses Fetch available models copy', () => {
    expect(locales).toContain('Fetch available models')
    expect(locales).toContain('获取可用模型')
    expect(locales).toContain('loginCli')
  })
})
