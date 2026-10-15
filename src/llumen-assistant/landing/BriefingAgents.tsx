import { useId, type ReactNode } from 'react'
import { AgentShader, type AgentShaderPattern } from './AgentShader'
import styles from './BriefingAgents.module.css'

type ShaderAgent = {
  id: string
  name: string
  category: string
  steps: number
  schedule: string
  nextRun: string
  summary: string
  pattern: AgentShaderPattern
  /** Shader colours over black: the glow, then its brightest core. */
  glow: string
  core: string
}

/** Agents the user built in Agent builder. Thumbnails only for now; the builder itself is out of scope. */
const FEATURED = {
  name: 'Traffic Jam Work',
  category: 'Finance',
  status: 'Draft',
  schedule: 'Runs every day at 12:00 AM',
  summary:
    'Pulls building permits and waste collection trips, simulates the load on construction and infrastructure, and writes a story when the forecast crosses its threshold.',
}

const AGENTS: ShaderAgent[] = [
  {
    id: 'air-quality-watch',
    name: 'Air Quality Watch',
    category: 'Environment',
    steps: 6,
    schedule: 'Runs hourly',
    nextRun: 'Next run in 48 min',
    summary: 'Flags districts crossing the sensitive-groups AQI line and drafts an alert.',
    pattern: 'smoke',
    glow: '#1d6b5a',
    core: '#7fd6b8',
  },
  {
    id: 'heat-clinic-forecast',
    name: 'Heat Clinic Forecast',
    category: 'Health',
    steps: 5,
    schedule: 'Runs daily at 6:00 AM',
    nextRun: 'Next run tomorrow at 6:00 AM',
    summary: 'Forecasts heat-related clinic visits for the week from temperature and visit history.',
    pattern: 'beam',
    glow: '#8a3412',
    core: '#f08a4b',
  },
  {
    id: 'bus-delay-monitor',
    name: 'Bus Delay Monitor',
    category: 'Operations',
    steps: 4,
    schedule: 'Runs every 15 min',
    nextRun: 'Next run in 6 min',
    summary: 'Tracks island bus routes against the timetable and explains where delays start.',
    pattern: 'ribbon',
    glow: '#3d5a1c',
    core: '#a8c86a',
  },
  {
    id: 'permit-compliance-check',
    name: 'Permit Compliance Check',
    category: 'Compliance',
    steps: 7,
    schedule: 'Runs weekly on Monday',
    nextRun: 'Next run Monday at 8:00 AM',
    summary: 'Compares facility readings with their permit limits and lists the ones over.',
    pattern: 'curtains',
    glow: '#3b2590',
    core: '#9b80ff',
  },
  {
    id: 'water-leak-detector',
    name: 'Water Leak Detector',
    category: 'Utilities',
    steps: 5,
    schedule: 'Runs every 30 min',
    nextRun: 'Next run in 22 min',
    summary: 'Spots unusual night-time flow in the water network and points to the likely pipe.',
    pattern: 'ripples',
    glow: '#7a2257',
    core: '#f07ab8',
  },
  {
    id: 'tourism-footfall-pulse',
    name: 'Tourism Footfall Pulse',
    category: 'Tourism',
    steps: 4,
    schedule: 'Runs daily at 9:00 AM',
    nextRun: 'Next run tomorrow at 9:00 AM',
    summary: 'Compares hotel occupancy with weekend footfall at major sites and sums up the shift.',
    pattern: 'orbs',
    glow: '#7a5810',
    core: '#f2c35a',
  },
]

export function BriefingAgentGrid() {
  return (
    <div className={styles.grid}>
      <article className={styles.featured}>
        <div className={styles.featuredThumb}>
          <WorkflowSnapshot />
        </div>
        <div className={styles.featuredText}>
          <h3 className={styles.featuredName}>{FEATURED.name}</h3>
          <p className={styles.meta}>
            {FEATURED.category} · {FEATURED.status} · {FEATURED.schedule}
          </p>
          <p className={styles.summary}>{FEATURED.summary}</p>
        </div>
      </article>
      {AGENTS.map((agent) => (
        <article key={agent.id} className={styles.agent}>
          <div className={styles.thumb}>
            <AgentShader className={styles.shader} pattern={agent.pattern} glow={agent.glow} core={agent.core} />
            <span className={styles.thumbTop}>{agent.nextRun}</span>
            <p className={styles.thumbSummary}>{agent.summary}</p>
          </div>
          <h3 className={styles.name}>{agent.name}</h3>
          <p className={styles.meta}>
            {agent.category} · {agent.steps} steps · {agent.schedule}
          </p>
        </article>
      ))}
    </div>
  )
}

