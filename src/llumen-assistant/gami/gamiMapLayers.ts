/**
 * The GAMI demo's map layers, shared by the Briefing backdrop, the stories and Tell Me More: value
 * columns, floating 3D disks with pulsing halos, raised arcs, heat and icon pins. Every element belongs
 * to a `group`, which the Map Data panel can hide.
 */
import mapboxgl from 'mapbox-gl'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ComponentType } from 'react'
import {
  AirplaneTilt,
  Anchor,
  Broadcast,
  Buildings,
  Crosshair,
  Factory,
  GraduationCap,
  Jeep,
  MapPin,
  Warning,
  type IconProps,
} from '@phosphor-icons/react'
import { circle, greatCircle, offsetKm, type LngLat } from './gamiGeo'
import './gamiMap.css'

export type GamiIcon =
  | 'air'
  | 'armament'
  | 'land'
  | 'naval'
  | 'electronics'
  | 'factory'
  | 'academy'
  | 'venue'
  | 'warning'
  | 'pin'

export type GamiColumn = { at: LngLat; height: number; color: string; group: string }
/** A slab floating `base` m over the ground, `height` m thick. */
export type GamiDisk = { at: LngLat; radiusM: number; base: number; height: number; color: string; group: string }
export type GamiArc = {
  from: LngLat
  to: LngLat
  color: string
  peakM: number
  width?: number
  opacity?: number
  group: string
}
export type GamiHeatPoint = { at: LngLat; weight: number; group: string }
export type GamiPin = {
  at: LngLat
  label?: string
  /** West keeps the label off a close neighbour's to the east. Defaults to east. */
  labelSide?: 'east' | 'west'
  color: string
  icon: GamiIcon
  group: string
  /** Shown in the pin's tooltip on click. */
  title?: string
  info?: [string, string][]
}

export type GamiMapScene = {
  columnRadiusM: number
  columns: GamiColumn[]
  disks: GamiDisk[]
  arcs: GamiArc[]
  heat: GamiHeatPoint[]
  heatRadiusM: number
  /** Low to high density. */
  heatRamp: string[]
  /** The raised arcs' ribbon width in meters, for a 2.4px arc. */
  arcWidthM: number
  pins: GamiPin[]
}

export const EMPTY_SCENE: GamiMapScene = {
  columnRadiusM: 1000,
  columns: [],
  disks: [],
  arcs: [],
  heat: [],
  heatRadiusM: 10000,
  heatRamp: ['#0b2a4a', '#1fce7a'],
  arcWidthM: 30000,
  pins: [],
}

export function scene(parts: Partial<GamiMapScene>): GamiMapScene {
  return { ...EMPTY_SCENE, ...parts }
}

const ICONS: Record<GamiIcon, ComponentType<IconProps>> = {
  air: AirplaneTilt,
  armament: Crosshair,
  land: Jeep,
  naval: Anchor,
  electronics: Broadcast,
  factory: Factory,
  academy: GraduationCap,
  venue: Buildings,
  warning: Warning,
  pin: MapPin,
}

const iconMarkup = new Map<GamiIcon, string>()

export function gamiIconSvg(icon: GamiIcon, size = 16) {
  const key = icon
  let markup = iconMarkup.get(key)
  if (!markup) {
    markup = renderToStaticMarkup(createElement(ICONS[icon], { size, weight: 'bold', color: '#fff' }))
    iconMarkup.set(key, markup)
  }
  return markup
}

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at Saudi latitudes. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24 * Math.PI) / 180)

