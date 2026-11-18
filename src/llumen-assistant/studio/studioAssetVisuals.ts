const staging = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/studio/staging`

export type TableColumn = {
  label: string
  align?: 'start' | 'end'
  /** Set in the mono face, for figures that should line up. */
  mono?: boolean
  /** Values drawn as status chips, coloured by `STATUS_TONE`. */
  status?: boolean
}

/**
 * Main's data is local, so cards never really load or fail. `?studioState=loading | error | loading-list` forces
 * those states so they can be reviewed: `loading-list` is the asset list itself still loading.
 */
export const PREVIEW_STATE = new URLSearchParams(window.location.search).get('studioState')
export const PREVIEW_LIST_LOADING = PREVIEW_STATE === 'loading-list'

/** Tone of each status value the tables use; anything unlisted reads as neutral. */
export const STATUS_TONE: Record<string, StatusTone> = {
  Worse: 'negative',
  Better: 'positive',
  Major: 'negative',
  Moderate: 'warning',
  Urgent: 'negative',
  High: 'warning',
  Recommended: 'positive',
}

export type StatusTone = 'positive' | 'warning' | 'negative' | 'neutral'

/** Asset visuals laid out as HTML rather than drawn as SVG charts; keyed by `StudioAsset` id. */
export type StudioVisual = { title: string } & (
  | {
      kind: 'table'
      columns: TableColumn[]
      rows: string[][]
      /** The source's row count, when only its first rows are carried here. */
      total?: number
    }
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
  'emissions-by-vehicle-type': {
    kind: 'table',
    title: 'Emissions by vehicle type',
    columns: [
      { label: 'Vehicle class' },
      { label: 'Vehicles', align: 'end', mono: true },
      { label: 'CO₂ g/veh', align: 'end', mono: true },
      { label: 'NOx g/veh', align: 'end', mono: true },
      { label: 'PM g/veh', align: 'end', mono: true },
      { label: 'CO₂ kg', align: 'end', mono: true },
      { label: 'NOx g', align: 'end', mono: true },
      { label: 'PM g', align: 'end', mono: true },
    ],
    rows: [
      ['Bus', '30', '4,231.2', '33.83', '0.956', '126.9', '1,015', '28.7'],
      ['Car', '43,264', '275.1', '0.14', '0.008', '11,902', '6,160', '348.2'],
    ],
  },
  'run-worst-sections': {
    kind: 'table',
    title: 'Worst sections in the run',
    columns: [
      { label: 'Section' },
      { label: 'Delay s', align: 'end', mono: true },
      { label: 'Delay veh·h', align: 'end', mono: true },
      { label: 'Exited vehicles', align: 'end', mono: true },
      { label: 'Max queue', align: 'end', mono: true },
      { label: 'Lanes', align: 'end', mono: true },
      { label: 'Speed limit km/h', align: 'end', mono: true },
    ],
    rows: [
      ['Section 215966', '92.4', '2,665.4', '103,848', '128', '5', '120'],
      ['Section 215736', '43.0', '1,603.0', '134,270', '93', '4', '120'],
      ['Section 217430', '27.9', '1,046.0', '134,834', '52', '5', '120'],
      ['Section 214330', '27.0', '845.5', '112,944', '22', '4', '120'],
      ['Section 218613', '24.1', '756.7', '112,934', '36', '6', '120'],
      ['Section 217771', '16.9', '645.4', '137,276', '18', '7', '120'],
      ['Section 215749', '25.9', '540.2', '75,056', '272', '3', '100'],
      ['Section 215956', '11.1', '409.7', '133,448', '15', '5', '120'],
    ],
  },
  'ranked-comparison': {
    kind: 'table',
    title: 'Ranked comparison',
    total: 100,
    columns: [
      { label: '#', align: 'end', mono: true },
      { label: 'Section' },
      { label: 'Base', align: 'end', mono: true },
      { label: 'Alt', align: 'end', mono: true },
      { label: 'Δ', align: 'end', mono: true },
      { label: 'Presence' },
      { label: 'Status', status: true },
    ],
    rows: [
      ['1', 'Section 217116', '32.4', '44.7', '+12.3', 'Both', 'Worse'],
      ['2', 'Section 220947', '—', '0.4', '—', 'Alternative only', 'No data'],
      ['3', 'Section 221266', '—', '3.8', '—', 'Alternative only', 'No data'],
      ['4', 'Section 220802', '—', '6.6', '—', 'Alternative only', 'No data'],
      ['5', 'Section 221270', '—', '618', '—', 'Alternative only', 'No data'],
      ['6', 'Section 220810', '—', '577', '—', 'Alternative only', 'No data'],
      ['7', 'Section 221248', '—', '115', '—', 'Alternative only', 'No data'],
      ['8', 'Section 220974', '—', '173', '—', 'Alternative only', 'No data'],
      ['9', 'Section 221267', '—', '139', '—', 'Alternative only', 'No data'],
      ['10', 'Section 220559', '—', '0', '—', 'Alternative only', 'No data'],
      ['11', 'Section 220682', '—', '0', '—', 'Alternative only', 'No data'],
      ['12', 'Section 220455', '—', '0', '—', 'Alternative only', 'No data'],
    ],
  },
  'section-metrics': {
    kind: 'table',
    title: 'All metrics for this section',
    total: 100,
    columns: [
      { label: 'Metric' },
      { label: 'Base', align: 'end', mono: true },
      { label: 'Alt', align: 'end', mono: true },
      { label: 'Δ', align: 'end', mono: true },
      { label: 'Δ %', align: 'end', mono: true },
      { label: 'Status', status: true },
    ],
    rows: [
      ['Delay', '—', '—', '—', '—', 'No data'],
      ['Density', '0', '0', '0', '—', 'Unchanged'],
      ['Density', '—', '0', '—', '—', 'No data'],
      ['Exit flow', '0', '0', '0', '—', 'Unchanged'],
      ['Exit flow', '—', '0', '—', '—', 'No data'],
      ['Fuel consumption', '—', '—', '—', '—', 'No data'],
      ['Flow', '0', '0', '0', '—', 'Unchanged'],
      ['Mean speed', '—', '—', '—', '—', 'No data'],
      ['Queue length', '0', '0', '0', '—', 'Unchanged'],
      ['Travel time', '—', '—', '—', '—', 'No data'],
    ],
  },
  'live-traffic-incidents': {
    kind: 'table',
    title: 'Live Traffic Incidents',
    total: 50,
    columns: [
      { label: 'Delay s', align: 'end', mono: true },
      { label: 'From' },
      { label: 'To' },
      { label: 'Type' },
      { label: 'Length m', align: 'end', mono: true },
      { label: 'Magnitude', status: true },
    ],
    rows: [
      ['453', 'شارع 18', 'شارع 12', 'Jam', '817', 'Major'],
      ['443', 'D69 exit [25]', 'شارع أم سقيم (D63) exit [16]', 'Jam', '6,590', 'Moderate'],
      ['400', 'شارع الشيخ زايد', 'شارع الخيل', 'Jam', '2,907', 'Major'],
      ['362', 'شارع الخيل الأول (D86)', 'شارع 11أ', 'Jam', '1,210', 'Moderate'],
      ['354', 'شارع الثاني من ديسمبر (D73) / شارع 6ب', 'شارع 7', 'Jam', '163', 'Major'],
      ['353', 'شارع 77ج', 'شارع الصفا (D71)', 'Jam', '647', 'Major'],
      ['352', 'شارع 12', 'شارع 18', 'Jam', '956', 'Major'],
      ['329', 'شارع 25أ', 'شارع الصفا (D71)', 'Jam', '925', 'Major'],
      ['314', 'شارع 51', 'شارع 77ب', 'Jam', '759', 'Major'],
      ['283', 'شارع 4 / شارع الشيخ زايد', 'شارع الخيل الأول (D86)', 'Jam', '404', 'Major'],
      ['263', 'شارع الوصل (D92)', 'دوار السطوة', 'Jam', '504', 'Major'],
      ['262', 'شارع المرابع (D65)', 'حدائق محمد بن راشد', 'Jam', '435', 'Major'],
    ],
  },
  'exposure-by-section': {
    kind: 'table',
    title: 'Pollutant exposure by section',
    columns: [
      { label: 'Section' },
      { label: 'NOx g', align: 'end', mono: true },
      { label: 'PM g', align: 'end', mono: true },
      { label: 'Crossings', align: 'end', mono: true },
      { label: 'Bus stops', align: 'end', mono: true },
      { label: 'Vehicles', align: 'end', mono: true },
    ],
    rows: [
      ['Section 214012', '206.8', '8.80', '0', '3', '4,382'],
      ['Section 219397', '123.8', '5.91', '2', '1', '237'],
      ['Section 217804', '64.8', '2.70', '0', '1', '494'],
      ['Section 220645', '47.6', '1.85', '1', '1', '158'],
      ['Section 220501', '30.7', '1.38', '0', '1', '28'],
      ['Section 219175', '30.5', '0.70', '1', '0', '222'],
      ['Section 220230', '29.6', '1.30', '1', '0', '89'],
    ],
  },
  'overdue-cases': {
    kind: 'table',
    title: 'Top 3 overdue cases awaiting response',
    columns: [
      { label: 'Reference', mono: true },
      { label: 'Category' },
      { label: 'Priority', status: true },
      { label: 'Department' },
      { label: 'Days overdue', align: 'end', mono: true },
    ],
    rows: [
      ['GOV-2026-00640', 'Emergency Preparedness', 'Urgent', 'Emergency & Crisis Coordination', '277'],
      ['GOV-2026-00222', 'Legal / Judicial', 'Urgent', 'Legal Affairs', '269'],
      ['GOV-2026-00816', 'Community Services', 'Normal', 'Community Services', '268'],
    ],
  },
  'slow-restaurants': {
    kind: 'table',
    title: 'Slowest restaurants by prep time',
    columns: [
      { label: '#', align: 'end', mono: true },
      { label: 'Restaurant' },
      { label: 'Orders', align: 'end', mono: true },
      { label: 'Prep min', align: 'end', mono: true },
      { label: 'Min over network', align: 'end', mono: true },
      { label: 'Rider hours lost', align: 'end', mono: true },
    ],
    rows: [
      ['1', 'Spicy Grill 148', '56', '18.1', '7.0', '6.5'],
      ['2', 'Green Grill 71', '65', '16.4', '5.2', '5.7'],
      ['3', 'Fresh Bite 146', '59', '16.9', '5.7', '5.6'],
      ['4', 'Spicy Kitchen 70', '43', '18.5', '7.4', '5.3'],
      ['5', 'Urban Bite 115', '59', '16.0', '4.8', '4.7'],
      ['6', 'Spicy Cafe 4', '58', '15.6', '4.4', '4.3'],
      ['7', 'Golden House 48', '59', '15.5', '4.3', '4.2'],
      ['8', 'Royal Kitchen 51', '47', '16.5', '5.3', '4.2'],
      ['9', 'Urban Cafe 61', '65', '14.9', '3.7', '4.1'],
      ['10', 'Spicy Cafe 135', '55', '15.6', '4.4', '4.0'],
    ],
  },
  'employee-directory': {
    kind: 'table',
    title: 'Employee Directory',
    total: 1000,
    columns: [
      { label: 'ID', align: 'end', mono: true },
      { label: 'First name' },
      { label: 'Last name' },
      { label: 'Gender' },
      { label: 'Birth date', mono: true },
      { label: 'Hire date', mono: true },
    ],
    rows: [
      ['10001', 'Georgi', 'Facello', 'M', '1953-09-02', '1986-06-26'],
      ['10003', 'Parto', 'Bamford', 'M', '1959-12-03', '1986-08-28'],
      ['10004', 'Chirstian', 'Koblick', 'M', '1954-05-01', '1986-12-01'],
      ['10005', 'Kyoichi', 'Maliniak', 'M', '1955-01-21', '1989-09-12'],
      ['10008', 'Saniya', 'Kalloufi', 'M', '1958-02-19', '1994-09-15'],
      ['10012', 'Patricio', 'Bridgland', 'M', '1960-10-04', '1992-12-18'],
      ['10013', 'Eberhardt', 'Terkki', 'M', '1963-06-07', '1985-10-20'],
      ['10014', 'Berni', 'Genin', 'M', '1956-02-12', '1987-03-11'],
      ['10015', 'Guoxiang', 'Nooteboom', 'M', '1959-08-19', '1987-07-02'],
      ['10016', 'Kazuhito', 'Cappelletti', 'M', '1961-05-02', '1995-01-27'],
      ['10019', 'Lillian', 'Haddadi', 'M', '1953-01-23', '1999-04-30'],
      ['10020', 'Mayuko', 'Warwick', 'M', '1952-12-24', '1991-01-26'],
    ],
  },
  'service-frequency': {
    kind: 'table',
    title: 'Service frequency scenarios',
    columns: [
      { label: 'Scenario' },
      { label: 'Peak headway min', align: 'end', mono: true },
      { label: 'Off-peak headway min', align: 'end', mono: true },
      { label: 'Score', align: 'end', mono: true },
      { label: 'Status', status: true },
    ],
    rows: [
      ['Current headways', '4', '8', '74', '—'],
      ['Peak-tightened', '3', '8', '87', 'Recommended'],
      ['Off-peak rationalised', '4', '10', '80', '—'],
    ],
  },
  'persona-guide': {
    kind: 'table',
    title: 'Persona guide',
    columns: [
      { label: 'Persona' },
      { label: 'Profile' },
      { label: 'Basket QAR', align: 'end', mono: true },
      { label: 'Top categories' },
    ],
    rows: [
      ['Affluent Expat Professionals', '30–55, resident expats, high income, professionals/executives, with or without children', '310', 'Premium F&B, Electronics, Specialty Retail'],
      ['Qatari Families', '30–55, Qatari, parents/family household, typically high disposable income', '260', 'Family Dining, Supermarket & Grocery, Entertainment'],
      ['Visitors & Tourists', 'Non-residents, short-term visitors, segmented further by origin, age and spending power', '230', 'Duty-Free & Travel Retail, Souvenirs & Culture, F&B'],
      ['Expat Families', '30–50, resident expats, mid–high income, children in household', '210', 'Supermarket & Grocery, Family Dining, Kids & Education'],
      ['Young Expat Professionals', '20–35, resident expats, single/couple, low–mid or mid income', '150', 'Quick-Service F&B, Fashion & Accessories, Fitness'],
      ['Young Qatari Nationals', '18–30, Qatari, single/young household, typically medium–high disposable income', '145', 'Cafés & F&B, Fashion & Accessories, Entertainment'],
      ['Value-Conscious Residents', '20–55, predominantly expat residents, lower disposable income, price/value sensitive', '95', 'Supermarket & Grocery, Value Fashion, Transport top-ups'],
    ],
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
