import {
  KIND_META,
  groupOfNode,
  groupsFor,
  type ContextGraph,
  type ContextGroupBy,
  type ContextKind,
  type ContextNode,
  type ContextRelation,
  type ContextShape,
} from './studioContextGraph'

export type View = { x: number; y: number; k: number }
export type GroupState = 'auto' | 'open' | 'closed'
/** `group` is a closed group's disc, `halo` the empty inside of an open one; both drag the whole group. */
export type Hit = { type: 'node' | 'group' | 'label' | 'halo'; id: string }

type SimNode = {
  id: string
  node: ContextNode
  x: number
  y: number
  vx: number
  vy: number
  r: number
  degree: number
  group: SimGroup
  pinned: boolean
}

type SimEdge = { a: SimNode; b: SimNode; relation: ContextRelation; seed: number }

type SimGroup = {
  id: string
  label: string
  color: string
  members: SimNode[]
  ax: number
  ay: number
  cx: number
  cy: number
  extent: number
  t: number
  labelBox: { x: number; y: number; w: number; h: number } | null
  /** Placed by hand: automatic spacing leaves it where it is. */
  fixed: boolean
}

type Placements = Record<string, { x: number; y: number }>

const PLACEMENTS_KEY = 'llumen.studio.context.groups'

function readPlacements(): Placements {
  try {
    return JSON.parse(localStorage.getItem(PLACEMENTS_KEY) ?? '{}') as Placements
  } catch {
    return {}
  }
}

/** `rank` orders a focused node's neighbours, most recently updated first; 0 is the most prominent. */
type Focus = { nodes: Set<string>; edges: Set<SimEdge>; groups: Set<string>; rank: Map<string, number> }

/** Neighbours ranked below this stay fully lit and labelled; past RANK_FADE_END they are at their faintest. */
const RANK_FULL = 8
const RANK_FADE_END = 32

/** 1 for the top-ranked neighbours, easing down to 0 for the long tail. */
function rankWeight(rank: number | undefined) {
  return rank === undefined ? 1 : 1 - smoothstep(RANK_FULL, RANK_FADE_END, rank)
}

export const MIN_K = 0.25
export const MAX_K = 4
/** How far a closed group's members sit from its centre, as a share of their open spread. */
const MINI = 0.34
/** A group opens by itself once its halo is this wide on screen. */
const AUTO_OPEN_PX = 170
const HALO_PAD = 22
/** Screen padding around a framed box, plus room for labels outside it and, below, the Llumen AI bar. */
const FRAME_PAD = 40
const LABEL_ROOM_TOP = 28
const LABEL_ROOM_BOTTOM = 60
/** World units kept clear between two groups' open halos, room for the label that sits over each. */
const GROUP_GAP = 110

const BASE_RADIUS: Record<ContextKind, number> = {
  source: 7,
  asset: 6,
  app: 7.5,
  flow: 6.5,
  finding: 6,
  filter: 5,
  context: 6.5,
}
/** World units between background dots; doubles whenever they would crowd closer than MIN_DOT_PX on screen. */
const DOT_STEP = 24
const MIN_DOT_PX = 14

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ease(t: number) {
  return t * t * (3 - 2 * t)
}

function smoothstep(a: number, b: number, value: number) {
  return ease(clamp((value - a) / (b - a), 0, 1))
}

/** The farthest a member may sit from its group's anchor; a safety net above the group's natural packing. */
function spreadLimit(count: number) {
  return 60 + 40 * Math.sqrt(count)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${clamp(alpha, 0, 1)})`
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Spreads the groups out so linked ones sit close and none overlap at their open size. */
function layoutAnchors(groups: SimGroup[], weights: Map<string, number>, spread: (g: SimGroup) => number) {
  const ring = 140 + 70 * groups.length
  groups.forEach((g, index) => {
    if (g.fixed) return
    const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2
    g.ax = Math.cos(angle) * ring
    g.ay = Math.sin(angle) * ring
  })
  for (let step = 0; step < 900; step++) {
    const cool = 1 - step / 900
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]
        const b = groups[j]
        const dx = b.ax - a.ax
        const dy = b.ay - a.ay
        const d = Math.hypot(dx, dy) || 0.01
        const min = spread(a) + spread(b) + 60
        const w = weights.get(a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`) ?? 0
        let push = 0
        if (d < min) push = ((min - d) / d) * 0.5
        else if (w) push = -((d - min) / d) * Math.min(0.04, 0.008 * w) * cool
        else push = (1800 / (d * d)) * cool
        // A hand-placed group holds still, so the other side takes the whole push.
        if (a.fixed && b.fixed) continue
        const share = a.fixed || b.fixed ? 2 : 1
        if (!a.fixed) {
          a.ax -= dx * push * share
          a.ay -= dy * push * share
        }
        if (!b.fixed) {
          b.ax += dx * push * share
          b.ay += dy * push * share
        }
      }
    }
    if (groups.some((g) => g.fixed)) continue
    for (const g of groups) {
      g.ax *= 0.995
      g.ay *= 0.995
    }
  }
}

/** A closed polygon with each corner rounded by `radius`. */
function roundedPolygon(ctx: CanvasRenderingContext2D, points: [number, number][], radius: number) {
  const last = points[points.length - 1]
  ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2)
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    ctx.arcTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2, radius)
  })
  ctx.closePath()
}

