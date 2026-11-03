import type { CSSProperties, ReactNode, Ref } from 'react'
import styles from './CodeEditor.module.css'

const SQL_KEYWORDS = new Set(
  (
    'select from where and or not in is null like ilike between as on join left right inner outer full cross union all distinct ' +
    'group by order having limit offset asc desc case when then else end with exists true false interval cast over partition ' +
    'count sum avg min max coalesce date_trunc extract now'
  ).split(' '),
)

const TOKEN = /(--.*)|('(?:[^']|'')*'?)|(\{\{[^}]*\}{0,2})|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g

function highlight(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    const [text, comment, string, template, number, word] = match
    const kind = comment
      ? 'comment'
      : string
        ? 'string'
        : template
          ? 'template'
          : number
            ? 'number'
            : word && SQL_KEYWORDS.has(word.toLowerCase())
              ? 'keyword'
              : null
    if (!kind) continue
    if (match.index > last) parts.push(line.slice(last, match.index))
    parts.push(
      <span key={match.index} data-token={kind}>
        {text}
      </span>,
    )
    last = match.index + text.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

type CodeEditorProps = {
  id?: string
  ref?: Ref<HTMLTextAreaElement>
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** The height it starts at, in lines; it grows with the code. */
  rows?: number
  invalid?: boolean
  disabled?: boolean
}

/** A SQL field drawn as code: line numbers, highlighting, and lines that wrap under their number. */
export function CodeEditor({ id, ref, value, onChange, placeholder, rows = 6, invalid, disabled }: CodeEditorProps) {
  const lines = value.split('\n')
  return (
    <div className={styles.editor} style={{ '--rows': rows } as CSSProperties}>
      <pre className={styles.code} aria-hidden>
        {lines.map((line, index) => (
          <span key={index} className={styles.line} data-line={index + 1}>
            {highlight(line)}
          </span>
        ))}
      </pre>
      <textarea
        id={id}
        ref={ref}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
