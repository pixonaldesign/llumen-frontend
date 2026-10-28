import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  CaretDown,
  ChatCircle,
  Check,
  CheckCircle,
  Code,
  FlowArrow,
  FrameCorners,
  type Icon,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NoteBlank,
  Pause,
  Play,
  Palette,
  Scan,
  SlidersHorizontal,
  Stop,
  TextT,
  TreeStructure,
  XCircle,
} from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import { llumenAssets } from '../llumen-assistant/assets'
import { HubChatbox } from '../llumen-assistant/landing/HubChatbox'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { useCoverPage } from '../llumen-assistant/pageCover'
import { autoLayout, type MeasuredNode } from './autoLayout'
import { NodeCard } from './NodeCard'
import { NodeCardMinimal } from './NodeCardMinimal'
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
  rectFromPoints,
  SECTION_DEFAULT_SIZE,
  SECTION_DEFAULTS,
  SECTION_FIT_PADDING,
  SECTION_MIN_SIZE,
  TEXT_DEFAULT_SIZE,
  type CanvasComment,
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
import { annotateTestFlow, buildTestWorkflow } from './testWorkflow'
import { NodeToolbar } from './NodeToolbar'
import { NodeActionsBar } from './NodeActionsBar'
import { StickyNoteCard } from './StickyNoteCard'
import { StickyToolbar } from './StickyToolbar'
import { STICKY_MIN_SIZE, stickyStyle, type StickyStyle } from './stickyNote'
import { cardDetails, defaultTriggerId, executableTriggers, type FlowState } from './triggerCard'
import { nodeDataSides, nodeDataViews } from './cardSections'
import { NodeConfigWindow, type NeighbourNode, type UpstreamNode } from './NodeConfigWindow'
import { NodeDataDialog, type DataGroup } from './NodeDataDialog'
import { SHORTCUTS } from './shortcuts'
import {
  DEFAULT_CANVAS_LOOK,
  cardBlur,
  cardsAreLight,
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
import type { InputSource, NodeCardProps, PortHandlers, ResizeEdge, RunScope } from './nodeParts'
import { useDismiss } from './useDismiss'
import { NodeLibrarySheet } from './NodeLibrarySheet'
import { buildShowcase, layoutShowcase, type CanvasGroupLabel } from './showcase'
import { nodeAliases, planRun, runRows } from './nodeRuntime'
import { addBranch, kindInputLayers, kindWiringIssue, removeBranch, type AnyParams, type WiredStep } from './nodeKinds'
import {
  createNode,
  isAnnotation,
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
import { CARD_GLOWS, cardLayout, categoryVars, readCardGlow, saveCardGlow, type CardGlow, type CardGlowConfig } from './cardGlow'
import { CardStylePanel } from './CardStylePanel'
import { RayShader, SmokeShader } from './CanvasShader'
import styles from './AgentCanvas.module.css'

const GRID_SIZE = 20
/** Double-clicks on these stay with the card instead of opening its configuration. */
const CARD_INTERACTIVE =
  'button, input, textarea, select, a, [contenteditable="true"], [role="tab"], [role="tablist"], [role="tabpanel"], [data-node-interactive]'

/** Each card style is its own layout; the canvas background is set separately. */
const MINIMAL_CARDS: Record<CardGlow, ComponentType<NodeCardProps>> = { classic: NodeCardMinimal, sections: NodeCardSections, panel: NodeCardSections, gradient: NodeCardSections, iconHeader: NodeCardSections }

type NodeStyle = 'detailed' | 'minimal'
const NODE_STYLES: readonly { id: NodeStyle; label: string; description: string }[] = [
  { id: 'detailed', label: 'Detailed', description: 'Header, content, and run footer' },
  { id: 'minimal', label: 'Minimal', description: 'Content first, details on hover' },
]
/** Versioned so saves made before the defaults last changed don't override them. */
const NODE_STYLE_KEY = 'llumen.nodeStyle.v2'
/** Each style's built-in padding and corner radius (px), shown by the appearance sliders. */
const DETAILED_FRAME_DEFAULTS = { padding: 16, radius: 20 }
const MINIMAL_FRAME_DEFAULTS = { padding: 16, radius: 20 }

function readNodeStyle(): NodeStyle {
  try {
    return localStorage.getItem(NODE_STYLE_KEY) === 'detailed' ? 'detailed' : 'minimal'
  } catch {
    return 'minimal'
  }
}

/** Shows the card style menu, canvas background settings, and per-node appearance button. */
const DEV_TOOLS_KEY = 'llumen.devTools'

function readDevTools() {
  try {
    return localStorage.getItem(DEV_TOOLS_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Freezes the background shaders and ambient layer on their current frame. */
const SHADER_PAUSED_KEY = 'llumen.shaderPaused'

function readShaderPaused() {
  try {
    return localStorage.getItem(SHADER_PAUSED_KEY) === 'on'
  } catch {
    return false
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
type TriggerOption = { id: string; title: string; icon: Icon }
type ItemKind = 'section' | 'text' | 'comment'
type Selection = { kind: 'node' | 'edge' | ItemKind; id: string } | null
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
}
/** Where everything inside a section started, so a section drag can carry it along. */
type SectionMembers = {
  nodes: Positions
  sections: Positions
  texts: Positions
  comments: Positions
}
/** An edge being drawn from a port; `target` is the port it would snap to on release. */
type Connection = { from: PortRef; pointer: Point; target: PortRef | null }

const SHOWCASE = buildShowcase()
const DEFAULT_NODE_SIZE: Size = { w: NODE_DEFAULT_WIDTH, h: 120 }
/** Each node added from the library lands a little below and right of the previous one. */
const ADD_CASCADE = 24
const DUPLICATE_OFFSET = 40
const IDLE: NodeRun = { status: 'idle' }

/** Which document the canvas shows: every node type, or a large connected flow for testing runs. */
type CanvasMode = 'showcase' | 'testFlow'
/** Everything a mode keeps while the other one is on screen. */
type ModeSnapshot = { doc: CanvasDoc; past: CanvasDoc[]; future: CanvasDoc[]; runs: Record<string, NodeRun> }

function testFlowDoc(): CanvasDoc {
  const { nodes: built, edges } = buildTestWorkflow()
  const nodes = withSavedAppearances(built)
  // Rough positions from default card sizes, centred on the origin; the canvas tidies again once the cards are measured.
  const origin = Object.fromEntries(nodes.map((node) => [node.id, { x: 0, y: 0 }]))
  const { positions, groups } = autoLayout(nodes, edges, {}, origin)
  return withTestAnnotations({ nodes, positions, edges, groups, sections: [], texts: [], comments: [] }, {})
}

/** Frames the laid-out test flow with its sections, texts, and comments, and seats its sticky notes beside the flow. */
function withTestAnnotations(doc: CanvasDoc, layouts: Record<string, Size>): CanvasDoc {
  const { notes, sections, texts, comments } = annotateTestFlow(doc.positions, (id) => layouts[id] ?? DEFAULT_NODE_SIZE)
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
/** How long the toolbar stays after the pointer leaves its node, so it can cross the gap to the bar. */
const NODE_TOOLBAR_LEAVE_MS = 250
/** At or below this zoom, as the zoom readout rounds it, the ports hide; they still show while connecting. */
const PORTS_MIN_ZOOM = 0.3
/** Screen pixels around a node within which its ports show. */
const PORT_REACH = 20
/** World gap between an edge's end and its port dot. */
const EDGE_PORT_GAP = 4

type ToolOption = { id: CanvasTool; label: string; shortcut: string; icon: Icon }
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
  return ({ KeyT: 'text', KeyC: 'comment' } as Record<string, CanvasTool>)[event.code] ?? null
}

function withoutItem(doc: CanvasDoc, kind: ItemKind, id: string): CanvasDoc {
  const keep = (item: { id: string }) => item.id !== id
  if (kind === 'section') return { ...doc, sections: doc.sections.filter(keep) }
  if (kind === 'text') return { ...doc, texts: doc.texts.filter(keep) }
  return { ...doc, comments: doc.comments.filter(keep) }
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

/** Read by node cards: the card surface under `[data-card-surface]`, and the ports everywhere. */
function cardStyle({ cards, ports, ambient, result }: CanvasLook): CSSProperties {
  const blur = cardBlur(cards, ambient)
  const top = tintCss(cards.top)
  return {
    '--card-top': top,
    '--card-bottom': cards.fill === 'gradient' ? tintCss(cards.bottom) : top,
    '--card-line': tintCss(cards.border),
    '--card-backdrop': blur > 0 ? `blur(${blur}px)` : 'none',
    '--canvas-port-size': `${ports.size}px`,
    '--port-fill': tintCss(ports.fill),
    '--port-line': tintCss(ports.border),
    '--port-line-width': `${ports.borderWidth}px`,
    '--run-fail-rgb': hexToRgb(result.fail.color),
  } as CSSProperties
}

/** Read by minimal cards: the style's padding and corner radius, and under `[data-section-surface]` the surface of the styles that tint the card themselves. */
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

function bezierMidpoint(a: Point, c1: Point, c2: Point, b: Point): Point {
  return {
    x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
    y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
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
  const [runs, setRuns] = useState<Record<string, NodeRun>>(SHOWCASE.runs)
  const runTimersRef = useRef<number[]>([])
  const [activeRuns, setActiveRuns] = useState(0)
  /**
   * The last flow run's outcome while its glow shows; `id` restarts the glow for back-to-back results.
   * After a real run (`fromRun`), the canvas keeps its run look until the glow ends.
   */
  const [runResult, setRunResult] = useState<{ outcome: RunOutcome; id: number; fromRun: boolean } | null>(null)
  const didInitialLayoutRef = useRef(false)
  const addedCountRef = useRef(0)
  const [panning, setPanning] = useState(false)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('builder')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [nodeStyle, setNodeStyle] = useState<NodeStyle>(readNodeStyle)
  const [devTools, setDevTools] = useState(readDevTools)
  /** Schedules, webhooks, and chat only start the published Flow; their cards show what publishing assigns. */
  const [published, setPublished] = useState(false)
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
  const toggleDevTools = () => {
    const next = !devTools
    setDevTools(next)
    if (!next) {
      setCardStyleOpen(false)
      setCanvasLookOpen(false)
      setAppearanceFor(null)
      setRunPreview(false)
    }
    try {
      localStorage.setItem(DEV_TOOLS_KEY, next ? 'on' : 'off')
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
  }
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
  const [mode, setMode] = useState<CanvasMode>('showcase')
  /** The mode that's off screen; null until the test flow is first opened. */
  const parkedModeRef = useRef<ModeSnapshot | null>(null)
  /** After a mode switch, what to do once the new cards are measured. */
  const pendingLayoutRef = useRef<'arrange' | 'fit' | null>(null)
  /** History depth after the last live-edit push, so a run of slider or colour edits is one undo step. */
  const liveEditRef = useRef<{ key: string; depth: number } | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [tool, setTool] = useState<CanvasTool>('select')
  /** A tool press on the surface; the item is placed on release. */
  const placeRef = useRef<{ pointerId: number } | null>(null)
  const sectionDrawRef = useRef<{ pointerId: number; start: Point } | null>(null)
  const [sectionDraft, setSectionDraft] = useState<Rect | null>(null)
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
    origin: Point
    snapshot: CanvasDoc
    moved: boolean
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

  useEffect(() => {
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

  /** Adds a node centred on `at` (world coordinates), or cascaded around the middle of the view. */
  const addNode = (typeId: string, at?: Point, config?: NodeConfig) => {
    const root = rootRef.current
    const type = NODE_TYPES_BY_ID[typeId]
    if (!root || !type) return
    if (type.singleton && doc.nodes.some((node) => node.type === typeId)) return
    let center = at
    if (!center) {
      const offset = (addedCountRef.current % 8) * ADD_CASCADE
      addedCountRef.current += 1
      const middle = toWorld(root.clientWidth / 2, root.clientHeight / 2)
      center = { x: middle.x + offset, y: middle.y + offset }
    }
    const id = createId(typeId)
    const width = type.width ?? DEFAULT_NODE_SIZE.w
    const position = { x: center.x - width / 2, y: center.y - DEFAULT_NODE_SIZE.h / 2 }
    commit({ ...doc, nodes: [...doc.nodes, createNode(type, id, config)], positions: { ...doc.positions, [id]: position } })
    setSelection({ kind: 'node', id })
  }

  const deleteNode = useCallback(
    (id: string) => {
      if (!doc.nodes.some((node) => node.id === id)) return
      const positions = { ...doc.positions }
      delete positions[id]
      commit({
        ...doc,
        nodes: doc.nodes.filter((node) => node.id !== id),
        positions,
        edges: doc.edges.filter((edge) => edge.from !== id && edge.to !== id),
        comments: doc.comments.map((comment) =>
          comment.nodeId === id ? placeComment(comment, commentPoint(comment, doc.positions), undefined, doc.positions) : comment,
        ),
      })
      setSelection(null)
    },
    [commit, doc],
  )

  const deleteSelection = useCallback(() => {
    if (!selection) return
    if (selection.kind === 'node') {
      deleteNode(selection.id)
      return
    }
    if (selection.kind !== 'edge') {
      commit(withoutItem(doc, selection.kind, selection.id))
      setSelection(null)
      return
    }
    if (!doc.edges.some((edge) => edge.id === selection.id)) return
    commit({ ...doc, edges: doc.edges.filter((edge) => edge.id !== selection.id) })
    setSelection(null)
  }, [commit, deleteNode, doc, selection])

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

  const toggleNodeDetails = (id: string) =>
    commit({
      ...doc,
      nodes: doc.nodes.map((node) => (node.id === id ? { ...node, config: { ...node.config, hideDetails: node.config.hideDetails ? undefined : true } } : node)),
    })

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

  const openConfig = (id: string, focus?: string) => {
    setConfiguringId(id)
    setConfigFocus(focus)
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDoc(target)
      return
    }
    const from = doc.positions
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / ARRANGE_ANIMATION_MS)
      const eased = 1 - (1 - progress) ** 3
      const frame: Positions = {}
      for (const [id, end] of Object.entries(target.positions)) {
        const begin = from[id] ?? end
        frame[id] = { x: begin.x + (end.x - begin.x) * eased, y: begin.y + (end.y - begin.y) * eased }
      }
      setDoc(progress < 1 ? { ...target, positions: frame } : target)
      arrangeFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null
    }
    arrangeFrameRef.current = requestAnimationFrame(step)
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
  const runNodes = (startId: string, scope: RunScope, simulate?: RunOutcome) => {
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
    if (scope === 'downstream') {
      setRunResult(null)
      setRuns((runs) => ({ ...runs, ...Object.fromEntries(order.map((id) => [id, IDLE])) }))
    }
    const startsFlow = scope === 'downstream' && NODE_TYPES_BY_ID[current.nodes.find((node) => node.id === startId)?.type ?? '']?.category === 'triggers'
    const steps = planRun({
      nodes: current.nodes,
      edges: current.edges,
      order,
      previous: runs,
      fixtures,
      triggerId: startsFlow ? startId : undefined,
      stepTest: scope !== 'downstream',
      simulate,
      forcedFailure,
    })
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
      scheduleRun(elapsed, () => setRuns((current) => ({ ...current, [step.id]: step.run })))
      if (step.run.status === 'error') outcome = 'fail'
    }
    setActiveRuns((count) => count + 1)
    scheduleRun(elapsed, () => {
      setActiveRuns((count) => Math.max(0, count - 1))
      if (scope === 'downstream') setRunResult({ outcome, id: Date.now(), fromRun: true })
    })
  }

  /** Cancels every pending step; nodes caught mid-run go back to idle. */
  const stopRun = () => {
    for (const timer of runTimersRef.current.splice(0)) window.clearTimeout(timer)
    setActiveRuns(0)
    setRuns((current) =>
      Object.fromEntries(Object.entries(current).map(([id, run]) => [id, run.status === 'running' ? IDLE : run])),
    )
  }

  /** Swaps between the showcase and the test flow; each keeps its own document, history, and run results. */
  const toggleTestFlow = () => {
    stopRun()
    stopArrange()
    const parked = parkedModeRef.current
    parkedModeRef.current = {
      doc,
      past,
      future,
      runs: Object.fromEntries(Object.entries(runs).map(([id, run]) => [id, run.status === 'running' ? IDLE : run])),
    }
    const next: ModeSnapshot = parked ?? { doc: testFlowDoc(), past: [], future: [], runs: {} }
    pendingLayoutRef.current = parked ? 'fit' : 'arrange'
    docRef.current = next.doc
    setDoc(next.doc)
    setPast(next.past)
    setFuture(next.future)
    setRuns(next.runs)
    setSelection(null)
    setAppearanceFor(null)
    setMode((current) => (current === 'showcase' ? 'testFlow' : 'showcase'))
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
      setLayouts(next)
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
        if (pending === 'arrange') {
          const { positions, groups: labels } = autoLayout(current.nodes, current.edges, next, current.positions)
          laidOut = withTestAnnotations({ ...current, positions: { ...current.positions, ...positions }, groups: labels }, next)
          docRef.current = laidOut
          setDoc(laidOut)
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
    // Switching node or card style remounts every card, so the new elements need observing.
  }, [doc.nodes, nodeStyle, cardLook.style, animateTo])

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
      if (mod && event.key.toLowerCase() === 'z') {
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
  }, [configuringId, deleteSelection, fitToView, redo, tool, undo, zoomFromCenter])

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    stopAnimation()
    setSelection(null)
    setCommentDraft(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (event.button === 0 && tool === 'section') {
      const start = toWorld(event.clientX, event.clientY)
      sectionDrawRef.current = { pointerId: event.pointerId, start }
      setSectionDraft({ ...start, w: 0, h: 0 })
      return
    }
    if (event.button === 0 && tool !== 'select') {
      placeRef.current = { pointerId: event.pointerId }
      return
    }
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, view: viewRef.current }
    setPanning(true)
  }

  /** Flags nodes the pointer is close to so their ports show before it reaches the card; set on the DOM to skip a render per move. */
  const markNearNodes = (surface: HTMLElement, clientX: number, clientY: number) => {
    const point = toWorld(clientX, clientY)
    const reach = PORT_REACH / viewRef.current.zoom
    const near = new Set(
      doc.nodes
        .filter((node) => {
          const position = doc.positions[node.id]
          const size = layouts[node.id] ?? DEFAULT_NODE_SIZE
          if (!position) return false
          const dx = Math.max(position.x - point.x, 0, point.x - position.x - size.w)
          const dy = Math.max(position.y - point.y, 0, point.y - position.y - size.h)
          return Math.hypot(dx, dy) <= reach
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

  const onSurfacePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sectionDrawRef.current?.pointerId === event.pointerId) finishSection(event)
    else if (placeRef.current?.pointerId === event.pointerId) {
      placeRef.current = null
      placeItem(toWorld(event.clientX, event.clientY))
    } else endPan(event)
  }

  const onSurfacePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    sectionDrawRef.current = null
    placeRef.current = null
    setSectionDraft(null)
    endPan(event)
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

  const startGesture = (event: ReactPointerEvent<Element>, apply: Gesture['apply'], finish?: Gesture['finish']) => {
    stopArrange()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, snapshot: doc, moved: false, apply, finish }
  }

  const endGesture = (event: ReactPointerEvent<Element>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.moved) {
      if (gesture.finish) setDoc(gesture.finish)
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
    startGesture(event, (dx, dy) => setDoc((current) => moveMembers(current, members, dx, dy)))
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
    const comment = placeComment({ id, ...point, text, author: COMMENT_AUTHOR, createdAt: Date.now() }, point, nodeId, doc.positions)
    commit({ ...doc, comments: [...doc.comments, comment] })
    setCommentDraft(null)
    setSelection({ kind: 'comment', id })
  }

  const removeItem = (kind: ItemKind, id: string) => {
    commit(withoutItem(doc, kind, id))
    setSelection(null)
  }

  const onNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    // Placement tools work over nodes too, so let the press reach the surface.
    if (event.button !== 0 || tool !== 'select') return
    event.stopPropagation()
    setSelection({ kind: 'node', id })
    const target = event.target as Element
    if (appearanceNode && !target.closest('[data-appearance-toggle]')) setAppearanceFor(id)
    if (target.closest('button, input, textarea, select, a, [data-node-interactive], [data-native-scroll]')) return
    stopArrange()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      id,
      startX: event.clientX,
      startY: event.clientY,
      origin: doc.positions[id],
      snapshot: doc,
      moved: false,
    }
    setDraggingNode(id)
  }

  const onNodePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = (event.clientX - drag.startX) / view.zoom
    const dy = (event.clientY - drag.startY) / view.zoom
    if (!drag.moved && Math.hypot(dx, dy) < 2) return
    drag.moved = true
    setDoc((current) => ({
      ...current,
      positions: { ...current.positions, [drag.id]: { x: drag.origin.x + dx, y: drag.origin.y + dy } },
    }))
  }

  const endNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      setPast((stack) => [...stack, drag.snapshot])
      setFuture([])
    }
    dragRef.current = null
    setDraggingNode(null)
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>, id: string, edge: ResizeEdge) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const layout = layouts[id]
    const position = doc.positions[id]
    const element = event.currentTarget.closest<HTMLElement>('[data-node-id]')
    if (!layout || !position || !element) return
    const frameMinHeight = element.style.minHeight
    element.style.minHeight = '0px'
    const contentHeight = element.offsetHeight
    element.style.minHeight = frameMinHeight
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

  /** The opposite-side port under the pointer, or the first matching port of the node under it. */
  const connectionTarget = (clientX: number, clientY: number, from: PortRef): PortRef | null => {
    const hit = document.elementFromPoint(clientX, clientY)
    const portElement = hit?.closest<HTMLElement>('[data-port-side]')
    let target: PortRef | null = null
    if (portElement) {
      const { portNode, portId, portSide } = portElement.dataset
      if (portNode && portId && (portSide === 'in' || portSide === 'out')) target = { nodeId: portNode, portId, side: portSide }
    } else {
      const nodeId = hit?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
      const node = nodeId ? nodesById[nodeId] : undefined
      if (node) {
        const side: PortSide = from.side === 'out' ? 'in' : 'out'
        const port = (side === 'in' ? nodeType(node).inputs : nodeOutputs(node, nodeType(node)))[0]
        if (port) target = { nodeId: node.id, portId: port.id, side }
      }
    }
    if (!target || target.side === from.side || target.nodeId === from.nodeId) return null
    return target
  }

  const onPortPointerDown = (event: ReactPointerEvent<HTMLSpanElement>, port: PortRef) => {
    if (event.button !== 0) return
    event.stopPropagation()
    stopAnimation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setConnection({ from: port, pointer: toWorld(event.clientX, event.clientY), target: null })
  }

  const onPortPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!connection) return
    setConnection({
      ...connection,
      pointer: toWorld(event.clientX, event.clientY),
      target: connectionTarget(event.clientX, event.clientY, connection.from),
    })
  }

  const onPortPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!connection) return
    const target = connectionTarget(event.clientX, event.clientY, connection.from)
    setConnection(null)
    if (!target) return
    const [out, input] = connection.from.side === 'out' ? [connection.from, target] : [target, connection.from]
    const exists = doc.edges.some(
      (edge) => edge.from === out.nodeId && edge.fromPort === out.portId && edge.to === input.nodeId && edge.toPort === input.portId,
    )
    if (exists) return
    const id = createId('edge')
    commit({ ...doc, edges: [...doc.edges, { id, from: out.nodeId, fromPort: out.portId, to: input.nodeId, toPort: input.portId }] })
  }

  const portHandlers: PortHandlers = {
    onPointerDown: onPortPointerDown,
    onPointerMove: onPortPointerMove,
    onPointerUp: onPortPointerUp,
    onPointerCancel: () => setConnection(null),
  }

  const onEdgePointerDown = (event: ReactPointerEvent<SVGPathElement>, id: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelection({ kind: 'edge', id })
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
    addNode(typeId, toWorld(event.clientX, event.clientY))
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
    return [{ ...edge, a, b, d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`, mid: bezierMidpoint(a, c1, c2, b) }]
  })
  const draftEdge = (() => {
    if (!connection) return null
    const start = portWorldPoint(connection.from)
    const target = connection.target && portWorldPoint(connection.target)
    if (!start) return null
    const [a, b] =
      connection.from.side === 'out'
        ? [outEnd(start), target ? inEnd(target) : connection.pointer]
        : [target ? outEnd(target) : connection.pointer, inEnd(start)]
    const [c1, c2] = edgeControls(a, b)
    return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
  })()
  const activePorts = new Set(
    connection ? [portKey(connection.from), ...(connection.target ? [portKey(connection.target)] : [])] : [],
  )
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
  const wiringIssue = (node: CanvasNode) =>
    kindWiringIssue(node.type, node.config.params, () => ({
      wired: doc.edges
        .filter((edge) => edge.to === node.id)
        .flatMap((edge) => wiredStep(edge.from))
        .filter((step) => NODE_TYPES_BY_ID[step.typeId]?.category !== 'triggers'),
      upstream: ancestorsNearestFirst(node.id, doc.edges).flatMap(wiredStep),
    }))
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
    const type = nodeType(node)
    const layers = kindInputLayers(node.type, node.config.params, ancestorsNearestFirst(node.id, doc.edges).flatMap(wiredStep))
    const portLabel = (edge: WorkflowEdge) =>
      type.inputs.length > 1 ? (type.inputs.find((port) => port.id === edge.toPort)?.label ?? edge.toPort) : undefined
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
  const inputSources = (id: string, type: NodeType): Record<string, InputSource> | undefined => {
    if (type.inputs.length < 2) return undefined
    return Object.fromEntries(
      type.inputs.flatMap((port) => {
        const edges = doc.edges.filter((edge) => edge.to === id && edge.toPort === port.id)
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
        focus={configFocus}
        onNavigate={(nodeId) => openConfig(nodeId)}
        onClose={closeConfig}
      />
    )
  })()
  /** Style 5: no card header or footer; input and output open over the canvas instead. */
  const headlessCards = nodeStyle === 'minimal' && cardLook.style === 'iconHeader'
  const toggleDataDialog = (id: string) => setDataDialogId((open) => (open === id ? null : id))
  const usedTypes = new Set(doc.nodes.map((node) => node.type))
  /** Chat runs need a chat session, so Run agent offers the other triggers, default first. */
  const triggers: TriggerOption[] = executableTriggers(doc.nodes).map((node) => {
    const type = nodeType(node)
    return { id: node.id, title: nodeName(node, type), icon: type.icon }
  })
  const flowState: FlowState = { published, defaultTriggerId: defaultTriggerId(doc.nodes) }

  const running = activeRuns > 0
  /** The run look also plays while previewing it from the canvas background panel. */
  const runLook = running || Boolean(runResult?.fromRun) || (runPreview && canvasLookOpen)

  /** The surface that can turn card text dark; the panel styles keep light text for their black panels. */
  const inkSurface =
    nodeStyle !== 'minimal' || cardLook.style === 'classic' ? canvasLook.cards : cardLook.style === 'sections' ? cardLook.surface : null
  const rootClass = [
    styles.root,
    panning ? styles.panning : null,
    connection ? styles.connecting : null,
    tool !== 'select' ? styles.placing : null,
    tool === 'comment' ? styles.commenting : null,
    runLook ? styles.runLook : null,
  ]
    .filter(Boolean)
    .join(' ')

  const toScreen = (point: Point) => ({ left: view.x + point.x * view.zoom, top: view.y + point.y * view.zoom })
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
    selection?.kind === 'node' && draggingNode !== selection.id && !connection ? nodesById[selection.id] : undefined
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
      />
    ) : null
  const selectedFrame = nodeFrame(selectedNode)
  const selectedNodeBar = selectedFrame && {
    left: selectedFrame.left,
    top: Math.max(CHROME_TOP + NODE_TOOLBAR_HEIGHT, selectedFrame.top - NODE_TOOLBAR_GAP),
  }
  /** Sticky notes keep their toolbar on selection; every other node shows its actions on hover. */
  const hoverTarget = hoveredNodeId && draggingNode !== hoveredNodeId && !connection ? nodesById[hoveredNodeId] : undefined
  const hoveredNode = hoverTarget && !isAnnotation(nodeType(hoverTarget)) ? hoverTarget : undefined
  const hoveredFrame = nodeFrame(hoveredNode)
  /** Above the node, or below it when the header leaves no room; never over the card. */
  const hoveredNodeBar =
    hoveredFrame &&
    (hoveredFrame.top - NODE_TOOLBAR_GAP - NODE_TOOLBAR_HEIGHT >= CHROME_TOP
      ? { left: hoveredFrame.left, top: hoveredFrame.top - NODE_TOOLBAR_GAP, below: false }
      : { left: hoveredFrame.left, top: hoveredFrame.bottom + NODE_TOOLBAR_GAP, below: true })
  const hoveredDetails = hoveredNode && cardDetails(hoveredNode, nodeType(hoveredNode).category === 'triggers', flowState)
  const hoveredHasDetails = Boolean(hoveredDetails && (hoveredDetails.fields.length || hoveredDetails.text))

  return (
    <div
      className={rootClass}
      ref={rootRef}
      role="application"
      aria-label={`${name} workflow canvas`}
      data-connecting={connection?.from.side}
      data-ports-hidden={!connection && Math.round(view.zoom * 100) <= PORTS_MIN_ZOOM * 100 ? '' : undefined}
      data-card-surface={canvasLook.cards.fill === 'default' ? undefined : canvasLook.cards.fill}
      data-section-surface={cardLook.surface.fill === 'default' ? undefined : cardLook.surface.fill}
      data-card-ink={inkSurface && cardsAreLight(inkSurface) ? 'dark' : undefined}
      data-card-glow={cardLook.style}
      data-card-icon={cardLook.iconContainer === 'tile' ? undefined : cardLook.iconContainer}
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
                className={selection?.kind === 'edge' && selection.id === edge.id ? `${styles.edge} ${styles.edgeSelected}` : styles.edge}
              >
                <path className={styles.edgeLine} d={edge.d} stroke={`url(#edge-${edge.id})`} />
                <path className={styles.edgeHit} d={edge.d} onPointerDown={(event) => onEdgePointerDown(event, edge.id)} />
              </g>
            ))}
            {draftEdge ? <path className={styles.edgeDraft} d={draftEdge} /> : null}
          </svg>

          {edges.map((edge) =>
            edge.label ? (
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
                  selected={selection?.kind === 'node' && selection.id === node.id}
                  dragging={draggingNode === node.id}
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
            const Card = nodeStyle === 'minimal' ? MINIMAL_CARDS[cardLook.style] : NodeCard
            const nodeRun = runs[node.id] ?? IDLE
            const nodeInput = inputFor(node.id)
            const nodeOutput = runRows(runs[node.id])
            const hasInputs = type.inputs.length > 0
            const hasData =
              nodeDataSides(nodeDataViews(nodeRun, nodeInput, nodeOutput, type.category === 'triggers', hasInputs), hasInputs).length > 0
            return (
              <Card
                key={node.id}
                node={node}
                type={type}
                position={doc.positions[node.id]}
                selected={selection?.kind === 'node' && selection.id === node.id}
                dragging={draggingNode === node.id}
                run={nodeRun}
                input={nodeInput}
                inputSources={inputSources(node.id, type)}
                wiringIssue={wiringIssue(node)}
                output={nodeOutput}
                activePorts={activePorts}
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
                appearanceOpen={appearanceNode?.id === node.id}
                dataOpen={dataOpen.has(node.id)}
                onDataOpen={(open) => setNodeData(node.id, open)}
                onNoteChange={(note) => setNodeNote(node.id, note)}
                onParamsChange={(patch) => setNodeParams(node.id, patch, 'card')}
                onToggleDetails={() => toggleNodeDetails(node.id)}
                onOpenConfig={(focus) => openConfig(node.id, focus)}
                iconContainer={cardLook.iconContainer}
                valuesPanel={cardLook.valuesPanel}
                headless={headlessCards}
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
        </div>
      </div>

      <div className={itemStyles.commentLayer}>
        {doc.comments.map((comment) => (
          <CommentPin
            key={comment.id}
            author={comment.author}
            {...toScreen(commentPoint(comment, doc.positions))}
            open={openComment?.id === comment.id}
            gesture={gestureHandlers}
            onPointerDown={(event) => onCommentPointerDown(event, comment.id)}
          />
        ))}
        {openComment ? (
          <CommentThread
            comment={openComment}
            left={toScreen(commentPoint(openComment, doc.positions)).left + 44}
            top={toScreen(commentPoint(openComment, doc.positions)).top - 34}
            onResolve={() => removeItem('comment', openComment.id)}
            onDelete={() => removeItem('comment', openComment.id)}
          />
        ) : null}
        {commentDraft ? (
          <>
            <CommentPin author={COMMENT_AUTHOR} {...toScreen(commentDraft)} open />
            <CommentComposer
              left={toScreen(commentDraft).left + 44}
              top={toScreen(commentDraft).top - 34}
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
          detailsHidden={Boolean(hoveredNode.config.hideDetails)}
          onDetails={hoveredHasDetails && !headlessCards ? () => toggleNodeDetails(hoveredNode.id) : undefined}
          appearanceOpen={appearanceNode?.id === hoveredNode.id}
          onRun={(scope) => runNodes(hoveredNode.id, scope)}
          onConfigure={() => openConfig(hoveredNode.id)}
          onAppearance={devTools ? () => toggleAppearance(hoveredNode.id) : undefined}
          onDuplicate={() => duplicateNode(hoveredNode.id)}
          onDelete={() => deleteNode(hoveredNode.id)}
        />
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

      <div className={styles.headerScrim} aria-hidden />

      <header className={styles.header}>
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

      <div className={`${controls.segmented} ${styles.tabs}`} role="tablist" aria-label="Agent view">
        {(['builder', 'executions'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`${controls.segment}${tab === value ? ` ${controls.segmentActive}` : ''}`}
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

      <div className={styles.topRight}>
        {devTools ? (
          <>
            <CardGlowMenu
              value={cardLook.style}
              onChange={(style) => updateCardLook({ ...cardLook, style })}
              customizing={cardStyleOpen}
              onCustomize={() => {
                setCardStyleOpen((open) => !open)
                setCanvasLookOpen(false)
                setAppearanceFor(null)
              }}
            />
            <NodeStyleMenu
              canvasLookOpen={canvasLookOpen}
              onCanvasLook={() => {
                setCanvasLookOpen((open) => !open)
                setCardStyleOpen(false)
                setAppearanceFor(null)
              }}
              value={nodeStyle}
              onChange={(value) => {
                setNodeStyle(value)
                try {
                  localStorage.setItem(NODE_STYLE_KEY, value)
                } catch {
                  // Storage can be unavailable (private mode); the choice still applies for this session.
                }
              }}
            />
          </>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={devTools}
          className={`${styles.publishButton} ${styles.devToggle}`}
          data-tooltip={devTools ? 'Hide development tools' : 'Show development tools'}
          onClick={toggleDevTools}
        >
          <Code size={16} weight="regular" aria-hidden />
          Dev
          <span className={styles.devSwitch} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.shaderToggle}
          aria-pressed={shaderPaused}
          aria-label={shaderPaused ? 'Resume background animation' : 'Pause background animation'}
          data-tooltip={shaderPaused ? 'Resume background animation' : 'Pause background animation'}
          onClick={toggleShaderPaused}
        >
          {shaderPaused ? <Play size={16} weight="fill" aria-hidden /> : <Pause size={16} weight="fill" aria-hidden />}
        </button>
        <span className={styles.topDivider} aria-hidden />
        <button
          type="button"
          className={`${styles.publishButton} ${styles.testFlowButton}`}
          aria-pressed={mode === 'testFlow'}
          data-tooltip={mode === 'testFlow' ? 'Back to all nodes' : 'Load a test workflow'}
          onClick={toggleTestFlow}
        >
          <FlowArrow size={16} weight={mode === 'testFlow' ? 'fill' : 'regular'} aria-hidden />
          Test flow
        </button>
        <RunAgentButton triggers={triggers} onRun={(triggerId, simulate) => runNodes(triggerId, 'downstream', simulate)} />
        <button type="button" className={styles.publishButton} onClick={() => setPublished((current) => !current)}>
          {published ? 'Unpublish' : 'Publish'}
        </button>
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

      <footer className={styles.footer}>
        <div className={`${controls.bar} ${styles.footerBar} ${styles.contentBar}`} role="toolbar" aria-label="Add to canvas">
          {CONTENT_TOOLS.map((option) => {
            const ToolIcon = option.icon
            const active = tool === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`${controls.barButton}${active ? ` ${controls.barButtonActive}` : ''}`}
                aria-label={option.label}
                data-shortcut={option.shortcut}
                aria-pressed={active}
                onClick={() => setTool(active ? 'select' : option.id)}
              >
                <ToolIcon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
              </button>
            )
          })}
        </div>
        <div className={styles.toolbarGroup} ref={setToolbarGroup}>
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
          <NodeToolbar
            className={styles.footerBar}
            usedTypes={usedTypes}
            panelContainer={toolbarGroup}
            onAdd={(typeId) => addNode(typeId)}
          />
        </div>

        <div className={`${controls.bar} ${styles.footerBar} ${styles.controlsBar}`} role="toolbar" aria-label="Canvas controls">
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
            className={`${controls.barButton} ${styles.zoomLevel}`}
            aria-label={`Zoom ${Math.round(view.zoom * 100)}%, reset to 100%`}
            data-tooltip="Reset to 100%"
            onClick={() => zoomFromCenter(1 / view.zoom)}
          >
            {Math.round(view.zoom * 100)}%
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
          <span className={controls.barDivider} aria-hidden />
          <button
            type="button"
            className={controls.barButton}
            aria-label="Tidy up"
            data-shortcut={SHORTCUTS.tidy}
            disabled={doc.nodes.length === 0}
            onClick={tidyUp}
          >
            <TreeStructure size={20} weight="regular" aria-hidden />
          </button>
        </div>
      </footer>

      {appearanceNode ? (
        <AppearancePanel
          key={`appearance-${appearanceNode.id}`}
          nodeName={nodeName(appearanceNode, nodeType(appearanceNode))}
          appearance={appearanceNode.appearance}
          defaults={nodeStyle === 'minimal' ? MINIMAL_FRAME_DEFAULTS : DETAILED_FRAME_DEFAULTS}
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

type CardGlowMenuProps = {
  value: CardGlow
  onChange: (value: CardGlow) => void
  customizing: boolean
  onCustomize: () => void
}

function CardGlowMenu({ value, onChange, customizing, onCustomize }: CardGlowMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrapRef, close)
  const current = CARD_GLOWS.find((option) => option.id === value) ?? CARD_GLOWS[0]

  return (
    <div className={styles.styleMenu} ref={wrapRef}>
      {open ? (
        <div className={`${controls.menu} ${styles.styleMenuList}`} role="menu" aria-label="Card style">
          <p className={styles.styleMenuTitle}>Card style</p>
          {CARD_GLOWS.map((option) => {
            const selected = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${controls.menuItem}${selected ? ` ${controls.menuItemActive}` : ''} ${styles.styleOption}`}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                <span className={styles.styleOptionText}>
                  {option.label}
                  <span className={styles.styleOptionHint}>{option.description}</span>
                </span>
                {selected ? <Check size={16} weight="bold" className={styles.triggerCheck} aria-hidden /> : null}
              </button>
            )
          })}
          <span className={styles.styleMenuDivider} role="separator" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={customizing}
            className={`${controls.menuItem} ${styles.styleOption}`}
            onClick={() => {
              onCustomize()
              setOpen(false)
            }}
          >
            <SlidersHorizontal size={18} weight="regular" aria-hidden />
            <span className={styles.styleOptionText}>
              Customise styles
              <span className={styles.styleOptionHint}>Icon, values panel, card background and category colours</span>
            </span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={`${styles.publishButton} ${styles.glowMenuButton}`}
        aria-label={`Card style: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {current.label}
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

type NodeStyleMenuProps = {
  value: NodeStyle
  onChange: (value: NodeStyle) => void
  canvasLookOpen: boolean
  onCanvasLook: () => void
}

function NodeStyleMenu({ value, onChange, canvasLookOpen, onCanvasLook }: NodeStyleMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrapRef, close)

  return (
    <div className={styles.styleMenu} ref={wrapRef}>
      {open ? (
        <div className={`${controls.menu} ${styles.styleMenuList}`} role="menu" aria-label="Canvas settings">
          <p className={styles.styleMenuTitle}>Node style</p>
          {NODE_STYLES.map((option) => {
            const selected = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${controls.menuItem}${selected ? ` ${controls.menuItemActive}` : ''} ${styles.styleOption}`}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                <span className={styles.styleOptionText}>
                  {option.label}
                  <span className={styles.styleOptionHint}>{option.description}</span>
                </span>
                {selected ? <Check size={16} weight="bold" className={styles.triggerCheck} aria-hidden /> : null}
              </button>
            )
          })}
          <span className={styles.styleMenuDivider} role="separator" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={canvasLookOpen}
            className={`${controls.menuItem} ${styles.styleOption}`}
            onClick={() => {
              onCanvasLook()
              setOpen(false)
            }}
          >
            <Palette size={18} weight="regular" aria-hidden />
            <span className={styles.styleOptionText}>
              Canvas background
              <span className={styles.styleOptionHint}>Background colours and dots</span>
            </span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={styles.styleMenuButton}
        aria-label="Canvas settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={20} weight="regular" aria-hidden />
      </button>
    </div>
  )
}

function RunAgentButton({
  triggers,
  onRun,
}: {
  triggers: readonly TriggerOption[]
  onRun: (triggerId: string, simulate?: RunOutcome) => void
}) {
  const [triggerId, setTriggerId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const trigger = triggers.find((option) => option.id === triggerId) ?? triggers[0]

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
      <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
        <div className="btn-split">
          <button
            type="button"
            className="btn btn--primary"
            data-tooltip={trigger ? `Run from ${trigger.title}` : undefined}
            disabled={!trigger}
            onClick={() => trigger && onRun(trigger.id)}
          >
            <Play size={16} weight="fill" aria-hidden />
            Run agent
          </button>
          <button
            type="button"
            className="btn btn--primary"
            aria-label="Choose trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <CaretDown size={16} weight="bold" aria-hidden />
          </button>
        </div>
      </div>
      {menuOpen ? (
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
                className={`${controls.menuItem}${selected ? ` ${controls.menuItemActive}` : ''}`}
                onClick={() => {
                  setTriggerId(node.id)
                  setMenuOpen(false)
                }}
              >
                <NodeIcon size={18} weight="regular" aria-hidden />
                {node.title}
                {selected ? <Check size={16} weight="bold" className={styles.triggerCheck} aria-hidden /> : null}
              </button>
            )
          })}
          <div className={styles.menuSeparator} role="separator" />
          <div className={styles.menuLabel}>Simulate a run</div>
          {(
            [
              { outcome: 'pass', label: 'Passing run', icon: CheckCircle },
              { outcome: 'fail', label: 'Failing run', icon: XCircle },
            ] as const
          ).map(({ outcome, label, icon: OutcomeIcon }) => (
            <button
              key={outcome}
              type="button"
              role="menuitem"
              className={controls.menuItem}
              disabled={!trigger}
              onClick={() => {
                setMenuOpen(false)
                if (trigger) onRun(trigger.id, outcome)
              }}
            >
              <OutcomeIcon size={18} weight="regular" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
