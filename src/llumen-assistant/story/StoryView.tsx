/**
 * Landing Story content type — Figma slide-landing-screen-map (3359:3802).
 * Full-page main content (not agent subcontext). Map from llumen-map-legend layers.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CalendarBlank,
  CaretDown,
  Eye,
  GenderIntersex,
  Info,
  MapPin,
  PencilSimple,
  Student,
  SquaresFour,
  X,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { getLandingStory, type LandingStory } from './storyDemoData'
import { StoryMap, type StoryMapLayerVisibility } from './StoryMap'
import styles from './StoryView.module.css'

export type StoryViewProps = {
  storyId: string
  onBack: () => void
  /** Opens left agent rail with current story/slide context. */
  onAsk?: (context: { story: LandingStory; slideIndex: number; sourceRect: DOMRect }) => void
  /** When the agent rail is open, hide the Ask icon. */
  agentOpen?: boolean
  /** Red dot when findings were dismissed before every entry was seen. */
  findingUnread?: boolean
  /** Reopens findings that were dismissed before every entry was seen. */
  onRestoreFindings?: (sourceRect: DOMRect) => void
  /** Prototype control slot in the top-right header. */
  headerEnd?: ReactNode
}

function Chem({ name }: { name: string }) {
  const match = name.match(/^([A-Za-z]+)(\d+(?:\.\d+)?)$/)
  if (!match) return <>{name}</>
  return (
    <>
      {match[1]}
      <sub>{match[2]}</sub>
    </>
  )
}

function filterIcon(id: string) {
  switch (id) {
    case 'loc':
      return <MapPin size={18} weight="regular" aria-hidden />
    case 'year':
      return <CalendarBlank size={18} weight="regular" aria-hidden />
    case 'ssi':
      return <SquaresFour size={18} weight="regular" aria-hidden />
    case 'type':
      return <Buildings size={18} weight="regular" aria-hidden />
    case 'gender':
      return <GenderIntersex size={18} weight="regular" aria-hidden />
    case 'level':
      return <Student size={18} weight="regular" aria-hidden />
    default:
      return <SquaresFour size={18} weight="regular" aria-hidden />
  }
}

