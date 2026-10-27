import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import type { IconContainer } from './cardGlow'
import type { FlowState } from './triggerCard'
import type { CanvasNode, DataRecord, NodeField, NodePort, NodeRun, NodeType, Point, PortRef, PortSide } from './nodeCatalog'
import type { AnyParams } from './nodeKinds'
import { fillBackground, fillBlur, type NodeFillPaint } from './nodeAppearance'
import { badgeCase } from './recordUtils'
import styles from './NodeCard.module.css'
import fillStyles from './NodeFill.module.css'
import noteStyles from './EditableNote.module.css'

/** The steps wired into one input, and the rows they sent on the last run; null before any of them ran. */
export type InputSource = { names: readonly string[]; rows: number | null }

/** The card edge or corner a resize handle drags. */
export type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'
const RESIZE_EDGES: readonly ResizeEdge[] = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']
/** `upstream` runs the node's ancestors, not the node itself. */
export type RunScope = 'node' | 'downstream' | 'upstream'

export type PortHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>, port: PortRef) => void
  onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onPointerCancel: () => void
}

export type ResizeHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>, edge: ResizeEdge) => void
  onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => void
}

/** Shared by every node style; the canvas renders whichever style is selected with these props. */
export type NodeCardProps = {
  node: CanvasNode
  type: NodeType
  position: Point
  selected: boolean
  dragging: boolean
  run: NodeRun
  /** Output of the upstream nodes, or null when nothing upstream has run. */
  input: readonly DataRecord[] | null
  output: readonly DataRecord[] | null
  activePorts: ReadonlySet<string>
  /** Ports with an edge attached; they stay visible when the node isn't selected. */
  connectedPorts: ReadonlySet<string>
  ports: PortHandlers
  resize: ResizeHandlers
  cardRef: (element: HTMLDivElement | null) => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  /** Opens the configuration window, unless it lands on something interactive inside the card. */
  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  onAddOutput: () => void
  /** Whether the appearance panel is open for this node. */
  appearanceOpen: boolean
  /** Whether the input and output data is showing; toggled from the node toolbar too. */
  dataOpen: boolean
  onDataOpen: (open: boolean) => void
  onNoteChange: (note: string) => void
  /** Edits made on the card itself, e.g. a prompt; typing into one field is one undo step. */
  onParamsChange?: (patch: Partial<AnyParams>) => void
  /** Hides or shows the card's details, as the node toolbar does. */
  onToggleDetails?: () => void
  /** Opens the node's settings, as a double-click does; with a branch, on that branch. */
  onOpenConfig?: (focus?: string) => void
  /** Removes a case or a category. */
  onRemoveOutput?: (portId: string) => void
  /** What's wired into each input, by port, for kinds with more than one. */
  inputSources?: Readonly<Record<string, InputSource>>
  /** No header or footer: the icon, actions, and title open the content panel, without a description; input and output open over the canvas (sectioned style). */
  headless?: boolean
  /** Opens the node's input and output over the canvas. */
  onOpenData?: () => void
  /** What sits behind the category icon (minimal style); without one it's larger, filled, and in the category colour. */
  iconContainer?: IconContainer
  /** Values in their own panel under the card, tinted from the category colour (minimal style). */
  valuesPanel?: boolean
  /** Publish state and the default trigger, for trigger cards. */
  flow?: FlowState
}

/** A card value, led by a green dot when it's live. */
export function FieldValue({ field }: { field: NodeField }) {
  return (
    <>
      {field.live ? <span className={styles.liveDot} aria-hidden /> : null}
      {field.parts
        ? field.parts.map((part, index) => (
            <Fragment key={index}>
              {index ? ' ' : null}
              <span className={styles.part} data-role={part.role}>
                {part.text}
              </span>
            </Fragment>
          ))
        : field.value}
    </>
  )
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A card's values as compact chips under the title, for when its details are hidden; the label shows on hover. */
export function DetailBadges({ fields, className }: { fields: readonly NodeField[]; className?: string }) {
  if (!fields.length) return null
  return (
    <ul className={className ? `${styles.detailBadges} ${className}` : styles.detailBadges} aria-label="Details">
      {fields.map((field, index) => (
        <DetailBadge key={`${index}:${field.label}`} field={field} />
      ))}
    </ul>
  )
}

function DetailBadge({ field }: { field: NodeField }) {
  const ref = useRef<HTMLLIElement>(null)
  const [wrapped, setWrapped] = useState(false)
  const value = badgeCase(field.value)
  const parts = field.parts?.map((part, index) => (index ? part : { ...part, text: capitalise(part.text) }))

  // Measured on the content box, which padding doesn't change, so the wrapped padding can't flip it back.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const style = getComputedStyle(element)
      const content = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setWrapped(content > parseFloat(style.lineHeight) * 1.5)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <li
      ref={ref}
      className={styles.detailBadge}
      data-muted={field.muted || undefined}
      data-wrapped={wrapped || undefined}
      title={`${field.label}: ${value}`}
    >
      <FieldValue field={{ ...field, value, parts }} />
    </li>
  )
}

