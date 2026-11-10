/**
 * Tell Me More for each Briefing finding. The reply briefs the problem and its cause in bullets beside one
 * chart, then lays out three solutions as tabs fronted by their maps; opening one shows its detail in the
 * panel and switches the map to it.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  ReplySolution,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import { HORIZON_COLOR, HORIZON_SPAN } from '../municipality/dmShared'
import { HOMES_CLEARED, HOMES_EXPOSED, INTERVENTIONS, ODOR_BRIEFING } from '../municipality/odorScenario'
import { URBAN_COUNTS, URBAN_RANKING, urbanActions } from '../municipality/urbanScenario'
import { ESTATE_ASK_VIEWS, isAskView, type EstateAskViewId } from '../realEstate/estateScenario'
import { STATUS, type EstateAskView, type Horizon } from '../realEstate/estateTypes'
import type { StoryAiSnapshot } from '../story/storyAiScenarios'

export type FindingStageId = EstateAskViewId

export type FindingMap = { place: FindingStageId; title: string; tag: string; meta: string }

export type FindingExperience = {
  /** What the ask stage shows the user asking, in place of "Tell me more about …". */
  prompt?: string
  reply: AssistantReplyPayload
  /** The map the stage opens on, slid in with `revealWith`; null answers in charts and keeps the map closed. */
  map: { stateId: string; snapshot: StoryAiSnapshot; revealWith?: string } | null
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

