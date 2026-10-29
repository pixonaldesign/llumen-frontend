import type { EmailMessage } from './emailMessage'
import styles from './EmailPreview.module.css'

/** A Send Email step's email as the recipients would read it: who it goes to, the subject, then the body. */
export function EmailPreview({ email, className }: { email: EmailMessage; className?: string }) {
  const recipients = [
    { label: 'To', addresses: email.to },
    { label: 'Cc', addresses: email.cc },
    { label: 'Bcc', addresses: email.bcc },
  ].filter((row) => row.addresses.length)
  return (
    <div className={`${styles.email} ${className ?? ''}`}>
      <p className={styles.status}>{email.sent ? 'Sent' : 'Not sent: no mail server is set up, so this is the email a run would send'}</p>
      <article className={styles.sheet} data-muted={!email.sent || undefined}>
        <dl className={styles.recipients}>
          {recipients.map((row) => (
            <div key={row.label} className={styles.recipient}>
              <dt>{row.label}</dt>
              <dd>{row.addresses.join(', ')}</dd>
            </div>
          ))}
        </dl>
        <h3 className={styles.subject}>{email.subject}</h3>
        <p className={styles.body}>{email.body}</p>
      </article>
    </div>
  )
}
