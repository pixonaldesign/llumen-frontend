/** The Briefing map's places: one per real-estate finding, each with its own camera and map scene. */
import { ESTATE_PLACES, type EstatePlace } from '../realEstate/estateScenario'
import type { EstatePlaceId } from '../realEstate/estateTypes'

export type BriefingPlaceId = EstatePlaceId

export type BriefingPlace = EstatePlace

export const BRIEFING_PLACES: Record<BriefingPlaceId, BriefingPlace> = ESTATE_PLACES
