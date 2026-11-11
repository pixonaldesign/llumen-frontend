/**
 * Urban Planning use case 2, infrastructure: sewerage, drainage, power and roads in JVC, Arjan and Motor
 * City have not grown with their population. Three findings (networks near capacity, the bottlenecks, the
 * shortfall the pipeline brings); the horizon maps and solutions serve Simulate recommended actions.
 * Every value is an illustrative example.
 */
import { scatter, type LngLat } from '../realEstate/estateGeo'
import type { EstateArea, EstateHeatPoint, EstateLabel, EstateLine, EstatePoint } from '../realEstate/estateMapLayers'
import {
  PALETTE,
  STATUS,
  type EstateAskView,
  type EstatePlace,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
import { circle } from './dmGeo'
import { HORIZON_COLOR, LEVEL, toned } from './dmShared'
import {
  AREA_LIST,
  AREAS,
  AREAS_ASK_CAMERA,
  AREAS_CAMERA,
  GAP_RAMP,
  TOTAL_GROWTH,
  TOTALS,
  actionMarks,
  areaOutlines,
  fmt,
  horizonOutlines,
  labelAt,
  planningSolution,
  scene,
  thousands,
  type AreaId,
  type PlanningAction,
  type PlanningSolution,
} from './growthAreas'

/* —— Network loads —— */

type Network = 'sewer' | 'drainage' | 'power' | 'roads'

const NETWORK_LABEL: Record<Network, string> = { sewer: 'Sewerage', drainage: 'Stormwater drainage', power: 'Power', roads: 'Roads' }
const NETWORKS = Object.keys(NETWORK_LABEL) as Network[]

/** Peak load as % of design capacity; roads as peak volume over capacity. */
const LOAD: Record<AreaId, Record<Network, number>> = {
  jvc: { sewer: 94, drainage: 88, power: 86, roads: 112 },
  arjan: { sewer: 91, drainage: 84, power: 78, roads: 105 },
  'motor-city': { sewer: 86, drainage: 90, power: 72, roads: 96 },
}

/** Planning keeps a 20% reserve on every network. */
const LIMIT = 80

const OVER = AREA_LIST.reduce((count, area) => count + NETWORKS.filter((network) => LOAD[area.id][network] > LIMIT).length, 0)
const NETWORK_COUNT = AREA_LIST.length * NETWORKS.length

const loadColor = (load: number) => (load >= 95 ? STATUS.critical : load >= 85 ? LEVEL.high : load > LIMIT ? LEVEL.watch : LEVEL.ok)
const worst = (id: AreaId) => Math.max(...NETWORKS.map((network) => LOAD[id][network]))

/* —— The assets that bind —— */

type Station = { code: string; name: string; area: AreaId; at: LngLat; load: number; upgrade: string }

const STATIONS: Station[] = [
  { code: 'PS-1', name: 'JVC pumping station', area: 'jvc', at: [55.2085, 25.0485], load: 104, upgrade: '2029' },
  { code: 'PS-2', name: 'Arjan pumping station', area: 'arjan', at: [55.2405, 25.0575], load: 97, upgrade: 'None planned' },
  { code: 'PS-3', name: 'Motor City pumping station', area: 'motor-city', at: [55.2455, 25.0465], load: 88, upgrade: 'None planned' },
]

const TRUNK: LngLat[] = [
  [55.188, 25.043],
  [55.2085, 25.0485],
  [55.222, 25.055],
  [55.2405, 25.0575],
  [55.252, 25.06],
]

type Hotspot = { id: string; at: LngLat; reports: number; depth: string }

const FLOODING: Hotspot[] = [
  { id: 'f1', at: [55.196, 25.055], reports: 17, depth: '28 cm' },
  { id: 'f2', at: [55.214, 25.052], reports: 14, depth: '22 cm' },
  { id: 'f3', at: [55.236, 25.0485], reports: 12, depth: '19 cm' },
  { id: 'f4', at: [55.2445, 25.0505], reports: 11, depth: '24 cm' },
  { id: 'f5', at: [55.231, 25.0565], reports: 9, depth: '16 cm' },
]

const FLOOD_REPORTS = FLOODING.reduce((sum, spot) => sum + spot.reports, 0)

type Junction = { code: string; name: string; at: LngLat; delay: number; ratio: number }

const JUNCTIONS: Junction[] = [
  { code: 'J-1', name: 'Al Khail Road · JVC entrance', at: [55.2095, 25.0735], delay: 11, ratio: 1.18 },
  { code: 'J-2', name: 'Hessa Street · Arjan', at: [55.2225, 25.0605], delay: 9, ratio: 1.09 },
  { code: 'J-3', name: 'Sheikh Mohammed Bin Zayed Road · Motor City', at: [55.2278, 25.0478], delay: 7, ratio: 1.02 },
]

/* —— What the pipeline adds —— */

type PipelineSite = { id: string; area: AreaId; at: LngLat; homes: number; year: number }

const PIPELINE: PipelineSite[] = [
  { id: 'p1', area: 'jvc', at: [55.195, 25.048], homes: 2400, year: 2027 },
  { id: 'p2', area: 'jvc', at: [55.205, 25.062], homes: 3100, year: 2027 },
  { id: 'p3', area: 'jvc', at: [55.212, 25.058], homes: 2800, year: 2028 },
  { id: 'p4', area: 'jvc', at: [55.19, 25.044], homes: 3600, year: 2029 },
  { id: 'p5', area: 'jvc', at: [55.215, 25.06], homes: 2200, year: 2028 },
  { id: 'p6', area: 'jvc', at: [55.179, 25.0385], homes: 4300, year: 2030 },
  { id: 'p7', area: 'arjan', at: [55.228, 25.058], homes: 3800, year: 2027 },
  { id: 'p8', area: 'arjan', at: [55.244, 25.06], homes: 4100, year: 2028 },
  { id: 'p9', area: 'arjan', at: [55.247, 25.0645], homes: 3300, year: 2030 },
  { id: 'p10', area: 'motor-city', at: [55.232, 25.05], homes: 2900, year: 2027 },
  { id: 'p11', area: 'motor-city', at: [55.24, 25.049], homes: 2600, year: 2028 },
  { id: 'p12', area: 'motor-city', at: [55.246, 25.047], homes: 2300, year: 2029 },
]

/** The first year a site outruns the upgrades planned for it. */
const UPGRADES_ARRIVE = 2029
const EARLY = PIPELINE.filter((site) => site.year < UPGRADES_ARRIVE)
const EARLY_HOMES = EARLY.reduce((sum, site) => sum + site.homes, 0)

/** Sewage flow and treatment capacity serving the three areas, ML/day, 2024–2030. */
const YEARS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030']
const DEMAND = [62, 68, 75, 82, 90, 96, 101]
const CAPACITY = [76, 76, 76, 76, 76, 98, 110]
const SHORTFALL_FROM = YEARS[DEMAND.findIndex((value, index) => value > CAPACITY[index])]
const PEAK_SHORTFALL = Math.max(...DEMAND.map((value, index) => value - CAPACITY[index]))

/* —— Map pieces —— */

const SEWER = PALETTE.categorical[0]
const FLOOD = PALETTE.blue[4]
const ROAD = LEVEL.watch
const YEAR_COLOR: Record<number, string> = { 2027: STATUS.critical, 2028: LEVEL.high, 2029: LEVEL.watch, 2030: LEVEL.muted }

const LOAD_HEAT: EstateHeatPoint[] = AREA_LIST.flatMap((area, index) =>
  scatter(labelAt(area.id), Math.round(area.population / 2500), area.id === 'jvc' ? 1.5 : 0.85, index * 19 + 2).map((at) => ({
    at,
    weight: (LOAD[area.id].sewer - 60) / 40,
    group: 'load',
  })),
)

const trunkLine = (dashed = false): EstateLine => ({
  id: 'trunk-tm2',
  path: TRUNK,
  color: SEWER,
  width: 4,
  dashed,
  group: 'sewer',
  tip: { title: 'TM-2 trunk sewer', rows: [['Flow', '96% of capacity at peak'], ['Upgrade', '2030']] },
})

const stationPoints = (): EstatePoint[] =>
  STATIONS.map((station) => ({
    id: `station-${station.code}`,
    at: station.at,
    color: loadColor(station.load),
    radius: 7.5,
    group: 'sewer',
    tip: { title: `${station.code} · ${station.name}`, rows: [['Peak load', `${station.load}% of design`], ['Upgrade', station.upgrade]] },
  }))

const stationTips = (): EstateLabel[] =>
  STATIONS.map((station) => ({
    id: `station-tip-${station.code}`,
    at: station.at,
    heightM: 0,
    color: loadColor(station.load),
    title: `${station.code} · ${station.load}% of design`,
    text: '',
    rows: [
      ['Serves', AREAS[station.area].name],
      ['Upgrade', station.upgrade],
    ],
    group: 'sewer',
  }))

const floodAreas = (): EstateArea[] =>
  FLOODING.map((spot) => ({
    id: `flood-${spot.id}`,
    ring: circle(spot.at, 160 + spot.reports * 8),
    color: FLOOD,
    opacity: 0.32,
    outlineWidth: 1.5,
    group: 'flooding',
    tip: { title: 'Ponding after 38 mm of rain', rows: [['Reports', `${spot.reports}`], ['Deepest', spot.depth]] },
  }))

const junctionPoints = (): EstatePoint[] =>
  JUNCTIONS.map((junction) => ({
    id: `junction-${junction.code}`,
    at: junction.at,
    color: ROAD,
    radius: 6.5,
    group: 'roads',
    tip: { title: `${junction.code} · ${junction.name}`, rows: [['Peak delay', `${junction.delay} min`], ['Volume / capacity', junction.ratio.toFixed(2)]] },
  }))

const pipelinePoints = (): EstatePoint[] =>
  PIPELINE.map((site) => ({
    id: `pipeline-${site.id}`,
    at: site.at,
    color: YEAR_COLOR[site.year],
    radius: 4 + site.homes / 900,
    group: 'pipeline',
    tip: { title: `${fmt(site.homes)} residential units · ${AREAS[site.area].short}`, rows: [['Completes', `${site.year}`], ['Upgrades arrive', site.year < UPGRADES_ARRIVE ? 'After it' : 'Before it']] }
  }))

const loadOutlines = () =>
  areaOutlines((area) => ({
    color: loadColor(worst(area.id)),
    level: (worst(area.id) - 60) / 60,
    text: `Sewerage ${LOAD[area.id].sewer}% · roads ${LOAD[area.id].roads}%`,
    rows: NETWORKS.map((network) => [NETWORK_LABEL[network], `${LOAD[area.id][network]}%`] as [string, string]),
  }))

const quietOutlines = () =>
  areaOutlines((area) => ({ color: PALETTE.purple[3], level: 0, text: '', label: false, rows: [['Residents', fmt(area.population)]] }))

/* —— Map Data —— */

const LAYER = {
  load: {
    group: 'communities',
    title: 'Most loaded network',
    mark: 'area',
    color: { items: AREA_LIST.map((area) => ({ label: area.name, color: loadColor(worst(area.id)), count: `${worst(area.id)}%` })) },
  },
  demand: { group: 'load', title: 'Sewage flow by residential unit', mark: 'heat', color: { ramp: GAP_RAMP, low: 'Lower', high: 'Higher' } },
  sewer: {
    group: 'sewer',
    title: 'Sewerage network',
    mark: 'point',
    color: { items: STATIONS.map((station) => ({ label: station.code, color: loadColor(station.load), count: `${station.load}%` })) },
  },
  flooding: { group: 'flooding', title: 'Flooding after 38 mm of rain', mark: 'area', color: { items: [{ label: 'Ponding reported', color: FLOOD, count: `${FLOOD_REPORTS}` }] } },
  roads: {
    group: 'roads',
    title: 'Congested junctions',
    mark: 'point',
    color: { items: JUNCTIONS.map((junction) => ({ label: junction.code, color: ROAD, count: `${junction.delay} min` })) },
  },
  pipeline: {
    group: 'pipeline',
    title: 'Pipeline residential units, by completion',
    mark: 'point',
    color: {
      items: [2027, 2028, 2029, 2030].map((year) => ({
        label: `${year}`,
        color: YEAR_COLOR[year],
        count: thousands(PIPELINE.filter((site) => site.year === year).reduce((sum, site) => sum + site.homes, 0)),
      })),
    },
  },
} satisfies Record<string, MapDataLayer>

/* —— The story —— */

const FILTERS = ['JVC, Arjan, Motor City', '2026', 'Infrastructure capacity']

const CAPACITY_SCENE = scene({ heat: LOAD_HEAT, heatRamp: GAP_RAMP, ...loadOutlines() })

const BOTTLENECK_SCENE = scene({
  areas: [...quietOutlines().areas, ...floodAreas()],
  lines: [trunkLine()],
  points: [...stationPoints(), ...junctionPoints()],
  labels: stationTips(),
})

const earlyIn = (id: AreaId) => EARLY.filter((site) => site.area === id).reduce((sum, site) => sum + site.homes, 0)

const SHORTFALL_SCENE = scene({
  ...areaOutlines((area) => ({
    color: PALETTE.purple[3],
    level: 0.15,
    text: `${fmt(earlyIn(area.id))} residential units before the upgrades`,
    rows: [
      ['Pipeline', `${fmt(area.pipeline)} residential units`],
      ['Before the upgrades', `${fmt(earlyIn(area.id))} residential units`],
      ['Sewerage', `${LOAD[area.id].sewer}% of design`],
    ],
  })),
  lines: [trunkLine()],
  points: [...stationPoints(), ...pipelinePoints()],
})

export const INFRASTRUCTURE_STORY: EstateStory = {
  id: 'dm-infrastructure',
  title: 'Infrastructure Capacity Use Case',
  description:
    'How LLUMEN shows sewerage, drainage, power and roads in JVC, Arjan and Motor City falling behind their growth, finds the assets that bind, and confirms the shortfall the committed pipeline will bring.',
  place: 'infrastructure',
  pages: [
    {
      id: 'dm-infrastructure-capacity',
      title: 'Infrastructure Capacity Gap Identified',
      finding:
        'Network monitoring shows sewerage, drainage, power and roads in JVC, Arjan and Motor City running close to or over capacity after five years of fast growth.',
      camera: AREAS_CAMERA,
      scene: CAPACITY_SCENE,
      filters: FILTERS,
      layers: [LAYER.load, LAYER.demand],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Executive summary',
          parts: [
            `The three areas grew +${TOTAL_GROWTH}% in five years, but their networks did not: `,
            { em: [`${OVER} of ${NETWORK_COUNT} networks`] },
            ` are past the ${LIMIT}% planning limit, led by `,
            { em: [`JVC sewerage at ${LOAD.jvc.sewer}%`] },
            ' and roads beyond capacity at peak.',
          ],
        },
        { id: 'over', kind: 'cell', title: 'Networks past the limit', value: `${OVER} of ${NETWORK_COUNT}`, note: `above ${LIMIT}% of design`, status: 'critical' },
        { id: 'sewer', kind: 'cell', title: 'JVC sewerage', value: `${LOAD.jvc.sewer}%`, note: 'of design capacity at peak', status: 'critical' },
        {
          id: 'loads',
          kind: 'grouped',
          title: 'Peak load, % of design capacity',
          legend: NETWORKS.map((network) => NETWORK_LABEL[network]),
          groups: AREA_LIST.map((area) => ({ label: area.short, values: NETWORKS.map((network) => LOAD[area.id][network]) })),
        },
        {
          id: 'jvc',
          kind: 'progress',
          title: 'JVC, peak load against design',
          rows: (['sewer', 'drainage', 'roads'] as Network[]).map((network) => ({
            label: NETWORK_LABEL[network],
            value: `${LOAD.jvc[network]}%`,
            target: `${LIMIT}% limit`,
            pct: Math.min(100, LOAD.jvc[network]),
            color: loadColor(LOAD.jvc[network]),
          })),
        },
        {
          id: 'residents',
          kind: 'hbars',
          title: 'Residents added since 2021',
          bars: AREA_LIST.map((area) => ({ label: area.short, value: area.population - area.population2021, display: `+${thousands(area.population - area.population2021)}` })),
        },
      ]),
    },
    {
      id: 'dm-infrastructure-bottlenecks',
      title: 'Network Bottlenecks Identified',
      finding:
        'Tracing each network to its assets identifies the bottlenecks: the JVC pumping station and the TM-2 trunk sewer, five drainage low points that flood in moderate rain, and three junctions on the main access roads.',
      camera: { center: [55.2185, 25.0565], zoom: 13.75, pitch: 58, bearing: 14 },
      scene: BOTTLENECK_SCENE,
      filters: FILTERS,
      layers: [LAYER.sewer, LAYER.flooding, LAYER.roads],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Executive summary',
          parts: [
            'A few assets set the limit. ',
            { em: [`PS-1 runs at ${STATIONS[0].load}%`] },
            ' of its design and overflows in storms, ',
            { em: [`${FLOODING.length} low points`] },
            ` drew ${FLOOD_REPORTS} flooding reports after 38 mm of rain, and peak delays reach ${JUNCTIONS[0].delay} minutes at ${JUNCTIONS[0].code}.`,
          ],
        },
        {
          id: 'assets',
          kind: 'table',
          title: 'Assets at their limit',
          height: 2,
          columns: ['Asset', 'Peak load', 'Upgrade'],
          dotColumn: 0,
          rows: [
            ...STATIONS.map((station) => ({ cells: [station.code, `${station.load}%`, station.upgrade], color: loadColor(station.load) })),
            { cells: ['TM-2 trunk sewer', '96%', '2030'], color: loadColor(96) },
            { cells: ['Drainage, 5 low points', 'Floods at 38 mm', '2031'], color: FLOOD },
          ],
        },
        {
          id: 'delays',
          kind: 'hbars',
          title: 'Peak delay at the main junctions, minutes',
          bars: JUNCTIONS.map((junction) => ({ label: junction.code, value: junction.delay, display: `${junction.delay} min`, color: ROAD })),
        },
        {
          id: 'survey',
          kind: 'specs',
          title: 'Drainage survey, last storm',
          items: [
            ['Rainfall', '38 mm in 3 hours'],
            ['Flooding reports', `${FLOOD_REPORTS}`],
            ['Deepest ponding', '28 cm, JVC'],
            ['Cleared in', '9 hours on average'],
          ],
        },
        { id: 'overflows', kind: 'cell', title: 'PS-1 overflows', value: '6', note: 'in the last 12 months', status: 'critical' },
      ]),
    },
    {
      id: 'dm-infrastructure-shortfall',
      title: 'Capacity Shortfall Confirmed',
      finding:
        'Modelling the committed pipeline against planned upgrades confirms a shortfall: most new residential units complete before the upgrades they depend on, and sewage flow overtakes treatment capacity first.',
      camera: { center: [55.2125, 25.0515], zoom: 13.65, pitch: 56, bearing: -24 },
      scene: SHORTFALL_SCENE,
      filters: FILTERS,
      layers: [LAYER.pipeline, LAYER.sewer],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Executive summary',
          parts: [
            { em: [`${fmt(EARLY_HOMES)} of ${fmt(TOTALS.pipeline)} pipeline residential units`] },
            ` complete before the upgrades arrive in ${UPGRADES_ARRIVE}. Sewage flow passes treatment capacity in `,
            { em: [SHORTFALL_FROM] },
            ` and runs up to ${PEAK_SHORTFALL} ML/day short until PS-1 is upgraded.`,
          ],
        },
        { id: 'early', kind: 'cell', title: 'Residential units ahead of upgrades', value: thousands(EARLY_HOMES), note: `complete before ${UPGRADES_ARRIVE}`, status: 'critical' },
        { id: 'from', kind: 'cell', title: 'Sewerage short from', value: SHORTFALL_FROM, note: `up to ${PEAK_SHORTFALL} ML/day short` },
        {
          id: 'flow',
          kind: 'line',
          title: 'Sewage flow and capacity, ML/day',
          height: 2,
          kpi: { value: `${PEAK_SHORTFALL} ML/day`, unit: 'short at the peak, 2028' },
          x: YEARS,
          yLabels: ['120', '90', '60', '30', '0'],
          yMax: 120,
          series: [
            { name: 'Sewage flow', points: DEMAND },
            { name: 'Capacity', points: CAPACITY, dashed: true },
          ],
        },
        {
          id: 'by-year',
          kind: 'vbars',
          title: 'Pipeline residential units completing, thousands',
          bars: [2027, 2028, 2029, 2030].map((year) => {
            const homes = PIPELINE.filter((site) => site.year === year).reduce((sum, site) => sum + site.homes, 0)
            return { label: `${year}`, value: homes / 1000, display: thousands(homes), color: YEAR_COLOR[year] }
          }),
        },
        {
          id: 'upgrades',
          kind: 'table',
          title: 'Planned upgrades',
          columns: ['Upgrade', 'Due', 'Residential units before it'],
          dotColumn: 0,
          rows: [
            { cells: ['PS-1 pumping station', '2029', fmt(EARLY_HOMES)], color: STATUS.critical },
            { cells: ['TM-2 trunk sewer', '2030', fmt(EARLY_HOMES + 5900)], color: LEVEL.high },
            { cells: ['J-1 junction', '2030', fmt(EARLY_HOMES + 5900)], color: LEVEL.high },
            { cells: ['Drainage, 5 low points', '2031', fmt(TOTALS.pipeline)], color: LEVEL.watch },
          ],
        },
        {
          id: 'conclusion',
          kind: 'note',
          title: 'Preliminary conclusion',
          text: 'Infrastructure in JVC, Arjan and Motor City has not kept pace with their growth. Without bringing upgrades forward or phasing approvals, the pipeline will push sewerage, drainage and roads beyond capacity from 2027.',
        },
      ]),
    },
  ],
}

