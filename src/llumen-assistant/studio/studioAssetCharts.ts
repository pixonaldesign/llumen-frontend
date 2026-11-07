import { PALETTE, STATUS } from '../gami/gamiTypes'

export type ChartHeadline = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  unit?: string
  /** Set in the UI face rather than mono, for percentages and counts out of a total. */
  sans?: boolean
  /** Unit sits flush against the value, as in `425/450 Online`. */
  tight?: boolean
}

export type ChartTick = { value: number; label: string }

export type ChartPill = { label: string; color: string }

export type ChartSeries = {
  name: string
  color: string
  points: number[]
  dashed?: boolean
  fill?: 'accent' | 'muted'
}

/** `share` is the percentage of the whole it is drawn as; `display` is its legend figure. */
export type ChartPart = { name: string; value: number; share: number; color: string; display: string }

export type UptimeDay = { label: string; uptime: number }

export type StudioChart = { title: string } & (
  | {
      kind: 'trend'
      headline?: ChartHeadline
      legend?: boolean
      /** Bottom to top; the first and last set the value range. */
      ticks: ChartTick[]
      /** One per point. */
      labels: string[]
      /** Label every nth point on the axis; every point when unset. */
      axisEvery?: number
      series: ChartSeries[]
      format: (value: number) => string
    }
  | {
      kind: 'columns'
      headline: ChartHeadline
      ticks: ChartTick[]
      color: string
      bars: { label: string; value: number }[]
      format: (value: number) => string
    }
  | { kind: 'donut'; parts: ChartPart[] }
  | { kind: 'split'; headline: ChartHeadline; pill?: ChartPill; parts: ChartPart[] }
  | {
      kind: 'meter'
      headline: ChartHeadline
      /** 0–100. */
      value: number
      /** `progress` fills the track up to the value; `scale` colours the whole track and marks the value on it. */
      mode: 'progress' | 'scale'
      stops: string[]
      handle: string
      caption?: string
      pill?: ChartPill
      rows: { name: string; value: string }[]
    }
  | { kind: 'uptime'; headline: ChartHeadline; pill: ChartPill; days: UptimeDay[]; alertBelow: number }
  | { kind: 'rows'; parts: ChartPart[] }
)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

const TEAL = PALETTE.teal[2]
const BLUE = PALETTE.blue[3]
const PURPLE = PALETTE.purple[3]
const PLAN = '#c9d6cf'

const percent = (value: number) => `${value.toFixed(1)}%`
const sarBn = (value: number) => `SAR ${value.toFixed(1)}bn`

/** The Kingdom's 15 defence industrial sites on plan, day by day; the dip is the day Poland froze exports. */
const SITE_DAYS: UptimeDay[] = Array.from({ length: 47 }, (_, i) => {
  const day = new Date(2026, 10, 5 - (46 - i))
  return {
    label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    uptime: i === 35 ? 73.3 : 93.3 + ((i * 37) % 4) * 1.7,
  }
})

