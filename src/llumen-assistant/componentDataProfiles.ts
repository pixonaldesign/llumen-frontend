import type { CreatedComponent } from './assistantReplyTypes'
import { airQualityMapQueryTable } from './airQualityMapDemoData'
import { llumenAssets } from './assets'
import { queryResultsForComponent, type QueryResultTable } from './componentQueryResults'

export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date' | 'location'

export type ColumnDistribution = {
  yMaxLabel: string
  xLabels: string[]
  /** Relative bar heights in 0–1 */
  bars: number[]
  /** Absolute bin counts for tooltips */
  counts: number[]
}

export type ColumnProfile = {
  name: string
  dataType: ColumnDataType
  count: string
  missing: string
  zeroes: string
  min: string
  max: string
  median: string
  distribution?: ColumnDistribution
}

export const TEMPORAL_GRANULARITIES = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'years',
] as const

export type TemporalGranularity = (typeof TEMPORAL_GRANULARITIES)[number]

export const TEMPORAL_GRANULARITY_LABELS: Record<TemporalGranularity, string> = {
  seconds: 'Seconds',
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  weeks: 'Weeks',
  years: 'Years',
}

export type TemporalAvailabilitySeries = {
  id: string
  label: string
  startLabel: string
  endLabel: string
  /** Gap segments as fractions of the full range (0–1); used when timestamps are unavailable */
  gaps: { start: number; width: number }[]
  /** Absolute range for label formatting and gap rebucketing */
  rangeStartMs?: number
  rangeEndMs?: number
  /** Observation timestamps for granularity-aware gap detection */
  timestamps?: number[]
}

export function temporalUnitMs(granularity: TemporalGranularity): number {
  switch (granularity) {
    case 'seconds':
      return 1000
    case 'minutes':
      return 60_000
    case 'hours':
      return 3_600_000
    case 'days':
      return 86_400_000
    case 'weeks':
      return 7 * 86_400_000
    case 'years':
      return 365.25 * 86_400_000
  }
}

export function resolveTemporalRangeMs(series: TemporalAvailabilitySeries): {
  startMs: number
  endMs: number
} {
  if (
    series.rangeStartMs != null &&
    series.rangeEndMs != null &&
    series.rangeEndMs > series.rangeStartMs
  ) {
    return { startMs: series.rangeStartMs, endMs: series.rangeEndMs }
  }
  if (series.timestamps && series.timestamps.length > 0) {
    return {
      startMs: Math.min(...series.timestamps),
      endMs: Math.max(...series.timestamps),
    }
  }
  const startYear = Number(series.startLabel)
  const endYear = Number(series.endLabel)
  if (
    /^\d{4}$/.test(series.startLabel) &&
    /^\d{4}$/.test(series.endLabel) &&
    endYear > startYear
  ) {
    return { startMs: Date.UTC(startYear, 0, 1), endMs: Date.UTC(endYear, 0, 1) }
  }
  return { startMs: Date.UTC(2020, 0, 1), endMs: Date.UTC(2026, 0, 1) }
}

export function formatTemporalBoundLabel(
  ms: number,
  granularity: TemporalGranularity,
): string {
  const date = new Date(ms)
  switch (granularity) {
    case 'years':
      return String(date.getUTCFullYear())
    case 'weeks':
    case 'days':
      return date.toISOString().slice(0, 10)
    case 'hours':
      return `${date.toISOString().slice(0, 13).replace('T', ' ')}:00`
    case 'minutes':
      return date.toISOString().slice(0, 16).replace('T', ' ')
    case 'seconds':
      return date.toISOString().slice(0, 19).replace('T', ' ')
  }
}

function mergeGapSegments(
  gaps: { start: number; width: number }[],
): { start: number; width: number }[] {
  if (gaps.length === 0) return []
  const sorted = [...gaps].sort((a, b) => a.start - b.start)
  const out: { start: number; width: number }[] = []
  for (const gap of sorted) {
    const last = out[out.length - 1]
    const gapEnd = gap.start + gap.width
    if (!last || gap.start > last.start + last.width + 1e-9) {
      out.push({ start: gap.start, width: gap.width })
      continue
    }
    last.width = Math.max(last.start + last.width, gapEnd) - last.start
  }
  return out
}

