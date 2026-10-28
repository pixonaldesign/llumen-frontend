import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  ChartLine,
  Chalkboard,
  CheckCircle,
  Clock,
  Database,
  DiamondsFour,
  FlowArrow,
  FunnelSimple,
  GearSix,
  Image as ImageIcon,
  Lightning,
  ListDashes,
  Play,
  Plus,
  Robot,
  SlidersHorizontal,
  Sparkle,
  TextAa,
  TreeStructure,
  UploadSimple,
  UsersThree,
} from '@phosphor-icons/react'
import {
  STUDIO_APIS,
  STUDIO_ASSETS,
  STUDIO_BRIEFINGS,
  STUDIO_DASHBOARDS,
  STUDIO_DATABASES,
  STUDIO_FILES,
  STUDIO_FILTERS,
  STUDIO_MEMBERS,
  STUDIO_ROOMS,
  STUDIO_SLIDES,
  STUDIO_WORKFLOWS,
  type ApiRequest,
  type FilterKind,
  type StudioStory,
  type StudioWorkflow,
} from './studioData'
import {
  Button,
  Dropdown,
  EmptyState,
  KindChip,
  LayoutToggle,
  RowMenu,
  SearchField,
  SortMenu,
  StatusChip,
  Tag,
  TextSegments,
  type Layout,
} from './studioUi'
import { useRefine } from './studioHooks'
import { STUDIO_ASSET_CHARTS } from './studioAssetCharts'
import { StudioAssetChart } from './StudioAssetChart'
import styles from './StudioView.module.css'

type Column = { label: string; width?: number }

function columnTemplate(columns: Column[]) {
  return columns.map((column) => (column.width ? `${column.width}px` : 'minmax(0, 1fr)')).join(' ')
}

/**
 * The page's sticky head: title and search with the create button, an optional row of filters, and the
 * table's column labels in list layouts.
 */
