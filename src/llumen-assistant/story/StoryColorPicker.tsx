import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from '@phosphor-icons/react'
import { CustomColorPicker } from './StoryCustomColorPicker'
import { SUMMARY_SWATCHES } from './storySummary'
import styles from './StoryEditPanel.module.css'

const POPOVER_WIDTH = 232
const POPOVER_HEIGHT = 140

export function ColorPicker({
  label,
  value,
  variant,
  onChange,
}: {
  label: string
  value: string
  variant: 'swatch' | 'chip'
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [customOpen, setCustomOpen] = useState(false)
  const [recentColor, setRecentColor] = useState<string | undefined>(undefined)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = rect.bottom + 8
    setPosition({
      top:
        below + POPOVER_HEIGHT > window.innerHeight - 8
          ? Math.max(8, rect.top - 8 - POPOVER_HEIGHT)
          : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8)),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onLayout = () => syncPosition()
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, syncPosition])

  const toggle = () => {
    if (open || customOpen) {
      setOpen(false)
      setCustomOpen(false)
      return
    }
    syncPosition()
    setOpen(true)
  }

  const closeCustom = useCallback(() => setCustomOpen(false), [])
  const swatches = SUMMARY_SWATCHES.includes(value) ? SUMMARY_SWATCHES : [...SUMMARY_SWATCHES, value]
  const expanded = open || customOpen

  const swatchStyle = { '--swatch': value } as CSSProperties

  return (
    <>
      {variant === 'swatch' ? (
        <div className={styles.colorSwatchRow}>
          <button
            ref={triggerRef}
            type="button"
            className={`${styles.colorSwatch}${expanded ? ` ${styles.colorSwatchOpen}` : ''}`}
            style={swatchStyle}
            aria-label={`${label}, ${value}`}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            onClick={toggle}
          />
          <span className={styles.colorHex}>{value}</span>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.colorChip}${expanded ? ` ${styles.colorChipOpen}` : ''}`}
          aria-label={`${label}, ${value}`}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          onClick={toggle}
        >
          <span className={styles.colorChipDot} style={swatchStyle} aria-hidden />
          <span className={styles.colorChipLabel}>{label}</span>
          <span className={styles.colorHex}>{value}</span>
        </button>
      )}
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className={styles.colorPopover}
              role="dialog"
              aria-label={label}
              style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
            >
              <div className={styles.colorPopoverGrid}>
                {swatches.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`${styles.colorDot}${swatch === value ? ` ${styles.colorDotSelected}` : ''}`}
                    style={{ '--swatch': swatch } as CSSProperties}
                    aria-label={swatch.toUpperCase()}
                    aria-pressed={swatch === value}
                    onClick={() => onChange(swatch)}
                  />
                ))}
              </div>
              <div className={styles.colorCustomRow}>
                <button
                  type="button"
                  className={styles.colorCustomBtn}
                  onClick={() => {
                    setOpen(false)
                    setCustomOpen(true)
                  }}
                >
                  <Plus size={16} weight="regular" aria-hidden />
                  Add Custom Color
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {customOpen ? (
        <CustomColorPicker
          value={value}
          recentColor={recentColor}
          anchorRef={triggerRef}
          onCancel={closeCustom}
          onApply={(next) => {
            setRecentColor(value)
            onChange(next)
            closeCustom()
          }}
        />
      ) : null}
    </>
  )
}
