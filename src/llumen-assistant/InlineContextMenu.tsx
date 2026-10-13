import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useRef, type RefObject } from 'react'
import styles from './compact-assistant.module.css'
import type {
  InlineContextCategory,
  InlineContextCategoryId,
  InlineContextItem,
} from './inlineContextData'
import { getCategory } from './inlineContextData'

export type InlineContextMenuPosition = {
  left: number
  /** Prefer for menus anchored above a point (composer caret). */
  bottom?: number
  /** Prefer for menus anchored below a control (panel + button). */
  top?: number
}

export type InlineContextMenuStage = 'categories' | 'items'

export type InlineContextMenuSearch = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
}

export type InlineContextMenuProps = {
  menuRef: RefObject<HTMLDivElement | null>
  position: InlineContextMenuPosition
  stage: InlineContextMenuStage
  categoryId: InlineContextCategoryId | null
  categories: InlineContextCategory[]
  items: InlineContextItem[]
  activeIndex: number
  query: string
  onHoverIndex: (index: number) => void
  onSelectCategory: (id: InlineContextCategoryId) => void
  onSelectItem: (item: InlineContextItem) => void
  onBack: () => void
  /** When set, shows a search field at the top of the menu (e.g. Sources panel +). */
  search?: InlineContextMenuSearch
}

export function InlineContextMenu({
  menuRef,
  position,
  stage,
  categoryId,
  categories,
  items,
  activeIndex,
  query,
  onHoverIndex,
  onSelectCategory,
  onSelectItem,
  onBack,
  search,
}: InlineContextMenuProps) {
  const category = categoryId ? getCategory(categoryId) : null
  const empty = stage === 'categories' ? categories.length === 0 : items.length === 0
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, stage, categoryId])

  useEffect(() => {
    if (!search) return
    const id = window.requestAnimationFrame(() => search.inputRef?.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [search, stage, categoryId])

  return (
    <div
      ref={menuRef}
      className={styles.inlineContextMenu}
      style={{
        left: position.left,
        ...(position.top != null ? { top: position.top, bottom: 'auto' } : null),
        ...(position.bottom != null ? { bottom: position.bottom } : null),
      }}
      role="listbox"
      aria-label={stage === 'categories' ? 'Add inline context' : `${category?.label ?? 'Context'} items`}
      data-lc-inline-context-menu
    >
      {search ? (
        <div className={styles.inlineContextMenuSearch}>
          <MagnifyingGlass
            className={styles.inlineContextMenuSearchIcon}
            size={16}
            weight="regular"
            aria-hidden
          />
          <input
            ref={search.inputRef}
            type="search"
            className={styles.inlineContextMenuSearchInput}
            value={search.value}
            placeholder={search.placeholder ?? 'Search…'}
            aria-label={search.placeholder ?? 'Search'}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              // Keep typing from bubbling into the composer / panel.
              e.stopPropagation()
            }}
          />
        </div>
      ) : null}

      {stage === 'items' && category ? (
        <div className={styles.inlineContextMenuHeader}>
          <button
            type="button"
            className={styles.inlineContextMenuBack}
            onClick={onBack}
            aria-label="Back to categories"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden />
          </button>
          <category.Icon className={styles.inlineContextMenuHeaderIcon} size={14} weight="regular" aria-hidden />
          <span className={styles.inlineContextMenuHeaderLabel}>{category.label}</span>
        </div>
      ) : !search ? (
        <p className={styles.inlineContextMenuSection}>Add context</p>
      ) : null}

      {empty ? (
        <p className={styles.inlineContextMenuEmpty}>
          {query.trim() ? `No matches for “${query.trim()}”` : 'Nothing here yet'}
        </p>
      ) : stage === 'categories' ? (
        categories.map((item, index) => (
          <button
            key={item.id}
            ref={index === activeIndex ? activeRef : null}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`${styles.inlineContextMenuItem}${
              index === activeIndex ? ` ${styles.inlineContextMenuItemActive}` : ''
            }`}
            onMouseEnter={() => onHoverIndex(index)}
            onClick={() => onSelectCategory(item.id)}
          >
            <item.Icon className={styles.inlineContextMenuIcon} size={16} weight="regular" aria-hidden />
            <span className={styles.inlineContextMenuItemLabel}>{item.label}</span>
          </button>
        ))
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
            ref={index === activeIndex ? activeRef : null}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`${styles.inlineContextMenuItem}${
              index === activeIndex ? ` ${styles.inlineContextMenuItemActive}` : ''
            }`}
            onMouseEnter={() => onHoverIndex(index)}
            onClick={() => onSelectItem(item)}
          >
            <span className={styles.inlineContextMenuItemText}>
              <span className={styles.inlineContextMenuItemLabel}>{item.name}</span>
              {item.description ? (
                <span className={styles.inlineContextMenuItemDesc}>{item.description}</span>
              ) : null}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
