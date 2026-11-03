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
  DOMAIN_COLOR,
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
  OPPORTUNITIES,
  REGION_COLOR,
  REGION_LABEL,
  WDS_CAMERA,
  WDS_STORY_SCENE,
  WESTERN_CAMERA,
  WESTERN_STORY_SCENE,
} from './gamiPlaces'
import { TONE, type GamiPart, type GamiStory, type MapDataLayer, type PartId, type Tone } from './gamiTypes'

export const WDS_OPENS = '2028-02-06T10:00:00+03:00'

const DOMAIN_TONE: Record<keyof typeof DOMAIN_COLOR, Tone> = {
  air: 'sky',
  armament: 'gold',
  land: 'teal',
  naval: 'blue',
  electronics: 'violet',
}

const SITE_LAYERS: MapDataLayer[] = [
  {
    group: 'sites-pins',
    title: 'Defense Industrial Sites GAMI',
    items: [
      { mark: 'pin', color: TONE.teal, label: 'Normal', count: '10' },
      { mark: 'pin', color: TONE.red, label: 'At risk', count: '2' },
    ],
  },
  {
    group: 'sites-columns',
    title: 'Workforce by Site GAMI',
    items: [
      { mark: 'column', color: TONE.teal, label: 'Employees per company cluster' },
      { mark: 'column', color: TONE.red, label: 'UAV sites at risk' },
    ],
  },
  {
    group: 'sites-disks',
    title: 'Industrial Zones GAMI',
    items: [{ mark: 'disk', color: TONE.teal, label: 'Licensed industrial zone', count: '12' }],
  },
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
          title: 'Summary',
          parts: [
            { text: 'The sector is on track for 2026: Saudi Made reached ' },
            { text: '29.4%, 94.8% of plan', tone: 'teal' },
            { text: ', with SAR 46.5bn of military market and 66.4k jobs. Export licences are the slowest service, with ' },
            { text: '9% of requests blocked', tone: 'red' },
            { text: '.' },
          ],
        },
        {
          id: 'plan',
          kind: 'progress',
          title: '2026 Plan Progress GAMI',
          rows: [
            { label: 'Saudi Made', value: '29.4%', target: 'of 31.0%', pct: 94.8, tone: 'teal' },
            { label: 'Military market', value: 'SAR 46.5bn', target: 'of 50bn', pct: 93, tone: 'gold' },
            { label: 'Jobs', value: '66.4k', target: 'of 73.5k', pct: 90.3, tone: 'sky' },
          ],
          footer: 'On track, with ten weeks of 2026 left.',
        },
        {
          id: 'trajectory',
          kind: 'line',
          title: 'Saudi Made Trajectory GAMI',
          x: ['2023', '2026', '2027', '2030'],
          yMax: 100,
          ySuffix: '%',
          goal: { value: 100, label: '2030 goal' },
          series: [
            { name: 'Saudi Made', tone: 'teal', points: [38.8, 58.8, null, null] },
            { name: 'Saudi Made plan', tone: 'teal', points: [null, 58.8, 68, 100], faded: true },
            { name: 'Share of GDP', tone: 'yellow', points: [48, 66, null, null] },
            { name: 'GDP plan', tone: 'yellow', points: [null, 66, 73.3, 100], faded: true },
          ],
          footer: '29.4% is 59% of the 50% goal · GDP share 0.99%. Next year: 34.0% and 1.10%.',
        },
        {
          id: 'domains',
          kind: 'kpis',
          title: 'Licensed Companies by Domain GAMI',
          tiles: [
            { label: 'Air', value: '128', icon: 'air', tone: 'sky' },
            { label: 'Armament', value: '104', icon: 'armament', tone: 'gold' },
            { label: 'Land', value: '151', icon: 'land', tone: 'teal' },
            { label: 'Naval', value: '46', icon: 'naval', tone: 'blue' },
            { label: 'Electronics', value: '173', icon: 'electronics', tone: 'violet' },
          ],
          footer: '602 licensed companies in total.',
        },
        {
          id: 'investment',
          kind: 'kpis',
          title: '2026 Investment Pipeline GAMI',
          tiles: [
            { label: 'Invested YTD', value: '18.6', unit: 'SAR bn', tone: 'green' },
            { label: 'Potential to year end', value: '31.4', unit: 'SAR bn', tone: 'sky' },
          ],
          footer: 'SAR 50bn if the potential converts.',
        },
        {
          id: 'licences',
          kind: 'donut',
          title: '2026 License Status GAMI',
          total: '1,007',
          totalLabel: 'applications',
          slices: [
            { name: 'Applied', value: 18.47, tone: 'grey' },
            { name: 'Under review', value: 23.93, tone: 'amber' },
            { name: 'Granted', value: 51.34, tone: 'green' },
            { name: 'Failed', value: 6.26, tone: 'red' },
          ],
        },
        {
          id: 'eservices',
          kind: 'stacked',
          title: 'E-Services Status GAMI',
          height: 2,
          legend: [
            { name: 'New', tone: 'ice' },
            { name: 'Pending', tone: 'yellow' },
            { name: 'In progress', tone: 'sky' },
            { name: 'Blocked', tone: 'red' },
            { name: 'Completed', tone: 'green' },
            { name: 'Canceled', tone: 'grey' },
          ],
          bars: [
            { label: 'Capability file', parts: [8, 9, 18, 3, 58, 4] },
            { label: 'Mfg licence', parts: [10, 12, 22, 6, 46, 4] },
            { label: 'Training', parts: [6, 7, 12, 2, 70, 3] },
            { label: 'Mfg permit', parts: [11, 13, 21, 5, 45, 5] },
            { label: 'Export licence', parts: [12, 16, 24, 9, 34, 5] },
            { label: 'Other (6)', parts: [9, 11, 20, 4, 51, 5] },
          ],
          footer: '8,720 requests across 11 services · 50% completed. Export licences have the highest blocked share, 9%.',
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
        {
          group: 'area',
          title: 'Annotations',
          items: [{ mark: 'area', color: TONE.sky, label: 'Riyadh–Al Kharj corridor' }],
        },
        ...SITE_LAYERS,
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Riyadh–Al Kharj corridor',
          parts: [
            { text: 'The corridor carries ' },
            { text: '41% of licensed companies', tone: 'sky' },
            { text: ' (248 of 602) and SAR 7.9bn of this year’s investment. It also holds ' },
            { text: 'both UAV sites at risk', tone: 'red' },
            { text: ' from the Poland supply alert.' },
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Corridor at a Glance GAMI',
          tiles: [
            { label: 'Companies', value: '248', tone: 'sky' },
            { label: 'Jobs', value: '27.1k', tone: 'teal' },
            { label: 'Invested YTD', value: '7.9', unit: 'SAR bn', tone: 'green' },
          ],
          footer: '42% of the Kingdom’s 2026 investment so far.',
        },
        {
          id: 'domains',
          kind: 'vbars',
          title: 'Corridor Companies by Domain GAMI',
          bars: [
            { label: 'Air', value: 61, tone: 'sky' },
            { label: 'Armament', value: 52, tone: 'gold' },
            { label: 'Land', value: 48, tone: 'teal' },
            { label: 'Naval', value: 4, tone: 'blue' },
            { label: 'Electronics', value: 83, tone: 'violet' },
          ],
          footer: 'Electronics and air lead; 2 of the 61 air sites build UAVs.',
        },
        {
          id: 'licences',
          kind: 'donut',
          title: 'Corridor License Status GAMI',
          total: '412',
          totalLabel: 'applications',
          slices: [
            { name: 'Applied', value: 74, tone: 'grey' },
            { name: 'Under review', value: 101, tone: 'amber' },
            { name: 'Granted', value: 214, tone: 'green' },
            { name: 'Failed', value: 23, tone: 'red' },
          ],
        },
        {
          id: 'sites',
          kind: 'table',
          title: 'Corridor Sites GAMI',
          columns: ['Site', 'Domain', 'Employees', 'Status'],
          pillColumn: 3,
          rows: [
            { cells: ['Riyadh UAV Integration Facility', 'Air', '4,200', 'At risk'], tone: 'red' },
            { cells: ['Al-Kharj UAV Components Plant', 'Air', '2,600', 'At risk'], tone: 'red' },
            { cells: ['Riyadh Defense Electronics Park', 'Electronics', '7,900', 'Normal'], tone: 'teal' },
            { cells: ['Al-Kharj Armament Complex', 'Armament', '6,800', 'Normal'], tone: 'teal' },
          ],
        },
      ],
    },
  ],
}

