/** Vendored Figma thumbnails under public/llumen-assets/studio (not MCP URLs). */
const b = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/studio`

export const STUDIO_IMAGES = {
  mapPinsGreen: `${b}/map-pins-green.jpg`,
  mapPinsRed: `${b}/map-pins-red.jpg`,
  mapTerrain: `${b}/map-terrain.jpg`,
  mapCoast: `${b}/map-coast.jpg`,
  dashboards: [`${b}/dashboard-1.jpg`, `${b}/dashboard-2.jpg`, `${b}/dashboard-3.jpg`, `${b}/dashboard-4.jpg`],
  commandRoom: `${b}/command-room.jpg`,
} as const

export type StudioPage =
  | 'assets'
  | 'filters'
  | 'database'
  | 'apis'
  | 'models'
  | 'files'
  | 'dataflow'
  | 'briefings'
  | 'slides'
  | 'dashboards'
  | 'whiteboards'
  | 'rooms'
  | 'workflows'
  | 'members'
  | 'apps'

export type StatusTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'brand' | 'muted'

/** Every status label the Studio shows, with its chip colour. */
export const STATUS_TONE: Record<string, StatusTone> = {
  Active: 'positive',
  Published: 'positive',
  'Pending Review': 'warning',
  Unpublished: 'warning',
  Inactive: 'negative',
  Failed: 'negative',
  Draft: 'neutral',
  Archived: 'muted',
  Planned: 'brand',
}

/** Rough age in minutes behind each relative time, so "Last Updated" can sort. */
export function ageMinutes(label: string) {
  const match = /(\d+)\s*(min|hour|day|week)/i.exec(label)
  if (!match) {
    const date = Date.parse(label)
    return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : (Date.parse('2026-10-25') - date) / 60000
  }
  const unit = { min: 1, hour: 60, day: 1440, week: 10080 }[match[2].toLowerCase() as 'min' | 'hour' | 'day' | 'week']
  return Number(match[1]) * unit
}

export type StudioAsset = {
  id: string
  title: string
  description: string
  category: string
  type: string
  status: string
  updated: string
  image: string
}

const asset = (slug: string) => `${b}/asset-${slug}.png`

export const STUDIO_ASSETS: StudioAsset[] = [
  {
    id: 'emissions-trajectory',
    title: 'Emissions trajectory vs Net-Zero pathway',
    description: 'Projected vs planned emissions pathway to net-zero target year',
    category: 'Emissions',
    type: 'Line Chart',
    status: 'Active',
    updated: '3 hours ago',
    image: asset('emissions-trajectory'),
  },
  {
    id: 'incidents-by-sector',
    title: 'Incidents classification by sector',
    description: 'Distribution of reported incidents broken down by operational sector',
    category: 'Safety',
    type: 'Donut Chart',
    status: 'Pending Review',
    updated: '1 day ago',
    image: asset('incidents-by-sector'),
  },
  {
    id: 'groundwater-change',
    title: 'Average Groundwater Level Change (m/year)',
    description: 'Year-over-year change in average groundwater levels across monitored wells',
    category: 'Groundwater',
    type: 'KPI',
    status: 'Active',
    updated: '5 hours ago',
    image: asset('groundwater-change'),
  },
  {
    id: 'emissions-reduction',
    title: 'Total Emissions Reduction Achieved (tCO₂e)',
    description: 'Cumulative carbon dioxide equivalent emissions reduced to date',
    category: 'Emissions',
    type: 'Bar Chart',
    status: 'Inactive',
    updated: '2 days ago',
    image: asset('emissions-reduction'),
  },
  {
    id: 'biodiversity-events',
    title: 'Biodiversity Activity Events',
    description: 'Total sensor triggers and recorded activity events across biodiversity zones',
    category: 'Biodiversity',
    type: 'Line Chart',
    status: 'Active',
    updated: '1 hour ago',
    image: asset('biodiversity-events'),
  },
  {
    id: 'net-zero-initiatives',
    title: 'Total Active Net-Zero Initiatives',
    description: 'Number of currently active programs contributing to net-zero goals',
    category: 'Net-Zero',
    type: 'Donut Chart',
    status: 'Inactive',
    updated: '4 days ago',
    image: asset('net-zero-initiatives'),
  },
  {
    id: 'net-zero-contribution',
    title: 'Contribution of Initiatives to Net-Zero Target (%)',
    description: 'Percentage of the net-zero target covered by current active initiatives',
    category: 'Net-Zero',
    type: 'Progress Bar',
    status: 'Active',
    updated: '6 hours ago',
    image: asset('net-zero-contribution'),
  },
  {
    id: 'monitoring-sites',
    title: 'Active Monitoring Sites',
    description: 'Real-time status of environmental monitoring stations across all regions',
    category: 'Monitoring',
    type: 'Horizontal Bar',
    status: 'Pending Review',
    updated: '12 hours ago',
    image: asset('monitoring-sites'),
  },
  {
    id: 'groundwater-abstraction',
    title: 'Total Groundwater Abstraction',
    description: 'Total volume of groundwater extracted across all permitted abstraction points',
    category: 'Groundwater',
    type: 'Area Chart',
    status: 'Active',
    updated: '2 hours ago',
    image: asset('groundwater-abstraction'),
  },
  {
    id: 'water-quality',
    title: 'Wells Within Acceptable Water Quality Standards',
    description: 'Percentage of monitored wells meeting regulatory water quality thresholds',
    category: 'Water Quality',
    type: 'Radial Gauge',
    status: 'Pending Review',
    updated: '3 days ago',
    image: asset('water-quality'),
  },
  {
    id: 'species-by-habitat',
    title: 'Species Population by Habitat',
    description: 'Population distribution of monitored species across habitat classifications',
    category: 'Biodiversity',
    type: 'Stacked Bar',
    status: 'Active',
    updated: '8 hours ago',
    image: asset('species-by-habitat'),
  },
  {
    id: 'species-detection',
    title: 'Species detection frequency',
    description: 'Weekly detection count from automated sensors and field surveys',
    category: 'Biodiversity',
    type: 'Bar Chart',
    status: 'Active',
    updated: '30 min ago',
    image: asset('species-detection'),
  },
  {
    id: 'abstraction-recharge',
    title: 'Abstraction vs Recharge Ratio',
    description: 'Ratio comparing groundwater extraction rates to natural aquifer recharge',
    category: 'Groundwater',
    type: 'Gauge',
    status: 'Active',
    updated: '4 hours ago',
    image: asset('abstraction-recharge'),
  },
  {
    id: 'fuel-consumption',
    title: 'Fuel Consumption Trends',
    description: 'Monthly fuel usage patterns across operational fleet and facilities',
    category: 'Energy',
    type: 'Line Chart',
    status: 'Inactive',
    updated: '1 week ago',
    image: asset('fuel-consumption'),
  },
]

export type FilterKind = 'dropdown' | 'season' | 'hierarchy' | 'slider' | 'timeseries' | 'range' | 'text' | 'user'

export type StudioFilter = {
  id: string
  name: string
  detail: string
  category: string
  type: string
  status: string
  updated: string
  kind: FilterKind
}

export const STUDIO_FILTERS: StudioFilter[] = [
  {
    id: 'f1',
    name: 'Dropdown filter',
    detail: 'date_range_filter',
    category: 'Categorical',
    type: 'Dropdown',
    status: 'Active',
    updated: '2 hours ago',
    kind: 'dropdown',
  },
  {
    id: 'f2',
    name: 'Season Picker Filter',
    detail: 'Location Filter',
    category: 'Seasonal',
    type: 'Season picker',
    status: 'Active',
    updated: '1 day ago',
    kind: 'season',
  },
  {
    id: 'f3',
    name: 'Location Filter',
    detail: 'category_filter',
    category: 'Location',
    type: 'Hierarchical',
    status: 'Active',
    updated: '3 days ago',
    kind: 'hierarchy',
  },
  {
    id: 'f4',
    name: 'Category Filter',
    detail: 'category_filter',
    category: 'Dropdown',
    type: 'Dropdown',
    status: 'Active',
    updated: '3 days ago',
    kind: 'dropdown',
  },
  {
    id: 'f5',
    name: 'Range Slider Filter',
    detail: 'range_slider_filter',
    category: 'Slider',
    type: 'Slider',
    status: 'Active',
    updated: '5 hours ago',
    kind: 'slider',
  },
  {
    id: 'f6',
    name: 'Test-TimeSeries-2',
    detail: 'Filter data by sampled date and time across the global Aimsun time series.',
    category: 'Text',
    type: 'Text',
    status: 'Active',
    updated: '1 day ago',
    kind: 'timeseries',
  },
  {
    id: 'f7',
    name: 'Time Period filter',
    detail: 'Filter the dataset by timestamp to select the relevant time range or period.',
    category: 'Time horizon',
    type: 'Range',
    status: 'Active',
    updated: '8/1/2026',
    kind: 'range',
  },
  {
    id: 'f8',
    name: 'Category Filter',
    detail: 'category_filter',
    category: 'Text',
    type: 'Text Input',
    status: 'Active',
    updated: '3 days ago',
    kind: 'text',
  },
  {
    id: 'f9',
    name: 'Region Filter',
    detail: 'region_filter',
    category: 'Dropdown',
    type: 'Dropdown',
    status: 'Inactive',
    updated: '3 days ago',
    kind: 'dropdown',
  },
  {
    id: 'f10',
    name: 'User Filter',
    detail: 'user_filter',
    category: 'Text',
    type: 'Text',
    status: 'Active',
    updated: '1 day ago',
    kind: 'user',
  },
  {
    id: 'f11',
    name: 'Test-TimeSeries-3',
    detail: 'Filter data by sampled date and time across the global Aimsun time series.',
    category: 'Text',
    type: 'Text',
    status: 'Pending Review',
    updated: '1 day ago',
    kind: 'timeseries',
  },
]

export type StudioConnection = {
  id: string
  name: string
  description: string
  type: string
  userStatus: string
  agentStatus: string
  updated: string
}

export const STUDIO_DATABASES: StudioConnection[] = [
  {
    id: 'aimsun',
    name: 'Aimsun',
    description:
      'Traffic management data for road network. Includes road sections with geometry, sensors (locations and time‑series), incidents and events, response plans, and AI/simulation predictions. Used for traffic monitoring, incident handling, and network analysis.',
    type: 'PostgreSQL',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
  },
  {
    id: 'commerce',
    name: 'Commerce',
    description: 'Sample Retail & Fulfillment Operations Data',
    type: 'MySQL',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '8/1/2026',
  },
  {
    id: 'employees',
    name: 'Employees',
    description: 'Sample Employee Database',
    type: 'SQL Server',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '1 day ago',
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'UAE Energy & Sustainability Operations',
    type: 'Oracle',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '3 days ago',
  },
  {
    id: 'itc',
    name: 'ITC',
    description: 'Integrated transport centre operations',
    type: 'SQLite',
    userStatus: 'Inactive',
    agentStatus: 'Active',
    updated: '3 days ago',
  },
]

export type ApiRequest = {
  id: string
  name: string
  description: string
  url: string
  method: 'GET' | 'POST'
  auth: string
  userStatus: string
  agentStatus: string
  updated: string
}

export type ApiCollection = {
  id: string
  name: string
  description: string
  auth: string
  userStatus: string
  agentStatus: string
  updated: string
  requests: ApiRequest[]
}

export const STUDIO_APIS: ApiCollection[] = [
  {
    id: 'weather',
    name: 'Weather Services',
    description: 'Real-time weather data and forecasts',
    auth: 'API Key',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
    requests: [
      {
        id: 'weather-current',
        name: 'Get Current Weather',
        description: 'Retrieve current weather conditions',
        url: 'https://weather.secureclient.com/api/v1/current',
        method: 'GET',
        auth: 'API Key',
        userStatus: 'Active',
        agentStatus: 'Active',
        updated: '2 hours ago',
      },
      {
        id: 'weather-forecast',
        name: 'Get Weather Forecast',
        description: 'Get 7-day weather forecast for location',
        url: 'https://weather.secureclient.com/api/v1/forecast',
        method: 'POST',
        auth: 'API Key',
        userStatus: 'Active',
        agentStatus: 'Active',
        updated: '2 hours ago',
      },
    ],
  },
  {
    id: 'traffic',
    name: 'Traffic Services',
    description: 'Real-time traffic data and route optimization',
    auth: 'API Key',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
    requests: [
      {
        id: 'traffic-flow',
        name: 'Get Traffic Flow',
        description: 'Retrieve real-time traffic flow data',
        url: 'https://traffic.secureclient.com/api/v1/flow',
        method: 'POST',
        auth: 'API Key',
        userStatus: 'Active',
        agentStatus: 'Active',
        updated: '2 hours ago',
      },
    ],
  },
]

export type StudioFile = {
  id: string
  name: string
  detail: string
  type: string
  userStatus: string
  agentStatus: string
  tested: string
}

export const STUDIO_FILES: StudioFile[] = [
  {
    id: 'emergency',
    name: 'Emergency_CLEANED',
    detail: 'PostgreSQL Store table from Emergency_CLEANED.xlsx',
    type: 'Xlsx',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'gbn',
    name: 'GBN_Business_Organizations_Data_Capture.xlsx',
    detail:
      'Import failed — ingest failed: syntax error at or near ";" LINE 1: ...Read_Me_staging_046cbda6f () VALUES (...',
    type: 'Excel',
    userStatus: 'Failed',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'power',
    name: 'gross_power_generation_mwh_2026-06-30_14-27-35_0002.csv',
    detail:
      "Import failed — ingest failed: invalid input syntax for type double precision: \"\" LINE 1: ...4710.00,'2220.00','236664.00','MAR','10s1136.00','','2020/...",
    type: 'CSV',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'shapes',
    name: 'large-shapes-test',
    detail: 'PostgreSQL Store table from large-shapes-test.geojson',
    type: 'CSV',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'polygon',
    name: 'Polygon.json',
    detail: 'Pending — preview ready, click Continue to import.',
    type: 'CSV',
    userStatus: 'Pending Review',
    agentStatus: 'Inactive',
    tested: '2 hours ago',
  },
]

export type BriefingKind = 'Report' | 'Feedback' | 'Alert' | 'Update'

export type StudioBriefing = {
  id: string
  title: string
  kind: BriefingKind
  age: string
  image: string
  slides: number
  updated: string
  expired?: boolean
}

const BRIEFING_IMAGE: Record<BriefingKind, string> = {
  Report: STUDIO_IMAGES.mapPinsRed,
  Feedback: STUDIO_IMAGES.mapPinsRed,
  Alert: STUDIO_IMAGES.mapPinsGreen,
  Update: STUDIO_IMAGES.mapTerrain,
}

const briefing = (
  id: string,
  title: string,
  kind: BriefingKind,
  age: string,
  slides: number,
  updated: string,
  expired = false,
): StudioBriefing => ({
  id,
  title,
  kind,
  age,
  image: BRIEFING_IMAGE[kind],
  slides,
  updated,
  expired,
})

export const STUDIO_BRIEFINGS: StudioBriefing[] = [
  briefing('b1', 'Carbon Offset Program Exceeds Q3 Targets by 40%', 'Report', '15 Min Ago', 19, '15 min ago'),
  briefing('b2', 'Geopolitical Tensions Impacting Eastern Supply Routes', 'Feedback', '45 Min Ago', 12, '45 min ago'),
  briefing('b3', 'Solar Farm Output Drops 12% Due to Unusual Cloud Cover', 'Alert', '1 Hour Ago', 2, '1 hour ago'),
  briefing(
    'b4',
    'Aquifer Recharge Rates Hit Critical Low in Southern Region',
    'Update',
    '3 Hours Ago',
    8,
    '3 hours ago',
  ),
  briefing('b5', 'Rare Species Detected Near Proposed Development Site', 'Update', '5 Hours Ago', 13, '5 hours ago'),
  briefing('b6', 'New EPA Regulation Draft Requires Immediate Review', 'Update', '8 Hours Ago', 10, '8 hours ago'),
  briefing('b7', 'Extreme Weather Warning Issued for Coastal Operations Zone', 'Alert', '1 Day Ago', 3, '1 day ago'),
  briefing(
    'b8',
    'Sensor Network Outage Resolved All Monitoring Stations Online',
    'Report',
    '2 Days Ago',
    7,
    '2 days ago',
  ),
  briefing('b9', 'Heatwave Advisory Lifted Across Inland Districts', 'Update', '2 Weeks Ago', 5, '2 weeks ago', true),
  briefing('b10', 'Port Congestion Eases After Weekend Backlog', 'Report', '3 Weeks Ago', 9, '3 weeks ago', true),
]

/** A slide deck, dashboard or command room: a cover, a status and a size. */
export type StudioStory = {
  id: string
  title: string
  status: string
  sections: number
  updated: string
  image: string
}

const SLIDE_COVERS = [
  STUDIO_IMAGES.mapPinsGreen,
  STUDIO_IMAGES.mapPinsRed,
  STUDIO_IMAGES.mapTerrain,
  STUDIO_IMAGES.mapPinsGreen,
  STUDIO_IMAGES.mapPinsRed,
  STUDIO_IMAGES.mapTerrain,
  STUDIO_IMAGES.mapPinsRed,
  STUDIO_IMAGES.mapPinsGreen,
  STUDIO_IMAGES.mapCoast,
  STUDIO_IMAGES.mapPinsRed,
  STUDIO_IMAGES.mapTerrain,
  STUDIO_IMAGES.mapPinsGreen,
]

export const STUDIO_SLIDES: StudioStory[] = [
  ['Building a Scalable Microservices Architecture From the Ground Up', 'Published', 19, '3 hours ago'],
  ['Brand Repositioning Strategy for the Next-Gen Consumer Market', 'Unpublished', 10, '1 day ago'],
  ['User Onboarding Redesign: Reducing Time-to-Value by 40%', 'Draft', 15, '5 hours ago'],
  ['Enterprise Pipeline Acceleration: Lessons From Q3 Wins', 'Published', 14, '2 days ago'],
  ['Streamlining Cross-Team Workflows With Automation', 'Unpublished', 25, '1 hour ago'],
  ['Remote Culture Playbook: Keeping Teams Connected at Scale', 'Draft', 21, '4 days ago'],
  ['Reducing Churn Through Proactive Health Scoring', 'Published', 23, '6 hours ago'],
  ['Annual Budget Planning Framework for Hypergrowth Startups', 'Unpublished', 23, '1 week ago'],
  ['Zero-Trust Security Rollout: A 90-Day Implementation Guide', 'Published', 21, '2 hours ago'],
  ['Migrating Legacy Systems to Cloud-Native Infrastructure', 'Published', 10, '3 days ago'],
  ['Content-Led Growth: Driving Organic Acquisition at Scale', 'Published', 15, '8 hours ago'],
  ['Feature Prioritization With Impact vs Effort Scoring', 'Published', 5, '30 min ago'],
].map(([title, status, sections, updated], index) => ({
  id: `slide-${index}`,
  title: title as string,
  status: status as string,
  sections: sections as number,
  updated: updated as string,
  image: SLIDE_COVERS[index],
}))

export const STUDIO_DASHBOARDS: StudioStory[] = [
  ['Operations Dashboard: Live KPIs and Key Supply Chain Updates for the Quarter', 'Published', '3 hours ago'],
  ['Monthly Sales Performance: Detailed Regional Breakdowns and Future Forecasts', 'Unpublished', '1 day ago'],
  ['IT Infrastructure Monitoring: Real-time Network Health and Security Alerts', 'Draft', '5 hours ago'],
  ['Executive Summary: Quarterly Targets, Risks and Supply Chain Outlook', 'Published', '2 days ago'],
  ['Customer Analytics: Engagement Metrics and Retention Insights', 'Unpublished', '1 hour ago'],
  ['Financial Reporting: Revenue Analysis and Budget Tracking', 'Draft', '4 days ago'],
  ['Marketing Performance: Campaign ROI and Channel Attribution', 'Published', '6 hours ago'],
  ['HR Analytics: Workforce Trends and Employee Satisfaction Metrics', 'Unpublished', '1 week ago'],
].map(([title, status, updated], index) => ({
  id: `dashboard-${index}`,
  title,
  status,
  sections: 19,
  updated,
  image: STUDIO_IMAGES.dashboards[index % 4],
}))

export const STUDIO_ROOMS: StudioStory[] = [
  ['Q3 Crisis Room', 'Active', '1 hour ago'],
  ['Merger & Acquisition War Room', 'Planned', '4 days ago'],
  ['Fiscal Year Planning', 'Active', '3 hours ago'],
  ['Q1 Audit Review Ratios', 'Archived', '1 day ago'],
].map(([title, status, updated], index) => ({
  id: `room-${index}`,
  title,
  status,
  sections: 0,
  updated,
  image: STUDIO_IMAGES.commandRoom,
}))

const appCover = (name: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/apps/${name}.jpg`

