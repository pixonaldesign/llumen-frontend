/**
 * User map annotations: geographic markup that belongs to the story's map instance. Geometry is stored as
 * GeoJSON in lng/lat (a rectangle is a polygon ring, a circle keeps its centre and radius beside the generated
 * ring), and each annotation records the data it was drawn against so it can be re-checked when that data changes.
 * Annotations never change the map layer assets underneath them.
 */
import { pointInPolygon } from './storyAiScenarios'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'

export type LngLat = [number, number]

export type AnnotationTool = 'marker' | 'line' | 'arrow' | 'polygon' | 'rectangle' | 'circle'

export type AnnotationToolOption = {
  id: AnnotationTool
  label: string
  description: string
  hint: string
}

export const ANNOTATION_TOOLS: AnnotationToolOption[] = [
  {
    id: 'marker',
    label: 'Marker',
    description: 'Marks a geographic point.',
    hint: 'Click the map to place the marker. Click a column or junction to pin it to that feature.',
  },
  {
    id: 'line',
    label: 'Line',
    description: 'Connects geographic points.',
    hint: 'Click to add points. Click the last point again or press Enter to finish.',
  },
  {
    id: 'arrow',
    label: 'Arrow',
    description: 'Draws a directional line between geographic points.',
    hint: 'Click to add points; the arrow points to the last one. Click it again or press Enter to finish.',
  },
  {
    id: 'polygon',
    label: 'Polygon',
    description: 'Highlights an arbitrary geographic area.',
    hint: 'Click to add corners. Connect the last corner to the first one to close the area.',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Highlights a rectangular geographic area.',
    hint: 'Click one corner, then click the opposite corner. Hold Shift for a square.',
  },
  {
    id: 'circle',
    label: 'Circle',
    description: 'Highlights an area around a geographic point.',
    hint: 'Click the centre, then click again to set the radius.',
  },
]

export function annotationTool(id: AnnotationTool) {
  return ANNOTATION_TOOLS.find((tool) => tool.id === id) ?? ANNOTATION_TOOLS[0]
}

/** Points need at least this many clicks before Enter or "Finish" completes them. */
export function minimumPoints(tool: AnnotationTool) {
  return tool === 'polygon' ? 3 : tool === 'line' || tool === 'arrow' ? 2 : 1
}

export type AnnotationStyle = {
  color: string
  /** Shown as a tooltip above markers, or in a pill at the centre of other shapes. */
  text: string
}

export const DEFAULT_ANNOTATION_COLOR = '#70aeff'

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = { color: DEFAULT_ANNOTATION_COLOR, text: '' }

export type AnnotationGeometry =
  | { type: 'Point'; coordinates: LngLat }
  | { type: 'LineString'; coordinates: LngLat[] }
  | { type: 'Polygon'; coordinates: LngLat[][] }

export type AnnotationCircle = { center: LngLat; radiusM: number }

export type FeatureLayer = 'columns' | 'junctions'

export type FeatureRef = { layer: FeatureLayer; index: number }

/** A referenced feature with the value it showed when the annotation was drawn. */
export type FeatureSnapshot = FeatureRef & { value: number }

export type AnnotationDataContext = {
  /** Feature-anchored annotations follow one data feature; geometry-anchored ones refer to a place. */
  anchor: 'feature' | 'geometry'
  slideIndex: number
  /** Human-readable data state, e.g. "Slide 1 · 2025–2026". */
  dataLabel: string
  features: FeatureSnapshot[]
}

export type MapAnnotationItem = {
  id: string
  tool: AnnotationTool
  name: string
  geometry: AnnotationGeometry
  circle?: AnnotationCircle
  style: AnnotationStyle
  visible: boolean
  /** Layer opacity, 0–1; applies to the whole annotation including its label. */
  opacity: number
  context: AnnotationDataContext
}

/** What the drawing tool hands back; snaps are the features a point was dropped on. */
export type DrawnShape = {
  tool: AnnotationTool
  geometry: AnnotationGeometry
  circle?: AnnotationCircle
  snaps: FeatureRef[]
}

/** The map data an annotation is checked against. */
export type AnnotationData = {
  slideIndex: number
  heights: number[]
  radii: number[]
  layers: { junctions: boolean; distribution: boolean }
}

export type AnnotationValidityState = 'valid' | 'changed' | 'invalid'

export type AnnotationValidity = { state: AnnotationValidityState; detail: string }