function clampGap(
  start: number,
  width: number,
): { start: number; width: number } | null {
  const clampedStart = Math.max(0, Math.min(1, start))
  const clampedWidth = Math.max(0, Math.min(1 - clampedStart, width))
  if (clampedWidth < 0.004) return null
  return { start: clampedStart, width: clampedWidth }
}

function gapsFromTimestampsAtGranularity(
  timestamps: number[],
  granularity: TemporalGranularity,
): { start: number; width: number }[] {
  if (timestamps.length < 2) return []
  const startMs = Math.min(...timestamps)
  const endMs = Math.max(...timestamps)
  const span = endMs - startMs || 1
  const unit = temporalUnitMs(granularity)
  const filled = new Set<number>()
  for (const t of timestamps) {
    filled.add(Math.floor((t - startMs) / unit))
  }
  const sorted = [...filled].sort((a, b) => a - b)
  const lastBin = Math.floor(span / unit)
  const gaps: { start: number; width: number }[] = []

  const pushRange = (fromBin: number, toBinExclusive: number) => {
    if (toBinExclusive <= fromBin) return
    const next = clampGap((fromBin * unit) / span, ((toBinExclusive - fromBin) * unit) / span)
    if (next) gaps.push(next)
  }

  if (sorted[0]! > 0) pushRange(0, sorted[0]!)
  for (let i = 0; i < sorted.length - 1; i += 1) {
    pushRange(sorted[i]! + 1, sorted[i + 1]!)
  }
  if (sorted[sorted.length - 1]! < lastBin) {
    pushRange(sorted[sorted.length - 1]! + 1, lastBin + 1)
  }

  return mergeGapSegments(gaps).slice(0, 16)
}

function gapsFromBaseAtGranularity(
  baseGaps: { start: number; width: number }[],
  spanMs: number,
  granularity: TemporalGranularity,
): { start: number; width: number }[] {
  const unit = temporalUnitMs(granularity)
  const totalBins = Math.max(2, Math.round(spanMs / unit))
  const BASE = 96

  // Finer than the authored resolution: keep authored gaps (no invented detail).
  if (totalBins >= BASE) {
    return mergeGapSegments(baseGaps).slice(0, 16)
  }

  const filled = Array.from({ length: BASE }, () => true)
  for (const gap of baseGaps) {
    const from = Math.max(0, Math.floor(gap.start * BASE))
    const to = Math.min(BASE, Math.ceil((gap.start + gap.width) * BASE))
    for (let i = from; i < to; i += 1) filled[i] = false
  }

  const targetFilled = Array.from({ length: totalBins }, () => true)
  for (let bin = 0; bin < totalBins; bin += 1) {
    const from = Math.floor((bin / totalBins) * BASE)
    const to = Math.max(from + 1, Math.ceil(((bin + 1) / totalBins) * BASE))
    let empty = 0
    for (let i = from; i < to; i += 1) {
      if (!filled[i]) empty += 1
    }
    targetFilled[bin] = empty / (to - from) < 0.5
  }

  const gaps: { start: number; width: number }[] = []
  let i = 0
  while (i < totalBins) {
    if (!targetFilled[i]) {
      let j = i
      while (j < totalBins && !targetFilled[j]) j += 1
      const next = clampGap(i / totalBins, (j - i) / totalBins)
      if (next) gaps.push(next)
      i = j
    } else {
      i += 1
    }
  }
  return mergeGapSegments(gaps).slice(0, 16)
}

export function gapsForGranularity(
  series: TemporalAvailabilitySeries,
  granularity: TemporalGranularity,
): { start: number; width: number }[] {
  const { startMs, endMs } = resolveTemporalRangeMs(series)
  if (series.timestamps && series.timestamps.length >= 2) {
    return gapsFromTimestampsAtGranularity(series.timestamps, granularity)
  }
  return gapsFromBaseAtGranularity(series.gaps, endMs - startMs || 1, granularity)
}

export type SpatialAvailabilitySeries = {
  id: string
  label: string
  mapSrc: string
  mapAlt: string
}

export type DataProfileOverview = {
  rows: string
  columns: string
  numericColumns: string
}

export type DataProfile = {
  overview: DataProfileOverview
  columns: ColumnProfile[]
  temporal: TemporalAvailabilitySeries[]
  spatial: SpatialAvailabilitySeries[]
}

