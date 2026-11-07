import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowUUpLeft,
  ArrowUUpRight,
  CaretDown,
  CaretRight,
  ChatCircle,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Code,
  Columns,
  Cursor,
  Flask,
  FloppyDisk,
  FlowArrow,
  FrameCorners,
  Hand,
  type Icon,
  Lightning,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NoteBlank,
  PaintBrush,
  Pause,
  Play,
  Palette,
  Plus,
  Rectangle,
  Scan,
  Shapes,
  ShareNetwork,
  SlidersHorizontal,
  Stop,
  Swatches,
  TextT,
  Toolbox,
  TreeStructure,
  XCircle,
} from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import { llumenAssets } from '../llumen-assistant/assets'
import { HubChatbox } from '../llumen-assistant/landing/HubChatbox'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { useCoverPage } from '../llumen-assistant/pageCover'
import { autoLayout, type MeasuredNode } from './autoLayout'
import { freeSpot, NODE_GAP, pushApart, type NodeBoxes } from './nodeCollision'
import { NodeCardSections } from './NodeCardSections'
import { AppearancePanel } from './AppearancePanel'
import { AmbientLayer } from './AmbientLayer'
import { ambientDrawStyle } from './canvasAmbient'
import { CanvasLookPanel } from './CanvasLookPanel'
import {
  boundsOf,
  COMMENT_AUTHOR,
  commentPoint,
  nextSectionName,
  placeComment,
  rectContains,
  rectContainsPoint,
  rectsTouch,
  rectFromPoints,
  SECTION_DEFAULT_SIZE,
  SECTION_DEFAULTS,
  SECTION_FIT_PADDING,
  SECTION_MIN_SIZE,
  TEXT_DEFAULT_SIZE,
  type CanvasComment,
  type CommentMessage,
  type CanvasSection,
  type CanvasText,
  type CanvasTool,
  type Rect,
} from './canvasItems'
import {
  CommentComposer,
  CommentPin,
  CommentThread,
  SectionToolbar,
  SectionView,
  TextToolbar,
  TextView,
  type GestureHandlers,
  type SectionCorner,
} from './CanvasItemViews'
import itemStyles from './CanvasItems.module.css'
import { CanvasTooltip } from './CanvasTooltip'
import { annotateTestFlow, buildTestWorkflow, type TestFlowKind } from './testWorkflow'
import { NodeToolbar } from './NodeToolbar'
import { NodeActionsBar } from './NodeActionsBar'
import { InsertNodePanel } from './InsertNodePanel'
import { CanvasMinimap } from './CanvasMinimap'
import { StickyNoteCard } from './StickyNoteCard'
import { StickyToolbar } from './StickyToolbar'
import { STICKY_MIN_SIZE, stickyFill, stickyStyle, type StickyStyle } from './stickyNote'
import { defaultTriggerId, executableTriggers, type FlowState } from './triggerCard'
import { nodeDataSides, nodeDataViews } from './cardSections'
import { NodeConfigWindow, type NeighbourNode, type UpstreamNode } from './NodeConfigWindow'
import { NodeDataDialog, type DataGroup } from './NodeDataDialog'
import { SHORTCUTS } from './shortcuts'
import {
  DEFAULT_CANVAS_LOOK,
  cardBlur,
  hexToRgb,
  readCanvasLook,
  saveCanvasLook,
  tintCss,
  type CanvasDots,
  type CanvasLook,
  type RunOutcome,
} from './canvasLook'
import { NodeFill } from './nodeParts'
import {
  copyAppearance,
  saveAppearances,
  withSavedAppearances,
  type AppearancePart,
  type ApplyScope,
  type NodeAppearance,
} from './nodeAppearance'
import type { ChatReply } from './chatMessage'
import type { InputSource, PortHandlers, ResizeEdge, RunScope } from './nodeParts'
import { useDismiss } from './useDismiss'
import { NodeLibrarySheet } from './NodeLibrarySheet'
import { buildShowcase, layoutShowcase, type CanvasGroupLabel } from './showcase'
import { nodeAliases, planRun, runRows, type PlannedStep } from './nodeRuntime'
import { addBranch, addInput, kindInputLayers, kindWiringIssue, removeBranch, removeInput, type AnyParams, type WiredStep } from './nodeKinds'
import { currentProblemKeys, needsInput, type ProblemAction } from './nodeProblems'
import {
  createNode,
  isAnnotation,
  nodeInputs,
  nodeIssue,
  nodeName,
  nodeOutputs,
  NODE_DEFAULT_WIDTH,
  NODE_DRAG_MIME,
  NODE_CATEGORIES,
  NODE_MIN_WIDTH,
  NODE_TYPES_BY_ID,
  portKey,
  type CanvasNode,
  type DataRecord,
  type NodeConfig,
  type NodeRun,
  type NodeSettings,
  type NodeType,
  type Point,
  type PortRef,
  type PortSide,
  type Size,
  type WorkflowEdge,
} from './nodeCatalog'
import { cardLayout, categoryVars, readCardGlow, saveCardGlow, type CardGlowConfig } from './cardGlow'
import { CardStylePanel } from './CardStylePanel'
import { RayShader, SmokeShader } from './CanvasShader'
import { ExecutionsList, type Execution, type ExecutionStatus } from './ExecutionsList'
import { RunFailureToast, type FailedStep } from './RunFailureToast'
import styles from './AgentCanvas.module.css'

const GRID_SIZE = 20
/** Double-clicks on these stay with the card instead of opening its configuration. */
const CARD_INTERACTIVE =
  'button, input, textarea, select, a, [contenteditable="true"], [role="tab"], [role="tablist"], [role="tabpanel"], [data-node-interactive]'

/** The card's built-in padding and corner radius (px), shown by the appearance sliders. */
const FRAME_DEFAULTS = { padding: 16, radius: 20 }

/** Freezes the background shaders and ambient layer on their current frame. */
const SHADER_PAUSED_KEY = 'llumen.shaderPaused'

function readShaderPaused() {
  try {
    return localStorage.getItem(SHADER_PAUSED_KEY) === 'on'
  } catch {
    return false
  }
}

/** `split`: insert, nodes and canvas controls in three bars. `single`: all of them in one bar in the centre. */
type ToolbarStyle = 'split' | 'single'
const TOOLBAR_STYLE_KEY = 'llumen.toolbarStyle'

function readToolbarStyle(): ToolbarStyle {
  try {
    return localStorage.getItem(TOOLBAR_STYLE_KEY) === 'single' ? 'single' : 'split'
  } catch {
    return 'split'
  }
}

/** The canvas spans a few node widths; scale the mesh blur so it stays as soft. */
const CANVAS_BLUR_SCALE = 5
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2
const BUTTON_ZOOM_STEP = 1.2
const ZOOM_ANIMATION_MS = 220
const ARRANGE_ANIMATION_MS = 420
const FIT_PADDING = 120
/** Playback time per node; longer steps take a little longer, and each varies so a run reads as sequential work. */
const RUN_STEP_MS = 600
const RUN_STEP_MAX_MS = 1500
const RUN_SKIP_MS = 90
/** A wait plays in real time up to this, then as a time-lapse of its full length, so it still reads as a countdown. */
const WAIT_PLAY_MAX_MS = 6000

type Viewport = { x: number; y: number; zoom: number }
type Positions = Record<string, Point>
type Tab = 'builder' | 'executions'
type CanvasDoc = {
  nodes: CanvasNode[]
  positions: Positions
  edges: WorkflowEdge[]
  groups: CanvasGroupLabel[]
  sections: CanvasSection[]
  texts: CanvasText[]
  comments: CanvasComment[]
}
/** `typeTitle` is set only when the node was renamed, so the menu can say which kind of trigger it is. */
type TriggerOption = { id: string; title: string; typeTitle?: string; icon: Icon }
/** What Copy or Cut took: the nodes with their places and sizes, and the lines between them. */
type Clipboard = { nodes: readonly { node: CanvasNode; position: Point; size: Size }[]; edges: readonly WorkflowEdge[] }
type ItemKind = 'section' | 'text' | 'comment'
type Selection =
  | { kind: 'node' | 'edge' | ItemKind; id: string }
  /** Two or more nodes and lines, picked with the selection box or Shift-click. */
  | { kind: 'many'; nodes: readonly string[]; edges: readonly string[] }
  | null

const selectedIds = (selection: Selection, kind: 'node' | 'edge'): readonly string[] => {
  if (!selection) return []
  if (selection.kind === 'many') return kind === 'node' ? selection.nodes : selection.edges
  return selection.kind === kind ? [selection.id] : []
}

/** A single pick stays a plain selection so its toolbar shows. */
function pickedSelection(nodes: readonly string[], edges: readonly string[]): Selection {
  if (nodes.length + edges.length > 1) return { kind: 'many', nodes, edges }
  if (nodes[0]) return { kind: 'node', id: nodes[0] }
  if (edges[0]) return { kind: 'edge', id: edges[0] }
  return null
}

const toggled = (ids: readonly string[], id: string) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
/** A pointer drag on a section, text, or comment; `apply` gets the offset in world units. */
type Gesture = {
  pointerId: number
  startX: number
  startY: number
  snapshot: CanvasDoc
  moved: boolean
  apply: (dx: number, dy: number) => void
  /** Runs once on release after a drag. */
  finish?: (doc: CanvasDoc) => CanvasDoc
  /** Runs once on release after a drag, for work that isn't a single doc update. */
  release?: () => void
}
/** Where everything inside a section started, so a section drag can carry it along. */
type SectionMembers = {
  nodes: Positions
  sections: Positions
  texts: Positions
  comments: Positions
}
/** An edge being drawn from a port; `target` is the port it would snap to on release. */
type Connection = {
  /** The end that stays put; the other follows the pointer. */
  from: PortRef
  pointer: Point
  /** The port the line will land on, snapped from nearby. */
  target: PortRef | null
  /** Over open canvas, where letting go offers a new node to connect. */
  free: boolean
  /** The line being moved, when an existing one was picked up. */
  edgeId?: string
}
/** A line dropped on open canvas, waiting for a node from the insert panel. */
type PendingInsert = { from: PortRef; point: Point; edgeId?: string }

const SHOWCASE = buildShowcase()
const DEFAULT_NODE_SIZE: Size = { w: NODE_DEFAULT_WIDTH, h: 120 }
/** Room left before a node added after the right-most one in view. */
const ADD_GAP = 80
const DUPLICATE_OFFSET = 40

type ScreenArea = { left: number; top: number; right: number; bottom: number }

const areaSize = (area: ScreenArea) => Math.max(0, area.right - area.left) * Math.max(0, area.bottom - area.top)

const overlaps = (a: ScreenArea, b: ScreenArea) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** Where the `[data-covers-canvas]` panels sit over the canvas, in the canvas's own pixels. */
function coveringPanels(root: HTMLElement): ScreenArea[] {
  const bounds = root.getBoundingClientRect()
  return [...document.querySelectorAll('[data-covers-canvas]')].map((panel) => {
    const rect = panel.getBoundingClientRect()
    return { left: rect.left - bounds.left, top: rect.top - bounds.top, right: rect.right - bounds.left, bottom: rect.bottom - bounds.top }
  })
}

/** The largest part of the canvas no panel sits over. */
function openArea(root: HTMLElement, panels: readonly ScreenArea[]): ScreenArea {
  let area: ScreenArea = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight }
  for (const box of panels) {
    const sides: ScreenArea[] = [
      { ...area, bottom: Math.min(area.bottom, box.top) },
      { ...area, top: Math.max(area.top, box.bottom) },
      { ...area, right: Math.min(area.right, box.left) },
      { ...area, left: Math.max(area.left, box.right) },
    ]
    area = sides.reduce((best, side) => (areaSize(side) > areaSize(best) ? side : best))
  }
  return area
}
const IDLE: NodeRun = { status: 'idle' }

/** Which document the canvas shows: every node type, or one of the connected test flows for trying runs. */
type CanvasMode = 'showcase' | TestFlowKind
/** Everything a mode keeps while another one is on screen. */
type ModeSnapshot = { doc: CanvasDoc; past: CanvasDoc[]; future: CanvasDoc[]; runs: Record<string, NodeRun> }

function testFlowDoc(kind: TestFlowKind): CanvasDoc {
  const { nodes: built, edges } = buildTestWorkflow(kind)
  const nodes = withSavedAppearances(built)
  // Rough positions from default card sizes, centred on the origin; the canvas tidies again once the cards are measured.
  const origin = Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }]))
  const { positions, groups } = autoLayout(nodes, edges, {}, origin)
  return withTestAnnotations(kind, { nodes, positions, edges, groups, sections: [], texts: [], comments: [] }, {})
}

/** A saved test flow opens instead of the built-in one until it's reset. */
const testFlowKey = (kind: TestFlowKind) => `llumen.testFlow.${kind}`

function readSavedFlow(kind: TestFlowKind): CanvasDoc | null {
  try {
    const saved = JSON.parse(localStorage.getItem(testFlowKey(kind)) ?? 'null') as Partial<CanvasDoc> | null
    if (!saved || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges) || !saved.positions) return null
    return {
      nodes: saved.nodes.filter((node) => NODE_TYPES_BY_ID[node.type]),
      positions: saved.positions,
      edges: saved.edges,
      groups: saved.groups ?? [],
      sections: saved.sections ?? [],
      texts: saved.texts ?? [],
      comments: saved.comments ?? [],
    }
  } catch {
    return null
  }
}

function hasSavedFlow(kind: TestFlowKind) {
  try {
    return localStorage.getItem(testFlowKey(kind)) !== null
  } catch {
    return false
  }
}

/** Frames the laid-out test flow with its sections, texts, and comments, and seats its sticky notes beside the flow. */
function withTestAnnotations(kind: TestFlowKind, doc: CanvasDoc, layouts: Record<string, Size>): CanvasDoc {
  const { notes, sections, texts, comments } = annotateTestFlow(kind, doc.positions, (id) => layouts[id] ?? DEFAULT_NODE_SIZE)
  return {
    ...doc,
    positions: { ...doc.positions, ...notes },
    groups: doc.groups.filter((group) => group.id !== 'annotations'),
    sections,
    texts,
    comments,
  }
}
/** Pointer travel (screen px) before a press on a canvas item becomes a drag. */
const DRAG_THRESHOLD = 3
/** Room above a selected item for its floating toolbar, and the header's height to stay clear of. */
const ITEM_TOOLBAR_GAP = 56
const SECTION_TITLE_HEIGHT = 32
const CHROME_TOP = 84
/** Height of the bottom dock (insert bar, history and zoom) with a margin above it. */
const CHROME_BOTTOM = 72
/** Screen gap between a node and its toolbar, and the toolbar's height. */
const NODE_TOOLBAR_GAP = 6
const NODE_TOOLBAR_HEIGHT = 44
const NODE_ACTIONS_HEIGHT = 36
/** How long the toolbar stays after the pointer leaves its node, so it can cross the gap to the bar. */
const NODE_TOOLBAR_LEAVE_MS = 250
/** At or below this zoom, as the zoom readout rounds it, the ports hide; they still show while connecting. */
const PORTS_MIN_ZOOM = 0.3
/** World distance around a node within which its ports show; it scales with the node, so it reads the same at any zoom. */
const PORT_REACH = 60
/** Screen distance at which a dragged line snaps to a port. */
const PORT_SNAP = 28
/** Room between a dropped line's end and the new node it offers. */
const INSERT_GAP = 16
/** How far the insert panel's top sits above the line, so its header lines up with it. */
const INSERT_PANEL_LIFT = 28
/** How far under a line's + the add-node panel opens, in screen pixels: clear of the button. */
const SPLIT_PANEL_DROP = 24
/** Room each side of a node put into a line: twice the usual, so both lines stay long enough to read. */
const SPLIT_GAP = NODE_GAP * 2
/** Pointer travel before pressing a line picks it up rather than selecting it. */
const EDGE_DRAG_THRESHOLD = 4
/** How far the line from a clicked output dot reaches before the insert panel. */
const PORT_CLICK_REACH = 80
/** World gap between an edge's end and its port dot. */
const EDGE_PORT_GAP = 4

type ToolOption = { id: CanvasTool; label: string; shortcut: string; icon: Icon }
const POINTER_TOOLS: readonly ToolOption[] = [
  { id: 'select', label: 'Select', shortcut: SHORTCUTS.select, icon: Cursor },
  { id: 'hand', label: 'Hand tool', shortcut: SHORTCUTS.hand, icon: Hand },
]
const CONTENT_TOOLS: readonly ToolOption[] = [
  { id: 'sticky', label: 'Sticky note', shortcut: SHORTCUTS.sticky, icon: NoteBlank },
  { id: 'comment', label: 'Comment', shortcut: SHORTCUTS.comment, icon: ChatCircle },
  { id: 'text', label: 'Text', shortcut: SHORTCUTS.text, icon: TextT },
  { id: 'section', label: 'Section', shortcut: SHORTCUTS.section, icon: FrameCorners },
]

function shortcutTool(event: KeyboardEvent): CanvasTool | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  if (event.code === 'KeyS') return event.shiftKey ? 'section' : 'sticky'
  if (event.shiftKey) return null
  return ({ KeyV: 'select', KeyH: 'hand', KeyT: 'text', KeyC: 'comment' } as Record<string, CanvasTool>)[event.code] ?? null
}

function newMessage(text: string): CommentMessage {
  return { id: createId('message'), text, author: COMMENT_AUTHOR, createdAt: Date.now() }
}

function withoutItem(doc: CanvasDoc, kind: ItemKind, id: string): CanvasDoc {
  const keep = (item: { id: string }) => item.id !== id
  if (kind === 'section') return { ...doc, sections: doc.sections.filter(keep) }
  if (kind === 'text') return { ...doc, texts: doc.texts.filter(keep) }
  return { ...doc, comments: doc.comments.filter(keep) }
}

/** The boxes of the nodes that keep their distance; sticky notes can sit anywhere, and unmeasured nodes wait. */
function collisionBoxes(doc: CanvasDoc, positions: Positions, sizes: Readonly<Record<string, Size>>): NodeBoxes {
  return Object.fromEntries(
    doc.nodes.flatMap((node) => {
      const position = positions[node.id]
      const size = sizes[node.id]
      return position && size && !isAnnotation(NODE_TYPES_BY_ID[node.type]) ? [[node.id, { ...position, w: size.w, h: size.h }]] : []
    }),
  )
}

/** Pushes whatever crowds the `fixed` nodes out of their way, and so on down the line. */
function makeRoom(doc: CanvasDoc, fixed: ReadonlySet<string>, sizes: Readonly<Record<string, Size>>): CanvasDoc {
  const moved = pushApart(collisionBoxes(doc, doc.positions, sizes), fixed)
  return Object.keys(moved).length > 0 ? { ...doc, positions: { ...doc.positions, ...moved } } : doc
}

/** The dragged nodes, `by` from where the drag picked them up. */
function shiftNodes(doc: CanvasDoc, origins: Positions, by: Point): CanvasDoc {
  const moved = Object.fromEntries(Object.entries(origins).map(([id, origin]) => [id, { x: origin.x + by.x, y: origin.y + by.y }]))
  return { ...doc, positions: { ...doc.positions, ...moved } }
}

/** New nodes move to the nearest free spot, leaving the rest as they are; nodes that grew push their neighbours. */
function settleNodes(doc: CanvasDoc, sizes: Readonly<Record<string, Size>>, added: readonly string[], grown: ReadonlySet<string>): CanvasDoc {
  let positions = doc.positions
  const waiting = new Set(added)
  for (const id of added) {
    waiting.delete(id)
    const boxes = collisionBoxes(doc, positions, sizes)
    const box = boxes[id]
    if (!box) continue
    const others = Object.entries(boxes).flatMap(([other, rect]) => (other === id || waiting.has(other) ? [] : [rect]))
    const spot = freeSpot(box, others)
    if (spot.x !== box.x || spot.y !== box.y) positions = { ...positions, [id]: spot }
  }
  if (grown.size > 0) positions = { ...positions, ...pushApart(collisionBoxes(doc, positions, sizes), grown) }
  return positions === doc.positions ? doc : { ...doc, positions }
}

function moveMembers(doc: CanvasDoc, members: SectionMembers, dx: number, dy: number): CanvasDoc {
  const shifted = (origin: Point) => ({ x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) })
  const move = <T extends Point & { id: string }>(items: T[], origins: Positions) =>
    items.map((item) => (origins[item.id] ? { ...item, ...shifted(origins[item.id]) } : item))
  const positions = { ...doc.positions }
  for (const [id, origin] of Object.entries(members.nodes)) positions[id] = shifted(origin)
  return {
    ...doc,
    positions,
    sections: move(doc.sections, members.sections),
    texts: move(doc.texts, members.texts),
    comments: move(doc.comments, members.comments),
  }
}

