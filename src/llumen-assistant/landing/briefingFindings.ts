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

/** The Briefing findings: the Al Barsha odor on its parks, then Dubai's growth pressure across the city. */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'odor',
    place: 'barsha',
    domain: 'Public Health',
    title: 'Odor complaints rising around Al Barsha’s parks',
    before: 'Negative posts about unpleasant odors near three Al Barsha parks are up ',
    highlight: '64% in 30 days',
    after: ', backed by 118 CRM complaints. Evening winds carry it to about 1,850 residents.',
    storyId: 'dm-odor',
    chart: ODOR_SIGNALS,
  },
  {
    id: 'urban-growth',
    place: 'dubai',
    domain: 'Urban Planning',
    title: 'Growth is outpacing capacity in five communities',
    before: 'JVC, Business Bay, Arjan, Motor City and Al Quoz are ',
    highlight: 'priority planning areas',
    after: ': fast growth, land-use drift and strained infrastructure and services overlap there.',
    storyId: 'dm-urban',
  },
]
