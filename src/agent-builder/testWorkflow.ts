import { COMMENT_AUTHOR, SECTION_DEFAULTS, SECTION_FIT_PADDING, boundsOf, type CanvasComment, type CanvasSection, type CanvasText } from './canvasItems'
import { conditionGroup } from './conditions'
import { NODE_TYPES_BY_ID, createNode, type CanvasNode, type NodeConfig, type Point, type Size, type WorkflowEdge } from './nodeCatalog'
type TestNode = [id: string, typeId: string, config?: NodeConfig]
/** `from` and `to` are node ids; ports default to `out` and `in`. */
type TestLink = [from: string, to: string, fromPort?: string, toPort?: string]

/**
 * Contamination and air quality watch. Sites are scored and compared with land use, wind is laid over
 * the same land, expired permits become a table, and a PM10 forecast raises an alert where it crosses
 * 120 µg/m³; the high-risk sites and the alerts are merged for the app and the email.
 * Ordered so the manual trigger comes first, which makes it Run agent's default trigger.
 */
const NODES: readonly TestNode[] = [
  ['t-manual', 'manualTrigger'],
  ['t-schedule', 'scheduleTrigger', { name: 'Every morning', params: { every: 1, unit: 'days', atHour: 7, atMinute: 0, timezone: 'Asia/Dubai', ends: 'after', endAfter: 3, endAfterUnit: 'months' } }],
  ['t-chat', 'chatInput', { name: 'Field ops chat', params: { testMessage: 'Is any station heading over the PM10 limit this week?' } }],
  ['d-land', 'asset', { name: 'Abu Dhabi land use', params: { assetId: 'ast_land' } }],
  ['d-permits', 'asset', { name: 'Permit register', params: { assetId: 'ast_permits' } }],
  ['d-anomalies', 'asset', { name: 'Detected Contamination Anomalies', params: { assetId: 'ast_anomalies' } }],
  ['d-emissions', 'asset', { name: 'CO₂ by facility this week', params: { assetId: 'ast_emissions' } }],
  ['d-sites', 'asset', { name: 'High Risk Contaminated Sites', params: { assetId: 'ast_sites' } }],
  ['d-wind', 'asset', { name: 'Wind at monitoring stations', params: { assetId: 'ast_wind' } }],
  [
    'c-landmix',
    'createAsset',
    { name: 'Land use mix', params: { title: 'Land use by area', chartType: 'pie', mapping: { category: 'land_type', value: 'area_km2' }, refresh: 'update' } },
  ],
  ['f-expired', 'filter', { name: 'Expired permits', params: { where: conditionGroup({ id: 'c_permit', field: 'status', operator: 'text__equals', value: 'expired' }) } }],
  ['c-permits', 'createAsset', { name: 'Expired permits table', params: { title: 'Expired permits', chartType: 'table', mapping: {}, refresh: 'update' } }],
  ['m-risk', 'mlModel', { name: 'Score site risk', params: { modelId: 'mdl_risk' } }],
  [
    's-risk',
    'switchCases',
    {
      name: 'Risk band',
      params: {
        cases: [
          { id: 'high', label: 'High risk', when: conditionGroup({ id: 'c_high', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.8' }) },
          { id: 'watch', label: 'Watch', when: conditionGroup({ id: 'c_watch', field: 'risk', operator: 'number__greater_than_or_equal', value: '0.6' }) },
        ],
        sendToAllMatching: false,
      },
    },
  ],
  ['c-watch', 'createAsset', { name: 'Sites to watch', params: { title: 'Sites to watch', chartType: 'map:heatmap', mapping: {}, refresh: 'update' } }],
  [
    'a-gis',
    'gisCorrelationAgent',
    {
      name: 'Sites on land use',
      params: {
        instructions: 'Which land use do the high-risk sites sit in?',
        bottomRef: 'd-land',
        upper: { kind: 'events' },
        bottom: { kind: 'land_type', class_field: 'land_type' },
      },
    },
  ],
  [
    'a-gis-wind',
    'gisCorrelationAgent',
    {
      name: 'Wind over land use',
      params: {
        instructions: 'Which land use is downwind of the stations this morning?',
        bottomRef: 'd-land',
        upper: { kind: 'wind', speed_field: 'ws', direction_field: 'wd' },
        bottom: { kind: 'land_type', class_field: 'land_type' },
      },
    },
  ],
  [
    'o-findings',
    'aiFindings',
    {
      params: {
        instructions: 'Focus on sites near residential land.',
        alerts: {
          enabled: true,
          criteria: 'Raise an alert when a high-risk site is running on an expired permit.',
          rules: [
            {
              id: 'rule_expired',
              label: 'Expired permits',
              level: 'alert',
              combinator: 'or',
              groups: [
                {
                  id: 'grp_expired',
                  combinator: 'and',
                  conditions: [{ id: 'ac_expired', type: 'data', sourceNodeId: 'd-sites', field: 'permit_status', measure: 'any_row', operator: 'text__equals', value: 'expired' }],
                },
              ],
            },
            {
              id: 'rule_severe',
              label: 'Severe hotspot',
              level: 'critical_alert',
              combinator: 'or',
              groups: [
                {
                  id: 'grp_severe',
                  combinator: 'and',
                  conditions: [{ id: 'ac_severe', type: 'data', sourceNodeId: 'd-sites', field: 'anomalies', measure: 'max', operator: 'number__greater_than', value: '20' }],
                },
              ],
            },
          ],
        },
      },
    },
  ],
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
    'a-daily',
    'aggregate',
    {
      name: 'PM10 per station',
      params: {
        groupBy: ['station'],
        metrics: [
          { id: 'm_avg', fn: 'avg', field: 'pm10', as: 'avg_pm10' },
          { id: 'm_peak', fn: 'max', field: 'pm10', as: 'peak_pm10' },
        ],
      },
    },
  ],
  ['c-pm10', 'createAsset', { name: 'PM10 by station', params: { title: 'Average PM10 by station', chartType: 'bar', mapping: { x: 'station', y: 'avg_pm10' }, refresh: 'update' } }],
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
    {
      name: 'Alert field ops',
      params: {
        mode: 'send_and_wait',
        responseType: 'approval',
        message: 'PM10 is forecast above 120 µg/m³ at {{SERIES_ID}} from {{TS}}. Send a field team?',
        approveLabel: 'Send a team',
        rejectLabel: 'Not now',
      },
    },
  ],
  [
    'x-api',
    'sendApiRequest',
    {
      name: 'Open AirWatch incident',
      params: {
        mode: 'direct',
        method: 'POST',
        url: 'https://api.airwatch.ae/v1/incidents',
        headers: [{ id: 'h_type', key: 'Content-Type', value: 'application/json' }],
        body: '{\n  "station": "{{SERIES_ID}}",\n  "forecast_pm10": {{FORECAST}},\n  "day": "{{TS}}"\n}',
      },
    },
  ],
  ['d-merge', 'merge', { name: 'Sites and alerts' }],
  [
    'a-insight',
    'insightGenerator',
    { params: { instructions: 'Say which sites and stations need action this week.', fields: ['headline', 'evidence', 'recommended_action'], insightType: 'summary' } },
  ],
  ['a-analyst', 'dataAnalyst', { params: { instructions: 'Which sites and stations are outliers against the rest?' } }],
  ['o-app', 'createApp', { name: 'Outliers app', params: { instructions: 'Build an executive app on this week’s contamination outliers.', navigation: 'tabs' } }],
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
    {
      note: 'Run agent starts from Manual Trigger; Every morning takes over once the flow is published. Run Field ops chat to see Alert field ops wait for a reply.',
      sticky: { color: 'yellow' },
    },
  ],
  [
    'n-report',
    'stickyNote',
    { note: '• The email goes to ops after every run\n• Check the wording with comms first', sticky: { color: 'violet', author: 'Layla Haddad' } },
  ],
]

