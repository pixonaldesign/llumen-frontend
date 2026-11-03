/**
 * A GAMI app (story): two pages over the GAMI map, laid out like the landing stories. Page 1 frames the
 * insight; page 2 flies in, outlines one area and reads the insight cards for it.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Eye,
  EyeSlash,
  Funnel,
  Info,
  List,
  MapPin,
  PencilSimple,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { STORY_CAMERA_PADDING, type StoryMapView } from '../story/StoryMap'
import styles from '../story/StoryView.module.css'
import { GamiCardView } from './GamiCharts'
import { GamiMap, type GamiMapHandle } from './GamiMap'
import { GamiPartModal } from './GamiPartModal'
import { GAMI_STORIES } from './gamiScenario'
import type { LegendMark, MapDataLayer, PartId } from './gamiTypes'
import css from './GamiStory.module.css'

export type GamiAskContext = { storyId: string; title: string; pageTitle: string; sourceRect: DOMRect }

type Props = {
  storyId: string
  onBack: (from?: StoryMapView) => void
  onAsk?: (context: GamiAskContext) => void
  agentOpen?: boolean
  onCloseAsk?: () => void
  entrance?: 'wait' | 'play' | 'leave' | 'gone'
  mapHidden?: boolean
  onMapReady?: (stage: 'loaded' | 'painted') => void
  onSlideIndexChange?: (index: number) => void
}

const NO_GROUPS: ReadonlySet<string> = new Set()
const FILTER_ICONS = [MapPin, CalendarBlank, Funnel]

function LegendGlyph({ mark, color }: { mark: LegendMark; color: string }) {
  return <i className={css.glyph} data-mark={mark} style={{ '--mark': color } as CSSProperties} aria-hidden />
}

export function GamiStoryView({
  storyId,
  onBack,
  onAsk,
  agentOpen,
  onCloseAsk,
  entrance,
  mapHidden,
  onMapReady,
  onSlideIndexChange,
}: Props) {
  const story = GAMI_STORIES[storyId]
  const [pageIndex, setPageIndex] = useState(0)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(NO_GROUPS)
  const [legendOpen, setLegendOpen] = useState(true)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_GROUPS)
  const [info, setInfo] = useState<{ kind: 'story' | 'page'; left: number; top: number } | null>(null)
  const [part, setPart] = useState<PartId | null>(null)
  const mapRef = useRef<GamiMapHandle>(null)
  const titleGroupRef = useRef<HTMLDivElement>(null)
  const page = story.pages[pageIndex]

  useEffect(() => {
    onSlideIndexChange?.(pageIndex)
  }, [onSlideIndexChange, pageIndex])

  useEffect(() => {
    if (!info) return
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('[data-gami-info]')) setInfo(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [info])

  const goTo = (index: number) => {
    setPageIndex(index)
    setInfo(null)
  }

  const toggleInfo = (kind: 'story' | 'page', button: HTMLElement) => {
    const group = titleGroupRef.current
    if (info?.kind === kind || !group) {
      setInfo(null)
      return
    }
    const bounds = group.getBoundingClientRect()
    const icon = button.getBoundingClientRect()
    setInfo({ kind, left: icon.left - 8 - bounds.left, top: icon.bottom - bounds.top + 6 })
  }

  const toggleGroup = (group: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  const toggleCollapsed = (group: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  const layerBody = (layer: MapDataLayer): ReactNode => (
    <div className={styles.mapLayerAttrs}>
      {layer.ramp ? (
        <div className={styles.legendScale}>
          <span>{layer.ramp.low}</span>
          <span
            className={styles.colorRamp}
            style={{ backgroundImage: `linear-gradient(to right, ${layer.ramp.colors.join(', ')})` }}
            aria-hidden
          />
          <span>{layer.ramp.high}</span>
        </div>
      ) : null}
      {layer.items.map((item) => (
        <div key={item.label} className={styles.legendRow}>
          <span className={`${styles.legendMark} ${css.legendLabel}`}>
            <LegendGlyph mark={item.mark} color={item.color} />
            <span>{item.label}</span>
          </span>
          {item.count ? <span className={styles.legendCount}>{item.count}</span> : null}
        </div>
      ))}
    </div>
  )

  const askButton = onAsk ? (
    <button
      type="button"
      className={styles.askBtn}
      aria-label={agentOpen ? 'Close the assistant' : 'Ask about this story'}
      aria-expanded={agentOpen}
      onClick={(event) => {
        if (agentOpen) {
          onCloseAsk?.()
          return
        }
        onAsk({ storyId, title: story.title, pageTitle: page.title, sourceRect: event.currentTarget.getBoundingClientRect() })
      }}
    >
      <img className={styles.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
    </button>
  ) : null

  return (
    <div
      className={styles.root}
      aria-label={`${story.title} story`}
      data-entrance={entrance}
      data-map-hidden={mapHidden || undefined}
      inert={entrance === 'leave' || entrance === 'gone'}
    >
      <div className={styles.mapPane}>
        <GamiMap
          camera={page.camera}
          scene={page.scene}
          areas={page.polygons}
          hidden={hidden}
          padding={STORY_CAMERA_PADDING}
          onReady={onMapReady}
          handleRef={mapRef}
        />
      </div>

      <div className={styles.overlay}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => onBack(mapRef.current?.view())}
              aria-label="Back to home"
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div ref={titleGroupRef} className={styles.titleGroup}>
              <div className={styles.storyTitleRow}>
                <h1 className={styles.storyTitle}>{story.title}</h1>
                <button
                  type="button"
                  className={`${styles.infoBtn} ${styles.infoBtnSmall}`}
                  aria-label="Show story description"
                  aria-expanded={info?.kind === 'story'}
                  data-gami-info
                  onClick={(event) => toggleInfo('story', event.currentTarget)}
                >
                  <Info size={22} weight="regular" aria-hidden />
                </button>
              </div>
              <nav className={styles.pages} aria-label="Story pages">
                {story.pages.map((item, index) => (
                  <span
                    key={item.id}
                    className={`${styles.pagePill}${index === pageIndex ? ` ${styles.pagePillActive}` : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.pageSelect}
                      aria-current={index === pageIndex ? 'page' : undefined}
                      onClick={() => goTo(index)}
                    >
                      {item.title}
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className={styles.infoBtn}
                  aria-label="Show page description"
                  aria-expanded={info?.kind === 'page'}
                  data-gami-info
                  onClick={(event) => toggleInfo('page', event.currentTarget)}
                >
                  <Info size={22} weight="regular" aria-hidden />
                </button>
              </nav>
              {info ? (
                <div className={styles.infoPopover} style={{ left: info.left, top: info.top }} role="tooltip" data-gami-info>
                  {info.kind === 'story' ? story.description : page.finding}
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.paneBar}>
            <div className={styles.filters}>
              {page.filters.map((label, index) => {
                const Icon = FILTER_ICONS[index] ?? Funnel
                return (
                  <span key={label} className={styles.filterPill}>
                    <Icon size={16} weight="regular" aria-hidden />
                    <span>{label}</span>
                  </span>
                )
              })}
            </div>
          </div>
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div className={styles.body}>
          <aside key={page.id} className={`${styles.insight} ${css.insight}`} aria-label="Story insight">
            {page.cards.map((card) => (
              <GamiCardView key={card.id} card={card} onPartInfo={setPart} />
            ))}
          </aside>
        </div>

        <div className={styles.mapStack}>
          <div className={styles.mapData}>
            <button
              type="button"
              className={styles.mapDataHeader}
              onClick={() => setLegendOpen((open) => !open)}
              aria-expanded={legendOpen}
            >
              <span>Map Data</span>
              <CaretDown size={18} weight="regular" className={legendOpen ? undefined : styles.caretClosed} aria-hidden />
            </button>
            {legendOpen ? (
              <div className={`${styles.mapLayers} ${css.mapLayers}`}>
                {page.layers.map((layer) => {
                  const off = hidden.has(layer.group)
                  const shut = collapsed.has(layer.group)
                  return (
                    <section key={layer.group} className={styles.mapLayer}>
                      <div className={styles.mapLayerHead}>
                        <button
                          type="button"
                          className={css.layerToggle}
                          aria-expanded={!shut}
                          onClick={() => toggleCollapsed(layer.group)}
                        >
                          <CaretDown size={14} weight="bold" className={shut ? css.caretShut : undefined} aria-hidden />
                          <p className={styles.mapLayerTitle}>{layer.title.replace(/\s+GAMI$/, '')}</p>
                        </button>
                        <span className={styles.legendActions}>
                          <button
                            type="button"
                            className={`${styles.legendIconBtn}${off ? ` ${styles.legendIconOff}` : ''}`}
                            aria-label={`Toggle ${layer.title}`}
                            aria-pressed={!off}
                            onClick={() => toggleGroup(layer.group)}
                          >
                            {off ? <EyeSlash size={16} weight="regular" aria-hidden /> : <Eye size={16} weight="regular" aria-hidden />}
                          </button>
                        </span>
                      </div>
                      {shut ? null : layerBody(layer)}
                    </section>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.lowerNav} aria-label="Story navigation">
          {askButton}
          <div className={styles.navCluster}>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Previous page"
              disabled={pageIndex === 0}
              onClick={() => goTo(pageIndex - 1)}
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <span className={styles.navCount}>
              <List size={16} weight="regular" aria-hidden />
              {pageIndex + 1}/{story.pages.length}
            </span>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Next page"
              disabled={pageIndex === story.pages.length - 1}
              onClick={() => goTo(pageIndex + 1)}
            >
              <ArrowRight size={20} weight="regular" aria-hidden />
            </button>
          </div>
          <div className={styles.modeSwitch} role="group" aria-label="Story mode">
            <button type="button" className={`${styles.modeBtn} ${styles.modeBtnActive}`} aria-label="View mode" aria-pressed>
              <Eye size={20} weight="regular" aria-hidden />
            </button>
            <button type="button" className={styles.modeBtn} aria-label="Edit mode" aria-pressed={false} disabled>
              <PencilSimple size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {part ? (
        <GamiPartModal
          part={part}
          onClose={() => setPart(null)}
          onBridge={
            storyId === 'gami-alert'
              ? () => {
                  setPart(null)
                  goTo(1)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
