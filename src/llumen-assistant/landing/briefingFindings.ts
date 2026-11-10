import { AREA_LIST, TOTAL_GROWTH, TOTALS } from '../municipality/growthAreas'
import { INFRASTRUCTURE_BRIEFING } from '../municipality/infrastructureScenario'
import { CRM_BY_WEEK, MENTIONS_BY_WEEK } from '../municipality/odorScenario'
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
  /** False shows Tell Me More without opening anything. */
  tellMore?: false
}

/** Negative odor posts and CRM odor complaints near Al Barsha's parks, a week, over 12 weeks. */
const ODOR_SIGNALS: FeedChart = {
  kind: 'line',
  label: 'Odor reports near Al Barsha’s parks',
  total: 412,
  delta: '+64% in 30 days',
  axis: ['Aug', 'Sep', 'Oct', 'Nov'],
  lines: [
    { name: 'Social mentions', color: '#9673e8', points: MENTIONS_BY_WEEK },
    { name: 'CRM complaints', color: '#45cdb9', points: CRM_BY_WEEK },
  ],
}

/** Residents of JVC, Arjan and Motor City, thousands, 2021–2026; the chart sums the three. */
const GROWTH_SIGNALS: FeedChart = {
  kind: 'line',
  label: 'Residents in JVC, Arjan and Motor City',
  total: TOTALS.population,
  delta: `+${TOTAL_GROWTH}% in 5 years`,
  axis: ['2021', '2022', '2023', '2024', '2025', '2026'],
  lines: AREA_LIST.map((area) => ({ name: area.short, color: '#9673e8', points: area.byYear })),
}

/** Spare sewerage capacity in each area against the 20% reserve planning keeps. */
const SEWER_HEADROOM: FeedChart = {
  kind: 'columns',
  label: 'Spare sewerage capacity',
  value: `${INFRASTRUCTURE_BRIEFING.spare[0].value}%`,
  unit: `left in ${INFRASTRUCTURE_BRIEFING.spare[0].label}`,
  delta: `${100 - INFRASTRUCTURE_BRIEFING.limit}% reserve required`,
  threshold: 100 - INFRASTRUCTURE_BRIEFING.limit,
  max: 30,
  columns: INFRASTRUCTURE_BRIEFING.spare.map((area) => ({ name: area.label, value: area.value })),
}

/** The Briefing findings: the Al Barsha odor on its parks, then the facilities and infrastructure growth has outrun in JVC, Arjan and Motor City. */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'odor',
    place: 'barsha',
    domain: 'Public Health',
    title: 'Odor complaints rising around Al Barsha’s parks',
    before: 'Negative social media posts reporting unpleasant odors near three parks in Al Barsha have increased by ',
    highlight: '64% over the past 30 days',
    after: ', alongside 118 CRM complaints recorded in the same area during the same period.',
    storyId: 'dm-odor',
    chart: ODOR_SIGNALS,
  },
  {
    id: 'urban-facilities',
    place: 'facilities',
    domain: 'Urban Planning',
    title: 'Families and workers are short of facilities in JVC, Arjan and Motor City',
    before: 'The three communities have grown ',
    highlight: `${TOTAL_GROWTH}% in five years`,
    after: ', mostly with families and workers, and their schools, clinics, nurseries and parks have not kept pace.',
    storyId: 'dm-facilities',
    chart: GROWTH_SIGNALS,
  },
  {
    id: 'urban-infrastructure',
    place: 'infrastructure',
    domain: 'Infrastructure',
    title: 'Infrastructure is falling behind growth in JVC, Arjan and Motor City',
    before: `${INFRASTRUCTURE_BRIEFING.over} of their ${INFRASTRUCTURE_BRIEFING.networks} sewerage, drainage, power and road networks are `,
    highlight: `past the ${INFRASTRUCTURE_BRIEFING.limit}% planning limit`,
    after: `, and ${INFRASTRUCTURE_BRIEFING.earlyHomes.toLocaleString('en-US')} pipeline homes complete before the upgrades they need.`,
    storyId: 'dm-infrastructure',
    chart: SEWER_HEADROOM,
  },
]