export type AppKind = 'Dashboard' | 'Slides' | 'Command Room'

/** Anything built for people to open: the Llumen dashboards first, then every dashboard, deck and room. */
export type StudioApp = StudioStory & { kind: AppKind; description?: string }

export const STUDIO_APPS: StudioApp[] = [
  {
    id: 'app-groundwater',
    kind: 'Dashboard',
    title: 'Groundwater Monitoring Network',
    description: 'Water quality, exceedances and falling levels across 450 monitoring wells.',
    status: 'Published',
    sections: 9,
    updated: '2 hours ago',
    image: appCover('app-2'),
  },
  {
    id: 'app-policies',
    kind: 'Dashboard',
    title: 'Policies & Regulations Dashboard',
    description: '72 environmental policies from issue to rollout, with compliance by sector.',
    status: 'Published',
    sections: 12,
    updated: '1 day ago',
    image: appCover('app-1'),
  },
  {
    id: 'app-mangrove',
    kind: 'Dashboard',
    title: 'Mangrove Ecosystem Health Monitoring',
    description: 'Canopy, regeneration and stress hotspots along 175 km² of coast.',
    status: 'Draft',
    sections: 7,
    updated: '3 days ago',
    image: appCover('app-4'),
  },
  {
    id: 'app-plastics',
    kind: 'Dashboard',
    title: 'Single Use Plastics Dashboard',
    description: 'Environmental, social and economic impact of the single-use plastics policy.',
    status: 'Unpublished',
    sections: 16,
    updated: '1 week ago',
    image: appCover('app-3'),
  },
  ...STUDIO_DASHBOARDS.map((item) => ({ ...item, kind: 'Dashboard' as const })),
  ...STUDIO_SLIDES.map((item) => ({ ...item, kind: 'Slides' as const })),
  ...STUDIO_ROOMS.map((item) => ({ ...item, kind: 'Command Room' as const })),
]