/** Average change in the referenced features' values above which the data counts as materially changed. */
const CHANGED_RATIO = 0.25
const EARTH_RADIUS_M = 6371008.8
const CIRCLE_STEPS = 72

const LAYER_LABELS: Record<FeatureLayer, string> = { columns: 'Value Distribution', junctions: 'Monitored Junctions' }

const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceM(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Closed ring approximating a circle on the ground. */
export function circleRing(center: LngLat, radiusM: number): LngLat[] {
  const latScale = 180 / (Math.PI * EARTH_RADIUS_M)
  const lngScale = latScale / Math.max(0.01, Math.cos(rad(center[1])))
  const ring: LngLat[] = []
  for (let step = 0; step <= CIRCLE_STEPS; step += 1) {
    const angle = (step / CIRCLE_STEPS) * Math.PI * 2
    ring.push([center[0] + Math.sin(angle) * radiusM * lngScale, center[1] + Math.cos(angle) * radiusM * latScale])
  }
  return ring
}

export function closeRing(points: LngLat[]): LngLat[] {
  const [first] = points
  const last = points[points.length - 1]
  return first && last && (first[0] !== last[0] || first[1] !== last[1]) ? [...points, first] : points
}

function ringCentroid(ring: LngLat[]): LngLat {
  let area = 0
  let x = 0
  let y = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    area += cross
    x += (ring[j][0] + ring[i][0]) * cross
    y += (ring[j][1] + ring[i][1]) * cross
  }
  if (Math.abs(area) < 1e-12) {
    const sum = ring.reduce<LngLat>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
    return [sum[0] / ring.length, sum[1] / ring.length]
  }
  return [x / (3 * area), y / (3 * area)]
}

function alongLine(points: LngLat[], fraction: number): LngLat {
  const lengths = points.slice(1).map((point, index) => distanceM(points[index], point))
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const t = lengths[index] === 0 ? 0 : Math.min(1, remaining / lengths[index])
      const [a, b] = [points[index], points[index + 1]]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    remaining -= lengths[index]
  }
  return points[0]
}

/** Where an annotation's text sits: on a marker, halfway along a line, or at the centre of an area. */
export function labelAnchor(item: Pick<MapAnnotationItem, 'geometry' | 'circle'>): LngLat {
  const { geometry } = item
  if (geometry.type === 'Point') return geometry.coordinates
  if (geometry.type === 'LineString') return alongLine(geometry.coordinates, 0.5)
  return item.circle?.center ?? ringCentroid(geometry.coordinates[0].slice(0, -1))
}

function featureCoordinates(ref: FeatureRef): LngLat {
  const [lng, lat] = ref.layer === 'columns' ? DEMO_COLUMNS[ref.index] : DEMO_JUNCTIONS[ref.index]
  return [lng, lat]
}

export function featureLabel(ref: FeatureRef) {
  const id = String(ref.index + 1).padStart(3, '0')
  return ref.layer === 'columns' ? `Column C-${id}` : `Junction J-${id}`
}

function featureValue(ref: FeatureRef, data: AnnotationData) {
  return (ref.layer === 'columns' ? data.heights[ref.index] : data.radii[ref.index]) ?? 0
}

function layerVisible(layer: FeatureLayer, data: AnnotationData) {
  return layer === 'columns' ? data.layers.distribution : data.layers.junctions
}

function snapshot(ref: FeatureRef, data: AnnotationData): FeatureSnapshot {
  return { ...ref, value: featureValue(ref, data) }
}

/** Visible features inside an area, from the layers that are switched on. */
function featuresInside(ring: LngLat[], data: AnnotationData): FeatureRef[] {
  const inside = (points: [number, number, number][], layer: FeatureLayer) =>
    layerVisible(layer, data)
      ? points.flatMap(([lng, lat], index): FeatureRef[] => (pointInPolygon([lng, lat], ring) ? [{ layer, index }] : []))
      : []
  return [...inside(DEMO_COLUMNS, 'columns'), ...inside(DEMO_JUNCTIONS, 'junctions')]
}

export function annotationContext(shape: DrawnShape, data: AnnotationData, dataLabel: string): AnnotationDataContext {
  const { geometry } = shape
  const refs = geometry.type === 'Polygon' ? featuresInside(geometry.coordinates[0], data) : shape.snaps
  return {
    anchor: geometry.type === 'Point' && shape.snaps.length > 0 ? 'feature' : 'geometry',
    slideIndex: data.slideIndex,
    dataLabel,
    features: refs.map((ref) => snapshot(ref, data)),
  }
}

