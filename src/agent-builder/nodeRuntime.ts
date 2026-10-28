import { matches } from './conditions'
import { columnsOf, detectGeometry, isMapLayer } from './createAsset'
import { ASSETS_BY_ID, DAY_MS, ML_MODELS_BY_ID, SOURCES_BY_ID, isoDay } from './flowData'
import {
  NODE_TYPES_BY_ID,
  nodeName,
  nodeOutputs,
  nodeSettings,
  type CanvasNode,
  type DataRecord,
  type DataValue,
  type NodeRun,
  type NodeType,
  type WorkflowEdge,
} from './nodeCatalog'
import {
  TEMPLATE_TOKEN,
  UNCLASSIFIED,
  bodyAllowed,
  emailList,
  isAppAsset,
  kindIssue,
  paramsFor,
  scheduleSummary,
  slug,
  urlIssue,
  type AggregateParams,
  type ForecastGrain,
  type ForecastParams,
  type GisParams,
  type KindId,
  type SourceParams,
  type WaitUnit,
} from './nodeKinds'

/* ---------- Step input and result ---------- */

/** An earlier step and what it last produced, addressable from templates as `{{alias.field}}`. */
export type Ancestor = { id: string; name: string; alias: string; typeId: string; rows: readonly DataRecord[] | null }

export type StepInput = {
  node: CanvasNode
  type: NodeType
  /** Rows per input port; a port is absent when nothing reached it. */
  inputs: Readonly<Record<string, readonly DataRecord[]>>
  parents: readonly { id: string; typeId: string }[]
  /** The kinds wired straight after this step; empty when it ends the Flow. */
  children: readonly string[]
  ancestors: readonly Ancestor[]
  /** The trigger kind that started a flow run. */
  triggerTypeId?: string
  hasChatTrigger: boolean
  /** Execute Node on one step, as opposed to a flow run. */
  stepTest: boolean
  runId: string
}

type Ports = Record<string, DataRecord[]>

export type StepResult =
  | { ok: true; ports: Ports; note?: string; cost?: number; assetRows?: readonly DataRecord[]; seconds: number }
  | { ok: false; code: string; message: string; seconds: number; cost?: number }

const fail = (code: string, message: string, seconds = 0.4): StepResult => ({ ok: false, code, message, seconds })
const done = (ports: Ports, seconds: number, extra: { note?: string; cost?: number; assetRows?: readonly DataRecord[] } = {}): StepResult => ({ ok: true, ports, seconds, ...extra })

/** Every input port's rows, in port order. */
const allRows = (input: StepInput) => input.type.inputs.flatMap((port) => input.inputs[port.id] ?? [])

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

/** Short, stable ids from a string, so a run's ids don't change between identical runs. */
function stableId(prefix: string, seed: string) {
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `${prefix}_${(hash >>> 0).toString(36).padStart(7, '0').slice(0, 7)}`
}

/* ---------- Templates ---------- */

type TemplateScope = { rows: readonly DataRecord[]; ancestors: readonly Ancestor[]; row?: DataRecord }

function tokenValues(token: string, scope: TemplateScope): DataValue[] | undefined {
  if (token === 'rows.count') return [scope.rows.length]
  const dot = token.indexOf('.')
  if (dot > 0) {
    const ancestor = scope.ancestors.find((item) => item.alias === token.slice(0, dot))
    if (ancestor) {
      const field = token.slice(dot + 1)
      if (!ancestor.rows?.length || !(field in ancestor.rows[0])) return undefined
      return [...new Set(ancestor.rows.map((row) => row[field] ?? null))]
    }
  }
  const row = scope.row ?? scope.rows[0]
  return row && token in row ? [row[token] ?? null] : undefined
}

const sqlLiteral = (value: DataValue) => (typeof value === 'number' || typeof value === 'boolean' ? String(value) : value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`)

function listText(values: readonly DataValue[]) {
  const shown = values.slice(0, 5).map((value) => (value === null ? '—' : String(value)))
  return values.length > 5 ? `${shown.join(', ')} and ${values.length - 5} more` : shown.join(', ')
}

/** Substitutes `{{…}}` tokens; SQL quotes text and expands a multi-value reference into a list. */
export function expandTemplate(text: string, scope: TemplateScope, format: 'text' | 'sql' = 'text') {
  const unresolved: string[] = []
  const expanded = text.replace(TEMPLATE_TOKEN, (whole, token: string) => {
    const values = tokenValues(token, scope)
    if (!values) {
      unresolved.push(token)
      return format === 'sql' ? whole : ''
    }
    return format === 'sql' ? values.map(sqlLiteral).join(', ') : listText(values)
  })
  return { text: expanded, unresolved }
}

/* ---------- Data profile, for the agents ---------- */

const COORDINATE = /^(lat|latitude|lng|lon|long|longitude)$/i

type Profile = {
  count: number
  label?: string
  measure?: string
  total: number
  ranked: { label: string; value: number }[]
  mean: number
  std: number
}

function profile(rows: readonly DataRecord[]): Profile {
  const columns = columnsOf(rows)
  const label = columns.find((column) => column.kind === 'string')?.name
  const numbers = columns.filter((column) => column.kind === 'number' && !COORDINATE.test(column.name))
  const measure = (numbers.find((column) => rows.some((row) => Math.abs(Number(row[column.name])) > 1)) ?? numbers[0])?.name
  const values = measure ? rows.map((row) => Number(row[measure])).filter(Number.isFinite) : []
  const total = values.reduce((sum, value) => sum + value, 0)
  const mean = values.length ? total / values.length : 0
  const std = values.length ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) : 0
  const ranked =
    measure && label
      ? rows
          .map((row) => ({ label: String(row[label] ?? '—'), value: Number(row[measure]) }))
          .filter((item) => Number.isFinite(item.value))
          .sort((a, b) => b.value - a.value)
      : []
  return { count: rows.length, label, measure, total, ranked, mean, std }
}

const words = (name: string) => name.replace(/[_-]+/g, ' ').toLowerCase()
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** A grounded paragraph: only numbers that are in the rows or computed from them. */
function narrative(rows: readonly DataRecord[]) {
  const data = profile(rows)
  if (!data.count) return 'No rows reached this step, so there is nothing to report.'
  if (!data.measure || !data.ranked.length) return `Reviewed ${data.count} ${data.count === 1 ? 'row' : 'rows'}; none carries a numeric measure to rank.`
  const [first, second] = data.ranked
  const measure = words(data.measure)
  const lead = `${first.label} leads with ${round(first.value, 1)} ${measure}, ${percent(first.value, data.total)}% of the ${round(data.total, 1)} total across ${data.count} rows.`
  const next = second ? ` ${second.label} follows with ${round(second.value, 1)}.` : ''
  const spread = data.std > 0 ? ` The average is ${round(data.mean, 1)}; anything above ${round(data.mean + data.std, 1)} sits more than one standard deviation out.` : ''
  return lead + next + spread
}

/* ---------- Kinds ---------- */

function runTrigger(input: StepInput): StepResult {
  const now = new Date().toISOString().slice(0, 19) + 'Z'
  const base = { run_id: input.runId, triggered_at: now, run_mode: 'builder_debug' }
  switch (input.type.id) {
    case 'scheduleTrigger': {
      const params = paramsFor('scheduleTrigger', input.node.config.params)
      return done({ out: [{ ...base, trigger: 'schedule', schedule: scheduleSummary(params), timezone: params.timezone }] }, 0.05)
    }
    case 'chatInput': {
      const params = paramsFor('chatInput', input.node.config.params)
      if (!params.testMessage.trim()) return fail('WF_CHAT_MESSAGE_EMPTY', 'Type a test message first.', 0.05)
      return done({ out: [{ ...base, trigger: 'chat', message: params.testMessage, session_id: stableId('chat', input.node.id), user: 'mahmoud@llumen.ai' }] }, 0.05)
    }
    case 'webhook': {
      const params = paramsFor('webhook', input.node.config.params)
      let body: unknown = {}
      if (params.testBody.trim()) {
        try {
          body = JSON.parse(params.testBody)
        } catch {
          return fail('WF_WEBHOOK_BODY_INVALID', 'The test body isn’t valid JSON.', 0.05)
        }
      }
      const fields =
        body && typeof body === 'object' && !Array.isArray(body)
          ? Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value !== null && typeof value === 'object' ? JSON.stringify(value) : (value as DataValue)]))
          : { body: JSON.stringify(body) }
      return done({ out: [{ ...base, trigger: 'webhook', method: params.method, ...fields }] }, 0.05)
    }
    default:
      return done({ out: [{ ...base, trigger: 'manual', triggered_by: 'Mahmoud Khairy' }] }, 0.02)
  }
}

const UNSAFE_SQL = /\b(drop|alter|grant|revoke|create|exec|execute|copy|load|insert|update|delete|truncate|pg_read_file|xp_cmdshell)\b/i

type Clause = { column: string; op: string; values: DataValue[] }

function parseLiteral(text: string): DataValue {
  const value = text.trim()
  if (/^'.*'$/s.test(value)) return value.slice(1, -1).replace(/''/g, "'")
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true'
  if (/^null$/i.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

function parseClause(text: string): Clause | null {
  const list = text.match(/^\s*(\w+)\s+(not\s+in|in)\s*\(([\s\S]*)\)\s*$/i)
  if (list) {
    const values = list[3].match(/'(?:[^']|'')*'|[^,\s][^,]*/g)?.map(parseLiteral) ?? []
    return { column: list[1], op: list[2].toLowerCase().replace(/\s+/, ' '), values }
  }
  const binary = text.match(/^\s*(\w+)\s*(=|!=|<>|>=|<=|>|<|ilike|like)\s*(.+?)\s*$/i)
  return binary ? { column: binary[1], op: binary[2].toLowerCase(), values: [parseLiteral(binary[3])] } : null
}

function clauseHolds(row: DataRecord, clause: Clause) {
  const left = row[clause.column] ?? null
  const [right] = clause.values
  switch (clause.op) {
    case 'in':
      return clause.values.some((value) => value === left)
    case 'not in':
      return !clause.values.some((value) => value === left)
    case '=':
      return left === right
    case '!=':
    case '<>':
      return left !== right
    case 'like':
    case 'ilike': {
      const pattern = new RegExp(`^${String(right).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, clause.op === 'ilike' ? 'i' : '')
      return pattern.test(String(left ?? ''))
    }
    default: {
      if (left === null || right === null) return false
      const a = typeof left === 'number' ? left : String(left)
      const b = typeof right === 'number' ? right : String(right)
      return clause.op === '>' ? a > b : clause.op === '>=' ? a >= b : clause.op === '<' ? a < b : a <= b
    }
  }
}

