import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import type { StudioAsset } from './studioData'
import { STUDIO_ASSET_CHARTS } from './studioAssetCharts'
import { PREVIEW_STATE, STATUS_TONE, STUDIO_ASSET_VISUALS, type StudioVisual } from './studioAssetVisuals'
import { StudioAssetChart } from './StudioAssetChart'
import styles from './StudioAssetVisual.module.css'

/** The SVG charts' artwork size; HTML visuals are laid out at it too so every kind scales the same in a card. */
const W = 380
const H = 184
const PAD = 12
const RIGHT_EDGE = 368

/** How long a card waits for its data before it counts as failed. */
const LOAD_TIMEOUT_MS = 15_000
const RETRY_MS = 900

type DataState = 'ready' | 'loading' | 'retrying' | 'error'

/** An asset's visual: its live chart, its laid-out table, grid or map, or its thumbnail. */
export function StudioAssetVisual({ asset, delay = 0 }: { asset: StudioAsset; delay?: number }) {
  const [state, setState] = useState<DataState>(() =>
    PREVIEW_STATE === 'loading' || PREVIEW_STATE === 'error' ? PREVIEW_STATE : 'ready',
  )
  useEffect(() => {
    if (state !== 'loading' && state !== 'retrying') return
    const timer = window.setTimeout(
      () => setState(state === 'loading' ? 'error' : 'ready'),
      state === 'loading' ? LOAD_TIMEOUT_MS : RETRY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [state])
  if (state === 'loading' || state === 'retrying')
    return <AssetSkeleton shape={skeletonShape(asset)} label={`${asset.title}, loading`} />
  if (state === 'error') return <AssetError asset={asset} onRetry={() => setState('retrying')} />
  const chart = STUDIO_ASSET_CHARTS[asset.id]
  if (chart) return <StudioAssetChart chart={chart} delay={delay} />
  const visual = STUDIO_ASSET_VISUALS[asset.id]
  if (visual) return <HtmlVisual visual={visual} delay={delay} />
  return <img src={asset.image} alt={asset.title} />
}

/** A list row's small preview: the asset's thumbnail when it has one, else its visual shrunk to fit. */
export function AssetThumb({ asset, className }: { asset: StudioAsset; className?: string }) {
  if (asset.image) return <img className={className} src={asset.image} alt="" loading="lazy" />
  return (
    <span className={`${styles.thumb}${className ? ` ${className}` : ''}`} aria-hidden>
      <StudioAssetVisual asset={asset} />
    </span>
  )
}

export type SkeletonShape = 'chart' | 'table' | 'map'

const BAR_HEIGHTS = [52, 78, 64, 96, 72, 108, 88, 116]

function skeletonShape(asset: StudioAsset): SkeletonShape {
  const visual = STUDIO_ASSET_VISUALS[asset.id]
  if (visual?.kind === 'table') return 'table'
  if (STUDIO_ASSET_CHARTS[asset.id]) return 'chart'
  return 'map'
}

/**
 * Placeholder in the shape of what's coming (title, headline and chart; rows; or a map), so nothing jumps on
 * arrival. Without a label it is decoration, for a card whose asset isn't known yet.
 */
export function AssetSkeleton({ shape = 'chart', label }: { shape?: SkeletonShape; label?: string }) {
  const barW = (RIGHT_EDGE - PAD - 7 * 10) / BAR_HEIGHTS.length
  return (
    <div className={styles.visual}>
      <svg
        className={`${styles.svg} ${styles.skeleton}`}
        viewBox={`0 0 ${W} ${H}`}
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        {shape === 'map' ? <rect x={0} y={0} width={W} height={H} className={styles.skeletonFaint} /> : null}
        <rect x={PAD} y={12} width={168} height={12} rx={6} className={styles.skeletonBlock} />
        {shape === 'chart' ? (
          <>
            <rect x={PAD} y={38} width={112} height={26} rx={8} />
            {BAR_HEIGHTS.map((h, i) => (
              <rect key={i} x={PAD + i * (barW + 10)} y={H - 12 - h} width={barW} height={h} rx={4} />
            ))}
          </>
        ) : null}
        {shape === 'table' ? (
          <>
            <rect x={PAD} y={36} width={W - 2 * PAD} height={16} rx={4} className={styles.skeletonBlock} />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={PAD} y={62 + i * 23} width={W - 2 * PAD - (i % 2) * 64} height={11} rx={5} />
            ))}
          </>
        ) : null}
      </svg>
    </div>
  )
}

