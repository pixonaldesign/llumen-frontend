import mapboxgl from 'mapbox-gl'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import {
  annotationCollection,
  arrowHead,
  circleRing,
  closeRing,
  distanceM,
  fromLocal,
  labelAnchor,
  minimumPoints,
  shapeMeasurements,
  toLocal,
  type AnnotationCircle,
  type AnnotationFeatureKind,
  type AnnotationGeometry,
  type AnnotationTool,
  type AnnotationValidity,
  type DrawnShape,
  type FeatureRef,
  type LngLat,
  type MapAnnotationItem,
} from './storyMapAnnotations'
import styles from './StoryMapAnnotations.module.css'

const SOURCE = 'story-user-annotations'
const DRAFT_SOURCE = 'story-user-annotations-draft'
const DRAFT_COLOR = '#70aeff'
/** A polygon's starting point, where clicking again closes the shape. */
const FIRST_POINT_COLOR = '#ff9f43'
/** A click this close to a column or junction drops the point on that feature. */
const SNAP_PX = 14
/** A click this close to the last point finishes a line; this close to the first point closes a polygon. */
const CLOSE_PX = 12
const HIT_PX = 6
const HANDLE_PX = 11
const GROUND_WIDTH = 3
/** Walls match the AI chat's picked-area walls: stacked extrusion bands whose opacity falls off upward. */
const WALL_BANDS = 12
const WALL_WIDTH_M = 6
const WALL_OPACITY = 0.7
/**
 * `fill-extrusion-opacity` can't be data-driven, so annotations share a stack of wall layers per opacity
 * (in whole percent). The map remembers which stacks exist and the current lift.
 */
const walls = new WeakMap<mapboxgl.Map, { lift: number; groups: number[] }>()
const wallId = (group: number, band: number) => `story-user-annotation-wall-${group}-${band}`
const wallGroup = (alpha: number) => Math.round(alpha * 100)

const GROUND_LAYERS = ['story-user-annotation-area', 'story-user-annotation-line']

/** Arrowheads are a flat icon in screen pixels, so they keep one small size however long the arrow is. */
const HEAD_LENGTH_PX = 22
const HEAD_WIDTH_PX = 20
const HEAD_PAD_PX = 2
const HEAD_RATIO = 2
const headImage = (color: string) => `story-user-annotation-head-${color.toLowerCase()}`

function ensureArrowhead(map: mapboxgl.Map, color: string) {
  const id = headImage(color)
  if (map.hasImage(id)) return
  const width = (HEAD_WIDTH_PX + HEAD_PAD_PX * 2) * HEAD_RATIO
  const height = (HEAD_LENGTH_PX + HEAD_PAD_PX * 2) * HEAD_RATIO
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return
  const pad = HEAD_PAD_PX * HEAD_RATIO
  context.fillStyle = color
  context.beginPath()
  context.moveTo(width / 2, pad)
  context.lineTo(width - pad, height - pad)
  context.lineTo(width / 2, height - pad - HEAD_LENGTH_PX * HEAD_RATIO * 0.22)
  context.lineTo(pad, height - pad)
  context.closePath()
  context.fill()
  map.addImage(id, context.getImageData(0, 0, width, height), { pixelRatio: HEAD_RATIO })
}

/** The icon's tip sits on the arrow's last point, just past the shaft's round cap. */
const headLayout = (image: mapboxgl.ExpressionSpecification): mapboxgl.SymbolLayerSpecification['layout'] => ({
  'icon-image': image,
  'icon-anchor': 'top',
  'icon-offset': [0, -HEAD_PAD_PX - 1],
  'icon-rotate': ['get', 'bearing'],
  'icon-rotation-alignment': 'map',
  'icon-pitch-alignment': 'map',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
})

const HIT_LAYERS = [
  'story-user-annotation-hit',
  'story-user-annotation-area',
  'story-user-annotation-line',
  'story-user-annotation-head',
]
/** Area outlines sit on the ground below the story's heat disks and columns. */
const AREA_BEFORE_LAYER = 'story-junctions-halo'

const empty = () => ({ type: 'FeatureCollection' as const, features: [] })

const kindIs = (...kinds: AnnotationFeatureKind[]): mapboxgl.ExpressionSpecification => [
  'match',
  ['get', 'kind'],
  kinds,
  true,
  false,
]

function wallOpacity(group: number, band: number, lift: number) {
  return (group / 100) * WALL_OPACITY * (1 - band / WALL_BANDS) ** 1.6 * lift
}

