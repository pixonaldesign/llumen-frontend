import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  Check,
  Circle,
  DotsSixVertical,
  DotsThree,
  Eye,
  EyeSlash,
  LineSegments,
  MapPinSimple,
  PencilSimple,
  Polygon,
  Rectangle,
  Trash,
} from '@phosphor-icons/react'
import { ColorPicker } from './StoryColorPicker'
import { Slider } from './StoryBackgroundSettings'
import {
  ANNOTATION_TOOLS,
  annotationTool,
  contextSummary,
  minimumPoints,
  shapeMeasurements,
  type AnnotationStyle,
  type AnnotationTool,
  type MapAnnotationItem,
} from './storyMapAnnotations'
import settings from './StoryBackground.module.css'
import styles from './StoryAnnotations.module.css'

export type AnnotationDrawingState = { tool: AnnotationTool; points: number }

export type AnnotationPatch = Partial<Pick<MapAnnotationItem, 'visible' | 'opacity'>> & { style?: Partial<AnnotationStyle> }

const TOOL_ICONS: Record<AnnotationTool, (size: number) => ReactNode> = {
  marker: (size) => <MapPinSimple size={size} weight="bold" aria-hidden />,
  line: (size) => <LineSegments size={size} weight="bold" aria-hidden />,
  arrow: (size) => <ArrowUpRight size={size} weight="bold" aria-hidden />,
  polygon: (size) => <Polygon size={size} weight="bold" aria-hidden />,
  rectangle: (size) => <Rectangle size={size} weight="bold" aria-hidden />,
  circle: (size) => <Circle size={size} weight="bold" aria-hidden />,
}

const DRAW_STEP: Record<AnnotationTool, (points: number) => string> = {
  marker: () => 'Click the map to place the marker.',
  line: (points) => (points === 0 ? 'Click the map to start the line.' : 'Click to add a point; click the last one again to finish.'),
  arrow: (points) =>
    points === 0 ? 'Click where the arrow starts.' : 'Click to add a point; click the last one again to finish.',
  polygon: (points) => (points < 3 ? 'Click to add corners.' : 'Connect to the first corner to close the shape.'),
  rectangle: (points) =>
    points === 0 ? 'Click one corner of the rectangle.' : 'Click the opposite corner. Hold Shift for a square.',
  circle: (points) => (points === 0 ? 'Click the centre of the circle.' : 'Click to set the radius.'),
}

const EDIT_HINT: Record<AnnotationTool, string> = {
  marker: 'Drag the point to move the marker.',
  line: 'Drag the points to reshape the line.',
  arrow: 'Drag the points to reshape the arrow.',
  polygon: 'Drag the corners to reshape the area.',
  rectangle: 'Drag a corner to resize. Hold Shift for a square.',
  circle: 'Drag the centre to move it, or the edge point to resize.',
}

function rowMeta(item: MapAnnotationItem) {
  const measured = shapeMeasurements(item.tool, item.geometry, item.circle).join(' · ')
  if (measured) return measured
  if (item.style.text) return item.style.text
  return item.context.anchor === 'feature' ? contextSummary(item.context) : 'Point on the map'
}

const MARQUEE_GAP_PX = 24
const MARQUEE_PX_PER_S = 40

/** Truncated text that scrolls like a ticker while hovered, so the whole of it can be read. */
function MarqueeText({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [distance, setDistance] = useState<number | null>(null)

  const start = () => {
    const node = ref.current
    if (node && node.scrollWidth > node.clientWidth) setDistance(node.scrollWidth + MARQUEE_GAP_PX)
  }

  const style = distance
    ? ({
        '--marquee-gap': `${MARQUEE_GAP_PX}px`,
        '--marquee-distance': `${distance}px`,
        '--marquee-duration': `${distance / MARQUEE_PX_PER_S}s`,
      } as CSSProperties)
    : undefined

  return (
    <span
      ref={ref}
      className={`${className}${distance ? ` ${styles.marquee}` : ''}`}
      style={style}
      title={text}
      onMouseEnter={start}
      onMouseLeave={() => setDistance(null)}
    >
      {distance ? (
        <span className={styles.marqueeTrack}>
          <span>{text}</span>
          <span aria-hidden>{text}</span>
        </span>
      ) : (
        text
      )}
    </span>
  )
}

type PanelProps = {
  items: MapAnnotationItem[]
  selectedId: string | null
  editable: boolean
  drawing: AnnotationDrawingState | null
  editingId: string | null
  onStartDrawing: (tool: AnnotationTool) => void
  onFinishDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: AnnotationPatch) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onFinishEditing: () => void
  onCancelEditing: () => void
  onReorder: (from: number, to: number) => void
}

