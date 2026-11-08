/**
 * The TomTom story's map: flies to each page's camera, fades the last page's scene out and the next
 * one's in: the traffic fences rise along the streets and the pins pop in. Pins, towers and fences
 * name themselves in a tooltip on hover, and clicking a site with details opens them; the camera then
 * turns to frame it beside them. Used by the story and the ask stage.
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls } from '../InteractiveMap'
import type { StoryMapView } from '../story/StoryMap'
import { captureMapView } from '../story/captureMapView'
import type { StoryMapCapture } from '../story/storyAiScenarios'
import {
  TOMTOM_MAP_STYLE,
  TomtomPins,
  TowerLabels,
  drawTomtomScene,
  fenceAt,
  tomtomTipHtml,
  forgetTowers,
  mountTomtomLayers,
  resolveTowers,
  towerAt,
  type TomtomMapScene,
  type TomtomPin,
  type TomtomTip,
} from './tomtomMapLayers'
import type { TomtomCamera } from './tomtomTypes'
import styles from './TomtomStory.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const PREFIX = 'tomtom'
const FLY_MS = 2600
const SHRINK_MS = 500
const GROW_MS = 1500
const DIMENSION_MS = 700
const FOCUS_MS = 1400
const FOCUS_ZOOM = 16.4
const MAX_PITCH = 85

export type TomtomMapHandle = { view: () => StoryMapView | undefined; capture: () => Promise<StoryMapCapture | null> }

/**
 * A tower or pin to frame beside an open panel, with the padding that keeps it clear of the panel.
 * `zoom` and `pitch` are the closest the focus frames the tower at; it never pulls back or flattens to reach
 * them. `duration` times the move in, and the move back out when the focus clears.
 */
export type TomtomMapFocus = {
  id: string
  padding: mapboxgl.PaddingOptions
  zoom?: number
  pitch?: number
  duration?: number
}

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function cameraOptions(camera: TomtomCamera, flat = false) {
  return { center: camera.center, zoom: camera.zoom, pitch: flat ? 0 : camera.pitch, bearing: camera.bearing }
}

