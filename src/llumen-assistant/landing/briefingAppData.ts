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
    id: 'tt-shortlist-app',
    storyId: 'tt-shortlist',
    title: 'Next Site Shortlist — Abu Dhabi Island',
    description:
      'World Trade Center leads 12 candidate sites at 87, with 48,200 vehicles a day and only 6% overlap with your stations.',
    image: `${APPS_BASE}/tt-shortlist.jpg`,
    focus: 'center',
  },
  {
    id: 'tt-network-app',
    title: 'Catchment Overlap — Your 8 Stations',
    description:
      'Khalidiyah Park shares 22% of its catchment with the Al Khalidiyah candidate; every other pairing overlaps under 10%.',
    image: `${APPS_BASE}/tt-network.jpg`,
    focus: 'center',
  },
  {
    id: 'tt-evening-app',
    storyId: 'tt-evening',
    title: 'Evening Demand — Sheikh Rashid Bin Saeed St',
    description: '38% of the corridor’s traffic passes between 5 and 9pm, lifting Al Markaziyah from fourth to third.',
    image: `${APPS_BASE}/tt-evening.jpg`,
    focus: 'center',
  },
  {
    id: 'tt-rivals-app',
    title: 'Rival Openings — Karamah Square',
    description: 'Two rival forecourts opened within 1 km of Karamah Square this year, and its volume fell 9% to 5.4M litres.',
    image: `${APPS_BASE}/tt-rivals.jpg`,
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
