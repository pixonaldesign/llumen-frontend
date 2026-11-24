import { useEffect, useState } from 'react'
import { bySpace } from '../demoSpace'

export const APPS_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/apps`

/** Apps as insights: what each one shows is happening. */
export type AppHighlight = {
  id: string
  title: string
  description: string
  image: string
  /** The app's story, opened by its View button. */
  storyId?: string
  /** Where a cropped thumbnail keeps the image (CSS object-position); top left by default. */
  focus?: string
}

const LLUMEN_APPS: AppHighlight[] = [
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

const DM_APPS: AppHighlight[] = [
  {
    id: 'dm-odor-app',
    storyId: 'dm-odor',
    title: 'Unified Odor — Al Barsha Parks',
    description:
      'Odor complaints near three parks trace to recycled-water irrigation from storage tank T-3; nine interventions are ready to test.',
    image: `${APPS_BASE}/dm-odor.jpg`,
    focus: 'center',
  },
  {
    id: 'dm-creek-app',
    storyId: 'dm-infrastructure',
    title: 'Spare Capacity — Dubai Creek Harbour',
    description:
      'Sewerage at 61% and 58 ha of developable land leave room to direct 15,300 pipeline residential units here without new trunk mains.',
    image: `${APPS_BASE}/dm-creek.jpg`,
    focus: 'center',
  },
  {
    id: 'dm-jvc-app',
    storyId: 'dm-facilities',
    title: 'Growth Outpacing Facilities — JVC',
    description:
      'JVC’s public parks run at 155% of capacity at peak and it has 14 of the 32 public sports courts it needs, while 18,400 more residential units are in the pipeline.',
    image: `${APPS_BASE}/dm-jvc.jpg`,
    focus: 'center',
  },
  {
    id: 'dm-quoz-app',
    storyId: 'dm-facilities',
    title: 'Land Use Drifting — Al Quoz',
    description:
      '38 change-of-use applications in 24 months as light industry turns residential; worker accommodation is at 108%.',
    image: `${APPS_BASE}/dm-quoz.jpg`,
    focus: 'center',
  },
]

export const APP_HIGHLIGHTS: AppHighlight[] = bySpace({ llumen: LLUMEN_APPS, dm: DM_APPS })

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
