/**
 * Urban Planning use case 1, community facilities: JVC, Arjan and Motor City have grown fast, mostly with
 * families and workers, and their schools, health centres, nurseries and parks have not kept pace. Three
 * findings (growth, who the new residents are, the shortage confirmed); the horizon maps and solutions serve
 * Simulate recommended actions. Every value is an illustrative example.
 */
import { scatter, type LngLat } from '../realEstate/estateGeo'
import type { EstateHeatPoint, EstatePoint } from '../realEstate/estateMapLayers'
import {
  PALETTE,
  STATUS,
  type EstateAskView,
  type EstatePlace,
  type EstateStory,
  type Horizon,
  type MapDataLayer,
} from '../realEstate/estateTypes'
import { HORIZON_COLOR, LEVEL, toned } from './dmShared'
import {
  AREA_LIST,
  AREAS,
  AREAS_ASK_CAMERA,
  AREAS_CAMERA,
  GAP_RAMP,
  HEAT_RAMP,
  TOTAL_GROWTH,
  TOTALS,
  actionMarks,
  areaOutlines,
  fmt,
  growthPct,
  horizonOutlines,
  labelAt,
  planningSolution,
  scene,
  thousands,
  type AreaId,
  type PlanningAction,
  type PlanningSolution,
} from './growthAreas'

/* —— Who lives there, and what they have nearby —— */

type Households = {
  /** Share of households, %: families with children, workers in shared housing, singles and couples. */
  families: number
  workers: number
  others: number
  /** School-age children, and workers living in shared accommodation. */
  children: number
  workerResidents: number
}

