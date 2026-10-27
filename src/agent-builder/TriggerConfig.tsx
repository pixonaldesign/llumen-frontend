import { useId } from 'react'
import { CalendarBlank, ChatCircleText, CursorClick, Key, LinkSimple, PaperPlaneTilt } from '@phosphor-icons/react'
import { Card, Field, NumberInput, Select, type SelectOption } from './ConfigControls'
import { inputClass } from './configStyles'
import { TIMEZONES } from './flowData'
import type { EditorProps } from './kindEditor'
import { Notice, TextAreaField, TextField } from './KindControls'
import {
  clockTime,
  scheduleCadence,
  WEBHOOK_AUTH_LABEL,
  WEEKDAYS,
  type ChatInputParams,
  type HttpMethod,
  type ScheduleParams,
  type ScheduleUnit,
  type WebhookAuth,
  type WebhookParams,
} from './nodeKinds'
import styles from './KindConfig.module.css'
import windowStyles from './NodeConfigWindow.module.css'

export function ManualTriggerConfig() {
  return (
    <Card
      icon={<CursorClick size={16} aria-hidden />}
      title="Manual trigger"
      description="Starts the flow when you click Run agent here, or Run on the published Flow. A flow has one manual trigger."
    >
      <Notice>
        Its output is one row with the run id and who started it, so the steps after it run once. A manual run has no chat session, so Send chat
        message posts nothing.
      </Notice>
    </Card>
  )
}

const UNIT_OPTIONS: readonly SelectOption<ScheduleUnit>[] = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hours', label: 'Hours' },
  { id: 'days', label: 'Days' },
  { id: 'weeks', label: 'Weeks' },
  { id: 'months', label: 'Months' },
]

const WEEKDAY_OPTIONS: readonly SelectOption<string>[] = WEEKDAYS.map((day, index) => ({ id: String(index), label: day }))
const TIMEZONE_OPTIONS: readonly SelectOption<string>[] = TIMEZONES.map((zone) => ({ id: zone, label: zone.replace(/_/g, ' ') }))

export function ScheduleConfig({ params, set }: EditorProps<ScheduleParams>) {
  const timeId = useId()
  const everyId = useId()
  const dayId = useId()
  const showsTime = params.unit === 'days' || params.unit === 'weeks' || params.unit === 'months'
  return (
    <Card icon={<CalendarBlank size={16} aria-hidden />} title="Schedule" description={`${scheduleCadence(params)}, ${params.timezone.replace(/_/g, ' ')} time.`}>
      <div className={windowStyles.fieldRow}>
        <Field label="Run every" htmlFor={everyId} required>
          <NumberInput id={everyId} value={params.every} min={1} max={10_000} onChange={(every) => set({ every: every ?? 1 }, 'every')} />
        </Field>
        <Field label="Unit">
          <Select label="Unit" value={params.unit} options={UNIT_OPTIONS} onChange={(unit) => set({ unit }, 'unit')} />
        </Field>
      </div>
      {params.unit === 'weeks' ? (
        <Field label="On">
          <Select label="Weekday" value={String(params.weekday)} options={WEEKDAY_OPTIONS} onChange={(day) => set({ weekday: Number(day) }, 'weekday')} />
        </Field>
      ) : null}
      {params.unit === 'months' ? (
        <Field label="Day of the month" htmlFor={dayId} hint="Up to the 28th, so every month has the day.">
          <NumberInput id={dayId} value={params.monthDay} min={1} max={28} onChange={(monthDay) => set({ monthDay: monthDay ?? 1 }, 'monthDay')} />
        </Field>
      ) : null}
      {showsTime ? (
        <Field label="At" htmlFor={timeId}>
          <input
            id={timeId}
            type="time"
            className={`${inputClass} ${styles.timeInput}`}
            value={clockTime(params.atHour, params.atMinute)}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(':').map(Number)
              if (Number.isFinite(hour) && Number.isFinite(minute)) set({ atHour: hour, atMinute: minute }, 'at')
            }}
          />
        </Field>
      ) : params.unit === 'hours' ? (
        <Field label="At minute" htmlFor={timeId}>
          <NumberInput id={timeId} value={params.atMinute} min={0} max={59} unit="past" onChange={(atMinute) => set({ atMinute: atMinute ?? 0 }, 'atMinute')} />
        </Field>
      ) : null}
      <Field label="Timezone">
        <Select label="Timezone" value={params.timezone} options={TIMEZONE_OPTIONS} onChange={(timezone) => set({ timezone }, 'timezone')} />
      </Field>
      <Notice>Schedules fire only on the published Flow. Run Schedule Now runs it once here, as if it had fired.</Notice>
    </Card>
  )
}

