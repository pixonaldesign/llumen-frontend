/** The Briefing map's places: one per GAMI finding, each with its own camera and map scene. */
import { GAMI_PLACES, type GamiPlace } from '../gami/gamiPlaces'
import type { GamiPlaceId } from '../gami/gamiTypes'

export type BriefingPlaceId = GamiPlaceId

export type BriefingPlace = GamiPlace

export const BRIEFING_PLACES: Record<BriefingPlaceId, BriefingPlace> = GAMI_PLACES
