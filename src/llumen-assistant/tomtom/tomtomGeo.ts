/** Small geometry helpers for the real-tomtom demo maps: deterministic scatter around a point. */
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
