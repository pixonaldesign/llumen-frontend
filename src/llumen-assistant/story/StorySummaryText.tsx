import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { AnimatedNumber } from './StoryCharts'

/** Text, a number (tweened when shown in full), or an emphasised run of either. */
export type SummaryPart = string | number | { em: (string | number)[] }

type Props = {
  parts: SummaryPart[]
  /** Types the text out from the start, with the AI gradient, over `durationMs`. */
  typing: boolean
  durationMs: number
  format: (value: number) => string
  className: string
  emphasisClassName: string
  typingClassName: string
}

export function StorySummaryText({
  parts,
  typing,
  durationMs,
  format,
  className,
  emphasisClassName,
  typingClassName,
}: Props) {
  const [progress, setProgress] = useState(typing ? 0 : 1)
  const [typingShown, setTypingShown] = useState(typing)
  if (typingShown !== typing) {
    setTypingShown(typing)
    setProgress(typing ? 0 : 1)
  }

  useEffect(() => {
    if (!typing) return
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setProgress(t)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [typing, durationMs])

  const runs = parts.flatMap((part, group) =>
    (typeof part === 'object' ? part.em : [part]).map((value) => ({
      value,
      text: typeof value === 'number' ? format(value) : value,
      group,
      em: typeof part === 'object',
    })),
  )
  const shown: string[] = []
  let left = typing ? Math.ceil(progress * runs.reduce((sum, item) => sum + item.text.length, 0)) : Infinity
  for (const item of runs) {
    shown.push(item.text.slice(0, Math.max(0, left)))
    left -= item.text.length
  }
  const content = (index: number): ReactNode => {
    const { value } = runs[index]
    return !typing && typeof value === 'number' ? (
      <AnimatedNumber key={index} value={value} format={format} />
    ) : (
      <Fragment key={index}>{shown[index]}</Fragment>
    )
  }

  return (
    <p className={typing ? `${className} ${typingClassName}` : className} aria-busy={typing || undefined}>
      {parts.map((_part, group) => {
        const indexes = runs.flatMap((item, index) => (item.group === group ? [index] : []))
        if (!indexes.some((index) => shown[index])) return null
        return runs[indexes[0]].em ? (
          <em key={group} className={emphasisClassName}>
            {indexes.map(content)}
          </em>
        ) : (
          <Fragment key={group}>{indexes.map(content)}</Fragment>
        )
      })}
    </p>
  )
}
