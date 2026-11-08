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

/** Fuel each of the network's stations sold this year, million litres; under 6.0M misses target. */
const NETWORK_VOLUME: FeedChart = {
  kind: 'columns',
  label: 'Fuel sold by station, this year',
  value: '6.2',
  unit: 'M litres on average',
  delta: '3 stations below target',
  threshold: 6,
  max: 8,
  columns: [
    { name: 'Al Wahda', value: 7.1 },
    { name: 'Khalidiyah Park', value: 6.8 },
    { name: 'Tourist Club', value: 6.4 },
    { name: 'Mushrif Park', value: 6.3 },
    { name: 'Al Danah', value: 6.0 },
    { name: 'Bateen Marina', value: 5.9 },
    { name: 'Nahyan Camp', value: 5.7 },
    { name: 'Karamah Square', value: 5.4 },
  ],
}

/** What forecourt visits between 5 and 9pm include, across the network. */
const EVENING_BASKET: FeedChart = {
  kind: 'bar',
  label: 'Forecourt visits, 5–9pm · 412k this quarter',
  value: '46% buy in store',
  series: [
    { name: 'Fuel only', value: '54%', pct: 54, color: '#6a9ef3' },
    { name: 'Fuel and shop', value: '34%', pct: 34, color: '#45cdb9' },
    { name: 'Shop only', value: '12%', pct: 12, color: '#b899f5' },
  ],
}

/**
 * The Briefing findings: the evening corridor and the island's candidate sites on the night map, each
 * with its story, alternating with the network's own figures over the blurred map.
 */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'evening-corridor',
    place: 'corridor',
    domain: 'Demand Patterns',
    title: 'Evenings reshape the shortlist',
    before: 'Between 5 and 9pm, ',
    highlight: '38% of the day’s traffic',
    after: ' on Sheikh Rashid Bin Saeed St passes Al Markaziyah, lifting it from fourth to third.',
    storyId: 'tt-evening',
  },
  {
    id: 'network-volume',
    domain: 'Network Performance',
    title: 'Three stations miss their volume target',
    before: 'Three of your eight stations sold under ',
    highlight: '6.0M litres',
    after: ' this year, each facing a rival that opened within 1 km of it.',
    chart: NETWORK_VOLUME,
    tellMore: false,
  },
  {
    id: 'shortlist',
    place: 'zahiyah',
    domain: 'Site Selection',
    title: 'World Trade Center tops 12 candidate sites',
    before: 'Of 12 candidate sites on Abu Dhabi Island, World Trade Center on Sheikh Rashid Bin Saeed St scores ',
    highlight: '87 of 100',
    after: ' and would sell 58% more fuel than your average station.',
    storyId: 'tt-shortlist',
  },
  {
    id: 'evening-basket',
    domain: 'Customer Behaviour',
    title: 'Evening visits lean on the shop',
    before: 'From 5 to 9pm, ',
    highlight: '46% of forecourt visits',
    after: ' include a shop purchase, against 28% in the morning.',
    chart: EVENING_BASKET,
    tellMore: false,
  },
]
