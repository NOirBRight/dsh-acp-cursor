import { describe, expect, it } from 'vitest'
import { defaultContextWindowForFamily, groupCursorModels, resolveCursorWireId, findCatalogModel } from '../src/catalog-group.js'
import { pickerGroupsFromCursorCatalog, nativeCursorAgentModelId } from '../src/catalog.js'

describe('cursor catalog grouping', () => {
  it('collapses thinking-level wire ids into one family', () => {
    const grouped = groupCursorModels([
      { id: 'claude-opus-5-thinking-high', name: 'Claude Opus 5 Thinking High' },
      { id: 'claude-opus-5-thinking-high-fast', name: 'Claude Opus 5 Thinking High Fast' },
      { id: 'auto', name: 'Auto' },
    ], 'brand')
    expect(grouped.some(model => model.id === 'auto')).toBe(true)
    const opus = grouped.find(model => model.id === 'claude-opus-5')
    expect(opus?.thinking).toBe(true)
    expect(grouped.some(model => model.id === 'claude-opus-5-fast')).toBe(true)
  })

  it('resolves an effort back to a native wire id when the catalog listed it', () => {
    const natives = [
      { id: 'claude-opus-5-thinking-high', name: 'Claude Opus 5 High' },
      { id: 'claude-opus-5-thinking-low', name: 'Claude Opus 5 Low' },
    ]
    const grouped = groupCursorModels(natives, 'stable')
    const family = findCatalogModel(grouped, 'claude-opus-5')
    expect(family).toBeDefined()
    expect(resolveCursorWireId(family!, 'high')).toContain('claude-opus-5')
    expect(nativeCursorAgentModelId('claude-opus-5', 'high', natives.map(model => model.id), natives)).toBe('claude-opus-5-thinking-high')
  })

  it('builds picker groups from a CLI model list', () => {
    const groups = pickerGroupsFromCursorCatalog([
      { id: 'composer-2.5', name: 'Composer 2.5' },
      { id: 'gpt-5.3-codex-high', name: 'Codex 5.3 High' },
    ])
    expect(groups.some(model => model.id === 'composer-2.5')).toBe(true)
  })

  it('uses Cursor published defaults and leaves unknown families empty', () => {
    expect(defaultContextWindowForFamily('composer-2.5')).toBe(200_000)
    expect(defaultContextWindowForFamily('gpt-5.2')).toBe(272_000)
    expect(defaultContextWindowForFamily('gpt-5.3-codex')).toBe(272_000)
    expect(defaultContextWindowForFamily('claude-sonnet-4-5')).toBe(200_000)
    expect(defaultContextWindowForFamily('gemini-3.1-pro')).toBe(200_000)
    expect(defaultContextWindowForFamily('kimi-k2.7-code')).toBe(262_000)
    expect(defaultContextWindowForFamily('kimi-k3')).toBe(200_000)
    expect(defaultContextWindowForFamily('kimi-k3-1m')).toBe(1_000_000)
    expect(defaultContextWindowForFamily('grok-4.6')).toBe(256_000)
    expect(defaultContextWindowForFamily('glm-5.2')).toBe(200_000)
    expect(defaultContextWindowForFamily('default')).toBeUndefined()
    expect(defaultContextWindowForFamily('unknown-sku')).toBeUndefined()
  })
})
