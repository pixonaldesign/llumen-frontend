/**
 * Assets the user built in Asset builder (Create → Asset) and follows from Briefing.
 * `visualTypeId` is the Asset builder visual type each one was created with.
 */

export type BriefingAssetSize = 'small' | 'medium' | 'large' | 'wide'

export type AssetSlice = { name: string; pct: number; color: string }

/** `display` replaces the bar's value and unit, as `+value unit`, wherever the bar is labelled. */
export type AssetBar = { label: string; value: number; display?: string }

export type AssetMetric = { label: string; value: number; suffix?: string; delta: string; good: boolean }

export type AssetSeries = { name: string; color: string; points: number[] }

type AssetBase = {
  id: string
  visualTypeId: string
  size: BriefingAssetSize
  category: string
  title: string
  accent: string
}

export type BriefingAsset = AssetBase &
  (
    | {
        kind: 'area'
        value: number
        unit: string
        /** Unit after a point's value in its hover tooltip. */
        tipUnit: string
        delta: string
        threshold: { value: number; label: string }
        points: number[]
        axis: string[]
      }
    | {
        kind: 'line'
        value: number
        unit: string
        tipUnit: string
        delta: string
        /** One per point, shown in the hover tooltip. */
        labels: string[]
        points: number[]
        axis: string[]
      }
    | { kind: 'hbar'; unit: string; bars: AssetBar[] }
    | { kind: 'vbar'; value: number; unit: string; tipUnit: string; delta: string; bars: AssetBar[] }
    | { kind: 'donut'; centre: string; centreLabel: string; slices: AssetSlice[] }
    | { kind: 'pie'; slices: AssetSlice[] }
    | { kind: 'kpi'; value: number; prefix?: string; suffix?: string; caption: string; spark: number[] }
    | { kind: 'kpiGrid'; metrics: AssetMetric[] }
    | {
        kind: 'gauge'
        value: number
        caption: string
        /** The filled arc's and the rest's hover tips; network pressure's when unset. */
        tips?: { fill: string; fillSuffix: string; gap: string }
      }
    | {
        kind: 'multiArea'
        /** Bottom of the value axis; the top is 100. */
        floor: number
        suffix: string
        /** One per point, shown in the hover tooltip. */
        labels: string[]
        axis: string[]
        series: AssetSeries[]
      }
  )

/**
 * Findings style 6's Assets grid, by asset and dashboard app id: the apps sit among the charts, and the
 * grid fills densely, so smaller cards backfill the gaps.
 */