function metersToPixels(meters: mapboxgl.ExpressionSpecification | number): mapboxgl.ExpressionSpecification {
  const base: mapboxgl.ExpressionSpecification = ['/', meters, METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const ids = (prefix: string) => ({
  heat: `${prefix}-heat`,
  halo: `${prefix}-disk-halo`,
  pulse: `${prefix}-disk-pulse`,
  disks: `${prefix}-disks`,
  columns: `${prefix}-columns`,
  arcGlow: `${prefix}-arc-glow`,
  arcs: `${prefix}-arcs`,
  arcDash: `${prefix}-arc-dash`,
  ribbons: `${prefix}-arc-ribbons`,
})

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function mountGamiLayers(map: mapboxgl.Map, prefix: string) {
  const id = ids(prefix)
  if (map.getSource(id.columns)) return
  map.addSource(id.heat, { type: 'geojson', data: EMPTY })
  map.addSource(id.halo, { type: 'geojson', data: EMPTY })
  map.addSource(id.disks, { type: 'geojson', data: EMPTY })
  map.addSource(id.columns, { type: 'geojson', data: EMPTY })
  map.addSource(id.arcs, { type: 'geojson', data: EMPTY })
  map.addSource(id.ribbons, { type: 'geojson', data: EMPTY })

  map.addLayer({
    id: id.heat,
    type: 'heatmap',
    source: id.heat,
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 1,
      'heatmap-radius': metersToPixels(['get', 'radius']),
      'heatmap-opacity': 0.85,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 1, '#fff'],
    },
  })
  map.addLayer({
    id: id.halo,
    type: 'circle',
    source: id.halo,
    paint: {
      'circle-radius': metersToPixels(['*', ['get', 'radius'], 1.7]),
      'circle-color': ['get', 'color'],
      'circle-opacity': ['*', 0.28, ['get', 'alpha']],
      'circle-blur': 1,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.pulse,
    type: 'circle',
    source: id.halo,
    paint: {
      'circle-radius': metersToPixels(['get', 'radius']),
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': ['*', 0.8, ['get', 'alpha']],
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.disks,
    type: 'fill-extrusion',
    source: id.disks,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-height': ['get', 'top'],
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-emissive-strength': 0.9,
    },
  })
  map.addLayer({
    id: id.columns,
    type: 'fill-extrusion',
    source: id.columns,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-emissive-strength': 0.9,
    },
  })
  // Elevated lines don't draw on the globe, so each arc rises as a ribbon of short floating extrusions
  // over its ground track, which carries the glow and the marching dashes.
  map.addLayer({
    id: id.arcGlow,
    type: 'line',
    source: id.arcs,
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['*', ['get', 'width'], 3],
      'line-opacity': ['*', 0.18, ['get', 'opacity']],
      'line-blur': 4,
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.arcs,
    type: 'line',
    source: id.arcs,
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['*', ['get', 'width'], 0.6],
      'line-opacity': ['*', 0.45, ['get', 'opacity']],
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.arcDash,
    type: 'line',
    source: id.arcs,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['*', ['get', 'width'], 0.8],
      'line-opacity': ['*', 0.9, ['get', 'opacity']],
      'line-dasharray': [0, 4, 3],
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.ribbons,
    type: 'fill-extrusion',
    source: id.ribbons,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-height': ['get', 'top'],
      'fill-extrusion-opacity': 0.88,
      'fill-extrusion-vertical-gradient': false,
      'fill-extrusion-emissive-strength': 1,
      'fill-extrusion-cast-shadows': false,
    },
  })
}

function heatColor(ramp: string[]): mapboxgl.ExpressionSpecification {
  const stops: (number | string)[] = [0, 'rgba(0,0,0,0)']
  ramp.forEach((color, index) => {
    stops.push(0.12 + (0.88 * index) / Math.max(1, ramp.length - 1), color)
  })
  return ['interpolate', ['linear'], ['heatmap-density'], ...stops] as mapboxgl.ExpressionSpecification
}

const ARC_STEPS = 144

const arcCache = new WeakMap<GamiArc, { coords: LngLat[]; elevation: number[] }>()

function arcPath(arc: GamiArc) {
  let path = arcCache.get(arc)
  if (!path) {
    const coords = greatCircle(arc.from, arc.to, ARC_STEPS)
    const elevation = coords.map((_, index) => Math.sin((Math.PI * index) / (coords.length - 1)) * arc.peakM)
    path = { coords, elevation }
    arcCache.set(arc, path)
  }
  return path
}

const ribbonCache = new WeakMap<GamiArc, { ring: LngLat[]; base: number; top: number }[]>()