function resizedRect(origin: Rect, corner: SectionCorner, dx: number, dy: number): Rect {
  const right = origin.x + origin.w
  const bottom = origin.y + origin.h
  const x = corner.includes('w') ? Math.min(origin.x + dx, right - SECTION_MIN_SIZE) : origin.x
  const y = corner.includes('n') ? Math.min(origin.y + dy, bottom - SECTION_MIN_SIZE) : origin.y
  const w = corner.includes('w') ? right - x : Math.max(SECTION_MIN_SIZE, origin.w + dx)
  const h = corner.includes('n') ? bottom - y : Math.max(SECTION_MIN_SIZE, origin.h + dy)
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

function zoomedView(current: Viewport, screenX: number, screenY: number, factor: number): Viewport {
  const zoom = clampZoom(current.zoom * factor)
  const ratio = zoom / current.zoom
  return {
    zoom,
    x: screenX - (screenX - current.x) * ratio,
    y: screenY - (screenY - current.y) * ratio,
  }
}

/** Share of each zoom level (just before the grid doubles) over which the in-between dots fade in. */
const GRID_FADE_BAND = 0.1

/** Read by node cards: the blur behind them, the ports, and the failure colour. */
function cardStyle({ cards, ports, ambient, result }: CanvasLook): CSSProperties {
  const blur = cardBlur(cards, ambient)
  return {
    '--card-backdrop': blur > 0 ? `blur(${blur}px)` : 'none',
    '--canvas-port-size': `${ports.size}px`,
    '--port-fill': tintCss(ports.fill),
    '--port-line': tintCss(ports.border),
    '--port-line-width': `${ports.borderWidth}px`,
    '--run-fail-rgb': hexToRgb(result.fail.color),
  } as CSSProperties
}

/** Read by node cards: their padding and corner radius, and under `[data-section-surface]` the fill picked in the card style panel. */
function cardLookStyle(config: CardGlowConfig): CSSProperties {
  const { padding, radius } = cardLayout(config)
  const { surface } = config
  const top = tintCss(surface.top)
  return {
    '--canvas-card-pad': `${padding}px`,
    '--canvas-card-radius': `${radius}px`,
    '--section-card-top': top,
    '--section-card-bottom': surface.fill === 'gradient' ? tintCss(surface.bottom) : top,
  } as CSSProperties
}

function resultGlowStyle(result: CanvasLook['result'], outcome: RunOutcome): CSSProperties {
  const glow = result[outcome]
  return {
    '--result-rgb': hexToRgb(glow.color),
    '--result-alpha': glow.opacity,
    '--result-intensity': glow.intensity,
    '--result-spread': `${glow.spread * 100}%`,
    '--result-height': `${glow.height * 100}%`,
    '--result-core': `${Math.round(50 - glow.softness * 40)}%`,
    '--result-fade': `${Math.round(60 + glow.softness * 40)}%`,
    '--result-pulse': glow.pulse,
    '--result-pulse-seconds': `${glow.pulseSeconds}s`,
    '--result-seconds': `${result.seconds}s`,
  } as CSSProperties
}

/**
 * FigJam-style dot grid: dots keep a fixed screen size, and spacing stays between one and two
 * GRID_SIZE steps by doubling or halving the world grid. Just before the spacing doubles, a
 * half-step layer fades in so switching levels never pops; the rest of the time every dot is
 * identical. Spacing and offsets stay fractional: rounding them makes the grid step behind the
 * content while panning and zooming.
 */
function gridStyle(view: Viewport, dots: CanvasDots) {
  const raw = GRID_SIZE * view.zoom
  const step = raw / 2 ** Math.floor(Math.log2(raw / GRID_SIZE))
  const minorStep = step / 2
  const progress = Math.min(1, Math.max(0, (step / GRID_SIZE - 1 - (1 - GRID_FADE_BAND)) / GRID_FADE_BAND))
  const minorAlpha = progress * progress * (3 - 2 * progress)
  const rgb = hexToRgb(dots.color)
  const dot = (alpha: number) =>
    `radial-gradient(circle, rgba(${rgb}, ${alpha * dots.opacity}) ${dots.size}px, transparent ${dots.size + 0.5}px)`
  const { x, y } = view
  const layers = [`${dot(1)}`]
  const sizes = [`${step}px ${step}px`]
  const positions = [`${x - minorStep}px ${y - minorStep}px`]
  if (minorAlpha > 0) {
    layers.push(dot(minorAlpha))
    sizes.push(`${minorStep}px ${minorStep}px`)
    positions.push(`${x - minorStep / 2}px ${y - minorStep / 2}px`)
  }
  return { backgroundImage: layers.join(', '), backgroundSize: sizes.join(', '), backgroundPosition: positions.join(', ') }
}

let lastCreatedId = 0
/** Ids for nodes and edges created in the editor; `~` keeps them apart from the showcase's `type-1` ids. */
function createId(prefix: string) {
  lastCreatedId += 1
  return `${prefix}~${lastCreatedId}`
}
/** Showcase and test-flow nodes come back on reload; created ones don't, and their ids restart, so their looks aren't saved. */
const isBuiltInNode = (node: CanvasNode) => !node.id.includes('~')

const layoutPortKey = (side: PortSide, portId: string) => `${side}:${portId}`

function fitViewport(doc: CanvasDoc, layouts: Record<string, Size>, width: number, height: number): Viewport | null {
  if (doc.nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const include = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const node of doc.nodes) {
    const position = doc.positions[node.id]
    const size = layouts[node.id] ?? DEFAULT_NODE_SIZE
    include(position.x, position.y, size.w, size.h)
  }
  for (const section of doc.sections) include(section.x, section.y - SECTION_TITLE_HEIGHT, section.w, section.h + SECTION_TITLE_HEIGHT)
  // Texts aren't measured; their width is estimated from the glyph count.
  for (const text of doc.texts) include(text.x, text.y, text.text.length * text.size * 0.55, text.size * 1.3)
  const zoom = clampZoom(
    Math.min(1.25, (width - FIT_PADDING * 2) / (maxX - minX), (height - FIT_PADDING * 2) / (maxY - minY)),
  )
  return {
    zoom,
    x: width / 2 - ((minX + maxX) / 2) * zoom,
    y: height / 2 - ((minY + maxY) / 2) * zoom,
  }
}

function edgeControls(a: Point, b: Point): [Point, Point] {
  const dx = b.x > a.x ? Math.max((b.x - a.x) / 2, 40) : 90
  return [
    { x: a.x + dx, y: a.y },
    { x: b.x - dx, y: b.y },
  ]
}

function bezierPoint(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  }
}

/** The start node followed by everything reachable downstream of it, breadth first. */
function downstreamOrder(startId: string, edges: readonly WorkflowEdge[]) {
  const reach = [startId]
  for (let index = 0; index < reach.length; index += 1) {
    for (const edge of edges) {
      if (edge.from === reach[index] && !reach.includes(edge.to)) reach.push(edge.to)
    }
  }
  /** Parents before children, so a node with several inputs runs after all of them; ties keep the breadth-first order. */
  const inner = edges.filter((edge) => reach.includes(edge.from) && reach.includes(edge.to) && edge.from !== edge.to && edge.to !== startId)
  const waiting = new Map(reach.map((id) => [id, inner.filter((edge) => edge.to === id).length]))
  const ready = reach.filter((id) => waiting.get(id) === 0)
  const order: string[] = []
  while (ready.length) {
    const id = ready.shift() as string
    order.push(id)
    for (const edge of inner) {
      if (edge.from !== id) continue
      const left = (waiting.get(edge.to) ?? 0) - 1
      waiting.set(edge.to, left)
      if (left === 0) {
        ready.push(edge.to)
        ready.sort((a, b) => reach.indexOf(a) - reach.indexOf(b))
      }
    }
  }
  return [...order, ...reach.filter((id) => !order.includes(id))]
}

/** Every ancestor of the node, parents before children, so running them in order feeds each one its input. */
function upstreamOrder(nodeId: string, edges: readonly WorkflowEdge[]) {
  const order: string[] = []
  const visit = (id: string, trail: ReadonlySet<string>) => {
    for (const edge of edges) {
      if (edge.to !== id || trail.has(edge.from) || order.includes(edge.from)) continue
      visit(edge.from, new Set([...trail, edge.from]))
      order.push(edge.from)
    }
  }
  visit(nodeId, new Set([nodeId]))
  return order
}

/** Ancestors nearest first, breadth first from the node. */
function ancestorsNearestFirst(nodeId: string, edges: readonly WorkflowEdge[]) {
  const order = [nodeId]
  for (let index = 0; index < order.length; index += 1) {
    for (const edge of edges) {
      if (edge.to === order[index] && !order.includes(edge.from)) order.push(edge.from)
    }
  }
  return order.slice(1)
}

type AgentCanvasProps = {
  name: string
  workspace?: string
  onClose: () => void
}

