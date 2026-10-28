import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MeshGradient } from '@paper-design/shaders-react'
import { Archive, CaretRight, GearSix, Info, ShareFat, UserPlus, UsersThree, X } from '@phosphor-icons/react'
import type { StudioAskBar, StudioStyle } from '../prototypeChrome'
import { STUDIO_MEMBERS, STUDIO_WORKSPACE_NAMES, type StudioPage } from './studioData'
import { PageBody } from './studioNav'
import { NAV, groupOf, type NavGroup } from './studioNavItems'
import { ScenarioShell } from './studioScenarios'
import { Button, Dropdown } from './studioUi'
import styles from './StudioView.module.css'

const AssetBuilder = lazy(() => import('../../asset-builder/AssetBuilder'))

/** Charcoal to blue-charcoal, with one pale blob for a hint of light. */
const STUDIO_SHADER_COLORS = ['#1b1d21', '#181b21', '#121b2d', '#1b1d21', '#14213b', '#16181d', '#5c6e8f']
/** Cap the shader so a 2x display doesn't allocate a 4K buffer behind a mostly opaque page. */
const STUDIO_SHADER_PIXELS = 1280 * 720

export type StudioViewProps = {
  /** Pauses the shader while the view is hidden. */
  active?: boolean
  /** Which Studio experience to show; 1 is the sidebar and asset grid. */
  scenario?: StudioStyle
  /** Where the current page wants the Briefing's AI bar, or null; it steps aside while a modal is open. */
  onAskBarChange?: (bar: StudioAskBar | null) => void
}