const SPATIAL_PRIMARY = {
  mapSrc: llumenAssets.dataProfileSpatialAvailability,
  mapAlt: 'Spatial data availability map with coverage and gap regions',
}

const SPATIAL_SECONDARY = {
  mapSrc: llumenAssets.mapAbuDhabiAqi,
  mapAlt: 'Alternate spatial coverage for a related location column',
}

function formatCompactCount(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

/**
 * Build a distribution from absolute bin counts so bar heights, x labels,
 * and the y-axis max stay internally consistent (1 bar ↔ 1 label).
 */
function fromCounts(bins: { label: string; count: number }[]): ColumnDistribution {
  const max = Math.max(...bins.map((bin) => bin.count), 1)
  return {
    yMaxLabel: formatCompactCount(max),
    xLabels: bins.map((bin) => bin.label),
    bars: bins.map((bin) => Math.max(0.05, bin.count / max)),
    counts: bins.map((bin) => bin.count),
  }
}

function dist(bars: number[], yMaxLabel: string, xLabels?: string[]): ColumnDistribution {
  const labels =
    xLabels ??
    bars.map((_, i) => {
      const step = Math.max(1, Math.round((bars.length - 1) / 6))
      const idx = i * step
      return String(idx === 0 ? 1 : idx)
    }).slice(0, Math.min(7, bars.length))
  const peak = Math.max(...bars, 0.05)
  // Approximate counts from relative heights for curated profiles
  const scale = Math.max(1, Math.round(Number(String(yMaxLabel).replace(/K$/i, '000').replace(/M$/i, '000000')) || 100))
  return {
    yMaxLabel,
    xLabels: labels.slice(0, bars.length),
    bars,
    counts: bars.map((h) => Math.max(1, Math.round((h / peak) * scale))),
  }
}

const PROFILES_BY_ID: Record<string, DataProfile> = {
  'air-quality-index': {
    overview: {
      rows: '48.6K',
      columns: '7',
      numericColumns: '1',
    },
    columns: [
      {
        name: 'Timestamp',
        dataType: 'date',
        count: '48.6K',
        missing: '0%',
        zeroes: '—',
        min: '00:00',
        max: '23:00',
        median: '12:00',
        // Hourly readings: afternoon peak matches elevated AQI in the demo
        distribution: fromCounts([
          { label: '00–03', count: 4_200 },
          { label: '04–07', count: 5_100 },
          { label: '08–11', count: 8_400 },
          { label: '12–15', count: 11_800 },
          { label: '16–19', count: 10_600 },
          { label: '20–23', count: 8_500 },
        ]),
      },
      {
        name: 'Station',
        dataType: 'string',
        count: '48.6K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: fromCounts([
          { label: 'Network avg', count: 48_600 },
        ]),
      },
      {
        name: 'AQI',
        dataType: 'number',
        count: '48.6K',
        missing: '0.3%',
        zeroes: '0%',
        min: '42',
        max: '168',
        median: '112',
        distribution: fromCounts([
          { label: '0–50', count: 3_400 },
          { label: '51–100', count: 12_800 },
          { label: '101–150', count: 24_600 },
          { label: '151–200', count: 7_800 },
        ]),
      },
      {
        name: 'Category',
        dataType: 'string',
        count: '48.6K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        // Aligned with AQI bins above
        distribution: fromCounts([
          { label: 'Good', count: 3_400 },
          { label: 'Moderate', count: 12_800 },
          { label: 'USG', count: 24_600 },
          { label: 'Unhealthy', count: 7_800 },
        ]),
      },
      {
        name: 'Dominant pollutant',
        dataType: 'string',
        count: '48.6K',
        missing: '0.1%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: fromCounts([
          { label: 'NO₂', count: 28_400 },
          { label: 'PM₂.₅', count: 12_200 },
          { label: 'O₃', count: 4_600 },
          { label: 'PM₁₀', count: 2_400 },
          { label: 'SO₂', count: 1_000 },
        ]),
      },
    ],
    temporal: [
      {
        id: 'reading-time',
        label: 'Reading time',
        startLabel: '2022',
        endLabel: '2026',
        gaps: [
          { start: 0.36, width: 0.04 },
          { start: 0.55, width: 0.012 },
          { start: 0.79, width: 0.02 },
        ],
      },
    ],
    spatial: [
      {
        id: 'network-extent',
        label: 'Network extent',
        ...SPATIAL_PRIMARY,
      },
    ],
  },
  'pollutant-readings': {
    overview: {
      rows: '126.4K',
      columns: '9',
      numericColumns: '2',
    },
    columns: [
      {
        name: 'Pollutant',
        dataType: 'string',
        count: '126.4K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        // Near-equal sample volume per pollutant (same stations, same cadence)
        distribution: fromCounts([
          { label: 'NO₂', count: 22_400 },
          { label: 'PM₂.₅', count: 22_100 },
          { label: 'PM₁₀', count: 21_200 },
          { label: 'O₃', count: 20_800 },
          { label: 'SO₂', count: 20_100 },
          { label: 'CO', count: 19_800 },
        ]),
      },
      {
        name: 'Value',
        dataType: 'number',
        count: '126.4K',
        missing: '0.5%',
        zeroes: '0.3%',
        // µg/m³-scale readings (CO converted); median sits in the 40–80 bin
        min: '0.4',
        max: '480',
        median: '54',
        distribution: fromCounts([
          { label: '0–40', count: 41_200 },
          { label: '41–80', count: 36_800 },
          { label: '81–150', count: 24_600 },
          { label: '151–250', count: 14_200 },
          { label: '251+', count: 9_600 },
        ]),
      },
      {
        name: 'Unit',
        dataType: 'string',
        count: '126.4K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: fromCounts([
          { label: 'µg/m³', count: 106_600 },
          { label: 'mg/m³', count: 19_800 },
        ]),
      },
      {
        name: 'Threshold',
        dataType: 'number',
        count: '126.4K',
        missing: '0%',
        zeroes: '0%',
        // Discrete legal/limit thresholds per pollutant (matches query results)
        min: '10',
        max: '200',
        median: '150',
        distribution: fromCounts([
          { label: '10', count: 19_800 },
          { label: '55', count: 22_100 },
          { label: '125', count: 20_100 },
          { label: '150', count: 21_200 },
          { label: '180', count: 20_800 },
          { label: '200', count: 22_400 },
        ]),
      },
      {
        name: 'Classification',
        dataType: 'string',
        count: '126.4K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        // Most readings under threshold; corridor spikes drive Critical (NO₂ / PM₂.₅)
        distribution: fromCounts([
          { label: 'Normal', count: 78_400 },
          { label: 'Elevated', count: 31_200 },
          { label: 'Critical', count: 16_800 },
        ]),
      },
    ],
    temporal: [
      {
        id: 'sample-time',
        label: 'Sample time',
        startLabel: '2018',
        endLabel: '2026',
        gaps: [
          { start: 0.4, width: 0.045 },
          { start: 0.56, width: 0.01 },
          { start: 0.6, width: 0.01 },
          { start: 0.86, width: 0.015 },
        ],
      },
      {
        id: 'validated-at',
        label: 'Validated at',
        startLabel: '2020',
        endLabel: '2026',
        gaps: [{ start: 0.64, width: 0.03 }],
      },
    ],
    spatial: [
      {
        id: 'sensor-site',
        label: 'Sensor site',
        ...SPATIAL_PRIMARY,
      },
      {
        id: 'plume-extent',
        label: 'Plume extent',
        ...SPATIAL_SECONDARY,
      },
    ],
  },
  'population-exposure': {
    overview: {
      rows: '2.8K',
      columns: '6',
      numericColumns: '1',
    },
    columns: [
      {
        name: 'Cohort',
        dataType: 'string',
        count: '2.8K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
      },
      {
        name: 'Population',
        dataType: 'number',
        count: '2.8K',
        missing: '0%',
        zeroes: '0%',
        min: '12K',
        max: '2.1M',
        median: '380K',
        distribution: dist([0.2, 0.35, 0.55, 0.78, 0.92, 0.7, 0.45, 0.28], '620', [
          '50K',
          '200K',
          '500K',
          '800K',
          '1.2M',
          '1.6M',
          '2M',
        ]),
      },
      {
        name: 'Share',
        dataType: 'number',
        count: '2.8K',
        missing: '1.2%',
        zeroes: '0%',
        min: '2.4%',
        max: '52.5%',
        median: '18.6%',
        distribution: dist([0.4, 0.55, 0.7, 0.62, 0.48, 0.35], '480'),
      },
      {
        name: 'Priority',
        dataType: 'string',
        count: '2.8K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: dist([0.35, 0.55, 0.75], '1.1K', ['Standard', 'Elevated', 'High']),
      },
    ],
    temporal: [
      {
        id: 'census-vintage',
        label: 'Census vintage',
        startLabel: '2015',
        endLabel: '2025',
        gaps: [{ start: 0.48, width: 0.06 }],
      },
    ],
    spatial: [
      {
        id: 'district-bounds',
        label: 'District bounds',
        ...SPATIAL_PRIMARY,
      },
    ],
  },
  'land-use-distribution': {
    overview: {
      rows: '4.1K',
      columns: '7',
      numericColumns: '1',
    },
    columns: [
      {
        name: 'Land use',
        dataType: 'string',
        count: '4.1K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: dist([0.75, 0.55, 0.62, 0.35, 0.2], '1.2K', [
          'Ind',
          'Trans',
          'Res',
          'Com',
          'Open',
        ]),
      },
      {
        name: 'Area share',
        dataType: 'number',
        count: '4.1K',
        missing: '0%',
        zeroes: '0%',
        min: '1.2%',
        max: '38%',
        median: '18%',
        distribution: dist([0.3, 0.48, 0.7, 0.82, 0.55, 0.32], '780'),
      },
      {
        name: 'Near elevated stations',
        dataType: 'string',
        count: '4.1K',
        missing: '0.2%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
      },
      {
        name: 'Source risk',
        dataType: 'string',
        count: '4.1K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: dist([0.4, 0.55, 0.7], '1.5K', ['Low', 'Med', 'High']),
      },
    ],
    temporal: [
      {
        id: 'parcel-update',
        label: 'Parcel update',
        startLabel: '2016',
        endLabel: '2025',
        gaps: [
          { start: 0.33, width: 0.025 },
          { start: 0.72, width: 0.035 },
        ],
      },
    ],
    spatial: [
      {
        id: 'land-parcel',
        label: 'Land parcel',
        ...SPATIAL_PRIMARY,
      },
      {
        id: 'zoning-layer',
        label: 'Zoning layer',
        ...SPATIAL_SECONDARY,
      },
    ],
  },
  'wind-direction': {
    overview: {
      rows: '18.9K',
      columns: '6',
      numericColumns: '1',
    },
    columns: [
      {
        name: 'Hour',
        dataType: 'date',
        count: '18.9K',
        missing: '0%',
        zeroes: '—',
        min: '00:00',
        max: '23:00',
        median: '12:00',
        distribution: dist([0.35, 0.4, 0.5, 0.65, 0.8, 0.72, 0.55, 0.42], '1.6K'),
      },
      {
        name: 'Direction',
        dataType: 'string',
        count: '18.9K',
        missing: '0.1%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: dist([0.55, 0.7, 0.85, 0.6, 0.4, 0.28, 0.22, 0.18], '3.1K', [
          'N',
          'NE',
          'E',
          'SE',
          'S',
          'SW',
          'W',
          'NW',
        ]),
      },
      {
        name: 'Speed (m/s)',
        dataType: 'number',
        count: '18.9K',
        missing: '0.2%',
        zeroes: '0.4%',
        min: '0.2',
        max: '9.4',
        median: '3.6',
        distribution: dist([0.2, 0.38, 0.62, 0.85, 0.7, 0.45, 0.28, 0.15], '4.2K', [
          '0',
          '1.5',
          '3',
          '4.5',
          '6',
          '7.5',
          '9',
        ]),
      },
      {
        name: 'Aligned with corridor',
        dataType: 'string',
        count: '18.9K',
        missing: '0%',
        zeroes: '—',
        min: '—',
        max: '—',
        median: '—',
        distribution: dist([0.65, 0.4, 0.28], '8.2K', ['Yes', 'Partial', 'No']),
      },
    ],
    temporal: [
      {
        id: 'observation-hour',
        label: 'Observation hour',
        startLabel: '2023',
        endLabel: '2026',
        gaps: [
          { start: 0.28, width: 0.02 },
          { start: 0.61, width: 0.04 },
        ],
      },
    ],
    spatial: [
      {
        id: 'anemometer-sites',
        label: 'Anemometer sites',
        ...SPATIAL_PRIMARY,
      },
    ],
  },
}

