export type StoryPollutant = {
  name: string
  value: string
  unit: string
  status: 'normal' | 'critical'
}

export type StorySlide = {
  id: string
  title: string
  finding: string
  body: string
  aqi: number
  aqiLabel: string
  pollutants: StoryPollutant[]
}

export type LandingStory = {
  id: string
  category: string
  title: string
  kind: string
  sectionsLabel: string
  storyTitle: string
  filters: { id: string; label: string; removable?: boolean }[]
  slides: StorySlide[]
}

const DEFAULT_POLLUTANTS: StoryPollutant[] = [
  { name: 'SO2', value: '11', unit: 'ug/m3', status: 'normal' },
  { name: 'NO2', value: '430', unit: 'ug/m3', status: 'critical' },
  { name: 'CO', value: '0.4', unit: 'mg/m3', status: 'normal' },
  { name: 'O3', value: '15', unit: 'ug/m3', status: 'normal' },
  { name: 'PM10', value: '100', unit: 'ug/m3', status: 'normal' },
  { name: 'PM2.5', value: '70', unit: 'ug/m3', status: 'critical' },
  { name: 'H2S', value: '41', unit: 'ug/m3', status: 'normal' },
  { name: 'Benzene', value: '1.8', unit: 'ug/m3', status: 'normal' },
]

const FINDING =
  'AQI levels at these districts stations have stayed elevated over the past three months driven largely by NO2, which was has reportedly breached safe thresholds'

function makeSlides(prefix: string): StorySlide[] {
  return [
    {
      id: `${prefix}-1`,
      title: 'Top Emissions Districts Stations AQI',
      finding: FINDING,
      body: FINDING,
      aqi: 121,
      aqiLabel: 'Unhealthy for Sensitive Groups',
      pollutants: DEFAULT_POLLUTANTS,
    },
    {
      id: `${prefix}-2`,
      title: 'Corridor Heat Concentration',
      finding:
        'Heat intensity clusters along the Mussafah–ICAD industrial corridor, overlapping the highest NO2 readings from the prior quarter.',
      body: 'Industrial parcels adjacent to residential zones continue to drive elevated exposure windows during evening peak periods.',
      aqi: 138,
      aqiLabel: 'Unhealthy for Sensitive Groups',
      pollutants: DEFAULT_POLLUTANTS,
    },
    {
      id: `${prefix}-3`,
      title: 'Vehicle Idle Hotspots',
      finding:
        'Idling vehicle clusters coincide with elevated PM2.5 pockets near port approach roads during morning freight windows.',
      body: 'Active fleet density remains high, but idle dwell time is the stronger local predictor for short-term AQI spikes.',
      aqi: 112,
      aqiLabel: 'Unhealthy for Sensitive Groups',
      pollutants: DEFAULT_POLLUTANTS,
    },
  ]
}

/** Demo stories opened from Recommended For you cards. */
export const LANDING_STORIES: LandingStory[] = [
  {
    id: 'r1',
    category: 'Engineering',
    title: 'Building a Scalable Microservices Architecture From the Ground Up',
    kind: 'Story',
    sectionsLabel: '19 Sections',
    storyTitle: 'Potential Risks',
    filters: [
      { id: 'loc', label: 'Abu Dhabi' },
      { id: 'year', label: '2025–2026' },
      { id: 'ssi', label: 'SSI', removable: true },
      { id: 'type', label: 'School type' },
      { id: 'gender', label: 'School Gender' },
      { id: 'level', label: 'School Level' },
    ],
    slides: makeSlides('r1'),
  },
]

export function getLandingStory(id: string): LandingStory {
  return LANDING_STORIES.find((s) => s.id === id) ?? {
    ...LANDING_STORIES[0],
    id,
    title: LANDING_STORIES[0].title,
  }
}
