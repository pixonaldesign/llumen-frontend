import type { AssetPreview, DataRecord } from './nodeCatalog'

/*
 * The workspace the builder runs against: sources, saved assets, and registered models. Rows are
 * fixed so a run gives the same answer every time.
 */

/** Deterministic noise in [-1, 1) from a seed. */
const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits))

export const SITES: readonly DataRecord[] = [
  { site: 'Mussafah M-14', district: 'Mussafah', permit_status: 'expired', risk: 0.91, anomalies: 14, flagged: true, lat: 24.352, lng: 54.488 },
  { site: 'ICAD II Yard 3', district: 'ICAD', permit_status: 'expired', risk: 0.84, anomalies: 11, flagged: true, lat: 24.318, lng: 54.532 },
  { site: 'Khalifa Port K2', district: 'Khalifa', permit_status: 'active', risk: 0.77, anomalies: 9, flagged: true, lat: 24.389, lng: 54.437 },
  { site: 'Al Mafraq East', district: 'Mafraq', permit_status: 'expired', risk: 0.62, anomalies: 7, flagged: false, lat: 24.297, lng: 54.526 },
  { site: 'Shahama Depot', district: 'Shahama', permit_status: 'active', risk: 0.48, anomalies: 6, flagged: false, lat: 24.402, lng: 54.412 },
]

const STATIONS = [
  { station: 'Mussafah AQ-1', district: 'Mussafah', base: 92, trend: 1.7 },
  { station: 'ICAD AQ-2', district: 'ICAD', base: 78, trend: 0.4 },
  { station: 'Khalifa Port AQ-3', district: 'Khalifa', base: 64, trend: -0.2 },
  { station: 'Shahama AQ-4', district: 'Shahama', base: 51, trend: 0.1 },
] as const

const READING_DAYS = 28
const FIRST_READING = Date.UTC(2026, 8, 22)
export const DAY_MS = 86_400_000
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Daily PM10 per station; Mussafah climbs steadily, which is what the forecast picks up. */
export const SENSOR_READINGS: readonly DataRecord[] = STATIONS.flatMap((station, stationIndex) =>
  Array.from({ length: READING_DAYS }, (_, day) => {
    const weekly = Math.sin((day / 7) * Math.PI * 2) * 6
    const seed = stationIndex * 100 + day
    return {
      station: station.station,
      district: station.district,
      reading_date: isoDay(FIRST_READING + day * DAY_MS),
      pm10: round(station.base + station.trend * day + weekly + noise(seed) * 5),
      wind_speed: round(4 + noise(seed + 7) * 2.5 + 2),
      wind_direction: Math.round(300 + noise(seed + 13) * 40),
    }
  }),
)

const PERMITS: readonly DataRecord[] = SITES.map((site, index) => ({
  permit_id: `PRM-${2041 + index * 7}`,
  site: site.site,
  district: site.district,
  status: site.permit_status,
  expires_on: isoDay(Date.UTC(2026, 6 + index, 1 + index * 3)),
}))

const LAND_USE: readonly DataRecord[] = [
  { zone: 'Mussafah Industrial', land_type: 'Industrial', area_km2: 42.6, lat: 24.348, lng: 54.493 },
  { zone: 'ICAD I–III', land_type: 'Industrial', area_km2: 31.2, lat: 24.321, lng: 54.538 },
  { zone: 'Khalifa Port', land_type: 'Port', area_km2: 18.4, lat: 24.385, lng: 54.441 },
  { zone: 'Al Mafraq', land_type: 'Residential', area_km2: 12.9, lat: 24.291, lng: 54.521 },
  { zone: 'Al Shahama', land_type: 'Residential', area_km2: 22.7, lat: 24.405, lng: 54.418 },
  { zone: 'Al Wathba Reserve', land_type: 'Open land', area_km2: 5.1, lat: 24.262, lng: 54.611 },
]

