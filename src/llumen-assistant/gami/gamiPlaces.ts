/**
 * Where the GAMI demo happens: the Kingdom's defence industrial sites and zones (names invented for the
 * demo), and each finding's map scenes, cameras and outlined areas. One column or disk per place.
 */
import { blob, hash, offsetKm, scatter, type LngLat } from './gamiGeo'
import { scene, type GamiArc, type GamiColumn, type GamiDisk, type GamiLabel } from './gamiMapLayers'
import { PALETTE, STATUS, category, ramp, rampAt, type GamiCamera, type GamiPlaceId, type GamiPolygon } from './gamiTypes'

export type Domain = 'air' | 'armament' | 'land' | 'naval' | 'electronics'

export const DOMAIN_LABEL: Record<Domain, string> = {
  air: 'Air',
  armament: 'Armament',
  land: 'Land',
  naval: 'Naval',
  electronics: 'Electronics',
}

/** Map colours: sites rise in teal, zones and values in blue, risk along the diverging palette. */
export const MAP = {
  site: PALETTE.teal[2],
  siteRamp: ramp(PALETTE.teal),
  zone: PALETTE.categorical[0],
  valueRamp: ramp(PALETTE.blue),
  densityRamp: ramp(PALETTE.purple),
  conflictRamp: ramp(PALETTE.red),
  critical: STATUS.critical,
  good: STATUS.good,
  pending: STATUS.moderate,
  area: '#70aeff',
} as const

type Site = {
  id: string
  name: string
  city: string
  at: LngLat
  domain: Domain
  companies: number
  employees: number
  risk?: boolean
}

export const SITES: Site[] = [
  { id: 'riyadh-uav', name: 'Riyadh UAV Integration Facility', city: 'Riyadh', at: [46.83, 24.78], domain: 'air', companies: 34, employees: 4200, risk: true },
  { id: 'alkharj-uav', name: 'Al-Kharj UAV Components Plant', city: 'Al-Kharj', at: [47.36, 24.17], domain: 'air', companies: 21, employees: 2600, risk: true },
  { id: 'riyadh-electronics', name: 'Riyadh Defense Electronics Park', city: 'Riyadh', at: [46.58, 24.92], domain: 'electronics', companies: 58, employees: 7900 },
  { id: 'alkharj-armament', name: 'Al-Kharj Armament Complex', city: 'Al-Kharj', at: [47.18, 24.03], domain: 'armament', companies: 39, employees: 6800 },
  { id: 'qassim-armament', name: 'Qassim Munitions Works', city: 'Buraidah', at: [43.97, 26.33], domain: 'armament', companies: 24, employees: 3600 },
  { id: 'hail-air', name: 'Hail Aerostructures Plant', city: 'Hail', at: [41.69, 27.52], domain: 'air', companies: 17, employees: 2300 },
  { id: 'madinah-armament', name: 'Madinah Ordnance Works', city: 'Madinah', at: [39.61, 24.47], domain: 'armament', companies: 20, employees: 3100 },
  { id: 'ahsa-electronics', name: 'Al-Ahsa Electronics Assembly', city: 'Hofuf', at: [49.59, 25.38], domain: 'electronics', companies: 31, employees: 4400 },
  { id: 'najran-land', name: 'Najran Armor Works', city: 'Najran', at: [44.13, 17.55], domain: 'land', companies: 14, employees: 1900 },
  { id: 'tabuk-land', name: 'Tabuk Vehicle Systems Depot', city: 'Tabuk', at: [36.6, 28.4], domain: 'land', companies: 16, employees: 2100 },
  { id: 'jeddah-naval', name: 'Jeddah Naval Systems Yard', city: 'Jeddah', at: [39.15, 21.42], domain: 'naval', companies: 27, employees: 4100 },
  { id: 'kaec-land', name: 'KAEC Land Systems Plant', city: 'King Abdullah Economic City', at: [39.12, 22.45], domain: 'land', companies: 32, employees: 3900 },
  { id: 'taif-air', name: 'Taif Aerospace MRO Centre', city: 'Taif', at: [40.5, 21.3], domain: 'air', companies: 22, employees: 3300 },
  { id: 'jubail-land', name: 'Jubail Armor & Steel Works', city: 'Jubail', at: [49.62, 27.02], domain: 'land', companies: 37, employees: 6100 },
  { id: 'khamis-air', name: 'Khamis Mushait Aircraft Maintenance', city: 'Khamis Mushait', at: [42.75, 18.3], domain: 'air', companies: 19, employees: 2700 },
]

const site = (id: string) => SITES.find((item) => item.id === id)!

