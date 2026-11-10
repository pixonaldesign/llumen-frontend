/**
 * The Unified Odor story: recycled-water irrigation odor around Al Barsha's parks, in three findings.
 * Complaints peak with the irrigation window, one recycled-water network feeds all three parks, and
 * sampling shows that water failing its quality limits. The interventions, the wind model and the
 * horizon maps serve Simulate recommended actions. Every value is an illustrative example.
 */
import { hash, offsetKm, scatter, type LngLat } from '../realEstate/estateGeo'
import type {
  EstateArea,
  EstateLabel,
  EstateLine,
  EstateMapScene,
  EstatePoint,
  EstateTower,
  EstateWind,
} from '../realEstate/estateMapLayers'
import {
  PALETTE,
  STATUS,
  type EstateAskView,
  type EstateCamera,
  type EstatePlace,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
import { BARSHA_BLOCKS } from './barshaBlocks'
import { BARSHA_HOMES } from './barshaHomes'
import { box, centroid, circle, insidePlume, plumeRing, shiftPlume, toward, type Plume } from './dmGeo'
import { HORIZON_COLOR, HORIZON_LABEL, LEVEL, toned } from './dmShared'

/* —— Al Barsha: parks, the irrigation network and the pump house —— */

/** The Pond Park pump house and its storage tank, on the park's eastern edge. */
export const PUMP_HOUSE: LngLat = [55.20578, 25.10273]

/** Evening winds from the west-north-west carry the odor this way (degrees, clockwise from north). */
const WIND_TOWARD = 112

const PARK_GREEN = PALETTE.categorical[3]
const PIPE_BLUE = PALETTE.blue[3]
const WIND_WHITE = 'rgba(236, 240, 255, 0.86)'

/** `complaints`: CRM odor complaints in 30 days; `posts`: negative posts in 30 days by the smell they describe, most first. */
type Park = { id: string; name: string; ring: LngLat[]; complaints: number; posts: [string, number][] }

const PARKS: Park[] = [
  {
    id: 'pond',
    name: 'Al Barsha Pond Park',
    ring: [
      [55.199522, 25.103499],
      [55.206078, 25.103558],
      [55.206111, 25.100308],
      [55.19962, 25.100234],
    ],
    complaints: 71,
    posts: [
      ['Rotten-egg odor', 148],
      ['Stale water smell', 100],
    ],
  },
  {
    id: 'barsha1',
    name: 'Al Barsha 1 Park',
    ring: [
      [55.185678, 25.106517],
      [55.18649, 25.10678],
      [55.187533, 25.107168],
      [55.18846, 25.107483],
      [55.189503, 25.107861],
      [55.190025, 25.107756],
      [55.189943, 25.107357],
      [55.188692, 25.107021],
      [55.187649, 25.106643],
      [55.186606, 25.106182],
      [55.185817, 25.105867],
    ],
    complaints: 29,
    posts: [
      ['Rotten-egg odor', 58],
      ['Damp, musty smell', 43],
    ],
  },
  {
    id: 'barsha3',
    name: 'Al Barsha 3 Park',
    ring: [
      [55.207278, 25.083094],
      [55.207792, 25.083094],
      [55.207792, 25.082089],
      [55.207278, 25.082089],
    ],
    complaints: 18,
    posts: [
      ['Sewage-like smell', 41],
      ['Stale water smell', 22],
    ],
  },
]

const POND = PARKS[0]

const complaintsAt = (park: Park) => park.complaints

/** Each smell the negative posts describe and how often, then the CRM complaints. */
const parkRows = (park: Park): [string, string][] => [
  ...park.posts.map(([type, count]): [string, string] => [type, `${count} posts`]),
  ['CRM complaints', `${complaintsAt(park)} in 30 days`],
]

const parkAreas = (): EstateArea[] =>
  PARKS.map((park) => ({
    id: `park-${park.id}`,
    ring: park.ring,
    color: PARK_GREEN,
    opacity: 0.2,
    outlineWidth: 3,
    group: 'parks',
    tip: { title: park.name, rows: parkRows(park) },
  }))

/** Each park's complaints, held open over it; `pinned: false` leaves a roof label with the total. */
const parkLabels = (pinned = true): EstateLabel[] =>
  PARKS.map((park) => ({
    id: `label-${park.id}`,
    at: centroid(park.ring),
    heightM: 6,
    color: PARK_GREEN,
    title: park.name,
    text: `${complaintsAt(park)} odor complaints · 30 days`,
    rows: pinned ? parkRows(park) : undefined,
    group: 'parks',
  }))

/* Irrigation zones, fed by recycled (TSE) water through the park ring mains. */

type ZoneId = 'z1' | 'z2' | 'z3' | 'z4' | 'z5'

const ZONES: Record<ZoneId, { name: string; ring: LngLat[]; schedule: string }> = {
  z1: { name: 'Zone Z-1 · Pond Park west', ring: box([55.19958, 25.10028], [55.2028, 25.10351]), schedule: '17:00–19:30' },
  z2: { name: 'Zone Z-2 · Pond Park east', ring: box([55.2028, 25.10031], [55.20606, 25.10354]), schedule: '17:30–20:00' },
  z3: { name: 'Zone Z-3 · Eastern streetscape', ring: box([55.20628, 25.0975], [55.20688, 25.1075]), schedule: '17:30–20:00' },
  z4: { name: 'Zone Z-4 · Al Barsha 1 Park', ring: PARKS[1].ring, schedule: '17:00–19:00' },
  z5: { name: 'Zone Z-5 · Al Barsha 3 Park', ring: PARKS[2].ring, schedule: '17:00–18:30' },
}

function zoneArea(id: ZoneId, color: string, status: string, opacity = 0.26, dashed = false): EstateArea {
  const zone = ZONES[id]
  return {
    id: `zone-${id}`,
    ring: zone.ring,
    color,
    opacity,
    dashed,
    group: 'zones',
    tip: { title: zone.name, rows: [['Irrigation', zone.schedule], ['Status', status]] },
  }
}

const SUPPLY_MAIN: LngLat[] = [
  [55.19932, 25.0826],
  [55.19932, 25.10024],
  [55.1997, 25.10045],
]
/** Branches off the supply main and the ring main to the other two parks. */
const BARSHA3_BRANCH: LngLat[] = [
  [55.19932, 25.0826],
  [55.20728, 25.0826],
]
const BARSHA1_BRANCH: LngLat[] = [
  [55.1997, 25.10335],
  [55.193, 25.105],
  [55.18975, 25.10765],
]
const RING_MAIN: LngLat[] = [
  [55.1997, 25.10045],
  [55.1997, 25.10335],
  [55.2059, 25.10338],
  [55.2059, 25.10045],
  [55.1997, 25.10045],
]
const EAST_NORTH: LngLat[] = [
  [55.2066, 25.10045],
  [55.2066, 25.1075],
]
const EAST_SOUTH: LngLat[] = [
  [55.2066, 25.10045],
  [55.2066, 25.0975],
]
const EAST_SPUR: LngLat[] = [
  [55.2066, 25.10017],
  [55.2112, 25.1004],
]
const BARSHA1_MAIN: LngLat[] = [
  [55.18575, 25.10622],
  [55.18765, 25.10692],
  [55.18975, 25.10765],
]

function networkLines(color: string = PIPE_BLUE, highlight: Partial<Record<'ring' | 'east' | 'supply', string>> = {}): EstateLine[] {
  const pipe = (id: string, path: LngLat[], title: string, rows: [string, string][], tint = color, width = 2.5): EstateLine => ({
    id,
    path,
    color: tint,
    width,
    group: 'network',
    tip: { title, rows },
  })
  return [
    pipe('supply', SUPPLY_MAIN, 'TSE supply main', [['Source', 'Jebel Ali treatment plant'], ['Diameter', '450 mm']], highlight.supply ?? color, 3.5),
    pipe('ring', RING_MAIN, 'Pond Park ring main', [['Residence time', '4.6 days'], ['Target', 'under 2 days']], highlight.ring ?? color),
    pipe('east-north', EAST_NORTH, 'Eastern streetscape line', [['Dead-ends', '2'], ['Flow at night', '0.4 L/s']], highlight.east ?? color, 2),
    pipe('east-south', EAST_SOUTH, 'Eastern streetscape line', [['Dead-ends', '1'], ['Flow at night', '0.6 L/s']], highlight.east ?? color, 2),
    pipe('east-spur', EAST_SPUR, 'Al Barsha 2 spur', [['Residence time', '3.1 days']], highlight.east ?? color, 2),
    pipe('barsha1-branch', BARSHA1_BRANCH, 'Al Barsha 1 branch', [['Fed from', 'Pond Park ring main'], ['Diameter', '200 mm']], color, 2.5),
    pipe('barsha1', BARSHA1_MAIN, 'Al Barsha 1 Park main', [['Residence time', '1.4 days']], color, 2),
    pipe('barsha3-branch', BARSHA3_BRANCH, 'Al Barsha 3 branch', [['Fed from', 'TSE supply main'], ['Diameter', '200 mm']], color, 2.5),
  ]
}

type Tank = { id: string; name: string; site: string; park: string; at: LngLat }

/** One recycled-water storage tank per park, all filled from the same TSE supply main. */
const TANKS = {
  t1: { id: 't1', name: 'Storage tank T-1', site: 'Al Barsha 1 Park', park: 'Al Barsha 1 Park', at: [55.18985, 25.10752] },
  t3: { id: 't3', name: 'Storage tank T-3', site: 'Pond Park pump house', park: 'Al Barsha Pond Park', at: PUMP_HOUSE },
  t5: { id: 't5', name: 'Storage tank T-5', site: 'Al Barsha 3 Park', park: 'Al Barsha 3 Park', at: [55.20755, 25.08258] },
} satisfies Record<string, Tank>

/** A storage tank, lit in `color`; T-3 in the pump house unless another is given. */
function tankTower(color: string, text: string, rows: [string, string][], tank: Tank = TANKS.t3): EstateTower {
  return {
    id: `tank-${tank.id}`,
    featureId: 0,
    at: tank.at,
    heightM: 9,
    color,
    state: 'select',
    footprint: circle(tank.at, 9),
    label: true,
    title: tank.name,
    text,
    tip: { title: `${tank.name} · ${tank.site}`, rows },
    group: 'source',
  }
}

const SUSPECT_TANK = tankTower(STATUS.critical, 'Suspected source · H₂S 0.42 mg/L', [
  ['H₂S at outlet', '0.42 mg/L'],
  ['Last cleaned', 'Mar 2025'],
])

/* —— Who the wind reaches: the plume and the homes inside it —— */

const PLUME: Plume = { source: PUMP_HOUSE, bearing: WIND_TOWARD, lengthKm: 1.45, widthKm: 0.42 }

type Bands = { high: Plume; moderate: Plume; low: Plume }

/** The modelled plume's three exposure bands, scaled and turned together by a what-if. */
function bands(scale = 1, turn = 0): Bands {
  const low = shiftPlume(PLUME, scale, turn)
  return {
    low,
    moderate: { ...low, lengthKm: low.lengthKm * 0.655, widthKm: low.widthKm * 0.714 },
    high: { ...low, lengthKm: low.lengthKm * 0.345, widthKm: low.widthKm * 0.381 },
  }
}

const BASELINE = bands()

const PLUME_COLOR = { high: STATUS.critical, moderate: PALETTE.categorical[5], low: PALETTE.categorical[4] }

function plumeAreas(plume: Bands, group = 'plume'): EstateArea[] {
  const area = (band: keyof Bands, opacity: number, title: string, hours: string): EstateArea => ({
    id: `${group}-${band}`,
    ring: plumeRing(plume[band]),
    color: PLUME_COLOR[band],
    opacity,
    group,
    tip: { title, rows: [['Modelled odor-hours', hours]] },
  })
  return [
    area('low', 0.1, 'Low exposure band', '2–6 a month'),
    area('moderate', 0.14, 'Moderate exposure band', '6–14 a month'),
    area('high', 0.22, 'High exposure band', 'over 14 a month'),
  ]
}

/** The baseline plume's outline, dashed, under a what-if's own plume. */
const BASELINE_OUTLINE: EstateArea = {
  id: 'baseline-outline',
  ring: plumeRing(BASELINE.low),
  color: 'rgba(255, 255, 255, 0.78)',
  opacity: 0,
  dashed: true,
  group: 'baseline',
  tip: { title: 'Baseline odor plume', rows: [['Residents inside', '1,850']] },
}

/** The evening wind as streamlines over the park, the source and the homes it reaches. */
function windField(bearing = WIND_TOWARD): EstateWind {
  return { center: toward(PUMP_HOUSE, WIND_TOWARD, 0.35), radiusKm: 2.2, bearing, color: WIND_WHITE, group: 'wind' }
}

const HOMES = BARSHA_HOMES.map((ring, index) => ({ index, ring, at: centroid(ring) }))

type HomeState = { color: string; status: string }

function homeTowers(state: (home: (typeof HOMES)[number]) => HomeState): EstateTower[] {
  return HOMES.map((home) => {
    const { color, status } = state(home)
    return {
      id: `home-${home.index}`,
      featureId: 0,
      at: home.at,
      heightM: 3,
      color,
      state: 'select',
      footprint: home.ring,
      label: false,
      title: 'Residential villa',
      text: status,
      tip: { title: 'Residential villa', rows: [['Exposure', status]] },
      group: 'homes',
    }
  })
}

/** Inside the high band, inside the moderate one, or clear of both. */
const bandOf = (plume: Bands, at: LngLat) =>
  insidePlume(plume.high, at) ? 'high' : insidePlume(plume.moderate, at) ? 'moderate' : 'clear'

const EXPOSED_HOMES = homeTowers((home) =>
  bandOf(BASELINE, home.at) === 'high'
    ? { color: STATUS.critical, status: 'High' }
    : { color: PALETTE.diverging[2], status: 'Moderate' },
)

/** Homes after a what-if: still exposed in its plume, or clear of it and benefiting. */
function homesAfter(plume: Bands, benefit = HORIZON_COLOR.immediate) {
  return homeTowers((home) => {
    const band = bandOf(plume, home.at)
    if (band === 'high') return { color: STATUS.critical, status: 'Still high' }
    if (band === 'moderate') return { color: PALETTE.diverging[2], status: 'Still moderate' }
    return { color: benefit, status: 'Benefits · clear of the plume' }
  })
}

/* —— What residents report —— */

/** Where negative posts about odor were made: densest downwind of the pump house and around the three parks. */
const POST_SITES: { at: LngLat; weight: number }[] = [
  ...scatter(toward(PUMP_HOUSE, WIND_TOWARD, 0.45), 70, 0.55, 3)
    .filter((at) => insidePlume(BASELINE.low, at))
    .map((at, index) => ({ at, weight: 0.45 + 0.5 * hash(index, 4) })),
  ...scatter(centroid(POND.ring), 30, 0.35, 5).map((at, index) => ({ at, weight: 0.35 + 0.4 * hash(index, 6) })),
  ...scatter(centroid(PARKS[1].ring), 22, 0.3, 7).map((at) => ({ at, weight: 0.45 })),
  ...scatter(centroid(PARKS[2].ring), 16, 0.25, 9).map((at) => ({ at, weight: 0.4 })),
]

/** Fewest posts to most: dim purple up to bright purple, then orange, each block one shade. */
const POST_SHADES: { color: string; opacity: number }[] = [
  { color: PALETTE.purple[0], opacity: 0.3 },
  { color: PALETTE.purple[2], opacity: 0.4 },
  { color: PALETTE.purple[3], opacity: 0.55 },
  { color: PALETTE.categorical[5], opacity: 0.4 },
  { color: PALETTE.categorical[5], opacity: 0.68 },
]

const POSTS_RAMP = [PALETTE.purple[0], PALETTE.purple[3], PALETTE.categorical[5]]

const M_PER_DEG = { lng: 100780, lat: 110574 }
const POST_REACH_M = 230

/** The posts made in and near a block, weighed by how far from it they were made. */
const postsNear = (at: LngLat) =>
  POST_SITES.reduce((sum, site) => {
    const dx = (site.at[0] - at[0]) * M_PER_DEG.lng
    const dy = (site.at[1] - at[1]) * M_PER_DEG.lat
    return sum + site.weight * Math.exp(-(dx * dx + dy * dy) / (2 * POST_REACH_M ** 2))
  }, 0)

/**
 * Each street block with posts, shaded by how it ranks among them so every park's blocks span the shades;
 * blocks with almost none are left clear.
 */
const SOCIAL_BLOCKS: EstateArea[] = (() => {
  const blocks = BARSHA_BLOCKS.map((ring) => {
    const samples = [centroid(ring), ...ring]
    return { ring, density: samples.reduce((sum, at) => sum + postsNear(at), 0) / samples.length }
  })
  const peak = Math.max(...blocks.map((block) => block.density))
  const shown = blocks.filter((block) => block.density >= 0.04 * peak)
  const ranked = shown.map((block) => block.density).sort((a, b) => a - b)
  const sum = ranked.reduce((total, density) => total + density, 0)
  const posts = PARKS.reduce((total, park) => total + park.posts.reduce((count, [, n]) => count + n, 0), 0)
  return shown.map((block, index) => {
    const rank = ranked.indexOf(block.density) / ranked.length
    const shade = POST_SHADES[Math.floor(rank * POST_SHADES.length)]
    return {
      id: `posts-${index}`,
      ring: block.ring,
      ...shade,
      outlineWidth: 1,
      group: 'social',
      tip: { title: 'Street block', rows: [['Negative posts', `${Math.max(1, Math.round((posts * block.density) / sum))} in 30 days`]] },
    }
  })
})()

/* —— Sampling —— */

type Sample = { id: string; name: string; at: LngLat; h2s: number; oxygen: number }

const SAMPLES: Sample[] = [
  { id: 's1', name: 'T-3 outlet', at: [55.20592, 25.10262], h2s: 0.42, oxygen: 0.8 },
  { id: 's2', name: 'Ring main, east', at: [55.2059, 25.1016], h2s: 0.21, oxygen: 1.9 },
  { id: 's3', name: 'Z-2 emitters', at: [55.2045, 25.101], h2s: 0.18, oxygen: 2.4 },
  { id: 's4', name: 'Eastern streetscape dead-end', at: [55.2066, 25.1072], h2s: 0.24, oxygen: 1.6 },
  { id: 's5', name: 'Z-1 emitters', at: [55.2008, 25.1026], h2s: 0.05, oxygen: 4.6 },
  { id: 's6', name: 'Supply main inlet', at: [55.19932, 25.0975], h2s: 0.02, oxygen: 6.2 },
  { id: 's7', name: 'T-1 outlet', at: [55.18998, 25.10742], h2s: 0.16, oxygen: 2.1 },
  { id: 's8', name: 'T-5 outlet', at: [55.20742, 25.08268], h2s: 0.12, oxygen: 2.6 },
]

/** The recycled-water irrigation limits the samples are held to (illustrative). */
const LIMIT = { h2s: 0.05, oxygen: 2 }

const meetsLimit = (sample: Sample) => sample.h2s <= LIMIT.h2s && sample.oxygen >= LIMIT.oxygen
const FAILING = SAMPLES.filter((sample) => !meetsLimit(sample))
const WORST = SAMPLES.reduce((worst, sample) => (sample.h2s > worst.h2s ? sample : worst))
const timesLimit = (sample: Sample) => `${(sample.h2s / LIMIT.h2s).toFixed(1)}×`

const sampleColor = (sample: Sample) => (sample.h2s >= 0.3 ? STATUS.critical : meetsLimit(sample) ? LEVEL.ok : LEVEL.high)

const samplePoints = (): EstatePoint[] =>
  SAMPLES.map((sample) => ({
    id: `sample-${sample.id}`,
    at: sample.at,
    color: sampleColor(sample),
    radius: 6.5,
    group: 'sampling',
    tip: {
      title: `Sample · ${sample.name}`,
      rows: [
        ['H₂S', `${sample.h2s.toFixed(2)} mg/L · limit ${LIMIT.h2s}`],
        ['Dissolved oxygen', `${sample.oxygen.toFixed(1)} mg/L · min ${LIMIT.oxygen}`],
        ['Status', meetsLimit(sample) ? 'Meets the standard' : 'Exceeds the standard'],
      ],
    },
  }))

/* —— The nine interventions —— */

type Intervention = {
  code: string
  horizon: Horizon
  action: string
  asset: string
  benefit: string
  /** Where on the map the action lands. */
  at: LngLat
  /** Share of modelled residential exposure it removes, cost, and how long the benefit lasts. */
  reduction: number
  cost: string
  perHour: number
  sustainability: 'Low' | 'Medium' | 'High'
}

export const INTERVENTIONS: Intervention[] = [
  {
    code: 'I1',
    horizon: 'immediate',
    action: 'Optimize irrigation timing',
    asset: 'Zones Z-2 and Z-3 controllers',
    benefit: 'Irrigate when the wind carries less odor toward homes',
    at: [55.2049, 25.1029],
    reduction: 41,
    cost: 'AED 25k',
    perHour: 116,
    sustainability: 'Medium',
  },
  {
    code: 'I2',
    horizon: 'immediate',
    action: 'Flush irrigation pipelines',
    asset: 'Ring main and eastern lines',
    benefit: 'Remove stagnant water from the network',
    at: [55.2066, 25.1052],
    reduction: 22,
    cost: 'AED 60k',
    perHour: 470,
    sustainability: 'Low',
  },
  {
    code: 'I3',
    horizon: 'immediate',
    action: 'Temporarily isolate affected zones',
    asset: 'Zones Z-2 and Z-3',
    benefit: 'Stop or redirect the suspected source',
    at: [55.20658, 25.0992],
    reduction: 55,
    cost: 'AED 40k',
    perHour: 160,
    sustainability: 'Low',
  },
  {
    code: 'M1',
    horizon: 'intermediate',
    action: 'Clean and rehabilitate storage tanks',
    asset: 'Storage tank T-3',
    benefit: 'Address stagnation and sediment at the source',
    at: PUMP_HOUSE,
    reduction: 48,
    cost: 'AED 320k',
    perHour: 1150,
    sustainability: 'Medium',
  },
  {
    code: 'M2',
    horizon: 'intermediate',
    action: 'Improve recycled-water quality',
    asset: 'Dosing at the supply inlet',
    benefit: 'Targeted odor-control treatment before the parks',
    at: [55.19932, 25.0995],
    reduction: 52,
    cost: 'AED 540k',
    perHour: 1800,
    sustainability: 'Medium',
  },
  {
    code: 'M3',
    horizon: 'intermediate',
    action: 'Install smart irrigation controls',
    asset: '14 controllers, Zones Z-1 to Z-3',
    benefit: 'Adjust operations to weather and water-quality readings',
    at: [55.2012, 25.1018],
    reduction: 46,
    cost: 'AED 410k',
    perHour: 1500,
    sustainability: 'High',
  },
  {
    code: 'L1',
    horizon: 'long',
    action: 'Upgrade water treatment',
    asset: 'TSE polishing for the Al Barsha supply',
    benefit: 'Reduce odor-generating compounds before distribution',
    at: [55.19932, 25.0955],
    reduction: 78,
    cost: 'AED 6.5M',
    perHour: 14500,
    sustainability: 'High',
  },
  {
    code: 'L2',
    horizon: 'long',
    action: 'Redesign irrigation distribution',
    asset: 'Looped mains, dead-ends removed',
    benefit: 'Keep water moving so it cannot stagnate',
    at: [55.2085, 25.1028],
    reduction: 70,
    cost: 'AED 4.2M',
    perHour: 10400,
    sustainability: 'High',
  },
  {
    code: 'L3',
    horizon: 'long',
    action: 'Introduce predictive odor management',
    asset: '36 odor and water-quality sensors',
    benefit: 'Anticipate and prevent recurring exposure',
    at: [55.2108, 25.0985],
    reduction: 63,
    cost: 'AED 1.8M',
    perHour: 4900,
    sustainability: 'High',
  },
]

const actionTitle = (item: Intervention) => `${item.code} · ${item.action}`
const actionRows = (item: Intervention): [string, string][] => [
  ['Acts on', item.asset],
  ['Horizon', HORIZON_LABEL[item.horizon]],
]

function actionPoints(horizons: Horizon[] = ['immediate', 'intermediate', 'long'], pinned = false): EstatePoint[] {
  return INTERVENTIONS.filter((item) => horizons.includes(item.horizon)).map((item) => ({
    id: `action-${item.code}`,
    at: item.at,
    color: HORIZON_COLOR[item.horizon],
    radius: 7,
    group: 'actions',
    tip: pinned ? undefined : { title: actionTitle(item), rows: actionRows(item) },
  }))
}

/** One horizon's interventions, their tooltips held open over their points. */
function actionTips(horizon: Horizon): EstateLabel[] {
  return INTERVENTIONS.filter((item) => item.horizon === horizon).map((item) => ({
    id: `action-tip-${item.code}`,
    at: item.at,
    heightM: 0,
    color: HORIZON_COLOR[horizon],
    title: actionTitle(item),
    text: '',
    rows: actionRows(item),
    group: 'actions',
  }))
}

/* —— Map Data —— */

const LAYER = {
  social: { group: 'social', title: 'Social media hotspots', mark: 'area', color: { ramp: POSTS_RAMP, low: 'Fewer posts', high: 'More' } },
  parks: {
    group: 'parks',
    title: 'Parks · CRM odor complaints, 30 days',
    mark: 'area',
    color: { items: PARKS.map((park) => ({ label: park.name, color: PARK_GREEN, count: `${complaintsAt(park)}` })) },
  },
  zones: {
    group: 'zones',
    title: 'Irrigation zones',
    mark: 'area',
    color: {
      items: [
        { label: 'Suspected (Z-2, Z-3)', color: STATUS.critical },
        { label: 'Under watch (Z-1)', color: LEVEL.watch },
        { label: 'Normal (Z-4, Z-5)', color: LEVEL.ok },
      ],
    },
  },
  network: { group: 'network', title: 'Irrigation network assets', mark: 'line', color: { items: [{ label: 'Recycled-water mains', color: PIPE_BLUE }] } },
  tanks: {
    group: 'source',
    title: 'Recycled-water storage tanks',
    mark: 'tower',
    color: { items: Object.values(TANKS).map((tank) => ({ label: `${tank.name.slice(-3)} · ${tank.park}`, color: PIPE_BLUE })) },
  },
  sampling: {
    group: 'sampling',
    title: 'Water sampling locations',
    mark: 'point',
    color: {
      items: [
        { label: 'Far over the limit', color: STATUS.critical, count: `${SAMPLES.filter((sample) => sampleColor(sample) === STATUS.critical).length}` },
        { label: 'Exceeds the standard', color: LEVEL.high, count: `${SAMPLES.filter((sample) => sampleColor(sample) === LEVEL.high).length}` },
        { label: 'Meets the standard', color: LEVEL.ok, count: `${SAMPLES.filter(meetsLimit).length}` },
      ],
    },
  },
  source: {
    group: 'source',
    title: 'Suspected odor source',
    mark: 'tower',
    color: { items: [{ label: 'Storage tank T-3', color: STATUS.critical, count: '0.42 mg/L' }] },
  },
  plume: {
    group: 'plume',
    title: 'Modelled wind-driven dispersion',
    mark: 'area',
    color: {
      items: [
        { label: 'High exposure', color: PLUME_COLOR.high },
        { label: 'Moderate', color: PLUME_COLOR.moderate },
        { label: 'Low', color: PLUME_COLOR.low },
      ],
    },
  },
  homes: {
    group: 'homes',
    title: 'Residential buildings exposed',
    mark: 'tower',
    color: {
      items: [
        { label: 'High exposure', color: STATUS.critical, count: `${EXPOSED_HOMES.filter((home) => home.color === STATUS.critical).length}` },
        { label: 'Moderate', color: PALETTE.diverging[2], count: `${EXPOSED_HOMES.filter((home) => home.color !== STATUS.critical).length}` },
      ],
    },
  },
  actions: {
    group: 'actions',
    title: 'Where each intervention acts',
    mark: 'point',
    color: { items: (['immediate', 'intermediate', 'long'] as const).map((horizon) => ({ label: HORIZON_LABEL[horizon], color: HORIZON_COLOR[horizon], count: '3' })) },
  },
} satisfies Record<string, MapDataLayer>

/* —— Scenes —— */

const scene = (parts: Partial<EstateMapScene>): EstateMapScene => ({
  towers: [],
  heat: [],
  heatRadiusM: 140,
  heatRamp: POSTS_RAMP,
  ...parts,
})

const ZONES_UNDER_SUSPICION = (): EstateArea[] => [
  zoneArea('z1', LEVEL.watch, 'Under watch'),
  zoneArea('z2', STATUS.critical, 'Suspected · odor at emitters'),
  zoneArea('z3', STATUS.critical, 'Suspected · stagnant dead-ends', 0.4),
  zoneArea('z4', LEVEL.ok, 'Normal'),
  zoneArea('z5', LEVEL.ok, 'Normal'),
]

const DETECTED_SCENE = scene({
  areas: [...SOCIAL_BLOCKS, ...parkAreas()],
  labels: parkLabels(),
})

const NETWORK_SCENE = scene({
  towers: Object.values(TANKS).map((tank) =>
    tankTower(PIPE_BLUE, `Feeds ${tank.park}`, [['Supplies', tank.park], ['Filled from', 'TSE supply main']], tank),
  ),
  areas: parkAreas(),
  lines: networkLines(),
  labels: parkLabels(false),
})

const outletOf = (tank: Tank) => SAMPLES.find((sample) => sample.name === `${tank.name.slice(-3)} outlet`)!
/** Only T-3 is in the quality camera's view; the other tanks keep their tooltips without a label. */
const tankQuality = (tank: Tank): EstateTower => {
  const outlet = outletOf(tank)
  const tower = tankTower(sampleColor(outlet), `Exceeds · H₂S ${outlet.h2s.toFixed(2)} mg/L`, [['H₂S at outlet', `${outlet.h2s.toFixed(2)} mg/L`], ['Against the limit', timesLimit(outlet)]], tank)
  return { ...tower, label: tank === TANKS.t3 }
}

const QUALITY_SCENE = scene({
  towers: Object.values(TANKS).map(tankQuality),
  areas: ZONES_UNDER_SUSPICION(),
  lines: networkLines(),
  points: samplePoints(),
})

/* —— Simulate recommended actions: each horizon's what-if against the baseline —— */

const LAB_LAYERS: MapDataLayer[] = [
  { ...LAYER.zones, title: 'Affected irrigation zones', color: { items: [{ label: 'Today’s schedule', color: STATUS.critical }, { label: 'Retimed', color: HORIZON_COLOR.immediate }] } },
  {
    group: 'plume',
    title: 'Baseline vs simulated dispersion',
    mark: 'area',
    color: { items: [{ label: 'Simulated plume', color: PLUME_COLOR.moderate }, { label: 'Baseline outline', color: 'rgba(255, 255, 255, 0.78)' }] },
  },
  {
    group: 'homes',
    title: 'Residential buildings',
    mark: 'tower',
    color: {
      items: [
        { label: 'Benefiting', color: HORIZON_COLOR.immediate },
        { label: 'Still moderate', color: PALETTE.diverging[2] },
        { label: 'Still high', color: STATUS.critical },
      ],
    },
  },
]

/** The plume left by each horizon's best option. */
const RESIDUAL: Record<Horizon, Bands> = {
  immediate: bands(0.6, 14),
  intermediate: bands(0.45),
  long: bands(0.2),
}

/* —— The story —— */

const CAMERA = {
  timing: { center: [55.19886, 25.10413], zoom: 15.67, pitch: 64.5, bearing: -21.2 },
  network: { center: [55.20624, 25.09475], zoom: 15.24, pitch: 61.5, bearing: -18 },
  quality: { center: [55.2032, 25.1017], zoom: 15.75, pitch: 60, bearing: 24 },
} satisfies Record<string, EstateCamera>

const FILTERS = ['Al Barsha', 'Last 30 days', 'Odor']

/** The assumed irrigation window across the three parks. */
const IRRIGATION_WINDOW = '5–8 PM'

/** CRM odor complaints in 30 days by time of day; the 5–8 PM band is the irrigation window. */
const BY_TIME_OF_DAY: { label: string; value: number; irrigating?: boolean }[] = [
  { label: '6–9 AM', value: 8 },
  { label: '9–12 PM', value: 6 },
  { label: '12–3 PM', value: 10 },
  { label: '3–5 PM', value: 12 },
  { label: '5–8 PM', value: 64, irrigating: true },
  { label: '8–11 PM', value: 14 },
  { label: '11–6 AM', value: 4 },
]
const IN_WINDOW = BY_TIME_OF_DAY.filter((band) => band.irrigating).reduce((sum, band) => sum + band.value, 0)
const ALL_COMPLAINTS = BY_TIME_OF_DAY.reduce((sum, band) => sum + band.value, 0)

/** Negative odor mentions and CRM complaints a week, oldest first: 412 mentions in the last four weeks, up 64%. */
export const MENTIONS_BY_WEEK = [38, 41, 44, 47, 52, 58, 66, 75, 88, 97, 106, 121]
export const CRM_BY_WEEK = [4, 5, 4, 6, 7, 8, 9, 11, 13, 14, 17, 20]

export const ODOR_STORY: EstateStory = {
  id: 'dm-odor',
  title: 'Unified Odor Use Case',
  description:
    'How LLUMEN links odor complaints around three Al Barsha parks to their irrigation hours, traces all three to one recycled-water network, and confirms that water fails its quality standard. The same agent investigates odor from oil spills, waste or sewerage.',
  place: 'barsha',
  pages: [
    {
      id: 'dm-odor-timing',
      title: 'Temporal Correlation Identified',
      finding:
        'Analysis of irrigation schedules and CRM complaint timestamps across the three Al Barsha parks indicates that odor complaints consistently peak during or shortly after scheduled irrigation hours, suggesting a potential link between irrigation activities and unpleasant odors.',
      camera: CAMERA.timing,
      scene: DETECTED_SCENE,
      filters: FILTERS,
      layers: [LAYER.social, LAYER.parks],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Odor complaints at all three parks peak during the ',
            { em: [`${IRRIGATION_WINDOW} irrigation window`] },
            ': ',
            { em: [`${IN_WINDOW} of ${ALL_COMPLAINTS} complaints`] },
            ' in 30 days, falling away within an hour of the sprinklers stopping. Irrigation may be linked to the odor.',
          ],
        },
        { id: 'complaints', kind: 'cell', title: 'CRM odor complaints', value: `${ALL_COMPLAINTS}`, note: 'in 30 days, at 3 parks' },
        { id: 'window', kind: 'cell', title: 'During irrigation', value: `${Math.round((IN_WINDOW / ALL_COMPLAINTS) * 100)}%`, note: `of complaints, ${IRRIGATION_WINDOW}, 3 hours of 24` },
        { id: 'affected', kind: 'cell', title: 'Affected parks', value: '3', note: 'of 7 in Al Barsha' },
        { id: 'mentions', kind: 'cell', title: 'Negative social mentions', value: '412', note: '+64% vs prior 30 days' },
        {
          id: 'time-of-day',
          kind: 'vbars',
          title: 'Odor complaints by time of day',
          kpi: { value: `${IN_WINDOW}`, unit: `in the ${IRRIGATION_WINDOW} irrigation window` },
          bars: BY_TIME_OF_DAY.map((band) => ({ label: band.label, value: band.value, color: band.irrigating ? undefined : 'rgba(255, 255, 255, 0.24)' })),
        },
        {
          id: 'timing',
          kind: 'line',
          title: 'Complaints vs irrigation hours',
          height: 2,
          kpi: { value: '0.81', unit: 'correlation, last 30 days' },
          x: ['12 PM', '3 PM', '6 PM', '9 PM', '12 AM'],
          yLabels: ['100', '80', '60', '40', '20', '0'],
          yMax: 100,
          series: [
            { name: 'Irrigation flow', points: [0, 0, 0, 0, 0, 34, 90, 94, 82, 12, 0, 0, 0] },
            { name: 'Odor complaints', points: [9, 7, 8, 11, 13, 24, 62, 88, 84, 42, 18, 9, 6] },
          ],
        },
        {
          id: 'parks',
          kind: 'hbars',
          title: 'CRM complaints by park, 30 days',
          bars: PARKS.map((park) => ({ label: park.name, value: complaintsAt(park), display: `${complaintsAt(park)}` })),
        },
      ]),
    },
    {
      id: 'dm-odor-network',
      title: 'Recycled Water Supply Network Identified',
      finding:
        'GIS analysis of the irrigation network confirms that all three affected parks are supplied with recycled water through connected irrigation pipelines and storage tanks, identifying a common potential source of the odor issue.',
      camera: CAMERA.network,
      scene: NETWORK_SCENE,
      filters: FILTERS,
      layers: [LAYER.network, LAYER.tanks, LAYER.parks],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'GIS tracing shows ',
            { em: ['all three parks'] },
            ' draw recycled (TSE) water from ',
            { em: ['one supply main'] },
            ', each through its own storage tank. The shared network is a common potential source of the odor.',
          ],
        },
        { id: 'connected', kind: 'cell', title: 'Parks on the network', value: '3 of 3', note: 'all irrigated with recycled water' },
        { id: 'tanks', kind: 'cell', title: 'Storage tanks', value: `${Object.keys(TANKS).length}`, note: 'one per park, filled from the same main' },
        {
          id: 'supply',
          kind: 'table',
          title: 'How each park is supplied',
          columns: ['Park', 'Tank', 'Irrigates'],
          dotColumn: 0,
          rows: [
            { cells: ['Al Barsha Pond Park', 'T-3', '5:30–8 PM'], color: PARK_GREEN },
            { cells: ['Al Barsha 1 Park', 'T-1', '5–7 PM'], color: PARK_GREEN },
            { cells: ['Al Barsha 3 Park', 'T-5', '5–6:30 PM'], color: PARK_GREEN },
          ],
        },
        {
          id: 'trace',
          kind: 'specs',
          title: 'Network traced',
          items: [
            ['Water source', 'TSE, Jebel Ali plant'],
            ['Water age', '4.6 days'],
          ],
        },
      ]),
    },
    {
      id: 'dm-odor-quality',
      title: 'Water Quality Non-Compliance Confirmed',
      finding:
        'Subsequent water sampling and laboratory analysis reveal that recycled irrigation water does not meet the required quality standards, with exceedances in odor-related water-quality parameters, indicating a potential contribution to the recurring unpleasant odors.',
      camera: CAMERA.quality,
      scene: QUALITY_SCENE,
      filters: FILTERS,
      layers: [
        LAYER.sampling,
        { ...LAYER.tanks, color: { items: Object.values(TANKS).map((tank) => ({ label: tank.name, color: sampleColor(outletOf(tank)), count: timesLimit(outletOf(tank)) })) } },
        LAYER.network,
        LAYER.zones,
      ],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { em: [`${FAILING.length} of ${SAMPLES.length} samples`] },
            ' fail the recycled-water standard. Hydrogen sulphide at the ',
            { em: [WORST.name] },
            ` is ${timesLimit(WORST)} the limit and all three tanks exceed it, while water entering from the supply main meets it.`,
          ],
        },
        { id: 'failing', kind: 'cell', title: 'Non-compliant samples', value: `${FAILING.length} of ${SAMPLES.length}`, note: 'against the H₂S and oxygen limits', status: 'critical' },
        { id: 'worst', kind: 'cell', title: 'Worst exceedance', value: timesLimit(WORST), note: `H₂S at the ${WORST.name}, against ${LIMIT.h2s} mg/L` },
        {
          id: 'samples',
          kind: 'table',
          title: 'Water-quality results vs the standard',
          height: 2,
          columns: ['Site', 'H₂S mg/L', 'DO mg/L', 'Status'],
          dotColumn: 0,
          rows: SAMPLES.map((sample) => ({
            cells: [sample.name, sample.h2s.toFixed(2), sample.oxygen.toFixed(1), meetsLimit(sample) ? 'Meets' : 'Exceeds'],
            color: sampleColor(sample),
          })),
        },
        {
          id: 'exceedance',
          kind: 'hbars',
          title: `H₂S against the ${LIMIT.h2s} mg/L limit`,
          bars: [...FAILING]
            .sort((a, b) => b.h2s - a.h2s)
            .slice(0, 5)
            .map((sample) => ({ label: sample.name, value: sample.h2s, display: timesLimit(sample), color: sampleColor(sample) })),
        },
        {
          id: 'inspection',
          kind: 'specs',
          title: 'Field inspection findings, Zone Z-2',
          items: [
            ['Water age', '4.6 days'],
            ['Dead-ends', '3, eastern lines'],
            ['Odor at vent', 'Strong'],
          ],
        },
        {
          id: 'conclusion',
          kind: 'note',
          title: 'Preliminary conclusion',
          text: 'The combined findings suggest that recycled irrigation water may be contributing to odor complaints across the three parks, requiring corrective action and further source verification.',
        },
      ]),
    },
  ],
}

