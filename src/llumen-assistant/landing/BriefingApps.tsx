import { ArrowLeft, ArrowRight, ChartBar, Pause, Play, PresentationChart } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
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
    image: `${appsBase}/app-2.jpg`,
  },
  {
    id: 'policies-regulations',
    kind: 'Dashboard',
    name: 'Policies & Regulations Dashboard',
    workspace: 'Policy',
    parts: 12,
    updated: 'Updated yesterday',
    image: `${appsBase}/app-1.jpg`,
  },
  {
    id: 'mangrove-health',
    kind: 'Dashboard',
    name: 'Mangrove Ecosystem Health Monitoring',
    workspace: 'Environment',
    parts: 7,
    updated: 'Updated 3 days ago',
    image: `${appsBase}/app-4.jpg`,
  },
  {
    id: 'single-use-plastics',
    kind: 'Dashboard',
    name: 'Single Use Plastics Dashboard',
    workspace: 'Sustainability',
    parts: 16,
    updated: 'Updated last week',
    image: `${appsBase}/app-3.jpg`,
  },
]

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
