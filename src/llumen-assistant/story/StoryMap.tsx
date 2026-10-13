/**
 * Real Mapbox map for Story view with the demo Abu Dhabi overlay:
 * value-distribution columns and monitored-junction disks, varied per slide scene.
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls, type InteractiveMapHandle } from '../InteractiveMap'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  hexToRgb,
  mixRgb,
  mixSceneState,
  rampColor,
  rgbString,
  sceneAtPhase,
  sceneState,
  storySceneAt,
  type StorySceneCamera,
  type StorySceneState,
} from './storyDemoScenes'
import {
  pointInPolygon,
  regionColumnHeights,
  regionJunctionRadii,
  type StoryAreaEffect,
  type StoryMapCapture,
  type StoryMapRegion,
} from './storyAiScenarios'
import {
  MARKERS_PERIOD,
  type AnnotatedJunction,
  type AnnotatedSchool,
  type AnnotationAction,
  type StoryMapAnnotation,
} from './storyAnnotations'
import type { StoryCamera, StoryCameraLink } from './storyCameraLink'
import {
  AnnotationLabels,
  annotationAt,
  drawAnnotations,
  mountAnnotationLayers,
  setAnnotationLift,
  startAnnotationDrawing,
  startAnnotationEditing,
  type AnnotationDrawing,
} from './storyMapAnnotationLayer'
import type { AnnotationTool, AnnotationValidity, DrawnShape, MapAnnotationItem } from './storyMapAnnotations'
import styles from './StoryMap.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmgnqbyjf005g01sh9s510hi2'
export const STORY_MAP_STYLE = MAPBOX_STYLE
/** Keeps the demo overlay clear of the 380px insight column. */
const CAMERA_PADDING = { top: 0, right: 0, bottom: 0, left: 400 }
const CAMERA_DURATION_MS = 2600
const SCENE_TWEEN_MS = 1800
const REGION_FLY_MS = 3200
const REGION_FLY_DELAY_MS = 120
const REGION_GROW_MS = 4400
const AREA_TWEEN_MS = 1900
const ANNOTATION_IN_MS = 1500
const ANNOTATION_OUT_MS = 700
/** Colour the columns outside an annotation fade toward. */
const ANNOTATION_DIM_RGB: [number, number, number] = [26, 32, 44]
const ANNOTATION_DIM = 0.55
/** Walls around a picked area: stacked bands whose opacity falls off upward, so the walls fade out. */
const ANNOTATION_WALL_BANDS = 12
const ANNOTATION_WALL_HEIGHT_M = 320
const ANNOTATION_WALL_WIDTH_M = 6
const ANNOTATION_WALL_OPACITY = 0.7
/** Opacity kept by disks outside the annotated areas. */
const ANNOTATION_DISK_FADE = 0.4
/** Marker annotations fade the unmarked junction disks further, so the marked ones read at a glance. */
const MARKER_DISK_FADE = 0.22
/** Zoom backed off from the fit around the marked schools and junctions. */
const MARKERS_ZOOM_OUT = 0.2
/** Half the school marker's ground shadow, so the shadow's centre sits on the school. */
const MARKER_SHADOW_HALF_PX = 2
/** Closest a marker tooltip gets to the map's left or right edge. */
const MARKER_TIP_EDGE_PX = 12
/** Added to the map padding when framing annotated areas; the top leaves room for tall columns and pins. */
/** Tall columns reach above the camera, so pins sit on the column no higher than this. */
const ANNOTATION_PIN_MAX_ALTITUDE_M = 500
const ANNOTATION_FIT_PADDING = { top: 300, right: 90, bottom: 90, left: 70 }
/** Markers sink the columns, so they need less headroom, but the right side clears the map data panel. */
const MARKERS_FIT_PADDING = { top: 140, right: 220, bottom: 110, left: 70 }
/** Gap between the tallest annotated column's top and the action card. */
const ACTION_CLEARANCE_PX = 36
/** The action card never rises closer than this to the top of the map. */
const ACTION_TOP_MARGIN_PX = 96
/** Zoom backed off from the area fit, so the columns and the action card above them both fit. */
const ACTION_ZOOM_OUT = 0.45
const ACTION_MIN_STEM_PX = 80
/** Mapbox's default tilt limit, restored when a 2D basemap goes back to 3D. */
const MAX_PITCH_3D = 85
const DIMENSION_EASE_MS = 600
/** Columns on a 2D basemap keep this much height, so their coloured footprints still draw. */
const FLAT_COLUMN_M = 2
/** Zoom levels backed off from the tight fit, so the areas keep some surrounding context. */
const ANNOTATION_ZOOM_OUT = 0.6

export type StoryMapLayerVisibility = {
  junctions: boolean
  distribution: boolean
}

export type StoryMapHandle = {
  /** Map coordinate under a viewport point, as `[lng, lat]`. */
  unproject: (clientX: number, clientY: number) => [number, number]
  /** Thumbnail of the visible (unpadded) map area plus the camera that produced it. */
  capture: () => Promise<StoryMapCapture>
  /** Completes the line, arrow or polygon being drawn, if it has enough points. */
  finishDrawing: () => void
  /** Removes the last point of the shape being drawn. */
  undoDrawing: () => void
}

export type StoryMapAnnotationLayer = {
  items: MapAnnotationItem[]
  validity: Record<string, AnnotationValidity>
  selectedId: string | null
  /** Click selection is only on while the story is edited. */
  onSelect?: (id: string | null) => void
  /** A tool here puts the map in drawing mode until the shape is completed or cancelled. */
  drawing: AnnotationTool | null
  onDrawn?: (shape: DrawnShape) => void
  onDrawProgress?: (points: number) => void
  onDrawCancel?: () => void
  /** An annotation whose anchor points can be dragged; leave it out of `items` while it is edited. */
  editing?: MapAnnotationItem | null
  onEdited?: (shape: DrawnShape) => void
}

const NO_VALIDITY: Record<string, AnnotationValidity> = {}

const CAPTURE_WIDTH = 560
const CAPTURE_ASPECT = 2.2

function captureMapView(map: mapboxgl.Map): StoryMapCapture {
  const canvas = map.getCanvas()
  const ratio = canvas.width / Math.max(1, canvas.clientWidth)
  const { top: padTop = 0, right: padRight = 0, bottom: padBottom = 0, left: padLeft = 0 } = map.getPadding()
  const left = padLeft * ratio
  const width = Math.max(1, canvas.width - left - padRight * ratio)
  const height = Math.min(canvas.height, width / CAPTURE_ASPECT)
  const centerY = ((padTop + (canvas.clientHeight - padBottom)) / 2) * ratio
  const top = Math.max(0, Math.min(canvas.height - height, centerY - height / 2))
  const out = document.createElement('canvas')
  out.width = CAPTURE_WIDTH
  out.height = Math.round(CAPTURE_WIDTH / CAPTURE_ASPECT)
  out.getContext('2d')?.drawImage(canvas, left, top, width, height, 0, 0, out.width, out.height)
  const center = map.getCenter()
  return {
    image: out.toDataURL('image/jpeg', 0.74),
    camera: {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    },
  }
}

