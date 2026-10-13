import { useEffect, useRef, type RefObject } from 'react'
import styles from './compact-assistant.module.css'
import type { SlashCommand, SlashMenuPosition } from './slashCommands'

export type SlashCommandMenuProps = {
  menuRef: RefObject<HTMLDivElement | null>
  position: SlashMenuPosition
  commands: SlashCommand[]
  activeIndex: number
  query: string
  onHoverIndex: (index: number) => void
  onSelect: (command: SlashCommand) => void
}

export function SlashCommandMenu({
  menuRef,
  position,
  commands,
  activeIndex,
  query,
  onHoverIndex,
  onSelect,
}: SlashCommandMenuProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, commands])

  return (
    <div
      ref={menuRef}
      className={`${styles.inlineContextMenu} ${styles.slashCommandMenu}`}
      style={{
        left: position.left,
        bottom: position.bottom,
        width: position.width,
      }}
      role="listbox"
      aria-label="Slash commands"
      data-lc-slash-command-menu
    >
      <p className={styles.inlineContextMenuSection}>Commands</p>
      {commands.length === 0 ? (
        <p className={styles.inlineContextMenuEmpty}>
          {query.trim() ? `No commands matching “${query.trim()}”` : 'No commands'}
        </p>
      ) : (
        commands.map((item, index) => (
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
            onClick={() => onSelect(item)}
          >
            <item.Icon className={styles.inlineContextMenuIcon} size={16} weight="regular" aria-hidden />
            <span className={styles.inlineContextMenuItemText}>
              <span className={styles.inlineContextMenuItemLabel}>/{item.label}</span>
              <span className={styles.inlineContextMenuItemDesc}>{item.description}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
}
