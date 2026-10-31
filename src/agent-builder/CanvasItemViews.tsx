import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { ArrowUp, At, CheckCircle, CornersIn, DotsThree, Lock, LockOpen, PencilSimple, Smiley, Trash, X } from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import controls from '../llumen-assistant/FloatingControls.module.css'
import {
  COMMENT_AUTHOR,
  COMMENT_PEOPLE,
  avatarColor,
  commentAge,
  SECTION_DEFAULTS,
  SECTION_SWATCHES,
  TEXT_SIZES,
  type CanvasComment,
  type CanvasSection,
  type CanvasText,
} from './canvasItems'
import { hexToRgb } from './canvasLook'
import { NodeMenu, type NodeMenuItem } from './nodeParts'
import { ColorField, Slider } from './PaintControls'
import { SHORTCUTS } from './shortcuts'
import { useDismiss } from './useDismiss'
import styles from './CanvasItems.module.css'

/** Pointer handlers for a drag started by the canvas; spread onto the element that captured the pointer. */
export type GestureHandlers = {
  onPointerMove: (event: ReactPointerEvent<Element>) => void
  onPointerUp: (event: ReactPointerEvent<Element>) => void
  onPointerCancel: (event: ReactPointerEvent<Element>) => void
}

export type SectionCorner = 'nw' | 'ne' | 'sw' | 'se'
const CORNERS: readonly SectionCorner[] = ['nw', 'ne', 'sw', 'se']

/* ---------- Sections ---------- */

type SectionViewProps = {
  section: CanvasSection
  selected: boolean
  renaming: boolean
  gesture: GestureHandlers
  onTitlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, corner: SectionCorner) => void
  onRenameStart: () => void
  /** The new name, or null when renaming was cancelled. */
  onRenameEnd: (name: string | null) => void
}

export function SectionView({
  section,
  selected,
  renaming,
  gesture,
  onTitlePointerDown,
  onResizePointerDown,
  onRenameStart,
  onRenameEnd,
}: SectionViewProps) {
  const style = {
    left: section.x,
    top: section.y,
    width: section.w,
    height: section.h,
    '--section-color': section.fill,
    '--section-fill': `rgba(${hexToRgb(section.fill)}, ${section.fillOpacity})`,
    '--section-stroke': section.stroke ?? 'transparent',
  } as CSSProperties

  return (
    <div className={styles.section} style={style} data-section-id={section.id} data-selected={selected || undefined}>
      <div
        className={styles.sectionTitle}
        data-locked={section.locked || undefined}
        onPointerDown={onTitlePointerDown}
        onDoubleClick={onRenameStart}
        {...gesture}
      >
        {section.locked ? <Lock size={12} weight="bold" aria-hidden /> : null}
        {renaming ? <NameInput name={section.name} onDone={onRenameEnd} /> : <span className={styles.sectionName}>{section.name}</span>}
      </div>
      {selected && !section.locked
        ? CORNERS.map((corner) => (
            <span
              key={corner}
              className={styles.sectionHandle}
              data-corner={corner}
              onPointerDown={(event) => onResizePointerDown(event, corner)}
              {...gesture}
            />
          ))
        : null}
    </div>
  )
}

function NameInput({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const cancelledRef = useRef(false)
  return (
    <input
      className={styles.sectionNameInput}
      aria-label="Section name"
      defaultValue={name}
      size={Math.max(8, name.length + 2)}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => onDone(cancelledRef.current ? null : event.currentTarget.value.trim() || name)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelledRef.current = true
          event.currentTarget.blur()
        }
      }}
    />
  )
}

type SectionToolbarProps = {
  section: CanvasSection
  /** Screen position of the toolbar's top-left corner. */
  left: number
  top: number
  canFit: boolean
  onChange: (patch: Partial<CanvasSection>) => void
  onRename: () => void
  onFit: () => void
  onRemove: () => void
}

