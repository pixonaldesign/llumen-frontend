/** Small geometry helpers for the GAMI demo maps: deterministic scatter, circles, arcs and outlines. */
export type LngLat = [number, number]

const KM_PER_DEG_LAT = 110.8

function kmPerDegLng(lat: number) {
  return 111.32 * Math.cos((lat * Math.PI) / 180)
}

export function hash(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Offsets a point by km east and north. */
export function offsetKm([lng, lat]: LngLat, eastKm: number, northKm: number): LngLat {
  return [lng + eastKm / kmPerDegLng(lat), lat + northKm / KM_PER_DEG_LAT]
}

export function distanceKm(a: LngLat, b: LngLat) {
  const lat = (a[1] + b[1]) / 2
  return Math.hypot((a[0] - b[0]) * kmPerDegLng(lat), (a[1] - b[1]) * KM_PER_DEG_LAT)
}

/** `count` points around `center`, denser near the middle, the same for the same seed. */
export function scatter(center: LngLat, count: number, radiusKm: number, seed: number): LngLat[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = hash(index, seed) * Math.PI * 2
    const distance = radiusKm * Math.sqrt(hash(index, seed + 1)) * (0.25 + 0.75 * hash(index, seed + 2))
    return offsetKm(center, Math.cos(angle) * distance, Math.sin(angle) * distance)
  })
}

export function circle(center: LngLat, radiusM: number, sides = 32): LngLat[] {
  const ring: LngLat[] = []
  for (let i = 0; i <= sides; i += 1) {
    const t = (i / sides) * Math.PI * 2
    ring.push(offsetKm(center, (Math.cos(t) * radiusM) / 1000, (Math.sin(t) * radiusM) / 1000))
  }
  return ring
}

/** A rounded outline around `center`, wobbling so it reads as drawn around an area rather than a circle. */
export function blob(
  center: LngLat,
  radiusKm: number,
  seed: number,
  stretch: [number, number] = [1, 1],
  /** Turns the stretched axes counter-clockwise from east. */
  rotateDeg = 0,
  sides = 28,
) {
  const ring: LngLat[] = []
  const r = (rotateDeg * Math.PI) / 180
  for (let i = 0; i < sides; i += 1) {
    const t = (i / sides) * Math.PI * 2
    const wobble = 0.9 + 0.14 * hash(i, seed) + 0.04 * Math.sin(t * 3 + seed)
    const x = Math.cos(t) * radiusKm * stretch[0] * wobble
    const y = Math.sin(t) * radiusKm * stretch[1] * wobble
    ring.push(offsetKm(center, x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)))
  }
  ring.push(ring[0])
  return ring
}

function toVector([lng, lat]: LngLat): [number, number, number] {
  const phi = (lat * Math.PI) / 180
  const lambda = (lng * Math.PI) / 180
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)]
}

function fromVector([x, y, z]: [number, number, number]): LngLat {
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI]
}

/** The great circle from `a` to `b` in `steps` segments. */
export function greatCircle(a: LngLat, b: LngLat, steps = 64): LngLat[] {
  const va = toVector(a)
  const vb = toVector(b)
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  const omega = Math.acos(dot)
  if (omega < 1e-6) return [a, b]
  const points: LngLat[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega)
    const s2 = Math.sin(t * omega) / Math.sin(omega)
    points.push(fromVector([va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2]))
  }
  return points
}

export function centroid(ring: LngLat[]): LngLat {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] ? ring.slice(0, -1) : ring
  const lng = pts.reduce((sum, [x]) => sum + x, 0) / pts.length
  const lat = pts.reduce((sum, [, y]) => sum + y, 0) / pts.length
  return [lng, lat]
}

export function insideRing([x, y]: LngLat, ring: LngLat[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
