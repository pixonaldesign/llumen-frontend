/**
 * Demo-only map annotations for the "top 10 schools" prompts. Annotations are
 * geographic (GeoJSON-style lng/lat geometry) and reference the column features they describe,
 * so the map can redraw them as the camera moves and drop them when that data isn't shown.
 */
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  MUSSAFAH_LABEL,
  MUSSAFAH_MAX_HEIGHT_M,
  MUSSAFAH_REGION,
  pointInPolygon,
  regionColumnHeights,
  type StoryAiSnapshot,
  type StoryMapRegion,
} from './storyAiScenarios'
import { COLUMN_MAX_HEIGHT_M, sceneAtPhase, sceneState, storySceneAt } from './storyDemoScenes'

export const TOP_SCHOOLS_COUNT = 10
export const TOP_SCHOOLS_PERIOD = 'the last 2 months'
export const TOP_SCHOOLS_PROMPT =
  'Show me the top 10 schools with the highest traffic around them over the last 2 months, and annotate them on the map.'
export const ANNOTATION_COLOR = '#ffb547'
/** A picked area is read as a congested one: red, walled in, with only its top 10 columns left standing. */
export const LOCATION_ANNOTATION_COLOR = '#ff4d4f'

/** The location as it reads mid-sentence ("the drawn area near …" for drawn ones). */
export function locationPlace(location: Pick<StoryLocation, 'name' | 'kind'>) {
  return location.kind === 'drawn' ? location.name.replace(/^Drawn/, 'the drawn') : location.name
}

/** Picked areas are read as industrial: the prompt asks which schools the area's factory emissions reach. */
export function locationPrompt(location: Pick<StoryLocation, 'name' | 'kind'>) {
  return `Show me the schools most affected by emissions from the factories in ${locationPlace(location)} over the last 2 months, and annotate the top 10 on the map.`
}

/** Students at schools this close to a factory count as affected by the emergency. */
const AFFECTED_FACTORY_KM = 1
/** Estimated health and absence cost avoided per affected student, AED. */
const AED_SAVED_PER_STUDENT = 1350
/** Demo stand-in for the factory registry: plants within reach of each school close to the industrial belt. */
const FACTORIES_PER_NEAR_SCHOOL = 2

/** Approach 3 marker scenario: junctions this close to a school count as around it. */
const SCHOOL_JUNCTION_RADIUS_KM = 0.8
/** Busiest junctions marked around each school. */
const JUNCTIONS_PER_SCHOOL = 3
/** Marked schools stay at least this far apart, so their markers don't overlap. */
const MARKED_SCHOOL_SPACING_KM = 0.35
/** Data state the marker scenario's annotations were created in: the first prompt's period. */
export const MARKERS_PERIOD = '2024–2025'

/** Columns closer than this join the same annotated area. */
const CLUSTER_KM = 1.7
/** Padding around the columns of an area, so the outline doesn't cut through them. */
const AREA_PADDING_M = 380
const DISTRICT_RADIUS_M = 900
const MUSSAFAH_PADDING_M = 260
const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8

const SCHOOL_NAMES = [
  'Al Nahda Model School',
  'Al Khalidiyah Girls School',
  'Sheikh Khalifa Primary',
  'Al Bateen Secondary',
  'Al Manhal Cycle 2 School',
  'Corniche Boys School',
  'Al Danah Academy',
  'Al Ittihad National School',
  'Al Hisn Girls School',
  'Al Markaziyah Cycle 1 School',
  'Al Zahiyah Model School',
  'Al Wahdah Academy',
  'Al Mina Secondary',
  'Al Mushrif Primary',
  'Al Nahyan Girls School',
  'Qasr Al Bahr School',
]

const MUSSAFAH_SCHOOL_NAMES = [
  'Mussafah Model School',
  'Al Mussafah Girls School',
  'M-10 Cycle 2 School',
  'Shabiya Primary',
  'Mussafah Boys Secondary',
  'Al Fajr Academy',
  'ICAD Community School',
  'Al Muna Cycle 1 School',
  'M-26 National School',
  'Al Salam Girls School',
  'Mussafah Industrial Academy',
  'Al Rawda Primary',
  'Al Noor Secondary',
  'M-4 Cycle 3 School',
]

type RegionId = 'abu-dhabi' | 'al-ain' | 'al-dhafra'

