import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { dismissRecorder, loadSettings, startRecording } from './recorderStore'
import { DEMO_FORMATS, type DemoSettings, type ZoomMode } from './types'
import styles from './DemoSetupDialog.module.css'

const BACKGROUNDS = [
  { label: 'Midnight', value: 'linear-gradient(135deg, #1b2340 0%, #0a0e16 55%, #10233a 100%)' },
  { label: 'Aurora', value: 'linear-gradient(135deg, #0f3b3a 0%, #0a0e16 50%, #2a1b4a 100%)' },
  { label: 'Graphite', value: 'linear-gradient(180deg, #2a2d33 0%, #131518 100%)' },
  { label: 'Paper', value: 'linear-gradient(180deg, #f3f1ec 0%, #dcd8cf 100%)' },
]

const PACES = [
  { label: 'Calm', value: 1.35 },
  { label: 'Natural', value: 1 },
  { label: 'Brisk', value: 0.75 },
]

const TYPING = [
  { label: 'Slow', value: 9 },
  { label: 'Natural', value: 14 },
  { label: 'Fast', value: 22 },
]

const ZOOM_HINTS: Record<ZoomMode, string> = {
  auto: 'Zooms on every click and keystroke. Press ⌥Z while recording to skip the next one.',
  marked: 'Stays wide. Press ⌥Z while recording to zoom on the next click or typing.',
  off: 'The whole UI stays in frame.',
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <span>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={styles.switch} onClick={() => onChange(!checked)}>
      <span className={styles.knob} />
    </button>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
  disabled,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (next: number) => void
  format: (value: number) => string
  label: string
  disabled?: boolean
}) {
  return (
    <label className={styles.slider} data-disabled={disabled || undefined}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className={styles.value}>{format(value)}</span>
    </label>
  )
}

