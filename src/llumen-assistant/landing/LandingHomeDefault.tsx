/**
 * Figma: Landing (node 3134:1416)
 * https://www.figma.com/design/IEipD1hKFb0H7jCLU53nP2/Test-Llumen?node-id=3134-1416
 *
 * Page background comes from CompactAssistantDemo MeshGradient.
 */
import {
  ArrowLeft,
  ArrowRight,
  ChatText,
  Link,
  Pause,
  Play,
  ThumbsDown,
  ThumbsUp,
} from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { landingAssets as a, storyThumbLayers, type StoryThumbVariant } from './landingAssets'
import { ConversationGrid } from './ConversationGrid'
import { AUTOPLAY_MS, CAROUSEL_MS, tickerSlots, useCarousel, type CardLayout } from './carouselMotion'
import { LandingTopBar, STUDIO_CATEGORIES, STUDIO_WORKSPACES, WorkspaceGlyph } from './LandingTopBar'
import { SpecularActionButton } from './SpecularActionButton'
import { useAnchoredTooltip } from './useAnchoredTooltip'
import { VoteButton } from './VoteButton'
import type { TopBarVariant } from '../prototypeChrome'
import styles from './LandingHome.module.css'

const AI_GRADIENTS = [
  'linear-gradient(180deg, #4a4969 0%, #7072ab 50%, #cd82a0 100%)',
  'linear-gradient(180deg, #40405c 0%, #6f71aa 80%, #8a76ab 100%)',
  'linear-gradient(180deg, #757abf 0%, #8583be 60%, #eab0d1 100%)',
  'linear-gradient(180deg, #94c5f8 0%, #8ec0e8 25%, #7e9ad2 45%, #6d74bc 70%, #5a61ad 100%)',
  'linear-gradient(180deg, #9be2fe 0%, #67d1fb 22%, #2d8fb8 55%, #2478a0 100%)',
  'linear-gradient(180deg, #57c1eb 0%, #246fa8 100%)',
] as const

type ChartSeries = {
  name: string
  value: string
  pct: number
  color: string
}

type AttentionItem = {
  id: string
  type: 'slides' | 'chart' | 'ai'
  title: string
  domain: string
  before: string
  highlight: string
  after: string
  image?: string
  gradient?: string
  chart?: {
    label: string
    value: string
    series: ChartSeries[]
  }
}

const POPULATION_CHART: NonNullable<AttentionItem['chart']> = {
  label: 'Population',
  value: '2,500,000',
  series: [
    { name: 'Adults (20-59)', value: '1,700,000 (68%)', pct: 68, color: '#3fa7a0' },
    { name: 'Youth (0-19)', value: '675,000 (27%)', pct: 27, color: '#9bbf6a' },
    { name: 'Seniors (60+)', value: '125,000 (5%)', pct: 5, color: '#c56b3c' },
  ],
}

const LAND_USE_CHART: NonNullable<AttentionItem['chart']> = {
  label: 'Land use',
  value: '100%',
  series: [
    { name: 'Residential', value: '42%', pct: 42, color: '#3fa7a0' },
    { name: 'Industrial', value: '31%', pct: 31, color: '#9bbf6a' },
    { name: 'Open space', value: '27%', pct: 27, color: '#c56b3c' },
  ],
}

