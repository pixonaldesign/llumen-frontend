import type { MapDataLayer } from './estateTypes'
import css from './EstateStory.module.css'

/** The mark a legend row ends with, drawn the way the map draws the layer. */
export function EstateLegendGlyph({ mark, color }: { mark: MapDataLayer['mark']; color: string }) {
  if (mark === 'tower') return <i className={css.towerGlyph} style={{ background: color }} aria-hidden />
  if (mark === 'area')
    return (
      <i
        className={css.areaGlyph}
        style={{ borderColor: color, background: `color-mix(in srgb, ${color} 30%, transparent)` }}
        aria-hidden
      />
    )
  if (mark === 'line') return <i className={css.lineGlyph} style={{ background: color }} aria-hidden />
  if (mark === 'point') return <i className={css.pointGlyph} style={{ background: color }} aria-hidden />
  return <i className={css.heatGlyph} style={{ background: `${color}66` }} aria-hidden />
}