const REGIONS: { id: RegionId; name: string }[] = [
  { id: 'abu-dhabi', name: 'Abu Dhabi' },
  { id: 'al-ain', name: 'Al Ain' },
  { id: 'al-dhafra', name: 'Al Dhafra' },
]

/** Demo district centres; only the island ones (and Mussafah) sit on the story's own data. */
const DISTRICTS: { name: string; at: [number, number]; region: RegionId; island?: boolean }[] = [
  { name: 'Al Khalidiyah', at: [54.347, 24.468], region: 'abu-dhabi', island: true },
  { name: 'Al Manhal', at: [54.362, 24.466], region: 'abu-dhabi', island: true },
  { name: 'Al Hisn', at: [54.355, 24.481], region: 'abu-dhabi', island: true },
  { name: 'Al Markaziyah', at: [54.357, 24.492], region: 'abu-dhabi', island: true },
  { name: 'Al Danah', at: [54.366, 24.484], region: 'abu-dhabi', island: true },
  { name: 'Al Bateen', at: [54.334, 24.458], region: 'abu-dhabi', island: true },
  { name: 'Al Khubeirat', at: [54.326, 24.474], region: 'abu-dhabi', island: true },
  { name: 'Al Zahiyah', at: [54.382, 24.495], region: 'abu-dhabi', island: true },
  { name: 'Al Mina', at: [54.372, 24.517], region: 'abu-dhabi', island: true },
  { name: 'Al Wahdah', at: [54.376, 24.471], region: 'abu-dhabi', island: true },
  { name: 'Al Nahyan', at: [54.388, 24.462], region: 'abu-dhabi', island: true },
  { name: 'Al Mushrif', at: [54.385, 24.444], region: 'abu-dhabi', island: true },
  { name: MUSSAFAH_LABEL, at: [54.516, 24.346], region: 'abu-dhabi' },
  { name: "Al 'Ajban", at: [54.795, 24.605], region: 'abu-dhabi' },
  { name: 'Al Aliah Island', at: [54.452, 24.548], region: 'abu-dhabi' },
  { name: 'Ain Al Faydah', at: [55.772, 24.104], region: 'al-ain' },
  { name: "Al 'Arad", at: [55.722, 24.172], region: 'al-ain' },
  { name: "Al 'Iqabiyyah", at: [55.738, 24.236], region: 'al-ain' },
  { name: 'Al Aamerah', at: [55.694, 24.246], region: 'al-ain' },
  { name: 'Al Aflaj', at: [55.782, 24.192], region: 'al-ain' },
  { name: 'Al Ain International Airport', at: [55.609, 24.262], region: 'al-ain' },
  { name: 'Madinat Zayed', at: [53.705, 23.68], region: 'al-dhafra' },
  { name: 'Ghayathi', at: [52.805, 23.835], region: 'al-dhafra' },
  { name: 'Ruwais', at: [52.73, 24.11], region: 'al-dhafra' },
  { name: 'Liwa', at: [53.775, 23.14], region: 'al-dhafra' },
]

/** Demo corridors: a street's centreline, end to end. */
const CORRIDORS: { name: string; region: RegionId; path: [number, number][] }[] = [
  { name: 'Sheikh Zayed Bin Sultan St.', region: 'abu-dhabi', path: [[54.358, 24.496], [54.398, 24.446]] },
  { name: 'Al Khalidiyah', region: 'abu-dhabi', path: [[54.334, 24.476], [54.358, 24.458]] },
  { name: 'Al Manhal', region: 'abu-dhabi', path: [[54.35, 24.479], [54.373, 24.456]] },
  { name: 'Al Bateen', region: 'abu-dhabi', path: [[54.321, 24.464], [54.346, 24.447]] },
  { name: 'Al Rawdah', region: 'abu-dhabi', path: [[54.374, 24.454], [54.398, 24.43]] },
  { name: 'Khalifa Bin Zayed St.', region: 'al-ain', path: [[55.712, 24.226], [55.772, 24.204]] },
  { name: 'Madinat Zayed Main St.', region: 'al-dhafra', path: [[53.684, 23.694], [53.724, 23.668]] },
]

const STREETS = [
  'Hamdan St',
  'Airport Rd',
  'Corniche Rd',
  'Electra St',
  'Muroor Rd',
  'Al Falah St',
  'Khaleej Al Arabi St',
  'Al Saada St',
  'Najda St',
  'Al Nahyan St',
  'Mohammed Bin Khalifa St',
  'Al Karamah St',
  'Defence Rd',
  'Salam St',
  'Fatima Bint Mubarak St',
  'Sultan Bin Zayed St',
]

