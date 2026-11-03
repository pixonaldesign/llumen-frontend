/**
 * Where the GAMI demo happens: the Kingdom's defence industrial sites (names invented for the demo),
 * and each finding's map scenes, cameras and outlined areas.
 */
import { blob, distanceKm, hash, offsetKm, scatter, type LngLat } from './gamiGeo'
import { scene, type GamiArc, type GamiColumn, type GamiDisk, type GamiIcon, type GamiPin } from './gamiMapLayers'
import { TONE, type GamiCamera, type GamiPlaceId, type GamiPolygon } from './gamiTypes'

export type Domain = 'air' | 'armament' | 'land' | 'naval' | 'electronics'

export const DOMAIN_COLOR: Record<Domain, string> = {
  air: TONE.sky,
  armament: TONE.gold,
  land: TONE.teal,
  naval: TONE.blue,
  electronics: TONE.violet,
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  air: 'Air',
  armament: 'Armament',
  land: 'Land',
  naval: 'Naval',
  electronics: 'Electronics',
}

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
  { id: 'jeddah-naval', name: 'Jeddah Naval Systems Yard', city: 'Jeddah', at: [39.15, 21.42], domain: 'naval', companies: 27, employees: 4100 },
  { id: 'kaec-land', name: 'KAEC Land Systems Plant', city: 'King Abdullah Economic City', at: [39.12, 22.45], domain: 'land', companies: 32, employees: 3900 },
  { id: 'yanbu-armament', name: 'Yanbu Energetics Works', city: 'Yanbu', at: [38.25, 24.0], domain: 'armament', companies: 18, employees: 2400 },
  { id: 'taif-air', name: 'Taif Aerospace MRO Centre', city: 'Taif', at: [40.5, 21.3], domain: 'air', companies: 22, employees: 3300 },
  { id: 'tabuk-land', name: 'Tabuk Vehicle Systems Depot', city: 'Tabuk', at: [36.6, 28.4], domain: 'land', companies: 16, employees: 2100 },
  { id: 'dammam-electronics', name: 'Dammam Electronics Assembly', city: 'Dammam', at: [50.07, 26.36], domain: 'electronics', companies: 44, employees: 5200 },
  { id: 'jubail-land', name: 'Jubail Armor & Steel Works', city: 'Jubail', at: [49.62, 27.02], domain: 'land', companies: 37, employees: 6100 },
  { id: 'khamis-air', name: 'Khamis Mushait Aircraft Maintenance', city: 'Khamis Mushait', at: [42.75, 18.3], domain: 'air', companies: 19, employees: 2700 },
]

const site = (id: string) => SITES.find((item) => item.id === id)!

const ICON: Record<Domain, GamiIcon> = {
  air: 'air',
  armament: 'armament',
  land: 'land',
  naval: 'naval',
  electronics: 'electronics',
}

function sitePin(item: Site, group: string, label: boolean): GamiPin {
  return {
    at: item.at,
    label: label ? item.name : undefined,
    color: item.risk ? TONE.red : TONE.teal,
    icon: ICON[item.domain],
    group,
    title: item.name,
    info: [
      ['City', item.city],
      ['Domain', DOMAIN_LABEL[item.domain]],
      ['Status', item.risk ? 'At risk · Poland supply' : 'Normal'],
      ['Companies', String(item.companies)],
      ['Employees', item.employees.toLocaleString('en-US')],
    ],
  }
}

/** Value columns around each site: one per few companies, as tall as its share of the site's workforce. */
function siteColumns(items: Site[], radiusKm: number, maxHeight: number, perColumn: number, group: string): GamiColumn[] {
  return items.flatMap((item, s) => {
    const count = Math.max(4, Math.round(item.companies / perColumn))
    return scatter(item.at, count, radiusKm, s * 7 + 3).map((at, i) => ({
      at,
      height: maxHeight * (item.employees / 7900) * (0.35 + 0.65 * hash(i, s + 11)),
      color: item.risk ? TONE.red : i % 3 === 0 ? TONE.ice : TONE.teal,
      group,
    }))
  })
}

function siteDisks(items: Site[], radiusM: number, group: string): GamiDisk[] {
  return items.map((item) => ({
    at: item.at,
    radiusM,
    base: 0,
    height: radiusM * 0.05,
    color: item.risk ? TONE.red : TONE.teal,
    group,
  }))
}

