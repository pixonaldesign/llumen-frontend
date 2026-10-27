import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowsInSimple,
  ArrowsOutSimple,
  CalendarBlank,
  CaretDown,
  ChatText,
  Check,
  MapPin,
  Plus,
  ThumbsDown,
  ThumbsUp,
  X,
} from '@phosphor-icons/react'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import { BriefingAgentGrid } from './BriefingAgents'
import { BriefingAppHighlights, BriefingAppsCarousel } from './BriefingApps'
import { BOARD_CELL, ROOMY_BOARD_CELL, boardColumnsFor } from './assetBoardLayout'
import { paletteFromPixels } from './mapPalette'
import { BriefingAssetBoard } from './BriefingAssetBoard'
import { AssetCard, BriefingAssetGrid } from './BriefingAssets'
import { BOARD_ASSETS, DEFAULT_BOARD_ORDER } from './briefingAssetData'
import { FEED_STOPS, type FeedChart, type FeedStop } from './briefingFindings'
import { BriefingMap, type BriefingMapEnter } from './BriefingMap'
import { BRIEFING_PLACES } from './briefingMapPlaces'
import { STORY_CAMERA_PADDING } from '../story/StoryMap'
import { storySceneAt } from '../story/storyDemoScenes'
import type { LandingTellMeMorePayload } from './LandingHomeDefault'
import { LandingTopBar, type TopBarView } from './LandingTopBar'
import { VoteButton } from './VoteButton'
import { DEFAULT_FINDINGS_STYLE, type FindingsStyle, type TopBarVariant } from '../prototypeChrome'
import home from './LandingHome.module.css'
import styles from './BriefingLanding.module.css'

const AssetsPickerModal = lazy(() =>
  import('../story/StoryEditPanel').then((module) => ({ default: module.AssetsPickerModal })),
)
const StudioView = lazy(() => import('../studio/StudioView').then((module) => ({ default: module.StudioView })))

/** One read-out across every asset in the grid; numbers match briefingAssetData. */
type SummaryPart = { text: string; highlight?: boolean }

/** What is happening now, in two lines at most. */
const ASSETS_STATEMENT: SummaryPart[] = [
  { text: 'Coastal air quality crossed the sensitive\u2011groups line overnight, ' },
  { text: 'up 18% to 142', highlight: true },
  { text: '.' },
]

/** What the assets below say about it. */
const ASSETS_DETAIL: SummaryPart[] = [
  { text: 'AQI has stayed above the line since 09:00. Heat-related clinic visits reached ' },
  { text: '1,284 this week', highlight: true },
  { text: ', 22% higher and peaking at 244 on Sunday, while bus delays sit on ' },
  { text: 'Routes 54 and 65', highlight: true },
  {
    text: ' at 18 and 14 minutes late. Non-compliant facilities run 14% over their permit limits, Al Mussafah is now 31% industrial and adults make up 68% of residents. Network pressure in Al Ain holds at ',
  },
  { text: '62% of target', highlight: true },
  { text: ', and station coverage is thinnest in Al Dhafra at 76%.' },
]

/** The same read-out as ASSETS_DETAIL, one insight to a bullet, under My Board's statement. */
const ASSETS_INSIGHTS: SummaryPart[][] = [
  [
    { text: 'Heat-related clinic visits reached ' },
    { text: '1,284 this week', highlight: true },
    { text: ', 22% higher and peaking at 244 on Sunday.' },
  ],
  [
    { text: 'Bus delays sit on ' },
    { text: 'Routes 54 and 65', highlight: true },
    { text: ' at 18 and 14 minutes late.' },
  ],
  [
    {
      text: 'Non-compliant facilities run 14% over their permit limits, and Al Mussafah is now 31% industrial.',
    },
  ],
  [
    { text: 'Network pressure in Al Ain holds at ' },
    { text: '62% of target', highlight: true },
    { text: ', and station coverage is thinnest in Al Dhafra at 76%.' },
  ],
]

