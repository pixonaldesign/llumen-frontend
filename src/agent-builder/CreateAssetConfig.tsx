import { useId, useState, type ReactNode } from 'react'
import {
  ArrowsClockwise,
  ChartBar,
  ChartDonut,
  ChartLine,
  ChartLineUp,
  ChartScatter,
  CheckCircle,
  CircleNotch,
  Compass,
  CubeFocus,
  Database,
  Gauge,
  MapPin,
  NumberSquareOne,
  Rows,
  Sparkle,
  Table,
  WarningCircle,
} from '@phosphor-icons/react'
import { AssetPreviewChart } from './AssetPreviewChart'
import { Card, Field, Select, type SelectOption } from './ConfigControls'
import { buttonClass, inputClass } from './configStyles'
import {
  CHART_CHOICES,
  chartChoice,
  columnsOf,
  detectGeometry,
  detectsGeometry,
  isMapLayer,
  missingMapping,
  remapForChart,
  suggestAsset,
  type AssetRefresh,
  type CreateAssetSettings,
} from './createAsset'
import { ColumnKindIcon } from './DataViews'
import { NodeAssetPreview } from './NodeAssetPreview'
import type { DataRecord, NodeRun } from './nodeCatalog'
import styles from './NodeConfigWindow.module.css'

const TITLE_MAX = 120
const CONNECTED_INPUT = 'input'

const CHART_ICONS: Record<string, ReactNode> = {
  table: <Table size={16} aria-hidden />,
  kpi_card: <NumberSquareOne size={16} aria-hidden />,
  gauge: <Gauge size={16} aria-hidden />,
  bar: <ChartBar size={16} aria-hidden />,
  horizontal_bar: <Rows size={16} aria-hidden />,
  progress_bar: <Rows size={16} aria-hidden />,
  pie: <ChartDonut size={16} aria-hidden />,
  line: <ChartLine size={16} aria-hidden />,
  area: <ChartLineUp size={16} aria-hidden />,
  range: <ChartLineUp size={16} aria-hidden />,
  scatter: <ChartScatter size={16} aria-hidden />,
  polar: <Compass size={16} aria-hidden />,
}

const CHART_OPTIONS: readonly SelectOption<string>[] = CHART_CHOICES.map((choice) => ({
  id: choice.id,
  label: choice.label,
  group: choice.group,
  icon: CHART_ICONS[choice.id] ?? <MapPin size={16} aria-hidden />,
}))

const REFRESH_OPTIONS: readonly SelectOption<AssetRefresh>[] = [
  {
    id: 'update',
    label: 'Create it once, then keep it updated',
    description: 'Later runs refresh the same asset and keep edits made to it in the asset editor.',
  },
  { id: 'new', label: 'Create a new asset every run', description: 'Each run saves a separate asset.' },
]

/** An ancestor this node can read its rows from instead of the wired input. */
export type RowSourceOption = { id: string; label: string; icon: ReactNode; meta: string }

type CreateAssetConfigProps = {
  settings: CreateAssetSettings
  onChange: (patch: Partial<CreateAssetSettings>, key: string) => void
  /** Rows from the chosen source; null until it has run. */
  records: readonly DataRecord[] | null
  /** The wired input's node, for the Data from default. */
  connectedName: string | null
  ancestors: readonly RowSourceOption[]
  run: NodeRun
  onRunUpstream: () => void
}