export const INFRASTRUCTURE_PLACE: EstatePlace = {
  id: 'infrastructure',
  camera: { center: [55.2125, 25.0545], zoom: 13.4, pitch: 56, bearing: -12 },
  scene: CAPACITY_SCENE,
}

/* —— Simulate recommended actions: the shortfall, then one map per impact horizon —— */

const ACTIONS: PlanningAction[] = [
  {
    code: 'I1',
    horizon: 'immediate',
    action: 'Phase approvals to capacity',
    asset: `${EARLY.length} pipeline sites completing before ${UPGRADES_ARRIVE}`,
    benefit: 'Holds occupation back until each site’s network can take it',
    at: PIPELINE[7].at,
    impact: 35,
    gain: '6,800 residential units phased',
    cost: 'AED 0.5M',
    sustainability: 'Medium',
  },
  {
    code: 'I2',
    horizon: 'immediate',
    action: 'Manage peak flow at PS-1',
    asset: 'PS-1 and its wet well',
    benefit: 'Temporary storage and pumps stop storm overflows',
    at: STATIONS[0].at,
    impact: 15,
    gain: 'Overflows stopped',
    cost: 'AED 8M',
    sustainability: 'Low',
  },
  {
    code: 'I3',
    horizon: 'immediate',
    action: 'Retime signals at J-1 to J-3',
    asset: 'Three access junctions',
    benefit: 'Adaptive signal plans for the morning and evening peaks',
    at: JUNCTIONS[0].at,
    impact: 25,
    gain: '−4 min peak delay',
    cost: 'AED 1.5M',
    sustainability: 'Medium',
  },
  {
    code: 'M1',
    horizon: 'intermediate',
    action: 'Bring the PS-1 upgrade forward',
    asset: 'PS-1, from 2029 to 2027',
    benefit: 'Capacity arrives with the first pipeline residential units',
    at: STATIONS[0].at,
    impact: 55,
    gain: '+45% pumping capacity',
    cost: 'AED 120M',
    sustainability: 'High',
  },
  {
    code: 'M2',
    horizon: 'intermediate',
    action: 'Duplicate the TM-2 trunk sewer',
    asset: 'TM-2, PS-1 to PS-2',
    benefit: 'A second main that doubles trunk capacity',
    at: TRUNK[2],
    impact: 60,
    gain: '+22 ML/day',
    cost: 'AED 210M',
    sustainability: 'High',
  },
  {
    code: 'M3',
    horizon: 'intermediate',
    action: 'Upgrade drainage at 5 low points',
    asset: 'The flooding hotspots',
    benefit: 'Larger gullies and soakaways clear a 50 mm storm',
    at: FLOODING[3].at,
    impact: 70,
    gain: `${FLOOD_REPORTS} fewer flooding reports`,
    cost: 'AED 65M',
    sustainability: 'High',
  },
  {
    code: 'L1',
    horizon: 'long',
    action: 'Make growth infrastructure-led',
    asset: 'Community plans for all three areas',
    benefit: 'No permit before the network it needs is funded',
    at: [55.196, 25.06],
    impact: 40,
    gain: 'Shortfalls designed out',
    cost: 'AED 1M',
    sustainability: 'High',
  },
  {
    code: 'L2',
    horizon: 'long',
    action: 'Add a sewer connection to Jebel Ali',
    asset: 'A new trunk from PS-3 to the treatment plant',
    benefit: 'Takes the three areas’ growth off the shared trunk',
    at: [55.2385, 25.0395],
    impact: 85,
    gain: '+40 ML/day',
    cost: 'AED 480M',
    sustainability: 'High',
  },
  {
    code: 'L3',
    horizon: 'long',
    action: 'Run a bus rapid transit link',
    asset: 'JVC, Arjan and Motor City to the metro',
    benefit: 'Moves peak trips off the three congested junctions',
    at: [55.2295, 25.0555],
    impact: 45,
    gain: '−30% peak car trips',
    cost: 'AED 350M',
    sustainability: 'High',
  },
]

