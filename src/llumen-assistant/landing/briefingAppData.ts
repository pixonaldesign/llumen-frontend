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
    id: 're-downtown-app',
    storyId: 're-downtown',
    title: 'Downtown Off-Plan Sales — Two Towers Lead',
    description:
      'Dreamscape Tower and Opera Crest Residences took AED 6.1bn of Downtown’s AED 16.0bn in off-plan sales this quarter.',
    image: `${APPS_BASE}/re-downtown.jpg`,
    focus: 'center',
  },
  {
    id: 're-creek-app',
    title: 'Handover Wave Ahead — Dubai Creek Harbour',
    description:
      '9,400 off-plan units hand over in Creek Harbour by the end of 2027, more than the area’s last five years combined.',
    image: `${APPS_BASE}/re-creek-harbour.jpg`,
    focus: 'center',
  },
  {
    id: 're-marina-app',
    title: 'Rents Outpacing Supply — Dubai Marina',
    description:
      'Marina rents rose 11% this year while only 640 new units completed, keeping occupancy above 94%.',
    image: `${APPS_BASE}/re-marina.jpg`,
    focus: 'center',
  },
  {
    id: 're-business-bay-app',
    title: 'Resale Prices Catching Off-Plan — Business Bay',
    description:
      'Ready homes in Business Bay now resell within 6% of new launch prices, down from a 19% gap in 2023.',
    image: `${APPS_BASE}/re-business-bay.jpg`,
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