export function CreateAssetConfig({ settings, onChange, records, connectedName, ancestors, run, onRunUpstream }: CreateAssetConfigProps) {
  const titleId = useId()
  const [titleTouched, setTitleTouched] = useState(false)
  const choice = chartChoice(settings.chartType)
  const columns = records ? columnsOf(records) : []
  const map = isMapLayer(settings.chartType)
  const titleMissing = !settings.title?.trim()

  const columnOptions: SelectOption<string>[] = columns.map((column) => ({
    id: column.name,
    label: column.name,
    icon: <ColumnKindIcon kind={column.kind} size={12} />,
  }))

  const sourceOptions: SelectOption<string>[] = [
    { id: CONNECTED_INPUT, label: 'Connected input', meta: connectedName ?? 'Not connected', icon: <Database size={16} aria-hidden /> },
    ...ancestors.map((ancestor) => ({ ...ancestor, group: 'Earlier steps' })),
  ]

  const suggest = () => {
    if (!records) return
    setTitleTouched(true)
    onChange(suggestAsset(records), 'suggest')
  }

  return (
    <>
      <Card
        icon={<CubeFocus size={16} aria-hidden />}
        title="Produced asset"
        description={
          run.status === 'success' && !run.assetRows ? 'Preview of this run’s rows — a test run saves no asset. Run the workflow to produce one.' : undefined
        }
      >
        <ProducedAsset settings={settings} records={records} run={run} />
      </Card>

      <Card icon={<Database size={16} aria-hidden />} title="Data from" description="The rows the asset is built from.">
        <Select
          label="Data from"
          value={settings.rowSource ?? CONNECTED_INPUT}
          options={sourceOptions}
          onChange={(id) => onChange({ rowSource: id === CONNECTED_INPUT ? undefined : id, mapping: {} }, 'rowSource')}
        />
      </Card>

      <Card
        icon={<ChartBar size={16} aria-hidden />}
        title="Asset settings"
        action={
          <button
            type="button"
            className={buttonClass(undefined, 'small')}
            disabled={columns.length === 0}
            title={columns.length === 0 ? 'Run the steps before this one so there are columns to read.' : undefined}
            onClick={suggest}
          >
            <Sparkle size={14} weight="fill" aria-hidden />
            Suggest title &amp; chart type
          </button>
        }
      >
        <Field
          label="Title"
          htmlFor={titleId}
          required
          meta={`${settings.title?.length ?? 0}/${TITLE_MAX}`}
          error={titleTouched && titleMissing ? 'Give the asset a title.' : undefined}
        >
          <input
            id={titleId}
            className={inputClass}
            value={settings.title ?? ''}
            maxLength={TITLE_MAX}
            placeholder="e.g. Anomalies by site"
            aria-invalid={titleTouched && titleMissing}
            onChange={(event) => onChange({ title: event.target.value || undefined }, 'title')}
            onBlur={() => setTitleTouched(true)}
          />
        </Field>

        <Field label="Chart Type" required>
          <Select
            label="Chart Type"
            value={settings.chartType}
            options={CHART_OPTIONS}
            onChange={(chartType) => onChange({ chartType, mapping: remapForChart(settings, chartType) }, 'chartType')}
          />
        </Field>

        {map ? (
          <MapGeometry chartType={settings.chartType} records={records} onDetect={onRunUpstream} />
        ) : choice.fields.length ? (
          <div className={styles.fieldGrid}>
            {choice.fields.map((field) => {
              const mapped = settings.mapping[field.key]
              const options =
                mapped && !columns.some((column) => column.name === mapped)
                  ? [...columnOptions, { id: mapped, label: mapped, meta: columns.length ? 'Not in input' : undefined }]
                  : columnOptions
              return (
                <Field key={field.key} label={field.label} required>
                  <Select
                    label={field.label}
                    value={mapped}
                    options={options}
                    placeholder={columns.length ? 'Choose a column' : 'No columns yet'}
                    disabled={columns.length === 0}
                    onChange={(column) => onChange({ mapping: { ...settings.mapping, [field.key]: column } }, `mapping:${field.key}`)}
                  />
                </Field>
              )
            })}
          </div>
        ) : (
          <p className={styles.hint}>A table shows every column, so there is nothing to map.</p>
        )}
        {!map && choice.fields.length > 0 && columns.length === 0 ? (
          <p className={styles.hint}>Run the steps before this one to list their columns here.</p>
        ) : null}

        <Field label="When this runs again">
          <Select
            label="When this runs again"
            value={settings.refresh}
            options={REFRESH_OPTIONS}
            onChange={(refresh) => onChange({ refresh }, 'refresh')}
          />
        </Field>
        <p className={styles.hint}>{REFRESH_OPTIONS.find((option) => option.id === settings.refresh)?.description}</p>
      </Card>
    </>
  )
}

