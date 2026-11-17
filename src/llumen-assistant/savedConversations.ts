import type { AssistantReplyPayload } from './assistantReplyTypes'
import type { SessionSummary } from './SessionsPanel'
import type { StoryAiSnapshot, StoryMapCapture } from './story/storyAiScenarios'

export type SavedChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; reply?: AssistantReplyPayload }

export type SavedConversation = {
  id: string
  title: string
  updatedAt: number
  messages: SavedChatMessage[]
  /** Story the conversation changed, with the changes to replay when it is reopened. */
  storyId: string | null
  story: StoryAiSnapshot | null
  /** Thumbnails and cameras for the map-state cards in this conversation's replies. */
  mapCaptures?: Record<string, StoryMapCapture>
}

/** Map-state card ids referenced by a conversation's replies. */
export function mapStateIds(messages: SavedChatMessage[]): string[] {
  return messages.flatMap((message) =>
    message.role === 'assistant'
      ? (message.reply?.createdComponents ?? []).flatMap((component) =>
          component.preview?.kind === 'story-map-state' ? [component.preview.stateId] : [],
        )
      : [],
  )
}

const STORAGE_KEY = 'llumen.savedConversations.v1'

export function loadConversations(): SavedConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as SavedConversation[]) : []
  } catch {
    return []
  }
}

export function storeConversations(conversations: SavedConversation[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch {
    // Storage full or unavailable: the list still works for this session.
  }
}

const STORY_VERSIONS_KEY = 'llumen.conversationStoryVersions.v1'

/** Story changes the user kept with Update, keyed by conversation id; Reset returns to them. */
export function loadStoryVersions(): Record<string, StoryAiSnapshot> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORY_VERSIONS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, StoryAiSnapshot>)
      : {}
  } catch {
    return {}
  }
}

export function storeStoryVersions(versions: Record<string, StoryAiSnapshot>) {
  try {
    window.localStorage.setItem(STORY_VERSIONS_KEY, JSON.stringify(versions))
  } catch {
    // Storage full or unavailable: the saved version still applies for this session.
  }
}

/** Same story changes, ignoring where the camera was left. */
export function sameStorySnapshot(a: StoryAiSnapshot | null, b: StoryAiSnapshot | null) {
  if (!a || !b) return a === b
  const key = (snapshot: StoryAiSnapshot) => JSON.stringify({ ...snapshot, camera: undefined })
  return key(a) === key(b)
}

function updatedLabel(timestamp: number, now: Date): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return now.getTime() - timestamp < 60_000 ? 'Today · just now' : `Today · ${time}`
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function conversationSummary(conversation: SavedConversation, now = new Date()): SessionSummary {
  const firstUser = conversation.messages.find((message) => message.role === 'user')
  return {
    id: conversation.id,
    title: conversation.title,
    updatedLabel: updatedLabel(conversation.updatedAt, now),
    preview: firstUser?.text ?? '',
  }
}