/* ---------- Finding 1: the Kingdom overview ---------- */

const CORRIDOR = SITES.filter((item) => ['riyadh-uav', 'alkharj-uav', 'riyadh-electronics', 'alkharj-armament'].includes(item.id))

export const KINGDOM_CAMERA: GamiCamera = { center: [44.4, 23.6], zoom: 4.95, pitch: 50, bearing: -12 }

export const KINGDOM_SCENE = scene({
  columnRadiusM: 7500,
  columns: siteColumns(SITES, 34, 380000, 6, 'sites-columns'),
  disks: siteDisks(SITES, 42000, 'sites-disks'),
})

export const KINGDOM_STORY_SCENE = scene({
  ...KINGDOM_SCENE,
  pins: SITES.map((item) => sitePin(item, 'sites-pins', false)),
})

export const CORRIDOR_CAMERA: GamiCamera = { center: [47.0, 24.42], zoom: 7.55, pitch: 56, bearing: 28 }

export const CORRIDOR_SCENE = scene({
  columnRadiusM: 1300,
  columns: siteColumns(CORRIDOR, 13, 62000, 1.6, 'sites-columns'),
  disks: siteDisks(CORRIDOR, 9000, 'sites-disks'),
  pins: CORRIDOR.map((item) => sitePin(item, 'sites-pins', true)),
})

export const CORRIDOR_AREA: GamiPolygon = {
  id: 'corridor',
  name: 'Riyadh–Al Kharj corridor',
  text: '248 companies · SAR 7.9bn',
  color: TONE.sky,
  ring: blob([46.97, 24.47], 50, 4, [1.65, 0.72], -52),
  wallM: 5000,
}

/* ---------- Finding 2: localization in the Eastern Province ---------- */

type Opportunity = { name: string; value: number; domain: Domain; at: LngLat }

export const OPPORTUNITIES: Opportunity[] = [
  { name: 'UAV airframes & propulsion', value: 6.8, domain: 'air', at: [50.0, 26.4] },
  { name: 'Ammunition & energetics', value: 5.9, domain: 'armament', at: [49.52, 27.07] },
  { name: 'Armored vehicle subsystems', value: 4.7, domain: 'land', at: [49.72, 26.94] },
  { name: 'Radar & comms modules', value: 4.2, domain: 'electronics', at: [50.15, 26.28] },
  { name: 'Aircraft MRO & spares', value: 3.9, domain: 'air', at: [49.6, 25.42] },
  { name: 'Naval vessel outfitting', value: 2.6, domain: 'naval', at: [49.27, 27.47] },
]

const HEAT_ZONES: [LngLat, number, number, number][] = [
  // centre, points, radius km, weight
  [[49.62, 27.02], 170, 16, 1],
  [[50.04, 26.33], 140, 14, 0.9],
  [[49.24, 27.48], 70, 9, 0.75],
  [[50.19, 26.27], 50, 6, 0.7],
  [[49.6, 25.4], 70, 12, 0.6],
  [[49.95, 26.75], 30, 18, 0.35],
]

function heatPoints(zones: [LngLat, number, number, number][], group: string, seed: number) {
  return zones.flatMap(([center, count, radiusKm, weight], z) =>
    scatter(center, count, radiusKm, seed + z * 13).map((at, i) => ({ at, weight: weight * (0.4 + 0.6 * hash(i, z + seed)), group })),
  )
}

function opportunityDisks(items: Opportunity[], scale: number, base: number, group: string): GamiDisk[] {
  return items.map((item, index) => ({
    at: item.at,
    radiusM: Math.sqrt(item.value) * scale,
    base: base * (0.8 + 0.1 * index),
    height: base * 0.12,
    color: DOMAIN_COLOR[item.domain],
    group,
  }))
}

function stems(disks: GamiDisk[], group: string): GamiColumn[] {
  return disks.map((disk) => ({ at: disk.at, height: disk.base, color: 'rgba(255,255,255,0.55)', group }))
}

const EASTERN_DISKS = opportunityDisks(OPPORTUNITIES, 8200, 26000, 'opportunity-disks')

