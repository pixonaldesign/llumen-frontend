/**
 * The real-tomtom demo: Downtown Dubai's off-plan sales this quarter, and the two towers that led
 * them. Each tower is lit in its own colour on the map and opens its details panel when clicked.
 */
import { hash, offsetKm, scatter, type LngLat } from './tomtomGeo'
import type { TomtomHeatPoint, TomtomMapScene, TomtomTower } from './tomtomMapLayers'
import {
  PALETTE,
  type BuildingId,
  type BuildingTab,
  type CountRow,
  type TomtomBuilding,
  type TomtomCamera,
  type TomtomCard,
  type TomtomPlaceId,
  type TomtomStory,
  type MapDataLayer,
  type Tone,
} from './tomtomTypes'

export const TOWER_COLOR: Record<BuildingId, string> = {
  dreamscape: PALETTE.teal[2],
  'opera-crest': PALETTE.categorical[5],
}

const HEAT_RAMP = [PALETTE.purple[0], PALETTE.purple[2], PALETTE.purple[4], PALETTE.purple[6]]

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

export const TOMTOM_BUILDINGS: Record<BuildingId, TomtomBuilding> = {
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

const TOWERS_GROUP = 'towers'
const HEAT_GROUP = 'sales'

function tower(building: TomtomBuilding): TomtomTower {
  const sold = building.tabs.sales.kpis[0].value
  return {
    id: building.id,
    featureId: building.featureId,
    at: building.at,
    heightM: building.heightM,
    color: building.color,
    state: building.state,
    title: building.name,
    text: building.headline,
    tip: {
      title: building.name,
      rows: [
        ['Units sold', `${sold} of ${building.units.toLocaleString('en-US')}`],
        ['Total value', `AED ${building.totalValue.value}`],
        ['Completion', `${building.completion}%`],
      ],
    },
    group: TOWERS_GROUP,
  }
}

export const TOMTOM_TOWERS: TomtomTower[] = [tower(TOMTOM_BUILDINGS.dreamscape), tower(TOMTOM_BUILDINGS['opera-crest'])]

const DOWNTOWN: LngLat = [55.2765, 25.1955]

/** Off-plan sales by plot across Downtown and Business Bay's edge, densest around the two towers. */
const DOWNTOWN_HEAT: TomtomHeatPoint[] = [
  ...scatter(DOWNTOWN, 90, 1.5, 3).map((at, index) => ({ at, weight: 0.2 + 0.4 * hash(index, 9), group: HEAT_GROUP })),
  ...scatter(TOMTOM_BUILDINGS.dreamscape.at, 26, 0.35, 5).map((at) => ({ at, weight: 0.9, group: HEAT_GROUP })),
  ...scatter(TOMTOM_BUILDINGS['opera-crest'].at, 22, 0.35, 7).map((at) => ({ at, weight: 0.8, group: HEAT_GROUP })),
  ...scatter(offsetKm(DOWNTOWN, 0.6, 1.4), 30, 0.7, 13).map((at) => ({ at, weight: 0.35, group: HEAT_GROUP })),
]

export const DOWNTOWN_SCENE: TomtomMapScene = { towers: TOMTOM_TOWERS, heat: DOWNTOWN_HEAT, heatRadiusM: 160, heatRamp: HEAT_RAMP }
const TOWERS_SCENE: TomtomMapScene = { towers: TOMTOM_TOWERS, heat: [], heatRadiusM: 160, heatRamp: HEAT_RAMP }

/** The Briefing's view of Downtown: both towers in frame, the Burj Khalifa between them. */
export const DOWNTOWN_CAMERA: TomtomCamera = { center: [55.2768, 25.1962], zoom: 15.6, pitch: 62, bearing: -26 }

const LAYERS: MapDataLayer[] = [
  {
    group: TOWERS_GROUP,
    title: 'Top off-plan towers',
    mark: 'tower',
    color: {
      items: [
        { label: TOMTOM_BUILDINGS.dreamscape.name, color: TOWER_COLOR.dreamscape, count: 'AED 3.5bn' },
        { label: TOMTOM_BUILDINGS['opera-crest'].name, color: TOWER_COLOR['opera-crest'], count: 'AED 2.6bn' },
      ],
    },
  },
  { group: HEAT_GROUP, title: 'Off-plan sales density', mark: 'heat', color: { ramp: HEAT_RAMP, low: 'Fewer', high: 'More' } },
]

/** Assigns each card a tone in turn, so neighbouring charts don't all read the same colour. */
function toned(cards: TomtomCard[]): TomtomCard[] {
  const order: Tone[] = ['teal', 'blue', 'purple']
  let index = 0
  return cards.map((card) => (card.tone || card.kind === 'summary' ? card : { ...card, tone: order[index++ % order.length] }))
}

const DREAMSCAPE = TOMTOM_BUILDINGS.dreamscape.name
const OPERA = TOMTOM_BUILDINGS['opera-crest'].name

export const TOMTOM_STORIES: Record<string, TomtomStory> = {
  're-downtown': {
    id: 're-downtown',
    title: 'Downtown Off-Plan Sales',
    description:
      'Off-plan sales across Downtown Dubai this quarter, and the two towers that led them. Click a lit tower for its sales, units and buyers.',
    place: 'downtown',
    pages: [
      {
        id: 're-downtown-overview',
        title: 'Downtown Dubai',
        finding:
          'Off-plan sales in Downtown reached AED 16.0bn this quarter, up 34%. Dreamscape Tower and Opera Crest Residences took 38% of it.',
        camera: { center: [55.2768, 25.1958], zoom: 15.35, pitch: 63, bearing: -24 },
        scene: DOWNTOWN_SCENE,
        filters: ['Downtown Dubai', 'Q3 2026', 'Off-plan'],
        layers: LAYERS,
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              'Downtown off-plan sales reached ',
              { em: ['AED 16.0bn'] },
              ' this quarter, up 34%. Two towers took ',
              { em: ['38% of it'] },
              `: ${DREAMSCAPE} at AED 3.5bn and ${OPERA} at AED 2.6bn. Prices rose 14% to AED 3,240 per sq ft.`,
            ],
          },
          {
            id: 'kpis',
            kind: 'kpis',
            title: 'This quarter',
            tiles: [
              { label: 'Off-plan sales', value: '16.0', unit: 'bn', note: '+34% QoQ' },
              { label: 'Transactions', value: '4,820', note: '+21% QoQ' },
              { label: 'AED per sq ft', value: '3,240', note: '+14% YoY' },
            ],
          },
          {
            id: 'projects',
            kind: 'hbars',
            title: 'Top projects by sales value',
            kpi: { value: '6.1', unit: 'AED bn in two towers' },
            bars: [
              { label: DREAMSCAPE, value: 3.5, display: '3.5bn', color: TOWER_COLOR.dreamscape },
              { label: OPERA, value: 2.6, display: '2.6bn', color: TOWER_COLOR['opera-crest'] },
              { label: 'Burj Crown', value: 1.4, display: '1.4bn' },
              { label: 'Grande Signature', value: 1.1, display: '1.1bn' },
            ],
          },
          {
            id: 'monthly',
            kind: 'line',
            title: 'Off-plan sales value, monthly',
            kpi: { value: '6.2', unit: 'AED bn in September' },
            x: ['Jan', 'Mar', 'May', 'Jul', 'Sep'],
            yLabels: ['8bn', '4bn', '0'],
            yMax: 8,
            series: [
              { name: '2026', points: [2.6, 2.9, 3.1, 3.4, 3.6, 4.1, 4.6, 5.2, 6.2] },
              { name: '2025', points: [2.1, 2.2, 2.4, 2.3, 2.7, 2.9, 3.1, 3.3, 3.6], dashed: true },
            ],
          },
          {
            id: 'price',
            kind: 'cell',
            title: 'Price per sq ft',
            value: '3,240',
            note: 'AED · +14% YoY',
            spark: [2610, 2680, 2740, 2790, 2850, 2930, 3010, 3090, 3160, 3240],
          },
          {
            id: 'share',
            kind: 'cell',
            title: 'Off-plan share',
            value: '61%',
            note: 'of Downtown sales',
            spark: [44, 46, 49, 51, 52, 55, 57, 58, 60, 61],
          },
          {
            id: 'buyers',
            kind: 'donut',
            title: 'Buyers by nationality',
            total: '4,820',
            totalLabel: 'buyers',
            slices: [
              { name: 'UAE', value: 1060 },
              { name: 'India', value: 868 },
              { name: 'UK', value: 723 },
              { name: 'Russia', value: 530 },
              { name: 'China', value: 434 },
              { name: 'Others', value: 1205 },
            ],
          },
        ]),
      },
      {
        id: 're-downtown-towers',
        title: 'Two towers compared',
        finding: `${DREAMSCAPE} has sold 66% of its units and ${OPERA} 58%. Dreamscape hands over first, in Q2 2027.`,
        camera: { center: [55.2769, 25.1952], zoom: 15.9, pitch: 66, bearing: 14 },
        scene: TOWERS_SCENE,
        filters: ['Downtown Dubai', 'Q3 2026', 'Off-plan'],
        layers: LAYERS.slice(0, 1),
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              `${DREAMSCAPE} has sold `,
              { em: ['1,653 of 2,500 units'] },
              `, led by 2-bedrooms and duplexes. ${OPERA} has sold `,
              { em: ['1,079 of 1,860'] },
              ', mostly 1-bedrooms to investors. Dreamscape is 84% built and hands over in Q2 2027.',
            ],
          },
          {
            id: 'sold-dreamscape',
            kind: 'cell',
            title: DREAMSCAPE,
            value: '66%',
            note: '1,653 of 2,500 units sold',
            color: TOWER_COLOR.dreamscape,
            spark: [18, 24, 29, 35, 40, 46, 51, 55, 59, 62, 64, 66],
          },
          {
            id: 'sold-opera',
            kind: 'cell',
            title: OPERA,
            value: '58%',
            note: '1,079 of 1,860 units sold',
            color: TOWER_COLOR['opera-crest'],
            spark: [14, 19, 23, 28, 33, 37, 41, 45, 49, 52, 55, 58],
          },
          {
            id: 'by-type',
            kind: 'grouped',
            title: 'Units sold by type',
            legend: [DREAMSCAPE, OPERA],
            colors: [TOWER_COLOR.dreamscape, TOWER_COLOR['opera-crest']],
            groups: [
              { label: 'Studio', values: [310, 198] },
              { label: '1 BR', values: [164, 341] },
              { label: '2 BR', values: [452, 322] },
              { label: '3 BR', values: [141, 131] },
              { label: 'Duplex', values: [378, 52] },
              { label: 'PH', values: [208, 35] },
            ],
          },
          {
            id: 'construction',
            kind: 'progress',
            title: 'Construction progress',
            rows: [
              { label: DREAMSCAPE, value: '84%', target: 'Q2 2027', pct: 84, color: TOWER_COLOR.dreamscape },
              { label: OPERA, value: '62%', target: 'Q4 2027', pct: 62, color: TOWER_COLOR['opera-crest'] },
            ],
          },
          {
            id: 'plans',
            kind: 'table',
            title: 'Pricing and payment plans',
            columns: ['Tower', 'AED / sq ft', 'Plan'],
            dotColumn: 0,
            rows: [
              { cells: [DREAMSCAPE, '3,680', '60/40'], color: TOWER_COLOR.dreamscape },
              { cells: [OPERA, '3,410', '70/30'], color: TOWER_COLOR['opera-crest'] },
              { cells: ['Burj Crown', '3,150', '80/20'] },
              { cells: ['Grande Signature', '3,020', '60/40'] },
            ],
          },
          {
            id: 'investors',
            kind: 'vbars',
            title: 'Investor share of buyers',
            kpi: { value: '57%', unit: 'across both towers' },
            bars: [
              { label: 'Dreamscape', value: 57, display: '57%', color: TOWER_COLOR.dreamscape },
              { label: 'Opera Crest', value: 55, display: '55%', color: TOWER_COLOR['opera-crest'] },
              { label: 'Downtown', value: 48, display: '48%' },
              { label: 'Dubai', value: 44, display: '44%' },
            ],
          },
        ]),
      },
    ],
  },
}

