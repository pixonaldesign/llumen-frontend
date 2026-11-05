import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, MagnifyingGlass, X } from '@phosphor-icons/react'
import styles from '../story/StoryView.module.css'
import {
  matchesPicks,
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  PRODUCTS,
  productValue,
  sar,
  type InventoryPicks,
  type Product,
} from './gamiInventory'
import { STATUS } from './gamiTypes'
import css from './GamiInventoryTable.module.css'

export type ProductInfo = (id: string) => void

/** The story's inventory filters, picked in its filter row and cleared from the listing. */
export type InventoryControls = { picks: InventoryPicks; onClear: () => void }

type SortId = 'name' | 'domain' | 'source' | 'country' | 'maker' | 'units' | 'value' | 'readiness' | 'lead' | 'status'

const COLUMNS: { id: SortId; label: string; numeric?: boolean }[] = [
  { id: 'name', label: 'Product' },
  { id: 'domain', label: 'Domain' },
  { id: 'source', label: 'Source' },
  { id: 'country', label: 'Origin' },
  { id: 'maker', label: 'Maker' },
  { id: 'units', label: 'In stock', numeric: true },
  { id: 'value', label: 'Value', numeric: true },
  { id: 'readiness', label: 'Readiness', numeric: true },
  { id: 'lead', label: 'Lead time', numeric: true },
  { id: 'status', label: 'Status' },
]

const sortValue = (product: Product, id: SortId): string | number =>
  id === 'value' ? productValue(product) : id === 'status' ? PRODUCT_STATUSES.indexOf(product.status) : product[id]

/** The inventory app's 100 products: search and sortable columns under the story's filters; the first ten rows open their details. */
export function GamiInventoryTable({ onInfo, controls }: { onInfo?: ProductInfo; controls?: InventoryControls }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ id: SortId; desc: boolean } | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const picked = controls?.picks

  const rows = useMemo(() => {
    const words = query.trim().toLowerCase()
    const shown = PRODUCTS.filter(
      (product) =>
        (!words || `${product.name} ${product.type} ${product.maker} ${product.country}`.toLowerCase().includes(words)) &&
        matchesPicks(product, picked ?? {}),
    )
    if (!sort) return shown
    return [...shown].sort((a, b) => {
      const x = sortValue(a, sort.id)
      const y = sortValue(b, sort.id)
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.desc ? -order : order
    })
  }, [query, picked, sort])

  const filtered = Boolean(query) || Object.values(picked ?? {}).some(Boolean)

  const toggleSort = (id: SortId, numeric = false) =>
    setSort((current) =>
      current?.id !== id ? { id, desc: numeric } : current.desc === numeric ? { id, desc: !numeric } : null,
    )

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <label className={`${styles.filterPill} ${css.search}`}>
          <MagnifyingGlass size={16} weight="regular" aria-hidden />
          <input
            type="search"
            value={query}
            placeholder="Search products, makers"
            aria-label="Search products"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className={css.count} aria-live="polite">
          Showing {rows.length} of {PRODUCTS.length}
        </span>
        {filtered ? (
          <button
            type="button"
            className={css.clear}
            onClick={() => {
              setQuery('')
              controls?.onClear()
            }}
          >
            <X size={14} weight="bold" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>

      <div className={css.frame} role="table" aria-label="Product inventory" aria-rowcount={rows.length}>
        <div ref={headRef} className={css.headScroll}>
          <div className={css.table} role="rowgroup">
            <div className={css.head} role="row">
              {COLUMNS.map((column) => {
                const active = sort?.id === column.id
                return (
                  <span key={column.id} role="columnheader" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                    <button
                      type="button"
                      className={`${css.sort}${column.numeric ? ` ${css.numeric}` : ''}${active ? ` ${css.sortActive}` : ''}`}
                      onClick={() => toggleSort(column.id, column.numeric)}
                    >
                      {column.label}
                      {active ? sort.desc ? <ArrowDown size={12} weight="bold" aria-hidden /> : <ArrowUp size={12} weight="bold" aria-hidden /> : null}
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
        <div
          className={css.scroll}
          onScroll={(event) => {
            if (headRef.current) headRef.current.scrollLeft = event.currentTarget.scrollLeft
          }}
        >
          <div className={css.table} role="rowgroup">
            {rows.map((product) => (
              <div
                key={product.id}
                className={product.detail ? `${css.row} ${css.rowOpen}` : css.row}
                role="row"
                {...(product.detail
                  ? {
                      tabIndex: 0,
                      'aria-label': `${product.name}, open details`,
                      onClick: () => onInfo?.(product.id),
                      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        onInfo?.(product.id)
                      },
                    }
                  : {})}
              >
                <span role="cell" className={css.product}>
                  <b>{product.name}</b>
                  <small>{product.type}</small>
                </span>
                <span role="cell">{product.domain}</span>
                <span role="cell">
                  <span className={product.source === 'Local' ? css.local : css.imported}>{product.source}</span>
                </span>
                <span role="cell">{product.country}</span>
                <span role="cell" className={css.maker}>
                  {product.maker}
                </span>
                <span role="cell" className={css.numeric}>
                  {product.units.toLocaleString('en-US')}
                </span>
                <span role="cell" className={css.numeric}>
                  {sar(productValue(product))}
                </span>
                <span role="cell" className={css.readiness}>
                  <i aria-hidden>
                    <i
                      style={{
                        width: `${product.readiness}%`,
                        background: product.readiness < 80 ? STATUS.moderate : 'rgba(255, 255, 255, 0.56)',
                      }}
                    />
                  </i>
                  {product.readiness}%
                </span>
                <span role="cell" className={css.numeric}>
                  {product.status === 'Cut off' ? '—' : `${product.lead} mo`}
                </span>
                <span role="cell" className={css.status}>
                  <i style={{ background: STATUS[PRODUCT_STATUS[product.status]] }} aria-hidden />
                  {product.status}
                </span>
              </div>
            ))}
            {rows.length === 0 ? <p className={css.empty}>No products match these filters.</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