/** A map view: a solution tab's thumbnail, and the view the stage's map switches to. */
function mapComponent(id: string, map: FindingMap, analysis?: string): CreatedComponent {
  return {
    id,
    label: map.title,
    type: 'visual',
    title: map.title,
    description: 'Click to show this view on the map',
    analysis,
    inlineSize: 'full',
    preview: { kind: 'story-map-state', stateId: id, snapshot: findingSnapshot(map.place), tag: map.tag, meta: map.meta },
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

type BarRow = { label: string; value: number; display: string }

function barRows(rows: [label: string, value: number, display: string][]): BarRow[] {
  const max = Math.max(...rows.map(([, value]) => value))
  return rows.map(([label, value, display]) => ({ label, value: (value / max) * 100, display }))
}

type SolutionSpec = Omit<ReplySolution, 'componentId'> & { map: FindingMap }

type ExperienceSpec = {
  id: string
  prompt?: string
  read: string
  search: string
  reason: string
  headline: string
  headlineDetail: string
  problem: string[]
  cause: string[]
  /** The one chart beside the cause. */
  chart: CreatedComponent
  /** The map the stage opens on, and returns to when a solution is closed. */
  map: FindingMap
  solutionsIntro: string
  solutions: SolutionSpec[]
}

/** `stateId` names each map view; the stage's map follows whichever was opened last. */
function experience(spec: ExperienceSpec, stateId: (place: FindingStageId) => string): FindingExperience {
  const steps: ThinkingStep[] = [
    { id: `${spec.id}-read`, kind: 'reasoning', title: spec.read },
    { id: `${spec.id}-search`, kind: 'search', title: spec.search },
    { id: `${spec.id}-reason`, kind: 'reasoning', title: spec.reason },
    { id: `${spec.id}-done`, kind: 'done', title: 'Maps ready' },
  ]
  const overview = mapComponent(stateId(spec.map.place), spec.map, spec.problem.join(' '))
  const solutions = spec.solutions.map(({ map, ...solution }) => ({
    solution,
    component: mapComponent(stateId(map.place), map, `${solution.summary} ${solution.mapNote}`),
  }))
  return {
    prompt: spec.prompt,
    map: { stateId: overview.id, snapshot: findingSnapshot(spec.map.place), revealWith: spec.chart.id },
    reply: {
      headline: spec.headline,
      headlineDetail: spec.headlineDetail,
      thinkingSteps: steps,
      timeline: timeline(steps),
      createdComponents: [overview, spec.chart, ...solutions.map(({ component }) => component)],
      blocks: [
        { type: 'heading', content: 'The problem' },
        { type: 'bullets', items: spec.problem },
        { type: 'heading', content: 'What is causing it' },
        { type: 'bullets', items: spec.cause },
        visual(spec.chart),
        { type: 'heading', content: 'Three solutions' },
        { type: 'text', content: spec.solutionsIntro },
        {
          type: 'solutions',
          overviewId: overview.id,
          solutions: solutions.map(({ solution, component }) => ({ ...solution, componentId: component.id })),
        },
      ],
    },
  }
}

const HORIZON_TAB: Record<Horizon, string> = { immediate: 'Immediate', intermediate: 'Intermediate', long: 'Long-term' }

const cleared = (horizon: Horizon) => `${HOMES_CLEARED[horizon]} of ${HOMES_EXPOSED} homes clear`

/** "AED 25k" or "AED 6.5M" in dirhams, to order a horizon's costs. */
const dirhams = (cost: string) => parseFloat(cost.replace('AED ', '')) * (cost.endsWith('M') ? 1e6 : 1e3)

/** An odor horizon as a solution: its three interventions, what they clear and what they cost. */
function odorSolution(
  horizon: Horizon,
  text: { title: string; summary: string; mapNote: string },
  map: Omit<FindingMap, 'title' | 'meta'>,
): SolutionSpec {
  const items = INTERVENTIONS.filter((item) => item.horizon === horizon)
  const byCost = [...items].sort((a, b) => dirhams(a.cost) - dirhams(b.cost))
  const best = Math.max(...items.map((item) => item.reduction))
  return {
    ...text,
    label: HORIZON_TAB[horizon],
    span: HORIZON_SPAN[horizon],
    color: HORIZON_COLOR[horizon],
    stats: [
      { label: 'Homes cleared', value: `${HOMES_CLEARED[horizon]} of ${HOMES_EXPOSED}` },
      { label: 'Best exposure cut', value: `${best}%` },
      { label: 'Cost', value: `${byCost[0].cost}–${byCost[byCost.length - 1].cost.replace('AED ', '')}` },
    ],
    chart: {
      type: 'bars',
      title: 'Modelled odor exposure removed, by action',
      value: `${best}%`,
      unit: 'the most any one action removes',
      color: HORIZON_COLOR[horizon],
      rows: items.map((item) => ({ label: `${item.code} ${item.action}`, value: item.reduction, display: `${item.reduction}%` })),
    },
    actions: items.map((item) => ({
      code: item.code,
      title: item.action,
      subtitle: item.asset,
      detail: item.benefit,
      metrics: [`−${item.reduction}% exposure`, item.cost, `${item.sustainability} sustainability`],
    })),
    map: { ...map, title: `${HORIZON_TAB[horizon]} · ${text.title}`, meta: cleared(horizon) },
  }
}

const URBAN_SPAN: Record<Horizon, string> = { immediate: 'next 6 months', intermediate: '1–3 years', long: '3–10 years' }

/** An urban horizon as a solution: the communities it acts on and what it does in each. */
function urbanSolution(
  horizon: Horizon,
  text: { title: string; summary: string; lever: string },
  place: FindingStageId,
): SolutionSpec {
  const actions = urbanActions(horizon)
  const ranked = [...actions].sort((a, b) => b.score - a.score)
  return {
    chart: {
      type: 'bars',
      title: 'Combined planning score, communities acted on',
      value: `${ranked[0].score}`,
      unit: `${ranked[0].name}, of 100`,
      color: HORIZON_COLOR[horizon],
      rows: ranked.map((row) => ({ label: row.name, value: row.score, display: String(row.score) })),
    },
    title: text.title,
    summary: text.summary,
    label: HORIZON_TAB[horizon],
    span: URBAN_SPAN[horizon],
    color: HORIZON_COLOR[horizon],
    stats: [
      { label: 'Communities', value: `${actions.length} of 20` },
      { label: 'Lever', value: text.lever },
    ],
    mapNote: `The map highlights the ${actions.length} communities this horizon acts on.`,
    actions: actions.map(({ name, act }) => ({ title: name, detail: act })),
    map: { place, title: `${HORIZON_TAB[horizon]} · ${text.title}`, tag: 'Dubai', meta: `${actions.length} communities` },
  }
}

const odorShare = Math.round((ODOR_BRIEFING.inWindow / ODOR_BRIEFING.complaints) * 100)

const EXPERIENCES: Record<string, (stateId: (place: FindingStageId) => string) => FindingExperience> = {
  odor: (stateId) =>
    experience(
      {
        id: 'finding-odor',
        prompt: 'What is causing the odor around Al Barsha’s parks, and how do we fix it?',
        read: 'Reading 30 days of CRM odor complaints and social posts around Al Barsha’s parks…',
        search: 'Matching complaints to irrigation schedules, the recycled-water network and water samples…',
        reason: 'Weighing nine interventions across three impact horizons, and mapping each one…',
        headline: 'Recycled irrigation water that fails the quality standard is the likely source of the odor in Al Barsha’s parks.',
        headlineDetail: 'Three solutions follow, each with its own map. Open one to see its detail and switch the map.',
        problem: [
          `${ODOR_BRIEFING.complaints} odor complaints in 30 days across Al Barsha’s three parks.`,
          `${ODOR_BRIEFING.inWindow} of them (${odorShare}%) came in the ${ODOR_BRIEFING.window} irrigation window, and complaints track irrigation hours closely.`,
          `Evening winds carry the smell into ${HOMES_EXPOSED} homes in Al Barsha 2.`,
        ],
        cause: [
          'All three parks are irrigated with recycled water from one supply network, through storage tanks T-1, T-3 and T-5.',
          `${ODOR_BRIEFING.failing} of ${ODOR_BRIEFING.samples.length} water samples fail the standard. The ${ODOR_BRIEFING.worst.name} is worst, at ${ODOR_BRIEFING.worst.times} the hydrogen sulphide limit.`,
          'Water entering from the supply main meets the standard, so it turns septic in the tanks and mains before the sprinklers release it.',
        ],
        chart: chartComponent(
          'finding-odor-samples',
          {
            type: 'bars',
            title: 'Hydrogen sulphide in irrigation water',
            value: ODOR_BRIEFING.worst.times,
            unit: `the limit at the ${ODOR_BRIEFING.worst.name}`,
            color: STATUS.critical,
            rows: barRows(ODOR_BRIEFING.samples.map((sample) => [sample.name, sample.h2s, sample.h2s.toFixed(2)])),
          },
          `Hydrogen sulphide by sampling site, mg/L. The standard allows ${ODOR_BRIEFING.limit}.`,
        ),
        map: { place: 'odor', title: 'Odor plume and exposed homes · Al Barsha', tag: 'Al Barsha', meta: `${HOMES_EXPOSED} homes in the plume` },
        solutionsIntro:
          'Open one to see its detail and its map. Start the immediate fixes this week and take the treatment upgrade to capital planning: retiming needs re-tuning each season.',
        solutions: [
          odorSolution(
            'immediate',
            {
              title: 'Retime, flush and isolate',
              summary: `Move Z-2 and Z-3 out of the ${ODOR_BRIEFING.window} window, flush the stagnant lines and isolate the worst zone while the tanks are fixed. Retiming alone cuts modelled exposure 41% for AED 25k, the best value of all nine options.`,
              mapNote: 'The map shows Z-2 retimed to 00:30–03:00, Z-3 isolated, the flushed lines and the plume that remains.',
            },
            { place: 'odor-immediate', tag: 'Al Barsha' },
          ),
          odorSolution(
            'intermediate',
            {
              title: 'Rehabilitate T-3, dose and control',
              summary: 'Clean and rehabilitate storage tank T-3 so its water stops turning septic, dose the supply before it reaches the parks, and fit 14 smart controllers that hold irrigation back when wind or water quality turns.',
              mapNote: 'The map shows T-3 rehabilitated, the dosing point on the supply main, the 14 controllers and the plume that remains.',
            },
            { place: 'odor-intermediate', tag: 'Pond Park' },
          ),
          odorSolution(
            'long',
            {
              title: 'Treat, loop and predict',
              summary: 'Polish the recycled water before it reaches Al Barsha so it meets the standard at every tank, loop the dead-end mains so water keeps moving, and forecast odor six hours ahead with 36 sensors.',
              mapNote: 'The map shows the polished supply, the proposed looped mains and the sensor grid across all three parks.',
            },
            { place: 'odor-long', tag: 'Al Barsha' },
          ),
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
        headlineDetail: 'Three solutions follow, each with its own map. Open one to see its detail and switch the map.',
        problem: [
          `${URBAN_COUNTS.priority} of 20 Dubai communities need priority intervention: growth, land-use drift and capacity gaps overlap there.`,
          `${URBAN_COUNTS.manage} more need managing and ${URBAN_COUNTS.monitor} are on track.`,
          'Dubai South grows fastest but is not a priority: its land and capacity are still ahead of demand.',
        ],
        cause: [
          'JVC, Business Bay and Arjan score highest when growth, land use, infrastructure and services are combined.',
          'Each runs sewerage above 90% of capacity, with school seats below one per 1,000 residents.',
          'JVC and Arjan keep filing land-use change applications, pulling them further from the plan.',
        ],
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
        map: { place: 'urban', title: 'Integrated planning priority · Dubai', tag: 'Dubai', meta: `${URBAN_COUNTS.priority} priority areas` },
        solutionsIntro:
          'Open one to see its detail and its map. Put conditional approvals in place in the priority areas now, and bring the JVC sewer trunk forward in the capital plan.',
        solutions: [
          urbanSolution(
            'immediate',
            {
              title: 'Condition, pause and fast-track approvals',
              summary: 'Condition approvals in JVC and Arjan on sewerage sign-off, phase Business Bay’s to capacity, pause change-of-use approvals in Al Quoz and fast-track aligned applications where capacity exists.',
              lever: 'Approvals',
            },
            'urban-immediate',
          ),
          urbanSolution(
            'intermediate',
            {
              title: 'Phase growth with infrastructure',
              summary: 'Deliver a sewer trunk and two schools for JVC, drainage and a school for Business Bay, upgrades in Al Furjan, Town Square, JLT and International City, and Dubai South’s services ahead of its handovers.',
              lever: 'Infrastructure',
            },
            'urban-intermediate',
          ),
          urbanSolution(
            'long',
            {
              title: 'Replan and open a growth corridor',
              summary: 'Revise density and zoning where pressure keeps recurring, rezone Al Quoz for mixed use with worker housing, and direct new growth along a southern corridor from the Marina to Expo City and Dubai South.',
              lever: 'Zoning',
            },
            'urban-long',
          ),
        ],
      },
      stateId,
    ),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string, stateId: (place: FindingStageId) => string): FindingExperience | null {
  return EXPERIENCES[id]?.(stateId) ?? null
}
