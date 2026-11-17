import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  ThinkingStep,
  WorkflowProposal,
} from './assistantReplyTypes'
import { AIR_QUALITY_COMPONENTS } from './airQualityConversationDemo'
import {
  ENERGY_WORKFLOW_USER_TEXT,
  energyWorkflowReply,
  isEnergyWorkflowExample,
  workflowChangeReply,
} from './energyWorkflowDemo'
import type { BriefingAsset } from './landing/briefingAssetData'
import type { FirstResponseKind } from './slashCommands'

/**
 * What a prompt sent from the AI bar answers with first: a container over the bar that opens into the full
 * conversation (`reply`) from its expand button.
 */
export type FirstResponse = {
  id: string
  kind: FirstResponseKind
  /** The request as the user sent it; the full conversation opens with it. */
  prompt: string
  /** The answer in a line, at the top of the container. Unused by the workflow container. */
  headline: string
  /** The text container's answer, or the caption under an asset. */
  text: string
  chatTitle: string
  reply: AssistantReplyPayload
  /** The chart, KPI or map the asset containers show. */
  component?: CreatedComponent
  /** The KPI container's card, drawn like the Briefing's KPI assets. */
  asset?: BriefingAsset
  proposal?: WorkflowProposal
}

/** What each demo answers when the slash command is sent without a prompt of its own. */
export const FIRST_RESPONSE_PROMPTS: Record<FirstResponseKind, string> = {
  workflow: ENERGY_WORKFLOW_USER_TEXT,
  text: 'Why is air quality worse in Mussafah this week?',
  chart: 'Compare AQI across the monitoring stations this week',
  kpi: "What's the air quality index right now?",
  map: 'Where are the air-quality hotspots in Abu Dhabi?',
}

/** The second prompt each demo types into the AI bar once the first is sent; sending it opens the full conversation. */
export const FOLLOW_UP_PROMPTS: Record<FirstResponseKind, string> = {
  workflow: 'Run it every Monday at 8 am',
  text: 'Compare AQI across the monitoring stations this week',
  chart: 'Why is Mussafah reading so high?',
  kpi: 'Which stations are driving it?',
  map: 'Why are these schools the most exposed?',
}

/** What a follow-up answers with when it doesn't ask for something else: never the first answer's own kind. */
const FOLLOW_UP_KINDS: Record<Exclude<FirstResponseKind, 'workflow'>, FirstResponseKind> = {
  text: 'chart',
  chart: 'text',
  kpi: 'chart',
  map: 'text',
}

/** The full conversation's answer to a second prompt, sent while the first answer is still in its container. */
export function followUpReply(first: FirstResponse, prompt: string): AssistantReplyPayload {
  if (first.kind === 'workflow') return workflowChangeReply(prompt, first.proposal)
  const fallback = FOLLOW_UP_KINDS[first.kind]
  const asked = prompt === FOLLOW_UP_PROMPTS[first.kind] ? fallback : firstResponseKind(prompt)
  const kind = asked === first.kind || asked === 'map' || asked === 'workflow' ? fallback : asked
  return firstResponseFor(kind, prompt).reply
}

/** Which container a typed prompt answers with. */
export function firstResponseKind(prompt: string): FirstResponseKind {
  const text = prompt.toLowerCase()
  if (
    isEnergyWorkflowExample(prompt) ||
    /\b(workflow|automate|automation|schedule|notify|remind|alert me|email|every (day|week|month|morning|monday))\b/.test(
      text,
    )
  )
    return 'workflow'
  if (/\b(map|where|located|location|districts?|hotspots?|schools?)\b/.test(text)) return 'map'
  if (
    /\b(chart|trend|compare|comparison|over time|history|breakdown|rank|ranking|by (month|week|day|station))\b/.test(
      text,
    )
  )
    return 'chart'
  if (/\b(kpi|how many|how much|total|count|rate|index|score|level|percentage|average)\b/.test(text)) return 'kpi'
  return 'text'
}

