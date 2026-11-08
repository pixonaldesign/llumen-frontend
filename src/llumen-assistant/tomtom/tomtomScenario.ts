/**
 * The TomTom demo: where to open the next fuel station on Abu Dhabi Island. Twelve candidate sites
 * along the island's arterials, scored on passing traffic, catchment, competition and access, against
 * the network's eight stations and the rivals around them. Fences on the arterials rise and redden with
 * their traffic. Sites are pinned on the map; the shortlisted ones open a details panel when clicked.
 */
import { along, distanceKm, hash, resample, type LngLat } from './tomtomGeo'
import {
  EMPTY_SCENE,
  type TomtomDisk,
  type TomtomFence,
  type TomtomMapScene,
  type TomtomPart,
  type TomtomPin,
  type TomtomZone,
} from './tomtomMapLayers'
import {
  PALETTE,
  type CountRow,
  type MapDataLayer,
  type SiteId,
  type SiteTab,
  type SiteTabId,
  type TomtomCamera,
  type TomtomCard,
  type TomtomPlaceId,
  type TomtomSite,
  type TomtomStory,
  type Tone,
} from './tomtomTypes'

/* —— The island's arterials: centrelines traced from the basemap's road network —— */

type StreetId = 'corniche' | 'falah' | 'hazza' | 'khaleej' | 'mbk' | 'muroor' | 'rashid' | 'szbs'

const STREETS: Record<StreetId, LngLat[]> = {
  corniche: [
    [54.3221, 24.46117], [54.32458, 24.46323], [54.34135, 24.4733], [54.34382, 24.4755], [54.34505, 24.47711],
    [54.34537, 24.47819], [54.35035, 24.48802], [54.35119, 24.48916], [54.35248, 24.49094], [54.35398, 24.49201],
    [54.35713, 24.49455], [54.35861, 24.49553], [54.361, 24.49697], [54.36297, 24.4989], [54.36447, 24.5],
    [54.36552, 24.50095], [54.37469, 24.5098], [54.37623, 24.51156], [54.37712, 24.51253], [54.3779, 24.51637],
  ],
  falah: [[54.34592, 24.45999], [54.34899, 24.46261], [54.36514, 24.47558], [54.38288, 24.48812], [54.38635, 24.4906]],
  hazza: [
    [54.34701, 24.44903], [54.34993, 24.4516], [54.35084, 24.45241], [54.35539, 24.45648], [54.36164, 24.46205],
    [54.37064, 24.47016], [54.37531, 24.47353], [54.38166, 24.47803], [54.38417, 24.47923], [54.39262, 24.48294],
    [54.39512, 24.48498], [54.39609, 24.48778], [54.3969, 24.49369],
  ],
  khaleej: [
    [54.34088, 24.47308], [54.34349, 24.46956], [54.34621, 24.46656], [54.34717, 24.46573], [54.35001, 24.46244],
    [54.35151, 24.46094], [54.35797, 24.4548], [54.35954, 24.45326], [54.36206, 24.44965], [54.36677, 24.44465],
    [54.37216, 24.43915], [54.37652, 24.43488], [54.37866, 24.43306], [54.38127, 24.43199], [54.38724, 24.43056],
    [54.39022, 24.43011], [54.40155, 24.42683], [54.40704, 24.42533], [54.42697, 24.41982],
  ],
  mbk: [
    [54.35848, 24.43886], [54.36087, 24.44075], [54.3617, 24.44148], [54.36588, 24.44471], [54.3667, 24.44545],
    [54.36908, 24.44729], [54.3697, 24.44775], [54.37238, 24.44989], [54.37298, 24.45033], [54.37471, 24.4518],
    [54.37738, 24.45385], [54.38709, 24.46152], [54.3892, 24.46326], [54.3895, 24.46352], [54.39187, 24.46545],
    [54.39381, 24.46703],
  ],
  muroor: [
    [54.35857, 24.4955], [54.3634, 24.48986], [54.36486, 24.48719], [54.36968, 24.47966], [54.37606, 24.47326],
    [54.39816, 24.44965], [54.40155, 24.44607], [54.40352, 24.44399], [54.40632, 24.4418], [54.42036, 24.43617],
    [54.42419, 24.43499],
  ],
  rashid: [
    [54.35287, 24.48986], [54.35656, 24.48581], [54.35961, 24.48231], [54.36206, 24.47952], [54.36539, 24.47575],
    [54.368, 24.47304], [54.3822, 24.45711], [54.38609, 24.45369], [54.39009, 24.44965], [54.3948, 24.44465],
    [54.3993, 24.43979], [54.40151, 24.43808], [54.40527, 24.43602], [54.42058, 24.42998], [54.42422, 24.42916],
  ],
  szbs: [
    [54.36526, 24.49924], [54.37038, 24.4992], [54.37182, 24.49815], [54.37589, 24.4933], [54.38011, 24.48795],
    [54.38069, 24.4876], [54.38262, 24.48523], [54.38448, 24.48366], [54.38625, 24.48129], [54.38718, 24.47994],
    [54.38953, 24.47709], [54.39063, 24.47561], [54.39174, 24.47237], [54.39415, 24.46932], [54.3955, 24.46723],
    [54.40155, 24.45791], [54.40601, 24.45104], [54.4073, 24.44972], [54.40946, 24.44822], [54.41983, 24.44428],
    [54.42362, 24.44349],
  ],
}

const STREET_IDS = Object.keys(STREETS) as StreetId[]

export const STREET_NAMES: Record<StreetId, string> = {
  corniche: 'Corniche Rd',
  falah: 'Al Falah St',
  hazza: 'Hazza Bin Zayed The First St',
  khaleej: 'Al Khaleej Al Arabi St',
  mbk: 'Mohammed Bin Khalifa St',
  muroor: 'Sultan Bin Zayed The First St',
  rashid: 'Sheikh Rashid Bin Saeed St',
  szbs: 'Sheikh Zayed Bin Sultan St',
}

/* —— Colours —— */

export const SITE_COLOR = PALETTE.teal[2]
export const STATION_COLOR = PALETTE.blue[3]
/** Rivals in orange, as the TomTom reference marks competitors; the palette has no orange of its own. */
export const RIVAL_COLOR = '#f5a04a'
/** A site's catchment disk: green, apart from the teal of the site itself. */
export const CATCHMENT_COLOR = PALETTE.categorical[3]
/** Traffic density on a street, lighter to heavier: green, the warning yellow, red, dark red. */
const TRAFFIC_RAMP = [PALETTE.categorical[3], '#fbc155', PALETTE.diverging[1], PALETTE.diverging[0]]

/* —— Candidate sites —— */

type SiteSpec = {
  id: string
  area: string
  street: StreetId
  /** Where along the street (0–1), and how far off its centreline to the right. */
  t: number
  side: number
  /** 0–100 over the whole day: traffic, catchment, competition and access together. */
  score: number
  /** The same score counting only 5 to 9pm. */
  evening: number
  /** Thousand vehicles past the site a day. */
  traffic: number
  /** Share of the day's traffic between 5 and 9pm, %. */
  eveningShare: number
  /** Projected fuel sold, million litres a year. */
  volume: number
  /** Residents within a 5-minute drive. */
  residents: number
  /** Share of that catchment your stations already reach in 5 minutes, %. */
  overlap: number
}

