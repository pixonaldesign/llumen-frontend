/**
 * Assets the user built in Asset builder (Create → Asset) and follows from Briefing.
 * `visualTypeId` is the Asset builder visual type each one was created with.
 */
import { bySpace } from '../demoSpace'

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
    /** Without `spark`, the value alone, its caption at the foot of the card. */
    | { kind: 'kpi'; value: number; prefix?: string; suffix?: string; caption: string; spark?: number[] }
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

/* Llumen */

/**
 * Findings style 6's Assets grid, by asset and dashboard app id: the apps sit among the charts, and the
 * grid fills densely, so smaller cards backfill the gaps.
 */
const LLUMEN_BOARD_ORDER: readonly string[] = [
  'air-quality',
  'permit-deviation',
  'construction-surge',
  'tourism-peak',
  'water-pressure',
  'rainfall-disruption',
  'bus-delays',
  'land-use',
  'population',
  'heat-visits',
  'night-temperature',
  'station-uptime',
  'permit-concentration',
]

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
const LLUMEN_ASSETS: BriefingAsset[] = [
  {
    id: 'permit-deviation',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Compliance',
    title: 'Permit limit deviation',
    accent: '#ff8a7a',
    value: 14,
    prefix: '+',
    suffix: '%',
    caption: 'Average non-compliant facility over its legal limit',
    spark: [6, 7, 7, 9, 8, 10, 11, 10, 12, 13, 14],
  },
  {
    id: 'land-use',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Planning',
    title: 'Al Mussafah land use',
    accent: '#3fd2c7',
    centre: '31%',
    centreLabel: 'Industrial',
    slices: [
      { name: 'Residential', pct: 42, color: '#3fd2c7' },
      { name: 'Industrial', pct: 31, color: '#ffb35c' },
      { name: 'Open space', pct: 27, color: '#a6e06f' },
    ],
  },
  {
    id: 'population',
    kind: 'pie',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Demographics',
    title: 'Population composition',
    accent: '#a9b8ff',
    slices: [
      { name: 'Adults', pct: 68, color: '#8fa8ff' },
      { name: 'Youth', pct: 27, color: '#d39bff' },
      { name: 'Seniors', pct: 5, color: '#ff8fc6' },
    ],
  },
  {
    id: 'water-pressure',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'Engineering',
    title: 'Network pressure',
    accent: '#7aa8ff',
    value: 62,
    caption: 'of target across Al Ain districts',
  },
  {
    id: 'air-quality',
    kind: 'area',
    visualTypeId: 'area-chart',
    size: 'large',
    category: 'Environment',
    title: 'Coastal corridor air quality',
    accent: '#6fe3ff',
    value: 142,
    unit: 'AQI · PM2.5',
    tipUnit: 'AQI',
    delta: '+18% overnight',
    threshold: { value: 100, label: 'Sensitive groups' },
    points: [
      62, 58, 55, 54, 57, 63, 72, 84, 96, 104, 110, 112, 108, 103, 99, 101, 108, 117, 124, 131, 136, 139, 141, 140, 142,
    ],
    axis: ['00:00', '06:00', '12:00', '18:00', 'Now'],
  },
  {
    id: 'bus-delays',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Operations',
    title: 'Most delayed island bus routes',
    accent: '#ffc163',
    unit: 'min',
    bars: [
      { label: 'Route 54', value: 18 },
      { label: 'Route 65', value: 14 },
      { label: 'Route 32', value: 12 },
      { label: 'Route 9', value: 9 },
      { label: 'Route 101', value: 7 },
    ],
  },
  {
    id: 'heat-visits',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'Health',
    title: 'Heat-related clinic visits',
    accent: '#ff9a62',
    value: 1284,
    unit: 'visits this week',
    tipUnit: 'visits',
    delta: '+22%',
    bars: [
      { label: 'Mon', value: 142 },
      { label: 'Tue', value: 156 },
      { label: 'Wed', value: 171 },
      { label: 'Thu', value: 168 },
      { label: 'Fri', value: 189 },
      { label: 'Sat', value: 214 },
      { label: 'Sun', value: 244 },
    ],
  },
  {
    id: 'station-uptime',
    kind: 'multiArea',
    visualTypeId: 'area-chart',
    size: 'wide',
    category: 'Environment',
    title: 'Monitoring station availability',
    accent: '#c3a6ff',
    floor: 70,
    suffix: '%',
    labels: [
      'Oct 2',
      'Oct 3',
      'Oct 4',
      'Oct 5',
      'Oct 6',
      'Oct 7',
      'Oct 8',
      'Oct 9',
      'Oct 10',
      'Oct 11',
      'Oct 12',
      'Oct 13',
      'Today',
    ],
    axis: ['Oct 2', 'Oct 5', 'Oct 8', 'Oct 11', 'Today'],
    series: [
      { name: 'Al Ain', color: '#c3a6ff', points: [97, 97, 98, 96, 97, 98, 98, 97, 98, 99, 98, 98, 98] },
      { name: 'Abu Dhabi Island', color: '#8fa8ff', points: [94, 96, 95, 93, 94, 95, 96, 94, 93, 95, 94, 95, 94] },
      { name: 'Al Mussafah', color: '#3fd2c7', points: [91, 89, 88, 90, 89, 87, 88, 86, 88, 87, 86, 88, 87] },
      { name: 'Al Dhafra', color: '#ff9a62', points: [83, 85, 82, 80, 81, 79, 80, 78, 77, 79, 77, 76, 76] },
    ],
  },
]

