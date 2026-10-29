import type { AssetPreview } from './nodeCatalog'
import type { AlertLevel } from './nodeKinds'

/** A finding is an update unless an alert rule matched; the highest level that matched wins. */
export type FindingKind = AlertLevel | 'update'

export const FINDING_KIND_LABEL: Record<FindingKind, string> = { critical_alert: 'Critical alert', alert: 'Alert', update: 'Update' }

export type FindingAsset = { name: string; preview: AssetPreview }

export type FindingSection = { heading: string; text: string; asset?: FindingAsset }

/** A rule that matched, with each condition that held and what the run showed for it. */
export type FindingRule = { label: string; level: AlertLevel; conditions: readonly { text: string; observed?: string }[] }

/** What the findings agent writes for one run of the published Flow. */
export type Finding = {
  kind: FindingKind
  headline: string
  lead: string
  sections: readonly FindingSection[]
  actions: readonly string[]
  howWeKnow: string
  /** The author's focus, when they set one. */
  focus?: string
  rules: readonly FindingRule[]
}
