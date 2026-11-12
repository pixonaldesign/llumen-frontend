---
topic: workflows
services: [agent, content, engine, frontend, runner, worker]
status: current
---
# Workflow feature — current functionalities

> **Status:** definitive reference audit of what the Llumen workflow feature *currently does*, end to end.
> **Ground truth:** the running code (engine / worker / content / frontend) and the two shared JSON
> contracts. Where the intended spec (archive user slides / FRs) describes behaviour that is **not yet
> built**, it is cross-referenced in §9 — but the **code is authoritative for "current"**.
>
> **Sources** (all `file:line` citations trace to these six research reports — see the Sources footer):
> engine, worker, backend, **frontend (authoritative for builder UI + palette)**, archive-docs
> (intended spec: US1–US17, FR-001..FR-148), plus the prototype design baseline.
>
> **Reconciled cross-report discrepancies** (stated explicitly, not silently resolved):
> - **Node count.** The frontend `nodeCatalog.ts` is authoritative for the **builder palette** (~26 kinds,
>   including `create_asset` and `ml_model`). The engine/contract define **compiled** kinds. The archive
>   docs describe **25 intended** kinds. The single authoritative catalogue in §3 marks every node as
>   **in-palette**, **compiled-only** (e.g. `ml_predict`), or **doc-only / aspirational**.
> - **Licensing.** Nodes have **no per-node tier field** (`grep licenseTier|requiredTier|nodeTier` in the
>   workflows feature → nothing). Workflows are **feature-gated at the `command` tier**
>   (`contracts/license_tiers.json`). §3 therefore carries no per-node tier column; §8 has the truth.
> - **Builder UI facts** come from the frontend report (corrects earlier ad-hoc reads): undo/redo
>   **exists**; publish/unpublish **is** the activation mechanism (no separate `active` boolean);
>   marquee/box-select, multi-select, copy/paste/duplicate, right-click context menu, minimap, and
>   config-modal prev/next are **NOT implemented**; sticky notes have **no resize**; the config modal is
>   **3-column**; node step-test has **3 input modes**.

---

## 1. Executive summary

Llumen Workflows is a **asset, node-based automation builder** plus a **durable, lease-based execution
runtime**. A user authors a directed-acyclic graph of nodes (one or more *triggers* feeding *steps*) on a
React-Flow canvas, then publishes it so it can run on a schedule, by webhook, by chat, or manually.

The feature spans four services with a clean **author → compile → run** pipeline:

1. **Frontend (Next.js)** — the builder canvas, palette / add-node drawer, three-column per-node config
   modal, executions view, chat window, version history, and run-detail drawer. The builder **autosaves**
   the authored document on every change by `PUT`-ing it to the content service.
2. **Content (Go)** — the REST surface for definitions / versions / runs / chat / webhooks / assistant
   proposals. On every authored save it asks the engine to store the gzipped `authored.json` and
   **compile** it. It is the **single RBAC + license enforcement point**; the engine trusts internal
   calls.
3. **Engine (Go)** — **compiles** the authored document into an immutable `CompiledPlan`
   (validate → map node kinds to adapter keys → wire edges → build ancestor index; `compile.go:188`),
   **materializes triggers** (schedule rows + webhook bindings) on publish, **creates runs** (manual /
   schedule / webhook / chat / step-test), and runs the **scheduler** (fires due schedules) and the
   **sweeper** (lease reclaim, step timeouts, cancel finalisation, retention purge).
4. **Worker (Go)** — a poll-loop that **leases** ready `workflow_step_run` rows off Postgres
   (`FOR UPDATE SKIP LOCKED`), loads the compiled plan from storage, **dispatches by adapter key**
   (`executor.go:224`) to a per-kind runtime, persists outputs + artifacts in one transaction, enqueues
   newly-ready downstream steps, and finalizes the run.

```
 Builder (autosave)        Content                    Engine                         Worker
 ────────────────── PUT ─▶ content: PUT authored ───▶ create version: store         │
                                                      authored.json + Compile ──▶     │
                                                      CompiledPlan (immutable)        │
 Publish ──────────▶ content: POST publish ────────▶ materialize_triggers            │
 Run / Schedule /          content: POST runs;        create_run ──▶ INSERT           │
 Webhook / Chat ─────────▶ content: webhook / chat ─▶ workflow_run + initial steps   │
                                                      scheduler tick fires schedules ─┤
                                                                                       ▼
                                                         claim step ◀── poll Postgres (FOR UPDATE SKIP LOCKED)
                                                         dispatch by AdapterKey → runtime
                                                         persist output+artifact, enqueue downstream
                                                         finalize run; sweeper reclaims/timeouts/cancels
```

Data is exchanged as **Parquet** (tabular) or **JSON documents** (non-tabular) in an object-storage bucket;
Postgres holds the run / step / output / artifact / event rows. Inter-service auth uses `X-Engine-Key`
(content→engine, `content/internal/engine/client.go`), `X-Internal-API-Secret` (worker→content and agent→content internal routes, `RequireInternalSecret`),
`X-Agent-API-Key` (worker→agent), and `X-ML-Inference-API-Key` (worker→ML inference,
`mlinferenceclient/client.go:47`).

---

## 2. Architecture & data flow

### 2.1 Services and their roles

| Service | Tech | Role in workflows |
|---|---|---|
| Frontend | Next.js App Router | Builder canvas, palette/drawer, node config modal, executions, chat, version history, run-detail. Autosave → content. |
| Content | Go (`content/`) | Flow definition and run REST surface; RBAC + license gates; runs as the caller so RLS decides; proxies version writes/publish/run/step-test/cancel/purge to the engine. Also Flow chat (chat-resume), the public webhook ingress, assistant proposals, trigger list and webhook secrets, and the internal worker→content endpoints (create-asset, ML batch-predict). |
| Engine | Go (`engine/`) | Compile/validate; trigger materialization; run + step-test + chat-resume + cancel creation; scheduler; sweeper. Separate Go module from the worker (cross-module imports avoided; duplicated logic kept in lockstep by tests). |
| Worker | Go (`worker/`) | Lease + execute steps; per-kind runtimes; persist artifacts/outputs/events; enqueue + finalize. |
| Agent service | FastAPI (`agent/`) | LLM unstructured/structured calls (`/api/internal/llm/{unstructured,structured}`); output-agent (slides/briefing) generation (`/api/internal/workflow/output_agent`). Called by the worker; STUB mode when base URL empty. |
| Runner | Go (`runner/`) | Source query execution (parquet/json content negotiation), credentialed API calls (source-mode `send_api_request`). |
| ML inference | service | Catalog model `/api/v1/predict` (for `ml_predict`). |
| Supabase | Postgres + Storage | Authoritative schema, RLS, object-storage buckets (`workflow`, `asset-cache`, etc.). |

### 2.2 Document model (authoring)

The **authored document** is the durable source of truth a user edits. The engine parses it into
`AuthoredDoc` / `AuthoredNode` / `AuthoredEdge` (`authored.go:9-33`); `ParseAuthoredJSON` rejects
`WF_COMPILE_INVALID_JSON` / `WF_COMPILE_EMPTY_GRAPH` (`authored.go:35`). Node `Config` is kind-specific
JSON; node `Settings` holds policy knobs (timeout, on-error, etc.).

Node kinds split into four contract buckets (`contracts/workflow_node_kinds.json`, embedded via
`//go:embed` at `nodekinds.go:28`):
- **triggers** (`:5-13`) — enter the plan as `CompiledPlan.TriggerPlans`, never as steps:
  `manual_trigger`, `schedule_trigger`, `chat_input_trigger`, `webhook_trigger`.
- **executable_triggers** (`:15-22`) — subset a run request can fire via `POST /workflow-runs` without
  external ingress: `manual_trigger`, `schedule_trigger`, `webhook_trigger` (chat excluded — needs a
  session).
- **side_effect_actions** (`:24-31`) — require `confirm_live_execution` to step-test:
  `send_chat_message`, `send_email`, `send_api_request`.
- **non_executable** (`:33-38`) — dropped by `ExecutableNodes()`: `sticky_note`.

Go accessors with defensive hard-coded fallbacks: `NodeKindTriggers` (`nodekinds.go:65`),
`NodeKindExecutableTriggers` (`:83`), `NodeKindSideEffectActions` (`:98`); `IsSideEffectActionKind`
(`subgraph.go:239`). The frontend reads the same contract; a TS build-time assertion in
`frontend/src/services/workflowService.ts` fails if a kind is authored without a classification.

**Storage layout** (see [../artifacts-storage.md](../artifacts-storage.md); content's object helpers are
`content/internal/storagedoor/workflow.go`):
- Bucket: the fixed `"workflow"` (`storagedoor.WorkflowBucket` in content, `storage.WorkflowBucket` in
  engine and worker).
- Authored: `workflow-definitions/{def_id}/{version_no}/authored.json.gz` (gzip, sha256+size),
  written by the engine's version route (`engine/internal/service/createversion.go`) when content's
  `PUT .../authored` saves, recorded as a `workflow_document(document_kind='authored_workflow')` linked
  to `workflow_version.authored_document_id` in the same transaction.
- Compiled JSON: **engine-written** to `workflow-definitions/{defID}/{versionNo}/compiled.json.gz`
  (`service/compile.go`), referenced via `workflow_version.compiled_document_id`.
- Step-test fixtures: `workflow-versions/{vid}/step-test-fixtures/{sha}.json` (`steptest.go:488`).
- Run artifacts: `workflow-runs/{runID}/steps/{stepRunID}/output/{channel}/part-00000.{ext}`
  (worker report §2).

### 2.3 Compiled plan (the immutable executable artifact)