/** Copies a card value, e.g. a webhook URL; shows a check for a moment after. */
export function FieldCopy({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  return (
    <button
      type="button"
      className={styles.fieldCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      data-tooltip={copied ? 'Copied' : 'Copy'}
      data-node-interactive
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check size={12} weight="bold" aria-hidden /> : <Copy size={12} aria-hidden />}
    </button>
  )
}

type PortProps = {
  nodeId: string
  port: NodePort
  side: PortSide
  active: boolean
  connected: boolean
  handlers: PortHandlers
  /** Look and placement come from the node style. */
  className: string
  activeClassName: string
}

export function Port({ nodeId, port, side, active, connected, handlers, className, activeClassName }: PortProps) {
  const ref: PortRef = { nodeId, portId: port.id, side }
  return (
    <span
      className={active ? `${className} ${activeClassName}` : className}
      aria-hidden
      data-connected={connected || undefined}
      data-port-node={nodeId}
      data-port-id={port.id}
      data-port-side={side}
      onPointerDown={(event) => handlers.onPointerDown(event, ref)}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
    />
  )
}

export type NodeMenuItem = { label: string; danger?: boolean; onSelect: () => void }

export function NodeMenu({ items, label, onClose }: { items: readonly NodeMenuItem[]; label: string; onClose: () => void }) {
  return (
    <div className={`${controls.menu} ${styles.menu}`} role="menu" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? `${controls.menuItem} ${styles.menuItemDanger}` : controls.menuItem}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** Invisible grab strips on every edge and corner; place inside the element that should resize. */
export function ResizeHandles({ resize }: { resize: ResizeHandlers }) {
  return (
    <>
      {RESIZE_EDGES.map((edge) => (
        <span
          key={edge}
          className={styles.resize}
          data-edge={edge}
          onPointerDown={(event) => resize.onPointerDown(event, edge)}
          onPointerMove={resize.onPointerMove}
          onPointerUp={resize.onPointerUp}
          onPointerCancel={resize.onPointerUp}
          aria-hidden
        />
      ))}
    </>
  )
}

/** Custom background layer; place first inside a positioned, isolated surface. Renders nothing for the default fill. */
export function NodeFill({ paint, blurScale = 1 }: { paint: NodeFillPaint | undefined; blurScale?: number }) {
  const background = paint ? fillBackground(paint) : null
  if (!paint || !background) return null
  const vars = { '--fill-blur': `${Math.round(fillBlur(paint) * blurScale)}px`, '--fill-grain': paint.grain } as CSSProperties
  return (
    <span className={fillStyles.fill} style={vars} aria-hidden>
      <span className={fillStyles.paint} style={{ background }} />
      {paint.grain > 0 ? <span className={fillStyles.grain} /> : null}
    </span>
  )
}

const NOTE_PLACEHOLDER = 'Double-click to write a note'

/** Sticky-note text; double-click to edit. A new, empty note opens straight into editing. */
export function EditableNote({ note, className, onChange }: { note: string; className: string; onChange: (note: string) => void }) {
  const [editing, setEditing] = useState(note === '')
  const cancelledRef = useRef(false)

  if (!editing) {
    return (
      <p className={`${className} ${noteStyles.note}`} onDoubleClick={() => setEditing(true)}>
        {note || <span className={noteStyles.placeholder}>{NOTE_PLACEHOLDER}</span>}
      </p>
    )
  }
  return (
    <textarea
      className={`${className} ${noteStyles.editor}`}
      data-node-interactive
      aria-label="Note"
      placeholder="Write a note"
      defaultValue={note}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        setEditing(false)
        if (cancelledRef.current) cancelledRef.current = false
        else if (event.currentTarget.value !== note) onChange(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          cancelledRef.current = true
          event.currentTarget.blur()
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.currentTarget.blur()
        }
      }}
    />
  )
}
