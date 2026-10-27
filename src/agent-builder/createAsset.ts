import type { DataRecord, DataValue, NodeField } from './nodeCatalog'
import { sentenceCase } from './recordUtils'

/** What a later run does with the asset the first run created. */
export type AssetRefresh = 'update' | 'new'

export type CreateAssetSettings = {
  /** Required before the node can run. */
  title?: string
  /** A `CHART_CHOICES` id; map layers are namespaced `map:<subtype>`. */
  chartType: string
  /** Mapping field key to upstream column. */
  mapping: Readonly<Record<string, string>>
  /** An ancestor node id to read rows from instead of the wired input. */
  rowSource?: string
  refresh: AssetRefresh
}

/** What a field plays in its chart, so a column keeps its part when the chart type changes. */
type MappingRole = 'category' | 'measure' | 'xMeasure' | 'low' | 'high' | 'direction' | 'speed'

export type MappingField = { key: string; label: string; role: MappingRole }

export type ChartChoice = {
  id: string
  label: string
  group: ChartGroup
  fields: readonly MappingField[]
}

export type ChartGroup = 'Basic' | 'Comparison' | 'Trend' | 'Distribution' | 'Map layers'

export const CHART_GROUPS: readonly ChartGroup[] = ['Basic', 'Comparison', 'Trend', 'Distribution', 'Map layers']

const VALUE: MappingField = { key: 'value', label: 'Value Field', role: 'measure' }
const CATEGORY: MappingField = { key: 'category', label: 'Category Field', role: 'category' }
const X_AXIS: MappingField = { key: 'x', label: 'X Axis Field', role: 'category' }
const X_CATEGORY: MappingField = { key: 'x', label: 'X Category Field', role: 'category' }
const X_VALUE: MappingField = { key: 'x', label: 'X Value Field', role: 'measure' }
const Y_VALUE: MappingField = { key: 'y', label: 'Y Value Field', role: 'measure' }
const Y_CATEGORY: MappingField = { key: 'y', label: 'Y Category Field', role: 'category' }

const mapLayer = (subtype: string, label: string): ChartChoice => ({ id: `map:${subtype}`, label, group: 'Map layers', fields: [] })

export const CHART_CHOICES: readonly ChartChoice[] = [
  { id: 'table', label: 'Table', group: 'Basic', fields: [] },
  { id: 'kpi_card', label: 'KPI Card', group: 'Basic', fields: [VALUE] },
  { id: 'gauge', label: 'Gauge', group: 'Basic', fields: [VALUE] },
  { id: 'bar', label: 'Bar Chart', group: 'Comparison', fields: [X_CATEGORY, Y_VALUE] },
  { id: 'horizontal_bar', label: 'Horizontal Bar Chart', group: 'Comparison', fields: [X_VALUE, Y_CATEGORY] },
  { id: 'progress_bar', label: 'Progress Bar', group: 'Comparison', fields: [X_VALUE, Y_CATEGORY] },
  { id: 'pie', label: 'Pie Chart', group: 'Comparison', fields: [CATEGORY, VALUE] },
  { id: 'line', label: 'Line Chart', group: 'Trend', fields: [X_AXIS, Y_VALUE] },
  { id: 'area', label: 'Area Chart', group: 'Trend', fields: [X_AXIS, Y_VALUE] },
  {
    id: 'range',
    label: 'Range Chart',
    group: 'Trend',
    fields: [
      X_AXIS,
      { key: 'low', label: 'Low Bound Field', role: 'low' },
      { key: 'high', label: 'High Bound Field', role: 'high' },
    ],
  },
  {
    id: 'scatter',
    label: 'Scatter Plot',
    group: 'Distribution',
    fields: [{ key: 'x', label: 'X Value Field', role: 'xMeasure' }, Y_VALUE],
  },
  {
    id: 'polar',
    label: 'Polar / Wind Rose',
    group: 'Distribution',
    fields: [
      { key: 'direction', label: 'Direction Field', role: 'direction' },
      { key: 'speed', label: 'Speed Field', role: 'speed' },
    ],
  },
  mapLayer('points', 'Points'),
  mapLayer('area', 'Area'),
  mapLayer('heatmap', 'Heatmap'),
  mapLayer('arcs', 'Arcs'),
  mapLayer('fences', 'Fences'),
  mapLayer('pillars', 'Pillars'),
  mapLayer('discs', 'Discs'),
  mapLayer('wind', 'Wind'),
]

const CHOICES_BY_ID: Readonly<Record<string, ChartChoice>> = Object.fromEntries(CHART_CHOICES.map((choice) => [choice.id, choice]))

export const DEFAULT_CREATE_ASSET: CreateAssetSettings = { chartType: 'table', mapping: {}, refresh: 'update' }

export const chartChoice = (id: string): ChartChoice => CHOICES_BY_ID[id] ?? CHOICES_BY_ID.table
export const isMapLayer = (id: string) => id.startsWith('map:')

/**
 * Carries each mapped column to the field with the same role in the new chart type. Sideways bars read
 * `x` as the value, so switching between an upright and a sideways bar swaps `x` and `y`.
 */
