import { PALETTE } from '../gami/gamiTypes'
import { STUDIO_ASSETS, STUDIO_MEMBERS, ageMinutes, type StudioAsset, type StudioPage } from './studioData'

export type Go = (page: StudioPage | 'home') => void

export const ASSET_STATUSES = ['Active', 'Pending Review', 'Inactive'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_CATEGORIES = [...new Set(STUDIO_ASSETS.map((asset) => asset.category))]

/** A colour per category, for the dots that stand in for it in lists and filters. */
export const CATEGORY_COLOR: Record<string, string> = {
  'National KPIs': PALETTE.teal[2],
  Licensing: PALETTE.categorical[0],
  Investment: PALETTE.categorical[1],
  Localization: PALETTE.purple[3],
  'Supply Chain': PALETTE.diverging[1],
  Inventory: PALETTE.categorical[5],
  'Industrial Sites': PALETTE.categorical[3],
  'World Defense Show': PALETTE.categorical[4],
  'Human Capital': PALETTE.categorical[9],
}

export const STATUS_COLOR: Record<string, string> = {
  Active: '#51c87d',
  'Pending Review': '#f2b84b',
  Inactive: 'rgba(255, 255, 255, 0.4)',
}

export const OWNERS = STUDIO_MEMBERS.filter((member) => member.role !== 'Viewer')

export function ownerOf(asset: StudioAsset) {
  return OWNERS[STUDIO_ASSETS.indexOf(asset) % OWNERS.length]
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

export function byRecent(a: StudioAsset, b: StudioAsset) {
  return ageMinutes(a.updated) - ageMinutes(b.updated)
}
