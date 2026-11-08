/** Shapes for the Dubai Municipality maps: odor plumes, hexagonal community cells, wind arrows, tanks. */
import { offsetKm, type LngLat } from '../realEstate/estateGeo'

const KM_PER_DEG_LAT = 110.8
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180)
const rad = (deg: number) => (deg * Math.PI) / 180

/** A plume modelled downwind of a source: `bearing` is where the wind carries it, clockwise from north. */
export type Plume = { source: LngLat; bearing: number; lengthKm: number; widthKm: number }

/** How far the plume reaches behind its source, so it rounds over the source instead of starting on a point. */
const BACK_KM = 0.06

/** The plume's half-width `along` km downwind of the source, or -1 outside its length. */
function halfWidth(plume: Plume, along: number) {
  if (along < -BACK_KM || along > plume.lengthKm) return -1
  const t = (along + BACK_KM) / (plume.lengthKm + BACK_KM)
  return plume.widthKm * Math.sin(Math.PI * t) ** 0.7 * (0.3 + 0.7 * t)
}

/** `point` in the plume's frame: km downwind of the source, and km to its left (negative) or right. */
function plumeFrame(plume: Plume, [lng, lat]: LngLat): [number, number] {
  const east = (lng - plume.source[0]) * kmPerDegLng(plume.source[1])
  const north = (lat - plume.source[1]) * KM_PER_DEG_LAT
  const ux = Math.sin(rad(plume.bearing))
  const uy = Math.cos(rad(plume.bearing))
  return [east * ux + north * uy, east * uy - north * ux]
}

export function insidePlume(plume: Plume, point: LngLat) {
  const [along, across] = plumeFrame(plume, point)
  const half = halfWidth(plume, along)
  return half >= 0 && Math.abs(across) <= half
}

/** The plume's outline: a teardrop widening downwind and closing at its far end. */
export function plumeRing(plume: Plume, steps = 36): LngLat[] {
  const ux = Math.sin(rad(plume.bearing))
  const uy = Math.cos(rad(plume.bearing))
  const at = (along: number, across: number) =>
    offsetKm(plume.source, along * ux + across * uy, along * uy - across * ux)
  const side = Array.from({ length: steps + 1 }, (_, index) => {
    const along = -BACK_KM + ((plume.lengthKm + BACK_KM) * index) / steps
    return [along, Math.max(0, halfWidth(plume, along))] as const
  })
  return [...side.map(([along, half]) => at(along, half)), ...side.reverse().map(([along, half]) => at(along, -half))]
}

/** The same plume, shortened and turned: how a what-if changes its reach and direction. */
export function shiftPlume(plume: Plume, scale: number, turn = 0): Plume {
  return { ...plume, bearing: plume.bearing + turn, lengthKm: plume.lengthKm * scale, widthKm: plume.widthKm * Math.sqrt(scale) }
}

/** A flat-topped hexagon `radiusKm` across from its centre to each corner. */
export function hexagon(center: LngLat, radiusKm: number): LngLat[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = rad(60 * index)
    return offsetKm(center, Math.cos(angle) * radiusKm, Math.sin(angle) * radiusKm)
  })
}

/** A round footprint, as a polygon: a tank, a treatment unit. */
export function circle(center: LngLat, radiusM: number, steps = 16): LngLat[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (2 * Math.PI * index) / steps
    return offsetKm(center, (Math.cos(angle) * radiusM) / 1000, (Math.sin(angle) * radiusM) / 1000)
  })
}

/** An arrow `lengthKm` long from `from`, pointing along `bearing`: its shaft and its open head. */
export function arrow(from: LngLat, bearing: number, lengthKm: number): { shaft: LngLat[]; head: LngLat[] } {
  const ux = Math.sin(rad(bearing))
  const uy = Math.cos(rad(bearing))
  const tip = offsetKm(from, ux * lengthKm, uy * lengthKm)
  const back = lengthKm * 0.22
  const wing = (side: 1 | -1) => {
    const angle = rad(bearing + 180 + side * 28)
    return offsetKm(tip, Math.sin(angle) * back, Math.cos(angle) * back)
  }
  return { shaft: [from, tip], head: [wing(1), tip, wing(-1)] }
}

/** The centre of a footprint's corners. */
export function centroid(ring: LngLat[]): LngLat {
  const sum = ring.reduce(([x, y], [lng, lat]) => [x + lng, y + lat], [0, 0])
  return [sum[0] / ring.length, sum[1] / ring.length]
}

/** The four corners of an axis-aligned box between two corners. */
export function box([west, south]: LngLat, [east, north]: LngLat): LngLat[] {
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ]
}

/** `point` moved `km` along `bearing`. */
export function toward(point: LngLat, bearing: number, km: number): LngLat {
  return offsetKm(point, Math.sin(rad(bearing)) * km, Math.cos(rad(bearing)) * km)
}