const SITE_SPECS: SiteSpec[] = [
  { id: 'site-szbs', area: 'Al Zahiyah', street: 'szbs', t: 0.3, side: 0.05, score: 87, evening: 89, traffic: 48.2, eveningShare: 31, volume: 9.8, residents: 38400, overlap: 6 },
  { id: 'site-corniche', area: 'Al Khalidiyah', street: 'corniche', t: 0.55, side: 0.06, score: 81, evening: 76, traffic: 52.6, eveningShare: 24, volume: 8.9, residents: 31200, overlap: 22 },
  { id: 'site-khaleej', area: 'Al Bateen', street: 'khaleej', t: 0.3, side: 0.05, score: 78, evening: 84, traffic: 41.8, eveningShare: 36, volume: 8.1, residents: 42600, overlap: 9 },
  { id: 'site-rashid', area: 'Al Markaziyah', street: 'rashid', t: 0.14, side: 0.04, score: 74, evening: 80, traffic: 39.5, eveningShare: 38, volume: 7.6, residents: 46900, overlap: 7 },
  { id: 'site-hazza', area: 'Al Manhal', street: 'hazza', t: 0.4, side: 0.05, score: 71, evening: 70, traffic: 36.1, eveningShare: 29, volume: 7.0, residents: 36800, overlap: 8 },
  { id: 'site-muroor', area: 'Al Nahyan', street: 'muroor', t: 0.45, side: 0.05, score: 66, evening: 68, traffic: 33.9, eveningShare: 32, volume: 6.5, residents: 33500, overlap: 5 },
  { id: 'site-falah', area: 'Madinat Zayed', street: 'falah', t: 0.75, side: 0.05, score: 62, evening: 65, traffic: 30.2, eveningShare: 33, volume: 6.0, residents: 29800, overlap: 4 },
  { id: 'site-mbk', area: 'Al Mushrif', street: 'mbk', t: 0.5, side: 0.05, score: 58, evening: 55, traffic: 28.4, eveningShare: 26, volume: 5.6, residents: 27100, overlap: 9 },
  { id: 'site-corniche-w', area: 'Al Bateen Corniche', street: 'corniche', t: 0.2, side: 0.06, score: 54, evening: 50, traffic: 26.1, eveningShare: 22, volume: 5.2, residents: 24600, overlap: 8 },
  { id: 'site-khaleej-e', area: 'Al Karamah', street: 'khaleej', t: 0.62, side: 0.05, score: 49, evening: 52, traffic: 24.8, eveningShare: 30, volume: 4.8, residents: 22900, overlap: 3 },
  { id: 'site-rashid-s', area: 'Al Rowdah', street: 'rashid', t: 0.72, side: 0.05, score: 45, evening: 47, traffic: 22.3, eveningShare: 31, volume: 4.4, residents: 21400, overlap: 6 },
  { id: 'site-hazza-s', area: 'Al Khubeirah', street: 'hazza', t: 0.12, side: 0.05, score: 41, evening: 38, traffic: 19.6, eveningShare: 23, volume: 3.9, residents: 18700, overlap: 2 },
]

type Placed<T> = T & { at: LngLat }

const place = <T extends { street: StreetId; t: number; side: number }>(spec: T): Placed<T> => ({
  ...spec,
  at: along(STREETS[spec.street], spec.t, spec.side),
})

const CANDIDATES = SITE_SPECS.map(place)

/* —— The network's stations —— */

type StationSpec = { id: string; area: string; street: StreetId; t: number; side: number; volume: number }

const STATION_SPECS: StationSpec[] = [
  { id: 'st-wahda', area: 'Al Wahda', street: 'muroor', t: 0.2, side: 0.05, volume: 7.1 },
  { id: 'st-khalidiyah', area: 'Khalidiyah Park', street: 'corniche', t: 0.36, side: 0.35, volume: 6.8 },
  { id: 'st-tourist-club', area: 'Tourist Club', street: 'corniche', t: 0.93, side: 0.2, volume: 6.4 },
  { id: 'st-mushrif', area: 'Mushrif Park', street: 'rashid', t: 0.5, side: 0.05, volume: 6.3 },
  { id: 'st-danah', area: 'Al Danah', street: 'szbs', t: 0.1, side: 0.06, volume: 6.0 },
  { id: 'st-bateen', area: 'Bateen Marina', street: 'khaleej', t: 0.1, side: 0.25, volume: 5.9 },
  { id: 'st-nahyan', area: 'Nahyan Camp', street: 'muroor', t: 0.7, side: 0.05, volume: 5.7 },
  { id: 'st-karamah', area: 'Karamah Square', street: 'mbk', t: 0.2, side: 0.05, volume: 5.4 },
]

const STATIONS = STATION_SPECS.map(place)

/** Fuel the average station sells, million litres a year. */
export const NETWORK_AVERAGE = STATIONS.reduce((sum, station) => sum + station.volume, 0) / STATIONS.length

/* —— Rival forecourts: spread along the arterials, clear of the sites and each other —— */

type Rival = { id: string; at: LngLat; street: StreetId }

const RIVALS: Rival[] = (() => {
  const out: Rival[] = []
  for (let index = 0; out.length < 24 && index < 400; index += 1) {
    const street = STREET_IDS[index % STREET_IDS.length]
    const t = 0.06 + 0.88 * hash(index, 41)
    /* The sea runs along the Corniche's left and Sheikh Zayed Bin Sultan St's left. */
    const left = street !== 'corniche' && street !== 'szbs' && hash(index, 43) > 0.5
    const at = along(STREETS[street], t, left ? -0.05 : 0.05)
    const clear =
      CANDIDATES.every((site) => distanceKm(site.at, at) > 0.75) &&
      STATIONS.every((station) => distanceKm(station.at, at) > 0.5) &&
      out.every((rival) => distanceKm(rival.at, at) > 0.6)
    if (clear) out.push({ id: `rival-${out.length + 1}`, at, street })
  }
  return out
})()

export const RIVAL_COUNT = RIVALS.length

const nearest = (at: LngLat, points: { at: LngLat }[]) => Math.min(...points.map((point) => distanceKm(point.at, at)))
const km = (value: number) => `${value.toFixed(1)} km`

/** Each candidate with how far its nearest rival and nearest of the network's stations are. */
const SITES = CANDIDATES.map((site) => ({
  ...site,
  rivalKm: nearest(site.at, RIVALS),
  stationKm: nearest(site.at, STATIONS),
  rivalsWithin3: RIVALS.filter((rival) => distanceKm(rival.at, site.at) <= 3).length,
}))

type Site = (typeof SITES)[number]

const byScore = [...SITES].sort((a, b) => b.score - a.score)
const byEvening = [...SITES].sort((a, b) => b.evening - a.evening)
const rankOf = (site: Site) => byScore.indexOf(site) + 1
const eveningRankOf = (site: Site) => byEvening.indexOf(site) + 1
const siteById = (id: string) => SITES.find((site) => site.id === id)!