const HOUSEHOLDS: Record<AreaId, Households> = {
  jvc: { families: 46, workers: 12, others: 42, children: 26400, workerResidents: 9800 },
  arjan: { families: 41, workers: 31, others: 28, children: 10400, workerResidents: 14600 },
  'motor-city': { families: 52, workers: 10, others: 38, children: 9700, workerResidents: 5100 },
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

const seatGap = (id: AreaId) => PROVISION[id].seatsNeeded - PROVISION[id].seats

/* —— Map pieces —— */

const FAMILY = PALETTE.purple[3]
const WORKER = PALETTE.categorical[5]
const SCHOOL = PALETTE.blue[3]
const CLINIC = PALETTE.teal[2]
const PARK = PALETTE.categorical[3]

const growthColor = (pct: number) => (pct >= 60 ? STATUS.critical : pct >= 45 ? LEVEL.high : LEVEL.watch)

const POPULATION_HEAT: EstateHeatPoint[] = AREA_LIST.flatMap((area, index) =>
  scatter(labelAt(area.id), Math.round(area.population / 2500), area.id === 'jvc' ? 1.5 : 0.85, index * 11 + 5).map((at) => ({
    at,
    weight: Math.min(1, 0.35 + growthPct(area) / 110),
    group: 'population',
  })),
)

const FAMILY_HEAT: EstateHeatPoint[] = AREA_LIST.flatMap((area, index) =>
  scatter(labelAt(area.id), Math.round(HOUSEHOLDS[area.id].children / 700), area.id === 'jvc' ? 1.5 : 0.85, index * 13 + 7).map((at) => ({
    at,
    weight: HOUSEHOLDS[area.id].families / 55,
    group: 'families',
  })),
)

/** Homes more than 1 km from a school with seats, where they cluster. */
const UNDERSERVED: [LngLat, number][] = [
  [[55.184, 25.0425], 1],
  [[55.2165, 25.064], 0.9],
  [[55.199, 25.0605], 0.7],
  [[55.2465, 25.0595], 0.85],
  [[55.2305, 25.0485], 0.6],
]

const UNDERSERVED_HEAT: EstateHeatPoint[] = UNDERSERVED.flatMap(([center, weight], index) =>
  scatter(center, 26, 0.55, index * 17 + 3).map((at) => ({ at, weight, group: 'underserved' })),
)

type Site = { id: string; name: string; at: LngLat; rows: [string, string][] }

const site = (color: string, group: string, radius = 5.5) => (item: Site): EstatePoint => ({
  id: `${group}-${item.id}`,
  at: item.at,
  color,
  radius,
  group,
  tip: { title: item.name, rows: item.rows },
})

const WORKER_HOUSING: Site[] = [
  { id: 'w1', name: 'Worker accommodation · Arjan east', at: [55.2455, 25.0585], rows: [['Residents', '6,200'], ['Occupancy', '112% of permitted beds']] },
  { id: 'w2', name: 'Worker accommodation · Arjan north', at: [55.2465, 25.0645], rows: [['Residents', '5,100'], ['Occupancy', '104%']] },
  { id: 'w3', name: 'Worker accommodation · Arjan west', at: [55.2265, 25.0605], rows: [['Residents', '3,300'], ['Occupancy', '98%']] },
  { id: 'w4', name: 'Worker accommodation · JVC south', at: [55.179, 25.0385], rows: [['Residents', '5,400'], ['Occupancy', '101%']] },
  { id: 'w5', name: 'Worker accommodation · JVC east', at: [55.2185, 25.056], rows: [['Residents', '4,400'], ['Occupancy', '96%']] },
  { id: 'w6', name: 'Worker accommodation · Motor City', at: [55.249, 25.0475], rows: [['Residents', '5,100'], ['Occupancy', '99%']] },
]

const SCHOOLS: Site[] = [
  { id: 's1', name: 'School · JVC district 12', at: [55.197, 25.052], rows: [['Seats', '2,400'], ['Enrolled', '104%']] },
  { id: 's2', name: 'School · JVC district 15', at: [55.206, 25.061], rows: [['Seats', '2,100'], ['Enrolled', '101%']] },
  { id: 's3', name: 'School · JVC district 18', at: [55.188, 25.0455], rows: [['Seats', '1,800'], ['Enrolled', '106%']] },
  { id: 's4', name: 'School · JVC district 10', at: [55.212, 25.0545], rows: [['Seats', '2,000'], ['Enrolled', '99%']] },
  { id: 's5', name: 'School · JVC district 14', at: [55.203, 25.0655], rows: [['Seats', '1,900'], ['Enrolled', '103%']] },
  { id: 's6', name: 'School · JVC district 16', at: [55.215, 25.061], rows: [['Seats', '1,600'], ['Enrolled', '100%']] },
  { id: 's7', name: 'School · Arjan', at: [55.2295, 25.059], rows: [['Seats', '2,300'], ['Enrolled', '108%']] },
  { id: 's8', name: 'School · Arjan north', at: [55.2425, 25.063], rows: [['Seats', '2,000'], ['Enrolled', '105%']] },
  { id: 's9', name: 'School · Motor City', at: [55.233, 25.0505], rows: [['Seats', '1,900'], ['Enrolled', '102%']] },
  { id: 's10', name: 'School · Motor City east', at: [55.2415, 25.0515], rows: [['Seats', '1,800'], ['Enrolled', '100%']] },
  { id: 's11', name: 'School · Motor City south', at: [55.2465, 25.0475], rows: [['Seats', '1,500'], ['Enrolled', '97%']] },
]

const CLINICS_SITES: Site[] = [
  { id: 'c1', name: 'Primary health centre · JVC north', at: [55.2115, 25.0605], rows: [['Registered', '38,000'], ['Wait for a GP', '9 days']] },
  { id: 'c2', name: 'Primary health centre · JVC south', at: [55.193, 25.048], rows: [['Registered', '34,000'], ['Wait for a GP', '8 days']] },
  { id: 'c3', name: 'Primary health centre · Arjan', at: [55.236, 25.0605], rows: [['Registered', '29,000'], ['Wait for a GP', '11 days']] },
  { id: 'c4', name: 'Primary health centre · Motor City', at: [55.239, 25.049], rows: [['Registered', '24,000'], ['Wait for a GP', '6 days']] },
]

const PARKS: Site[] = [
  { id: 'p1', name: 'Community park · JVC', at: [55.2005, 25.0565], rows: [['Area', '2.1 ha']] },
  { id: 'p2', name: 'Pocket park · JVC east', at: [55.2135, 25.0505], rows: [['Area', '0.6 ha']] },
  { id: 'p3', name: 'Community park · Motor City', at: [55.2375, 25.0525], rows: [['Area', '3.4 ha']] },
]

const facilityPoints = (): EstatePoint[] => [
  ...SCHOOLS.map(site(SCHOOL, 'schools')),
  ...CLINICS_SITES.map(site(CLINIC, 'clinics', 6.5)),
  ...PARKS.map(site(PARK, 'parks', 5)),
]

/* —— Map Data —— */

const LAYER = {
  growth: {
    group: 'communities',
    title: 'Population growth since 2021',
    mark: 'area',
    color: { items: AREA_LIST.map((area) => ({ label: area.name, color: growthColor(growthPct(area)), count: `+${growthPct(area)}%` })) },
  },
  population: { group: 'population', title: 'Where residents live', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer', high: 'More' } },
  households: {
    group: 'communities',
    title: 'Families with children, share of households',
    mark: 'area',
    color: { items: AREA_LIST.map((area) => ({ label: area.name, color: FAMILY, count: `${HOUSEHOLDS[area.id].families}%` })) },
  },
  families: { group: 'families', title: 'School-age children', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer', high: 'More' } },
  workers: {
    group: 'workers',
    title: 'Worker accommodation',
    mark: 'point',
    color: { items: [{ label: 'Shared housing site', color: WORKER, count: thousands(WORKERS) }] },
  },
  gap: {
    group: 'communities',
    title: 'School seats short',
    mark: 'area',
    color: { items: AREA_LIST.map((area) => ({ label: area.name, color: STATUS.critical, count: fmt(seatGap(area.id)) })) },
  },
  facilities: {
    group: 'schools',
    title: 'Existing facilities',
    mark: 'point',
    color: {
      items: [
        { label: 'Schools', color: SCHOOL, count: `${SCHOOLS.length}` },
        { label: 'Primary health centres', color: CLINIC, count: `${CLINICS_SITES.length}` },
        { label: 'Parks', color: PARK, count: `${PARKS.length}` },
      ],
    },
  },
  underserved: { group: 'underserved', title: 'Homes over 1 km from a school seat', mark: 'heat', color: { ramp: GAP_RAMP, low: 'Few', high: 'Many' } },
} satisfies Record<string, MapDataLayer>

/* —— The story —— */

const FILTERS = ['JVC, Arjan, Motor City', '2026', 'Community facilities']

const GROWTH_SCENE = scene({
  heat: POPULATION_HEAT,
  ...areaOutlines((area) => ({
    color: growthColor(growthPct(area)),
    level: growthPct(area) / 80,
    text: `${thousands(area.population)} residents · +${growthPct(area)}% since 2021`,
    rows: [
      ['Residents', `${fmt(area.population2021)} → ${fmt(area.population)}`],
      ['Growth', `+${growthPct(area)}% in 5 years`],
      ['Pipeline', `${fmt(area.pipeline)} homes`],
    ],
  })),
})

const DEMOGRAPHIC_SCENE = scene({
  heat: FAMILY_HEAT,
  heatRamp: HEAT_RAMP,
  points: WORKER_HOUSING.map(site(WORKER, 'workers', 6.5)),
  ...areaOutlines((area) => ({
    color: FAMILY,
    level: HOUSEHOLDS[area.id].families / 70,
    text: `Families ${HOUSEHOLDS[area.id].families}% · ${thousands(HOUSEHOLDS[area.id].workerResidents)} workers`,
    rows: [
      ['Families with children', `${HOUSEHOLDS[area.id].families}% of households`],
      ['School-age children', fmt(HOUSEHOLDS[area.id].children)],
      ['Workers in shared housing', fmt(HOUSEHOLDS[area.id].workerResidents)],
    ],
  })),
})

const shortageOutlines = () =>
  areaOutlines((area) => ({
    color: STATUS.critical,
    level: seatGap(area.id) / 12000,
    text: `${fmt(seatGap(area.id))} school seats short`,
    rows: [
      ['School seats', `${fmt(PROVISION[area.id].seats)} of ${fmt(PROVISION[area.id].seatsNeeded)} needed`],
      ['Health centres', `${PROVISION[area.id].clinics} of ${PROVISION[area.id].clinicsNeeded}`],
      ['Nurseries', `${PROVISION[area.id].nurseries} of ${PROVISION[area.id].nurseriesNeeded}`],
      ['Homes near a park', `${PROVISION[area.id].parkAccess}%, target ${PARK_TARGET}%`],
    ],
  }))

const SHORTAGE_SCENE = scene({
  heat: UNDERSERVED_HEAT,
  heatRamp: GAP_RAMP,
  heatRadiusM: 260,
  points: facilityPoints(),
  ...shortageOutlines(),
})

/** Residents in the three areas, thousands, 2021–2030: counted, then projected from the pipeline. */
const RESIDENTS = AREA_LIST[0].byYear.map((_, year) => AREA_LIST.reduce((sum, area) => sum + area.byYear[year], 0))
const PROJECTED = [236, 258, 280, 301, TOTALS.population / 1000 + TOTALS.newResidents / 1000]
const PLANNED_FOR = 165

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
        'Population records show JVC, Arjan and Motor City growing far faster than the rest of Dubai, with thousands more homes committed. Their community facilities were planned for a much smaller population.',
      camera: AREAS_CAMERA,
      scene: GROWTH_SCENE,
      filters: FILTERS,
      layers: [LAYER.growth, LAYER.population],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'JVC, Arjan and Motor City grew from ',
            { em: [`${fmt(TOTALS.population2021)} to ${fmt(TOTALS.population)} residents`] },
            ` in five years, +${TOTAL_GROWTH}%. `,
            { em: [`${fmt(TOTALS.pipeline)} more homes`] },
            ` in the pipeline will add about ${thousands(TOTALS.newResidents)} more, yet their facilities were planned for ${PLANNED_FOR}k.`,
          ],
        },
        { id: 'residents', kind: 'cell', title: 'Residents', value: thousands(TOTALS.population), note: `+${TOTAL_GROWTH}% since 2021` },
        { id: 'pipeline', kind: 'cell', title: 'Homes in the pipeline', value: thousands(TOTALS.pipeline), note: `about ${thousands(TOTALS.newResidents)} more residents by 2030` },
        { id: 'rate', kind: 'cell', title: 'Growth a year', value: '9.8%', note: 'against 5.4% for Dubai' },
        { id: 'planned', kind: 'cell', title: 'Facilities planned for', value: `${PLANNED_FOR}k`, note: 'residents, in the 2019 community plan', status: 'critical' },
        {
          id: 'residents-trend',
          kind: 'line',
          title: 'Residents, thousands',
          height: 2,
          kpi: { value: `${Math.round(TOTALS.population / 1000 - PLANNED_FOR)}k`, unit: 'more than facilities were planned for' },
          x: ['2021', '2024', '2027', '2030'],
          yLabels: ['400', '300', '200', '100', '0'],
          yMax: 400,
          series: [
            { name: 'Residents', points: [...RESIDENTS, null, null, null, null] },
            { name: 'Projected', points: [null, null, null, null, null, ...PROJECTED], color: PALETTE.purple[2] },
            { name: 'Facilities planned for', points: Array.from({ length: 10 }, () => PLANNED_FOR), dashed: true },
          ],
        },
        {
          id: 'growth',
          kind: 'hbars',
          title: 'Population growth since 2021',
          bars: AREA_LIST.map((area) => ({ label: area.short, value: growthPct(area), display: `+${growthPct(area)}%`, color: growthColor(growthPct(area)) })),
        },
        {
          id: 'pipeline-by-area',
          kind: 'vbars',
          title: 'Homes in the pipeline, thousands',
          bars: AREA_LIST.map((area) => ({ label: area.short, value: area.pipeline / 1000, display: thousands(area.pipeline) })),
        },
      ]),
    },
    {
      id: 'dm-facilities-demographics',
      title: 'Demographic Shift Identified',
      finding:
        'Tenancy and residency records show most new residents are families with children and workers in shared accommodation, the two groups that rely most on local schools, health care, nurseries, parks and transport.',
      camera: { center: [55.2135, 25.0545], zoom: 13.75, pitch: 56, bearing: 8 },
      scene: DEMOGRAPHIC_SCENE,
      filters: FILTERS,
      layers: [LAYER.households, LAYER.families, LAYER.workers],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'The growth is ',
            { em: ['families and workers'] },
            `: households with children are ${HOUSEHOLDS.jvc.families}% of JVC and ${HOUSEHOLDS['motor-city'].families}% of Motor City, and `,
            { em: [`${fmt(WORKERS)} workers`] },
            ` live in shared accommodation, half of them in Arjan.`,
          ],
        },
        { id: 'children', kind: 'cell', title: 'School-age children', value: thousands(CHILDREN), note: '+64% since 2021' },
        { id: 'workers', kind: 'cell', title: 'Workers in shared housing', value: thousands(WORKERS), note: `${thousands(HOUSEHOLDS.arjan.workerResidents)} in Arjan` },
        {
          id: 'mix',
          kind: 'grouped',
          title: 'Household mix, % of households',
          legend: ['Families', 'Workers', 'Singles and couples'],
          colors: [FAMILY, WORKER, PALETTE.blue[3]],
          groups: AREA_LIST.map((area) => ({ label: area.short, values: [HOUSEHOLDS[area.id].families, HOUSEHOLDS[area.id].workers, HOUSEHOLDS[area.id].others] })),
        },
        {
          id: 'needs',
          kind: 'table',
          title: 'What each group needs nearby',
          columns: ['Group', 'Residents', 'Needs'],
          dotColumn: 0,
          rows: [
            { cells: ['Families with children', '108k', 'Schools, nurseries, clinics, parks'], color: FAMILY },
            { cells: ['Workers', thousands(WORKERS), 'Transport, clinics, shops'], color: WORKER },
            { cells: ['Singles and couples', '98k', 'Transport, sport, retail'], color: PALETTE.blue[3] },
          ],
        },
        {
          id: 'groups',
          kind: 'donut',
          title: 'Residents by group',
          total: thousands(TOTALS.population),
          totalLabel: 'residents',
          slices: [
            { name: 'Families', value: 108, color: FAMILY },
            { name: 'Workers', value: WORKERS / 1000, color: WORKER },
            { name: 'Singles and couples', value: 98, color: PALETTE.blue[3] },
          ],
        },
        { id: 'families-share', kind: 'cell', title: 'Families with children', value: '47%', note: 'of households, up from 34% in 2021' },
      ]),
    },
    {
      id: 'dm-facilities-shortage',
      title: 'Facility Shortage Confirmed',
      finding:
        'Comparing facility capacity with demand from each group confirms shortages in schools, health care, nurseries and parks, largest where families and workers have concentrated.',
      camera: { center: [55.2145, 25.0525], zoom: 13.55, pitch: 58, bearing: -22 },
      scene: SHORTAGE_SCENE,
      filters: FILTERS,
      layers: [LAYER.gap, LAYER.facilities, LAYER.underserved],
      cards: toned([
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            'Schools are the largest gap: ',
            { em: [`${fmt(SEAT_GAP)} school seats short`] },
            `. The areas have ${CLINICS} of ${CLINICS_NEEDED} health centres they need, ${NURSERIES} of ${NURSERIES_NEEDED} nurseries, and only ${PARK_ACCESS}% of homes within 400 m of a park.`,
          ],
        },
        { id: 'seats', kind: 'cell', title: 'School seats short', value: thousands(SEAT_GAP), note: `${thousands(SEATS)} provided, ${thousands(SEATS_NEEDED)} needed`, status: 'critical' },
        { id: 'clinics', kind: 'cell', title: 'Health centres', value: `${CLINICS} of ${CLINICS_NEEDED}`, note: 'needed at 1 per 25,000 residents' },
        {
          id: 'provision',
          kind: 'table',
          title: 'Facilities against demand',
          height: 2,
          columns: ['Facility', 'Provided', 'Needed', 'Gap'],
          dotColumn: 0,
          rows: [
            { cells: ['School seats', fmt(SEATS), fmt(SEATS_NEEDED), `−${fmt(SEAT_GAP)}`], color: STATUS.critical },
            { cells: ['Health centres', `${CLINICS}`, `${CLINICS_NEEDED}`, `−${CLINICS_NEEDED - CLINICS}`], color: STATUS.critical },
            { cells: ['Nurseries', `${NURSERIES}`, `${NURSERIES_NEEDED}`, `−${NURSERIES_NEEDED - NURSERIES}`], color: LEVEL.high },
            { cells: ['Homes near a park', `${PARK_ACCESS}%`, `${PARK_TARGET}%`, `−${PARK_TARGET - PARK_ACCESS} pts`], color: LEVEL.high },
            { cells: ['Worker clinics', '1', '3', '−2'], color: LEVEL.high },
            { cells: ['Bus stops near worker housing', '38%', '80%', '−42 pts'], color: LEVEL.high },
          ],
        },
        {
          id: 'seat-gap',
          kind: 'hbars',
          title: 'School seats short, by community',
          bars: AREA_LIST.map((area) => ({ label: area.short, value: seatGap(area.id), display: fmt(seatGap(area.id)), color: STATUS.critical })),
        },
        {
          id: 'met',
          kind: 'progress',
          title: 'Share of need met',
          rows: [
            { label: 'School seats', value: `${Math.round((SEATS / SEATS_NEEDED) * 100)}%`, target: 'of demand', pct: (SEATS / SEATS_NEEDED) * 100, color: STATUS.critical },
            { label: 'Health centres', value: `${Math.round((CLINICS / CLINICS_NEEDED) * 100)}%`, target: 'of demand', pct: (CLINICS / CLINICS_NEEDED) * 100, color: STATUS.critical },
            { label: 'Nurseries', value: `${Math.round((NURSERIES / NURSERIES_NEEDED) * 100)}%`, target: 'of demand', pct: (NURSERIES / NURSERIES_NEEDED) * 100, color: LEVEL.high },
          ],
        },
        {
          id: 'conclusion',
          kind: 'note',
          title: 'Preliminary conclusion',
          text: `Facility provision in JVC, Arjan and Motor City has not kept pace with their growth or with the families and workers it brought. Without new capacity, the ${fmt(TOTALS.pipeline)} homes in the pipeline will widen every gap.`,
        },
      ]),
    },
  ],
}

