import { useState } from 'react'
import { Check, PaperPlaneRight, X } from '@phosphor-icons/react'
import type { ChatExchange, ChatExpects, ChatReply } from './chatMessage'
import { buttonClass, inputClass } from './configStyles'
import styles from './ChatPreview.module.css'

type ComposerProps = {
  expects: ChatExpects
  /** Absent where the reply can't be sent from, e.g. a run with no chat session. */
  onReply?: (reply: ChatReply) => void
}

/** What the chat offers the user under a Send and wait bubble: a reply box, or the two approval buttons. */
function ChatComposer({ expects, onReply }: ComposerProps) {
  const [text, setText] = useState('')
  const disabled = !onReply
  if (expects.type === 'approval') {
    return (
      <div className={styles.composer}>
        <button type="button" className={buttonClass()} disabled={disabled} onClick={() => onReply?.({ type: 'approval', approved: false })}>
          <X size={12} weight="bold" aria-hidden />
          {expects.rejectLabel}
        </button>
        <button type="button" className={buttonClass('primary')} disabled={disabled} onClick={() => onReply?.({ type: 'approval', approved: true })}>
          <Check size={12} weight="bold" aria-hidden />
          {expects.approveLabel}
        </button>
      </div>
    )
  }
  const send = () => {
    if (text.trim()) onReply?.({ type: 'free_text', text: text.trim() })
  }
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <input
        className={inputClass}
        value={text}
        placeholder={disabled ? 'The user types a reply' : 'Type the reply…'}
        aria-label="Reply"
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit" className={buttonClass('primary')} disabled={disabled || !text.trim()}>
        <PaperPlaneRight size={12} weight="fill" aria-hidden />
        Send
      </button>
    </form>
  )
}

/** The step's bubble as the chat shows it, then the reply it got, or what the user is offered to answer with. */
export function ChatPreview({ chat, onReply, className }: { chat: ChatExchange; onReply?: (reply: ChatReply) => void; className?: string }) {
  const waiting = chat.posted && chat.expects && !chat.reply
  return (
    <div className={`${styles.chat} ${className ?? ''}`}>
      <p className={styles.status}>
        {!chat.posted ? 'Not posted: this run didn’t start from a chat' : waiting ? 'Posted · waiting for a reply' : 'Posted in the chat'}
      </p>
      <p className={styles.bubble} data-muted={!chat.posted || undefined}>
        {chat.message}
      </p>
      {chat.reply ? (
        <p className={styles.reply} data-approved={chat.reply.approved === undefined ? undefined : String(chat.reply.approved)}>
          {chat.reply.approved === undefined ? null : chat.reply.approved ? <Check size={12} weight="bold" aria-hidden /> : <X size={12} weight="bold" aria-hidden />}
          {chat.reply.text}
        </p>
      ) : chat.expects ? (
        <div className={styles.offer}>
          {chat.posted ? null : <p className={styles.status}>In a chat, the user would answer with</p>}
          <ChatComposer expects={chat.expects} onReply={waiting ? onReply : undefined} />
        </div>
      ) : null}
    </div>
  )
}
