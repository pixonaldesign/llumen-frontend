import { useId } from 'react'
import { Bell, Lightbulb, MapTrifold, Robot, Stack, Tag } from '@phosphor-icons/react'
import { evaluateRule, MEASURE_LABEL, ROW_MEASURES, type RuleVerdict } from './alerts'
import { Card, Field, NumberInput, Select, SwitchRow, type SelectOption } from './ConfigControls'
import { inputClass } from './configStyles'
import { OPERATORS, operatorSpec, type Operator } from './conditions'
import { columnsOf } from './createAsset'
import { plural, stepColumns, useFocusItem, type EditorContext, type EditorProps } from './kindEditor'
import { AddButton, ColumnSelect, Notice, RemoveButton, Segmented, TemplateField, TextAreaField } from './KindControls'
import {
  BOTTOM_LABEL,
  uid,
  UNCLASSIFIED,
  UPPER_LABEL,
  type AiFindingsParams,
  type AlertCondition,
  type AlertMeasure,
  type AlertRule,
  type BottomLayerKind,
  type Category,
  type ClassificationParams,
  type GisParams,
  type InsightParams,
  type InsightType,
  type InstructionsParams,
  type UpperLayerKind,
} from './nodeKinds'
import styles from './KindConfig.module.css'
import windowStyles from './NodeConfigWindow.module.css'

const ABOUT: Record<string, string> = {
  generalAgent: 'Answers in a text document, grounded in the rows it receives.',
  dataClassificationAgent: 'Sorts each row into one category; each category is its own output.',
  insightGenerator: 'Writes one insight with the fields you name, from the rows it receives.',
  dataAnalyst: 'Returns a verdict document. If the data can’t answer the question, the step fails with WF_AGENT_CANNOT_PERFORM.',
  gisCorrelationAgent: 'Overlays the wired layer on a land layer and says how they relate.',
  slidesAgent: 'Builds a slide deck from its input. Flow runs save the deck; test runs only preview it.',
  dashboardAgent: 'Returns a text document laying out the dashboard: KPIs, charts, and what each shows.',
  briefingAgent: 'Writes a briefing from its input. Flow runs save it; test runs only preview it.',
}

function InstructionsCard({ params, set, ctx, placeholder }: EditorProps<InstructionsParams> & { placeholder?: string }) {
  return (
    <Card icon={<Robot size={16} aria-hidden />} title="Instructions" description={ABOUT[ctx.type.id]}>
      <TemplateField
        label="Instructions"
        required
        multiline
        rows={5}
        value={params.instructions}
        references={ctx.references}
        placeholder={placeholder ?? 'What should the agent do with this data?'}
        error={params.instructions.trim() ? undefined : 'Enter instructions for the agent.'}
        hint="{{alias.field}} inserts an earlier step’s values when the step runs."
        onChange={(instructions) => set({ instructions }, 'instructions')}
      />
    </Card>
  )
}

export function AgentInstructionsConfig(props: EditorProps<InstructionsParams>) {
  return <InstructionsCard {...props} />
}

/* ---------- Classification ---------- */

const RESERVED = ['default', UNCLASSIFIED]

