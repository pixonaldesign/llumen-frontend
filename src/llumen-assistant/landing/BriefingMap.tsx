/**
 * Briefing backdrop: the story map's value columns and junction disks, slowly orbiting
 * and flying to each map stop's place. Dragging, rotating or pinching pauses the orbit.
 */
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { STORY_MAP_STYLE } from '../story/StoryMap'
import { rampColor, rgbString } from '../story/storyDemoScenes'
import type { StoryMapView } from '../story/StoryMap'
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
const ENTER_MS = 1700
const RETURN_MS = 1500
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

/** `focusRight` moves the orbit centre into the right two thirds, clear of a left-hand panel. */
function cameraPadding(el: HTMLElement, focusRight: boolean): mapboxgl.PaddingOptions {
  return { ...CAMERA_PADDING, left: focusRight ? Math.round(el.clientWidth / 3) : 0 }
}

/** Snaps onto the story's view, then flies back to the Briefing place. */
function flyHome(map: mapboxgl.Map, place: BriefingPlace, padding: mapboxgl.PaddingOptions, align: BriefingMapEnter | null) {
  map.stop()
  if (align) map.jumpTo({ ...align.camera, padding: align.padding })
  map.flyTo({ ...place.camera, padding, duration: RETURN_MS, curve: 1.42, essential: true })
}

/** A story's camera: where the Briefing hands its map over to a story, or takes it back from one. */
export type BriefingMapEnter = StoryMapView

/**
 * `blank` hides the columns and disks, leaving the bare base map (behind blurred stops). `enter` flies
 * the camera to a story's opening view and holds it there, the orbit stopped; `onArrive` follows.
 * `start` (read on mount) opens on a story's view instead, columns fully grown and the orbit held,
 * until it turns null and the camera flies back to `place`. `onReady` reports the first load: `loaded`
 * once the style and layers are up, then `painted` once that view's tiles have all drawn.
 */
