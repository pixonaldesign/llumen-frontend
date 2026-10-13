import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BracketsSquare,
  CaretDown,
  CaretUp,
  DotsThreeVertical,
  Export,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SidebarSimple,
  Trash,
  X,
} from '@phosphor-icons/react'
import type { ConversationSource } from './conversationSources'
import type { InlineContextItem } from './inlineContextData'
import { SessionsPanel } from './SessionsPanel'
import { SourcesPopup } from './SourcesPanel'
import styles from './compact-assistant.module.css'

export type ChatQuestionIndexItem = {
  id: string
  question: string
  /** Scroll target — the user message that was submitted. */
  responseId: string
}

export type ChatSearchState = {
  open: boolean
  query: string
}

export type PanelHeaderProps = {
  onClose: () => void
  expanded?: boolean
  chatTitle?: string
  onChatTitleChange?: (title: string) => void
  onOpenSession?: (id: string) => void
  onNewSession?: () => void
  /** Clear the active conversation (delete). */
  onDeleteConversation?: () => void
  /** Open share dialog for the active conversation. */
  onShareConversation?: () => void
  /** Hide overflow actions, search, and title edit until at least one assistant reply exists. */
  hasAssistantReply?: boolean
  sessionsOpen?: boolean
  sessionsFullscreen?: boolean
  onSessionsOpenChange?: (open: boolean) => void
  /** Notify parent when in-chat search open/query changes. */
  onChatSearchChange?: (state: ChatSearchState) => void
  searchMatchCount?: number
  searchActiveMatch?: number
  onSearchMatchNavigate?: (direction: 'prev' | 'next') => void
  sources?: ConversationSource[]
  onRemoveSource?: (id: string) => void
  onAddSource?: (item: InlineContextItem) => void
  /** Toggle floating Sources panel visibility in fullscreen. */
  onToggleSourcesPanel?: () => void
  /** Whether the fullscreen floating Sources panel is currently visible. */
  sourcesPanelOpen?: boolean
  /** When true in fullscreen, Sources opens as a header popup (subcontext is occupying the rail). */
  subcontextOpen?: boolean
}

const CONVERSATION_MENU_ITEMS = [
  { id: 'search', label: 'Search', Icon: MagnifyingGlass },
  { id: 'rename', label: 'Rename', Icon: PencilSimple },
  { id: 'share', label: 'Share', Icon: Export },
  { id: 'delete', label: 'Delete', Icon: Trash, destructive: true },
] as const

