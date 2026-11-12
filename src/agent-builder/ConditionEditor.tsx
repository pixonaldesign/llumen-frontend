import { Fragment, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { Popover } from './ConfigControls'
import { groupFor, newCondition, operatorIn, operatorSpec, resolver, type Combinator, type Condition, type ConditionGroup, type Operator } from './conditions'
import { ExpressionEditor, OperatorSelect } from './ExpressionEditor'
import { singleReference } from './expressions'
import type { ConditionFields } from './kindEditor'
import { AddButton, RemoveButton } from './KindControls'
import { uid } from './nodeKinds'
import controls from './ConfigControls.module.css'
import styles from './KindConfig.module.css'

/** The field a condition reads, when it reads exactly one. */
const fieldPath = (condition: Pick<Condition, 'field' | 'fieldMode'>) =>
  condition.fieldMode === 'expression' ? singleReference(condition.field) : condition.field.trim() || undefined

/** An operator for the field's type; one that already fits is kept. */
function fittingOperator({ records, scope }: ConditionFields, path: string, current: Operator): Operator {
  const sample = records?.map((row) => resolver(row, scope)(path)).find((value) => value !== null && value !== undefined)
  const group = groupFor(sample)
  return group ? operatorIn(group, current) : current
}

const COMBINATORS: readonly { id: Combinator; label: string; description: string }[] = [
  { id: 'and', label: 'AND', description: 'Every condition must match' },
  { id: 'or', label: 'OR', description: 'Any condition can match' },
]

/** AND or OR, picked from a menu; it joins every condition in the group. */
export function CombinatorSelect({ value, onChange }: { value: Combinator; onChange: (value: Combinator) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.joinerToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Join conditions with ${value.toUpperCase()}`}
        onClick={() => setOpen((was) => !was)}
      >
        {value.toUpperCase()}
        <CaretDown size={10} weight="bold" aria-hidden />
      </button>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} label="Join conditions with">
          <div role="menu" aria-label="Join conditions with">
            {COMBINATORS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={option.id === value}
                className={controls.option}
                autoFocus={option.id === value}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                  ref.current?.focus()
                }}
              >
                <span className={controls.optionText}>
                  <span className={controls.optionLabel}>{option.label}</span>
                  <span className={controls.optionDescription}>{option.description}</span>
                </span>
                {option.id === value ? <Check className={controls.optionCheck} size={14} weight="bold" aria-hidden /> : null}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  )
}

type ConditionEditorProps = {
  label: string
  group: ConditionGroup
  fields: ConditionFields
  onChange: (group: ConditionGroup, key: string) => void
}

/** Conditions of a field, an operator, and a value; one AND/OR joins them all. */
export function ConditionEditor({ label, group, fields, onChange }: ConditionEditorProps) {
  const update = (id: string, patch: Partial<Condition>, key: string) =>
    onChange({ ...group, conditions: group.conditions.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)) }, `${id}:${key}`)

  return (
    <div className={styles.list} role="group" aria-label={label}>
      {group.conditions.map((condition, index) => {
        const spec = operatorSpec(condition.operator)
        const title = `Condition ${index + 1}`
        return (
          <Fragment key={condition.id}>
            {index > 0 ? (
              <div className={styles.joiner}>
                <CombinatorSelect value={group.combinator} onChange={(combinator) => onChange({ ...group, combinator }, 'combinator')} />
              </div>
            ) : null}
            <div className={styles.condition} role="group" aria-label={title}>
              <div className={styles.conditionBody}>
                <div className={styles.conditionPair}>
                  <ExpressionEditor
                    label="Field"
                    base="select"
                    value={condition.field}
                    expression={condition.fieldMode === 'expression'}
                    fields={fields}
                    invalid={!condition.field.trim()}
                    onChange={(field, expression) => {
                      const next = { field, fieldMode: expression ? ('expression' as const) : undefined }
                      const path = fieldPath(next)
                      const operator = path && path !== fieldPath(condition) ? fittingOperator(fields, path, condition.operator) : condition.operator
                      update(condition.id, { ...next, operator }, 'field')
                    }}
                  />
                  <OperatorSelect
                    value={condition.operator}
                    onChange={(operator) => update(condition.id, operatorSpec(operator).unary ? { operator, value: '', valueMode: undefined } : { operator }, 'operator')}
                  />
                </div>
                {spec.unary ? null : (
                  <ExpressionEditor
                    label="Value"
                    base="value"
                    valueKind={spec.valueKind}
                    value={condition.value}
                    expression={condition.valueMode === 'expression'}
                    fields={fields}
                    invalid={!condition.value.trim()}
                    onChange={(value, expression) => update(condition.id, { value, valueMode: expression ? 'expression' : undefined }, 'value')}
                  />
                )}
              </div>
              <RemoveButton
                label={`Remove ${title.toLowerCase()}`}
                onClick={() => onChange({ ...group, conditions: group.conditions.filter((item) => item.id !== condition.id) }, `${condition.id}:remove`)}
              />
            </div>
          </Fragment>
        )
      })}
      <div className={styles.addRow}>
        <AddButton onClick={() => onChange({ ...group, conditions: [...group.conditions, newCondition(uid('c'))] }, 'add')}>Add condition</AddButton>
      </div>
    </div>
  )
}
