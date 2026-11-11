/** Demo assistant replies for the Story AI prompts. */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import type { StoryAiSnapshot } from './storyAiScenarios'
import { EMISSIONS_LINE, GROUNDWATER_LINE, warpPath } from './StoryCharts'
import {
  CHART_PERIOD_LABEL,
  PERIOD_LOAD_X,
  PERIOD_VOLUME_LEGEND,
  PERIOD_VOLUME_X,
  periodScene,
  type ChatComponent,
} from './storyChartPeriod'
import type { StoryScene } from './storyDemoScenes'
import {
  compactAed,
  compactCount,
  MARKERS_PERIOD,
  TOP_SCHOOLS_COUNT,
  TOP_SCHOOLS_PERIOD,
  type StoryMapAnnotation,
} from './storyAnnotations'

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

/** Adds a map-state thumbnail right after the reply's opening paragraph; clicking it restores this view. */
export function withMapState(
  reply: AssistantReplyPayload,
  state: { stateId: string; snapshot: StoryAiSnapshot; title: string; tag: string; meta: string },
): AssistantReplyPayload {
  const component: CreatedComponent = {
    id: state.stateId,
    label: state.title,
    type: 'visual',
    title: state.title,
    description: 'Map view after this prompt',
    inlineSize: 'full',
    preview: { kind: 'story-map-state', stateId: state.stateId, snapshot: state.snapshot, tag: state.tag, meta: state.meta },
  }
  const block: AgentResponseBlock = {
    type: 'visual',
    componentId: component.id,
    visualType: 'map',
    title: component.title,
    caption: component.description,
    displayMode: 'inline',
  }
  const blocks = reply.blocks ?? []
  const firstText = blocks.findIndex((item) => item.type === 'text')
  const at = firstText === -1 ? blocks.length : firstText + 1
  return {
    ...reply,
    createdComponents: [component, ...(reply.createdComponents ?? [])],
    blocks: [...blocks.slice(0, at), block, ...blocks.slice(at)],
  }
}

