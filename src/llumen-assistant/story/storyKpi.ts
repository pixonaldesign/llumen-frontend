import { formatCount } from './StoryCharts'
import type { StoryScene } from './storyDemoScenes'

export type ChartCardId = 'emissions' | 'groundwater' | 'biodiversity' | 'sites'

export type KpiSource = 'mapped' | 'manual'
export type KpiCalculation = 'sum' | 'average' | 'min' | 'max' | 'count'
export type KpiUnitSource = 'none' | 'field' | 'custom'
export type KpiMaxSource = 'none' | 'field' | 'custom'
export type KpiFieldId =
  | 'communities'
  | 'junctions'
  | 'emissions'
  | 'groundwater'
  | 'triggers'
  | 'terrestrial'
  | 'marine'
  | 'onlineSites'
  | 'totalSites'
  | 'uptime'

export type ChartKpiConfig = {
  show: boolean
  source: KpiSource
  manualText: string
  field: KpiFieldId
  calculation: KpiCalculation
  unitSource: KpiUnitSource
  unit: string
  maxSource: KpiMaxSource
  maxField: KpiFieldId
  maxValue: string
}

export type ResolvedKpi =
  | { text: string }
  | { value: number; format: (value: number) => string; suffix: string }

type SceneValues = Pick<StoryScene, 'insight' | 'legend'>

type KpiField = {
  id: KpiFieldId
  label: string
  unit: string
  /** `share` splits the total across districts; `level` varies a rate around it. */
  spread: 'share' | 'level'
  format: (value: number) => string
  total: (scene: SceneValues) => number
}

const DISTRICT_SHARES = [0.28, 0.22, 0.19, 0.17, 0.14]
const DISTRICT_OFFSETS = [0.12, -0.08, 0.05, -0.11, 0.02]

function parseCompact(label: string) {
  const value = Number.parseFloat(label)
  if (Number.isNaN(value)) return 0
  if (/k$/i.test(label)) return value * 1_000
  if (/m$/i.test(label)) return value * 1_000_000
  return value
}

export const KPI_FIELDS: KpiField[] = [
  {
    id: 'communities',
    label: 'communities',
    unit: 'Communities',
    spread: 'share',
    format: formatCount,
    total: ({ legend }) => Math.round(legend.junctionCount * 0.21),
  },
  {
    id: 'junctions',
    label: 'monitored_junctions',
    unit: 'Junctions',
    spread: 'share',
    format: formatCount,
    total: ({ legend }) => legend.junctionCount,
  },
  {
    id: 'emissions',
    label: 'traffic_volume',
    unit: 'Vehicles/hour',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => parseCompact(insight.emissionsLabels[0] ?? '0'),
  },
  {
    id: 'groundwater',
    label: 'average_junction_load',
    unit: '%',
    spread: 'level',
    format: formatCount,
    total: ({ insight }) => insight.groundwaterValue,
  },
  {
    id: 'triggers',
    label: 'monitored_junctions',
    unit: 'Junctions',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => insight.terrestrial + insight.marine,
  },
  {
    id: 'terrestrial',
    label: 'free_flowing_junctions',
    unit: 'Junctions',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => insight.terrestrial,
  },
  {
    id: 'marine',
    label: 'congested_junctions',
    unit: 'Junctions',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => insight.marine,
  },
  {
    id: 'onlineSites',
    label: 'reporting_junctions',
    unit: 'Reporting',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => insight.online,
  },
  {
    id: 'totalSites',
    label: 'monitored_junctions',
    unit: 'Junctions',
    spread: 'share',
    format: formatCount,
    total: ({ insight }) => insight.sites,
  },
  {
    id: 'uptime',
    label: 'data_coverage',
    unit: '%',
    spread: 'level',
    format: formatCount,
    total: ({ insight }) => insight.uptime,
  },
]

export const KPI_SOURCES: { value: KpiSource; label: string }[] = [
  { value: 'mapped', label: 'Mapped data' },
  { value: 'manual', label: 'Manual text' },
]

export const KPI_CALCULATIONS: { value: KpiCalculation; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count', label: 'Count' },
]

export const KPI_UNIT_SOURCES: { value: KpiUnitSource; label: string }[] = [
  { value: 'none', label: 'No unit' },
  { value: 'field', label: 'Field unit' },
  { value: 'custom', label: 'Custom unit' },
]

export const KPI_MAX_SOURCES: { value: KpiMaxSource; label: string }[] = [
  { value: 'none', label: 'No max value' },
  { value: 'field', label: 'Mapped field' },
  { value: 'custom', label: 'Custom value' },
]

const BASE_KPI: ChartKpiConfig = {
  show: true,
  source: 'mapped',
  manualText: '',
  field: 'communities',
  calculation: 'sum',
  unitSource: 'field',
  unit: '',
  maxSource: 'none',
  maxField: 'totalSites',
  maxValue: '',
}

/** Mirrors the KPI line each chart renders before it is configured. */
export const DEFAULT_CHART_KPI: Record<ChartCardId, ChartKpiConfig> = {
  emissions: { ...BASE_KPI, show: false, field: 'emissions' },
  groundwater: { ...BASE_KPI, field: 'groundwater', calculation: 'average' },
  biodiversity: { ...BASE_KPI, field: 'triggers' },
  sites: { ...BASE_KPI, field: 'onlineSites', maxSource: 'field', maxField: 'totalSites' },
}

export function kpiFieldById(id: KpiFieldId) {
  return KPI_FIELDS.find((field) => field.id === id) ?? KPI_FIELDS[0]
}

function fieldValues(field: KpiField, scene: SceneValues) {
  const total = field.total(scene)
  return field.spread === 'share'
    ? DISTRICT_SHARES.map((share) => total * share)
    : DISTRICT_OFFSETS.map((offset) => total * (1 + offset))
}

function calculate(values: number[], calculation: KpiCalculation) {
  switch (calculation) {
    case 'average':
      return values.reduce((sum, value) => sum + value, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'count':
      return values.length
    default:
      return values.reduce((sum, value) => sum + value, 0)
  }
}

export function resolveKpi(config: ChartKpiConfig, scene: SceneValues): ResolvedKpi | null {
  if (!config.show) return null
  if (config.source === 'manual') {
    const text = config.manualText.trim()
    return text ? { text } : null
  }
  const field = kpiFieldById(config.field)
  const format = config.calculation === 'count' ? formatCount : field.format
  const value = calculate(fieldValues(field, scene), config.calculation)
  const unit =
    config.unitSource === 'field' ? field.unit : config.unitSource === 'custom' ? config.unit.trim() : ''
  let max = ''
  if (config.maxSource === 'field') {
    const maxField = kpiFieldById(config.maxField)
    const maxFormat = config.calculation === 'count' ? formatCount : maxField.format
    max = maxFormat(calculate(fieldValues(maxField, scene), config.calculation))
  } else if (config.maxSource === 'custom') {
    max = config.maxValue.trim()
  }
  const suffix = max ? `/${max}${unit ? ` ${unit}` : ''}` : unit
  return { value, format, suffix }
}