/** Licensed industrial zones away from the sites, sized by serviced land. */
const ZONES: { name: string; city: string; at: LngLat; landKm2: number }[] = [
  { name: 'Sudair Industrial City', city: 'Sudair', at: [45.62, 25.92], landKm2: 26 },
  { name: 'Hafar Al-Batin Industrial Zone', city: 'Hafar Al-Batin', at: [45.97, 28.43], landKm2: 9 },
  { name: 'Al-Jouf Industrial Zone', city: 'Sakaka', at: [40.21, 29.95], landKm2: 7 },
  { name: 'Dawadmi Industrial Zone', city: 'Dawadmi', at: [44.39, 24.51], landKm2: 6 },
  { name: 'Wadi ad-Dawasir Test Range', city: 'Wadi ad-Dawasir', at: [45.0, 20.45], landKm2: 14 },
  { name: 'Bisha Industrial Zone', city: 'Bisha', at: [42.6, 20.0], landKm2: 5 },
  { name: 'Arar Logistics Zone', city: 'Arar', at: [41.04, 30.97], landKm2: 6 },
  { name: 'Yanbu Industrial City', city: 'Yanbu', at: [38.25, 24.0], landKm2: 18 },
  { name: 'Ras Al-Khair Industrial City', city: 'Ras Al-Khair', at: [49.25, 27.48], landKm2: 12 },
]

const MAX_EMPLOYEES = 7900

function siteColumn(item: Site, maxHeight: number, group: string): GamiColumn {
  return {
    at: item.at,
    height: maxHeight * (0.25 + 0.75 * (item.employees / MAX_EMPLOYEES)),
    color: item.risk ? MAP.critical : rampAt(MAP.siteRamp, 0.35 + 0.65 * (item.employees / MAX_EMPLOYEES)),
    group,
    tip: {
      title: item.name,
      rows: [
        ['City', item.city],
        ['Domain', DOMAIN_LABEL[item.domain]],
        ['Companies', String(item.companies)],
        ['Employees', item.employees.toLocaleString('en-US')],
        ['Status', item.risk ? 'At risk' : 'Normal'],
      ],
    },
  }
}

function zoneDisks(scale: number, group: string): GamiDisk[] {
  return ZONES.map((zone) => ({
    at: zone.at,
    radiusM: Math.sqrt(zone.landKm2) * scale,
    color: MAP.zone,
    group,
    tip: { title: zone.name, rows: [['City', zone.city], ['Serviced land', `${zone.landKm2} km²`], ['Status', 'Licensed']] },
  }))
}

/* ---------- Finding 1: the Kingdom overview ---------- */

export const KINGDOM_CAMERA: GamiCamera = { center: [44.2, 23.9], zoom: 4.85, pitch: 48, bearing: -10 }
/** The story opens closer than the Briefing: the Kingdom fills the map beside the sidebar. */
export const KINGDOM_STORY_CAMERA: GamiCamera = { center: [44.95, 24.85], zoom: 5.5, pitch: 55, bearing: -11 }

export const KINGDOM_SCENE = scene({
  columnRadiusM: 9000,
  columns: SITES.map((item) => siteColumn(item, 420000, 'sites')),
  disks: zoneDisks(14000, 'zones'),
})

const RISK_LABEL: GamiLabel = {
  at: offsetKm(site('riyadh-uav').at, 25, -30),
  title: 'Riyadh & Al-Kharj UAV sites',
  text: '2 sites at risk',
  side: 'east',
  group: 'sites',
}

export const KINGDOM_STORY_SCENE = scene({ ...KINGDOM_SCENE, labels: [RISK_LABEL] })

const CORRIDOR_PLACES: { name: string; at: LngLat; employees: number; risk?: boolean; domain: Domain }[] = [
  { name: 'Riyadh UAV Integration Facility', at: site('riyadh-uav').at, employees: 4200, risk: true, domain: 'air' },
  { name: 'Al-Kharj UAV Components Plant', at: site('alkharj-uav').at, employees: 2600, risk: true, domain: 'air' },
  { name: 'Riyadh Defense Electronics Park', at: site('riyadh-electronics').at, employees: 7900, domain: 'electronics' },
  { name: 'Al-Kharj Armament Complex', at: site('alkharj-armament').at, employees: 6800, domain: 'armament' },
  { name: 'Riyadh 2nd Industrial City', at: [46.86, 24.58], employees: 5200, domain: 'electronics' },
  { name: 'Riyadh 3rd Industrial City', at: [47.02, 24.42], employees: 3100, domain: 'land' },
  { name: 'Al-Kharj Industrial City', at: [47.55, 24.3], employees: 2300, domain: 'armament' },
  { name: 'Diriyah Avionics Workshop', at: [46.5, 24.72], employees: 1800, domain: 'air' },
  { name: 'Al-Muzahmiyah Test Range', at: [46.25, 24.47], employees: 900, domain: 'armament' },
  { name: 'North Riyadh Aviation Park', at: [46.72, 25.08], employees: 2200, domain: 'air' },
]

