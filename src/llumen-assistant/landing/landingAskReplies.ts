/** Demo replies for prompts sent from the landing AI bar. */
import type { AssistantReplyPayload, ThinkingStep, TimelineStep } from '../assistantReplyTypes'
import type { StoryMapAnnotation } from '../story/storyAnnotations'
import { schoolMarkersReply } from '../story/storySelectionReplies'
import type { LandingTellMeMorePayload } from './LandingHomeDefault'

export function tellMeMorePrompt(item: Pick<LandingTellMeMorePayload, 'title'>) {
  return `Tell me more about ${item.title}`
}

/** The finding read back, then the busiest junctions behind it marked on the map. */
export function findingReply(item: LandingTellMeMorePayload, annotation: StoryMapAnnotation): AssistantReplyPayload {
  const base = schoolMarkersReply(annotation)
  const read: ThinkingStep = {
    id: 'finding-read',
    kind: 'reasoning',
    title: `Reading the ${item.title} finding from ${item.domain} and the data behind it…`,
  }
  const readStep: TimelineStep = { id: read.id, kind: 'reasoning', title: read.title, titleInProgress: read.title }
  const blocks = base.blocks ?? []
  // The markers' validity notes are about editing a story, not about the finding.
  const editorNote = blocks.findIndex(
    (block) => block.type === 'heading' && block.content === 'How the markers stay accurate',
  )
  const kept = editorNote === -1 ? blocks : [...blocks.slice(0, editorNote), ...blocks.slice(editorNote + 2)]
  const finding = item.finding.trim()
  return {
    ...base,
    headline: item.title,
    thinkingSteps: [read, ...(base.thinkingSteps ?? [])],
    timeline: [readStep, ...base.timeline],
    blocks: [
      {
        type: 'text',
        content: finding
          ? `${finding} Here is where it concentrates on the ground.`
          : `Here is where ${item.title} concentrates on the ground.`,
      },
      { type: 'heading', content: 'On the map' },
      ...kept,
    ],
  }
}
