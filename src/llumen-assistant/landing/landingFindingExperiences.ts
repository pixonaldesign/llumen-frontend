/**
 * Tell Me More for each Briefing finding. Each GAMI finding opens its place in the ask stage, zoomed into
 * the area its story's second page outlines, with the charts that explain it.
 */
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  StoryReplyChartData,
  ThinkingStep,
  TimelineStep,
} from '../assistantReplyTypes'
import { INVENTORY_TOTALS, sar, valueByOrigin } from '../gami/gamiInventory'
import { DOMAIN_LABEL, PLANT_NAME, SITES } from '../gami/gamiPlaces'
import { GAMI_STORIES } from '../gami/gamiScenario'
import { PALETTE, STATUS, type GamiPage } from '../gami/gamiTypes'
import { BRIEFING_PLACES, type BriefingPlaceId } from './briefingMapPlaces'

/** A Briefing place, the Poland alert's Türkiye bridge, or every site across the Kingdom. */
export type FindingStageId = BriefingPlaceId | 'alert' | 'kingdom-sites'

/** Typed into the Briefing's AI bar on the first keystroke: opens the stage on the Kingdom's sites. */
export const GAMI_ASK_PROMPT = 'Map the Kingdom’s defence industrial sites and show which are at risk from the Poland supply cut'
/** Offered in the stage's chat box once the sites are on the map: dives into the corridor at risk. */
export const GAMI_DIVE_PROMPT = 'Zoom into the Riyadh–Al Kharj UAV sites and chart what is at risk'
export const GAMI_ASK_ID = 'gami-ask'
export const GAMI_DIVE_ID = 'gami-dive'

export type FindingMap = { place: FindingStageId; title: string; tag: string; meta: string }

export type FindingExperience = {
  reply: AssistantReplyPayload
  /** The finding's own map for the stage; null answers in charts and keeps the map closed. */
  map: FindingMap | null
}

export function isFindingPlace(id: string | undefined): id is FindingStageId {
  return id === 'alert' || id === 'kingdom-sites' || (id !== undefined && id in BRIEFING_PLACES)
}

const placePages = new Map<BriefingPlaceId, GamiPage>()

/** A place without a story of its own: its Briefing camera and scene, with nothing outlined. */
function placePage(place: BriefingPlaceId): GamiPage {
  let page = placePages.get(place)
  if (!page) {
    const { camera, scene } = BRIEFING_PLACES[place]
    page = { id: place, title: '', finding: '', camera, scene, polygons: [], filters: [], cards: [], layers: [] }
    placePages.set(place, page)
  }
  return page
}

/** The map Tell Me More opens for a place: its story's second page, with that page's outlined area. */
export function findingStage(place: FindingStageId): GamiPage {
  if (place === 'alert') return GAMI_STORIES['gami-alert'].pages[1]
  if (place === 'kingdom-sites') return GAMI_STORIES['gami-overview'].pages[0]
  const story = Object.values(GAMI_STORIES).find(
    (item) => item.place === place && item.id !== 'gami-alert' && item.layout !== 'grid',
  )
  return story ? story.pages[1] : placePage(place)
}

function timeline(steps: ThinkingStep[]): TimelineStep[] {
  return steps
    .filter((step) => step.kind !== 'done')
    .map((step) => ({
      id: step.id,
      kind: step.kind === 'search' ? ('tool' as const) : ('reasoning' as const),
      title: step.title,
      titleInProgress: step.title.endsWith('…') ? step.title : `${step.title}…`,
    }))
}

function chartComponent(id: string, chart: StoryReplyChartData, caption: string): CreatedComponent {
  return {
    id,
    label: chart.title,
    type: 'visual',
    title: chart.title,
    description: caption,
    caption,
    inlineSize: 'full',
    preview: { kind: 'story-chart', chart },
  }
}

function visual(component: CreatedComponent): AgentResponseBlock {
  return {
    type: 'visual',
    componentId: component.id,
    visualType: 'chart',
    title: component.title,
    caption: component.caption ?? component.description,
    displayMode: 'inline',
  }
}

/** A smooth path through evenly spaced values, in the trend chart's 0–100 box (y grows downwards). */
function trendLine(values: number[], min: number, max: number) {
  const points = values.map((value, index): [number, number] => [
    (index / (values.length - 1)) * 100,
    100 - ((value - min) / (max - min)) * 100,
  ])
  const at = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`
  let path = `M${at(points[0])}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    path += ` C${at(c1)} ${at(c2)} ${at(p2)}`
  }
  return path
}

