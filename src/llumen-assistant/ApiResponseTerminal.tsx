import styles from './ApiResponseTerminal.module.css'

type JsonTone = 'key' | 'str' | 'num' | 'punct'

type JsonPart = {
  text: string
  tone?: JsonTone
}

type JsonLine = {
  parts: JsonPart[]
}

const DEMO_META = {
  status: '200 OK',
  time: '245ms',
  size: '1.2 KB',
}

/** Demo weather payload paired with the API Source tab preview. */
const DEMO_JSON_LINES: JsonLine[] = [
  { parts: [{ text: '{', tone: 'punct' }] },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"location"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '"New York"', tone: 'str' },
      { text: ',', tone: 'punct' },
    ],
  },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"temperature"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '22.5', tone: 'num' },
      { text: ',', tone: 'punct' },
    ],
  },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"humidity"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '65', tone: 'num' },
      { text: ',', tone: 'punct' },
    ],
  },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"description"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '"Partly cloudy"', tone: 'str' },
      { text: ',', tone: 'punct' },
    ],
  },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"wind_speed"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '12.3', tone: 'num' },
      { text: ',', tone: 'punct' },
    ],
  },
  {
    parts: [
      { text: '  ', tone: 'punct' },
      { text: '"timestamp"', tone: 'key' },
      { text: ': ', tone: 'punct' },
      { text: '"2024-01-15T14:30:00Z"', tone: 'str' },
    ],
  },
  { parts: [{ text: '}', tone: 'punct' }] },
]

function toneClass(tone?: JsonTone) {
  if (tone === 'key') return styles.jsonKey
  if (tone === 'str') return styles.jsonStr
  if (tone === 'num') return styles.jsonNum
  return undefined
}

export function ApiResponseTerminal() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h3 className={styles.title}>Response</h3>
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>Status:</dt>
            <dd className={styles.statusOk}>{DEMO_META.status}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Time:</dt>
            <dd>{DEMO_META.time}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Size:</dt>
            <dd>{DEMO_META.size}</dd>
          </div>
        </dl>
      </header>

      <pre className={styles.terminal} tabIndex={0}>
        <code>
          {DEMO_JSON_LINES.map((line, index) => (
            <span key={index} className={styles.line}>
              {line.parts.map((part, partIndex) => (
                <span key={`${index}-${partIndex}`} className={toneClass(part.tone)}>
                  {part.text}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
