import { PALETTE } from '../gami/gamiTypes'
import type { BriefingPlaceId } from './briefingMapPlaces'

type ChartSeries = { name: string; value: string; pct: number; color: string }

type ChartLine = { name: string; color: string; points: number[] }

type ChartColumn = { name: string; value: number }

export type FeedChart =
  | { kind: 'bar'; label: string; value: string; series: ChartSeries[] }
  | { kind: 'line'; label: string; total: number; delta: string; axis: string[]; lines: ChartLine[] }
  | {
      kind: 'columns'
      label: string
      value: string
      unit: string
      delta: string
      /** Columns under this read as alerts, and a dashed line marks it. */
      threshold: number
      max: number
      columns: ChartColumn[]
    }
  /** A My Board asset (briefingAssetData), drawn as the board draws it, across the finding's width. */
  | { kind: 'asset'; assetId: string }

export type FeedStop = {
  id: string
  /** Stops without a place show the last place's map, blurred. */
  place?: BriefingPlaceId
  domain: string
  title: string
  before: string
  highlight: string
  after: string
  storyId?: string
  chart?: FeedChart
}

/** Imported line items by stock health; matches the inventory app's Stock Health card. */
const STOCK_HEALTH: FeedChart = {
  kind: 'bar',
  label: 'Imported stock health · 4,280 line items',
  value: '96 days of cover',
  series: [
    { name: 'Healthy', value: '81%', pct: 81, color: PALETTE.diverging[5] },
    { name: 'Watch', value: '14%', pct: 14, color: PALETTE.diverging[2] },
    { name: 'Below safety', value: '5%', pct: 5, color: PALETTE.diverging[1] },
  ],
}

/**
 * The Briefing findings: GAMI insights, each on its own place on the map. Inventory has no place, so it
 * shows over the last place's map, blurred.
 */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'gami-overview',
    place: 'kingdom',
    domain: 'National Performance',
    title: 'GAMI 2026 Performance Overview',
    before: 'Saudi Made reached 29.4%, ',
    highlight: '94.8% of the 2026 plan',
    after: ', with SAR 46.5bn of military market and 66.4k jobs across 602 licensed companies.',
    storyId: 'gami-overview',
  },
  {
    id: 'gami-inventory',
    domain: 'Inventory',
    title: 'Imported Inventory Health',
    before: 'Imported stock covers 96 days against a 120-day target, and ',
    highlight: '3 critical UAV parts are cut off',
    after: ' with Poland’s 20 suspended imports.',
    storyId: 'gami-inventory',
    chart: STOCK_HEALTH,
  },
  {
    id: 'gami-localization',
    place: 'eastern',
    domain: 'Localization',
    title: 'Localization Opportunities',
    before: 'SAR 32.0bn a year of military imports ',
    highlight: 'can be made in the Kingdom',
    after: ', and Jubail can take SAR 10.6bn of it now.',
    storyId: 'gami-localization',
  },
  {
    id: 'gami-wds',
    place: 'wds',
    domain: 'World Defense Show',
    title: 'WDS 2028 Exhibitor Pipeline',
    before: '1,940 exhibitors from 94 countries have applied, ',
    highlight: '32% ahead of 2026',
    after: ', 15 months before the show opens in Riyadh.',
    storyId: 'gami-wds',
  },
  {
    id: 'gami-talent',
    place: 'western',
    domain: 'Human Capital',
    title: 'Defence Skills Gap',
    before: 'The sector is 6,350 skilled people short, ',
    highlight: 'rising to 10,600 by 2030',
    after: ', with 2,140 unfilled roles in the Western Region.',
    storyId: 'gami-talent',
  },
]
