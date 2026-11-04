/**
 * The GAMI demo's apps (stories): the four Briefing findings and the Poland supply alert, two pages
 * each. Page 1 frames the insight; page 2 outlines one area on the map and reads the panel for it.
 */
import {
  ALERT_CAMERA,
  ALERT_SCENE,
  ANATOLIA_AREA,
  BRIDGE_CAMERA,
  BRIDGE_SCENE,
  CORRIDOR_AREA,
  CORRIDOR_CAMERA,
  CORRIDOR_SCENE,
  EASTERN_CAMERA,
  EASTERN_STORY_SCENE,
  JUBAIL_AREA,
  JUBAIL_CAMERA,
  JUBAIL_SCENE,
  KAEC_AREA,
  KAEC_CAMERA,
  KAEC_SCENE,
  KINGDOM_CAMERA,
  KINGDOM_STORY_SCENE,
  MALHAM_AREA,
  MALHAM_CAMERA,
  MALHAM_SCENE,
  MAP,
  OPPORTUNITIES,
  REGION_COLOR,
  REGION_LABEL,
  REGION_ORDER,
  WDS_CAMERA,
  WDS_STORY_SCENE,
  WESTERN_CAMERA,
  WESTERN_STORY_SCENE,
} from './gamiPlaces'
import { PALETTE, type GamiPart, type GamiStory, type MapDataLayer, type PartId, type Status } from './gamiTypes'

export const WDS_OPENS = '2028-02-06T10:00:00+03:00'

const area = (label: string): MapDataLayer => ({
  group: 'area',
  title: 'Annotations',
  mark: 'area',
  color: { items: [{ label, color: MAP.area }] },
})

const SITE_LAYERS: MapDataLayer[] = [
  {
    group: 'sites',
    title: 'Defense Industrial Sites',
    mark: 'column',
    color: {
      items: [
        { label: 'Normal', color: MAP.site, count: '13' },
        { label: 'At risk', color: MAP.critical, count: '2' },
      ],
    },
    scale: 'height',
  },
  {
    group: 'zones',
    title: 'Licensed Industrial Zones',
    mark: 'disk',
    color: { items: [{ label: 'Licensed zone', color: MAP.zone, count: '9' }] },
    scale: 'size',
  },
]

const LICENCES_2026 = [
  { name: 'Granted', value: 51.34 },
  { name: 'Under review', value: 23.93 },
  { name: 'Applied', value: 18.47 },
  { name: 'Failed', value: 6.26 },
]