export const CORRIDOR_CAMERA: GamiCamera = { center: [46.95, 24.52], zoom: 7.6, pitch: 54, bearing: 24 }

export const CORRIDOR_SCENE = scene({
  columnRadiusM: 1600,
  columns: CORRIDOR_PLACES.map((place) => ({
    at: place.at,
    height: 18000 + 52000 * (place.employees / MAX_EMPLOYEES),
    color: place.risk ? MAP.critical : rampAt(MAP.siteRamp, 0.35 + 0.65 * (place.employees / MAX_EMPLOYEES)),
    group: 'sites',
    tip: {
      title: place.name,
      rows: [
        ['Domain', DOMAIN_LABEL[place.domain]],
        ['Employees', place.employees.toLocaleString('en-US')],
        ['Status', place.risk ? 'At risk' : 'Normal'],
      ],
    },
  })),
  disks: CORRIDOR_PLACES.filter((place) => place.risk).map((place) => ({
    at: place.at,
    radiusM: 7000,
    color: MAP.critical,
    group: 'risk',
    tip: { title: place.name, rows: [['Status', 'At risk · Poland supply'], ['Employees', place.employees.toLocaleString('en-US')]] },
  })),
  labels: [
    { at: site('riyadh-uav').at, title: 'Riyadh UAV Integration Facility', text: 'At risk', side: 'east', group: 'risk' },
    { at: site('alkharj-uav').at, title: 'Al-Kharj UAV Components Plant', text: 'At risk', side: 'east', group: 'risk' },
    { at: site('riyadh-electronics').at, title: 'Riyadh Defense Electronics Park', text: '7,900 employees', side: 'west', group: 'sites' },
  ],
})

export const CORRIDOR_AREA: GamiPolygon = {
  id: 'corridor',
  name: 'Riyadh–Al Kharj corridor',
  text: '248 companies · SAR 7.9bn',
  color: MAP.area,
  ring: blob([46.93, 24.53], 52, 4, [1.65, 0.78], -52),
  wallM: 3000,
}

/* ---------- Finding 2: localization opportunities across the Kingdom ---------- */

type Opportunity = { name: string; value: number; domain: Domain; at: LngLat; city: string; side: 'east' | 'west' }

/** Jubail's two add up to the SAR 10.6bn it can take now. */
export const OPPORTUNITIES: Opportunity[] = [
  { name: 'UAV airframes & propulsion', value: 6.8, domain: 'air', at: [47.33, 24.15], city: 'Al-Kharj', side: 'east' },
  { name: 'Ammunition & energetics', value: 5.9, domain: 'armament', at: [49.52, 27.07], city: 'Jubail', side: 'east' },
  { name: 'Armored vehicle subsystems', value: 4.7, domain: 'land', at: [49.14, 26.78], city: 'Jubail', side: 'west' },
  { name: 'Radar & comms modules', value: 4.2, domain: 'electronics', at: [46.68, 24.77], city: 'Riyadh', side: 'west' },
  { name: 'Aircraft MRO & spares', value: 3.9, domain: 'air', at: [42.73, 18.3], city: 'Khamis Mushait', side: 'east' },
  { name: 'Naval vessel outfitting', value: 2.6, domain: 'naval', at: [39.2, 21.5], city: 'Jeddah', side: 'west' },
]

const MAX_OPPORTUNITY = 6.8

const HEAT_ZONES: [LngLat, number, number, number][] = [
  // centre, points, radius km, weight
  [[49.45, 26.98], 120, 34, 1],
  [[46.72, 24.68], 120, 40, 0.9],
  [[47.33, 24.15], 90, 30, 0.8],
  [[39.25, 21.55], 80, 32, 0.6],
  [[42.6, 18.25], 60, 28, 0.5],
  [[44.39, 24.51], 40, 26, 0.4],
]

function heatPoints(zones: [LngLat, number, number, number][], group: string, seed: number) {
  return zones.flatMap(([center, count, radiusKm, weight], z) =>
    scatter(center, count, radiusKm, seed + z * 13).map((at, i) => ({ at, weight: weight * (0.4 + 0.6 * hash(i, z + seed)), group })),
  )
}

