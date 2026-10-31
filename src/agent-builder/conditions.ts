import type { DataRecord, DataValue, FieldPart, NodeField } from './nodeCatalog'

/** The guided vocabulary's operators: `<type>__<comparison>`. */
export type Operator =
  | 'text__equals'
  | 'text__not_equals'
  | 'text__contains'
  | 'text__not_contains'
  | 'text__starts_with'
  | 'text__ends_with'
  | 'number__equals'
  | 'number__not_equals'
  | 'number__greater_than'
  | 'number__greater_than_or_equal'
  | 'number__less_than'
  | 'number__less_than_or_equal'
  | 'boolean__is_true'
  | 'boolean__is_false'
  | 'any__is_empty'
  | 'any__is_not_empty'

export type OperatorGroup = 'Text' | 'Number' | 'Boolean' | 'Any'

export type OperatorSpec = { id: Operator; label: string; symbol: string; group: OperatorGroup; unary?: boolean }

export const OPERATORS: readonly OperatorSpec[] = [
  { id: 'text__equals', label: 'is', symbol: 'is', group: 'Text' },
  { id: 'text__not_equals', label: 'is not', symbol: 'is not', group: 'Text' },
  { id: 'text__contains', label: 'contains', symbol: 'contains', group: 'Text' },
  { id: 'text__not_contains', label: 'does not contain', symbol: 'does not contain', group: 'Text' },
  { id: 'text__starts_with', label: 'starts with', symbol: 'starts with', group: 'Text' },
  { id: 'text__ends_with', label: 'ends with', symbol: 'ends with', group: 'Text' },
  { id: 'number__equals', label: 'equals', symbol: '=', group: 'Number' },
  { id: 'number__not_equals', label: 'does not equal', symbol: '≠', group: 'Number' },
  { id: 'number__greater_than', label: 'is greater than', symbol: '>', group: 'Number' },
  { id: 'number__greater_than_or_equal', label: 'is at least', symbol: '≥', group: 'Number' },
  { id: 'number__less_than', label: 'is less than', symbol: '<', group: 'Number' },
  { id: 'number__less_than_or_equal', label: 'is at most', symbol: '≤', group: 'Number' },
  { id: 'boolean__is_true', label: 'is true', symbol: 'is true', group: 'Boolean', unary: true },
  { id: 'boolean__is_false', label: 'is false', symbol: 'is false', group: 'Boolean', unary: true },
  { id: 'any__is_empty', label: 'is empty', symbol: 'is empty', group: 'Any', unary: true },
  { id: 'any__is_not_empty', label: 'is not empty', symbol: 'is not empty', group: 'Any', unary: true },
]

const OPERATORS_BY_ID = Object.fromEntries(OPERATORS.map((spec) => [spec.id, spec])) as Record<Operator, OperatorSpec>
export const operatorSpec = (id: Operator) => OPERATORS_BY_ID[id] ?? OPERATORS[0]

export type Combinator = 'and' | 'or'

export type Condition = { id: string; field: string; operator: Operator; value: string }

export type ConditionGroup = { combinator: Combinator; conditions: readonly Condition[] }

export const newCondition = (id: string, operator: Operator = 'text__equals'): Condition => ({ id, field: '', operator, value: '' })

export const conditionGroup = (...conditions: Condition[]): ConditionGroup => ({ combinator: 'and', conditions })

const isEmpty = (value: DataValue | undefined) => value === null || value === undefined || value === ''

/** Whether one row passes one comparison. Text compares case-insensitively; a non-number never passes a number comparison. */
export function compare(value: DataValue | undefined, operator: Operator, right: string): boolean {
  const spec = operatorSpec(operator)
  if (operator === 'any__is_empty') return isEmpty(value)
  if (operator === 'any__is_not_empty') return !isEmpty(value)
  if (spec.group === 'Boolean') {
    const truthy = value === true || String(value).toLowerCase() === 'true'
    return operator === 'boolean__is_true' ? truthy : !truthy
  }
  if (spec.group === 'Number') {
    const left = typeof value === 'number' ? value : Number(value)
    const target = Number(right)
    if (isEmpty(value) || !Number.isFinite(left) || !Number.isFinite(target)) return false
    switch (operator) {
      case 'number__equals':
        return left === target
      case 'number__not_equals':
        return left !== target
      case 'number__greater_than':
        return left > target
      case 'number__greater_than_or_equal':
        return left >= target
      case 'number__less_than':
        return left < target
      default:
        return left <= target
    }
  }
  const left = isEmpty(value) ? '' : String(value).toLowerCase()
  const target = right.toLowerCase()
  switch (operator) {
    case 'text__equals':
      return left === target
    case 'text__not_equals':
      return left !== target
    case 'text__contains':
      return left.includes(target)
    case 'text__not_contains':
      return !left.includes(target)
    case 'text__starts_with':
      return left.startsWith(target)
    default:
      return left.endsWith(target)
  }
}

export function matches(group: ConditionGroup, row: DataRecord): boolean {
  if (!group.conditions.length) return true
  const test = (condition: Condition) => compare(row[condition.field], condition.operator, condition.value)
  return group.combinator === 'and' ? group.conditions.every(test) : group.conditions.some(test)
}

export const isComplete = (condition: Condition) =>
  Boolean(condition.field.trim()) && (operatorSpec(condition.operator).unary || condition.value.trim() !== '')

export function conditionParts(condition: Condition): FieldPart[] {
  const spec = operatorSpec(condition.operator)
  const field: FieldPart = { text: condition.field || '…', role: 'field' }
  if (spec.group === 'Boolean') return [field, { text: 'is', role: 'operator' }, { text: spec.id === 'boolean__is_true' ? 'true' : 'false', role: 'value' }]
  if (spec.unary) return [field, { text: spec.symbol, role: 'operator' }]
  const value = spec.group === 'Text' ? `"${condition.value}"` : condition.value || '…'
  return [field, { text: spec.symbol, role: 'operator' }, { text: value, role: 'value' }]
}

export function groupParts(group: ConditionGroup): FieldPart[] {
  return group.conditions.flatMap((condition, index) => [
    ...(index ? [{ text: group.combinator, role: 'join' } as const] : []),
    ...conditionParts(condition),
  ])
}

export const partsText = (parts: readonly FieldPart[]) => parts.map((part) => part.text).join(' ')

/** A card field for the conditions, styled by part. */
export function groupField(label: string, group: ConditionGroup): NodeField {
  const parts = groupParts(group)
  return { label, value: partsText(parts), parts }
}

/** Why the conditions can't compile yet, or undefined. */
export function groupIssue(group: ConditionGroup, what: string): string | undefined {
  if (!group.conditions.length) return `Add a condition to ${what}.`
  if (!group.conditions.every(isComplete)) return `Finish the condition for ${what}.`
  return undefined
}

/** Picks a sensible operator for a column's values. */
export function operatorFor(value: DataValue | undefined): Operator {
  if (typeof value === 'number') return 'number__greater_than'
  if (typeof value === 'boolean') return 'boolean__is_true'
  return 'text__equals'
}
