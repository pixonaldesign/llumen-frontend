import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { ColorPicker } from './StoryColorPicker'
import { ConfigSelect } from './StoryConfigSelect'
import type { StorySlide } from './storyDemoData'
import {
  SUMMARY_SCOPES,
  gradientVars,
  type SummaryConfig,
  type SummaryGradient,
} from './storySummary'
import gradientStyles from './storyGradientBorder.module.css'
import styles from './StoryEditPanel.module.css'

export function StorySummaryConfigModal({
  initial,
  slides,
  currentSlideId,
  onSave,
  onClose,
}: {
  initial: SummaryConfig
  slides: StorySlide[]
  currentSlideId: string
  onSave: (config: SummaryConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const patch = <K extends keyof SummaryConfig>(key: K, value: SummaryConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const slideOptions = slides.map((item) => ({
    value: item.id,
    label: item.id === currentSlideId ? `${item.title} (Current Slide)` : item.title,
  }))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close summary settings" onClick={onClose} />
      <div
        id="summary-config-modal"
        className={`${styles.panel} ${styles.modal} ${styles.cardConfigModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-config-modal-title"
        dir="ltr"
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerCopy}>
              <h2 id="summary-config-modal-title" className={styles.title}>
                Configure Executive Summary
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close summary settings">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.scroll}>
          <section className={styles.section}>
            <ConfigSelect
              label="Context Scope"
              value={draft.scope}
              options={SUMMARY_SCOPES}
              onChange={(value) => patch('scope', value)}
            />
            {draft.scope === 'slide' && slideOptions.length > 0 ? (
              <ConfigSelect
                label="Target Slide"
                value={draft.slideId}
                options={slideOptions}
                onChange={(value) => patch('slideId', value)}
              />
            ) : null}

            <div className={styles.settingGroup}>
              <span className={styles.label}>Accent color (AI highlights)</span>
              <ColorPicker
                label="Accent color"
                value={draft.accent}
                variant="swatch"
                onChange={(value) => patch('accent', value)}
              />
              <p className={styles.settingHelp}>
                The model uses this color only for colored emphasis in the summary. Font sizes stay
                fixed.
              </p>
            </div>

            <div className={styles.settingGroup}>
              <span className={styles.label}>Border gradient</span>
              <div
                className={`${styles.gradientPreview} ${gradientStyles.gradientBorder}`}
                style={gradientVars(draft.gradient)}
                aria-hidden
              />
              <div className={styles.colorChipGrid}>
                {draft.gradient.map((color, index) => (
                  <ColorPicker
                    key={index}
                    label={`Color ${index + 1}`}
                    value={color}
                    variant="chip"
                    onChange={(value) =>
                      setDraft((current) => {
                        const gradient = [...current.gradient] as SummaryGradient
                        gradient[index] = value
                        return { ...current, gradient }
                      })
                    }
                  />
                ))}
              </div>
              <p className={styles.settingHelp}>
                These colors drive the animated executive summary border only.
              </p>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Custom Prompt (optional)</span>
              <textarea
                className={styles.textarea}
                rows={3}
                maxLength={1000}
                value={draft.prompt}
                placeholder="Leave blank to use the default summarisation prompt."
                onChange={(event) => patch('prompt', event.target.value)}
              />
            </label>

            <div className={styles.settingGroup}>
              <div className={styles.toggleSetting}>
                <span className={styles.label}>Regenerate automatically on save</span>
                <button
                  type="button"
                  role="switch"
                  className={`${styles.switch}${draft.autoRegenerate ? ` ${styles.switchOn}` : ''}`}
                  aria-checked={draft.autoRegenerate}
                  aria-label="Regenerate automatically on save"
                  onClick={() => patch('autoRegenerate', !draft.autoRegenerate)}
                >
                  <span className={styles.switchThumb} />
                </button>
              </div>
              <p className={styles.settingHelp}>
                When on, the summary regenerates every time the slide is saved.
              </p>
            </div>
          </section>
        </div>

        <footer className={styles.mapStyleFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.assetsNext} onClick={() => onSave(draft)}>
            Save Settings
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
