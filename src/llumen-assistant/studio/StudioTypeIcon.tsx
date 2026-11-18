import type { ReactNode } from 'react'

type Glyph =
  | 'line'
  | 'area'
  | 'bar'
  | 'hbar'
  | 'stacked'
  | 'donut'
  | 'scatter'
  | 'polar'
  | 'range'
  | 'kpi'
  | 'kpiGrid'
  | 'gauge'
  | 'progress'
  | 'table'
  | 'anomaly'
  | 'clusters'
  | 'points'
  | 'discs'
  | 'fences'
  | 'heatmap'
  | 'pillars'
  | 'arcs'
  | 'wind'

/** Close variants share a glyph so the set stays small; unknown types read as a line chart. */
const GLYPH_BY_TYPE: Record<string, Glyph> = {
  'Line Chart': 'line',
  'Area Chart': 'area',
  'Bar Chart': 'bar',
  'Horizontal Bar': 'hbar',
  'Stacked Bar': 'stacked',
  'Donut Chart': 'donut',
  'Scatter Chart': 'scatter',
  Polar: 'polar',
  Range: 'range',
  KPI: 'kpi',
  'KPI Grid': 'kpiGrid',
  Gauge: 'gauge',
  'Radial Gauge': 'gauge',
  'Score Indicator': 'gauge',
  'Progress Bar': 'progress',
  Table: 'table',
  'Anomaly Detection': 'anomaly',
  'DBSCAN Clusters': 'clusters',
  Points: 'points',
  Discs: 'discs',
  Area: 'fences',
  Fences: 'fences',
  Heatmap: 'heatmap',
  'Heatmap Field': 'heatmap',
  Pillars: 'pillars',
  Arcs: 'arcs',
  Wind: 'wind',
}

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const dot = { fill: 'currentColor' } as const

