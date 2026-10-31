import { ChatCircleDots, Envelope, Globe, ListBullets } from '@phosphor-icons/react'
import { Card, Field, Select, type SelectOption } from './ConfigControls'
import { inputClass } from './configStyles'
import { isSecretHeader } from './apiExchange'
import { SOURCES, SOURCES_BY_ID } from './flowData'
import type { EditorProps } from './kindEditor'
import { AddButton, Notice, ReferenceInput, RemoveButton, Segmented, TemplateField, TextField } from './KindControls'
import { apiConnection, bodyAllowed, emailList, uid, urlIssue, type ApiRequestParams, type ChatMessageParams, type EmailParams, type HttpMethod } from './nodeKinds'
import styles from './KindConfig.module.css'
import windowStyles from './NodeConfigWindow.module.css'

const CHAT_MODES = [
  { id: 'send_message', label: 'Send message' },
  { id: 'send_and_wait', label: 'Send and wait' },
] as const
const RESPONSE_TYPES = [
  { id: 'free_text', label: 'Free-text reply' },
  { id: 'approval', label: 'Approve or reject' },
] as const

/** How references fill in an action that runs once, not once per row. */
function TemplateHint() {
  return (
    <>
      <code className={styles.hintCode}>{'{{field}}'}</code> reads the first incoming row; <code className={styles.hintCode}>{'{{step.field}}'}</code> lists that field from every row of an earlier step. A reference
      with no value fails the step.
    </>
  )
}