The engine `Compile(doc, workflowVersionID)` (`compile.go:188-270`) produces an immutable `CompiledPlan`
(`compile.go:19-103`). Pipeline: `ValidateAuthored(doc)` → build `CompiledTrigger` per trigger node →
map every node id→kind into `AuthoredNodeKinds` → `compileNode` each executable node into `StepPlans` →
wire edges into `CompiledInput{FromNodeID,FromChannel,ToInput}` (skipping edges into triggers) → append
synthetic ancestor-ref inputs (`appendAncestorRefInputs`) → build `AncestorIndex` via
`BuildAncestorStepIndex`.

- `TriggerPlans []CompiledTrigger` — `{TriggerNodeID, TriggerType, PublishedOnly, Schedule?, Webhook?}`.
  `TriggerType` = kind minus the `_trigger` suffix; `PublishedOnly=true` for `schedule`/`webhook`
  (`compile.go:195-223`).
- `StepPlans []CompiledStep` — `{NodeID, Kind, AdapterKey, Inputs[], Outputs[], Policy, Bindings}`.
- `AuthoredNodeKinds map[nodeId]kind` — lets the worker recover the authored kind from the adapter key.
- `AncestorIndex` — ordered step ancestors per node (used by output agents for context).

**Service-layer compile** `Compiler.CompileVersion` (`service/compile.go:52-151`): loads the version row +
authored blob, parses, compiles, gzip-encodes, sha256s, writes `compiled.json.gz`, upserts
`workflow_document(kind=compiled_plan)`, sets `workflow_version.compilation_status='valid'`, stamps
`node_count`/`edge_count`/`trigger_count`, and invalidates the compiled-plan cache
(`defaultCompiledPlanCache.Forget(versionID)`, `:149`). On failure → `setCompilationFailed` records a
`WF_COMPILE_*` code via `classifyCompileError` (`:153-205`). `EncodePlanJSON` produces compact
non-HTML-escaped JSON (`compile.go:1281`).

Compiled plans are **immutable per version** and cached in a process-local LRU (`CompiledPlanCache`,
default cap 64, keyed by `workflow_version_id`, `service/compiledcache.go`), consulted on every
create-run / webhook / schedule-fire / chat-resume / step-test / materialize path. Multi-replica caveat:
other replicas serve the prior plan until eviction (spec-accepted tradeoff vs Redis).

### 2.4 Runs

A run is a `workflow_run` row whose status flows `queued → running → waiting → {succeeded, failed,
timed_out, cancelling → cancelled}` with `run_mode` (`production`, `builder_debug`, `builder_step_test`,
`builder_replay`), `trigger_type`, `trigger_node_id`, `retention_class`, optional `root_input_document_id`
(trigger payload), `debug_target_node_id`, `source_run_id`/`retry_of_run_id`, `workflow_chat_session_id`,
and `retain_until`. **Only one active run per definition** is allowed — `CreateManualRun`
`SELECT ... FOR UPDATE` locks the definition and rejects `WF_RUN_ALREADY_ACTIVE` if any run is in
{queued, running, waiting} (`createrun.go:182-197`).

`retain_until` is computed inline from the retention class: standard `+30d`, debug_short `+7d`, pinned
`NULL` (`createrun.go`; builder modes default `debug_short`, else `standard`, `isValidRetentionClass`
`createrun.go:417`).

The append-only `workflow_event` stream (run_started, run_queued, run_completed, step_leased, step_queued,
step_started, step_waiting, step_resumed, step_succeeded, step_failed, artifact_written,
component_cache_fallback, run_cancel_requested, run_cancelled, step_lease_expired_*, …) carries a **per-run
sequence number** allocated under a per-run advisory xact lock (`pg_advisory_xact_lock` on the run-uuid
md5, `events.go:48`). Emission failures are logged-and-swallowed (`logEventFailure`, `events.go:117`).

---

## 3. Node catalogue (single authoritative table)

**Availability legend.** *in-palette* = an entry exists in `nodeCatalog.ts` and can be dragged in from the
add-node drawer. *compiled-only* = the engine compiles + the worker executes it, but it has **no palette
entry** (only reachable via direct authored-doc / integration writes). *doc-only / aspirational* = appears
in the intended spec but is not in the running code.

**Authority sources per column:** *category / display name / key config / in-palette* → frontend
`nodeCatalog.ts`; *kind / adapter key / output channels / arity / compiled-only* → engine `compileNode`
(`compile.go:277-565`) + `contracts/workflow_node_kinds.json`; *runtime behaviour* → worker
`*_runtime.go`. **No per-node license tier** — see §8 (whole feature gated at `command`). Arity legend:
`in`/`out` = input/output port count; `default` is the canonical channel.

### 3.1 Triggers
*Enter the plan as `CompiledPlan.TriggerPlans`; never executed as steps. Step-testing a trigger →
`WF_STEP_TEST_TARGET_NOT_EXECUTABLE`. All four are in-palette.*

| Kind | Display name | What it does | Key config | In/Out | Availability |
|---|---|---|---|---|---|
| `manual_trigger` | Manual Trigger | Start manually from library/builder. **Singleton** (`WF_COMPILE_MANUAL_TRIGGER_SINGLETON`, `validate.go:34`). | InfoCard only (no fields) | 0 / 1 (`default`) | in-palette |
| `schedule_trigger` | Schedule Trigger | Fire on a recurring cadence; engine scheduler owns firing. **Published-only.** | `scheduleEvery`≥1 (cap 10000), `scheduleUnit` ∈ minutes/hours/days/weeks/months (**`seconds` rejected** `WF_COMPILE_SCHEDULE_UNSUPPORTED_UNIT`, `compile.go:1013`), `scheduleAtHour/Minute`, `scheduleWeekday`, `scheduleMonthDay` 1–28, IANA `scheduleTimezone` dropdown (validated via `time.LoadLocation`); derives `summary`/`cron_human` (`compileScheduleSpec`, `compile.go:990`). | 0 / 1 | in-palette |
| `chat_input_trigger` | Chat Input | Start from a chat conversation. **Singleton** (`WF_COMPILE_CHAT_TRIGGER_SINGLETON`); excluded from `executable_triggers` and from the bottom-bar execute picker (`excludeFromManualTriggerPicker`). | InfoCard only | 0 / 1 | in-palette |
| `webhook_trigger` | Webhook | Start from an inbound HTTP request. **Published-only.** | `method` GET/POST/PUT/PATCH/DELETE (default POST, else `WF_COMPILE_WEBHOOK_INVALID_METHOD`), `authMode` none/basic/api_key/bearer/oauth2; when oauth2: `oauth2Issuer`/`oauth2Audience`/`oauth2JwksUri`/`oauth2RequiredClaims`. OAuth2 (`compileWebhookOAuth2`, `compile.go:1185`) requires issuer (http(s)) + audience, asymmetric algs only (RS/ES/PS 256/384/512; HS* rejected to block alg-downgrade), default RS256. Secret + `path_key` allocated at materialize time, stored Fernet-encrypted. | 0 / 1 | in-palette |

### 3.2 Data & flow — data nodes
*Adapter keys: `llumen.runner.query`, `llumen.ml_model`, `llumen.ml.predict`, `llumen.component`,
`llumen.create_asset`.*