type BarRow = { label: string; value: number; display: string }

function barRows(rows: [label: string, value: number, display: string][]): BarRow[] {
  const max = Math.max(...rows.map(([, value]) => value))
  return rows.map(([label, value, display]) => ({ label, value: (value / max) * 100, display }))
}

type Section = { heading: string; text: string; chart?: CreatedComponent }

type ExperienceSpec = {
  id: string
  read: string
  search: string
  reason: string
  headline: string
  headlineDetail: string
  intro: string
  sections: Section[]
  map: FindingMap | null
}

function experience(spec: ExperienceSpec): FindingExperience {
  const steps: ThinkingStep[] = [
    { id: `${spec.id}-read`, kind: 'reasoning', title: spec.read },
    { id: `${spec.id}-search`, kind: 'search', title: spec.search },
    { id: `${spec.id}-reason`, kind: 'reasoning', title: spec.reason },
    { id: `${spec.id}-done`, kind: 'done', title: spec.map ? 'Map annotated' : 'Charts ready' },
  ]
  const charts = spec.sections.flatMap((section) => (section.chart ? [section.chart] : []))
  return {
    map: spec.map,
    reply: {
      headline: spec.headline,
      headlineDetail: spec.headlineDetail,
      thinkingSteps: steps,
      timeline: timeline(steps),
      createdComponents: charts,
      blocks: [
        { type: 'text', content: spec.intro },
        ...spec.sections.flatMap((section): AgentResponseBlock[] => [
          { type: 'heading', content: section.heading },
          { type: 'text', content: section.text },
          ...(section.chart ? [visual(section.chart)] : []),
        ]),
      ],
    },
  }
}


/** Every Poland alert answers with the same brief: the disruption, then the Türkiye bridge on the map. */
const polandAlert = () =>
  experience({
    id: 'finding-gami-alert',
    read: 'Reading the export-permit suspension notices and Poland supplier contracts…',
    search: 'Matching the 20 suspended items to stock, UAV programmes and alternative suppliers…',
    reason: 'Outlining the suppliers that can bridge the 3 critical items…',
    headline: 'Switch the 3 critical UAV parts to Türkiye: first deliveries in 30 days, at 8% extra cost.',
    headlineDetail: 'Drew the Ankara–Eskişehir–Konya supplier belt on the map, with the bridge routes to Riyadh and Al-Kharj.',
    intro:
      'The Poland–Russia conflict suspended export permits for 20 components Saudi military industries import from Poland. Three of them, propulsion motors, EO/IR gimbals and navigation units, feed every national UAV programme, and motor stock runs out in 41 days.',
    sections: [
      {
        heading: 'What is at risk',
        text: '3 critical items, 8 moderate and 9 mild. Najm, Sahm and Rimah would miss 2,160 deliveries in 2027 if the motors run out.',
        chart: chartComponent(
          'finding-gami-alert-stock',
          {
            type: 'bars',
            title: 'Days of stock left',
            value: '41 days',
            unit: 'propulsion motors',
            color: STATUS.critical,
            rows: barRows([
              ['Propulsion motors', 41, '41 days'],
              ['EO/IR gimbals', 47, '47 days'],
              ['Navigation units', 58, '58 days'],
            ]),
          },
          'Stock left for each critical item at the current build rate.',
        ),
      },
      {
        heading: 'On the map',
        text: 'Ankara, Eskişehir and Konya each have a qualified supplier with capacity above the monthly need. Their routes into Riyadh and Al-Kharj are drawn in green; the suspended Polish routes are faded red.',
      },
      {
        heading: 'Recommended action',
        text: 'Place bridge orders this week. Türkiye lands first deliveries 11 days before motor stock runs out and covers supply for 3 years, until local production starts in 2029.',
        chart: chartComponent(
          'finding-gami-alert-capacity',
          {
            type: 'bars',
            title: 'Türkiye capacity vs monthly need',
            value: '111%',
            unit: 'motors, Ankara',
            color: STATUS.good,
            rows: barRows([
              ['Motors · Ankara', 111, '111%'],
              ['Gimbals · Eskişehir', 108, '108%'],
              ['Nav units · Konya', 107, '107%'],
            ]),
          },
          'Each supplier’s monthly capacity as a share of the Kingdom’s need.',
        ),
      },
    ],
    map: { place: 'alert', title: 'Drone Supply: Bridge Through Türkiye · on the map', tag: 'Anatolia', meta: '1 area outlined' },
  })