export const EASTERN_CAMERA: GamiCamera = { center: [49.72, 26.55], zoom: 7.35, pitch: 54, bearing: 16 }

const LOCALIZATION_RAMP = ['#123a6b', '#2c6fd1', '#2de8c8', '#e8d44d', '#ffc401']

export const EASTERN_SCENE = scene({
  columnRadiusM: 420,
  heat: heatPoints(HEAT_ZONES, 'capacity-heat', 21),
  heatRadiusM: 15000,
  heatRamp: LOCALIZATION_RAMP,
  disks: EASTERN_DISKS,
  columns: stems(EASTERN_DISKS, 'opportunity-disks'),
})

export const EASTERN_STORY_SCENE = scene({
  ...EASTERN_SCENE,
  pins: SITES.filter((item) => ['jubail-land', 'dammam-electronics'].includes(item.id)).map((item) =>
    sitePin(item, 'sites-pins', true),
  ),
})

const JUBAIL_CENTER: LngLat = [49.62, 27.0]

type Supplier = { name: string; at: LngLat; capability: string; status: string; ready: boolean }

export const JUBAIL_SUPPLIERS: Supplier[] = [
  { name: 'Jubail Energetics Park', at: offsetKm(JUBAIL_CENTER, -7, 5), capability: 'Propellants & charges', status: 'Licence review', ready: false },
  { name: 'Gulf Armor Plate Mill', at: offsetKm(JUBAIL_CENTER, 5, 6), capability: 'Armor steel', status: 'Ready', ready: true },
  { name: 'Eastern Composites Works', at: offsetKm(JUBAIL_CENTER, 8, -4), capability: 'Composites', status: 'Needs licence', ready: false },
  { name: 'Jubail Precision Forge', at: offsetKm(JUBAIL_CENTER, -3, -7), capability: 'Machining & forging', status: 'Ready', ready: true },
  { name: 'Vehicle Subsystems Hub', at: offsetKm(JUBAIL_CENTER, 1, 0.5), capability: 'Vehicle subsystems', status: 'Ready', ready: true },
]

export const JUBAIL_CAMERA: GamiCamera = { center: [49.63, 26.99], zoom: 9.75, pitch: 58, bearing: 32 }

export const JUBAIL_SCENE = scene({
  columnRadiusM: 260,
  heat: heatPoints([[JUBAIL_CENTER, 260, 12, 1]], 'capacity-heat', 5),
  heatRadiusM: 2200,
  heatRamp: LOCALIZATION_RAMP,
  columns: JUBAIL_SUPPLIERS.flatMap((supplier, s) =>
    scatter(supplier.at, 9, 2.2, s * 5 + 2).map((at, i) => ({
      at,
      height: 2600 + 4200 * hash(i, s + 3),
      color: supplier.ready ? TONE.green : TONE.amber,
      group: 'supplier-columns',
    })),
  ),
  disks: [
    { at: offsetKm(JUBAIL_CENTER, -6, 8), radiusM: 2600, base: 9000, height: 900, color: DOMAIN_COLOR.armament, group: 'opportunity-disks' },
    { at: offsetKm(JUBAIL_CENTER, 6, -1), radiusM: 2300, base: 7800, height: 900, color: DOMAIN_COLOR.land, group: 'opportunity-disks' },
  ],
  pins: JUBAIL_SUPPLIERS.map((supplier) => ({
    at: supplier.at,
    label: supplier.name,
    color: supplier.ready ? TONE.green : TONE.amber,
    icon: 'factory' as const,
    group: 'supplier-pins',
    title: supplier.name,
    info: [
      ['Capability', supplier.capability],
      ['Status', supplier.status],
      ['City', 'Jubail Industrial City'],
    ] as [string, string][],
  })),
})

export const JUBAIL_AREA: GamiPolygon = {
  id: 'jubail',
  name: 'Jubail Industrial City',
  text: 'SAR 10.6bn ready to localize',
  color: TONE.gold,
  ring: blob([49.63, 27.0], 11.5, 9, [1.25, 1], 20),
  wallM: 1400,
}

/* ---------- Finding 3: World Defense Show 2028 ---------- */

export const MALHAM: LngLat = [46.16, 25.12]