export function ClassificationConfig({ params, set, ctx }: EditorProps<ClassificationParams>) {
  const update = (id: string, patch: Partial<Category>, key: string) =>
    set({ categories: params.categories.map((item) => (item.id === id ? { ...item, ...patch } : item)) }, `category:${id}:${key}`)
  const names = params.categories.map((item) => item.name.trim().toLowerCase())
  const focusProps = useFocusItem(ctx.focus)
  return (
    <>
      <InstructionsCard params={params} set={set} ctx={ctx} placeholder="e.g. Classify each site by the land use around it." />
      <Card icon={<Tag size={16} aria-hidden />} title="Categories" description="Rows that fit none go to Unclassified. Up to 2,000 rows a run, in batches of 20.">
        <div className={styles.list}>
          {params.categories.map((item, index) => {
            const name = item.name.trim().toLowerCase()
            const error = !name
              ? 'Name the category.'
              : RESERVED.includes(name)
                ? `“${item.name}” is reserved.`
                : names.indexOf(name) !== index
                  ? 'Another category has this name.'
                  : undefined
            return (
              <div key={item.id} className={styles.item} {...focusProps(item.id)}>
                <div className={styles.itemHead}>
                  <span className={styles.itemIndex}>{index + 1}</span>
                  <input
                    className={inputClass}
                    value={item.name}
                    maxLength={60}
                    placeholder="Category name"
                    aria-label="Category name"
                    aria-invalid={Boolean(error) || undefined}
                    onChange={(event) => update(item.id, { name: event.target.value }, 'name')}
                  />
                  <RemoveButton
                    label={`Remove ${item.name || 'category'}`}
                    onClick={() => set({ categories: params.categories.filter((other) => other.id !== item.id) }, `category:${item.id}:remove`)}
                  />
                </div>
                <input
                  className={inputClass}
                  value={item.example}
                  placeholder="Example, e.g. Mussafah, ICAD"
                  aria-label="Example"
                  onChange={(event) => update(item.id, { example: event.target.value }, 'example')}
                />
                {error ? <p className={windowStyles.error}>{error}</p> : null}
              </div>
            )
          })}
          <AddButton onClick={() => set({ categories: [...params.categories, { id: uid('cat'), name: `Category ${params.categories.length + 1}`, example: '' }] }, 'addCategory')}>
            Add category
          </AddButton>
        </div>
      </Card>
    </>
  )
}

/* ---------- Insight ---------- */

const INSIGHT_TYPES: readonly SelectOption<InsightType>[] = [
  { id: 'summary', label: 'Summary', description: 'What the data says, in brief.' },
  { id: 'trend', label: 'Trend', description: 'What is rising or falling, and how fast.' },
  { id: 'anomaly', label: 'Anomaly', description: 'What stands out from the rest.' },
  { id: 'recommendation', label: 'Recommendation', description: 'What to do next, and why.' },
]

export function InsightConfig({ params, set, ctx }: EditorProps<InsightParams>) {
  return (
    <>
      <InstructionsCard params={params} set={set} ctx={ctx} />
      <Card icon={<Lightbulb size={16} aria-hidden />} title="Insight" description="The output is one row with these fields; later steps read them as {{alias.field}}.">
        <Field label="Type">
          <Select label="Insight type" value={params.insightType} options={INSIGHT_TYPES} onChange={(insightType) => set({ insightType }, 'insightType')} />
        </Field>
        <Field label="Output fields" required>
          <div className={styles.list}>
            {params.fields.map((field, index) => (
              <div key={index} className={styles.singleRow}>
                <input
                  className={`${inputClass} ${styles.mono}`}
                  value={field}
                  placeholder="field_name"
                  aria-label={`Field ${index + 1}`}
                  aria-invalid={!field.trim() || undefined}
                  onChange={(event) => set({ fields: params.fields.map((item, other) => (other === index ? event.target.value.replace(/\s+/g, '_') : item)) }, `field:${index}`)}
                />
                <RemoveButton label="Remove field" disabled={params.fields.length === 1} onClick={() => set({ fields: params.fields.filter((_, other) => other !== index) }, `field:${index}:remove`)} />
              </div>
            ))}
            <AddButton onClick={() => set({ fields: [...params.fields, ''] }, 'addField')}>Add field</AddButton>
          </div>
        </Field>
      </Card>
    </>
  )
}

/* ---------- GIS correlation ---------- */

const UPPER_OPTIONS = (Object.keys(UPPER_LABEL) as UpperLayerKind[]).map((id) => ({ id, label: UPPER_LABEL[id] }))
const BOTTOM_OPTIONS = (Object.keys(BOTTOM_LABEL) as BottomLayerKind[]).map((id) => ({ id, label: BOTTOM_LABEL[id] }))