/** One floating quad per arc segment, `widthM` across and as thick, following the arc's height. */
function arcRibbon(arc: GamiArc, widthM: number) {
  let quads = ribbonCache.get(arc)
  if (!quads) {
    const { coords, elevation } = arcPath(arc)
    const half = widthM / 2000
    quads = coords.slice(0, -1).map((a, i) => {
      const b = coords[i + 1]
      const lat = (a[1] + b[1]) / 2
      const east = (b[0] - a[0]) * 111.32 * Math.cos((lat * Math.PI) / 180)
      const north = (b[1] - a[1]) * 110.8
      const length = Math.hypot(east, north) || 1
      const px = (-north / length) * half
      const py = (east / length) * half
      const ring: LngLat[] = [
        offsetKm(a, px, py),
        offsetKm(b, px, py),
        offsetKm(b, -px, -py),
        offsetKm(a, -px, -py),
        offsetKm(a, px, py),
      ]
      const low = Math.min(elevation[i], elevation[i + 1])
      const high = Math.max(elevation[i], elevation[i + 1])
      return { ring, base: Math.max(0, low - widthM * 0.35), top: Math.max(widthM * 0.35, high + widthM * 0.35) }
    })
    ribbonCache.set(arc, quads)
  }
  return quads
}

/** A faded arc's colour, mixed toward the night map since extrusions take one opacity per layer. */
function fadeColor(hex: string, opacity: number) {
  if (opacity >= 1 || !hex.startsWith('#')) return hex
  const value = parseInt(hex.slice(1), 16)
  const mix = (channel: number, night: number) => Math.round(night + (channel - night) * opacity)
  const r = mix((value >> 16) & 255, 22)
  const g = mix((value >> 8) & 255, 28)
  const b = mix(value & 255, 44)
  return `rgb(${r}, ${g}, ${b})`
}

const ringCache = new WeakMap<object, LngLat[]>()

function cachedCircle(key: object, at: LngLat, radiusM: number, sides: number) {
  let ring = ringCache.get(key)
  if (!ring) {
    ring = circle(at, radiusM, sides)
    ringCache.set(key, ring)
  }
  return ring
}

function setData(map: mapboxgl.Map, id: string, data: GeoJSON.FeatureCollection) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data)
}

/**
 * Draws `scene` at `grow` (0 hidden, 1 full): columns and disks rise, arcs draw out from their origin and
 * heat fades in. Elements in a `hidden` group are left out.
 */
export function drawGamiScene(
  map: mapboxgl.Map,
  prefix: string,
  scene: GamiMapScene,
  grow: number,
  hidden: ReadonlySet<string> = NO_GROUPS,
) {
  const id = ids(prefix)
  if (!map.getSource(id.columns)) return
  const shown = <T extends { group: string }>(items: T[]) => (grow <= 0 ? [] : items.filter((item) => !hidden.has(item.group)))
  const columns = shown(scene.columns)
  setData(map, id.columns, {
    type: 'FeatureCollection',
    features: columns.map((column) => ({
      type: 'Feature',
      properties: { height: column.height * grow, color: column.color },
      geometry: { type: 'Polygon', coordinates: [cachedCircle(column, column.at, scene.columnRadiusM, 16)] },
    })),
  })
  const disks = shown(scene.disks)
  setData(map, id.disks, {
    type: 'FeatureCollection',
    features: disks.map((disk) => ({
      type: 'Feature',
      properties: { base: disk.base * grow, top: (disk.base + disk.height) * grow, color: disk.color },
      geometry: { type: 'Polygon', coordinates: [cachedCircle(disk, disk.at, disk.radiusM * (0.4 + 0.6 * grow), 40)] },
    })),
  })
  setData(map, id.halo, {
    type: 'FeatureCollection',
    features: disks.map((disk) => ({
      type: 'Feature',
      properties: { radius: disk.radiusM, color: disk.color, alpha: grow },
      geometry: { type: 'Point', coordinates: disk.at },
    })),
  })
  const heat = shown(scene.heat)
  setData(map, id.heat, {
    type: 'FeatureCollection',
    features: heat.map((point) => ({
      type: 'Feature',
      properties: { weight: point.weight * grow, radius: scene.heatRadiusM },
      geometry: { type: 'Point', coordinates: point.at },
    })),
  })
  map.setPaintProperty(id.heat, 'heatmap-color', heatColor(scene.heatRamp))
  const arcs = shown(scene.arcs)
  const reach = Math.min(1, grow)
  setData(map, id.arcs, {
    type: 'FeatureCollection',
    features:
      grow < 0.02
        ? []
        : arcs.map((arc) => {
            const { coords } = arcPath(arc)
            return {
              type: 'Feature' as const,
              properties: { color: arc.color, width: arc.width ?? 2.4, opacity: (arc.opacity ?? 1) * reach },
              geometry: { type: 'LineString' as const, coordinates: coords.slice(0, Math.max(2, Math.round(coords.length * reach))) },
            }
          }),
  })
  setData(map, id.ribbons, {
    type: 'FeatureCollection',
    features:
      grow < 0.02
        ? []
        : arcs.flatMap((arc) => {
            const quads = arcRibbon(arc, (scene.arcWidthM * (arc.width ?? 2.4)) / 2.4)
            const color = fadeColor(arc.color, arc.opacity ?? 1)
            return quads.slice(0, Math.round(quads.length * reach)).map((quad) => ({
              type: 'Feature' as const,
              properties: { color, base: quad.base, top: quad.top },
              geometry: { type: 'Polygon' as const, coordinates: [quad.ring] },
            }))
          }),
  })
}