export function isBuildingId(id: string): id is BuildingId {
  return id in TOMTOM_BUILDINGS
}

export function isTomtomStory(id: string | null | undefined): id is string {
  return id != null && id in TOMTOM_STORIES
}

export type TomtomPlace = { id: TomtomPlaceId; camera: TomtomCamera; scene: TomtomMapScene }

export const TOMTOM_PLACES: Record<TomtomPlaceId, TomtomPlace> = {
  downtown: { id: 'downtown', camera: DOWNTOWN_CAMERA, scene: DOWNTOWN_SCENE },
}
/* —— Tell Me More: every tall tower in Downtown, by investment potential —— */

/** Investment potential, low to high: Sequential Purple into Teal, the best towers the brightest. */
export const POTENTIAL_RAMP = [PALETTE.purple[0], PALETTE.blue[2], PALETTE.categorical[2], PALETTE.teal[2], PALETTE.teal[3]]

const potentialColor = (score: number) =>
  POTENTIAL_RAMP[score >= 85 ? 4 : score >= 75 ? 3 : score >= 60 ? 2 : score >= 45 ? 1 : 0]

const POTENTIAL_GROUP = 'potential'

type PotentialSpec = {
  id: string
  name: string
  featureId: number
  at: LngLat
  heightM: number
  /** 0–100: price growth, sell-through and rental yield together. */
  score: number
  /** Price growth over the last year, %. */
  growth: number
  /** Gross rental yield, %. */
  yield: number
  /** The basemap building's outline (its convex hull at full height), 1.2 m outside it. */
  footprint: LngLat[]
}