const SCHOOL_TYPES = ['Public', 'Private'] as const
const SCHOOL_LEVELS = ['Cycle 1', 'Cycle 2', 'Cycle 3'] as const

/** An area picked from the location search or drawn on the map. */
export type StoryLocation = {
  id: string
  name: string
  kind: 'district' | 'drawn'
  /** Outline ring (unclosed), lng/lat. */
  polygon: [number, number][]
}

export type StoryLocationType = 'emirate' | 'region' | 'district' | 'zone' | 'corridor'

export type StoryLocationOption = StoryLocation & {
  /** A level of the location breakdown it belongs to (ITC: emirate, region, district, zone, corridor). */
  type: string
  /** How the list shows it; zones are listed by number. */
  label: string
  /** The area one level up it sits in (ITC: a district's region, a zone's district), by id. */
  parent: string | null
}

export const STORY_LOCATION_TYPES: {
  id: StoryLocationType
  label: string
  plural: string
  /** The parent type the list can be filtered by. */
  filterBy?: StoryLocationType
}[] = [
  { id: 'emirate', label: 'Emirate', plural: 'Emirates' },
  { id: 'region', label: 'Region', plural: 'Regions' },
  { id: 'district', label: 'District', plural: 'Districts', filterBy: 'region' },
  { id: 'zone', label: 'Zone', plural: 'Zones', filterBy: 'district' },
  { id: 'corridor', label: 'Corridor', plural: 'Corridors', filterBy: 'region' },
]

export type AnnotatedSchool = {
  /** Index into the annotated layer's columns: the feature this annotation is anchored to. */
  column: number
  rank: number
  name: string
  district: string
  type: (typeof SCHOOL_TYPES)[number]
  level: (typeof SCHOOL_LEVELS)[number]
  /** Peak-hour vehicles within 500 m of the school. */
  peak: number
  /** Average PM2.5 at the school over the last 2 months, µg/m³. */
  pm25: number
  /** Distance to the nearest factory, km. */
  factoryKm: number
  /** Change vs the 2 months before, in percent. */
  change: number
  students: number
  coordinates: [number, number]
}

/** A monitored junction marked next to a school; the annotation is anchored to the junction itself. */
export type AnnotatedJunction = {
  /** Index into the layer's junctions: the feature this marker is anchored to. */
  junction: number
  id: string
  name: string
  district: string
  /** Peak-hour vehicles through the junction. */
  peak: number
  /** Peak-hour load, percent of capacity. */
  load: number
  /** Hours a day over capacity. */
  congestedHours: number
  /** Rank of the marked school it sits next to. */
  school: number
  distanceM: number
  coordinates: [number, number]
}

export type AnnotatedArea = {
  id: string
  label: string
  district: string
  /** Outline ring (unclosed), lng/lat. */
  polygon: [number, number][]
  /** Where the area label sits: the outline's northernmost point. */
  anchor: [number, number]
  columns: number[]
  junctions: number
}

/** The emergency response pinned above an annotated area. */
export type AnnotationAction = {
  text: string
  affected: number
  total: number
  /** AED. */
  saved: number
  /** Ground point the card is pinned to: the centre of the selected area. */
  at: [number, number]
}

export type StoryMapAnnotation = {
  /** Slide whose data the annotation was created from. */
  slide: number
  /** Which columns the annotation refers to: the story's own, or the Mussafah focus region's. */
  layer: 'main' | 'region'
  /** Set when the prompt was scoped to a picked or drawn area. */
  location: string | null
  /** What the schools are ranked by: nearby traffic, or exposure to the area's factory emissions. */
  metric: 'traffic' | 'emissions'
  /** `columns` highlights the schools' columns and outlines areas; `markers` pins schools and junctions instead. */
  style: 'columns' | 'markers'
  color: string
  schools: AnnotatedSchool[]
  areas: AnnotatedArea[]
  /** Junctions marked next to the schools (marker style only). */
  junctions: AnnotatedJunction[]
  action: AnnotationAction | null
}

function hash01(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function distanceKm(a: [number, number], b: [number, number]) {
  return Math.hypot((a[0] - b[0]) * KM_PER_DEG_LNG, (a[1] - b[1]) * KM_PER_DEG_LAT)
}

export function nearestDistrict(point: [number, number]) {
  let best = DISTRICTS[0]
  for (const district of DISTRICTS) {
    if (distanceKm(point, district.at) < distanceKm(point, best.at)) best = district
  }
  return best.name
}

/** 8,912 → "8.9k". */
export function compactCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value)
}