function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[,%$AED\s]/g, '').replace(/[−–]/g, '-')
  if (!cleaned || cleaned === '—' || cleaned === '-') return null
  const match = cleaned.match(/^-?\d+(\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function parseDateMs(raw: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return null
  const ms = Date.parse(`${raw.trim()}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

function inferDataType(name: string, values: string[]): ColumnDataType {
  if (isSpatialColumn(name)) return 'location'
  const nonEmpty = values.filter((v) => v && v !== '—')
  if (nonEmpty.length === 0) return 'string'
  if (nonEmpty.every((v) => /^(yes|no|true|false)$/i.test(v.trim()))) return 'boolean'
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()) || /^\d{1,2}:\d{2}/.test(v.trim()))) {
    return 'date'
  }
  const nums = nonEmpty.map(parseNumeric)
  if (nums.every((n) => n != null)) return 'number'
  return 'string'
}

function formatCompact(n: number): string {
  return formatCompactCount(n)
}

function medianOf(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function categoricalDistribution(values: string[]): ColumnDistribution | undefined {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value || value === '—') continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  if (counts.size === 0) return undefined

  const entries = [...counts.entries()]
  const stationLike = entries.every(([label]) => /^AQ-\d+/i.test(label))
  entries.sort((a, b) => {
    if (stationLike) return a[0].localeCompare(b[0], undefined, { numeric: true })
    return b[1] - a[1] || a[0].localeCompare(b[0])
  })

  return fromCounts(entries.map(([label, count]) => ({ label, count })))
}

function numericDistribution(nums: number[], binCount = 5): ColumnDistribution | undefined {
  if (nums.length === 0) return undefined
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) {
    return fromCounts([{ label: formatCompact(min), count: nums.length }])
  }

  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width
    const end = i === binCount - 1 ? max : min + (i + 1) * width
    const label =
      Number.isInteger(min) && Number.isInteger(max)
        ? `${Math.round(start)}–${Math.round(end)}`
        : `${formatCompact(start)}–${formatCompact(end)}`
    return { label, count: 0, start, end }
  })

  for (const n of nums) {
    const idx = Math.min(binCount - 1, Math.floor((n - min) / width))
    bins[idx]!.count += 1
  }

  return fromCounts(bins.map(({ label, count }) => ({ label, count })))
}

function datetimeDistribution(values: string[]): ColumnDistribution | undefined {
  const years = new Map<string, number>()
  for (const value of values) {
    const ms = parseDateMs(value)
    if (ms == null) continue
    const year = String(new Date(ms).getUTCFullYear())
    years.set(year, (years.get(year) ?? 0) + 1)
  }
  if (years.size === 0) return categoricalDistribution(values)
  return fromCounts(
    [...years.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
  )
}

function gapsFromTimestamps(timestamps: number[]): { start: number; width: number }[] {
  if (timestamps.length < 2) return []
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  const span = max - min || 1
  const binCount = 48
  const filled = Array.from({ length: binCount }, () => false)
  for (const t of timestamps) {
    const idx = Math.min(binCount - 1, Math.floor(((t - min) / span) * binCount))
    filled[idx] = true
  }

  const gaps: { start: number; width: number }[] = []
  let i = 0
  while (i < binCount) {
    if (!filled[i]) {
      let j = i
      while (j < binCount && !filled[j]) j += 1
      const width = (j - i) / binCount
      if (width >= 0.012) gaps.push({ start: i / binCount, width })
      i = j
    } else {
      i += 1
    }
  }
  return gaps.slice(0, 6)
}

function isSpatialColumn(name: string): boolean {
  return /coord|corridor|coverage|grid|spatial/i.test(name)
}

function isTemporalColumn(name: string, dataType: ColumnDataType): boolean {
  if (dataType === 'date') return true
  return /time|date|calibrat|observ/i.test(name)
}

function percentOf(count: number, total: number): string {
  if (total <= 0) return '0%'
  return `${((count / total) * 100).toFixed(1).replace(/\.0$/, '')}%`
}

function profileColumn(name: string, values: string[]): ColumnProfile {
  const dataType = inferDataType(name, values)
  const nullCount = values.filter((v) => !v || v === '—').length
  const emptyCount = values.filter((v) => v === '').length
  const nums = values.map(parseNumeric).filter((n): n is number => n != null)
  const dates = values.map(parseDateMs).filter((n): n is number => n != null)
  const zeroCount = nums.filter((n) => n === 0).length
  const isNumeric = dataType === 'number'
  const showAgg = isNumeric && nums.length > 0
  const showDateAgg = dataType === 'date' && dates.length > 0

  let distribution: ColumnDistribution | undefined
  if (showAgg) distribution = numericDistribution(nums)
  else if (showDateAgg) distribution = datetimeDistribution(values)
  else if (dataType === 'string' || dataType === 'boolean' || dataType === 'location') {
    distribution = categoricalDistribution(values)
  }

  return {
    name,
    dataType,
    count: formatCompact(values.length),
    missing: percentOf(nullCount, values.length),
    zeroes: isNumeric ? percentOf(zeroCount, values.length) : percentOf(emptyCount, values.length),
    min: showAgg
      ? formatCompact(Math.min(...nums))
      : showDateAgg
        ? new Date(Math.min(...dates)).toISOString().slice(0, 10)
        : '—',
    max: showAgg
      ? formatCompact(Math.max(...nums))
      : showDateAgg
        ? new Date(Math.max(...dates)).toISOString().slice(0, 10)
        : '—',
    median: showAgg ? formatCompact(medianOf(nums)) : '—',
    distribution,
  }
}

function profileFromTable(table: QueryResultTable): DataProfile {
  const columns: ColumnProfile[] = table.columns.map((name, colIndex) => {
    const values = table.rows.map((row) => row[colIndex] ?? '')
    return profileColumn(name, values)
  })

  const numericColumns = columns.filter((c) => c.dataType === 'number').length

  const temporal: TemporalAvailabilitySeries[] = columns
    .filter((column) => isTemporalColumn(column.name, column.dataType))
    .map((column) => {
      const colIndex = table.columns.indexOf(column.name)
      const timestamps = table.rows
        .map((row) => parseDateMs(row[colIndex] ?? ''))
        .filter((n): n is number => n != null)
      const rangeStartMs = timestamps.length > 0 ? Math.min(...timestamps) : undefined
      const rangeEndMs = timestamps.length > 0 ? Math.max(...timestamps) : undefined
      const startYear =
        rangeStartMs != null ? String(new Date(rangeStartMs).getUTCFullYear()) : '—'
      const endYear = rangeEndMs != null ? String(new Date(rangeEndMs).getUTCFullYear()) : '—'
      return {
        id: column.name.toLowerCase().replace(/\s+/g, '-'),
        label: column.name,
        startLabel: startYear,
        endLabel: endYear,
        rangeStartMs,
        rangeEndMs,
        timestamps,
        gaps: gapsFromTimestamps(timestamps),
      }
    })

  const spatialColumns = columns.filter((column) => isSpatialColumn(column.name))
  const spatial: SpatialAvailabilitySeries[] = (
    spatialColumns.length > 0 ? spatialColumns : columns.slice(0, 1)
  ).map((column, index) => ({
    id: column.name.toLowerCase().replace(/\s+/g, '-'),
    label: column.name,
    ...(index % 2 === 0 ? SPATIAL_PRIMARY : SPATIAL_SECONDARY),
  }))

  return {
    overview: {
      rows: formatCompact(table.rows.length),
      columns: String(table.columns.length),
      numericColumns: String(numericColumns),
    },
    columns,
    temporal:
      temporal.length > 0
        ? temporal
        : [
            {
              id: 'primary-time',
              label: 'Primary timestamp',
              startLabel: '2020',
              endLabel: '2026',
              gaps: [
                { start: 0.38, width: 0.04 },
                { start: 0.57, width: 0.012 },
                { start: 0.74, width: 0.02 },
              ],
            },
          ],
    spatial,
  }
}

export function dataProfileForComponent(component: CreatedComponent): DataProfile {
  if (component.id === 'air-quality-monitoring-map') {
    return profileFromTable(airQualityMapQueryTable())
  }
  return PROFILES_BY_ID[component.id] ?? profileFromTable(queryResultsForComponent(component))
}
