import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { ConfigSelect } from './StoryConfigSelect'
import styles from './StoryEditPanel.module.css'

export type MapLayerConfig = { title: string; opacity: number }

const OPACITY_OPTIONS = [
  { value: '1', label: '100%' },
  { value: '0.75', label: '75%' },
  { value: '0.5', label: '50%' },
  { value: '0.25', label: '25%' },
]

export function StoryLayerConfigModal({
  initial,
  onSave,
  onClose,
}: {
  initial: MapLayerConfig
  onSave: (config: MapLayerConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close map layer settings" onClick={onClose} />
      <div
        id="layer-config-modal"
        className={`${styles.panel} ${styles.modal} ${styles.cardConfigModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layer-config-modal-title"
        dir="ltr"
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerCopy}>
              <h2 id="layer-config-modal-title" className={styles.title}>
                Configure Map Layer
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close map layer settings">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.scroll}>
          <section className={styles.section}>
            <div className={styles.cardConfigFields}>
              <label className={styles.field}>
                <span className={styles.label}>Layer name</span>
                <input
                  className={styles.input}
                  value={draft.title}
                  maxLength={60}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <ConfigSelect
                label="Opacity"
                value={String(draft.opacity)}
                options={OPACITY_OPTIONS}
                onChange={(value) => setDraft((current) => ({ ...current, opacity: Number(value) }))}
              />
            </div>
          </section>
        </div>

        <footer className={styles.mapStyleFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.assetsNext}
            onClick={() => onSave({ ...draft, title: draft.title.trim() || initial.title })}
          >
            Save
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
