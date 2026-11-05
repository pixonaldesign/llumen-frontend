/**
 * Tell Me More for each Briefing finding. A finding on the map opens its place in the ask stage, with every
 * tall tower coloured by its investment potential; the others answer with charts only.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import { ESTATE_ASK_VIEWS, POTENTIAL_RAMP, POTENTIAL_RANKING, type EstateAskView } from '../realEstate/estateScenario'
import { PALETTE } from '../realEstate/estateTypes'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'

export type FindingStageId = BriefingPlaceId

export type FindingMap = { place: FindingStageId; title: string; tag: string; meta: string }

export type FindingExperience = {
  /** What the ask stage shows the user asking, in place of "Tell me more about …". */
  prompt?: string
  reply: AssistantReplyPayload
  /** The finding's own map for the stage; null answers in charts and keeps the map closed. */
  map: FindingMap | null
}

export function isFindingPlace(id: string | undefined): id is FindingStageId {
  return id !== undefined && id in BRIEFING_PLACES
}

/** The map Tell Me More opens for a place: every tall tower coloured by its potential. */
export function findingStage(place: FindingStageId): EstateAskView {
  return ESTATE_ASK_VIEWS[place]
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

const EXPERIENCES: Record<string, () => FindingExperience> = {
  'downtown-towers': () =>
    experience({
      id: 'finding-downtown-towers',
      prompt: 'Which towers in Downtown Dubai have the best investment potential?',
      read: 'Reading this year’s DLD sales and rental contracts for Downtown Dubai’s 12 tallest residential towers…',
      search: 'Scoring each tower on price growth, sell-through and rental yield…',
      reason: 'Colouring every tower on the map by its potential score…',
      headline: 'Dreamscape Tower and Opera Crest Residences have the best potential of Downtown’s 12 tallest towers.',
      headlineDetail: 'Coloured all 12 on the map by potential, from purple for the lowest to light teal for the highest.',
      intro:
        'I scored Downtown’s 12 tallest residential towers out of 100 on three things: how much prices rose in the last year, how fast units are selling, and rental yield. On the map, each tower is coloured by its score, from purple at the low end to light teal at the top.',
      sections: [
        {
          heading: 'On the map',
          text: 'The highest scores sit around the Boulevard and the Opera District, at Dreamscape Tower and Opera Crest. The lowest are on Downtown’s western and southern edges, furthest from the Boulevard.',
        },
        {
          heading: 'Top towers',
          text: 'Dreamscape leads on price growth, up 18% in a year, and on sell-through, with 66% of its units sold. Opera Crest has the highest rental yield, 7.1%. Burj Crown, the tallest of the 12, is third.',
          chart: chartComponent(
            'finding-downtown-potential',
            {
              type: 'bars',
              title: 'Investment potential, top five towers',
              value: '92',
              unit: 'Dreamscape Tower, of 100',
              color: POTENTIAL_RAMP[4],
              rows: barRows(POTENTIAL_RANKING.slice(0, 5).map((tower) => [tower.name, tower.score, String(tower.score)])),
            },
            'Potential score out of 100: price growth, sell-through and rental yield together.',
          ),
        },
        {
          heading: 'Rental yield',
          text: 'Yields follow the same order. All five top towers earn more than Downtown’s average of 5.6%, and Opera Crest earns 1.5 points more.',
          chart: chartComponent(
            'finding-downtown-yield',
            {
              type: 'bars',
              title: 'Gross rental yield',
              value: '7.1%',
              unit: 'Opera Crest Residences',
              color: POTENTIAL_RAMP[3],
              rows: barRows([
                ['Opera Crest Residences', 7.1, '7.1%'],
                ['Dreamscape Tower', 6.8, '6.8%'],
                ['Burj Crown', 6.4, '6.4%'],
                ['Grande Signature', 6.1, '6.1%'],
                ['Burj Royale', 6.0, '6.0%'],
                ['Downtown average', 5.6, '5.6%'],
              ]),
            },
            'Annual rent as a share of the sale price, last 12 months.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Lead investor campaigns with Dreamscape and Opera Crest: they score highest on all three measures. Watch the four towers scoring under 50, where prices have risen less than 6% in a year.',
        },
      ],
      map: {
        place: 'downtown',
        title: 'Downtown towers by investment potential · on the map',
        tag: 'Downtown Dubai',
        meta: '12 towers coloured',
      },
    }),

  transactions: () =>
    experience({
      id: 'finding-transactions',
      read: 'Reading ten years of DLD residential transactions…',
      search: 'Splitting each year’s sales into off-plan and ready homes…',
      reason: 'Finding where the off-plan share grows fastest…',
      headline: 'Off-plan homes are 61% of Dubai’s 169,000 residential sales in 2025, up from 34% in 2020.',
      headlineDetail: 'This trend is city-wide, so it is not on the map: the answer is in the sales mix, year by year.',
      intro:
        'Dubai closed 169,000 residential sales in 2025, nearly five times 2020. Ready homes grew too, but off-plan sales grew more than eightfold, from 12,000 to 103,000, and overtook ready homes in 2025.',
      sections: [
        {
          heading: 'Off-plan share',
          text: 'Off-plan stayed near a third of sales until 2020 and dipped as ready homes rebounded in 2021. It has climbed every year since, to 61% in 2025.',
          chart: chartComponent(
            'finding-transactions-share',
            {
              type: 'trend',
              title: 'Off-plan share of sales',
              value: '61%',
              unit: 'in 2025',
              color: PALETTE.purple[2],
              yLabels: ['70%', '45%', '20%'],
              xLabels: ['2016', '2019', '2022', '2025'],
              line: trendLine([27, 28, 30, 32, 34, 26, 39, 45, 49, 61], 20, 70),
            },
            'Off-plan sales as a share of all residential sales.',
          ),
        },
        {
          heading: 'Where it is selling',
          text: 'Five communities sold more than half of 2025’s off-plan homes. Downtown Dubai is fourth by count but first by value.',
          chart: chartComponent(
            'finding-transactions-areas',
            {
              type: 'bars',
              title: 'Off-plan sales by community, 2025',
              value: '103k',
              unit: 'off-plan sales',
              color: PALETTE.teal[2],
              rows: barRows([
                ['Jumeirah Village Circle', 14.2, '14.2k'],
                ['Business Bay', 11.8, '11.8k'],
                ['Dubai Hills Estate', 9.6, '9.6k'],
                ['Downtown Dubai', 8.4, '8.4k'],
                ['Dubai Creek Harbour', 7.9, '7.9k'],
              ]),
            },
            'Off-plan residential sales by community in 2025.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Track handovers against off-plan launches. 2027 is the heaviest handover year on record, and ready supply then rises faster than buyers have so far.',
        },
      ],
      map: null,
    }),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string): FindingExperience | null {
  return EXPERIENCES[id]?.() ?? null
}
