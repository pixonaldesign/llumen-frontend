import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowsLeftRight, Shuffle } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { APPEARANCE_PRESETS, FILL_COLOR_COUNT, inkRgb, type AppearancePreset, type NodeFill as FillKind, type NodeFillPaint } from './nodeAppearance'
import type { Tint } from './canvasLook'
import { NodeFill } from './nodeParts'
import styles from './AppearancePanel.module.css'

const FILLS: readonly { id: FillKind; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'mesh', label: 'Mesh' },
]

const COLOR_LABELS: Record<FillKind, readonly string[]> = {
  default: [],
  solid: ['Fill'],
  gradient: ['Start', 'Middle', 'End'],
  mesh: ['Base', 'Glow 1', 'Glow 2', 'Glow 3'],
}

const HEX = /^#[0-9a-f]{6}$/i
/** Preset tiles are about a quarter of a node's width; scale the mesh blur to match. */
const TILE_BLUR_SCALE = 0.3

export function PresetSection({ activeId, onPick }: { activeId: string | null; onPick: (preset: AppearancePreset) => void }) {
  const titleId = useId()
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.sectionTitle}>
        Presets
      </h3>
      <div className={styles.presets}>
        {APPEARANCE_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className={styles.preset} aria-pressed={activeId === preset.id} onClick={() => onPick(preset)}>
            <span className={styles.presetSwatch} style={{ '--ink-rgb': inkRgb(preset.paint) ?? '255 255 255' } as CSSProperties}>
              <NodeFill paint={preset.paint} blurScale={TILE_BLUR_SCALE} />
              <span className={styles.presetInk} aria-hidden>
                Aa
              </span>
            </span>
            <span className={styles.presetName}>{preset.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

type BackgroundSectionProps = {
  paint: NodeFillPaint
  onTweak: (patch: Partial<NodeFillPaint>) => void
  /** Shown while the type is Default. */
  defaultHint: string
  /** Extra control beside the section title. */
  action?: ReactNode
  /** Shown under the section title, e.g. apply choices. */
  notice?: ReactNode
  /** Types to offer, in order; all of them by default. */
  fills?: readonly FillKind[]
}

export function BackgroundSection({ paint, onTweak, defaultHint, action, notice, fills }: BackgroundSectionProps) {
  const titleId = useId()
  const colorCount = FILL_COLOR_COUNT[paint.fill]
  const labels = COLOR_LABELS[paint.fill]
  const setColor = (index: number, color: string) => onTweak({ colors: paint.colors.map((current, i) => (i === index ? color : current)) })
  const options = fills ? FILLS.filter((fill) => fills.includes(fill.id)) : FILLS

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          Background
        </h3>
        {action}
      </div>
      {notice}
      <div className={options.length === 3 ? styles.segmented3 : styles.segmented4} role="radiogroup" aria-label="Background type">
        {options.map((fill) => (
          <button
            key={fill.id}
            type="button"
            role="radio"
            aria-checked={paint.fill === fill.id}
            className={`${styles.segmentTight}${paint.fill === fill.id ? ` ${controls.segmentActive}` : ''}`}
            onClick={() => onTweak({ fill: fill.id })}
          >
            {fill.label}
          </button>
        ))}
      </div>

      {colorCount > 0 ? (
        <div className={styles.colorsBlock}>
          <div className={styles.rowHead}>
            <span>Colors</span>
            {paint.fill === 'mesh' ? (
              <button type="button" className={styles.textAction} onClick={() => onTweak({ seed: Math.floor(Math.random() * 1_000_000) })}>
                <Shuffle size={14} weight="bold" aria-hidden />
                Shuffle
              </button>
            ) : paint.fill === 'gradient' ? (
              <button
                type="button"
                className={styles.textAction}
                onClick={() => onTweak({ colors: [paint.colors[2], paint.colors[1], paint.colors[0], ...paint.colors.slice(3)] })}
              >
                <ArrowsLeftRight size={14} weight="bold" aria-hidden />
                Reverse
              </button>
            ) : null}
          </div>
          <div className={styles.colors}>
            {paint.colors.slice(0, colorCount).map((color, index) => (
              <ColorField key={index} label={labels[index]} color={color} onChange={(next) => setColor(index, next)} />
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.hint}>{defaultHint}</p>
      )}

      {paint.fill === 'gradient' ? (
        <Slider label="Angle" value={paint.angle} min={0} max={360} format={(angle) => `${angle}°`} onChange={(angle) => onTweak({ angle })} />
      ) : null}
      {paint.fill === 'mesh' ? (
        <Slider
          label="Softness"
          value={Math.round(paint.softness * 100)}
          min={0}
          max={100}
          format={(percent) => `${percent}%`}
          onChange={(percent) => onTweak({ softness: percent / 100 })}
        />
      ) : null}
      {paint.fill !== 'default' ? (
        <Slider
          label="Grain"
          value={Math.round(paint.grain * 100)}
          min={0}
          max={100}
          format={(percent) => `${percent}%`}
          onChange={(percent) => onTweak({ grain: percent / 100 })}
        />
      ) : null}
    </section>
  )
}

/** Swatch that opens the system picker, plus an editable hex code. */
type ColorFieldProps = {
  label: string
  color: string
  onChange: (color: string) => void
  /** 0–1; the chip shows the colour over a checkerboard at this opacity. */
  opacity?: number
  /** Extra controls at the end of the row. */
  children?: ReactNode
}

const CHECKERBOARD = 'repeating-conic-gradient(#8a8a8a 0 25%, #c8c8c8 0 50%) 0 0 / 8px 8px'

export function ColorField({ label, color, onChange, opacity, children }: ColorFieldProps) {
  const commit = (input: HTMLInputElement) => {
    const raw = input.value.trim()
    const hex = raw.startsWith('#') ? raw : `#${raw}`
    if (HEX.test(hex)) onChange(hex.toLowerCase())
    else input.value = color.toUpperCase()
  }
  const alphaHex = opacity === undefined ? '' : Math.round(opacity * 255).toString(16).padStart(2, '0')
  const chip = opacity === undefined ? color : `linear-gradient(${color}${alphaHex}, ${color}${alphaHex}), ${CHECKERBOARD}`

  return (
    <div className={styles.color}>
      <label className={styles.colorChip} style={{ background: chip }} title={`Pick ${label} color`}>
        <input type="color" className={styles.colorInput} value={color} aria-label={`${label} color`} onChange={(event) => onChange(event.target.value)} />
      </label>
      <span className={styles.colorText}>
        <span className={styles.colorLabel}>{label}</span>
        <input
          key={color}
          className={styles.hexInput}
          defaultValue={color.toUpperCase()}
          spellCheck={false}
          aria-label={`${label} hex`}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget)
          }}
        />
      </span>
      {children}
    </div>
  )
}