function opportunityDisk(item: Opportunity, scale: number, group: string): GamiDisk {
  return {
    at: item.at,
    radiusM: Math.sqrt(item.value) * scale,
    color: rampAt(MAP.valueRamp, 0.3 + 0.7 * (item.value / MAX_OPPORTUNITY)),
    group,
    tip: {
      title: item.name,
      rows: [
        ['Location', item.city],
        ['Domain', DOMAIN_LABEL[item.domain]],
        ['Value', `SAR ${item.value.toFixed(1)}bn / yr`],
      ],
    },
  }
}

export const EASTERN_CAMERA: GamiCamera = { center: [44.6, 23.4], zoom: 5.05, pitch: 44, bearing: -8 }
export const EASTERN_STORY_CAMERA: GamiCamera = { center: [45.6, 23.1], zoom: 5.6, pitch: 42, bearing: -9 }

export const EASTERN_SCENE = scene({
  heat: heatPoints(HEAT_ZONES, 'capacity', 21),
  heatRadiusM: 30000,
  heatRamp: MAP.densityRamp,
  disks: OPPORTUNITIES.map((item) => opportunityDisk(item, 17000, 'opportunities')),
})

export const EASTERN_STORY_SCENE = scene({
  ...EASTERN_SCENE,
  labels: OPPORTUNITIES.map((item) => ({
    at: item.at,
    title: item.name,
    text: `SAR ${item.value.toFixed(1)}bn · ${item.city}`,
    side: item.side,
    group: 'opportunities',
  })),
})

const JUBAIL_CENTER: LngLat = [49.62, 27.0]

type Supplier = { name: string; at: LngLat; capability: string; status: string; ready: boolean; capacity: number; side: 'east' | 'west' }

export const JUBAIL_SUPPLIERS: Supplier[] = [
  { name: 'Jubail Energetics Park', at: offsetKm(JUBAIL_CENTER, -7, 5), capability: 'Propellants & charges', status: 'Licence review', ready: false, capacity: 0.7, side: 'west' },
  { name: 'Gulf Armor Plate Mill', at: offsetKm(JUBAIL_CENTER, 5, 6), capability: 'Armor steel', status: 'Ready', ready: true, capacity: 1, side: 'east' },
  { name: 'Eastern Composites Works', at: offsetKm(JUBAIL_CENTER, 8, -4), capability: 'Composites', status: 'Needs licence', ready: false, capacity: 0.45, side: 'east' },
  { name: 'Jubail Precision Forge', at: offsetKm(JUBAIL_CENTER, -4, -7), capability: 'Machining & forging', status: 'Ready', ready: true, capacity: 0.85, side: 'west' },
  { name: 'Vehicle Subsystems Hub', at: offsetKm(JUBAIL_CENTER, 1, 0.5), capability: 'Vehicle subsystems', status: 'Ready', ready: true, capacity: 0.6, side: 'east' },
]

export const JUBAIL_CAMERA: GamiCamera = { center: [49.63, 26.99], zoom: 9.75, pitch: 56, bearing: 28 }

export const JUBAIL_SCENE = scene({
  columnRadiusM: 380,
  heat: heatPoints([[JUBAIL_CENTER, 220, 12, 1]], 'capacity', 5),
  heatRadiusM: 2200,
  heatRamp: MAP.densityRamp,
  columns: JUBAIL_SUPPLIERS.map((supplier) => ({
    at: supplier.at,
    height: 2500 + 6000 * supplier.capacity,
    color: supplier.ready ? MAP.good : MAP.pending,
    group: 'suppliers',
    tip: {
      title: supplier.name,
      rows: [
        ['Capability', supplier.capability],
        ['Status', supplier.status],
      ],
    },
  })),
  disks: [
    opportunityDisk({ ...OPPORTUNITIES[1], at: offsetKm(JUBAIL_CENTER, -2, 10) }, 1100, 'opportunities'),
    opportunityDisk({ ...OPPORTUNITIES[2], at: offsetKm(JUBAIL_CENTER, 10, 2) }, 1100, 'opportunities'),
  ],
  labels: JUBAIL_SUPPLIERS.map((supplier) => ({
    at: supplier.at,
    title: supplier.name,
    text: supplier.status,
    side: supplier.side,
    group: 'suppliers',
  })),
})

export const JUBAIL_AREA: GamiPolygon = {
  id: 'jubail',
  name: 'Jubail Industrial City',
  text: 'SAR 10.6bn ready to localize',
  color: MAP.area,
  ring: blob([49.63, 27.0], 13, 9, [1.25, 1], 20),
  wallM: 900,
}

/* ---------- Finding 3: World Defense Show 2028 ---------- */

export const MALHAM: LngLat = [46.16, 25.12]

