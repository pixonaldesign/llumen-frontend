import { useId, useState } from 'react'
import { ArrowsClockwise, X } from '@phosphor-icons/react'
import {
  CARD_GLOWS,
  CARD_LAYOUT_LIMITS,
  DEFAULT_CARD_GLOW,
  DEFAULT_GLOW_COLORS,
  GLOW_CATEGORIES,
  ICON_CONTAINERS,
  readDefaultGlowColors,
  cardLayout,
  saveDefaultGlowColors,
  type CardGlowConfig,
  type CardLayout,
  type GlowCategory,
} from './cardGlow'
import { CanvasBackdropSections } from './BackdropControls'
import {
  CARD_MAX_BLUR,
  CARD_PRESETS,
  DEFAULT_CANVAS_CARDS,
  GRAIN_SHIELD_BLUR,
  cardBlur,
  tintCss,
  type CanvasLook,
  type CardSurface,
  type CardFill,
  type Tint,
} from './canvasLook'
import { PopoverHost, SwitchRow } from './ConfigControls'
import { ColorField, Slider, TintField } from './PaintControls'
import controls from '../llumen-assistant/FloatingControls.module.css'
import styles from './AppearancePanel.module.css'

type CardStylePanelProps = {
  config: CardGlowConfig
  onChange: (next: CardGlowConfig) => void
  /** The canvas background, shared with the canvas background panel. */
  canvasLook: CanvasLook
  onCanvasLook: (next: CanvasLook) => void
  onClose: () => void
}

const sameColors = (a: Record<GlowCategory, string>, b: Record<GlowCategory, string>) =>
  GLOW_CATEGORIES.every(({ id }) => a[id].toLowerCase() === b[id].toLowerCase())

const CARD_FILLS: readonly { id: CardFill; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
]

const sameTint = (a: Tint, b: Tint) => a.color.toLowerCase() === b.color.toLowerCase() && Math.abs(a.opacity - b.opacity) < 0.005

type CardBackgroundProps = {
  /** The fill and border being edited: the canvas-wide one, or the one for the styles that tint the card themselves. */
  cards: CardSurface
  onCards: (next: CardSurface) => void
  onReset: () => void
  /** What the Default fill shows. */
  defaultHint: string
  /** False where the style keeps its own frame and only the fill changes. */
  border: boolean
  /** Holds the blur, which every style shares. */
  look: CanvasLook
  onLook: (next: CanvasLook) => void
}