/* —— The Briefing place, and Tell Me More's views: the problem, then one map per impact horizon —— */

export const ODOR_PLACE: EstatePlace = {
  id: 'barsha',
  camera: { center: [55.21084, 25.10088], zoom: 14.2, pitch: 60, bearing: -30 },
  scene: scene({
    towers: [SUSPECT_TANK, ...EXPOSED_HOMES],
    areas: [...SOCIAL_BLOCKS, ...parkAreas(), ...plumeAreas(BASELINE)],
    labels: [parkLabels(false)[0]],
  }),
}

/** Isolating Zone Z-3 for I3: shown greyed out, its supply valved off. */
const ISOLATED_Z3 = zoneArea('z3', LEVEL.muted, 'Isolated · supply valved off', 0.18, true)

const OVERVIEW: EstateAskView = {
  camera: { center: [55.2072, 25.1008], zoom: 15.6, pitch: 62, bearing: -20 },
  scene: scene({
    towers: [SUSPECT_TANK, ...EXPOSED_HOMES],
    areas: [...SOCIAL_BLOCKS, ...plumeAreas(BASELINE), parkAreas()[0]],
    wind: windField(),
    labels: [parkLabels()[0]],
  }),
  layers: [LAYER.source, LAYER.plume, LAYER.homes, LAYER.parks, LAYER.social],
}

