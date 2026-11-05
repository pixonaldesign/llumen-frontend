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

/** Dubai residential sales by year, in thousands of transactions, 2016–2025. */
const TRANSACTIONS: FeedChart = {
  kind: 'line',
  label: 'Dubai residential transactions',
  total: 169000,
  delta: 'Off-plan 61% of 2025',
  axis: ['2016', '2019', '2022', '2025'],
  lines: [
    {
      name: 'Off-plan',
      color: '#9673e8',
      points: [12, 13, 14, 13, 12, 22, 38, 52, 68, 103],
    },
    {
      name: 'Ready',
      color: '#45cdb9',
      points: [33, 34, 32, 28, 23, 62, 60, 64, 72, 66],
    },
  ],
}

/** The Briefing findings: Downtown's two towers on the night map, then the city's sales mix over the blurred map. */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'downtown-towers',
    place: 'downtown',
    domain: 'Real Estate',
    title: 'Downtown off-plan sales concentrate in two towers',
    before: 'Two Downtown towers took ',
    highlight: 'AED 6.1bn',
    after: ' of off-plan sales this quarter, 38% of the district’s AED 16.0bn.',
    storyId: 're-downtown',
  },
  {
    id: 'transactions',
    domain: 'Real Estate',
    title: 'Off-plan overtakes ready homes',
    before: 'Dubai closed 169,000 residential sales in 2025, and off-plan homes are now ',
    highlight: '61% of the market',
    after: ', up from a third in 2020.',
    chart: TRANSACTIONS,
    tellMore: false,
  },
]
