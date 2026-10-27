import {
  ArrowsMerge,
  ChatCircle,
  CirclesThree,
  Clock,
  Cpu,
  CubeFocus,
  CursorClick,
  Database,
  Detective,
  Empty,
  Envelope,
  FileText,
  Funnel,
  GitBranch,
  Graph,
  Lightbulb,
  Note,
  PaperPlaneTilt,
  PencilSimple,
  PlugsConnected,
  Robot,
  SquaresFour,
  StarFour,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import {
  KIND_DEFAULTS,
  kindFields,
  kindIssue,
  kindNotice,
  kindOutputs,
  kindPreview,
  kindText,
  type AnyParams,
  type KindId,
} from './nodeKinds'
import type { NodeAppearance } from './nodeAppearance'
import { STICKY_SIZE, type StickyStyle } from './stickyNote'

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }

export type NodeCategoryId = 'triggers' | 'dataFlow' | 'analysisAgents' | 'outputAgents' | 'actions' | 'annotations'

/** Accent family, shared by the canvas card and the node library icon. */
export type NodeTone = 'trigger' | 'data' | 'create' | 'analysis' | 'output' | 'action' | 'note'

export type PortTone = 'neutral' | 'positive' | 'negative'

export type NodePort = {
  id: string
  label?: string
  tone?: PortTone
}

export type PortSide = 'in' | 'out'
export type PortRef = { nodeId: string; portId: string; side: PortSide }

export const portKey = (port: PortRef) => `${port.nodeId}:${port.side}:${port.portId}`

export type NodeCategory = {
  id: NodeCategoryId
  title: string
  description: string
}

/** A piece of a field's value, styled by role, e.g. a condition's column, operator and compared value. */
export type FieldPart = { text: string; role: 'field' | 'operator' | 'value' | 'join' }

export type NodeField = {
  label: string
  value: string
  /** The value broken into styled pieces; joined with spaces they read as `value`. */
  parts?: readonly FieldPart[]
  /** A placeholder rather than a value, e.g. what publishing fills in. */
  muted?: boolean
  /** Text a copy button next to the value puts on the clipboard. */
  copy?: string
  /** Leads the value with a green dot, e.g. a chat that is taking messages. */
  live?: boolean
}

/** What an Asset node renders in its content area. */
export type AssetPreview = 'chart' | 'map'

/** Per-instance settings. */
export type NodeConfig = {
  /** Header name; defaults to the type title. */
  name?: string
  /** The kind's own configuration; see `nodeKinds.ts`. Missing keys take the kind's defaults. */
  params?: Partial<AnyParams>
  /** Sticky note text. */
  note?: string
  /** Sticky note look; missing keys take `DEFAULT_STICKY`. */
  sticky?: Partial<StickyStyle>
  /** Hides the card's value rows and text; toggled from the node toolbar. */
  hideDetails?: boolean
}

/** What happens after a node fails, once its retries are spent. */
export type OnErrorMode = 'stop' | 'continue' | 'errorOutput'

/** The configuration window's Settings tab; shared by every node kind. */
export type NodeSettings = {
  /** Seconds, 1–86,400; unset means no per-step timeout. */
  timeoutSeconds?: number
  onError: OnErrorMode
  alwaysOutputData: boolean
  retryOnFail: boolean
  /** Total attempts, counting the first. */
  retryMaxAttempts: number
  retryDelaySeconds: number
}

export const DEFAULT_NODE_SETTINGS: NodeSettings = {
  onError: 'stop',
  alwaysOutputData: false,
  retryOnFail: false,
  retryMaxAttempts: 3,
  retryDelaySeconds: 5,
}

export type NodeType = {
  id: KindId
  category: NodeCategoryId
  title: string
  description: string
  icon: Icon
  tone: NodeTone
  inputs: readonly NodePort[]
  outputs: readonly NodePort[]
  /** Branches can be added from the card; they live in the node's params. */
  extensibleOutputs?: boolean
  defaults?: NodeConfig
  /** Initial card width; the user can resize from there. */
  width?: number
  /** Only one instance may exist in a workflow. */
  singleton?: boolean
  /** Has side effects outside the workflow; Execute Node asks first. */
  sideEffect?: boolean
}

/** A node placed on the canvas. */
export type CanvasNode = {
  id: string
  type: string
  config: NodeConfig
  /** Overrides the type's outputs for kinds whose branches aren't in their params. */
  outputs?: readonly NodePort[]
  /** User-resized frame; `h` is a minimum, content can still grow the card. */
  frame?: Partial<Size>
  appearance?: NodeAppearance
  /** Only the settings changed from `DEFAULT_NODE_SETTINGS`. */
  settings?: Partial<NodeSettings>
}