/** The candidates best first over the whole day, as the replies rank them. */
export const SITE_RANKING = byScore.map((site) => ({
  id: site.id,
  name: site.area,
  street: STREET_NAMES[site.street],
  score: site.score,
  evening: site.evening,
  traffic: site.traffic,
  eveningShare: site.eveningShare,
  volume: site.volume,
  residents: site.residents,
  overlap: site.overlap,
  rivalKm: site.rivalKm,
  stationKm: site.stationKm,
}))

/** The same, ranked on 5 to 9pm. */
export const EVENING_RANKING = byEvening.map((site) => SITE_RANKING.find((entry) => entry.id === site.id)!)

/* —— Map groups —— */

const SITES_GROUP = 'sites'
const STATIONS_GROUP = 'stations'
const RIVALS_GROUP = 'rivals'
const TRAFFIC_GROUP = 'traffic'
const TRADE_GROUP = 'trade'
const CATCHMENT_GROUP = 'catchment'

/** The part of a scene each group comes in with, when an answer brings the scene in part by part. */
export const GROUP_PART: Record<string, TomtomPart> = {
  [SITES_GROUP]: 'pins',
  [STATIONS_GROUP]: 'pins',
  [TRAFFIC_GROUP]: 'fences',
  [RIVALS_GROUP]: 'rivals',
  [TRADE_GROUP]: 'rivals',
  [CATCHMENT_GROUP]: 'zones',
}

const thousands = (value: number) => `${(value / 1000).toFixed(1)}k`

/** A candidate carries its name; its figures show on hover. */
function sitePin(site: Site, rank: number, evening = false): TomtomPin {
  const score = evening ? site.evening : site.score
  return {
    id: site.id,
    at: site.at,
    color: SITE_COLOR,
    kind: 'site',
    rank,
    title: site.area,
    tip: {
      title: `${site.area} · Site ${rank}`,
      rows: [
        ['Street', STREET_NAMES[site.street]],
        [evening ? 'Score, 5–9pm' : 'Score', `${score} of 100`],
        evening
          ? ['Traffic, 5–9pm', `${Math.round(site.traffic * site.eveningShare * 10).toLocaleString('en-US')} vehicles`]
          : ['Passing traffic', `${site.traffic.toFixed(1)}k a day`],
        ['Catchment, 5 min', `${thousands(site.residents)} residents`],
        ['Nearest rival', km(site.rivalKm)],
      ],
    },
    group: SITES_GROUP,
  }
}

/** A station is a dot; its name and figures show on hover. */
function stationPin(station: (typeof STATIONS)[number]): TomtomPin {
  return {
    id: station.id,
    at: station.at,
    color: STATION_COLOR,
    kind: 'station',
    title: `${station.area} station`,
    tip: {
      title: `${station.area} station`,
      rows: [
        ['Street', STREET_NAMES[station.street]],
        ['Fuel sold', `${station.volume.toFixed(1)}M litres a year`],
        ['Nearest candidate', km(nearest(station.at, SITES))],
      ],
    },
    group: STATIONS_GROUP,
  }
}

/** A rival forecourt is a small orange dot; its figures show on hover. */
function rivalPin(rival: Rival): TomtomPin {
  const number = Number(rival.id.slice(6))
  return {
    id: rival.id,
    at: rival.at,
    color: RIVAL_COLOR,
    kind: 'rival',
    title: `Rival ${number}`,
    tip: {
      title: `Rival forecourt ${number}`,
      rows: [
        ['Street', STREET_NAMES[rival.street]],
        ['Open', hash(number, 3) > 0.4 ? '24 hours' : '6am – midnight'],
        ['Nearest candidate', km(nearest(rival.at, SITES))],
      ],
    },
    group: RIVALS_GROUP,
  }
}

const ALL_DAY_LOAD: Record<StreetId, number> = { szbs: 0.9, corniche: 0.86, muroor: 0.78, khaleej: 0.72, rashid: 0.68, hazza: 0.58, mbk: 0.52, falah: 0.48 }
const EVENING_LOAD: Record<StreetId, number> = { szbs: 0.94, khaleej: 0.9, rashid: 0.88, muroor: 0.74, falah: 0.62, corniche: 0.56, hazza: 0.54, mbk: 0.42 }

/** Each street's centreline every 25 m, so a fence's top runs smooth. */
const STREET_POINTS = Object.fromEntries(STREET_IDS.map((street) => [street, resample(STREETS[street], 0.025)])) as Record<
  StreetId,
  LngLat[]
>

/**
 * Traffic at each of `street`'s points (0–1): its `base` load, swelling at a few busy junctions and past
 * the sites on it, and easing off towards its ends.
 */
function streetLoad(street: StreetId, base: number, seed: number) {
  const points = STREET_POINTS[street]
  const swells = [
    ...[0, 1, 2].map((k) => ({ at: 0.1 + 0.8 * hash(k, seed), width: 0.05 + 0.08 * hash(k, seed + 1), lift: 0.1 + 0.3 * hash(k, seed + 2) })),
    ...SITES.filter((site) => site.street === street).map((site) => ({ at: site.t, width: 0.06, lift: site.traffic / 90 })),
  ]
  return points.map((_, index) => {
    const t = index / (points.length - 1)
    const swell = swells.reduce((sum, { at, width, lift }) => sum + lift * Math.exp(-(((t - at) / width) ** 2)), 0)
    const ends = Math.min(1, t / 0.08, (1 - t) / 0.08)
    return Math.max(0.04, Math.min(1, base ** 2 * (0.3 + swell) * (0.45 + 0.55 * ends)))
  })
}

/** A fence on each of `streets`, as tall as `heightM` where the traffic is heaviest. */
function roadFences(load: Record<StreetId, number>, seed: number, heightM: number, evening = false, streets: StreetId[] = STREET_IDS): TomtomFence[] {
  return streets.map((street) => ({
    id: `${street}-traffic`,
    path: STREET_POINTS[street],
    load: streetLoad(street, load[street], seed + STREET_IDS.indexOf(street) * 7),
    heightM,
    ramp: TRAFFIC_RAMP,
    vph: evening ? [900, 4200] : [700, 2800],
    unit: evening ? 'vehicles an hour, 5–9pm' : 'vehicles an hour',
    title: STREET_NAMES[street],
    group: TRAFFIC_GROUP,
  }))
}

/** A site's catchment: a disk round it, as wide as the residents within a 5-minute drive call for. */
function catchmentDisk(site: Site): TomtomZone {
  const kLng = 111320 * Math.cos((site.at[1] * Math.PI) / 180)
  const kLat = 110800
  const radiusM = 220 + site.residents * 0.008
  const ring = Array.from({ length: 73 }, (_, index): LngLat => {
    const angle = ((index % 72) / 72) * Math.PI * 2
    return [site.at[0] + (Math.cos(angle) * radiusM) / kLng, site.at[1] + (Math.sin(angle) * radiusM) / kLat]
  })
  return {
    id: `${site.id}-catchment`,
    at: site.at,
    ring,
    color: CATCHMENT_COLOR,
    tip: {
      title: `${site.area} catchment`,
      rows: [
        ['Drive time', 'Up to 5 minutes'],
        ['Residents', site.residents.toLocaleString('en-US')],
        ['Households', Math.round(site.residents / 3.6).toLocaleString('en-US')],
        ['Shared with your stations', `${site.overlap}%`],
      ],
    },
    group: CATCHMENT_GROUP,
  }
}

