/**
 * The details panel's towers: what a lit tower's panel reads when a story page carries one. The
 * municipality stories carry none, so the panel stays closed there.
 */
import { hash } from './estateGeo'
import { PALETTE, type BuildingId, type BuildingTab, type CountRow, type EstateBuilding } from './estateTypes'

export const TOWER_COLOR: Record<BuildingId, string> = {
  dreamscape: PALETTE.teal[2],
  'opera-crest': PALETTE.categorical[5],
}

/** `count` values from `from` to `to`, with a little deterministic noise. */
function series(count: number, from: number, to: number, seed: number, noise = 0.08) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 1 : index / (count - 1)
    const base = from + (to - from) * (t * t * (3 - 2 * t))
    return Math.round(base * (1 + (hash(index, seed) - 0.5) * 2 * noise) * 10) / 10
  })
}

const rows = (entries: [string, number][]): CountRow[] => entries.map(([name, count]) => ({ name, count }))
const bars = (entries: [string, number][]) => entries.map(([label, value]) => ({ label, value }))

const LAST_30_DAYS = ['6 Oct', '13 Oct', '20 Oct', '27 Oct', '3 Nov']
const LAST_12_MONTHS = ['Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct']

function tabs(spec: {
  seed: number
  sold: number
  value: string
  share: string
  available: number
  sellThrough: string
  owners: number
  perOwner: string
  foreign: string
  yieldPct: string
  rent: string
  comparables: number
  soldByType: [string, number][]
  availableByType: [string, number][]
  ownersByType: [string, number][]
  rentalsByType: [string, number][]
  buyers: { nationality: [string, number][]; gender: [string, number][]; age: [string, number][]; marital: [string, number][] }
  intent: [string, number][][]
  ownerTypes: [string, number][][]
  tenants: [string, number][][]
  daily: [number, number]
  sellCurve: [number, number]
  newOwners: [number, number]
  rentCurve: [number, number]
}): Record<'sales' | 'utilization' | 'ownership' | 'rentals', BuildingTab> {
  return {
    sales: {
      kpis: [
        { label: 'Count of sales', value: spec.sold.toLocaleString('en-US') },
        { label: 'Sales value', value: spec.value, unit: 'AED' },
        { label: '% of sales to total value', value: spec.share },
      ],
      breakdown: { title: 'Unit types', rows: rows(spec.soldByType) },
      demographics: {
        title: 'Buyer demographics',
        groups: [
          { title: 'Nationality', bars: bars(spec.buyers.nationality) },
          { title: 'Gender', bars: bars(spec.buyers.gender) },
          { title: 'Age group', bars: bars(spec.buyers.age) },
          { title: 'Marital status', bars: bars(spec.buyers.marital) },
        ],
      },
      series: {
        title: 'Sales, last 30 days',
        unit: 'units a day',
        x: LAST_30_DAYS,
        yLabels: ['15', '10', '5', '0'],
        yMax: 15,
        points: series(30, spec.daily[0], spec.daily[1], spec.seed, 0.32),
      },
    },
    utilization: {
      kpis: [
        { label: 'Units sold', value: spec.sold.toLocaleString('en-US') },
        { label: 'Units available', value: spec.available.toLocaleString('en-US') },
        { label: 'Sell-through', value: spec.sellThrough },
      ],
      breakdown: { title: 'Available units by type', rows: rows(spec.availableByType) },
      demographics: {
        title: 'How buyers use their units',
        groups: [
          { title: 'Buyer intent', bars: bars(spec.intent[0]) },
          { title: 'Residency', bars: bars(spec.intent[1]) },
          { title: 'Payment', bars: bars(spec.intent[2]) },
        ],
      },
      series: {
        title: 'Sell-through, last 12 months',
        unit: '% of units',
        x: LAST_12_MONTHS,
        yLabels: ['80%', '40%', '0%'],
        yMax: 80,
        points: series(12, spec.sellCurve[0], spec.sellCurve[1], spec.seed + 3, 0.03),
      },
    },
    ownership: {
      kpis: [
        { label: 'Owners', value: spec.owners.toLocaleString('en-US') },
        { label: 'Units per owner', value: spec.perOwner },
        { label: 'Foreign owners', value: spec.foreign },
      ],
      breakdown: { title: 'Owners by unit type', rows: rows(spec.ownersByType) },
      demographics: {
        title: 'Owner profile',
        groups: [
          { title: 'Owner type', bars: bars(spec.ownerTypes[0]) },
          { title: 'Units owned', bars: bars(spec.ownerTypes[1]) },
          { title: 'Resale', bars: bars(spec.ownerTypes[2]) },
        ],
      },
      series: {
        title: 'New owners, last 12 months',
        unit: 'owners a month',
        x: LAST_12_MONTHS,
        yLabels: ['200', '100', '0'],
        yMax: 200,
        points: series(12, spec.newOwners[0], spec.newOwners[1], spec.seed + 5, 0.18),
      },
    },
    rentals: {
      kpis: [
        { label: 'Expected gross yield', value: spec.yieldPct },
        { label: 'Avg annual rent', value: spec.rent, unit: 'AED' },
        { label: 'Comparable Ejari contracts', value: spec.comparables.toLocaleString('en-US') },
      ],
      breakdown: { title: 'Comparable contracts by type', rows: rows(spec.rentalsByType) },
      demographics: {
        title: 'Tenants in comparable towers',
        groups: [
          { title: 'Nationality', bars: bars(spec.tenants[0]) },
          { title: 'Contract length', bars: bars(spec.tenants[1]) },
        ],
      },
      series: {
        title: 'Average rent, last 12 months',
        unit: 'AED per sq ft a year',
        x: LAST_12_MONTHS,
        yLabels: ['300', '150', '0'],
        yMax: 300,
        points: series(12, spec.rentCurve[0], spec.rentCurve[1], spec.seed + 7, 0.02),
      },
    },
  }
}

