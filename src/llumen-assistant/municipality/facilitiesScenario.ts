/**
 * Urban Planning use case 1, community facilities: JVC, Arjan and Motor City have grown fast, mostly with
 * families and workers, and their schools, health centres, nurseries and parks have not kept pace. Three
 * findings (growth, who the new residents are, the shortage confirmed); the horizon maps and solutions serve
 * Simulate recommended actions. Every value is an illustrative example.
 */
import type { LngLat } from '../realEstate/estateGeo'
import type { EstateHeatPoint, EstateLabel, EstatePoint } from '../realEstate/estateMapLayers'
import {
  PALETTE,
  STATUS,
  type EstateAskView,
  type EstateCamera,
  type EstatePageView,
  type EstatePicker,
  type EstatePlace,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
import { kmBetween } from './dmGeo'
import { HORIZON_COLOR, HORIZON_SPAN, LEVEL, toned } from './dmShared'
import {
  AREA_LIST,
  AREAS,
  AREAS_ASK_CAMERA,
  AREAS_CAMERA,
  GAP_RAMP,
  HEAT_RAMP,
  TOTAL_GROWTH,
  TOTALS,
  areaOutlines,
  fmt,
  growthPct,
  newResidentsFor,
  spreadIn,
  scene,
  thousands,
  type AreaId,
  type GrowthArea,
  type PlanningSolution,
} from './growthAreas'

/* —— Who lives there, and what they have nearby —— */

type Households = {
  /** Share of households, %: families with children, and workers in shared housing. */
  families: number
  workers: number
  /** School-age children, and workers living in shared accommodation. */
  children: number
  workerResidents: number
}

const HOUSEHOLDS: Record<AreaId, Households> = {
  jvc: { families: 46, workers: 12, children: 26400, workerResidents: 9800 },
  arjan: { families: 41, workers: 31, children: 10400, workerResidents: 14600 },
  'motor-city': { families: 52, workers: 10, children: 9700, workerResidents: 5100 },
}

type Provision = { seats: number; seatsNeeded: number; clinics: number; clinicsNeeded: number; nurseries: number; nurseriesNeeded: number; parkAccess: number }

const PROVISION: Record<AreaId, Provision> = {
  jvc: { seats: 11800, seatsNeeded: 22400, clinics: 2, clinicsNeeded: 5, nurseries: 9, nurseriesNeeded: 18, parkAccess: 48 },
  arjan: { seats: 4300, seatsNeeded: 8800, clinics: 1, clinicsNeeded: 3, nurseries: 4, nurseriesNeeded: 8, parkAccess: 41 },
  'motor-city': { seats: 5200, seatsNeeded: 8300, clinics: 1, clinicsNeeded: 2, nurseries: 5, nurseriesNeeded: 8, parkAccess: 55 },
}

const total = (of: (id: AreaId) => number) => AREA_LIST.reduce((sum, area) => sum + of(area.id), 0)

const SEATS = total((id) => PROVISION[id].seats)
const SEATS_NEEDED = total((id) => PROVISION[id].seatsNeeded)
const SEAT_GAP = SEATS_NEEDED - SEATS
const CLINICS = total((id) => PROVISION[id].clinics)
const CLINICS_NEEDED = total((id) => PROVISION[id].clinicsNeeded)
const NURSERIES = total((id) => PROVISION[id].nurseries)
const NURSERIES_NEEDED = total((id) => PROVISION[id].nurseriesNeeded)
const CHILDREN = total((id) => HOUSEHOLDS[id].children)
const WORKERS = total((id) => HOUSEHOLDS[id].workerResidents)
const PARK_TARGET = 80
/** Homes within 400 m of a park, weighted by residents. */
const PARK_ACCESS = Math.round(total((id) => PROVISION[id].parkAccess * AREAS[id].population) / TOTALS.population)
/* —— Map pieces —— */

const FAMILY = PALETTE.purple[3]
const WORKER = PALETTE.categorical[5]
const SCHOOL = PALETTE.blue[3]
const CLINIC = PALETTE.teal[2]
const PARK = PALETTE.categorical[3]

const growthColor = (pct: number) => (pct >= 60 ? STATUS.critical : pct >= 45 ? LEVEL.high : LEVEL.watch)

const byArea = <T>(build: (area: GrowthArea, index: number) => T): Record<AreaId, T> =>
  Object.fromEntries(AREA_LIST.map((area, index) => [area.id, build(area, index)])) as Record<AreaId, T>

const POPULATION_HEAT = byArea((area, index): EstateHeatPoint[] =>
  spreadIn(area.id, 0.3, index * 11 + 5).map(({ at, density }) => ({
    at,
    weight: (0.25 + 2.2 * density ** 2.5) * Math.min(1, 0.35 + growthPct(area) / 110),
    group: 'population',
  })),
)

type Site = { id: string; area: AreaId; name: string; at: LngLat; rows: [string, string][] }

const site = (color: string, group: string, radius = 5.5) => (item: Site): EstatePoint => ({
  id: `${group}-${item.id}`,
  at: item.at,
  color,
  radius,
  group,
  tip: { title: item.name, rows: item.rows },
})

const WORKER_HOUSING: Site[] = [
  { id: 'w1', area: 'arjan', name: 'Worker accommodation · Arjan east', at: [55.2455, 25.0585], rows: [['Residents', '6,200'], ['Occupancy', '112% of permitted beds']] },
  { id: 'w2', area: 'arjan', name: 'Worker accommodation · Arjan north', at: [55.2465, 25.0645], rows: [['Residents', '5,100'], ['Occupancy', '104%']] },
  { id: 'w3', area: 'arjan', name: 'Worker accommodation · Arjan west', at: [55.2265, 25.0605], rows: [['Residents', '3,300'], ['Occupancy', '98%']] },
  { id: 'w4', area: 'jvc', name: 'Worker accommodation · JVC south', at: [55.179, 25.0385], rows: [['Residents', '5,400'], ['Occupancy', '101%']] },
  { id: 'w5', area: 'jvc', name: 'Worker accommodation · JVC east', at: [55.2185, 25.056], rows: [['Residents', '4,400'], ['Occupancy', '96%']] },
  { id: 'w6', area: 'motor-city', name: 'Worker accommodation · Motor City', at: [55.249, 25.0475], rows: [['Residents', '5,100'], ['Occupancy', '99%']] },
]

const WORKER_RAMP = [PALETTE.categorical[5], PALETTE.diverging[2], PALETTE.categorical[4]]

/** Where families and workers live: each spread point goes to one group, so the two heats sit apart. */
const GROUP_HEAT = byArea((area, index): EstateHeatPoint[] => {
  const { families, workers } = HOUSEHOLDS[area.id]
  const lean = (1.4 * workers) / families
  const sites = WORKER_HOUSING.filter((item) => item.area === area.id)
  const residents = (item: Site) => Number(item.rows[0][1].replace(/,/g, ''))
  const nearSite = (at: LngLat) =>
    Math.max(0, ...sites.map((item) => (residents(item) / 6200) * Math.exp(-((kmBetween(at, item.at) / 0.45) ** 2))))
  return spreadIn(area.id, 0.26, index * 13 + 7).map(({ at, density }) => {
    const near = nearSite(at)
    const family = density * (1 - 0.8 * near)
    const worker = Math.min(1, (1 - density) * lean + near)
    return family >= worker
      ? { at, weight: 0.08 + 1.2 * family ** 2.5, group: 'family-heat' }
      : { at, weight: 0.08 + 1.2 * (worker * (0.55 + 0.45 * (1 - density))) ** 2.5, group: 'worker-heat' }
  })
})

const SCHOOLS: Site[] = [
  { id: 's1', area: 'jvc', name: 'School · JVC district 12', at: [55.197, 25.052], rows: [['Seats', '2,400'], ['Enrolled', '104%']] },
  { id: 's2', area: 'jvc', name: 'School · JVC district 15', at: [55.206, 25.061], rows: [['Seats', '2,100'], ['Enrolled', '101%']] },
  { id: 's3', area: 'jvc', name: 'School · JVC district 18', at: [55.188, 25.0455], rows: [['Seats', '1,800'], ['Enrolled', '106%']] },
  { id: 's4', area: 'jvc', name: 'School · JVC district 10', at: [55.212, 25.0545], rows: [['Seats', '2,000'], ['Enrolled', '99%']] },
  { id: 's5', area: 'jvc', name: 'School · JVC district 14', at: [55.203, 25.0655], rows: [['Seats', '1,900'], ['Enrolled', '103%']] },
  { id: 's6', area: 'jvc', name: 'School · JVC district 16', at: [55.215, 25.061], rows: [['Seats', '1,600'], ['Enrolled', '100%']] },
  { id: 's7', area: 'arjan', name: 'School · Arjan', at: [55.2295, 25.059], rows: [['Seats', '2,300'], ['Enrolled', '108%']] },
  { id: 's8', area: 'arjan', name: 'School · Arjan north', at: [55.2425, 25.063], rows: [['Seats', '2,000'], ['Enrolled', '105%']] },
  { id: 's9', area: 'motor-city', name: 'School · Motor City', at: [55.233, 25.0505], rows: [['Seats', '1,900'], ['Enrolled', '102%']] },
  { id: 's10', area: 'motor-city', name: 'School · Motor City east', at: [55.2415, 25.0515], rows: [['Seats', '1,800'], ['Enrolled', '100%']] },
  { id: 's11', area: 'motor-city', name: 'School · Motor City south', at: [55.2465, 25.0475], rows: [['Seats', '1,500'], ['Enrolled', '97%']] },
]

const CLINICS_SITES: Site[] = [
  { id: 'c1', area: 'jvc', name: 'Primary health centre · JVC north', at: [55.2115, 25.0605], rows: [['Registered', '38,000'], ['Wait for a GP', '9 days']] },
  { id: 'c2', area: 'jvc', name: 'Primary health centre · JVC south', at: [55.193, 25.048], rows: [['Registered', '34,000'], ['Wait for a GP', '8 days']] },
  { id: 'c3', area: 'arjan', name: 'Primary health centre · Arjan', at: [55.236, 25.0605], rows: [['Registered', '29,000'], ['Wait for a GP', '11 days']] },
  { id: 'c4', area: 'motor-city', name: 'Primary health centre · Motor City', at: [55.239, 25.049], rows: [['Registered', '24,000'], ['Wait for a GP', '6 days']] },
]

/* —— Parks and public facilities: peak use against capacity —— */

const loadOf = (peak: number, capacity: number) => Math.round((peak / capacity) * 100)

/** Over capacity at peak is critical past 140%, stretched past 100%. */
const useColor = (pct: number) => (pct >= 140 ? STATUS.critical : pct >= 100 ? LEVEL.high : LEVEL.ok)

/** A public park: its size, the visitors it is laid out for, and its busiest hour's visitors, on a weekend evening. */
type Park = Site & { capacity: number; peak: number }

const park = (id: string, area: AreaId, name: string, at: LngLat, hectares: number, capacity: number, peak: number): Park => ({
  id,
  area,
  name,
  at,
  capacity,
  peak,
  rows: [
    ['Area', `${hectares} ha`],
    ['Capacity', `${fmt(capacity)} visitors`],
    ['Peak visitors', fmt(peak)],
    ['Use at peak', `${loadOf(peak, capacity)}% of capacity`],
  ],
})

const PARKS: Park[] = [
  park('p1', 'jvc', 'Community park · JVC', [55.2005, 25.0565], 2.1, 1800, 2950),
  park('p2', 'jvc', 'Pocket park · JVC east', [55.2135, 25.0505], 0.6, 500, 860),
  park('p4', 'jvc', 'Community park · JVC district 12', [55.1915, 25.0475], 1.2, 1000, 1480),
  park('p5', 'jvc', 'Park · JVC north', [55.2075, 25.0665], 1.5, 1300, 1820),
  park('p6', 'arjan', 'Arjan Park', [55.2395, 25.0585], 0.9, 800, 1390),
  park('p7', 'arjan', 'Pocket park · Arjan west', [55.2285, 25.0575], 0.4, 350, 520),
  park('p3', 'motor-city', 'Community park · Motor City', [55.2375, 25.0525], 3.4, 2900, 3250),
  park('p8', 'motor-city', 'Motor City Green', [55.2445, 25.0475], 1.1, 950, 880),
]

/** Sites (km, for paths), capacity and peak use of one DM facility type in an area, a day. */
type FacilityUse = [sites: number, capacity: number, peak: number]

const NONE: FacilityUse = [0, 0, 0]

/** The other DM-managed public facilities in each area. Beaches have none: the nearest is 8 km away. */
const FACILITY_USE: { name: string; kind: 'recreation' | 'amenity'; unit?: 'km'; by: Record<AreaId, FacilityUse> }[] = [
  { name: 'Playgrounds', kind: 'recreation', by: { jvc: [6, 1200, 1740], arjan: [2, 400, 620], 'motor-city': [4, 900, 930] } },
  { name: 'Sports and recreation', kind: 'recreation', by: { jvc: [3, 1500, 2100], arjan: [1, 500, 760], 'motor-city': [2, 1100, 1150] } },
  { name: 'Walking and cycling paths', kind: 'recreation', unit: 'km', by: { jvc: [12, 3000, 3900], arjan: [3, 800, 1120], 'motor-city': [9, 2400, 2050] } },
  { name: 'Squares and open spaces', kind: 'recreation', by: { jvc: [4, 2000, 2380], arjan: [1, 500, 640], 'motor-city': [2, 1200, 1050] } },
  { name: 'Community and leisure centres', kind: 'amenity', by: { jvc: [1, 600, 820], arjan: [1, 300, 450], 'motor-city': [1, 500, 520] } },
  { name: 'Public libraries', kind: 'amenity', by: { jvc: [1, 400, 520], arjan: NONE, 'motor-city': [1, 300, 240] } },
  { name: 'Public markets', kind: 'amenity', by: { jvc: [1, 2500, 3450], arjan: NONE, 'motor-city': [1, 1500, 1580] } },
  { name: 'Public toilets and amenities', kind: 'amenity', by: { jvc: [8, 2400, 3380], arjan: [2, 600, 900], 'motor-city': [5, 1500, 1500] } },
  { name: 'Waste and recycling', kind: 'amenity', by: { jvc: [5, 180, 226], arjan: [2, 60, 81], 'motor-city': [3, 110, 104] } },
  { name: 'Abattoirs and veterinary', kind: 'amenity', by: { jvc: [1, 80, 104], arjan: NONE, 'motor-city': NONE } },
  { name: 'Beaches and waterfront', kind: 'recreation', by: { jvc: NONE, arjan: NONE, 'motor-city': NONE } },
]

/* —— Public transport: walking distance from each residential unit to the nearest stop —— */

const STOP = PALETTE.categorical[0]

const STOPS: Site[] = [
  { id: 't1', area: 'jvc', name: 'Bus stop · JVC north', at: [55.2085, 25.0655], rows: [['Routes', 'F38, J01']] },
  { id: 't2', area: 'jvc', name: 'Bus stop · JVC east', at: [55.2145, 25.0585], rows: [['Routes', 'J01']] },
  { id: 't3', area: 'jvc', name: 'Bus stop · JVC circle', at: [55.2035, 25.0525], rows: [['Routes', 'J01, J02']] },
  { id: 't5', area: 'jvc', name: 'Bus stop · JVC south-east', at: [55.2185, 25.0515], rows: [['Routes', 'F38']] },
  { id: 't6', area: 'jvc', name: 'Bus stop · JVC south-west', at: [55.1905, 25.0455], rows: [['Routes', 'J02']] },
  { id: 't7', area: 'arjan', name: 'Bus stop · Arjan west', at: [55.2305, 25.0585], rows: [['Routes', 'F39']] },
  { id: 't8', area: 'arjan', name: 'Bus stop · Arjan north', at: [55.2425, 25.0625], rows: [['Routes', 'F39']] },
  { id: 't9', area: 'motor-city', name: 'Bus stop · Motor City west', at: [55.2335, 25.0495], rows: [['Routes', 'F40, 50']] },
  { id: 't10', area: 'motor-city', name: 'Bus stop · Motor City centre', at: [55.2415, 25.0505], rows: [['Routes', 'F40']] },
  { id: 't11', area: 'motor-city', name: 'Bus stop · Motor City east', at: [55.2465, 25.0465], rows: [['Routes', '50']] },
]

const ACCESS_BANDS = [
  { name: '0–400 m', color: LEVEL.ok },
  { name: '400–800 m', color: LEVEL.watch },
  { name: '800 m and above', color: STATUS.critical },
]

const ACCESS_RAMP = [LEVEL.ok, LEVEL.watch, LEVEL.high, STATUS.critical]

const bandOf = (km: number) => (km < 0.4 ? 0 : km < 0.8 ? 1 : 2)

/** Median monthly rent of a one-bedroom unit, AED thousands; peak one-way commute, minutes; jobs within 45 minutes by public transport, %. */
const HOUSING: Record<AreaId, { rent: number; commute: number; transit: number }> = {
  jvc: { rent: 5.4, commute: 41, transit: 63 },
  arjan: { rent: 4.6, commute: 46, transit: 52 },
  'motor-city': { rent: 5.5, commute: 40, transit: 67 },
}

/** How much longer a walk along the streets is than the straight line. */
const DETOUR = 1.3

/** Residential units across each area, each with its walk to the nearest stop, km. */
const WALKS = byArea((area, index) =>
  spreadIn(area.id, 0.2, index * 19 + 11).map(({ at }) => ({ at, km: DETOUR * Math.min(...STOPS.map((stop) => kmBetween(at, stop.at))) })),
)

const ACCESS_HEAT = byArea((area): EstateHeatPoint[] =>
  WALKS[area.id].map(({ at, km }) => ({ at, weight: 0.28 + 0.8 * Math.min(1, Math.max(0, (km - 0.2) / 0.9)) ** 1.2, group: 'access' })),
)

/** Share of an area's residential units in each walking band, %, summing to 100. */
const ACCESS_SHARE = byArea((area) => {
  const walks = WALKS[area.id]
  const [near, mid] = [0, 1].map((band) => Math.round((walks.filter((walk) => bandOf(walk.km) === band).length / walks.length) * 100))
  return [near, mid, 100 - near - mid]
})

/** The bands over `areas`, weighted by residents. */
const accessShare = (areas: GrowthArea[]) => {
  const residents = sumOf(areas, (area) => area.population)
  const [near, mid] = [0, 1].map((band) => Math.round(sumOf(areas, (area) => ACCESS_SHARE[area.id][band] * area.population) / residents))
  return [near, mid, 100 - near - mid]
}

const within = (areas: GrowthArea[]) => (item: Site) => areas.some((area) => area.id === item.area)

/** Parks in their use colour, and the stops they and the homes around them walk to. */
const parkPoints = (areas: GrowthArea[]): EstatePoint[] => [
  ...PARKS.filter(within(areas)).map((item) => site(useColor(loadOf(item.peak, item.capacity)), 'parks', 6.5)(item)),
  ...STOPS.filter(within(areas)).map(site(STOP, 'transit', 4.5)),
]

const parkUse = (areas: GrowthArea[]) => {
  const mine = PARKS.filter(within(areas))
  const capacity = mine.reduce((sum, item) => sum + item.capacity, 0)
  const peak = mine.reduce((sum, item) => sum + item.peak, 0)
  return { parks: mine, capacity, peak, pct: loadOf(peak, capacity) }
}

/* —— Map Data —— */

const growthLayer = (areas: GrowthArea[]): MapDataLayer => ({
  group: 'communities',
  title: 'Population growth since 2021',
  mark: 'area',
  color: { items: areas.map((area) => ({ label: area.name, color: growthColor(growthPct(area)), count: `+${growthPct(area)}%` })) },
})

const householdsLayer = (areas: GrowthArea[]): MapDataLayer => ({
  group: 'communities',
  title: 'Families with children, share of households',
  mark: 'area',
  color: { items: areas.map((area) => ({ label: area.name, color: FAMILY, count: `${HOUSEHOLDS[area.id].families}%` })) },
})

const workersLayer = (workers: number): MapDataLayer => ({
  group: 'workers',
  title: 'Worker accommodation',
  mark: 'point',
  color: { items: [{ label: 'Worker accommodation', color: WORKER, count: thousands(workers) }] },
  inline: true,
})

const parkUseLayer = (areas: GrowthArea[], pctOf = (area: GrowthArea) => parkUse([area]).pct): MapDataLayer => ({
  group: 'communities',
  title: 'Park use at peak, share of capacity',
  mark: 'area',
  color: { items: areas.map((area) => ({ label: area.name, color: useColor(pctOf(area)), count: `${pctOf(area)}%` })) },
})

const PARK_BANDS = [
  { label: 'Over 140% of capacity', color: STATUS.critical, in: (pct: number) => pct >= 140 },
  { label: '100–140% of capacity', color: LEVEL.high, in: (pct: number) => pct >= 100 && pct < 140 },
  { label: 'Within capacity', color: LEVEL.ok, in: (pct: number) => pct < 100 },
]

const parksLayer = (areas: GrowthArea[], pctOf = (item: Park) => loadOf(item.peak, item.capacity)): MapDataLayer => {
  const uses = PARKS.filter(within(areas)).map(pctOf)
  return {
    group: 'parks',
    title: 'Public parks',
    mark: 'point',
    color: {
      items: PARK_BANDS.map((band) => ({ label: band.label, color: band.color, count: `${uses.filter(band.in).length}` })).filter(
        (item) => item.count !== '0',
      ),
    },
  }
}

const transitLayer = (areas: GrowthArea[]): MapDataLayer => ({
  group: 'transit',
  title: 'Public transport stops',
  mark: 'point',
  color: { items: [{ label: 'Public transport stops', color: STOP, count: `${STOPS.filter(within(areas)).length}` }] },
  inline: true,
})

const shortageLayers = (areas: GrowthArea[]): MapDataLayer[] => [parkUseLayer(areas), parksLayer(areas), transitLayer(areas), LAYER.access]

const facilitiesLayer = (areas: GrowthArea[]): MapDataLayer => ({
  group: 'schools',
  title: 'Existing facilities',
  mark: 'point',
  color: {
    items: [
      { label: 'Schools', color: SCHOOL, count: `${SCHOOLS.filter(within(areas)).length}` },
      { label: 'Primary health centres', color: CLINIC, count: `${CLINICS_SITES.filter(within(areas)).length}` },
      { label: 'Parks', color: PARK, count: `${PARKS.filter(within(areas)).length}` },
    ],
  },
})

const LAYER = {
  population: { group: 'population', title: 'Where residents live', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer', high: 'More' } },
  familyHeat: { group: 'family-heat', title: 'Where families live', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer', high: 'More' } },
  workerHeat: { group: 'worker-heat', title: 'Where workers live', mark: 'heat', color: { ramp: WORKER_RAMP, low: 'Fewer', high: 'More' } },
  facilities: facilitiesLayer(AREA_LIST),
  access: { group: 'access', title: 'Walking distance to public transport', mark: 'heat', color: { ramp: ACCESS_RAMP, low: '0–400 m', high: '800 m+' } },
} satisfies Record<string, MapDataLayer>

/* —— The area filter: all three areas, or one close up —— */

const ALL_AREAS = 'all'

const AREA_PICKER: EstatePicker = {
  id: 'area',
  icon: 'place',
  lead: true,
  options: [{ id: ALL_AREAS, label: 'All areas' }, ...AREA_LIST.map((area) => ({ id: area.id, label: area.short }))],
}

/** Each area framed on its own, beside the story's insight column. */
const AREA_CAMERAS: Record<AreaId, EstateCamera> = {
  jvc: { center: [55.1962, 25.0531], zoom: 13.85, pitch: 56, bearing: -12 },
  arjan: { center: [55.2354, 25.0603], zoom: 14.85, pitch: 56, bearing: -12 },
  'motor-city': { center: [55.2385, 25.0478], zoom: 14.95, pitch: 56, bearing: -12 },
}

/** Facilities were planned for, thousands of residents, in the 2019 community plans. */
const PLANNED_FOR: Record<AreaId, number> = { jvc: 92, arjan: 38, 'motor-city': 35 }
const PLANNED_FOR_ALL = total((id) => PLANNED_FOR[id])

/** Average yearly growth, %, 2021–2026. */
const AVG_GROWTH: Record<AreaId, number> = { jvc: 8.6, arjan: 7.4, 'motor-city': 4.9 }
const AVG_GROWTH_ALL = 7.5

/**
 * One page's view for each area pick, built once: the same pick gives the same objects. `areas` are the
 * picked ones; comparison charts keep every area and set back those `dimmed` by the pick.
 */
function areaView(
  build: (area: GrowthArea | undefined, areas: GrowthArea[], dimmed: (item: GrowthArea) => boolean) => EstatePageView,
) {
  const views = new Map<string, EstatePageView>()
  return (picks: Readonly<Record<string, string>>): EstatePageView => {
    const area = AREA_LIST.find((item) => item.id === picks[AREA_PICKER.id])
    const key = area?.id ?? ALL_AREAS
    let view = views.get(key)
    if (!view) {
      view = build(area, area ? [area] : AREA_LIST, (item) => area !== undefined && item !== area)
      views.set(key, view)
    }
    return view
  }
}

const sumOf = (areas: GrowthArea[], of: (area: GrowthArea) => number) => areas.reduce((sum, area) => sum + of(area), 0)

/** The smallest round scale over `max`, with a little headroom. */
const scaleFor = (max: number) => [100, 200, 300, 400, 500].find((step) => step >= max * 1.1) ?? Math.ceil((max * 1.1) / 100) * 100

/* —— The story —— */

const FILTERS = ['2026', 'Community facilities']

const growthScene = (areas: GrowthArea[]) =>
  scene({
    heat: areas.flatMap((area) => POPULATION_HEAT[area.id]),
    heatUnder: false,
    ...areaOutlines(
      (area) => ({
        color: growthColor(growthPct(area)),
        level: growthPct(area) / 80,
        fill: 0.1,
        text: `${thousands(area.population)} residents · +${growthPct(area)}% since 2021`,
        rows: [
          ['Residents', `${fmt(area.population2021)} → ${fmt(area.population)}`],
          ['Growth', `+${growthPct(area)}% in 5 years`],
          ['Pipeline', `${fmt(area.pipeline)} residential units`],
        ],
      }),
      'communities',
      areas,
    ),
  })

const growthView = areaView((area, areas, dimmed) => {
  const population2021 = sumOf(areas, (item) => item.population2021)
  const population = sumOf(areas, (item) => item.population)
  const pipeline = sumOf(areas, (item) => item.pipeline)
  const newResidents = newResidentsFor(pipeline)
  const growth = growthPct({ population, population2021 })
  const plannedFor = area ? PLANNED_FOR[area.id] : PLANNED_FOR_ALL
  const residents = areas[0].byYear.map((_, year) => sumOf(areas, (item) => item.byYear[year]))
  const projected = [0, 1, 2, 3, 4].map((step) => Math.round(population / 1000 + (newResidents / 1000) * (step / 4)))
  const yMax = scaleFor(projected[projected.length - 1])
  return {
    camera: area ? AREA_CAMERAS[area.id] : AREAS_CAMERA,
    scene: growthScene(areas),
    layers: [growthLayer(areas), LAYER.population],
    cards: toned([
      {
        id: 'summary',
        kind: 'summary',
        title: 'Executive summary',
        parts: [
          `${area ? area.name : 'JVC, Arjan and Motor City'} grew from `,
          { em: [`${fmt(population2021)} to ${fmt(population)} residents`] },
          ` in five years, +${growth}%. `,
          { em: [`${fmt(pipeline)} more residential units`] },
          ` in the pipeline will add about ${thousands(newResidents)} more, yet ${area ? 'its' : 'their'} facilities were planned for ${plannedFor}k.`,
        ],
      },
      { id: 'residents', kind: 'cell', title: 'Residents', value: thousands(population), note: `+${growth}% since 2021` },
      { id: 'pipeline', kind: 'cell', title: 'Residential units in the pipeline', value: thousands(pipeline), note: `about ${thousands(newResidents)} more residents by 2030` },
      { id: 'rate', kind: 'cell', title: 'Avg. growth a year', value: `${area ? AVG_GROWTH[area.id] : AVG_GROWTH_ALL}%`, note: 'against 5.4% for Dubai' },
      {
        id: 'residents-trend',
        kind: 'line',
        title: 'Residents, thousands',
        height: 2,
        kpi: { value: `${Math.round(population / 1000 - plannedFor)}k`, unit: 'more than facilities were planned for' },
        x: ['2021', '2024', '2027', '2030'],
        yLabels: [4, 3, 2, 1, 0].map((step) => `${(yMax * step) / 4}`),
        yMax,
        series: [
          { name: 'Residents', points: [...residents, null, null, null, null] },
          { name: 'Projected', points: [null, null, null, null, null, ...projected], color: PALETTE.purple[2] },
          { name: 'Facilities planned for', points: Array.from({ length: 10 }, () => plannedFor), dashed: true },
        ],
      },
      {
        id: 'growth',
        kind: 'hbars',
        title: 'Population growth since 2021',
        bars: AREA_LIST.map((item) => ({ label: item.short, value: growthPct(item), display: `+${growthPct(item)}%`, color: growthColor(growthPct(item)), dim: dimmed(item) })),
      },
      {
        id: 'pipeline-by-area',
        kind: 'vbars',
        title: 'Residential units in the pipeline, thousands',
        bars: AREA_LIST.map((item) => ({ label: item.short, value: item.pipeline / 1000, display: thousands(item.pipeline), dim: dimmed(item) })),
      },
    ]),
  }
})

const demographicView = areaView((area, areas, dimmed) => {
  const children = sumOf(areas, (item) => HOUSEHOLDS[item.id].children)
  const workers = sumOf(areas, (item) => HOUSEHOLDS[item.id].workerResidents)
  const families = sumOf(areas, (item) => (item.population * HOUSEHOLDS[item.id].families) / 100)
  const shareOfAll = (value: number, of: number) => `${Math.round((value / of) * 100)}% of the three areas`
  return {
    camera: area ? AREA_CAMERAS[area.id] : { center: [55.2135, 25.0545], zoom: 13.75, pitch: 56, bearing: 8 },
    scene: scene({
      heat: areas.flatMap((item) => GROUP_HEAT[item.id]),
      heatRamps: { 'family-heat': HEAT_RAMP, 'worker-heat': WORKER_RAMP },
      heatUnder: false,
      points: WORKER_HOUSING.filter(within(areas)).map(site(WORKER, 'workers', 6.5)),
      ...areaOutlines(
        (item) => ({
          color: FAMILY,
          level: HOUSEHOLDS[item.id].families / 70,
          text: `Families ${HOUSEHOLDS[item.id].families}% · ${thousands(HOUSEHOLDS[item.id].workerResidents)} workers`,
          rows: [
            ['Families with children', `${HOUSEHOLDS[item.id].families}% of households`],
            ['School-age children', fmt(HOUSEHOLDS[item.id].children)],
            ['Workers in shared housing', fmt(HOUSEHOLDS[item.id].workerResidents)],
          ],
        }),
        'communities',
        areas,
      ),
    }),
    layers: [householdsLayer(areas), LAYER.familyHeat, LAYER.workerHeat, workersLayer(workers)],
    cards: toned([
      {
        id: 'summary',
        kind: 'summary',
        title: 'Executive summary',
        parts: [
          'The growth is ',
          { em: ['families and workers'] },
          area
            ? `: households with children are ${HOUSEHOLDS[area.id].families}% of ${area.name}.`
            : `: households with children are ${HOUSEHOLDS.jvc.families}% of JVC and ${HOUSEHOLDS['motor-city'].families}% of Motor City.`,
        ],
      },
      { id: 'children', kind: 'cell', title: 'School-age children', value: thousands(children), note: area ? shareOfAll(children, CHILDREN) : '+64% since 2021' },
      { id: 'workers', kind: 'cell', title: 'Workers', value: thousands(workers), note: area ? shareOfAll(workers, WORKERS) : `${thousands(HOUSEHOLDS.arjan.workerResidents)} in Arjan` },
      {
        id: 'mix',
        kind: 'grouped',
        title: 'Household mix, % of households',
        legend: ['Families', 'Workers'],
        colors: [FAMILY, WORKER],
        groups: AREA_LIST.map((item) => ({ label: item.short, values: [HOUSEHOLDS[item.id].families, HOUSEHOLDS[item.id].workers], dim: dimmed(item) })),
      },
      {
        id: 'needs',
        kind: 'table',
        title: 'What each group needs nearby',
        columns: ['Group', 'Residents', 'Needs'],
        dotColumn: 0,
        rows: [
          { cells: ['Families with children', thousands(families), 'Public parks, public libraries'], color: FAMILY },
          { cells: ['Workers', thousands(workers), 'Transport, public markets'], color: WORKER },
        ],
      },
      {
        id: 'groups',
        kind: 'donut',
        title: 'Residents by group',
        total: thousands(families + workers),
        totalLabel: 'in these groups',
        slices: [
          { name: 'Families', value: families / 1000, color: FAMILY },
          { name: 'Workers', value: workers / 1000, color: WORKER },
        ],
      },
      area
        ? { id: 'families-share', kind: 'cell', title: 'Families with children', value: `${HOUSEHOLDS[area.id].families}%`, note: 'of households' }
        : { id: 'families-share', kind: 'cell', title: 'Families with children', value: '47%', note: 'of households, up from 34% in 2021' },
    ]),
  }
})

const shortageOutlines = (areas: GrowthArea[] = AREA_LIST) =>
  areaOutlines(
    (area) => {
      const use = parkUse([area])
      return {
        color: useColor(use.pct),
        level: 0,
        fill: 0.06,
        text: `Parks at ${use.pct}% of capacity`,
        rows: [
          ['Public parks', `${use.parks.length}, for ${fmt(use.capacity)} visitors`],
          ['Peak visitors', fmt(use.peak)],
          ['Within 400 m of transport', `${ACCESS_SHARE[area.id][0]}% of residential units`],
          ['Over 800 m from transport', `${ACCESS_SHARE[area.id][2]}%`],
        ],
      }
    },
    'communities',
    areas,
  )

const shortageScene = (areas: GrowthArea[] = AREA_LIST) =>
  scene({
    heat: areas.flatMap((area) => ACCESS_HEAT[area.id]),
    heatRamp: ACCESS_RAMP,
    heatRadiusM: 280,
    heatUnder: false,
    points: parkPoints(areas),
    ...shortageOutlines(areas),
  })

const SHORTAGE_SCENE = shortageScene()

const shortageView = areaView((area, areas, dimmed) => {
  const use = parkUse(areas)
  const over = use.parks.filter((item) => item.peak > item.capacity).length
  const access = accessShare(areas)
  const facilities = FACILITY_USE.map((facility) => {
    const [sites, capacity, peak] = [0, 1, 2].map((index) => sumOf(areas, (item) => facility.by[item.id][index]))
    return { name: facility.name, kind: facility.kind, unit: facility.unit, sites, pct: capacity ? loadOf(peak, capacity) : 0 }
  })
  const present = facilities.filter((facility) => facility.sites > 0).sort((a, b) => b.pct - a.pct)
  const absent = facilities.filter((facility) => facility.sites === 0)
  const rowsOf = (kind: 'recreation' | 'amenity') => [
    ...present
      .filter((facility) => facility.kind === kind)
      .map((facility) => ({
        cells: [facility.name, facility.unit ? `${facility.sites} ${facility.unit}` : `${facility.sites}`, `${facility.pct}%`],
        color: useColor(facility.pct),
      })),
    ...absent
      .filter((facility) => facility.kind === kind)
      .map((facility) => ({
        cells: [facility.name, '0', facility.name === 'Beaches and waterfront' ? 'Nearest 8 km' : 'None nearby'],
        color: STATUS.critical,
      })),
  ]
  const [first, second, third] = present.slice(0, 3).map((facility) => `${facility.name.toLowerCase()} (${facility.pct}%)`)
  const status = use.pct >= 140 ? 'critical' : use.pct >= 100 ? 'moderate' : 'good'
  const residents = sumOf(areas, (item) => item.population)
  const housing = (key: keyof (typeof HOUSING)[AreaId]) => sumOf(areas, (item) => HOUSING[item.id][key] * item.population) / residents
  return {
    camera: area ? AREA_CAMERAS[area.id] : { center: [55.2145, 25.0525], zoom: 13.55, pitch: 58, bearing: -22 },
    scene: area ? shortageScene(areas) : SHORTAGE_SCENE,
    layers: shortageLayers(areas),
    cards: toned([
      {
        id: 'summary',
        kind: 'summary',
        title: 'Executive summary',
        parts: [
          area ? `Public parks are the most stretched facility in ${area.name}: ` : 'Public parks are the most stretched facility: ',
          { em: [`they run at ${use.pct}% of capacity at peak`] },
          `, and ${over} of ${use.parks.length} ${over === 1 ? 'is' : 'are'} over capacity. ${first[0].toUpperCase()}${first.slice(1)}, ${second} and ${third} are also stretched. ${access[2]}% of residential units are 800 m or more from public transport, and ${access[0]}% within a 400 m walk.`,
        ],
      },
      {
        id: 'park-use',
        kind: 'cell',
        title: 'Park use at peak',
        value: `${use.pct}%`,
        note: `of capacity, ${thousands(use.peak)} visitors for ${thousands(use.capacity)}`,
        status,
      },
      { id: 'transit-near', kind: 'cell', title: 'Near public transport', value: `${access[0]}%`, note: 'of residential units within a 400 m walk' },
      { id: 'rent', kind: 'cell', title: 'Median rent', value: `AED ${housing('rent').toFixed(1)}k`, note: 'a month, one-bedroom unit' },
      { id: 'commute', kind: 'cell', title: 'Commute', value: `${Math.round(housing('commute'))} min`, note: 'one way to work, at peak' },
      { id: 'transit-access', kind: 'cell', span: 'block', title: 'Transit access', value: `${Math.round(housing('transit'))}%`, note: 'of jobs within 45 min by public transport' },
      {
        id: 'recreation',
        kind: 'table',
        title: 'Parks and recreation, peak use against capacity',
        height: 2,
        columns: ['Facility', 'Sites', 'Use at peak'],
        dotColumn: 0,
        rows: [{ cells: ['Public parks', `${use.parks.length}`, `${use.pct}%`], color: useColor(use.pct) }, ...rowsOf('recreation')],
      },
      {
        id: 'park-use-by-area',
        kind: 'hbars',
        title: 'Park use at peak, by community',
        bars: AREA_LIST.map((item) => {
          const pct = parkUse([item]).pct
          return { label: item.short, value: pct, display: `${pct}%`, color: useColor(pct), dim: dimmed(item) }
        }),
      },
      {
        id: 'amenities',
        kind: 'table',
        title: 'Public amenities, peak use against capacity',
        height: 2,
        columns: ['Facility', 'Sites', 'Use at peak'],
        dotColumn: 0,
        rows: rowsOf('amenity'),
      },
      {
        id: 'access',
        kind: 'donut',
        title: 'Walking distance to public transport',
        total: `${access[0]}%`,
        totalLabel: 'within 400 m',
        slices: ACCESS_BANDS.map((band, index) => ({ name: band.name, value: access[index], color: band.color })),
      },
      {
        id: 'access-far',
        kind: 'hbars',
        title: 'Residential units 800 m or more from transport',
        bars: AREA_LIST.map((item) => ({
          label: item.short,
          value: ACCESS_SHARE[item.id][2],
          display: `${ACCESS_SHARE[item.id][2]}%`,
          color: STATUS.critical,
          dim: dimmed(item),
        })),
      },
      {
        id: 'conclusion',
        kind: 'note',
        title: 'Preliminary conclusion',
        text: area
          ? `Public parks and amenities in ${area.name} have not kept pace with its growth, and ${access[2]}% of its residential units are 800 m or more from public transport. Without new capacity, the ${fmt(area.pipeline)} residential units in its pipeline will stretch them further.`
          : `Public parks and amenities in JVC, Arjan and Motor City have not kept pace with their growth, and ${access[2]}% of residential units are 800 m or more from public transport. Without new capacity, the ${fmt(TOTALS.pipeline)} residential units in the pipeline will stretch them further.`,
      },
    ]),
  }
})

export const FACILITIES_STORY: EstateStory = {
  id: 'dm-facilities',
  title: 'Community Facilities Use Case',
  description:
    'How LLUMEN links fast population growth in JVC, Arjan and Motor City to the families and workers moving there, and confirms the schools, health centres, nurseries and parks they need are in short supply.',
  place: 'facilities',
  pages: [
    {
      id: 'dm-facilities-growth',
      title: 'Population Growth Outpacing Facility Planning',
      finding:
        'Population records show JVC, Arjan and Motor City growing far faster than the rest of Dubai, with thousands more residential units committed. Their community facilities were planned for a much smaller population.',
      ...growthView({}),
      filters: FILTERS,
      pickers: [AREA_PICKER],
      view: growthView,
    },
    {
      id: 'dm-facilities-demographics',
      title: 'Demographic profile',
      finding:
        'Tenancy and residency records show most new residents are families with children and workers in shared accommodation, the two groups that rely most on local schools, health care, nurseries, parks and transport.',
      ...demographicView({}),
      filters: FILTERS,
      pickers: [AREA_PICKER],
      view: demographicView,
    },
    {
      id: 'dm-facilities-shortage',
      title: 'Facility Shortage Confirmed',
      finding:
        'Comparing peak use with capacity confirms public parks are the most stretched facility, with playgrounds, sports facilities and public amenities close behind, and many residential units beyond a short walk of public transport.',
      ...shortageView({}),
      filters: FILTERS,
      pickers: [AREA_PICKER],
      view: shortageView,
    },
  ],
}

export const FACILITIES_PLACE: EstatePlace = {
  id: 'facilities',
  camera: { center: [55.2125, 25.0545], zoom: 13.4, pitch: 56, bearing: -12 },
  scene: growthScene(AREA_LIST),
}

/* —— Simulate recommended actions: the baseline forecast, then three options weighed in each horizon —— */

const HORIZONS: Horizon[] = ['immediate', 'intermediate', 'long']

/** Each horizon is assessed against the baseline for its date: today, in 2 years and in 5. */
const ASSESSED: Record<Horizon, string> = { immediate: 'Today', intermediate: 'In 2 years', long: 'In 5 years' }

/** Share of the pipeline's new residents moved in by each assessment date. */
const MOVED_IN: Record<Horizon, number> = { immediate: 0, intermediate: 0.4, long: 1 }

/** Average time to reach a park or community facility without action, minutes, as more residents compete for it. */
const ACCESS_MIN: Record<Horizon, number> = { immediate: 12, intermediate: 15, long: 19 }

/** Residents the facilities serve: what the 2019 plans sized them for, unchanged until capacity is added. */
const CAPACITY = PLANNED_FOR_ALL * 1000

const residentsBy = (area: GrowthArea, horizon: Horizon) => area.population + MOVED_IN[horizon] * newResidentsFor(area.pipeline)

const nearest = (value: number, step = 1000) => Math.round(value / step) * step

const coverage = (capacity: number, population: number) => Math.round((capacity / population) * 100)

/** The baseline forecast at a horizon's assessment date, with no action taken. */
const baseline = (horizon: Horizon) => {
  const population = sumOf(AREA_LIST, (area) => residentsBy(area, horizon))
  return { population, capacity: CAPACITY, gap: population - CAPACITY, coverage: coverage(CAPACITY, population), access: ACCESS_MIN[horizon] }
}

type FacilityOption = {
  code: 'A' | 'B' | 'C'
  action: string
  asset: string
  benefit: string
  /** Effective capacity it adds, %; months to deliver; cost, AED millions. */
  gain: number
  months: number
  cost: number
}

/** A horizon's decision: its three options, the one preferred, where that lands, and what the comparison map reads. */
type FacilityDecision = {
  options: FacilityOption[]
  preferred: FacilityOption['code']
  title: string
  summary: (option: (code: FacilityOption['code']) => FacilityOption) => string
  sites: { name: string; at: LngLat; becomes: string }[]
  /** Average access time once the preferred option lands, minutes. */
  access: number
  labels: [before: string, after: string]
  mapNote: string
}

const duration = (months: number) => (months >= 24 ? `${months / 12} years` : `${months} month${months === 1 ? '' : 's'}`)
const aed = (millions: number) => (millions < 1 ? `AED ${millions * 1000}k` : `AED ${millions}M`)
const valueFor = (option: FacilityOption) => {
  const per = option.gain / option.cost
  return `${per >= 5 ? Math.round(per) : per.toFixed(1)}% per AED 1M`
}

const DECISIONS: Record<Horizon, FacilityDecision> = {
  immediate: {
    options: [
      {
        code: 'A',
        action: 'Extend operating hours',
        asset: 'Parks, sports halls and community centres',
        benefit: 'Opens earlier and later, spreading the evening peak over more hours',
        gain: 8,
        months: 1,
        cost: 1,
      },
      {
        code: 'B',
        action: 'Optimize appointment scheduling',
        asset: 'Online booking for courts, halls and park zones',
        benefit: 'Time slots fill the quiet hours and end overbooking at peak',
        gain: 12,
        months: 2,
        cost: 0.8,
      },
      {
        code: 'C',
        action: 'Redistribute service demand',
        asset: 'Live occupancy signs and nearby-park alerts',
        benefit: 'Steers visitors from full parks to ones with room',
        gain: 10,
        months: 3,
        cost: 1,
      },
    ],
    preferred: 'B',
    title: 'Optimize scheduling',
    summary: (option) =>
      `Open online booking for courts, halls and park zones so visits move into the quiet hours. Of the three immediate options it adds the most effective capacity, +${option('B').gain}%, at the best value, within ${duration(option('B').months)}.`,
    sites: [
      { name: 'Community centre · JVC', at: [55.2045, 25.0595], becomes: 'Halls and courts on booking' },
      { name: 'Sports hall · Arjan', at: [55.2345, 25.061], becomes: 'Courts on booking' },
      { name: 'Sports hall · Motor City', at: [55.2405, 25.049], becomes: 'Courts and pitches on booking' },
    ],
    access: 10,
    labels: ['Today', 'With scheduling optimized'],
    mapNote: 'The upper map shows park use today, the lower once scheduling is optimized. The heat marks where park demand runs furthest past capacity.',
  },
  intermediate: {
    options: [
      {
        code: 'A',
        action: 'Expand existing facilities',
        asset: 'Community parks in JVC and Motor City',
        benefit: 'Adds courts, play areas and shade on spare land inside today’s parks',
        gain: 20,
        months: 12,
        cost: 11.8,
      },
      {
        code: 'B',
        action: 'Repurpose municipal assets',
        asset: '3 vacant DM plots and buildings',
        benefit: 'Turns unused municipal land into pocket parks, courts and a community hall',
        gain: 15,
        months: 8,
        cost: 6,
      },
      {
        code: 'C',
        action: 'Upgrade underserved facilities',
        asset: 'Arjan Park and the pocket parks',
        benefit: 'Lighting, shade and surfaces that lift how many visitors each park can take',
        gain: 18,
        months: 10,
        cost: 9,
      },
    ],
    preferred: 'B',
    title: 'Repurpose municipal assets',
    summary: (option) =>
      `Turn three vacant DM plots and buildings into pocket parks, courts and a community hall. It adds less than expanding today’s facilities, +${option('B').gain}% against +${option('A').gain}%, but at the best value of the three and in ${duration(option('B').months)} rather than ${duration(option('A').months)}.`,
    sites: [
      { name: 'Vacant DM plot · JVC north', at: [55.205, 25.0635], becomes: 'Pocket park and courts' },
      { name: 'DM building · Arjan', at: [55.24, 25.0605], becomes: 'Community hall' },
      { name: 'Vacant DM plot · JVC south', at: [55.2015, 25.0475], becomes: 'Pocket park and playground' },
    ],
    access: 13,
    labels: ['In 2 years, no action', 'In 2 years, assets repurposed'],
    mapNote: 'The upper map shows park use in 2 years with no action, the lower with the three municipal assets repurposed. The heat marks where park demand runs furthest past capacity.',
  },
  long: {
    options: [
      {
        code: 'A',
        action: 'Construct new facilities',
        asset: '2 community parks, a sports centre and a library',
        benefit: 'Permanent capacity where demand runs furthest past it',
        gain: 35,
        months: 36,
        cost: 29,
      },
      {
        code: 'B',
        action: 'Develop integrated community hubs',
        asset: 'Park, sports, library and services on shared sites',
        benefit: 'The largest gain, but the longest to deliver',
        gain: 40,
        months: 60,
        cost: 40,
      },
      {
        code: 'C',
        action: 'Revise facility planning requirements',
        asset: 'Community facility standards for new permits',
        benefit: 'New developments provide facilities in step with their residents',
        gain: 30,
        months: 48,
        cost: 20,
      },
    ],
    preferred: 'A',
    title: 'Construct new facilities',
    summary: (option) =>
      `Build two community parks, a sports centre and a library where demand runs furthest past capacity: +${option('A').gain}% in ${duration(option('A').months)}. Community hubs add more, +${option('B').gain}%, but take ${duration(option('B').months)}, and revised planning rules only help as new permits complete.`,
    sites: [
      { name: 'Community park · JVC south-west', at: [55.186, 25.0405], becomes: 'New 3 ha park' },
      { name: 'Sports centre · JVC east', at: [55.218, 25.0625], becomes: 'Courts, pool and pitches' },
      { name: 'Community park · Arjan east', at: [55.2475, 25.0605], becomes: 'New 2 ha park' },
      { name: 'Library · Motor City west', at: [55.2325, 25.0485], becomes: 'Library and community centre' },
    ],
    access: 14,
    labels: ['In 5 years, no action', 'In 5 years, new facilities built'],
    mapNote: 'The upper map shows park use in 5 years with no action, the lower with the four new facilities built. The heat marks where park demand runs furthest past capacity.',
  },
}

const optionOf = (decision: FacilityDecision) => (code: FacilityOption['code']) =>
  decision.options.find((option) => option.code === code) ?? decision.options[0]

/** Park use at a horizon's assessment date: more residents at the peak, and `gain`% more capacity to share. */
const projectedUse = (horizon: Horizon, gain: number) => {
  const scale = (id: AreaId) => residentsBy(AREAS[id], horizon) / AREAS[id].population / (1 + gain / 100)
  return {
    park: (item: Park) => loadOf(item.peak * scale(item.area), item.capacity),
    area: (area: GrowthArea) => {
      const use = parkUse([area])
      return loadOf(use.peak * scale(area.id), use.capacity)
    },
  }
}

/** How strongly an area's residents show in the demand heat: faint within capacity, full far past it. */
const strain = (pct: number) => Math.min(1, Math.max(0.06, (pct - 90) / 80))

const DEMAND_LAYER: MapDataLayer = { group: 'demand', title: 'Park demand past capacity', mark: 'heat', color: { ramp: GAP_RAMP, low: 'Near capacity', high: 'Far past' } }

/**
 * Park use as a map reads it at a horizon's date, without action or with its preferred option. The baseline
 * and the solution draw the same layers, so the two halves of the comparison read directly.
 */
function simulateView(horizon: Horizon, decision?: FacilityDecision, compare?: EstateAskView['compare']): EstateAskView {
  const pick = decision && optionOf(decision)(decision.preferred)
  const gain = pick?.gain ?? 0
  const use = projectedUse(horizon, gain)
  const color = HORIZON_COLOR[horizon]
  const outlines = areaOutlines((area) => {
    const pct = use.area(area)
    return {
      color: useColor(pct),
      level: 0,
      fill: 0.06,
      text: `Parks at ${pct}% of capacity`,
      rows: [
        ['Residents', fmt(nearest(residentsBy(area, horizon)))],
        ['Park use at peak', `${pct}% of capacity`],
      ],
    }
  })
  const parks = PARKS.map((item): EstatePoint => {
    const pct = use.park(item)
    return {
      id: `parks-${item.id}`,
      at: item.at,
      color: useColor(pct),
      radius: 6.5,
      group: 'parks',
      tip: {
        title: item.name,
        rows: [
          ['Capacity', `${fmt(nearest(item.capacity * (1 + gain / 100), 10))} visitors`],
          ['Use at peak', `${pct}% of capacity`],
        ],
      },
    }
  })
  const sites = (decision?.sites ?? []).map(
    (item, index): EstatePoint => ({ id: `${horizon}-site-${index}`, at: item.at, color, radius: 7, group: 'actions', tip: { title: item.name, rows: [['Becomes', item.becomes]] } }),
  )
  const tip: EstateLabel[] =
    pick && decision
      ? [
          {
            id: `${horizon}-preferred`,
            at: decision.sites[0].at,
            heightM: 0,
            color,
            title: `${pick.code} · ${pick.action}`,
            text: '',
            rows: [
              ['Capacity', `+${pick.gain}%`],
              ['Delivered in', duration(pick.months)],
            ],
            group: 'actions',
          },
        ]
      : []
  const preferred: MapDataLayer[] = pick
    ? [{ group: 'actions', title: 'Preferred option', mark: 'point', color: { items: [{ label: `${pick.code} · ${pick.action}`, color, count: `${sites.length}` }] } }]
    : []
  return {
    camera: AREAS_ASK_CAMERA,
    scene: scene({
      heat: AREA_LIST.flatMap((area) => {
        const weight = strain(use.area(area))
        return POPULATION_HEAT[area.id].map((point) => ({ ...point, weight: point.weight * weight, group: 'demand' }))
      }),
      heatRamp: GAP_RAMP,
      heatUnder: false,
      points: [...parks, ...sites],
      areas: outlines.areas,
      labels: [...outlines.labels, ...tip],
    }),
    layers: [...preferred, parkUseLayer(AREA_LIST, use.area), parksLayer(AREA_LIST, use.park), DEMAND_LAYER],
    compare,
  }
}

/** A horizon's decision as a solution: the baseline it is measured against, its three options and the one preferred. */
function facilitySolution(horizon: Horizon): PlanningSolution {
  const decision = DECISIONS[horizon]
  const option = optionOf(decision)
  const pick = option(decision.preferred)
  const before = baseline(horizon)
  const capacity = CAPACITY * (1 + pick.gain / 100)
  const best = Math.max(...decision.options.map((item) => item.gain))
  return {
    title: decision.title,
    summary: decision.summary(option),
    span: HORIZON_SPAN[horizon],
    meta: `Coverage ${before.coverage}% → ${coverage(capacity, before.population)}%`,
    mapNote: decision.mapNote,
    stats: [
      { label: 'Residents served', value: `${before.coverage}% → ${coverage(capacity, before.population)}%` },
      { label: 'Capacity gap, residents', value: `${fmt(nearest(before.gap))} → ${fmt(nearest(before.population - capacity))}` },
      { label: 'Average access time', value: `${before.access} → ${decision.access} min` },
      { label: 'Cost', value: aed(pick.cost) },
    ],
    chart: {
      type: 'bars',
      title: 'Effective capacity added, by option',
      value: `+${pick.gain}%`,
      unit: `from the preferred option, ${pick.code}`,
      color: HORIZON_COLOR[horizon],
      rows: decision.options.map((item) => ({ label: `${item.code} ${item.action}`, value: (item.gain / best) * 100, display: `+${item.gain}%` })),
    },
    actionsHeading: 'Options compared',
    actions: decision.options.map((item) => ({
      code: item.code,
      title: item.action,
      subtitle: item.asset,
      detail: item.benefit,
      metrics: [...(item === pick ? ['Preferred'] : []), `+${item.gain}% capacity`, duration(item.months), valueFor(item)],
    })),
  }
}

export const FACILITIES_SOLUTIONS: Record<Horizon, PlanningSolution> = {
  immediate: facilitySolution('immediate'),
  intermediate: facilitySolution('intermediate'),
  long: facilitySolution('long'),
}

const solutionView = (horizon: Horizon) =>
  simulateView(horizon, DECISIONS[horizon], { before: simulateView(horizon), labels: DECISIONS[horizon].labels })

export const FACILITIES_ASK_VIEWS = {
  facilities: {
    camera: AREAS_ASK_CAMERA,
    scene: SHORTAGE_SCENE,
    layers: shortageLayers(AREA_LIST),
  },
  'facilities-immediate': solutionView('immediate'),
  'facilities-intermediate': solutionView('intermediate'),
  'facilities-long': solutionView('long'),
} satisfies Record<string, EstateAskView>

/** The briefing's figures, for the Simulate reply. */
export const FACILITIES_BRIEFING = {
  population2021: TOTALS.population2021,
  population: TOTALS.population,
  growth: TOTAL_GROWTH,
  pipeline: TOTALS.pipeline,
  newResidents: TOTALS.newResidents,
  children: CHILDREN,
  workers: WORKERS,
  familiesJvc: HOUSEHOLDS.jvc.families,
  familiesMotorCity: HOUSEHOLDS['motor-city'].families,
  seatGap: SEAT_GAP,
  clinics: CLINICS,
  clinicsNeeded: CLINICS_NEEDED,
  parkAccess: PARK_ACCESS,
  plannedFor: PLANNED_FOR_ALL,
  /** The baseline forecast today, in 2 years and in 5, with no action taken. */
  baseline: HORIZONS.map((horizon) => ({ label: ASSESSED[horizon], ...baseline(horizon) })),
  parkUse: parkUse(AREA_LIST).pct,
  farFromTransport: accessShare(AREA_LIST)[2],
  /** Share of need met, %, for the reply's chart. */
  met: [
    { label: 'School seats', value: Math.round((SEATS / SEATS_NEEDED) * 100) },
    { label: 'Health centres', value: Math.round((CLINICS / CLINICS_NEEDED) * 100) },
    { label: 'Nurseries', value: Math.round((NURSERIES / NURSERIES_NEEDED) * 100) },
    { label: 'Park access', value: Math.round((PARK_ACCESS / PARK_TARGET) * 100) },
    { label: 'Worker clinics', value: 33 },
  ],
}
