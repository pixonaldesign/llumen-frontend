/**
 * Tell Me More for each Briefing finding. The reply opens on the finding's map, then lays out solutions in
 * three impact horizons; each horizon carries its own map card, and clicking one switches the map to it.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import { HORIZON_COLOR } from '../municipality/dmShared'
import { HOMES_CLEARED, HOMES_EXPOSED, INTERVENTIONS, MENTIONS_BY_WEEK } from '../municipality/odorScenario'
import { URBAN_ACTS, URBAN_COUNTS, URBAN_RANKING } from '../municipality/urbanScenario'
import { ESTATE_ASK_VIEWS, isAskView, type EstateAskViewId } from '../realEstate/estateScenario'
import { STATUS, type EstateAskView } from '../realEstate/estateTypes'
import type { StoryAiSnapshot } from '../story/storyAiScenarios'

export type FindingStageId = EstateAskViewId

export type FindingMap = { place: FindingStageId; title: string; tag: string; meta: string }

export type FindingExperience = {
  /** What the ask stage shows the user asking, in place of "Tell me more about …". */
  prompt?: string
  reply: AssistantReplyPayload
  /** The map the stage opens on, the reply's first map card; null answers in charts and keeps the map closed. */
  map: { stateId: string; snapshot: StoryAiSnapshot } | null
}

export const isFindingPlace = isAskView

/** The map Tell Me More opens for a view: its camera, scene and Map Data. */
export function findingStage(place: FindingStageId): EstateAskView {
  return ESTATE_ASK_VIEWS[place]
}

const findingSnapshot = (place: FindingStageId): StoryAiSnapshot => ({
  cards: null,
  region: false,
  areaEffect: null,
  filterLabels: {},
  findingPlace: place,
})

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

/** A map card: clicking it switches the stage's map to this view. */
function mapComponent(id: string, map: FindingMap): CreatedComponent {
  return {
    id,
    label: map.title,
    type: 'visual',
    title: map.title,
    description: 'Click to show this view on the map',
    inlineSize: 'full',
    preview: { kind: 'story-map-state', stateId: id, snapshot: findingSnapshot(map.place), tag: map.tag, meta: map.meta },
  }
}

