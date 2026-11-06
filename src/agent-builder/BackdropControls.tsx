import { Fragment, useId } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import {
  AMBIENT_MAX_BLUR,
  AMBIENT_MAX_STOPS,
  AMBIENT_MIN_STOPS,
  DEFAULT_AMBIENT,
  RAY_LIMITS,
  RAY_UNIT_SPEED,
  SHADER_STYLES,
  SMOKE_LIMITS,
  SMOKE_UNIT_SPEED,
  nextStop,
  type AmbientIdle,
  type AmbientStop,
  type CanvasAmbient,
  type RaySettings,
  type ShaderStyle,
  type SmokeSettings,
} from './canvasAmbient'
import { Select, type SelectOption } from './ConfigControls'
import { CANVAS_FILLS, DEFAULT_CANVAS_LOOK, type CanvasLook, type CanvasPaint } from './canvasLook'
import { BackgroundSection, ColorField, PercentInput, Slider } from './PaintControls'
import styles from './AppearancePanel.module.css'

const SHADER_GROUPS: Partial<Record<ShaderStyle, string>> = { blobs: 'Colour fields', mesh: 'Colour fields', flow: 'Colour fields', aurora: 'Colour fields', smoke: 'Light', rays: 'Light' }
const SHADER_OPTIONS: readonly SelectOption<ShaderStyle>[] = SHADER_STYLES.map(({ id, label }) => ({ id, label, group: SHADER_GROUPS[id] }))

const percent = (value: number) => `${Math.round(value)}%`
const seconds = (value: number) => `${Number(value.toFixed(1))}s`
const offOr = (label: string) => (value: number) => (value === 0 ? label : percent(value))

type BackdropProps = {
  look: CanvasLook
  onChange: (next: CanvasLook) => void
}

/** The canvas background and the shader over it; shown in both the canvas background and card style panels. */
export function CanvasBackdropSections({ look, onChange }: BackdropProps) {
  const setPaint = (patch: Partial<CanvasPaint>) => onChange({ ...look, paint: { ...look.paint, ...patch, preset: undefined } })
  return (
    <>
      <BackgroundSection
        paint={look.paint}
        onTweak={setPaint}
        fills={CANVAS_FILLS}
        defaultHint="The built-in dark, blurred backdrop. Pick Solid or Gradient to set your own colours."
        action={
          <button type="button" className={styles.applyTrigger} onClick={() => onChange({ ...look, paint: DEFAULT_CANVAS_LOOK.paint })}>
            Reset background
          </button>
        }
      />
      <ShaderSection ambient={look.ambient} onChange={(ambient) => onChange({ ...look, ambient })} />
    </>
  )
}

