import { useId, useState } from 'react'
import { ArrowsClockwise, Play, Stop, X } from '@phosphor-icons/react'
import { ambientDrawStyle, DEFAULT_AMBIENT_RUN, type AmbientRun, type CanvasAmbient } from './canvasAmbient'
import {
  DEFAULT_CANVAS_DOTS,
  DEFAULT_CANVAS_PORTS,
  DEFAULT_RUN_RESULT,
  DOT_SWATCHES,
  PORT_MAX_BORDER,
  PORT_MAX_SIZE,
  PORT_MIN_SIZE,
  RESULT_LIMITS,
  type CanvasDots,
  type CanvasLook,
  type CanvasPorts,
  type CanvasRunResult,
  type ResultGlow,
  type RunOutcome,
} from './canvasLook'
import { CanvasBackdropSections } from './BackdropControls'
import { PopoverHost } from './ConfigControls'
import { ColorField, PercentInput, Slider, TintField } from './PaintControls'
import controls from '../llumen-assistant/FloatingControls.module.css'
import styles from './AppearancePanel.module.css'

type CanvasLookPanelProps = {
  look: CanvasLook
  onChange: (next: CanvasLook) => void
  onReset: () => void
  onClose: () => void
  /** Plays the run animation without running the workflow, for tuning. */
  previewingRun: boolean
  onPreviewRun: () => void
  /** Shows the result glow once, without running the workflow. */
  onPreviewResult: (outcome: RunOutcome) => void
}

const percent = (value: number) => `${Math.round(value)}%`
const seconds = (value: number) => `${Number(value.toFixed(1))}s`