/*
 * Workflow snapshot: a still of the agent's canvas in Agent builder. The SVG fits the nodes to the
 * thumbnail's width; the dotted canvas around them is the thumbnail's own background.
 */

type Box = { x: number; y: number; w: number; h: number }

const VIEW_BOX = '0 150 1140 400'
const NODE_H = 44
const TRIGGER: Box = { x: 12, y: 328, w: 180, h: NODE_H }
const PERMITS: Box = { x: 214, y: 170, w: 196, h: 140 }
const TRIPS: Box = { x: 214, y: 390, w: 196, h: 140 }
const BRANCH: Box = { x: 442, y: 328, w: 96, h: NODE_H }
const SOURCES: (Box & { title: string; sub: string })[] = [
  { x: 580, y: 170, w: 200, h: NODE_H, title: 'Total Waste Generation', sub: 'Bar Chart' },
  { x: 580, y: 226, w: 200, h: NODE_H, title: 'Sewage Load Volume', sub: 'Bar Chart' },
  { x: 580, y: 282, w: 200, h: 130, title: 'Housing and Waste Map', sub: 'Map' },
  { x: 580, y: 430, w: 200, h: NODE_H, title: 'Construction Investment', sub: 'Bar Chart' },
  { x: 580, y: 486, w: 200, h: NODE_H, title: 'Infrastructure CAPEX', sub: 'Bar Chart' },
]
const SIMULATION: Box = { x: 818, y: 328, w: 156, h: NODE_H }
const STORY: Box = { x: 1006, y: 328, w: 118, h: NODE_H }

const PERMIT_POINTS = [12, 13, 13, 15, 17, 16, 19, 21, 21, 24, 27, 30]
const TRIP_BARS = [8, 9, 10, 10, 11, 12, 12, 13, 14, 15, 17, 19]
const MAP_PILLARS = [
  [36, 30],
  [58, 46],
  [72, 22],
  [96, 38],
  [112, 28],
  [128, 44],
]

const out = (b: Box): [number, number] => [b.x + b.w, b.y + b.h / 2]
const into = (b: Box): [number, number] => [b.x, b.y + b.h / 2]