/** The Studio: a workspace's assets, filters, sources, content and members under the landing's top bar. */
export function StudioView({ active = true, scenario = 1, onAskBarChange }: StudioViewProps) {
  const [page, setPage] = useState<StudioPage>('assets')
  const [workspace, setWorkspace] = useState<string>(STUDIO_WORKSPACE_NAMES[0])
  const [open, setOpen] = useState<Record<NavGroup['id'], boolean>>({
    sources: false,
    content: false,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creatingAsset, setCreatingAsset] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const go = (next: StudioPage) => {
    setPage(next)
    const group = groupOf(next)
    if (group) setOpen((prev) => ({ ...prev, [group.id]: true }))
    mainRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className={styles.root}>
      <div className={styles.shader} aria-hidden>
        <MeshGradient
          speed={active ? 0.12 : 0}
          scale={1.2}
          distortion={0.85}
          swirl={0.12}
          colors={STUDIO_SHADER_COLORS}
          maxPixelCount={STUDIO_SHADER_PIXELS}
          className={styles.shaderCanvas}
        />
      </div>
      {scenario === 1 ? (
        <>
          <aside className={styles.sidebar} aria-label="Studio">
            <div className={styles.sideHead}>
              <span className={styles.sideTitle}>Studio</span>
              <Dropdown label="Workspace" options={STUDIO_WORKSPACE_NAMES} value={workspace} onChange={setWorkspace} full />
            </div>
            <nav className={styles.nav}>
              <div className={styles.navGroup}>
                {NAV.map((entry) => {
                  if (!('items' in entry)) {
                    return (
                      <button
                        key={entry.page}
                        type="button"
                        className={styles.navItem}
                        aria-current={page === entry.page ? 'page' : undefined}
                        onClick={() => go(entry.page)}
                      >
                        {entry.icon}
                        <span className={styles.navLabel}>{entry.label}</span>
                      </button>
                    )
                  }
                  const expanded = open[entry.id]
                  const holds = entry.items.some((item) => item.page === page)
                  return (
                    <div key={entry.id}>
                      <button
                        type="button"
                        className={styles.navItem}
                        data-holds={holds || undefined}
                        aria-expanded={expanded}
                        onClick={() => {
                          if (!expanded && !holds) go(entry.items[0].page)
                          else setOpen((prev) => ({ ...prev, [entry.id]: !expanded }))
                        }}
                      >
                        {entry.icon}
                        <span className={styles.navLabel}>{entry.label}</span>
                        <CaretRight className={styles.navCaret} size={16} aria-hidden />
                      </button>
                      {expanded ? (
                        <div className={styles.subNav}>
                          {entry.items.map((item) => (
                            <button
                              key={item.page}
                              type="button"
                              className={`${styles.navItem} ${styles.subItem}`}
                              aria-current={page === item.page ? 'page' : undefined}
                              onClick={() => go(item.page)}
                            >
                              <span className={styles.navLabel}>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div className={styles.navGroup}>
                <button type="button" className={styles.navItem} onClick={() => setSettingsOpen(true)}>
                  <GearSix size={20} aria-hidden />
                  <span className={styles.navLabel}>Settings</span>
                </button>
              </div>
            </nav>
          </aside>
          <main ref={mainRef} className={styles.main} key={page}>
            <PageBody page={page} onCreateAsset={() => setCreatingAsset(true)} />
          </main>
        </>
      ) : (
        <ScenarioShell
          key={scenario}
          scenario={scenario}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          onSettings={() => setSettingsOpen(true)}
          onCreateAsset={() => setCreatingAsset(true)}
          onAskBarChange={settingsOpen || creatingAsset ? undefined : onAskBarChange}
        />
      )}
      {settingsOpen ? (
        <StudioSettings workspace={workspace} withMembers={scenario === 9 || scenario === 10} onClose={() => setSettingsOpen(false)} />
      ) : null}
      {creatingAsset ? (
        <Suspense fallback={null}>
          <AssetBuilder onClose={() => setCreatingAsset(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}

type SettingsTab = 'General' | 'Members' | 'Permission' | 'Sharing'

const SETTINGS_TABS: { tab: SettingsTab; icon: ReactNode }[] = [
  { tab: 'General', icon: <Info size={16} aria-hidden /> },
  { tab: 'Members', icon: <UsersThree size={16} aria-hidden /> },
  { tab: 'Permission', icon: <GearSix size={16} aria-hidden /> },
  { tab: 'Sharing', icon: <ShareFat size={16} aria-hidden /> },
]

const MEMBER_ROLES = ['Editor', 'Contributor', 'Viewer'] as const

const PERMISSION_CHOICES = ['Admins only', 'Admins and editors', 'Everyone in the workspace'] as const
const DESCRIPTION_MAX = 2000

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleKnob} />
    </button>
  )
}

/** Workspace settings: General, Permission and Sharing tabs (and Members, `withMembers`) over a Cancel / Save footer. */
function StudioSettings({
  workspace,
  withMembers = false,
  onClose,
}: {
  workspace: string
  withMembers?: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>('General')
  const [members, setMembers] = useState(STUDIO_MEMBERS)
  const [name, setName] = useState(workspace)
  const [description, setDescription] = useState('sales-team-perf-v2')
  const [permissions, setPermissions] = useState({
    members: 'Admins only',
    content: 'Admins and editors',
    share: 'Admins and editors',
  })
  const [magicLinks, setMagicLinks] = useState(true)
  const [noGuests, setNoGuests] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`${workspace} settings`}>
        <header className={styles.modalHead}>
          <h2 className={styles.title}>{workspace}</h2>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className={styles.modalBody}>
          <div className={styles.modalTabs} role="tablist" aria-orientation="vertical">
            {SETTINGS_TABS.filter((item) => withMembers || item.tab !== 'Members').map((item) => (
              <button
                key={item.tab}
                type="button"
                role="tab"
                aria-selected={tab === item.tab}
                className={styles.modalTab}
                onClick={() => setTab(item.tab)}
              >
                {item.icon}
                {item.tab}
              </button>
            ))}
          </div>
          <div className={styles.modalPanel} role="tabpanel">
            <h3 className={styles.panelTitle}>{tab === 'Permission' ? 'Permissions' : tab}</h3>
            {tab === 'General' ? (
              <>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Name</span>
                  <input
                    className={styles.input}
                    value={name}
                    aria-label="Name"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Description</span>
                  <span className={styles.fieldStack}>
                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      value={description}
                      maxLength={DESCRIPTION_MAX}
                      aria-label="Description"
                      onChange={(event) => setDescription(event.target.value)}
                    />
                    <span className={styles.counter}>
                      {description.length}/{DESCRIPTION_MAX} characters
                    </span>
                  </span>
                </div>
                <div className={`${styles.field} ${styles.fieldSplit}`}>
                  <span className={styles.fieldLabel}>Archive Workspace</span>
                  <Button variant="danger" icon={<Archive size={20} aria-hidden />}>
                    Archive
                  </Button>
                </div>
              </>
            ) : tab === 'Members' ? (
              <>
                <div className={`${styles.field} ${styles.fieldSplit}`}>
                  <span className={styles.fieldLabel}>
                    {members.length} people in {workspace}
                  </span>
                  <Button icon={<UserPlus size={20} aria-hidden />}>Invite</Button>
                </div>
                <ul className={styles.memberList}>
                  {members.map((member) => (
                    <li key={member.id} className={styles.memberRow}>
                      <span className={styles.avatar} aria-hidden>
                        {member.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')}
                      </span>
                      <span className={styles.memberText}>
                        <span className={styles.memberName}>{member.name}</span>
                        <span className={styles.memberEmail}>{member.email}</span>
                      </span>
                      <span className={styles.memberRole}>
                        <Dropdown
                          label={`${member.name} role`}
                          options={MEMBER_ROLES}
                          value={member.role}
                          onChange={(role) =>
                            setMembers((prev) =>
                              prev.map((item) =>
                                item.id === member.id ? { ...item, role: role as (typeof MEMBER_ROLES)[number] } : item,
                              ),
                            )
                          }
                          full
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : tab === 'Permission' ? (
              <>
                {(
                  [
                    ['members', 'Who can invite or remove members'],
                    ['content', 'Who can create and update content'],
                    ['share', 'Who can share content'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className={styles.field}>
                    <span className={styles.fieldLabel}>{label}</span>
                    <Dropdown
                      label={label}
                      options={PERMISSION_CHOICES}
                      value={permissions[key]}
                      onChange={(value) => setPermissions((prev) => ({ ...prev, [key]: value }))}
                      full
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className={`${styles.field} ${styles.fieldSplit}`}>
                  <span className={styles.fieldLabel}>Allow sharing content using magic links</span>
                  <Toggle
                    label="Allow sharing content using magic links"
                    checked={magicLinks}
                    onChange={setMagicLinks}
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldSplit}`}>
                  <span className={styles.fieldLabel}>Disable guests</span>
                  <Toggle label="Disable guests" checked={noGuests} onChange={setNoGuests} />
                </div>
              </>
            )}
          </div>
        </div>
        <footer className={styles.modalFoot}>
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" onClick={onClose}>
            Save
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
