/**
 * A part's details, in the story's modal: two views over a grid of 184px cells, as the story sidebar
 * lays them. The first is the part, in 3D beside its stock, suppliers and specs; the second the
 * vehicle that carries it, with the part lit up in red. `GamiPartModal` reads a critical UAV part's
 * Poland stock and its Türkiye bridge; `GamiLocalPartModal` reads a part the Kingdom will make, and where.
 */
import { GamiAssetModal } from './GamiAssetModal'
import { LOCAL_COLOR } from './gamiPlaces'
import { GAMI_PARTS, GAMI_VEHICLES, LOCAL_PARTS, POLAND_SUPPLIERS } from './gamiScenario'
import { STATUS, type GamiCard, type LocalPartId, type PartId } from './gamiTypes'

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
  /** The first view's cards, after the part's 3D model. */
  partCards: GamiCard[]
  accent: string
  hint: string
  action?: { label: string; onClick: () => void }
  onClose: () => void
}

function PartModalShell({ part, title, sub, vehicle, partCards, accent, hint, action, onClose }: ShellProps) {
  const carrier = GAMI_VEHICLES[vehicle]
  return (
    <GamiAssetModal
      label="part details"
      title={title}
      sub={sub}
      views={[
        {
          id: 'part',
          label: 'The part',
          cards: [{ id: 'model', kind: 'model', title: LOCAL_PARTS[part].short, cols: 2, height: 2, model: part, accent }, ...partCards],
        },
        {
          id: 'vehicle',
          label: vehicle === 'drone' ? 'The UAV' : 'The Abrams',
          cards: [
            { id: 'model', kind: 'model', title: carrier.name, cols: 2, height: 2, model: vehicle, highlight: part, accent },
            ...carrier.cards,
          ],
        },
      ]}
      hint={hint}
      action={action}
      onClose={onClose}
    />
  )
}

/** Where the part can come from, against the Poland price: cut off, the bridge if there is one, and the Kingdom. */
function supplierTable(id: LocalPartId, title: string): GamiCard {
  const local = LOCAL_PARTS[id]
  const bridge = id in GAMI_PARTS ? GAMI_PARTS[id as PartId].alternative : null
  const saving = local.costIndex - 100
  return {
    id: 'suppliers',
    kind: 'table',
    title,
    cols: 4,
    columns: ['Supplier', 'Capacity', 'Available', 'Unit cost', 'Status'],
    statusColumn: 4,
    rows: [
      { cells: [`${POLAND_SUPPLIERS[id]} · PL`, '0 / month', 'Suspended', 'Base', 'Cut off'], status: 'critical' },
      bridge
        ? { cells: [`${bridge.supplier} · TR`, bridge.capacity, bridge.leadTime, bridge.cost, 'Qualified'], status: 'good' }
        : { cells: ['Abrams OEM spares · US', 'On order', '14 months', '+15%', 'Long lead'], status: 'moderate' },
      {
        cells: [
          `${local.facility} · SA`,
          `${local.capacity.toLocaleString('en-US')} / month`,
          local.ready,
          `${saving < 0 ? '−' : '+'}${Math.abs(saving)}%`,
          'Funded',
        ],
        status: 'mild',
      },
    ],
  }
}

const planTable = (title: string, plan: { step: string; when: string }[]): GamiCard => ({
  id: 'plan',
  kind: 'table',
  title,
  height: 2,
  columns: ['Milestone', 'When'],
  rows: plan.map((step) => ({ cells: [step.step, step.when] })),
})

export function GamiPartModal({ part: id, onClose, onBridge }: Props) {
  const part = GAMI_PARTS[id]
  const usual = Math.round(part.deliveries.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4)
  const partCards: GamiCard[] = [
    { id: 'stock-left', kind: 'cell', title: 'Stock left', value: `${part.stockDays} days`, note: 'At the current build rate', status: 'critical' },
    { id: 'need', kind: 'cell', title: 'Monthly need', value: part.monthlyNeed.split(' ')[0], note: 'Units a month' },
    { id: 'from-poland', kind: 'cell', title: 'From Poland', value: '100%', note: 'Every unit imported', status: 'critical' },
    {
      id: 'bridge-lead',
      kind: 'cell',
      title: 'Bridge lead time',
      value: part.alternative.leadTime,
      note: `${part.alternative.city}, Türkiye`,
      status: 'good',
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
    supplierTable(id, 'Bridge Supplier · Türkiye'),
    planTable('Bridge Plan', part.plan),
    { id: 'role', kind: 'note', title: 'What it does', text: part.role },
    { id: 'specs', kind: 'specs', title: 'Specifications', items: part.specs },
  ]

  return (
    <PartModalShell
      part={part.id}
      title={part.name}
      sub={`${part.supplier} · ${part.city} · Used in ${part.programmes.join(', ')}`}
      vehicle="drone"
      partCards={partCards}
      accent={STATUS.critical}
      hint={`Exports from Poland are suspended; stock runs out in ${part.stockDays} days at the current build rate.`}
      action={onBridge ? { label: 'View bridge plan', onClick: onBridge } : undefined}
      onClose={onClose}
    />
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
  const partCards: GamiCard[] = [
    { id: 'first-unit', kind: 'cell', title: 'First unit', value: `${part.months} months`, note: part.ready, status: 'good' },
    { id: 'capacity', kind: 'cell', title: 'Capacity', value: part.capacity.toLocaleString('en-US'), note: `${part.unit} a month` },
    { id: 'local-content', kind: 'cell', title: 'Local content', value: `${part.localContent}%`, note: 'Of the unit’s value' },
    { id: 'investment', kind: 'cell', title: 'Investment', value: part.investment, note: part.certification },
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
      id: 'readiness',
      kind: 'progress',
      title: 'Facility Readiness',
      rows: part.readiness.map((row) => ({ label: row.label, value: `${row.pct}%`, target: '100%', pct: row.pct })),
    },
    supplierTable(id, 'Local Maker · Saudi Arabia'),
    planTable('Local Plan', part.plan),
    { id: 'placement', kind: 'note', title: 'Where it goes', text: part.placement },
    { id: 'specs', kind: 'specs', title: 'Specifications', items: part.specs },
  ]

  return (
    <PartModalShell
      part={part.id}
      title={part.name}
      sub={`${part.facility} · ${part.city} · For ${uav ? GAMI_PARTS[id as PartId].programmes.join(', ') : 'the M1A2 Abrams fleet'}`}
      vehicle={uav ? 'drone' : 'tank'}
      partCards={partCards}
      accent={LOCAL_COLOR[part.platform]}
      hint={`Made in ${part.city}, it replaces the import from Poland from ${part.ready}.${uav ? ' Türkiye covers the gap until then.' : ''}`}
      onClose={onClose}
    />
  )
}
