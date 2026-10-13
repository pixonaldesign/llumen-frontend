/**
 * Real Mapbox map for Story view — style + demo layers adapted from
 * llumen-map-legend MapView (utilization heatmap, vehicles, AQI blooms).
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapControls, type InteractiveMapHandle } from '../InteractiveMap'
import styles from './StoryMap.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmqzd3vp2003g01s7f4oy3af9'
const CENTER: [number, number] = [54.3773, 24.4539]
const ZOOM = 11.2

const iconBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/map-icons`

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand: () => number, center: [number, number], scale = 0.09): [number, number] {
  return [center[0] + (rand() - 0.5) * scale, center[1] + (rand() - 0.5) * scale]
}

function point(coords: [number, number], props: Record<string, string | number>) {
  return {
    type: 'Feature' as const,
    properties: props,
    geometry: { type: 'Point' as const, coordinates: coords },
  }
}

function buildDemoLayers(center: [number, number], seed = 2025) {
  const rand = mulberry32(seed)
  const vehicles = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 42 }, (_, i) =>
      point(jitter(rand, center, 0.12), { status: i % 3 === 0 ? 'idling' : 'active' }),
    ),
  }
  const heat = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 180 }, () => {
      const coords = jitter(rand, center, 0.16)
      return point(coords, { mag: 2 + rand() * 8 })
    }),
  }
  const aqi = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 18 }, () =>
      point(jitter(rand, center, 0.14), { aqi: 40 + rand() * 220 }),
    ),
  }
  return { vehicles, heat, aqi }
}

function loadIcon(map: mapboxgl.Map, name: string, url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image(36, 36)
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 })
      resolve()
    }
    image.onerror = () => resolve()
    image.src = url
  })
}

export type StoryMapLayerVisibility = {
  utilization: boolean
  vehiclesActive: boolean
  vehiclesIdling: boolean
}

export type StoryMapFocus = {
  center: [number, number]
  zoom?: number
  seed?: number
}

export type StoryMapProps = {
  className?: string
  layers?: StoryMapLayerVisibility
  /** Camera target. Changing it flies the map and rebuilds demo points around the new center. */
  focus?: StoryMapFocus
  scrollZoom?: boolean
  showControls?: boolean
}

const DEFAULT_LAYERS: StoryMapLayerVisibility = {
  utilization: true,
  vehiclesActive: true,
  vehiclesIdling: true,
}