| Kind | Display | Category | What it does | Key config / bindings | In/Out | Availability |
|---|---|---|---|---|---|---|
| `source` | Data Source | Data & Flow | Runs `query` against a configured source via the Runner with **dual-mode content negotiation** (`Accept: parquet, json;q=0.9`). Parquet → table artifact; JSON → document artifact (graceful fallback for API/Mongo). | `sourceId` + mode (database/api_request/file/dataflow via wizard); `query` (SQL editor) or `apiRequest` payload (both id+query required: `WF_COMPILE_SOURCE_MISSING_ID/QUERY`, `compile.go:286`). Runtime `runSource` (`executor.go:279`). | 1 / 1 | in-palette |
| `ml_model` | ML Model | Data & Flow | Snowflake/registered-model **batch prediction**: picks first parquet upstream, reads rows via DuckDB (>50 000 → `WF_ML_MODEL_TOO_MANY_ROWS`), calls content's `POST /api/content/internal/v1/ml-models/batch-predict`, persists prediction parquet via the same envelope as `source`. | `MLModelNodeConfigEditor` (model select + ancestor field mapping); `mlModelSourceId` required (`WF_COMPILE_ML_MODEL_MISSING_ID`), optional `featureMappingJSON`. Runtime `runMLModel` (`ml_model_runtime.go:27`); needs the content client configured (`WF_ML_MODEL_BACKEND_UNAVAILABLE`, code name kept). | 1 / 1 | in-palette |
| `ml_predict` | *(no palette entry)* | Data & Flow | Catalog-model inference via the ML-inference service `/api/v1/predict`; wraps `{predictions,latency_ms,model_id,version}` as a **JSON document** (distinct from `ml_model`, which emits a table). | `modelId` required (`WF_COMPILE_ML_PREDICT_MISSING_MODEL_ID`), `inputsJson` (`[]map`). Adapter `llumen.ml.predict`, runtime `runMLPrediction` (`executor.go:908`); needs ML-inference configured (else `WF_ML_INFERENCE_DISABLED`). | 1 / 1 | **compiled-only** (`compile.go:534`; absent from `NODE_CATALOG`) |
| `component` | Component | Data & Flow | Re-renders a **saved dashboard asset** as a tabular step output, honouring the asset's cache TTL (`shouldExecuteQuery`). Cache hit → serve cached parquet; miss/stale → re-run query and **write back** to `asset-cache`. | `componentId` (browser modal, UUID required: `WF_COMPILE_COMPONENT_MISSING_ID`). Runtime `runComponent` (`component_runtime.go:76`). Asset scoped to workflow workspace or `is_global`. | 1 / 1 | in-palette |
| `create_asset` | Create Asset | Data & Flow | Persists an upstream parquet table as **both** a queryable source (the worker writes the rows into the Store itself) **and** a renderable dashboard asset (`CreateAsset`, content's `POST /api/content/internal/v1/flow-assets`). Emits `{asset_id, source_id}` JSON consumed downstream by output agents. **Thumbnail NOT produced by the worker** (frontend POSTs it later). | `CreateAssetNodeConfigEditor` (asset type + ancestor fields); `name` (default "Workflow Asset"), `chartType` (default table), `xColumn`, `yColumn`, `sourceId` (preset). Runtime `runCreateAsset` (`create_asset_runtime.go:16`); needs the content client configured (`WF_CREATE_ASSET_BACKEND_UNAVAILABLE`, code name kept). | 1 / 1 | in-palette |

### 3.3 Data & flow — transforms / control flow
*Compile to `llumen.transform` (except `wait`/`stop_error`/`no_operation`). Worker reads
`Bindings[language]` (sql|jq) + `Bindings[source]` and runs **in-memory DuckDB SQL** or **gojq**
(`transform_runtime.go`). SQL is safety-screened (`ValidateTransformSQL`, `safety.go:20` — rejects
DROP/ALTER/GRANT/REVOKE/CREATE/EXEC/COPY/LOAD/`pg_read_file`/`xp_cmdshell`/etc. → `WF_TRANSFORM_SQL_UNSAFE`).
Inputs registered as `input_N` / `ref_{alias}` / `input` views. All in-palette.*

| Kind | Display | What it does | Outputs / channels | In/Out | Availability |
|---|---|---|---|---|---|
| `filter` | Filter | Split rows on a condition. SQL: `kept` = `WHERE (source)`, `discarded` = `WHERE NOT(...)`. Canvas shows `kept` only. | `kept` (canonical), runtime also `discarded` | 1 / 2 | in-palette |
| `if_else` | If / Else | Branch into true/false paths (same split). | `true`, `false` | 1 / 2 | in-palette |
| `switch_cases` | Switch Cases | One channel per configured case + optional `else`; **exclusive vs all-matching** via guided `SendToAllMatchingCases` (`buildSwitchSQLOutputQueries` `transform_runtime.go:527`). Case ids validated (blank/dup → `WF_COMPILE_*_SWITCH_CASE_ID`). | dynamic per-case ids (+ `else`); default → 1 | 1 / N | in-palette |
| `edit_fields` | Edit Fields | Create/update fields on items (author SQL/jq). | `default` | 1 / 1 | in-palette |
| `aggregate` | Aggregate | Aggregate items — **author's raw SQL run verbatim** (no dedicated aggregate operator). | `default` | 1 / 1 | in-palette |
| `merge` | Merge | Union/combine multiple inbound slots, input-slot ordered (`orderTransformInputs` `transform_runtime.go:716`). Dynamic input ports (≥2 slots; blank/dup slot ids → `WF_COMPILE_MERGE_*` / `WF_COMPILE_DUPLICATE_MERGE_SLOT`). Strict per-slot cap. | `default` | N / 1 | in-palette |
| `no_operation` | No Operation | Pass-through; emits one empty control output. Adapter `llumen.noop`, runtime `runNoop` (`executor.go:254`). | `default` | 1 / 1 | in-palette |
| `wait` | Wait | Pause the run for a duration (`waitFor`/`waitUnit` seconds/minutes/hours/days, default minutes). Step → `waiting` (`lease_expires_at=NOW()+interval`); run → `waiting`; re-leased after expiry. Adapter `llumen.wait`, runtime `runWait` (`executor.go:672`). | `default` | 1 / 1 | in-palette |
| `stop_error` | Stop and Error | Deliberately fail the run (`stopMessage`, default "Workflow halted." → `WF_STOP_ERROR`). Adapter `llumen.stop_error`, runtime `runStopError` (`executor.go:764`). Sink (no output). | (none) | 1 / 0 | in-palette |

> **Joins / aggregations are author-written SQL** against registered `input_N` / `ref_*` / `input` DuckDB
> views — there is **no dedicated join/aggregate code path** (worker report §3.5, checklist).

### 3.4 ML
Covered in §3.2: `ml_model` (in-palette; content batch-predict → parquet, 50k cap) and `ml_predict`
(**compiled-only**; ML-inference catalog inference → JSON document). Both require the
`workflows`/`ml_models` license and a configured content / ML-inference client; the worker re-checks the
license during agent/ML paths because token/compute cost is real.

### 3.5 Assets
`create_asset` (produces source + asset + cache) and `component` (re-renders a saved asset) — both
in §3.2 — are the asset-producing / consuming nodes. Parquet integrity is verified by `PAR1` magic-byte
checks (`parquetMagicValid`, `asset_cache.go:145`) before trusting any cached/ingested blob.

### 3.6 Analysis Agents
*Adapter `llumen.agent`; runtime `runAgent(false)` (`agent_runtime.go:127`). Worker dispatches on
`Bindings[agentKind]` (general / classification / insight). License `workflows` re-checked at runtime. All
in-palette.*

| Kind | Display | What it does | Key config / bindings | In/Out | Availability |
|---|---|---|---|---|---|
| `general_agent` | General Agent | Free-form LLM task over **bounded upstream context** (48 KB budget, table summarisation via schema/aggregates/head+tail). Emits a text JSON document `{kind,text}` (`runUnstructuredAgent` `agent_runtime.go:378`). | `instructions` **required** (`WF_COMPILE_AGENT_INSTRUCTIONS_REQUIRED`); `AgentNodeConfigEditor` (prompt + ancestor refs). | 1 / 1 | in-palette |
| `data_classification_agent` | Data Classification Agent | Classifies table rows into configured categories. **Caps 2000 rows, batches of 20**, structured LLM call (literal-constrained to category names, injection-sanitised); routes rows to per-category channels + reserved `_unclassified` (`runClassificationAgent` `agent_runtime.go:675`). | `categories[]` `{id,name,example}` (all non-blank, unique ids & names, no reserved `default`/`_unclassified`); `instructions` required (`WF_COMPILE_AGENT_CATEGORIES_*`, `validate.go:386`). | 1 / N + `_unclassified` | in-palette |
| `insight_generator_agent` | Insight Generator | Structured-output agent producing insights from configured fields; appends `insightType`. One JSON document (`runInsightAgent` `agent_runtime.go:621`). | `instructions` required; `fields[]` (≥1 non-blank, no dups → `WF_COMPILE_AGENT_INSIGHT_FIELDS_REQUIRED` / `..._FIELD_DUPLICATE`). | 1 / 1 | in-palette |

### 3.7 Output Agents
*Adapter `llumen.output_agent`; runtime `runAgent(true)`. Slides/briefing route through the **deep Infusion
path** `runInfusionOutputWorkflowAgent` (`agent_runtime.go:448`): ancestor-narrative context (40 KB
markdown walk of `AncestorIndex`), `{{alias}}` expansion from `$ref:` ancestor inputs (unresolved aliases
tolerated), and static+dynamic source-id collection. All in-palette.*

| Kind | Display | What it does | Key config | In/Out | Availability |
|---|---|---|---|---|---|
| `slides_agent` | Slides Agent | Generates a Slides and **persists it to Supabase** (`create_slides_with_workspace` RPC for the parent, then REST inserts chapter→section→section_asset; `slides_persist.go:62`). **Lenient:** never fails the step on persistence error (warns, `created_entity_id` null). Requires owner + configured Supabase client. | `instructions` required (`WF_COMPILE_AGENT_INSTRUCTIONS_REQUIRED`). | 1 / 1 | in-palette |
| `briefing_agent` | Briefing Agent | Generates a Briefing; the agent's `create_briefing` tool **self-persists** to Supabase; worker propagates `created_entity_id`. | `instructions` required. | 1 / 1 | in-palette |
| `dashboard_agent` | Dashboard Agent | **Currently produces only a text JSON document** via the unstructured path (`runUnstructuredAgent`) — no durable dashboard is created in the worker (worker report §3.10). The "create a dashboard item" intent is **partially implemented** (see §9). | `instructions` required. | 1 / 1 | in-palette (behaviour partial) |

### 3.8 Actions (side-effect)
*Adapter `llumen.action`; runtime `runAction` (`action_runtime.go:245`). These are the three
`side_effect_actions` (confirm required to step-test). Each writes an idempotency-journalled
`workflow_action_outbound` row keyed by `sha256(runID:nodeID:sha256(specJSON))` (`action_runtime.go:358`)
— editing the spec changes the fingerprint → distinct outbound; succeeded/waiting outcomes short-circuit
on retry (`shortCircuitActionSuccess` / `parkStepInWaiting`). All in-palette.*

| Kind | Display | What it does | Key config | In/Out | Availability |
|---|---|---|---|---|---|
| `send_chat_message` | Send Chat Message | `send_message`: inserts an informational chat bubble + JSON doc, succeeds. `send_and_wait`: one tx parks the step `waiting` (`wait_kind=chat_response`, `wait_handle=idempotencyKey`, `timeout_at=NOW()+ChatPromptTimeout`), inserts an approval/free-text prompt bubble; resumed by chat reply (`runSendChatMessage` `action_runtime.go:374`). **`send_and_wait` requires a `chat_input_trigger` in the graph** (`WF_COMPILE_ACTION_CHAT_WAIT_REQUIRES_CHAT_TRIGGER`, `validate.go:649`). | `mode` (send_message/send_and_wait), `responseType` (free_text/approval), `message` required; approval labels required when approval. | 1 / 1 | in-palette |
| `send_email` | Send Email | Sends **real SMTP** when `WORKFLOW_SMTP_HOST` is set (STARTTLS/SSL per `WORKFLOW_SMTP_TLS`, optional PLAIN auth, CRLF-sanitised subject, deadline-bound dial); otherwise a builder run is **simulated** (no journal row) and a production or `workflow_preview` run fails with `WF_ACTION_EMAIL_TRANSPORT_UNCONFIGURED` (`decideEmailTransport` / `runSendEmail` in `action_runtime.go`). Send failure → `WF_ACTION_EMAIL_SEND_FAILED`. | `to`+`subject`+`body` required (`WF_ACTION_EMAIL_*`); `cc`/`bcc` optional. | 1 / 1 | in-palette |
| `send_api_request` | Send API Request | **direct** mode: outbound HTTP to an arbitrary URL with **SSRF guards** (`validateActionRequestURL` blocks loopback / link-local / RFC1918 / ULA / multicast / unspecified / localhost), 1 MiB body cap, 30 s timeout, ≤5 re-validated redirects; non-2xx → `WF_ACTION_API_HTTP`. **source** mode: delegates to the Runner using stored credentials (`runSendAPIRequestSource` `action_runtime.go:853`). (`runSendAPIRequest` `action_runtime.go:699`) | direct: `method`+`url` required, header keys unique, body ≤1 MiB and disallowed for GET/HEAD/OPTIONS (`validateActionState` `validate.go:505`). source: `sourceId` required (UI request picker not yet built — §9). | 1 / 1 | in-palette (source-mode UI partial) |

### 3.9 Annotations (non-executable)
| Kind | Display | What it does | In/Out | Availability |
|---|---|---|---|---|
| `sticky_note` | Sticky Note | Canvas annotation only. Dropped by `ExecutableNodes` (`authored.go:50`); **may not have edges** (`WF_COMPILE_STICKY_NOTE_HAS_EDGE`, `validate.go:92`). Inline-editable `config.text`; **fixed 280×180, no resize** (`StickyNoteNode.tsx:16-19`, intentionally out of scope v1). `editorOnly`. | 0 / 0 | in-palette (annotation) |

### 3.10 Doc-only / aspirational kinds (NOT in code)
| Kind | Intended role | Status |
|---|---|---|
| `error_trigger` | Single-instance "on error" trigger | **Doc-only / abandoned** — prototype renderer only; not in catalogue, contract, or compiler (archive §4). |
| Screenshot Node | Capture a rendered screenshot | **Abandoned** — prototype component-library only; never in catalog/compiler/runner (T157). |

**Count reconciliation.** In-palette kinds in `nodeCatalog.ts` ≈ 26 (4 triggers + 11 data/flow incl.
`create_asset` and the 8 transform/control nodes + `sticky_note` + 3 analysis agents + 3 output agents +
3 actions). Engine **compiles** one additional kind not in the palette (`ml_predict`). The archive docs
enumerate **25 intended** kinds (they fold `ml_predict` away and exclude it; they include `create_asset`
in narrative but not in builder-spec §5). The catalogue above is the single source of truth and tags each
node's availability.

---

## 4. Authoring (builder UI)

> Sourced from the **frontend report** (ground truth) over `frontend/src/features/workflows/**` and
> `frontend/src/components/pages/workflows/**`. The builder shell is
> `WorkflowBuilderShell.tsx` (2626 lines); the `<ReactFlow>` element is at `:2371-2395` with only a
> `<Background variant=Dots>` child — **no `<Controls>`, no `<MiniMap>`**.

- **Canvas** — React-Flow with custom node types `workflowNode` (`WorkflowRfNode`), `workflowStickyNote`
  (`StickyNoteNode`), and edge type `workflowEdge` (`WorkflowRfEdge`). Card shape varies by dataflow
  position (`getNodeShape` `WorkflowRfNode.tsx:56`): triggers/no-input → left-pill, output-agents/sinks →
  right-pill, else rectangle. Execution status border + corner icon: running (blue spinner), succeeded
  (green), failed (red), cancelled (muted grey) (`:100-164`). Branch port labels colour-coded green
  (true/kept) / red (false) / neutral (`:255-271`).
- **Add-node drawer** (`WorkflowAddNodeDrawer.tsx`, 346 lines) — right-side glass drawer.
  `triggerFirstMode=true` shows **only triggers** until one exists (enforces "every workflow starts with a
  trigger"); after, all categories + Quick Access pins (`component`, `if_else`, `general_agent`,
  `sticky_note`). Search across label/kind/description; category subviews with back nav; single-instance
  entries already present are disabled with a "can only be added once" pill; A11y via `useDialogA11y`
  (ESC/Tab-trap/focus-restore).
- **3-column config modal** (`WorkflowNodeConfigModal.tsx`, 266 lines) — left `NodeInputExplorer`
  (Schema/Table/JSON/Global Vars), center `NodeConfigurationPanel` or `NodeSettingsPanel`, right
  `NodeOutputPreview` (per-branch tabs). Left column is dropped for input-less nodes. Per-kind editor
  routing (`renderKindSpecificFields`, `NodeConfigurationPanel.tsx:455-754`): trigger forms, source
  wizard + SQL/API editors, `MLModelNodeConfigEditor`, `CreateAssetNodeConfigEditor`,
  `TransformNodeConfigEditor` (largest, 62 KB), `AgentNodeConfigEditor`, `ActionNodeConfigEditor`.
  Execute-button label switches by trigger kind (`Test Chat` / `Run Schedule Now` / `Send Test Webhook` /
  `Execute Node`). Configuration↔Settings segmented control. **No prev/next node navigation in the modal.**
- **Connection rules** — `isFanInAllowed` (`connectionPolicy.ts:49`) caps most nodes at one inbound edge,
  with the **trigger fan-in exception**: a non-`merge` node may exceed the cap iff *every* existing and new
  inbound edge originates from a trigger (mirrored in the engine at `validate.go:116-135`). `merge` keeps a
  strict per-slot cap (one edge per slot). Auto-connect (`autoConnect.ts`) wires a freshly added node to
  the source handle; for transform kinds it resolves the first dynamic input port.
- **Per-node "+" chain affordance** — when a node is selected, a circular "+" renders next to each outbound
  port (`WorkflowRfNode.tsx:224-241`), opening the add-node drawer with `pendingSource`. The source Handle
  itself is also clickable to chain.
- **Sticky notes** — `StickyNoteNode.tsx`, inline-editable `config.text`, no ports, stripped from compile.
  **No resize** (fixed 280×180, explicitly out of scope v1).
- **Undo / redo** — **implemented**; footer toolbar buttons call `undo`/`redo`
  (`WorkflowBuilderShell.tsx:2489,2497`). Local, separate from durable version history.
- **Zoom / pan / fit** — `zoomIn`/`zoomOut`/`fitView` from `useReactFlow` (`:626`); footer buttons; auto-fit
  on initial load (padding 0.3 / maxZoom 1). Pan/wheel are React-Flow defaults.
- **Validation / compile-error surfacing** — `compilation_status==='invalid'` renders a clickable red pill →
  popover with humanised message via `humanizeCompileError` (`compileErrorHumanizer.ts`), showing node
  label + raw `WF_COMPILE_*` code (`:2218-2284`). The Execute button is disabled and relabeled "Fix errors
  to run".
- **Version history** — `ClockCounterClockwise` icon → popover listing versions (`v{n}` + optional label,
  "current"/"error" chips, created_at). Click a non-current version → `restoreVersion`; "Load more"
  pagination (`:2285-2353`).
- **Publish / activation** — single GlassPillButton (`:2355`, handler `publishToggle` `:1367`): `unpublish`
  if `defStatus==='published'` else `publish`. **There is no separate `active` boolean** —
  publish/unpublish **is** the activation mechanism (grep `is_active|setIsActive|activate` → 0 hits).
- **Builder ↔ Executions tab** — header pill toggle (`BuilderMainTab`); Executions tab renders
  `<WorkflowExecutionsView>`.

### 4.1 Power-user canvas features — implemented vs NOT (frontend report, ground truth)

| Feature | Status | Evidence |
|---|---|---|
| Add node via drawer (search / categories / quick-access) | **Implemented** | `WorkflowAddNodeDrawer.tsx` |
| Trigger-first enforcement | **Implemented** | `catalogEntriesForDrawer(true)` |
| Single-instance trigger blocking | **Implemented** | `SINGLE_INSTANCE_TRIGGER_KINDS` |
| Auto-connect / handle-click / selected-node "+" chain | **Implemented** | `autoConnect.ts`, `WorkflowRfNode.tsx:209-241` |
| Connection cardinality + trigger fan-in | **Implemented** | `connectionPolicy.ts:49` |
| Dynamic ports (switch cases / classification categories / merge slots) | **Implemented** | `WorkflowRfNode.tsx:80-90` |
| 3-column config modal + Configuration↔Settings | **Implemented** | `WorkflowNodeConfigModal.tsx` |
| Node step-test (3 input modes) | **Implemented** | `startStepTestRun` `:1575` |
| Branch-aware output preview tabs | **Implemented** | `NodeOutputPreview` |
| Ancestor field reference picker | **Implemented** | `AncestorFieldPicker` |
| Undo / redo | **Implemented** | `:2489,2497` |
| Zoom in/out, fit view, auto-fit on load | **Implemented** | `useReactFlow` `:626` |
| Pan / wheel | **Implemented** (RF defaults) | no overrides |
| Background dots | **Implemented** | `<Background variant=Dots>` `:2394` |
| Compile-error pill + humanized popover | **Implemented** | `:2218-2284` |
| Version history popover + restore + pagination | **Implemented** | `:2285-2353` |
| Publish / unpublish (activation) | **Implemented** | `publishToggle` `:1367` |
| Sticky notes (inline edit, stripped from compile) | **Implemented** | `StickyNoteNode.tsx` |
| **Sticky note resize** | **NOT implemented** | out of scope v1 (`StickyNoteNode.tsx:16-19`) |
| **Marquee / box selection** | **NOT implemented** | `grep marquee/selectionOnDrag/SelectionMode` → 0 |
| **Multi-select** | **NOT implemented** | `grep multiSelect/selectionKeyCode/onSelectionChange` → 0 |
| **Copy / paste / duplicate nodes** | **NOT implemented** | no node clipboard ("copy" hits are copy-run-to-builder; "duplicate" hits are array-dedup) |
| **Right-click context menu (canvas/nodes)** | **NOT implemented** | `grep onContextMenu/PaneContextMenu/NodeContextMenu` → 0 |
| **Minimap / Controls panel** | **NOT implemented** | not passed to `<ReactFlow>` (`:2371-2395`) |
| **Config-modal prev/next node navigation** | **NOT implemented** | no prev/next props in `WorkflowNodeConfigModal.tsx` |

---

## 5. Execution & runs

### 5.1 Triggers (how a run starts)

| Trigger type | Path | Notes |
|---|---|---|
| Manual | Content `POST .../flow-definitions/{def}/runs` (`CreateRun`) → engine create run (trigger_type `manual`). | Gated by the `workflow_runs` licence. Builder "Send Test Webhook" / "Run Schedule Now" route here with inline `fixture_input`, which the engine persists as the run's `root_input_document_id`. The engine refuses a second active run (`WF_RUN_ALREADY_ACTIVE`). |
| Schedule | Engine **scheduler** fires due `workflow_schedule` rows (`scheduler.go`). | Materialized on publish; `next_fire_at` from `ComputeNextFireAt`. Only fires the **published** version (`PublishedOnly`). |
| Webhook | `GET/POST/... /api/workflow-webhooks/{path_key}`, served by content (`FlowWebhookHandler.Receive`, `handlers/flow_webhooks.go`) → engine `CreateRun(trigger_type=webhook, root_input_document_id=captured body)`. | Per-binding auth (none/oauth2/basic/api_key/bearer); secrets Fernet-decrypted, constant-time compare, fail-closed (`flowwebhook.Authenticate`). See [../webhooks.md](../webhooks.md). |
| Chat | Content `POST .../flow-chat-sessions/{session}/messages` (`FlowChatHandler.PostMessage`, `handlers/flow_chat.go`). | No active run → engine `CreateRun(trigger_type=chat, chat_session_id, root_input_document_id=user text)`. Waiting run → engine `ChatResume` (free_text/approval). Non-waiting active run → 409. See [../chat-ingress.md](../chat-ingress.md). |
| Step-test | Content `POST .../flow-definitions/{def}/step-tests` (`CreateStepTest`) → engine step test. | Builder-only (`builder_step_test`); single target node. |

The webhook payload is injected into the run as a **synthetic trigger-root artifact** (a JSON doc on the
trigger's `default` channel) so steps wired off the trigger can read it (`loadRootInputArtifact`
`claim.go:212`).

### 5.2 Scheduling internals (engine `scheduler.go`)

A polling loop (default tick 5 s, batch 50, `:46`) claims due rows with `FOR UPDATE SKIP LOCKED`,
soft-advancing `next_fire_at` by 60 s to act as a lease so concurrent engines skip the row (`claimDue`
`:119-161`), then `fire()` (`:167-276`) creates a production run and advances `next_fire_at` to the
spec-driven next time. Safety behaviours: **license re-check** (`workflows`) with soft-skip if locked
(`:172-185`); disable the binding if the published version drifted (`:191-202`); on `WF_RUN_ALREADY_ACTIVE`
**frame forward without retry-stacking** on top of a live run (`:239-252`); transient errors restore the
prior `next_fire_at` (avoiding 60 s drift) and bump `consecutive_failures`, auto-disabling after **10**
consecutive failures (`schedulerMaxFailures`, `recordTransientError` `:283-311`).

Schedule maths (`schedule.go`): `ScheduleSpecHash` (`:16`) drives `workflow_schedule.schedule_spec_hash`;
`ComputeNextFireAt(spec, after)` (`:59-125`) is tz-aware (minutes = wall-clock add; hours/days/weeks/months
roll forward strictly after `after` via `time.LoadLocation`; weeks use `weekdayInt`; months clamp day to
28). Materialization (`service/materialize.go`) is idempotent on republish: it preserves `next_fire_at`
when the spec hash is unchanged, reuses `path_key`/`secret_ref` for webhooks, and disables (not deletes)
bindings for removed trigger nodes to preserve run history.

### 5.3 Step-test (engine `steptest.go`) — 3 input modes

`CreateStepTestRun` (`steptest.go:63`):
- **`reuse_prior_outputs`** (default; requires `source_run_id`) — copies succeeded ancestor step-runs +
  outputs from the source run (reusing content-addressed artifact ids), then queues only the target.
  Missing ancestors → `WF_STEP_TEST_SOURCE_RUN_INCOMPLETE` (`stageReusePriorOutputs` `:339`).
- **`recompute_ancestors`** — enqueues `InitialStepAncestors`; the worker fans out, scoped to
  `debug_target_node_id` (`stageRecomputeAncestors` `:422`).
- **`fixture_input`** (T178) — persists a user-supplied JSON **object** (non-empty, ≤1 MiB →
  `WF_STEP_TEST_FIXTURE_REQUIRED/INVALID_JSON/TOO_LARGE`) as the run's `root_input_document_id`
  (`stageFixtureDocument` `:488`), staged like `recompute_ancestors`.

**Side-effect actions** require `confirm_live_execution`, else `WF_STEP_TEST_ACTION_CONFIRM_REQUIRED`
(`steptest.go:159`). All staging runs through the same `WF_RUN_ALREADY_ACTIVE` definition lock; the run is
inserted as `builder_step_test` / `manual` / `debug_short` (retain +7d) with `debug_target_node_id`.
Frontend orchestration is `startStepTestRun(targetNodeId, inputMode, options)` (`WorkflowBuilderShell.tsx:1575`).

### 5.4 Run lifecycle

`CreateManualRun` (`createrun.go:48-331`) validates version id / run_mode / trigger type / retention class
(chat requires `ChatSessionID` → `WF_RUN_CHAT_SESSION_REQUIRED`), runs `validateRunEligibility`
(production requires `published` + requested version == published version → `WF_RUN_WORKFLOW_NOT_PUBLISHED`
/ `WF_RUN_PUBLISHED_VERSION_REQUIRED` / `WF_RUN_VERSION_NOT_PUBLISHED`; also `WF_RUN_NOT_COMPILED` /
`WF_RUN_COMPILATION_INVALID`), computes `initialStepsAfterTrigger` (steps whose inputs all come from a
trigger AND reference the firing trigger; `WF_RUN_NO_INITIAL_STEPS` if none), locks the definition
`FOR UPDATE`, rejects a second active run, inserts the `workflow_run` (with inline `retain_until`) + initial
`workflow_step_run` rows (`queued`) + `run_queued`/`step_queued` events + a "Run started" chat bubble for
chat runs.

The **worker** then leases steps (`ClaimNextStep` `claim.go:19`, `FOR UPDATE SKIP LOCKED`), checks the
`workflows` license (`executor.go:124`), stamps `timeout_at`, flips the step to `running`, runs the adapter
runtime, persists outputs/artifacts/events in one tx, enqueues downstream ready steps (**branch-channel
aware** — branching nodes only unblock the matching path, `enqueue.go:97`), and finalizes the run via the
terminal classifier (`ClassifyRunTerminal`, `finalize.go:19`: pending>0 → not terminal; else priority
failed > timed_out > cancelled > succeeded). The same enqueue/finalize logic is duplicated in the engine
(`runtxhelpers.go`, `runfinalize.go`) and kept in lockstep by tests.

### 5.5 Cancel

Content's `POST .../flow-runs/{run}/cancel` (`FlowsHandler.CancelRun`) → engine `RunCanceller.Cancel`
(`cancelrun.go:66-211`). Two-phase: the **request phase** (in a `FOR UPDATE` tx) flips the run to
`cancelling`, promotes queued/waiting steps → `cancelled`, terminalises pending/waiting outbound journal
rows → failed (`WF_ACTION_CANCELLED`), emits `run_cancel_requested` + bubble; a **fast path** finalizes
straight to `cancelled` if no leased/running steps remain. Otherwise the worker's heartbeat observes the
status (`lifecycle.ShouldAbortStep`, `main.go:207`) and aborts the in-flight step, and the **sweeper**
`sweepCancellingRuns` (`sweeper.go:560`) settles the rest. Terminal runs reject
`WF_RUN_CANCEL_ALREADY_TERMINAL`; cancel is deliberately **ungated** by license so an expired tenant can
still stop work (engine report §7). In-flight side effects are **not** synchronously aborted (best-effort,
no rollback).

### 5.6 Executions view

`WorkflowExecutionsView.tsx` lists runs with columns **Date & time / Status / Duration / Actions** (status
badge via `WorkflowExecutionStatusBadge`, duration via `formatRunDuration`). It is purely presentational —
it accepts pre-fetched `rows` and does not fetch. Row actions wired in the shell: `onRetry`,
`onDebugToBuilder`, `onCopyToBuilder`, `onCancel`, `onOpenDetail`. Backing endpoints:
content's `GET /workspaces/{ws}/flow-runs` (`FlowsHandler.ListRuns`) and per-run detail.

### 5.7 Run detail drawer

`WorkflowRunDetailDrawer.tsx` (Phase 18 / US16) shows a run-level summary (trace_id, correlation_id, status
chip, duration, workflow version, plus a cancel banner when applicable), a per-step timeline
(`WorkflowStepTimelineEntry` — status / duration / artifact count / error from
content's `GET .../flow-runs/{run}`, `FlowsHandler.GetRun`, which carries the first 50 events), and lazy
preview drill-down via `GET .../flow-runs/{run}/previews/{doc}` (`GetRunPreview`, row_count/columns/snippet). It **never fetches full artifact bodies**.
Opened from both the builder Executions tab and the global runs view.

### 5.8 Chat-trigger testing

`WorkflowChatWindow.tsx` is rendered only when the workflow has a `chat_input_trigger` (`hasChatTrigger`),
lifted to the shared parent so it shows on both Builder and Executions tabs (a "Show/Hide Chat" pill
bottom-left). It bootstraps a session (content's `POST .../chat/start`, idempotent, `FlowChatHandler.Start`), posts
user messages, and polls run progress (`ACTIVE_RUN_STATUSES = queued|running|waiting`, faster while
active). Messages either **create a new chat run** or **resume a waiting one** (`ChatResumer.Resume`
`chatresume.go:89`, which completes a `send_and_wait` step parked in `waiting` by writing the
`chat_response.json` artifact, flipping the journal + step to succeeded, enqueuing downstream steps, and
finalizing). This is the deliberate chat-trigger TEST surface (D26.6 — reuses `WorkflowChatWindow`, not a
unified primitive with `LlumenChat`).

---

## 6. API surface + RBAC

Base prefixes: every Flow route is the content service's. Definitions, runs, chat, the trigger list and
webhook secrets, and assistant proposals sit under `/api/content/v1/workspaces/{ws}/...` (§6.1–6.4; see
[../../services/content.md](../../services/content.md#flows-definitions-and-runs)); the public webhook
ingress keeps `/api/workflow-webhooks` (§6.5); internal worker routes sit under
`/api/content/internal/v1` (§6.6). The admin report is telemetry's `/api/telemetry/audit/flow-runs`
(§6.7). Licence gates: content puts every Flow route behind `workflows` except unpublish and cancel, and
runs also need `workflow_runs`. The internal worker routes are **secret-gated, not license-gated**.

### 6.1 Definitions / versions / authored (content, `handlers/flows.go`, `flows_definitions.go`)
| Method | Path | Handler | RBAC |
|---|---|---|---|
| GET | `/workspaces/{ws}/flow-definitions` | `ListDefinitions` | read |
| POST | `.../flow-definitions` | `Create` (draft + empty version 1) | write |
| GET | `.../{def}` | `GetDefinition` | read |
| PATCH | `.../{def}` | `Patch` (name, `ai_findings_enabled`) | write |
| DELETE | `.../{def}` (204) | `Delete` (usage scan → engine purge) | write |
| GET | `.../{def}/usage` | `Usage` | write |
| GET | `.../{def}/authored` | `GetAuthored` | read |
| PUT | `.../{def}/authored` | `PutAuthored` (engine version route: new version + compile) | write |
| GET | `.../{def}/versions` | `ListVersions` | read |
| GET | `.../{def}/versions/{ver}/authored` | `GetVersionAuthored` | read |
| POST | `.../{def}/versions/{ver}/restore` | `RestoreVersion` | write |

### 6.2 Publish / triggers / secrets
| Method | Path | Handler | RBAC |
|---|---|---|---|
| POST | `.../flow-definitions/{def}/publish` | content `Publish` → engine materialize-triggers | write |
| POST | `.../flow-definitions/{def}/unpublish` | content `Unpublish` → engine unmaterialize-triggers | write |
| GET | `.../flow-definitions/{def}/triggers` | content `ListTriggers` (`handlers/flow_triggers.go`; public_url, secret_provisioned) | read |
| PUT | `.../flow-definitions/{def}/webhook-bindings/{node}/secret` | content `SetWebhookSecret` (Fernet at rest) | write |
| DELETE | `.../flow-definitions/{def}/webhook-bindings/{node}/secret` | content `ClearWebhookSecret` | write |

### 6.3 Runs / step-tests (content, `handlers/flows_runs.go`)
| Method | Path | Handler | RBAC |
|---|---|---|---|
| POST (201) | `.../flow-definitions/{def}/runs` | `CreateRun` → engine create run | write + `workflow_runs` licence |
| POST (201) | `.../flow-definitions/{def}/step-tests` | `CreateStepTest` → engine step test | write |
| GET | `/workspaces/{ws}/flow-runs` | `ListRuns` | read |
| GET | `.../flow-runs/{run}` | `GetRun` (run + steps + outputs + artifacts + first 50 events) | read |
| GET | `.../flow-runs/{run}/previews/{doc}` | `GetRunPreview` | read |
| GET | `.../flow-runs/{run}/documents/{artifact_id}` | `GetRunDocument` (one JSON `document` artifact, whole) | read |
| POST | `.../flow-runs/{run}/cancel` | `CancelRun` → engine cancel | write |

### 6.4 Chat ingress (content, `handlers/flow_chat.go`)
| Method | Path | Handler | RBAC |
|---|---|---|---|
| POST (200) | `.../flow-definitions/{def}/chat/start` | `Start` (idempotent) | read |
| POST (201) | `.../flow-chat-sessions/{session}/messages` | `PostMessage` (create OR resume run) | write + `created_by==user` |
| GET | `.../flow-chat-sessions/{session}` | `GetSession` | read + `created_by==user` |

There is no close route. See [../chat-ingress.md](../chat-ingress.md).

### 6.5 Public webhook ingress (content, `handlers/flow_webhooks.go`)
| Method | Path | Auth |
|---|---|---|
| OPTIONS | `/api/workflow-webhooks/{path_key}` | none (`Options`) |
| HEAD | `/api/workflow-webhooks/{path_key}` | none (`Head`) |
| GET/POST/PUT/PATCH/DELETE | `/api/workflow-webhooks/{path_key}` | `Receive`: per-binding `auth_mode` (none/oauth2/basic/api_key/bearer); secrets Fernet-decrypted, constant-time compare, fail-closed |

### 6.6 Internal worker → content (`X-Internal-API-Secret`, `/api/content/internal/v1`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/flow-assets` | insert or update the `asset` row (`is_workflow_generated`); chart normalize kpi→kpi_card, catalog types pass, anything else → table (`CreateWorkflowAssetInternal`, `services/assets/workflow_create.go`) |
| POST | `/ml-models/batch-predict` | the `ml_model` node's batch prediction (`MLModels.InternalBatchPredict`) |

The worker's client is `worker/internal/backendclient` (name kept). The terminal rows of a `create_asset`
node are written by the worker itself, straight into the Store.

### 6.7 Admin / audit (telemetry `requireAuditAdmin` + `workflow_runs` licence, cross-workspace, `telemetry/internal/api/flowruns.go`)
| Method | Path |
|---|---|
| GET | `/api/telemetry/audit/flow-runs` |
| GET | `/api/telemetry/audit/flow-runs/filter-options` |
| GET | `/api/telemetry/audit/flow-runs/{runId}` |

### 6.8 RBAC model
Content's `flows.ResolveScope` (`content/internal/api/services/flows/scope.go`) gates every Flow route:
if the URL segment is the caller's **private** workspace → implicit grant, no role check; else a team
workspace requires write (the RLS function `workflow_definition_writable`: `system_admin` / `data_admin` /
`workspace_admin` / `contributor` / `editor`) or read (admin or `is_workspace_member`). Every query then
runs on the caller's JWT client, so RLS decides which rows exist; the scope column (`workspace_id` vs
`private_workspace_id`, `Scope.Column`) enforces cross-workspace isolation (mismatch → 404). Editor roles get full
read/write/execute/publish/schedule/delete; viewer read-only; guest none. **The engine trusts internal
calls** (auth via `X-Engine-Key`; engine adds defense-in-depth license checks but no RBAC). Tests:
`content/internal/api/handlers/flows_test.go`. See
[../../authorization/workflow-rbac.md](../../authorization/workflow-rbac.md).

Content's engine client (`content/internal/engine/client.go`) adds `X-Engine-Key` and calls the version
route (create, save, restore — the engine numbers versions under a row lock and compiles), materialize /
unmaterialize triggers, create run (the engine resolves the default trigger and stores an inline
`fixture_input`), step test, cancel and purge, plus `ChatResume` for Flow chat and `Compile` for
assistant proposals. It is disabled (→503) when content's engine URL or key is empty.

---

## 7. Engine and worker internals

### 7.1 Engine — compile

`Compile(doc, versionID)` (`compile.go:188`): validate → build trigger plans (schedule/webhook specs
compiled + validated) → map every executable node via `compileNode` (`compile.go:277-565`) to an adapter
key, output channels, and a flat `Bindings` map → wire edge inputs → append ancestor-ref inputs → build the
`AncestorIndex`. Node-kind → adapter-key mapping:

| Authored kind(s) | Adapter key | Output channels | compile.go |
|---|---|---|---|
| `source` | `llumen.runner.query` | `default` | `:286` |
| `ml_model` | `llumen.ml_model` | `default` | `:303` |
| `ml_predict` | `llumen.ml.predict` | `default` | `:534` |
| `create_asset` | `llumen.create_asset` | `default` | `:343` |
| `component` | `llumen.component` | `default` | `:495` |
| `no_operation` | `llumen.noop` | `default` | `:371` |
| `filter` | `llumen.transform` | `kept`, `discarded` | `:380` |
| `if_else` | `llumen.transform` | `true`, `false` | `:390` |
| `switch_cases` | `llumen.transform` | per-case (+ `else`) | `:400` |
| `edit_fields`, `aggregate` | `llumen.transform` | `default` | `:411` |
| `merge` | `llumen.transform` | `default` | `:421` |
| `wait` | `llumen.wait` | `default` | `:431` |
| `stop_error` | `llumen.stop_error` | (none) | `:441` |
| `general_agent`, `insight_generator_agent` | `llumen.agent` | `default` | `:451` |
| `data_classification_agent` | `llumen.agent` | per-category + `_unclassified` | `:461` |
| `slides_agent`, `dashboard_agent`, `briefing_agent` | `llumen.output_agent` | `default` | `:485` |
| `send_chat_message`, `send_email`, `send_api_request` | `llumen.action` | `default` | `:521` |
| any other | — | — | `:562` → `WF_COMPILE_UNSUPPORTED_NODE_KIND` |

`agentKind` mapping (`compile.go:708`): general→general, data_classification→classification,
insight_generator→insight, slides→slides, dashboard→dashboard, briefing→briefing. **Policy** (`buildPolicy`
`compile.go:783`): baseline `{alwaysOutputData:false, executeOnce:false, retryMode:"default",
onError:"stop_workflow"}` plus an optional `timeoutSeconds` from node settings, applied only when within
`(0, 24h]` (the 24 h cap guards against millisecond/second confusion).

**Ancestor refs** (`ancestor_refs.go`): authored `config.ancestor_refs[]` = `{ref_id, from_node_id,
from_channel, field_path, alias}` lets a node pull a field from any *transitive* upstream node (not just
direct predecessors) — e.g. an output agent assembling full context. `ValidateAncestorRefsInAuthored`
(`:83`) does a reverse-BFS upstream closure and rejects `WF_COMPILE_INVALID_ANCESTOR_REF` / `..._ALIAS`
(must match `[A-Za-z_][A-Za-z0-9_]{0,63}`) / `..._DUPLICATE_*`; `appendAncestorRefInputs` (`:155`) appends
synthetic `CompiledInput{ToInput="$ref:"+alias, FieldPath, IsAncestorRef=true}`.

### 7.2 Engine — validate

`ValidateAuthored` (`validate.go:10-155`) rejects: blank/duplicate node ids
(`WF_COMPILE_NODE_MISSING_ID` / `..._DUPLICATE_NODE_ID`); **no trigger** (`WF_COMPILE_TRIGGER_REQUIRED`);
>1 manual or chat trigger (singletons, `:34`); self-loops (`:75`); duplicate edges (`:79`); edge into a
trigger (`WF_COMPILE_TRIGGER_HAS_INPUT` `:89`); sticky-note edges (`:92`); unknown output channels / input
ports per kind (`validateEdgePorts` `:211`); **max-inputs exceeded** (default 1, except `merge` = slot
count and `sticky_note` = 0) **with the trigger fan-in exception** (`:116-135`); duplicate merge slots
(`:108`); **cycles** (`WF_COMPILE_CYCLE`, DFS `hasCycle` `:667`); missing from-channel/to-input (`:142`);
plus rich per-kind config rules — transform switch/merge ids (`validateTransformState` `:172`); agent
instructions/categories/fields (`validateAgentState` `:386`); action chat/email/api specs incl.
method/body/header rules and the `send_and_wait`-requires-chat-trigger rule (`validateActionState` `:505`,
`validateActionChatContext` `:649`).

### 7.3 Engine — schedule, sweep, HTTP surface

- **Scheduler** (`scheduler.go`, §5.2) fires due schedules into production runs.
- **Sweeper** (`sweeper.go`) runs four idempotent passes per tick (default 15 s, `:106`):
  1. **Expired-lease reclaim** (`sweepExpiredLeases` `:276`) — `leased`/`running` past `lease_expires_at`
     are requeued (attempt `< MaxAttempts`, default 3, emitting `step_lease_expired_requeued`) or
     terminalised `failed` (`WF_LEASE_EXPIRED`) with run cascade.
  2. **Step timeouts** (`sweepStepTimeouts` `:413`) — rows past `timeout_at` → `timed_out`
     (`WF_STEP_TIMEOUT`); abandoned `waiting`+`chat_response` prompts → `WF_CHAT_PROMPT_TIMEOUT` (distinct
     from a worker hang), settling the chat journal.
  3. **Cancelling-run finalisation** (`sweepCancellingRuns` `:560`) — promote leftover queued/waiting steps
     → `cancelled`, settle outbound journal, finalize run → `cancelled` (leased/running not force-cancelled;
     the worker exits them).
  4. **Retention purge** (`sweepExpiredRuns` `:713`, T143) — delete terminal runs past `retain_until` (not
     pinned, not replayed/retried by active children), reaping object-storage blobs first (`purgeRun`
     `:807`).
  Each terminal transition emits one `run_completed` event + a chat bubble for chat runs, guarded by
  `RowsAffected()==1` so multiple engine replicas don't double-count metrics. `/live/sweeper` reports
  liveness via `LastTickAt` vs 3× tick interval.
- **HTTP surface** (`httpapi/server.go`, chi): unauthenticated `GET /health` / `/ready` / `/live/sweeper` /
  `/metrics`; `/internal/v1` behind `X-Engine-Key`. License-gated group (`workflows`): `compile`,
  `materialize-triggers`, `POST /workflow-runs`, `chat-resume`, `POST /workflow-step-tests`. **Ungated:**
  `unmaterialize-triggers` and `cancel` (so an expired tenant can stop/terminate work). `writeErr` (`:504`)
  maps `WF_*` prefixes to HTTP 400/402/403/404/409/500.

### 7.4 Worker — per-kind runtime (dispatch by adapter key)

A poll-loop leases a ready step (`ClaimNextStep`, `claim.go:19`, `FOR UPDATE SKIP LOCKED`), loads the
compiled plan, checks the `workflows` license (`executor.go:124`), stamps `timeout_at`
(`computeStepTimeoutAt` `executor.go:1000`), flips the step to `running`, and **dispatches on
`step.AdapterKey`** (`executor.go:224`):

| AdapterKey | Runtime fn | File | One-line behaviour |
|---|---|---|---|
| `llumen.runner.query` | `runSource` | `executor.go:279` | Runner query → parquet table or JSON document. |
| `llumen.ml_model` | `runMLModel` | `ml_model_runtime.go:27` | Content batch-predict → parquet (50k cap). |
| `llumen.ml.predict` | `runMLPrediction` | `executor.go:908` | ML-inference predict → JSON document. |
| `llumen.create_asset` | `runCreateAsset` | `create_asset_runtime.go:16` | Ingest source + insert asset + populate cache. |
| `llumen.transform` | `runTransform` | `executor.go:508` | DuckDB SQL or gojq → per-channel table/document. |
| `llumen.wait` | `runWait` | `executor.go:672` | Park `waiting`, resume after duration. |
| `llumen.stop_error` | `runStopError` | `executor.go:764` | Deliberate fail `WF_STOP_ERROR`. |
| `llumen.agent` | `runAgent(false)` | `agent_runtime.go:127` | classification / insight / general (text). |
| `llumen.output_agent` | `runAgent(true)` | `agent_runtime.go:127` | slides / briefing (deep Infusion path) / dashboard (text). |
| `llumen.action` | `runAction` | `action_runtime.go:245` | send_chat_message / send_email / send_api_request (journalled). |
| `llumen.component` | `runComponent` | `component_runtime.go:76` | Re-render saved asset with cache TTL. |
| `llumen.noop` | `runNoop` | `executor.go:254` | Empty control output. |
| *default* | — | `executor.go:250` | `failStep(WF_ADAPTER_UNSUPPORTED)`. |

On success, in one `pgx.Tx` (worker report §2): upload payload to
`workflow-runs/{runID}/steps/{stepRunID}/output/{channel}/part-00000.{ext}`; write an optional preview blob
(`workflow_document(document_kind='preview')`, non-fatal); insert `workflow_artifact` (table/document,
parquet/json, sha256/size/row_count) + `workflow_step_output` (channel_key, payload_kind, artifact_id);
mark the step `succeeded` with row/byte counters (and `token_input`/`token_output` for agents); emit
`artifact_written` + `step_succeeded`; then enqueue downstream ready steps and maybe-finalize.

Upstream inputs are resolved by `LoadUpstreamArtifacts` (`claim.go:143`) keyed by `fromNode:fromChannel`,
with the synthetic trigger-root artifact injected for trigger-referencing inputs. Failures use a fresh
`context.Background()`, write `step_failed`, and cascade the run to `failed` (or `cancelled` when the
context was cancelled). **The worker stamps but does not enforce timeouts — the engine sweeper does.**
Tabular data is **Parquet** (read via DuckDB; written via `parquet-go` snappy for JQ/agent outputs and
DuckDB `COPY ... FORMAT PARQUET` for SQL transforms); **no Apache Arrow IPC** is used directly.

---

## 8. Licensing gates

**Nodes have no per-node tier.** The whole workflow feature is **feature-gated at the `command` tier**.
Authoritative tier→feature matrix: `contracts/license_tiers.json` (mirrored to content/engine/frontend
`generated/`; Go test `TestLicenseTiersContractCopiesAreIdentical` enforces byte-identical copies). Tiers
ranked `signal` (1) < `core` (2) < `command` (3) < `citadel` (4) < `custom` (5) (`tier_rank` `:25-30`).
Stacking: numeric caps add, booleans OR, ranked enums take the highest (`enum_rank`).

Workflow-relevant features and the tiers that grant them (the grant booleans live inside each tier's
`features.<tier>` block in the contract):

| Feature | signal | core | command | citadel | license_tiers.json |
|---|---|---|---|---|---|
| `workflows` | ✗ (`:64`) | ✗ (`:119`) | ✓ (`:174`) | ✓ (`:229`) | command/citadel `true` |
| `workflow_runs` | ✗ (`:65`) | ✗ (`:120`) | ✓ (`:175`) | ✓ (`:230`) | command/citadel `true` |
| `schedules` | ✗ (`:71`) | ✗ (`:126`) | ✓ (`:181`) | ✓ (`:236`) | command/citadel `true` |
| `ml_models` | ✗ (`:63`) | ✗ (`:118`) | ✓ (`:173`) | ✓ (`:228`) | command/citadel `true` |
| `data_flows` | ✗ (`:46`) | ✗ (`:101`) | ✓ (`:156`) | ✓ (`:211`) | command/citadel `true` |

> The `custom` tier carries its own `features` map inside the signed blob and bypasses this matrix entirely
> (contract `_change_here` note).

**Where the gates are enforced:**
- **Content (HTTP, primary):** content's Flow routes — including chat, triggers and webhook secrets, the public
  webhook ingress, and assistant proposals — require `workflows` (except unpublish and cancel), and the **manual-run** route
  and the agent's proposal prepare/collect routes also require `workflow_runs`. The internal
  worker→content routes are **secret-gated, not license-gated**.
- **Engine (defense-in-depth):** HTTP middleware `licenseFeatureGate("workflows")` (`httpapi/server.go:164`)
  returns 402 `feature_locked` for compile / materialize / create-run / chat-resume / step-test; **cancel
  and unmaterialize are deliberately ungated**. The scheduler `fire()` soft-skips when `workflows` is locked
  (`scheduler.go:172`). The license `Gate` caches `organization.effective_*` (60 s poll) and honours
  `LLUMEN_DEV_LICENSE_BYPASS` / `ENVIRONMENT=development`.
- **Worker (defense-in-depth):** `HandleStep` fails `WF_LICENSE_LOCKED` if `workflows` is missing
  (`executor.go:124`), re-checked in the agent runtime (token cost is real, `agent_runtime.go:144`);
  `ml_model` additionally requires a configured content client.

**Net effect: the entire workflow feature is unavailable below the `command` tier** unless a `custom`
license explicitly grants `workflows` / `workflow_runs`.

---

## 9. Intended-but-not-yet / doc-only / aspirational

> The intended spec is `docs/_archive/workflow/*` (US1–US17, FR-001..FR-148; archive-docs report). The
> code reports remain ground truth for "current". This section cross-references intended items that are
> **not yet implemented** or implemented **narrower** than spec.

### 9.A Partially-implemented (shipped, narrower than the node's stated intent)

1. **`ml_predict` has no palette entry** — fully compiled (`compile.go:534`) and executed
   (`llumen.ml.predict`, `executor.go:908`) but absent from `NODE_CATALOG`; addable only via direct
   authored-doc / integration writes. `ml_model` is the palette-visible ML node.
2. **`dashboard_agent` does not create a durable dashboard** (FR-059) — it emits only a text JSON document
   via the unstructured path (worker §3.10). Only `slides_agent` (Supabase RPC + REST inserts) and
   `briefing_agent` (agent self-persist) create durable entities synchronously (FR-058/FR-060).
3. **`send_api_request` source mode has no builder request picker** — **T177 PARKED**: compile-time shape
   validation of the source-backed `apiRequest` blob is blocked on runner-side source-API credential
   resolution + an `APIRequestSelection` picker. Today `apiRequest:{}` passes compile and fails at runtime
   (`WF_ACTION_API_SOURCE_*`, `action_runtime.go:853`).
4. **General-Agent structured/tools envelope deferred** (T165/D28.6) — General Agent output is plain text;
   citations/confidence structured envelope is deferred. The prototype `generalAgentTools` UI (Web Search /
   KB / SQL / API / Doc / Email) is not surfaced.

### 9.B Doc-only / explicitly out of scope / abandoned (NOT shipping)

5. **`error_trigger` node** — prototype-only, reserved single-instance; **not shipping in v1** (archive §4).
6. **Screenshot Node** — **abandoned** (prototype component-library only; never in catalog/compiler/runner;
   T157).
7. **Triggers panel UI (T182, US13) — NOT built.** No workflow-detail "Triggers" panel to list
   schedules/webhooks, pause/resume, copy webhook URL, rotate secret, or show a materialize-error banner.
   Trigger metadata is only available via content's `GET .../triggers` (`ListTriggers`).
8. **Unifying LlumenChat + WorkflowChatWindow — rejected for v1** (D26.6 / T213; shared composer deferred,
   full unification rejected). Per-message workflow-chat attachments **out of scope** (T192; text-only,
   64 KiB cap).
9. **Cross-host re-rooting of webhook URLs / schedule targets on restore — not a goal**; schedules restored
   PAUSED; webhook URLs must be re-shared. Per-run artifact blobs are intentionally **excluded** from backup
   bundles (derived data).
10. **`role='system'` chat bubble emission (T209)** — enum value exists but nothing writes to it yet.
    Orphaned `workflow_chat_session.conversation_document_id` column (T207) and the 200-message conversation
    cap (T208) are open decisions.

### 9.C Aspirational data-transport (FR-108 / FR-109 / FR-137 — deferred past Phase 20)

11. **Arrow IPC over the wire — NOT YET.** Worker↔runner/agent transfer is JSON today (~2–5% of step
    wall-clock; archive `workflow-arrow-ipc-status.md`). What ships is the **Parquet durable tier** (snappy,
    **single part file**, no manifest). `workflow_artifact.format` already accepts `arrow_ipc`/`arrow_schema`
    as additive carry-forward, but no code emits them.
12. **Partitioned Parquet behind a manifest (FR-109) — NOT YET.** Single part file today; no multi-part +
    manifest, no `arrow_schema` sidecar. **Not planned:** Arrow Flight service; in-process shared memory
    worker↔runner; Arrow IPC for the agent LLM request body.

### 9.D Ownership / boundary facts (clarify expectations, not bugs)

13. **No standalone compile REST endpoint** — compilation is implicit in content's `PUT .../authored`
    (the engine's version route compiles after it commits); there is no browser-facing compile route.
14. **No browser-facing chat-resume REST endpoint** — resume is folded into content's
    `POST .../flow-chat-sessions/{session}/messages` (`FlowChatHandler.PostMessage`), branching
    create-vs-resume on run state.
15. **Schedule firing is engine-owned** — content only materializes / unmaterializes schedule bindings on
    publish/unpublish and lists them; it never fires schedules.
16. **Sub-minute schedules are rejected by design** (`WF_COMPILE_SCHEDULE_UNSUPPORTED_UNIT`,
    `compile.go:1013`); months are capped at day 1–28 to avoid the February skip (the Feb-29 / day-29 case
    is a deferred future-test, T186); weekday/timezone are validated at compile, not at fire time.
17. **In-flight side effects are not synchronously aborted on cancel** (best-effort, no rollback; engine
    §6d, worker `failStep`). A `send_email` / `send_api_request` already in flight may complete after a
    cancel is requested.
18. **Compiled-plan cache is process-local** — after a draft recompile, other engine/worker replicas serve
    the prior plan until LRU eviction (spec-accepted tradeoff vs Redis; `service/compiledcache.go`).
19. **Per-workflow timeout / concurrency stay engine-configured** (T159/D28.3) — no builder UI control yet.
    English-only at MVP; i18n extraction deferred (T160/D28.4).

### 9.E Builder UI items in the spec NOT implemented (frontend report, ground truth)

20. **Marquee / box-select, multi-select, copy/paste/duplicate nodes, right-click context menu, minimap /
    Controls panel, sticky-note resize, and config-modal prev/next navigation are NOT implemented** (see
    §4.1). FR-069 (node overflow/context menu) and the broader power-user canvas surface are partially open.
    Undo/redo (FR-023), trigger-first authoring (FR-014), 3-column modal (FR-026), step-test 3-mode
    (FR-037), and publish-as-activation (FR-091) **are** implemented.

### 9.F FR cross-reference (implemented vs not — representative, not exhaustive)

| FR group | Status |
|---|---|
| FR-001..FR-011 Library (search/filter/sort/grid-list/create/open/execute, cross-workflow Executions) | **Implemented** (`WorkflowLibraryPage.tsx`) |
| FR-012..FR-025 Builder shell / trigger-first / footer / sticky / undo-redo / inline title | **Implemented** except node context menu (FR-069 partial) |
| FR-026..FR-038 3-column config modal / input explorer / output preview / step-test / inline validation | **Implemented** |
| FR-039..FR-054 Node kinds (triggers, data/flow, transforms, sticky) | **Implemented** in-palette |
| FR-055..FR-063 Agents + actions | **Implemented** except FR-059 dashboard_agent durable (partial) |
| FR-064..FR-069 Wizards / browser / chat surface / version menu / context menu | Implemented except **FR-069 context menu NOT built** |
| FR-070..FR-082 Durable runs / executions actions / replay-debug / cancel | **Implemented** |
| FR-083..FR-104 Versioning / publish / compile / channel keys / editor-only nodes | **Implemented** |
| FR-105..FR-116 Channels / payload kinds / previews / spill-to-storage | **Implemented** (Parquet tier) |
| FR-108/FR-109/FR-137 Arrow IPC / partitioned Parquet | **NOT implemented** (deferred — §9.C) |
| FR-117..FR-131 Shared settings / retry / on-error / lease / heartbeat / dedupe | **Implemented** (engine/worker) |
| FR-132..FR-146 Service split / metrics / events / trace ids / Redis boundary | **Implemented** (Redis used only as accelerator) |
| FR-147/FR-148 Backend + engine internal API surfaces | **Implemented** (§6, §7) |

---

## Sources

This document is synthesized from six research reports plus the two shared JSON contracts:
- `/tmp/wf_research/report-engine.md` — engine compile/validate/schedule/sweep + HTTP surface.
- `/tmp/wf_research/report-worker.md` — worker per-kind runtimes + lifecycle.
- `/tmp/wf_research/report-backend.md` — FastAPI REST surface + RBAC + engine proxy.
- `/tmp/wf_research/report-frontend.md` — **authoritative** for builder UI + palette (`nodeCatalog.ts`).
- `/tmp/wf_research/report-archive-docs.md` — intended spec (US1–US17, FR-001..FR-148); §9 cross-reference.
- Prototype design baseline — http://prototype.llumen.io/workflow/979669f6a773bc14ee5e3b19.html
- Contracts: `contracts/workflow_node_kinds.json`, `contracts/license_tiers.json`.
