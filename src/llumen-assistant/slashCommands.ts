import { Broadcast, PlusCircle, TreeStructure } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { AssistantReplyPayload } from './assistantReplyTypes'

export type SlashCommandId = 'monitor' | 'workflow' | 'create'

export type SlashCommand = {
  id: SlashCommandId
  label: string
  description: string
  Icon: Icon
}

export type ParsedSlashCommand = {
  id: SlashCommandId
  /** Original submitted text, including `/command`. */
  userText: string
  /** Free text after the command (mentions, topic, etc.). */
  rest: string
}

export type SlashMenuPosition = {
  left: number
  bottom: number
  width: number
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'monitor',
    label: 'monitor',
    description: 'Monitor any context you mention for changes',
    Icon: Broadcast,
  },
  {
    id: 'workflow',
    label: 'workflow',
    description: 'Design a node-based workflow that runs on intervals and produces output',
    Icon: TreeStructure,
  },
  {
    id: 'create',
    label: 'create',
    description: 'Create an asset or a dashboard to view later',
    Icon: PlusCircle,
  },
]

const COMMAND_IDS = new Set<string>(SLASH_COMMANDS.map((item) => item.id))

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (item) => item.id.startsWith(q) || item.label.toLowerCase().includes(q),
  )
}

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^\/(monitor|workflow|create)(?:\s+([\s\S]*))?$/i)
  if (!match) return null
  const id = match[1]!.toLowerCase() as SlashCommandId
  if (!COMMAND_IDS.has(id)) return null
  return {
    id,
    userText: trimmed,
    rest: (match[2] ?? '').trim(),
  }
}

export function underwayMessage(parsed: ParsedSlashCommand): string {
  const rest = parsed.rest
  switch (parsed.id) {
    case 'monitor':
      return rest
        ? `Work is underway on monitoring ${rest} for changes.`
        : 'Work is underway on monitoring the context you mentioned for changes.'
    case 'workflow':
      return rest
        ? `Work is underway on designing a node-based workflow for ${rest}.`
        : 'Work is underway on designing a node-based workflow that runs on intervals.'
    case 'create':
      return rest
        ? `Work is underway on creating ${rest}.`
        : 'Work is underway on creating an asset or dashboard to view later.'
  }
}

export function slashChatTitle(parsed: ParsedSlashCommand): string {
  const rest = parsed.rest
  switch (parsed.id) {
    case 'monitor':
      return rest ? `Monitoring ${rest}` : 'Monitoring'
    case 'workflow':
      return rest ? `Workflow for ${rest}` : 'Workflow'
    case 'create':
      return rest ? `Creating ${rest}` : 'Creating'
  }
}

export function workUnderwayReply(parsed: ParsedSlashCommand): AssistantReplyPayload {
  const message = underwayMessage(parsed)
  const working =
    parsed.id === 'monitor' ? 'monitoring' : parsed.id === 'workflow' ? 'the workflow' : 'the asset'
  return {
    confirmation: 'On it',
    headline: message,
    thinkingSteps: [
      { id: 'think-start', kind: 'reasoning', title: `Starting ${working}` },
      { id: 'think-done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'start',
        kind: 'reasoning',
        title: `Kicking off ${working}…`,
        titleInProgress: `Kicking off ${working}…`,
      },
      {
        id: 'run',
        kind: 'outcome',
        title: message,
        titleInProgress: 'Work is underway…',
      },
    ],
    blocks: [{ type: 'text', content: message }],
  }
}

/** `/query` at the start of the editor (optional leading whitespace). */
export function getSlashTrigger(editor: HTMLElement): { query: string; triggerLength: number } | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return null

  const pre = document.createRange()
  pre.selectNodeContents(editor)
  pre.setEnd(range.startContainer, range.startOffset)
  const textBefore = pre.toString().replace(/\u00a0/g, ' ')
  const match = textBefore.match(/^(\s*)\/([^\s]*)$/)
  if (!match) return null
  return { query: match[2] ?? '', triggerLength: 1 + (match[2]?.length ?? 0) }
}

/** Sit the menu on top of the chatbox, matching its width. */
export function getSlashMenuPosition(anchor: HTMLElement): SlashMenuPosition {
  const rect = anchor.getBoundingClientRect()
  return {
    left: rect.left,
    bottom: window.innerHeight - rect.top + 8,
    width: rect.width,
  }
}

function deleteTextBeforeCaret(triggerLength: number): Range | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null
  const textNode = range.startContainer as Text
  const end = range.startOffset
  const start = Math.max(0, end - triggerLength)
  if (textNode.data.slice(start, end).length !== end - start) return null
  const del = document.createRange()
  del.setStart(textNode, start)
  del.setEnd(textNode, end)
  del.deleteContents()
  return del
}

export function insertSlashCommand(
  editor: HTMLElement,
  commandId: SlashCommandId,
  triggerLength: number,
): boolean {
  editor.focus()
  let insertRange = triggerLength > 0 ? deleteTextBeforeCaret(triggerLength) : null
  if (!insertRange) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
      const fallback = document.createRange()
      fallback.selectNodeContents(editor)
      fallback.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(fallback)
    }
    const next = window.getSelection()
    if (!next || !next.rangeCount) return false
    insertRange = next.getRangeAt(0)
    insertRange.deleteContents()
  }

  const node = document.createTextNode(`/${commandId} `)
  insertRange.insertNode(node)
  const after = document.createRange()
  after.setStart(node, node.data.length)
  after.collapse(true)
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(after)
  }
  return true
}
