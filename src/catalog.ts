/** Collapse CursorAgent native model ids (`…-high|medium|low`) and display-name aliases into one picker row plus efforts. */
import { CURSOR_EFFORT_LABELS, CURSOR_EFFORT_ORDER, CURSOR_MAX_SUFFIX, defaultContextWindowForFamily, contextTokens, familyHasExtendedContext, isCursorMaxRow, parameterKind, parseModelSelection, sortGroupedFamilies, suggestedDefaultEffort, effortsForCursorModel, groupCursorModels, resolveCursorDefaultEffort, resolveCursorWireId, findCatalogModel } from './catalog-group.js'

const EFFORTS = ['high', 'medium', 'low'] as const
export type CursorAgentEffort = (typeof EFFORTS)[number]

const EFFORT_NAMES: Record<CursorAgentEffort, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const DEFAULT_EFFORT = 'default'

export function peelEffort(id: string): { logical: string; effort?: CursorAgentEffort } {
  for (const effort of EFFORTS) {
    const suffix = '-' + effort
    if (id.endsWith(suffix) && id.length > suffix.length) return { logical: id.slice(0, -suffix.length), effort }
  }
  return { logical: id }
}

function nameEffort(name: string): CursorAgentEffort | undefined {
  for (const effort of EFFORTS) {
    const label = ' (' + EFFORT_NAMES[effort] + ')'
    if (name.endsWith(label)) return effort
  }
}

function stripEffortLabel(name: string): string {
  for (const label of [' (High)', ' (Medium)', ' (Low)']) {
    if (name.endsWith(label)) return name.slice(0, -label.length)
  }
  return name
}

interface CollapseGroup {
  name: string
  efforts: CursorAgentEffort[]
  native: string[]
  baseNative?: string
}

export function collapseCursorAgentModels(models: readonly { id: string; name: string }[]): readonly {
  id: string
  name: string
  reasoning?: { efforts: readonly { id: string; name: string }[]; defaultEffort: string }
}[] {
  const groups = new Map<string, CollapseGroup>()
  const order: string[] = []
  for (const model of models) {
    const peeled = peelEffort(model.id)
    const effort = peeled.effort ?? nameEffort(model.name)
    const key = peeled.effort ? peeled.logical : model.id
    let group = groups.get(key)
    if (group === undefined) {
      group = { name: stripEffortLabel(model.name), efforts: [], native: [] }
      groups.set(key, group)
      order.push(key)
    }
    group.native.push(model.id)
    if (effort !== undefined && !group.efforts.includes(effort)) group.efforts.push(effort)
    if (effort === undefined) {
      group.name = model.name
      group.baseNative = model.id
    }
  }

  const buckets = new Map<string, string[]>()
  for (const id of order) {
    const nameKey = stripEffortLabel(groups.get(id)!.name)
    const bucket = buckets.get(nameKey) ?? []
    bucket.push(id)
    buckets.set(nameKey, bucket)
  }
  const drop = new Set<string>()
  for (const ids of buckets.values()) {
    if (ids.length < 2) continue
    const canonical = ids.find(id => groups.get(id)!.baseNative !== undefined) ?? ids[0]!
    const dst = groups.get(canonical)!
    for (const id of ids) {
      if (id === canonical) continue
      const src = groups.get(id)!
      for (const effort of src.efforts) if (!dst.efforts.includes(effort)) dst.efforts.push(effort)
      dst.native.push(...src.native)
      if (dst.baseNative === undefined && src.baseNative !== undefined) dst.baseNative = src.baseNative
      drop.add(id)
    }
  }

  return order.filter(id => !drop.has(id)).map(id => {
    const group = groups.get(id)!
    const named = EFFORTS.filter(effort => group.efforts.includes(effort)).map(effort => ({
      id: effort,
      name: EFFORT_NAMES[effort],
    }))
    const efforts = group.baseNative !== undefined && named.length > 0
      ? [{ id: DEFAULT_EFFORT, name: 'Default' }, ...named]
      : named
    return {
      id,
      name: group.name,
      ...(efforts.length === 0 ? {} : {
        reasoning: {
          efforts,
          defaultEffort: group.efforts.includes('high') ? 'high' : efforts[0]!.id,
        },
      }),
    }
  })
}

export type CursorCatalogRow = {
  readonly id: string
  readonly name: string
  readonly nativeIds?: readonly string[]
  readonly vision?: boolean
  readonly thinking?: boolean
  readonly contextWindow?: number
  readonly reasoning?: { readonly efforts: readonly { readonly id: string; readonly name: string }[]; readonly defaultEffort: string }
  readonly overrides?: Readonly<Record<string, boolean>>
  readonly sources?: Readonly<Record<string, string>>
}