function traceShape(ctx: CanvasRenderingContext2D, shape: ContextShape, x: number, y: number, r: number) {
  ctx.beginPath()
  switch (shape) {
    case 'circle':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      break
    case 'square': {
      const s = r * 0.9
      ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.4)
      break
    }
    case 'page': {
      const w = r * 0.78
      const h = r * 1.02
      ctx.roundRect(x - w, y - h, w * 2, h * 2, r * 0.32)
      break
    }
    case 'diamond': {
      const s = r * 1.3
      roundedPolygon(
        ctx,
        [
          [x, y - s],
          [x + s, y],
          [x, y + s],
          [x - s, y],
        ],
        r * 0.35,
      )
      break
    }
    case 'hexagon': {
      const s = r * 1.12
      const points = Array.from({ length: 6 }, (_, i): [number, number] => {
        const angle = (Math.PI / 3) * i + Math.PI / 6
        return [x + Math.cos(angle) * s, y + Math.sin(angle) * s]
      })
      roundedPolygon(ctx, points, r * 0.3)
      break
    }
    case 'star': {
      const s = r * 1.5
      const points = Array.from({ length: 10 }, (_, i): [number, number] => {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const d = i % 2 ? s * 0.5 : s
        return [x + Math.cos(angle) * d, y + Math.sin(angle) * d + r * 0.1]
      })
      roundedPolygon(ctx, points, r * 0.18)
      break
    }
    case 'triangle': {
      const s = r * 1.4
      roundedPolygon(
        ctx,
        [
          [x, y - s],
          [x + s * 0.94, y + s * 0.6],
          [x - s * 0.94, y + s * 0.6],
        ],
        r * 0.3,
      )
      break
    }
  }
}

/** The context graph's physics, camera and drawing; React only feeds it data and pointer events. */
export class ContextEngine {
  nodes: SimNode[] = []
  edges: SimEdge[] = []
  groups: SimGroup[] = []
  byId = new Map<string, SimNode>()
  groupById = new Map<string, SimGroup>()
  adjacency = new Map<string, Set<string>>()
  states = new Map<string, GroupState>()

  view: View = { x: 0, y: 0, k: 0.8 }
  target: View | null = null
  size = { w: 0, h: 0 }
  private insetRight = 0

  alpha = 1
  alphaTarget = 0

  hover: Hit | null = null
  /** A connection the inspector is pointing at. */
  pointed: string | null = null
  selected: string | null = null
  private matches: Set<string> | null = null
  private matchesKey = ''

  focusAmount = 0
  /** Frame everything once the layout settles, so auto-open sizes are final. */
  private pendingFit = false
  private respaced = false
  private weights = new Map<string, number>()
  private graph: ContextGraph | null = null
  private signature = ''
  private groupBy: ContextGroupBy = 'kind'
  private grabbed: string | null = null
  private placements: Placements = readPlacements()
  private lastFocus: Focus | null = null
  private focusKey = ''
  private cachedFocus: Focus | null = null
  font = 'system-ui, sans-serif'
  reducedMotion = false

  configure(font: string, reducedMotion: boolean) {
    this.font = font || this.font
    this.reducedMotion = reducedMotion
  }

  resize(w: number, h: number) {
    this.size = { w, h }
  }

  /** With a node selected, only it and its neighbours respond to the pointer; everything else stays still. */
  canHover(hit: Hit | null) {
    if (!hit || !this.selected) return true
    if (hit.type !== 'node') return false
    return hit.id === this.selected || (this.adjacency.get(this.selected)?.has(hit.id) ?? false)
  }

  setHover(hit: Hit | null) {
    this.hover = this.canHover(hit) ? hit : null
  }

  setPointed(id: string | null) {
    this.pointed = id
  }

  setSelected(id: string | null) {
    this.selected = id
    if (!this.canHover(this.hover)) this.hover = null
  }

  /** The neighbour of the selected node that the pointer or the inspector is on. */
  private accent() {
    if (!this.selected) return null
    const id = this.hover?.type === 'node' ? this.hover.id : this.pointed
    return id && id !== this.selected ? id : null
  }

