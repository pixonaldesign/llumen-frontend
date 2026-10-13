import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  COLOR_FORMATS,
  clampNumber,
  hexToRgb,
  hslToHex,
  hsvToHex,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  validHex,
  type ColorFormat,
  type HsvColor,
} from './colorMath'
import styles from './StoryCustomColorPicker.module.css'

const POPOVER_WIDTH = 240
const POPOVER_HEIGHT = 420
const GAP = 8

function hsvFromHex(hex: string): HsvColor {
  return rgbToHsv(...hexToRgb(hex))
}

/** Llumen asset builder color controls: SV field, hue, HEX/RGB/HSL entry. Reports every change. */
export function ColorPickerControls({
  value,
  recentColor,
  onChange,
}: {
  value: string
  recentColor?: string
  onChange: (color: string) => void
}) {
  const [hsv, setHsv] = useState<HsvColor>(() => hsvFromHex(validHex(value) ?? '#000000'))
  const [syncedValue, setSyncedValue] = useState(value)
  const [format, setFormat] = useState<ColorFormat>('HEX')
  const [hexDraft, setHexDraft] = useState<string | null>(null)

  const draft = hsvToHex(hsv)
  const [r, g, b] = hexToRgb(draft)
  const hsl = rgbToHsl(r, g, b)

  const keepHue = (current: HsvColor, next: HsvColor) =>
    next.s === 0 || next.v === 0 ? { ...next, h: current.h } : next

  if (value !== syncedValue) {
    setSyncedValue(value)
    const parsed = validHex(value)
    if (parsed && parsed !== draft) setHsv((current) => keepHue(current, hsvFromHex(parsed)))
  }

  const commit = (next: HsvColor) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setSyncedValue(hex)
    onChange(hex)
  }
  const setFromHex = (hex: string) => commit(keepHue(hsv, hsvFromHex(hex)))

  const setSvFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    commit({
      h: hsv.h,
      s: clampNumber((event.clientX - rect.left) / rect.width, 0, 1),
      v: clampNumber(1 - (event.clientY - rect.top) / rect.height, 0, 1),
    })
  }

  const channels =
    format === 'RGB'
      ? [
          { label: 'R', value: r, max: 255, update: (n: number) => setFromHex(rgbToHex(n, g, b)) },
          { label: 'G', value: g, max: 255, update: (n: number) => setFromHex(rgbToHex(r, n, b)) },
          { label: 'B', value: b, max: 255, update: (n: number) => setFromHex(rgbToHex(r, g, n)) },
        ]
      : [
          { label: 'H', value: Math.round(hsl.h), max: 360, update: (n: number) => setFromHex(hslToHex({ ...hsl, h: n })) },
          { label: 'S', value: Math.round(hsl.s * 100), max: 100, update: (n: number) => setFromHex(hslToHex({ ...hsl, s: n / 100 })) },
          { label: 'L', value: Math.round(hsl.l * 100), max: 100, update: (n: number) => setFromHex(hslToHex({ ...hsl, l: n / 100 })) },
        ]

  return (
    <>
      <div
        className={styles.sv}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setSvFromPointer(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) setSvFromPointer(event)
        }}
      >
        <span className={styles.marker} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>

      <input
        className={styles.hue}
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(event) => commit({ ...hsv, h: Number(event.target.value) })}
      />

      <div className={styles.formatHead}>
        <span className={styles.preview} style={{ background: draft }} aria-hidden />
        <div className={styles.formats} role="tablist" aria-label="Color format">
          {COLOR_FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={format === item}
              className={format === item ? styles.formatActive : undefined}
              onClick={() => setFormat(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {format === 'HEX' ? (
        <label className={styles.field}>
          <span>HEX</span>
          <input
            value={hexDraft ?? draft.toUpperCase()}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => {
              setHexDraft(event.target.value)
              const parsed = validHex(event.target.value)
              if (parsed) setFromHex(parsed)
            }}
            onBlur={() => setHexDraft(null)}
          />
        </label>
      ) : (
        <div className={styles.channels}>
          {channels.map((channel) => (
            <label key={channel.label} className={styles.field}>
              <span>{channel.label}</span>
              <input
                type="number"
                min={0}
                max={channel.max}
                value={channel.value}
                onChange={(event) => channel.update(clampNumber(Number(event.target.value) || 0, 0, channel.max))}
              />
            </label>
          ))}
        </div>
      )}

      {recentColor ? (
        <div className={styles.recent}>
          <span className={styles.label}>Recent</span>
          <button
            type="button"
            aria-label={`Use recent color ${recentColor}`}
            style={{ background: recentColor }}
            onClick={() => setFromHex(recentColor)}
          />
        </div>
      ) : null}
    </>
  )
}

/** Always-open color picker card that edits the color live. */
export function InlineColorPicker({
  title,
  value,
  onChange,
}: {
  title: string
  value: string
  onChange: (color: string) => void
}) {
  return (
    <section className={styles.inline} aria-label={title}>
      <span className={styles.inlineTitle}>{title}</span>
      <ColorPickerControls value={value} onChange={onChange} />
    </section>
  )
}

/** Custom color popover with Cancel / Apply, anchored to the button that opened it. */
export function CustomColorPicker({
  value,
  recentColor,
  anchorRef,
  onCancel,
  onApply,
}: {
  value: string
  recentColor?: string
  anchorRef: RefObject<HTMLElement | null>
  onCancel: () => void
  onApply: (color: string) => void
}) {
  const [draft, setDraft] = useState(() => validHex(value) ?? '#000000')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const popoverRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const sync = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = rect.bottom + GAP
      setPosition({
        left: clampNumber(rect.left, GAP, window.innerWidth - POPOVER_WIDTH - GAP),
        top:
          below + POPOVER_HEIGHT <= window.innerHeight - GAP ? below : Math.max(GAP, rect.top - POPOVER_HEIGHT - GAP),
      })
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [anchorRef])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onCancel()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onCancel()
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [anchorRef, onCancel])

  return createPortal(
    <section
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Choose custom color"
      style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
    >
      <ColorPickerControls value={draft} recentColor={recentColor} onChange={setDraft} />
      <footer className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.apply} onClick={() => onApply(draft)}>
          Apply
        </button>
      </footer>
    </section>,
    document.body,
  )
}
