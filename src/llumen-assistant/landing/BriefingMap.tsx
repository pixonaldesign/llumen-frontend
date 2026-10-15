/**
 * Briefing backdrop: the story map's value columns and junction disks, slowly orbiting
 * and flying to each map stop's place. Dragging, rotating or pinching pauses the orbit.
 */
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { STORY_MAP_STYLE } from '../story/StoryMap'
import { rampColor, rgbString } from '../story/storyDemoScenes'
import type { BriefingPlace } from './briefingMapPlaces'
import styles from './BriefingLanding.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const COLUMN_RADIUS_M = 36
const ORBIT_DEG_PER_S = 2.2
const RESUME_AFTER_MS = 2600
const FLY_MS = 2800
const SHRINK_MS = 700
const GROW_DELAY_MS = 1300
const GROW_MS = 1700
const MAX_PITCH = 85
/** Lifts the orbit centre so the tall columns rise above the centred greeting; top padding exposes the sky. */
const CAMERA_PADDING = { top: 0, right: 0, bottom: 220, left: 0 }

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at the demo latitude. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24.6 * Math.PI) / 180)

function metersToPixels(scale: number): mapboxgl.ExpressionSpecification {
  const base = ['/', ['*', ['get', 'radius'], scale], METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

function ring(lng: number, lat: number, radiusMeters: number, sides: number) {
  const dLat = radiusMeters / 111320
  const dLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  const coords: [number, number][] = []
  for (let i = 0; i <= sides; i += 1) {
    const t = (i / sides) * Math.PI * 2
    coords.push([lng + Math.cos(t) * dLng, lat + Math.sin(t) * dLat])
  }
  return { type: 'Polygon' as const, coordinates: [coords] }
}

const geometryCache = new WeakMap<BriefingPlace, ReturnType<typeof ring>[]>()

function columnGeometry(place: BriefingPlace) {
  let geometry = geometryCache.get(place)
  if (!geometry) {
    geometry = place.columns.map(([lng, lat]) => ring(lng, lat, COLUMN_RADIUS_M, 14))
    geometryCache.set(place, geometry)
  }
  return geometry
}

function columnData(place: BriefingPlace, grow: number): GeoJSON.FeatureCollection {
  const geometry = columnGeometry(place)
  return {
    type: 'FeatureCollection',
    features:
      grow <= 0
        ? []
        : place.columns.map(([, , height], index) => ({
            type: 'Feature',
            properties: { height: height * grow, color: rgbString(rampColor(place.ramp, height)) },
            geometry: geometry[index],
          })),
  }
}

function junctionData(place: BriefingPlace, grow: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      grow <= 0
        ? []
        : place.junctions.map(([lng, lat, radius]) => ({
            type: 'Feature',
            properties: { radius: radius * grow },
            geometry: { type: 'Point', coordinates: [lng, lat] },
          })),
  }
}

type Drawn = { place: BriefingPlace; grow: number }

function drawPlace(map: mapboxgl.Map, drawn: { current: Drawn }, place: BriefingPlace, grow: number) {
  drawn.current = { place, grow }
  ;(map.getSource('briefing-columns') as mapboxgl.GeoJSONSource | undefined)?.setData(columnData(place, grow))
  ;(map.getSource('briefing-junctions') as mapboxgl.GeoJSONSource | undefined)?.setData(junctionData(place, grow))
}

function paintDisks(map: mapboxgl.Map, place: BriefingPlace) {
  map.setPaintProperty('briefing-junctions', 'circle-color', place.diskCore)
  map.setPaintProperty('briefing-junctions-halo', 'circle-color', place.diskHalo)
}

function mountLayers(map: mapboxgl.Map, place: BriefingPlace) {
  map.addSource('briefing-junctions', { type: 'geojson', data: junctionData(place, 0) })
  map.addSource('briefing-columns', { type: 'geojson', data: columnData(place, 0) })
  map.addLayer({
    id: 'briefing-junctions-halo',
    type: 'circle',
    source: 'briefing-junctions',
    paint: {
      'circle-radius': metersToPixels(1.7),
      'circle-color': place.diskHalo,
      'circle-opacity': 0.22,
      'circle-blur': 1,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    },
  })
  map.addLayer({
    id: 'briefing-junctions',
    type: 'circle',
    source: 'briefing-junctions',
    paint: {
      'circle-radius': metersToPixels(1),
      'circle-color': place.diskCore,
      'circle-opacity': 0.36,
      'circle-blur': 0.55,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
    },
  })
  map.addLayer({
    id: 'briefing-columns',
    type: 'fill-extrusion',
    source: 'briefing-columns',
    paint: {
      'fill-extrusion-color': ['to-color', ['get', 'color']],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** `blank` hides the columns and disks, leaving the bare base map (behind blurred stops). */
export function BriefingMap({ place, blank = false }: { place: BriefingPlace; blank?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  /** The place the camera targets (or will, once the style loads). */
  const placeRef = useRef(place)
  const blankRef = useRef(blank)
  /** The place whose columns are on the map, and how far they've grown. */
  const drawnRef = useRef<Drawn>({ place, grow: 0 })
  const readyRef = useRef(false)
  const flyingRef = useRef(false)
  const flightRef = useRef(0)
  const tweenRef = useRef(0)
  const holdUntilRef = useRef(0)

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: STORY_MAP_STYLE,
      ...placeRef.current.camera,
      maxPitch: MAX_PITCH,
      antialias: true,
      attributionControl: false,
    })
    map.setPadding(CAMERA_PADDING)
    mapRef.current = map

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    map.on('load', () => {
      const current = placeRef.current
      map.jumpTo(current.camera)
      mountLayers(map, current)
      readyRef.current = true
      drawPlace(map, drawnRef, current, 0)
      if (blankRef.current) return
      const start = performance.now()
      const grow = (now: number) => {
        const t = Math.min(1, (now - start) / GROW_MS)
        drawPlace(map, drawnRef, current, reduce ? 1 : easeOut(t))
        if (t < 1 && !reduce) tweenRef.current = window.requestAnimationFrame(grow)
      }
      tweenRef.current = window.requestAnimationFrame(grow)
    })

    const hold = (ms: number) => {
      holdUntilRef.current = Math.max(holdUntilRef.current, performance.now() + ms)
    }
    let pressed = false
    const onPress = () => {
      pressed = true
      holdUntilRef.current = Number.POSITIVE_INFINITY
    }
    const onRelease = () => {
      if (!pressed) return
      pressed = false
      holdUntilRef.current = 0
      hold(RESUME_AFTER_MS)
    }
    const canvas = map.getCanvasContainer()
    canvas.addEventListener('pointerdown', onPress)
    window.addEventListener('pointerup', onRelease)
    window.addEventListener('pointercancel', onRelease)
    map.on('move', (event) => {
      if (event.originalEvent) hold(RESUME_AFTER_MS)
    })

    let frame = 0
    let last = performance.now()
    const orbit = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (readyRef.current && !reduce && !flyingRef.current && !document.hidden && now > holdUntilRef.current) {
        map.setBearing(map.getBearing() + (ORBIT_DEG_PER_S * dt) / 1000)
      }
      frame = window.requestAnimationFrame(orbit)
    }
    frame = window.requestAnimationFrame(orbit)

    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(tweenRef.current)
      canvas.removeEventListener('pointerdown', onPress)
      window.removeEventListener('pointerup', onRelease)
      window.removeEventListener('pointercancel', onRelease)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const moved = placeRef.current !== place
    placeRef.current = place
    blankRef.current = blank
    if (!map || !readyRef.current) return

    const target = blank ? 0 : 1
    const { place: previous, grow: from } = drawnRef.current
    const swapping = previous !== place
    if (!moved && !swapping && from === target) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.cancelAnimationFrame(tweenRef.current)
    if (reduce) {
      if (moved) map.jumpTo(place.camera)
      paintDisks(map, place)
      drawPlace(map, drawnRef, place, target)
      return
    }

    if (moved) {
      holdUntilRef.current = 0
      const flight = ++flightRef.current
      flyingRef.current = true
      map.flyTo({ ...place.camera, duration: FLY_MS, curve: 1.6, essential: true })
      map.once('moveend', () => {
        if (flightRef.current === flight) flyingRef.current = false
      })
    }

    /** A new place shrinks the old columns, then grows its own once the flight is underway. */
    const start = performance.now()
    const growFrom = swapping ? 0 : from
    const delay = swapping ? GROW_DELAY_MS : 0
    const span = target > growFrom ? GROW_MS : SHRINK_MS
    let swapped = !swapping
    const tween = (now: number) => {
      const elapsed = now - start
      if (!swapped) {
        if (elapsed < SHRINK_MS && from > 0) {
          drawPlace(map, drawnRef, previous, from * (1 - easeOut(elapsed / SHRINK_MS)))
          tweenRef.current = window.requestAnimationFrame(tween)
          return
        }
        swapped = true
        paintDisks(map, place)
      }
      const t = Math.max(0, Math.min(1, (elapsed - delay) / span))
      drawPlace(map, drawnRef, place, growFrom + (target - growFrom) * easeOut(t))
      if (t < 1) tweenRef.current = window.requestAnimationFrame(tween)
    }
    tweenRef.current = window.requestAnimationFrame(tween)
  }, [place, blank])

  return <div ref={elRef} className={styles.mapCanvas} />
}
