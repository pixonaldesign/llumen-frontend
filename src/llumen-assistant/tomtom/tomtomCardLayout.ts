import styles from '../story/StoryView.module.css'
import type { TomtomCard } from './tomtomTypes'
import css from './TomtomCards.module.css'

const isCell = (card: TomtomCard) => card.span === 'cell' || card.kind === 'cell'

/** Cells a card covers in a `columns`-wide sidebar: one cell or the full row, one or two rows tall. */
export function cardFootprint(card: TomtomCard, columns: number) {
  return (isCell(card) ? 1 : columns) * (card.height === 2 ? 2 : 1)
}

/** The card's shell among the story card classes, and its place on the 184px grid. */
export function cardClass(card: TomtomCard) {
  if (card.kind === 'section') return `${css.section} ${css.full}`
  const shell = card.kind === 'summary' ? styles.summaryCard : card.kind === 'cell' ? styles.kpiCellCard : styles.visualCard
  return [shell, css.card, isCell(card) ? css.cell : css.full, card.height === 2 ? css.tall : '', card.kind === 'summary' ? css.summary : '']
    .filter(Boolean)
    .join(' ')
}
