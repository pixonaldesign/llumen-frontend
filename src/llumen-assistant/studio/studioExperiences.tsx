import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ArrowsOutSimple,
  CaretLeft,
  CaretRight,
  ChartLine,
  ChatCircleText,
  CheckCircle,
  Clock,
  CopySimple,
  Cube,
  Database,
  DotsThree,
  MagnifyingGlass,
  Newspaper,
  PencilSimple,
  Plus,
  Prohibit,
  ShareFat,
  Sparkle,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import {
  STUDIO_APIS,
  STUDIO_ASSETS,
  STUDIO_BRIEFINGS,
  STUDIO_DASHBOARDS,
  STUDIO_DATABASES,
  STUDIO_FILES,
  STUDIO_SLIDES,
  STUDIO_WORKFLOWS,
  STUDIO_WORKSPACE_NAMES,
  type StudioAsset,
  type StudioPage,
} from './studioData'
import { STUDIO_ASSET_CHARTS } from './studioAssetCharts'
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  CATEGORY_COLOR,
  OWNERS,
  STATUS_COLOR,
  byRecent,
  initials,
  ownerOf,
  type AssetStatus,
  type Go,
} from './studioAssetMeta'
import { StudioAssetChart } from './StudioAssetChart'
import { useDismiss } from './studioHooks'
import { Button, Dropdown, SearchField, StatusChip, Tag } from './studioUi'
import s from './StudioScenarios.module.css'

const STATUS_ICON: Record<AssetStatus, ReactNode> = {
  Active: <CheckCircle size={16} aria-hidden />,
  'Pending Review': <Clock size={16} aria-hidden />,
  Inactive: <Prohibit size={16} aria-hidden />,
}

/** The asset's live chart at its artwork's proportions. */
export function ChartFrame({
  asset,
  delay = 0,
  className,
}: {
  asset: StudioAsset
  delay?: number
  className?: string
}) {
  const chart = STUDIO_ASSET_CHARTS[asset.id]
  return (
    <div className={`${s.frame}${className ? ` ${className}` : ''}`}>
      {chart ? <StudioAssetChart chart={chart} delay={delay} /> : <img src={asset.image} alt={asset.title} />}
    </div>
  )
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className={s.avatar} title={name} aria-label={name}>
      {initials(name)}
    </span>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className={s.dot} style={{ background: color }} aria-hidden />
}

/* ── 2 · Home hub ──────────────────────────────────────────────────────── */

const ASK_SUGGESTIONS = [
  'Groundwater abstraction by month',
  'Incidents by sector this quarter',
  'Species detections per habitat',
]

