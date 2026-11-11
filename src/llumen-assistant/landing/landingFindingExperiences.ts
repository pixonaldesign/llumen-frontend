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
import {
  HOMES_EXPOSED,
  INTERVENTIONS,
  ODOR_BRIEFING,
  ODOR_DECLINE,
  UNITS_CLEARED,
  UNITS_EXPOSED,
} from '../municipality/odorScenario'
import { FACILITIES_BRIEFING, FACILITIES_SOLUTIONS } from '../municipality/facilitiesScenario'
import type { PlanningSolution } from '../municipality/growthAreas'
import { INFRASTRUCTURE_BRIEFING, INFRASTRUCTURE_SOLUTIONS } from '../municipality/infrastructureScenario'
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

const cleared = (horizon: Horizon) => `${UNITS_CLEARED[horizon]} of ${UNITS_EXPOSED} residential units clear`

/** "AED 5k" or "AED 6.5M" in dirhams, to order a horizon's costs. */
const dirhams = (cost: string) => parseFloat(cost.replace('AED ', '')) * (cost.endsWith('M') ? 1e6 : 1e3)

/** An odor horizon as a solution: its three interventions, what they clear and what they cost. */
function odorSolution(
  horizon: Horizon,
  text: { title: string; summary: string; mapNote: string; costLabel?: string },
  map: Omit<FindingMap, 'title' | 'meta'>,
): SolutionSpec {
  const items = INTERVENTIONS.filter((item) => item.horizon === horizon)
  const byCost = [...items].sort((a, b) => dirhams(a.cost) - dirhams(b.cost))
  const best = Math.max(...items.map((item) => item.reduction))
  const cheapest = byCost[0].cost
  const dearest = byCost[byCost.length - 1].cost
  const { costLabel = 'Cost', ...copy } = text
  return {
    ...copy,
    label: HORIZON_TAB[horizon],
    span: HORIZON_SPAN[horizon],
    color: HORIZON_COLOR[horizon],
    stats: [
      { label: 'Residential units exposed to odor', value: `${UNITS_EXPOSED} → ${UNITS_EXPOSED - UNITS_CLEARED[horizon]}` },
      { label: costLabel, value: items.length > 1 ? `${cheapest}–${dearest.replace('AED ', '')}` : cheapest },
      { label: 'Decline in negative posts about odor', value: `−${ODOR_DECLINE[horizon].posts}%` },
      { label: 'Decline in complaints about odor', value: `−${ODOR_DECLINE[horizon].complaints}%` },
    ],
    chart: {
      type: 'bars',
      title: 'Modelled odor exposure removed, by action',
      value: `${best}%`,
      unit: items.length > 1 ? 'the most any one action removes' : 'of the modelled exposure removed',
      color: HORIZON_COLOR[horizon],
      rows: items.map((item) => ({ label: items.length > 1 ? `${item.code} ${item.action}` : item.action, value: item.reduction, display: `${item.reduction}%` })),
    },
    actions: items.map((item) => ({
      code: items.length > 1 ? item.code : undefined,
      title: item.action,
      subtitle: item.asset,
      detail: item.benefit,
      metrics: [`−${item.reduction}% exposure`, item.cost, `${item.sustainability} sustainability`],
    })),
    map: { ...map, title: `${HORIZON_TAB[horizon]} · ${text.title}`, meta: cleared(horizon) },
  }
}

/** When each planning horizon lands; capital works take longer than the odor fixes. */
const PLANNING_SPAN: Record<Horizon, string> = { immediate: 'next 12 months', intermediate: '1–3 years', long: '3–10 years' }

const HORIZONS: Horizon[] = ['immediate', 'intermediate', 'long']