const IMMEDIATE: EstateAskView = {
  camera: { center: [55.2068, 25.1012], zoom: 15.7, pitch: 62, bearing: 12 },
  scene: scene({
    towers: [SUSPECT_TANK, ...homesAfter(RESIDUAL.immediate)],
    areas: [
      zoneArea('z2', HORIZON_COLOR.immediate, 'I1 · retimed to 00:30–03:00'),
      ISOLATED_Z3,
      ...plumeAreas(RESIDUAL.immediate),
      BASELINE_OUTLINE,
    ],
    lines: networkLines(PIPE_BLUE, { ring: HORIZON_COLOR.immediate, east: HORIZON_COLOR.immediate }),
    points: actionPoints(['immediate'], true),
    labels: actionTips('immediate'),
  }),
  layers: [
    { ...LAYER.actions, title: 'Immediate interventions', color: { items: INTERVENTIONS.filter((item) => item.horizon === 'immediate').map((item) => ({ label: `${item.code} ${item.action}`, color: HORIZON_COLOR.immediate })) } },
    { group: 'network', title: 'Flushed lines (I2)', mark: 'line', color: { items: [{ label: 'Flushed', color: HORIZON_COLOR.immediate }, { label: 'Unchanged', color: PIPE_BLUE }] } },
    { group: 'zones', title: 'Zones retimed or isolated', mark: 'area', color: { items: [{ label: 'Z-2 retimed (I1)', color: HORIZON_COLOR.immediate }, { label: 'Z-3 isolated (I3)', color: LEVEL.muted }] } },
    LAB_LAYERS[1],
    LAB_LAYERS[2],
  ],
}

