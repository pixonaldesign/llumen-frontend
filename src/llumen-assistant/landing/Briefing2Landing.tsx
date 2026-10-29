import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChatText, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import type { TopBarVariant } from '../prototypeChrome'
import { AssetsSheet, FeedChartCard } from './BriefingLanding'
import { FEED_STOPS } from './briefingFindings'
import { BriefingMap } from './BriefingMap'
import { BRIEFING_PLACES } from './briefingMapPlaces'
import type { LandingTellMeMorePayload } from './LandingHomeDefault'
import { LandingTopBar, type TopBarView } from './LandingTopBar'
import { OverlayScrollThumb } from './OverlayScrollThumb'
import { SpecularActionButton } from './SpecularActionButton'
import home from './LandingHome.module.css'
import feed from './FeedLanding.module.css'
import styles from './Briefing2Landing.module.css'

export type Briefing2LandingProps = {
  topBar: TopBarVariant
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onOpenStory?: (storyId: string) => void
  reserveComposer?: boolean
}

type Vote = 'up' | 'down' | null

/** The Briefing findings as full-screen stops over the map, with My Assets one tab over. */
export function Briefing2Landing({ topBar, onTellMeMore, onOpenStory, reserveComposer = true }: Briefing2LandingProps) {
  const [view, setView] = useState<TopBarView>('briefing')
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const [votes, setVotes] = useState<Record<string, Vote>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const scrollNode = useRef<HTMLDivElement | null>(null)
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

  useLayoutEffect(() => {
    const root = rootRef.current
    const bar = barRef.current
    if (!root || !bar) return
    const apply = () => root.style.setProperty('--briefing-bar-h', `${bar.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

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
    setSeen((current) => (current.has(best) ? current : new Set(current).add(best)))
  }, [])

  const mapPlace = useMemo(() => {
    for (let index = active; index >= 0; index -= 1) {
      const place = FEED_STOPS[index].place
      if (place) return BRIEFING_PLACES[place]
    }
    return BRIEFING_PLACES['abu-dhabi']
  }, [active])

  const vote = (id: string, value: 'up' | 'down') =>
    setVotes((prev) => ({ ...prev, [id]: prev[id] === value ? null : value }))

  const blurred = !FEED_STOPS[active]?.place
  const assets = view === 'assets'

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-view={view}
      style={{ ['--feed-pad' as string]: reserveComposer ? '168px' : '48px' }}
    >
      <header ref={barRef} className={`${home.nav} ${styles.bar}`}>
        <LandingTopBar variant={topBar} workspaceInLogo briefingTab myAssetsTab view={view} onViewChange={setView} />
      </header>
      <div className={styles.briefing} aria-hidden={assets} inert={assets}>
        <div className={`${feed.map}${blurred ? ` ${feed.mapBlur}` : ''}`} aria-hidden>
          <BriefingMap place={mapPlace} blank={blurred} />
        </div>
        <div className={feed.scrim} aria-hidden />
        <div className={feed.scrollFrame}>
          <div className={`${feed.scroll} ${feed.stepped}`} ref={setScrollRef} onScroll={syncActive}>
            {FEED_STOPS.map((stop, index) => {
              const finding = `${stop.before}${stop.highlight}${stop.after}`.trim()
              const current = votes[stop.id] ?? null
              return (
                <section
                  key={stop.id}
                  className={`${feed.stop} ${styles.stop}${index === active ? ` ${feed.stopActive}` : ''}`}
                  data-feed-index={index}
                  aria-label={stop.title}
                >
                  <div className={feed.full}>
                    {stop.chart ? (
                      <div className={feed.stage}>{seen.has(index) ? <FeedChartCard chart={stop.chart} /> : null}</div>
                    ) : null}
                    <div className={`${feed.copy} ${styles.copy}`}>
                      <p className={feed.domain}>{stop.domain}</p>
                      <h2 className={feed.title}>{stop.title}</h2>
                      <p className={home.finding}>
                        {stop.before}
                        <span className={home.findingHighlight}>{stop.highlight}</span>
                        {stop.after}
                      </p>
                      <div className={home.actions}>
                        <SpecularActionButton
                          className={home.actionBtn}
                          enabled={index === active}
                          onClick={() =>
                            onTellMeMore?.({ id: stop.id, title: stop.title, domain: stop.domain, finding })
                          }
                        >
                          <ChatText size={20} weight="regular" aria-hidden />
                          <span>Tell Me More</span>
                        </SpecularActionButton>
                        {stop.storyId ? (
                          <button type="button" className={feed.storyBtn} onClick={() => onOpenStory?.(stop.storyId!)}>
                            View story
                          </button>
                        ) : null}
                        <div className={home.voteGroup}>
                          <button
                            type="button"
                            className={`${home.voteBtn}${current === 'up' ? ` ${feed.voteOn}` : ''}`}
                            aria-label="Helpful"
                            aria-pressed={current === 'up'}
                            onClick={() => vote(stop.id, 'up')}
                          >
                            <ThumbsUp size={18} weight="regular" />
                          </button>
                          <button
                            type="button"
                            className={`${home.voteBtn}${current === 'down' ? ` ${feed.voteOn}` : ''}`}
                            aria-label="Not helpful"
                            aria-pressed={current === 'down'}
                            onClick={() => vote(stop.id, 'down')}
                          >
                            <ThumbsDown size={18} weight="regular" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
          <OverlayScrollThumb scrollEl={scrollEl} label="Briefing position" />
        </div>
      </div>
      {assets ? <AssetsView /> : null}
    </div>
  )
}

/** Mounts with the grid at rest, then plays it on the next frame. */
function AssetsView() {
  const [play, setPlay] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <div className={styles.assetsView}>
      <AssetsSheet open play={play} onOpen={() => {}} />
    </div>
  )
}
