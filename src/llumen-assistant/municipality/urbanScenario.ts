/**
 * The Urban Planning story: where Dubai is growing, whether that growth fits the plan, whether
 * infrastructure, housing and services can absorb it, where planning pressure converges, and whether
 * Dubai Municipality should direct, phase or replan. Each community is a hexagonal column whose height
 * and colour read the page's measure. Every value is an illustrative example.
 */
import { hash, scatter, type LngLat } from '../realEstate/estateGeo'
import type { EstateHeatPoint, EstateLine, EstateMapScene, EstateTower } from '../realEstate/estateMapLayers'
import {
  PALETTE,
  STATUS,
  type EstateAskView,
  type EstateCamera,
  type EstateCard,
  type EstatePlace,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
import { hexagon } from './dmGeo'
import { HORIZON_COLOR, LEVEL, toned } from './dmShared'

type Alignment = 'aligned' | 'diverging' | 'misaligned'
type Priority = 'monitor' | 'manage' | 'priority'
type Action = 'direct' | 'phase' | 'replan'

type Community = {
  id: string
  name: string
  at: LngLat
  /** Population growth, % a year; density, thousand residents per km²; built-up growth over five years, %. */
  growth: number
  density: number
  builtUp: number
  /** Committed pipeline, residential units. */
  pipeline: number
  /** Growth pressure, 0–100: growth, density, built-up expansion and pipeline together. */
  pressure: number
  alignment: Alignment
  /** Land-use change applications in 24 months, and vacant or developable land in hectares. */
  changes: number
  vacant: number
  /** Peak utilisation, %: sewerage, drainage, utilities; and transport accessibility, 0–100. */
  sewer: number
  drainage: number
  utilities: number
  transport: number
  /** Residential occupancy, %; school seats per 1,000 residents; homes within 400 m of green space, %. */
  occupancy: number
  schools: number
  green: number
  /** Worker accommodation used, %, where the community has it. */
  workers?: number
  priority: Priority
  action?: Action
}

const C = (
  id: string,
  name: string,
  at: LngLat,
  [growth, density, builtUp, pipeline, pressure]: number[],
  [alignment, changes, vacant]: [Alignment, number, number],
  [sewer, drainage, utilities, transport]: number[],
  [occupancy, schools, green, workers]: (number | undefined)[],
  priority: Priority,
  action?: Action,
): Community => ({
  id,
  name,
  at,
  growth,
  density,
  builtUp,
  pipeline,
  pressure,
  alignment,
  changes,
  vacant,
  sewer,
  drainage,
  utilities,
  transport,
  occupancy: occupancy!,
  schools: schools!,
  green: green!,
  workers,
  priority,
  action,
})

const COMMUNITIES: Community[] = [
  C('jvc', 'Jumeirah Village Circle', [55.209, 25.06], [9.8, 21, 14, 18400, 92], ['misaligned', 46, 38], [94, 88, 81, 42], [96, 0.6, 48], 'priority', 'replan'),
  C('business-bay', 'Business Bay', [55.265, 25.1855], [7.4, 28, 8, 14900, 88], ['diverging', 22, 9], [92, 86, 84, 71], [95, 0.4, 31], 'priority', 'phase'),
  C('arjan', 'Arjan', [55.242, 25.068], [8.9, 17, 12, 11200, 84], ['misaligned', 31, 22], [91, 84, 78, 38], [94, 0.7, 41], 'priority', 'replan'),
  C('dubai-south', 'Dubai South', [55.162, 24.89], [11.6, 3, 19, 26000, 79], ['aligned', 6, 410], [74, 69, 66, 29], [78, 0.8, 62, 97], 'manage', 'phase'),
  C('creek-harbour', 'Dubai Creek Harbour', [55.345, 25.2], [7.9, 11, 16, 15300, 74], ['aligned', 5, 58], [61, 58, 63, 64], [82, 1.3, 71], 'manage', 'direct'),
  C('motor-city', 'Motor City', [55.235, 25.045], [6.1, 12, 9, 7800, 71], ['diverging', 19, 30], [86, 90, 72, 35], [92, 0.9, 55], 'priority', 'replan'),
  C('al-furjan', 'Al Furjan', [55.145, 25.03], [6.8, 14, 11, 8900, 68], ['diverging', 14, 41], [83, 79, 70, 52], [90, 1.0, 58], 'manage', 'phase'),
  C('town-square', 'Town Square', [55.295, 25.003], [8.2, 9, 15, 9600, 66], ['aligned', 7, 64], [81, 76, 72, 31], [89, 0.9, 66], 'manage', 'phase'),
  C('al-quoz', 'Al Quoz', [55.23, 25.14], [4.2, 8, 7, 5600, 64], ['misaligned', 38, 12], [88, 93, 75, 58], [91, 0.5, 22, 108], 'priority', 'replan'),
  C('mbr-city', 'MBR City', [55.3, 25.16], [6.4, 10, 12, 12100, 62], ['aligned', 4, 92], [58, 55, 60, 61], [84, 1.4, 74], 'monitor', 'direct'),
  C('expo-city', 'Expo City', [55.15, 24.965], [9.2, 2, 21, 13800, 60], ['aligned', 2, 280], [42, 40, 48, 46], [70, 1.1, 70], 'monitor', 'direct'),
  C('jlt-marina', 'JLT and Dubai Marina', [55.142, 25.075], [3.5, 34, 4, 4200, 58], ['diverging', 12, 6], [90, 85, 80, 76], [95, 0.7, 34], 'manage', 'phase'),
  C('dubai-hills', 'Dubai Hills', [55.25, 25.105], [5.6, 13, 9, 6700, 55], ['aligned', 3, 48], [55, 52, 58, 68], [88, 1.8, 86], 'monitor', 'direct'),
  C('damac-hills', 'DAMAC Hills', [55.25, 25.025], [5.1, 7, 10, 5900, 52], ['aligned', 5, 76], [63, 60, 62, 40], [85, 1.2, 79], 'monitor', 'direct'),
  C('intl-city', 'International City', [55.41, 25.165], [1.9, 24, 2, 1800, 41], ['diverging', 9, 18], [89, 91, 77, 44], [97, 0.5, 28, 103], 'manage', 'phase'),
  C('al-barsha', 'Al Barsha', [55.2, 25.105], [2.1, 15, 3, 1400, 38], ['aligned', 6, 7], [84, 80, 74, 72], [93, 1.5, 57], 'monitor'),
  C('deira', 'Deira', [55.32, 25.265], [0.8, 32, 1, 900, 36], ['aligned', 8, 4], [93, 95, 82, 78], [96, 0.9, 19, 101], 'monitor'),
  C('dso', 'Dubai Silicon Oasis', [55.38, 25.12], [2.8, 9, 4, 3100, 34], ['aligned', 4, 55], [49, 46, 52, 57], [80, 1.6, 68], 'monitor', 'direct'),
  C('al-qusais', 'Al Qusais', [55.38, 25.28], [1.5, 18, 2, 1100, 33], ['aligned', 5, 11], [87, 83, 76, 69], [94, 0.8, 26, 106], 'monitor'),
  C('mirdif', 'Mirdif', [55.42, 25.22], [1.2, 6, 2, 700, 24], ['aligned', 2, 15], [52, 49, 55, 48], [86, 1.7, 72], 'monitor'),
]

const BY_ID = Object.fromEntries(COMMUNITIES.map((community) => [community.id, community])) as Record<string, Community>

/* —— How each page classes a community —— */

const highGrowth = (c: Community) => c.pressure >= 60
const constrained = (c: Community) => Math.max(c.sewer, c.drainage, c.utilities) >= 80

type Capacity = 'support' | 'intervene' | 'existing' | 'spare'
const capacityOf = (c: Community): Capacity =>
  highGrowth(c) ? (constrained(c) ? 'intervene' : 'support') : constrained(c) ? 'existing' : 'spare'

type Liveability = 'gap' | 'strained' | 'pace'
const liveabilityOf = (c: Community): Liveability =>
  c.occupancy >= 93 || c.schools < 0.8 || c.green < 35 || (c.workers ?? 0) > 100
    ? 'gap'
    : c.occupancy >= 88 || c.schools < 1.1
      ? 'strained'
      : 'pace'

const PRESSURE_RAMP = [PALETTE.diverging[5], PALETTE.diverging[4], PALETTE.diverging[3], PALETTE.diverging[2], PALETTE.diverging[1]]
const pressureColor = (score: number) => PRESSURE_RAMP[Math.min(4, Math.max(0, Math.floor((score - 20) / 15)))]

const ALIGNMENT = {
  aligned: { label: 'Aligned with the plan', color: LEVEL.ok },
  diverging: { label: 'Beginning to diverge', color: LEVEL.watch },
  misaligned: { label: 'Misaligned', color: STATUS.critical },
} satisfies Record<Alignment, { label: string; color: string }>

const CAPACITY = {
  support: { label: 'High growth, available capacity', short: 'Can be supported', color: LEVEL.ok },
  intervene: { label: 'High growth, constrained capacity', short: 'Intervention required', color: STATUS.critical },
  existing: { label: 'Low growth, constrained capacity', short: 'Existing capacity issue', color: LEVEL.watch },
  spare: { label: 'Low growth, available capacity', short: 'Potential spare capacity', color: LEVEL.calm },
} satisfies Record<Capacity, { label: string; short: string; color: string }>

const LIVEABILITY = {
  gap: { label: 'Falling behind', color: STATUS.critical },
  strained: { label: 'Under strain', color: LEVEL.watch },
  pace: { label: 'Keeping pace', color: LEVEL.ok },
} satisfies Record<Liveability, { label: string; color: string }>

const PRIORITY = {
  priority: { label: 'Priority intervention', note: 'Multiple planning and capacity pressures overlap', color: STATUS.critical },
  manage: { label: 'Manage', note: 'Growth pressure rising, constraints emerging', color: LEVEL.watch },
  monitor: { label: 'Monitor', note: 'Growth broadly aligned with capacity', color: LEVEL.calm },
} satisfies Record<Priority, { label: string; note: string; color: string }>

const ACTION = {
  direct: { label: 'Direct growth', color: LEVEL.ok },
  phase: { label: 'Phase development', color: LEVEL.watch },
  replan: { label: 'Review / replan', color: PALETTE.purple[2] },
} satisfies Record<Action, { label: string; color: string }>

const fmt = (value: number) => value.toLocaleString('en-US')
const count = <T,>(of: (c: Community) => T, value: T) => COMMUNITIES.filter((c) => of(c) === value).length

/* —— Columns —— */

/** The closest pair, Arjan and Motor City, stand 2.65 km apart. */
const HEX_KM = 1.2

type Column = { color: string; heightM: number; text: string; label?: boolean; rows?: [string, string][] }

function columns(read: (c: Community) => Column, group = 'communities'): EstateTower[] {
  return COMMUNITIES.map((c) => {
    const column = read(c)
    return {
      id: `hex-${c.id}`,
      featureId: 0,
      at: c.at,
      heightM: column.heightM,
      color: column.color,
      state: 'select',
      footprint: hexagon(c.at, HEX_KM),
      label: column.label ?? false,
      title: c.name,
      text: column.text,
      tip: { title: c.name, rows: column.rows ?? [['', column.text]] },
      group,
    }
  })
}

const pressureHeight = (c: Community) => 150 + c.pressure * 14

const PRESSURE_COLUMNS = columns((c) => ({
  color: pressureColor(c.pressure),
  heightM: pressureHeight(c),
  text: `Growth pressure ${c.pressure}`,
  label: c.pressure >= 74,
  rows: [
    ['Growth pressure', `${c.pressure} / 100`],
    ['Population growth', `${c.growth}% a year`],
    ['Density', `${c.density}k per km²`],
    ['Built-up growth', `${c.builtUp}% in 5 years`],
    ['Pipeline', `${fmt(c.pipeline)} units`],
  ],
}))

const ALIGNMENT_COLUMNS = columns((c) => ({
  color: ALIGNMENT[c.alignment].color,
  heightM: 150 + c.changes * 30,
  text: `${c.changes} land-use change applications`,
  label: c.changes >= 22,
  rows: [
    ['Planned vs actual', ALIGNMENT[c.alignment].label],
    ['Change applications', `${c.changes} in 24 months`],
    ['Vacant / developable', `${c.vacant} ha`],
    ['Pipeline', `${fmt(c.pipeline)} units`],
  ],
}))

const CAPACITY_COLUMNS = columns((c) => ({
  color: CAPACITY[capacityOf(c)].color,
  heightM: pressureHeight(c),
  text: CAPACITY[capacityOf(c)].short,
  label: capacityOf(c) === 'intervene' && c.pressure >= 70,
  rows: [
    ['Class', CAPACITY[capacityOf(c)].label],
    ['Sewerage', `${c.sewer}% used`],
    ['Drainage', `${c.drainage}% used`],
    ['Utilities', `${c.utilities}% used`],
    ['Transport access', `${c.transport} / 100`],
  ],
}))

const LIVEABILITY_COLUMNS = columns((c) => ({
  color: LIVEABILITY[liveabilityOf(c)].color,
  heightM: 150 + Math.max(0, c.occupancy - 65) * 45,
  text: `${c.occupancy}% occupied · ${c.schools} school seats per 1,000`,
  label: liveabilityOf(c) === 'gap' && c.pressure >= 60,
  rows: [
    ['Residential occupancy', `${c.occupancy}%`],
    ...(c.workers ? [['Worker accommodation', `${c.workers}% used`] as [string, string]] : []),
    ['School seats', `${c.schools} per 1,000`],
    ['Green space within 400 m', `${c.green}% of homes`],
  ],
}))

/** The four signals combined, 0–100. */
const composite = (c: Community) =>
  Math.round(
    0.35 * c.pressure +
      0.2 * { aligned: 20, diverging: 60, misaligned: 95 }[c.alignment] +
      0.25 * Math.max(c.sewer, c.drainage, c.utilities) +
      0.2 * { pace: 25, strained: 60, gap: 95 }[liveabilityOf(c)],
  )

const PRIORITY_COLUMNS = columns((c) => ({
  color: PRIORITY[c.priority].color,
  heightM: 150 + Math.max(0, composite(c) - 30) * 26,
  text: PRIORITY[c.priority].label,
  label: c.priority === 'priority',
  rows: [
    ['Priority', PRIORITY[c.priority].label],
    ['Combined score', `${composite(c)} / 100`],
    ['Growth pressure', `${c.pressure}`],
    ['Land use', ALIGNMENT[c.alignment].label],
    ['Infrastructure', CAPACITY[capacityOf(c)].short],
    ['Housing and services', LIVEABILITY[liveabilityOf(c)].label],
  ],
}))

const ACTION_COLUMNS = columns((c) => ({
  color: c.action ? ACTION[c.action].color : LEVEL.muted,
  heightM: c.action ? pressureHeight(c) : 120,
  text: c.action ? ACTION[c.action].label : 'No action needed',
  label: c.action !== undefined && (c.priority !== 'monitor' || c.action === 'direct') && c.pressure >= 60,
  rows: [
    ['DM action', c.action ? ACTION[c.action].label : 'None'],
    ['Priority', PRIORITY[c.priority].label],
    ['Pipeline', `${fmt(c.pipeline)} units`],
  ],
}))

/** Population growth as a heat layer under the columns. */
const POPULATION_HEAT: EstateHeatPoint[] = COMMUNITIES.flatMap((c, index) =>
  scatter(c.at, 10, 1.6, index * 7 + 3).map((at, point) => ({
    at,
    weight: Math.min(1, (c.growth / 12) * (0.6 + 0.4 * hash(point, index))),
    group: 'population',
  })),
)

const HEAT_RAMP = [PALETTE.purple[0], PALETTE.purple[2], PALETTE.purple[4], PALETTE.purple[6]]

const scene = (towers: EstateTower[], parts: Partial<EstateMapScene> = {}): EstateMapScene => ({
  towers,
  heat: [],
  heatRadiusM: 1600,
  heatRamp: HEAT_RAMP,
  ...parts,
})

/* —— Map Data —— */

const LAYER = {
  pressure: {
    group: 'communities',
    title: 'Urban growth pressure',
    mark: 'tower',
    color: { ramp: PRESSURE_RAMP, low: 'Low', high: 'High' },
  },
  population: { group: 'population', title: 'Population growth', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Slower', high: 'Faster' } },
  alignment: {
    group: 'communities',
    title: 'Planned vs actual land use',
    mark: 'tower',
    color: { items: (['aligned', 'diverging', 'misaligned'] as const).map((key) => ({ ...ALIGNMENT[key], count: `${count((c) => c.alignment, key)}` })) },
  },
  capacity: {
    group: 'communities',
    title: 'Growth pressure vs infrastructure capacity',
    mark: 'tower',
    color: { items: (['support', 'intervene', 'existing', 'spare'] as const).map((key) => ({ label: CAPACITY[key].label, color: CAPACITY[key].color, count: `${count(capacityOf, key)}` })) },
  },
  liveability: {
    group: 'communities',
    title: 'Growth areas vs liveability capacity',
    mark: 'tower',
    color: { items: (['gap', 'strained', 'pace'] as const).map((key) => ({ ...LIVEABILITY[key], count: `${count(liveabilityOf, key)}` })) },
  },
  priority: {
    group: 'communities',
    title: 'Integrated planning priority',
    mark: 'tower',
    color: { items: (['priority', 'manage', 'monitor'] as const).map((key) => ({ label: PRIORITY[key].label, color: PRIORITY[key].color, count: `${count((c) => c.priority, key)}` })) },
  },
  action: {
    group: 'communities',
    title: 'DM planning action',
    mark: 'tower',
    color: {
      items: [
        ...(['direct', 'phase', 'replan'] as const).map((key) => ({ ...ACTION[key], count: `${count((c) => c.action, key)}` })),
        { label: 'No action needed', color: LEVEL.muted, count: `${count((c) => c.action, undefined)}` },
      ],
    },
  },
} satisfies Record<string, MapDataLayer>

/* —— The story —— */

const CAMERA = {
  city: { center: [55.262, 25.105], zoom: 10.55, pitch: 52, bearing: -14 },
  west: { center: [55.215, 25.085], zoom: 11.2, pitch: 56, bearing: -24 },
  capacity: { center: [55.258, 25.11], zoom: 10.75, pitch: 55, bearing: 10 },
  liveability: { center: [55.27, 25.12], zoom: 10.7, pitch: 50, bearing: -32 },
  priority: { center: [55.255, 25.1], zoom: 10.65, pitch: 58, bearing: -6 },
  decision: { center: [55.255, 25.09], zoom: 10.5, pitch: 54, bearing: 16 },
} satisfies Record<string, EstateCamera>

const FILTERS = ['Dubai', '2026 baseline', 'Pipeline to 2030']

const top = (by: (c: Community) => number, n = 6) => [...COMMUNITIES].sort((a, b) => by(b) - by(a)).slice(0, n)

const PIPELINE_TOTAL = COMMUNITIES.reduce((sum, c) => sum + c.pipeline, 0)
const TOP_SIX_SHARE = Math.round((top((c) => c.pipeline).reduce((sum, c) => sum + c.pipeline, 0) / PIPELINE_TOTAL) * 100)

const short = (c: Community) => c.name.replace('Jumeirah Village Circle', 'JVC').replace('Dubai Creek Harbour', 'Creek Harbour').replace('JLT and Dubai Marina', 'JLT / Marina')

const actionCard = (action: Action, index: number, where: string, does: string): EstateCard => ({
  id: `action-${action}`,
  kind: 'specs',
  title: `${index} · ${ACTION[action].label}`,
  items: [
    ['Where', where],
    ['DM action', does],
    ['Areas', COMMUNITIES.filter((c) => c.action === action).map(short).slice(0, 3).join(', ')],
    ['Count', `${count((c) => c.action, action)} communities`],
  ],
})

export const URBAN_STORY: EstateStory = {
  id: 'dm-urban',
  title: 'Urban Planning Story',
  description:
    'Where Dubai is growing, whether growth is aligned with the plan, whether infrastructure, housing and services can absorb it, where the priority planning areas are, and what Dubai Municipality should do.',
  place: 'dubai',
  pages: [
    {
      id: 'dm-urban-growth',
      title: 'Where is Dubai growing?',
      finding:
        'Population growth and the development pipeline are concentrating future urban pressure in specific areas. Areas where population growth and committed development overlap are likely to face the earliest planning pressure.',
      camera: CAMERA.city,
      scene: scene(PRESSURE_COLUMNS, { heat: POPULATION_HEAT }),
      filters: FILTERS,
      layers: [LAYER.pressure, LAYER.population],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Dubai’s growth is not even. Six communities hold ',
            { em: [`${TOP_SIX_SHARE}% of the committed pipeline`] },
            ', and where that pipeline meets fast population growth, in ',
            { em: ['JVC, Business Bay and Arjan'] },
            ', planning pressure will arrive first.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Dubai, 2026',
          tiles: [
            { label: 'Population', value: '3.95', unit: 'M', note: '+5.4% a year' },
            { label: 'Development pipeline', value: `${Math.round(PIPELINE_TOTAL / 1000)}k`, unit: 'units', note: 'committed to 2030' },
            { label: 'Built-up growth', value: '+7.8', unit: '%', note: 'in 5 years' },
          ],
        },
        {
          id: 'pressure',
          kind: 'hbars',
          title: 'Highest growth pressure',
          bars: top((c) => c.pressure).map((c) => ({ label: short(c), value: c.pressure, display: `${c.pressure}`, color: pressureColor(c.pressure) })),
        },
        {
          id: 'population',
          kind: 'line',
          title: 'Population, millions',
          kpi: { value: '4.6M', unit: 'by 2030 on today’s trend' },
          x: ['2020', '2022', '2024', '2026', '2028', '2030'],
          yLabels: ['5', '4', '3'],
          yMax: 5,
          series: [
            { name: 'Population', points: [3.41, 3.48, 3.55, 3.66, 3.84, 3.95, null, null, null, null, null] },
            { name: 'Projected', points: [null, null, null, null, null, 3.95, 4.08, 4.21, 4.34, 4.47, 4.6], dashed: true },
          ].map((series) => ({ ...series, points: series.points.map((value) => (value === null ? null : (value - 3) * 2.5)) })),
        },
        {
          id: 'pipeline',
          kind: 'vbars',
          title: 'Committed pipeline, thousand units',
          bars: top((c) => c.pipeline).map((c) => ({ label: short(c).split(' ')[0], value: c.pipeline / 1000, display: `${(c.pipeline / 1000).toFixed(1)}k` })),
        },
        { id: 'concentration', kind: 'cell', title: 'Concentration', value: `${TOP_SIX_SHARE}%`, note: 'of the pipeline in 6 of 20 communities' },
      ]),
    },
    {
      id: 'dm-urban-alignment',
      title: 'Is growth aligned with the plan?',
      finding:
        'Repeated land-use changes and development activity highlight areas where the existing plan may need review. Repeated changes in the same area may indicate a structural planning issue rather than isolated requests.',
      camera: CAMERA.west,
      scene: scene(ALIGNMENT_COLUMNS),
      filters: FILTERS,
      layers: [LAYER.alignment],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Growth alone does not need a new plan. The signal is drift: ',
            { em: ['JVC, Al Quoz and Arjan'] },
            ' filed ',
            { em: ['115 land-use change applications'] },
            ' in 24 months while development continued.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Last 24 months',
          tiles: [
            { label: 'Change applications', value: `${COMMUNITIES.reduce((sum, c) => sum + c.changes, 0)}`, note: 'land-use changes requested' },
            { label: 'Areas diverging', value: `${count((c) => c.alignment, 'diverging') + count((c) => c.alignment, 'misaligned')}`, note: `${count((c) => c.alignment, 'misaligned')} misaligned` },
            { label: 'Vacant / developable', value: fmt(COMMUNITIES.reduce((sum, c) => sum + c.vacant, 0)), unit: 'ha', note: 'mostly in the south' },
          ],
        },
        {
          id: 'changes',
          kind: 'hbars',
          title: 'Land-use change applications',
          bars: top((c) => c.changes).map((c) => ({ label: short(c), value: c.changes, display: `${c.changes}`, color: ALIGNMENT[c.alignment].color })),
        },
        {
          id: 'drift',
          kind: 'table',
          title: 'Planned vs actual land use',
          columns: ['Area', 'Planned', 'Actual'],
          dotColumn: 0,
          rows: [
            { cells: ['JVC', 'Villas, low-rise', 'Mid-rise flats'], color: STATUS.critical },
            { cells: ['Al Quoz', 'Light industry', 'Residential, retail'], color: STATUS.critical },
            { cells: ['Arjan', 'Mixed, 40% resi', '72% residential'], color: STATUS.critical },
            { cells: ['Business Bay', 'Offices', 'Serviced homes'], color: LEVEL.watch },
            { cells: ['Motor City', 'Leisure, villas', 'Apartments'], color: LEVEL.watch },
          ],
        },
        { id: 'repeat', kind: 'cell', title: 'Repeat applications', value: '64%', note: 'filed on plots already changed once', status: 'critical' },
        { id: 'message', kind: 'note', title: 'Key message', text: 'Repeated changes in the same area may indicate a structural planning issue rather than isolated development requests.' },
      ]),
    },
    {
      id: 'dm-urban-infrastructure',
      title: 'Can infrastructure absorb it?',
      finding:
        'Some growth areas may reach infrastructure constraints before planned development is fully delivered. Infrastructure planning should anticipate committed growth before capacity becomes a constraint.',
      camera: CAMERA.capacity,
      scene: scene(CAPACITY_COLUMNS),
      filters: FILTERS,
      layers: [LAYER.capacity],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            `${count(capacityOf, 'intervene')} high-growth communities`,
            ' already run sewerage, drainage or utilities above 80%. In ',
            { em: ['JVC and Business Bay'] },
            ' sewerage is past 90% with most of the pipeline unbuilt, so investment must lead approvals.',
          ],
        },
        {
          id: 'classes',
          kind: 'specs',
          title: 'Growth pressure vs capacity',
          items: (['support', 'intervene', 'existing', 'spare'] as const).map((key) => [CAPACITY[key].label, CAPACITY[key].short] as [string, string]),
        },
        {
          id: 'sewer',
          kind: 'hbars',
          title: 'Peak sewerage utilisation',
          bars: top((c) => (highGrowth(c) ? c.sewer : 0)).map((c) => ({ label: short(c), value: c.sewer, display: `${c.sewer}%`, color: CAPACITY[capacityOf(c)].color })),
        },
        {
          id: 'jvc',
          kind: 'progress',
          title: 'JVC · capacity used',
          rows: [
            { label: 'Sewerage', value: `${BY_ID.jvc.sewer}%`, target: '80% planning limit', pct: BY_ID.jvc.sewer, color: STATUS.critical },
            { label: 'Drainage', value: `${BY_ID.jvc.drainage}%`, target: '80% planning limit', pct: BY_ID.jvc.drainage, color: STATUS.critical },
            { label: 'Utilities', value: `${BY_ID.jvc.utilities}%`, target: '80% planning limit', pct: BY_ID.jvc.utilities, color: LEVEL.watch },
            { label: 'Transport access', value: `${BY_ID.jvc.transport}`, target: '60 target', pct: BY_ID.jvc.transport, color: LEVEL.watch },
          ],
        },
        {
          id: 'categories',
          kind: 'donut',
          title: 'Communities by class',
          total: `${COMMUNITIES.length}`,
          totalLabel: 'communities',
          slices: (['support', 'intervene', 'existing', 'spare'] as const).map((key) => ({ name: CAPACITY[key].short, value: count(capacityOf, key), color: CAPACITY[key].color })),
        },
        { id: 'first', kind: 'cell', title: 'First constraint', value: '2027', note: 'JVC sewerage at today’s approval rate', status: 'critical' },
      ]),
    },
    {
      id: 'dm-urban-liveability',
      title: 'Are housing and services keeping pace?',
      finding:
        'Growth becomes more difficult to sustain where housing and community provision fall behind. An area may have capacity for additional buildings without having capacity for the people who will occupy them.',
      camera: CAMERA.liveability,
      scene: scene(LIVEABILITY_COLUMNS),
      filters: FILTERS,
      layers: [LAYER.liveability],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Buildings are not the only limit. Growth-area homes are ',
            { em: ['over 93% occupied'] },
            ', Business Bay, Al Quoz and JVC have ',
            { em: ['0.4–0.7 school seats per 1,000'] },
            ', and Al Quoz’s worker housing is over capacity.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Growth areas',
          tiles: [
            { label: 'Residential occupancy', value: '93', unit: '%', note: 'pressure above 90%' },
            { label: 'Worker accommodation', value: '104', unit: '%', note: 'of capacity, 4 areas' },
            { label: 'Within 400 m of green', value: '46', unit: '%', note: 'of homes, target 80%' },
          ],
        },
        {
          id: 'schools',
          kind: 'hbars',
          title: 'Fewest school seats per 1,000 residents',
          bars: top((c) => (highGrowth(c) || c.priority !== 'monitor' ? 2 - c.schools : -1)).map((c) => ({
            label: short(c),
            value: c.schools,
            display: `${c.schools}`,
            color: LIVEABILITY[liveabilityOf(c)].color,
          })),
        },
        {
          id: 'green',
          kind: 'grouped',
          title: 'Occupancy vs green-space access',
          legend: ['Occupancy %', 'Green within 400 m %'],
          groups: ['jvc', 'business-bay', 'arjan', 'al-quoz', 'dubai-hills'].map((id) => ({ label: short(BY_ID[id]).split(' ')[0], values: [BY_ID[id].occupancy, BY_ID[id].green] })),
        },
        { id: 'workers', kind: 'cell', title: 'Worker accommodation', value: '108%', note: 'Al Quoz, used against permitted beds', status: 'critical' },
        { id: 'message', kind: 'note', title: 'Key message', text: 'An area may have capacity for additional buildings without having sufficient capacity for the people who will occupy them.' },
      ]),
    },
    {
      id: 'dm-urban-priority',
      title: 'Where are the priority planning areas?',
      finding:
        'Combining growth, land-use and capacity signals reveals Dubai’s priority planning areas. The highest-priority areas are not necessarily those growing fastest, but those where growth and capacity pressures accumulate together.',
      camera: CAMERA.priority,
      scene: scene(PRIORITY_COLUMNS),
      filters: FILTERS,
      layers: [LAYER.priority],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { em: [`${count((c) => c.priority, 'priority')} communities`] },
            ' need intervention, where growth, land-use drift and capacity gaps overlap. Dubai South grows fastest but stays ',
            { em: ['Manage'] },
            ': its land and capacity are still ahead of demand.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Integrated assessment',
          tiles: (['priority', 'manage', 'monitor'] as const).map((key) => ({ label: PRIORITY[key].label, value: `${count((c) => c.priority, key)}`, note: PRIORITY[key].note })),
        },
        {
          id: 'signals',
          kind: 'table',
          title: 'Where the four signals converge',
          height: 2,
          columns: ['Area', 'Growth', 'Land use', 'Infra.', 'Services'],
          dotColumn: 0,
          rows: top(composite, 9).map((c) => ({
            cells: [
              short(c),
              highGrowth(c) ? 'High' : 'Low',
              c.alignment === 'aligned' ? 'OK' : c.alignment === 'diverging' ? 'Drifting' : 'Misaligned',
              constrained(c) ? 'Strained' : 'OK',
              LIVEABILITY[liveabilityOf(c)].label.replace('Falling behind', 'Behind').replace('Keeping pace', 'OK').replace('Under strain', 'Strained'),
            ],
            color: PRIORITY[c.priority].color,
          })),
        },
        {
          id: 'composite',
          kind: 'hbars',
          title: 'Combined score',
          bars: top(composite).map((c) => ({ label: short(c), value: composite(c), display: `${composite(c)}`, color: PRIORITY[c.priority].color })),
        },
        { id: 'fastest', kind: 'cell', title: 'Fastest growing', value: 'Dubai South', note: '+11.6% a year, yet Manage, not Priority' },
      ]),
    },
    {
      id: 'dm-urban-decision',
      title: 'What should DM do?',
      finding:
        'Dubai Municipality can respond to growth through three planning actions: direct growth, phase development, or review and replan. The integrated view shows where growth can be encouraged, where it should be phased with capacity, and where the plan itself may need review.',
      camera: CAMERA.decision,
      scene: scene(ACTION_COLUMNS),
      filters: FILTERS,
      columns: 3,
      layers: [LAYER.action],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Three planning actions',
          parts: [
            { em: ['Direct'] },
            ' new development to areas with land, capacity and the right zoning; ',
            { em: ['phase'] },
            ' it where infrastructure or services lag; and ',
            { em: ['replan'] },
            ' where recurring pressure shows the plan no longer reflects demand.',
          ],
        },
        actionCard('direct', 1, 'Strong demand, available land and infrastructure, aligned plan', 'Steer additional development here'),
        actionCard('phase', 2, 'Strong pipeline, infrastructure or service constraints', 'Tie approvals to infrastructure delivery'),
        actionCard('replan', 3, 'Persistent misalignment, repeated change applications', 'Review zoning, density or land allocation'),
        {
          id: 'phase-levers',
          kind: 'note',
          title: 'Phasing influences',
          text: 'Development sequencing, infrastructure investment, the timing of approvals, and capital planning.',
        },
        {
          id: 'pipeline-by-action',
          kind: 'donut',
          title: 'Pipeline by action',
          total: `${Math.round(PIPELINE_TOTAL / 1000)}k`,
          totalLabel: 'units',
          slices: (['direct', 'phase', 'replan'] as const).map((key) => ({
            name: ACTION[key].label,
            value: COMMUNITIES.filter((c) => c.action === key).reduce((sum, c) => sum + c.pipeline, 0),
            color: ACTION[key].color,
          })),
        },
        {
          id: 'statement',
          kind: 'note',
          title: 'The integrated view',
          text: 'Lets Dubai Municipality decide where growth can be encouraged, where it should be phased with capacity improvements, and where the urban plan itself may need to be reviewed.',
        },
      ],
    },
  ],
}

