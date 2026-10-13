import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpRight,
  CaretUp,
  Check,
  Circle,
  LineSegment,
  MapPin,
  MapPinArea,
  Polygon,
  Rectangle,
  TextT,
  type Icon,
} from '@phosphor-icons/react'
import composer from '../compact-assistant.module.css'
import styles from './StoryAnnotationMenu.module.css'
import { MAP_ANNOTATION_SCENARIOS, type MapAnnotationType } from './storyMapAnnotationScenarios'

const ICONS: Record<MapAnnotationType, Icon> = {
  marker: MapPin,
  text: TextT,
  line: LineSegment,
  arrow: ArrowUpRight,
  polygon: Polygon,
  rectangle: Rectangle,
  circle: Circle,
}

/** Gap between the trigger and the menu opening above it. */
const MENU_GAP_PX = 8

export type StoryAnnotationMenuProps = {
  value: MapAnnotationType | null
  /** Picking the selected type again clears it. */
  onChange: (next: MapAnnotationType | null) => void
  disabled?: boolean
}

/** Rail composer dropdown: picks the map annotation type whose scenario prompt the composer types. */
export function StoryAnnotationMenu({ value, onChange, disabled = false }: StoryAnnotationMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null)
  const open = position !== null
  const current = MAP_ANNOTATION_SCENARIOS.find((scenario) => scenario.type === value) ?? null
  const TriggerIcon = current ? ICONS[current.type] : MapPinArea

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setPosition(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPosition(null)
    }
    const close = () => setPosition(null)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => {
    if (open) {
      setPosition(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ left: rect.left, bottom: window.innerHeight - rect.top + MENU_GAP_PX })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${composer.composerLabelAction}${open ? ` ${composer.composerLabelActionActive}` : ''}${
          current ? ` ${styles.triggerSelected}` : ''
        }`}
        aria-label={current ? `Map annotation: ${current.label}` : 'Map annotation'}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <TriggerIcon size={16} weight="regular" aria-hidden />
        {current ? current.label : 'Annotate'}
        <CaretUp className={`${styles.caret}${open ? ` ${styles.caretOpen}` : ''}`} size={10} weight="bold" aria-hidden />
      </button>
      {position
        ? createPortal(
            <div
              ref={menuRef}
              className={`${composer.inlineContextMenu} ${styles.menu}`}
              style={{ left: position.left, bottom: position.bottom }}
              role="listbox"
              aria-label="Map annotation type"
            >
              <p className={composer.inlineContextMenuSection}>Map annotation</p>
              {MAP_ANNOTATION_SCENARIOS.map((scenario) => {
                const ItemIcon = ICONS[scenario.type]
                const selected = scenario.type === value
                return (
                  <button
                    key={scenario.type}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${composer.inlineContextMenuItem}${selected ? ` ${composer.inlineContextMenuItemActive}` : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(selected ? null : scenario.type)
                      setPosition(null)
                    }}
                  >
                    <ItemIcon className={composer.inlineContextMenuIcon} size={16} weight="regular" aria-hidden />
                    <span className={composer.inlineContextMenuItemText}>
                      <span className={composer.inlineContextMenuItemLabel}>{scenario.label}</span>
                      <span className={composer.inlineContextMenuItemDesc}>{scenario.description}</span>
                    </span>
                    {selected ? <Check className={styles.check} size={14} weight="bold" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
