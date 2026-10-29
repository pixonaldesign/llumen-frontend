import { useId } from 'react'
import {
  Brain,
  ChartLine,
  ChartLineUp,
  Database,
  FileXls,
  FlowArrow,
  Globe,
  MapTrifold,
  Storefront,
  Table,
  TrendUp,
  type Icon,
} from '@phosphor-icons/react'
import { Card, Field, NumberInput, Select, type SelectOption } from './ConfigControls'
import { columnsOf } from './createAsset'
import { ML_MODELS, SAVED_ASSETS, SOURCES, SOURCES_BY_ID, previewOf, type SourceMode } from './flowData'
import type { AssetPreview } from './nodeCatalog'
import { plural, stepColumns, type EditorContext, type EditorProps } from './kindEditor'
import { ColumnChips, ColumnSelect, Notice, Segmented, TemplateField, TextField } from './KindControls'
import { forecastGate, forecastHistory } from './nodeRuntime'
import {
  GRAIN_LABEL,
  REFUSAL_LABEL,
  type AssetParams,
  type ForecastGrain,
  type ForecastParams,
  type ForecastRefusal,
  type MlModelParams,
  type SourceParams,
} from './nodeKinds'
import styles from './KindConfig.module.css'
import windowStyles from './NodeConfigWindow.module.css'

/* ---------- Asset ---------- */

const assetIcon = (preview: AssetPreview) =>
  preview === 'map' ? <MapTrifold size={14} aria-hidden /> : preview === 'table' ? <Table size={14} aria-hidden /> : <ChartLine size={14} aria-hidden />
export function AssetConfig({ params, set }: EditorProps<AssetParams>) {
  const asset = SAVED_ASSETS.find((item) => item.id === params.assetId)
  const options: SelectOption<string>[] = SAVED_ASSETS.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.detail,
    meta: item.archived ? 'Archived' : plural(item.rows.length, 'row'),
    icon: assetIcon(previewOf(item.view.chartType)),
  }))
  const columns = asset ? columnsOf(asset.rows) : []
  return (
    <Card icon={<ChartLineUp size={16} aria-hidden />} title="Asset" description="Reads a saved chart, table, or map layer’s rows into the flow.">
      <Field label="Asset" required>
        <Select label="Asset" value={params.assetId} options={options} placeholder="Choose an asset" invalid={!asset} onChange={(assetId) => set({ assetId }, 'assetId')} />
      </Field>
      {asset?.archived ? <Notice tone="warn">This asset is archived. It still runs, but it’s hidden from the asset library and won’t get new data.</Notice> : null}
      {asset ? (
        <dl className={styles.readout}>
          <div>
            <dt>Type</dt>
            <dd>{asset.detail}</dd>
          </div>
          <div>
            <dt>Rows</dt>
            <dd>{asset.rows.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Columns</dt>
            <dd title={columns.map((column) => column.name).join(', ')}>{columns.map((column) => column.name).join(', ')}</dd>
          </div>
        </dl>
      ) : null}
    </Card>
  )
}

/* ---------- Source ---------- */

const MODES: readonly { id: SourceMode; label: string; icon: Icon }[] = [
  { id: 'query', label: 'Database', icon: Database },
  { id: 'api_request', label: 'API request', icon: Globe },
  { id: 'file', label: 'File', icon: FileXls },
  { id: 'dataflow', label: 'ETL Flow', icon: FlowArrow },
  { id: 'marketplace', label: 'Marketplace', icon: Storefront },
]

const MODE_HINT: Record<SourceMode, string> = {
  query: 'Runs a read-only SQL query. {{alias.field}} inserts an earlier step’s values as quoted literals.',
  api_request: 'Calls one of the connection’s endpoints. Query-string keys filter the matching columns; limit caps the rows.',
  file: 'Reads one sheet of an uploaded file.',
  dataflow: 'Reads the latest output of an ETL Flow.',
  marketplace: 'Calls a marketplace operation with the parameters below.',
}