export const FACILITIES_PLACE: EstatePlace = {
  id: 'facilities',
  camera: { center: [55.2125, 25.0545], zoom: 13.4, pitch: 56, bearing: -12 },
  scene: GROWTH_SCENE,
}

/* —— Simulate recommended actions: the shortage, then one map per impact horizon —— */

const ACTIONS: PlanningAction[] = [
  {
    code: 'I1',
    horizon: 'immediate',
    action: 'Add modular classrooms',
    asset: '4 existing schools, JVC and Arjan',
    benefit: 'Seats this school year while new schools are built',
    at: SCHOOLS[2].at,
    impact: 13,
    gain: '+2,400 seats',
    cost: 'AED 14M',
    sustainability: 'Medium',
  },
  {
    code: 'I2',
    horizon: 'immediate',
    action: 'Extend clinic hours and add a mobile clinic',
    asset: 'Health centres in JVC and Motor City',
    benefit: 'More appointments for families on evenings and weekends',
    at: CLINICS_SITES[3].at,
    impact: 10,
    gain: '+30% appointments',
    cost: 'AED 3M',
    sustainability: 'Low',
  },
  {
    code: 'I3',
    horizon: 'immediate',
    action: 'Run worker shuttles',
    asset: 'Worker housing in Arjan and Motor City',
    benefit: 'Links shared accommodation to clinics, shops and the metro',
    at: WORKER_HOUSING[1].at,
    impact: 8,
    gain: `${fmt(9000)} workers served`,
    cost: 'AED 2M',
    sustainability: 'Low',
  },
  {
    code: 'M1',
    horizon: 'intermediate',
    action: 'Build three new schools',
    asset: '2 in JVC, 1 in Arjan',
    benefit: 'Permanent seats where the shortage is largest',
    at: [55.1905, 25.0425],
    impact: 30,
    gain: '+5,400 seats',
    cost: 'AED 240M',
    sustainability: 'High',
  },
  {
    code: 'M2',
    horizon: 'intermediate',
    action: 'Open two primary health centres',
    asset: 'JVC east and Arjan',
    benefit: 'Brings every home within 2 km of a GP',
    at: [55.2405, 25.0625],
    impact: 24,
    gain: '+50,000 residents covered',
    cost: 'AED 90M',
    sustainability: 'High',
  },
  {
    code: 'M3',
    horizon: 'intermediate',
    action: 'Turn vacant plots into parks and nurseries',
    asset: '4 plots, JVC and Motor City',
    benefit: 'Green space and childcare within walking distance',
    at: [55.2445, 25.0495],
    impact: 18,
    gain: '+16 pts park access',
    cost: 'AED 36M',
    sustainability: 'Medium',
  },
  {
    code: 'L1',
    horizon: 'long',
    action: 'Reserve land for 6 schools and 3 health centres',
    asset: 'Revised community plans for all three areas',
    benefit: 'Closes the remaining gap as the pipeline completes',
    at: [55.2035, 25.0525],
    impact: 46,
    gain: 'Gap closed by 2032',
    cost: 'AED 1.2M',
    sustainability: 'High',
  },
  {
    code: 'L2',
    horizon: 'long',
    action: 'Tie permits to facility contributions',
    asset: `${fmt(TOTALS.pipeline)} pipeline homes`,
    benefit: 'Developers fund the facilities their residents need',
    at: [55.236, 25.0645],
    impact: 22,
    gain: 'AED 410M towards facilities',
    cost: 'AED 0.6M',
    sustainability: 'High',
  },
  {
    code: 'L3',
    horizon: 'long',
    action: 'Plan facilities by household mix',
    asset: 'Community facility standards',
    benefit: 'Standards follow who actually lives in each area',
    at: [55.2405, 25.0505],
    impact: 15,
    gain: 'Reviewed every 2 years',
    cost: 'AED 0.8M',
    sustainability: 'High',
  },
]