function reply(
  id: string,
  headline: string,
  steps: string[],
  blocks: AgentResponseBlock[],
  createdComponents: CreatedComponent[] = [],
): AssistantReplyPayload {
  const thinkingSteps: ThinkingStep[] = [
    ...steps.map((title, index): ThinkingStep => ({
      id: `${id}-${index}`,
      kind: index === 1 ? 'search' : 'reasoning',
      title,
    })),
    { id: `${id}-done`, kind: 'done', title: 'Done' },
  ]
  return {
    headline,
    thinkingSteps,
    timeline: steps.map((title, index) => ({
      id: `${id}-${index}`,
      kind: index === 1 ? ('tool' as const) : ('reasoning' as const),
      title,
      titleInProgress: `${title}…`,
    })),
    blocks,
    createdComponents,
  }
}

function visual(component: CreatedComponent, visualType: 'chart' | 'kpi' | 'map'): AgentResponseBlock {
  return {
    type: 'visual',
    componentId: component.id,
    visualType,
    title: component.title,
    caption: component.caption ?? component.description,
    displayMode: 'inline',
    openSubcontext: visualType === 'map' ? true : undefined,
  }
}

function catalog(id: string) {
  const component = AIR_QUALITY_COMPONENTS.find((item) => item.id === id)
  if (!component) throw new Error(`Missing air quality component ${id}`)
  return component
}

const STATION_ROWS: [label: string, aqi: number][] = [
  ['Mussafah', 121],
  ['ICAD', 112],
  ['Khalifa City', 86],
  ['Al Maqtaa', 74],
  ['Corniche', 58],
]

const STATION_CHART: CreatedComponent = {
  id: 'first-response-aqi-by-station',
  label: 'AQI by station',
  type: 'visual',
  title: 'AQI by monitoring station, this week',
  description: 'Mussafah and ICAD sit above the sensitive-groups line of 100; the coastal stations stay moderate.',
  caption: 'Mussafah and ICAD sit above the sensitive-groups line of 100; the coastal stations stay moderate.',
  inlineSize: 'full',
  preview: {
    kind: 'story-chart',
    chart: {
      type: 'bars',
      title: 'AQI by monitoring station, this week',
      value: '121',
      unit: 'peak AQI, Mussafah',
      color: '#ffb547',
      rows: STATION_ROWS.map(([label, aqi]) => ({ label, value: (aqi / 121) * 100, display: String(aqi) })),
    },
  },
}

const AQI_ASSET: BriefingAsset = {
  id: 'first-response-aqi',
  kind: 'kpi',
  visualTypeId: 'kpi-card',
  size: 'small',
  category: 'Environment',
  title: 'Air Quality Index',
  accent: '#ffb547',
  value: 121,
  caption: 'Unhealthy for sensitive groups, peaking along the Mussafah–ICAD corridor',
  spark: [88, 92, 97, 104, 101, 110, 116, 121],
}

const TEXT_ANSWER =
  'NO₂ and PM₂.₅ climbed around the Mussafah industrial corridor this week while the wind carried emissions along it, pushing the AQI to 121, unhealthy for sensitive groups. Nearby residential areas are not reading the same levels yet, but a wind shift would bring them in.'