export const ESTATE_BUILDINGS: Record<BuildingId, EstateBuilding> = {
  dreamscape: {
    id: 'dreamscape',
    name: 'Dreamscape Tower',
    featureId: 1047612083,
    at: [55.27202, 25.19629],
    heightM: 356,
    color: TOWER_COLOR.dreamscape,
    state: 'select',
    code: 'ID 81237',
    use: 'Residential',
    stage: 'Off Plan',
    developer: 'Meridian Developments',
    community: 'Downtown Dubai',
    headline: 'AED 3.5bn sold this quarter · 66% sold',
    totalValue: { value: '25.8B', unit: 'AED', years: ['2024', '2025', '2026'], spark: series(24, 14, 25.8, 11, 0.05) },
    units: 2500,
    unitTypes: rows([
      ['Studio', 410],
      ['1 Bedroom', 638],
      ['2 Bedroom', 650],
      ['3 Bedroom', 172],
      ['Duplex', 400],
      ['Penthouse', 230],
    ]),
    completion: 84,
    handover: 'Q2 2027',
    reports: ['Q3 2026 Report', 'Q2 2026 Report'],
    tabs: tabs({
      seed: 21,
      sold: 1653,
      value: '18.6B',
      share: '72%',
      available: 847,
      sellThrough: '66%',
      owners: 1412,
      perOwner: '1.17',
      foreign: '71%',
      yieldPct: '6.4%',
      rent: '168k',
      comparables: 3240,
      soldByType: [
        ['Studio', 310],
        ['1 Bedroom', 164],
        ['2 Bedroom', 452],
        ['3 Bedroom', 141],
        ['Duplex', 378],
        ['Penthouse', 208],
      ],
      availableByType: [
        ['Studio', 100],
        ['1 Bedroom', 474],
        ['2 Bedroom', 198],
        ['3 Bedroom', 31],
        ['Duplex', 22],
        ['Penthouse', 22],
      ],
      ownersByType: [
        ['Studio', 262],
        ['1 Bedroom', 141],
        ['2 Bedroom', 386],
        ['3 Bedroom', 122],
        ['Duplex', 330],
        ['Penthouse', 171],
      ],
      rentalsByType: [
        ['Studio', 640],
        ['1 Bedroom', 1140],
        ['2 Bedroom', 1020],
        ['3 Bedroom', 200],
        ['Duplex', 180],
        ['Penthouse', 60],
      ],
      buyers: {
        nationality: [
          ['UAE', 486],
          ['USA', 312],
          ['UK', 398],
          ['KSA', 268],
          ['Others', 189],
        ],
        gender: [
          ['Male', 1021],
          ['Female', 632],
        ],
        age: [
          ['25-35', 402],
          ['36-45', 588],
          ['46-60', 381],
          ['61-80', 282],
        ],
        marital: [
          ['Family', 1034],
          ['Single', 619],
        ],
      },
      intent: [
        [
          ['End user', 712],
          ['Investor', 941],
        ],
        [
          ['Resident', 1108],
          ['Non-resident', 545],
        ],
        [
          ['Cash', 498],
          ['Plan', 1155],
        ],
      ],
      ownerTypes: [
        [
          ['Individual', 1236],
          ['Company', 176],
        ],
        [
          ['1 unit', 1214],
          ['2 units', 146],
          ['3+ units', 52],
        ],
        [
          ['Held', 1327],
          ['Resold', 85],
        ],
      ],
      tenants: [
        [
          ['UAE', 290],
          ['India', 980],
          ['UK', 610],
          ['KSA', 120],
          ['Others', 1240],
        ],
        [
          ['12 months', 2610],
          ['6 months', 630],
        ],
      ],
      daily: [3, 9],
      sellCurve: [18, 66],
      newOwners: [60, 170],
      rentCurve: [232, 268],
    }),
  },
  'opera-crest': {
    id: 'opera-crest',
    name: 'Opera Crest Residences',
    featureId: 382096518,
    at: [55.28184, 25.19416],
    heightM: 288,
    color: TOWER_COLOR['opera-crest'],
    state: 'highlight',
    code: 'ID 80954',
    use: 'Residential',
    stage: 'Off Plan',
    developer: 'Harbour Line Properties',
    community: 'Downtown Dubai · Opera District',
    headline: 'AED 2.6bn sold this quarter · 58% sold',
    totalValue: { value: '19.4B', unit: 'AED', years: ['2024', '2025', '2026'], spark: series(24, 11, 19.4, 37, 0.05) },
    units: 1860,
    unitTypes: rows([
      ['Studio', 260],
      ['1 Bedroom', 520],
      ['2 Bedroom', 610],
      ['3 Bedroom', 300],
      ['Duplex', 110],
      ['Penthouse', 60],
    ]),
    completion: 62,
    handover: 'Q4 2027',
    reports: ['Q3 2026 Report', 'Q2 2026 Report'],
    tabs: tabs({
      seed: 57,
      sold: 1079,
      value: '12.1B',
      share: '62%',
      available: 781,
      sellThrough: '58%',
      owners: 948,
      perOwner: '1.14',
      foreign: '66%',
      yieldPct: '6.9%',
      rent: '142k',
      comparables: 2760,
      soldByType: [
        ['Studio', 198],
        ['1 Bedroom', 341],
        ['2 Bedroom', 322],
        ['3 Bedroom', 131],
        ['Duplex', 52],
        ['Penthouse', 35],
      ],
      availableByType: [
        ['Studio', 62],
        ['1 Bedroom', 179],
        ['2 Bedroom', 288],
        ['3 Bedroom', 169],
        ['Duplex', 58],
        ['Penthouse', 25],
      ],
      ownersByType: [
        ['Studio', 176],
        ['1 Bedroom', 300],
        ['2 Bedroom', 281],
        ['3 Bedroom', 114],
        ['Duplex', 46],
        ['Penthouse', 31],
      ],
      rentalsByType: [
        ['Studio', 610],
        ['1 Bedroom', 980],
        ['2 Bedroom', 760],
        ['3 Bedroom', 260],
        ['Duplex', 100],
        ['Penthouse', 50],
      ],
      buyers: {
        nationality: [
          ['UAE', 241],
          ['USA', 156],
          ['UK', 302],
          ['KSA', 190],
          ['Others', 190],
        ],
        gender: [
          ['Male', 701],
          ['Female', 378],
        ],
        age: [
          ['25-35', 330],
          ['36-45', 371],
          ['46-60', 248],
          ['61-80', 130],
        ],
        marital: [
          ['Family', 602],
          ['Single', 477],
        ],
      },
      intent: [
        [
          ['End user', 486],
          ['Investor', 593],
        ],
        [
          ['Resident', 702],
          ['Non-resident', 377],
        ],
        [
          ['Cash', 291],
          ['Plan', 788],
        ],
      ],
      ownerTypes: [
        [
          ['Individual', 846],
          ['Company', 102],
        ],
        [
          ['1 unit', 836],
          ['2 units', 86],
          ['3+ units', 26],
        ],
        [
          ['Held', 911],
          ['Resold', 37],
        ],
      ],
      tenants: [
        [
          ['UAE', 240],
          ['India', 860],
          ['UK', 520],
          ['KSA', 100],
          ['Others', 1040],
        ],
        [
          ['12 months', 2210],
          ['6 months', 550],
        ],
      ],
      daily: [2, 7],
      sellCurve: [14, 58],
      newOwners: [40, 120],
      rentCurve: [214, 246],
    }),
  },
}

export function isBuildingId(id: string): id is BuildingId {
  return id in ESTATE_BUILDINGS
}
