import { useSyncExternalStore } from 'react'
import type { WorkflowProposal } from './assistantReplyTypes'
import { workflowRunWillFail } from './energyWorkflowDemo'

export type WorkflowBadge = 'draft' | 'saved' | 'published'

export type WorkflowRunState = {
  badge: WorkflowBadge
  running: boolean
  error: string | null
}

const EMPTY: WorkflowRunState = { badge: 'draft', running: false, error: null }

const states = new Map<string, WorkflowRunState>()
const listeners = new Map<string, Set<() => void>>()
const timers = new Map<string, number>()

export const WORKFLOW_RUN_FAILURE =
  "Run failed at Email ops@example.com. ops@example.com isn't a verified recipient in this workspace."

function read(id: string) {
  return states.get(id) ?? EMPTY
}

function write(id: string, next: WorkflowRunState) {
  states.set(id, next)
  listeners.get(id)?.forEach((listener) => listener())
}

export function useWorkflowRun(id: string) {
  return useSyncExternalStore(
    (listener) => {
      let set = listeners.get(id)
      if (!set) {
        set = new Set()
        listeners.set(id, set)
      }
      set.add(listener)
      return () => set.delete(listener)
    },
    () => read(id),
    () => read(id),
  )
}

export function executeWorkflow(
  proposal: WorkflowProposal,
  onFailed?: (proposal: WorkflowProposal) => void,
) {
  const current = read(proposal.id)
  if (current.running) return
  write(proposal.id, { ...current, running: true, error: null })
  const fails = workflowRunWillFail(proposal)
  const pending = timers.get(proposal.id)
  if (pending != null) window.clearTimeout(pending)
  timers.set(
    proposal.id,
    window.setTimeout(() => {
      timers.delete(proposal.id)
      const latest = read(proposal.id)
      write(proposal.id, {
        ...latest,
        running: false,
        error: fails ? WORKFLOW_RUN_FAILURE : null,
      })
      if (fails) onFailed?.(proposal)
    }, 900),
  )
}

export function saveWorkflow(id: string, badge: WorkflowBadge) {
  const current = read(id)
  if (current.running) return
  write(id, { ...current, badge })
}
