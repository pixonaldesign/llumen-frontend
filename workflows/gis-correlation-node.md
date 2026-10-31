---
topic: workflows
services: [agent, analytics, content, engine, worker, frontend]
status: current
verified_against: "7cf6662ea6155f66d2c31a04de154d50e71e0b43"
verified_on: 2026-10-05
---
# GIS Correlation Agent Flow node

## Audience and goal

The `gis_correlation_agent` node (builder label **GIS Correlation Agent**,
category *Analysis Agents*) runs the `gis_correlation_analyst` subagent
inside a Flow run. It compares an **upper** map layer (wind, a heatmap of
events, a measured value) with the **bottom** layer under it (the land), and
writes a JSON **verdict document** that names the method it used. When the
node ends the Flow it also keeps the map of its analysis as an asset; otherwise
it saves nothing (see [What the node keeps](#what-the-node-keeps)). When
nothing was analysed, it fails the step instead of reporting it green.

It is the data analyst's sibling: same output-agent transport, same owner
session, same strict failure rules. Read
[data-analyst-node.md](data-analyst-node.md) first; this page covers only
what differs.

## Read first (ordered)

1. [data-analyst-node.md](data-analyst-node.md) — the shared verdict path,
   owner-session minting and fence handling.
2. `worker/internal/worker/gis_correlation_layers.go` —
   `resolveGisCorrelationLayers`, the layer rule.
3. `worker/internal/worker/agent_runtime.go` —
   `runGisCorrelationWorkflowAgent` and the shared
   `runDiagnosticWorkflowAgent`.
4. `agent/src/agents/workflow/workflow_output_agent.py` — the
   `gis_correlation` kind: `_workflow_layer_spec`,
   `_GIS_CORRELATION_WORKFLOW_HARDENING`, `_gis_correlation_failure_reason`.
5. [../ai-agents/gis-correlation-agent.md](../ai-agents/gis-correlation-agent.md)
   — the chat-side subagent and its tools.
6. [../analytics/layer-correlation.md](../analytics/layer-correlation.md) —
   the analytics route, its `LayerSpec` and method table.
7. `worker/internal/worker/gis_visual_asset.go` (`gisKeepsMap`,
   `keepGisVisualAsset`) and
   `content/internal/api/services/assets/workflow_analytics_asset.go`
   (`UpsertFlowAnalyticsAsset`, `bindFlowAnalyticsRuns`) — the map the node
   keeps.

## How it works

### The layer rule: assets from the graph, kinds from the config

The two layers are never named in the node config by asset id. They come
from the graph:

- **Upper layer** — the node's one wired input. It must come straight from
  an `asset` node.
- **Bottom layer** — exactly one whole-output ancestor reference (empty
  `field_path`, usage `whole`) whose source is an `asset` node. Other
  references, such as a `{{alias}}` value reference, are allowed and
  ignored. Two references to the same asset count as one.
- The two must be different assets.

Only direct `asset` nodes count because the analytics service reads a layer
by asset id through the runner; a filtered or transformed upstream has no
asset id to send.

**The one graph shape that compiles: land Asset → upper Asset → GIS node.**
The Engine allows one inbound edge per node (`maxInputsForKind`,
`validate.go`), and a reference may only name a node upstream of this one
(`ancestor_refs.go`). So the land Asset node has to sit on the upper Asset
node's own chain: connect the land Asset node into the upper-layer Asset
node, wire that one into the GIS node, then reference the land node as a
whole output. The edge from land to the upper Asset node carries no data the
upper asset uses; it only puts land upstream. Any other shape fails at save:

| Shape | Compile error |
|---|---|
| land beside the upper Asset node (both fed by the trigger), referenced | `WF_COMPILE_INVALID_ANCESTOR_REF: gis references non-ancestor land` |
| both Asset nodes wired into the GIS node | `WF_COMPILE_MAX_INPUTS_EXCEEDED: gis (max 1, got 2)` |
| a trigger wired into the GIS node beside the upper Asset node | `WF_COMPILE_MAX_INPUTS_EXCEEDED` |

`TestGisCorrelationGraphShapesTheEngineRefuses`
(`engine/internal/engine/gis_correlation_graph_test.go`) pins these. Because
of them, two Worker branches are defensive only: skipping a trigger edge and
refusing more than one wired input
(`WF_GIS_CORRELATION_UPPER_LAYER_NOT_ASSET`, "found N wired inputs"). No
compiled plan reaches them today. The Worker's resolver is also tested on
plans the Engine really compiled
(`worker/internal/worker/testdata/gis_correlation_compiled_plans.json`, kept
current by `TestGisCorrelationCompiledPlansMatchTheWorkerFixture`).

What each layer **holds** comes from the node config,
`agentState.gis_correlation`:

```json
{"upper": {"kind": "wind", "speed_field": "ws"}, "bottom": {"kind": "land_type"}}
```

- Upper kinds: `events`, `values`, `wind`. Bottom kinds: `land_type`,
  `land_measure`, `values`. These are the analytics service's `UPPER_KINDS`
  and `BOTTOM_KINDS` (`analytics/analytics/services/layer_pairing/types.py`).
- Optional column roles: `value_field`, `class_field`, `u_field`,
  `v_field`, `speed_field`, `direction_field`, `time_field`,
  `entity_field`. A role left out is detected by the service.
- Keys are snake_case because they are the analytics `LayerSpec` keys,
  passed through the Engine and Worker without renaming.

The Engine compiles the block unread into the step's `gis_correlation`
binding (`extractAgentBindings`, `compile.go`). The **Worker** checks it at
run time, before any model call, and decodes it strictly: an `asset_id`, a
misspelled role or a third layer is refused, not dropped.

In the builder, the editor (`AgentNodeConfigEditor.tsx`,
`renderGisCorrelation`) shows a kind picker per layer and, once a kind is
chosen, only the column roles that kind reads (`gisCorrelationRolesFor` in
`workflowNodeConfigState.ts`). Time and entity columns are offered on both
sides, because the analytics service reads them on both
(`layer_pairing/roles.py`). The bottom layer's reference is added with the
shared `AncestorFieldPicker` flow: connect the land Asset node into the
upper-layer Asset node, then **+ Reference from ancestor** → pick the land
node → **Whole output**. The editor's hint says exactly that. Changing a kind
drops the roles the new kind does not read, so a hidden, stale column name
never reaches a run.

### The run

```
Worker  runGisCorrelationWorkflowAgent
          resolveGisCorrelationLayers(plan, node)        ← graph + config
          gisLayersNotVisible(run, upper, bottom)         ← both visible to the run's workspace?
          runDiagnosticWorkflowAgent(kind "gis_correlation", layers)
            gisKeepsMap → keep_map                        ← does the node end the Flow?
            POST /api/internal/workflow/output_agent {kind, instructions, gis_correlation_layers, keep_map}
Agent   run_workflow_output_agent
          layers complete? → mint owner session
          gis_correlation_analyst (create_agent, GuardrailToolResultMiddleware)
            correlate_layers(upper=<LayerSpec>, bottom=<LayerSpec>, question)   ← persist set in code
              → POST /api/analytics/v1/layer-correlation/correlate
          tool results checked → verdict text (+ `map` when keep_map)
Worker  parseDiagnosticVerdict → keepGisVisualAsset (keep_map only) → JSON document on "default"
```

- **Authorization.** The Worker authorizes both asset ids with the same
  run-scoped query the slides/briefing persistence path uses
  (`assetIDsVisibleToRun`, `run_scope.go`). An Executor with neither
  a pool nor an injected authorizer fails closed. A database error during
  the check fails the step with `WF_GIS_CORRELATION_LAYER_CHECK`, not
  `…_NOT_VISIBLE`, so the author is not sent to share an asset that may
  already be shared. The analytics service then reads each layer under the
  owner session, so RLS still decides.
- **The agent reads only the checked pair.** `run_workflow_output_agent` pins
  the two asset ids on the request context, and the GIS tool helpers
  (`tool_helpers/_gis_correlation.py`) refuse any other `layer_ref`, any
  source query, and a pinned layer with a query attached. Instructions in the
  node config therefore cannot point the model at a layer the Worker did not
  authorize.
- **Owner session.** Minted exactly as for the data analyst
  (`mint_workflow_owner_session`), after the layers are known to be complete.
- **No upstream data plane.** The wired asset's artifact is not bound as the
  data analyst's `upstream_artifact`; the layers travel by asset id. Both
  assets are still materialised by their Asset steps, and the wired one is
  profiled into the prompt's wired context, so the model sees its columns.
- **Tools.** In a run the subagent holds `correlate_layers`,
  `run_spatial_statistic`, `describe_layer`, `list_air_quality_standards`,
  `assess_plume_exposure` and `trace_pollution_source`
  (`_WORKFLOW_TOOL_ALLOWLIST`), all held to the two pinned layers. The layers
  are fixed, so it needs no search tool, and `show_analytics_result` drives a
  chat map a run does not have. The column roles the author set on each layer
  are grounded for the no-guess check (`seed_flow_layers`); any other column
  needs a `describe_layer` call first.
- **The prompt** hands both specs over ready-made (`_workflow_layer_spec`
  turns a Worker layer into `{"layer_ref": {"asset_id": …}, "kind": …,
  …roles}`), and tells the model to leave `persist` out: the tools set it in
  code. It forbids `wind` and `land_class`: an upwind share needs a third
  layer this node does not take.

### The verdict

The data analyst's six keys plus `method`:

```jsonc
{"answer": "...", "classification": null, "reasoning": "...",
 "key_metrics": [...], "confidence": "high|medium|low", "caveats": [...],
 "method": "geodetector"}
```

`method` is the `MethodId` the analytics route returned, copied by the model,
never chosen by it. The Worker requires only a non-blank `answer`, as for the
data analyst; `created_entity_kind` is null. A step that keeps its map adds
`map`, `visual_asset_id` or `visual_warning` (next section).

### What the node keeps

Beyond its verdict, the node keeps one thing: the map of its analysis, as an
asset, and only when the node **ends the Flow** — no step reads it except Asset
steps and the AI Findings node (`gisVisualAllowed`). The Worker decides this before it calls the agent
(`gisKeepsMap`, `gis_visual_asset.go`): the node ends the Flow, the run has a
definition id, and the Worker has a content client. It sends the answer as
`keep_map`; the agent saves an analytics run only when it is true.

- **`keep_map` false** — the node feeds a Send Email, Slides or Briefing step,
  or there is no definition id or content client. `keeps_flow_map` is false,
  so the tools force `persist` false whatever the model asks, and the step
  writes no `analytics_results` row. With no content client the verdict
  carries `visual_warning`.
- **`keep_map` true** — every `correlate_layers` call saves its run under
  `analytics:layer_correlation` and passes the runs the step saved before as
  `supersedes_run_ids`, so the step ends with one map. `_with_flow_map` writes
  it into the verdict as `map: {analytics_run_ids, analytics_asset_id}` from the
  runs the tools recorded; a `map` the model wrote is dropped. The Worker posts
  it to content's `POST /api/content/internal/v1/flow-assets/analytics`
  (`keepGisVisualAsset`) and writes `visual_asset_id` into the verdict. Spatial
  statistics, assessments and traces save nothing in a step, so a step answered
  without a correlation has no `map`; the Worker then writes `visual_warning`
  (`gisNoMapReason`) so the author sees that no map was kept. The warning
  explains that exposure and source-trace answers are not kept as maps only
  when the verdict's `method` names one (a tool name or the `transport.mode`
  they report); otherwise it says just "This analysis kept no map."
- **Content** binds one map-layer asset to the (definition, node) pair and
  refreshes it in place. Each run the asset shows is bound to it through
  `analytics_results.linked_asset_id`, and a refresh deletes the bound runs it
  no longer shows, only the Flow owner's (`bindFlowAnalyticsRuns`). The binding
  decides what is deleted, not the asset's `configuration` or
  `source_node_config`: anyone who may edit the asset can edit those, while RLS
  lets only the run's owner and data or system admins write `linked_asset_id`,
  and they could delete the run anyway. A run already bound to another asset
  (one the owner promoted) is left there. A private asset with no workspace
  link, left by an insert that committed although its answer was lost, gets
  the link on the next refresh.

When a saved map is not kept:

| Case | What happens |
|---|---|
| The agent fails the run after a correlation saved its map (a `cannot_perform` verdict, a model or tool error) | `discard_flow_map` deletes the saved runs as the owner (the step's owner session, so RLS applies; `created_by` = the owner) |
| The verdict has no answer | the map is not attached and is deleted the same way; the Worker fails the step |
| Content cannot keep the map | `visual_warning` with the HTTP status only (content's body stays in the Worker log). Runs content already bound are deleted on the next refresh; runs it never bound stay, one set per such failure |
| The Worker times out while the agent is still running | the agent cannot tell, so the map it saves stays, one set per timed-out attempt |

Leftovers are therefore bounded by failures, never by executions. Keeping the
map never fails the step.

## Failure modes and edge cases

Every one of these fails the step. The Worker's `WF_GIS_CORRELATION_*`
failures are typed agent step errors (`gisCorrelationError`,
`gis_correlation_layers.go`), so `runAgent` records that code as the step's
**error code**, and the message starts with it too. An agent-service failure
is coded by `agentFailureCode` (`agent_runtime.go`), as for every agent kind:
`WF_AGENT_AUTH` for a 401/403, `WF_AGENT_CANNOT_PERFORM` for a 422 carrying
`cannot_perform`, and `WF_AGENT_EXECUTION` otherwise. The rows below whose
message does not start with a `WF_` code are agent-service failures of that
kind.

**Retry on fail.** The graph and layer-config codes
(`…_UPPER_LAYER_NOT_ASSET`, `…_BOTTOM_LAYER_MISSING`,
`…_BOTTOM_LAYER_AMBIGUOUS`, `…_SAME_LAYER`, `…_LAYER_KIND_MISSING`,
`…_LAYER_KIND_INVALID`, `…_LAYER_FIELD_UNKNOWN`) are permanent
(`permanentFailureCodes`, `steppolicy.go`): a re-run reads the same compiled
plan, so the step is not retried even when `retryOnFail` is on.
`…_LAYER_NOT_VISIBLE` and `…_LAYER_CHECK` stay retryable, because the asset
can be shared, or the database recover, before the next attempt.

**These are run-time checks.** A node with no layer kinds, land on top, or a
column reference instead of a whole-output one compiles as valid and fails
only when it runs, after both Asset steps have materialised. That is
deliberate: the layer rule and the side sets live in one place, the Worker,
rather than in a second copy in the Engine that could drift. The builder is
the early guard instead. Its kind
pickers offer only the kinds valid for each side, so land on top cannot be
chosen there, and the editor shows inline warnings before save when a kind
is missing, when the wired input is not an Asset node, when there is no
whole-output reference to a second Asset node, or when whole-output references
name more than one Asset node, counted the way the Worker counts them
(`gisCorrelationGraphIssues`).
Those warnings are not the canvas node diagnostics, which come only from the
Engine's compile at save time.

| Message starts with | Where | Meaning |
|---|---|---|
| `WF_GIS_CORRELATION_UPPER_LAYER_NOT_ASSET` | Worker | no single wired input, or it is not straight from an Asset node |
| `WF_GIS_CORRELATION_BOTTOM_LAYER_MISSING` | Worker | no whole-output reference to an Asset node |
| `WF_GIS_CORRELATION_BOTTOM_LAYER_AMBIGUOUS` | Worker | whole-output references to more than one Asset node |
| `WF_GIS_CORRELATION_SAME_LAYER` | Worker | both sides are the same asset |
| `WF_GIS_CORRELATION_LAYER_KIND_MISSING` | Worker | a layer has no kind, or the config has no `gis_correlation` block |
| `WF_GIS_CORRELATION_LAYER_KIND_INVALID` | Worker | a kind on the wrong side, e.g. land on top |
| `WF_GIS_CORRELATION_LAYER_FIELD_UNKNOWN` | Worker | a key that is not a kind or role, or a value that is not text |
| `WF_GIS_CORRELATION_LAYER_NOT_VISIBLE` | Worker | an asset the run's workspace cannot see (named in the error) |
| `WF_GIS_CORRELATION_LAYER_CHECK` | Worker | the visibility check itself failed (a database error); says nothing about sharing |
| `GIS correlation layers missing or incomplete` | Agent | the request reached the agent without both asset ids and kinds |
| `workflow owner session mint failed` | Agent | no session, no admin fallback |
| `GIS correlation agent could not run the analysis: …` | Agent | see below |
| `WF_AGENT_EXECUTION: GIS correlation agent returned an empty verdict` / `… verdict has no answer` | Worker | `parseDiagnosticVerdict` |

**How a failed analysis is recognised.** The GIS tools never emit the data
analyst's `ANALYSIS_TOOL_FAILURE:` marker, so the agent service reads the
tool results themselves (`_gis_correlation_failure_reason`). The run fails
unless at least one `correlate_layers`, `assess_plume_exposure` or
`trace_pollution_source` result has `status: "success"`. A
`run_spatial_statistic` result does not count either way: it reads one layer,
so a follow-up that succeeds cannot clear a comparison that failed. The reason
given is the last failed result's:

- `{"success": false, "error": …}` — the analytics route's HTTP 400, 402
  (analytics licence off), 404 or 504, relayed by the tool;
- `{"status": "refused", …}` — an honest refusal, such as "only one land
  type". The step message carries the refusal's `what_would_help` hint;
- `{"status": "refused_by_rules", "rule", "what_to_do"}` — the no-guess check
  refused a column, value, unit or number nothing grounded; the step message
  carries the rule and what to do;
- `{"status": "error", …}` — a failed compute;
- no correlation tool call at all — "no correlation analysis ran".

A refusal of only the **significance test** (`refusal.scope ==
"significance"`) comes back with `status: "success"`: the estimate is
reported, and the verdict carries the refusal as a caveat.

Independently, a verdict whose `response_type` is `error` or
`cannot_perform` fails the run with its `answer` as the reason. The
hardening block tells the model to end that way after a refusal or a
failure, and not to retry with guessed values.

**Unused materialisation.** The bottom Asset step materialises its data
although the node reads the layer by asset id. That is the cost of taking
the layer from the graph.

## Configuration and operations

- **Time budget.** The Worker waits `AGENT_SERVICE_TIMEOUT_SECONDS` (default
  300s, `worker/internal/config/config.go`) for the whole step, including
  every model turn. Each analytics call can take up to about 130s: the route
  caps one compute at 120s, and the agent's client waits 130s so the route's
  own 504 arrives first. One call fits comfortably. A retry after a refusal
  plus a follow-up `run_spatial_statistic`, all slow, can pass 300s; the
  Worker then fails the step with a transport timeout while the agent service
  may still be computing. Nothing caps the number of calls in code.
  - What an author should expect: the sample land-cover and WRF wind layers
    finish in about 12s. A step that times out is almost always a large
    layer: narrow its area or time window in the Asset's query, which also
    keeps each analytics call well under its own 120s cap.
  - Raising the Worker timeout is a multi-surface env-var change; see the
    data analyst page.
- No new env var or secret.

## Critical paths

1. **Compile** — `gis_correlation_agent` → adapter `llumen.output_agent`,
   binding `agentKind: "gis_correlation"`, `gis_correlation` = the authored
   block as compact JSON.
2. **Resolve and authorize** — `resolveGisCorrelationLayers` then
   `gisLayersNotVisible`, both before any agent call.
3. **Decide the map** — `gisKeepsMap` → `keep_map` on the agent request.
4. **Analyse** — owner session → `correlate_layers` with both LayerSpecs →
   the layer-correlation route (saved only with `keep_map`).
5. **Judge** — tool results first, then the verdict's `response_type`; a
   failed run deletes the map it saved (`discard_flow_map`).
6. **Write** — `parseDiagnosticVerdict` → `keepGisVisualAsset` (with
   `keep_map`) → the `default` JSON document.

## Integration map

- [agent-nodes.md](agent-nodes.md) — the dispatch table this node's
  `agentKind: "gis_correlation"` row belongs to.
- [data-analyst-node.md](data-analyst-node.md) — the shared verdict path.
- [ancestor-refs.md](ancestor-refs.md) — how the bottom layer's
  whole-output reference is authored and compiled.
- [../ai-agents/gis-correlation-agent.md](../ai-agents/gis-correlation-agent.md)
  — the chat-side subagent, its tools and rules.
- [../analytics/layer-correlation.md](../analytics/layer-correlation.md) and
  [../analytics/layer-pairing.md](../analytics/layer-pairing.md) — the
  route, its methods and how two layers are put on one grid.
- [../contracts/overview.md](../contracts/overview.md) — the capability
  entry, variant `agent_state.gis_correlation_layers` and the recorded gap
  `WF_CAP_GIS_CORRELATION_SDK_AND_AGENT_UNAVAILABLE`.

## Validation checklist

- Four places must agree, and each drifts on its own:

  | Place | Value |
  |---|---|
  | node kind (builder, contracts) | `gis_correlation_agent` |
  | `mapAgentKind` (`compile.go`) | `"gis_correlation"` |
  | `agentKindGisCorrelation` (`agent_runtime.go`) | `"gis_correlation"` |
  | `_SUBAGENT_KEY_BY_KIND["gis_correlation"]` (`workflow_output_agent.py`) | `"gis_correlation_analyst"` |

  The Engine and Worker capability-inventory tests cover the first three;
  `tests/test_workflow_gis_correlation_agent.py` covers the fourth.
- The plain `correlation_agent` / `correlation` names stay unused: they are
  reserved for the future Correlation Agent, which will own
  `compute_correlation`. `compute_correlation` stays with the data analyst.
- The node is not in `contracts/workflow_node_kinds.json` (no agent kind
  is); it is in `contracts/data_reference.json` `channel_map.static` with
  `["default"]` and its two mirrors.
- The Worker's side sets and the builder's `GIS_CORRELATION_LAYER_KINDS`
  must match the analytics service's `UPPER_KINDS` / `BOTTOM_KINDS`. Two
  tests read `analytics/analytics/services/layer_pairing/types.py` and fail
  on drift: `TestGisCorrelationSideSetsMatchTheAnalyticsService` (Worker) and
  "offers exactly the analytics service's layer kinds on each side"
  (`workflowAgentState.test.ts`). The agent's `LAYER_KINDS` copy is not
  covered by them.
- SDK and Agent authoring are `planned`. Making them available needs an SDK
  method, a pack entry and an enabled Agent variant landed together; see the
  recorded gap.
- Not in the first release: an upwind share (it needs a third wind layer
  and a `land_class`), and upper layers that are not Asset nodes.
