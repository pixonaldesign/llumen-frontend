import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AppWindow,
  ArrowRight,
  ArrowsOutSimple,
  CaretLeft,
  CaretRight,
  Cube,
  Lightning,
  Robot,
  Sparkle,
} from '@phosphor-icons/react'
import { STUDIO_APPS, STUDIO_ASSETS, STUDIO_WORKFLOWS, ageMinutes } from './studioData'
import { byRecent, type Go } from './studioAssetMeta'
import { GalleryCard, Lightbox } from './studioExperiences'
import { WorkflowArt } from './studioPages'
import { StatusChip, Tag } from './studioUi'
import view from './StudioView.module.css'
import s from './StudioScenarios.module.css'
import o from './StudioOverview.module.css'

/** One workflow per title: the data repeats the same flows to fill the Workflows grid. */
function distinctWorkflows() {
  const seen = new Set<string>()
  return [...STUDIO_WORKFLOWS]
    .sort((a, b) => ageMinutes(a.updated) - ageMinutes(b.updated))
    .filter((item) => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    })
}

/** Studio UX 9 and 10's home: quick starts, then shelves of recent assets, apps and flows. */
export function OverviewHome({ go, onCreate }: { go: Go; onCreate: () => void }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const recentAssets = [...STUDIO_ASSETS].sort(byRecent)
  const recentApps = [...STUDIO_APPS].sort((a, b) => ageMinutes(a.updated) - ageMinutes(b.updated)).slice(0, 10)
  const recentWorkflows = distinctWorkflows()

  const quick: { icon: ReactNode; title: string; hint: string; onClick: () => void }[] = [
    {
      icon: <Cube size={22} aria-hidden />,
      title: 'Create asset',
      hint: 'A chart, KPI or map from your data',
      onClick: onCreate,
    },
    {
      icon: <AppWindow size={22} aria-hidden />,
      title: 'Create app',
      hint: 'A dashboard, slide deck or command room',
      onClick: () => go('apps'),
    },
    {
      icon: <Sparkle size={22} aria-hidden />,
      title: 'Create flow',
      hint: 'Steps that AI agents run for you',
      onClick: () => go('workflows'),
    },
  ]

  return (
    <div className={o.overview}>
      <header className={o.head}>
        <span className={s.eyebrow}>Overview</span>
        <h1 className={o.title}>Good afternoon, Omar</h1>
      </header>

      <section className={o.section} aria-labelledby="overview-quick">
        <div className={o.sectionHead}>
          <h2 id="overview-quick" className={s.sectionTitle}>
            Quick actions
          </h2>
        </div>
        <div className={o.quick}>
          {quick.map((item) => (
            <button key={item.title} type="button" className={o.quickCard} onClick={item.onClick}>
              <span className={o.quickIcon}>{item.icon}</span>
              <span className={o.quickText}>
                <span className={o.quickTitle}>{item.title}</span>
                <span className={o.quickHint}>{item.hint}</span>
              </span>
              <ArrowRight className={o.quickArrow} size={18} aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <Shelf id="assets" title="Recent assets" link="All assets" onLink={() => go('assets')} width={400}>
        {recentAssets.map((asset, index) => (
          <GalleryCard key={asset.id} className={o.glassCard} asset={asset} delay={index * 80} onOpen={() => setLightbox(index)} />
        ))}
      </Shelf>

      <Shelf id="apps" title="Recent apps" link="All apps" onLink={() => go('apps')} width={340}>
        {recentApps.map((app) => (
          <article key={app.id} className={`${view.storyCard} ${o.appCard}`} aria-label={app.title}>
            <div className={view.storyCover}>
              <img src={app.image} alt="" loading="lazy" />
            </div>
            <div className={o.appBody}>
              <span className={view.appChips}>
                <Tag>{app.kind}</Tag>
                <StatusChip label={app.status} />
              </span>
              <h3 className={`${view.cardTitle} ${view.twoLines}`}>{app.title}</h3>
              <div className={o.cardFoot}>
                <span className={s.muted}>{app.updated}</span>
                <OpenButton label={app.title} onClick={() => go('apps')} />
              </div>
            </div>
          </article>
        ))}
      </Shelf>

      <Shelf id="workflows" title="Recent flows" link="All flows" onLink={() => go('workflows')} width={340}>
        {recentWorkflows.map((item) => (
          <article
            key={item.id}
            className={`${view.workflowCard} ${o.agentCard}`}
            data-running={item.running ? 'true' : undefined}
            aria-label={item.title}
          >
            <WorkflowArt shape={item.shape} />
            <div className={view.workflowBody}>
              {item.running ? (
                <span className={view.running}>
                  <Lightning size={14} aria-hidden />
                  Running now
                </span>
              ) : null}
              <h3 className={view.workflowTitle}>{item.title}</h3>
              <p className={view.workflowText}>{item.description}</p>
              <div className={view.workflowFoot}>
                {item.running ? (
                  <Tag icon={<Robot size={16} aria-hidden />}>{item.running} AI agents</Tag>
                ) : (
                  <span className={view.meta}>{item.updated}</span>
                )}
                <StatusChip label={item.status} />
              </div>
            </div>
          </article>
        ))}
      </Shelf>

      {lightbox !== null ? (
        <Lightbox
          list={recentAssets}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onEdit={onCreate}
        />
      ) : null}
    </div>
  )
}

function OpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={s.openButton} onClick={onClick} aria-label={`Open ${label}`}>
      <ArrowsOutSimple size={16} aria-hidden />
      Open
    </button>
  )
}

/** A row that scrolls sideways, paged by the arrows in its head; they hide when everything fits. */
function Shelf({
  id,
  title,
  link,
  onLink,
  width,
  children,
}: {
  id: string
  title: string
  link: string
  onLink: () => void
  width: number
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  const sync = () => {
    const row = rowRef.current
    if (!row) return
    setEdges({ start: row.scrollLeft < 4, end: row.scrollLeft + row.clientWidth > row.scrollWidth - 4 })
  }
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const observer = new ResizeObserver(() =>
      setEdges({ start: row.scrollLeft < 4, end: row.scrollLeft + row.clientWidth > row.scrollWidth - 4 }),
    )
    observer.observe(row)
    return () => observer.disconnect()
  }, [])
  const page = (direction: number) =>
    rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className={o.section} aria-labelledby={`overview-${id}`}>
      <div className={o.sectionHead}>
        <h2 id={`overview-${id}`} className={s.sectionTitle}>
          {title}
        </h2>
        <div className={o.shelfTools}>
          <button type="button" className={s.linkButton} onClick={onLink}>
            {link}
            <ArrowRight size={14} aria-hidden />
          </button>
          {edges.start && edges.end ? null : (
            <>
              <button type="button" className={`${s.iconButton} ${o.pageButton}`} aria-label={`Previous ${title.toLowerCase()}`} disabled={edges.start} onClick={() => page(-1)}>
                <CaretLeft size={16} aria-hidden />
              </button>
              <button type="button" className={`${s.iconButton} ${o.pageButton}`} aria-label={`Next ${title.toLowerCase()}`} disabled={edges.end} onClick={() => page(1)}>
                <CaretRight size={16} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <div ref={rowRef} className={o.shelfRow} style={{ '--card-w': `${width}px` } as CSSProperties} onScroll={sync}>
        {children}
      </div>
    </section>
  )
}