export type Region = 'europe' | 'middle-east' | 'asia' | 'north-america' | 'africa' | 'latin-america'

export const REGION_ORDER: Region[] = ['europe', 'middle-east', 'asia', 'north-america', 'africa', 'latin-america']

export const REGION_COLOR = Object.fromEntries(REGION_ORDER.map((region, index) => [region, category(index)])) as Record<
  Region,
  string
>

export const REGION_LABEL: Record<Region, string> = {
  europe: 'Europe',
  'middle-east': 'GCC & Middle East',
  asia: 'Asia',
  'north-america': 'North America',
  africa: 'Africa',
  'latin-america': 'Latin America',
}

const DELEGATIONS: [string, LngLat, Region][] = [
  ['London', [-0.12, 51.5], 'europe'],
  ['Paris', [2.35, 48.85], 'europe'],
  ['Berlin', [13.4, 52.52], 'europe'],
  ['Rome', [12.5, 41.9], 'europe'],
  ['Madrid', [-3.7, 40.4], 'europe'],
  ['Stockholm', [18.07, 59.33], 'europe'],
  ['Abu Dhabi', [54.37, 24.45], 'middle-east'],
  ['Doha', [51.53, 25.29], 'middle-east'],
  ['Cairo', [31.24, 30.04], 'middle-east'],
  ['Amman', [35.93, 31.95], 'middle-east'],
  ['Ankara', [32.85, 39.93], 'middle-east'],
  ['Beijing', [116.4, 39.9], 'asia'],
  ['Seoul', [126.98, 37.57], 'asia'],
  ['Tokyo', [139.69, 35.69], 'asia'],
  ['New Delhi', [77.21, 28.61], 'asia'],
  ['Islamabad', [73.05, 33.68], 'asia'],
  ['Washington', [-77.04, 38.9], 'north-america'],
  ['Pretoria', [28.19, -25.75], 'africa'],
  ['Nairobi', [36.82, -1.29], 'africa'],
  ['Brasília', [-47.88, -15.79], 'latin-america'],
]

export const WDS_CAMERA: GamiCamera = { center: [38, 30], zoom: 2.6, pitch: 30, bearing: -6 }
export const WDS_STORY_CAMERA: GamiCamera = { center: [47.5, 22.5], zoom: 4.6, pitch: 32, bearing: -6 }

export const WDS_SCENE = scene({
  arcs: DELEGATIONS.map(([, at, region]) => ({ from: at, to: MALHAM, color: REGION_COLOR[region], width: 1.5, group: 'delegations' })),
  disks: [
    {
      at: MALHAM,
      radiusM: 110000,
      color: PALETTE.categorical[4],
      group: 'venue',
      tip: { title: 'World Defense Show 2028', rows: [['Venue', 'Malham, Riyadh'], ['Opens', '6 Feb 2028'], ['Applications', '1,940']] },
    },
  ],
})

export const WDS_STORY_SCENE = scene({
  ...WDS_SCENE,
  labels: [{ at: MALHAM, title: 'WDS 2028', text: 'Malham, Riyadh', side: 'east', group: 'venue' }],
})

const HALLS: [string, LngLat, number][] = [
  ['Hall 1 · Air', offsetKm(MALHAM, -1.6, 1.0), 1],
  ['Hall 2 · Land', offsetKm(MALHAM, -0.4, 1.4), 0.9],
  ['Hall 3 · Electronics', offsetKm(MALHAM, 0.9, 1.0), 0.95],
  ['Hall 4 · Armament', offsetKm(MALHAM, -1.1, -0.3), 0.7],
  ['Hall 5 · Naval', offsetKm(MALHAM, 0.4, -0.4), 0.55],
]

const ARRIVALS: [string, LngLat][] = [
  ['King Khalid International Airport', [46.7, 24.96]],
  ['Riyadh city centre', [46.68, 24.71]],
  ['KAFD', [46.64, 24.76]],
  ['Malham village', [46.08, 25.16]],
]

const DISPLAY: LngLat = offsetKm(MALHAM, 1.9, -1.7)

export const MALHAM_CAMERA: GamiCamera = { center: offsetKm(MALHAM, 0.2, 0.3), zoom: 12.5, pitch: 58, bearing: -24 }

