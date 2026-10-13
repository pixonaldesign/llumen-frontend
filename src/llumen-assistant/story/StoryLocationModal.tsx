import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MagnifyingGlass, MapPin, PencilSimple, Polygon, Trash, X } from '@phosphor-icons/react'
import { MUSSAFAH_REGION } from './storyAiScenarios'
import {
  LOCATION_ANNOTATION_COLOR,
  STORY_LOCATIONS,
  drawnLocation,
  locationColumnCount,
  type StoryLocation,
} from './storyAnnotations'
import { DEMO_COLUMNS } from './storyDemoMapData'
import { STORY_MAP_STYLE } from './StoryMap'
import { traceStreets } from './storyStreetTrace'
import styles from './StoryEditPanel.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const START_CAMERA = { center: [54.425, 24.415] as [number, number], zoom: 10.35 }
const FIT_PADDING = 56
/** Clicking within this many pixels of the first vertex closes the polygon. */
const CLOSE_RADIUS_PX = 12
/** Repeated clicks this close to the last vertex are ignored (double-click finishes instead). */
const SAME_POINT_PX = 6
const BRAND = '#70aeff'

type Ring = [number, number][]

function collection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}

function polygonFeature(ring: Ring, properties: GeoJsonProperties = {}): Feature {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } }
}

function draftData(points: Ring, cursor: [number, number] | null) {
  const line = cursor ? [...points, cursor] : points
  return collection([
    ...(line.length >= 2
      ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line } }]
      : []),
    ...points.map((point, index) => ({
      type: 'Feature' as const,
      properties: { first: index === 0 },
      geometry: { type: 'Point' as const, coordinates: point },
    })),
  ])
}

function setData(map: mapboxgl.Map, id: string, data: FeatureCollection) {
  ;(map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData(data)
}

function fitRing(map: mapboxgl.Map, ring: Ring) {
  const bounds = new mapboxgl.LngLatBounds()
  for (const point of ring) bounds.extend(point)
  map.fitBounds(bounds, { padding: FIT_PADDING, duration: 900, maxZoom: 14 })
}

function addLayers(map: mapboxgl.Map) {
  const empty = collection([])
  map.addSource('location-districts', {
    type: 'geojson',
    data: collection(STORY_LOCATIONS.map((location) => polygonFeature(location.polygon, { id: location.id }))),
  })
  map.addSource('location-columns', {
    type: 'geojson',
    data: collection(
      [...DEMO_COLUMNS, ...MUSSAFAH_REGION.columns].map(([lng, lat]) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })),
    ),
  })
  map.addSource('location-selected', { type: 'geojson', data: empty })
  map.addSource('location-pending', { type: 'geojson', data: empty })
  map.addSource('location-draft', { type: 'geojson', data: empty })

  map.addLayer({
    id: 'location-districts-fill',
    type: 'fill',
    source: 'location-districts',
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.06 },
  })
  map.addLayer({
    id: 'location-districts-line',
    type: 'line',
    source: 'location-districts',
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': 1.2, 'line-dasharray': [2, 2] },
  })
  map.addLayer({
    id: 'location-columns',
    type: 'circle',
    source: 'location-columns',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 3],
      'circle-color': BRAND,
      'circle-opacity': 0.7,
    },
  })
  map.addLayer({
    id: 'location-selected-fill',
    type: 'fill',
    source: 'location-selected',
    paint: { 'fill-color': LOCATION_ANNOTATION_COLOR, 'fill-opacity': 0.16 },
  })
  map.addLayer({
    id: 'location-selected-line',
    type: 'line',
    source: 'location-selected',
    paint: { 'line-color': LOCATION_ANNOTATION_COLOR, 'line-width': 2 },
  })
  map.addLayer({
    id: 'location-pending-line',
    type: 'line',
    source: 'location-pending',
    paint: { 'line-color': LOCATION_ANNOTATION_COLOR, 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [1.5, 1.5] },
  })
  map.addLayer({
    id: 'location-draft-line',
    type: 'line',
    source: 'location-draft',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': LOCATION_ANNOTATION_COLOR, 'line-width': 2, 'line-dasharray': [1.5, 1.5] },
  })
  map.addLayer({
    id: 'location-draft-points',
    type: 'circle',
    source: 'location-draft',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['case', ['get', 'first'], 6, 4],
      'circle-color': '#ffffff',
      'circle-stroke-color': LOCATION_ANNOTATION_COLOR,
      'circle-stroke-width': 2,
    },
  })
}