export type Region = 'europe' | 'middle-east' | 'asia' | 'north-america' | 'africa' | 'latin-america'

export const REGION_COLOR: Record<Region, string> = {
  europe: TONE.violet,
  'middle-east': TONE.teal,
  asia: TONE.gold,
  'north-america': TONE.sky,
  africa: TONE.amber,
  'latin-america': TONE.green,
}

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

export const WDS_SCENE = scene({
  arcs: DELEGATIONS.map(([, at, region]) => ({
    from: at,
    to: MALHAM,
    color: REGION_COLOR[region],
    peakM: Math.min(1400000, distanceKm(at, MALHAM) * 110),
    width: 2,
    group: 'delegation-arcs',
  })),
  arcWidthM: 42000,
  disks: [{ at: MALHAM, radiusM: 120000, base: 0, height: 60000, color: TONE.gold, group: 'venue-disk' }],
})

export const WDS_STORY_SCENE = scene({
  ...WDS_SCENE,
  pins: [
    {
      at: MALHAM,
      label: 'WDS 2028 · Malham, Riyadh',
      color: TONE.gold,
      icon: 'venue',
      group: 'venue-disk',
      title: 'World Defense Show 2028',
      info: [
        ['Venue', 'Malham, north of Riyadh'],
        ['Opens', '6 February 2028'],
        ['Applications', '1,940 exhibitors'],
      ],
    },
  ],
})

const HALLS: [string, LngLat, number][] = [
  ['Hall 1 · Air', offsetKm(MALHAM, -1.6, 1.0), 1],
  ['Hall 2 · Land', offsetKm(MALHAM, -0.4, 1.3), 0.9],
  ['Hall 3 · Electronics', offsetKm(MALHAM, 0.8, 1.0), 0.95],
  ['Hall 4 · Armament', offsetKm(MALHAM, -1.0, -0.2), 0.7],
  ['Hall 5 · Naval', offsetKm(MALHAM, 0.3, -0.3), 0.55],
]

const ARRIVALS: [string, LngLat][] = [
  ['King Khalid International Airport', [46.7, 24.96]],
  ['Riyadh city centre', [46.68, 24.71]],
  ['KAFD', [46.64, 24.76]],
  ['Malham village', [46.08, 25.16]],
]

export const MALHAM_CAMERA: GamiCamera = { center: offsetKm(MALHAM, 0.2, 0.4), zoom: 12.4, pitch: 60, bearing: -24 }

export const MALHAM_SCENE = scene({
  columnRadiusM: 70,
  columns: HALLS.flatMap(([, at, share], h) =>
    scatter(at, 16, 0.38, h * 3 + 1).map((point, i) => ({
      at: point,
      height: 280 + 520 * share * hash(i, h + 9),
      color: i % 4 === 0 ? TONE.ice : TONE.gold,
      group: 'hall-columns',
    })),
  ),
  heat: [
    ...scatter(offsetKm(MALHAM, -0.4, 0.6), 240, 1.8, 3).map((at, i) => ({ at, weight: 0.5 + 0.5 * hash(i, 4), group: 'visitor-heat' })),
    ...scatter(offsetKm(MALHAM, 1.8, -1.6), 90, 0.9, 8).map((at, i) => ({ at, weight: 0.4 + 0.4 * hash(i, 2), group: 'visitor-heat' })),
  ],
  heatRadiusM: 260,
  heatRamp: ['#2a1c4a', '#7b68ee', '#f5a729', '#ffe08a'],
  arcs: ARRIVALS.map(([, at], index) => ({
    from: at,
    to: offsetKm(MALHAM, 0.4 - index * 0.3, -0.6),
    color: TONE.teal,
    peakM: 2500 + index * 400,
    width: 2.2,
    group: 'shuttle-arcs',
  })),
  arcWidthM: 45,
  disks: [{ at: offsetKm(MALHAM, 1.8, -1.6), radiusM: 380, base: 900, height: 60, color: TONE.sky, group: 'display-disk' }],
  pins: [
    ...HALLS.map(([name, at]) => ({ at, label: name, color: TONE.gold, icon: 'venue' as const, group: 'hall-columns' })),
    {
      at: offsetKm(MALHAM, 1.8, -1.6),
      label: 'Flying display & static aircraft',
      color: TONE.sky,
      icon: 'air',
      group: 'display-disk',
      title: 'Flying display & static aircraft',
      info: [
        ['Static aircraft slots', '70'],
        ['Runway upgrade', '74% complete'],
      ],
    },
  ],
})