function ToolBar({ onStart }: { onStart: (tool: AnnotationTool) => void }) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Add annotation">
      {ANNOTATION_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={styles.toolBtn}
          aria-label={`Draw ${tool.label.toLowerCase()}`}
          title={tool.label}
          onClick={() => onStart(tool.id)}
        >
          {TOOL_ICONS[tool.id](18)}
        </button>
      ))}
    </div>
  )
}

function DrawingBar({
  drawing,
  onFinish,
  onUndo,
  onCancel,
}: {
  drawing: AnnotationDrawingState
  onFinish: () => void
  onUndo: () => void
  onCancel: () => void
}) {
  const tool = annotationTool(drawing.tool)
  const multiPoint = drawing.tool === 'line' || drawing.tool === 'arrow' || drawing.tool === 'polygon'
  const finishable = (drawing.tool === 'line' || drawing.tool === 'arrow') && drawing.points >= minimumPoints(drawing.tool)
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <div className={styles.statusHead}>
        <span className={styles.statusIcon}>{TOOL_ICONS[drawing.tool](16)}</span>
        <span className={styles.statusTitle}>Drawing {tool.label.toLowerCase()}</span>
        <span className={styles.statusBadge}>2D</span>
      </div>
      <p className={styles.statusStep}>{DRAW_STEP[drawing.tool](drawing.points)}</p>
      <div className={styles.statusActions}>
        {multiPoint ? (
          <button
            type="button"
            className={styles.statusIconBtn}
            aria-label="Undo last point"
            title="Undo last point"
            disabled={drawing.points === 0}
            onClick={onUndo}
          >
            <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
          </button>
        ) : null}
        <button type="button" className={`${settings.pillBtn} ${styles.cancelBtn}`} onClick={onCancel}>
          Cancel
        </button>
        {finishable ? (
          <button type="button" className={styles.primaryPill} onClick={onFinish}>
            Finish
          </button>
        ) : null}
      </div>
    </div>
  )
}