/** Outlines on the ground hand over to the walls as the map tilts, as the AI chat's area outline does. */
function groundOpacity(lift: number): mapboxgl.ExpressionSpecification {
  return ['*', ['get', 'alpha'], 1 - lift]
}

function wallLayerIds(map: mapboxgl.Map) {
  return (walls.get(map)?.groups ?? []).flatMap((group) =>
    Array.from({ length: WALL_BANDS }, (_, band) => wallId(group, band)),
  )
}

/** Fades the 3D walls with the map's tilt: `lift` is 0 on a flat map and 1 in full 3D. */
export function setAnnotationLift(map: mapboxgl.Map, lift: number) {
  const state = walls.get(map)
  if (!state) return
  state.lift = lift
  for (const id of GROUND_LAYERS) if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', groundOpacity(lift))
  for (const group of state.groups) {
    for (let band = 0; band < WALL_BANDS; band += 1) {
      const id = wallId(group, band)
      if (!map.getLayer(id)) continue
      map.setLayoutProperty(id, 'visibility', lift > 0.01 ? 'visible' : 'none')
      map.setPaintProperty(id, 'fill-extrusion-opacity', wallOpacity(group, band, lift))
    }
  }
}

/** Adds a wall stack for every opacity in use and drops stacks nothing uses any more. */
function syncWalls(map: mapboxgl.Map, alphas: number[]) {
  const state = walls.get(map)
  if (!state) return
  const groups = [...new Set(alphas.map(wallGroup))].filter((group) => group > 0)
  for (const group of state.groups) {
    if (groups.includes(group)) continue
    for (let band = 0; band < WALL_BANDS; band += 1) {
      if (map.getLayer(wallId(group, band))) map.removeLayer(wallId(group, band))
    }
  }
  const before = map.getLayer('story-user-annotation-draft-dash') ? 'story-user-annotation-draft-dash' : undefined
  const step: mapboxgl.ExpressionSpecification = ['/', ['get', 'wall'], WALL_BANDS]
  for (const group of groups) {
    if (state.groups.includes(group)) continue
    for (let band = 0; band < WALL_BANDS; band += 1) {
      map.addLayer(
        {
          id: wallId(group, band),
          type: 'fill-extrusion',
          source: SOURCE,
          filter: ['all', kindIs('line', 'area'), ['==', ['round', ['*', ['get', 'alpha'], 100]], group]],
          layout: { visibility: state.lift > 0.01 ? 'visible' : 'none' },
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-line-width': WALL_WIDTH_M,
            'fill-extrusion-base': ['*', step, band],
            'fill-extrusion-height': ['*', step, band + 1],
            'fill-extrusion-opacity': wallOpacity(group, band, state.lift),
            'fill-extrusion-opacity-transition': { duration: 0 },
            'fill-extrusion-vertical-gradient': false,
            'fill-extrusion-emissive-strength': 1,
            'fill-extrusion-cast-shadows': false,
          },
        },
        before,
      )
    }
  }
  state.groups = groups
}

