/**
 * Assistant reply copy model — surface vs technical:
 *
 * - Surface (headline, step titles, step body): plain English, outcome-first; avoid SQL,
 *   raw schema paths, subagent IDs, and implementation jargon.
 * - Technical blocks: short imperative labels ("Query run", "Tables used"); code/monospace OK;
 *   keep collapsed until the user expands.
 * - Streaming: interleaved `blocks` reveal after the timeline finishes.
 */
import type { StoryAiSnapshot } from './story/storyAiScenarios'

export type TechnicalFormat = 'sql' | 'json' | 'markdown' | 'plain'

export type TechnicalBlock = {
  label?: string
  format: TechnicalFormat
  content: string
}

export type TimelineStepKind = 'tool' | 'reasoning' | 'outcome'

export type TimelineStep = {
  id: string
  kind: TimelineStepKind
  /** Past-tense / completion label shown after the step finishes. */
  title: string
  /**
   * Present-tense line with trailing ellipsis, shown for ~2s while the step “runs” in the UI.
   * Omit to skip the progress phrase and show `title` immediately.
   */
  titleInProgress?: string
  body?: string
  /** Muted one-line status shown under the step title. */
  subtitle?: string
  technical?: TechnicalBlock | TechnicalBlock[]
  meta?: { resultCount?: number }
}

export type CreatedComponentType = 'kpi' | 'data-sample' | 'visual' | 'briefing' | 'domain'

export type WidgetVariant =
  | 'aqi'
  | 'pollutants'
  | 'population'
  | 'land-use'
  | 'wind'
  | 'humidity'
  | 'odor'
  | 'chart'
  | 'map'

/** Chart data rendered with the Story insight-card visuals (see `StoryReplyChart`). */
export type StoryReplyChartData =
  | {
      type: 'trend'
      title: string
      value?: string
      unit?: string
      legend?: [string, string]
      yLabels: string[]
      xLabels: string[]
      line: string
      /** Line drawn first, then morphed into `line` once the chart is on screen. */
      fromLine?: string
      color: string
      dashed?: boolean
    }
  | {
      /** The story's Junction Traffic Status card; `from` values animate into the final ones. */
      type: 'status'
      title: string
      terrestrial: number
      marine: number
      from?: { terrestrial: number; marine: number }
    }
  | {
      /** The story's Live Junction Data card; `from` values animate into the final ones. */
      type: 'sites'
      title: string
      online: number
      sites: number
      uptime: number
      offlineBars: number[]
      from?: { online: number; uptime: number; offlineBars: number[] }
    }
  | {
      type: 'bars'
      title: string
      value?: string
      unit?: string
      color: string
      rows: { label: string; value: number; display: string }[]
    }
  | {
      type: 'compare'
      title: string
      value?: string
      unit?: string
      legend: [string, string]
      rows: { label: string; before: number; after: number; beforeDisplay: string; afterDisplay: string }[]
    }
  | {
      type: 'histogram'
      title: string
      value?: string
      unit?: string
      legend: [string, string]
      bins: string[]
      before: number[]
      after: number[]
    }

export type CreatedComponentPreview =
  | { kind: 'kpi'; value: string; unit?: string; status?: string; statusTone?: 'critical' | 'normal' | 'warning' }
  | { kind: 'story-chart'; chart: StoryReplyChartData }
  | {
      kind: 'story-map-state'
      /** Key into the captured map screenshots; the image arrives after the reply is created. */
      stateId: string
      snapshot: StoryAiSnapshot
      tag: string
      meta: string
    }
  | { kind: 'text'; content: string }
  | {
      kind: 'image'
      src: string
      alt?: string
      fit?: 'contain' | 'cover'
      detailSrc?: string
      detailView?: 'map'
    }
  | { kind: 'widget'; variant: WidgetVariant }

export type CreatedComponent = {
  id: string
  /** Short label on the chip in the conversation. */
  label: string
  type: CreatedComponentType
  /** Title shown in the detail sub-panel. */
  title: string
  description: string
  /** Short figure-style caption under the chart (falls back to description). */
  caption?: string
  /** Longer narrative analysis shown below the caption. */
  analysis?: string
  /** Muted semantic identifier shown under the card title (e.g. "market_stability.cluster_average_score"). */
  semanticId?: string
  /** Inline layout: full-width (up to 760) or square tile (1:1, up to 760). */
  inlineSize?: 'full' | 'square'
  /** When true, show an AI-generated sparkle mark next to the asset headline. */
  aiGenerated?: boolean
  preview?: CreatedComponentPreview
}

