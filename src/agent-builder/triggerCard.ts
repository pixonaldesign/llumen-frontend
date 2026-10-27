import { nodeFields, nodeText, type CanvasNode, type NodeField } from './nodeCatalog'
import { paramsFor, scheduleCadence, WEBHOOK_AUTH_LABEL, type ScheduleParams } from './nodeKinds'

/** What trigger cards read from the Flow around them. */
export type FlowState = {
  published: boolean
  /** The trigger a run that names none starts from; set only when there's more than one to choose from. */
  defaultTriggerId?: string
}

/** Kinds a run can start without outside ingress, in the order a run that names no trigger picks them. Chat always needs a chat session. */
export const EXECUTABLE_TRIGGERS: readonly string[] = ['manualTrigger', 'scheduleTrigger', 'webhook']

const executableRank = (node: CanvasNode) => EXECUTABLE_TRIGGERS.indexOf(node.type)

/** Executable triggers in the order a run that names no trigger picks them; canvas order breaks ties. */
export function executableTriggers(nodes: readonly CanvasNode[]) {
  return nodes.filter((node) => executableRank(node) >= 0).sort((a, b) => executableRank(a) - executableRank(b))
}

export function defaultTriggerId(nodes: readonly CanvasNode[]) {
  const triggers = executableTriggers(nodes)
  return triggers.length > 1 ? triggers[0].id : undefined
}

const WHEN_PUBLISHED = 'When published'
const DAY_MS = 86_400_000

/** Wall-clock time in `timezone`, held in a Date's UTC fields so calendar maths never crosses a DST change. */
function wallClock(now: Date, timezone: string) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(now)
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()))
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute')))
}

/** The next time the schedule fires, as wall-clock time in its timezone. */
function nextFire(params: ScheduleParams, now: Date) {
  const wall = wallClock(now, params.timezone)
  const at = (day: Date, hour: number, minute: number) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute))
  const every = Math.max(1, params.every)
  switch (params.unit) {
    case 'minutes': {
      const minutes = wall.getUTCHours() * 60 + wall.getUTCMinutes()
      const next = (Math.floor(minutes / every) + 1) * every
      return next < 1440 ? at(wall, Math.floor(next / 60), next % 60) : at(new Date(wall.getTime() + DAY_MS), 0, 0)
    }
    case 'hours': {
      for (let offset = 0; offset <= 48; offset += 1) {
        const candidate = new Date(at(wall, wall.getUTCHours(), params.atMinute).getTime() + offset * 3_600_000)
        if (candidate > wall && candidate.getUTCHours() % every === 0) return candidate
      }
      return wall
    }
    case 'weeks': {
      const ahead = (params.weekday - wall.getUTCDay() + 7) % 7
      const candidate = at(new Date(wall.getTime() + ahead * DAY_MS), params.atHour, params.atMinute)
      return candidate > wall ? candidate : new Date(candidate.getTime() + 7 * DAY_MS)
    }
    case 'months': {
      const candidate = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), params.monthDay, params.atHour, params.atMinute))
      return candidate > wall ? candidate : new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + 1, params.monthDay, params.atHour, params.atMinute))
    }
    default: {
      const candidate = at(wall, params.atHour, params.atMinute)
      return candidate > wall ? candidate : new Date(candidate.getTime() + DAY_MS)
    }
  }
}

function nextRunText(params: ScheduleParams, now = new Date()) {
  const next = nextFire(params, now)
  const wall = wallClock(now, params.timezone)
  const time = `${String(next.getUTCHours()).padStart(2, '0')}:${String(next.getUTCMinutes()).padStart(2, '0')}`
  const days = Math.round((Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()) - Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate())) / DAY_MS)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Tomorrow, ${time}`
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(next)
  return `${date}, ${time}`
}

/** A stand-in for the path key publish allocates; stable per node so the URL doesn't change between renders. */
function webhookKey(nodeId: string) {
  let a = 2166136261
  let b = 5381
  for (const char of nodeId) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619)
    b = Math.imul(b, 33) ^ char.charCodeAt(0)
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`.padEnd(12, '0').slice(0, 12)
}

export const webhookPath = (nodeId: string) => `/api/workflow-webhooks/${webhookKey(nodeId)}`

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** The value rows and text a card shows, ignoring `hideDetails`; trigger rows also depend on the Flow. */
export function cardDetails(node: CanvasNode, isTrigger: boolean, flow: FlowState) {
  return { fields: isTrigger ? triggerFields(node, flow) : nodeFields(node), text: nodeText(node) }
}

/** Rows on a trigger card: what it is set to, and what publishing gives it. */
export function triggerFields(node: CanvasNode, flow: FlowState): NodeField[] {
  const pending = (label: string): NodeField => ({ label, value: WHEN_PUBLISHED, muted: true })
  switch (node.type) {
    case 'scheduleTrigger': {
      const params = paramsFor('scheduleTrigger', node.config.params)
      return [
        { label: 'Runs', value: `${scheduleCadence(params)} · ${params.timezone.replace(/_/g, ' ')}` },
        flow.published ? { label: 'Next run', value: nextRunText(params) } : pending('Next run'),
      ]
    }
    case 'webhook': {
      const params = paramsFor('webhook', node.config.params)
      const issuer = params.authMode === 'oauth2' && params.oauth2Issuer.trim() ? hostOf(params.oauth2Issuer.trim()) : ''
      const path = webhookPath(node.id)
      return [
        { label: 'Request', value: `${params.method} · ${params.authMode === 'none' ? 'No auth' : WEBHOOK_AUTH_LABEL[params.authMode]}` },
        ...(issuer ? [{ label: 'Issuer', value: issuer }] : []),
        flow.published ? { label: 'URL', value: path, copy: `${window.location.origin}${path}` } : pending('URL'),
      ]
    }
    case 'chatInput':
      return [flow.published ? { label: 'Chat', value: 'Live', live: true } : pending('Chat')]
    default:
      return []
  }
}
