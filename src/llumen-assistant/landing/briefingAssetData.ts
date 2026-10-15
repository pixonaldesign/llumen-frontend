/**
 * Assets the user built in Asset builder (Create → Asset) and follows from Briefing.
 * `visualTypeId` is the Asset builder visual type each one was created with.
 */

export type BriefingAssetSize = 'small' | 'medium' | 'large' | 'wide'

export type AssetSlice = { name: string; pct: number; color: string }

export type AssetBar = { label: string; value: number }

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
    | { kind: 'hbar'; unit: string; bars: AssetBar[] }
    | { kind: 'vbar'; value: number; unit: string; tipUnit: string; delta: string; bars: AssetBar[] }
    | { kind: 'donut'; centre: string; centreLabel: string; slices: AssetSlice[] }
    | { kind: 'pie'; slices: AssetSlice[] }
    | { kind: 'kpi'; value: number; prefix?: string; suffix?: string; caption: string; spark: number[] }
    | { kind: 'kpiGrid'; metrics: AssetMetric[] }
    | { kind: 'gauge'; value: number; caption: string }
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

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
export const BRIEFING_ASSETS: BriefingAsset[] = [
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
