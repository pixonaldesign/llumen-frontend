import type { AssistantReplyPayload, CreatedComponent } from './assistantReplyTypes'
import { DATA_FETCH_THINKING_STEPS } from './thinkingSteps'
import { buildStandardTimeline } from './standardTimeline'
import { llumenAssets } from './assets'

export const DEMO_CREATED_COMPONENTS: CreatedComponent[] = [
  {
    id: 'high-heat-districts',
    label: 'High-Heat Districts',
    type: 'visual',
    title: 'High-Heat Districts',
    semanticId: 'demand.high_heat_districts',
    caption: '7.6B AED · +6.2% vs last quarter',
    description:
      'Quarterly demand trend across high-heat districts, totalling 7.6B AED with a +6.2% lift versus last quarter.',
    analysis:
      'Demand concentrated in the high-heat cohort, with Marina and Downtown carrying most of the quarter’s lift. The +6.2% move is broad-based rather than a single-district spike, so the trend is durable enough to brief as a network-level signal.',
    preview: {
      kind: 'image',
      src: llumenAssets.chartHighHeatDistricts,
      alt: 'High-Heat Districts quarterly trend chart',
    },
  },
  {
    id: 'price-gap-benchmark',
    label: 'Average Price Gap to Benchmark',
    type: 'kpi',
    title: 'Average Price Gap to Benchmark',
    semanticId: 'pricing.avg_gap_to_benchmark',
    caption: '17.8pp gap · −4.1pp vs last quarter',
    description:
      'Average price gap to benchmark at 17.8pp, narrowing by 4.1pp versus last quarter.',
    analysis:
      'The gap to benchmark is still material, but the quarter’s compression suggests promo and list-price actions are closing the spread. Watch the next two weeks of filings — if the slope holds, this becomes a pricing-win narrative rather than a one-off correction.',
    preview: {
      kind: 'image',
      src: llumenAssets.chartPriceGapBenchmark,
      alt: 'Average Price Gap to Benchmark quarterly bar chart',
    },
  },
  {
    id: 'store-traffic-index',
    label: 'Store Traffic Index',
    type: 'visual',
    title: 'Store Traffic Index',
    semanticId: 'traffic.store_index',
    caption: 'Marina corridor · +12% vs prior period',
    description:
      'Weekly footfall index across Marina corridor stores, up 12% versus the prior period.',
    analysis:
      'Footfall strength is clustered along the Marina corridor rather than evenly across the network. That pattern usually precedes same-store sales lift by one to two weeks, so treat this as an early demand signal for staffing and inventory.',
    preview: {
      kind: 'image',
      src: llumenAssets.mapStoreTrafficIndex,
      detailSrc: llumenAssets.mapBirdseyeDetail,
      detailView: 'map',
      alt: 'Store traffic heat map across Marina corridor',
      fit: 'cover',
    },
  },
  {
    id: 'returns-rate',
    label: 'Returns Rate',
    type: 'visual',
    title: 'Returns Rate',
    semanticId: 'ops.returns_rate',
    caption: 'January net returns · −0.3pp MoM',
    description:
      'Net returns as a share of gross sales for January, trending down 0.3pp month over month.',
    analysis:
      'Returns eased slightly month over month, with coastal districts improving fastest. The move is small but directionally helpful for net sales quality — worth pairing with the January revenue read when briefing leadership.',
    preview: {
      kind: 'image',
      src: llumenAssets.mapReturnsRate,
      detailSrc: llumenAssets.mapBirdseyeDetail,
      detailView: 'map',
      alt: 'Returns rate map by coastal district',
      fit: 'cover',
    },
  },
]

export function withCreatedComponents(reply: AssistantReplyPayload): AssistantReplyPayload {
  return {
    ...reply,
    createdComponents: DEMO_CREATED_COMPONENTS,
  }
}

export const COMPONENT_STREAM_SUFFIX =
  ' Select any created component below to open its preview in the panel.'

export const DATA_FETCH_STREAM = `I found several data sources and KPIs you can explore.${COMPONENT_STREAM_SUFFIX}`

export const DATA_FETCH_REPLY: AssistantReplyPayload = withCreatedComponents({
  thinkingSteps: DATA_FETCH_THINKING_STEPS,
  headline: 'Mapped available data sources and generated preview components you can inspect.',
  timeline: buildStandardTimeline(
    'which operational KPIs, sample datasets, and connected sources are available to explore in this workspace',
    'incident KPIs, traffic metrics, semantic models, and saved workspace components',
  ),
})
