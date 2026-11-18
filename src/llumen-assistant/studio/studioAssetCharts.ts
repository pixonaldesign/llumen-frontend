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

/** `[x, y, size]`; size is drawn as the dot's radius. */
export type ScatterPoint = [number, number, number]

export type ScatterSeries = { name: string; color: string; points: ScatterPoint[] }

export type RangeBar = { min: number; mean: number; max: number }

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
  | {
      kind: 'scatter'
      xTicks: ChartTick[]
      yTicks: ChartTick[]
      /** Names for the x, y and size figures in the tooltip. */
      axes: [string, string, string]
      series: ScatterSeries[]
      format: (value: number, axis: 0 | 1 | 2) => string
    }
  | {
      kind: 'rose'
      /** Clockwise from north. */
      directions: string[]
      bands: { name: string; color: string }[]
      /** One row per direction, one value per band. */
      values: number[][]
      format: (value: number) => string
    }
  | {
      kind: 'range'
      ticks: ChartTick[]
      labels: string[]
      axisEvery: number
      bars: RangeBar[]
      /** Low to high, painted up the plot. */
      stops: string[]
      format: (value: number) => string
    }
  | {
      kind: 'score'
      headline: ChartHeadline
      /** 0–100. */
      value: number
      target: number
      pill: ChartPill
      caption: string
      stops: string[]
    }
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

/** A repeatable sequence in [0, 1), so the generated series look the same on every load. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const ROAD_CLASSES = [
  { name: 'Tertiary', color: '#7d8597', capacity: 900, jam: 140, count: 26 },
  { name: 'Secondary', color: '#5fb3a5', capacity: 1500, jam: 200, count: 34 },
  { name: 'Primary', color: '#e39b4c', capacity: 2600, jam: 150, count: 28 },
  { name: 'Motorway', color: '#e2556f', capacity: 9500, jam: 110, count: 46 },
]

/** Flow rises with density up to capacity, then collapses towards the jam density. */
const FUNDAMENTAL: ScatterSeries[] = (() => {
  const random = seeded(7)
  return ROAD_CLASSES.map((road) => ({
    name: road.name,
    color: road.color,
    points: Array.from({ length: road.count }, (): ScatterPoint => {
      const density = random() ** 1.6 * road.jam * 1.4
      const peak = road.jam * 0.28
      const shape = density < peak ? density / peak : Math.max(0, 1 - (density - peak) / (road.jam * 1.2))
      const flow = road.capacity * shape * (0.55 + random() * 0.5)
      const speed = Math.max(4, 120 * (1 - density / (road.jam * 1.5)) * (0.7 + random() * 0.3))
      return [Math.round(density), Math.round(flow), Math.round(speed)]
    }),
  }))
})()

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

/** Traffic heading shares (%) per speed band, weighted to the corridor's NE–SW and S axes. */
const ROSE_VALUES = COMPASS.map((_, i) => {
  const axis = [0.6, 1.1, 3.4, 1.4, 1.2, 0.8, 1.4, 2.4, 2.1, 0.9, 2.6, 1.1, 0.7, 0.5, 1.3, 0.8][i]
  return [0.35, 0.3, 0.2, 0.45].map((band) => Math.round(axis * band * 10) / 10)
})

const INTERVALS = Array.from({ length: 72 }, (_, i) => {
  const minutes = i * 20
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

const SECTION_SPEEDS: RangeBar[] = (() => {
  const random = seeded(19)
  return INTERVALS.map((_, i) => {
    const hour = i / 3
    const rush = Math.exp(-((hour - 8) ** 2) / 3) + Math.exp(-((hour - 17.5) ** 2) / 4)
    const max = 104 + random() * 12 - rush * 6
    const min = Math.max(3, 34 - rush * 26 + (random() - 0.6) * 26)
    const mean = min + (max - min) * (0.62 - rush * 0.12 + random() * 0.06)
    return { min: Math.round(min), mean: Math.round(mean), max: Math.round(max) }
  })
})()

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
  'fundamental-diagram': {
    kind: 'scatter',
    title: 'Fundamental diagram · flow vs density, size = speed',
    xTicks: [
      { value: 0, label: '0' },
      { value: 100, label: '100' },
      { value: 200, label: '200' },
      { value: 300, label: '300' },
    ],
    yTicks: [
      { value: 0, label: '0' },
      { value: 5000, label: '5K' },
      { value: 10000, label: '10K' },
    ],
    axes: ['Density', 'Exit flow', 'Speed'],
    series: FUNDAMENTAL,
    format: (value, axis) =>
      axis === 0 ? `${value} veh/km/lane` : axis === 1 ? `${value.toLocaleString('en-US')} veh/h` : `${value} km/h`,
  },
  'traffic-rose': {
    kind: 'rose',
    title: 'Traffic rose · heading and speed band',
    directions: COMPASS,
    bands: [
      { name: '< 20 km/h', color: '#4a8fd8' },
      { name: '20–40', color: '#7fbf8a' },
      { name: '40–60', color: '#e6cf7a' },
      { name: '60+', color: '#b9566f' },
    ],
    values: ROSE_VALUES,
    format: (value) => `${value.toFixed(1)}%`,
  },
  'section-speed-range': {
    kind: 'range',
    title: 'Slowest to fastest section per interval, mean as reference',
    ticks: [
      { value: 0, label: '0' },
      { value: 40, label: '40' },
      { value: 80, label: '80' },
      { value: 120, label: '120' },
    ],
    labels: INTERVALS,
    axisEvery: 18,
    bars: SECTION_SPEEDS,
    stops: ['#3d6fe0', '#5cc0b4', '#e8d277', '#e3683f'],
    format: (value) => `${value} km/h`,
  },
  'sla-compliance': {
    kind: 'score',
    title: 'SLA Compliance Score',
    headline: { value: 87, unit: '/100', sans: true, tight: true },
    value: 87,
    target: 95,
    pill: { label: 'Below target', color: '#e39b4c' },
    caption: '8 points short of the 95 target',
    stops: ['#e43a63', '#e39b4c', '#e0c27a', '#50af8b'],
  },
}