/** Sources and layers for drawn annotations and the in-progress draft; safe to call after every style load. */
export function mountAnnotationLayers(map: mapboxgl.Map, lift: number) {
  if (map.getSource(SOURCE)) return
  walls.set(map, { lift, groups: [] })
  map.addSource(SOURCE, { type: 'geojson', data: empty() })
  map.addSource(DRAFT_SOURCE, { type: 'geojson', data: empty() })
  const areaBefore = map.getLayer(AREA_BEFORE_LAYER) ? AREA_BEFORE_LAYER : undefined
  const alpha: mapboxgl.ExpressionSpecification = ['get', 'alpha']
  // Areas have no fill; this invisible one only lets a click inside an area select it.
  map.addLayer(
    {
      id: 'story-user-annotation-hit',
      type: 'fill',
      source: SOURCE,
      filter: kindIs('area'),
      paint: { 'fill-color': '#000', 'fill-opacity': 0 },
    },
    areaBefore,
  )
  map.addLayer(
    {
      id: 'story-user-annotation-halo',
      type: 'line',
      source: SOURCE,
      filter: ['all', ['get', 'selected'], kindIs('line', 'area')],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': ['*', alpha, 0.3], 'line-blur': 2 },
    },
    areaBefore,
  )
  map.addLayer(
    {
      id: 'story-user-annotation-area',
      type: 'line',
      source: SOURCE,
      filter: kindIs('area'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': GROUND_WIDTH, 'line-opacity': groundOpacity(lift) },
    },
    areaBefore,
  )
  map.addLayer({
    id: 'story-user-annotation-line',
    type: 'line',
    source: SOURCE,
    filter: kindIs('line'),
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': GROUND_WIDTH, 'line-opacity': groundOpacity(lift) },
  })
  map.addLayer({
    id: 'story-user-annotation-head',
    type: 'symbol',
    source: SOURCE,
    filter: kindIs('head'),
    layout: headLayout(['concat', 'story-user-annotation-head-', ['downcase', ['get', 'color']]]),
    paint: { 'icon-opacity': alpha },
  })
  const draftColor: mapboxgl.ExpressionSpecification = ['coalesce', ['get', 'color'], DRAFT_COLOR]
  for (const solid of [false, true]) {
    map.addLayer({
      id: `story-user-annotation-draft-${solid ? 'line' : 'dash'}`,
      type: 'line',
      source: DRAFT_SOURCE,
      filter: ['all', ['!=', ['geometry-type'], 'Point'], solid ? ['==', ['get', 'solid'], true] : ['!=', ['get', 'solid'], true]],
      layout: { 'line-join': 'round', 'line-cap': solid ? 'round' : 'butt' },
      paint: {
        'line-color': draftColor,
        'line-width': solid ? GROUND_WIDTH : 2.5,
        ...(solid ? {} : { 'line-dasharray': [2, 1.4] }),
      },
    })
  }
  map.addLayer({
    id: 'story-user-annotation-draft-head',
    type: 'symbol',
    source: DRAFT_SOURCE,
    filter: kindIs('head'),
    layout: headLayout(['concat', 'story-user-annotation-head-', ['downcase', ['to-string', draftColor]]]),
  })
  map.addLayer({
    id: 'story-user-annotation-draft-halo',
    type: 'circle',
    source: DRAFT_SOURCE,
    filter: [
      'all',
      ['==', ['geometry-type'], 'Point'],
      ['!=', ['get', 'kind'], 'head'],
      ['any', ['==', ['get', 'role'], 'first'], ['get', 'active']],
    ],
    paint: {
      'circle-radius': ['case', ['get', 'active'], 17, 13],
      'circle-color': ['match', ['get', 'role'], 'first', FIRST_POINT_COLOR, draftColor],
      'circle-opacity': ['case', ['get', 'active'], 0.4, 0.22],
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: 'story-user-annotation-draft-vertex',
    type: 'circle',
    source: DRAFT_SOURCE,
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'kind'], 'head']],
    paint: {
      'circle-radius': [
        'match',
        ['get', 'role'],
        'first',
        ['case', ['get', 'active'], 9, 7.5],
        'handle',
        ['case', ['get', 'active'], 8, 6.5],
        ['case', ['get', 'snapped'], 7, 4.5],
      ],
      'circle-color': [
        'match',
        ['get', 'role'],
        'first',
        FIRST_POINT_COLOR,
        'handle',
        draftColor,
        'cursor',
        'rgba(112, 174, 255, 0.35)',
        '#ffffff',
      ],
      'circle-stroke-color': [
        'case',
        ['get', 'snapped'],
        '#ffb547',
        ['match', ['get', 'role'], ['first', 'handle'], true, false],
        '#ffffff',
        draftColor,
      ],
      'circle-stroke-width': ['match', ['get', 'role'], 'first', 2.5, 'handle', 2.5, 2],
      'circle-pitch-alignment': 'map',
    },
  })
}

function setSource(map: mapboxgl.Map, id: string, data: unknown) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data as GeoJSON.FeatureCollection)
}

export function drawAnnotations(
  map: mapboxgl.Map,
  items: MapAnnotationItem[],
  selectedId: string | null,
  validity: Record<string, AnnotationValidity>,
) {
  const collection = annotationCollection(items, selectedId, validity)
  for (const feature of collection.features) {
    if (feature.properties.kind === 'head') ensureArrowhead(map, feature.properties.color)
  }
  syncWalls(map, collection.features.map((feature) => feature.properties.alpha))
  setSource(map, SOURCE, collection)
}

