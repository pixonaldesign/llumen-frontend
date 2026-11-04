/**
 * A part's details, in the story's modal: the part in 3D (or in the vehicle that carries it) with its
 * specs, then story cards and a supplier section. `GamiPartModal` reads a critical UAV part's Poland
 * stock and its Türkiye bridge; `GamiLocalPartModal` reads a part the Kingdom will make, and where.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import edit from '../story/StoryEditPanel.module.css'
import styles from '../story/StoryView.module.css'
import { Gami3DModel } from './Gami3DModel'
import { GamiCardBody } from './GamiCharts'
import { LOCAL_COLOR } from './gamiPlaces'
import { GAMI_PARTS, LOCAL_PARTS } from './gamiScenario'
import { PALETTE, STATUS, type GamiCard, type LocalPartId, type PartId } from './gamiTypes'
import cards from './GamiCards.module.css'
import css from './GamiPartModal.module.css'

type Props = {
  part: PartId
  onClose: () => void
  /** Opens the story's Türkiye page. */
  onBridge?: () => void
}

const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

type ShellProps = {
  part: LocalPartId
  title: string
  sub: string
  vehicle: 'drone' | 'tank'
  accent: string
  copyLabel: string
  copy: string
  specs: [string, string][]
  panels: GamiCard[]
  /** The supplier section under the panels. */
  children: ReactNode
  hint: string
  action?: { label: string; onClick: () => void }
  onClose: () => void
}

