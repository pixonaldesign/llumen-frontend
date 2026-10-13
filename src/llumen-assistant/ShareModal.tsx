import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Plus, X } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import styles from './ShareModal.module.css'

export type ShareContact = {
  id: string
  name: string
  email: string
  initial: string
  accent: string
  frequent?: boolean
}

const SHARE_CONTACTS: ShareContact[] = [
  {
    id: 'omar',
    name: 'Omar Dalam',
    email: 'omar.dalam@pixonal.com',
    initial: 'O',
    accent: '#c4a484',
    frequent: true,
  },
  {
    id: 'mohamed',
    name: 'Mohamed Said',
    email: 'm.said@pixonal.com',
    initial: 'M',
    accent: '#e8b4a0',
    frequent: true,
  },
  {
    id: 'islam',
    name: 'Islam Zayed',
    email: 'islam.zayed@pixonal.com',
    initial: 'I',
    accent: '#84b1f5',
    frequent: true,
  },
  {
    id: 'sara',
    name: 'Sara Hassan',
    email: 'sara.hassan@pixonal.com',
    initial: 'S',
    accent: '#7cd69e',
  },
  {
    id: 'noura',
    name: 'Noura Al Mazrouei',
    email: 'noura.almazrouei@pixonal.com',
    initial: 'N',
    accent: '#abcef9',
  },
  {
    id: 'ahmed',
    name: 'Ahmed Farouk',
    email: 'ahmed.farouk@pixonal.com',
    initial: 'A',
    accent: '#f5c26b',
  },
  {
    id: 'layla',
    name: 'Layla Mansour',
    email: 'layla.mansour@pixonal.com',
    initial: 'L',
    accent: '#d4a5ff',
  },
]

function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 90
  if (t.includes(q)) return 70

  let ti = 0
  let score = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    const found = t.indexOf(ch, ti)
    if (found === -1) return 0
    score += 10 - Math.min(9, found - ti)
    ti = found + 1
  }
  return Math.max(1, score)
}