/** Runs a SELECT against the source's tables: columns, WHERE (all AND or all OR), ORDER BY, LIMIT. */
export function runQuery(sql: string, tables: Readonly<Record<string, readonly DataRecord[]>>): { rows: DataRecord[] } | { error: string; code: string } {
  const text = sql.trim().replace(/;\s*$/, '')
  if (UNSAFE_SQL.test(text)) return { code: 'WF_SOURCE_QUERY_UNSAFE', error: 'Only read queries can run here: the statement changes data or schema.' }
  const match = text.match(
    /^select\s+([\s\S]+?)\s+from\s+([\w.]+)(?:\s+where\s+([\s\S]+?))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i,
  )
  if (!match) return { code: 'WF_SOURCE_QUERY_SYNTAX', error: 'Syntax error: write SELECT columns FROM table, with optional WHERE, ORDER BY, and LIMIT.' }
  const [, columnText, tableName, whereText, orderBy, direction, limit] = match
  const table = tables[tableName.split('.').at(-1) ?? tableName]
  if (!table) return { code: 'WF_SOURCE_QUERY_FAILED', error: `relation "${tableName}" does not exist` }
  const known = new Set(table.flatMap((row) => Object.keys(row)))
  const missing = (column: string) => ({ code: 'WF_SOURCE_QUERY_FAILED', error: `column "${column}" does not exist` })

  let rows = [...table]
  if (whereText) {
    const or = /\s+or\s+/i.test(whereText)
    const clauses = whereText.split(or ? /\s+or\s+/i : /\s+and\s+/i).map(parseClause)
    if (clauses.some((clause) => !clause)) return { code: 'WF_SOURCE_QUERY_SYNTAX', error: `Syntax error in WHERE: ${whereText}` }
    const valid = clauses as Clause[]
    const unknown = valid.find((clause) => !known.has(clause.column))
    if (unknown) return missing(unknown.column)
    rows = rows.filter((row) => (or ? valid.some((clause) => clauseHolds(row, clause)) : valid.every((clause) => clauseHolds(row, clause))))
  }
  if (orderBy) {
    if (!known.has(orderBy)) return missing(orderBy)
    const sign = direction?.toLowerCase() === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const left = a[orderBy] ?? ''
      const right = b[orderBy] ?? ''
      return left < right ? -sign : left > right ? sign : 0
    })
  }
  if (limit) rows = rows.slice(0, Number(limit))
  if (columnText.trim() !== '*') {
    const picks = columnText.split(',').map((part) => {
      const [, column, alias] = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/i) ?? []
      return column ? { column, alias: alias ?? column } : null
    })
    if (picks.some((pick) => !pick)) return { code: 'WF_SOURCE_QUERY_SYNTAX', error: `Syntax error in the column list: ${columnText}` }
    const valid = picks as { column: string; alias: string }[]
    const unknown = valid.find((pick) => !known.has(pick.column))
    if (unknown) return missing(unknown.column)
    rows = rows.map((row) => Object.fromEntries(valid.map((pick) => [pick.alias, row[pick.column] ?? null])))
  }
  return { rows }
}

