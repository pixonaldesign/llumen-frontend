import { compare, operatorSpec, type Combinator } from './conditions'
import type { DataRecord } from './nodeCatalog'
import type { AlertCondition, AlertGroup, AlertMeasure, AlertRule, DataAlertCondition } from './nodeKinds'

export const MEASURE_LABEL: Record<AlertMeasure, string> = {
  any_row: 'Any row',
  every_row: 'Every row',
  row_count: 'Row count',
  sum: 'Sum of',
  avg: 'Average of',
  min: 'Lowest',
  max: 'Highest',
}

/** Measures that compare one row at a time; the rest reduce the rows to one number first. */
export const ROW_MEASURES: readonly AlertMeasure[] = ['any_row', 'every_row']

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`
const round = (value: number) => Number(value.toFixed(2)).toLocaleString()

/** Whether a data condition holds on these rows, and what the rows showed; null until the step it reads has run. */
export function observeDataCondition(condition: DataAlertCondition, rows: readonly DataRecord[] | null): { passed: boolean; observed: string } | null {
  if (!rows) return null
  const { field, operator, value, measure } = condition
  switch (measure) {
    case 'any_row':
    case 'every_row': {
      const hits = rows.filter((row) => compare(row[field], operator, value)).length
      const passed = measure === 'any_row' ? hits > 0 : rows.length > 0 && hits === rows.length
      return { passed, observed: `${hits.toLocaleString()} of ${plural(rows.length, 'row')} match` }
    }
    case 'row_count':
      return { passed: compare(rows.length, operator, value), observed: plural(rows.length, 'row') }
    default: {
      const numbers = rows.map((item) => Number(item[field])).filter(Number.isFinite)
      if (!numbers.length) return { passed: false, observed: `No numbers in ${field}` }
      const total = numbers.reduce((sum, item) => sum + item, 0)
      const reduced = measure === 'sum' ? total : measure === 'avg' ? total / numbers.length : measure === 'min' ? Math.min(...numbers) : Math.max(...numbers)
      return { passed: compare(reduced, operator, value), observed: round(reduced) }
    }
  }
}

const evaluateDataCondition = (condition: DataAlertCondition, rows: readonly DataRecord[] | null) => observeDataCondition(condition, rows)?.passed ?? null

/** A condition in words, e.g. "Highest pm10 in PM10 outlook is greater than 120". */
export function conditionText(condition: AlertCondition, stepName: (id: string) => string) {
  if (condition.type === 'forecast_event') return `${condition.event.trim() || 'An event'} is coming within ${plural(condition.withinHours, 'hour')}`
  const step = condition.sourceNodeId ? stepName(condition.sourceNodeId) : 'a step'
  const spec = operatorSpec(condition.operator)
  const test = spec.unary ? spec.label : `${spec.label} ${condition.value}`
  if (condition.measure === 'any_row' || condition.measure === 'every_row') {
    return `${condition.field || '…'} ${test} in ${condition.measure === 'any_row' ? 'any row' : 'every row'} of ${step}`
  }
  const subject = condition.measure === 'row_count' ? `Row count of ${step}` : `${MEASURE_LABEL[condition.measure]} ${condition.field || '…'} in ${step}`
  return `${subject} ${test}`
}

const isFinished = (condition: DataAlertCondition) =>
  (condition.measure === 'row_count' || Boolean(condition.field)) && (operatorSpec(condition.operator).unary || Boolean(condition.value.trim()))

/** AND or OR over results that may be unknown: null when the known ones can't settle it. */
function join(results: readonly (boolean | null)[], combinator: Combinator): boolean | null {
  if (combinator === 'and') return results.includes(false) ? false : results.every((result) => result === true) ? true : null
  return results.includes(true) ? true : results.every((result) => result === false) ? false : null
}

export type RuleVerdict = 'fires' | 'quiet' | 'unknown'

/**
 * What a rule would do on the last run. Coming-event conditions are read by the findings agent from
 * the finished finding, so a rule that depends on one can't be settled here.
 */
export function evaluateRule(rule: AlertRule, rowsFor: (nodeId: string) => readonly DataRecord[] | null): RuleVerdict {
  const conditionResult = (condition: AlertCondition) =>
    condition.type === 'forecast_event' || !condition.sourceNodeId || !isFinished(condition) ? null : evaluateDataCondition(condition, rowsFor(condition.sourceNodeId))
  const groupResult = (group: AlertGroup) => (group.conditions.length ? join(group.conditions.map(conditionResult), group.combinator) : null)
  if (!rule.groups.length) return 'unknown'
  const result = join(rule.groups.map(groupResult), rule.combinator)
  return result === true ? 'fires' : result === false ? 'quiet' : 'unknown'
}
