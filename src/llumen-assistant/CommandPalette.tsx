import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MagnifyingGlass } from '@phosphor-icons/react'
import type { ChatInteractionModel } from './interactionModel'
import {
  FINDINGS_STYLE_OPTIONS,
  STUDIO_STYLE_OPTIONS,
  type FindingsStyle,
  type LandingVariant,
  type StudioStyle,
  type TopBarVariant,
} from './prototypeChrome'
import styles from './CommandPalette.module.css'

type Command = {
  id: string
  group: string
  label: string
  hint: string
  active?: boolean
  run: () => void
}

/** The tab row under the search: every command, or one group's. */
const TABS = ['All', 'Landing', 'Findings', 'Studio', 'Top bar', 'UX', 'Aurora'] as const
type Tab = (typeof TABS)[number]

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  landing: LandingVariant
  topBar: TopBarVariant
  ux: ChatInteractionModel
  onLanding: (next: LandingVariant) => void
  onTopBar: (next: TopBarVariant) => void
  onUx: (next: ChatInteractionModel) => void
  findingsStyle: FindingsStyle
  studioStyle: StudioStyle
  onFindingsStyle: (next: FindingsStyle) => void
  onStudioStyle: (next: StudioStyle) => void
  onOpenAurora: () => void
  onCurrentAurora: () => void
  onDualStateAurora: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  landing,
  topBar,
  ux,
  onLanding,
  onTopBar,
  onUx,
  findingsStyle,
  studioStyle,
  onFindingsStyle,
  onStudioStyle,
  onOpenAurora,
  onCurrentAurora,
  onDualStateAurora,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('All')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const choose = (run: () => void) => () => {
      run()
      onOpenChange(false)
    }
    return [
      {
        id: 'briefing',
        group: 'Landing',
        label: 'Landing · Briefing',
        hint: 'Findings as chat bubbles over the map',
        active: landing === 'briefing',
        run: choose(() => onLanding('briefing')),
      },
      {
        id: 'briefing-2',
        group: 'Landing',
        label: 'Landing · Briefing 2',
        hint: 'Full-screen findings feed, with My Assets',
        active: landing === 'briefing-2',
        run: choose(() => onLanding('briefing-2')),
      },
      {
        id: 'stories',
        group: 'Landing',
        label: 'Carousel · Stories',
        hint: 'Stories under the carousel',
        active: landing === 'stories',
        run: choose(() => onLanding('stories')),
      },
      {
        id: 'conversations',
        group: 'Landing',
        label: 'Carousel · Conversations',
        hint: 'Same carousel, conversation grid underneath',
        active: landing === 'conversations',
        run: choose(() => onLanding('conversations')),
      },
      {
        id: 'feed',
        group: 'Landing',
        label: 'Feed · Full screen',
        hint: 'Scroll findings over a traveling map',
        active: landing === 'feed',
        run: choose(() => onLanding('feed')),
      },
      {
        id: 'feed-card',
        group: 'Landing',
        label: 'Feed · Contained',
        hint: 'Same feed, cards at 70% width',
        active: landing === 'feed-card',
        run: choose(() => onLanding('feed-card')),
      },
      {
        id: 'feed-chat',
        group: 'Landing',
        label: 'Feed · Conversational',
        hint: 'Findings as chat bubbles over the map',
        active: landing === 'feed-chat',
        run: choose(() => onLanding('feed-chat')),
      },
      ...FINDINGS_STYLE_OPTIONS.map((option) => ({
        id: `findings-${option.style}`,
        group: 'Findings',
        label: option.label,
        hint: option.hint,
        active: findingsStyle === option.style,
        run: choose(() => onFindingsStyle(option.style)),
      })),
      ...STUDIO_STYLE_OPTIONS.map((option) => ({
        id: `studio-${option.style}`,
        group: 'Studio',
        label: option.label,
        hint: option.hint,
        active: studioStyle === option.style,
        run: choose(() => onStudioStyle(option.style)),
      })),
      {
        id: 'bar-current',
        group: 'Top bar',
        label: 'Current',
        hint: 'Search field with Studio and Create',
        active: topBar === 'current',
        run: choose(() => onTopBar('current')),
      },
      {
        id: 'bar-studio',
        group: 'Top bar',
        label: 'Studio',
        hint: 'Workspace header',
        active: topBar === 'studio',
        run: choose(() => onTopBar('studio')),
      },
      {
        id: 'ux-hub',
        group: 'UX',
        label: 'Hub',
        hint: 'Orb in the chatbox',
        active: ux === 'hub',
        run: choose(() => onUx('hub')),
      },
      {
        id: 'ux-classic',
        group: 'UX',
        label: 'Classic',
        hint: 'Bottom-left launcher',
        active: ux === 'classic',
        run: choose(() => onUx('classic')),
      },
      {
        id: 'aurora',
        group: 'Aurora',
        label: 'Aurora settings',
        hint: 'Tune the alert aurora',
        run: () => {
          onOpenChange(false)
          onOpenAurora()
        },
      },
      {
        id: 'current-aurora',
        group: 'Aurora',
        label: 'Alert Aurora',
        hint: 'Intrusive alert, bottom third of the screen',
        run: () => {
          onOpenChange(false)
          onCurrentAurora()
        },
      },
      {
        id: 'dual-aurora',
        group: 'Aurora',
        label: 'Toast Finding',
        hint: 'Toast stack over the chat',
        run: () => {
          onOpenChange(false)
          onDualStateAurora()
        },
      },
    ]
  }, [
    findingsStyle,
    landing,
    onCurrentAurora,
    onDualStateAurora,
    onFindingsStyle,
    onLanding,
    onOpenAurora,
    onOpenChange,
    onStudioStyle,
    onTopBar,
    onUx,
    studioStyle,
    topBar,
    ux,
  ])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inTab = tab === 'All' ? commands : commands.filter((command) => command.group === tab)
    if (!q) return inTab
    return inTab.filter((command) => `${command.group} ${command.label} ${command.hint}`.toLowerCase().includes(q))
  }, [commands, query, tab])

  const pickTab = (next: Tab) => {
    setTab(next)
    setCursor(0)
    inputRef.current?.focus()
  }

  const activeIndex = Math.min(cursor, Math.max(0, filtered.length - 1))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (event.repeat) return
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (!open) return null

  const groups: { name: string; items: { command: Command; index: number }[] }[] = []
  filtered.forEach((command, index) => {
    const last = groups[groups.length - 1]
    if (!last || last.name !== command.group) groups.push({ name: command.group, items: [{ command, index }] })
    else last.items.push({ command, index })
  })

  return createPortal(
    <div className={styles.backdrop} onMouseDown={() => onOpenChange(false)}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor((value) => Math.min(filtered.length - 1, value + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor((value) => Math.max(0, value - 1))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            filtered[activeIndex]?.run()
          } else if (event.key === 'Tab') {
            event.preventDefault()
            const step = event.shiftKey ? -1 : 1
            pickTab(TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length])
          }
        }}
      >
        <label className={styles.search}>
          <MagnifyingGlass size={16} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            placeholder="Landing, findings, Studio, top bar, UX, Aurora…"
            aria-label="Filter commands"
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </label>
        <div className={styles.tabs} role="tablist" aria-label="Command groups">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls="command-palette-list"
              tabIndex={-1}
              className={styles.tab}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div id="command-palette-list" className={styles.list} ref={listRef} role="listbox" aria-label="Commands">
          {filtered.length === 0 ? <p className={styles.empty}>No matches</p> : null}
          {groups.map((group) => (
            <div key={group.name} className={styles.group}>
              <p className={styles.groupLabel}>{group.name}</p>
              {group.items.map(({ command, index }) => (
                <button
                  key={command.id}
                  id={`command-${command.id}`}
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={index === activeIndex}
                  className={`${styles.item}${index === activeIndex ? ` ${styles.itemActive}` : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={command.run}
                >
                  <span className={styles.itemCopy}>
                    <span className={styles.itemLabel}>{command.label}</span>
                    <span className={styles.itemHint}>{command.hint}</span>
                  </span>
                  {command.active ? <Check size={16} weight="bold" aria-label="Selected" /> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
