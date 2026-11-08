/** The Briefing map's places: one per TomTom map finding, each with its own camera and map scene. */
import { TOMTOM_PLACES, type TomtomPlace } from '../tomtom/tomtomScenario'
import type { TomtomPlaceId } from '../tomtom/tomtomTypes'

export type BriefingPlaceId = TomtomPlaceId

export type BriefingPlace = TomtomPlace

export const BRIEFING_PLACES: Record<BriefingPlaceId, BriefingPlace> = TOMTOM_PLACES