export function AgentCanvas({ name, workspace, onClose }: AgentCanvasProps) {
  useCoverPage()
  const rootRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [view, setView] = useState<Viewport>(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    zoom: 1,
  }))
  const viewRef = useRef(view)
  const frameRef = useRef<number | null>(null)
  const arrangeFrameRef = useRef<number | null>(null)
  const [doc, setDoc] = useState<CanvasDoc>(() => ({
    nodes: withSavedAppearances(SHOWCASE.nodes),
    positions: layoutShowcase(SHOWCASE.columns, {}).positions,
    edges: [],
    groups: [],
    sections: [],
    texts: [],
    comments: [],
  }))
  const docRef = useRef(doc)
  const [past, setPast] = useState<CanvasDoc[]>([])
  const [future, setFuture] = useState<CanvasDoc[]>([])
  const [layouts, setLayouts] = useState<Record<string, MeasuredNode>>({})
  /** The last measure, for spotting nodes that grew or just appeared. */
  const measuredRef = useRef<Record<string, MeasuredNode>>({})
  const [runs, setRuns] = useState<Record<string, NodeRun>>(SHOWCASE.runs)
  const runTimersRef = useRef<number[]>([])
  /** A flow run parked on Send and wait: the steps it still owes and how it was started, for the reply to resume. */
  const parkedRunRef = useRef<{
    pending: readonly string[]
    triggerId?: string
    simulate?: RunOutcome
    forcedFailure?: string
    failures: readonly FailedStep[]
    /** Set when the parked run is an execution of the published agent. */
    executionId?: string
  } | null>(null)
  const [activeRuns, setActiveRuns] = useState(0)
  /**
   * The last flow run's outcome while its glow shows; `id` restarts the glow for back-to-back results.
   * After a real run (`fromRun`), the canvas keeps its run look until the glow ends.
   */
  const [runResult, setRunResult] = useState<{ outcome: RunOutcome; id: number; fromRun: boolean } | null>(null)
  /** The steps the last flow run failed at; stays until dismissed or the next flow run. */
  const [runFailures, setRunFailures] = useState<readonly FailedStep[] | null>(null)
  const didInitialLayoutRef = useRef(false)
  const [panning, setPanning] = useState(false)
  const [draggingNodes, setDraggingNodes] = useState<ReadonlySet<string>>(() => new Set())
  /** Space held: drags pan, like the hand tool, until it's let go. */
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [tab, setTab] = useState<Tab>('builder')
  /** Runs started from Execute Agent, newest first; each flow keeps its own. */
  const [executions, setExecutions] = useState<Record<CanvasMode, readonly Execution[]>>({ showcase: [], simple: [], complex: [] })
  const [libraryOpen, setLibraryOpen] = useState(false)
  /** Schedules, webhooks, and chat only start the published Flow; their cards show what publishing assigns. */
  const [publishedAt, setPublishedAt] = useState<number | null>(null)
  const published = publishedAt !== null
  /** The trigger each run button starts from; null follows the flow's default. Simulated runs use the test one. */
  const [testTriggerId, setTestTriggerId] = useState<string | null>(null)
  const [executeTriggerId, setExecuteTriggerId] = useState<string | null>(null)
  const [cardLook, setCardLook] = useState<CardGlowConfig>(readCardGlow)
  const [cardStyleOpen, setCardStyleOpen] = useState(false)
  const updateCardLook = (next: CardGlowConfig) => {
    setCardLook(next)
    saveCardGlow(next)
  }
  const { trigger: triggerGlow, data: dataGlow, agents: agentsGlow, action: actionGlow } = cardLook.colors
  /** On the document root, so popovers and sheets rendered outside the canvas take the category colours too. */
  useEffect(() => {
    const root = document.documentElement
    const vars = categoryVars({ trigger: triggerGlow, data: dataGlow, agents: agentsGlow, action: actionGlow })
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name)
    }
  }, [triggerGlow, dataGlow, agentsGlow, actionGlow])
  const [appearanceFor, setAppearanceFor] = useState<string | null>(null)
  /** Nodes showing their input and output data. */
  const [dataOpen, setDataOpen] = useState<ReadonlySet<string>>(() => new Set())
  /** The node whose configuration window is open. */
  const [configuringId, setConfiguringId] = useState<string | null>(null)
  /** The node whose input and output are open over the canvas. */
  const [dataDialogId, setDataDialogId] = useState<string | null>(null)
  const closeDataDialog = useCallback(() => setDataDialogId(null), [])
  /** The node under the pointer, whose toolbar shows; kept while the pointer is on the toolbar itself. */
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const hoverLeaveRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(hoverLeaveRef.current), [])
  const leaveNodeHover = () => {
    window.clearTimeout(hoverLeaveRef.current)
    hoverLeaveRef.current = window.setTimeout(() => setHoveredNodeId(null), NODE_TOOLBAR_LEAVE_MS)
  }
  const onNodeHover = (event: ReactPointerEvent) => {
    const target = event.target as Element
    const id = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    if (!id && !target.closest('[data-node-toolbar]')) return leaveNodeHover()
    window.clearTimeout(hoverLeaveRef.current)
    if (id) setHoveredNodeId(id)
  }
  /** The branch the configuration window opened on, e.g. a case edited from the card. */
  const [configFocus, setConfigFocus] = useState<string | undefined>(undefined)
  const [configReveal, setConfigReveal] = useState<ProblemAction | undefined>(undefined)
  /** Hand-written test input per node; replaces the upstream rows until cleared. */
  const [fixtures, setFixtures] = useState<Readonly<Record<string, DataRecord[]>>>({})
  const [canvasLook, setCanvasLook] = useState<CanvasLook>(readCanvasLook)
  const [canvasLookOpen, setCanvasLookOpen] = useState(false)
  const canvasAmbient = canvasLook.ambient
  /** None and Smoke leave the ambient layer empty at rest; it still plays the run animation. */
  const ambient = useMemo(() => {
    const style = ambientDrawStyle(canvasAmbient.style)
    const idle = style === canvasAmbient.style ? canvasAmbient.idle : { ...canvasAmbient.idle, intensity: 0 }
    return { ...canvasAmbient, style, idle }
  }, [canvasAmbient])
  const [runPreview, setRunPreview] = useState(false)
  const [shaderPaused, setShaderPaused] = useState(readShaderPaused)
  const toggleShaderPaused = () => {
    const next = !shaderPaused
    setShaderPaused(next)
    try {
      localStorage.setItem(SHADER_PAUSED_KEY, next ? 'on' : 'off')
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
  }
  const [toolbarStyle, setToolbarStyle] = useState<ToolbarStyle>(readToolbarStyle)
  /** The single toolbar's flyouts: the node panel, or the bar of things to insert. */
  const [barFlyout, setBarFlyout] = useState<'nodes' | 'insert' | null>(null)
  const addNodeButtonRef = useRef<HTMLButtonElement>(null)
  const insertButtonRef = useRef<HTMLButtonElement>(null)
  const singleBarRef = useRef<HTMLDivElement>(null)
  /** Where the insert bar centres, in px from the toolbar's left edge. */
  const [insertBarX, setInsertBarX] = useState<number | null>(null)
  useLayoutEffect(() => {
    const button = insertButtonRef.current
    const bar = singleBarRef.current
    if (barFlyout !== 'insert' || !button || !bar) return
    const b = button.getBoundingClientRect()
    setInsertBarX(b.left + b.width / 2 - bar.getBoundingClientRect().left)
  }, [barFlyout])
  const chooseToolbarStyle = (next: ToolbarStyle) => {
    setToolbarStyle(next)
    setBarFlyout(null)
    try {
      localStorage.setItem(TOOLBAR_STYLE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
  }
  const closeBarFlyout = useCallback(() => setBarFlyout(null), [])
  const insertBarRef = useRef<HTMLDivElement>(null)
  useDismiss(barFlyout === 'insert', insertBarRef, closeBarFlyout, insertButtonRef)
  const [mode, setMode] = useState<CanvasMode>('showcase')
  /** The modes that are off screen; a test flow is built the first time it's opened. */
  const parkedModesRef = useRef<Partial<Record<CanvasMode, ModeSnapshot>>>({})
  /** After a mode switch, what to do once the new cards are measured: fit the view, or lay out a new test flow. */
  const pendingLayoutRef = useRef<'fit' | TestFlowKind | null>(null)
  /** Each test flow as it was last saved or laid out, to tell whether the canvas has unsaved edits. */
  const [flowBaselines, setFlowBaselines] = useState<Partial<Record<TestFlowKind, string>>>({})
  const [savedFlows, setSavedFlows] = useState<Record<TestFlowKind, boolean>>(() => ({ simple: hasSavedFlow('simple'), complex: hasSavedFlow('complex') }))
  /** History depth after the last live-edit push, so a run of slider or colour edits is one undo step. */
  const liveEditRef = useRef<{ key: string; depth: number } | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null)
  /** The line whose + was pressed, and its middle, where the add-node panel opens. */
  const [splitting, setSplitting] = useState<{ edgeId: string; at: Point } | null>(null)
  const splitButtonRef = useRef<HTMLButtonElement>(null)
  /** The node type pressed in the add panel, rendered off screen as the drag image. */
  const [dragGhost, setDragGhost] = useState<string | null>(null)
  const dragGhostRef = useRef<HTMLDivElement>(null)
  /** Nodes dropped onto the canvas and not yet measured; they keep their spot and push the others aside. */
  const droppedRef = useRef(new Set<string>())
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  /** A press on a line that becomes a drag of its nearer end once the pointer moves. */
  const edgePressRef = useRef<{ pointerId: number; edgeId: string; startX: number; startY: number } | null>(null)
  /** A press on an output dot; let go without moving, it opens the insert panel. */
  const portPressRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)
  /** A node just inserted from a dropped line; once measured it shifts so its port meets the line. */
  /** A new node's port to put at `at` once the card is measured; `levelOnly` moves it up or down only. */
  const alignRef = useRef<{ port: PortRef; at: Point; levelOnly?: boolean } | null>(null)
  const [tool, setTool] = useState<CanvasTool>('select')
  /** A tool press on the surface; the item is placed on release. */
  const placeRef = useRef<{ pointerId: number } | null>(null)
  const sectionDrawRef = useRef<{ pointerId: number; start: Point } | null>(null)
  const [sectionDraft, setSectionDraft] = useState<Rect | null>(null)
  /** A selection box drag from empty canvas; Shift adds to what was already selected. */
  const marqueeRef = useRef<{ pointerId: number; startX: number; startY: number; start: Point; base: Selection } | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [renamingSection, setRenamingSection] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState<Point | null>(null)
  const [editingText, setEditingText] = useState<string | null>(null)
  /** A new comment's spot, and the node it will pin to. */
  const [commentDraft, setCommentDraft] = useState<(Point & { nodeId?: string }) | null>(null)
  /** Node under the pointer while the comment tool is out. */
  const [commentHover, setCommentHover] = useState<string | undefined>()
  const gestureRef = useRef<Gesture | null>(null)
  const [toolbarGroup, setToolbarGroup] = useState<HTMLElement | null>(null)
  /** The ask orb's rect while the chat is open; the chat grows out of it, like the story composer. */
  const [chatFrom, setChatFrom] = useState<DOMRect | null>(null)
  const [chatCollapseToken, setChatCollapseToken] = useState(0)

  const panRef = useRef<{ pointerId: number; startX: number; startY: number; view: Viewport } | null>(null)
  const nearNodesRef = useRef<ReadonlySet<string>>(new Set())
  const dragRef = useRef<{
    pointerId: number
    id: string
    startX: number
    startY: number
    /** Where each moving node started; more than one when a picked group is dragged. */
    origins: Readonly<Record<string, Point>>
    /** A press on a node in a group that doesn't move narrows the selection to that node. */
    narrow: boolean
    snapshot: CanvasDoc
    moved: boolean
    /** How far the nodes have been taken so far. */
    offset: Point
  } | null>(null)
  const resizeRef = useRef<{
    pointerId: number
    id: string
    edge: ResizeEdge
    startX: number
    startY: number
    origin: Point & Size
    /** Height the content needs; the card can't shrink below it. */
    contentHeight: number
    snapshot: CanvasDoc
    moved: boolean
  } | null>(null)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // A layout effect, so the measuring below sees the doc it's measuring.
  useLayoutEffect(() => {
    docRef.current = doc
  }, [doc])

  useEffect(() => {
    saveAppearances(doc.nodes.filter(isBuiltInNode))
  }, [doc.nodes])

  useEffect(() => {
    const timers = runTimersRef.current
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  useEffect(() => stopAnimation, [stopAnimation])

  const stopArrange = useCallback(() => {
    if (arrangeFrameRef.current !== null) cancelAnimationFrame(arrangeFrameRef.current)
    arrangeFrameRef.current = null
  }, [])

  useEffect(() => stopArrange, [stopArrange])

  /** Animated in JS rather than with a CSS transition so the grid stays in step and text re-rasters crisply. */
  const animateTo = useCallback(
    (target: Viewport) => {
      stopAnimation()
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setView(target)
        return
      }
      const from = viewRef.current
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / ZOOM_ANIMATION_MS)
        const eased = 1 - (1 - progress) ** 3
        setView({
          x: from.x + (target.x - from.x) * eased,
          y: from.y + (target.y - from.y) * eased,
          zoom: from.zoom + (target.zoom - from.zoom) * eased,
        })
        frameRef.current = progress < 1 ? requestAnimationFrame(step) : null
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [stopAnimation],
  )

  const zoomAround = useCallback((screenX: number, screenY: number, factor: number) => {
    setView((current) => zoomedView(current, screenX, screenY, factor))
  }, [])

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const root = rootRef.current
      if (!root) return
      animateTo(zoomedView(viewRef.current, root.clientWidth / 2, root.clientHeight / 2, factor))
    },
    [animateTo],
  )

  const fitToView = useCallback(() => {
    const root = rootRef.current
    const target = root && fitViewport(doc, layouts, root.clientWidth, root.clientHeight)
    if (target) animateTo(target)
  }, [animateTo, doc, layouts])

  const undo = useCallback(() => {
    if (past.length === 0) return
    stopArrange()
    const previous = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((stack) => [doc, ...stack])
    setDoc(previous)
    setSelection(null)
  }, [doc, past, stopArrange])

  const redo = useCallback(() => {
    if (future.length === 0) return
    stopArrange()
    const [next, ...rest] = future
    setFuture(rest)
    setPast((stack) => [...stack, doc])
    setDoc(next)
    setSelection(null)
  }, [doc, future, stopArrange])

  const commit = useCallback(
    (next: CanvasDoc) => {
      setPast((stack) => [...stack, doc])
      setFuture([])
      setDoc(next)
    },
    [doc],
  )

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = rootRef.current?.getBoundingClientRect()
    const current = viewRef.current
    return {
      x: (clientX - (rect?.left ?? 0) - current.x) / current.zoom,
      y: (clientY - (rect?.top ?? 0) - current.y) / current.zoom,
    }
  }

  /**
   * Where something new of `size` goes: right after the selected node, the right-most one when several are, or with
   * nothing selected the right-most node in view. When that node is out of view or the spot after it is taken, it goes
   * in the middle of the view, or the nearest free spot around it. `reveal` is the view that brings it to the middle;
   * an add-node panel covering the middle moves that to the open part of the canvas.
   */
  const newSpot = (size: Size): { position: Point; reveal: Viewport } | null => {
    const root = rootRef.current
    if (!root) return null
    const view = viewRef.current
    const screen: ScreenArea = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight }
    const panels = coveringPanels(root)
    const onScreen = (box: Point & Size): ScreenArea => ({
      left: box.x * view.zoom + view.x,
      top: box.y * view.zoom + view.y,
      right: (box.x + box.w) * view.zoom + view.x,
      bottom: (box.y + box.h) * view.zoom + view.y,
    })
    const middle = { x: screen.right / 2, y: screen.bottom / 2 }
    const halfW = (size.w * view.zoom) / 2
    const halfH = (size.h * view.zoom) / 2
    const middleCovered = panels.some((panel) => overlaps({ left: middle.x - halfW, top: middle.y - halfH, right: middle.x + halfW, bottom: middle.y + halfH }, panel))
    const open = middleCovered ? openArea(root, panels) : null
    const focus = open ? { x: (open.left + open.right) / 2, y: (open.top + open.bottom) / 2 } : middle

    // Sticky notes too, unlike `collisionBoxes`: a new node shouldn't land on one.
    const boxes = doc.nodes.flatMap((node) => {
      const origin = doc.positions[node.id]
      const measured = layouts[node.id]
      return origin && measured ? [{ id: node.id, ...origin, w: measured.w, h: measured.h }] : []
    })
    const rightMost = (from: typeof boxes) =>
      from.reduce<(typeof boxes)[number] | null>((best, box) => (!best || box.x + box.w > best.x + best.w ? box : best), null)
    const picked = new Set(selectedIds(selection, 'node'))
    const anchor = picked.size ? rightMost(boxes.filter((box) => picked.has(box.id))) : rightMost(boxes.filter((box) => overlaps(onScreen(box), screen)))
    const last = anchor && overlaps(onScreen(anchor), screen) ? anchor : null
    const after = last && { x: last.x + last.w + ADD_GAP, y: last.y, ...size }
    const afterFree = after && freeSpot(after, boxes)
    const position =
      after && afterFree && afterFree.x === after.x && afterFree.y === after.y
        ? afterFree
        : freeSpot({ x: (focus.x - view.x) / view.zoom - size.w / 2, y: (focus.y - view.y) / view.zoom - size.h / 2, ...size }, boxes)
    const reveal = { zoom: view.zoom, x: focus.x - (position.x + size.w / 2) * view.zoom, y: focus.y - (position.y + size.h / 2) * view.zoom }
    return { position, reveal }
  }

  /** Pans, at the current zoom, so `box` (world coordinates) sits in the middle of the canvas. */
  const centreOn = (box: Point & Size) => {
    const root = rootRef.current
    if (!root) return
    const { zoom } = viewRef.current
    animateTo({ zoom, x: root.clientWidth / 2 - (box.x + box.w / 2) * zoom, y: root.clientHeight / 2 - (box.y + box.h / 2) * zoom })
  }

  /**
   * Adds a node, centred on `at` (world coordinates), where the pointer put it, or at `newSpot`, which the canvas pans
   * to; `height`, when the card's already been measured, makes `at` exact.
   */
  const addNode = (typeId: string, at?: Point, config?: NodeConfig, height = DEFAULT_NODE_SIZE.h) => {
    const type = NODE_TYPES_BY_ID[typeId]
    if (!type) return
    if (type.singleton && doc.nodes.some((node) => node.type === typeId)) return
    const id = createId(typeId)
    const size = { w: type.width ?? DEFAULT_NODE_SIZE.w, h: height }
    const spot = at ? { position: { x: at.x - size.w / 2, y: at.y - size.h / 2 }, reveal: null } : newSpot(size)
    if (!spot) return
    commit({ ...doc, nodes: [...doc.nodes, createNode(type, id, config)], positions: { ...doc.positions, [id]: spot.position } })
    setSelection({ kind: 'node', id })
    if (spot.reveal) animateTo(spot.reveal)
    return id
  }

  /** Removes nodes with the lines into and out of them, plus any other lines named. */
  const deleteObjects = useCallback(
    (nodeIds: readonly string[], edgeIds: readonly string[] = []) => {
      const gone = new Set(nodeIds.filter((id) => doc.nodes.some((node) => node.id === id)))
      const cut = new Set(edgeIds)
      if (gone.size === 0 && !doc.edges.some((edge) => cut.has(edge.id))) return
      const positions = { ...doc.positions }
      for (const id of gone) delete positions[id]
      commit({
        ...doc,
        nodes: doc.nodes.filter((node) => !gone.has(node.id)),
        positions,
        edges: doc.edges.filter((edge) => !cut.has(edge.id) && !gone.has(edge.from) && !gone.has(edge.to)),
        comments: doc.comments.map((comment) =>
          comment.nodeId && gone.has(comment.nodeId)
            ? placeComment(comment, commentPoint(comment, doc.positions), undefined, doc.positions)
            : comment,
        ),
      })
      setSelection(null)
    },
    [commit, doc],
  )
  const deleteNode = useCallback((id: string) => deleteObjects([id]), [deleteObjects])

  const deleteSelection = useCallback(() => {
    if (!selection) return
    if (selection.kind === 'node' || selection.kind === 'edge' || selection.kind === 'many') {
      deleteObjects(selectedIds(selection, 'node'), selectedIds(selection, 'edge'))
      return
    }
    commit(withoutItem(doc, selection.kind, selection.id))
    setSelection(null)
  }, [commit, deleteObjects, doc, selection])

  const duplicateNode = (id: string) => {
    const source = doc.nodes.find((node) => node.id === id)
    const position = doc.positions[id]
    if (!source || !position) return
    const type = NODE_TYPES_BY_ID[source.type]
    if (type.singleton) return
    const copyId = createId(source.type)
    commit({
      ...doc,
      nodes: [...doc.nodes, { ...source, id: copyId }],
      positions: { ...doc.positions, [copyId]: { x: position.x + DUPLICATE_OFFSET, y: position.y + DUPLICATE_OFFSET } },
    })
    setSelection({ kind: 'node', id: copyId })
  }

  const clipboardRef = useRef<Clipboard | null>(null)

  /** Copies the selected nodes and the lines between them; false when no node is selected. */
  const copySelection = () => {
    const picked = new Set(selectedIds(selection, 'node'))
    const nodes = doc.nodes.flatMap((node) => {
      const position = doc.positions[node.id]
      if (!picked.has(node.id) || !position) return []
      const measured = layouts[node.id]
      const size = measured ? { w: measured.w, h: measured.h } : { w: NODE_TYPES_BY_ID[node.type].width ?? DEFAULT_NODE_SIZE.w, h: DEFAULT_NODE_SIZE.h }
      return [{ node, position, size }]
    })
    if (!nodes.length) return false
    clipboardRef.current = { nodes, edges: doc.edges.filter((edge) => picked.has(edge.from) && picked.has(edge.to)) }
    return true
  }

  const cutSelection = () => {
    if (copySelection()) deleteObjects(selectedIds(selection, 'node'))
  }

  /**
   * Pastes the copied nodes as one block placed like a new node, each keeping its place in the block, with the lines
   * between them. A one-per-flow node that's already on the canvas stays out, and its lines with it.
   */
  const pasteClipboard = () => {
    const clipboard = clipboardRef.current
    if (!clipboard) return
    const items = clipboard.nodes
      .filter(({ node }) => !(NODE_TYPES_BY_ID[node.type].singleton && doc.nodes.some((other) => other.type === node.type)))
      .map((item) => ({ ...item, id: createId(item.node.type) }))
    if (!items.length) return
    const left = Math.min(...items.map(({ position }) => position.x))
    const top = Math.min(...items.map(({ position }) => position.y))
    const right = Math.max(...items.map(({ position, size }) => position.x + size.w))
    const bottom = Math.max(...items.map(({ position, size }) => position.y + size.h))
    const spot = newSpot({ w: right - left, h: bottom - top })
    if (!spot) return
    const ids = new Map(items.map((item) => [item.node.id, item.id]))
    const edges = clipboard.edges.flatMap((edge) => {
      const from = ids.get(edge.from)
      const to = ids.get(edge.to)
      return from && to ? [{ ...edge, id: createId('edge'), from, to }] : []
    })
    const positions = Object.fromEntries(items.map(({ id, position }) => [id, { x: spot.position.x + position.x - left, y: spot.position.y + position.y - top }]))
    // Placed as a block, so the measuring keeps each where it is rather than finding each its own free spot.
    for (const { id } of items) droppedRef.current.add(id)
    commit({
      ...doc,
      nodes: [...doc.nodes, ...items.map(({ node, id }) => ({ ...node, id }))],
      positions: { ...doc.positions, ...positions },
      edges: [...doc.edges, ...edges],
    })
    setSelection(
      pickedSelection(
        items.map(({ id }) => id),
        edges.map((edge) => edge.id),
      ),
    )
    if (spot.reveal) animateTo(spot.reveal)
  }

  const clipboardKeysRef = useRef({ copy: copySelection, cut: cutSelection, paste: pasteClipboard })
  useEffect(() => {
    clipboardKeysRef.current = { copy: copySelection, cut: cutSelection, paste: pasteClipboard }
  })

  const appearanceNode =
    selection?.kind === 'node' && selection.id === appearanceFor ? doc.nodes.find((node) => node.id === appearanceFor) : undefined

  const toggleAppearance = (id: string) => {
    if (appearanceNode?.id === id) {
      setAppearanceFor(null)
      return
    }
    setAppearanceFor(id)
    setCanvasLookOpen(false)
    setCardStyleOpen(false)
    setSelection({ kind: 'node', id })
  }

  const setNodeData = (id: string, open: boolean) =>
    setDataOpen((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  const updateCanvasLook = (next: CanvasLook) => {
    setCanvasLook(next)
    saveCanvasLook(next)
  }

  /** Applies a live edit; consecutive edits with the same key share one undo step. */
  const liveUpdate = (key: string, update: (current: CanvasDoc) => CanvasDoc) => {
    const session = liveEditRef.current
    if (!session || session.key !== key || session.depth !== past.length) {
      setPast((stack) => [...stack, doc])
      setFuture([])
      liveEditRef.current = { key, depth: past.length + 1 }
    }
    setDoc(update)
  }

  const setNodeAppearance = (id: string, appearance: NodeAppearance | undefined) =>
    liveUpdate(`appearance:${id}`, (current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, appearance } : node)),
    }))

  const setNodeNote = (id: string, note: string) =>
    commit({ ...doc, nodes: doc.nodes.map((node) => (node.id === id ? { ...node, config: { ...node.config, note } } : node)) })

  const setNodeSticky = (id: string, patch: Partial<StickyStyle>) =>
    commit({
      ...doc,
      nodes: doc.nodes.map((node) => (node.id === id ? { ...node, config: { ...node.config, sticky: { ...node.config.sticky, ...patch } } } : node)),
    })

  /** Edits from the configuration window; typing into one field is one undo step. Edges leave with a branch that is removed. */
  const updateNodeConfig = (id: string, key: string, update: (config: NodeConfig) => NodeConfig) =>
    liveUpdate(`config:${id}:${key}`, (current) => {
      const nodes = current.nodes.map((node) => (node.id === id ? { ...node, config: update(node.config) } : node))
      const node = nodes.find((item) => item.id === id)
      const ports = node ? new Set(nodeOutputs(node, NODE_TYPES_BY_ID[node.type]).map((port) => port.id)) : null
      return { ...current, nodes, edges: ports ? current.edges.filter((edge) => edge.from !== id || ports.has(edge.fromPort)) : current.edges }
    })
  const setNodeConfig = (id: string, patch: Partial<NodeConfig>, key: string) => updateNodeConfig(id, key, (config) => ({ ...config, ...patch }))
  const setNodeParams = (id: string, patch: Partial<AnyParams>, key: string) =>
    updateNodeConfig(id, `params:${key}`, (config) => ({ ...config, params: { ...config.params, ...patch } as Partial<AnyParams> }))

  const setNodeSettings = (id: string, patch: Partial<NodeSettings>) =>
    liveUpdate(`settings:${id}:${Object.keys(patch).join()}`, (current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, settings: { ...node.settings, ...patch } } : node)),
    }))

  const setFixture = (id: string, records: DataRecord[] | null) =>
    setFixtures((current) => {
      const next = { ...current }
      if (records) next[id] = records
      else delete next[id]
      return next
    })

  const openConfig = (id: string, focus?: string, reveal?: ProblemAction) => {
    setConfiguringId(id)
    setConfigFocus(focus)
    setConfigReveal(reveal)
    setSelection({ kind: 'node', id })
    setAppearanceFor(null)
    setCanvasLookOpen(false)
    setCardStyleOpen(false)
  }

  const closeConfig = useCallback(() => setConfiguringId(null), [])

  const appearanceScope = (id: string, scope: ApplyScope) => {
    const source = doc.nodes.find((node) => node.id === id)
    const category = source ? nodeType(source).category : null
    return doc.nodes.filter((node) => scope === 'all' || nodeType(node).category === category)
  }

  /** Copies parts of one node's look onto its category or the whole canvas, as one undo step. */
  const applyAppearance = (id: string, parts: readonly AppearancePart[], scope: ApplyScope) => {
    const source = doc.nodes.find((node) => node.id === id)
    if (!source) return 0
    const targets = new Set(appearanceScope(id, scope).map((node) => node.id))
    commit({
      ...doc,
      nodes: doc.nodes.map((node) =>
        node.id !== id && targets.has(node.id) ? { ...node, appearance: copyAppearance(node.appearance, source.appearance, parts) } : node,
      ),
    })
    return targets.size
  }

  /** Adds a case or a category; it lands before the Default or Unclassified branch. */
  const addOutput = (id: string) => {
    const node = doc.nodes.find((candidate) => candidate.id === id)
    const patch = node && addBranch(node.type, node.config.params)
    if (!patch) return
    commit({
      ...doc,
      nodes: doc.nodes.map((candidate) =>
        candidate.id === id ? { ...candidate, config: { ...candidate.config, params: { ...candidate.config.params, ...patch } as Partial<AnyParams> } } : candidate,
      ),
    })
  }

  const patchParams = (node: CanvasNode, patch: Partial<AnyParams>): CanvasNode => ({
    ...node,
    config: { ...node.config, params: { ...node.config.params, ...patch } as Partial<AnyParams> },
  })

  /** Adds an input to a Merge, below the last one. */
  const addNodeInput = (id: string) => {
    const node = doc.nodes.find((candidate) => candidate.id === id)
    const patch = node && addInput(node.type, node.config.params)
    if (!patch) return
    commit({ ...doc, nodes: doc.nodes.map((candidate) => (candidate.id === id ? patchParams(candidate, patch) : candidate)) })
  }

  /** Removes an input and the lines into it; lines into the inputs below move up with them. One undo step. */
  const removeNodeInput = (id: string, portId: string) => {
    const node = doc.nodes.find((candidate) => candidate.id === id)
    const change = node && removeInput(node.type, node.config.params, portId)
    if (!change) return
    commit({
      ...doc,
      nodes: doc.nodes.map((candidate) => (candidate.id === id ? patchParams(candidate, change.patch) : candidate)),
      edges: doc.edges
        .filter((edge) => edge.to !== id || edge.toPort !== portId)
        .map((edge) => (edge.to === id && change.renamed[edge.toPort] ? { ...edge, toPort: change.renamed[edge.toPort] } : edge)),
    })
  }

  /** Removes a case or a category and the edges leaving it, as one undo step. */
  const removeOutput = (id: string, portId: string) => {
    const node = doc.nodes.find((candidate) => candidate.id === id)
    const patch = node && removeBranch(node.type, node.config.params, portId)
    if (!patch) return
    commit({
      ...doc,
      nodes: doc.nodes.map((candidate) =>
        candidate.id === id ? { ...candidate, config: { ...candidate.config, params: { ...candidate.config.params, ...patch } as Partial<AnyParams> } } : candidate,
      ),
      edges: doc.edges.filter((edge) => edge.from !== id || edge.fromPort !== portId),
    })
  }

  /** Shows `target`, sliding each node there from where it is in `from`; the frames between stay out of the history. */
  const glideTo = useCallback(
    (from: CanvasDoc, target: CanvasDoc) => {
      stopArrange()
      if (from.positions === target.positions || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDoc(target)
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / ARRANGE_ANIMATION_MS)
        const eased = 1 - (1 - progress) ** 3
        const frame: Positions = {}
        for (const [id, end] of Object.entries(target.positions)) {
          const begin = from.positions[id] ?? end
          frame[id] = { x: begin.x + (end.x - begin.x) * eased, y: begin.y + (end.y - begin.y) * eased }
        }
        setDoc(progress < 1 ? { ...target, positions: frame } : target)
        arrangeFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null
      }
      setDoc({ ...target, positions: from.positions })
      arrangeFrameRef.current = requestAnimationFrame(step)
    },
    [stopArrange],
  )

  /** Auto-arranges the canvas, animating each node to its new spot; one undo step. */
  const tidyUp = () => {
    const root = rootRef.current
    if (!root || doc.nodes.length === 0) return
    stopArrange()
    const { positions, groups: labels } = autoLayout(doc.nodes, doc.edges, layouts, doc.positions)
    const target: CanvasDoc = { ...doc, positions: { ...doc.positions, ...positions }, groups: labels }
    setPast((stack) => [...stack, doc])
    setFuture([])
    const fit = fitViewport(target, layouts, root.clientWidth, root.clientHeight)
    if (fit) animateTo(fit)
    glideTo(doc, target)
  }

  const tidyUpRef = useRef(tidyUp)
  useEffect(() => {
    tidyUpRef.current = tidyUp
  })

  const resultSeconds = canvasLook.result.seconds
  useEffect(() => {
    if (!runResult) return
    const timer = window.setTimeout(() => setRunResult(null), resultSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [runResult, resultSeconds])

  const scheduleRun = (delay: number, update: () => void) => {
    runTimersRef.current.push(window.setTimeout(update, delay))
  }

  /**
   * Executes the scope with `planRun`, then plays the results back one node at a time. A failed node's
   * downstream and untaken branches are skipped. `simulate` forces the outcome: pass ignores failures,
   * fail breaks the first node with an issue, or one about two thirds of the way along. A flow run
   * ends with the result glow.
   */
  const runNodes = (startId: string, scope: RunScope, simulate?: RunOutcome, live = false) => {
    const current = docRef.current
    const scoped =
      scope === 'node' ? [startId] : scope === 'upstream' ? upstreamOrder(startId, current.edges) : downstreamOrder(startId, current.edges)
    const order = scoped.filter((id) => {
      const node = current.nodes.find((candidate) => candidate.id === id)
      return node && NODE_TYPES_BY_ID[node.type].category !== 'annotations'
    })
    const issueOf = (id: string) => {
      const node = current.nodes.find((candidate) => candidate.id === id)
      return node && nodeIssue(node)
    }
    const forcedFailure =
      simulate === 'fail'
        ? (order.find(issueOf) ??
          order[Math.max(1, Math.round((order.length - 1) * 0.66))] ??
          order[0])
        : undefined
    /** A new run abandons a parked one, as its chat session would no longer be waiting on it. */
    const unpark = (all: Record<string, NodeRun>) => Object.fromEntries(Object.entries(all).map(([id, run]) => [id, run.status === 'waiting' ? IDLE : run]))
    const previous = unpark(runs)
    setRuns((current) => ({ ...unpark(current), ...(scope === 'downstream' ? Object.fromEntries(order.map((id) => [id, IDLE])) : {}) }))
    if (scope === 'downstream') {
      setRunResult(null)
      setRunFailures(null)
    }
    const startsFlow = scope === 'downstream' && NODE_TYPES_BY_ID[current.nodes.find((node) => node.id === startId)?.type ?? '']?.category === 'triggers'
    const triggerId = startsFlow ? startId : undefined
    const steps = planRun({
      nodes: current.nodes,
      edges: current.edges,
      order,
      previous,
      fixtures,
      triggerId,
      stepTest: scope !== 'downstream',
      simulate,
      forcedFailure,
      workflowName: name,
    })
    const parked = steps.some((step) => step.run.status === 'waiting')
    const failures = failedSteps(steps)
    const executionId = live ? startExecution(startId) : undefined
    parkedRunRef.current = parked
      ? { pending: order.filter((id) => !steps.some((step) => step.id === id)), triggerId, simulate, forcedFailure, failures, executionId }
      : null
    playSteps(steps, (outcome) => {
      if (executionId) recordExecution(executionId, steps, parked ? 'waiting' : failures.length ? 'error' : 'success')
      if (scope !== 'downstream' || parked) return
      setRunResult({ outcome, id: Date.now(), fromRun: true })
      if (failures.length) setRunFailures(failures)
    })
  }

  const startExecution = (triggerId: string) => {
    const trigger = docRef.current.nodes.find((node) => node.id === triggerId)
    const execution: Execution = {
      id: `execution-${Date.now()}`,
      startedAt: Date.now(),
      trigger: trigger ? nodeName(trigger, NODE_TYPES_BY_ID[trigger.type]) : 'Trigger',
      status: 'running',
      durationMs: 0,
      runs: {},
    }
    setExecutions((all) => ({ ...all, [mode]: [execution, ...all[mode]] }))
    return execution.id
  }

  const updateExecutions = (update: (execution: Execution) => Execution) =>
    setExecutions((all) => ({ showcase: all.showcase.map(update), simple: all.simple.map(update), complex: all.complex.map(update) }))

  /** Adds the played steps to the execution; a run resumed after a chat reply adds to the same one. */
  const recordExecution = (id: string, steps: readonly PlannedStep[], status: ExecutionStatus) =>
    updateExecutions((execution) =>
      execution.id !== id
        ? execution
        : {
            ...execution,
            status,
            durationMs: execution.durationMs + steps.reduce((sum, step) => sum + (step.run.status === 'skipped' ? 0 : (step.run.durationMs ?? 0)), 0),
            runs: { ...execution.runs, ...Object.fromEntries(steps.map((step) => [step.id, step.run])) },
          },
    )

  /** Shows the execution's results on the canvas, as a test run would have left them. */
  const copyExecution = (execution: Execution) => {
    if (activeRuns) stopRun()
    setRuns(
      Object.fromEntries(
        docRef.current.nodes.map((node) => {
          const run = execution.runs[node.id]
          return [node.id, run && run.status !== 'running' && run.status !== 'waiting' ? run : IDLE]
        }),
      ),
    )
    setRunFailures(null)
    setRunResult(null)
    setTab('builder')
  }

  const failedSteps = (steps: readonly PlannedStep[]): FailedStep[] =>
    steps.flatMap(({ id, run }) => {
      const node = docRef.current.nodes.find((candidate) => candidate.id === id)
      if (run.status !== 'error' || !node) return []
      const message = (run.problems?.[0]?.title ?? run.message ?? 'Something went wrong').replace(/\.$/, '')
      return [{ id, name: nodeName(node, NODE_TYPES_BY_ID[node.type]), message, problems: run.problems?.length || 1 }]
    })

  /** Centres the step at the current zoom, selects it, and opens its input and output. */
  const showStep = (id: string) => {
    const position = docRef.current.positions[id]
    if (!position) return
    centreOn({ ...position, ...(layouts[id] ?? DEFAULT_NODE_SIZE) })
    setSelection({ kind: 'node', id })
    setDataDialogId(id)
  }

  /** Resumes a parked flow run with the chat's reply: the step finishes, then the steps that waited on it run. */
  const replyTo = (nodeId: string, reply: ChatReply) => {
    const parked = parkedRunRef.current
    if (!parked || runs[nodeId]?.status !== 'waiting') return
    const current = docRef.current
    const order = [nodeId, ...parked.pending]
    const steps = planRun({
      nodes: current.nodes,
      edges: current.edges,
      order,
      previous: runs,
      fixtures,
      triggerId: parked.triggerId,
      stepTest: false,
      simulate: parked.simulate,
      forcedFailure: parked.forcedFailure,
      replies: { [nodeId]: reply },
      workflowName: name,
    })
    const failures = [...parked.failures, ...failedSteps(steps)]
    const stillWaiting =
      steps.some((step) => step.run.status === 'waiting') || Object.entries(runs).some(([id, run]) => id !== nodeId && run.status === 'waiting')
    parkedRunRef.current = stillWaiting ? { ...parked, pending: order.filter((id) => !steps.some((step) => step.id === id)), failures } : null
    playSteps(steps, (outcome) => {
      if (parked.executionId) recordExecution(parked.executionId, steps, stillWaiting ? 'waiting' : failures.length ? 'error' : 'success')
      if (stillWaiting) return
      setRunResult({ outcome: failures.length || outcome === 'fail' ? 'fail' : 'pass', id: Date.now(), fromRun: true })
      if (failures.length) setRunFailures(failures)
    })
  }

  /** Plays planned steps back one node at a time, then reports whether any failed. */
  const playSteps = (steps: readonly PlannedStep[], finish: (outcome: RunOutcome) => void) => {
    const current = docRef.current
    let elapsed = 0
    let outcome: RunOutcome = 'pass'
    for (const [index, step] of steps.entries()) {
      if (step.run.status === 'skipped') {
        elapsed += RUN_SKIP_MS
        scheduleRun(elapsed, () => setRuns((current) => ({ ...current, [step.id]: step.run })))
        continue
      }
      const seconds = (step.run.durationMs ?? 0) / 1000
      const waits = step.run.status === 'success' && current.nodes.find((node) => node.id === step.id)?.type === 'wait'
      const duration = waits
        ? Math.min(WAIT_PLAY_MAX_MS, Math.max(RUN_STEP_MS, seconds * 1000))
        : Math.min(RUN_STEP_MAX_MS, RUN_STEP_MS + ((index * 137) % 400) + Math.log10(1 + seconds) * 260)
      scheduleRun(elapsed, () =>
        setRuns((current) => ({
          ...current,
          [step.id]: waits ? { status: 'running', countdown: { startedAt: performance.now(), playMs: duration, seconds } } : { status: 'running' },
        })),
      )
      elapsed += duration
      scheduleRun(elapsed, () => {
        setRuns((current) => ({ ...current, [step.id]: step.run }))
        if (step.run.status === 'waiting') setDataDialogId(step.id)
      })
      if (step.run.status === 'error') outcome = 'fail'
    }
    setActiveRuns((count) => count + 1)
    scheduleRun(elapsed, () => {
      setActiveRuns((count) => Math.max(0, count - 1))
      finish(outcome)
    })
  }

  /** Cancels every pending step; nodes caught mid-run go back to idle. */
  const stopRun = () => {
    for (const timer of runTimersRef.current.splice(0)) window.clearTimeout(timer)
    setActiveRuns(0)
    parkedRunRef.current = null
    updateExecutions((execution) => (execution.status === 'running' || execution.status === 'waiting' ? { ...execution, status: 'stopped' } : execution))
    setRuns((current) =>
      Object.fromEntries(Object.entries(current).map(([id, run]) => [id, run.status === 'running' || run.status === 'waiting' ? IDLE : run])),
    )
  }

  /** Swaps the canvas to another mode; each keeps its own document, history, and run results. */
  const switchMode = (target: CanvasMode) => {
    if (target === mode) return
    const parked = parkedModesRef.current[target]
    const stored = parked || target === 'showcase' ? null : readSavedFlow(target)
    const next = parked ?? (target === 'showcase' ? null : { doc: stored ?? testFlowDoc(target), past: [], future: [], runs: {} })
    if (!next) return
    if (stored && target !== 'showcase') setFlowBaselines((all) => ({ ...all, [target]: JSON.stringify(stored) }))
    stopRun()
    stopArrange()
    parkedModesRef.current[mode] = {
      doc,
      past,
      future,
      runs: Object.fromEntries(Object.entries(runs).map(([id, run]) => [id, run.status === 'running' || run.status === 'waiting' ? IDLE : run])),
    }
    pendingLayoutRef.current = parked || stored || target === 'showcase' ? 'fit' : target
    docRef.current = next.doc
    setDoc(next.doc)
    setPast(next.past)
    setFuture(next.future)
    setRuns(next.runs)
    setRunFailures(null)
    setSelection(null)
    setAppearanceFor(null)
    setMode(target)
  }

  const flowKind = mode === 'showcase' ? null : mode
  // Only edits count: cards settling as they're measured change the doc too, but never the history.
  const flowJson = useMemo(() => (flowKind && (past.length > 0 || future.length > 0) ? JSON.stringify(doc) : null), [flowKind, doc, past.length, future.length])
  const flowUnsaved = Boolean(flowKind && flowJson !== null && flowJson !== flowBaselines[flowKind])
  const flowCustomised = Boolean(flowKind && (flowUnsaved || savedFlows[flowKind]))

  /** Makes the canvas the test flow's new default, so it opens like this after a reload. */
  const saveFlow = () => {
    if (!flowKind) return
    const json = JSON.stringify(doc)
    try {
      localStorage.setItem(testFlowKey(flowKind), json)
    } catch {
      return
    }
    setFlowBaselines((all) => ({ ...all, [flowKind]: json }))
    setSavedFlows((all) => ({ ...all, [flowKind]: true }))
  }

  /** Puts back the built-in test flow and forgets the saved one; undo brings the canvas back to save again. */
  const resetFlow = () => {
    if (!flowKind) return
    try {
      localStorage.removeItem(testFlowKey(flowKind))
    } catch {
      // Storage blocked: the saved flow can't have been written either.
    }
    stopRun()
    stopArrange()
    const fresh = testFlowDoc(flowKind)
    pendingLayoutRef.current = flowKind
    docRef.current = fresh
    commit(fresh)
    setRuns({})
    setRunFailures(null)
    setSelection(null)
    setAppearanceFor(null)
    setSavedFlows((all) => ({ ...all, [flowKind]: false }))
  }

  const closeLibrary = useCallback(() => setLibraryOpen(false), [])

  useLayoutEffect(() => {
    const measure = () => {
      const next: Record<string, MeasuredNode> = {}
      for (const node of doc.nodes) {
        const element = nodeRefs.current[node.id]
        if (!element) continue
        const rect = element.getBoundingClientRect()
        const scale = rect.width / element.offsetWidth || 1
        const ports: Record<string, Point> = {}
        for (const port of element.querySelectorAll<HTMLElement>('[data-port-side]')) {
          const { portId, portSide } = port.dataset
          if (!portId || (portSide !== 'in' && portSide !== 'out')) continue
          const box = port.getBoundingClientRect()
          ports[layoutPortKey(portSide, portId)] = {
            x: (box.left + box.width / 2 - rect.left) / scale,
            y: (box.top + box.height / 2 - rect.top) / scale,
          }
        }
        next[node.id] = { w: element.offsetWidth, h: element.offsetHeight, ports }
      }
      const previous = measuredRef.current
      measuredRef.current = next
      // A canvas being laid out wholesale (first load, switching flows) places its nodes itself.
      const laying = !didInitialLayoutRef.current || pendingLayoutRef.current !== null
      setLayouts(next)
      const align = alignRef.current
      const offset = align && next[align.port.nodeId]?.ports[layoutPortKey(align.port.side, align.port.portId)]
      if (align && offset) {
        alignRef.current = null
        const id = align.port.nodeId
        setDoc((current) =>
          current.positions[id]
            ? {
                ...current,
                positions: { ...current.positions, [id]: { x: align.levelOnly ? current.positions[id].x : align.at.x - offset.x, y: align.at.y - offset.y } },
              }
            : current,
        )
      }
      if (!laying) {
        const ids = Object.keys(next)
        const added = ids.filter((id) => !previous[id])
        const grown = new Set(ids.filter((id) => previous[id] && (next[id].w > previous[id].w || next[id].h > previous[id].h)))
        const dropped = added.filter((id) => droppedRef.current.delete(id))
        if (dropped.length > 0) {
          const current = docRef.current
          const free = added.filter((id) => !dropped.includes(id))
          glideTo(current, settleNodes(current, next, free, new Set([...grown, ...dropped])))
        } else if (added.length > 0 || grown.size > 0) setDoc((current) => settleNodes(current, next, added, grown))
      }
      const root = rootRef.current
      if (!didInitialLayoutRef.current && root) {
        didInitialLayoutRef.current = true
        const { positions, groups: labels } = layoutShowcase(SHOWCASE.columns, next)
        const laidOut = { ...docRef.current, positions: { ...docRef.current.positions, ...positions }, groups: labels }
        setDoc(laidOut)
        const target = fitViewport(laidOut, next, root.clientWidth, root.clientHeight)
        if (target) setView(target)
      }
      const pending = pendingLayoutRef.current
      const current = docRef.current
      if (pending && root && current.nodes.every((node) => next[node.id])) {
        pendingLayoutRef.current = null
        let laidOut = current
        if (pending !== 'fit') {
          const { positions, groups: labels } = autoLayout(current.nodes, current.edges, next, current.positions)
          laidOut = withTestAnnotations(pending, { ...current, positions: { ...current.positions, ...positions }, groups: labels }, next)
          docRef.current = laidOut
          setDoc(laidOut)
          setFlowBaselines((all) => ({ ...all, [pending]: JSON.stringify(laidOut) }))
        }
        const target = fitViewport(laidOut, next, root.clientWidth, root.clientHeight)
        if (target) animateTo(target)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const node of doc.nodes) {
      const element = nodeRefs.current[node.id]
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
    // `runs` too: a run's result resizes cards (a Create Asset's chart), and the observer only reports on a rendered frame, which a hidden canvas skips.
  }, [doc.nodes, runs, animateTo, glideTo])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent) => {
      const inPanel = (event.target as Element | null)?.closest?.('[data-native-scroll]')
      if (inPanel && !(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      if (inPanel) return
      stopAnimation()
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1
      const dx = event.deltaX * scale
      const dy = event.deltaY * scale
      if (event.ctrlKey || event.metaKey) {
        const rect = root.getBoundingClientRect()
        zoomAround(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-dy * 0.01))
        return
      }
      setView((current) => ({ ...current, x: current.x - dx, y: current.y - dy }))
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [stopAnimation, zoomAround])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (configuringId) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
      const mod = event.metaKey || event.ctrlKey
      const shortcut = shortcutTool(event)
      if (event.code === 'Space' && !mod) {
        event.preventDefault()
        setSpaceHeld(true)
      } else if (mod && (event.code === 'KeyC' || event.code === 'KeyX') && !window.getSelection()?.toString()) {
        if (event.code === 'KeyC') clipboardKeysRef.current.copy()
        else clipboardKeysRef.current.cut()
      } else if (mod && event.code === 'KeyV') {
        event.preventDefault()
        clipboardKeysRef.current.paste()
      } else if (mod && event.code === 'KeyA') {
        event.preventDefault()
        setSelection(pickedSelection(doc.nodes.map((node) => node.id), doc.edges.map((edge) => edge.id)))
      } else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        zoomFromCenter(BUTTON_ZOOM_STEP)
      } else if (mod && event.key === '-') {
        event.preventDefault()
        zoomFromCenter(1 / BUTTON_ZOOM_STEP)
      } else if (event.shiftKey && event.altKey && event.code === 'KeyT') {
        event.preventDefault()
        tidyUpRef.current()
      } else if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        fitToView()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection()
      } else if (event.key === 'Escape') {
        if (tool !== 'select') {
          setTool('select')
          return
        }
        setSelection(null)
        setCommentDraft(null)
      } else if (shortcut) {
        event.preventDefault()
        setTool(shortcut)
      } else if (!mod && !event.altKey && !event.shiftKey && event.code === 'KeyN') {
        event.preventDefault()
        setTool('select')
        setLibraryOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [configuringId, deleteSelection, doc.edges, doc.nodes, fitToView, redo, tool, undo, zoomFromCenter])

  useEffect(() => {
    const release = (event: Event) => {
      if (event instanceof KeyboardEvent && event.code !== 'Space') return
      setSpaceHeld(false)
    }
    window.addEventListener('keyup', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', release)
    }
  }, [])

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    stopAnimation()
    const pans = event.button === 1 || tool === 'hand' || spaceHeld
    if (!pans && !event.shiftKey) setSelection(null)
    setCommentDraft(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!pans && tool === 'section') {
      const start = toWorld(event.clientX, event.clientY)
      sectionDrawRef.current = { pointerId: event.pointerId, start }
      setSectionDraft({ ...start, w: 0, h: 0 })
      return
    }
    if (!pans && tool !== 'select') {
      placeRef.current = { pointerId: event.pointerId }
      return
    }
    if (!pans && event.pointerType !== 'touch') {
      marqueeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        start: toWorld(event.clientX, event.clientY),
        base: event.shiftKey ? selection : null,
      }
      return
    }
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, view: viewRef.current }
    setPanning(true)
  }

  /** Flags nodes the pointer is close to so their ports show before it reaches the card; set on the DOM to skip a render per move. */
  const markNearNodes = (surface: HTMLElement, clientX: number, clientY: number) => {
    const point = toWorld(clientX, clientY)
    const near = new Set(
      doc.nodes
        .filter((node) => {
          const position = doc.positions[node.id]
          const size = layouts[node.id] ?? DEFAULT_NODE_SIZE
          if (!position) return false
          const dx = Math.max(position.x - point.x, 0, point.x - position.x - size.w)
          const dy = Math.max(position.y - point.y, 0, point.y - position.y - size.h)
          return Math.hypot(dx, dy) <= PORT_REACH
        })
        .map((node) => node.id),
    )
    for (const id of nearNodesRef.current) {
      if (!near.has(id)) surface.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.removeAttribute('data-near')
    }
    for (const id of near) surface.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.setAttribute('data-near', '')
    nearNodesRef.current = near
  }

  const onSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') markNearNodes(event.currentTarget, event.clientX, event.clientY)
    if (tool === 'comment') {
      const hovered = nodeAt(doc, toWorld(event.clientX, event.clientY))
      if (hovered !== commentHover) setCommentHover(hovered)
    }
    const draw = sectionDrawRef.current
    if (draw?.pointerId === event.pointerId) {
      setSectionDraft(rectFromPoints(draw.start, toWorld(event.clientX, event.clientY)))
      return
    }
    const box = marqueeRef.current
    if (box?.pointerId === event.pointerId) {
      if (!marquee && Math.hypot(event.clientX - box.startX, event.clientY - box.startY) < 3) return
      const rect = rectFromPoints(box.start, toWorld(event.clientX, event.clientY))
      setMarquee(rect)
      setSelection(boxSelection(rect, box.base))
      return
    }
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    setView({
      ...pan.view,
      x: pan.view.x + event.clientX - pan.startX,
      y: pan.view.y + event.clientY - pan.startY,
    })
  }

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    setPanning(false)
  }

  const endMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (marqueeRef.current?.pointerId !== event.pointerId) return
    marqueeRef.current = null
    setMarquee(null)
  }

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sectionDrawRef.current?.pointerId === event.pointerId) finishSection(event)
    else if (placeRef.current?.pointerId === event.pointerId) {
      placeRef.current = null
      placeItem(toWorld(event.clientX, event.clientY))
    } else if (marqueeRef.current?.pointerId === event.pointerId) endMarquee(event)
    else endPan(event)
  }

  const onSurfacePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    sectionDrawRef.current = null
    placeRef.current = null
    setSectionDraft(null)
    endMarquee(event)
    endPan(event)
  }

  /** The nodes a selection box touches, added to `base`; lines are only picked by clicking them. */
  const boxSelection = (rect: Rect, base: Selection): Selection => {
    const nodes = doc.nodes
      .filter((node) => {
        const position = doc.positions[node.id]
        return position ? rectsTouch(rect, { ...position, ...(layouts[node.id] ?? DEFAULT_NODE_SIZE) }) : false
      })
      .map((node) => node.id)
    return pickedSelection([...new Set([...selectedIds(base, 'node'), ...nodes])], selectedIds(base, 'edge'))
  }

  /** Drops a sticky note, text, or comment where the placement tool was clicked. */
  const placeItem = (point: Point) => {
    setTool('select')
    if (tool === 'sticky') addNode('stickyNote', point, { note: '' })
    else if (tool === 'text') setTextDraft({ x: point.x - 6, y: point.y - TEXT_DEFAULT_SIZE * 0.625 - 2 })
    else if (tool === 'comment') setCommentDraft({ ...point, nodeId: nodeAt(doc, point) })
  }

  /** The top node under a world point. */
  const nodeAt = (current: CanvasDoc, point: Point) =>
    current.nodes.findLast((node) => {
      const position = current.positions[node.id]
      const size = layouts[node.id] ?? DEFAULT_NODE_SIZE
      return position ? rectContainsPoint({ ...position, ...size }, point) : false
    })?.id

  /** A click drops a default-size section; a drag uses the drawn rectangle. */
  const finishSection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const draw = sectionDrawRef.current
    sectionDrawRef.current = null
    setSectionDraft(null)
    setTool('select')
    if (!draw) return
    const drawn = rectFromPoints(draw.start, toWorld(event.clientX, event.clientY))
    const dragged = Math.hypot(drawn.w, drawn.h) * view.zoom > 8
    const rect = dragged
      ? { ...drawn, w: Math.max(SECTION_MIN_SIZE, drawn.w), h: Math.max(SECTION_MIN_SIZE, drawn.h) }
      : {
          x: draw.start.x - SECTION_DEFAULT_SIZE.w / 2,
          y: draw.start.y - SECTION_DEFAULT_SIZE.h / 2,
          ...SECTION_DEFAULT_SIZE,
        }
    const id = createId('section')
    const section: CanvasSection = {
      id,
      name: nextSectionName(doc.sections),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.w),
      h: Math.round(rect.h),
      ...SECTION_DEFAULTS,
    }
    commit({ ...doc, sections: [...doc.sections, section] })
    setSelection({ kind: 'section', id })
  }

  const startGesture = (event: ReactPointerEvent<Element>, apply: Gesture['apply'], finish?: Gesture['finish'], release?: Gesture['release']) => {
    stopArrange()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, snapshot: doc, moved: false, apply, finish, release }
  }

  const endGesture = (event: ReactPointerEvent<Element>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.moved) {
      if (gesture.finish) setDoc(gesture.finish)
      gesture.release?.()
      setPast((stack) => [...stack, gesture.snapshot])
      setFuture([])
    }
    gestureRef.current = null
  }

  const gestureHandlers: GestureHandlers = {
    onPointerMove: (event) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const screenDx = event.clientX - gesture.startX
      const screenDy = event.clientY - gesture.startY
      if (!gesture.moved && Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD) return
      gesture.moved = true
      gesture.apply(screenDx / view.zoom, screenDy / view.zoom)
    },
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
  }

  /** Nodes (by centre), texts and comments (by anchor), and sections (fully) inside a section, with their start points. */
  const sectionMembers = (section: CanvasSection): SectionMembers => {
    const nodes: Positions = {}
    for (const node of doc.nodes) {
      const position = doc.positions[node.id]
      const size = layouts[node.id] ?? DEFAULT_NODE_SIZE
      if (position && rectContainsPoint(section, { x: position.x + size.w / 2, y: position.y + size.h / 2 })) nodes[node.id] = position
    }
    const pick = <T extends Point & { id: string }>(items: readonly T[], inside: (item: T) => boolean): Positions =>
      Object.fromEntries(items.filter(inside).map((item) => [item.id, { x: item.x, y: item.y }]))
    return {
      nodes,
      sections: pick(doc.sections, (other) => other.id === section.id || rectContains(section, other)),
      texts: pick(doc.texts, (text) => rectContainsPoint(section, text)),
      // Pinned comments travel with their node instead.
      comments: pick(doc.comments, (comment) => !comment.nodeId && rectContainsPoint(section, comment)),
    }
  }

  const hasMembers = (section: CanvasSection) => {
    const { nodes, sections, texts, comments } = sectionMembers(section)
    // `sections` always includes the section itself.
    return [nodes, texts, comments].some((group) => Object.keys(group).length > 0) || Object.keys(sections).length > 1
  }

  /** World-space boxes of a section's contents (not the section itself). */
  const memberRects = (section: CanvasSection): Rect[] => {
    const members = sectionMembers(section)
    const textBox = (id: string): Rect => {
      const element = rootRef.current?.querySelector<HTMLElement>(`[data-text-id="${CSS.escape(id)}"]`)
      return { ...members.texts[id], w: element?.offsetWidth ?? 0, h: element?.offsetHeight ?? 0 }
    }
    return [
      ...Object.entries(members.nodes).map(([id, position]) => {
        const size = layouts[id] ?? DEFAULT_NODE_SIZE
        return { ...position, w: size.w, h: size.h }
      }),
      ...doc.sections.filter((other) => other.id !== section.id && members.sections[other.id]),
      ...Object.keys(members.texts).map(textBox),
      ...Object.values(members.comments).map((point) => ({ ...point, w: 0, h: 0 })),
    ]
  }

  const onSectionPointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || tool !== 'select') return
    event.stopPropagation()
    setSelection({ kind: 'section', id })
    setCommentDraft(null)
    const section = doc.sections.find((candidate) => candidate.id === id)
    if (!section || section.locked || (event.target as Element).closest('input')) return
    const members = sectionMembers(section)
    let offset: Point = { x: 0, y: 0 }
    startGesture(
      event,
      (dx, dy) => {
        offset = { x: dx, y: dy }
        setDoc((current) => moveMembers(current, members, dx, dy))
      },
      undefined,
      () => {
        const dropped = moveMembers(doc, members, offset.x, offset.y)
        glideTo(dropped, makeRoom(dropped, new Set(Object.keys(members.nodes)), layouts))
      },
    )
  }

  const onSectionResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>, id: string, corner: SectionCorner) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const origin = doc.sections.find((candidate) => candidate.id === id)
    if (!origin) return
    startGesture(event, (dx, dy) =>
      setDoc((current) => ({
        ...current,
        sections: current.sections.map((section) => (section.id === id ? { ...section, ...resizedRect(origin, corner, dx, dy) } : section)),
      })),
    )
  }

  const updateSection = (id: string, patch: Partial<CanvasSection>) =>
    liveUpdate(`section:${id}`, (current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    }))

  const renameSection = (id: string, name: string | null) => {
    setRenamingSection(null)
    const section = doc.sections.find((candidate) => candidate.id === id)
    if (!section || name === null || name === section.name) return
    commit({ ...doc, sections: doc.sections.map((candidate) => (candidate.id === id ? { ...candidate, name } : candidate)) })
  }

  const fitSection = (id: string) => {
    const section = doc.sections.find((candidate) => candidate.id === id)
    const bounds = section && boundsOf(memberRects(section))
    if (!bounds) return
    const pad = SECTION_FIT_PADDING
    const fitted = { x: Math.round(bounds.x - pad), y: Math.round(bounds.y - pad), w: Math.round(bounds.w + pad * 2), h: Math.round(bounds.h + pad * 2) }
    commit({ ...doc, sections: doc.sections.map((candidate) => (candidate.id === id ? { ...candidate, ...fitted } : candidate)) })
  }

  const onTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || tool !== 'select') return
    event.stopPropagation()
    setSelection({ kind: 'text', id })
    setCommentDraft(null)
    const item = doc.texts.find((candidate) => candidate.id === id)
    if (!item || editingText === id) return
    startGesture(event, (dx, dy) =>
      setDoc((current) => ({
        ...current,
        texts: current.texts.map((text) => (text.id === id ? { ...text, x: Math.round(item.x + dx), y: Math.round(item.y + dy) } : text)),
      })),
    )
  }

  /** Saves an edited text; clearing it deletes the text. */
  const commitText = (id: string, value: string) => {
    setEditingText(null)
    const item = doc.texts.find((candidate) => candidate.id === id)
    if (!item) return
    if (!value.trim()) {
      commit(withoutItem(doc, 'text', id))
      setSelection(null)
    } else if (value !== item.text) {
      commit({ ...doc, texts: doc.texts.map((text) => (text.id === id ? { ...text, text: value } : text)) })
    }
  }

  const commitTextDraft = (value: string) => {
    const at = textDraft
    setTextDraft(null)
    if (!at || !value.trim()) return
    const id = createId('text')
    commit({ ...doc, texts: [...doc.texts, { id, x: Math.round(at.x), y: Math.round(at.y), text: value, size: TEXT_DEFAULT_SIZE }] })
    setSelection({ kind: 'text', id })
  }

  const setTextSize = (id: string, size: number) =>
    commit({ ...doc, texts: doc.texts.map((text) => (text.id === id ? { ...text, size } : text)) })

  const onCommentPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    setSelection({ kind: 'comment', id })
    setCommentDraft(null)
    const comment = doc.comments.find((candidate) => candidate.id === id)
    if (!comment) return
    // Opening a thread reads it; that isn't an edit, so it stays out of undo.
    if (comment.unread) setCommentUnread(id, false)
    startGesture(
      event,
      (dx, dy) =>
        setDoc((current) => ({
          ...current,
          comments: current.comments.map((item) => (item.id === id ? { ...item, x: comment.x + dx, y: comment.y + dy } : item)),
        })),
      // Dropped on a node, it pins there; on empty canvas, it comes loose.
      (current) => ({
        ...current,
        comments: current.comments.map((item) => {
          if (item.id !== id) return item
          const point = commentPoint(item, current.positions)
          return placeComment(item, point, nodeAt(current, point), current.positions)
        }),
      }),
    )
  }

  const postComment = (text: string) => {
    if (!commentDraft) return
    const id = createId('comment')
    const { nodeId, ...point } = commentDraft
    const comment = placeComment({ id, ...point, messages: [newMessage(text)] }, point, nodeId, doc.positions)
    commit({ ...doc, comments: [...doc.comments, comment] })
    setCommentDraft(null)
    setSelection({ kind: 'comment', id })
  }

  const updateMessages = (id: string, update: (messages: CommentMessage[]) => CommentMessage[]) =>
    commit({ ...doc, comments: doc.comments.map((comment) => (comment.id === id ? { ...comment, messages: update(comment.messages) } : comment)) })

  const setCommentUnread = (id: string, unread: boolean) =>
    setDoc((current) => ({ ...current, comments: current.comments.map((comment) => (comment.id === id ? { ...comment, unread } : comment)) }))

  const deleteMessage = (comment: CanvasComment, messageId: string) => {
    if (comment.messages[0]?.id === messageId) removeItem('comment', comment.id)
    else updateMessages(comment.id, (messages) => messages.filter((message) => message.id !== messageId))
  }

  const removeItem = (kind: ItemKind, id: string) => {
    commit(withoutItem(doc, kind, id))
    setSelection(null)
  }

  const onNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    // Placement tools work over nodes too, so let the press reach the surface.
    if (event.button !== 0 || tool !== 'select') return
    event.stopPropagation()
    const target = event.target as Element
    const control = target.closest('button, input, textarea, select, a, [data-node-interactive], [data-native-scroll]')
    const picked = selectedIds(selection, 'node')
    let moving = [id]
    let narrow = false
    if (event.shiftKey && !control) {
      const nodes = toggled(picked, id)
      setSelection(pickedSelection(nodes, selectedIds(selection, 'edge')))
      if (!nodes.includes(id)) return
      moving = [...nodes]
    } else if (selection?.kind === 'many' && picked.includes(id) && !control) {
      moving = [...picked]
      narrow = true
    } else setSelection({ kind: 'node', id })
    if (appearanceNode) setAppearanceFor(id)
    if (control) return
    stopArrange()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      id,
      startX: event.clientX,
      startY: event.clientY,
      origins: Object.fromEntries(moving.flatMap((nodeId) => (doc.positions[nodeId] ? [[nodeId, doc.positions[nodeId]]] : []))),
      narrow,
      snapshot: doc,
      moved: false,
      offset: { x: 0, y: 0 },
    }
    setDraggingNodes(new Set(moving))
  }

  const onNodePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = (event.clientX - drag.startX) / view.zoom
    const dy = (event.clientY - drag.startY) / view.zoom
    if (!drag.moved && Math.hypot(dx, dy) < 2) return
    drag.moved = true
    drag.offset = { x: dx, y: dy }
    setDoc((current) => shiftNodes(current, drag.origins, drag.offset))
  }

  const endNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      const dropped = shiftNodes(doc, drag.origins, drag.offset)
      glideTo(dropped, makeRoom(dropped, new Set(Object.keys(drag.origins)), layouts))
      setPast((stack) => [...stack, drag.snapshot])
      setFuture([])
    } else if (drag.narrow) setSelection({ kind: 'node', id: drag.id })
    dragRef.current = null
    setDraggingNodes(new Set())
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>, id: string, edge: ResizeEdge) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const layout = layouts[id]
    const position = doc.positions[id]
    const element = event.currentTarget.closest<HTMLElement>('[data-node-id]')
    if (!layout || !position || !element) return
    const frameMinHeight = element.style.minHeight
    const sized = element.dataset.sized
    element.style.minHeight = '0px'
    element.dataset.sized = ''
    const contentHeight = element.offsetHeight
    element.style.minHeight = frameMinHeight
    if (sized === undefined) delete element.dataset.sized
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelection({ kind: 'node', id })
    resizeRef.current = {
      pointerId: event.pointerId,
      id,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...position, w: layout.w, h: layout.h },
      contentHeight,
      snapshot: doc,
      moved: false,
    }
  }

  const onResizePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    resize.moved = true
    const { edge, origin } = resize
    const dx = (event.clientX - resize.startX) / view.zoom
    const dy = (event.clientY - resize.startY) / view.zoom
    const horizontal = edge.includes('e') ? dx : edge.includes('w') ? -dx : null
    const vertical = edge.includes('s') ? dy : edge.includes('n') ? -dy : null
    const minWidth = doc.nodes.some((node) => node.id === resize.id && isAnnotation(nodeType(node))) ? STICKY_MIN_SIZE : NODE_MIN_WIDTH
    const w = horizontal === null ? origin.w : Math.max(minWidth, Math.round(origin.w + horizontal))
    const h = vertical === null ? origin.h : Math.max(resize.contentHeight, Math.round(origin.h + vertical))
    const x = edge.includes('w') ? origin.x + origin.w - w : origin.x
    const y = edge.includes('n') ? origin.y + origin.h - h : origin.y
    setDoc((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== resize.id) return node
        const frame = { ...node.frame }
        if (horizontal !== null) frame.w = w
        if (vertical !== null) frame.h = h
        return { ...node, frame }
      }),
      positions: { ...current.positions, [resize.id]: { x, y } },
    }))
  }

  const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    if (resize.moved) {
      setPast((stack) => [...stack, resize.snapshot])
      setFuture([])
    }
    resizeRef.current = null
  }

  const nodeType = (node: CanvasNode): NodeType => NODE_TYPES_BY_ID[node.type]
  const nodesById = Object.fromEntries(doc.nodes.map((node) => [node.id, node]))

  const portsOn = (node: CanvasNode, side: PortSide) => (side === 'in' ? nodeInputs : nodeOutputs)(node, nodeType(node))

  /** The closest `side` port to a world point within snapping distance, on any node but `skip`. */
  const nearestPort = (point: Point, side: PortSide, skip: string): PortRef | null => {
    let best: PortRef | null = null
    let reach = PORT_SNAP / viewRef.current.zoom
    for (const node of doc.nodes) {
      if (node.id === skip) continue
      for (const port of portsOn(node, side)) {
        const ref: PortRef = { nodeId: node.id, portId: port.id, side }
        const at = portWorldPoint(ref)
        const distance = at ? Math.hypot(at.x - point.x, at.y - point.y) : Infinity
        if (distance < reach) {
          best = ref
          reach = distance
        }
      }
    }
    return best
  }

  /** Where a dragged line would land: a port under or near the pointer, else the first one of the node under it. */
  const connectionAim = (clientX: number, clientY: number, from: PortRef): { target: PortRef | null; free: boolean } => {
    const side: PortSide = from.side === 'out' ? 'in' : 'out'
    const hit = document.elementFromPoint(clientX, clientY)
    const portElement = hit?.closest<HTMLElement>('[data-port-side]')
    const nodeId = hit?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    let target: PortRef | null = null
    if (portElement) {
      const { portNode, portId, portSide } = portElement.dataset
      if (portNode && portId && portSide === side) target = { nodeId: portNode, portId, side }
    }
    target ??= nearestPort(toWorld(clientX, clientY), side, from.nodeId)
    const node = nodeId ? nodesById[nodeId] : undefined
    if (!target && node) {
      const port = portsOn(node, side)[0]
      if (port) target = { nodeId: node.id, portId: port.id, side }
    }
    if (target?.nodeId === from.nodeId) target = null
    return { target, free: !target && !node && Boolean(hit?.closest('[data-canvas-surface]')) }
  }

  /** Wires `fixed` to `target`, moving `edgeId` there when a line was picked up; a line that's already there is left alone. */
  const connectPorts = (fixed: PortRef, target: PortRef, edgeId?: string) => {
    const [out, input] = fixed.side === 'out' ? [fixed, target] : [target, fixed]
    const wired = { from: out.nodeId, fromPort: out.portId, to: input.nodeId, toPort: input.portId }
    const exists = doc.edges.some(
      (edge) => edge.from === wired.from && edge.fromPort === wired.fromPort && edge.to === wired.to && edge.toPort === wired.toPort,
    )
    if (exists) return
    const next = edgeId ? doc.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...wired } : edge)) : [...doc.edges, { id: createId('edge'), ...wired }]
    commit({ ...doc, edges: next })
  }

  const beginConnection = (from: PortRef, clientX: number, clientY: number, edgeId?: string) => {
    stopAnimation()
    setPendingInsert(null)
    setSplitting(null)
    setConnection({ from, pointer: toWorld(clientX, clientY), target: null, free: false, edgeId })
  }

  const moveConnection = (event: ReactPointerEvent<Element>) => {
    if (!connection) return
    setConnection({ ...connection, pointer: toWorld(event.clientX, event.clientY), ...connectionAim(event.clientX, event.clientY, connection.from) })
  }

  const endConnection = (event: ReactPointerEvent<Element>) => {
    if (!connection) return
    const { target, free } = connectionAim(event.clientX, event.clientY, connection.from)
    setConnection(null)
    if (target) connectPorts(connection.from, target, connection.edgeId)
    else if (free) setPendingInsert({ from: connection.from, point: toWorld(event.clientX, event.clientY), edgeId: connection.edgeId })
  }

  const cancelConnection = () => {
    edgePressRef.current = null
    portPressRef.current = null
    setConnection(null)
  }

  /** An input already wired picks up its line; anything else starts a new one. */
  const onPortPointerDown = (event: ReactPointerEvent<HTMLSpanElement>, port: PortRef) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    portPressRef.current = port.side === 'out' ? { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY } : null
    const wired = port.side === 'in' ? doc.edges.findLast((edge) => edge.to === port.nodeId && edge.toPort === port.portId) : undefined
    if (wired) beginConnection({ nodeId: wired.from, portId: wired.fromPort, side: 'out' }, event.clientX, event.clientY, wired.id)
    else beginConnection(port, event.clientX, event.clientY)
  }

  /** A click on an output dot runs a line straight out from it and offers a node to connect. */
  const onPortPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const press = portPressRef.current
    portPressRef.current = null
    const clicked =
      press?.pointerId === event.pointerId && Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < EDGE_DRAG_THRESHOLD
    const start = clicked && connection ? portWorldPoint(connection.from) : null
    if (!connection || !start) {
      endConnection(event)
      return
    }
    setConnection(null)
    setPendingInsert({ from: connection.from, point: { x: outEnd(start).x + PORT_CLICK_REACH, y: start.y } })
  }

  const portHandlers: PortHandlers = {
    onPointerDown: onPortPointerDown,
    onPointerMove: moveConnection,
    onPointerUp: onPortPointerUp,
    onPointerCancel: cancelConnection,
  }

  const onEdgePointerDown = (event: ReactPointerEvent<SVGPathElement>, id: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    if (event.shiftKey) {
      setSelection(pickedSelection(selectedIds(selection, 'node'), toggled(selectedIds(selection, 'edge'), id)))
      return
    }
    setSelection({ kind: 'edge', id })
    event.currentTarget.setPointerCapture(event.pointerId)
    edgePressRef.current = { pointerId: event.pointerId, edgeId: id, startX: event.clientX, startY: event.clientY }
  }

  /** Past the threshold, the end nearer the press comes loose and follows the pointer. */
  const onEdgePointerMove = (event: ReactPointerEvent<SVGPathElement>) => {
    const press = edgePressRef.current
    if (press?.pointerId !== event.pointerId) {
      moveConnection(event)
      return
    }
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < EDGE_DRAG_THRESHOLD) return
    edgePressRef.current = null
    const edge = edges.find((item) => item.id === press.edgeId)
    if (!edge) return
    const start = toWorld(press.startX, press.startY)
    const nearInput = Math.hypot(start.x - edge.b.x, start.y - edge.b.y) <= Math.hypot(start.x - edge.a.x, start.y - edge.a.y)
    const fixed: PortRef = nearInput ? { nodeId: edge.from, portId: edge.fromPort, side: 'out' } : { nodeId: edge.to, portId: edge.toPort, side: 'in' }
    beginConnection(fixed, event.clientX, event.clientY, edge.id)
  }

  const onEdgePointerUp = (event: ReactPointerEvent<SVGPathElement>) => {
    edgePressRef.current = null
    endConnection(event)
  }

  /** Where the node offered for a dropped line goes: just past the line's end, on the side it connects from. */
  const insertBox = (from: PortRef, point: Point, width = DEFAULT_NODE_SIZE.w): Rect => ({
    x: from.side === 'out' ? point.x + INSERT_GAP : point.x - INSERT_GAP - width,
    y: point.y - DEFAULT_NODE_SIZE.h / 2,
    w: width,
    h: DEFAULT_NODE_SIZE.h,
  })

  /** Adds the node picked for a dropped line and wires it in one undo step. */
  const insertConnected = (typeId: string) => {
    const pending = pendingInsert
    const type = NODE_TYPES_BY_ID[typeId]
    setPendingInsert(null)
    if (!pending || !type) return
    const id = createId(typeId)
    const node = createNode(type, id)
    const port = pending.from.side === 'out' ? type.inputs[0] : nodeOutputs(node, type)[0]
    if (!port) return
    const box = insertBox(pending.from, pending.point, type.width ?? DEFAULT_NODE_SIZE.w)
    const wired =
      pending.from.side === 'out'
        ? { from: pending.from.nodeId, fromPort: pending.from.portId, to: id, toPort: port.id }
        : { from: id, fromPort: port.id, to: pending.from.nodeId, toPort: pending.from.portId }
    const next = pending.edgeId
      ? doc.edges.map((edge) => (edge.id === pending.edgeId ? { ...edge, ...wired } : edge))
      : [...doc.edges, { id: createId('edge'), ...wired }]
    commit({ ...doc, nodes: [...doc.nodes, node], positions: { ...doc.positions, [id]: { x: box.x, y: box.y } }, edges: next })
    const side: PortSide = pending.from.side === 'out' ? 'in' : 'out'
    const clearance = side === 'in' ? portClearance : -portClearance
    alignRef.current = { port: { nodeId: id, portId: port.id, side }, at: { x: pending.point.x + clearance, y: pending.point.y } }
    setSelection({ kind: 'node', id })
    centreOn(box)
  }

  /**
   * Puts the picked node into the line whose + was pressed, wired between its two ends, in one undo step. When the
   * gap is too narrow, the line's far end and everything after it move right to make room.
   */
  const insertBetween = (typeId: string) => {
    const split = splitting
    setSplitting(null)
    const edge = split && doc.edges.find((item) => item.id === split.edgeId)
    const type = NODE_TYPES_BY_ID[typeId]
    if (!split || !edge || !type || (type.singleton && doc.nodes.some((node) => node.type === typeId))) return
    const id = createId(typeId)
    const node = createNode(type, id)
    const input = type.inputs[0]
    const output = nodeOutputs(node, type)[0]
    if (!input || !output) return
    const width = type.width ?? DEFAULT_NODE_SIZE.w
    const boxOf = (nodeId: string) => {
      const position = doc.positions[nodeId]
      const size = layouts[nodeId]
      return position && size ? { ...position, w: size.w, h: size.h } : null
    }
    const source = boxOf(edge.from)
    const target = boxOf(edge.to)
    let positions = doc.positions
    const shifted = new Set<string>()
    let x = split.at.x - width / 2
    const needs = width + SPLIT_GAP * 2
    if (source && target && target.x > source.x) {
      const room = target.x - (source.x + source.w)
      const by = needs - room
      if (by > 0) {
        // Everything the far end leads to, short of the line's own start and what leads into it, so a loop doesn't move it.
        const upstream = new Set([edge.from])
        for (let grew = true; grew; ) {
          grew = false
          for (const item of doc.edges) {
            if (upstream.has(item.to) && !upstream.has(item.from)) {
              upstream.add(item.from)
              grew = true
            }
          }
        }
        const queue = [edge.to]
        while (queue.length) {
          const next = queue.pop()
          if (!next || shifted.has(next) || upstream.has(next)) continue
          shifted.add(next)
          for (const item of doc.edges) if (item.from === next) queue.push(item.to)
        }
        positions = { ...positions }
        for (const nodeId of shifted) if (positions[nodeId]) positions[nodeId] = { x: positions[nodeId].x + by, y: positions[nodeId].y }
      }
      x = source.x + source.w + (Math.max(room, needs) - width) / 2
    }
    const start = portWorldPoint({ nodeId: edge.from, portId: edge.fromPort, side: 'out' })
    const level = start?.y ?? split.at.y
    const placed: CanvasDoc = {
      ...doc,
      nodes: [...doc.nodes, node],
      positions: { ...positions, [id]: { x, y: level - DEFAULT_NODE_SIZE.h / 2 } },
      edges: [
        ...doc.edges.filter((item) => item.id !== edge.id),
        { ...edge, to: id, toPort: input.id },
        { id: createId('edge'), from: id, fromPort: output.id, to: edge.to, toPort: edge.toPort },
      ],
    }
    commit(shifted.size ? makeRoom(placed, shifted, layouts) : placed)
    alignRef.current = { port: { nodeId: id, portId: input.id, side: 'in' }, at: { x, y: level }, levelOnly: true }
    setSelection({ kind: 'node', id })
    centreOn({ x, y: level - DEFAULT_NODE_SIZE.h / 2, w: width, h: DEFAULT_NODE_SIZE.h })
  }

  const onLibraryDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(NODE_DRAG_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onLibraryDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const typeId = event.dataTransfer.getData(NODE_DRAG_MIME)
    if (!typeId) return
    event.preventDefault()
    const ghost = dragGhostRef.current
    const height = ghost && dragGhost === typeId ? ghost.getBoundingClientRect().height / viewRef.current.zoom : undefined
    const id = addNode(typeId, toWorld(event.clientX, event.clientY), undefined, height)
    if (id) droppedRef.current.add(id)
  }

  const portWorldPoint = (port: PortRef): Point | null => {
    const offset = layouts[port.nodeId]?.ports[layoutPortKey(port.side, port.portId)]
    const position = doc.positions[port.nodeId]
    if (!offset || !position) return null
    return { x: position.x + offset.x, y: position.y + offset.y }
  }
  /** Edges stop short of the dots; ports leave along the x axis, so the ends pull in horizontally. */
  const portClearance = canvasLook.ports.size / 2 + EDGE_PORT_GAP
  const outEnd = (point: Point): Point => ({ x: point.x + portClearance, y: point.y })
  const inEnd = (point: Point): Point => ({ x: point.x - portClearance, y: point.y })
  const edges = doc.edges.flatMap((edge) => {
    const from = portWorldPoint({ nodeId: edge.from, portId: edge.fromPort, side: 'out' })
    const to = portWorldPoint({ nodeId: edge.to, portId: edge.toPort, side: 'in' })
    if (!from || !to) return []
    const a = outEnd(from)
    const b = inEnd(to)
    const [c1, c2] = edgeControls(a, b)
    return [{ ...edge, a, b, c1, c2, d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`, mid: bezierPoint(a, c1, c2, b, 0.5) }]
  })
  /** The line being drawn, or the one waiting on the insert panel. */
  const drawing = connection ?? (pendingInsert && { from: pendingInsert.from, pointer: pendingInsert.point, target: null, free: false, edgeId: pendingInsert.edgeId })
  const draftEdge = (() => {
    if (!drawing) return null
    const start = portWorldPoint(drawing.from)
    const target = drawing.target && portWorldPoint(drawing.target)
    if (!start) return null
    const [a, b] =
      drawing.from.side === 'out'
        ? [outEnd(start), target ? inEnd(target) : drawing.pointer]
        : [target ? outEnd(target) : drawing.pointer, inEnd(start)]
    const [c1, c2] = edgeControls(a, b)
    return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
  })()
  const insertGhost = connection?.free ? insertBox(connection.from, connection.pointer) : null
  /** The line with a + at its middle: the one whose panel is open, else the hovered one, else the one selected on its own. */
  const plusEdge =
    connection || pendingInsert || tool !== 'select' ? null : (splitting?.edgeId ?? hoveredEdge ?? (selection?.kind === 'edge' ? selection.id : null))
  /** Lit: the hovered or selected lines' ends, and the end a drawn line leaves from. */
  const litEdges = new Set([...(hoveredEdge ? [hoveredEdge] : []), ...selectedIds(selection, 'edge')])
  const activePorts = new Set([
    ...(drawing ? [portKey(drawing.from)] : []),
    ...doc.edges
      .filter((edge) => litEdges.has(edge.id) && edge.id !== drawing?.edgeId)
      .flatMap((edge) => [
        portKey({ nodeId: edge.from, portId: edge.fromPort, side: 'out' }),
        portKey({ nodeId: edge.to, portId: edge.toPort, side: 'in' }),
      ]),
  ])
  const targetPort = connection?.target ? portKey(connection.target) : null
  const connectedPorts = new Set(
    doc.edges.flatMap((edge) => [
      portKey({ nodeId: edge.from, portId: edge.fromPort, side: 'out' }),
      portKey({ nodeId: edge.to, portId: edge.toPort, side: 'in' }),
    ]),
  )
  /** What a node receives: the rows its wired ports carried on their last run. */
  const inputFor = (id: string): DataRecord[] | null => {
    if (fixtures[id]) return fixtures[id]
    const upstream = doc.edges.filter((edge) => edge.to === id && runs[edge.from]?.ports?.[edge.fromPort])
    if (upstream.length === 0) return null
    return upstream.flatMap((edge) => runs[edge.from]?.ports?.[edge.fromPort] ?? [])
  }
  const wiredStep = (id: string): WiredStep[] => {
    const node = nodesById[id]
    return node ? [{ id, typeId: node.type, name: nodeName(node, nodeType(node)) }] : []
  }
  const notTrigger = (step: WiredStep) => NODE_TYPES_BY_ID[step.typeId]?.category !== 'triggers'
  const wiringGraph = (id: string) => ({
    wired: doc.edges
      .filter((edge) => edge.to === id)
      .flatMap((edge) => wiredStep(edge.from))
      .filter(notTrigger),
    upstream: ancestorsNearestFirst(id, doc.edges).flatMap(wiredStep).filter(notTrigger),
  })
  const wiringIssue = (node: CanvasNode) => kindWiringIssue(node.type, node.config.params, () => wiringGraph(node.id))
  /** The step an edge comes from, named with its branch when it has several. */
  const sourceName = (edge: WorkflowEdge) => {
    const from = nodesById[edge.from]
    if (!from) return undefined
    const fromType = nodeType(from)
    const outputs = nodeOutputs(from, fromType)
    const branch = outputs.length > 1 ? outputs.find((output) => output.id === edge.fromPort)?.label : undefined
    return branch ? `${nodeName(from, fromType)} · ${branch}` : nodeName(from, fromType)
  }
  /**
   * Each wired step with the rows it sent, named by the port it feeds when there are several, then the steps a
   * kind reads beside them, each with its role. A saved asset shows the rows it was made from.
   */
  const inputGroups = (node: CanvasNode): DataGroup[] | undefined => {
    if (fixtures[node.id]) return undefined
    const inputs = nodeInputs(node, nodeType(node))
    const layers = kindInputLayers(node.type, node.config.params, ancestorsNearestFirst(node.id, doc.edges).flatMap(wiredStep))
    const portLabel = (edge: WorkflowEdge) =>
      inputs.length > 1 ? (inputs.find((port) => port.id === edge.toPort)?.label ?? edge.toPort) : undefined
    const wired = doc.edges.filter((edge) => edge.to === node.id && NODE_TYPES_BY_ID[nodesById[edge.from]?.type]?.category !== 'triggers')
    const wiredIds = new Set(wired.map((edge) => edge.from))
    return [
      ...wired.flatMap((edge) => {
        const name = sourceName(edge)
        const from = nodesById[edge.from]
        const role = layers?.wired ?? portLabel(edge)
        return name && from ? [{ id: edge.id, name, typeId: from.type, role, records: runs[edge.from]?.ports?.[edge.fromPort] ?? null }] : []
      }),
      ...(layers?.references ?? [])
        .filter((reference) => !wiredIds.has(reference.id))
        .flatMap((reference) =>
          wiredStep(reference.id).map((step) => ({
            id: step.id,
            name: step.name,
            typeId: step.typeId,
            role: reference.role,
            records: runs[step.id]?.assetRows ?? runRows(runs[step.id]),
          })),
        ),
    ]
  }
  /** Per input port, the steps wired in, named with their branch when they have several, and the rows they sent. */
  const inputSources = (node: CanvasNode, type: NodeType): Record<string, InputSource> | undefined => {
    const inputs = nodeInputs(node, type)
    if (inputs.length < 2) return undefined
    return Object.fromEntries(
      inputs.flatMap((port) => {
        const edges = doc.edges.filter((edge) => edge.to === node.id && edge.toPort === port.id)
        if (!edges.length) return []
        const names = edges.flatMap((edge) => sourceName(edge) ?? [])
        const sent = edges.flatMap((edge) => runs[edge.from]?.ports?.[edge.fromPort] ?? [])
        const ran = edges.some((edge) => runs[edge.from]?.ports?.[edge.fromPort])
        return [[port.id, { names, rows: ran ? sent.length : null }]]
      }),
    )
  }
  const neighbour = (id: string): NeighbourNode[] => {
    const node = nodesById[id]
    if (!node) return []
    const type = nodeType(node)
    return [{ id, name: nodeName(node, type), icon: type.icon, tone: type.tone }]
  }
  const configuring = configuringId ? nodesById[configuringId] : undefined
  const configWindow = (() => {
    if (!configuring) return null
    const id = configuring.id
    const inbound = doc.edges.filter((edge) => edge.to === id)
    const parents = new Set(inbound.map((edge) => edge.from))
    const aliases = nodeAliases(doc.nodes)
    const upstream: UpstreamNode[] = ancestorsNearestFirst(id, doc.edges).flatMap((ancestorId) =>
      neighbour(ancestorId).map((item) => {
        const run = runs[ancestorId] ?? IDLE
        const wired = inbound.filter((edge) => edge.from === ancestorId)
        const records = wired.length
          ? wired.some((edge) => run.ports?.[edge.fromPort])
            ? wired.flatMap((edge) => run.ports?.[edge.fromPort] ?? [])
            : null
          : runRows(run)
        const type = nodeType(nodesById[ancestorId])
        return {
          ...item,
          run,
          records: records ? [...records] : null,
          direct: parents.has(ancestorId),
          alias: aliases[ancestorId],
          typeId: type.id,
          category: type.category,
        }
      }),
    )
    return (
      <NodeConfigWindow
        node={configuring}
        type={nodeType(configuring)}
        run={runs[id] ?? IDLE}
        workflowName={name}
        previous={[...parents].flatMap(neighbour)}
        next={[...new Set(doc.edges.filter((edge) => edge.from === id).map((edge) => edge.to))].flatMap(neighbour)}
        upstream={upstream}
        fixture={fixtures[id] ?? null}
        onConfig={(patch, key) => setNodeConfig(id, patch, key)}
        onParams={(patch, key) => setNodeParams(id, patch, key)}
        hasChatTrigger={doc.nodes.some((node) => node.type === 'chatInput')}
        onSettings={(patch) => setNodeSettings(id, patch)}
        onFixture={(records) => setFixture(id, records)}
        onExecute={() => runNodes(id, nodeType(configuring).category === 'triggers' ? 'downstream' : 'node')}
        onExecutePrevious={() => runNodes(id, 'upstream')}
        onReply={(reply) => replyTo(id, reply)}
        focus={configFocus}
        reveal={configReveal}
        onNavigate={(nodeId) => openConfig(nodeId)}
        onClose={closeConfig}
      />
    )
  })()
  const toggleDataDialog = (id: string) => setDataDialogId((open) => (open === id ? null : id))
  const usedTypes = new Set(doc.nodes.map((node) => node.type))
  /** Chat runs need a chat session, so the run buttons offer the other triggers, default first. */
  const triggers: TriggerOption[] = executableTriggers(doc.nodes).map((node) => {
    const type = nodeType(node)
    const title = nodeName(node, type)
    return { id: node.id, title, typeTitle: title === type.title ? undefined : type.title, icon: type.icon }
  })
  const triggerFor = (id: string | null) => triggers.find((option) => option.id === id) ?? triggers[0]
  const testTrigger = triggerFor(testTriggerId)
  const flowState: FlowState = { published, publishedAt: publishedAt ?? undefined, defaultTriggerId: defaultTriggerId(doc.nodes) }

  const running = activeRuns > 0
  /** The run look also plays while previewing it from the canvas background panel. */
  const runLook = running || Boolean(runResult?.fromRun) || (runPreview && canvasLookOpen)
  const rootClass = [
    styles.root,
    panning ? styles.panning : null,
    connection ? styles.connecting : null,
    tool === 'hand' || spaceHeld ? styles.handTool : tool !== 'select' ? styles.placing : null,
    tool === 'comment' ? styles.commenting : null,
    runLook ? styles.runLook : null,
  ]
    .filter(Boolean)
    .join(' ')
  const selectedNodes = new Set(selectedIds(selection, 'node'))
  const groupedNodes = selectedNodes.size > 1
  const selectedEdges = new Set(selectedIds(selection, 'edge'))

  const toScreen = (point: Point) => ({ left: view.x + point.x * view.zoom, top: view.y + point.y * view.zoom })
  /** Just past the dropped line's end, with the header level with it, offering nodes for the other side of the line. */
  const insertPanelAnchor = ({ from, point }: PendingInsert) => {
    const screen = toScreen(point)
    const gap = INSERT_GAP * view.zoom
    const connectsOn: PortSide = from.side === 'out' ? 'in' : 'out'
    return { x: from.side === 'out' ? screen.left + gap : screen.left - gap, top: screen.top - INSERT_PANEL_LIFT, connectsOn }
  }
  const splitAnchor = splitting ? toScreen(splitting.at) : null
  /** Bigger sections first, so a section drawn inside another sits on top of it. */
  const sectionsByArea = [...doc.sections].sort((a, b) => b.w * b.h - a.w * a.h)
  const selectedSection = selection?.kind === 'section' ? doc.sections.find((item) => item.id === selection.id) : undefined
  const selectedText =
    selection?.kind === 'text' && editingText !== selection.id ? doc.texts.find((item) => item.id === selection.id) : undefined
  const openComment = selection?.kind === 'comment' ? doc.comments.find((item) => item.id === selection.id) : undefined
  /** Outlined: the node under the comment tool, or the one the open comment is pinned to. */
  const commentTarget = (() => {
    const id = commentDraft ? commentDraft.nodeId : (openComment?.nodeId ?? (tool === 'comment' ? commentHover : undefined))
    const position = id ? doc.positions[id] : undefined
    const node = id ? nodesById[id] : undefined
    if (!id || !position || !node) return null
    const size = layouts[id] ?? DEFAULT_NODE_SIZE
    return { ...position, ...size, sticky: isAnnotation(nodeType(node)) }
  })()
  const toolbarAnchor = (point: Point, clearance: number) => {
    const screen = toScreen(point)
    return { left: Math.max(16, screen.left), top: Math.max(CHROME_TOP, screen.top - clearance - ITEM_TOOLBAR_GAP) }
  }
  /** Hidden mid-drag, like FigJam, so it doesn't trail the node around. */
  const selectedNode =
    selection?.kind === 'node' && !draggingNodes.has(selection.id) && !connection ? nodesById[selection.id] : undefined
  const nodeFrame = (node: CanvasNode | undefined) => {
    const position = node && doc.positions[node.id]
    const size = node && layouts[node.id]
    if (!position || !size) return null
    const top = toScreen({ x: position.x + size.w / 2, y: position.y })
    return { left: top.left, top: top.top, bottom: toScreen({ x: position.x, y: position.y + size.h }).top }
  }
  const dataDialogNode = dataDialogId ? nodesById[dataDialogId] : undefined
  const dataDialogPosition = dataDialogNode && doc.positions[dataDialogNode.id]
  const dataDialogSize = dataDialogNode && layouts[dataDialogNode.id]
  const dataDialog =
    dataDialogNode && dataDialogPosition && dataDialogSize ? (
      <NodeDataDialog
        key={dataDialogNode.id}
        node={dataDialogNode}
        type={nodeType(dataDialogNode)}
        run={runs[dataDialogNode.id] ?? IDLE}
        input={inputFor(dataDialogNode.id)}
        output={runRows(runs[dataDialogNode.id])}
        inputGroups={inputGroups(dataDialogNode)}
        anchor={{
          ...toScreen(dataDialogPosition),
          right: toScreen({ x: dataDialogPosition.x + dataDialogSize.w, y: 0 }).left,
          bottom: toScreen({ x: 0, y: dataDialogPosition.y + dataDialogSize.h }).top,
        }}
        clearTop={CHROME_TOP}
        clearBottom={CHROME_BOTTOM}
        onClose={closeDataDialog}
        onViewAll={() => {
          closeDataDialog()
          openConfig(dataDialogNode.id)
        }}
        onReply={(reply) => replyTo(dataDialogNode.id, reply)}
        problemsNow={currentProblemKeys(
          dataDialogNode.type,
          dataDialogNode.config.params,
          needsInput(dataDialogNode.type, nodeType(dataDialogNode).inputs.length) &&
            !doc.edges.some((edge) => edge.to === dataDialogNode.id) &&
            !fixtures[dataDialogNode.id],
          () => wiringGraph(dataDialogNode.id),
        )}
        onProblemAction={(action) => {
          if (action.kind === 'executePrevious') return runNodes(dataDialogNode.id, 'upstream')
          closeDataDialog()
          openConfig(dataDialogNode.id, undefined, action)
        }}
      />
    ) : null
  const selectedFrame = nodeFrame(selectedNode)
  const selectedNodeBar = selectedFrame && {
    left: selectedFrame.left,
    top: Math.max(CHROME_TOP + NODE_TOOLBAR_HEIGHT, selectedFrame.top - NODE_TOOLBAR_GAP),
  }
  /** Sticky notes keep their toolbar on selection; every other node shows its actions on hover. */
  const hoverTarget = hoveredNodeId && !draggingNodes.has(hoveredNodeId) && !connection ? nodesById[hoveredNodeId] : undefined
  const hoveredNode = hoverTarget && !isAnnotation(nodeType(hoverTarget)) ? hoverTarget : undefined
  const hoveredFrame = nodeFrame(hoveredNode)
  /** Above the node, or below it when the header leaves no room; never over the card. */
  const hoveredNodeBar =
    hoveredFrame &&
    (hoveredFrame.top - NODE_TOOLBAR_GAP - NODE_ACTIONS_HEIGHT >= CHROME_TOP
      ? { left: hoveredFrame.left, top: hoveredFrame.top - NODE_TOOLBAR_GAP, below: false }
      : { left: hoveredFrame.left, top: hoveredFrame.bottom + NODE_TOOLBAR_GAP, below: true })

  /** The insert tools toggle off on a second press and show their labels; the pointer tools are icons only. */
  const toolButtons = (options: readonly ToolOption[], insert: boolean) =>
    options.map((option) => {
      const ToolIcon = option.icon
      const active = tool === option.id
      const base = insert ? controls.barAction : controls.barButton
      const activeClass = insert ? controls.barActionActive : controls.barButtonActive
      return (
        <button
          key={option.id}
          type="button"
          className={`${base}${active ? ` ${activeClass}` : ''}`}
          aria-label={option.label}
          data-shortcut={option.shortcut}
          aria-pressed={active}
          onClick={() => setTool(insert && active ? 'select' : option.id)}
        >
          <ToolIcon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
          {insert ? option.label : null}
        </button>
      )
    })
  const minimap = (
    <CanvasMinimap
      nodes={doc.nodes.flatMap((node) => {
        const position = doc.positions[node.id]
        if (!position) return []
        const type = nodeType(node)
        const { w, h } = layouts[node.id] ?? DEFAULT_NODE_SIZE
        return [{ id: node.id, ...position, w, h, tone: type.tone, fill: isAnnotation(type) ? stickyFill(stickyStyle(node.config.sticky).color) : undefined }]
      })}
      sections={doc.sections}
      view={view}
      canvasRef={rootRef}
      onPan={(next) => {
        stopAnimation()
        setView(next)
      }}
    />
  )
  const askButton = (
    <button
      type="button"
      className={`${controls.askButton} ${styles.footerBar}`}
      aria-label="Ask Llumen"
      aria-expanded={chatFrom !== null}
      onClick={(event) => {
        if (chatFrom) setChatCollapseToken((token) => token + 1)
        else setChatFrom(event.currentTarget.getBoundingClientRect())
      }}
    >
      <img className={controls.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
    </button>
  )
  /** Undo and redo, zoom and fit: the right-hand bar in the split style. */
  const canvasControls = (
    <>
      <button type="button" className={controls.barButton} aria-label="Undo" data-shortcut={SHORTCUTS.undo} disabled={past.length === 0} onClick={undo}>
        <ArrowUUpLeft size={20} weight="regular" aria-hidden />
      </button>
      <button type="button" className={controls.barButton} aria-label="Redo" data-shortcut={SHORTCUTS.redo} disabled={future.length === 0} onClick={redo}>
        <ArrowUUpRight size={20} weight="regular" aria-hidden />
      </button>
      <span className={controls.barDivider} aria-hidden />
      <button
        type="button"
        className={controls.barButton}
        aria-label="Zoom out"
        data-shortcut={SHORTCUTS.zoomOut}
        disabled={view.zoom <= MIN_ZOOM}
        onClick={() => zoomFromCenter(1 / BUTTON_ZOOM_STEP)}
      >
        <MagnifyingGlassMinus size={20} weight="regular" aria-hidden />
      </button>
      <button
        type="button"
        className={controls.barButton}
        aria-label="Zoom in"
        data-shortcut={SHORTCUTS.zoomIn}
        disabled={view.zoom >= MAX_ZOOM}
        onClick={() => zoomFromCenter(BUTTON_ZOOM_STEP)}
      >
        <MagnifyingGlassPlus size={20} weight="regular" aria-hidden />
      </button>
      <button type="button" className={controls.barButton} aria-label="Zoom to fit" data-shortcut={SHORTCUTS.fit} onClick={fitToView}>
        <Scan size={20} weight="regular" aria-hidden />
      </button>
    </>
  )
  const inserting = CONTENT_TOOLS.some((option) => option.id === tool)

  return (
    <div
      className={rootClass}
      ref={rootRef}
      role="application"
      aria-label={`${name} workflow canvas`}
      data-connecting={connection?.from.side}
      data-ports-hidden={!connection && Math.round(view.zoom * 100) <= PORTS_MIN_ZOOM * 100 ? '' : undefined}
      data-section-surface={cardLook.surface.fill === 'default' ? undefined : cardLook.surface.fill}
      data-card-glow="iconHeader"
      style={{ ...cardStyle(canvasLook), ...cardLookStyle(cardLook) }}
      onPointerOver={onNodeHover}
      onPointerLeave={leaveNodeHover}
    >
      <div className={styles.backdrop} aria-hidden>
        {canvasLook.paint.fill === 'default' ? (
          <>
            <img className={styles.backdropImage} src={`${import.meta.env.BASE_URL}agent-builder/canvas-bg.png`} alt="" />
            <div className={styles.backdropTint} />
          </>
        ) : (
          <NodeFill paint={canvasLook.paint} blurScale={CANVAS_BLUR_SCALE} />
        )}
        {canvasAmbient.style === 'smoke' ? (
          <SmokeShader
            className={styles.backdropShader}
            colors={canvasAmbient.stops}
            intensity={canvasAmbient.smoke.intensity}
            speed={canvasAmbient.smoke.speed}
            scale={canvasAmbient.smoke.scale}
            paused={shaderPaused}
          />
        ) : null}
        {canvasAmbient.style === 'rays' ? (
          <RayShader className={styles.backdropShader} colors={canvasAmbient.stops} rays={canvasAmbient.rays} paused={shaderPaused} />
        ) : null}
      </div>
      <AmbientLayer ambient={ambient} running={runLook} paused={shaderPaused} />

      <div
        className={styles.surface}
        data-canvas-surface
        style={gridStyle(view, canvasLook.dots)}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerLeave={(event) => {
          markNearNodes(event.currentTarget, Infinity, Infinity)
          setCommentHover(undefined)
        }}
        onPointerUp={onSurfacePointerUp}
        onPointerCancel={onSurfacePointerCancel}
        onDragOver={onLibraryDragOver}
        onDrop={onLibraryDrop}
      >
        <div
          className={styles.world}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, '--zoom': view.zoom } as CSSProperties}
        >
          {sectionsByArea.map((section) => (
            <SectionView
              key={section.id}
              section={section}
              selected={selection?.kind === 'section' && selection.id === section.id}
              renaming={renamingSection === section.id}
              gesture={gestureHandlers}
              onTitlePointerDown={(event) => onSectionPointerDown(event, section.id)}
              onResizePointerDown={(event, corner) => onSectionResizePointerDown(event, section.id, corner)}
              onRenameStart={() => setRenamingSection(section.id)}
              onRenameEnd={(name) => renameSection(section.id, name)}
            />
          ))}
          {sectionDraft ? (
            <div
              className={itemStyles.sectionDraft}
              style={{ left: sectionDraft.x, top: sectionDraft.y, width: sectionDraft.w, height: sectionDraft.h }}
            />
          ) : null}

          <svg className={styles.edges} width="1" height="1" aria-hidden>
            <defs>
              {edges.map((edge) => (
                <linearGradient
                  key={edge.id}
                  id={`edge-${edge.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={edge.a.x}
                  y1={edge.a.y}
                  x2={edge.b.x}
                  y2={edge.b.y}
                >
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#73adf5" />
                </linearGradient>
              ))}
            </defs>
            {edges.map((edge) => (
              <g
                key={edge.id}
                className={selectedEdges.has(edge.id) ? `${styles.edge} ${styles.edgeSelected}` : styles.edge}
                data-moving={edge.id === drawing?.edgeId || undefined}
              >
                <path className={styles.edgeLine} d={edge.d} stroke={`url(#edge-${edge.id})`} />
                <path
                  className={styles.edgeHit}
                  d={edge.d}
                  onPointerDown={(event) => onEdgePointerDown(event, edge.id)}
                  onPointerMove={onEdgePointerMove}
                  onPointerUp={onEdgePointerUp}
                  onPointerCancel={cancelConnection}
                  onPointerEnter={() => setHoveredEdge(edge.id)}
                  onPointerLeave={() => setHoveredEdge((current) => (current === edge.id ? null : current))}
                />
              </g>
            ))}
            {draftEdge ? <path className={styles.edgeDraft} d={draftEdge} /> : null}
          </svg>
          {insertGhost ? (
            <svg
              className={styles.insertGhost}
              style={{ left: insertGhost.x, top: insertGhost.y, width: insertGhost.w, height: insertGhost.h }}
              aria-hidden
            >
              <rect />
            </svg>
          ) : null}

          {edges.map((edge) =>
            edge.id === plusEdge ? (
              <button
                key={edge.id}
                ref={splitButtonRef}
                type="button"
                className={styles.edgeAdd}
                style={{ left: edge.mid.x, top: edge.mid.y }}
                aria-label="Add a node between"
                aria-expanded={splitting?.edgeId === edge.id}
                data-tooltip="Add node"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerEnter={() => setHoveredEdge(edge.id)}
                onPointerLeave={() => setHoveredEdge((current) => (current === edge.id ? null : current))}
                onClick={() => setSplitting((current) => (current?.edgeId === edge.id ? null : { edgeId: edge.id, at: edge.mid }))}
              >
                <Plus size={14} weight="bold" aria-hidden />
              </button>
            ) : edge.label ? (
              <span key={edge.id} className={styles.edgeLabel} style={{ left: edge.mid.x, top: edge.mid.y }}>
                {edge.label}
              </span>
            ) : null,
          )}

          {doc.groups.map((group) => (
            <span key={group.id} className={styles.groupLabel} style={{ left: group.position.x, top: group.position.y }}>
              {group.title}
            </span>
          ))}

          {doc.nodes.map((node) => {
            const type = nodeType(node)
            if (isAnnotation(type)) {
              return (
                <StickyNoteCard
                  key={node.id}
                  node={node}
                  position={doc.positions[node.id]}
                  selected={selectedNodes.has(node.id)}
                  grouped={groupedNodes && selectedNodes.has(node.id)}
                  dragging={draggingNodes.has(node.id)}
                  resize={{
                    onPointerDown: (event, edge) => onResizePointerDown(event, node.id, edge),
                    onPointerMove: onResizePointerMove,
                    onPointerUp: endResize,
                  }}
                  cardRef={(element) => {
                    nodeRefs.current[node.id] = element
                  }}
                  onPointerDown={(event) => onNodePointerDown(event, node.id)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={endNodeDrag}
                  onNoteChange={(note) => setNodeNote(node.id, note)}
                />
              )
            }
            const nodeRun = runs[node.id] ?? IDLE
            const nodeInput = inputFor(node.id)
            const nodeOutput = runRows(runs[node.id])
            const hasInputs = type.inputs.length > 0
            const hasData =
              nodeDataSides(nodeDataViews(nodeRun, nodeInput, nodeOutput, type.category === 'triggers', hasInputs), hasInputs).length > 0
            return (
              <NodeCardSections
                key={node.id}
                node={node}
                type={type}
                position={doc.positions[node.id]}
                selected={selectedNodes.has(node.id)}
                grouped={groupedNodes && selectedNodes.has(node.id)}
                dragging={draggingNodes.has(node.id)}
                run={nodeRun}
                input={nodeInput}
                inputSources={inputSources(node, type)}
                wiringIssue={wiringIssue(node)}
                output={nodeOutput}
                activePorts={activePorts}
                targetPort={targetPort}
                connectedPorts={connectedPorts}
                ports={portHandlers}
                resize={{
                  onPointerDown: (event, edge) => onResizePointerDown(event, node.id, edge),
                  onPointerMove: onResizePointerMove,
                  onPointerUp: endResize,
                }}
                cardRef={(element) => {
                  nodeRefs.current[node.id] = element
                }}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
                onPointerMove={onNodePointerMove}
                onPointerUp={endNodeDrag}
                onDoubleClick={(event) => {
                  if (isAnnotation(type) || (event.target as HTMLElement).closest(CARD_INTERACTIVE)) return
                  openConfig(node.id)
                }}
                onAddOutput={() => addOutput(node.id)}
                onRemoveOutput={(portId) => removeOutput(node.id, portId)}
                onAddInput={() => addNodeInput(node.id)}
                onRemoveInput={(portId) => removeNodeInput(node.id, portId)}
                appearanceOpen={appearanceNode?.id === node.id}
                dataOpen={dataOpen.has(node.id)}
                onDataOpen={(open) => setNodeData(node.id, open)}
                onNoteChange={(note) => setNodeNote(node.id, note)}
                onParamsChange={(patch) => setNodeParams(node.id, patch, 'card')}
                onOpenConfig={(focus) => openConfig(node.id, focus)}
                onOpenData={hasData ? () => toggleDataDialog(node.id) : undefined}
                flow={type.category === 'triggers' ? flowState : undefined}
              />
            )
          })}

          {commentTarget ? (
            <div
              className={styles.commentTarget}
              data-sticky={commentTarget.sticky || undefined}
              style={{
                left: commentTarget.x,
                top: commentTarget.y,
                width: `calc(${commentTarget.w}px + 8 * var(--px))`,
                height: `calc(${commentTarget.h}px + 8 * var(--px))`,
              }}
              aria-hidden
            />
          ) : null}

          {doc.texts.map((item) => (
            <TextView
              key={item.id}
              item={item}
              selected={selection?.kind === 'text' && selection.id === item.id}
              editing={editingText === item.id}
              gesture={gestureHandlers}
              onPointerDown={(event) => onTextPointerDown(event, item.id)}
              onEdit={() => setEditingText(item.id)}
              onCommit={(value) => commitText(item.id, value)}
            />
          ))}
          {textDraft ? (
            <TextView
              item={{ id: 'draft', ...textDraft, text: '', size: TEXT_DEFAULT_SIZE }}
              selected={false}
              editing
              gesture={gestureHandlers}
              onPointerDown={(event) => event.stopPropagation()}
              onEdit={() => {}}
              onCommit={commitTextDraft}
            />
          ) : null}
          {marquee ? (
            <div className={styles.marquee} style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} aria-hidden />
          ) : null}
        </div>
      </div>

      <div className={itemStyles.commentLayer}>
        {doc.comments.map((comment) => (
          <CommentPin
            key={comment.id}
            comment={comment}
            {...toScreen(commentPoint(comment, doc.positions))}
            open={openComment?.id === comment.id}
            gesture={gestureHandlers}
            onPointerDown={(event) => onCommentPointerDown(event, comment.id)}
          />
        ))}
        {openComment ? (
          <CommentThread
            key={openComment.id}
            comment={openComment}
            {...toScreen(commentPoint(openComment, doc.positions))}
            onReply={(text) => updateMessages(openComment.id, (messages) => [...messages, newMessage(text)])}
            onEdit={(messageId, text) =>
              updateMessages(openComment.id, (messages) => messages.map((message) => (message.id === messageId ? { ...message, text } : message)))
            }
            onDeleteMessage={(messageId) => deleteMessage(openComment, messageId)}
            onMarkUnread={() => {
              setCommentUnread(openComment.id, true)
              setSelection(null)
            }}
            onResolve={() => removeItem('comment', openComment.id)}
            onDelete={() => removeItem('comment', openComment.id)}
            onClose={() => setSelection(null)}
          />
        ) : null}
        {commentDraft ? (
          <>
            <CommentPin {...toScreen(commentDraft)} open />
            <CommentComposer
              {...toScreen(commentDraft)}
              onPost={postComment}
              onCancel={() => setCommentDraft(null)}
            />
          </>
        ) : null}
      </div>

      {selectedSection ? (
        <SectionToolbar
          key={`section-${selectedSection.id}`}
          section={selectedSection}
          {...toolbarAnchor(selectedSection, SECTION_TITLE_HEIGHT)}
          canFit={hasMembers(selectedSection)}
          onChange={(patch) => updateSection(selectedSection.id, patch)}
          onRename={() => setRenamingSection(selectedSection.id)}
          onFit={() => fitSection(selectedSection.id)}
          onRemove={() => removeItem('section', selectedSection.id)}
        />
      ) : null}
      {selectedNode && selectedNodeBar && isAnnotation(nodeType(selectedNode)) ? (
        <StickyToolbar
          key={`sticky-${selectedNode.id}`}
          nodeId={selectedNode.id}
          look={stickyStyle(selectedNode.config.sticky)}
          note={selectedNode.config.note ?? ''}
          {...selectedNodeBar}
          onChange={(patch) => setNodeSticky(selectedNode.id, patch)}
          onNoteChange={(note) => setNodeNote(selectedNode.id, note)}
          onDuplicate={() => duplicateNode(selectedNode.id)}
          onDelete={() => deleteNode(selectedNode.id)}
        />
      ) : null}
      {hoveredNode && hoveredNodeBar ? (
        <NodeActionsBar
          key={`actions-${hoveredNode.id}`}
          name={nodeName(hoveredNode, nodeType(hoveredNode))}
          {...hoveredNodeBar}
          isTrigger={nodeType(hoveredNode).category === 'triggers'}
          testLabel={hoveredNode.type === 'chatInput' ? 'Test chat' : undefined}
          annotation={false}
          canDuplicate={!nodeType(hoveredNode).singleton}
          running={runs[hoveredNode.id]?.status === 'running'}
          onRun={(scope) => runNodes(hoveredNode.id, scope)}
          onConfigure={() => openConfig(hoveredNode.id)}
          onDuplicate={() => duplicateNode(hoveredNode.id)}
          onDelete={() => deleteNode(hoveredNode.id)}
        />
      ) : null}
      {pendingInsert ? (
        <InsertNodePanel
          {...insertPanelAnchor(pendingInsert)}
          usedTypes={usedTypes}
          onPick={insertConnected}
          onClose={() => setPendingInsert(null)}
        />
      ) : null}
      {splitAnchor ? (
        <InsertNodePanel
          x={splitAnchor.left}
          top={splitAnchor.top + SPLIT_PANEL_DROP}
          connectsOn="both"
          usedTypes={usedTypes}
          anchorRef={splitButtonRef}
          onPick={insertBetween}
          onClose={() => setSplitting(null)}
        />
      ) : null}
      {dragGhost && NODE_TYPES_BY_ID[dragGhost] ? (
        <NodeDragGhost key={dragGhost} type={NODE_TYPES_BY_ID[dragGhost]} zoom={view.zoom} ports={portHandlers} ghostRef={dragGhostRef} />
      ) : null}
      {selectedText ? (
        <TextToolbar
          item={selectedText}
          {...toolbarAnchor(selectedText, 0)}
          onSize={(size) => setTextSize(selectedText.id, size)}
          onDelete={() => removeItem('text', selectedText.id)}
        />
      ) : null}

      {runResult ? (
        <div
          key={runResult.id}
          className={styles.resultGlow}
          data-outcome={runResult.outcome}
          style={resultGlowStyle(canvasLook.result, runResult.outcome)}
          role="status"
          aria-label={runResult.outcome === 'pass' ? 'Run passed' : 'Run failed'}
        />
      ) : null}

      {runFailures ? <RunFailureToast steps={runFailures} onShow={showStep} onClose={() => setRunFailures(null)} /> : null}

      {tab === 'executions' ? <ExecutionsList executions={executions[mode]} published={published} onCopy={copyExecution} /> : null}

      <div className={styles.headerScrim} aria-hidden />

      <header className={styles.header} data-covers-canvas>
        <button type="button" className={controls.iconButton} aria-label="Back to home" onClick={onClose}>
          <ArrowLeft size={20} weight="regular" aria-hidden />
        </button>
        <div className={styles.titleGroup}>
          {workspace ? <p className={controls.eyebrow}>{workspace}</p> : null}
          <div className={styles.titleRow}>
            <h1 className={controls.title}>{name}</h1>
            <span className={styles.draftBadge} data-published={published || undefined}>
              {published ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Agent view" data-covers-canvas>
        {(['builder', 'executions'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={styles.tab}
            onClick={() => setTab(value)}
          >
            {value === 'builder' ? 'Builder' : 'Executions'}
          </button>
        ))}
      </div>

      {running ? (
        <button type="button" className={styles.stopRun} onClick={stopRun}>
          <Stop size={14} weight="fill" aria-hidden />
          Stop run
        </button>
      ) : null}

      <div className={styles.topRight} data-covers-canvas>
        {flowKind && flowCustomised ? (
          <button
            type="button"
            className={controls.iconButton}
            aria-label={`Reset the ${flowKind} flow`}
            data-tooltip={`Reset to the original ${flowKind} flow`}
            onClick={resetFlow}
          >
            <ArrowCounterClockwise size={20} weight="regular" aria-hidden />
          </button>
        ) : null}
        {flowKind && flowUnsaved ? (
          <button
            type="button"
            className={controls.iconButton}
            aria-label={`Save the ${flowKind} flow`}
            data-tooltip={`Save as the default ${flowKind} flow`}
            onClick={saveFlow}
          >
            <FloppyDisk size={20} weight="regular" aria-hidden />
          </button>
        ) : null}
        <DevMenu
          canSimulate={Boolean(testTrigger)}
          onSimulate={(outcome) => testTrigger && runNodes(testTrigger.id, 'downstream', outcome)}
          testFlow={mode === 'showcase' ? null : mode}
          onTestFlow={(kind) => switchMode(kind ?? 'showcase')}
          cardStyleOpen={cardStyleOpen}
          onCardStyle={() => {
            setCardStyleOpen((open) => !open)
            setCanvasLookOpen(false)
            setAppearanceFor(null)
          }}
          canvasLookOpen={canvasLookOpen}
          onCanvasLook={() => {
            setCanvasLookOpen((open) => !open)
            setCardStyleOpen(false)
            setAppearanceFor(null)
          }}
          canStyleNode={selection?.kind === 'node'}
          nodeStyleOpen={Boolean(appearanceNode)}
          onNodeStyle={() => selection?.kind === 'node' && toggleAppearance(selection.id)}
          shaderPaused={shaderPaused}
          onShaderPaused={toggleShaderPaused}
          toolbarStyle={toolbarStyle}
          onToolbarStyle={chooseToolbarStyle}
        />
        <span className={styles.topDivider} aria-hidden />
        <button type="button" className={controls.iconButton} aria-label="Version history" data-tooltip="Version history">
          <ClockCounterClockwise size={20} weight="regular" aria-hidden />
        </button>
        <button type="button" className={controls.iconButton} aria-label="Share" data-tooltip="Share">
          <ShareNetwork size={20} weight="regular" aria-hidden />
        </button>
        <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
          <RunAgentButton
            label="Test Agent"
            icon={Flask}
            variant="secondary"
            tooltip={(title) => `Test from ${title}`}
            triggers={triggers}
            trigger={testTrigger}
            onTrigger={setTestTriggerId}
            onRun={(triggerId) => runNodes(triggerId, 'downstream')}
          />
          {published ? (
            <RunAgentButton
              label="Execute Agent"
              icon={Play}
              variant="primary"
              tooltip={(title) => `Execute from ${title}`}
              triggers={triggers}
              trigger={triggerFor(executeTriggerId)}
              onTrigger={setExecuteTriggerId}
              onRun={(triggerId) => runNodes(triggerId, 'downstream', undefined, true)}
            />
          ) : null}
          <button
            type="button"
            className={`pg-btn pg-btn--outline ${published ? 'pg-btn--warning' : 'pg-btn--primary'} ${styles.topButton}`}
            onClick={() => setPublishedAt((current) => (current === null ? Date.now() : null))}
          >
            {published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {chatFrom ? (
        <div className={styles.chatDock}>
          <HubChatbox
            placement="story"
            morphFrom={chatFrom}
            collapseToken={chatCollapseToken}
            onCollapse={() => setChatFrom(null)}
            onSubmit={() => {}}
            onOpenSessions={() => {}}
          />
        </div>
      ) : null}

      {tab === 'executions' ? null : toolbarStyle === 'split' ? (
        <footer className={styles.footer}>
          <div className={styles.footerStart}>
            {minimap}
            <div className={`${controls.bar} ${styles.footerBar}`} role="toolbar" aria-label="Add to canvas" data-covers-canvas>
              {toolButtons(CONTENT_TOOLS, true)}
            </div>
          </div>
          <div className={styles.toolbarGroup} ref={setToolbarGroup} data-covers-canvas>
            {askButton}
            <NodeToolbar className={styles.footerBar} usedTypes={usedTypes} panelContainer={toolbarGroup} onAdd={(typeId) => addNode(typeId)} />
          </div>
          <div className={`${controls.bar} ${styles.footerBar} ${styles.controlsBar}`} role="toolbar" aria-label="Canvas controls" data-covers-canvas>
            {toolButtons(POINTER_TOOLS, false)}
            <span className={controls.barDivider} aria-hidden />
            {canvasControls}
          </div>
        </footer>
      ) : (
        <footer className={styles.footer}>
          <div className={styles.footerStart}>{minimap}</div>
          <div className={styles.toolbarGroup} data-covers-canvas>
            {askButton}
            <div ref={singleBarRef} className={styles.singleBar}>
              {barFlyout === 'nodes' ? (
                <div className={`${styles.barFlyout} ${styles.barFlyoutFull}`}>
                  <InsertNodePanel
                    usedTypes={usedTypes}
                    anchorRef={addNodeButtonRef}
                    onPick={(typeId) => addNode(typeId)}
                    onClose={closeBarFlyout}
                    onDragPrepare={setDragGhost}
                    dragImage={() => dragGhostRef.current}
                  />
                </div>
              ) : null}
              {barFlyout === 'insert' ? (
                <div
                  ref={insertBarRef}
                  className={`${controls.bar} ${styles.footerBar} ${styles.barFlyout}`}
                  style={insertBarX === null ? undefined : { left: insertBarX }}
                  role="toolbar"
                  aria-label="Insert"
                >
                  {toolButtons(CONTENT_TOOLS, true)}
                </div>
              ) : null}
              <div className={`${controls.bar} ${styles.footerBar}`} role="toolbar" aria-label="Canvas toolbar">
                {toolButtons(POINTER_TOOLS, false)}
                <span className={controls.barDivider} aria-hidden />
                <button
                  ref={addNodeButtonRef}
                  type="button"
                  className={`${controls.barAction}${barFlyout === 'nodes' ? ` ${controls.barActionActive}` : ''}`}
                  aria-expanded={barFlyout === 'nodes'}
                  onClick={() => setBarFlyout((current) => (current === 'nodes' ? null : 'nodes'))}
                >
                  <Plus size={20} weight={barFlyout === 'nodes' ? 'bold' : 'regular'} aria-hidden />
                  Add node
                </button>
                <button
                  ref={insertButtonRef}
                  type="button"
                  className={`${controls.barAction}${barFlyout === 'insert' || inserting ? ` ${controls.barActionActive}` : ''}`}
                  aria-expanded={barFlyout === 'insert'}
                  onClick={() => setBarFlyout((current) => (current === 'insert' ? null : 'insert'))}
                >
                  <Shapes size={20} weight={barFlyout === 'insert' || inserting ? 'fill' : 'regular'} aria-hidden />
                  Insert
                </button>
                <span className={controls.barDivider} aria-hidden />
                {canvasControls}
              </div>
            </div>
          </div>
        </footer>
      )}

      {appearanceNode ? (
        <AppearancePanel
          key={`appearance-${appearanceNode.id}`}
          nodeName={nodeName(appearanceNode, nodeType(appearanceNode))}
          appearance={appearanceNode.appearance}
          defaults={FRAME_DEFAULTS}
          onChange={(next) => setNodeAppearance(appearanceNode.id, next)}
          onReset={() => setNodeAppearance(appearanceNode.id, undefined)}
          scope={{
            category: NODE_CATEGORIES.find((category) => category.id === nodeType(appearanceNode).category)?.title ?? 'Category',
            categoryCount: appearanceScope(appearanceNode.id, 'category').length,
            allCount: doc.nodes.length,
          }}
          onApply={(parts, scope) => applyAppearance(appearanceNode.id, parts, scope)}
          onClose={() => setAppearanceFor(null)}
        />
      ) : null}

      {canvasLookOpen ? (
        <CanvasLookPanel
          look={canvasLook}
          onChange={updateCanvasLook}
          onReset={() => updateCanvasLook(DEFAULT_CANVAS_LOOK)}
          previewingRun={runPreview}
          onPreviewRun={() => setRunPreview((preview) => !preview)}
          onPreviewResult={(outcome) => setRunResult({ outcome, id: Date.now(), fromRun: false })}
          onClose={() => setCanvasLookOpen(false)}
        />
      ) : null}

      {cardStyleOpen ? (
        <CardStylePanel
          config={cardLook}
          onChange={updateCardLook}
          canvasLook={canvasLook}
          onCanvasLook={updateCanvasLook}
          onClose={() => setCardStyleOpen(false)}
        />
      ) : null}

      {libraryOpen ? <NodeLibrarySheet usedTypes={usedTypes} onAdd={addNode} onClose={closeLibrary} /> : null}

      {configWindow}
      {dataDialog}

      <CanvasTooltip rootRef={rootRef} />
    </div>
  )
}

type DevMenuProps = {
  /** Simulated runs start from the Test Agent trigger, so they need one. */
  canSimulate: boolean
  onSimulate: (outcome: RunOutcome) => void
  /** The test flow on the canvas, or null for the node showcase. */
  testFlow: TestFlowKind | null
  /** Null goes back to the node showcase. */
  onTestFlow: (kind: TestFlowKind | null) => void
  cardStyleOpen: boolean
  onCardStyle: () => void
  canvasLookOpen: boolean
  onCanvasLook: () => void
  /** The appearance panel styles the selected node, so it needs one. */
  canStyleNode: boolean
  nodeStyleOpen: boolean
  onNodeStyle: () => void
  shaderPaused: boolean
  onShaderPaused: () => void
  toolbarStyle: ToolbarStyle
  onToolbarStyle: (style: ToolbarStyle) => void
}

const NOOP = () => {}
const NO_PORTS: ReadonlySet<string> = new Set()
const STILL = { onPointerDown: NOOP, onPointerMove: NOOP, onPointerUp: NOOP }

type NodeDragGhostProps = { type: NodeType; zoom: number; ports: PortHandlers; ghostRef: RefObject<HTMLDivElement | null> }

/** The card a node dragged from the add panel will be, at the canvas zoom, off screen for the drag image. */
function NodeDragGhost({ type, zoom, ports, ghostRef }: NodeDragGhostProps) {
  const [node] = useState(() => createNode(type, 'drag-ghost'))
  const card = { node, position: { x: 0, y: 0 }, selected: false, dragging: false, resize: STILL, cardRef: NOOP, onNoteChange: NOOP, ...STILL }
  return (
    // The zoom sits inside, so the outer box measures the same in browsers that do and don't scale a zoomed element's rect.
    <div ref={ghostRef} className={styles.dragGhost} aria-hidden>
      <div style={{ zoom, '--zoom': zoom } as CSSProperties}>
        {isAnnotation(type) ? (
          <StickyNoteCard {...card} />
        ) : (
          <NodeCardSections
            {...card}
            type={type}
            run={IDLE}
            input={null}
            output={null}
            activePorts={NO_PORTS}
            targetPort={null}
            connectedPorts={NO_PORTS}
            ports={ports}
            onDoubleClick={NOOP}
            onAddOutput={NOOP}
            appearanceOpen={false}
            dataOpen={false}
            onDataOpen={NOOP}
          />
        )}
      </div>
    </div>
  )
}

type DevItemProps = { icon: Icon; label: string; hint?: string; checked?: boolean; disabled?: boolean; onSelect: () => void }

function DevItem({ icon: ItemIcon, label, hint, checked, disabled, onSelect }: DevItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      disabled={disabled}
      className={`${controls.menuItem} ${styles.styleOption}`}
      onClick={onSelect}
    >
      <ItemIcon size={18} weight="regular" aria-hidden />
      <span className={styles.styleOptionText}>
        {label}
        {hint ? <span className={styles.styleOptionHint}>{hint}</span> : null}
      </span>
      {checked ? <Check size={16} weight="bold" className={styles.triggerCheck} aria-hidden /> : null}
    </button>
  )
}

const TEST_FLOWS: readonly { kind: TestFlowKind; icon: Icon; label: string; hint: string }[] = [
  { kind: 'simple', icon: ArrowRight, label: 'Simple flow', hint: 'Six steps in a line, with one branch' },
  { kind: 'complex', icon: TreeStructure, label: 'Complex flow', hint: 'A large flow with sections, notes, and comments' },
]

const DEV_SECTIONS: Record<DevSection, string> = { simulate: 'Simulate a run', workflow: 'Workflow', look: 'Look', toolbar: 'Toolbar' }

type DevSection = 'simulate' | 'workflow' | 'look' | 'toolbar'

type DevSectionItemProps = { icon: Icon; label: string; hint: string; open: boolean; onOpen: (item: HTMLElement) => void; onClose: () => void }

/** A Dev menu entry that opens its section's submenu on hover, click, or the right arrow key. */
function DevSectionItem({ icon: ItemIcon, label, hint, open, onOpen, onClose }: DevSectionItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      className={`${controls.menuItem} ${styles.styleOption}${open ? ` ${controls.menuItemActive}` : ''}`}
      onPointerEnter={(event) => onOpen(event.currentTarget)}
      onClick={(event) => (open ? onClose() : onOpen(event.currentTarget))}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') onOpen(event.currentTarget)
      }}
    >
      <ItemIcon size={18} weight="regular" aria-hidden />
      <span className={styles.styleOptionText}>
        {label}
        <span className={styles.styleOptionHint}>{hint}</span>
      </span>
      <CaretRight size={14} weight="bold" className={styles.triggerCheck} aria-hidden />
    </button>
  )
}

