import { useEffect, useState } from 'react'

export const APPS_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/apps`

/** Apps as insights (Llumen Dubai Municipality, Dashboard 5): what each one shows is happening. */
export type AppHighlight = {
  id: string
  title: string
  description: string
  image: string
  /** Where a cropped thumbnail keeps the image (CSS object-position); top left by default. */
  focus?: string
}

export const APP_HIGHLIGHTS: AppHighlight[] = [
  {
    id: 'construction-surge',
    title: 'Construction Surge Driving Multi-System Pressure Across Saudi Arabia',
    description:
      'Real estate investment across the Kingdom is rising due to steady material costs and a higher rate of project approvals, with activity clustering around the major cities.',
    image: `${APPS_BASE}/insight-saudi-arabia.jpg`,
    focus: 'center',
  },
  {
    id: 'rainfall-disruption',
    title: 'Rainfall Event Triggering Service Disruption — Northern Districts',
    description:
      'Northern Districts flooding has disrupted waste and sewage services, requiring urgent municipal intervention.',
    image: `${APPS_BASE}/insight-2.jpg`,
  },
  {
    id: 'tourism-peak',
    title: 'Tourism Peak Increasing Load on Public Facilities — Coastal Areas',
    description:
      'Surging tourism and park footfall have strained maintenance and waste services. Increased service frequency is required to maintain “Customer Happiness” in high-traffic zones.',
    image: `${APPS_BASE}/insight-coastal-areas.jpg`,
    focus: 'center',
  },
  {
    id: 'permit-concentration',
    title: 'Permit Concentration Driving Spatial Imbalance — Central City vs Peripheral Districts',
    description:
      'A surge in central building permits has pushed density far beyond planned thresholds, straining infrastructure, while peripheral zones remain severely underutilized.',
    image: `${APPS_BASE}/insight-4.jpg`,
  },
]

/** Which card's menu is open; a press outside any menu or Escape closes it. */
export function useAppMenu() {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  useEffect(() => {
    if (!menuFor) return
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-app-menu]')) return
      setMenuFor(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuFor(null)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuFor])
  return [menuFor, setMenuFor] as const
}