export function ChatMessageConfig({ params, set, ctx }: EditorProps<ChatMessageParams>) {
  const waits = params.mode === 'send_and_wait'
  return (
    <Card icon={<ChatCircleDots size={16} aria-hidden />} title="Chat message" description="Posts one message per run in the Flow’s chat session, not one per row.">
      <Field label="Mode">
        <Segmented label="Mode" value={params.mode} options={CHAT_MODES} onChange={(mode) => set({ mode }, 'mode')} />
      </Field>
      {waits && !ctx.hasChatTrigger ? <Notice tone="error">Send and wait needs a Chat trigger in this flow; it won’t compile without one.</Notice> : null}
      {waits && ctx.hasChatTrigger ? (
        <Notice>In a run from the Chat trigger, the run pauses here until someone replies. Its output opens with the reply buttons; answer there to resume it.</Notice>
      ) : null}
      {waits ? (
        <Field label="Reply">
          <Segmented label="Reply" value={params.responseType} options={RESPONSE_TYPES} onChange={(responseType) => set({ responseType }, 'responseType')} />
        </Field>
      ) : null}
      {waits && params.responseType === 'approval' ? (
        <div className={windowStyles.fieldRow}>
          <TextField label="Approve button" required value={params.approveLabel} maxLength={24} onChange={(approveLabel) => set({ approveLabel }, 'approveLabel')} />
          <TextField label="Reject button" required value={params.rejectLabel} maxLength={24} onChange={(rejectLabel) => set({ rejectLabel }, 'rejectLabel')} />
        </div>
      ) : null}
      <TemplateField
        label="Message"
        required
        multiline
        rows={4}
        value={params.message}
        references={ctx.references}
        placeholder="e.g. {{rows.count}} sites need an inspection."
        hint={<TemplateHint />}
        error={params.message.trim() ? undefined : 'Write the message to send.'}
        onChange={(message) => set({ message }, 'message')}
      />
      <Notice>Runs without a chat session, such as manual or scheduled runs, succeed and post nothing.</Notice>
    </Card>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const addressError = (text: string) => {
  const bad = emailList(text).find((address) => !address.includes('{{') && !EMAIL.test(address))
  return bad ? `“${bad}” isn’t an email address.` : undefined
}

export function EmailConfig({ params, set, ctx }: EditorProps<EmailParams>) {
  return (
    <Card icon={<Envelope size={16} aria-hidden />} title="Email" description="Sends one email per run, not one per row. Separate addresses with commas.">
      <TemplateField
        label="To"
        required
        value={params.to}
        references={ctx.references}
        placeholder="ops@llumen.ai"
        error={!emailList(params.to).length ? 'Add a recipient.' : addressError(params.to)}
        onChange={(to) => set({ to }, 'to')}
      />
      <div className={windowStyles.fieldRow}>
        <TemplateField label="Cc" value={params.cc} references={ctx.references} error={addressError(params.cc)} onChange={(cc) => set({ cc }, 'cc')} />
        <TemplateField label="Bcc" value={params.bcc} references={ctx.references} error={addressError(params.bcc)} onChange={(bcc) => set({ bcc }, 'bcc')} />
      </div>
      <TemplateField label="Subject" required value={params.subject} references={ctx.references} error={params.subject.trim() ? undefined : 'Add a subject.'} onChange={(subject) => set({ subject }, 'subject')} />
      <TemplateField
        label="Body"
        required
        multiline
        rows={6}
        value={params.body}
        references={ctx.references}
        placeholder="e.g. Today’s run flagged {{rows.count}} sites."
        hint={<TemplateHint />}
        error={params.body.trim() ? undefined : 'Write the email body.'}
        onChange={(body) => set({ body }, 'body')}
      />
      <Notice>Runs from the builder are simulated when no mail server is set up: the step succeeds and nothing is sent.</Notice>
    </Card>
  )
}

const API_MODES = [
  { id: 'direct', label: 'Direct URL' },
  { id: 'source', label: 'Saved connection' },
] as const
const METHOD_OPTIONS: readonly SelectOption<HttpMethod>[] = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => ({ id: method, label: method }))
const API_SOURCES: readonly SelectOption<string>[] = SOURCES.filter((source) => source.mode === 'api_request').map((source) => ({ id: source.id, label: source.name, meta: source.detail }))

export function ApiRequestConfig({ params, set, ctx }: EditorProps<ApiRequestParams>) {
  const keys = params.headers.map((header) => header.key.trim().toLowerCase())
  const updateHeader = (id: string, patch: Partial<ApiRequestParams['headers'][number]>, key: string) =>
    set({ headers: params.headers.map((header) => (header.id === id ? { ...header, ...patch } : header)) }, `header:${id}:${key}`)
  const canSend = bodyAllowed(params.method)
  const { source, endpoint } = apiConnection(params)
  return (
    <>
      <Card icon={<Globe size={16} aria-hidden />} title="Request" description="Sends one request per run, not one per row. A body over 1 MiB fails the step; a longer reply is cut short.">
        <Segmented label="Request mode" value={params.mode} options={API_MODES} onChange={(mode) => set({ mode }, 'mode')} />
        {params.mode === 'source' ? (
          <>
            <Field label="Connection" required>
              <Select
                label="Connection"
                value={source ? params.sourceId : undefined}
                options={API_SOURCES}
                placeholder="Select the API connection"
                invalid={!source}
                onChange={(sourceId) => set({ sourceId, endpointId: SOURCES_BY_ID[sourceId]?.endpoints?.[0]?.id }, 'sourceId')}
              />
            </Field>
            {source ? (
              <Field label="Request" required>
                <Select
                  label="Request"
                  value={endpoint ? params.endpointId : undefined}
                  options={(source.endpoints ?? []).map((item) => ({ id: item.id, label: item.name, meta: `${item.method} ${item.path}` }))}
                  placeholder="Choose the request to make"
                  invalid={!endpoint}
                  onChange={(endpointId) => set({ endpointId }, 'endpointId')}
                />
              </Field>
            ) : null}
            <Notice>The connection signs the request in with its saved credentials, so there are no keys to add here.</Notice>
          </>
        ) : (
          <>
            <div className={styles.methodRow}>
              <Field label="Method">
                <Select label="Method" value={params.method} options={METHOD_OPTIONS} onChange={(method) => set({ method, body: bodyAllowed(method) ? params.body : '' }, 'method')} />
              </Field>
              <TemplateField label="URL" required mono value={params.url} references={ctx.references} placeholder="https://api.example.com/alerts" error={urlIssue(params.url)} onChange={(url) => set({ url }, 'url')} />
            </div>
            <Notice>Requests to private, loopback, and link-local addresses are blocked.</Notice>
          </>
        )}
      </Card>
      {params.mode === 'source' ? null : (
        <>
          <Card
            icon={<ListBullets size={16} aria-hidden />}
            title="Headers"
            description="Values can use references. Keys and tokens, such as Authorization, are hidden here and in the run’s output."
          >
            <div className={styles.list}>
              {params.headers.map((header, index) => (
                <div key={header.id} className={styles.headerRow}>
                  <input
                    className={`${inputClass} ${styles.mono}`}
                    value={header.key}
                    placeholder="Header"
                    aria-label="Header name"
                    aria-invalid={(header.key.trim() && keys.indexOf(header.key.trim().toLowerCase()) !== index) || undefined}
                    onChange={(event) => updateHeader(header.id, { key: event.target.value }, 'key')}
                  />
                  <ReferenceInput
                    label="Header value"
                    mono
                    secret={isSecretHeader(header.key)}
                    value={header.value}
                    placeholder="Value"
                    references={ctx.references}
                    onChange={(value) => updateHeader(header.id, { value }, 'value')}
                  />
                  <RemoveButton label="Remove header" onClick={() => set({ headers: params.headers.filter((other) => other.id !== header.id) }, `header:${header.id}:remove`)} />
                </div>
              ))}
              <AddButton onClick={() => set({ headers: [...params.headers, { id: uid('h'), key: '', value: '' }] }, 'addHeader')}>Add header</AddButton>
            </div>
          </Card>
          {canSend ? (
            <Card title="Body">
              <TemplateField label="Body" multiline mono rows={5} value={params.body} references={ctx.references} placeholder='{"site": "{{site}}"}' onChange={(body) => set({ body }, 'body')} />
            </Card>
          ) : (
            <Notice>A {params.method} request carries no body.</Notice>
          )}
        </>
      )}
    </>
  )
}