function ProducedAsset({ settings, records, run }: { settings: CreateAssetSettings; records: readonly DataRecord[] | null; run: NodeRun }) {
  if (run.status === 'running') {
    return (
      <div className={styles.assetEmpty}>
        <CircleNotch className={styles.spin} size={20} aria-hidden />
        <p>Building the asset…</p>
      </div>
    )
  }
  if (run.status === 'error') {
    return (
      <div className={`${styles.assetEmpty} ${styles.assetError}`}>
        <WarningCircle size={20} aria-hidden />
        <p>{run.message ?? 'The last run failed.'}</p>
      </div>
    )
  }
  if (run.status !== 'success' || !records?.length) {
    return (
      <div className={styles.assetEmpty}>
        <CubeFocus size={20} aria-hidden />
        <p>Run this node to preview the asset it produces.</p>
      </div>
    )
  }
  if (isMapLayer(settings.chartType)) {
    return detectGeometry(columnsOf(records)) ? (
      <div className={styles.assetMap}>
        <NodeAssetPreview kind="map" interactive bare />
      </div>
    ) : (
      <div className={`${styles.assetEmpty} ${styles.assetError}`}>
        <WarningCircle size={20} aria-hidden />
        <p>No location columns in these rows, so the map has nothing to draw.</p>
      </div>
    )
  }
  const missing = missingMapping(settings)
  if (missing.length) {
    return (
      <div className={styles.assetEmpty}>
        {CHART_ICONS[settings.chartType]}
        <p>Choose the {missing.map((field) => field.label).join(' and ')} to preview this chart.</p>
      </div>
    )
  }
  return (
    <div className={styles.assetPreview}>
      {settings.title?.trim() ? <p className={styles.assetTitle}>{settings.title}</p> : null}
      <AssetPreviewChart settings={settings} records={records} />
    </div>
  )
}

/** Maps take no axis fields; their geometry is read from the upstream columns. */
function MapGeometry({ chartType, records, onDetect }: { chartType: string; records: readonly DataRecord[] | null; onDetect: () => void }) {
  const geometry = records ? detectGeometry(columnsOf(records)) : null
  const status = !records ? (
    <p className={styles.hint}>Not set. Columns are detected from the previous step’s last run, so run it once first.</p>
  ) : !detectsGeometry(chartType) ? (
    <p className={styles.hint}>
      {chartType === 'map:arcs' ? 'Arcs need an origin and a destination' : 'Fences need a path'}; pick them in the asset editor after the first
      run.
    </p>
  ) : geometry ? (
    <p className={styles.detected}>
      <CheckCircle size={14} weight="fill" aria-hidden />
      {geometry.kind === 'column' ? (
        <>
          Location from <code>{geometry.column}</code>
        </>
      ) : (
        <>
          Location from <code>{geometry.latitude}</code> and <code>{geometry.longitude}</code>
        </>
      )}
    </p>
  ) : (
    <p className={styles.error}>No location columns found. Add a latitude and longitude, or a location or geometry column.</p>
  )
  return (
    <div className={styles.geometry}>
      <div className={styles.geometryHead}>
        <span className={styles.label}>Geometry</span>
        <button type="button" className={buttonClass(undefined, 'small')} onClick={onDetect}>
          <ArrowsClockwise size={14} aria-hidden />
          Detect columns
        </button>
      </div>
      {status}
      <p className={styles.hint}>Map layers take no axis fields; styling uses the platform defaults.</p>
    </div>
  )
}