const scene = (parts: Partial<TomtomMapScene>): TomtomMapScene => ({ ...EMPTY_SCENE, ...parts })

/** The whole island: every candidate and its catchment, the network's stations, the rivals and the day's traffic. */
const ISLAND_SCENE = scene({
  pins: [
    ...byScore.map((site, index) => sitePin(site, index + 1)),
    ...STATIONS.map((station) => stationPin(station)),
    ...RIVALS.map(rivalPin),
  ],
  fences: roadFences(ALL_DAY_LOAD, 5, 320),
  zones: SITES.map(catchmentDisk),
})

const SZBS = siteById('site-szbs')
const RASHID = siteById('site-rashid')

const closest = <T extends { at: LngLat }>(at: LngLat, points: T[], count: number) =>
  [...points].sort((a, b) => distanceKm(a.at, at) - distanceKm(b.at, at)).slice(0, count)

const SZBS_RIVALS = closest(SZBS.at, RIVALS, 4)

/** Site 1 close up: its catchment, the traffic past it, its neighbouring candidates, nearest rivals and your nearest stations. */
const SZBS_SCENE = scene({
  pins: [
    sitePin(SZBS, 1),
    ...closest(SZBS.at, SITES.filter((site) => site !== SZBS), 2).map((site) => sitePin(site, rankOf(site))),
    ...closest(SZBS.at, STATIONS, 2).map((station) => stationPin(station)),
    ...SZBS_RIVALS.map(rivalPin),
  ],
  fences: roadFences(ALL_DAY_LOAD, 5, 130, false, ['szbs', 'muroor', 'hazza', 'falah', 'rashid']),
  zones: [catchmentDisk(SZBS)],
})

/** Evening: the island re-ranked on 5 to 9pm, and the evening's traffic. */
const EVENING_SCENE = scene({
  pins: [
    ...byEvening.map((site, index) => sitePin(site, index + 1, true)),
    ...STATIONS.map((station) => stationPin(station)),
    ...RIVALS.map(rivalPin),
  ],
  fences: roadFences(EVENING_LOAD, 13, 320, true),
  zones: SITES.map(catchmentDisk),
})

const CORRIDOR_STREETS: StreetId[] = ['rashid', 'falah', 'muroor', 'corniche', 'hazza']
const CORRIDOR_RIVALS = closest(RASHID.at, RIVALS, 5)

/** Sheikh Rashid Bin Saeed St between 5 and 9pm: the corridor's traffic, and the site on it. */
const CORRIDOR_SCENE = scene({
  pins: [
    ...closest(RASHID.at, SITES, 3).map((site) => sitePin(site, eveningRankOf(site), true)),
    ...closest(RASHID.at, STATIONS, 2).map((station) => stationPin(station)),
    ...CORRIDOR_RIVALS.map(rivalPin),
  ],
  fences: roadFences(EVENING_LOAD, 13, 120, true, CORRIDOR_STREETS),
  zones: [catchmentDisk(RASHID)],
})

/** The rivals' trade areas round the corridor, and the gap the site fills. */
const TRADE_SCENE = scene({
  pins: [
    sitePin(RASHID, eveningRankOf(RASHID), true),
    ...closest(RASHID.at, STATIONS, 2).map((station) => stationPin(station)),
    ...CORRIDOR_RIVALS.map(rivalPin),
  ],
  fences: roadFences(EVENING_LOAD, 13, 160, true, CORRIDOR_STREETS),
  disks: CORRIDOR_RIVALS.map((rival): TomtomDisk => ({ id: `${rival.id}-trade`, at: rival.at, radiusM: 480, color: RIVAL_COLOR, group: TRADE_GROUP })),
  zones: [catchmentDisk(RASHID)],
})

/* —— Cameras —— */

/** The island from the south-east, Corniche to Al Mushrif in frame. */
const ISLAND_CAMERA: TomtomCamera = { center: [54.372, 24.468], zoom: 13.3, pitch: 50, bearing: -22 }
const SZBS_CAMERA: TomtomCamera = { center: SZBS.at, zoom: 15.6, pitch: 62, bearing: -38 }
/** Sheikh Rashid Bin Saeed St at Al Markaziyah, looking up the corridor. */
const CORRIDOR_CAMERA: TomtomCamera = { center: [54.362, 24.481], zoom: 15.49, pitch: 68, bearing: -16 }
const TRADE_CAMERA: TomtomCamera = { center: [54.364, 24.479], zoom: 14.6, pitch: 58, bearing: -8 }

/* —— Map Data —— */

const siteItems = (sites: Site[], evening = false) =>
  sites.map((site) => ({ label: site.area, color: SITE_COLOR, count: String(evening ? site.evening : site.score) }))

const SITES_LAYER = (sites: Site[], evening = false): MapDataLayer => ({
  group: SITES_GROUP,
  title: evening ? 'Candidate sites, 5–9pm' : 'Candidate sites',
  mark: 'pin',
  color: { items: siteItems(sites, evening) },
})
const STATIONS_LAYER: MapDataLayer = {
  group: STATIONS_GROUP,
  title: 'Your stations',
  mark: 'pin',
  color: { items: [{ label: 'Your stations', color: STATION_COLOR, count: String(STATIONS.length) }] },
}
const TRAFFIC_LAYER = (evening = false): MapDataLayer => ({
  group: TRAFFIC_GROUP,
  title: evening ? 'Traffic density, 5–9pm' : 'Traffic density',
  mark: 'fence',
  color: { ramp: TRAFFIC_RAMP, low: 'Lighter', high: 'Heavier' },
})
const RIVALS_LAYER = (count: number): MapDataLayer => ({
  group: RIVALS_GROUP,
  title: 'Competitors',
  mark: 'pin',
  color: { items: [{ label: 'Rival forecourts', color: RIVAL_COLOR, count: String(count) }] },
})
const TRADE_LAYER: MapDataLayer = {
  group: TRADE_GROUP,
  title: 'Rival trade areas',
  mark: 'disk',
  color: { items: [{ label: 'Within 3 minutes of a rival', color: RIVAL_COLOR }] },
}
const CATCHMENT_LAYER = (sites: Site[]): MapDataLayer => ({
  group: CATCHMENT_GROUP,
  title: 'Drive-time catchment, 5 min',
  mark: 'catchment',
  color: { items: sites.map((site) => ({ label: site.area, color: CATCHMENT_COLOR, count: thousands(site.residents) })) },
})

/* —— Story helpers —— */

/** `count` values from `from` to `to`, with a little deterministic noise. */
function series(count: number, from: number, to: number, seed: number, noise = 0.08) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 1 : index / (count - 1)
    const base = from + (to - from) * (t * t * (3 - 2 * t))
    return Math.round(base * (1 + (hash(index, seed) - 0.5) * 2 * noise) * 10) / 10
  })
}