function PartModalShell({ part, title, sub, vehicle, accent, copyLabel, copy, specs, panels, children, hint, action, onClose }: ShellProps) {
  const [view, setView] = useState<'part' | 'vehicle'>('part')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
                {title}
              </h2>
              <p className={css.sub}>{sub}</p>
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
              {(['part', 'vehicle'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`${edit.segmentedBtn}${view === option ? ` ${edit.segmentedBtnActive}` : ''}`}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {option === 'part' ? 'Part' : vehicle === 'drone' ? 'In the UAV' : 'In the Abrams'}
                </button>
              ))}
            </div>
            <Gami3DModel
              key={view}
              model={view === 'part' ? part : vehicle}
              highlight={view === 'vehicle' ? part : undefined}
              accent={accent}
              spin={0.35}
              interactive
              distance={view === 'part' ? 1.05 : 0.72}
              className={css.model}
            />
            <p className={css.hint}>Drag to turn</p>
            <div className={css.stageCopy}>
              <p className={css.label}>{copyLabel}</p>
              <p className={css.role}>{copy}</p>
            </div>
            <dl className={css.specs}>
              {specs.map(([label, value]) => (
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
            {children}
          </div>
        </div>

        <footer className={edit.assetsFooter}>
          <p className={edit.assetsHint}>{hint}</p>
          {action ? (
            <div className={edit.assetsFooterActions}>
              <button type="button" className={edit.assetsNext} onClick={action.onClick}>
                {action.label}
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Supplier({
  label,
  name,
  meta,
  status,
  stats,
  plan,
}: {
  label: string
  name: string
  meta: string
  status: string
  stats: [string, string][]
  plan: { step: string; when: string }[]
}) {
  return (
    <section className={`${styles.visualCard} ${cards.card} ${css.bridge}`} aria-label={label}>
      <div className={css.bridgeHead}>
        <div>
          <p className={styles.visualTitle}>{label}</p>
          <p className={css.bridgeName}>{name}</p>
          <p className={css.bridgeMeta}>{meta}</p>
        </div>
        <span className={css.status}>
          <i style={{ background: STATUS.good }} aria-hidden />
          {status}
        </span>
      </div>
      <dl className={css.bridgeStats}>
        {stats.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ol className={css.plan}>
        {plan.map((step) => (
          <li key={step.step}>
            <span>{step.step}</span>
            <b>{step.when}</b>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function GamiPartModal({ part: id, onClose, onBridge }: Props) {
  const part = GAMI_PARTS[id]
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

  return (
    <PartModalShell
      part={part.id}
      title={part.name}
      sub={`${part.supplier} · ${part.city} · Used in ${part.programmes.join(', ')}`}
      vehicle="drone"
      accent={PALETTE.blue[4]}
      copyLabel="What it does"
      copy={part.role}
      specs={part.specs}
      panels={panels}
      hint={`Exports from Poland are suspended; stock runs out in ${part.stockDays} days at the current build rate.`}
      action={onBridge ? { label: 'View bridge plan', onClick: onBridge } : undefined}
      onClose={onClose}
    >
      <Supplier
        label="Bridge Supplier · Türkiye"
        name={part.alternative.supplier}
        meta={`${part.alternative.city} · ${part.alternative.qualified}`}
        status="Qualified"
        stats={[
          ['Capacity', part.alternative.capacity],
          ['Lead time', part.alternative.leadTime],
          ['Unit cost', part.alternative.cost],
        ]}
        plan={part.plan}
      />
    </PartModalShell>
  )
}

const RAMP = [0, 6, 12, 18, 24, 30, 36]
const short = (value: number) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value))

export function GamiLocalPartModal({ part: id, onClose }: { part: LocalPartId; onClose: () => void }) {
  const part = LOCAL_PARTS[id]
  const uav = part.platform === 'uav'
  const yMax = Math.ceil((part.capacity * 1.2) / 10 ** Math.floor(Math.log10(part.capacity))) * 10 ** Math.floor(Math.log10(part.capacity))
  const output = (month: number) =>
    month < part.months ? 0 : Math.round(Math.min(part.capacity, part.capacity * (0.3 + ((month - part.months) / 12) * 0.7)))
  const bridge = uav ? 100 + Number.parseInt(GAMI_PARTS[id as PartId].alternative.cost, 10) : null
  const saving = part.costIndex - 100
  const panels: GamiCard[] = [
    {
      id: 'glance',
      kind: 'kpis',
      title: 'At a Glance',
      tiles: [
        { label: 'First unit', value: String(part.months), unit: 'months' },
        { label: 'Capacity / mo', value: part.capacity.toLocaleString('en-US') },
        { label: 'Local content', value: String(part.localContent), unit: '%' },
      ],
    },
    {
      id: 'ramp',
      kind: 'line',
      title: 'Local Output Ramp',
      kpi: { value: part.capacity.toLocaleString('en-US'), unit: `${part.unit} / mo at full rate` },
      x: RAMP.map((month) => (month === 0 ? 'Today' : `+${month}m`)),
      yLabels: [short(yMax), short(yMax / 2), '0'],
      yMax,
      series: [
        { name: 'Local output', points: RAMP.map(output), status: 'good' },
        { name: 'Need', points: RAMP.map(() => part.need), dashed: true },
      ],
    },
    {
      id: 'cost',
      kind: 'vbars',
      title: 'Unit Cost vs Poland',
      kpi: { value: `${saving < 0 ? '−' : '+'}${Math.abs(saving)}%`, unit: 'made locally' },
      bars: [
        { label: 'Poland', value: 100, display: '100' },
        ...(bridge ? [{ label: 'Türkiye', value: bridge, display: String(bridge) }] : []),
        { label: 'Local', value: part.costIndex, display: String(part.costIndex), status: 'good' as const },
      ],
    },
    {
      id: 'readiness',
      kind: 'progress',
      title: 'Facility Readiness',
      rows: part.readiness.map((row) => ({ label: row.label, value: `${row.pct}%`, target: '100%', pct: row.pct })),
    },
  ]

  return (
    <PartModalShell
      part={part.id}
      title={part.name}
      sub={`${part.facility} · ${part.city} · For ${uav ? GAMI_PARTS[id as PartId].programmes.join(', ') : 'the M1A2 Abrams fleet'}`}
      vehicle={uav ? 'drone' : 'tank'}
      accent={LOCAL_COLOR[part.platform]}
      copyLabel="Where it goes"
      copy={part.placement}
      specs={part.specs}
      panels={panels}
      hint={`Made in ${part.city}, it replaces the import from Poland from ${part.ready}.${uav ? ' Türkiye covers the gap until then.' : ''}`}
      onClose={onClose}
    >
      <Supplier
        label="Local Maker · Saudi Arabia"
        name={part.facility}
        meta={`${part.city} · ${part.certification}`}
        status="Funded"
        stats={[
          ['Investment', part.investment],
          ['Need covered', `${Math.round((part.capacity / part.need) * 100)}%`],
          ['First unit', part.ready],
        ]}
        plan={part.plan}
      />
    </PartModalShell>
  )
}
