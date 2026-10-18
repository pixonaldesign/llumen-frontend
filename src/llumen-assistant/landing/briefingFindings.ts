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
    after:
      ' against the published timetable this week, with Routes 54 and 65 driving most of the delay as roadworks on Al Salam Street slow the 7–9 am peak.',
    storyId: 'r1',
  },
  {
    id: 'proactive-ai',
    domain: 'Customer Success',
    title: 'Proactive Risk Digest',
    before:
      'Llumen flagged a cluster of 38 billing and connection complaints in MBZ City since Sunday, a pattern that typically precedes ',
    highlight: 'service-center delays of 40 minutes',
    after: ' within 72 hours unless extra agents are scheduled for the weekend shift.',
  },
  {
    id: 'land-use',
    place: 'mussafah',
    domain: 'Planning',
    title: 'Industrial growth in Al Mussafah',
    before:
      'Industrial parcels in Al Mussafah now cover nearly a third of the monitored belt after 14 new warehouse permits this year, ',
    highlight: 'outpacing open space',
    after: ' along the southern approach roads and pushing heavy-vehicle traffic closer to residential blocks.',
  },
  {
    id: 'land-use-mix',
    domain: 'Planning',
    title: 'Land use mix',
    before: 'Residential blocks still hold the largest share of Al Mussafah at 42%, but open space has ',
    highlight: 'shrunk to 27%',
    after:
      ', leaving the thinnest green buffer between the 31% industrial belt and the homes beside it since monitoring began.',
    chart: LAND_USE,
  },
  {
    id: 'population',
    domain: 'Operations',
    title: 'Population composition across the capital',
    before: 'Working-age residents still make up more than two thirds of the capital, while the youth share is ',
    highlight: 'holding at 27%',
    after: ' of the recorded population, keeping school-run and family-service demand steady in the newer suburbs.',
    chart: POPULATION,
  },
  {
    id: 'dubai',
    place: 'dubai',
    domain: 'Operations',
    title: 'Coastal corridor air quality',
    before: 'Fine particulate readings along the coastal corridor are ',
    highlight: 'up 18% overnight',
    after:
      ', with three districts crossing the sensitive-group threshold as low winds trapped port and traffic emissions close to the shoreline.',
    storyId: 'r2',
  },
  {
    id: 'heat-stress',
    domain: 'Operations',
    title: 'Coastal Heat Stress Advisory',
    before:
      'Night-time temperatures along the corniche stayed above 32°C for a third consecutive week, with heat-related clinic visits ',
    highlight: 'up 22%',
    after: ' versus the seasonal baseline, mostly outdoor workers and residents over 60 in older housing blocks.',
  },
  {
    id: 'al-ain',
    place: 'al-ain',
    domain: 'Environment',
    title: 'Al Ain station cluster',
    before:
      'Inland monitoring stations around Al Ain show a quieter profile than the coast, with illegal dumping reports ',
    highlight: 'down 12% this week',
    after: ' after the new patrol schedule and camera coverage at the three busiest desert access roads.',
    storyId: 'r4',
  },
  {
    id: 'water-network',
    domain: 'Engineering',
    title: 'Water Network Pressure Review',
    before:
      'Four districts in Al Ain recorded overnight pressure drops below 2 bar on the eastern trunk main, a pattern that typically precedes ',
    highlight: 'service interruptions of 4–6 hours',
    after: ' within the next 48 hours if the valve inspection is not moved forward.',
    chart: NETWORK_PRESSURE,
  },
]