const NO_PINS: TomtomPin[] = []

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function TomtomMap({
  className,
  camera,
  scene,
  hidden,
  padding,
  controls = true,
  interactive = true,
  flat = false,
  styleUrl = TOMTOM_MAP_STYLE,
  controlsClassName,
  focus = null,
  onPick,
  pickable,
  onReady,
  handleRef,
}: {
  className?: string
  camera: TomtomCamera
  scene: TomtomMapScene
  /** Scene groups switched off in Map Data. */
  hidden: ReadonlySet<string>
  padding: mapboxgl.PaddingOptions
  controls?: boolean
  interactive?: boolean
  /** The 2D projection: no tilt. */
  flat?: boolean
  styleUrl?: string
  controlsClassName?: string
  focus?: TomtomMapFocus | null
  /** Makes the towers, their labels and the `pickable` pins clickable. */
  onPick?: (id: string) => void
  /** Which pins open something when clicked; none when unset. */
  pickable?: (id: string) => boolean
  onReady?: (stage: 'loaded' | 'painted') => void
  handleRef?: Ref<TomtomMapHandle>
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const readyRef = useRef(false)
  const labelsRef = useRef<TowerLabels | null>(null)
  const pinsRef = useRef<TomtomPins | null>(null)
  const drawnRef = useRef<{ scene: TomtomMapScene; grow: number }>({ scene, grow: 0 })
  const latestRef = useRef({ camera, scene, hidden, padding, flat, focus })
  const tweenRef = useRef(0)
  const styleRef = useRef(styleUrl)
  const onReadyRef = useRef(onReady)
  const onClickRef = useRef(onPick)
  const pickableRef = useRef(pickable)

  useEffect(() => {
    onReadyRef.current = onReady
    onClickRef.current = onPick
    pickableRef.current = pickable
  }, [onReady, onPick, pickable])

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
    const { hidden: off, focus: focused } = latestRef.current
    drawTomtomScene(map, PREFIX, drawn.scene, drawn.grow, off)
    labelsRef.current?.sync(drawn.scene.towers, drawn.grow, off, focused?.id ?? null)
    pinsRef.current?.sync(drawn.scene.pins ?? NO_PINS, drawn.grow, off, focused?.id ?? null)
  }

  const growIn = (map: mapboxgl.Map) => {
    const reduce = reducedMotion()
    window.cancelAnimationFrame(tweenRef.current)
    const begin = performance.now()
    const grow = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - begin) / GROW_MS)
      drawnRef.current = { scene: latestRef.current.scene, grow: easeOut(t) }
      paint(map)
      if (t < 1) tweenRef.current = window.requestAnimationFrame(grow)
    }
    tweenRef.current = window.requestAnimationFrame(grow)
  }

  useEffect(() => {
    const el = elRef.current
    if (!el || mapRef.current || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const start = latestRef.current
    const map = new mapboxgl.Map({
      container: el,
      style: styleRef.current,
      ...cameraOptions(start.camera, start.flat),
      maxPitch: start.flat ? 0 : MAX_PITCH,
      interactive,
      antialias: true,
      attributionControl: false,
    })
    map.setPadding(start.padding)
    mapRef.current = map
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)
    const labels = new TowerLabels(map, PREFIX, onClickRef.current ? (id) => onClickRef.current?.(id) : undefined)
    labelsRef.current = labels
    const tip = document.createElement('div')
    tip.className = 'tomtom-tip'
    tip.hidden = true
    map.getContainer().appendChild(tip)
    let tipKey: string | null = null
    const showTip = (key: string, content: TomtomTip, point: { x: number; y: number }) => {
      if (key !== tipKey) {
        tip.innerHTML = tomtomTipHtml(content)
        tipKey = key
      }
      tip.hidden = false
      tip.style.left = `${point.x}px`
      tip.style.top = `${point.y}px`
    }
    const hideTip = () => {
      tip.hidden = true
      tipKey = null
      map.getCanvas().style.cursor = ''
    }
    const pins = new TomtomPins(map, PREFIX, {
      onPick: onClickRef.current ? (id) => onClickRef.current?.(id) : undefined,
      pickable: (id) => pickableRef.current?.(id) ?? false,
      onHover: (pin, point) => {
        if (!pin || !point) return hideTip()
        showTip(`pin:${pin.id}`, pin.tip, point)
      },
    })
    pinsRef.current = pins

    // A new basemap drops the layers and the towers' states; put them back over it.
    map.on('style.load', () => {
      forgetTowers(map)
      mountTomtomLayers(map, PREFIX, latestRef.current.scene.towers)
      labels.mount()
      pins.mount()
      if (readyRef.current) paint(map)
    })

    map.on('load', () => {
      readyRef.current = true
      onReadyRef.current?.('loaded')
      const announce = () => {
        if (!map.areTilesLoaded()) return
        map.off('render', announce)
        onReadyRef.current?.('painted')
      }
      map.on('render', announce)
      growIn(map)
    })
    map.on('idle', () => resolveTowers(map, drawnRef.current.scene.towers))

    const shownTowers = () =>
      drawnRef.current.grow < 0.5 ? [] : drawnRef.current.scene.towers.filter((tower) => !latestRef.current.hidden.has(tower.group))
    const vph = ([light, heavy]: [number, number], load: number) =>
      (Math.round((light + (heavy - light) * load) / 10) * 10).toLocaleString('en-US')
    const onMove = (event: mapboxgl.MapMouseEvent) => {
      const tower = towerAt(map, event.point, shownTowers(), PREFIX)
      if (tower) {
        showTip(`tower:${tower.id}`, tower.tip, event.point)
        map.getCanvas().style.cursor = onClickRef.current ? 'pointer' : 'default'
        return
      }
      const hit = drawnRef.current.grow < 0.5 ? null : fenceAt(map, event.point, PREFIX)
      const fence = hit && drawnRef.current.scene.fences?.find((item) => item.id === hit.id)
      if (hit && fence) {
        showTip(
          `fence:${fence.id}:${Math.round(hit.load * 100)}`,
          {
            title: fence.title,
            rows: [
              ['Here', `${vph(fence.vph, hit.load)} ${fence.unit}`],
              ['Busiest stretch', `${vph(fence.vph, Math.max(...fence.load))} ${fence.unit}`],
            ],
          },
          event.point,
        )
        map.getCanvas().style.cursor = 'default'
        return
      }
      if (tipKey?.startsWith('tower:') || tipKey?.startsWith('fence:')) hideTip()
    }
    const onClick = (event: mapboxgl.MapMouseEvent) => {
      const tower = towerAt(map, event.point, shownTowers(), PREFIX)
      if (tower) onClickRef.current?.(tower.id)
    }
    map.on('mousemove', onMove)
    map.on('mouseout', hideTip)
    map.on('movestart', hideTip)
    map.on('click', onClick)

    return () => {
      window.cancelAnimationFrame(tweenRef.current)
      observer.disconnect()
      tip.remove()
      labels.clear()
      pins.clear()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // The map mounts once; later props are read from latestRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* A new page: fly to its camera, fade the old scene out and the new one in. */
  useEffect(() => {
    const previous = latestRef.current
    latestRef.current = { ...latestRef.current, camera, scene, hidden, padding }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const moved = previous.camera !== camera
    const swapped = drawnRef.current.scene !== scene
    if (!moved && !swapped) {
      paint(map)
      return
    }
    const reduce = reducedMotion()
    if (moved && !latestRef.current.focus) {
      const options = { ...cameraOptions(camera, latestRef.current.flat), padding }
      if (reduce) map.jumpTo(options)
      else map.flyTo({ ...options, duration: FLY_MS, curve: 1.5, essential: true })
    }
    window.cancelAnimationFrame(tweenRef.current)
    const from = drawnRef.current
    const begin = performance.now()
    const growAt = moved ? FLY_MS * 0.45 : SHRINK_MS
    const tween = (now: number) => {
      const elapsed = reduce ? Number.POSITIVE_INFINITY : now - begin
      if (elapsed < SHRINK_MS && from.grow > 0 && swapped) {
        drawnRef.current = { ...from, grow: from.grow * (1 - easeOut(elapsed / SHRINK_MS)) }
      } else {
        const t = Math.max(0, Math.min(1, (elapsed - growAt) / GROW_MS))
        drawnRef.current = { scene, grow: swapped ? easeOut(t) : Math.max(from.grow, easeOut(t)) }
      }
      paint(map)
      if (drawnRef.current.scene !== scene || drawnRef.current.grow < 1) tweenRef.current = window.requestAnimationFrame(tween)
    }
    tweenRef.current = window.requestAnimationFrame(tween)
  }, [camera, scene, hidden, padding])

  /* Frame the open tower beside its panel, or go back to the page's camera when it closes. */
  useEffect(() => {
    const previous = latestRef.current.focus
    latestRef.current = { ...latestRef.current, focus }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    paint(map)
    if (previous?.id === focus?.id) return
    const duration = reducedMotion() ? 0 : ((focus ?? previous)?.duration ?? FOCUS_MS)
    const { camera: pageCamera, padding: pagePadding, flat: flatNow } = latestRef.current
    if (!focus) {
      map.easeTo({ ...cameraOptions(pageCamera, flatNow), padding: pagePadding, duration, easing: easeInOut, essential: true })
      return
    }
    const target =
      drawnRef.current.scene.towers.find((item) => item.id === focus.id) ??
      drawnRef.current.scene.pins?.find((item) => item.id === focus.id)
    if (!target) return
    map.easeTo({
      center: target.at,
      zoom: Math.max(map.getZoom(), focus.zoom ?? FOCUS_ZOOM),
      pitch: flatNow ? 0 : Math.max(focus.pitch ?? 58, pageCamera.pitch),
      bearing: map.getBearing(),
      padding: focus.padding,
      duration,
      easing: easeInOut,
      essential: true,
    })
  }, [focus])

  /* 2D ↔ 3D: tilt to or from flat. */
  useEffect(() => {
    latestRef.current = { ...latestRef.current, flat }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (flat) {
      map.easeTo({ pitch: 0, duration: DIMENSION_MS })
      map.once('moveend', () => {
        if (latestRef.current.flat) map.setMaxPitch(0)
      })
    } else {
      map.setMaxPitch(MAX_PITCH)
      map.easeTo({ pitch: latestRef.current.camera.pitch, duration: DIMENSION_MS })
    }
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
