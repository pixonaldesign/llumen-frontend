import { useContext, useId } from 'react'
import { ArrowsMerge, Clock, Code, DotsSixVertical, Funnel, GitFork, Hand, Minus, PencilSimple, Rows, Sigma, SignOut } from '@phosphor-icons/react'
import { Card, Field, NumberInput, Select, SwitchRow, type SelectOption } from './ConfigControls'
import { inputClass, ShowMissing } from './configStyles'
import { ConditionEditor } from './ConditionEditor'
import { matches, type ConditionGroup } from './conditions'
import { conditionFields, plural, useFocusItem, type ConditionFields, type EditorProps } from './kindEditor'
import { AddButton, ColumnChips, ColumnSelect, Notice, RemoveButton, TextAreaField } from './KindControls'
import { aggregateSql, metricName } from './nodeRuntime'
import { useSortable } from './useSortable'
import {
  FN_LABEL,
  uid,
  WAIT_UNIT_WORD,
  type AggregateFn,
  type AggregateParams,
  type Assignment,
  type EditFieldsParams,
  type FieldType,
  type FilterParams,
  type IfElseParams,
  type MergeParams,
  type Metric,
  type StopParams,
  type SwitchCase,
  type SwitchParams,
  type WaitParams,
  type WaitUnit,
} from './nodeKinds'
import styles from './KindConfig.module.css'
import windowStyles from './NodeConfigWindow.module.css'

/** How many of the last input's rows the conditions keep, or nothing before a run. */
function MatchCount({ group, fields: { records, scope }, yes, no }: { group: ConditionGroup; fields: ConditionFields; yes: string; no: string }) {
  if (!records) return <p className={styles.count}>Run the step before this one to see how many rows match.</p>
  const kept = records.filter((row) => matches(group, row, scope)).length
  return (
    <p className={styles.count}>
      On the last input: {plural(kept, 'row')} {yes}, {plural(records.length - kept, 'row')} {no}.
    </p>
  )
}

export function FilterConfig({ params, set, ctx }: EditorProps<FilterParams>) {
  const fields = conditionFields(ctx)
  return (
    <Card icon={<Funnel size={16} aria-hidden />} title="Keep rows where" description="Only the rows that pass go on; the rest are dropped">
      <ConditionEditor label="Filter conditions" group={params.where} fields={fields} onChange={(where, key) => set({ where }, `where:${key}`)} />
      <MatchCount group={params.where} fields={fields} yes="kept" no="dropped" />
    </Card>
  )
}

export function IfElseConfig({ params, set, ctx }: EditorProps<IfElseParams>) {
  const fields = conditionFields(ctx)
  return (
    <Card icon={<GitFork size={16} aria-hidden />} title="If" description="Rows that match go down True; the rest go down False. Only branches that get rows run">
      <ConditionEditor label="If conditions" group={params.when} fields={fields} onChange={(when, key) => set({ when }, `when:${key}`)} />
      <MatchCount group={params.when} fields={fields} yes="go down True" no="go down False" />
    </Card>
  )
}

const ROUTING: readonly SelectOption<'first' | 'all'>[] = [
  { id: 'first', label: 'First matching case', description: 'Each row goes to the first case it matches' },
  { id: 'all', label: 'Every matching case', description: 'A row goes to every case it matches' },
]

