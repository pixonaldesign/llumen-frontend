import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowUp, At, ChatText, ClockCounterClockwise, File, Paperclip, X } from '@phosphor-icons/react'
import { BorderBeam } from 'border-beam'
import gsap from 'gsap'
import { llumenAssets } from '../assets'
import { InlineContextMenu } from '../InlineContextMenu'
import {
  filterCategories,
  filterItems,
  getCategoryIcon,
  type InlineContextCategoryId,
  type InlineContextItem,
} from '../inlineContextData'
import { SlashCommandMenu } from '../SlashCommandMenu'
import { FINDING_DISMISS_MS } from './findingAuroraSettings'
import {
  filterSlashCommands,
  getSlashMenuPosition,
  getSlashTrigger,
  insertSlashCommand,
  type SlashCommand,
  type SlashCommandId,
  type SlashMenuPosition,
} from '../slashCommands'
import panelStyles from '../compact-assistant.module.css'
import type { LandingContextChip } from './LandingChatbox'
import styles from './HubChatbox.module.css'

type HubFileChip = {
  id: string
  name: string
  typeBadge: string
  thumbSrc?: string
}

const FILE_SAMPLES: Omit<HubFileChip, 'id'>[] = [
  { name: 'ops-notes.pdf', typeBadge: 'PDF' },
  { name: 'station-export.csv', typeBadge: 'CSV' },
  {
    name: 'abu-dhabi-aqi.png',
    typeBadge: 'PNG',
    thumbSrc: llumenAssets.mapAbuDhabiAqi,
  },
  { name: 'corridor-brief.docx', typeBadge: 'DOCX' },
]

function serializeEditor(root: HTMLElement): string {
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

/** Same stagger as transcript answer copy (`AssistantTimelineReply`). */
const WORD_REVEAL_STAGGER_MS = 48

function splitWordSpaceSegments(text: string): { text: string; isWord: boolean }[] {
  const segments: { text: string; isWord: boolean }[] = []
  const re = /\S+|\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    segments.push({ text: m[0], isWord: /\S/.test(m[0]) })
  }
  return segments
}