export type WorkflowEdge = {
  id: string
  from: string
  fromPort: string
  to: string
  toPort: string
  label?: string
}

export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export type DataValue = string | number | boolean | null
export type DataRecord = Record<string, DataValue>

export type NodeRun = {
  status: RunStatus
  items?: number
  /** USD. */
  cost?: number
  durationMs?: number
  message?: string
  /** The failure's error code, e.g. `WF_FORECAST_REFUSED`. */
  code?: string
  attempts?: number
  /** Rows per output port. A branch that sent nothing is absent, which is what skips its downstream. */
  ports?: Readonly<Record<string, readonly DataRecord[]>>
  /** Something the run wants the author to know, e.g. series a forecast left out. */
  note?: string
  /** The rows a saved asset holds, so the card can draw it without opening the asset. */
  assetRows?: readonly DataRecord[]
  /** A wait being played back: when it started (`performance.now()`), how long it plays, and the wait it stands for. */
  countdown?: { startedAt: number; playMs: number; seconds: number }
}

export const NODE_CATEGORIES: readonly NodeCategory[] = [
  { id: 'triggers', title: 'Triggers', description: 'Initiate the workflow from defined start points' },
  { id: 'dataFlow', title: 'Data & Flow', description: 'Fetch data and control execution paths' },
  { id: 'analysisAgents', title: 'Analysis Agents', description: 'Perform general and specialized AI tasks' },
  { id: 'outputAgents', title: 'Output Agents', description: 'Generate final output content' },
  { id: 'actions', title: 'Actions', description: 'Execute external operations' },
  { id: 'annotations', title: 'Annotations', description: 'Add a note to workflow context' },
]

const NONE: readonly NodePort[] = []
const IN: readonly NodePort[] = [{ id: 'in' }]
const OUT: readonly NodePort[] = [{ id: 'out' }]

type Extra = Partial<NodeType>

const make =
  (category: NodeCategoryId, tone: NodeTone, inputs: readonly NodePort[], outputs: readonly NodePort[]) =>
  (id: KindId, title: string, description: string, icon: Icon, extra: Extra = {}): NodeType => ({
    id,
    category,
    title,
    description,
    icon,
    tone,
    inputs,
    outputs,
    ...extra,
  })

const trigger = make('triggers', 'trigger', NONE, OUT)
const dataStep = make('dataFlow', 'data', IN, OUT)
const analysisAgent = make('analysisAgents', 'analysis', IN, OUT)
const outputAgent = make('outputAgents', 'output', IN, OUT)
const action = make('actions', 'action', IN, OUT)

