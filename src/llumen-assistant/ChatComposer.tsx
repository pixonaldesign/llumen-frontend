import {
  At,
  File,
  Microphone,
  Paperclip,
  X,
} from '@phosphor-icons/react'
import gsap from 'gsap'
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { llumenAssets } from './assets'
import styles from './compact-assistant.module.css'
import {
  filterCategories,
  filterItems,
  getCategoryIcon,
  type InlineContextCategoryId,
  type InlineContextItem,
} from './inlineContextData'
import { InlineContextMenu, type InlineContextMenuStage } from './InlineContextMenu'
import { SlashCommandMenu } from './SlashCommandMenu'
import {
  filterSlashCommands,
  getSlashMenuPosition,
  getSlashTrigger,
  insertSlashCommand,
  type SlashCommand,
  type SlashMenuPosition,
} from './slashCommands'
import type { SendVisualState } from './SendButton'
import { SendButton } from './SendButton'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'

/** Matches reference LlumenChatInput textarea max-height */
const MAX_COMPOSER_PX = 120
/** One line + vertical padding on `.composerInput` (7 + 22 + 7). */
const MIN_EDITOR_PX = 36
const COMPOSER_HEIGHT_DURATION = 0.38
const COMPOSER_HEIGHT_EASE = 'power2.inOut'

type ComposerContext = {
  id: string
  kind: 'file'
  name: string
  typeBadge: string
  thumbSrc?: string
}

const FILE_SAMPLES: Omit<ComposerContext, 'id'>[] = [
  { kind: 'file', name: 'appverifUI.dll', typeBadge: 'DLL' },
  {
    kind: 'file',
    name: 'abu-dhabi-aqi.png',
    typeBadge: 'PNG',
    thumbSrc: llumenAssets.mapAbuDhabiAqi,
  },
  { kind: 'file', name: 'station-export.csv', typeBadge: 'CSV' },
  { kind: 'file', name: 'ops-notes.pdf', typeBadge: 'PDF' },
]

type MentionMenuPosition = {
  left: number
  bottom: number
}

type MentionMenuState = {
  stage: InlineContextMenuStage
  categoryId: InlineContextCategoryId | null
  query: string
  activeIndex: number
  triggerLength: number
  position: MentionMenuPosition
}

type SlashMenuState = {
  query: string
  activeIndex: number
  triggerLength: number
  position: SlashMenuPosition
}

function serializeComposer(root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.dataset.inlineMention != null) {
      out += `@${el.dataset.mentionName ?? ''}`
      return
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    el.childNodes.forEach(walk)
  }
  root.childNodes.forEach(walk)
  return out.replace(/\u00a0/g, ' ')
}

function editorIsEmpty(root: HTMLElement): boolean {
  const text = root.innerText.replace(/\u00a0/g, ' ').replace(/\n/g, '').trim()
  return text.length === 0 && !root.querySelector('[data-inline-mention]')
}

function getMentionTrigger(editor: HTMLElement): { query: string; triggerLength: number } | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return null

  const anchorEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
  if (anchorEl?.closest('[data-inline-mention]')) return null

  const pre = document.createRange()
  pre.selectNodeContents(editor)
  pre.setEnd(range.startContainer, range.startOffset)
  const textBefore = pre.toString().replace(/\u00a0/g, ' ')
  const match = textBefore.match(/@([^\s@]*)$/)
  if (!match) return null
  return { query: match[1], triggerLength: match[0].length }
}

function getCaretMenuPosition(editor: HTMLElement): MentionMenuPosition {
  const sel = window.getSelection()
  let top = 0
  let left = 0
  if (sel && sel.rangeCount) {
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (rect.width || rect.height || rect.top || rect.left) {
      top = rect.top
      left = rect.left
    }
  }
  if (!top && !left) {
    const rect = editor.getBoundingClientRect()
    top = rect.top
    left = rect.left + 12
  }
  return {
    left: Math.max(12, Math.min(left, window.innerWidth - 300)),
    bottom: window.innerHeight - top + 8,
  }
}

