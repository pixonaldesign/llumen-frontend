/**
 * Tell Me More for each Briefing finding, and the Briefing AI bar's three answers. A finding on the map
 * opens its place in the ask stage; the AI bar's answers each open their own view of Abu Dhabi Island:
 * the candidate sites against the network, the top site close up, then the evening re-rank.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import {
  EVENING_RANKING,
  NETWORK_AVERAGE,
  SITE_ONE,
  SITE_RANKING,
  STATION_COLOR,
  SITE_COLOR,
  TOMTOM_ASK_VIEWS,
  TOMTOM_STORIES,
  type TomtomAskStageId,
  type TomtomAskView,
} from '../tomtom/tomtomScenario'
import { PALETTE } from '../tomtom/tomtomTypes'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'

/** A Briefing place, or one of the AI bar answers' views. */
export type FindingStageId = BriefingPlaceId | TomtomAskStageId

/** Typed into the Briefing's AI bar on the first keystroke: opens the stage on every candidate site. */
export const TT_ASK_PROMPT = 'I have 12 candidate sites. How do they compare to my current stations?'
/** Offered once the sites are on the map: zooms into the top site. */
export const TT_DIVE_PROMPT = `Zoom into ${SITE_ONE.name} on ${SITE_ONE.street}. Why does it rank first?`
/** Offered once the top site is on the map: re-ranks the sites on evening traffic. */
export const TT_EVENING_PROMPT = 'What if we only count evenings, 5pm to 9pm?'
export const TT_ASK_ID = 'tt-ask'
export const TT_DIVE_ID = 'tt-dive'
export const TT_EVENING_ID = 'tt-evening'

export type FindingMap = { place: FindingStageId; title: string; tag: string; meta: string }

export type FindingExperience = {
  /** What the ask stage shows the user asking, in place of "Tell me more about …". */
  prompt?: string
  reply: AssistantReplyPayload
  /** The finding's own map for the stage; null answers in charts and keeps the map closed. */
  map: FindingMap | null
}

const isAskStage = (id: string): id is TomtomAskStageId => id in TOMTOM_ASK_VIEWS

export function isFindingPlace(id: string | undefined): id is FindingStageId {
  return id !== undefined && (id in BRIEFING_PLACES || isAskStage(id))
}

const placeViews = new Map<BriefingPlaceId, TomtomAskView>()

