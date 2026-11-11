import { useEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, CaretRight, MapTrifold } from '@phosphor-icons/react'
import type { CreatedComponent, ReplySolution } from './assistantReplyTypes'
import { useStoryMapStates } from './story/storyMapStates'
import { StoryReplyChart } from './story/StoryReplyChart'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import styles from './ReplySolutions.module.css'

export type ReplySolutionsProps = {
  solutions: ReplySolution[]
  components: Map<string, CreatedComponent>
  /** The map view the stage goes back to when a solution closes. */
  overviewId: string | null
  /** The chat column; an open solution covers its transcript. Without one, it opens in place of the tabs. */
  panelRef?: RefObject<HTMLElement | null>
}

type Opened = { id: string; panel: HTMLElement | null }

const mapView = (component: CreatedComponent | undefined) =>
  component?.preview?.kind === 'story-map-state' ? component.preview : null

/** Three solution tabs fronted by their maps; opening one shows its detail and switches the map to it. */
export function ReplySolutions({ solutions, components, overviewId, panelRef }: ReplySolutionsProps) {
  const states = useStoryMapStates()
  const [opened, setOpened] = useState<Opened | null>(null)
  const solution = opened ? solutions.find((item) => item.componentId === opened.id) : undefined

  const showMap = (componentId: string | null) => {
    const view = componentId ? mapView(components.get(componentId)) : null
    if (view) states?.restore(view.stateId, view.snapshot)
  }

  const open = (item: ReplySolution) => {
    showMap(item.componentId)
    setOpened((current) => ({ id: item.componentId, panel: current?.panel ?? panelRef?.current ?? null }))
  }

  const close = () => {
    showMap(overviewId)
    setOpened(null)
  }

  const panel = opened?.panel ?? null
  useEffect(() => {
    if (!panel) return
    panel.setAttribute('data-solution-open', 'true')
    return () => panel.removeAttribute('data-solution-open')
  }, [panel])

  const tabs = (
    <div className={styles.tabs}>
      {solutions.map((item) => {
        const view = mapView(components.get(item.componentId))
        const capture = view ? states?.captures[view.stateId] : undefined
        const active = view !== null && states?.activeStateId === view.stateId
        return (
          <button
            key={item.componentId}
            type="button"
            className={`${styles.tab}${active ? ` ${styles.tabActive}` : ''}`}
            onClick={() => open(item)}
            aria-label={`Open the ${item.label.toLowerCase()} solution: ${item.title}`}
          >
            <span className={styles.thumb}>
              {capture ? (
                <img key={capture.image} className={styles.thumbImage} src={capture.image} alt="" />
              ) : (
                <span className={styles.thumbPlaceholder} aria-hidden />
              )}
            </span>
            <span className={styles.tabBody}>
              <span className={styles.tag}>
                <i className={styles.dot} style={{ background: item.color }} aria-hidden />
                {item.label} · {item.span}
              </span>
              <span className={styles.tabTitle}>{item.title}</span>
              <span className={styles.tabMeta}>
                {item.stats
                  .slice(0, 2)
                  .map((stat) => `${stat.label} ${stat.value}`)
                  .join(' · ')}
              </span>
            </span>
            <CaretRight className={styles.tabCaret} size={16} weight="bold" aria-hidden />
          </button>
        )
      })}
    </div>
  )

  if (!solution) return tabs

  const detail = (
    <SolutionDetail
      key={solution.componentId}
      solution={solution}
      solutions={solutions}
      overlay={panel !== null}
      onSelect={open}
      onClose={close}
    />
  )
  return panel ? (
    <>
      {tabs}
      {createPortal(detail, panel)}
    </>
  ) : (
    detail
  )
}

type SolutionDetailProps = {
  solution: ReplySolution
  solutions: ReplySolution[]
  overlay: boolean
  onSelect: (solution: ReplySolution) => void
  onClose: () => void
}

function SolutionDetail({ solution, solutions, overlay, onSelect, onClose }: SolutionDetailProps) {
  const scrollRef = useRevealScrollbarOnScroll()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div ref={overlay ? scrollRef : undefined} className={overlay ? styles.detailOverlay : undefined}>
      <div className={styles.detail}>
        <div className={styles.detailNav}>
          <button type="button" className={styles.back} onClick={onClose}>
            <CaretLeft size={14} weight="bold" aria-hidden />
            All solutions
          </button>
          <div className={styles.switcher} role="tablist" aria-label="Solutions">
            {solutions.map((item) => (
              <button
                key={item.componentId}
                type="button"
                role="tab"
                aria-selected={item.componentId === solution.componentId}
                className={`${styles.switch}${item.componentId === solution.componentId ? ` ${styles.switchActive}` : ''}`}
                onClick={() => onSelect(item)}
              >
                <i className={styles.dot} style={{ background: item.color }} aria-hidden />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <span className={styles.tag}>
          <i className={styles.dot} style={{ background: solution.color }} aria-hidden />
          {solution.label} impact · {solution.span}
        </span>
        <h3 className={styles.title}>{solution.title}</h3>
        <p className={styles.summary}>{solution.summary}</p>

        <div className={`${styles.stats}${solution.stats.length === 4 ? ` ${styles.statsPairs}` : ''}`}>
          {solution.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

        {solution.chart ? (
          <div className={styles.chart}>
            <StoryReplyChart chart={solution.chart} />
          </div>
        ) : null}

        <p className={styles.mapNote}>
          <MapTrifold size={16} weight="regular" aria-hidden />
          {solution.mapNote}
        </p>

        <h4 className={styles.actionsHeading}>Actions</h4>
        <ol className={styles.actions}>
          {solution.actions.map((action) => (
            <li key={action.code ?? action.title} className={styles.action}>
              {action.code ? (
                <span className={styles.code} style={{ color: solution.color, borderColor: solution.color }}>
                  {action.code}
                </span>
              ) : null}
              <div className={styles.actionBody}>
                <span className={styles.actionTitle}>{action.title}</span>
                {action.subtitle ? <span className={styles.actionSubtitle}>{action.subtitle}</span> : null}
                {action.detail ? <span className={styles.actionDetail}>{action.detail}</span> : null}
                {action.metrics?.length ? (
                  <span className={styles.metrics}>
                    {action.metrics.map((metric) => (
                      <span key={metric} className={styles.metric}>
                        {metric}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
