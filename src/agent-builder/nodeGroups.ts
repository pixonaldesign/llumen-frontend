import { Brain, Database, Lightning, PaperPlaneTilt, type Icon } from '@phosphor-icons/react'
import { NODE_TYPES, type NodeCategoryId, type NodeTone, type NodeType } from './nodeCatalog'

export type NodeGroupId = 'triggers' | 'dataFlow' | 'agents' | 'actions'

export type NodeGroup = {
  id: NodeGroupId
  title: string
  description: string
  icon: Icon
  tone: NodeTone
  /** Catalog categories listed in this group, in order. Annotations live on the sticky note tool. */
  categories: readonly NodeCategoryId[]
}

/** The four ways the node library is split, on the bottom toolbar and in the insert panel. */
export const NODE_GROUPS: readonly NodeGroup[] = [
  {
    id: 'triggers',
    title: 'Triggers',
    description: 'Initiate the workflow from defined start points',
    icon: Lightning,
    tone: 'trigger',
    categories: ['triggers'],
  },
  {
    id: 'dataFlow',
    title: 'Data & Flow',
    description: 'Fetch data and control execution paths',
    icon: Database,
    tone: 'data',
    categories: ['dataFlow'],
  },
  {
    id: 'agents',
    title: 'Agents',
    description: 'Perform general and specialized AI tasks',
    icon: Brain,
    tone: 'analysis',
    categories: ['analysisAgents'],
  },
  {
    id: 'actions',
    title: 'Actions',
    description: 'Generate output content and execute external operations',
    icon: PaperPlaneTilt,
    tone: 'action',
    categories: ['outputAgents', 'actions'],
  },
]

/** The nodes most flows reach for, listed first in the insert panel. */
const QUICK_TYPE_IDS = ['asset', 'ifElse', 'generalAgent', 'createApp']

export const quickTypes = (): NodeType[] => QUICK_TYPE_IDS.flatMap((id) => NODE_TYPES.filter((type) => type.id === id))

export const groupTypes = (group: NodeGroup): NodeType[] =>
  group.categories.flatMap((id) => NODE_TYPES.filter((type) => type.category === id))

export const matchesQuery = (type: NodeType, search: string) =>
  !search || type.title.toLowerCase().includes(search) || type.description.toLowerCase().includes(search)