export const MALHAM_AREA: GamiPolygon = {
  id: 'malham',
  name: 'Malham exhibition venue',
  text: '5 halls · 82% ready',
  color: TONE.gold,
  ring: blob(offsetKm(MALHAM, 0.1, 0.1), 2.4, 3, [1.35, 1], 10),
  wallM: 180,
}

/* ---------- Finding 4: human capital in the Western Region ---------- */

type TalentCity = { name: string; at: LngLat; gap: number }

export const TALENT_CITIES: TalentCity[] = [
  { name: 'Jeddah', at: [39.19, 21.54], gap: 980 },
  { name: 'King Abdullah Economic City', at: [39.1, 22.4], gap: 640 },
  { name: 'Yanbu', at: [38.06, 24.09], gap: 290 },
  { name: 'Taif', at: [40.42, 21.27], gap: 230 },
]

const HORIZONS: [number, string][] = [
  [1, TONE.ice],
  [1.28, TONE.sky],
  [1.67, TONE.blue],
]

function talentDisks(scale: number, base: number, thickness: number): GamiDisk[] {
  return TALENT_CITIES.flatMap((city) =>
    HORIZONS.map(([factor, color], level) => ({
      at: city.at,
      radiusM: Math.sqrt(city.gap * factor) * scale,
      base: base * (level + 1),
      height: thickness,
      color,
      group: 'gap-disks',
    })),
  )
}

const ACADEMIES: GamiPin[] = [
  {
    at: [39.27, 21.64],
    label: 'National Academy for Military Industries · Jeddah',
    color: TONE.violet,
    icon: 'academy',
    group: 'academy-pins',
    title: 'National Academy for Military Industries',
    info: [
      ['Campus', 'Jeddah'],
      ['Enrolled', '1,410'],
      ['Graduates 2026', '620'],
    ],
  },
  {
    at: [39.17, 22.33],
    label: 'KAEC Technical Institute',
    color: TONE.violet,
    icon: 'academy',
    group: 'academy-pins',
    title: 'KAEC Technical Institute',
    info: [
      ['Graduates a year', '180'],
      ['Programmes', 'Machining · UAV integration'],
    ],
  },
  {
    at: [40.52, 21.36],
    label: 'Taif Aviation Training Centre',
    color: TONE.violet,
    icon: 'academy',
    group: 'academy-pins',
    title: 'Taif Aviation Training Centre',
    info: [['Graduates a year', '140']],
  },
]

export const WESTERN_CAMERA: GamiCamera = { center: [39.45, 22.55], zoom: 6.35, pitch: 56, bearing: -18 }

export const WESTERN_SCENE = scene({
  disks: talentDisks(1900, 17000, 4200),
  columns: TALENT_CITIES.map((city) => ({ at: city.at, height: 51000, color: 'rgba(255,255,255,0.5)', group: 'gap-disks' })),
  columnRadiusM: 1400,
})

export const WESTERN_STORY_SCENE = scene({ ...WESTERN_SCENE, pins: ACADEMIES })

const KAEC_CENTER: LngLat = [39.12, 22.42]

type Employer = { name: string; at: LngLat; roles: number; domain: Domain }

export const KAEC_EMPLOYERS: Employer[] = [
  { name: 'KAEC Land Systems Plant', at: offsetKm(KAEC_CENTER, 0.5, 2.5), roles: 214, domain: 'land' },
  { name: 'Red Sea Composites', at: offsetKm(KAEC_CENTER, -3, -1.5), roles: 126, domain: 'air' },
  { name: 'Western UAV Assembly', at: offsetKm(KAEC_CENTER, 3.5, -2.5), roles: 118, domain: 'air' },
  { name: 'Coastal Electronics Works', at: offsetKm(KAEC_CENTER, 4, 3.5), roles: 92, domain: 'electronics' },
  { name: 'Other employers (4)', at: offsetKm(KAEC_CENTER, -2.5, 4.5), roles: 90, domain: 'armament' },
]