export function CanvasLookPanel({ look, onChange, onReset, onClose, previewingRun, onPreviewRun, onPreviewResult }: CanvasLookPanelProps) {
  const dotsTitleId = useId()
  const runTitleId = useId()
  const resultTitleId = useId()
  const portsTitleId = useId()
  const { dots, ambient, ports, result } = look

  const setDots = (patch: Partial<CanvasDots>) => onChange({ ...look, dots: { ...dots, ...patch } })
  const setAmbient = (patch: Partial<CanvasAmbient>) => onChange({ ...look, ambient: { ...ambient, ...patch } })
  const setRun = (patch: Partial<AmbientRun>) => setAmbient({ run: { ...ambient.run, ...patch } })
  const setPorts = (patch: Partial<CanvasPorts>) => onChange({ ...look, ports: { ...ports, ...patch } })
  const setResult = (patch: Partial<CanvasRunResult>) => onChange({ ...look, result: { ...result, ...patch } })
  const [glowOutcome, setGlowOutcome] = useState<RunOutcome>('pass')
  const glow = result[glowOutcome]
  const setGlow = (patch: Partial<ResultGlow>) => setResult({ [glowOutcome]: { ...glow, ...patch } })
  return (
    <aside className={styles.panel} aria-label="Canvas background">
      <PopoverHost>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.title}>Canvas background</h2>
            <p className={styles.subtitle}>Applies to the whole canvas</p>
          </div>
          <button type="button" className={styles.iconAction} aria-label="Close canvas background" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <div className={styles.scroll} data-native-scroll>
          <CanvasBackdropSections look={look} onChange={onChange} />

          <section className={styles.section} aria-labelledby={dotsTitleId}>
            <div className={styles.sectionHead}>
              <h3 id={dotsTitleId} className={styles.sectionTitle}>
                Dots
              </h3>
              <button type="button" className={styles.applyTrigger} onClick={() => setDots(DEFAULT_CANVAS_DOTS)}>
                Reset dots
              </button>
            </div>
            <div className={styles.dotSwatches} role="radiogroup" aria-label="Dot colour presets">
              {DOT_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  role="radio"
                  aria-checked={dots.color.toLowerCase() === swatch.color}
                  aria-label={swatch.name}
                  className={styles.dotSwatch}
                  style={{ background: swatch.color }}
                  onClick={() => setDots({ color: swatch.color })}
                />
              ))}
            </div>
            <ColorField label="Dot color" color={dots.color} onChange={(color) => setDots({ color })} />
            <Slider
              label="Opacity"
              value={Math.round(dots.opacity * 100)}
              min={0}
              max={100}
              format={(percent) => (percent === 0 ? 'Hidden' : `${percent}%`)}
              onChange={(percent) => setDots({ opacity: percent / 100 })}
            />
            <Slider label="Size" value={dots.size} min={0.5} max={3} step={0.5} format={(px) => `${px}px`} onChange={(size) => setDots({ size })} />
          </section>

          <section className={styles.section} aria-labelledby={portsTitleId}>
            <div className={styles.sectionHead}>
              <h3 id={portsTitleId} className={styles.sectionTitle}>
                Ports
              </h3>
              <button type="button" className={styles.applyTrigger} onClick={() => setPorts(DEFAULT_CANVAS_PORTS)}>
                Reset ports
              </button>
            </div>
            <div className={styles.stops}>
              <TintField label="Fill" tint={ports.fill} onChange={(fill) => setPorts({ fill })} />
              <TintField label="Border" tint={ports.border} onChange={(border) => setPorts({ border })} />
            </div>
            <Slider
              label="Border width"
              value={ports.borderWidth}
              min={0}
              max={PORT_MAX_BORDER}
              step={0.5}
              format={(px) => (px === 0 ? 'None' : `${px}px`)}
              onChange={(borderWidth) => setPorts({ borderWidth })}
            />
            <Slider label="Size" value={ports.size} min={PORT_MIN_SIZE} max={PORT_MAX_SIZE} format={(px) => `${px}px`} onChange={(size) => setPorts({ size })} />
          </section>

          <section className={styles.section} aria-labelledby={runTitleId}>
            <div className={styles.sectionHead}>
              <h3 id={runTitleId} className={styles.sectionTitle}>
                Run animation
              </h3>
              <span className={styles.rowTools}>
                <button type="button" className={styles.applyTrigger} onClick={() => setAmbient({ run: DEFAULT_AMBIENT_RUN })}>
                  Reset
                </button>
                <button type="button" className={styles.applyTrigger} aria-pressed={previewingRun} onClick={onPreviewRun}>
                  {previewingRun ? <Stop size={12} weight="fill" aria-hidden /> : <Play size={12} weight="fill" aria-hidden />}
                  {previewingRun ? 'Stop preview' : 'Preview'}
                </button>
              </span>
            </div>
            <p className={styles.hint}>While a run is active, the shader colours move out to the screen edges and circle it.</p>
            <Slider
              label="Intensity"
              value={Math.round(ambient.run.intensity * 100)}
              min={0}
              max={100}
              format={(value) => (value === 0 ? 'Off' : percent(value))}
              onChange={(value) => setRun({ intensity: value / 100 })}
            />
            <Slider
              label="Reach"
              value={Math.round(ambient.run.reach * 100)}
              min={2}
              max={40}
              format={percent}
              onChange={(value) => setRun({ reach: value / 100 })}
            />
            {ambientDrawStyle(ambient.style) === 'blobs' && (
              <Slider
                label="Spread"
                value={Math.round(ambient.run.spread * 100)}
                min={10}
                max={80}
                format={percent}
                onChange={(value) => setRun({ spread: value / 100 })}
              />
            )}
            <Slider
              label="Lap time"
              value={ambient.run.lapSeconds}
              min={3}
              max={60}
              format={seconds}
              onChange={(lapSeconds) => setRun({ lapSeconds })}
            />
            <Slider
              label="Pulse"
              value={Math.round(ambient.run.pulse * 100)}
              min={0}
              max={100}
              format={(value) => (value === 0 ? 'None' : percent(value))}
              onChange={(value) => setRun({ pulse: value / 100 })}
            />
            <Slider
              label="Pulse time"
              value={ambient.run.pulseSeconds}
              min={0.6}
              max={8}
              step={0.2}
              format={seconds}
              onChange={(pulseSeconds) => setRun({ pulseSeconds })}
            />
            <Slider
              label="Transition"
              value={ambient.run.transitionSeconds}
              min={0.2}
              max={4}
              step={0.1}
              format={seconds}
              onChange={(transitionSeconds) => setRun({ transitionSeconds })}
            />
          </section>

          <section className={styles.section} aria-labelledby={resultTitleId}>
            <div className={styles.sectionHead}>
              <h3 id={resultTitleId} className={styles.sectionTitle}>
                Run result
              </h3>
              <span className={styles.rowTools}>
                <button type="button" className={styles.applyTrigger} onClick={() => setResult(DEFAULT_RUN_RESULT)}>
                  Reset
                </button>
                <button type="button" className={styles.applyTrigger} onClick={() => onPreviewResult('pass')}>
                  <Play size={12} weight="fill" aria-hidden />
                  Pass
                </button>
                <button type="button" className={styles.applyTrigger} onClick={() => onPreviewResult('fail')}>
                  <Play size={12} weight="fill" aria-hidden />
                  Fail
                </button>
              </span>
            </div>
            <p className={styles.hint}>
              When a flow run finishes, a glow rises from the bottom of the screen, and the background returns to normal once it ends. Failed
              nodes take the fail colour.
            </p>
            <div className={styles.segmented2} role="radiogroup" aria-label="Glow to edit">
              {(['pass', 'fail'] as const).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  role="radio"
                  aria-checked={glowOutcome === outcome}
                  className={`${styles.segmentTight}${glowOutcome === outcome ? ` ${controls.segmentActive}` : ''}`}
                  onClick={() => setGlowOutcome(outcome)}
                >
                  {outcome === 'pass' ? 'Pass' : 'Fail'}
                </button>
              ))}
            </div>
            <div className={styles.stops}>
              <ColorField
                label="Color"
                color={glow.color}
                opacity={glow.opacity}
                onChange={(color) => setGlow({ color })}
              >
                <PercentInput label="Strength" value={glow.opacity} onChange={(opacity) => setGlow({ opacity })} />
              </ColorField>
            </div>
            <Slider
              label="Intensity"
              value={Math.round(glow.intensity * 100)}
              min={0}
              max={100}
              format={(value) => (value === 0 ? 'Off' : percent(value))}
              onChange={(value) => setGlow({ intensity: value / 100 })}
            />
            <Slider
              label="Spread"
              value={Math.round(glow.spread * 100)}
              min={RESULT_LIMITS.spread.min * 100}
              max={RESULT_LIMITS.spread.max * 100}
              format={percent}
              onChange={(value) => setGlow({ spread: value / 100 })}
            />
            <Slider
              label="Height"
              value={Math.round(glow.height * 100)}
              min={RESULT_LIMITS.height.min * 100}
              max={RESULT_LIMITS.height.max * 100}
              format={percent}
              onChange={(value) => setGlow({ height: value / 100 })}
            />
            <Slider
              label="Softness"
              value={Math.round(glow.softness * 100)}
              min={0}
              max={100}
              format={percent}
              onChange={(value) => setGlow({ softness: value / 100 })}
            />
            <Slider
              label="Pulse"
              value={Math.round(glow.pulse * 100)}
              min={0}
              max={100}
              format={(value) => (value === 0 ? 'Steady' : percent(value))}
              onChange={(value) => setGlow({ pulse: value / 100 })}
            />
            {glow.pulse > 0 ? (
              <Slider
                label="Pulse time"
                value={glow.pulseSeconds}
                min={RESULT_LIMITS.pulseSeconds.min}
                max={RESULT_LIMITS.pulseSeconds.max}
                step={0.1}
                format={seconds}
                onChange={(pulseSeconds) => setGlow({ pulseSeconds })}
              />
            ) : null}
            <Slider
              label="Duration"
              value={result.seconds}
              min={RESULT_LIMITS.seconds.min}
              max={RESULT_LIMITS.seconds.max}
              step={0.2}
              format={seconds}
              onChange={(value) => setResult({ seconds: value })}
            />
          </section>
        </div>

        <footer className={styles.foot}>
          <div className={styles.footRow}>
            <button type="button" className={`${styles.footButton} ${styles.footButtonPrimary}`} onClick={onReset}>
              <ArrowsClockwise size={14} weight="bold" aria-hidden />
              Reset canvas
            </button>
          </div>
        </footer>
      </PopoverHost>
    </aside>
  )
}
