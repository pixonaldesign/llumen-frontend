/**
 * Assets the user built in Asset builder (Create → Asset) and follows from Briefing.
 * `visualTypeId` is the Asset builder visual type each one was created with.
 */
import { PALETTE, SERIES, STATUS } from '../gami/gamiTypes'

export type BriefingAssetSize = 'small' | 'medium' | 'large' | 'wide'

export type AssetSlice = { name: string; pct: number; color: string }

/** `display` replaces the bar's default `+value unit` text. */
export type AssetBar = { label: string; value: number; display?: string }

export type AssetMetric = { label: string; value: number; suffix?: string; delta: string; good: boolean }

export type AssetSeries = { name: string; color: string; points: number[] }

type AssetBase = {
  id: string
  visualTypeId: string
  size: BriefingAssetSize
  category: string
  title: string
  accent: string
}

export type BriefingAsset = AssetBase &
  (
    | {
        kind: 'area'
        value: number
        unit: string
        /** Unit after a point's value in its hover tooltip. */
        tipUnit: string
        delta: string
        threshold: { value: number; label: string }
        points: number[]
        axis: string[]
      }
    | {
        kind: 'line'
        value: number
        unit: string
        tipUnit: string
        delta: string
        /** One per point, shown in the hover tooltip. */
        labels: string[]
        points: number[]
        axis: string[]
      }
    | { kind: 'hbar'; unit: string; bars: AssetBar[] }
    | { kind: 'vbar'; value: number; unit: string; tipUnit: string; delta: string; bars: AssetBar[] }
    | { kind: 'donut'; centre: string; centreLabel: string; slices: AssetSlice[] }
    | { kind: 'pie'; slices: AssetSlice[] }
    | { kind: 'kpi'; value: number; prefix?: string; suffix?: string; caption: string; spark: number[] }
    | { kind: 'kpiGrid'; metrics: AssetMetric[] }
    | { kind: 'gauge'; value: number; caption: string; tipLabel?: string }
    | {
        kind: 'multiArea'
        /** Bottom of the value axis; the top is 100. */
        floor: number
        suffix: string
        /** One per point, shown in the hover tooltip. */
        labels: string[]
        axis: string[]
        series: AssetSeries[]
      }
  )

/**
 * Findings style 6's Assets grid, by asset and dashboard app id: the apps sit among the charts, and the
 * grid fills densely, so smaller cards backfill the gaps.
 */
export const DEFAULT_BOARD_ORDER: readonly string[] = [
  'gami-critical-alert',
  'gami-saudi-made',
  'gami-alert',
  'gami-plan-progress',
  'gami-localization',
  'gami-overview',
  'gami-domains',
  'gami-license-status',
  'gami-wds-exhibitors',
  'gami-wds',
  'gami-trajectory',
  'gami-unfilled-roles',
  'gami-localization-app',
  'gami-investment',
  'gami-talent',
]

