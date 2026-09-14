import { describe, expect, it } from 'vitest'
import { applyCatalogOverlay, type CursorCatalogRow } from '../src/catalog.js'
import { decodeConfig } from '../src/client-contract.js'

const gemini: CursorCatalogRow = { id: 'composer-2.5', name: 'Composer 2.5', vision: true }
const opus: CursorCatalogRow = { id: 'claude-opus-5', name: 'Claude Opus 5', thinking: true }

describe('catalog overlay membership', () => {
  it('keeps deselection: saved order is membership', () => {
    const shown = applyCatalogOverlay([gemini, opus], ['composer-2.5'], undefined)
    expect(shown.map(row => row.id)).toEqual(['composer-2.5'])
  })

  it('empty order hides every discovered row', () => {
    expect(applyCatalogOverlay([gemini, opus], [], undefined)).toEqual([])
  })

  it('undefined order shows every discovered row', () => {
    expect(applyCatalogOverlay([gemini, opus], undefined, undefined).map(row => row.id)).toEqual(['composer-2.5', 'claude-opus-5'])
  })

  it('keeps unknown saved ids when override has a name', () => {
    const shown = applyCatalogOverlay([gemini], ['manual-1'], { 'manual-1': { name: 'Manual' } })
    expect(shown).toEqual([expect.objectContaining({ id: 'manual-1', name: 'Manual' })])
  })

  it('decodes catalogOrder alone without overrides', () => {
    const decoded = decodeConfig({
      executablePath: '/bin/cursor-agent',
      harnessPath: '',
      stateDirectory: '/tmp',
      instanceId: 'default',
      enabled: true,
      catalogOrder: ['composer-2.5'],
    })
    expect(decoded?.catalogOrder).toEqual(['composer-2.5'])
    expect(decoded?.catalogOverrides).toBeUndefined()
  })
})