function list(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? 'the selected components'
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** The attached chart cards re-scoped to 2024–2025; the map is left as is. */
export function periodReply(components: ChatComponent[], scene: StoryScene): AssistantReplyPayload {
  const labels = components.map((item) => item.label)
  const now = scene.insight
  const past = periodScene(scene).insight
  const steps: ThinkingStep[] = [
    {
      id: 'period-intent',
      kind: 'reasoning',
      title: `The user attached ${list(labels)} and wants the data from 2024 to 2025, without changing the map…`,
    },
    {
      id: 'period-query',
      kind: 'search',
      title: 'Querying junction counts and load history, Jan 2024 – Dec 2025…',
    },
    {
      id: 'period-rebuild',
      kind: 'search',
      title: `Re-plotting ${list(labels)} for ${CHART_PERIOD_LABEL}…`,
    },
    { id: 'period-done', kind: 'done', title: 'Charts updated' },
  ]

  const createdComponents: CreatedComponent[] = []
  const blocks: AgentResponseBlock[] = [
    {
      type: 'text',
      content: `I re-plotted ${list(labels)} for ${CHART_PERIOD_LABEL}. The ${
        components.length === 1 ? 'chart' : 'charts'
      } in the story panel now show the same period; the map and its filters are unchanged.`,
    },
  ]
  const add = (heading: string, text: string, component: CreatedComponent) => {
    createdComponents.push(component)
    blocks.push({ type: 'heading', content: heading }, { type: 'text', content: text }, visual(component))
  }

  for (const { id, label } of components) {
    if (id === 'emissions') {
      add(
        'Traffic volume',
        'Volume climbed through 2024 and peaked in Q3 2025, 11% above the 2024 pattern. The gap opened in spring and held through the summer freight season.',
        chartComponent(
          'story-period-volume',
          {
            type: 'trend',
            title: label,
            value: '9.4k',
            unit: 'veh/h peak',
            legend: PERIOD_VOLUME_LEGEND,
            yLabels: past.emissionsLabels,
            xLabels: PERIOD_VOLUME_X,
            fromLine: warpPath(EMISSIONS_LINE, now.emissionsWarp),
            line: warpPath(EMISSIONS_LINE, past.emissionsWarp),
            color: '#7dcea0',
            dashed: true,
          },
          '2025 ran above the 2024 pattern from March onward.',
        ),
      )
    } else if (id === 'groundwater') {
      add(
        'Junction load',
        `Average junction load ran at ${past.groundwaterValue}% across ${CHART_PERIOD_LABEL}, ${
          past.groundwaterValue - now.groundwaterValue
        } points above today's ${now.groundwaterValue}%. Load eased after the Q3 2025 signal retiming.`,
        chartComponent(
          'story-period-load',
          {
            type: 'trend',
            title: label,
            value: `${past.groundwaterValue}`,
            unit: '% average',
            yLabels: ['100', '50', '0'],
            xLabels: PERIOD_LOAD_X,
            fromLine: warpPath(GROUNDWATER_LINE, now.groundwaterWarp),
            line: warpPath(GROUNDWATER_LINE, past.groundwaterWarp),
            color: '#ee7b93',
          },
          'Quarterly average load, Q1 2024 – Q4 2025.',
        ),
      )
    } else if (id === 'biodiversity') {
      add(
        'Junction status',
        `${past.marine} junctions were congested in ${CHART_PERIOD_LABEL}, ${past.marine - now.marine} more than today. Most of them sit on the freight corridors that were widened in late 2025.`,
        chartComponent(
          'story-period-status',
          {
            type: 'status',
            title: label,
            terrestrial: past.terrestrial,
            marine: past.marine,
            from: { terrestrial: now.terrestrial, marine: now.marine },
          },
          `Junction status, current period vs ${CHART_PERIOD_LABEL}.`,
        ),
      )
    } else {
      add(
        'Live junction data',
        `${past.online} of ${past.sites} junctions reported over ${CHART_PERIOD_LABEL} (${past.uptime}% coverage). Coverage has improved since the sensor upgrade in 2025.`,
        chartComponent(
          'story-period-sites',
          {
            type: 'sites',
            title: label,
            online: past.online,
            sites: past.sites,
            uptime: past.uptime,
            offlineBars: past.offlineBars,
            from: { online: now.online, uptime: now.uptime, offlineBars: now.offlineBars },
          },
          `Reporting junctions, current period vs ${CHART_PERIOD_LABEL}.`,
        ),
      )
    }
  }

  return {
    headline: `Updated ${list(labels)} to ${CHART_PERIOD_LABEL}.`,
    headlineDetail: 'Only the selected charts changed; the map is unchanged.',
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents,
    blocks,
  }
}

/** WHO 2021 24-hour PM2.5 guideline, µg/m³. */
const PM25_GUIDELINE = 15

/** Picked area: the schools most exposed to the area's factory emissions, walled in on the map. */
function emissionsSchoolsReply(annotation: StoryMapAnnotation, location: string): AssistantReplyPayload {
  const { schools, areas, action } = annotation
  const count = schools.length
  const steps: ThinkingStep[] = [
    {
      id: 'schools-intent',
      kind: 'reasoning',
      title: `The user wants the schools in ${location} most affected by its factory emissions over ${TOP_SCHOOLS_PERIOD}, annotated on the map…`,
    },
    {
      id: 'schools-location',
      kind: 'reasoning',
      title: `Limiting the columns to the ${location} outline from the location context…`,
    },
    {
      id: 'schools-query',
      kind: 'search',
      title: `Matching schools in ${location} with PM2.5 readings and their distance to the nearest factory, last 2 months…`,
    },
    {
      id: 'schools-areas',
      kind: 'reasoning',
      title: `Walling in ${location} along its streets and pinning the ${count} most exposed schools…`,
    },
    {
      id: 'schools-action',
      kind: 'reasoning',
      title: 'Drafting an emergency response and pinning it over the area…',
    },
    { id: 'schools-done', kind: 'done', title: 'Map annotated' },
  ]

  if (count === 0) {
    return {
      headline: `No schools found in ${location}.`,
      headlineDetail: 'Walled in the area on the map; it has no monitored school columns.',
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: [
        {
          type: 'text',
          content: `I walled in ${location} on the map, but none of the monitored school columns fall inside it. Try a larger area, or pick a district from the location search.`,
        },
      ],
    }
  }

  const top = schools[0]
  const ranking = chartComponent(
    'story-top-schools',
    {
      type: 'bars',
      title: `Schools most exposed to factory emissions in ${location}`,
      value: String(top.pm25),
      unit: 'µg/m³ PM2.5 at #1',
      color: annotation.color,
      rows: schools.map((school) => ({
        label: `${school.rank}. ${school.name}`,
        value: (school.pm25 / top.pm25) * 100,
        display: `${school.pm25}`,
      })),
    },
    `Average PM2.5 at each school in ${location}, last 2 months.`,
  )
  const average = Math.round(schools.reduce((sum, school) => sum + school.change, 0) / count)
  const rising = [...schools].sort((a, b) => b.change - a.change)[0]
  const nearFactory = schools.filter((school) => school.factoryKm <= 1).length
  const area = areas[0]

  return {
    headline: `Annotated the ${count} schools most exposed to factory emissions in ${location}.`,
    headlineDetail: `Walled in ${location} along its streets, kept the ${count} most exposed schools' columns, added a tooltip to each and pinned a recommended action.`,
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [ranking],
    blocks: [
      {
        type: 'text',
        content: `I ranked the schools in ${location} by their exposure to factory emissions — average PM2.5 over ${TOP_SCHOOLS_PERIOD} and distance to the nearest factory — and annotated the ${count} most affected on the map. Only their columns are left standing, marked red, and each has a numbered pin — hover one to see the school's details.`,
      },
      { type: 'heading', content: 'Most exposed' },
      {
        type: 'text',
        content: `${top.name} is the most exposed: ${top.pm25} µg/m³ of PM2.5 on average, ${top.factoryKm} km from the nearest factory — about ${Math.round(top.pm25 / PM25_GUIDELINE)}× the WHO 24-hour guideline of ${PM25_GUIDELINE} µg/m³. Exposure at the ${count} schools rose ${average}% compared with the 2 months before.`,
      },
      visual(ranking),
      { type: 'heading', content: 'The area' },
      {
        type: 'text',
        content: `${location} is walled in on the map along its streets: ${area.junctions} monitored ${area.junctions === 1 ? 'junction' : 'junctions'} sit inside it, and ${nearFactory} of the ${count} schools are within 1 km of a factory.`,
      },
      ...(action
        ? [
            { type: 'heading' as const, content: 'Recommended action' },
            {
              type: 'text' as const,
              content: `${action.text}. Peak stack emissions then fall after the school day (07:30 AM – 02:30 PM) instead of during it, protecting ${compactCount(action.affected)} of the ${compactCount(action.total)} students — those at schools within 1 km of a factory — and saving an estimated ${compactAed(action.saved)} in health and absence costs. Where a shift change isn't feasible, cutting those factories' working hours by 4 hours on high-PM2.5 days gets roughly two-thirds of the benefit. It's pinned over the area on the map.`,
            },
          ]
        : []),
      { type: 'heading', content: 'Insights' },
      {
        type: 'text',
        content: `${rising.name} saw the sharpest rise (+${rising.change}%). Air-quality alerts for these ${count} schools, indoor breaks on high-PM2.5 days and stack-emission checks at the closest factories would cut their exposure the most.`,
      },
    ],
  }
}

/** Approach 3 marker scenario: schools and their busiest junctions, each marked on the map. */
export function schoolMarkersReply(annotation: StoryMapAnnotation): AssistantReplyPayload {
  const { schools, junctions } = annotation
  const count = schools.length
  const steps: ThinkingStep[] = [
    {
      id: 'markers-intent',
      kind: 'reasoning',
      title: `The user wants the ${TOP_SCHOOLS_COUNT} schools with the busiest junctions around them in ${MARKERS_PERIOD}, with the schools and those junctions marked on the map…`,
    },
    {
      id: 'markers-query',
      kind: 'search',
      title: `Matching schools to monitored junctions within 800 m and ranking them by peak-hour traffic, ${MARKERS_PERIOD}…`,
    },
    {
      id: 'markers-anchor',
      kind: 'reasoning',
      title: 'Picking up to 3 of the busiest junctions per school and anchoring a marker to each school and junction…',
    },
    {
      id: 'markers-context',
      kind: 'reasoning',
      title: `Recording each marker's data context — Traffic volume, ${MARKERS_PERIOD} — so it can be re-checked when filters change…`,
    },
    { id: 'markers-done', kind: 'done', title: 'Map annotated' },
  ]

  if (count === 0) {
    return {
      headline: 'No schools with monitored junctions nearby.',
      headlineDetail: 'None of the school columns have a monitored junction within 800 m on this slide.',
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: [{ type: 'text', content: 'Try another slide, or widen the distance around each school.' }],
    }
  }

  const busiestAt = (rank: number) =>
    junctions.filter((junction) => junction.school === rank).reduce((max, junction) => Math.max(max, junction.peak), 0)
  const ranking = chartComponent(
    'story-top-schools',
    {
      type: 'bars',
      title: `Top ${count} schools by their busiest nearby junction`,
      value: busiestAt(schools[0].rank).toLocaleString('en-US'),
      unit: 'veh/h peak at #1',
      color: annotation.color,
      rows: schools.map((school) => ({
        label: `${school.rank}. ${school.name}`,
        value: (busiestAt(school.rank) / Math.max(1, busiestAt(schools[0].rank))) * 100,
        display: busiestAt(school.rank).toLocaleString('en-US'),
      })),
    },
    `Peak-hour vehicles at the busiest monitored junction within 800 m of each school, ${MARKERS_PERIOD}.`,
  )
  const top = schools[0]
  const topJunction = [...junctions.filter((junction) => junction.school === top.rank)].sort((a, b) => b.peak - a.peak)[0]
  const over = junctions.filter((junction) => junction.load > 100)
  const worst = [...junctions].sort((a, b) => b.load - a.load).slice(0, 2)

  return {
    headline: `Marked ${count} schools and the ${junctions.length} busy junctions around them on the map.`,
    headlineDetail: 'Anchored a marker to each school and to its busiest junctions within 800 m, with a tooltip on each.',
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [ranking],
    blocks: [
      {
        type: 'text',
        content: `I marked the ${count} schools with the busiest junctions within 800 m in ${MARKERS_PERIOD}, and the ${junctions.length} junctions behind it — amber pins for the schools, red markers for the junctions. Hover any marker for its details; hovering a school lights up its junctions.`,
      },
      { type: 'heading', content: 'Busiest surroundings' },
      {
        type: 'text',
        content: topJunction
          ? `${top.name} in ${top.district} tops the list: ${topJunction.id} at ${topJunction.name}, ${topJunction.distanceM} m away, carries ${topJunction.peak.toLocaleString('en-US')} vehicles an hour at peak and runs at ${topJunction.load}% of capacity. ${over.length} of the ${junctions.length} marked junctions go over capacity at peak.`
          : `${top.name} in ${top.district} tops the list.`,
      },
      visual(ranking),
      { type: 'heading', content: 'How the markers stay accurate' },
      {
        type: 'text',
        content: `Each marker is anchored to its school or junction, not to a spot on the screen, so it stays put as you pan, zoom, rotate or tilt the map. Each one also records the data it was made from — Traffic volume, ${MARKERS_PERIOD} — and is Valid right now. If a later filter drops a school or junction from the data, its marker is flagged as no longer applying instead of silently staying on the map.`,
      },
      { type: 'heading', content: 'Insights' },
      {
        type: 'text',
        content: `Staggered drop-off times and signal priority at ${worst.map((junction) => `${junction.id} (${junction.load}%)`).join(' and ')} would relieve the most school traffic at once.`,
      },
    ],
  }
}

/** The top 10 schools annotated on the map (highlighted columns, areas, tooltips). */
export function topSchoolsReply(annotation: StoryMapAnnotation): AssistantReplyPayload {
  if (annotation.metric === 'emissions' && annotation.location) {
    return emissionsSchoolsReply(annotation, annotation.location)
  }
  const { schools, areas, location } = annotation
  const count = schools.length
  const scope = location ? ` in ${location}` : ''
  const steps: ThinkingStep[] = [
    {
      id: 'schools-intent',
      kind: 'reasoning',
      title: `The user wants the ${TOP_SCHOOLS_COUNT} schools with the most traffic around them${scope} over ${TOP_SCHOOLS_PERIOD}, annotated on the map…`,
    },
    ...(location
      ? [
          {
            id: 'schools-location',
            kind: 'reasoning' as const,
            title: `Limiting the columns to the ${location} outline from the location context…`,
          },
        ]
      : []),
    {
      id: 'schools-query',
      kind: 'search',
      title: `Ranking schools${scope} by peak-hour traffic within 500 m, last 2 months…`,
    },
    {
      id: 'schools-areas',
      kind: 'reasoning',
      title: location
        ? `Outlining ${location} and pinning the ${count} columns inside it…`
        : `Grouping the ${TOP_SCHOOLS_COUNT} columns by distance and outlining the areas they cover…`,
    },
    { id: 'schools-done', kind: 'done', title: 'Map annotated' },
  ]

  if (count === 0) {
    return {
      headline: `No schools found${scope}.`,
      headlineDetail: 'Outlined the area on the map; it has no monitored columns.',
      thinkingSteps: steps,
      timeline: timeline(steps),
      blocks: [
        {
          type: 'text',
          content: `I outlined ${location ?? 'the area'} on the map, but none of the monitored school columns fall inside it. Try a larger area, or pick a district from the location search.`,
        },
      ],
    }
  }

  const top = schools[0]
  const ranking = chartComponent(
    'story-top-schools',
    {
      type: 'bars',
      title: `Top ${count} schools${scope} by nearby traffic`,
      value: top.peak.toLocaleString('en-US'),
      unit: 'veh/h peak at #1',
      color: annotation.color,
      rows: schools.map((school) => ({
        label: `${school.rank}. ${school.name}`,
        value: (school.peak / top.peak) * 100,
        display: school.peak.toLocaleString('en-US'),
      })),
    },
    `Peak-hour vehicles within 500 m of each school${scope}, last 2 months.`,
  )
  const areaText = areas
    .map((area) => `${area.label} (${area.junctions} monitored ${area.junctions === 1 ? 'junction' : 'junctions'})`)
    .join('; ')
  const average = Math.round(schools.reduce((sum, school) => sum + school.change, 0) / count)
  const rising = [...schools].sort((a, b) => b.change - a.change)[0]
  const area = areas[0]

  return {
    headline: `Annotated the top ${count} schools${scope} on the map.`,
    headlineDetail: location
      ? `Outlined ${location}, highlighted the ${count} columns inside it and added a tooltip to each school.`
      : `Highlighted their columns, outlined ${areas.length} ${areas.length === 1 ? 'area' : 'areas'} and added a tooltip to each school.`,
    thinkingSteps: steps,
    timeline: timeline(steps),
    createdComponents: [ranking],
    blocks: [
      {
        type: 'text',
        content: `I ranked schools${scope} by peak-hour traffic within 500 m over ${TOP_SCHOOLS_PERIOD} and annotated the top ${count} on the map. ${
          location
            ? 'Only their columns are left standing, marked red as the most congested'
            : 'Their columns are now highlighted, the rest of the map is dimmed'
        }, and each column has a numbered pin — hover one to see the school's details.`,
      },
      { type: 'heading', content: 'Ranking' },
      {
        type: 'text',
        content: `${top.name} in ${top.district} leads with ${top.peak.toLocaleString('en-US')} vehicles an hour at peak. Traffic around the ${count} schools rose ${average}% on average compared with the 2 months before.`,
      },
      visual(ranking),
      { type: 'heading', content: location ? 'The area' : 'Where they cluster' },
      {
        type: 'text',
        content: location
          ? `${location} is walled in on the map along its streets: ${area.junctions} monitored ${area.junctions === 1 ? 'junction' : 'junctions'} sit inside it, and the disks outside it are faded.`
          : `The ${count} schools fall into ${areas.length} ${areas.length === 1 ? 'area' : 'areas'}, outlined on the map: ${areaText}.`,
      },
      { type: 'heading', content: 'Insights' },
      {
        type: 'text',
        content: `${rising.name} saw the sharpest rise (+${rising.change}%). Staggered drop-off times and signal priority at the junctions inside the ${area.district} area would relieve the most schools at once.`,
      },
    ],
  }
}