const OVERVIEW: GamiStory = {
  id: 'gami-overview',
  title: 'GAMI National Performance',
  description:
    'How the military industries sector is tracking against the 2026 plan and the 2030 localization goal: Saudi Made share, market size, jobs, investment, licences and e-services.',
  place: 'kingdom',
  pages: [
    {
      id: 'kingdom',
      title: 'Kingdom overview',
      finding: 'Saudi Made reached 29.4%, 94.8% of the 2026 plan, with ten weeks of the year left.',
      camera: KINGDOM_CAMERA,
      scene: KINGDOM_STORY_SCENE,
      polygons: [],
      filters: ['Kingdom-wide', '2026 YTD', 'All domains'],
      layers: SITE_LAYERS,
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'The sector is on track for 2026: Saudi Made reached ',
            { em: ['29.4%, 94.8% of plan'] },
            ', with SAR 46.5bn of military market and 66.4k jobs across 602 licensed companies. Export licences are the slowest service, with ',
            { em: ['9% of requests blocked'] },
            '.',
          ],
        },
        {
          id: 'plan',
          kind: 'progress',
          title: '2026 Plan Progress',
          rows: [
            { label: 'Saudi Made', value: '29.4%', target: 'of 31.0%', pct: 94.8 },
            { label: 'Military market', value: 'SAR 46.5bn', target: 'of 50bn', pct: 93 },
            { label: 'Jobs', value: '66.4k', target: 'of 73.5k', pct: 90.3 },
          ],
        },
        {
          id: 'trajectory',
          kind: 'line',
          title: 'Saudi Made vs 2030 Goal',
          kpi: { value: '29.4', unit: '% of 50%' },
          x: ['2023', '2024', '2025', '2026', '2028', '2030'],
          yLabels: ['50%', '25%', '0'],
          yMax: 50,
          series: [
            { name: 'Saudi Made', points: [19.4, 22.8, 26.1, 29.4, null, null] },
            { name: '2030 plan', points: [null, null, null, 29.4, 39.7, 50], dashed: true },
          ],
        },
        {
          id: 'domains',
          kind: 'hbars',
          title: 'Licensed Companies by Domain',
          bars: [
            { label: 'Electronics', value: 173, display: '173' },
            { label: 'Land', value: 151, display: '151' },
            { label: 'Air', value: 128, display: '128' },
            { label: 'Armament', value: 104, display: '104' },
            { label: 'Naval', value: 46, display: '46' },
          ],
        },
        {
          id: 'investment',
          kind: 'kpis',
          title: '2026 Investment Pipeline',
          tiles: [
            { label: 'Invested YTD', value: '18.6', unit: 'SAR bn' },
            { label: 'Potential to year end', value: '31.4', unit: 'SAR bn' },
          ],
        },
        {
          id: 'licences',
          kind: 'donut',
          title: '2026 License Status',
          total: '1,007',
          totalLabel: 'applications',
          slices: LICENCES_2026,
        },
        {
          id: 'eservices',
          kind: 'stacked',
          title: 'E-Services Status',
          height: 2,
          legend: ['Completed', 'In progress', 'Pending', 'New', 'Blocked', 'Canceled'],
          bars: [
            { label: 'Capability file', parts: [58, 18, 9, 8, 3, 4] },
            { label: 'Mfg licence', parts: [46, 22, 12, 10, 6, 4] },
            { label: 'Training', parts: [70, 12, 7, 6, 2, 3] },
            { label: 'Mfg permit', parts: [45, 21, 13, 11, 5, 5] },
            { label: 'Export licence', parts: [34, 24, 16, 12, 9, 5] },
            { label: 'Other (6)', parts: [51, 20, 11, 9, 4, 5] },
          ],
        },
      ],
    },
    {
      id: 'corridor',
      title: 'Riyadh–Al Kharj corridor',
      finding: 'The corridor holds 41% of licensed companies and both UAV sites at risk from the Poland alert.',
      camera: CORRIDOR_CAMERA,
      scene: CORRIDOR_SCENE,
      polygons: [CORRIDOR_AREA],
      filters: ['Riyadh–Al Kharj corridor', '2026 YTD', 'All domains'],
      layers: [
        area('Riyadh–Al Kharj corridor'),
        {
          group: 'sites',
          title: 'Corridor Industrial Sites',
          mark: 'column',
          color: {
            items: [
              { label: 'Normal', color: MAP.site, count: '8' },
              { label: 'At risk', color: MAP.critical, count: '2' },
            ],
          },
          scale: 'height',
        },
        {
          group: 'risk',
          title: 'UAV Sites at Risk',
          mark: 'disk',
          color: { items: [{ label: 'Poland supply', color: MAP.critical, count: '2' }] },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'The corridor carries ',
            { em: ['41% of licensed companies'] },
            ' (248 of 602) and SAR 7.9bn of this year’s investment. It also holds ',
            { em: ['both UAV sites at risk'] },
            ' from the Poland supply alert.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Corridor at a Glance',
          tiles: [
            { label: 'Companies', value: '248' },
            { label: 'Jobs', value: '27.1k' },
            { label: 'Invested YTD', value: '7.9', unit: 'SAR bn' },
          ],
        },
        {
          id: 'domains',
          kind: 'vbars',
          title: 'Corridor Companies by Domain',
          bars: [
            { label: 'Electronics', value: 83 },
            { label: 'Air', value: 61 },
            { label: 'Armament', value: 52 },
            { label: 'Land', value: 48 },
            { label: 'Naval', value: 4 },
          ],
        },
        {
          id: 'licences',
          kind: 'donut',
          title: 'Corridor License Status',
          total: '412',
          totalLabel: 'applications',
          slices: [
            { name: 'Granted', value: 214 },
            { name: 'Under review', value: 101 },
            { name: 'Applied', value: 74 },
            { name: 'Failed', value: 23 },
          ],
        },
        {
          id: 'sites',
          kind: 'table',
          title: 'Corridor Sites',
          columns: ['Site', 'Domain', 'Employees', 'Status'],
          statusColumn: 3,
          rows: [
            { cells: ['Riyadh UAV Integration', 'Air', '4,200', 'At risk'], status: 'critical' },
            { cells: ['Al-Kharj UAV Components', 'Air', '2,600', 'At risk'], status: 'critical' },
            { cells: ['Riyadh Electronics Park', 'Electronics', '7,900', 'Normal'], status: 'good' },
            { cells: ['Al-Kharj Armament', 'Armament', '6,800', 'Normal'], status: 'good' },
          ],
        },
      ],
    },
  ],
}

const OPPORTUNITY_RAMP = { ramp: MAP.valueRamp, low: 'SAR 2.6bn', high: 'SAR 6.8bn' }
const CAPACITY_LAYER: MapDataLayer = {
  group: 'capacity',
  title: 'Industrial Capacity',
  mark: 'heat',
  color: { ramp: MAP.densityRamp, low: 'Low', high: 'High' },
}

