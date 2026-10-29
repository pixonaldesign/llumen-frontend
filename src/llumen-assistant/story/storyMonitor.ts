import type { AssistantReplyPayload, WorkflowProposal } from '../assistantReplyTypes'

export type MonitorUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
export type MonitorWeekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
export type MonitorOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export type MonitorCondition = {
  id: string
  /** A field name, or a `{{ Node.field }}` reference. */
  field: string
  operator: MonitorOperator
  /** `null` leaves the condition out. */
  value: number | null
}

/** Whether every condition has to hold, or any one of them. */
export type MonitorMatch = 'all' | 'any'

export type MonitorConfig = {
  every: number
  unit: MonitorUnit
  /** 24-hour `HH:MM`, local to `timezone`. */
  time: string
  minute: number
  weekday: MonitorWeekday
  monthDay: number
  timezone: string
  /** Which of `conditions` and `instructions` decides when to notify; the other is ignored. */
  notifyBy: MonitorNotifyBy
  /** In the order they are checked. */
  conditions: MonitorCondition[]
  match: MonitorMatch
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
    conditions: [newMonitorCondition()],
    match: 'all',
    instructions: '',
  }
}

let conditionCount = 0

export function newMonitorCondition(): MonitorCondition {
  conditionCount += 1
  return { id: `condition-${conditionCount}`, field: '', operator: 'gt', value: null }
}

export const MONITOR_OPERATORS: { value: MonitorOperator; label: string }[] = [
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is at most' },
  { value: 'eq', label: 'is equal to' },
]

/** e.g. “volume is greater than 1,000”, or `null` until both the field and the value are set. */
export function describeMonitorCondition({ field, operator, value }: MonitorCondition) {
  if (!field.trim() || value == null) return null
  const operatorLabel = MONITOR_OPERATORS.find((option) => option.value === operator)?.label ?? ''
  return `${field.trim()} ${operatorLabel} ${value.toLocaleString('en-US')}`
}

/** The complete conditions, joined by “and” or “or”; `null` when none has one. */
export function describeMonitorConditions(config: MonitorConfig) {
  if (config.notifyBy !== 'condition') return null
  const parts = config.conditions.map(describeMonitorCondition).filter((part) => part !== null)
  return parts.length ? parts.join(config.match === 'all' ? ' and ' : ' or ') : null
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
  const condition = describeMonitorConditions(config)
  const checks = `${schedule} (${config.timezone}), checks ${cardTitle}`
  let summary = `${checks} for notable changes.`
  if (condition) summary = `${checks} and notifies you when ${condition}.`
  else if (instructions) summary = `${checks}: ${instructions}.`

  const head: WorkflowProposal['steps'] = [
    { id: 'trigger', label: 'Schedule Trigger', tone: 'trigger', lane: 'spine' },
    { id: 'read', label: `Read ${cardTitle}`, tone: 'source', lane: 'spine' },
  ]
  const complete = condition ? config.conditions.filter((item) => describeMonitorCondition(item) !== null) : []

  // Two or more conditions are checked side by side, one branch each, and meet again at the notification.
  if (complete.length > 1) {
    const branches = complete.map((item, index) => {
      const operator = MONITOR_OPERATORS.find((option) => option.value === item.operator)?.label ?? ''
      const lane = index === 0 ? 'left' : 'right'
      return [
        { id: `${item.id}-field`, label: `Read ${item.field.trim()}`, tone: 'source', lane },
        {
          id: `${item.id}-check`,
          label: `Check it ${operator} ${item.value?.toLocaleString('en-US')}`,
          tone: 'source',
          lane,
        },
      ] satisfies WorkflowProposal['steps']
    })
    const notify = {
      id: 'notify',
      label: config.match === 'all' ? 'Notify you when all match' : 'Notify you when any matches',
      tone: 'delivery',
      lane: 'join',
    } satisfies WorkflowProposal['steps'][number]
    return {
      ...monitorProposalBase(id, cardTitle, schedule, condition, instructions, summary),
      steps: [...head, ...branches.flat(), notify],
      edges: [
        ['trigger', 'read'],
        ...branches.flatMap(([field, check]): [string, string][] => [
          ['read', field.id],
          [field.id, check.id],
          [check.id, notify.id],
        ]),
      ],
    }
  }

  const steps: WorkflowProposal['steps'] = [
    ...head,
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
    ...monitorProposalBase(id, cardTitle, schedule, condition, instructions, summary),
    steps,
    edges: steps.slice(1).map((step, index): [string, string] => [steps[index].id, step.id]),
  }
}

function monitorProposalBase(
  id: string,
  cardTitle: string,
  schedule: string,
  condition: string | null,
  instructions: string,
  summary: string,
) {
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
  }
}

/** The form's choices written out as the request the workflow card answers. */
export function monitorPrompt(cardTitle: string, config: MonitorConfig) {
  const schedule = `${describeMonitorSchedule(config).replace(/^Runs /, '')} (${config.timezone})`
  const instructions = config.notifyBy === 'instructions' ? config.instructions.replace(/[.\s]+$/, '') : ''
  const condition = describeMonitorConditions(config)
  if (condition) return `Monitor ${cardTitle} ${schedule} and notify me when ${condition}.`
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
