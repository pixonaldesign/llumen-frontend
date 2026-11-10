/**
 * The Unified Odor story: recycled-water irrigation odor around Al Barsha's parks. LLUMEN detects the
 * complaints, traces them to the Pond Park pump house, models who the evening wind carries the odor to,
 * lays out nine interventions, and tests them in a Policy Lab. Every value is an illustrative example.
 */
import { hash, offsetKm, scatter, type LngLat } from '../realEstate/estateGeo'
import type {
  EstateArea,
  EstateHeatPoint,
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
  type EstateCard,
  type EstatePlace,
  type EstateScenario,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
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

/** `reports`: CRM odor complaints in 90 days by what residents reported, most first. */
type Park = { id: string; name: string; ring: LngLat[]; reports: [string, number][]; mentions: number }

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
    reports: [
      ['Rotten-egg odor', 32],
      ['Sewage-like smell', 24],
      ['Stale water smell', 15],
    ],
    mentions: 248,
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
    reports: [
      ['Rotten-egg odor', 11],
      ['Sewage-like smell', 10],
      ['Stale water smell', 8],
    ],
    mentions: 101,
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
    reports: [
      ['Stale water smell', 7],
      ['Rotten-egg odor', 6],
      ['Sewage-like smell', 5],
    ],
    mentions: 63,
  },
]

const POND = PARKS[0]

const complaintsAt = (park: Park) => park.reports.reduce((sum, [, count]) => sum + count, 0)

/** Each complaint type and how often it was reported, then the totals. */
const parkRows = (park: Park): [string, string][] => [
  ...park.reports.map(([type, count]): [string, string] => [type, `${count} reports`]),
  ['CRM complaints', `${complaintsAt(park)} in 90 days`],
  ['Negative posts', `${park.mentions} in 30 days`],
]

const parkAreas = (): EstateArea[] =>
  PARKS.map((park) => ({
    id: `park-${park.id}`,
    ring: park.ring,
    color: PARK_GREEN,
    opacity: 0.2,
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
    text: `${complaintsAt(park)} odor complaints · 90 days`,
    rows: pinned ? parkRows(park) : undefined,
    group: 'parks',
  }))

/* Irrigation zones, fed by recycled (TSE) water through the park ring mains. */

type ZoneId = 'z1' | 'z2' | 'z3' | 'z4' | 'z5'

const ZONES: Record<ZoneId, { name: string; ring: LngLat[]; schedule: string }> = {
  z1: { name: 'Zone Z-1 · Pond Park west', ring: box([55.19958, 25.10028], [55.2028, 25.10351]), schedule: '20:00–22:30' },
  z2: { name: 'Zone Z-2 · Pond Park east', ring: box([55.2028, 25.10031], [55.20606, 25.10354]), schedule: '20:30–23:00' },
  z3: { name: 'Zone Z-3 · Eastern streetscape', ring: box([55.20628, 25.0975], [55.20688, 25.1075]), schedule: '21:00–23:30' },
  z4: { name: 'Zone Z-4 · Al Barsha 1 Park', ring: PARKS[1].ring, schedule: '19:30–21:30' },
  z5: { name: 'Zone Z-5 · Al Barsha 3 Park', ring: PARKS[2].ring, schedule: '19:30–21:00' },
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
  [55.19932, 25.0952],
  [55.19932, 25.10024],
  [55.1997, 25.10045],
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
    pipe('barsha1', BARSHA1_MAIN, 'Al Barsha 1 Park main', [['Residence time', '1.4 days']], color, 2),
  ]
}

/** Storage tank T-3 in the pump house: the suspected source, lit in `color`. */
function tankTower(color: string, text: string, rows: [string, string][]): EstateTower {
  return {
    id: 'tank-t3',
    featureId: 0,
    at: PUMP_HOUSE,
    heightM: 9,
    color,
    state: 'select',
    footprint: circle(PUMP_HOUSE, 9),
    label: true,
    title: 'Storage tank T-3',
    text,
    tip: { title: 'Storage tank T-3 · Pond Park pump house', rows },
    group: 'source',
  }
}