/* —— The Briefing place, and Tell Me More's views: the priority map, then one map per horizon —— */

export const URBAN_PLACE: EstatePlace = {
  id: 'dubai',
  camera: { center: [55.255, 25.11], zoom: 10.9, pitch: 58, bearing: -20 },
  scene: scene(PRESSURE_COLUMNS, { heat: POPULATION_HEAT }),
}

/** A horizon's map: the communities it acts on in its colour, the rest muted low. */
function horizonColumns(horizon: Horizon, acts: Record<string, string>, heightOf: (c: Community) => number = pressureHeight) {
  return columns((c) =>
    acts[c.id]
      ? { color: HORIZON_COLOR[horizon], heightM: heightOf(c), text: acts[c.id], label: true, rows: [['Action', acts[c.id]], ['Priority', PRIORITY[c.priority].label]] }
      : { color: LEVEL.muted, heightM: 120, text: PRIORITY[c.priority].label, rows: [['Priority', PRIORITY[c.priority].label]] },
  )
}

export const URBAN_ACTS: Record<Horizon, Record<string, string>> = {
  immediate: {
    jvc: 'Condition approvals on sewer sign-off',
    arjan: 'Condition approvals on sewer sign-off',
    'business-bay': 'Phase approvals to capacity',
    'al-quoz': 'Pause change-of-use approvals',
    'motor-city': 'Start a land-use review',
    'creek-harbour': 'Fast-track aligned applications',
    'mbr-city': 'Fast-track aligned applications',
  },
  intermediate: {
    jvc: 'Sewer trunk and 2 schools',
    'business-bay': 'Drainage upgrade, 1 school',
    'al-furjan': 'Pumping station upgrade',
    'town-square': 'Bus links and a school',
    'jlt-marina': 'Drainage and utilities upgrade',
    'intl-city': 'Sewer rehabilitation',
    'dubai-south': 'Community services ahead of handover',
  },
  long: {
    jvc: 'Revised density and zoning',
    arjan: 'Revised land allocation',
    'al-quoz': 'Mixed-use rezoning, worker housing',
    'motor-city': 'Revised zoning',
    'dubai-south': 'Planned growth corridor',
    'expo-city': 'Planned growth corridor',
    'dubai-hills': 'Absorb directed growth',
  },
}

