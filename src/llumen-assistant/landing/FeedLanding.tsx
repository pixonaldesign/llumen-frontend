import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChatText, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { FeedMap, type FeedMapFocus } from './FeedMap'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import type { LandingTellMeMorePayload } from './LandingHomeDefault'
import { OverlayScrollThumb } from './OverlayScrollThumb'
import { LandingTopBar } from './LandingTopBar'
import { SpecularActionButton } from './SpecularActionButton'
import type { TopBarVariant } from '../prototypeChrome'
import home from './LandingHome.module.css'
import styles from './FeedLanding.module.css'

type ChartSeries = { name: string; value: string; pct: number; color: string }

type FeedChart = { label: string; value: string; series: ChartSeries[] }

type FeedStop = {
  id: string
  kind: 'map' | 'chart' | 'gradient'
  domain: string
  title: string
  before: string
  highlight: string
  after: string
  storyId?: string
  center?: [number, number]
  zoom?: number
  seed?: number
  chart?: FeedChart
  gradient?: string
}

/** Same fills as the carousel AI cards. */
const AI_GRADIENTS = [
  'linear-gradient(180deg, #4a4969 0%, #7072ab 50%, #cd82a0 100%)',
  'linear-gradient(180deg, #40405c 0%, #6f71aa 80%, #8a76ab 100%)',
  'linear-gradient(180deg, #757abf 0%, #8583be 60%, #eab0d1 100%)',
  'linear-gradient(180deg, #94c5f8 0%, #8ec0e8 25%, #7e9ad2 45%, #6d74bc 70%, #5a61ad 100%)',
] as const