  setData(graph: ContextGraph, groupBy: ContextGroupBy, hidden: Set<ContextKind>) {
    const signature = `${groupBy}|${[...hidden].sort().join(',')}`
    if (graph === this.graph && signature === this.signature) return
    this.graph = graph
    this.signature = signature
    const previous = this.byId
    const previousGroups = this.groupById
    const nodes = graph.nodes.filter((node) => !hidden.has(node.kind))
    const ids = new Set(nodes.map((node) => node.id))
    const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))

    const degree = new Map<string, number>()
    for (const edge of edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
    }

    this.groups = groupsFor(groupBy, nodes).map((group) => ({
      ...group,
      members: [],
      ax: 0,
      ay: 0,
      cx: 0,
      cy: 0,
      extent: 0,
      t: previousGroups.get(group.id)?.t ?? 0,
      labelBox: null,
      fixed: false,
    }))
    this.groupBy = groupBy
    this.groupById = new Map(this.groups.map((group) => [group.id, group]))

    this.nodes = nodes.map((node) => {
      const group = this.groupById.get(groupOfNode(groupBy, node))!
      const old = previous.get(node.id)
      const sim: SimNode = {
        id: node.id,
        node,
        x: old?.x ?? 0,
        y: old?.y ?? 0,
        vx: 0,
        vy: 0,
        r: BASE_RADIUS[node.kind] + 1.7 * Math.sqrt(degree.get(node.id) ?? 0),
        degree: degree.get(node.id) ?? 0,
        group,
        pinned: false,
      }
      group.members.push(sim)
      return sim
    })
    this.byId = new Map(this.nodes.map((node) => [node.id, node]))

    this.edges = edges.map((edge) => ({
      a: this.byId.get(edge.from)!,
      b: this.byId.get(edge.to)!,
      relation: edge.relation,
      seed: hash(`${edge.from}>${edge.to}`),
    }))
    this.adjacency = new Map(this.nodes.map((node) => [node.id, new Set<string>()]))
    for (const edge of this.edges) {
      this.adjacency.get(edge.a.id)!.add(edge.b.id)
      this.adjacency.get(edge.b.id)!.add(edge.a.id)
    }

    const weights = new Map<string, number>()
    for (const edge of this.edges) {
      const a = edge.a.group.id
      const b = edge.b.group.id
      if (a === b) continue
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      weights.set(key, (weights.get(key) ?? 0) + 1)
    }
    this.weights = weights
    layoutAnchors(this.groups, weights, (g) => 40 + 34 * Math.sqrt(g.members.length))

    const fresh = previous.size === 0
    for (const node of this.nodes) {
      if (previous.has(node.id)) continue
      const spread = 20 + 14 * Math.sqrt(node.group.members.length)
      const angle = hash(node.id) * Math.PI * 2
      const dist = (0.3 + hash(`${node.id}~`) * 0.7) * spread
      node.x = node.group.ax + Math.cos(angle) * dist
      node.y = node.group.ay + Math.sin(angle) * dist
    }

    if (fresh) {
      this.settle(1, 300)
      this.updateGroups(true)
      // Now each group's real size is known, space the groups by it and let them settle in place.
      layoutAnchors(this.groups, weights, (g) => g.extent + HALO_PAD)
      for (const group of this.groups) {
        for (const node of group.members) {
          node.x += group.ax - group.cx
          node.y += group.ay - group.cy
        }
      }
      this.settle(0.3, 200)
      this.updateGroups(true)
      this.applyPlacements(true)
      for (let pass = 0; pass < 200 && this.separateGroups(1); pass++);
      for (const group of this.groups) group.t = this.isOpen(group) ? 1 : 0
    } else {
      this.applyPlacements(false)
      this.alpha = Math.max(this.alpha, 0.8)
      this.pendingFit = true
      this.respaced = false
    }
    this.cachedFocus = null
    this.focusKey = ''
  }

  private placementKey(id: string) {
    return `${this.groupBy}:${id}`
  }

  /** Puts hand-placed groups back where they were left; `now` moves members at once instead of letting them drift. */
  private applyPlacements(now: boolean) {
    for (const group of this.groups) {
      const placed = this.placements[this.placementKey(group.id)]
      if (!placed) continue
      group.fixed = true
      const dx = placed.x - (now ? group.cx : group.ax)
      const dy = placed.y - (now ? group.cy : group.ay)
      if (now) this.moveGroup(group.id, dx, dy)
      else {
        group.ax += dx
        group.ay += dy
      }
    }
  }

  /**
   * Pushes apart any two groups whose open halos (plus GROUP_GAP) overlap, sized open even when closed so
   * zooming in never makes them collide. Hand-placed and grabbed groups hold still; the other one gives way.
   * `strength` is the share of each overlap resolved now. Returns whether anything moved.
   */
  private separateGroups(strength: number) {
    let moved = false
    const groups = this.groups.filter((group) => group.members.length)
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]
        const b = groups[j]
        const stillA = a.fixed || a.id === this.grabbed
        const stillB = b.fixed || b.id === this.grabbed
        if (stillA && stillB) continue
        const min = this.haloRadius(a, 1) + this.haloRadius(b, 1) + GROUP_GAP
        let dx = b.cx - a.cx
        let dy = b.cy - a.cy
        let d = Math.hypot(dx, dy)
        if (d >= min - 0.5) continue
        if (d < 0.01) {
          const angle = hash(a.id + b.id) * Math.PI * 2
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          d = 1
        }
        const push = (min - d) * strength
        const shareA = stillA ? 0 : stillB ? 1 : 0.5
        const shareB = 1 - shareA
        this.moveGroup(a.id, (-dx / d) * push * shareA, (-dy / d) * push * shareA)
        this.moveGroup(b.id, (dx / d) * push * shareB, (dy / d) * push * shareB)
        moved = true
      }
    }
    return moved
  }

  /** The group being dragged, which pushes others aside rather than being pushed. */
  grabGroup(id: string | null) {
    this.grabbed = id
  }

  /** Drags a whole group by a world-space offset, members and all. */
  moveGroup(id: string, dx: number, dy: number) {
    const group = this.groupById.get(id)
    if (!group) return
    group.ax += dx
    group.ay += dy
    group.cx += dx
    group.cy += dy
    for (const node of group.members) {
      node.x += dx
      node.y += dy
    }
  }

  /** Remembers where a dragged group was left, across regrouping and reloads. */
  placeGroup(id: string) {
    const group = this.groupById.get(id)
    if (!group) return
    group.fixed = true
    this.placements = { ...this.placements, [this.placementKey(id)]: { x: group.cx, y: group.cy } }
    try {
      localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(this.placements))
    } catch {
      // Private browsing can refuse storage; the placement still holds for this session.
    }
  }

  /** Forgets every hand placement and lets the groups space themselves again. */
  resetPlacements() {
    const prefix = `${this.groupBy}:`
    this.placements = Object.fromEntries(Object.entries(this.placements).filter(([key]) => !key.startsWith(prefix)))
    try {
      localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(this.placements))
    } catch {
      // As in placeGroup.
    }
    for (const group of this.groups) group.fixed = false
    layoutAnchors(this.groups, this.weights, (g) => g.extent + HALO_PAD)
    this.alpha = Math.max(this.alpha, 0.6)
    this.pendingFit = true
    this.respaced = true
  }

  hasPlacements() {
    return this.groups.some((group) => group.fixed)
  }

  /* ── Physics ── */

  private settle(alpha: number, ticks: number) {
    this.alpha = alpha
    for (let i = 0; i < ticks; i++) {
      this.tick()
      this.alpha -= this.alpha * 0.0228
    }
  }

  private tick() {
    const alpha = this.alpha
    const nodes = this.nodes
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) {
          dx = (hash(a.id + b.id) - 0.5) * 0.1
          dy = (hash(b.id + a.id) - 0.5) * 0.1
        }
        const d2 = dx * dx + dy * dy
        if (d2 < 250000) {
          const strength = (a.group === b.group ? 260 : 140) * alpha
          const s = strength / Math.max(d2, 16)
          a.vx -= dx * s
          a.vy -= dy * s
          b.vx += dx * s
          b.vy += dy * s
        }
        const min = a.r + b.r + 10
        if (d2 < min * min) {
          const d = Math.sqrt(d2)
          const o = ((min - d) / d) * 0.35
          if (!a.pinned) {
            a.x -= dx * o
            a.y -= dy * o
          }
          if (!b.pinned) {
            b.x += dx * o
            b.y += dy * o
          }
        }
      }
    }
    for (const edge of this.edges) {
      const { a, b } = edge
      const same = a.group === b.group
      const length = same ? 46 + a.r + b.r : 220
      // Links across groups barely pull: group collision does the spacing, and a strong pull would stretch
      // each group's members toward its neighbours.
      const strength = same ? 0.22 : 0.0012
      const dx = b.x + b.vx - a.x - a.vx
      const dy = b.y + b.vy - a.y - a.vy
      const d = Math.hypot(dx, dy) || 0.01
      const l = ((d - length) / d) * alpha * strength
      a.vx += dx * l * 0.5
      a.vy += dy * l * 0.5
      b.vx -= dx * l * 0.5
      b.vy -= dy * l * 0.5
    }
    for (const node of nodes) {
      if (node.pinned) {
        node.vx = 0
        node.vy = 0
        continue
      }
      node.vx += (node.group.ax - node.x) * 0.05 * alpha
      node.vy += (node.group.ay - node.y) * 0.05 * alpha
      node.vx *= 0.6
      node.vy *= 0.6
      node.x += node.vx
      node.y += node.vy
      // Links to other groups tug members outward; this soft cap keeps a group's size down to its member count.
      const limit = spreadLimit(node.group.members.length) - node.r
      const dx = node.x - node.group.ax
      const dy = node.y - node.group.ay
      const d = Math.hypot(dx, dy)
      if (d > limit) {
        node.x -= (dx / d) * (d - limit) * 0.5
        node.y -= (dy / d) * (d - limit) * 0.5
      }
    }
  }

  private updateGroups(snap = false) {
    for (const group of this.groups) {
      if (!group.members.length) continue
      let sx = 0
      let sy = 0
      for (const node of group.members) {
        sx += node.x
        sy += node.y
      }
      const cx = sx / group.members.length
      const cy = sy / group.members.length
      let extent = 0
      for (const node of group.members) extent = Math.max(extent, Math.hypot(node.x - cx, node.y - cy) + node.r)
      const blend = snap ? 1 : 0.2
      group.cx = lerp(group.cx, cx, blend)
      group.cy = lerp(group.cy, cy, blend)
      group.extent = lerp(group.extent, extent, blend)
    }
  }

  isOpen(group: SimGroup) {
    if (group.members.length < 2) return true
    const state = this.states.get(group.id) ?? 'auto'
    if (state !== 'auto') return state === 'open'
    return (group.extent + HALO_PAD) * this.view.k >= AUTO_OPEN_PX
  }

  anyOpen() {
    return this.groups.some((group) => group.members.length > 1 && this.isOpen(group))
  }

  /** Advances physics, openness, the camera and the highlight by `dt` seconds. */
  step(dt: number) {
    if (this.alpha > 0.004 || this.alphaTarget > 0) {
      this.tick()
      this.alpha += (this.alphaTarget - this.alpha) * 0.0228
    }
    this.updateGroups()
    this.separateGroups(this.reducedMotion ? 1 : 0.35)
    if (this.pendingFit && this.alpha < 0.08) {
      if (this.respaced) {
        this.pendingFit = false
        this.fit()
      } else {
        this.respaced = true
        layoutAnchors(this.groups, this.weights, (g) => g.extent + HALO_PAD)
        this.alpha = 0.5
      }
    }
    const fade = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 9)
    for (const group of this.groups) group.t += ((this.isOpen(group) ? 1 : 0) - group.t) * fade
    if (this.target) {
      const glide = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 8)
      const { x, y, k } = this.target
      this.view = { x: lerp(this.view.x, x, glide), y: lerp(this.view.y, y, glide), k: lerp(this.view.k, k, glide) }
      if (Math.abs(this.view.k - k) < 0.001 && Math.abs(this.view.x - x) < 0.5 && Math.abs(this.view.y - y) < 0.5) {
        this.view = this.target
        this.target = null
      }
    }
    const focus = this.focus()
    this.focusAmount += ((focus ? 1 : 0) - this.focusAmount) * (this.reducedMotion ? 1 : 1 - Math.exp(-dt * 12))
    if (focus) this.lastFocus = focus
  }

  /* ── Geometry ── */

  private display(node: SimNode) {
    const group = node.group
    const m = lerp(MINI, 1, ease(group.t))
    return { x: group.cx + (node.x - group.cx) * m, y: group.cy + (node.y - group.cy) * m }
  }

  private haloRadius(group: SimGroup, t = group.t) {
    return lerp(group.extent * MINI + 14, group.extent + HALO_PAD, ease(t))
  }

  private nodeRadius(node: SimNode) {
    return Math.max(1.4, node.r * this.view.k * lerp(0.45, 1, ease(node.group.t)))
  }

  toScreen(x: number, y: number) {
    return { x: x * this.view.k + this.view.x, y: y * this.view.k + this.view.y }
  }

  toWorld(x: number, y: number) {
    return { x: (x - this.view.x) / this.view.k, y: (y - this.view.y) / this.view.k }
  }

  /** Where the tooltip for the hovered thing anchors, in screen pixels. */
  anchorOf(hit: Hit) {
    if (hit.type === 'node') {
      const node = this.byId.get(hit.id)
      if (!node) return null
      const p = this.display(node)
      const s = this.toScreen(p.x, p.y)
      return { x: s.x, y: s.y - this.nodeRadius(node) - 8 }
    }
    const group = this.groupById.get(hit.id)
    if (!group) return null
    const s = this.toScreen(group.cx, group.cy)
    return { x: s.x, y: s.y - this.haloRadius(group) * this.view.k - 8 }
  }

  hit(sx: number, sy: number): Hit | null {
    for (const group of this.groups) {
      const box = group.labelBox
      if (box && sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) return { type: 'label', id: group.id }
    }
    let best: Hit | null = null
    let bestDistance = Infinity
    for (const node of this.nodes) {
      if (node.group.t < 0.5) continue
      const p = this.display(node)
      const s = this.toScreen(p.x, p.y)
      const d = Math.hypot(s.x - sx, s.y - sy)
      if (d <= this.nodeRadius(node) + 6 && d < bestDistance) {
        best = { type: 'node', id: node.id }
        bestDistance = d
      }
    }
    if (best) return best
    let halo: Hit | null = null
    let haloRadius = Infinity
    for (const group of this.groups) {
      if (group.members.length < 2) continue
      const s = this.toScreen(group.cx, group.cy)
      const r = this.haloRadius(group) * this.view.k
      if (Math.hypot(s.x - sx, s.y - sy) > r + 4) continue
      if (group.t < 0.5) return { type: 'group', id: group.id }
      // Where open halos overlap, the smaller one is the one in front of the pointer.
      if (r < haloRadius) {
        halo = { type: 'halo', id: group.id }
        haloRadius = r
      }
    }
    return halo
  }

  /* ── Camera ── */

  zoomAt(sx: number, sy: number, factor: number, animate = false) {
    const base = this.target ?? this.view
    const k = clamp(base.k * factor, MIN_K, MAX_K)
    const next = { k, x: sx - ((sx - base.x) * k) / base.k, y: sy - ((sy - base.y) * k) / base.k }
    if (animate) this.target = next
    else {
      this.target = null
      this.view = next
    }
  }

  /** Pinch: scales `start` by `factor` so the world point under `from` ends up under `to`. */
  pinch(start: View, from: { x: number; y: number }, to: { x: number; y: number }, factor: number) {
    const k = clamp(start.k * factor, MIN_K, MAX_K)
    const wx = (from.x - start.x) / start.k
    const wy = (from.y - start.y) / start.k
    this.target = null
    this.view = { k, x: to.x - wx * k, y: to.y - wy * k }
  }

  panTo(x: number, y: number) {
    this.target = null
    this.view = { ...this.view, x, y }
  }

  /** Screen pixels on the right that the inspector covers, kept clear when centring. */
  setInsetRight(px: number) {
    this.insetRight = px
  }

  private centreOn(x: number, y: number, k: number, animate: boolean) {
    const next = { k, x: (this.size.w - this.insetRight) / 2 - x * k, y: this.size.h / 2 - y * k }
    if (animate) this.target = next
    else {
      this.target = null
      this.view = next
    }
  }

  /**
   * Zooms and centres so a world-space box fills the space the inspector leaves, inside FRAME_PAD, with room
   * above for group labels and below for node labels. `maxK` keeps small boxes from being blown up.
   */
  private frameBox(box: { minX: number; minY: number; maxX: number; maxY: number }, maxK: number, animate: boolean) {
    const width = this.size.w - this.insetRight - FRAME_PAD * 2
    const height = this.size.h - FRAME_PAD * 2 - LABEL_ROOM_TOP - LABEL_ROOM_BOTTOM
    if (width <= 0 || height <= 0) return
    const k = clamp(
      Math.min(width / Math.max(1, box.maxX - box.minX), height / Math.max(1, box.maxY - box.minY), maxK),
      MIN_K,
      MAX_K,
    )
    const sx = FRAME_PAD + width / 2
    const sy = FRAME_PAD + LABEL_ROOM_TOP + height / 2
    const next = { k, x: sx - ((box.minX + box.maxX) / 2) * k, y: sy - ((box.minY + box.maxY) / 2) * k }
    if (animate) this.target = next
    else {
      this.target = null
      this.view = next
    }
  }

  /** Frames every group at the size it will show: open unless closed by hand. */
  fit(animate = true) {
    if (!this.size.w || !this.groups.length) return
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const group of this.groups) {
      if (!group.members.length) continue
      const r = this.haloRadius(group, this.states.get(group.id) === 'closed' ? 0 : 1)
      box.minX = Math.min(box.minX, group.cx - r)
      box.maxX = Math.max(box.maxX, group.cx + r)
      box.minY = Math.min(box.minY, group.cy - r)
      box.maxY = Math.max(box.maxY, group.cy + r)
    }
    this.frameBox(box, 1.6, animate)
  }

  openGroup(id: string) {
    const group = this.groupById.get(id)
    if (!group) return
    this.states.set(id, 'open')
    const r = this.haloRadius(group, 1)
    this.frameBox({ minX: group.cx - r, minY: group.cy - r, maxX: group.cx + r, maxY: group.cy + r }, 2.2, true)
  }

  /** Opens the node's group and frames the node with everything it connects to. */
  frameNode(id: string) {
    const node = this.byId.get(id)
    if (!node) return
    if (!this.isOpen(node.group)) this.states.set(node.group.id, 'open')
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const member of [node, ...[...(this.adjacency.get(id) ?? [])].map((other) => this.byId.get(other)!)]) {
      box.minX = Math.min(box.minX, member.x - member.r)
      box.maxX = Math.max(box.maxX, member.x + member.r)
      box.minY = Math.min(box.minY, member.y - member.r)
      box.maxY = Math.max(box.maxY, member.y + member.r)
    }
    // A loner has nothing to frame, so it only centres, at a comfortable reading zoom.
    if (box.maxX - box.minX < 40 && box.maxY - box.minY < 40) {
      this.centreOn(node.x, node.y, Math.max(this.view.k, 1.4), true)
      return
    }
    this.frameBox(box, 2, true)
  }

  closeGroup(id: string) {
    this.states.set(id, 'closed')
  }

  setAll(state: GroupState) {
    for (const group of this.groups) this.states.set(group.id, state)
    this.fit()
  }

  /* ── Dragging ── */

  pin(id: string) {
    const node = this.byId.get(id)
    if (!node) return
    node.pinned = true
    this.alphaTarget = 0.25
    this.alpha = Math.max(this.alpha, 0.25)
  }

  dragTo(id: string, x: number, y: number) {
    const node = this.byId.get(id)
    if (!node) return
    node.x = x
    node.y = y
  }

  release(id: string) {
    const node = this.byId.get(id)
    if (node) node.pinned = false
    this.alphaTarget = 0
  }

  /* ── Highlight ── */

  setMatches(matches: Set<string> | null) {
    this.matches = matches
    this.matchesKey = matches ? [...matches].join(',') : ''
  }

  private focus(): Focus | null {
    const hovered = this.hover?.type === 'node' ? this.hover.id : null
    const id = this.selected ?? hovered ?? this.pointed
    const groupId = !id && (this.hover?.type === 'group' || this.hover?.type === 'label') ? this.hover.id : null
    const key = `${id ?? ''}|${groupId ?? ''}|${this.matchesKey}`
    if (key === this.focusKey) return this.cachedFocus
    this.focusKey = key
    this.cachedFocus = this.buildFocus(id && this.byId.has(id) ? id : null, groupId)
    return this.cachedFocus
  }

  private buildFocus(id: string | null, groupId: string | null): Focus | null {
    const nodes = new Set<string>()
    const edges = new Set<SimEdge>()
    if (id) {
      nodes.add(id)
      for (const other of this.adjacency.get(id) ?? []) nodes.add(other)
      for (const edge of this.edges) if (edge.a.id === id || edge.b.id === id) edges.add(edge)
    } else if (groupId) {
      const group = this.groupById.get(groupId)
      if (!group) return null
      const members = new Set(group.members.map((node) => node.id))
      for (const edge of this.edges) {
        if (members.has(edge.a.id) || members.has(edge.b.id)) {
          edges.add(edge)
          nodes.add(edge.a.id)
          nodes.add(edge.b.id)
        }
      }
      for (const member of members) nodes.add(member)
    } else if (this.matches?.size) {
      for (const match of this.matches) if (this.byId.has(match)) nodes.add(match)
      for (const edge of this.edges) if (nodes.has(edge.a.id) && nodes.has(edge.b.id)) edges.add(edge)
    } else {
      return null
    }
    const groups = new Set<string>()
    for (const node of nodes) groups.add(this.byId.get(node)!.group.id)
    const rank = new Map<string, number>()
    if (id) {
      const neighbours = [...nodes].filter((other) => other !== id).map((other) => this.byId.get(other)!)
      neighbours.sort(
        (a, b) =>
          (b.node.updatedAt ?? -Infinity) - (a.node.updatedAt ?? -Infinity) ||
          b.degree - a.degree ||
          a.node.title.localeCompare(b.node.title),
      )
      neighbours.forEach((node, index) => rank.set(node.id, index))
    }
    return { nodes, edges, groups, rank }
  }

  /* ── Drawing ── */

  /** A dot grid pinned to the world, so panning and zooming visibly move the canvas. */
  private drawGrid(ctx: CanvasRenderingContext2D) {
    const { w, h } = this.size
    const k = this.view.k
    let step = DOT_STEP * k
    while (step < MIN_DOT_PX) step *= 2
    const x0 = ((this.view.x % step) + step) % step
    const y0 = ((this.view.y % step) + step) % step
    const size = clamp(1 + 0.6 * k, 1.5, 2.2)
    ctx.beginPath()
    for (let x = x0; x < w; x += step) for (let y = y0; y < h; y += step) ctx.rect(x - size / 2, y - size / 2, size, size)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)'
    ctx.fill()
  }

  draw(ctx: CanvasRenderingContext2D, dpr: number) {
    const { w, h } = this.size
    const k = this.view.k
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    this.drawGrid(ctx)
    const focus = this.focus() ?? (this.focusAmount > 0.01 ? this.lastFocus : null)
    const fa = this.focusAmount
    const hoverGroup = this.hover && this.hover.type !== 'node' ? this.hover.id : null
    const accent = this.accent()

    /* Halos */
    for (const group of this.groups) {
      group.labelBox = null
      if (group.members.length < 2) continue
      const e = ease(group.t)
      const s = this.toScreen(group.cx, group.cy)
      const r = this.haloRadius(group) * k
      const dim = focus && !focus.groups.has(group.id) ? lerp(1, 0.3, fa) : 1
      const hot = hoverGroup === group.id
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(group.color, lerp(0.14, 0.05, e) * dim)
      ctx.fill()
      ctx.lineWidth = hot ? 1.5 : 1
      ctx.strokeStyle = withAlpha(group.color, (hot ? 0.9 : lerp(0.45, 0.28, e)) * dim)
      ctx.stroke()
    }

    /* Edges: S-curves whose direction is chosen per pair, so parallel links fan apart instead of stacking */
    ctx.lineCap = 'round'
    for (const edge of this.edges) {
      const ga = edge.a.group
      const gb = edge.b.group
      const ea = ease(ga.t)
      const eb = ease(gb.t)
      const pa = this.display(edge.a)
      const pb = this.display(edge.b)
      let ax: number, ay: number, bx: number, by: number
      let fade = 1
      if (ga === gb) {
        ;({ x: ax, y: ay } = this.toScreen(pa.x, pa.y))
        ;({ x: bx, y: by } = this.toScreen(pb.x, pb.y))
        fade = lerp(0.35, 1, ea)
      } else {
        const sa = this.toScreen(lerp(ga.cx, pa.x, ea), lerp(ga.cy, pa.y, ea))
        const sb = this.toScreen(lerp(gb.cx, pb.x, eb), lerp(gb.cy, pb.y, eb))
        const dx = sb.x - sa.x
        const dy = sb.y - sa.y
        const d = Math.hypot(dx, dy)
        if (d < 2) continue
        const ra = lerp(this.haloRadius(ga) * k, 0, ea)
        const rb = lerp(this.haloRadius(gb) * k, 0, eb)
        if (ra + rb >= d) continue
        ax = sa.x + (dx / d) * ra
        ay = sa.y + (dy / d) * ra
        bx = sb.x - (dx / d) * rb
        by = sb.y - (dy / d) * rb
      }
      const length = Math.hypot(bx - ax, by - ay)
      if (length < 1.5) continue
      const hot = focus?.edges.has(edge) ?? false
      const accented = hot && accent !== null && (edge.a.id === accent || edge.b.id === accent)
      let alpha = 0.16 * fade
      let width = clamp(0.5 + 0.45 * k, 0.6, 1.4)
      if (hot) {
        const centre = this.selected ?? (this.hover?.type === 'node' ? this.hover.id : null)
        const weight = accented ? 1 : rankWeight(focus!.rank.get(edge.a.id === centre ? edge.b.id : edge.a.id))
        const strong = accent && !accented ? 0.5 : 0.9
        alpha = lerp(alpha, lerp(0.14, strong, weight), fa)
        width += (accented ? 1.4 : 0.6 * weight) * fa
      } else if (focus) {
        alpha *= lerp(1, 0.25, fa)
      }
      // An S: the control points sit on opposite sides of the line. Every edge between the same two groups
      // bends the same way, so a bundle reads as one S rather than crossing strands, and it flattens out
      // when zoomed far out, where curves only add noise.
      const flip = (ga === gb ? edge.a.id < edge.b.id : ga.id < gb.id) ? 1 : -1
      const bend = flip * (0.1 + 0.08 * edge.seed) * length * smoothstep(0.3, 0.75, k)
      const nx = (-(by - ay) / length) * bend
      const ny = ((bx - ax) / length) * bend
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.bezierCurveTo(
        lerp(ax, bx, 0.35) + nx,
        lerp(ay, by, 0.35) + ny,
        lerp(ax, bx, 0.65) - nx,
        lerp(ay, by, 0.65) - ny,
        bx,
        by,
      )
      if (hot && fa > 0.01) {
        // Highlighted relations blend from the upstream node's colour to the downstream one's.
        const gradient = ctx.createLinearGradient(ax, ay, bx, by)
        gradient.addColorStop(0, withAlpha(ga.color, alpha))
        gradient.addColorStop(1, withAlpha(gb.color, alpha))
        ctx.strokeStyle = gradient
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
      }
      ctx.lineWidth = width
      ctx.stroke()
    }

    /* Nodes, the highlighted ones on top */
    const ordered = focus
      ? [...this.nodes.filter((node) => !focus.nodes.has(node.id)), ...this.nodes.filter((node) => focus.nodes.has(node.id))]
      : this.nodes
    for (const node of ordered) {
      const p = this.display(node)
      const s = this.toScreen(p.x, p.y)
      const r = this.nodeRadius(node)
      if (s.x < -40 || s.y < -40 || s.x > w + 40 || s.y > h + 40) continue
      const lit = focus?.nodes.has(node.id) ?? false
      const meta = KIND_META[node.node.kind]
      const color = node.group.color
      // Older neighbours stay visible and clickable, just quieter than the most recent ones.
      ctx.globalAlpha = !focus ? 1 : lit ? lerp(1, lerp(0.5, 1, rankWeight(focus.rank.get(node.id))), fa) : lerp(1, 0.14, fa)
      const isHover = this.hover?.type === 'node' && this.hover.id === node.id
      const isSelected = this.selected === node.id
      if (isHover || isSelected || this.pointed === node.id) {
        ctx.shadowColor = withAlpha(color, 0.9)
        ctx.shadowBlur = 16
      }
      traceShape(ctx, meta.shape, s.x, s.y, r)
      ctx.fillStyle = color
      ctx.fill()
      if (r > 3) {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(6, 8, 13, 0.85)'
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      if (isSelected) {
        traceShape(ctx, meta.shape, s.x, s.y, r + 4)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    /* Group labels are placed first so node labels give way to them: under a closed group, over an open one */
    type Box = { x: number; y: number; w: number; h: number }
    const taken: Box[] = []
    const overlaps = (box: Box) =>
      taken.some((t) => box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y)
    const groupLabels: { group: SimGroup; name: string; count: string; nameWidth: number; x: number; y: number; dim: number }[] = []
    for (const group of this.groups) {
      if (group.members.length < 2) continue
      const e = ease(group.t)
      const s = this.toScreen(group.cx, group.cy)
      const r = this.haloRadius(group) * k
      const name = truncate(group.label, 36)
      const count = String(group.members.length)
      ctx.font = `600 12px ${this.font}`
      const nameWidth = ctx.measureText(name).width
      ctx.font = `500 12px ${this.font}`
      const width = nameWidth + 6 + ctx.measureText(count).width
      const height = 18
      const y = e < 0.5 ? s.y + r + 8 : s.y - r - 8 - height
      const x = s.x - width / 2
      const dim = focus && !focus.groups.has(group.id) ? lerp(1, 0.35, fa) : 1
      group.labelBox = { x: x - 6, y, w: width + 12, h: height }
      taken.push(group.labelBox)
      groupLabels.push({ group, name, count, nameWidth, x, y, dim })
    }

    /* Node labels: by priority (the focus, then its most recent neighbours, then hubs), skipping any that would collide */
    const centre = this.selected ?? (this.hover?.type === 'node' ? this.hover.id : null)
    const priority = (node: SimNode) => {
      if (node.id === centre) return -1
      const rank = focus?.rank.get(node.id)
      if (rank !== undefined) return rank
      if (focus?.nodes.has(node.id)) return 500
      return 1000 - node.degree
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    for (const node of [...this.nodes].sort((a, b) => priority(a) - priority(b))) {
      const e = ease(node.group.t)
      if (e < 0.6) continue
      if (this.hover?.type === 'node' && this.hover.id === node.id) continue
      const lit = focus?.nodes.has(node.id) ?? false
      const weight = rankWeight(focus?.rank.get(node.id))
      const emphasised = lit && fa > 0.3 && weight > 0.05
      // Hubs and lone items name themselves earlier, since nothing else labels them from afar.
      const head = node.group.members.length < 2 ? 0.6 : node.degree >= 5 ? 0.35 : 0
      const zoomIn = smoothstep(1.05, 1.6, k + head)
      let alpha = (emphasised ? Math.max(zoomIn, fa * weight) : zoomIn) * smoothstep(0.6, 1, e)
      if (focus && !lit) alpha *= 1 - fa * 0.9
      if (alpha < 0.03) continue
      const p = this.display(node)
      const s = this.toScreen(p.x, p.y)
      if (s.x < -100 || s.y < -40 || s.x > w + 100 || s.y > h + 40) continue
      const r = this.nodeRadius(node)
      ctx.font = `${emphasised || this.selected === node.id ? 600 : 500} ${emphasised ? 12 : 11}px ${this.font}`
      const text = truncate(node.node.title, emphasised ? 40 : 28)
      const width = ctx.measureText(text).width
      const box = { x: s.x - width / 2 - 3, y: s.y + r + 5, w: width + 6, h: 16 }
      if (overlaps(box)) continue
      taken.push(box)
      ctx.lineWidth = 3.5
      ctx.strokeStyle = `rgba(8, 10, 16, ${0.85 * alpha})`
      ctx.strokeText(text, s.x, s.y + r + 6)
      ctx.fillStyle = `rgba(255, 255, 255, ${(emphasised ? 0.98 : 0.8) * alpha})`
      ctx.fillText(text, s.x, s.y + r + 6)
    }

    /* Group labels on top, the member count after the name in a quieter tone; click one to open or close it */
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const { group, name, count, nameWidth, x, y, dim } of groupLabels) {
      const mid = y + 9
      ctx.lineWidth = 3.5
      ctx.strokeStyle = `rgba(8, 10, 16, ${0.8 * dim})`
      ctx.font = `600 12px ${this.font}`
      ctx.strokeText(name, x, mid)
      ctx.fillStyle = `rgba(255, 255, 255, ${(hoverGroup === group.id ? 1 : 0.82) * dim})`
      ctx.fillText(name, x, mid)
      ctx.font = `500 12px ${this.font}`
      ctx.strokeText(count, x + nameWidth + 6, mid)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.62 * dim})`
      ctx.fillText(count, x + nameWidth + 6, mid)
    }
    ctx.textAlign = 'center'
  }
}
