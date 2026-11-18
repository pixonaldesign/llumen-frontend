import { useEffect, useState, type CSSProperties } from 'react'
import type { StudioAsset } from './studioData'
import { STUDIO_ASSET_CHARTS } from './studioAssetCharts'
import { STUDIO_ASSET_VISUALS, type StudioVisual } from './studioAssetVisuals'
import { StudioAssetChart } from './StudioAssetChart'
import styles from './StudioAssetVisual.module.css'

/** The SVG charts' artwork size; HTML visuals are laid out at it too so every kind scales the same in a card. */
const W = 380
const H = 184

/** An asset's visual: its live chart, its laid-out table, grid, analytics or map, or its thumbnail. */
export function StudioAssetVisual({ asset, delay = 0 }: { asset: StudioAsset; delay?: number }) {
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
    case 'kpiGrid':
      return <KpiGrid visual={visual} />
    case 'analytics':
      return <Analytics visual={visual} />
    case 'map':
      return <MapShot visual={visual} />
  }
}

type Of<K extends StudioVisual['kind']> = Extract<StudioVisual, { kind: K }>

function Table({ visual }: { visual: Of<'table'> }) {
  const template = visual.columns.map((column) => (column.align === 'end' ? 'auto' : 'minmax(0, 1fr)')).join(' ')
  return (
    <div className={styles.tableLayout}>
      <p className={styles.head}>
        <span className={styles.title}>{visual.title}</span>
        <span className={styles.count}>{visual.rows.length} rows</span>
      </p>
      <div className={styles.tableScroll} role="table" aria-label={visual.title}>
        <div className={styles.tableGrid} style={{ gridTemplateColumns: template }}>
          <div className={styles.tableRow} role="row">
            {visual.columns.map((column) => (
              <span
                key={column.label}
                role="columnheader"
                className={styles.th}
                data-align={column.align ?? 'start'}
              >
                {column.label}
              </span>
            ))}
          </div>
          {visual.rows.map((row, r) => (
            <div key={r} className={`${styles.tableRow} ${styles.fadeIn}`} style={stagger(r, 35)} role="row">
              {row.map((cell, c) => (
                <span
                  key={c}
                  role="cell"
                  className={`${styles.td}${visual.columns[c].mono ? ` ${styles.mono}` : ''}`}
                  data-align={visual.columns[c].align ?? 'start'}
                  title={cell}
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiGrid({ visual }: { visual: Of<'kpiGrid'> }) {
  return (
    <div className={styles.kpiLayout}>
      <p className={styles.head}>
        <span className={styles.title}>{visual.title}</span>
      </p>
      <div className={styles.tiles}>
        {visual.tiles.map((tile, i) => (
          <div key={tile.label} className={`${styles.tile} ${styles.fadeIn}`} style={stagger(i, 80)} data-tone={tile.tone}>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>
              {tile.value}
              <span className={styles.tileUnit}>{tile.unit}</span>
            </span>
            <span className={styles.tileStatus}>{tile.status}</span>
          </div>
        ))}
      </div>
      <p className={`${styles.caption} ${styles.fadeIn}`} style={stagger(3, 80)}>
        {visual.caption}
      </p>
    </div>
  )
}

function Analytics({ visual }: { visual: Of<'analytics'> }) {
  return (
    <div className={styles.analyticsLayout}>
      <p className={styles.head}>
        <span className={styles.title}>{visual.title}</span>
      </p>
      <p className={styles.source}>
        <span className={styles.model}>{visual.model}</span>
        <span className={styles.layer}>on {visual.layer}</span>
      </p>
      <div className={styles.stats}>
        {visual.stats.map((stat, i) => (
          <div key={stat.label} className={`${styles.stat} ${styles.fadeIn}`} style={stagger(i, 70)}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
            <span className={styles.statTrack}>
              {stat.ratio != null ? (
                <span className={styles.statFill} style={{ width: `${Math.max(3, stat.ratio * 100)}%` }} />
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <p className={`${styles.caption} ${styles.summary} ${styles.fadeIn}`} style={stagger(4, 70)}>
        {visual.summary}
      </p>
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
