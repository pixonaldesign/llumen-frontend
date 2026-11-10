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
      'Sewerage at 61% and 58 ha of developable land leave room to direct 15,300 pipeline homes here without new trunk mains.',
    image: `${APPS_BASE}/dm-creek.jpg`,
    focus: 'center',
  },
  {
    id: 'dm-jvc-app',
    storyId: 'dm-facilities',
    title: 'Growth Outpacing Facilities — JVC',
    description:
      'JVC has 11,800 school seats for 22,400 children who need one, and two of the five health centres it needs, while 18,400 more homes are in the pipeline.',
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
