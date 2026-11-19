import type { StudioPage } from './studioData'
import AIMSUN from './studioContextAimsun.json'

export type ContextKind = 'source' | 'asset' | 'app' | 'flow' | 'finding' | 'filter' | 'context'
export type ContextShape = 'circle' | 'square' | 'diamond' | 'hexagon' | 'triangle' | 'star' | 'page'

/** Every relation runs upstream to downstream: data flows from `from` into `to`. */
export type ContextRelation = 'reads' | 'embeds' | 'produces' | 'summarizes' | 'cites' | 'filters' | 'informs'

export type ContextNode = {
  id: string
  kind: ContextKind
  title: string
  /** The kind's own detail: an asset's chart type, a source's engine, an app's kind. */
  detail: string
  description?: string
  status?: string
  updated?: string
  /** `updated` as epoch milliseconds, for ranking by recency. */
  updatedAt?: number
  /** The Studio page it lives on, when it has one. */
  page?: StudioPage
  /** Used by this workspace's apps but owned by another workspace or the organization. */
  external?: boolean
  /** Where it is managed, for things outside the Studio such as AI context. */
  where?: string
  topic: string
}

/** `via` names where the relation is made: the app pages an asset sits on, the node a flow reads with. */
export type ContextEdge = { from: string; to: string; relation: ContextRelation; via?: string[] }

export type ContextGroupBy = 'topic' | 'kind'
export type ContextGroup = { id: string; label: string; color: string }

/** Llumen Default, the categorical chart palette (asset-builder ColorPalette). */
export const LLUMEN_DEFAULT = [
  '#6a9ef0',
  '#bdb6f4',
  '#26ada0',
  '#7ad488',
  '#fceed6',
  '#f38666',
  '#cac5f6',
  '#ed7986',
  '#534d8f',
  '#a8ded9',
] as const

export const KIND_META: Record<ContextKind, { label: string; plural: string; color: string; shape: ContextShape }> = {
  source: { label: 'Source', plural: 'Sources', color: LLUMEN_DEFAULT[2], shape: 'square' },
  asset: { label: 'Asset', plural: 'Assets', color: LLUMEN_DEFAULT[0], shape: 'circle' },
  app: { label: 'App', plural: 'Apps', color: LLUMEN_DEFAULT[1], shape: 'diamond' },
  flow: { label: 'Flow', plural: 'Flows', color: LLUMEN_DEFAULT[5], shape: 'hexagon' },
  finding: { label: 'Finding', plural: 'Findings', color: LLUMEN_DEFAULT[4], shape: 'page' },
  filter: { label: 'Filter', plural: 'Filters', color: LLUMEN_DEFAULT[3], shape: 'triangle' },
  context: { label: 'AI context', plural: 'AI context', color: LLUMEN_DEFAULT[9], shape: 'star' },
}

export const CONTEXT_KINDS = Object.keys(KIND_META) as ContextKind[]

/** How a relation reads from either end: `out` from the upstream node, `in` from the downstream one. */
export const RELATION_LABEL: Record<ContextRelation, { out: string; in: string }> = {
  reads: { out: 'Feeds', in: 'Reads from' },
  embeds: { out: 'Shown in', in: 'Shows' },
  produces: { out: 'Produces', in: 'Produced by' },
  summarizes: { out: 'Summarised by', in: 'Summarises' },
  cites: { out: 'Cited in', in: 'Cites' },
  filters: { out: 'Filters', in: 'Filtered by' },
  informs: { out: 'Informs', in: 'Informed by' },
}

export type ContextGraph = { workspace: string; capturedAt: string; nodes: ContextNode[]; edges: ContextEdge[]; skipped: number }

/**
 * One workspace as staging serves it. Each field is cut from these endpoints (all under /api/content/v1):
 * - assets: workspaces/{id} `.assets`, plus the `asset` on every dashboard_asset / slide_asset and
 *   assets/map-layers/{id}. `source_id` falls back to `configuration.sourceId` for map layers.
 * - apps: dashboards/{id} and slides/{id} return only the landing page's assets; every other page has to be
 *   read from dashboard-pages/{id} or slide/{id}, or it looks empty.
 * - filter_bindings: assets/{id}/filter-bindings. Page filters: dashboard_page_filter / slide_filter.
 * - flows: workspaces/{id}/flow-definitions/{id}/authored, `source` / `asset` / `create_asset` nodes.
 * - findings: /api/agent/findings, `entities` and `content.workflow_definition_id`.
 * - context: organization/context and users/me/context, sent with every conversation.
 */