/** The most important visuals from the four GAMI insights and the Poland alert. */
export const BRIEFING_ASSETS: BriefingAsset[] = [
  {
    id: 'gami-critical-alert',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Critical Alert',
    title: 'Poland conflict · propulsion motors',
    accent: STATUS.critical,
    value: 41,
    suffix: ' days',
    caption: 'Stock left before UAV production stops',
    spark: [96, 90, 84, 77, 70, 63, 56, 49, 41],
  },
  {
    id: 'gami-saudi-made',
    kind: 'gauge',
    visualTypeId: 'gauge-linear',
    size: 'small',
    category: 'National KPIs',
    title: 'Saudi Made vs 2030 goal',
    accent: PALETTE.teal[2],
    value: 59,
    caption: '29.4% of the 50% goal',
    tipLabel: 'Saudi Made',
  },
  {
    id: 'gami-plan-progress',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'National KPIs',
    title: '2026 Plan Progress',
    accent: SERIES,
    unit: '%',
    bars: [
      { label: 'Saudi Made', value: 94.8, display: '94.8%' },
      { label: 'Military market', value: 93, display: '93.0%' },
      { label: 'Jobs', value: 90.3, display: '90.3%' },
    ],
  },
  {
    id: 'gami-localization',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'Investors',
    title: 'Localization Opportunities',
    accent: PALETTE.purple[3],
    value: 32,
    unit: 'SAR bn a year',
    tipUnit: 'SAR bn',
    delta: '6 products',
    bars: [
      { label: 'UAV', value: 6.8 },
      { label: 'Ammo', value: 5.9 },
      { label: 'Armor', value: 4.7 },
      { label: 'Radar', value: 4.2 },
      { label: 'MRO', value: 3.9 },
      { label: 'Naval', value: 2.6 },
    ],
  },
  {
    id: 'gami-domains',
    kind: 'kpiGrid',
    visualTypeId: 'kpi-grid',
    size: 'medium',
    category: 'Domains',
    title: 'Licensed Companies by Domain',
    accent: PALETTE.categorical[3],
    metrics: [
      { label: 'Electronics', value: 173, delta: '+14 this year', good: true },
      { label: 'Land', value: 151, delta: '+9 this year', good: true },
      { label: 'Air', value: 128, delta: '+11 this year', good: true },
      { label: 'Armament', value: 104, delta: '+6 this year', good: true },
    ],
  },
  {
    id: 'gami-license-status',
    kind: 'donut',
    visualTypeId: 'donut-chart',
    size: 'small',
    category: 'Investors',
    title: '2026 License Status',
    accent: STATUS.good,
    centre: '1,007',
    centreLabel: 'Applications',
    slices: [
      { name: 'Granted', pct: 51, color: STATUS.good },
      { name: 'Under review', pct: 24, color: PALETTE.diverging[4] },
      { name: 'Applied', pct: 19, color: STATUS.mild },
      { name: 'Failed', pct: 6, color: STATUS.critical },
    ],
  },
  {
    id: 'gami-wds-exhibitors',
    kind: 'vbar',
    visualTypeId: 'vertical-bar',
    size: 'medium',
    category: 'World Defense Show',
    title: 'WDS 2028 Exhibitors',
    accent: PALETTE.teal[2],
    value: 1940,
    unit: 'applications',
    tipUnit: 'exhibitors',
    delta: '+32% on 2026',
    bars: [
      { label: 'Confirmed', value: 1085 },
      { label: 'Review', value: 435 },
      { label: 'Applied', value: 420 },
    ],
  },
  {
    id: 'gami-trajectory',
    kind: 'multiArea',
    visualTypeId: 'area-chart',
    size: 'wide',
    category: 'National KPIs',
    title: 'Saudi Made Trajectory (% of 2030 goal)',
    accent: PALETTE.teal[2],
    floor: 30,
    suffix: '%',
    labels: ['2023', '2024', '2025', '2026'],
    axis: ['2023', '2024', '2025', '2026'],
    series: [
      { name: 'Share of GDP', color: PALETTE.categorical[1], points: [48, 55, 61, 66] },
      { name: 'Saudi Made', color: PALETTE.categorical[2], points: [38.8, 45, 52, 58.8] },
    ],
  },
  {
    id: 'gami-unfilled-roles',
    kind: 'hbar',
    visualTypeId: 'horizontal-bar',
    size: 'medium',
    category: 'Human Capital',
    title: 'Unfilled Roles by Region',
    accent: PALETTE.purple[3],
    unit: 'roles',
    bars: [
      { label: 'Western', value: 2140, display: '2,140' },
      { label: 'Riyadh', value: 1980, display: '1,980' },
      { label: 'Eastern', value: 1610, display: '1,610' },
      { label: 'Other', value: 620, display: '620' },
    ],
  },
  {
    id: 'gami-investment',
    kind: 'kpi',
    visualTypeId: 'kpi-card',
    size: 'small',
    category: 'Investors',
    title: '2026 Investment Pipeline',
    accent: PALETTE.categorical[3],
    value: 18.6,
    prefix: 'SAR ',
    suffix: 'bn',
    caption: 'Invested YTD, of SAR 31.4bn potential',
    spark: [4.1, 6.2, 8.0, 9.9, 11.7, 13.4, 15.2, 17.0, 18.6],
  },
]

/** Everything the board can hold: the Assets grid's assets, plus ones its bento has no cell for. */
export const BOARD_ASSETS: BriefingAsset[] = BRIEFING_ASSETS