/** The container and the conversation behind it for `kind`, answering `prompt`. */
export function firstResponseFor(kind: FirstResponseKind, prompt = FIRST_RESPONSE_PROMPTS[kind]): FirstResponse {
  const id = `first-response-${kind}-${Date.now()}`
  switch (kind) {
    case 'workflow': {
      const workflowReply = energyWorkflowReply()
      const block = workflowReply.blocks?.find((item) => item.type === 'workflow')
      const proposal = block?.type === 'workflow' ? block.proposal : undefined
      return {
        id,
        kind,
        prompt,
        headline: proposal?.title ?? 'Workflow',
        text: proposal?.summary ?? '',
        chatTitle: proposal?.title ?? 'Workflow',
        reply: workflowReply,
        proposal,
      }
    }
    case 'text':
      return {
        id,
        kind,
        prompt,
        headline: 'Why air quality is worse in Mussafah',
        text: TEXT_ANSWER,
        chatTitle: 'Air quality in Mussafah',
        reply: reply(
          'fr-text',
          'Explaining this week’s air-quality change around Mussafah.',
          ['Reading this week’s station readings', 'Checking wind and land-use data', 'Weighing the likely sources'],
          [
            { type: 'heading', content: 'What changed' },
            { type: 'text', content: TEXT_ANSWER },
            { type: 'heading', content: 'Why' },
            {
              type: 'text',
              content:
                'The critical readings cluster where industrial activity and major road corridors overlap, and the wind lines the elevated stations up with the industrial corridor. That points to an industrial contribution, with traffic amplifying NO₂ along the main roads.',
            },
            { type: 'heading', content: 'What to watch' },
            {
              type: 'text',
              content:
                'Compare hourly station readings with facility activity and traffic volume, and keep an eye on the downwind residential districts if the wind turns.',
            },
          ],
        ),
      }
    case 'chart':
      return {
        id,
        kind,
        prompt,
        headline: 'Mussafah reads the highest AQI this week',
        text: STATION_CHART.caption ?? '',
        chatTitle: 'AQI by monitoring station',
        component: STATION_CHART,
        reply: reply(
          'fr-chart',
          'Comparing AQI across the monitoring stations this week.',
          ['Reading the station network', 'Pulling this week’s AQI by station', 'Ranking the stations'],
          [
            {
              type: 'text',
              content:
                'Mussafah reads the highest AQI this week at 121, with ICAD close behind at 112. Both are above 100, the line where conditions become unhealthy for sensitive groups.',
            },
            visual(STATION_CHART, 'chart'),
            {
              type: 'text',
              content:
                'The coastal stations stay moderate, which keeps the problem concentrated on the industrial corridor rather than across the city.',
            },
          ],
          [STATION_CHART],
        ),
      }
    case 'kpi': {
      const component = catalog('air-quality-index')
      return {
        id,
        kind,
        prompt,
        headline: 'Air quality is unhealthy for sensitive groups',
        text: component.caption ?? component.description,
        chatTitle: 'Air Quality Index',
        component,
        asset: AQI_ASSET,
        reply: reply(
          'fr-kpi',
          'Checking the current Air Quality Index.',
          ['Reading the latest station readings', 'Calculating the city-wide index'],
          [
            { type: 'text', content: component.analysis ?? component.description },
            visual(component, 'kpi'),
            { type: 'text', content: component.caption ?? '' },
          ],
          AIR_QUALITY_COMPONENTS,
        ),
      }
    }
    case 'map': {
      const component = catalog('air-quality-monitoring-map')
      return {
        id,
        kind,
        prompt,
        headline: 'Hotspots sit along the Mussafah–ICAD corridor',
        text: 'The strongest readings sit around the industrial and high-traffic zones; residential areas nearby read lower for now.',
        chatTitle: 'Abu Dhabi air-quality hotspots',
        component,
        reply: reply(
          'fr-map',
          'Mapping the air-quality hotspots across Abu Dhabi.',
          ['Reading the monitoring stations', 'Placing the readings on the map'],
          [
            {
              type: 'text',
              content:
                'Air-quality deterioration is concentrated around a few monitoring locations rather than across the whole region.',
            },
            visual(component, 'map'),
            {
              type: 'text',
              content:
                'The strongest deterioration is around industrial and high-traffic zones. Nearby residential areas are not reporting the same intensity, but shifting wind could raise their exposure.',
            },
          ],
          AIR_QUALITY_COMPONENTS,
        ),
      }
    }
  }
}
