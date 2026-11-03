/**
 * A critical part's deep dive: the part in 3D (or in the UAV that carries it), its specs, stock
 * burn-down, programme exposure and the Turkish bridge supplier.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, X } from '@phosphor-icons/react'
import { Gami3DModel } from './Gami3DModel'
import { GamiCardView } from './GamiCharts'
import { GAMI_PARTS } from './gamiScenario'
import { TONE, type PartId } from './gamiTypes'
import css from './GamiPartModal.module.css'

type Props = {
  part: PartId
  onClose: () => void
  /** Opens the story's Türkiye page. */
  onBridge?: () => void
}

export function GamiPartModal({ part: id, onClose, onBridge }: Props) {
  const part = GAMI_PARTS[id]
  const [view, setView] = useState<'part' | 'aircraft'>('part')
  const accent = TONE[part.tone]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const weeks = part.stock.map((_, index) => (index === 0 ? 'Today' : `W${index * 2}`))

  return createPortal(
    <div className={css.backdrop} onClick={onClose}>
      <div
        className={css.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={part.name}
        style={{ '--accent': accent } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <section className={css.stage}>
          <div className={css.stageHead}>
            <span className={css.badge}>Critical · {part.stockDays} days of stock</span>
            <div className={css.toggle} role="group" aria-label="Model view">
              {(['part', 'aircraft'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={view === option ? css.toggleActive : undefined}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {option === 'part' ? 'Part' : 'In the UAV'}
                </button>
              ))}
            </div>
          </div>
          <Gami3DModel
            key={view}
            model={view === 'part' ? part.id : 'drone'}
            highlight={view === 'aircraft' ? part.id : undefined}
            accent={accent}
            spin={0.35}
            interactive
            distance={view === 'part' ? 1.05 : 0.72}
            className={css.model}
          />
          <p className={css.hint}>Drag to turn</p>
          <dl className={css.specs}>
            {part.specs.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={css.info}>
          <header className={css.infoHead}>
            <div>
              <p className={css.eyebrow}>Critical import · Poland</p>
              <h2 className={css.title}>{part.name}</h2>
              <p className={css.sub}>
                {part.supplier} · {part.city} · {part.monthlyNeed}
              </p>
            </div>
            <button type="button" className={css.close} aria-label="Close" onClick={onClose}>
              <X size={18} weight="bold" aria-hidden />
            </button>
          </header>

          <div className={css.grid}>
            <GamiCardView
              card={{
                id: `${id}-stock`,
                kind: 'line',
                title: 'Stock Burn-down GAMI',
                x: weeks,
                yMax: 60,
                ySuffix: ' d',
                series: [{ name: 'Days of stock', tone: 'red', points: part.stock }],
                footer: `Exports suspended; stock runs out in ${part.stockDays} days at current build rate.`,
              }}
            />
            <GamiCardView
              card={{
                id: `${id}-exposure`,
                kind: 'hbars',
                title: 'Programme Exposure GAMI',
                bars: part.exposure.map((row) => ({ ...row, tone: 'red' as const })),
                footer: `2027 deliveries that depend on the ${part.short.toLowerCase()}.`,
              }}
            />
          </div>

          <div className={css.alternative}>
            <div className={css.altHead}>
              <span className={css.altTag}>Recommended bridge</span>
              <h3>{part.alternative.supplier}</h3>
              <p>{part.alternative.city}, Türkiye</p>
            </div>
            <dl className={css.altStats}>
              <div>
                <dt>Capacity</dt>
                <dd>{part.alternative.capacity}</dd>
              </div>
              <div>
                <dt>Lead time</dt>
                <dd>{part.alternative.leadTime}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{part.alternative.cost}</dd>
              </div>
            </dl>
            {onBridge ? (
              <button type="button" className={css.altBtn} onClick={onBridge}>
                View bridge plan
                <ArrowRight size={16} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}