export function pickerGroupsFromCursorCatalog(models: readonly { id: string; name: string }[]): CursorCatalogRow[] {
  const parameterized = models.filter(model => model.id.includes('['))
  const grouped = groupCursorModels(models.filter(model => !model.id.includes('[')).map(model => ({
    id: model.id,
    name: model.name,
    vision: true,
    thinking: model.id.includes('thinking'),
  })), 'brand')
  const legacy = grouped.map(model => {
    const efforts = effortsForCursorModel(model)
    const defaultEffort = resolveCursorDefaultEffort(model)
    const nativeIds = model.variants?.map(variant => variant.wireId) ?? [model.id]
    return {
      id: model.id,
      name: model.name ?? model.id,
      nativeIds,
      ...(model.vision === undefined ? {} : { vision: model.vision }),
      ...(model.thinking === undefined ? {} : { thinking: model.thinking }),
      ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
      ...(efforts.length === 0 ? {} : {
        reasoning: {
          efforts: efforts.map(id => ({ id, name: CURSOR_EFFORT_LABELS[id] })),
          defaultEffort: defaultEffort ?? efforts[0]!,
        },
      }),
      sources: {
        name: 'native',
        ...(model.vision === undefined ? {} : { vision: 'native' }),
        ...(model.thinking === undefined ? {} : { thinking: 'native' }),
        ...(model.contextWindow === undefined ? {} : { contextWindow: 'default' }),
        ...(defaultEffort === undefined && efforts.length === 0 ? {} : { defaultEffort: 'native' }),
      },
    }
  })
  const rows = [...legacy, ...parameterizedCatalog(parameterized)]
  return sortGroupedFamilies(rows, new Map(rows.map((row, index) => [row.id, index])), 'brand')
}