function visual(component: CreatedComponent): AgentResponseBlock {
  const map = component.preview?.kind === 'story-map-state'
  return {
    type: 'visual',
    componentId: component.id,
    visualType: map ? 'map' : 'chart',
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

type Section = { heading: string; text: string; chart?: CreatedComponent; map?: FindingMap }

type ExperienceSpec = {
  id: string
  prompt?: string
  read: string
  search: string
  reason: string
  headline: string
  headlineDetail: string
  intro: string
  /** The map the stage opens on, carded after the intro. */
  map: FindingMap | null
  sections: Section[]
}

/** `stateId` names each map card; the stage's map follows whichever card was clicked last. */
function experience(spec: ExperienceSpec, stateId: (place: FindingStageId) => string): FindingExperience {
  const steps: ThinkingStep[] = [
    { id: `${spec.id}-read`, kind: 'reasoning', title: spec.read },
    { id: `${spec.id}-search`, kind: 'search', title: spec.search },
    { id: `${spec.id}-reason`, kind: 'reasoning', title: spec.reason },
    { id: `${spec.id}-done`, kind: 'done', title: spec.map ? 'Maps ready' : 'Charts ready' },
  ]
  const primary = spec.map ? mapComponent(stateId(spec.map.place), spec.map) : null
  const sections = spec.sections.map((section) => ({
    ...section,
    components: [
      ...(section.chart ? [section.chart] : []),
      ...(section.map ? [mapComponent(stateId(section.map.place), section.map)] : []),
    ],
  }))
  return {
    prompt: spec.prompt,
    map: primary && spec.map ? { stateId: primary.id, snapshot: findingSnapshot(spec.map.place) } : null,
    reply: {
      headline: spec.headline,
      headlineDetail: spec.headlineDetail,
      thinkingSteps: steps,
      timeline: timeline(steps),
      createdComponents: [...(primary ? [primary] : []), ...sections.flatMap((section) => section.components)],
      blocks: [
        { type: 'text', content: spec.intro },
        ...(primary ? [visual(primary)] : []),
        ...sections.flatMap((section): AgentResponseBlock[] => [
          { type: 'heading', content: section.heading },
          { type: 'text', content: section.text },
          ...section.components.map(visual),
        ]),
      ],
    },
  }
}

/** "Three options: I1 …, I2 … and I3 …." */
function options(horizon: 'immediate' | 'intermediate' | 'long') {
  const named = INTERVENTIONS.filter((item) => item.horizon === horizon).map((item) => `${item.code} ${item.action.toLowerCase()}`)
  return `Three options: ${named.slice(0, -1).join(', ')} and ${named.at(-1)}.`
}

const cleared = (horizon: 'immediate' | 'intermediate' | 'long') => `${HOMES_CLEARED[horizon]} of ${HOMES_EXPOSED} homes clear`

const EXPERIENCES: Record<string, (stateId: (place: FindingStageId) => string) => FindingExperience> = {
  odor: (stateId) =>
    experience(
      {
        id: 'finding-odor',
        prompt: 'What is causing the odor around Al Barsha’s parks, and how do we fix it?',
        read: 'Reading 90 days of CRM odor complaints and 30 days of social posts around Al Barsha’s parks…',
        search: 'Matching complaints to irrigation schedules, water samples and evening winds…',
        reason: 'Weighing nine interventions across three impact horizons, and mapping each one…',
        headline: 'Recycled-water irrigation from storage tank T-3 is the likely source, and evening winds carry it to about 1,850 residents.',
        headlineDetail: 'Solutions follow in three horizons, each with its own map card. Click a card to switch the map.',
        intro: `Complaints about unpleasant odors near Al Barsha’s parks rose 64% in 30 days. They follow the irrigation schedule: they rise within 40 minutes of Zones Z-2 and Z-3 starting, and water leaving storage tank T-3 in the Pond Park pump house carries about 20 times the hydrogen sulphide of the network inlet. Evening winds from the west-north-west carry it into ${HOMES_EXPOSED} homes in Al Barsha 2.`,
        map: { place: 'odor', title: 'Odor plume and exposed homes · Al Barsha', tag: 'Al Barsha', meta: `${HOMES_EXPOSED} homes in the plume` },
        sections: [
          {
            heading: 'What is causing it',
            text: 'Water sampled at the T-3 outlet holds 0.42 mg/L of hydrogen sulphide, against 0.02 at the supply inlet. The tank has 38 cm of sediment and water stays in the park ring main for 4.6 days, more than twice the target, so it turns stagnant before it reaches the sprinklers.',
            chart: chartComponent(
              'finding-odor-samples',
              {
                type: 'bars',
                title: 'Hydrogen sulphide in irrigation water',
                value: '0.42',
                unit: 'mg/L at the T-3 outlet',
                color: STATUS.critical,
                rows: barRows([
                  ['T-3 outlet', 0.42, '0.42'],
                  ['Eastern dead-end', 0.24, '0.24'],
                  ['Ring main, east', 0.21, '0.21'],
                  ['Z-2 emitters', 0.18, '0.18'],
                  ['Supply inlet', 0.02, '0.02'],
                ]),
              },
              'Hydrogen sulphide by sampling site, mg/L.',
            ),
          },
          {
            heading: 'Who is affected',
            text: 'Irrigation runs 20:00–23:30, when the evening wind blows onshore on 22 nights in 30. The modelled plume reaches 1.4 km east into Al Barsha 2, covering about 1,850 residents, three schools and a health centre.',
            chart: chartComponent(
              'finding-odor-trend',
              {
                type: 'trend',
                title: 'Negative odor mentions a week',
                value: '121',
                unit: 'last week, up from 38',
                color: HORIZON_COLOR.long,
                yLabels: ['130', '80', '30'],
                xLabels: ['Aug', 'Sep', 'Oct', 'Nov'],
                line: trendLine(MENTIONS_BY_WEEK, 30, 130),
              },
              'Negative social posts about odor near Al Barsha’s parks, a week.',
            ),
          },
          {
            heading: 'Immediate impact · days to weeks',
            text: `${options('immediate')} Moving Z-2 and Z-3 to 00:30–03:00, after the breeze drops, cuts modelled exposure 41% for about AED 25,000, the best value of all nine options. The map shows the zones retimed and isolated, the lines flushed and the plume that remains.`,
            map: { place: 'odor-immediate', title: 'Immediate · retime, flush and isolate', tag: 'Al Barsha', meta: cleared('immediate') },
          },
          {
            heading: 'Intermediate impact · 3–12 months',
            text: `${options('intermediate')} Cleaning and rehabilitating T-3 removes the sediment at the source and halves water age; 14 smart controllers then hold irrigation back whenever wind or water quality turns. Together they cut exposure by about half.`,
            map: { place: 'odor-intermediate', title: 'Intermediate · rehabilitate T-3, dose and control', tag: 'Pond Park', meta: cleared('intermediate') },
          },
          {
            heading: 'Long-term impact · 1–3 years',
            text: `${options('long')} Polishing the recycled water before it reaches Al Barsha removes 78% of exposure and lasts; looping the eastern dead-ends keeps water moving, and 36 sensors forecast odor six hours ahead.`,
            map: { place: 'odor-long', title: 'Long-term · treat, loop and predict', tag: 'Al Barsha', meta: cleared('long') },
          },
          {
            heading: 'Recommended action',
            text: 'Retime Z-2 and Z-3 this week and flush the eastern lines, then schedule T-3’s rehabilitation. Take the treatment upgrade to capital planning: the quick fix needs re-tuning each season, so it does not replace the long-term one.',
          },
        ],
      },
      stateId,
    ),

  'urban-growth': (stateId) =>
    experience(
      {
        id: 'finding-urban',
        prompt: 'Where should Dubai Municipality intervene to keep growth in step with capacity?',
        read: 'Reading population, density, built-up growth and the committed pipeline for 20 communities…',
        search: 'Comparing planned and actual land use, infrastructure capacity, housing and services…',
        reason: 'Combining the four signals and sorting each community into an action for each horizon…',
        headline: `${URBAN_COUNTS.priority} communities need priority intervention, where growth, land-use drift and capacity gaps overlap.`,
        headlineDetail: 'Actions follow in three horizons, each with its own map card. Click a card to switch the map.',
        intro: `I combined four signals for 20 Dubai communities: growth pressure, how far land use has drifted from the plan, infrastructure capacity, and whether housing and services keep pace. ${URBAN_COUNTS.priority} are Priority Intervention, ${URBAN_COUNTS.manage} need managing and ${URBAN_COUNTS.monitor} are on track. The fastest-growing, Dubai South, is not a priority: its land and capacity are still ahead of demand.`,
        map: { place: 'urban', title: 'Integrated planning priority · Dubai', tag: 'Dubai', meta: `${URBAN_COUNTS.priority} priority areas` },
        sections: [
          {
            heading: 'Where pressure converges',
            text: 'JVC, Business Bay and Arjan score highest. Each runs sewerage above 90%, has school seats below one per 1,000 residents, and, in JVC and Arjan, keeps filing land-use change applications.',
            chart: chartComponent(
              'finding-urban-ranking',
              {
                type: 'bars',
                title: 'Combined planning score',
                value: `${URBAN_RANKING[0].score}`,
                unit: `${URBAN_RANKING[0].name}, of 100`,
                color: STATUS.critical,
                rows: barRows(URBAN_RANKING.slice(0, 5).map((row) => [row.name, row.score, String(row.score)])),
              },
              'Growth, land-use, infrastructure and service signals combined, out of 100.',
            ),
          },
          {
            heading: 'Immediate impact · next 6 months',
            text: `Condition approvals in JVC and Arjan on sewerage sign-off, phase Business Bay’s approvals to capacity, pause change-of-use approvals in Al Quoz and start a land-use review in Motor City. Fast-track aligned applications in Creek Harbour and MBR City, which have the capacity. ${Object.keys(URBAN_ACTS.immediate).length} communities change.`,
            map: { place: 'urban-immediate', title: 'Immediate · condition, pause and fast-track approvals', tag: 'Dubai', meta: `${Object.keys(URBAN_ACTS.immediate).length} communities` },
          },
          {
            heading: 'Intermediate impact · 1–3 years',
            text: 'Phase development with infrastructure: a sewer trunk and two schools for JVC, drainage and a school for Business Bay, and upgrades in Al Furjan, Town Square, JLT and International City. Deliver Dubai South’s community services ahead of its handovers.',
            map: { place: 'urban-intermediate', title: 'Intermediate · phase growth with infrastructure', tag: 'Dubai', meta: `${Object.keys(URBAN_ACTS.intermediate).length} communities` },
          },
          {
            heading: 'Long-term impact · 3–10 years',
            text: 'Replan where pressure keeps recurring: revise density and zoning in JVC, Arjan and Motor City, rezone Al Quoz for mixed use with worker housing, and direct new growth along a southern corridor from the Marina to Expo City and Dubai South.',
            map: { place: 'urban-long', title: 'Long-term · replan and open a growth corridor', tag: 'Dubai', meta: `${Object.keys(URBAN_ACTS.long).length} communities` },
          },
          {
            heading: 'Recommended action',
            text: 'Put conditional approvals in place in the five priority areas now, and bring the JVC sewer trunk forward in the capital plan. Open the story to see each signal on the map.',
          },
        ],
      },
      stateId,
    ),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string, stateId: (place: FindingStageId) => string): FindingExperience | null {
  return EXPERIENCES[id]?.(stateId) ?? null
}
