import { useRef, useState, type CSSProperties } from 'react'
import { LinkSimple } from '@phosphor-icons/react'
import { ResizeHandles, type NodeCardProps } from './nodeParts'
import { BULLET, isList, linkLabel, STICKY_SIZE, stickyFamily, stickyFill, stickyPx, stickyStyle } from './stickyNote'
import styles from './StickyNote.module.css'

const PLACEHOLDER = 'Add text'

type StickyNoteCardProps = Pick<
  NodeCardProps,
  'node' | 'position' | 'selected' | 'dragging' | 'resize' | 'cardRef' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onNoteChange'
>

/** FigJam-style sticky; its look comes from the sticky toolbar, not the card style. Double-click anywhere on it to write. */
export function StickyNoteCard({
  node,
  position,
  selected,
  dragging,
  resize,
  cardRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onNoteChange,
}: StickyNoteCardProps) {
  const look = stickyStyle(node.config.sticky)
  const note = node.config.note ?? ''
  const [editing, setEditing] = useState(note === '')
  const className = [styles.sticky, selected ? styles.selected : null, dragging ? styles.dragging : null].filter(Boolean).join(' ')
  const vars = {
    left: position.x,
    top: position.y,
    width: node.frame?.w ?? STICKY_SIZE,
    minHeight: node.frame?.h ?? STICKY_SIZE,
    '--sticky-fill': stickyFill(look.color),
    '--sticky-size': `${stickyPx(look.size)}px`,
    '--sticky-family': stickyFamily(look.font),
  } as CSSProperties

  return (
    <div
      ref={cardRef}
      className={className}
      style={vars}
      role="group"
      aria-label="Sticky note"
      data-node-id={node.id}
      data-selected={selected || undefined}
      data-font={look.font === 'simple' ? undefined : look.font}
      data-bold={look.bold || undefined}
      data-strike={look.strike || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => {
        if (!(event.target as Element).closest('a')) setEditing(true)
      }}
    >
      <StickyText note={note} editing={editing} onDone={() => setEditing(false)} onChange={onNoteChange} />
      <div className={styles.foot}>
        {look.link ? (
          <a className={styles.link} href={look.link} target="_blank" rel="noreferrer" title={look.link}>
            <LinkSimple size={14} weight="bold" aria-hidden />
            <span className={styles.linkText}>{linkLabel(look.link)}</span>
          </a>
        ) : null}
        <span className={styles.author}>{look.author}</span>
      </div>
      <ResizeHandles resize={resize} />
    </div>
  )
}

type StickyTextProps = { note: string; editing: boolean; onDone: () => void; onChange: (note: string) => void }

/** Enter continues a list; Escape cancels; Cmd/Ctrl+Enter or clicking away saves. */
function StickyText({ note, editing, onDone, onChange }: StickyTextProps) {
  const cancelledRef = useRef(false)

  if (!editing) {
    return (
      <p className={styles.text} data-empty={note.trim() ? undefined : true}>
        {note.trim() ? note : PLACEHOLDER}
      </p>
    )
  }
  return (
    <textarea
      className={`${styles.text} ${styles.editor}`}
      data-node-interactive
      aria-label="Sticky note text"
      placeholder={PLACEHOLDER}
      defaultValue={note}
      autoFocus
      onFocus={(event) => {
        const length = event.currentTarget.value.length
        event.currentTarget.setSelectionRange(length, length)
      }}
      onBlur={(event) => {
        onDone()
        if (cancelledRef.current) cancelledRef.current = false
        else if (event.currentTarget.value !== note) onChange(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        const field = event.currentTarget
        if (event.key === 'Escape') {
          cancelledRef.current = true
          field.blur()
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          field.blur()
        } else if (event.key === 'Enter' && !event.shiftKey && isList(field.value)) {
          event.preventDefault()
          field.setRangeText(`\n${BULLET}`, field.selectionStart, field.selectionEnd, 'end')
        }
      }}
    />
  )
}