const NO_GROUPS: ReadonlySet<string> = new Set()

/** Mapbox's own dash animation: one array per step, so the dashes march along the arcs. */
const DASH_STEPS: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

const lastDash = new WeakMap<mapboxgl.Map, number>()

/** Per frame: marches the arc dashes and pulses the disk rings. */
export function animateGamiLayers(map: mapboxgl.Map, prefix: string, now: number) {
  const id = ids(prefix)
  if (!map.getLayer(id.arcDash)) return
  const step = Math.floor(now / 70) % DASH_STEPS.length
  if (lastDash.get(map) !== step) {
    lastDash.set(map, step)
    map.setPaintProperty(id.arcDash, 'line-dasharray', DASH_STEPS[step])
  }
  const phase = (now % 2400) / 2400
  map.setPaintProperty(id.pulse, 'circle-radius', metersToPixels(['*', ['get', 'radius'], 1 + phase * 1.6]))
  map.setPaintProperty(id.pulse, 'circle-stroke-opacity', ['*', 0.85 * (1 - phase), ['get', 'alpha']])
}

type PinEntry = { marker: mapboxgl.Marker; el: HTMLElement; pin: GamiPin }

/** HTML pins with domain icons; a click opens the pin's details over the map. */
export class GamiPins {
  private map: mapboxgl.Map
  private entries: PinEntry[] = []
  private pins: GamiPin[] = []
  private tip: mapboxgl.Popup | null = null

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  sync(pins: GamiPin[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS) {
    if (pins !== this.pins) {
      this.clear()
      this.pins = pins
      this.entries = pins.map((pin) => {
        // Mapbox owns the marker element's transform and opacity, so the fade goes on an inner element.
        const holder = document.createElement('div')
        const el = document.createElement('div')
        el.className = 'gami-pin'
        el.dataset.side = pin.labelSide ?? 'east'
        el.style.setProperty('--pin', pin.color)
        el.innerHTML = `<span class="gami-pin-head">${gamiIconSvg(pin.icon)}</span><span class="gami-pin-stem"></span>${
          pin.label ? `<span class="gami-pin-label">${escapeHtml(pin.label)}</span>` : ''
        }`
        holder.appendChild(el)
        if (pin.title || pin.info) {
          el.addEventListener('click', (event) => {
            event.stopPropagation()
            this.open(pin)
          })
        }
        const marker = new mapboxgl.Marker({ element: holder, anchor: 'bottom' }).setLngLat(pin.at).addTo(this.map)
        return { marker, el, pin }
      })
    }
    for (const entry of this.entries) {
      const off = hidden.has(entry.pin.group)
      entry.el.style.opacity = off ? '0' : String(Math.min(1, Math.max(0, grow * 1.4 - 0.2)))
      entry.el.style.pointerEvents = off || grow < 0.6 ? 'none' : 'auto'
    }
  }

  private open(pin: GamiPin) {
    this.tip?.remove()
    const rows = (pin.info ?? [])
      .map(([key, value]) => `<div class="gami-tip-row"><span>${escapeHtml(key)}</span><b>${escapeHtml(value)}</b></div>`)
      .join('')
    this.tip = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 34, className: 'gami-tip', maxWidth: '260px' })
      .setLngLat(pin.at)
      .setHTML(`<p class="gami-tip-title">${escapeHtml(pin.title ?? pin.label ?? '')}</p>${rows}`)
      .addTo(this.map)
  }

  clear() {
    this.tip?.remove()
    this.tip = null
    for (const entry of this.entries) entry.marker.remove()
    this.entries = []
    this.pins = []
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** An outlined area: a soft fill, a glowing outline and a wall rising along it. */
export type GamiArea = {
  id: string
  name: string
  text: string
  color: string
  ring: LngLat[]
  wallM: number
  labelSide?: 'top' | 'west'
}

const areaIds = (prefix: string) => ({
  source: `${prefix}-areas`,
  fill: `${prefix}-area-fill`,
  glow: `${prefix}-area-glow`,
  line: `${prefix}-area-line`,
  wall: `${prefix}-area-wall`,
})

export function mountGamiAreas(map: mapboxgl.Map, prefix: string) {
  const id = areaIds(prefix)
  if (map.getSource(id.source)) return
  map.addSource(id.source, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: id.fill,
    type: 'fill',
    source: id.source,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', 0.1, ['get', 'reveal']], 'fill-emissive-strength': 1 },
  })
  map.addLayer({
    id: id.glow,
    type: 'line',
    source: id.source,
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 12,
      'line-blur': 8,
      'line-opacity': ['*', 0.45, ['get', 'reveal']],
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.line,
    type: 'line',
    source: id.source,
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2.5,
      'line-opacity': ['get', 'reveal'],
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.wall,
    type: 'fill-extrusion',
    source: id.source,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-line-width': ['get', 'width'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.45,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-emissive-strength': 1,
      'fill-extrusion-cast-shadows': false,
    },
  })
}