function runSource(input: StepInput, params: SourceParams): StepResult {
  const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
  if (!source) return fail('WF_COMPILE_SOURCE_MISSING_ID', 'Select a source.')
  const scope = { rows: allRows(input), ancestors: input.ancestors }
  switch (params.mode) {
    case 'query': {
      const { text, unresolved } = expandTemplate(params.query, scope, 'sql')
      if (unresolved.length) return fail('WF_SOURCE_REF_UNRESOLVED', `Nothing to substitute for {{${unresolved[0]}}}: run that step first.`)
      const result = runQuery(text, source.tables ?? {})
      return 'error' in result ? fail(result.code, result.error, 0.6) : done({ out: result.rows }, 0.8 + result.rows.length / 400)
    }
    case 'api_request': {
      const endpoint = source.endpoints?.find((item) => item.id === params.endpointId)
      if (!endpoint) return fail('WF_COMPILE_SOURCE_MISSING_QUERY', 'Choose the request to send.')
      const query = new URLSearchParams(expandTemplate(params.queryString, scope).text)
      let rows = [...endpoint.rows]
      for (const [key, value] of query) {
        if (key === 'limit') rows = rows.slice(0, Number(value) || rows.length)
        else if (rows.some((row) => key in row)) rows = rows.filter((row) => String(row[key]).toLowerCase() === value.toLowerCase())
      }
      return done({ out: rows }, 0.9)
    }
    case 'file': {
      const sheet = params.sheet ? source.sheets?.[params.sheet] : undefined
      return sheet ? done({ out: [...sheet] }, 0.5) : fail('WF_COMPILE_SOURCE_MISSING_QUERY', 'Choose a sheet.')
    }
    case 'dataflow': {
      const dataset = source.datasets?.find((item) => item.id === params.datasetId)
      return dataset ? done({ out: [...dataset.rows] }, 0.6) : fail('WF_COMPILE_SOURCE_MISSING_QUERY', 'Choose a dataset.')
    }
    default: {
      const operation = source.operations?.find((item) => item.id === params.operationId)
      if (!operation) return fail('WF_COMPILE_SOURCE_MISSING_QUERY', 'Choose an operation.')
      const missing = operation.parameters.find((parameter) => !params.operationParams[parameter.key]?.trim())
      if (missing) return fail('WF_MARKETPLACE_PARAMETER_MISSING', `Enter the ${missing.label.toLowerCase()} for ${operation.label}.`)
      return done({ out: [...operation.rows] }, 1.1)
    }
  }
}

const rowsFromSource = (input: StepInput, rowSource: string | undefined) =>
  rowSource ? (input.ancestors.find((item) => item.id === rowSource)?.rows ?? null) : allRows(input)

function runMlModel(input: StepInput): StepResult {
  const params = paramsFor('mlModel', input.node.config.params)
  const model = params.modelId ? ML_MODELS_BY_ID[params.modelId] : undefined
  if (!model) return fail('WF_COMPILE_ML_MODEL_MISSING_ID', 'Select a model.')
  const rows = rowsFromSource(input, params.rowSource)
  if (!rows) return fail('WF_ML_MODEL_NO_INPUT', 'The step it reads from hasn’t run yet.')
  if (rows.length > 50_000) return fail('WF_ML_MODEL_TOO_MANY_ROWS', `${rows.length.toLocaleString()} rows is over the 50,000-row limit for batch prediction.`)
  const columns = model.features.map((feature) => params.featureMapping[feature] || feature)
  const absent = columns.find((column) => rows.length && !(column in rows[0]))
  if (absent) return fail('WF_ML_MODEL_FEATURE_MISSING', `No input column "${absent}" for feature “${model.features[columns.indexOf(absent)]}”. Map it in the panel.`)
  const out = rows.map((row) => {
    const score = model.bias + columns.reduce((sum, column, index) => sum + model.weights[index] * Number(row[column] ?? 0), 0)
    const probability = 1 / (1 + Math.exp(-score))
    return { ...row, prediction: model.labels[probability >= 0.5 ? 1 : 0], probability: round(probability, 3) }
  })
  return done({ out }, 1.4 + rows.length / 1000)
}

/* ---------- Forecast ---------- */

/** Periods per season, asserted equal on both sides of the real system. */
const GRAIN_PERIOD: Record<ForecastGrain, number> = { hour: 24, day: 7, week: 52, month: 12 }

function bucketKey(value: DataValue, grain: ForecastGrain) {
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  const iso = date.toISOString()
  if (grain === 'hour') return `${iso.slice(0, 13)}:00:00Z`
  if (grain === 'day') return iso.slice(0, 10)
  if (grain === 'month') return `${iso.slice(0, 7)}-01`
  const day = date.getUTCDay() || 7
  return isoDay(date.getTime() - (day - 1) * DAY_MS)
}

function stepKey(key: string, grain: ForecastGrain, steps: number) {
  const date = new Date(key.length === 10 ? `${key}T00:00:00Z` : key)
  if (grain === 'hour') return new Date(date.getTime() + steps * 3_600_000).toISOString().slice(0, 19) + 'Z'
  if (grain === 'day') return isoDay(date.getTime() + steps * DAY_MS)
  if (grain === 'week') return isoDay(date.getTime() + steps * 7 * DAY_MS)
  return `${new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + steps, 1)).toISOString().slice(0, 10)}`
}

/** What the gate says about one series: how far ahead its history supports, or why it can't be forecast. */
export function forecastGate(points: number, grain: ForecastGrain, horizon: number) {
  const floor = GRAIN_PERIOD[grain] * 2
  if (points < floor) {
    return { allowed: false as const, distance: false, maxHorizon: 0, reason: `${points} periods of history; a ${grain} forecast needs at least ${floor}.` }
  }
  const maxHorizon = Math.floor(points / 2)
  if (horizon > maxHorizon) return { allowed: false as const, distance: true, maxHorizon, reason: `${horizon} periods ahead is more than the ${maxHorizon} this history supports.` }
  return { allowed: true as const, distance: false, maxHorizon }
}

/** Periods of history per series, bucketed the way the forecast buckets them. */
export function forecastHistory(rows: readonly DataRecord[], params: ForecastParams): { id: string; points: number }[] {
  const { timeColumn, targetColumn, grain } = params
  if (!timeColumn || !targetColumn) return []
  const seriesColumns = params.seriesIdColumns ?? []
  const series = new Map<string, Set<string>>()
  for (const row of rows) {
    const raw = row[targetColumn]
    const key = bucketKey(row[timeColumn], grain)
    if (!key || raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))) continue
    const id = seriesColumns.length ? seriesColumns.map((column) => String(row[column] ?? '—')).join(' · ') : 'all'
    const keys = series.get(id) ?? new Set<string>()
    keys.add(key)
    series.set(id, keys)
  }
  return [...series].map(([id, keys]) => ({ id, points: keys.size }))
}

