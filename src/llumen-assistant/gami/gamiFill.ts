import { createContext } from 'react'

/**
 * Inside a filling grid: the card's fill delay in ms, or -1 while the story waits to come in. Its
 * figures count up from zero once it plays; outside a grid (null) they show as written.
 */
export const GamiFillDelay = createContext<number | null>(null)