/** Downtown's 12 tallest residential towers, best first; outlines traced from the basemap's buildings. */
const POTENTIAL_SPECS: PotentialSpec[] = [
  {
    id: 'p-dreamscape',
    name: 'Dreamscape Tower',
    featureId: 1047612083,
    at: [55.27201, 25.19629],
    heightM: 356,
    score: 92,
    growth: 18,
    yield: 6.8,
    footprint: [
      [55.271776, 25.196172], [55.271782, 25.196142], [55.271798, 25.196116], [55.271817, 25.196093],
      [55.271843, 25.196074], [55.27187, 25.196059], [55.271901, 25.196049], [55.271978, 25.196028],
      [55.272002, 25.196034], [55.272024, 25.196043], [55.272044, 25.196058], [55.272057, 25.196075],
      [55.272231, 25.196349], [55.272243, 25.196369], [55.272246, 25.196393], [55.272245, 25.196416],
      [55.272236, 25.196439], [55.272222, 25.196458], [55.27218, 25.196494], [55.272139, 25.196529],
      [55.272121, 25.196541], [55.2721, 25.196547], [55.272077, 25.196548], [55.272055, 25.196545],
      [55.271986, 25.196493], [55.271937, 25.196448], [55.271892, 25.1964], [55.271853, 25.196346],
      [55.271821, 25.196289], [55.271795, 25.196231],
    ],
  },
  {
    id: 'p-opera-crest',
    name: 'Opera Crest Residences',
    featureId: 382096518,
    at: [55.28236, 25.19469],
    heightM: 329,
    score: 87,
    growth: 15,
    yield: 7.1,
    footprint: [
      [55.282166, 25.194455], [55.282538, 25.194448], [55.282549, 25.194917], [55.282177, 25.194924],
    ],
  },
  {
    id: 'p-burj-crown',
    name: 'Burj Crown',
    featureId: 382072013,
    at: [55.27619, 25.20088],
    heightM: 370,
    score: 81,
    growth: 13,
    yield: 6.4,
    footprint: [
      [55.275788, 25.200905], [55.275807, 25.200854], [55.275854, 25.200794], [55.275933, 25.20074],
      [55.276057, 25.200684], [55.276213, 25.200651], [55.276332, 25.200652], [55.27646, 25.200668],
      [55.27654, 25.200695], [55.276596, 25.200728], [55.276619, 25.20079], [55.276609, 25.200874],
      [55.276564, 25.200946], [55.276489, 25.201013], [55.276353, 25.20107], [55.276217, 25.2011],
      [55.276091, 25.2011], [55.275979, 25.201084], [55.275907, 25.201057], [55.275836, 25.20102],
      [55.27579, 25.200967],
    ],
  },
  {
    id: 'p-grande-signature',
    name: 'Grande Signature',
    featureId: 47515674,
    at: [55.27891, 25.19403],
    heightM: 306,
    score: 76,
    growth: 12,
    yield: 6.1,
    footprint: [
      [55.278642, 25.193839], [55.278653, 25.193773], [55.278693, 25.193716], [55.278751, 25.193675],
      [55.278836, 25.19365], [55.278901, 25.193652], [55.278967, 25.193692], [55.27904, 25.193789],
      [55.279098, 25.193898], [55.279127, 25.193999], [55.279132, 25.19409], [55.279123, 25.194157],
      [55.279075, 25.194323], [55.279046, 25.194384], [55.279023, 25.194396], [55.278994, 25.194392],
      [55.278932, 25.194354], [55.278859, 25.194288], [55.278789, 25.194221], [55.278739, 25.194164],
      [55.278704, 25.194083],
    ],
  },
  {
    id: 'p-burj-royale',
    name: 'Burj Royale',
    featureId: 1135697350,
    at: [55.28353, 25.1929],
    heightM: 270,
    score: 71,
    growth: 11,
    yield: 6.0,
    footprint: [
      [55.283306, 25.192961], [55.283525, 25.192694], [55.283752, 25.192838], [55.283539, 25.19311],
    ],
  },
  {
    id: 'p-vida',
    name: 'Vida Residences',
    featureId: 1047612078,
    at: [55.27131, 25.19366],
    heightM: 288,
    score: 64,
    growth: 9,
    yield: 5.9,
    footprint: [
      [55.2711, 25.193758], [55.27114, 25.193667], [55.271248, 25.193543], [55.271373, 25.19347],
      [55.271436, 25.193461], [55.271477, 25.193478], [55.271502, 25.193515], [55.27151, 25.193563],
      [55.271454, 25.19367], [55.271353, 25.193792], [55.271261, 25.19385], [55.271202, 25.193866],
      [55.271142, 25.193851], [55.271104, 25.193806],
    ],
  },
  {
    id: 'p-st-regis',
    name: 'St. Regis Residences',
    featureId: 399935565,
    at: [55.26825, 25.19922],
    heightM: 282,
    score: 58,
    growth: 8,
    yield: 5.7,
    footprint: [
      [55.26808, 25.199213], [55.268087, 25.199166], [55.268215, 25.199093], [55.268292, 25.199092],
      [55.268366, 25.199139], [55.268396, 25.199201], [55.268399, 25.19926], [55.268362, 25.199317],
      [55.268243, 25.19937], [55.268157, 25.199342], [55.268106, 25.199281],
    ],
  },
  {
    id: 'p-boulevard-point',
    name: 'Boulevard Point',
    featureId: 203296254,
    at: [55.26589, 25.19491],
    heightM: 285,
    score: 52,
    growth: 7,
    yield: 5.5,
    footprint: [
      [55.265608, 25.194788], [55.265867, 25.194583], [55.266148, 25.194897], [55.26596, 25.19505],
      [55.265894, 25.1951], [55.265845, 25.195051],
    ],
  },
  {
    id: 'p-forte',
    name: 'Forte Tower',
    featureId: 605586686,
    at: [55.2813, 25.20191],
    heightM: 259,
    score: 47,
    growth: 5,
    yield: 5.3,
    footprint: [
      [55.281068, 25.202149], [55.281287, 25.201723], [55.281355, 25.201645], [55.281578, 25.201793],
      [55.28121, 25.202241],
    ],
  },
  {
    id: 'p-address',
    name: 'The Address Residences',
    featureId: 118263836,
    at: [55.26689, 25.20088],
    heightM: 323,
    score: 41,
    growth: 4,
    yield: 5.0,
    footprint: [
      [55.266626, 25.200861], [55.266759, 25.200781], [55.267007, 25.200645], [55.267221, 25.20094],
      [55.266845, 25.20116],
    ],
  },
  {
    id: 'p-burj-vista',
    name: 'Burj Vista',
    featureId: 1146969101,
    at: [55.26536, 25.19337],
    heightM: 258,
    score: 36,
    growth: 3,
    yield: 4.8,
    footprint: [
      [55.26492, 25.193275], [55.265277, 25.192962], [55.265689, 25.193546], [55.265544, 25.193687],
    ],
  },
  {
    id: 'p-south-ridge',
    name: 'South Ridge',
    featureId: 382058685,
    at: [55.27319, 25.1903],
    heightM: 238,
    score: 30,
    growth: 2,
    yield: 4.6,
    footprint: [
      [55.272988, 25.19023], [55.273344, 25.190165], [55.273241, 25.190512],
    ],
  },
]