const LOCALIZATION: GamiStory = {
  id: 'gami-localization',
  title: 'GAMI Localization Opportunities',
  description:
    'Products that can be made on capability already in the Kingdom, by annual import-substitution value and city, and how much of it Jubail can take on now.',
  place: 'eastern',
  pages: [
    {
      id: 'eastern',
      title: 'Opportunities by city',
      finding: 'SAR 32.0bn a year of military imports can be made on capability already in the Kingdom.',
      camera: EASTERN_CAMERA,
      scene: EASTERN_STORY_SCENE,
      polygons: [],
      filters: ['Kingdom-wide', 'Import substitution', 'SAR bn / year'],
      layers: [
        { group: 'opportunities', title: 'Localization Opportunities', mark: 'disk', color: OPPORTUNITY_RAMP, scale: 'size' },
        CAPACITY_LAYER,
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            { em: ['SAR 32.0bn a year'] },
            ' of military imports can be made on capability already in the Kingdom. UAV airframes and propulsion are the largest, at SAR 6.8bn in Al-Kharj, and they also ',
            { em: ['close the Poland exposure'] },
            '.',
          ],
        },
        {
          id: 'opportunities',
          kind: 'vbars',
          title: 'Localization Opportunities',
          kpi: { value: '32.0', unit: 'SAR bn / yr' },
          bars: OPPORTUNITIES.map((item) => ({
            label: item.name.split(' ')[0].replace('Ammunition', 'Ammo'),
            value: item.value,
            display: item.value.toFixed(1),
          })),
        },
        {
          id: 'share',
          kind: 'hbars',
          title: 'Saudi Made Share by Domain',
          bars: [
            { label: 'Land', value: 38, display: '38%' },
            { label: 'Armament', value: 34, display: '34%' },
            { label: 'Naval', value: 27, display: '27%' },
            { label: 'Electronics', value: 24, display: '24%' },
            { label: 'Air', value: 19, display: '19%' },
          ],
        },
        {
          id: 'investment',
          kind: 'kpis',
          title: '2026 Investment Pipeline',
          tiles: [
            { label: 'Invested YTD', value: '18.6', unit: 'SAR bn' },
            { label: 'Potential to year end', value: '31.4', unit: 'SAR bn' },
          ],
        },
        {
          id: 'licences',
          kind: 'donut',
          title: '2026 License Status',
          total: '1,007',
          totalLabel: 'applications',
          slices: LICENCES_2026,
        },
      ],
    },
    {
      id: 'jubail',
      title: 'Jubail Industrial City',
      finding: 'Jubail can take SAR 10.6bn of the opportunities now, on serviced land with 37 qualified suppliers.',
      camera: JUBAIL_CAMERA,
      scene: JUBAIL_SCENE,
      polygons: [JUBAIL_AREA],
      filters: ['Jubail Industrial City', 'Import substitution', 'SAR bn / year'],
      layers: [
        area('Jubail Industrial City'),
        {
          group: 'suppliers',
          title: 'Qualified Suppliers',
          mark: 'column',
          color: {
            items: [
              { label: 'Ready', color: MAP.good, count: '3' },
              { label: 'Licence pending', color: MAP.pending, count: '2' },
            ],
          },
          scale: 'height',
        },
        { group: 'opportunities', title: 'Localization Opportunities', mark: 'disk', color: OPPORTUNITY_RAMP, scale: 'size' },
        CAPACITY_LAYER,
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'Jubail can take ',
            { em: ['SAR 10.6bn'] },
            ' of the opportunities now: ammunition and energetics (5.9bn) and armored vehicle subsystems (4.7bn), on 4.2 km² of serviced land with ',
            { em: ['37 qualified suppliers'] },
            '.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Jubail Readiness',
          tiles: [
            { label: 'Serviced land', value: '4.2', unit: 'km²' },
            { label: 'Qualified suppliers', value: '37' },
            { label: 'First output', value: '14', unit: 'months' },
          ],
        },
        {
          id: 'readiness',
          kind: 'grouped',
          title: 'Supplier Readiness by Capability',
          legend: ['Ready', 'Needs licence', 'Gap'],
          groups: [
            { label: 'Energetics', values: [9, 4, 2] },
            { label: 'Armor steel', values: [12, 3, 1] },
            { label: 'Composites', values: [5, 6, 4] },
            { label: 'Machining', values: [11, 2, 1] },
          ],
        },
        {
          id: 'projects',
          kind: 'table',
          title: 'Candidate Projects',
          columns: ['Project', 'Value', 'Start', 'Status'],
          statusColumn: 3,
          rows: [
            { cells: ['Armor plate line', 'SAR 2.6bn', 'Q1 2027', 'Ready'], status: 'good' },
            { cells: ['Vehicle subsystems hub', 'SAR 2.1bn', 'Q4 2027', 'Ready'], status: 'good' },
            { cells: ['Propellant & charge plant', 'SAR 3.1bn', 'Q3 2027', 'Licence'], status: 'moderate' },
            { cells: ['Shell forging works', 'SAR 2.8bn', '2028', 'Land'], status: 'mild' },
          ],
        },
      ],
    },
  ],
}

const REGIONS: Record<keyof typeof REGION_COLOR, number> = {
  europe: 612,
  'middle-east': 498,
  asia: 404,
  'north-america': 236,
  africa: 118,
  'latin-america': 72,
}