export function StoryView({
  storyId,
  onBack,
  onAsk,
  agentOpen = false,
  findingUnread = false,
  onRestoreFindings,
  headerEnd,
}: StoryViewProps) {
  const story = useMemo(() => getLandingStory(storyId), [storyId])
  const [slideIndex, setSlideIndex] = useState(0)
  const [legendOpen, setLegendOpen] = useState(true)
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view')
  const [layers, setLayers] = useState<StoryMapLayerVisibility>({
    utilization: true,
    vehiclesActive: true,
    vehiclesIdling: true,
  })

  const slide = story.slides[Math.min(slideIndex, story.slides.length - 1)]
  const canPrev = slideIndex > 0
  const canNext = slideIndex < story.slides.length - 1
  const aqiPct = Math.min(100, Math.max(0, (slide.aqi / 500) * 100))

  return (
    <div className={styles.root} aria-label={`${story.storyTitle} story`}>
      <StoryMap className={styles.map} layers={layers} />

      <div className={styles.overlay}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to home">
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div className={styles.titleGroup}>
              <h1 className={styles.storyTitle}>{story.storyTitle}</h1>
              <Info size={18} weight="regular" className={styles.infoIcon} aria-hidden />
            </div>
            {headerEnd ? <div className={styles.headerEnd}>{headerEnd}</div> : null}
          </div>
          <div className={styles.filters}>
            {story.filters.map((f) => (
              <span
                key={f.id}
                className={`${styles.filterPill}${f.removable ? ` ${styles.filterPillActive}` : ''}`}
              >
                {filterIcon(f.id)}
                <span>{f.label}</span>
                {f.removable ? (
                  <span className={styles.filterClear} aria-hidden>
                    <X size={10} weight="bold" />
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div className={styles.body}>
          <aside className={styles.insight} aria-label="Story insight">
            <div className={styles.insightCopy}>
              <h2 className={styles.slideHeading}>{slide.title}</h2>
              <p className={styles.finding}>{slide.finding}</p>
              <p className={styles.bodyCopy}>{slide.body}</p>
            </div>

            <section className={styles.aqiCard}>
              <p className={styles.aqiLabel}>Air Quality Index</p>
              <p className={styles.aqiValue}>{slide.aqi}</p>
              <div className={styles.aqiBar} aria-hidden>
                <span className={styles.aqiThumb} style={{ left: `${aqiPct}%` }} />
              </div>
              <span className={styles.statusPillUnhealthy}>{slide.aqiLabel}</span>
            </section>

            <section className={styles.pollutants}>
              <p className={styles.pollutantsTitle}>Pollutants</p>
              <div className={styles.pollutantGrid}>
                {slide.pollutants.map((p) => (
                  <div key={p.name} className={styles.pollutant}>
                    <p className={styles.pollutantName}>
                      <Chem name={p.name} />
                    </p>
                    <div className={styles.pollutantValue}>
                      <strong>{p.value}</strong>
                      <span>
                        {p.unit.includes('/') ? (
                          <>
                            {p.unit.split('/')[0]}
                            <br />/{p.unit.split('/')[1]}
                          </>
                        ) : (
                          p.unit
                        )}
                      </span>
                    </div>
                    <span
                      className={
                        p.status === 'critical' ? styles.statusPillCritical : styles.statusPillNormal
                      }
                    >
                      {p.status === 'critical' ? 'Critical' : 'Normal'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className={styles.mapData}>
          <button
            type="button"
            className={styles.mapDataHeader}
            onClick={() => setLegendOpen((o) => !o)}
            aria-expanded={legendOpen}
          >
            <span>Map Data</span>
            <CaretDown
              size={16}
              weight="bold"
              className={legendOpen ? styles.caretOpen : undefined}
              aria-hidden
            />
          </button>
          {legendOpen ? (
            <div className={styles.mapDataBody}>
              <p className={styles.legendSection}>Vehicles Status (Live)</p>
              <div className={styles.legendRow}>
                <span className={styles.legendMark}>
                  <img src={`${iconPath('diamond-active')}`} alt="" width={12} height={12} />
                  Active
                </span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.vehiclesActive}
                  onClick={() => setLayers((l) => ({ ...l, vehiclesActive: !l.vehiclesActive }))}
                >
                  <Eye size={16} weight={layers.vehiclesActive ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendMark}>
                  <img src={`${iconPath('diamond-idling')}`} alt="" width={12} height={12} />
                  Idling
                </span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.vehiclesIdling}
                  onClick={() => setLayers((l) => ({ ...l, vehiclesIdling: !l.vehiclesIdling }))}
                >
                  <Eye size={16} weight={layers.vehiclesIdling ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendRow}>
                <span>Utilization Overlay</span>
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-pressed={layers.utilization}
                  onClick={() => setLayers((l) => ({ ...l, utilization: !l.utilization }))}
                >
                  <Eye size={16} weight={layers.utilization ? 'fill' : 'regular'} aria-hidden />
                </button>
              </div>
              <div className={styles.legendScale}>
                <span>Low</span>
                <span className={styles.gradientBar} aria-hidden />
                <span>High</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.lowerNav} aria-label="Story navigation">
          {!agentOpen && onAsk ? (
            <button
              type="button"
              className={styles.askBtn}
              aria-label="Ask about this story"
              onClick={(event) => {
                const sourceRect = event.currentTarget.getBoundingClientRect()
                if (findingUnread && onRestoreFindings) {
                  onRestoreFindings(sourceRect)
                  return
                }
                onAsk({ story, slideIndex, sourceRect })
              }}
            >
              <img className={styles.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
              {findingUnread ? <span className={styles.unreadDot} /> : null}
            </button>
          ) : null}

          <div className={styles.navCluster}>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Previous slide"
              disabled={!canPrev}
              onClick={() => canPrev && setSlideIndex((i) => i - 1)}
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <span className={styles.navCount}>
              {slideIndex + 1}/{story.slides.length}
            </span>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Next slide"
              disabled={!canNext}
              onClick={() => canNext && setSlideIndex((i) => i + 1)}
            >
              <ArrowRight size={20} weight="regular" aria-hidden />
            </button>
          </div>

          <div className={styles.navMode}>
            <button
              type="button"
              className={`${styles.modeBtn}${viewMode === 'edit' ? ` ${styles.modeBtnActive}` : ''}`}
              aria-label="Edit mode"
              aria-pressed={viewMode === 'edit'}
              onClick={() => setViewMode('edit')}
            >
              <PencilSimple size={20} weight="regular" aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.modeBtn}${viewMode === 'view' ? ` ${styles.modeBtnActive}` : ''}`}
              aria-label="View mode"
              aria-pressed={viewMode === 'view'}
              onClick={() => setViewMode('view')}
            >
              <Eye size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function iconPath(name: 'diamond-active' | 'diamond-idling') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/llumen-assets/map-icons/${name}.svg`
}