export type StagingSnapshot = {
  captured_at: string
  workspace: { id: string; name: string }
  assets: {
    id: string
    title?: string
    type?: string
    subtype?: string | null
    tags?: string[]
    source_id?: string | null
    is_global?: boolean
    description?: string
    updated_at?: string | null
    created_by?: string | null
    context_scope?: string | null
    workspace_member?: boolean
  }[]
  sources: {
    id: string
    name: string | null
    type: string | null
    database_type?: string | null
    description?: string
    updated_at?: string | null
    workspace_member?: boolean
  }[]
  apps: {
    id: string
    kind: string
    title: string
    description?: string
    updated_at?: string | null
    author?: string | null
    pages: { id?: string; title: string; assets: string[]; filters: string[]; sources: string[] }[]
  }[]
  filters: { id: string; title?: string; category?: string | null; subtype?: string | null }[]
  filter_bindings: { filter_id: string; asset_id: string }[]
  flows: {
    id: string
    name: string
    status: string
    updated_at?: string
    reads_sources: string[]
    reads_assets: string[]
    produces_assets: string[]
    writes_findings: boolean
    node_kinds: string[]
  }[]
  findings: {
    id: string
    title: string
    kind: string
    created_at: string
    flow: string | null
    assets: string[]
    workspace_id: string | null
  }[]
  members: { id: string; name: string; role?: string }[]
  context: Record<'organization' | 'personal', { text: string; files: string[] }>
}

const CHART: Record<string, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  table: 'Table',
  kpi_card: 'KPI card',
  kpi_grid: 'KPI grid',
  range: 'Range chart',
  pie: 'Pie chart',
  donut: 'Donut chart',
  polar: 'Polar chart',
  scatter: 'Scatter plot',
  availability: 'Availability chart',
}

const SOURCE_TYPE: Record<string, string> = {
  database: 'Database',
  files: 'File',
  api_connection: 'API',
  marketplace: 'Marketplace',
  agentic_flow: 'Flow output',
  etl_flow: 'ETL output',
}

const SOURCE_PAGE: Record<string, StudioPage> = { database: 'database', files: 'files', api_connection: 'apis' }

const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ')

function assetDetail(type = '', subtype?: string | null) {
  if (type === 'Data_chart') return CHART[subtype ?? ''] ?? (subtype ? title(subtype) : 'Chart')
  if (type === 'map-layer') return `Map layer${subtype ? ` · ${subtype}` : ''}`
  if (subtype === 'executive_summary') return 'AI summary'
  return title(subtype || type || 'Asset')
}

function stamp(iso?: string | null) {
  return iso ? Date.parse(iso) : undefined
}

