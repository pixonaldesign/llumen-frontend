import type { AssistantReplyPayload, ThinkingStep, TimelineStep } from '../assistantReplyTypes'
import type { ConversationSource } from '../conversationSources'

function timelineFromThinking(steps: ThinkingStep[]): TimelineStep[] {
  return steps
    .filter((step) => step.kind !== 'done')
    .map((step) => ({
      id: step.id,
      kind: step.kind === 'search' ? ('tool' as const) : ('reasoning' as const),
      title: step.title,
      titleInProgress: step.title.endsWith('…') ? step.title : `${step.title}…`,
    }))
}

const THINKING: ThinkingStep[] = [
  {
    id: 'dump-intent',
    kind: 'reasoning',
    title:
      'The alert is a six-hour spike in illegal dumping along the Mussafah industrial belt, with three sites now above the emergency threshold…',
  },
  {
    id: 'dump-search',
    kind: 'search',
    title: 'Pulling incident reports, site inspections, and the week-ago baseline for the same corridor…',
  },
  {
    id: 'dump-compare',
    kind: 'reasoning',
    title: 'Comparing the new deposits with lots that were cleared earlier this month…',
  },
  {
    id: 'dump-draft',
    kind: 'done',
    title: 'Drafting the summary briefing…',
  },
]

/** Side-rail briefing opened from Tell me more on the illegal-dumping aurora. */
export const DUMPING_ALERT_BRIEFING: AssistantReplyPayload = {
  confirmation: 'Understood',
  headline: 'Briefing the illegal dumping surge along the Mussafah industrial belt.',
  thinkingSteps: THINKING,
  timeline: timelineFromThinking(THINKING),
  blocks: [
    {
      type: 'heading',
      content: 'Situation',
    },
    {
      type: 'text',
      content:
        'Illegal dumping along the Mussafah industrial belt has spiked 35% in the last six hours. The rise is concentrated on active industrial parcels, rather than spread across Abu Dhabi.',
    },
    {
      type: 'heading',
      content: 'Sites over threshold',
    },
    {
      type: 'text',
      content:
        'Three sites are now above the emergency threshold. Each has fresh deposits reported since this morning, and two sit on roads that feed the residential edge of the belt.',
    },
    {
      type: 'heading',
      content: 'What changed',
    },
    {
      type: 'text',
      content:
        'Report volume is running well ahead of the same window last week. Most new reports describe construction waste and mixed industrial refuse left after dark, often at vacant lots that were cleared earlier this month.',
    },
    {
      type: 'heading',
      content: 'Recommended response',
    },
    {
      type: 'text',
      content:
        'Send inspection teams to the three threshold sites first. Keep the recently cleared lots under watch through the night, and notify nearby facilities that repeat dumping at those locations is now an active enforcement case.',
    },
  ],
}

export const DUMPING_BRIEFING_SOURCES: ConversationSource[] = [
  { id: 'db-dump-reports', label: 'Dumping incident reports', categoryId: 'database' },
  { id: 'db-mussafah-sites', label: 'Mussafah site register', categoryId: 'database' },
  { id: 'br-public-safety', label: 'Public safety briefing', categoryId: 'briefings' },
]