/** 12,030,000 → "12M AED". */
export function compactAed(value: number) {
  return value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M AED` : `${compactCount(value)} AED`
}

export function polygonCenter(polygon: [number, number][]): [number, number] {
  return [
    polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length,
    polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length,
  ]
}

/** Area-weighted centre of a ring; unlike the vertex mean, dense street traces don't pull it aside. */
function areaCentroid(ring: [number, number][]): [number, number] {
  let area = 0
  let x = 0
  let y = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    x += (x0 + x1) * cross
    y += (y0 + y1) * cross
  }
  return area === 0 ? polygonCenter(ring) : [x / (3 * area), y / (3 * area)]
}

/** Single-linkage clusters of the given points. */
function clusters(points: [number, number][]) {
  const groups = points.map((_, index) => index)
  const root = (index: number): number => (groups[index] === index ? index : root(groups[index]))
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distanceKm(points[i], points[j]) <= CLUSTER_KM) groups[root(j)] = root(i)
    }
  }
  const byRoot = new Map<number, number[]>()
  points.forEach((_, index) => {
    const key = root(index)
    byRoot.set(key, [...(byRoot.get(key) ?? []), index])
  })
  return [...byRoot.values()]
}

function cross(o: [number, number], a: [number, number], b: [number, number]) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function convexHull(points: [number, number][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const half = (list: [number, number][]) => {
    const out: [number, number][] = []
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop()
      out.push(point)
    }
    out.pop()
    return out
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** Rounded outline around the points: the convex hull of a circle drawn around each one. */
export function paddedOutline(points: [number, number][], paddingM = AREA_PADDING_M) {
  const sides = 20
  const ring: [number, number][] = []
  for (const [lng, lat] of points) {
    const dLat = paddingM / 111320
    const dLng = paddingM / (111320 * Math.cos((lat * Math.PI) / 180))
    for (let i = 0; i < sides; i += 1) {
      const t = (i / sides) * Math.PI * 2
      ring.push([lng + Math.cos(t) * dLng, lat + Math.sin(t) * dLat])
    }
  }
  return convexHull(ring)
}

const islandDistricts = DISTRICTS.filter((district) => district.island)
const ZONES_PER_DISTRICT = 3
const OFF_ISLAND_DISTRICT_RADIUS_M = 1200
const CORRIDOR_HALF_WIDTH_M = 260

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function locationOption(
  type: StoryLocationType,
  name: string,
  polygon: [number, number][],
  parent: string | null,
  label = name,
): StoryLocationOption {
  return { id: `${type}-${slug(name)}`, name, label, kind: 'district', type, parent, polygon }
}

/** Mussafah's outline follows its columns; the others are drawn around their centres. */
function districtOutline(district: (typeof DISTRICTS)[number]) {
  if (district.name === MUSSAFAH_LABEL) {
    return paddedOutline(
      MUSSAFAH_REGION.columns.map(([lng, lat]) => [lng, lat]),
      MUSSAFAH_PADDING_M,
    )
  }
  return paddedOutline([district.at], district.island ? DISTRICT_RADIUS_M : OFF_ISLAND_DISTRICT_RADIUS_M)
}

/** A district split into numbered zones, spread evenly around its centre. */
function zoneOutlines(polygon: [number, number][], seed: number) {
  const center = areaCentroid(polygon)
  const radiusKm = Math.max(...polygon.map((point) => distanceKm(point, center)))
  const turn = hash01(seed, 21) * Math.PI * 2
  return Array.from({ length: ZONES_PER_DISTRICT }, (_, index) => {
    const angle = turn + (index * 2 * Math.PI) / ZONES_PER_DISTRICT
    const at: [number, number] = [
      center[0] + (Math.cos(angle) * radiusKm * 0.48) / KM_PER_DEG_LNG,
      center[1] + (Math.sin(angle) * radiusKm * 0.48) / KM_PER_DEG_LAT,
    ]
    return paddedOutline([at], radiusKm * 420)
  })
}

const byLabel = (a: StoryLocationOption, b: StoryLocationOption) =>
  a.label.localeCompare(b.label, 'en', { numeric: true })

const regionDistricts = (id: RegionId) => DISTRICTS.filter((district) => district.region === id)

const REGION_OUTLINES: Record<RegionId, [number, number][]> = {
  'abu-dhabi': paddedOutline(
    regionDistricts('abu-dhabi')
      .filter((district) => district.name !== "Al 'Ajban")
      .map((district) => district.at),
    1500,
  ),
  'al-ain': paddedOutline(
    regionDistricts('al-ain').map((district) => district.at),
    1500,
  ),
  // Al Dhafra spans the western desert; the demo focuses on its seat, Madinat Zayed.
  'al-dhafra': paddedOutline([[53.705, 23.68]], 4500),
}

const DISTRICT_OPTIONS = [
  locationOption(
    'district',
    'Abu Dhabi Island',
    paddedOutline(
      islandDistricts.map((district) => district.at),
      DISTRICT_RADIUS_M,
    ),
    'region-abu-dhabi',
  ),
  ...DISTRICTS.map((district) =>
    locationOption('district', district.name, districtOutline(district), `region-${district.region}`),
  ),
].sort(byLabel)

/** The district the landing AI bar's demo prompt asks about, without going through the picker. */
export const MUSSAFAH_LOCATION = DISTRICT_OPTIONS.find((district) => district.name === MUSSAFAH_LABEL) as StoryLocationOption

const ZONE_OPTIONS = DISTRICT_OPTIONS.filter((district) => district.id !== 'district-abu-dhabi-island').flatMap(
  (district, order) =>
    zoneOutlines(district.polygon, order + 1).map((polygon, index) => {
      const number = order * ZONES_PER_DISTRICT + index + 1
      return { ...locationOption('zone', `${district.name} Zone ${number}`, polygon, district.id), label: `${number}` }
    }),
)

/** Every area the location picker offers, grouped by type: emirate, regions, districts, zones, corridors. */
export const STORY_LOCATIONS: StoryLocationOption[] = [
  locationOption(
    'emirate',
    'Abu Dhabi',
    paddedOutline(
      regionDistricts('abu-dhabi').map((district) => district.at),
      3000,
    ),
    null,
  ),
  ...REGIONS.map((region) => locationOption('region', region.name, REGION_OUTLINES[region.id], null)).sort(byLabel),
  ...DISTRICT_OPTIONS,
  ...ZONE_OPTIONS,
  ...CORRIDORS.map((corridor) =>
    locationOption(
      'corridor',
      corridor.name.endsWith('St.') ? corridor.name : `${corridor.name} Corridor`,
      paddedOutline(corridor.path, CORRIDOR_HALF_WIDTH_M),
      `region-${corridor.region}`,
      corridor.name,
    ),
  ),
]

export function drawnLocation(polygon: [number, number][]): StoryLocation {
  return {
    id: `drawn-${Date.now()}`,
    name: `Drawn area near ${nearestDistrict(polygonCenter(polygon))}`,
    kind: 'drawn',
    polygon,
  }
}

type Candidate = { index: number; height: number; coordinates: [number, number] }

function rankSchools(candidates: Candidate[], maxHeight: number, names: string[]): AnnotatedSchool[] {
  const schools = [...candidates]
    .sort((a, b) => b.height - a.height)
    .slice(0, TOP_SCHOOLS_COUNT)
    .map(({ height, index, coordinates }, order): AnnotatedSchool => {
      const share = Math.min(1, height / maxHeight)
      return {
        column: index,
        rank: order + 1,
        name: names[Math.floor(hash01(index, 7) * names.length)],
        district: nearestDistrict(coordinates),
        type: SCHOOL_TYPES[hash01(index, 8) < 0.62 ? 0 : 1],
        level: SCHOOL_LEVELS[Math.floor(hash01(index, 9) * SCHOOL_LEVELS.length)],
        peak: Math.round((620 + share * 2280) / 10) * 10,
        pm25: Math.round(38 + share * 74),
        factoryKm: Math.round((1.9 - share * 1.5 + hash01(index, 12) * 0.3) * 10) / 10,
        change: Math.round(4 + hash01(index, 10) * 22),
        students: Math.round((480 + hash01(index, 11) * 1300) / 10) * 10,
        coordinates,
      }
    })
  // Two picks can share a name; keep each label unique within the top 10.
  const used = new Set<string>()
  for (const school of schools) {
    let offset = 0
    while (used.has(school.name)) {
      offset += 1
      school.name = names[(names.indexOf(school.name) + offset) % names.length]
    }
    used.add(school.name)
  }
  return schools
}

function areaFrom(
  id: string,
  name: string,
  polygon: [number, number][],
  schools: AnnotatedSchool[],
  junctions: [number, number, number][],
): AnnotatedArea {
  return {
    id,
    label: `${name} · ${schools.length} ${schools.length === 1 ? 'school' : 'schools'}`,
    district: name,
    polygon,
    anchor: polygon.reduce((best, point) => (point[1] > best[1] ? point : best), polygon[0]),
    columns: schools.map((school) => school.column),
    junctions: junctions.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length,
  }
}

/** The slide's 10 tallest columns, read as the 10 schools with the most traffic around them. */
export function topSchoolsAnnotation(slide: number): StoryMapAnnotation {
  const heights = sceneState(sceneAtPhase(storySceneAt(slide), 0)).heights
  const schools = rankSchools(
    heights.map((height, index) => ({ index, height, coordinates: [DEMO_COLUMNS[index][0], DEMO_COLUMNS[index][1]] })),
    COLUMN_MAX_HEIGHT_M,
    SCHOOL_NAMES,
  )
  const areas = clusters(schools.map((school) => school.coordinates))
    .sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b))
    .map((members, order) => {
      const group = members.map((member) => schools[member])
      const polygon = paddedOutline(group.map((school) => school.coordinates))
      return areaFrom(`area-${order + 1}`, nearestDistrict(polygonCenter(polygon)), polygon, group, DEMO_JUNCTIONS)
    })
  return {
    slide,
    layer: 'main',
    location: null,
    metric: 'traffic',
    style: 'columns',
    color: ANNOTATION_COLOR,
    schools,
    areas,
    junctions: [],
    action: null,
  }
}

function junctionName(index: number) {
  const first = Math.floor(hash01(index, 21) * STREETS.length)
  const second = (first + 1 + Math.floor(hash01(index, 22) * (STREETS.length - 1))) % STREETS.length
  return `${STREETS[first]} × ${STREETS[second]}`
}

/**
 * Approach 3 marker scenario: the 10 schools with the busiest junctions within 800 m, each marked
 * along with up to 3 of those junctions. Markers are anchored to the school and junction features.
 */
export function schoolMarkersAnnotation(slide: number): StoryMapAnnotation {
  const radii = sceneState(sceneAtPhase(storySceneAt(slide), 0)).radii
  const maxRadius = Math.max(...radii, 1)
  const around = DEMO_COLUMNS.map(([lng, lat], index) => {
    const coordinates: [number, number] = [lng, lat]
    const nearby = DEMO_JUNCTIONS.flatMap(([jLng, jLat], junction) => {
      const km = distanceKm(coordinates, [jLng, jLat])
      return km <= SCHOOL_JUNCTION_RADIUS_KM && (radii[junction] ?? 0) > 0 ? [{ junction, km }] : []
    }).sort((a, b) => radii[b.junction] - radii[a.junction])
    return { index, coordinates, nearby }
  })
  // Each junction is marked once, for the school that claims it first, so every school keeps its own junctions.
  const used = new Set<number>()
  const picked: (Candidate & { nearby: { junction: number; km: number }[] })[] = []
  while (picked.length < TOP_SCHOOLS_COUNT) {
    let best: { candidate: (typeof around)[number]; nearby: { junction: number; km: number }[]; score: number } | null =
      null
    for (const candidate of around) {
      if (picked.some((school) => distanceKm(school.coordinates, candidate.coordinates) < MARKED_SCHOOL_SPACING_KM)) {
        continue
      }
      const nearby = candidate.nearby.filter((item) => !used.has(item.junction)).slice(0, JUNCTIONS_PER_SCHOOL)
      const score = nearby.reduce((sum, item) => sum + radii[item.junction], 0)
      if (score > 0 && (!best || score > best.score)) best = { candidate, nearby, score }
    }
    if (!best) break
    for (const item of best.nearby) used.add(item.junction)
    const { index, coordinates } = best.candidate
    picked.push({ index, coordinates, nearby: best.nearby, height: radii[best.nearby[0].junction] })
  }
  const schools = rankSchools(picked, maxRadius, SCHOOL_NAMES)
  const junctions: AnnotatedJunction[] = []
  for (const school of schools) {
    for (const { junction, km } of picked.find((item) => item.index === school.column)?.nearby ?? []) {
      const share = radii[junction] / maxRadius
      const [lng, lat] = DEMO_JUNCTIONS[junction]
      junctions.push({
        junction,
        id: `J-${String(junction + 1).padStart(3, '0')}`,
        name: junctionName(junction),
        district: nearestDistrict([lng, lat]),
        peak: Math.round((900 + share * 2600) / 10) * 10,
        load: Math.round(62 + share * 58),
        congestedHours: Math.round((1 + share * 6) * 2) / 2,
        school: school.rank,
        distanceM: Math.round((km * 1000) / 10) * 10,
        coordinates: [lng, lat],
      })
    }
  }
  return {
    slide,
    layer: 'main',
    location: null,
    metric: 'traffic',
    style: 'markers',
    color: ANNOTATION_COLOR,
    schools,
    areas: [],
    junctions,
    action: null,
  }
}

function emissionsAction(location: StoryLocation, schools: AnnotatedSchool[]): AnnotationAction {
  const total = schools.reduce((sum, school) => sum + school.students, 0)
  const near = schools.filter((school) => school.factoryKm <= AFFECTED_FACTORY_KM)
  const affected = near.reduce((sum, school) => sum + school.students, 0)
  const factories = Math.max(3, near.length * FACTORIES_PER_NEAR_SCHOOL)
  return {
    text: `Instruct the ${factories} factories within 1 km of schools in ${locationPlace(location)} to move production shifts to 03:00 PM – 11:00 PM, Sunday through Thursday`,
    affected,
    total,
    saved: affected * AED_SAVED_PER_STUDENT,
    at: areaCentroid(location.polygon),
  }
}

/** A location needs at least this many of the island's columns to be read from the story's own data. */
const MIN_LOCATION_COLUMNS = 3
/** Generated regions lay their columns on a (2n + 1)² grid over the location, and junctions on a coarser one. */
const GENERATED_COLUMN_GRID = 6
const GENERATED_JUNCTION_GRID = 3
const MIN_GENERATED_COLUMNS = 16
const MIN_GENERATED_JUNCTIONS = 6
/** Mussafah's span, the reference the generated regions' camera and sizes scale from. */
const REFERENCE_SPAN_KM = 6.5

function countInside(points: [number, number, number][], polygon: [number, number][]) {
  return points.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length
}

function seedOf(id: string) {
  let seed = 0
  for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) % 100_003
  return seed
}

/** Demo columns and junctions inside a location the story has no data for, laid out like Mussafah's. */
function generatedRegion(location: StoryLocation): StoryMapRegion {
  const { polygon } = location
  const seed = seedOf(location.id)
  const center = areaCentroid(polygon)
  const lngs = polygon.map(([lng]) => lng)
  const lats = polygon.map(([, lat]) => lat)
  const widthKm = (Math.max(...lngs) - Math.min(...lngs)) * KM_PER_DEG_LNG
  const heightKm = (Math.max(...lats) - Math.min(...lats)) * KM_PER_DEG_LAT
  const spanKm = Math.max(0.6, widthKm, heightKm)
  const scale = Math.min(3, Math.max(0.35, spanKm / REFERENCE_SPAN_KM))
  const hotspot: [number, number] = [
    center[0] + ((hash01(seed, 1) - 0.5) * widthKm * 0.4) / KM_PER_DEG_LNG,
    center[1] + ((hash01(seed, 2) - 0.5) * heightKm * 0.4) / KM_PER_DEG_LAT,
  ]
  const heat = (point: [number, number]) => Math.exp(-(distanceKm(point, hotspot) ** 2) / (2 * (spanKm * 0.3) ** 2))
  const grid = (cells: number, keep: number, place: (point: [number, number], index: number) => number) => {
    const step = spanKm / (2 * cells)
    const out: [number, number, number][] = []
    let index = 0
    for (let i = -cells; i <= cells; i += 1) {
      for (let j = -cells; j <= cells; j += 1) {
        index += 1
        const point: [number, number] = [
          center[0] + ((i + (hash01(index, seed + 3) - 0.5) * 0.7) * step) / KM_PER_DEG_LNG,
          center[1] + ((j + (hash01(index, seed + 4) - 0.5) * 0.7) * step) / KM_PER_DEG_LAT,
        ]
        if (hash01(index, seed + 5) > keep || !pointInPolygon(point, polygon)) continue
        out.push([point[0], point[1], place(point, index)])
      }
    }
    return out
  }
  // Thin or diagonal outlines (corridors) catch few grid points, so the grid densifies until enough land inside.
  const dense = (cells: number, min: number, keep: number, place: (point: [number, number], index: number) => number) => {
    let points = grid(cells, keep, place)
    for (let next = cells * 2; points.length < min && next <= cells * 8; next *= 2) points = grid(next, keep, place)
    return points
  }
  // Smaller areas are seen from closer, so their columns are shorter to keep the same proportions on screen.
  const heightScale = Math.min(1, Math.max(0.2, spanKm / REFERENCE_SPAN_KM))
  const columns = dense(GENERATED_COLUMN_GRID, MIN_GENERATED_COLUMNS, 0.58, (point, index) =>
    Math.min(
      COLUMN_MAX_HEIGHT_M,
      (200 + 520 * hash01(index, seed + 6) + 2300 * heat(point) * (0.45 + 0.55 * hash01(index, seed + 7))) *
        heightScale,
    ),
  )
  const junctions = dense(
    GENERATED_JUNCTION_GRID,
    MIN_GENERATED_JUNCTIONS,
    0.88,
    (point, index) => (120 + 170 * hash01(index, seed + 8) + 190 * heat(point)) * scale,
  )
  return {
    id: `location-${location.id}`,
    label: location.name,
    camera: {
      center,
      // Capped so small zones keep some context and the area's fixed-height walls don't fill the view.
      zoom: Math.min(14, Math.max(9, 12.75 + Math.log2(REFERENCE_SPAN_KM / spanKm))),
      pitch: 58,
      bearing: -24,
    },
    columnRadiusM: Math.min(160, Math.max(18, spanKm * 6)),
    columnRamp: MUSSAFAH_REGION.columnRamp,
    columns,
    junctions,
  }
}

const generatedRegions = new Map<string, StoryMapRegion>()

/**
 * Where a location's columns come from: the island's own (null), Mussafah's focus region, or — for
 * places the story has no data for — demo columns generated inside it, so every location shows data.
 */
export function locationRegion(location: StoryLocation): StoryMapRegion | null {
  if (countInside(DEMO_COLUMNS, location.polygon) >= MIN_LOCATION_COLUMNS) return null
  if (countInside(MUSSAFAH_REGION.columns, location.polygon) > 0) return MUSSAFAH_REGION
  const key = `${location.id}:${location.polygon.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';')}`
  let region = generatedRegions.get(key)
  if (!region) {
    region = generatedRegion(location)
    generatedRegions.set(key, region)
  }
  return region
}

/** The focus region a saved snapshot shows: its location's, or Mussafah for the region prompts. */
export function snapshotRegion(snapshot: Pick<StoryAiSnapshot, 'annotation'>) {
  const location = snapshot.annotation?.location
  return (location && locationRegion(location)) || MUSSAFAH_REGION
}

/** The 10 tallest columns inside a picked or drawn area, read as the schools most exposed to its factory emissions. */
export function locationAnnotation(slide: number, location: StoryLocation): StoryMapAnnotation {
  const region = locationRegion(location)
  const columns = region ? region.columns : DEMO_COLUMNS
  const heights = region ? regionColumnHeights(region, 0) : sceneState(sceneAtPhase(storySceneAt(slide), 0)).heights
  const candidates = columns.flatMap(([lng, lat], index): Candidate[] =>
    pointInPolygon([lng, lat], location.polygon) ? [{ index, height: heights[index] ?? 0, coordinates: [lng, lat] }] : [],
  )
  const maxHeight = !region
    ? COLUMN_MAX_HEIGHT_M
    : region === MUSSAFAH_REGION
      ? MUSSAFAH_MAX_HEIGHT_M
      : Math.max(...region.columns.map(([, , height]) => height))
  const schools = rankSchools(candidates, maxHeight, region === MUSSAFAH_REGION ? MUSSAFAH_SCHOOL_NAMES : SCHOOL_NAMES)
  const junctions = region ? region.junctions : DEMO_JUNCTIONS
  return {
    slide,
    layer: region ? 'region' : 'main',
    location: location.name,
    metric: 'emissions',
    style: 'columns',
    color: LOCATION_ANNOTATION_COLOR,
    schools,
    areas: [areaFrom('area-location', location.name, location.polygon, schools, junctions)],
    junctions: [],
    action: schools.length > 0 ? emissionsAction(location, schools) : null,
  }
}
