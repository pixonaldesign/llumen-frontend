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
const YEARS = Array.from({ length: 21 }, (_, i) => String(2030 + i))

const GREEN = '#5aae87'
const TEAL = '#3fa7a0'
const ROSE = '#e43963'
const ORANGE = '#e39b4c'
const OCEAN = '#1f8aa8'

const thousands = (unit: string) => (value: number) => `${value.toLocaleString('en-US')}K ${unit}`

const UPTIME_DAYS: UptimeDay[] = Array.from({ length: 47 }, (_, i) => {
  const day = new Date(2026, 9, 28 - (46 - i))
  return {
    label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    uptime: i === 35 ? 71.4 : 93 + ((i * 37) % 9) * 0.45,
  }
})

/** The Assets page's visuals, drawn live; keyed by `StudioAsset` id. */
export const STUDIO_ASSET_CHARTS: Record<string, StudioChart> = {
  'emissions-trajectory': {
    kind: 'trend',
    title: 'Emissions trajectory vs Net-Zero pathway',
    legend: true,
    ticks: [
      { value: 0, label: '0' },
      { value: 250, label: '250K' },
      { value: 500, label: '500K' },
      { value: 750, label: '750K' },
    ],
    labels: YEARS,
    axisEvery: 5,
    series: [
      {
        name: 'Projected',
        color: GREEN,
        fill: 'accent',
        points: [680, 735, 660, 610, 575, 548, 538, 534, 515, 470, 390, 290, 268, 262, 240, 215, 195, 172, 162, 168, 121],
      },
      {
        name: 'Planned',
        color: '#c9d6cf',
        dashed: true,
        points: YEARS.map((_, i) => Math.round(715 - i * 35.75)),
      },
    ],
    format: thousands('tCO₂e'),
  },
  'incidents-by-sector': {
    kind: 'donut',
    title: 'Incidents classification by sector',
    parts: [
      { name: 'Air', value: 14, share: 41, color: ROSE, display: '14 (41%)' },
      { name: 'Biodiversity', value: 9, share: 25, color: ORANGE, display: '9 (25%)' },
      { name: 'Marine', value: 5, share: 14, color: '#e0c27a', display: '5 (14%)' },
      { name: 'Water', value: 3, share: 10, color: '#4aae8c', display: '3 (10%)' },
      { name: 'Soil', value: 3, share: 10, color: '#8c4a2f', display: '3 (10%)' },
    ],
  },
  'groundwater-change': {
    kind: 'trend',
    title: 'Average Groundwater Level Change (m/year)',
    headline: { value: 0.45, decimals: 2, prefix: '-', unit: 'm/year' },
    ticks: [
      { value: -0.5, label: '-0.50' },
      { value: 0, label: '0' },
      { value: 0.5, label: '+0.5' },
    ],
    labels: MONTHS,
    series: [
      {
        name: 'Level change',
        color: '#d6305a',
        fill: 'accent',
        points: [0.26, 0.02, -0.16, -0.19, -0.02, -0.08, -0.03, 0.02, -0.03, -0.12, -0.3, -0.34],
      },
    ],
    format: (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)} m`,
  },
  'emissions-reduction': {
    kind: 'columns',
    title: 'Total Emissions Reduction Achieved (tCO₂e)',
    headline: { value: 1.2, decimals: 1, suffix: 'M', unit: 'Tons' },
    ticks: [
      { value: 0, label: '0' },
      { value: 200, label: '200K' },
      { value: 400, label: '400K' },
      { value: 600, label: '600K' },
    ],
    color: TEAL,
    bars: MONTHS.map((label, i) => ({ label, value: [160, 190, 290, 420, 380, 310, 250, 300, 275, 320, 370, 340][i] })),
    format: thousands('tCO₂e'),
  },
  'biodiversity-events': {
    kind: 'split',
    title: 'Biodiversity Activity Events',
    headline: { value: 14_200, unit: 'Triggers' },
    parts: [
      { name: 'Terrestrial Cameras', value: 8500, share: 60, color: ORANGE, display: '8,500 (60%)' },
      { name: 'Marine Sensors', value: 5700, share: 40, color: OCEAN, display: '5,700 (40%)' },
    ],
  },
  'net-zero-initiatives': {
    kind: 'trend',
    title: 'Total Active Net-Zero Initiatives',
    headline: { value: 84 },
    ticks: [
      { value: 0, label: '0' },
      { value: 30, label: '30' },
      { value: 60, label: '60' },
      { value: 90, label: '90' },
    ],
    labels: MONTHS,
    series: [
      {
        name: 'Active initiatives',
        color: GREEN,
        fill: 'accent',
        points: [31, 38, 44, 54, 57, 55, 53, 58, 52, 47, 55, 70],
      },
    ],
    format: (value) => `${value} active`,
  },
  'net-zero-contribution': {
    kind: 'meter',
    title: 'Contribution of Initiatives to Net-Zero Target (%)',
    headline: { value: 18, suffix: '%', sans: true },
    value: 18,
    mode: 'progress',
    stops: ['#d3c07b', '#6eb388'],
    handle: '#86c7ae',
    caption: 'Current trajectory vs. 2030 milestone.',
    rows: [
      { name: 'Contributed', value: '18%' },
      { name: 'Remaining to 2030', value: '82%' },
    ],
  },
  'monitoring-sites': {
    kind: 'uptime',
    title: 'Active Monitoring Sites',
    headline: { value: 425, unit: '/450 Online', sans: true, tight: true },
    pill: { label: '94% Uptime', color: '#4aae8c' },
    days: UPTIME_DAYS,
    alertBelow: 90,
  },
  'groundwater-abstraction': {
    kind: 'columns',
    title: 'Total Groundwater Abstraction',
    headline: { value: 120, suffix: 'K', unit: 'm³' },
    ticks: [
      { value: 0, label: '0' },
      { value: 50, label: '50K' },
      { value: 100, label: '100K' },
      { value: 150, label: '150K' },
    ],
    color: TEAL,
    bars: MONTHS.map((label, i) => ({ label, value: [40, 47, 74, 106, 96, 79, 63, 77, 70, 81, 94, 117][i] })),
    format: thousands('m³'),
  },
  'water-quality': {
    kind: 'meter',
    title: '% Wells Within Acceptable Water Quality Standards',
    headline: { value: 82, suffix: '%', sans: true },
    value: 82,
    mode: 'scale',
    stops: ['#e43a63', '#e38f4f', '#e1b267', '#e0c27a', '#50af8b'],
    handle: '#e9d4a1',
    pill: { label: 'Target: >90%', color: '#d8ba76' },
    rows: [
      { name: 'Within standards', value: '82%' },
      { name: 'Target', value: '>90%' },
    ],
  },
  'species-by-habitat': {
    kind: 'rows',
    title: 'Species Population by Habitat',
    parts: [
      { name: 'Desert Dunes', value: 1250, share: 65, color: '#e3c16f', display: '1,250' },
      { name: 'Coastal Mangroves', value: 480, share: 25, color: '#9bbf6a', display: '480' },
      { name: 'Urban Periphery', value: 190, share: 10, color: '#5e6f85', display: '190' },
    ],
  },
  'species-detection': {
    kind: 'split',
    title: 'Species detection frequency',
    headline: { value: 1240, unit: 'Detections/Week' },
    parts: [
      { name: 'Arabian Oryx', value: 744, share: 60, color: OCEAN, display: '744 (60%)' },
      { name: 'Sand Gazelle', value: 320, share: 26, color: '#8bc17c', display: '320 (26%)' },
      { name: 'Hawksbill Turtle', value: 176, share: 14, color: ORANGE, display: '176 (14%)' },
    ],
  },
  'abstraction-recharge': {
    kind: 'split',
    title: 'Abstraction vs Recharge Ratio',
    headline: { value: 24, suffix: ':1' },
    pill: { label: 'Severe Deficit', color: '#db4064' },
    parts: [
      { name: 'Abstraction', value: 120, share: 96, color: '#e0744c', display: '120K m³' },
      { name: 'Recharge', value: 5, share: 4, color: TEAL, display: '5k m³' },
    ],
  },
  'fuel-consumption': {
    kind: 'trend',
    title: 'Fuel Consumption Trends',
    legend: true,
    ticks: [
      { value: 0, label: '0' },
      { value: 10, label: '10K' },
      { value: 20, label: '20K' },
      { value: 30, label: '30K' },
    ],
    labels: MONTHS,
    series: [
      {
        name: 'Actual',
        color: ROSE,
        fill: 'accent',
        points: [9, 9.6, 14.5, 16.2, 16.6, 15.6, 16.4, 17.6, 23.4, 21.5, 17, 22.6],
      },
      {
        name: 'Planned',
        color: '#d4d8dc',
        dashed: true,
        fill: 'muted',
        points: [6.8, 7.2, 9.6, 12, 13.2, 13.6, 12.2, 13.6, 11.4, 9.8, 12.2, 17.8],
      },
    ],
    format: (value) => `${value.toLocaleString('en-US')}K L`,
  },
}
