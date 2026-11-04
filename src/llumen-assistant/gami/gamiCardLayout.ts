import styles from '../story/StoryView.module.css'
import type { GamiCard } from './gamiTypes'
import css from './GamiCards.module.css'

const isLarge = (card: GamiCard) => card.kind === 'part' && card.size === 'large'

/** Cells a card covers in a `columns`-wide sidebar: one cell, a 2×2 block, or the full row. */
export function cardFootprint(card: GamiCard, columns: number) {
  const wide = isLarge(card) ? Math.min(2, columns) : card.span === 'cell' || card.kind === 'cell' ? 1 : columns
  const tall = card.height === 2 || isLarge(card) ? 2 : 1
  return wide * tall
}

/** The card's shell among the story card classes, and its place on the 184px grid. */
export function cardClass(card: GamiCard) {
  if (card.kind === 'section') return `${css.section} ${css.full}`
  const shell = card.kind === 'summary' ? styles.summaryCard : card.kind === 'cell' ? styles.kpiCellCard : styles.visualCard
  return [
    shell,
    css.card,
    isLarge(card) ? css.block : card.span === 'cell' || card.kind === 'cell' ? css.cell : css.full,
    card.height === 2 || isLarge(card) ? css.tall : '',
    card.kind === 'part' ? css.partCard : '',
    card.kind === 'summary' ? css.summary : '',
  ]
    .filter(Boolean)
    .join(' ')
}