export const DEFAULT_BOARD_ORDER: readonly string[] = [
  'dm-reports-today',
  'dm-odor-complaints',
  'dm-odor-app',
  'dm-jvc-app',
  'dm-jvc-sewer',
  'dm-creek-app',
  'dm-growth-pressure',
  'dm-plan-alignment',
  'dm-complaint-types',
  'dm-odor-week',
  'dm-h2s',
  'dm-utilisation',
  'dm-quoz-app',
]

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
export const BRIEFING_ASSETS: BriefingAsset[] = [
  {
    id: 'dm-odor-complaints',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Public health',
    title: 'CRM odor complaints, Al Barsha',
    accent: '#45cdb9',
    value: 118,
    caption: 'in 90 days around three parks, up 38%',
    spark: [4, 9, 13, 19, 26, 34, 43, 54, 67, 81, 98, 118],
  },
  {
    id: 'dm-plan-alignment',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Urban planning',
    title: 'Land use vs the plan',
    accent: '#9673e8',
    centre: '8 of 20',
    centreLabel: 'Off plan',
    slices: [
      { name: 'Aligned', pct: 60, color: '#45cdb9' },
      { name: 'Diverging', pct: 25, color: '#ffcf6b' },
      { name: 'Misaligned', pct: 15, color: '#df3f3f' },
    ],
  },
  {
    id: 'dm-complaint-types',
    kind: 'pie',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Customer service',
    title: 'Municipal complaints by type',
    accent: '#a9b8ff',
    slices: [
      { name: 'Odor', pct: 24, color: '#f38666' },
      { name: 'Waste', pct: 21, color: '#6a9ef0' },
      { name: 'Noise', pct: 17, color: '#bdb6f4' },
      { name: 'Drainage', pct: 15, color: '#26ada0' },
      { name: 'Pests', pct: 11, color: '#7ad488' },
      { name: 'Other', pct: 12, color: '#534d8f' },
    ],
  },
  {
    id: 'dm-jvc-sewer',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'Infrastructure',
    title: 'JVC sewerage capacity used',
    accent: '#df3f3f',
    value: 94,
    caption: 'at peak, against an 80% planning limit',
    tips: { fill: 'Used', fillSuffix: ' of capacity', gap: 'Headroom' },
  },
  {
    id: 'dm-reports-today',
    kind: 'area',
    visualTypeId: 'area-chart',
    size: 'large',
    category: 'Customer service',
    title: 'Municipal reports today',
    accent: '#9673e8',
    value: 1284,
    unit: 'reports so far',
    tipUnit: 'reports',
    delta: '+18% vs average',
    threshold: { value: 1090, label: '30-day average' },
    points: [
      0, 4, 6, 8, 9, 13, 25, 59, 122, 202, 298, 391, 479, 550, 626, 710, 802, 890, 978, 1067, 1147, 1201, 1243, 1268, 1284,
    ],
    axis: ['00:00', '06:00', '12:00', '18:00', 'Now'],
  },
  {
    id: 'dm-growth-pressure',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Urban planning',
    title: 'Highest growth pressure',
    accent: '#df3f3f',
    unit: 'of 100',
    bars: [
      { label: 'JVC', value: 92, display: '92' },
      { label: 'Business Bay', value: 88, display: '88' },
      { label: 'Arjan', value: 84, display: '84' },
      { label: 'Dubai South', value: 79, display: '79' },
      { label: 'Creek Harbour', value: 74, display: '74' },
    ],
  },
  {
    id: 'dm-odor-week',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'Public health',
    title: 'Odor complaints this week, Al Barsha',
    accent: '#45cdb9',
    value: 20,
    unit: 'complaints this week',
    tipUnit: 'complaints',
    delta: '+18%',
    bars: [
      { label: 'Mon', value: 2 },
      { label: 'Tue', value: 3 },
      { label: 'Wed', value: 2 },
      { label: 'Thu', value: 4 },
      { label: 'Fri', value: 3 },
      { label: 'Sat', value: 3 },
      { label: 'Sun', value: 3 },
    ],
  },
  {
    id: 'dm-utilisation',
    kind: 'multiArea',
    visualTypeId: 'area-chart',
    size: 'wide',
    category: 'Infrastructure',
    title: 'Peak sewerage use in growth areas',
    accent: '#45cdb9',
    floor: 50,
    suffix: '%',
    labels: ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032'],
    axis: ['2020', '2023', '2026', '2029', '2032'],
    series: [
      { name: 'JVC', color: '#df3f3f', points: [68, 71, 75, 80, 85, 90, 94, 97, 99, 100, 100, 100, 100] },
      { name: 'Business Bay', color: '#f38666', points: [70, 72, 75, 79, 84, 88, 92, 95, 97, 99, 100, 100, 100] },
      { name: 'Arjan', color: '#bdb6f4', points: [60, 63, 68, 74, 80, 86, 91, 94, 96, 98, 99, 100, 100] },
      { name: 'Creek Harbour', color: '#45cdb9', points: [52, 53, 54, 55, 56, 58, 61, 63, 66, 68, 70, 72, 74] },
    ],
  },
]

/** Everything the board can hold: the Assets grid's assets, plus ones its bento has no cell for. */
export const BOARD_ASSETS: BriefingAsset[] = [
  ...BRIEFING_ASSETS,
  {
    id: 'dm-h2s',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'small',
    category: 'Water quality',
    title: 'H₂S at tank T-3 outlet',
    accent: '#ffcf6b',
    value: 420,
    unit: 'µg/L',
    tipUnit: 'µg/L',
    delta: '+310 since May',
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    points: [110, 140, 180, 220, 270, 350, 420],
    axis: ['May', 'Aug', 'Nov'],
  },
]

