/**
 * The GAMI demo's map layers, shared by the Briefing backdrop, the stories and Tell Me More, drawn like
 * the story map's: value columns, flat disks, ground-level lines, heat, outlined areas and text labels.
 * Every element belongs to a `group`, which the Map Data panel can hide.
 */
import mapboxgl from 'mapbox-gl'
import { circle, greatCircle, type LngLat } from './gamiGeo'
import './gamiMap.css'

/** What a column or disk's hover tooltip reads. */
export type GamiTip = { title: string; rows?: [string, string][] }

export type GamiColumn = { at: LngLat; height: number; color: string; group: string; tip?: GamiTip }
export type GamiDisk = { at: LngLat; radiusM: number; color: string; group: string; tip?: GamiTip }
export type GamiArc = { from: LngLat; to: LngLat; color: string; width?: number; opacity?: number; group: string }
export type GamiHeatPoint = { at: LngLat; weight: number; group: string }
/** A text label over the map, beside the point it names. */
export type GamiLabel = {
  at: LngLat
  title: string
  text?: string
  /** Which side of the point the label sits; west keeps it off a close neighbour's. Defaults to the top. */
  side?: 'top' | 'east' | 'west'
  group: string
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
  labels: GamiLabel[]
}

export const EMPTY_SCENE: GamiMapScene = {
  columnRadiusM: 1000,
  columns: [],
  disks: [],
  arcs: [],
  heat: [],
  heatRadiusM: 10000,
  heatRamp: ['#2b61f5', '#f7f9ff'],
  labels: [],
}

export function scene(parts: Partial<GamiMapScene>): GamiMapScene {
  return { ...EMPTY_SCENE, ...parts }
}

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at Saudi latitudes. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24 * Math.PI) / 180)