/** The annotation under a map point, from its outline, wall, arrowhead or the inside of an area. */
export function annotationAt(map: mapboxgl.Map, point: mapboxgl.Point): string | null {
  const layers = [...HIT_LAYERS, ...wallLayerIds(map)].filter((id) => map.getLayer(id))
  if (layers.length === 0) return null
  const hits = map.queryRenderedFeatures(
    [
      [point.x - HIT_PX, point.y - HIT_PX],
      [point.x + HIT_PX, point.y + HIT_PX],
    ],
    { layers },
  )
  // Outlines win over the area they sit in, so a line drawn inside an area stays selectable.
  const hit = hits.find((feature) => feature.layer?.id !== 'story-user-annotation-hit') ?? hits[0]
  const id = hit?.properties?.id
  return typeof id === 'string' ? id : null
}

function el(tag: string, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const STATUS_CLASS: Record<string, string> = { changed: styles.statusChanged, invalid: styles.statusInvalid }

/** A dot, with the text in a tooltip on a fading stick above it. */
function markerElement(item: MapAnnotationItem, validity: AnnotationValidity | undefined) {
  const root = el('div', styles.marker)
  if (item.style.text) {
    const card = el('div', styles.markerCard)
    card.append(el('span', styles.markerCardText, item.style.text))
    root.append(card, el('span', styles.markerStem))
  }
  const dot = el('span', styles.dot)
  const status = validity && STATUS_CLASS[validity.state]
  if (status) dot.append(el('span', `${styles.status} ${status}`))
  root.append(dot)
  return root
}

function pillElement(item: MapAnnotationItem, validity: AnnotationValidity | undefined) {
  const pill = el('div', styles.pill)
  pill.append(el('span', styles.pillDot), el('span', styles.pillText, item.style.text))
  const status = validity && STATUS_CLASS[validity.state]
  if (status) pill.append(el('span', `${styles.status} ${styles.pillStatus} ${status}`))
  return pill
}

/** Half the marker dot, so the dot's centre sits on the point. */
const DOT_OFFSET_PX = 7

type LabelEntry = { marker: mapboxgl.Marker; signature: string }

/** DOM labels: every marker, plus the text pill of any other annotation that has text. */
export class AnnotationLabels {
  private entries = new Map<string, LabelEntry>()
  private seen = new Set<string>()
  private map: mapboxgl.Map
  private onSelect: () => ((id: string) => void) | undefined

  constructor(map: mapboxgl.Map, onSelect: () => ((id: string) => void) | undefined) {
    this.map = map
    this.onSelect = onSelect
  }

  sync(
    items: MapAnnotationItem[],
    selectedId: string | null,
    validity: Record<string, AnnotationValidity>,
    selectable: boolean,
  ) {
    const keep = new Set<string>()
    for (const item of items) {
      const isMarker = item.geometry.type === 'Point'
      if (!item.visible || (!isMarker && !item.style.text)) continue
      keep.add(item.id)
      const selected = item.id === selectedId
      const state = validity[item.id]
      const at = labelAnchor(item)
      const signature = JSON.stringify([item.style, item.opacity, at, selected, state?.state, isMarker, selectable])
      const current = this.entries.get(item.id)
      if (current?.signature === signature) continue
      current?.marker.remove()
      const node = isMarker ? markerElement(item, state) : pillElement(item, state)
      node.style.setProperty('--annotation-color', item.style.color)
      node.style.setProperty('--annotation-opacity', String(item.opacity * (state?.state === 'invalid' ? 0.5 : 1)))
      node.classList.toggle(styles.selected, selected)
      node.classList.toggle(styles.readOnly, !selectable)
      if (!this.seen.has(item.id)) node.classList.add(styles.entering)
      this.seen.add(item.id)
      node.addEventListener('click', (event) => {
        event.stopPropagation()
        this.onSelect()?.(item.id)
      })
      const marker = new mapboxgl.Marker({
        element: node,
        anchor: isMarker ? 'bottom' : 'center',
        offset: isMarker ? [0, DOT_OFFSET_PX] : [0, 0],
      })
        .setLngLat(at)
        .addTo(this.map)
      this.entries.set(item.id, { marker, signature })
    }
    for (const [id, entry] of this.entries) {
      if (keep.has(id)) continue
      entry.marker.remove()
      this.entries.delete(id)
    }
  }

  destroy() {
    for (const entry of this.entries.values()) entry.marker.remove()
    this.entries.clear()
  }
}

/** The live distance / area readout that follows the pointer while a shape is drawn or edited. */
class MeasureLabel {
  private marker: mapboxgl.Marker | null = null
  private node = el('div', styles.measure)
  private map: mapboxgl.Map

  constructor(map: mapboxgl.Map) {
    this.map = map
  }

  show(at: LngLat, parts: string[]) {
    if (parts.length === 0) return this.hide()
    this.node.textContent = parts.join(' · ')
    if (!this.marker) {
      this.marker = new mapboxgl.Marker({ element: this.node, anchor: 'bottom-left', offset: [14, -12] })
        .setLngLat(at)
        .addTo(this.map)
    } else this.marker.setLngLat(at)
  }

  hide() {
    this.marker?.remove()
    this.marker = null
  }
}

type DraftFeature = {
  type: 'Feature'
  properties: Record<string, string | boolean | number>
  geometry: AnnotationGeometry
}

/** Draft features for a shape: its outline, plus the arrowhead for arrows so the direction always shows. */
function shapeFeatures(
  map: mapboxgl.Map,
  tool: AnnotationTool,
  geometry: AnnotationGeometry,
  properties: Record<string, string | boolean> = {},
): DraftFeature[] {
  if (geometry.type === 'Point') return []
  const head = tool === 'arrow' && geometry.type === 'LineString' ? arrowHead(geometry.coordinates) : null
  if (!head) return [{ type: 'Feature', properties, geometry }]
  ensureArrowhead(map, typeof properties.color === 'string' ? properties.color : DRAFT_COLOR)
  return [
    { type: 'Feature', properties, geometry },
    {
      type: 'Feature',
      properties: { ...properties, kind: 'head', bearing: head.bearing },
      geometry: { type: 'Point', coordinates: head.tip },
    },
  ]
}

const vertex = (at: LngLat, properties: Record<string, string | boolean>): DraftFeature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: at },
})