const WIND_FIELD: readonly DataRecord[] = STATIONS.map((station, index) => ({
  station: station.station,
  ws: round(5.4 + noise(index + 40) * 1.8),
  wd: Math.round(310 + noise(index + 50) * 25),
  lat: SITES[index].lat,
  lng: SITES[index].lng,
}))

const MONTHLY_ANOMALIES: readonly DataRecord[] = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].flatMap((month, monthIndex) =>
  ['Mussafah', 'ICAD', 'Khalifa'].map((district, districtIndex) => ({
    month,
    district,
    anomalies: Math.round(6 + monthIndex * (3 - districtIndex) + noise(monthIndex * 10 + districtIndex) * 2),
  })),
)

const INSPECTIONS: readonly DataRecord[] = SITES.map((site, index) => ({
  inspection_id: `INS-${880 + index}`,
  site: site.site,
  inspector: ['R. Haddad', 'L. Osei', 'M. Farouk'][index % 3],
  inspected_on: isoDay(Date.UTC(2026, 9, 2 + index * 2)),
  score: Math.round(92 - Number(site.risk) * 50),
  finding: Number(site.risk) > 0.7 ? 'Soil staining near drainage' : 'No visible contamination',
}))

const INSPECTORS: readonly DataRecord[] = [
  { inspector: 'R. Haddad', team: 'North', open_cases: 4 },
  { inspector: 'L. Osei', team: 'Central', open_cases: 6 },
  { inspector: 'M. Farouk', team: 'South', open_cases: 2 },
]

const EMISSIONS: readonly DataRecord[] = ['Mussafah Steel', 'ICAD Cement', 'Khalifa Bulk Terminal'].flatMap((facility, index) =>
  Array.from({ length: 7 }, (_, day) => ({
    facility,
    day: isoDay(Date.UTC(2026, 9, 13 + day)),
    co2_tons: round(120 - index * 30 + noise(index * 20 + day) * 12),
    nox_kg: round(840 - index * 190 + noise(index * 30 + day) * 60),
  })),
)

const STATIONS_LATEST: readonly DataRecord[] = STATIONS.map((station, index) => {
  const last = SENSOR_READINGS.filter((row) => row.station === station.station).at(-1) ?? {}
  return { station: station.station, pm10: last.pm10 ?? null, aqi: Math.round(Number(last.pm10 ?? 0) * 0.9), updated_at: '2026-10-20T08:00:00Z', online: index !== 3 }
})

const AQ_ALERTS: readonly DataRecord[] = [
  { alert_id: 'AQ-311', station: 'Mussafah AQ-1', level: 'amber', message: 'PM10 above 120 µg/m³ for 3 hours', issued_at: '2026-10-19T14:00:00Z' },
]

const TRAFFIC_SEGMENTS: readonly DataRecord[] = [
  { road: 'E10 Sheikh Zayed Bridge', current_speed: 41, free_flow_speed: 100, confidence: 0.94 },
  { road: 'E11 Mussafah', current_speed: 63, free_flow_speed: 120, confidence: 0.91 },
  { road: 'E20 Airport Road', current_speed: 88, free_flow_speed: 100, confidence: 0.97 },
]

/* ---------- Sources ---------- */

/** The five source buckets, one card each in the Source node. */
export type SourceMode = 'query' | 'api_request' | 'file' | 'dataflow' | 'marketplace'

export type ApiEndpoint = { id: string; name: string; method: 'GET' | 'POST'; path: string; rows: readonly DataRecord[] }
export type MarketplaceOperation = { id: string; label: string; parameters: readonly { key: string; label: string; placeholder: string }[]; rows: readonly DataRecord[] }

export type DataSource = {
  id: string
  name: string
  mode: SourceMode
  /** Shown under the name, e.g. the database engine. */
  detail: string
  tables?: Readonly<Record<string, readonly DataRecord[]>>
  endpoints?: readonly ApiEndpoint[]
  sheets?: Readonly<Record<string, readonly DataRecord[]>>
  datasets?: readonly { id: string; name: string; rows: readonly DataRecord[] }[]
  operations?: readonly MarketplaceOperation[]
}

