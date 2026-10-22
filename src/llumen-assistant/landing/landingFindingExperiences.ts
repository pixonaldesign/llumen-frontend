/**
 * Tell Me More for each Briefing finding. Findings shown on a map open that map in the ask stage with their
 * hotspots outlined as polygon annotations; the others answer with charts only.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import type { StoryMapRegion } from '../story/storyAiScenarios'
import { paddedOutline } from '../story/storyAnnotations'
import type { MapAnnotationItem } from '../story/storyMapAnnotations'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'

const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8
const OUTLINE_PADDING_M = 140

export type FindingMap = { place: BriefingPlaceId; title: string; tag: string; meta: string }

export type FindingExperience = {
  reply: AssistantReplyPayload
  /** The finding's own map for the stage; null answers in charts and keeps the map closed. */
  map: FindingMap | null
}

type AreaSpec = { name: string; text: string }

type PlaceOutline = {
  label: string
  /** Story scene whose disk palette matches the place. */
  sceneIndex: number
  color: string
  /** Each area outlines every column this close to its centre, the spot with the most column height around it. */
  radiusKm: number
  areas: AreaSpec[]
}

const PLACE_OUTLINES: Record<BriefingPlaceId, PlaceOutline> = {
  'abu-dhabi': {
    label: 'Abu Dhabi Island',
    sceneIndex: 0,
    color: '#ffb547',
    radiusKm: 0.85,
    areas: [
      { name: 'Al Salam Street roadworks', text: 'Routes 54 & 65 · +18 min' },
      { name: 'Corniche approach', text: 'Spillover · +9 min' },
    ],
  },
  mussafah: {
    label: 'Al Mussafah',
    sceneIndex: 1,
    color: '#7fe3ff',
    radiusKm: 0.65,
    areas: [
      { name: 'New warehouse permits', text: '14 new warehouse permits' },
      { name: 'Southern approach roads', text: 'Trucks · 120 m from homes' },
    ],
  },
  dubai: {
    label: 'Coastal corridor',
    sceneIndex: 2,
    color: '#ffd166',
    radiusKm: 0.7,
    areas: [
      { name: 'Port district', text: 'Port district · PM2.5 48' },
      { name: 'Harbour front', text: 'Harbour front · PM2.5 44' },
      { name: 'Marina edge', text: 'Marina edge · PM2.5 41' },
    ],
  },
  'al-ain': {
    label: 'Al Ain',
    sceneIndex: 0,
    color: '#ff8ab3',
    radiusKm: 0.7,
    areas: [
      { name: 'Al Khatm access road', text: 'Al Khatm road · cameras · −18%' },
      { name: 'Remah access road', text: 'Remah road · patrols · −11%' },
      { name: 'Sweihan access road', text: 'Sweihan road · patrols · −7%' },
    ],
  },
}

export function isFindingPlace(id: string | undefined): id is BriefingPlaceId {
  return id !== undefined && id in BRIEFING_PLACES
}

export function findingSceneIndex(place: BriefingPlaceId) {
  return PLACE_OUTLINES[place].sceneIndex
}

const regions = new Map<BriefingPlaceId, StoryMapRegion>()

/** The place's Briefing columns as a stage region; cached so the map sees one region per place. */
export function findingRegion(place: BriefingPlaceId): StoryMapRegion {
  const cached = regions.get(place)
  if (cached) return cached
  const { camera, ramp, columns, junctions } = BRIEFING_PLACES[place]
  const region: StoryMapRegion = {
    id: `finding-${place}`,
    label: PLACE_OUTLINES[place].label,
    camera,
    columnRamp: ramp,
    columns,
    junctions,
  }
  regions.set(place, region)
  return region
}

function distanceKm(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot((a[0] - b[0]) * KM_PER_DEG_LNG, (a[1] - b[1]) * KM_PER_DEG_LAT)
}

const outlines = new Map<BriefingPlaceId, MapAnnotationItem[]>()

