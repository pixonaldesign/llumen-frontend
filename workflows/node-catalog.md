---
topic: workflows
services: [engine, frontend, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow node catalog

## Audience and goal

Authoritative taxonomy for **node kinds** lives in `contracts/workflow_node_kinds.json` (byte-mirrored into `engine/internal/engine/generated/` and `frontend/src/generated/`) with `_schema_version` and four buckets: `triggers`, `executable_triggers`, `side_effect_actions`, `non_executable`.

## Read first (ordered)

1. `workflow_node_kinds.json` — read `_comment` about single source of truth.
2. `engine/internal/engine/nodekinds_test.go` — `TestNodeKindRegistryMatchesContracts`.
3. `frontend/src/services/workflowService.ts` — build-time assertion mentioned in JSON comment.

## How it works

**Executable triggers subset.** JSON lists kinds a run request may start without external ingress—used by the engine's `defaultExecutableTriggerKinds` / `resolveDefaultTriggerNodeID` (`engine/internal/service/createrun.go`) when a run names no trigger.

**Side-effect actions.** Kinds like `send_chat_message`, `send_email`, `send_api_request` require explicit acknowledgement in builder step-test UI per runtime spec §5.9 (paraphrased in JSON `_doc`).

**`asset` node — bound-asset lifecycle.** An `asset` node (kind name `"asset"` in `contracts/workflow_node_kinds.json`) stores the chosen asset's id as `config.assetId` (plain string; no FK — see `engine/internal/engine/compile.go` `AssetID string \`json:"assetId"\``). Because of this, deleting that asset would break the node's run, so the platform **blocks** an asset hard-delete while any published/latest-authored workflow embeds it — the engine scans authored documents on demand (`GET /internal/v1/assets/{assetId}/usage`, `engine/internal/service/componentusage.go` `AssetUsageScanner`) and the content service's `DELETE /api/content/v1/assets/{id}` returns 409 (see [services/content.md → Assets](../services/content.md#assets)). **Archiving** an asset does *not* block and does *not* break the node: the worker's `loadComponentAsset` (`worker/internal/worker/asset_runtime.go` — the Go symbol name still says "component", the concept is "asset") resolves the row by id/workspace irrespective of status, so archived assets keep running here; the builder just shows an amber "archived" alert on the node (`WorkflowRfNode`, via `assetService.getArchivedAssetIds`, which reads `asset` joined to `status` straight from Supabase under RLS). See [charts/overview.md → Component lifecycle](../charts/overview.md#component-lifecycle-archive--delete).

**Asset result cache.** `worker/internal/worker/asset_runtime.go` writes the
adapter's parquet result into a Storage bucket literally named `asset-cache`
(`assetCacheBucket = "asset-cache"` — not `visual-cache` or any other name),
at path `{assetId}/{sha16-hash}.parquet`, and validates the round-trip by
checking for the `PAR1` magic bytes (Apache Parquet's file signature) at
both the head and tail of the downloaded blob
(`worker/internal/worker/asset_cache.go`).

**Known naming inconsistency (not a doc bug — a real code inconsistency).**
The "component" → "asset" rename is incomplete in the worker: error codes in
`asset_runtime.go` mix both prefixes in the same file (`WF_ASSET_BINDING`,
`WF_ASSET_INVALID_ID`, `WF_ASSET_NO_QUERY`, `WF_ASSET_RUNNER` alongside
`WF_COMPONENT_LOAD_ASSET`, `WF_COMPONENT_NO_SOURCE`), and one failure message
literally reads `"asset asset has no source bound"` (duplicated word, from a
half-completed find/replace). If you touch this file, don't "fix" the
inconsistency silently in an unrelated PR — error code strings are meant to
be a stable surface (see the cache-reason-code comment in `asset_cache.go`).

**`ai_findings` node — opts the flow into AI Findings.** A terminal node
(Agentic Flow only, at most one per graph — `WF_COMPILE_AI_FINDINGS_SINGLETON`).
Its one optional setting, `instructions` (at most 1,000 characters), tells the
findings agent what to focus on; see
[ai-findings.md](ai-findings.md#the-authors-focus). It compiles to `llumen.noop` with no output
channels, so it does nothing at runtime. What it changes is publish: the
content service sets `workflow_definition.ai_findings_enabled` from whether the
published version holds it, and the existing findings queue keys off that
column. The SDK and the Agent cannot author it yet
(`WF_CAP_AI_FINDINGS_SDK_AND_AGENT_UNAVAILABLE`). See
[ai-findings.md](ai-findings.md).

**`forecast` node — time-series projection behind a gate.** Buckets its wired
input to a grain, asks the forecastability gate whether the series can support a
forecast, and only then calls the model. Compiled by
`engine/internal/engine/compile.go` (`WF_COMPILE_FORECAST_*` codes) and run by
`worker/internal/worker/forecast_runtime.go`.

*Config keys.* The engine compiles seven: `timeColumn`, `targetColumn`,
`seriesIdColumns`, `grain`, `horizon`, `onRefuse` and `rowSource`. Six of them
are read and written by
`frontend/src/features/workflows/forecast/forecastConfig.ts`. **`rowSource` is
the exception — the forecast panel does not let you *set* it**, unlike its
`ml_model` and `create_asset` siblings, which both offer ancestor-ref rewiring
so the node can read an ancestor's output instead of its wired input. The engine
honours a hand-authored `rowSource`, so the gap is in the authoring UI only —
and the panel does now *resolve* one: it reads its column list from the
referenced ancestor rather than the wired `default` edge, which it previously
ignored, leaving such a node reporting "Run the upstream node once…" forever.

**A `rowSource` reference must name a whole output.** It swaps the node's entire
data input for the referenced artifact, and the runtime
(`selectRowSourceUpstream`) never reads `field_path`, so a field path would be
discarded without a word and the node would forecast a different table than the
author named — a plausible-looking forecast of the wrong series. `forecast` is
therefore in the same compile-time guard as `create_asset` and `ml_model`
(`ancestor_refs.go`), which fails with `WF_COMPILE_INVALID_ROW_SOURCE`.

Four of the six carry traps worth knowing:

- **`seriesIdColumns` must be absent, not empty.** The engine prunes empty
  collections before hashing step bindings, so persisting `[]` rotates the
  bindings hash on a round-trip that changed nothing — which re-runs every step
  of every existing workflow on republish. `writeForecastConfig` deletes the key
  rather than writing an empty array, and its test pins that. A blank or
  repeated column, or one that is also the time or target column, fails compile
  with `WF_COMPILE_FORECAST_INVALID_SERIES_COLUMNS`.
- **`grain`** is one of `hour` / `day` / `week` / `month`. The period table
  (`GRAIN_PERIOD` = 24 / 7 / 52 / 12) is defined once per language and asserted
  equal on both sides: `forecastConfig.ts` in TypeScript,
  `analytics/analytics/services/forecast/diagnostics.py` in Python.
- **`horizon` is capped in the panel, not in the config schema.** Once the panel
  holds a gate verdict it ceilings the Periods ahead field at that verdict's
  `max_horizon`, so the commonest refusal — asking for more periods than the
  history supports — cannot be authored. The value on disk is still a plain
  integer with no upper bound, and two cases deliberately reach the run
  unclamped: a horizon **already saved** above the cap is flagged with a one-
  click fix but never rewritten (opening a node must not edit the workflow), and
  the cap belongs to the single series the panel judges, so a sibling series may
  still be refused. The gate remains the only authority; the field is a
  convenience in front of it.

  In practice that ceiling is rarely reachable. A node preview holds at most 50
  rows (`previewSampleRowLimit`), and the panel refuses to judge a truncated
  preview, so on any real source there is no verdict and no cap. That is what
  `shorten_to_supported` below is for.
- **`onRefuse` has three values, in ascending order of forgiveness.** `fail`
  (the default) stops the step on any refusal. `pass_through_empty` drops refused
  series and carries on. `shorten_to_supported` additionally asks the gate to
  **clamp** rather than refuse for distance, so asking for more periods than the
  history supports stops being an error. The engine rejects any other value at
  compile (`WF_COMPILE_FORECAST_INVALID_ON_REFUSE`), so a typo reaches the author
  rather than quietly becoming `fail`. Past compile, unrecognised values still
  mean `fail` on both sides — `forecastOnRefuse` in Go and `readForecastConfig`
  in TypeScript — so a worker meeting a newer config stops rather than inventing
  a policy.

  Three consequences of `shorten_to_supported` worth knowing:

  1. **Each series shortens to its own cap**, so two series in one node can carry
     different numbers of forecast rows. Anything downstream that assumed
     `rows == series × horizon` is wrong from this change onward. It is also why
     `forecastEngineAll` batches by `{tier, horizon}`: `/api/v1/forecast` takes
     one horizon per request, so two series granted different lengths cannot
     share one.
  2. **Shortening rescues the distance refusal and nothing else.** A series with
     too little history or too many gaps still refuses, and under this mode is
     skipped and named. The step fails only when nothing was forecast.
  3. **A shortened run succeeds.** Asking for 14 and receiving 7 does not turn
     the step red, so a briefing titled "14-day outlook" built on one would be
     wrong with nothing to flag it. The preview note from `forecastSkippedNote`
     names the series and both numbers, and is the author's only warning.

*Values are summed within each period, with no author choice.*
`forecastBucketRows` folds rows to the grain with `+=` (`forecast_runtime.go`).
That is right for a count or a volume and **wrong for a level or a rate**: for a
rate metric with many rows per period, SUM scales with row count — twenty-four
hourly occupancy readings become a daily "occupancy" of ~1800% — and because the
history rows carry the same inflation, the chart looks internally consistent. The
gate has no unit awareness, so it sees a plausible series and allows it. An
`aggregation` selector is deferred; until it lands, aggregate rate metrics
upstream and feed one row per period. The node panel states this next to the
value-column picker (`ForecastNodeConfigEditor.tsx`).

*Output columns* are exactly `TS`, `FORECAST`, `LOWER_BOUND`, `UPPER_BOUND`,
`SERIES_ID`, `IS_HISTORY` (`forecastOutputColumns`, pinned by
`TestForecastOutputColumnsMatchTheChartContract`). A `line` or `area` chart of
`TS` against `FORECAST` draws the history and the forecast in two colours, split
on `IS_HISTORY`, with the forecast starting at the last observed period
(`frontend/src/utils/forecastHistorySplit.ts`; see
[../charts/line-chart.md](../charts/line-chart.md)). **No chart renderer draws
the uncertainty band yet**: the line has no band, and a `range` chart draws the
band from `LOWER_BOUND`/`UPPER_BOUND` with no median line.

Their **types** are declared too, in `forecastOutputColumnTypes`, and that is
not tidiness. `serializeRowsToParquet` reads a column's type off the rows it is
handed, and the refusal path hands it none — so inference alone would write
every column as text on exactly the runs that produce no rows. `FORECAST` would
be a parquet `DOUBLE` on an allowed run and a `String` on a refused one, and a
downstream `avg(FORECAST)` that never changed would fail on the second run while
blaming the aggregate. `serializeRowsToParquetTyped` takes the declaration, and
`TestForecastAllowedAndRefusedTablesShareOneSchema` pins that the two paths
produce one schema.

*A refusal is per series, not per step.* On a panel the gate is asked about each
series separately and the answers are independent, which is what the node panel
promises ("Each series is judged and forecast on its own"). `onRefuse` decides
what one refusal costs the rest:

- **`fail`** (the default, and what an unset or unrecognised value falls back
  to) — any refusal fails the whole step with `WF_FORECAST_REFUSED`. The
  message names the refused series and carries the gate's reason verbatim; past
  the first three it summarises the tail rather than pasting forty paragraphs.
- **`pass_through_empty`** — every series the gate allowed is still forecast,
  and the refused ones are simply left out. The table is empty only when
  *nothing* was allowed. The count of what is missing goes into the output's
  preview note (`forecastSkippedNote`), because a refused series is absent
  rather than marked, and rows that are not there look exactly like rows nobody
  asked for.

`forecastGateAll` therefore collects refusals and carries on rather than
returning on the first — returning would discard the clearances it had already
granted, and a forty-station panel would write a zero-row table because one
station had a gap, while the step reported success.

**A tier can also decline at *serve* time, and that counts as a refusal too.**
The gate cannot know that `AutoETS` will drop its seasonal term until it has
fitted, so a series can clear the gate and still be declined by the engine —
which `classical()` does deliberately rather than return a flat line. The
ml-inference route answers per series: declines come back in a `refused[]` array
beside `forecasts[]`, `forecastEngineAll` returns them, and `forecastJudge`
folds them into the same `Refused` list and the same `onRefuse` decision the
gate's own refusals use. Treating one decline as a request failure meant a
single short series took its 24 batch-mates down with it under
`WF_FORECAST_ENGINE_UNAVAILABLE` — an error that blamed the engine for
answering correctly. A tier that is missing from the deployment entirely
(`TierUnavailable`) still fails the request, because every series would fail
the same way.

**A row with no timestamp or no value is dropped, not an error.** A SQL `NULL`
arrives as a Go `nil`, and a missing reading is the most ordinary shape real
sensor and meter data takes. Failing on one would fail the step *before* the
gate is consulted, so `pass_through_empty` could not help and one offline
station on one day would destroy a forty-station panel. Dropping hands the gate
a hole, which it already knows how to judge — it narrows to the longest usable
run, or refuses with a coverage sentence. The count goes into the same preview
note as the refusals. A cell that is *present* but unparseable is still a hard
error, and the message names the row's timestamp rather than only its index into
the parquet file.

A refusal's **series ids go to the preview note, never to a log**
(`forecastRefusalLogFields` carries counts only). A series id is not an internal
identifier: it is built from whatever columns the author chose to split by, and
the panel offers every column in the upstream schema — split by `customer_email`
or `patient_id` and the ids *are* the data. Logged, they reach the telemetry
relay and outlive the run in front of a wider audience than the workflow itself;
in the preview note, workflow access decides who sees them.

*Requests to ml-inference are batched.* `forecastEngineAll` sends
`forecastEngineBatchSize` (25) series per request rather than a whole tier at
once. ml-inference forecasts a request's series **sequentially** in one handler
and each costs a served fit plus up to six calibration fits, so one call per tier
would make the panel's width a multiplier on
`ML_INFERENCE_SERVICE_TIMEOUT_SECONDS` (120s) — and the timeout is what fails,
not the work. Its route is a sync `def`, so Starlette runs it in a threadpool
with no cancellation: the client gives up, the server computes on for nobody, and
a retry stacks another panel on top. Measured warm at hour grain, horizon 24,
calibration on, tier 1 costs ~0.55s per series and tier 2 ~0.14s, so 100 would
have fitted on that machine; 25 is sized for the machines that are not it.
ml-inference rejects a request of more than 25 series (`MAX_SERIES` in its
forecast route), so the two numbers must move together.

*The gate's verdict is visible before a run.* The node panel calls
`POST /api/analytics/v1/forecast/gate` on open — cheap and read-only — and
renders the gate's `reason` verbatim. It **never** calls the forecast engine;
opening a panel must not run a model, and a test asserts no forecast request is
issued on mount. The panel judges only when it holds the whole upstream output:
a node preview carries at most 50 rows (`previewSampleRowLimit`), and a verdict
computed from 50 of 240 rows is a *different* verdict, not a smaller one — at
week grain the floor is 104 points, so every weekly series would be refused for a
false reason. When the preview is partial the panel says so and leaves the
verdict to the run (`forecastSeries.upstreamCompleteness`).

## Cross-cutting: per-node config extensions

Several optional keys are accepted on **every** node's `config` object
regardless of kind. Keep these documented here rather than on each
kind-specific page:

- `ancestor_refs` — see [ancestor-refs.md](ancestor-refs.md). Synthesised
  inputs do **not** count toward `maxInputsForKind`, so exposing them
  does not change a node's advertised arity in the builder.

Output-node kinds (`slides_agent`, `briefing_agent`) additionally route
through a distinct worker/agent path; see
[output-agents.md](output-agents.md). `dashboard_agent` stays on the
legacy unstructured-agent path. `data_analyst_agent` shares the
output-agent transport but has its own worker runner and persists
nothing; see [data-analyst-node.md](data-analyst-node.md).
`gis_correlation_agent` (GIS Correlation Agent) does the same, and reads
its two map layers from the graph: the wired Asset node is the upper
layer and a whole-output reference to a second Asset node is the bottom
one; see [gis-correlation-node.md](gis-correlation-node.md).

Note that agent kinds are **not** listed in
`contracts/workflow_node_kinds.json` — that file enumerates only
triggers, side-effect actions, non-executables, and DataFlow-allowed
kinds. Adding an agent kind there is not required and would be wrong.

## Integration map

- [triggers.md](triggers.md) — the `triggers`/`executable_triggers`
  contract buckets in detail (singleton rules, default-firing
  preference, per-kind ingress pages).
- [action-nodes.md](action-nodes.md) — the `side_effect_actions`
  contract bucket in detail.
- [source-nodes.md](source-nodes.md) — the `source` node kind (an
  ad-hoc query, distinct from the bound `asset` node documented above).
- [transform-nodes.md](transform-nodes.md) — `filter`/`if_else`/
  `switch_cases`/`edit_fields`/`aggregate`/`merge`.
- [agent-nodes.md](agent-nodes.md) — the eight agent node kinds this
  page's "Output-node kinds" paragraph summarizes.
- [ancestor-refs.md](ancestor-refs.md) — the `config.ancestor_refs[]`
  extension documented under "Cross-cutting: per-node config extensions".

## Validation checklist

- Never fork the JSON list into a second mirror — update generator or
  source file then regenerate Python if your pipeline requires.
- When adding a new node kind that emits content (slides, briefing,
  dashboard, …), decide whether it belongs on the output-agent runtime,
  the unstructured runtime, or a dedicated runner **before** wiring it
  into `dispatchAgentKind` (worker). A kind that returns an *analysis*
  rather than content probably wants its own runner — reusing the
  output-agent one drags in a persistence tail it does not want
  (`data_analyst_agent` is the worked example).
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
