import { useEffect, useState } from 'react'

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

export const APP_HIGHLIGHTS: AppHighlight[] = [
  {
    id: 'gami-alert',
    storyId: 'gami-alert',
    title: 'Drone Supply: Bridge Through Türkiye',
    description:
      'The Poland–Russia conflict cut off 20 imported components; 3 are critical to the UAV programmes. Turkish suppliers deliver in 30 days.',
    image: `${APPS_BASE}/gami-turkiye.jpg`,
    focus: 'center',
  },
  {
    id: 'gami-overview',
    storyId: 'gami-overview',
    title: 'GAMI National Performance — 2026 Plan',
    description: 'Saudi Made at 29.4%, 94.8% of plan, with SAR 46.5bn of military market and 66.4k jobs.',
    image: `${APPS_BASE}/gami-kingdom.jpg`,
    focus: 'center',
  },
  {
    id: 'gami-wds',
    storyId: 'gami-wds',
    title: 'World Defense Show 2028 — Exhibitor Pipeline',
    description: '1,940 exhibitors from 94 countries, 32% ahead of 2026, 15 months before the show.',
    image: `${APPS_BASE}/gami-world.jpg`,
    focus: 'center',
  },
  {
    id: 'gami-localization-app',
    storyId: 'gami-localization',
    title: 'Localization Opportunities',
    description: 'SAR 32.0bn a year can be made in the Kingdom; Jubail can take SAR 10.6bn of it now.',
    image: `${APPS_BASE}/gami-eastern.jpg`,
    focus: 'center',
  },
  {
    id: 'gami-talent',
    storyId: 'gami-talent',
    title: 'Defence Skills Gap — Western Region',
    description: '6,350 skilled people short today, 10,600 by 2030; KAEC needs a second intake.',
    image: `${APPS_BASE}/gami-western.jpg`,
    focus: 'center',
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
