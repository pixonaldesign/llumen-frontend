import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { visualTypeById } from '../../asset-builder/visualCatalog'
import { BRIEFING_ASSETS, type AssetSlice, type BriefingAsset } from './briefingAssetData'
import styles from './BriefingAssets.module.css'

/** Cards rise one after another; each chart starts once its card has mostly landed. */
const CARD_STAGGER_MS = 70
const CHART_LAG_MS = 280
const COUNT_MS = 1200

const SIZE_CLASS = { small: styles.small, medium: styles.medium, large: styles.large } as const

type Play = { play: boolean; delay: number }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function BriefingAssetGrid({
  play,
  interactive,
  onOpenStory,
}: {
  /** Plays the entrance; turning it off resets so the next entrance replays. */
  play: boolean
  interactive: boolean
  onOpenStory?: (storyId: string) => void
}) {
  const [reduce] = useState(prefersReducedMotion)
  const playing = play || reduce
  return (
    <div className={styles.grid} data-play={playing}>
      {BRIEFING_ASSETS.map((asset, index) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          play={playing}
          delay={reduce ? 0 : index * CARD_STAGGER_MS}
          interactive={interactive}
          onOpenStory={onOpenStory}
        />
      ))}
    </div>
  )
}

function AssetCard({
  asset,
  play,
  delay,
  interactive,
  onOpenStory,
}: Play & { asset: BriefingAsset; interactive: boolean; onOpenStory?: (storyId: string) => void }) {
  const visual = asset.visualLabel ?? visualTypeById(asset.visualTypeId)?.label ?? 'Asset'
  const chart = { play, delay: delay + CHART_LAG_MS }
  return (
    <article
      className={`${styles.card} ${SIZE_CLASS[asset.size]}`}
      style={{ ['--accent' as string]: asset.accent, ['--d' as string]: `${delay}ms` } as CSSProperties}
    >
      <header className={styles.cardHead}>
        <span className={styles.category}>{asset.category}</span>
        <h3 className={styles.cardTitle}>{asset.title}</h3>
      </header>
      <div className={styles.body}>
        <AssetVisual asset={asset} {...chart} />
      </div>
      <footer className={styles.foot}>{visual}</footer>
      {asset.storyId ? (
        <button
          type="button"
          className={styles.cardLink}
          tabIndex={interactive ? 0 : -1}
          aria-label={`Open ${asset.title}`}
          onClick={() => onOpenStory?.(asset.storyId!)}
        />
      ) : null}
    </article>
  )
}