const WDS: GamiStory = {
  id: 'gami-wds',
  title: 'World Defense Show 2028',
  description:
    'The exhibitor pipeline, delegations and venue readiness for World Defense Show 2028 in Malham, Riyadh.',
  place: 'wds',
  pages: [
    {
      id: 'world',
      title: 'Global pipeline',
      finding: '1,940 exhibitors from 94 countries have applied, 32% ahead of 2026.',
      camera: WDS_CAMERA,
      scene: WDS_STORY_SCENE,
      polygons: [],
      filters: ['WDS 2028', 'All regions', 'Applications'],
      layers: [
        {
          group: 'delegations',
          title: 'Exhibitor Delegations',
          mark: 'line',
          color: {
            items: REGION_ORDER.map((region) => ({
              label: REGION_LABEL[region],
              color: REGION_COLOR[region],
              count: REGIONS[region].toLocaleString('en-US'),
            })),
          },
        },
        {
          group: 'venue',
          title: 'Venue',
          mark: 'disk',
          color: { items: [{ label: 'Malham, Riyadh', color: PALETTE.categorical[4] }] },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'World Defense Show 2028 opens in Riyadh in 15 months. ',
            { em: ['1,940 exhibitors'] },
            ' from 94 countries have applied, already ',
            { em: ['32% ahead of 2026'] },
            ', with USD 10.2bn in contracts expected.',
          ],
        },
        { id: 'countdown', kind: 'countdown', title: 'WDS 2028 Countdown', target: WDS_OPENS },
        {
          id: 'outlook',
          kind: 'kpis',
          title: 'WDS Outlook',
          tiles: [
            { label: 'Countries', value: '94', note: '2026: 76' },
            { label: 'Visitors', value: '155k', note: '2026: 137k' },
            { label: 'Contracts', value: '10.2', unit: 'USD bn', note: '+16% on 2026' },
          ],
        },
        {
          id: 'exhibitors',
          kind: 'split',
          title: 'WDS Exhibitors',
          total: '1,940',
          unit: 'Applications',
          parts: [
            { name: 'Confirmed', value: 1085, display: '1,085' },
            { name: 'Under review', value: 435, display: '435' },
            { name: 'Applied', value: 420, display: '420' },
          ],
        },
        {
          id: 'regions',
          kind: 'hbars',
          title: 'Applications by Region',
          bars: REGION_ORDER.map((region) => ({
            label: REGION_LABEL[region],
            value: REGIONS[region],
            display: REGIONS[region].toLocaleString('en-US'),
          })),
        },
      ],
    },
    {
      id: 'venue',
      title: 'Malham venue',
      finding: 'Halls are 82% ready; roads and shuttles are the tightest link at 64%.',
      camera: MALHAM_CAMERA,
      scene: MALHAM_SCENE,
      polygons: [MALHAM_AREA],
      filters: ['Malham venue', 'WDS 2028', 'Readiness'],
      layers: [
        area('Malham exhibition venue'),
        {
          group: 'halls',
          title: 'Exhibitor Stands by Hall',
          mark: 'column',
          color: { ramp: MAP.siteRamp, low: 'Fewer', high: 'More' },
          scale: 'height',
        },
        { group: 'visitors', title: 'Expected Visitor Density', mark: 'heat', color: { ramp: MAP.densityRamp, low: 'Quiet', high: 'Peak' } },
        {
          group: 'shuttles',
          title: 'Shuttle Routes',
          mark: 'line',
          color: { items: [{ label: 'Airport, city and KAFD', color: PALETTE.categorical[2], count: '4' }] },
        },
        {
          group: 'display',
          title: 'Flying Display',
          mark: 'disk',
          color: { items: [{ label: 'Display zone', color: MAP.zone }] },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'The venue must hold 1,940 exhibitors across 5 halls and the outdoor display. Halls are ',
            { em: ['82% ready'] },
            '; roads and shuttles are the tightest link at ',
            { em: ['64%'] },
            ', for a peak of 41,000 visitors a day.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Venue Capacity',
          tiles: [
            { label: 'Indoor halls', value: '172k', unit: 'm²' },
            { label: 'Outdoor display', value: '380k', unit: 'm²' },
            { label: 'Peak visitors', value: '41k', unit: '/ day' },
          ],
        },
        {
          id: 'readiness',
          kind: 'progress',
          title: 'Venue Readiness',
          rows: [
            { label: 'Exhibition halls', value: '82%', target: 'ready', pct: 82 },
            { label: 'Flying display & runway', value: '74%', target: 'ready', pct: 74 },
            { label: 'Roads & shuttles', value: '64%', target: 'ready', pct: 64 },
            { label: 'Hotels within 40 km', value: '58%', target: 'booked', pct: 58 },
          ],
        },
        {
          id: 'visitors',
          kind: 'line',
          title: 'Visitors per Show Day',
          kpi: { value: '41k', unit: 'peak on day 2' },
          x: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
          yLabels: ['45k', '20k', '0'],
          yMax: 45,
          series: [
            { name: '2028 plan', points: [28, 41, 38, 30, 18] },
            { name: '2026 actual', points: [24, 35, 33, 26, 19], dashed: true },
          ],
        },
        {
          id: 'halls',
          kind: 'stacked',
          title: 'Hall Allocation by Domain',
          height: 2,
          legend: ['Air', 'Armament', 'Land', 'Naval', 'Electronics'],
          bars: [
            { label: 'Hall 1', parts: [70, 8, 6, 4, 12] },
            { label: 'Hall 2', parts: [6, 14, 66, 4, 10] },
            { label: 'Hall 3', parts: [10, 6, 8, 4, 72] },
            { label: 'Hall 4', parts: [8, 68, 12, 4, 8] },
            { label: 'Hall 5', parts: [6, 10, 8, 62, 14] },
          ],
        },
      ],
    },
  ],
}

