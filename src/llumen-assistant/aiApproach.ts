/**
 * Parallel Llumen AI approaches for the story — how the assistant, its chat panel and the
 * map/components interact. Each approach switches interactions on through `features`, so an
 * approach can borrow another's interaction by flipping its flag.
 */

export type AiApproach = 'approach-1' | 'approach-2'

export type AiApproachFeatures = {
  /** Select tool: pick components or drag a map area, then prompt about it (scenarios 1 and 2). */
  selectTool: boolean
  /** Map-state thumbnail card on prompt replies; clicking snaps the story back to that view. */
  mapStateCards: boolean
  /** "AI mode" pill over the story with Reset, Update and the conversation toggle. */
  aiModeBar: boolean
  /** Hovering a chart card offers "Add to chat", which attaches it to the story chatbox. */
  addToChat: boolean
}

export type AiApproachOption = {
  id: AiApproach
  label: string
  description: string
  features: AiApproachFeatures
}

export const AI_APPROACHES: AiApproachOption[] = [
  {
    id: 'approach-1',
    label: 'Approach 1',
    description: 'Select tool, map snapshots, AI mode',
    features: { selectTool: true, mapStateCards: true, aiModeBar: true, addToChat: false },
  },
  {
    id: 'approach-2',
    label: 'Approach 2',
    description: 'Add components to chat, map snapshots',
    features: { selectTool: false, mapStateCards: true, aiModeBar: true, addToChat: true },
  },
]

export function aiApproachOption(id: AiApproach): AiApproachOption {
  return AI_APPROACHES.find((item) => item.id === id) ?? AI_APPROACHES[0]
}

const STORAGE_KEY = 'llumen.aiApproach'

function isAiApproach(value: unknown): value is AiApproach {
  return AI_APPROACHES.some((item) => item.id === value)
}

export function readAiApproach(): AiApproach {
  if (typeof window === 'undefined') return 'approach-1'
  const fromUrl = new URLSearchParams(window.location.search).get('ai')
  if (fromUrl === '1' || fromUrl === '2') return `approach-${fromUrl}`
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isAiApproach(stored)) return stored
  } catch {
    /* private mode */
  }
  return 'approach-1'
}

export function persistAiApproach(approach: AiApproach) {
  try {
    window.localStorage.setItem(STORAGE_KEY, approach)
  } catch {
    /* private mode */
  }
}