const LINKS: readonly TestLink[] = [
  ['t-manual', 'd-land'],
  ['t-schedule', 'd-land'],
  ['t-manual', 'd-readings'],
  ['t-schedule', 'd-readings'],
  ['t-chat', 'd-readings'],
  ['t-manual', 'd-permits'],
  ['t-schedule', 'd-permits'],
  ['t-manual', 'd-anomalies'],
  ['t-schedule', 'd-anomalies'],
  ['t-manual', 'd-emissions'],
  ['t-schedule', 'd-emissions'],
  ['d-land', 'd-sites'],
  ['d-land', 'd-wind'],
  ['d-land', 'c-landmix'],
  ['d-permits', 'f-expired'],
  ['f-expired', 'c-permits', 'kept'],
  ['d-sites', 'm-risk'],
  ['d-sites', 'a-gis'],
  ['d-wind', 'a-gis-wind'],
  ['a-gis', 'o-findings'],
  ['a-gis-wind', 'o-findings'],
  ['m-risk', 's-risk'],
  ['s-risk', 'c-watch', 'watch'],
  ['d-readings', 'd-forecast'],
  ['d-readings', 'a-daily'],
  ['a-daily', 'c-pm10'],
  ['d-forecast', 'f-threshold'],
  ['f-threshold', 'x-chat', 'true'],
  ['f-threshold', 'x-api', 'true'],
  ['s-risk', 'd-merge', 'high', 'input1'],
  ['f-threshold', 'd-merge', 'true', 'input2'],
  ['d-merge', 'a-insight'],
  ['d-merge', 'a-analyst'],
  ['d-emissions', 'a-insight'],
  ['d-anomalies', 'a-analyst'],
  ['a-analyst', 'o-app'],
  ['c-pm10', 'o-app'],
  ['c-watch', 'o-app'],
  ['a-insight', 'x-email'],
]

