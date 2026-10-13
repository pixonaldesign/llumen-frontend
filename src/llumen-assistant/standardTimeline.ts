import type { TimelineStep } from './assistantReplyTypes'

/** Six first-level timeline lines shown during assistant work — no expansion. */
export function buildStandardTimeline(requestSummary: string, topic: string): TimelineStep[] {
  const inquire = `The user is inquiring about ${requestSummary}…`
  const search = `Searching existing components and data sources relevant to ${topic}…`
  const analyze = 'Found a relevant component/data source. Analyzing it now…'
  const query = 'Running query…'
  const generate = 'Generating component…'
  const draft = 'Drafting response…'

  return [
    { id: 'inquire', kind: 'reasoning', title: inquire, titleInProgress: inquire },
    { id: 'search', kind: 'tool', title: search, titleInProgress: search },
    { id: 'analyze', kind: 'tool', title: analyze, titleInProgress: analyze },
    { id: 'query', kind: 'tool', title: query, titleInProgress: query },
    { id: 'generate', kind: 'tool', title: generate, titleInProgress: generate },
    { id: 'draft', kind: 'outcome', title: draft, titleInProgress: draft },
  ]
}
