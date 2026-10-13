import type { AssistantReplyPayload, WorkflowProposal } from './assistantReplyTypes'

/** The example request from the workflow-proposal review. */
export const ENERGY_WORKFLOW_USER_TEXT = `the top 3 most unusual days
total Energy consumption
compared with the same weekday in previous weeks
explains each one with AI
a bar chart
emails the summary to ops@example.com`

export const ENERGY_WORKFLOW_TITLE = 'Unusual energy days'

const ENERGY_WORKFLOW_PROPOSAL: WorkflowProposal = {
  id: 'unusual-energy-days',
  intro: "I'll build a workflow that does these:",
  clauses: [
    { id: 'unusual', label: 'Top 3 unusual days' },
    { id: 'total', label: 'Total energy consumption' },
    { id: 'weekday', label: 'Same weekday in previous weeks' },
    { id: 'explain', label: 'Explain each one with AI' },
    { id: 'chart', label: 'Bar chart' },
    { id: 'email', label: 'Email ops@example.com' },
  ],
  title: ENERGY_WORKFLOW_TITLE,
  summary:
    'Emails a bar chart of the 3 most unusual consumption days, each explained, to ops@example.com.',
  steps: [
    { id: 'trigger', label: 'Manual trigger', tone: 'trigger', lane: 'spine' },
    { id: 'read', label: 'Total energy consumption', tone: 'step', lane: 'spine' },
    { id: 'weekday', label: 'Same weekday in previous weeks', tone: 'step', lane: 'spine' },
    { id: 'top', label: 'Top 3 unusual days', tone: 'step', lane: 'spine' },
    { id: 'chart', label: 'Bar chart', tone: 'asset', lane: 'left' },
    { id: 'explain', label: 'Explain each one with AI', tone: 'agent', lane: 'right' },
    { id: 'email', label: 'Email ops@example.com', tone: 'delivery', lane: 'join' },
  ],
  edges: [
    ['trigger', 'read'],
    ['read', 'weekday'],
    ['weekday', 'top'],
    ['top', 'chart'],
    ['top', 'explain'],
    ['chart', 'email'],
    ['explain', 'email'],
  ],
}

export function isEnergyWorkflowExample(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('unusual') &&
    normalized.includes('consumption') &&
    (normalized.includes('email') || normalized.includes('ops@'))
  )
}