export function GisConfig({ params, set, ctx }: EditorProps<GisParams>) {
  const wired = ctx.upstream.filter((step) => step.direct && step.category !== 'triggers')
  const upper = wired.length === 1 ? wired[0] : undefined
  const upperError = !wired.length
    ? 'Wire an Asset node into this one; it’s the upper layer.'
    : wired.length > 1
      ? 'Only one layer can be wired in; the land layer is chosen below.'
      : upper?.typeId !== 'asset'
        ? `${upper?.name} isn’t an Asset node. The upper layer must come straight from one.`
        : undefined
  const assets = ctx.upstream.filter((step) => step.typeId === 'asset' && step.id !== upper?.id)
  const bottom = ctx.upstream.find((step) => step.id === params.bottomRef)
  const upperColumns = upper?.records ? columnsOf(upper.records) : []
  const landColumns = stepColumns(ctx.upstream, params.bottomRef)

  return (
    <>
      <InstructionsCard params={params} set={set} ctx={ctx} />
      <Card icon={<Stack size={16} aria-hidden />} title="Upper layer" description={upper ? `From ${upper.name}, wired in.` : 'The Asset node wired into this one.'}>
        {upperError ? <Notice tone="error">{upperError}</Notice> : null}
        <Field label="It shows">
          <Segmented label="Upper layer kind" value={params.upper.kind} options={UPPER_OPTIONS} onChange={(kind) => set({ upper: { kind } }, 'upper:kind')} />
        </Field>
        {params.upper.kind === 'values' ? (
          <Field label="Value column">
            <ColumnSelect label="Value column" value={params.upper.value_field} columns={upperColumns} onChange={(value_field) => set({ upper: { ...params.upper, value_field } }, 'upper:value')} />
          </Field>
        ) : params.upper.kind === 'wind' ? (
          <div className={windowStyles.fieldRow}>
            <Field label="Speed column">
              <ColumnSelect label="Speed column" value={params.upper.speed_field} columns={upperColumns} onChange={(speed_field) => set({ upper: { ...params.upper, speed_field } }, 'upper:speed')} />
            </Field>
            <Field label="Direction column">
              <ColumnSelect
                label="Direction column"
                value={params.upper.direction_field}
                columns={upperColumns}
                onChange={(direction_field) => set({ upper: { ...params.upper, direction_field } }, 'upper:direction')}
              />
            </Field>
          </div>
        ) : null}
      </Card>
      <Card icon={<MapTrifold size={16} aria-hidden />} title="Land layer" description="A whole-output reference to another Asset node upstream.">
        <Field label="Land layer" required error={params.bottomRef && !bottom ? 'That step is no longer upstream.' : undefined}>
          <Select
            label="Land layer"
            value={bottom ? params.bottomRef : undefined}
            options={assets.map((step) => ({ id: step.id, label: step.name, meta: step.records ? plural(step.records.length, 'row') : 'Not run' }))}
            placeholder={assets.length ? 'Choose an Asset node' : 'No other Asset node upstream'}
            invalid={!bottom}
            onChange={(bottomRef) => set({ bottomRef, bottom: { kind: params.bottom.kind } }, 'bottomRef')}
          />
        </Field>
        <Field label="It shows">
          <Segmented label="Land layer kind" value={params.bottom.kind} options={BOTTOM_OPTIONS} onChange={(kind) => set({ bottom: { kind } }, 'bottom:kind')} />
        </Field>
        {params.bottom.kind === 'land_type' ? (
          <Field label="Land class column" hint="Empty uses the first text column.">
            <ColumnSelect label="Land class column" value={params.bottom.class_field} columns={landColumns} noneLabel="Detect" onChange={(class_field) => set({ bottom: { ...params.bottom, class_field } }, 'bottom:class')} />
          </Field>
        ) : (
          <Field label="Value column">
            <ColumnSelect label="Value column" value={params.bottom.value_field} columns={landColumns} onChange={(value_field) => set({ bottom: { ...params.bottom, value_field } }, 'bottom:value')} />
          </Field>
        )}
      </Card>
    </>
  )
}

/* ---------- AI Findings ---------- */

const MEASURE_OPTIONS: readonly SelectOption<AlertMeasure>[] = (Object.keys(MEASURE_LABEL) as AlertMeasure[]).map((id) => ({ id, label: MEASURE_LABEL[id] }))
const OPERATOR_OPTIONS: readonly SelectOption<Operator>[] = OPERATORS.map((spec) => ({ id: spec.id, label: spec.label, group: spec.group }))
const NUMBER_OPERATORS: readonly SelectOption<Operator>[] = OPERATOR_OPTIONS.filter((option) => option.group === 'Number')
const LEVELS = [
  { id: 'critical_alert', label: 'Critical alert' },
  { id: 'alert', label: 'Alert' },
] as const

