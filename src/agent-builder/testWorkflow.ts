import { SECTION_DEFAULTS, SECTION_FIT_PADDING, boundsOf, type CanvasComment, type CanvasSection, type CanvasText } from './canvasItems'
import { conditionGroup } from './conditions'
import { NODE_TYPES_BY_ID, createNode, type CanvasNode, type NodeConfig, type Point, type Size, type WorkflowEdge } from './nodeCatalog'
type TestNode = [id: string, typeId: string, config?: NodeConfig]
/** `from` and `to` are node ids; ports default to `out` and `in`. */
type TestLink = [from: string, to: string, fromPort?: string, toPort?: string]

/**
 * Contamination watch: sites with expired permits become a chart, the sites are compared with land
 * use, and a PM10 forecast raises an alert where it crosses 120 µg/m³. Ordered so the manual trigger
 * comes first, which makes it Run agent's default trigger.
 */
const NODES: readonly TestNode[] = [
  ['t-manual', 'manualTrigger'],
  ['d-land', 'asset', { name: 'Abu Dhabi land use', params: { assetId: 'ast_land' } }],
  ['d-sites', 'asset', { name: 'High Risk Contaminated Sites', params: { assetId: 'ast_sites' } }],
  ['f-sites', 'filter', { name: 'Expired permits', params: { where: conditionGroup({ id: 'c_permit', field: 'permit_status', operator: 'text__equals', value: 'expired' }) } }],
  [
    'c-asset',
    'createAsset',
    { name: 'Expired permits chart', params: { title: 'Anomalies by site', chartType: 'bar', mapping: { x: 'site', y: 'anomalies' }, refresh: 'update' } },
  ],
  [
    'a-gis',
    'gisCorrelationAgent',
    {
      params: {
        instructions: 'Which land use do the high-risk sites sit in?',
        bottomRef: 'd-land',
        upper: { kind: 'events' },
        bottom: { kind: 'land_type', class_field: 'land_type' },
      },
    },
  ],
  ['o-findings', 'aiFindings', { params: { instructions: 'Focus on sites near residential land.' } }],
  [
    'd-readings',
    'source',
    {
      name: 'Sensor readings',
      params: {
        mode: 'query',
        sourceId: 'src_envdb',
        query: 'SELECT station, district, reading_date, pm10 FROM sensor_readings ORDER BY reading_date',
      },
    },
  ],
  [
    'd-forecast',
    'forecast',
    { name: 'PM10 outlook', params: { timeColumn: 'reading_date', targetColumn: 'pm10', seriesIdColumns: ['station'], grain: 'day', horizon: 7, onRefuse: 'fail' } },
  ],
  [
    'f-threshold',
    'ifElse',
    {
      name: 'Above 120 µg/m³',
      params: {
        when: {
          combinator: 'and',
          conditions: [
            { id: 'c_forecast', field: 'FORECAST', operator: 'number__greater_than', value: '120' },
            { id: 'c_future', field: 'IS_HISTORY', operator: 'boolean__is_false', value: '' },
          ],
        },
      },
    },
  ],
  [
    'x-chat',
    'sendChatMessage',
    { name: 'Alert field ops', params: { mode: 'send_message', message: 'PM10 is forecast above 120 µg/m³ at {{SERIES_ID}} from {{TS}}.' } },
  ],
  ['d-merge', 'merge'],
  [
    'a-insight',
    'insightGenerator',
    { params: { instructions: 'Say which sites and stations need action this week.', fields: ['headline', 'evidence', 'recommended_action'], insightType: 'summary' } },
  ],
  ['o-briefing', 'briefingAgent'],
  [
    'x-email',
    'sendEmail',
    {
      params: {
        to: 'ops@llumen.ai',
        subject: 'Contamination watch: {{insight_generator.headline}}',
        body: '{{insight_generator.evidence}}\n\nNext step: {{insight_generator.recommended_action}}',
      },
    },
  ],
  [
    'n-start',
    'stickyNote',
    { note: 'Run agent starts from Manual Trigger. Publish before relying on the morning schedule.', sticky: { color: 'yellow' } },
  ],
  [
    'n-report',
    'stickyNote',
    { note: '• Briefing goes to the director on Mondays\n• Check the wording with comms first', sticky: { color: 'violet', author: 'Layla Haddad' } },
  ],
]

const LINKS: readonly TestLink[] = [
  ['t-manual', 'd-land'],
  ['d-land', 'd-sites'],
  ['d-sites', 'f-sites'],
  ['f-sites', 'c-asset', 'kept'],
  ['d-sites', 'a-gis'],
  ['a-gis', 'o-findings'],
  ['t-manual', 'd-readings'],
  ['d-readings', 'd-forecast'],
  ['d-forecast', 'f-threshold'],
  ['f-threshold', 'x-chat', 'true'],
  ['f-sites', 'd-merge', 'kept', 'input1'],
  ['f-threshold', 'd-merge', 'true', 'input2'],
  ['d-merge', 'a-insight'],
  ['a-insight', 'o-briefing'],
  ['a-insight', 'x-email'],
]