/** Collapse only the context/Fast combinations the ACP server advertised. */
function parameterizedCatalog(models: readonly { id: string; name: string }[]): CursorCatalogRow[] {
  const variants = models.map(model => {
    const selection = parseModelSelection(model.id)
    const value = (kind: string): string | undefined => Object.entries(selection.parameters).find(([id]) => parameterKind(id) === kind)?.[1]
    return { ...model, family: selection.model, fast: value('fast') === 'true', effort: value('effort'), context: contextTokens(value('context')) }
  })
  const minContext = new Map<string, number>()
  for (const variant of variants) if (variant.context !== undefined) minContext.set(variant.family, Math.min(minContext.get(variant.family) ?? Infinity, variant.context))
  const groups = new Map<string, typeof variants>()
  for (const variant of variants) {
    const extended = variant.context !== undefined && variant.context > minContext.get(variant.family)!
    const suffix = !extended ? '' : variant.context! % 1_000_000 === 0 ? '-' + variant.context! / 1_000_000 + 'm' : '-' + variant.context! / 1000 + 'k'
    const id = variant.family + (variant.fast ? '-fast' : '') + suffix
    const group = groups.get(id) ?? []
    group.push(variant)
    groups.set(id, group)
  }
  // ponytail: ACP has no maxMode. Documented Max rows reuse the base family's native ids; unadvertised context is never sent.
  for (const family of new Set(variants.map(variant => variant.family))) {
    if (!familyHasExtendedContext(family)) continue
    for (const fast of [false, true]) {
      const key = family + (fast ? '-fast' : '')
      const siblings = groups.get(key)
      if (siblings === undefined || groups.has(key + CURSOR_MAX_SUFFIX)) continue
      groups.set(key + CURSOR_MAX_SUFFIX, [...siblings])
    }
  }
  return [...groups].map(([id, variants]) => {
    const first = variants[0]!
    const rank = (id: string): number => { const index = CURSOR_EFFORT_ORDER.indexOf((id === 'extra-high' ? 'xhigh' : id) as typeof CURSOR_EFFORT_ORDER[number]); return index < 0 ? 99 : index }
    const effortIds = [...new Set(variants.flatMap(variant => variant.effort === undefined ? [] : [variant.effort]))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    const recognized = CURSOR_EFFORT_ORDER.filter(effort => effortIds.includes(effort))
    const defaultEffort = suggestedDefaultEffort(first.family, recognized) ?? effortIds[0]
    const advertised = first.context
    const published = defaultContextWindowForFamily(id)
    const contextWindow = advertised ?? published
    const maxRow = isCursorMaxRow(id)
    const extended = maxRow || (advertised !== undefined && advertised > minContext.get(first.family)!)
    return {
      id,
      name: first.name + (first.fast ? ' Fast' : '') + (extended ? maxRow || advertised === 1_000_000 ? ' Max' : ' ' + advertised! / 1000 + 'K' : ''),
      nativeIds: variants.map(variant => variant.id),
      ...(contextWindow === undefined ? {} : { contextWindow }),
      thinking: effortIds.some(effort => effort !== 'none' && effort !== 'false' && effort !== 'off'),
      ...(defaultEffort === undefined ? {} : { reasoning: { efforts: effortIds.map(id => ({ id, name: id === 'extra-high' ? 'Extra High' : id === 'true' ? 'On' : id === 'false' ? 'Off' : CURSOR_EFFORT_LABELS[id as keyof typeof CURSOR_EFFORT_LABELS] ?? id })), defaultEffort } }),
      sources: {
        name: 'native',
        thinking: 'native',
        ...(contextWindow === undefined ? {} : { contextWindow: advertised === undefined ? 'default' : 'native' }),
        ...(defaultEffort === undefined ? {} : { defaultEffort: 'native' }),
      },
    }
  })
}

export type CatalogOverlay = {
  readonly name?: string
  readonly vision?: boolean
  readonly thinking?: boolean
  readonly contextWindow?: number
  readonly reasoning?: { readonly defaultEffort?: string; readonly efforts?: readonly { readonly id: string; readonly name: string }[] }
}

/** Apply saved membership and field overrides. Undefined order means every discovered row. */
export function applyCatalogOverlay(
  discovered: readonly CursorCatalogRow[],
  order: readonly string[] | undefined,
  overrides: Readonly<Record<string, CatalogOverlay>> | undefined,
): CursorCatalogRow[] {
  const byId = new Map(discovered.map(model => [model.id, model]))
  const ids = order === undefined ? discovered.map(model => model.id) : [...order]
  return ids.flatMap(id => {
    const base = byId.get(id)
    const over = overrides?.[id]
    if (base === undefined) {
      if (over === undefined || over.name === undefined) return []
      return [{
        id,
        name: over.name,
        nativeIds: [id],
        ...(typeof over.vision === 'boolean' ? { vision: over.vision } : {}),
        ...(typeof over.thinking === 'boolean' ? { thinking: over.thinking } : {}),
        ...(typeof over.contextWindow === 'number' ? { contextWindow: over.contextWindow } : {}),
        ...(over.reasoning?.efforts === undefined ? {} : { reasoning: { efforts: over.reasoning.efforts, defaultEffort: over.reasoning.defaultEffort ?? over.reasoning.efforts[0]?.id ?? 'none' } }),
        overrides: { name: true },
      }]
    }
    if (over === undefined) return [base]
    const defaultEffort = over.reasoning?.defaultEffort ?? (over.reasoning === undefined ? base.reasoning?.defaultEffort : undefined)
    const name = typeof over.name === 'string' && over.name.length > 0 ? over.name : base.name
    const vision = typeof over.vision === 'boolean' ? over.vision : base.vision
    const thinking = typeof over.thinking === 'boolean' ? over.thinking : base.thinking
    const contextWindow = typeof over.contextWindow === 'number' ? over.contextWindow : base.contextWindow
    const reasoning = base.reasoning === undefined && defaultEffort === undefined ? undefined : {
      efforts: over.reasoning?.efforts ?? base.reasoning?.efforts ?? [],
      defaultEffort: defaultEffort ?? base.reasoning?.defaultEffort ?? 'none',
    }
    const flags: Record<string, boolean> = {}
    if (name !== base.name) flags.name = true
    if (vision !== base.vision && typeof over.vision === 'boolean') flags.vision = true
    if (thinking !== base.thinking && typeof over.thinking === 'boolean') flags.thinking = true
    if (contextWindow !== base.contextWindow && typeof over.contextWindow === 'number') flags.contextWindow = true
    if ((reasoning?.defaultEffort ?? undefined) !== base.reasoning?.defaultEffort && defaultEffort !== undefined) flags.defaultEffort = true
    return [{
      ...base,
      name,
      ...(vision === undefined ? {} : { vision }),
      ...(thinking === undefined ? {} : { thinking }),
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(reasoning === undefined ? {} : { reasoning }),
      ...(Object.keys(flags).length === 0 ? {} : { overrides: flags }),
    }]
  })
}

/** Return an advertised variant or a validated internal parameter selection, never a guessed SKU. */
export function nativeCursorAgentModelId(
  logical: string,
  effort: string | undefined,
  nativeIds: readonly string[],
  nativeModels: readonly { id: string; name: string }[] = nativeIds.map(id => ({ id, name: id })),
): string {
  const row = pickerGroupsFromCursorCatalog(nativeModels).find(row => row.id === logical || row.nativeIds?.includes(logical))
  if (row === undefined) throw new Error('Cursor model is unavailable: ' + logical)
  if (effort === undefined && nativeIds.includes(logical)) return logical
  const wanted = effort ?? row.reasoning?.defaultEffort
  const candidates = row.nativeIds ?? []
  if (candidates.some(id => id.includes('['))) {
    const selected = candidates.find(id => {
      const parameters = parseModelSelection(id).parameters
      return wanted === undefined || Object.entries(parameters).some(([key, value]) => parameterKind(key) === 'effort' && value === wanted)
    })
    if (selected !== undefined && nativeIds.includes(selected)) return selected
  } else {
    const model = findCatalogModel(groupCursorModels(nativeModels, 'stable'), logical)
    if (model !== undefined) {
      const selected = resolveCursorWireId(model, wanted, logical)
      if (candidates.includes(selected) && nativeIds.includes(selected)) return selected
    }
  }
  throw new Error('Cursor model variant is unavailable: ' + logical + (wanted === undefined ? '' : ' (' + wanted + ')'))
}

/** Native rows that collapse to High/Medium/Low when ACP has not listed the account yet. */
export function effortVariants(id: string): { id: string; name: string }[] {
  const logical = peelEffort(id).logical
  return [
    { id: logical, name: logical },
    { id: logical + '-high', name: logical + ' (High)' },
    { id: logical + '-medium', name: logical + ' (Medium)' },
    { id: logical + '-low', name: logical + ' (Low)' },
  ]
}