/** A day's traffic by hour from 6am to 9pm, peaking in the morning and again at `evening` strength. */
function hourly(peakK: number, evening: number, seed: number) {
  const shape = [0.45, 0.9, 1, 0.74, 0.62, 0.6, 0.64, 0.7, 0.72, 0.78, 0.88, evening, evening * 0.98, evening * 0.8, 0.56, 0.42]
  return shape.map((value, index) => Math.round(value * peakK * (0.96 + 0.08 * hash(index, seed)) * 10) / 10)
}

const HOURS = ['6am', '9am', '12pm', '3pm', '6pm', '9pm']
const HOURS_16 = Array.from({ length: 16 }, (_, index) => {
  const hour = 6 + index
  return hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`
})

/** Assigns each card a tone in turn, so neighbouring charts don't all read the same colour. */
function toned(cards: TomtomCard[]): TomtomCard[] {
  const order: Tone[] = ['teal', 'blue', 'purple']
  let index = 0
  return cards.map((card) => (card.tone || card.kind === 'summary' ? card : { ...card, tone: order[index++ % order.length] }))
}

const top = byScore.slice(0, 5)
const eveningTop = byEvening.slice(0, 5)
const uplift = (site: Site) => Math.round((site.volume / NETWORK_AVERAGE - 1) * 100)

/* —— Site details —— */

const rows = (entries: [string, number][]): CountRow[] => entries.map(([name, count]) => ({ name, count }))
const bars = (entries: [string, number][]) => entries.map(([label, value]) => ({ label, value }))
/** `total` split by `weights`, rounded, with a little deterministic noise. */
const split = (total: number, weights: [string, number][], seed: number): [string, number][] => {
  const sum = weights.reduce((acc, [, weight]) => acc + weight, 0)
  return weights.map(([name, weight], index) => [name, Math.round((total * weight * (0.92 + 0.16 * hash(index, seed))) / sum)])
}
const LAST_30_DAYS = ['8 Oct', '15 Oct', '22 Oct', '29 Oct', '5 Nov']
const LAST_12_MONTHS = ['Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct']

function siteTabs(site: Site, seed: number, residents: number): Record<SiteTabId, SiteTab> {
  const daily = Math.round(site.traffic * 1000)
  const evening = Math.round((daily * site.eveningShare) / 100)
  const night = Math.round(daily * 0.09)
  const morning = Math.round(((daily - evening - night) * 26) / 60)
  const midday = daily - evening - night - morning
  return {
    traffic: {
      kpis: [
        { label: 'Passing vehicles a day', value: daily.toLocaleString('en-US') },
        { label: 'Vehicles 5–9pm', value: evening.toLocaleString('en-US') },
        { label: 'Average speed', value: String(Math.round(38 - site.eveningShare * 0.3)), unit: 'km/h' },
      ],
      breakdown: {
        title: 'Traffic by time of day',
        rows: rows([
          ['Morning, 6–10am', morning],
          ['Midday, 10am–5pm', midday],
          ['Evening, 5–9pm', evening],
          ['Night, 9pm–6am', night],
        ]),
      },
      demographics: {
        title: 'Who passes',
        groups: [
          { title: 'Trip purpose', bars: bars(split(daily, [['Commute', 44], ['Leisure', 24], ['Delivery', 18], ['Taxi', 14]], seed + 1)) },
          { title: 'Comes from', bars: bars(split(daily, [['Island', 58], ['Mainland', 36], ['Other emirates', 6]], seed + 2)) },
          { title: 'Stops nearby', bars: bars(split(daily, [['Passes through', 71], ['Stops', 29]], seed + 3)) },
        ],
      },
      series: {
        title: 'Passing vehicles, last 30 days',
        unit: 'k vehicles a day',
        x: LAST_30_DAYS,
        yLabels: ['60k', '30k', '0'],
        yMax: 60,
        points: series(30, site.traffic * 0.92, site.traffic, seed, 0.06),
      },
    },
    catchment: {
      kpis: [
        { label: 'Residents within 5 minutes', value: residents.toLocaleString('en-US') },
        { label: 'Households', value: Math.round(residents / 3.6).toLocaleString('en-US') },
        { label: 'Cars per household', value: (1.5 + hash(seed, 5) * 0.5).toFixed(1) },
      ],
      breakdown: {
        title: 'Residents by drive time',
        rows: rows(split(residents, [['Under 2 minutes', 18], ['2–3 minutes', 27], ['3–4 minutes', 30], ['4–5 minutes', 25]], seed + 4)),
      },
      demographics: {
        title: 'Catchment profile',
        groups: [
          { title: 'Age group', bars: bars(split(residents, [['18-24', 14], ['25-34', 32], ['35-44', 28], ['45-59', 18], ['60+', 8]], seed + 5)) },
          { title: 'Household', bars: bars(split(residents, [['Family', 58], ['Single', 27], ['Shared', 15]], seed + 6)) },
          { title: 'Cars', bars: bars(split(residents, [['None', 12], ['One', 46], ['Two+', 42]], seed + 7)) },
        ],
      },
      series: {
        title: 'Residents in the catchment, last 12 months',
        unit: 'k residents',
        x: LAST_12_MONTHS,
        yLabels: ['60k', '30k', '0'],
        yMax: 60,
        points: series(12, (residents / 1000) * 0.94, residents / 1000, seed + 8, 0.01),
      },
    },
    competition: {
      kpis: [
        { label: 'Rivals within 3 km', value: String(site.rivalsWithin3) },
        { label: 'Nearest rival', value: site.rivalKm.toFixed(1), unit: 'km' },
        { label: 'Nearest of your stations', value: site.stationKm.toFixed(1), unit: 'km' },
      ],
      breakdown: {
        title: 'Rival visits by format',
        rows: rows(split(Math.round(daily * 0.11), [['Full forecourt', 46], ['Express', 22], ['With car wash', 19], ['With café', 13]], seed + 9)),
      },
      demographics: {
        title: 'Rivals within 3 km',
        groups: [
          { title: 'Opening hours', bars: bars([['24 hours', Math.ceil(site.rivalsWithin3 * 0.6)], ['Daytime', Math.floor(site.rivalsWithin3 * 0.4) || 1]]) },
          { title: 'Pumps', bars: bars([['Up to 6', 2], ['7–12', Math.max(1, site.rivalsWithin3 - 3)], ['12+', 1]]) },
          { title: 'Shop', bars: bars([['Convenience', Math.max(1, site.rivalsWithin3 - 1)], ['None', 1]]) },
        ],
      },
      series: {
        title: 'Visits to rivals within 3 km, last 12 months',
        unit: 'k visits a month',
        x: LAST_12_MONTHS,
        yLabels: ['200k', '100k', '0'],
        yMax: 200,
        points: series(12, 90 + site.rivalsWithin3 * 8, 104 + site.rivalsWithin3 * 9, seed + 10, 0.05),
      },
    },
    access: {
      kpis: [
        { label: 'Entry directions', value: site.id === 'site-corniche' ? '1' : '2' },
        { label: 'Turn-in delay, 5–9pm', value: String(Math.round(8 + site.eveningShare * 0.4)), unit: 's' },
        { label: 'Nearest U-turn', value: String(Math.round(180 + hash(seed, 9) * 420)), unit: 'm' },
      ],
      breakdown: {
        title: 'Arrivals by approach',
        rows: rows(split(Math.round(daily * 0.035), [['Main road, inbound', 42], ['Main road, outbound', 31], ['Side street', 17], ['U-turn', 10]], seed + 11)),
      },
      demographics: {
        title: 'Getting in and out',
        groups: [
          { title: 'Congestion, 5–9pm', bars: bars(split(100, [['Free', 34], ['Busy', 44], ['Heavy', 22]], seed + 12)) },
          { title: 'Turn in', bars: bars(split(100, [['Right', 72], ['Left', 28]], seed + 13)) },
          { title: 'Lanes', bars: bars([['2', 1], ['3', 3], ['4', 2]]) },
        ],
      },
      series: {
        title: 'Average speed past the site, by hour',
        unit: 'km/h',
        x: HOURS,
        yLabels: ['80', '40', '0'],
        yMax: 80,
        points: hourly(52, 0.5, seed + 14).map((value) => Math.round(Math.max(14, 72 - value * 0.6))),
      },
    },
  }
}

function siteDetails(id: SiteId, spec: { seed: number; code: string; use: string }): TomtomSite {
  const site = siteById(id)
  const rank = rankOf(site)
  const daily = Math.round(site.traffic * 1000)
  return {
    id,
    name: site.area,
    street: STREET_NAMES[site.street],
    at: site.at,
    color: SITE_COLOR,
    rank,
    code: spec.code,
    use: spec.use,
    stage: `Site ${rank} of ${SITES.length}`,
    headline: `Score ${site.score} · ${site.traffic.toFixed(1)}k vehicles a day`,
    rail: {
      value: {
        label: 'Projected fuel volume (M litres a year)',
        value: site.volume.toFixed(1),
        years: ['Year 1', 'Year 2', 'Year 3'],
        spark: series(24, site.volume * 0.62, site.volume, spec.seed, 0.04),
      },
      count: { label: 'Passing vehicles a day', value: daily.toLocaleString('en-US') },
      mix: {
        label: 'Traffic by vehicle type',
        center: 'vehicles',
        rows: rows(split(daily, [['Cars', 46], ['SUVs', 28], ['Taxis', 11], ['Vans', 8], ['Trucks', 4], ['Buses', 3]], spec.seed)),
      },
      ring: { label: 'Site score', pct: site.score, caption: 'Score', note: `Rank ${rank} of ${SITES.length} candidates` },
      reports: { label: 'Site reports', items: ['Traffic study, Oct 2026', 'Catchment report, Q3 2026'] },
    },
    tabs: siteTabs(site, spec.seed, site.residents),
  }
}

export const TOMTOM_SITES: Record<SiteId, TomtomSite> = {
  'site-szbs': siteDetails('site-szbs', { seed: 21, code: 'Plot 4,200 m²', use: 'Fuel + convenience' }),
  'site-corniche': siteDetails('site-corniche', { seed: 33, code: 'Plot 3,100 m²', use: 'Fuel + café' }),
  'site-khaleej': siteDetails('site-khaleej', { seed: 47, code: 'Plot 3,800 m²', use: 'Fuel + convenience' }),
  'site-rashid': siteDetails('site-rashid', { seed: 59, code: 'Plot 2,600 m²', use: 'Express fuel' }),
}

/* —— Stories —— */

const S1 = SZBS.area
const SZBS_RIVAL_KM = km(SZBS.rivalKm)

export const TOMTOM_STORIES: Record<string, TomtomStory> = {
  'tt-shortlist': {
    id: 'tt-shortlist',
    title: 'Next Site Shortlist',
    description:
      'Twelve candidate sites on Abu Dhabi Island, scored on passing traffic, catchment, competition and access against your eight stations. Click a shortlisted site for its details.',
    place: 'zahiyah',
    pages: [
      {
        id: 'tt-shortlist-island',
        title: 'Abu Dhabi Island',
        finding: `Five of the 12 candidates score above 70. ${S1} on ${STREET_NAMES.szbs} leads at ${SZBS.score}, with ${SZBS.traffic.toFixed(1)}k vehicles a day passing it.`,
        camera: ISLAND_CAMERA,
        scene: ISLAND_SCENE,
        filters: ['Abu Dhabi Island', 'Last 90 days', 'Fuel retail'],
        layers: [SITES_LAYER(top), STATIONS_LAYER, RIVALS_LAYER(RIVALS.length), CATCHMENT_LAYER(top), TRAFFIC_LAYER()],
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              'Of 12 candidate sites, ',
              { em: ['5 score above 70'] },
              `. ${S1} on ${STREET_NAMES.szbs} leads at ${SZBS.score}: `,
              { em: [`${SZBS.traffic.toFixed(1)}k vehicles a day`] },
              ` pass it, and it would sell ${uplift(SZBS)}% more fuel than your average station while its catchment barely overlaps theirs.`,
            ],
          },
          {
            id: 'kpis',
            kind: 'kpis',
            title: 'The shortlist',
            tiles: [
              { label: 'Candidate sites', value: '12', note: '5 above 70' },
              { label: 'Best score', value: String(SZBS.score), note: S1 },
              { label: 'Your average station', value: NETWORK_AVERAGE.toFixed(1), unit: 'M L', note: 'a year' },
            ],
          },
          {
            id: 'ranking',
            kind: 'hbars',
            title: 'Top sites by score, of 100',
            bars: top.map((site) => ({ label: site.area, value: site.score, display: String(site.score), color: SITE_COLOR })),
          },
          {
            id: 'vs-network',
            kind: 'grouped',
            title: 'Projected volume vs your stations',
            legend: ['Candidate', 'Your average'],
            colors: [SITE_COLOR, STATION_COLOR],
            groups: top.map((site) => ({ label: site.area.replace('Al ', ''), values: [site.volume, NETWORK_AVERAGE] })),
          },
          {
            id: 'shortlist',
            kind: 'table',
            title: 'Shortlist',
            columns: ['Site', 'Score', 'Traffic', 'Nearest rival'],
            dotColumn: 0,
            rows: top.map((site) => ({
              cells: [site.area, String(site.score), `${site.traffic.toFixed(1)}k`, km(site.rivalKm)],
              color: SITE_COLOR,
            })),
          },
          {
            id: 'traffic-hours',
            kind: 'line',
            title: 'Passing traffic by hour, top 3',
            kpi: { value: '5–7pm', unit: 'evening peak' },
            x: HOURS,
            yLabels: ['5k', '2.5k', '0'],
            yMax: 5,
            series: byScore.slice(0, 3).map((site, index) => ({
              name: site.area,
              points: hourly((site.traffic / 13) * 1, site.eveningShare / 32, 3 + index),
              color: [SITE_COLOR, PALETTE.blue[3], PALETTE.purple[3]][index],
            })),
          },
          {
            id: 'site-szbs-volume',
            kind: 'cell',
            title: 'Projected volume',
            value: `${SZBS.volume.toFixed(1)}M`,
            note: `litres a year · ${S1}`,
            spark: series(10, SZBS.volume * 0.62, SZBS.volume, 4, 0.03),
          },
          {
            id: 'overlap',
            kind: 'cell',
            title: 'Overlap with your stations',
            value: '6%',
            note: `of ${S1}'s catchment`,
            spark: [11, 10, 10, 9, 8, 8, 7, 7, 6, 6],
          },
          {
            id: 'rivals',
            kind: 'donut',
            title: 'Rivals near the top 5',
            total: String(top.reduce((sum, site) => sum + site.rivalsWithin3, 0)),
            totalLabel: 'within 3 km',
            slices: top.map((site) => ({ name: site.area, value: site.rivalsWithin3 })),
          },
        ]),
      },
      {
        id: 'tt-shortlist-szbs',
        title: S1,
        finding: `${S1} sees ${SZBS.traffic.toFixed(1)}k vehicles a day from both directions, its nearest rival is ${SZBS_RIVAL_KM} away, and evening traffic peaks from 5 to 7pm.`,
        camera: SZBS_CAMERA,
        scene: SZBS_SCENE,
        filters: [S1, 'Last 90 days', 'Fuel retail'],
        layers: [SITES_LAYER([SZBS]), STATIONS_LAYER, RIVALS_LAYER(SZBS_RIVALS.length), CATCHMENT_LAYER([SZBS]), TRAFFIC_LAYER()],
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              `${S1} sits on ${STREET_NAMES.szbs} with entries from `,
              { em: ['both directions'] },
              `. ${SZBS.traffic.toFixed(1)}k vehicles pass it a day, the nearest rival is `,
              { em: [SZBS_RIVAL_KM] },
              ` away and your nearest station ${km(SZBS.stationKm)}. Traffic peaks from 5 to 7pm.`,
            ],
          },
          {
            id: 'site-szbs-kpis',
            kind: 'kpis',
            title: S1,
            tiles: [
              { label: 'Passing vehicles', value: `${SZBS.traffic.toFixed(1)}k`, note: 'a day' },
              { label: 'Nearest rival', value: SZBS.rivalKm.toFixed(1), unit: 'km' },
              { label: 'Projected volume', value: SZBS.volume.toFixed(1), unit: 'M L', note: `+${uplift(SZBS)}% on average` },
            ],
          },
          {
            id: 'site-szbs-hours',
            kind: 'line',
            title: 'Vehicles by hour, both directions',
            kpi: { value: '3.7k', unit: 'vehicles at 6pm' },
            x: HOURS,
            yLabels: ['3k', '1.5k', '0'],
            yMax: 3,
            series: [
              { name: 'Inbound', points: hourly(2.3, 0.82, 11) },
              { name: 'Outbound', points: hourly(1.5, 1.24, 12) },
            ],
          },
          {
            id: 'site-szbs-score',
            kind: 'progress',
            title: 'Score breakdown',
            rows: [
              { label: 'Traffic', value: '92', target: '100', pct: 92, color: SITE_COLOR },
              { label: 'Access', value: '88', target: '100', pct: 88, color: SITE_COLOR },
              { label: 'Catchment', value: '84', target: '100', pct: 84, color: SITE_COLOR },
              { label: 'Competition', value: '81', target: '100', pct: 81, color: SITE_COLOR },
            ],
          },
          {
            id: 'site-szbs-rivals',
            kind: 'table',
            title: 'Nearest rivals',
            columns: ['Rival', 'Distance', 'Open'],
            dotColumn: 0,
            rows: SZBS_RIVALS.map((rival, index) => ({
              cells: [`Rival ${index + 1}`, km(distanceKm(rival.at, SZBS.at)), hash(Number(rival.id.slice(6)), 3) > 0.4 ? '24 hours' : '6am – midnight'],
              color: RIVAL_COLOR,
            })),
          },
          {
            id: 'site-szbs-approach',
            kind: 'vbars',
            title: 'Arrivals by approach',
            kpi: { value: '73%', unit: 'from the main road' },
            bars: [
              { label: 'Inbound', value: 42, display: '42%' },
              { label: 'Outbound', value: 31, display: '31%' },
              { label: 'Side street', value: 17, display: '17%' },
              { label: 'U-turn', value: 10, display: '10%' },
            ],
          },
          {
            id: 'site-szbs-facts',
            kind: 'specs',
            title: 'Site facts',
            items: [
              ['Plot', '4,200 m²'],
              ['Frontage', '68 m'],
              ['Entries', 'Both directions'],
              ['Zoning', 'Commercial'],
              ['Residents, 5 min', '38,400'],
              ['Overlap', '6% with your stations'],
            ],
          },
        ]),
      },
    ],
  },
  'tt-evening': {
    id: 'tt-evening',
    title: 'Evening Demand, 5–9pm',
    description:
      'The candidates re-scored on evening traffic alone, along Sheikh Rashid Bin Saeed St and the rivals around it. Click a shortlisted site for its details.',
    place: 'corridor',
    pages: [
      {
        id: 'tt-evening-corridor',
        title: STREET_NAMES.rashid,
        finding: `Between 5 and 9pm, ${RASHID.eveningShare}% of ${STREET_NAMES.rashid}'s traffic passes ${RASHID.area}, lifting it from rank ${rankOf(RASHID)} to ${eveningRankOf(RASHID)}.`,
        camera: CORRIDOR_CAMERA,
        scene: CORRIDOR_SCENE,
        filters: [STREET_NAMES.rashid, '5pm – 9pm', 'Fuel retail'],
        layers: [
          SITES_LAYER([RASHID], true),
          STATIONS_LAYER,
          RIVALS_LAYER(CORRIDOR_RIVALS.length),
          CATCHMENT_LAYER([RASHID]),
          TRAFFIC_LAYER(true),
        ],
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              'Count only 5 to 9pm and the order changes. ',
              { em: [`${RASHID.area} climbs to ${eveningRankOf(RASHID)}`] },
              ` as traffic heads home along ${STREET_NAMES.rashid}: ${RASHID.eveningShare}% of its day passes in those four hours. ${S1} stays first at `,
              { em: [String(SZBS.evening)] },
              '.',
            ],
          },
          {
            id: 'site-rashid-kpis',
            kind: 'kpis',
            title: '5pm – 9pm',
            tiles: [
              { label: 'Evening share', value: `${RASHID.eveningShare}%`, note: 'of the day' },
              { label: 'Peak hour', value: '6–7pm' },
              { label: 'Evening score', value: String(RASHID.evening), note: `+${RASHID.evening - RASHID.score} on all day` },
            ],
          },
          {
            id: 'rerank',
            kind: 'grouped',
            title: 'All day vs evening score',
            legend: ['All day', '5–9pm'],
            colors: [PALETTE.blue[3], SITE_COLOR],
            groups: eveningTop.map((site) => ({ label: site.area.replace('Al ', ''), values: [site.score, site.evening] })),
          },
          {
            id: 'site-rashid-hours',
            kind: 'line',
            title: 'Corridor traffic by hour',
            kpi: { value: '3.5k', unit: 'vehicles at 6pm' },
            x: HOURS,
            yLabels: ['4k', '2k', '0'],
            yMax: 4,
            series: [
              { name: STREET_NAMES.rashid, points: hourly(2.6, 1.38, 21) },
              { name: 'Island average', points: hourly(2.2, 0.96, 22), dashed: true },
            ],
          },
          {
            id: 'evening-ranking',
            kind: 'hbars',
            title: 'Evening ranking, of 100',
            bars: eveningTop.map((site) => ({ label: site.area, value: site.evening, display: String(site.evening), color: SITE_COLOR })),
          },
          {
            id: 'site-rashid-volume',
            kind: 'cell',
            title: 'Evening fuel volume',
            value: `${((RASHID.volume * RASHID.eveningShare) / 100).toFixed(1)}M`,
            note: `litres a year · ${RASHID.area}`,
            spark: series(10, 1.9, (RASHID.volume * RASHID.eveningShare) / 100, 6, 0.04),
          },
        ]),
      },
      {
        id: 'tt-evening-rivals',
        title: 'Rival trade areas',
        finding: `${CORRIDOR_RIVALS.length} rivals sit around the corridor, but none within ${km(RASHID.rivalKm)} of ${RASHID.area}: the evening traffic passes a gap in their trade areas.`,
        camera: TRADE_CAMERA,
        scene: TRADE_SCENE,
        filters: [STREET_NAMES.rashid, '5pm – 9pm', 'Fuel retail'],
        layers: [
          SITES_LAYER([RASHID], true),
          RIVALS_LAYER(CORRIDOR_RIVALS.length),
          TRADE_LAYER,
          CATCHMENT_LAYER([RASHID]),
          STATIONS_LAYER,
          TRAFFIC_LAYER(true),
        ],
        cards: toned([
          {
            id: 'summary',
            kind: 'summary',
            title: 'Summary',
            parts: [
              `${CORRIDOR_RIVALS.length} rivals trade around the corridor, but `,
              { em: ['none reach the stretch'] },
              ` at ${RASHID.area}: the nearest is ${km(RASHID.rivalKm)} away. Evening drivers heading south pass `,
              { em: ['no forecourt for 2.4 km'] },
              '.',
            ],
          },
          {
            id: 'trade-rivals',
            kind: 'table',
            title: 'Rivals around the corridor',
            columns: ['Rival', 'Distance', 'Evening visits'],
            dotColumn: 0,
            rows: CORRIDOR_RIVALS.map((rival, index) => ({
              cells: [`Rival ${index + 1}`, km(distanceKm(rival.at, RASHID.at)), Math.round(380 + hash(index, 71) * 420).toLocaleString('en-US')],
              color: RIVAL_COLOR,
            })),
          },
          {
            id: 'trade-visits',
            kind: 'vbars',
            title: 'Rival visits by hour, 5–9pm',
            kpi: { value: '1,240', unit: 'visits at 6pm' },
            bars: [
              { label: '5pm', value: 980, display: '980' },
              { label: '6pm', value: 1240, display: '1,240' },
              { label: '7pm', value: 1110, display: '1,110' },
              { label: '8pm', value: 760, display: '760' },
            ],
          },
          {
            id: 'trade-format',
            kind: 'donut',
            title: 'Evening fuel visits by format',
            total: '4,090',
            totalLabel: 'visits',
            slices: [
              { name: 'Full forecourt', value: 1880 },
              { name: 'Express', value: 1020 },
              { name: 'With car wash', value: 710 },
              { name: 'With café', value: 480 },
            ],
          },
          {
            id: 'site-rashid-facts',
            kind: 'specs',
            title: `${RASHID.area} site`,
            items: [
              ['Plot', '2,600 m²'],
              ['Format', 'Express fuel'],
              ['Entries', 'Southbound'],
              ['Residents, 5 min', '46,900'],
            ],
          },
        ]),
      },
    ],
  },
}