const VERDICT_TEXT: Record<RuleVerdict, string> = {
  fires: 'Would raise on the last run',
  quiet: 'Quiet on the last run',
  unknown: 'Needs a run to check',
}

export function AiFindingsConfig({ params, set, ctx }: EditorProps<AiFindingsParams>) {
  const alerts = params.alerts
  const setAlerts = (patch: Partial<AiFindingsParams['alerts']>, key: string) => set({ alerts: { ...alerts, ...patch } }, `alerts:${key}`)
  const updateRule = (id: string, patch: Partial<AlertRule>, key: string) =>
    setAlerts({ rules: alerts.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) }, `rule:${id}:${key}`)
  const rowsFor = (id: string) => ctx.upstream.find((step) => step.id === id)?.records ?? null

  return (
    <>
      <Card icon={<Lightbulb size={16} aria-hidden />} title="Findings" description="Writes findings from the whole run after it succeeds. It ends the flow and passes nothing on.">
        <TextAreaField
          label="What to focus on"
          rows={4}
          maxLength={1000}
          value={params.instructions}
          placeholder="e.g. Flag sites near residential land first."
          hint="Optional. Read by the findings agent, not by the steps."
          onChange={(instructions) => set({ instructions }, 'instructions')}
        />
      </Card>
      <Card icon={<Bell size={16} aria-hidden />} title="Alerts">
        <SwitchRow
          label="This Flow can raise alerts"
          description="Rules decide the level; the findings agent can confirm or lower it, never raise it."
          checked={alerts.enabled}
          onChange={(enabled) => setAlerts({ enabled }, 'enabled')}
        />
        {alerts.enabled ? (
          <>
            <TextAreaField
              label="What counts as an alert"
              rows={3}
              maxLength={500}
              value={alerts.criteria}
              placeholder="e.g. PM10 forecast above 150 µg/m³ near a school."
              onChange={(criteria) => setAlerts({ criteria }, 'criteria')}
            />
            <div className={styles.list}>
              {alerts.rules.map((rule) => (
                <AlertRuleEditor
                  key={rule.id}
                  rule={rule}
                  ctx={ctx}
                  verdict={evaluateRule(rule, rowsFor)}
                  onChange={(patch, key) => updateRule(rule.id, patch, key)}
                  onRemove={() => setAlerts({ rules: alerts.rules.filter((other) => other.id !== rule.id) }, `rule:${rule.id}:remove`)}
                />
              ))}
              <AddButton
                onClick={() =>
                  setAlerts(
                    { rules: [...alerts.rules, { id: uid('rule'), label: `Rule ${alerts.rules.length + 1}`, level: 'alert', combinator: 'and', conditions: [] }] },
                    'addRule',
                  )
                }
              >
                Add rule
              </AddButton>
            </div>
          </>
        ) : null}
      </Card>
    </>
  )
}

type AlertRuleEditorProps = {
  rule: AlertRule
  ctx: EditorContext
  verdict: RuleVerdict
  onChange: (patch: Partial<AlertRule>, key: string) => void
  onRemove: () => void
}