export const MALHAM_SCENE = scene({
  columnRadiusM: 110,
  columns: HALLS.map(([name, at, share]) => ({
    at,
    height: 300 + 700 * share,
    color: rampAt(MAP.siteRamp, 0.3 + 0.7 * share),
    group: 'halls',
    tip: { title: name, rows: [['Stands', `${Math.round(390 * share)} confirmed`], ['Ready', `${Math.round(70 + 20 * share)}%`]] },
  })),
  heat: [
    ...scatter(offsetKm(MALHAM, -0.4, 0.6), 220, 1.8, 3).map((at, i) => ({ at, weight: 0.5 + 0.5 * hash(i, 4), group: 'visitors' })),
    ...scatter(DISPLAY, 80, 0.9, 8).map((at, i) => ({ at, weight: 0.4 + 0.4 * hash(i, 2), group: 'visitors' })),
  ],
  heatRadiusM: 260,
  heatRamp: MAP.densityRamp,
  arcs: ARRIVALS.map(([, at], index) => ({
    from: at,
    to: offsetKm(MALHAM, 0.4 - index * 0.3, -0.6),
    color: PALETTE.categorical[2],
    width: 2,
    group: 'shuttles',
  })),
  disks: [
    {
      at: DISPLAY,
      radiusM: 420,
      color: MAP.zone,
      group: 'display',
      tip: { title: 'Flying display & static aircraft', rows: [['Static aircraft slots', '70'], ['Runway upgrade', '74%']] },
    },
  ],
  labels: [
    ...HALLS.map(([name, at], index) => ({ at, title: name, side: index % 2 ? ('west' as const) : ('east' as const), group: 'halls' })),
    { at: DISPLAY, title: 'Flying display', text: '70 static aircraft', side: 'east', group: 'display' },
  ],
})

export const MALHAM_AREA: GamiPolygon = {
  id: 'malham',
  name: 'Malham exhibition venue',
  text: '5 halls · 82% ready',
  color: MAP.area,
  ring: blob(offsetKm(MALHAM, 0.1, 0.1), 2.5, 3, [1.35, 1], 10),
  wallM: 120,
}

/* ---------- Finding 4: human capital in the Western Region ---------- */

type TalentCity = { name: string; at: LngLat; gap: number; side: 'east' | 'west' }

export const TALENT_CITIES: TalentCity[] = [
  { name: 'Jeddah', at: [39.19, 21.54], gap: 980, side: 'west' },
  { name: 'King Abdullah Economic City', at: [39.1, 22.4], gap: 640, side: 'west' },
  { name: 'Madinah', at: [39.61, 24.47], gap: 410, side: 'east' },
  { name: 'Yanbu', at: [38.06, 24.09], gap: 290, side: 'west' },
  { name: 'Taif', at: [40.42, 21.27], gap: 230, side: 'east' },
  { name: 'Makkah', at: [39.83, 21.42], gap: 180, side: 'east' },
]

const MAX_GAP = 980

const ACADEMIES: { name: string; at: LngLat; graduates: number; enrolled: number }[] = [
  { name: 'National Academy for Military Industries', at: [39.27, 21.64], graduates: 620, enrolled: 1410 },
  { name: 'KAEC Technical Institute', at: [39.17, 22.33], graduates: 180, enrolled: 420 },
  { name: 'Taif Aviation Training Centre', at: [40.52, 21.36], graduates: 140, enrolled: 360 },
  { name: 'Madinah Industrial Skills College', at: [39.7, 24.52], graduates: 110, enrolled: 300 },
]

export const WESTERN_CAMERA: GamiCamera = { center: [39.6, 22.9], zoom: 6.2, pitch: 52, bearing: -16 }
export const WESTERN_STORY_CAMERA: GamiCamera = { center: [39.8, 22.3], zoom: 7.35, pitch: 60, bearing: -15 }

export const WESTERN_SCENE = scene({
  disks: TALENT_CITIES.map((city) => ({
    at: city.at,
    radiusM: Math.sqrt(city.gap) * 1500,
    color: rampAt(MAP.valueRamp, 0.3 + 0.7 * (city.gap / MAX_GAP)),
    group: 'gap',
    tip: { title: city.name, rows: [['Skills gap today', city.gap.toLocaleString('en-US')], ['By 2030', Math.round(city.gap * 1.67).toLocaleString('en-US')]] },
  })),
  columnRadiusM: 3200,
  columns: ACADEMIES.map((academy) => ({
    at: academy.at,
    height: 30000 + 140000 * (academy.graduates / 620),
    color: MAP.site,
    group: 'academies',
    tip: { title: academy.name, rows: [['Enrolled', academy.enrolled.toLocaleString('en-US')], ['Graduates a year', String(academy.graduates)]] },
  })),
})

export const WESTERN_STORY_SCENE = scene({
  ...WESTERN_SCENE,
  labels: TALENT_CITIES.slice(0, 5).map((city) => ({
    at: city.at,
    title: city.name,
    text: `${city.gap.toLocaleString('en-US')} short`,
    side: city.side,
    group: 'gap',
  })),
})

