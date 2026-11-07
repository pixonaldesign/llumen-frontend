import type { ReactNode } from 'react'
import { Database, FileText, Funnel, SquaresFour, UsersThree } from '@phosphor-icons/react'
import type { StudioPage } from './studioData'

export type NavItem = { page: StudioPage; label: string }
export type NavGroup = {
  id: 'sources' | 'content'
  label: string
  icon: ReactNode
  items: NavItem[]
}
export type NavLink = NavItem & { icon: ReactNode }
export type NavEntry = NavLink | NavGroup

export const NAV: NavEntry[] = [
  { page: 'assets', label: 'Assets', icon: <SquaresFour size={20} aria-hidden /> },
  { page: 'filters', label: 'Filters', icon: <Funnel size={20} aria-hidden /> },
  {
    id: 'sources',
    label: 'Sources',
    icon: <Database size={20} aria-hidden />,
    items: [
      { page: 'database', label: 'Database' },
      { page: 'apis', label: 'APIs' },
      { page: 'models', label: 'ML Models' },
      { page: 'files', label: 'Files' },
      { page: 'dataflow', label: 'Data Flow' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: <FileText size={20} aria-hidden />,
    items: [
      { page: 'briefings', label: 'Briefings' },
      { page: 'slides', label: 'Slides' },
      { page: 'dashboards', label: 'Dashboards' },
      { page: 'whiteboards', label: 'Whiteboards' },
      { page: 'rooms', label: 'Command Rooms' },
      { page: 'workflows', label: 'Workflows' },
    ],
  },
  { page: 'members', label: 'Members', icon: <UsersThree size={20} aria-hidden /> },
]

export function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

export function groupOf(page: StudioPage) {
  return NAV.find((entry): entry is NavGroup => isGroup(entry) && entry.items.some((item) => item.page === page))
}

export function pageLabel(page: StudioPage) {
  for (const entry of NAV) {
    if (!isGroup(entry) && entry.page === page) return entry.label
    if (isGroup(entry)) {
      const item = entry.items.find((candidate) => candidate.page === page)
      if (item) return item.label
    }
  }
  return page
}
