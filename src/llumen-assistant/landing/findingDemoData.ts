import { landingAssets as a } from './landingAssets'

export type FindingSeverity = 'notice' | 'alert'

export type FindingToastItem = {
  id: string
  type: 'slides' | 'chart' | 'ai'
  title: string
  domain: string
  before: string
  highlight: string
  after: string
  image?: string
  gradient?: string
  /** Notices stack as toasts. Alerts take the intrusive aurora. */
  severity?: FindingSeverity
  /** Recommended-story id opened by "View slides". */
  storyId?: string
}

const FINDING_STORY_IDS: Record<string, string> = {
  'export-licence-queue': 'gami-overview',
  'jubail-capacity': 'gami-localization',
  'wds-applications': 'gami-wds',
  'kaec-intake': 'gami-talent',
  'investment-pipeline': 'gami-overview',
  'shuttle-readiness': 'gami-wds',
}

export function relatedStoryId(item: { id: string; storyId?: string }): string | undefined {
  return item.storyId ?? FINDING_STORY_IDS[item.id]
}

const AI_GRADIENTS = [
  'linear-gradient(180deg, #4a4969 0%, #7072ab 50%, #cd82a0 100%)',
  'linear-gradient(180deg, #40405c 0%, #6f71aa 80%, #8a76ab 100%)',
  'linear-gradient(180deg, #757abf 0%, #8583be 60%, #eab0d1 100%)',
  'linear-gradient(180deg, #94c5f8 0%, #8ec0e8 25%, #7e9ad2 45%, #6d74bc 70%, #5a61ad 100%)',
  'linear-gradient(180deg, #9be2fe 0%, #67d1fb 22%, #2d8fb8 55%, #2478a0 100%)',
  'linear-gradient(180deg, #57c1eb 0%, #246fa8 100%)',
] as const

/** Pool of findings the `/finding` slash command cycles through. */
export const FINDING_TOAST_POOL: FindingToastItem[] = [
  {
    id: 'export-licence-queue',
    type: 'slides',
    title: 'Export Licence Queue',
    domain: 'Licensing',
    before: 'Export licence requests are ',
    highlight: '9% blocked',
    after: ', the highest share of GAMI’s 11 e-services',
    image: a.slideMap,
  },
  {
    id: 'jubail-capacity',
    type: 'slides',
    title: 'Jubail Localization Capacity',
    domain: 'Localization',
    before: 'Jubail suppliers can take ',
    highlight: 'SAR 10.6bn a year',
    after: ' of imported military products now',
    image: a.recMapB,
  },
  {
    id: 'wds-applications',
    type: 'ai',
    title: 'WDS 2028 Applications',
    domain: 'World Defense Show',
    before: 'Exhibitor applications for WDS 2028 are ',
    highlight: '32% ahead of 2026',
    after: ' with 15 months to go',
    gradient: AI_GRADIENTS[2],
  },
  {
    id: 'kaec-intake',
    type: 'ai',
    title: 'KAEC Academy Intake',
    domain: 'Human Capital',
    before: 'A second KAEC academy intake would close ',
    highlight: '640 unfilled roles',
    after: ' by 2028',
    gradient: AI_GRADIENTS[1],
  },
  {
    id: 'investment-pipeline',
    type: 'ai',
    title: 'Investment Pipeline',
    domain: 'Investment',
    before: 'SAR 31.4bn of potential investment could land ',
    highlight: 'before year end',
    after: ', taking 2026 to SAR 50bn',
    gradient: AI_GRADIENTS[3],
  },
  {
    id: 'shuttle-readiness',
    type: 'ai',
    title: 'WDS Shuttle Readiness',
    domain: 'World Defense Show',
    before: 'Roads and shuttles to Malham are ',
    highlight: '64% ready',
    after: ', the weakest link for a 41,000-visitor peak day',
    gradient: AI_GRADIENTS[4],
  },
]

export type FindingToastInstance = FindingToastItem & {
  /** Unique per push so the same finding can stack more than once. */
  instanceId: string
}

export function isFindingSlashCommand(text: string): boolean {
  return /^\/finding(?:\s|$)/i.test(text.trim())
}

export function nextFindingFromPool(index: number): FindingToastItem {
  return FINDING_TOAST_POOL[index % FINDING_TOAST_POOL.length]
}

/** Huge alerts. These are the only findings that spawn the aurora. */
export const ALERT_FINDING_POOL: FindingToastItem[] = [
  {
    id: 'poland-motor-alert',
    type: 'ai',
    severity: 'alert',
    title: 'Poland supply disruption',
    domain: 'Supply Chain',
    before: 'Poland has suspended export permits for 20 imported components, and UAV propulsion motors have ',
    highlight: '41 days of stock left',
    after: ' before Sahm, Najm and Rimah production stops',
    storyId: 'gami-alert',
  },
  {
    id: 'poland-gimbal-alert',
    type: 'ai',
    severity: 'alert',
    title: 'EO/IR gimbals cut off',
    domain: 'Supply Chain',
    before: 'All EO/IR gimbal assemblies come from one plant in Kraków, and ',
    highlight: 'shipments stopped this morning',
    after: '; 47 days of stock remain',
    storyId: 'gami-alert',
  },
  {
    id: 'poland-inu-alert',
    type: 'ai',
    severity: 'alert',
    title: 'Navigation units at risk',
    domain: 'Supply Chain',
    before: 'Inertial navigation units from Gdańsk are ',
    highlight: '3 of 20 critical items',
    after: ' now blocked; Türkiye can bridge supply in 30 days',
    storyId: 'gami-alert',
  },
]

export function nextAlertFromPool(index: number): FindingToastItem {
  return ALERT_FINDING_POOL[index % ALERT_FINDING_POOL.length]
}

export function isAlertFinding(item: { severity?: FindingSeverity }): boolean {
  return item.severity === 'alert'
}

/** How many findings `/finding` seeds when the stack is empty. */
export const FINDING_TOAST_SEED_COUNT = 5
