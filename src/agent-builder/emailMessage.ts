/** A Send Email step's email with its references filled in; `sent` is false when the run only simulated it. */
export type EmailMessage = {
  to: readonly string[]
  cc: readonly string[]
  bcc: readonly string[]
  subject: string
  body: string
  sent: boolean
}

/** The first address, and how many more: "ops@llumen.ai +2". */
export const addressSummary = (addresses: readonly string[]) =>
  addresses.length > 1 ? `${addresses[0]} +${addresses.length - 1}` : (addresses[0] ?? '')