export const KAEC_CAMERA: GamiCamera = { center: offsetKm(KAEC_CENTER, 0.5, 0.8), zoom: 10.35, pitch: 58, bearing: -28 }

export const KAEC_SCENE = scene({
  columnRadiusM: 180,
  columns: KAEC_EMPLOYERS.flatMap((employer, e) =>
    scatter(employer.at, Math.round(employer.roles / 14), 1.2, e * 3 + 5).map((at, i) => ({
      at,
      height: 900 + 2400 * (employer.roles / 214) * hash(i, e + 1),
      color: DOMAIN_COLOR[employer.domain],
      group: 'role-columns',
    })),
  ),
  heat: scatter(offsetKm(KAEC_CENTER, -1, 1), 220, 8, 17).map((at, i) => ({ at, weight: 0.3 + 0.7 * hash(i, 6), group: 'applicant-heat' })),
  heatRadiusM: 1300,
  heatRamp: ['#1b2550', '#3b79be', '#70aeff', '#d8ecff'],
  disks: [{ at: [39.17, 22.33], radiusM: 1300, base: 3600, height: 300, color: TONE.violet, group: 'academy-pins' }],
  pins: [
    ...KAEC_EMPLOYERS.map((employer) => ({
      at: employer.at,
      label: `${employer.name} · ${employer.roles} open`,
      color: DOMAIN_COLOR[employer.domain],
      icon: ICON[employer.domain],
      group: 'role-columns',
    })),
    ACADEMIES[1],
  ],
})

export const KAEC_AREA: GamiPolygon = {
  id: 'kaec',
  name: 'KAEC industrial cluster',
  text: '640 unfilled roles',
  color: TONE.sky,
  ring: blob(offsetKm(KAEC_CENTER, 0.4, 1), 7.5, 6, [1, 1.2], 0),
  wallM: 900,
}

/* ---------- The alert: Poland supply disruption ---------- */

type PartSupplier = { name: string; city: string; at: LngLat; part: string; to: LngLat; labelSide?: 'west' }

export const POLAND_SUPPLIERS: PartSupplier[] = [
  { name: 'Rzeszow Propulsion Works', city: 'Rzeszów', at: [22.0, 50.04], part: 'Propulsion motors · 1,800/month', to: site('riyadh-uav').at },
  { name: 'Krakow Optronics Plant', city: 'Kraków', at: [19.94, 50.06], part: 'EO/IR gimbals · 240/month', to: site('alkharj-uav').at, labelSide: 'west' },
  { name: 'Gdansk Navigation Systems', city: 'Gdańsk', at: [18.65, 54.35], part: 'Inertial navigation units · 420/month', to: site('riyadh-uav').at },
]

export const TURKIYE_SUPPLIERS: PartSupplier[] = [
  { name: 'Ankara Propulsion Systems Park', city: 'Ankara', at: [32.85, 39.93], part: 'Propulsion motors · 2,000/month · 30 days', to: site('riyadh-uav').at },
  { name: 'Eskişehir Optronics Works', city: 'Eskişehir', at: [30.52, 39.78], part: 'EO/IR gimbals · 260/month · 35 days', to: site('alkharj-uav').at, labelSide: 'west' },
  { name: 'Konya Inertial Systems', city: 'Konya', at: [32.49, 37.87], part: 'Navigation units · 450/month · 32 days', to: site('riyadh-uav').at },
]

/** The other 17 affected imports, by the Polish city they ship from and the Saudi site they reach. */
const OTHER_ROUTES: [LngLat, string, 'moderate' | 'mild'][] = [
  [[21.01, 52.23], 'jeddah-naval', 'moderate'],
  [[21.01, 52.23], 'riyadh-electronics', 'moderate'],
  [[17.04, 51.11], 'kaec-land', 'moderate'],
  [[16.93, 52.41], 'jubail-land', 'moderate'],
  [[19.46, 51.76], 'taif-air', 'moderate'],
  [[19.02, 50.26], 'alkharj-armament', 'moderate'],
  [[22.57, 51.25], 'dammam-electronics', 'moderate'],
  [[18.0, 53.12], 'yanbu-armament', 'moderate'],
  [[14.55, 53.43], 'jeddah-naval', 'mild'],
  [[17.04, 51.11], 'tabuk-land', 'mild'],
  [[16.93, 52.41], 'khamis-air', 'mild'],
  [[19.46, 51.76], 'dammam-electronics', 'mild'],
  [[21.01, 52.23], 'jubail-land', 'mild'],
  [[19.02, 50.26], 'kaec-land', 'mild'],
  [[22.57, 51.25], 'alkharj-armament', 'mild'],
  [[18.0, 53.12], 'taif-air', 'mild'],
  [[14.55, 53.43], 'yanbu-armament', 'mild'],
]

