import {
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

const MORPH_IN_S = 0.68
const MORPH_OUT_S = 0.5
/** The AI bar's corner radius, so the stage starts and ends on the bar's own shape. */
const BAR_RADIUS_PX = 24
const MAP_PADDING = { top: 40, right: 40, bottom: 40, left: 40 }

function clipFor(rect: DOMRect, radius: number) {
  const right = Math.max(0, window.innerWidth - rect.right)
  const bottom = Math.max(0, window.innerHeight - rect.bottom)
  return `inset(${rect.top}px ${right}px ${bottom}px ${rect.left}px round ${radius}px)`
}

const FULL_CLIP = 'inset(0px 0px 0px 0px round 0px)'

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
  chat: ReactNode
  map: ReactNode
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
      { clipPath: clipFor(origin, BAR_RADIUS_PX) },
      {
        clipPath: FULL_CLIP,
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
    const el = stageRef.current
    if (!el || reduceMotion) {
      onClosed()
      return
    }
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { clipPath: FULL_CLIP },
      {
        clipPath: clipFor(returnTo() ?? origin, BAR_RADIUS_PX),
        duration: MORPH_OUT_S,
        ease: 'power3.inOut',
        onComplete: onClosed,
      },
    )
  }, [closing, onClosed, origin, reduceMotion, returnTo])

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
