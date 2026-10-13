import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowCounterClockwise, ArrowsClockwise } from '@phosphor-icons/react'
import { ColorPicker } from './StoryColorPicker'
import { ColorFill, MediaFrame } from './StoryBackgroundLayer'
import {
  BACKGROUND_COLOR_MODES,
  BACKGROUND_FITS,
  BACKGROUND_GRADIENT_TYPES,
  BACKGROUND_PLAYBACK_RATES,
  BACKGROUND_SHADER_PRESETS,
  formatSeconds,
  type BackgroundColor,
  type BackgroundMedia,
} from './storyBackground'
import styles from './StoryBackground.module.css'

/** Keeps at least this much video between the trim handles. */
const MIN_TRIM_SECONDS = 0.5

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{label}</span>
        {value != null ? <span className={styles.fieldValue}>{value}</span> : null}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`${styles.segment}${value === option.id ? ` ${styles.segmentActive}` : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Pointer slop around a thumb that still counts as hovering it. */
const THUMB_HIT_SLOP = 6

function isOverThumb(event: ReactPointerEvent, thumb: HTMLElement | null) {
  if (!thumb) return false
  const rect = thumb.getBoundingClientRect()
  return (
    event.clientX >= rect.left - THUMB_HIT_SLOP &&
    event.clientX <= rect.right + THUMB_HIT_SLOP &&
    event.clientY >= rect.top - THUMB_HIT_SLOP &&
    event.clientY <= rect.bottom + THUMB_HIT_SLOP
  )
}

function progress(value: number, min: number, max: number) {
  return max === min ? 0 : clamp((value - min) / (max - min), 0, 1)
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  const thumbRef = useRef<HTMLSpanElement>(null)
  const [thumbHovered, setThumbHovered] = useState(false)

  return (
    <div className={styles.slider}>
      <div
        className={`${styles.sliderTrack}${thumbHovered ? ` ${styles.sliderTrackHot}` : ''}`}
        style={{ '--slider-t': progress(value, min, max) } as CSSProperties}
      >
        <span className={styles.sliderFill}>
          <span ref={thumbRef} className={styles.sliderThumb} aria-hidden />
        </span>
        <input
          className={styles.sliderInput}
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerMove={(event) => setThumbHovered(isOverThumb(event, thumbRef.current))}
          onPointerLeave={() => setThumbHovered(false)}
        />
      </div>
      <span className={styles.sliderValue}>{display}</span>
    </div>
  )
}

function RangeSlider({
  label,
  low,
  high,
  min,
  max,
  step,
  disabled,
  onLowChange,
  onHighChange,
}: {
  label: string
  low: number
  high: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onLowChange: (value: number) => void
  onHighChange: (value: number) => void
}) {
  const lowThumbRef = useRef<HTMLSpanElement>(null)
  const highThumbRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState<'low' | 'high' | null>(null)

  const trackHover = (event: ReactPointerEvent) =>
    setHovered(
      isOverThumb(event, highThumbRef.current) ? 'high' : isOverThumb(event, lowThumbRef.current) ? 'low' : null,
    )

  return (
    <div
      className={`${styles.range}${disabled ? ` ${styles.rangeDisabled}` : ''}`}
      style={
        { '--range-low': progress(low, min, max), '--range-high': progress(high, min, max) } as CSSProperties
      }
      onPointerMove={trackHover}
      onPointerLeave={() => setHovered(null)}
    >
      <span className={styles.rangeFill} aria-hidden />
      <span
        ref={lowThumbRef}
        className={`${styles.rangeThumb} ${styles.rangeThumbLow}${hovered === 'low' ? ` ${styles.rangeThumbHot}` : ''}`}
        aria-hidden
      />
      <span
        ref={highThumbRef}
        className={`${styles.rangeThumb} ${styles.rangeThumbHigh}${hovered === 'high' ? ` ${styles.rangeThumbHot}` : ''}`}
        aria-hidden
      />
      <input
        className={`${styles.rangeInput} ${styles.rangeInputLow}`}
        type="range"
        aria-label={`${label} start`}
        min={min}
        max={max}
        step={step}
        value={low}
        disabled={disabled}
        onChange={(event) => onLowChange(Number(event.target.value))}
      />
      <input
        className={`${styles.rangeInput} ${styles.rangeInputHigh}`}
        type="range"
        aria-label={`${label} end`}
        min={min}
        max={max}
        step={step}
        value={high}
        disabled={disabled}
        onChange={(event) => onHighChange(Number(event.target.value))}
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`${styles.switch}${checked ? ` ${styles.switchOn}` : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchThumb} />
      </button>
    </label>
  )
}

