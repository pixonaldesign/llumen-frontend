import { useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MagnifyingGlass, X } from '@phosphor-icons/react'
import { AssetVisual } from './AssetVisual'
import { buttonClass, PopoverLayer } from './configStyles'
import { SAVED_ASSETS, assetSettings, previewOf } from './flowData'
import { plural } from './kindEditor'
import { Segmented } from './KindControls'
import type { AssetPreview } from './nodeCatalog'
import dialogStyles from './NodeDataDialog.module.css'
import styles from './AssetPicker.module.css'

type Category = 'all' | AssetPreview

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'chart', label: 'Charts' },
  { id: 'map', label: 'Maps' },
  { id: 'table', label: 'Tables' },
]

type AssetPickerProps = {
  value?: string
  onPick: (assetId: string) => void
  onClose: () => void
}

/** Picks one saved asset, drawn as it will look on the canvas. Opens over the config window. */
export function AssetPicker({ value, onPick, onClose }: AssetPickerProps) {
  const layer = useContext(PopoverLayer)
  const titleId = useId()
  const [category, setCategory] = useState<Category>('all')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState(value)
  const closeRef = useRef(onClose)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    searchRef.current?.focus()
    // Capture phase, so the config window under the picker doesn't take the Escape too.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      opener?.focus()
    }
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = SAVED_ASSETS.filter(
    (asset) =>
      (category === 'all' || previewOf(asset.view.chartType) === category) && (!needle || `${asset.name} ${asset.detail}`.toLowerCase().includes(needle)),
  )

  if (!layer) return null
  return createPortal(
    <div
      className={styles.scrim}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Choose an asset
          </h2>
          <button type="button" className={dialogStyles.close} aria-label="Close" onClick={onClose}>
            <X size={14} weight="bold" aria-hidden />
          </button>
        </header>
        <div className={styles.controls}>
          <div className={styles.filter}>
            <Segmented label="Asset type" value={category} options={CATEGORIES} onChange={setCategory} />
          </div>
          <label className={`${dialogStyles.search} ${styles.search}`}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              ref={searchRef}
              className={dialogStyles.searchInput}
              type="search"
              value={query}
              placeholder="Search assets"
              aria-label="Search assets"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.scroll} data-native-scroll>
          {shown.length ? (
            <div className={styles.grid} role="group" aria-label="Assets">
              {shown.map((asset) => {
                const selected = asset.id === chosen
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={styles.tile}
                    aria-pressed={selected}
                    onClick={() => setChosen(asset.id)}
                    onDoubleClick={() => onPick(asset.id)}
                  >
                    <AssetVisual settings={assetSettings(asset)} rows={asset.rows} size="tile" maxRows={4} />
                    <span className={styles.caption}>
                      <span className={styles.name}>{asset.name}</span>
                      <span className={styles.meta}>
                        <span className={styles.metaText}>
                          {asset.detail} · {plural(asset.rows.length, 'row')}
                        </span>
                        {asset.archived ? <span className={styles.archived}>Archived</span> : null}
                      </span>
                    </span>
                    {selected ? (
                      <span className={styles.check} aria-hidden>
                        <Check size={12} weight="bold" />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className={styles.none}>{needle ? `No assets match “${query.trim()}”.` : 'No assets of this type yet.'}</p>
          )}
        </div>
        <footer className={styles.foot}>
          <span className={styles.hint}>Double-click an asset to use it right away.</span>
          <button type="button" className={buttonClass()} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={buttonClass('primary')} disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            Use asset
          </button>
        </footer>
      </div>
    </div>,
    layer,
  )
}