/** The map an answer opens: its own view, or for a Briefing place, the first page of the story there. */
export function findingStage(place: FindingStageId): TomtomAskView {
  if (isAskStage(place)) return TOMTOM_ASK_VIEWS[place]
  let view = placeViews.get(place)
  if (!view) {
    const story = Object.values(TOMTOM_STORIES).find((item) => item.place === place)
    const page = story?.pages[0]
    view = page
      ? { camera: page.camera, scene: page.scene, layers: page.layers }
      : { camera: BRIEFING_PLACES[place].camera, scene: BRIEFING_PLACES[place].scene, layers: [] }
    placeViews.set(place, view)
  }
  return view
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
  prompt?: string
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
    prompt: spec.prompt,
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

const km = (value: number) => `${value.toFixed(1)} km`
const [FIRST, SECOND, THIRD] = SITE_RANKING
const ABOVE_70 = SITE_RANKING.filter((site) => site.score > 70)
const EVENING_UP = EVENING_RANKING.slice(0, 5)
const climbers = EVENING_UP.filter((site) => SITE_RANKING.indexOf(site) > EVENING_RANKING.indexOf(site))
const ordinal = (index: number) => ['first', 'second', 'third', 'fourth', 'fifth'][index] ?? `${index + 1}th`

/** Prompt 1: every candidate on the island against the network. */
const ttAsk = () =>
  experience({
    id: TT_ASK_ID,
    read: 'Reading your 12 candidate sites and 8 stations on Abu Dhabi Island…',
    search: 'Pulling TomTom traffic density, drive-time catchments and rival forecourts for each site…',
    reason: 'Scoring each site and drawing it on the map against your network…',
    headline: `${ABOVE_70.length} of the 12 sites score above 70; ${FIRST.name} on ${FIRST.street} leads at ${FIRST.score}.`,
    headlineDetail:
      'Pinned all 12 by rank, stood a fence on each arterial as tall as its traffic is dense, and put a disk under each site sized by its projected volume.',
    intro: `I scored the 12 candidates out of 100 on passing traffic, drive-time catchment, competition and access, from TomTom traffic and map data for the last 90 days. ${ABOVE_70.length} score above 70, and all of them would sell more fuel than your average station's ${NETWORK_AVERAGE.toFixed(1)}M litres a year.`,
    sections: [
      {
        heading: 'On the map',
        text: 'The teal labels are the candidates, numbered by rank, and the blue ones your stations. The fences on the roads are traffic density: the taller and redder a stretch, the heavier its traffic, from green through yellow to dark red. Hover any label or fence for its figures.',
      },
      {
        heading: 'Top sites',
        text: `${FIRST.name} has the heaviest traffic of the five, ${FIRST.traffic.toFixed(1)}k vehicles a day, after ${SECOND.name} on the Corniche. ${THIRD.name} ranks third on the largest catchment.`,
        chart: chartComponent(
          'tt-ask-ranking',
          {
            type: 'bars',
            title: 'Site score, top five',
            value: String(FIRST.score),
            unit: `${FIRST.name}, of 100`,
            color: SITE_COLOR,
            rows: barRows(ABOVE_70.map((site) => [site.name, site.score, String(site.score)])),
          },
          'Score out of 100: traffic, catchment, competition and access together.',
        ),
      },
      {
        heading: 'Against your stations',
        text: `${FIRST.name} would sell ${FIRST.volume.toFixed(1)}M litres a year, ${Math.round((FIRST.volume / NETWORK_AVERAGE - 1) * 100)}% more than your average station, and its catchment overlaps yours by only 6%. ${SECOND.name} overlaps your Khalidiyah Park station by 22%.`,
        chart: chartComponent(
          'tt-ask-volume',
          {
            type: 'bars',
            title: 'Projected fuel volume',
            value: `${FIRST.volume.toFixed(1)}M`,
            unit: `litres a year, ${FIRST.name}`,
            color: STATION_COLOR,
            rows: barRows([
              ...ABOVE_70.map((site): [string, number, string] => [site.name, site.volume, `${site.volume.toFixed(1)}M`]),
              ['Your average station', NETWORK_AVERAGE, `${NETWORK_AVERAGE.toFixed(1)}M`],
            ]),
          },
          'Fuel each site would sell in its first full year, in litres.',
        ),
      },
      {
        heading: 'Recommended action',
        text: `Take ${FIRST.name}, ${SECOND.name} and ${THIRD.name} to site visits, ${FIRST.name} first. ${SECOND.name}’s overlap with Khalidiyah Park would take about a fifth of its volume from your own station.`,
      },
    ],
    map: { place: 'tt-ask', title: 'Candidate sites vs your stations · on the map', tag: 'Abu Dhabi Island', meta: '12 sites · 8 stations · 24 rivals' },
  })

/** Prompt 2: the top site close up. */
const ttDive = () => {
  const hours = SITE_ONE.hours.inbound.map((value, index) => value + SITE_ONE.hours.outbound[index])
  return experience({
    id: TT_DIVE_ID,
    read: `Reading ${SITE_ONE.name}’s plot, frontage and turn-ins on ${SITE_ONE.street}…`,
    search: 'Pulling hourly TomTom traffic in both directions and the rivals within 3 km…',
    reason: 'Zooming in on the site and the traffic past it…',
    headline: `${SITE_ONE.name} ranks first on traffic and access: ${SITE_ONE.traffic.toFixed(1)}k vehicles a day from both directions, and the nearest rival is ${km(SITE_ONE.rivalKm)} away.`,
    headlineDetail: 'Zoomed into the site with the traffic density on the streets around it and its four nearest rivals.',
    intro: `${SITE_ONE.name} sits on ${SITE_ONE.street}, one of the island’s two busiest arterials, with entries from both carriageways. ${SITE_ONE.rivalsWithin3} rivals trade within 3 km, but the nearest is ${km(SITE_ONE.rivalKm)} away and your own nearest station ${km(SITE_ONE.stationKm)}.`,
    sections: [
      {
        heading: 'On the map',
        text: 'The fences are traffic in both directions, tallest and reddest where it is densest, which on Sheikh Zayed Bin Sultan St is right outside the site. The blue labels are your two closest stations. Click the site’s label for its full details.',
      },
      {
        heading: 'Traffic by hour',
        text: 'Traffic peaks twice: inbound at 8am, then both directions from 5 to 7pm, when 3,700 vehicles an hour pass the site.',
        chart: chartComponent(
          'tt-dive-hours',
          {
            type: 'trend',
            title: 'Vehicles an hour, both directions',
            value: '3.7k',
            unit: 'at 6pm',
            color: SITE_COLOR,
            yLabels: ['4k', '2k', '0'],
            xLabels: ['6am', '10am', '2pm', '6pm', '9pm'],
            line: trendLine(hours, 0, 4),
          },
          'Vehicles passing the site each hour, average weekday, last 90 days.',
        ),
      },
      {
        heading: 'Why it ranks first',
        text: 'It scores above 80 on all four measures, and highest on traffic. Competition is its weakest, with eight rivals within 3 km, none of them on its stretch of the street.',
        chart: chartComponent(
          'tt-dive-score',
          {
            type: 'bars',
            title: 'Score breakdown',
            value: String(SITE_ONE.score),
            unit: 'overall, of 100',
            color: SITE_COLOR,
            rows: barRows([
              ['Traffic', 92, '92'],
              ['Access', 88, '88'],
              ['Catchment', 84, '84'],
              ['Competition', 81, '81'],
            ]),
          },
          'Each measure scored out of 100.',
        ),
      },
      {
        heading: 'Recommended action',
        text: `Book the site visit for ${SITE_ONE.name} and check the southbound turn-in: it carries 31% of arrivals. Plan for the evening peak with at least 12 pumps.`,
      },
    ],
    map: { place: 'tt-dive', title: `${SITE_ONE.name} site · on the map`, tag: SITE_ONE.street, meta: '1 site · 4 rivals · 5 streets' },
  })
}

/** Prompt 3: the sites re-ranked on 5 to 9pm. */
const ttEvening = () =>
  experience({
    id: TT_EVENING_ID,
    read: 'Filtering TomTom traffic to 5pm – 9pm on weekdays…',
    search: 'Re-scoring each site on evening traffic, catchment and rival opening hours…',
    reason: 'Re-ranking the sites and adding evening fuel demand to the map…',
    headline: `Counting only 5 to 9pm, ${climbers.map((site) => `${site.name} climbs to ${ordinal(EVENING_RANKING.indexOf(site))}`).join(' and ')}; ${EVENING_RANKING[0].name} stays first at ${EVENING_RANKING[0].evening}.`,
    headlineDetail: 'Re-ranked the sites on evening traffic, raised the traffic fences to 5 to 9pm and added evening fuel demand as a heatmap.',
    intro: `Evening traffic heads home off the island’s inner arterials, and the sites on them gain. ${climbers.map((site) => site.name).join(' and ')} move up; ${SECOND.name}, on the Corniche, drops because its beachfront traffic is a daytime trade.`,
    sections: [
      {
        heading: 'On the map',
        text: 'The sites are renumbered by evening rank. The purple glow is fuel demand from 5 to 9pm, heaviest along Sheikh Rashid Bin Saeed St and Al Khaleej Al Arabi St. The fences now show evening traffic, densest on Sheikh Zayed Bin Sultan St and those same two streets.',
      },
      {
        heading: 'Evening ranking',
        text: `${EVENING_UP.map((site) => site.name).slice(0, 3).join(', ')} lead between 5 and 9pm.`,
        chart: chartComponent(
          'tt-evening-ranking',
          {
            type: 'bars',
            title: 'Site score, 5–9pm',
            value: String(EVENING_RANKING[0].evening),
            unit: `${EVENING_RANKING[0].name}, of 100`,
            color: SITE_COLOR,
            rows: barRows(EVENING_UP.map((site) => [site.name, site.evening, String(site.evening)])),
          },
          'Score out of 100, counting weekday traffic from 5 to 9pm only.',
        ),
      },
      {
        heading: 'Who gains',
        text: 'The sites on the routes home gain most: over a third of their traffic passes between 5 and 9pm. Al Khalidiyah, on the Corniche, sees 24% then and loses five points.',
        chart: chartComponent(
          'tt-evening-change',
          {
            type: 'bars',
            title: 'Share of the day’s traffic, 5–9pm',
            value: `${Math.max(...EVENING_UP.map((site) => site.eveningShare))}%`,
            unit: 'highest',
            color: PALETTE.purple[3],
            rows: barRows(EVENING_UP.map((site) => [site.name, site.eveningShare, `${site.eveningShare}%`])),
          },
          'Share of each site’s daily passing traffic counted between 5 and 9pm.',
        ),
      },
      {
        heading: 'Recommended action',
        text: `If evening trade matters most, as shop and café sales peak then, visit ${EVENING_RANKING[1].name} ahead of ${SECOND.name}. ${EVENING_RANKING[0].name} stays the first choice either way.`,
      },
    ],
    map: { place: 'tt-evening', title: 'Candidate sites, 5–9pm · on the map', tag: 'Abu Dhabi Island', meta: '12 sites re-ranked' },
  })

const EXPERIENCES: Record<string, () => FindingExperience> = {
  [TT_ASK_ID]: ttAsk,
  [TT_DIVE_ID]: ttDive,
  [TT_EVENING_ID]: ttEvening,
  shortlist: () => ({
    ...ttAsk(),
    prompt: 'Which candidate site should we open first?',
    map: { place: 'zahiyah', title: 'Next Site Shortlist · on the map', tag: 'Abu Dhabi Island', meta: '12 sites · 8 stations' },
  }),
  'evening-corridor': () => ({
    ...ttEvening(),
    prompt: 'Why does Sheikh Rashid Bin Saeed St matter in the evening?',
    map: { place: 'corridor', title: 'Evening Demand, 5–9pm · on the map', tag: 'Sheikh Rashid Bin Saeed St', meta: '3 sites · 5 rivals' },
  }),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string): FindingExperience | null {
  return EXPERIENCES[id]?.() ?? null
}
