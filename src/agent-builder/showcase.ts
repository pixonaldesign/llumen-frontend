import { conditionGroup } from './conditions'
import { SENSOR_READINGS, SITES } from './flowData'
import { NODE_CATEGORIES, NODE_DEFAULT_WIDTH, NODE_TYPES, NODE_TYPES_BY_ID, createNode, type CanvasNode, type DataRecord, type NodeConfig, type NodeRun, type Point, type Size } from './nodeCatalog'
import { planRun } from './nodeRuntime'

/** Showcase columns wrap after this many cards so tall categories stay on screen. */
const SHOWCASE_COLUMN_ROWS = 7

export type CanvasGroupLabel = { id: string; title: string; position: Point }

export type ShowcaseColumn = { label?: { id: string; title: string }; ids: string[] }

/** Showcase cards are configured the way an author would leave them; a few keep their setup warning on purpose. */
const SHOWCASE_CONFIG: Readonly<Record<string, NodeConfig>> = {
  'asset-1': { name: 'Detected Contamination Anomalies', params: { assetId: 'ast_anomalies' } },
  'asset-2': { name: 'High Risk Contaminated Sites', params: { assetId: 'ast_sites' } },
  'source-1': { name: 'Get custom view' },
  'mlModel-1': { params: { modelId: 'mdl_risk' } },
  'forecast-1': { params: { timeColumn: 'reading_date', targetColumn: 'pm10', seriesIdColumns: ['station'], grain: 'day', horizon: 7 } },
  'createAsset-1': { params: { title: 'Anomalies by site', chartType: 'bar', mapping: { x: 'site', y: 'anomalies' }, refresh: 'update' } },
  'switchCases-1': {
    params: {
      cases: [
        { id: 'case1', label: 'High risk', when: conditionGroup({ id: 'c1', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.8' }) },
        { id: 'case2', label: 'Watch', when: conditionGroup({ id: 'c2', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.5' }) },
      ],
      sendToAllMatching: false,
    },
  },
  'stopAndError-1': { params: { stopMessage: 'Threshold breached' } },
  'aiFindings-1': { params: { instructions: 'Write one finding a director can act on today.' } },
}

const SHOWCASE_INPUT: Readonly<Record<string, readonly DataRecord[]>> = { 'forecast-1': SENSOR_READINGS }

const SHOWCASE_RUNS = ['manualTrigger-1', 'asset-1', 'asset-2', 'mlModel-1', 'forecast-1', 'createAsset-1', 'filter-1', 'switchCases-1', 'insightGenerator-1', 'sendEmail-1', 'generalAgent-1', 'createApp-1', 'aiFindings-1']

/** Shown as a workflow run rather than a step test, so the card shows what the run saved. */
const SHOWCASE_SAVES: ReadonlySet<string> = new Set(['createAsset-1'])

/** Every node type, one column per category; positions are laid out once the cards are measured. */
export function buildShowcase() {
  const nodes: CanvasNode[] = []
  const columns: ShowcaseColumn[] = []

  for (const category of NODE_CATEGORIES) {
    const ids: string[] = []
    for (const type of NODE_TYPES.filter((item) => item.category === category.id)) {
      const id = `${type.id}-1`
      nodes.push(createNode(type, id, SHOWCASE_CONFIG[id]))
      ids.push(id)
      if (type.id === 'asset') {
        nodes.push(createNode(type, 'asset-2', SHOWCASE_CONFIG['asset-2']))
        ids.push('asset-2')
      }
    }
    for (let start = 0; start < ids.length; start += SHOWCASE_COLUMN_ROWS) {
      columns.push({
        label: start === 0 ? { id: category.id, title: category.title } : undefined,
        ids: ids.slice(start, start + SHOWCASE_COLUMN_ROWS),
      })
    }
  }

  const runs: Record<string, NodeRun> = {}
  for (const id of SHOWCASE_RUNS) {
    const node = nodes.find((item) => item.id === id)
    if (!node) continue
    const isTrigger = NODE_TYPES_BY_ID[node.type].category === 'triggers'
    const [step] = planRun({
      nodes: [node],
      edges: [],
      order: [id],
      previous: {},
      fixtures: isTrigger || node.type === 'asset' ? {} : { [id]: [...(SHOWCASE_INPUT[id] ?? SITES)] },
      triggerId: isTrigger ? id : undefined,
      stepTest: SHOWCASE_SAVES.has(id) ? false : undefined,
    })
    if (step) runs[id] = step.run
  }

  return { nodes, columns, runs }
}

const SHOWCASE_COLUMN_GAP = 120
const SHOWCASE_ROW_GAP = 48
const SHOWCASE_LABEL_OFFSET = 40

/** Stacks showcase columns from measured card sizes, centred on the canvas origin. */
export function layoutShowcase(columns: readonly ShowcaseColumn[], sizes: Readonly<Record<string, Size>>) {
  const fallback: Size = { w: NODE_DEFAULT_WIDTH, h: 120 }
  const widths = columns.map((column) => Math.max(...column.ids.map((id) => (sizes[id] ?? fallback).w)))
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + SHOWCASE_COLUMN_GAP * (columns.length - 1)
  const positions: Record<string, Point> = {}
  const groups: CanvasGroupLabel[] = []
  let x = -totalWidth / 2
  columns.forEach((column, index) => {
    if (column.label) groups.push({ ...column.label, position: { x, y: -SHOWCASE_LABEL_OFFSET } })
    let y = 0
    for (const id of column.ids) {
      positions[id] = { x, y }
      y += (sizes[id] ?? fallback).h + SHOWCASE_ROW_GAP
    }
    x += widths[index] + SHOWCASE_COLUMN_GAP
  })
  return { positions, groups }
}