const ATTENTION: AttentionItem[] = [
  {
    id: 'dumping-map',
    type: 'slides',
    title: 'Island Bus Reliability Brief',
    domain: 'Operations',
    before: 'Morning arrivals on the island bus routes are ',
    highlight: 'running 12 minutes late',
    after: ' against the published timetable this week',
    image: a.slideMap,
  },
  {
    id: 'dumping-chart',
    type: 'chart',
    title: 'Capital Population Snapshot',
    domain: 'Operations',
    before: 'Working-age residents still account for most of the emirate, while the youth share is ',
    highlight: 'holding at 27%',
    after: ' of the recorded population',
    chart: POPULATION_CHART,
  },
  {
    id: 'dumping-ai',
    type: 'ai',
    title: 'Clinic Appointment Backlog',
    domain: 'Customer Success',
    before: 'Walk-in clinics across Khalifa City are booking new appointments ',
    highlight: 'nine days out',
    after: ', up from four days at the start of the month',
    gradient: AI_GRADIENTS[0],
  },
  {
    id: 'aqi-map',
    type: 'slides',
    title: 'Air Quality Corridor Review',
    domain: 'Operations',
    before: 'Fine particulate readings along the coastal corridor are ',
    highlight: 'up 18% overnight',
    after: ', with three districts crossing the sensitive-group threshold',
    image: a.recMapB,
  },
  {
    id: 'land-chart',
    type: 'chart',
    title: 'Land-use Pressure Brief',
    domain: 'Product',
    before: 'Industrial parcels adjacent to residential zones expanded this quarter, ',
    highlight: 'outpacing housing by 2.1×',
    after: ' versus the five-year average',
    chart: LAND_USE_CHART,
  },
  {
    id: 'proactive-ai',
    type: 'ai',
    title: 'Proactive Risk Digest',
    domain: 'Customer Success',
    before: 'Llumen flagged a clustered complaint pattern in MBZ City that typically precedes ',
    highlight: 'service-center delays of 40 minutes',
    after: ' within 72 hours',
    gradient: AI_GRADIENTS[2],
  },
  {
    id: 'ai-gradient-2',
    type: 'ai',
    title: 'Coastal Heat Stress Advisory',
    domain: 'Operations',
    before: 'Night-time temperatures along the corniche stayed above 32°C for a third consecutive week, with heat-related clinic visits ',
    highlight: 'up 22%',
    after: ' versus the seasonal baseline',
    gradient: AI_GRADIENTS[1],
  },
  {
    id: 'ai-gradient-4',
    type: 'ai',
    title: 'Water Network Pressure Review',
    domain: 'Engineering',
    before: 'Several districts in Al Ain recorded overnight pressure drops that typically precede ',
    highlight: 'service interruptions of 4–6 hours',
    after: ' within the next 48 hours',
    gradient: AI_GRADIENTS[3],
  },
  {
    id: 'ai-gradient-5',
    type: 'ai',
    title: 'School-Zone Congestion Watch',
    domain: 'Customer Success',
    before: 'Pickup queues at three model schools in Khalifa City stretched past ',
    highlight: '18 minutes at close',
    after: ", doubling last month's average wait",
    gradient: AI_GRADIENTS[4],
  },
  {
    id: 'ai-gradient-6',
    type: 'ai',
    title: 'Retail Footfall Anomaly Brief',
    domain: 'Sales',
    before: 'Weekend mall occupancy in Yas Island fell ',
    highlight: '14% below forecast',
    after: ' despite event programming that usually lifts traffic',
    gradient: AI_GRADIENTS[5],
  },
]

/** Thumb order matches Figma Stories grid (1740:15946); copy stays the same. */
const RECOMMENDED: {
  id: string
  category: string
  title: string
  kind: string
  sections: string
  thumb: StoryThumbVariant
}[] = [
  {
    id: 'r1',
    category: 'Engineering',
    title: 'Building a Scalable Microservices Architecture From the Ground Up',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'bars',
  },
  {
    id: 'r2',
    category: 'Marketing',
    title: 'Brand Repositioning Strategy for the Next-Gen Consumer Market',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'chart',
  },
  {
    id: 'r3',
    category: 'Product',
    title: 'User Onboarding Redesign: Reducing Time-to-Value by 40%',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'satellite',
  },
  {
    id: 'r4',
    category: 'Sales',
    title: 'Enterprise Pipeline Acceleration: Lessons From Q3 Wins',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'map',
  },
  {
    id: 'r5',
    category: 'Operations',
    title: 'Streamlining Cross-Team Workflows With Automation',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'chart',
  },
  {
    id: 'r6',
    category: 'HR',
    title: 'Remote Culture Playbook: Keeping Teams Connected at Scale',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'satellite',
  },
  {
    id: 'r7',
    category: 'Customer Success',
    title: 'Reducing Churn Through Proactive Health Scoring',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'chart',
  },
  {
    id: 'r8',
    category: 'Finance',
    title: 'Annual Budget Planning Framework for Hypergrowth Startups',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'map',
  },
  {
    id: 'r9',
    category: 'IT',
    title: 'Zero-Trust Security Rollout: A 90-Day Implementation Guide',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'satellite',
  },
  {
    id: 'r10',
    category: 'Engineering',
    title: 'Migrating Legacy Systems to Cloud-Native Infrastructure',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'map',
  },
  {
    id: 'r11',
    category: 'Marketing',
    title: 'Content-Led Growth: Driving Organic Acquisition at Scale',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'chart',
  },
  {
    id: 'r12',
    category: 'Product',
    title: 'Feature Prioritization With Impact vs Effort Scoring',
    kind: 'Story',
    sections: '19 Sections',
    thumb: 'satellite',
  },
]

