import { kindIssues, kindWiringIssues, type KindIssue, type WiringGraph } from './nodeKinds'

/** What the problem's button does: go to a field by its label, open fixture input, or run the steps before. */
export type ProblemAction = { kind: 'field'; field: string; tab?: 'settings' } | { kind: 'fixture' } | { kind: 'executePrevious' }

export type NodeProblem = {
  /** The same on every run while the problem lasts, so the panel can tell once it's fixed. */
  key: string
  code: string
  /** What's wrong. */
  title: string
  /** How to fix it. */
  fix: string
  action?: ProblemAction
}

/** Sources and assets read on their own; every other node with an input needs something wired into it. */
export const needsInput = (typeId: string, inputCount: number) => inputCount > 0 && typeId !== 'source' && typeId !== 'asset'

export const noInputProblem = (): NodeProblem => ({
  key: 'input',
  code: 'WF_STEP_NO_INPUT',
  title: 'Nothing is connected to its input',
  fix: 'Connect a step before this one on the canvas, or test it with fixture input.',
  action: { kind: 'fixture' },
})

export const upstreamProblem = (name: string): NodeProblem => ({
  key: 'upstream',
  code: 'WF_STEP_NO_INPUT',
  title: `${name} hasn’t run yet`,
  fix: 'Execute the previous nodes so this one gets their rows, or test it with fixture input.',
  action: { kind: 'executePrevious' },
})

const issueProblem = (issue: KindIssue, key: string, code: string): NodeProblem => ({
  key,
  code,
  title: issue.problem,
  fix: `${issue.fix}.`,
  action: issue.field ? { kind: 'field', field: issue.field } : undefined,
})

export const configProblems = (typeId: string, stored: unknown): NodeProblem[] =>
  kindIssues(typeId, stored).map((issue) =>
    issueProblem(issue, `config:${issue.fix}`, typeId === 'aiFindings' ? 'WF_COMPILE_AI_FINDINGS_INVALID' : 'WF_COMPILE_INVALID_CONFIG'),
  )

const WIRING_CODES: Readonly<Record<string, string>> = {
  aiFindings: 'WF_COMPILE_AI_FINDINGS_ALERT_SOURCE_NOT_UPSTREAM',
  gisCorrelationAgent: 'WF_GIS_CORRELATION_LAYER_WIRING',
}

/** What the canvas around the node gets wrong, e.g. a GIS node with no Asset node wired in. */
export const wiringProblems = (typeId: string, stored: unknown, graph: () => WiringGraph): NodeProblem[] =>
  kindWiringIssues(typeId, stored, graph).map((issue) => issueProblem(issue, `wiring:${issue.fix}`, WIRING_CODES[typeId] ?? 'WF_COMPILE_INVALID_CONFIG'))

/** The keys of the problems the panel can recheck as the node is edited; a run's other failures last until it runs again. */
export function currentProblemKeys(typeId: string, stored: unknown, missingInput: boolean, graph: () => WiringGraph): ReadonlySet<string> {
  return new Set([
    ...(missingInput ? ['input'] : []),
    ...configProblems(typeId, stored).map((problem) => problem.key),
    ...wiringProblems(typeId, stored, graph).map((problem) => problem.key),
  ])
}

export const recheckable = (key: string) => key === 'input' || key.startsWith('config:') || key.startsWith('wiring:')

type Remedy = { fix: string; action?: ProblemAction }

const field = (name: string, fix: string): Remedy => ({ fix, action: { kind: 'field', field: name } })
const previous = (fix: string): Remedy => ({ fix, action: { kind: 'executePrevious' } })
const emptied = (name: string) => field(name, `Its references filled in as nothing on this input. Check the fields ${name} inserts, or write the text in.`)

