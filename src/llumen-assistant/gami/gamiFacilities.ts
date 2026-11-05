/**
 * A defence industrial site's details, opened from its map column: the plant in 3D with its figures,
 * then what it makes and who works there. Products come from the inventory listing (gamiInventory.ts).
 */
import type { AssetModalView } from './GamiAssetModal'
import { hash } from './gamiGeo'
import { PRODUCT_STATUS, PRODUCTS, productValue, sar } from './gamiInventory'
import { DOMAIN_LABEL, type Domain, type GamiSite } from './gamiPlaces'
import type { GamiCard } from './gamiTypes'

const LINES: Record<Domain, string[]> = {
  air: ['Airframe assembly', 'Composites', 'Final integration', 'Flight test'],
  land: ['Hull welding', 'Paint & armour', 'Final assembly', 'Road test'],
  armament: ['Metal parts', 'Filling', 'Assembly', 'Proof range'],
  electronics: ['Circuit boards', 'Integration', 'Environmental test', 'Calibration'],
  naval: ['Hull blocks', 'Outfitting', 'Systems integration', 'Sea trials'],
}

const ROLES = ['Engineers', 'Technicians', 'Operators', 'Quality', 'Support']
const QUARTERS = ['Q4 25', 'Q1', 'Q2', 'Q3', 'Q4']
const MONTHS = ['Nov', 'Jan', 'Mar', 'May', 'Jul', 'Sep']

const thousands = (count: number) => count.toLocaleString('en-US')

