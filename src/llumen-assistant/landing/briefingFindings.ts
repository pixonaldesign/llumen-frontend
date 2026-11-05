import { INVENTORY_TOTALS, PRODUCT_STATUS } from '../gami/gamiInventory'
import { PLANT_NAME } from '../gami/gamiPlaces'
import { STATUS } from '../gami/gamiTypes'
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
  /** False keeps Tell Me More on screen but does nothing when pressed. */
  tellMeMore?: false
}

/** The listing's products by status; matches the inventory app's Products by Status card. */
const STOCK_HEALTH: FeedChart = {
  kind: 'bar',
  label: `Products by status · ${INVENTORY_TOTALS.products} products`,
  value: `SAR ${INVENTORY_TOTALS.valueBn}bn held`,
  series: INVENTORY_TOTALS.byStatus.map(({ status, count }) => ({
    name: status,
    value: `${Math.round((count / INVENTORY_TOTALS.products) * 100)}%`,
    pct: (count / INVENTORY_TOTALS.products) * 100,
    color: STATUS[PRODUCT_STATUS[status]],
  })),
}

/**
 * The Briefing findings: GAMI insights, each on its own place on the map. Inventory has no place, so it
 * shows over the last place's map, blurred. The Riyadh plant has no app: Tell Me More only.
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
    title: 'Product Inventory Health',
    before: `The sector holds ${INVENTORY_TOTALS.products} products worth SAR ${INVENTORY_TOTALS.valueBn}bn, and `,
    highlight: `${INVENTORY_TOTALS.cutOff} imported from Poland are cut off`,
    after: `; imported lead times run up to ${INVENTORY_TOTALS.maxLead} months.`,
    storyId: 'gami-inventory',
    chart: STOCK_HEALTH,
    tellMeMore: false,
  },
  {
    id: 'gami-riyadh-plant',
    place: 'riyadh-plant',
    domain: 'Industrial Facilities',
    title: 'Riyadh Military Plant at Full Capacity',
    before: `${PLANT_NAME} in Riyadh’s 2nd Industrial City runs at `,
    highlight: '94% of capacity, the busiest in the Kingdom',
    after: '; its new Hall B adds 120 armoured vehicles a year from Q2 2027.',
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