const SOLUTION_CHART = { chartTitle: 'Shortfall removed on its network, by action', chartUnit: 'the most any one action removes' }

export const INFRASTRUCTURE_SOLUTIONS: Record<Horizon, PlanningSolution> = {
  immediate: planningSolution('immediate', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Phase approvals and manage the peaks',
    summary: `Phase approvals on the ${EARLY.length} sites completing before ${UPGRADES_ARRIVE} to the capacity each network has, manage peak flow at PS-1 to stop overflows, and retime signals at the three access junctions.`,
    mapNote: 'The map shows the phased pipeline sites, PS-1 and the three retimed junctions.',
    stats: [
      { label: 'Residential units phased', value: '6,800' },
      { label: 'Overflows', value: 'Stopped' },
      { label: 'Cost', value: 'AED 0.5M–8M' },
    ],
  }),
  intermediate: planningSolution('intermediate', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Bring the upgrades forward',
    summary: 'Upgrade PS-1 two years early, duplicate the TM-2 trunk sewer between PS-1 and PS-2, and rebuild drainage at the five low points that flood.',
    mapNote: 'The map shows the upgraded PS-1, the second TM-2 main and the five drainage schemes.',
    stats: [
      { label: 'Sewerage capacity', value: '+45%' },
      { label: 'Shortfall', value: 'Closed by 2028' },
      { label: 'Cost', value: 'AED 65M–210M' },
    ],
  }),
  long: planningSolution('long', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Plan infrastructure ahead of growth',
    summary: 'Make every new phase wait for funded infrastructure, add a sewer connection from PS-3 to the Jebel Ali treatment plant, and link the three areas to the metro by bus rapid transit.',
    mapNote: 'The map shows the new trunk to Jebel Ali and the bus rapid transit route through the three areas.',
    stats: [
      { label: 'Sewerage capacity', value: '+40 ML/day' },
      { label: 'Peak car trips', value: '−30%' },
      { label: 'Cost', value: 'AED 1M–480M' },
    ],
  }),
}