export function SwitchConfig({ params, set, ctx }: EditorProps<SwitchParams>) {
  const updateCase = (id: string, patch: Partial<SwitchCase>, key: string) =>
    set({ cases: params.cases.map((item) => (item.id === id ? { ...item, ...patch } : item)) }, `case:${id}:${key}`)
  const focusProps = useFocusItem(ctx.focus)
  const fields = conditionFields(ctx)
  const sortable = useSortable(
    params.cases.map((item) => item.id),
    (from, to) => {
      const cases = [...params.cases]
      cases.splice(to, 0, ...cases.splice(from, 1))
      set({ cases }, 'reorderCases')
    },
  )

  const counts = ctx.records
    ? (() => {
        const tally: Record<string, number> = { default: 0 }
        for (const row of ctx.records) {
          const hits = params.cases.filter((item) => matches(item.when, row, fields.scope))
          const targets = params.sendToAllMatching ? hits : hits.slice(0, 1)
          if (!targets.length) tally.default += 1
          for (const item of targets) tally[item.id] = (tally[item.id] ?? 0) + 1
        }
        return tally
      })()
    : null

  return (
    <>
      <Card
        icon={<GitFork size={16} aria-hidden />}
        title="Routing"
        description="Rows no case matches go to Default"
        action={
          <div className={styles.headSelect}>
            <Select
              label="Routing"
              value={params.sendToAllMatching ? 'all' : 'first'}
              options={ROUTING}
              onChange={(value) => set({ sendToAllMatching: value === 'all' }, 'sendToAllMatching')}
            />
          </div>
        }
      />
      <Card icon={<Rows size={16} aria-hidden />} title="Cases" description="Each case is its own output. Removing one also removes its edges">
        <div className={styles.list}>
          {params.cases.map((item, index) => (
            <div key={item.id} className={styles.sortItem} {...sortable.itemProps(item.id)}>
              <div className={styles.item} {...focusProps(item.id)}>
                <div className={styles.itemHead}>
                  <button
                    type="button"
                    className={`${styles.itemIndex} ${styles.dragHandle}`}
                    aria-label={`Move ${item.label || `case ${index + 1}`}`}
                    title="Drag to reorder"
                    disabled={params.cases.length < 2}
                    {...sortable.handleProps(item.id)}
                  >
                    <span className={styles.handleNumber}>{index + 1}</span>
                    <DotsSixVertical className={styles.handleIcon} size={14} weight="bold" aria-hidden />
                  </button>
                  <input
                    className={`${inputClass} ${styles.caseName}`}
                    value={item.label}
                    maxLength={40}
                    aria-label="Case name"
                    placeholder={`Case ${index + 1}`}
                    onChange={(event) => updateCase(item.id, { label: event.target.value }, 'label')}
                  />
                  {counts ? <span className={styles.count}>{plural(counts[item.id] ?? 0, 'row')}</span> : null}
                  <RemoveButton
                    label={`Remove ${item.label || 'case'}`}
                    onClick={() => set({ cases: params.cases.filter((other) => other.id !== item.id) }, `case:${item.id}:remove`)}
                  />
                </div>
                <ConditionEditor
                  label={`${item.label} conditions`}
                  group={item.when}
                  fields={fields}
                  onChange={(when, key) => updateCase(item.id, { when }, `when:${key}`)}
                />
              </div>
            </div>
          ))}
          <div className={`${styles.item} ${styles.defaultCase}`}>
            <div className={styles.itemHead}>
              <span className={styles.itemIndex}>–</span>
              <span className={styles.caseTitle}>Default</span>
              {counts ? <span className={styles.count}>{plural(counts.default, 'row')}</span> : null}
            </div>
          </div>
          <div className={styles.addRow}>
            <AddButton
              onClick={() => {
                let number = params.cases.length + 1
                while (params.cases.some((item) => item.id === `case${number}`)) number += 1
                set({ cases: [...params.cases, { id: `case${number}`, label: `Case ${number}`, when: { combinator: 'and', conditions: [] } }] }, 'addCase')
              }}
            >
              Add case
            </AddButton>
          </div>
        </div>
      </Card>
    </>
  )
}

const TYPE_OPTIONS: readonly SelectOption<FieldType>[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'boolean', label: 'Boolean' },
]

