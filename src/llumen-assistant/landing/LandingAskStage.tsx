import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { CaretDown, DotsSix } from '@phosphor-icons/react'
import gsap from 'gsap'
import { MapBleedHeader, type DetailTab } from '../ComponentDetailPanel'
import detailStyles from '../compact-assistant.module.css'
import { MESH_COLORS_LUMEN_DARK, MESH_FRAME_PANEL } from '../paperMeshConstants'
import {
  locationAnnotation,
  schoolMarkersAnnotation,
  snapshotRegion,
  topSchoolsAnnotation,
} from '../story/storyAnnotations'
import type { StoryAiSnapshot, StoryMapCapture } from '../story/storyAiScenarios'
import { StoryMap, type StoryMapHandle } from '../story/StoryMap'
import mapStyles from '../story/StoryMap.module.css'
import styles from './LandingAskStage.module.css'
import { findingStage, isFindingPlace, type FindingStageId } from './landingFindingExperiences'
import { EstateMap, type EstateMapHandle } from '../realEstate/EstateMap'
import { EstateLegendGlyph } from '../realEstate/EstateLegendGlyph'
import estateStyles from '../realEstate/EstateStory.module.css'
import type { EstateTower } from '../realEstate/estateMapLayers'
import type { MapDataLayer } from '../realEstate/estateTypes'
import storyStyles from '../story/StoryView.module.css'
import { createCameraLink } from '../story/storyCameraLink'

/** Loads the asset builder's styles only once Data or Source is opened. */
const LandingAssetPanels = lazy(() => import('./LandingAssetPanels'))

const MORPH_IN_S = 0.68
const MORPH_OUT_S = 0.5
/**
 * Closing while shrunk: the rail slides off to the left instead of folding into the bar. It is a CSS
 * transition (`.stage[data-shrunk][data-closing]`), so it starts in the same frame as the landing's push
 * back and the page follows its edge; this is its --lc-rail-enter-duration.
 */
const RAIL_OUT_MS = 320
/** The AI bar's corner radius, so the stage starts and ends on the bar's own shape. */
const BAR_RADIUS_PX = 24
/** The top inset clears the asset header that floats over the map. */
const MAP_PADDING = { top: 200, right: 40, bottom: 40, left: 40 }

