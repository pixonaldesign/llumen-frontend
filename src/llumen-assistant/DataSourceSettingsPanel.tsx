import { useState, type ReactNode } from 'react'
import { CheckCircle, Database, Diamond, GridFour, Play } from '@phosphor-icons/react'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import styles from './DataSourceSettingsPanel.module.css'

export type DataSourceSettingsVariant = 'api' | 'map'

type RequestTab = 'Parameters' | 'Authentication' | 'Headers' | 'Body' | 'Scripts'

type QueryParam = {
  key: string
  value: string
}

const REQUEST_TABS: RequestTab[] = ['Parameters', 'Authentication', 'Headers', 'Body', 'Scripts']

const DEMO_METHOD = 'GET'
const DEMO_URL =
  'https://weather.secureclient.com/api/v1/current?location=New York&units=metric'
const DEMO_PARAMS: QueryParam[] = [
  { key: 'location', value: 'New York' },
  { key: 'units', value: 'metric' },
]

const DEMO_CONNECTION = {
  title: 'Production MySQL',
  endpoint: 'mysql.prod.company.com:3306 - production_db',
  status: 'Connection established',
}

/** Simple token highlight for the demo SQL block (keywords / strings). */
const DEMO_SQL_LINES: {
  kind: 'blank' | 'code'
  parts?: { text: string; tone?: 'kw' | 'str' | 'plain' }[]
}[] = [
  {
    kind: 'code',
    parts: [{ text: 'SELECT', tone: 'kw' }],
  },
  {
    kind: 'code',
    parts: [{ text: '    g.grid_id,', tone: 'plain' }],
  },
  {
    kind: 'code',
    parts: [{ text: '    g.longitude,', tone: 'plain' }],
  },
  {
    kind: 'code',
    parts: [{ text: '    g.latitude,', tone: 'plain' }],
  },
  {
    kind: 'code',
    parts: [{ text: '    g.area_size_km2,', tone: 'plain' }],
  },
  {
    kind: 'code',
    parts: [{ text: '    p.population_count,', tone: 'plain' }],
  },
  {
    kind: 'code',
    parts: [
      { text: '    p.population_count / g.area_size_km2 ', tone: 'plain' },
      { text: 'as', tone: 'kw' },
      { text: ' population_density', tone: 'plain' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: 'FROM', tone: 'kw' },
      { text: ' grid g', tone: 'plain' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: 'JOIN', tone: 'kw' },
      { text: ' population_data p ', tone: 'plain' },
      { text: 'ON', tone: 'kw' },
      { text: ' g.grid_id = p.grid_id', tone: 'plain' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: 'WHERE', tone: 'kw' },
      { text: ' g.district_name = ', tone: 'plain' },
      { text: "'Abu Dhabi Island'", tone: 'str' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: '  ', tone: 'plain' },
      { text: 'AND', tone: 'kw' },
      { text: ' p.date ', tone: 'plain' },
      { text: 'BETWEEN', tone: 'kw' },
      { text: ' ', tone: 'plain' },
      { text: "'2024-04-10 00:00:00'", tone: 'str' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: '  ', tone: 'plain' },
      { text: 'AND', tone: 'kw' },
      { text: ' ', tone: 'plain' },
      { text: "'2024-04-12 23:59:59'", tone: 'str' },
    ],
  },
  {
    kind: 'code',
    parts: [
      { text: 'ORDER BY', tone: 'kw' },
      { text: ' population_density ', tone: 'plain' },
      { text: 'DESC', tone: 'kw' },
      { text: ';', tone: 'plain' },
    ],
  },
]

