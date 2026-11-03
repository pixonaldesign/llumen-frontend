/**
 * A GAMI story's map: flies to each page's camera, shrinks the last page's layers and grows the next,
 * outlines the page's areas and pulses its disks and arcs. Used by the GAMI stories and Tell Me More.
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
  GamiPins,
  animateGamiLayers,
  drawGamiAreas,
  drawGamiScene,
  mountGamiAreas,
  mountGamiLayers,
  type GamiArea,
  type GamiMapScene,
} from './gamiMapLayers'
import type { GamiCamera } from './gamiTypes'
import styles from './GamiStory.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const PREFIX = 'gami'
const FLY_MS = 2600
const SHRINK_MS = 500
const GROW_MS = 1500
const AREA_MS = 1100
const MAX_PITCH = 85

export type GamiMapHandle = { view: () => StoryMapView | undefined; capture: () => Promise<StoryMapCapture | null> }

const easeOut = (t: number) => 1 - (1 - t) ** 3

function cameraOptions(camera: GamiCamera) {
  return { center: camera.center, zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing }
}

export function GamiMap({
  className,
  camera,
  scene,
  areas,
  hidden,
  padding,
  controls = true,
  interactive = true,
  controlsClassName,
  onReady,
  handleRef,
}: {
  className?: string
  camera: GamiCamera
  scene: GamiMapScene
  areas: GamiArea[]
  /** Scene groups switched off in Map Data; `area` hides the outlines. */
  hidden: ReadonlySet<string>
  padding: mapboxgl.PaddingOptions
  controls?: boolean
  interactive?: boolean
  controlsClassName?: string
  onReady?: (stage: 'loaded' | 'painted') => void
  handleRef?: Ref<GamiMapHandle>
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const readyRef = useRef(false)
  const pinsRef = useRef<GamiPins | null>(null)
  const labelsRef = useRef<GamiAreaLabels | null>(null)
  const drawnRef = useRef<{ scene: GamiMapScene; grow: number; areas: GamiArea[]; reveal: number }>({
    scene,
    grow: 0,
    areas,
    reveal: 0,
  })
  const latestRef = useRef({ camera, scene, areas, hidden, padding })
  const tweenRef = useRef(0)
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
    drawGamiScene(map, PREFIX, drawn.scene, drawn.grow, off)
    pinsRef.current?.sync(drawn.scene.pins, drawn.grow, off)
    drawGamiAreas(map, PREFIX, drawn.areas, drawn.reveal, off.has('area'))
    labelsRef.current?.sync(drawn.areas, drawn.reveal > 0.6 && !off.has('area'))
  }

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapboxgl.accessToken = MAPBOX_TOKEN
    const start = latestRef.current
    const map = new mapboxgl.Map({
      container: el,
      style: STORY_MAP_STYLE,
      ...cameraOptions(start.camera),
      maxPitch: MAX_PITCH,
      interactive,
      antialias: true,
      attributionControl: false,
    })
    map.setPadding(start.padding)
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    map.on('load', () => {
      mountGamiAreas(map, PREFIX)
      mountGamiLayers(map, PREFIX)
      pinsRef.current = new GamiPins(map)
      labelsRef.current = new GamiAreaLabels(map)
      readyRef.current = true
      onReadyRef.current?.('loaded')
      const announce = () => {
        if (!map.areTilesLoaded()) return
        map.off('render', announce)
        onReadyRef.current?.('painted')
      }
      map.on('render', announce)
      const begin = performance.now()
      const grow = (now: number) => {
        const t = reduce ? 1 : Math.min(1, (now - begin) / GROW_MS)
        const latest = latestRef.current
        drawnRef.current = {
          scene: latest.scene,
          grow: easeOut(t),
          areas: latest.areas,
          reveal: easeOut(Math.max(0, Math.min(1, (now - begin - GROW_MS * 0.4) / AREA_MS))),
        }
        paint(map)
        if (t < 1 || drawnRef.current.reveal < 1) tweenRef.current = window.requestAnimationFrame(grow)
      }
      tweenRef.current = window.requestAnimationFrame(grow)
    })

    let frame = 0
    const loop = (now: number) => {
      if (readyRef.current && !document.hidden && !reduce) animateGamiLayers(map, PREFIX, now)
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(tweenRef.current)
      observer.disconnect()
      pinsRef.current?.clear()
      labelsRef.current?.clear()
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
    latestRef.current = { camera, scene, areas, hidden, padding }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const moved = previous.camera !== camera
    const swapped = drawnRef.current.scene !== scene || drawnRef.current.areas !== areas
    if (!moved && !swapped) {
      paint(map)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (moved) {
      if (reduce) map.jumpTo({ ...cameraOptions(camera), padding })
      else map.flyTo({ ...cameraOptions(camera), padding, duration: FLY_MS, curve: 1.5, essential: true })
    }
    window.cancelAnimationFrame(tweenRef.current)
    const from = drawnRef.current
    const begin = performance.now()
    const growAt = moved ? FLY_MS * 0.45 : SHRINK_MS
    const tween = (now: number) => {
      const elapsed = reduce ? Number.POSITIVE_INFINITY : now - begin
      if (elapsed < SHRINK_MS && from.grow > 0) {
        const t = easeOut(elapsed / SHRINK_MS)
        drawnRef.current = { ...from, grow: from.grow * (1 - t), reveal: from.reveal * (1 - t) }
      } else {
        const t = Math.max(0, Math.min(1, (elapsed - growAt) / GROW_MS))
        const r = Math.max(0, Math.min(1, (elapsed - growAt - GROW_MS * 0.5) / AREA_MS))
        drawnRef.current = { scene, areas, grow: easeOut(t), reveal: easeOut(r) }
      }
      paint(map)
      if (drawnRef.current.scene !== scene || drawnRef.current.grow < 1 || drawnRef.current.reveal < 1) {
        tweenRef.current = window.requestAnimationFrame(tween)
      }
    }
    tweenRef.current = window.requestAnimationFrame(tween)
    // `paint` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene, areas, hidden, padding])

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