/** Clips `box` (the stage's own rect, full screen or shrunk) down to `rect`. */
function clipFor(rect: DOMRect, radius: number, box: DOMRect) {
  const top = Math.max(0, rect.top - box.top)
  const right = Math.max(0, box.right - rect.right)
  const bottom = Math.max(0, box.bottom - rect.bottom)
  const left = Math.max(0, rect.left - box.left)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`
}

const fullClip = (radius: number) => `inset(0px 0px 0px 0px round ${radius}px)`

const ESCAPE_OWNERS = '[data-lc-sessions-menu], [data-lc-conversation-menu], [data-lc-share-modal]'

export type LandingAskStageHandle = { close: () => void }

export type LandingAskStageProps = {
  /** The AI bar the stage grows out of. */
  origin: DOMRect
  /** Where the stage shrinks back to on close; the bar may have changed size since. */
  returnTo: () => DOMRect | null
  title: string
  header: ReactNode
  /** `close()` shrinks the stage back into the bar, then calls `onClosed`. */
  handleRef?: Ref<LandingAskStageHandle>
  thinking: boolean
  /** The map slides in from the right and the chat moves to the left column. */
  mapOpen: boolean
  /** A rail down the left of the landing instead of full screen, without the map. */
  shrunk?: boolean
  chat: ReactNode
  map: ReactNode
  /** When `close()` starts, before the stage has gone. */
  onClosing?: () => void
  onClosed: () => void
}

export function LandingAskStage({
  origin,
  returnTo,
  title,
  header,
  handleRef,
  thinking,
  mapOpen,
  shrunk = false,
  chat,
  map,
  onClosing,
  onClosed,
}: LandingAskStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el || reduceMotion) return
    const tween = gsap.fromTo(
      el,
      { clipPath: clipFor(origin, BAR_RADIUS_PX, el.getBoundingClientRect()) },
      {
        clipPath: fullClip(0),
        duration: MORPH_IN_S,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(el, { clearProps: 'clipPath' })
        },
      },
    )
    return () => {
      tween.kill()
    }
  }, [origin, reduceMotion])

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    onClosing?.()
    const el = stageRef.current
    if (!el || reduceMotion) {
      onClosed()
      return
    }
    gsap.killTweensOf(el)
    if (shrunk) {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        el.removeEventListener('transitionend', onEnd)
        window.clearTimeout(fallback)
        onClosed()
      }
      const onEnd = (event: TransitionEvent) => {
        if (event.target === el && event.propertyName === 'transform') finish()
      }
      el.addEventListener('transitionend', onEnd)
      const fallback = window.setTimeout(finish, RAIL_OUT_MS + 200)
      return
    }
    gsap.fromTo(
      el,
      { clipPath: fullClip(0) },
      {
        clipPath: clipFor(returnTo() ?? origin, BAR_RADIUS_PX, el.getBoundingClientRect()),
        duration: MORPH_OUT_S,
        ease: 'power3.inOut',
        onComplete: onClosed,
      },
    )
  }, [closing, onClosing, onClosed, origin, reduceMotion, returnTo, shrunk])

  useImperativeHandle(handleRef, () => ({ close }), [close])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Escape closes the header's menus and dialogs first.
      if (document.querySelector(ESCAPE_OWNERS)) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-map={mapOpen && !shrunk ? 'true' : 'false'}
      data-shrunk={shrunk ? 'true' : 'false'}
      data-closing={closing ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.backdrop} aria-hidden>
        <MeshGradient
          speed={thinking ? 0.8 : 0}
          scale={1}
          distortion={0.09}
          swirl={0}
          frame={MESH_FRAME_PANEL}
          colors={[...MESH_COLORS_LUMEN_DARK]}
          className={`${styles.backdropShader}${thinking ? ` ${styles.backdropShaderActive}` : ''}`}
        />
      </div>
      <header className={styles.header}>{header}</header>
      <div className={styles.body}>
        <section className={styles.chat} aria-label="Conversation">
          {chat}
        </section>
        <section className={styles.mapPane} aria-label="Map" aria-hidden={!mapOpen || shrunk}>
          {map}
        </section>
      </div>
    </div>
  )
}

export type LandingAskAssetProps = {
  /** The map state on show; a new one brings the Asset tab back. */
  stateId: string | null
  title: string
  /** District named in the Source query. */
  place: string
  caption?: string
  analysis?: string
  onShowInConversation?: () => void
  onCollapse: () => void
  /** The map; it stays mounted under the Data and Source panels. */
  children: ReactNode
}

/** The reply's map as an asset: a header with insight actions, and Asset / Data / Source tabs. */
export function LandingAskAsset({
  stateId,
  title,
  place,
  caption,
  analysis,
  onShowInConversation,
  onCollapse,
  children,
}: LandingAskAssetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<DetailTab>('component')
  const [tabFor, setTabFor] = useState(stateId)
  if (tabFor !== stateId) {
    setTabFor(stateId)
    setTab('component')
  }

  /* The header remounts per view (it is keyed by stateId), so each one is measured afresh. */
  useLayoutEffect(() => {
    const root = rootRef.current
    const header = headerRef.current
    if (!root || !header) return
    const measure = () => {
      const tabs = header.querySelector('[role="tablist"]')
      if (!tabs) return
      const bottom = tabs.getBoundingClientRect().bottom - root.getBoundingClientRect().top
      root.style.setProperty('--asset-header-h', `${Math.round(bottom)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    observer.observe(root)
    return () => observer.disconnect()
  }, [stateId])

  return (
    <div ref={rootRef} className={styles.asset}>
      <div className={detailStyles.mapBleedStage}>{children}</div>
      <MapBleedHeader
        key={stateId}
        headerRef={headerRef}
        title={title}
        aiGenerated
        caption={caption}
        analysis={analysis}
        onShowInConversation={onShowInConversation}
        onClose={onCollapse}
        activeTab={tab}
        onTabChange={setTab}
        saveDisabled
      />
      {tab !== 'component' ? (
        <div
          className={detailStyles.mapBleedSecondary}
          role="tabpanel"
          id={`component-detail-panel-${tab}`}
          aria-labelledby={`component-detail-tab-${tab}`}
        >
          <Suspense fallback={null}>
            <LandingAssetPanels panel={tab === 'query-results' ? 'data' : 'source'} place={place} />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}

export type LandingAskMapProps = {
  snapshot: StoryAiSnapshot | null
  /** Screenshot for the reply's map-state card, once the annotation has animated in. */
  capture: { stateId: string; delay: number } | null
  onCapture: (stateId: string, capture: StoryMapCapture) => void
  /** A small still-framed thumbnail of the same map, as in a first response container. */
  preview?: boolean
}

/** Top room for the annotated columns and their pins. */
const PREVIEW_PADDING = { top: 44, right: 8, bottom: 8, left: 8 }
/** Pulls the camera out so a ~180px-tall preview frames what the full stage shows. */
const PREVIEW_ZOOM_OFFSET = -1.7

const NO_HIDDEN: ReadonlySet<string> = new Set()

/** Hard steps between a ramp's colours, as binned towers read it. */
const steppedRamp = (ramp: readonly string[]) =>
  `linear-gradient(to right, ${ramp
    .map((color, index) => `${color} ${(index / ramp.length) * 100}% ${((index + 1) / ramp.length) * 100}%`)
    .join(', ')})`

/** The story's Map Data card, read-only: each layer's colours, and the labelled towers a ramp ranks. */
function FindingMapData({ layers, towers }: { layers: MapDataLayer[]; towers: EstateTower[] }) {
  const labelled = towers.filter((tower) => tower.label !== false && !tower.footprint)
  const [open, setOpen] = useState(false)
  return (
    <div className={`${storyStyles.mapData} ${styles.mapData}`}>
      <button
        type="button"
        className={`${storyStyles.mapDataHeader}${open ? '' : ` ${storyStyles.mapDataHeaderSolo}`}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>Map Data</span>
        <CaretDown size={18} weight="regular" className={open ? undefined : storyStyles.caretClosed} aria-hidden />
      </button>
      {open ? (
        <div className={storyStyles.mapLayers}>
          {layers.map((layer) => (
            <section key={layer.group} className={storyStyles.mapLayer}>
              <div className={storyStyles.mapLayerHead}>
                <p className={storyStyles.mapLayerTitle}>{layer.title}</p>
              </div>
              <div className={storyStyles.mapLayerAttrs}>
                {'ramp' in layer.color ? (
                  <div className={storyStyles.mapLayerAttr}>
                    <div className={storyStyles.legendScale}>
                      <span>{layer.color.low ?? 'Low'}</span>
                      <span
                        className={storyStyles.colorRamp}
                        style={{ backgroundImage: steppedRamp(layer.color.ramp) }}
                        aria-hidden
                      />
                      <span>{layer.color.high ?? 'High'}</span>
                    </div>
                  </div>
                ) : (
                  <div className={storyStyles.mapLayerAttr}>
                    {layer.color.items.map((item) => (
                      <div key={item.label} className={storyStyles.legendRow}>
                        <span className={`${storyStyles.legendMark} ${estateStyles.legendLabel}`}>{item.label}</span>
                        <span className={storyStyles.legendMark}>
                          {item.count ? <span className={storyStyles.legendCount}>{item.count}</span> : null}
                          <EstateLegendGlyph mark={layer.mark} color={item.color} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {labelled.length ? (
                  <div className={storyStyles.mapLayerAttr}>
                    <p className={storyStyles.mapLayerAttrLabel}>Top towers</p>
                    {labelled
                      .filter((tower) => tower.group === layer.group)
                      .map((tower) => (
                        <div key={tower.id} className={storyStyles.legendRow}>
                          <span className={`${storyStyles.legendMark} ${estateStyles.legendLabel}`}>{tower.title}</span>
                          <span className={storyStyles.legendMark}>
                            <span className={storyStyles.legendCount}>{tower.tip.rows?.[0]?.[1]}</span>
                            <i className={estateStyles.towerGlyph} style={{ background: tower.color }} aria-hidden />
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const COMPARE_SPLIT_DEFAULT = 0.5
const COMPARE_SPLIT_MIN = 0.25
const COMPARE_SPLIT_MAX = 0.8
const COMPARE_SPLIT_STEP = 0.05

const clampCompareSplit = (value: number) => Math.min(COMPARE_SPLIT_MAX, Math.max(COMPARE_SPLIT_MIN, value))

/**
 * A comparison's maps are each as tall as the stage and clipped by their panes, so dragging the split never
 * resizes a canvas (which blanks it until Mapbox redraws). Padding frames each map in its pane at the default
 * split; the upper one also clears the asset header.
 */
function comparePadding(stack: { height: number; header: number }) {
  const seam = stack.header + COMPARE_SPLIT_DEFAULT * (stack.height - stack.header)
  return {
    before: { top: stack.header + 40, right: 40, bottom: stack.height - seam + 40, left: 40 },
    after: { top: seam + 56, right: 40, bottom: 40, left: 40 },
  }
}

/**
 * The divider between a comparison's maps, splitting the stage below the asset header. Dragging writes the
 * split straight to the stack's style each frame and commits it on release.
 */
function CompareHandle({
  stackRef,
  split,
  onSplit,
}: {
  stackRef: RefObject<HTMLDivElement | null>
  split: number
  onSplit: (split: number) => void
}) {
  const dragRef = useRef<{ value: number; frame: number | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const endDrag = () => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.frame !== null) cancelAnimationFrame(drag.frame)
    dragRef.current = null
    setDragging(false)
    onSplit(drag.value)
  }
  return (
    <div
      className={`${storyStyles.splitHandle} ${styles.compareHandle}${dragging ? ` ${storyStyles.splitHandleActive}` : ''}`}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize comparison maps"
      aria-valuemin={COMPARE_SPLIT_MIN * 100}
      aria-valuemax={COMPARE_SPLIT_MAX * 100}
      aria-valuenow={Math.round(split * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { value: split, frame: null }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        const stack = stackRef.current
        if (!drag || !stack) return
        const rect = stack.getBoundingClientRect()
        const header = parseFloat(getComputedStyle(stack).getPropertyValue('--asset-header-h')) || 0
        drag.value = clampCompareSplit((event.clientY - rect.top - header) / (rect.height - header))
        drag.frame ??= requestAnimationFrame(() => {
          drag.frame = null
          stack.style.setProperty('--compare-split', String(drag.value))
        })
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onSplit(COMPARE_SPLIT_DEFAULT)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        onSplit(clampCompareSplit(split + (event.key === 'ArrowUp' ? -COMPARE_SPLIT_STEP : COMPARE_SPLIT_STEP)))
      }}
    >
      <span className={storyStyles.splitHandleGrip} aria-hidden>
        <DotsSix size={16} weight="bold" />
      </span>
    </div>
  )
}

/**
 * A real-estate finding's place, as Tell Me More reads it: every tall tower coloured by its potential. A
 * solution opens below the problem it solves, the two maps on one camera with a divider between them.
 */
function FindingPlaceMap({
  place,
  capture,
  onCapture,
  preview,
}: Omit<LandingAskMapProps, 'snapshot'> & { place: FindingStageId }) {
  const handleRef = useRef<EstateMapHandle>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const [cameraLink] = useState(createCameraLink)
  const [split, setSplit] = useState(COMPARE_SPLIT_DEFAULT)
  const stage = findingStage(place)
  const compare = preview ? undefined : stage.compare
  const camera = useMemo(
    () => (preview ? { ...stage.camera, zoom: stage.camera.zoom + PREVIEW_ZOOM_OFFSET } : stage.camera),
    [preview, stage],
  )
  useEffect(() => {
    if (!capture) return
    const timer = window.setTimeout(() => {
      void handleRef.current?.capture().then((shot) => {
        if (shot) onCapture(capture.stateId, shot)
      })
    }, capture.delay)
    return () => window.clearTimeout(timer)
  }, [capture, onCapture])
  const [stackSize, setStackSize] = useState<{ height: number; header: number } | null>(null)
  useLayoutEffect(() => {
    const stack = stackRef.current
    if (!stack || !compare) return
    const measure = () => {
      const height = stack.clientHeight
      const header = parseFloat(getComputedStyle(stack).getPropertyValue('--asset-header-h')) || 0
      setStackSize((current) => (current?.height === height && current.header === header ? current : { height, header }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stack)
    return () => observer.disconnect()
  }, [compare])
  const padding = useMemo(() => (stackSize ? comparePadding(stackSize) : null), [stackSize])
  /* The solution's map keeps its place in the tree, so opening a comparison adds a map rather than reloading it. */
  return (
    <div
      ref={stackRef}
      className={styles.mapStack}
      style={compare ? ({ '--compare-split': split } as CSSProperties) : undefined}
    >
      {compare ? (
        <div className={`${styles.comparePane} ${styles.compareBefore}`}>
          <EstateMap
            className={styles.compareMap}
            camera={camera}
            scene={compare.before.scene}
            hidden={NO_HIDDEN}
            padding={padding?.before ?? MAP_PADDING}
            controlsClassName={styles.mapControls}
            cameraLink={cameraLink}
          />
          <span className={styles.compareTag}>{compare.labels[0]}</span>
          <FindingMapData layers={compare.before.layers} towers={compare.before.scene.towers} />
        </div>
      ) : null}
      <div className={compare ? `${styles.comparePane} ${styles.compareAfter}` : styles.mapSingle}>
        <EstateMap
          className={compare ? styles.compareMap : undefined}
          camera={camera}
          scene={stage.scene}
          hidden={NO_HIDDEN}
          padding={preview ? PREVIEW_PADDING : compare ? (padding?.after ?? MAP_PADDING) : MAP_PADDING}
          controls={!preview && !compare}
          interactive={!preview}
          controlsClassName={styles.mapControls}
          handleRef={handleRef}
          cameraLink={compare ? cameraLink : undefined}
        />
        {compare ? <span className={styles.compareTag}>{compare.labels[1]}</span> : null}
        {preview ? null : <FindingMapData layers={stage.layers} towers={stage.scene.towers} />}
      </div>
      {compare ? <CompareHandle stackRef={stackRef} split={split} onSplit={setSplit} /> : null}
    </div>
  )
}

/** The story map with whatever the reply annotated on it. */
export function LandingAskMap({ snapshot, ...rest }: LandingAskMapProps) {
  const place = isFindingPlace(snapshot?.findingPlace) ? snapshot.findingPlace : null
  if (place) return <FindingPlaceMap place={place} {...rest} />
  return <ReplyMap snapshot={snapshot} {...rest} />
}

/** After the tiles paint: long enough for the scene to finish growing in. */
const BACKGROUND_CAPTURE_SETTLE_MS = 1700

/**
 * Renders a reply's not-yet-opened finding views off screen, one at a time, so every map card has its
 * thumbnail before the user clicks it.
 */
export function FindingCaptureQueue({
  pending,
  onCapture,
}: {
  pending: { stateId: string; snapshot: StoryAiSnapshot }[]
  onCapture: (stateId: string, capture: StoryMapCapture) => void
}) {
  const next = pending.find((item) => isFindingPlace(item.snapshot.findingPlace))
  const place = next?.snapshot.findingPlace
  if (!next || !isFindingPlace(place)) return null
  return (
    <div className={styles.captureStage} aria-hidden>
      <QueuedCapture key={next.stateId} stateId={next.stateId} place={place} onCapture={onCapture} />
    </div>
  )
}

function QueuedCapture({
  stateId,
  place,
  onCapture,
}: {
  stateId: string
  place: FindingStageId
  onCapture: (stateId: string, capture: StoryMapCapture) => void
}) {
  const handleRef = useRef<EstateMapHandle>(null)
  const timerRef = useRef(0)
  const stage = findingStage(place)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const onReady = useCallback(
    (ready: 'loaded' | 'painted') => {
      if (ready !== 'painted') return
      timerRef.current = window.setTimeout(() => {
        void handleRef.current?.capture().then((shot) => {
          if (shot) onCapture(stateId, shot)
        })
      }, BACKGROUND_CAPTURE_SETTLE_MS)
    },
    [stateId, onCapture],
  )
  return (
    <EstateMap
      camera={stage.camera}
      scene={stage.scene}
      hidden={NO_HIDDEN}
      padding={MAP_PADDING}
      controls={false}
      interactive={false}
      handleRef={handleRef}
      onReady={onReady}
    />
  )
}

function ReplyMap({ snapshot, capture, onCapture, preview = false }: LandingAskMapProps) {
  const handleRef = useRef<StoryMapHandle | null>(null)
  const onHandle = useCallback((handle: StoryMapHandle | null) => {
    handleRef.current = handle
  }, [])
  const region = useMemo(() => (snapshot?.region ? snapshotRegion(snapshot) : null), [snapshot])
  const annotation = useMemo(() => {
    const request = snapshot?.annotation
    if (!request) return null
    if (request.location) return locationAnnotation(request.slide, request.location)
    return request.kind === 'markers' ? schoolMarkersAnnotation(request.slide) : topSchoolsAnnotation(request.slide)
  }, [snapshot])
  const cameraRequest = useMemo(() => (snapshot?.camera ? { camera: snapshot.camera } : null), [snapshot])

  useEffect(() => {
    if (!capture) return
    const timer = window.setTimeout(() => {
      void handleRef.current?.capture().then((shot) => onCapture(capture.stateId, shot))
    }, capture.delay)
    return () => window.clearTimeout(timer)
  }, [capture, onCapture])

  return (
    <StoryMap
      sceneIndex={0}
      framePhase={0}
      flyToScene={false}
      cameraPadding={preview ? PREVIEW_PADDING : MAP_PADDING}
      zoomOffset={preview ? PREVIEW_ZOOM_OFFSET : undefined}
      interactive={!preview}
      className={preview ? mapStyles.noActions : undefined}
      controlsClassName={styles.mapControls}
      region={region}
      annotation={annotation}
      cameraRequest={cameraRequest}
      onHandle={onHandle}
    />
  )
}
