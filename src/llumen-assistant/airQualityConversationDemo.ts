import type {
  AssistantReplyPayload,
  CreatedComponent,
  ReportPayload,
  ThinkingStep,
  TimelineStep,
} from './assistantReplyTypes'
import { llumenAssets } from './assets'

function timelineFromThinking(steps: ThinkingStep[]): TimelineStep[] {
  return steps
    .filter((s) => s.kind !== 'done')
    .map((s) => ({
      id: s.id,
      kind: s.kind === 'search' ? ('tool' as const) : ('reasoning' as const),
      title: s.title,
      titleInProgress: s.title.endsWith('…') ? s.title : `${s.title}…`,
    }))
}

export const TURN1_THINKING: ThinkingStep[] = [
  {
    id: 't1-intent',
    kind: 'reasoning',
    title:
      'The user is asking what is driving the current deterioration in air quality, where it is concentrated, and which populations may be exposed…',
  },
  {
    id: 't1-search',
    kind: 'search',
    title: 'Searching air-quality monitoring, pollutant, population, and meteorological data sources…',
  },
  {
    id: 't1-analyze',
    kind: 'search',
    title:
      'Found relevant station-level air-quality and geographic components. Analyzing spatial concentrations now…',
  },
  {
    id: 't1-query',
    kind: 'reasoning',
    title: 'Running query across monitoring stations and pollutant thresholds…',
  },
  {
    id: 't1-map',
    kind: 'search',
    title: 'Generating air-quality map…',
  },
  {
    id: 't1-draft',
    kind: 'done',
    title: 'Drafting response with the primary geographic and pollutant findings…',
  },
]

export const TURN2_THINKING: ThinkingStep[] = [
  {
    id: 't2-intent',
    kind: 'reasoning',
    title:
      'The user is asking whether the elevated NO₂ and PM₂.₅ readings are more consistent with traffic or industrial activity…',
  },
  {
    id: 't2-review',
    kind: 'search',
    title: 'Reviewing pollutant composition, monitoring-station locations, land use, and wind direction…',
  },
  {
    id: 't2-found',
    kind: 'search',
    title: 'Found relevant land-use and meteorological components. Comparing likely source patterns…',
  },
  {
    id: 't2-query',
    kind: 'reasoning',
    title: 'Running source-attribution analysis…',
  },
  {
    id: 't2-update',
    kind: 'search',
    title: 'Updating map context and generating supporting components…',
  },
  {
    id: 't2-draft',
    kind: 'done',
    title: 'Drafting an attribution assessment with confidence limitations…',
  },
]

export const TURN3_THINKING: ThinkingStep[] = [
  {
    id: 't3-intent',
    kind: 'reasoning',
    title:
      'The user is requesting a leadership report summarizing the current air-quality deterioration and recommended response…',
  },
  {
    id: 't3-collect',
    kind: 'search',
    title: 'Collecting the established findings, supporting components, and geographic evidence from this conversation…',
  },
  {
    id: 't3-structure',
    kind: 'reasoning',
    title: 'Structuring the findings into an executive report…',
  },
  {
    id: 't3-slides',
    kind: 'search',
    title: 'Generating report slides and visual summaries…',
  },
  {
    id: 't3-validate',
    kind: 'reasoning',
    title: 'Validating figures and source references…',
  },
  {
    id: 't3-done',
    kind: 'done',
    title: 'Finalizing the report for leadership review…',
  },
]