export const SOURCES: readonly DataSource[] = [
  {
    id: 'src_envdb',
    name: 'Environment DB',
    mode: 'query',
    detail: 'PostgreSQL',
    tables: { sites: SITES, sensor_readings: SENSOR_READINGS, permits: PERMITS },
  },
  {
    id: 'src_aq_api',
    name: 'Air quality API',
    mode: 'api_request',
    detail: 'REST · api.airwatch.ae',
    endpoints: [
      { id: 'latest', name: 'Latest station readings', method: 'GET', path: '/v1/stations/latest', rows: STATIONS_LATEST },
      { id: 'alerts', name: 'Air quality alerts', method: 'GET', path: '/v1/alerts', rows: AQ_ALERTS },
    ],
  },
  { id: 'src_inspections', name: 'Field inspections.xlsx', mode: 'file', detail: 'Excel · 2 sheets', sheets: { Inspections: INSPECTIONS, Inspectors: INSPECTORS } },
  {
    id: 'src_emissions',
    name: 'Daily emissions',
    mode: 'dataflow',
    detail: 'ETL Flow',
    datasets: [{ id: 'ds_emissions_daily', name: 'Emissions by facility · daily', rows: EMISSIONS }],
  },
  {
    id: 'src_tomtom',
    name: 'TomTom Traffic',
    mode: 'marketplace',
    detail: 'Marketplace',
    operations: [
      {
        id: 'flow_segments',
        label: 'Flow segments',
        parameters: [{ key: 'area', label: 'Area', placeholder: 'e.g. Abu Dhabi island' }],
        rows: TRAFFIC_SEGMENTS,
      },
    ],
  },
]

export const SOURCES_BY_ID: Readonly<Record<string, DataSource>> = Object.fromEntries(SOURCES.map((source) => [source.id, source]))

/* ---------- Saved assets ---------- */

/** How an asset draws: a Create Asset chart type and mapping, so a saved asset looks like the one a run makes. */
export type AssetView = {
  chartType: string
  mapping?: Readonly<Record<string, string>>
  /** The figure's caption on a line or area chart, e.g. "Active anomalies". */
  label?: string
}

export type SavedAsset = {
  id: string
  name: string
  view: AssetView
  /** e.g. "Points layer" or "Line chart". */
  detail: string
  rows: readonly DataRecord[]
  /** Archived assets still run; the node shows an amber alert. */
  archived?: boolean
}

const MUSSAFAH_PM10: readonly DataRecord[] = SENSOR_READINGS.filter((row) => row.station === 'Mussafah AQ-1').map(({ reading_date, pm10 }) => ({ reading_date, pm10 }))

const WEEKLY_EMISSIONS: readonly DataRecord[] = [...new Set(EMISSIONS.map((row) => String(row.facility)))].map((facility) => {
  const days = EMISSIONS.filter((row) => row.facility === facility)
  return { facility, co2_tons: round(days.reduce((sum, row) => sum + Number(row.co2_tons), 0)), days: days.length }
})

