import { withoutPassword } from './apiExchange'
import { addressSummary } from './emailMessage'
import { TEMPLATE_TOKEN, apiConnection, emailList, isKind, paramsFor, type ApiRequestParams, type ChatMessageParams, type EmailParams, type StopParams } from './nodeKinds'

/*
 * A node's settings told as one plain sentence, for kinds whose settings are free text with references or a
 * handful of choices that read better together than as separate badges. The values someone would scan for,
 * such as recipients or button labels, sit in the sentence as badges.
 */

export type SummaryPart = string | { badge: string; title?: string }
export type NodeSummary = { label: string; parts: readonly SummaryPart[] }

/** Small words that only make sense next to the reference they lead into or follow: "at …", "… from". */
const CONNECTOR = '(?:at|from|in|on|for|to|of|by|with|and|or|the|a|an|is|are)'
/** Stands in for a reference in the middle of a topic. */
const GAP = '…'
const LEADING_GAPS = new RegExp(`^(?:[\\s\\p{P}\\p{S}]*${GAP}(?:\\s+${CONNECTOR}\\b)*)+`, 'iu')
const TRAILING_GAPS = new RegExp(`(?:(?:\\b${CONNECTOR}\\s+)*${GAP}[\\s\\p{P}\\p{S}]*)+$`, 'iu')
/** A reference someone is still typing, e.g. "{{name" with no closing braces. */
const OPEN_REFERENCE = /\{\{[^\s}]*\}?/g
/** "Error: {{message}}" is a label in front of data; on its own, the label says nothing. */
const LABEL_BEFORE_GAP = new RegExp(`^\\s*([^\\s:${GAP}]+)\\s*:\\s*${GAP}`, 'u')
/** Separators and quotes left at the ends; brackets stay, since they close something inside. */
const LOOSE_EDGES = /^[\s:;,.!?·|/–—"“”‘’'-]+|[\s:;,.!?·|/–—"“”‘’'-]+$/g
const TRAILING_CONNECTORS = new RegExp(`(?:\\s+${CONNECTOR})+$`, 'i')
/** Sentence ends, but not the full stop in "e.g." and the like. */
const SENTENCE_BREAK = /(?<!\b(?:e\.g|i\.e|etc|vs|approx|Mr|Mrs|Ms|Dr)\.)(?<=[.!?])\s+|\n+/i
/** Long enough for a subject line; past it the topic is cut at a word. */
const TOPIC_MAX = 60
/** Fewer letters than this beside a reference isn't a topic, e.g. "Re" in "Re: {{subject}}". */
const TOPIC_MIN_BESIDE_REFERENCE = 3
/** Button labels and field names past this are cut, so a badge stays inside the card. */
const BADGE_MAX = 32

const clipAt = (text: string, max: number) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const word = cut.lastIndexOf(' ')
  return `${(word > max / 2 ? cut.slice(0, word) : cut).replace(TRAILING_CONNECTORS, '').replace(LOOSE_EDGES, '')}…`
}

