import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { ArrowLeft, ArrowRight, ChatText, Pause, Play, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { BriefingAssetGrid } from './BriefingAssets'
import { BriefingMap } from './BriefingMap'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'
import type { LandingTellMeMorePayload } from './LandingHomeDefault'
import { LandingTopBar } from './LandingTopBar'
import { SpecularActionButton } from './SpecularActionButton'
import type { TopBarVariant } from '../prototypeChrome'
import home from './LandingHome.module.css'
import styles from './BriefingLanding.module.css'

type ChartSeries = { name: string; value: string; pct: number; color: string }

type FeedChart = { label: string; value: string; series: ChartSeries[] }

type FeedStop = {
  id: string
  /** Stops without a place show the last place's map, blurred. */
  place?: BriefingPlaceId
  domain: string
  title: string
  before: string
  highlight: string
  after: string
  storyId?: string
  chart?: FeedChart
}

const POPULATION: FeedChart = {
  label: 'Population',
  value: '2,500,000',
  series: [
    {
      name: 'Adults (20-59)',
      value: '1,700,000 (68%)',
      pct: 68,
      color: '#3fa7a0',
    },
    { name: 'Youth (0-19)', value: '675,000 (27%)', pct: 27, color: '#9bbf6a' },
    { name: 'Seniors (60+)', value: '125,000 (5%)', pct: 5, color: '#c56b3c' },
  ],
}

const LAND_USE: FeedChart = {
  label: 'Land use',
  value: '100%',
  series: [
    { name: 'Residential', value: '42%', pct: 42, color: '#3fa7a0' },
    { name: 'Industrial', value: '31%', pct: 31, color: '#9bbf6a' },
    { name: 'Open space', value: '27%', pct: 27, color: '#c56b3c' },
  ],
}

/** Map stops alternate with blurred ones; each map stop has its own place and palette. */
const FEED_STOPS: FeedStop[] = [
  {
    id: 'abu-dhabi',
    place: 'abu-dhabi',
    domain: 'Operations',
    title: 'Island Bus Reliability Brief',
    before: 'Morning arrivals on the island bus routes are ',
    highlight: 'running 12 minutes late',
    after: ' against the published timetable this week',
    storyId: 'r1',
  },
  {
    id: 'proactive-ai',
    domain: 'Customer Success',
    title: 'Proactive Risk Digest',
    before: 'Llumen flagged a clustered complaint pattern in MBZ City that typically precedes ',
    highlight: 'service-center delays of 40 minutes',
    after: ' within 72 hours',
  },
  {
    id: 'land-use',
    place: 'mussafah',
    domain: 'Planning',
    title: 'Land use mix',
    before: 'Industrial parcels in Al Mussafah now cover nearly a third of the monitored belt, ',
    highlight: 'outpacing open space',
    after: ' along the southern approach roads.',
    chart: LAND_USE,
  },
  {
    id: 'population',
    domain: 'Operations',
    title: 'Population composition across the capital',
    before: 'Working-age residents still account for most of the emirate, while the youth share is ',
    highlight: 'holding at 27%',
    after: ' of the recorded population.',
    chart: POPULATION,
  },
  {
    id: 'dubai',
    place: 'dubai',
    domain: 'Operations',
    title: 'Coastal corridor air quality',
    before: 'Fine particulate readings along the coastal corridor are ',
    highlight: 'up 18% overnight',
    after: ', with three districts crossing the sensitive-group threshold.',
    storyId: 'r2',
  },
  {
    id: 'heat-stress',
    domain: 'Operations',
    title: 'Coastal Heat Stress Advisory',
    before:
      'Night-time temperatures along the corniche stayed above 32°C for a third consecutive week, with heat-related clinic visits ',
    highlight: 'up 22%',
    after: ' versus the seasonal baseline',
  },
  {
    id: 'al-ain',
    place: 'al-ain',
    domain: 'Environment',
    title: 'Al Ain station cluster',
    before: 'Inland stations around Al Ain show a quieter profile, with dumping reports ',
    highlight: 'down 12% this week',
    after: ' against the coastal belt.',
    storyId: 'r4',
  },
  {
    id: 'water-network',
    domain: 'Engineering',
    title: 'Water Network Pressure Review',
    before: 'Several districts in Al Ain recorded overnight pressure drops that typically precede ',
    highlight: 'service interruptions of 4–6 hours',
    after: ' within the next 48 hours',
  },
]

/** Page scroll past which the Assets section counts as open and the composer leaves the centre. */
const ASSETS_OPEN_PX = 8

/** Assets play their entrance once their top passes this share of the page, and reset below the other. */
const ASSETS_PLAY_AT = 0.45
const ASSETS_RESET_AT = 0.8

/** The findings carousel advances on its own after this long on a stop. */
const FEED_AUTOPLAY_MS = 9000

export type BriefingLandingProps = {
  topBar: TopBarVariant
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  reserveComposer?: boolean
  /** Fires when the Assets sheet opens or closes, so the composer can leave the centre. */
  onAssetsOpenChange?: (open: boolean) => void
}

export function BriefingLanding({
  topBar,
  onTellMeMore,
  onOpenStory,
  reserveComposer = true,
  onAssetsOpenChange,
}: BriefingLandingProps) {
  const [active, setActive] = useState(0)
  const [assetsOpen, setAssetsOpen] = useState(false)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const lowerRef = useRef<HTMLDivElement>(null)
  const agentsRef = useRef<HTMLElement>(null)
  const [assetsPlay, setAssetsPlay] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement | null>(null)
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const stop = FEED_STOPS[active]

  const mapPlace = useMemo(() => {
    for (let index = active; index >= 0; index -= 1) {
      const place = FEED_STOPS[index].place
      if (place) return BRIEFING_PLACES[place]
    }
    return BRIEFING_PLACES['abu-dhabi']
  }, [active])

  const syncPage = useCallback(() => {
    const page = pageRef.current
    if (!page) return
    const top = page.scrollTop
    const open = top > ASSETS_OPEN_PX
    setAssetsOpen((current) => (current === open ? current : open))
    const lower = lowerRef.current
    const agents = agentsRef.current
    if (!lower || !agents) return
    const height = page.clientHeight
    const bar = barRef.current?.offsetHeight ?? 0
    const assetsEnd = lower.offsetTop + agents.offsetTop - height
    const blendFrom = Math.max(lower.offsetTop - bar, assetsEnd)
    const blendTo = lower.offsetTop + agents.offsetTop
    const blend = Math.min(1, Math.max(0, (top - blendFrom) / Math.max(1, blendTo - blendFrom)))
    rootRef.current?.style.setProperty('--agents-t', blend.toFixed(3))
    const assetsTop = lower.offsetTop - top
    setAssetsPlay((current) => {
      if (assetsTop > height * ASSETS_RESET_AT || blend > 0.97) return false
      if (assetsTop < height * ASSETS_PLAY_AT && blend < 0.9) return true
      return current
    })
  }, [])

  useEffect(() => {
    if (paused || assetsOpen) return
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % FEED_STOPS.length), FEED_AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, paused, assetsOpen])

  const stepFeed = useCallback((delta: number) => {
    setActive((index) => (index + delta + FEED_STOPS.length) % FEED_STOPS.length)
  }, [])

  useEffect(() => {
    onAssetsOpenChange?.(assetsOpen)
  }, [assetsOpen, onAssetsOpenChange])

  useEffect(() => () => onAssetsOpenChange?.(false), [onAssetsOpenChange])

  const showAssets = useCallback(() => {
    const page = pageRef.current
    const lower = lowerRef.current
    if (!page || !lower) return
    page.scrollTo({
      top: lower.offsetTop - (barRef.current?.offsetHeight ?? 0),
      behavior: 'smooth',
    })
  }, [])

  /*
   * The page scrolls natively everywhere, so the wheel over the findings snaps to Assets.
   * Keep wheels away from the map (it would zoom) unless it is a pinch.
   */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (target && barRef.current?.contains(target)) return
      if (event.ctrlKey && target && mapRef.current?.contains(target)) return
      event.stopPropagation()
    }
    root.addEventListener('wheel', onWheel, { capture: true })
    return () => root.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

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
  }, [frame, syncPage])

  const blurred = !stop.place

  return (
    <div
      ref={rootRef}
      className={styles.root}
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
        <LandingTopBar variant={topBar} workspaceInLogo briefingTab />
      </header>
      <div ref={pageRef} className={styles.page} onScroll={syncPage}>
        <div className={styles.stage}>
          <div ref={mapRef} className={`${styles.map}${blurred ? ` ${styles.mapBlur}` : ''}`} aria-hidden>
            <BriefingMap place={mapPlace} />
          </div>
          <div className={styles.scrim} aria-hidden />
          <div className={styles.fadeBlur} aria-hidden />
          <ConversationalBubble
            stop={stop}
            frozen={assetsOpen}
            vote={votes[stop.id] ?? null}
            onVote={(value) =>
              setVotes((prev) => ({
                ...prev,
                [stop.id]: prev[stop.id] === value ? null : value,
              }))
            }
            onTellMeMore={onTellMeMore}
            onOpenStory={onOpenStory}
            controls={
              <FeedCarousel
                count={FEED_STOPS.length}
                active={active}
                paused={paused}
                onSelect={setActive}
                onStep={stepFeed}
                onTogglePause={() => setPaused((value) => !value)}
              />
            }
          />
        </div>
        <div ref={lowerRef} className={`${styles.lower}${assetsOpen ? ` ${styles.lowerOpen}` : ''}`}>
          <div className={styles.lowerBg} aria-hidden />
          <AssetsSheet open={assetsOpen} play={assetsPlay} onOpen={showAssets} onOpenStory={onOpenStory} />
          <AgentsSection sectionRef={agentsRef} />
        </div>
      </div>
    </div>
  )
}

