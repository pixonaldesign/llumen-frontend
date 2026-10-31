import { useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, CaretDown, Check, X } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { DEFAULT_APPEARANCE, type AppearancePart, type ApplyScope, type NodeAppearance, type NodeInk } from './nodeAppearance'
import { BackgroundSection, PresetSection, Slider } from './PaintControls'
import styles from './AppearancePanel.module.css'

const APPLIED_MESSAGE_MS = 2200

type ApplyKey = 'paint' | 'padding' | 'radius' | 'everything'
const APPLY_PARTS: Record<ApplyKey, readonly AppearancePart[]> = {
  paint: ['paint'],
  padding: ['padding'],
  radius: ['radius'],
  everything: ['paint', 'padding', 'radius'],
}
const APPLY_NAMES: Record<ApplyKey, string> = {
  paint: 'Background',
  padding: 'Padding',
  radius: 'Corner radius',
  everything: 'Appearance',
}

type AppearancePanelProps = {
  nodeName: string
  appearance: NodeAppearance | undefined
  /** The node style's own spacing and corners, shown while the node doesn't override them. */
  defaults: { padding: number; radius: number }
  onChange: (next: NodeAppearance) => void
  onReset: () => void
  /** Node counts for the copy targets; `category` is the node's category title. */
  scope: { category: string; categoryCount: number; allCount: number }
  /** Copies the given parts of this node's look onto the scope; returns how many nodes it covered. */
  onApply: (parts: readonly AppearancePart[], scope: ApplyScope) => number
  onClose: () => void
}

export function AppearancePanel({ nodeName, appearance, defaults, onChange, onReset, scope, onApply, onClose }: AppearancePanelProps) {
  const [applying, setApplying] = useState<ApplyKey | null>(null)
  const [applied, setApplied] = useState<{ key: ApplyKey; text: string } | null>(null)
  const appliedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(appliedTimer.current), [])

  const value = appearance ?? DEFAULT_APPEARANCE
  const activePreset = value.preset ?? (value.fill === 'default' ? 'default' : null)
  const custom = value.fill !== 'default'

  /** Any manual tweak to the paint detaches the node from its preset; spacing doesn't. */
  const tweak = (patch: Partial<NodeAppearance>) => onChange({ ...value, ...patch, preset: undefined })
  const layout = (patch: Partial<NodeAppearance>) => onChange({ ...value, ...patch })

  const apply = (key: ApplyKey, target: ApplyScope) => {
    const count = onApply(APPLY_PARTS[key], target)
    const where = target === 'category' ? `${scope.category} ` : ''
    setApplying(null)
    setApplied({ key, text: `${APPLY_NAMES[key]} applied to ${count} ${where}node${count === 1 ? '' : 's'}` })
    window.clearTimeout(appliedTimer.current)
    appliedTimer.current = window.setTimeout(() => setApplied(null), APPLIED_MESSAGE_MS)
  }

  const applyTrigger = (key: ApplyKey) => (
    <button
      type="button"
      className={styles.applyTrigger}
      aria-expanded={applying === key}
      aria-label={`Apply ${APPLY_NAMES[key].toLowerCase()} to other nodes`}
      onClick={() => setApplying(applying === key ? null : key)}
    >
      Apply to
      <CaretDown size={10} weight="bold" aria-hidden />
    </button>
  )

  const applyChoices = (key: ApplyKey) => {
    if (applied?.key === key) {
      return (
        <p className={styles.applied} role="status">
          <Check size={12} weight="bold" aria-hidden />
          {applied.text}
        </p>
      )
    }
    if (applying !== key) return null
    return (
      <div className={styles.applyChoices} role="group" aria-label={`Apply ${APPLY_NAMES[key].toLowerCase()} to`}>
        <button type="button" className={styles.applyChoice} disabled={scope.categoryCount < 2} onClick={() => apply(key, 'category')}>
          <span className={styles.applyChoiceLabel}>{scope.category}</span>
          <span className={styles.applyCount}>{scope.categoryCount}</span>
        </button>
        <button type="button" className={styles.applyChoice} disabled={scope.allCount < 2} onClick={() => apply(key, 'all')}>
          <span className={styles.applyChoiceLabel}>All nodes</span>
          <span className={styles.applyCount}>{scope.allCount}</span>
        </button>
      </div>
    )
  }

  return (
    <aside className={styles.panel} aria-label="Node appearance">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>Appearance</h2>
          <p className={styles.subtitle} title={nodeName}>
            {nodeName}
          </p>
        </div>
        <button type="button" className={styles.iconAction} aria-label="Close appearance" onClick={onClose}>
          <X size={16} weight="bold" aria-hidden />
        </button>
      </header>

      <div className={styles.scroll} data-native-scroll>
        <PresetSection activeId={activePreset} onPick={(preset) => onChange({ ...value, ...preset.paint, preset: preset.id })} />

        <BackgroundSection
          paint={value}
          onTweak={tweak}
          defaultHint="Uses the node style’s own surface. Pick a type or preset to customise it."
          action={applyTrigger('paint')}
          notice={applyChoices('paint')}
        />

        {custom ? (
          <section className={styles.section} aria-labelledby="appearance-text">
            <h3 id="appearance-text" className={styles.sectionTitle}>
              Text
            </h3>
            <div className={controls.segmented} role="radiogroup" aria-label="Text colour">
              {(['light', 'dark'] as const satisfies readonly NodeInk[]).map((ink) => (
                <button
                  key={ink}
                  type="button"
                  role="radio"
                  aria-checked={value.ink === ink}
                  className={`${controls.segment}${value.ink === ink ? ` ${controls.segmentActive}` : ''}`}
                  onClick={() => tweak({ ink })}
                >
                  <span className={ink === 'light' ? styles.inkDotLight : styles.inkDotDark} aria-hidden />
                  {ink === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="appearance-layout">
          <h3 id="appearance-layout" className={styles.sectionTitle}>
            Layout
          </h3>
          <Slider
            label="Padding"
            value={value.padding ?? defaults.padding}
            min={8}
            max={40}
            format={(px) => `${px}px`}
            onChange={(padding) => layout({ padding })}
            action={applyTrigger('padding')}
          >
            {applyChoices('padding')}
          </Slider>
          <Slider
            label="Corner radius"
            value={value.radius ?? defaults.radius}
            min={0}
            max={32}
            format={(px) => `${px}px`}
            onChange={(radius) => layout({ radius })}
            action={applyTrigger('radius')}
          >
            {applyChoices('radius')}
          </Slider>
        </section>
      </div>

      <footer className={styles.foot}>
        <div className={styles.footRow}>
          <button type="button" className={styles.footButton} onClick={onReset} disabled={!appearance}>
            <ArrowsClockwise size={14} weight="bold" aria-hidden />
            Reset
          </button>
          <button
            type="button"
            className={`${styles.footButton} ${styles.footButtonPrimary}`}
            aria-expanded={applying === 'everything'}
            onClick={() => setApplying(applying === 'everything' ? null : 'everything')}
          >
            Apply all to
            <CaretDown size={12} weight="bold" aria-hidden />
          </button>
        </div>
        {applyChoices('everything')}
      </footer>
    </aside>
  )
}
