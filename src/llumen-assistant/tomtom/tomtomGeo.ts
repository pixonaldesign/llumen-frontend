/** Small geometry helpers for the TomTom demo maps: deterministic scatter, points along streets, catchment outlines. */
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

/** `count` points around `center`, denser near the middle, the same for the same seed. */
export function scatter(center: LngLat, count: number, radiusKm: number, seed: number): LngLat[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = hash(index, seed) * Math.PI * 2
    const distance = radiusKm * Math.sqrt(hash(index, seed + 1)) * (0.25 + 0.75 * hash(index, seed + 2))
    return offsetKm(center, Math.cos(angle) * distance, Math.sin(angle) * distance)
  })
}

export function distanceKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const dx = (lng2 - lng1) * kmPerDegLng((lat1 + lat2) / 2)
  const dy = (lat2 - lat1) * KM_PER_DEG_LAT
  return Math.hypot(dx, dy)
}

function cumulative(path: LngLat[]) {
  const lengths = [0]
  for (let index = 1; index < path.length; index += 1) {
    lengths.push(lengths[index - 1] + distanceKm(path[index - 1], path[index]))
  }
  return lengths
}

/** The point `t` (0–1) of the way along `path` by length, nudged `sideKm` to its right. */
export function along(path: LngLat[], t: number, sideKm = 0): LngLat {
  const lengths = cumulative(path)
  const target = Math.max(0, Math.min(1, t)) * lengths[lengths.length - 1]
  let index = 1
  while (index < path.length - 1 && lengths[index] < target) index += 1
  const a = path[index - 1]
  const b = path[index]
  const span = lengths[index] - lengths[index - 1] || 1
  const f = (target - lengths[index - 1]) / span
  const point: LngLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  if (!sideKm) return point
  const east = (b[0] - a[0]) * kmPerDegLng(a[1])
  const north = (b[1] - a[1]) * KM_PER_DEG_LAT
  const norm = Math.hypot(east, north) || 1
  return offsetKm(point, (north / norm) * sideKm, (-east / norm) * sideKm)
}

/** The stretch of `path` between `from` and `to` (0–1 by length); reversed when `from` is past `to`. */
export function slice(path: LngLat[], from: number, to: number): LngLat[] {
  if (from > to) return slice(path, to, from).reverse()
  const lengths = cumulative(path)
  const total = lengths[lengths.length - 1]
  const inner = path.filter((_, index) => lengths[index] > from * total && lengths[index] < to * total)
  return [along(path, from), ...inner, along(path, to)]
}

/** `path` moved `sideKm` to its right, vertex by vertex: one carriageway of a two-way street. */
export function shift(path: LngLat[], sideKm: number): LngLat[] {
  return path.map((point, index) => {
    const a = path[Math.max(0, index - 1)]
    const b = path[Math.min(path.length - 1, index + 1)]
    const east = (b[0] - a[0]) * kmPerDegLng(a[1])
    const north = (b[1] - a[1]) * KM_PER_DEG_LAT
    const norm = Math.hypot(east, north) || 1
    return offsetKm(point, (north / norm) * sideKm, (-east / norm) * sideKm)
  })
}

/**
 * A drive-time outline around `center`: a closed ring `radiusKm` out on average, reaching further along
 * `stretch` (degrees, the main road's heading) the way a catchment follows its arterials.
 */
export function catchment(center: LngLat, radiusKm: number, seed: number, stretch = 0, points = 40): LngLat[] {
  const heading = (stretch * Math.PI) / 180
  const ring = Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2
    const reach = 1 + 0.38 * Math.cos(2 * (angle - heading))
    const wobble = 0.86 + 0.28 * hash(index, seed) * (0.6 + 0.4 * Math.sin(angle * 3 + seed))
    const r = radiusKm * reach * wobble
    return offsetKm(center, Math.sin(angle) * r, Math.cos(angle) * r)
  })
  const smooth = ring.map((point, index): LngLat => {
    const prev = ring[(index + points - 1) % points]
    const next = ring[(index + 1) % points]
    return [(prev[0] + 2 * point[0] + next[0]) / 4, (prev[1] + 2 * point[1] + next[1]) / 4]
  })
  return [...smooth, smooth[0]]
}