const KAEC_CENTER: LngLat = [39.12, 22.42]

type Employer = { name: string; at: LngLat; roles: number; domain: Domain; side: 'east' | 'west' }

export const KAEC_EMPLOYERS: Employer[] = [
  { name: 'KAEC Land Systems Plant', at: offsetKm(KAEC_CENTER, 0.5, 2.6), roles: 214, domain: 'land', side: 'east' },
  { name: 'Red Sea Composites', at: offsetKm(KAEC_CENTER, -3.2, -1.5), roles: 126, domain: 'air', side: 'west' },
  { name: 'Western UAV Assembly', at: offsetKm(KAEC_CENTER, 3.6, -2.6), roles: 118, domain: 'air', side: 'east' },
  { name: 'Coastal Electronics Works', at: offsetKm(KAEC_CENTER, 4.2, 3.6), roles: 92, domain: 'electronics', side: 'east' },
  { name: 'Other employers (4)', at: offsetKm(KAEC_CENTER, -2.6, 4.6), roles: 90, domain: 'armament', side: 'west' },
]

const KAEC_INSTITUTE: LngLat = [39.17, 22.33]

export const KAEC_CAMERA: GamiCamera = { center: offsetKm(KAEC_CENTER, 0.5, 0.8), zoom: 10.35, pitch: 56, bearing: -26 }

export const KAEC_SCENE = scene({
  columnRadiusM: 260,
  columns: KAEC_EMPLOYERS.map((employer) => ({
    at: employer.at,
    height: 900 + 3600 * (employer.roles / 214),
    color: rampAt(MAP.siteRamp, 0.3 + 0.7 * (employer.roles / 214)),
    group: 'roles',
    tip: { title: employer.name, rows: [['Domain', DOMAIN_LABEL[employer.domain]], ['Open roles', String(employer.roles)]] },
  })),
  heat: scatter(offsetKm(KAEC_CENTER, -1, 1), 200, 8, 17).map((at, i) => ({ at, weight: 0.3 + 0.7 * hash(i, 6), group: 'applicants' })),
  heatRadiusM: 1300,
  heatRamp: MAP.densityRamp,
  disks: [
    {
      at: KAEC_INSTITUTE,
      radiusM: 1100,
      color: MAP.zone,
      group: 'institute',
      tip: { title: 'KAEC Technical Institute', rows: [['Graduates a year', '180'], ['Programmes', 'Machining · UAV']] },
    },
  ],
  labels: [
    ...KAEC_EMPLOYERS.map((employer) => ({
      at: employer.at,
      title: employer.name,
      text: `${employer.roles} open roles`,
      side: employer.side,
      group: 'roles',
    })),
    { at: KAEC_INSTITUTE, title: 'KAEC Technical Institute', text: '180 graduates a year', side: 'east', group: 'institute' },
  ],
})

export const KAEC_AREA: GamiPolygon = {
  id: 'kaec',
  name: 'KAEC industrial cluster',
  text: '640 unfilled roles',
  color: MAP.area,
  ring: blob(offsetKm(KAEC_CENTER, 0.4, 1), 7.8, 6, [1, 1.2], 0),
  wallM: 500,
}

/* ---------- The alert: Poland supply disruption ---------- */

type PartSupplier = { name: string; city: string; at: LngLat; part: string; to: LngLat; side: 'top' | 'east' | 'west' }

export const POLAND_SUPPLIERS: PartSupplier[] = [
  { name: 'Rzeszow Propulsion Works', city: 'Rzeszów', at: [22.0, 50.04], part: 'Propulsion motors', to: site('riyadh-uav').at, side: 'east' },
  { name: 'Krakow Optronics Plant', city: 'Kraków', at: [19.94, 50.06], part: 'EO/IR gimbals', to: site('alkharj-uav').at, side: 'west' },
  { name: 'Gdansk Navigation Systems', city: 'Gdańsk', at: [18.65, 54.35], part: 'Navigation units', to: site('riyadh-uav').at, side: 'top' },
]

export const TURKIYE_SUPPLIERS: PartSupplier[] = [
  { name: 'Ankara Propulsion Systems Park', city: 'Ankara', at: [32.85, 39.93], part: 'Motors · 30 days', to: site('riyadh-uav').at, side: 'east' },
  { name: 'Eskişehir Optronics Works', city: 'Eskişehir', at: [30.52, 39.78], part: 'Gimbals · 35 days', to: site('alkharj-uav').at, side: 'west' },
  { name: 'Konya Inertial Systems', city: 'Konya', at: [32.49, 37.87], part: 'Navigation · 32 days', to: site('riyadh-uav').at, side: 'east' },
]