/** Builds the annotation for a finished drawing; a feature-anchored marker sits exactly on its feature. */
export function createAnnotation(
  shape: DrawnShape,
  existing: MapAnnotationItem[],
  data: AnnotationData,
  dataLabel: string,
  color = DEFAULT_ANNOTATION_COLOR,
): MapAnnotationItem {
  const tool = annotationTool(shape.tool)
  const count = existing.filter((item) => item.tool === shape.tool).length
  const geometry: AnnotationGeometry =
    shape.geometry.type === 'Point' && shape.snaps[0]
      ? { type: 'Point', coordinates: featureCoordinates(shape.snaps[0]) }
      : shape.geometry
  return {
    id: `annotation-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    tool: shape.tool,
    name: `${tool.label} ${count + 1}`,
    geometry,
    circle: shape.circle,
    style: { ...DEFAULT_ANNOTATION_STYLE, color },
    visible: true,
    opacity: 1,
    context: annotationContext({ ...shape, geometry }, data, dataLabel),
  }
}

/** Swaps in an edited shape, keeping the annotation's identity, style and layer settings. */
export function reshapeAnnotation(
  item: MapAnnotationItem,
  shape: DrawnShape,
  data: AnnotationData,
  dataLabel: string,
): MapAnnotationItem {
  const fresh = createAnnotation(shape, [], data, dataLabel, item.style.color)
  return { ...item, geometry: fresh.geometry, circle: fresh.circle, context: fresh.context }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function contextSummary(context: AnnotationDataContext) {
  const { features } = context
  if (features.length === 0) return 'A place on the map, not tied to data'
  if (context.anchor === 'feature') return featureLabel(features[0])
  const columns = features.filter((ref) => ref.layer === 'columns').length
  const junctions = features.length - columns
  return [columns ? plural(columns, 'column') : '', junctions ? plural(junctions, 'junction') : '']
    .filter(Boolean)
    .join(', ')
}

/**
 * Re-checks the data relationship only: whether the referenced features are still shown and still read about the
 * same. Whether the annotation's own wording is still true is out of scope.
 */
export function annotationValidity(item: MapAnnotationItem, data: AnnotationData): AnnotationValidity {
  const { features, anchor, dataLabel } = item.context
  if (features.length === 0) return { state: 'valid', detail: 'Refers to a place only, so data changes don’t affect it.' }
  const hidden = features.filter((ref) => !layerVisible(ref.layer, data))
  if (hidden.length === features.length || (anchor === 'feature' && hidden.length > 0)) {
    const layers = [...new Set(hidden.map((ref) => LAYER_LABELS[ref.layer]))]
    const several = layers.length > 1
    return {
      state: 'invalid',
      detail: `The ${layers.join(' and ')} layer${several ? 's' : ''} it refers to ${several ? 'are' : 'is'} hidden, so it no longer applies.`,
    }
  }
  const shown = features.filter((ref) => layerVisible(ref.layer, data))
  const drift =
    shown.reduce((sum, ref) => sum + Math.abs(featureValue(ref, data) - ref.value) / Math.max(1, ref.value), 0) /
    shown.length
  if (hidden.length > 0) {
    return {
      state: 'changed',
      detail: `${hidden.length} of ${plural(features.length, 'referenced feature')} ${hidden.length === 1 ? 'is' : 'are'} hidden now.`,
    }
  }
  if (drift > CHANGED_RATIO) {
    return {
      state: 'changed',
      detail: `The referenced data moved ${Math.round(drift * 100)}% on average since ${dataLabel}. Review it.`,
    }
  }
  return {
    state: 'valid',
    detail:
      anchor === 'feature'
        ? `${featureLabel(features[0])} is still on the map.`
        : `${plural(features.length, 'referenced feature')} still ${features.length === 1 ? 'matches' : 'match'} ${dataLabel}.`,
  }
}

const M_PER_DEG = (Math.PI * EARTH_RADIUS_M) / 180

/** Metres east and north of `origin`; accurate enough at annotation scale. */
export function toLocal(origin: LngLat, [lng, lat]: LngLat) {
  return { x: (lng - origin[0]) * M_PER_DEG * Math.cos(rad(origin[1])), y: (lat - origin[1]) * M_PER_DEG }
}

export function fromLocal(origin: LngLat, x: number, y: number): LngLat {
  return [origin[0] + x / (M_PER_DEG * Math.cos(rad(origin[1]))), origin[1] + y / M_PER_DEG]
}

export function pathLengthM(points: LngLat[]) {
  return points.slice(1).reduce((sum, point, index) => sum + distanceM(points[index], point), 0)
}

export function ringAreaM2(ring: LngLat[]) {
  if (ring.length < 3) return 0
  const origin = ring[0]
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = toLocal(origin, ring[j])
    const b = toLocal(origin, ring[i])
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

const kmValue = (km: number) => (km < 10 ? km.toFixed(2) : km.toFixed(1))

export function formatKm(meters: number) {
  return `${kmValue(meters / 1000)} km`
}

export function formatKm2(squareMeters: number) {
  const km2 = squareMeters / 1e6
  return `${km2 < 0.1 ? km2.toFixed(3) : kmValue(km2)} km²`
}

/** Distance and, for closed shapes, area, e.g. "1.20 × 0.80 km · 0.960 km²". Empty for markers. */
export function shapeMeasurements(
  tool: AnnotationTool,
  geometry: AnnotationGeometry,
  circle?: AnnotationCircle,
): string[] {
  if (geometry.type === 'Point') return []
  if (geometry.type === 'LineString') return [formatKm(pathLengthM(geometry.coordinates))]
  const ring = geometry.coordinates[0]
  if (tool === 'circle' && circle) {
    return [`r ${formatKm(circle.radiusM)}`, formatKm2(Math.PI * circle.radiusM ** 2)]
  }
  if (tool === 'rectangle' && ring.length >= 4) {
    const width = distanceM(ring[0], ring[1])
    const height = distanceM(ring[1], ring[2])
    return [`${kmValue(width / 1000)} × ${formatKm(height)}`, formatKm2(ringAreaM2(ring))]
  }
  return [formatKm(pathLengthM(closeRing(ring))), formatKm2(ringAreaM2(ring))]
}

/** Where the arrowhead sits and which way it points, in degrees clockwise from north. */
export function arrowHead(points: LngLat[]): { tip: LngLat; bearing: number } | null {
  if (points.length < 2) return null
  const tip = points[points.length - 1]
  const back = toLocal(tip, points[points.length - 2])
  if (Math.hypot(back.x, back.y) < 1) return null
  return { tip, bearing: (Math.atan2(-back.x, -back.y) * 180) / Math.PI }
}

/** The AI chat's picked-area walls are 320 m tall; annotations reach that height once they span a few km. */
const WALL_MIN_M = 80
const WALL_MAX_M = 320

/** Wall height scales with the shape so small areas don't turn into towers. */
function wallHeightM(points: LngLat[]) {
  const lngs = points.map(([lng]) => lng)
  const lats = points.map(([, lat]) => lat)
  const span = distanceM([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)])
  return Math.max(WALL_MIN_M, Math.min(WALL_MAX_M, span * 0.1))
}

export type AnnotationFeatureKind = 'line' | 'area' | 'head'

type AnnotationFeature = {
  type: 'Feature'
  properties: {
    id: string
    kind: AnnotationFeatureKind
    color: string
    alpha: number
    selected: boolean
    wall: number
    bearing?: number
  }
  geometry: AnnotationGeometry
}

/**
 * GeoJSON for the ground outlines and the stacked 3D walls. List order is draw order from the top, so the
 * collection runs bottom-up. Markers stay flat DOM dots, so they have no features here; arrowheads are points
 * drawn as a fixed-size icon.
 */
export function annotationCollection(
  items: MapAnnotationItem[],
  selectedId: string | null,
  validity: Record<string, AnnotationValidity>,
) {
  const features: AnnotationFeature[] = []
  for (const item of [...items].reverse()) {
    const { geometry } = item
    if (!item.visible || geometry.type === 'Point') continue
    const base = {
      id: item.id,
      color: item.style.color,
      alpha: item.opacity * (validity[item.id]?.state === 'invalid' ? 0.4 : 1),
      selected: item.id === selectedId,
      wall: wallHeightM(geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates),
    }
    if (geometry.type === 'Polygon') {
      features.push({ type: 'Feature', properties: { ...base, kind: 'area' }, geometry })
      continue
    }
    features.push({ type: 'Feature', properties: { ...base, kind: 'line' }, geometry })
    const head = item.tool === 'arrow' ? arrowHead(geometry.coordinates) : null
    if (head) {
      features.push({
        type: 'Feature',
        properties: { ...base, kind: 'head', bearing: head.bearing },
        geometry: { type: 'Point', coordinates: head.tip },
      })
    }
  }
  return { type: 'FeatureCollection' as const, features }
}
