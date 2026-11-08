/**
 * The Dubai Municipality demo: the stories the Briefing's findings open, the places their maps start
 * on, and the views Tell Me More opens (each story's problem, then one per impact horizon).
 */
import { ODOR_ASK_VIEWS, ODOR_PLACE, ODOR_STORY } from '../municipality/odorScenario'
import { URBAN_ASK_VIEWS, URBAN_PLACE, URBAN_STORY } from '../municipality/urbanScenario'
import type { EstateAskView, EstatePlace, EstatePlaceId, EstateStory } from './estateTypes'

export const ESTATE_STORIES: Record<string, EstateStory> = {
  [ODOR_STORY.id]: ODOR_STORY,
  [URBAN_STORY.id]: URBAN_STORY,
}

export function isEstateStory(id: string | null | undefined): id is string {
  return id != null && id in ESTATE_STORIES
}

export const ESTATE_PLACES: Record<EstatePlaceId, EstatePlace> = {
  barsha: ODOR_PLACE,
  dubai: URBAN_PLACE,
}

export const ESTATE_ASK_VIEWS = { ...ODOR_ASK_VIEWS, ...URBAN_ASK_VIEWS } satisfies Record<string, EstateAskView>

export type EstateAskViewId = keyof typeof ESTATE_ASK_VIEWS

export function isAskView(id: string | null | undefined): id is EstateAskViewId {
  return id != null && id in ESTATE_ASK_VIEWS
}