export function StoryLocationModal({
  onApply,
  onClose,
}: {
  onApply: (location: StoryLocation) => void
  onClose: () => void
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<StoryLocation | null>(null)
  /** `selected`, with its outline snapped to the streets once routing returns. */
  const [traced, setTraced] = useState<StoryLocation | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Ring>([])

  const q = query.trim().toLowerCase()
  const visible = STORY_LOCATIONS.filter(
    (location) => !q || location.name.toLowerCase().includes(q) || location.description.toLowerCase().includes(q),
  )

  useEffect(() => {
    const el = mapElRef.current
    if (!el || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: STORY_MAP_STYLE,
      ...START_CAMERA,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    })
    map.touchZoomRotate.disableRotation()
    map.on('load', () => {
      addLayers(map)
      map.resize()
      setReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const location = traced && traced.id === selected?.id ? traced : null
  const tracing = selected !== null && location === null

  useEffect(() => {
    if (!selected) return
    let current = true
    void traceStreets(selected.polygon).then((polygon) => {
      if (current) setTraced({ ...selected, polygon })
    })
    return () => {
      current = false
    }
  }, [selected])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'location-pending', collection(tracing && selected ? [polygonFeature(selected.polygon)] : []))
    setData(map, 'location-selected', collection(location ? [polygonFeature(location.polygon)] : []))
    if (selected) fitRing(map, location?.polygon ?? selected.polygon)
  }, [ready, selected, location, tracing])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'location-draft', draftData(points, null))
    map.getCanvas().style.cursor = drawing ? 'crosshair' : ''
    if (drawing) map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()

    const finish = (ring: Ring) => {
      setPoints([])
      setDrawing(false)
      setSelected(drawnLocation(ring))
    }
    const onClick = (event: mapboxgl.MapMouseEvent) => {
      if (!drawing) {
        const id = map.queryRenderedFeatures(event.point, { layers: ['location-districts-fill'] })[0]?.properties?.id
        const location = STORY_LOCATIONS.find((option) => option.id === id)
        if (location) setSelected(location)
        return
      }
      const pixel = (point: [number, number]) => map.project(point)
      if (points.length >= 3 && pixel(points[0]).dist(event.point) <= CLOSE_RADIUS_PX) {
        finish(points)
        return
      }
      const last = points[points.length - 1]
      if (last && pixel(last).dist(event.point) <= SAME_POINT_PX) return
      setPoints([...points, [event.lngLat.lng, event.lngLat.lat]])
    }
    const onDoubleClick = () => {
      if (drawing && points.length >= 3) finish(points)
    }
    const onMove = (event: mapboxgl.MapMouseEvent) => {
      if (drawing) {
        setData(map, 'location-draft', draftData(points, [event.lngLat.lng, event.lngLat.lat]))
        return
      }
      const over = map.queryRenderedFeatures(event.point, { layers: ['location-districts-fill'] }).length > 0
      map.getCanvas().style.cursor = over ? 'pointer' : ''
    }
    map.on('click', onClick)
    map.on('dblclick', onDoubleClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDoubleClick)
      map.off('mousemove', onMove)
    }
  }, [drawing, points, ready])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (drawing) {
        setDrawing(false)
        setPoints([])
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawing, onClose])

  const startDrawing = () => {
    setSelected(null)
    setPoints([])
    setDrawing(true)
  }
  const finishDrawing = () => {
    if (points.length < 3) return
    setSelected(drawnLocation(points))
    setPoints([])
    setDrawing(false)
  }
  const clear = () => {
    setSelected(null)
    setPoints([])
    setDrawing(false)
  }

  const columns = location ? locationColumnCount(location.polygon) : 0
  const hint = drawing
    ? points.length < 3
      ? 'Click on the map to add points around the area'
      : 'Click the first point or double-click to close the area'
    : tracing
      ? 'Tracing the area along its streets…'
      : location
        ? 'The area follows the streets around it'
        : 'Pick an area, or draw one on the map'

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close location picker" onClick={onClose} />
      <div
        className={`${styles.panel} ${styles.modal} ${styles.locationModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-modal-title"
        dir="ltr"
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerCopy}>
              <h2 id="location-modal-title" className={styles.title}>
                Location
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close location picker">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.locationBody}>
          <aside className={styles.locationSide}>
            <label className={`${styles.assetsSearch} ${styles.locationSearch}`}>
              <MagnifyingGlass size={20} aria-hidden />
              <input
                value={query}
                placeholder="Search locations..."
                aria-label="Search locations"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className={styles.locationList} role="listbox" aria-label="Locations">
              {visible.length === 0 ? (
                <p className={styles.locationEmpty}>No locations match “{query.trim()}”</p>
              ) : null}
              {visible.map((location) => {
                const active = selected?.id === location.id
                return (
                  <button
                    key={location.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.locationItem}${active ? ` ${styles.locationItemActive}` : ''}`}
                    onClick={() => {
                      setDrawing(false)
                      setPoints([])
                      setSelected(location)
                    }}
                    onDoubleClick={() => {
                      void traceStreets(location.polygon).then((polygon) => onApply({ ...location, polygon }))
                    }}
                  >
                    <MapPin size={16} weight={active ? 'fill' : 'regular'} aria-hidden />
                    <span className={styles.locationItemCopy}>
                      <span className={styles.locationItemName}>{location.name}</span>
                      <span className={styles.locationItemDesc}>{location.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className={styles.locationMapWrap}>
            <div ref={mapElRef} className={styles.locationMap} />
            <div className={styles.locationTools}>
              {drawing ? (
                <button
                  type="button"
                  className={`${styles.locationTool} ${styles.locationToolActive}`}
                  onClick={finishDrawing}
                  disabled={points.length < 3}
                >
                  <Polygon size={16} aria-hidden />
                  Finish area
                </button>
              ) : (
                <button type="button" className={styles.locationTool} onClick={startDrawing}>
                  <PencilSimple size={16} aria-hidden />
                  Draw area
                </button>
              )}
              <button
                type="button"
                className={styles.locationTool}
                onClick={clear}
                disabled={!selected && points.length === 0}
              >
                <Trash size={16} aria-hidden />
                Clear
              </button>
            </div>
            <p className={styles.locationHint}>{hint}</p>
          </div>
        </div>

        <footer className={`${styles.mapStyleFooter} ${styles.locationFooter}`}>
          <p className={styles.locationSummary}>
            {location ? (
              <>
                <b>{location.name}</b> · {columns} {columns === 1 ? 'column' : 'columns'}
              </>
            ) : selected ? (
              <>
                <b>{selected.name}</b> · tracing streets…
              </>
            ) : (
              'No area selected'
            )}
          </p>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.assetsNext}
            disabled={!location}
            onClick={() => location && onApply(location)}
          >
            Add location
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