function AssetVisual({ asset, play, delay }: Play & { asset: BriefingAsset }) {
  switch (asset.kind) {
    case 'area':
      return <AreaVisual asset={asset} play={play} delay={delay} />
    case 'hbar':
      return (
        <ul className={styles.hbars}>
          {asset.bars.map((bar, i) => (
            <li key={bar.label} className={styles.hbar} style={{ ['--i' as string]: i }}>
              <span className={styles.hbarLabel}>{bar.label}</span>
              <span className={styles.track}>
                <span className={styles.fill} style={{ width: `${(bar.value / asset.bars[0].value) * 100}%` }} />
              </span>
              <span className={styles.hbarValue}>
                +{bar.value} {asset.unit}
              </span>
            </li>
          ))}
        </ul>
      )
    case 'vbar': {
      const max = Math.max(...asset.bars.map((bar) => bar.value))
      return (
        <>
          <ValueRow value={asset.value} unit={asset.unit} delta={asset.delta} play={play} delay={delay} />
          <div className={styles.vbars}>
            {asset.bars.map((bar, i) => (
              <div key={bar.label} className={styles.vcol} style={{ ['--i' as string]: i }}>
                <span className={styles.vtrack}>
                  <span
                    className={`${styles.vfill}${bar.value === max ? ` ${styles.vfillPeak}` : ''}`}
                    style={{ height: `${(bar.value / max) * 100}%` }}
                  />
                </span>
                <span className={styles.vlabel}>{bar.label}</span>
              </div>
            ))}
          </div>
        </>
      )
    }
    case 'donut':
      return (
        <Ring slices={asset.slices} pie={false}>
          <strong>{asset.centre}</strong>
          <span>{asset.centreLabel}</span>
        </Ring>
      )
    case 'pie':
      return <Ring slices={asset.slices} pie />
    case 'kpi':
      return (
        <>
          <p className={`${styles.value} ${styles.kpiValue}`}>
            {asset.prefix}
            <CountUp value={asset.value} play={play} delay={delay} />
            {asset.suffix}
          </p>
          <p className={styles.caption}>{asset.caption}</p>
          <Sparkline points={asset.spark} />
        </>
      )
    case 'kpiGrid':
      return (
        <div className={styles.metrics}>
          {asset.metrics.map((metric, i) => (
            <div key={metric.label} className={styles.metric} style={{ ['--i' as string]: i }}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>
                <CountUp value={metric.value} play={play} delay={delay + i * 120} />
                {metric.suffix ? <small>{metric.suffix}</small> : null}
              </span>
              <span className={`${styles.metricDelta}${metric.good ? '' : ` ${styles.metricDeltaBad}`}`}>{metric.delta}</span>
            </div>
          ))}
        </div>
      )
    case 'gauge':
      return (
        <>
          <div className={styles.gauge}>
            <svg viewBox="0 0 120 72" aria-hidden>
              <path className={styles.gaugeTrack} d="M 12 64 A 48 48 0 0 1 108 64" />
              <path
                className={styles.gaugeFill}
                d="M 12 64 A 48 48 0 0 1 108 64"
                pathLength={100}
                style={{ ['--len' as string]: asset.value }}
              />
              <text className={styles.gaugeText} x="60" y="60" textAnchor="middle">
                <CountUp value={asset.value} play={play} delay={delay} />%
              </text>
            </svg>
          </div>
          <p className={styles.caption}>{asset.caption}</p>
        </>
      )
    case 'progress':
      return (
        <ul className={styles.progress}>
          {asset.rows.map((row, i) => (
            <li key={row.label} className={styles.progressRow} style={{ ['--i' as string]: i }}>
              <span className={styles.hbarLabel}>{row.label}</span>
              <span className={styles.hbarValue}>{row.pct}%</span>
              <span className={`${styles.track} ${styles.progressTrack}`}>
                <span className={styles.fill} style={{ width: `${row.pct}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )
  }
}

function AreaVisual({ asset, play, delay }: Play & { asset: Extract<BriefingAsset, { kind: 'area' }> }) {
  const gradientId = `aq${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const max = Math.max(...asset.points, asset.threshold.value) * 1.12
  const coords = asset.points.map((v, i): [number, number] => [(i / (asset.points.length - 1)) * 100, 40 - (v / max) * 40])
  const line = smoothPath(coords)
  const last = coords[coords.length - 1]
  return (
    <>
      <ValueRow value={asset.value} unit={asset.unit} delta={asset.delta} play={play} delay={delay} large />
      <div className={styles.plot}>
        <div className={styles.threshold} style={{ top: `${(1 - asset.threshold.value / max) * 100}%` }}>
          <span>
            {asset.threshold.label} · {asset.threshold.value}
          </span>
        </div>
        <svg className={styles.plotSvg} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={asset.accent} stopOpacity="0.5" />
              <stop offset="1" stopColor={asset.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,40 L0,40 Z`} fill={`url(#${gradientId})`} />
          <path className={styles.plotLine} d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.plotDot} style={{ left: `${last[0]}%`, top: `${(last[1] / 40) * 100}%` }} />
      </div>
      <div className={styles.axis}>
        {asset.axis.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </>
  )
}

function ValueRow({
  value,
  unit,
  delta,
  play,
  delay,
  large = false,
}: Play & { value: number; unit: string; delta: string; large?: boolean }) {
  return (
    <div className={styles.valueRow}>
      <span className={`${styles.value}${large ? ` ${styles.valueLarge}` : ''}`}>
        <CountUp value={value} play={play} delay={delay} />
      </span>
      <span className={styles.unit}>{unit}</span>
      <span className={styles.delta}>{delta}</span>
    </div>
  )
}

function Ring({ slices, pie, children }: { slices: AssetSlice[]; pie: boolean; children?: ReactNode }) {
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, slice) => sum + slice.pct, 0))
  const r = pie ? 25 : 46
  const box = pie ? 100 : 120
  const c = box / 2
  return (
    <div className={styles.ring}>
      <div className={styles.ringChart}>
        <svg viewBox={`0 0 ${box} ${box}`} aria-hidden>
          {pie ? null : <circle className={styles.ringTrack} cx={c} cy={c} r={r} />}
          {slices.map((slice, i) => (
            <circle
              key={slice.name}
              className={`${styles.ringSeg}${pie ? ` ${styles.pieSeg}` : ''}`}
              cx={c}
              cy={c}
              r={r}
              pathLength={100}
              transform={`rotate(-90 ${c} ${c})`}
              style={
                {
                  stroke: slice.color,
                  strokeDashoffset: -starts[i],
                  ['--len' as string]: Math.max(0, slice.pct - (pie ? 0 : 1.2)),
                  ['--i' as string]: i,
                } as CSSProperties
              }
            />
          ))}
        </svg>
        {children ? <div className={styles.ringCentre}>{children}</div> : null}
      </div>
      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.name}>
            <span className={styles.legendDot} style={{ background: slice.color }} />
            <span className={styles.legendName}>{slice.name}</span>
            <span className={styles.legendPct}>{slice.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points)
  const span = Math.max(1, Math.max(...points) - min)
  const coords = points.map((v, i): [number, number] => [(i / (points.length - 1)) * 100, 22 - ((v - min) / span) * 18])
  return (
    <div className={styles.spark}>
      <svg className={styles.plotSvg} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
        <path className={styles.plotLine} d={smoothPath(coords)} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function CountUp({ value, play, delay }: Play & { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!play) return
    if (prefersReducedMotion()) {
      const frame = window.requestAnimationFrame(() => setShown(value))
      return () => window.cancelAnimationFrame(frame)
    }
    const start = performance.now() + delay
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS))
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [play, delay, value])
  return <>{(play ? shown : 0).toLocaleString('en-US')}</>
}

/** Catmull-Rom through the points, as cubic Béziers. */
function smoothPath(points: [number, number][]) {
  const f = (n: number) => n.toFixed(2)
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}
