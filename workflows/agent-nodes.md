---
topic: workflows
services: [engine, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow agent nodes

## Audience and goal

Steps invoking the **agent** service (LangGraph tools, prompts). Worker
uses the `agentclient` package (`worker/cmd/worker/main.go` constructs
`agentclient.New`) and dispatches every agent-kind step through
`Executor.dispatchAgentKind` (`worker/internal/worker/agent_runtime.go`).
Covers all eight agent node kinds; the ones with dedicated non-interactive
runtimes ([output-agents.md](output-agents.md),
[data-analyst-node.md](data-analyst-node.md),
[gis-correlation-node.md](gis-correlation-node.md)) have their own detail
pages this one links out to rather than duplicates.

## Read first

- [worker-executor.md](worker-executor.md)
- `worker/internal/worker/agent_runtime.go` — `dispatchAgentKind`,
  `runUnstructuredAgent`, `runClassificationAgent`, `runInsightAgent`.
- `engine/internal/engine/compile.go` — `mapAgentKind` (node kind →
  worker `agentKind` string).
- [output-agents.md](output-agents.md) — slides/briefing nodes go
  through a dedicated non-interactive runtime, not the generic agent
  path.
- [data-analyst-node.md](data-analyst-node.md) — `data_analyst_agent`
  shares that runtime's plumbing but persists nothing, mints its own
  owner session, and fails strictly.
- [gis-correlation-node.md](gis-correlation-node.md) —
  `gis_correlation_agent` shares the data analyst's verdict path and adds
  two map layers taken from the graph.
- [ancestor-refs.md](ancestor-refs.md) — how authors reference fields
  from non-adjacent upstream steps in agent instructions.
- `worker/internal/agentclient` — HTTP client implementation, `IsStub()`.
- [../services/agent.md](../services/agent.md)

## How it works

There are **eight** agent node kinds, each compiled by
`mapAgentKind` (`engine/internal/engine/compile.go`) to a worker-side
`agentKind` string:

| Authored node kind | Worker `agentKind` | Runtime |
|---|---|---|
| `general_agent` | `general` | `runUnstructuredAgent` |
| `data_classification_agent` | `classification` | `runClassificationAgent` |
| `insight_generator_agent` | `insight` | `runInsightAgent` |
| `slides_agent` | `slides` | output-agent runtime (persists an entity) — [output-agents.md](output-agents.md) |
| `dashboard_agent` | `dashboard` | `runUnstructuredAgent` (legacy path, no dedicated runtime) |
| `briefing_agent` | `briefing` | output-agent runtime (persists an entity) — [output-agents.md](output-agents.md) |
| `data_analyst_agent` | `data_analyst` | `runDataAnalystWorkflowAgent` — [data-analyst-node.md](data-analyst-node.md) |
| `gis_correlation_agent` | `gis_correlation` | `runGisCorrelationWorkflowAgent` — [gis-correlation-node.md](gis-correlation-node.md) |

`dispatchAgentKind` is the single routing point: `classification` and
`insight` go to their own small runners
(`runClassificationAgent`/`runInsightAgent` — both batch/format a
prompt against the injectable agent invoker `e.Agent` without the
output-agent runtime's session-minting or persistence machinery);
`general`/`dashboard` always fall through to `runUnstructuredAgent`;
`slides`/`briefing` fall through to `runUnstructuredAgent` **only**
when the step is *not* flagged `isOutputAgent` — the normal case is
that they route to the dedicated output-agent runtime instead (see
[output-agents.md](output-agents.md)); `data_analyst` and
`gis_correlation` always go to their own dedicated runners, never
`runUnstructuredAgent`. Those two runners share one verdict path,
`runDiagnosticWorkflowAgent`. An unrecognized
`agentKind` string is an error (`"unsupported agent kind"`), not a
silent no-op.

**`runClassificationAgent`** requires a non-empty `categories` binding
(JSON array); with none configured the step fails outright
(`"classification agent has no categories configured"`). Every
configured category name is included in the generated prompt (even
categories with no example), so the model is always grounded in the
full label set.

**`runInsightAgent`** requires non-empty `instructions`; an optional
`fields` binding (JSON array) shapes the requested output format, and
an `insightType` binding tags the kind of insight requested. The step
fails (`WF_AGENT_EXECUTION`, `checkInsightFields`) when the reply leaves
any requested field out, null or blank, so every field is on the
written document. That guarantee is what lets the SDK's `insight()`
return a handle whose columns are exactly the requested fields. In
stub mode a text field comes back blank, so an insight step fails there.

**Context provided to output-agent-runtime nodes.** `runInfusionOutputWorkflowAgent`
(slides/briefing output nodes) and the unstructured agent runtime both
receive **two** contexts:

1. **Wired upstream** — immediate-predecessor artifacts (JSON preview,
   size-bounded). Mirrors the Run a Step experience.
2. **Ancestor narrative** — markdown summary of every transitive
   ancestor, built from `CompiledPlan.AncestorIndex`
   (`buildAncestorNarrativeContext`). This is what lets a slides node
   "understand what we are measuring" when an aggregation node hides
   the original metric.

**Writing rules and column meanings.** `runUnstructuredAgent` and
`runInsightAgent` build their prompt with `buildAgentPrompt`
(`worker/internal/worker/agent_runtime.go`): the author's instructions, then
`agentWritingRules`, then what the input columns mean, then the rows as
untrusted data. The writing rules hold the step to numbers that appear in the
rows or that it computes from them with the calculation shown, to calling a
number a percentage only when it is one, and to labelling any cause the rows do
not record as a hypothesis. The column meanings come from the authoring SDK:
`column_glossary` in `workflow_sdk/llumen_wf/ai_nodes.py` describes each input
column whose meaning a builder call recorded — a detector's outputs, a computed
measure ("sum of tons per event_date") and the calendar axis — and leaves a
column read straight from a source undescribed rather than guessed. The SDK
writes it into `agentState.guided.columnGlossary`, which the Engine forwards as
the step's `guided` binding; `agentColumnGlossary` renders it. The output-agent
and data-analyst runtimes put the same meanings ahead of their wired context
(`withColumnGlossary`). A binding that does not parse is treated as no glossary.

`{{alias}}` tokens in instructions are expanded from
`config.ancestor_refs[]` before the prompt is sent (see
[ancestor-refs.md](ancestor-refs.md)); `runClassificationAgent`/
`runInsightAgent` use the same `{{alias}}` expansion
(`expandAgentInstructionsLenient`) but not the full ancestor-narrative
context — narrative building is specific to the output-agent and
data-analyst runtimes.

**Stub mode.** When `AGENT_SERVICE_URL` is unset, `agentclient.New`
returns a client whose `IsStub()` is `true`; the worker answers
deterministically instead of calling a live agent service — useful for
local workflow feature work that doesn't touch actual agent-node
behavior (see [local-dev.md](local-dev.md)). Stub mode is development
only: when `ENVIRONMENT` is anything but `development`, `config.Load`
refuses to start without both `AGENT_SERVICE_URL` and
`AGENT_SERVICE_API_KEY`.

## Critical paths

1. **Dispatch** — worker leases an agent step → engine's compiled
   `agentKind` binding → `dispatchAgentKind` routes to the matching
   runner per the table above.
2. **Classification** — `runClassificationAgent` builds a
   category-grounded prompt → batches inputs through the agent client
   → materializes classification output.
3. **Insight** — `runInsightAgent` builds a fields-shaped prompt →
   single agent call → materializes the insight document.
4. **Output agents / data analyst** — see the dedicated pages linked
   above; both build the ancestor-narrative context this page
   describes.

## Configuration and operations

- `AGENT_SERVICE_URL` / `AGENT_SERVICE_API_KEY` /
  `AGENT_SERVICE_TIMEOUT_SECONDS` — see [local-dev.md](local-dev.md)
  for the full env-var table; timeout default 300s (raised for the
  data-analyst path specifically — see
  [data-analyst-node.md](data-analyst-node.md)).
- No per-agent-kind timeout override exists; all agent-kind steps share
  the one worker-level `AGENT_SERVICE_TIMEOUT_SECONDS`.

## Failure modes and edge cases

- **Unrecognized `agentKind`** — `dispatchAgentKind` returns
  `"unsupported agent kind: %q"`; indicates a compile/worker version
  mismatch on `mapAgentKind`'s output vocabulary.
- **`data_classification_agent` with no categories configured** —
  fails the step rather than guessing.
- **`insight_generator_agent` with empty instructions** — fails the
  step.
- **Agent URL unset** — in development, stub mode applies (see
  `IsStub()` handling in worker main); not itself a failure, but can
  mask a real agent-integration bug if forgotten in local testing.
  Outside development the worker does not start.
- **Agent rejects the key (401/403)** — fails the step with
  `WF_AGENT_AUTH`, which is never retried; `AGENT_SERVICE_API_KEY` has
  to change. Other agent errors are `WF_AGENT_EXECUTION` (retryable), or
  the adapter's own code (`WF_AGENT_MISSING_REF`, `WF_OUTPUT_NOT_PERSISTED`)
  when it returned an `agentStepError` carrying one.
- **Agent judges the input unusable** — when the Data Analyst's final
  answer carries `response_type: "cannot_perform"`, the agent answers 422
  with detail code `cannot_perform`, and the step fails with
  `WF_AGENT_CANNOT_PERFORM`. That code is retryable under retry-on-fail: no
  workflow prompt asks the analyst for this verdict, so it only appears when
  the model volunteers it, and a re-run can get a real answer. A failed
  analytics call usually comes back as `response_type: "error"` instead, and
  tools that cannot run at all as `ANALYSIS_TOOL_FAILURE:`; both answer 500
  and fail the step with `WF_AGENT_EXECUTION`, which is also retryable.
- **Briefing Agent in a private workspace** — fails before the agent is
  called with `WF_BRIEFING_TEAM_WORKSPACE_REQUIRED`, which is never
  retried: briefings can only be saved to a team workspace.
- `slides_agent` and `briefing_agent` must route to the output-agent
  runtime, not `runUnstructuredAgent`; `dashboard_agent` stays on the
  legacy `runUnstructuredAgent` path; `data_analyst_agent` routes to
  its own `runDataAnalystWorkflowAgent` (no persistence tail);
  `gis_correlation_agent` routes to `runGisCorrelationWorkflowAgent`,
  which fails the step before any agent call when its layers cannot be
  resolved or seen. The step records that `WF_GIS_CORRELATION_*` code
  itself (an `agentStepError`), and every one of them is on the
  never-retried list in `steppolicy.go`: only the author can fix the wiring.

## Integration map

- [output-agents.md](output-agents.md) — `slides_agent`/`briefing_agent`'s
  dedicated persisting runtime.
- [data-analyst-node.md](data-analyst-node.md) — `data_analyst_agent`'s
  dedicated non-persisting, session-minting runtime.
- [gis-correlation-node.md](gis-correlation-node.md) —
  `gis_correlation_agent`'s layer rule, verdict and failure codes.
- [ancestor-refs.md](ancestor-refs.md) — `{{alias}}` token expansion
  shared by every agent-kind runner.
- [node-catalog.md](node-catalog.md) — the full node-kind catalog these
  eight kinds belong to.
- [local-dev.md](local-dev.md) — stub-mode behavior when
  `AGENT_SERVICE_URL` is unset.
- [../services/agent.md](../services/agent.md) — the agent service
  itself, on the other side of `agentclient`.

## Validation checklist

- When agent URL unset, stub mode may apply — see `IsStub()` handling in
  worker main.
- `slides_agent` and `briefing_agent` must route to the output-agent
  runtime, not `runUnstructuredAgent`; `dashboard_agent` stays on the
  legacy path; `data_analyst_agent` routes to its own
  `runDataAnalystWorkflowAgent` (no persistence tail), and
  `gis_correlation_agent` to `runGisCorrelationWorkflowAgent`.
- If a new agent node kind is added, verify `mapAgentKind` (engine),
  `dispatchAgentKind` (worker), and the agent service's own kind
  literal all agree — the three drift independently. The agent
  service's router reads its accepted kinds from `OutputKind`
  (`workflow_output_agent.py`), so the literal and the router cannot
  disagree, but `_SUBAGENT_KEY_BY_KIND` must still gain the new key.
- The plain `correlation_agent` / `correlation` names are reserved for a
  future Correlation Agent; `TestCompileUnknownAgentKindSignalsEmpty`
  pins that `mapAgentKind("correlation_agent")` stays empty.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
