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
  'tt-traffic-today',
  'tt-site-traffic',
  'tt-shortlist-app',
  'tt-evening-app',
  'tt-diligence',
  'tt-network-app',
  'tt-top-sites',
  'tt-fuel-mix',
  'tt-baskets',
  'tt-weekly-litres',
  'tt-corridor-evening',
  'tt-score-review',
  'tt-rivals-app',
]

/** Order matters: it fills the bento grid row by row, starting with a row of four small cards. */
export const BRIEFING_ASSETS: BriefingAsset[] = [
  {
    id: 'tt-site-traffic',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Traffic',
    title: 'Vehicles past Al Zahiyah',
    accent: '#45cdb9',
    value: 48200,
    caption: 'a day on average, last 90 days, up 6% on the spring',
    spark: [44100, 44600, 45200, 45000, 45900, 46300, 46800, 47100, 47400, 47900, 48200],
  },
  {
    id: 'tt-fuel-mix',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Network',
    title: 'Fuel sold by grade',
    accent: '#6a9ef0',
    centre: '48%',
    centreLabel: 'Special 95',
    slices: [
      { name: 'Special 95', pct: 48, color: '#6a9ef0' },
      { name: 'Super 98', pct: 22, color: '#bdb6f4' },
      { name: 'Diesel', pct: 21, color: '#26ada0' },
      { name: 'E-Plus 91', pct: 9, color: '#7ad488' },
    ],
  },
  {
    id: 'tt-baskets',
    kind: 'pie',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Customers',
    title: 'Forecourt visits by basket',
    accent: '#a9b8ff',
    slices: [
      { name: 'Fuel only', pct: 58, color: '#6a9ef0' },
      { name: 'Fuel and shop', pct: 30, color: '#26ada0' },
      { name: 'Shop only', pct: 8, color: '#bdb6f4' },
      { name: 'Car wash', pct: 4, color: '#f38666' },
    ],
  },
  {
    id: 'tt-diligence',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'Site Selection',
    title: 'Al Zahiyah due diligence',
    accent: '#45cdb9',
    value: 62,
    caption: 'checked, site visit on 18 Nov',
    tips: { fill: 'Checked', fillSuffix: ' complete', gap: 'Left to check' },
  },
  {
    id: 'tt-traffic-today',
    kind: 'area',
    visualTypeId: 'area-chart',
    size: 'large',
    category: 'Traffic',
    title: 'Vehicles past Al Zahiyah today',
    accent: '#9673e8',
    value: 31840,
    unit: 'vehicles so far',
    tipUnit: 'vehicles',
    delta: '+6% vs average',
    threshold: { value: 30000, label: '30-day average' },
    points: [
      0, 260, 420, 560, 700, 980, 1820, 3640, 6080, 8120, 9900, 11620, 13380, 15160, 16980, 18900, 20960, 23280,
      25900, 28140, 29780, 30780, 31320, 31640, 31840,
    ],
    axis: ['00:00', '06:00', '12:00', '18:00', 'Now'],
  },
  {
    id: 'tt-top-sites',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Site Selection',
    title: 'Top candidate sites by score',
    accent: '#45cdb9',
    unit: 'of 100',
    bars: [
      { label: 'Al Zahiyah', value: 87, display: '87' },
      { label: 'Al Khalidiyah', value: 81, display: '81' },
      { label: 'Al Bateen', value: 78, display: '78' },
      { label: 'Al Markaziyah', value: 74, display: '74' },
      { label: 'Al Manhal', value: 71, display: '71' },
    ],
  },
  {
    id: 'tt-weekly-litres',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'Network',
    title: 'Network fuel sold this week',
    accent: '#6a9ef0',
    value: 954,
    unit: 'k litres this week',
    tipUnit: 'k litres',
    delta: '+3%',
    bars: [
      { label: 'Mon', value: 131 },
      { label: 'Tue', value: 134 },
      { label: 'Wed', value: 136 },
      { label: 'Thu', value: 142 },
      { label: 'Fri', value: 128 },
      { label: 'Sat', value: 139 },
      { label: 'Sun', value: 144 },
    ],
  },
  {
    id: 'tt-score-review',
    kind: 'multiArea',
    visualTypeId: 'area-chart',
    size: 'wide',
    category: 'Site Selection',
    title: 'Site scores through the review',
    accent: '#45cdb9',
    floor: 50,
    suffix: '',
    labels: ['Aug 10', 'Aug 17', 'Aug 24', 'Aug 31', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Today'],
    axis: ['Aug 10', 'Aug 31', 'Sep 21', 'Oct 12', 'Today'],
    series: [
      { name: 'Al Zahiyah', color: '#45cdb9', points: [79, 80, 81, 82, 82, 83, 84, 84, 85, 86, 86, 87, 87] },
      { name: 'Al Khalidiyah', color: '#f38666', points: [83, 83, 84, 83, 83, 82, 82, 82, 81, 81, 81, 81, 81] },
      { name: 'Al Bateen', color: '#bdb6f4', points: [70, 71, 72, 73, 74, 74, 75, 76, 76, 77, 77, 78, 78] },
      { name: 'Al Markaziyah', color: '#6a9ef0', points: [68, 68, 69, 70, 70, 71, 71, 72, 72, 73, 73, 74, 74] },
    ],
  },
]

/** Everything the board can hold: the Assets grid's assets, plus ones its bento has no cell for. */
export const BOARD_ASSETS: BriefingAsset[] = [
  ...BRIEFING_ASSETS,
  {
    id: 'tt-corridor-evening',
    kind: 'line',
    visualTypeId: 'line-chart',
    size: 'small',
    category: 'Traffic',
    title: 'Evening traffic, Sheikh Rashid Bin Saeed St',
    accent: '#ffcf6b',
    value: 15,
    unit: 'k vehicles, 5–9pm',
    tipUnit: 'k vehicles',
    delta: '+8% on May',
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    points: [13.9, 13.6, 13.2, 13.8, 14.2, 14.6, 15],
    axis: ['May', 'Aug', 'Nov'],
  },
]
