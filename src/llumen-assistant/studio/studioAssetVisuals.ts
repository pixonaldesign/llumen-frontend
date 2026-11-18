const staging = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/studio/staging`

export type TableColumn = {
  label: string
  align?: 'start' | 'end'
  /** Set in the mono face, for figures that should line up. */
  mono?: boolean
}

export type KpiTone = 'positive' | 'warning' | 'negative' | 'neutral'

export type AnalyticsStat = { label: string; value: string; ratio?: number }

/** Asset visuals laid out as HTML rather than drawn as SVG charts; keyed by `StudioAsset` id. */
export type StudioVisual = { title: string } & (
  | { kind: 'table'; columns: TableColumn[]; rows: string[][] }
  | {
      kind: 'kpiGrid'
      tiles: { label: string; value: string; unit: string; status: string; tone: KpiTone }[]
      caption: string
    }
  | { kind: 'analytics'; model: string; layer: string; stats: AnalyticsStat[]; summary: string }
  | { kind: 'map'; src: string }
)

const map = (title: string, slug: string): StudioVisual => ({ kind: 'map', title, src: `${staging}/map-${slug}.jpg` })

export const STUDIO_ASSET_VISUALS: Record<string, StudioVisual> = {
  'worst-sections': {
    kind: 'table',
    title: 'Worst sections',
    columns: [
      { label: 'Rank', align: 'end', mono: true },
      { label: 'Section' },
      { label: 'Scenario' },
      { label: 'Delay (s)', align: 'end', mono: true },
    ],
    rows: [
      ['1', 'Section 218238', 'Weekday', '264.99'],
      ['2', 'Section 215007', 'Weekday', '227.88'],
      ['3', 'Section 215109', 'Weekday', '216.78'],
      ['4', 'Section 215738', 'Weekday', '139.98'],
      ['5', 'Section 214492', 'Weekday', '117.46'],
      ['1', 'Section 219981', 'Ramp Closure', '214.91'],
      ['2', 'Section 216548', 'Ramp Closure', '160.22'],
      ['3', 'Section 216050', 'Ramp Closure', '149.90'],
      ['4', 'Section 215323', 'Ramp Closure', '136.01'],
      ['5', 'Section 214365', 'Ramp Closure', '92.75'],
      ['1', 'Section 217520', '24h', '66.80'],
    ],
  },
  'scenario-summary': {
    kind: 'table',
    title: 'Scenario summary',
    columns: [
      { label: 'Scenario' },
      { label: 'Speed (km/h)', align: 'end', mono: true },
      { label: 'Delay (s/km)', align: 'end', mono: true },
      { label: 'Gridlocked', align: 'end', mono: true },
    ],
    rows: [
      ['Ramp Closure', '65.01', '23.69', '0'],
      ['Weekday', '65.31', '18.71', '0'],
      ['U-turns', '62.59', '22.67', '0'],
      ['24h', '77.42', '4.00', '0'],
    ],
  },
  'model-properties': {
    kind: 'table',
    title: 'About this model',
    columns: [{ label: 'Property' }, { label: 'Value', mono: true }],
    rows: [
      ['Model', 'Riaydh_King_Fadh.ang'],
      ['Package', 'kafd-riyadh-aimsun-llumen'],
      ['Package version', '2026-09-17'],
      ['Model date', '2026-01-01'],
      ['Source CRS', 'EPSG:32638'],
      ['Time zone', 'Asia/Riyadh'],
      ['Missing sentinel', '-1'],
    ],
  },
  'incident-status-grid': {
    kind: 'kpiGrid',
    title: 'Active Incidents Status',
    tiles: [
      { label: 'Total Active', value: '46', unit: 'incidents', status: 'Active', tone: 'neutral' },
      { label: 'Open', value: '16', unit: 'incidents', status: 'Warning', tone: 'warning' },
      { label: 'In Progress', value: '30', unit: 'incidents', status: 'Normal', tone: 'positive' },
    ],
    caption: '16 open, 30 in progress · 11 are critical or high priority',
  },
  'correspondence-status-grid': {
    kind: 'kpiGrid',
    title: 'Correspondence Status',
    tiles: [
      { label: 'Total', value: '1,800', unit: 'items', status: 'Normal', tone: 'positive' },
      { label: 'Pending', value: '267', unit: 'items', status: 'Warning', tone: 'warning' },
      { label: 'Overdue', value: '146', unit: 'items', status: 'Critical', tone: 'negative' },
    ],
    caption: '54.7% of pending items are overdue',
  },
  'travel-time-anomalies': {
    kind: 'analytics',
    title: 'Anomaly Detection · Travel Time Fences',
    model: 'Anomaly Detection',
    layer: 'Travel Time Fences Map Visualization 2',
    stats: [
      { label: 'Anomalies', value: '383', ratio: 0.05 },
      { label: 'Anomaly %', value: '5.0%', ratio: 0.05 },
      { label: 'Max LOF', value: '3.87' },
      { label: 'Points', value: '7,656', ratio: 1 },
    ],
    summary:
      'The 60 most extreme anomalies render as amber-to-red spikes. The most extreme point’s local density is 3.5× lower than the rest of the dataset.',
  },
  'junction-clusters': {
    kind: 'analytics',
    title: 'Spatial Clustering · Abu Dhabi Junction Points',
    model: 'DBSCAN Clustering',
    layer: 'Abu Dhabi Junction Points',
    stats: [
      { label: 'Clusters', value: '39' },
      { label: 'Clustered', value: '500', ratio: 0.83 },
      { label: 'Noise', value: '99', ratio: 0.17 },
      { label: 'Points', value: '599', ratio: 1 },
    ],
    summary:
      'The largest cluster anchors 56 points (11% of clustered points); 99 points stand alone as spatial noise.',
  },
  'bus-stops': map('Abu Dhabi Bus Stop Locations', 'points'),
  'district-boundaries': map('Abu Dhabi districts (boundaries)', 'area'),
  'monitored-junctions': map('Abu Dhabi Monitored Junctions', 'discs'),
  'kafd-section-delay': map('KAFD run 2 · section delay', 'fences'),
  'incident-density': map('Incident Density Heatmap by Location', 'heatmap'),
  'dust-forecast': map('Dust forecast, PM10 and PM2.5 (µg/m³), hourly — Gulf', 'heatmap-field'),
  'shared-housing': map('Shared Housing by Type', 'pillars'),
  'rail-zone-flows': map('Qatar Rail — Zone to station flows by hour', 'arcs'),
  'wind-forecast': map('Hourly Wind Speed and Direction Map', 'wind'),
}