const LOCALIZATION: GamiStory = {
  id: 'gami-localization',
  title: 'GAMI Localization Opportunities',
  description:
    'Products that can be made on capability already in the Kingdom, by annual import-substitution value, and where the Eastern Province can take them on.',
  place: 'eastern',
  pages: [
    {
      id: 'eastern',
      title: 'Eastern Province',
      finding: 'SAR 32.0bn a year of military imports can be made on capability already in the Kingdom.',
      camera: EASTERN_CAMERA,
      scene: EASTERN_STORY_SCENE,
      polygons: [],
      filters: ['Eastern Province', 'Import substitution', 'SAR bn / year'],
      layers: [
        {
          group: 'opportunity-disks',
          title: 'Localization Opportunities GAMI',
          items: OPPORTUNITIES.map((item) => ({
            mark: 'disk' as const,
            color: DOMAIN_COLOR[item.domain],
            label: item.name,
            count: item.value.toFixed(1),
          })),
        },
        {
          group: 'capacity-heat',
          title: 'Industrial Capacity GAMI',
          items: [],
          ramp: { colors: ['#123a6b', '#2c6fd1', '#2de8c8', '#e8d44d', '#ffc401'], low: 'Low', high: 'High' },
        },
        {
          group: 'sites-pins',
          title: 'Defense Industrial Sites GAMI',
          items: [{ mark: 'pin', color: TONE.teal, label: 'Normal', count: '2' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { text: 'SAR 32.0bn a year', tone: 'gold' },
            { text: ' of military imports can be made on capability already in the Kingdom. UAV airframes and propulsion are the largest, at SAR 6.8bn, and they also ' },
            { text: 'close the Poland exposure', tone: 'red' },
            { text: '.' },
          ],
        },
        {
          id: 'opportunities',
          kind: 'vbars',
          title: 'Localization Opportunities (SAR bn/yr) GAMI',
          unit: 'SAR bn',
          bars: OPPORTUNITIES.map((item) => ({
            label: item.name.split(' ')[0].replace('Ammunition', 'Ammo'),
            value: item.value,
            display: item.value.toFixed(1),
            tone: DOMAIN_TONE[item.domain],
          })),
          footer: 'SAR 32.0bn in total, coloured by domain.',
        },
        {
          id: 'share',
          kind: 'hbars',
          title: 'Saudi Made Share by Domain GAMI',
          bars: [
            { label: 'Land', value: 38, display: '38%', tone: 'teal' },
            { label: 'Armament', value: 34, display: '34%', tone: 'gold' },
            { label: 'Naval', value: 27, display: '27%', tone: 'blue' },
            { label: 'Electronics', value: 24, display: '24%', tone: 'violet' },
            { label: 'Air', value: 19, display: '19%', tone: 'sky' },
          ],
          footer: 'Air is furthest behind, where the largest opportunity is.',
        },
        {
          id: 'investment',
          kind: 'kpis',
          title: '2026 Investment Pipeline GAMI',
          tiles: [
            { label: 'Invested YTD', value: '18.6', unit: 'SAR bn', tone: 'green' },
            { label: 'Potential to year end', value: '31.4', unit: 'SAR bn', tone: 'sky' },
          ],
          footer: 'SAR 50bn if the potential converts.',
        },
        {
          id: 'licences',
          kind: 'donut',
          title: '2026 License Status GAMI',
          total: '1,007',
          totalLabel: 'applications',
          slices: [
            { name: 'Applied', value: 18.47, tone: 'grey' },
            { name: 'Under review', value: 23.93, tone: 'amber' },
            { name: 'Granted', value: 51.34, tone: 'green' },
            { name: 'Failed', value: 6.26, tone: 'red' },
          ],
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
        { group: 'area', title: 'Annotations', items: [{ mark: 'area', color: TONE.gold, label: 'Jubail Industrial City' }] },
        {
          group: 'supplier-pins',
          title: 'Qualified Suppliers GAMI',
          items: [
            { mark: 'pin', color: TONE.green, label: 'Ready', count: '3' },
            { mark: 'pin', color: TONE.amber, label: 'Licence pending', count: '2' },
          ],
        },
        {
          group: 'supplier-columns',
          title: 'Supplier Capacity GAMI',
          items: [
            { mark: 'column', color: TONE.green, label: 'Ready capacity' },
            { mark: 'column', color: TONE.amber, label: 'Pending capacity' },
          ],
        },
        {
          group: 'opportunity-disks',
          title: 'Localization Opportunities GAMI',
          items: [
            { mark: 'disk', color: DOMAIN_COLOR.armament, label: 'Ammunition & energetics', count: '5.9' },
            { mark: 'disk', color: DOMAIN_COLOR.land, label: 'Armored vehicle subsystems', count: '4.7' },
          ],
        },
        {
          group: 'capacity-heat',
          title: 'Industrial Capacity GAMI',
          items: [],
          ramp: { colors: ['#123a6b', '#2c6fd1', '#2de8c8', '#e8d44d', '#ffc401'], low: 'Low', high: 'High' },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Jubail Industrial City',
          parts: [
            { text: 'Jubail can take ' },
            { text: 'SAR 10.6bn', tone: 'gold' },
            { text: ' of the opportunities now: ammunition and energetics (5.9bn) and armored vehicle subsystems (4.7bn), on 4.2 km² of serviced land with ' },
            { text: '37 qualified suppliers', tone: 'green' },
            { text: '.' },
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Jubail Readiness GAMI',
          tiles: [
            { label: 'Serviced land', value: '4.2', unit: 'km²', tone: 'gold' },
            { label: 'Qualified suppliers', value: '37', tone: 'green' },
            { label: 'First output', value: '14', unit: 'months', tone: 'sky' },
          ],
        },
        {
          id: 'readiness',
          kind: 'grouped',
          title: 'Supplier Readiness by Capability GAMI',
          legend: [
            { name: 'Ready', color: TONE.green },
            { name: 'Needs licence', color: TONE.amber },
            { name: 'Gap', color: TONE.grey },
          ],
          groups: [
            { label: 'Energetics', values: [9, 4, 2] },
            { label: 'Armor steel', values: [12, 3, 1] },
            { label: 'Composites', values: [5, 6, 4] },
            { label: 'Machining', values: [11, 2, 1] },
          ],
          footer: 'Composites is the gap to close before UAV airframes can follow.',
        },
        {
          id: 'projects',
          kind: 'table',
          title: 'Candidate Projects GAMI',
          columns: ['Project', 'Value', 'Start', 'Status'],
          pillColumn: 3,
          rows: [
            { cells: ['Armor plate line', 'SAR 2.6bn', 'Q1 2027', 'Ready'], tone: 'green' },
            { cells: ['Vehicle subsystems hub', 'SAR 2.1bn', 'Q4 2027', 'Ready'], tone: 'green' },
            { cells: ['Propellant & charge plant', 'SAR 3.1bn', 'Q3 2027', 'Licence'], tone: 'amber' },
            { cells: ['Shell forging works', 'SAR 2.8bn', '2028', 'Land'], tone: 'grey' },
          ],
          footer: 'SAR 10.6bn a year across the four projects.',
        },
      ],
    },
  ],
}

const REGIONS: [keyof typeof REGION_COLOR, number][] = [
  ['europe', 612],
  ['middle-east', 498],
  ['asia', 404],
  ['north-america', 236],
  ['africa', 118],
  ['latin-america', 72],
]

const REGION_TONE: Record<keyof typeof REGION_COLOR, Tone> = {
  europe: 'violet',
  'middle-east': 'teal',
  asia: 'gold',
  'north-america': 'sky',
  africa: 'amber',
  'latin-america': 'green',
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
          group: 'delegation-arcs',
          title: 'Exhibitor Delegations GAMI',
          items: REGIONS.map(([region, count]) => ({
            mark: 'arc' as const,
            color: REGION_COLOR[region],
            label: REGION_LABEL[region],
            count: count.toLocaleString('en-US'),
          })),
        },
        {
          group: 'venue-disk',
          title: 'Venue GAMI',
          items: [{ mark: 'disk', color: TONE.gold, label: 'Malham, Riyadh' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { text: 'World Defense Show 2028 opens in Riyadh in 15 months. ' },
            { text: '1,940 exhibitors', tone: 'gold' },
            { text: ' from 94 countries have applied, already ' },
            { text: '32% ahead of 2026', tone: 'green' },
            { text: ', with USD 10.2bn in contracts expected.' },
          ],
        },
        { id: 'countdown', kind: 'countdown', title: 'WDS Countdown GAMI', target: WDS_OPENS },
        {
          id: 'outlook',
          kind: 'kpis',
          title: 'WDS Outlook GAMI',
          tiles: [
            { label: 'Countries', value: '94', tone: 'sky', note: '2026: 76' },
            { label: 'Visitors', value: '155k', tone: 'teal', note: '2026: 137k' },
            { label: 'Contracts', value: '10.2', unit: 'USD bn', tone: 'gold', note: '+16% on 2026' },
          ],
        },
        {
          id: 'exhibitors',
          kind: 'vbars',
          title: 'WDS Exhibitors GAMI',
          bars: [
            { label: 'Confirmed', value: 1085, display: '1,085', tone: 'green' },
            { label: 'Under review', value: 435, display: '435', tone: 'amber' },
            { label: 'Applied', value: 420, display: '420', tone: 'grey' },
          ],
          footer: '1,940 applications, 32% ahead of 2026’s 1,468 exhibitors.',
        },
        {
          id: 'regions',
          kind: 'hbars',
          title: 'Applications by Region GAMI',
          bars: REGIONS.map(([region, count]) => ({
            label: REGION_LABEL[region],
            value: count,
            display: count.toLocaleString('en-US'),
            tone: REGION_TONE[region],
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
        { group: 'area', title: 'Annotations', items: [{ mark: 'area', color: TONE.gold, label: 'Malham exhibition venue' }] },
        {
          group: 'hall-columns',
          title: 'Exhibitor Stands by Hall GAMI',
          items: [
            { mark: 'column', color: TONE.gold, label: 'Confirmed stands' },
            { mark: 'column', color: TONE.ice, label: 'Under review' },
          ],
        },
        {
          group: 'visitor-heat',
          title: 'Expected Visitor Density GAMI',
          items: [],
          ramp: { colors: ['#2a1c4a', '#7b68ee', '#f5a729', '#ffe08a'], low: 'Quiet', high: 'Peak' },
        },
        {
          group: 'shuttle-arcs',
          title: 'Shuttle Routes GAMI',
          items: [{ mark: 'arc', color: TONE.teal, label: 'Airport, city and KAFD shuttles', count: '4' }],
        },
        {
          group: 'display-disk',
          title: 'Flying Display GAMI',
          items: [{ mark: 'disk', color: TONE.sky, label: 'Flying display zone' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Malham exhibition venue',
          parts: [
            { text: 'The venue must hold 1,940 exhibitors across 5 halls and the outdoor display. Halls are ' },
            { text: '82% ready', tone: 'green' },
            { text: '; roads and shuttles are the tightest link at ' },
            { text: '64%', tone: 'amber' },
            { text: ', for a peak of 41,000 visitors a day.' },
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'Venue Capacity GAMI',
          tiles: [
            { label: 'Indoor halls', value: '172k', unit: 'm²', tone: 'gold' },
            { label: 'Outdoor display', value: '380k', unit: 'm²', tone: 'sky' },
            { label: 'Peak visitors', value: '41k', unit: '/ day', tone: 'violet' },
          ],
        },
        {
          id: 'readiness',
          kind: 'progress',
          title: 'Venue Readiness GAMI',
          rows: [
            { label: 'Exhibition halls', value: '82%', target: 'ready', pct: 82, tone: 'green' },
            { label: 'Flying display & runway', value: '74%', target: 'ready', pct: 74, tone: 'sky' },
            { label: 'Roads & shuttles', value: '64%', target: 'ready', pct: 64, tone: 'amber' },
            { label: 'Hotels within 40 km', value: '58%', target: 'booked', pct: 58, tone: 'violet' },
          ],
        },
        {
          id: 'visitors',
          kind: 'line',
          title: 'Visitors per Show Day GAMI',
          x: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
          yMax: 45,
          ySuffix: 'k',
          series: [
            { name: '2028 plan', tone: 'gold', points: [28, 41, 38, 30, 18] },
            { name: '2026 actual', tone: 'grey', points: [24, 35, 33, 26, 19], faded: true },
          ],
          footer: 'Day 2 peaks at 41,000, 17% above 2026.',
        },
        {
          id: 'halls',
          kind: 'stacked',
          title: 'Hall Allocation by Domain GAMI',
          legend: [
            { name: 'Air', tone: 'sky' },
            { name: 'Armament', tone: 'gold' },
            { name: 'Land', tone: 'teal' },
            { name: 'Naval', tone: 'blue' },
            { name: 'Electronics', tone: 'violet' },
          ],
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
        {
          group: 'gap-disks',
          title: 'Skills Gap by City GAMI',
          items: [
            { mark: 'disk', color: TONE.ice, label: 'Today' },
            { mark: 'disk', color: TONE.sky, label: '2027' },
            { mark: 'disk', color: TONE.blue, label: '2030' },
          ],
        },
        {
          group: 'academy-pins',
          title: 'Training Institutes GAMI',
          items: [{ mark: 'pin', color: TONE.violet, label: 'Academy or institute', count: '3' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { text: 'The sector is ' },
            { text: '6,350 skilled people short', tone: 'sky' },
            { text: ' today, rising to 10,600 by 2030. The Western Region has the most unfilled roles, 2,140, and ' },
            { text: 'UAV systems integration', tone: 'amber' },
            { text: ' is the fastest-growing gap.' },
          ],
        },
        {
          id: 'skills',
          kind: 'grouped',
          title: 'Skills Gap GAMI',
          legend: [
            { name: 'Today', color: TONE.ice },
            { name: '2027', color: TONE.sky },
            { name: '2030', color: TONE.blue },
          ],
          groups: [
            { label: 'Avionics', values: [1800, 2250, 2900] },
            { label: 'Machining', values: [1750, 2150, 2800] },
            { label: 'Cyber & EW', values: [1550, 2000, 2700] },
            { label: 'UAV integration', values: [1250, 1700, 2200] },
          ],
          footer: '6,350 short today → 10,600 by 2030. Widest growth: UAV integration, +76%.',
        },
        {
          id: 'funnels',
          kind: 'grouped',
          title: 'Training Funnels GAMI',
          legend: [
            { name: 'Internships', color: TONE.sky },
            { name: 'Academy', color: TONE.green },
          ],
          groups: [
            { label: 'Applied', values: [4860, 3250] },
            { label: 'Selected', values: [1920, 1410] },
            { label: 'In training', values: [740, 860] },
            { label: 'Graduated', values: [515, 620] },
          ],
          footer: 'Conversion: internships 10.6%, academy 19.1%.',
        },
        {
          id: 'regions',
          kind: 'hbars',
          title: 'Unfilled Roles by Region GAMI',
          bars: [
            { label: 'Western', value: 2140, display: '2,140', tone: 'sky' },
            { label: 'Riyadh', value: 1980, display: '1,980', tone: 'ice' },
            { label: 'Eastern', value: 1610, display: '1,610', tone: 'ice' },
            { label: 'Other regions', value: 620, display: '620', tone: 'grey' },
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
        { group: 'area', title: 'Annotations', items: [{ mark: 'area', color: TONE.sky, label: 'KAEC industrial cluster' }] },
        {
          group: 'role-columns',
          title: 'Open Roles by Employer GAMI',
          items: [
            { mark: 'column', color: DOMAIN_COLOR.land, label: 'Land', count: '214' },
            { mark: 'column', color: DOMAIN_COLOR.air, label: 'Air', count: '244' },
            { mark: 'column', color: DOMAIN_COLOR.electronics, label: 'Electronics', count: '92' },
            { mark: 'column', color: DOMAIN_COLOR.armament, label: 'Other', count: '90' },
          ],
        },
        {
          group: 'applicant-heat',
          title: 'Applicant Density GAMI',
          items: [],
          ramp: { colors: ['#1b2550', '#3b79be', '#70aeff', '#d8ecff'], low: 'Few', high: 'Many' },
        },
        {
          group: 'academy-pins',
          title: 'Training Institutes GAMI',
          items: [{ mark: 'pin', color: TONE.violet, label: 'KAEC Technical Institute' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'KAEC industrial cluster',
          parts: [
            { text: 'KAEC has ' },
            { text: '640 unfilled roles', tone: 'sky' },
            { text: ' across 8 employers, 412 of them in machining and UAV integration. Its institute graduates ' },
            { text: '180 a year', tone: 'amber' },
            { text: ', so the cluster needs a second intake to close the gap by 2028.' },
          ],
        },
        {
          id: 'kpis',
          kind: 'kpis',
          title: 'KAEC Talent at a Glance GAMI',
          tiles: [
            { label: 'Unfilled roles', value: '640', tone: 'sky' },
            { label: 'Graduates / yr', value: '180', tone: 'violet' },
            { label: 'Time to hire', value: '5.2', unit: 'months', tone: 'amber' },
          ],
        },
        {
          id: 'skills',
          kind: 'hbars',
          title: 'KAEC Gap by Skill GAMI',
          bars: [
            { label: 'Precision machining', value: 210, display: '210', tone: 'sky' },
            { label: 'UAV integration', value: 202, display: '202', tone: 'amber' },
            { label: 'Avionics', value: 128, display: '128', tone: 'ice' },
            { label: 'Cyber & EW', value: 100, display: '100', tone: 'ice' },
          ],
        },
        {
          id: 'pipeline',
          kind: 'line',
          title: 'Graduates vs Roles Needed GAMI',
          x: ['2024', '2025', '2026', '2027', '2028'],
          yMax: 450,
          series: [
            { name: 'Roles needed', tone: 'red', points: [300, 340, 380, 400, 420], faded: true },
            { name: 'Graduates', tone: 'teal', points: [110, 140, 180, null, null] },
            { name: 'With 2nd intake', tone: 'green', points: [null, null, 180, 300, 420], faded: true },
          ],
          footer: 'A second intake closes the gap in 2028.',
        },
        {
          id: 'employers',
          kind: 'table',
          title: 'KAEC Employers GAMI',
          columns: ['Employer', 'Domain', 'Open roles'],
          rows: [
            { cells: ['KAEC Land Systems Plant', 'Land', '214'] },
            { cells: ['Red Sea Composites', 'Air', '126'] },
            { cells: ['Western UAV Assembly', 'Air', '118'] },
            { cells: ['Coastal Electronics Works', 'Electronics', '92'] },
            { cells: ['Other employers (4)', 'Mixed', '90'] },
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
    programmes: ['Sahm', 'Najm', 'Rimah'],
    tone: 'red',
    specs: [
      ['Power', '4.2 kW continuous'],
      ['Mass', '1.1 kg'],
      ['Used in', 'Sahm · Najm · Rimah'],
      ['Imported from Poland', '100%'],
    ],
    stock: [41, 34, 27, 20, 13, 6, 0],
    exposure: [
      { label: 'Najm', value: 1100, display: '1,100 units' },
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: { supplier: 'Ankara Propulsion Systems Park', city: 'Ankara', capacity: '2,000 / month', leadTime: '30 days', cost: '+8%' },
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
    tone: 'red',
    specs: [
      ['Sensors', 'HD day camera + cooled MWIR'],
      ['Stabilisation', '< 25 µrad'],
      ['Mass', '2.8 kg'],
      ['Imported from Poland', '100%'],
    ],
    stock: [47, 40, 33, 26, 19, 12, 5],
    exposure: [
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: { supplier: 'Eskişehir Optronics Works', city: 'Eskişehir', capacity: '260 / month', leadTime: '35 days', cost: '+9%' },
  },
  inu: {
    id: 'inu',
    name: 'Inertial navigation unit',
    short: 'Navigation unit',
    supplier: 'Gdansk Navigation Systems',
    city: 'Gdańsk, Poland',
    monthlyNeed: '420 / month',
    stockDays: 58,
    programmes: ['Sahm', 'Najm', 'Rimah'],
    tone: 'red',
    specs: [
      ['Gyro drift', '0.1 °/h'],
      ['GNSS-denied', '30 min to 1% drift'],
      ['Mass', '0.7 kg'],
      ['Imported from Poland', '100%'],
    ],
    stock: [58, 51, 44, 37, 30, 23, 16],
    exposure: [
      { label: 'Najm', value: 1100, display: '1,100 units' },
      { label: 'Sahm', value: 640, display: '640 units' },
      { label: 'Rimah', value: 420, display: '420 units' },
    ],
    alternative: { supplier: 'Konya Inertial Systems', city: 'Konya', capacity: '450 / month', leadTime: '32 days', cost: '+7%' },
  },
}

/** The 20 imports from Poland the conflict cut off, most critical first. */
export const AFFECTED_IMPORTS: { item: string; domain: string; days: number; level: 'Critical' | 'Moderate' | 'Mild' }[] = [
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

const LEVEL_TONE = { Critical: 'red', Moderate: 'amber', Mild: 'yellow' } as const

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
      filters: ['Poland', 'Imported components', 'UAV programmes'],
      layers: [
        {
          group: 'risk-routes',
          title: 'Supply Risk Routes GAMI',
          items: [{ mark: 'arc', color: TONE.red, label: 'Critical items', count: '3' }],
        },
        {
          group: 'other-routes',
          title: 'Other Affected Imports GAMI',
          items: [
            { mark: 'arc', color: TONE.amber, label: 'Moderate', count: '8' },
            { mark: 'arc', color: TONE.yellow, label: 'Mild', count: '9' },
          ],
        },
        {
          group: 'poland-sites',
          title: 'Poland Supplier Sites GAMI',
          items: [{ mark: 'pin', color: TONE.red, label: 'Exports suspended', count: '3' }],
        },
        {
          group: 'receiving-sites',
          title: 'UAV Sites at Risk GAMI',
          items: [{ mark: 'pin', color: TONE.red, label: 'Riyadh · Al-Kharj', count: '2' }],
        },
        {
          group: 'conflict-heat',
          title: 'Conflict Intensity GAMI',
          items: [],
          ramp: { colors: ['#3a0d12', '#a0201c', '#ee3f39', '#ffb199'], low: 'Low', high: 'High' },
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Summary',
          parts: [
            { text: 'The Poland–Russia conflict suspended export permits for ' },
            { text: '20 components', tone: 'amber' },
            { text: ' Saudi military industries import from Poland. ' },
            { text: '3 are critical', tone: 'red' },
            { text: ' to the national UAV programmes: propulsion motors, EO/IR gimbals and navigation units.' },
          ],
        },
        {
          id: 'critical',
          kind: 'kpis',
          span: 'cell',
          title: 'Critical Alert GAMI',
          glow: true,
          tiles: [{ label: 'Poland conflict', value: '41', unit: 'days of stock', tone: 'red', note: 'Critical' }],
          footer: 'Motor permits suspended.',
        },
        { id: 'part-motor', kind: 'part', span: 'cell', title: 'Propulsion motor', part: 'motor' },
        { id: 'part-gimbal', kind: 'part', span: 'cell', title: 'EO/IR gimbal', part: 'gimbal' },
        { id: 'part-inu', kind: 'part', span: 'cell', title: 'Navigation unit', part: 'inu' },
        {
          id: 'severity',
          kind: 'kpis',
          title: 'Alert Summary GAMI',
          tiles: [
            { label: 'Critical', value: '3', tone: 'red' },
            { label: 'Moderate', value: '8', tone: 'amber' },
            { label: 'Mild', value: '9', tone: 'yellow' },
          ],
          footer: 'Every critical item traces back to one supplier country.',
        },
        {
          id: 'imports',
          kind: 'table',
          title: '20 Affected Imports GAMI',
          height: 2,
          columns: ['Item', 'Domain', 'Stock', 'Severity'],
          pillColumn: 3,
          rows: AFFECTED_IMPORTS.map((entry) => ({
            cells: [entry.item, entry.domain, `${entry.days} d`, entry.level],
            tone: LEVEL_TONE[entry.level],
          })),
        },
        {
          id: 'programmes',
          kind: 'hbars',
          title: 'UAV Programmes at Risk GAMI',
          bars: [
            { label: 'Najm', value: 1100, display: '1,100 units', tone: 'red' },
            { label: 'Sahm', value: 640, display: '640 units', tone: 'red' },
            { label: 'Rimah', value: 420, display: '420 units', tone: 'red' },
          ],
          footer: '2027 deliveries that stop if the motors run out.',
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
      filters: ['Türkiye', 'Critical items', 'Bridge to 2029'],
      layers: [
        {
          group: 'area',
          title: 'Annotations',
          items: [{ mark: 'area', color: TONE.green, label: 'Ankara–Eskişehir–Konya suppliers' }],
        },
        {
          group: 'bridge-routes',
          title: 'Türkiye Bridge Routes GAMI',
          items: [{ mark: 'arc', color: TONE.green, label: 'Recommended routes', count: '3' }],
        },
        {
          group: 'turkiye-sites',
          title: 'Türkiye Supplier Sites GAMI',
          items: [{ mark: 'pin', color: TONE.green, label: 'Recommended bridge supplier', count: '3' }],
        },
        {
          group: 'risk-routes',
          title: 'Supply Risk Routes GAMI',
          items: [{ mark: 'arc', color: TONE.red, label: 'Suspended from Poland', count: '3' }],
        },
        {
          group: 'receiving-sites',
          title: 'UAV Sites at Risk GAMI',
          items: [{ mark: 'pin', color: TONE.red, label: 'Riyadh · Al-Kharj', count: '2' }],
        },
      ],
      cards: [
        {
          id: 'summary',
          kind: 'summary',
          title: 'Bridge through Türkiye',
          parts: [
            { text: 'Switching the 3 critical items to Turkish suppliers lands first deliveries in ' },
            { text: '30 days', tone: 'green' },
            { text: ', 11 days before motor stock runs out, at ' },
            { text: '8% extra cost', tone: 'amber' },
            { text: '. Türkiye bridges supply for 3 years, until local production starts in 2029.' },
          ],
        },
        {
          id: 'action',
          kind: 'kpis',
          title: 'Recommended Action: Switch to Türkiye GAMI',
          tiles: [
            { label: 'First delivery', value: '30', unit: 'days', tone: 'green' },
            { label: 'Extra cost', value: '8%', tone: 'amber' },
            { label: 'Bridge', value: '3', unit: 'yrs', tone: 'blue' },
          ],
          footer: 'First deliveries land 11 days before stock runs out.',
        },
        {
          id: 'options',
          kind: 'table',
          title: 'Sourcing Options GAMI',
          columns: ['Option', 'Status', 'Lead time', 'Cost', 'Risk'],
          pillColumn: 1,
          rows: [
            { cells: ['Poland', 'Blocked', 'Suspended', 'Baseline', 'Critical'], tone: 'red' },
            { cells: ['Türkiye', 'Recommended', '30–35 days', '+8%', 'Low–mod.'], tone: 'green', highlight: true },
            { cells: ['Local', 'In progress', '2029', '−12%', 'Low'], tone: 'sky' },
          ],
        },
        {
          id: 'timeline',
          kind: 'range',
          title: 'Supply Bridge Timeline GAMI',
          min: -24,
          max: 48,
          ticks: [-24, 0, 12, 24, 36, 48],
          rows: [
            { label: 'Poland', from: -24, to: 0, tone: 'red' },
            { label: 'Türkiye', from: 1, to: 36, tone: 'green' },
            { label: 'Local', from: 30, to: 48, tone: 'teal' },
          ],
          footer: 'Months from today. Local production overlaps Türkiye by 6 months.',
        },
        {
          id: 'capacity',
          kind: 'hbars',
          title: 'Türkiye Capacity vs Need GAMI',
          bars: [
            { label: 'Motors · Ankara', value: 111, display: '2,000/mo · 111%', tone: 'green' },
            { label: 'Gimbals · Eskişehir', value: 108, display: '260/mo · 108%', tone: 'green' },
            { label: 'Nav units · Konya', value: 107, display: '450/mo · 107%', tone: 'green' },
          ],
          footer: 'Each supplier covers the full monthly need.',
        },
        {
          id: 'cover',
          kind: 'line',
          title: 'Motor Stock Cover GAMI',
          x: ['Today', 'W2', 'W4', 'W6', 'W8', 'W10', 'W12'],
          yMax: 60,
          ySuffix: ' d',
          series: [
            { name: 'Without switch', tone: 'red', points: [41, 27, 13, 0, 0, 0, 0], faded: true },
            { name: 'With Türkiye', tone: 'green', points: [41, 27, 22, 30, 38, 45, 52] },
          ],
          footer: 'Days of motor stock, week by week.',
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