function runForecast(input: StepInput): StepResult {
  const params: ForecastParams = paramsFor('forecast', input.node.config.params)
  const rows = allRows(input)
  const { timeColumn, targetColumn, grain } = params
  if (!timeColumn || !targetColumn) return fail('WF_COMPILE_FORECAST_MISSING_COLUMN', 'Choose the time and value columns.')
  if (rows.length && (!(timeColumn in rows[0]) || !(targetColumn in rows[0]))) {
    return fail('WF_FORECAST_COLUMN_MISSING', `The input has no "${!(timeColumn in rows[0]) ? timeColumn : targetColumn}" column.`)
  }
  const seriesColumns = params.seriesIdColumns ?? []
  const series = new Map<string, Map<string, number>>()
  let dropped = 0
  for (const row of rows) {
    const time = row[timeColumn]
    const raw = row[targetColumn]
    if (time === null || time === undefined || raw === null || raw === undefined || raw === '') {
      dropped += 1
      continue
    }
    const value = Number(raw)
    const key = bucketKey(time, grain)
    if (!Number.isFinite(value) || !key) return fail('WF_FORECAST_VALUE_INVALID', `Row at ${String(time)} has a value that isn’t a number: ${String(raw)}.`)
    const id = seriesColumns.length ? seriesColumns.map((column) => String(row[column] ?? '—')).join(' · ') : 'all'
    const buckets = series.get(id) ?? new Map<string, number>()
    buckets.set(key, (buckets.get(key) ?? 0) + value)
    series.set(id, buckets)
  }

  const out: DataRecord[] = []
  const refused: string[] = []
  const shortened: string[] = []
  for (const [id, buckets] of series) {
    const keys = [...buckets.keys()].sort()
    const values = keys.map((key) => buckets.get(key) ?? 0)
    const gate = forecastGate(values.length, grain, params.horizon)
    let horizon = params.horizon
    if (!gate.allowed) {
      if (gate.distance && params.onRefuse === 'shorten_to_supported') {
        horizon = gate.maxHorizon
        shortened.push(`${id} (${params.horizon} → ${horizon})`)
      } else {
        refused.push(`${id}: ${gate.reason}`)
        continue
      }
    }
    const n = values.length
    const meanX = (n - 1) / 2
    const meanY = values.reduce((sum, value) => sum + value, 0) / n
    const slope = values.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0) / values.reduce((sum, _, index) => sum + (index - meanX) ** 2, 0)
    const intercept = meanY - slope * meanX
    const period = GRAIN_PERIOD[grain]
    const seasonal = Array.from({ length: period }, (_, phase) => {
      const residuals = values.flatMap((value, index) => (index % period === phase ? [value - (intercept + slope * index)] : []))
      return residuals.length ? residuals.reduce((sum, value) => sum + value, 0) / residuals.length : 0
    })
    const fitted = values.map((_, index) => intercept + slope * index + seasonal[index % period])
    const sigma = Math.sqrt(values.reduce((sum, value, index) => sum + (value - fitted[index]) ** 2, 0) / Math.max(1, n - 2))
    keys.forEach((key, index) => {
      out.push({ TS: key, FORECAST: round(values[index], 2), LOWER_BOUND: round(values[index], 2), UPPER_BOUND: round(values[index], 2), SERIES_ID: id, IS_HISTORY: true })
    })
    for (let step = 1; step <= horizon; step += 1) {
      const index = n - 1 + step
      const point = intercept + slope * index + seasonal[index % period]
      const band = 1.96 * sigma * Math.sqrt(step)
      out.push({
        TS: stepKey(keys[n - 1], grain, step),
        FORECAST: round(point),
        LOWER_BOUND: round(point - band),
        UPPER_BOUND: round(point + band),
        SERIES_ID: id,
        IS_HISTORY: false,
      })
    }
  }

  if (refused.length && (params.onRefuse === 'fail' || refused.length === series.size)) {
    const shown = refused.slice(0, 3).join(' ')
    return fail('WF_FORECAST_REFUSED', refused.length > 3 ? `${shown} …and ${refused.length - 3} more series.` : shown, 2)
  }
  const notes = [
    refused.length ? `${refused.length} ${refused.length === 1 ? 'series was' : 'series were'} refused and left out: ${refused.join(' ')}` : '',
    shortened.length ? `Shortened to what the history supports: ${shortened.join(', ')}.` : '',
    dropped ? `${dropped} ${dropped === 1 ? 'row' : 'rows'} without a time or value were dropped.` : '',
  ].filter(Boolean)
  return done({ out }, 3.5 + series.size * 0.6, { note: notes.join(' ') || undefined })
}

/* ---------- Create Asset ---------- */

function runCreateAsset(input: StepInput): StepResult {
  const params = paramsFor('createAsset', input.node.config.params)
  const rows = rowsFromSource(input, params.rowSource)
  if (!rows) return fail('WF_CREATE_ASSET_NO_INPUT', 'The step it reads from hasn’t run yet.')
  if (isMapLayer(params.chartType) && !['map:arcs', 'map:fences'].includes(params.chartType) && !detectGeometry(columnsOf(rows))) {
    return fail('WF_CREATE_ASSET_NO_GEOMETRY', 'No location columns in these rows, so the map has nothing to draw.')
  }
  if (input.stepTest) return done({ out: [...rows] }, 1.2, { note: 'No asset saved for a test run.' })
  const assetId = params.refresh === 'update' ? stableId('ast', input.node.id) : stableId('ast', `${input.node.id}:${input.runId}`)
  return done(
    { out: [{ asset_id: assetId, source_id: stableId('src', assetId), title: params.title ?? 'Workflow Asset', chart_type: params.chartType, row_count: rows.length }] },
    1.8,
    { assetRows: rows },
  )
}

/* ---------- Transforms ---------- */

function runEditFields(input: StepInput): StepResult {
  const params = paramsFor('editFields', input.node.config.params)
  const rows = allRows(input)
  const scope = { rows, ancestors: input.ancestors }
  const out = rows.map((row) => {
    const base: DataRecord = params.keepOthers ? { ...row } : {}
    for (const field of params.remove) delete base[field]
    for (const item of params.assignments) {
      const text = expandTemplate(item.value, { ...scope, row }).text
      base[item.name.trim()] =
        item.type === 'number' ? (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text)) : item.type === 'boolean' ? text.trim().toLowerCase() === 'true' : text
    }
    return base
  })
  return done({ out }, 0.2)
}