function EditingBar({ item, onDone, onCancel }: { item: MapAnnotationItem; onDone: () => void; onCancel: () => void }) {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <div className={styles.statusHead}>
        <span className={styles.statusIcon} style={{ color: item.style.color }}>
          {TOOL_ICONS[item.tool](16)}
        </span>
        <span className={styles.statusTitle}>Editing {item.name}</span>
        <span className={styles.statusBadge}>2D</span>
      </div>
      <p className={styles.statusStep}>{EDIT_HINT[item.tool]}</p>
      <div className={styles.statusActions}>
        <button type="button" className={`${settings.pillBtn} ${styles.cancelBtn}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primaryPill} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

/** Primary, neutral, positive, negative, orange and purple; anything else comes from the + picker. */
const ANNOTATION_SWATCHES = ['#70aeff', '#ffffff', '#7dcea0', '#f17474', '#f7a13b', '#c084fc']

type Popover = { id: string; rect: DOMRect }

const POPOVER_GAP = 6
const POPOVER_WIDTH = 260
const POPOVER_HEIGHT = 320

function popoverStyle({ rect }: Popover): CSSProperties {
  const left = Math.max(8, Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8))
  const below = window.innerHeight - rect.bottom
  return below > POPOVER_HEIGHT + POPOVER_GAP + 8
    ? { left, width: POPOVER_WIDTH, top: rect.bottom + POPOVER_GAP }
    : { left, width: POPOVER_WIDTH, bottom: window.innerHeight - rect.top + POPOVER_GAP }
}

/** The color / opacity / text / delete menu for one layer, portaled so the panel doesn't clip it. */
function LayerPopover({
  popover,
  item,
  onChange,
  onDelete,
  onClose,
}: {
  popover: Popover
  item: MapAnnotationItem
  onChange: (patch: AnnotationPatch) => void
  onDelete: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element
      // The color picker's own popovers are portaled too; clicks there belong to this menu.
      if (ref.current?.contains(target) || target.closest?.('[role="dialog"], [data-layer-popover-trigger]')) return
      onClose()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className={styles.popover}
      role="menu"
      aria-label={`${item.name} options`}
      style={popoverStyle(popover)}
    >
      <div className={styles.popoverSection}>
        <span className={styles.popoverLabel}>Color</span>
        <ColorPicker
          label="Annotation color"
          value={item.style.color}
          variant="palette"
          swatches={ANNOTATION_SWATCHES}
          customOnly
          onChange={(color) => onChange({ style: { color } })}
        />
      </div>
      <div className={styles.popoverSection}>
        <span className={styles.popoverLabel}>Opacity</span>
        <Slider
          label="Layer opacity"
          value={item.opacity}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(item.opacity * 100)}%`}
          onChange={(opacity) => onChange({ opacity })}
        />
      </div>
      <div className={styles.popoverSection}>
        <span className={styles.popoverLabel}>Text</span>
        <textarea
          className={styles.textInput}
          rows={2}
          aria-label="Annotation text"
          placeholder={item.tool === 'marker' ? 'Shown in a tooltip above the marker' : 'Shown in a pill at the centre'}
          value={item.style.text}
          onChange={(event) => onChange({ style: { text: event.target.value } })}
        />
      </div>
      <div className={styles.popoverDivider} />
      <button type="button" role="menuitem" className={styles.popoverDanger} onClick={onDelete}>
        <Trash size={16} weight="regular" aria-hidden />
        Delete
      </button>
    </div>,
    document.body,
  )
}

type Drag = { id: string; from: number; over: number; startY: number; dy: number; step: number }

const LIST_GAP = 2