export function remapForChart(settings: CreateAssetSettings, chartType: string): Readonly<Record<string, string>> {
  const byRole = new Map(
    chartChoice(settings.chartType).fields.flatMap((field) =>
      settings.mapping[field.key] ? [[field.role, settings.mapping[field.key]] as const] : [],
    ),
  )
  return Object.fromEntries(
    chartChoice(chartType).fields.flatMap((field) => {
      const column = byRole.get(field.role)
      return column ? [[field.key, column] as const] : []
    }),
  )
}

export const missingMapping = (settings: CreateAssetSettings) =>
  chartChoice(settings.chartType).fields.filter((field) => !settings.mapping[field.key])

/** Why a run would be refused, or undefined when the node is ready. */
export function createAssetIssue(settings: CreateAssetSettings): string | undefined {
  if (!settings.title?.trim()) return 'Give the asset a title before running.'
  const missing = missingMapping(settings)
  if (missing.length) return `Choose the ${missing.map((field) => field.label).join(' and ')} before running.`
  return undefined
}

/** The chart type's name as a card reads it, e.g. "Bar chart" or "Points map layer". */
export const chartName = (chartType: string) => {
  const choice = chartChoice(chartType)
  return sentenceCase(isMapLayer(chartType) ? `${choice.label} map layer` : choice.label)
}

/** What the plotted parts are measured by; the rest are what gets measured. */
const BY_ROLES: ReadonlySet<MappingRole> = new Set(['category', 'direction'])

/** The node's one card value, e.g. "Bar chart of anomalies by site". */
export function createAssetFields(settings: CreateAssetSettings): NodeField[] {
  const mapped = (by: boolean) =>
    chartChoice(settings.chartType).fields.flatMap((field) => (BY_ROLES.has(field.role) === by && settings.mapping[field.key] ? [settings.mapping[field.key]] : []))
  const of = mapped(false)
  const by = mapped(true)
  const value = [
    chartName(settings.chartType),
    of.length ? ` of ${of.join(' and ')}` : '',
    by.length ? ` by ${by.join(' and ')}` : '',
    settings.refresh === 'new' ? ', new asset each run' : '',
  ].join('')
  return [{ label: 'Asset', value }]
}

/* ---------- Columns ---------- */

export type ColumnKind = 'string' | 'number' | 'boolean' | 'null'

export type Column = { name: string; kind: ColumnKind }

const kindOf = (value: DataValue | undefined): ColumnKind =>
  value === null || value === undefined ? 'null' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'

/** Column names in first-seen order, typed from their first non-null value. */
export function columnsOf(records: readonly DataRecord[]): Column[] {
  const names = [...new Set(records.flatMap((record) => Object.keys(record)))]
  return names.map((name) => ({
    name,
    kind: kindOf(records.find((record) => record[name] !== null && record[name] !== undefined)?.[name]),
  }))
}

/* ---------- Map geometry ---------- */

const GEOMETRY_NAMES = ['location', 'geometry', 'geom', 'wkt', 'geojson', 'coordinates']
const LATITUDE_NAMES = ['lat', 'latitude']
const LONGITUDE_NAMES = ['lng', 'lon', 'long', 'longitude']

export type Geometry = { kind: 'column'; column: string } | { kind: 'latLng'; latitude: string; longitude: string }

/** Point geometry read from column names, the way the first run infers it when the node sends no mapping. */
export function detectGeometry(columns: readonly Column[]): Geometry | null {
  const find = (names: readonly string[]) => columns.find((column) => names.includes(column.name.toLowerCase()))?.name
  const column = find(GEOMETRY_NAMES)
  if (column) return { kind: 'column', column }
  const latitude = find(LATITUDE_NAMES)
  const longitude = find(LONGITUDE_NAMES)
  return latitude && longitude ? { kind: 'latLng', latitude, longitude } : null
}

/** Arcs need an origin and a destination and fences need a path, so only point layers are detected. */
export const detectsGeometry = (chartType: string) => !['map:arcs', 'map:fences'].includes(chartType)

/* ---------- Suggestion ---------- */

const words = (name: string) => name.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A title and chart type read from the upstream columns, applied once as a proposal. */
export function suggestAsset(records: readonly DataRecord[]): Pick<CreateAssetSettings, 'title' | 'chartType' | 'mapping'> {
  const columns = columnsOf(records)
  const geometry = detectGeometry(columns)
  const coordinates = new Set(geometry?.kind === 'latLng' ? [geometry.latitude, geometry.longitude] : [])
  const category = columns.find((column) => column.kind === 'string')
  const numbers = columns.filter((column) => column.kind === 'number' && !coordinates.has(column.name))
  const measure = numbers.find((column) => records.some((record) => Number(record[column.name]) > 1)) ?? numbers[0]
  if (category && measure) {
    return {
      title: sentence(`${words(measure.name)} by ${words(category.name)}`),
      chartType: 'bar',
      mapping: { x: category.name, y: measure.name },
    }
  }
  if (geometry) return { title: 'Locations', chartType: 'map:points', mapping: {} }
  if (measure) return { title: sentence(words(measure.name)), chartType: 'kpi_card', mapping: { value: measure.name } }
  return { title: 'Results', chartType: 'table', mapping: {} }
}