export function SourceConfig({ params, set, ctx }: EditorProps<SourceParams>) {
  const source = params.sourceId ? SOURCES_BY_ID[params.sourceId] : undefined
  const matching = SOURCES.filter((item) => item.mode === params.mode)
  const sourceOptions: SelectOption<string>[] = matching.map((item) => ({ id: item.id, label: item.name, meta: item.detail }))

  /** Choosing a source also picks its first request, sheet, dataset, or operation. */
  const sourcePatch = (sourceId: string | undefined): Partial<SourceParams> => {
    const next = sourceId ? SOURCES_BY_ID[sourceId] : undefined
    return {
      sourceId,
      endpointId: next?.endpoints?.[0]?.id,
      sheet: next?.sheets ? Object.keys(next.sheets)[0] : undefined,
      datasetId: next?.datasets?.[0]?.id,
      operationId: next?.operations?.[0]?.id,
      operationParams: {},
    }
  }
  const pickSource = (sourceId: string) => set(sourcePatch(sourceId), 'sourceId')

  return (
    <>
      <Card icon={<Database size={16} aria-hidden />} title="Source type" description={MODE_HINT[params.mode]}>
        <div className={styles.modeGrid} role="radiogroup" aria-label="Source type">
          {MODES.map((mode) => {
            const ModeIcon = mode.icon
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={params.mode === mode.id}
                className={styles.modeCard}
                onClick={() => {
                  if (mode.id === params.mode) return
                  set({ mode: mode.id, ...sourcePatch(SOURCES.find((item) => item.mode === mode.id)?.id) }, 'mode')
                }}
              >
                <span className={styles.modeIcon}>
                  <ModeIcon size={16} aria-hidden />
                </span>
                {mode.label}
              </button>
            )
          })}
        </div>
      </Card>
      <Card icon={<Table size={16} aria-hidden />} title="Connection">
        <Field label="Source" required>
          <Select
            label="Source"
            value={source?.mode === params.mode ? params.sourceId : undefined}
            options={sourceOptions}
            placeholder={matching.length ? 'Select a source' : 'No sources of this type'}
            invalid={!source}
            onChange={pickSource}
          />
        </Field>
        {source && source.mode === params.mode ? <SourceDetail params={params} set={set} ctx={ctx} /> : null}
      </Card>
    </>
  )
}

