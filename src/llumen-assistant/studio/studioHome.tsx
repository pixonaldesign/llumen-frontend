import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  ChartBar,
  ChartDonut,
  ChartLine,
  CheckCircle,
  Clock,
  Database,
  FlowArrow,
  Gauge,
  Lightning,
  Newspaper,
  Plus,
  PresentationChart,
  Sparkle,
  TrendUp,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import {
  STUDIO_APIS,
  STUDIO_ASSETS,
  STUDIO_BRIEFINGS,
  STUDIO_DATABASES,
  STUDIO_FILES,
  STUDIO_MEMBERS,
  ageMinutes,
  type StudioPage,
} from './studioData'
import { CATEGORY_COLOR, STATUS_COLOR, byRecent, ownerOf, type Go } from './studioAssetMeta'
import { Avatar, ChartFrame, Dot } from './studioExperiences'
import { StatusChip } from './studioUi'
import h from './StudioHome.module.css'

const PERIODS = ['Today', 'This week', 'This month'] as const
type Period = (typeof PERIODS)[number]

/** Per-period figures behind the stat tiles; the sparklines run oldest to newest. */
const PERIOD_STATS: Record<Period, { updated: number; briefings: number; spark: Record<string, number[]> }> = {
  Today: {
    updated: 4,
    briefings: 3,
    spark: { review: [1, 1, 2, 2, 3, 3], live: [7, 7, 8, 8, 8, 8], sources: [10, 11, 11, 11, 12, 11], briefings: [0, 1, 1, 2, 2, 3] },
  },
  'This week': {
    updated: 9,
    briefings: 10,
    spark: { review: [4, 2, 3, 5, 2, 3], live: [6, 6, 7, 7, 8, 8], sources: [9, 10, 12, 11, 11, 11], briefings: [1, 3, 2, 4, 1, 3] },
  },
  'This month': {
    updated: 14,
    briefings: 38,
    spark: { review: [6, 4, 5, 2, 4, 3], live: [5, 6, 6, 7, 7, 8], sources: [8, 9, 9, 10, 11, 11], briefings: [6, 9, 7, 11, 8, 12] },
  },
}

const SOURCES = [
  ...STUDIO_DATABASES.map((db) => ({ id: db.id, name: db.name, kind: db.type, status: db.userStatus, updated: db.updated })),
  ...STUDIO_APIS.map((api) => ({ id: api.id, name: api.name, kind: `API · ${api.auth}`, status: api.userStatus, updated: api.updated })),
  ...STUDIO_FILES.map((file) => ({ id: file.id, name: file.name, kind: file.type, status: file.userStatus, updated: file.tested })),
]

const INSIGHTS: { asset: string; kind: string; tone: 'alert' | 'watch' | 'good'; text: ReactNode }[] = [
  {
    asset: 'abstraction-recharge',
    kind: 'Alert',
    tone: 'alert',
    text: (
      <>
        Abstraction is outpacing recharge <strong>24 to 1</strong>, and the gap widened since last week.
      </>
    ),
  },
  {
    asset: 'water-quality',
    kind: 'Watch',
    tone: 'watch',
    text: (
      <>
        Wells within quality standards sit at <strong>82%</strong>, eight points under the 90% target.
      </>
    ),
  },
  {
    asset: 'monitoring-sites',
    kind: 'Milestone',
    tone: 'good',
    text: (
      <>
        Monitoring uptime held at <strong>94%</strong> this month, with a single outage day flagged.
      </>
    ),
  },
]

const INSIGHT_ICON = {
  alert: <WarningCircle size={14} weight="fill" aria-hidden />,
  watch: <TrendUp size={14} weight="bold" aria-hidden />,
  good: <CheckCircle size={14} weight="fill" aria-hidden />,
}

const SCHEDULE: { when: string; time: string; title: string; detail: string; icon: ReactNode; page: StudioPage }[] = [
  { when: 'Today', time: '14:00', title: 'Weekly emissions briefing', detail: 'Delivered to 12 readers', icon: <Newspaper size={16} aria-hidden />, page: 'briefings' },
  { when: 'Today', time: '16:30', title: 'Aimsun traffic sync', detail: 'PostgreSQL · full refresh', icon: <ArrowsClockwise size={16} aria-hidden />, page: 'database' },
  { when: 'Tomorrow', time: '09:00', title: 'Operations dashboard refresh', detail: 'Live KPIs for the quarter', icon: <PresentationChart size={16} aria-hidden />, page: 'dashboards' },
  { when: 'Fri', time: '11:00', title: 'User onboarding workflow', detail: '4 agents scheduled', icon: <FlowArrow size={16} aria-hidden />, page: 'workflows' },
]