function sentenceCase(value: string) {
  const trimmed = value.trim().replace(/[.\s]+$/, '')
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/** Fold a requested edit into a new draft card. */
export function applyWorkflowChange(base: WorkflowProposal, change: string): WorkflowProposal {
  const label = sentenceCase(change)
  const clauseId = `change-${base.clauses.length + 1}`
  const summaryBase = base.summary.replace(/[.\s]+$/, '')
  return {
    ...base,
    id: `${base.id}-${clauseId}`,
    intro: "Here's the updated workflow:",
    summary: `${summaryBase}. ${label}.`,
    clauses: [...base.clauses, { id: clauseId, label }],
    steps: base.steps.map((step) => ({ ...step })),
    edges: base.edges.map((edge) => [edge[0], edge[1]] as [string, string]),
  }
}

/** The demo run fails until delivery uses a verified mailbox. */
export function workflowRunWillFail(proposal: WorkflowProposal) {
  const email = proposal.steps.find((step) => step.id === 'email')
  return !email?.label.toLowerCase().includes('verified')
}

export function applyWorkflowRunFix(base: WorkflowProposal): WorkflowProposal {
  const summary = base.summary.includes('ops@example.com')
    ? base.summary.replace('ops@example.com', 'the verified ops mailbox')
    : `${base.summary.replace(/[.\s]+$/, '')}. Delivery uses the verified ops mailbox.`
  return {
    ...base,
    id: `${base.id}-verified`,
    intro: "Here's the updated workflow:",
    summary,
    clauses: base.clauses.map((clause) =>
      clause.id === 'email' ? { ...clause, label: 'Email the verified ops mailbox' } : clause,
    ),
    steps: base.steps.map((step) =>
      step.id === 'email' ? { ...step, label: 'Send via verified ops' } : { ...step },
    ),
    edges: base.edges.map((edge) => [edge[0], edge[1]] as [string, string]),
  }
}

/** Scripted follow-up when the user edits the draft from the examine composer. */
export function workflowChangeReply(change: string, base: WorkflowProposal = ENERGY_WORKFLOW_PROPOSAL): AssistantReplyPayload {
  const request = sentenceCase(change)
  return {
    confirmation: 'Got it',
    headline: 'Updating the workflow',
    thinkingSteps: [
      { id: 'read', kind: 'reasoning', title: 'Reading the requested change' },
      { id: 'apply', kind: 'reasoning', title: 'Applying it to the draft' },
      { id: 'done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'read',
        kind: 'reasoning',
        title: 'Read the requested change',
        titleInProgress: 'Reading the requested change…',
      },
      {
        id: 'apply',
        kind: 'tool',
        title: 'Updated the draft workflow',
        titleInProgress: 'Updating the draft workflow…',
      },
    ],
    blocks: [
      {
        type: 'text',
        content: `I folded that into the draft: ${request}.`,
      },
      { type: 'workflow', proposal: applyWorkflowChange(base, change) },
    ],
  }
}

export function workflowRunFailedReply(): AssistantReplyPayload {
  return {
    headline: 'Run failed',
    thinkingSteps: [
      { id: 'trace', kind: 'reasoning', title: 'Checking the failed run' },
      { id: 'cause', kind: 'reasoning', title: 'Found the delivery rejection' },
      { id: 'done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'trace',
        kind: 'tool',
        title: 'Checked the failed run',
        titleInProgress: 'Checking the failed run…',
      },
      {
        id: 'cause',
        kind: 'outcome',
        title: 'Found why delivery was rejected',
        titleInProgress: 'Finding why delivery was rejected…',
      },
    ],
    blocks: [
      {
        type: 'question',
        id: `workflow-run-failed-${Date.now()}`,
        prompt:
          "The email didn't send because ops@example.com isn't a verified recipient in this workspace, so the chart never went out. Should I attempt a fix, or wait?",
        options: [
          { id: 'fix', label: 'Attempt a fix' },
          { id: 'wait', label: 'Wait' },
        ],
      },
    ],
  }
}

export function workflowFixReply(base: WorkflowProposal): AssistantReplyPayload {
  return {
    confirmation: 'On it',
    headline: 'Fixing the failed run',
    thinkingSteps: [
      { id: 'fix', kind: 'reasoning', title: 'Switching delivery to a verified mailbox' },
      { id: 'done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'fix',
        kind: 'tool',
        title: 'Pointed the email at the verified ops mailbox',
        titleInProgress: 'Pointing the email at the verified ops mailbox…',
      },
    ],
    blocks: [
      {
        type: 'text',
        content:
          "I'll send through the verified ops mailbox instead of ops@example.com. That was the address the workspace rejected.",
      },
      { type: 'workflow', proposal: applyWorkflowRunFix(base) },
    ],
  }
}

export function workflowWaitReply(): AssistantReplyPayload {
  return {
    headline: 'Leaving the draft',
    thinkingSteps: [{ id: 'done', kind: 'done', title: 'Done' }],
    timeline: [
      {
        id: 'wait',
        kind: 'outcome',
        title: 'Left the draft unchanged',
        titleInProgress: 'Leaving the draft unchanged…',
      },
    ],
    blocks: [
      {
        type: 'text',
        content: "I'll leave the draft as it is. Run it again whenever you want me to look.",
      },
    ],
  }
}

export function energyWorkflowReply(): AssistantReplyPayload {
  return {
    headline: ENERGY_WORKFLOW_TITLE,
    thinkingSteps: [
      { id: 'read', kind: 'reasoning', title: 'Reading the request' },
      { id: 'map', kind: 'reasoning', title: 'Laying out the workflow' },
      { id: 'done', kind: 'done', title: 'Done' },
    ],
    timeline: [
      {
        id: 'read',
        kind: 'reasoning',
        title: 'Read the request',
        titleInProgress: 'Reading the request…',
      },
      {
        id: 'map',
        kind: 'tool',
        title: 'Laid out the workflow',
        titleInProgress: 'Laying out the workflow…',
      },
      {
        id: 'draft',
        kind: 'outcome',
        title: 'Drafted the proposal',
        titleInProgress: 'Drafting the proposal…',
      },
    ],
    blocks: [{ type: 'workflow', proposal: ENERGY_WORKFLOW_PROPOSAL }],
  }
}
