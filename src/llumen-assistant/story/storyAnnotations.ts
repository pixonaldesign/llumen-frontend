/**
 * Demo-only map annotations for the Approach 2 "top 10 schools" prompts. Annotations are
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

const DISTRICTS: { name: string; at: [number, number] }[] = [
  { name: 'Al Khalidiyah', at: [54.347, 24.468] },
  { name: 'Al Manhal', at: [54.362, 24.466] },
  { name: 'Al Hisn', at: [54.355, 24.481] },
  { name: 'Al Markaziyah', at: [54.357, 24.492] },
  { name: 'Al Danah', at: [54.366, 24.484] },
  { name: 'Al Bateen', at: [54.334, 24.458] },
  { name: 'Al Khubeirat', at: [54.326, 24.474] },
  { name: 'Al Zahiyah', at: [54.382, 24.495] },
  { name: 'Al Mina', at: [54.372, 24.517] },
  { name: 'Al Wahdah', at: [54.376, 24.471] },
  { name: 'Al Nahyan', at: [54.388, 24.462] },
  { name: 'Al Mushrif', at: [54.385, 24.444] },
  { name: MUSSAFAH_LABEL, at: [54.516, 24.346] },
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

export type StoryLocationOption = StoryLocation & { description: string }

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
function paddedOutline(points: [number, number][], paddingM = AREA_PADDING_M) {
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

const islandDistricts = DISTRICTS.filter((district) => district.name !== MUSSAFAH_LABEL)

export function locationColumnCount(polygon: [number, number][]) {
  return (
    DEMO_COLUMNS.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length +
    MUSSAFAH_REGION.columns.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length
  )
}

/** Areas the location search knows about; Mussafah's outline follows its columns. */
export const STORY_LOCATIONS: StoryLocationOption[] = [
  {
    id: 'mussafah',
    name: MUSSAFAH_LABEL,
    kind: 'district' as const,
    polygon: paddedOutline(
      MUSSAFAH_REGION.columns.map(([lng, lat]) => [lng, lat]),
      MUSSAFAH_PADDING_M,
    ),
    description: 'Industrial district',
  },
  ...islandDistricts.map((district) => ({
    id: district.name.toLowerCase().replace(/\s+/g, '-'),
    name: district.name,
    kind: 'district' as const,
    polygon: paddedOutline([district.at], DISTRICT_RADIUS_M),
    description: 'Abu Dhabi Island',
  })),
].map((location) => ({
  ...location,
  description: `${location.description} · ${locationColumnCount(location.polygon)} columns`,
}))

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

/** Whether a location's columns come from the Mussafah focus region rather than the island overlay. */
export function locationUsesRegion(location: StoryLocation) {
  const inside = (columns: [number, number, number][]) =>
    columns.filter(([lng, lat]) => pointInPolygon([lng, lat], location.polygon)).length
  const region = inside(MUSSAFAH_REGION.columns)
  return region > 0 && region >= inside(DEMO_COLUMNS)
}

/** The 10 tallest columns inside a picked or drawn area, read as the schools most exposed to its factory emissions. */
export function locationAnnotation(slide: number, location: StoryLocation): StoryMapAnnotation {
  const region = locationUsesRegion(location)
  const columns = region ? MUSSAFAH_REGION.columns : DEMO_COLUMNS
  const heights = region
    ? regionColumnHeights(MUSSAFAH_REGION, 0)
    : sceneState(sceneAtPhase(storySceneAt(slide), 0)).heights
  const candidates = columns.flatMap(([lng, lat], index): Candidate[] =>
    pointInPolygon([lng, lat], location.polygon) ? [{ index, height: heights[index] ?? 0, coordinates: [lng, lat] }] : [],
  )
  const schools = rankSchools(
    candidates,
    region ? MUSSAFAH_MAX_HEIGHT_M : COLUMN_MAX_HEIGHT_M,
    region ? MUSSAFAH_SCHOOL_NAMES : SCHOOL_NAMES,
  )
  const junctions = region ? MUSSAFAH_REGION.junctions : DEMO_JUNCTIONS
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