function ToastMessage({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  if (reduceMotion || !text) {
    return (
      <p className={styles.toastMessage} aria-live="polite">
        {text}
      </p>
    )
  }

  const segments = splitWordSpaceSegments(text)
  let wordIndex = 0

  return (
    <p className={styles.toastMessage} aria-live="polite">
      {segments.map((seg, idx) => {
        if (!seg.isWord) {
          return <span key={`sp-${idx}`}>{seg.text}</span>
        }
        const delay = wordIndex * WORD_REVEAL_STAGGER_MS
        wordIndex += 1
        return (
          <span
            key={`w-${idx}-${seg.text.slice(0, 24)}`}
            className={styles.wordReveal}
            style={{ animationDelay: `${delay}ms` }}
          >
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

function createInlineMentionChip(item: InlineContextItem): HTMLSpanElement {
  const Icon = getCategoryIcon(item.categoryId)
  const chip = document.createElement('span')
  chip.className = panelStyles.inlineMention
  chip.contentEditable = 'false'
  chip.dataset.inlineMention = item.id
  chip.dataset.mentionName = item.name
  chip.dataset.mentionCategory = item.categoryId

  const iconHost = document.createElement('span')
  iconHost.className = panelStyles.inlineMentionIcon
  iconHost.setAttribute('aria-hidden', 'true')
  iconHost.innerHTML = renderToStaticMarkup(<Icon size={12} weight="bold" />)

  const label = document.createElement('span')
  label.className = panelStyles.inlineMentionLabel
  label.textContent = item.name

  chip.append(iconHost, label)
  return chip
}

function chipToMentionItem(chip: LandingContextChip): InlineContextItem {
  return {
    id: chip.id,
    name: chip.label,
    categoryId: chip.categoryId ?? 'briefings',
    description: chip.domain,
  }
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

export type HubWorkToast = {
  message: string
}

type SlashMenuState = {
  query: string
  activeIndex: number
  triggerLength: number
  position: SlashMenuPosition
}

export type HubChatboxProps = {
  onSubmit: (text: string, chips: LandingContextChip[]) => void
  chips?: LandingContextChip[]
  onRemoveChip?: (id: string) => void
  onOpenSessions: () => void
  focusToken?: number
  exiting?: boolean
  placement?: 'landing' | 'story'
  morphFrom?: DOMRect | null
  /** When set, shows an X to collapse the hub (e.g. back to the Story ask orb). */
  onCollapse?: () => void
  /** Fires as soon as that dismiss starts, before the shrink animation finishes. */
  onWillCollapse?: () => void
  /** Increment to collapse back to the compact orb. */
  collapseToken?: number
  /** Slash-command work toast — replaces the composer until viewed or dismissed. */
  workToast?: HubWorkToast | null
  onViewWorkInChat?: () => void
  onDismissWork?: () => void
  findingUnread?: boolean
  /** Reopens dismissed findings from the unread orb. */
  onRestoreFindings?: () => void
  /** Aurora border shimmer while the first finding reveal is on screen. */
  findingCue?: boolean
  /** Orb ring only. Used when a toast starts from the compact orb, not the collapsed or expanded box. */
  orbCue?: boolean
  /** Fade the toast ring out at the end of its second. Alert cue does not set this. */
  shimmerExit?: boolean
  findingCueColors?: { stop1: string; stop2: string; stop3: string }
}

export function HubChatbox({
  onSubmit,
  chips = [],
  onRemoveChip,
  onOpenSessions,
  focusToken = 0,
  exiting = false,
  placement = 'landing',
  morphFrom = null,
  onCollapse,
  onWillCollapse,
  collapseToken = 0,
  workToast = null,
  onViewWorkInChat,
  onDismissWork,
  findingUnread = false,
  onRestoreFindings,
  findingCue = false,
  orbCue = false,
  shimmerExit = false,
  findingCueColors,
}: HubChatboxProps) {
  const [focused, setFocused] = useState(false)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const [serialized, setSerialized] = useState('')
  const [files, setFiles] = useState<HubFileChip[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionStage, setMentionStage] = useState<'categories' | 'items'>('categories')
  const [mentionCategory, setMentionCategory] = useState<InlineContextCategoryId | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionPos, setMentionPos] = useState({ left: 0, bottom: 0 })
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const fileCounterRef = useRef(0)
  const uid = useId()
  const editorRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLFormElement>(null)
  const mentionBtnRef = useRef<HTMLButtonElement>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const insertedChipIdsRef = useRef<Set<string>>(new Set())
  const [morphingOut, setMorphingOut] = useState(false)

  const toasting = Boolean(workToast)
  const workToastKey = workToast?.message ?? ''
  useEffect(() => {
    if (!workToast) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => onDismissWork?.(), reduce ? 0 : FINDING_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [workToast, onDismissWork])
  // Story opens straight into the full chat. Landing rests on the bar until the field is used.
  const engaged =
    !editorEmpty || files.length > 0 || mentionOpen || Boolean(slashMenu) || toasting
  const expanded = placement === 'story' || focused || engaged
  const idle = !expanded && !toasting
  const canSend = !toasting && (!editorEmpty || files.length > 0)
  const interactionLocked = exiting || morphingOut || toasting
  const slashCommands = useMemo(() => filterSlashCommands(slashMenu?.query ?? ''), [slashMenu?.query])
  const categories = useMemo(() => filterCategories(''), [])
  const items = useMemo(
    () => (mentionCategory ? filterItems(mentionCategory, '') : []),
    [mentionCategory],
  )

  const syncEditor = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    setEditorEmpty(editorIsEmpty(el))
    setSerialized(serializeEditor(el))
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [])

  const closeMention = useCallback(() => {
    setMentionOpen(false)
    setMentionStage('categories')
    setMentionCategory(null)
    setMentionIndex(0)
  }, [])

  const closeSlash = useCallback(() => {
    setSlashMenu(null)
  }, [])

  const refreshSlashMenu = useCallback(() => {
    const editor = editorRef.current
    const box = boxRef.current
    if (!editor || !box || interactionLocked) {
      setSlashMenu(null)
      return
    }
    const trigger = getSlashTrigger(editor)
    if (!trigger) {
      setSlashMenu(null)
      return
    }
    closeMention()
    const listLength = filterSlashCommands(trigger.query).length
    setSlashMenu((prev) => ({
      query: trigger.query,
      triggerLength: trigger.triggerLength,
      activeIndex: Math.min(prev?.activeIndex ?? 0, Math.max(0, listLength - 1)),
      position: getSlashMenuPosition(box),
    }))
  }, [closeMention, interactionLocked])

  useLayoutEffect(() => {
    if (!slashMenu) return
    const sync = () => {
      const box = boxRef.current
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
  }, [slashMenu, expanded])

  const selectSlashCommand = useCallback(
    (command: SlashCommand | SlashCommandId) => {
      const editor = editorRef.current
      if (!editor || interactionLocked) return
      const id = typeof command === 'string' ? command : command.id
      insertSlashCommand(editor, id, slashMenu?.triggerLength ?? 1)
      closeSlash()
      syncEditor()
    },
    [closeSlash, interactionLocked, slashMenu?.triggerLength, syncEditor],
  )

  const insertInlineMention = useCallback(
    (item: InlineContextItem) => {
      const editor = editorRef.current
      if (!editor || exiting) return
      ensureCaretInEditor(editor)
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const range = sel.getRangeAt(0)
      range.deleteContents()

      const chip = createInlineMentionChip(item)
      range.insertNode(chip)
      const space = document.createTextNode('\u00a0')
      chip.after(space)

      const after = document.createRange()
      after.setStart(space, space.data.length)
      after.collapse(true)
      sel.removeAllRanges()
      sel.addRange(after)

      insertedChipIdsRef.current.add(item.id)
      closeMention()
      syncEditor()
    },
    [closeMention, exiting, syncEditor],
  )

  // External context (Story / Tell Me More) → inline mention chips in the editor
  useEffect(() => {
    if (exiting || chips.length === 0) return
    const editor = editorRef.current
    if (!editor) return

    let inserted = false
    for (const chip of chips) {
      if (insertedChipIdsRef.current.has(chip.id)) {
        onRemoveChip?.(chip.id)
        continue
      }
      if (editor.querySelector(`[data-inline-mention="${CSS.escape(chip.id)}"]`)) {
        insertedChipIdsRef.current.add(chip.id)
        onRemoveChip?.(chip.id)
        continue
      }
      ensureCaretInEditor(editor)
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) continue
      const range = sel.getRangeAt(0)
      range.collapse(false)
      const mention = createInlineMentionChip(chipToMentionItem(chip))
      range.insertNode(mention)
      const space = document.createTextNode('\u00a0')
      mention.after(space)
      const after = document.createRange()
      after.setStart(space, space.data.length)
      after.collapse(true)
      sel.removeAllRanges()
      sel.addRange(after)
      insertedChipIdsRef.current.add(chip.id)
      onRemoveChip?.(chip.id)
      inserted = true
    }
    if (inserted) syncEditor()
  }, [chips, exiting, onRemoveChip, syncEditor])

  useEffect(() => {
    if (focusToken <= 0 || exiting) return
    editorRef.current?.focus()
  }, [focusToken, exiting])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || placement !== 'story' || !morphFrom || exiting) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { opacity: 0, y: 18, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.34,
        ease: 'power3.out',
        onComplete: () => {
          gsap.set(el, { clearProps: 'transform,opacity' })
        },
      },
    )
    return () => {
      gsap.killTweensOf(el)
    }
  }, [morphFrom, exiting, placement])

  useEffect(() => {
    if (!mentionOpen && !slashMenu) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (mentionMenuRef.current?.contains(target)) return
      if (mentionBtnRef.current?.contains(target)) return
      if (slashMenuRef.current?.contains(target)) return
      if (editorRef.current?.contains(target)) return
      closeMention()
      closeSlash()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [mentionOpen, slashMenu, closeMention, closeSlash])

  const placeMentionMenu = () => {
    const btn = mentionBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMentionPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 8,
    })
  }

  const openMention = () => {
    if (interactionLocked) return
    closeSlash()
    placeMentionMenu()
    setMentionOpen(true)
    setMentionStage('categories')
    setMentionCategory(null)
    setMentionIndex(0)
  }

  const addFile = () => {
    if (interactionLocked) return
    const sample = FILE_SAMPLES[fileCounterRef.current % FILE_SAMPLES.length]
    fileCounterRef.current += 1
    setFiles((prev) => [
      ...prev,
      { ...sample, id: `${uid}-file-${fileCounterRef.current}` },
    ])
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id))
  }

  const selectCategory = (id: InlineContextCategoryId) => {
    setMentionCategory(id)
    setMentionStage('items')
    setMentionIndex(0)
  }

  const collapse = useCallback(() => {
    if (interactionLocked || !onCollapse) return false
    onWillCollapse?.()
    closeMention()
    closeSlash()

    const finish = () => {
      onCollapse()
    }

    const el = boxRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!el || reduceMotion) {
      finish()
      return true
    }

    setMorphingOut(true)
    gsap.killTweensOf(el)
    gsap.to(el, {
      opacity: 0,
      y: 14,
      scale: 0.96,
      duration: 0.26,
      ease: 'power3.in',
      onComplete: finish,
    })
    return true
  }, [closeMention, closeSlash, interactionLocked, onCollapse, onWillCollapse])

  const collapseTokenRef = useRef(collapseToken)
  useEffect(() => {
    if (!collapseToken || collapseToken === collapseTokenRef.current) return
    collapseTokenRef.current = collapseToken
    collapse()
  }, [collapseToken, collapse])

  const send = () => {
    if (interactionLocked || !canSend) return
    const editor = editorRef.current
    const text = editor ? serializeEditor(editor).trim() : serialized.trim()
    const fileChips: LandingContextChip[] = files.map((file) => ({
      id: file.id,
      label: file.name,
      categoryId: 'assets' as const,
    }))
    onSubmit(text, fileChips)
    if (editor) {
      editor.innerHTML = ''
      insertedChipIdsRef.current.clear()
    }
    setFiles([])
    closeMention()
    closeSlash()
    syncEditor()
  }

  const showPlaceholder = !toasting && editorEmpty && files.length === 0
  const placeholder = showPlaceholder ? 'Ask Llumen anything…' : ''
  const orbIdle = idle || toasting
  // compact is the standalone orb (chatbox not mounted). This box is collapsed or expanded.
  const stage = expanded ? 'expanded' : 'collapsed'
  const orbCueStyle = orbCue
    ? {
        ['--orb-shimmer-1' as string]: findingCueColors?.stop1,
        ['--orb-shimmer-2' as string]: findingCueColors?.stop2,
        ['--orb-shimmer-3' as string]: findingCueColors?.stop3,
      }
    : undefined
  const reduceBeamMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const form = (
      <form
        ref={boxRef}
        className={`${styles.box}${toasting ? ` ${styles.boxToast}` : ''}`}
        data-stage={stage}
        data-finding-cue={findingCue ? 'true' : 'false'}
        data-shimmer-exit={shimmerExit ? 'true' : 'false'}
        style={
          findingCue
            ? {
                ['--orb-shimmer-1' as string]: findingCueColors?.stop1,
                ['--orb-shimmer-2' as string]: findingCueColors?.stop2,
                ['--orb-shimmer-3' as string]: findingCueColors?.stop3,
              }
            : undefined
        }
        onSubmit={(e) => {
          e.preventDefault()
          if (!toasting) send()
        }}
      >
        {!toasting && files.length > 0 ? (
          <div
            className={`${panelStyles.contextChipRow} ${styles.chipRow}`}
            aria-label="Attached files"
          >
            {files.map((file) => {
              const isImageChip = Boolean(file.thumbSrc)
              return (
                <div
                  key={file.id}
                  className={`${panelStyles.contextChip}${
                    isImageChip ? ` ${panelStyles.contextChipImage}` : ''
                  }`}
                  title={file.name}
                  aria-label={isImageChip ? file.name : undefined}
                >
                  {file.thumbSrc ? (
                    <span
                      className={panelStyles.contextChipThumb}
                      style={{ backgroundImage: `url(${file.thumbSrc})` }}
                      aria-hidden
                    />
                  ) : null}
                  {!isImageChip ? (
                    <>
                      <p className={panelStyles.contextChipName}>{file.name}</p>
                      <div className={panelStyles.contextChipFooter}>
                        <File
                          className={panelStyles.contextChipKindIcon}
                          size={14}
                          weight="regular"
                          aria-hidden
                        />
                        <span className={panelStyles.contextChipBadge}>{file.typeBadge}</span>
                      </div>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={panelStyles.contextChipRemove}
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(file.id)}
                  >
                    <X size={12} weight="bold" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        <div className={styles.composeRow}>
          <span className={styles.orbWrap}>
            {findingUnread && orbIdle && onRestoreFindings ? (
              <button
                type="button"
                className={styles.orbRestore}
                aria-label="Show findings"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onRestoreFindings}
              >
                <span
                  className={styles.orb}
                  data-orb-cue={orbCue ? 'true' : 'false'}
                  style={orbCueStyle}
                  aria-hidden
                >
                  <img className={panelStyles.launcherIcon} src={llumenAssets.launcherOrb} alt="" />
                </span>
                <span className={styles.unreadDot} />
              </button>
            ) : (
              <span
                className={`${styles.orb}${orbIdle ? '' : ` ${styles.orbCollapsed}`}`}
                data-orb-cue={orbCue ? 'true' : 'false'}
                style={orbCueStyle}
                aria-hidden
              >
                <img className={panelStyles.launcherIcon} src={llumenAssets.launcherOrb} alt="" />
              </span>
            )}
          </span>
          {toasting && workToast ? (
            <ToastMessage text={workToast.message} reduceMotion={reduceBeamMotion} />
          ) : (
            <div
              ref={editorRef}
              className={`${styles.input} ${styles.composerEditor}${
                showPlaceholder ? ` ${styles.composerEditorEmpty}` : ''
              }${idle ? '' : ` ${styles.inputEngaged}`}`}
              contentEditable={!interactionLocked}
              role="textbox"
              aria-multiline="true"
              aria-label="Ask Llumen"
              aria-placeholder={showPlaceholder ? 'Ask Llumen anything…' : undefined}
              data-placeholder={placeholder || undefined}
              suppressContentEditableWarning
              onInput={() => {
                syncEditor()
                refreshSlashMenu()
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onClick={() => {
                requestAnimationFrame(refreshSlashMenu)
              }}
              onKeyUp={() => {
                if (!slashMenu) requestAnimationFrame(refreshSlashMenu)
              }}
              onKeyDown={(e) => {
                if (slashMenu) {
                  const listLength = slashCommands.length
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
                    closeSlash()
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    if (listLength === 0) {
                      closeSlash()
                      if (e.key === 'Enter' && !e.shiftKey) send()
                      return
                    }
                    const item = slashCommands[slashMenu.activeIndex]
                    if (item) selectSlashCommand(item)
                    return
                  }
                }
                if (e.key === 'Escape' && toasting) {
                  e.preventDefault()
                  onDismissWork?.()
                  return
                }
                if (e.key === 'Escape' && onCollapse && !mentionOpen) {
                  e.preventDefault()
                  collapse()
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
          )}
          {onCollapse && !toasting ? (
            <button
              type="button"
              className={`${styles.collapseBtn}${idle ? '' : ` ${styles.collapseBtnOpposite}`}`}
              aria-label="Minimize to orb"
              disabled={interactionLocked}
              onMouseDown={(e) => e.preventDefault()}
              onClick={collapse}
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>

        <div
          className={`${styles.toolbar}${expanded ? '' : ` ${styles.toolbarCollapsed}`}`}
          aria-hidden={!expanded}
        >
          {toasting ? (
            <div className={styles.toolbarRight}>
              <button
                type="button"
                className={styles.toastActionPrimary}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onViewWorkInChat}
              >
                <ChatText size={16} weight="regular" aria-hidden />
                View in chat
              </button>
              <button
                type="button"
                className={styles.toastClose}
                aria-label="Dismiss"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onDismissWork}
                style={{ ['--toast-dismiss' as string]: `${FINDING_DISMISS_MS}ms` }}
              >
                <X size={12} weight="bold" aria-hidden />
                <svg key={workToastKey} className={styles.toastCloseRing} viewBox="0 0 24 24" overflow="visible" aria-hidden>
                  <circle
                    className={styles.toastCloseTrack}
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="1.5"
                  />
                  <circle
                    className={styles.toastCloseProgress}
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    pathLength="100"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className={styles.toolbarLeft}>
                <button
                  type="button"
                  className={styles.iconAction}
                  aria-label="Attach file"
                  disabled={interactionLocked || !expanded}
                  tabIndex={expanded ? 0 : -1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addFile}
                >
                  <Paperclip size={18} weight="regular" aria-hidden />
                </button>
                <button
                  ref={mentionBtnRef}
                  type="button"
                  className={`${styles.labelAction}${mentionOpen ? ` ${styles.labelActionActive}` : ''}`}
                  aria-expanded={mentionOpen}
                  aria-haspopup="listbox"
                  disabled={interactionLocked || !expanded}
                  tabIndex={expanded ? 0 : -1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openMention}
                >
                  <At size={16} weight="regular" aria-hidden />
                  Add context
                </button>
              </div>
              {expanded ? (
                <div className={styles.toolbarRight}>
                  <button
                    type="button"
                    className={styles.iconAction}
                    aria-label="Past sessions"
                    disabled={interactionLocked}
                    tabIndex={expanded ? 0 : -1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onOpenSessions}
                  >
                    <ClockCounterClockwise size={18} weight="regular" aria-hidden />
                  </button>
                  <button
                    type="submit"
                    className={styles.send}
                    disabled={interactionLocked || !canSend}
                    tabIndex={expanded ? 0 : -1}
                    aria-label="Send"
                  >
                    <ArrowUp size={18} weight="regular" aria-hidden />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </form>
  )

  return (
    <div
      className={`${styles.root}${exiting ? ` ${styles.rootExiting}` : ''}${
        morphingOut ? ` ${styles.rootMorphingOut}` : ''
      }`}
      data-lc-hub-chat=""
      aria-hidden={exiting || morphingOut}
    >
      {toasting ? (
        <BorderBeam
          size="line"
          theme="dark"
          colorVariant="colorful"
          brightness={1.85}
          active={!reduceBeamMotion}
          className={styles.beamWrap}
        >
          {form}
        </BorderBeam>
      ) : (
        form
      )}
      {slashMenu
        ? createPortal(
            <SlashCommandMenu
              menuRef={slashMenuRef}
              position={slashMenu.position}
              commands={slashCommands}
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
      {mentionOpen
        ? createPortal(
            <InlineContextMenu
              menuRef={mentionMenuRef}
              position={mentionPos}
              stage={mentionStage}
              categoryId={mentionCategory}
              categories={categories}
              items={items}
              activeIndex={mentionIndex}
              query=""
              onHoverIndex={setMentionIndex}
              onSelectCategory={selectCategory}
              onSelectItem={insertInlineMention}
              onBack={() => {
                setMentionStage('categories')
                setMentionCategory(null)
                setMentionIndex(0)
              }}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