/** Full Mapbox story canvas with map-legend demo overlays. */
export function StoryMap({
  className,
  layers = DEFAULT_LAYERS,
  focus,
  scrollZoom = true,
  showControls = true,
}: StoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const handleRef = useRef<InteractiveMapHandle | null>(null)
  const [ready, setReady] = useState(false)
  const layersRef = useRef(layers)
  layersRef.current = layers
  const focusRef = useRef(focus)
  focusRef.current = focus
  const appliedFocusKey = useRef<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const initialFocus = focusRef.current
    const initialCenter = initialFocus?.center ?? CENTER
    const initialZoom = initialFocus?.zoom ?? ZOOM
    const map = new mapboxgl.Map({
      container: el,
      style: MAPBOX_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      scrollZoom,
    })
    mapRef.current = map

    const data = buildDemoLayers(initialCenter, initialFocus?.seed ?? 2025)
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    map.on('load', async () => {
      map.resize()
      await Promise.all([
        loadIcon(map, 'diamond-active', `${iconBase}/diamond-map-idling.svg`),
        loadIcon(map, 'diamond-idling', `${iconBase}/diamond-map-active.svg`),
      ])

      map.addSource('story-heat', { type: 'geojson', data: data.heat })
      map.addSource('story-vehicles', { type: 'geojson', data: data.vehicles })
      map.addSource('story-aqi', { type: 'geojson', data: data.aqi })

      map.addLayer({
        id: 'story-utilization',
        type: 'heatmap',
        source: 'story-heat',
        paint: {
          'heatmap-weight': ['/', ['get', 'mag'], 10],
          'heatmap-intensity': 0.9,
          'heatmap-radius': 42,
          'heatmap-opacity': 0.72,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(61,61,223,0)',
            0.2,
            '#3d3ddf',
            0.65,
            '#8b5cf0',
            1,
            '#e0744c',
          ],
        },
      })

      map.addLayer({
        id: 'story-aqi',
        type: 'circle',
        source: 'story-aqi',
        paint: {
          'circle-radius': 22,
          'circle-blur': 0.4,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'aqi'],
            0,
            '#8bc17c',
            50,
            '#e0c27a',
            100,
            '#e39b4c',
            150,
            '#e43963',
            200,
            '#bd2695',
            300,
            '#b21b1b',
          ],
          'circle-opacity': 0.35,
        },
      })

      map.addLayer({
        id: 'story-vehicles-active',
        type: 'symbol',
        source: 'story-vehicles',
        filter: ['==', ['get', 'status'], 'active'],
        layout: {
          'icon-image': 'diamond-active',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
        },
      })

      map.addLayer({
        id: 'story-vehicles-idling',
        type: 'symbol',
        source: 'story-vehicles',
        filter: ['==', ['get', 'status'], 'idling'],
        layout: {
          'icon-image': 'diamond-idling',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
        },
      })

      const vis = layersRef.current
      map.setLayoutProperty('story-utilization', 'visibility', vis.utilization ? 'visible' : 'none')
      map.setLayoutProperty(
        'story-vehicles-active',
        'visibility',
        vis.vehiclesActive ? 'visible' : 'none',
      )
      map.setLayoutProperty(
        'story-vehicles-idling',
        'visibility',
        vis.vehiclesIdling ? 'visible' : 'none',
      )

      setReady(true)
    })

    handleRef.current = {
      zoomIn: () => map.zoomIn({ duration: 280 }),
      zoomOut: () => map.zoomOut({ duration: 280 }),
      resetNorth: () => map.easeTo({ bearing: 0, pitch: 0, duration: 420 }),
    }

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      handleRef.current = null
      appliedFocusKey.current = null
      setReady(false)
    }
  }, [scrollZoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setLayoutProperty('story-utilization', 'visibility', layers.utilization ? 'visible' : 'none')
    map.setLayoutProperty(
      'story-vehicles-active',
      'visibility',
      layers.vehiclesActive ? 'visible' : 'none',
    )
    map.setLayoutProperty(
      'story-vehicles-idling',
      'visibility',
      layers.vehiclesIdling ? 'visible' : 'none',
    )
  }, [layers, ready])

  const focusLng = focus?.center[0]
  const focusLat = focus?.center[1]
  const focusZoom = focus?.zoom
  const focusSeed = focus?.seed

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || focusLng == null || focusLat == null) return
    const key = `${focusLng.toFixed(5)},${focusLat.toFixed(5)},${focusZoom ?? ''},${focusSeed ?? ''}`
    if (appliedFocusKey.current === key) return
    const first = appliedFocusKey.current == null
    appliedFocusKey.current = key
    const center: [number, number] = [focusLng, focusLat]
    const data = buildDemoLayers(center, focusSeed ?? 2025)
    ;(map.getSource('story-heat') as mapboxgl.GeoJSONSource | undefined)?.setData(data.heat)
    ;(map.getSource('story-vehicles') as mapboxgl.GeoJSONSource | undefined)?.setData(data.vehicles)
    ;(map.getSource('story-aqi') as mapboxgl.GeoJSONSource | undefined)?.setData(data.aqi)
    if (first) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({
      center,
      zoom: focusZoom ?? ZOOM,
      duration: reduce ? 0 : 1600,
      essential: true,
      curve: 1.35,
    })
  }, [ready, focusLng, focusLat, focusZoom, focusSeed])

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.canvas} />
      {showControls ? (
        <MapControls
          className={styles.controls}
          disabled={!ready}
          onZoomIn={() => handleRef.current?.zoomIn()}
          onZoomOut={() => handleRef.current?.zoomOut()}
          onResetNorth={() => handleRef.current?.resetNorth()}
        />
      ) : null}
    </div>
  )
}