const SMART_CONTROLLERS: EstatePoint[] = Array.from({ length: 14 }, (_, index) => {
  const zone = index < 5 ? ZONES.z1 : index < 10 ? ZONES.z2 : ZONES.z3
  const [a, b, c] = zone.ring
  const u = hash(index, 21)
  const v = hash(index, 22)
  const at: LngLat = [a[0] + (b[0] - a[0]) * (0.1 + 0.8 * u), c[1] + (a[1] - c[1]) * (0.1 + 0.8 * v)]
  return {
    id: `controller-${index}`,
    at,
    color: HORIZON_COLOR.intermediate,
    radius: 4,
    group: 'controllers',
    tip: { title: `Smart controller SC-${String(index + 1).padStart(2, '0')}`, rows: [['Reads', 'Wind, H₂S, soil moisture']] },
  }
})

const INTERMEDIATE: EstateAskView = {
  camera: { center: [55.2036, 25.1008], zoom: 15.7, pitch: 62, bearing: 34 },
  scene: scene({
    towers: [
      /* M1's tooltip already stands over the tank. */
      {
        ...tankTower(HORIZON_COLOR.intermediate, 'M1 · cleaned and rehabilitated', [
          ['H₂S at outlet', 'under 0.05 mg/L'],
          ['Water age', '1.6 days'],
        ]),
        label: false,
      },
      ...homesAfter(RESIDUAL.intermediate, HORIZON_COLOR.intermediate),
    ],
    areas: [...plumeAreas(RESIDUAL.intermediate), BASELINE_OUTLINE],
    lines: networkLines(),
    points: [...SMART_CONTROLLERS, ...actionPoints(['intermediate'], true)],
    labels: actionTips('intermediate'),
  }),
  layers: [
    { ...LAYER.actions, title: 'Intermediate interventions', color: { items: INTERVENTIONS.filter((item) => item.horizon === 'intermediate').map((item) => ({ label: `${item.code} ${item.action}`, color: HORIZON_COLOR.intermediate })) } },
    { group: 'controllers', title: 'Smart irrigation controllers (M3)', mark: 'point', color: { items: [{ label: 'Controller', color: HORIZON_COLOR.intermediate, count: '14' }] } },
    { group: 'source', title: 'Storage tank T-3 (M1)', mark: 'tower', color: { items: [{ label: 'Rehabilitated', color: HORIZON_COLOR.intermediate }] } },
    LAB_LAYERS[1],
    { ...LAB_LAYERS[2], color: { items: [{ label: 'Benefiting', color: HORIZON_COLOR.intermediate }, { label: 'Still moderate', color: PALETTE.diverging[2] }, { label: 'Still high', color: STATUS.critical }] } },
  ],
}