export type StoryMapProps = {
  className?: string
  controlsClassName?: string
  layers?: StoryMapLayerVisibility
  /** Index of the demo scene (camera, columns, disks) to show. */
  sceneIndex?: number
  /** Position (0…1) within the slide's time-series loop. */
  framePhase?: number
  /** Tween length for frame changes; linear keeps continuous playback smooth. */
  frameDuration?: number
  frameLinear?: boolean
  styleUrl?: string
  /** 2D basemap: the camera looks straight down and can't be tilted. */
  flat?: boolean
  /** Turn off for previews; also hides the zoom controls. */
  interactive?: boolean
  /** Applied once when the map mounts. */
  cameraPadding?: mapboxgl.PaddingOptions
  /** Added to each scene's zoom so small previews frame the same area. */
  zoomOffset?: number
  /**
   * For a map taller than its clipping parent (anchored to the parent's top): pads the
   * hidden bottom so the camera stays centered in the visible part without resizing.
   */
  fitParentHeight?: boolean
  /** Shares the camera with the other maps on the same link. */
  cameraLink?: StoryCameraLink
  /** Off for maps that take their camera from a link instead of their own scene. */
  flyToScene?: boolean
  /** Focus region whose columns and disks grow in while the main overlay sinks away. */
  region?: StoryMapRegion | null
  /** Rescales the columns and disks inside a selected map area. */
  areaEffect?: StoryAreaEffect | null
  /** A new object flies the camera to `camera` (raw zoom, no offset applied). */
  cameraRequest?: { camera: StorySceneCamera } | null
  /** Highlighted columns, outlined areas and per-column tooltips, anchored to the map. */
  annotation?: StoryMapAnnotation | null
  /** Markup the author draws on the map; it never changes the data layers underneath. */
  annotations?: StoryMapAnnotationLayer | null
  onHandle?: (handle: StoryMapHandle | null) => void
}

const DEFAULT_LAYERS: StoryMapLayerVisibility = {
  junctions: true,
  distribution: true,
}

const JUNCTION_LAYERS = [
  'story-junctions-halo',
  'story-junctions',
  'story-region-junctions-halo',
  'story-region-junctions',
]
const COLUMN_LAYERS = ['story-columns', 'story-region-columns']
const COLUMN_RADIUS_M = 36

function ring(lng: number, lat: number, radiusMeters: number, sides: number) {
  const dLat = radiusMeters / 111320
  const dLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  const coords: [number, number][] = []
  for (let i = 0; i <= sides; i += 1) {
    const t = (i / sides) * Math.PI * 2
    coords.push([lng + Math.cos(t) * dLng, lat + Math.sin(t) * dLat])
  }
  return { type: 'Polygon' as const, coordinates: [coords] }
}

type DemoFeature = {
  type: 'Feature'
  properties: Record<string, number | string>
  geometry: ReturnType<typeof ring> | { type: 'Point'; coordinates: [number, number] }
}

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at the demo latitude. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24.47 * Math.PI) / 180)

/** Circle radius expression that keeps each disk at `radius × scale` meters on the ground. */
function metersToPixels(scale: number): mapboxgl.ExpressionSpecification {
  const base = ['/', ['*', ['get', 'radius'], scale], METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const COLUMN_GEOMETRY = DEMO_COLUMNS.map(([lng, lat]) => ring(lng, lat, COLUMN_RADIUS_M, 14))

type ColumnGeometry = ReturnType<typeof ring>

type FeatureScales = {
  columns: number[]
  junctions: number[]
  regionColumns: number[]
  regionJunctions: number[]
}

type FrameAnnotation = {
  value: StoryMapAnnotation
  rgb: [number, number, number]
  /** Column index → rank. */
  ranks: Map<number, number>
  junctionInside: boolean[]
  /** 0…1 fade-in of the highlight colours and area outlines. */
  mix: number
  /** Column index → its tooltip marker. */
  pins: Map<number, mapboxgl.Marker>
  labels: mapboxgl.Marker[]
  action: ActionPin | null
}

/** The recommended-action card, floated above the annotated columns on a stem sized each frame. */
type ActionPin = {
  card: HTMLElement
  stem: HTMLElement
  at: [number, number]
  /** Column index → its current drawn height, metres. */
  heights: Map<number, number>
}

/** Everything one overlay draw needs; tweens update fields and redraw. */
type StoryFrame = {
  state: StorySceneState
  ramp: [number, string][]
  scales: FeatureScales
  region: StoryMapRegion | null
  regionGeometry: ColumnGeometry[]
  phase: number
  area: [number, number][] | null
  annotation: FrameAnnotation | null
  /** 1 draws columns, pins and walls at full height; 0 lays them flat for a 2D basemap. */
  lift: number
}

const SCALE_KEYS = ['columns', 'junctions', 'regionColumns', 'regionJunctions'] as const

const filled = (length: number, value: number) => Array.from({ length }, () => value)

function hash01(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function featureCollection(features: DemoFeature[]) {
  return { type: 'FeatureCollection' as const, features }
}

function columnFeatures(
  geometry: ColumnGeometry[],
  heights: number[],
  scales: number[],
  color: (index: number, height: number, scale: number) => [number, number, number],
  rank?: (index: number) => number | undefined,
  lift = 1,
) {
  const features: DemoFeature[] = []
  geometry.forEach((ring, index) => {
    const scale = scales[index] ?? 1
    const height = (heights[index] ?? 0) * scale
    if (height < 1) return
    const properties: DemoFeature['properties'] = {
      height: lift === 1 ? height : FLAT_COLUMN_M + (height - FLAT_COLUMN_M) * lift,
      color: rgbString(color(index, height, scale)),
    }
    const featureRank = rank?.(index)
    if (featureRank !== undefined) properties.rank = featureRank
    features.push({ type: 'Feature', properties, geometry: ring })
  })
  return featureCollection(features)
}

function junctionFeatures(
  points: [number, number, number][],
  radii: number[],
  scales: number[],
  fade: (index: number) => number = () => 1,
) {
  const features: DemoFeature[] = []
  points.forEach(([lng, lat], index) => {
    const radius = (radii[index] ?? 0) * (scales[index] ?? 1)
    if (radius < 0.5) return
    features.push({
      type: 'Feature',
      properties: { radius, fade: fade(index) },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  })
  return featureCollection(features)
}

function annotationAreaData(annotation: FrameAnnotation | null) {
  return featureCollection(
    (annotation?.value.areas ?? []).map((area) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [[...area.polygon, area.polygon[0]]] },
    })),
  )
}

function drawAnnotationArea(map: mapboxgl.Map, annotation: FrameAnnotation | null, lift: number) {
  if (!map.getLayer('story-annotation-fill')) return
  const mix = annotation?.mix ?? 0
  const color = annotation?.value.color ?? '#ffffff'
  const walled = Boolean(annotation?.value.location)
  map.setPaintProperty('story-annotation-fill', 'fill-color', color)
  map.setPaintProperty('story-annotation-fill', 'fill-opacity', (walled ? 0.16 : 0.12) * mix)
  map.setPaintProperty('story-annotation-glow', 'line-color', color)
  map.setPaintProperty('story-annotation-glow', 'line-opacity', (walled ? 0.5 : 0.32) * mix)
  map.setPaintProperty('story-annotation-line', 'line-color', color)
  map.setPaintProperty('story-annotation-line', 'line-opacity', (walled ? 1 - lift : 1) * 0.95 * mix)
  for (let band = 0; band < ANNOTATION_WALL_BANDS; band += 1) {
    const id = `story-annotation-wall-${band}`
    const falloff = (1 - band / ANNOTATION_WALL_BANDS) ** 1.6
    map.setPaintProperty(id, 'fill-extrusion-color', color)
    map.setPaintProperty(id, 'fill-extrusion-opacity', walled ? ANNOTATION_WALL_OPACITY * falloff * mix * lift : 0)
  }
}

function addAnnotationWalls(map: mapboxgl.Map) {
  const step = ANNOTATION_WALL_HEIGHT_M / ANNOTATION_WALL_BANDS
  for (let band = 0; band < ANNOTATION_WALL_BANDS; band += 1) {
    map.addLayer({
      id: `story-annotation-wall-${band}`,
      type: 'fill-extrusion',
      source: 'story-annotation',
      paint: {
        'fill-extrusion-line-width': ANNOTATION_WALL_WIDTH_M,
        'fill-extrusion-base': band * step,
        'fill-extrusion-height': (band + 1) * step,
        'fill-extrusion-opacity': 0,
        'fill-extrusion-opacity-transition': { duration: 0 },
        'fill-extrusion-vertical-gradient': false,
        'fill-extrusion-emissive-strength': 1,
        'fill-extrusion-cast-shadows': false,
      },
    })
  }
}

/** A picked area keeps only its top 10 columns: the rest sink as the annotation fades in. Markers sink them all. */
function notedScales(note: FrameAnnotation | null, scales: number[]) {
  if (!note || note.mix <= 0) return scales
  if (note.value.style === 'markers') return scales.map((scale) => scale * (1 - note.mix))
  if (!note.value.location) return scales
  return scales.map((scale, index) => (note.ranks.has(index) ? scale : scale * (1 - note.mix)))
}

function areaData(polygon: [number, number][] | null) {
  if (!polygon || polygon.length < 3) return featureCollection([])
  return featureCollection([
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...polygon, polygon[0]]] },
    },
  ])
}

