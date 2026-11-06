import type { DataRecord } from './nodeCatalog'

/** What `{{ $llumen.… }}` reads: the workflow and the run it's in. */
export const llumenVars = (workflowName: string, executionId = 'exec_9b21'): DataRecord => ({
  'workflow.name': workflowName,
  'execution.id': executionId,
  'execution.mode': 'builder_debug',
  now: new Date().toISOString().slice(0, 19) + 'Z',
})

/** The globals by name; the workflow has no variables of its own yet. */
export const globalVars = (workflowName: string, executionId?: string): Readonly<Record<string, DataRecord>> => ({
  $llumen: llumenVars(workflowName, executionId),
  $vars: {},
})
