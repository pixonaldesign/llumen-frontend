/** The tester's answer to a step parked on Send and wait. */
export type ChatReply = { type: 'free_text'; text: string } | { type: 'approval'; approved: boolean }

export type ChatExpects = { type: 'free_text' } | { type: 'approval'; approveLabel: string; rejectLabel: string }

/** What a Send Chat Message step put in the chat, and the reply it got or is waiting for. */
export type ChatExchange = {
  message: string
  /** False when the run had no chat session, so nothing was posted. */
  posted: boolean
  /** Send and wait only. */
  expects?: ChatExpects
  reply?: { text: string; approved?: boolean }
}