export const AIR_QUALITY_COMPONENTS: CreatedComponent[] = [
  {
    id: 'air-quality-monitoring-map',
    label: 'Abu Dhabi AQI',
    type: 'visual',
    title: 'Abu Dhabi AQI',
    semanticId: 'aq.monitoring_map',
    inlineSize: 'full',
    aiGenerated: true,
    caption:
      'Three monitoring locations are currently reporting elevated conditions, with the highest readings concentrated around the Mussafah–ICAD corridor.',
    description:
      'Three monitoring locations are currently reporting elevated conditions, with the highest readings concentrated around the Mussafah–ICAD corridor.',
    analysis:
      'The map indicates that the strongest deterioration is occurring around industrial and high-traffic zones. Nearby residential areas are not currently reporting the same pollutant intensity, but shifting wind conditions may increase their exposure if the elevation persists.',
    preview: {
      kind: 'image',
      src: llumenAssets.mapAbuDhabiAqi,
      detailSrc: llumenAssets.mapAbuDhabiAqi,
      detailView: 'map',
      alt: 'Abu Dhabi air quality monitoring map',
      fit: 'cover',
    },
  },
  {
    id: 'air-quality-index',
    label: 'Air Quality Index',
    type: 'kpi',
    title: 'Air Quality Index',
    semanticId: 'aq.aqi',
    inlineSize: 'full',
    aiGenerated: true,
    caption:
      'Current conditions may affect sensitive populations, particularly where elevated readings overlap with residential areas.',
    description: 'AQI 121 — Unhealthy for Sensitive Groups',
    analysis:
      'The overall Air Quality Index has reached 121, placing current conditions in the Unhealthy for Sensitive Groups category.',
    preview: { kind: 'widget', variant: 'aqi' },
  },
  {
    id: 'pollutant-readings',
    label: 'Pollutant Readings',
    type: 'kpi',
    title: 'Pollutant Readings',
    semanticId: 'aq.pollutants',
    inlineSize: 'full',
    caption: 'The deterioration is concentrated in NO₂ and PM₂.₅ rather than across the full pollutant profile.',
    description: 'NO₂ and PM₂.₅ critical; remaining pollutants normal.',
    analysis:
      'The pollutant profile shows that the increase is primarily being driven by NO₂ at 430 µg/m³ and PM₂.₅ at 70 µg/m³. Both are currently classified as critical, while the remaining monitored pollutants remain normal.',
    preview: { kind: 'widget', variant: 'pollutants' },
  },
  {
    id: 'population-exposure',
    label: 'Population Exposure',
    type: 'kpi',
    title: 'Population Exposure',
    semanticId: 'aq.population',
    inlineSize: 'full',
    caption: 'Approximately 800,000 residents belong to youth or senior groups.',
    description: 'Sensitive age cohorts: 800,000',
    analysis:
      'Based on the available population data, approximately 800,000 residents belong to the youth or senior population groups. These groups should receive priority if elevated conditions begin moving toward residential districts.',
    preview: { kind: 'widget', variant: 'population' },
  },
  {
    id: 'land-use-distribution',
    label: 'Land-use Distribution',
    type: 'kpi',
    title: 'Land-use Distribution',
    semanticId: 'aq.land_use',
    inlineSize: 'full',
    caption:
      'The elevated monitoring locations sit within an area where industrial activity and transport infrastructure are both significant potential sources.',
    description: 'Industrial and transport land use near elevated stations.',
    analysis:
      'NO₂ is commonly associated with combustion activity, including road traffic and industrial operations. PM₂.₅ can also originate from both sources, as well as construction activity or pollution transported from another location.',
    preview: { kind: 'widget', variant: 'land-use' },
  },
  {
    id: 'wind-direction',
    label: 'Wind Direction',
    type: 'kpi',
    title: 'Wind Speed/Direction',
    semanticId: 'aq.wind',
    inlineSize: 'full',
    caption:
      'The current wind pattern aligns the elevated stations with the industrial corridor, increasing the likelihood of an industrial contribution.',
    description: 'Wind aligned with industrial corridor.',
    analysis:
      'The wind data provides the clearest next filter for source attribution.',
    preview: { kind: 'widget', variant: 'wind' },
  },
]

export const AIR_QUALITY_REPORT: ReportPayload = {
  id: 'ead-air-quality-executive-assessment',
  title: 'Air Quality Deterioration — Executive Assessment',
  subtitle: 'Current conditions, likely drivers, population exposure, and recommended actions',
  slideCount: 6,
  badge: 'AI Generated',
  meta: [
    '6 slides',
    'Generated from this conversation',
    'Air-quality data, pollutant readings, population exposure, land use, and wind context',
    'Updated just now',
  ],
  slides: [
    {
      id: 'slide-1',
      title: 'Executive summary',
      body: [
        'AQI has reached 121.',
        'Conditions are unhealthy for sensitive groups.',
        'Three monitoring locations are reporting elevated readings.',
        'NO₂ and PM₂.₅ are the primary pollutant drivers.',
      ],
    },
    {
      id: 'slide-2',
      title: 'Geographic concentration',
      body: [],
      visualComponentId: 'air-quality-monitoring-map',
      finding:
        'Elevated readings are concentrated around the Mussafah–ICAD corridor rather than distributed uniformly across the region.',
    },
    {
      id: 'slide-3',
      title: 'Pollutant drivers',
      body: ['NO₂: 430 µg/m³ — Critical', 'PM₂.₅: 70 µg/m³ — Critical', 'Remaining monitored pollutants: Normal'],
      visualComponentId: 'pollutant-readings',
    },
    {
      id: 'slide-4',
      title: 'Likely source assessment',
      body: [],
      visualComponentId: 'land-use-distribution',
      finding:
        'The current pattern is most consistent with an industrial contribution, potentially amplified by traffic activity.',
      confidenceLabel: 'Source attribution confidence: Moderate',
    },
    {
      id: 'slide-5',
      title: 'Population exposure',
      body: [
        'Total monitored population: 2.5 million',
        'Youth: 675,000',
        'Seniors: 125,000',
        'Sensitive age cohorts: 800,000',
      ],
      visualComponentId: 'population-exposure',
    },
    {
      id: 'slide-6',
      title: 'Recommended actions',
      body: [
        'Validate readings across adjacent sensors.',
        'Review hourly trends and persistence.',
        'Correlate elevated periods with industrial activity.',
        'Compare readings with traffic and construction patterns.',
        'Monitor downwind residential areas.',
        'Prepare targeted public guidance if conditions persist.',
      ],
    },
  ],
}