function ShaderSection({ ambient, onChange }: { ambient: CanvasAmbient; onChange: (next: CanvasAmbient) => void }) {
  const titleId = useId()
  const { style, stops, idle, smoke } = ambient
  const set = (patch: Partial<CanvasAmbient>) => onChange({ ...ambient, ...patch })
  const setIdle = (patch: Partial<AmbientIdle>) => set({ idle: { ...idle, ...patch } })
  const setSmoke = (patch: Partial<SmokeSettings>) => set({ smoke: { ...smoke, ...patch } })
  const setStop = (index: number, patch: Partial<AmbientStop>) => set({ stops: stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)) })
  const removeStop = (index: number) => set({ stops: stops.filter((_, i) => i !== index) })

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          Shader
        </h3>
        <button type="button" className={styles.applyTrigger} onClick={() => onChange({ ...DEFAULT_AMBIENT, run: ambient.run })}>
          Reset shader
        </button>
      </div>
      <Select label="Shader type" value={style} options={SHADER_OPTIONS} onChange={(next) => set({ style: next })} />
      <p className={styles.hint}>{SHADER_STYLES.find((option) => option.id === style)?.hint}</p>

      {style === 'none' ? null : (
        <>
          <div className={styles.colorsBlock}>
            <div className={styles.rowHead}>
              <span>Colors</span>
              <button
                type="button"
                className={styles.textAction}
                disabled={stops.length >= AMBIENT_MAX_STOPS}
                onClick={() => set({ stops: [...stops, nextStop(stops)] })}
              >
                <Plus size={14} weight="bold" aria-hidden />
                Add color
              </button>
            </div>
            <div className={styles.stops}>
              {stops.map((stop, index) => (
                <ColorField key={index} label={`Color ${index + 1}`} color={stop.color} opacity={stop.opacity} onChange={(color) => setStop(index, { color })}>
                  <PercentInput label={`Color ${index + 1} opacity`} value={stop.opacity} onChange={(opacity) => setStop(index, { opacity })} />
                  <button
                    type="button"
                    className={`${styles.iconAction} ${styles.stopRemove}`}
                    aria-label={`Remove color ${index + 1}`}
                    disabled={stops.length <= AMBIENT_MIN_STOPS}
                    onClick={() => removeStop(index)}
                  >
                    <Minus size={14} weight="bold" aria-hidden />
                  </button>
                </ColorField>
              ))}
            </div>
            {(style === 'smoke' || style === 'rays') && stops.length > 4 ? (
              <p className={styles.hint}>The {style === 'smoke' ? 'smoke' : 'light'} uses the first four colours.</p>
            ) : null}
          </div>

          {style === 'rays' ? (
            <RaysControls rays={ambient.rays} onChange={(rays) => set({ rays })} />
          ) : style === 'smoke' ? (
            <>
              <Slider
                label="Intensity"
                value={Math.round(smoke.intensity * 100)}
                min={SMOKE_LIMITS.intensity.min * 100}
                max={SMOKE_LIMITS.intensity.max * 100}
                format={percent}
                onChange={(value) => setSmoke({ intensity: value / 100 })}
              />
              <Slider
                label="Scale"
                value={Math.round(smoke.scale * 100)}
                min={SMOKE_LIMITS.scale.min * 100}
                max={SMOKE_LIMITS.scale.max * 100}
                format={percent}
                onChange={(value) => setSmoke({ scale: value / 100 })}
              />
              <Slider
                label="Speed"
                value={Math.round(smoke.speed * 1000)}
                min={SMOKE_LIMITS.speed.min * 1000}
                max={SMOKE_LIMITS.speed.max * 1000}
                format={(speed) => (speed === 0 ? 'Still' : `${Number((speed / (SMOKE_UNIT_SPEED * 1000)).toFixed(1))}×`)}
                onChange={(speed) => setSmoke({ speed: speed / 1000 })}
              />
            </>
          ) : (
            <>
              <Slider
                label="Intensity"
                value={Math.round(idle.intensity * 100)}
                min={0}
                max={60}
                format={offOr('Hidden')}
                onChange={(value) => setIdle({ intensity: value / 100 })}
              />
              {style !== 'mesh' && (
                <Slider
                  label={style === 'blobs' ? 'Blob size' : 'Scale'}
                  value={Math.round(idle.size * 100)}
                  min={20}
                  max={120}
                  format={percent}
                  onChange={(value) => setIdle({ size: value / 100 })}
                />
              )}
              {(style === 'blobs' || style === 'mesh') && (
                <Slider
                  label={style === 'mesh' ? 'Blend' : 'Softness'}
                  value={Math.round(ambient.softness * 100)}
                  min={0}
                  max={100}
                  format={percent}
                  onChange={(value) => set({ softness: value / 100 })}
                />
              )}
              {style === 'blobs' && (
                <Slider
                  label="Smoothness"
                  value={Math.round(ambient.smoothness * 100)}
                  min={0}
                  max={100}
                  format={percent}
                  onChange={(value) => set({ smoothness: value / 100 })}
                />
              )}
              {style !== 'blobs' && (
                <Slider
                  label="Warp"
                  value={Math.round(ambient.warp * 100)}
                  min={0}
                  max={100}
                  format={offOr('None')}
                  onChange={(value) => set({ warp: value / 100 })}
                />
              )}
              <Slider
                label="Blur"
                value={ambient.blur}
                min={0}
                max={AMBIENT_MAX_BLUR}
                format={(value) => (value === 0 ? 'Off' : `${value}px`)}
                onChange={(blur) => set({ blur })}
              />
              {(style === 'blobs' || style === 'mesh') && (
                <Slider
                  label="Drift"
                  value={Math.round(idle.drift * 100)}
                  min={0}
                  max={40}
                  format={offOr('Still')}
                  onChange={(value) => setIdle({ drift: value / 100 })}
                />
              )}
              <Slider
                label={style === 'blobs' || style === 'mesh' ? 'Drift cycle' : 'Cycle'}
                value={idle.cycleSeconds}
                min={10}
                max={120}
                format={seconds}
                onChange={(cycleSeconds) => setIdle({ cycleSeconds })}
              />
            </>
          )}
        </>
      )}

      <Slider label="Grain" value={Math.round(ambient.grain * 100)} min={0} max={100} format={offOr('Off')} onChange={(value) => set({ grain: value / 100 })} />
      <Slider
        label="Vignette"
        value={Math.round(ambient.vignette * 100)}
        min={0}
        max={100}
        format={offOr('Off')}
        onChange={(value) => set({ vignette: value / 100 })}
      />
      <Slider label="Dither" value={Math.round(ambient.dither * 100)} min={0} max={100} format={offOr('Off')} onChange={(value) => set({ dither: value / 100 })} />
    </section>
  )
}

const RAY_SLIDERS: readonly { group: string; key: keyof RaySettings; label: string; format?: (value: number) => string }[] = [
  { group: 'Light', key: 'intensity', label: 'Intensity' },
  { group: 'Light', key: 'core', label: 'Core', format: offOr('Off') },
  { group: 'Light', key: 'haze', label: 'Haze', format: offOr('Off') },
  { group: 'Shape', key: 'position', label: 'Beam position' },
  { group: 'Shape', key: 'width', label: 'Beam width' },
  { group: 'Shape', key: 'floor', label: 'Floor height', format: offOr('Bottom') },
  { group: 'Shape', key: 'bend', label: 'Bend', format: offOr('Sharp') },
  { group: 'Shape', key: 'reach', label: 'Floor reach', format: offOr('None') },
  {
    group: 'Animation',
    key: 'speed',
    label: 'Speed',
    format: (value) => (value === 0 ? 'Still' : `${Number((value / (RAY_UNIT_SPEED * 100)).toFixed(1))}×`),
  },
  { group: 'Animation', key: 'sway', label: 'Sway', format: offOr('Off') },
  { group: 'Animation', key: 'pulse', label: 'Pulse', format: offOr('Off') },
  { group: 'Animation', key: 'shimmer', label: 'Shimmer', format: offOr('Off') },
]

function RaysControls({ rays, onChange }: { rays: RaySettings; onChange: (next: RaySettings) => void }) {
  return RAY_SLIDERS.map(({ group, key, label, format = percent }, index) => (
    <Fragment key={key}>
      {RAY_SLIDERS[index - 1]?.group === group ? null : (
        <div className={styles.rowHead}>
          <span>{group}</span>
        </div>
      )}
      <Slider
        label={label}
        value={Math.round(rays[key] * 100)}
        min={Math.round(RAY_LIMITS[key].min * 100)}
        max={Math.round(RAY_LIMITS[key].max * 100)}
        format={format}
        onChange={(value) => onChange({ ...rays, [key]: value / 100 })}
      />
    </Fragment>
  ))
}