export type ThinkingStepKind = 'reasoning' | 'search' | 'done'

export type ThinkingStep = {
  id: string
  kind: ThinkingStepKind
  title: string
  description?: string
}

export type VisualType = 'map' | 'chart' | 'kpi'

export type AgentResponseBlock =
  | {
      type: 'heading'
      content: string
    }
  | {
      type: 'text'
      content: string
    }
  | {
      type: 'visual'
      componentId: string
      visualType: VisualType
      title: string
      caption: string
      displayMode: 'inline' | 'subcontext'
      openSubcontext?: boolean
    }
  | {
      type: 'report'
      reportId: string
      title: string
      subtitle: string
      thumbnailUrl?: string
      slideCount: number
      badge: 'AI Generated'
      openSubcontext: true
      subcontextView: 'slides'
    }
  | {
      type: 'workflow'
      proposal: WorkflowProposal
    }
  | {
      type: 'question'
      id: string
      prompt: string
      options: { id: string; label: string }[]
    }

/** A clause the agent cites back to the user's request. Order is citation order, not step order. */
export type WorkflowClause = {
  id: string
  label: string
}

/** `source` reads or checks the data the workflow runs on. */
export type WorkflowStepTone = 'trigger' | 'source' | 'step' | 'asset' | 'agent' | 'delivery'

/** Where the step sits in the labeled graph. */
export type WorkflowStepLane = 'spine' | 'left' | 'right' | 'join'

export type WorkflowStep = {
  id: string
  label: string
  tone: WorkflowStepTone
  lane: WorkflowStepLane
}

export type WorkflowProposal = {
  id: string
  /** Short agent line above the citation chips. */
  intro: string
  clauses: WorkflowClause[]
  title: string
  summary: string
  steps: WorkflowStep[]
  /** Directed links used to highlight neighbors when a step is selected. */
  edges: [string, string][]
}

export type ReportSlide = {
  id: string
  title: string
  body: string[]
  visualComponentId?: string
  finding?: string
  confidenceLabel?: string
}

export type ReportPayload = {
  id: string
  title: string
  subtitle: string
  slideCount: number
  badge: 'AI Generated'
  slides: ReportSlide[]
  meta?: string[]
}

export type SubcontextState =
  | { view: 'closed' }
  | { view: 'map' | 'chart'; componentId: string }
  | { view: 'slides'; reportId: string; activeSlide: number }
  | { view: 'workflow'; proposal: WorkflowProposal }

export type AssistantReplyPayload = {
  /**
   * Short affirming phrase (e.g. "Absolutely", "Got it") shown as:
   * "{confirmation}, let me work on this report for you." before the rest of the reply.
   */
  confirmation?: string
  headline: string
  /** Optional plain-English elaboration shown when the headline row is expanded. */
  headlineDetail?: string
  /** Internal reasoning steps shown in the collapsible thought panel. */
  thinkingSteps?: ThinkingStep[]
  timeline: TimelineStep[]
  /** Interleaved answer blocks revealed after thinking. */
  blocks?: AgentResponseBlock[]
  /** Catalog of visual components referenced by blocks. */
  createdComponents?: CreatedComponent[]
  /** Report payloads referenced by report blocks. */
  reports?: ReportPayload[]
}

/** Back-compat with older demo/API payloads */
export type LegacyAgentActivity = {
  id: string
  label: string
  status: 'complete' | 'active' | 'pending'
  depth?: number
}

export type LegacyThinkingPayload = {
  activities: LegacyAgentActivity[]
  planSummary: string
  planBody: string
}

export function legacyThinkingToReplyPayload(legacy: LegacyThinkingPayload): AssistantReplyPayload {
  const timeline: TimelineStep[] = legacy.activities.map((a) => ({
    id: `act-${a.id}`,
    kind: 'reasoning' as const,
    title: a.label,
  }))

  timeline.push({
    id: 'plan-technical',
    kind: 'tool',
    title: 'Prepared a structured runbook for validation',
    body: 'Open the technical view to see exact steps, datasources, and checks.',
    technical: {
      label: 'Agent execution plan',
      format: 'plain',
      content: legacy.planBody,
    },
  })

  return {
    headline: legacy.planSummary,
    timeline,
  }
}
