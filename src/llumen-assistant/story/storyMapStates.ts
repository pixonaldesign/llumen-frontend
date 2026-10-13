import { createContext, useContext } from 'react'
import type { StoryAiSnapshot, StoryMapCapture } from './storyAiScenarios'

/** Map views produced by story prompts, shared with the chat's map-state cards. */
export type StoryMapStates = {
  captures: Record<string, StoryMapCapture>
  /** The card whose view the story is currently showing. */
  activeStateId: string | null
  restore: (stateId: string, snapshot: StoryAiSnapshot) => void
}

export const StoryMapStatesContext = createContext<StoryMapStates | null>(null)

export function useStoryMapStates() {
  return useContext(StoryMapStatesContext)
}
