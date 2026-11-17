import { STUDIO_ASSETS, STUDIO_MEMBERS, ageMinutes, type StudioAsset, type StudioPage } from './studioData'

export type Go = (page: StudioPage | 'home') => void

export const ASSET_STATUSES = ['Active', 'Pending Review', 'Inactive'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_CATEGORIES = [...new Set(STUDIO_ASSETS.map((asset) => asset.category))]

/** A colour per category, for the dots that stand in for it in lists and filters. */
export const CATEGORY_COLOR: Record<string, string> = {
  Emissions: '#5aae87',
  Safety: '#e43963',
  Groundwater: '#3fa7a0',
  Biodiversity: '#e39b4c',
  'Net-Zero': '#a6e06f',
  Monitoring: '#70aeff',
  'Water Quality': '#e0c27a',
  Energy: '#c3a6ff',
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