function formatDate(iso?: string | null) {
  if (!iso) return undefined
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Map styles are basemaps and the global Title / Text / Summary blocks are shared templates, not data. */
function isData(asset: StagingSnapshot['assets'][number]) {
  if (asset.type === 'map-style') return false
  if (asset.type === 'base_asset') return asset.subtype === 'executive_summary' && !asset.is_global
  return true
}

const AI_NODE_KINDS = new Set(['general_agent', 'ai_findings'])

/** The workspace as a graph: what each asset reads, where it is shown, what filters it, and what the AI is told. */
export function buildContextGraph(snapshot: StagingSnapshot = AIMSUN as StagingSnapshot): ContextGraph {
  const nodes = new Map<string, ContextNode>()
  const edges = new Map<string, ContextEdge>()
  const add = (node: Omit<ContextNode, 'topic'>) => {
    if (!nodes.has(node.id)) nodes.set(node.id, { ...node, topic: '' })
  }
  const link = (from: string, to: string, relation: ContextRelation, via?: string) => {
    if (from === to) return
    const key = `${from}>${to}>${relation}`
    const edge = edges.get(key) ?? { from, to, relation }
    if (via && !edge.via?.includes(via)) edge.via = [...(edge.via ?? []), via]
    edges.set(key, edge)
  }

  const assets = new Map(snapshot.assets.filter(isData).map((asset) => [asset.id, asset]))
  let skipped = snapshot.assets.length - assets.size

  for (const asset of assets.values()) {
    add({
      id: asset.id,
      kind: 'asset',
      title: asset.title || 'Untitled asset',
      detail: assetDetail(asset.type, asset.subtype),
      description: asset.description,
      updated: formatDate(asset.updated_at),
      updatedAt: stamp(asset.updated_at),
      page: 'assets',
      external: !asset.workspace_member,
    })
  }

  for (const source of snapshot.sources) {
    add({
      id: source.id,
      kind: 'source',
      title: source.name || 'Unnamed source',
      detail: SOURCE_TYPE[source.type ?? ''] ?? 'Source',
      description: source.description,
      updated: formatDate(source.updated_at),
      updatedAt: stamp(source.updated_at),
      page: SOURCE_PAGE[source.type ?? ''] ?? 'database',
      external: !source.workspace_member,
    })
  }
  for (const asset of assets.values()) if (asset.source_id) link(asset.source_id, asset.id, 'reads')

  for (const app of snapshot.apps) {
    const placed = app.pages.flatMap((page) => page.assets).filter((id) => assets.has(id))
    if (!placed.length) {
      skipped++
      continue
    }
    add({
      id: app.id,
      kind: 'app',
      title: app.title,
      detail: `${app.kind === 'slides' ? 'Slides' : 'Dashboard'} · ${app.pages.length} ${app.kind === 'slides' ? 'slides' : 'pages'}`,
      description: app.description,
      updated: formatDate(app.updated_at),
      updatedAt: stamp(app.updated_at),
      page: 'apps',
    })
    for (const page of app.pages) {
      const onPage = page.assets.filter((id) => assets.has(id))
      for (const id of onPage) link(id, app.id, 'embeds', page.title)
      for (const id of page.sources) link(id, app.id, 'reads', page.title)
      for (const summary of onPage.filter((id) => assets.get(id)?.context_scope === 'page')) {
        for (const id of onPage) if (assets.get(id)?.context_scope !== 'page') link(id, summary, 'summarizes', page.title)
      }
      const bound = new Set(snapshot.filter_bindings.filter((b) => onPage.includes(b.asset_id)).map((b) => b.filter_id))
      for (const id of page.filters) if (!bound.has(id)) link(id, app.id, 'filters', page.title)
    }
  }

  for (const filter of snapshot.filters) {
    add({
      id: filter.id,
      kind: 'filter',
      title: filter.title || 'Untitled filter',
      detail: [filter.category, filter.subtype].filter(Boolean).map((part) => title(part!)).join(' · ') || 'Filter',
      page: 'filters',
    })
  }
  for (const binding of snapshot.filter_bindings) if (assets.has(binding.asset_id)) link(binding.filter_id, binding.asset_id, 'filters')

  for (const flow of snapshot.flows) {
    const usesAi = flow.node_kinds.some((kind) => AI_NODE_KINDS.has(kind))
    if (!flow.reads_sources.length && !flow.reads_assets.length && !flow.produces_assets.length && !usesAi) {
      skipped++
      continue
    }
    add({
      id: flow.id,
      kind: 'flow',
      title: flow.name,
      detail: `${title(flow.status)} · ${flow.node_kinds.length} steps`,
      updated: formatDate(flow.updated_at),
      updatedAt: stamp(flow.updated_at),
      status: flow.status === 'published' ? 'Active' : 'Draft',
      page: 'workflows',
    })
    for (const id of flow.reads_sources) link(id, flow.id, 'reads', 'Source step')
    for (const id of flow.reads_assets) link(id, flow.id, 'reads', 'Asset step')
    for (const id of flow.produces_assets) link(flow.id, id, 'produces', 'Create asset step')
  }

  // Findings carry either `workspace_id` or the author's `private_workspace_id`; only the first belong here.
  for (const finding of snapshot.findings.filter((finding) => finding.workspace_id === snapshot.workspace.id)) {
    const cited = finding.assets.filter((id) => nodes.has(id))
    if (!cited.length && !(finding.flow && nodes.has(finding.flow))) continue
    add({
      id: finding.id,
      kind: 'finding',
      title: finding.title,
      detail: `${title(finding.kind)} finding`,
      updated: formatDate(finding.created_at),
      updatedAt: stamp(finding.created_at),
    })
    for (const id of cited) link(id, finding.id, 'cites')
    if (finding.flow) link(finding.flow, finding.id, 'produces')
  }

  // Organization and personal context ride along with every conversation, so they inform each AI output here.
  const aiOutputs = [...nodes.values()].filter(
    (node) =>
      node.kind === 'finding' ||
      (node.kind === 'asset' && assets.get(node.id)?.context_scope) ||
      (node.kind === 'flow' && snapshot.flows.find((flow) => flow.id === node.id)?.node_kinds.some((kind) => AI_NODE_KINDS.has(kind))),
  )
  if (aiOutputs.length) {
    const scopes = [
      ['organization', 'Domain context', 'Organization', 'Platform settings · Domain context'],
      ['personal', 'Your context', 'Personal', 'Account settings · Agent settings'],
    ] as const
    for (const [scope, name, label, where] of scopes) {
      const { text, files } = snapshot.context[scope]
      if (text) {
        add({ id: `context-${scope}`, kind: 'context', title: name, detail: `${label} · Instructions`, description: text, where })
        for (const output of aiOutputs) link(`context-${scope}`, output.id, 'informs')
      }
      files.forEach((file, index) => {
        const id = `context-${scope}-file-${index}`
        add({ id, kind: 'context', title: file, detail: `${label} · File`, where })
        for (const output of aiOutputs) link(id, output.id, 'informs')
      })
    }
  }

  const kept = [...edges.values()].filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
  const used = new Set(kept.flatMap((edge) => [edge.from, edge.to]))
  const linked = [...nodes.values()].filter((node) => used.has(node.id))
  skipped += nodes.size - linked.length
  assignTopics(linked, kept)
  return { workspace: snapshot.workspace.name, capturedAt: formatDate(snapshot.captured_at) ?? '', nodes: linked, edges: kept, skipped }
}

const CONTEXT_TOPIC = 'AI context'

/** Apps head their own topic and each asset joins the app it sits on most; the rest follow their neighbours. */
function assignTopics(nodes: ContextNode[], edges: ContextEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    if (node.kind === 'app') node.topic = node.title
    else if (node.kind === 'context') node.topic = CONTEXT_TOPIC
  }
  for (const node of nodes) {
    if (node.kind !== 'asset') continue
    const shown = edges.filter((edge) => edge.from === node.id && edge.relation === 'embeds')
    const best = shown.sort((a, b) => (b.via?.length ?? 0) - (a.via?.length ?? 0) || a.to.localeCompare(b.to))[0]
    if (best) node.topic = byId.get(best.to)!.topic
  }
  // Two passes so a source that only feeds unplaced assets still inherits a topic through them.
  for (let pass = 0; pass < 2; pass++) {
    for (const node of nodes) {
      if (node.topic) continue
      const votes = new Map<string, number>()
      for (const edge of edges) {
        const other = edge.from === node.id ? edge.to : edge.to === node.id ? edge.from : null
        const topic = other ? byId.get(other)?.topic : undefined
        if (topic && topic !== CONTEXT_TOPIC) votes.set(topic, (votes.get(topic) ?? 0) + 1)
      }
      const best = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      if (best) node.topic = best[0]
    }
  }
  for (const node of nodes) if (!node.topic) node.topic = 'Not in an app'
}

export function groupsFor(groupBy: ContextGroupBy, nodes: ContextNode[]): ContextGroup[] {
  if (groupBy === 'kind') {
    return CONTEXT_KINDS.filter((kind) => nodes.some((node) => node.kind === kind)).map((kind) => ({
      id: kind,
      label: KIND_META[kind].plural,
      color: KIND_META[kind].color,
    }))
  }
  const sizes = new Map<string, number>()
  for (const node of nodes) sizes.set(node.topic, (sizes.get(node.topic) ?? 0) + 1)
  const topics = [...sizes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic]) => topic)
  return topics.map((topic, index) => ({ id: topic, label: topic, color: LLUMEN_DEFAULT[index % LLUMEN_DEFAULT.length] }))
}

export function groupOfNode(groupBy: ContextGroupBy, node: ContextNode) {
  return groupBy === 'kind' ? node.kind : node.topic
}