const actionsLayer = (horizon: Horizon, title: string): MapDataLayer => ({
  group: 'actions',
  title,
  mark: 'point',
  color: { items: ACTIONS.filter((item) => item.horizon === horizon).map((item) => ({ label: `${item.code} ${item.action}`, color: HORIZON_COLOR[horizon] })) },
})

const proposed = (horizon: Horizon, id: string, path: LngLat[], title: string): EstateLine => ({
  id: `${horizon}-${id}`,
  path,
  color: HORIZON_COLOR[horizon],
  width: 4,
  dashed: true,
  group: 'actions',
  tip: { title, rows: [['Status', 'Proposed']] },
})

const horizonView = (horizon: Horizon, title: string, note: string, extra: { lines?: EstateLine[]; areas?: EstateArea[] } = {}): EstateAskView => {
  const marks = actionMarks(ACTIONS, horizon)
  const outlines = horizonOutlines(horizon, () => note)
  return {
    camera: AREAS_ASK_CAMERA,
    scene: scene({
      areas: [...outlines.areas, ...(extra.areas ?? [])],
      lines: [trunkLine(), ...(extra.lines ?? [])],
      points: [...stationPoints(), ...marks.points],
      labels: marks.labels,
    }),
    layers: [actionsLayer(horizon, title), LAYER.sewer],
  }
}