const componentCatalog = AIR_QUALITY_COMPONENTS

export const TURN1_REPLY: AssistantReplyPayload = {
  confirmation: 'Understood',
  headline: 'Investigating air-quality deterioration drivers, concentration, and exposure.',
  thinkingSteps: TURN1_THINKING,
  timeline: timelineFromThinking(TURN1_THINKING),
  createdComponents: componentCatalog,
  blocks: [
    {
      type: 'heading',
      content: 'Geographic concentration',
    },
    {
      type: 'text',
      content:
        'Air-quality deterioration is concentrated around a limited number of monitoring locations rather than appearing consistently across the entire region.',
    },
    {
      type: 'visual',
      componentId: 'air-quality-monitoring-map',
      visualType: 'map',
      title: 'Abu Dhabi AQI',
      caption:
        'Three monitoring locations are currently reporting elevated conditions, with the highest readings concentrated around the Mussafah–ICAD corridor.',
      displayMode: 'inline',
      openSubcontext: true,
    },
    {
      type: 'text',
      content:
        'The map indicates that the strongest deterioration is occurring around industrial and high-traffic zones. Nearby residential areas are not currently reporting the same pollutant intensity, but shifting wind conditions may increase their exposure if the elevation persists.',
    },
    {
      type: 'heading',
      content: 'Current conditions',
    },
    {
      type: 'text',
      content:
        'The overall Air Quality Index has reached 121, placing current conditions in the Unhealthy for Sensitive Groups category.',
    },
    {
      type: 'visual',
      componentId: 'air-quality-index',
      visualType: 'kpi',
      title: 'Air Quality Index',
      caption:
        'Current conditions may affect sensitive populations, particularly where elevated readings overlap with residential areas.',
      displayMode: 'inline',
    },
    {
      type: 'heading',
      content: 'Pollutant drivers',
    },
    {
      type: 'text',
      content:
        'The pollutant profile shows that the increase is primarily being driven by NO₂ at 430 µg/m³ and PM₂.₅ at 70 µg/m³. Both are currently classified as critical, while the remaining monitored pollutants remain normal.',
    },
    {
      type: 'visual',
      componentId: 'pollutant-readings',
      visualType: 'kpi',
      title: 'Pollutant Readings',
      caption: 'The deterioration is concentrated in NO₂ and PM₂.₅ rather than across the full pollutant profile.',
      displayMode: 'inline',
    },
    {
      type: 'heading',
      content: 'Population exposure',
    },
    {
      type: 'text',
      content:
        'Based on the available population data, approximately 800,000 residents belong to the youth or senior population groups. These groups should receive priority if elevated conditions begin moving toward residential districts.',
    },
    {
      type: 'visual',
      componentId: 'population-exposure',
      visualType: 'kpi',
      title: 'Population Exposure',
      caption: 'Approximately 800,000 residents belong to youth or senior groups.',
      displayMode: 'inline',
    },
  ],
}