const toLngLat = (value: mapboxgl.LngLat): LngLat => [value.lng, value.lat]

type SnapLayers = { columns: boolean; junctions: boolean }

function snapAt(map: mapboxgl.Map, point: mapboxgl.Point, layers: SnapLayers): { ref: FeatureRef; at: LngLat } | null {
  let best: { ref: FeatureRef; at: LngLat; distance: number } | null = null
  const consider = (list: [number, number, number][], layer: FeatureRef['layer']) => {
    list.forEach(([lng, lat], index) => {
      const projected = map.project([lng, lat])
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y)
      if (distance <= SNAP_PX && (!best || distance < best.distance)) best = { ref: { layer, index }, at: [lng, lat], distance }
    })
  }
  if (layers.junctions) consider(DEMO_JUNCTIONS, 'junctions')
  if (layers.columns) consider(DEMO_COLUMNS, 'columns')
  return best
}

/** Shift + drag is Mapbox's box zoom, which would swallow Shift-clicks (square rectangles) while drawing. */
function holdBoxZoom(map: mapboxgl.Map) {
  const enabled = map.boxZoom.isEnabled()
  map.boxZoom.disable()
  return {
    release: () => {
      if (enabled) map.boxZoom.enable()
    },
  }
}

const snapsTo = (tool: AnnotationTool) => tool === 'marker' || tool === 'line' || tool === 'arrow'

function pixelsBetween(map: mapboxgl.Map, a: LngLat, b: LngLat) {
  const pa = map.project(a)
  const pb = map.project(b)
  return Math.hypot(pa.x - pb.x, pa.y - pb.y)
}

/** A rectangle upright on screen from two opposite corners, stored as a geographic ring; `square` evens the sides. */
function rectangleRing(map: mapboxgl.Map, a: LngLat, b: LngLat, square: boolean): LngLat[] {
  const pa = map.project(a)
  const pb = map.project(b)
  let dx = pb.x - pa.x
  let dy = pb.y - pa.y
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  const corners: [number, number][] = [
    [pa.x, pa.y],
    [pa.x + dx, pa.y],
    [pa.x + dx, pa.y + dy],
    [pa.x, pa.y + dy],
  ]
  return closeRing(corners.map((corner) => toLngLat(map.unproject(corner))))
}

export type AnnotationDrawing = {
  finish: () => void
  undo: () => void
  cancel: () => void
  /** Removes listeners and the draft without reporting back. */
  destroy: () => void
}

type DrawingOptions = {
  snapLayers: SnapLayers
  onProgress: (points: number) => void
  onComplete: (shape: DrawnShape) => void
  onCancel: () => void
}

