/**
 * The Dubai Municipality demo: the stories the Briefing's findings open, the places their maps start
 * on, and the views Tell Me More opens (each story's problem, then one per impact horizon).
 */
import { FACILITIES_ASK_VIEWS, FACILITIES_PLACE, FACILITIES_STORY } from '../municipality/facilitiesScenario'
import { INFRASTRUCTURE_ASK_VIEWS, INFRASTRUCTURE_PLACE, INFRASTRUCTURE_STORY } from '../municipality/infrastructureScenario'
import { ODOR_ASK_VIEWS, ODOR_PLACE, ODOR_STORY } from '../municipality/odorScenario'
import type { EstateAskView, EstatePlace, EstatePlaceId, EstateStory } from './estateTypes'

export const ESTATE_STORIES: Record<string, EstateStory> = {
  [ODOR_STORY.id]: ODOR_STORY,
  [FACILITIES_STORY.id]: FACILITIES_STORY,
  [INFRASTRUCTURE_STORY.id]: INFRASTRUCTURE_STORY,
}

export function isEstateStory(id: string | null | undefined): id is string {
  return id != null && id in ESTATE_STORIES
}

export const ESTATE_PLACES: Record<EstatePlaceId, EstatePlace> = {
  barsha: ODOR_PLACE,
  facilities: FACILITIES_PLACE,
  infrastructure: INFRASTRUCTURE_PLACE,
}

export const ESTATE_ASK_VIEWS = { ...ODOR_ASK_VIEWS, ...FACILITIES_ASK_VIEWS, ...INFRASTRUCTURE_ASK_VIEWS } satisfies Record<
  string,
  EstateAskView
>

export type EstateAskViewId = keyof typeof ESTATE_ASK_VIEWS

export function isAskView(id: string | null | undefined): id is EstateAskViewId {
  return id != null && id in ESTATE_ASK_VIEWS
}
