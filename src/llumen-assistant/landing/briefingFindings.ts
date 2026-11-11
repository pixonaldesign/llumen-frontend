import { FACILITIES_BRIEFING } from '../municipality/facilitiesScenario'
import { fmt, TOTAL_GROWTH } from '../municipality/growthAreas'
import { INFRASTRUCTURE_BRIEFING } from '../municipality/infrastructureScenario'
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

/** The Briefing findings: the Al Barsha odor on its parks, then the facilities and infrastructure growth has outrun in JVC, Arjan and Motor City. */
export const FEED_STOPS: FeedStop[] = [
  {
    id: 'odor',
    place: 'barsha',
    domain: 'Public Health',
    title: 'Odor complaints rising around Al Barsha’s parks',
    before: 'Negative posts about odors near three Al Barsha parks rose ',
    highlight: '14% in 7 days',
    after: ', with 20 CRM complaints, likely from recycled irrigation water that fails its quality limits.',
    storyId: 'dm-odor',
  },
  {
    id: 'urban-facilities',
    place: 'facilities',
    domain: 'Urban Planning',
    title: 'Families and workers are short of facilities in JVC, Arjan and Motor City',
    before: 'JVC, Arjan and Motor City grew ',
    highlight: `${TOTAL_GROWTH}% in five years`,
    after: `, but their schools, clinics and parks were planned for ${fmt(FACILITIES_BRIEFING.plannedFor * 1000)} residents, not the ${fmt(FACILITIES_BRIEFING.population)} living there today.`,
    storyId: 'dm-facilities',
  },
  {
    id: 'urban-infrastructure',
    place: 'infrastructure',
    domain: 'Infrastructure',
    title: 'Infrastructure is falling behind growth in JVC, Arjan and Motor City',
    before: `${INFRASTRUCTURE_BRIEFING.over} of ${INFRASTRUCTURE_BRIEFING.networks} networks in JVC, Arjan and Motor City are `,
    highlight: `past the ${INFRASTRUCTURE_BRIEFING.limit}% planning limit`,
    after: ', as five years of fast growth outran networks sized for far fewer residents.',
    storyId: 'dm-infrastructure',
  },
]