/** Markdown marks and list bullets, which read as noise in a sentence. */
const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/^\s*(?:#{1,6}|[-*+•]|\d+[.)])\s+/gm, '')

/** A sentence with its references dropped where they open or close it, and shown as … where they sit inside. */
function topicIn(sentence: string) {
  const gapped = sentence.replace(TEMPLATE_TOKEN, GAP).replace(OPEN_REFERENCE, GAP).replace(/\s+/g, ' ').trim()
  let topic = gapped
  for (let previous = ''; previous !== topic; ) {
    previous = topic
    topic = topic.replace(LEADING_GAPS, '').replace(TRAILING_GAPS, '').replace(LOOSE_EDGES, '').trim()
  }
  if (topic === gapped.match(LABEL_BEFORE_GAP)?.[1]) return ''
  const letters = topic.replace(/[^\p{L}\p{N}]/gu, '').length
  return letters >= (gapped.includes(GAP) ? TOPIC_MIN_BESIDE_REFERENCE : 1) ? clipAt(topic, TOPIC_MAX) : ''
}

/**
 * What a text is about, in its author's words: its first sentence with fixed words in it, with references
 * at either end taken out along with the small words that lead into them. Empty when the text is all references.
 */
export function topicOf(text: string) {
  for (const sentence of plain(text).trim().split(SENTENCE_BREAK)) {
    const topic = topicIn(sentence)
    if (topic) return topic
  }
  return ''
}

const about = (topic: string) => (topic ? ` about “${topic}”` : '')

/** A reference as a person would say it: `{{owner.email}}` is "owner email". */
const fieldName = (path: string) => path.replace(/[._-]+/g, ' ').trim()
const readable = (text: string) => text.replace(TEMPLATE_TOKEN, (_, path: string) => fieldName(path))
const FROM_DATA = 'Filled in from the data'

const badge = (text: string, title?: string) => {
  const shown = clipAt(readable(text), BADGE_MAX)
  return { badge: shown, title: title ?? (text.includes('{{') ? FROM_DATA : shown === text ? undefined : text) }
}

const addresses = (list: readonly string[]): SummaryPart[] => {
  if (!list.length) return []
  const named = list.map((address) => (address.includes('{{') ? `${readable(address)} (from the data)` : address))
  return [badge(addressSummary(list), named.join(', '))]
}

function emailSummary({ to, cc, bcc, subject }: EmailParams): SummaryPart[] {
  const recipients = emailList(to)
  const sent = new Set(recipients.map((address) => address.toLowerCase()))
  const copied = emailList(`${cc},${bcc}`).filter((address) => !sent.has(address.toLowerCase()))
  const topic = topicOf(subject)
  return [
    ...(recipients.length ? ['Emails ', ...addresses(recipients)] : ['Sends an email']),
    ...(copied.length ? [', copying ', ...addresses(copied), topic ? ',' : ''] : []),
    `${about(topic)}.`,
  ]
}

function chatSummary({ mode, message, responseType, approveLabel, rejectLabel }: ChatMessageParams): SummaryPart[] {
  const posts = `Posts a message in the chat${about(topicOf(message))}`
  if (mode === 'send_message') return [`${posts}.`]
  if (responseType === 'free_text') return [`${posts} and waits for a reply.`]
  return [`${posts} and waits for the user to pick `, badge(approveLabel.trim() || 'Approve'), ' or ', badge(rejectLabel.trim() || 'Reject'), '.']
}

const WHOLE_REFERENCE = /^\{\{\s*([\w.-]+)\s*\}\}$/
/** Stands in for references while the URL is parsed; URL hosts are lower-case, so it is too. */
const REFERENCE_MARK = 'llumenref'

/** Where a URL goes: its host, the field it's read from, or nothing while it's too incomplete to tell. */
function destination(url: string): SummaryPart[] {
  const written = url.trim()
  if (!written) return []
  const whole = written.match(WHOLE_REFERENCE)
  if (whole) return [' to ', badge(fieldName(whole[1]), FROM_DATA)]
  const marked = written.replace(TEMPLATE_TOKEN, REFERENCE_MARK)
  let host: string
  try {
    host = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(marked) ? marked : `https://${marked}`).host
  } catch {
    return []
  }
  if (!host) return []
  if (host.includes(REFERENCE_MARK)) return [' to an address from the data']
  return [' to ', { badge: host, title: withoutPassword(written) }]
}

function apiSummary(params: ApiRequestParams): SummaryPart[] {
  if (params.mode === 'source') {
    const { source, endpoint } = apiConnection(params)
    if (!source) return ['Calls a connected API.']
    const request = endpoint ? [' for ', { badge: endpoint.name, title: `${endpoint.method} ${endpoint.path}` }] : []
    return ['Calls ', { badge: source.name, title: source.detail }, ...request, '.']
  }
  return ['Sends a ', { badge: params.method }, ' request', ...destination(params.url), '.']
}

function stopSummary({ stopMessage }: StopParams): SummaryPart[] {
  const topic = topicOf(stopMessage)
  return [topic ? `Stops the run with the error “${topic}”.` : 'Stops the run with an error.']
}

/** The sentence for a kind that has one; its badges under the title are folded into it. */
export function nodeSummary(typeId: string, stored: unknown): NodeSummary | undefined {
  if (!isKind(typeId)) return undefined
  switch (typeId) {
    case 'sendEmail':
      return { label: 'Email', parts: emailSummary(paramsFor(typeId, stored)) }
    case 'sendChatMessage':
      return { label: 'Message', parts: chatSummary(paramsFor(typeId, stored)) }
    case 'sendApiRequest':
      return { label: 'Request', parts: apiSummary(paramsFor(typeId, stored)) }
    case 'stopAndError':
      return { label: 'Error', parts: stopSummary(paramsFor(typeId, stored)) }
    default:
      return undefined
  }
}

const SUMMARY_KINDS: ReadonlySet<string> = new Set(['sendEmail', 'sendChatMessage', 'sendApiRequest', 'stopAndError'])

/** Kinds told as a sentence, whose badges under the title the sentence replaces. */
export const hasSummary = (typeId: string) => SUMMARY_KINDS.has(typeId)