function deleteTriggerBeforeCaret(triggerLength: number): Range | null {
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

function ensureCaretInEditor(editor: HTMLElement) {
  editor.focus()
  const sel = window.getSelection()
  if (!sel) return
  if (sel.rangeCount && editor.contains(sel.anchorNode)) return
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function insertTextAtCaret(editor: HTMLElement, text: string) {
  ensureCaretInEditor(editor)
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStart(node, node.data.length)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function createMentionChip(item: InlineContextItem): HTMLSpanElement {
  const Icon = getCategoryIcon(item.categoryId)
  const chip = document.createElement('span')
  chip.className = styles.inlineMention
  chip.contentEditable = 'false'
  chip.dataset.inlineMention = item.id
  chip.dataset.mentionName = item.name
  chip.dataset.mentionCategory = item.categoryId

  const iconHost = document.createElement('span')
  iconHost.className = styles.inlineMentionIcon
  iconHost.setAttribute('aria-hidden', 'true')
  iconHost.innerHTML = renderToStaticMarkup(<Icon size={12} weight="bold" />)

  const label = document.createElement('span')
  label.className = styles.inlineMentionLabel
  label.textContent = item.name

  chip.append(iconHost, label)
  return chip
}

function mentionFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null
  if (node instanceof HTMLElement && node.dataset.inlineMention != null) return node
  const parent = node.parentElement
  return parent?.closest('[data-inline-mention]') ?? null
}

function placeCaretAt(node: Node, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function removeMentionChips(chips: HTMLElement[]) {
  if (chips.length === 0) return
  const first = chips[0]
  const parent = first.parentNode
  const index = parent ? Array.from(parent.childNodes).indexOf(first) : -1
  for (const chip of chips) chip.remove()
  if (parent && index >= 0) {
    placeCaretAt(parent, Math.min(index, parent.childNodes.length))
  }
}

/** Delete selected / adjacent contentEditable=false mention chips (browser won't). */
function tryDeleteMentionChips(editor: HTMLElement, key: 'Backspace' | 'Delete'): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return false
  const range = sel.getRangeAt(0)

  if (!sel.isCollapsed) {
    const selected = new Set<HTMLElement>()
    editor.querySelectorAll<HTMLElement>('[data-inline-mention]').forEach((chip) => {
      if (range.intersectsNode(chip)) selected.add(chip)
    })
    const startMention = mentionFromNode(range.startContainer)
    const endMention = mentionFromNode(range.endContainer)
    if (startMention) selected.add(startMention)
    if (endMention) selected.add(endMention)
    if (selected.size === 0) return false
    removeMentionChips([...selected])
    return true
  }

  const { startContainer: node, startOffset: offset } = range

  if (key === 'Backspace') {
    if (node.nodeType === Node.TEXT_NODE && offset === 0) {
      const prev = node.previousSibling
      if (prev instanceof HTMLElement && prev.dataset.inlineMention != null) {
        removeMentionChips([prev])
        return true
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
      const prev = node.childNodes[offset - 1]
      if (prev instanceof HTMLElement && prev.dataset.inlineMention != null) {
        removeMentionChips([prev])
        return true
      }
    }
    // Caret sitting on/inside a selected chip
    const mention = mentionFromNode(node)
    if (mention && (node === mention || mention.contains(node))) {
      // Only treat as chip delete when the caret collapsed inside the atomic chip
      if (node !== editor && mention.contains(node)) {
        removeMentionChips([mention])
        return true
      }
    }
  }

  if (key === 'Delete') {
    if (node.nodeType === Node.TEXT_NODE && offset === (node.textContent?.length ?? 0)) {
      const next = node.nextSibling
      if (next instanceof HTMLElement && next.dataset.inlineMention != null) {
        removeMentionChips([next])
        return true
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const next = node.childNodes[offset]
      if (next instanceof HTMLElement && next.dataset.inlineMention != null) {
        removeMentionChips([next])
        return true
      }
    }
    const mention = mentionFromNode(node)
    if (mention && node !== editor && mention.contains(node)) {
      removeMentionChips([mention])
      return true
    }
  }

  return false
}

function ContextChip({
  item,
  onRemove,
}: {
  item: ComposerContext
  onRemove: (id: string) => void
}) {
  const isImageChip = Boolean(item.thumbSrc)

  return (
    <div
      className={`${styles.contextChip}${isImageChip ? ` ${styles.contextChipImage}` : ''}`}
      title={item.name}
      aria-label={isImageChip ? item.name : undefined}
    >
      {item.thumbSrc ? (
        <span
          className={styles.contextChipThumb}
          style={{ backgroundImage: `url(${item.thumbSrc})` }}
          aria-hidden
        />
      ) : null}
      {!isImageChip ? (
        <>
          <p className={styles.contextChipName}>{item.name}</p>
          <div className={styles.contextChipFooter}>
            <File className={styles.contextChipKindIcon} size={14} weight="regular" aria-hidden />
            <span className={styles.contextChipBadge}>{item.typeBadge}</span>
          </div>
        </>
      ) : null}
      <button
        type="button"
        className={styles.contextChipRemove}
        aria-label={`Remove ${item.name}`}
        onClick={() => onRemove(item.id)}
      >
        <X size={12} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

export type ChatComposerProps = {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  sendState: SendVisualState
  showParameters?: boolean
  onAttachClick?: () => void
  disabled?: boolean
  hasThreadMessages?: boolean
  /** Finding intro + toast stack, rendered above the composer (hub parity). */
  findingSlot?: ReactNode
  /** Agent question attached above the input while one is pending. */
  questionSlot?: ReactNode
  /** Aurora border shimmer while the first finding reveal is on screen. */
  findingCue?: boolean
  findingCueColors?: { stop1: string; stop2: string; stop3: string }
}

export type ChatComposerHandle = {
  /** Insert an @-mention chip at the current caret (or end of the editor). */
  insertMention: (item: InlineContextItem) => void
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    value,
    onChange,
    onSend,
    onStop,
    sendState,
    showParameters = true,
    onAttachClick,
    disabled = false,
    hasThreadMessages = false,
    findingSlot = null,
    questionSlot = null,
    findingCue = false,
    findingCueColors,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const chatBoxRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const composerHeightRef = useRef<number | null>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const mentionBtnRef = useRef<HTMLButtonElement>(null)
  const fileCounterRef = useRef(0)
  const uid = useId()
  const [contexts, setContexts] = useState<ComposerContext[]>([])
  const [mentionMenu, setMentionMenu] = useState<MentionMenuState | null>(null)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const chatScrollRef = useRevealScrollbarOnScroll()
  const hasContexts = contexts.length > 0

  const filteredCategories = useMemo(
    () => filterCategories(mentionMenu?.query ?? ''),
    [mentionMenu?.query],
  )
  const filteredItems = useMemo(() => {
    if (!mentionMenu?.categoryId) return []
    return filterItems(mentionMenu.categoryId, mentionMenu.query)
  }, [mentionMenu?.categoryId, mentionMenu?.query])
  const filteredSlashCommands = useMemo(
    () => filterSlashCommands(slashMenu?.query ?? ''),
    [slashMenu?.query],
  )

  const syncComposerReserve = useCallback((heightPx?: number) => {
    const dock = dockRef.current
    const middle = dock?.parentElement
    if (!dock || !middle) return
    const px = heightPx ?? dock.offsetHeight
    middle.style.setProperty('--lc-composer-reserve', `${Math.ceil(px)}px`)
  }, [])

  const syncEditorHeight = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_EDITOR_PX), MAX_COMPOSER_PX)}px`
    const box = chatBoxRef.current
    if (!box) return
    const heightPx = box.offsetHeight
    composerHeightRef.current = heightPx
    syncComposerReserve()
  }, [syncComposerReserve])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    setEditorEmpty(editorIsEmpty(el))
    onChange(serializeComposer(el))
    syncEditorHeight()
  }, [onChange, syncEditorHeight])

  const closeMentionMenu = useCallback(() => {
    setMentionMenu(null)
  }, [])

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null)
  }, [])

  const editorDisabled = disabled || sendState === 'stop'

  const refreshMentionMenu = useCallback(() => {
    const editor = editorRef.current
    if (!editor) {
      setMentionMenu(null)
      return
    }
    const trigger = getMentionTrigger(editor)
    if (!trigger) {
      setMentionMenu(null)
      return
    }
    setMentionMenu((prev) => {
      const stage = prev?.stage ?? 'categories'
      const categoryId = stage === 'items' ? prev?.categoryId ?? null : null
      const listLength =
        stage === 'items' && categoryId
          ? filterItems(categoryId, trigger.query).length
          : filterCategories(trigger.query).length
      return {
        stage: categoryId ? 'items' : 'categories',
        categoryId,
        query: trigger.query,
        triggerLength: trigger.triggerLength,
        activeIndex: Math.min(prev?.activeIndex ?? 0, Math.max(0, listLength - 1)),
        position: getCaretMenuPosition(editor),
      }
    })
  }, [])

  const refreshSlashMenu = useCallback(() => {
    const editor = editorRef.current
    const box = chatBoxRef.current
    if (!editor || editorDisabled) {
      setSlashMenu(null)
      return
    }
    const trigger = getSlashTrigger(editor)
    if (!trigger) {
      setSlashMenu(null)
      return
    }
    closeMentionMenu()
    const listLength = filterSlashCommands(trigger.query).length
    setSlashMenu((prev) => ({
      query: trigger.query,
      triggerLength: trigger.triggerLength,
      activeIndex: Math.min(prev?.activeIndex ?? 0, Math.max(0, listLength - 1)),
      position: getSlashMenuPosition(box ?? editor),
    }))
  }, [closeMentionMenu, editorDisabled])

  useLayoutEffect(() => {
    if (!slashMenu) return
    const sync = () => {
      const box = chatBoxRef.current
      if (!box) return
      const next = getSlashMenuPosition(box)
      setSlashMenu((prev) => {
        if (!prev) return prev
        const p = prev.position
        if (p.left === next.left && p.bottom === next.bottom && p.width === next.width) return prev
        return { ...prev, position: next }
      })
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [slashMenu, value, contexts.length])

  const selectSlashCommand = useCallback(
    (command: SlashCommand) => {
      const editor = editorRef.current
      if (!editor || editorDisabled) return
      insertSlashCommand(editor, command.id, slashMenu?.triggerLength ?? 1)
      closeSlashMenu()
      emitChange()
    },
    [closeSlashMenu, editorDisabled, emitChange, slashMenu?.triggerLength],
  )

  const insertMentionChip = useCallback(
    (item: InlineContextItem, options?: { replaceTriggerLength?: number }) => {
      const editor = editorRef.current
      if (!editor || editorDisabled) return
      editor.focus()

      let insertRange: Range | null = null
      const replaceLen = options?.replaceTriggerLength
      if (replaceLen != null && replaceLen > 0) {
        insertRange = deleteTriggerBeforeCaret(replaceLen)
        if (!insertRange) {
          closeMentionMenu()
          return
        }
      } else {
        ensureCaretInEditor(editor)
        const sel = window.getSelection()
        if (!sel || !sel.rangeCount) return
        insertRange = sel.getRangeAt(0)
        insertRange.deleteContents()
      }

      const chip = createMentionChip(item)
      insertRange.insertNode(chip)
      const space = document.createTextNode('\u00a0')
      chip.after(space)

      const sel = window.getSelection()
      if (sel) {
        const after = document.createRange()
        after.setStart(space, space.data.length)
        after.collapse(true)
        sel.removeAllRanges()
        sel.addRange(after)
      }

      closeMentionMenu()
      emitChange()
    },
    [closeMentionMenu, editorDisabled, emitChange],
  )

  const insertMention = useCallback(
    (item: InlineContextItem) => {
      if (!mentionMenu) return
      insertMentionChip(item, { replaceTriggerLength: mentionMenu.triggerLength })
    },
    [insertMentionChip, mentionMenu],
  )

  useImperativeHandle(
    ref,
    () => ({
      insertMention: (item: InlineContextItem) => {
        insertMentionChip(item)
      },
    }),
    [insertMentionChip],
  )

  const selectCategory = useCallback(
    (categoryId: InlineContextCategoryId) => {
      const editor = editorRef.current
      const prev = mentionMenu
      if (!prev || !editor) {
        setMentionMenu((m) =>
          m
            ? {
                ...m,
                stage: 'items',
                categoryId,
                query: '',
                triggerLength: 1,
                activeIndex: 0,
              }
            : m,
        )
        return
      }

      editor.focus()
      if (prev.query.length > 0) {
        const del = deleteTriggerBeforeCaret(prev.triggerLength)
        if (del) {
          const at = document.createTextNode('@')
          del.insertNode(at)
          const sel = window.getSelection()
          if (sel) {
            const after = document.createRange()
            after.setStart(at, 1)
            after.collapse(true)
            sel.removeAllRanges()
            sel.addRange(after)
          }
          emitChange()
        }
      }

      setMentionMenu({
        stage: 'items',
        categoryId,
        query: '',
        triggerLength: 1,
        activeIndex: 0,
        position: getCaretMenuPosition(editor),
      })
    },
    [emitChange, mentionMenu],
  )

  const openContextMentionPicker = useCallback(() => {
    if (editorDisabled) return
    const editor = editorRef.current
    if (!editor) return
    closeSlashMenu()
    ensureCaretInEditor(editor)
    const existing = getMentionTrigger(editor)
    if (!existing) {
      insertTextAtCaret(editor, '@')
      emitChange()
    }
    requestAnimationFrame(refreshMentionMenu)
  }, [closeSlashMenu, editorDisabled, emitChange, refreshMentionMenu])

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (value === '' && !editorIsEmpty(el)) {
      el.innerHTML = ''
      setEditorEmpty(true)
      closeMentionMenu()
      closeSlashMenu()
      syncEditorHeight()
    }
  }, [value, closeMentionMenu, closeSlashMenu, syncEditorHeight])

  useLayoutEffect(() => {
    const el = chatBoxRef.current
    if (!el) return

    const maxHeight = contexts.length > 0 ? 340 : 240
    gsap.killTweensOf(el)
    gsap.set(el, { height: 'auto', maxHeight })
    const nextHeight = el.offsetHeight
    const prevHeight = composerHeightRef.current

    if (prevHeight == null || Math.abs(prevHeight - nextHeight) < 1) {
      composerHeightRef.current = nextHeight
      gsap.set(el, { clearProps: 'height,maxHeight' })
      syncComposerReserve()
      return
    }

    gsap.set(el, {
      height: prevHeight,
      maxHeight: Math.max(prevHeight, nextHeight, maxHeight),
      overflow: 'hidden',
    })
    syncComposerReserve()

    const tween = gsap.to(el, {
      height: nextHeight,
      duration: COMPOSER_HEIGHT_DURATION,
      ease: COMPOSER_HEIGHT_EASE,
      onUpdate: () => {
        syncComposerReserve()
      },
      onComplete: () => {
        gsap.set(el, { clearProps: 'height,maxHeight,overflow' })
        composerHeightRef.current = el.offsetHeight
        syncComposerReserve()
      },
    })

    return () => {
      composerHeightRef.current = el.offsetHeight
      tween.kill()
      gsap.set(el, { clearProps: 'height,maxHeight,overflow' })
    }
  }, [contexts, syncComposerReserve])

  useLayoutEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    syncComposerReserve()
    const ro = new ResizeObserver(() => syncComposerReserve())
    ro.observe(dock)
    return () => ro.disconnect()
  }, [syncComposerReserve])

  useEffect(() => {
    if (!mentionMenu && !slashMenu) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (editorRef.current?.contains(target) || mentionMenuRef.current?.contains(target)) return
      if (slashMenuRef.current?.contains(target)) return
      closeMentionMenu()
      closeSlashMenu()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [mentionMenu, slashMenu, closeMentionMenu, closeSlashMenu])

  const onEditorInput = (_e: FormEvent<HTMLDivElement>) => {
    emitChange()
    const editor = editorRef.current
    if (editor && getSlashTrigger(editor)) {
      refreshSlashMenu()
      return
    }
    setSlashMenu(null)
    refreshMentionMenu()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const editor = editorRef.current
      if (editor && tryDeleteMentionChips(editor, e.key)) {
        e.preventDefault()
        emitChange()
        refreshMentionMenu()
        return
      }
    }

    if (slashMenu) {
      const listLength = filteredSlashCommands.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (listLength === 0) return
        setSlashMenu((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % listLength } : prev,
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (listLength === 0) return
        setSlashMenu((prev) =>
          prev
            ? { ...prev, activeIndex: (prev.activeIndex - 1 + listLength) % listLength }
            : prev,
        )
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeSlashMenu()
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (listLength === 0) {
          closeSlashMenu()
          if (e.key === 'Enter' && !e.shiftKey && sendState === 'active') onSend()
          return
        }
        const item = filteredSlashCommands[slashMenu.activeIndex]
        if (item) selectSlashCommand(item)
        return
      }
    }

    if (mentionMenu) {
      const listLength =
        mentionMenu.stage === 'categories' ? filteredCategories.length : filteredItems.length

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (listLength === 0) return
        setMentionMenu((prev) =>
          prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % listLength } : prev,
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (listLength === 0) return
        setMentionMenu((prev) =>
          prev
            ? { ...prev, activeIndex: (prev.activeIndex - 1 + listLength) % listLength }
            : prev,
        )
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (mentionMenu.stage === 'items') {
          setMentionMenu((prev) =>
            prev
              ? {
                  ...prev,
                  stage: 'categories',
                  categoryId: null,
                  activeIndex: 0,
                }
              : prev,
          )
        } else {
          closeMentionMenu()
        }
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (listLength === 0) return
        if (mentionMenu.stage === 'categories') {
          const cat = filteredCategories[mentionMenu.activeIndex]
          if (cat) selectCategory(cat.id)
        } else {
          const item = filteredItems[mentionMenu.activeIndex]
          if (item) insertMention(item)
        }
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (sendState === 'stop') return
      if (sendState === 'active') onSend()
    }
  }

  const addFileAttachment = () => {
    if (!showParameters || editorDisabled) return
    const index = fileCounterRef.current % FILE_SAMPLES.length
    fileCounterRef.current += 1
    const sample = FILE_SAMPLES[index]
    setContexts((prev) => [
      ...prev,
      {
        ...sample,
        id: `${uid}-file-${fileCounterRef.current}`,
      },
    ])
    onAttachClick?.()
  }

  const removeContext = (id: string) => {
    setContexts((prev) => prev.filter((item) => item.id !== id))
  }

  const showPlaceholder = editorEmpty
  const placeholder = hasThreadMessages ? 'Reply…' : 'Ask Llumen anything…'

  return (
    <div ref={dockRef} className={styles.composerFindingDock} data-lc-composer-dock="">
      {findingSlot}
      {questionSlot}
      <div
        ref={chatBoxRef}
        className={`${styles.chatBox} ${styles.chatBoxExpanded}${
          hasContexts ? ` ${styles.chatBoxWithContexts}` : ''
        }`}
        data-lc-composer=""
        data-finding-cue={findingCue ? 'true' : 'false'}
        style={
          findingCue
            ? {
                ['--orb-shimmer-1' as string]: findingCueColors?.stop1,
                ['--orb-shimmer-2' as string]: findingCueColors?.stop2,
                ['--orb-shimmer-3' as string]: findingCueColors?.stop3,
              }
            : undefined
        }
      >
      {hasContexts ? (
        <div className={styles.contextChipRow} aria-label="Attached files">
          {contexts.map((item) => (
            <ContextChip key={item.id} item={item} onRemove={removeContext} />
          ))}
        </div>
      ) : null}

      <div className={styles.composeRow}>
        <div
          ref={(el) => {
            editorRef.current = el
            chatScrollRef(el)
          }}
          className={`${styles.composerInput} ${styles.composerEditor}${
            showPlaceholder ? ` ${styles.composerEditorEmpty}` : ''
          }`}
          contentEditable={!editorDisabled}
          role="textbox"
          aria-multiline="true"
          aria-label={hasThreadMessages ? 'Reply' : 'Ask Llumen'}
          aria-placeholder={showPlaceholder ? placeholder : undefined}
          data-placeholder={showPlaceholder ? placeholder : undefined}
          data-lc-composer-editor=""
          suppressContentEditableWarning
          onInput={onEditorInput}
          onKeyDown={onKeyDown}
          onClick={() => {
            requestAnimationFrame(() => {
              const editor = editorRef.current
              if (editor && getSlashTrigger(editor)) refreshSlashMenu()
              else refreshMentionMenu()
            })
          }}
          onKeyUp={() => {
            if (slashMenu || mentionMenu) return
            requestAnimationFrame(() => {
              const editor = editorRef.current
              if (editor && getSlashTrigger(editor)) refreshSlashMenu()
              else refreshMentionMenu()
            })
          }}
        />
      </div>

      <div className={styles.composerToolbar}>
        <div className={styles.composerToolbarLeft}>
          {showParameters ? (
            <>
              <button
                type="button"
                className={styles.composerIconAction}
                aria-label="Attach file"
                disabled={editorDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={addFileAttachment}
              >
                <Paperclip size={18} weight="regular" aria-hidden />
              </button>
              <button
                ref={mentionBtnRef}
                type="button"
                className={`${styles.composerLabelAction}${
                  mentionMenu ? ` ${styles.composerLabelActionActive}` : ''
                }`}
                aria-label="Add context"
                aria-expanded={Boolean(mentionMenu)}
                aria-haspopup="listbox"
                disabled={editorDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openContextMentionPicker}
              >
                <At size={16} weight="regular" aria-hidden />
                Add context
              </button>
            </>
          ) : null}
        </div>
        <div className={styles.composerToolbarRight}>
          <button type="button" className={styles.composerIconAction} aria-label="Voice input">
            <Microphone size={18} weight="regular" aria-hidden />
          </button>
          <SendButton
            state={sendState}
            onClick={() => {
              if (sendState === 'stop') onStop()
              else onSend()
            }}
          />
        </div>
      </div>

      {slashMenu
        ? createPortal(
            <SlashCommandMenu
              menuRef={slashMenuRef}
              position={slashMenu.position}
              commands={filteredSlashCommands}
              activeIndex={slashMenu.activeIndex}
              query={slashMenu.query}
              onHoverIndex={(index) =>
                setSlashMenu((prev) => (prev ? { ...prev, activeIndex: index } : prev))
              }
              onSelect={selectSlashCommand}
            />,
            document.body,
          )
        : null}

      {mentionMenu
        ? createPortal(
            <InlineContextMenu
              menuRef={mentionMenuRef}
              position={mentionMenu.position}
              stage={mentionMenu.stage}
              categoryId={mentionMenu.categoryId}
              categories={filteredCategories}
              items={filteredItems}
              activeIndex={mentionMenu.activeIndex}
              query={mentionMenu.query}
              onHoverIndex={(index) =>
                setMentionMenu((prev) => (prev ? { ...prev, activeIndex: index } : prev))
              }
              onSelectCategory={selectCategory}
              onSelectItem={insertMention}
              onBack={() =>
                setMentionMenu((prev) =>
                  prev
                    ? {
                        ...prev,
                        stage: 'categories',
                        categoryId: null,
                        activeIndex: 0,
                      }
                    : prev,
                )
              }
            />,
            document.body,
          )
        : null}
      </div>
    </div>
  )
})
