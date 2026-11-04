/**
 * A GAMI story's map: optionally dives in from the whole planet on opening, flies to each page's
 * camera, shrinks the last page's layers and grows the next,
 * and outlines the page's areas. Columns and disks name themselves in a tooltip on hover. Used by the
 * GAMI stories and Tell Me More.
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls } from '../InteractiveMap'
import { STORY_MAP_STYLE, type StoryMapView } from '../story/StoryMap'
import { captureMapView } from '../story/captureMapView'
import type { StoryMapCapture } from '../story/storyAiScenarios'
import {
  GamiAreaLabels,
  GamiLabels,
  drawGamiAreas,
  drawGamiScene,
  gamiTipHtml,
  gamiTipLayers,
  mountGamiAreas,
  mountGamiLayers,
  type GamiArea,
  type GamiMapScene,
  type GamiTip,
} from './gamiMapLayers'
import type { GamiCamera } from './gamiTypes'
import styles from './GamiStory.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const PREFIX = 'gami'
const FLY_MS = 2600
const SHRINK_MS = 500
const GROW_MS = 1500
const AREA_MS = 1100
const DIMENSION_MS = 700
const DIVE_MS = 3200
const MAX_PITCH = 85

export type GamiMapHandle = { view: () => StoryMapView | undefined; capture: () => Promise<StoryMapCapture | null> }

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function cameraOptions(camera: GamiCamera, flat = false) {
  return { center: camera.center, zoom: camera.zoom, pitch: flat ? 0 : camera.pitch, bearing: camera.bearing }
}

export function GamiMap({
  className,
  camera,
  intro,
  hold = false,
  scene,
  areas,
  hidden,
  padding,
  controls = true,
  interactive = true,
  flat = false,
  styleUrl = STORY_MAP_STYLE,
  controlsClassName,
  onReady,
  handleRef,
}: {
  className?: string
  camera: GamiCamera
  /** Opens here and dives into `camera`, then draws the scene. */
  intro?: GamiCamera
  /** The map is still covered: the intro waits to dive until it can be seen. */
  hold?: boolean
  scene: GamiMapScene
  areas: GamiArea[]
  /** Scene groups switched off in Map Data; `area` hides the outlines. */
  hidden: ReadonlySet<string>
  padding: mapboxgl.PaddingOptions
  controls?: boolean
  interactive?: boolean
  /** The 2D projection: no tilt, and columns and walls laid flat. */
  flat?: boolean
  styleUrl?: string
  controlsClassName?: string
  onReady?: (stage: 'loaded' | 'painted') => void
  handleRef?: Ref<GamiMapHandle>
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const readyRef = useRef(false)
  const labelsRef = useRef<GamiLabels | null>(null)
  const areaLabelsRef = useRef<GamiAreaLabels | null>(null)
  const drawnRef = useRef<{ scene: GamiMapScene; grow: number; areas: GamiArea[]; reveal: number; lift: number }>({
    scene,
    grow: 0,
    areas,
    reveal: 0,
    lift: flat ? 0 : 1,
  })
  const latestRef = useRef({ camera, scene, areas, hidden, padding, flat })
  const introRef = useRef<{ camera: GamiCamera; phase: 'wait' | 'dive' | 'done' }>({
    camera: intro ?? camera,
    phase: intro ? 'wait' : 'done',
  })
  const holdRef = useRef(hold)
  const tweenRef = useRef(0)
  const liftTweenRef = useRef(0)
  const styleRef = useRef(styleUrl)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useImperativeHandle(handleRef, () => ({
    view: () => {
      const map = mapRef.current
      if (!map) return undefined
      const center = map.getCenter()
      return {
        camera: {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        },
        padding: map.getPadding(),
      } as StoryMapView
    },
    capture: () =>
      new Promise((resolve) => {
        const map = mapRef.current
        if (!map) return resolve(null)
        map.once('render', () => resolve(captureMapView(map)))
        map.triggerRepaint()
      }),
  }))

  const paint = (map: mapboxgl.Map) => {
    const drawn = drawnRef.current
    const { hidden: off } = latestRef.current
    drawGamiScene(map, PREFIX, drawn.scene, drawn.grow, off, drawn.lift)
    labelsRef.current?.sync(drawn.scene.labels, drawn.grow, off)
    drawGamiAreas(map, PREFIX, drawn.areas, drawn.reveal, off.has('area'), drawn.lift)
    areaLabelsRef.current?.sync(drawn.areas, drawn.reveal > 0.6 && !off.has('area'))
  }

  /** Grows the current page's layers in from nothing, then outlines its areas. */
  const growIn = (map: mapboxgl.Map) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.cancelAnimationFrame(tweenRef.current)
    const begin = performance.now()
    const grow = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - begin) / GROW_MS)
      const latest = latestRef.current
      drawnRef.current = {
        ...drawnRef.current,
        scene: latest.scene,
        grow: easeOut(t),
        areas: latest.areas,
        reveal: reduce ? 1 : easeOut(Math.max(0, Math.min(1, (now - begin - GROW_MS * 0.4) / AREA_MS))),
      }
      paint(map)
      if (t < 1 || drawnRef.current.reveal < 1) tweenRef.current = window.requestAnimationFrame(grow)
    }
    tweenRef.current = window.requestAnimationFrame(grow)
  }

  /** The intro: once the map can be seen, dive from the planet into the page's camera, then draw it. */
  const dive = (map: mapboxgl.Map) => {
    const intro = introRef.current
    if (intro.phase !== 'wait' || holdRef.current) return
    intro.phase = 'dive'
    const { camera: target, padding: inset, flat: flatNow } = latestRef.current
    map.easeTo({ ...cameraOptions(target, flatNow), padding: inset, duration: DIVE_MS, easing: easeInOut, essential: true })
    map.once('moveend', () => {
      if (intro.phase !== 'dive') return
      intro.phase = 'done'
      growIn(map)
    })
  }

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapboxgl.accessToken = MAPBOX_TOKEN
    const start = latestRef.current
    if (reduce) introRef.current = { camera: start.camera, phase: 'done' }
    const map = new mapboxgl.Map({
      container: el,
      style: styleRef.current,
      ...cameraOptions(introRef.current.camera, start.flat),
      maxPitch: start.flat ? 0 : MAX_PITCH,
      interactive,
      antialias: true,
      attributionControl: false,
    })
    map.setPadding(start.padding)
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    // A new basemap drops the GAMI layers; put them back over it.
    map.on('style.load', () => {
      mountGamiAreas(map, PREFIX)
      mountGamiLayers(map, PREFIX)
      if (readyRef.current) paint(map)
    })

    map.on('load', () => {
      labelsRef.current = new GamiLabels(map)
      areaLabelsRef.current = new GamiAreaLabels(map)
      readyRef.current = true
      onReadyRef.current?.('loaded')
      const announce = () => {
        if (!map.areTilesLoaded()) return
        map.off('render', announce)
        onReadyRef.current?.('painted')
      }
      map.on('render', announce)
      if (introRef.current.phase === 'done') growIn(map)
      else dive(map)
    })

    const tip = document.createElement('div')
    tip.className = 'gami-tip'
    tip.hidden = true
    map.getContainer().appendChild(tip)
    let tipKey: string | null = null
    const hideTip = () => {
      tip.hidden = true
      tipKey = null
      map.getCanvas().style.cursor = ''
    }
    const onMove = (event: mapboxgl.MapMouseEvent) => {
      const layers = gamiTipLayers(PREFIX).filter((id) => map.getLayer(id))
      const feature = layers.length
        ? map.queryRenderedFeatures(event.point, { layers }).find((item) => item.properties?.tip)
        : undefined
      if (!feature) return hideTip()
      const raw = String(feature.properties?.tip)
      if (raw !== tipKey) {
        tip.innerHTML = gamiTipHtml(JSON.parse(raw) as GamiTip)
        tipKey = raw
      }
      tip.hidden = false
      tip.style.left = `${event.point.x}px`
      tip.style.top = `${event.point.y}px`
      map.getCanvas().style.cursor = 'default'
    }
    map.on('mousemove', onMove)
    map.on('mouseout', hideTip)
    map.on('movestart', hideTip)

    return () => {
      window.cancelAnimationFrame(tweenRef.current)
      window.cancelAnimationFrame(liftTweenRef.current)
      observer.disconnect()
      tip.remove()
      labelsRef.current?.clear()
      areaLabelsRef.current?.clear()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // The map mounts once; later props are read from latestRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* A new page: fly to its camera, shrink the old layers and grow the new ones, then outline its areas. */
  useEffect(() => {
    const previous = latestRef.current
    latestRef.current = { camera, scene, areas, hidden, padding, flat }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const moved = previous.camera !== camera
    const swapped = drawnRef.current.scene !== scene || drawnRef.current.areas !== areas
    if (!moved && !swapped) {
      paint(map)
      return
    }
    introRef.current.phase = 'done'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (moved) {
      const options = { ...cameraOptions(camera, flat), padding }
      if (reduce) map.jumpTo(options)
      else map.flyTo({ ...options, duration: FLY_MS, curve: 1.5, essential: true })
    }
    window.cancelAnimationFrame(tweenRef.current)
    const from = drawnRef.current
    const begin = performance.now()
    const growAt = moved ? FLY_MS * 0.45 : SHRINK_MS
    const tween = (now: number) => {
      const elapsed = reduce ? Number.POSITIVE_INFINITY : now - begin
      const lift = drawnRef.current.lift
      if (elapsed < SHRINK_MS && from.grow > 0) {
        const t = easeOut(elapsed / SHRINK_MS)
        drawnRef.current = { ...from, lift, grow: from.grow * (1 - t), reveal: from.reveal * (1 - t) }
      } else {
        const t = Math.max(0, Math.min(1, (elapsed - growAt) / GROW_MS))
        const r = Math.max(0, Math.min(1, (elapsed - growAt - GROW_MS * 0.5) / AREA_MS))
        drawnRef.current = { scene, areas, lift, grow: easeOut(t), reveal: easeOut(r) }
      }
      paint(map)
      if (drawnRef.current.scene !== scene || drawnRef.current.grow < 1 || drawnRef.current.reveal < 1) {
        tweenRef.current = window.requestAnimationFrame(tween)
      }
    }
    tweenRef.current = window.requestAnimationFrame(tween)
    // `paint` reads refs only; `flat` has its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene, areas, hidden, padding])

  useEffect(() => {
    holdRef.current = hold
    const map = mapRef.current
    if (map && readyRef.current) dive(map)
    // `dive` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold])

  /* 2D ↔ 3D: tilt to or from flat, and lay the columns and walls down or raise them. */
  useEffect(() => {
    latestRef.current = { ...latestRef.current, flat }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const to = flat ? 0 : 1
    const from = drawnRef.current.lift
    if (from === to) return
    if (flat) {
      map.easeTo({ pitch: 0, duration: DIMENSION_MS })
      map.once('moveend', () => {
        if (latestRef.current.flat) map.setMaxPitch(0)
      })
    } else {
      map.setMaxPitch(MAX_PITCH)
      map.easeTo({ pitch: latestRef.current.camera.pitch, duration: DIMENSION_MS })
    }
    window.cancelAnimationFrame(liftTweenRef.current)
    const begin = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / DIMENSION_MS)
      drawnRef.current = { ...drawnRef.current, lift: from + (to - from) * easeInOut(t) }
      paint(map)
      if (t < 1) liftTweenRef.current = window.requestAnimationFrame(step)
    }
    liftTweenRef.current = window.requestAnimationFrame(step)
  }, [flat])

  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRef.current === styleUrl) return
    styleRef.current = styleUrl
    map.setStyle(styleUrl)
  }, [styleUrl])

  const zoom = (delta: number) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + delta, duration: 300 })

  return (
    <>
      <div ref={elRef} className={[styles.mapFill, className].filter(Boolean).join(' ')} />
      {controls ? (
        <MapControls
          className={[styles.controls, controlsClassName].filter(Boolean).join(' ')}
          onZoomIn={() => zoom(1)}
          onZoomOut={() => zoom(-1)}
          onResetNorth={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 600 })}
        />
      ) : null}
    </>
  )
}