/** The Annotations tab of the Map Data panel: the annotation layers, and the tools that draw new ones. */
export function StoryAnnotationsPanel({
  items,
  selectedId,
  editable,
  drawing,
  editingId,
  onStartDrawing,
  onFinishDrawing,
  onUndoDrawing,
  onCancelDrawing,
  onSelect,
  onChange,
  onDelete,
  onEdit,
  onFinishEditing,
  onCancelEditing,
  onReorder,
}: PanelProps) {
  const [popover, setPopover] = useState<Popover | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const closePopover = useCallback(() => setPopover(null), [])
  const popoverItem = popover ? items.find((item) => item.id === popover.id) : undefined
  const editingItem = editingId ? items.find((item) => item.id === editingId) : undefined

  const togglePopover = (id: string, button: HTMLElement) =>
    setPopover((current) => (current?.id === id ? null : { id, rect: button.getBoundingClientRect() }))

  const startDrag = (event: PointerEvent<HTMLElement>, id: string, from: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    const row = event.currentTarget.closest('li')
    event.currentTarget.setPointerCapture(event.pointerId)
    setPopover(null)
    setDrag({ id, from, over: from, startY: event.clientY, dy: 0, step: (row?.offsetHeight ?? 40) + LIST_GAP })
  }

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return
    const dy = event.clientY - drag.startY
    const over = Math.max(0, Math.min(items.length - 1, drag.from + Math.round(dy / drag.step)))
    setDrag({ ...drag, dy, over })
  }

  const endDrag = () => {
    if (!drag) return
    if (drag.over !== drag.from) onReorder(drag.from, drag.over)
    setDrag(null)
  }

  const reorderByKey = (event: KeyboardEvent<HTMLElement>, index: number) => {
    const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
    if (to === null || to < 0 || to >= items.length) return
    event.preventDefault()
    onReorder(index, to)
  }

  const rowShift = (index: number) => {
    if (!drag) return 0
    if (index === drag.from) return drag.dy
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return -drag.step
    if (drag.from > drag.over && index >= drag.over && index < drag.from) return drag.step
    return 0
  }

  return (
    <div className={styles.annotations}>
      <div className={styles.scroll}>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {editable
              ? 'Mark places, routes and areas on the map. Annotations sit on top of the data and never change it.'
              : 'No annotations on this map.'}
          </p>
        ) : (
          <ul className={styles.list} aria-label="Annotation layers">
            {items.map((item, index) => {
              const selected = item.id === selectedId
              const editing = item.id === editingId
              const dragged = drag?.id === item.id
              const shift = rowShift(index)
              return (
                <li
                  key={item.id}
                  className={[
                    styles.row,
                    selected || editing ? styles.rowSelected : '',
                    item.visible ? '' : styles.rowHidden,
                    dragged ? styles.rowDragging : '',
                    drag && !dragged ? styles.rowShifting : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={shift ? { transform: `translateY(${shift}px)` } : undefined}
                >
                  {editable ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className={styles.dragHandle}
                      aria-label={`Reorder ${item.name}`}
                      title="Drag to reorder"
                      onPointerDown={(event) => startDrag(event, item.id, index)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(event) => reorderByKey(event, index)}
                    >
                      <DotsSixVertical size={14} weight="bold" aria-hidden />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.rowMain}
                    disabled={!editable}
                    aria-pressed={editable ? selected : undefined}
                    aria-label={item.name}
                    onClick={() => onSelect(selected ? null : item.id)}
                  >
                    <span className={styles.itemIcon} style={{ color: item.style.color }}>
                      {TOOL_ICONS[item.tool](14)}
                    </span>
                    <span className={styles.rowCopy}>
                      <span className={styles.rowName}>{item.name}</span>
                      <MarqueeText className={styles.rowMeta} text={rowMeta(item)} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn}${item.visible ? '' : ` ${styles.iconBtnOff}`}`}
                    aria-label={`${item.visible ? 'Hide' : 'Show'} ${item.name}`}
                    title={item.visible ? 'Hide' : 'Show'}
                    aria-pressed={!item.visible}
                    onClick={() => onChange(item.id, { visible: !item.visible })}
                  >
                    {item.visible ? <Eye size={16} weight="regular" aria-hidden /> : <EyeSlash size={16} weight="regular" aria-hidden />}
                  </button>
                  {editable ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.iconBtn}${editing ? ` ${styles.iconBtnActive}` : ''}`}
                        aria-label={`Edit ${item.name} shape`}
                        title={editing ? 'Done editing' : 'Edit shape'}
                        aria-pressed={editing}
                        onClick={() => (editing ? onFinishEditing() : onEdit(item.id))}
                      >
                        {editing ? (
                          <Check size={16} weight="bold" aria-hidden />
                        ) : (
                          <PencilSimple size={16} weight="regular" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        data-layer-popover-trigger
                        className={`${styles.iconBtn}${popover?.id === item.id ? ` ${styles.iconBtnActive}` : ''}`}
                        aria-label={`More options for ${item.name}`}
                        title="More options"
                        aria-haspopup="menu"
                        aria-expanded={popover?.id === item.id}
                        onClick={(event) => togglePopover(item.id, event.currentTarget)}
                      >
                        <DotsThree size={16} weight="bold" aria-hidden />
                      </button>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {editable ? (
        <div className={styles.footer}>
          {drawing ? (
            <DrawingBar drawing={drawing} onFinish={onFinishDrawing} onUndo={onUndoDrawing} onCancel={onCancelDrawing} />
          ) : editingItem ? (
            <EditingBar item={editingItem} onDone={onFinishEditing} onCancel={onCancelEditing} />
          ) : (
            <ToolBar onStart={onStartDrawing} />
          )}
        </div>
      ) : null}
      {popover && popoverItem ? (
        <LayerPopover
          popover={popover}
          item={popoverItem}
          onChange={(patch) => onChange(popoverItem.id, patch)}
          onDelete={() => {
            setPopover(null)
            onDelete(popoverItem.id)
          }}
          onClose={closePopover}
        />
      ) : null}
    </div>
  )
}
