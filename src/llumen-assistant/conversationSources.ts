import type { InlineContextCategoryId } from './inlineContextData'

export type ConversationSource = {
  id: string
  label: string
  categoryId: InlineContextCategoryId
}

/** Seeded sources for the air-quality demo conversation. */
export const DEMO_CONVERSATION_SOURCES: ConversationSource[] = [
  { id: 'db-aq-stations', label: 'Air Quality Stations', categoryId: 'database' },
  { id: 'db-emissions', label: 'Industrial Emissions Registry', categoryId: 'database' },
  { id: 'db-population', label: 'Population Census', categoryId: 'database' },
  { id: 'br-exec-aqi', label: 'Executive AQI assessment', categoryId: 'briefings' },
  { id: 'as-aqi-map', label: 'Abu Dhabi AQI map', categoryId: 'assets' },
]

export function sourcesForDemoConversation(hasConversation: boolean): ConversationSource[] {
  return hasConversation ? DEMO_CONVERSATION_SOURCES.map((s) => ({ ...s })) : []
}
