/** The story builder's grid layout cell and gap (StoryView GRID_CELL_SIZE, GRID_CELL_GAP). */
export const BOARD_CELL = 184
export const BOARD_GAP = 12

/** How many whole cells fit across `width`; the extra pixel keeps an exact fit from rounding down. */
export function boardColumnsFor(width: number) {
  return Math.max(1, Math.floor((width + BOARD_GAP + 1) / (BOARD_CELL + BOARD_GAP)))
}

/** How a card may sit on the board: its preferred width in cells, how far it may shrink or grow, and its height. */
export type BoardFit = { id: string; cols: number; min: number; max: number; rows: number }

/** A card's place on the board, in zero-based cells. */
export type BoardSlot = { col: number; row: number; cols: number; rows: number }

/**
 * Packs cards onto `columns` cells without leaving holes. Each next free cell (reading order) takes the
 * first card in `items` order that fits there, flexed between its min and max width; a card stretches
 * when the cells it would leave beside it are too narrow for anything still to come. Cells nothing can
 * take are absorbed by a neighbouring card, within its max first and past it only when nothing else will.
 */
export function packBoard(items: readonly BoardFit[], columns: number) {
  /** `undefined` is untouched, `null` a hole, otherwise the card's id. */
  const grid: (string | null | undefined)[][] = []
  const cell = (row: number, col: number) => grid[row]?.[col]
  const set = (row: number, col: number, id: string | null) => {
    grid[row] ??= Array.from({ length: columns }, () => undefined)
    grid[row][col] = id
  }
  const open = (row: number, col: number, rows: number) => {
    for (let r = row; r < row + rows; r += 1) if (cell(r, col) !== undefined) return false
    return true
  }
  const runAt = (row: number, col: number, rows: number) => {
    let width = 0
    while (col + width < columns && open(row, col + width, rows)) width += 1
    return width
  }

  const fits = new Map<string, BoardFit>()
  const pending = items.map((item) => {
    const max = Math.min(item.max, columns)
    const min = Math.min(item.min, max)
    const fit = { ...item, min, max, cols: Math.min(Math.max(item.cols, min), max) }
    fits.set(item.id, fit)
    return fit
  })
  const slots = new Map<string, BoardSlot>()
  let row = 0
  let col = 0
  while (pending.length) {
    while (cell(row, col) !== undefined) {
      col += 1
      if (col >= columns) {
        col = 0
        row += 1
      }
    }
    const index = pending.findIndex((item) => runAt(row, col, item.rows) >= item.min)
    if (index < 0) {
      set(row, col, null)
      continue
    }
    const [item] = pending.splice(index, 1)
    const width = runAt(row, col, item.rows)
    let cols = Math.min(item.cols, width)
    const left = width - cols
    if (left > 0 && width <= item.max && !pending.some((other) => other.min <= left)) cols = width
    slots.set(item.id, { col, row, cols, rows: item.rows })
    for (let r = row; r < row + item.rows; r += 1) for (let c = col; c < col + cols; c += 1) set(r, c, item.id)
  }

  const rows = Math.max(0, ...[...slots.values()].map((slot) => slot.row + slot.rows))
  const hole = (r: number, c: number) => !cell(r, c)
  const claim = (id: string, slot: BoardSlot) => {
    for (let r = slot.row; r < slot.row + slot.rows; r += 1)
      for (let c = slot.col; c < slot.col + slot.cols; c += 1) set(r, c, id)
  }
  /**
   * Grows a card next to a hole into it, if the whole edge it gains is empty: the one that takes the most
   * holes at once, so a run of holes goes to one card rather than stretching another past all reason.
   */
  const absorb = (r: number, c: number, bounded: boolean) => {
    const tries: [string | null | undefined, (slot: BoardSlot, fit: BoardFit) => BoardSlot | null][] = [
      [
        cell(r, c - 1),
        (slot, fit) => {
          if (slot.col + slot.cols !== c || (bounded && slot.cols >= fit.max)) return null
          for (let y = slot.row; y < slot.row + slot.rows; y += 1) if (!hole(y, c)) return null
          return { ...slot, cols: slot.cols + 1 }
        },
      ],
      [
        cell(r - 1, c),
        (slot, fit) => {
          if (slot.row + slot.rows !== r || (bounded && slot.rows > fit.rows)) return null
          for (let x = slot.col; x < slot.col + slot.cols; x += 1) if (!hole(r, x)) return null
          return { ...slot, rows: slot.rows + 1 }
        },
      ],
      [
        cell(r, c + 1),
        (slot, fit) => {
          if (slot.col !== c + 1 || (bounded && slot.cols >= fit.max)) return null
          for (let y = slot.row; y < slot.row + slot.rows; y += 1) if (!hole(y, c)) return null
          return { ...slot, col: c, cols: slot.cols + 1 }
        },
      ],
      [
        cell(r + 1, c),
        (slot, fit) => {
          if (slot.row !== r + 1 || (bounded && slot.rows > fit.rows)) return null
          for (let x = slot.col; x < slot.col + slot.cols; x += 1) if (!hole(r, x)) return null
          return { ...slot, row: r, rows: slot.rows + 1 }
        },
      ],
    ]
    let best: { id: string; slot: BoardSlot; gain: number } | null = null
    for (const [id, grow] of tries) {
      const slot = id ? slots.get(id) : undefined
      const fit = id ? fits.get(id) : undefined
      if (!id || !slot || !fit) continue
      const next = grow(slot, fit)
      if (!next) continue
      const gain = next.cols * next.rows - slot.cols * slot.rows
      if (!best || gain > best.gain) best = { id, slot: next, gain }
    }
    if (!best) return false
    slots.set(best.id, best.slot)
    claim(best.id, best.slot)
    return true
  }
  for (const bounded of [true, false]) {
    let changed = true
    while (changed) {
      changed = false
      for (let r = 0; r < rows; r += 1)
        for (let c = 0; c < columns; c += 1) if (hole(r, c) && absorb(r, c, bounded)) changed = true
    }
  }

  return { slots, rows }
}