export function BriefingMap({
  place,
  blank = false,
  focusRight = false,
  enter = null,
  onArrive,
  start = null,
  onReady,
  align = null,
}: {
  place: BriefingPlace
  blank?: boolean
  focusRight?: boolean
  enter?: BriefingMapEnter | null
  onArrive?: () => void
  start?: BriefingMapEnter | null
  onReady?: (stage: 'loaded' | 'painted') => void
  /** Where to snap before flying home, so the return starts on the story's current view. */
  align?: BriefingMapEnter | null
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  /** The place the camera targets (or will, once the style loads). */
  const placeRef = useRef(place)
  const blankRef = useRef(blank)
  const focusRightRef = useRef(focusRight)
  /** The place whose columns are on the map, and how far they've grown. */
  const drawnRef = useRef<Drawn>({ place, grow: 0 })
  const readyRef = useRef(false)
  const flyingRef = useRef(false)
  const flightRef = useRef(0)
  const tweenRef = useRef(0)
  const holdUntilRef = useRef(0)
  const enterRef = useRef<BriefingMapEnter | null>(null)
  const alignRef = useRef(align)
  const pendingReleaseRef = useRef(false)
  const heldRef = useRef(start)
  const onArriveRef = useRef(onArrive)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onArriveRef.current = onArrive
    onReadyRef.current = onReady
    alignRef.current = align
  }, [onArrive, onReady, align])

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: STORY_MAP_STYLE,
      ...(heldRef.current?.camera ?? placeRef.current.camera),
      maxPitch: MAX_PITCH,
      antialias: true,
      attributionControl: false,
    })
    map.setPadding(heldRef.current?.padding ?? cameraPadding(el, focusRightRef.current))
    if (heldRef.current) holdUntilRef.current = Number.POSITIVE_INFINITY
    mapRef.current = map

    const observer = new ResizeObserver(() => {
      map.resize()
      if (focusRightRef.current && !flyingRef.current) map.setPadding(cameraPadding(el, true))
    })
    observer.observe(el)

    map.on('load', () => {
      const current = placeRef.current
      const held = heldRef.current
      map.jumpTo(held ? { ...held.camera, padding: held.padding } : current.camera)
      mountLayers(map, current)
      readyRef.current = true
      if (pendingReleaseRef.current) {
        pendingReleaseRef.current = false
        holdUntilRef.current = 0
        flyingRef.current = true
        flyHome(map, placeRef.current, cameraPadding(el, focusRightRef.current), alignRef.current)
        map.once('moveend', () => {
          flyingRef.current = false
        })
      }
      onReadyRef.current?.('loaded')
      const announce = () => {
        if (!map.areTilesLoaded()) return
        map.off('render', announce)
        onReadyRef.current?.('painted')
      }
      map.on('render', announce)
      drawPlace(map, drawnRef, current, held && !blankRef.current ? 1 : 0)
      if (blankRef.current || held) return
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
      if (enterRef.current || heldRef.current) return
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
    if (focusRightRef.current === focusRight) return
    focusRightRef.current = focusRight
    if (!map || !readyRef.current) return
    const padding = cameraPadding(map.getContainer(), focusRight)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.setPadding(padding)
      return
    }
    /* A flight in progress restarts with the new padding; otherwise the camera glides over, orbit held. */
    const flight = ++flightRef.current
    flyingRef.current = true
    if (map.isMoving()) {
      map.flyTo({ ...placeRef.current.camera, padding, duration: FLY_MS, curve: 1.6, essential: true })
    } else {
      map.easeTo({ padding, duration: 900, essential: true })
    }
    map.once('moveend', () => {
      if (flightRef.current === flight) flyingRef.current = false
    })
  }, [focusRight])

  useEffect(() => {
    const map = mapRef.current
    const moved = placeRef.current !== place
    placeRef.current = place
    blankRef.current = blank
    const entering = enter !== null && enter !== enterRef.current
    const leftStory = enterRef.current !== null && enter === null
    enterRef.current = enter
    const releasing = (heldRef.current !== null && start === null) || leftStory
    if (heldRef.current !== null && start === null) heldRef.current = null
    if (!map || !readyRef.current) {
      if (entering) onArriveRef.current?.()
      if (releasing) pendingReleaseRef.current = true
      return
    }

    const target = blank ? 0 : 1
    const { place: previous, grow: from } = drawnRef.current
    const swapping = previous !== place
    if (!moved && !swapping && from === target && !entering && !releasing) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const padding = cameraPadding(map.getContainer(), focusRightRef.current)
    window.cancelAnimationFrame(tweenRef.current)
    if (reduce) {
      if (entering) map.jumpTo({ ...enter.camera, padding: enter.padding })
      else if (moved || releasing) map.jumpTo({ ...place.camera, padding })
      if (releasing) holdUntilRef.current = 0
      paintDisks(map, place)
      drawPlace(map, drawnRef, place, target)
      if (entering) onArriveRef.current?.()
      return
    }

    if (entering) {
      holdUntilRef.current = Number.POSITIVE_INFINITY
      const flight = ++flightRef.current
      flyingRef.current = true
      map.flyTo({ ...enter.camera, padding: enter.padding, duration: ENTER_MS, curve: 1.42, essential: true })
      map.once('moveend', () => {
        if (flightRef.current === flight) onArriveRef.current?.()
      })
    } else if (moved || releasing) {
      holdUntilRef.current = 0
      const flight = ++flightRef.current
      flyingRef.current = true
      if (leftStory) flyHome(map, place, padding, align)
      else map.flyTo({ ...place.camera, padding, duration: FLY_MS, curve: 1.6, essential: true })
      map.once('moveend', () => {
        if (flightRef.current === flight) flyingRef.current = false
      })
    }

    /** A new place shrinks the old columns, then grows its own once the flight is underway. */
    const startedAt = performance.now()
    const growFrom = swapping ? 0 : from
    const delay = swapping ? GROW_DELAY_MS : 0
    const span = target > growFrom ? GROW_MS : SHRINK_MS
    let swapped = !swapping
    const tween = (now: number) => {
      const elapsed = now - startedAt
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
  }, [place, blank, enter, start, align])

  return <div ref={elRef} className={styles.mapCanvas} />
}
