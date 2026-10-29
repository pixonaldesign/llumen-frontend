import type { Icon } from '@phosphor-icons/react'
import type { SavedAsset } from './flowData'
import type { ChatExchange } from './chatMessage'
import type { ApiExchange } from './apiExchange'
import type { EmailMessage } from './emailMessage'
import type { Finding } from './findings'
import { nodeAsset, nodePreview, type AssetPreview, type CanvasNode, type DataRecord, type NodeField, type NodeRun, type NodeType } from './nodeCatalog'
import { kindPrompt, type KindPrompt } from './nodeKinds'
import { hasSummary, nodeSummary, type NodeSummary } from './nodeSummary'
import { cardDetails, type FlowState } from './triggerCard'

/*
 * What a card holds under its icon and title, in order. The card renders blocks by kind, so a new kind
 * of content is a new block here plus a view for it.
 */

/** What the content section shows under the title, in order. */
export type ContentBlock =
  | { kind: 'asset'; preview: AssetPreview; asset?: SavedAsset }
  | { kind: 'prompt'; prompt: KindPrompt; label: string; placeholder: string }
  | ({ kind: 'summary' } & NodeSummary)

/** A button next to the card's icon, shown on hover. */
export type HeaderAction = { id: string; label: string; icon: Icon; pressed?: boolean; onSelect: () => void }

const PROMPT_COPY: Record<KindPrompt['param'], { label: string; placeholder: string }> = {
  instructions: { label: 'Prompt', placeholder: 'Tell the agent what to do' },
}

/** Kinds whose prompt is something other than a task, e.g. AI Findings' optional focus. */
const KIND_PROMPT_COPY: Readonly<Record<string, { label: string; placeholder: string }>> = {
  aiFindings: { label: 'Focus', placeholder: 'Optional: what the findings should look at first' },
}

/** Branching kinds whose outputs sit as labelled dots on the card's edge instead of rows in the content. */
const EDGE_OUTPUTS: ReadonlySet<string> = new Set(['ifElse', 'filter'])

export const cardEdgeOutputs = (type: NodeType) => EDGE_OUTPUTS.has(type.id)

/** The node's values, as badges under the title; a placeholder waits until there's a real value. A kind told as a sentence has none. */
export const cardValues = (node: CanvasNode, type: NodeType, flow: FlowState): readonly NodeField[] =>
  hasSummary(type.id) ? [] : cardDetails(node, type.category === 'triggers', flow).fields.filter((field) => !field.muted && field.value.trim())

export function cardContent(node: CanvasNode): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const preview = nodePreview(node)
  if (preview) blocks.push({ kind: 'asset', preview, asset: nodeAsset(node) })
  const prompt = kindPrompt(node.type, node.config.params)
  if (prompt) blocks.push({ kind: 'prompt', prompt, ...(KIND_PROMPT_COPY[node.type] ?? PROMPT_COPY[prompt.param]) })
  const summary = nodeSummary(node.type, node.config.params)
  if (summary) blocks.push({ kind: 'summary', ...summary })
  return blocks
}

/** `finding` is an AI Findings step's preview; null when it ran with nothing to write about. */
export type DataView = {
  label: string
  records: readonly DataRecord[] | null
  emptyMessage: string
  error?: string
  finding?: Finding | null
  /** A Send Chat Message step's bubble, also while it waits for a reply. */
  chat?: ChatExchange
  /** A Send Email step's email, as sent or simulated. */
  email?: EmailMessage
  /** A Send API Request step's request and reply, also when the reply was unsuccessful. */
  api?: ApiExchange
}

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
      finding: run.status === 'success' ? run.finding : undefined,
      chat: run.status === 'success' || run.status === 'waiting' ? run.chat : undefined,
      email: run.status === 'success' ? run.email : undefined,
      api: run.status === 'success' || run.status === 'error' ? run.api : undefined,
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
    ...(views.output.records || views.output.error || views.output.finding !== undefined || views.output.chat ? (['output'] as const) : []),
  ]
}