export function HomeHub({
  go,
  onCreate,
  workspace,
  onWorkspaceChange,
}: {
  go: Go
  onCreate: () => void
  workspace: string
  onWorkspaceChange: (workspace: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const recent = [...STUDIO_ASSETS].sort(byRecent).slice(0, 4)
  const review = STUDIO_ASSETS.filter((asset) => asset.status === 'Pending Review')
  const quick: { icon: ReactNode; title: string; hint: string; onClick: () => void }[] = [
    { icon: <Cube size={20} aria-hidden />, title: 'Create an asset', hint: 'Chart, KPI or map from your data', onClick: onCreate },
    { icon: <Database size={20} aria-hidden />, title: 'Connect a source', hint: 'Databases, APIs and files', onClick: () => go('database') },
    { icon: <Newspaper size={20} aria-hidden />, title: 'Write a briefing', hint: 'Share what changed today', onClick: () => go('briefings') },
    { icon: <UsersThree size={20} aria-hidden />, title: 'Invite members', hint: 'Editors, contributors, viewers', onClick: () => go('members') },
  ]
  const glance: { label: string; value: number; page: StudioPage }[] = [
    { label: 'Assets', value: STUDIO_ASSETS.length, page: 'assets' },
    { label: 'Databases', value: STUDIO_DATABASES.length, page: 'database' },
    { label: 'API collections', value: STUDIO_APIS.length, page: 'apis' },
    { label: 'Files', value: STUDIO_FILES.length, page: 'files' },
    { label: 'Briefings', value: STUDIO_BRIEFINGS.length, page: 'briefings' },
    { label: 'Slides', value: STUDIO_SLIDES.length, page: 'slides' },
    { label: 'Dashboards', value: STUDIO_DASHBOARDS.length, page: 'dashboards' },
    { label: 'Workflows', value: STUDIO_WORKFLOWS.length, page: 'workflows' },
  ]
  return (
    <div className={s.hub}>
      <header className={s.hubHead}>
        <div className={s.hubGreeting}>
          <span className={s.eyebrow}>Studio home</span>
          <h1 className={s.hubTitle}>Good afternoon, Omar</h1>
          <p className={s.hubLede}>
            {review.length} assets are waiting for review and {recent.length} changed in the last day.
          </p>
        </div>
        <div className={s.hubWorkspace}>
          <Dropdown label="Workspace" options={STUDIO_WORKSPACE_NAMES} value={workspace} onChange={onWorkspaceChange} full />
        </div>
      </header>

      <form
        className={s.ask}
        onSubmit={(event) => {
          event.preventDefault()
          onCreate()
        }}
      >
        <Sparkle className={s.askIcon} size={20} weight="fill" aria-hidden />
        <input
          className={s.askInput}
          value={prompt}
          placeholder="Describe an asset and Llumen will build it…"
          aria-label="Describe an asset"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button type="submit" className={s.askSubmit} disabled={!prompt.trim()}>
          Build
          <ArrowRight size={16} aria-hidden />
        </button>
      </form>
      <div className={s.suggestions}>
        {ASK_SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" className={s.suggestion} onClick={() => setPrompt(suggestion)}>
            <Sparkle size={14} aria-hidden />
            {suggestion}
          </button>
        ))}
      </div>

      <div className={s.quickGrid}>
        {quick.map((item) => (
          <button key={item.title} type="button" className={s.quickCard} onClick={item.onClick}>
            <span className={s.quickIcon}>{item.icon}</span>
            <span className={s.quickText}>
              <span className={s.quickTitle}>{item.title}</span>
              <span className={s.quickHint}>{item.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <section className={s.hubSection} aria-labelledby="hub-recent">
        <div className={s.sectionHead}>
          <h2 id="hub-recent" className={s.sectionTitle}>
            Recently updated
          </h2>
          <button type="button" className={s.linkButton} onClick={() => go('assets')}>
            All assets
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
        <div className={s.recentGrid}>
          {recent.map((asset, index) => (
            <article key={asset.id} className={s.tile}>
              <ChartFrame asset={asset} delay={index * 80} />
              <div className={s.tileMeta}>
                <span className={s.tileType}>
                  <ChartLine size={14} aria-hidden />
                  {asset.type}
                </span>
                <span className={s.tileUpdated}>{asset.updated}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={s.hubColumns}>
        <section className={s.panel} aria-labelledby="hub-review">
          <div className={s.sectionHead}>
            <h2 id="hub-review" className={s.sectionTitle}>
              Needs your review
            </h2>
            <span className={s.count}>{review.length}</span>
          </div>
          <ul className={s.reviewList}>
            {review.map((asset) => (
              <li key={asset.id} className={s.reviewRow}>
                <img className={s.reviewThumb} src={asset.image} alt="" />
                <span className={s.reviewText}>
                  <span className={s.reviewTitle}>{asset.title}</span>
                  <span className={s.reviewDetail}>
                    {asset.category} · {ownerOf(asset).name} · {asset.updated}
                  </span>
                </span>
                <button type="button" className={s.pillButton} onClick={() => go('assets')}>
                  Review
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className={s.panel} aria-labelledby="hub-glance">
          <div className={s.sectionHead}>
            <h2 id="hub-glance" className={s.sectionTitle}>
              Workspace at a glance
            </h2>
          </div>
          <div className={s.glanceGrid}>
            {glance.map((item) => (
              <button key={item.label} type="button" className={s.glance} onClick={() => go(item.page)}>
                <span className={s.glanceValue}>{item.value}</span>
                <span className={s.glanceLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── 3 · List and inspector ────────────────────────────────────────────── */

const ACTIVITY = ['edited the chart', 'changed the data source', 'created the asset']

export function InspectorAssets({ onCreate }: { onCreate: () => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | AssetStatus>('All')
  const [selectedId, setSelectedId] = useState(STUDIO_ASSETS[0].id)
  const listRef = useRef<HTMLDivElement>(null)
  const needle = query.trim().toLowerCase()
  const rows = STUDIO_ASSETS.filter(
    (asset) =>
      (status === 'All' || asset.status === status) &&
      (!needle || `${asset.title} ${asset.description} ${asset.category}`.toLowerCase().includes(needle)),
  )
  const groups = ASSET_CATEGORIES.map((category) => ({
    category,
    items: rows.filter((asset) => asset.category === category),
  })).filter((group) => group.items.length > 0)
  const ordered = groups.flatMap((group) => group.items)
  const selected = ordered.find((asset) => asset.id === selectedId) ?? ordered[0]
  const used = [STUDIO_DASHBOARDS, STUDIO_SLIDES].map((list) => list[STUDIO_ASSETS.indexOf(selected ?? STUDIO_ASSETS[0]) % list.length])

  const move = (step: number) => {
    if (!selected) return
    const next = ordered[Math.max(0, Math.min(ordered.length - 1, ordered.indexOf(selected) + step))]
    setSelectedId(next.id)
    listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className={s.split}>
      <section className={s.listPane} aria-label="Assets">
        <div className={s.listHead}>
          <div className={s.listTitleRow}>
            <h2 className={s.paneTitle}>Assets</h2>
            <span className={s.count}>{rows.length}</span>
            <button type="button" className={s.iconButton} aria-label="Create asset" onClick={onCreate}>
              <Plus size={18} aria-hidden />
            </button>
          </div>
          <SearchField placeholder="Search assets..." value={query} onChange={setQuery} />
          <div className={s.segmented} role="radiogroup" aria-label="Status">
            {(['All', ...ASSET_STATUSES] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={status === option}
                className={s.segment}
                onClick={() => setStatus(option)}
              >
                {option === 'Pending Review' ? 'Review' : option}
              </button>
            ))}
          </div>
        </div>
        <div
          ref={listRef}
          className={s.listScroll}
          role="listbox"
          aria-label="Assets"
          aria-activedescendant={selected ? `inspect-${selected.id}` : undefined}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              move(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              move(-1)
            }
          }}
        >
          {groups.map((group) => (
            <div key={group.category} className={s.listGroup} role="group" aria-label={group.category}>
              <div className={s.groupLabel}>
                <Dot color={CATEGORY_COLOR[group.category] ?? '#fff'} />
                {group.category}
                <span className={s.groupCount}>{group.items.length}</span>
              </div>
              {group.items.map((asset) => (
                <div
                  key={asset.id}
                  id={`inspect-${asset.id}`}
                  data-id={asset.id}
                  role="option"
                  aria-selected={asset.id === selected?.id}
                  className={s.listRow}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <img className={s.listThumb} src={asset.image} alt="" />
                  <span className={s.listText}>
                    <span className={s.listName}>{asset.title}</span>
                    <span className={s.listDetail}>
                      {asset.type} · {asset.updated}
                    </span>
                  </span>
                  <span
                    className={s.statusDot}
                    style={{ background: STATUS_COLOR[asset.status] }}
                    title={asset.status}
                    aria-label={asset.status}
                  />
                </div>
              ))}
            </div>
          ))}
          {groups.length === 0 ? <p className={s.empty}>Nothing matches these filters.</p> : null}
        </div>
      </section>

      <section className={s.inspector} aria-label="Asset details">
        {selected ? (
          <div className={s.inspectorBody} key={selected.id}>
            <header className={s.inspectorHead}>
              <div className={s.inspectorTitles}>
                <span className={s.eyebrow}>
                  <Dot color={CATEGORY_COLOR[selected.category] ?? '#fff'} />
                  {selected.category}
                </span>
                <h2 className={s.inspectorTitle}>{selected.title}</h2>
                <p className={s.inspectorLede}>{selected.description}</p>
              </div>
              <div className={s.inspectorActions}>
                <Button variant="solid" icon={<PencilSimple size={18} aria-hidden />} onClick={onCreate}>
                  Edit
                </Button>
                <button type="button" className={s.iconButton} aria-label="Share">
                  <ShareFat size={18} aria-hidden />
                </button>
                <button type="button" className={s.iconButton} aria-label="Duplicate">
                  <CopySimple size={18} aria-hidden />
                </button>
                <button type="button" className={s.iconButton} aria-label="More actions">
                  <DotsThree size={18} weight="bold" aria-hidden />
                </button>
              </div>
            </header>
            <ChartFrame asset={selected} className={s.inspectorChart} />
            <dl className={s.facts}>
              <div className={s.fact}>
                <dt>Status</dt>
                <dd>
                  <StatusChip label={selected.status} />
                </dd>
              </div>
              <div className={s.fact}>
                <dt>Type</dt>
                <dd>{selected.type}</dd>
              </div>
              <div className={s.fact}>
                <dt>Owner</dt>
                <dd className={s.factOwner}>
                  <Avatar name={ownerOf(selected).name} />
                  {ownerOf(selected).name}
                </dd>
              </div>
              <div className={s.fact}>
                <dt>Last updated</dt>
                <dd>{selected.updated}</dd>
              </div>
            </dl>
            <div className={s.inspectorColumns}>
              <section aria-labelledby="inspect-used">
                <h3 id="inspect-used" className={s.subTitle}>
                  Used in
                </h3>
                <ul className={s.usedList}>
                  {used.map((story) => (
                    <li key={story.id} className={s.usedRow}>
                      <img src={story.image} alt="" />
                      <span>{story.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="inspect-activity">
                <h3 id="inspect-activity" className={s.subTitle}>
                  Activity
                </h3>
                <ol className={s.timeline}>
                  {ACTIVITY.map((what, i) => {
                    const who = OWNERS[(STUDIO_ASSETS.indexOf(selected) + i) % OWNERS.length]
                    return (
                      <li key={what}>
                        <Avatar name={who.name} />
                        <span>
                          <strong>{who.name}</strong> {what}
                          <span className={s.timelineWhen}>{i === 0 ? selected.updated : `${i * 3 + 2} days ago`}</span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            </div>
          </div>
        ) : (
          <p className={s.empty}>Pick an asset to see it here.</p>
        )}
      </section>
    </div>
  )
}

/* ── 4 · Bento overview ────────────────────────────────────────────────── */

/** Where each card sits in the bento: the most recent leads large, and every fifth spreads wide with its notes. */
function bentoSize(index: number) {
  if (index === 0) return 'hero'
  if (index % 5 === 3) return 'wide'
  return 'base'
}

export function BentoAssets({
  onCreate,
  workspace,
  onWorkspaceChange,
}: {
  onCreate: () => void
  workspace: string
  onWorkspaceChange: (workspace: string) => void
}) {
  const [status, setStatus] = useState<'All' | AssetStatus>('All')
  const [category, setCategory] = useState('All')
  const rows = [...STUDIO_ASSETS]
    .sort(byRecent)
    .filter((asset) => (status === 'All' || asset.status === status) && (category === 'All' || asset.category === category))
  const kpis: { key: 'All' | AssetStatus; label: string; value: number; color: string }[] = [
    { key: 'All', label: 'All assets', value: STUDIO_ASSETS.length, color: '#70aeff' },
    ...ASSET_STATUSES.map((key) => ({
      key,
      label: key,
      value: STUDIO_ASSETS.filter((asset) => asset.status === key).length,
      color: STATUS_COLOR[key],
    })),
  ]
  return (
    <div className={s.bento}>
      <header className={s.bentoHead}>
        <div>
          <span className={s.eyebrow}>Overview</span>
          <h1 className={s.pageTitle}>Assets</h1>
        </div>
        <div className={s.bentoTools}>
          <div className={s.bentoWorkspace}>
            <Dropdown label="Workspace" options={STUDIO_WORKSPACE_NAMES} value={workspace} onChange={onWorkspaceChange} full />
          </div>
          <Button variant="solid" icon={<Plus size={18} aria-hidden />} onClick={onCreate}>
            Create asset
          </Button>
        </div>
      </header>

      <div className={s.kpiStrip} role="radiogroup" aria-label="Status">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            role="radio"
            aria-checked={status === kpi.key}
            className={s.kpi}
            style={{ '--kpi': kpi.color } as CSSProperties}
            onClick={() => setStatus(kpi.key)}
          >
            <span className={s.kpiLabel}>
              {kpi.key === 'All' ? <ChartLine size={16} aria-hidden /> : STATUS_ICON[kpi.key]}
              {kpi.label}
            </span>
            <span className={s.kpiValue}>{kpi.value}</span>
            <span className={s.kpiBar}>
              <span style={{ width: `${(kpi.value / STUDIO_ASSETS.length) * 100}%` }} />
            </span>
          </button>
        ))}
      </div>

      <div className={s.chips} role="radiogroup" aria-label="Category">
        {['All', ...ASSET_CATEGORIES].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={category === option}
            className={s.chip}
            onClick={() => setCategory(option)}
          >
            {option === 'All' ? null : <Dot color={CATEGORY_COLOR[option] ?? '#fff'} />}
            {option}
          </button>
        ))}
      </div>

      {rows.length === 0 ? <p className={s.empty}>Nothing matches these filters.</p> : null}
      <div className={s.bentoGrid}>
        {rows.map((asset, index) => {
          const size = bentoSize(index)
          return (
            <article key={asset.id} className={s.bentoCard} data-size={size} aria-label={asset.title}>
              <ChartFrame asset={asset} delay={Math.min(index, 8) * 60} />
              {size === 'wide' ? (
                <div className={s.bentoNotes}>
                  <span className={s.eyebrow}>
                    <Dot color={CATEGORY_COLOR[asset.category] ?? '#fff'} />
                    {asset.category}
                  </span>
                  <p className={s.bentoDescription}>{asset.description}</p>
                  <div className={s.bentoOwner}>
                    <Avatar name={ownerOf(asset).name} />
                    <span>
                      {ownerOf(asset).name}
                      <span className={s.muted}> · {asset.updated}</span>
                    </span>
                  </div>
                  <StatusChip label={asset.status} />
                </div>
              ) : (
                <div className={s.bentoMeta}>
                  <Tag icon={<ChartLine size={16} aria-hidden />}>{asset.type}</Tag>
                  <span className={s.muted}>{asset.updated}</span>
                  <span className={s.metaEnd}>
                    <StatusChip label={asset.status} />
                  </span>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

/* ── 5 · Status board ──────────────────────────────────────────────────── */

export function BoardAssets({ view, onCreate }: { view: string; onCreate: () => void }) {
  const [moved, setMoved] = useState<Record<string, AssetStatus>>({})
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<AssetStatus | null>(null)
  const statusOf = (asset: StudioAsset) => moved[asset.id] ?? (asset.status as AssetStatus)
  const needle = query.trim().toLowerCase()
  const rows = STUDIO_ASSETS.filter(
    (asset) =>
      (view === 'All assets' || asset.category === view) && (!needle || asset.title.toLowerCase().includes(needle)),
  )
  const moveTo = (id: string, status: AssetStatus) => setMoved((prev) => ({ ...prev, [id]: status }))

  return (
    <div className={s.board}>
      <header className={s.boardHead}>
        <div>
          <span className={s.eyebrow}>Board · grouped by status</span>
          <h1 className={s.pageTitle}>{view}</h1>
        </div>
        <div className={s.boardTools}>
          <SearchField placeholder="Search this board..." value={query} onChange={setQuery} />
          <Button variant="solid" icon={<Plus size={18} aria-hidden />} onClick={onCreate}>
            Create asset
          </Button>
        </div>
      </header>
      <div className={s.columns}>
        {ASSET_STATUSES.map((status) => {
          const cards = rows.filter((asset) => statusOf(asset) === status)
          return (
            <section
              key={status}
              className={s.column}
              data-over={over === status || undefined}
              aria-label={status}
              onDragOver={(event: DragEvent) => {
                if (!dragging) return
                event.preventDefault()
                setOver(status)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragging) moveTo(dragging, status)
                setDragging(null)
                setOver(null)
              }}
            >
              <header className={s.columnHead}>
                <span className={s.columnName} style={{ color: STATUS_COLOR[status] }}>
                  {STATUS_ICON[status]}
                </span>
                <h2 className={s.columnTitle}>{status}</h2>
                <span className={s.count}>{cards.length}</span>
              </header>
              <div className={s.columnCards}>
                {cards.map((asset, index) => (
                  <BoardCard
                    key={asset.id}
                    asset={asset}
                    status={status}
                    delay={index * 70}
                    dragging={dragging === asset.id}
                    onDragStart={() => setDragging(asset.id)}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                    onMove={(next) => moveTo(asset.id, next)}
                  />
                ))}
                {cards.length === 0 ? <p className={s.columnEmpty}>Drop an asset here</p> : null}
              </div>
              <button type="button" className={s.columnAdd} onClick={onCreate}>
                <Plus size={16} aria-hidden />
                Add asset
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function BoardCard({
  asset,
  status,
  delay,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  asset: StudioAsset
  status: AssetStatus
  delay: number
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (status: AssetStatus) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useMemo(() => () => setMenuOpen(false), [])
  useDismiss(ref, menuOpen, close)
  return (
    <article
      className={s.boardCard}
      data-dragging={dragging || undefined}
      draggable
      aria-label={asset.title}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', asset.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      <ChartFrame asset={asset} delay={delay} />
      <div className={s.boardMeta}>
        <span className={s.tagDot}>
          <Dot color={CATEGORY_COLOR[asset.category] ?? '#fff'} />
          {asset.category}
        </span>
        <span className={s.muted}>{asset.updated}</span>
        <span className={s.metaEnd}>
          <Avatar name={ownerOf(asset).name} />
          <div className={s.moveWrap} ref={ref}>
            <button
              type="button"
              className={s.iconButtonSmall}
              aria-label={`Move ${asset.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <DotsThree size={18} weight="bold" aria-hidden />
            </button>
            {menuOpen ? (
              <div className={s.popMenu} role="menu" aria-label="Move to">
                <span className={s.popLabel}>Move to</span>
                {ASSET_STATUSES.filter((option) => option !== status).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitem"
                    className={s.popItem}
                    onClick={() => {
                      onMove(option)
                      setMenuOpen(false)
                    }}
                  >
                    <span style={{ color: STATUS_COLOR[option], display: 'inline-flex' }}>{STATUS_ICON[option]}</span>
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </span>
      </div>
    </article>
  )
}

/* ── 6 · Gallery and lightbox ──────────────────────────────────────────── */

export function GalleryAssets({ onCreate }: { onCreate: () => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [open, setOpen] = useState<{ list: StudioAsset[]; index: number } | null>(null)
  const needle = query.trim().toLowerCase()
  const filtered = STUDIO_ASSETS.filter(
    (asset) =>
      (category === 'All' || asset.category === category) &&
      (!needle || `${asset.title} ${asset.description} ${asset.type}`.toLowerCase().includes(needle)),
  )
  const browsing = category === 'All' && !needle
  return (
    <div className={s.gallery}>
      <header className={s.galleryHero}>
        <h1 className={s.galleryTitle}>Asset library</h1>
        <p className={s.galleryLede}>
          {STUDIO_ASSETS.length} live visuals across {ASSET_CATEGORIES.length} categories. Hover a chart to read it, open
          it to work with it.
        </p>
        <label className={s.heroSearch}>
          <MagnifyingGlass size={20} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder="Search charts, KPIs and gauges"
            aria-label="Search assets"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className={s.heroCreate} onClick={onCreate}>
            <Plus size={16} aria-hidden />
            New asset
          </button>
        </label>
        <div className={`${s.chips} ${s.chipsCentre}`} role="radiogroup" aria-label="Category">
          {['All', ...ASSET_CATEGORIES].map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={category === option}
              className={s.chip}
              onClick={() => setCategory(option)}
            >
              {option === 'All' ? null : <Dot color={CATEGORY_COLOR[option] ?? '#fff'} />}
              {option}
              <span className={s.chipCount}>
                {option === 'All' ? STUDIO_ASSETS.length : STUDIO_ASSETS.filter((asset) => asset.category === option).length}
              </span>
            </button>
          ))}
        </div>
      </header>

      {browsing ? (
        GALLERY_SHELVES.map((shelf) => {
          const items = shelf.categories
            ? STUDIO_ASSETS.filter((asset) => shelf.categories?.includes(asset.category))
            : [...STUDIO_ASSETS].sort(byRecent)
          return (
            <Shelf
              key={shelf.name}
              name={shelf.name}
              categories={shelf.categories}
              items={items}
              onPick={setCategory}
              onOpen={(index) => setOpen({ list: items, index })}
            />
          )
        })
      ) : (
        <section className={s.shelf} aria-label="Results">
          <div className={s.shelfHead}>
            <h2 className={s.sectionTitle}>
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </h2>
            <button
              type="button"
              className={s.linkButton}
              onClick={() => {
                setCategory('All')
                setQuery('')
              }}
            >
              Clear
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className={s.galleryGrid}>
            {filtered.map((asset, index) => (
              <GalleryCard key={asset.id} asset={asset} delay={index * 60} onOpen={() => setOpen({ list: filtered, index })} />
            ))}
          </div>
          {filtered.length === 0 ? <p className={s.empty}>Nothing matches “{query}”.</p> : null}
        </section>
      )}

      {open ? (
        <Lightbox
          list={open.list}
          index={open.index}
          onIndex={(index) => setOpen({ ...open, index })}
          onClose={() => setOpen(null)}
          onEdit={onCreate}
        />
      ) : null}
    </div>
  )
}

/** Browsing shelves: everything by recency, then themes that each gather a few related categories. */
const GALLERY_SHELVES: { name: string; categories?: string[] }[] = [
  { name: 'Recently updated' },
  { name: 'Climate and energy', categories: ['Emissions', 'Net-Zero', 'Energy'] },
  { name: 'Water', categories: ['Groundwater', 'Water Quality'] },
  { name: 'Nature and field safety', categories: ['Biodiversity', 'Monitoring', 'Safety'] },
]

function Shelf({
  name,
  categories,
  items,
  onPick,
  onOpen,
}: {
  name: string
  categories?: string[]
  items: StudioAsset[]
  onPick: (category: string) => void
  onOpen: (index: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  const sync = () => {
    const row = rowRef.current
    if (!row) return
    setEdges({ start: row.scrollLeft < 4, end: row.scrollLeft + row.clientWidth > row.scrollWidth - 4 })
  }
  useEffect(() => {
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  const page = (direction: number) => rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className={s.shelf} aria-label={name}>
      <div className={s.shelfHead}>
        <div className={s.shelfTitles}>
          <h2 className={s.sectionTitle}>
            {name}
            <span className={s.count}>{items.length}</span>
          </h2>
          {categories ? (
            <span className={s.shelfCategories}>
              {categories.map((category) => (
                <button key={category} type="button" className={s.shelfCategory} onClick={() => onPick(category)}>
                  <Dot color={CATEGORY_COLOR[category] ?? '#fff'} />
                  {category}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        {edges.start && edges.end ? null : (
          <div className={s.shelfTools}>
            <button type="button" className={s.iconButton} aria-label={`Previous in ${name}`} disabled={edges.start} onClick={() => page(-1)}>
              <CaretLeft size={16} aria-hidden />
            </button>
            <button type="button" className={s.iconButton} aria-label={`Next in ${name}`} disabled={edges.end} onClick={() => page(1)}>
              <CaretRight size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>
      <div ref={rowRef} className={s.shelfRow} onScroll={sync}>
        {items.map((asset, index) => (
          <GalleryCard key={asset.id} asset={asset} delay={index * 80} onOpen={() => onOpen(index)} />
        ))}
      </div>
    </section>
  )
}

export function GalleryCard({
  asset,
  delay,
  onOpen,
  className,
}: {
  asset: StudioAsset
  delay: number
  onOpen: () => void
  className?: string
}) {
  return (
    <article className={className ? `${s.galleryCard} ${className}` : s.galleryCard} aria-label={asset.title}>
      <ChartFrame asset={asset} delay={delay} />
      <div className={s.galleryCaption}>
        <span className={s.statusDot} style={{ background: STATUS_COLOR[asset.status] }} aria-label={asset.status} />
        <span className={s.galleryType}>{asset.type}</span>
        <span className={s.muted}>{asset.updated}</span>
        <button type="button" className={s.openButton} onClick={onOpen} aria-label={`Open ${asset.title}`}>
          <ArrowsOutSimple size={16} aria-hidden />
          Open
        </button>
      </div>
    </article>
  )
}

export function Lightbox({
  list,
  index,
  onIndex,
  onClose,
  onEdit,
}: {
  list: StudioAsset[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  onEdit: () => void
}) {
  const asset = list[index]
  const step = (by: number) => onIndex((index + by + list.length) % list.length)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndex((index + 1) % list.length)
      if (event.key === 'ArrowLeft') onIndex((index - 1 + list.length) % list.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, list.length, onClose, onIndex])
  return createPortal(
    <div className={s.lightbox} onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={s.lightboxPanel} role="dialog" aria-modal="true" aria-label={asset.title}>
        <div className={s.lightboxStage}>
          <ChartFrame key={asset.id} asset={asset} className={s.lightboxChart} />
          {list.length > 1 ? (
            <div className={s.lightboxNav}>
              <button type="button" className={s.iconButton} aria-label="Previous asset" onClick={() => step(-1)}>
                <CaretLeft size={18} aria-hidden />
              </button>
              <span className={s.muted}>
                {index + 1} of {list.length}
              </span>
              <button type="button" className={s.iconButton} aria-label="Next asset" onClick={() => step(1)}>
                <CaretRight size={18} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        <aside className={s.lightboxSide}>
          <button type="button" className={`${s.iconButton} ${s.lightboxClose}`} aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
          <span className={s.eyebrow}>
            <Dot color={CATEGORY_COLOR[asset.category] ?? '#fff'} />
            {asset.category}
          </span>
          <h2 className={s.inspectorTitle}>{asset.title}</h2>
          <p className={s.inspectorLede}>{asset.description}</p>
          <dl className={s.factsStack}>
            <div className={s.fact}>
              <dt>Status</dt>
              <dd>
                <StatusChip label={asset.status} />
              </dd>
            </div>
            <div className={s.fact}>
              <dt>Type</dt>
              <dd>{asset.type}</dd>
            </div>
            <div className={s.fact}>
              <dt>Owner</dt>
              <dd className={s.factOwner}>
                <Avatar name={ownerOf(asset).name} />
                {ownerOf(asset).name}
              </dd>
            </div>
            <div className={s.fact}>
              <dt>Last updated</dt>
              <dd>{asset.updated}</dd>
            </div>
          </dl>
          <div className={s.lightboxActions}>
            <Button variant="solid" icon={<PencilSimple size={18} aria-hidden />} onClick={onEdit}>
              Edit asset
            </Button>
            <Button icon={<ChatCircleText size={18} aria-hidden />}>Ask Llumen</Button>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  )
}
