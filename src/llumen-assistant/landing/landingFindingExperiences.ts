/**
 * Tell Me More for each Briefing finding, and the Briefing AI bar's three answers. A finding on the map
 * opens its place in the ask stage; the AI bar's answers each open their own view of Abu Dhabi Island:
 * the candidate sites against the network, the top site close up, then the evening re-rank. The answers
 * are told slowly, a step at a time, each step bringing its part of the map in.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  RankingRow,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import type { ChatFile } from '../savedConversations'
import {
  EVENING_RANKING,
  RIVAL_COLOR,
  SITE_ONE,
  SITE_RANKING,
  SITE_COLOR,
  STATION_COLOR,
  TOMTOM_ASK_VIEWS,
  TOMTOM_STORIES,
  type TomtomAskStageId,
  type TomtomAskView,
} from '../tomtom/tomtomScenario'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'

/** A Briefing place, or one of the AI bar answers' views. */
export type FindingStageId = BriefingPlaceId | TomtomAskStageId

/** Typed into the Briefing's AI bar on the first keystroke: opens the stage on every candidate site. */
export const TT_ASK_PROMPT = 'I have 12 candidate sites. How do they compare to my current stations?'
/** The list of those 12 sites and of the network's stations, attached as the prompt types in. */
export const TT_ASK_FILES: ChatFile[] = [
  { name: 'candidate-sites-abu-dhabi.xlsx', typeBadge: 'XLSX' },
  { name: 'our-stations-abu-dhabi.csv', typeBadge: 'CSV' },
]
/** Offered once the sites are ranked: zooms into the top site. */
export const TT_DIVE_PROMPT = 'Give me more analysis on site number 1.'
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

type PresentationSpec = {
  id: string
  thinking: [kind: ThinkingStep['kind'], title: string][]
  /** The first response container's line, and the reply's collapsed summary. */
  headline: string
  headlineDetail: string
  blocks: AgentResponseBlock[]
  map: FindingMap
}

/** An answer told slowly, a step at a time, for presenting it live. */
function presentation(spec: PresentationSpec): FindingExperience {
  const steps: ThinkingStep[] = [
    ...spec.thinking.map(([kind, title], index): ThinkingStep => ({ id: `${spec.id}-${index}`, kind, title })),
    { id: `${spec.id}-done`, kind: 'done', title: 'Map annotated' },
  ]
  return {
    map: spec.map,
    reply: {
      headline: spec.headline,
      headlineDetail: spec.headlineDetail,
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: spec.blocks,
      pace: 'presentation',
    },
  }
}

/**
 * The thinking the first answer shows when it plays in the conversation after its container, which
 * already showed the reading and scoring.
 */
export const TT_ASK_CONTINUE_TIMELINE: TimelineStep[] = [
  {
    id: `${TT_ASK_ID}-place`,
    kind: 'reasoning',
    title: 'Placed your 12 sites and 8 stations on the map',
    titleInProgress: 'Placing your 12 sites and 8 stations on the map…',
  },
]

const km = (value: number) => `${value.toFixed(1)} km`
const [FIRST, SECOND] = SITE_RANKING
const ABOVE_70 = SITE_RANKING.filter((site) => site.score > 70)
const EVENING_UP = EVENING_RANKING.slice(0, 5)
const climbers = EVENING_UP.filter((site) => SITE_RANKING.indexOf(site) > EVENING_RANKING.indexOf(site))
const ordinal = (index: number) => ['first', 'second', 'third', 'fourth', 'fifth'][index] ?? `${index + 1}th`

/** How many of the ranking's rows show before View all, and are numbered on the map. */
const TOP = 5

const DAY_ROWS: RankingRow[] = SITE_RANKING.map((site, index) => ({
  rank: index + 1,
  name: site.name,
  detail: site.street,
  score: site.score,
}))

const EVENING_ROWS: RankingRow[] = EVENING_RANKING.map((site, index) => ({
  rank: index + 1,
  name: site.name,
  detail: site.street,
  score: site.evening,
  change: SITE_RANKING.indexOf(site) - index,
}))

/** Prompt 1: every candidate on the island against the network, brought in a layer at a time, then ranked. */
const ttAsk = () =>
  presentation({
    id: TT_ASK_ID,
    thinking: [
      ['reasoning', 'Reading your 12 candidate sites and 8 stations on Abu Dhabi Island…'],
      ['search', 'Pulling TomTom traffic density, drive-time catchments and rival forecourts for each site…'],
      ['reasoning', 'Scoring each site and drawing it on the map against your network…'],
    ],
    headline: `${ABOVE_70.length} of the 12 sites score above 70; ${FIRST.name} on ${FIRST.street} leads at ${FIRST.score}.`,
    headlineDetail:
      'Pinned all 12 sites and your 8 stations, stood a fence on each arterial as tall as its traffic, marked the rival forecourts and drew each site’s 5-minute catchment, then ranked the sites.',
    blocks: [
      { type: 'text', content: 'On the map: your 12 candidate sites and 8 of your stations.', cue: 'pins', holdMs: 2200 },
      { type: 'step', title: 'Now evaluating your next site with data-driven evidence', holdMs: 600 },
      {
        type: 'step',
        title: 'Using historical traffic data',
        detail: 'Powered by 600+ million connected devices worldwide',
        cue: 'fences',
        holdMs: 3200,
      },
      { type: 'step', title: 'Mapping your competitors', detail: 'And their trade areas', cue: 'rivals', holdMs: 2200 },
      {
        type: 'step',
        title: 'Drawing drive-time catchments',
        detail: 'To gauge accessibility',
        cue: 'zones',
        holdMs: 2800,
      },
      {
        type: 'ranking',
        title: 'Your ranking, scored 0 to 100 on turn-ins, catchment, rivals and evening traffic.',
        rows: DAY_ROWS,
        visible: TOP,
        color: SITE_COLOR,
        cue: 'ranks',
      },
    ],
    map: { place: 'tt-ask', title: 'Candidate sites vs your stations', tag: 'Abu Dhabi Island', meta: '12 sites · 8 stations · 24 rivals' },
  })

