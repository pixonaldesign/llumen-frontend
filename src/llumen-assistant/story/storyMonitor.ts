import type { AssistantReplyPayload, WorkflowProposal } from '../assistantReplyTypes'

export type MonitorUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
export type MonitorWeekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
export type MonitorMetric = 'value' | 'change' | 'percentChange'
export type MonitorOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export type MonitorCondition = {
  metric: MonitorMetric
  operator: MonitorOperator
  /** `null` leaves the monitor unconditional. */
  value: number | null
}

export type MonitorConfig = {
  every: number
  unit: MonitorUnit
  /** 24-hour `HH:MM`, local to `timezone`. */
  time: string
  minute: number
  weekday: MonitorWeekday
  monthDay: number
  timezone: string
  /** Which of `condition` and `instructions` decides when to notify; the other is ignored. */
  notifyBy: MonitorNotifyBy
  condition: MonitorCondition
  instructions: string
}

export type MonitorNotifyBy = 'condition' | 'instructions'

export const MONITOR_NOTIFY_BY: { value: MonitorNotifyBy; label: string }[] = [
  { value: 'instructions', label: 'Instructions' },
  { value: 'condition', label: 'Condition' },
]

export const MONITOR_EVERY_MAX = 999

export const MONITOR_UNITS: { value: MonitorUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
]

export const MONITOR_WEEKDAYS: { value: MonitorWeekday; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
]

export const MONITOR_TIMEZONES = [
  'UTC',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
].map((zone) => ({ value: zone, label: zone }))

export function defaultMonitorConfig(): MonitorConfig {
  return {
    every: 1,
    unit: 'days',
    time: '00:00',
    minute: 0,
    weekday: 'sunday',
    monthDay: 1,
    timezone: 'UTC',
    notifyBy: 'instructions',
    condition: { metric: 'value', operator: 'gt', value: null },
    instructions: '',
  }
}

export const MONITOR_METRICS: { value: MonitorMetric; label: string }[] = [
  { value: 'value', label: 'Latest value' },
  { value: 'change', label: 'Change since last run' },
  { value: 'percentChange', label: 'Percent change since last run' },
]

export const MONITOR_OPERATORS: { value: MonitorOperator; label: string }[] = [
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is at most' },
  { value: 'eq', label: 'is equal to' },
]

/** e.g. “latest value is greater than 1,000”, or `null` when no value is set. */
export function describeMonitorCondition({ metric, operator, value }: MonitorCondition) {
  if (value == null) return null
  const metricLabel = MONITOR_METRICS.find((option) => option.value === metric)?.label ?? ''
  const operatorLabel = MONITOR_OPERATORS.find((option) => option.value === operator)?.label ?? ''
  const amount = `${value.toLocaleString('en-US')}${metric === 'percentChange' ? '%' : ''}`
  return `${metricLabel.toLowerCase()} ${operatorLabel} ${amount}`
}

/** `13:05` → `1:05 PM`. */
export function formatMonitorTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const suffix = hours < 12 ? 'AM' : 'PM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

const SINGULAR: Record<MonitorUnit, string> = {
  minutes: 'minute',
  hours: 'hour',
  days: 'day',
  weeks: 'week',
  months: 'month',
}

/** One line for the collapsed trigger, e.g. “Runs every day at 12:00 AM”. */
export function describeMonitorSchedule(config: MonitorConfig) {
  const every = config.every === 1 ? SINGULAR[config.unit] : `${config.every} ${config.unit}`
  const at = formatMonitorTime(config.time)
  const weekday = MONITOR_WEEKDAYS.find((day) => day.value === config.weekday)?.label ?? ''
  switch (config.unit) {
    case 'minutes':
      return `Runs every ${every}`
    case 'hours':
      return `Runs every ${every} at :${String(config.minute).padStart(2, '0')}`
    case 'days':
      return `Runs every ${every} at ${at}`
    case 'weeks':
      return config.every === 1 ? `Runs every ${weekday} at ${at}` : `Runs every ${every} on ${weekday} at ${at}`
    case 'months':
      return `Runs every ${every} on day ${config.monthDay} at ${at}`
  }
}

/** The draft workflow a confirmed monitor becomes, shown above the story's chat input. */
export function monitorWorkflowProposal(id: string, cardTitle: string, config: MonitorConfig): WorkflowProposal {
  const schedule = describeMonitorSchedule(config)
  const instructions = config.notifyBy === 'instructions' ? config.instructions.replace(/[.\s]+$/, '') : ''
  const condition = config.notifyBy === 'condition' ? describeMonitorCondition(config.condition) : null
  const checks = `${schedule} (${config.timezone}), checks ${cardTitle}`
  let summary = `${checks} for notable changes.`
  if (condition) summary = `${checks} and notifies you when its ${condition}.`
  else if (instructions) summary = `${checks}: ${instructions}.`

  const steps: WorkflowProposal['steps'] = [
    { id: 'trigger', label: 'Schedule Trigger', tone: 'trigger', lane: 'spine' },
    { id: 'read', label: `Read ${cardTitle}`, tone: 'step', lane: 'spine' },
    condition
      ? { id: 'condition', label: `If ${condition}`, tone: 'step', lane: 'spine' }
      : {
          id: 'check',
          label: instructions ? 'Check against the instructions with AI' : 'Look for notable changes with AI',
          tone: 'agent',
          lane: 'spine',
        },
    { id: 'notify', label: 'Notify you', tone: 'delivery', lane: 'spine' },
  ]

  return {
    id,
    intro: "I'll monitor this card on the schedule you set:",
    clauses: [
      { id: 'schedule', label: schedule },
      { id: 'card', label: cardTitle },
      ...(condition ? [{ id: 'condition', label: condition }] : []),
      ...(instructions ? [{ id: 'instructions', label: instructions }] : []),
    ],
    title: `Monitor ${cardTitle}`,
    summary,
    steps,
    edges: steps.slice(1).map((step, index): [string, string] => [steps[index].id, step.id]),
  }
}

/** The form's choices written out as the request the workflow card answers. */
export function monitorPrompt(cardTitle: string, config: MonitorConfig) {
  const schedule = `${describeMonitorSchedule(config).replace(/^Runs /, '')} (${config.timezone})`
  const instructions = config.notifyBy === 'instructions' ? config.instructions.replace(/[.\s]+$/, '') : ''
  const condition = config.notifyBy === 'condition' ? describeMonitorCondition(config.condition) : null
  if (condition) return `Monitor ${cardTitle} ${schedule} and notify me when its ${condition}.`
  if (instructions) return `Monitor ${cardTitle} ${schedule}. ${instructions}.`
  return `Monitor ${cardTitle} ${schedule} and notify me about notable changes.`
}

export function monitorWorkflowReply(proposal: WorkflowProposal): AssistantReplyPayload {
  return {
    headline: proposal.title,
    thinkingSteps: [
      { id: 'read', kind: 'reasoning', title: 'Reading the monitor settings' },
      { id: 'done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'read',
        kind: 'reasoning',
        title: 'Read the monitor settings',
        titleInProgress: 'Reading the monitor settings…',
      },
      {
        id: 'draft',
        kind: 'outcome',
        title: 'Drafted the workflow',
        titleInProgress: 'Drafting the workflow…',
      },
    ],
    blocks: [{ type: 'workflow', proposal }],
  }
}
