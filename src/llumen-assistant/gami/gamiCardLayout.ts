import type { CSSProperties } from 'react'
import styles from '../story/StoryView.module.css'
import type { GamiCard } from './gamiTypes'
import css from './GamiCards.module.css'

const isLarge = (card: GamiCard) => card.kind === 'part' && card.size === 'large'
const isCell = (card: GamiCard) => card.span === 'cell' || card.kind === 'cell'
const isPart = (card: GamiCard) => card.kind === 'part' || card.kind === 'stock'

/** Cells a card covers in a `columns`-wide sidebar: one cell, a 2×2 block, or the full row. */
export function cardFootprint(card: GamiCard, columns: number) {
  const wide = isLarge(card) ? Math.min(2, columns) : isCell(card) ? 1 : columns
  const tall = card.height === 2 || isLarge(card) ? 2 : 1
  return wide * tall
}

/** Width and height in the grid layout's square cells; a section takes the whole row and no height. */
export function gridSpan(card: GamiCard, columns: number) {
  if (card.kind === 'section') return { cols: columns, rows: 0 }
  const cols = card.dock ? Math.max(1, columns - 2) : Math.min(columns, card.cols ?? (isCell(card) ? 1 : 2))
  return { cols, rows: card.height ?? (isLarge(card) ? 2 : 1) }
}

/** The card's span on the grid layout, read by `.dash > *`. */
export function gridVars(card: GamiCard, columns: number): CSSProperties {
  const { cols, rows } = gridSpan(card, columns)
  return { '--cols': cols, '--rows': rows } as CSSProperties
}

/** The card's shell among the story card classes, and its place on the 184px grid. */
export function cardClass(card: GamiCard) {
  if (card.kind === 'section') return `${css.section} ${css.full}`
  const shell = card.kind === 'summary' ? styles.summaryCard : card.kind === 'cell' ? styles.kpiCellCard : styles.visualCard
  return [
    shell,
    css.card,
    isLarge(card) ? css.block : isCell(card) ? css.cell : css.full,
    card.height === 2 || isLarge(card) ? css.tall : '',
    isPart(card) ? css.partCard : '',
    card.kind === 'summary' ? css.summary : '',
    card.dock ? css.docked : '',
  ]
    .filter(Boolean)
    .join(' ')
}