const SITE_EMPLOYEES = SITES.reduce((total, item) => total + item.employees, 0)
const SITE_COMPANIES = SITES.reduce((total, item) => total + item.companies, 0)
const AT_RISK = SITES.filter((item) => item.risk)
const thousands = (count: number) => count.toLocaleString('en-US')

/** The AI bar's GAMI demo: every site on the Kingdom's map, then the corridor at risk. */
const gamiAsk = () =>
  experience({
    id: 'gami-ask',
    read: 'Reading the national register of defence industrial sites…',
    search: 'Matching each site’s suppliers to the 20 suspended Poland export permits…',
    reason: 'Placing the sites on the map by workforce…',
    headline: `${SITES.length} defence industrial sites across the Kingdom; the ${AT_RISK.length} UAV sites near Riyadh are at risk.`,
    headlineDetail: 'Mapped every site as a column, its height the workforce; the sites at risk are in red.',
    intro: `The Kingdom has ${SITES.length} defence industrial sites, with ${thousands(SITE_EMPLOYEES)} employees across ${SITE_COMPANIES} companies. ${AT_RISK.map((item) => item.name).join(' and ')} take parts from Poland, whose export permits are suspended.`,
    sections: [
      {
        heading: 'On the map',
        text: 'Each column is a site and its height the workforce. Riyadh and Al-Kharj hold the most, and the two red columns between them are the UAV sites at risk. Hover a column for its figures.',
      },
      {
        heading: 'Workforce by domain',
        text: 'Air employs the most people, and both sites at risk are air sites; land and armament follow.',
        chart: chartComponent(
          'gami-ask-domains',
          {
            type: 'bars',
            title: 'Employees by domain',
            value: thousands(SITE_EMPLOYEES),
            unit: 'employees',
            color: PALETTE.teal[2],
            rows: barRows(
              (['air', 'land', 'armament', 'electronics', 'naval'] as const)
                .map((domain): [string, number, string] => {
                  const count = SITES.filter((item) => item.domain === domain).reduce((total, item) => total + item.employees, 0)
                  return [DOMAIN_LABEL[domain], count, thousands(count)]
                })
                .sort((a, b) => b[1] - a[1]),
            ),
          },
          'People employed at the national defence industrial sites.',
        ),
      },
      {
        heading: 'What is at risk',
        text: `Together the two UAV sites employ ${thousands(AT_RISK.reduce((total, item) => total + item.employees, 0))} people and build every national UAV programme. Their motor stock runs out first, in 41 days.`,
        chart: chartComponent(
          'gami-ask-stock',
          {
            type: 'bars',
            title: 'Days of stock left',
            value: '41 days',
            unit: 'propulsion motors',
            color: STATUS.critical,
            rows: barRows([
              ['Propulsion motors', 41, '41 days'],
              ['EO/IR gimbals', 47, '47 days'],
              ['Navigation units', 58, '58 days'],
            ]),
          },
          'Stock left at the two UAV sites, at the current build rate.',
        ),
      },
    ],
    map: { place: 'kingdom-sites', title: 'Defence Industrial Sites · on the map', tag: 'Saudi Arabia', meta: `${SITES.length} sites, ${AT_RISK.length} at risk` },
  })