function setSourceData(map: mapboxgl.Map, id: string, data: ReturnType<typeof featureCollection>) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data)
}

function notedColor(note: FrameAnnotation | null, index: number, base: [number, number, number]) {
  if (!note || note.mix <= 0) return base
  return note.ranks.has(index)
    ? mixRgb(base, note.rgb, note.mix)
    : mixRgb(base, ANNOTATION_DIM_RGB, ANNOTATION_DIM * note.mix)
}

function notedFade(note: FrameAnnotation | null, index: number) {
  if (!note || note.mix <= 0 || note.junctionInside[index]) return 1
  const floor = note.value.style === 'markers' ? MARKER_DISK_FADE : ANNOTATION_DISK_FADE
  return 1 - (1 - floor) * note.mix
}

function drawStory(map: mapboxgl.Map, frame: StoryFrame) {
  const { state, ramp, scales, region, annotation: note, lift } = frame
  const mainNote = note?.value.layer === 'main' ? note : null
  const regionNote = note?.value.layer === 'region' ? note : null
  setSourceData(
    map,
    'story-columns',
    columnFeatures(
      COLUMN_GEOMETRY,
      state.heights,
      notedScales(mainNote, scales.columns),
      (index, height, scale) =>
        notedColor(mainNote, index, scale === 1 ? state.columnColors[index] : rampColor(ramp, height)),
      (index) => mainNote?.ranks.get(index),
      lift,
    ),
  )
  setSourceData(
    map,
    'story-junctions',
    junctionFeatures(DEMO_JUNCTIONS, state.radii, scales.junctions, (index) => notedFade(mainNote, index)),
  )
  mainNote?.pins.forEach((marker, index) => {
    const height = (state.heights[index] ?? 0) * (scales.columns[index] ?? 1) * lift
    marker.setAltitude(Math.min(ANNOTATION_PIN_MAX_ALTITUDE_M, height))
    mainNote.action?.heights.set(index, height)
  })
  if (region) {
    const regionRamp = region.columnRamp
    const regionHeights = regionColumnHeights(region, frame.phase)
    setSourceData(
      map,
      'story-region-columns',
      columnFeatures(
        frame.regionGeometry,
        regionHeights,
        notedScales(regionNote, scales.regionColumns),
        (index, h) => notedColor(regionNote, index, rampColor(regionRamp, h)),
        (index) => regionNote?.ranks.get(index),
        lift,
      ),
    )
    setSourceData(
      map,
      'story-region-junctions',
      junctionFeatures(region.junctions, regionJunctionRadii(region, frame.phase), scales.regionJunctions, (index) =>
        notedFade(regionNote, index),
      ),
    )
    regionNote?.pins.forEach((marker, index) => {
      const height = (regionHeights[index] ?? 0) * (scales.regionColumns[index] ?? 0) * lift
      marker.setAltitude(Math.min(ANNOTATION_PIN_MAX_ALTITUDE_M, height))
      regionNote.action?.heights.set(index, height)
    })
  }
  placeActionPin(map, note)
  if (map.getLayer('story-junctions')) {
    const core = rgbString(state.diskCore)
    const halo = rgbString(state.diskHalo)
    map.setPaintProperty('story-junctions', 'circle-color', core)
    map.setPaintProperty('story-junctions-halo', 'circle-color', halo)
    map.setPaintProperty('story-region-junctions', 'circle-color', core)
    map.setPaintProperty('story-region-junctions-halo', 'circle-color', halo)
  }
}

function addJunctionLayers(map: mapboxgl.Map, id: string, state: StorySceneState) {
  map.addLayer({
    id: `${id}-halo`,
    type: 'circle',
    source: id,
    paint: {
      'circle-radius': metersToPixels(1.7),
      'circle-color': rgbString(state.diskHalo),
      'circle-opacity': ['*', 0.22, ['coalesce', ['get', 'fade'], 1]],
      'circle-blur': 1,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-color-transition': { duration: 0 },
    },
  })

  map.addLayer({
    id,
    type: 'circle',
    source: id,
    paint: {
      'circle-radius': metersToPixels(1),
      'circle-color': rgbString(state.diskCore),
      'circle-opacity': ['*', 0.36, ['coalesce', ['get', 'fade'], 1]],
      'circle-blur': 0.55,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-color-transition': { duration: 0 },
    },
  })
}

