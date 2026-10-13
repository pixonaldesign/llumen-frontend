import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Info, X } from '@phosphor-icons/react'
import { ConfigSelect } from './StoryConfigSelect'
import {
  KPI_CALCULATIONS,
  KPI_FIELDS,
  KPI_MAX_SOURCES,
  KPI_SOURCES,
  KPI_UNIT_SOURCES,
  type ChartKpiConfig,
} from './storyKpi'
import styles from './StoryEditPanel.module.css'

const FIELD_OPTIONS = KPI_FIELDS.map((field) => ({ value: field.id, label: field.label }))

export function StoryCardConfigModal({
  initial,
  onSave,
  onClose,
}: {
  initial: ChartKpiConfig
  onSave: (config: ChartKpiConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const patch = <K extends keyof ChartKpiConfig>(key: K, value: ChartKpiConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const mapped = draft.source === 'mapped'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close chart card settings" onClick={onClose} />
      <div
        id="card-config-modal"
        className={`${styles.panel} ${styles.modal} ${styles.cardConfigModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-config-modal-title"
        dir="ltr"
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerCopy}>
              <h2 id="card-config-modal-title" className={styles.title}>
                Configure Chart Card
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close chart card settings">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.scroll}>
          <section className={styles.section}>
            <p className={styles.cardConfigNote}>
              <Info size={16} weight="regular" aria-hidden />
              Configure the slide-specific KPI shown above this chart. Use mapped data for live
              values, or manual text for cards such as 10/100 Zones.
            </p>

            <label className={styles.checkboxRow}>
              <input
                className={styles.checkboxInput}
                type="checkbox"
                checked={draft.show}
                onChange={(event) => patch('show', event.target.checked)}
              />
              <span className={styles.checkboxBox} aria-hidden>
                <Check size={12} weight="bold" />
              </span>
              Show KPI line
            </label>

            <fieldset className={styles.cardConfigFields} disabled={!draft.show}>
              <ConfigSelect
                label="KPI source"
                value={draft.source}
                options={KPI_SOURCES}
                onChange={(value) => patch('source', value)}
              />
              {mapped ? (
                <>
                  <ConfigSelect
                    label="Value field"
                    value={draft.field}
                    options={FIELD_OPTIONS}
                    onChange={(value) => patch('field', value)}
                  />
                  <ConfigSelect
                    label="Value calculation"
                    value={draft.calculation}
                    options={KPI_CALCULATIONS}
                    onChange={(value) => patch('calculation', value)}
                  />
                  <ConfigSelect
                    label="Unit source"
                    value={draft.unitSource}
                    options={KPI_UNIT_SOURCES}
                    onChange={(value) => patch('unitSource', value)}
                  />
                  {draft.unitSource === 'custom' ? (
                    <label className={styles.field}>
                      <span className={styles.label}>Unit</span>
                      <input
                        className={styles.input}
                        value={draft.unit}
                        maxLength={24}
                        placeholder="e.g. Zones"
                        onChange={(event) => patch('unit', event.target.value)}
                      />
                    </label>
                  ) : null}
                  <ConfigSelect
                    label="Max value source"
                    value={draft.maxSource}
                    options={KPI_MAX_SOURCES}
                    onChange={(value) => patch('maxSource', value)}
                  />
                  {draft.maxSource === 'field' ? (
                    <ConfigSelect
                      label="Max value field"
                      value={draft.maxField}
                      options={FIELD_OPTIONS}
                      onChange={(value) => patch('maxField', value)}
                    />
                  ) : null}
                  {draft.maxSource === 'custom' ? (
                    <label className={styles.field}>
                      <span className={styles.label}>Max value</span>
                      <input
                        className={styles.input}
                        value={draft.maxValue}
                        maxLength={24}
                        placeholder="e.g. 100"
                        onChange={(event) => patch('maxValue', event.target.value)}
                      />
                    </label>
                  ) : null}
                </>
              ) : (
                <label className={styles.field}>
                  <span className={styles.label}>KPI text</span>
                  <input
                    className={styles.input}
                    value={draft.manualText}
                    maxLength={40}
                    placeholder="e.g. 10/100 Zones"
                    onChange={(event) => patch('manualText', event.target.value)}
                  />
                </label>
              )}
            </fieldset>
          </section>
        </div>

        <footer className={styles.mapStyleFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.assetsNext} onClick={() => onSave(draft)}>
            Save
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