const SOLUTION_CHART = { chartTitle: 'Facility gap closed, by action', chartUnit: 'the most any one action closes' }

export const FACILITIES_SOLUTIONS: Record<Horizon, PlanningSolution> = {
  immediate: planningSolution('immediate', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Stretch what exists',
    summary: 'Add modular classrooms at four schools, extend clinic hours with a mobile clinic, and run shuttles from worker housing to clinics, shops and the metro, all within a year.',
    mapNote: 'The map shows the schools taking classrooms, the clinics on longer hours and the worker shuttle routes.',
    stats: [
      { label: 'Gap closed', value: '31%' },
      { label: 'Seats added', value: '+2,400' },
      { label: 'Cost', value: 'AED 2M–14M' },
    ],
  }),
  intermediate: planningSolution('intermediate', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Build schools, clinics and parks',
    summary: 'Build three schools and two primary health centres where the shortage is largest, and turn four vacant plots into parks and nurseries.',
    mapNote: 'The map shows the new school and health-centre sites and the plots becoming parks and nurseries.',
    stats: [
      { label: 'Gap closed', value: '72%' },
      { label: 'Seats added', value: '+5,400' },
      { label: 'Cost', value: 'AED 36M–240M' },
    ],
  }),
  long: planningSolution('long', ACTIONS, {
    ...SOLUTION_CHART,
    title: 'Plan facilities ahead of growth',
    summary: 'Reserve land for six more schools and three health centres in revised community plans, tie new permits to facility contributions, and set standards by each area’s household mix.',
    mapNote: 'The map shows the reserved sites and the three areas under revised community plans.',
    stats: [
      { label: 'Gap closed', value: '83%' },
      { label: 'Sites reserved', value: '9' },
      { label: 'Cost', value: 'AED 0.6M–1.2M' },
    ],
  }),
}

