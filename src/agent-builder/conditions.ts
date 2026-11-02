import { evaluateExpression } from './expressions'
import { fieldKind, isObject } from './fieldPaths'
import type { DataRecord, FieldPart, NodeField } from './nodeCatalog'
import { valueAt } from './recordUtils'

/** What an operator compares, as the operator menu groups them. */
export type OperatorGroup = 'String' | 'Number' | 'Date & Time' | 'Boolean' | 'Array' | 'Object'

const GROUP_PREFIX = { String: 'text', Number: 'number', 'Date & Time': 'date', Boolean: 'boolean', Array: 'array', Object: 'object' } as const satisfies Record<
  OperatorGroup,
  string
>

export const OPERATOR_GROUPS = Object.keys(GROUP_PREFIX) as OperatorGroup[]

/** `<type>__<comparison>`, e.g. `number__greater_than`. */
export type Operator = `${(typeof GROUP_PREFIX)[OperatorGroup]}__${string}`

/** What the value box takes when the value is typed in. */
export type ValueKind = 'text' | 'number' | 'date'

export type OperatorSpec = { id: Operator; label: string; symbol: string; group: OperatorGroup; unary?: boolean; valueKind?: ValueKind }

const PRESENCE = [
  ['exists', 'exists'],
  ['not_exists', 'does not exist'],
  ['is_empty', 'is empty'],
  ['is_not_empty', 'is not empty'],
] as const

/** Each comparison, its label, and its short form on the card when that differs. */
type Entry = readonly [comparison: string, label: string, symbol?: string, valueKind?: ValueKind]

const ENTRIES: Record<OperatorGroup, readonly Entry[]> = {
  String: [
    ['equals', 'is equal to', 'is'],
    ['equals_ci', 'is equal to (case insensitive)', 'is'],
    ['not_equals', 'is not equal to', 'is not'],
    ['not_equals_ci', 'is not equal to (case insensitive)', 'is not'],
    ['contains', 'contains'],
    ['contains_ci', 'contains (case insensitive)', 'contains'],
    ['not_contains', 'does not contain'],
    ['not_contains_ci', 'does not contain (case insensitive)', 'does not contain'],
    ['starts_with', 'starts with'],
    ['starts_with_ci', 'starts with (case insensitive)', 'starts with'],
    ['not_starts_with', 'does not start with'],
    ['not_starts_with_ci', 'does not start with (case insensitive)', 'does not start with'],
    ['ends_with', 'ends with'],
    ['ends_with_ci', 'ends with (case insensitive)', 'ends with'],
    ['not_ends_with', 'does not end with'],
    ['not_ends_with_ci', 'does not end with (case insensitive)', 'does not end with'],
    ['regex', 'matches regex', 'matches'],
    ['regex_ci', 'matches regex (case insensitive)', 'matches'],
    ['not_regex', 'does not match regex', 'does not match'],
    ['not_regex_ci', 'does not match regex (case insensitive)', 'does not match'],
  ],
  Number: [
    ['equals', 'is equal to', '='],
    ['not_equals', 'is not equal to', '≠'],
    ['greater_than', 'is greater than', '>'],
    ['less_than', 'is less than', '<'],
    ['greater_than_or_equal', 'is greater than or equal to', '≥'],
    ['less_than_or_equal', 'is less than or equal to', '≤'],
  ],
  'Date & Time': [
    ['equals', 'is equal to', 'is'],
    ['not_equals', 'is not equal to', 'is not'],
    ['after', 'is after'],
    ['before', 'is before'],
    ['after_or_equal', 'is after or equal to', 'is on or after'],
    ['before_or_equal', 'is before or equal to', 'is on or before'],
  ],
  Boolean: [
    ['is_true', 'is true'],
    ['is_false', 'is false'],
  ],
  Array: [
    ['contains', 'contains', 'contains', 'text'],
    ['not_contains', 'does not contain', 'does not contain', 'text'],
    ['length_equals', 'length equal to', 'length ='],
    ['length_not_equals', 'length not equal to', 'length ≠'],
    ['length_greater_than', 'length greater than', 'length >'],
    ['length_less_than', 'length less than', 'length <'],
    ['length_greater_than_or_equal', 'length greater than or equal to', 'length ≥'],
    ['length_less_than_or_equal', 'length less than or equal to', 'length ≤'],
  ],
  Object: [],
}

const GROUP_VALUE: Record<OperatorGroup, ValueKind | undefined> = {
  String: 'text',
  Number: 'number',
  'Date & Time': 'date',
  Boolean: undefined,
  Array: 'number',
  Object: undefined,
}