/** A planning story's three horizons as solutions, each on its own map view of the three areas. */
function planningSolutions(solutions: Record<Horizon, PlanningSolution>, place: (horizon: Horizon) => FindingStageId): SolutionSpec[] {
  return HORIZONS.map((horizon) => {
    const { span, meta, ...solution } = solutions[horizon]
    return {
      ...solution,
      label: HORIZON_TAB[horizon],
      span: span ?? PLANNING_SPAN[horizon],
      color: HORIZON_COLOR[horizon],
      map: {
        place: place(horizon),
        title: `${HORIZON_TAB[horizon]} · ${solution.title}`,
        tag: 'JVC · Arjan · Motor City',
        meta: meta ?? `${solution.actions.length} actions`,
      },
    }
  })
}

const fmt = (value: number) => value.toLocaleString('en-US')

const odorShare = Math.round((ODOR_BRIEFING.inWindow / ODOR_BRIEFING.complaints) * 100)

const roundK = (value: number) => Math.round(value / 1000) * 1000
const [today, twoYears, fiveYears] = FACILITIES_BRIEFING.baseline

const EXPERIENCES: Record<string, (stateId: (place: FindingStageId) => string) => FindingExperience> = {
  odor: (stateId) =>
    experience(
      {
        id: 'finding-odor',
        prompt: 'What is causing the odor around Al Barsha’s parks, and how do we fix it?',
        read: 'Reading 7 days of CRM odor complaints and social posts around Al Barsha’s parks…',
        search: 'Matching complaints to irrigation schedules, the recycled-water network and water samples…',
        reason: 'Weighing nine interventions across three impact horizons, and mapping each one…',
        headline: 'Recycled irrigation water that fails the quality standard is the likely source of the odor in Al Barsha’s parks.',
        headlineDetail: 'Three solutions follow, each with its own map. Open one to see its detail and switch the map.',
        problem: [
          `${ODOR_BRIEFING.complaints} odor complaints in 7 days across Al Barsha’s three parks.`,
          `${ODOR_BRIEFING.inWindow} of them (${odorShare}%) came in the ${ODOR_BRIEFING.window} irrigation window, and complaints track irrigation hours closely.`,
          `Evening winds carry the smell into ${HOMES_EXPOSED} residential units in Al Barsha 2.`,
        ],
        cause: [
          'All three parks are irrigated with recycled water from one supply network, through storage tanks T-1, T-3 and T-5.',
          `Water from ${ODOR_BRIEFING.failing === ODOR_BRIEFING.tanks.length ? 'all' : ODOR_BRIEFING.failing} ${ODOR_BRIEFING.tanks.length} tanks fails the standard. The ${ODOR_BRIEFING.worst.name} is worst, at ${ODOR_BRIEFING.worst.times} the hydrogen sulphide limit.`,
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
            rows: barRows(ODOR_BRIEFING.tanks.map((tank) => [tank.name, tank.h2s, tank.h2s.toFixed(2)])),
          },
          `Hydrogen sulphide at each storage tank outlet, mg/L. The standard allows ${ODOR_BRIEFING.limit}.`,
        ),
        map: { place: 'odor', title: 'Odor plume and exposed residential units · Al Barsha', tag: 'Al Barsha', meta: `${HOMES_EXPOSED} residential units in the plume` },
        solutionsIntro:
          'Open one to see its detail and its map. Start the immediate fixes this week and take the treatment upgrade to capital planning: retiming needs re-tuning each season.',
        solutions: [
          odorSolution(
            'immediate',
            {
              title: 'Retime irrigation',
              summary: `Move Z-2 and Z-3 irrigation out of the ${ODOR_BRIEFING.window} window while the tanks are fixed. Retiming cuts modelled exposure ${INTERVENTIONS[0].reduction}% for ${INTERVENTIONS[0].cost}, the best value of all the options.`,
              mapNote: 'The lower map shows the odor, residential units, posts and complaints left once irrigation is retimed.',
              costLabel: 'Cost of rescheduling the irrigation time only',
            },
            { place: 'odor-immediate', tag: 'Al Barsha' },
          ),
          odorSolution(
            'intermediate',
            {
              title: 'Rehabilitate tank T-3',
              summary: `Clean and repair tank T-3 so its water stops going bad before it reaches Pond Park. This cuts modelled exposure ${INTERVENTIONS[1].reduction}% for ${INTERVENTIONS[1].cost}.`,
              mapNote: 'The lower map shows the odor, residential units, posts and complaints left once T-3 is rehabilitated.',
            },
            { place: 'odor-intermediate', tag: 'Pond Park' },
          ),
          odorSolution(
            'long',
            {
              title: 'Treat, loop and predict',
              summary: 'Polish the recycled water before it reaches Al Barsha so it meets the standard at every tank, loop the dead-end mains so water keeps moving, and forecast odor six hours ahead with 36 sensors.',
              mapNote: 'The lower map shows the odor, residential units, posts and complaints left once all three actions land.',
            },
            { place: 'odor-long', tag: 'Al Barsha' },
          ),
        ],
      },
      stateId,
    ),

  'urban-facilities': (stateId) =>
    experience(
      {
        id: 'finding-facilities',
        prompt: 'Why are families and workers in JVC, Arjan and Motor City short of facilities, and what should we do?',
        read: 'Reading population, tenancy and residency records for JVC, Arjan and Motor City…',
        search: 'Comparing parks, playgrounds, community centres and transport access with what each household group needs…',
        reason: 'Forecasting the baseline at 2 and 5 years, and weighing three options in each impact horizon against it…',
        headline: `Community facilities in JVC, Arjan and Motor City serve ${today.coverage}% of their residents today, falling to ${fiveYears.coverage}% in five years without action.`,
        headlineDetail: 'Three solutions follow, one per impact horizon, each compared on the map with the baseline it is measured against.',
        problem: [
          `The three areas grew from ${fmt(FACILITIES_BRIEFING.population2021)} to ${fmt(FACILITIES_BRIEFING.population)} residents in five years, +${FACILITIES_BRIEFING.growth}%.`,
          `Their facilities serve ${fmt(today.capacity)} residents, ${fmt(roundK(today.gap))} short today, and public parks run at ${FACILITIES_BRIEFING.parkUse}% of capacity at peak.`,
          `With ${fmt(FACILITIES_BRIEFING.pipeline)} residential units committed, the gap reaches ${fmt(roundK(twoYears.gap))} in two years and ${fmt(roundK(fiveYears.gap))} in five, and the average trip to a facility grows from ${today.access} to ${fiveYears.access} minutes.`,
        ],
        cause: [
          `Facilities follow the 2019 community plans, sized for ${FACILITIES_BRIEFING.plannedFor}k residents.`,
          `Most new residents are families with children (${FACILITIES_BRIEFING.familiesJvc}% of JVC households, ${FACILITIES_BRIEFING.familiesMotorCity}% of Motor City) and ${fmt(FACILITIES_BRIEFING.workers)} workers in shared housing.`,
          `Those two groups rely most on local parks, playgrounds, community centres and buses, and ${FACILITIES_BRIEFING.farFromTransport}% of residential units are 800 m or more from a stop.`,
        ],
        chart: chartComponent(
          'finding-facilities-baseline',
          {
            type: 'bars',
            title: 'Residents served without action',
            value: `${today.coverage}%`,
            unit: 'of residents served today',
            color: STATUS.critical,
            rows: FACILITIES_BRIEFING.baseline.map((row) => ({ label: row.label, value: row.coverage, display: `${row.coverage}% · ${fmt(roundK(row.gap))} short` })),
          },
          `Facility capacity for ${fmt(today.capacity)} residents against the forecast population. Each solution is measured against the baseline for its own date.`,
        ),
        map: { place: 'facilities', title: 'Facility shortage · JVC, Arjan and Motor City', tag: 'JVC · Arjan · Motor City', meta: `Parks at ${FACILITIES_BRIEFING.parkUse}% of capacity` },
        solutionsIntro:
          'Each horizon weighs three options and recommends one: optimize scheduling now, repurpose municipal assets next, and construct new facilities for the long term. Recommendations are horizon-specific, so their gains must not be added without checking overlap and dependencies.',
        solutions: planningSolutions(FACILITIES_SOLUTIONS, (horizon) => `facilities-${horizon}`),
      },
      stateId,
    ),

  'urban-infrastructure': (stateId) =>
    experience(
      {
        id: 'finding-infrastructure',
        prompt: 'Why is infrastructure in JVC, Arjan and Motor City falling behind their growth, and what should we do?',
        read: 'Reading sewerage, drainage, power and traffic loads for JVC, Arjan and Motor City…',
        search: 'Tracing each network to its pumping stations, mains, low points and junctions, and modelling the pipeline…',
        reason: 'Weighing nine actions across three impact horizons, and mapping each one…',
        headline: `${INFRASTRUCTURE_BRIEFING.over} of ${INFRASTRUCTURE_BRIEFING.networks} networks in JVC, Arjan and Motor City are past their planning limit, and the pipeline arrives before the upgrades.`,
        headlineDetail: 'Three solutions follow, each with its own map. Open one to see its detail and switch the map.',
        problem: [
          `${INFRASTRUCTURE_BRIEFING.over} of the ${INFRASTRUCTURE_BRIEFING.networks} sewerage, drainage, power and road networks run past the ${INFRASTRUCTURE_BRIEFING.limit}% planning limit; JVC sewerage is at ${INFRASTRUCTURE_BRIEFING.jvcSewer}%.`,
          `${INFRASTRUCTURE_BRIEFING.floodSpots} low points drew ${INFRASTRUCTURE_BRIEFING.floodReports} flooding reports after 38 mm of rain, and peak delays reach ${INFRASTRUCTURE_BRIEFING.worstDelay} minutes at the JVC entrance.`,
          `Sewage flow overtakes treatment capacity from ${INFRASTRUCTURE_BRIEFING.shortfallFrom}, up to ${INFRASTRUCTURE_BRIEFING.peakShortfall} ML/day short.`,
        ],
        cause: [
          `The three areas grew +${INFRASTRUCTURE_BRIEFING.growth}% in five years on networks sized for their original plans.`,
          `A few assets bind: the PS-1 pumping station at ${INFRASTRUCTURE_BRIEFING.ps1}% of its design, the TM-2 trunk sewer, five drainage low points and three access junctions.`,
          `${fmt(INFRASTRUCTURE_BRIEFING.earlyHomes)} of ${fmt(INFRASTRUCTURE_BRIEFING.pipeline)} pipeline residential units complete before the upgrades arrive in ${INFRASTRUCTURE_BRIEFING.upgradesArrive}.`,
        ],
        chart: chartComponent(
          'finding-infrastructure-loads',
          {
            type: 'bars',
            title: 'Most loaded networks',
            value: `${INFRASTRUCTURE_BRIEFING.loads[0].value}%`,
            unit: `${INFRASTRUCTURE_BRIEFING.loads[0].label}, of design`,
            color: STATUS.critical,
            rows: barRows(INFRASTRUCTURE_BRIEFING.loads.map((row) => [row.label, row.value, `${row.value}%`])),
          },
          `Peak load as a share of design capacity. Planning keeps ${100 - INFRASTRUCTURE_BRIEFING.limit}% in reserve.`,
        ),
        map: {
          place: 'infrastructure',
          title: 'Capacity shortfall · JVC, Arjan and Motor City',
          tag: 'JVC · Arjan · Motor City',
          meta: `${fmt(INFRASTRUCTURE_BRIEFING.earlyHomes)} residential units ahead of upgrades`,
        },
        solutionsIntro:
          'Open one to see its detail and its map. Phase approvals to capacity now, and bring the PS-1 upgrade and the second TM-2 main forward in the capital plan.',
        solutions: planningSolutions(INFRASTRUCTURE_SOLUTIONS, (horizon) => `infrastructure-${horizon}`),
      },
      stateId,
    ),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string, stateId: (place: FindingStageId) => string): FindingExperience | null {
  return EXPERIENCES[id]?.(stateId) ?? null
}