/** Starts an interactive drawing session for one tool on the map. */
export function startAnnotationDrawing(map: mapboxgl.Map, tool: AnnotationTool, options: DrawingOptions): AnnotationDrawing {
  const points: LngLat[] = []
  const snaps: (FeatureRef | null)[] = []
  let cursor: { at: LngLat; snapped: boolean; closing: boolean } | null = null
  let pointer: mapboxgl.Point | null = null
  let shift = false
  let done = false
  const canvas = map.getCanvas()
  const container = map.getContainer()
  const measure = new MeasureLabel(map)
  const zoomOnDoubleClick = map.doubleClickZoom.isEnabled()
  const boxZoom = holdBoxZoom(map)
  map.doubleClickZoom.disable()
  container.classList.add(styles.drawing)
  canvas.style.cursor = 'crosshair'

  /** The shape as it would be if the next click landed on the cursor. */
  const live = (): { geometry: AnnotationGeometry; circle?: AnnotationCircle } | null => {
    const path = cursor && !cursor.closing ? [...points, cursor.at] : points
    if ((tool === 'line' || tool === 'arrow') && path.length >= 2) return { geometry: { type: 'LineString', coordinates: path } }
    // A polygon stays an open path until the cursor reaches the first point to close it.
    if (tool === 'polygon') {
      if (cursor?.closing) return { geometry: { type: 'Polygon', coordinates: [closeRing(points)] } }
      if (path.length >= 2) return { geometry: { type: 'LineString', coordinates: path } }
    }
    if (tool === 'rectangle' && points.length === 1 && cursor) {
      return { geometry: { type: 'Polygon', coordinates: [rectangleRing(map, points[0], cursor.at, shift)] } }
    }
    if (tool === 'circle' && points.length === 1 && cursor) {
      const radiusM = distanceM(points[0], cursor.at)
      return { geometry: { type: 'Polygon', coordinates: [circleRing(points[0], radiusM)] }, circle: { center: points[0], radiusM } }
    }
    return null
  }

  const render = () => {
    const shape = live()
    const features: DraftFeature[] = shape ? shapeFeatures(map, tool, shape.geometry) : []
    if (tool === 'circle' && points.length === 1 && cursor) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [points[0], cursor.at] } })
    }
    points.forEach((point, index) => {
      const first = tool === 'polygon' && index === 0
      features.push(
        vertex(point, {
          role: first ? 'first' : 'vertex',
          active: first && Boolean(cursor?.closing),
          snapped: Boolean(snaps[index]),
        }),
      )
    })
    if (cursor && !cursor.closing) features.push(vertex(cursor.at, { role: 'cursor', snapped: cursor.snapped }))
    setSource(map, DRAFT_SOURCE, { type: 'FeatureCollection', features })
    if (cursor && shape) {
      const parts = shapeMeasurements(tool, shape.geometry, shape.circle)
      measure.show(cursor.at, cursor.closing ? ['Close shape', ...parts] : parts)
    } else measure.hide()
  }

  const track = (point: mapboxgl.Point, lngLat: LngLat) => {
    const closing =
      tool === 'polygon' && points.length >= 3 && pixelsBetween(map, points[0], lngLat) <= CLOSE_PX
    const snap = !closing && snapsTo(tool) ? snapAt(map, point, options.snapLayers) : null
    cursor = { at: closing ? points[0] : (snap?.at ?? lngLat), snapped: Boolean(snap), closing }
    return snap
  }

  const cleanup = () => {
    if (done) return
    done = true
    map.off('mousemove', onMove)
    map.off('click', onClick)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('keyup', onKeyUp, true)
    setSource(map, DRAFT_SOURCE, empty())
    measure.hide()
    container.classList.remove(styles.drawing)
    canvas.style.cursor = ''
    if (zoomOnDoubleClick) map.doubleClickZoom.enable()
    boxZoom.release()
  }

  const complete = (geometry: AnnotationGeometry, extra?: Pick<DrawnShape, 'circle'>) => {
    const refs = snaps.filter((ref): ref is FeatureRef => ref !== null)
    const unique = refs.filter((ref, index) => refs.findIndex((other) => other.layer === ref.layer && other.index === ref.index) === index)
    cleanup()
    options.onComplete({ tool, geometry, snaps: unique, ...extra })
  }

  const finish = () => {
    if (done || points.length < minimumPoints(tool)) return
    if (tool === 'polygon') complete({ type: 'Polygon', coordinates: [closeRing(points)] })
    else if (tool === 'line' || tool === 'arrow') complete({ type: 'LineString', coordinates: [...points] })
  }

  const undo = () => {
    if (done || points.length === 0) return
    points.pop()
    snaps.pop()
    options.onProgress(points.length)
    if (pointer) track(pointer, toLngLat(map.unproject(pointer)))
    render()
  }

  const cancel = () => {
    if (done) return
    cleanup()
    options.onCancel()
  }

  function onMove(event: mapboxgl.MapMouseEvent) {
    pointer = event.point
    shift = event.originalEvent.shiftKey
    track(event.point, toLngLat(event.lngLat))
    render()
  }

  function onClick(event: mapboxgl.MapMouseEvent) {
    shift = event.originalEvent.shiftKey
    const snap = track(event.point, toLngLat(event.lngLat))
    const at = cursor?.at ?? toLngLat(event.lngLat)
    if (tool === 'marker') {
      snaps.push(snap?.ref ?? null)
      complete({ type: 'Point', coordinates: at })
      return
    }
    if (tool === 'rectangle' || tool === 'circle') {
      if (points.length === 0) {
        points.push(at)
        snaps.push(null)
        options.onProgress(1)
        render()
        return
      }
      if (pixelsBetween(map, points[0], at) < CLOSE_PX) return
      if (tool === 'rectangle') complete({ type: 'Polygon', coordinates: [rectangleRing(map, points[0], at, shift)] })
      else {
        const radiusM = distanceM(points[0], at)
        complete({ type: 'Polygon', coordinates: [circleRing(points[0], radiusM)] }, { circle: { center: points[0], radiusM } })
      }
      return
    }
    if (cursor?.closing) return finish()
    const last = points[points.length - 1]
    if (tool !== 'polygon' && last && pixelsBetween(map, last, at) <= CLOSE_PX) return finish()
    points.push(at)
    snaps.push(snap?.ref ?? null)
    options.onProgress(points.length)
    render()
  }

  function onKey(event: KeyboardEvent) {
    const { target } = event
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'Shift') {
      shift = true
      render()
    } else if (event.key === 'Escape') {
      event.stopImmediatePropagation()
      cancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      finish()
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      undo()
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key !== 'Shift') return
    shift = false
    render()
  }

  map.on('mousemove', onMove)
  map.on('click', onClick)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keyup', onKeyUp, true)
  options.onProgress(0)
  return { finish, undo, cancel, destroy: cleanup }
}