function AlertRuleEditor({ rule, ctx, verdict, onChange, onRemove }: AlertRuleEditorProps) {
  const hoursId = useId()
  const update = (id: string, patch: Partial<AlertCondition>, key: string) =>
    onChange({ conditions: rule.conditions.map((condition) => (condition.id === id ? ({ ...condition, ...patch } as AlertCondition) : condition)) }, `${id}:${key}`)
  const sources = ctx.upstream.filter((step) => step.category !== 'triggers')
  const sourceOptions: SelectOption<string>[] = sources.map((step) => ({ id: step.id, label: step.name, meta: step.records ? plural(step.records.length, 'row') : 'Not run' }))

  return (
    <div className={styles.item}>
      <div className={styles.itemHead}>
        <input className={inputClass} value={rule.label} placeholder="Rule name" aria-label="Rule name" maxLength={60} onChange={(event) => onChange({ label: event.target.value }, 'label')} />
        <span className={`${styles.verdict} ${verdict === 'unknown' ? '' : styles[`verdict_${verdict}`]}`}>{VERDICT_TEXT[verdict]}</span>
        <RemoveButton label={`Remove ${rule.label || 'rule'}`} onClick={onRemove} />
      </div>
      <Segmented label="Level" value={rule.level} options={LEVELS} onChange={(level) => onChange({ level }, 'level')} />
      {rule.conditions.map((condition, index) => (
        <div key={condition.id} className={styles.list}>
          {index > 0 ? (
            <div className={styles.joiner}>
              <button type="button" className={styles.joinerToggle} onClick={() => onChange({ combinator: rule.combinator === 'and' ? 'or' : 'and' }, 'combinator')}>
                {rule.combinator.toUpperCase()}
              </button>
            </div>
          ) : null}
          {condition.type === 'forecast_event' ? (
            <div className={styles.pairRow}>
              <Field label="Within" htmlFor={hoursId}>
                <NumberInput id={hoursId} value={condition.withinHours} min={1} max={72} unit="hours" onChange={(withinHours) => update(condition.id, { withinHours: withinHours ?? 24 }, 'hours')} />
              </Field>
              <Field label="A coming event">
                <input className={inputClass} value={condition.event} placeholder="e.g. a sandstorm" onChange={(event) => update(condition.id, { event: event.target.value }, 'event')} />
              </Field>
              <RemoveButton label="Remove condition" onClick={() => onChange({ conditions: rule.conditions.filter((other) => other.id !== condition.id) }, `${condition.id}:remove`)} />
            </div>
          ) : (
            <>
              <div className={styles.pairRow}>
                <Select label="Step" value={condition.sourceNodeId} options={sourceOptions} placeholder="Step" invalid={!condition.sourceNodeId} onChange={(sourceNodeId) => update(condition.id, { sourceNodeId, field: '' }, 'source')} />
                <Select
                  label="Measure"
                  value={condition.measure}
                  options={MEASURE_OPTIONS}
                  onChange={(measure) =>
                    update(
                      condition.id,
                      { measure, operator: ROW_MEASURES.includes(measure) || operatorSpec(condition.operator).group === 'Number' ? condition.operator : 'number__greater_than' },
                      'measure',
                    )
                  }
                />
                <RemoveButton label="Remove condition" onClick={() => onChange({ conditions: rule.conditions.filter((other) => other.id !== condition.id) }, `${condition.id}:remove`)} />
              </div>
              <div className={condition.measure === 'row_count' ? styles.pairRow : styles.tripleRow}>
                {condition.measure === 'row_count' ? null : (
                  <ColumnSelect label="Field" value={condition.field} columns={stepColumns(ctx.upstream, condition.sourceNodeId)} placeholder="Field" invalid={!condition.field} onChange={(field) => update(condition.id, { field }, 'field')} />
                )}
                <Select
                  label="Operator"
                  value={condition.operator}
                  options={ROW_MEASURES.includes(condition.measure) ? OPERATOR_OPTIONS : NUMBER_OPERATORS}
                  onChange={(operator) => update(condition.id, { operator }, 'operator')}
                />
                {operatorSpec(condition.operator).unary ? (
                  <span />
                ) : (
                  <input className={inputClass} value={condition.value} placeholder="Value" aria-label="Value" onChange={(event) => update(condition.id, { value: event.target.value }, 'value')} />
                )}
                <span />
              </div>
            </>
          )}
        </div>
      ))}
      <div className={styles.addRow}>
        <AddButton
          onClick={() =>
            onChange(
              { conditions: [...rule.conditions, { id: uid('ac'), type: 'data', sourceNodeId: sources[0]?.id, field: '', measure: 'any_row', operator: 'number__greater_than', value: '' }] },
              'addData',
            )
          }
        >
          Data condition
        </AddButton>
        <AddButton onClick={() => onChange({ conditions: [...rule.conditions, { id: uid('ac'), type: 'forecast_event', withinHours: 24, event: '' }] }, 'addEvent')}>
          Coming event
        </AddButton>
      </div>
    </div>
  )
}