export function SectionToolbar({ section, left, top, canFit, onChange, onRename, onFit, onRemove }: SectionToolbarProps) {
  const [menu, setMenu] = useState<'fill' | 'stroke' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setMenu(null), [])
  useDismiss(menu !== null, ref, close)
  const toggle = (next: 'fill' | 'stroke') => setMenu((current) => (current === next ? null : next))

  return (
    <div className={styles.floatingBar} ref={ref} style={{ left, top }} role="toolbar" aria-label={`${section.name} section`}>
      <button
        type="button"
        className={`${controls.barButton}${menu === 'fill' ? ` ${controls.barButtonActive}` : ''}`}
        aria-label="Background colour"
        aria-expanded={menu === 'fill'}
        onClick={() => toggle('fill')}
      >
        <span className={styles.fillDot} style={{ background: section.fill }} />
      </button>
      <button
        type="button"
        className={`${controls.barButton}${menu === 'stroke' ? ` ${controls.barButtonActive}` : ''}`}
        aria-label="Border colour"
        aria-expanded={menu === 'stroke'}
        onClick={() => toggle('stroke')}
      >
        <span className={styles.strokeDot} data-none={section.stroke ? undefined : true} style={{ borderColor: section.stroke ?? undefined }} />
      </button>
      <span className={controls.barDivider} aria-hidden />
      <button type="button" className={controls.barButton} aria-label="Rename" onClick={onRename}>
        <PencilSimple size={18} aria-hidden />
      </button>
      <button
        type="button"
        className={controls.barButton}
        aria-label="Fit to contents"
        disabled={!canFit || section.locked}
        onClick={onFit}
      >
        <CornersIn size={18} aria-hidden />
      </button>
      <button
        type="button"
        className={`${controls.barButton}${section.locked ? ` ${controls.barButtonActive}` : ''}`}
        aria-label={section.locked ? 'Unlock section' : 'Lock section'}
        aria-pressed={Boolean(section.locked)}
        onClick={() => onChange({ locked: !section.locked })}
      >
        {section.locked ? <Lock size={18} aria-hidden /> : <LockOpen size={18} aria-hidden />}
      </button>
      <span className={controls.barDivider} aria-hidden />
      <button type="button" className={controls.barButton} aria-label="Remove section"
        data-tooltip="Remove section, keep contents"
        data-shortcut={SHORTCUTS.delete}
        onClick={onRemove}>
        <Trash size={18} aria-hidden />
      </button>

      {menu === 'fill' ? (
        <div className={styles.popover} role="dialog" aria-label="Background colour">
          <p className={styles.popoverTitle}>Background</p>
          <Swatches
            value={section.fill}
            onPick={(fill) => {
              if (fill) onChange({ fill, fillOpacity: section.fillOpacity || SECTION_DEFAULTS.fillOpacity })
            }}
          />
          <Slider
            label="Opacity"
            value={Math.round(section.fillOpacity * 100)}
            min={0}
            max={100}
            format={(value) => `${value}%`}
            onChange={(value) => onChange({ fillOpacity: value / 100 })}
          />
          <ColorField label="Custom" color={section.fill} onChange={(fill) => onChange({ fill })} />
        </div>
      ) : null}
      {menu === 'stroke' ? (
        <div className={styles.popover} role="dialog" aria-label="Border colour">
          <p className={styles.popoverTitle}>Border</p>
          <Swatches value={section.stroke} withNone onPick={(stroke) => onChange({ stroke })} />
          {section.stroke ? <ColorField label="Custom" color={section.stroke} onChange={(stroke) => onChange({ stroke })} /> : null}
        </div>
      ) : null}
    </div>
  )
}

type SwatchesProps = { value: string | null; withNone?: boolean; onPick: (color: string | null) => void }
function Swatches({ value, withNone = false, onPick }: SwatchesProps) {
  return (
    <div className={styles.swatches}>
      {withNone ? (
        <button
          type="button"
          className={`${styles.swatch} ${styles.swatchNone}`}
          aria-label="No border"
          aria-pressed={value === null}
          onClick={() => onPick(null)}
        />
      ) : null}
      {SECTION_SWATCHES.map((swatch) => (
        <button
          key={swatch.color}
          type="button"
          className={styles.swatch}
          style={{ '--swatch': swatch.color } as CSSProperties}
          aria-label={swatch.name}
          aria-pressed={value?.toLowerCase() === swatch.color}
          onClick={() => onPick(swatch.color)}
        />
      ))}
    </div>
  )
}

/* ---------- Text ---------- */

type TextViewProps = {
  item: CanvasText
  selected: boolean
  editing: boolean
  gesture: GestureHandlers
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onEdit: () => void
  onCommit: (text: string) => void
}

export function TextView({ item, selected, editing, gesture, onPointerDown, onEdit, onCommit }: TextViewProps) {
  return (
    <div
      className={styles.text}
      data-text-id={item.id}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      style={{ left: item.x, top: item.y, fontSize: item.size }}
      onPointerDown={onPointerDown}
      onDoubleClick={onEdit}
      {...gesture}
    >
      {editing ? (
        <textarea
          className={styles.textEditor}
          aria-label="Text"
          placeholder="Add text"
          rows={1}
          defaultValue={item.text}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => onCommit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) event.currentTarget.blur()
          }}
        />
      ) : (
        item.text
      )}
    </div>
  )
}