function rankContacts(query: string, excludeIds: Set<string>): ShareContact[] {
  const q = query.trim()
  if (!q) return []
  return SHARE_CONTACTS.filter((c) => !excludeIds.has(c.id))
    .map((c) => ({
      contact: c,
      score: Math.max(fuzzyScore(q, c.name), fuzzyScore(q, c.email)),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.contact.name.localeCompare(b.contact.name))
    .map((r) => r.contact)
}

function contactFromToken(token: string): ShareContact | null {
  const value = token.trim()
  if (!value) return null
  const existing = SHARE_CONTACTS.find(
    (c) =>
      c.email.toLowerCase() === value.toLowerCase() ||
      c.name.toLowerCase() === value.toLowerCase(),
  )
  if (existing) return existing
  if (!value.includes('@')) return null
  const name = value.split('@')[0]?.replace(/[._]/g, ' ') || value
  return {
    id: `email-${value.toLowerCase()}`,
    name: name.replace(/\b\w/g, (ch) => ch.toUpperCase()),
    email: value,
    initial: (name[0] || value[0] || '?').toUpperCase(),
    accent: '#84b1f5',
  }
}

export type ShareModalProps = {
  open: boolean
  title?: string
  onClose: () => void
}

export function ShareModal({
  open,
  title = 'Share conversation',
  onClose,
}: ShareModalProps) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [invitees, setInvitees] = useState<ShareContact[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const excludeIds = useMemo(() => new Set(invitees.map((c) => c.id)), [invitees])
  const suggestions = useMemo(() => rankContacts(draft, excludeIds).slice(0, 6), [draft, excludeIds])
  const frequent = useMemo(
    () => SHARE_CONTACTS.filter((c) => c.frequent && !excludeIds.has(c.id)),
    [excludeIds],
  )
  const canInvite = invitees.length > 0

  useEffect(() => {
    if (!open) return
    setDraft('')
    setInvitees([])
    setActiveIndex(0)
    setCopied(false)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [draft])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const addInvitee = (contact: ShareContact) => {
    setInvitees((prev) => (prev.some((c) => c.id === contact.id) ? prev : [...prev, contact]))
    setDraft('')
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  const removeInvitee = (id: string) => {
    setInvitees((prev) => prev.filter((c) => c.id !== id))
  }

  const commitDraftTokens = (raw: string) => {
    const parts = raw.split(',')
    const remainder = parts.pop() ?? ''
    const toAdd: ShareContact[] = []
    for (const part of parts) {
      const contact = contactFromToken(part)
      if (contact) toAdd.push(contact)
    }
    if (toAdd.length > 0) {
      setInvitees((prev) => {
        const next = [...prev]
        for (const contact of toAdd) {
          if (!next.some((c) => c.id === contact.id)) next.push(contact)
        }
        return next
      })
    }
    setDraft(remainder.replace(/^\s+/, ''))
    setActiveIndex(0)
  }

  const onCopyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className={styles.root} role="presentation" data-lc-share-modal>
      <button type="button" className={styles.backdrop} aria-label="Close share dialog" onClick={onClose} />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.headerActions}>
            <button type="button" className={styles.copyLink} onClick={onCopyLink}>
              <Link size={16} weight="bold" aria-hidden />
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={20} weight="regular" aria-hidden />
            </button>
          </div>
        </div>

        <div className={styles.inviteRow}>
          <div className={styles.field}>
            {invitees.map((person) => (
              <span key={person.id} className={styles.chip}>
                <span className={styles.chipAvatar} style={{ background: person.accent }} aria-hidden>
                  {person.initial}
                </span>
                <span className={styles.chipLabel}>{person.name}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Remove ${person.name}`}
                  onClick={() => removeInvitee(person.id)}
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              className={styles.input}
              value={draft}
              placeholder={
                invitees.length === 0 ? 'Add comma separated emails to invite' : 'Add another…'
              }
              aria-label="Invite by name or email"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              onChange={(e) => {
                const value = e.target.value
                if (value.includes(',')) commitDraftTokens(value)
                else setDraft(value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && suggestions.length > 0) {
                  e.preventDefault()
                  setActiveIndex((i) => (i + 1) % suggestions.length)
                  return
                }
                if (e.key === 'ArrowUp' && suggestions.length > 0) {
                  e.preventDefault()
                  setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (suggestions[activeIndex]) {
                    addInvitee(suggestions[activeIndex])
                    return
                  }
                  const contact = contactFromToken(draft)
                  if (contact) addInvitee(contact)
                  return
                }
                if (e.key === 'Backspace' && draft === '' && invitees.length > 0) {
                  e.preventDefault()
                  removeInvitee(invitees[invitees.length - 1].id)
                }
              }}
            />
            {suggestions.length > 0 ? (
              <div className={styles.suggestions} role="listbox" aria-label="People suggestions">
                {suggestions.map((person, index) => (
                  <button
                    key={person.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`${styles.suggestion}${
                      index === activeIndex ? ` ${styles.suggestionActive}` : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => addInvitee(person)}
                  >
                    <span className={styles.suggestionAvatar} style={{ background: person.accent }} aria-hidden>
                      {person.initial}
                    </span>
                    <span className={styles.suggestionText}>
                      <span className={styles.suggestionName}>{person.name}</span>
                      <span className={styles.suggestionEmail}>{person.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className={styles.inviteBtn} disabled={!canInvite}>
            Share
          </button>
        </div>

        {frequent.length > 0 ? (
          <div className={styles.frequent}>
            <p className={styles.frequentLabel}>Frequently contacted</p>
            <div className={styles.frequentRow}>
              {frequent.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={styles.frequentChip}
                  onClick={() => addInvitee(person)}
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  <span>{person.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className={styles.footnote}>
          Recipients get a link to a copy of this chat — including the full history and
          outputs. They can continue the conversation on their own copy without changing
          yours.
        </p>
      </div>
    </div>,
    document.body,
  )
}