function AssetsSheet({
  open,
  play,
  onOpen,
  onOpenStory,
}: {
  open: boolean
  play: boolean
  onOpen: () => void
  onOpenStory?: (storyId: string) => void
}) {
  return (
    <section
      className={`${styles.assets}${open ? ` ${styles.assetsOpen}` : ''}`}
      aria-labelledby="briefing-assets"
      onClickCapture={(event) => {
        if (open) return
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
    >
      <header className={styles.sectionHead}>
        <h2 id="briefing-assets" className={styles.assetsTitle}>
          Assets
        </h2>
        <p className={styles.sectionLead}>What you follow, built in Asset builder</p>
      </header>
      <BriefingAssetGrid play={play} interactive={open} onOpenStory={onOpenStory} />
    </section>
  )
}

function AgentsSection({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  return (
    <section ref={sectionRef} className={styles.agents} aria-labelledby="briefing-agents">
      <header className={styles.sectionHead}>
        <h2 id="briefing-agents" className={styles.assetsTitle}>
          Agents
        </h2>
      </header>
    </section>
  )
}

function ConversationalBubble({
  stop,
  frozen,
  vote,
  onVote,
  onTellMeMore,
  onOpenStory,
  controls,
}: {
  stop: FeedStop
  /** Stops following the composer, so the bubble scrolls away with the stage while the composer docks. */
  frozen: boolean
  vote: 'up' | 'down' | null
  onVote: (value: 'up' | 'down') => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  controls: ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(stop)
  const [height, setHeight] = useState<number | null>(null)
  const [fading, setFading] = useState(false)
  const [dock, setDock] = useState<{ bottom: number; under: number } | null>(null)
  const finding = `${shown.before}${shown.highlight}${shown.after}`.trim()

  useEffect(() => {
    if (frozen) return
    const hub = document.querySelector('[data-lc-hub-chat]')
    const box = hub?.querySelector('form[data-stage]')
    if (!box) return
    let frame = 0
    let follow = 0
    const place = () => {
      const rect = box.getBoundingClientRect()
      const next = {
        bottom: window.innerHeight - rect.top + 20,
        under: window.innerHeight - rect.bottom,
      }
      setDock((current) => (current?.bottom === next.bottom && current.under === next.under ? current : next))
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
  }, [frozen])

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
    }, 160)
    return () => window.clearTimeout(timer)
  }, [shown.id, stop])

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    setHeight(inner.offsetHeight)
  }, [shown])

  return (
    <>
      <div className={styles.chatDock} style={dock ? { bottom: dock.bottom } : undefined}>
        <p className={styles.greeting}>
          Good morning, Omar,
          <br />
          here is what requires your attention today
        </p>
        <div className={styles.bubble} style={height != null ? { height } : undefined}>
          <div ref={innerRef} className={`${styles.bubbleBody}${fading ? ` ${styles.bubbleFade}` : ''}`}>
            <p className={styles.bubbleMeta}>{shown.domain}</p>
            <p className={styles.bubbleText}>
              {shown.before}
              <span className={home.findingHighlight}>{shown.highlight}</span>
              {shown.after}
            </p>
            {shown.chart ? <FeedChartCard chart={shown.chart} /> : null}
            <div className={home.actions}>
              <SpecularActionButton
                className={home.actionBtn}
                enabled
                onClick={() =>
                  onTellMeMore?.({
                    id: shown.id,
                    title: shown.title,
                    domain: shown.domain,
                    finding,
                  })
                }
              >
                <ChatText size={20} weight="regular" aria-hidden />
                <span>Tell Me More</span>
              </SpecularActionButton>
              {shown.storyId ? (
                <button type="button" className={styles.storyBtn} onClick={() => onOpenStory?.(shown.storyId!)}>
                  Open story
                </button>
              ) : null}
              <div className={home.voteGroup}>
                <button
                  type="button"
                  className={`${home.voteBtn}${vote === 'up' ? ` ${styles.voteOn}` : ''}`}
                  aria-label="Helpful"
                  aria-pressed={vote === 'up'}
                  onClick={() => onVote('up')}
                >
                  <ThumbsUp size={18} weight="regular" />
                </button>
                <button
                  type="button"
                  className={`${home.voteBtn}${vote === 'down' ? ` ${styles.voteOn}` : ''}`}
                  aria-label="Not helpful"
                  aria-pressed={vote === 'down'}
                  onClick={() => onVote('down')}
                >
                  <ThumbsDown size={18} weight="regular" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className={styles.controlsDock}
        style={dock ? ({ ['--dock-under' as string]: `${dock.under}px` } as CSSProperties) : undefined}
      >
        {controls}
      </div>
    </>
  )
}