/** Each section frames whole layout columns, so it never takes in a node from another section. */
const SECTIONS: readonly { id: string; name: string; fill: string; members: readonly string[] }[] = [
  {
    id: 'test-section-data',
    name: 'Load data',
    fill: '#4f7cff',
    members: ['d-land', 'd-readings', 'd-permits', 'd-anomalies', 'd-emissions', 'd-sites', 'd-wind', 'c-landmix', 'f-expired', 'd-forecast', 'a-daily'],
  },
  {
    id: 'test-section-analyse',
    name: 'Score, map, and alert',
    fill: '#22c3b0',
    members: ['m-risk', 'a-gis', 'a-gis-wind', 'c-permits', 'f-threshold', 'c-pm10', 's-risk', 'o-findings', 'x-chat', 'x-api'],
  },
  { id: 'test-section-report', name: 'Report', fill: '#a855f7', members: ['c-watch', 'd-merge', 'a-insight', 'a-analyst', 'o-app', 'x-email', 'n-report'] },
]

const REPORT_NODES = ['a-insight', 'a-analyst', 'o-app', 'x-email']

const COMMENT_TIME = Date.now()

type SeedMessage = { text: string; author: string; minutesAgo: number }

/** Pinned near each node's top-right corner, so they move with it. */
const COMMENTS: readonly { id: string; nodeId: string; unread?: boolean; messages: readonly SeedMessage[] }[] = [
  {
    id: 'test-comment-land',
    nodeId: 'd-land',
    messages: [
      { text: 'This land use layer is from 2024. Ask GIS for the 2026 update.', author: 'Omar Saeed', minutesAgo: 95 },
      { text: 'Asked them this morning, they’ll send it by Thursday.', author: COMMENT_AUTHOR, minutesAgo: 80 },
    ],
  },
  {
    id: 'test-comment-threshold',
    nodeId: 'f-threshold',
    unread: true,
    messages: [{ text: 'Should this be 100? The WHO daily guideline is 45 µg/m³.', author: 'Layla Haddad', minutesAgo: 40 }],
  },
  {
    id: 'test-comment-permits',
    nodeId: 'c-permits',
    messages: [
      { text: 'Can the table show who inspected each site?', author: 'Sara Al Mansoori', minutesAgo: 300 },
      { text: 'Once the inspections sheet is joined in, yes.', author: COMMENT_AUTHOR, minutesAgo: 240 },
    ],
  },
  {
    id: 'test-comment-wind',
    nodeId: 'a-gis-wind',
    unread: true,
    messages: [{ text: 'Shahama AQ-4 has been offline since Tuesday, so its wind is a day old.', author: 'Omar Saeed', minutesAgo: 12 }],
  },
  {
    id: 'test-comment-email',
    nodeId: 'x-email',
    unread: true,
    messages: [
      { text: 'Add the field ops lead in CC?', author: COMMENT_AUTHOR, minutesAgo: 25 },
      { text: '@Mahmoud Khairy yes, and keep the director in To.', author: 'Layla Haddad', minutesAgo: 3 },
    ],
  },
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
  const triggers = boundsOf(['t-manual', 't-schedule', 't-chat'].map(box)) ?? trigger
  notes['n-start'] = { x: triggers.x, y: triggers.y + triggers.h + NOTE_GAP }
  const reportNodes = boundsOf(REPORT_NODES.map(box))
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
    { id: 'test-text-title', x: trigger.x, y: top, text: 'Contamination and air quality watch', size: TITLE_SIZE },
    { id: 'test-text-subtitle', x: trigger.x, y: top + 64, text: 'Sites, permits, wind, and PM10 forecasts, checked every morning at 7:00.', size: SUBTITLE_SIZE },
  ]

  const comments: CanvasComment[] = COMMENTS.flatMap(({ id, nodeId, unread, messages }) =>
    positions[nodeId]
      ? [
          {
            id,
            nodeId,
            unread,
            x: size(nodeId).w - COMMENT_INSET.right,
            y: COMMENT_INSET.top,
            messages: messages.map(({ text, author, minutesAgo }, index) => ({
              id: `${id}-${index}`,
              text,
              author,
              createdAt: COMMENT_TIME - minutesAgo * 60_000,
            })),
          },
        ]
      : [],
  )

  return { notes, sections, texts, comments }
}

/** A large, branching workflow for exercising runs and the run animation. */
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
