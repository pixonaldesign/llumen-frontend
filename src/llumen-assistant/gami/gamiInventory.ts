/**
 * The inventory app's product listing: 100 weapons, vehicles and systems the sector holds, made in the
 * Kingdom or imported. Makers are invented for the demo. The first ten have their own 3D model and open
 * their details; the dashboard's figures and charts are all read from the listing.
 */
import type { AssetModalView } from './GamiAssetModal'
import { hash } from './gamiGeo'
import type { GamiModelId } from './gamiModelIds'
import type { GamiCard, Status } from './gamiTypes'

export const PRODUCT_DOMAINS = ['Air', 'Land', 'Naval', 'Armament', 'Electronics'] as const
export type ProductDomain = (typeof PRODUCT_DOMAINS)[number]
export type ProductSource = 'Local' | 'Imported'
export const PRODUCT_STATUSES = ['Healthy', 'Watch', 'Low', 'Cut off'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const PRODUCT_STATUS: Record<ProductStatus, Status> = {
  Healthy: 'good',
  Watch: 'mild',
  Low: 'moderate',
  'Cut off': 'critical',
}

type ProductDetail = {
  model: GamiModelId
  about: string
  specs: [string, string][]
  /** The product's main components: what, where from, lead time and status. */
  supply: [string, string, string, ProductStatus][]
}

export type Product = {
  id: string
  name: string
  type: string
  domain: ProductDomain
  source: ProductSource
  country: string
  maker: string
  units: number
  /** SAR millions a unit. */
  unitValue: number
  /** Share of units ready for use. */
  readiness: number
  /** Months from order to delivery. */
  lead: number
  status: ProductStatus
  detail?: ProductDetail
}

const KINGDOM = 'Saudi Arabia'

type Hero = Omit<Product, 'source'>

const HEROES: Hero[] = [
  {
    id: 'najm',
    name: 'Najm MALE UAV',
    type: 'MALE UAV',
    domain: 'Air',
    country: KINGDOM,
    maker: 'Riyadh UAV Integration Facility',
    units: 64,
    unitValue: 38,
    readiness: 81,
    lead: 9,
    status: 'Watch',
    detail: {
      model: 'drone',
      about:
        'The Kingdom’s medium-altitude, long-endurance UAV, integrated in Riyadh. Its propulsion motor still comes from Poland, so new airframes stop when motor stock runs out in 41 days.',
      specs: [
        ['Wingspan', '16 m'],
        ['Endurance', '30 h'],
        ['Ceiling', '9,000 m'],
        ['Payload', '450 kg'],
        ['Range', '1,500 km'],
        ['Local content', '46%'],
      ],
      supply: [
        ['Airframe', 'Riyadh', '3 mo', 'Healthy'],
        ['Propulsion motor', 'Poland', 'Suspended', 'Cut off'],
        ['EO/IR gimbal', 'Poland', 'Suspended', 'Cut off'],
      ],
    },
  },
  {
    id: 'abrams',
    name: 'M1A2 Abrams',
    type: 'Main battle tank',
    domain: 'Land',
    country: 'USA',
    maker: 'Atlantic Land Systems',
    units: 373,
    unitValue: 32,
    readiness: 86,
    lead: 14,
    status: 'Watch',
    detail: {
      model: 'tank',
      about:
        'The Land Forces’ main battle tank, kept at the Tabuk and Khamis Mushait depots. Four of its wear parts came only from Poland; local makers replace all four by Q3 2027.',
      specs: [
        ['Combat mass', '62 t'],
        ['Main gun', '120 mm smoothbore'],
        ['Engine', '1,500 hp turbine'],
        ['Top speed', '67 km/h'],
        ['Range', '426 km'],
        ['Crew', '4'],
      ],
      supply: [
        ['Hull & turret', 'USA', '14 mo', 'Watch'],
        ['Hydraulic seals', 'Poland', 'Suspended', 'Cut off'],
        ['Track pads', 'Poland', 'Suspended', 'Cut off'],
      ],
    },
  },
  {
    id: 'tuwaiq',
    name: 'Tuwaiq 8×8 APC',
    type: 'Armoured personnel carrier',
    domain: 'Land',
    country: KINGDOM,
    maker: 'KAEC Land Systems Plant',
    units: 412,
    unitValue: 11,
    readiness: 91,
    lead: 5,
    status: 'Healthy',
    detail: {
      model: 'apc',
      about:
        'An eight-wheeled armoured carrier built at King Abdullah Economic City for eleven soldiers, with a remote weapon station. It is the sector’s largest locally made vehicle line.',
      specs: [
        ['Combat mass', '28 t'],
        ['Troops', '3 crew + 8'],
        ['Armament', '30 mm RWS'],
        ['Top speed', '100 km/h'],
        ['Range', '800 km'],
        ['Local content', '62%'],
      ],
      supply: [
        ['Hull', 'Jubail', '2 mo', 'Healthy'],
        ['Power pack', 'Germany', '9 mo', 'Watch'],
        ['Weapon station', 'Riyadh', '4 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'blackhawk',
    name: 'UH-60M Black Hawk',
    type: 'Utility helicopter',
    domain: 'Air',
    country: 'USA',
    maker: 'Stratford Rotorcraft',
    units: 48,
    unitValue: 85,
    readiness: 84,
    lead: 16,
    status: 'Watch',
    detail: {
      model: 'helicopter',
      about:
        'The Army Aviation’s utility helicopter for transport, medevac and search and rescue. Spares come from the USA, where lead times have grown to 16 months; Taif now overhauls its gearboxes.',
      specs: [
        ['Max take-off', '10,660 kg'],
        ['Seats', '2 crew + 11'],
        ['Cruise speed', '280 km/h'],
        ['Range', '590 km'],
        ['Engines', '2 × 1,990 shp'],
        ['MRO', 'Taif'],
      ],
      supply: [
        ['Airframe', 'USA', '16 mo', 'Watch'],
        ['Rotor blades', 'USA', '11 mo', 'Watch'],
        ['Gearbox overhaul', 'Taif', '2 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'patriot',
    name: 'Patriot PAC-3 launcher',
    type: 'Air-defence launcher',
    domain: 'Armament',
    country: 'USA',
    maker: 'Andover Air Defense',
    units: 36,
    unitValue: 62,
    readiness: 93,
    lead: 18,
    status: 'Watch',
    detail: {
      model: 'airDefence',
      about:
        'Truck-mounted launchers for the Kingdom’s long-range air-defence batteries, each holding four PAC-3 canisters. Interceptor orders take 18 months from the USA.',
      specs: [
        ['Canisters', '4 × PAC-3'],
        ['Engagement range', '70 km'],
        ['Reload', '< 1 h'],
        ['Prime mover', '8×8 truck'],
        ['Batteries', '9'],
        ['Crew', '3'],
      ],
      supply: [
        ['Launcher', 'USA', '18 mo', 'Watch'],
        ['Interceptors', 'USA', '22 mo', 'Low'],
        ['Prime mover', 'KAEC', '4 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'k9',
    name: 'K9 Thunder howitzer',
    type: 'Self-propelled howitzer',
    domain: 'Land',
    country: 'South Korea',
    maker: 'Changwon Defence Works',
    units: 54,
    unitValue: 18,
    readiness: 89,
    lead: 11,
    status: 'Healthy',
    detail: {
      model: 'howitzer',
      about:
        'A tracked 155 mm howitzer bought from South Korea, with final assembly moving to Al-Kharj from 2027. It fires the shells the Al-Kharj Armament Complex already makes.',
      specs: [
        ['Calibre', '155 mm / 52'],
        ['Range', '40 km'],
        ['Rate of fire', '6 rds / min'],
        ['Combat mass', '47 t'],
        ['Crew', '5'],
        ['Top speed', '67 km/h'],
      ],
      supply: [
        ['Chassis', 'South Korea', '11 mo', 'Healthy'],
        ['Barrel', 'South Korea', '13 mo', 'Watch'],
        ['Ammunition', 'Al-Kharj', '1 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'hawar',
    name: 'Hawar fast patrol craft',
    type: 'Patrol craft · 40 m',
    domain: 'Naval',
    country: KINGDOM,
    maker: 'Jeddah Naval Systems Yard',
    units: 14,
    unitValue: 120,
    readiness: 79,
    lead: 10,
    status: 'Low',
    detail: {
      model: 'patrolBoat',
      about:
        'A 40-metre patrol craft built in Jeddah for the Red Sea and Gulf coasts. Three of the fourteen are in refit, which holds readiness below the Navy’s 85% target until March.',
      specs: [
        ['Length', '40 m'],
        ['Displacement', '210 t'],
        ['Top speed', '35 kn'],
        ['Main gun', '30 mm'],
        ['Crew', '21'],
        ['Local content', '58%'],
      ],
      supply: [
        ['Hull', 'Jeddah', '6 mo', 'Healthy'],
        ['Diesel engines', 'Germany', '12 mo', 'Watch'],
        ['Combat system', 'Riyadh', '5 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'shell155',
    name: '155 mm HE artillery shell',
    type: 'Artillery ammunition',
    domain: 'Armament',
    country: KINGDOM,
    maker: 'Al-Kharj Armament Complex',
    units: 148000,
    unitValue: 0.012,
    readiness: 97,
    lead: 2,
    status: 'Healthy',
    detail: {
      model: 'shell',
      about:
        'High-explosive 155 mm shells filled and finished in Al-Kharj for the K9 and Caesar howitzers. The line runs two shifts and keeps more than a year of stock.',
      specs: [
        ['Calibre', '155 mm'],
        ['Mass', '43.5 kg'],
        ['Filling', 'TNT · 10.8 kg'],
        ['Range', '30 km'],
        ['Line rate', '9,000 / month'],
        ['Local content', '88%'],
      ],
      supply: [
        ['Shell body', 'Jubail', '1 mo', 'Healthy'],
        ['Explosive fill', 'Al-Kharj', '1 mo', 'Healthy'],
        ['Fuze', 'Germany', '7 mo', 'Watch'],
      ],
    },
  },
  {
    id: 'radar',
    name: 'LR-90 air surveillance radar',
    type: 'Air surveillance radar',
    domain: 'Electronics',
    country: 'UK',
    maker: 'Chelmsford Radar Systems',
    units: 12,
    unitValue: 95,
    readiness: 88,
    lead: 15,
    status: 'Watch',
    detail: {
      model: 'radar',
      about:
        'A long-range air surveillance radar on a rotating pedestal, feeding the national air-defence picture. Its transmit modules come from the UK; Riyadh starts making them in 2028.',
      specs: [
        ['Range', '470 km'],
        ['Band', 'L'],
        ['Rotation', '6 rpm'],
        ['Tracks', '1,000+'],
        ['Deploy time', '30 min'],
        ['Sites', '12'],
      ],
      supply: [
        ['Antenna array', 'UK', '15 mo', 'Watch'],
        ['T/R modules', 'UK', '12 mo', 'Watch'],
        ['Shelter & trailer', 'Al-Ahsa', '3 mo', 'Healthy'],
      ],
    },
  },
  {
    id: 'missile',
    name: 'PGM-4 precision strike missile',
    type: 'Precision-guided missile',
    domain: 'Armament',
    country: 'France',
    maker: 'Bourges Missile Systems',
    units: 220,
    unitValue: 4.2,
    readiness: 95,
    lead: 20,
    status: 'Watch',
    detail: {
      model: 'missile',
      about:
        'An air-launched precision strike missile with an imaging seeker, carried by the Typhoon fleet. Orders take 20 months; the Kingdom plans to assemble its rocket motors from 2029.',
      specs: [
        ['Length', '5.1 m'],
        ['Mass', '1,300 kg'],
        ['Range', '250 km'],
        ['Seeker', 'Imaging IR'],
        ['Warhead', '450 kg'],
        ['Carrier', 'Typhoon'],
      ],
      supply: [
        ['Airframe', 'France', '20 mo', 'Watch'],
        ['Seeker', 'France', '18 mo', 'Watch'],
        ['Rocket motor casing', 'Poland', 'Suspended', 'Cut off'],
      ],
    },
  },
]

/** name, type, domain, country, maker, SAR millions a unit, units. */
type Row = [string, string, ProductDomain, string, string, number, number]

const ROWS: Row[] = [
  ['Sahm tactical UAV', 'Tactical UAV', 'Air', KINGDOM, 'Al-Kharj UAV Components Plant', 6.5, 140],
  ['Rimah loitering munition', 'Loitering munition', 'Air', KINGDOM, 'Al-Kharj UAV Components Plant', 0.42, 900],
  ['Najm ground control station', 'UAV ground station', 'Air', KINGDOM, 'Riyadh UAV Integration Facility', 9, 32],
  ['AH-64E Apache', 'Attack helicopter', 'Air', 'USA', 'Mesa Rotorcraft', 140, 36],
  ['F-15SA spares kit', 'Aircraft spares', 'Air', 'USA', 'Fort Worth Aero Spares', 2.4, 310],
  ['F-15SA engine module', 'Aircraft engine', 'Air', 'USA', 'Fort Worth Aero Spares', 28, 46],
  ['Hawk Mk 165 trainer', 'Jet trainer', 'Air', 'UK', 'Brough Aero', 95, 22],
  ['Typhoon EF2000', 'Multirole fighter', 'Air', 'UK', 'Brough Aero', 420, 8],
  ['A330 MRTT tanker', 'Tanker aircraft', 'Air', 'Spain', 'Getafe Aerospace', 890, 2],
  ['C-295 transport', 'Transport aircraft', 'Air', 'Spain', 'Getafe Aerospace', 140, 4],
  ['Kartal MALE UAV', 'MALE UAV', 'Air', 'Türkiye', 'Ankara Aerosystems', 26, 18],
  ['Kartal UAV spares kit', 'UAV spares', 'Air', 'Türkiye', 'Ankara Aerosystems', 0.9, 240],
  ['Xiang-2 MALE UAV', 'MALE UAV', 'Air', 'China', 'Chengdu Air Systems', 21, 12],
  ['AW139 helicopter', 'Utility helicopter', 'Air', 'Italy', 'Varese Helicopters', 58, 10],
  ['UAV propulsion motor', 'UAV subsystem', 'Air', 'Poland', 'Rzeszow Propulsion Works', 0.11, 1450],
  ['EO/IR gimbal', 'UAV subsystem', 'Air', 'Poland', 'Krakow Optronics Plant', 0.32, 620],
  ['Carbon-fibre airframe kit', 'UAV subsystem', 'Air', 'Poland', 'Mielec Composites', 0.6, 180],
  ['Aircraft MRO tooling set', 'MRO equipment', 'Air', KINGDOM, 'Taif Aerospace MRO Centre', 1.8, 60],
  ['Apache rotor blade set', 'Aircraft spares', 'Air', 'USA', 'Mesa Rotorcraft', 3.1, 96],
  ['Aerostructure wing panel', 'Aerostructure', 'Air', KINGDOM, 'Hail Aerostructures Plant', 0.85, 220],

  ['Al-Masmak 4×4 MRAP', 'Protected vehicle', 'Land', KINGDOM, 'KAEC Land Systems Plant', 4.8, 520],
  ['Tuwaiq 8×8 command variant', 'Command vehicle', 'Land', KINGDOM, 'KAEC Land Systems Plant', 14, 38],
  ['Heavy equipment transporter', 'Logistics vehicle', 'Land', KINGDOM, 'Najran Armor Works', 3.2, 140],
  ['Armoured ambulance 4×4', 'Medical vehicle', 'Land', KINGDOM, 'Najran Armor Works', 2.6, 90],
  ['Tactical fuel tanker', 'Logistics vehicle', 'Land', KINGDOM, 'Tabuk Vehicle Systems Depot', 1.9, 210],
  ['Abrams track pad set', 'Vehicle spares', 'Land', 'Poland', 'Bydgoszcz Rubber Works', 0.07, 8200],
  ['Abrams vision block', 'Vehicle spares', 'Land', 'Poland', 'Wroclaw Armour Glass', 0.04, 2600],
  ['Abrams hydraulic seal kit', 'Vehicle spares', 'Land', 'Poland', 'Lodz Hydraulic Seals', 0.012, 9400],
  ['Road-wheel arm forging', 'Vehicle spares', 'Land', 'Poland', 'Stalowa Wola Forge', 0.09, 1900],
  ['M88A2 recovery vehicle', 'Recovery vehicle', 'Land', 'USA', 'Lima Armour Works', 26, 24],
  ['M2A3 Bradley', 'Infantry fighting vehicle', 'Land', 'USA', 'Lima Armour Works', 21, 110],
  ['Abrams 1,500 hp power pack', 'Vehicle engine', 'Land', 'USA', 'Atlantic Land Systems', 7.2, 40],
  ['Falke 2A7 main battle tank', 'Main battle tank', 'Land', 'Germany', 'Kassel Armour Works', 48, 18],
  ['Armoured recovery vehicle', 'Recovery vehicle', 'Land', 'Germany', 'Kassel Armour Works', 22, 6],
  ['Caesar 6×6 howitzer', 'Truck-mounted howitzer', 'Land', 'France', 'Roanne Artillery', 19, 76],
  ['K10 ammunition resupply vehicle', 'Ammunition vehicle', 'Land', 'South Korea', 'Changwon Defence Works', 12, 24],
  ['Konya 6×6 armoured truck', 'Armoured truck', 'Land', 'Türkiye', 'Konya Land Systems', 3.6, 160],
  ['Mine-clearing flail vehicle', 'Engineering vehicle', 'Land', 'Germany', 'Kassel Armour Works', 16, 8],
  ['Armour steel plate · tonnes', 'Armour material', 'Land', KINGDOM, 'Jubail Armor & Steel Works', 0.018, 3200],
  ['Tank transporter trailer', 'Logistics vehicle', 'Land', KINGDOM, 'Jubail Armor & Steel Works', 1.2, 120],

  ['Al-Jubail corvette', 'Corvette', 'Naval', 'Spain', 'Ferrol Naval Yards', 2100, 5],
  ['Multi-mission surface combatant', 'Frigate', 'Naval', 'USA', 'Marinette Shipworks', 4300, 2],
  ['Interceptor craft · 15 m', 'Interceptor boat', 'Naval', 'France', 'Cherbourg Marine', 14, 39],
  ['Hawar patrol craft spares', 'Naval spares', 'Naval', KINGDOM, 'Jeddah Naval Systems Yard', 0.6, 180],
  ['Mine-countermeasure drone', 'Naval UUV', 'Naval', 'UK', 'Bristol Naval Systems', 8, 12],
  ['76 mm naval gun', 'Naval gun', 'Naval', 'Italy', 'La Spezia Naval Guns', 36, 9],
  ['Rigid inflatable boat · 11 m', 'Patrol boat', 'Naval', KINGDOM, 'Jeddah Naval Systems Yard', 1.1, 64],
  ['Naval combat console', 'Naval electronics', 'Naval', KINGDOM, 'Riyadh Defense Electronics Park', 3.4, 28],
  ['Harbour patrol boat', 'Patrol boat', 'Naval', 'Türkiye', 'Izmir Shipyards', 6.2, 16],
  ['Submarine sonar array', 'Sonar', 'Naval', 'Germany', 'Ulm Sensor Systems', 44, 3],

  ['120 mm APFSDS tank round', 'Tank ammunition', 'Armament', KINGDOM, 'Qassim Munitions Works', 0.028, 36000],
  ['5.56 mm rifle ammunition · box', 'Small-arms ammunition', 'Armament', KINGDOM, 'Madinah Ordnance Works', 0.0019, 410000],
  ['7.62 mm machine-gun ammunition', 'Small-arms ammunition', 'Armament', KINGDOM, 'Madinah Ordnance Works', 0.0024, 220000],
  ['Madinah 5.56 assault rifle', 'Assault rifle', 'Armament', KINGDOM, 'Madinah Ordnance Works', 0.011, 64000],
  ['81 mm mortar bomb', 'Mortar ammunition', 'Armament', KINGDOM, 'Qassim Munitions Works', 0.004, 52000],
  ['81 mm mortar system', 'Mortar', 'Armament', KINGDOM, 'Al-Kharj Armament Complex', 0.19, 420],
  ['40 mm grenade', 'Grenade ammunition', 'Armament', KINGDOM, 'Qassim Munitions Works', 0.0011, 90000],
  ['Hand grenade', 'Grenade', 'Armament', KINGDOM, 'Madinah Ordnance Works', 0.0003, 150000],
  ['Propellant charge module', 'Propellant', 'Armament', KINGDOM, 'Al-Kharj Armament Complex', 0.003, 86000],
  ['12.7 mm heavy machine gun', 'Machine gun', 'Armament', KINGDOM, 'Al-Kharj Armament Complex', 0.09, 3100],
  ['PAC-3 MSE interceptor', 'Interceptor missile', 'Armament', 'USA', 'Tucson Missile Works', 24, 160],
  ['Laser-guided bomb kit', 'Guided bomb kit', 'Armament', 'USA', 'Tucson Missile Works', 0.9, 1200],
  ['Air-to-air missile', 'Air-to-air missile', 'Armament', 'USA', 'Tucson Missile Works', 5.8, 340],
  ['Hellfire-class missile', 'Anti-tank missile', 'Armament', 'USA', 'Tucson Missile Works', 0.6, 1800],
  ['Anti-ship missile', 'Anti-ship missile', 'Armament', 'France', 'Bourges Missile Systems', 8.5, 48],
  ['Anti-tank guided missile', 'Anti-tank missile', 'Armament', 'France', 'Bourges Missile Systems', 0.75, 1400],
  ['Short-range air-defence missile', 'Air-defence missile', 'Armament', 'UK', 'Stevenage Missile Works', 1.9, 420],
  ['155 mm DM121 shell', 'Artillery ammunition', 'Armament', 'Germany', 'Unterluss Munitions', 0.014, 42000],
  ['35 mm air-burst round', 'Air-defence ammunition', 'Armament', 'Germany', 'Unterluss Munitions', 0.0062, 30000],
  ['155 mm Konya shell', 'Artillery ammunition', 'Armament', 'Türkiye', 'Kirikkale Munitions', 0.011, 26000],
  ['Rocket motor casing', 'Missile subsystem', 'Armament', 'Poland', 'Mielec Composites', 0.45, 600],
  ['Precision mortar round', 'Guided mortar round', 'Armament', 'South Korea', 'Changwon Defence Works', 0.16, 2400],

  ['Tactical radio set', 'Radio', 'Electronics', KINGDOM, 'Riyadh Defense Electronics Park', 0.085, 18000],
  ['Counter-drone system', 'Counter-UAS', 'Electronics', KINGDOM, 'Al-Ahsa Electronics Assembly', 14, 26],
  ['Battlefield management terminal', 'C2 terminal', 'Electronics', KINGDOM, 'Riyadh Defense Electronics Park', 0.21, 3200],
  ['Thermal weapon sight', 'Optronics', 'Electronics', KINGDOM, 'Al-Ahsa Electronics Assembly', 0.045, 9800],
  ['Coastal surveillance radar', 'Surveillance radar', 'Electronics', 'South Korea', 'Gumi Electronics', 38, 8],
  ['Satellite comms terminal', 'SATCOM', 'Electronics', 'South Korea', 'Daejeon Satcom', 2.1, 140],
  ['Electronic warfare jammer', 'EW system', 'Electronics', 'Italy', 'Rome Electronic Systems', 22, 14],
  ['Radar warning receiver', 'EW system', 'Electronics', 'Italy', 'Rome Electronic Systems', 3.8, 70],
  ['EO/IR targeting pod', 'Targeting pod', 'Electronics', 'France', 'Elancourt Optronics', 18, 30],
  ['Night-vision goggles', 'Optronics', 'Electronics', 'USA', 'Orlando Optics', 0.06, 14000],
  ['IFF interrogator', 'Identification', 'Electronics', 'UK', 'Chelmsford Radar Systems', 1.4, 96],
  ['Counter-battery radar', 'Weapon-locating radar', 'Electronics', 'Germany', 'Ulm Sensor Systems', 62, 6],
  ['Inertial navigation unit', 'Navigation', 'Electronics', 'Poland', 'Gdansk Navigation Systems', 0.24, 880],
  ['Thermal camera core', 'Optronics', 'Electronics', 'Poland', 'Krakow Optronics Plant', 0.03, 2400],
  ['Li-ion battery pack', 'Power', 'Electronics', 'Poland', 'Rzeszow Propulsion Works', 0.008, 6200],
  ['Tactical data link radio', 'Data link', 'Electronics', 'USA', 'San Diego Datalink', 0.4, 2100],
  ['Ground surveillance radar', 'Surveillance radar', 'Electronics', 'China', 'Xi’an Electronics', 9.5, 16],
  ['Rugged mission computer', 'Mission computer', 'Electronics', KINGDOM, 'Riyadh Defense Electronics Park', 0.16, 1500],
]

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function fromRow([name, type, domain, country, maker, unitValue, units]: Row, index: number): Product {
  const local = country === KINGDOM
  const cutOff = country === 'Poland'
  const readiness = cutOff ? Math.round(52 + hash(index, 7) * 18) : Math.round(74 + hash(index, 3) * 24)
  const lead = local ? 1 + Math.round(hash(index, 5) * 7) : 6 + Math.round(hash(index, 5) * 14)
  const status: ProductStatus = cutOff ? 'Cut off' : readiness < 80 ? 'Low' : lead >= 15 ? 'Watch' : 'Healthy'
  return { id: slug(name), name, type, domain, source: local ? 'Local' : 'Imported', country, maker, units, unitValue, readiness, lead, status }
}

export const PRODUCTS: Product[] = [
  ...HEROES.map((hero): Product => ({ ...hero, source: hero.country === KINGDOM ? 'Local' : 'Imported' })),
  ...ROWS.map(fromRow),
]

export const PRODUCT_COUNTRIES = [...new Set(PRODUCTS.map((product) => product.country))].sort((a, b) =>
  a === KINGDOM ? -1 : b === KINGDOM ? 1 : a.localeCompare(b),
)

export type InventoryFilterId = 'source' | 'domain' | 'country' | 'status'
/** The value each inventory filter has picked; a missing one shows every product. */
export type InventoryPicks = Partial<Record<InventoryFilterId, string>>

/** The inventory page's filters, in the story's filter row; each narrows the product listing. */
export const INVENTORY_FILTERS: { id: InventoryFilterId; label: string; all: string; options: readonly string[] }[] = [
  { id: 'source', label: 'Source', all: 'Local and imported', options: ['Local', 'Imported'] },
  { id: 'domain', label: 'Domain', all: 'All domains', options: PRODUCT_DOMAINS },
  { id: 'country', label: 'Origin', all: 'All countries', options: PRODUCT_COUNTRIES },
  { id: 'status', label: 'Status', all: 'Any status', options: PRODUCT_STATUSES },
]

export const productValue = (product: Product) => product.units * product.unitValue

/** SAR millions as the listing reads it: 'SAR 1.2bn', 'SAR 340m' or 'SAR 90k'. */
export function sar(millions: number) {
  if (millions >= 1000) return `SAR ${(millions / 1000).toFixed(1)}bn`
  if (millions >= 1) return `SAR ${Math.round(millions)}m`
  return `SAR ${Math.round(millions * 1000)}k`
}

const sum = (items: Product[], read: (product: Product) => number) => items.reduce((total, item) => total + read(item), 0)
const bn = (millions: number) => Math.round(millions / 100) / 10

/* —— The dashboard —— */

const TOTAL = sum(PRODUCTS, productValue)
const LOCAL = PRODUCTS.filter((product) => product.source === 'Local')
const IMPORTED = PRODUCTS.filter((product) => product.source === 'Imported')
const CUT_OFF = PRODUCTS.filter((product) => product.status === 'Cut off')
const READINESS = Math.round(sum(PRODUCTS, (item) => item.readiness * productValue(item)) / TOTAL)
const LOCAL_SHARE = Math.round((sum(LOCAL, productValue) / TOTAL) * 100)

/** The listing's headline figures, as the dashboard and the Briefing finding read them. */
export const INVENTORY_TOTALS = {
  products: PRODUCTS.length,
  valueBn: bn(TOTAL),
  localShare: LOCAL_SHARE,
  readiness: READINESS,
  cutOff: CUT_OFF.length,
  maxLead: Math.max(...IMPORTED.map((product) => product.lead)),
  byStatus: PRODUCT_STATUSES.map((status) => ({ status, count: PRODUCTS.filter((product) => product.status === status).length })),
}

/** SAR millions held from each country, largest first. */
export function valueByOrigin() {
  const values = new Map<string, number>()
  for (const product of PRODUCTS) values.set(product.country, (values.get(product.country) ?? 0) + productValue(product))
  return [...values.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * The inventory app's one page: the product listing docked on the right, seven rows tall, beside a two-cell
 * column of the summary, headline cells and three charts.
 */
export function inventoryCards(): GamiCard[] {
  const countries = valueByOrigin()
  const statusCounts = PRODUCT_STATUSES.map((status) => PRODUCTS.filter((product) => product.status === status).length)
  const value = bn(TOTAL)
  const growth = [0.9, 0.92, 0.94, 0.95, 0.98, 1]
  return [
    {
      id: 'summary',
      kind: 'summary',
      title: 'Llumen AI Summary',
      cols: 2,
      parts: [
        `The sector holds ${PRODUCTS.length} products worth SAR ${value}bn, `,
        { em: [`${LOCAL_SHARE}% of it made in the Kingdom`] },
        `. Readiness averages ${READINESS}%. `,
        { em: [`${CUT_OFF.length} products from Poland are cut off`] },
        `, and imported lead times run up to ${INVENTORY_TOTALS.maxLead} months.`,
      ],
    },
    { id: 'products', kind: 'cell', title: 'Products', value: String(PRODUCTS.length), note: `${IMPORTED.length} imported · ${LOCAL.length} local` },
    { id: 'value', kind: 'cell', title: 'Inventory value', value: `SAR ${value}bn`, note: 'Across 5 domains', spark: growth.map((g) => g * value) },
    { id: 'readiness', kind: 'cell', title: 'Readiness', value: `${READINESS}%`, note: 'Weighted by value', status: 'mild', spark: [89, 89, 88, 88, 87, 86, READINESS] },
    { id: 'cut-off', kind: 'cell', title: 'Cut off', value: String(CUT_OFF.length), note: 'All from Poland', status: 'critical', spark: [0, 0, 0, 0, CUT_OFF.length, CUT_OFF.length] },
    { id: 'avg-lead', kind: 'cell', title: 'Imported lead time', value: `${Math.round(sum(IMPORTED, (item) => item.lead) / IMPORTED.length)} mo`, note: 'Average, order to delivery' },
    { id: 'local-content', kind: 'cell', title: 'Local content', value: `${LOCAL_SHARE}%`, note: 'Of inventory value, 2030 goal 50%' },
    {
      id: 'status',
      kind: 'donut',
      title: 'Products by Status',
      total: String(PRODUCTS.length),
      totalLabel: 'products',
      slices: PRODUCT_STATUSES.map((status, index) => ({ name: status, value: statusCounts[index], status: PRODUCT_STATUS[status] })),
    },
    {
      id: 'domains',
      kind: 'donut',
      title: 'Value by Domain',
      total: `${value}bn`,
      totalLabel: 'SAR',
      slices: PRODUCT_DOMAINS.map((domain) => ({
        name: domain,
        value: bn(sum(PRODUCTS.filter((product) => product.domain === domain), productValue)),
      })),
    },
    {
      id: 'origins',
      kind: 'hbars',
      title: 'Value by Origin',
      bars: countries.slice(0, 6).map(([country, total]) => ({
        label: country === KINGDOM ? 'Kingdom' : country,
        value: total,
        display: sar(total),
        status: country === 'Poland' ? 'critical' : undefined,
      })),
    },
    { id: 'listing', kind: 'inventory', title: `All Products · ${PRODUCTS.length}`, dock: true, height: 7 },
  ]
}

/* —— A product's details —— */

const DEPOTS = ['Riyadh', 'Tabuk', 'Khamis Mushait', 'Jeddah', 'Dhahran']
const YEARS = ['2023', '2024', '2025', '2026', '2027']
const STOCK_MONTHS = ['Nov', 'Jan', 'Mar', 'May', 'Jul', 'Sep']

const units = (count: number) => (count >= 10000 ? `${Math.round(count / 1000)}k` : count.toLocaleString('en-US'))

/** The two views of a product with details: the product itself, then its stock and supply chain. */
export function productViews(product: Product): [AssetModalView, AssetModalView] {
  const detail = product.detail!
  const seed = product.id.length * 7
  const ready = Math.round((product.units * product.readiness) / 100)
  const blocked = detail.supply.filter((row) => row[3] === 'Cut off').length
  const parts = Math.round(((product.units - ready) * (blocked ? 0.6 : 0.3)))
  const maintenance = product.units - ready - parts
  const quarters = ['Q4 25', 'Q1', 'Q2', 'Q3', 'Q4']
  const perQuarter = Math.max(1, Math.round(product.units / 10))
  const target = Math.round(product.units * 1.1)
  const stockLine = STOCK_MONTHS.map((_, i) => Math.round(product.units * (0.92 + i * 0.02 - (blocked ? i * 0.025 : 0) + hash(i, seed) * 0.02)))
  const yMax = Math.ceil((target * 1.2) / 10 ** Math.floor(Math.log10(target))) * 10 ** Math.floor(Math.log10(target))
  const local = product.source === 'Local'
  const depotShares = DEPOTS.map((_, i) => 0.3 + hash(i, seed + 2))
  const shareTotal = depotShares.reduce((a, b) => a + b, 0)
  const orders = YEARS.map((_, i) => Math.round(perQuarter * (2 + hash(i, seed + 4) * 4)))
  const accent = '#a8c9fa'

  const productCards: GamiCard[] = [
    { id: 'model', kind: 'model', title: product.name, cols: 2, height: 2, model: detail.model, accent },
    { id: 'units', kind: 'cell', title: 'In stock', value: units(product.units), note: product.type },
    {
      id: 'readiness',
      kind: 'cell',
      title: 'Readiness',
      value: `${product.readiness}%`,
      note: `${units(ready)} ready for use`,
      status: product.readiness < 85 ? 'moderate' : 'good',
    },
    { id: 'value', kind: 'cell', title: 'Inventory value', value: sar(productValue(product)), note: `${sar(product.unitValue)} a unit` },
    {
      id: 'lead',
      kind: 'cell',
      title: 'Lead time',
      value: `${product.lead} mo`,
      note: local ? 'Made in the Kingdom' : `From ${product.country}`,
      status: product.lead >= 15 ? 'moderate' : undefined,
    },
    {
      id: 'in-service',
      kind: 'line',
      title: 'Ready for Use, 2026',
      kpi: { value: `${product.readiness}`, unit: '% ready' },
      x: STOCK_MONTHS,
      yLabels: ['100%', '50%', '0'],
      yMax: 100,
      series: [
        { name: 'Ready', points: STOCK_MONTHS.map((_, i) => Math.round(product.readiness + (5 - i) * 0.8 - hash(i, seed) * 2)) },
        { name: 'Target', points: STOCK_MONTHS.map(() => 90), dashed: true },
      ],
    },
    {
      id: 'deliveries',
      kind: 'vbars',
      title: 'Deliveries by Quarter',
      kpi: { value: units(perQuarter), unit: 'a quarter' },
      bars: quarters.map((label, i) => {
        const count = Math.round(perQuarter * (0.7 + hash(i, seed + 1) * 0.6) * (blocked && i >= 3 ? 0.4 : 1))
        return { label, value: count, display: units(count), status: blocked && i >= 3 ? ('critical' as const) : undefined }
      }),
    },
    { id: 'specs', kind: 'specs', title: 'Specifications', height: 2, items: detail.specs },
    {
      id: 'fleet',
      kind: 'donut',
      title: 'Units by State',
      height: 2,
      total: units(product.units),
      totalLabel: 'units',
      slices: [
        { name: 'Ready', value: ready, status: 'good' },
        { name: 'In maintenance', value: maintenance, status: 'mild' },
        { name: 'Awaiting parts', value: parts, status: 'critical' },
      ],
    },
    { id: 'about', kind: 'note', title: 'About', text: detail.about },
    {
      id: 'sustainment',
      kind: 'progress',
      title: 'Sustainment',
      rows: [
        { label: 'Spares cover', value: `${Math.round(70 + hash(1, seed) * 25)}%`, target: '100%', pct: 70 + hash(1, seed) * 25 },
        { label: 'Trained crews', value: `${Math.round(80 + hash(2, seed) * 18)}%`, target: '100%', pct: 80 + hash(2, seed) * 18 },
      ],
    },
  ]

  const supplyCards: GamiCard[] = [
    { id: 'origin', kind: 'cell', title: 'Made in', value: local ? 'Kingdom' : product.country, note: product.maker },
    { id: 'local-content', kind: 'cell', title: 'Local content', value: detail.specs.find(([label]) => label === 'Local content')?.[1] ?? `${local ? 70 : Math.round(8 + hash(3, seed) * 20)}%`, note: 'Of the unit’s value' },
    { id: 'orders', kind: 'cell', title: 'Open orders', value: units(orders[3]), note: `${sar(orders[3] * product.unitValue)} on order` },
    {
      id: 'blocked',
      kind: 'cell',
      title: 'Blocked components',
      value: String(blocked),
      note: blocked ? 'Exports from Poland suspended' : 'Every supplier delivering',
      status: blocked ? 'critical' : 'good',
    },
    {
      id: 'supply',
      kind: 'table',
      title: 'Supply Chain',
      cols: 4,
      columns: ['Component', 'From', 'Lead time', 'Status'],
      statusColumn: 3,
      rows: detail.supply.map(([component, from, lead, status]) => ({ cells: [component, from, lead, status], status: PRODUCT_STATUS[status] })),
    },
    {
      id: 'depots',
      kind: 'hbars',
      title: 'Stock by Depot',
      height: 2,
      bars: DEPOTS.map((depot, i) => {
        const count = Math.round((product.units * depotShares[i]) / shareTotal)
        return { label: depot, value: count, display: units(count) }
      }),
    },
    {
      id: 'stock',
      kind: 'line',
      title: 'Units in Stock vs Target',
      cols: 4,
      height: 2,
      kpi: { value: units(product.units), unit: `units, target ${units(target)}` },
      x: STOCK_MONTHS,
      yLabels: [units(yMax), units(yMax / 2), '0'],
      yMax,
      series: [
        { name: 'In stock', points: stockLine, status: blocked ? 'critical' : undefined },
        { name: 'Target', points: STOCK_MONTHS.map(() => target), dashed: true },
      ],
    },
    {
      id: 'orders-by-year',
      kind: 'vbars',
      title: 'Units Ordered by Year',
      height: 2,
      bars: YEARS.map((label, i) => ({ label, value: orders[i], display: units(orders[i]) })),
    },
  ]

  return [
    { id: 'product', label: 'The product', cards: productCards },
    { id: 'supply', label: 'Stock & supply', cards: supplyCards },
  ]
}