function route(from: LngLat, to: LngLat, color: string, width: number, group: string, opacity = 1): GamiArc {
  return { from, to, color, peakM: distanceKm(from, to) * 120, width, group, opacity }
}

const RECEIVERS = SITES.filter((item) => item.risk)

function factoryPin(
  supplier: Omit<PartSupplier, 'to'>,
  color: string,
  group: string,
  status: string,
): GamiPin {
  return {
    at: supplier.at,
    label: supplier.name,
    labelSide: supplier.labelSide,
    color,
    icon: color === TONE.red ? 'warning' : 'factory',
    group,
    title: supplier.name,
    info: [
      ['City', supplier.city],
      ['Supplies', supplier.part],
      ['Status', status],
    ],
  }
}

/** Conflict intensity along Poland's eastern border, from the alert feed. */
const CONFLICT_HEAT = heatPoints(
  [
    [[23.8, 51.6], 90, 120, 1],
    [[24.2, 50.4], 80, 110, 0.9],
    [[23.4, 53.0], 50, 90, 0.6],
  ],
  'conflict-heat',
  41,
)

export const ALERT_CAMERA: GamiCamera = { center: [33.5, 40.5], zoom: 3.05, pitch: 32, bearing: -12 }

export const ALERT_SCENE = scene({
  arcs: [
    ...POLAND_SUPPLIERS.map((supplier) => route(supplier.at, supplier.to, TONE.red, 3, 'risk-routes')),
    ...OTHER_ROUTES.map(([from, to, level]) =>
      route(from, site(to).at, level === 'moderate' ? TONE.amber : TONE.yellow, 1.2, 'other-routes', 0.75),
    ),
  ],
  arcWidthM: 26000,
  heat: CONFLICT_HEAT,
  heatRadiusM: 160000,
  heatRamp: ['#3a0d12', '#a0201c', '#ee3f39', '#ffb199'],
  pins: [
    ...POLAND_SUPPLIERS.map((supplier) => factoryPin(supplier, TONE.red, 'poland-sites', 'Conflict: exports suspended')),
    ...RECEIVERS.map((item) => sitePin(item, 'receiving-sites', false)),
  ],
})

export const BRIDGE_CAMERA: GamiCamera = { center: [38.4, 32.6], zoom: 4.55, pitch: 44, bearing: -14 }

export const BRIDGE_SCENE = scene({
  arcs: [
    ...TURKIYE_SUPPLIERS.map((supplier) => route(supplier.at, supplier.to, TONE.green, 3, 'bridge-routes')),
    ...POLAND_SUPPLIERS.map((supplier) => route(supplier.at, supplier.to, TONE.red, 1.4, 'risk-routes', 0.35)),
  ],
  arcWidthM: 12000,
  disks: TURKIYE_SUPPLIERS.map((supplier) => ({
    at: supplier.at,
    radiusM: 26000,
    base: 0,
    height: 4000,
    color: TONE.green,
    group: 'bridge-routes',
  })),
  pins: [
    ...TURKIYE_SUPPLIERS.map((supplier) => factoryPin(supplier, TONE.green, 'turkiye-sites', 'Recommended bridge supplier · +8%')),
    ...RECEIVERS.map((item) => sitePin(item, 'receiving-sites', true)),
  ],
})

export const ANATOLIA_AREA: GamiPolygon = {
  id: 'anatolia',
  name: 'Ankara–Eskişehir–Konya suppliers',
  text: '3 bridge suppliers · 30–35 days',
  color: TONE.green,
  ring: blob([31.85, 38.95], 205, 2, [1.3, 0.95], 15),
  wallM: 30000,
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