/** Draws `areas` with their walls `reveal` (0–1) of the way up. */
export function drawGamiAreas(map: mapboxgl.Map, prefix: string, areas: GamiArea[], reveal: number, hidden = false) {
  const id = areaIds(prefix)
  setData(map, id.source, {
    type: 'FeatureCollection',
    features:
      hidden || reveal <= 0
        ? []
        : areas.map((area) => ({
            type: 'Feature',
            properties: { color: area.color, reveal, height: area.wallM * reveal, width: area.wallM * 0.16 },
            geometry: { type: 'Polygon', coordinates: [area.ring] },
          })),
  })
}

/** Each area's name and note, pinned over the outline's northernmost point. */
export class GamiAreaLabels {
  private map: mapboxgl.Map
  private markers: mapboxgl.Marker[] = []
  private areas: GamiArea[] = []

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  sync(areas: GamiArea[], shown: boolean) {
    if (areas !== this.areas) {
      this.clear()
      this.areas = areas
      this.markers = areas.map((area) => {
        const west = area.labelSide === 'west'
        const at = area.ring.reduce(
          (best, point) => (west ? point[0] < best[0] : point[1] > best[1]) ? point : best,
          area.ring[0],
        )
        const el = document.createElement('div')
        const label = document.createElement('div')
        label.className = 'gami-area-label'
        label.style.setProperty('--area', area.color)
        label.innerHTML = `<b>${escapeHtml(area.name)}</b><span>${escapeHtml(area.text)}</span>`
        el.appendChild(label)
        return new mapboxgl.Marker({ element: el, anchor: west ? 'right' : 'bottom', offset: west ? [-12, 0] : [0, -10] })
          .setLngLat(at)
          .addTo(this.map)
      })
    }
    for (const marker of this.markers) {
      const label = marker.getElement().firstElementChild as HTMLElement | null
      if (label) label.dataset.shown = shown ? 'true' : 'false'
    }
  }

  clear() {
    for (const marker of this.markers) marker.remove()
    this.markers = []
    this.areas = []
  }
}