/** Each section frames whole layout columns, so it never takes in a node from another section. */
const SECTIONS: readonly { id: string; name: string; fill: string; members: readonly string[] }[] = [
  { id: 'test-section-data', name: 'Load data', fill: '#4f7cff', members: ['d-land', 'd-sites', 'd-readings', 'd-forecast'] },
  { id: 'test-section-analyse', name: 'Analyse and alert', fill: '#22c3b0', members: ['f-sites', 'a-gis', 'f-threshold', 'c-asset', 'o-findings', 'x-chat', 'd-merge'] },
  { id: 'test-section-report', name: 'Report', fill: '#a855f7', members: ['a-insight', 'o-briefing', 'x-email', 'n-report'] },
]

const COMMENT_TIME = Date.UTC(2026, 9, 22, 5, 40)

/** Pinned near each node's top-right corner, so they move with it. */
const COMMENTS: readonly { id: string; nodeId: string; text: string; author: string; minutesAgo: number }[] = [
  { id: 'test-comment-land', nodeId: 'd-land', text: 'This land use layer is from 2024. Ask GIS for the 2026 update.', author: 'Omar Saeed', minutesAgo: 95 },
  { id: 'test-comment-threshold', nodeId: 'f-threshold', text: 'Should this be 100? The WHO daily guideline is 45 µg/m³.', author: 'Layla Haddad', minutesAgo: 40 },
  { id: 'test-comment-email', nodeId: 'x-email', text: 'Add the field ops lead in CC?', author: 'You', minutesAgo: 5 },
]
const COMMENT_INSET = { right: 24, top: 16 }

/** Room between the flow and the notes placed around it. */
const NOTE_GAP = 64
const TITLE_SIZE = 40
const SUBTITLE_SIZE = 16

/**
 * Sections, texts, comments, and sticky note spots for the test workflow, fitted to where the nodes
 * landed; `size` is each node's measured size, or an estimate before the cards are measured.
 */
export function annotateTestFlow(positions: Readonly<Record<string, Point>>, size: (id: string) => Size) {
  const box = (id: string) => ({ ...positions[id], ...size(id) })
  const notes: Record<string, Point> = {}

  const trigger = box('t-manual')
  notes['n-start'] = { x: trigger.x, y: trigger.y + trigger.h + NOTE_GAP }
  const reportNodes = boundsOf(['a-insight', 'o-briefing', 'x-email'].map(box))
  if (reportNodes) notes['n-report'] = { x: reportNodes.x, y: reportNodes.y + reportNodes.h + NOTE_GAP }
  const place = (id: string) => (notes[id] ? { ...notes[id], ...size(id) } : box(id))

  const sections: CanvasSection[] = SECTIONS.flatMap(({ id, name, fill, members }) => {
    const bounds = boundsOf(members.map(place))
    if (!bounds) return []
    return [
      {
        id,
        name,
        fill,
        fillOpacity: SECTION_DEFAULTS.fillOpacity,
        stroke: SECTION_DEFAULTS.stroke,
        x: Math.round(bounds.x - SECTION_FIT_PADDING),
        y: Math.round(bounds.y - SECTION_FIT_PADDING),
        w: Math.round(bounds.w + SECTION_FIT_PADDING * 2),
        h: Math.round(bounds.h + SECTION_FIT_PADDING * 2),
      },
    ]
  })

  const top = Math.min(trigger.y, ...sections.map((section) => section.y)) - 200
  const texts: CanvasText[] = [
    { id: 'test-text-title', x: trigger.x, y: top, text: 'Contamination watch', size: TITLE_SIZE },
    { id: 'test-text-subtitle', x: trigger.x, y: top + 64, text: 'Expired permits and PM10 forecasts, checked every morning.', size: SUBTITLE_SIZE },
  ]

  const comments: CanvasComment[] = COMMENTS.flatMap(({ id, nodeId, text, author, minutesAgo }) =>
    positions[nodeId]
      ? [{ id, nodeId, x: size(nodeId).w - COMMENT_INSET.right, y: COMMENT_INSET.top, text, author, createdAt: COMMENT_TIME - minutesAgo * 60_000 }]
      : [],
  )

  return { notes, sections, texts, comments }
}

/** A short, branching workflow for exercising runs and the run animation. */
export function buildTestWorkflow(): { nodes: CanvasNode[]; edges: WorkflowEdge[] } {
  const nodes = NODES.map(([id, typeId, config]) => createNode(NODE_TYPES_BY_ID[typeId], id, config))
  const edges = LINKS.map(([from, to, fromPort = 'out', toPort = 'in']) => ({
    id: `test-${from}-${fromPort}-${to}-${toPort}`,
    from,
    fromPort,
    to,
    toPort,
  }))
  return { nodes, edges }
}