const POPULATION: FeedChart = {
  label: 'Population',
  value: '2,500,000',
  series: [
    { name: 'Adults (20-59)', value: '1,700,000 (68%)', pct: 68, color: '#3fa7a0' },
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

const FEED_STOPS: FeedStop[] = [
  {
    id: 'abu-dhabi',
    kind: 'map',
    domain: 'Operations',
    title: 'Island Bus Reliability Brief',
    before: 'Morning arrivals on the island bus routes are ',
    highlight: 'running 12 minutes late',
    after: ' against the published timetable this week',
    storyId: 'r1',
    center: [54.3773, 24.4539],
    zoom: 11.2,
    seed: 2025,
  },
  {
    id: 'proactive-ai',
    kind: 'gradient',
    domain: 'Customer Success',
    title: 'Proactive Risk Digest',
    before: 'Llumen flagged a clustered complaint pattern in MBZ City that typically precedes ',
    highlight: 'service-center delays of 40 minutes',
    after: ' within 72 hours',
    gradient: AI_GRADIENTS[2],
  },
  {
    id: 'population',
    kind: 'chart',
    domain: 'Operations',
    title: 'Population composition across the capital',
    before: 'Working-age residents still account for most of the emirate, while the youth share is ',
    highlight: 'holding at 27%',
    after: ' of the recorded population.',
    chart: POPULATION,
  },
  {
    id: 'dubai',
    kind: 'map',
    domain: 'Operations',
    title: 'Coastal corridor air quality',
    before: 'Fine particulate readings along the coastal corridor are ',
    highlight: 'up 18% overnight',
    after: ', with three districts crossing the sensitive-group threshold.',
    storyId: 'r2',
    center: [55.2708, 25.2048],
    zoom: 11.35,
    seed: 771,
  },
  {
    id: 'heat-stress',
    kind: 'gradient',
    domain: 'Operations',
    title: 'Coastal Heat Stress Advisory',
    before:
      'Night-time temperatures along the corniche stayed above 32°C for a third consecutive week, with heat-related clinic visits ',
    highlight: 'up 22%',
    after: ' versus the seasonal baseline',
    gradient: AI_GRADIENTS[1],
  },
  {
    id: 'land-use',
    kind: 'chart',
    domain: 'Planning',
    title: 'Land use mix',
    before: 'Industrial parcels now cover nearly a third of the monitored belt, ',
    highlight: 'outpacing open space',
    after: ' along the southern approach roads.',
    chart: LAND_USE,
  },
  {
    id: 'water-network',
    kind: 'gradient',
    domain: 'Engineering',
    title: 'Water Network Pressure Review',
    before: 'Several districts in Al Ain recorded overnight pressure drops that typically precede ',
    highlight: 'service interruptions of 4–6 hours',
    after: ' within the next 48 hours',
    gradient: AI_GRADIENTS[3],
  },
  {
    id: 'al-ain',
    kind: 'map',
    domain: 'Environment',
    title: 'Al Ain station cluster',
    before: 'Inland stations around Al Ain show a quieter profile, with dumping reports ',
    highlight: 'down 12% this week',
    after: ' against the coastal belt.',
    storyId: 'r4',
    center: [55.7447, 24.1917],
    zoom: 11.5,
    seed: 3301,
  },
]

export type FeedLandingProps = {
  contained?: boolean
  conversational?: boolean
  topBar: TopBarVariant
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  reserveComposer?: boolean
}

export function FeedLanding({
  contained = false,
  conversational = false,
  topBar,
  onTellMeMore,
  onOpenStory,
  reserveComposer = true,
}: FeedLandingProps) {
  const [active, setActive] = useState(0)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const scrollNode = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLElement | null>(null)
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const setScrollbar = useRevealScrollbarOnScroll()
  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollNode.current = node
      setScrollbar(node)
      setScrollEl((current) => (current === node ? current : node))
    },
    [setScrollbar],
  )

  const syncActive = useCallback(() => {
    const root = scrollNode.current
    if (!root) return
    const mid = root.getBoundingClientRect().top + root.clientHeight / 2
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    root.querySelectorAll<HTMLElement>('[data-feed-index]').forEach((node) => {
      const rect = node.getBoundingClientRect()
      const dist = Math.abs(rect.top + rect.height / 2 - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = Number(node.dataset.feedIndex)
      }
    })
    setActive((current) => (current === best ? current : best))
  }, [])

  const mapFocus: FeedMapFocus = useMemo(() => {
    for (let index = active; index >= 0; index -= 1) {
      const stop = FEED_STOPS[index]
      if (stop.kind === 'map' && stop.center) {
        return { center: stop.center, zoom: stop.zoom, seed: stop.seed }
      }
    }
    const first = FEED_STOPS[0]
    return { center: first.center ?? [54.3773, 24.4539], zoom: first.zoom, seed: first.seed }
  }, [active])

  useLayoutEffect(() => {
    const bar = barRef.current
    const scroll = scrollNode.current
    if (!bar || !scroll) return
    const apply = () => scroll.style.setProperty('--feed-nav-h', `${bar.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [scrollEl])

  const blurred = !contained && FEED_STOPS[active]?.kind === 'chart'

  return (
    <div
      className={`${styles.root}${contained ? ` ${styles.contained}` : ''}`}
      style={{
        ['--feed-pad' as string]: reserveComposer ? (conversational ? '106px' : '168px') : '48px',
      }}
    >
      {contained ? null : (
        <div className={`${styles.map}${blurred ? ` ${styles.mapBlur}` : ''}`} aria-hidden>
          <FeedMap focus={mapFocus} scrollZoom={false} showControls={false} />
        </div>
      )}
      {contained ? null : <div className={styles.scrim} aria-hidden />}
      <div className={styles.scrollFrame}>
      <div
        className={`${styles.scroll}${contained ? '' : ` ${styles.stepped}`}`}
        ref={setScrollRef}
        onScroll={syncActive}
      >
        <header ref={barRef} className={`${home.nav} ${styles.bar}`}>
          <LandingTopBar variant={topBar} />
        </header>
        {contained ? (
          <div className={styles.stack}>
            <p className={styles.greeting}>
              Good morning, Your Excellency,
              <br />
              here is what requires your attention today
            </p>
            {FEED_STOPS.map((stop, index) => (
              <FeedAttentionCard
                key={stop.id}
                stop={stop}
                index={index}
                active={index === active}
                vote={votes[stop.id] ?? null}
                onVote={(value) =>
                  setVotes((prev) => ({ ...prev, [stop.id]: prev[stop.id] === value ? null : value }))
                }
                onTellMeMore={onTellMeMore}
                onOpenStory={onOpenStory}
              />
            ))}
          </div>
        ) : (
          FEED_STOPS.map((stop, index) => {
            const vote = votes[stop.id] ?? null
            const finding = `${stop.before}${stop.highlight}${stop.after}`.trim()
            const actions = (
              <div className={home.actions}>
                <SpecularActionButton
                  className={home.actionBtn}
                  enabled={index === active}
                  onClick={() =>
                    onTellMeMore?.({
                      id: stop.id,
                      title: stop.title,
                      domain: stop.domain,
                      finding,
                    })
                  }
                >
                  <ChatText size={20} weight="regular" aria-hidden />
                  <span>Tell Me More</span>
                </SpecularActionButton>
                {stop.storyId ? (
                  <button type="button" className={styles.storyBtn} onClick={() => onOpenStory?.(stop.storyId!)}>
                    Open story
                  </button>
                ) : null}
                <div className={home.voteGroup}>
                  <button
                    type="button"
                    className={`${home.voteBtn}${vote === 'up' ? ` ${styles.voteOn}` : ''}`}
                    aria-label="Helpful"
                    aria-pressed={vote === 'up'}
                    onClick={() =>
                      setVotes((prev) => ({ ...prev, [stop.id]: prev[stop.id] === 'up' ? null : 'up' }))
                    }
                  >
                    <ThumbsUp size={18} weight="regular" />
                  </button>
                  <button
                    type="button"
                    className={`${home.voteBtn}${vote === 'down' ? ` ${styles.voteOn}` : ''}`}
                    aria-label="Not helpful"
                    aria-pressed={vote === 'down'}
                    onClick={() =>
                      setVotes((prev) => ({ ...prev, [stop.id]: prev[stop.id] === 'down' ? null : 'down' }))
                    }
                  >
                    <ThumbsDown size={18} weight="regular" />
                  </button>
                </div>
              </div>
            )
            return (
              <section
                key={stop.id}
                className={`${styles.stop}${index === active ? ` ${styles.stopActive}` : ''}`}
                data-feed-index={index}
                aria-label={stop.title}
              >
                {stop.kind === 'gradient' && stop.gradient ? (
                  <div className={styles.gradientFill} style={{ background: stop.gradient }} aria-hidden />
                ) : null}
                {conversational ? null : (
                <div className={styles.full}>
                    <>
                      {stop.kind === 'chart' && stop.chart ? (
                        <div className={styles.stage}>
                          <FeedChartCard chart={stop.chart} />
                        </div>
                      ) : null}
                      <div className={styles.copy}>
                        <p className={styles.domain}>{stop.domain}</p>
                        <h2 className={styles.title}>{stop.title}</h2>
                        <p className={home.finding}>
                          {stop.before}
                          <span className={home.findingHighlight}>{stop.highlight}</span>
                          {stop.after}
                        </p>
                        {actions}
                      </div>
                    </>
                </div>
                )}
              </section>
            )
          })
        )}
      </div>
      <OverlayScrollThumb scrollEl={scrollEl} label="Feed position" />
      </div>
      {conversational ? (
        <ConversationalBubble
          stop={FEED_STOPS[active]}
          vote={votes[FEED_STOPS[active].id] ?? null}
          onVote={(value) =>
            setVotes((prev) => {
              const id = FEED_STOPS[active].id
              return { ...prev, [id]: prev[id] === value ? null : value }
            })
          }
          onTellMeMore={onTellMeMore}
          onOpenStory={onOpenStory}
        />
      ) : null}
    </div>
  )
}

function ConversationalBubble({
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
  const innerRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(stop)
  const [height, setHeight] = useState<number | null>(null)
  const [fading, setFading] = useState(false)
  const [dockBottom, setDockBottom] = useState<number | null>(null)
  const finding = `${shown.before}${shown.highlight}${shown.after}`.trim()

  useEffect(() => {
    const hub = document.querySelector('[data-lc-hub-chat]')
    const box = hub?.querySelector('form[data-stage]')
    if (!box) return
    let frame = 0
    let follow = 0
    const place = () => {
      const top = box.getBoundingClientRect().top
      setDockBottom(window.innerHeight - top + 20)
    }
    const track = () => {
      window.cancelAnimationFrame(frame)
      let frames = 0
      const tick = () => {
        if (follow !== followId) return
        place()
        frames += 1
        if (frames < 24) frame = window.requestAnimationFrame(tick)
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
  }, [])

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
    <div className={styles.chatDock} style={dockBottom != null ? { bottom: dockBottom } : undefined}>
      <div className={styles.bubble} style={height != null ? { height } : undefined}>
        <div ref={innerRef} className={`${styles.bubbleBody}${fading ? ` ${styles.bubbleFade}` : ''}`}>
          <p className={styles.bubbleMeta}>{shown.domain}</p>
          <p className={styles.bubbleText}>
            {shown.before}
            <span className={home.findingHighlight}>{shown.highlight}</span>
            {shown.after}
          </p>
          {shown.kind === 'chart' && shown.chart ? <FeedChartCard chart={shown.chart} /> : null}
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
  )
}

function FeedAttentionCard({
  stop,
  index,
  active,
  vote,
  onVote,
  onTellMeMore,
  onOpenStory,
}: {
  stop: FeedStop
  index: number
  active: boolean
  vote: 'up' | 'down' | null
  onVote: (value: 'up' | 'down') => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
}) {
  const finding = `${stop.before}${stop.highlight}${stop.after}`.trim()
  const chartCard = stop.kind === 'chart'
  const gradientCard = stop.kind === 'gradient'
  return (
    <article
      className={`${styles.feedCard}${chartCard ? ` ${home.cardExpanded} ${home.cardChart}` : ''}${
        gradientCard ? ` ${home.cardAi}` : ''
      }`}
      data-feed-index={index}
      aria-label={stop.title}
    >
      <div className={home.cardMedia} style={gradientCard && stop.gradient ? { background: stop.gradient } : undefined}>
        {stop.kind === 'map' && stop.center ? (
          <FeedMap
            className={styles.feedMap}
            focus={{ center: stop.center, zoom: stop.zoom, seed: stop.seed }}
            scrollZoom={false}
            showControls={false}
          />
        ) : null}
        {gradientCard ? null : <div className={home.cardScrim} />}
      </div>
      <div className={home.info}>
        <div className={home.cardFooter}>
          {chartCard && stop.chart ? (
            <div className={home.chartSlot}>
              <CarouselChart chart={stop.chart} />
            </div>
          ) : null}
          <div className={home.findingStack}>
            <p className={home.cardDomain}>{stop.domain}</p>
            <p className={home.finding}>
              {stop.before}
              <span className={home.findingHighlight}>{stop.highlight}</span>
              {stop.after}
            </p>
          </div>
          <div className={home.actions}>
            <SpecularActionButton
              className={home.actionBtn}
              enabled={active}
              onClick={() =>
                onTellMeMore?.({
                  id: stop.id,
                  title: stop.title,
                  domain: stop.domain,
                  finding,
                })
              }
            >
              <ChatText size={20} weight="regular" aria-hidden />
              <span>Tell Me More</span>
            </SpecularActionButton>
            {stop.storyId ? (
              <button type="button" className={styles.storyBtn} onClick={() => onOpenStory?.(stop.storyId!)}>
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
                <ThumbsUp size={20} weight={vote === 'up' ? 'fill' : 'regular'} />
              </button>
              <button
                type="button"
                className={`${home.voteBtn}${vote === 'down' ? ` ${styles.voteOn}` : ''}`}
                aria-label="Not helpful"
                aria-pressed={vote === 'down'}
                onClick={() => onVote('down')}
              >
                <ThumbsDown size={20} weight={vote === 'down' ? 'fill' : 'regular'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function CarouselChart({ chart }: { chart: FeedChart }) {
  return (
    <div className={home.chart}>
      <p className={home.chartLabel}>{chart.label}</p>
      <p className={home.chartValue}>{chart.value}</p>
      <div className={home.chartBar} aria-hidden>
        {chart.series.map((row) => (
          <span key={row.name} className={home.chartSeg} style={{ flex: `${row.pct} 0 0`, background: row.color }} />
        ))}
      </div>
      <ul className={home.legend}>
        {chart.series.map((row) => (
          <li key={row.name} className={home.legendRow}>
            <span className={home.legendName}>
              <span className={home.legendDot} style={{ background: row.color }} />
              {row.name}
            </span>
            <span className={home.legendVal}>{row.value}</span>
          </li>
        ))}
      </ul>
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