export function PanelHeader({
  onClose,
  expanded = false,
  chatTitle = 'New chat',
  onChatTitleChange,
  onOpenSession,
  onNewSession,
  onDeleteConversation,
  onShareConversation,
  hasAssistantReply = false,
  sessionsOpen = false,
  sessionsFullscreen = false,
  onSessionsOpenChange,
  onChatSearchChange,
  searchMatchCount = 0,
  searchActiveMatch = -1,
  onSearchMatchNavigate,
  sources = [],
  onRemoveSource,
  onAddSource,
  onToggleSourcesPanel,
  sourcesPanelOpen = false,
  subcontextOpen = false,
}: PanelHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(chatTitle)
  const [titleHovered, setTitleHovered] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sessionsWrapRef = useRef<HTMLDivElement>(null)
  const overflowWrapRef = useRef<HTMLDivElement>(null)
  const sourcesWrapRef = useRef<HTMLDivElement>(null)
  const onChatSearchChangeRef = useRef(onChatSearchChange)
  onChatSearchChangeRef.current = onChatSearchChange
  const showSources = sources.length > 0 && Boolean(onRemoveSource)
  /** Windowed always; fullscreen only while subcontext owns the right rail. */
  const sourcesAsPopup = !expanded || subcontextOpen
  const sourcesControlActive = sourcesAsPopup ? sourcesOpen : sourcesPanelOpen

  const emitSearchChange = (open: boolean, query: string) => {
    onChatSearchChangeRef.current?.({ open, query })
  }

  useEffect(() => {
    if (!editingTitle) setTitleDraft(chatTitle)
  }, [chatTitle, editingTitle])

  useEffect(() => {
    if (!hasAssistantReply) {
      setEditingTitle(false)
      setOverflowOpen(false)
      setSearchOpen(false)
      setSearchQuery('')
      emitSearchChange(false, '')
      setSourcesOpen(false)
    }
  }, [hasAssistantReply])

  useEffect(() => {
    if (sessionsOpen) {
      setSearchOpen(false)
      setSearchQuery('')
      setOverflowOpen(false)
      emitSearchChange(false, '')
      setSourcesOpen(false)
    }
  }, [sessionsOpen])

  useEffect(() => {
    if (sources.length === 0) setSourcesOpen(false)
  }, [sources.length])

  useEffect(() => {
    // Floating panel mode: keep the header popup closed.
    if (expanded && !subcontextOpen) setSourcesOpen(false)
  }, [expanded, subcontextOpen])

  useLayoutEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSearchOpen(false)
        setSearchQuery('')
        emitSearchChange(false, '')
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onSearchMatchNavigate?.(e.shiftKey ? 'prev' : 'next')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [searchOpen, onSearchMatchNavigate])

  useEffect(() => {
    if (!sessionsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSessionsOpenChange?.(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (sessionsFullscreen) return
      const target = e.target as Node
      if (sessionsWrapRef.current?.contains(target)) return
      onSessionsOpenChange?.(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [sessionsOpen, sessionsFullscreen, onSessionsOpenChange])

  useEffect(() => {
    if (!overflowOpen) return
    const onPointer = (e: MouseEvent) => {
      if (overflowWrapRef.current?.contains(e.target as Node)) return
      setOverflowOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [overflowOpen])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    emitSearchChange(false, '')
  }

  useEffect(() => {
    if (!sourcesOpen) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (sourcesWrapRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-lc-inline-context-menu]')) return
      setSourcesOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSourcesOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [sourcesOpen])

  const commitTitle = () => {
    const next = titleDraft.trim() || 'New chat'
    setTitleDraft(next)
    onChatTitleChange?.(next)
    setEditingTitle(false)
  }

  const startRename = () => {
    setOverflowOpen(false)
    setTitleDraft(chatTitle)
    setEditingTitle(true)
  }

  const startSearch = () => {
    setOverflowOpen(false)
    setEditingTitle(false)
    setSearchOpen(true)
    emitSearchChange(true, searchQuery)
  }

  const onSearchQueryInput = (value: string) => {
    setSearchQuery(value)
    emitSearchChange(true, value)
  }

  const onOverflowAction = (id: (typeof CONVERSATION_MENU_ITEMS)[number]['id']) => {
    if (id === 'search') {
      startSearch()
      return
    }
    if (id === 'rename') {
      startRename()
      return
    }
    if (id === 'share') {
      setOverflowOpen(false)
      onShareConversation?.()
      return
    }
    if (id === 'delete') {
      setOverflowOpen(false)
      onDeleteConversation?.()
    }
  }

  const hasQuery = searchQuery.trim().length > 0
  const matchLabel =
    hasQuery && searchMatchCount > 0
      ? `${searchActiveMatch + 1}/${searchMatchCount}`
      : hasQuery
        ? '0/0'
        : null

  if (searchOpen && hasAssistantReply) {
    return (
      <div className={`${styles.headerRow} ${styles.headerRowSearch}`}>
        <div className={styles.headerSearchBar}>
          <input
            ref={searchInputRef}
            type="search"
            className={styles.headerSearchInput}
            placeholder="Search in chat"
            value={searchQuery}
            onChange={(e) => onSearchQueryInput(e.target.value)}
            aria-label="Search in chat"
          />
          {matchLabel ? (
            <div className={styles.headerSearchNav} role="status" aria-live="polite">
              <span className={styles.headerSearchCount}>{matchLabel}</span>
              <button
                type="button"
                className={styles.headerSearchNavBtn}
                onClick={() => onSearchMatchNavigate?.('prev')}
                disabled={searchMatchCount <= 0}
                aria-label="Previous match"
              >
                <CaretUp className={styles.headerPhosphor} size={14} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className={styles.headerSearchNavBtn}
                onClick={() => onSearchMatchNavigate?.('next')}
                disabled={searchMatchCount <= 0}
                aria-label="Next match"
              >
                <CaretDown className={styles.headerPhosphor} size={14} weight="bold" aria-hidden />
              </button>
            </div>
          ) : null}
          <button type="button" className={styles.headerSearchClose} onClick={closeSearch} aria-label="Close search">
            <X className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.headerRow}>
      <div className={styles.headerActions}>
        <div className={styles.headerSessionsWrap} ref={sessionsWrapRef}>
          <button
            type="button"
            className={`${styles.headerBtn}${sessionsOpen ? ` ${styles.headerBtnActive}` : ''}`}
            onClick={() => onSessionsOpenChange?.(!sessionsOpen)}
            aria-label="Conversations"
            aria-expanded={sessionsOpen}
            aria-haspopup={sessionsFullscreen ? undefined : 'menu'}
          >
            {sessionsFullscreen ? (
              <SidebarSimple className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
            ) : (
              <List className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
            )}
          </button>
          {sessionsOpen && !sessionsFullscreen ? (
            <div
              className={styles.headerSessionsMenu}
              role="menu"
              aria-label="Conversations"
              data-lc-sessions-menu
            >
              <SessionsPanel
                variant="dropdown"
                onOpenSession={(id) => {
                  onOpenSession?.(id)
                  onSessionsOpenChange?.(false)
                }}
                onShareSession={() => {
                  onSessionsOpenChange?.(false)
                  onShareConversation?.()
                }}
              />
            </div>
          ) : null}
        </div>
        {onNewSession ? (
          <button
            type="button"
            className={styles.headerBtn}
            onClick={onNewSession}
            aria-label="New conversation"
            title="New conversation"
          >
            <Plus className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className={styles.headerTitleCluster}
        onMouseEnter={() => {
          if (hasAssistantReply) setTitleHovered(true)
        }}
        onMouseLeave={() => {
          if (!editingTitle) setTitleHovered(false)
        }}
      >
        {editingTitle && hasAssistantReply ? (
          <input
            ref={titleInputRef}
            className={styles.headerTitleInput}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitTitle()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setTitleDraft(chatTitle)
                setEditingTitle(false)
              }
            }}
            aria-label="Chat title"
          />
        ) : hasAssistantReply ? (
          <button
            type="button"
            className={`${styles.headerTitleBtn}${titleHovered ? ` ${styles.headerTitleBtnHover}` : ''}`}
            onClick={() => {
              setTitleDraft(chatTitle)
              setEditingTitle(true)
            }}
            title="Edit chat title"
          >
            <span className={styles.headerTitleText}>{chatTitle}</span>
          </button>
        ) : (
          <span className={styles.headerTitleStatic}>
            <span className={styles.headerTitleText}>{chatTitle}</span>
          </span>
        )}

        {hasAssistantReply ? (
          <div className={styles.headerOverflowWrap} ref={overflowWrapRef}>
            <button
              type="button"
              className={`${styles.headerSearchBtn}${overflowOpen ? ` ${styles.headerBtnActive}` : ''}`}
              onClick={() => {
                setSourcesOpen(false)
                setOverflowOpen((open) => !open)
              }}
              aria-label="Conversation options"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
            >
              <DotsThreeVertical className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
            </button>
            {overflowOpen ? (
              <div
                className={styles.headerOverflowMenu}
                role="menu"
                aria-label="Conversation options"
                data-lc-conversation-menu
              >
                {CONVERSATION_MENU_ITEMS.map(({ id, label, Icon, ...rest }) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={`${styles.headerOverflowMenuItem}${
                      'destructive' in rest && rest.destructive
                        ? ` ${styles.headerOverflowMenuItemDanger}`
                        : ''
                    }`}
                    onClick={() => onOverflowAction(id)}
                  >
                    <Icon size={16} weight="regular" aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showSources ? (
          <div className={styles.headerOverflowWrap} ref={sourcesWrapRef}>
            <button
              type="button"
              className={`${styles.headerSearchBtn} ${styles.headerSourcesBtn}${
                sourcesControlActive ? ` ${styles.headerBtnActive}` : ''
              }`}
              onClick={() => {
                setOverflowOpen(false)
                if (!sourcesAsPopup) {
                  setSourcesOpen(false)
                  onToggleSourcesPanel?.()
                  return
                }
                setSourcesOpen((open) => !open)
              }}
              aria-label="Sources"
              aria-haspopup={sourcesAsPopup ? 'dialog' : undefined}
              aria-expanded={sourcesControlActive}
              aria-pressed={!sourcesAsPopup ? sourcesPanelOpen : undefined}
            >
              <BracketsSquare className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
            </button>
            {sourcesAsPopup && sourcesOpen ? (
              <div className={styles.headerSourcesMenu}>
                <SourcesPopup
                  sources={sources}
                  onRemove={(id) => {
                    onRemoveSource?.(id)
                  }}
                  onAdd={onAddSource}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.headerActions}>
        <button type="button" className={styles.headerBtn} onClick={onClose} aria-label="Close assistant">
          <X className={styles.headerPhosphor} size={20} weight="regular" aria-hidden />
        </button>
      </div>
    </div>
  )
}
