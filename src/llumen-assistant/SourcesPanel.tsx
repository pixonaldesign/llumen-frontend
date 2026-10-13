import { Plus, Trash, X } from '@phosphor-icons/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { ConversationSource } from './conversationSources'
import {
  filterCategories,
  filterItems,
  getCategoryIcon,
  type InlineContextCategoryId,
  type InlineContextItem,
} from './inlineContextData'
import {
  InlineContextMenu,
  type InlineContextMenuPosition,
  type InlineContextMenuStage,
} from './InlineContextMenu'
import styles from './SourcesPanel.module.css'

export type SourcesListProps = {
  sources: ConversationSource[]
  onRemove: (id: string) => void
  variant?: 'panel' | 'popup'
  className?: string
}

export function SourcesList({ sources, onRemove, variant = 'panel', className }: SourcesListProps) {
  if (sources.length === 0) {
    return <p className={styles.empty}>No sources in this conversation.</p>
  }

  return (
    <ul
      className={[styles.list, variant === 'popup' ? styles.popupList : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label="Conversation sources"
    >
      {sources.map((source) => {
        const Icon = getCategoryIcon(source.categoryId)
        return (
          <li key={source.id} className={styles.row}>
            <span className={styles.rowIcon} aria-hidden>
              <Icon size={18} weight="regular" />
            </span>
            <span className={styles.rowLabel} title={source.label}>
              {source.label}
            </span>
            <button
              type="button"
              className={styles.rowRemove}
              aria-label={`Remove ${source.label}`}
              onClick={(e) => {
                e.stopPropagation()
                onRemove(source.id)
              }}
            >
              <Trash size={14} weight="regular" aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

type AddContextMenuState = {
  stage: InlineContextMenuStage
  categoryId: InlineContextCategoryId | null
  query: string
  activeIndex: number
  position: InlineContextMenuPosition
}

function useAddContextMenu({
  existingIds,
  onAdd,
}: {
  existingIds: Set<string>
  onAdd?: (item: InlineContextItem) => void
}) {
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<AddContextMenuState | null>(null)

  const filteredCategories = useMemo(
    () => filterCategories(menu?.query ?? ''),
    [menu?.query],
  )
  const filteredItems = useMemo(() => {
    if (!menu?.categoryId) return []
    return filterItems(menu.categoryId, menu.query).filter((item) => !existingIds.has(item.id))
  }, [menu?.categoryId, menu?.query, existingIds])

  const closeMenu = useCallback(() => setMenu(null), [])

  const toggleMenu = useCallback(() => {
    setMenu((prev) => {
      if (prev) return null
      const btn = addBtnRef.current
      if (!btn || !onAdd) return null
      const rect = btn.getBoundingClientRect()
      const width = Math.min(280, window.innerWidth - 24)
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
      return {
        stage: 'categories',
        categoryId: null,
        query: '',
        activeIndex: 0,
        position: {
          left,
          top: Math.min(rect.bottom + 8, window.innerHeight - 80),
        },
      }
    })
  }, [onAdd])

  useEffect(() => {
    if (!menu) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || addBtnRef.current?.contains(target)) return
      closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, closeMenu])

  const onSelectCategory = useCallback((id: InlineContextCategoryId) => {
    setMenu((prev) =>
      prev
        ? {
            ...prev,
            stage: 'items',
            categoryId: id,
            query: '',
            activeIndex: 0,
          }
        : prev,
    )
  }, [])

  const onSelectItem = useCallback(
    (item: InlineContextItem) => {
      onAdd?.(item)
      closeMenu()
    },
    [onAdd, closeMenu],
  )

  const onBack = useCallback(() => {
    setMenu((prev) =>
      prev
        ? {
            ...prev,
            stage: 'categories',
            categoryId: null,
            query: '',
            activeIndex: 0,
          }
        : prev,
    )
  }, [])

  const onMenuKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (!menu) return
      const count = menu.stage === 'categories' ? filteredCategories.length : filteredItems.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (count === 0) return
        setMenu((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % count } : prev,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (count === 0) return
        setMenu((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex - 1 + count) % count } : prev,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (menu.stage === 'categories') {
          const cat = filteredCategories[menu.activeIndex]
          if (cat) onSelectCategory(cat.id)
        } else {
          const item = filteredItems[menu.activeIndex]
          if (item) onSelectItem(item)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (menu.stage === 'items') onBack()
        else closeMenu()
      }
    },
    [
      menu,
      filteredCategories,
      filteredItems,
      onSelectCategory,
      onSelectItem,
      onBack,
      closeMenu,
    ],
  )

  const menuNode =
    menu && onAdd
      ? createPortal(
          <div onKeyDown={onMenuKeyDown}>
            <InlineContextMenu
              menuRef={menuRef}
              position={menu.position}
              stage={menu.stage}
              categoryId={menu.categoryId}
              categories={filteredCategories}
              items={filteredItems}
              activeIndex={menu.activeIndex}
              query={menu.query}
              onHoverIndex={(index) =>
                setMenu((prev) => (prev ? { ...prev, activeIndex: index } : prev))
              }
              onSelectCategory={onSelectCategory}
              onSelectItem={onSelectItem}
              onBack={onBack}
              search={{
                value: menu.query,
                onChange: (value) =>
                  setMenu((prev) => (prev ? { ...prev, query: value, activeIndex: 0 } : prev)),
                placeholder: 'Search context…',
                inputRef: searchInputRef,
              }}
            />
          </div>,
          document.body,
        )
      : null

  return {
    addBtnRef,
    menuOpen: Boolean(menu),
    toggleMenu,
    menuNode,
  }
}

export type SourcesPanelProps = {
  sources: ConversationSource[]
  onRemove: (id: string) => void
  onAdd?: (item: InlineContextItem) => void
  onClose?: () => void
}

export function SourcesPanel({ sources, onRemove, onAdd, onClose }: SourcesPanelProps) {
  const existingIds = useMemo(() => new Set(sources.map((s) => s.id)), [sources])
  const { addBtnRef, menuOpen, toggleMenu, menuNode } = useAddContextMenu({
    existingIds,
    onAdd,
  })

  return (
    <aside className={styles.panel} aria-label="Context" data-lc-sources-panel>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Context</h2>
        <div className={styles.panelHeaderActions}>
          {onAdd ? (
            <button
              ref={addBtnRef}
              type="button"
              className={`${styles.panelAdd}${menuOpen ? ` ${styles.panelAddActive}` : ''}`}
              onClick={toggleMenu}
              aria-label="Add context"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
            >
              <Plus size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close sources">
              <X size={16} weight="regular" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.panelBody}>
        <SourcesList sources={sources} onRemove={onRemove} variant="panel" />
      </div>
      {menuNode}
    </aside>
  )
}

export type SourcesPopupProps = {
  sources: ConversationSource[]
  onRemove: (id: string) => void
  onAdd?: (item: InlineContextItem) => void
}

export function SourcesPopup({ sources, onRemove, onAdd }: SourcesPopupProps) {
  const existingIds = useMemo(() => new Set(sources.map((s) => s.id)), [sources])
  const { addBtnRef, menuOpen, toggleMenu, menuNode } = useAddContextMenu({
    existingIds,
    onAdd,
  })

  return (
    <div className={styles.popup} data-lc-sources-menu role="dialog" aria-label="Context">
      <div className={styles.popupHeader}>
        <p className={styles.popupTitle}>Context</p>
        {onAdd ? (
          <button
            ref={addBtnRef}
            type="button"
            className={`${styles.panelAdd}${menuOpen ? ` ${styles.panelAddActive}` : ''}`}
            onClick={toggleMenu}
            aria-label="Add context"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
          >
            <Plus size={16} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>
      <SourcesList sources={sources} onRemove={onRemove} variant="popup" />
      {menuNode}
    </div>
  )
}
