import { answered, statusLine, type ApiExchange } from './apiExchange'
import { InlineBadge } from './nodeParts'
import styles from './ApiPreview.module.css'

type Field = { name: string; value: string }

const shown = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value))

/** A JSON object reads as its fields, and a list as its size and first item; anything else as written. */
function readable(text: string): { fields: Field[]; caption?: string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (Array.isArray(parsed)) {
    const [first] = parsed
    const fields = first && typeof first === 'object' && !Array.isArray(first) ? Object.entries(first).map(([name, value]) => ({ name, value: shown(value) })) : []
    const caption = `${parsed.length} ${parsed.length === 1 ? 'item' : 'items'}${fields.length ? '; the first one:' : ''}`
    return { fields, caption }
  }
  if (parsed && typeof parsed === 'object') return { fields: Object.entries(parsed).map(([name, value]) => ({ name, value: shown(value) })) }
  return null
}

function Fields({ fields }: { fields: readonly Field[] }) {
  return (
    <dl className={styles.fields}>
      {fields.map((field) => (
        <div key={field.name} className={styles.field}>
          <dt>{field.name}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Body({ text }: { text: string }) {
  const parsed = readable(text)
  if (!parsed) return <p className={styles.body}>{text}</p>
  return (
    <>
      {parsed.caption ? <p className={styles.caption}>{parsed.caption}</p> : null}
      {parsed.fields.length ? <Fields fields={parsed.fields} /> : null}
    </>
  )
}

/** A Send API Request step's exchange: what it sent, then what came back. */
export function ApiPreview({ api, className }: { api: ApiExchange; className?: string }) {
  const ok = answered(api.status)
  return (
    <div className={`${styles.api} ${className ?? ''}`}>
      <p className={styles.status}>{api.sent ? 'Sent' : 'Not sent: the builder doesn’t call external APIs, so this reply is a pretend one'}</p>
      <section className={styles.sheet} aria-label="Request">
        <h3 className={styles.label}>Request</h3>
        <p className={styles.line}>
          <InlineBadge text={api.method} /> {api.via ? `${api.via} · ${api.url}` : api.url}
        </p>
        {api.headers.length ? (
          <>
            <p className={styles.caption}>Headers</p>
            <Fields fields={api.headers} />
          </>
        ) : null}
        {api.body ? (
          <>
            <p className={styles.caption}>Body</p>
            <Body text={api.body} />
          </>
        ) : null}
      </section>
      <section className={styles.sheet} data-tone={ok ? undefined : 'error'} aria-label="Reply">
        <h3 className={styles.label}>Reply</h3>
        <p className={styles.code} data-tone={ok ? 'ok' : 'error'}>
          {statusLine(api.status)}
        </p>
        {api.reply ? <Body text={api.reply} /> : null}
      </section>
    </div>
  )
}