function CardBackgroundSection({ cards, onCards, onReset, defaultHint, border, look, onLook }: CardBackgroundProps) {
  const titleId = useId()
  const { ambient } = look
  const setCards = (patch: Partial<CardSurface>) => onCards({ ...cards, ...patch })
  const minBlur = cardBlur({ ...look.cards, blur: 0 }, ambient)
  const activePreset = CARD_PRESETS.find(
    (preset) =>
      preset.cards.fill === cards.fill &&
      sameTint(preset.cards.top, cards.top) &&
      (cards.fill === 'solid' || sameTint(preset.cards.bottom, cards.bottom)) &&
      (!border || sameTint(preset.cards.border, cards.border)),
  )?.id

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          Card background
        </h3>
        <button type="button" className={styles.applyTrigger} onClick={onReset}>
          Reset card background
        </button>
      </div>
      <div className={styles.dotSwatches} role="radiogroup" aria-label="Card presets">
        {CARD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={activePreset === preset.id}
            aria-label={preset.name}
            data-tooltip={preset.name}
            className={styles.dotSwatch}
            style={{
              background: `linear-gradient(${tintCss(preset.cards.top)}, ${tintCss(preset.cards.fill === 'solid' ? preset.cards.top : preset.cards.bottom)}), #20343a`,
              boxShadow: `inset 0 0 0 1px ${tintCss(preset.cards.border)}`,
            }}
            onClick={() => setCards(preset.cards)}
          />
        ))}
      </div>
      <div className={styles.segmented3} role="radiogroup" aria-label="Card fill">
        {CARD_FILLS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={cards.fill === option.id}
            className={`${styles.segmentTight}${cards.fill === option.id ? ` ${controls.segmentActive}` : ''}`}
            onClick={() => setCards({ fill: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {cards.fill !== 'default' ? (
        <>
          <div className={styles.stops}>
            {cards.fill === 'solid' ? (
              <TintField label="Fill" tint={cards.top} onChange={(top) => setCards({ top })} />
            ) : (
              <>
                <TintField label="Top" tint={cards.top} onChange={(top) => setCards({ top })} />
                <TintField label="Bottom" tint={cards.bottom} onChange={(bottom) => setCards({ bottom })} />
              </>
            )}
            {border ? <TintField label="Border" tint={cards.border} onChange={(next) => setCards({ border: next })} /> : null}
          </div>
          {border ? null : <p className={styles.hint}>Only the fill changes; the frame and the category colour stay.</p>}
          {minBlur > 0 ? (
            <p className={styles.hint}>Cards keep at least {GRAIN_SHIELD_BLUR}px of blur so grain and dither stay off them.</p>
          ) : null}
        </>
      ) : (
        <p className={styles.hint}>{defaultHint}</p>
      )}
      <Slider
        label="Background blur"
        value={cardBlur(look.cards, ambient)}
        min={minBlur}
        max={CARD_MAX_BLUR}
        format={(value) => (value === 0 ? 'Off' : `${value}px`)}
        onChange={(blur) => onLook({ ...look, cards: { ...look.cards, blur } })}
      />
      <p className={styles.hint}>Blurs the canvas behind each card; it shows where the card is see-through. Applies to every style.</p>
    </section>
  )
}

/** The active style's padding and corner radius, kept per style since each starts from its own. */
function CardLayoutSection({ config, onChange }: { config: CardGlowConfig; onChange: (next: CardGlowConfig) => void }) {
  const titleId = useId()
  const { padding, radius } = cardLayout(config)
  const changed = config.layout[config.style]
  const panels = config.style !== 'classic' && config.style !== 'sections'
  const setLayout = (patch: Partial<CardLayout>) =>
    onChange({ ...config, layout: { ...config.layout, [config.style]: { ...changed, ...patch } } })
  const reset = () =>
    onChange({ ...config, layout: Object.fromEntries(Object.entries(config.layout).filter(([style]) => style !== config.style)) })

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          Layout
        </h3>
        <button type="button" className={styles.applyTrigger} disabled={!changed} onClick={reset}>
          Reset layout
        </button>
      </div>
      <Slider
        label="Padding"
        value={padding}
        {...CARD_LAYOUT_LIMITS.padding}
        format={(value) => `${value}px`}
        onChange={(next) => setLayout({ padding: next })}
      />
      <Slider
        label="Corner radius"
        value={radius}
        {...CARD_LAYOUT_LIMITS.radius}
        format={(value) => `${value}px`}
        onChange={(next) => setLayout({ radius: next })}
      />
      <p className={styles.hint}>
        {panels
          ? 'Padding sits inside the black panels; their corners follow the card’s radius. '
          : 'Padding sits between the card’s edge and its content. '}
        A node’s own appearance still wins.
      </p>
    </section>
  )
}

export function CardStylePanel({ config, onChange, canvasLook, onCanvasLook, onClose }: CardStylePanelProps) {
  const colorsTitleId = useId()
  const nodeTitleId = useId()
  const active = CARD_GLOWS.find((option) => option.id === config.style) ?? CARD_GLOWS[0]
  const [defaultColors, setDefaultColors] = useState(readDefaultGlowColors)
  const saveDefaultColors = (colors: Record<GlowCategory, string> | null) => {
    saveDefaultGlowColors(colors)
    setDefaultColors(colors ?? DEFAULT_GLOW_COLORS)
  }

  return (
    <aside className={styles.panel} aria-label="Card style">
      <PopoverHost>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.title}>Card style</h2>
            <p className={styles.subtitle}>Applies to minimal cards on the canvas</p>
          </div>
          <button type="button" className={styles.iconAction} aria-label="Close card style" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <div className={styles.scroll} data-native-scroll>
          <section className={styles.section}>
            <div className={styles.segmentedAuto} role="radiogroup" aria-label="Card style">
              {CARD_GLOWS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={config.style === option.id}
                  className={`${styles.segmentTight}${config.style === option.id ? ` ${controls.segmentActive}` : ''}`}
                  onClick={() => onChange({ ...config, style: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className={styles.hint}>{active.description}</p>
          </section>

          {active.nodeOptions ? (
            <section className={styles.section} aria-labelledby={nodeTitleId}>
              <h3 id={nodeTitleId} className={styles.sectionTitle}>
                Node
              </h3>
              <div className={styles.rowHead}>
                <span>Icon container</span>
              </div>
              <div className={styles.segmented3} role="radiogroup" aria-label="Icon container">
                {ICON_CONTAINERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={config.iconContainer === option.id}
                    className={`${styles.segmentTight}${config.iconContainer === option.id ? ` ${controls.segmentActive}` : ''}`}
                    onClick={() => onChange({ ...config, iconContainer: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className={styles.hint}>{ICON_CONTAINERS.find((option) => option.id === config.iconContainer)?.hint}</p>
              <SwitchRow
                label="Values panel"
                description="Values move to their own panel 4px under the node, tinted dark from the category colour, with labels in that colour."
                checked={config.valuesPanel}
                onChange={(valuesPanel) => onChange({ ...config, valuesPanel })}
              />
            </section>
          ) : null}

          {active.nodeOptions ? (
            <CardBackgroundSection
              cards={canvasLook.cards}
              onCards={(cards) => onCanvasLook({ ...canvasLook, cards: { ...canvasLook.cards, ...cards } })}
              onReset={() => onCanvasLook({ ...canvasLook, cards: DEFAULT_CANVAS_CARDS })}
              defaultHint="Each node style's own dark card. Pick Solid or Gradient, or a preset, to set the colours."
              border
              look={canvasLook}
              onLook={onCanvasLook}
            />
          ) : (
            <CardBackgroundSection
              cards={config.surface}
              onCards={(surface) => onChange({ ...config, surface })}
              onReset={() => onChange({ ...config, surface: DEFAULT_CARD_GLOW.surface })}
              defaultHint="The style's own card, tinted from the category colour. Pick Solid or Gradient, or a preset, to set the colours. Shared by Styles 2 to 5."
              border={false}
              look={canvasLook}
              onLook={onCanvasLook}
            />
          )}

          <CardLayoutSection config={config} onChange={onChange} />

          <CanvasBackdropSections look={canvasLook} onChange={onCanvasLook} />

          <section className={styles.section} aria-labelledby={colorsTitleId}>
            <div className={styles.sectionHead}>
              <h3 id={colorsTitleId} className={styles.sectionTitle}>
                Category colours
              </h3>
              <div className={styles.rowTools}>
                <button
                  type="button"
                  className={styles.applyTrigger}
                  disabled={sameColors(config.colors, defaultColors)}
                  onClick={() => saveDefaultColors(config.colors)}
                >
                  Save as default
                </button>
                <button
                  type="button"
                  className={styles.applyTrigger}
                  disabled={sameColors(config.colors, defaultColors)}
                  onClick={() => onChange({ ...config, colors: defaultColors })}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className={styles.stops}>
              {GLOW_CATEGORIES.map((category) => (
                <ColorField
                  key={category.id}
                  label={category.label}
                  color={config.colors[category.id]}
                  onChange={(color) => onChange({ ...config, colors: { ...config.colors, [category.id]: color } })}
                />
              ))}
            </div>
            <p className={styles.hint}>
              Each category’s colour everywhere: card glow, icons, toolbar, node library, and configure window. Very dark
              colours are lifted a little for icons so they stay legible.
            </p>
            {sameColors(defaultColors, DEFAULT_GLOW_COLORS) ? null : (
              <div className={styles.rowHead}>
                <span className={styles.hint}>Reset goes back to your saved colours.</span>
                <button type="button" className={styles.textAction} onClick={() => saveDefaultColors(null)}>
                  Clear saved
                </button>
              </div>
            )}
          </section>
        </div>

        <footer className={styles.foot}>
          <div className={styles.footRow}>
            <button
              type="button"
              className={`${styles.footButton} ${styles.footButtonPrimary}`}
              onClick={() => onChange({ ...DEFAULT_CARD_GLOW, colors: defaultColors, style: config.style })}
            >
              <ArrowsClockwise size={14} weight="bold" aria-hidden />
              Reset card style
            </button>
          </div>
        </footer>
      </PopoverHost>
    </aside>
  )
}