/** Polygons around the place's heaviest column clusters, one per area, heaviest first. */
export function findingAreas(place: BriefingPlaceId): MapAnnotationItem[] {
  const cached = outlines.get(place)
  if (cached) return cached
  const { columns } = BRIEFING_PLACES[place]
  const { label, color, radiusKm, areas } = PLACE_OUTLINES[place]
  const mass = columns.map((column) =>
    columns.reduce((total, other) => (distanceKm(column, other) <= radiusKm ? total + other[2] : total), 0),
  )
  const heaviest = columns.map((_, index) => index).sort((a, b) => mass[b] - mass[a])
  const seeds: number[] = []
  for (const index of heaviest) {
    if (seeds.length === areas.length) break
    if (seeds.every((seed) => distanceKm(columns[seed], columns[index]) > radiusKm * 2 + 0.25)) seeds.push(index)
  }
  const items = seeds.map((seed, order): MapAnnotationItem => {
    const members = columns.filter((column) => distanceKm(column, columns[seed]) <= radiusKm)
    const ring = paddedOutline(
      members.map(([lng, lat]): [number, number] => [lng, lat]),
      OUTLINE_PADDING_M,
    )
    const area = areas[order]
    return {
      id: `finding-${place}-${order + 1}`,
      tool: 'polygon',
      name: area.name,
      geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
      style: { color, text: area.text },
      visible: true,
      opacity: 1,
      context: { anchor: 'geometry', slideIndex: 0, dataLabel: label, features: [] },
    }
  })
  outlines.set(place, items)
  return items
}

function timeline(steps: ThinkingStep[]): TimelineStep[] {
  return steps
    .filter((step) => step.kind !== 'done')
    .map((step) => ({
      id: step.id,
      kind: step.kind === 'search' ? ('tool' as const) : ('reasoning' as const),
      title: step.title,
      titleInProgress: step.title.endsWith('…') ? step.title : `${step.title}…`,
    }))
}

function chartComponent(id: string, chart: StoryReplyChartData, caption: string): CreatedComponent {
  return {
    id,
    label: chart.title,
    type: 'visual',
    title: chart.title,
    description: caption,
    caption,
    inlineSize: 'full',
    preview: { kind: 'story-chart', chart },
  }
}

function visual(component: CreatedComponent): AgentResponseBlock {
  return {
    type: 'visual',
    componentId: component.id,
    visualType: 'chart',
    title: component.title,
    caption: component.caption ?? component.description,
    displayMode: 'inline',
  }
}

/** A smooth path through evenly spaced values, in the trend chart's 0–100 box (y grows downwards). */
function trendLine(values: number[], min: number, max: number) {
  const points = values.map((value, index): [number, number] => [
    (index / (values.length - 1)) * 100,
    100 - ((value - min) / (max - min)) * 100,
  ])
  const at = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`
  let path = `M${at(points[0])}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    path += ` C${at(c1)} ${at(c2)} ${at(p2)}`
  }
  return path
}

type BarRow = { label: string; value: number; display: string }

function barRows(rows: [label: string, value: number, display: string][]): BarRow[] {
  const max = Math.max(...rows.map(([, value]) => value))
  return rows.map(([label, value, display]) => ({ label, value: (value / max) * 100, display }))
}

type Section = { heading: string; text: string; chart?: CreatedComponent }

type ExperienceSpec = {
  id: string
  read: string
  search: string
  reason: string
  headline: string
  headlineDetail: string
  intro: string
  sections: Section[]
  map: FindingMap | null
}

function experience(spec: ExperienceSpec): FindingExperience {
  const steps: ThinkingStep[] = [
    { id: `${spec.id}-read`, kind: 'reasoning', title: spec.read },
    { id: `${spec.id}-search`, kind: 'search', title: spec.search },
    { id: `${spec.id}-reason`, kind: 'reasoning', title: spec.reason },
    { id: `${spec.id}-done`, kind: 'done', title: spec.map ? 'Map annotated' : 'Charts ready' },
  ]
  const charts = spec.sections.flatMap((section) => (section.chart ? [section.chart] : []))
  return {
    map: spec.map,
    reply: {
      headline: spec.headline,
      headlineDetail: spec.headlineDetail,
      thinkingSteps: steps,
      timeline: timeline(steps),
      createdComponents: charts,
      blocks: [
        { type: 'text', content: spec.intro },
        ...spec.sections.flatMap((section): AgentResponseBlock[] => [
          { type: 'heading', content: section.heading },
          { type: 'text', content: section.text },
          ...(section.chart ? [visual(section.chart)] : []),
        ]),
      ],
    },
  }
}

