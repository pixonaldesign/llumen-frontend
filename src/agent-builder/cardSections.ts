import type { Icon } from '@phosphor-icons/react'
import { LIMIT_WATCH, ML_MODELS_BY_ID, measureLimit } from './flowData'
import type { CreateAssetSettings } from './createAsset'
import {
  NODE_CATEGORIES,
  nodeName,
  nodePreview,
  type AssetPreview,
  type CanvasNode,
  type DataRecord,
  type NodeField,
  type NodeRun,
  type NodeType,
} from './nodeCatalog'
import { GRAIN_LABEL, kindPrompt, paramsFor, type KindPrompt } from './nodeKinds'
import { sentenceCase } from './recordUtils'
import { cardDetails, type FlowState } from './triggerCard'

/*
 * Sectioned cards: every node is a header (icon and category), content (title, subtitle, then what the
 * node holds) and a footer (what went in or came out of its last run). This file decides what goes in
 * each section; the card renders blocks by kind, so a new kind of content or output is a new block
 * here plus a view for it.
 */

/** What the content section shows under the title, in order. */
export type ContentBlock =
  | { kind: 'asset'; preview: AssetPreview }
  | { kind: 'prompt'; prompt: KindPrompt; label: string; placeholder: string }
/** A critical result is one someone should act on; a warning is one worth watching. */
export type ResultTone = 'critical' | 'warning'

/** A headline number in the footer. */
export type ResultTile = { label: string; value: string; detail?: string; tone?: ResultTone }

/** The footer's view of a node's input or output rows. */
export type DataPreview =
  | { kind: 'table'; records: readonly DataRecord[] }
  | { kind: 'results'; rows: number; tiles: readonly ResultTile[]; caption?: string; hint?: string }
  | { kind: 'asset'; title: string; settings: CreateAssetSettings; records: readonly DataRecord[] }
  | { kind: 'text'; text: string }
  | { kind: 'slides'; title: string; slides: number; chapters: number }
  | { kind: 'document'; title: string; sections: number; words: number }

export type CardHeader = { category: string }

/** A button in the card header, shown on hover: the footer toggle, and whatever a node kind adds of its own. */
export type HeaderAction = { id: string; label: string; icon: Icon; pressed?: boolean; onSelect: () => void }

export type CardTitle = { title: string; subtitle?: string }

const PROMPT_COPY: Record<KindPrompt['param'], { label: string; placeholder: string }> = {
  instructions: { label: 'Prompt', placeholder: 'Tell the agent what to do' },
  message: { label: 'Message', placeholder: 'Write the message to send' },
}

const CATEGORY_TITLE = Object.fromEntries(NODE_CATEGORIES.map((category) => [category.id, category.title]))

export const cardHeader = (type: NodeType): CardHeader => ({ category: CATEGORY_TITLE[type.category] ?? type.title })

/** A trigger's subtitle says how the flow starts; elsewhere it's the kind's own name once the node has a name of its own. */
export function cardTitle(node: CanvasNode, type: NodeType): CardTitle {
  const title = nodeName(node, type)
  if (type.category === 'triggers') return { title, subtitle: type.description }
  return { title, subtitle: title === type.title || NO_SUBTITLE.has(type.id) ? undefined : type.title }
}

/** Kinds whose run data isn't worth a footer: a manual start only outputs its own run metadata, an asset shows
   itself, a switch's rows are split across its cases, and a wait passes its input through unchanged. */
const NO_FOOTER: ReadonlySet<string> = new Set(['manualTrigger', 'asset', 'switchCases', 'wait'])

/** Branching kinds whose outputs sit as labelled dots on the card's edge instead of rows in the content. */
const EDGE_OUTPUTS: ReadonlySet<string> = new Set(['ifElse', 'filter'])

export const cardEdgeOutputs = (type: NodeType) => EDGE_OUTPUTS.has(type.id)

/** Kinds whose content says what they are, so the kind's name needn't sit under the title. */
const NO_SUBTITLE: ReadonlySet<string> = new Set(['asset'])

export const cardHasFooter = (type: NodeType) => !NO_FOOTER.has(type.id)

/** The node's values, as badges under the title; a placeholder waits until there's a real value. */
export const cardValues = (node: CanvasNode, type: NodeType, flow: FlowState): readonly NodeField[] =>
  cardDetails(node, type.category === 'triggers', flow).fields.filter((field) => !field.muted && field.value.trim())

export function cardContent(node: CanvasNode): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const preview = nodePreview(node)
  if (preview) blocks.push({ kind: 'asset', preview })
  const prompt = kindPrompt(node.type, node.config.params)
  if (prompt) blocks.push({ kind: 'prompt', prompt, ...PROMPT_COPY[prompt.param] })
  return blocks
}

const text = (value: DataRecord[string] | undefined) => (value === null || value === undefined ? '' : String(value))
const count = (value: DataRecord[string] | undefined) => (typeof value === 'number' ? value : Number(value) || 0)

