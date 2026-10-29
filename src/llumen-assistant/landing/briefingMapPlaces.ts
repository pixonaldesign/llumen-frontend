/**
 * Demo-only places for the Briefing map: each map stop shows the story columns in its
 * own palette over a different part of the UAE.
 */
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from '../story/storyDemoMapData'
import { MUSSAFAH_REGION } from '../story/storyAiScenarios'
import { STORY_SCENES, type StorySceneCamera } from '../story/storyDemoScenes'

export type BriefingPlaceId = 'abu-dhabi' | 'mussafah' | 'dubai' | 'al-ain'

export type BriefingPlace = {
  id: BriefingPlaceId
  camera: StorySceneCamera
  /** Height (meters) → color stops, already fitted to this place's tallest column. */
  ramp: [number, string][]
  diskCore: string
  diskHalo: string
  /** [lng, lat, height m] */
  columns: [number, number, number][]
  /** [lng, lat, radius m] */
  junctions: [number, number, number][]
}

const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8

const [BLUE, RED, PURPLE] = STORY_SCENES

function hash(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function fitRamp(ramp: [number, string][], columns: [number, number, number][]) {
  const tallest = Math.max(...columns.map(([, , height]) => height))
  const top = ramp[ramp.length - 1][0]
  return ramp.map(([stop, color]): [number, string] => [(stop / top) * tallest, color])
}

type GridOptions = {
  center: [number, number]
  /** Street-grid rotation, degrees counter-clockwise from east. */
  angle: number
  /** Half extents of the grid along and across its axis, km. */
  halfU: number
  halfV: number
  spacingKm: number
  /** Hotspot offset from the centre in grid km. */
  hotspot: [number, number]
  peakM: number
  seed: number
}

function gridPoint({ center, angle }: GridOptions, u: number, v: number): [number, number] {
  const a = (angle * Math.PI) / 180
  const dx = u * Math.cos(a) - v * Math.sin(a)
  const dy = u * Math.sin(a) + v * Math.cos(a)
  return [center[0] + dx / KM_PER_DEG_LNG, center[1] + dy / KM_PER_DEG_LAT]
}

function gridColumns(options: GridOptions) {
  const { halfU, halfV, spacingKm, hotspot, peakM, seed } = options
  const columns: [number, number, number][] = []
  let index = 0
  for (let u = -halfU; u <= halfU + 1e-6; u += spacingKm) {
    for (let v = -halfV; v <= halfV + 1e-6; v += spacingKm) {
      index += 1
      if (hash(index, seed) < 0.38) continue
      const ju = u + (hash(index, seed + 1) - 0.5) * spacingKm * 0.4
      const jv = v + (hash(index, seed + 2) - 0.5) * spacingKm * 0.4
      const hot = Math.exp(-((ju - hotspot[0]) ** 2 + (jv - hotspot[1]) ** 2) / (2 * 1.1 * 1.1))
      const height = 180 + 480 * hash(index, seed + 3) + peakM * hot * (0.45 + 0.55 * hash(index, seed + 4))
      const [lng, lat] = gridPoint(options, ju, jv)
      columns.push([lng, lat, height])
    }
  }
  return columns
}

function gridJunctions(options: GridOptions) {
  const { halfU, halfV, spacingKm, hotspot, seed } = options
  const step = spacingKm * 1.6
  const junctions: [number, number, number][] = []
  let index = 0
  for (let u = -halfU; u <= halfU + 1e-6; u += step) {
    for (let v = -halfV; v <= halfV + 1e-6; v += step) {
      index += 1
      if (hash(index, seed + 5) < 0.15) continue
      const hot = Math.exp(-((u - hotspot[0]) ** 2 + (v - hotspot[1]) ** 2) / (2 * 1.6 * 1.6))
      const [lng, lat] = gridPoint(options, u + step / 3, v + step / 3)
      junctions.push([lng, lat, 110 + 150 * hash(index, seed + 6) + 200 * hot])
    }
  }
  return junctions
}

function gridPlace(
  id: BriefingPlaceId,
  camera: StorySceneCamera,
  scene: (typeof STORY_SCENES)[number],
  options: GridOptions,
): BriefingPlace {
  const columns = gridColumns(options)
  return {
    id,
    camera,
    ramp: fitRamp(scene.columnRamp, columns),
    diskCore: scene.diskCore,
    diskHalo: scene.diskHalo,
    columns,
    junctions: gridJunctions(options),
  }
}

const abuDhabiColumns = DEMO_COLUMNS.map(([lng, lat, base], index): [number, number, number] => [
  lng,
  lat,
  BLUE.columnHeight(lng, lat, base, index),
])

/** Height-weighted centre, so the orbit turns around the tallest columns. */
function centroid(columns: [number, number, number][]): [number, number] {
  let lng = 0
  let lat = 0
  let total = 0
  for (const [x, y, height] of columns) {
    lng += x * height
    lat += y * height
    total += height
  }
  return [lng / total, lat / total]
}

const mussafahColumns = MUSSAFAH_REGION.columns

export const BRIEFING_PLACES: Record<BriefingPlaceId, BriefingPlace> = {
  'abu-dhabi': {
    id: 'abu-dhabi',
    camera: { ...BLUE.camera, center: centroid(abuDhabiColumns), zoom: 12.3 },
    ramp: BLUE.columnRamp,
    diskCore: BLUE.diskCore,
    diskHalo: BLUE.diskHalo,
    columns: abuDhabiColumns,
    junctions: DEMO_JUNCTIONS.map(([lng, lat, base], index): [number, number, number] => [
      lng,
      lat,
      BLUE.diskRadius(lng, lat, base, index),
    ]),
  },
  mussafah: {
    id: 'mussafah',
    camera: { ...MUSSAFAH_REGION.camera, center: centroid(mussafahColumns), zoom: 12.9, pitch: 64 },
    ramp: fitRamp(RED.columnRamp, mussafahColumns),
    diskCore: RED.diskCore,
    diskHalo: RED.diskHalo,
    columns: mussafahColumns,
    junctions: MUSSAFAH_REGION.junctions,
  },
  dubai: gridPlace(
    'dubai',
    { center: [55.226, 25.128], zoom: 13.15, pitch: 64, bearing: -38 },
    PURPLE,
    {
      center: [55.226, 25.128],
      angle: 42,
      halfU: 3.6,
      halfV: 1.6,
      spacingKm: 0.42,
      hotspot: [-0.8, 0.4],
      peakM: 4400,
      seed: 81,
    },
  ),
  'al-ain': gridPlace(
    'al-ain',
    { center: [55.752, 24.212], zoom: 12.95, pitch: 60, bearing: 18 },
    BLUE,
    {
      center: [55.752, 24.212],
      angle: 8,
      halfU: 3,
      halfV: 2.2,
      spacingKm: 0.42,
      hotspot: [0.6, -0.3],
      peakM: 3800,
      seed: 117,
    },
  ),
}
