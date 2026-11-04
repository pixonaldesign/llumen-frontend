/**
 * A critical part's details, in the story's modal: the part in 3D (or in the UAV that carries it) with
 * its specs, then story cards for its stock, deliveries and programme exposure, and the bridge supplier
 * with its switch plan.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import edit from '../story/StoryEditPanel.module.css'
import styles from '../story/StoryView.module.css'
import { Gami3DModel } from './Gami3DModel'
import { GamiCardBody } from './GamiCharts'
import { GAMI_PARTS } from './gamiScenario'
import { PALETTE, STATUS, type GamiCard, type PartId } from './gamiTypes'
import cards from './GamiCards.module.css'
import css from './GamiPartModal.module.css'

type Props = {
  part: PartId
  onClose: () => void
  /** Opens the story's Türkiye page. */
  onBridge?: () => void
}

const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

export function GamiPartModal({ part: id, onClose, onBridge }: Props) {
  const part = GAMI_PARTS[id]
  const [view, setView] = useState<'part' | 'aircraft'>('part')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const usual = Math.round(part.deliveries.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4)
  const panels: GamiCard[] = [
    {
      id: 'glance',
      kind: 'kpis',
      title: 'At a Glance',
      tiles: [
        { label: 'Stock left', value: String(part.stockDays), unit: 'days' },
        { label: 'Monthly need', value: part.monthlyNeed.split(' ')[0] },
        { label: 'From Poland', value: '100', unit: '%' },
      ],
    },
    {
      id: 'stock',
      kind: 'line',
      title: 'Stock Burn-down',
      kpi: { value: String(part.stockDays), unit: 'days left' },
      x: part.stock.map((_, index) => (index === 0 ? 'Today' : `W${index * 2}`)),
      yLabels: ['60 d', '30 d', '0'],
      yMax: 60,
      series: [{ name: 'Days of stock', points: part.stock, status: 'critical' }],
    },
    {
      id: 'deliveries',
      kind: 'vbars',
      title: 'Monthly Deliveries from Poland',
      kpi: { value: part.deliveries[part.deliveries.length - 1].toLocaleString('en-US'), unit: `of ${usual.toLocaleString('en-US')} usual` },
      bars: part.deliveries.map((value, index) => ({
        label: MONTHS[index],
        value,
        display: value.toLocaleString('en-US'),
        status: value < usual * 0.5 ? 'critical' : undefined,
      })),
    },
    {
      id: 'exposure',
      kind: 'hbars',
      title: '2027 Deliveries at Risk',
      bars: part.exposure,
    },
  ]

  return createPortal(
    <div className={edit.modalRoot}>
      <button type="button" className={edit.modalBackdrop} aria-label="Close part details" onClick={onClose} />
      <div
        className={`${edit.panel} ${edit.modal} ${css.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gami-part-title"
        dir="ltr"
      >
        <header className={edit.header}>
          <div className={edit.headerIdentity}>
            <div className={edit.headerCopy}>
              <h2 id="gami-part-title" className={edit.title}>
                {part.name}
              </h2>
              <p className={css.sub}>
                {part.supplier} · {part.city} · Used in {part.programmes.join(', ')}
              </p>
            </div>
          </div>
          <div className={edit.headerActions}>
            <button type="button" className={edit.closeBtn} onClick={onClose} aria-label="Close part details">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={css.body}>
          <section className={css.stage} aria-label="3D model">
            <div className={`${edit.segmentedControl} ${css.toggle}`} role="group" aria-label="Model view">
              {(['part', 'aircraft'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`${edit.segmentedBtn}${view === option ? ` ${edit.segmentedBtnActive}` : ''}`}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {option === 'part' ? 'Part' : 'In the UAV'}
                </button>
              ))}
            </div>
            <Gami3DModel
              key={view}
              model={view === 'part' ? part.id : 'drone'}
              highlight={view === 'aircraft' ? part.id : undefined}
              accent={PALETTE.blue[4]}
              spin={0.35}
              interactive
              distance={view === 'part' ? 1.05 : 0.72}
              className={css.model}
            />
            <p className={css.hint}>Drag to turn</p>
            <div className={css.stageCopy}>
              <p className={css.label}>What it does</p>
              <p className={css.role}>{part.role}</p>
            </div>
            <dl className={css.specs}>
              {part.specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className={css.side}>
            <div className={css.grid}>
              {panels.map((card) => (
                <section key={card.id} className={`${styles.visualCard} ${cards.card} ${css.panel}`}>
                  <GamiCardBody card={card} flat />
                </section>
              ))}
            </div>

            <section className={`${styles.visualCard} ${cards.card} ${css.bridge}`} aria-label="Bridge supplier">
              <div className={css.bridgeHead}>
                <div>
                  <p className={styles.visualTitle}>Bridge Supplier · Türkiye</p>
                  <p className={css.bridgeName}>{part.alternative.supplier}</p>
                  <p className={css.bridgeMeta}>
                    {part.alternative.city} · {part.alternative.qualified}
                  </p>
                </div>
                <span className={css.status}>
                  <i style={{ background: STATUS.good }} aria-hidden />
                  Qualified
                </span>
              </div>
              <dl className={css.bridgeStats}>
                <div>
                  <dt>Capacity</dt>
                  <dd>{part.alternative.capacity}</dd>
                </div>
                <div>
                  <dt>Lead time</dt>
                  <dd>{part.alternative.leadTime}</dd>
                </div>
                <div>
                  <dt>Unit cost</dt>
                  <dd>{part.alternative.cost}</dd>
                </div>
              </dl>
              <ol className={css.plan}>
                {part.plan.map((step) => (
                  <li key={step.step}>
                    <span>{step.step}</span>
                    <b>{step.when}</b>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <footer className={edit.assetsFooter}>
          <p className={edit.assetsHint}>
            Exports from Poland are suspended; stock runs out in {part.stockDays} days at the current build rate.
          </p>
          {onBridge ? (
            <div className={edit.assetsFooterActions}>
              <button type="button" className={edit.assetsNext} onClick={onBridge}>
                View bridge plan
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
