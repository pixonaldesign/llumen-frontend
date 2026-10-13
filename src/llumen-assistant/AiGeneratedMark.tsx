import { useId, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Sparkle } from '@phosphor-icons/react'
import styles from './AiGeneratedMark.module.css'

const TOOLTIP_OFFSET = 14
const TOOLTIP_LABEL = 'Asset is AI generated'

export function AiGeneratedMark({
  className,
  size = 20,
}: {
  className?: string
  size?: number
}) {
  const tooltipId = useId()
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const onMove = (event: MouseEvent<HTMLSpanElement>) => {
    const pad = 12
    const approxWidth = 220
    const approxHeight = 40
    const x = Math.min(event.clientX + TOOLTIP_OFFSET, window.innerWidth - approxWidth - pad)
    const y = Math.min(event.clientY + TOOLTIP_OFFSET, window.innerHeight - approxHeight - pad)
    setTooltipPos({
      x: Math.max(pad, x),
      y: Math.max(pad, y),
    })
  }

  return (
    <>
      <span
        className={[styles.mark, className].filter(Boolean).join(' ')}
        onMouseEnter={onMove}
        onMouseMove={onMove}
        onMouseLeave={() => setTooltipPos(null)}
        aria-label={TOOLTIP_LABEL}
        aria-describedby={tooltipPos ? tooltipId : undefined}
      >
        <Sparkle size={size} weight="fill" aria-hidden />
      </span>
      {tooltipPos
        ? createPortal(
            <div
              id={tooltipId}
              className={styles.tooltip}
              role="tooltip"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <p className={styles.tooltipText}>{TOOLTIP_LABEL}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