export const metricName = (metric: AggregateParams['metrics'][number]) =>
  metric.as.trim() || (metric.fn === 'count' && !metric.field ? 'count' : `${metric.fn}_${metric.field}`)

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`

/** The SQL the guided aggregate compiles to, shown read-only in the panel. */
export function aggregateSql(params: AggregateParams) {
  const metrics = params.metrics.map((metric) => {
    const target = metric.fn === 'count' && !metric.field ? '*' : quote(metric.field || '…')
    const call = metric.fn === 'count_distinct' ? `COUNT(DISTINCT ${target})` : `${metric.fn.toUpperCase()}(${target})`
    return `${call} AS ${quote(metricName(metric))}`
  })
  const keys = params.groupBy.map(quote)
  const select = [...keys, ...metrics].join(', ') || '*'
  return `SELECT ${select}\nFROM input${keys.length ? `\nGROUP BY ${keys.join(', ')}` : ''}`
}

function runAggregate(input: StepInput): StepResult {
  const params = paramsFor('aggregate', input.node.config.params)
  const rows = allRows(input)
  const known = new Set(rows.flatMap((row) => Object.keys(row)))
  const absent = [...params.groupBy, ...params.metrics.map((metric) => metric.field)].find((field) => field && rows.length && !known.has(field))
  if (absent) return fail('WF_TRANSFORM_EXECUTION', `Binder Error: column "${absent}" not found in input.`)
  for (const metric of params.metrics) {
    if (!['sum', 'avg'].includes(metric.fn) || !metric.field) continue
    const text = rows.find((row) => row[metric.field] !== null && row[metric.field] !== undefined && typeof row[metric.field] !== 'number')
    if (text) return fail('WF_TRANSFORM_EXECUTION', `Binder Error: No function matches ${metric.fn}(VARCHAR) for "${metric.field}". Cast it to a number upstream.`)
  }
  const groups = new Map<string, DataRecord[]>()
  for (const row of rows) {
    const key = JSON.stringify(params.groupBy.map((field) => row[field] ?? null))
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  if (!params.groupBy.length && !groups.size) groups.set('[]', [])
  const out = [...groups.entries()].map(([key, members]) => {
    const values = JSON.parse(key) as DataValue[]
    const record: DataRecord = Object.fromEntries(params.groupBy.map((field, index) => [field, values[index]]))
    for (const metric of params.metrics) {
      const column = members.map((row) => row[metric.field]).filter((value): value is Exclude<DataValue, null> => value !== null && value !== undefined)
      const numbers = column.map(Number)
      let value: DataValue
      switch (metric.fn) {
        case 'count':
          value = metric.field ? column.length : members.length
          break
        case 'count_distinct':
          value = new Set(column).size
          break
        case 'sum':
          value = round(numbers.reduce((sum, item) => sum + item, 0), 4)
          break
        case 'avg':
          value = numbers.length ? round(numbers.reduce((sum, item) => sum + item, 0) / numbers.length, 4) : null
          break
        case 'min':
          value = column.length ? column.reduce((low, item) => (item < low ? item : low)) : null
          break
        default:
          value = column.length ? column.reduce((high, item) => (item > high ? item : high)) : null
      }
      record[metricName(metric)] = value
    }
    return record
  })
  return done({ out }, 0.3)
}

const WAIT_SECONDS: Record<WaitUnit, number> = { seconds: 1, minutes: 60, hours: 3600, days: 86_400 }

/* ---------- Agents ---------- */

function agentCost(rows: number, base: number) {
  return round(base + Math.min(rows, 400) * 0.00002, 4)
}

function runClassification(input: StepInput): StepResult {
  const params = paramsFor('dataClassificationAgent', input.node.config.params)
  if (!params.categories.length) return fail('WF_AGENT_EXECUTION', 'classification agent has no categories configured')
  const all = allRows(input)
  const rows = all.slice(0, 2000)
  const tokens = params.categories.map((category) =>
    `${category.name} ${category.example}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  )
  const ports: Ports = Object.fromEntries([...params.categories.map((category) => [category.id, [] as DataRecord[]]), [UNCLASSIFIED, []]])
  for (const row of rows) {
    const text = Object.values(row)
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase()
    const scores = tokens.map((list) => list.filter((token) => text.includes(token)).length)
    const best = Math.max(...scores)
    const index = best > 0 ? scores.indexOf(best) : -1
    const category = params.categories[index]
    ports[category ? category.id : UNCLASSIFIED].push({ ...row, category: category ? category.name : UNCLASSIFIED })
  }
  const batches = Math.ceil(rows.length / 20)
  return done(ports, 6 + batches * 2.5, {
    cost: round(batches * 0.0006, 4),
    note: all.length > 2000 ? `Classified the first 2,000 of ${all.length.toLocaleString()} rows; the cap is 2,000.` : undefined,
  })
}

function insightValue(field: string, rows: readonly DataRecord[], type: string) {
  const data = profile(rows)
  const name = field.toLowerCase()
  const top = data.ranked[0]
  if (/headline|title|summary/.test(name)) {
    return top && data.measure ? `${top.label} drives ${percent(top.value, data.total)}% of ${words(data.measure)}` : `${data.count} rows reviewed, no single driver`
  }
  if (/evidence|detail|support|why/.test(name)) return narrative(rows)
  if (/action|recommend|next/.test(name)) {
    return top ? `Prioritise ${top.label} for follow-up; review the next ${Math.min(2, data.ranked.length - 1)} highest within the week.` : 'No action: nothing stands out.'
  }
  if (/confidence|score/.test(name)) return data.count >= 5 ? 'medium' : 'low'
  return `${type} insight from ${data.count} rows`
}

function runInsight(input: StepInput): StepResult {
  const params = paramsFor('insightGenerator', input.node.config.params)
  const rows = allRows(input)
  const record: DataRecord = Object.fromEntries(params.fields.map((field) => [field, insightValue(field, rows, params.insightType)]))
  record.insightType = params.insightType
  return done({ out: [record] }, 14, { cost: agentCost(rows.length, 0.004) })
}

function runDataAnalyst(input: StepInput): StepResult {
  const rows = allRows(input)
  if (!rows.length) return fail('WF_AGENT_CANNOT_PERFORM', 'The analyst judged the input unusable: no rows reached this step.', 20)
  const data = profile(rows)
  if (!data.measure) return fail('WF_AGENT_CANNOT_PERFORM', 'The analyst judged the input unusable: there is no numeric column to analyse.', 20)
  const threshold = data.mean + data.std
  const outliers = data.ranked.filter((item) => item.value > threshold)
  const measure = words(data.measure)
  const named = outliers.map((item) => `${item.label} (${round(item.value, 1)})`).join(', ')
  /** The engine's verdict shape; `key_metrics` is a JSON object there, so it travels as JSON text here. */
  const verdict: DataRecord = {
    answer: outliers.length
      ? `${outliers.map((item) => item.label).join(', ')} ${outliers.length === 1 ? 'is' : 'are'} above the baseline by more than one standard deviation.`
      : `Every row is within one standard deviation of the ${round(data.mean, 1)} baseline.`,
    classification: null,
    reasoning:
      `Across ${rows.length} rows the ${measure} baseline is ${round(data.mean, 1)} with a standard deviation of ${round(data.std, 1)}, ` +
      `so anything above ${round(threshold, 1)} is an outlier.` +
      (outliers.length ? ` ${named} ${outliers.length === 1 ? 'clears' : 'clear'} it.` : ' No row clears it.'),
    key_metrics: JSON.stringify({
      measure: data.measure,
      baseline: round(data.mean, 1),
      std_dev: round(data.std, 1),
      threshold: round(threshold, 1),
      outliers: outliers.length,
      rows_analysed: rows.length,
    }),
    confidence: rows.length >= 30 ? 'high' : rows.length >= 8 ? 'medium' : 'low',
    caveats:
      rows.length < 30
        ? `Only ${rows.length} rows, so one extreme value moves the baseline; a longer history would firm this up.`
        : 'One standard deviation is a loose cut-off; a seasonal baseline could flag different rows.',
  }
  return done(
    { out: [verdict] },
    48,
    { cost: agentCost(rows.length, 0.012) },
  )
}

const distance = (a: DataRecord, b: DataRecord, lat: string, lng: string, lat2: string, lng2: string) =>
  Math.hypot(Number(a[lat]) - Number(b[lat2]), Number(a[lng]) - Number(b[lng2]))

