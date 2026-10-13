/**
 * Snaps an area outline to the street network: the outline is walked as a route through the
 * Mapbox Directions API, so its edges follow real roads instead of the shape that was drawn.
 */

type Ring = [number, number][]

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
/** Directions accepts 25 coordinates; one is spent closing the loop. */
const MAX_WAYPOINTS = 24
/** Waypoints are spread along the outline about this far apart, so the route hugs each edge. */
const WAYPOINT_SPACING_M = 320
/** Route points closer than this count as the same street node when removing dead-end spurs. */
const SAME_NODE_M = 3

const cache = new Map<string, Promise<Ring>>()

function metres(a: [number, number], b: [number, number]) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  return Math.hypot((a[0] - b[0]) * 111320 * Math.cos(lat), (a[1] - b[1]) * 110540)
}

/** Points spaced evenly along the closed outline, always keeping its corners when there is room. */
function waypoints(ring: Ring): Ring {
  const edges = ring.map((point, index) => [point, ring[(index + 1) % ring.length]] as const)
  const perimeter = edges.reduce((sum, [a, b]) => sum + metres(a, b), 0)
  const spacing = Math.max(WAYPOINT_SPACING_M, perimeter / MAX_WAYPOINTS)
  const out: Ring = []
  for (const [a, b] of edges) {
    if (ring.length <= MAX_WAYPOINTS / 2) out.push(a)
    const steps = Math.floor(metres(a, b) / spacing)
    for (let step = 1; step <= steps; step += 1) {
      const t = step / (steps + 1)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  if (out.length <= MAX_WAYPOINTS) return out.length >= 3 ? out : ring.slice(0, MAX_WAYPOINTS)
  return Array.from({ length: MAX_WAYPOINTS }, (_, index) => out[Math.floor((index * out.length) / MAX_WAYPOINTS)])
}

/** Drops the out-and-back legs a route takes when a waypoint snaps onto a side street. */
function withoutSpurs(path: Ring): Ring {
  const out: Ring = []
  for (const point of path) {
    if (out.length > 0 && metres(out[out.length - 1], point) < SAME_NODE_M) continue
    if (out.length >= 2 && metres(out[out.length - 2], point) < SAME_NODE_M) {
      out.pop()
      continue
    }
    out.push(point)
  }
  if (out.length > 1 && metres(out[0], out[out.length - 1]) < SAME_NODE_M) out.pop()
  while (out.length > 3 && metres(out[1], out[out.length - 1]) < SAME_NODE_M) {
    out.shift()
    out.pop()
  }
  return out
}

async function requestTrace(ring: Ring): Promise<Ring> {
  if (!MAPBOX_TOKEN || ring.length < 3) return ring
  const stops = waypoints(ring)
  const coordinates = [...stops, stops[0]].map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';')
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
  const response = await fetch(url)
  if (!response.ok) return ring
  const body = (await response.json()) as { routes?: { geometry?: { coordinates?: Ring } }[] }
  const traced = withoutSpurs(body.routes?.[0]?.geometry?.coordinates ?? [])
  return traced.length >= 3 ? traced : ring
}

/** The outline traced along the streets; falls back to the outline itself when routing fails. */
export function traceStreets(ring: Ring): Promise<Ring> {
  const key = ring.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';')
  let pending = cache.get(key)
  if (!pending) {
    pending = requestTrace(ring).catch(() => ring)
    cache.set(key, pending)
  }
  return pending
}
