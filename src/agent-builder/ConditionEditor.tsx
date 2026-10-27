import { Select, type SelectOption } from './ConfigControls'
import { inputClass } from './configStyles'
import { newCondition, OPERATORS, operatorSpec, type Combinator, type Condition, type ConditionGroup, type Operator } from './conditions'
import type { Column, ColumnKind } from './createAsset'
import { AddButton, ColumnSelect, RemoveButton } from './KindControls'
import { uid } from './nodeKinds'
import styles from './KindConfig.module.css'

const OPERATOR_OPTIONS: readonly SelectOption<Operator>[] = OPERATORS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  group: spec.group,
  meta: spec.symbol === spec.label ? undefined : spec.symbol,
}))

/** The operator a column of this kind starts with; an operator that already fits is kept. */
function fittingOperator(kind: ColumnKind | undefined, current: Operator): Operator {
  const group = operatorSpec(current).group
  if (group === 'Any' || !kind || kind === 'null') return current
  if (kind === 'number') return group === 'Number' ? current : 'number__greater_than_or_equal'
  if (kind === 'boolean') return group === 'Boolean' ? current : 'boolean__is_true'
  return group === 'Text' ? current : 'text__equals'
}

type ConditionEditorProps = {
  label: string
  group: ConditionGroup
  columns: readonly Column[]
  onChange: (group: ConditionGroup, key: string) => void
}

/** Rows of field, operator, value; one AND/OR joins them all. */
export function ConditionEditor({ label, group, columns, onChange }: ConditionEditorProps) {
  const update = (id: string, patch: Partial<Condition>, key: string) =>
    onChange({ ...group, conditions: group.conditions.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)) }, `${id}:${key}`)
  const toggle = () => onChange({ ...group, combinator: (group.combinator === 'and' ? 'or' : 'and') satisfies Combinator }, 'combinator')

  return (
    <div className={styles.list} role="group" aria-label={label}>
      {group.conditions.map((condition, index) => {
        const spec = operatorSpec(condition.operator)
        return (
          <div key={condition.id} className={styles.list}>
            {index > 0 ? (
              <div className={styles.joiner}>
                <button type="button" className={styles.joinerToggle} title="Switch between AND and OR" onClick={toggle}>
                  {group.combinator.toUpperCase()}
                </button>
              </div>
            ) : null}
            <div className={spec.unary ? `${styles.conditionRow} ${styles.conditionRowUnary}` : styles.conditionRow}>
              <ColumnSelect
                label="Field"
                value={condition.field}
                columns={columns}
                placeholder={columns.length ? 'Field' : 'No columns yet'}
                invalid={!condition.field}
                onChange={(field) => {
                  const kind = columns.find((column) => column.name === field)?.kind
                  update(condition.id, { field, operator: fittingOperator(kind, condition.operator) }, 'field')
                }}
              />
              <Select
                label="Operator"
                value={condition.operator}
                options={OPERATOR_OPTIONS}
                onChange={(operator) => update(condition.id, { operator, value: operatorSpec(operator).unary ? '' : condition.value }, 'operator')}
              />
              {spec.unary ? null : (
                <input
                  className={inputClass}
                  value={condition.value}
                  placeholder="Value"
                  aria-label="Value"
                  aria-invalid={!condition.value.trim() || undefined}
                  inputMode={spec.group === 'Number' ? 'decimal' : undefined}
                  onChange={(event) => update(condition.id, { value: event.target.value }, 'value')}
                />
              )}
              <RemoveButton
                label="Remove condition"
                onClick={() => onChange({ ...group, conditions: group.conditions.filter((item) => item.id !== condition.id) }, `${condition.id}:remove`)}
              />
            </div>
          </div>
        )
      })}
      <div className={styles.addRow}>
        <AddButton onClick={() => onChange({ ...group, conditions: [...group.conditions, newCondition(uid('c'))] }, 'add')}>Add condition</AddButton>
      </div>
    </div>
  )
}
