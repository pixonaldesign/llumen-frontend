import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

type UseTranscriptSearchOptions = {
  rootRef: RefObject<HTMLElement | null>
  query: string
  /** Re-run when transcript content changes. */
  revision?: string | number
  hitClass: string
  activeHitClass: string
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (
        parent.closest(
          'mark[data-lc-search-hit], [data-lc-composer], script, style, [aria-hidden="true"]',
        )
      ) {
        return NodeFilter.FILTER_REJECT
      }
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let current: Node | null = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

function clearSearchHits(root: HTMLElement) {
  const marks = root.querySelectorAll('mark[data-lc-search-hit]')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  })
  root.normalize()
}

function applySearchHits(
  root: HTMLElement,
  query: string,
  hitClass: string,
): HTMLElement[][] {
  clearSearchHits(root)
  const needle = query.trim()
  if (!needle) return []

  const textNodes = collectTextNodes(root)
  if (textNodes.length === 0) return []

  let fullText = ''
  const nodeRanges: { node: Text; start: number; end: number }[] = []
  for (const node of textNodes) {
    const value = node.nodeValue ?? ''
    nodeRanges.push({ node, start: fullText.length, end: fullText.length + value.length })
    fullText += value
  }

  const haystack = fullText.toLowerCase()
  const needleLower = needle.toLowerCase()
  const matchStarts: number[] = []
  let from = 0
  while (from <= haystack.length - needleLower.length) {
    const index = haystack.indexOf(needleLower, from)
    if (index === -1) break
    matchStarts.push(index)
    from = index + needleLower.length
  }
  if (matchStarts.length === 0) return []

  type WrapOp = { node: Text; start: number; end: number; matchIndex: number }
  const ops: WrapOp[] = []
  matchStarts.forEach((matchStart, matchIndex) => {
    const matchEnd = matchStart + needleLower.length
    for (const { node, start, end } of nodeRanges) {
      if (end <= matchStart || start >= matchEnd) continue
      ops.push({
        node,
        start: Math.max(0, matchStart - start),
        end: Math.min(node.nodeValue?.length ?? 0, matchEnd - start),
        matchIndex,
      })
    }
  })

  const byNode = new Map<Text, WrapOp[]>()
  for (const op of ops) {
    const list = byNode.get(op.node)
    if (list) list.push(op)
    else byNode.set(op.node, [op])
  }

  const matchMarks: HTMLElement[][] = matchStarts.map(() => [])

  for (const [node, nodeOps] of byNode) {
    nodeOps.sort((a, b) => b.start - a.start)
    for (const op of nodeOps) {
      if (!node.parentNode || !node.nodeValue) continue
      if (op.end < node.nodeValue.length) node.splitText(op.end)
      const mid = op.start > 0 ? node.splitText(op.start) : node
      const mark = document.createElement('mark')
      mark.dataset.lcSearchHit = ''
      mark.dataset.lcSearchMatch = String(op.matchIndex)
      mark.className = hitClass
      mid.parentNode?.replaceChild(mark, mid)
      mark.appendChild(mid)
      matchMarks[op.matchIndex].push(mark)
    }
  }

  return matchMarks
}

function setActiveMarks(
  root: HTMLElement,
  activeIndex: number,
  activeHitClass: string,
) {
  const marks = root.querySelectorAll<HTMLElement>('mark[data-lc-search-hit]')
  marks.forEach((mark) => {
    const matchIndex = Number(mark.dataset.lcSearchMatch)
    mark.classList.toggle(activeHitClass, matchIndex === activeIndex)
  })
}

export function useTranscriptSearch({
  rootRef,
  query,
  revision = 0,
  hitClass,
  activeHitClass,
}: UseTranscriptSearchOptions) {
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const applyingRef = useRef(false)
  const matchCountRef = useRef(0)

  const paint = useCallback(
    (scrollToActive: boolean) => {
      const root = rootRef.current
      if (!root) {
        matchCountRef.current = 0
        setMatchCount(0)
        setActiveIndex(-1)
        return
      }

      applyingRef.current = true
      const matchMarks = applySearchHits(root, query, hitClass)
      const count = matchMarks.length
      matchCountRef.current = count

      let nextActive = activeIndexRef.current
      if (count <= 0) nextActive = -1
      else if (nextActive < 0 || nextActive >= count) nextActive = 0

      setMatchCount(count)
      setActiveIndex(nextActive)
      setActiveMarks(root, nextActive, activeHitClass)

      if (scrollToActive && nextActive >= 0) {
        const activeMark = root.querySelector<HTMLElement>(
          `mark[data-lc-search-hit][data-lc-search-match="${nextActive}"]`,
        )
        activeMark?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }

      // Let the mutation observer settle after our own DOM writes.
      requestAnimationFrame(() => {
        applyingRef.current = false
      })
    },
    [rootRef, query, hitClass, activeHitClass],
  )

  useLayoutEffect(() => {
    paint(Boolean(query.trim()))

    const root = rootRef.current
    if (!root || !query.trim()) {
      return () => {
        if (root) {
          applyingRef.current = true
          clearSearchHits(root)
          applyingRef.current = false
        }
      }
    }

    let frame = 0
    const observer = new MutationObserver(() => {
      if (applyingRef.current) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => paint(false))
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      applyingRef.current = true
      clearSearchHits(root)
      applyingRef.current = false
    }
  }, [paint, rootRef, query, revision])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || activeIndex < 0) return
    setActiveMarks(root, activeIndex, activeHitClass)
    const activeMark = root.querySelector<HTMLElement>(
      `mark[data-lc-search-hit][data-lc-search-match="${activeIndex}"]`,
    )
    activeMark?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [rootRef, activeIndex, activeHitClass])

  const goNext = useCallback(() => {
    setActiveIndex((current) => {
      const count = matchCountRef.current
      if (count <= 0) return -1
      if (current < 0) return 0
      return (current + 1) % count
    })
  }, [])

  const goPrev = useCallback(() => {
    setActiveIndex((current) => {
      const count = matchCountRef.current
      if (count <= 0) return -1
      if (current < 0) return count - 1
      return (current - 1 + count) % count
    })
  }, [])

  return {
    matchCount,
    activeIndex,
    goNext,
    goPrev,
  }
}