const TALENT: GamiStory = {
  id: 'gami-talent',
  title: 'GAMI Human Capital',
  description:
    'The skills the sector is short of today and by 2030, the internship and academy funnels that close the gap, and where roles go unfilled.',
  place: 'western',
  pages: [
    {
      id: 'western',
      title: 'Western Region',
      finding: 'The sector is 6,350 skilled people short today, rising to 10,600 by 2030.',
      camera: WESTERN_CAMERA,
      scene: WESTERN_STORY_SCENE,
      polygons: [],
      filters: ['Western Region', 'Top 4 skills', 'Today · 2027 · 2030'],
      layers: [
        { group: 'gap', title: 'Skills Gap by City', mark: 'disk', color: { ramp: MAP.valueRamp, low: '180', high: '980' }, scale: 'size' },
        {
          group: 'academies',
          title: 'Training Institutes',
          mark: 'column',
          color: { items: [{ label: 'Graduates a year', color: MAP.site, count: '4' }] },
          scale: 'height',
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'The sector is ',
            { em: ['6,350 skilled people short'] },
            ' today, rising to 10,600 by 2030. The Western Region has the most unfilled roles, 2,140, and ',
            { em: ['UAV systems integration'] },
            ' is the fastest-growing gap.',
          ],
        },
        {
          id: 'skills',
          kind: 'grouped',
          title: 'Skills Gap',
          ordered: true,
          legend: ['Today', '2027', '2030'],
          groups: [
            { label: 'Avionics', values: [1800, 2250, 2900] },
            { label: 'Machining', values: [1750, 2150, 2800] },
            { label: 'Cyber & EW', values: [1550, 2000, 2700] },
            { label: 'UAV integration', values: [1250, 1700, 2200] },
          ],
        },
        {
          id: 'funnels',
          kind: 'grouped',
          title: 'Training Funnels',
          legend: ['Internships', 'Academy'],
          groups: [
            { label: 'Applied', values: [4860, 3250] },
            { label: 'Selected', values: [1920, 1410] },
            { label: 'In training', values: [740, 860] },
            { label: 'Graduated', values: [515, 620] },
          ],
        },
        {
          id: 'regions',
          kind: 'hbars',
          title: 'Unfilled Roles by Region',
          bars: [
            { label: 'Western', value: 2140, display: '2,140' },
            { label: 'Riyadh', value: 1980, display: '1,980' },
            { label: 'Eastern', value: 1610, display: '1,610' },
            { label: 'Other regions', value: 620, display: '620' },
          ],
        },
      ],
    },
    {
      id: 'kaec',
      title: 'KAEC cluster',
      finding: 'KAEC has 640 unfilled roles; its institute graduates 180 a year.',
      camera: KAEC_CAMERA,
      scene: KAEC_SCENE,
      polygons: [KAEC_AREA],
      filters: ['KAEC industrial cluster', 'Top 4 skills', '2026'],
      layers: [
        area('KAEC industrial cluster'),
        {
          group: 'roles',
          title: 'Open Roles by Employer',
          mark: 'column',
          color: { ramp: MAP.siteRamp, low: '90', high: '214' },
          scale: 'height',
        },
        { group: 'applicants', title: 'Applicant Density', mark: 'heat', color: { ramp: MAP.densityRamp, low: 'Few', high: 'Many' } },
        {
          group: 'institute',
          title: 'Training Institutes',
          mark: 'disk',
          color: { items: [{ label: 'KAEC Technical Institute', color: MAP.zone }] },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'KAEC has ',
            { em: ['640 unfilled roles'] },
            ' across 8 employers, 412 of them in machining and UAV integration. Its institute graduates ',
            { em: ['180 a year'] },
            ', so the cluster needs a second intake to close the gap by 2028.',
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'KAEC Talent at a Glance',
          tiles: [
            { label: 'Unfilled roles', value: '640' },
            { label: 'Graduates / yr', value: '180' },
            { label: 'Time to hire', value: '5.2', unit: 'months' },
          ],
        },
        {
          id: 'skills',
          kind: 'hbars',
          title: 'KAEC Gap by Skill',
          bars: [
            { label: 'Precision machining', value: 210, display: '210' },
            { label: 'UAV integration', value: 202, display: '202' },
            { label: 'Avionics', value: 128, display: '128' },
            { label: 'Cyber & EW', value: 100, display: '100' },
          ],
        },
        {
          id: 'pipeline',
          kind: 'line',
          title: 'Graduates vs Roles Needed',
          kpi: { value: '2028', unit: 'gap closes' },
          x: ['2024', '2025', '2026', '2027', '2028'],
          yLabels: ['450', '225', '0'],
          yMax: 450,
          series: [
            { name: 'Graduates, with 2nd intake', points: [110, 140, 180, 300, 420] },
            { name: 'Roles needed', points: [300, 340, 380, 400, 420], dashed: true },
          ],
        },
        {
          id: 'employers',
          kind: 'table',
          title: 'KAEC Employers',
          columns: ['Employer', 'Domain', 'Open roles'],
          rows: [
            { cells: ['KAEC Land Systems Plant', 'Land', '214'] },
            { cells: ['Red Sea Composites', 'Air', '126'] },
            { cells: ['Western UAV Assembly', 'Air', '118'] },
            { cells: ['Coastal Electronics Works', 'Electronics', '92'] },
          ],
        },
      ],
    },
  ],
}

