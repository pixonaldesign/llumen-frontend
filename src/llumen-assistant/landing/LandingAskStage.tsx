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
  type ReactNode,
  type Ref,
} from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
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
import { StoryMap, type StoryMapAnnotationLayer, type StoryMapHandle } from '../story/StoryMap'
import styles from './LandingAskStage.module.css'
import { findingAreas, findingRegion, findingSceneIndex, isFindingPlace } from './landingFindingExperiences'

/** Loads the asset builder's styles only once Data or Source is opened. */
const LandingAssetPanels = lazy(() => import('./LandingAssetPanels'))

const MORPH_IN_S = 0.68
const MORPH_OUT_S = 0.5
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

/** Matches `.stage[data-shrunk='true']`'s corner radius. */
const SHRUNK_RADIUS_PX = 16
const fullClip = (radius: number) => `inset(0px 0px 0px 0px round ${radius}px)`

const ESCAPE_OWNERS = '[data-lc-sessions-menu], [data-lc-conversation-menu], [data-lc-share-modal]'

export type LandingAskStageHandle = { close: () => void }

export type LandingAskStageProps = {
  /** What the stage grows out of: the AI bar, or a finding's Tell Me More. */
  origin: DOMRect
  /** `origin`'s corner radius; the AI bar's by default. */
  originRadius?: number
  /** The bar the stage shrinks back into on close (it may have changed size since); null goes back to `origin`. */
  returnTo: () => DOMRect | null
  title: string
  header: ReactNode
  /** `close()` shrinks the stage back into the bar, then calls `onClosed`. */
  handleRef?: Ref<LandingAskStageHandle>
  thinking: boolean
  /** The map slides in from the right and the chat moves to the left column. */
  mapOpen: boolean
  /** A centred window over the landing instead of full screen. */
  shrunk?: boolean
  chat: ReactNode
  map: ReactNode
  onClosed: () => void
}

export function LandingAskStage({
  origin,
  originRadius = BAR_RADIUS_PX,
  returnTo,
  title,
  header,
  handleRef,
  thinking,
  mapOpen,
  shrunk = false,
  chat,
  map,
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
      { clipPath: clipFor(origin, originRadius, el.getBoundingClientRect()) },
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
  }, [origin, originRadius, reduceMotion])

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    const el = stageRef.current
    if (!el || reduceMotion) {
      onClosed()
      return
    }
    const bar = returnTo()
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { clipPath: fullClip(shrunk ? SHRUNK_RADIUS_PX : 0) },
      {
        clipPath: bar
          ? clipFor(bar, BAR_RADIUS_PX, el.getBoundingClientRect())
          : clipFor(origin, originRadius, el.getBoundingClientRect()),
        duration: MORPH_OUT_S,
        ease: 'power3.inOut',
        onComplete: onClosed,
      },
    )
  }, [closing, onClosed, origin, originRadius, reduceMotion, returnTo, shrunk])

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
      data-map={mapOpen ? 'true' : 'false'}
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
        <section className={styles.mapPane} aria-label="Map" aria-hidden={!mapOpen}>
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
    return () => observer.disconnect()
  }, [])

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
}

/** The story map with whatever the reply annotated on it. */
export function LandingAskMap({ snapshot, capture, onCapture }: LandingAskMapProps) {
  const handleRef = useRef<StoryMapHandle | null>(null)
  const onHandle = useCallback((handle: StoryMapHandle | null) => {
    handleRef.current = handle
  }, [])
  const place = isFindingPlace(snapshot?.findingPlace) ? snapshot.findingPlace : null
  const region = useMemo(() => {
    if (place) return findingRegion(place)
    return snapshot?.region ? snapshotRegion(snapshot) : null
  }, [place, snapshot])
  const annotations = useMemo<StoryMapAnnotationLayer | null>(
    () => (place ? { items: findingAreas(place), validity: {}, selectedId: null, drawing: null } : null),
    [place],
  )
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
      sceneIndex={place ? findingSceneIndex(place) : 0}
      framePhase={0}
      flyToScene={false}
      cameraPadding={MAP_PADDING}
      controlsClassName={styles.mapControls}
      region={region}
      annotation={annotation}
      annotations={annotations}
      cameraRequest={cameraRequest}
      onHandle={onHandle}
    />
  )
}
