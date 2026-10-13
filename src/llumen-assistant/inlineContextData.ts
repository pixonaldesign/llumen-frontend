import type { Icon } from '@phosphor-icons/react'
import {
  ClipboardText,
  Database,
  Images,
  Presentation,
} from '@phosphor-icons/react'

export type InlineContextCategoryId = 'database' | 'slides' | 'briefings' | 'assets'

export type InlineContextCategory = {
  id: InlineContextCategoryId
  label: string
  Icon: Icon
}

export type InlineContextItem = {
  id: string
  categoryId: InlineContextCategoryId
  name: string
  description?: string
}

export const INLINE_CONTEXT_CATEGORIES: InlineContextCategory[] = [
  { id: 'database', label: 'Database', Icon: Database },
  { id: 'slides', label: 'Slides', Icon: Presentation },
  { id: 'briefings', label: 'Briefings', Icon: ClipboardText },
  { id: 'assets', label: 'Assets', Icon: Images },
]

export const INLINE_CONTEXT_ITEMS: InlineContextItem[] = [
  // Database
  {
    id: 'db-aq-stations',
    categoryId: 'database',
    name: 'Air Quality Stations',
    description: 'Live NO₂ / PM₂.₅ feeds',
  },
  {
    id: 'db-population',
    categoryId: 'database',
    name: 'Population Census',
    description: 'District-level demographics',
  },
  {
    id: 'db-land-use',
    categoryId: 'database',
    name: 'Land-use Inventory',
    description: 'Zoning and industrial parcels',
  },
  {
    id: 'db-traffic',
    categoryId: 'database',
    name: 'Traffic Sensors Network',
    description: 'Corridor volume & speed',
  },
  {
    id: 'db-emissions',
    categoryId: 'database',
    name: 'Industrial Emissions Registry',
    description: 'Facility permit records',
  },
  // Slides
  {
    id: 'sl-q1-exec',
    categoryId: 'slides',
    name: 'Q1 Executive Deck',
    description: 'Leadership readout',
  },
  {
    id: 'sl-aqi-corridor',
    categoryId: 'slides',
    name: 'AQI Corridor Review',
    description: 'Mussafah–ICAD focus',
  },
  {
    id: 'sl-marina-ops',
    categoryId: 'slides',
    name: 'Marina Ops Briefing Slides',
    description: 'Weekly logistics pack',
  },
  {
    id: 'sl-exposure',
    categoryId: 'slides',
    name: 'Exposure Priority Pack',
    description: 'Population risk maps',
  },
  {
    id: 'sl-stakeholder',
    categoryId: 'slides',
    name: 'Weekly Stakeholder Sync',
    description: 'Status & blockers',
  },
  // Briefings
  {
    id: 'br-q1-kpi',
    categoryId: 'briefings',
    name: 'Q1 KPI briefing',
    description: 'Throughput & exceptions',
  },
  {
    id: 'br-exec-aqi',
    categoryId: 'briefings',
    name: 'Executive AQI assessment',
    description: 'One-pager for leadership',
  },
  {
    id: 'br-exposure-memo',
    categoryId: 'briefings',
    name: 'Exposure priority memo',
    description: 'Sensitive receptors',
  },
  {
    id: 'br-port-dwell',
    categoryId: 'briefings',
    name: 'Port dwell-time digest',
    description: 'Berth turnaround notes',
  },
  {
    id: 'br-incident',
    categoryId: 'briefings',
    name: 'Incident response summary',
    description: 'Hazmat escalation paths',
  },
  // Assets
  {
    id: 'as-aqi-map',
    categoryId: 'assets',
    name: 'Abu Dhabi AQI map',
    description: 'Monitoring coverage',
  },
  {
    id: 'as-traffic-index',
    categoryId: 'assets',
    name: 'Store traffic index',
    description: 'Footfall heatmap',
  },
  {
    id: 'as-heat-chart',
    categoryId: 'assets',
    name: 'High heat districts chart',
    description: 'Temperature anomalies',
  },
  {
    id: 'as-station-csv',
    categoryId: 'assets',
    name: 'Station export CSV',
    description: 'Raw station dump',
  },
  {
    id: 'as-corridor-photos',
    categoryId: 'assets',
    name: 'Corridor photo set',
    description: 'Field survey stills',
  },
]

export function filterCategories(query: string): InlineContextCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return INLINE_CONTEXT_CATEGORIES
  return INLINE_CONTEXT_CATEGORIES.filter((c) => c.label.toLowerCase().includes(q))
}

export function filterItems(categoryId: InlineContextCategoryId, query: string): InlineContextItem[] {
  const q = query.trim().toLowerCase()
  const items = INLINE_CONTEXT_ITEMS.filter((item) => item.categoryId === categoryId)
  if (!q) return items
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false),
  )
}

export function getCategory(id: InlineContextCategoryId): InlineContextCategory | undefined {
  return INLINE_CONTEXT_CATEGORIES.find((c) => c.id === id)
}

export function findItemByName(name: string): InlineContextItem | undefined {
  return INLINE_CONTEXT_ITEMS.find((item) => item.name === name)
}

export function findItemById(id: string): InlineContextItem | undefined {
  return INLINE_CONTEXT_ITEMS.find((item) => item.id === id)
}

export function getCategoryIcon(categoryId: InlineContextCategoryId): Icon {
  return getCategory(categoryId)?.Icon ?? Database
}

export type InlineMentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; name: string; categoryId: InlineContextCategoryId }

/** Split plain text so known `@Name` tokens can be highlighted in sent messages. */
export function splitTextWithInlineMentions(text: string): InlineMentionSegment[] {
  if (!text) return [{ type: 'text', value: '' }]

  const names = [...new Set(INLINE_CONTEXT_ITEMS.map((item) => item.name))].sort(
    (a, b) => b.length - a.length,
  )
  if (names.length === 0) return [{ type: 'text', value: text }]

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`@(?:${names.map(escape).join('|')})`, 'g')
  const segments: InlineMentionSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const token = match[0]
    const name = token.slice(1)
    const item = findItemByName(name)
    segments.push({
      type: 'mention',
      value: token,
      name,
      categoryId: item?.categoryId ?? 'database',
    })
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }]
}

