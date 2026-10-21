import {
  ArrowLeft,
  ArrowRight,
  ChartBar,
  DotsThreeVertical,
  Pause,
  Play,
  PresentationChart,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import { AUTOPLAY_MS, tickerSlots, useCarousel } from './carouselMotion'
import home from './LandingHome.module.css'
import styles from './BriefingApps.module.css'

const appsBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/apps`

type BriefingApp = {
  id: string
  kind: 'Dashboard' | 'Slides'
  name: string
  workspace: string
  /** Widgets on a dashboard, slides in a deck. */
  parts: number
  updated: string
  /** Shown under the thumbnail, clamped to two lines. */
  description: string
  /** Figma frame (Llumen EAD) exported to public/llumen-assets/apps. */
  image: string
}

/** Thumbnails only: the apps themselves don't open yet. */
const APPS: BriefingApp[] = [
  {
    id: 'groundwater-monitoring',
    kind: 'Dashboard',
    name: 'Groundwater Monitoring Network',
    workspace: 'Environment',
    parts: 9,
    updated: 'Updated 2 hours ago',
    description:
      'Tracks 450 monitoring wells for water quality, contaminant exceedances and falling groundwater levels, on a live map of abstraction and land use.',
    image: `${appsBase}/app-2.jpg`,
  },
  {
    id: 'policies-regulations',
    kind: 'Dashboard',
    name: 'Policies & Regulations Dashboard',
    workspace: 'Policy',
    parts: 12,
    updated: 'Updated yesterday',
    description:
      'Follows 72 environmental policies from issue to rollout, with compliance by sector, implementation maturity and the outcomes they drive.',
    image: `${appsBase}/app-1.jpg`,
  },
  {
    id: 'mangrove-health',
    kind: 'Dashboard',
    name: 'Mangrove Ecosystem Health Monitoring',
    workspace: 'Environment',
    parts: 7,
    updated: 'Updated 3 days ago',
    description:
      'Monitors 175 km² of mangrove canopy, regeneration and stress hotspots along the coast, so restoration teams can see where to act first.',
    image: `${appsBase}/app-4.jpg`,
  },
  {
    id: 'single-use-plastics',
    kind: 'Dashboard',
    name: 'Single Use Plastics Dashboard',
    workspace: 'Sustainability',
    parts: 16,
    updated: 'Updated last week',
    description:
      'Measures the single-use plastics policy across environmental, social and economic impact, from carbon avoided to public awareness.',
    image: `${appsBase}/app-3.jpg`,
  },
]

/** Apps as insights (Llumen Dubai Municipality, Dashboard 5): what each one shows is happening. */
type AppHighlight = { id: string; title: string; description: string; image: string }

const APP_HIGHLIGHTS: AppHighlight[] = [
  {
    id: 'construction-surge',
    title: 'Construction Surge Driving Multi-System Pressure Dubai South',
    description:
      'Real estate investment is rising due to steady material costs and a higher rate of project approvals.',
    image: `${appsBase}/insight-1.jpg`,
  },
  {
    id: 'rainfall-disruption',
    title: 'Rainfall Event Triggering Service Disruption — Northern Districts',
    description:
      'Northern Districts flooding has disrupted waste and sewage services, requiring urgent municipal intervention.',
    image: `${appsBase}/insight-2.jpg`,
  },
  {
    id: 'tourism-peak',
    title: 'Tourism Peak Increasing Load on Public Facilities — Coastal Areas',
    description:
      'Surging tourism and park footfall have strained maintenance and waste services. Increased service frequency is required to maintain “Customer Happiness” in high-traffic zones.',
    image: `${appsBase}/insight-3.jpg`,
  },
  {
    id: 'permit-concentration',
    title: 'Permit Concentration Driving Spatial Imbalance — Central City vs Peripheral Districts',
    description:
      'A surge in central building permits has pushed density far beyond planned thresholds, straining infrastructure, while peripheral zones remain severely underutilized.',
    image: `${appsBase}/insight-4.jpg`,
  },
]

const APP_ACTIONS = ['Open', 'Share', 'Pin to workspace'] as const

/** Which card's menu is open; a press outside any menu or Escape closes it. */
function useAppMenu() {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  useEffect(() => {
    if (!menuFor) return
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-app-menu]')) return
      setMenuFor(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuFor(null)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuFor])
  return [menuFor, setMenuFor] as const
}

/**
 * Findings style 7's Apps column: what each app shows is happening, as a card with the thumbnail on the
 * left and the copy and menu on the right. The cards share the column's height down to a minimum.
 */
export function BriefingAppHighlights() {
  const revealScrollbar = useRevealScrollbarOnScroll()
  const [menuFor, setMenuFor] = useAppMenu()
  return (
    <ul ref={revealScrollbar} className={`${styles.list} ${styles.highlights}`}>
      {APP_HIGHLIGHTS.map((app, index) => {
        const open = menuFor === app.id
        return (
          <li key={app.id} className={styles.highlight} style={{ ['--i' as string]: index }}>
            <span className={styles.highlightShot}>
              <img src={app.image} alt="" draggable={false} />
            </span>
            <div className={styles.highlightCopy}>
              <div className={styles.highlightHead}>
                <h3 className={styles.highlightTitle}>{app.title}</h3>
                <AppMenu label={app.title} open={open} below onToggle={() => setMenuFor(open ? null : app.id)} />
              </div>
              <p className={styles.highlightDescription}>{app.description}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Findings style 6's Apps panel: one card per app, the thumbnail on top and its copy and menu under it. */
export function BriefingAppsList() {
  const revealScrollbar = useRevealScrollbarOnScroll()
  const [menuFor, setMenuFor] = useAppMenu()

  return (
    <ul ref={revealScrollbar} className={styles.list}>
      {APPS.map((app) => {
        const KindIcon = app.kind === 'Slides' ? PresentationChart : ChartBar
        const open = menuFor === app.id
        return (
          <li key={app.id} className={styles.row} aria-label={`${app.kind}: ${app.name}`}>
            <span className={styles.rowShot}>
              <img src={app.image} alt="" draggable={false} />
            </span>
            <div className={styles.rowCopy}>
              <div className={styles.rowHead}>
                <span className={styles.rowKind}>
                  <KindIcon size={13} weight="regular" aria-hidden />
                  {app.kind} · {app.workspace}
                </span>
                <AppMenu label={app.name} open={open} onToggle={() => setMenuFor(open ? null : app.id)} />
              </div>
              <h3 className={styles.rowName}>{app.name}</h3>
              <p className={styles.rowDescription}>{app.description}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Opens upward over the thumbnail, or `below` when the button sits at the card's top. */
function AppMenu({
  label,
  open,
  below = false,
  onToggle,
}: {
  label: string
  open: boolean
  below?: boolean
  onToggle: () => void
}) {
  return (
    <div className={styles.rowMenuWrap} data-app-menu>
      <button
        type="button"
        className={styles.rowMenuBtn}
        aria-label={`More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <DotsThreeVertical size={18} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className={`${styles.rowMenu}${below ? ` ${styles.rowMenuBelow}` : ''}`} role="menu" aria-label={label}>
          {APP_ACTIONS.map((action) => (
            <button key={action} type="button" role="menuitem" className={styles.rowMenuItem} onClick={onToggle}>
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Autoplays like the Stories carousel, but only while the Apps section is on screen. */
export function BriefingAppsCarousel() {
  const count = APPS.length
  const { active, goTo, trackRef, trackReady, slot } = useCarousel(count)
  const [playing, setPlaying] = useState(true)
  const [inView, setInView] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const running = playing && inView

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.6 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!running || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => goTo(active + 1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, running, goTo])

  return (
    <div ref={rootRef} className={styles.carousel}>
      <div className={`${home.track} ${styles.track}${trackReady ? ` ${home.trackReady}` : ''}`} ref={trackRef}>
        {APPS.map((app, index) => {
          const { layout, expanded, park, offstage, snap } = slot(index)
          const KindIcon = app.kind === 'Slides' ? PresentationChart : ChartBar
          const className = [
            home.card,
            styles.app,
            expanded
              ? `${home.cardExpanded} ${home.cardHero} ${styles.appHero}`
              : `${home.cardCollapsed} ${home.cardPeek}`,
            offstage ? home.cardOff : '',
            snap ? home.cardSnap : '',
            park ? home.cardPark : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <article
              key={app.id}
              className={className}
              style={{ left: layout.left, width: layout.width }}
              aria-label={`${app.kind}: ${app.name}`}
              aria-hidden={offstage}
              onClick={!expanded && !offstage ? () => goTo(index) : undefined}
            >
              <div className={styles.frame}>
                <img className={styles.shot} src={app.image} alt="" draggable={false} />
                <div className={`${styles.blur} ${styles.blurSoft}`} aria-hidden />
                <div className={`${styles.blur} ${styles.blurStrong}`} aria-hidden />
                <div className={styles.scrim} aria-hidden />
                <div className={styles.info}>
                  <span className={styles.kind}>
                    <KindIcon size={14} weight="regular" aria-hidden />
                    {app.kind}
                  </span>
                  <h3 className={styles.name}>{app.name}</h3>
                  <p className={styles.meta}>
                    {app.workspace} · {app.parts} {app.kind === 'Slides' ? 'slides' : 'widgets'} · {app.updated}
                  </p>
                </div>
              </div>
              <p className={styles.description}>{app.description}</p>
            </article>
          )
        })}
      </div>

      <div className={`${home.controls} ${styles.controls}`}>
        <div className={home.progress} role="tablist" aria-label="Apps">
          {tickerSlots(active, count).map(({ index, edge }) => {
            const app = APPS[index]
            const selected = index === active
            return (
              <button
                key={app.id}
                type="button"
                role="tab"
                aria-label={`App ${index + 1}: ${app.name}`}
                aria-selected={selected}
                aria-setsize={count}
                aria-posinset={index + 1}
                className={`${home.dot}${selected ? ` ${home.dotActive}` : ''}${
                  selected && !running ? ` ${home.dotPaused}` : ''
                }${edge ? ` ${home.dotEdge}` : ''}`}
                onClick={() => goTo(index)}
              >
                {selected ? <span className={home.dotFill} onAnimationEnd={() => running && goTo(active + 1)} /> : null}
              </button>
            )
          })}
        </div>
        <div className={home.ctrlGroup}>
          <button type="button" className={home.ctrlBtn} aria-label="Previous" onClick={() => goTo(active - 1)}>
            <ArrowLeft size={20} weight="regular" />
          </button>
          <button
            type="button"
            className={home.ctrlBtn}
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause size={20} weight="regular" /> : <Play size={20} weight="regular" />}
          </button>
          <button type="button" className={home.ctrlBtn} aria-label="Next" onClick={() => goTo(active + 1)}>
            <ArrowRight size={20} weight="regular" />
          </button>
        </div>
      </div>
    </div>
  )
}