const RECEIVERS = SITES.filter((item) => item.risk)

const RECEIVER_LABEL: GamiLabel = {
  at: site('riyadh-uav').at,
  title: 'Riyadh & Al-Kharj UAV sites',
  text: 'Production stops in 41 days',
  side: 'east',
  group: 'receivers',
}

function supplierDisk(supplier: PartSupplier, color: string, status: string, group: string): GamiDisk {
  return {
    at: supplier.at,
    radiusM: 36000,
    color,
    group,
    tip: { title: supplier.name, rows: [['City', supplier.city], ['Supplies', supplier.part], ['Status', status]] },
  }
}

const receiverDisks = (radiusM: number): GamiDisk[] =>
  RECEIVERS.map((item) => ({
    at: item.at,
    radiusM,
    color: MAP.critical,
    group: 'receivers',
    tip: { title: item.name, rows: [['City', item.city], ['Status', 'At risk · 41 days of stock']] },
  }))

function route(from: LngLat, to: LngLat, color: string, group: string): GamiArc {
  return { from, to, color, width: 2.5, group }
}

/** Conflict intensity along Poland's eastern border, from the alert feed. */
const CONFLICT_HEAT = heatPoints(
  [
    [[23.8, 51.6], 90, 120, 1],
    [[24.2, 50.4], 80, 110, 0.9],
    [[23.4, 53.0], 50, 90, 0.6],
  ],
  'conflict',
  41,
)

export const ALERT_CAMERA: GamiCamera = { center: [39.72, 40.72], zoom: 3.72, pitch: 24, bearing: -11 }
/** The planet, Poland to Riyadh in view, that the alert story dives in from. */
export const ALERT_INTRO_CAMERA: GamiCamera = { center: [37, 38], zoom: 2.45, pitch: 0, bearing: 0 }

export const ALERT_SCENE = scene({
  arcs: POLAND_SUPPLIERS.map((supplier) => route(supplier.at, supplier.to, MAP.critical, 'routes')),
  heat: CONFLICT_HEAT,
  heatRadiusM: 160000,
  heatRamp: MAP.conflictRamp,
  disks: [
    ...POLAND_SUPPLIERS.map((supplier) => supplierDisk(supplier, MAP.critical, 'Exports suspended', 'suppliers')),
    ...receiverDisks(45000),
  ],
  labels: [
    ...POLAND_SUPPLIERS.map((supplier) => ({
      at: supplier.at,
      title: supplier.name,
      text: supplier.part,
      side: supplier.side,
      group: 'suppliers',
    })),
    RECEIVER_LABEL,
  ],
})

export const BRIDGE_CAMERA: GamiCamera = { center: [38.4, 32.6], zoom: 4.55, pitch: 44, bearing: -14 }

export const BRIDGE_SCENE = scene({
  arcs: TURKIYE_SUPPLIERS.map((supplier) => route(supplier.at, supplier.to, MAP.good, 'routes')),
  disks: [
    ...TURKIYE_SUPPLIERS.map((supplier) => supplierDisk(supplier, MAP.good, 'Recommended · +8%', 'suppliers')),
    ...receiverDisks(28000),
  ],
  labels: [
    ...TURKIYE_SUPPLIERS.map((supplier) => ({
      at: supplier.at,
      title: supplier.name,
      text: supplier.part,
      side: supplier.side,
      group: 'suppliers',
    })),
    { ...RECEIVER_LABEL, text: 'First delivery in 30 days' },
  ],
})

export const ANATOLIA_AREA: GamiPolygon = {
  id: 'anatolia',
  name: 'Ankara–Eskişehir–Konya suppliers',
  text: '3 bridge suppliers · 30–35 days',
  color: MAP.area,
  ring: blob([31.85, 38.95], 205, 2, [1.3, 0.95], 15),
  wallM: 18000,
  labelSide: 'west',
}

/* ---------- Briefing places ---------- */

export type GamiPlace = { id: GamiPlaceId; camera: GamiCamera; scene: ReturnType<typeof scene> }

export const GAMI_PLACES: Record<GamiPlaceId, GamiPlace> = {
  kingdom: { id: 'kingdom', camera: KINGDOM_CAMERA, scene: KINGDOM_SCENE },
  eastern: { id: 'eastern', camera: EASTERN_CAMERA, scene: EASTERN_SCENE },
  wds: { id: 'wds', camera: WDS_CAMERA, scene: WDS_SCENE },
  western: { id: 'western', camera: WESTERN_CAMERA, scene: WESTERN_SCENE },
}
