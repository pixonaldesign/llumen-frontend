const base = import.meta.env.BASE_URL.replace(/\/$/, '')
/** Live charts captured from the Assets grid, for the list views' thumbnails. */
const b = `${base}/llumen-assets/studio`
/** Screenshots of the GAMI stories, one per page, under public/llumen-assets/apps. */
const appCover = (name: string) => `${base}/llumen-assets/apps/gami-${name}.jpg`

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
  Succeeded: 'positive',
  Draft: 'neutral',
  Archived: 'muted',
  Planned: 'brand',
}

/** Rough age in minutes behind each relative time, so "Last Updated" can sort. */
export function ageMinutes(label: string) {
  const match = /(\d+)\s*(min|hour|day|week)/i.exec(label)
  if (!match) {
    const date = Date.parse(label)
    return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : (Date.parse('2026-11-05') - date) / 60000
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

const assetItem = (
  id: string,
  title: string,
  description: string,
  category: string,
  type: string,
  status: string,
  updated: string,
): StudioAsset => ({ id, title, description, category, type, status, updated, image: asset(id) })

export const STUDIO_ASSETS: StudioAsset[] = [
  assetItem(
    'saudi-made-trajectory',
    'Saudi Made trajectory vs 2030 goal',
    'Projected vs planned local content in military spending, on the way to the 50% goal',
    'National KPIs',
    'Line Chart',
    'Active',
    '3 hours ago',
  ),
  assetItem(
    'license-status',
    '2026 License Status',
    'Industrial licence applications this year by stage, from applied to granted',
    'Licensing',
    'Donut Chart',
    'Pending Review',
    '1 day ago',
  ),
  assetItem(
    'saudi-made-goal',
    'Saudi Made vs 2030 Goal',
    'Share of military spending made in the Kingdom, against the Vision 2030 goal',
    'National KPIs',
    'Progress Bar',
    'Active',
    '5 hours ago',
  ),
  assetItem(
    'investment-pipeline',
    '2026 Investment Pipeline',
    'Investment committed by month across licensed military industry companies',
    'Investment',
    'Bar Chart',
    'Active',
    '2 days ago',
  ),
  assetItem(
    'wds-exhibitors',
    'WDS 2028 Exhibitor Applications',
    'World Defense Show 2028 applications by stage, 15 months before the show',
    'World Defense Show',
    'Stacked Bar',
    'Active',
    '1 hour ago',
  ),
  assetItem(
    'skills-gap',
    'Defence Skills Gap to 2030',
    'Skilled people the sector is short of today and by 2030, if intakes stay as planned',
    'Human Capital',
    'Area Chart',
    'Inactive',
    '4 days ago',
  ),
  assetItem(
    'plant-capacity',
    'Al-Yamamah Plant Utilisation',
    'Line utilisation at the Al-Yamamah Defence Systems Plant in Riyadh’s 2nd Industrial City',
    'Industrial Sites',
    'Gauge',
    'Active',
    '6 hours ago',
  ),
  assetItem(
    'industrial-sites',
    'Defence Industrial Sites on Plan',
    'Daily status of the Kingdom’s 15 defence industrial sites against their production plan',
    'Industrial Sites',
    'Status Timeline',
    'Pending Review',
    '12 hours ago',
  ),
  assetItem(
    'localization-opportunities',
    'Localization Opportunities',
    'Imported spend a year that local makers could take on, by product family',
    'Localization',
    'Bar Chart',
    'Active',
    '2 hours ago',
  ),
  assetItem(
    'inventory-readiness',
    'Inventory Readiness (%)',
    'Readiness of the sector’s 100 products, weighted by inventory value',
    'Inventory',
    'Radial Gauge',
    'Pending Review',
    '3 days ago',
  ),
  assetItem(
    'unfilled-roles',
    'Unfilled Roles by Region',
    'Open skilled roles at licensed companies, by region',
    'Human Capital',
    'Horizontal Bar',
    'Active',
    '8 hours ago',
  ),
  assetItem(
    'uav-motor-stock',
    'UAV Propulsion Motor Stock',
    'Weeks of propulsion motor stock left for the UAV programmes since Poland froze exports',
    'Supply Chain',
    'Line Chart',
    'Active',
    '30 min ago',
  ),
  assetItem(
    'inventory-source',
    'Inventory Value by Source',
    'Value of the sector’s inventory made in the Kingdom vs imported',
    'Inventory',
    'Stacked Bar',
    'Active',
    '4 hours ago',
  ),
  assetItem(
    'plan-progress',
    '2026 Plan Progress',
    'Saudi Made, military market and jobs against this year’s national plan',
    'National KPIs',
    'Horizontal Bar',
    'Active',
    '45 min ago',
  ),
  assetItem(
    'licensed-domains',
    'Licensed Companies by Domain',
    'The 602 licensed military industry companies by domain',
    'Licensing',
    'Donut Chart',
    'Active',
    '1 day ago',
  ),
  assetItem(
    'wds-pace',
    'WDS Applications vs 2026 Pace',
    'Cumulative exhibitor applications for WDS 2028 against the same months before WDS 2026',
    'World Defense Show',
    'Line Chart',
    'Inactive',
    '1 week ago',
  ),
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
    name: 'Domain Filter',
    detail: 'defence_domain_filter',
    category: 'Categorical',
    type: 'Dropdown',
    status: 'Active',
    updated: '2 hours ago',
    kind: 'dropdown',
  },
  {
    id: 'f2',
    name: 'Plan Quarter Picker',
    detail: 'plan_quarter_filter',
    category: 'Seasonal',
    type: 'Season picker',
    status: 'Active',
    updated: '1 day ago',
    kind: 'season',
  },
  {
    id: 'f3',
    name: 'Location Filter',
    detail: 'Kingdom → region → industrial city',
    category: 'Location',
    type: 'Hierarchical',
    status: 'Active',
    updated: '3 days ago',
    kind: 'hierarchy',
  },
  {
    id: 'f4',
    name: 'Source Filter',
    detail: 'local_or_imported_filter',
    category: 'Dropdown',
    type: 'Dropdown',
    status: 'Active',
    updated: '3 days ago',
    kind: 'dropdown',
  },
  {
    id: 'f5',
    name: 'Readiness Range',
    detail: 'readiness_range_filter',
    category: 'Slider',
    type: 'Slider',
    status: 'Active',
    updated: '5 hours ago',
    kind: 'slider',
  },
  {
    id: 'f6',
    name: 'Shipment Timeline',
    detail: 'Filter component shipments by expected delivery date across the Türkiye bridge.',
    category: 'Text',
    type: 'Text',
    status: 'Active',
    updated: '1 day ago',
    kind: 'timeseries',
  },
  {
    id: 'f7',
    name: 'Licence Period',
    detail: 'Filter licence applications by the date they were filed to select a review period.',
    category: 'Time horizon',
    type: 'Range',
    status: 'Active',
    updated: '8/1/2026',
    kind: 'range',
  },
  {
    id: 'f8',
    name: 'Maker Search',
    detail: 'maker_name_filter',
    category: 'Text',
    type: 'Text Input',
    status: 'Active',
    updated: '3 days ago',
    kind: 'text',
  },
  {
    id: 'f9',
    name: 'Origin Country Filter',
    detail: 'origin_country_filter',
    category: 'Dropdown',
    type: 'Dropdown',
    status: 'Inactive',
    updated: '3 days ago',
    kind: 'dropdown',
  },
  {
    id: 'f10',
    name: 'Account Manager',
    detail: 'account_manager_filter',
    category: 'Text',
    type: 'Text',
    status: 'Active',
    updated: '1 day ago',
    kind: 'user',
  },
  {
    id: 'f11',
    name: 'Stock Cover Timeline',
    detail: 'Filter products by the date their stock runs out at the current draw-down.',
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
    id: 'licensing',
    name: 'Licensing Registry',
    description:
      'Industrial licences for military industries: 602 licensed companies and 1,007 applications this year, with domain, region, review stage and history. Used for licensing performance and compliance.',
    type: 'PostgreSQL',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
  },
  {
    id: 'inventory',
    name: 'Defence Inventory',
    description: '100 products held across the sector: stock, value, readiness, origin, maker and lead time',
    type: 'Oracle',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '8/1/2026',
  },
  {
    id: 'suppliers',
    name: 'Supplier Network',
    description: 'Local and foreign suppliers, the components they ship and the programmes they serve',
    type: 'MySQL',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '1 day ago',
  },
  {
    id: 'workforce',
    name: 'Defence Workforce',
    description: '66.4k jobs at licensed companies, with skills, certifications and vacancies by region',
    type: 'SQL Server',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '3 days ago',
  },
  {
    id: 'wds',
    name: 'WDS Exhibitors',
    description: 'World Defense Show 2028 exhibitor applications, stands and expected contracts',
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
    id: 'export-controls',
    name: 'Export Control Services',
    description: 'Export restrictions and licence checks from partner countries',
    auth: 'API Key',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
    requests: [
      {
        id: 'export-restrictions',
        name: 'Get Export Restrictions',
        description: 'Retrieve the restrictions in force by country and component',
        url: 'https://exports.secureclient.com/api/v1/restrictions',
        method: 'GET',
        auth: 'API Key',
        userStatus: 'Active',
        agentStatus: 'Active',
        updated: '2 hours ago',
      },
      {
        id: 'export-licence-check',
        name: 'Check Component Licence',
        description: 'Check whether a component can ship under its export licence',
        url: 'https://exports.secureclient.com/api/v1/licence-check',
        method: 'POST',
        auth: 'API Key',
        userStatus: 'Active',
        agentStatus: 'Active',
        updated: '2 hours ago',
      },
    ],
  },
  {
    id: 'freight',
    name: 'Freight & Logistics',
    description: 'Shipment tracking and lead times for imported components',
    auth: 'API Key',
    userStatus: 'Active',
    agentStatus: 'Active',
    updated: '2 hours ago',
    requests: [
      {
        id: 'freight-status',
        name: 'Get Shipment Status',
        description: 'Retrieve where each component shipment is and when it lands',
        url: 'https://freight.secureclient.com/api/v1/shipments',
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
    id: 'saudi-made',
    name: 'Saudi_Made_Content_2026_Q3',
    detail: 'PostgreSQL Store table from Saudi_Made_Content_2026_Q3.xlsx',
    type: 'Xlsx',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'supplier-register',
    name: 'Supplier_Register_Poland_Freeze.xlsx',
    detail:
      'Import failed — ingest failed: duplicate key value violates unique constraint "supplier_pkey" DETAIL: Key (supplier_id)=(PL-0417) already exists.',
    type: 'Excel',
    userStatus: 'Failed',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'shipments',
    name: 'uav_component_shipments_2026-10-31.csv',
    detail: 'PostgreSQL Store table from uav_component_shipments_2026-10-31.csv',
    type: 'CSV',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'zones',
    name: 'licensed-industrial-zones',
    detail: 'PostgreSQL Store table from licensed-industrial-zones.geojson',
    type: 'GeoJSON',
    userStatus: 'Active',
    agentStatus: 'Active',
    tested: '2 hours ago',
  },
  {
    id: 'venue',
    name: 'Malham_Venue_Halls.json',
    detail: 'Pending — preview ready, click Continue to import.',
    type: 'JSON',
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

const briefing = (
  id: string,
  title: string,
  kind: BriefingKind,
  cover: string,
  age: string,
  slides: number,
  expired = false,
): StudioBriefing => ({
  id,
  title,
  kind,
  age: age.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  image: appCover(cover),
  slides,
  updated: age,
  expired,
})

export const STUDIO_BRIEFINGS: StudioBriefing[] = [
  briefing('b1', 'Poland Export Freeze Cuts Off 20 UAV Components', 'Alert', 'disruption', '15 min ago', 6),
  briefing('b2', 'Saudi Made Reaches 94.8% of the 2026 Plan', 'Report', 'kingdom', '45 min ago', 12),
  briefing('b3', 'Al-Yamamah Plant Runs at 94% of Capacity', 'Update', 'plant', '1 hour ago', 4),
  briefing('b4', 'Inventory Holds SAR 106.8bn Across 100 Products', 'Report', 'inventory', '3 hours ago', 9),
  briefing('b5', 'Jubail Can Localize SAR 10.6bn a Year Now', 'Update', 'jubail', '5 hours ago', 8),
  briefing('b6', 'WDS 2028 Applications Run 32% Ahead of 2026', 'Update', 'world', '8 hours ago', 10),
  briefing('b7', 'Western Region Short 2,140 Skilled Roles', 'Alert', 'western', '1 day ago', 5),
  briefing('b8', 'Riyadh–Al Kharj Corridor Holds 41% of Licensed Companies', 'Feedback', 'corridor', '2 days ago', 7),
  briefing('b9', 'Turkish Suppliers Confirm 30-Day First Delivery', 'Update', 'turkiye', '2 weeks ago', 5, true),
  briefing('b10', 'Malham Venue Halls Reach 82% Readiness', 'Report', 'venue', '3 weeks ago', 9, true),
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

export type AppKind = 'Dashboard' | 'Slides' | 'Command Room'

/** Anything built for people to open: every dashboard, deck and room, each from a GAMI story. */
export type StudioApp = StudioStory & { kind: AppKind; description?: string }

const app = (
  kind: AppKind,
  id: string,
  title: string,
  description: string,
  status: string,
  sections: number,
  updated: string,
): StudioApp => ({ id: `app-${id}`, kind, title, description, status, sections, updated, image: appCover(id) })

export const STUDIO_DASHBOARDS: StudioApp[] = [
  app(
    'Dashboard',
    'kingdom',
    'GAMI National Performance',
    'Saudi Made at 29.4%, 94.8% of the 2026 plan, with SAR 46.5bn of military market and 66.4k jobs.',
    'Published',
    9,
    '2 hours ago',
  ),
  app(
    'Dashboard',
    'inventory',
    'Inventory & Supply Performance',
    '100 products worth SAR 106.8bn; 11 imported from Poland are cut off.',
    'Published',
    12,
    '30 min ago',
  ),
  app(
    'Dashboard',
    'corridor',
    'Riyadh–Al Kharj Corridor',
    '248 of the 602 licensed companies and SAR 7.9bn of this year’s investment, with both UAV sites at risk.',
    'Published',
    8,
    '5 hours ago',
  ),
  app(
    'Dashboard',
    'eastern',
    'Localization Opportunities',
    'SAR 32.0bn a year of imports could be made in the Kingdom, city by city.',
    'Published',
    10,
    '1 day ago',
  ),
  app(
    'Dashboard',
    'jubail',
    'Jubail Industrial City',
    'Jubail can take SAR 10.6bn of localization now, with land and suppliers in place.',
    'Draft',
    7,
    '3 days ago',
  ),
  app(
    'Dashboard',
    'western',
    'Defence Skills Gap — Western Region',
    '6,350 skilled people short today and 10,600 by 2030, with 2,140 roles open in the west.',
    'Unpublished',
    9,
    '1 week ago',
  ),
]

export const STUDIO_SLIDES: StudioApp[] = [
  app(
    'Slides',
    'turkiye',
    'Drone Supply: Bridge Through Türkiye',
    'Turkish suppliers land the 3 critical UAV components in 30 days, 11 days before motor stock runs out.',
    'Published',
    14,
    '15 min ago',
  ),
  app(
    'Slides',
    'local',
    'Made in the Kingdom: UAV Components by 2029',
    'Local production of motors, gimbals and navigation units takes over from the bridge in 2029.',
    'Draft',
    11,
    '4 hours ago',
  ),
  app(
    'Slides',
    'world',
    'WDS 2028 Exhibitor Pipeline',
    '1,940 exhibitors from 94 countries, 32% ahead of 2026, 15 months before the show.',
    'Published',
    16,
    '6 hours ago',
  ),
  app(
    'Slides',
    'kaec',
    'KAEC Cluster: A Second Intake',
    'A second training intake at KAEC closes a third of the Western Region’s gap by 2028.',
    'Unpublished',
    10,
    '2 days ago',
  ),
]

export const STUDIO_ROOMS: StudioApp[] = [
  app(
    'Command Room',
    'disruption',
    'Poland Disruption Crisis Room',
    'The Poland–Russia conflict cut off 20 imported components; 3 are critical to the UAV programmes.',
    'Active',
    0,
    '1 hour ago',
  ),
  app(
    'Command Room',
    'plant',
    'Al-Yamamah Plant Watch',
    'The Kingdom’s busiest plant at 94% of capacity, until Hall B opens in Q2 2027.',
    'Active',
    0,
    '3 hours ago',
  ),
  app(
    'Command Room',
    'venue',
    'WDS 2028 Venue Operations',
    'Malham’s 5 halls are 82% ready; roads and shuttles are the tightest link at 64%.',
    'Planned',
    0,
    '4 days ago',
  ),
]

export const STUDIO_APPS: StudioApp[] = [...STUDIO_DASHBOARDS, ...STUDIO_SLIDES, ...STUDIO_ROOMS]

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
  /** Triggered by hand rather than on a schedule or event, so a published one can be executed. */
  manual?: boolean
}

export const STUDIO_WORKFLOWS: StudioWorkflow[] = [
  {
    id: 'wf-supplier-risk',
    title: 'Supplier Risk Watch',
    description: 'Watches export restrictions on foreign suppliers and flags the components at risk before stock runs short',
    status: 'Published',
    updated: '1 hour ago',
    shape: 'chain',
    running: 4,
  },
  {
    id: 'wf-uav-stock',
    title: 'UAV Stock Alerting',
    description: 'Tracks days of motor, gimbal and navigation stock and alerts the programme office below 60 days',
    status: 'Published',
    updated: '30 min ago',
    shape: 'graph',
    running: 3,
  },
  {
    id: 'wf-shipments',
    title: 'Bridge Shipment Tracker',
    description: 'Follows the Türkiye bridge shipments and warns when a delivery slips past its 30-day window',
    status: 'Published',
    updated: '2 hours ago',
    shape: 'chain',
    running: 2,
  },
  {
    id: 'wf-licence-routing',
    title: 'Licence Review Routing',
    description: 'Sorts new licence applications by domain and routes them to reviewers, chasing any open past 30 days',
    status: 'Published',
    updated: '3 hours ago',
    shape: 'graph',
    manual: true,
  },
  {
    id: 'wf-export-escalation',
    title: 'Export Licence Escalation',
    description: 'Flags export licence requests blocked for more than 10 days and routes them to the compliance desk',
    status: 'Unpublished',
    updated: '4 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-saudi-made',
    title: 'Saudi Made Content Audit',
    description: 'Collects supplier declarations each quarter and recomputes local content against the 2030 goal',
    status: 'Published',
    updated: '2 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-localization',
    title: 'Localization Opportunity Scan',
    description: 'Matches imported products to local makers who could build them and sizes each opportunity',
    status: 'Unpublished',
    updated: '5 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-plant-capacity',
    title: 'Plant Capacity Monitor',
    description: 'Reads line utilisation at the Al-Yamamah plant and warns when a hall runs above 95%',
    status: 'Published',
    updated: '8 hours ago',
    shape: 'chain',
    manual: true,
  },
  {
    id: 'wf-wds-followup',
    title: 'WDS Exhibitor Follow-up',
    description: 'Chases incomplete exhibitor applications and confirms stands for World Defense Show 2028',
    status: 'Published',
    updated: '6 hours ago',
    shape: 'chain',
    running: 2,
  },
  {
    id: 'wf-workforce',
    title: 'Workforce Gap Digest',
    description: 'Summarises vacancies by region every Sunday and highlights roles training cannot fill in time',
    status: 'Unpublished',
    updated: '1 day ago',
    shape: 'graph',
  },
  {
    id: 'wf-restock',
    title: 'Inventory Restock Trigger',
    description: 'Watches stock across depots and drafts purchase orders before readiness falls under 80%',
    status: 'Published',
    updated: '2 days ago',
    shape: 'graph',
  },
  {
    id: 'wf-leadership',
    title: 'Weekly Leadership Briefing',
    description: 'Gathers the week’s findings into a slide deck and shares it with GAMI leadership every Sunday',
    status: 'Published',
    updated: '3 days ago',
    shape: 'chain',
    manual: true,
  },
]

export type StudioExecution = {
  id: string
  flow: string
  status: 'Succeeded'
  started: string
  duration: string
}

/** Recent runs of the workflows above, newest first. */
export const STUDIO_EXECUTIONS: StudioExecution[] = [
  { id: 'ex-12', flow: 'UAV Stock Alerting', status: 'Succeeded', started: 'about 1 hour ago', duration: '1m 42s' },
  { id: 'ex-11', flow: 'Supplier Risk Watch', status: 'Succeeded', started: 'about 8 hours ago', duration: '38s' },
  { id: 'ex-10', flow: 'Licence Review Routing', status: 'Succeeded', started: '1 day ago', duration: '2m 31s' },
  { id: 'ex-9', flow: 'Inventory Restock Trigger', status: 'Succeeded', started: '2 days ago', duration: '3m 12s' },
  { id: 'ex-8', flow: 'Bridge Shipment Tracker', status: 'Succeeded', started: '3 days ago', duration: '54s' },
  { id: 'ex-7', flow: 'Saudi Made Content Audit', status: 'Succeeded', started: '4 days ago', duration: '4m 09s' },
  { id: 'ex-6', flow: 'Weekly Leadership Briefing', status: 'Succeeded', started: '5 days ago', duration: '6m 20s' },
  { id: 'ex-5', flow: 'UAV Stock Alerting', status: 'Succeeded', started: '6 days ago', duration: '1m 37s' },
  { id: 'ex-4', flow: 'Inventory Restock Trigger', status: 'Succeeded', started: '7 days ago', duration: '2m 58s' },
  { id: 'ex-3', flow: 'Supplier Risk Watch', status: 'Succeeded', started: '8 days ago', duration: '41s' },
  { id: 'ex-2', flow: 'Licence Review Routing', status: 'Succeeded', started: '9 days ago', duration: '2m 12s' },
  { id: 'ex-1', flow: 'Bridge Shipment Tracker', status: 'Succeeded', started: '10 days ago', duration: '49s' },
]

export type StudioMember = {
  id: string
  name: string
  email: string
  role: 'Editor' | 'Contributor' | 'Viewer'
}

export const STUDIO_MEMBERS: StudioMember[] = [
  ['Noura Al-Qahtani', 'Editor'],
  ['Faisal Al-Otaibi', 'Contributor'],
  ['Reem Al-Shehri', 'Viewer'],
  ['Khalid Al-Dosari', 'Contributor'],
  ['Lama Al-Zahrani', 'Editor'],
  ['Turki Al-Anazi', 'Contributor'],
  ['Omar Hassan', 'Viewer'],
  ['Sara Al-Mutairi', 'Editor'],
  ['Abdullah Al-Ghamdi', 'Contributor'],
  ['Huda Al-Subaie', 'Viewer'],
].map(([name, role]) => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  email: `${name.toLowerCase().replace(/^al-|\s+al-/g, ' ').trim().replace(/\s+/g, '.')}@gami.gov.sa`,
  role: role as StudioMember['role'],
}))

export const STUDIO_WORKSPACE_NAMES = [
  'Military Industries',
  'National Performance',
  'Supply Chain',
  'Localization',
  'World Defense Show',
  'Human Capital',
] as const
