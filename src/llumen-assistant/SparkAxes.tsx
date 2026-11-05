import type { CSSProperties, ReactNode } from 'react'
import type { SparkTick } from './sparkScale'
import s from './SparkAxes.module.css'

/** Axes around a sparkline: `y` labels top to bottom on evenly spaced ticks, `x` labels at their points. */
export function SparkAxes({
  y,
  x,
  className,
  children,
}: {
  y: string[]
  x: SparkTick[]
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`${s.frame}${className ? ` ${className}` : ''}`}
      style={{ '--spark-steps': Math.max(1, y.length - 1) } as CSSProperties}
    >
      <div className={s.yAxis} aria-hidden>
        {y.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className={s.plot}>{children}</div>
      <div className={s.xAxis} aria-hidden>
        {x.map((tick) => (
          <span key={tick.at} style={{ left: `${tick.at}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  )
}
