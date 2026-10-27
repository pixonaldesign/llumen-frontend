import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, CornersIn, Lock, LockOpen, PencilSimple, Trash } from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import controls from '../llumen-assistant/FloatingControls.module.css'
import {
  COMMENT_AUTHOR,
  formatCommentTime,
  SECTION_DEFAULTS,
  SECTION_SWATCHES,
  TEXT_SIZES,
  type CanvasComment,
  type CanvasSection,
  type CanvasText,
} from './canvasItems'
import { hexToRgb } from './canvasLook'
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

const initial = (author: string) => author.trim().charAt(0).toUpperCase() || '?'

type CommentPinProps = {
  author: string
  left: number
  top: number
  open: boolean
  gesture?: GestureHandlers
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

export function CommentPin({ author, left, top, open, gesture, onPointerDown }: CommentPinProps) {
  return (
    <button
      type="button"
      className={styles.commentPin}
      data-open={open || undefined}
      style={{ left, top }}
      aria-label={`Comment by ${author}`}
      aria-expanded={open}
      onPointerDown={onPointerDown}
      {...gesture}
    >
      <span className={styles.commentAvatar}>{initial(author)}</span>
    </button>
  )
}

type CommentThreadProps = { comment: CanvasComment; left: number; top: number; onResolve: () => void; onDelete: () => void }

export function CommentThread({ comment, left, top, onResolve, onDelete }: CommentThreadProps) {
  return (
    <div className={styles.commentCard} style={{ left, top }} role="dialog" aria-label={`Comment by ${comment.author}`}>
      <div className={styles.commentHead}>
        <span className={`${styles.commentAvatar} ${styles.commentAvatarSmall}`}>{initial(comment.author)}</span>
        <span className={styles.commentAuthor}>{comment.author}</span>
        <span className={styles.commentTime}>{formatCommentTime(comment.createdAt)}</span>
        <span className={styles.commentActions}>
          <button type="button" className={`${controls.barButton} ${styles.cardButton}`} aria-label="Resolve" onClick={onResolve}>
            <Check size={16} weight="bold" aria-hidden />
          </button>
          <button type="button" className={`${controls.barButton} ${styles.cardButton}`} aria-label="Delete comment" onClick={onDelete}>
            <Trash size={16} aria-hidden />
          </button>
        </span>
      </div>
      <p className={styles.commentText}>{comment.text}</p>
    </div>
  )
}

type CommentComposerProps = { left: number; top: number; onPost: (text: string) => void; onCancel: () => void }

export function CommentComposer({ left, top, onPost, onCancel }: CommentComposerProps) {
  const [text, setText] = useState('')
  const post = () => {
    if (text.trim()) onPost(text.trim())
  }
  return (
    <div className={styles.commentCard} style={{ left, top }} role="dialog" aria-label="New comment">
      <textarea
        className={styles.commentInput}
        aria-label="Comment"
        placeholder="Add a comment"
        value={text}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            post()
          }
        }}
      />
      <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
        <div className={styles.commentFoot}>
          <span className={styles.commentHint}>Posting as {COMMENT_AUTHOR}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary btn--sm" disabled={!text.trim()} onClick={post}>
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