const actionsLayer = (horizon: Horizon, title: string): MapDataLayer => ({
  group: 'actions',
  title,
  mark: 'point',
  color: { items: ACTIONS.filter((item) => item.horizon === horizon).map((item) => ({ label: `${item.code} ${item.action}`, color: HORIZON_COLOR[horizon] })) },
})

const horizonView = (horizon: Horizon, title: string, note: (id: AreaId) => string, extra: EstatePoint[] = []): EstateAskView => {
  const marks = actionMarks(ACTIONS, horizon)
  return {
    camera: AREAS_ASK_CAMERA,
    scene: scene({
      ...horizonOutlines(horizon, (area) => note(area.id)),
      points: [...facilityPoints(), ...extra, ...marks.points],
      labels: marks.labels,
    }),
    layers: [actionsLayer(horizon, title), LAYER.facilities],
  }
}

const newSites = (horizon: Horizon, sites: LngLat[]): EstatePoint[] =>
  sites.map((at, index) => ({ id: `${horizon}-site-${index}`, at, color: HORIZON_COLOR[horizon], radius: 5, group: 'actions', tip: { title: 'Proposed site', rows: [['Horizon', horizon]] } }))

export const FACILITIES_ASK_VIEWS = {
  facilities: {
    camera: AREAS_ASK_CAMERA,
    scene: SHORTAGE_SCENE,
    layers: [LAYER.gap, LAYER.facilities, LAYER.underserved],
  },
  'facilities-immediate': horizonView('immediate', 'Immediate actions', () => 'Facilities stretched'),
  'facilities-intermediate': horizonView('intermediate', 'Intermediate actions', () => 'New facilities built', newSites('intermediate', [[55.205, 25.0635], [55.24, 25.0605], [55.2015, 25.0475]])),
  'facilities-long': horizonView('long', 'Long-term actions', () => 'Revised community plan', newSites('long', [[55.186, 25.0405], [55.218, 25.0625], [55.2475, 25.0605], [55.2325, 25.0485]])),
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
  plannedFor: PLANNED_FOR,
  /** Share of need met, %, for the reply's chart. */
  met: [
    { label: 'School seats', value: Math.round((SEATS / SEATS_NEEDED) * 100) },
    { label: 'Health centres', value: Math.round((CLINICS / CLINICS_NEEDED) * 100) },
    { label: 'Nurseries', value: Math.round((NURSERIES / NURSERIES_NEEDED) * 100) },
    { label: 'Park access', value: Math.round((PARK_ACCESS / PARK_TARGET) * 100) },
    { label: 'Worker clinics', value: 33 },
  ],
}