const SUSPECT_TANK = tankTower(STATUS.critical, 'Suspected source · H₂S 0.42 mg/L', [
  ['H₂S at outlet', '0.42 mg/L'],
  ['Sediment', '38 cm'],
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
    ? { color: STATUS.critical, status: 'High · over 14 odor-hours a month' }
    : { color: PALETTE.diverging[2], status: 'Moderate · 6–14 odor-hours a month' },
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

type Facility = { id: string; name: string; kind: string; at: LngLat }

const FACILITIES: Facility[] = [
  { id: 'mawakeb', name: 'Al Mawakeb School', kind: 'School', at: [55.20164, 25.10468] },
  { id: 'smart-vision', name: 'Smart Vision School', kind: 'School', at: [55.21148, 25.10741] },
  { id: 'health', name: 'Al Barsha Health Centre', kind: 'Health centre', at: [55.20246, 25.09762] },
  { id: 'salam', name: 'Al Salam School', kind: 'School', at: [55.19738, 25.09328] },
]

const facilityPoints = (): EstatePoint[] =>
  FACILITIES.map((facility) => ({
    id: `facility-${facility.id}`,
    at: facility.at,
    color: PALETTE.categorical[1],
    radius: 6,
    group: 'facilities',
    tip: { title: facility.name, rows: [['Type', facility.kind], ['In plume', insidePlume(BASELINE.low, facility.at) ? 'Yes' : 'Within 600 m']] },
  }))

/* —— What residents report —— */

/** Negative posts about odor, densest downwind of the pump house and around the three parks. */
const SOCIAL_HEAT: EstateHeatPoint[] = [
  ...scatter(toward(PUMP_HOUSE, WIND_TOWARD, 0.45), 70, 0.55, 3)
    .filter((at) => insidePlume(BASELINE.low, at))
    .map((at, index) => ({ at, weight: 0.45 + 0.5 * hash(index, 4), group: 'social' })),
  ...scatter(centroid(POND.ring), 30, 0.35, 5).map((at, index) => ({ at, weight: 0.35 + 0.4 * hash(index, 6), group: 'social' })),
  ...scatter(centroid(PARKS[1].ring), 22, 0.3, 7).map((at) => ({ at, weight: 0.45, group: 'social' })),
  ...scatter(centroid(PARKS[2].ring), 16, 0.25, 9).map((at) => ({ at, weight: 0.4, group: 'social' })),
]

const HEAT_RAMP = [PALETTE.purple[0], PALETTE.purple[2], PALETTE.categorical[5], PALETTE.categorical[4]]

/* —— Sampling —— */

type Sample = { id: string; name: string; at: LngLat; h2s: number; oxygen: number }

const SAMPLES: Sample[] = [
  { id: 's1', name: 'T-3 outlet', at: [55.20592, 25.10262], h2s: 0.42, oxygen: 0.8 },
  { id: 's2', name: 'Ring main, east', at: [55.2059, 25.1016], h2s: 0.21, oxygen: 1.9 },
  { id: 's3', name: 'Z-2 emitters', at: [55.2045, 25.101], h2s: 0.18, oxygen: 2.4 },
  { id: 's4', name: 'Eastern streetscape dead-end', at: [55.2066, 25.1072], h2s: 0.24, oxygen: 1.6 },
  { id: 's5', name: 'Z-1 emitters', at: [55.2008, 25.1026], h2s: 0.05, oxygen: 4.6 },
  { id: 's6', name: 'Supply main inlet', at: [55.19932, 25.0975], h2s: 0.02, oxygen: 6.2 },
]

const sampleColor = (h2s: number) => (h2s >= 0.3 ? STATUS.critical : h2s >= 0.15 ? LEVEL.high : LEVEL.ok)

const samplePoints = (): EstatePoint[] =>
  SAMPLES.map((sample) => ({
    id: `sample-${sample.id}`,
    at: sample.at,
    color: sampleColor(sample.h2s),
    radius: 6.5,
    group: 'sampling',
    tip: {
      title: `Sample · ${sample.name}`,
      rows: [
        ['H₂S', `${sample.h2s.toFixed(2)} mg/L`],
        ['Dissolved oxygen', `${sample.oxygen.toFixed(1)} mg/L`],
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

const POLICY_LAB = 'dm-odor-lab'
const CHOOSE = 'dm-odor-choose'

/** One row per horizon: Immediate, then Intermediate, then Long-term. */
const interventionCards = (): EstateCard[] =>
  (['immediate', 'intermediate', 'long'] as const).flatMap((horizon) =>
    INTERVENTIONS.filter((entry) => entry.horizon === horizon).map(
      (item): EstateCard => ({
        id: `option-${item.code.toLowerCase()}`,
        kind: 'intervention',
        span: 'cell',
        title: item.action,
        code: item.code,
        horizon,
        asset: item.asset,
        benefit: item.benefit,
      }),
    ),
  )

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
  social: { group: 'social', title: 'Social media hotspots', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer posts', high: 'More' } },
  parks: {
    group: 'parks',
    title: 'Parks · CRM odor complaints',
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
  sampling: {
    group: 'sampling',
    title: 'Water sampling locations',
    mark: 'point',
    color: {
      items: [
        { label: 'H₂S over 0.3 mg/L', color: STATUS.critical, count: '1' },
        { label: '0.15–0.3 mg/L', color: LEVEL.high, count: '3' },
        { label: 'Under 0.15 mg/L', color: LEVEL.ok, count: '2' },
      ],
    },
  },
  source: {
    group: 'source',
    title: 'Suspected odor source',
    mark: 'tower',
    color: { items: [{ label: 'Storage tank T-3', color: STATUS.critical, count: '0.42 mg/L' }] },
  },
  wind: { group: 'wind', title: 'Evening wind', mark: 'line', color: { items: [{ label: 'From WNW · 3.4 m/s', color: WIND_WHITE }] } },
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
  facilities: {
    group: 'facilities',
    title: 'Sensitive facilities',
    mark: 'point',
    color: { items: [{ label: 'Schools and health centre', color: PALETTE.categorical[1], count: `${FACILITIES.length}` }] },
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
  heatRamp: HEAT_RAMP,
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
  heat: SOCIAL_HEAT,
  areas: parkAreas(),
  labels: parkLabels(),
})

const CAUSE_SCENE = scene({
  towers: [SUSPECT_TANK],
  areas: ZONES_UNDER_SUSPICION(),
  lines: networkLines(),
  points: samplePoints(),
})

const EXPOSURE_SCENE = scene({
  towers: [SUSPECT_TANK, ...EXPOSED_HOMES],
  areas: plumeAreas(BASELINE),
  wind: windField(),
  points: facilityPoints(),
})

const MENU_SCENE = scene({
  towers: [SUSPECT_TANK],
  areas: [...ZONES_UNDER_SUSPICION().slice(0, 3), ...plumeAreas(BASELINE)],
  lines: networkLines(),
  points: actionPoints(),
})

/* The Policy Lab: Irrigation Timing (I1), with the schedule as its what-if. */

type Schedule = {
  id: string
  label: string
  detail: string
  scale: number
  turn: number
  complaints: number
  residents: number
  cost: number
  events: number
  perHour: string
  seasons: string
  interpretation: string
}

const SCHEDULES: Schedule[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    detail: 'Today’s schedule, 20:00–23:30',
    scale: 1,
    turn: 0,
    complaints: 40,
    residents: 1850,
    cost: 0,
    events: 15,
    perHour: '—',
    seasons: '—',
    interpretation: 'No intervention is applied. The baseline remains unchanged.',
  },
  {
    id: 'earlier',
    label: 'Earlier evening',
    detail: 'Move irrigation to 17:30–20:00',
    scale: 0.82,
    turn: -8,
    complaints: 33,
    residents: 1500,
    cost: 18000,
    events: 12,
    perHour: 'AED 167',
    seasons: '2 of 4',
    interpretation:
      'Under this illustrative scenario, the selected schedule reduces modeled residential exposure by 19% and avoids 7 complaints per month compared with the baseline.',
  },
  {
    id: 'later',
    label: 'Later evening',
    detail: 'Move irrigation to 00:30–03:00',
    scale: 0.6,
    turn: 14,
    complaints: 24,
    residents: 1100,
    cost: 25000,
    events: 9,
    perHour: 'AED 116',
    seasons: '3 of 4',
    interpretation:
      'Under this illustrative scenario, the selected schedule reduces modeled residential exposure by 41% and avoids 16 complaints per month compared with the baseline.',
  },
]

const BASE = SCHEDULES[0]
const fmt = (value: number) => value.toLocaleString('en-US')

function labCards(schedule: Schedule): EstateCard[] {
  return toned([
    {
      id: 'lab-control',
      kind: 'scenario',
      title: 'Test a different irrigation schedule',
      options: SCHEDULES.map(({ id, label, detail }) => ({ id, label, detail })),
    },
    {
      id: 'lab-kpis',
      kind: 'kpis',
      title: `What-if simulation · ${schedule.label}`,
      tiles: [
        { label: 'Complaints / month', value: `${schedule.complaints}`, note: `Baseline: ${BASE.complaints}` },
        { label: 'Residents in exposure area', value: fmt(schedule.residents), note: `Baseline: ${fmt(BASE.residents)}` },
        { label: 'Implementation cost', value: fmt(schedule.cost), unit: 'AED', note: 'Illustrative' },
      ],
    },
    {
      id: 'lab-compare',
      kind: 'grouped',
      title: 'Baseline vs selected scenario',
      legend: ['Baseline', schedule.id === 'baseline' ? 'Selected' : schedule.label],
      colors: ['rgba(255, 255, 255, 0.4)', HORIZON_COLOR.immediate],
      groups: [
        { label: 'Complaints', values: [BASE.complaints, schedule.complaints] },
        { label: 'Exposure events', values: [BASE.events, schedule.events] },
        { label: 'Exposure-hours', values: [BASE.events * 3, schedule.events * 3] },
      ],
    },
    { id: 'lab-interpretation', kind: 'note', title: 'Simulation interpretation', text: schedule.interpretation },
    { id: 'lab-cost', kind: 'cell', title: 'Cost-effectiveness', value: schedule.perHour, note: 'per avoided exposure-hour' },
    { id: 'lab-seasons', kind: 'cell', title: 'Impact sustainability', value: schedule.seasons, note: 'seasonal wind patterns the benefit holds in' },
    {
      id: 'lab-decision',
      kind: 'specs',
      title: 'Decision panel',
      items: [
        ['Assumption', 'Complaints scale with exposure-hours'],
        ['Uncertainty', '±25%, synthetic model'],
        ['Owner', 'Parks irrigation operations'],
        ['Approval', schedule.id === 'baseline' ? 'None needed' : 'Schedule change, Director'],
      ],
    },
    {
      id: 'lab-caveat',
      kind: 'note',
      title: 'About these values',
      text: 'Values are synthetic examples, not calibrated predictions. In the real Policy Lab, outcomes are calculated from irrigation operations, meteorology, verified odor evidence and exposure modeling.',
    },
  ])
}

function labScenario(schedule: Schedule): EstateScenario {
  const plume = bands(schedule.scale, schedule.turn)
  const simulated = schedule.id !== 'baseline'
  return {
    id: schedule.id,
    cards: labCards(schedule),
    scene: scene({
      towers: [SUSPECT_TANK, ...(simulated ? homesAfter(plume) : EXPOSED_HOMES)],
      areas: [
        zoneArea('z2', simulated ? HORIZON_COLOR.immediate : STATUS.critical, simulated ? `Retimed to ${schedule.detail.slice(-11)}` : 'Today’s schedule'),
        zoneArea('z3', simulated ? HORIZON_COLOR.immediate : STATUS.critical, simulated ? `Retimed to ${schedule.detail.slice(-11)}` : 'Today’s schedule', 0.4),
        ...plumeAreas(plume),
        ...(simulated ? [BASELINE_OUTLINE] : []),
      ],
      wind: windField(WIND_TOWARD + schedule.turn),
    }),
  }
}

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

/* Which intervention to choose: homes by the earliest horizon whose best option clears them. */

const RESIDUAL: Record<Horizon, Bands> = {
  immediate: bands(0.6, 14),
  intermediate: bands(0.45),
  long: bands(0.2),
}

const CLEARED_HOMES = homeTowers((home) => {
  for (const horizon of ['immediate', 'intermediate', 'long'] as const) {
    if (bandOf(RESIDUAL[horizon], home.at) === 'clear') return { color: HORIZON_COLOR[horizon], status: `Cleared by ${HORIZON_LABEL[horizon].toLowerCase()}` }
  }
  return { color: STATUS.critical, status: 'Still exposed' }
})

const residualOutline = (horizon: Horizon): EstateArea => ({
  id: `residual-${horizon}`,
  ring: plumeRing(RESIDUAL[horizon].moderate),
  color: HORIZON_COLOR[horizon],
  opacity: 0.08,
  dashed: horizon !== 'long',
  group: 'residual',
  tip: { title: `Residual plume · best ${HORIZON_LABEL[horizon].toLowerCase()} option`, rows: [['Option', horizon === 'immediate' ? 'I1 · later evening' : horizon === 'intermediate' ? 'M1 · tank rehabilitation' : 'L1 · treatment upgrade']] },
})

const CHOOSE_SCENE = scene({
  towers: [SUSPECT_TANK, ...CLEARED_HOMES],
  areas: [BASELINE_OUTLINE, residualOutline('immediate'), residualOutline('intermediate'), residualOutline('long')],
})

/* —— The story —— */

const CAMERA = {
  detected: { center: [55.1962, 25.0953], zoom: 14.35, pitch: 50, bearing: -18 },
  cause: { center: [55.2032, 25.1017], zoom: 15.75, pitch: 60, bearing: 24 },
  exposure: { center: [55.2096, 25.0984], zoom: 14.95, pitch: 56, bearing: -14 },
  menu: { center: [55.2052, 25.1004], zoom: 14.95, pitch: 52, bearing: 8 },
  lab: { center: [55.2098, 25.0988], zoom: 15.0, pitch: 57, bearing: 6 },
  choose: { center: [55.2092, 25.0992], zoom: 14.9, pitch: 50, bearing: -6 },
} satisfies Record<string, EstateCamera>

const FILTERS = ['Al Barsha', 'Last 90 days', 'Odor']

const WEEKS = ['12 Aug', '26 Aug', '9 Sep', '23 Sep', '7 Oct', '21 Oct', '4 Nov']
/** Negative odor mentions and CRM complaints a week, oldest first: 412 mentions in the last four weeks, up 64%. */
export const MENTIONS_BY_WEEK = [38, 41, 44, 47, 52, 58, 66, 75, 88, 97, 106, 121]
export const CRM_BY_WEEK = [4, 5, 4, 6, 7, 8, 9, 11, 13, 14, 17, 20]

export const ODOR_STORY: EstateStory = {
  id: 'dm-odor',
  title: 'Unified Odor Use Case',
  description:
    'How LLUMEN detects an odor problem in Al Barsha, traces it to recycled-water irrigation, finds who is affected, lays out nine interventions and helps leadership choose. The same agent investigates odor from oil spills, waste or sewerage.',
  place: 'barsha',
  pages: [
    {
      id: 'dm-odor-detected',
      title: 'Odor detected',
      finding:
        'An increase in negative social media sentiment about unpleasant odors has been detected near public parks in Al Barsha, supported by recurring CRM complaints. The source is not yet known.',
      camera: CAMERA.detected,
      scene: DETECTED_SCENE,
      filters: FILTERS,
      layers: [LAYER.social, LAYER.parks],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Leadership alert',
          parts: [
            'Negative posts about odors near Al Barsha’s parks are up ',
            { em: ['64% in 30 days'] },
            ', backed by ',
            { em: ['118 CRM complaints'] },
            ' in 90 days. The concern is growing, and its source is not yet known.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Last 30 days',
          tiles: [
            { label: 'Negative social mentions', value: '412', note: '+64% vs prior 30 days' },
            { label: 'CRM odor complaints', value: '118', note: 'in 90 days · +38%' },
            { label: 'Affected parks', value: '3', note: 'of 7 in Al Barsha' },
          ],
        },
        {
          id: 'trend',
          kind: 'line',
          title: 'Is it increasing?',
          kpi: { value: '121', unit: 'negative mentions last week' },
          x: WEEKS,
          yLabels: ['150', '75', '0'],
          yMax: 150,
          series: [
            { name: 'Social mentions', points: MENTIONS_BY_WEEK },
            { name: 'CRM complaints ×4', points: CRM_BY_WEEK.map((value) => value * 4) },
          ],
        },
        {
          id: 'parks',
          kind: 'hbars',
          title: 'CRM complaints by park, 90 days',
          bars: PARKS.map((park) => ({ label: park.name, value: complaintsAt(park), display: `${complaintsAt(park)}` })),
        },
        { id: 'peak', kind: 'cell', title: 'Peak reporting', value: '21:00', note: 'to midnight, 7 in 10 complaints', spark: [2, 3, 3, 5, 9, 18, 26, 21, 9, 4] },
        { id: 'unknown', kind: 'cell', title: 'Source', value: 'Unknown', note: 'complaints alone do not establish the cause', status: 'moderate' },
      ]),
    },
    {
      id: 'dm-odor-cause',
      title: 'What is causing it?',
      finding:
        'Investigation of the affected parks has identified recycled-water irrigation as a potential source of the reported odor, based on irrigation operations, water-quality observations and preliminary field inspections.',
      camera: CAMERA.cause,
      scene: CAUSE_SCENE,
      filters: FILTERS,
      layers: [LAYER.zones, LAYER.network, LAYER.sampling, LAYER.source],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Complaints rise within ',
            { em: ['40 minutes'] },
            ' of Zones Z-2 and Z-3 starting to irrigate, and water leaving ',
            { em: ['storage tank T-3'] },
            ' carries 20 times the inlet’s hydrogen sulphide. T-3 is a possible source, not yet confirmed.',
          ],
        },
        {
          id: 'timing',
          kind: 'line',
          title: 'Complaints vs irrigation hours',
          kpi: { value: '0.81', unit: 'correlation, last 90 days' },
          x: ['16:00', '19:00', '22:00', '01:00', '04:00'],
          yLabels: ['100', '50', '0'],
          yMax: 100,
          series: [
            { name: 'Irrigation flow', points: [0, 0, 4, 12, 58, 86, 92, 74, 20, 4, 0, 0, 0] },
            { name: 'Odor complaints', points: [2, 3, 3, 6, 22, 61, 88, 79, 44, 16, 6, 3, 2] },
          ],
        },
        {
          id: 'samples',
          kind: 'table',
          title: 'Water-quality results',
          columns: ['Site', 'H₂S mg/L', 'DO mg/L'],
          dotColumn: 0,
          rows: SAMPLES.map((sample) => ({
            cells: [sample.name, sample.h2s.toFixed(2), sample.oxygen.toFixed(1)],
            color: sampleColor(sample.h2s),
          })),
        },
        {
          id: 'inspection',
          kind: 'specs',
          title: 'Field inspection findings',
          items: [
            ['T-3 sediment', '38 cm'],
            ['Residence time', '4.6 days'],
            ['Dead-ends', '3, eastern lines'],
            ['Odor at vent', 'Strong'],
          ],
        },
        { id: 'stagnation', kind: 'cell', title: 'Water age at Z-2', value: '4.6 days', note: 'target under 2 days', status: 'critical', spark: [1.8, 2.0, 2.4, 2.9, 3.3, 3.8, 4.2, 4.6] },
        { id: 'confidence', kind: 'cell', title: 'Source confidence', value: 'Medium', note: 'a possible source, pending lab confirmation', status: 'moderate' },
      ]),
    },
    {
      id: 'dm-odor-affected',
      title: 'Who is affected?',
      finding:
        'Prevailing evening winds may carry odor from the suspected irrigation source toward nearby residential areas, potentially affecting residents beyond the park boundaries.',
      camera: CAMERA.exposure,
      scene: EXPOSURE_SCENE,
      filters: FILTERS,
      layers: [LAYER.source, LAYER.wind, LAYER.plume, LAYER.homes, LAYER.facilities],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Evening winds carry odor from tank T-3 up to ',
            { em: ['1.4 km'] },
            ' into Al Barsha 2, where about ',
            { em: [`${fmt(BASE.residents)} residents`] },
            ` in ${EXPOSED_HOMES.length} homes sit inside the modelled exposure area.`,
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Modelled exposure area',
          tiles: [
            { label: 'Residential buildings', value: `${EXPOSED_HOMES.length}`, note: `${EXPOSED_HOMES.filter((home) => home.color === STATUS.critical).length} in the high band` },
            { label: 'Residents', value: fmt(BASE.residents), note: 'estimated' },
            { label: 'Exposure events', value: `${BASE.events}`, note: 'a month' },
          ],
        },
        {
          id: 'overlap',
          kind: 'vbars',
          title: 'Nights irrigation overlapped an onshore wind',
          kpi: { value: '22 of 30', unit: 'nights at 21:00' },
          bars: [
            { label: '19:00', value: 4 },
            { label: '20:00', value: 11 },
            { label: '21:00', value: 22 },
            { label: '22:00', value: 19 },
            { label: '23:00', value: 12 },
            { label: '00:00', value: 6 },
            { label: '01:00', value: 3 },
          ],
        },
        {
          id: 'bands',
          kind: 'donut',
          title: 'Residents by exposure band',
          total: fmt(BASE.residents),
          totalLabel: 'residents',
          slices: [
            { name: 'High', value: 520, color: STATUS.critical },
            { name: 'Moderate', value: 1330, color: PALETTE.diverging[2] },
          ],
        },
        { id: 'wind', kind: 'cell', title: 'Evening wind', value: '3.4 m/s', note: 'from the west-north-west, 19:00–23:00' },
        { id: 'facilities', kind: 'cell', title: 'Sensitive facilities', value: `${FACILITIES.length}`, note: '3 schools and a health centre within 600 m' },
      ]),
    },
    {
      id: 'dm-odor-options',
      title: 'What can we do?',
      finding:
        'LLUMEN has identified nine alternative interventions to address the suspected odor source and reduce residential exposure, with three options evaluated for each impact horizon.',
      camera: CAMERA.menu,
      scene: MENU_SCENE,
      filters: FILTERS,
      columns: 3,
      layers: [LAYER.actions, LAYER.zones, LAYER.network, LAYER.plume],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Nine interventions',
          parts: [
            'Three options for each impact horizon: ',
            { em: ['immediate'] },
            ', ',
            { em: ['intermediate'] },
            ' and ',
            { em: ['long-term'] },
            ', one row each. These are nine alternative decisions, not nine mandatory steps.',
          ],
        },
        ...interventionCards(),
      ],
    },
    {
      id: POLICY_LAB,
      title: 'Policy Lab',
      finding:
        'Policy Lab · Irrigation Timing (I1), Al Barsha, illustrative scenario. Pick a schedule to see how complaints, residents in the exposure area and cost change against the baseline.',
      camera: CAMERA.lab,
      scene: labScenario(BASE).scene,
      filters: ['Al Barsha', 'I1 · Irrigation timing', 'Illustrative'],
      layers: LAB_LAYERS,
      cards: labCards(BASE),
      scenarios: SCHEDULES.map(labScenario),
    },
    {
      id: CHOOSE,
      title: 'Which one to choose?',
      finding:
        'The nine independent interventions compared on the same baseline: effectiveness, cost-effectiveness and impact sustainability. Quick, low-cost options are not a substitute for longer-term fixes.',
      camera: CAMERA.choose,
      scene: CHOOSE_SCENE,
      filters: FILTERS,
      layers: [
        {
          group: 'homes',
          title: 'Homes by the horizon that clears them',
          mark: 'tower',
          color: {
            items: [
              ...(['immediate', 'intermediate', 'long'] as const).map((horizon) => ({
                label: HORIZON_LABEL[horizon],
                color: HORIZON_COLOR[horizon],
                count: `${CLEARED_HOMES.filter((home) => home.color === HORIZON_COLOR[horizon]).length}`,
              })),
            ],
          },
        },
        {
          group: 'residual',
          title: 'Residual plume, best option per horizon',
          mark: 'area',
          color: { items: (['immediate', 'intermediate', 'long'] as const).map((horizon) => ({ label: HORIZON_LABEL[horizon], color: HORIZON_COLOR[horizon] })) },
        },
      ],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Retiming irrigation (I1) cuts exposure ',
            { em: ['41% for AED 25k'] },
            ', the most per dirham, but needs re-tuning each season. Upgrading treatment (L1) removes ',
            { em: ['78%'] },
            ' and lasts, for AED 6.5M. A quick win does not replace the long-term fix.',
          ],
        },
        {
          id: 'compare',
          kind: 'table',
          title: 'Nine interventions on the same baseline',
          height: 2,
          columns: ['Option', 'Exposure cut', 'AED / hour', 'Lasts'],
          dotColumn: 0,
          rows: INTERVENTIONS.map((item) => ({
            cells: [`${item.code} ${item.action}`, `${item.reduction}%`, fmt(item.perHour), item.sustainability],
            color: HORIZON_COLOR[item.horizon],
          })),
        },
        {
          id: 'effectiveness',
          kind: 'hbars',
          title: 'Effectiveness · exposure removed',
          bars: [...INTERVENTIONS]
            .sort((a, b) => b.reduction - a.reduction)
            .slice(0, 5)
            .map((item) => ({ label: `${item.code} ${item.action}`, value: item.reduction, display: `${item.reduction}%`, color: HORIZON_COLOR[item.horizon] })),
        },
        {
          id: 'value',
          kind: 'hbars',
          title: 'Cost-effectiveness · AED per avoided exposure-hour',
          bars: [...INTERVENTIONS]
            .sort((a, b) => a.perHour - b.perHour)
            .slice(0, 5)
            .map((item) => ({ label: `${item.code} ${item.action}`, value: 1 / item.perHour, display: `AED ${fmt(item.perHour)}`, color: HORIZON_COLOR[item.horizon] })),
        },
        {
          id: 'criteria',
          kind: 'specs',
          title: 'What leadership needs to weigh',
          items: [
            ['Effectiveness', 'Exposure removed'],
            ['Cost-effectiveness', 'Cut per dirham'],
            ['Sustainability', 'Lasts without rework'],
            ['Ranking', 'From validated models'],
          ],
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
    heat: SOCIAL_HEAT,
    areas: [...parkAreas(), ...plumeAreas(BASELINE)],
    labels: [parkLabels(false)[0]],
  }),
}

