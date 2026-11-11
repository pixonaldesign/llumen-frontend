import styles from '../story/StoryView.module.css'
import type { EstateCard } from './estateTypes'
import css from './EstateCards.module.css'

const isBlock = (card: EstateCard) => card.span === 'block'
const isCell = (card: EstateCard) => card.span === 'cell' || (card.kind === 'cell' && !isBlock(card))

/** Cells a card covers in a `columns`-wide sidebar: one cell, two, or the full row, one or two rows tall. */
export function cardFootprint(card: EstateCard, columns: number) {
  return (isCell(card) ? 1 : isBlock(card) ? 2 : columns) * (card.height === 2 ? 2 : 1)
}

/** The card's shell among the story card classes, and its place on the 184px grid. */
export function cardClass(card: EstateCard) {
  if (card.kind === 'section') return `${css.section} ${css.full}`
  const shell = card.kind === 'summary' ? styles.summaryCard : card.kind === 'cell' ? styles.kpiCellCard : styles.visualCard
  const place = isCell(card) ? css.cell : isBlock(card) ? css.block : css.full
  return [shell, css.card, place, card.height === 2 ? css.tall : '', card.kind === 'summary' ? css.summary : '']
    .filter(Boolean)
    .join(' ')
}