const drainageSchemes = (): EstateArea[] =>
  FLOODING.map((spot) => ({
    id: `drainage-${spot.id}`,
    ring: circle(spot.at, 220),
    color: HORIZON_COLOR.intermediate,
    opacity: 0.22,
    dashed: true,
    group: 'actions',
    tip: { title: 'Drainage scheme', rows: [['Clears', '50 mm storm']] },
  }))

export const INFRASTRUCTURE_ASK_VIEWS = {
  infrastructure: {
    camera: AREAS_ASK_CAMERA,
    scene: SHORTFALL_SCENE,
    layers: [LAYER.pipeline, LAYER.sewer],
  },
  'infrastructure-immediate': horizonView('immediate', 'Immediate actions', 'Approvals phased'),
  'infrastructure-intermediate': horizonView('intermediate', 'Intermediate actions', 'Upgrades brought forward', {
    lines: [proposed('intermediate', 'tm2-duplicate', TRUNK.slice(1, 4).map(([lng, lat]) => [lng, lat - 0.0012] as LngLat), 'TM-2 second main')],
    areas: drainageSchemes(),
  }),
  'infrastructure-long': horizonView('long', 'Long-term actions', 'Infrastructure-led plan', {
    lines: [
      proposed('long', 'jebel-ali', [STATIONS[2].at, [55.2385, 25.0395], [55.222, 25.032], [55.2, 25.026]], 'Sewer connection to Jebel Ali'),
      proposed('long', 'brt', [[55.19, 25.0665], [55.2095, 25.0705], [55.2225, 25.0605], [55.2295, 25.0555], [55.2455, 25.0485]], 'Bus rapid transit link'),
    ],
  }),
} satisfies Record<string, EstateAskView>

/** The briefing's figures, for the Simulate reply. */
export const INFRASTRUCTURE_BRIEFING = {
  growth: TOTAL_GROWTH,
  over: OVER,
  networks: NETWORK_COUNT,
  limit: LIMIT,
  jvcSewer: LOAD.jvc.sewer,
  ps1: STATIONS[0].load,
  floodReports: FLOOD_REPORTS,
  floodSpots: FLOODING.length,
  worstDelay: JUNCTIONS[0].delay,
  earlyHomes: EARLY_HOMES,
  pipeline: TOTALS.pipeline,
  upgradesArrive: UPGRADES_ARRIVE,
  shortfallFrom: SHORTFALL_FROM,
  peakShortfall: PEAK_SHORTFALL,
  /** Spare capacity on each area's sewerage, %, against the 20% reserve. */
  spare: AREA_LIST.map((area) => ({ label: area.short, value: 100 - LOAD[area.id].sewer })),
  /** The most loaded networks, % of design, most first. */
  loads: AREA_LIST.flatMap((area) => NETWORKS.map((network) => ({ label: `${area.short} ${NETWORK_LABEL[network].toLowerCase()}`, value: LOAD[area.id][network] })))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6),
}