/** Isolating Zone Z-3 for I3: shown greyed out, its supply valved off. */
const ISOLATED_Z3 = zoneArea('z3', LEVEL.muted, 'Isolated · supply valved off', 0.18, true)

const OVERVIEW: EstateAskView = {
  camera: { center: [55.2082, 25.0996], zoom: 15.05, pitch: 58, bearing: -20 },
  scene: scene({
    towers: [SUSPECT_TANK, ...EXPOSED_HOMES],
    heat: SOCIAL_HEAT,
    areas: [...plumeAreas(BASELINE), parkAreas()[0]],
    wind: windField(),
    labels: [parkLabels()[0]],
  }),
  layers: [LAYER.source, LAYER.plume, LAYER.homes, LAYER.parks, LAYER.social],
}

const IMMEDIATE: EstateAskView = {
  camera: { center: [55.2074, 25.1006], zoom: 15.25, pitch: 56, bearing: 12 },
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
  camera: { center: [55.2032, 25.1004], zoom: 15.3, pitch: 60, bearing: 34 },
  scene: scene({
    towers: [
      /* M1's tooltip already stands over the tank. */
      {
        ...tankTower(HORIZON_COLOR.intermediate, 'M1 · cleaned and rehabilitated', [
          ['Sediment removed', '38 cm'],
          ['Residence time', '1.6 days'],
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
  camera: { center: [55.2012, 25.0982], zoom: 14.15, pitch: 50, bearing: -8 },
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
