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
  're-sales-today',
  're-price-sqft',
  're-downtown-app',
  're-marina-app',
  're-construction',
  're-creek-app',
  're-top-areas',
  're-sales-mix',
  're-buyers',
  're-weekly-sales',
  're-rents',
  're-sell-through',
  're-business-bay-app',
]

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
export const BRIEFING_ASSETS: BriefingAsset[] = [
  {
    id: 're-price-sqft',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Pricing',
    title: 'Downtown price per sq ft',
    accent: '#45cdb9',
    value: 3240,
    caption: 'AED per sq ft this week, up 14% on a year ago',
    spark: [2980, 3010, 3030, 3060, 3080, 3110, 3140, 3160, 3190, 3220, 3240],
  },
  {
    id: 're-sales-mix',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Market',
    title: 'Dubai sales mix, 2025',
    accent: '#9673e8',
    centre: '61%',
    centreLabel: 'Off-plan',
    slices: [
      { name: 'Off-plan', pct: 61, color: '#9673e8' },
      { name: 'Ready', pct: 39, color: '#45cdb9' },
    ],
  },
  {
    id: 're-buyers',
    kind: 'pie',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Buyers',
    title: 'Buyers by nationality',
    accent: '#a9b8ff',
    slices: [
      { name: 'UAE', pct: 22, color: '#6a9ef0' },
      { name: 'India', pct: 18, color: '#bdb6f4' },
      { name: 'UK', pct: 15, color: '#26ada0' },
      { name: 'Russia', pct: 11, color: '#7ad488' },
      { name: 'China', pct: 9, color: '#f38666' },
      { name: 'Others', pct: 25, color: '#534d8f' },
    ],
  },
  {
    id: 're-construction',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'Construction',
    title: 'Dreamscape Tower progress',
    accent: '#45cdb9',
    value: 84,
    caption: 'built, handover in Q2 2027',
    tips: { fill: 'Built', fillSuffix: ' complete', gap: 'Left to build' },
  },
  {
    id: 're-sales-today',
    kind: 'area',
    visualTypeId: 'area-chart',
    size: 'large',
    category: 'Transactions',
    title: 'Dubai residential sales today',
    accent: '#9673e8',
    value: 612,
    unit: 'sales so far',
    tipUnit: 'sales',
    delta: '+13% vs average',
    threshold: { value: 540, label: '30-day average' },
    points: [
      0, 2, 3, 4, 4, 6, 12, 28, 58, 96, 142, 186, 228, 262, 298, 338, 382, 424, 466, 508, 546, 572, 592, 604, 612,
    ],
    axis: ['00:00', '06:00', '12:00', '18:00', 'Now'],
  },
  {
    id: 're-top-areas',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Off-plan',
    title: 'Top areas by off-plan sales, Q3',
    accent: '#9673e8',
    unit: 'AED bn',
    bars: [
      { label: 'Downtown', value: 16.0, display: 'AED 16.0bn' },
      { label: 'Business Bay', value: 12.4, display: 'AED 12.4bn' },
      { label: 'Dubai Hills', value: 9.8, display: 'AED 9.8bn' },
      { label: 'JVC', value: 7.1, display: 'AED 7.1bn' },
      { label: 'Creek Harbour', value: 6.5, display: 'AED 6.5bn' },
    ],
  },
  {
    id: 're-weekly-sales',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'Transactions',
    title: 'Residential sales this week',
    accent: '#45cdb9',
    value: 3412,
    unit: 'sales this week',
    tipUnit: 'sales',
    delta: '+9%',
    bars: [
      { label: 'Mon', value: 412 },
      { label: 'Tue', value: 455 },
      { label: 'Wed', value: 498 },
      { label: 'Thu', value: 476 },
      { label: 'Fri', value: 520 },
      { label: 'Sat', value: 541 },
      { label: 'Sun', value: 510 },
    ],
  },
  {
    id: 're-sell-through',
    kind: 'multiArea',
    visualTypeId: 'area-chart',
    size: 'wide',
    category: 'Off-plan',
    title: 'Sell-through of Downtown launches',
    accent: '#45cdb9',
    floor: 0,
    suffix: '%',
    labels: [
      'Aug 10',
      'Aug 17',
      'Aug 24',
      'Aug 31',
      'Sep 7',
      'Sep 14',
      'Sep 21',
      'Sep 28',
      'Oct 5',
      'Oct 12',
      'Oct 19',
      'Oct 26',
      'Today',
    ],
    axis: ['Aug 10', 'Aug 31', 'Sep 21', 'Oct 12', 'Today'],
    series: [
      { name: 'Dreamscape Tower', color: '#45cdb9', points: [31, 35, 38, 42, 45, 48, 51, 54, 57, 60, 62, 64, 66] },
      { name: 'Opera Crest', color: '#f38666', points: [24, 28, 31, 35, 38, 41, 44, 47, 50, 52, 54, 56, 58] },
      { name: 'Burj Crown', color: '#bdb6f4', points: [30, 32, 34, 36, 38, 39, 41, 42, 44, 45, 46, 48, 49] },
      { name: 'Grande Signature', color: '#6a9ef0', points: [22, 24, 26, 28, 29, 31, 32, 34, 35, 37, 38, 40, 41] },
    ],
  },
]

/** Everything the board can hold: the Assets grid's assets, plus ones its bento has no cell for. */
export const BOARD_ASSETS: BriefingAsset[] = [
  ...BRIEFING_ASSETS,
  {
    id: 're-rents',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'small',
    category: 'Rentals',
    title: 'Downtown 1-bedroom rent',
    accent: '#ffcf6b',
    value: 142,
    unit: 'AED k a year',
    tipUnit: 'k AED',
    delta: '+11% YoY',
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    points: [128, 130, 131, 133, 135, 138, 142],
    axis: ['May', 'Aug', 'Nov'],
  },
]