export const GAMI_PARTS: Record<PartId, GamiPart> = {
  motor: {
    id: 'motor',
    name: 'Brushless propulsion motor',
    short: 'Propulsion motor',
    supplier: 'Rzeszow Propulsion Works',
    city: 'Rzeszów, Poland',
    monthlyNeed: '1,800 / month',
    stockDays: 41,
    programmes: ['Najm', 'Sahm', 'Rimah'],
    role: 'Turns the propellers: four per aircraft on Najm and Sahm, two on Rimah. Without it, no airframe leaves the line.',
    specs: [
      ['Power', '4.2 kW continuous'],
      ['Peak thrust', '18 kg per motor'],
      ['Mass', '1.1 kg'],
      ['Voltage', '48 V'],
      ['Duty life', '1,500 h'],
      ['Imported from Poland', '100%'],
    ],
    stock: [41, 34, 27, 20, 13, 6, 0],
    deliveries: [1820, 1790, 1810, 1760, 620, 0],
    exposure: [
      { label: 'Najm', value: 1100, display: '1,100 units' },
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: {
      supplier: 'Ankara Propulsion Systems Park',
      city: 'Ankara',
      capacity: '2,000 / month',
      leadTime: '30 days',
      cost: '+8%',
      qualified: 'AS9100 · qualified 2024',
    },
    plan: [
      { step: 'Bridge purchase order issued', when: 'Week 1' },
      { step: 'First-article inspection, Riyadh', when: 'Week 3' },
      { step: 'First delivery, 2,000 units', when: 'Day 30' },
      { step: 'Full monthly volume', when: 'Day 45' },
    ],
  },
  gimbal: {
    id: 'gimbal',
    name: 'EO/IR gimbal assembly',
    short: 'EO/IR gimbal',
    supplier: 'Krakow Optronics Plant',
    city: 'Kraków, Poland',
    monthlyNeed: '240 / month',
    stockDays: 47,
    programmes: ['Sahm', 'Rimah'],
    role: 'Carries the day camera and cooled thermal sensor under the nose, for surveillance and target designation.',
    specs: [
      ['Sensors', 'HD day + cooled MWIR'],
      ['Zoom', '30× optical'],
      ['Stabilisation', '< 25 µrad'],
      ['Mass', '2.8 kg'],
      ['Field of regard', '360° continuous'],
      ['Imported from Poland', '100%'],
    ],
    stock: [47, 40, 33, 26, 19, 12, 5],
    deliveries: [245, 238, 242, 236, 90, 0],
    exposure: [
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: {
      supplier: 'Eskişehir Optronics Works',
      city: 'Eskişehir',
      capacity: '260 / month',
      leadTime: '35 days',
      cost: '+9%',
      qualified: 'AS9100 · qualified 2023',
    },
    plan: [
      { step: 'Bridge purchase order issued', when: 'Week 1' },
      { step: 'Boresight and image tests', when: 'Week 4' },
      { step: 'First delivery, 260 units', when: 'Day 35' },
      { step: 'Full monthly volume', when: 'Day 50' },
    ],
  },
  inu: {
    id: 'inu',
    name: 'Inertial navigation unit',
    short: 'Navigation unit',
    supplier: 'Gdansk Navigation Systems',
    city: 'Gdańsk, Poland',
    monthlyNeed: '420 / month',
    stockDays: 58,
    programmes: ['Najm', 'Sahm', 'Rimah'],
    role: 'Keeps the aircraft on course when GNSS is jammed or denied, and steadies the autopilot in every flight.',
    specs: [
      ['Gyro drift', '0.1 °/h'],
      ['GNSS-denied', '30 min to 1% drift'],
      ['Update rate', '400 Hz'],
      ['Mass', '0.7 kg'],
      ['Interface', 'RS-422 · CAN'],
      ['Imported from Poland', '100%'],
    ],
    stock: [58, 51, 44, 37, 30, 23, 16],
    deliveries: [425, 418, 430, 410, 160, 0],
    exposure: [
      { label: 'Najm', value: 1100, display: '1,100 units' },
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: {
      supplier: 'Konya Inertial Systems',
      city: 'Konya',
      capacity: '450 / month',
      leadTime: '32 days',
      cost: '+7%',
      qualified: 'AS9100 · qualified 2025',
    },
    plan: [
      { step: 'Bridge purchase order issued', when: 'Week 1' },
      { step: 'Calibration and flight tests', when: 'Week 3' },
      { step: 'First delivery, 450 units', when: 'Day 32' },
      { step: 'Full monthly volume', when: 'Day 45' },
    ],
  },
}

type Level = 'Critical' | 'Moderate' | 'Mild'

/** The 20 imports from Poland the conflict cut off, most critical first. */
export const AFFECTED_IMPORTS: { item: string; domain: string; days: number; level: Level }[] = [
  { item: 'Brushless propulsion motors', domain: 'Air', days: 41, level: 'Critical' },
  { item: 'EO/IR gimbal assemblies', domain: 'Electronics', days: 47, level: 'Critical' },
  { item: 'Inertial navigation units', domain: 'Electronics', days: 58, level: 'Critical' },
  { item: 'Carbon-fibre prepreg', domain: 'Air', days: 64, level: 'Moderate' },
  { item: 'Li-ion battery packs', domain: 'Electronics', days: 72, level: 'Moderate' },
  { item: 'Servo actuators', domain: 'Air', days: 75, level: 'Moderate' },
  { item: 'Composite propeller blades', domain: 'Air', days: 81, level: 'Moderate' },
  { item: 'RF power amplifiers', domain: 'Electronics', days: 88, level: 'Moderate' },
  { item: 'Armored glass laminates', domain: 'Land', days: 92, level: 'Moderate' },
  { item: 'Titanium fasteners', domain: 'Armament', days: 96, level: 'Moderate' },
  { item: 'Hydraulic seals', domain: 'Land', days: 104, level: 'Moderate' },
  { item: 'Wiring harness connectors', domain: 'Electronics', days: 120, level: 'Mild' },
  { item: 'Thermal camera lenses', domain: 'Electronics', days: 126, level: 'Mild' },
  { item: 'Ballistic fabric', domain: 'Land', days: 133, level: 'Mild' },
  { item: 'Steel forgings', domain: 'Armament', days: 140, level: 'Mild' },
  { item: 'Marine pump impellers', domain: 'Naval', days: 150, level: 'Mild' },
  { item: 'Parachute canopies', domain: 'Air', days: 170, level: 'Mild' },
  { item: 'Rubber track pads', domain: 'Land', days: 180, level: 'Mild' },
  { item: 'Propellant binders', domain: 'Armament', days: 190, level: 'Mild' },
  { item: 'Antenna radomes', domain: 'Air', days: 210, level: 'Mild' },
]

const LEVEL_STATUS: Record<Level, Status> = { Critical: 'critical', Moderate: 'moderate', Mild: 'mild' }

const RECEIVERS_LAYER: MapDataLayer = {
  group: 'receivers',
  title: 'UAV Sites at Risk',
  mark: 'disk',
  color: { items: [{ label: 'Riyadh · Al-Kharj', color: MAP.critical, count: '2' }] },
}

const ALERT: GamiStory = {
  id: 'gami-alert',
  title: 'Drone Supply: Bridge Through Türkiye',
  description:
    'The Poland–Russia conflict suspended export permits for 20 components Saudi military industries import from Poland. Three are critical to the national UAV programmes; Türkiye can bridge supply until local production starts.',
  place: 'kingdom',
  pages: [
    {
      id: 'disruption',
      title: 'Poland disruption',
      finding: '20 imports from Poland are cut off; 3 are critical to Saudi UAV production, with 41 days of stock left.',
      camera: ALERT_CAMERA,
      scene: ALERT_SCENE,
      polygons: [],
      filters: ['Poland', 'Critical components', 'UAV programmes'],
      layers: [
        {
          group: 'routes',
          title: 'Critical Supply Routes',
          mark: 'line',
          color: { items: [{ label: 'Suspended from Poland', color: MAP.critical, count: '3' }] },
        },
        {
          group: 'suppliers',
          title: 'Poland Supplier Sites',
          mark: 'disk',
          color: { items: [{ label: 'Exports suspended', color: MAP.critical, count: '3' }] },
        },
        RECEIVERS_LAYER,
        { group: 'conflict', title: 'Conflict Intensity', mark: 'heat', color: { ramp: MAP.conflictRamp, low: 'Low', high: 'High' } },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'The Poland–Russia conflict suspended export permits for ',
            { em: ['20 components'] },
            ' Saudi military industries import from Poland. ',
            { em: ['3 are critical'] },
            ' to the national UAV programmes: propulsion motors, EO/IR gimbals and navigation units.',
          ],
        },
        { id: 'part-motor', kind: 'part', size: 'large', title: 'Propulsion Motor', part: 'motor' },
        { id: 'part-gimbal', kind: 'part', span: 'cell', title: 'EO/IR Gimbal', part: 'gimbal' },
        { id: 'part-inu', kind: 'part', span: 'cell', title: 'Navigation Unit', part: 'inu' },
        {
          id: 'critical',
          kind: 'cell',
          span: 'cell',
          title: 'Motor stock left',
          value: '41 days',
          note: 'before UAV production stops',
        },
        {
          id: 'affected',
          kind: 'cell',
          span: 'cell',
          title: 'Affected imports',
          value: '20',
          note: '3 critical · 8 moderate · 9 mild',
        },
        {
          id: 'imports',
          kind: 'table',
          title: 'Affected Imports',
          height: 2,
          columns: ['Item', 'Domain', 'Stock', 'Severity'],
          statusColumn: 3,
          rows: AFFECTED_IMPORTS.map((entry) => ({
            cells: [entry.item, entry.domain, `${entry.days} d`, entry.level],
            status: LEVEL_STATUS[entry.level],
          })),
        },
        {
          id: 'programmes',
          kind: 'hbars',
          title: 'UAV Programmes at Risk',
          bars: [
            { label: 'Najm', value: 1100, display: '1,100 units' },
            { label: 'Sahm', value: 640, display: '640 units' },
            { label: 'Rimah', value: 420, display: '420 units' },
          ],
        },
      ],
    },
    {
      id: 'turkiye',
      title: 'Bridge through Türkiye',
      finding: 'Turkish suppliers deliver in 30 days, 11 days before stock runs out, at 8% extra cost.',
      camera: BRIDGE_CAMERA,
      scene: BRIDGE_SCENE,
      polygons: [ANATOLIA_AREA],
      filters: ['Türkiye', 'Critical components', 'Bridge to 2029'],
      layers: [
        area('Ankara–Eskişehir–Konya suppliers'),
        {
          group: 'routes',
          title: 'Bridge Supply Routes',
          mark: 'line',
          color: { items: [{ label: 'Recommended', color: MAP.good, count: '3' }] },
        },
        {
          group: 'suppliers',
          title: 'Türkiye Supplier Sites',
          mark: 'disk',
          color: { items: [{ label: 'Bridge supplier', color: MAP.good, count: '3' }] },
        },
        RECEIVERS_LAYER,
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Llumen AI Summary',
          parts: [
            'Switching the 3 critical items to Turkish suppliers lands first deliveries in ',
            { em: ['30 days'] },
            ', 11 days before motor stock runs out, at ',
            { em: ['8% extra cost'] },
            '. Türkiye bridges supply for 3 years, until local production starts in 2029.',
          ],
        },
        {
          id: 'action',
          kind: 'kpis',
          title: 'Recommended Action: Switch to Türkiye',
          tiles: [
            { label: 'First delivery', value: '30', unit: 'days' },
            { label: 'Extra cost', value: '8', unit: '%' },
            { label: 'Bridge', value: '3', unit: 'years' },
          ],
        },
        {
          id: 'options',
          kind: 'table',
          title: 'Sourcing Options',
          columns: ['Option', 'Status', 'Lead time', 'Cost'],
          statusColumn: 1,
          rows: [
            { cells: ['Poland', 'Blocked', 'Suspended', 'Baseline'], status: 'critical' },
            { cells: ['Türkiye', 'Recommended', '30–35 days', '+8%'], status: 'good' },
            { cells: ['Local', 'In progress', '2029', '−12%'], status: 'mild' },
          ],
        },
        {
          id: 'timeline',
          kind: 'range',
          title: 'Supply Bridge Timeline',
          min: -24,
          max: 48,
          ticks: [-24, 0, 12, 24, 36, 48],
          rows: [
            { label: 'Poland', from: -24, to: 0, status: 'critical' },
            { label: 'Türkiye', from: 1, to: 36, status: 'good' },
            { label: 'Local', from: 30, to: 48 },
          ],
        },
        {
          id: 'capacity',
          kind: 'hbars',
          title: 'Türkiye Capacity vs Need',
          bars: [
            { label: 'Motors · Ankara', value: 111, display: '111%' },
            { label: 'Gimbals · Eskişehir', value: 108, display: '108%' },
            { label: 'Nav units · Konya', value: 107, display: '107%' },
          ],
        },
        {
          id: 'cover',
          kind: 'line',
          title: 'Motor Stock Cover',
          kpi: { value: '52', unit: 'days by week 12' },
          x: ['Today', 'W2', 'W4', 'W6', 'W8', 'W10', 'W12'],
          yLabels: ['60 d', '30 d', '0'],
          yMax: 60,
          series: [
            { name: 'With Türkiye', points: [41, 27, 22, 30, 38, 45, 52], status: 'good' },
            { name: 'Without switch', points: [41, 27, 13, 0, 0, 0, 0], dashed: true },
          ],
        },
      ],
    },
  ],
}

export const GAMI_STORIES: Record<string, GamiStory> = Object.fromEntries(
  [OVERVIEW, LOCALIZATION, WDS, TALENT, ALERT].map((story) => [story.id, story]),
)

export function isGamiStory(id: string | null | undefined): id is string {
  return Boolean(id && id in GAMI_STORIES)
}