function MediaPreview({
  media,
  onChange,
}: {
  media: BackgroundMedia
  onChange: (patch: Partial<BackgroundMedia>) => void
}) {
  const dragRef = useRef<{ x: number; y: number; focusX: number; focusY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, focusX: media.focusX, focusY: media.focusY }
    setDragging(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current
    if (!start) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = 100 / media.zoom
    onChange({
      focusX: clamp(start.focusX - ((event.clientX - start.x) / rect.width) * scale, 0, 100),
      focusY: clamp(start.focusY - ((event.clientY - start.y) / rect.height) * scale, 0, 100),
    })
  }

  const endDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  return (
    <div
      className={`${styles.preview}${dragging ? ` ${styles.previewDragging}` : ''}`}
      style={{ aspectRatio: `${window.innerWidth} / ${window.innerHeight}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label="Drag to reposition"
      role="img"
    >
      <MediaFrame media={media} forceMuted />
      <span className={styles.previewHint}>Drag to reposition</span>
    </div>
  )
}

function MediaSettings({
  media,
  onChange,
  onReplace,
}: {
  media: BackgroundMedia
  onChange: (patch: Partial<BackgroundMedia>) => void
  onReplace: () => void
}) {
  const isVideo = media.mediaType === 'video'
  const duration = media.duration
  const trimEnd = media.trimEnd ?? duration ?? 0
  const cropped = media.zoom !== 1 || media.focusX !== 50 || media.focusY !== 50

  return (
    <>
      <MediaPreview media={media} onChange={onChange} />
      <div className={styles.sourceRow}>
        <span className={styles.sourceName} title={media.name}>
          {media.name}
        </span>
        <button type="button" className={styles.pillBtn} onClick={onReplace}>
          <ArrowsClockwise size={14} weight="bold" aria-hidden />
          Change
        </button>
      </div>

      {isVideo ? (
        <Field
          label="Trim"
          value={duration ? `${formatSeconds(media.trimStart)} – ${formatSeconds(trimEnd)}` : 'Loading…'}
        >
          <RangeSlider
            label="Trim"
            low={media.trimStart}
            high={trimEnd}
            min={0}
            max={duration ?? 1}
            step={0.1}
            disabled={!duration}
            onLowChange={(value) => onChange({ trimStart: Math.min(value, trimEnd - MIN_TRIM_SECONDS) })}
            onHighChange={(value) => {
              const next = Math.max(value, media.trimStart + MIN_TRIM_SECONDS)
              onChange({ trimEnd: duration != null && next >= duration ? null : next })
            }}
          />
        </Field>
      ) : null}

      {isVideo ? (
        <>
          <Toggle label="Loop" checked={media.loop} onChange={(loop) => onChange({ loop })} />
          <Toggle label="Sound" checked={!media.muted} onChange={(sound) => onChange({ muted: !sound })} />
          <Field label="Speed">
            <Segmented
              label="Playback speed"
              value={media.playbackRate}
              options={BACKGROUND_PLAYBACK_RATES.map((rate) => ({ id: rate, label: `${rate}×` }))}
              onChange={(playbackRate) => onChange({ playbackRate })}
            />
          </Field>
        </>
      ) : null}

      <Field label="Fit">
        <Segmented label="Fit" value={media.fit} options={BACKGROUND_FITS} onChange={(fit) => onChange({ fit })} />
      </Field>
      <Field label="Crop zoom">
        <Slider
          label="Crop zoom"
          value={media.zoom}
          min={1}
          max={3}
          step={0.05}
          display={`${media.zoom.toFixed(2)}×`}
          onChange={(zoom) => onChange({ zoom })}
        />
      </Field>
      <Field label="Dim">
        <Slider
          label="Dim"
          value={media.dim}
          min={0}
          max={0.8}
          step={0.05}
          display={`${Math.round(media.dim * 100)}%`}
          onChange={(dim) => onChange({ dim })}
        />
      </Field>
      {cropped ? (
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => onChange({ zoom: 1, focusX: 50, focusY: 50 })}
        >
          <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
          Reset crop
        </button>
      ) : null}
    </>
  )
}

function ColorSettings({
  color,
  onChange,
}: {
  color: BackgroundColor
  onChange: (patch: Partial<BackgroundColor>) => void
}) {
  const patchGradient = (patch: Partial<BackgroundColor['gradient']>) =>
    onChange({ gradient: { ...color.gradient, ...patch } })
  const patchShader = (patch: Partial<BackgroundColor['shader']>) =>
    onChange({ shader: { ...color.shader, ...patch } })

  return (
    <>
      <Segmented label="Fill type" value={color.mode} options={BACKGROUND_COLOR_MODES} onChange={(mode) => onChange({ mode })} />
      <div className={styles.colorPreview}>
        <ColorFill color={color} />
      </div>

      {color.mode === 'solid' ? (
        <Field label="Color">
          <ColorPicker label="Background color" value={color.color} variant="swatch" onChange={(value) => onChange({ color: value })} />
        </Field>
      ) : null}

      {color.mode === 'gradient' ? (
        <>
          <Field label="Type">
            <Segmented
              label="Gradient type"
              value={color.gradient.type}
              options={BACKGROUND_GRADIENT_TYPES}
              onChange={(type) => patchGradient({ type })}
            />
          </Field>
          <Field label="Colors">
            <div className={styles.chips}>
              <ColorPicker label="From" value={color.gradient.from} variant="chip" onChange={(from) => patchGradient({ from })} />
              <ColorPicker label="To" value={color.gradient.to} variant="chip" onChange={(to) => patchGradient({ to })} />
            </div>
          </Field>
          {color.gradient.type === 'linear' ? (
            <Field label="Angle">
              <Slider
                label="Gradient angle"
                value={color.gradient.angle}
                min={0}
                max={360}
                step={1}
                display={`${color.gradient.angle}°`}
                onChange={(angle) => patchGradient({ angle })}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {color.mode === 'shader' ? (
        <>
          <Field label="Preset">
            <Segmented
              label="Shader preset"
              value={color.shader.preset}
              options={BACKGROUND_SHADER_PRESETS}
              onChange={(preset) => patchShader({ preset })}
            />
          </Field>
          <Field label="Colors">
            <div className={styles.chips}>
              <ColorPicker label="Base" value={color.shader.from} variant="chip" onChange={(from) => patchShader({ from })} />
              <ColorPicker label="Glow" value={color.shader.to} variant="chip" onChange={(to) => patchShader({ to })} />
            </div>
          </Field>
          <Field label="Speed">
            <Slider
              label="Shader speed"
              value={color.shader.speed}
              min={0.2}
              max={3}
              step={0.1}
              display={`${color.shader.speed.toFixed(1)}×`}
              onChange={(speed) => patchShader({ speed })}
            />
          </Field>
        </>
      ) : null}
    </>
  )
}

export function BackgroundSettings({
  background,
  onChange,
  onReplace,
}: {
  background: BackgroundMedia | BackgroundColor
  onChange: (next: BackgroundMedia | BackgroundColor) => void
  onReplace: () => void
}) {
  return (
    <div className={styles.settings}>
      {background.kind === 'media' ? (
        <MediaSettings
          media={background}
          onChange={(patch) => onChange({ ...background, ...patch })}
          onReplace={onReplace}
        />
      ) : (
        <ColorSettings color={background} onChange={(patch) => onChange({ ...background, ...patch })} />
      )}
    </div>
  )
}
