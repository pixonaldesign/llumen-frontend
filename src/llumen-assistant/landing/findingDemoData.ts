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
  'dumping-map': 'r1',
  'aqi-map': 'r2',
  'proactive-ai': 'r3',
  'ai-gradient-2': 'r4',
  'ai-gradient-4': 'r5',
  'ai-gradient-5': 'r6',
  'dumping-alert': 'r1',
  'aqi-alert': 'r2',
  'pressure-alert': 'r5',
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
    id: 'dumping-map',
    type: 'slides',
    title: 'Police Station Response Brief',
    domain: 'Police',
    before: 'Response times from police stations across Khalifa City are ',
    highlight: '4 minutes slower',
    after: ' than the service target this week',
    image: a.slideMap,
  },
  {
    id: 'aqi-map',
    type: 'slides',
    title: 'Station Coverage Gap',
    domain: 'Police',
    before: 'Three police stations along the coastal corridor are ',
    highlight: 'covering extra districts',
    after: ' after overnight desk closures',
    image: a.recMapB,
  },
  {
    id: 'proactive-ai',
    type: 'ai',
    title: 'Station Counter Wait',
    domain: 'Police',
    before: 'Walk-in queues at MBZ City police stations typically precede ',
    highlight: 'counter waits of 25 minutes',
    after: ' within the next hour',
    gradient: AI_GRADIENTS[2],
  },
  {
    id: 'ai-gradient-2',
    type: 'ai',
    title: 'Night Shift Staffing',
    domain: 'Police',
    before: 'Night shifts at two Al Ain police stations are ',
    highlight: 'short two officers',
    after: ' for a third consecutive week',
    gradient: AI_GRADIENTS[1],
  },
  {
    id: 'ai-gradient-4',
    type: 'ai',
    title: 'Incident Load Review',
    domain: 'Police',
    before: 'Reports filed at Mussafah police stations are ',
    highlight: 'up 18% since Sunday',
    after: ', mostly vehicle and property calls',
    gradient: AI_GRADIENTS[3],
  },
  {
    id: 'ai-gradient-5',
    type: 'ai',
    title: 'School-Zone Patrol Delay',
    domain: 'Police',
    before: 'Patrol handoffs from Khalifa City police stations are arriving ',
    highlight: '11 minutes late',
    after: ' at school-zone close',
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
    id: 'dumping-alert',
    type: 'ai',
    severity: 'alert',
    title: 'Illegal dumping surge',
    domain: 'Public Safety',
    before: 'Illegal dumping along the Mussafah industrial belt has ',
    highlight: 'spiked 35% in six hours',
    after: ', and three sites are now above the emergency threshold',
  },
  {
    id: 'aqi-alert',
    type: 'ai',
    severity: 'alert',
    title: 'Air quality emergency',
    domain: 'Operations',
    before: 'Fine particulate readings across the coastal corridor have ',
    highlight: 'crossed the hazardous band',
    after: ', with schools and clinics inside the plume',
  },
  {
    id: 'pressure-alert',
    type: 'ai',
    severity: 'alert',
    title: 'Water network failure',
    domain: 'Engineering',
    before: 'Overnight pressure in Al Ain has ',
    highlight: 'collapsed across four districts',
    after: ', and interruptions of 4–6 hours are already underway',
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