/** Colour, hex, and opacity on one row. */
export function TintField({ label, tint, onChange }: { label: string; tint: Tint; onChange: (tint: Tint) => void }) {
  return (
    <ColorField label={label} color={tint.color} opacity={tint.opacity} onChange={(color) => onChange({ ...tint, color })}>
      <PercentInput label={`${label} opacity`} value={tint.opacity} onChange={(opacity) => onChange({ ...tint, opacity })} />
    </ColorField>
  )
}

/** Compact 0–100% field; type a number, or nudge with the arrow keys (Shift for steps of 10). */
export function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const percent = Math.round(value * 100)
  const [draft, setDraft] = useState<string | null>(null)
  const set = (next: number) => onChange(Math.min(100, Math.max(0, Math.round(next))) / 100)
  const commit = () => {
    const typed = Number.parseFloat(draft ?? '')
    if (Number.isFinite(typed)) set(typed)
    setDraft(null)
  }

  return (
    <input
      className={styles.percentInput}
      value={draft ?? `${percent}%`}
      inputMode="numeric"
      spellCheck={false}
      aria-label={label}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          setDraft(null)
          set(percent + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1))
        }
      }}
    />
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (value: number) => string
  onChange: (value: number) => void
  /** Extra control in the header, before the value. */
  action?: ReactNode
  /** Shown under the track. */
  children?: ReactNode
}

export function Slider({ label, value, min, max, step = 1, format, onChange, action, children }: SliderProps) {
  const id = useId()
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className={styles.slider}>
      <div className={styles.rowHead}>
        <label htmlFor={id}>{label}</label>
        <span className={styles.rowTools}>
          {action}
          <span className={styles.sliderValue}>{format(value)}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-fill': `${percent}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {children}
    </div>
  )
}