/** Every development action in one menu, so they stay off the bar; each section opens beside it. */
function DevMenu(props: DevMenuProps) {
  const [open, setOpen] = useState(false)
  /** The section whose submenu is open, and where that submenu sits in the wrapper. */
  const [section, setSection] = useState<{ id: DevSection; at: Point } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setSection(null)
  }, [])
  useDismiss(open, wrapRef, close)
  const activeFlow = TEST_FLOWS.find((flow) => flow.kind === props.testFlow)

  // The menu can scroll, which would clip a submenu inside it, so the submenu is its sibling, lined up with the item.
  const openSection = (id: DevSection) => (item: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect()
    const menu = item.closest('[role="menu"]')?.getBoundingClientRect()
    if (!wrap || !menu) return
    setSection({ id, at: { x: menu.right - wrap.left + 4, y: item.getBoundingClientRect().top - wrap.top - 6 } })
  }
  const sectionItem = (id: DevSection, icon: Icon, hint: string) => (
    <DevSectionItem icon={icon} label={DEV_SECTIONS[id]} hint={hint} open={section?.id === id} onOpen={openSection(id)} onClose={() => setSection(null)} />
  )

  const sectionItems = (id: DevSection) => {
    switch (id) {
      case 'simulate':
        return (
          <>
            <DevItem icon={CheckCircle} label="Passing run" disabled={!props.canSimulate} onSelect={() => props.onSimulate('pass')} />
            <DevItem icon={XCircle} label="Failing run" disabled={!props.canSimulate} onSelect={() => props.onSimulate('fail')} />
          </>
        )
      case 'workflow':
        return (
          <>
            <DevItem icon={Shapes} label="All nodes" hint="One of every node type" checked={props.testFlow === null} onSelect={() => props.onTestFlow(null)} />
            <div className={styles.menuSeparator} role="separator" />
            {TEST_FLOWS.map((flow) => (
              <DevItem
                key={flow.kind}
                icon={flow.icon}
                label={flow.label}
                hint={flow.hint}
                checked={props.testFlow === flow.kind}
                onSelect={() => props.onTestFlow(flow.kind)}
              />
            ))}
          </>
        )
      case 'look':
        return (
          <>
            <DevItem icon={SlidersHorizontal} label="Card style" hint="Card background, layout and category colours" checked={props.cardStyleOpen} onSelect={props.onCardStyle} />
            <DevItem icon={Palette} label="Canvas background" hint="Background colours and dots" checked={props.canvasLookOpen} onSelect={props.onCanvasLook} />
            <DevItem
              icon={PaintBrush}
              label="Node appearance"
              hint={props.canStyleNode ? 'Style the selected node' : 'Select a node first'}
              checked={props.nodeStyleOpen}
              disabled={!props.canStyleNode}
              onSelect={props.onNodeStyle}
            />
            <DevItem
              icon={props.shaderPaused ? Play : Pause}
              label={props.shaderPaused ? 'Resume background animation' : 'Pause background animation'}
              onSelect={props.onShaderPaused}
            />
          </>
        )
      case 'toolbar':
        return (
          <>
            <DevItem
              icon={Columns}
              label="Split toolbars"
              hint="Insert, nodes and canvas controls apart"
              checked={props.toolbarStyle === 'split'}
              onSelect={() => props.onToolbarStyle('split')}
            />
            <DevItem
              icon={Rectangle}
              label="Single toolbar"
              hint="Everything in one bar in the centre"
              checked={props.toolbarStyle === 'single'}
              onSelect={() => props.onToolbarStyle('single')}
            />
          </>
        )
    }
  }

  return (
    <div className={styles.styleMenu} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.publishButton} ${styles.topButton}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Code size={16} weight="regular" aria-hidden />
        Dev
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div
          className={`${controls.menu} ${styles.styleMenuList}`}
          role="menu"
          aria-label="Development tools"
          data-native-scroll
          onScroll={() => setSection(null)}
        >
          {sectionItem('simulate', Lightning, props.canSimulate ? 'Passing or failing, from Test Agent' : 'Needs a trigger to start from')}
          {sectionItem('workflow', FlowArrow, activeFlow ? `Showing the ${activeFlow.label.toLowerCase()}` : 'Showing all nodes')}
          {sectionItem('look', Swatches, 'Cards, canvas, and node styles')}
          {sectionItem('toolbar', Toolbox, props.toolbarStyle === 'split' ? 'Split toolbars' : 'Single toolbar')}
        </div>
      ) : null}
      {open && section ? (
        <div
          className={`${controls.menu} ${styles.subMenu}`}
          style={{ left: section.at.x, top: section.at.y }}
          role="menu"
          aria-label={DEV_SECTIONS[section.id]}
          data-native-scroll
          onClick={(event) => {
            if ((event.target as Element).closest('button')) close()
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setSection(null)
          }}
        >
          {sectionItems(section.id)}
        </div>
      ) : null}
    </div>
  )
}