function edge([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const bend = Math.max(24, (x2 - x1) * 0.5)
  return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
}

const EDGES = [
  edge(out(TRIGGER), into(PERMITS)),
  edge(out(TRIGGER), into(TRIPS)),
  edge(out(PERMITS), into(BRANCH)),
  edge(out(TRIPS), into(BRANCH)),
  ...SOURCES.map((source) => edge(out(BRANCH), into(source))),
  ...SOURCES.map((source) => edge(out(source), into(SIMULATION))),
  edge(out(SIMULATION), into(STORY)),
]

const PORTS = [TRIGGER, PERMITS, TRIPS, BRANCH, ...SOURCES, SIMULATION, STORY]

function WorkflowSnapshot() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (name: string) => `${name}${uid}`
  return (
    <svg className={styles.snapshot} viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <linearGradient id={id('area')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fd2c7" stopOpacity="0.45" />
          <stop offset="1" stopColor="#3fd2c7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('bar')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f5c518" />
          <stop offset="1" stopColor="#f0703a" />
        </linearGradient>
        <linearGradient id={id('pillar')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff4d4d" />
          <stop offset="1" stopColor="#ff4d4d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#ff4d4d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff4d4d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('simulation')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2c3a7a" />
          <stop offset="1" stopColor="#5a2f4f" />
        </linearGradient>
        <linearGradient id={id('story')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a2c12" />
          <stop offset="1" stopColor="#2a1c14" />
        </linearGradient>
      </defs>

      {EDGES.map((d) => (
        <g key={d}>
          <path className={styles.edge} d={d} />
          <path className={styles.edgeFlow} d={d} />
        </g>
      ))}

      <Node box={TRIGGER} icon="#4fd1a5" round title="Schedule Trigger" sub="Runs every day at 12:00 AM" />

      <Node box={PERMITS} icon="#f5c518" title="Active Building Permits" sub="Line Chart" />
      <Panel box={PERMITS} label="Active Building Permits" value="2,840">
        <path
          d={`${linePath(PERMITS)} L${PERMITS.x + PERMITS.w - 18},${PERMITS.y + 126} L${PERMITS.x + 18},${PERMITS.y + 126} Z`}
          fill={`url(#${id('area')})`}
        />
        <path d={linePath(PERMITS)} fill="none" stroke="#3fd2c7" strokeWidth="1.6" />
      </Panel>

      <Node box={TRIPS} icon="#f5c518" title="Waste Collection Trips" sub="Bar Chart" />
      <Panel box={TRIPS} label="Waste Collection Trips" value="4,350">
        {TRIP_BARS.map((value, i) => (
          <rect
            key={i}
            x={TRIPS.x + 18 + i * 13}
            y={TRIPS.y + 126 - value * 1.7}
            width="8"
            height={value * 1.7}
            rx="2"
            fill={`url(#${id('bar')})`}
          />
        ))}
      </Panel>

      <Node box={BRANCH} icon="#f5c518" title="If / Else" />
      <Chip x={BRANCH.x + BRANCH.w + 4} y={BRANCH.y + 6} text="True" tone="#3ccf8e" />
      <Chip x={BRANCH.x + BRANCH.w + 4} y={BRANCH.y + 26} text="False" tone="#ff6b6b" />

      {SOURCES.map((source) => (
        <Node key={source.title} box={source} icon="#f5c518" title={source.title} sub={source.sub} />
      ))}
      <g>
        <rect x={SOURCES[2].x + 10} y={SOURCES[2].y + 46} width={SOURCES[2].w - 20} height="74" rx="8" fill="#0c1018" />
        <ellipse cx={SOURCES[2].x + 92} cy={SOURCES[2].y + 106} rx="70" ry="16" fill={`url(#${id('glow')})`} />
        {MAP_PILLARS.map(([dx, height]) => (
          <rect
            key={dx}
            x={SOURCES[2].x + 10 + dx}
            y={SOURCES[2].y + 110 - height}
            width="2"
            height={height}
            fill={`url(#${id('pillar')})`}
          />
        ))}
      </g>

      <Node box={SIMULATION} icon="#7b93ff" fill={`url(#${id('simulation')})`} title="Simulation Agent" />
      <Node box={STORY} icon="#f39a3d" fill={`url(#${id('story')})`} round title="Story Agent" />

      {PORTS.map((box) => (
        <g key={`${box.x}-${box.y}`}>
          <circle className={styles.port} cx={box.x} cy={box.y + box.h / 2} r="3.2" />
          <circle className={styles.port} cx={box.x + box.w} cy={box.y + box.h / 2} r="3.2" />
        </g>
      ))}
    </svg>
  )
}

function linePath(box: Box) {
  const left = box.x + 18
  const width = box.w - 36
  const max = Math.max(...PERMIT_POINTS)
  return PERMIT_POINTS.map((value, i) => {
    const x = left + (i / (PERMIT_POINTS.length - 1)) * width
    const y = box.y + 126 - (value / max) * 30
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function Node({
  box,
  icon,
  title,
  sub,
  round = false,
  fill = '#18191e',
}: {
  box: Box
  icon: string
  title: string
  sub?: string
  round?: boolean
  fill?: string
}) {
  const r = round ? NODE_H / 2 : 10
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={Math.min(r, box.h / 2)}
        fill={fill}
        stroke="rgba(255,255,255,0.1)"
      />
      <rect x={box.x + 10} y={box.y + 10} width="24" height="24" rx={round ? 12 : 6} fill={icon} />
      <rect x={box.x + 17} y={box.y + 17} width="10" height="10" rx="2" fill="rgba(0,0,0,0.55)" />
      <text className={styles.nodeTitle} x={box.x + 44} y={sub ? box.y + 20 : box.y + 26}>
        {title}
      </text>
      {sub ? (
        <text className={styles.nodeSub} x={box.x + 44} y={box.y + 34}>
          {sub}
        </text>
      ) : null}
    </g>
  )
}

function Panel({ box, label, value, children }: { box: Box; label: string; value: string; children: ReactNode }) {
  return (
    <g>
      <rect
        x={box.x + 10}
        y={box.y + 46}
        width={box.w - 20}
        height="86"
        rx="8"
        fill="#111216"
        stroke="rgba(255,255,255,0.06)"
      />
      <text className={styles.panelLabel} x={box.x + 18} y={box.y + 62}>
        {label}
      </text>
      <text className={styles.panelValue} x={box.x + 18} y={box.y + 80}>
        {value}
      </text>
      {children}
    </g>
  )
}

function Chip({ x, y, text, tone }: { x: number; y: number; text: string; tone: string }) {
  const width = text.length * 6 + 10
  return (
    <g>
      <rect x={x} y={y} width={width} height="13" rx="3" fill={tone} fillOpacity="0.18" />
      <text className={styles.chip} x={x + 5} y={y + 9.5} fill={tone}>
        {text}
      </text>
    </g>
  )
}
