import { useCallback, useReducer, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { CaretDown, DotsThree, LinkSimple, ListBullets, TextB, TextStrikethrough } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { NodeMenu, type NodeMenuItem } from './nodeParts'
import {
  isList,
  normaliseLink,
  STICKY_COLORS,
  STICKY_FONTS,
  STICKY_SIZES,
  stickyFamily,
  stickyFill,
  toggleList,
  type StickyStyle,
} from './stickyNote'
import { useDismiss } from './useDismiss'
import items from './CanvasItems.module.css'
import styles from './StickyNote.module.css'

type Menu = 'color' | 'font' | 'size' | 'link' | 'more'

type StickyToolbarProps = {
  nodeId: string
  look: StickyStyle
  note: string
  /** Screen position of the toolbar's bottom-centre anchor. */
  left: number
  top: number
  onChange: (patch: Partial<StickyStyle>) => void
  onNoteChange: (note: string) => void
  onDuplicate: () => void
  onDelete: () => void
}

/** FigJam's sticky toolbar: colour, type, link, and list. */
export function StickyToolbar({ nodeId, look, note, left, top, onChange, onNoteChange, onDuplicate, onDelete }: StickyToolbarProps) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [anchor, setAnchor] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setMenu(null), [])
  useDismiss(menu !== null, ref, close)

  const toggle = (next: Menu) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    setAnchor(event.currentTarget.offsetLeft)
    setMenu((current) => (current === next ? null : next))
  }
  const trigger = (id: Menu) => `${controls.barButton} ${styles.barTrigger}${menu === id ? ` ${controls.barButtonActive}` : ''}`
  const pressed = (on: boolean) => `${controls.barButton}${on ? ` ${controls.barButtonActive}` : ''}`
  /** The note's open editor; its text isn't saved until it blurs, so the list toggles that. */
  const editor = () => {
    const active = document.activeElement
    return active instanceof HTMLTextAreaElement && active.closest(`[data-node-id="${nodeId}"]`) ? active : null
  }
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  const list = isList(editor()?.value ?? note)
  const onList = () => {
    const field = editor()
    if (!field) {
      onNoteChange(toggleList(note))
      return
    }
    field.value = toggleList(field.value)
    field.setSelectionRange(field.value.length, field.value.length)
    refresh()
  }
  const size = STICKY_SIZES.find((option) => option.id === look.size) ?? STICKY_SIZES[0]
  const popoverStyle = { left: anchor } as CSSProperties
  const moreItems: NodeMenuItem[] = [
    { label: 'Duplicate', onSelect: onDuplicate },
    { label: 'Delete', danger: true, onSelect: onDelete },
  ]

  return (
    <div
      className={items.nodeBar}
      ref={ref}
      style={{ left, top }}
      onMouseDown={(event) => {
        // Buttons don't take focus, so an open note keeps its caret while it's restyled.
        if ((event.target as Element).closest('button')) event.preventDefault()
      }}
    >
      <div className={items.floatingBar} role="toolbar" aria-label="Sticky note">
        <button type="button" className={trigger('color')} aria-label="Colour" aria-expanded={menu === 'color'} onClick={toggle('color')}>
          <span className={styles.colorDot} style={{ background: stickyFill(look.color) }} />
          <CaretDown size={12} weight="bold" aria-hidden />
        </button>
        <span className={controls.barDivider} aria-hidden />
        <button type="button" className={trigger('font')} aria-label="Font" aria-expanded={menu === 'font'} onClick={toggle('font')}>
          <span className={styles.fontGlyph}>Aa</span>
          <CaretDown size={12} weight="bold" aria-hidden />
        </button>
        <span className={controls.barDivider} aria-hidden />
        <button
          type="button"
          className={`${trigger('size')} ${styles.sizeTrigger}`}
          aria-label={`Text size, ${size.label}`}
          aria-expanded={menu === 'size'}
          onClick={toggle('size')}
        >
          <span>{size.label}</span>
          <CaretDown size={12} weight="bold" aria-hidden />
        </button>
        <span className={controls.barDivider} aria-hidden />
        <button type="button" className={pressed(look.bold)} aria-label="Bold" aria-pressed={look.bold} onClick={() => onChange({ bold: !look.bold })}>
          <TextB size={18} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={pressed(look.strike)}
          aria-label="Strikethrough"
          aria-pressed={look.strike}
          onClick={() => onChange({ strike: !look.strike })}
        >
          <TextStrikethrough size={18} aria-hidden />
        </button>
        <button
          type="button"
          className={pressed(Boolean(look.link) || menu === 'link')}
          aria-label="Link"
          aria-expanded={menu === 'link'}
          onClick={toggle('link')}
        >
          <LinkSimple size={18} aria-hidden />
        </button>
        <button type="button" className={pressed(list)} aria-label="Bulleted list" aria-pressed={list} onClick={onList}>
          <ListBullets size={18} aria-hidden />
        </button>
        <span className={controls.barDivider} aria-hidden />
        <button type="button" className={pressed(menu === 'more')} aria-label="Sticky note options" aria-haspopup="menu" aria-expanded={menu === 'more'} onClick={toggle('more')}>
          <DotsThree size={20} weight="bold" aria-hidden />
        </button>
      </div>

      {/* Outside the bar: its backdrop-filter would stop the popovers' own blur from seeing the canvas. */}
      {menu === 'color' ? (
        <div className={`${styles.popover} ${styles.colorRow}`} style={popoverStyle} role="radiogroup" aria-label="Sticky colour">
          {STICKY_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              className={styles.colorOption}
              aria-label={option.name}
              aria-checked={look.color === option.id}
              onClick={() => onChange({ color: option.id })}
            >
              <span className={styles.colorSwatch} style={{ background: option.fill }} />
            </button>
          ))}
        </div>
      ) : null}
      {menu === 'font' ? (
        <div className={`${controls.menu} ${styles.popover} ${styles.menu}`} style={popoverStyle} role="menu" aria-label="Font">
          {STICKY_FONTS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={look.font === option.id}
              className={`${controls.menuItem}${look.font === option.id ? ` ${controls.menuItemActive}` : ''}`}
              style={option.id === 'simple' ? undefined : { fontFamily: stickyFamily(option.id) }}
              onClick={() => {
                onChange({ font: option.id })
                close()
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {menu === 'size' ? (
        <div className={`${controls.menu} ${styles.popover} ${styles.menu}`} style={popoverStyle} role="menu" aria-label="Text size">
          {STICKY_SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={look.size === option.id}
              className={`${controls.menuItem}${look.size === option.id ? ` ${controls.menuItemActive}` : ''}`}
              onClick={() => {
                onChange({ size: option.id })
                close()
              }}
            >
              {option.label}
              <span className={styles.menuHint}>{option.px}px</span>
            </button>
          ))}
        </div>
      ) : null}
      {menu === 'link' ? (
        <LinkPopover
          link={look.link}
          style={popoverStyle}
          onDone={(link) => {
            if (link !== undefined) onChange({ link })
            close()
          }}
        />
      ) : null}
      {menu === 'more' ? <NodeMenu label="Sticky note options" items={moreItems} onClose={close} /> : null}
    </div>
  )
}

/** `undefined` closes without a change; `null` removes the link. */
function LinkPopover({ link, style, onDone }: { link: string | null; style: CSSProperties; onDone: (link: string | null | undefined) => void }) {
  const [value, setValue] = useState(link ?? '')
  return (
    <form
      className={`${styles.popover} ${styles.linkPopover}`}
      style={style}
      aria-label="Link"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(normaliseLink(value))
      }}
    >
      <input
        className={styles.linkInput}
        aria-label="Link URL"
        placeholder="Paste a link"
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone(undefined)
        }}
      />
      {link ? (
        <button type="button" className={styles.linkAction} onClick={() => onDone(null)}>
          Remove
        </button>
      ) : null}
      <button type="submit" className={`${styles.linkAction} ${styles.linkSave}`} disabled={!value.trim()}>
        Save
      </button>
    </form>
  )
}
