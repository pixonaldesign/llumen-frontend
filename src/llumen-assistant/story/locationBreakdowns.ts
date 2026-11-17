import { STORY_LOCATION_TYPES, STORY_LOCATIONS, paddedOutline, type StoryLocationOption } from './storyAnnotations'

/** One level of a breakdown, e.g. ITC's districts or the US Census Bureau's ZIP codes. */
export type LocationLevel = {
  id: string
  label: string
  plural: string
  /** The level the list can be filtered by. */
  filterBy?: string
  /** Small areas snap their outline to the streets around them. */
  followsStreets?: boolean
}

/** How an authority divides its territory, and the areas it offers at each level. */
export type LocationBreakdown = {
  id: string
  /** Country or emirate the breakdown covers. */
  area: string
  /** The authority whose boundaries it uses. */
  source: string
  /** ISO country code, shown as the breakdown's badge. */
  code: string
  levels: LocationLevel[]
  locations: StoryLocationOption[]
  camera: { center: [number, number]; zoom: number }
}

type Place = {
  name: string
  at: [number, number]
  /** Outline radius in metres. */
  radiusM: number
  /** The parent's name, at the level above. */
  parent?: string
  label?: string
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function levelPlaces(breakdown: string, level: string, parentLevel: string | null, places: Place[]) {
  return places.map((place): StoryLocationOption => ({
    id: `${breakdown}-${level}-${slug(place.name)}`,
    name: place.name,
    label: place.label ?? place.name,
    kind: 'district',
    type: level,
    parent: place.parent && parentLevel ? `${breakdown}-${parentLevel}-${slug(place.parent)}` : null,
    polygon: paddedOutline([place.at], place.radiusM),
  }))
}

const ITC: LocationBreakdown = {
  id: 'itc',
  area: 'Abu Dhabi',
  source: 'ITC',
  code: 'AE',
  levels: STORY_LOCATION_TYPES.map((type) => ({
    ...type,
    followsStreets: type.id === 'district' || type.id === 'zone',
  })),
  locations: STORY_LOCATIONS,
  camera: { center: [54.425, 24.415], zoom: 10.35 },
}

const US_CENSUS: LocationBreakdown = {
  id: 'us-census',
  area: 'United States',
  source: 'US Census Bureau',
  code: 'US',
  levels: [
    { id: 'state', label: 'State', plural: 'States' },
    { id: 'county', label: 'County', plural: 'Counties', filterBy: 'state' },
    { id: 'city', label: 'City', plural: 'Cities', filterBy: 'state' },
    { id: 'zip', label: 'ZIP code', plural: 'ZIP codes', filterBy: 'county', followsStreets: true },
    { id: 'tract', label: 'Census tract', plural: 'Census tracts', filterBy: 'county', followsStreets: true },
  ],
  locations: [
    ...levelPlaces('us-census', 'state', null, [
      { name: 'California', at: [-119.4, 36.8], radiusM: 380_000 },
      { name: 'New Jersey', at: [-74.5, 40.1], radiusM: 95_000 },
      { name: 'New York', at: [-75.5, 42.9], radiusM: 240_000 },
    ]),
    ...levelPlaces('us-census', 'county', 'state', [
      { name: 'Bronx County', at: [-73.87, 40.85], radiusM: 7_000, parent: 'New York' },
      { name: 'Hudson County', at: [-74.07, 40.73], radiusM: 7_000, parent: 'New Jersey' },
      { name: 'Kings County', at: [-73.95, 40.65], radiusM: 9_000, parent: 'New York' },
      { name: 'Los Angeles County', at: [-118.23, 34.32], radiusM: 60_000, parent: 'California' },
      { name: 'New York County', at: [-73.97, 40.78], radiusM: 5_500, parent: 'New York' },
      { name: 'Queens County', at: [-73.8, 40.71], radiusM: 11_000, parent: 'New York' },
      { name: 'Richmond County', at: [-74.15, 40.58], radiusM: 8_000, parent: 'New York' },
    ]),
    ...levelPlaces('us-census', 'city', 'state', [
      { name: 'Buffalo', at: [-78.88, 42.89], radiusM: 8_000, parent: 'New York' },
      { name: 'Jersey City', at: [-74.07, 40.72], radiusM: 5_000, parent: 'New Jersey' },
      { name: 'Los Angeles', at: [-118.24, 34.05], radiusM: 24_000, parent: 'California' },
      { name: 'New York City', at: [-73.94, 40.7], radiusM: 24_000, parent: 'New York' },
      { name: 'Newark', at: [-74.17, 40.73], radiusM: 6_000, parent: 'New Jersey' },
      { name: 'San Francisco', at: [-122.44, 37.76], radiusM: 7_000, parent: 'California' },
    ]),
    ...levelPlaces('us-census', 'zip', 'county', [
      { name: 'ZIP 07302', label: '07302', at: [-74.046, 40.72], radiusM: 900, parent: 'Hudson County' },
      { name: 'ZIP 10001', label: '10001', at: [-73.997, 40.75], radiusM: 800, parent: 'New York County' },
      { name: 'ZIP 10027', label: '10027', at: [-73.953, 40.812], radiusM: 800, parent: 'New York County' },
      { name: 'ZIP 10036', label: '10036', at: [-73.989, 40.759], radiusM: 600, parent: 'New York County' },
      { name: 'ZIP 10451', label: '10451', at: [-73.92, 40.82], radiusM: 900, parent: 'Bronx County' },
      { name: 'ZIP 11101', label: '11101', at: [-73.939, 40.747], radiusM: 1_000, parent: 'Queens County' },
      { name: 'ZIP 11201', label: '11201', at: [-73.99, 40.694], radiusM: 900, parent: 'Kings County' },
      { name: 'ZIP 11211', label: '11211', at: [-73.953, 40.712], radiusM: 1_000, parent: 'Kings County' },
      { name: 'ZIP 90012', label: '90012', at: [-118.239, 34.062], radiusM: 1_400, parent: 'Los Angeles County' },
    ]),
    ...levelPlaces('us-census', 'tract', 'county', [
      {
        name: 'Census Tract 7, Kings County',
        label: 'Tract 7',
        at: [-73.993, 40.699],
        radiusM: 450,
        parent: 'Kings County',
      },
      {
        name: 'Census Tract 76, New York County',
        label: 'Tract 76',
        at: [-73.985, 40.752],
        radiusM: 350,
        parent: 'New York County',
      },
      {
        name: 'Census Tract 201, New York County',
        label: 'Tract 201',
        at: [-73.95, 40.81],
        radiusM: 400,
        parent: 'New York County',
      },
      {
        name: 'Census Tract 557, Kings County',
        label: 'Tract 557',
        at: [-73.955, 40.715],
        radiusM: 450,
        parent: 'Kings County',
      },
      {
        name: 'Census Tract 2074, Los Angeles County',
        label: 'Tract 2074',
        at: [-118.243, 34.058],
        radiusM: 600,
        parent: 'Los Angeles County',
      },
    ]),
  ],
  camera: { center: [-73.96, 40.73], zoom: 10.2 },
}

const EG_CAPMAS: LocationBreakdown = {
  id: 'eg-capmas',
  area: 'Egypt',
  source: 'CAPMAS',
  code: 'EG',
  levels: [
    { id: 'governorate', label: 'Governorate', plural: 'Governorates' },
    { id: 'city', label: 'City', plural: 'Cities', filterBy: 'governorate' },
    { id: 'qism', label: 'District (Qism)', plural: 'Districts', filterBy: 'city', followsStreets: true },
    { id: 'shiakha', label: 'Shiakha', plural: 'Shiakhas', filterBy: 'qism', followsStreets: true },
  ],
  locations: [
    ...levelPlaces('eg-capmas', 'governorate', null, [
      { name: 'Alexandria', at: [29.95, 31.2], radiusM: 22_000 },
      { name: 'Cairo', at: [31.4, 30.05], radiusM: 25_000 },
      { name: 'Giza', at: [31.1, 29.98], radiusM: 30_000 },
    ]),
    ...levelPlaces('eg-capmas', 'city', 'governorate', [
      { name: '6th of October', at: [30.95, 29.95], radiusM: 11_000, parent: 'Giza' },
      { name: 'Alexandria City', at: [29.92, 31.2], radiusM: 14_000, parent: 'Alexandria' },
      { name: 'Cairo City', at: [31.25, 30.05], radiusM: 14_000, parent: 'Cairo' },
      { name: 'Giza City', at: [31.2, 30.01], radiusM: 8_000, parent: 'Giza' },
      { name: 'New Cairo', at: [31.47, 30.03], radiusM: 10_000, parent: 'Cairo' },
    ]),
    ...levelPlaces('eg-capmas', 'qism', 'city', [
      { name: 'Dokki', at: [31.21, 30.04], radiusM: 1_400, parent: 'Giza City' },
      { name: 'Fifth Settlement', at: [31.47, 30.01], radiusM: 4_000, parent: 'New Cairo' },
      { name: 'Haram', at: [31.15, 29.99], radiusM: 2_800, parent: 'Giza City' },
      { name: 'Heliopolis', at: [31.32, 30.09], radiusM: 2_800, parent: 'Cairo City' },
      { name: 'Maadi', at: [31.26, 29.96], radiusM: 2_800, parent: 'Cairo City' },
      { name: 'Montaza', at: [30.01, 31.28], radiusM: 3_500, parent: 'Alexandria City' },
      { name: 'Nasr City', at: [31.34, 30.06], radiusM: 3_800, parent: 'Cairo City' },
      { name: 'Qasr El Nil', at: [31.235, 30.045], radiusM: 1_400, parent: 'Cairo City' },
      { name: 'Sidi Gaber', at: [29.94, 31.22], radiusM: 1_800, parent: 'Alexandria City' },
      { name: 'Zamalek', at: [31.222, 30.062], radiusM: 700, parent: 'Cairo City' },
    ]),
    ...levelPlaces('eg-capmas', 'shiakha', 'qism', [
      { name: 'Degla', at: [31.268, 29.958], radiusM: 650, parent: 'Maadi' },
      { name: 'Garden City', at: [31.231, 30.037], radiusM: 550, parent: 'Qasr El Nil' },
      { name: 'Korba', at: [31.322, 30.091], radiusM: 550, parent: 'Heliopolis' },
      { name: 'Sarayat El Maadi', at: [31.257, 29.962], radiusM: 550, parent: 'Maadi' },
      { name: 'Tahrir', at: [31.236, 30.045], radiusM: 450, parent: 'Qasr El Nil' },
      { name: 'Zamalek North', at: [31.2205, 30.0665], radiusM: 320, parent: 'Zamalek' },
      { name: 'Zamalek South', at: [31.2235, 30.0565], radiusM: 320, parent: 'Zamalek' },
    ]),
  ],
  camera: { center: [31.28, 30.04], zoom: 10.4 },
}

export const LOCATION_BREAKDOWNS: LocationBreakdown[] = [ITC, US_CENSUS, EG_CAPMAS]

/** Remembered while the page is open, so the picker reopens on the last breakdown used. */
let lastBreakdownId = ITC.id

export function lastLocationBreakdown() {
  return LOCATION_BREAKDOWNS.find((breakdown) => breakdown.id === lastBreakdownId) ?? ITC
}

export function rememberLocationBreakdown(id: string) {
  lastBreakdownId = id
}