/** What the footer head says next to Input or Output. */
export function previewCount(preview: DataPreview) {
  if (preview.kind === 'results' && preview.caption) return preview.caption
  const rows = preview.kind === 'table' ? preview.records.length : preview.kind === 'results' ? preview.rows : undefined
  return rows === undefined ? undefined : `${rows} ${rows === 1 ? 'row' : 'rows'}`
}

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`

/** A model's scored rows as one tile per answer, the model's positive label first, plus how sure it was on average. */
function predictionResults(node: CanvasNode, records: readonly DataRecord[]): DataPreview | null {
  const model = ML_MODELS_BY_ID[paramsFor('mlModel', node.config.params).modelId ?? '']
  if (!model || !records.length) return null
  const [low, high] = model.labels
  const flagged = records.filter((record) => record.prediction === high).length
  const sureness = records.reduce((sum, record) => {
    const probability = Number(record.probability) || 0
    return sum + (record.prediction === high ? probability : 1 - probability)
  }, 0)
  const share = (rows: number) => percent(rows / records.length)
  return {
    kind: 'results',
    rows: records.length,
    tiles: [
      { label: sentenceCase(high), value: flagged.toLocaleString(), detail: share(flagged), tone: flagged > 0 ? 'critical' : undefined },
      { label: sentenceCase(low), value: (records.length - flagged).toLocaleString(), detail: share(records.length - flagged) },
      { label: 'Average confidence', value: percent(sureness / records.length) },
    ],
  }
}

/**
 * Each series' highest forecast and how far it is from the last reading, highest first. A measure with a
 * standard limit over the forecast's period is toned against it, and the limit is the footer's hint.
 */
function forecastResults(node: CanvasNode, records: readonly DataRecord[]): DataPreview | null {
  const params = paramsFor('forecast', node.config.params)
  const standard = measureLimit(params.targetColumn)
  const limit = standard?.grain === params.grain ? standard : undefined
  const series = new Map<string, { last: number; peak: number }>()
  for (const record of records) {
    const id = text(record.SERIES_ID)
    const value = Number(record.FORECAST)
    const entry = series.get(id) ?? { last: Number.NaN, peak: Number.NEGATIVE_INFINITY }
    if (record.IS_HISTORY) entry.last = value
    else entry.peak = Math.max(entry.peak, value)
    series.set(id, entry)
  }
  const peaks = [...series].filter(([, entry]) => Number.isFinite(entry.peak)).sort(([, a], [, b]) => b.peak - a.peak)
  if (!peaks.length) return null
  const tone = (value: number): ResultTone | undefined =>
    !limit ? undefined : value >= limit.limit ? 'critical' : value >= limit.limit * LIMIT_WATCH ? 'warning' : undefined
  const change = ({ last, peak }: { last: number; peak: number }) =>
    last ? `${peak >= last ? '+' : '−'}${percent(Math.abs(peak - last) / last)}` : undefined
  const measure = standard?.label ?? params.targetColumn ?? 'Forecast'
  return {
    kind: 'results',
    rows: records.length,
    caption: `Peak in the next ${params.horizon} ${GRAIN_LABEL[params.grain].toLowerCase()}${params.horizon === 1 ? '' : 's'}`,
    hint: limit ? `Limit ${limit.limit} ${limit.unit}` : undefined,
    tiles: peaks.map(([id, entry]) => ({
      label: id === 'all' ? measure : id,
      value: Math.round(entry.peak).toLocaleString(),
      detail: change(entry),
      tone: tone(entry.peak),
    })),
  }
}

/** The asset a run saved, drawn from the rows it holds; a test run saves none, so it shows its rows instead. */
function savedAsset(node: CanvasNode, run: NodeRun): DataPreview | null {
  if (!run.assetRows) return null
  const settings = paramsFor('createAsset', node.config.params)
  return { kind: 'asset', title: settings.title?.trim() || 'Workflow Asset', settings, records: run.assetRows }
}

/** What a run produced: a summary for kinds whose output is a verdict, the rows otherwise. */
export function outputPreview(node: CanvasNode, run: NodeRun, records: readonly DataRecord[] | null): DataPreview | null {
  const summary =
    node.type === 'createAsset'
      ? savedAsset(node, run)
      : !records
        ? null
        : node.type === 'mlModel'
          ? predictionResults(node, records)
          : node.type === 'forecast'
            ? forecastResults(node, records)
            : null
  return summary ?? dataPreview(records)
}

/** Output agents return one record describing what they made; anything else is rows. */
export function dataPreview(records: readonly DataRecord[] | null): DataPreview | null {
  if (!records?.length) return null
  const [first] = records
  if (records.length === 1) {
    if (first.kind === 'slides') return { kind: 'slides', title: text(first.title), slides: count(first.slides), chapters: count(first.chapters) }
    if (first.kind === 'briefing') return { kind: 'document', title: text(first.title), sections: count(first.sections), words: count(first.words) }
    if (first.kind === 'text' && typeof first.text === 'string') return { kind: 'text', text: first.text }
  }
  return { kind: 'table', records }
}

export type DataView = { label: string; records: readonly DataRecord[] | null; emptyMessage: string; error?: string }

/** What a node's input and output views show; a trigger's input is the test payload it starts the flow with. */
export function nodeDataViews(
  run: NodeRun,
  input: readonly DataRecord[] | null,
  output: readonly DataRecord[] | null,
  isTrigger: boolean,
  hasInputs: boolean,
): { input: DataView; output: DataView } {
  return {
    input: {
      label: isTrigger ? 'Test payload' : 'Input',
      records: isTrigger ? output : input,
      emptyMessage: hasInputs ? 'No input yet. Connect and run an upstream node.' : 'This node starts the flow.',
    },
    output: {
      label: 'Output',
      records: run.status === 'success' ? output : null,
      emptyMessage:
        run.status === 'running'
          ? 'Running…'
          : run.status === 'skipped'
            ? (run.message ?? 'Skipped.')
            : run.note && run.status === 'success'
              ? run.note
              : 'Run this node to see its output.',
      error: run.status === 'error' ? run.message : undefined,
    },
  }
}

export type DataSide = 'input' | 'output'

/**
 * The sides with something to show: input once rows arrived, even none, on a node that takes input
 * (a trigger's payload is its output); output once it ran or failed.
 */
export function nodeDataSides(views: { input: DataView; output: DataView }, hasInputs: boolean): DataSide[] {
  return [
    ...(hasInputs && views.input.records ? (['input'] as const) : []),
    ...(views.output.records || views.output.error ? (['output'] as const) : []),
  ]
}
