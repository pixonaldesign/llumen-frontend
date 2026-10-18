import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CaretDown, Check, MagnifyingGlass, PencilSimple, Polygon, Trash, X } from '@phosphor-icons/react'
import {
  LOCATION_BREAKDOWNS,
  lastLocationBreakdown,
  rememberLocationBreakdown,
  type LocationBreakdown,
} from './locationBreakdowns'
import {
  LOCATION_ANNOTATION_COLOR,
  drawnLocation,
  polygonCenter,
  type StoryLocation,
  type StoryLocationOption,
} from './storyAnnotations'
import { ConfigSelect } from './StoryConfigSelect'
import { STORY_MAP_STYLE } from './StoryMap'
import { traceStreets } from './storyStreetTrace'
import styles from './StoryEditPanel.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const FIT_PADDING = 56
/** Clicking within this many pixels of the first vertex closes the polygon. */
const CLOSE_RADIUS_PX = 12
/** Repeated clicks this close to the last vertex are ignored (double-click finishes instead). */
const SAME_POINT_PX = 6

type Ring = [number, number][]
type PickedLocation = StoryLocation | StoryLocationOption

const ALL_TYPES = { id: 'all' as const, plural: 'All Location Types' }

function typeOf(location: PickedLocation, breakdown: LocationBreakdown) {
  return 'type' in location ? breakdown.levels.find((level) => level.id === location.type) : undefined
}

/** Small levels and drawn areas snap to their streets; larger areas and corridors keep their outline. */
function outlineOnStreets(location: PickedLocation, breakdown: LocationBreakdown): Promise<Ring> {
  const follows = 'type' in location ? typeOf(location, breakdown)?.followsStreets : true
  return follows ? traceStreets(location.polygon) : Promise.resolve(location.polygon)
}

/** A drawn area, named after the nearest place in the breakdown it was drawn in. */
function drawnIn(ring: Ring, breakdown: LocationBreakdown): StoryLocation {
  const drawn = drawnLocation(ring)
  if (breakdown.id === 'itc') return drawn
  const [lng, lat] = polygonCenter(ring)
  const distance = (option: StoryLocationOption) => {
    const [x, y] = polygonCenter(option.polygon)
    return (x - lng) ** 2 + (y - lat) ** 2
  }
  const nearest = [...breakdown.locations].sort((a, b) => distance(a) - distance(b))[0]
  return nearest ? { ...drawn, name: `Drawn area near ${nearest.name}` } : drawn
}