const gamiDive = () =>
  experience({
    id: 'gami-dive',
    read: 'Reading the corridor’s sites, companies and supplier links…',
    search: 'Tracing which UAV programmes run through the two sites at risk…',
    reason: 'Outlining the corridor and charting the exposure…',
    headline: 'The Riyadh–Al Kharj corridor holds 248 companies; its UAV output falls 38% by October without a bridge supplier.',
    headlineDetail: 'Zoomed into the corridor and outlined it: 10 places, 2 of them at risk.',
    intro:
      'Between Riyadh and Al-Kharj sit 10 defence sites and industrial cities, 248 of the 602 licensed companies and SAR 7.9bn of this year’s investment. Both UAV sites at risk are here, about 70 km apart.',
    sections: [
      {
        heading: 'On the map',
        text: 'The outline runs from the Riyadh Defense Electronics Park to the Al-Kharj Armament Complex. The red columns and rings are the two UAV sites; the teal columns are the other sites by workforce.',
      },
      {
        heading: 'Workforce in the corridor',
        text: 'The electronics park and the armament complex are the largest employers. The two UAV sites rank fourth and sixth.',
        chart: chartComponent(
          'gami-dive-workforce',
          {
            type: 'bars',
            title: 'Employees by site',
            value: '6,800',
            unit: 'at the two UAV sites',
            color: PALETTE.teal[2],
            rows: barRows([
              ['Riyadh Defense Electronics Park', 7900, '7,900'],
              ['Al-Kharj Armament Complex', 6800, '6,800'],
              ['Riyadh 2nd Industrial City', 5200, '5,200'],
              ['Riyadh UAV Integration Facility', 4200, '4,200'],
              ['Riyadh 3rd Industrial City', 3100, '3,100'],
              ['Al-Kharj UAV Components Plant', 2600, '2,600'],
            ]),
          },
          'People employed at the corridor’s largest places.',
        ),
      },
      {
        heading: 'UAV output',
        text: 'Deliveries from the two sites hold to July, then fall as Polish motor and gimbal stock runs down.',
        chart: chartComponent(
          'gami-dive-output',
          {
            type: 'trend',
            title: 'UAV deliveries, both sites',
            value: '−38%',
            unit: 'by October, without a bridge',
            color: STATUS.critical,
            yLabels: ['110', '80', '50'],
            xLabels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
            line: trendLine([100, 101, 88, 74, 62], 50, 110),
          },
          'Monthly UAV deliveries, indexed to June.',
        ),
      },
      {
        heading: 'Programmes exposed',
        text: 'Najm takes most of the shortfall: 1,240 of the 2,160 deliveries that would slip in 2027.',
        chart: chartComponent(
          'gami-dive-programmes',
          {
            type: 'bars',
            title: 'Deliveries at risk in 2027',
            value: '2,160',
            unit: 'UAV deliveries',
            color: STATUS.critical,
            rows: barRows([
              ['Najm', 1240, '1,240'],
              ['Sahm', 610, '610'],
              ['Rimah', 310, '310'],
            ]),
          },
          'Deliveries each UAV programme would miss if motor stock runs out.',
        ),
      },
      {
        heading: 'Recommended action',
        text: 'Place the Türkiye bridge orders this week and route the first Ankara motors to Al-Kharj. That holds the corridor’s UAV output within 5% of plan.',
      },
    ],
    map: { place: 'kingdom', title: 'Riyadh–Al Kharj corridor · on the map', tag: 'Riyadh–Al Kharj', meta: '1 area outlined · 2 sites at risk' },
  })

