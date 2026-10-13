import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowCounterClockwise, Sparkle, X } from '@phosphor-icons/react'
import { useRevealScrollbarOnScroll } from '../useRevealScrollbarOnScroll'
import {
  DEFAULT_FINDING_AURORA,
  type FindingAuroraSettings,
} from './findingAuroraSettings'
import styles from './FindingAuroraPanel.module.css'

export type FindingAuroraPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: FindingAuroraSettings
  onChange: (next: FindingAuroraSettings) => void
  onReplay: () => void
  /** Render only the settings panel. The header trigger stays hidden. */
  hideTrigger?: boolean
}

function patch<K extends keyof FindingAuroraSettings>(
  settings: FindingAuroraSettings,
  onChange: (next: FindingAuroraSettings) => void,
  key: K,
  value: FindingAuroraSettings[K],
) {
  onChange({ ...settings, [key]: value })
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onChange: (n: number) => void
}) {
  const id = useId()
  return (
    <div className={styles.sliderRow}>
      <label className={styles.sliderMeta} htmlFor={id}>
        <span>{label}</span>
        <span className={styles.sliderValue}>{format(value)}</span>
      </label>
      <input
        id={id}
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className={styles.toggleRow}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className={styles.colorRow}>
      <span>{label}</span>
      <span className={styles.colorValue}>{value}</span>
      <input type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

function fmt2(n: number) {
  return n.toFixed(2)
}
function fmtInt(n: number) {
  return String(Math.round(n))
}

export function FindingAuroraPanel({
  open,
  onOpenChange,
  settings,
  onChange,
  onReplay,
  hideTrigger = false,
}: FindingAuroraPanelProps) {
  const scrollRef = useRevealScrollbarOnScroll()
  const set = <K extends keyof FindingAuroraSettings>(key: K, value: FindingAuroraSettings[K]) =>
    patch(settings, onChange, key, value)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const panel = open
        ? createPortal(
            <aside
              id="finding-aurora-panel"
              className={styles.panel}
              aria-label="Finding aurora settings"
            >
              <header className={styles.panelHeader}>
                <div className={styles.panelTitleBlock}>
                  <p className={styles.panelKicker}>Finding notification</p>
                  <h2 className={styles.panelTitle}>Aurora</h2>
                </div>
                <div className={styles.panelActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={onReplay}
                    aria-label="Replay aurora"
                    title="Replay"
                  >
                    <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onChange({ ...DEFAULT_FINDING_AURORA })}
                    aria-label="Reset aurora settings"
                    title="Reset"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onOpenChange(false)}
                    aria-label="Close aurora settings"
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
              </header>

              <div ref={scrollRef} className={styles.scroll}>
                <div className={styles.scrollInner}>
                  <Section title="Aurora">
                    <ColorRow
                      label="Color left"
                      value={settings.colorStop1}
                      onChange={(n) => set('colorStop1', n)}
                    />
                    <ColorRow
                      label="Color middle"
                      value={settings.colorStop2}
                      onChange={(n) => set('colorStop2', n)}
                    />
                    <ColorRow
                      label="Color right"
                      value={settings.colorStop3}
                      onChange={(n) => set('colorStop3', n)}
                    />
                    <SliderRow
                      label="Amplitude"
                      value={settings.amplitude}
                      min={0}
                      max={2}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('amplitude', n)}
                    />
                    <SliderRow
                      label="Blend"
                      value={settings.blend}
                      min={0}
                      max={2}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('blend', n)}
                    />
                    <SliderRow
                      label="Speed"
                      value={settings.speed}
                      min={0}
                      max={3}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('speed', n)}
                    />
                    <SliderRow
                      label="Streaks"
                      value={settings.streaks ?? 0.24}
                      min={0}
                      max={1}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('streaks', n)}
                    />
                    <SliderRow
                      label="Highlights"
                      value={settings.highlights ?? 0.04}
                      min={0}
                      max={1}
                      step={0.01}
                      format={fmt2}
                      onChange={(n) => set('highlights', n)}
                    />
                    <p className={styles.hint}>
                      Streaks pull the glow into vertical curtains. Highlights add bright
                      cores inside those rays so the light is not one soft blob.
                    </p>
                  </Section>

                  <Section title="Backdrop">
                    <SliderRow
                      label="Blur strength"
                      value={settings.blurStrength ?? DEFAULT_FINDING_AURORA.blurStrength}
                      min={0}
                      max={120}
                      step={1}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('blurStrength', n)}
                    />
                    <SliderRow
                      label="Fade length"
                      value={settings.blurFade ?? DEFAULT_FINDING_AURORA.blurFade}
                      min={24}
                      max={360}
                      step={2}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('blurFade', n)}
                    />
                    <SliderRow
                      label="Solid lift"
                      value={settings.blurLift ?? DEFAULT_FINDING_AURORA.blurLift}
                      min={0}
                      max={160}
                      step={1}
                      format={(n) => `${fmtInt(n)}px`}
                      onChange={(n) => set('blurLift', n)}
                    />
                    <p className={styles.hint}>
                      Solid lift is extra solid blur above the domain label. Fade length is
                      how far that blur then falls off, in pixels.
                    </p>
                  </Section>

                  <Section title="Intro timing">
                    <ToggleRow
                      label="Show copy"
                      checked={settings.showCopy}
                      onChange={(n) => set('showCopy', n)}
                    />
                    <SliderRow
                      label="Copy delay"
                      value={settings.copyDelayMs}
                      min={0}
                      max={2000}
                      step={20}
                      format={(n) => `${fmtInt(n)}ms`}
                      onChange={(n) => set('copyDelayMs', n)}
                    />
                    <p className={styles.hint}>
                      The finding fades in after this delay and stays on the aurora.
                    </p>
                    <SliderRow
                      label="Word stagger"
                      value={settings.wordStaggerMs}
                      min={0}
                      max={200}
                      step={2}
                      format={(n) => `${fmtInt(n)}ms`}
                      onChange={(n) => set('wordStaggerMs', n)}
                    />
                  </Section>
                </div>
              </div>
            </aside>,
            document.body,
          )
        : null

  if (hideTrigger) return panel

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}`}
        aria-expanded={open}
        aria-controls="finding-aurora-panel"
        onClick={() => onOpenChange(!open)}
      >
        <span className={styles.kicker}>FX</span>
        <Sparkle size={14} weight="fill" aria-hidden />
        <span>Aurora</span>
      </button>
      {panel}
    </div>
  )
}
