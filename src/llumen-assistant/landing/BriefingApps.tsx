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
import { APP_HIGHLIGHTS, APPS_BASE, useAppMenu } from './briefingAppData'
import { AUTOPLAY_MS, tickerSlots, useCarousel } from './carouselMotion'
import home from './LandingHome.module.css'
import styles from './BriefingApps.module.css'

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
    image: `${APPS_BASE}/app-2.jpg`,
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
    image: `${APPS_BASE}/app-1.jpg`,
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
    image: `${APPS_BASE}/app-4.jpg`,
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
    image: `${APPS_BASE}/app-3.jpg`,
  },
]

const APP_ACTIONS = ['Open', 'Share', 'Pin to workspace'] as const

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

/** Opens upward over the thumbnail, or `below` when the button sits at the card's top. */
export function AppMenu({
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