function SourceDetail({ params, set, ctx }: EditorProps<SourceParams>) {
  const source = SOURCES_BY_ID[params.sourceId ?? '']
  switch (params.mode) {
    case 'query': {
      const tables = Object.entries(source.tables ?? {})
      return (
        <>
          <TemplateField
            label="Query"
            required
            multiline
            mono
            rows={6}
            value={params.query}
            references={ctx.references}
            placeholder={tables[0] ? `SELECT * FROM ${tables[0][0]} LIMIT 100` : 'SELECT …'}
            error={/\b(drop|alter|insert|update|delete|truncate|grant)\b/i.test(params.query) ? 'Queries are read-only; this statement will be rejected.' : undefined}
            onChange={(query) => set({ query }, 'query')}
          />
          <dl className={styles.readout} aria-label="Tables">
            {tables.map(([name, rows]) => (
              <div key={name}>
                <dt>
                  <code className={styles.hintCode}>{name}</code>
                </dt>
                <dd title={columnsOf(rows).map((column) => column.name).join(', ')}>
                  {plural(rows.length, 'row')} · {columnsOf(rows).map((column) => column.name).join(', ')}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )
    }
    case 'api_request': {
      const endpoints = source.endpoints ?? []
      return (
        <>
          <Field label="Request" required>
            <Select
              label="Request"
              value={params.endpointId}
              options={endpoints.map((endpoint) => ({ id: endpoint.id, label: endpoint.name, meta: `${endpoint.method} ${endpoint.path} · ${plural(endpoint.rows.length, 'row')}` }))}
              onChange={(endpointId) => set({ endpointId }, 'endpointId')}
            />
          </Field>
          <TemplateField
            label="Query string"
            mono
            value={params.queryString}
            references={ctx.references}
            placeholder="district=Mussafah&limit=10"
            onChange={(queryString) => set({ queryString }, 'queryString')}
          />
        </>
      )
    }
    case 'file': {
      const sheets = Object.entries(source.sheets ?? {})
      return (
        <Field label="Sheet" required>
          <Select
            label="Sheet"
            value={params.sheet}
            options={sheets.map(([name, rows]) => ({ id: name, label: name, meta: plural(rows.length, 'row') }))}
            onChange={(sheet) => set({ sheet }, 'sheet')}
          />
        </Field>
      )
    }
    case 'dataflow':
      return (
        <Field label="Dataset" required>
          <Select
            label="Dataset"
            value={params.datasetId}
            options={(source.datasets ?? []).map((dataset) => ({ id: dataset.id, label: dataset.name, meta: plural(dataset.rows.length, 'row') }))}
            onChange={(datasetId) => set({ datasetId }, 'datasetId')}
          />
        </Field>
      )
    default: {
      const operation = source.operations?.find((item) => item.id === params.operationId)
      return (
        <>
          <Field label="Operation" required>
            <Select
              label="Operation"
              value={params.operationId}
              options={(source.operations ?? []).map((item) => ({ id: item.id, label: item.label }))}
              onChange={(operationId) => set({ operationId, operationParams: {} }, 'operationId')}
            />
          </Field>
          {operation?.parameters.map((parameter) => (
            <TextField
              key={parameter.key}
              label={parameter.label}
              value={params.operationParams[parameter.key] ?? ''}
              placeholder={parameter.placeholder}
              onChange={(value) => set({ operationParams: { ...params.operationParams, [parameter.key]: value } }, `operation:${parameter.key}`)}
            />
          ))}
        </>
      )
    }
  }
}

/* ---------- ML Model ---------- */

const CONNECTED = 'input'

/** Data from: the wired input, or an earlier step's whole output. */
export function RowSourceField({ value, ctx, onChange }: { value: string | undefined; ctx: EditorContext; onChange: (id: string | undefined) => void }) {
  const connected = ctx.upstream.find((step) => step.direct)
  const options: SelectOption<string>[] = [
    { id: CONNECTED, label: 'Connected input', meta: connected?.name ?? 'Not connected' },
    ...ctx.upstream.filter((step) => !step.direct).map((step) => ({ id: step.id, label: step.name, group: 'Earlier steps', meta: step.records ? plural(step.records.length, 'row') : 'Not run' })),
  ]
  return (
    <Field label="Data from">
      <Select label="Data from" value={value ?? CONNECTED} options={options} onChange={(id) => onChange(id === CONNECTED ? undefined : id)} />
    </Field>
  )
}

export function MlModelConfig({ params, set, ctx }: EditorProps<MlModelParams>) {
  const model = ML_MODELS.find((item) => item.id === params.modelId)
  const columns = params.rowSource ? stepColumns(ctx.upstream, params.rowSource) : ctx.columns
  return (
    <>
      <Card icon={<Brain size={16} aria-hidden />} title="Model" description="Scores every row with a registered model and adds prediction and probability columns.">
        <Field label="Model" required>
          <Select
            label="Model"
            value={params.modelId}
            options={ML_MODELS.map((item) => ({ id: item.id, label: item.name, meta: item.version, description: `Predicts ${item.labels[1]} or ${item.labels[0]}` }))}
            placeholder="Select a model"
            invalid={!model}
            onChange={(modelId) => set({ modelId, featureMapping: {} }, 'modelId')}
          />
        </Field>
        <RowSourceField value={params.rowSource} ctx={ctx} onChange={(rowSource) => set({ rowSource }, 'rowSource')} />
        <Notice>Batch prediction takes up to 50,000 rows; more fails the step.</Notice>
      </Card>
      {model ? (
        <Card icon={<Table size={16} aria-hidden />} title="Feature mapping" description="Each feature reads the column of the same name unless you map another.">
          {model.features.map((feature) => {
            const mapped = params.featureMapping[feature]
            const column = mapped || feature
            const missing = columns.length > 0 && !columns.some((item) => item.name === column)
            return (
              <Field key={feature} label={feature} error={missing ? `No “${column}” column in the input.` : undefined}>
                <ColumnSelect
                  label={feature}
                  value={mapped}
                  columns={columns}
                  noneLabel={`Same name: ${feature}`}
                  invalid={missing}
                  onChange={(value) => set({ featureMapping: { ...params.featureMapping, [feature]: value } }, `feature:${feature}`)}
                />
              </Field>
            )
          })}
        </Card>
      ) : null}
    </>
  )
}

/* ---------- Forecast ---------- */

const GRAIN_OPTIONS = (Object.keys(GRAIN_LABEL) as ForecastGrain[]).map((id) => ({ id, label: GRAIN_LABEL[id] }))
const REFUSAL_OPTIONS: readonly SelectOption<ForecastRefusal>[] = [
  { id: 'fail', label: REFUSAL_LABEL.fail, description: 'Any refused series fails the step.' },
  { id: 'pass_through_empty', label: REFUSAL_LABEL.pass_through_empty, description: 'Refused series are left out; the step fails only when none is forecast.' },
  { id: 'shorten_to_supported', label: REFUSAL_LABEL.shorten_to_supported, description: 'A series asked too far ahead is forecast as far as its history allows.' },
]

export function ForecastConfig({ params, set, ctx }: EditorProps<ForecastParams>) {
  const horizonId = useId()
  const numbers = ctx.columns.filter((column) => column.kind === 'number')
  const history = ctx.records ? forecastHistory(ctx.records, params) : []
  const verdicts = history.map((series) => ({ ...series, gate: forecastGate(series.points, params.grain, params.horizon) }))
  const refused = verdicts.filter((series) => !series.gate.allowed)
  const word = GRAIN_LABEL[params.grain].toLowerCase()
  return (
    <>
      <Card icon={<Table size={16} aria-hidden />} title="Columns">
        <div className={windowStyles.fieldRow}>
          <Field label="Time column" required>
            <ColumnSelect label="Time column" value={params.timeColumn} columns={ctx.columns} invalid={!params.timeColumn} onChange={(timeColumn) => set({ timeColumn }, 'timeColumn')} />
          </Field>
          <Field label="Value to forecast" required>
            <ColumnSelect
              label="Value to forecast"
              value={params.targetColumn}
              columns={numbers}
              invalid={!params.targetColumn}
              onChange={(targetColumn) => set({ targetColumn }, 'targetColumn')}
            />
          </Field>
        </div>
        <Field label="One forecast per" hint="Optional. Each combination of these columns is its own series, forecast on its own.">
          <ColumnChips
            label="Series columns"
            value={params.seriesIdColumns ?? []}
            columns={ctx.columns.filter((column) => column.name !== params.timeColumn && column.name !== params.targetColumn)}
            onChange={(columns) => set({ seriesIdColumns: columns.length ? columns : undefined }, 'seriesIdColumns')}
          />
        </Field>
      </Card>
      <Card icon={<TrendUp size={16} aria-hidden />} title="Forecast" description="Values in the same period are summed. Rows with no time or value are dropped.">
        <Field label="Period">
          <Segmented label="Period" value={params.grain} options={GRAIN_OPTIONS} onChange={(grain) => set({ grain }, 'grain')} />
        </Field>
        <Field label="Periods ahead" htmlFor={horizonId}>
          <NumberInput id={horizonId} value={params.horizon} min={1} max={500} unit={`${word}s`} onChange={(horizon) => set({ horizon: horizon ?? 1 }, 'horizon')} />
        </Field>
        <Field label="When a series can’t be forecast">
          <Select label="When a series can’t be forecast" value={params.onRefuse} options={REFUSAL_OPTIONS} onChange={(onRefuse) => set({ onRefuse }, 'onRefuse')} />
        </Field>
        {!ctx.records ? (
          <Notice>Run the step before this one to check its history against these settings.</Notice>
        ) : !verdicts.length ? (
          <Notice tone="warn">Choose the time and value columns to check the history.</Notice>
        ) : refused.length ? (
          <Notice tone={params.onRefuse === 'fail' || refused.length === verdicts.length ? 'error' : 'warn'}>
            {refused.length === verdicts.length ? 'No series can be forecast' : `${refused.length} of ${plural(verdicts.length, 'series', 'series')} can’t be forecast`}:{' '}
            {refused[0].id === 'all' ? refused[0].gate.reason : `${refused[0].id} — ${refused[0].gate.reason}`}
          </Notice>
        ) : (
          <Notice tone="success">
            {plural(verdicts.length, 'series', 'series')} with {Math.min(...verdicts.map((series) => series.points))}+ {word}s of history; up to{' '}
            {Math.min(...verdicts.map((series) => series.gate.maxHorizon))} {word}s ahead is supported.
          </Notice>
        )}
        <p className={windowStyles.hint}>
          Outputs TS, FORECAST, LOWER_BOUND, UPPER_BOUND, SERIES_ID, and IS_HISTORY, with the history rows first.
        </p>
      </Card>
    </>
  )
}