function SourceCard({
  label,
  icon,
  iconTone,
  title,
  subtitle,
}: {
  label: string
  icon: ReactNode
  iconTone: 'api' | 'request'
  title: string
  subtitle?: string
}) {
  return (
    <section className={styles.block}>
      <h4 className={styles.blockLabel}>{label}</h4>
      <div className={styles.sourceCard}>
        <div className={styles.sourceCardMain}>
          <span
            className={`${styles.sourceCardIcon} ${
              iconTone === 'api' ? styles.sourceCardIconApi : styles.sourceCardIconRequest
            }`}
          >
            {icon}
          </span>
          <div className={styles.sourceCardText}>
            <span className={styles.sourceCardTitle}>{title}</span>
            {subtitle ? <span className={styles.sourceCardSubtitle}>{subtitle}</span> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function QueryParamRow({ row }: { row: QueryParam }) {
  return (
    <div className={styles.paramRow}>
      <span className={styles.paramCell}>{row.key}</span>
      <span className={styles.paramCell}>{row.value}</span>
    </div>
  )
}

function ApiDataSourceSettings() {
  const [requestTab, setRequestTab] = useState<RequestTab>('Parameters')
  const scrollRef = useRevealScrollbarOnScroll()

  return (
    <div className={styles.root}>
      <div ref={scrollRef} className={styles.scroll}>
        <div className={styles.step}>
          <SourceCard
            label="Selected Data Source Type"
            iconTone="api"
            icon={<Diamond size={20} weight="fill" aria-hidden />}
            title="API"
          />

          <SourceCard
            label="API Request"
            iconTone="request"
            icon={<GridFour size={20} weight="fill" aria-hidden />}
            title="Get Current Weather"
            subtitle="Collection: Weather Services"
          />

          <div className={styles.urlBar}>
            <span className={styles.method} aria-label="HTTP method">
              {DEMO_METHOD}
            </span>
            <span className={styles.urlValue} title={DEMO_URL}>
              {DEMO_URL}
            </span>
          </div>

          <section className={styles.request}>
            <h3 className={styles.requestTitle}>Request</h3>
            <div className={styles.requestTabs} role="tablist" aria-label="Request configuration">
              {REQUEST_TABS.map((tab) => {
                const active = requestTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.requestTab}${active ? ` ${styles.requestTabActive}` : ''}`}
                    onClick={() => setRequestTab(tab)}
                  >
                    {tab}
                  </button>
                )
              })}
            </div>

            {requestTab === 'Parameters' ? (
              <div className={styles.requestPanel}>
                <section className={styles.block}>
                  <h4 className={styles.blockLabel}>Query Params</h4>
                  <div className={styles.paramTable}>
                    <div className={styles.paramTableHead}>
                      <span>Key</span>
                      <span>Value</span>
                    </div>
                    {DEMO_PARAMS.map((row) => (
                      <QueryParamRow key={row.key} row={row} />
                    ))}
                  </div>
                </section>

                <section className={styles.block}>
                  <h4 className={styles.blockLabel}>Path Variables</h4>
                  <div className={styles.paramTable}>
                    <div className={`${styles.paramRow} ${styles.paramRowPair}`}>
                      <span className={`${styles.paramCell} ${styles.paramCellMuted}`}>Key</span>
                      <span className={`${styles.paramCell} ${styles.paramCellMuted}`}>Value</span>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className={`${styles.requestPanel} ${styles.requestPanelPlaceholder}`}>
                <p>{requestTab} configuration is not available in this preview.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function MapDataSourceSettings() {
  const scrollRef = useRevealScrollbarOnScroll()

  return (
    <div className={styles.root}>
      <div ref={scrollRef} className={styles.scroll}>
        <div className={`${styles.step} ${styles.mapStep}`}>
          <section className={styles.block}>
            <h4 className={styles.mapBlockLabel}>Database Connection</h4>
            <div className={styles.connectionCard}>
              <div className={styles.connectionMain}>
                <span className={styles.connectionIcon} aria-hidden>
                  <Database size={20} weight="fill" />
                </span>
                <div className={styles.connectionText}>
                  <span className={styles.connectionTitle}>{DEMO_CONNECTION.title}</span>
                  <span className={styles.connectionEndpoint}>{DEMO_CONNECTION.endpoint}</span>
                </div>
              </div>
              <div className={styles.connectionMeta}>
                <span className={styles.connectionStatus}>
                  <CheckCircle size={16} weight="fill" aria-hidden />
                  {DEMO_CONNECTION.status}
                </span>
              </div>
            </div>
          </section>

          <section className={styles.querySection}>
            <div className={styles.queryHeader}>
              <h3 className={styles.queryTitle}>Query</h3>
              <button type="button" className={styles.runBtn}>
                <Play size={14} weight="fill" aria-hidden />
                Run Query
              </button>
            </div>
            <pre className={styles.sqlBlock} tabIndex={0}>
              <code>
                {DEMO_SQL_LINES.map((line, index) =>
                  line.kind === 'blank' ? (
                    <span key={index} className={styles.sqlLine}>
                      {'\n'}
                    </span>
                  ) : (
                    <span key={index} className={styles.sqlLine}>
                      {line.parts?.map((part, partIndex) => (
                        <span
                          key={`${index}-${partIndex}`}
                          className={
                            part.tone === 'kw'
                              ? styles.sqlKw
                              : part.tone === 'str'
                                ? styles.sqlStr
                                : undefined
                          }
                        >
                          {part.text}
                        </span>
                      ))}
                      {'\n'}
                    </span>
                  ),
                )}
              </code>
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}

export function DataSourceSettingsPanel({
  variant = 'api',
}: {
  variant?: DataSourceSettingsVariant
}) {
  if (variant === 'map') {
    return <MapDataSourceSettings />
  }
  return <ApiDataSourceSettings />
}
