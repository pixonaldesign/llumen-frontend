/**
 * Demo-only per-slide scenes for the Abu Dhabi story: map camera, column and disk
 * variations, legend colors, and the insight card numbers.
 */
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'

export type StorySceneCamera = {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

/** [front, side, top] fills for the isometric legend glyph. */
export type ColumnGlyphColors = [string, string, string]

export type StoryScene = {
  camera: StorySceneCamera
  /** Height (meters) → color stops for the columns. */
  columnRamp: [number, string][]
  columnHeight: (lng: number, lat: number, baseHeight: number, index: number) => number
  diskCore: string
  diskHalo: string
  diskRadius: (lng: number, lat: number, baseRadius: number, index: number) => number
  legend: {
    diskRing: string
    diskScale: string
    junctionCount: number
    glyphs: [ColumnGlyphColors, ColumnGlyphColors, ColumnGlyphColors]
  }
  insight: {
    emissionsLabels: string[]
    /** Remaps a y value (0 top, 100 bottom) of the traced emissions line. */
    emissionsWarp: (x: number, y: number) => number
    groundwaterValue: number
    groundwaterWarp: (x: number, y: number) => number
    terrestrial: number
    marine: number
    online: number
    sites: number
    uptime: number
    /** Indices of the 47 site bars shown as offline. */
    offlineBars: number[]
  }
}

export const COLUMN_MAX_HEIGHT_M = 6800

const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8

function hash(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function gauss(distanceSqKm: number, sigmaKm: number) {
  return Math.exp(-distanceSqKm / (2 * sigmaKm * sigmaKm))
}

function distSq(lng: number, lat: number, point: [number, number]) {
  const dx = (lng - point[0]) * KM_PER_DEG_LNG
  const dy = (lat - point[1]) * KM_PER_DEG_LAT
  return dx * dx + dy * dy
}

function segmentDistSq(lng: number, lat: number, a: [number, number], b: [number, number]) {
  const ax = a[0] * KM_PER_DEG_LNG
  const ay = a[1] * KM_PER_DEG_LAT
  const bx = b[0] * KM_PER_DEG_LNG - ax
  const by = b[1] * KM_PER_DEG_LAT - ay
  const px = lng * KM_PER_DEG_LNG - ax
  const py = lat * KM_PER_DEG_LAT - ay
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)))
  const dx = px - t * bx
  const dy = py - t * by
  return dx * dx + dy * dy
}

function clampY(y: number) {
  return Math.max(2, Math.min(98, y))
}

const HEAT_CORRIDOR: [[number, number], [number, number]] = [
  [54.352, 24.492],
  [54.435, 24.447],
]

const IDLE_HOTSPOTS: [number, number][] = [
  [54.3807, 24.4603],
  [54.3969, 24.4413],
  [54.4294, 24.4341],
]

function hotspotWeight(lng: number, lat: number, sigmaKm: number) {
  return Math.max(...IDLE_HOTSPOTS.map((point) => gauss(distSq(lng, lat, point), sigmaKm)))
}

