import type { ThinkingStep, TimelineStep } from './assistantReplyTypes'

export function thinkingStepsFromTimeline(timeline: TimelineStep[]): ThinkingStep[] {
  const steps: ThinkingStep[] = timeline
    .filter((step) => step.kind !== 'outcome')
    .map((step) => ({
      id: `think-${step.id}`,
      kind: step.kind === 'tool' ? ('search' as const) : ('reasoning' as const),
      title: step.title,
    }))

  steps.push({
    id: 'think-done',
    kind: 'done',
    title: 'Done',
  })

  return steps
}

export const DEMO_THINKING_STEPS: ThinkingStep[] = [
  {
    id: 'think-intent',
    kind: 'reasoning',
    title: 'Understanding the January revenue question',
  },
  {
    id: 'think-schema',
    kind: 'search',
    title: 'Mapping retail semantic models and warehouse tables',
  },
  {
    id: 'think-filters',
    kind: 'reasoning',
    title: 'Narrowed to stores and applied return rules',
  },
  {
    id: 'think-done',
    kind: 'done',
    title: 'Done',
  },
]

export const DATA_FETCH_THINKING_STEPS: ThinkingStep[] = [
  {
    id: 'think-intent',
    kind: 'reasoning',
    title: 'Understanding what data you want to explore',
  },
  {
    id: 'think-components',
    kind: 'search',
    title: 'Searching existing components and semantic models',
  },
  {
    id: 'think-sources',
    kind: 'search',
    title: 'Analyzing connected data sources',
  },
  {
    id: 'think-query',
    kind: 'reasoning',
    title: 'Running a lightweight validation query',
  },
  {
    id: 'think-done',
    kind: 'done',
    title: 'Done',
  },
]