type TextToolbarProps = {
  item: CanvasText
  left: number
  top: number
  onSize: (size: number) => void
  onDelete: () => void
}

export function TextToolbar({ item, left, top, onSize, onDelete }: TextToolbarProps) {
  return (
    <div className={styles.floatingBar} style={{ left, top }} role="toolbar" aria-label="Text">
      {TEXT_SIZES.map((option) => (
        <button
          key={option.size}
          type="button"
          className={`${controls.barButton} ${styles.sizeButton}${item.size === option.size ? ` ${controls.barButtonActive}` : ''}`}
          aria-pressed={item.size === option.size}
          data-tooltip={`${option.label} text, ${option.size}px`}
          onClick={() => onSize(option.size)}
        >
          {option.label}
        </button>
      ))}
      <span className={controls.barDivider} aria-hidden />
      <button type="button" className={controls.barButton} aria-label="Delete text" data-shortcut={SHORTCUTS.delete} onClick={onDelete}>
        <Trash size={18} aria-hidden />
      </button>
    </div>
  )
}

/* ---------- Comments (screen space, so pins keep their size at any zoom) ---------- */

const initials = (author: string) =>
  author
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || '?'

function Avatar({ author, small }: { author: string; small?: boolean }) {
  return (
    <span className={small ? `${styles.commentAvatar} ${styles.commentAvatarSmall}` : styles.commentAvatar} style={{ background: avatarColor(author) }} aria-hidden>
      {initials(author)}
    </span>
  )
}

/** The current time, refreshed every half minute so "2 minutes ago" stays true. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MENTION = new RegExp(`(@(?:${COMMENT_PEOPLE.map(escapeRegExp).join('|')}))`)

function MessageText({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {text.split(MENTION).map((part, index) =>
        index % 2 ? (
          <span key={index} className={styles.commentMention}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  )
}

const replyCount = (comment: CanvasComment) => comment.messages.length - 1

const CARD_EDGE = 8

/**
 * Seats a comment card beside the pin whose tail is at `left`/`top`: to its right, or to its left
 * when the right would run off the canvas, and kept inside the canvas top to bottom as it grows.
 */