const EXPERIENCES: Record<string, () => FindingExperience> = {
  [GAMI_ASK_ID]: gamiAsk,
  [GAMI_DIVE_ID]: gamiDive,
  'poland-motor-alert': polandAlert,
  'poland-gimbal-alert': polandAlert,
  'poland-inu-alert': polandAlert,
  'gami-overview': () =>
    experience({
      id: 'finding-gami-overview',
      read: 'Reading the 2026 plan scorecard and the Saudi Made trajectory…',
      search: 'Matching licensed companies, investment and licences to the Kingdom’s industrial sites…',
      reason: 'Outlining where the sector concentrates on the map…',
      headline: 'The sector is on track for 2026, and the Riyadh–Al Kharj corridor carries it.',
      headlineDetail: 'Drew the corridor on the map: 248 of the 602 licensed companies and SAR 7.9bn of this year’s investment.',
      intro:
        'Saudi Made reached 29.4% this year, 94.8% of the 2026 plan, with the military market at SAR 46.5bn and 66.4k jobs. The corridor between Riyadh and Al Kharj is where most of it happens, so I outlined it on the map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The outline runs from the Riyadh Defense Electronics Park to the Al-Kharj Armament Complex. It holds 41% of licensed companies, and both UAV sites at risk from the Poland supply alert.',
        },
        {
          heading: '2026 plan progress',
          text: 'All three headline numbers are above 90% of plan with ten weeks of the year left. Jobs is the furthest behind, at 90.3%.',
          chart: chartComponent(
            'finding-gami-plan',
            {
              type: 'bars',
              title: '2026 plan progress',
              value: '94.8%',
              unit: 'Saudi Made, of plan',
              color: PALETTE.teal[2],
              rows: [
                { label: 'Saudi Made · 29.4% of 31.0%', value: 94.8, display: '94.8%' },
                { label: 'Military market · SAR 46.5bn of 50bn', value: 93, display: '93.0%' },
                { label: 'Jobs · 66.4k of 73.5k', value: 90.3, display: '90.3%' },
              ],
            },
            'Share of the 2026 plan reached so far.',
          ),
        },
        {
          heading: 'Toward 2030',
          text: 'Saudi Made is 59% of the way to the 50% goal. Next year’s plan is 34.0%, with the military market at 1.10% of GDP.',
          chart: chartComponent(
            'finding-gami-trajectory',
            {
              type: 'trend',
              title: 'Saudi Made share',
              value: '29.4%',
              unit: 'in 2026',
              color: PALETTE.teal[2],
              yLabels: ['50%', '35%', '20%'],
              xLabels: ['2023', '2024', '2025', '2026'],
              line: trendLine([19.4, 22.5, 26, 29.4], 20, 50),
            },
            'Locally made share of military spending.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Prioritize the export licence queue: it has the highest blocked share of the 11 e-services, at 9%, and it slows the companies the corridor’s growth depends on.',
        },
      ],
      map: { place: 'kingdom', title: 'GAMI 2026 Performance · on the map', tag: 'Riyadh–Al Kharj', meta: '1 area outlined' },
    }),

  'gami-inventory': () =>
    experience({
      id: 'finding-gami-inventory',
      read: `Reading the national inventory register: ${INVENTORY_TOTALS.products} products across five domains…`,
      search: 'Matching each product to its maker, origin, open orders and delivery history…',
      reason: 'Ranking the products whose supply is most at risk…',
      headline: `The sector holds SAR ${INVENTORY_TOTALS.valueBn}bn of products; the ${INVENTORY_TOTALS.cutOff} from Poland decide where readiness falls first.`,
      headlineDetail: 'Inventory is not on the map: the answer is in its listing, by domain and origin.',
      intro: `The inventory lists ${INVENTORY_TOTALS.products} weapons, vehicles and systems worth SAR ${INVENTORY_TOTALS.valueBn}bn, ${INVENTORY_TOTALS.localShare}% of it made in the Kingdom. Readiness averages ${INVENTORY_TOTALS.readiness}%, and ${INVENTORY_TOTALS.cutOff} products imported from Poland are cut off.`,
      sections: [
        {
          heading: 'Where it comes from',
          text: 'Most of the value is imported, led by the USA. Poland is a small share of the value, but every one of its products is cut off.',
          chart: chartComponent(
            'finding-gami-inventory-countries',
            {
              type: 'bars',
              title: 'Inventory by origin',
              value: `SAR ${INVENTORY_TOTALS.valueBn}bn`,
              unit: 'held',
              color: PALETTE.blue[3],
              rows: barRows(
                valueByOrigin()
                  .slice(0, 6)
                  .map(([country, millions]): [string, number, string] => [country === 'Saudi Arabia' ? 'Kingdom' : country, millions, sar(millions)]),
              ),
            },
            'Value of the products held, by the country they come from.',
          ),
        },
        {
          heading: 'Lowest stock',
          text: 'The Najm UAV is the first product hit: its propulsion motors from Poland run out in 41 days, then EO/IR gimbals in 47 and navigation units in 58.',
          chart: chartComponent(
            'finding-gami-inventory-lowest',
            {
              type: 'bars',
              title: 'Days of stock left',
              value: '41 days',
              unit: 'propulsion motors',
              color: STATUS.critical,
              rows: barRows([
                ['Propulsion motors · Poland', 41, '41 days'],
                ['EO/IR gimbals · Poland', 47, '47 days'],
                ['Navigation units · Poland', 58, '58 days'],
                ['Carbon-fibre prepreg · Poland', 64, '64 days'],
              ]),
            },
            'Days of stock left at the current build rate.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Place the Türkiye bridge orders for the three UAV parts this week, and reorder Abrams spares from the USA now: their lead time has grown to 14 months.',
        },
      ],
      map: null,
    }),

  'gami-riyadh-plant': () =>
    experience({
      id: 'finding-gami-riyadh-plant',
      read: 'Reading the plant’s production reports and the national capacity register…',
      search: 'Comparing its utilisation with the Kingdom’s other land systems plants…',
      reason: 'Highlighting its buildings on the map…',
      headline: `${PLANT_NAME} runs at 94% of capacity; Hall B is what keeps APC orders on time.`,
      headlineDetail: 'Highlighted the plant’s eight buildings in Riyadh’s 2nd Industrial City in purple.',
      intro: `${PLANT_NAME} assembles armoured vehicles and stores munitions in Riyadh’s 2nd Industrial City. It runs three shifts at 94% of capacity, the highest of any defence plant in the Kingdom, against a national average of 78%.`,
      sections: [
        {
          heading: 'On the map',
          text: 'Assembly Hall A is the largest building, with the Engineering Centre to its west and the Proof & Test Building to its east. Hall B to the south opens in Q2 2027; the three energetics stores sit apart, to the south-east.',
        },
        {
          heading: 'Busiest plants',
          text: 'It is the only plant above 90%. Without Hall B, Tuwaiq APC orders slip about five months in 2027.',
          chart: chartComponent(
            'finding-gami-plant-utilisation',
            {
              type: 'bars',
              title: 'Utilisation by plant',
              value: '94%',
              unit: 'Al-Yamamah',
              color: PALETTE.purple[3],
              rows: barRows([
                ['Al-Yamamah · Riyadh', 94, '94%'],
                ['KAEC Land Systems', 86, '86%'],
                ['Jubail Armor & Steel', 82, '82%'],
                ['Najran Armor Works', 74, '74%'],
                ['Tabuk Vehicle Systems', 69, '69%'],
              ]),
            },
            'Share of installed capacity in use, last 12 months.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Keep Hall B’s fit-out on its Q2 2027 date and move 18 trained technicians from Tabuk ahead of opening. That lifts output by 120 vehicles a year and brings utilisation back to about 80%.',
        },
      ],
      map: { place: 'riyadh-plant', title: 'Riyadh Military Plant · on the map', tag: 'Riyadh', meta: '8 buildings highlighted' },
    }),

  'gami-localization': () =>
    experience({
      id: 'finding-gami-localization',
      read: 'Reading the localization opportunity register and import data…',
      search: 'Matching each product to supplier capability and industrial land across the Kingdom…',
      reason: 'Outlining the city that can take the most of it now…',
      headline: 'Jubail can take SAR 10.6bn of the SAR 32.0bn localization opportunity now.',
      headlineDetail: 'Outlined Jubail Industrial City, with its 37 qualified suppliers and two of the six opportunities.',
      intro:
        'Six products worth SAR 32.0bn a year can be made on capability already in the Kingdom. UAV airframes and propulsion are the largest, at SAR 6.8bn. Jubail is ready for two of them today, so I outlined it on the map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The outline covers Jubail Industrial City. Its armor steel and machining suppliers are ready for ammunition and energetics (SAR 5.9bn) and armored vehicle subsystems (SAR 4.7bn).',
        },
        {
          heading: 'Opportunities by product',
          text: 'Three products make up more than half of the value: UAV airframes, ammunition and armored vehicle subsystems.',
          chart: chartComponent(
            'finding-gami-opportunities',
            {
              type: 'bars',
              title: 'Localization opportunities',
              value: '32.0',
              unit: 'SAR bn a year',
              color: PALETTE.purple[3],
              rows: barRows([
                ['UAV airframes & propulsion', 6.8, 'SAR 6.8bn'],
                ['Ammunition & energetics', 5.9, 'SAR 5.9bn'],
                ['Armored vehicle subsystems', 4.7, 'SAR 4.7bn'],
                ['Radar & comms modules', 4.2, 'SAR 4.2bn'],
                ['Aircraft MRO & spares', 3.9, 'SAR 3.9bn'],
                ['Naval vessel outfitting', 2.6, 'SAR 2.6bn'],
              ]),
            },
            'Annual import-substitution value by product.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Fast-track the propellant plant’s licence review in Jubail and allocate land for the shell forging works. Closing the composites gap next opens UAV airframes, which also ends the Poland exposure.',
        },
      ],
      map: { place: 'eastern', title: 'Localization Opportunities · on the map', tag: 'Jubail', meta: '1 area outlined' },
    }),

  'gami-wds': () =>
    experience({
      id: 'finding-gami-wds',
      read: 'Reading the World Defense Show 2028 exhibitor pipeline…',
      search: 'Grouping applications by region and checking venue readiness in Malham…',
      reason: 'Outlining the venue and its weakest link…',
      headline: 'WDS 2028 is 32% ahead of 2026; roads and shuttles are the link to fix.',
      headlineDetail: 'Outlined the Malham venue: halls are 82% ready, road and shuttle capacity 64%.',
      intro:
        '1,940 exhibitors from 94 countries have applied, 15 months before the show opens. Europe and the GCC lead. The venue is ahead on halls but behind on getting 41,000 visitors a day there, so I outlined it on the map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The outline covers the Malham venue: five halls by domain, the outdoor display and the flying display zone. The four shuttle routes from the airport, the city and KAFD all arrive at one gate.',
        },
        {
          heading: 'Applications by region',
          text: 'Europe sends the most exhibitors, then the GCC and Middle East, then Asia.',
          chart: chartComponent(
            'finding-gami-regions',
            {
              type: 'bars',
              title: 'Exhibitor applications by region',
              value: '1,940',
              unit: 'applications',
              color: PALETTE.blue[3],
              rows: barRows([
                ['Europe', 612, '612'],
                ['GCC & Middle East', 498, '498'],
                ['Asia', 404, '404'],
                ['North America', 236, '236'],
                ['Africa', 118, '118'],
                ['Latin America', 72, '72'],
              ]),
            },
            'Applications received so far for WDS 2028.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Open a second venue gate and add two shuttle routes before the exhibitor move-in window. That lifts road and shuttle capacity from 64% to about 85% of the day-2 peak.',
        },
      ],
      map: { place: 'wds', title: 'WDS 2028 Exhibitor Pipeline · on the map', tag: 'Malham', meta: '1 area outlined' },
    }),

  'gami-talent': () =>
    experience({
      id: 'finding-gami-talent',
      read: 'Reading the skills gap forecast and the internship and academy funnels…',
      search: 'Matching unfilled roles to employers and institutes in the Western Region…',
      reason: 'Outlining the cluster where the gap is closest to closing…',
      headline: 'The skills gap grows to 10,600 by 2030; KAEC is where a second intake closes it fastest.',
      headlineDetail: 'Outlined the KAEC industrial cluster: 640 unfilled roles against 180 graduates a year.',
      intro:
        'The sector is 6,350 skilled people short today, and the gap grows to 10,600 by 2030. The Western Region has the most unfilled roles, 2,140. In KAEC, eight employers share one institute, so I outlined the cluster on the map.',
      sections: [
        {
          heading: 'On the map',
          text: 'The outline covers KAEC’s industrial cluster. The KAEC Land Systems Plant has the most open roles, 214, and applicants live mostly to its south-west.',
        },
        {
          heading: 'Gap by skill',
          text: 'UAV systems integration is the smallest gap today but the fastest-growing one, +76% by 2030.',
          chart: chartComponent(
            'finding-gami-skills',
            {
              type: 'bars',
              title: 'Skills gap by 2030',
              value: '10,600',
              unit: 'people short by 2030',
              color: PALETTE.teal[2],
              rows: barRows([
                ['Avionics', 2900, '2,900'],
                ['Precision machining', 2800, '2,800'],
                ['Cyber & EW', 2700, '2,700'],
                ['UAV systems integration', 2200, '2,200'],
              ]),
            },
            'Shortfall in the top four skills, 2030 forecast.',
          ),
        },
        {
          heading: 'Recommended action',
          text: 'Add a second intake at the KAEC Technical Institute focused on machining and UAV integration. With 120 more graduates a year, the cluster’s gap closes in 2028.',
        },
      ],
      map: { place: 'western', title: 'Defence Skills Gap · on the map', tag: 'KAEC', meta: '1 area outlined' },
    }),
}

/** The Tell Me More experience for a Briefing finding, or null for findings without one (toasts, alerts). */
export function findingExperience(id: string): FindingExperience | null {
  return EXPERIENCES[id]?.() ?? null
}