const REMEDIES: Readonly<Record<string, Remedy>> = {
  WF_STEP_TIMEOUT: {
    fix: 'Raise the timeout in Settings, or leave it empty for no limit.',
    action: { kind: 'field', field: 'Timeout (seconds)', tab: 'settings' },
  },
  WF_SIMULATED: { fix: 'This failure came from the simulate buttons in the dev tools. Execute again without them.' },
  WF_ACTION_EMAIL_TO_EMPTY: emptied('To'),
  WF_ACTION_EMAIL_SUBJECT_EMPTY: emptied('Subject'),
  WF_ACTION_EMAIL_BODY_EMPTY: emptied('Body'),
  WF_ACTION_CHAT_MESSAGE_EMPTY: emptied('Message'),
  WF_ACTION_API_HTTP: field('URL', 'Check the URL, headers and body against what the API expects.'),
  WF_COMPILE_ACTION_CHAT_WAIT_REQUIRES_CHAT_TRIGGER: field('Mode', 'Add a Chat Input trigger to the Flow, or switch Mode to send the message without waiting.'),
  WF_SOURCE_QUERY_SYNTAX: field('Query', 'Fix the query, then execute the node again.'),
  WF_SOURCE_QUERY_FAILED: field('Query', 'Use a table and columns the source has; they’re listed under the query.'),
  WF_SOURCE_QUERY_UNSAFE: field('Query', 'Rewrite it as a SELECT; this step only reads data.'),
  WF_SOURCE_REF_UNRESOLVED: previous('Execute the step it refers to first, so there’s a value to fill in.'),
  WF_ML_MODEL_NO_INPUT: previous('Execute the previous nodes first.'),
  WF_CREATE_ASSET_NO_INPUT: previous('Execute the previous nodes first.'),
  WF_ML_MODEL_FEATURE_MISSING: { fix: 'Map every model feature to a column the input has.' },
  WF_FORECAST_COLUMN_MISSING: field('Time column', 'Choose columns the input has.'),
  WF_FORECAST_VALUE_INVALID: field('Value to forecast', 'Choose a numeric column, or clean the values upstream so every row holds a number.'),
  WF_FORECAST_REFUSED: field('When a series can’t be forecast', 'Give those series more history, or skip the series that can’t be forecast.'),
  WF_TRANSFORM_EXECUTION: { fix: 'Use fields the input has, and cast text to numbers upstream before summing them.' },
  WF_CREATE_ASSET_NO_GEOMETRY: { fix: 'Pick a chart type, or bring latitude and longitude columns in from an earlier step.' },
  WF_GIS_CORRELATION_BOTTOM_LAYER_MISSING: field('Land layer', 'Wire an Asset node in before this one and choose it as the land layer.'),
  WF_GIS_CORRELATION_SAME_LAYER: field('Land layer', 'Choose a different asset for the land layer.'),
  WF_GIS_CORRELATION_UPPER_LAYER_NOT_ASSET: { fix: 'Wire an Asset node straight into this one for the upper layer.' },
  WF_GIS_CORRELATION_LAYER_EMPTY: previous('Execute the previous nodes so the layer has rows.'),
  WF_GIS_CORRELATION_NO_GEOMETRY: { fix: 'Use assets with latitude and longitude columns for both layers.' },
  WF_WEBHOOK_BODY_INVALID: field('Body', 'Write the test body as JSON, e.g. {"id": 1}.'),
  WF_AGENT_CANNOT_PERFORM: { fix: 'Check the rows reaching this step in the Input column.' },
  WF_OUTPUT_NOT_PERSISTED: previous('Execute the previous nodes so rows or assets reach the agent.'),
  WF_STEP_NO_INPUT: { fix: 'Connect a step before this one on the canvas, or test it with fixture input.', action: { kind: 'fixture' } },
  WF_COMPILE_INVALID_CONFIG: { fix: 'Finish the configuration, then execute the node again.' },
  WF_COMPILE_AI_FINDINGS_INVALID: { fix: 'Finish the focus note and the alert rules, then execute the node again.' },
  WF_COMPILE_AI_FINDINGS_ALERT_SOURCE_NOT_UPSTREAM: { fix: 'Point the condition at a step wired in before this one, or wire that step in.' },
  WF_COMPILE_COMPONENT_MISSING_ID: field('Asset', 'Choose an asset.'),
  WF_COMPILE_FORECAST_MISSING_COLUMN: field('Time column', 'Choose the time and value columns.'),
  WF_COMPILE_ML_MODEL_MISSING_ID: field('Model', 'Select a model.'),
  WF_COMPILE_SOURCE_MISSING_ID: field('Source', 'Select a source.'),
  WF_COMPILE_SOURCE_MISSING_QUERY: { fix: 'Finish choosing what to read from the source.' },
  WF_MARKETPLACE_PARAMETER_MISSING: { fix: 'Fill in every parameter the operation needs.' },
  WF_ACTION_REF_RESOLVE: previous('Execute the earlier steps so those fields have values, or pick the field again from the Input column.'),
  WF_ACTION_API_URL_REQUIRED: field('URL', 'Enter the full address, starting with https://.'),
  WF_ACTION_API_URL_DISALLOWED: field('URL', 'Use a public address; private and local networks are blocked.'),
  WF_ACTION_API_REQUEST_BUILD: field('Body', 'Remove the body, or pick a method that carries one.'),
  WF_ACTION_API_SOURCE_REQUIRED: field('Connection', 'Select the API connection.'),
  WF_ACTION_API_SOURCE_REQUEST_REQUIRED: field('Request', 'Choose the request to make on the connection.'),
  WF_AGENT_EXECUTION: { fix: 'Add at least one category for the classifier.' },
  WF_CHAT_MESSAGE_EMPTY: field('Test message', 'Type the message to test the chat with.'),
  WF_CHAT_RESUME_RESPONSE_TYPE_MISMATCH: field('Reply', 'Execute the step again so it asks for the reply it now expects.'),
  WF_ML_MODEL_TOO_MANY_ROWS: { fix: 'Filter or aggregate the rows upstream to 50,000 or fewer.' },
  WF_GIS_CORRELATION_LAYER_WIRING: field('Land layer', 'Wire an Asset node in for the upper layer, and choose another one upstream as the land layer.'),
  WF_STOP_ERROR: { fix: 'A Stop and Error node ended the run on purpose. Change the branch that leads to it if this run should continue.' },
}

/** A failure found while running, with the fix that usually clears it. */
export function runtimeProblem(code: string, message: string): NodeProblem {
  const remedy = REMEDIES[code] ?? { fix: 'Check the configuration and the rows in the Input column, then execute the node again.' }
  return { key: `run:${code}`, code, title: message.replace(/\.$/, ''), ...remedy }
}
