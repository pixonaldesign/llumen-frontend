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

/** Residents by age group, in thousands, 2016–2025. */
const POPULATION: FeedChart = {
  kind: 'line',
  label: 'Population',
  total: 2500000,
  delta: '+22% since 2016',
  axis: ['2016', '2019', '2022', '2025'],
  lines: [
    {
      name: 'Adults (20-59)',
      color: '#3fd2c7',
      points: [1390, 1430, 1470, 1500, 1520, 1550, 1590, 1630, 1670, 1700],
    },
    {
      name: 'Youth (0-19)',
      color: '#a6e06f',
      points: [560, 575, 590, 600, 610, 620, 635, 650, 662, 675],
    },
    {
      name: 'Seniors (60+)',
      color: '#ff9f5a',
      points: [70, 76, 82, 88, 94, 100, 106, 112, 118, 125],
    },
  ],
}

const LAND_USE: FeedChart = {
  kind: 'bar',
  label: 'Land use',
  value: '100%',
  series: [
    { name: 'Residential', value: '42%', pct: 42, color: '#3fa7a0' },
    { name: 'Industrial', value: '31%', pct: 31, color: '#9bbf6a' },
    { name: 'Open space', value: '27%', pct: 27, color: '#c56b3c' },
  ],
}

/** Overnight minimum on the eastern trunk main, in bar, by Al Ain district. */
const NETWORK_PRESSURE: FeedChart = {
  kind: 'columns',
  label: 'Lowest overnight pressure, eastern trunk main',
  value: '1.6',
  unit: 'bar',
  delta: '4 districts below 2 bar',
  threshold: 2,
  max: 3.4,
  columns: [
    { name: 'Hili', value: 2.6 },
    { name: 'Al Jimi', value: 1.8 },
    { name: 'Al Muwaiji', value: 1.6 },
    { name: 'Zakher', value: 2.4 },
    { name: 'Al Towayya', value: 1.7 },
    { name: 'Al Khabisi', value: 2.9 },
    { name: 'Falaj Hazza', value: 1.9 },
    { name: 'Al Mutaredh', value: 2.7 },
  ],
}

/** The Briefing findings. Each map stop (its own place and palette) is followed by one or more blurred ones. */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'abu-dhabi',
    place: 'abu-dhabi',
    domain: 'Operations',
    title: 'Island Bus Reliability Brief',
    before: 'Morning arrivals on the island bus routes are ',
    highlight: 'running 12 minutes late',
    after: ', led by Routes 54 and 65.',
    storyId: 'r1',
  },
  {
    id: 'proactive-ai',
    domain: 'Customer Success',
    title: 'Proactive Risk Digest',
    before: 'A cluster of 38 complaints in MBZ City usually precedes ',
    highlight: 'service-center delays of 40 minutes',
    after: '.',
  },
  {
    id: 'land-use',
    place: 'mussafah',
    domain: 'Planning',
    title: 'Industrial growth in Al Mussafah',
    before: 'After 14 new warehouse permits, industrial parcels are ',
    highlight: 'outpacing open space',
    after: ' in Al Mussafah.',
  },
  {
    id: 'land-use-mix',
    domain: 'Planning',
    title: 'Land use mix',
    before: 'Residential still leads Al Mussafah at 42%, but open space has ',
    highlight: 'shrunk to 27%',
    after: '.',
    chart: LAND_USE,
  },
  {
    id: 'population',
    domain: 'Operations',
    title: 'Population composition across the capital',
    before: 'Working-age residents make up two thirds of the capital, while the youth share is ',
    highlight: 'holding at 27%',
    after: '.',
    chart: POPULATION,
  },
  {
    id: 'dubai',
    place: 'dubai',
    domain: 'Operations',
    title: 'Coastal corridor air quality',
    before: 'Coastal fine particulates are ',
    highlight: 'up 18% overnight',
    after: ', with three districts past the sensitive-group line.',
    storyId: 'r2',
  },
  {
    id: 'heat-stress',
    domain: 'Operations',
    title: 'Coastal Heat Stress Advisory',
    before: 'With corniche nights above 32°C for a third week, heat-related clinic visits are ',
    highlight: 'up 22%',
    after: '.',
  },
  {
    id: 'al-ain',
    place: 'al-ain',
    domain: 'Environment',
    title: 'Al Ain station cluster',
    before: 'Al Ain is quieter than the coast, with illegal dumping reports ',
    highlight: 'down 12% this week',
    after: '.',
    storyId: 'r4',
  },
  {
    id: 'water-network',
    domain: 'Engineering',
    title: 'Water Network Pressure Review',
    before: 'Pressure drops in four Al Ain districts usually precede ',
    highlight: 'service interruptions of 4–6 hours',
    after: '.',
    chart: NETWORK_PRESSURE,
  },
]