export function isSiteId(id: string): id is SiteId {
  return id in TOMTOM_SITES
}

export function isTomtomStory(id: string | null | undefined): id is string {
  return id != null && id in TOMTOM_STORIES
}

/* —— Briefing places —— */

export type TomtomPlace = { id: TomtomPlaceId; camera: TomtomCamera; scene: TomtomMapScene }

export const TOMTOM_PLACES: Record<TomtomPlaceId, TomtomPlace> = {
  /** Al Zahiyah close up, looking north-east across the channel to Al Reem Island's towers. */
  zahiyah: { id: 'zahiyah', camera: { center: SZBS.at, zoom: 15.55, pitch: 70, bearing: 52 }, scene: SZBS_SCENE },
  corridor: { id: 'corridor', camera: CORRIDOR_CAMERA, scene: CORRIDOR_SCENE },
}

/* —— The ask stage: the AI bar's three answers, each with its own map —— */

export type TomtomAskStageId = 'tt-ask' | 'tt-dive' | 'tt-evening'

/** What an answer opens on the map: its camera, the scene on it, and the Map Data that reads it. */
export type TomtomAskView = { camera: TomtomCamera; scene: TomtomMapScene; layers: MapDataLayer[] }

export const TOMTOM_ASK_VIEWS: Record<TomtomAskStageId, TomtomAskView> = {
  'tt-ask': {
    camera: { center: [54.374, 24.47], zoom: 13.4, pitch: 52, bearing: -22 },
    scene: ISLAND_SCENE,
    layers: [SITES_LAYER(top), STATIONS_LAYER, RIVALS_LAYER(RIVALS.length), CATCHMENT_LAYER(top), TRAFFIC_LAYER()],
  },
  'tt-dive': {
    camera: SZBS_CAMERA,
    scene: SZBS_SCENE,
    layers: [SITES_LAYER([SZBS]), RIVALS_LAYER(SZBS_RIVALS.length), CATCHMENT_LAYER([SZBS]), TRAFFIC_LAYER()],
  },
  'tt-evening': {
    camera: { center: [54.372, 24.468], zoom: 13.45, pitch: 54, bearing: -6 },
    scene: EVENING_SCENE,
    layers: [SITES_LAYER(eveningTop, true), RIVALS_LAYER(RIVALS.length), CATCHMENT_LAYER(eveningTop), TRAFFIC_LAYER(true)],
  },
}

/** Site 1's figures, for the dive answer. */
export const SITE_ONE = {
  name: S1,
  street: STREET_NAMES.szbs,
  score: SZBS.score,
  traffic: SZBS.traffic,
  volume: SZBS.volume,
  residents: SZBS.residents,
  overlap: SZBS.overlap,
  uplift: uplift(SZBS),
  rivalKm: SZBS.rivalKm,
  stationKm: SZBS.stationKm,
  rivalsWithin3: SZBS.rivalsWithin3,
  hours: { x: HOURS_16, inbound: hourly(2.3, 0.82, 11), outbound: hourly(1.5, 1.24, 12) },
}