function useBesidePin(ref: RefObject<HTMLElement | null>, left: number, top: number) {
  useLayoutEffect(() => {
    const card = ref.current
    const layer = card?.offsetParent
    if (!card || !(layer instanceof HTMLElement)) return
    const place = () => {
      const { offsetWidth: width, offsetHeight: height } = card
      const right = left + 42
      const flipped = right + width > layer.clientWidth - CARD_EDGE && left - width - CARD_EDGE >= CARD_EDGE
      card.style.left = `${flipped ? left - width - CARD_EDGE : right}px`
      card.style.top = `${Math.max(CARD_EDGE, Math.min(top - 36, layer.clientHeight - height - CARD_EDGE))}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(card)
    return () => observer.disconnect()
  }, [left, ref, top])
}

type CommentPinProps = {
  /** Missing while a new comment is being written: the pin is then plain blue. */
  comment?: CanvasComment
  left: number
  top: number
  open: boolean
  gesture?: GestureHandlers
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

/** Figma-style pin: blue while it has something you haven't read, grey after; hovering it grows a preview. */
export function CommentPin({ comment, left, top, open, gesture, onPointerDown }: CommentPinProps) {
  const now = useNow()
  const first = comment?.messages[0]
  if (!comment || !first) return <span className={`${styles.commentPin} ${styles.commentPinDraft}`} style={{ left, top }} aria-hidden />
  const replies = replyCount(comment)
  return (
    <button
      type="button"
      className={styles.commentPin}
      data-open={open || undefined}
      data-unread={comment.unread || undefined}
      style={{ left, top }}
      aria-label={`${comment.unread ? 'Unread comment' : 'Comment'} by ${first.author}`}
      aria-expanded={open}
      onPointerDown={onPointerDown}
      {...gesture}
    >
      <Avatar author={first.author} />
      <span className={styles.pinPreview} aria-hidden>
        <span className={styles.pinPreviewBody}>
          <span className={styles.pinPreviewHead}>
            <span className={styles.commentAuthor}>{first.author}</span>
            <span className={styles.commentTime}>{commentAge(first.createdAt, now, true)}</span>
          </span>
          <MessageText text={first.text} className={styles.pinPreviewText} />
          {replies ? (
            <span className={styles.pinPreviewReplies}>
              {replies} {replies === 1 ? 'reply' : 'replies'}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  )
}

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '✅', '🔥', '😊', '🤔', '👏', '💯', '🚀', '⚠️', '📌', '✨']
const MENTION_QUERY = /(?:^|\s)@([^\s@]*)$/

type CommentBoxProps = {
  placeholder: string
  /** Names the send button. */
  sendLabel: string
  initial?: string
  autoFocus?: boolean
  /** Editing a posted message: Cancel and Save instead of the send arrow. */
  editing?: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
}

/** Figma's comment field: a pill with a send arrow, opening into a box with emoji and @mention once there's text. */
function CommentBox({ placeholder, sendLabel, initial = '', autoFocus, editing, onSubmit, onCancel }: CommentBoxProps) {
  const [text, setText] = useState(initial)
  const [caret, setCaret] = useState(initial.length)
  const [focused, setFocused] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  useDismiss(emojiOpen, emojiRef, useCallback(() => setEmojiOpen(false), []))

  const query = focused ? MENTION_QUERY.exec(text.slice(0, caret))?.[1] : undefined
  const people =
    query === undefined
      ? []
      : COMMENT_PEOPLE.filter((name) => name.toLowerCase().split(' ').some((word) => word.startsWith(query.toLowerCase())))
  const activeIndex = Math.min(active, people.length - 1)
  const expanded = editing || text.length > 0
  const trimmed = text.trim()

  const edit = (next: string, at: number) => {
    setText(next)
    setCaret(at)
    setActive(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(at, at)
    })
  }
  const insert = (value: string, replacing = 0) => {
    const start = caret - replacing
    edit(text.slice(0, start) + value + text.slice(caret), start + value.length)
  }
  const mention = (name: string) => insert(`@${name} `, (query?.length ?? 0) + 1)
  const submit = () => {
    if (!trimmed) return
    onSubmit(trimmed)
    if (!editing) edit('', 0)
  }
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault()

  return (
    <div className={styles.commentBox} data-expanded={expanded || undefined} data-focused={focused || undefined} data-editing={editing || undefined}>
      <textarea
        ref={inputRef}
        className={styles.commentInput}
        aria-label={placeholder}
        placeholder={placeholder}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyUp={(event) => setCaret(event.currentTarget.selectionStart)}
        onClick={(event) => setCaret(event.currentTarget.selectionStart)}
        onChange={(event) => {
          setText(event.target.value)
          setCaret(event.target.selectionStart)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (people.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setActive((activeIndex + (event.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length)
          } else if (people.length && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault()
            mention(people[activeIndex])
          } else if (event.key === 'Escape') {
            onCancel()
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      {expanded ? (
        <div className={styles.commentTools}>
          <div ref={emojiRef} className={styles.commentToolAnchor}>
            <button
              type="button"
              className={`${controls.barButton} ${styles.commentTool}`}
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
              onMouseDown={keepFocus}
              onClick={() => setEmojiOpen((open) => !open)}
            >
              <Smiley size={18} aria-hidden />
            </button>
            {emojiOpen ? (
              <div className={`${controls.menu} ${styles.commentPopover} ${styles.emojiGrid}`} role="menu" aria-label="Emoji">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    className={`${controls.barButton} ${styles.commentTool}`}
                    onMouseDown={keepFocus}
                    onClick={() => {
                      insert(emoji)
                      setEmojiOpen(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`${controls.barButton} ${styles.commentTool}`}
            aria-label="Mention someone"
            onMouseDown={keepFocus}
            onClick={() => insert(caret > 0 && !/\s/.test(text[caret - 1]) ? ' @' : '@')}
          >
            <At size={18} aria-hidden />
          </button>
          {editing ? (
            <div className={`${SCOPE_CLASS} ${styles.commentEditActions}`} data-theme="dark">
              <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary btn--sm" disabled={!trimmed} onClick={submit}>
                Save
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {editing ? null : (
        <button
          type="button"
          className={`${controls.barButton} ${styles.commentSend}`}
          aria-label={sendLabel}
          disabled={!trimmed}
          onMouseDown={keepFocus}
          onClick={submit}
        >
          <ArrowUp size={14} weight="bold" aria-hidden />
        </button>
      )}
      {people.length ? (
        <div className={`${controls.menu} ${styles.commentPopover} ${styles.mentionMenu}`} role="listbox" aria-label="People">
          {people.map((name, index) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? `${controls.menuItem} ${controls.menuItemActive}` : controls.menuItem}
              onMouseDown={keepFocus}
              onMouseEnter={() => setActive(index)}
              onClick={() => mention(name)}
            >
              <Avatar author={name} small />
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** A ··· menu; it sits in a fixed layer over the button so the thread's scrolling list can't clip it. */
function MoreMenu({ label, items }: { label: string; items: readonly NodeMenuItem[] }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setAnchor(null), [])
  useDismiss(anchor !== null, ref, close)
  return (
    <div ref={ref} className={styles.commentToolAnchor}>
      <button
        type="button"
        className={`${controls.barButton} ${styles.cardButton}`}
        aria-label={label}
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget.getBoundingClientRect())}
      >
        <DotsThree size={18} weight="bold" aria-hidden />
      </button>
      {anchor ? (
        <div className={styles.commentMenuAnchor} style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}>
          <NodeMenu items={items} label={label} onClose={close} />
        </div>
      ) : null}
    </div>
  )
}

type CommentThreadProps = {
  comment: CanvasComment
  left: number
  top: number
  onReply: (text: string) => void
  onEdit: (messageId: string, text: string) => void
  onDeleteMessage: (messageId: string) => void
  onMarkUnread: () => void
  onResolve: () => void
  onDelete: () => void
  onClose: () => void
}

export function CommentThread({ comment, left, top, onReply, onEdit, onDeleteMessage, onMarkUnread, onResolve, onDelete, onClose }: CommentThreadProps) {
  const now = useNow()
  const [editingId, setEditingId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useBesidePin(cardRef, left, top)
  const count = comment.messages.length
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [count])
  return (
    <div ref={cardRef} className={styles.commentCard} role="dialog" aria-label="Comment">
      <div className={styles.commentHead}>
        <span className={styles.commentTitle}>Comment</span>
        <span className={styles.commentActions}>
          <MoreMenu
            label="Thread options"
            items={[
              { label: 'Mark as unread', onSelect: onMarkUnread },
              { label: 'Delete thread', danger: true, onSelect: onDelete },
            ]}
          />
          <button type="button" className={`${controls.barButton} ${styles.cardButton}`} aria-label="Resolve" data-tooltip="Resolve" onClick={onResolve}>
            <CheckCircle size={18} aria-hidden />
          </button>
          <button type="button" className={`${controls.barButton} ${styles.cardButton}`} aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </span>
      </div>
      <div ref={listRef} className={styles.commentMessages} data-native-scroll>
        {comment.messages.map((message, index) => (
          <div key={message.id} className={styles.commentMessage}>
            <Avatar author={message.author} small />
            <span className={styles.commentAuthor}>{message.author}</span>
            <span className={styles.commentTime}>{commentAge(message.createdAt, now)}</span>
            {message.author === COMMENT_AUTHOR ? (
              <MoreMenu
                label="Comment options"
                items={[
                  { label: 'Edit', onSelect: () => setEditingId(message.id) },
                  { label: index === 0 ? 'Delete thread' : 'Delete', danger: true, onSelect: () => onDeleteMessage(message.id) },
                ]}
              />
            ) : null}
            {editingId === message.id ? (
              <div className={styles.commentMessageBody}>
                <CommentBox
                  placeholder="Edit comment"
                  sendLabel="Save"
                  initial={message.text}
                  autoFocus
                  editing
                  onSubmit={(text) => {
                    onEdit(message.id, text)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <MessageText text={message.text} className={`${styles.commentText} ${styles.commentMessageBody}`} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.commentReply}>
        <Avatar author={COMMENT_AUTHOR} small />
        <CommentBox placeholder="Reply" sendLabel="Reply" onSubmit={onReply} onCancel={onClose} />
      </div>
    </div>
  )
}

type CommentComposerProps = { left: number; top: number; onPost: (text: string) => void; onCancel: () => void }

export function CommentComposer({ left, top, onPost, onCancel }: CommentComposerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useBesidePin(ref, left, top)
  return (
    <div ref={ref} className={styles.commentComposer} role="dialog" aria-label="New comment">
      <CommentBox placeholder="Add a comment" sendLabel="Post comment" autoFocus onSubmit={onPost} onCancel={onCancel} />
    </div>
  )
}
