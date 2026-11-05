import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown, Check } from '@phosphor-icons/react'
import styles from '../story/StoryView.module.css'
import { INVENTORY_FILTERS, type InventoryFilterId, type InventoryPicks } from './gamiInventory'
import story from './GamiStory.module.css'
import css from './GamiInventoryTable.module.css'

const MENU_ITEM = 40

type Menu = { filter: InventoryFilterId; top: number; left: number }

/** The inventory page's Source, Domain, Origin and Status pills, each with its menu of options. */
export function GamiInventoryFilters({
  picks,
  onPick,
}: {
  picks: InventoryPicks
  onPick: (filter: InventoryFilterId, value: string | undefined) => void
}) {
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

  const openFilter = menu ? INVENTORY_FILTERS.find((filter) => filter.id === menu.filter)! : null

  const toggleMenu = (filter: InventoryFilterId, button: HTMLElement) => {
    if (menu?.filter === filter) return setMenu(null)
    const options = INVENTORY_FILTERS.find((item) => item.id === filter)!.options.length + 1
    const rect = button.getBoundingClientRect()
    const height = Math.min(options * MENU_ITEM + 8, 360)
    const below = rect.bottom + 6
    setMenu({
      filter,
      top: below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 6 - height) : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 208)),
    })
  }

  return (
    <>
      {INVENTORY_FILTERS.map((filter) => {
        const value = picks[filter.id]
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
                const selected = picks[openFilter.id] === option
                return (
                  <button
                    key={option ?? 'all'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={selected ? styles.storyMenuSelected : undefined}
                    onClick={() => {
                      onPick(openFilter.id, option)
                      setMenu(null)
                    }}
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
    </>
  )
}
