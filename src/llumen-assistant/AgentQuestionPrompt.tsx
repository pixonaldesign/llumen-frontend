import { ArrowUp, PencilSimple, X } from '@phosphor-icons/react'
import { useState } from 'react'
import styles from './AgentQuestionPrompt.module.css'

export function AgentQuestionPrompt({
  prompt,
  options,
  questionIndex = 1,
  questionCount = 1,
  onAnswer,
  onDismiss,
}: {
  prompt: string
  options: { id: string; label: string }[]
  /** 1-based position among questions in this reply. */
  questionIndex?: number
  questionCount?: number
  onAnswer: (optionId: string, label: string) => void
  /** Clears the question without sending an answer. */
  onDismiss?: () => void
}) {
  const [choice, setChoice] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const choose = (optionId: string, label: string) => {
    if (choice) return
    setChoice(optionId)
    onAnswer(optionId, label)
  }

  const dismiss = () => {
    if (choice) return
    setDismissed(true)
    onDismiss?.()
  }

  const submitCustom = () => {
    const text = custom.trim()
    if (!text || choice) return
    choose('custom', text)
  }

  if (dismissed) return null

  const customText = custom.trim()
  const canSubmitCustom = customText.length > 0 && choice == null

  return (
    <div className={styles.card} role="group" aria-label={prompt}>
      <div className={styles.head}>
        <p className={styles.question}>{prompt}</p>
        <div className={styles.headActions}>
          {questionCount > 1 ? (
            <span className={styles.progress}>
              {questionIndex} of {questionCount}
            </span>
          ) : null}
          <button type="button" className={styles.close} aria-label="Dismiss question" onClick={dismiss}>
            <X size={14} />
          </button>
        </div>
      </div>
      <ol className={styles.options}>
        {options.map((option, index) => {
          const selected = choice === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                className={styles.option}
                data-selected={selected ? 'true' : 'false'}
                aria-pressed={selected}
                disabled={choice != null}
                onClick={() => choose(option.id, option.label)}
              >
                <span className={styles.num}>{index + 1}</span>
                <span className={styles.label}>{option.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <form
        className={styles.custom}
        onSubmit={(event) => {
          event.preventDefault()
          submitCustom()
        }}
      >
        <PencilSimple size={16} className={styles.pencil} aria-hidden />
        <input
          className={styles.customInput}
          value={choice === 'custom' ? custom : choice ? '' : custom}
          placeholder="Something else"
          aria-label="Something else"
          disabled={choice != null}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            submitCustom()
          }}
        />
        {canSubmitCustom ? (
          <button type="submit" className={styles.send} aria-label="Send answer">
            <ArrowUp size={18} weight="bold" />
          </button>
        ) : (
          <button type="button" className={styles.skip} disabled={choice != null} onClick={dismiss}>
            Skip
          </button>
        )}
      </form>
    </div>
  )
}
