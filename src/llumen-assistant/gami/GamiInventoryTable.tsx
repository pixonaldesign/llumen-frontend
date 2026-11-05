import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, CaretDown, Check, Info, MagnifyingGlass, X } from '@phosphor-icons/react'
import styles from '../story/StoryView.module.css'
import {
  PRODUCT_COUNTRIES,
  PRODUCT_DOMAINS,
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  PRODUCTS,
  productValue,
  sar,
  type Product,
} from './gamiInventory'
import { STATUS } from './gamiTypes'
import story from './GamiStory.module.css'
import css from './GamiInventoryTable.module.css'

export type ProductInfo = (id: string) => void

type FilterId = 'source' | 'domain' | 'country' | 'status'

const FILTERS: { id: FilterId; label: string; all: string; options: readonly string[] }[] = [
  { id: 'source', label: 'Source', all: 'Local and imported', options: ['Local', 'Imported'] },
  { id: 'domain', label: 'Domain', all: 'All domains', options: PRODUCT_DOMAINS },
  { id: 'country', label: 'Origin', all: 'All countries', options: PRODUCT_COUNTRIES },
  { id: 'status', label: 'Status', all: 'Any status', options: PRODUCT_STATUSES },
]

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

const MENU_ITEM = 40

type Menu = { filter: FilterId; top: number; left: number }

/** The inventory app's 100 products: search, four filters and sortable columns; the first ten open their details. */
export function GamiInventoryTable({ onInfo }: { onInfo?: ProductInfo }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Partial<Record<FilterId, string>>>({})
  const [sort, setSort] = useState<{ id: SortId; desc: boolean } | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (menuRef.current?.contains(target) || target.closest('[data-inventory-filter]')) return
      setMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    const close = () => setMenu(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [menu])

  const rows = useMemo(() => {
    const words = query.trim().toLowerCase()
    const shown = PRODUCTS.filter(
      (product) =>
        (!words || `${product.name} ${product.type} ${product.maker} ${product.country}`.toLowerCase().includes(words)) &&
        FILTERS.every(({ id }) => !picked[id] || product[id] === picked[id]),
    )
    if (!sort) return shown
    return [...shown].sort((a, b) => {
      const x = sortValue(a, sort.id)
      const y = sortValue(b, sort.id)
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.desc ? -order : order
    })
  }, [query, picked, sort])

  const filtered = Boolean(query) || Object.values(picked).some(Boolean)
  const openFilter = menu ? FILTERS.find((filter) => filter.id === menu.filter)! : null

  const toggleMenu = (filter: FilterId, button: HTMLElement) => {
    if (menu?.filter === filter) return setMenu(null)
    const options = FILTERS.find((item) => item.id === filter)!.options.length + 1
    const rect = button.getBoundingClientRect()
    const height = Math.min(options * MENU_ITEM + 8, 360)
    const below = rect.bottom + 6
    setMenu({
      filter,
      top: below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 6 - height) : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 208)),
    })
  }

  const pick = (filter: FilterId, value: string | undefined) => {
    setPicked((current) => ({ ...current, [filter]: value }))
    setMenu(null)
  }

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
        {FILTERS.map((filter) => {
          const value = picked[filter.id]
          const open = menu?.filter === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              data-inventory-filter
              className={`${styles.filterPill} ${story.filterButton}${open ? ` ${story.filterButtonOpen}` : ''}${value ? ` ${css.filterSet}` : ''}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(event) => toggleMenu(filter.id, event.currentTarget)}
            >
              <span className={css.filterLabel}>{filter.label}</span>
              <span>{value ?? 'All'}</span>
              <CaretDown className={story.filterButtonCaret} size={14} weight="bold" aria-hidden />
            </button>
          )
        })}
        <span className={css.count} aria-live="polite">
          Showing {rows.length} of {PRODUCTS.length}
        </span>
        {filtered ? (
          <button
            type="button"
            className={css.clear}
            onClick={() => {
              setQuery('')
              setPicked({})
            }}
          >
            <X size={14} weight="bold" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>

      <div className={css.scroll}>
        <div className={css.table} role="table" aria-label="Product inventory" aria-rowcount={rows.length}>
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
            <span role="columnheader" aria-label="Details" />
          </div>
          {rows.map((product) => (
            <div key={product.id} className={css.row} role="row">
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
              <span role="cell">
                {product.detail ? (
                  <button type="button" className={css.info} aria-label={`${product.name} details`} onClick={() => onInfo?.(product.id)}>
                    <Info size={16} weight="regular" aria-hidden />
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          {rows.length === 0 ? <p className={css.empty}>No products match these filters.</p> : null}
        </div>
      </div>

      {menu && openFilter
        ? createPortal(
            <div
              ref={menuRef}
              className={`${styles.storyMenu} ${css.menu}`}
              role="menu"
              aria-label={openFilter.label}
              style={{ top: menu.top, left: menu.left }}
            >
              {[undefined, ...openFilter.options].map((option) => {
                const selected = picked[openFilter.id] === option
                return (
                  <button
                    key={option ?? 'all'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={selected ? styles.storyMenuSelected : undefined}
                    onClick={() => pick(openFilter.id, option)}
                  >
                    {option ?? openFilter.all}
                    {selected ? <Check className={styles.storyMenuCheck} size={14} weight="bold" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