const EXPERIENCES: Record<string, () => FindingExperience> = {
  'abu-dhabi': () =>
    experience({
      id: 'finding-bus',
      read: 'Reading the Island Bus Reliability Brief from Mobility and the arrivals data behind it…',
      search: 'Matching late arrivals on island routes to roadworks and peak-hour traffic, this week…',
      reason: 'Outlining the stretches where the delay concentrates on the island map…',
      headline: 'Outlined the two stretches behind the island bus delays.',
      headlineDetail:
        'Drew a polygon around each stretch on the island map, labelled with the routes and the minutes lost.',
      intro:
        'Morning arrivals on island bus routes are running 12 minutes late on average this week. Routes 54 and 65 carry most of it, because the roadworks on Al Salam Street slow the 7–9 am peak. I outlined where the delay builds up on the island map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The amber outline over Al Salam Street covers the junctions where Routes 54 and 65 queue behind the lane closures, adding up to 18 minutes per trip. The second outline, on the Corniche approach, is spillover: buses rerouted around the works add about 9 minutes there.',
        },
        {
          heading: 'Delay by route',
          text: 'Routes 54 and 65 lose the most time because both run the full length of Al Salam Street; the other routes only cross it.',
          chart: chartComponent(
            'finding-bus-routes',
            {
              type: 'bars',
              title: 'Average delay by route, 7–9 am',
              value: '12',
              unit: 'min late on average',
              color: '#ffb547',
              rows: barRows([
                ['Route 54', 18, '+18 min'],
                ['Route 65', 14, '+14 min'],
                ['Route 32', 11, '+11 min'],
                ['Route 9', 8, '+8 min'],
                ['Route 101', 6, '+6 min'],
              ]),
            },
            'Average minutes late at the final stop, weekday mornings this week.',
          ),
        },
        {
          heading: 'Through the week',
          text: 'The delay grew from 6 to 14 minutes as the works moved onto the inner lanes on Tuesday, and has held since.',
          chart: chartComponent(
            'finding-bus-week',
            {
              type: 'trend',
              title: 'Average lateness, island routes',
              value: '14',
              unit: 'min on Wednesday',
              color: '#70aeff',
              yLabels: ['20 min', '10 min', '0'],
              xLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
              line: trendLine([6, 9, 12, 14, 13], 0, 20),
            },
            'Average minutes late per morning trip, all island routes.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Move Routes 54 and 65 onto Al Khaleej Al Arabi Street until the Al Salam Street works finish, and add two buses to each route between 7 and 9 am. That recovers about 9 of the 12 minutes.',
        },
      ],
      map: {
        place: 'abu-dhabi',
        title: 'Island Bus Reliability Brief · on the map',
        tag: 'Abu Dhabi',
        meta: '2 areas outlined',
      },
    }),

  'proactive-ai': () =>
    experience({
      id: 'finding-digest',
      read: 'Reading the Proactive Risk Digest from Proactive AI and the complaints behind it…',
      search:
        'Counting billing and connection complaints in MBZ City since Sunday, and staffing at its service center…',
      reason: 'Projecting wait times at the MBZ City service center with and without extra weekend agents…',
      headline: 'Complaints in MBZ City are building faster than the service center can absorb them.',
      headlineDetail: 'Charted the complaint build-up, what it is about, and the effect of adding weekend agents.',
      intro:
        'Llumen flagged 38 billing and connection complaints from MBZ City since Sunday. At this rate, the weekend shift at the MBZ City service center would face 40-minute delays within 72 hours.',
      sections: [
        {
          heading: 'How the cluster built up',
          text: 'Complaints were at their usual 2–4 a day until Sunday, then rose each day: 9, 12 and 17. Almost all of them come from the newer blocks connected last month.',
          chart: chartComponent(
            'finding-digest-trend',
            {
              type: 'trend',
              title: 'Billing and connection complaints, MBZ City',
              value: '38',
              unit: 'since Sunday',
              color: '#ff8a65',
              yLabels: ['20', '10', '0'],
              xLabels: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'],
              line: trendLine([3, 2, 4, 9, 12, 17], 0, 20),
            },
            'Complaints logged per day from MBZ City addresses.',
          ),
        },
        {
          heading: "What it's about",
          text: 'Billing disputes lead, mostly first bills estimated before a meter reading. Connection drops are second and concentrated in two buildings.',
          chart: chartComponent(
            'finding-digest-types',
            {
              type: 'bars',
              title: 'Complaints by type since Sunday',
              color: '#ff8a65',
              rows: barRows([
                ['Billing disputes', 17, '17'],
                ['Connection drops', 12, '12'],
                ['Meter readings', 6, '6'],
                ['Other', 3, '3'],
              ]),
            },
            'All 38 complaints from MBZ City since Sunday, by category.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Add three agents to the weekend shift at the MBZ City service center and send a short notice to the new blocks about estimated first bills. That keeps the expected wait near 12 minutes.',
          chart: chartComponent(
            'finding-digest-staffing',
            {
              type: 'compare',
              title: 'Weekend shift, MBZ City service center',
              legend: ['As scheduled', 'With 3 extra agents'],
              rows: [
                { label: 'Expected wait', before: 40, after: 12, beforeDisplay: '40 min', afterDisplay: '12 min' },
                { label: 'Agents on shift', before: 6, after: 9, beforeDisplay: '6', afterDisplay: '9' },
                {
                  label: 'Resolved the same day',
                  before: 54,
                  after: 81,
                  beforeDisplay: '54%',
                  afterDisplay: '81%',
                },
              ],
            },
            'Projected for the coming weekend at the current complaint rate.',
          ),
        },
      ],
      map: null,
    }),

  'land-use': () =>
    experience({
      id: 'finding-industrial',
      read: 'Reading the Industrial growth in Al Mussafah finding from Land Use and the permits behind it…',
      search: 'Pulling warehouse permits and land-use parcels in Al Mussafah for 2023–2025…',
      reason: 'Outlining where the new permits and heavy-vehicle routes meet homes on the Mussafah map…',
      headline: 'Outlined where industrial growth is pressing on homes in Al Mussafah.',
      headlineDetail:
        'Drew a polygon around the new permit cluster and the southern approach roads on the Mussafah map.',
      intro:
        'Al Mussafah added 14 new warehouse permits this year, so industrial use is outpacing open space. Heavy vehicles now pass within 120 m of homes on the southern approach roads. I outlined both areas on the Mussafah map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The cyan outline over the tallest columns is the cluster where the 14 permits were issued, along the main industrial axis. The second outline covers the southern approach roads, where truck traffic to those warehouses runs beside the residential blocks.',
        },
        {
          heading: 'How the land use shifted',
          text: 'Industrial land grew from 24% to 31% of the monitored belt in two years, almost entirely taken from open space.',
          chart: chartComponent(
            'finding-industrial-mix',
            {
              type: 'compare',
              title: 'Share of the monitored belt',
              legend: ['2023', '2025'],
              rows: [
                { label: 'Industrial', before: 24, after: 31, beforeDisplay: '24%', afterDisplay: '31%' },
                { label: 'Open space', before: 33, after: 27, beforeDisplay: '33%', afterDisplay: '27%' },
                { label: 'Residential', before: 43, after: 42, beforeDisplay: '43%', afterDisplay: '42%' },
              ],
            },
            'Land-use parcels in the Al Mussafah monitoring belt.',
          ),
        },
        {
          heading: 'Permits this year',
          text: 'Permits peaked in the third quarter, when the logistics zone extension opened.',
          chart: chartComponent(
            'finding-industrial-permits',
            {
              type: 'bars',
              title: 'Warehouse permits by quarter, 2025',
              value: '14',
              unit: 'permits this year',
              color: '#7fe3ff',
              rows: barRows([
                ['Q1', 2, '2'],
                ['Q2', 4, '4'],
                ['Q3', 5, '5'],
                ['Q4', 3, '3'],
              ]),
            },
            'New warehouse permits issued in Al Mussafah.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Hold new warehouse permits near the southern approach until a truck route on the industrial side opens, and keep the remaining open strip as a buffer between the warehouses and homes.',
        },
      ],
      map: {
        place: 'mussafah',
        title: 'Industrial growth in Al Mussafah · on the map',
        tag: 'Al Mussafah',
        meta: '2 areas outlined',
      },
    }),

  'land-use-mix': () =>
    experience({
      id: 'finding-mix',
      read: 'Reading the Land use mix finding from Land Use and the parcel data behind it…',
      search: 'Comparing land-use parcels in Al Mussafah between 2016 and 2025…',
      reason: 'Measuring the buffer between industrial plots and homes, block by block…',
      headline: 'Industry has taken a third of the open space it now borders.',
      headlineDetail: 'Charted the land-use shift since 2016, the open-space decline and the remaining buffers.',
      intro:
        'Residential land still leads in Al Mussafah at 42%, but industrial land at 31% now outweighs open space at 27%. The buffers between factories and homes are getting thin.',
      sections: [
        {
          heading: 'Since 2016',
          text: 'Industrial land grew by 9 points. Most of it came out of open space; residential land barely moved.',
          chart: chartComponent(
            'finding-mix-compare',
            {
              type: 'compare',
              title: 'Land use in Al Mussafah',
              legend: ['2016', '2025'],
              rows: [
                { label: 'Residential', before: 45, after: 42, beforeDisplay: '45%', afterDisplay: '42%' },
                { label: 'Industrial', before: 22, after: 31, beforeDisplay: '22%', afterDisplay: '31%' },
                { label: 'Open space', before: 33, after: 27, beforeDisplay: '33%', afterDisplay: '27%' },
              ],
            },
            'Share of the Al Mussafah land area by use.',
          ),
        },
        {
          heading: 'Open space, year by year',
          text: 'The decline sped up after 2022 with the logistics zone extension.',
          chart: chartComponent(
            'finding-mix-open',
            {
              type: 'trend',
              title: 'Open space share, Al Mussafah',
              value: '27',
              unit: '% in 2025',
              color: '#9bd17a',
              yLabels: ['40%', '30%', '20%'],
              xLabels: ['2016', '2019', '2022', '2025'],
              line: trendLine([33, 32.6, 32, 31.4, 31, 30.6, 30.2, 29.1, 28, 27], 20, 40),
            },
            'Open space as a share of the Al Mussafah land area.',
          ),
        },
        {
          heading: 'Where the buffer is thinnest',
          text: 'In the southern blocks, factories sit 140 m from homes. On the east edge it is only 90 m, below the 150 m planning guideline.',
          chart: chartComponent(
            'finding-mix-buffer',
            {
              type: 'bars',
              title: 'Distance between industrial plots and homes',
              value: '90',
              unit: 'm at the narrowest',
              color: '#c9a36a',
              rows: barRows([
                ['North blocks', 420, '420 m'],
                ['Central blocks', 260, '260 m'],
                ['Southern blocks', 140, '140 m'],
                ['East edge', 90, '90 m'],
              ]),
            },
            'Shortest distance from an industrial plot to a residential plot, by block.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Protect the remaining 27% open space in the local plan, and require a 150 m planted buffer for any new industrial plot that borders homes.',
        },
      ],
      map: null,
    }),

  population: () =>
    experience({
      id: 'finding-population',
      read: 'Reading the Population composition finding from Demographics and the census series behind it…',
      search: 'Pulling residents by age group across the capital, 2016–2025, and by suburb for 2025…',
      reason: 'Separating growth in working-age adults from the youth share…',
      headline: 'Working-age adults drive the growth while the youth share holds steady.',
      headlineDetail:
        'Charted the youth share over time, the 2025 age mix and the suburbs with the most young residents.',
      intro:
        'Working-age adults account for most of the population growth across the capital since 2016. The youth share has held near 27%, so demand for school places keeps rising in step with the population.',
      sections: [
        {
          heading: 'Youth share over time',
          text: 'The capital added about 455,000 residents since 2016, and the youth share barely moved.',
          chart: chartComponent(
            'finding-population-youth',
            {
              type: 'trend',
              title: 'Youth share of residents',
              value: '27',
              unit: '% in 2025',
              color: '#a78bfa',
              yLabels: ['35%', '25%', '15%'],
              xLabels: ['2016', '2019', '2022', '2025'],
              line: trendLine([27.7, 27.6, 27.6, 27.5, 27.4, 27.3, 27.3, 27.2, 27.2, 27.3], 15, 35),
            },
            'Residents under 20 as a share of the capital population.',
          ),
        },
        {
          heading: 'Age mix in 2025',
          text: 'Adults aged 20–59 make up about two-thirds of residents; seniors remain a small but growing group.',
          chart: chartComponent(
            'finding-population-mix',
            {
              type: 'bars',
              title: 'Residents by age group, 2025',
              color: '#a78bfa',
              rows: barRows([
                ['Adults 20–59', 1675, '1.68M'],
                ['Youth under 20', 675, '675K'],
                ['Seniors 60+', 125, '125K'],
              ]),
            },
            'Capital residents by age group, 2025 estimate.',
          ),
        },
        {
          heading: 'Where young residents live',
          text: 'The newer suburbs carry the highest youth share, well above the island core.',
          chart: chartComponent(
            'finding-population-suburbs',
            {
              type: 'bars',
              title: 'Youth share by suburb, 2025',
              color: '#70aeff',
              rows: barRows([
                ['Al Shamkha', 36, '36%'],
                ['Khalifa City', 34, '34%'],
                ['MBZ City', 33, '33%'],
                ['Island core', 21, '21%'],
                ['Al Reem', 18, '18%'],
              ]),
            },
            'Residents under 20 as a share of each suburb.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Plan new school places and family services in Al Shamkha and Khalifa City first, where the youth share is highest and housing is still being added.',
        },
      ],
      map: null,
    }),

  dubai: () =>
    experience({
      id: 'finding-air',
      read: 'Reading the Coastal corridor air quality finding from Environment and the sensor readings behind it…',
      search: 'Pulling overnight PM2.5 from the coastal corridor sensors and matching it to port and traffic activity…',
      reason: 'Outlining the three districts over the sensitive-group threshold on the corridor map…',
      headline: 'Outlined the three districts over the sensitive-group threshold.',
      headlineDetail: 'Drew a polygon around each district on the corridor map, labelled with its overnight PM2.5.',
      intro:
        'Particulate matter along the coastal corridor rose 18% overnight, pushing 3 districts over the sensitive-group threshold. Port and traffic emissions are driving it. I outlined the three districts on the corridor map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The yellow outlines mark the port district, the harbour front and the marina edge. All three sit downwind of the port gates, where idling trucks and the evening traffic peak overlap.',
        },
        {
          heading: 'Overnight build-up',
          text: 'PM2.5 climbed steadily after 22:00 as the wind dropped, and peaked around 06:00.',
          chart: chartComponent(
            'finding-air-trend',
            {
              type: 'trend',
              title: 'PM2.5 overnight, coastal corridor',
              value: '47',
              unit: 'µg/m³ at peak',
              color: '#c084fc',
              yLabels: ['60', '30', '0'],
              xLabels: ['18:00', '22:00', '02:00', '06:00', '10:00'],
              line: trendLine([28, 30, 31, 35, 38, 42, 44, 47, 46, 41], 0, 60),
            },
            'Corridor average PM2.5, µg/m³, last night.',
          ),
        },
        {
          heading: 'District readings',
          text: 'Three districts are above the 35 µg/m³ sensitive-group threshold; the beach road and old town are still below it.',
          chart: chartComponent(
            'finding-air-districts',
            {
              type: 'bars',
              title: 'Peak PM2.5 by district',
              value: '3',
              unit: 'districts over threshold',
              color: '#ffd166',
              rows: barRows([
                ['Port district', 48, '48 µg/m³'],
                ['Harbour front', 44, '44 µg/m³'],
                ['Marina edge', 41, '41 µg/m³'],
                ['Beach road', 33, '33 µg/m³'],
                ['Old town', 29, '29 µg/m³'],
              ]),
            },
            'Highest hourly PM2.5 per district, last night.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Issue a sensitive-groups advisory for the three outlined districts until the wind picks up, and ask the port to hold idling trucks off the corridor between 22:00 and 06:00.',
        },
      ],
      map: {
        place: 'dubai',
        title: 'Coastal corridor air quality · on the map',
        tag: 'Coastal corridor',
        meta: '3 districts outlined',
      },
    }),

  'heat-stress': () =>
    experience({
      id: 'finding-heat',
      read: 'Reading the Coastal Heat Stress Advisory from Health and the readings behind it…',
      search: 'Pulling night-time temperatures along the corniche and heat-related clinic visits for the last 3 weeks…',
      reason: 'Comparing clinic visits with the seasonal baseline, by group and by neighbourhood…',
      headline: 'Hot nights are sending more outdoor workers and older residents to clinics.',
      headlineDetail:
        'Charted night-time temperatures, clinic visits against the baseline and the neighbourhoods most affected.',
      intro:
        'Night-time temperatures along the corniche have stayed above 32°C for three weeks, and heat-related clinic visits are up 22% on the seasonal baseline. The rise is among outdoor workers and residents of older housing blocks.',
      sections: [
        {
          heading: 'Night-time temperatures',
          text: 'Nights have not dropped below 32°C since the start of the month, so bodies get no chance to recover between hot days.',
          chart: chartComponent(
            'finding-heat-nights',
            {
              type: 'trend',
              title: 'Night-time minimum, corniche',
              value: '32.8',
              unit: '°C average minimum',
              color: '#ff7a59',
              yLabels: ['36°C', '32°C', '28°C'],
              xLabels: ['Week 1', 'Week 2', 'Week 3'],
              line: trendLine([32.2, 32.5, 32.4, 32.9, 33.1, 32.7, 33.4, 33.2, 32.8, 33.6], 28, 36),
            },
            'Lowest overnight temperature at the corniche stations.',
          ),
        },
        {
          heading: 'Clinic visits',
          text: 'Visits are up across the board, and most of all among outdoor workers.',
          chart: chartComponent(
            'finding-heat-visits',
            {
              type: 'compare',
              title: 'Heat-related clinic visits per week',
              legend: ['Seasonal baseline', 'This week'],
              rows: [
                { label: 'All visits', before: 1052, after: 1284, beforeDisplay: '1,052', afterDisplay: '1,284' },
                { label: 'Outdoor workers', before: 410, after: 540, beforeDisplay: '410', afterDisplay: '540' },
                { label: 'Residents over 60', before: 290, after: 372, beforeDisplay: '290', afterDisplay: '372' },
              ],
            },
            'Heat-related visits at coastal clinics.',
          ),
        },
        {
          heading: 'Most affected neighbourhoods',
          text: 'Older housing blocks without central cooling account for most of the visits from residents.',
          chart: chartComponent(
            'finding-heat-areas',
            {
              type: 'bars',
              title: 'Resident visits by neighbourhood, this week',
              color: '#ff7a59',
              rows: barRows([
                ['Al Bateen', 86, '86'],
                ['Al Khalidiyah', 74, '74'],
                ['Al Manhal', 61, '61'],
                ['Tourist Club', 55, '55'],
              ]),
            },
            'Heat-related clinic visits from residents, by home neighbourhood.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Extend the midday break for outdoor work to 11:00–16:00, open cooling rooms overnight in the older housing blocks, and send heat alerts to residents over 60 in the four neighbourhoods above.',
        },
      ],
      map: null,
    }),

  'al-ain': () =>
    experience({
      id: 'finding-dumping',
      read: 'Reading the Al Ain station cluster finding from Waste Management and the reports behind it…',
      search:
        'Pulling illegal dumping reports around Al Ain for the last 8 weeks and matching them to the access roads…',
      reason: 'Outlining the three desert access roads where patrols and cameras are active on the Al Ain map…',
      headline: 'Outlined the three desert access roads behind the drop in dumping.',
      headlineDetail:
        'Drew a polygon around each access road on the Al Ain map, labelled with what is deployed and the change.',
      intro:
        'Illegal dumping reports around Al Ain are down 12% week over week, after new patrols and cameras went live on 3 desert access roads. I outlined those roads on the Al Ain map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The pink outlines mark the Al Khatm, Remah and Sweihan access roads. Al Khatm has cameras and shows the biggest drop; Remah and Sweihan have patrols only.',
        },
        {
          heading: 'Reports over time',
          text: 'Reports held around 50–55 a week until the patrols started, then fell to 44 this week.',
          chart: chartComponent(
            'finding-dumping-trend',
            {
              type: 'trend',
              title: 'Illegal dumping reports, Al Ain',
              value: '44',
              unit: 'reports this week',
              color: '#5fe3a1',
              yLabels: ['60', '40', '20'],
              xLabels: ['Week 1', 'Week 4', 'Week 8'],
              line: trendLine([52, 55, 51, 54, 53, 50, 47, 44], 20, 60),
            },
            'Weekly illegal dumping reports around Al Ain.',
          ),
        },
        {
          heading: 'By access road',
          text: 'The road with cameras dropped fastest, which points to cameras as the bigger deterrent.',
          chart: chartComponent(
            'finding-dumping-roads',
            {
              type: 'compare',
              title: 'Reports by access road',
              legend: ['Last week', 'This week'],
              rows: [
                { label: 'Al Khatm · cameras', before: 17, after: 14, beforeDisplay: '17', afterDisplay: '14' },
                { label: 'Remah · patrols', before: 18, after: 16, beforeDisplay: '18', afterDisplay: '16' },
                { label: 'Sweihan · patrols', before: 15, after: 14, beforeDisplay: '15', afterDisplay: '14' },
              ],
            },
            'Dumping reports within 2 km of each access road.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Keep the patrol schedule, and extend camera coverage to the Remah and Sweihan roads, where reports are falling slowest.',
        },
      ],
      map: { place: 'al-ain', title: 'Al Ain station cluster · on the map', tag: 'Al Ain', meta: '3 roads outlined' },
    }),

  'water-network': () =>
    experience({
      id: 'finding-water',
      read: 'Reading the Water Network Pressure Review from Infrastructure and the pressure logs behind it…',
      search: 'Pulling overnight pressure for the zones on the eastern trunk main, last 7 nights…',
      reason: 'Estimating supply interruptions if the valve inspection keeps its current date…',
      headline: 'Four zones on the eastern trunk main are below the 2 bar threshold.',
      headlineDetail:
        'Charted pressure by zone, the decline at the weakest zone and the effect of inspecting the valve sooner.',
      intro:
        'Pressure on the eastern trunk main dropped below the 2 bar threshold overnight. Moving the valve inspection forward would prevent supply interruptions for about 18,000 households in four zones.',
      sections: [
        {
          heading: 'Pressure by zone',
          text: 'Al Muwaiji, Al Towayya, Al Jimi and Falaj Hazza are all under 2 bar; the zones further up the main are still within range.',
          chart: chartComponent(
            'finding-water-zones',
            {
              type: 'bars',
              title: 'Lowest overnight pressure by zone',
              value: '1.6',
              unit: 'bar lowest, Al Muwaiji',
              color: '#4fb3ff',
              rows: barRows([
                ['Al Muwaiji', 1.6, '1.6 bar'],
                ['Al Towayya', 1.7, '1.7 bar'],
                ['Al Jimi', 1.8, '1.8 bar'],
                ['Falaj Hazza', 1.9, '1.9 bar'],
                ['Zakher', 2.4, '2.4 bar'],
                ['Hili', 2.6, '2.6 bar'],
                ['Al Mutaredh', 2.7, '2.7 bar'],
                ['Al Khabisi', 2.9, '2.9 bar'],
              ]),
            },
            'Lowest pressure logged overnight in each zone on the eastern trunk main.',
          ),
        },
        {
          heading: 'Decline at Al Muwaiji',
          text: 'Pressure has slipped every night for a week, which points to the valve rather than demand.',
          chart: chartComponent(
            'finding-water-trend',
            {
              type: 'trend',
              title: 'Overnight pressure, Al Muwaiji',
              value: '1.6',
              unit: 'bar last night',
              color: '#4fb3ff',
              yLabels: ['3 bar', '2 bar', '1 bar'],
              xLabels: ['7 nights ago', 'Last night'],
              line: trendLine([2.4, 2.3, 2.2, 2.0, 1.9, 1.7, 1.6], 1, 3),
            },
            'Lowest overnight pressure in Al Muwaiji, last 7 nights.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Move the valve inspection on the eastern trunk main forward to this week. If pressure keeps falling at this rate, the four zones drop below the supply minimum within 5 days.',
          chart: chartComponent(
            'finding-water-inspection',
            {
              type: 'compare',
              title: 'Valve inspection timing',
              legend: ['As planned', 'Moved forward'],
              rows: [
                {
                  label: 'Households at risk',
                  before: 18400,
                  after: 2100,
                  beforeDisplay: '18,400',
                  afterDisplay: '2,100',
                },
                {
                  label: 'Expected interruption',
                  before: 5,
                  after: 0.5,
                  beforeDisplay: '5 h',
                  afterDisplay: '30 min',
                },
              ],
            },
            'Projected for the four zones under 2 bar.',
          ),
        },
      ],
      map: null,
    }),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one (toasts, alerts). */
export function findingExperience(id: string): FindingExperience | null {
  return EXPERIENCES[id]?.() ?? null
}