export function ChatInputConfig({ params, set }: EditorProps<ChatInputParams>) {
  return (
    <Card
      icon={<ChatCircleText size={16} aria-hidden />}
      title="Chat trigger"
      description="Starts the flow from a message in the Flow’s chat. A flow has one chat trigger; Send and wait replies need it."
    >
      <TextAreaField
        label="Test message"
        value={params.testMessage}
        rows={3}
        placeholder="What would someone ask?"
        hint="Test Chat sends this as the message. Steps read it as {{message}}."
        onChange={(testMessage) => set({ testMessage }, 'testMessage')}
      />
      <Notice>Chat runs only start from the chat. Run agent from another trigger leaves this branch out.</Notice>
    </Card>
  )
}

const METHOD_OPTIONS: readonly SelectOption<HttpMethod>[] = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => ({ id: method, label: method }))
const AUTH_OPTIONS: readonly SelectOption<WebhookAuth>[] = (Object.keys(WEBHOOK_AUTH_LABEL) as WebhookAuth[]).map((id) => ({
  id,
  label: WEBHOOK_AUTH_LABEL[id],
  description:
    id === 'none'
      ? 'Anyone with the URL can start the flow.'
      : id === 'oauth2'
        ? 'Validates a JWT from your identity provider.'
        : 'The secret is generated on publish and shown once.',
}))

function bodyError(text: string) {
  if (!text.trim()) return undefined
  try {
    JSON.parse(text)
    return undefined
  } catch {
    return 'This isn’t valid JSON.'
  }
}

export function WebhookConfig({ params, set }: EditorProps<WebhookParams>) {
  const oauth = params.authMode === 'oauth2'
  return (
    <>
      <Card icon={<LinkSimple size={16} aria-hidden />} title="Webhook" description="Starts the flow when a request arrives at its URL.">
        <dl className={styles.readout}>
          <div>
            <dt>URL</dt>
            <dd>Assigned when you publish</dd>
          </div>
        </dl>
        <div className={windowStyles.fieldRow}>
          <Field label="Method">
            <Select label="Method" value={params.method} options={METHOD_OPTIONS} onChange={(method) => set({ method }, 'method')} />
          </Field>
          <Field label="Authentication">
            <Select label="Authentication" value={params.authMode} options={AUTH_OPTIONS} onChange={(authMode) => set({ authMode }, 'authMode')} />
          </Field>
        </div>
        {oauth ? (
          <>
            <TextField
              label="Issuer"
              required
              mono
              value={params.oauth2Issuer}
              placeholder="https://login.example.com/"
              error={params.oauth2Issuer && !/^https?:\/\//.test(params.oauth2Issuer.trim()) ? 'Enter the issuer’s full URL.' : undefined}
              onChange={(oauth2Issuer) => set({ oauth2Issuer }, 'oauth2Issuer')}
            />
            <TextField label="Audience" required mono value={params.oauth2Audience} placeholder="api://llumen-flows" onChange={(oauth2Audience) => set({ oauth2Audience }, 'oauth2Audience')} />
            <TextField
              label="JWKS URI"
              mono
              value={params.oauth2JwksUri}
              placeholder="Discovered from the issuer"
              onChange={(oauth2JwksUri) => set({ oauth2JwksUri }, 'oauth2JwksUri')}
            />
            <TextAreaField
              label="Required claims"
              mono
              rows={2}
              value={params.oauth2RequiredClaims}
              placeholder={'scope=flows.run\nrole=ops'}
              hint="One claim=value per line; the token must carry every one."
              onChange={(oauth2RequiredClaims) => set({ oauth2RequiredClaims }, 'oauth2RequiredClaims')}
            />
          </>
        ) : params.authMode !== 'none' ? (
          <Notice>
            <Key size={12} aria-hidden /> The {WEBHOOK_AUTH_LABEL[params.authMode].toLowerCase()} is generated when you publish and shown once.
          </Notice>
        ) : null}
      </Card>
      <Card icon={<PaperPlaneTilt size={16} aria-hidden />} title="Test request" description="What Send Test Webhook posts here. Each top-level key becomes a column.">
        <TextAreaField
          label="Body"
          mono
          rows={6}
          value={params.testBody}
          error={bodyError(params.testBody)}
          onChange={(testBody) => set({ testBody }, 'testBody')}
        />
      </Card>
    </>
  )
}
