/** What both Dubai Municipality stories share: the horizon colours, the status colours, and card toning. */
import { PALETTE, STATUS, type EstateCard, type Horizon, type Tone } from '../realEstate/estateTypes'

export const HORIZON_COLOR: Record<Horizon, string> = {
  immediate: PALETTE.teal[2],
  intermediate: PALETTE.categorical[0],
  long: PALETTE.purple[2],
}

export const HORIZON_LABEL: Record<Horizon, string> = {
  immediate: 'Immediate impact',
  intermediate: 'Intermediate impact',
  long: 'Long-term impact',
}

/** When each horizon pays back, as the cards and replies word it. */
export const HORIZON_SPAN: Record<Horizon, string> = {
  immediate: 'days to weeks',
  intermediate: '3–6 months',
  long: '6 months to 1 year',
}

/** A warm-to-cool reading of how bad something is, shared by both stories' maps. */
export const LEVEL = {
  critical: STATUS.critical,
  high: PALETTE.categorical[5],
  watch: '#ffcf6b',
  ok: PALETTE.teal[2],
  calm: PALETTE.categorical[0],
  muted: 'rgba(255, 255, 255, 0.42)',
} as const

/** Assigns each chart card a tone in turn, so neighbouring charts don't all read the same colour. */
export function toned(cards: EstateCard[]): EstateCard[] {
  const order: Tone[] = ['teal', 'blue', 'purple']
  let index = 0
  return cards.map((card) =>
    card.tone || card.kind === 'summary' || card.kind === 'section' ? card : { ...card, tone: order[index++ % order.length] },
  )
}