function runGis(input: StepInput): StepResult {
  const params: GisParams = paramsFor('gisCorrelationAgent', input.node.config.params)
  const wired = input.parents.filter((parent) => NODE_TYPES_BY_ID[parent.typeId]?.category !== 'triggers')
  if (wired.length !== 1 || wired[0].typeId !== 'asset') {
    return fail('WF_GIS_CORRELATION_UPPER_LAYER_NOT_ASSET', 'The upper layer must come straight from an Asset node wired into this one.')
  }
  const bottom = params.bottomRef ? input.ancestors.find((item) => item.id === params.bottomRef) : undefined
  if (!bottom || bottom.typeId !== 'asset') return fail('WF_GIS_CORRELATION_BOTTOM_LAYER_MISSING', 'Choose the land layer: an Asset node upstream of this one.')
  if (bottom.id === wired[0].id) return fail('WF_GIS_CORRELATION_SAME_LAYER', 'The land layer and the upper layer must be different assets.')
  const upper = allRows(input)
  const land = bottom.rows ?? []
  if (!land.length) return fail('WF_GIS_CORRELATION_LAYER_EMPTY', `${bottom.name} has no rows on its last run.`)
  const upperGeo = detectGeometry(columnsOf(upper))
  const landGeo = detectGeometry(columnsOf(land))
  if (upperGeo?.kind !== 'latLng' || landGeo?.kind !== 'latLng') return fail('WF_GIS_CORRELATION_NO_GEOMETRY', 'Both layers need latitude and longitude columns.')
  const classField = params.bottom.class_field || columnsOf(land).find((column) => column.kind === 'string' && column.name !== 'zone')?.name || 'land_type'
  const counts = new Map<string, number>()
  for (const row of upper) {
    const nearest = land.reduce((best, zone) =>
      distance(row, zone, upperGeo.latitude, upperGeo.longitude, landGeo.latitude, landGeo.longitude) <
      distance(row, best, upperGeo.latitude, upperGeo.longitude, landGeo.latitude, landGeo.longitude)
        ? zone
        : best,
    )
    const key = String(nearest[classField] ?? 'Unknown')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [topClass, topCount] = ranked[0] ?? ['—', 0]
  const share = (count: number) => `${count} (${percent(count, upper.length)}%)`
  const upperName = input.ancestors.find((item) => item.id === wired[0].id)?.name ?? 'upper layer'
  const rest = ranked.slice(1).map(([name, count]) => `${name} ${count}`)
  const tied = ranked.slice(1).flatMap(([name, count]) => (count === topCount ? [name] : []))
  /** The engine only keeps the map when nothing after this step would consume it as data. */
  const keepsMap = input.children.every((child) => child === 'asset' || child === 'aiFindings')
  /** The engine's verdict shape: the analyst's six fields plus the method; `key_metrics` travels as JSON text. */
  const verdict: DataRecord = {
    answer:
      `${topCount} of ${upper.length} features (${percent(topCount, upper.length)}%) fall in ${topClass} land` +
      (tied.length ? `, level with ${tied.join(' and ')}.` : '.'),
    method: params.upper.kind === 'wind' ? 'wind_sector_exposure' : params.upper.kind === 'values' ? 'value_by_land_class' : 'point_in_zone_overlay',
    classification: null,
    reasoning:
      `Each of the ${upper.length} features in ${upperName} was matched to its nearest zone in ${bottom.name} by ${words(classField)}. ` +
      `${topClass} takes ${topCount}` +
      (rest.length ? `; the rest split ${rest.join(', ')}.` : ', every one of them.'),
    key_metrics: JSON.stringify(Object.fromEntries(ranked.map(([name, count]) => [name, share(count)]))),
    confidence: upper.length >= 30 ? 'high' : upper.length >= 8 ? 'medium' : 'low',
    caveats: 'Features are matched to the nearest zone centre rather than its boundary, so points near a border can fall in the neighbouring class.',
    ...(keepsMap
      ? { visual_asset_id: stableId('ast', `${input.node.id}:map`) }
      : { visual_warning: 'The map wasn’t kept: it’s only saved when this node ends the Flow or feeds only Asset or AI Findings steps.' }),
  }
  return done({ out: [verdict] }, 62, { cost: agentCost(upper.length, 0.015) })
}

/** An app title from the prompt's subject, e.g. "Build an app on X." reads "X". */
function promptTitle(instructions: string) {
  const subject = instructions
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/^(?:build|create|make|write|draft|prepare)\b.*?\b(?:on|about|covering|for)\s+/i, '')
  return subject && subject.length <= 80 ? subject.charAt(0).toUpperCase() + subject.slice(1) : undefined
}

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

/** The engine's output document for a saved app; every run saves one, test runs included. */
function runApp(input: StepInput): StepResult {
  const params = paramsFor('createApp', input.node.config.params)
  const rows = allRows(input)
  const assets = input.ancestors.filter((ancestor) => isAppAsset(ancestor.typeId) && ancestor.rows?.length)
  if (!rows.length && !assets.length) {
    return fail('WF_OUTPUT_NOT_PERSISTED', 'The agent didn’t draft any pages: no rows or assets reached it, so no app was saved.', 40)
  }
  const ranked = profile(rows).ranked
  const others = ranked.length - 1
  const fallbackTitle = ranked[0] ? (others > 0 ? `${ranked[0].label} and ${others} other ${others === 1 ? 'hotspot' : 'hotspots'}` : ranked[0].label) : 'Workflow results'
  const title = promptTitle(params.instructions) ?? fallbackTitle
  const findings = Math.max(1, Math.min(3, rows.length))
  const pages = findings + 1
  const placed = assets.map((asset) => asset.name)
  const record: DataRecord = {
    created_entity_id: stableId('app', `${input.node.id}:${input.runId}`),
    created_entity_kind: 'app',
    created_entity_title: title,
    navigation: params.navigation,
    pages,
    text:
      `Built “${title}”: an overview page, then ${findings} ${findings === 1 ? 'page' : 'pages'} of findings, ` +
      (params.navigation === 'tabs' ? 'each a tab along the top.' : 'read in order with Next and Back.') +
      (placed.length ? ` It places ${listFormat.format(placed)} beside the findings ${placed.length === 1 ? 'it supports' : 'they support'}.` : ''),
  }
  return done({ out: [record] }, 70, { cost: agentCost(rows.length, 0.02), note: 'Saved as a new app.' })
}

/* ---------- Actions ---------- */

function runChatMessage(input: StepInput): StepResult {
  const params = paramsFor('sendChatMessage', input.node.config.params)
  if (params.mode === 'send_and_wait' && !input.hasChatTrigger) {
    return fail('WF_COMPILE_ACTION_CHAT_WAIT_REQUIRES_CHAT_TRIGGER', 'Send and wait needs a Chat Input trigger in this workflow.')
  }
  const rows = allRows(input)
  const message = expandTemplate(params.message, { rows, ancestors: input.ancestors }).text
  if (!message.trim()) return fail('WF_ACTION_CHAT_MESSAGE_EMPTY', 'The message is empty once its references are filled in.')
  const session = input.triggerTypeId === 'chatInput'
  const record: DataRecord = { mode: params.mode, message, bubble_written: session }
  if (session && params.mode === 'send_and_wait') {
    Object.assign(record, params.responseType === 'approval' ? { response_type: 'approval', response: params.approveLabel, approved: true } : { response_type: 'free_text', response: 'Noted, sending a team tomorrow.' })
  }
  return done({ out: [record] }, session && params.mode === 'send_and_wait' ? 8 : 0.3, {
    note: session ? undefined : 'No chat session in this run, so the step succeeded without writing a bubble.',
  })
}

function runEmail(input: StepInput): StepResult {
  const params = paramsFor('sendEmail', input.node.config.params)
  const scope = { rows: allRows(input), ancestors: input.ancestors }
  const fill = (text: string) => expandTemplate(text, scope).text
  const to = emailList(fill(params.to))
  if (!to.length) return fail('WF_ACTION_EMAIL_TO_EMPTY', 'Add a recipient.')
  const subject = fill(params.subject).replace(/[\r\n]+/g, ' ')
  if (!subject.trim()) return fail('WF_ACTION_EMAIL_SUBJECT_EMPTY', 'Add a subject.')
  const body = fill(params.body)
  if (!body.trim()) return fail('WF_ACTION_EMAIL_BODY_EMPTY', 'Write the email body.')
  return done({ out: [{ simulated: true, to: to.join(', '), cc: emailList(fill(params.cc)).join(', ') || null, subject, body }] }, 0.6, {
    note: 'Builder runs simulate email when no SMTP transport is configured: nothing was sent and no outbound row was written.',
  })
}