/** Prompt 2: the top site close up, and the three things that put it first. */
const ttDive = () => {
  const hours = SITE_ONE.hours.inbound.map((value, index) => value + SITE_ONE.hours.outbound[index])
  return presentation({
    id: TT_DIVE_ID,
    thinking: [
      ['search', `Pulling hourly TomTom traffic past ${SITE_ONE.name} in both directions…`],
      ['reasoning', 'Measuring its turn-ins and the distance to its nearest rivals…'],
    ],
    headline: `${SITE_ONE.name} ranks first: evening traffic runs right past it, the nearest rival is ${km(SITE_ONE.rivalKm)} away, and it’s easy to turn in from both directions.`,
    headlineDetail: 'Zoomed into the site with the traffic on the streets around it, its catchment and its four nearest rivals.',
    blocks: [
      {
        type: 'text',
        content: `Zooming in on ${SITE_ONE.name}, number 1 at ${SITE_ONE.score} out of 100. Three things put it first:`,
        cue: 'map',
        holdMs: 2600,
      },
      {
        type: 'highlights',
        items: [
          {
            title: 'Evening traffic flows right past it',
            detail: 'Busiest between 5pm and 7pm, heading out of the centre',
            visual: {
              kind: 'hours',
              values: hours,
              peak: [11, 12, 13],
              color: 'rgba(255, 255, 255, 0.2)',
              peakColor: STATION_COLOR,
              labels: ['6am', '9pm'],
            },
          },
          {
            title: 'A wide catchment',
            detail: `Room to grow: the nearest competitor is ${km(SITE_ONE.rivalKm)} away`,
            visual: { kind: 'distance', color: SITE_COLOR, rivalColor: RIVAL_COLOR, label: km(SITE_ONE.rivalKm) },
          },
          {
            title: 'Easy to turn in',
            detail: 'The site is easy to reach from both directions of traffic',
            visual: { kind: 'turn-in', color: SITE_COLOR },
          },
        ],
      },
      {
        type: 'text',
        content: `Book the site visit for ${SITE_ONE.name} and check the southbound turn-in: it carries 31% of arrivals. Plan for the evening peak with at least 12 pumps.`,
      },
    ],
    map: { place: 'tt-dive', title: `${SITE_ONE.name} site`, tag: SITE_ONE.street, meta: '1 site · 4 rivals · 5 streets' },
  })
}

/** Prompt 3: the sites re-ranked on 5 to 9pm. */
const ttEvening = () =>
  presentation({
    id: TT_EVENING_ID,
    thinking: [
      ['search', 'Filtering TomTom traffic to 5pm – 9pm on weekdays…'],
      ['reasoning', 'Re-scoring each site on evening traffic, catchment and rival opening hours…'],
    ],
    headline: `Counting only 5 to 9pm, ${climbers.map((site) => `${site.name} climbs to ${ordinal(EVENING_RANKING.indexOf(site))}`).join(' and ')}; ${EVENING_RANKING[0].name} stays first at ${EVENING_RANKING[0].evening}.`,
    headlineDetail: 'Re-ranked the sites on evening traffic and raised the traffic fences to 5 to 9pm.',
    blocks: [
      {
        type: 'text',
        content: `Counting only 5pm to 9pm, the routes home gain: ${climbers.map((site) => site.name).join(' and ')} move up, and ${SECOND.name} drops because its Corniche traffic is a daytime trade.`,
        cue: 'map',
        holdMs: 2600,
      },
      {
        type: 'ranking',
        title: 'Your evening ranking, scored 0 to 100 on traffic from 5pm to 9pm.',
        rows: EVENING_ROWS,
        visible: TOP,
        color: SITE_COLOR,
      },
      {
        type: 'text',
        content: `If evening trade matters most, as shop and café sales peak then, visit ${EVENING_RANKING[1].name} ahead of ${SECOND.name}. ${EVENING_RANKING[0].name} stays the first choice either way.`,
      },
    ],
    map: { place: 'tt-evening', title: 'Candidate sites, 5–9pm', tag: 'Abu Dhabi Island', meta: '12 sites re-ranked' },
  })

const EXPERIENCES: Record<string, () => FindingExperience> = {
  [TT_ASK_ID]: ttAsk,
  [TT_DIVE_ID]: ttDive,
  [TT_EVENING_ID]: ttEvening,
  shortlist: () => ({
    ...ttAsk(),
    prompt: 'Which candidate site should we open first?',
    map: { place: 'zahiyah', title: 'Next Site Shortlist', tag: 'Abu Dhabi Island', meta: '12 sites · 8 stations' },
  }),
  'evening-corridor': () => ({
    ...ttEvening(),
    prompt: 'Why does Sheikh Rashid Bin Saeed St matter in the evening?',
    map: { place: 'corridor', title: 'Evening Demand, 5–9pm', tag: 'Sheikh Rashid Bin Saeed St', meta: '3 sites · 5 rivals' },
  }),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one. */
export function findingExperience(id: string): FindingExperience | null {
  return EXPERIENCES[id]?.() ?? null
}
