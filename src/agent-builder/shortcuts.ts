const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

const MOD = IS_MAC ? '⌘' : 'Ctrl+'
const SHIFT = IS_MAC ? '⇧' : 'Shift+'
const ALT = IS_MAC ? '⌥' : 'Alt+'

/** Shortcut labels shown in tooltips, in the platform's notation. */
export const SHORTCUTS = {
  sticky: 'S',
  comment: 'C',
  text: 'T',
  section: `${SHIFT}S`,
  undo: `${MOD}Z`,
  redo: `${SHIFT}${MOD}Z`,
  zoomIn: `${MOD}+`,
  zoomOut: `${MOD}−`,
  fit: `${SHIFT}1`,
  tidy: `${SHIFT}${ALT}T`,
  delete: IS_MAC ? '⌫' : 'Delete',
}
