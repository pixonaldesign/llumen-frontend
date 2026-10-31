---
topic: workflows
services: [content, engine, frontend, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflows overview

## Audience and goal

Product feature for **automation graphs**: persisted as `workflow_definition` /
`workflow_version` rows, compiled JSON in Supabase Storage, execution state in
Postgres tables updated by **worker** under leases claimed from **engine**.

**DataFlow is not a separate product.** A "DataFlow" (ETL Flow) is a
`workflow_definition` row with
`definition_kind='dataflow'` — a stripped-down workflow restricted to a
data-only node subset (`contracts/workflow_node_kinds.json` `_doc` under the
`data_flow` key) that must terminate every branch leaf in a `dataset_output`
node, executed only by the runner delegating to `POST
/internal/v1/dataflow-runs` on the engine (see
[internal-api.md](internal-api.md)). There is no standalone DataFlow router,
runner, scheduler or editor.

## Read first (ordered)

1. [../services/content.md](../services/content.md#flows-definitions-and-runs) — the Flow definition and run routes (`/api/content/v1/workspaces/{workspaceId}/flow-definitions` and `/flow-runs`), in `content/internal/api/flows_routes.go`, `content/internal/api/handlers/flows*.go` and `content/internal/api/services/flows/`.
2. `content/internal/engine/client.go` — content's engine caller; [internal-api.md](internal-api.md) lists the engine routes.
3. `engine/cmd/engine/main.go` and `worker/cmd/worker/main.go`
4. [../architecture/service-topology.md](../architecture/service-topology.md)

## How it works

**Authoring & library.** Content exposes list/create/get for definitions with the column projections in `content/internal/api/services/flows/columns.go`, so list endpoints never ship the JSON blobs. The frontend calls these routes through `frontend/src/services/workflowService.ts`. Content also serves Flow chat, the trigger list and webhook secret routes, the public webhook ingress and the assistant-proposal routes (see [../services/content.md](../services/content.md)).

**Adding a node on the canvas.** Two paths, both ending in `addNodeFromCatalog` (`frontend/src/components/pages/workflows/WorkflowBuilderShell.tsx`).

- **Clicking** an entry in the Nodes panel (`WorkflowAddNodeDrawer.tsx`) keeps smart placement and the "+" chain affordance's `pendingSource`. The click closes the panel.
- **Dragging** an entry onto the canvas places the node at the cursor instead, and derives its wiring from whatever the pointer was released over. The panel stays open, so several nodes can be dragged in a row.

Where the drop lands decides the wiring:

| Released over | Result |
|---|---|
| Empty canvas | A standalone node, **at the cursor**. |
| An existing node | The new node chains from it, preferring a free output handle. |
| An existing edge | The new node is spliced into that edge, reusing the replaced edge's source and target handles so the upstream branch and the downstream merge slot both survive. |

The cursor is a placement **only** on empty canvas. Released over a node or an edge it is a gesture — "chain from this", "insert into this" — and the flow coordinate under it is *inside* the target, so placing there would overlap them. `resolveOverlaps` anchors on the newly added node and moves everything else, which means the node you dropped **on** would be the one shoved aside, and displaced nodes are re-queued so the shove cascades to their neighbours. Those two outcomes therefore fall through to `computeSmartPlacement` — the same free slot the click path picks — and nothing already on the canvas moves.

The resolution is a pure function — `resolveNodeDrop` in `frontend/src/features/workflows/graph/nodeDrop.ts`. It refuses a drop in three cases:

- a splice that would leave the downstream step with more inbound edges than `connectionPolicy.isFanInAllowed` permits. The trigger fan-in exception does not survive re-pointing a trigger leg through a non-trigger node, so a graph that was legal can stop being legal;
- a kind with no output channel, which has nothing to wire onward;
- a single-instance kind that is already on the canvas.

Two rules are shared rather than duplicated: `refuseCatalogEntry` holds the single-instance and editor-only checks that both the click and drag paths need, and refusals reuse the click path's message dialog. Panel entries that clicking already blocks are not draggable at all.

**RBAC.** Every Flow route resolves its workspace through `flows.ResolveScope(..., write)` (`content/internal/api/services/flows/scope.go`): reads need workspace membership, writes need `workflow_definition_writable`, and RLS then filters rows as the caller. Engine trusts `X-Engine-Key` only — content is authoritative for user authorization.

**Node taxonomy.** `contracts/workflow_node_kinds.json` (mirrored into `engine/internal/engine/generated/` and `frontend/src/generated/`) classifies triggers, executable triggers, side-effect actions, non-executable nodes. Engine test `TestNodeKindRegistryMatchesContracts` and frontend `workflowService.ts` must stay in sync when adding kinds. Note this file lists only those **special categories** — plain executable kinds (including every `*_agent` kind) do not appear in it, so a new agent kind needs no entry here.

**Authoring capability inventory.** `contracts/workflow_authoring_capabilities.json`
is the machine-checked inventory of what the builder can currently author: one
row per node kind covering its configuration family and semantic variants, its
port and channel grammar, its runtime effect, its Engine adapter, its Worker
runtime owner, and whether the SDK and the Agent can author it today. It is
mirrored into `engine/internal/engine/generated/` and `frontend/src/generated/`;
`make test-workflow-authoring-capabilities` gates it and
runs inside `make test-all`.

**Agent SDK authoring and the derived request.** The Agent's model writes one
`llumen_wf` program against the generated pack and nothing else. Code builds
it, admits only the config variants in `ENABLED_CONFIG_VARIANTS`
(`agent/src/agents/shared/workflow_config_variants.py`), reads the typed request
back from the facts the SDK recorded in the document
(`_workflow_derived_request.derive_request`), resolves that request against the
permission-filtered grounding and checks it against the same document
(`_workflow_request_conformance.compare_request_to_document`), whose
whole-document safety refuses extra reads, terminals, effects and other
execution surface. The user's words are then checked against the request and
the document before a proposal is registered for review. Current-user source
authorization, Engine compilation, Worker execution and result conformance
remain deterministic authority. See
[agent-authored-workflows.md](agent-authored-workflows.md).

The analytical request can carry several ordered measures over an authorized
read when the output is a table. It also supports bounded derived
`+ - * /` calculations and exact difference, percentage-change or ratio
comparisons between baseline/current logical reads of that same physical
relation. Stable measure slots—not friendly labels or column names—bind
filters, ordering, SDK lineage, delivered columns and result narration.
A `kpi`, `bar` or `line` output shows one measure; arbitrary multi-relation or
multi-source reads beyond the bounded matched subset are not supported.
`make test-workflow-multiple-measures` proves relational and Fusion documents
through the SDK/document/Engine validate-compile boundary.

Two things it deliberately is not. It is **not an authorization source** — it
records that a `source` node binds a source and that doing so requires
current-user source access, never who has that access; runs are authorized by
workspace scope in content's Flow routes (`flows.ResolveScope`), including
the Flow chat and assistant-proposal routes. And it is **not a claim that a capability
works**: `availabilityStates` plus `limitationCode` keep a partially delivered
node visible. `data_analyst_agent` compiles and has its own Worker runtime with
no SDK authoring method; `dashboard_agent` routes to the narrative runtime rather
than persisting a dashboard; `create_asset` and four agent kinds expose a
downstream channel in the builder that the current SDK treats as terminal; and
`ml_predict` is compiled-only, absent from the palette, and can never be counted
as builder parity. See [`../contracts/overview.md`](../contracts/overview.md).

**Agent nodes.** Kinds that call the agent service split four ways in the worker's `dispatchAgentKind`: the output-agent runtime for `slides_agent` / `briefing_agent` ([output-agents.md](output-agents.md)); a dedicated runner for `data_analyst_agent`, which diagnoses upstream data and emits a verdict document, persisting nothing, and mints its own RLS-scoped owner session in the agent's process ([data-analyst-node.md](data-analyst-node.md)); a dedicated runner for `gis_correlation_agent`, sharing the data analyst's verdict path, which compares a wired Asset layer with a referenced land layer ([gis-correlation-node.md](gis-correlation-node.md)); and the legacy unstructured path for the rest ([agent-nodes.md](agent-nodes.md)). The builder authors `gis_correlation_agent`; the SDK and the authoring Agent cannot yet (`WF_CAP_GIS_CORRELATION_SDK_AND_AGENT_UNAVAILABLE`).

**AI Findings (opt-in, Agentic Flow only).** When a run transitions to `succeeded`, `MaybeFinalizeRun` (`worker/internal/worker/enqueue.go`) checks `ai_findings_enabled` + `definition_kind = 'workflow'` on the definition, then fire-and-forgets `POST /api/internal/ai-findings/generate` with `{workflow_run_id}`. Outcomes land on `workflow_ai_findings_dispatch_total{result}`. Read path: the agent's `GET /api/agent/findings` (feed, `ids` body prefetch), `GET /api/agent/findings/{id}` and `PUT /api/agent/findings/{id}/action` (see [../services/agent.md](../services/agent.md#ai-findings-read-surface)), all through `frontend/src/services/aiFindingsService.ts`, for the hub carousel and the run drawer alike. Agent generate is a separate branch (not in platform PR) — contract: [ai-findings-integration.md](ai-findings-integration.md). Hub UI: `frontend/src/components/pages/workspaces/AIFindings/`. Runs finalized by the engine's chat-resume path produce no finding — see the known gap in [../services/worker.md](../services/worker.md).

**Create asset node.** `create_asset` compiles to adapter `llumen.create_asset` and runs in the worker after a tabular upstream step (`source` or `ml_model`). For each run the worker (in `worker/internal/worker/create_asset_runtime.go`) does three things in order:

1. **Persist the terminal rows directly into the Store.** When the workflow definition has a `created_by` user (`db.RunContext.OwnerUserID`), the worker writes the rows **itself**, through the same `writeTerminalDataset` primitive the ETL Flow side uses (`worker/internal/worker/terminal_dataset.go`) — create/replace the table, grant it to the owning tenant's derived role, register a `store_dataset` row. The source row is still minted by `create_source_secure` (SECURITY DEFINER, resolves the owner's private workspace), typed **`agentic_flow`** — a sibling of a file upload, not a variant of one, which is why it does not appear in the Files tab. Data lands in the **`agentic_flows`** Store schema, named `ds_<source-id-hex>`. Metadata is tagged `is_workflow_generated=true` + `workflow_run_id`, GraphRAG is skipped (`graph_rag_policy="skipped"`) and `agent_status` is pinned to `removed`, because a skipped source can never leave `pending`. If `created_by` is null (older defs) the worker warns and skips persistence; the asset still lands.
2. **Insert the asset row** via content's `POST /api/content/internal/v1/flow-assets` (`X-Internal-API-Secret` auth; `CreateFlowAsset` in `content/internal/api/services/assets/workflow_create.go`) with `type=Data_chart`, the `Insights` tag, and the `source_id` from step 1 so the asset links to the persisted source. The worker forwards `rc.OwnerUserID` as `user_id`; content stamps it as `asset.created_by` / `updated_by` so the workflow runner is recognized as the owner — without this the frontend's auto-thumbnail upload (step 4) is rejected with 403 by `POST /api/content/v1/assets/{id}/thumbnail`. Chart mapping (`dataMapping.x/y/category/value`) is filled from node `xColumn`/`yColumn`, and chart aliases are normalized server-side (`kpi` → `kpi_card`). A map node's `mapCoordinateSystem` (the source's projected system, picked in the node editor) is sent as `map_coordinate_system`; content checks the code against `contracts/coordinate_systems.json` and saves `dataContract.crs` naming the layer's position column — see [../map/coordinate-systems.md](../map/coordinate-systems.md).
3. **Populate the asset cache.** The worker writes the parquet bytes into the `asset-cache` bucket and sets `asset.cache_ref` via SQL using the same `writeAssetCache` helper used by the component refresh path. Failure is fatal: the step fails loud rather than producing a asset whose component page can't render.
4. **Auto-thumbnail (frontend, lazy).** The worker has no headless renderer, so the asset is created without a `thumbnail`. The first time any client renders the asset through `DataAssetContainer`, the `useAutoThumbnailForWorkflowAsset` hook (`frontend/src/hooks/useAutoThumbnailForWorkflowAsset.ts`) detects `is_workflow_generated=true` + null thumbnail + non-empty rows + sufficient chart-area size, captures the chart DOM via `ScreenshotService`, and uploads through `POST /api/content/v1/assets/{id}/thumbnail` (content owns assets; the read half is the storage service's unauthenticated byte proxy). The upload is permission-gated to the asset's `created_by` (or admin role); non-owner viewers fail silently and the next owner-side render persists the thumbnail for everyone.

The step then emits `{ "asset_id": "<uuid>", "source_id": "<uuid>" }` on the default output channel so downstream slides agents can reference both the rendered asset and the underlying data.

**Builder and preview runs persist no asset.** All four steps above describe a **production** run. When
`workflow_run.run_mode` is `builder_debug`, `builder_step_test` or `builder_replay` — any
run started from the workflow builder — or `workflow_preview` (an agent's temporary run), the
worker skips ingestion, asset creation and the cache write entirely, and emits the upstream
table on the `default` channel instead (`isBuilderRunMode` in `create_asset_runtime.go`). This
applies to `create_asset` only: those runs still perform chat and API actions, send email
when a workflow SMTP transport is configured, and save slides and briefings (see
[action-nodes.md](action-nodes.md)).

The reason: builder runs carry `retention_class='debug_short'`, so the engine sweeper reaps the
run after 7 days — but nothing reaped the `source` row, Store table, `source-uploads` object,
`asset` row and `asset-cache` object each one minted. They accumulated indefinitely and
cluttered **Platform → Data → Files** with rows named after runs that no longer existed.

Two consequences worth knowing:

- The gate sits **after** the upstream fetch and parquet validation, so a debug run still fails
  on a bad upstream exactly where a production run would.
- In a builder run the `default` channel carries a **table**, not the `{asset_id, source_id}`
  document. A downstream `output_agent` therefore sees no dynamically-provisioned source id
  (it merges those from the ancestor graph — see [output-agents.md](output-agents.md)). This is
  deliberate: a throwaway run should not feed real source ids into a persisted slides draft.
  It does mean the agent path differs between builder and production runs.

The node config editor surfaces this — the "Produced asset" card reads *"No asset saved for a
test run"* rather than the generic empty state.

**`name` is required at compile time.** `create_asset` nodes must carry a non-blank `name`;
the engine rejects a blank one per-node with `WF_COMPILE_CREATE_ASSET_NAME_REQUIRED`. The
worker keeps its `"Workflow Asset"` fallback for plans compiled before the check existed —
that fallback is why the gap went unnoticed, since 58 of 79 generated sources on staging were
all called exactly that.

**Native chart types are broader than SDK output helpers.** The Engine accepts
the workflow editor's chart catalog, eight namespaced `map:<subtype>` values,
and the four persisted legacy chart enum values that the picker no longer offers.
The SDK's narrower authoring surface must not reject valid editor documents.
Unknown types and bare `map` are rejected; a table carrying chart axes remains
invalid. See `engine/internal/engine/validate.go` and
`frontend/src/features/workflows/assets/chartTypeCatalog.ts`.

See `docs/_records/plans/store-db/ws0-stop-the-bleeding.md`.

### A Flow emits a source

When an Agentic Flow's `create_asset` node persists its output, the platform creates a real,
queryable **source** for it — `source.type = 'agentic_flow'`, one table in the Store's
`agentic_flows` schema. The asset is then backed by that source like any other.

**It is a sibling of a file upload, not a variant.** Both are system-created and Store-hosted;
a Flow output simply is not a file. It was typed `files` until WS3, which is why 79 Flow tables
appeared in Sources → Files.

**Exactly one input becomes the dataset.** A `create_asset` node can be wired to many upstream
nodes, and only the `rowSource`-selected one is the terminal table — the rest are *context*
(`text` / `scalar` / `membership` ancestor refs, per `contracts/data_reference.json`).
`selectRowSourceUpstream` enforces the split so a reference added for token substitution can
never shadow the wired table. The choice is recorded in `store_dataset.owner_ref` (definition,
node, `row_source`, and the resolved `from_node_id` / `from_channel`), because only the worker
knows which input it resolved to, and without it two runs whose `rowSource` was re-authored
are indistinguishable.

**Lifetime.** Run-scoped: it belongs to the node that produced it, not to the flow. These
sources are deliberately **not** user-selectable — their assets are auto-created — which is
the opposite of an ETL Flow source (see [`../data-pipeline/overview.md`](../data-pipeline/overview.md)).
GraphRAG never indexes them (`graph_rag_policy='skipped'`, so `agent_status='removed'` at
creation rather than a `pending` they could never leave).

See [`../sources/overview.md`](../sources/overview.md) for the full provenance taxonomy and
[`../data/store-postgres.md`](../data/store-postgres.md) for the registry.

## Critical paths

1. **Save and publish** — Client → content checks RBAC → engine `POST /internal/v1/workflow-definitions/{id}/versions` writes the authored JSON and version row, then compiles → publish (content) requires a `valid` compile and asks the engine to materialise the triggers.
2. **Run** — Client → content `POST .../flow-definitions/{id}/runs` → engine `POST /internal/v1/workflow-runs` creates the run → engine schedules steps → worker `Executor.HandleStep` executes adapters.
3. **Agent proposal run** — agent SDK authoring → registered proposal revision and review card → the card's Run: content's internal prepare (temporary definition, compile) and content's ordinary run route in `workflow_preview` mode → worker transient outputs → the card sees the run finish and asks the agent to collect it → assistant answer/asset blocks; the card's Save keeps the same definition as a draft.
4. **Workflow asset cache miss** — frontend → runner saved-asset endpoint → engine safe recovery run → worker replays the target dependency closure and refreshes `asset-cache`.

## Integration map
- [README.md](../README.md) — wiki index.
- [index.md](index.md) — section index.
- [../authorization/workflow-rbac.md](../authorization/workflow-rbac.md) — the read/write/execute/publish/delete role table for the Flow routes, with the regression-tested `workspace_admin`/`contributor`/`editor` "no internal ladder" policy.
- [authoring-sdk.md](authoring-sdk.md) — typed SDK and generated authoring pack.
- [agent-authored-workflows.md](agent-authored-workflows.md) — implicit/explicit
  agent workflow execution and preview lifecycle.
- Sibling pages in `workflows/` for related subtopics.


## Validation checklist

- Run `make test-content` (including `TestFlowWriteGateAsksWorkflowDefinitionWritable`) when touching `flows.ResolveScope`.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
- Run `make test-sdk`, `make test-engine`, `make test-worker`, and
  `make test-runner` when changing SDK execution or preview execution.
- Run `make test-workflow-authoring-capabilities` when adding or changing a node
  kind, a configuration variant, a port/channel grammar, an Engine adapter or a
  Worker runtime branch. A new palette kind fails that target until it is
  classified.
- Run `make test-workflow-graph-foundation` when changing the request contract,
  request derivation, resolution or request conformance. It makes the real
  Engine validate and compile documents built from real SDK programs.
- Run `make test-workflow-sdk-authoring-cutover` when changing the
  model-authored SDK route. Its deterministic proof registry is distinct from
  live model runs and browser user-acceptance testing.
