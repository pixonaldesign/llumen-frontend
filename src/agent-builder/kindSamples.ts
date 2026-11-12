import { conditionGroup, newCondition } from './conditions'
import type { AnyParams, KindId, KindParamsMap } from './nodeKinds'

/** Example settings for the showcase and test flows; a node added from the palette starts from `KIND_DEFAULTS` instead. */
export const KIND_SAMPLES: { readonly [K in KindId]?: Partial<KindParamsMap[K]> } = {
  chatInput: { testMessage: 'Which sites need an inspection this week?' },
  webhook: { testBody: '{\n  "site": "Mussafah M-14",\n  "reading": 142\n}' },
  filter: { where: conditionGroup({ id: 'c_risk', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.7' }) },
  ifElse: { when: conditionGroup({ id: 'c_anomalies', field: 'anomalies', operator: 'number__greater_than', value: '10' }) },
  switchCases: {
    cases: [
      { id: 'case1', label: 'Case 1', when: conditionGroup({ id: 'c_case1', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.8' }) },
      { id: 'case2', label: 'Case 2', when: conditionGroup(newCondition('c_case2')) },
    ],
  },
  editFields: { assignments: [{ id: 'a_status', name: 'status', type: 'text', value: 'flagged' }] },
  aggregate: { groupBy: ['district'], metrics: [{ id: 'm_sum', fn: 'sum', field: 'anomalies', as: 'total_anomalies' }] },
  stopAndError: { stopMessage: 'Workflow halted.' },
  generalAgent: { instructions: 'Review the flagged sites and explain which ones need a field inspection this week, and why.' },
  dataClassificationAgent: {
    categories: [
      { id: 'industrial', name: 'Industrial', example: 'Mussafah, ICAD, port yards' },
      { id: 'residential', name: 'Residential', example: 'Mafraq, Shahama' },
    ],
  },
  insightGenerator: { instructions: 'Summarise the three biggest changes since last month.', fields: ['headline', 'evidence', 'recommended_action'] },
  dataAnalyst: { instructions: 'Find outliers against the 12-month baseline per district.' },
  gisCorrelationAgent: { instructions: 'Correlate contamination hotspots with industrial land use.' },
  createApp: { instructions: 'Build an app on this month’s contamination hotspots.' },
  sendEmail: { to: 'ops@llumen.ai', subject: 'Daily anomaly brief', body: 'Today’s run flagged {{rows.count}} items.' },
  sendApiRequest: { url: 'https://api.example.com/alerts', body: '{"site": "{{site}}"}' },
}

/** A showcase or test-flow node's params: the kind's example under whatever the flow sets itself. */
export const withSample = (typeId: string, params?: Partial<AnyParams>) => ({ ...KIND_SAMPLES[typeId as KindId], ...params }) as Partial<AnyParams>
