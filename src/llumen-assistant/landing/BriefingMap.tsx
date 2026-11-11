/**
 * Briefing backdrop: each finding's night Dubai scene (its towers lit, sales heat and roof labels),
 * slowly orbiting and flying to each map stop's place. It is a backdrop: it takes no pointer, wheel or touch.
 */
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { StoryMapView } from '../story/StoryMap'
import type { BriefingPlace } from './briefingMapPlaces'
import {
  ESTATE_MAP_STYLE,
  TowerLabels,
  drawEstateScene,
  forgetTowers,
  mountEstateLayers,
  resolveTowers,
  sceneLabels,
} from '../realEstate/estateMapLayers'
import styles from './BriefingLanding.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const ORBIT_DEG_PER_S = 2.2
const FLY_MS = 2800
const SHRINK_MS = 700
const GROW_DELAY_MS = 1300
const GROW_MS = 1700
const ENTER_MS = 1700
const RETURN_MS = 1500
const MAX_PITCH = 85
/** The sampler's frame: enough pixels to average the map's colours by band, few enough to read at once. */
const SAMPLE_W = 32
const SAMPLE_H = 20
/** A hidden tab draws no frames; the sampler gives up rather than wait. */
const SAMPLE_TIMEOUT_MS = 400
/** Lifts the orbit centre so the tall columns rise above the centred greeting; top padding exposes the sky. */
const CAMERA_PADDING = { top: 0, right: 0, bottom: 220, left: 0 }
/**
 * With the finding low on the stage, the orbit centre sits `lift` px above where the finding's category
 * lands (`ratio` of the stage height), so the columns end just above the finding at any height.
 */
const LOW_FOCUS = { ratio: 0.69, lift: 200 }
/**
 * A finding with a chart on top: the orbit centre stays `clearance` px above the chart's top edge, so the
 * scene turns above the chart rather than behind it, but no higher than `minRatio` of the stage.
 */
const CHART_FOCUS = { clearance: 130, minRatio: 0.17 }

const LAYERS = 'briefing'

type Drawn = { place: BriefingPlace; grow: number }

const labelsByMap = new WeakMap<mapboxgl.Map, TowerLabels>()

function drawPlace(map: mapboxgl.Map, drawn: { current: Drawn }, place: BriefingPlace, grow: number) {
  drawn.current = { place, grow }
  drawEstateScene(map, LAYERS, place.scene, grow)
  labelsByMap.get(map)?.sync(sceneLabels(place.scene), grow)
}