function FeedCarousel({
  count,
  active,
  paused,
  onSelect,
  onStep,
  onTogglePause,
}: {
  count: number
  active: number
  paused: boolean
  onSelect: (index: number) => void
  onStep: (delta: number) => void
  onTogglePause: () => void
}) {
  return (
    <div className={styles.carousel} role="group" aria-label="Findings">
      <div className={`${styles.carouselPill} ${styles.dots}`}>
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.dot}${index === active ? ` ${styles.dotActive}` : ''}`}
            aria-label={`Finding ${index + 1} of ${count}`}
            aria-current={index === active ? 'step' : undefined}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
      <div className={styles.carouselPill}>
        <button type="button" className={styles.carouselBtn} aria-label="Previous finding" onClick={() => onStep(-1)}>
          <ArrowLeft size={16} weight="regular" />
        </button>
        <button
          type="button"
          className={styles.carouselBtn}
          aria-label={paused ? 'Play findings' : 'Pause findings'}
          onClick={onTogglePause}
        >
          {paused ? <Play size={16} weight="regular" /> : <Pause size={16} weight="regular" />}
        </button>
        <button type="button" className={styles.carouselBtn} aria-label="Next finding" onClick={() => onStep(1)}>
          <ArrowRight size={16} weight="regular" />
        </button>
      </div>
    </div>
  )
}

function FeedChartCard({ chart }: { chart: FeedChart }) {
  return (
    <div className={styles.chart}>
      <p className={styles.chartLabel}>{chart.label}</p>
      <p className={styles.chartValue}>{chart.value}</p>
      <div className={styles.chartBar} aria-hidden>
        {chart.series.map((row) => (
          <span key={row.name} className={styles.chartSeg} style={{ flex: `${row.pct} 0 0`, background: row.color }} />
        ))}
      </div>
      <ul className={styles.legend}>
        {chart.series.map((row) => (
          <li key={row.name}>
            <span className={styles.legendName}>
              <span className={styles.legendDot} style={{ background: row.color }} />
              {row.name}
            </span>
            <span className={styles.legendVal}>{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