export const OPERATORS: readonly OperatorSpec[] = OPERATOR_GROUPS.flatMap((group) => [
  ...PRESENCE.map(([comparison, label]): OperatorSpec => ({ id: `${GROUP_PREFIX[group]}__${comparison}`, label, symbol: label, group, unary: true })),
  ...ENTRIES[group].map(
    ([comparison, label, symbol, valueKind]): OperatorSpec => ({
      id: `${GROUP_PREFIX[group]}__${comparison}`,
      label,
      symbol: symbol ?? label,
      group,
      unary: group === 'Boolean' || undefined,
      valueKind: group === 'Boolean' ? undefined : (valueKind ?? GROUP_VALUE[group]),
    }),
  ),
])

/** Ids saved before every type had its own emptiness checks. */
const RENAMED: Readonly<Record<string, Operator>> = { any__is_empty: 'text__is_empty', any__is_not_empty: 'text__is_not_empty' }

const OPERATORS_BY_ID = Object.fromEntries(OPERATORS.map((spec) => [spec.id, spec])) as Record<Operator, OperatorSpec>
export const operatorSpec = (id: string) => OPERATORS_BY_ID[(RENAMED[id] ?? id) as Operator] ?? OPERATORS[0]

/** The operator a group starts on when the field's type changes. */
const GROUP_DEFAULT: Record<OperatorGroup, Operator> = {
  String: 'text__equals',
  Number: 'number__greater_than',
  'Date & Time': 'date__after',
  Boolean: 'boolean__is_true',
  Array: 'array__is_not_empty',
  Object: 'object__exists',
}

/** The same comparison for another type when it has one, e.g. `is empty` or `contains`; else that type's default. */
export function operatorIn(group: OperatorGroup, current: string): Operator {
  const spec = operatorSpec(current)
  if (spec.group === group) return spec.id
  const same = `${GROUP_PREFIX[group]}__${spec.id.slice(spec.id.indexOf('__') + 2)}` as Operator
  return OPERATORS_BY_ID[same] ? same : GROUP_DEFAULT[group]
}

export type Combinator = 'and' | 'or'

/**
 * `field` is a path in the row, e.g. `hair.color`, or an expression when `fieldMode` says so; `value` is typed
 * in, or an expression when `valueMode` says so.
 */
export type Condition = {
  id: string
  field: string
  operator: Operator
  value: string
  fieldMode?: 'expression'
  valueMode?: 'expression'
}

export type ConditionGroup = { combinator: Combinator; conditions: readonly Condition[] }

export const newCondition = (id: string, operator: Operator = 'text__equals'): Condition => ({ id, field: '', operator, value: '' })

export const conditionGroup = (...conditions: Condition[]): ConditionGroup => ({ combinator: 'and', conditions })

const missing = (value: unknown) => value === null || value === undefined
const empty = (value: unknown) =>
  missing(value) || value === '' || (Array.isArray(value) && value.length === 0) || (isObject(value) && Object.keys(value).length === 0)

const asText = (value: unknown) => (missing(value) ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value))

function order(comparison: string, left: number, right: number) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  switch (comparison) {
    case 'equals':
      return left === right
    case 'not_equals':
      return left !== right
    case 'greater_than':
      return left > right
    case 'greater_than_or_equal':
      return left >= right
    case 'less_than':
      return left < right
    default:
      return left <= right
  }
}

const DATE_ORDER: Readonly<Record<string, string>> = { after: 'greater_than', before: 'less_than', after_or_equal: 'greater_than_or_equal', before_or_equal: 'less_than_or_equal' }

const toTime = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Date.parse(value) : Number.NaN)

/** A list, or text holding one as JSON. */
function asList(value: unknown): readonly unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim().startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function matchesText(comparison: string, left: string, right: string) {
  const insensitive = comparison.endsWith('_ci')
  const base = insensitive ? comparison.slice(0, -3) : comparison
  if (base === 'regex' || base === 'not_regex') {
    try {
      const found = new RegExp(right, insensitive ? 'i' : '').test(left)
      return base === 'regex' ? found : !found
    } catch {
      return false
    }
  }
  const a = insensitive ? left.toLowerCase() : left
  const b = insensitive ? right.toLowerCase() : right
  switch (base) {
    case 'equals':
      return a === b
    case 'not_equals':
      return a !== b
    case 'contains':
      return a.includes(b)
    case 'not_contains':
      return !a.includes(b)
    case 'starts_with':
      return a.startsWith(b)
    case 'not_starts_with':
      return !a.startsWith(b)
    case 'ends_with':
      return a.endsWith(b)
    default:
      return !a.endsWith(b)
  }
}