export type AnnotationEditing = { destroy: () => void }

type EditingOptions = {
  snapLayers: SnapLayers
  /** Called after each drag with the reshaped annotation. */
  onChange: (shape: DrawnShape) => void
}

type Vec = { x: number; y: number }

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k })
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y
const unit = (a: Vec, fallback: Vec): Vec => {
  const length = Math.hypot(a.x, a.y)
  return length < 1e-6 ? fallback : scale(a, 1 / length)
}

/**
 * Reshapes an existing annotation by dragging its anchor points: vertices for markers, lines, arrows and polygons;
 * corners for rectangles (the opposite corner stays put, Shift keeps it square); centre and radius for circles.
 */
export function startAnnotationEditing(map: mapboxgl.Map, item: MapAnnotationItem, options: EditingOptions): AnnotationEditing {
  const { tool } = item
  let geometry: AnnotationGeometry = structuredClone(item.geometry)
  let circle: AnnotationCircle | undefined = item.circle ? { ...item.circle } : undefined
  let snaps: FeatureRef[] = item.context.anchor === 'feature' ? item.context.features.map(({ layer, index }) => ({ layer, index })) : []
  /** Unit direction (local metres) of the circle's radius handle from its centre. */
  let radiusDir: Vec = { x: 1, y: 0 }
  let dragging: number | null = null
  let hovering: number | null = null
  let shift = false
  const canvas = map.getCanvas()
  const container = map.getContainer()
  const measure = new MeasureLabel(map)
  const boxZoom = holdBoxZoom(map)
  container.classList.add(styles.drawing)

  const handles = (): LngLat[] => {
    if (geometry.type === 'Point') return [geometry.coordinates]
    if (geometry.type === 'LineString') return geometry.coordinates
    if (tool === 'circle' && circle) {
      return [circle.center, fromLocal(circle.center, radiusDir.x * circle.radiusM, radiusDir.y * circle.radiusM)]
    }
    return geometry.coordinates[0].slice(0, -1)
  }

  const render = () => {
    const features = shapeFeatures(map, tool, geometry, { color: item.style.color, solid: true })
    handles().forEach((at, index) =>
      features.push(vertex(at, { role: 'handle', active: index === dragging || index === hovering, color: item.style.color })),
    )
    setSource(map, DRAFT_SOURCE, { type: 'FeatureCollection', features })
  }

  const handleAt = (point: mapboxgl.Point) => {
    let best: { index: number; distance: number } | null = null
    handles().forEach((at, index) => {
      const projected = map.project(at)
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y)
      if (distance <= HANDLE_PX && (!best || distance < best.distance)) best = { index, distance }
    })
    return (best as { index: number } | null)?.index ?? null
  }

  const moveRectangleCorner = (index: number, at: LngLat) => {
    const ring = (geometry as { coordinates: LngLat[][] }).coordinates[0]
    const corners = ring.slice(0, 4).map((corner) => map.project(corner))
    const opposite = (index + 2) % 4
    const origin = corners[opposite]
    const u = unit(sub(corners[(opposite + 1) % 4], origin), { x: 1, y: 0 })
    const v = unit(sub(corners[(opposite + 3) % 4], origin), { x: -u.y, y: u.x })
    const offset = sub(map.project(at), origin)
    let a = dot(offset, u)
    let b = dot(offset, v)
    if (shift) {
      const side = Math.max(Math.abs(a), Math.abs(b))
      a = Math.sign(a || 1) * side
      b = Math.sign(b || 1) * side
    }
    const next: Vec[] = []
    next[opposite] = origin
    next[(opposite + 1) % 4] = add(origin, scale(u, a))
    next[index] = add(origin, add(scale(u, a), scale(v, b)))
    next[(opposite + 3) % 4] = add(origin, scale(v, b))
    geometry = { type: 'Polygon', coordinates: [closeRing(next.map((corner) => toLngLat(map.unproject([corner.x, corner.y]))))] }
  }

  const move = (index: number, point: mapboxgl.Point, at: LngLat) => {
    const snap = snapsTo(tool) ? snapAt(map, point, options.snapLayers) : null
    const target = snap?.at ?? at
    if (geometry.type === 'Point') {
      geometry = { type: 'Point', coordinates: target }
      snaps = snap ? [snap.ref] : []
    } else if (geometry.type === 'LineString') {
      geometry = { type: 'LineString', coordinates: geometry.coordinates.map((point, i) => (i === index ? target : point)) }
    } else if (tool === 'circle' && circle) {
      if (index === 0) circle = { ...circle, center: at }
      else {
        const local = toLocal(circle.center, at)
        const radiusM = Math.max(1, Math.hypot(local.x, local.y))
        radiusDir = unit(local, radiusDir)
        circle = { ...circle, radiusM }
      }
      geometry = { type: 'Polygon', coordinates: [circleRing(circle.center, circle.radiusM)] }
    } else if (tool === 'rectangle') {
      moveRectangleCorner(index, at)
    } else {
      const ring = geometry.coordinates[0].slice(0, -1).map((point, i) => (i === index ? at : point))
      geometry = { type: 'Polygon', coordinates: [closeRing(ring)] }
    }
  }

  const shape = (): DrawnShape => ({ tool, geometry, circle, snaps })

  function onDown(event: mapboxgl.MapMouseEvent) {
    const index = handleAt(event.point)
    if (index === null) return
    event.preventDefault()
    dragging = index
    canvas.style.cursor = 'grabbing'
    render()
  }

  function onMove(event: mapboxgl.MapMouseEvent) {
    shift = event.originalEvent.shiftKey
    if (dragging === null) {
      const next = handleAt(event.point)
      canvas.style.cursor = next === null ? '' : 'grab'
      if (next !== hovering) {
        hovering = next
        render()
      }
      return
    }
    const at = toLngLat(event.lngLat)
    move(dragging, event.point, at)
    render()
    measure.show(handles()[dragging] ?? at, shapeMeasurements(tool, geometry, circle))
  }

  function onUp() {
    if (dragging === null) return
    dragging = null
    canvas.style.cursor = hovering === null ? '' : 'grab'
    measure.hide()
    render()
    options.onChange(shape())
  }

  map.on('mousedown', onDown)
  map.on('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  render()

  return {
    destroy: () => {
      map.off('mousedown', onDown)
      map.off('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSource(map, DRAFT_SOURCE, empty())
      measure.hide()
      container.classList.remove(styles.drawing)
      canvas.style.cursor = ''
      boxZoom.release()
    },
  }
}
