import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MagnifyingGlass } from '@phosphor-icons/react'
import type { ChatInteractionModel } from './interactionModel'
import type { LandingVariant, TopBarVariant } from './prototypeChrome'
import styles from './CommandPalette.module.css'

type Command = {
  id: string
  group: string
  label: string
  hint: string
  active?: boolean
  run: () => void
}

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  landing: LandingVariant
  topBar: TopBarVariant
  ux: ChatInteractionModel
  onLanding: (next: LandingVariant) => void
  onTopBar: (next: TopBarVariant) => void
  onUx: (next: ChatInteractionModel) => void
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
  onOpenAurora,
  onCurrentAurora,
  onDualStateAurora,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
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
        id: 'stories',
        group: 'Landing',
        label: 'Carousel · Stories',
        hint: 'Current landing, stories under the carousel',
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
  }, [landing, onCurrentAurora, onDualStateAurora, onLanding, onOpenAurora, onOpenChange, onTopBar, onUx, topBar, ux])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((command) =>
      `${command.group} ${command.label} ${command.hint}`.toLowerCase().includes(q),
    )
  }, [commands, query])

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
            placeholder="Landing, top bar, UX, Aurora…"
            aria-label="Filter commands"
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </label>
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