/** L2's looped mains: the eastern dead-ends joined back into the ring. */
const LOOPS: EstateLine[] = [
  [
    [55.2066, 25.1075],
    [55.2085, 25.1075],
    [55.2085, 25.1004],
  ],
  [
    [55.2066, 25.0975],
    [55.2112, 25.0975],
    [55.2112, 25.1004],
  ],
  [
    [55.2112, 25.1004],
    [55.2085, 25.1004],
  ],
].map((path, index) => ({
  id: `loop-${index}`,
  path: path as LngLat[],
  color: HORIZON_COLOR.long,
  width: 3,
  dashed: true,
  group: 'loops',
  tip: { title: 'Proposed looped main (L2)', rows: [['Removes', 'dead-end stagnation']] },
}))

const SENSORS: EstatePoint[] = Array.from({ length: 36 }, (_, index) => {
  const col = index % 6
  const row = Math.floor(index / 6)
  const at = offsetKm([55.1905, 25.1072], col * 0.62 + (hash(index, 31) - 0.5) * 0.2, -row * 0.5 + (hash(index, 32) - 0.5) * 0.18)
  return {
    id: `sensor-${index}`,
    at,
    color: HORIZON_COLOR.long,
    radius: 3.5,
    group: 'sensors',
    tip: { title: `Odor sensor OS-${String(index + 1).padStart(2, '0')}`, rows: [['Measures', 'H₂S, wind, humidity'], ['Forecast', '6 hours ahead']] },
  }
})

