import {
  NODE_CATEGORIES,
  NODE_DEFAULT_WIDTH,
  NODE_TYPES_BY_ID,
  nodeOutputs,
  type CanvasNode,
  type Point,
  type Size,
  type WorkflowEdge,
} from './nodeCatalog'
import type { CanvasGroupLabel } from './showcase'

/** Measured card size plus port centres relative to the card's top-left, keyed `side:portId`. */
export type MeasuredNode = Size & { ports: Record<string, Point> }

const COLUMN_GAP = 140
const ROW_GAP = 48
const BLOCK_GAP = 160
const GRID_COLUMN_GAP = 120
const GRID_ROWS = 7
const LABEL_OFFSET = 40
const ORDER_SWEEPS = 4
const FALLBACK: MeasuredNode = { w: NODE_DEFAULT_WIDTH, h: 120, ports: {} }

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Tidies the canvas. Each connected flow becomes a left-to-right layered layout: a node sits one
 * column after its furthest upstream node, rows are ordered by their neighbours to cut crossings
 * (branch outputs keep their True/False order), and nodes are nudged level with the port that
 * feeds them so edges run straight. Unconnected nodes go below, in one column per category.
 * The result keeps the old bounding-box centre so the canvas doesn't jump.
 */
export function autoLayout(
  nodes: readonly CanvasNode[],
  edges: readonly WorkflowEdge[],
  measured: Readonly<Record<string, MeasuredNode>>,
  current: Readonly<Record<string, Point>>,
) {
  const size = (id: string) => measured[id] ?? FALLBACK
  const ids = new Set(nodes.map((node) => node.id))
  const links = edges.filter((edge) => edge.from !== edge.to && ids.has(edge.from) && ids.has(edge.to))
  const outPortY = (edge: WorkflowEdge) => size(edge.from).ports[`out:${edge.fromPort}`]?.y ?? size(edge.from).h / 2
  const inPortY = (edge: WorkflowEdge) => size(edge.to).ports[`in:${edge.toPort}`]?.y ?? size(edge.to).h / 2
  const outPortIndex = (edge: WorkflowEdge) => {
    const node = nodes.find((candidate) => candidate.id === edge.from)
    if (!node) return 0
    const outputs = nodeOutputs(node, NODE_TYPES_BY_ID[node.type])
    return Math.max(0, outputs.findIndex((port) => port.id === edge.fromPort)) / Math.max(1, outputs.length)
  }
  const byY = (a: string, b: string) => (current[a]?.y ?? 0) - (current[b]?.y ?? 0) || (current[a]?.x ?? 0) - (current[b]?.x ?? 0)

  // Connected components, via union-find.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const up = parent.get(id) ?? id
    if (up === id) return id
    const root = find(up)
    parent.set(id, root)
    return root
  }
  for (const edge of links) parent.set(find(edge.from), find(edge.to))
  const linked = nodes.map((node) => node.id).filter((id) => links.some((edge) => edge.from === id || edge.to === id))
  const components = new Map<string, string[]>()
  for (const id of linked) components.set(find(id), [...(components.get(find(id)) ?? []), id])
  const blocks = [...components.values()].sort((a, b) => byY([...a].sort(byY)[0], [...b].sort(byY)[0]))

  const positions: Record<string, Point> = {}
  let blockTop = 0

  for (const members of blocks) {
    const memberSet = new Set(members)
    const local = links.filter((edge) => memberSet.has(edge.from))

    // Drop back edges (cycles) with a DFS from the sources, then rank by longest path.
    const forward: WorkflowEdge[] = []
    const state = new Map<string, 'open' | 'done'>()
    const visit = (id: string) => {
      state.set(id, 'open')
      for (const edge of local.filter((candidate) => candidate.from === id)) {
        const seen = state.get(edge.to)
        if (seen === 'open') continue
        forward.push(edge)
        if (!seen) visit(edge.to)
      }
      state.set(id, 'done')
    }
    const sources = members.filter((id) => !local.some((edge) => edge.to === id)).sort(byY)
    for (const id of [...sources, ...[...members].sort(byY)]) if (!state.has(id)) visit(id)

    const rank = new Map(members.map((id) => [id, 0]))
    for (let changed = true, guard = 0; changed && guard < members.length; guard += 1) {
      changed = false
      for (const edge of forward) {
        const next = (rank.get(edge.from) ?? 0) + 1
        if (next > (rank.get(edge.to) ?? 0)) {
          rank.set(edge.to, next)
          changed = true
        }
      }
    }
    const layerCount = Math.max(...rank.values()) + 1
    const layers: string[][] = Array.from({ length: layerCount }, () => [])
    for (const id of [...members].sort(byY)) layers[rank.get(id) ?? 0].push(id)

    // Barycentre ordering, sweeping down then up a few times.
    const order = new Map<string, number>()
    const reindex = (layer: readonly string[]) => layer.forEach((id, index) => order.set(id, index))
    layers.forEach(reindex)
    const sortLayer = (layer: string[], key: (id: string) => number | null) => {
      const keys = new Map(layer.map((id) => [id, key(id) ?? order.get(id) ?? 0]))
      layer.sort((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0))
      reindex(layer)
    }
    for (let sweep = 0; sweep < ORDER_SWEEPS; sweep += 1) {
      const down = sweep % 2 === 0
      const sequence = down ? layers.slice(1) : layers.slice(0, -1).reverse()
      for (const layer of sequence) {
        sortLayer(layer, (id) => {
          const neighbours = down
            ? forward.filter((edge) => edge.to === id).map((edge) => (order.get(edge.from) ?? 0) + outPortIndex(edge))
            : forward.filter((edge) => edge.from === id).map((edge) => (order.get(edge.to) ?? 0) - outPortIndex(edge))
          return neighbours.length ? mean(neighbours) : null
        })
      }
    }

    // Columns.
    const columnX: number[] = []
    let x = 0
    for (const layer of layers) {
      columnX.push(x)
      x += Math.max(...layer.map((id) => size(id).w)) + COLUMN_GAP
    }

    // Rows: stack each layer, pulling nodes level with the ports that feed them.
    const y = new Map<string, number>()
    const placeLayer = (layer: readonly string[], desired: (id: string) => number | null) => {
      let cursor = -Infinity
      const wanted: number[] = []
      const actual: number[] = []
      for (const id of layer) {
        const target = desired(id)
        const top = Math.max(target ?? cursor, cursor)
        y.set(id, top === -Infinity ? 0 : top)
        if (target !== null) {
          wanted.push(target)
          actual.push(y.get(id) ?? 0)
        }
        cursor = (y.get(id) ?? 0) + size(id).h + ROW_GAP
      }
      // Overlap pushes nodes down; shift the layer back so it centres on what it wanted.
      const shift = wanted.length ? mean(wanted.map((value, index) => value - actual[index])) : 0
      for (const id of layer) y.set(id, (y.get(id) ?? 0) + shift)
    }
    const fromUpstream = (id: string) => {
      const incoming = forward.filter((edge) => edge.to === id && y.has(edge.from))
      return incoming.length ? mean(incoming.map((edge) => (y.get(edge.from) ?? 0) + outPortY(edge) - inPortY(edge))) : null
    }
    const fromDownstream = (id: string) => {
      const outgoing = forward.filter((edge) => edge.from === id && y.has(edge.to))
      return outgoing.length ? mean(outgoing.map((edge) => (y.get(edge.to) ?? 0) + inPortY(edge) - outPortY(edge))) : null
    }
    placeLayer(layers[0], () => null)
    for (const layer of layers.slice(1)) placeLayer(layer, fromUpstream)
    // Re-seat the sources against what they feed, now that downstream rows are known.
    if (layers.length > 1) placeLayer(layers[0], fromDownstream)

    const top = Math.min(...members.map((id) => y.get(id) ?? 0))
    const bottom = Math.max(...members.map((id) => (y.get(id) ?? 0) + size(id).h))
    for (const id of members) positions[id] = { x: columnX[rank.get(id) ?? 0], y: blockTop + (y.get(id) ?? 0) - top }
    blockTop += bottom - top + BLOCK_GAP
  }

  // Everything without edges: one column per category, wrapping tall categories.
  const groups: CanvasGroupLabel[] = []
  const loose = nodes.filter((node) => !linked.includes(node.id))
  if (loose.length) {
    const gridTop = blocks.length ? blockTop + LABEL_OFFSET : 0
    let x = 0
    for (const category of NODE_CATEGORIES) {
      const column = loose
        .filter((node) => NODE_TYPES_BY_ID[node.type].category === category.id)
        .map((node) => node.id)
        .sort(byY)
      for (let start = 0; start < column.length; start += GRID_ROWS) {
        const slice = column.slice(start, start + GRID_ROWS)
        if (start === 0) groups.push({ id: category.id, title: category.title, position: { x, y: gridTop - LABEL_OFFSET } })
        let rowY = gridTop
        for (const id of slice) {
          positions[id] = { x, y: rowY }
          rowY += size(id).h + ROW_GAP
        }
        x += Math.max(...slice.map((id) => size(id).w)) + GRID_COLUMN_GAP
      }
    }
  }

  // Keep the arrangement centred where the old one was.
  const bounds = (place: (id: string) => Point | undefined) => {
    const boxes = nodes.flatMap((node) => {
      const point = place(node.id)
      return point ? [{ ...point, w: size(node.id).w, h: size(node.id).h }] : []
    })
    return {
      x: (Math.min(...boxes.map((box) => box.x)) + Math.max(...boxes.map((box) => box.x + box.w))) / 2,
      y: (Math.min(...boxes.map((box) => box.y)) + Math.max(...boxes.map((box) => box.y + box.h))) / 2,
    }
  }
  if (nodes.length) {
    const before = bounds((id) => current[id])
    const after = bounds((id) => positions[id])
    const dx = Math.round(before.x - after.x)
    const dy = Math.round(before.y - after.y)
    for (const id of Object.keys(positions)) positions[id] = { x: Math.round(positions[id].x + dx), y: Math.round(positions[id].y + dy) }
    for (const group of groups) group.position = { x: Math.round(group.position.x + dx), y: Math.round(group.position.y + dy) }
  }

  return { positions, groups }
}