/** How a workflow's card draws it: a chain of step icons, or its node graph. */
export type WorkflowShape = 'chain' | 'graph'

export type StudioWorkflow = {
  id: string
  title: string
  description: string
  status: string
  updated: string
  shape: WorkflowShape
  /** AI agents working through it right now. */
  running?: number
}

export const STUDIO_WORKFLOWS: StudioWorkflow[] = [
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `wf-onboarding-${index}`,
    title: 'User Onboarding Flow',
    description: 'Guides new users through account setup, profile completion, and initial configuration steps',
    status: 'Published',
    updated: '6 hours ago',
    shape: 'chain' as const,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `wf-running-${index}`,
    title: 'User Onboarding Flow',
    description: 'Guides new users through account setup, profile completion, and initial configuration steps',
    status: 'Published',
    updated: '1 hour ago',
    shape: 'chain' as const,
    running: 4,
  })),
  {
    id: 'wf-audit',
    title: 'Compliance Audit Trail',
    description: 'Collects permit filings, flags gaps and routes them to the compliance team for sign-off',
    status: 'Published',
    updated: '3 hours ago',
    shape: 'graph',
  },
  {
    id: 'wf-audit-2',
    title: 'Compliance Audit Trail',
    description: 'Collects permit filings, flags gaps and routes them to the compliance team for sign-off',
    status: 'Unpublished',
    updated: '4 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-inventory',
    title: 'Inventory Restock Trigger',
    description: 'Watches stock levels across depots and drafts purchase orders before they run short',
    status: 'Published',
    updated: '2 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-sentiment',
    title: 'Sentiment Analysis Digest',
    description: 'Summarises citizen feedback by district every morning and highlights emerging issues',
    status: 'Unpublished',
    updated: '5 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-air-quality',
    title: 'Air Quality Alerting',
    description: 'Watches coastal stations overnight and alerts health teams when readings cross the sensitive-groups line',
    status: 'Published',
    updated: '2 hours ago',
    shape: 'chain',
    running: 2,
  },
  {
    id: 'wf-permit-renewals',
    title: 'Permit Renewal Reminders',
    description: 'Finds permits expiring within 60 days and drafts reminders to each facility owner',
    status: 'Published',
    updated: '8 hours ago',
    shape: 'chain',
  },
  {
    id: 'wf-bus-delays',
    title: 'Bus Delay Escalation',
    description: 'Flags routes running more than ten minutes late and routes them to the operations desk',
    status: 'Published',
    updated: '30 min ago',
    shape: 'graph',
    running: 3,
  },
  {
    id: 'wf-clinic-surge',
    title: 'Clinic Surge Watch',
    description: 'Tracks heat-related clinic visits by district and warns when a week runs above its baseline',
    status: 'Unpublished',
    updated: '1 day ago',
    shape: 'graph',
  },
  {
    id: 'wf-board-briefing',
    title: 'Weekly Board Briefing',
    description: 'Gathers the week’s findings into a slide deck and shares it with the board every Sunday',
    status: 'Published',
    updated: '3 days ago',
    shape: 'chain',
  },
]

export type StudioMember = {
  id: string
  name: string
  email: string
  role: 'Editor' | 'Contributor' | 'Viewer'
}

export const STUDIO_MEMBERS: StudioMember[] = [
  ['John Doe', 'Editor'],
  ['Jane Smith', 'Contributor'],
  ['Mike Brown', 'Viewer'],
  ['Sarah Wilson', 'Contributor'],
  ['Alex Chen', 'Editor'],
  ['Priya Nair', 'Contributor'],
  ['Omar Hassan', 'Viewer'],
  ['Lena Kim', 'Editor'],
  ['Carlos Rivera', 'Contributor'],
  ['Emma Davis', 'Viewer'],
].map(([name, role]) => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
  role: role as StudioMember['role'],
}))

export const STUDIO_WORKSPACE_NAMES = [
  'Global Sales Operations',
  'Finance',
  'Operations',
  'Environment',
  'Transport',
  'Engineering',
] as const