export const STORY_SCENES: StoryScene[] = [
  {
    camera: { center: [54.44133, 24.50633], zoom: 12.08, pitch: 66.2, bearing: 4.2 },
    columnRamp: [
      [200, '#2c18b4'],
      [900, '#3526d8'],
      [1600, '#3552ea'],
      [3000, '#2f8ef0'],
      [5000, '#22a6e6'],
      [6800, '#34c8f8'],
    ],
    columnHeight: (_lng, _lat, base) => Math.min(COLUMN_MAX_HEIGHT_M, base * 0.85),
    diskCore: '#3fe3d2',
    diskHalo: '#1fc4bb',
    diskRadius: (_lng, _lat, base) => base,
    legend: {
      diskRing: '#3fd3c6',
      diskScale: 'rgba(128, 128, 178, 0.72)',
      junctionCount: 599,
      glyphs: [
        ['#4b12b0', '#34088a', '#7a3fe0'],
        ['#3f7fe0', '#2c5cb4', '#86b4f6'],
        ['#35c6e8', '#1f98bb', '#9befff'],
      ],
    },
    insight: {
      emissionsLabels: ['7.5k', '5k', '2.5k', '0'],
      emissionsWarp: (_x, y) => y,
      groundwaterValue: 68,
      groundwaterWarp: (_x, y) => y,
      terrestrial: 443,
      marine: 156,
      online: 575,
      sites: 599,
      uptime: 96,
      offlineBars: [12, 35],
    },
  },
  {
    camera: { center: [54.392, 24.468], zoom: 12.55, pitch: 62, bearing: -48 },
    columnRamp: [
      [200, '#8a1826'],
      [900, '#b0241f'],
      [1600, '#cc3a1c'],
      [3000, '#e0601c'],
      [5000, '#f59a2a'],
      [6800, '#ffd25a'],
    ],
    columnHeight: (lng, lat, _base, index) => {
      const corridor = gauss(segmentDistSq(lng, lat, ...HEAT_CORRIDOR), 0.75)
      const height = 220 + 700 * hash(index, 2) + 5200 * corridor * (0.4 + 0.6 * hash(index, 3))
      return Math.min(COLUMN_MAX_HEIGHT_M, height)
    },
    diskCore: '#ff9a3c',
    diskHalo: '#ff5a1f',
    diskRadius: (lng, lat, base) =>
      base * (0.7 + 1.1 * gauss(segmentDistSq(lng, lat, ...HEAT_CORRIDOR), 1.4)),
    legend: {
      diskRing: '#ff9a3c',
      diskScale: 'rgba(214, 140, 96, 0.72)',
      junctionCount: 642,
      glyphs: [
        ['#8a1a24', '#5f0f18', '#c0463c'],
        ['#e0601c', '#a8410f', '#f6975a'],
        ['#ffc24a', '#d1901c', '#ffe49a'],
      ],
    },
    insight: {
      emissionsLabels: ['9k', '6k', '3k', '0'],
      emissionsWarp: (x, y) => clampY(y * (0.55 + 0.25 * (x / 100)) + 6),
      groundwaterValue: 82,
      groundwaterWarp: (_x, y) => clampY(50 + (y - 50) * 1.3 + 6),
      terrestrial: 430,
      marine: 212,
      online: 591,
      sites: 642,
      uptime: 92,
      offlineBars: [6, 19, 35, 40],
    },
  },
  {
    camera: { center: [54.402, 24.452], zoom: 12.45, pitch: 56, bearing: 36 },
    columnRamp: [
      [200, '#5b1fa8'],
      [900, '#7a24c4'],
      [1600, '#a02ed0'],
      [3000, '#d03cc4'],
      [5000, '#f45aae'],
      [6800, '#ff9ad4'],
    ],
    columnHeight: (lng, lat, _base, index) => {
      const hotspot = hotspotWeight(lng, lat, 0.7)
      const height = 200 + 900 * hash(index, 4) + 5800 * hotspot * (0.55 + 0.45 * hash(index, 5))
      return Math.min(COLUMN_MAX_HEIGHT_M, height)
    },
    diskCore: '#d86cff',
    diskHalo: '#9a4dff',
    diskRadius: (lng, lat, base, index) =>
      base * (0.55 + 0.4 * hash(index, 6) + 0.9 * hotspotWeight(lng, lat, 1)),
    legend: {
      diskRing: '#d86cff',
      diskScale: 'rgba(170, 120, 200, 0.72)',
      junctionCount: 571,
      glyphs: [
        ['#5a1596', '#3d0d6a', '#8f4fd0'],
        ['#c02ec8', '#8c1f94', '#e37ae8'],
        ['#ff7ac8', '#d0529c', '#ffc0e4'],
      ],
    },
    insight: {
      emissionsLabels: ['6k', '4k', '2k', '0'],
      emissionsWarp: (x, y) => clampY(y + 18 * Math.sin((Math.PI * x) / 100)),
      groundwaterValue: 54,
      groundwaterWarp: (x, y) => clampY(50 + (y - 50) * 0.55 - 14 + 5 * Math.sin((Math.PI * 2 * x) / 100)),
      terrestrial: 468,
      marine: 103,
      online: 554,
      sites: 571,
      uptime: 97,
      offlineBars: [22],
    },
  },
]

export function storySceneAt(slideIndex: number) {
  return STORY_SCENES[slideIndex % STORY_SCENES.length]
}

const CITY_CENTER: [number, number] = [54.44, 24.46]
const SITE_BAR_COUNT = 47

function signedHash(index: number, seed: number) {
  return hash(index, seed) * 2 - 1
}

/** −1…1 west→east pattern (with per-point jitter) that rolls values across the city. */
function spatialWave(lng: number, lat: number, index: number, seed: number) {
  const x = Math.max(-1, Math.min(1, ((lng - CITY_CENTER[0]) * KM_PER_DEG_LNG) / 10))
  const y = Math.max(-1, Math.min(1, ((lat - CITY_CENTER[1]) * KM_PER_DEG_LAT) / 8))
  return 0.6 * x + 0.25 * y + 0.35 * signedHash(index, seed)
}