function Finding({
  before,
  highlight,
  after,
}: {
  before: string
  highlight: string
  after: string
}) {
  return (
    <p className={styles.finding}>
      {before}
      <span className={styles.findingHighlight}>{highlight}</span>
      {after}
    </p>
  )
}

function PopulationChart({ chart }: { chart: NonNullable<AttentionItem['chart']> }) {
  return (
    <div className={styles.chart}>
      <p className={styles.chartLabel}>{chart.label}</p>
      <p className={styles.chartValue}>{chart.value}</p>
      <div className={styles.chartBar} aria-hidden>
        {chart.series.map((row) => (
          <span
            key={row.name}
            className={styles.chartSeg}
            style={{ flex: `${row.pct} 0 0`, background: row.color }}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {chart.series.map((row) => (
          <li key={row.name} className={styles.legendRow}>
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

function AttentionCard({
  item,
  expanded,
  slotClass,
  layout,
  offstage,
  snap,
  park,
  iconOnlySlides,
  onExpand,
  vote,
  onVote,
  onTellMeMore,
}: {
  item: AttentionItem
  expanded: boolean
  slotClass: string
  layout: CardLayout
  offstage: boolean
  snap: boolean
  park: boolean
  iconOnlySlides: boolean
  onExpand?: () => void
  vote: 'up' | 'down' | null
  onVote: (value: 'up' | 'down') => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
}) {
  const slidesTip = useAnchoredTooltip(
    (iconOnlySlides || !expanded) && !offstage && !snap && !park && item.type === 'slides',
  )
  const className = [
    styles.card,
    item.type === 'ai' ? styles.cardAi : '',
    item.type === 'chart' ? styles.cardChart : '',
    expanded ? styles.cardExpanded : styles.cardCollapsed,
    slotClass,
    offstage ? styles.cardOff : '',
    snap ? styles.cardSnap : '',
    park ? styles.cardPark : '',
  ]
    .filter(Boolean)
    .join(' ')

  const backgroundStyle: CSSProperties = {
    left: layout.left,
    width: layout.width,
    ...(item.type === 'ai' && item.gradient ? { background: item.gradient } : {}),
    ...(snap ? { transition: 'none', visibility: 'hidden' as const } : {}),
    ...(park ? { transition: 'none' } : {}),
  }

  return (
    <article
      className={className}
      style={backgroundStyle}
      aria-label={`${item.domain}. ${item.title}`}
      aria-hidden={offstage}
      onClick={!expanded && !offstage ? onExpand : undefined}
    >
      <div className={styles.cardMedia} aria-hidden>
        {item.type === 'slides' && item.image ? <img src={item.image} alt="" /> : null}
        {item.type !== 'ai' ? <div className={styles.cardScrim} /> : null}
      </div>
      <div className={styles.info}>
        <div className={styles.cardFooter}>
          {item.type === 'chart' && item.chart ? (
            <div className={styles.chartSlot}>
              <PopulationChart chart={item.chart} />
            </div>
          ) : null}
          <div className={styles.findingStack}>
            <p className={styles.cardDomain}>{item.domain}</p>
            <Finding before={item.before} highlight={item.highlight} after={item.after} />
          </div>
          <div
            className={styles.actions}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <SpecularActionButton
              className={styles.actionBtn}
              enabled={!offstage && !snap && !park}
              motionKey={`${Math.round(layout.left)}:${Math.round(layout.width)}:${expanded ? 'x' : 'c'}`}
              settleMs={CAROUSEL_MS}
              onClick={() =>
                onTellMeMore?.({
                  id: item.id,
                  title: item.title,
                  domain: item.domain,
                  finding: `${item.before}${item.highlight}${item.after}`.trim(),
                })
              }
            >
              <ChatText size={20} weight="regular" aria-hidden />
              <span className={styles.actionLabel}>Tell Me More</span>
            </SpecularActionButton>
            <div className={styles.voteGroup}>
              <VoteButton
                label="Show more like this"
                pressed={vote === 'up'}
                onClick={() => onVote('up')}
              >
                <ThumbsUp size={20} weight={vote === 'up' ? 'fill' : 'regular'} />
              </VoteButton>
              <VoteButton
                label="Not interested"
                pressed={vote === 'down'}
                onClick={() => onVote('down')}
              >
                <ThumbsDown size={20} weight={vote === 'down' ? 'fill' : 'regular'} />
              </VoteButton>
            </div>
          </div>
        </div>
      </div>
      {item.type === 'slides' ? (
        <>
          <button
            type="button"
            className={styles.viewSlidesBtn}
            aria-label="View Slides"
            aria-describedby={slidesTip.describedBy}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onMouseEnter={slidesTip.show}
            onMouseMove={slidesTip.show}
            onMouseLeave={slidesTip.hide}
            onFocus={slidesTip.show}
            onBlur={slidesTip.hide}
          >
            <Link size={20} weight="regular" aria-hidden />
            <span className={styles.viewSlidesLabel}>View Slides</span>
          </button>
          {slidesTip.node('View Slides')}
        </>
      ) : null}
    </article>
  )
}

export type LandingTellMeMorePayload = {
  id: string
  title: string
  domain: string
  finding: string
}

export type LandingHomeDefaultProps = {
  /** Open a Recommended story card as full-page Story content. */
  onOpenStory?: (storyId: string) => void
  /** Add the attention card as a context chip in the landing chatbox. */
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  /** Extra bottom inset so stories clear a center composer (Hub). Current uses the FAB only. */
  reserveComposer?: boolean
  topBar?: TopBarVariant
  /** What sits under the attention carousel. */
  listing?: 'stories' | 'conversations'
  onOpenConversation?: (id: string) => void
}

export default function LandingHomeDefault({
  onOpenStory,
  onTellMeMore,
  reserveComposer = true,
  topBar = 'current',
  listing = 'stories',
  onOpenConversation,
}: LandingHomeDefaultProps = {}) {
  const [filter, setFilter] = useState<string>(STUDIO_CATEGORIES[0])
  const [playing, setPlaying] = useState(true)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const count = ATTENTION.length
  const { active, goTo, peekCount, trackRef, trackReady, slot } = useCarousel(count)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!reduce.matches) return
    if (!playing) return
    const timer = window.setTimeout(() => goTo(active + 1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, playing, goTo])

  return (
    <div className={styles.root} data-name="Landing">
      <header className={styles.nav}>
        <LandingTopBar
          variant={topBar}
          workspace={filter}
          workspaces={STUDIO_WORKSPACES}
          categories={STUDIO_CATEGORIES}
          onWorkspaceChange={setFilter}
        />
        {topBar === 'studio' ? null : (
          <div className={styles.filters} aria-label="Workspace filters">
            {STUDIO_WORKSPACES.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`${styles.pill}${filter === item.label ? ` ${styles.pillActive}` : ''}`}
                aria-pressed={filter === item.label}
                onClick={() => setFilter(item.label)}
              >
                <WorkspaceGlyph name={item.icon} />
                {item.label}
              </button>
            ))}
            <span className={styles.filterRule} aria-hidden />
            {STUDIO_CATEGORIES.map((label) => (
              <button
                key={label}
                type="button"
                className={`${styles.pill}${filter === label ? ` ${styles.pillActive}` : ''}`}
                aria-pressed={filter === label}
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="attention-heading">
          <p id="attention-heading" className={styles.greeting}>
            Good morning, Your Excellency,
            <br />
            here is what requires your attention today
          </p>

          <div className={styles.carousel}>
            <div className={`${styles.track}${trackReady ? ` ${styles.trackReady}` : ''}`} ref={trackRef}>
              {ATTENTION.map((item, index) => {
                const { layout, expanded, park, offstage, snap } = slot(index)
                return (
                  <AttentionCard
                    key={item.id}
                    item={item}
                    expanded={expanded}
                    slotClass={expanded ? styles.cardHero : styles.cardPeek}
                    layout={layout}
                    offstage={offstage}
                    snap={snap}
                    park={park}
                    iconOnlySlides={peekCount === 0}
                    onExpand={() => goTo(index)}
                    vote={votes[item.id] ?? null}
                    onVote={(value) =>
                      setVotes((prev) => ({
                        ...prev,
                        [item.id]: prev[item.id] === value ? null : value,
                      }))
                    }
                    onTellMeMore={onTellMeMore}
                  />
                )
              })}
            </div>

            <div className={styles.controls}>
              <div className={styles.progress} role="tablist" aria-label="Attention items">
                {tickerSlots(active, count).map(({ index, edge }) => {
                  const item = ATTENTION[index]
                  const selected = index === active
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-label={`Attention ${index + 1}, ${item.type}: ${item.title}`}
                      aria-selected={selected}
                      aria-setsize={count}
                      aria-posinset={index + 1}
                      className={`${styles.dot}${selected ? ` ${styles.dotActive}` : ''}${
                        selected && !playing ? ` ${styles.dotPaused}` : ''
                      }${edge ? ` ${styles.dotEdge}` : ''}`}
                      onClick={() => goTo(index)}
                    >
                      {selected ? (
                        <span
                          className={styles.dotFill}
                          onAnimationEnd={() => {
                            if (playing) goTo(active + 1)
                          }}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div className={styles.ctrlGroup}>
                <button
                  type="button"
                  className={styles.ctrlBtn}
                  aria-label="Previous"
                  onClick={() => goTo(active - 1)}
                >
                  <ArrowLeft size={20} weight="regular" />
                </button>
                <button
                  type="button"
                  className={styles.ctrlBtn}
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? <Pause size={20} weight="regular" /> : <Play size={20} weight="regular" />}
                </button>
                <button
                  type="button"
                  className={styles.ctrlBtn}
                  aria-label="Next"
                  onClick={() => goTo(active + 1)}
                >
                  <ArrowRight size={20} weight="regular" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.section}${reserveComposer ? '' : ` ${styles.sectionCompact}`}`}
          aria-labelledby={listing === 'conversations' ? 'conversations-heading' : 'recommended'}
        >
          {listing === 'conversations' ? (
            <ConversationGrid onOpen={onOpenConversation} />
          ) : (
          <>
          <h2 id="recommended" className={styles.sectionEyebrow}>
            Recommended For you
          </h2>
          <div className={styles.storyGrid}>
            {RECOMMENDED.map((story) => {
              const layers = storyThumbLayers(story.thumb)
              return (
                <article key={story.id} className={styles.storyCard}>
                  <button
                    type="button"
                    className={styles.storyCardBtn}
                    onClick={() => onOpenStory?.(story.id)}
                    aria-label={`Open story: ${story.title}`}
                  >
                    <div className={styles.storyMedia}>
                      <div className={styles.storyMediaLayers} aria-hidden>
                        <img
                          className={styles.storyMediaImg}
                          src={layers.image}
                          alt=""
                        />
                        {layers.overlay ? (
                          <img
                            className={styles.storyMediaOverlay}
                            src={layers.overlay}
                            alt=""
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.storyBody}>
                      <div className={styles.storyCopy}>
                        <span className={styles.storyCategory}>{story.category}</span>
                        <h3 className={styles.storyTitle}>{story.title}</h3>
                      </div>
                      <p className={styles.storyKind}>
                        {story.kind} / {story.sections}
                      </p>
                    </div>
                  </button>
                </article>
              )
            })}
          </div>
          </>
          )}
        </section>
      </main>
    </div>
  )
}