const VERBS = ['updated', 'commented on', 'published', 'changed the source of', 'shared', 'restyled']

const TEMPLATES: { icon: ReactNode; title: string; hint: string }[] = [
  { icon: <ChartLine size={22} aria-hidden />, title: 'Trend over time', hint: 'Line or area, with a target' },
  { icon: <ChartBar size={22} aria-hidden />, title: 'Monthly columns', hint: 'Compare months or sites' },
  { icon: <ChartDonut size={22} aria-hidden />, title: 'Share of a whole', hint: 'Donut with a legend' },
  { icon: <Gauge size={22} aria-hidden />, title: 'Progress to target', hint: 'Meter or radial gauge' },
]

const ASK_CHIPS = ['Catch me up', 'What changed since Monday?', 'Which sources are stale?']

function assetById(id: string) {
  return STUDIO_ASSETS.find((asset) => asset.id === id) ?? STUDIO_ASSETS[0]
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 28 - ((value - min) / span) * 24])
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg className={h.spark} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      <path className={h.sparkArea} d={`${line} L100 32 L0 32 Z`} />
      <path className={h.sparkLine} d={line} />
    </svg>
  )
}

/** A home that answers "what needs me, what changed, what's next" before anyone opens a page. */
export function RichHome({
  go,
  onCreate,
  pinned,
  spotlight,
  onSpotlight,
}: {
  go: Go
  onCreate: () => void
  pinned: string[]
  spotlight: string
  onSpotlight: (id: string) => void
}) {
  const [period, setPeriod] = useState<Period>('This week')
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const spotlightRef = useRef<HTMLElement>(null)
  const shownSpotlight = useRef(spotlight)
  useEffect(() => {
    if (shownSpotlight.current === spotlight) return
    shownSpotlight.current = spotlight
    spotlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [spotlight])
  const stats = PERIOD_STATS[period]
  const review = STUDIO_ASSETS.filter((asset) => asset.status === 'Pending Review')
  const live = STUDIO_ASSETS.filter((asset) => asset.status === 'Active')
  const healthy = SOURCES.filter((source) => source.status === 'Active')
  const paused = SOURCES.length - healthy.length
  const pausedText = paused === 1 ? 'one source is paused' : `${paused} sources are paused`
  const focus = assetById(spotlight)
  const feed = [...STUDIO_ASSETS].sort(byRecent).slice(0, 6)
  const team = STUDIO_MEMBERS.filter((member) => member.role !== 'Viewer').map((member, index) => {
    const owned = STUDIO_ASSETS.filter((asset) => ownerOf(asset).id === member.id).length
    return { member, owned, edits: owned * 7 + ((index * 5) % 11) + 3, online: index < 3 }
  })
  const topEdits = Math.max(...team.map((row) => row.edits))

  const tiles: { id: string; label: string; value: ReactNode; note: string; icon: ReactNode; tone: string; page: StudioPage }[] = [
    { id: 'review', label: 'Waiting for review', value: review.length, note: 'Oldest is 3 days', icon: <Clock size={16} aria-hidden />, tone: 'amber', page: 'assets' },
    { id: 'live', label: 'Live assets', value: `${live.length}/${STUDIO_ASSETS.length}`, note: `${stats.updated} changed ${period.toLowerCase()}`, icon: <Lightning size={16} aria-hidden />, tone: 'green', page: 'assets' },
    { id: 'sources', label: 'Sources in sync', value: `${healthy.length}/${SOURCES.length}`, note: 'Last sync 2 hours ago', icon: <Database size={16} aria-hidden />, tone: 'blue', page: 'database' },
    { id: 'briefings', label: 'Briefings shipped', value: stats.briefings, note: `${STUDIO_BRIEFINGS.length} in the library`, icon: <Newspaper size={16} aria-hidden />, tone: 'violet', page: 'briefings' },
  ]

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setReply(
      `Since Monday ${stats.updated} assets changed and ${review.length} wait for review. Abstraction is outpacing recharge 24 to 1, and ${pausedText}.`,
    )
    setQuestion('')
  }

  return (
    <div className={h.home}>
      <header className={h.head}>
        <div className={h.greeting}>
          <span className={h.eyebrow}>
            <CalendarBlank size={14} aria-hidden />
            Wednesday, 28 October
          </span>
          <h1 className={h.title}>Good afternoon, Omar</h1>
          <p className={h.lede}>
            {review.length} assets need your review, {pausedText}, and the emissions briefing goes out at 14:00.
          </p>
        </div>
        <div className={h.headTools}>
          <div className={h.segmented} role="radiogroup" aria-label="Period">
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={period === option}
                className={h.segment}
                onClick={() => setPeriod(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <button type="button" className={h.primary} onClick={onCreate}>
            <Plus size={16} aria-hidden />
            New asset
          </button>
        </div>
      </header>

      <div className={h.tiles}>
        {tiles.map((tile) => (
          <button key={tile.id} type="button" className={h.tile} data-tone={tile.tone} onClick={() => go(tile.page)}>
            <span className={h.tileLabel}>
              {tile.icon}
              {tile.label}
            </span>
            <span className={h.tileValue}>{tile.value}</span>
            <span className={h.tileNote}>{tile.note}</span>
            <Sparkline key={period} values={stats.spark[tile.id]} />
          </button>
        ))}
      </div>

      <div className={h.grid}>
        <section className={`${h.card} ${h.span8}`} aria-labelledby="home-noticed">
          <div className={h.cardHead}>
            <h2 id="home-noticed" className={h.cardTitle}>
              <Sparkle size={16} weight="fill" className={h.brand} aria-hidden />
              Llumen noticed
            </h2>
            <span className={h.muted}>Updated 12 min ago</span>
          </div>
          <ul className={h.insights}>
            {INSIGHTS.map((insight, index) => {
              const asset = assetById(insight.asset)
              return (
                <li key={insight.asset} className={h.insight}>
                  <ChartFrame asset={asset} delay={index * 90} className={h.insightChart} />
                  <div className={h.insightBody}>
                    <span className={h.insightKind} data-tone={insight.tone}>
                      {INSIGHT_ICON[insight.tone]}
                      {insight.kind}
                    </span>
                    <p className={h.insightText}>{insight.text}</p>
                    <span className={h.insightActions}>
                      <button type="button" className={h.pill} onClick={() => onSpotlight(asset.id)}>
                        Spotlight it
                      </button>
                      <button type="button" className={h.link} onClick={() => go('briefings')}>
                        Add to a briefing
                        <ArrowRight size={14} aria-hidden />
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className={`${h.card} ${h.span4}`} aria-labelledby="home-next">
          <div className={h.cardHead}>
            <h2 id="home-next" className={h.cardTitle}>
              Up next
            </h2>
            <span className={h.count}>{SCHEDULE.length}</span>
          </div>
          <ol className={h.schedule}>
            {SCHEDULE.map((item) => (
              <li key={item.title}>
                <button type="button" className={h.scheduleRow} onClick={() => go(item.page)}>
                  <span className={h.when}>
                    <span className={h.whenDay}>{item.when}</span>
                    <span className={h.whenTime}>{item.time}</span>
                  </span>
                  <span className={h.scheduleIcon}>{item.icon}</span>
                  <span className={h.scheduleText}>
                    <span className={h.scheduleTitle}>{item.title}</span>
                    <span className={h.muted}>{item.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section ref={spotlightRef} className={`${h.card} ${h.span8}`} aria-labelledby="home-spotlight">
          <div className={h.cardHead}>
            <h2 id="home-spotlight" className={h.cardTitle}>
              Spotlight
            </h2>
            <div className={h.spotTabs} role="tablist" aria-label="Pinned assets">
              {pinned.map((id) => {
                const asset = assetById(id)
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={spotlight === id}
                    className={h.spotTab}
                    title={asset.title}
                    onClick={() => onSpotlight(id)}
                  >
                    <Dot color={CATEGORY_COLOR[asset.category] ?? '#fff'} />
                    <span className={h.spotTabLabel}>{asset.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className={h.spotBody} role="tabpanel">
            <ChartFrame key={focus.id} asset={focus} className={h.spotChart} />
            <div className={h.spotSide}>
              <h3 className={h.spotTitle}>{focus.title}</h3>
              <p className={h.muted}>{focus.description}</p>
              <dl className={h.spotFacts}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusChip label={focus.status} />
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>
                    <Avatar name={ownerOf(focus).name} />
                    {ownerOf(focus).name}
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{focus.type}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{focus.updated}</dd>
                </div>
              </dl>
              <button type="button" className={h.link} onClick={() => go('assets')}>
                Open in assets
                <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <section className={`${h.card} ${h.span4}`} aria-labelledby="home-activity">
          <div className={h.cardHead}>
            <h2 id="home-activity" className={h.cardTitle}>
              Activity
            </h2>
            <button type="button" className={h.link} onClick={() => go('members')}>
              Team
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>
          <ol className={h.feed}>
            {feed.map((asset, index) => (
              <li key={asset.id} className={h.feedRow}>
                <Avatar name={ownerOf(asset).name} />
                <span className={h.feedText}>
                  <span>
                    <strong>{ownerOf(asset).name}</strong> {VERBS[index % VERBS.length]}{' '}
                    <button type="button" className={h.inlineLink} onClick={() => onSpotlight(asset.id)}>
                      {asset.title}
                    </button>
                  </span>
                  <span className={h.muted}>{asset.updated}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${h.card} ${h.span6}`} aria-labelledby="home-sources">
          <div className={h.cardHead}>
            <h2 id="home-sources" className={h.cardTitle}>
              Source health
            </h2>
            <button type="button" className={h.link} onClick={() => go('database')}>
              All sources
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>
          <ul className={h.sources}>
            {SOURCES.slice(0, 7).map((source) => {
              const fresh = Math.max(8, 100 - (ageMinutes(source.updated) / (60 * 24 * 7)) * 100)
              const ok = source.status === 'Active'
              return (
                <li key={source.id} className={h.sourceRow}>
                  <span className={h.statusDot} style={{ background: ok ? STATUS_COLOR.Active : '#e4576b' }} aria-hidden />
                  <span className={h.sourceText}>
                    <span className={h.sourceName}>{source.name}</span>
                    <span className={h.muted}>{source.kind}</span>
                  </span>
                  <span className={h.fresh} aria-label={`Freshness ${Math.round(fresh)}%`}>
                    <span style={{ width: `${fresh}%`, background: ok ? undefined : '#e4576b' }} />
                  </span>
                  <span className={h.sourceWhen}>{ok ? source.updated : 'Paused'}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className={`${h.card} ${h.span6}`} aria-labelledby="home-team">
          <div className={h.cardHead}>
            <h2 id="home-team" className={h.cardTitle}>
              Who's building
            </h2>
            <span className={h.muted}>Edits {period.toLowerCase()}</span>
          </div>
          <ul className={h.team}>
            {team.map((row) => (
              <li key={row.member.id} className={h.teamRow}>
                <span className={h.teamAvatar} data-online={row.online || undefined}>
                  <Avatar name={row.member.name} />
                </span>
                <span className={h.sourceText}>
                  <span className={h.sourceName}>{row.member.name}</span>
                  <span className={h.muted}>
                    {row.member.role} · {row.owned} {row.owned === 1 ? 'asset' : 'assets'}
                  </span>
                </span>
                <span className={h.teamBar}>
                  <span style={{ width: `${(row.edits / topEdits) * 100}%` }} />
                </span>
                <span className={h.teamCount}>{row.edits}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${h.span12}`} aria-labelledby="home-templates">
          <div className={h.cardHead}>
            <h2 id="home-templates" className={h.cardTitle}>
              Start from a template
            </h2>
          </div>
          <div className={h.templates}>
            {TEMPLATES.map((template) => (
              <button key={template.title} type="button" className={h.template} onClick={onCreate}>
                <span className={h.templateIcon}>{template.icon}</span>
                <span className={h.scheduleText}>
                  <span className={h.scheduleTitle}>{template.title}</span>
                  <span className={h.muted}>{template.hint}</span>
                </span>
                <ArrowRight className={h.templateArrow} size={16} aria-hidden />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={h.composerDock}>
        {reply ? (
          <div className={h.reply} role="status">
            <Sparkle size={16} weight="fill" className={h.brand} aria-hidden />
            <p>{reply}</p>
            <button type="button" className={h.replyClose} aria-label="Dismiss" onClick={() => setReply(null)}>
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : null}
        <form
          className={h.composer}
          onSubmit={(event) => {
            event.preventDefault()
            ask(question)
          }}
        >
          <span className={h.composerChips}>
            {ASK_CHIPS.map((chip) => (
              <button key={chip} type="button" className={h.composerChip} onClick={() => ask(chip)}>
                {chip}
              </button>
            ))}
          </span>
          <span className={h.composerRow}>
            <Sparkle size={18} className={h.brand} aria-hidden />
            <input
              className={h.composerInput}
              value={question}
              placeholder="Ask anything about this workspace…"
              aria-label="Ask about this workspace"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="submit" className={h.composerSend} aria-label="Ask" disabled={!question.trim()}>
              <ArrowRight size={16} aria-hidden />
            </button>
          </span>
        </form>
      </div>
    </div>
  )
}