function offlineBarsFor(insight: StoryScene['insight'], online: number, sites: number) {
  const baseOffline = Math.max(1, insight.sites - insight.online)
  const count = Math.max(
    1,
    Math.min(12, Math.round((insight.offlineBars.length * (sites - online)) / baseOffline)),
  )
  const extra = Array.from({ length: SITE_BAR_COUNT }, (_, index) => index)
    .filter((index) => !insight.offlineBars.includes(index))
    .sort((a, b) => hash(a, 12) - hash(b, 12))
  return [...insight.offlineBars, ...extra].slice(0, count).sort((a, b) => a - b)
}

/**
 * The slide's scene at a point of its timeline loop (`phase` 0…1). Phase 0 is the
 * authored scene; the loop is periodic so the last frame flows back into the first.
 */
export function sceneAtPhase(scene: StoryScene, phase: number): StoryScene {
  if (phase === 0) return scene
  const a = Math.sin(2 * Math.PI * phase)
  const b = Math.sin(4 * Math.PI * phase)
  const { insight, legend } = scene
  const junctionCount = Math.round(legend.junctionCount * (1 + 0.05 * a + 0.02 * b))
  const online = Math.min(junctionCount, Math.round(insight.online * (1 + 0.035 * a - 0.02 * b)))
  const congested = Math.max(
    0,
    Math.min(junctionCount, Math.round(insight.marine * (1 - 0.12 * a + 0.06 * b))),
  )
  return {
    ...scene,
    columnHeight: (lng, lat, base, index) => {
      const height = scene.columnHeight(lng, lat, base, index)
      const scale = 1 + 0.55 * a * spatialWave(lng, lat, index, 7) + 0.25 * b * signedHash(index, 8)
      return Math.max(60, Math.min(COLUMN_MAX_HEIGHT_M, height * scale))
    },
    diskRadius: (lng, lat, base, index) => {
      const radius = scene.diskRadius(lng, lat, base, index)
      const scale = 1 + 0.4 * a * spatialWave(lng, lat, index, 9) + 0.2 * b * signedHash(index, 10)
      return Math.max(base * 0.25, radius * scale)
    },
    legend: {
      ...legend,
      junctionCount,
    },
    insight: {
      ...insight,
      emissionsWarp: (x, y) =>
        clampY(
          insight.emissionsWarp(x, y) -
            12 * a * Math.sin((Math.PI * x) / 100) -
            5 * b * Math.sin((2 * Math.PI * x) / 100),
        ),
      groundwaterValue: Math.max(0, Math.min(100, Math.round(insight.groundwaterValue + 7 * a + 3 * b))),
      groundwaterWarp: (x, y) =>
        clampY(insight.groundwaterWarp(x, y) - 10 * a * (x / 100) - 4 * b * Math.sin((2 * Math.PI * x) / 100)),
      terrestrial: junctionCount - congested,
      marine: congested,
      online,
      sites: junctionCount,
      uptime: Math.round((online / junctionCount) * 100),
      offlineBars: offlineBarsFor(insight, online, junctionCount),
    },
  }
}

export type StorySceneState = {
  heights: number[]
  columnColors: [number, number, number][]
  radii: number[]
  diskCore: [number, number, number]
  diskHalo: [number, number, number]
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rampColor(ramp: [number, string][], height: number): [number, number, number] {
  if (height <= ramp[0][0]) return hexToRgb(ramp[0][1])
  for (let i = 1; i < ramp.length; i += 1) {
    const [stop, color] = ramp[i]
    if (height <= stop) {
      const [prevStop, prevColor] = ramp[i - 1]
      const t = (height - prevStop) / (stop - prevStop)
      const a = hexToRgb(prevColor)
      const b = hexToRgb(color)
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    }
  }
  return hexToRgb(ramp[ramp.length - 1][1])
}

export function sceneState(scene: StoryScene): StorySceneState {
  const heights = DEMO_COLUMNS.map(([lng, lat, base], index) => scene.columnHeight(lng, lat, base, index))
  return {
    heights,
    columnColors: heights.map((height) => rampColor(scene.columnRamp, height)),
    radii: DEMO_JUNCTIONS.map(([lng, lat, base], index) => scene.diskRadius(lng, lat, base, index)),
    diskCore: hexToRgb(scene.diskCore),
    diskHalo: hexToRgb(scene.diskHalo),
  }
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
}

export function mixSceneState(from: StorySceneState, to: StorySceneState, t: number): StorySceneState {
  return {
    heights: from.heights.map((height, index) => mix(height, to.heights[index], t)),
    columnColors: from.columnColors.map((color, index) => mixRgb(color, to.columnColors[index], t)),
    radii: from.radii.map((radius, index) => mix(radius, to.radii[index], t)),
    diskCore: mixRgb(from.diskCore, to.diskCore, t),
    diskHalo: mixRgb(from.diskHalo, to.diskHalo, t),
  }
}

export function rgbString([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}