function SummaryText({ parts }: { parts: SummaryPart[] }) {
  return parts.map((part) =>
    part.highlight ? (
      <span key={part.text} className={home.findingHighlight}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  )
}

/** Once Assets has played, the charts load centred for this long before the grid moves aside for the summary. */
const ASSETS_SPLIT_MS = 1700

/** Page scroll past which the Assets section counts as open and the composer leaves the centre. */
const ASSETS_OPEN_PX = 8

/** Findings style 6's slide between the findings and Assets and Apps; keep in step with --side-slide. */
/** A story opens on its first scene, framed clear of its insight column. */
const STORY_OPENING_PLACE = BRIEFING_PLACES['abu-dhabi']
const STORY_ENTER: BriefingMapEnter = { camera: storySceneAt(0).camera, padding: STORY_CAMERA_PADDING }
/** BriefingMap's flight (2200ms) plus slack. */
const STORY_FLIGHT_FALLBACK_MS = 3200
const SIDE_SLIDE_MS = 900
const SIDE_SLIDE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
/** Scrolling a scrolled modal grid back to the top before it closes: quicker for short distances. */
const REWIND_MIN_MS = 280
const REWIND_MAX_MS = 640
const REWIND_MS_PER_PX = 0.35
/** The Assets summary beside the grid never gets narrower than this; the grid drops a column first. */
const SIDE_INTRO_MIN = 480
/** Findings style 8's grid is a narrow column down the modal's right, and its edge peek one down the page's. */
const FLOATING_BOARD_COLUMNS = 2
/**
 * The edge peek shows, at full size, as many whole cards down the grid's first column as fit above the
 * composer (never fewer than this many), centred in that room.
 */
const PEEK_CARDS_MIN = 1
/**
 * Findings style 8's peek always brings three cards, and fills the rest of its room with any card that
 * starts at least FLOATING_PEEK_PARTIAL px above where the modal ends, cut off there.
 */
const FLOATING_PEEK_CARDS_MIN = 3
const FLOATING_PEEK_PARTIAL = 96
/** The edge peek's room ends this far above the composer, as the style 8 modal does. */
const PEEK_COMPOSER_GAP = 28

/** The Agents section is hidden for now; Apps follows Assets directly. */
const SHOW_AGENTS = false

/**
 * Assets play their entrance once their top passes this share of the page, and reset only once
 * scrolled back below the other; visiting Agents keeps them played.
 */
const ASSETS_PLAY_AT = 0.45
const ASSETS_RESET_AT = 0.8

/** The findings carousel advances on its own after this long on a stop. */
const FEED_AUTOPLAY_MS = 9000
/** One finding fades out over this long before the next fades in (CSS .bubbleBody repeats it). */
const FINDING_FADE_MS = 320
/** Dots shown at once; with more findings, the last two on a side with more shrink and fade. */
const FEED_DOTS_VISIBLE = 7
/** How far past the finding's content (category to actions) the pointer still holds autoplay, in px. */
const HOLD_ZONE = { x: 70, top: 220, bottom: 144 }

/** One-section glide; longer jumps (Home, End) take up to the max. */
const PAGE_GLIDE_MS = 900
const PAGE_GLIDE_MAX_MS = 1400
/** Wheel travel that starts a glide, and the quiet gap that ends a gesture (trackpad inertia included). */
const WHEEL_STEP_PX = 24
const WHEEL_GESTURE_GAP_MS = 160

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** True when an element between target and page can still scroll in the wheel's direction. */
function innerScrolls(target: Element, page: Element, deltaY: number) {
  for (let el: Element | null = target; el && el !== page; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (!/(auto|scroll|overlay)/.test(overflowY) || el.scrollHeight <= el.clientHeight + 1) continue
    if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
    if (deltaY < 0 && el.scrollTop > 0) return true
  }
  return false
}

export type BriefingLandingProps = {
  topBar: TopBarVariant
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  /**
   * A finding's View button has started flying the map into the story's opening view. With this set,
   * the story is opened by the parent (under this page) rather than through `onOpenStory`.
   */
  onStoryFlight?: (storyId: string) => void
  /** The map has reached the story's opening view. */
  onStoryArrive?: () => void
  /**
   * The story is mounted over this page with its map hidden (`cover`), so this map stands in for it
   * until the story map has loaded and fades in over it (`fade`).
   */
  storyHandoff?: 'cover' | 'fade'
  /**
   * Back from a story. The map (still on the story's opening view) snaps to this camera and flies home
   * to the findings, and the page's chrome returns.
   */
  storyRelease?: BriefingMapEnter | 'home' | null
  /**
   * Back from a story: `hold` mounts this page under the story with its map on the story's camera
   * (`from`) and its chrome hidden; `fly` flies the map back to the findings as the chrome returns.
   */
  storyReturn?: { from: BriefingMapEnter; phase: 'hold' | 'fly' } | null
  /** The held map's first load (BriefingMap `onReady`), so the story can dissolve onto it. */
  onStoryReturnReady?: (stage: 'loaded' | 'painted') => void
  reserveComposer?: boolean
  /**
   * Fires on every scroll frame with how far Assets has scrolled in (0 at rest, 1 once it reaches the
   * top bar), so the composer can follow the scroll from the centre to the bottom.
   */
  onAssetsProgress?: (progress: number) => void
  /** Fires with true on every scroll event of the Briefing page, and false once it ends (snap included). */
  onScrollActivity?: (scrolling: boolean) => void
  /** Lays out the findings stage only; the composer dock follows it through the same value. */
  findingsStyle?: FindingsStyle
  onFindingsStyleChange?: (style: FindingsStyle) => void
  /** An alert aurora holds the middle of the findings stage: the greeting and finding step aside, and the carousel waits. */
  alert?: boolean
  /** A toast finding shown in the finding's place until it is dismissed; the carousel waits underneath. */
  findingToast?: ReactNode
  /** The top bar's Briefing / Studio switch; the Studio covers the page under the bar. Uncontrolled when unset. */
  view?: TopBarView
  onViewChange?: (view: TopBarView) => void
}

export function BriefingLanding({
  topBar,
  onTellMeMore,
  onOpenStory,
  onStoryFlight,
  onStoryArrive,
  storyHandoff,
  storyRelease = null,
  storyReturn = null,
  onStoryReturnReady,
  reserveComposer = true,
  onAssetsProgress,
  onScrollActivity,
  findingsStyle = DEFAULT_FINDINGS_STYLE,
  onFindingsStyleChange,
  alert = false,
  findingToast = null,
  view: viewProp,
  onViewChange,
}: BriefingLandingProps) {
  const [ownView, setOwnView] = useState<TopBarView>('briefing')
  const view = viewProp ?? ownView
  const inStudio = view === 'studio'
  const changeView = (next: TopBarView) => {
    if (viewProp === undefined) setOwnView(next)
    onViewChange?.(next)
  }
  const [active, setActive] = useState(0)
  /** The story whose opening view the map is flying to; the page's chrome steps aside meanwhile. */
  const [storyFlight, setStoryFlight] = useState<string | null>(null)
  if (storyRelease && storyFlight) setStoryFlight(null)
  const arrivedRef = useRef(false)
  const [assetsOpen, setAssetsOpen] = useState(false)
  /** Findings style 8 is style 6 with Assets and Apps as a modal over the map instead of a slide past it. */
  const floating = findingsStyle === 8
  /** Findings styles 6 and 8 have no lower sections: Assets and Apps come in from the right instead. */
  const sideways = findingsStyle === 6 || floating
  const [sideAssets, setSideAssets] = useState(false)
  const [addingAsset, setAddingAsset] = useState(false)
  const closeAddAsset = useCallback(() => setAddingAsset(false), [])
  const sideViewRef = useRef<HTMLElement>(null)
  /** Where each asset sits on the Assets grid; dragging a card reorders it, and the edge peek follows. */
  const [boardOrder, setBoardOrder] = useState<readonly string[]>(DEFAULT_BOARD_ORDER)
  const [boardColumns, setBoardColumns] = useState<number>()
  /** The room the edge peek has above the composer, in px; the grid brings in the same cards when it docks. */
  const [peekRoom, setPeekRoom] = useState(0)
  const peekEdge = useMemo(
    () =>
      floating
        ? { room: peekRoom, min: FLOATING_PEEK_CARDS_MIN, partial: FLOATING_PEEK_PARTIAL }
        : { room: peekRoom, min: PEEK_CARDS_MIN },
    [peekRoom, floating],
  )
  const samplerRef = useRef<(() => Promise<ImageData | null>) | null>(null)
  const onMapSampler = useCallback((sample: (() => Promise<ImageData | null>) | null) => {
    samplerRef.current = sample
  }, [])
  /** Findings style 7 keeps Assets in a panel beside the findings; expanding it covers them with Assets and Apps. */
  const paneled = findingsStyle === 7
  const [panelOpen, setPanelOpen] = useState(false)
  const away = (sideways && sideAssets) || (paneled && panelOpen)
  /** Style 8's modal floats over the findings: they play on under it, wherever the pointer is. */
  const overlaid = floating && away
  /** Styles 6 and 7 have no lower sections to scroll to. */
  const lowerless = sideways || paneled
  /** Previous and next sit beside the dots instead of at the stage's edges. */
  const dotArrows = findingsStyle === 5 || lowerless
  /** The asset stack has flown into the grid's column: the grid's own cards take over and the rest follow. */
  const [landed, setLanded] = useState(false)
  const peekRef = useRef<HTMLDivElement>(null)
  const sideGridRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<Animation | null>(null)
  const rewindRef = useRef(0)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const lowerRef = useRef<HTMLDivElement>(null)
  /** The first section after Assets: Agents, or Apps while Agents is hidden. */
  const afterAssetsRef = useRef<HTMLElement>(null)
  const [assetsPlay, setAssetsPlay] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement | null>(null)
  const progressRef = useRef(onAssetsProgress)
  const scrollActivityRef = useRef(onScrollActivity)
  const [autoplay] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  /** The pointer (or keyboard focus) is on the finding: autoplay holds until it leaves. */
  const [held, setHeld] = useState(false)

  const stop = FEED_STOPS[active]

  const returnHeld = storyReturn?.phase === 'hold'
  /** The map is flying into the story, or holding that view underneath it. */
  const opening = storyFlight !== null && !storyRelease && !returnHeld
  const mapPlace = useMemo(() => {
    if (opening || returnHeld) return STORY_OPENING_PLACE
    for (let index = active; index >= 0; index -= 1) {
      const place = FEED_STOPS[index].place
      if (place) return BRIEFING_PLACES[place]
    }
    return BRIEFING_PLACES['abu-dhabi']
  }, [active, opening, returnHeld])

  const enterStory = useCallback(
    (storyId: string) => {
      if (storyFlight) return
      if (!onStoryFlight || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onOpenStory?.(storyId)
        return
      }
      arrivedRef.current = false
      setStoryFlight(storyId)
      onStoryFlight(storyId)
    },
    [onOpenStory, onStoryFlight, storyFlight],
  )

  const arriveAtStory = useCallback(() => {
    if (!storyFlight || arrivedRef.current) return
    arrivedRef.current = true
    onStoryArrive?.()
  }, [onStoryArrive, storyFlight])

  /** Lands the flight even if the map never reports its arrival (no token, or the flight was cut short). */
  useEffect(() => {
    if (!storyFlight) return
    const timer = window.setTimeout(arriveAtStory, STORY_FLIGHT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [storyFlight, arriveAtStory])

  const syncPage = useCallback(() => {
    const page = pageRef.current
    if (!page) return
    const top = page.scrollTop
    const open = top > ASSETS_OPEN_PX
    setAssetsOpen((current) => (current === open ? current : open))
    const lower = lowerRef.current
    const next = afterAssetsRef.current
    if (!lower || !next) {
      rootRef.current?.style.setProperty('--assets-t', '0')
      return
    }
    const height = page.clientHeight
    const bar = barRef.current?.offsetHeight ?? 0
    const assetsEnd = lower.offsetTop + next.offsetTop - height
    const blendFrom = Math.max(lower.offsetTop - bar, assetsEnd)
    const blendTo = lower.offsetTop + next.offsetTop
    const blend = Math.min(1, Math.max(0, (top - blendFrom) / Math.max(1, blendTo - blendFrom)))
    rootRef.current?.style.setProperty('--agents-t', blend.toFixed(3))
    const reveal = Math.min(1, Math.max(0, top / Math.max(1, lower.offsetTop - bar)))
    rootRef.current?.style.setProperty('--assets-t', reveal.toFixed(3))
    progressRef.current?.(reveal)
    const assetsTop = lower.offsetTop - top
    setAssetsPlay((current) => {
      if (assetsTop > height * ASSETS_RESET_AT) return false
      if (assetsTop < height * ASSETS_PLAY_AT) return true
      return current
    })
  }, [])

  const stepFeed = useCallback((delta: number) => {
    setActive((index) => (index + delta + FEED_STOPS.length) % FEED_STOPS.length)
  }, [])

  useEffect(() => {
    progressRef.current = onAssetsProgress
    scrollActivityRef.current = onScrollActivity
  }, [onAssetsProgress, onScrollActivity])

  useEffect(() => () => progressRef.current?.(0), [])

  const pagingRef = useRef({ frame: 0, to: null as number | null, locked: false, lastWheel: 0, wheel: 0 })

  /** Section tops: the findings, Assets under the bar, then every later section by its bottom edge. */
  const sectionStops = useCallback(() => {
    const page = pageRef.current
    const lower = lowerRef.current
    if (!page || !lower) return [0]
    const max = page.scrollHeight - page.clientHeight
    const stops = [0, lower.offsetTop - (barRef.current?.offsetHeight ?? 0)]
    for (let section = afterAssetsRef.current as Element | null; section; section = section.nextElementSibling) {
      if (!(section instanceof HTMLElement)) continue
      stops.push(lower.offsetTop + section.offsetTop + section.offsetHeight - page.clientHeight)
    }
    return stops
      .map((stop) => Math.min(max, Math.max(0, stop)))
      .sort((a, b) => a - b)
      .filter((stop, index, all) => index === 0 || stop - all[index - 1] > 2)
  }, [])

  const glideTo = useCallback((target: number) => {
    const page = pageRef.current
    if (!page) return
    const paging = pagingRef.current
    window.cancelAnimationFrame(paging.frame)
    const from = page.scrollTop
    const distance = target - from
    if (Math.abs(distance) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      page.scrollTop = target
      paging.to = null
      return
    }
    const pages = Math.abs(distance) / Math.max(1, page.clientHeight)
    const duration = Math.min(PAGE_GLIDE_MAX_MS, PAGE_GLIDE_MS + (pages - 1) * 260)
    const start = performance.now()
    paging.to = target
    scrollActivityRef.current?.(true)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      page.scrollTop = from + distance * easeInOutCubic(t)
      if (t < 1) {
        paging.frame = window.requestAnimationFrame(tick)
        return
      }
      paging.to = null
      scrollActivityRef.current?.(false)
    }
    paging.frame = window.requestAnimationFrame(tick)
  }, [])

  const stepSection = useCallback(
    (direction: 1 | -1) => {
      const page = pageRef.current
      if (!page) return
      const stops = sectionStops()
      const from = pagingRef.current.to ?? page.scrollTop
      const next =
        direction > 0 ? stops.find((stop) => stop > from + 2) : [...stops].reverse().find((stop) => stop < from - 2)
      if (next !== undefined) glideTo(next)
    },
    [glideTo, sectionStops],
  )

  /** After a touch drag or scrollbar drag, glide to the nearest section. */
  const settlePage = useCallback(() => {
    const page = pageRef.current
    if (!page || pagingRef.current.to !== null) return
    const top = page.scrollTop
    const nearest = sectionStops().reduce((best, stop) => (Math.abs(stop - top) < Math.abs(best - top) ? stop : best))
    if (Math.abs(nearest - top) > 2) glideTo(nearest)
  }, [glideTo, sectionStops])

  useEffect(() => {
    const paging = pagingRef.current
    return () => window.cancelAnimationFrame(paging.frame)
  }, [])

  const showAssets = useCallback(() => {
    const lower = lowerRef.current
    if (lower) glideTo(lower.offsetTop - (barRef.current?.offsetHeight ?? 0))
  }, [glideTo])

  /*
   * Wheels page between sections with an eased glide (one gesture, one section), except where an inner
   * scroller (the Assets grid) can still move. Keep wheels away from the map (it would zoom) unless it
   * is a pinch.
   */
  useEffect(() => {
    const root = rootRef.current
    const page = pageRef.current
    if (!root || !page) return
    const onWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target && barRef.current?.contains(target)) return
      if (event.ctrlKey && target && mapRef.current?.contains(target)) return
      event.stopPropagation()
      if (event.ctrlKey || !target || !page.contains(target) || innerScrolls(target, page, event.deltaY)) return
      event.preventDefault()
      const paging = pagingRef.current
      const now = performance.now()
      const gap = now - paging.lastWheel
      paging.lastWheel = now
      if (paging.to !== null) return
      if (gap > WHEEL_GESTURE_GAP_MS) {
        paging.locked = false
        paging.wheel = 0
      }
      if (paging.locked) return
      paging.wheel += event.deltaY * (event.deltaMode === 1 ? 16 : 1)
      if (Math.abs(paging.wheel) < WHEEL_STEP_PX) return
      paging.locked = true
      stepSection(paging.wheel > 0 ? 1 : -1)
      paging.wheel = 0
    }
    root.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => root.removeEventListener('wheel', onWheel, { capture: true })
  }, [stepSection])

  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const onPage = !target || target === document.body || page.contains(target)
      if (!onPage || target?.isContentEditable || target?.closest('input, textarea, select')) return
      if (event.key === ' ' && target && target !== document.body && target.closest('button, a')) return
      const keys: Record<string, 1 | -1 | 'first' | 'last'> = {
        ArrowDown: 1,
        PageDown: 1,
        ArrowUp: -1,
        PageUp: -1,
        Home: 'first',
        End: 'last',
        ' ': event.shiftKey ? -1 : 1,
      }
      const move = keys[event.key]
      if (move === undefined) return
      event.preventDefault()
      if (move === 'first' || move === 'last') {
        const stops = sectionStops()
        glideTo(move === 'first' ? stops[0] : stops[stops.length - 1])
      } else stepSection(move)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [glideTo, sectionStops, stepSection])

  const [frame, setFrame] = useState<{ bar: number; page: number } | null>(null)
  useLayoutEffect(() => {
    const bar = barRef.current
    const page = pageRef.current
    if (!bar || !page) return
    const measure = () => {
      const next = { bar: bar.offsetHeight, page: page.clientHeight }
      setFrame((current) => (current?.bar === next.bar && current.page === next.page ? current : next))
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(bar)
    resize.observe(page)
    return () => resize.disconnect()
  }, [])

  useEffect(() => {
    syncPage()
  }, [frame, findingsStyle, syncPage])

  /** Without lower sections the page leaves its findings only while Assets and Apps cover them. */
  useEffect(() => {
    if (lowerless) progressRef.current?.(away ? 1 : 0)
  }, [lowerless, away])

  /**
   * The Assets grid's column hugs its cards and the summary takes the rest, so the cards come from the
   * view's width less the summary's minimum, the paddings and the gap between them.
   */
  useLayoutEffect(() => {
    const grid = sideGridRef.current
    const view = sideViewRef.current
    if (!grid || !view) return
    const wrap = grid.firstElementChild
    const measure = () => {
      /* Style 8's grid pads its end less the scrollbar's gutter, to match the modal's start padding. */
      const gutter = floating ? grid.offsetWidth - grid.clientWidth : 0
      if (floating) view.style.setProperty('--side-gutter', `${gutter}px`)
      const box = getComputedStyle(view)
      const inset = wrap ? parseFloat(getComputedStyle(wrap).paddingInlineEnd || '0') : 0
      const room =
        view.clientWidth -
        parseFloat(box.paddingInlineStart || '0') -
        parseFloat(box.columnGap || '0') -
        SIDE_INTRO_MIN -
        inset -
        gutter
      const fit = boardColumnsFor(room, floating ? ROOMY_BOARD_CELL : BOARD_CELL)
      setBoardColumns(floating ? Math.min(FLOATING_BOARD_COLUMNS, fit) : fit)
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(view)
    if (wrap) resize.observe(wrap)
    return () => resize.disconnect()
  }, [sideways, floating])

  /**
   * Sizes the edge peek to the Assets grid, so the flight between them only moves it, and finds its room
   * above the composer, where its whole cards sit centred (--peek-shift). The modal's peek stays level
   * with its grid instead, so opening it only slides the cards across.
   */
  useLayoutEffect(() => {
    const peek = peekRef.current
    const grid = sideGridRef.current
    const view = sideViewRef.current
    const board = grid?.querySelector<HTMLElement>('[data-asset-board]')
    const stack = peek?.querySelector<HTMLElement>('[data-asset-board]')
    if (!peek || !grid || !view || !board || !stack) return
    const fit = () => {
      const slot = board.getBoundingClientRect()
      const box = view.getBoundingClientRect()
      const top = slot.top - box.top + view.offsetTop + grid.scrollTop
      peek.style.setProperty('--peek-top', `${top}px`)
      peek.style.setProperty('--peek-w', `${slot.width}px`)
      const composer = parseFloat(getComputedStyle(peek).getPropertyValue('--side-composer')) || 0
      const height = peek.offsetParent?.clientHeight ?? window.innerHeight
      const room = Math.max(0, height - top - composer - PEEK_COMPOSER_GAP)
      setPeekRoom(room)
      peek.style.setProperty('--peek-room', `${room}px`)
      const shift = floating ? 0 : Math.max(0, (room - stack.offsetHeight) / 2)
      peek.style.setProperty('--peek-shift', `${shift}px`)
    }
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(grid)
    resize.observe(board)
    resize.observe(stack)
    return () => resize.disconnect()
  }, [sideways, floating])

  /**
   * Flies the asset stack into the grid (or back out) while the stage and the view slide past. Opening
   * tints the Assets view with the map it slides in over, as the map looks right now.
   */
  const flyBoard = useCallback((open: boolean) => {
    if (open) {
      samplerRef.current?.().then((pixels) => {
        const palette = pixels && paletteFromPixels(pixels)
        const view = sideViewRef.current
        if (!palette || !view) return
        view.style.setProperty('--side-bg-top', palette.top)
        view.style.setProperty('--side-bg-bottom', palette.bottom)
        view.style.setProperty('--side-bg-accent', palette.accent)
      })
    }
    setSideAssets(open)
    setLanded(false)
    const current = flightRef.current
    if (current?.playState === 'running') {
      current.reverse()
      current.onfinish = open ? () => setLanded(true) : () => current.cancel()
      return
    }
    current?.cancel()
    const peek = peekRef.current
    const grid = sideGridRef.current
    const board = grid?.querySelector<HTMLElement>('[data-asset-board]')
    const view = sideViewRef.current
    if (open && grid) grid.scrollTop = 0
    if (!peek || !grid || !board || !view || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (open) setLanded(true)
      return
    }
    const slot = board.getBoundingClientRect()
    const box = view.getBoundingClientRect()
    const x = slot.left - box.left + view.offsetLeft - peek.offsetLeft
    const y = slot.top - box.top + view.offsetTop - peek.offsetTop
    const docked = `translate(${x}px, ${y}px)`
    const flight = peek.animate(
      open ? [{ transform: 'none' }, { transform: docked }] : [{ transform: docked }, { transform: 'none' }],
      { duration: SIDE_SLIDE_MS, easing: SIDE_SLIDE_EASE, fill: 'forwards' },
    )
    flight.onfinish = open ? () => setLanded(true) : () => flight.cancel()
    flightRef.current = flight
  }, [])

  /** Closing a scrolled grid scrolls it back to its first cards first, so the stack flies out from the top. */
  const flyAssets = useCallback(
    (open: boolean) => {
      window.cancelAnimationFrame(rewindRef.current)
      const grid = sideGridRef.current
      if (open || !grid || grid.scrollTop <= 0) {
        flyBoard(open)
        return
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        grid.scrollTop = 0
        flyBoard(false)
        return
      }
      const from = grid.scrollTop
      const duration = Math.min(REWIND_MAX_MS, Math.max(REWIND_MIN_MS, from * REWIND_MS_PER_PX))
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        grid.scrollTop = from * (1 - easeInOutCubic(t))
        if (t < 1) rewindRef.current = window.requestAnimationFrame(step)
        else flyBoard(false)
      }
      rewindRef.current = window.requestAnimationFrame(step)
    },
    [flyBoard],
  )

  useEffect(
    () => () => {
      window.cancelAnimationFrame(rewindRef.current)
      flightRef.current?.cancel()
    },
    [],
  )

  /** Escape leaves the modal, unless the Add Assets picker is over it. */
  useEffect(() => {
    if (!floating || !sideAssets || addingAsset) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      flyAssets(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [floating, sideAssets, addingAsset, flyAssets])

  const blurred = !stop.place || !!findingToast
  const mapBlurred = blurred && !opening && !returnHeld
  const storyState = storyRelease
    ? 'back'
    : storyFlight
      ? (storyHandoff ?? 'flight')
      : storyReturn
        ? returnHeld
          ? 'return'
          : 'back'
        : undefined

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-findings-style={findingsStyle}
      data-alert={alert}
      data-story={storyState}
      inert={opening || returnHeld}
      style={{
        ['--feed-pad' as string]: reserveComposer ? '106px' : '48px',
        ...(frame
          ? {
              ['--briefing-bar-h' as string]: `${frame.bar}px`,
              ['--briefing-page-h' as string]: `${frame.page}px`,
            }
          : null),
      }}
    >
      <header ref={barRef} className={`${home.nav} ${styles.bar}`}>
        <LandingTopBar
          variant={topBar}
          workspaceInLogo
          showWorkspace={false}
          briefingTab
          findingsStyle={onFindingsStyleChange ? findingsStyle : undefined}
          onFindingsStyleChange={onFindingsStyleChange}
          view={view}
          onViewChange={changeView}
        />
      </header>
      {inStudio ? (
        <Suspense fallback={null}>
          <StudioView />
        </Suspense>
      ) : null}
      <div
        ref={pageRef}
        className={styles.page}
        inert={inStudio}
        onScroll={() => {
          syncPage()
          onScrollActivity?.(true)
        }}
        onScrollEnd={() => {
          if (pagingRef.current.to !== null) return
          onScrollActivity?.(false)
          settlePage()
        }}
      >
        <div className={styles.stage} data-away={away} inert={away}>
          <div ref={mapRef} className={`${styles.map}${mapBlurred ? ` ${styles.mapBlur}` : ''}`} aria-hidden>
            <BriefingMap
              place={mapPlace}
              blank={mapBlurred}
              focusRight={findingsStyle === 2 || findingsStyle === 5}
              enter={opening ? STORY_ENTER : null}
              onArrive={arriveAtStory}
              align={storyRelease && storyRelease !== 'home' ? storyRelease : null}
              start={returnHeld ? storyReturn.from : null}
              onReady={onStoryReturnReady}
              onSampler={onMapSampler}
            />
          </div>
          <div className={styles.scrim} aria-hidden />
          <div className={styles.fadeBlur} aria-hidden />
          <div className={styles.sidePanel} aria-hidden />
          <ConversationalBubble
            stop={stop}
            findingsStyle={findingsStyle}
            frozen={assetsOpen || away || storyState !== undefined}
            vote={votes[stop.id] ?? null}
            onVote={(value) =>
              setVotes((prev) => ({
                ...prev,
                [stop.id]: prev[stop.id] === value ? null : value,
              }))
            }
            onTellMeMore={onTellMeMore}
            onOpenStory={enterStory}
            toast={findingToast}
            onHoldChange={setHeld}
            controls={
              <FeedCarousel
                count={FEED_STOPS.length}
                active={active}
                running={
                  autoplay &&
                  !inStudio &&
                  (overlaid || (!held && !away)) &&
                  !assetsOpen &&
                  !alert &&
                  !findingToast &&
                  !opening &&
                  !storyRelease &&
                  !storyReturn
                }
                onSelect={setActive}
                onStep={stepFeed}
                arrows={dotArrows}
              />
            }
          />
          {dotArrows ? null : (
            <>
              <button
                type="button"
                className={`${styles.edgeArrow} ${styles.edgeArrowPrevious}`}
                aria-label="Previous finding"
                onClick={() => stepFeed(-1)}
              >
                <ArrowLeft size={20} weight="regular" aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.edgeArrow} ${styles.edgeArrowNext}`}
                aria-label="Next finding"
                onClick={() => stepFeed(1)}
              >
                <ArrowRight size={20} weight="regular" aria-hidden />
              </button>
            </>
          )}
        </div>
        {sideways ? (
          <>
            {floating ? (
              <div className={styles.sideScrim} data-shown={away} aria-hidden onClick={() => flyAssets(false)} />
            ) : null}
            <AssetsAppsView
              shown={away}
              landed={landed}
              viewRef={sideViewRef}
              gridRef={sideGridRef}
              order={boardOrder}
              columns={boardColumns}
              roomy={floating}
              edge={peekEdge}
              onReorder={setBoardOrder}
              onBack={() => flyAssets(false)}
              tools={floating ? { onAddAssets: () => setAddingAsset(true) } : undefined}
            />
            {addingAsset ? (
              <Suspense fallback={null}>
                <AssetsPickerModal onClose={closeAddAsset} />
              </Suspense>
            ) : null}
            <div
              ref={peekRef}
              className={styles.assetPeek}
              data-away={away}
              data-landed={away && landed}
              inert={away}
              role="button"
              tabIndex={0}
              aria-label="Open Assets and Apps"
              onClick={() => flyAssets(true)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                flyAssets(true)
              }}
            >
              <BriefingAssetBoard order={boardOrder} columns={boardColumns} roomy={floating} edge={peekEdge} preview />
            </div>
          </>
        ) : paneled ? (
          <AssetsPanel open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} />
        ) : (
          <div ref={lowerRef} className={styles.lower}>
            <div className={styles.lowerBg} aria-hidden />
            <AssetsSheet open={assetsOpen} play={assetsPlay} onOpen={showAssets} />
            {SHOW_AGENTS ? <AgentsSection sectionRef={afterAssetsRef} /> : null}
            <AppsSection sectionRef={SHOW_AGENTS ? undefined : afterAssetsRef} />
          </div>
        )}
      </div>
    </div>
  )
}

const ASSET_LOCATIONS = ['Abu Dhabi Emirate', 'Abu Dhabi City', 'Al Ain', 'Al Dhafra'] as const
const ASSET_PERIODS = ['Today', 'Last 7 days', 'Last 30 days', 'This year'] as const

/**
 * A dropdown's open state: a press outside `wrapRef` (and `menuRef`, for a menu portalled out of it)
 * closes it, and so does Escape, which it takes before the modal's own Escape can close the modal too.
 */
function useDropdown() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return { open, setOpen, wrapRef, menuRef }
}

function FilterSelect<T extends string>({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string
  icon: ReactNode
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  const { open, setOpen, wrapRef } = useDropdown()

  return (
    <div className={styles.filterWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.filterPill}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        onClick={() => setOpen((next) => !next)}
      >
        {icon}
        <span>{value}</span>
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className={styles.filterMenu} role="menu" aria-label={label}>
          {options.map((option) => {
            const selected = option === value
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${styles.filterMenuItem}${selected ? ` ${styles.filterMenuItemActive}` : ''}`}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                {option}
                {selected ? <Check size={16} weight="bold" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Global filters for the Assets section: location and time. */
function AssetsFilters() {
  const [location, setLocation] = useState<(typeof ASSET_LOCATIONS)[number]>('Abu Dhabi Emirate')
  const [period, setPeriod] = useState<(typeof ASSET_PERIODS)[number]>('Last 7 days')
  return (
    <div className={styles.assetsFilters} role="group" aria-label="Filters">
      <FilterSelect
        label="Location"
        icon={<MapPin size={18} weight="regular" aria-hidden />}
        options={ASSET_LOCATIONS}
        value={location}
        onChange={setLocation}
      />
      <FilterSelect
        label="Time"
        icon={<CalendarBlank size={18} weight="regular" aria-hidden />}
        options={ASSET_PERIODS}
        value={period}
        onChange={setPeriod}
      />
    </div>
  )
}

/**
 * The grid peeks and plays its charts centred, then moves into the right two thirds while a
 * one-paragraph summary appears in the left third. The grid scrolls on its own.
 */
export function AssetsSheet({ open, play, onOpen }: { open: boolean; play: boolean; onOpen: () => void }) {
  const revealScrollbar = useRevealScrollbarOnScroll()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [split, setSplit] = useState(false)
  const setScroll = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      revealScrollbar(el)
    },
    [revealScrollbar],
  )
  useEffect(() => {
    if (!open && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [open])
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setSplit(play), play && !reduce ? ASSETS_SPLIT_MS : 0)
    return () => window.clearTimeout(timer)
  }, [play])
  return (
    <section
      className={`${styles.assets}${open ? ` ${styles.assetsOpen}` : ''}`}
      aria-labelledby="briefing-assets"
      data-split={split}
      onClickCapture={(event) => {
        if (open) return
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
    >
      <div className={styles.assetsIntro} aria-hidden={!split}>
        <h2 id="briefing-assets" className={`${styles.eyebrow} ${styles.assetsIntroTitle}`}>
          Assets
        </h2>
        <AssetsFilters />
        <p className={styles.assetsSummary}>
          <SummaryText parts={ASSETS_STATEMENT} />
        </p>
        <p className={styles.assetsDetail}>
          <SummaryText parts={ASSETS_DETAIL} />
        </p>
      </div>
      <div ref={setScroll} className={styles.assetsScroll}>
        <BriefingAssetGrid play={play} />
      </div>
    </section>
  )
}

function AgentsSection({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  return (
    <section ref={sectionRef} className={styles.agents} aria-labelledby="briefing-agents">
      <header className={styles.sectionHead}>
        <h2 id="briefing-agents" className={styles.eyebrow}>
          Agents
        </h2>
        <p className={styles.sectionLead}>Workflows that watch your data and report back</p>
      </header>
      <BriefingAgentGrid />
    </section>
  )
}

function AppsSection({ sectionRef }: { sectionRef?: RefObject<HTMLElement | null> }) {
  return (
    <section ref={sectionRef} className={`${styles.agents} ${styles.apps}`} aria-labelledby="briefing-apps">
      <header className={styles.sectionHead}>
        <h2 id="briefing-apps" className={styles.eyebrow}>
          Apps
        </h2>
        <p className={styles.sectionLead}>Dashboards and slides built from your data</p>
      </header>
      <BriefingAppsCarousel />
    </section>
  )
}

/**
 * My Board's Add menu, over the grid's right edge: pin an asset or an app link to the board. The menu
 * portals to the body: inside the modal, under its backdrop filter, its own frost would not render.
 */
function BoardAddMenu({ onAddAsset }: { onAddAsset: () => void }) {
  const { open, setOpen, wrapRef, menuRef } = useDropdown()
  const [anchor, setAnchor] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [open, setOpen])

  const toggle = () => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (box) setAnchor({ top: box.bottom + 8, right: window.innerWidth - box.right })
    setOpen((next) => !next)
  }

  return (
    <div className={styles.filterWrap} ref={wrapRef}>
      <button type="button" className={styles.filterPill} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <Plus size={18} weight="regular" aria-hidden />
        <span>Add</span>
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={`${styles.filterMenu} ${styles.addMenu}`}
              style={anchor}
              role="menu"
              aria-label="Add to My Board"
            >
              <button
                type="button"
                role="menuitem"
                className={styles.filterMenuItem}
                onClick={() => {
                  setOpen(false)
                  onAddAsset()
                }}
              >
                Asset
              </button>
              <button type="button" role="menuitem" className={styles.filterMenuItem} onClick={() => setOpen(false)}>
                App Link
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/**
 * Findings style 6's second page, pushed in from the right: the Assets summary on the left and the
 * Assets grid, dashboard apps included, filling the rest. The grid scrolls on its own. Style 8's modal
 * (`tools`) has Add and close over the grid instead of a back button.
 */
function AssetsAppsView({
  shown,
  landed,
  viewRef,
  gridRef,
  order,
  columns,
  roomy,
  edge,
  onReorder,
  onBack,
  tools,
}: {
  shown: boolean
  /** The edge peek has docked: the grid itself shows in its place. */
  landed: boolean
  viewRef: RefObject<HTMLElement | null>
  gridRef: RefObject<HTMLDivElement | null>
  order: readonly string[]
  columns: number | undefined
  roomy: boolean
  /** The edge peek's room: the cards it brings in land, and the rest fade in once it docks. */
  edge: { room: number; min: number; partial?: number }
  onReorder: (order: string[]) => void
  onBack: () => void
  /** Findings style 8's modal. */
  tools?: { onAddAssets: () => void }
}) {
  const revealScrollbar = useRevealScrollbarOnScroll()
  const revealIntroScrollbar = useRevealScrollbarOnScroll()
  const setGrid = useCallback(
    (el: HTMLDivElement | null) => {
      gridRef.current = el
      revealScrollbar(el)
    },
    [gridRef, revealScrollbar],
  )
  return (
    <section
      ref={viewRef}
      className={styles.sideView}
      data-shown={shown}
      data-landed={shown && landed}
      inert={!shown}
      role={tools ? 'dialog' : undefined}
      aria-modal={tools ? true : undefined}
      aria-label="Assets and Apps"
    >
      <div className={styles.sideIntro}>
        <div className={styles.sideHead}>
          {tools ? null : (
            <button type="button" className={styles.sideBack} onClick={onBack} aria-label="Back to Findings">
              <ArrowLeft size={18} weight="regular" aria-hidden />
            </button>
          )}
          <h2 className={styles.sideTitle}>My Board</h2>
        </div>
        <AssetsFilters />
        <div ref={revealIntroScrollbar} className={styles.sideScroll}>
          <p className={styles.sideGreeting}>Good morning, Omar</p>
          <p className={styles.assetsSummary}>
            <SummaryText parts={ASSETS_STATEMENT} />
          </p>
          <h3 className={`${styles.eyebrow} ${styles.sideMoreTitle}`}>More insights</h3>
          <ul className={styles.sideInsights}>
            {ASSETS_INSIGHTS.map((parts) => (
              <li key={parts[0].text}>
                <SummaryText parts={parts} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.sideBoard}>
        {tools ? (
          <div className={styles.sideTools}>
            <BoardAddMenu onAddAsset={tools.onAddAssets} />
            <button type="button" className={styles.sideBack} onClick={onBack} aria-label="Close My Board">
              <X size={18} weight="regular" aria-hidden />
            </button>
          </div>
        ) : null}
        <div ref={setGrid} className={styles.sideGrid}>
          <BriefingAssetBoard order={order} columns={columns} roomy={roomy} edge={edge} onReorder={onReorder} />
        </div>
      </div>
    </section>
  )
}

/**
 * Findings style 7: Assets in two columns down the right of the page, beside the findings. Expanding it
 * covers the page: the summary joins on the left and the app insights on the right, aligned with the
 * grid, which keeps its two columns.
 */
function AssetsPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const revealScrollbar = useRevealScrollbarOnScroll()
  const [play, setPlay] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <aside className={styles.panel} data-open={open} aria-labelledby="briefing-panel-assets">
      <header className={styles.panelHead}>
        <h2 id="briefing-panel-assets" className={styles.eyebrow}>
          Assets
        </h2>
        <button
          type="button"
          className={styles.panelToggle}
          aria-expanded={open}
          aria-label={open ? 'Collapse Assets' : 'Expand Assets and Apps'}
          onClick={onToggle}
        >
          {open ? (
            <ArrowsInSimple size={18} weight="regular" aria-hidden />
          ) : (
            <ArrowsOutSimple size={18} weight="regular" aria-hidden />
          )}
          {open ? 'Collapse' : 'Expand'}
        </button>
      </header>
      <div className={styles.panelBody}>
        <div className={styles.panelInsight} inert={!open}>
          <AssetsFilters />
          <p className={styles.assetsSummary}>
            <SummaryText parts={ASSETS_STATEMENT} />
          </p>
          <p className={styles.assetsDetail}>
            <SummaryText parts={ASSETS_DETAIL} />
          </p>
        </div>
        <div ref={revealScrollbar} className={styles.panelGrid}>
          <BriefingAssetGrid play={play} />
        </div>
        <div className={styles.panelApps} inert={!open}>
          <BriefingAppHighlights />
        </div>
      </div>
    </aside>
  )
}

function ConversationalBubble({
  stop,
  findingsStyle,
  frozen,
  vote,
  onVote,
  onTellMeMore,
  onOpenStory,
  controls,
  toast,
  onHoldChange,
}: {
  stop: FeedStop
  findingsStyle: FindingsStyle
  /**
   * Stops following the composer, so the bubble scrolls away with the stage while the composer docks,
   * or holds its place while a story is over the page and the composer belongs to it.
   */
  frozen: boolean
  vote: 'up' | 'down' | null
  onVote: (value: 'up' | 'down') => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  controls: ReactNode
  /** Replaces the carousel and finding while it is up; they stay mounted underneath so nothing re-measures. */
  toast: ReactNode
  /** True while the mouse is in HOLD_ZONE around the finding and controls, or keyboard focus is inside. */
  onHoldChange: (held: boolean) => void
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const chatDockRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef(onHoldChange)
  useLayoutEffect(() => {
    holdRef.current = onHoldChange
  })

  // The dock is click-through so the map stays interactive, so hover is a hit test against its content's box.
  useEffect(() => {
    const dock = chatDockRef.current
    if (!dock) return
    let hovered = false
    let focused = false
    let held = false
    const sync = () => {
      if (held === (hovered || focused)) return
      held = hovered || focused
      holdRef.current(held)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      let top = Infinity
      let right = -Infinity
      let bottom = -Infinity
      let left = Infinity
      for (const child of dock.children) {
        const rect = child.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0 || getComputedStyle(child).visibility === 'hidden') continue
        top = Math.min(top, rect.top)
        right = Math.max(right, rect.right)
        bottom = Math.max(bottom, rect.bottom)
        left = Math.min(left, rect.left)
      }
      hovered =
        event.clientX >= left - HOLD_ZONE.x &&
        event.clientX <= right + HOLD_ZONE.x &&
        event.clientY >= top - HOLD_ZONE.top &&
        event.clientY <= bottom + HOLD_ZONE.bottom
      sync()
    }
    const leave = () => {
      hovered = false
      sync()
    }
    const focusIn = (event: FocusEvent) => {
      focused = event.target instanceof Element && event.target.matches(':focus-visible')
      sync()
    }
    const focusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && dock.contains(event.relatedTarget)) return
      focused = false
      sync()
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    dock.addEventListener('focusin', focusIn)
    dock.addEventListener('focusout', focusOut)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      dock.removeEventListener('focusin', focusIn)
      dock.removeEventListener('focusout', focusOut)
      if (held) holdRef.current(false)
    }
  }, [])
  const [shown, setShown] = useState(stop)
  const [height, setHeight] = useState<number | null>(null)
  const [fading, setFading] = useState(false)
  const [dock, setDock] = useState<{ top: number; under: number; height: number } | null>(null)
  useEffect(() => {
    if (frozen) return
    const hub = document.querySelector('[data-lc-hub-chat]')
    const box = hub?.querySelector('form[data-stage]')
    if (!box) return
    let frame = 0
    let follow = 0
    const place = () => {
      const rect = box.getBoundingClientRect()
      if (rect.height === 0) return
      const next = {
        top: window.innerHeight - rect.top,
        under: window.innerHeight - rect.bottom,
        height: rect.height,
      }
      setDock((current) =>
        current?.top === next.top && current.under === next.under && current.height === next.height ? current : next,
      )
    }
    const track = () => {
      window.cancelAnimationFrame(frame)
      let frames = 0
      const tick = () => {
        if (follow !== followId) return
        place()
        frames += 1
        if (frames < 30) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    }
    let followId = 0
    const startFollow = () => {
      followId += 1
      follow = followId
      track()
    }
    place()
    startFollow()
    const resize = new ResizeObserver(place)
    resize.observe(box)
    const stage = new MutationObserver(startFollow)
    stage.observe(box, { attributes: true, attributeFilter: ['data-stage'] })
    window.addEventListener('resize', place)
    return () => {
      followId += 1
      window.cancelAnimationFrame(frame)
      resize.disconnect()
      stage.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [frozen, findingsStyle])

  useEffect(() => {
    if (stop.id === shown.id) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(stop)
      return
    }
    setFading(true)
    const timer = window.setTimeout(() => {
      setShown(stop)
      setFading(false)
    }, FINDING_FADE_MS)
    return () => window.clearTimeout(timer)
  }, [shown.id, stop])

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const sync = () => setHeight((current) => (current === inner.offsetHeight ? current : inner.offsetHeight))
    sync()
    const resize = new ResizeObserver(sync)
    resize.observe(inner)
    return () => resize.disconnect()
  }, [])

  const askGreeting = findingsStyle === 2 || findingsStyle === 3 || findingsStyle === 4 || findingsStyle === 5
  const navAbove = findingsStyle === 5

  return (
    <div
      className={styles.dockLayer}
      style={
        dock
          ? ({
              ['--dock-top' as string]: `${dock.top}px`,
              ['--dock-under' as string]: `${dock.under}px`,
              ['--dock-h' as string]: `${dock.height}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {askGreeting ? (
        <p className={styles.askGreeting}>
          Good morning, Omar,
          <br />
          {findingsStyle === 4 ? 'what would you like to explore today?' : 'how can I help you today?'}
        </p>
      ) : null}
      <div ref={chatDockRef} className={styles.chatDock} data-toast={toast ? 'true' : undefined}>
        {navAbove ? <div className={styles.findingNav}>{controls}</div> : null}
        <div className={styles.findingRow}>
          <div className={styles.bubble} style={height != null ? { height } : undefined}>
            <div ref={innerRef} className={`${styles.bubbleBody}${fading ? ` ${styles.bubbleFade}` : ''}`}>
              <FindingBody
                stop={shown}
                vote={vote}
                onVote={onVote}
                onTellMeMore={onTellMeMore}
                onOpenStory={onOpenStory}
              />
            </div>
          </div>
          {navAbove ? null : <div className={styles.findingControls}>{controls}</div>}
        </div>
        {toast ? <div className={styles.toastSlot}>{toast}</div> : null}
      </div>
    </div>
  )
}

/** A finding's chart (on top, or beside the text in findings style 3), text and actions. */
function FindingBody({
  stop,
  vote,
  onVote,
  onTellMeMore,
  onOpenStory,
}: {
  stop: FeedStop
  vote: 'up' | 'down' | null
  onVote: (value: 'up' | 'down') => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
}) {
  const finding = `${stop.before}${stop.highlight}${stop.after}`.trim()
  const revealScrollbar = useRevealScrollbarOnScroll()
  return (
    <>
      <div ref={revealScrollbar} className={styles.findingMain} data-chart={Boolean(stop.chart)}>
        {stop.chart ? <FeedChartCard key={stop.id} chart={stop.chart} /> : null}
        <div className={styles.findingCopy}>
          <p className={styles.bubbleMeta}>{stop.domain}</p>
          <p className={styles.bubbleText}>
            {stop.before}
            <span className={home.findingHighlight}>{stop.highlight}</span>
            {stop.after}
          </p>
        </div>
      </div>
      <div className={home.actions}>
        <button
          type="button"
          className={`${home.actionBtn} ${styles.tellMoreBtn}`}
          aria-label="Tell me more"
          onClick={() =>
            onTellMeMore?.({
              id: stop.id,
              title: stop.title,
              domain: stop.domain,
              finding,
            })
          }
        >
          <span className={home.actionInner}>
            <ChatText size={20} weight="regular" aria-hidden />
            <span>Tell Me More</span>
          </span>
        </button>
        {stop.storyId ? (
          <button type="button" className={styles.storyBtn} onClick={() => onOpenStory?.(stop.storyId!)}>
            <ArrowUpRight size={20} weight="regular" aria-hidden />
            View
          </button>
        ) : null}
        <div className={home.voteGroup}>
          <VoteButton
            label="Show more like this"
            pressed={vote === 'up'}
            pressedClassName={styles.voteOn}
            onClick={() => onVote('up')}
          >
            <ThumbsUp size={18} weight="regular" aria-hidden />
          </VoteButton>
          <VoteButton
            label="Not interested"
            pressed={vote === 'down'}
            pressedClassName={styles.voteOn}
            onClick={() => onVote('down')}
          >
            <ThumbsDown size={18} weight="regular" aria-hidden />
          </VoteButton>
        </div>
      </div>
    </>
  )
}

type DotTier = 'near' | 'far' | 'hidden' | null

/**
 * A window of FEED_DOTS_VISIBLE dots around the active one. On a side with more findings beyond, its last
 * two dots step down (`near`, then `far`); dots outside the window are `hidden`.
 */
function dotTiers(active: number, count: number): DotTier[] {
  if (count <= FEED_DOTS_VISIBLE) return Array.from({ length: count }, () => null)
  const start = Math.min(Math.max(0, active - Math.floor(FEED_DOTS_VISIBLE / 2)), count - FEED_DOTS_VISIBLE)
  const end = start + FEED_DOTS_VISIBLE - 1
  return Array.from({ length: count }, (_, index) => {
    if (index < start || index > end) return 'hidden'
    if (index === active) return null
    const fromStart = start > 0 ? index - start : Infinity
    const fromEnd = end < count - 1 ? end - index : Infinity
    const edge = Math.min(fromStart, fromEnd)
    return edge === 0 ? 'far' : edge === 1 ? 'near' : null
  })
}

/** The active dot stretches into a capsule whose fill is the autoplay clock: it advances when the fill completes. */
function FeedCarousel({
  count,
  active,
  running,
  onSelect,
  onStep,
  arrows = false,
}: {
  count: number
  active: number
  /** False while the finding is hovered or Assets is open; the fill holds its progress. */
  running: boolean
  onSelect: (index: number) => void
  onStep: (delta: number) => void
  /** Previous and next buttons on either side of the dots, in place of the stage's edge arrows. */
  arrows?: boolean
}) {
  return (
    <div className={styles.carousel} role="group" aria-label="Findings">
      {arrows ? (
        <div className={`${styles.carouselPill} ${styles.playPill}`}>
          <button type="button" className={styles.carouselBtn} aria-label="Previous finding" onClick={() => onStep(-1)}>
            <ArrowLeft size={16} weight="regular" aria-hidden />
          </button>
        </div>
      ) : null}
      <div className={styles.dots}>
        {dotTiers(active, count).map((tier, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.dot}${index === active ? ` ${styles.dotActive}` : ''}`}
            data-tier={tier ?? undefined}
            aria-label={`Finding ${index + 1} of ${count}`}
            aria-current={index === active ? 'step' : undefined}
            aria-hidden={tier === 'hidden' || undefined}
            tabIndex={tier === 'hidden' ? -1 : undefined}
            onClick={() => onSelect(index)}
          >
            <span className={styles.dotTrack}>
              {index === active ? (
                <span
                  key={active}
                  className={styles.dotFill}
                  data-running={running}
                  style={{ animationDuration: `${FEED_AUTOPLAY_MS}ms` }}
                  onAnimationEnd={() => onStep(1)}
                />
              ) : null}
            </span>
          </button>
        ))}
      </div>
      {arrows ? (
        <div className={`${styles.carouselPill} ${styles.playPill}`}>
          <button type="button" className={styles.carouselBtn} aria-label="Next finding" onClick={() => onStep(1)}>
            <ArrowRight size={16} weight="regular" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Matches the card surface's entrance in CSS, so the chart inside starts once the card has landed. */
const CHART_SURFACE_MS = 420

/** Flips to true on the frame after mount so the card and its chart transition in. */
function useChartPlay() {
  const [play, setPlay] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return play
}

export function FeedChartCard({ chart }: { chart: FeedChart }) {
  if (chart.kind === 'line') return <FeedLineChart chart={chart} />
  if (chart.kind === 'columns') return <FeedColumnChart chart={chart} />
  if (chart.kind === 'asset') return <FeedAssetChart chart={chart} />
  return <FeedBarChart chart={chart} />
}

/** A board asset on the finding's glass: charts take a 2 x 2 board visual's height, a KPI one cell's. */
function FeedAssetChart({ chart }: { chart: Extract<FeedChart, { kind: 'asset' }> }) {
  const play = useChartPlay()
  const asset = BOARD_ASSETS.find((item) => item.id === chart.assetId)
  if (!asset) return null
  return (
    <div className={`${styles.chart} ${styles.assetChart}`} data-play={play} data-kpi={asset.kind === 'kpi'}>
      <AssetCard asset={asset} play={play} delay={CHART_SURFACE_MS} spark={false} />
    </div>
  )
}

/** After the card lands the columns rise left to right, then their values, the threshold line and the alert pill. */
function FeedColumnChart({ chart }: { chart: Extract<FeedChart, { kind: 'columns' }> }) {
  const play = useChartPlay()
  return (
    <div className={`${styles.chart} ${styles.columnChart}`} data-play={play}>
      <p className={styles.chartLabel}>{chart.label}</p>
      <div className={styles.lineValueRow}>
        <p className={styles.chartValue}>
          {chart.value}
          <span className={styles.chartUnit}>{chart.unit}</span>
        </p>
        <span className={styles.columnDelta}>
          <span className={styles.thresholdKey} aria-hidden />
          {chart.delta}
        </span>
      </div>
      <div className={styles.columnPlot} aria-hidden>
        <span className={styles.columnThreshold} style={{ bottom: `${(chart.threshold / chart.max) * 100}%` }} />
        {chart.columns.map((column, index) => (
          <div
            key={column.name}
            className={styles.column}
            data-low={column.value < chart.threshold}
            style={{ ['--i' as string]: index }}
          >
            <span className={styles.columnValue}>{column.value.toFixed(1)}</span>
            <span className={styles.columnBar} style={{ height: `${(column.value / chart.max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.columnAxis} aria-hidden>
        {chart.columns.map((column) => (
          <span key={column.name}>{column.name}</span>
        ))}
      </div>
    </div>
  )
}

function FeedBarChart({ chart }: { chart: Extract<FeedChart, { kind: 'bar' }> }) {
  const play = useChartPlay()
  return (
    <div className={`${styles.chart} ${styles.barChart}`} data-play={play}>
      <p className={styles.chartLabel}>{chart.label}</p>
      <p className={styles.chartValue}>{chart.value}</p>
      <div className={styles.chartBar} aria-hidden>
        {chart.series.map((row) => (
          <span key={row.name} className={styles.chartSeg} style={{ flex: `${row.pct} 0 0`, background: row.color }} />
        ))}
      </div>
      <FeedLegend rows={chart.series} />
    </div>
  )
}

const LINE_COUNT_MS = 1400

/** After the card lands, total population draws in from the left and its end dot lands; the total counts up alongside. */
function FeedLineChart({ chart }: { chart: Extract<FeedChart, { kind: 'line' }> }) {
  const play = useChartPlay()
  const [total, setTotal] = useState(0)
  const fillId = `population${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = window.requestAnimationFrame((start) => {
      const tick = (now: number) => {
        const t = reduce ? 1 : Math.min(1, Math.max(0, now - start - CHART_SURFACE_MS) / LINE_COUNT_MS)
        setTotal(Math.round(chart.total * (1 - (1 - t) ** 3)))
        if (t < 1) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [chart.total])

  const sums = chart.lines[0].points.map((_, i) => chart.lines.reduce((sum, line) => sum + line.points[i], 0))
  const low = Math.min(...sums) * 0.94
  const high = Math.max(...sums) * 1.02
  const coords = sums.map((v, i): [number, number] => [
    (i / (sums.length - 1)) * 100,
    40 - ((v - low) / (high - low)) * 40,
  ])
  const line = smoothLine(coords)
  const last = coords[coords.length - 1]
  const color = chart.lines[0].color
  return (
    <div className={`${styles.chart} ${styles.lineChart}`} data-play={play}>
      <p className={styles.chartLabel}>{chart.label}</p>
      <div className={styles.lineValueRow}>
        <p className={styles.chartValue}>{total.toLocaleString('en-US')}</p>
        <span className={styles.lineDelta}>{chart.delta}</span>
      </div>
      <div className={styles.linePlot} aria-hidden>
        <svg className={styles.lineSvg} viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.42" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,40 L0,40 Z`} fill={`url(#${fillId})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className={styles.lineDot}
          style={{ left: `${last[0]}%`, top: `${(last[1] / 40) * 100}%`, background: color }}
        />
      </div>
      <div className={styles.lineAxis} aria-hidden>
        {chart.axis.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

function FeedLegend({ rows }: { rows: { name: string; value: string; color: string }[] }) {
  return (
    <ul className={styles.legend}>
      {rows.map((row) => (
        <li key={row.name}>
          <span className={styles.legendName}>
            <span className={styles.legendDot} style={{ background: row.color }} />
            {row.name}
          </span>
          <span className={styles.legendVal}>{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** Catmull-Rom through the points, as cubic Béziers. */
function smoothLine(points: [number, number][]) {
  const f = (n: number) => n.toFixed(2)
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}