const LONG_TERM: EstateAskView = {
  camera: { center: [55.203, 25.1002], zoom: 15.3, pitch: 62, bearing: -8 },
  scene: scene({
    towers: [
      tankTower(HORIZON_COLOR.long, 'Fed by polished TSE (L1)', [['H₂S at outlet', 'under 0.05 mg/L']]),
      ...homesAfter(RESIDUAL.long, HORIZON_COLOR.long),
    ],
    areas: [...parkAreas(), ...plumeAreas(RESIDUAL.long), BASELINE_OUTLINE],
    lines: [...networkLines(PIPE_BLUE, { supply: HORIZON_COLOR.long }), ...LOOPS],
    points: [...SENSORS, ...actionPoints(['long'], true)],
    labels: [...parkLabels(false), ...actionTips('long')],
  }),
  layers: [
    { ...LAYER.actions, title: 'Long-term interventions', color: { items: INTERVENTIONS.filter((item) => item.horizon === 'long').map((item) => ({ label: `${item.code} ${item.action}`, color: HORIZON_COLOR.long })) } },
    { group: 'loops', title: 'Redesigned distribution (L2)', mark: 'line', color: { items: [{ label: 'Proposed looped mains', color: HORIZON_COLOR.long }] } },
    { group: 'sensors', title: 'Predictive odor sensors (L3)', mark: 'point', color: { items: [{ label: 'Sensor', color: HORIZON_COLOR.long, count: '36' }] } },
    LAB_LAYERS[1],
    { ...LAB_LAYERS[2], color: { items: [{ label: 'Benefiting', color: HORIZON_COLOR.long }, { label: 'Still moderate', color: PALETTE.diverging[2] }, { label: 'Still high', color: STATUS.critical }] } },
  ],
}