function PageHead({
  title,
  titleExtra,
  placeholder,
  query,
  onQuery,
  action,
  actionIcon = <Plus size={20} aria-hidden />,
  onAction,
  filters,
  tools,
  columns,
}: {
  title: string
  titleExtra?: ReactNode
  placeholder: string
  query: string
  onQuery: (value: string) => void
  action: string
  actionIcon?: ReactNode
  onAction?: () => void
  filters?: ReactNode
  tools?: ReactNode
  columns?: Column[]
}) {
  return (
    <div className={styles.head}>
      <div className={styles.titleBar}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{title}</h2>
          {titleExtra}
        </div>
        <div className={styles.controls}>
          <SearchField placeholder={placeholder} value={query} onChange={onQuery} />
          <Button icon={actionIcon} onClick={onAction}>
            {action}
          </Button>
        </div>
      </div>
      {filters || tools ? (
        <div className={styles.toolbar}>
          <div className={styles.toolGroup}>{filters}</div>
          <div className={styles.toolGroup}>{tools}</div>
        </div>
      ) : null}
      {columns ? (
        <div className={styles.tableHead} style={{ '--cols': columnTemplate(columns) } as CSSProperties}>
          {columns.map((column, index) => (
            <span key={`${column.label}-${index}`}>{column.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Row({ columns, children, onClick }: { columns: Column[]; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      className={styles.row}
      style={{ '--cols': columnTemplate(columns) } as CSSProperties}
      onClick={onClick}
      data-clickable={onClick ? 'true' : undefined}
    >
      {children}
    </div>
  )
}

function Cell({ children }: { children: ReactNode }) {
  return <span className={styles.cell}>{children}</span>
}

function NoResults() {
  return <p className={styles.noResults}>Nothing matches these filters.</p>
}

/** Two lines in a table's first column: a name over a muted detail. */
function NameBlock({ name, detail, extra }: { name: string; detail?: ReactNode; extra?: ReactNode }) {
  return (
    <span className={styles.nameBlock}>
      <span className={styles.name}>{name}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      {extra}
    </span>
  )
}

/* ---------------------------------------------------------------- Assets */

const ASSET_COLUMNS: Column[] = [
  { label: 'Asset' },
  { label: 'Category', width: 160 },
  { label: 'Type', width: 160 },
  { label: 'Status', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 32 },
]

export function AssetsPage({ onCreate }: { onCreate: () => void }) {
  const [layout, setLayout] = useState<Layout>('grid')
  const list = useRefine(STUDIO_ASSETS, {
    text: (item) => `${item.title} ${item.description}`,
    name: (item) => item.title,
    updated: (item) => item.updated,
    fields: {
      Category: (item) => item.category,
      Type: (item) => item.type,
      Status: (item) => item.status,
    },
  })
  return (
    <>
      <PageHead
        title="Assets"
        placeholder="Search assets..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Asset"
        onAction={onCreate}
        filters={(['Category', 'Type', 'Status'] as const).map((key) => (
          <Dropdown
            key={key}
            label={key}
            options={list.options[key]}
            value={list.filter(key)}
            onChange={(value) => list.setFilter(key, value)}
          />
        ))}
        tools={
          <>
            <LayoutToggle value={layout} onChange={setLayout} />
            <SortMenu value={list.sort} onChange={list.setSort} />
          </>
        }
        columns={layout === 'list' ? ASSET_COLUMNS : undefined}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : layout === 'grid' ? (
        <div className={`${styles.grid} ${styles.assetGrid}`}>
          {list.rows.map((item, index) => (
            <article key={item.id} className={styles.assetCard} aria-label={item.title}>
              <div className={styles.assetImage}>
                {STUDIO_ASSET_CHARTS[item.id] ? (
                  <StudioAssetChart chart={STUDIO_ASSET_CHARTS[item.id]} delay={Math.min(index, 8) * 60} />
                ) : (
                  <img src={item.image} alt={item.title} loading="lazy" />
                )}
              </div>
              <div className={styles.assetMeta}>
                <Tag icon={<ChartLine size={16} aria-hidden />}>{item.type}</Tag>
                <Tag>{item.category}</Tag>
                <span className={styles.metaEnd}>
                  <StatusChip label={item.status} />
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={ASSET_COLUMNS}>
              <span className={styles.lead}>
                <span className={styles.preview}>
                  <img src={item.image} alt="" loading="lazy" />
                </span>
                <NameBlock name={item.title} detail={item.description} />
              </span>
              <Cell>{item.category}</Cell>
              <Cell>{item.type}</Cell>
              <Cell>
                <StatusChip label={item.status} />
              </Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.title} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Filters */

const FILTER_ICON: Record<FilterKind, ReactNode> = {
  dropdown: <ListDashes size={20} aria-hidden />,
  season: <CalendarBlank size={20} aria-hidden />,
  hierarchy: <TreeStructure size={20} aria-hidden />,
  slider: <SlidersHorizontal size={20} aria-hidden />,
  timeseries: <CalendarCheck size={20} aria-hidden />,
  range: <SlidersHorizontal size={20} aria-hidden />,
  text: <TextAa size={20} aria-hidden />,
  user: <UsersThree size={20} aria-hidden />,
}

const FILTER_COLUMNS: Column[] = [
  { label: 'Filter' },
  { label: 'Category', width: 160 },
  { label: 'Type', width: 160 },
  { label: 'Status', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 32 },
]

export function FiltersPage() {
  const list = useRefine(STUDIO_FILTERS, {
    text: (item) => `${item.name} ${item.detail}`,
    name: (item) => item.name,
    updated: (item) => item.updated,
    fields: {
      Category: (item) => item.category,
      Type: (item) => item.type,
      Status: (item) => item.status,
    },
  })
  return (
    <>
      <PageHead
        title="Filters"
        placeholder="Search filters..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Filter"
        filters={(['Category', 'Type', 'Status'] as const).map((key) => (
          <Dropdown
            key={key}
            label={key}
            options={list.options[key]}
            value={list.filter(key)}
            onChange={(value) => list.setFilter(key, value)}
          />
        ))}
        tools={<SortMenu value={list.sort} onChange={list.setSort} />}
        columns={FILTER_COLUMNS}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={FILTER_COLUMNS}>
              <span className={styles.lead}>
                <span className={styles.rowIcon}>{FILTER_ICON[item.kind]}</span>
                <NameBlock name={item.name} detail={item.detail} />
              </span>
              <Cell>{item.category}</Cell>
              <Cell>{item.type}</Cell>
              <Cell>
                <StatusChip label={item.status} />
              </Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.name} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Sources */

const SOURCE_COLUMNS = (first: string, second: string, last = 'Last Updated'): Column[] => [
  { label: first },
  { label: second, width: 160 },
  { label: 'User Status', width: 160 },
  { label: 'Agent Status', width: 160 },
  { label: last, width: 160 },
  { label: '', width: 32 },
]

const DATABASE_COLUMNS = SOURCE_COLUMNS('Database Connections', 'Type')

export function DatabasePage() {
  const list = useRefine(STUDIO_DATABASES, {
    text: (item) => `${item.name} ${item.description}`,
    name: (item) => item.name,
    updated: (item) => item.updated,
    fields: {
      Type: (item) => item.type,
      'User Status': (item) => item.userStatus,
      'Agent Status': (item) => item.agentStatus,
    },
  })
  return (
    <>
      <PageHead
        title="Database"
        placeholder="Search database connections..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Connection"
        filters={(['Type', 'User Status', 'Agent Status'] as const).map((key) => (
          <Dropdown
            key={key}
            label={key}
            options={list.options[key]}
            value={list.filter(key)}
            onChange={(value) => list.setFilter(key, value)}
          />
        ))}
        tools={<SortMenu value={list.sort} onChange={list.setSort} />}
        columns={DATABASE_COLUMNS}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={DATABASE_COLUMNS}>
              <NameBlock name={item.name} detail={<span className={styles.clamp}>{item.description}</span>} />
              <Cell>{item.type}</Cell>
              <Cell>
                <StatusChip label={item.userStatus} />
              </Cell>
              <Cell>
                <StatusChip label={item.agentStatus} />
              </Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.name} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

const API_COLUMNS = SOURCE_COLUMNS('API Collections & Requests', 'Auth Type')

export function ApisPage() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const requests = STUDIO_APIS.flatMap((collection) => collection.requests)
  const list = useRefine(requests, {
    text: (item) => `${item.name} ${item.description} ${item.url}`,
    name: (item) => item.name,
    updated: (item) => item.updated,
    fields: {
      'Auth Type': (item) => item.auth,
      Method: (item) => item.method,
      'User Status': (item) => item.userStatus,
      'Agent Status': (item) => item.agentStatus,
    },
  })
  const shown = new Set<ApiRequest>(list.rows)
  const narrowed = list.rows.length !== requests.length
  const collections = STUDIO_APIS.map((collection) => ({
    ...collection,
    requests: collection.requests.filter((request) => shown.has(request)),
  })).filter((collection) => !narrowed || collection.requests.length > 0)
  return (
    <>
      <PageHead
        title="API Collections & Requests"
        placeholder="Search collections or requests..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Collection"
        filters={(['Auth Type', 'Method', 'User Status', 'Agent Status'] as const).map((key) => (
          <Dropdown
            key={key}
            label={key}
            options={list.options[key]}
            value={list.filter(key)}
            onChange={(value) => list.setFilter(key, value)}
          />
        ))}
        tools={<SortMenu value={list.sort} onChange={list.setSort} />}
        columns={API_COLUMNS}
      />
      {collections.length === 0 ? (
        <NoResults />
      ) : (
        <div className={styles.table}>
          {collections.map((collection) => {
            const open = !collapsed[collection.id]
            return (
              <div key={collection.id}>
                <Row columns={API_COLUMNS} onClick={() => setCollapsed((prev) => ({ ...prev, [collection.id]: open }))}>
                  <span className={styles.lead}>
                    <button
                      type="button"
                      className={styles.disclosure}
                      data-open={open}
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${collection.name}`}
                    >
                      <CaretDown size={16} aria-hidden />
                    </button>
                    <NameBlock name={collection.name} detail={collection.description} />
                  </span>
                  <Cell>{collection.auth}</Cell>
                  <Cell>
                    <StatusChip label={collection.userStatus} />
                  </Cell>
                  <Cell>
                    <StatusChip label={collection.agentStatus} />
                  </Cell>
                  <Cell>{collection.updated}</Cell>
                  <RowMenu label={collection.name} />
                </Row>
                {open
                  ? collection.requests.map((request) => (
                      <Row key={request.id} columns={API_COLUMNS}>
                        <span className={`${styles.lead} ${styles.nested}`}>
                          <span className={styles.rowIcon}>
                            <DiamondsFour size={20} aria-hidden />
                          </span>
                          <NameBlock
                            name={request.name}
                            detail={
                              <>
                                {request.description}
                                <br />
                                {request.url}
                              </>
                            }
                            extra={
                              <span className={styles.method} data-method={request.method}>
                                {request.method}
                              </span>
                            }
                          />
                        </span>
                        <Cell>{request.auth}</Cell>
                        <Cell>
                          <StatusChip label={request.userStatus} />
                        </Cell>
                        <Cell>
                          <StatusChip label={request.agentStatus} />
                        </Cell>
                        <Cell>{request.updated}</Cell>
                        <RowMenu label={request.name} />
                      </Row>
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/** A page with nothing in it yet: the head over a centred call to create the first one. */
function EmptyPage({
  title,
  placeholder,
  action,
  icon,
  heading,
  body,
}: {
  title: string
  placeholder: string
  action: string
  icon: ReactNode
  heading: string
  body: string
}) {
  const [query, setQuery] = useState('')
  return (
    <>
      <PageHead title={title} placeholder={placeholder} query={query} onQuery={setQuery} action={action} />
      <EmptyState icon={icon} title={heading} body={body} action={action} />
    </>
  )
}

export function ModelsPage() {
  return (
    <EmptyPage
      title="AI Models"
      placeholder="Search models..."
      action="Register Model"
      icon={<DiamondsFour size={32} aria-hidden />}
      heading="No Models Registered"
      body="Create your first deployed model connection to enable predictions across your workspace."
    />
  )
}

export function DataFlowPage() {
  return (
    <EmptyPage
      title="Data Flow"
      placeholder="Search data flows..."
      action="Create Data Flow"
      icon={<FlowArrow size={32} aria-hidden />}
      heading="No Data Flows Yet"
      body="Chain your sources, clean them up and publish the result as a dataset your assets can use."
    />
  )
}

const FILE_COLUMNS = SOURCE_COLUMNS('Name', 'Type', 'Last Tested')

export function FilesPage() {
  const list = useRefine(STUDIO_FILES, {
    text: (item) => `${item.name} ${item.detail}`,
    name: (item) => item.name,
    updated: (item) => item.tested,
    fields: {
      Type: (item) => item.type,
      'User Status': (item) => item.userStatus,
      'Agent Status': (item) => item.agentStatus,
    },
  })
  return (
    <>
      <PageHead
        title="Files"
        placeholder="Search files..."
        query={list.query}
        onQuery={list.setQuery}
        action="Upload File"
        actionIcon={<UploadSimple size={20} aria-hidden />}
        filters={(['Type', 'User Status', 'Agent Status'] as const).map((key) => (
          <Dropdown
            key={key}
            label={key}
            options={list.options[key]}
            value={list.filter(key)}
            onChange={(value) => list.setFilter(key, value)}
          />
        ))}
        tools={<SortMenu value={list.sort} onChange={list.setSort} />}
        columns={FILE_COLUMNS}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={FILE_COLUMNS}>
              <NameBlock name={item.name} detail={<span className={styles.clamp}>{item.detail}</span>} />
              <Cell>{item.type}</Cell>
              <Cell>
                <StatusChip label={item.userStatus} />
              </Cell>
              <Cell>
                <StatusChip label={item.agentStatus} tone={item.agentStatus === 'Inactive' ? 'muted' : undefined} />
              </Cell>
              <Cell>{item.tested}</Cell>
              <RowMenu label={item.name} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Content */

const BRIEFING_COLUMNS: Column[] = [
  { label: 'Briefing' },
  { label: 'Status', width: 160 },
  { label: 'Content', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 32 },
]

export function BriefingsPage() {
  const [layout, setLayout] = useState<Layout>('grid')
  const [scope, setScope] = useState<'Active' | 'Expired'>('Active')
  const scoped = STUDIO_BRIEFINGS.filter((item) => !!item.expired === (scope === 'Expired'))
  const list = useRefine(scoped, {
    text: (item) => item.title,
    name: (item) => item.title,
    updated: (item) => item.updated,
    fields: { Type: (item) => item.kind },
  })
  return (
    <>
      <PageHead
        title="Briefings"
        placeholder="Search briefings..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Briefing"
        filters={
          <>
            <TextSegments
              label="Briefings"
              options={['Active', 'Expired'] as const}
              value={scope}
              onChange={setScope}
            />
            <Dropdown
              label="Type"
              options={list.options.Type}
              value={list.filter('Type')}
              onChange={(value) => list.setFilter('Type', value)}
            />
          </>
        }
        tools={
          <>
            <LayoutToggle value={layout} onChange={setLayout} />
            <SortMenu value={list.sort} onChange={list.setSort} />
          </>
        }
        columns={layout === 'list' ? BRIEFING_COLUMNS : undefined}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : layout === 'grid' ? (
        <div className={`${styles.grid} ${styles.briefingGrid}`}>
          {list.rows.map((item) => (
            <article key={item.id} className={styles.briefingCard} aria-label={item.title}>
              <img src={item.image} alt="" loading="lazy" />
              <span className={styles.briefingShade} aria-hidden />
              <span className={styles.briefingKind}>
                <KindChip kind={item.kind} />
              </span>
              <div className={styles.briefingBody}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <span className={styles.meta}>{item.age}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={BRIEFING_COLUMNS}>
              <span className={styles.lead}>
                <span className={`${styles.preview} ${styles.previewPortrait}`}>
                  <img src={item.image} alt="" loading="lazy" />
                </span>
                <NameBlock
                  name={item.title}
                  extra={
                    <span className={styles.briefingFacts}>
                      <span>
                        <CheckCircle size={16} aria-hidden />
                        {item.expired ? 'Expired' : 'Published'}
                        <i aria-hidden />
                        May 2026
                      </span>
                      <span>
                        <Clock size={16} aria-hidden />
                        Remaining
                        <i aria-hidden />
                        {item.expired ? 'Ended' : '2 days'}
                      </span>
                    </span>
                  }
                />
              </span>
              <Cell>
                <KindChip kind={item.kind} />
              </Cell>
              <Cell>{item.slides} Slides</Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.title} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

const STORY_COLUMNS = (first: string): Column[] => [
  { label: first },
  { label: 'Status', width: 160 },
  { label: 'Content', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 32 },
]

/** Slides and Dashboards: cover cards with a status, a title and their size. */
function StoryLibrary({
  title,
  noun,
  items,
  action,
  unit,
}: {
  title: string
  noun: string
  items: StudioStory[]
  action: string
  unit: string
}) {
  const [layout, setLayout] = useState<Layout>('grid')
  const list = useRefine(items, {
    text: (item) => item.title,
    name: (item) => item.title,
    updated: (item) => item.updated,
    fields: { Status: (item) => item.status },
  })
  const columns = STORY_COLUMNS(noun)
  return (
    <>
      <PageHead
        title={title}
        placeholder={`Search ${title.toLowerCase()}...`}
        query={list.query}
        onQuery={list.setQuery}
        action={action}
        filters={
          <Dropdown
            label="Status"
            options={list.options.Status}
            value={list.filter('Status')}
            onChange={(value) => list.setFilter('Status', value)}
          />
        }
        tools={
          <>
            <LayoutToggle value={layout} onChange={setLayout} />
            <SortMenu value={list.sort} onChange={list.setSort} />
          </>
        }
        columns={layout === 'list' ? columns : undefined}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : layout === 'grid' ? (
        <div className={`${styles.grid} ${styles.storyGrid}`}>
          {list.rows.map((item) => (
            <article key={item.id} className={styles.storyCard} aria-label={item.title}>
              <div className={styles.storyCover}>
                <img src={item.image} alt="" loading="lazy" />
              </div>
              <div className={styles.storyBody}>
                <StatusChip label={item.status} />
                <h3 className={`${styles.cardTitle} ${styles.twoLines}`}>{item.title}</h3>
                <span className={styles.meta}>
                  {item.sections} {unit}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={columns}>
              <span className={styles.lead}>
                <span className={`${styles.preview} ${styles.previewCover}`}>
                  <img src={item.image} alt="" loading="lazy" />
                </span>
                <NameBlock name={item.title} />
              </span>
              <Cell>
                <StatusChip label={item.status} />
              </Cell>
              <Cell>
                {item.sections} {unit}
              </Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.title} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

export function SlidesPage() {
  return <StoryLibrary title="Slides" noun="Slide" items={STUDIO_SLIDES} action="Create Slide" unit="Sections" />
}

export function DashboardsPage() {
  return (
    <StoryLibrary
      title="Dashboards"
      noun="Dashboard"
      items={STUDIO_DASHBOARDS}
      action="Create Dashboard"
      unit="Sections"
    />
  )
}

export function WhiteboardsPage() {
  return (
    <EmptyPage
      title="Whiteboards"
      placeholder="Search whiteboards..."
      action="Create Whiteboard"
      icon={<Chalkboard size={32} aria-hidden />}
      heading="No Whiteboards Yet"
      body="Sketch ideas with your team, pin assets beside them and turn the best ones into slides."
    />
  )
}

const ROOM_COLUMNS: Column[] = [
  { label: 'Command Rooms' },
  { label: 'Status', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 32 },
]

export function RoomsPage() {
  const [layout, setLayout] = useState<Layout>('grid')
  const list = useRefine(STUDIO_ROOMS, {
    text: (item) => item.title,
    name: (item) => item.title,
    updated: (item) => item.updated,
    fields: { Status: (item) => item.status },
  })
  return (
    <>
      <PageHead
        title="Command rooms"
        placeholder="Search command rooms..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Command Room"
        filters={
          <Dropdown
            label="Status"
            options={list.options.Status}
            value={list.filter('Status')}
            onChange={(value) => list.setFilter('Status', value)}
          />
        }
        tools={
          <>
            <LayoutToggle value={layout} onChange={setLayout} />
            <SortMenu value={list.sort} onChange={list.setSort} />
          </>
        }
        columns={layout === 'list' ? ROOM_COLUMNS : undefined}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : layout === 'grid' ? (
        <div className={`${styles.grid} ${styles.roomGrid}`}>
          {list.rows.map((item) => (
            <article key={item.id} className={`${styles.storyCard} ${styles.roomCard}`} aria-label={item.title}>
              <div className={`${styles.storyCover} ${styles.roomCover}`}>
                <img src={item.image} alt="" loading="lazy" />
              </div>
              <div className={styles.roomBody}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <StatusChip label={item.status} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={ROOM_COLUMNS}>
              <span className={styles.lead}>
                <span className={`${styles.preview} ${styles.previewWide}`}>
                  <img src={item.image} alt="" loading="lazy" />
                </span>
                <NameBlock name={item.title} />
              </span>
              <Cell>
                <StatusChip label={item.status} />
              </Cell>
              <Cell>{item.updated}</Cell>
              <RowMenu label={item.title} />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

const CHAIN_STEPS = [Database, FunnelSimple, ImageIcon, GearSix]

/** A workflow drawn on its card: a pill of its steps, or its node graph, over a dotted canvas. */
function WorkflowArt({ shape, compact = false }: { shape: StudioWorkflow['shape']; compact?: boolean }) {
  return (
    <div className={styles.workflowArt} data-compact={compact || undefined}>
      {shape === 'chain' ? (
        <span className={styles.chain}>
          <span className={styles.chainStart}>
            <Clock size={compact ? 14 : 18} weight="fill" aria-hidden />
          </span>
          {(compact ? CHAIN_STEPS.slice(0, 1) : CHAIN_STEPS).map((Step, index) => (
            <span key={index} className={styles.chainStep}>
              <Step size={compact ? 14 : 18} aria-hidden />
            </span>
          ))}
          <span className={`${styles.chainStep} ${styles.chainMore}`}>+2</span>
          <span className={styles.chainEnd}>
            <Sparkle size={compact ? 14 : 18} weight="fill" aria-hidden />
          </span>
        </span>
      ) : (
        <svg className={styles.graph} viewBox="0 0 240 96" aria-hidden>
          <g fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1">
            <path d="M44 48 C 60 48, 60 20, 78 20" />
            <path d="M44 48 C 60 48, 60 36, 78 36" />
            <path d="M44 48 C 60 48, 60 60, 78 60" />
            <path d="M44 48 C 60 48, 60 76, 78 76" />
            <path d="M102 20 C 118 20, 118 48, 134 48" />
            <path d="M102 36 C 118 36, 118 48, 134 48" />
            <path d="M102 60 C 118 60, 118 48, 134 48" />
            <path d="M102 76 C 118 76, 118 48, 134 48" />
            <path d="M158 48 C 170 48, 170 30, 182 30" />
            <path d="M158 48 C 170 48, 170 66, 182 66" />
            <path d="M206 30 C 214 30, 212 48, 200 48" stroke="rgba(167,139,250,0.5)" />
            <path d="M206 66 C 214 66, 212 48, 200 48" />
          </g>
          <rect x="14" y="43" width="30" height="10" rx="5" fill="#5fe3a1" />
          {[20, 36, 60, 76].map((y) => (
            <rect key={y} x="78" y={y - 5} width="24" height="10" rx="3" fill="rgba(255,255,255,0.16)" />
          ))}
          <rect x="134" y="43" width="24" height="10" rx="3" fill="rgba(255,255,255,0.16)" />
          <rect x="182" y="25" width="24" height="10" rx="3" fill="rgba(255,255,255,0.16)" />
          <rect x="182" y="61" width="24" height="10" rx="3" fill="rgba(255,255,255,0.16)" />
          <rect x="200" y="43" width="30" height="10" rx="5" fill="#8b7cf6" />
        </svg>
      )}
    </div>
  )
}

const WORKFLOW_COLUMNS: Column[] = [
  { label: 'Workflow' },
  { label: 'Status', width: 160 },
  { label: 'Last Updated', width: 160 },
  { label: '', width: 64 },
]

export function WorkflowsPage() {
  const [layout, setLayout] = useState<Layout>('grid')
  const [tab, setTab] = useState<'Workflows' | 'Executions'>('Workflows')
  const list = useRefine(STUDIO_WORKFLOWS, {
    text: (item) => `${item.title} ${item.description}`,
    name: (item) => item.title,
    updated: (item) => item.updated,
    fields: { Status: (item) => item.status },
  })
  const tabs = (
    <TextSegments label="Workflows" options={['Workflows', 'Executions'] as const} value={tab} onChange={setTab} />
  )
  if (tab === 'Executions') {
    return (
      <>
        <PageHead
          title="Workflows"
          titleExtra={tabs}
          placeholder="Search executions..."
          query={list.query}
          onQuery={list.setQuery}
          action="Create Workflow"
        />
        <EmptyState
          icon={<Lightning size={32} aria-hidden />}
          title="No Executions Yet"
          body="Runs show up here with their steps, timings and outputs once a published workflow is triggered."
          action="Run a Workflow"
          onAction={() => setTab('Workflows')}
        />
      </>
    )
  }
  return (
    <>
      <PageHead
        title="Workflows"
        titleExtra={tabs}
        placeholder="Search workflow..."
        query={list.query}
        onQuery={list.setQuery}
        action="Create Workflow"
        filters={
          <Dropdown
            label="Status"
            options={list.options.Status}
            value={list.filter('Status')}
            onChange={(value) => list.setFilter('Status', value)}
          />
        }
        tools={
          <>
            <LayoutToggle value={layout} onChange={setLayout} />
            <SortMenu value={list.sort} onChange={list.setSort} />
          </>
        }
        columns={layout === 'list' ? WORKFLOW_COLUMNS : undefined}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : layout === 'grid' ? (
        <div className={`${styles.grid} ${styles.storyGrid}`}>
          {list.rows.map((item) => (
            <article
              key={item.id}
              className={styles.workflowCard}
              data-running={item.running ? 'true' : undefined}
              aria-label={item.title}
            >
              <WorkflowArt shape={item.shape} />
              <div className={styles.workflowBody}>
                {item.running ? (
                  <span className={styles.running}>
                    <Lightning size={14} aria-hidden />
                    Running now
                  </span>
                ) : null}
                <h3 className={styles.workflowTitle}>{item.title}</h3>
                <p className={styles.workflowText}>{item.description}</p>
                <div className={styles.workflowFoot}>
                  {item.running ? (
                    <Tag icon={<Robot size={16} aria-hidden />}>{item.running} AI agents</Tag>
                  ) : (
                    <span className={styles.meta}>{item.updated}</span>
                  )}
                  <StatusChip label={item.status} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={WORKFLOW_COLUMNS}>
              <span className={styles.lead}>
                <span className={`${styles.preview} ${styles.previewArt}`}>
                  <WorkflowArt shape={item.shape} compact />
                </span>
                <NameBlock name={item.title} detail={item.description} />
              </span>
              <Cell>
                <StatusChip label={item.status} />
              </Cell>
              <Cell>{item.updated}</Cell>
              <span className={styles.rowActions}>
                {item.status === 'Published' ? (
                  <button type="button" className={styles.kebab} aria-label={`Run ${item.title}`}>
                    <Play size={16} aria-hidden />
                  </button>
                ) : null}
                <RowMenu label={item.title} />
              </span>
            </Row>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Members */

const MEMBER_COLUMNS: Column[] = [{ label: 'Member' }, { label: 'Role', width: 160 }, { label: '', width: 32 }]

export function MembersPage() {
  const [members, setMembers] = useState(STUDIO_MEMBERS)
  const list = useRefine(members, {
    text: (item) => `${item.name} ${item.email}`,
    name: (item) => item.name,
    updated: () => '',
    fields: { Role: (item) => item.role },
  })
  return (
    <>
      <PageHead
        title="Members"
        placeholder="Search members..."
        query={list.query}
        onQuery={list.setQuery}
        action="Invite Members"
        filters={
          <Dropdown
            label="Role"
            options={list.options.Role}
            value={list.filter('Role')}
            onChange={(value) => list.setFilter('Role', value)}
          />
        }
        tools={<SortMenu value={list.sort} onChange={list.setSort} />}
        columns={MEMBER_COLUMNS}
      />
      {list.rows.length === 0 ? (
        <NoResults />
      ) : (
        <div className={styles.table}>
          {list.rows.map((item) => (
            <Row key={item.id} columns={MEMBER_COLUMNS}>
              <span className={styles.lead}>
                <span className={styles.avatar} aria-hidden>
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </span>
                <NameBlock name={item.name} detail={item.email} />
              </span>
              <Cell>{item.role}</Cell>
              <RowMenu
                label={item.name}
                onDelete={() => setMembers((prev) => prev.filter((member) => member.id !== item.id))}
              />
            </Row>
          ))}
        </div>
      )}
    </>
  )
}