export const TURN2_REPLY: AssistantReplyPayload = {
  headline: 'Comparing traffic versus industrial source patterns for elevated NO₂ and PM₂.₅.',
  thinkingSteps: TURN2_THINKING,
  timeline: timelineFromThinking(TURN2_THINKING),
  createdComponents: componentCatalog,
  blocks: [
    {
      type: 'heading',
      content: 'Source assessment',
    },
    {
      type: 'text',
      content:
        'The available evidence currently points more strongly toward an industrial or mixed industrial-traffic source, although the data is not yet sufficient for definitive attribution.',
    },
    {
      type: 'heading',
      content: 'Geographic pattern',
    },
    {
      type: 'text',
      content:
        'The strongest clue is the geographic concentration. The critical readings are clustered around locations where industrial activity and major road corridors overlap.',
    },
    {
      type: 'visual',
      componentId: 'air-quality-monitoring-map',
      visualType: 'map',
      title: 'Abu Dhabi AQI',
      caption: 'Stations contributing to the conclusion, with nearby industrial areas and major roads highlighted.',
      displayMode: 'inline',
      openSubcontext: true,
    },
    {
      type: 'visual',
      componentId: 'land-use-distribution',
      visualType: 'kpi',
      title: 'Land-use Distribution',
      caption:
        'The elevated monitoring locations sit within an area where industrial activity and transport infrastructure are both significant potential sources.',
      displayMode: 'inline',
    },
    {
      type: 'heading',
      content: 'Supporting indicators',
    },
    {
      type: 'text',
      content:
        'NO₂ is commonly associated with combustion activity, including road traffic and industrial operations. PM₂.₅ can also originate from both sources, as well as construction activity or pollution transported from another location.',
    },
    {
      type: 'text',
      content: 'The wind data provides the clearest next filter.',
    },
    {
      type: 'visual',
      componentId: 'wind-direction',
      visualType: 'kpi',
      title: 'Wind Speed/Direction',
      caption:
        'The current wind pattern aligns the elevated stations with the industrial corridor, increasing the likelihood of an industrial contribution.',
      displayMode: 'inline',
    },
    {
      type: 'heading',
      content: 'Interpretation',
    },
    {
      type: 'text',
      content:
        'The strongest current interpretation is: industrial activity is likely the primary contributor, with traffic potentially amplifying the NO₂ concentration around major road corridors. Confidence should remain moderate until hourly station readings are compared against facility activity, traffic volume, and construction schedules.',
    },
  ],
}

export const TURN3_REPLY: AssistantReplyPayload = {
  headline: 'Generating a leadership report from the established air-quality findings.',
  thinkingSteps: TURN3_THINKING,
  timeline: timelineFromThinking(TURN3_THINKING),
  createdComponents: componentCatalog,
  reports: [AIR_QUALITY_REPORT],
  blocks: [
    {
      type: 'heading',
      content: 'Leadership report',
    },
    {
      type: 'text',
      content:
        'I generated a leadership report summarizing the current air-quality deterioration, the likely source pattern, the populations potentially exposed, and the recommended response.',
    },
    {
      type: 'report',
      reportId: 'ead-air-quality-executive-assessment',
      title: 'Air Quality Deterioration — Executive Assessment',
      subtitle: 'Current conditions, likely drivers, population exposure, and recommended actions',
      slideCount: 6,
      badge: 'AI Generated',
      openSubcontext: true,
      subcontextView: 'slides',
    },
  ],
}

export type ConversationTurn = 1 | 2 | 3

export function detectConversationTurn(userText: string, priorAssistantCount: number): ConversationTurn {
  const lower = userText.toLowerCase()
  if (
    lower.includes('report') ||
    lower.includes('leadership') ||
    (lower.includes('generate') && (lower.includes('report') || lower.includes('brief') || lower.includes('slide')))
  ) {
    return 3
  }
  if (
    lower.includes('traffic') ||
    lower.includes('industrial') ||
    lower.includes('source') ||
    lower.includes('attribution') ||
    lower.includes('pollution')
  ) {
    return 2
  }
  if (priorAssistantCount === 0) return 1
  if (priorAssistantCount === 1) return 2
  return 3
}

export function replyForTurn(turn: ConversationTurn): AssistantReplyPayload {
  if (turn === 2) return TURN2_REPLY
  if (turn === 3) return TURN3_REPLY
  return TURN1_REPLY
}

export function findComponent(componentId: string): CreatedComponent | undefined {
  return AIR_QUALITY_COMPONENTS.find((c) => c.id === componentId)
}

export function findReport(reportId: string): ReportPayload | undefined {
  if (reportId === AIR_QUALITY_REPORT.id) return AIR_QUALITY_REPORT
  return undefined
}