/** Chosen before each take: format, camera, overlays, framing and pace. Remembered for the next one. */
export function DemoSetupDialog() {
  const [settings, setSettings] = useState<DemoSettings>(loadSettings)
  const { format, render } = settings
  const presetId = DEMO_FORMATS.some((preset) => preset.id === format.id) ? format.id : 'custom'

  const update = (patch: Partial<DemoSettings>) => setSettings((current) => ({ ...current, ...patch }))
  const updateRender = (patch: Partial<DemoSettings['render']>) => setSettings((current) => ({ ...current, render: { ...current.render, ...patch } }))
  const updateFormat = (patch: Partial<DemoSettings['format']>) => setSettings((current) => ({ ...current, format: { ...current.format, ...patch } }))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismissRecorder()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const zoomOff = render.zoomMode === 'off'

  return createPortal(
    <div className={styles.backdrop} data-demo-ignore onMouseDown={dismissRecorder}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-setup-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          startRecording(settings)
        }}
      >
        <header className={styles.header}>
          <h2 id="demo-setup-title" className={styles.title}>
            New recording
          </h2>
          <p className={styles.subtitle}>Click through the flow at your pace. The take is replayed and filmed at the size below.</p>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Format</h3>
            <Row label="Aspect" hint={`${format.width * format.scale} × ${format.height * format.scale} px at ${format.fps} fps`}>
              <Segmented
                label="Aspect"
                value={presetId}
                options={[...DEMO_FORMATS.map((preset) => ({ label: preset.id, value: preset.id })), { label: 'Custom', value: 'custom' }]}
                onChange={(id) => {
                  const preset = DEMO_FORMATS.find((candidate) => candidate.id === id)
                  if (preset) updateFormat({ id: preset.id, width: preset.width, height: preset.height })
                  else updateFormat({ id: 'custom' })
                }}
              />
            </Row>
            {presetId === 'custom' ? (
              <Row label="Viewport" hint="CSS px the app is laid out in">
                <div className={styles.dimensions}>
                  <input
                    className={styles.number}
                    type="number"
                    min={320}
                    max={3840}
                    value={format.width}
                    aria-label="Viewport width"
                    onChange={(event) => updateFormat({ width: Math.round(Number(event.target.value) || 0) })}
                  />
                  <span className={styles.hint}>×</span>
                  <input
                    className={styles.number}
                    type="number"
                    min={320}
                    max={3840}
                    value={format.height}
                    aria-label="Viewport height"
                    onChange={(event) => updateFormat({ height: Math.round(Number(event.target.value) || 0) })}
                  />
                </div>
              </Row>
            ) : null}
            <Row label="Resolution">
              <Segmented
                label="Resolution"
                value={format.scale}
                options={[
                  { label: '1×', value: 1 },
                  { label: '2×', value: 2 },
                ]}
                onChange={(scale) => updateFormat({ scale })}
              />
            </Row>
            <Row label="Frame rate">
              <Segmented
                label="Frame rate"
                value={format.fps}
                options={[
                  { label: '30', value: 30 },
                  { label: '60', value: 60 },
                ]}
                onChange={(fps) => updateFormat({ fps })}
              />
            </Row>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Camera</h3>
            <Row label="Zoom" hint={ZOOM_HINTS[render.zoomMode]}>
              <Segmented
                label="Zoom"
                value={render.zoomMode}
                options={[
                  { label: 'Auto', value: 'auto' as const },
                  { label: 'Marked', value: 'marked' as const },
                  { label: 'Off', value: 'off' as const },
                ]}
                onChange={(zoomMode) => updateRender({ zoomMode })}
              />
            </Row>
            <Row label="Zoom level">
              <Slider
                label="Zoom level"
                value={render.zoom}
                min={1.1}
                max={2.5}
                step={0.05}
                disabled={zoomOff}
                format={(value) => `${value.toFixed(2)}×`}
                onChange={(zoom) => updateRender({ zoom })}
              />
            </Row>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Overlays</h3>
            <Row label="Cursor">
              <Toggle label="Cursor" checked={render.cursor === 'arrow'} onChange={(on) => updateRender({ cursor: on ? 'arrow' : 'none' })} />
            </Row>
            <Row label="Cursor size">
              <Slider
                label="Cursor size"
                value={render.cursorScale}
                min={0.6}
                max={2}
                step={0.05}
                disabled={render.cursor === 'none'}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(cursorScale) => updateRender({ cursorScale })}
              />
            </Row>
            <Row label="Click ripple">
              <Toggle label="Click ripple" checked={render.ripple} onChange={(ripple) => updateRender({ ripple })} />
            </Row>
            <Row label="Keycaps" hint="Shows shortcuts like ⌘K and Esc">
              <Toggle label="Keycaps" checked={render.keys} onChange={(keys) => updateRender({ keys })} />
            </Row>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Framing</h3>
            <Row label="Layout">
              <Segmented
                label="Layout"
                value={render.inset > 0 ? 'inset' : 'full'}
                options={[
                  { label: 'Full-bleed', value: 'full' },
                  { label: 'Inset', value: 'inset' },
                ]}
                onChange={(layout) => updateRender({ inset: layout === 'inset' ? Math.max(render.inset, 64) : 0 })}
              />
            </Row>
            {render.inset > 0 ? (
              <>
                <Row label="Padding">
                  <Slider
                    label="Padding"
                    value={render.inset}
                    min={16}
                    max={200}
                    step={4}
                    format={(value) => `${value}px`}
                    onChange={(inset) => updateRender({ inset })}
                  />
                </Row>
                <Row label="Background">
                  <div className={styles.swatches} role="radiogroup" aria-label="Background">
                    {BACKGROUNDS.map((background) => (
                      <button
                        key={background.label}
                        type="button"
                        role="radio"
                        aria-checked={render.background === background.value}
                        aria-label={background.label}
                        title={background.label}
                        className={styles.swatch}
                        style={{ background: background.value }}
                        onClick={() => updateRender({ background: background.value })}
                      />
                    ))}
                  </div>
                </Row>
              </>
            ) : null}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Pace</h3>
            <Row label="Pauses">
              <Segmented label="Pauses" value={settings.pace} options={PACES} onChange={(pace) => update({ pace })} />
            </Row>
            <Row label="Typing">
              <Segmented label="Typing" value={settings.typingSpeed} options={TYPING} onChange={(typingSpeed) => update({ typingSpeed })} />
            </Row>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>When you stop</h3>
            <Row
              label="Then"
              hint={settings.after === 'edit' ? 'Opens Remotion Studio to adjust zooms and overlays, then render from there.' : 'Renders final.mp4 with the options above.'}
            >
              <Segmented
                label="When you stop"
                value={settings.after}
                options={[
                  { label: 'Render as is', value: 'render' as const },
                  { label: 'Edit in Remotion', value: 'edit' as const },
                ]}
                onChange={(after) => update({ after })}
              />
            </Row>
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={dismissRecorder}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} autoFocus>
            Start recording
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