/** A run action split from a menu of the triggers it can start from. */
function RunAgentButton({
  label,
  icon: RunIcon,
  variant,
  tooltip,
  triggers,
  trigger,
  onTrigger,
  onRun,
}: {
  label: string
  icon: Icon
  variant: 'primary' | 'secondary'
  tooltip: (triggerTitle: string) => string
  triggers: readonly TriggerOption[]
  trigger: TriggerOption | undefined
  onTrigger: (triggerId: string) => void
  onRun: (triggerId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const choosable = triggers.length > 1
  const buttonClass = `${variant === 'primary' ? 'pg-btn pg-btn--primary' : styles.publishButton} ${styles.topButton}`

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    // Capture phase: canvas nodes stop pointerdown propagation while dragging.
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className={styles.runAgent} ref={wrapRef}>
      <div className={choosable ? styles.split : undefined} data-variant={variant}>
        <button
          type="button"
          className={buttonClass}
          data-tooltip={trigger ? tooltip(trigger.title) : undefined}
          disabled={!trigger}
          onClick={() => trigger && onRun(trigger.id)}
        >
          <RunIcon size={16} weight={variant === 'primary' ? 'fill' : 'regular'} aria-hidden />
          {label}
        </button>
        {choosable ? (
          <button
            type="button"
            className={buttonClass}
            aria-label={`Choose the trigger to ${label.toLowerCase()} from`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <CaretDown size={16} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>
      {choosable && menuOpen ? (
        <div className={`${controls.menu} ${styles.triggerMenu}`} role="menu" aria-label="Start from trigger">
          {triggers.map((node) => {
            const NodeIcon = node.icon
            const selected = node.id === trigger?.id
            return (
              <button
                key={node.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${controls.menuItem} ${styles.styleOption}${selected ? ` ${controls.menuItemActive}` : ''}`}
                onClick={() => {
                  onTrigger(node.id)
                  setMenuOpen(false)
                }}
              >
                <NodeIcon size={18} weight="regular" aria-hidden />
                <span className={styles.styleOptionText}>
                  {node.title}
                  {node.typeTitle ? <span className={styles.styleOptionHint}>{node.typeTitle}</span> : null}
                </span>
                {selected ? <Check size={16} weight="bold" className={styles.triggerCheck} aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