export const NODE_TYPES: readonly NodeType[] = [
  trigger('manualTrigger', 'Manual Trigger', 'Start the workflow manually from the library or the editor.', CursorClick, { singleton: true }),
  trigger('scheduleTrigger', 'Schedule Trigger', 'Run on a repeating schedule once the workflow is published.', Clock, {
    defaults: { name: 'Scheduled' },
  }),
  trigger('chatInput', 'Chat Input', 'Start from a chat conversation.', ChatCircle, { singleton: true }),
  trigger('webhook', 'Webhook', 'Start from an inbound HTTP request once the workflow is published.', PlugsConnected),

  dataStep('asset', 'Asset', 'Load the rows behind a saved asset.', SquaresFour, { width: 420 }),
  dataStep('source', 'Source', 'Query a configured source.', Database),
  dataStep('mlModel', 'ML Model', 'Run batch predictions through a registered ML model.', Cpu),
  dataStep('forecast', 'Forecast', 'Project a time series forward, with a confidence interval.', Graph),
  dataStep('createAsset', 'Create Asset', 'Register upstream data as a saved chart, table, or map layer.', CubeFocus, { tone: 'create' }),
  dataStep('noOperation', 'No Operation', 'Continues the flow without passing any rows on.', Empty),
  dataStep('filter', 'Filter', 'Keep the rows that match; the rest leave on Discarded.', Funnel, {
    outputs: [
      { id: 'kept', label: 'Kept', tone: 'positive' },
      { id: 'discarded', label: 'Discarded', tone: 'negative' },
    ],
  }),
  dataStep('ifElse', 'If / Else', 'Send matching rows down If and the rest down Else.', GitBranch, {
    outputs: [
      { id: 'true', label: 'If', tone: 'positive' },
      { id: 'false', label: 'Else', tone: 'negative' },
    ],
  }),
  dataStep('switchCases', 'Switch Cases', 'Route rows into case outputs, with a Default for the rest.', GitBranch, {
    extensibleOutputs: true,
  }),
  dataStep('editFields', 'Edit Fields', 'Create, update, or remove fields on incoming rows.', PencilSimple),
  dataStep('aggregate', 'Aggregate', 'Summarise rows, optionally per group.', Database),
  dataStep('merge', 'Merge', 'Append inputs into one table, in input order.', ArrowsMerge, {
    inputs: [
      { id: 'input1', label: 'Input 1' },
      { id: 'input2', label: 'Input 2' },
    ],
  }),
  dataStep('wait', 'Wait', 'Pause the workflow for a set time, then pass the rows on.', Clock),
  dataStep('stopAndError', 'Stop and Error', 'End the workflow with a controlled failure.', WarningCircle, { outputs: NONE }),

  analysisAgent('generalAgent', 'General Agent', 'Perform a wide range of tasks over the upstream data.', Robot),
  analysisAgent('dataClassificationAgent', 'Data Classification Agent', 'Route rows into the categories you define.', StarFour, {
    extensibleOutputs: true,
  }),
  analysisAgent('insightGenerator', 'Insight Generator', 'Write a structured insight with the fields you name.', StarFour),
  analysisAgent('dataAnalyst', 'Data Analyst', 'Statistical diagnosis of upstream data: baselines, trends, and outliers.', Detective),
  analysisAgent('gisCorrelationAgent', 'GIS Correlation Agent', 'Compares a map layer with the land layer underneath.', CirclesThree),

  outputAgent('slidesAgent', 'Create Slides', 'Generate and save slides from workflow context.', FileText),
  outputAgent('dashboardAgent', 'Create Dashboard', 'Draft dashboard content from workflow context.', SquaresFour),
  outputAgent('briefingAgent', 'Create Briefing', 'Generate and save a briefing from workflow context.', FileText),
  outputAgent('aiFindings', 'AI Findings', 'Opt the published Flow into AI-written findings about its runs.', Lightbulb, {
    singleton: true,
    outputs: NONE,
  }),

  action('sendChatMessage', 'Send Chat Message', 'Post a message to the workflow’s chat, or wait for a reply.', PaperPlaneTilt, { sideEffect: true }),
  action('sendEmail', 'Send Email', 'Send an email as a workflow action.', Envelope, { sideEffect: true }),
  action('sendApiRequest', 'Send API Request', 'Call an external API as a workflow action.', PlugsConnected, { sideEffect: true }),

  {
    id: 'stickyNote',
    category: 'annotations',
    title: 'Sticky Note',
    description: 'Editor annotation only; not compiled to runtime.',
    icon: Note,
    tone: 'note',
    inputs: NONE,
    outputs: NONE,
    defaults: { note: 'Editor annotation only; not compiled to runtime.' },
    width: STICKY_SIZE,
  },
]

/** dataTransfer type for dragging a node type from the library onto the canvas. */
export const NODE_DRAG_MIME = 'application/x-llumen-node-type'

export const NODE_TYPES_BY_ID: Readonly<Record<string, NodeType>> = Object.fromEntries(
  NODE_TYPES.map((type) => [type.id, type]),
)

export const NODE_MIN_WIDTH = 350
export const NODE_DEFAULT_WIDTH = 350

export const nodeOutputs = (node: CanvasNode, type: NodeType) => kindOutputs(type.id, node.config.params) ?? node.outputs ?? type.outputs
export const nodeName = (node: CanvasNode, type: NodeType) => node.config.name || type.title
/** Rows on the card, read from the node's params. */
export const nodeFields = (node: CanvasNode) => kindFields(node.type, node.config.params)
/** Instructions or a message the card shows as text. */
export const nodeText = (node: CanvasNode) => kindText(node.type, node.config.params)
/** What keeps the node from running, or undefined when it's ready. */
export const nodeIssue = (node: CanvasNode) => kindIssue(node.type, node.config.params)
export const nodeNotice = (node: CanvasNode) => kindNotice(node.type, node.config.params)
export const nodePreview = (node: CanvasNode) => kindPreview(node.type, node.config.params)
export const nodeSettings = (node: CanvasNode): NodeSettings => ({ ...DEFAULT_NODE_SETTINGS, ...node.settings })

export const formatCost = (cost: number) => `$${cost.toFixed(3)}`
export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Nodes that never run: they have no footer and no run controls. */
export const isAnnotation = (type: NodeType) => type.category === 'annotations'

export function createNode(type: NodeType, id: string, config: NodeConfig = {}): CanvasNode {
  return {
    id,
    type: type.id,
    config: { ...type.defaults, ...config, params: { ...KIND_DEFAULTS[type.id], ...type.defaults?.params, ...config.params } },
  }
}
