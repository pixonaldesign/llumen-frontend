import type { StudioPage } from './studioData'
import {
  ApisPage,
  AppsPage,
  AssetsPage,
  BriefingsPage,
  DashboardsPage,
  DatabasePage,
  DataFlowPage,
  FilesPage,
  FiltersPage,
  MembersPage,
  ModelsPage,
  RoomsPage,
  SlidesPage,
  WhiteboardsPage,
  WorkflowsPage,
} from './studioPages'

export function PageBody({
  page,
  onCreateAsset,
  workflowNoun,
}: {
  page: StudioPage
  onCreateAsset: () => void
  /** What the Workflows page calls one workflow; see WorkflowsPage. */
  workflowNoun?: string
}) {
  switch (page) {
    case 'assets':
      return <AssetsPage onCreate={onCreateAsset} />
    case 'filters':
      return <FiltersPage />
    case 'database':
      return <DatabasePage />
    case 'apis':
      return <ApisPage />
    case 'models':
      return <ModelsPage />
    case 'files':
      return <FilesPage />
    case 'dataflow':
      return <DataFlowPage />
    case 'briefings':
      return <BriefingsPage />
    case 'slides':
      return <SlidesPage />
    case 'dashboards':
      return <DashboardsPage />
    case 'whiteboards':
      return <WhiteboardsPage />
    case 'rooms':
      return <RoomsPage />
    case 'workflows':
      return <WorkflowsPage noun={workflowNoun} />
    case 'members':
      return <MembersPage />
    case 'apps':
      return <AppsPage />
  }
}
