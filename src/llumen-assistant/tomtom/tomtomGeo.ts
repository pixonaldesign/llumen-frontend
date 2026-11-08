/** Small geometry helpers for the TomTom demo maps: deterministic scatter and points along streets. */
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

/** `path` resampled every `stepKm` or so by length, ends included. */
export function resample(path: LngLat[], stepKm: number): LngLat[] {
  const lengths = cumulative(path)
  const count = Math.max(1, Math.ceil(lengths[lengths.length - 1] / stepKm))
  return Array.from({ length: count + 1 }, (_, index) => along(path, index / count))
}