/** The towers best first, as the reply's charts rank them. */
export const POTENTIAL_RANKING = POTENTIAL_SPECS.map(({ name, score, growth, yield: rentYield }) => ({
  name,
  score,
  growth,
  rentYield,
}))

/** The top three carry roof labels; the rest name themselves on hover. */
const LABELLED = 3

export const POTENTIAL_TOWERS: TomtomTower[] = POTENTIAL_SPECS.map((spec, index) => ({
  id: spec.id,
  featureId: spec.featureId,
  at: spec.at,
  heightM: spec.heightM,
  color: potentialColor(spec.score),
  state: 'select',
  footprint: spec.footprint,
  label: index < LABELLED,
  title: spec.name,
  text: `Potential ${spec.score} · +${spec.growth}% price · ${spec.yield.toFixed(1)}% yield`,
  tip: {
    title: spec.name,
    rows: [
      ['Potential', `${spec.score} of 100`],
      ['Price growth', `+${spec.growth}% a year`],
      ['Rental yield', `${spec.yield.toFixed(1)}%`],
    ],
  },
  group: POTENTIAL_GROUP,
}))

/** What Tell Me More opens for a place: its camera, the scene on the map, and the Map Data that reads it. */
export type TomtomAskView = { camera: TomtomCamera; scene: TomtomMapScene; layers: MapDataLayer[] }

export const TOMTOM_ASK_VIEWS: Record<TomtomPlaceId, TomtomAskView> = {
  downtown: {
    camera: { center: [55.2748, 25.1958], zoom: 15.35, pitch: 60, bearing: -18 },
    scene: { towers: POTENTIAL_TOWERS, heat: [], heatRadiusM: 160, heatRamp: HEAT_RAMP },
    layers: [
      {
        group: POTENTIAL_GROUP,
        title: 'Investment potential',
        mark: 'tower',
        color: { ramp: POTENTIAL_RAMP, low: 'Lower', high: 'Higher' },
      },
    ],
  },
}