/** Everything the board can hold: the Assets grid's assets, plus ones its bento has no cell for. */
const LLUMEN_BOARD: BriefingAsset[] = [
  ...LLUMEN_ASSETS,
  {
    id: 'night-temperature',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'small',
    category: 'Climate',
    title: 'Corniche night-time low',
    accent: '#ffcf6b',
    value: 34,
    unit: '°C last night',
    tipUnit: '°C',
    delta: '+3°C',
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    points: [31.4, 31.9, 32.6, 32.3, 33.1, 33.7, 34.2],
    axis: ['Mon', 'Thu', 'Sun'],
  },
]

/* Dubai Municipality */

/**
 * Findings style 6's Assets grid, by asset id; the grid fills densely, so smaller cards backfill the gaps.
 */
const DM_BOARD_ORDER: readonly string[] = [
  'dm-reports-today',
  'dm-odor-complaints',
  'dm-odor-posts',
  'dm-seat-gap',
  'dm-jvc-sewer',
  'dm-creek-sewer',
  'dm-growth-pressure',
  'dm-plan-alignment',
  'dm-complaint-types',
  'dm-odor-week',
  'dm-h2s',
  'dm-utilisation',
  'dm-quoz-changes',
]

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
const DM_ASSETS: BriefingAsset[] = [
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
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Urban planning',
    title: 'Land use vs the plan',
    accent: '#9673e8',
    value: 8,
    suffix: ' of 20',
    caption: 'areas off plan',
  },
  {
    id: 'dm-complaint-types',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Customer service',
    title: 'Municipal complaints by type',
    accent: '#a9b8ff',
    centre: '24%',
    centreLabel: 'Odor',
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
    delta: '+14% vs average',
    threshold: { value: 1126, label: '7-day average' },
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
const DM_BOARD: BriefingAsset[] = [
  ...DM_ASSETS,
  {
    id: 'dm-h2s',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'small',
    category: 'Water quality',
    title: 'H₂S at tank T-3 outlet',
    accent: '#6a9ef0',
    value: 420,
    unit: 'µg/L',
    tipUnit: 'µg/L',
    delta: '+310 since May',
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    points: [110, 140, 180, 220, 270, 350, 420],
    axis: ['May', 'Aug', 'Nov'],
  },
  {
    id: 'dm-odor-posts',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Public health',
    title: 'Negative odor posts by park, 30 days',
    accent: '#f38666',
    unit: 'posts',
    bars: [
      { label: 'Pond Park', value: 248, display: '248' },
      { label: 'Al Barsha 1', value: 101, display: '101' },
      { label: 'Al Barsha 3', value: 63, display: '63' },
    ],
  },
  {
    id: 'dm-seat-gap',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Urban planning',
    title: 'Public sports courts short',
    accent: '#9673e8',
    unit: 'courts',
    bars: [
      { label: 'JVC', value: 18, display: '18' },
      { label: 'Arjan', value: 8, display: '8' },
      { label: 'Motor City', value: 6, display: '6' },
    ],
  },
  {
    id: 'dm-creek-sewer',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'Infrastructure',
    title: 'Creek Harbour sewerage capacity used',
    accent: '#45cdb9',
    value: 61,
    caption: 'at peak, room for 15,300 pipeline residential units',
    tips: { fill: 'Used', fillSuffix: ' of capacity', gap: 'Headroom' },
  },
  {
    id: 'dm-quoz-changes',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'wide',
    category: 'Urban planning',
    title: 'Change-of-use applications, Al Quoz',
    accent: '#ffcf6b',
    value: 38,
    unit: 'in 24 months',
    tipUnit: 'applications',
    delta: '+8 last quarter',
    labels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    points: [2, 5, 9, 13, 18, 24, 30, 38],
    axis: ['Q1 2025', 'Q1 2026', 'Q4 2026'],
  },
]

export const DEFAULT_BOARD_ORDER: readonly string[] = bySpace({ llumen: LLUMEN_BOARD_ORDER, dm: DM_BOARD_ORDER })

export const BRIEFING_ASSETS: BriefingAsset[] = bySpace({ llumen: LLUMEN_ASSETS, dm: DM_ASSETS })

export const BOARD_ASSETS: BriefingAsset[] = bySpace({ llumen: LLUMEN_BOARD, dm: DM_BOARD })