function runApiRequest(input: StepInput): StepResult {
  const params = paramsFor('sendApiRequest', input.node.config.params)
  if (params.mode === 'source') {
    const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
    if (!source) return fail('WF_ACTION_API_SOURCE_REQUIRED', 'Select the API connection.')
    return done({ out: [{ status: 202, ok: true, via: source.name, response_body: '{"accepted":true}' }] }, 1.1)
  }
  const scope = { rows: allRows(input), ancestors: input.ancestors }
  const url = expandTemplate(params.url, scope).text
  const issue = urlIssue(url)
  if (issue) return fail(issue.includes('private') ? 'WF_ACTION_API_URL_DISALLOWED' : 'WF_ACTION_API_URL_REQUIRED', issue)
  const body = expandTemplate(params.body, scope).text
  if (body.trim() && !bodyAllowed(params.method)) return fail('WF_ACTION_API_REQUEST_BUILD', `A ${params.method} request can’t carry a body.`)
  const host = new URL(url).hostname
  return done(
    { out: [{ status: params.method === 'POST' ? 201 : 200, ok: true, method: params.method, url, request_body: body || null, response_body: JSON.stringify({ received: true, id: stableId('req', url + body) }) }] },
    0.9,
    { note: `Simulated response from ${host}: the builder doesn’t call external APIs.` },
  )
}

