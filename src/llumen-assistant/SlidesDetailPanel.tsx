import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  ChatTeardropText,
  Eye,
  HouseSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NavigationArrow,
  PencilSimple,
  SidebarSimple,
} from '@phosphor-icons/react'
import type { CreatedComponent, ReportPayload } from './assistantReplyTypes'
import { KpiWidget } from './KpiWidgets'
import styles from './SlidesDetailPanel.module.css'

export type SlidesDetailPanelProps = {
  report: ReportPayload
  components: CreatedComponent[]
  activeSlide: number
  onSlideChange: (index: number) => void
  onClose: () => void
  onShowInConversation?: () => void
  onHome?: () => void
}

export function SlidesDetailPanel({
  report,
  components,
  activeSlide,
  onSlideChange,
  onClose,
  onShowInConversation,
  onHome,
}: SlidesDetailPanelProps) {
  const [mapZoom, setMapZoom] = useState(1)
  const [legendOpen, setLegendOpen] = useState(true)
  const [layers, setLayers] = useState({ demand: true, waste: true })
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view')

  const slide = report.slides[Math.min(activeSlide, report.slides.length - 1)]
  const visual = useMemo(() => {
    if (!slide?.visualComponentId) return null
    return components.find((c) => c.id === slide.visualComponentId) ?? null
  }, [components, slide])

  const isMapSlide = visual?.preview?.kind === 'image' && visual.preview.detailView === 'map'
  const canPrev = activeSlide > 0
  const canNext = activeSlide < report.slides.length - 1

  return (
    <aside className={styles.root} aria-label={`${report.title} slides`}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Collapse preview">
          <SidebarSimple size={20} weight="regular" aria-hidden />
        </button>
        <h2 className={styles.slideTitle}>{slide?.title ?? report.title}</h2>
        <div className={styles.topBarActions}>
          {onShowInConversation ? (
            <button
              type="button"
              className={styles.showInConversationBtn}
              onClick={onShowInConversation}
            >
              <ChatTeardropText size={20} weight="regular" aria-hidden />
              <span>Show in Conversation</span>
            </button>
          ) : null}
          <span className={styles.slideCount}>
            {activeSlide + 1} / {report.slides.length}
          </span>
        </div>
      </div>

      <div className={styles.stage}>
        <div
          className={styles.canvas}
          style={isMapSlide ? { transform: `scale(${mapZoom})` } : undefined}
        >
          {isMapSlide && visual?.preview?.kind === 'image' ? (
            <img
              className={styles.mapImage}
              src={visual.preview.detailSrc ?? visual.preview.src}
              alt={visual.preview.alt ?? visual.title}
            />
          ) : visual?.preview?.kind === 'widget' ? (
            <div className={styles.widgetStage}>
              <KpiWidget component={visual} />
            </div>
          ) : null}

          <div className={styles.slideCopy}>
            {slide?.finding ? <p className={styles.finding}>{slide.finding}</p> : null}
            {slide?.body?.length ? (
              <ul className={styles.bullets}>
                {slide.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {slide?.confidenceLabel ? <p className={styles.confidence}>{slide.confidenceLabel}</p> : null}
          </div>
        </div>

        {isMapSlide ? (
          <>
            <div className={styles.mapControls} aria-label="Map controls">
              <button type="button" className={styles.mapCtrlBtn} aria-label="Recenter map">
                <NavigationArrow size={18} weight="regular" aria-hidden />
              </button>
              <button
                type="button"
                className={styles.mapCtrlBtn}
                aria-label="Zoom in"
                onClick={() => setMapZoom((z) => Math.min(1.6, z + 0.15))}
              >
                <MagnifyingGlassPlus size={18} weight="regular" aria-hidden />
              </button>
              <button
                type="button"
                className={styles.mapCtrlBtn}
                aria-label="Zoom out"
                onClick={() => setMapZoom((z) => Math.max(0.85, z - 0.15))}
              >
                <MagnifyingGlassMinus size={18} weight="regular" aria-hidden />
              </button>
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
                  <div className={styles.legendRow}>
                    <span>Station intensity</span>
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      aria-pressed={layers.demand}
                      onClick={() => setLayers((l) => ({ ...l, demand: !l.demand }))}
                    >
                      <Eye size={16} weight={layers.demand ? 'fill' : 'regular'} aria-hidden />
                    </button>
                  </div>
                  <div className={styles.legendScale}>
                    <span>Low</span>
                    <span className={styles.pillars} aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>High</span>
                  </div>
                  <div className={styles.legendRow}>
                    <span>Pollutant plume</span>
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      aria-pressed={layers.waste}
                      onClick={() => setLayers((l) => ({ ...l, waste: !l.waste }))}
                    >
                      <Eye size={16} weight={layers.waste ? 'fill' : 'regular'} aria-hidden />
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
          </>
        ) : null}
      </div>

      <div className={styles.lowerNav} aria-label="Slide navigation">
        <button
          type="button"
          className={styles.navChip}
          aria-label="Home"
          onClick={() => {
            onHome?.()
            onSlideChange(0)
          }}
        >
          <HouseSimple size={20} weight="regular" aria-hidden />
        </button>

        <div className={styles.navCenter}>
          <button
            type="button"
            className={`${styles.navTextBtn}${canPrev ? '' : ` ${styles.navTextDisabled}`}`}
            disabled={!canPrev}
            onClick={() => canPrev && onSlideChange(activeSlide - 1)}
          >
            <ArrowLeft size={20} weight="regular" aria-hidden />
            Previous brief
          </button>
          <button
            type="button"
            className={`${styles.navTextBtn}${canNext ? '' : ` ${styles.navTextDisabled}`}`}
            disabled={!canNext}
            onClick={() => canNext && onSlideChange(activeSlide + 1)}
          >
            Next brief
            <ArrowRight size={20} weight="regular" aria-hidden />
          </button>
        </div>

        <div className={styles.navActions}>
          <button
            type="button"
            className={`${styles.navActionBtn}${viewMode === 'edit' ? ` ${styles.navActionActive}` : ''}`}
            aria-label="Edit mode"
            aria-pressed={viewMode === 'edit'}
            onClick={() => setViewMode('edit')}
          >
            <PencilSimple size={20} weight="regular" aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.navActionBtn}${viewMode === 'view' ? ` ${styles.navActionActive}` : ''}`}
            aria-label="View mode"
            aria-pressed={viewMode === 'view'}
            onClick={() => setViewMode('view')}
          >
            <Eye size={20} weight="regular" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  )
}
