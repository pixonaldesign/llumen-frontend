import { createContext } from 'react'

/**
 * Where page heads render instead of sticking to the top of the page's scroller, so the content scrolls
 * beneath them and is cut off at their bottom edge. Unset, each head sticks in place.
 */
export const PageHeadSlot = createContext<HTMLElement | null>(null)