/** The Assets page's visuals, drawn live; keyed by `StudioAsset` id. */
export const STUDIO_ASSET_CHARTS: Record<string, StudioChart> = {
  'saudi-made-trajectory': {
    kind: 'trend',
    title: 'Saudi Made trajectory vs 2030 goal',
    legend: true,
    ticks: [
      { value: 0, label: '0%' },
      { value: 20, label: '20%' },
      { value: 40, label: '40%' },
      { value: 60, label: '60%' },
    ],
    labels: YEARS(2020, 2030),
    axisEvery: 2,
    series: [
      {
        name: 'Projected',
        color: TEAL,
        fill: 'accent',
        points: [8, 11.5, 15.2, 19.4, 22.8, 26.1, 29.4, 33.2, 37.6, 42.1, 46.5],
      },
      { name: 'Planned', color: PLAN, dashed: true, points: [8, 12, 16, 20, 24, 27.5, 31, 35.5, 40, 45, 50] },
    ],
    format: percent,
  },
  'plan-progress': {
    kind: 'rows',
    title: '2026 Plan Progress',
    parts: [
      { name: 'Saudi Made', value: 94.8, share: 94.8, color: TEAL, display: '94.8%' },
      { name: 'Military market', value: 93, share: 93, color: PALETTE.categorical[0], display: '93.0%' },
      { name: 'Jobs', value: 90.3, share: 90.3, color: PURPLE, display: '90.3%' },
    ],
  },
  'saudi-made-goal': {
    kind: 'meter',
    title: 'Saudi Made vs 2030 Goal',
    headline: { value: 29.4, decimals: 1, suffix: '%', sans: true },
    value: 59,
    mode: 'progress',
    stops: [PALETTE.teal[0], PALETTE.teal[3]],
    handle: PALETTE.teal[4],
    caption: '59% of the way to the 50% goal.',
    rows: [
      { name: 'Saudi Made', value: '29.4%' },
      { name: '2030 goal', value: '50%' },
    ],
  },
  'licensed-domains': {
    kind: 'donut',
    title: 'Licensed Companies by Domain',
    parts: [
      { name: 'Electronics', value: 173, share: 29, color: PALETTE.categorical[0], display: '173 (29%)' },
      { name: 'Land', value: 151, share: 25, color: PALETTE.categorical[2], display: '151 (25%)' },
      { name: 'Air', value: 128, share: 21, color: PALETTE.categorical[1], display: '128 (21%)' },
      { name: 'Armament', value: 104, share: 17, color: PALETTE.categorical[5], display: '104 (17%)' },
      { name: 'Naval', value: 46, share: 8, color: PALETTE.categorical[9], display: '46 (8%)' },
    ],
  },
  'license-status': {
    kind: 'donut',
    title: '2026 License Status',
    parts: [
      { name: 'Granted', value: 514, share: 51, color: STATUS.good, display: '514 (51%)' },
      { name: 'Under review', value: 242, share: 24, color: PALETTE.diverging[4], display: '242 (24%)' },
      { name: 'Applied', value: 191, share: 19, color: PALETTE.categorical[4], display: '191 (19%)' },
      { name: 'Failed', value: 60, share: 6, color: STATUS.critical, display: '60 (6%)' },
    ],
  },
  'investment-pipeline': {
    kind: 'columns',
    title: '2026 Investment Pipeline',
    headline: { value: 18.6, decimals: 1, unit: 'SAR bn' },
    ticks: [
      { value: 0, label: '0' },
      { value: 1, label: '1bn' },
      { value: 2, label: '2bn' },
      { value: 3, label: '3bn' },
    ],
    color: PALETTE.categorical[1],
    bars: MONTHS.slice(0, 11).map((label, i) => ({
      label,
      value: [1.1, 1.4, 1.8, 1.5, 1.9, 1.7, 1.6, 2.0, 1.8, 2.1, 1.7][i],
    })),
    format: sarBn,
  },
  'localization-opportunities': {
    kind: 'columns',
    title: 'Localization Opportunities',
    headline: { value: 32, decimals: 1, unit: 'SAR bn a year' },
    ticks: [
      { value: 0, label: '0' },
      { value: 4, label: '4bn' },
      { value: 8, label: '8bn' },
    ],
    color: PURPLE,
    bars: [
      { label: 'UAV', value: 6.8 },
      { label: 'Ammo', value: 5.9 },
      { label: 'Armor', value: 4.7 },
      { label: 'Radar', value: 4.2 },
      { label: 'MRO', value: 3.9 },
      { label: 'Other', value: 3.9 },
      { label: 'Naval', value: 2.6 },
    ],
    format: sarBn,
  },
  'uav-motor-stock': {
    kind: 'trend',
    title: 'UAV Propulsion Motor Stock',
    headline: { value: 41, unit: 'days left' },
    ticks: [
      { value: 0, label: '0' },
      { value: 50, label: '50' },
      { value: 100, label: '100' },
    ],
    labels: ['-8w', '-7w', '-6w', '-5w', '-4w', '-3w', '-2w', '-1w', 'Now'],
    series: [{ name: 'Days of stock', color: STATUS.critical, fill: 'accent', points: [96, 90, 84, 77, 70, 63, 56, 49, 41] }],
    format: (value) => `${value} days`,
  },
  'industrial-sites': {
    kind: 'uptime',
    title: 'Defence Industrial Sites on Plan',
    headline: { value: 13, unit: '/15 On plan', sans: true, tight: true },
    pill: { label: '2 at risk', color: TEAL },
    days: SITE_DAYS,
    alertBelow: 90,
  },
  'plant-capacity': {
    kind: 'meter',
    title: 'Al-Yamamah Plant Utilisation',
    headline: { value: 94, suffix: '%', sans: true },
    value: 94,
    mode: 'scale',
    stops: [PALETTE.teal[1], PALETTE.categorical[4], STATUS.moderate, STATUS.critical],
    handle: '#f3e6cf',
    pill: { label: 'Busiest in the Kingdom', color: STATUS.moderate },
    rows: [
      { name: 'Utilisation', value: '94%' },
      { name: 'Hall B from Q2 2027', value: '+120 vehicles a year' },
    ],
  },
  'inventory-source': {
    kind: 'split',
    title: 'Inventory Value by Source',
    headline: { value: 106.8, decimals: 1, prefix: 'SAR ', unit: 'bn held' },
    pill: { label: '11 cut off', color: STATUS.critical },
    parts: [
      { name: 'Imported · 66 products', value: 82.2, share: 77, color: BLUE, display: 'SAR 82.2bn (77%)' },
      { name: 'Local · 34 products', value: 24.6, share: 23, color: TEAL, display: 'SAR 24.6bn (23%)' },
    ],
  },
  'inventory-readiness': {
    kind: 'meter',
    title: 'Inventory Readiness (%)',
    headline: { value: 86, suffix: '%', sans: true },
    value: 86,
    mode: 'scale',
    stops: [STATUS.critical, STATUS.moderate, PALETTE.categorical[4], PALETTE.teal[2]],
    handle: '#e9f4f1',
    pill: { label: 'Target: >90%', color: PALETTE.categorical[4] },
    rows: [
      { name: 'Weighted by value', value: '86%' },
      { name: 'Target', value: '>90%' },
    ],
  },
  'wds-exhibitors': {
    kind: 'split',
    title: 'WDS 2028 Exhibitor Applications',
    headline: { value: 1940, unit: 'Applications' },
    parts: [
      { name: 'Confirmed', value: 1085, share: 56, color: TEAL, display: '1,085 (56%)' },
      { name: 'Under review', value: 435, share: 22, color: PALETTE.categorical[0], display: '435 (22%)' },
      { name: 'Applied', value: 420, share: 22, color: PALETTE.categorical[4], display: '420 (22%)' },
    ],
  },
  'wds-pace': {
    kind: 'trend',
    title: 'WDS Applications vs 2026 Pace',
    legend: true,
    ticks: [
      { value: 0, label: '0' },
      { value: 1000, label: '1K' },
      { value: 2000, label: '2K' },
    ],
    labels: MONTHS,
    series: [
      {
        name: 'WDS 2028',
        color: PALETTE.categorical[0],
        fill: 'accent',
        points: [210, 380, 560, 720, 880, 1030, 1180, 1330, 1480, 1640, 1800, 1940],
      },
      {
        name: 'WDS 2026',
        color: PLAN,
        dashed: true,
        fill: 'muted',
        points: [160, 290, 420, 550, 670, 780, 900, 1010, 1120, 1240, 1360, 1470],
      },
    ],
    format: (value) => `${value.toLocaleString('en-US')} applications`,
  },
  'skills-gap': {
    kind: 'trend',
    title: 'Defence Skills Gap to 2030',
    headline: { value: 6350, unit: 'people short' },
    ticks: [
      { value: 0, label: '0' },
      { value: 6000, label: '6K' },
      { value: 12000, label: '12K' },
    ],
    labels: YEARS(2023, 2030),
    series: [{ name: 'Skills gap', color: PURPLE, fill: 'accent', points: [3900, 4800, 5600, 6350, 7500, 8600, 9600, 10600] }],
    format: (value) => `${value.toLocaleString('en-US')} people`,
  },
  'unfilled-roles': {
    kind: 'rows',
    title: 'Unfilled Roles by Region',
    parts: [
      { name: 'Western Region', value: 2140, share: 37, color: PURPLE, display: '2,140' },
      { name: 'Riyadh', value: 1980, share: 34, color: PALETTE.purple[4], display: '1,980' },
      { name: 'Eastern Region', value: 1610, share: 29, color: PALETTE.categorical[1], display: '1,610' },
    ],
  },
}