/** The site's two views: the facility itself, then its production and workforce. */
export function facilityViews(site: GamiSite): [AssetModalView, AssetModalView] {
  const seed = site.id.length * 13 + site.employees / 100
  const at = (index: number) => hash(index, seed)
  const risk = Boolean(site.risk)
  const utilisation = Math.round(risk ? 58 + at(1) * 8 : 72 + at(1) * 20)
  const saudization = Math.round(38 + at(2) * 30)
  const made = PRODUCTS.filter((product) => product.maker === site.name)
  const sameDomain = PRODUCTS.filter(
    (product) => product.source === 'Local' && product.domain === DOMAIN_LABEL[site.domain] && product.maker !== site.name,
  )
  const listed = made.length ? made : sameDomain.slice(0, 5)
  const output = made.length ? made.reduce((total, product) => total + productValue(product), 0) : site.employees * 0.32
  const opened = 2008 + Math.round(at(3) * 14)
  const area = Math.round(site.employees * (0.08 + at(4) * 0.06))
  const plan = MONTHS.map((_, i) => 100 + i * 2)
  const actual = MONTHS.map((_, i) => Math.round(plan[i] - 4 + at(i + 5) * 8 - (risk && i >= 4 ? (i - 3) * 14 : 0)))
  const roleShares = ROLES.map((_, i) => [0.18, 0.31, 0.29, 0.09, 0.13][i] * (0.9 + at(i + 12) * 0.2))
  const roleTotal = roleShares.reduce((a, b) => a + b, 0)
  const quarterly = QUARTERS.map((_, i) => Math.round((output / 4) * (0.85 + at(i + 20) * 0.3) * (risk && i >= 3 ? 0.62 : 1)))
  const accent = '#94e8dc'

  const facilityCards: GamiCard[] = [
    { id: 'model', kind: 'model', title: site.name, cols: 2, height: 2, model: `facility-${site.domain}`, accent },
    { id: 'employees', kind: 'cell', title: 'Employees', value: thousands(site.employees), note: `${saudization}% Saudi nationals` },
    { id: 'companies', kind: 'cell', title: 'Companies', value: String(site.companies), note: 'Licensed on site' },
    {
      id: 'utilisation',
      kind: 'cell',
      title: 'Utilisation',
      value: `${utilisation}%`,
      note: risk ? 'UAV lines short of parts' : 'Of installed capacity',
      status: risk ? 'moderate' : 'good',
      spark: MONTHS.map((_, i) => utilisation + (5 - i) * (risk ? 3 : -0.6)),
      sparkX: MONTHS,
    },
    {
      id: 'status',
      kind: 'cell',
      title: 'Status',
      value: risk ? 'At risk' : 'Normal',
      note: risk ? 'Poland supply suspended' : 'Suppliers on time',
      status: risk ? 'critical' : 'good',
    },
    {
      id: 'output',
      kind: 'line',
      title: 'Output vs Plan, 2026',
      cols: 2,
      height: 2,
      kpi: { value: String(actual[actual.length - 1]), unit: `index, plan ${plan[plan.length - 1]}` },
      x: MONTHS,
      yLabels: ['120', '60', '0'],
      yMax: 120,
      series: [
        { name: 'Output', points: actual, status: risk ? 'critical' : undefined },
        { name: 'Plan', points: plan, dashed: true },
      ],
    },
    {
      id: 'lines',
      kind: 'progress',
      title: 'Capacity by Line',
      height: 2,
      rows: LINES[site.domain].map((line, i) => {
        const pct = Math.round((risk && i === 2 ? 46 : 64) + at(i + 30) * 30)
        return { label: line, value: `${pct}%`, target: 'used', pct }
      }),
    },
    {
      id: 'specs',
      kind: 'specs',
      title: 'Facility',
      height: 2,
      items: [
        ['City', site.city],
        ['Domain', DOMAIN_LABEL[site.domain]],
        ['Site area', `${area} ha`],
        ['Opened', String(opened)],
        ['Shifts', utilisation > 80 ? '3' : '2'],
        ['Certified', site.domain === 'air' ? 'AS9100D' : 'ISO 9001'],
      ],
    },
    {
      id: 'about',
      kind: 'note',
      title: 'About',
      text: `${site.name} is one of the Kingdom’s ${DOMAIN_LABEL[site.domain].toLowerCase()} sites: ${site.companies} companies employ ${thousands(site.employees)} people. ${
        risk
          ? 'Its UAV lines take propulsion motors and gimbals from Poland; with exports suspended, output falls from August unless the Türkiye bridge lands on time.'
          : 'Its suppliers are delivering on time and output is on plan for 2026.'
      }`,
    },
    { id: 'local-content', kind: 'cell', title: 'Local content', value: `${Math.round(42 + at(40) * 30)}%`, note: 'Localization' },
    {
      id: 'local-suppliers',
      kind: 'cell',
      title: 'Local suppliers',
      value: String(Math.round(site.companies * (2 + at(41) * 3))),
      note: 'Localization',
    },
  ]

  const productionCards: GamiCard[] = [
    made.length
      ? { id: 'products', kind: 'cell', title: 'Products made', value: String(made.length), note: 'In the national inventory' }
      : { id: 'products', kind: 'cell', title: 'Programmes supplied', value: String(listed.length), note: 'Parts from tenant companies' },
    {
      id: 'value',
      kind: 'cell',
      title: 'Output value',
      value: sar(output),
      note: made.length ? 'Units held in inventory' : 'Parts and services, 2026',
    },
    {
      id: 'on-time',
      kind: 'cell',
      title: 'On-time delivery',
      value: `${Math.round(risk ? 71 + at(42) * 6 : 88 + at(42) * 9)}%`,
      note: 'Last 12 months',
      status: risk ? 'moderate' : 'good',
    },
    { id: 'orders', kind: 'cell', title: 'Open orders', value: sar(output * (0.18 + at(43) * 0.2)), note: `${Math.round(40 + at(44) * 200)} purchase orders` },
    {
      id: 'makes',
      kind: 'table',
      title: made.length ? 'What It Makes' : 'Programmes Supplied',
      cols: 4,
      height: 2,
      columns: ['Product', 'In stock', 'Value', 'Status'],
      statusColumn: 3,
      rows: listed.map((product) => ({
        cells: [product.name, product.units.toLocaleString('en-US'), sar(productValue(product)), product.status],
        status: PRODUCT_STATUS[product.status],
      })),
    },
    {
      id: 'quarterly',
      kind: 'vbars',
      title: 'Output by Quarter',
      height: 2,
      kpi: { value: sar(quarterly[3]), unit: 'Q3 2026' },
      bars: QUARTERS.map((label, i) => ({
        label,
        value: quarterly[i],
        display: sar(quarterly[i]),
        status: risk && i >= 3 ? ('critical' as const) : undefined,
      })),
    },
    {
      id: 'roles',
      kind: 'hbars',
      title: 'Workforce by Role',
      height: 2,
      bars: ROLES.map((role, i) => {
        const count = Math.round((site.employees * roleShares[i]) / roleTotal)
        return { label: role, value: count, display: thousands(count) }
      }),
    },
    {
      id: 'saudization',
      kind: 'line',
      title: 'Saudization',
      height: 2,
      kpi: { value: String(saudization), unit: '% Saudi, goal 60%' },
      x: ['2022', '2023', '2024', '2025', '2026'],
      yLabels: ['100%', '50%', '0'],
      yMax: 100,
      series: [
        { name: 'Saudi nationals', points: [0.62, 0.71, 0.8, 0.9, 1].map((f) => Math.round(saudization * f)) },
        { name: 'Goal', points: [60, 60, 60, 60, 60], dashed: true },
      ],
    },
  ]

  return [
    { id: 'facility', label: 'The facility', cards: facilityCards },
    { id: 'production', label: 'Production', cards: productionCards },
  ]
}
