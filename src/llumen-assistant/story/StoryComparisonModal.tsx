import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { ConfigSelect } from './StoryConfigSelect'
import { StoryMap } from './StoryMap'
import {
  COMPARISON_SOURCES,
  comparisonPhase,
  matchesComparisonQuery,
  type ComparisonMapOption,
} from './storyComparison'
import styles from './StoryEditPanel.module.css'

const PREVIEW_PADDING = { top: 0, right: 0, bottom: 0, left: 0 }
const PREVIEW_ZOOM_OFFSET = -1.6

export function StoryComparisonModal({
  options,
  initialOptionId,
  framePhase,
  styleUrl,
  onApply,
  onClose,
}: {
  options: ComparisonMapOption[]
  initialOptionId: string
  /** Current point on the shared time series; previews show each option at its own offset. */
  framePhase: number
  styleUrl: string
  onApply: (option: ComparisonMapOption) => void
  onClose: () => void
}) {
  const initial = options.find((option) => option.id === initialOptionId) ?? options[0]
  const [selectedId, setSelectedId] = useState(initial.id)
  const [source, setSource] = useState(initial.source)
  const [query, setQuery] = useState('')
  const visible = options.filter(
    (option) => option.source === source && matchesComparisonQuery(option, query),
  )
  const selected = options.find((option) => option.id === selectedId) ?? initial

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close comparison map" onClick={onClose} />
      <div
        id="comparison-map-modal"
        className={`${styles.panel} ${styles.modal} ${styles.comparisonModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-map-modal-title"
        dir="ltr"
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <div className={styles.headerCopy}>
              <h2 id="comparison-map-modal-title" className={styles.title}>
                Comparison Map
              </h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close comparison map">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.mapStyleIntro}>
          <p className={styles.mapStyleHint}>Choose the map to show in the lower half of the screen</p>
        </div>
        <div className={styles.comparisonToolbar}>
          <ConfigSelect
            label="Comparison map source"
            hideLabel
            value={source}
            options={COMPARISON_SOURCES.map((item) => ({ value: item.id, label: item.label }))}
            onChange={setSource}
          />
          <label className={styles.assetsSearch}>
            <MagnifyingGlass size={20} aria-hidden />
            <input
              value={query}
              placeholder="Search maps..."
              aria-label="Search comparison maps"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.comparisonScroll}>
          <div className={styles.comparisonGrid} role="radiogroup" aria-label="Comparison maps">
            {visible.length === 0 ? (
              <p className={styles.comparisonEmpty}>No maps match “{query.trim()}”</p>
            ) : null}
            {visible.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected.id === option.id}
                className={`${styles.assetCard} ${styles.comparisonCard}${
                  selected.id === option.id ? ` ${styles.assetCardSelected}` : ''
                }`}
                onClick={() => setSelectedId(option.id)}
                onDoubleClick={() => onApply(option)}
              >
                <span className={styles.assetCardClip}>
                  <span className={styles.assetCardImage}>
                    <StoryMap
                      sceneIndex={option.sceneIndex}
                      framePhase={comparisonPhase(framePhase, option)}
                      styleUrl={styleUrl}
                      layers={option.layers}
                      interactive={false}
                      cameraPadding={PREVIEW_PADDING}
                      zoomOffset={PREVIEW_ZOOM_OFFSET}
                    />
                  </span>
                  <span className={styles.assetCardTitle}>
                    <span className={styles.mapStyleCardName}>{option.eyebrow}</span>
                    <span className={styles.mapStyleCardDesc}>{option.title}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <footer className={styles.mapStyleFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.assetsNext} onClick={() => onApply(selected)}>
            Split Screen
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
