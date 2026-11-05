import { PRODUCT_MODELS, type FacilityKind, type ProductModelId } from './gamiProductModels'
import type { LocalPartId } from './gamiTypes'

/** Every GAMI 3D model: the cut-off parts, the UAV and Abrams, the inventory's products and the plants. */
export type GamiModelId = LocalPartId | 'drone' | 'tank' | ProductModelId | `facility-${FacilityKind}`

export const isFacility = (model: GamiModelId): model is `facility-${FacilityKind}` => model.startsWith('facility-')
export const isProduct = (model: GamiModelId): model is ProductModelId => model in PRODUCT_MODELS

/** Whole vehicles, products and plants, framed tighter than a single part. */
export const isVehicle = (model: GamiModelId) => model === 'drone' || model === 'tank' || isProduct(model) || isFacility(model)