/** Picks whose boundaries the list uses: each authority breaks its territory into its own levels. */
function BreakdownMenu({
  value,
  onChange,
}: {
  value: LocationBreakdown
  onChange: (breakdown: LocationBreakdown) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const syncPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ top: rect.bottom + 8, left: rect.left })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', syncPosition)
    window.addEventListener('scroll', syncPosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', syncPosition)
      window.removeEventListener('scroll', syncPosition, true)
    }
  }, [open, syncPosition])

  return (
    <div className={styles.breakdown}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.breakdownTrigger}${open ? ` ${styles.breakdownTriggerOpen}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Location breakdown: ${value.area}, ${value.source}`}
        onClick={() => {
          if (!open) syncPosition()
          setOpen((next) => !next)
        }}
      >
        <span className={styles.breakdownCode} aria-hidden>
          {value.code}
        </span>
        <span className={styles.breakdownName}>{value.area}</span>
        <span className={styles.breakdownSource}>{value.source}</span>
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.breakdownMenu}
              role="listbox"
              aria-label="Location breakdown"
              style={{ top: position.top, left: position.left }}
            >
              <p className={styles.breakdownMenuTitle}>Location breakdown</p>
              {LOCATION_BREAKDOWNS.map((breakdown) => {
                const selected = breakdown.id === value.id
                return (
                  <button
                    key={breakdown.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${styles.breakdownOption}${selected ? ` ${styles.breakdownOptionActive}` : ''}`}
                    onClick={() => {
                      onChange(breakdown)
                      setOpen(false)
                    }}
                  >
                    <span className={styles.breakdownCode} aria-hidden>
                      {breakdown.code}
                    </span>
                    <span className={styles.breakdownOptionText}>
                      <span className={styles.breakdownOptionName}>
                        {breakdown.area}
                        <span className={styles.breakdownSource}>{breakdown.source}</span>
                      </span>
                      <span className={styles.breakdownOptionLevels}>
                        {breakdown.levels.map((level) => level.plural).join(' › ')}
                      </span>
                    </span>
                    {selected ? <Check size={16} weight="bold" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

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
  map.addSource('location-selected', { type: 'geojson', data: empty })
  map.addSource('location-pending', { type: 'geojson', data: empty })
  map.addSource('location-draft', { type: 'geojson', data: empty })

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
  const [breakdown, setBreakdown] = useState(lastLocationBreakdown)
  /** The breakdown level the list shows ('all' for every level). */
  const [type, setType] = useState('all')
  /** Parent location the list is narrowed to ('all' for none). */
  const [parent, setParent] = useState('all')
  const [selected, setSelected] = useState<PickedLocation | null>(null)
  /** `selected`, with its outline snapped to the streets once routing returns. */
  const [traced, setTraced] = useState<PickedLocation | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Ring>([])

  const { levels, locations } = breakdown
  const tab = levels.find((level) => level.id === type) ?? ALL_TYPES
  const filterType = 'filterBy' in tab ? levels.find((level) => level.id === tab.filterBy) : undefined
  const parents = filterType
    ? locations.filter(
        (location) =>
          location.type === filterType.id && locations.some((child) => child.type === type && child.parent === location.id),
      )
    : []
  const q = query.trim().toLowerCase()
  const visible = locations.filter(
    (location) =>
      (type === 'all' || location.type === type) &&
      (parent === 'all' || location.parent === parent) &&
      (!q || location.label.toLowerCase().includes(q) || location.name.toLowerCase().includes(q)),
  )
  const typeLabel = type === 'all' ? 'Locations' : tab.plural

  useEffect(() => {
    const el = mapElRef.current
    if (!el || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: el,
      style: STORY_MAP_STYLE,
      ...lastLocationBreakdown().camera,
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
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(el)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  const location = traced && traced.id === selected?.id ? traced : null
  const tracing = selected !== null && location === null

  useEffect(() => {
    if (!selected) return
    let current = true
    void outlineOnStreets(selected, breakdown).then((polygon) => {
      if (current) setTraced({ ...selected, polygon })
    })
    return () => {
      current = false
    }
  }, [selected, breakdown])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    setData(map, 'location-pending', collection(tracing && selected ? [polygonFeature(selected.polygon)] : []))
    setData(map, 'location-selected', collection(location ? [polygonFeature(location.polygon)] : []))
    if (selected) fitRing(map, location?.polygon ?? selected.polygon)
  }, [ready, selected, location, tracing])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selected) return
    const label = document.createElement('div')
    label.className = styles.locationMapLabel
    label.textContent = selected.name
    const marker = new mapboxgl.Marker({ element: label }).setLngLat(polygonCenter(selected.polygon)).addTo(map)
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [ready, selected])

  useEffect(() => {
    if (location) markerRef.current?.setLngLat(polygonCenter(location.polygon))
  }, [location])

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
      setSelected(drawnIn(ring, breakdown))
    }
    const onClick = (event: mapboxgl.MapMouseEvent) => {
      if (!drawing) return
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
      if (drawing) setData(map, 'location-draft', draftData(points, [event.lngLat.lng, event.lngLat.lat]))
    }
    map.on('click', onClick)
    map.on('dblclick', onDoubleClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDoubleClick)
      map.off('mousemove', onMove)
    }
  }, [drawing, points, ready, breakdown])

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
    setSelected(drawnIn(points, breakdown))
    setPoints([])
    setDrawing(false)
  }
  const clear = () => {
    setSelected(null)
    setPoints([])
    setDrawing(false)
  }
  const changeBreakdown = (next: LocationBreakdown) => {
    if (next.id === breakdown.id) return
    rememberLocationBreakdown(next.id)
    setBreakdown(next)
    setType('all')
    setParent('all')
    setQuery('')
    clear()
    mapRef.current?.flyTo({ ...next.camera, duration: 1600, essential: true })
  }

  const selectedType = selected ? (typeOf(selected, breakdown)?.label ?? 'Drawn area') : ''
  const hint = drawing
    ? points.length < 3
      ? 'Click on the map to add points around the area'
      : 'Click the first point or double-click to close the area'
    : tracing
      ? 'Tracing the area along its streets…'
      : location
        ? 'The area follows the streets around it'
        : 'Pick a location from the list, or draw an area'

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
                Select Location
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close location picker">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.locationTabsRow}>
          <BreakdownMenu value={breakdown} onChange={changeBreakdown} />
          <span className={styles.locationTabsDivider} aria-hidden />
          <div className={styles.locationTabs} role="tablist" aria-label={`${breakdown.source} location types`}>
            {[ALL_TYPES, ...levels].map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={type === option.id}
                className={`${styles.locationTab}${type === option.id ? ` ${styles.locationTabActive}` : ''}`}
                onClick={() => {
                  setType(option.id)
                  setParent('all')
                }}
              >
                {option.plural}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.locationBody}>
          <aside className={styles.locationSide}>
            <label className={styles.locationSearch}>
              <MagnifyingGlass size={20} aria-hidden />
              <input
                value={query}
                placeholder={`Search ${typeLabel}`}
                aria-label={`Search ${typeLabel}`}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {filterType ? (
              <div className={styles.locationFilter}>
                <span className={styles.locationFilterLabel} aria-hidden>
                  Filter by
                </span>
                <ConfigSelect
                  label={`Filter ${tab.plural.toLowerCase()} by ${filterType.label.toLowerCase()}`}
                  hideLabel
                  value={parent}
                  options={[
                    { value: 'all', label: `All ${filterType.plural}` },
                    ...parents.map((option) => ({ value: option.id, label: option.name })),
                  ]}
                  onChange={setParent}
                  className={styles.locationFilterField}
                  triggerClassName={styles.locationFilterTrigger}
                />
              </div>
            ) : null}
            <div className={styles.locationList} role="listbox" aria-label="Locations">
              {visible.length === 0 ? (
                <p className={styles.locationEmpty}>
                  {q ? `No ${typeLabel.toLowerCase()} match “${query.trim()}”` : `No ${typeLabel.toLowerCase()} here`}
                </p>
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
                      void outlineOnStreets(location, breakdown).then((polygon) => onApply({ ...location, polygon }))
                    }}
                  >
                    <span className={styles.locationItemName}>{location.label}</span>
                    <span className={styles.locationItemDesc}>{typeOf(location, breakdown)?.label}</span>
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
          <div className={styles.locationSummary}>
            <span className={styles.locationSummaryLabel}>Selected Location</span>
            <span className={`${styles.locationSummaryValue}${selected ? '' : ` ${styles.locationSummaryEmpty}`}`}>
              {location
                ? `${location.name} (${selectedType})`
                : selected
                  ? `${selected.name} · tracing streets…`
                  : 'None yet'}
            </span>
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={clear}
            disabled={!selected && points.length === 0 && !drawing}
          >
            Reset
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