export const SAVED_ASSETS: readonly SavedAsset[] = [
  { id: 'ast_sites', name: 'High Risk Contaminated Sites', view: { chartType: 'map:points', mapping: { value: 'risk' } }, detail: 'Points layer', rows: SITES },
  {
    id: 'ast_anomalies',
    name: 'Detected Contamination Anomalies',
    view: { chartType: 'line', mapping: { x: 'month', y: 'anomalies' }, label: 'Active anomalies' },
    detail: 'Line chart',
    rows: MONTHLY_ANOMALIES,
  },
  { id: 'ast_land', name: 'Abu Dhabi land use', view: { chartType: 'map:area', mapping: { category: 'land_type', value: 'area_km2' } }, detail: 'Area layer', rows: LAND_USE },
  { id: 'ast_wind', name: 'Wind at monitoring stations', view: { chartType: 'map:wind', mapping: { direction: 'wd', speed: 'ws' } }, detail: 'Wind layer', rows: WIND_FIELD },
  {
    id: 'ast_pm10_mussafah',
    name: 'PM10 at Mussafah AQ-1',
    view: { chartType: 'area', mapping: { x: 'reading_date', y: 'pm10' }, label: 'PM10 µg/m³' },
    detail: 'Area chart',
    rows: MUSSAFAH_PM10,
  },
  { id: 'ast_emissions', name: 'CO₂ by facility this week', view: { chartType: 'bar', mapping: { x: 'facility', y: 'co2_tons' }, label: 'tonnes of CO₂' }, detail: 'Bar chart', rows: WEEKLY_EMISSIONS },
  { id: 'ast_permits', name: 'Permit register', view: { chartType: 'table' }, detail: 'Table', rows: PERMITS },
  { id: 'ast_inspections', name: 'Field inspections', view: { chartType: 'table' }, detail: 'Table', rows: INSPECTIONS },
  { id: 'ast_permits_2025', name: 'Permit backlog 2025', view: { chartType: 'table' }, detail: 'Table', rows: PERMITS, archived: true },
]

export const previewOf = (chartType: string): AssetPreview => (chartType.startsWith('map:') ? 'map' : chartType === 'table' ? 'table' : 'chart')

export const ASSETS_BY_ID: Readonly<Record<string, SavedAsset>> = Object.fromEntries(SAVED_ASSETS.map((asset) => [asset.id, asset]))

/* ---------- Registered ML models ---------- */

export type MlModel = {
  id: string
  name: string
  version: string
  features: readonly string[]
  /** Weights over the features, in order, and the decision threshold. */
  weights: readonly number[]
  bias: number
  labels: readonly [low: string, high: string]
}

export const ML_MODELS: readonly MlModel[] = [
  { id: 'mdl_risk', name: 'Contamination risk classifier', version: 'v3', features: ['anomalies', 'risk'], weights: [0.32, 6], bias: -8, labels: ['routine', 'inspect'] },
  { id: 'mdl_pm10', name: 'PM10 exceedance model', version: 'v1', features: ['pm10', 'wind_speed'], weights: [0.09, -0.45], bias: -7.5, labels: ['below limit', 'exceeds limit'] },
]

export const ML_MODELS_BY_ID: Readonly<Record<string, MlModel>> = Object.fromEntries(ML_MODELS.map((model) => [model.id, model]))

/* ---------- Standard limits ---------- */

/** A published limit for a measure, over the averaging period it's defined for; a value at or above it breaches it. */
export type MeasureLimit = { label: string; unit: string; limit: number; grain: 'hour' | 'day'; basis: string }

/** Ambient air limits by column name: UAE national standards (Cabinet Resolution 12 of 2006), US EPA where the UAE sets none. */
export const MEASURE_LIMITS: Readonly<Record<string, MeasureLimit>> = {
  pm10: { label: 'PM10', unit: 'µg/m³', limit: 150, grain: 'day', basis: 'UAE 24-hour standard' },
  pm2_5: { label: 'PM2.5', unit: 'µg/m³', limit: 35, grain: 'day', basis: 'US EPA 24-hour standard' },
  no2: { label: 'NO₂', unit: 'µg/m³', limit: 150, grain: 'day', basis: 'UAE 24-hour standard' },
  so2: { label: 'SO₂', unit: 'µg/m³', limit: 150, grain: 'day', basis: 'UAE 24-hour standard' },
  o3: { label: 'O₃', unit: 'µg/m³', limit: 200, grain: 'hour', basis: 'UAE 1-hour standard' },
}

/** Share of a limit from which a value is worth watching. */
export const LIMIT_WATCH = 0.8

export const measureLimit = (column: string | undefined) => (column ? MEASURE_LIMITS[column.toLowerCase().replace(/[.\s]/g, '_')] : undefined)

export const TIMEZONES: readonly string[] = [
  'UTC',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
]

/** Rows the fixture editor starts from when nothing upstream has run. */
export const SAMPLE_ROWS: readonly DataRecord[] = SITES