const CORRIDOR: EstateLine[] = [
  {
    id: 'corridor',
    path: [BY_ID['dubai-south'].at, BY_ID['expo-city'].at, BY_ID['al-furjan'].at, BY_ID['jlt-marina'].at],
    color: HORIZON_COLOR.long,
    width: 3,
    dashed: true,
    group: 'corridor',
    tip: { title: 'Southern growth corridor', rows: [['Transit', 'Route 2020 extension'], ['Capacity', '60k homes by 2035']] },
  },
]

const horizonLayer = (horizon: Horizon, title: string): MapDataLayer => ({
  group: 'communities',
  title,
  mark: 'tower',
  color: {
    items: [
      { label: 'Acted on', color: HORIZON_COLOR[horizon], count: `${Object.keys(URBAN_ACTS[horizon]).length}` },
      { label: 'Unchanged', color: LEVEL.muted },
    ],
  },
})

const ASK_CAMERA: EstateCamera = { center: [55.262, 25.1], zoom: 10.35, pitch: 52, bearing: -14 }

export const URBAN_ASK_VIEWS = {
  urban: { camera: ASK_CAMERA, scene: scene(PRIORITY_COLUMNS), layers: [LAYER.priority] },
  'urban-immediate': {
    camera: { center: [55.26, 25.11], zoom: 10.6, pitch: 55, bearing: 6 },
    scene: scene(horizonColumns('immediate', URBAN_ACTS.immediate)),
    layers: [horizonLayer('immediate', 'Approvals conditioned or fast-tracked')],
  },
  'urban-intermediate': {
    camera: { center: [55.255, 25.09], zoom: 10.45, pitch: 56, bearing: -24 },
    scene: scene(horizonColumns('intermediate', URBAN_ACTS.intermediate)),
    layers: [horizonLayer('intermediate', 'Infrastructure and services delivered')],
  },
  'urban-long': {
    camera: { center: [55.215, 25.03], zoom: 10.3, pitch: 52, bearing: -38 },
    scene: scene(horizonColumns('long', URBAN_ACTS.long), { lines: CORRIDOR }),
    layers: [
      horizonLayer('long', 'Areas replanned or growth directed'),
      { group: 'corridor', title: 'Southern growth corridor', mark: 'line', color: { items: [{ label: 'Planned corridor', color: HORIZON_COLOR.long }] } },
    ],
  },
} satisfies Record<string, EstateAskView>

/** The communities by combined score, highest first, for the reply's chart. */
export const URBAN_RANKING = top(composite).map((c) => ({ name: short(c), score: composite(c), color: PRIORITY[c.priority].color }))

export const URBAN_COUNTS = {
  priority: count((c) => c.priority, 'priority'),
  manage: count((c) => c.priority, 'manage'),
  monitor: count((c) => c.priority, 'monitor'),
  pipeline: PIPELINE_TOTAL,
}
