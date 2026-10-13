import { useId, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { AiGeneratedBadge } from './AiGeneratedBadge'
import type { CreatedComponent } from './assistantReplyTypes'
import { InteractiveMap } from './InteractiveMap'
import { KpiWidget } from './KpiWidgets'
import styles from './InlineVisualCard.module.css'

export type InlineVisualCardProps = {
  component: CreatedComponent
  caption?: string
  active?: boolean
  onExpand?: () => void
}

const TOOLTIP_OFFSET = 14
const EXAMPLE_TOOLTIP = 'example interaction tooltip'

function isMapThumbnail(component: CreatedComponent) {
  return component.preview?.kind === 'image' && component.preview.detailView === 'map'
}

export function InlineVisualCard({ component, active = false, onExpand }: InlineVisualCardProps) {
  const isSquare = component.inlineSize === 'square'
  const isMap = isMapThumbnail(component)
  const preview = component.preview
  const isFixedWidthWidget =
    preview?.kind === 'widget' &&
    ['aqi', 'pollutants', 'population', 'land-use'].includes(preview.variant)
  const isWindChart = preview?.kind === 'widget' && preview.variant === 'wind'
  const showTooltip = !isMap
  const tooltipId = useId()
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const onExpandTooltipMove = (event: MouseEvent<HTMLButtonElement>) => {
    if (!showTooltip) return
    const pad = 12
    const approxWidth = 280
    const approxHeight = 48
    const x = Math.min(event.clientX + TOOLTIP_OFFSET, window.innerWidth - approxWidth - pad)
    const y = Math.min(event.clientY + TOOLTIP_OFFSET, window.innerHeight - approxHeight - pad)
    setTooltipPos({
      x: Math.max(pad, x),
      y: Math.max(pad, y),
    })
  }

  const onExpandTooltipLeave = () => setTooltipPos(null)

  return (
    <div
      className={[
        styles.wrap,
        isFixedWidthWidget ? styles.wrapFixedWidget : '',
        isWindChart ? styles.wrapWindChart : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-component-id={component.id}
    >
      <div
        className={[
          styles.card,
          isSquare ? styles.cardSquare : styles.cardFull,
          isWindChart ? styles.cardWindChart : '',
          active && !isMap ? styles.cardActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.cardTop}>
          {preview?.kind === 'widget' ? (
            <KpiWidget component={component} compact={isSquare} />
          ) : preview?.kind === 'image' ? (
            <div className={isMap ? styles.mapImageStage : styles.imageStage}>
              {isMap ? (
                <InteractiveMap
                  className={styles.mapInteractive}
                  controlsClassName={styles.mapControls}
                  scrollZoom={false}
                />
              ) : (
                <img
                  className={preview.fit === 'cover' ? styles.imageCover : styles.imageContain}
                  src={preview.src}
                  alt={preview.alt ?? component.title}
                />
              )}
              <div className={styles.imageHeader}>
                <div className={styles.imageTitleRow}>
                  <p className={styles.imageTitle}>{component.title}</p>
                  {component.aiGenerated ? <AiGeneratedBadge /> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.fallback}>
              <div className={styles.imageTitleRow}>
                <p className={styles.imageTitle}>{component.title}</p>
                {component.aiGenerated ? <AiGeneratedBadge /> : null}
              </div>
            </div>
          )}
          {onExpand ? (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={onExpand}
              onMouseEnter={onExpandTooltipMove}
              onMouseMove={onExpandTooltipMove}
              onMouseLeave={onExpandTooltipLeave}
              aria-label={`Open ${component.title}`}
              aria-describedby={showTooltip && tooltipPos ? tooltipId : undefined}
            >
              <ArrowSquareOut size={20} weight="regular" aria-hidden />
            </button>
          ) : null}
          {onExpand && !isMap ? (
            <button
              type="button"
              className={styles.hitArea}
              onClick={onExpand}
              onMouseEnter={onExpandTooltipMove}
              onMouseMove={onExpandTooltipMove}
              onMouseLeave={onExpandTooltipLeave}
              aria-label={`Open ${component.title}`}
              aria-describedby={showTooltip && tooltipPos ? tooltipId : undefined}
            >
              <span className={styles.srOnly}>Open {component.title}</span>
            </button>
          ) : null}
        </div>
      </div>
      {showTooltip && tooltipPos
        ? createPortal(
            <div
              id={tooltipId}
              className={styles.tooltip}
              role="tooltip"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y,
              }}
            >
              <p className={styles.tooltipText}>{EXAMPLE_TOOLTIP}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