export const ODOR_ASK_VIEWS = {
  odor: OVERVIEW,
  'odor-immediate': IMMEDIATE,
  'odor-intermediate': INTERMEDIATE,
  'odor-long': LONG_TERM,
} satisfies Record<string, EstateAskView>

/** Homes each horizon's best option clears, of all those exposed today. */
export const HOMES_CLEARED: Record<Horizon, number> = {
  immediate: homesAfter(RESIDUAL.immediate).filter((home) => home.text.startsWith('Benefits')).length,
  intermediate: homesAfter(RESIDUAL.intermediate).filter((home) => home.text.startsWith('Benefits')).length,
  long: homesAfter(RESIDUAL.long).filter((home) => home.text.startsWith('Benefits')).length,
}
export const HOMES_EXPOSED = EXPOSED_HOMES.length

/** The story's three findings in figures, for the Tell Me More briefing. */
export const ODOR_BRIEFING = {
  complaints: ALL_COMPLAINTS,
  inWindow: IN_WINDOW,
  window: IRRIGATION_WINDOW,
  samples: [...SAMPLES].sort((a, b) => b.h2s - a.h2s).map((sample) => ({ name: sample.name, h2s: sample.h2s })),
  failing: FAILING.length,
  limit: LIMIT.h2s,
  worst: { name: WORST.name, times: timesLimit(WORST) },
}
