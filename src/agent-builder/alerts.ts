import { compare, operatorSpec } from './conditions'
import type { DataRecord } from './nodeCatalog'
import type { AlertMeasure, AlertRule, DataAlertCondition } from './nodeKinds'

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

/** Whether a data condition holds on these rows; null until the step it reads has run. */
export function evaluateDataCondition(condition: DataAlertCondition, rows: readonly DataRecord[] | null): boolean | null {
  if (!rows) return null
  const { field, operator, value, measure } = condition
  switch (measure) {
    case 'any_row':
      return rows.some((row) => compare(row[field], operator, value))
    case 'every_row':
      return rows.length > 0 && rows.every((row) => compare(row[field], operator, value))
    case 'row_count':
      return compare(rows.length, operator, value)
    default: {
      const numbers = rows.map((item) => Number(item[field])).filter(Number.isFinite)
      if (!numbers.length) return false
      const total = numbers.reduce((sum, item) => sum + item, 0)
      const reduced = measure === 'sum' ? total : measure === 'avg' ? total / numbers.length : measure === 'min' ? Math.min(...numbers) : Math.max(...numbers)
      return compare(reduced, operator, value)
    }
  }
}

const isFinished = (condition: DataAlertCondition) =>
  (condition.measure === 'row_count' || Boolean(condition.field)) && (operatorSpec(condition.operator).unary || Boolean(condition.value.trim()))

export type RuleVerdict = 'fires' | 'quiet' | 'unknown'

/**
 * What a rule would do on the last run. Coming-event conditions are read by the findings agent from
 * the finished finding, so a rule that depends on one can't be settled here.
 */
export function evaluateRule(rule: AlertRule, rowsFor: (nodeId: string) => readonly DataRecord[] | null): RuleVerdict {
  if (!rule.conditions.length) return 'unknown'
  const results = rule.conditions.map((condition) =>
    condition.type === 'forecast_event' || !condition.sourceNodeId || !isFinished(condition) ? null : evaluateDataCondition(condition, rowsFor(condition.sourceNodeId)),
  )
  if (rule.combinator === 'and') {
    if (results.includes(false)) return 'quiet'
    return results.every((result) => result === true) ? 'fires' : 'unknown'
  }
  if (results.includes(true)) return 'fires'
  return results.every((result) => result === false) ? 'quiet' : 'unknown'
}