/** Whether a value passes one comparison; a value of the wrong type never passes a typed comparison. */
export function compare(value: unknown, operator: string, right: unknown): boolean {
  const spec = operatorSpec(operator)
  const comparison = spec.id.slice(spec.id.indexOf('__') + 2)
  if (comparison === 'exists') return !missing(value)
  if (comparison === 'not_exists') return missing(value)
  if (comparison === 'is_empty') return empty(value)
  if (comparison === 'is_not_empty') return !empty(value)
  switch (spec.group) {
    case 'Boolean': {
      const truthy = value === true || asText(value).toLowerCase() === 'true'
      return comparison === 'is_true' ? truthy : !truthy
    }
    case 'Number':
      return !empty(value) && order(comparison, typeof value === 'number' ? value : Number(value), Number(right))
    case 'Date & Time':
      return order(DATE_ORDER[comparison] ?? comparison, toTime(value), toTime(right))
    case 'Array': {
      const list = asList(value)
      if (!list) return false
      if (comparison === 'contains' || comparison === 'not_contains') {
        const found = list.some((item) => asText(item) === asText(right))
        return comparison === 'contains' ? found : !found
      }
      return order(comparison.replace('length_', ''), list.length, Number(right))
    }
    case 'Object':
      return false
    default:
      return matchesText(comparison, asText(value), asText(right))
  }
}

/** What a condition reads besides its row: earlier steps by alias, and globals such as `$llumen`. */
export type ConditionScope = {
  steps?: readonly { alias: string; rows: readonly DataRecord[] | null }[]
  globals?: Readonly<Record<string, DataRecord>>
}

/**
 * Reads a path for one row. `$name.…` reads a global and `alias.…` an earlier step's first row,
 * unless the row has a field of that name, which wins.
 */
export function resolver(row: DataRecord, scope: ConditionScope = {}) {
  return (path: string): unknown => {
    const dot = path.indexOf('.')
    const head = dot < 0 ? path : path.slice(0, dot)
    const rest = dot < 0 ? '' : path.slice(dot + 1)
    if (head.startsWith('$')) {
      const global = scope.globals?.[head]
      return global && rest ? valueAt(global, rest) : global
    }
    if (path in row || head in row) return valueAt(row, path)
    const step = scope.steps?.find((item) => item.alias === head)
    if (step) return step.rows?.[0] && rest ? valueAt(step.rows[0], rest) : undefined
    return valueAt(row, path)
  }
}

/** The condition's left side for one row: the field at its path, or what its expression gives. */
export function leftValue(condition: Condition, row: DataRecord, scope?: ConditionScope): unknown {
  const resolve = resolver(row, scope)
  return condition.fieldMode === 'expression' ? evaluateExpression(condition.field, resolve) : resolve(condition.field)
}

export function rightValue(condition: Condition, row: DataRecord, scope?: ConditionScope): unknown {
  return condition.valueMode === 'expression' ? evaluateExpression(condition.value, resolver(row, scope)) : condition.value
}

export const conditionHolds = (condition: Condition, row: DataRecord, scope?: ConditionScope) =>
  compare(leftValue(condition, row, scope), condition.operator, rightValue(condition, row, scope))

export function matches(group: ConditionGroup, row: DataRecord, scope?: ConditionScope): boolean {
  if (!group.conditions.length) return true
  const test = (condition: Condition) => conditionHolds(condition, row, scope)
  return group.combinator === 'and' ? group.conditions.every(test) : group.conditions.some(test)
}

export const isComplete = (condition: Condition) =>
  Boolean(condition.field.trim()) && (operatorSpec(condition.operator).unary || condition.value.trim() !== '')

export function conditionParts(condition: Condition): FieldPart[] {
  const spec = operatorSpec(condition.operator)
  const field: FieldPart = { text: condition.field.trim() || '…', role: 'field' }
  if (spec.id === 'boolean__is_true' || spec.id === 'boolean__is_false') {
    return [field, { text: 'is', role: 'operator' }, { text: spec.id === 'boolean__is_true' ? 'true' : 'false', role: 'value' }]
  }
  if (spec.unary) return [field, { text: spec.symbol, role: 'operator' }]
  const typed = condition.valueMode !== 'expression' && spec.valueKind === 'text'
  const value = typed ? `"${condition.value}"` : condition.value.trim() || '…'
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/** The operator group a sample value belongs to; dates are text written as ISO dates. */
export function groupFor(value: unknown): OperatorGroup | undefined {
  const kind = fieldKind(value)
  if (kind === 'null') return undefined
  if (kind === 'string') return ISO_DATE.test(String(value)) ? 'Date & Time' : 'String'
  return ({ number: 'Number', boolean: 'Boolean', array: 'Array', object: 'Object' } as const)[kind]
}

/** Picks a sensible operator for a column's values. */
export function operatorFor(value: unknown): Operator {
  const group = groupFor(value)
  return group ? GROUP_DEFAULT[group] : 'text__equals'
}