/** One node's work on its input. Configuration problems fail the step the way the compiler would. */
export function executeStep(input: StepInput): StepResult {
  const typeId = input.type.id as KindId
  if (input.type.category === 'triggers') return runTrigger(input)
  const issue = kindIssue(typeId, input.node.config.params)
  if (issue && typeId !== 'aiFindings') return fail('WF_COMPILE_INVALID_CONFIG', `${issue}.`.replace(/\.\.$/, '.'), 0.1)
  const rows = allRows(input)
  switch (typeId) {
    case 'asset': {
      const params = paramsFor('asset', input.node.config.params)
      const asset = params.assetId ? ASSETS_BY_ID[params.assetId] : undefined
      if (!asset) return fail('WF_COMPILE_COMPONENT_MISSING_ID', 'Choose an asset.')
      return done({ out: [...asset.rows] }, 0.9, { note: asset.archived ? 'This asset is archived; it still runs.' : 'Served from the asset cache.' })
    }
    case 'source':
      return runSource(input, paramsFor('source', input.node.config.params))
    case 'mlModel':
      return runMlModel(input)
    case 'forecast':
      return runForecast(input)
    case 'createAsset':
      return runCreateAsset(input)
    case 'noOperation':
      return done({ out: [] }, 0.05)
    case 'filter': {
      const { where } = paramsFor('filter', input.node.config.params)
      return done({ kept: rows.filter((row) => matches(where, row)), discarded: rows.filter((row) => !matches(where, row)) }, 0.15)
    }
    case 'ifElse': {
      const { when } = paramsFor('ifElse', input.node.config.params)
      return done({ true: rows.filter((row) => matches(when, row)), false: rows.filter((row) => !matches(when, row)) }, 0.15)
    }
    case 'switchCases': {
      const params = paramsFor('switchCases', input.node.config.params)
      const ports: Ports = Object.fromEntries([...params.cases.map((item) => [item.id, [] as DataRecord[]]), ['default', []]])
      for (const row of rows) {
        const hits = params.cases.filter((item) => matches(item.when, row))
        const targets = params.sendToAllMatching ? hits : hits.slice(0, 1)
        if (!targets.length) ports.default.push(row)
        for (const item of targets) ports[item.id].push(row)
      }
      return done(ports, 0.2)
    }
    case 'editFields':
      return runEditFields(input)
    case 'aggregate':
      return runAggregate(input)
    case 'merge': {
      const { dedupe } = paramsFor('merge', input.node.config.params)
      const seen = new Set<string>()
      const out = dedupe
        ? rows.filter((row) => {
            const key = JSON.stringify(row)
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
        : [...rows]
      return done({ out }, 0.2)
    }
    case 'wait': {
      const params = paramsFor('wait', input.node.config.params)
      return done({ out: [...rows] }, params.waitFor * WAIT_SECONDS[params.waitUnit])
    }
    case 'stopAndError':
      return fail('WF_STOP_ERROR', paramsFor('stopAndError', input.node.config.params).stopMessage || 'Workflow halted.', 0.05)
    case 'generalAgent':
      return done({ out: [{ kind: 'text', text: narrative(rows) }] }, 24, { cost: agentCost(rows.length, 0.004) })
    case 'dataClassificationAgent':
      return runClassification(input)
    case 'insightGenerator':
      return runInsight(input)
    case 'dataAnalyst':
      return runDataAnalyst(input)
    case 'gisCorrelationAgent':
      return runGis(input)
    case 'createApp':
      return runApp(input)
    case 'aiFindings':
      if (issue) return fail('WF_COMPILE_AI_FINDINGS_INVALID', `${issue}.`)
      return done({}, 0.05, { note: 'Findings are written for runs of the published Flow, not for test runs from the builder. Publish the Flow and run it to see its finding here.' })
    case 'sendChatMessage':
      return runChatMessage(input)
    case 'sendEmail':
      return runEmail(input)
    case 'sendApiRequest':
      return runApiRequest(input)
    default:
      return done({ out: [...rows] }, 0.1)
  }
}

/* ---------- Run planning ---------- */

/** Rows a run left on one port, or on its first port that carries any. */
export function runRows(run: NodeRun | undefined, portId?: string): readonly DataRecord[] | null {
  if (!run?.ports) return null
  if (portId) return run.ports[portId] ?? null
  const ports = Object.values(run.ports)
  return ports.find((rows) => rows.length) ?? ports[0] ?? null
}

/** A unique `{{alias}}` per node, from its name. */
export function nodeAliases(nodes: readonly CanvasNode[]) {
  const used = new Map<string, number>()
  return Object.fromEntries(
    nodes.map((node) => {
      const base = slug(nodeName(node, NODE_TYPES_BY_ID[node.type]))
      const count = (used.get(base) ?? 0) + 1
      used.set(base, count)
      return [node.id, count === 1 ? base : `${base}_${count}`]
    }),
  )
}

function ancestorIds(id: string, edges: readonly WorkflowEdge[]) {
  const seen: string[] = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift() as string
    for (const edge of edges) {
      if (edge.to === current && !seen.includes(edge.from) && edge.from !== id) {
        seen.push(edge.from)
        queue.push(edge.from)
      }
    }
  }
  return seen
}

export type RunPlanInput = {
  nodes: readonly CanvasNode[]
  edges: readonly WorkflowEdge[]
  /** Nodes to execute, parents first. */
  order: readonly string[]
  previous: Readonly<Record<string, NodeRun>>
  fixtures: Readonly<Record<string, DataRecord[]>>
  /** Set for flow runs: the trigger that fired. Without one, every trigger edge counts as fired. */
  triggerId?: string
  /** Builder step tests: nothing is saved or sent, and a missing input is an error rather than a skip. */
  stepTest?: boolean
  /** Forced outcomes from the Run agent menu. */
  simulate?: 'pass' | 'fail'
  forcedFailure?: string
}

export type PlannedStep = { id: string; run: NodeRun }

/** Branches are channels a node can leave empty; an empty one is skipped unless the node always outputs data. */
const isBranching = (node: CanvasNode, type: NodeType) => nodeOutputs(node, type).length > 1

/**
 * Executes the nodes in order against each other's outputs. A node runs when every wired input it
 * depends on arrived; otherwise it is skipped, the way a failed step's downstream or an untaken branch is.
 */
export function planRun(plan: RunPlanInput): PlannedStep[] {
  const byId = new Map(plan.nodes.map((node) => [node.id, node]))
  const aliases = nodeAliases(plan.nodes)
  const results: Record<string, NodeRun> = { ...plan.previous }
  const runId = stableId('run', `${plan.order.join()}:${Date.now()}`)
  const hasChatTrigger = plan.nodes.some((node) => node.type === 'chatInput')
  const triggerTypeId = plan.triggerId ? byId.get(plan.triggerId)?.type : undefined
  const stepTest = plan.stepTest ?? !plan.triggerId
  const steps: PlannedStep[] = []
  /** The Stop and Error node that fired; every step after it in the order is skipped, on any branch. */
  let haltedBy: string | undefined

  for (const id of plan.order) {
    const node = byId.get(id)
    if (!node) continue
    const type = NODE_TYPES_BY_ID[node.type]
    if (haltedBy) {
      const run: NodeRun = { status: 'skipped', message: `Skipped: ${haltedBy} stopped the run.` }
      results[id] = run
      steps.push({ id, run })
      continue
    }
    const settings = nodeSettings(node)
    const inbound = plan.edges.filter((edge) => edge.to === id)
    const isTriggerEdge = (edge: WorkflowEdge) => NODE_TYPES_BY_ID[byId.get(edge.from)?.type ?? '']?.category === 'triggers'
    const arrived = (edge: WorkflowEdge) => {
      if (isTriggerEdge(edge)) return !plan.triggerId || edge.from === plan.triggerId
      return results[edge.from]?.ports?.[edge.fromPort] !== undefined
    }

    let inputs: Record<string, DataRecord[]> = {}
    let waiting: string | undefined
    const fixture = plan.fixtures[id]
    if (fixture && type.inputs.length) {
      inputs = { [type.inputs[0].id]: [...fixture] }
    } else if (type.category !== 'triggers') {
      const data = inbound.filter((edge) => !isTriggerEdge(edge))
      const triggerEdges = inbound.filter(isTriggerEdge)
      const missing = data.find((edge) => !arrived(edge))
      if (missing) {
        const from = results[missing.from]
        const fromNode = byId.get(missing.from) as CanvasNode
        const fromType = NODE_TYPES_BY_ID[fromNode.type]
        const fromName = nodeName(fromNode, fromType)
        const branch = nodeOutputs(fromNode, fromType).find((port) => port.id === missing.fromPort)?.label ?? missing.fromPort
        waiting =
          from?.status === 'error'
            ? `Skipped: ${fromName} failed.`
            : from?.status === 'skipped'
              ? `Skipped: ${fromName} was skipped.`
              : from?.status === 'success'
                ? `Skipped: the ${branch} branch of ${fromName} sent no rows.`
                : `No input yet: execute ${fromName} first.`
      } else if (!data.length && triggerEdges.length && !triggerEdges.some(arrived)) {
        waiting = 'Skipped: the trigger wired into it didn’t fire.'
      } else if (!inbound.length && type.inputs.length && !['source', 'asset'].includes(type.id)) {
        waiting = 'Nothing is connected to this node’s input.'
      }
      for (const edge of data) {
        const rows = results[edge.from]?.ports?.[edge.fromPort]
        if (rows) inputs[edge.toPort] = [...(inputs[edge.toPort] ?? []), ...rows]
      }
    }

    if (waiting) {
      const run: NodeRun = waiting.startsWith('Skipped')
        ? { status: 'skipped', message: waiting }
        : { status: 'error', message: waiting, code: 'WF_STEP_NO_INPUT', durationMs: 0 }
      results[id] = run
      steps.push({ id, run })
      continue
    }

    const ancestors: Ancestor[] = ancestorIds(id, plan.edges).flatMap((ancestorId) => {
      const ancestor = byId.get(ancestorId)
      if (!ancestor) return []
      return [{ id: ancestorId, name: nodeName(ancestor, NODE_TYPES_BY_ID[ancestor.type]), alias: aliases[ancestorId], typeId: ancestor.type, rows: runRows(results[ancestorId]) }]
    })
    const parents = inbound.map((edge) => ({ id: edge.from, typeId: byId.get(edge.from)?.type ?? '' }))
    const children = plan.edges.filter((edge) => edge.from === id).map((edge) => byId.get(edge.to)?.type ?? '')
    const input: StepInput = { node, type, inputs, parents, children, ancestors, triggerTypeId, hasChatTrigger, stepTest, runId }

    let result = executeStep(input)
    if (plan.simulate === 'pass' && !result.ok) result = done({ [nodeOutputs(node, type)[0]?.id ?? 'out']: allRows(input) }, result.seconds)
    if (id === plan.forcedFailure && result.ok) result = fail('WF_SIMULATED', 'Simulated failure', result.seconds)
    if (result.ok && settings.timeoutSeconds && result.seconds > settings.timeoutSeconds) {
      result = fail('WF_STEP_TIMEOUT', `Timed out after ${settings.timeoutSeconds}s; the step needed about ${Math.ceil(result.seconds)}s.`, settings.timeoutSeconds)
    }

    let run: NodeRun
    if (result.ok) {
      const branching = isBranching(node, type)
      const ports = Object.fromEntries(
        Object.entries(result.ports).filter(([, rows]) => !branching || rows.length > 0 || settings.alwaysOutputData),
      )
      const items = branching ? Object.values(result.ports).reduce((sum, rows) => sum + rows.length, 0) : Object.values(result.ports)[0]?.length
      run = { status: 'success', ports, items, cost: result.cost, durationMs: Math.round(result.seconds * 1000), note: result.note, assetRows: result.assetRows }
    } else {
      const attempts = settings.retryOnFail ? settings.retryMaxAttempts : 1
      const seconds = result.seconds * attempts + (attempts - 1) * settings.retryDelaySeconds
      const message = attempts > 1 ? `${result.message} (failed ${attempts} attempts)` : result.message
      const outputs = nodeOutputs(node, type)
      const ports =
        settings.onError === 'continue'
          ? Object.fromEntries(outputs.map((port) => [port.id, [] as DataRecord[]]))
          : settings.onError === 'errorOutput' && outputs[0]
            ? { [outputs[0].id]: [{ error: true, node_id: id, error_code: result.code, error_message: result.message }] }
            : undefined
      run = { status: 'error', message, code: result.code, attempts, durationMs: Math.round(seconds * 1000), cost: result.cost, ports }
    }
    results[id] = run
    steps.push({ id, run })
    if (node.type === 'stopAndError' && run.status === 'error') haltedBy = nodeName(node, type)
  }
  return steps
}