function addColumnLayer(map: mapboxgl.Map, id: string) {
  map.addLayer({
    id,
    type: 'fill-extrusion',
    source: id,
    paint: {
      'fill-extrusion-color': ['to-color', ['get', 'color']],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
}

function mountStoryLayers(map: mapboxgl.Map, frame: StoryFrame) {
  map.resize()
  if (map.getSource('story-columns')) return

  const empty = featureCollection([])
  for (const id of [
    'story-area',
    'story-annotation',
    'story-junctions',
    'story-region-junctions',
    'story-columns',
    'story-region-columns',
  ]) {
    map.addSource(id, { type: 'geojson', data: empty })
  }

  map.addLayer({
    id: 'story-area',
    type: 'fill',
    source: 'story-area',
    paint: { 'fill-color': '#70aeff', 'fill-opacity': 0.1 },
  })
  map.addLayer({
    id: 'story-area-line',
    type: 'line',
    source: 'story-area',
    paint: { 'line-color': '#70aeff', 'line-width': 1.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 },
  })
  map.addLayer({
    id: 'story-annotation-fill',
    type: 'fill',
    source: 'story-annotation',
    paint: { 'fill-opacity': 0, 'fill-opacity-transition': { duration: 0 } },
  })
  map.addLayer({
    id: 'story-annotation-glow',
    type: 'line',
    source: 'story-annotation',
    layout: { 'line-join': 'round' },
    paint: { 'line-width': 7, 'line-blur': 5, 'line-opacity': 0, 'line-opacity-transition': { duration: 0 } },
  })
  map.addLayer({
    id: 'story-annotation-line',
    type: 'line',
    source: 'story-annotation',
    layout: { 'line-join': 'round' },
    paint: { 'line-width': 1.6, 'line-opacity': 0, 'line-opacity-transition': { duration: 0 } },
  })
  addJunctionLayers(map, 'story-junctions', frame.state)
  addJunctionLayers(map, 'story-region-junctions', frame.state)
  addColumnLayer(map, 'story-columns')
  addColumnLayer(map, 'story-region-columns')
  addAnnotationWalls(map)

  setSourceData(map, 'story-area', areaData(frame.area))
  setSourceData(map, 'story-annotation', annotationAreaData(frame.annotation))
  drawAnnotationArea(map, frame.annotation, frame.lift)
  drawStory(map, frame)
}

function element(tag: string, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function schoolPin(school: AnnotatedSchool, color: string, metric: StoryMapAnnotation['metric']) {
  const pin = element('div', styles.annotationPin)
  pin.style.setProperty('--annotation-color', color)
  pin.style.setProperty('--annotation-delay', `${380 + school.rank * 70}ms`)
  pin.dataset.rank = String(school.rank)
  const badge = element('span', styles.annotationBadge, String(school.rank))
  const stem = element('span', styles.annotationStem)
  const tip = element('div', styles.annotationTip)
  const head = element('div', styles.annotationTipHead)
  head.append(element('span', styles.annotationTipRank, `#${school.rank}`), element('b', '', school.name))
  const meta = element('p', styles.annotationTipMeta, `${school.district} · ${school.type} · ${school.level}`)
  const stats = element('dl', styles.annotationTipStats)
  const measures =
    metric === 'emissions'
      ? [
          ['PM2.5 (2-month avg)', `${school.pm25} µg/m³`],
          ['Nearest factory', `${school.factoryKm} km`],
        ]
      : [['Peak traffic (500 m)', `${school.peak.toLocaleString('en-US')} veh/h`]]
  for (const [label, value] of [
    ...measures,
    ['vs previous 2 months', `+${school.change}%`],
    ['Students', school.students.toLocaleString('en-US')],
  ]) {
    const row = element('div', '')
    row.append(element('dt', '', label), element('dd', '', value))
    stats.append(row)
  }
  tip.append(head, meta, stats, element('p', styles.annotationTipFoot, 'Last 2 months · AI annotation'))
  pin.append(tip, badge, stem)
  return pin
}

const SCHOOL_SVG =
  '<svg viewBox="0 0 256 256" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M176,207.24a119,119,0,0,0,16-7.73V240a8,8,0,0,1-16,0Zm11.76-88.43-56-29.87a8,8,0,0,0-7.52,14.12L171,128l17-9.06Zm64-29.87-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V130.67L171,128l-43,22.93L43.83,106l0,0L25,96,128,41.07,231,96l-18.78,10-.06,0L188,118.94a8,8,0,0,1,4,6.93v73.64a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12Z"/></svg>'
const JUNCTION_SVG =
  '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><rect x="4" y="0.5" width="8" height="15" rx="2.5" fill="currentColor"/><circle cx="8" cy="4" r="1.6" fill="#1a0b0b"/><circle cx="8" cy="8" r="1.6" fill="#1a0b0b"/><circle cx="8" cy="12" r="1.6" fill="#1a0b0b"/></svg>'

/** Hover card shared by the school and junction markers, ending with the annotation's data context. */
function markerTip(tag: string, name: string, meta: string, rows: [string, string][], anchor: string, extra?: HTMLElement) {
  const tip = element('div', styles.annotationTip)
  const head = element('div', styles.annotationTipHead)
  head.append(element('span', styles.annotationTipRank, tag), element('b', '', name))
  const stats = element('dl', styles.annotationTipStats)
  for (const [label, value] of rows) {
    const row = element('div', '')
    row.append(element('dt', '', label), element('dd', '', value))
    stats.append(row)
  }
  const context = element('div', styles.markerContext)
  const validity = element('span', styles.markerValid, 'Valid')
  context.append(validity, element('span', '', `Anchored to this ${anchor} · Traffic volume ${MARKERS_PERIOD}`))
  tip.append(head, element('p', styles.annotationTipMeta, meta), stats, ...(extra ? [extra] : []), context)
  return tip
}

function schoolMarker(school: AnnotatedSchool, junctions: AnnotatedJunction[]) {
  const root = element('div', `${styles.marker} ${styles.markerSchool}`)
  root.style.setProperty('--annotation-delay', `${380 + school.rank * 70}ms`)
  root.dataset.school = String(school.rank)
  const pin = element('span', styles.markerPin)
  const badge = element('span', styles.markerPinBadge)
  badge.innerHTML = SCHOOL_SVG
  badge.append(element('b', '', String(school.rank)))
  pin.append(badge)
  const busiest = junctions.reduce<AnnotatedJunction | null>((best, item) => (!best || item.peak > best.peak ? item : best), null)
  const list = element('ul', styles.markerJunctionList)
  for (const junction of junctions) {
    const item = element('li', '')
    item.append(element('span', '', `${junction.id} · ${junction.name}`), element('b', '', `${junction.load}%`))
    list.append(item)
  }
  const tip = markerTip(
    `#${school.rank}`,
    school.name,
    `${school.district} · ${school.type} · ${school.level}`,
    [
      ['Busiest junction nearby', busiest ? `${busiest.peak.toLocaleString('en-US')} veh/h` : '—'],
      ['Marked junctions (800 m)', String(junctions.length)],
      ['Students', school.students.toLocaleString('en-US')],
    ],
    'school',
    junctions.length > 0 ? list : undefined,
  )
  root.append(tip, pin, element('span', styles.markerShadow))
  return root
}

function junctionMarker(junction: AnnotatedJunction, school: AnnotatedSchool | undefined) {
  const root = element('div', `${styles.marker} ${styles.markerJunction}`)
  root.style.setProperty('--annotation-delay', `${900 + junction.school * 70}ms`)
  root.dataset.school = String(junction.school)
  const dot = element('span', styles.markerJunctionDot)
  dot.innerHTML = JUNCTION_SVG
  const tip = markerTip(
    junction.id,
    junction.name,
    `${junction.district} · ${junction.distanceM} m from ${school?.name ?? 'the school'}`,
    [
      ['Peak traffic', `${junction.peak.toLocaleString('en-US')} veh/h`],
      ['Peak load', `${junction.load}% of capacity`],
      ['Over capacity', `${junction.congestedHours} h/day`],
    ],
    'junction',
  )
  root.append(tip, dot)
  return root
}

/** Hovering a school lights up its junctions, and hovering a junction lights up its school. */
/** Slides a marker's tooltip sideways so it stays inside the map near the edges. */
function keepTipInMap(node: HTMLElement) {
  const tip = node.querySelector<HTMLElement>(`.${styles.annotationTip}`)
  const frame = node.closest('.mapboxgl-map')?.getBoundingClientRect()
  if (!tip || !frame) return
  const rect = node.getBoundingClientRect()
  const center = rect.left + rect.width / 2
  const half = tip.offsetWidth / 2
  const shift =
    Math.max(0, frame.left + MARKER_TIP_EDGE_PX - (center - half)) -
    Math.max(0, center + half - (frame.right - MARKER_TIP_EDGE_PX))
  node.style.setProperty('--marker-tip-shift', `${shift}px`)
}

function linkMarkers(nodes: HTMLElement[]) {
  for (const node of nodes) {
    const related = () => nodes.filter((other) => other !== node && other.dataset.school === node.dataset.school)
    node.addEventListener('mouseenter', () => {
      keepTipInMap(node)
      related().forEach((other) => other.classList.add(styles.markerLinked))
    })
    node.addEventListener('mouseleave', () => related().forEach((other) => other.classList.remove(styles.markerLinked)))
  }
}

function addMarkerAnnotation(map: mapboxgl.Map, value: StoryMapAnnotation) {
  const markers = [
    ...value.junctions.map((junction) =>
      new mapboxgl.Marker({
        element: junctionMarker(junction, value.schools.find((school) => school.rank === junction.school)),
        anchor: 'center',
      }).setLngLat(junction.coordinates),
    ),
    ...value.schools.map((school) =>
      new mapboxgl.Marker({
        element: schoolMarker(
          school,
          value.junctions.filter((junction) => junction.school === school.rank),
        ),
        anchor: 'bottom',
        offset: [0, MARKER_SHADOW_HALF_PX],
      }).setLngLat(school.coordinates),
    ),
  ]
  linkMarkers(markers.map((marker) => marker.getElement()))
  for (const marker of markers) marker.addTo(map)
  return { pins: new Map<number, mapboxgl.Marker>(), labels: markers, action: null }
}

function areaLabel(text: string, color: string) {
  const marker = element('div', styles.annotationAreaMarker)
  marker.style.setProperty('--annotation-color', color)
  marker.append(element('span', styles.annotationArea, text))
  return marker
}

const SPARKLE_SVG =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 0.5 9.7 6.3 15.5 8 9.7 9.7 8 15.5 6.3 9.7 0.5 8 6.3 6.3Z"/></svg>'

function actionCard(action: AnnotationAction) {
  const marker = element('div', styles.annotationActionMarker)
  const card = element('div', styles.annotationAction)
  const badge = element('span', styles.annotationActionBadge)
  badge.innerHTML = SPARKLE_SVG
  badge.append('Recommended Action')
  card.append(badge, element('p', styles.annotationActionText, action.text))
  const stem = element('span', styles.annotationActionStem)
  marker.append(card, stem)
  return { marker, card, stem }
}

/** Sizes the stem so the card clears the tallest annotated column, while keeping the card on screen. */
function placeActionPin(map: mapboxgl.Map, note: FrameAnnotation | null) {
  const pin = note?.action
  if (!pin) return
  const ground = map.project(pin.at)
  let top = ground.y
  for (const school of note.value.schools) {
    top = Math.min(top, map.project(school.coordinates, pin.heights.get(school.column) ?? 0).y)
  }
  const room = ground.y - pin.card.offsetHeight - ACTION_TOP_MARGIN_PX
  const stem = Math.max(ACTION_MIN_STEM_PX, Math.min(ground.y - top + ACTION_CLEARANCE_PX, room))
  pin.stem.style.height = `${Math.round(stem)}px`
}

function addAnnotationMarkers(map: mapboxgl.Map, value: StoryMapAnnotation) {
  if (value.style === 'markers') return addMarkerAnnotation(map, value)
  const pins = new Map<number, mapboxgl.Marker>()
  for (const school of value.schools) {
    const marker = new mapboxgl.Marker({ element: schoolPin(school, value.color, value.metric), anchor: 'bottom' })
      .setLngLat(school.coordinates)
      .addTo(map)
    pins.set(school.column, marker)
  }
  const labels = value.areas.map((area) =>
    new mapboxgl.Marker({ element: areaLabel(area.label, value.color), anchor: 'bottom', offset: [0, -6] })
      .setLngLat(area.anchor)
      .addTo(map),
  )
  let action: ActionPin | null = null
  if (value.action) {
    const { marker, card, stem } = actionCard(value.action)
    labels.push(
      new mapboxgl.Marker({ element: marker, anchor: 'bottom' })
        .setLngLat(value.action.at)
        .addTo(map),
    )
    action = { card, stem, at: value.action.at, heights: new Map() }
  }
  return { pins, labels, action }
}

function removeAnnotationMarkers(annotation: FrameAnnotation) {
  for (const marker of [...annotation.pins.values(), ...annotation.labels]) {
    const node = marker.getElement()
    node.classList.add(styles.annotationLeaving)
    window.setTimeout(() => marker.remove(), 260)
  }
  annotation.pins.clear()
  annotation.labels = []
}

function setLayerVisibility(map: mapboxgl.Map, id: string, visible: boolean) {
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

function syncDemoLayers(map: mapboxgl.Map, layers: StoryMapLayerVisibility) {
  for (const id of JUNCTION_LAYERS) setLayerVisibility(map, id, layers.junctions)
  for (const id of COLUMN_LAYERS) setLayerVisibility(map, id, layers.distribution)
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easeOutBack(t: number) {
  const c1 = 1.4
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function targetScales(region: StoryMapRegion | null, regionActive: boolean, effect: StoryAreaEffect | null): FeatureScales {
  const main = regionActive ? 0 : 1
  return {
    columns: DEMO_COLUMNS.map((_, index) => main * (effect?.columns[index] ?? 1)),
    junctions: DEMO_JUNCTIONS.map((_, index) => main * (effect?.junctions[index] ?? 1)),
    regionColumns: (region?.columns ?? []).map((_, index) =>
      regionActive ? (effect?.regionColumns[index] ?? 1) : 0,
    ),
    regionJunctions: (region?.junctions ?? []).map((_, index) =>
      regionActive ? (effect?.regionJunctions[index] ?? 1) : 0,
    ),
  }
}

/** Start offsets (0…1 of the tween) so features move in a wave rather than all at once. */
function scaleDelays(
  scales: FeatureScales,
  region: StoryMapRegion | null,
  mode: 'tween' | 'grow' | 'restore',
  sceneCenter: [number, number],
): FeatureScales {
  const jitter = (length: number, seed: number, spread: number) =>
    Array.from({ length }, (_, index) => spread * hash01(index, seed))
  const spread = (points: [number, number, number][], center: [number, number], seed: number, offset: number) => {
    const distances = points.map(([lng, lat]) => Math.hypot(lng - center[0], lat - center[1]))
    const max = Math.max(1e-6, ...distances)
    return distances.map((distance, index) => offset + 0.4 * (distance / max) + 0.06 * hash01(index, seed))
  }
  if (mode === 'restore') {
    return {
      columns: spread(DEMO_COLUMNS, sceneCenter, 89, 0.3),
      junctions: spread(DEMO_JUNCTIONS, sceneCenter, 90, 0.24),
      regionColumns: jitter(scales.regionColumns.length, 91, 0.12),
      regionJunctions: jitter(scales.regionJunctions.length, 92, 0.12),
    }
  }
  if (mode === 'tween' || !region) {
    return {
      columns: jitter(scales.columns.length, 81, 0.3),
      junctions: jitter(scales.junctions.length, 82, 0.3),
      regionColumns: jitter(scales.regionColumns.length, 83, 0.3),
      regionJunctions: jitter(scales.regionJunctions.length, 84, 0.3),
    }
  }
  return {
    columns: jitter(scales.columns.length, 85, 0.15),
    junctions: jitter(scales.junctions.length, 86, 0.15),
    regionColumns: spread(region.columns, region.camera.center, 87, 0.26),
    regionJunctions: spread(region.junctions, region.camera.center, 88, 0.2),
  }
}

/** Full Mapbox story canvas. */
export function StoryMap({
  className,
  controlsClassName,
  layers = DEFAULT_LAYERS,
  sceneIndex = 0,
  framePhase = 0,
  frameDuration = 500,
  frameLinear = false,
  styleUrl = STORY_MAP_STYLE,
  flat = false,
  interactive = true,
  cameraPadding = CAMERA_PADDING,
  zoomOffset = 0,
  fitParentHeight = false,
  cameraLink,
  flyToScene = true,
  region = null,
  areaEffect = null,
  cameraRequest = null,
  annotation = null,
  annotations = null,
  onHandle,
}: StoryMapProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const handleRef = useRef<InteractiveMapHandle | null>(null)
  const [ready, setReady] = useState(false)
  const appliedStyleRef = useRef(styleUrl)
  const layersRef = useRef(layers)
  const sceneIndexRef = useRef(sceneIndex)
  const appliedSceneRef = useRef(sceneIndex)
  const appliedPhaseRef = useRef(framePhase)
  const frameRef = useRef<StoryFrame>({
    state: sceneState(sceneAtPhase(storySceneAt(sceneIndex), framePhase)),
    ramp: storySceneAt(sceneIndex).columnRamp,
    scales: targetScales(null, false, null),
    region: null,
    regionGeometry: [],
    phase: framePhase,
    area: null,
    annotation: null,
    lift: flat ? 0 : 1,
  })
  const appliedRegionRef = useRef<StoryMapRegion | null>(null)
  const appliedEffectRef = useRef<StoryAreaEffect | null>(null)
  const tweenRef = useRef<number | null>(null)
  const scaleTweenRef = useRef<number | null>(null)
  const annotationTweenRef = useRef<number | null>(null)
  const liftTweenRef = useRef<number | null>(null)
  const mountOptionsRef = useRef({ interactive, cameraPadding, zoomOffset, fitParentHeight })
  const flatRef = useRef(flat)
  const pitchBeforeFlatRef = useRef<number | null>(null)
  const flyToSceneRef = useRef(flyToScene)
  const annotationsRef = useRef(annotations)
  const labelsRef = useRef<AnnotationLabels | null>(null)
  const drawingRef = useRef<AnnotationDrawing | null>(null)

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  useEffect(() => {
    flyToSceneRef.current = flyToScene
  }, [flyToScene])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    sceneIndexRef.current = sceneIndex
  }, [sceneIndex])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return

    const { camera } = storySceneAt(sceneIndexRef.current)
    const mountOptions = mountOptionsRef.current
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: styleUrl,
      center: camera.center,
      zoom: camera.zoom + mountOptions.zoomOffset,
      pitch: camera.pitch,
      bearing: camera.bearing,
      maxPitch: flatRef.current ? 0 : MAX_PITCH_3D,
      antialias: true,
      attributionControl: false,
      interactive: mountOptions.interactive,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    })
    map.setPadding(mountOptions.cameraPadding)
    mapRef.current = map
    const frame = frameRef.current

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    const root = rootRef.current
    const parent = root?.parentElement
    let parentObserver: ResizeObserver | null = null
    if (mountOptions.fitParentHeight && root && parent) {
      const { cameraPadding: padding } = mountOptions
      let hidden = -1
      parentObserver = new ResizeObserver(() => {
        const next = Math.max(0, Math.round(root.clientHeight - parent.clientHeight))
        if (next === hidden) return
        hidden = next
        map.setPadding({ ...padding, bottom: (padding.bottom ?? 0) + next })
      })
      parentObserver.observe(parent)
      parentObserver.observe(root)
    }

    map.on('load', () => {
      mountStoryLayers(map, frameRef.current)
      mountAnnotationLayers(map, frameRef.current.lift)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })
    labelsRef.current = new AnnotationLabels(map, () => annotationsRef.current?.onSelect)

    handleRef.current = {
      zoomIn: () => map.zoomIn({ duration: 280 }),
      zoomOut: () => map.zoomOut({ duration: 280 }),
      resetNorth: () => {
        const { pitch, bearing } = (appliedRegionRef.current ?? storySceneAt(sceneIndexRef.current)).camera
        map.easeTo({ bearing, pitch, duration: 420 })
      },
    }

    return () => {
      observer.disconnect()
      parentObserver?.disconnect()
      if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
      if (scaleTweenRef.current !== null) cancelAnimationFrame(scaleTweenRef.current)
      if (annotationTweenRef.current !== null) cancelAnimationFrame(annotationTweenRef.current)
      if (liftTweenRef.current !== null) cancelAnimationFrame(liftTweenRef.current)
      frame.annotation = null
      drawingRef.current?.destroy()
      drawingRef.current = null
      labelsRef.current?.destroy()
      labelsRef.current = null
      map.remove()
      mapRef.current = null
      handleRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !cameraLink) return
    const { zoomOffset: offset } = mountOptionsRef.current
    let following = false
    const read = (): StoryCamera => {
      const center = map.getCenter()
      return {
        center: [center.lng, center.lat],
        zoom: map.getZoom() - offset,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      }
    }
    const follow = (camera: StoryCamera) => {
      following = true
      map.jumpTo({ ...camera, zoom: camera.zoom + offset })
      following = false
    }
    const onMove = () => {
      if (!following) cameraLink.publish(follow, read())
    }
    const shared = cameraLink.join(follow)
    if (shared) follow(shared)
    else cameraLink.publish(follow, read())
    map.on('move', onMove)
    return () => {
      map.off('move', onMove)
      cameraLink.leave(follow)
    }
  }, [cameraLink])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    syncDemoLayers(map, layers)
  }, [layers, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const onMove = () => placeActionPin(map, frameRef.current.annotation)
    map.on('move', onMove)
    map.on('resize', onMove)
    return () => {
      map.off('move', onMove)
      map.off('resize', onMove)
    }
  }, [ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const sceneChanged = appliedSceneRef.current !== sceneIndex
    if (!sceneChanged && appliedPhaseRef.current === framePhase) return
    appliedSceneRef.current = sceneIndex
    appliedPhaseRef.current = framePhase

    const scene = storySceneAt(sceneIndex)
    if (sceneChanged && flyToSceneRef.current && !appliedRegionRef.current) {
      map.flyTo({
        ...scene.camera,
        zoom: scene.camera.zoom + mountOptionsRef.current.zoomOffset,
        duration: CAMERA_DURATION_MS,
        curve: 1.2,
        essential: true,
      })
    }

    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current)
    const frame = frameRef.current
    frame.ramp = scene.columnRamp
    const from = frame.state
    const to = sceneState(sceneAtPhase(scene, framePhase))
    const fromPhase = frame.phase
    const toPhase = framePhase - fromPhase < -0.5 ? framePhase + 1 : framePhase
    const duration = sceneChanged ? SCENE_TWEEN_MS : Math.max(1, frameDuration)
    const ease = !sceneChanged && frameLinear ? (t: number) => t : easeInOutCubic
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = ease(t)
      frame.state = mixSceneState(from, to, eased)
      frame.phase = (fromPhase + (toPhase - fromPhase) * eased) % 1
      drawStory(map, frame)
      tweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [sceneIndex, framePhase, frameDuration, frameLinear, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const regionChanged = appliedRegionRef.current !== region
    if (!regionChanged && appliedEffectRef.current === areaEffect) return
    appliedRegionRef.current = region
    appliedEffectRef.current = areaEffect

    const frame = frameRef.current
    const growing = Boolean(region && regionChanged)
    const restoring = Boolean(!region && regionChanged && frame.region)
    const sceneCamera = storySceneAt(sceneIndexRef.current).camera
    if (restoring) {
      window.setTimeout(() => {
        if (appliedRegionRef.current !== null || mapRef.current !== map) return
        map.flyTo({
          ...sceneCamera,
          zoom: sceneCamera.zoom + mountOptionsRef.current.zoomOffset,
          duration: REGION_FLY_MS,
          curve: 1.3,
          essential: true,
        })
      }, REGION_FLY_DELAY_MS)
    }
    if (region && regionChanged) {
      frame.region = region
      frame.regionGeometry = region.columns.map(([lng, lat]) =>
        ring(lng, lat, region.columnRadiusM ?? COLUMN_RADIUS_M, 14),
      )
      frame.scales = {
        ...frame.scales,
        regionColumns: filled(region.columns.length, 0),
        regionJunctions: filled(region.junctions.length, 0),
      }
      // Let a layout change from the same update (the agent rail opening) resize the map first.
      window.setTimeout(() => {
        if (appliedRegionRef.current !== region || mapRef.current !== map) return
        map.flyTo({
          ...region.camera,
          zoom: region.camera.zoom + mountOptionsRef.current.zoomOffset,
          duration: REGION_FLY_MS,
          curve: 1.3,
          essential: true,
        })
      }, REGION_FLY_DELAY_MS)
    }
    frame.area = areaEffect?.polygon ?? null
    setSourceData(map, 'story-area', areaData(frame.area))

    if (scaleTweenRef.current !== null) cancelAnimationFrame(scaleTweenRef.current)
    const from = frame.scales
    const to = targetScales(frame.region, region !== null, areaEffect)
    const delays = scaleDelays(to, frame.region, restoring ? 'restore' : growing ? 'grow' : 'tween', sceneCamera.center)
    const duration = growing || restoring ? REGION_GROW_MS : AREA_TWEEN_MS
    const span = growing || restoring ? 0.3 : 0.65
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = {} as FeatureScales
      for (const key of SCALE_KEYS) {
        next[key] = to[key].map((target, index) => {
          const origin = from[key][index] ?? 0
          const local = Math.max(0, Math.min(1, (t - delays[key][index]) / span))
          const eased = target > origin ? easeOutBack(local) : easeInOutCubic(local)
          return t >= 1 ? target : origin + (target - origin) * eased
        })
      }
      frame.scales = next
      if (t >= 1 && restoring) {
        frame.region = null
        frame.regionGeometry = []
        frame.scales = { ...next, regionColumns: [], regionJunctions: [] }
      }
      drawStory(map, frame)
      scaleTweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    scaleTweenRef.current = requestAnimationFrame(step)
  }, [region, areaEffect, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const frame = frameRef.current
    if ((frame.annotation?.value ?? null) === annotation) return

    if (annotationTweenRef.current !== null) cancelAnimationFrame(annotationTweenRef.current)
    const leaving = frame.annotation
    if (leaving) removeAnnotationMarkers(leaving)
    if (annotation) {
      const polygons = annotation.areas.map((area) => area.polygon)
      const regionCamera = annotation.layer === 'region' ? region?.camera : undefined
      const junctions = annotation.layer === 'region' ? (region?.junctions ?? []) : DEMO_JUNCTIONS
      const marked = new Set(annotation.junctions.map((junction) => junction.junction))
      frame.annotation = {
        value: annotation,
        rgb: hexToRgb(annotation.color),
        ranks: new Map(annotation.schools.map((school) => [school.column, school.rank])),
        junctionInside: junctions.map(
          ([lng, lat], index) => marked.has(index) || polygons.some((polygon) => pointInPolygon([lng, lat], polygon)),
        ),
        mix: 0,
        ...addAnnotationMarkers(map, annotation),
      }
      setSourceData(map, 'story-annotation', annotationAreaData(frame.annotation))
      const bounds = new mapboxgl.LngLatBounds()
      for (const polygon of polygons) for (const point of polygon) bounds.extend(point)
      for (const school of annotation.schools) bounds.extend(school.coordinates)
      for (const junction of annotation.junctions) bounds.extend(junction.coordinates)
      // Let the agent rail finish resizing the map before framing the areas.
      window.setTimeout(() => {
        if (frameRef.current.annotation?.value !== annotation || mapRef.current !== map) return
        const pitch = flatRef.current ? 0 : (regionCamera?.pitch ?? map.getPitch())
        const bearing = regionCamera?.bearing ?? map.getBearing()
        const padding = annotation.style === 'markers' ? MARKERS_FIT_PADDING : ANNOTATION_FIT_PADDING
        const fit = map.cameraForBounds(bounds, { padding, pitch, bearing })
        if (!fit?.center || fit.zoom === undefined) return
        map.flyTo({
          center: fit.center,
          zoom:
            fit.zoom -
            (annotation.action
              ? ACTION_ZOOM_OUT
              : annotation.location
                ? 0
                : annotation.style === 'markers'
                  ? MARKERS_ZOOM_OUT
                  : ANNOTATION_ZOOM_OUT),
          pitch,
          bearing,
          duration: CAMERA_DURATION_MS,
          curve: 1.2,
          essential: true,
        })
      }, REGION_FLY_DELAY_MS)
    } else if (leaving && !appliedRegionRef.current) {
      const { camera } = storySceneAt(sceneIndexRef.current)
      map.flyTo({
        ...camera,
        zoom: camera.zoom + mountOptionsRef.current.zoomOffset,
        duration: CAMERA_DURATION_MS,
        curve: 1.2,
        essential: true,
      })
    }

    const target = frame.annotation && frame.annotation.value === annotation ? frame.annotation : null
    const fading = target ? null : leaving
    const from = target ? 0 : (fading?.mix ?? 0)
    const duration = target ? ANNOTATION_IN_MS : ANNOTATION_OUT_MS
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const current = target ?? fading
      if (current) current.mix = target ? easeInOutCubic(t) : from * (1 - easeInOutCubic(t))
      if (t >= 1 && !target) frame.annotation = null
      drawAnnotationArea(map, frame.annotation, frame.lift)
      drawStory(map, frame)
      annotationTweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    annotationTweenRef.current = requestAnimationFrame(step)
  }, [annotation, ready, region])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !annotation) return
    let hovered: HTMLElement | null = null
    const setHovered = (next: HTMLElement | null) => {
      if (hovered === next) return
      hovered?.classList.remove(styles.annotationPinActive)
      next?.classList.add(styles.annotationPinActive)
      hovered = next
    }
    const onMove = (event: mapboxgl.MapLayerMouseEvent) => {
      const rank = event.features?.[0]?.properties?.rank
      const column = typeof rank === 'number' ? annotation.schools.find((school) => school.rank === rank)?.column : undefined
      const pin = column === undefined ? null : frameRef.current.annotation?.pins.get(column)?.getElement() ?? null
      map.getCanvas().style.cursor = pin ? 'pointer' : ''
      setHovered(pin)
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      setHovered(null)
    }
    const layer = annotation.layer === 'region' ? 'story-region-columns' : 'story-columns'
    map.on('mousemove', layer, onMove)
    map.on('mouseleave', layer, onLeave)
    return () => {
      map.off('mousemove', layer, onMove)
      map.off('mouseleave', layer, onLeave)
      onLeave()
    }
  }, [annotation, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !cameraRequest) return
    // Runs after the region/restore flight is queued so this camera wins.
    const timer = window.setTimeout(() => {
      map.flyTo({ ...cameraRequest.camera, duration: REGION_FLY_MS, curve: 1.3, essential: true })
    }, REGION_FLY_DELAY_MS + 20)
    return () => window.clearTimeout(timer)
  }, [cameraRequest, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !onHandle) return
    onHandle({
      unproject: (clientX, clientY) => {
        const rect = map.getCanvas().getBoundingClientRect()
        const point = map.unproject([clientX - rect.left, clientY - rect.top])
        return [point.lng, point.lat]
      },
      capture: () =>
        new Promise((resolve) => {
          map.once('render', () => {
            // The WebGL buffer is only readable inside the frame that drew it.
            resolve(captureMapView(map))
          })
          map.triggerRepaint()
        }),
      finishDrawing: () => drawingRef.current?.finish(),
      undoDrawing: () => drawingRef.current?.undo(),
    })
    return () => onHandle(null)
  }, [onHandle, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || appliedStyleRef.current === styleUrl) return
    appliedStyleRef.current = styleUrl
    setReady(false)
    map.once('style.load', () => {
      mountStoryLayers(map, frameRef.current)
      mountAnnotationLayers(map, frameRef.current.lift)
      syncDemoLayers(map, layersRef.current)
      setReady(true)
    })
    map.setStyle(styleUrl)
  }, [ready, styleUrl])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || flatRef.current === flat) return
    flatRef.current = flat
    if (flat) {
      pitchBeforeFlatRef.current = map.getPitch()
      map.easeTo({ pitch: 0, duration: DIMENSION_EASE_MS })
      map.once('moveend', () => {
        if (flatRef.current) map.setMaxPitch(0)
      })
      return
    }
    map.setMaxPitch(MAX_PITCH_3D)
    // Back to the tilt the author left (e.g. after drawing), or the slide's own tilt when the map started flat.
    const before = pitchBeforeFlatRef.current
    pitchBeforeFlatRef.current = null
    const pitch = before && before > 1 ? before : (appliedRegionRef.current ?? storySceneAt(sceneIndexRef.current)).camera.pitch
    map.easeTo({ pitch, duration: DIMENSION_EASE_MS })
  }, [flat, ready])

  const annotationItems = annotations?.items
  const annotationValidity = annotations?.validity ?? NO_VALIDITY
  const selectedAnnotationId = annotations?.selectedId ?? null
  const drawingTool = annotations?.drawing ?? null
  const editingId = annotations?.editing?.id ?? null
  const selectable = Boolean(annotations?.onSelect)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const items = annotationItems ?? []
    drawAnnotations(map, items, selectedAnnotationId, annotationValidity)
    labelsRef.current?.sync(items, selectedAnnotationId, annotationValidity, selectable)
  }, [annotationItems, annotationValidity, selectedAnnotationId, selectable, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectable || drawingTool || editingId) return
    const canvas = map.getCanvas()
    const onClick = (event: mapboxgl.MapMouseEvent) => annotationsRef.current?.onSelect?.(annotationAt(map, event.point))
    const onMove = (event: mapboxgl.MapMouseEvent) => {
      canvas.style.cursor = annotationAt(map, event.point) ? 'pointer' : ''
    }
    map.on('click', onClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMove)
      canvas.style.cursor = ''
    }
  }, [selectable, drawingTool, editingId, ready])

  useEffect(() => {
    const map = mapRef.current
    const item = annotationsRef.current?.editing
    if (!map || !ready || !editingId || !item || item.id !== editingId) return
    const { distribution, junctions } = layersRef.current
    const editing = startAnnotationEditing(map, item, {
      snapLayers: { columns: distribution, junctions },
      onChange: (shape) => annotationsRef.current?.onEdited?.(shape),
    })
    return () => editing.destroy()
  }, [editingId, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !drawingTool) return
    const { distribution, junctions } = layersRef.current
    const drawing = startAnnotationDrawing(map, drawingTool, {
      snapLayers: { columns: distribution, junctions },
      onProgress: (points) => annotationsRef.current?.onDrawProgress?.(points),
      onComplete: (shape) => {
        drawingRef.current = null
        annotationsRef.current?.onDrawn?.(shape)
      },
      onCancel: () => {
        drawingRef.current = null
        annotationsRef.current?.onDrawCancel?.()
      },
    })
    drawingRef.current = drawing
    return () => {
      drawing.destroy()
      if (drawingRef.current === drawing) drawingRef.current = null
    }
  }, [drawingTool, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const frame = frameRef.current
    const from = frame.lift
    const to = flat ? 0 : 1
    if (from === to) return
    if (liftTweenRef.current !== null) cancelAnimationFrame(liftTweenRef.current)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DIMENSION_EASE_MS)
      // Float error can dip a hair below 0, which Mapbox rejects as an opacity.
      frame.lift = Math.max(0, Math.min(1, from + (to - from) * easeInOutCubic(t)))
      drawAnnotationArea(map, frame.annotation, frame.lift)
      setAnnotationLift(map, frame.lift)
      drawStory(map, frame)
      liftTweenRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    liftTweenRef.current = requestAnimationFrame(step)
  }, [flat, ready])

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.canvas} />
      {interactive ? (
        <MapControls
          className={[styles.controls, controlsClassName].filter(Boolean).join(' ')}
          disabled={!ready}
          onZoomIn={() => handleRef.current?.zoomIn()}
          onZoomOut={() => handleRef.current?.zoomOut()}
          onResetNorth={() => handleRef.current?.resetNorth()}
        />
      ) : null}
    </div>
  )
}