/** A card whose data didn't arrive: its title stays, so you know which asset failed, with a retry for just this card. */
function AssetError({ asset, onRetry }: { asset: StudioAsset; onRetry: () => void }) {
  return (
    <div className={styles.visual}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${asset.title}, couldn't load data`}>
        <foreignObject x={0} y={0} width={W} height={H}>
          <div className={`${styles.stage} ${styles.error}`}>
            <p className={styles.head}>
              <span className={styles.title}>{asset.title}</span>
            </p>
            <div className={styles.errorBody}>
              <WarningCircle size={22} className={styles.errorIcon} aria-hidden />
              <span className={styles.errorTitle}>Couldn't load data</span>
              <span className={styles.errorDetail}>The source didn't respond</span>
              <button
                type="button"
                className={styles.retry}
                onClick={(event) => {
                  event.stopPropagation()
                  onRetry()
                }}
              >
                <ArrowClockwise size={14} aria-hidden />
                Retry
              </button>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}

function HtmlVisual({ visual, delay }: { visual: StudioVisual; delay: number }) {
  const [play, setPlay] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <div className={styles.visual} data-play={play} style={{ ['--d' as string]: `${delay}ms` } as CSSProperties}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={visual.title}>
        <foreignObject x={0} y={0} width={W} height={H}>
          <div className={styles.stage}>
            <VisualBody visual={visual} />
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}

function VisualBody({ visual }: { visual: StudioVisual }) {
  switch (visual.kind) {
    case 'table':
      return <Table visual={visual} />
    case 'map':
      return <MapShot visual={visual} />
  }
}

type Of<K extends StudioVisual['kind']> = Extract<StudioVisual, { kind: K }>

/** From this many columns the table outgrows the card: it scrolls sideways and its first column stays put. */
const WIDE_TABLE = 5

/**
 * Every column sizes to its own content. Text wraps to two lines past a cap, with the full value as a tooltip;
 * `fr` tracks are avoided because in a content-sized grid they all grow to the widest one.
 */
function Table({ visual }: { visual: Of<'table'> }) {
  const template = visual.columns
    .map((column) => (column.align === 'end' || column.status ? 'max-content' : 'auto'))
    .join(' ')
  const total = visual.total ?? visual.rows.length
  return (
    <div className={styles.tableLayout}>
      <p className={styles.head}>
        <span className={styles.title}>{visual.title}</span>
        <span className={styles.count}>
          {total.toLocaleString('en-US')} rows · {visual.columns.length} cols
        </span>
      </p>
      <div
        className={styles.tableScroll}
        data-wide={visual.columns.length >= WIDE_TABLE}
        role="table"
        aria-label={visual.title}
        aria-rowcount={total + 1}
      >
        <div className={styles.tableGrid} style={{ gridTemplateColumns: template }}>
          <div className={styles.tableRow} role="row">
            {visual.columns.map((column) => (
              <span
                key={column.label}
                role="columnheader"
                className={styles.th}
                data-align={column.align ?? 'start'}
                title={column.label}
              >
                <span className={styles.cellText}>{column.label}</span>
              </span>
            ))}
          </div>
          {visual.rows.map((row, r) => (
            <div key={r} className={`${styles.tableRow} ${styles.fadeIn}`} style={stagger(r, 35)} role="row">
              {row.map((cell, c) => {
                const column = visual.columns[c]
                const empty = cell === '—'
                return (
                  <span
                    key={c}
                    role="cell"
                    className={`${styles.td}${column.mono ? ` ${styles.mono}` : ''}`}
                    data-align={column.align ?? 'start'}
                    data-empty={empty || undefined}
                    dir="auto"
                    title={cell}
                  >
                    {column.status && !empty ? (
                      <span className={styles.cellStatus} data-tone={STATUS_TONE[cell] ?? 'neutral'}>
                        {cell}
                      </span>
                    ) : (
                      <span className={styles.cellText}>{cell}</span>
                    )}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A captured frame of the map layer, framed like the assistant's inline map cards. */
function MapShot({ visual }: { visual: Of<'map'> }) {
  return (
    <div className={styles.map}>
      <img className={styles.mapImage} src={visual.src} alt="" loading="lazy" />
      <p className={styles.mapTitle}>{visual.title}</p>
    </div>
  )
}

function stagger(index: number, step: number): CSSProperties {
  return { ['--i' as string]: `${index * step}ms` } as CSSProperties
}