export function EditFieldsConfig({ params, set, ctx }: EditorProps<EditFieldsParams>) {
  const update = (id: string, patch: Partial<Assignment>, key: string) =>
    set({ assignments: params.assignments.map((item) => (item.id === id ? { ...item, ...patch } : item)) }, `assignment:${id}:${key}`)
  const showMissing = useContext(ShowMissing)
  return (
    <>
      <Card icon={<PencilSimple size={16} aria-hidden />} title="Set fields" description="Adds or overwrites a column on every row. Values take {{field}} from the same row">
        <div className={styles.list}>
          {params.assignments.map((item) => (
            <div key={item.id} className={styles.tripleRow}>
              <input className={inputClass} value={item.name} placeholder="Field name" aria-label="Field name" aria-invalid={(showMissing && !item.name.trim()) || undefined} onChange={(event) => update(item.id, { name: event.target.value }, 'name')} />
              <Select label="Type" value={item.type} options={TYPE_OPTIONS} onChange={(type) => update(item.id, { type }, 'type')} />
              <input
                className={inputClass}
                value={item.value}
                placeholder={item.type === 'boolean' ? 'true or false' : item.type === 'number' ? '0' : 'Value or {{field}}'}
                aria-label="Value"
                onChange={(event) => update(item.id, { value: event.target.value }, 'value')}
              />
              <RemoveButton label="Remove field" onClick={() => set({ assignments: params.assignments.filter((other) => other.id !== item.id) }, `assignment:${item.id}:remove`)} />
            </div>
          ))}
          <AddButton onClick={() => set({ assignments: [...params.assignments, { id: uid('a'), name: '', type: 'text', value: '' }] }, 'addAssignment')}>Add field</AddButton>
        </div>
        <SwitchRow
          label="Keep the other fields"
          description={params.keepOthers ? 'Rows keep every incoming column' : 'Rows keep only the fields set here'}
          checked={params.keepOthers}
          onChange={(keepOthers) => set({ keepOthers }, 'keepOthers')}
        />
      </Card>
      <Card icon={<Minus size={16} aria-hidden />} title="Remove fields">
        <ColumnChips label="Fields to remove" value={params.remove} columns={ctx.columns} addLabel="Remove a column" onChange={(remove) => set({ remove }, 'remove')} />
      </Card>
    </>
  )
}

const FN_OPTIONS: readonly SelectOption<AggregateFn>[] = (Object.keys(FN_LABEL) as AggregateFn[]).map((id) => ({ id, label: FN_LABEL[id] }))
const NUMERIC_FNS: readonly AggregateFn[] = ['sum', 'avg']

export function AggregateConfig({ params, set, ctx }: EditorProps<AggregateParams>) {
  const update = (id: string, patch: Partial<Metric>, key: string) =>
    set({ metrics: params.metrics.map((item) => (item.id === id ? { ...item, ...patch } : item)) }, `metric:${id}:${key}`)
  const textMetric = params.metrics.find(
    (metric) => NUMERIC_FNS.includes(metric.fn) && ctx.columns.find((column) => column.name === metric.field)?.kind === 'string',
  )
  return (
    <>
      <Card icon={<Rows size={16} aria-hidden />} title="Group by" description="One output row per combination. With no group, everything is one row">
        <ColumnChips label="Group by" value={params.groupBy} columns={ctx.columns} onChange={(groupBy) => set({ groupBy }, 'groupBy')} />
      </Card>
      <Card icon={<Sigma size={16} aria-hidden />} title="Metrics">
        <div className={styles.list}>
          {params.metrics.map((metric) => (
            <div key={metric.id} className={styles.tripleRow}>
              <Select label="Function" value={metric.fn} options={FN_OPTIONS} onChange={(fn) => update(metric.id, { fn }, 'fn')} />
              <ColumnSelect
                label="Field"
                value={metric.field}
                columns={ctx.columns}
                noneLabel={metric.fn === 'count' ? 'All rows' : undefined}
                placeholder="Field"
                invalid={metric.fn !== 'count' && !metric.field}
                onChange={(field) => update(metric.id, { field }, 'field')}
              />
              <input className={inputClass} value={metric.as} placeholder={metricName({ ...metric, as: '' })} aria-label="Output name" onChange={(event) => update(metric.id, { as: event.target.value }, 'as')} />
              <RemoveButton label="Remove metric" onClick={() => set({ metrics: params.metrics.filter((other) => other.id !== metric.id) }, `metric:${metric.id}:remove`)} />
            </div>
          ))}
          <AddButton onClick={() => set({ metrics: [...params.metrics, { id: uid('m'), fn: 'count', field: '', as: '' }] }, 'addMetric')}>Add metric</AddButton>
        </div>
        {textMetric ? (
          <Notice tone="error">
            {FN_LABEL[textMetric.fn]} needs numbers, but <code>{textMetric.field}</code> is text; the run will fail with a binder error.
          </Notice>
        ) : null}
      </Card>
      <Card icon={<Code size={16} aria-hidden />} title="SQL" description="What runs against the input rows">
        <pre className={styles.sql}>{aggregateSql(params)}</pre>
      </Card>
    </>
  )
}

