import type { CSSProperties } from 'react'
import type { MapDataLayer } from './tomtomTypes'
import css from './TomtomStory.module.css'

/** The mark a legend row ends with, drawn the way the map draws it. */
export function TomtomLegendGlyph({ layer, color }: { layer: MapDataLayer; color: string }) {
  const style = { '--glyph': color } as CSSProperties
  switch (layer.mark) {
    case 'tower':
      return <i className={css.towerGlyph} style={{ background: color }} aria-hidden />
    case 'pin':
      return <i className={css.pinGlyph} style={style} aria-hidden />
    case 'fence':
      return <i className={css.fenceGlyph} style={style} aria-hidden />
    case 'disk':
      return <i className={css.diskGlyph} style={style} aria-hidden />
    case 'catchment':
      return <i className={`${css.diskGlyph} ${css.catchmentGlyph}`} style={style} aria-hidden />
    default:
      return <i className={css.heatGlyph} style={{ background: `${color}66` }} aria-hidden />
  }
}