/** Drawn on a 16 px grid with the top bar icons' 1.4 px stroke. */
const GLYPHS: Record<Glyph, ReactNode> = {
  line: <path {...line} d="M1.5 12 5 7.5l3 2.5 6.5-6.5" />,
  area: (
    <>
      <path d="M1.5 13.5V12L5 7.5l3 2.5 6.5-6.5v10z" fill="currentColor" opacity={0.25} />
      <path {...line} d="M1.5 12 5 7.5l3 2.5 6.5-6.5" />
    </>
  ),
  bar: <path {...line} strokeWidth={2.2} d="M3 14V8M6.5 14V4M10 14V9.5M13.5 14V6" />,
  hbar: <path {...line} strokeWidth={2} d="M2 3.5h9M2 7h12M2 10.5h6M2 14h10" />,
  stacked: (
    <>
      <path {...line} strokeWidth={2.4} d="M3.5 14V9M8 14V7M12.5 14V10" />
      <path {...line} strokeWidth={2.4} opacity={0.45} d="M3.5 8V5M8 6V2.5M12.5 9V6.5" />
    </>
  ),
  donut: (
    <>
      <circle {...line} strokeWidth={2.4} opacity={0.35} cx={8} cy={8} r={5.5} />
      <path {...line} strokeWidth={2.4} d="M8 2.5a5.5 5.5 0 0 1 5.2 7.3" />
    </>
  ),
  scatter: (
    <>
      <circle {...dot} cx={3.5} cy={11.5} r={1.2} />
      <circle {...dot} cx={6} cy={8} r={1.2} />
      <circle {...dot} cx={8.5} cy={10} r={1.2} />
      <circle {...dot} cx={10.5} cy={5.5} r={1.2} />
      <circle {...dot} cx={13} cy={3.5} r={1.2} />
    </>
  ),
  polar: (
    <>
      <circle {...line} opacity={0.45} cx={8} cy={8} r={6} />
      <path {...line} strokeWidth={2} d="M8 8V3M8 8l4 2.5M8 8l-3.5 3" />
    </>
  ),
  range: <path {...line} d="M3.5 4v8M2.5 4h2M2.5 12h2M8 2.5v7M7 2.5h2M7 9.5h2M12.5 5v8M11.5 5h2M11.5 13h2" />,
  kpi: (
    <>
      <rect {...line} x={1.5} y={2.5} width={13} height={11} rx={2.5} />
      <path {...line} d="M4.5 10.5 7 8l1.5 1.5 3-3M9.5 6.5h2v2" />
    </>
  ),
  kpiGrid: (
    <>
      <rect {...line} x={1.5} y={1.5} width={5.5} height={5.5} rx={1.5} />
      <rect {...line} x={9} y={1.5} width={5.5} height={5.5} rx={1.5} />
      <rect {...line} x={1.5} y={9} width={5.5} height={5.5} rx={1.5} />
      <rect {...line} x={9} y={9} width={5.5} height={5.5} rx={1.5} />
    </>
  ),
  gauge: (
    <>
      <path {...line} d="M2 11.5a6 6 0 0 1 12 0M8 11.5 11 6.5" />
      <circle {...dot} cx={8} cy={11.5} r={1.2} />
    </>
  ),
  progress: (
    <>
      <rect {...line} x={1.5} y={6} width={13} height={4} rx={2} />
      <path {...line} strokeWidth={2.2} d="M3.5 8h5.5" />
    </>
  ),
  table: (
    <>
      <rect {...line} x={1.5} y={2.5} width={13} height={11} rx={2} />
      <path {...line} d="M1.5 6h13M1.5 9.5h13M6 2.5v11" />
    </>
  ),
  anomaly: (
    <>
      <g opacity={0.6}>
        <circle {...dot} cx={3} cy={11} r={1} />
        <circle {...dot} cx={5.5} cy={9.5} r={1} />
        <circle {...dot} cx={7.5} cy={11.5} r={1} />
        <circle {...dot} cx={4.5} cy={13} r={1} />
      </g>
      <circle {...line} cx={12} cy={4} r={2.4} />
      <circle {...dot} cx={12} cy={4} r={1} />
    </>
  ),
  clusters: (
    <>
      <circle {...line} strokeDasharray="1.6 1.6" cx={5} cy={5} r={3.4} />
      <circle {...line} strokeDasharray="1.6 1.6" cx={11} cy={11} r={3.4} />
      <circle {...dot} cx={4.2} cy={4.6} r={0.9} />
      <circle {...dot} cx={6} cy={5.6} r={0.9} />
      <circle {...dot} cx={10.4} cy={10.6} r={0.9} />
      <circle {...dot} cx={12} cy={11.6} r={0.9} />
    </>
  ),
  points: (
    <>
      <path {...line} d="M8 14.5s4.5-4.3 4.5-8a4.5 4.5 0 0 0-9 0c0 3.7 4.5 8 4.5 8z" />
      <circle {...line} cx={8} cy={6.5} r={1.6} />
    </>
  ),
  discs: (
    <>
      <circle {...line} cx={5} cy={10} r={3.5} />
      <circle {...line} cx={11.5} cy={5} r={2.2} />
      <circle {...dot} cx={12.5} cy={12} r={1.3} />
    </>
  ),
  fences: <path {...line} d="M2.5 5 7 2l6.5 3-1 7-6.5 2.5L2 10z" />,
  heatmap: (
    <>
      <circle cx={6} cy={9} r={4.5} fill="currentColor" opacity={0.2} />
      <circle cx={6} cy={9} r={2.2} fill="currentColor" opacity={0.5} />
      <circle cx={11.5} cy={5} r={2.6} fill="currentColor" opacity={0.3} />
    </>
  ),
  pillars: (
    <>
      <path {...line} opacity={0.45} d="M1.5 12.5 8 15l6.5-2.5" />
      <path {...line} strokeWidth={2.2} d="M4 12V7M8 13.5V3M12 12V8.5" />
    </>
  ),
  arcs: (
    <>
      <path {...line} d="M3 12C4 4 12 4 13 12" />
      <circle {...dot} cx={3} cy={12} r={1.4} />
      <circle {...dot} cx={13} cy={12} r={1.4} />
    </>
  ),
  wind: <path {...line} d="M1.5 5.5h8a2 2 0 1 0-2-2M1.5 8.5h11a2 2 0 1 1-2 2M1.5 11.5h5" />,
}

/** The icon for an asset type, beside its name in type chips. */
export function StudioTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ flex: 'none' }}>
      {GLYPHS[GLYPH_BY_TYPE[type] ?? 'line']}
    </svg>
  )
}