export function MergeConfig({ params, set, ctx }: EditorProps<MergeParams>) {
  const inputs = ctx.upstream.filter((step) => step.direct)
  return (
    <Card icon={<ArrowsMerge size={16} aria-hidden />} title="Merge" description="Appends each input’s rows in order: Input 1, then Input 2, and so on, up to 10 inputs. It waits for all of them; if any sends nothing, Merge is skipped">
      {inputs.length ? (
        <dl className={styles.readout}>
          {inputs.map((step) => (
            <div key={step.id}>
              <dt>{step.name}</dt>
              <dd>{step.records ? plural(step.records.length, 'row') : 'Not run'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <SwitchRow
        label="Drop duplicate rows"
        description="Rows whose every column matches an earlier row are left out"
        checked={params.dedupe}
        onChange={(dedupe) => set({ dedupe }, 'dedupe')}
      />
    </Card>
  )
}

const WAIT_OPTIONS: readonly SelectOption<WaitUnit>[] = (Object.keys(WAIT_UNIT_WORD) as WaitUnit[]).map((id) => ({ id, label: `${WAIT_UNIT_WORD[id][0].toUpperCase()}${WAIT_UNIT_WORD[id].slice(1)}s` }))

export function WaitConfig({ params, set }: EditorProps<WaitParams>) {
  const id = useId()
  return (
    <Card icon={<Clock size={16} aria-hidden />} title="Wait" description="Pauses this branch, then passes its rows on unchanged">
      <div className={windowStyles.fieldRow}>
        <Field label="Wait for" htmlFor={id} required>
          <NumberInput id={id} value={params.waitFor} min={1} max={10_000} onChange={(waitFor) => set({ waitFor: waitFor ?? 1 }, 'waitFor')} />
        </Field>
        <Field label="Unit">
          <Select label="Unit" value={params.waitUnit} options={WAIT_OPTIONS} onChange={(waitUnit) => set({ waitUnit }, 'waitUnit')} />
        </Field>
      </div>
      <Notice>The step’s timeout in Settings counts the wait, so keep it longer than this.</Notice>
    </Card>
  )
}

export function StopAndErrorConfig({ params, set }: EditorProps<StopParams>) {
  return (
    <Card icon={<SignOut size={16} aria-hidden />} title="Stop and error" description="Fails the run here with code WF_STOP_ERROR and stops the flow: every step that hasn’t run yet is skipped, on any branch">
      <TextAreaField
        label="Error message"
        rows={3}
        maxLength={500}
        value={params.stopMessage}
        placeholder="Workflow halted."
        hint="Shown on the failed run. Empty uses “Workflow halted.”"
        onChange={(stopMessage) => set({ stopMessage }, 'stopMessage')}
      />
    </Card>
  )
}

export function NoOperationConfig() {
  return (
    <Card icon={<Hand size={16} aria-hidden />} title="No operation" description="Does nothing and outputs no rows">
      <Notice>Use it as a placeholder while you build, or to end a branch on purpose.</Notice>
    </Card>
  )
}