function mountLayers(map: mapboxgl.Map, place: BriefingPlace) {
  forgetTowers(map)
  mountEstateLayers(map, LAYERS, place.scene.towers)
  let labels = labelsByMap.get(map)
  if (!labels) {
    labels = new TowerLabels(map, LAYERS)
    labelsByMap.set(map, labels)
  }
  labels.mount()
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** `focusRight` moves the orbit centre into the right two thirds, clear of a left-hand panel. */
function cameraPadding(
  el: HTMLElement,
  focusRight: boolean,
  focusLow: boolean,
  chartTop: number | null,
): mapboxgl.PaddingOptions {
  const left = focusRight ? Math.round(el.clientWidth / 3) : 0
  if (!focusLow) return { ...CAMERA_PADDING, left }
  const height = el.clientHeight
  let centre = height * LOW_FOCUS.ratio - LOW_FOCUS.lift
  if (chartTop !== null) {
    centre = Math.min(centre, Math.max(height * CHART_FOCUS.minRatio, chartTop - CHART_FOCUS.clearance))
  }
  const shift = Math.round(2 * centre - height)
  return { top: Math.max(0, shift), right: 0, bottom: Math.max(0, -shift), left }
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
  focusLow = false,
  chartTop = null,
  chartCheck = 0,
  enter = null,
  onArrive,
  start = null,
  onReady,
  align = null,
  onSampler,
}: {
  place: BriefingPlace
  blank?: boolean
  focusRight?: boolean
  /** The finding sits low on the stage: the columns frame down to just above it. */
  focusLow?: boolean
  /**
   * With `focusLow`: reads the finding's chart top edge, in px from the map's top (null while it isn't
   * laid out). Read whenever the camera's padding is worked out, so the first frame already clears it.
   */
  chartTop?: (() => number | null) | null
  /** Bumped when the chart may have moved: the padding is read again and the camera follows if it changed. */
  chartCheck?: number
  enter?: BriefingMapEnter | null
  onArrive?: () => void
  start?: BriefingMapEnter | null
  onReady?: (stage: 'loaded' | 'painted') => void
  /** Where to snap before flying home, so the return starts on the story's current view. */
  align?: BriefingMapEnter | null
  /** Hands over a reader of the map's next frame, shrunk to a few pixels (null until the style loads). */
  onSampler?: (sample: (() => Promise<ImageData | null>) | null) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  /** The place the camera targets (or will, once the style loads). */
  const placeRef = useRef(place)
  const blankRef = useRef(blank)
  const focusRightRef = useRef(focusRight)
  const focusLowRef = useRef(focusLow)
  const chartTopRef = useRef(chartTop)
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
  const onSamplerRef = useRef(onSampler)

  useEffect(() => {
    onArriveRef.current = onArrive
    onReadyRef.current = onReady
    onSamplerRef.current = onSampler
    alignRef.current = align
  }, [onArrive, onReady, onSampler, align])

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: ESTATE_MAP_STYLE,
      ...(heldRef.current?.camera ?? placeRef.current.camera),
      maxPitch: MAX_PITCH,
      antialias: true,
      attributionControl: false,
      interactive: false,
    })
    map.setPadding(heldRef.current?.padding ?? cameraPadding(el, focusRightRef.current, focusLowRef.current, chartTopRef.current?.() ?? null))
    if (heldRef.current) holdUntilRef.current = Number.POSITIVE_INFINITY
    mapRef.current = map

    const observer = new ResizeObserver(() => {
      map.resize()
      if ((focusRightRef.current || focusLowRef.current) && !flyingRef.current && !heldRef.current && !enterRef.current) {
        map.setPadding(cameraPadding(el, focusRightRef.current, focusLowRef.current, chartTopRef.current?.() ?? null))
      }
    })
    observer.observe(el)

    /* The drawing buffer clears once a frame is shown, so read it in the render event that drew it. */
    const sample = () =>
      new Promise<ImageData | null>((resolve) => {
        const timeout = window.setTimeout(() => {
          map.off('render', read)
          resolve(null)
        }, SAMPLE_TIMEOUT_MS)
        const read = () => {
          window.clearTimeout(timeout)
          const out = document.createElement('canvas')
          out.width = SAMPLE_W
          out.height = SAMPLE_H
          const context = out.getContext('2d', { willReadFrequently: true })
          if (!context) return resolve(null)
          try {
            context.drawImage(map.getCanvas(), 0, 0, SAMPLE_W, SAMPLE_H)
            resolve(context.getImageData(0, 0, SAMPLE_W, SAMPLE_H))
          } catch {
            resolve(null)
          }
        }
        map.once('render', read)
        map.triggerRepaint()
      })

    map.on('load', () => {
      const current = placeRef.current
      const held = heldRef.current
      map.jumpTo(
        held
          ? { ...held.camera, padding: held.padding }
          : { ...current.camera, padding: cameraPadding(el, focusRightRef.current, focusLowRef.current, chartTopRef.current?.() ?? null) },
      )
      mountLayers(map, current)
      readyRef.current = true
      if (pendingReleaseRef.current) {
        pendingReleaseRef.current = false
        holdUntilRef.current = 0
        flyingRef.current = true
        flyHome(map, placeRef.current, cameraPadding(el, focusRightRef.current, focusLowRef.current, chartTopRef.current?.() ?? null), alignRef.current)
        map.once('moveend', () => {
          flyingRef.current = false
        })
      }
      onReadyRef.current?.('loaded')
      onSamplerRef.current?.(sample)
      const announce = () => {
        if (!map.areTilesLoaded()) return
        map.off('render', announce)
        onReadyRef.current?.('painted')
      }
      map.on('render', announce)
      map.on('idle', () => resolveTowers(map, drawnRef.current.place.scene.towers))
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
      observer.disconnect()
      onSamplerRef.current?.(null)
      labelsByMap.get(map)?.clear()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const changed =
      focusRightRef.current !== focusRight || focusLowRef.current !== focusLow || chartTopRef.current !== chartTop
    focusRightRef.current = focusRight
    focusLowRef.current = focusLow
    chartTopRef.current = chartTop
    if (!map || !readyRef.current || heldRef.current || enterRef.current) return
    if (!changed && flyingRef.current) return
    const padding = cameraPadding(map.getContainer(), focusRight, focusLow, chartTop?.() ?? null)
    const now = map.getPadding()
    const near = (a = 0, b = 0) => Math.abs(a - b) < 3
    if (near(now.top, padding.top) && near(now.bottom, padding.bottom) && near(now.left, padding.left)) return
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
  }, [focusRight, focusLow, chartTop, chartCheck])

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
    const padding = cameraPadding(map.getContainer(), focusRightRef.current, focusLowRef.current, chartTopRef.current?.() ?? null)
    window.cancelAnimationFrame(tweenRef.current)
    if (reduce) {
      if (entering) map.jumpTo({ ...enter.camera, padding: enter.padding })
      else if (moved || releasing) map.jumpTo({ ...place.camera, padding })
      if (releasing) holdUntilRef.current = 0
      mountEstateLayers(map, LAYERS, place.scene.towers)
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

    /** A new place dims the old scene, then lights its own once the flight is underway. */
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
        mountEstateLayers(map, LAYERS, place.scene.towers)
      }
      const t = Math.max(0, Math.min(1, (elapsed - delay) / span))
      drawPlace(map, drawnRef, place, growFrom + (target - growFrom) * easeOut(t))
      if (t < 1) tweenRef.current = window.requestAnimationFrame(tween)
    }
    tweenRef.current = window.requestAnimationFrame(tween)
  }, [place, blank, enter, start, align])

  return <div ref={elRef} className={styles.mapCanvas} />
}
