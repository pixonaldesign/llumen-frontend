import { conditionGroup, groupField, groupIssue, partsText, newCondition, type Combinator, type ConditionGroup, type Operator } from './conditions'
import { DEFAULT_CREATE_ASSET, createAssetFields, createAssetIssue, type CreateAssetSettings } from './createAsset'
import { ASSETS_BY_ID, ML_MODELS_BY_ID, SOURCES_BY_ID, measureLimit, type SourceMode } from './flowData'
import type { FieldPart, NodeField, NodePort } from './nodeCatalog'

/*
 * Each node kind's own configuration: the keys the builder writes, what the card shows, and what
 * keeps the node from running. The run behaviour lives in `nodeRuntime.ts`.
 */

/* ---------- Triggers ---------- */

export type ScheduleUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

export type ScheduleParams = {
  /** 1–10,000; seconds are not a unit the scheduler accepts. */
  every: number
  unit: ScheduleUnit
  atHour: number
  atMinute: number
  /** 0 is Sunday; used when the unit is weeks. */
  weekday: number
  /** 1–28, so February never skips a run; used when the unit is months. */
  monthDay: number
  timezone: string
}

export type ChatInputParams = {
  /** Builder-only: the message Test Chat sends. */
  testMessage: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type WebhookAuth = 'none' | 'basic' | 'api_key' | 'bearer' | 'oauth2'

export type WebhookParams = {
  method: HttpMethod
  authMode: WebhookAuth
  oauth2Issuer: string
  oauth2Audience: string
  oauth2JwksUri: string
  oauth2RequiredClaims: string
  /** Builder-only: the JSON body Send Test Webhook posts. */
  testBody: string
}

/* ---------- Data ---------- */

export type AssetParams = { assetId?: string }

export type SourceParams = {
  mode: SourceMode
  sourceId?: string
  /** Database mode. */
  query: string
  /** API request mode: an endpoint of the source, plus a query string. */
  endpointId?: string
  queryString: string
  /** File mode. */
  sheet?: string
  /** ETL Flow mode. */
  datasetId?: string
  /** Marketplace mode. */
  operationId?: string
  operationParams: Readonly<Record<string, string>>
}

export type MlModelParams = {
  modelId?: string
  /** Model feature to input column; unmapped features read the column of the same name. */
  featureMapping: Readonly<Record<string, string>>
  rowSource?: string
}

export type ForecastGrain = 'hour' | 'day' | 'week' | 'month'
export type ForecastRefusal = 'fail' | 'pass_through_empty' | 'shorten_to_supported'

export type ForecastParams = {
  timeColumn?: string
  targetColumn?: string
  /** Absent rather than empty when there is one series. */
  seriesIdColumns?: readonly string[]
  grain: ForecastGrain
  horizon: number
  onRefuse: ForecastRefusal
}

/* ---------- Transforms ---------- */

export type FilterParams = { where: ConditionGroup }
export type IfElseParams = { when: ConditionGroup }

export type SwitchCase = { id: string; label: string; when: ConditionGroup }
export type SwitchParams = {
  cases: readonly SwitchCase[]
  /** First match sends a row down one case; all matching sends it down every case it matches. */
  sendToAllMatching: boolean
}

export type FieldType = 'text' | 'number' | 'boolean'
export type Assignment = { id: string; name: string; type: FieldType; value: string }
export type EditFieldsParams = {
  assignments: readonly Assignment[]
  /** Keep every incoming column, or only the ones set here. */
  keepOthers: boolean
  remove: readonly string[]
}

export type AggregateFn = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max'
export type Metric = { id: string; fn: AggregateFn; field: string; as: string }
export type AggregateParams = { groupBy: readonly string[]; metrics: readonly Metric[] }

export type MergeParams = { dedupe: boolean }

export type WaitUnit = 'seconds' | 'minutes' | 'hours' | 'days'
export type WaitParams = { waitFor: number; waitUnit: WaitUnit }

export type StopParams = { stopMessage: string }

/* ---------- Agents ---------- */

export type InstructionsParams = { instructions: string }

export type Category = { id: string; name: string; example: string }
export type ClassificationParams = InstructionsParams & { categories: readonly Category[] }

export type InsightType = 'summary' | 'trend' | 'anomaly' | 'recommendation'
export type InsightParams = InstructionsParams & { fields: readonly string[]; insightType: InsightType }

export type UpperLayerKind = 'events' | 'values' | 'wind'
export type BottomLayerKind = 'land_type' | 'land_measure' | 'values'
export type GisParams = InstructionsParams & {
  /** The land layer: a whole-output reference to an Asset node upstream. */
  bottomRef?: string
  upper: { kind: UpperLayerKind; value_field?: string; speed_field?: string; direction_field?: string }
  bottom: { kind: BottomLayerKind; class_field?: string; value_field?: string }
}

export type AlertMeasure = 'any_row' | 'every_row' | 'row_count' | 'sum' | 'avg' | 'min' | 'max'
export type DataAlertCondition = { id: string; type: 'data'; sourceNodeId?: string; field: string; measure: AlertMeasure; operator: Operator; value: string }
export type EventAlertCondition = { id: string; type: 'forecast_event'; withinHours: number; event: string }
export type AlertCondition = DataAlertCondition | EventAlertCondition
export type AlertLevel = 'critical_alert' | 'alert'
export type AlertRule = { id: string; label: string; level: AlertLevel; combinator: Combinator; conditions: readonly AlertCondition[] }

export type AiFindingsParams = {
  /** Up to 1,000 characters; read by the findings agent, never at run time. */
  instructions: string
  alerts: { enabled: boolean; criteria: string; rules: readonly AlertRule[] }
}

/* ---------- Actions ---------- */

export type ChatMessageParams = {
  mode: 'send_message' | 'send_and_wait'
  responseType: 'free_text' | 'approval'
  message: string
  approveLabel: string
  rejectLabel: string
}

export type EmailParams = { to: string; cc: string; bcc: string; subject: string; body: string }

export type Header = { id: string; key: string; value: string }
export type ApiRequestParams = {
  mode: 'direct' | 'source'
  method: HttpMethod
  url: string
  headers: readonly Header[]
  body: string
  sourceId?: string
}

/* ---------- Registry ---------- */

type Empty = Record<string, never>

export type KindParamsMap = {
  manualTrigger: Empty
  scheduleTrigger: ScheduleParams
  chatInput: ChatInputParams
  webhook: WebhookParams
  asset: AssetParams
  source: SourceParams
  mlModel: MlModelParams
  forecast: ForecastParams
  createAsset: CreateAssetSettings
  noOperation: Empty
  filter: FilterParams
  ifElse: IfElseParams
  switchCases: SwitchParams
  editFields: EditFieldsParams
  aggregate: AggregateParams
  merge: MergeParams
  wait: WaitParams
  stopAndError: StopParams
  generalAgent: InstructionsParams
  dataClassificationAgent: ClassificationParams
  insightGenerator: InsightParams
  dataAnalyst: InstructionsParams
  gisCorrelationAgent: GisParams
  slidesAgent: InstructionsParams
  dashboardAgent: InstructionsParams
  briefingAgent: InstructionsParams
  aiFindings: AiFindingsParams
  sendChatMessage: ChatMessageParams
  sendEmail: EmailParams
  sendApiRequest: ApiRequestParams
  stickyNote: Empty
}

export type KindId = keyof KindParamsMap
export type AnyParams = KindParamsMap[KindId]

let idCounter = 0
/** Ids for list items (conditions, cases, headers); unique within a session. */
export const uid = (prefix: string) => `${prefix}_${(idCounter += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const KIND_DEFAULTS: { readonly [K in KindId]: KindParamsMap[K] } = {
  manualTrigger: {},
  scheduleTrigger: { every: 1, unit: 'days', atHour: 8, atMinute: 0, weekday: 1, monthDay: 1, timezone: 'Asia/Dubai' },
  chatInput: { testMessage: 'Which sites need an inspection this week?' },
  webhook: {
    method: 'POST',
    authMode: 'none',
    oauth2Issuer: '',
    oauth2Audience: '',
    oauth2JwksUri: '',
    oauth2RequiredClaims: '',
    testBody: '{\n  "site": "Mussafah M-14",\n  "reading": 142\n}',
  },
  asset: {},
  source: { mode: 'query', query: '', queryString: '', operationParams: {} },
  mlModel: { featureMapping: {} },
  forecast: { grain: 'day', horizon: 7, onRefuse: 'fail' },
  createAsset: DEFAULT_CREATE_ASSET,
  noOperation: {},
  filter: { where: conditionGroup({ id: 'c_risk', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.7' }) },
  ifElse: { when: conditionGroup({ id: 'c_anomalies', field: 'anomalies', operator: 'number__greater_than', value: '10' }) },
  switchCases: {
    cases: [
      { id: 'case1', label: 'Case 1', when: conditionGroup({ id: 'c_case1', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.8' }) },
      { id: 'case2', label: 'Case 2', when: conditionGroup(newCondition('c_case2')) },
    ],
    sendToAllMatching: false,
  },
  editFields: { assignments: [{ id: 'a_status', name: 'status', type: 'text', value: 'flagged' }], keepOthers: true, remove: [] },
  aggregate: { groupBy: ['district'], metrics: [{ id: 'm_sum', fn: 'sum', field: 'anomalies', as: 'total_anomalies' }] },
  merge: { dedupe: false },
  wait: { waitFor: 5, waitUnit: 'minutes' },
  stopAndError: { stopMessage: 'Workflow halted.' },
  generalAgent: { instructions: 'Review the flagged sites and explain which ones need a field inspection this week, and why.' },
  dataClassificationAgent: {
    instructions: '',
    categories: [
      { id: 'industrial', name: 'Industrial', example: 'Mussafah, ICAD, port yards' },
      { id: 'residential', name: 'Residential', example: 'Mafraq, Shahama' },
    ],
  },
  insightGenerator: {
    instructions: 'Summarise the three biggest changes since last month.',
    fields: ['headline', 'evidence', 'recommended_action'],
    insightType: 'summary',
  },
  dataAnalyst: { instructions: 'Find outliers against the 12-month baseline per district.' },
  gisCorrelationAgent: {
    instructions: 'Correlate contamination hotspots with industrial land use.',
    upper: { kind: 'events' },
    bottom: { kind: 'land_type' },
  },
  slidesAgent: { instructions: 'Build an executive brief on this month’s contamination hotspots.' },
  dashboardAgent: { instructions: 'Lay out the hotspot KPIs and trend charts for the operations team.' },
  briefingAgent: { instructions: 'Write a one-page briefing for the director on sites that need action.' },
  aiFindings: { instructions: '', alerts: { enabled: false, criteria: '', rules: [] } },
  sendChatMessage: { mode: 'send_message', responseType: 'free_text', message: '', approveLabel: 'Approve', rejectLabel: 'Reject' },
  sendEmail: { to: 'ops@llumen.ai', cc: '', bcc: '', subject: 'Daily anomaly brief', body: 'Today’s run flagged {{rows.count}} items.' },
  sendApiRequest: { mode: 'direct', method: 'POST', url: 'https://api.example.com/alerts', headers: [], body: '{"site": "{{site}}"}' },
  stickyNote: {},
}

const isKind = (typeId: string): typeId is KindId => typeId in KIND_DEFAULTS

/** A node's parameters with the kind's defaults filled in. */
export function paramsFor<K extends KindId>(typeId: K, stored: unknown): KindParamsMap[K] {
  return { ...KIND_DEFAULTS[typeId], ...(stored as Partial<KindParamsMap[K]> | undefined) }
}

/* ---------- Templates ---------- */

/** `{{alias.field}}` reads an earlier step; `{{field}}` reads the first incoming row; `{{rows.count}}` counts them. */
export const TEMPLATE_TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'step'

/* ---------- Schedule wording ---------- */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const UNIT_WORD: Record<ScheduleUnit, string> = { minutes: 'minute', hours: 'hour', days: 'day', weeks: 'week', months: 'month' }

export const clockTime = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

/** What the compiled schedule reads as, e.g. "Every day at 08:00". */
export function scheduleCadence(params: ScheduleParams) {
  const word = UNIT_WORD[params.unit]
  const every = params.every === 1 ? `Every ${word}` : `Every ${params.every} ${word}s`
  const at = clockTime(params.atHour, params.atMinute)
  switch (params.unit) {
    case 'minutes':
      return every
    case 'hours':
      return `${every} at :${String(params.atMinute).padStart(2, '0')}`
    case 'weeks':
      return `${every} on ${WEEKDAYS[params.weekday]} at ${at}`
    case 'months':
      return `${every} on day ${params.monthDay} at ${at}`
    default:
      return `${every} at ${at}`
  }
}

export const scheduleSummary = (params: ScheduleParams) => `${scheduleCadence(params)} · ${params.timezone}`

/* ---------- Card rows, summaries, issues ---------- */

const AUTH_LABEL: Record<WebhookAuth, string> = { none: 'None', basic: 'Basic auth', api_key: 'API key', bearer: 'Bearer token', oauth2: 'OAuth 2.0' }
export const WEBHOOK_AUTH_LABEL = AUTH_LABEL

export const WAIT_UNIT_WORD: Record<WaitUnit, string> = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day' }
export const waitText = (params: WaitParams) => `${params.waitFor} ${WAIT_UNIT_WORD[params.waitUnit]}${params.waitFor === 1 ? '' : 's'}`

export const GRAIN_LABEL: Record<ForecastGrain, string> = { hour: 'Hour', day: 'Day', week: 'Week', month: 'Month' }
export const REFUSAL_LABEL: Record<ForecastRefusal, string> = {
  fail: 'Fail the step',
  pass_through_empty: 'Skip refused series',
  shorten_to_supported: 'Shorten to what the history supports',
}

export const FN_LABEL: Record<AggregateFn, string> = {
  count: 'Count',
  count_distinct: 'Count distinct',
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
}

/** How a metric reads on the card, before "of <column>". */
const METRIC_PHRASE: Record<AggregateFn, string> = {
  count: 'count',
  count_distinct: 'distinct count',
  sum: 'sum',
  avg: 'average',
  min: 'min',
  max: 'max',
}

const truncate = (text: string, length = 64) => (text.length > length ? `${text.slice(0, length - 1)}…` : text)
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Names after FROM or JOIN, without schema or quotes; `EXTRACT(x FROM col)` also matches, so callers check them. */
function queryTables(query: string) {
  const names = [...query.matchAll(/\b(?:from|join)\s+([\w."]+)/gi)].map((match) => match[1].replace(/"/g, '').split('.').pop() ?? '')
  return [...new Set(names.filter(Boolean))]
}

function sourceSummary(params: SourceParams): NodeField[] {
  const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
  if (!source) return []
  const rows: NodeField[] = [{ label: 'Source', value: source.name }]
  switch (params.mode) {
    case 'query': {
      if (!params.query.trim()) break
      const tables = queryTables(params.query).filter((name) => !source.tables || name in source.tables)
      rows.push(tables.length ? { label: 'Reads', value: tables.join(', ') } : { label: 'Query', value: truncate(oneLine(params.query)) })
      break
    }
    case 'api_request': {
      const endpoint = source.endpoints?.find((item) => item.id === params.endpointId)
      if (endpoint) rows.push({ label: 'Request', value: `${endpoint.method} ${endpoint.path}` })
      break
    }
    case 'file':
      if (params.sheet) rows.push({ label: 'Sheet', value: params.sheet })
      break
    case 'dataflow': {
      const dataset = source.datasets?.find((item) => item.id === params.datasetId)
      if (dataset) rows.push({ label: 'Dataset', value: dataset.name })
      break
    }
    case 'marketplace': {
      const operation = source.operations?.find((item) => item.id === params.operationId)
      if (operation) rows.push({ label: 'Operation', value: operation.label })
      break
    }
  }
  return rows
}

function sourceIssue(params: SourceParams) {
  const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
  if (!source) return 'Select a source'
  if (source.mode !== params.mode) return 'Select a source for this mode'
  switch (params.mode) {
    case 'query':
      return params.query.trim() ? undefined : 'Write the query to run'
    case 'api_request':
      return params.endpointId ? undefined : 'Choose the request to send'
    case 'file':
      return params.sheet ? undefined : 'Choose a sheet'
    case 'dataflow':
      return params.datasetId ? undefined : 'Choose a dataset'
    default:
      return params.operationId ? undefined : 'Choose an operation'
  }
}

function webhookIssue(params: WebhookParams) {
  if (params.authMode !== 'oauth2') return undefined
  if (!/^https?:\/\//.test(params.oauth2Issuer.trim())) return 'Enter the OAuth issuer URL'
  if (!params.oauth2Audience.trim()) return 'Enter the OAuth audience'
  return undefined
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const emailList = (text: string) =>
  text
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

/** Rejects non-http(s) schemes and private, loopback, and link-local hosts, like the worker's guard. */
export function urlIssue(url: string): string | undefined {
  if (!url.trim()) return 'Enter the URL to call'
  if (url.includes('{{')) return undefined
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'Enter a full URL, starting with https://'
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Only http and https URLs can be called'
  const host = parsed.hostname.toLowerCase()
  const privateHost =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^\[f[cd]/.test(host)
  return privateHost ? 'Requests to private or local addresses are blocked' : undefined
}

export const bodyAllowed = (method: HttpMethod) => method !== 'GET'

function apiIssue(params: ApiRequestParams) {
  if (params.mode === 'source') return params.sourceId ? undefined : 'Select the API connection'
  const url = urlIssue(params.url)
  if (url) return url
  const keys = params.headers.map((header) => header.key.trim().toLowerCase()).filter(Boolean)
  if (new Set(keys).size !== keys.length) return 'Header names must be unique'
  if (params.body.trim() && !bodyAllowed(params.method)) return `A ${params.method} request can’t carry a body`
  if (new Blob([params.body]).size > 1_048_576) return 'The body is over the 1 MiB limit'
  return undefined
}

function categoriesIssue(params: ClassificationParams) {
  if (!params.instructions.trim()) return 'Enter instructions for the classifier'
  if (!params.categories.length) return 'Add a category'
  const names = params.categories.map((category) => category.name.trim().toLowerCase())
  if (names.some((name) => !name)) return 'Name every category'
  if (new Set(names).size !== names.length) return 'Category names must be unique'
  if (names.some((name) => name === 'default' || name === '_unclassified')) return '“default” and “_unclassified” are reserved'
  return undefined
}

function insightIssue(params: InsightParams) {
  if (!params.instructions.trim()) return 'Enter instructions for the insight'
  const fields = params.fields.map((field) => field.trim())
  if (!fields.length || fields.some((field) => !field)) return 'Name every output field'
  if (new Set(fields).size !== fields.length) return 'Output fields must be unique'
  return undefined
}

function alertsIssue(params: AiFindingsParams) {
  if (params.instructions.length > 1000) return 'The focus note is over 1,000 characters'
  if (!params.alerts.enabled) return undefined
  if (params.alerts.criteria.length > 500) return 'The alert criteria are over 500 characters'
  for (const rule of params.alerts.rules) {
    if (!rule.conditions.length) return `Add a condition to “${rule.label || 'Untitled rule'}”`
    for (const condition of rule.conditions) {
      if (condition.type === 'forecast_event') {
        if (condition.withinHours < 1 || condition.withinHours > 72) return 'A coming event must be within 1–72 hours'
      } else if (!condition.sourceNodeId || (condition.measure !== 'row_count' && !condition.field) || !condition.value.trim()) {
        return `Finish the conditions in “${rule.label || 'Untitled rule'}”`
      }
    }
  }
  return undefined
}

function mlIssue(params: MlModelParams) {
  return params.modelId && ML_MODELS_BY_ID[params.modelId] ? undefined : 'Select a model'
}

function forecastIssue(params: ForecastParams) {
  if (!params.timeColumn) return 'Choose the time column'
  if (!params.targetColumn) return 'Choose the value to forecast'
  const series = params.seriesIdColumns ?? []
  if (series.some((column) => column === params.timeColumn || column === params.targetColumn) || new Set(series).size !== series.length) {
    return 'Series columns can’t repeat or reuse the time or value column'
  }
  return undefined
}

function switchIssue(params: SwitchParams) {
  if (!params.cases.length) return 'Add a case'
  for (const item of params.cases) {
    const issue = groupIssue(item.when, `“${item.label}”`)
    if (issue) return issue
  }
  return undefined
}

function editFieldsIssue(params: EditFieldsParams) {
  if (!params.assignments.length && !params.remove.length) return 'Set or remove at least one field'
  if (params.assignments.some((item) => !item.name.trim())) return 'Name every field you set'
  return undefined
}

function aggregateIssue(params: AggregateParams) {
  if (!params.metrics.length) return 'Add a metric'
  if (params.metrics.some((metric) => metric.fn !== 'count' && !metric.field)) return 'Choose the field for every metric'
  return undefined
}

const required = (value: string, message: string) => (value.trim() ? undefined : message)

/** Why the node can't run yet, or undefined when it's ready. */
export function kindIssue(typeId: string, stored: unknown): string | undefined {
  if (!isKind(typeId)) return undefined
  switch (typeId) {
    case 'scheduleTrigger': {
      const params = paramsFor(typeId, stored)
      return params.every >= 1 && params.every <= 10_000 ? undefined : 'Every must be between 1 and 10,000'
    }
    case 'webhook':
      return webhookIssue(paramsFor(typeId, stored))
    case 'asset': {
      const params = paramsFor(typeId, stored)
      return params.assetId && ASSETS_BY_ID[params.assetId] ? undefined : 'Choose an asset'
    }
    case 'source':
      return sourceIssue(paramsFor(typeId, stored))
    case 'mlModel':
      return mlIssue(paramsFor(typeId, stored))
    case 'forecast':
      return forecastIssue(paramsFor(typeId, stored))
    case 'createAsset':
      return createAssetIssue(paramsFor(typeId, stored))
    case 'filter':
      return groupIssue(paramsFor(typeId, stored).where, 'the filter')
    case 'ifElse':
      return groupIssue(paramsFor(typeId, stored).when, 'the If branch')
    case 'switchCases':
      return switchIssue(paramsFor(typeId, stored))
    case 'editFields':
      return editFieldsIssue(paramsFor(typeId, stored))
    case 'aggregate':
      return aggregateIssue(paramsFor(typeId, stored))
    case 'wait': {
      const params = paramsFor(typeId, stored)
      return params.waitFor >= 1 ? undefined : 'Wait at least 1 unit'
    }
    case 'generalAgent':
    case 'dataAnalyst':
    case 'slidesAgent':
    case 'dashboardAgent':
    case 'briefingAgent':
    case 'gisCorrelationAgent':
      return required(paramsFor(typeId, stored).instructions, 'Enter instructions for the agent')
    case 'dataClassificationAgent':
      return categoriesIssue(paramsFor(typeId, stored))
    case 'insightGenerator':
      return insightIssue(paramsFor(typeId, stored))
    case 'aiFindings':
      return alertsIssue(paramsFor(typeId, stored))
    case 'sendChatMessage': {
      const params = paramsFor(typeId, stored)
      if (!params.message.trim()) return 'Write the message to send'
      if (params.mode === 'send_and_wait' && params.responseType === 'approval' && (!params.approveLabel.trim() || !params.rejectLabel.trim())) {
        return 'Label both approval buttons'
      }
      return undefined
    }
    case 'sendEmail': {
      const params = paramsFor(typeId, stored)
      const to = emailList(params.to)
      if (!to.length) return 'Add a recipient'
      if ([...to, ...emailList(params.cc), ...emailList(params.bcc)].some((address) => !address.includes('{{') && !EMAIL.test(address))) {
        return 'Check the email addresses'
      }
      return required(params.subject, 'Add a subject') ?? required(params.body, 'Write the email body')
    }
    case 'sendApiRequest':
      return apiIssue(paramsFor(typeId, stored))
    default:
      return undefined
  }
}

/** Rows on the canvas card; trigger rows depend on the Flow too, see `triggerFields`. */
export function kindFields(typeId: string, stored: unknown): NodeField[] {
  if (!isKind(typeId)) return []
  switch (typeId) {
    case 'source':
      return sourceSummary(paramsFor(typeId, stored))
    case 'mlModel': {
      const params = paramsFor(typeId, stored)
      const model = params.modelId ? ML_MODELS_BY_ID[params.modelId] : undefined
      return model ? [{ label: 'Model', value: `${model.name} ${model.version}` }] : []
    }
    case 'forecast': {
      const params = paramsFor(typeId, stored)
      if (!params.targetColumn) return []
      const measure = measureLimit(params.targetColumn)?.label ?? params.targetColumn
      const ahead = `${params.horizon} ${GRAIN_LABEL[params.grain].toLowerCase()}${params.horizon === 1 ? '' : 's'}`
      const per = params.seriesIdColumns?.length ? `, per ${params.seriesIdColumns.join(', ')}` : ''
      return [{ label: 'Forecast', value: `${measure} for the next ${ahead}${per}` }]
    }
    case 'createAsset':
      return createAssetFields(paramsFor(typeId, stored))
    case 'filter': {
      const where = paramsFor(typeId, stored).where
      return where.conditions.length ? [groupField('Where', where)] : []
    }
    case 'ifElse': {
      const when = paramsFor(typeId, stored).when
      return when.conditions.length ? [groupField('If', when)] : []
    }
    case 'switchCases':
      return paramsFor(typeId, stored).sendToAllMatching ? [{ label: 'Routing', value: 'Every matching case' }] : []
    case 'editFields': {
      const params = paramsFor(typeId, stored)
      return [
        ...params.assignments
          .slice(0, 2)
          .map((item): NodeField => {
            const parts = [
              { text: item.name || '…', role: 'field' },
              { text: '=', role: 'operator' },
              { text: item.type === 'text' ? `"${item.value}"` : item.value, role: 'value' },
            ] as const
            return { label: 'Set', value: partsText(parts), parts, muted: !item.name || undefined }
          }),
        ...(params.assignments.length > 2 ? [{ label: 'And', value: `${params.assignments.length - 2} more` }] : []),
        ...(params.remove.length ? [{ label: 'Remove', value: params.remove.join(', ') }] : []),
      ]
    }
    case 'aggregate': {
      const params = paramsFor(typeId, stored)
      const field = (parts: readonly FieldPart[]): Pick<NodeField, 'value' | 'parts'> => ({ value: partsText(parts), parts })
      const last = params.groupBy.length - 1
      const groups = params.groupBy.flatMap((name, index): FieldPart[] => [
        ...(index && index === last ? [{ text: 'and', role: 'join' } as const] : []),
        { text: index < last - 1 ? `${name},` : name, role: 'field' },
      ])
      return [
        ...(params.groupBy.length ? [{ label: 'Group', ...field([{ text: 'by', role: 'operator' }, ...groups]) }] : []),
        ...params.metrics.map((metric): NodeField => ({
          label: 'Metric',
          ...(metric.fn === 'count' && !metric.field
            ? field([{ text: 'row count', role: 'operator' }])
            : field([
                { text: `${METRIC_PHRASE[metric.fn]} of`, role: 'operator' },
                { text: metric.field || '…', role: 'field' },
              ])),
          muted: (metric.fn !== 'count' && !metric.field) || undefined,
        })),
      ]
    }
    case 'merge':
      return [{ label: 'Mode', value: paramsFor(typeId, stored).dedupe ? 'Append, drop duplicates' : 'Append in input order' }]
    case 'wait':
      return [{ label: 'Wait', value: waitText(paramsFor(typeId, stored)) }]
    case 'stopAndError':
      return [{ label: 'Message', value: paramsFor(typeId, stored).stopMessage || 'Workflow halted.' }]
    case 'insightGenerator': {
      const params = paramsFor(typeId, stored)
      return params.fields.length ? [{ label: 'Fields', value: params.fields.join(', ') }] : []
    }
    case 'gisCorrelationAgent': {
      const params = paramsFor(typeId, stored)
      return [
        { label: 'Upper', value: UPPER_LABEL[params.upper.kind] },
        { label: 'Land', value: BOTTOM_LABEL[params.bottom.kind] },
      ]
    }
    case 'aiFindings': {
      const alerts = paramsFor(typeId, stored).alerts
      return [{ label: 'Alerts', value: alerts.enabled ? `${alerts.rules.length} ${alerts.rules.length === 1 ? 'rule' : 'rules'}` : 'Off' }]
    }
    case 'sendChatMessage': {
      const params = paramsFor(typeId, stored)
      return [{ label: 'Mode', value: params.mode === 'send_and_wait' ? (params.responseType === 'approval' ? 'Wait for approval' : 'Wait for a reply') : 'Send message' }]
    }
    case 'sendEmail': {
      const params = paramsFor(typeId, stored)
      return [
        ...(params.to.trim() ? [{ label: 'To', value: params.to }] : []),
        ...(params.subject.trim() ? [{ label: 'Subject', value: params.subject }] : []),
      ]
    }
    case 'sendApiRequest': {
      const params = paramsFor(typeId, stored)
      if (params.mode === 'source') {
        const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
        return source ? [{ label: 'Via', value: source.name }] : []
      }
      return params.url.trim() ? [{ label: params.method, value: params.url.replace(/^https?:\/\//, '') }] : []
    }
    default:
      return []
  }
}

/** The prompt a kind holds and passes on, by the param it lives in; cards can edit it in place. */
export type KindPrompt = { param: 'instructions' | 'message'; value: string }

export function kindPrompt(typeId: string, stored: unknown): KindPrompt | undefined {
  if (!isKind(typeId)) return undefined
  switch (typeId) {
    case 'generalAgent':
    case 'dataClassificationAgent':
    case 'insightGenerator':
    case 'dataAnalyst':
    case 'gisCorrelationAgent':
    case 'slidesAgent':
    case 'dashboardAgent':
    case 'briefingAgent':
    case 'aiFindings':
      return { param: 'instructions', value: paramsFor(typeId, stored).instructions }
    case 'sendChatMessage':
      return { param: 'message', value: paramsFor(typeId, stored).message }
    default:
      return undefined
  }
}

/** Free text the card shows under its rows: an agent's instructions or a message. */
export function kindText(typeId: string, stored: unknown): string | undefined {
  return kindPrompt(typeId, stored)?.value.trim() || undefined
}

/** The header summary in the configuration window. */
export function kindSummary(typeId: string, stored: unknown): string | undefined {
  if (typeId === 'scheduleTrigger') return scheduleSummary(paramsFor(typeId, stored))
  if (typeId === 'webhook') {
    const params = paramsFor(typeId, stored)
    return `${params.method} · ${AUTH_LABEL[params.authMode]}`
  }
  return undefined
}

export const UPPER_LABEL: Record<UpperLayerKind, string> = { events: 'Events', values: 'Measured values', wind: 'Wind' }
export const BOTTOM_LABEL: Record<BottomLayerKind, string> = { land_type: 'Land type', land_measure: 'Land measure', values: 'Values' }

/* ---------- Branches ---------- */

export const UNCLASSIFIED = '_unclassified'

/** Kinds whose output ports come from their configuration. */
export function kindOutputs(typeId: string, stored: unknown): readonly NodePort[] | undefined {
  if (typeId === 'switchCases') {
    const params = paramsFor(typeId, stored)
    return [...params.cases.map((item) => ({ id: item.id, label: item.label })), { id: 'default', label: 'Default' }]
  }
  if (typeId === 'dataClassificationAgent') {
    const params = paramsFor(typeId, stored)
    return [...params.categories.map((category) => ({ id: category.id, label: category.name || 'Untitled' })), { id: UNCLASSIFIED, label: 'Unclassified' }]
  }
  return undefined
}

/** What the card's add-branch button says, for kinds that have one. */
export function branchAddLabel(typeId: string) {
  if (typeId === 'switchCases') return 'Add case'
  if (typeId === 'dataClassificationAgent') return 'Add category'
  return undefined
}

/** The parameter change that adds one branch. */
export function addBranch(typeId: string, stored: unknown): Partial<AnyParams> | undefined {
  if (typeId === 'switchCases') {
    const params = paramsFor(typeId, stored)
    let number = params.cases.length + 1
    while (params.cases.some((item) => item.id === `case${number}`)) number += 1
    const added: SwitchCase = { id: `case${number}`, label: `Case ${number}`, when: conditionGroup(newCondition(uid('c'))) }
    return { cases: [...params.cases, added] } satisfies Partial<SwitchParams>
  }
  if (typeId === 'dataClassificationAgent') {
    const params = paramsFor(typeId, stored)
    const added: Category = { id: uid('cat'), name: `Category ${params.categories.length + 1}`, example: '' }
    return { categories: [...params.categories, added] } satisfies Partial<ClassificationParams>
  }
  return undefined
}

/** Whether the card can edit or remove a branch; Default and Unclassified always stay. */
export const isAuthoredBranch = (typeId: string, portId: string) => Boolean(branchAddLabel(typeId)) && portId !== 'default' && portId !== UNCLASSIFIED

/** The parameter change that removes one branch. */
export function removeBranch(typeId: string, stored: unknown, portId: string): Partial<AnyParams> | undefined {
  if (typeId === 'switchCases') {
    return { cases: paramsFor(typeId, stored).cases.filter((item) => item.id !== portId) } satisfies Partial<SwitchParams>
  }
  if (typeId === 'dataClassificationAgent') {
    return { categories: paramsFor(typeId, stored).categories.filter((item) => item.id !== portId) } satisfies Partial<ClassificationParams>
  }
  return undefined
}

/** The Asset node's tile: the saved asset's own visual. */
export function kindPreview(typeId: string, stored: unknown): 'chart' | 'map' | undefined {
  if (typeId !== 'asset') return undefined
  const params = paramsFor(typeId, stored)
  return params.assetId ? ASSETS_BY_ID[params.assetId]?.preview : undefined
}

/** A notice that doesn't stop the run, e.g. an archived asset. */
export function kindNotice(typeId: string, stored: unknown): string | undefined {
  if (typeId !== 'asset') return undefined
  const params = paramsFor(typeId, stored)
  return params.assetId && ASSETS_BY_ID[params.assetId]?.archived ? 'This asset is archived; it still runs.' : undefined
}