function metersToPixels(meters: mapboxgl.ExpressionSpecification | number): mapboxgl.ExpressionSpecification {
  const base: mapboxgl.ExpressionSpecification = ['/', meters, METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const ids = (prefix: string) => ({
  heat: `${prefix}-heat`,
  disks: `${prefix}-disks`,
  columns: `${prefix}-columns`,
  arcs: `${prefix}-arcs`,
})

/** The layers whose features carry a hover tooltip. */
export function gamiTipLayers(prefix: string) {
  const id = ids(prefix)
  return [id.columns, id.disks]
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function mountGamiLayers(map: mapboxgl.Map, prefix: string) {
  const id = ids(prefix)
  if (map.getSource(id.columns)) return
  map.addSource(id.heat, { type: 'geojson', data: EMPTY })
  map.addSource(id.disks, { type: 'geojson', data: EMPTY })
  map.addSource(id.columns, { type: 'geojson', data: EMPTY })
  map.addSource(id.arcs, { type: 'geojson', data: EMPTY })

  map.addLayer({
    id: id.heat,
    type: 'heatmap',
    source: id.heat,
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 1,
      'heatmap-radius': metersToPixels(['get', 'radius']),
      'heatmap-opacity': 0.7,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 1, '#fff'],
    },
  })
  map.addLayer({
    id: id.arcs,
    type: 'line',
    source: id.arcs,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'width'],
      'line-opacity': ['get', 'opacity'],
      'line-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: id.disks,
    type: 'circle',
    source: id.disks,
    paint: {
      'circle-radius': metersToPixels(['get', 'radius']),
      'circle-color': ['get', 'color'],
      'circle-opacity': ['*', 0.22, ['get', 'alpha']],
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': ['*', 0.9, ['get', 'alpha']],
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-emissive-strength': 1,
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
      // The night basemap's lights leave unlit extrusions near black; this keeps the palette colour.
      'fill-extrusion-emissive-strength': 0.7,
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

const ARC_STEPS = 96
const arcCache = new WeakMap<GamiArc, LngLat[]>()

function arcPath(arc: GamiArc) {
  let coords = arcCache.get(arc)
  if (!coords) {
    coords = greatCircle(arc.from, arc.to, ARC_STEPS)
    arcCache.set(arc, coords)
  }
  return coords
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

const NO_GROUPS: ReadonlySet<string> = new Set()

/**
 * Draws `scene` at `grow` (0 hidden, 1 full): columns rise, disks and heat fade in, and lines draw out
 * from their origin. Elements in a `hidden` group are left out. `lift` 0 lays the columns flat (2D).
 */
export function drawGamiScene(
  map: mapboxgl.Map,
  prefix: string,
  scene: GamiMapScene,
  grow: number,
  hidden: ReadonlySet<string> = NO_GROUPS,
  lift = 1,
) {
  const id = ids(prefix)
  if (!map.getSource(id.columns)) return
  const shown = <T extends { group: string }>(items: T[]) => (grow <= 0 ? [] : items.filter((item) => !hidden.has(item.group)))
  setData(map, id.columns, {
    type: 'FeatureCollection',
    features: shown(scene.columns).map((column) => ({
      type: 'Feature',
      properties: { height: column.height * grow * lift, color: column.color, tip: column.tip ? JSON.stringify(column.tip) : null },
      geometry: { type: 'Polygon', coordinates: [cachedCircle(column, column.at, scene.columnRadiusM, 16)] },
    })),
  })
  setData(map, id.disks, {
    type: 'FeatureCollection',
    features: shown(scene.disks).map((disk) => ({
      type: 'Feature',
      properties: { radius: disk.radiusM, color: disk.color, alpha: grow, tip: disk.tip ? JSON.stringify(disk.tip) : null },
      geometry: { type: 'Point', coordinates: disk.at },
    })),
  })
  setData(map, id.heat, {
    type: 'FeatureCollection',
    features: shown(scene.heat).map((point) => ({
      type: 'Feature',
      properties: { weight: point.weight * grow, radius: scene.heatRadiusM },
      geometry: { type: 'Point', coordinates: point.at },
    })),
  })
  map.setPaintProperty(id.heat, 'heatmap-color', heatColor(scene.heatRamp))
  setData(map, id.arcs, {
    type: 'FeatureCollection',
    features:
      grow < 0.02
        ? []
        : shown(scene.arcs).map((arc) => {
            const coords = arcPath(arc)
            return {
              type: 'Feature' as const,
              properties: { color: arc.color, width: arc.width ?? 2, opacity: (arc.opacity ?? 0.9) * Math.min(1, grow) },
              geometry: {
                type: 'LineString' as const,
                coordinates: coords.slice(0, Math.max(2, Math.round(coords.length * Math.min(1, grow)))),
              },
            }
          }),
  })
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** A tooltip's markup: the title, then label and value rows. */
export function gamiTipHtml(tip: GamiTip) {
  const rows = (tip.rows ?? [])
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')
  return `<p class="gami-tip-title">${escapeHtml(tip.title)}</p>${rows ? `<dl class="gami-tip-rows">${rows}</dl>` : ''}`
}

const LABEL_ANCHOR = {
  top: { anchor: 'bottom', offset: [0, -10] },
  east: { anchor: 'left', offset: [12, 0] },
  west: { anchor: 'right', offset: [-12, 0] },
} as const

type LabelEntry = { marker: mapboxgl.Marker; el: HTMLElement; label: GamiLabel }

/** Text labels with the story tooltips' blurred card. */
export class GamiLabels {
  private map: mapboxgl.Map
  private entries: LabelEntry[] = []
  private labels: GamiLabel[] = []

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  sync(labels: GamiLabel[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS) {
    if (labels !== this.labels) {
      this.clear()
      this.labels = labels
      this.entries = labels.map((label) => {
        // Mapbox owns the marker element's transform and opacity, so the fade goes on an inner element.
        const holder = document.createElement('div')
        const el = document.createElement('div')
        el.className = 'gami-label'
        el.innerHTML = `<b>${escapeHtml(label.title)}</b>${label.text ? `<span>${escapeHtml(label.text)}</span>` : ''}`
        holder.appendChild(el)
        const { anchor, offset } = LABEL_ANCHOR[label.side ?? 'top']
        const marker = new mapboxgl.Marker({ element: holder, anchor, offset: [...offset] })
          .setLngLat(label.at)
          .addTo(this.map)
        return { marker, el, label }
      })
    }
    for (const entry of this.entries) {
      const off = hidden.has(entry.label.group)
      entry.el.style.opacity = off ? '0' : String(Math.min(1, Math.max(0, grow * 1.4 - 0.2)))
    }
  }

  clear() {
    for (const entry of this.entries) entry.marker.remove()
    this.entries = []
    this.labels = []
  }
}

/** An outlined area: a soft fill and its outline, as the story annotations draw them. */
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
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', 0.1, ['get', 'reveal']] },
  })
  map.addLayer({
    id: id.line,
    type: 'line',
    source: id.source,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': ['get', 'reveal'] },
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
      'fill-extrusion-opacity': 0.3,
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-cast-shadows': false,
      'fill-extrusion-emissive-strength': 1,
    },
  })
}

/** Draws `areas` with their walls `reveal` (0–1) of the way up; `lift` 0 lays them flat (2D). */
export function drawGamiAreas(
  map: mapboxgl.Map,
  prefix: string,
  areas: GamiArea[],
  reveal: number,
  hidden = false,
  lift = 1,
) {
  const id = areaIds(prefix)
  setData(map, id.source, {
    type: 'FeatureCollection',
    features:
      hidden || reveal <= 0
        ? []
        : areas.map((area) => ({
            type: 'Feature',
            properties: { color: area.color, reveal, height: area.wallM * reveal * lift, width: area.wallM * 0.1 },
            geometry: { type: 'Polygon', coordinates: [area.ring] },
          })),
  })
}

/** Each area's name and note, over the outline's northernmost (or westernmost) point. */
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
          (best, point) => ((west ? point[0] < best[0] : point[1] > best[1]) ? point : best),
          area.ring[0],
        )
        const el = document.createElement('div')
        const label = document.createElement('div')
        label.className = 'gami-label gami-area-label'
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
