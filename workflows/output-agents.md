---
topic: workflows
services: [agent, worker]
status: current
---
# Workflow output agents

## Audience and goal

Slides and briefing **output nodes** (`slides_agent`, `briefing_agent`) are
non-interactive agent runs that author real content via the Infusion
subagents (`slides_builder`, `briefing_creator`). They run through a
dedicated runtime that is distinct from the chat-oriented agent
pipeline.

A third kind, `data_analyst_agent`, **shares this runtime's plumbing but
is not an output agent** — it persists nothing and returns a verdict
document instead of content. Where this page says "output agents" it
means story and briefing only; the analyst's differences (owner-session
minting, `create_agent` + middleware, strict failure handling) are
documented in [data-analyst-node.md](data-analyst-node.md). Statements
below that are kind-specific are marked.

## Read first (ordered)

1. `agent/src/agents/workflow/workflow_output_agent.py` — the agent-side
   entry point `run_workflow_output_agent(kind, instructions, …)`.
2. `agent/src/api/routers/internal.py` — `POST
   /api/internal/workflow/output_agent` route the worker calls.
3. `worker/internal/agentclient/workflow_output.go` — worker-side HTTP
   client (`InvokeWorkflowOutputAgent`); request includes
   `user_id` (workflow owner) so the agent can attribute persisted
   artefacts.
4. `worker/internal/worker/agent_runtime.go` — dispatch lives in
   `dispatchAgentKind` (extracted from `runAgent` so it can be tested
   without a live pool): `slides_agent` and `briefing_agent` are routed to
   `runInfusionOutputWorkflowAgent`; `data_analyst_agent` goes to
   `runDataAnalystWorkflowAgent` instead (see
   [data-analyst-node.md](data-analyst-node.md)); `dashboard_agent`
   continues on the legacy unstructured path. The output-agent function
   also calls into:
   - `worker/internal/worker/slides_persist.go` — translates the
     `SlidesDraft` returned inline by the agent into Supabase rows
     (`create_slides_with_workspace` RPC + chapter / slide /
     slide_asset REST inserts).
   - `worker/internal/worker/briefing_persist.go` — translates the
     resolved briefing draft into Supabase rows (`create_briefing_with_workspace`
     RPC + `frame` / `frame_asset` REST inserts). Briefing persistence is
     **worker-owned**, symmetric with slides — the agent no longer writes
     to Supabase itself.
   - `worker/internal/worker/source_ancestors.go` — besides the static
     `sourceId` plan walk (`collectAncestorSourceIDs`) and the statically-
     bound `asset` node walk (`collectAncestorBoundAssetIDs`),
     `extractSourceIDsFromDocumentInputs` / `extractAssetIDsFromDocumentInputs`
     scan the step's directly-wired JSON document inputs (e.g. the one
     `create_asset` emits) for `source_id` / `asset_id` fields, and
     `(*Executor).collectAncestorDocumentIDs` repeats that scan
     transitively over every upstream document artifact (not just the
     direct inputs), so freshly-minted, run-local ids reach the agent even
     when the id-carrying node isn't wired straight into the output step
     (see *Asset handoff* below).
   - `worker/internal/worker/run_scope.go` — the authorization boundary and
     no-scope fallback applied to those harvested ids before they leave
     the worker: `(*Executor).filterAssetIDsVisibleToRun` and
     `(*Executor).fallbackWorkspaceSourceIDs` (see *Asset handoff* below).
   - `worker/internal/worker/supabase_client.go` — minimal REST + RPC
     client backed by `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (the
     same credentials the storage client already uses).
5. `agent/src/agents/infusion/logic/subagents/registry.py` — one
   `SubagentSpec` (`logic/subagents/spec.py`) per subagent in
   `_subagent_specs()`, exposed as `REGISTRY`. `REGISTRY.get("slides_builder")`
   and `REGISTRY.get("briefing_creator")` return each subagent's system
   `prompt`, `model_group`, `capabilities` and allow-listed `tool_names`;
   `resolve_tool(name)` turns a tool name into the tool object.
6. `agent/src/agents/infusion/logic/tool_helpers/asset_discovery.py` —
   `hydrate_assets_by_ids` hydrates workflow-minted asset ids directly
   from Supabase, bypassing GraphRAG (see *Asset handoff* below).

## Architecture (current)

The output-agent path is deliberately **simpler than chat**: there is no
deep-agent orchestrator and no WebSocket session. For story and briefing
the agent service never calls a persistence route either. (The
`data_analyst_agent` kind mints a short-lived owner session for itself, in
the agent's own process, and calls the analytics service with it; see
[data-analyst-node.md](data-analyst-node.md) and *No agent-side persistence*
below.)

```
                 ┌──────────────────────────────────┐
                 │  Worker  (runInfusionOutput…)    │
                 │                                  │
                 │  builds wired + ancestor ctx     │
                 │  loads OwnerUserID from          │
                 │   workflow_definition.created_by │
                 └───────────────┬──────────────────┘
                                 │ POST /api/internal/
                                 │  workflow/output_agent
                                 ▼
                 ┌──────────────────────────────────┐
                 │  Agent  (run_workflow_output_…)  │
                 │                                  │
                 │  bootstrap InfusionToolsContext  │
                 │   (admin Supabase, Graphiti)     │
                 │                                  │
                 │  build ReAct agent directly:     │
                 │    • slides    → slides_builder    │
                 │    • briefing → briefing_creator │
                 │                                  │
                 │  SLIDES    : return draft inline  │
                 │  BRIEFING : return resolved draft │
                 │             inline (worker persists)│
                 └───────────────┬──────────────────┘
                                 │ {text, draft?, created_entity_id?, warning?}
                                 ▼
                 ┌──────────────────────────────────┐
                 │  Worker (continued)              │
                 │                                  │
                 │  SLIDES   → persistSlidesDraft via │
                 │   SupabaseClient (RPC + REST)    │
                 │  BRIEFING → persistBriefingDraft   │
                 │   via SupabaseClient (RPC + REST)│
                 │                                  │
                 │  Strict: if nothing was persisted│
                 │   the step FAILS with            │
                 │   WF_OUTPUT_NOT_PERSISTED. A     │
                 │   persisted-but-degraded outcome │
                 │   (e.g. some asset links failed) │
                 │   still succeeds, with a warning.│
                 └──────────────────────────────────┘
```

Two design decisions worth keeping in mind:

- **No agent-side persistence.** The agent does not call a slides or
  briefing save route (such as content's `POST /api/content/v1/slides/from-draft`)
  itself: a poisoned LLM could then create content on the user's behalf.
  The worker is the only component allowed to write slides and briefing
  rows on behalf of a workflow. The `create_briefing_with_frames` helper still exists in
  `agent/src/agents/infusion/logic/tool_helpers/briefing_creation.py`
  but is dead code — it is not decorated as a tool and not named in any
  spec's `tool_names` in the subagent registry, so the briefing subagent
  cannot call it.

  *Qualified for `data_analyst_agent`:* that node mints a session for the
  workflow owner, in the agent's own process
  (`agent/src/services/workflow_owner_session.py`). The rule it protects
  is intact — the mint **writes nothing on the user's behalf**; it only
  obtains a read identity so RLS can constrain what the analyst sees, the
  owner is resolved from the run id so no caller can name a user, and
  the session is signed out when the step ends. The alternative (handing
  the agent an admin client) is what the rule actually exists to prevent.
- **Bypass the deep-agent orchestrator.** The orchestrator's
  `query_execution` mode is allowed to "answer from memory" without
  dispatching `task()`, which left `SlidesDraftStore` empty in
  production and surfaced as `created_entity_id: null` even on a
  successful-looking response. The workflow output path constructs
  the relevant subagent (`slides_builder` / `briefing_creator`) directly in
  `_build_subagent_react` (`agent/src/agents/workflow/workflow_output_agent.py`):
  it reads the subagent's spec from `REGISTRY.get(name)`, resolves its
  `tool_names` with `resolve_tool` (then narrows them by
  `_WORKFLOW_TOOL_ALLOWLIST` where one is set), takes the model from
  `get_agent_model(spec.model_group)`, and builds with
  `langchain.agents.create_agent`. The LLM's *only* tools are the ones the
  subagent is allowed to call.

  *Kind-specific:* every kind builds with `create_agent`; what tells them
  apart is middleware. The `data_analyst` branch returns early with its
  middleware (failure-marker veto, investigation discipline, `write_todos`),
  and `gis_correlation_analyst` returns early with
  `GuardrailToolResultMiddleware`. Slides and briefing fall through to the
  plain tail with no middleware. The tool-allowlisting property is the same
  for all of them.

## How it works (step by step)

1. **Worker builds two contexts.** `runInfusionOutputWorkflowAgent`
   assembles:
   - **Wired upstream** — JSON preview of every immediate predecessor
     step's artifact (size-bounded).
   - **Ancestor narrative** — markdown summary of every transitive
     ancestor step via `buildAncestorNarrativeContext`
     (`worker/internal/worker/ancestor_context.go`), using
     `CompiledPlan.AncestorIndex` from the engine. This narrative is
     **business-first, restructured** per an operator directive: it now
     opens with `buildAncestorFlowSummary`'s `## Workflow flow
     (simplified)` section — one line per ancestor in plan order
     (`"<kind label> — output: <channel>"`) — before descending into the
     existing `## Upstream data (profiles)` per-node profile dump. The
     heading text is a cross-service contract: the hardening blocks below
     name it verbatim ("Use the 'Workflow flow (simplified)' section...
     for the narrative arc"), so renaming one side requires renaming the
     other. An `if_else`/`switch_cases` ancestor renders as a decision
     line ("rows were routed across branches here; this context carries
     the %q branch") rather than a bare artifact header — the comment at
     `buildAncestorFlowSummary` spells out why the wording is careful not
     to claim the named channel was the *only* one taken: the ancestor
     loader (`loadLatestArtifactsForStepNodesSQL`,
     `worker/internal/db/claim.go`) returns one row per node via `DISTINCT
     ON (node_id) ... ORDER BY succeeded DESC, finished_at DESC, is_empty, row_count DESC,
     channel_key`, and a branching node emits one artifact row *per
     channel* from the same run with identical `finished_at` — so the
     surfaced channel is whichever wins that tiebreak, not necessarily the
     path the run actually took for that data. Successful attempts outrank
     allowed failed attempts. Among equally recent emitted artifacts,
     `is_empty` leads the channel tiebreak so data-bearing output is preferred.
     Empty channels are skipped by default; existing editor opt-ins can emit
     them (see [../services/worker.md](../services/worker.md)). Ordering on
     `channel_key` alone would profile a filter's empty `discarded` in
     preference to a `kept` holding everything, purely on the letter d.
2. **Ancestor ref expansion.** Any `{{alias}}` tokens in the authored
   instructions are expanded to the resolved ancestor-ref values
   (`expandWorkflowInstructionAliases`). A declared ref whose artifact
   cannot be read fails the step with **`WF_AGENT_MISSING_REF`**. An
   undeclared `{{name}}` never reaches the worker on a node that declares
   refs: compile fails it with **`WF_COMPILE_UNDECLARED_REF_TOKEN`**. On a
   node that declares none, `{{name}}` is plain text and passes through
   verbatim. Aliases are declared in `config.ancestor_refs[]` — see
   [ancestor-refs.md](ancestor-refs.md).
3. **POST to the agent.** The worker calls
   `/api/internal/workflow/output_agent` with `kind`, `instructions`,
   `wired_context`, `ancestor_context`, `user_id` (workflow owner),
   and workspace ids.
4. **Bootstrap context.** `_bootstrap_workflow_infusion_context`
   installs the singleton `InfusionToolsContext` with:
   - the Supabase **admin** client (no per-user JWT — the worker is
     trusted infrastructure, the persisted owner is the workflow's
     `created_by`),
   - the Supabase **admin** client passed through for every tool that
     needs Supabase (`fetch_slides_materials`, `search_workspace_assets`,
     `plan_briefing_draft`, …) — there is no separate service-role client
     parameter any more (removed when chat-side tool execution stopped
     using a dual-client pattern),
   - Graphiti (best-effort; soft-degrades when unavailable),
   - empty conversation state (no chat carry-over),
   - a freshly-reset `SlidesDraftStore` (kind `slides`) or
     `BriefingDraftStore` (kind `briefing`).

   Immediately after `_bootstrap_workflow_infusion_context` returns (still
   inside `run_workflow_output_agent`, not inside the bootstrap function
   itself), `kind=slides` runs also bind the wired upstream node's data
   profile onto `InfusionToolsContext.wired_context`
   (`set_wired_context`/`get_wired_context` in
   `agent/src/agents/infusion/logic/tool_helpers/context.py`) rather than
   the process-wide `SlidesDraftStore` — the store is a plain attribute on
   the singleton, so a concurrent chat turn could otherwise read another
   run's tenant data off it, while `wired_context` is contextvar-isolated
   per request. The slides asset-config filler
   (`_autofill_missing_asset_configs` in
   `agent/src/agents/infusion/logic/tool_helpers/slides_creation.py`) reads
   it from there via `get_wired_context()` to ground autofilled KPIs/copy
   in real numbers instead of the draft store.
5. **Direct subagent run.** `_build_subagent_react` builds the subagent
   with `create_agent` from its registry spec: the tools resolved from
   `tool_names`, the spec's `prompt` (plus a `## Tools` section when the
   spec has `Capability.LISTS_TOOLS`), and the model from
   `get_agent_model(spec.model_group)`. For both
   `slides_builder` and `briefing_creator` the tool set is first pruned
   through `_WORKFLOW_TOOL_ALLOWLIST` (chat-only tools — session-ledger
   loads, share flows, draft rehydration — are no-ops with
   `session_id=None`, so pruning them shrinks the prompt and removes
   mis-selection targets), then their normal per-subagent rules file is
   injected via `_build_subagent_rules` (shared with the chat path, in
   `agent/src/agents/infusion/logic/deep_agent.py`) exactly as it is in
   chat. On top of that, the runtime source ids are appended to the
   prompt so `fetch_slides_materials` / `search_workspace_assets` are
   never called with an empty list. The worker assembles these by
   merging (`mergeSourceIDsPreservingOrder`, order-preserving,
   deduplicated) three sources, each in
   `worker/internal/worker/source_ancestors.go` unless noted: the static
   plan walk (`collectAncestorSourceIDs` — `sourceId` on any upstream
   `source` step's bindings, and `send_api_request` action specs), the
   step's directly-wired JSON document inputs
   (`extractSourceIDsFromDocumentInputs`), and a transitive walk of every
   upstream document artifact, not just the wired ones
   (`(*Executor).collectAncestorDocumentIDs`). If, after that merge, the
   node ends up with **no** source id and no authorized asset id (see
   *Asset handoff* below), `(*Executor).fallbackWorkspaceSourceIDs`
   (`worker/internal/worker/run_scope.go`) fills `sourceIDs` with every
   source visible to the run's workspace — `workspace_source` /
   `private_workspace_source` rows plus `source.is_global = true` rows,
   workspace-scoped ids ordered ahead of globals, capped at
   `fallbackWorkspaceSourceIDsCap` (50). This used to be resolved inside
   the agent service with the Supabase **admin** client; the operator
   moved both discovery and authorization into worker-side, run-scoped
   SQL (2026-07-30) so the agent never queries `workspace_source` /
   `private_workspace_source` / `source` itself.

   **Asset handoff.** A `create_asset` node's step handler
   (`worker/internal/worker/create_asset_runtime.go`) writes its default
   channel as a JSON document `{"asset_id": …, "source_id": …}`. The
   worker gathers *candidate* asset ids from three places —
   `extractAssetIDsFromDocumentInputs` (the step's direct document
   inputs), `collectAncestorBoundAssetIDs` (any upstream `asset` node's
   compile-time `assetId` binding), and `collectAncestorDocumentIDs`
   (the same document scan, walked transitively) — merged the same way
   as the source ids above. **Authorization boundary:**
   `(*Executor).filterAssetIDsVisibleToRun`
   (`worker/internal/worker/run_scope.go`) then narrows that candidate
   list down to the ids the run's workspace is actually allowed to see,
   before any of them leave the worker or get hydrated by the agent. The
   run's workspace is resolved once, by joining `workflow_run` →
   `workflow_definition` on the run id (the same join
   `loadComponentAsset` uses); an id is admitted if it is
   `asset.is_global = true`, owned by that workspace
   (`asset.workspace_id`), shared into it via the `workspace_asset`
   junction, or linked to the run's *private* workspace via
   `private_workspace_asset`. The check **fails closed** — a query error,
   a missing DB pool, or a non-UUID candidate drops that id rather than
   forwarding it — because a wrongly-kept id is a cross-workspace data
   leak, while a dropped id only costs the deck one asset. Rejected ids
   are never silent: they are folded into a step warning via
   `rejectedAssetIDsWarning` (`"N upstream asset id(s) were not visible to
   this workflow's workspace and were dropped: …"`), and the raw list is
   also logged. The authorized ids are what gets sent as `asset_ids` on
   `WorkflowOutputAgentRequest`
   (`worker/internal/worker/agent_runtime.go`,
   `runInfusionOutputWorkflowAgent`). The agent binds them onto
   `InfusionToolsContext.runtime_asset_ids`
   (`agent/src/agents/infusion/logic/tool_helpers/context.py`,
   `set_runtime_asset_ids`), and
   `agent/src/agents/infusion/logic/tool_helpers/asset_discovery.py`'s
   `hydrate_assets_by_ids` fetches those rows directly from the `asset`
   table — GraphRAG is bypassed entirely for run-local assets, since the
   episode search that normally discovers assets has no episode for
   something minted moments earlier in the same run. `search_workspace_assets`
   and `fetch_slides_materials` (`agent/src/agents/infusion/logic/tools/briefings_slides.py`)
   both prepend these hydrated rows ahead of whatever GraphRAG/discovery
   turns up, and `_build_subagent_react` appends a "Runtime Asset IDs"
   prompt block. That block's wording was softened from an unconditional
   "place EACH of them on at least one slide/frame" to "place each one
   **that supports a finding** (prediction assets belong on the prediction
   slide/frame) … Never mention their ids in any reader-facing copy" — the
   old wording pulled against the earned-inclusion rule below (an
   already-hydrated runtime asset could otherwise force its way onto the
   deck even when it added nothing to the narrative), and the id-mention
   ban is the same UUID-in-copy guard the reader-copy sanitizer backstops
   deterministically (see below).

   **No GraphRAG ingest for workflow-generated assets.**
   Content's Flow create-asset write (`CreateFlowAsset` in
   `content/internal/api/services/assets/workflow_create.go`, behind
   `POST /api/content/internal/v1/flow-assets`) deliberately does **not**
   fire any GraphRAG ingest trigger. Content's ordinary asset save calls
   `TriggerAssetIngest` after the write when `ShouldIngest` holds
   (`afterSave` in `content/internal/api/handlers/assets_crud.go`); the Flow
   write skips it because the worker writes the rows only after the asset
   row exists. The row's `query` (`FlowAssetQuery`) reads the Store table the
   worker loads, or is a `-- workflow-generated <run id>` placeholder when the
   source names no table. Ingesting at create time would build a permanently
   degraded GraphRAG episode *and* flip the asset's `agent_status` to
   `active`, which would disqualify it from the scheduled
   `analyze-missing` backstop (`POST
   /api/internal/graphrag/assets/analyze-missing`, in the agent's
   `agent/src/api/routers/internal.py`) — today the *only* ingestion path
   for workflow-generated assets, since it only retries assets whose
   `agent_status` shows they were never (successfully) ingested. Net
   effect: workflow-created assets are **not semantically searchable**
   today (no chat-side GraphRAG discovery). This does not block
   same-run placement into the deck/briefing that created them — that
   path never depended on GraphRAG; it uses the direct asset-id handoff
   described above.

   In addition, **a workflow-only "Workflow Execution Mode" block is
   appended** to the rendered prompt for both subagents
   (`_SLIDES_WORKFLOW_HARDENING` / `_BRIEFING_WORKFLOW_HARDENING`,
   `agent/src/agents/workflow/workflow_output_agent.py`). This block
   forbids the LLM from short-circuiting to a final response before its
   persistence-relevant tools have been called. Without it, the model
   often paraphrases the wired upstream context (which already contains
   the analytical findings) and skips the four-step slides-builder
   sequence — producing a polished narrative but an empty
   `SlidesDraftStore`. **The chat path does not see this block** (it is
   added only inside `_build_subagent_react`, not baked into the spec's
   `prompt` in the subagent registry), so chat behaviour is unchanged.

   **Presentation Modes doctrine.** Both workflow creators also receive the
   composition doctrine their chat twins get on a generation turn
   (`presentation_modes_addendum_for`, `is_workflow_run=True` — the chat gate is
   a planner-requested generation tool, which a workflow run can never have and
   does not need, since this entry point exists only to generate; see
   [`../ai-agents/prompts.md`](../ai-agents/prompts.md) "Pattern 4"): one of
   ten communication modes declared up front, with that mode's narrative
   progression and evidence standard governing the deck/briefing. The workflow
   variant adds `WORKFLOW_MODE_NOTE`, which derives the mode from the upstream
   analysis rather than user phrasing, requires reclassifying down when the
   evidence cannot carry the mode (Diagnose → Analyze, Evaluate → Compare,
   Predict → Report), and requires the mode's caveats to be written into the
   reader-facing copy — there is no follow-up turn in which to add them. It is
   appended with the injected rules and **before** the hardening block, so the
   Workflow Execution Mode contract still wins on conflict.

   **Business-narrative content contract.** Both hardening blocks now
   carry an added "Content contract" section rather than only a
   persistence-order checklist: the deck/briefing must narrate the
   workflow's analysis from the business perspective (never node/tool
   step-by-step); structure is title-first, then findings (minimal
   business copy leading each slide/frame, with 1–2 supporting assets),
   then optional prediction slide(s)/frame last; catalog-asset inclusion
   is **earned** — an already-saved asset that adds nothing to the
   business story is left out even if topically related, which is a
   deliberate override of the base slides-planner prompt's chat-mode
   default of "use them ALL"; branch decisions from the ancestor context
   are translated into plain reasoning ("we found X, so we looked into
   Y"), never exposed as node/channel structure; and internal processing
   notes (asset ids/UUIDs, tool mentions, substitution/fallback prose)
   are forbidden in any copy. The briefing variant additionally caps
   scope — a briefing defaults to a title frame plus 1–3 findings frames
   (one prediction frame only if prediction outputs exist), since a
   briefing is a quick update, not a report.

   This same contract reaches two LLM calls that sit **outside** the
   ReAct subagent entirely and therefore never see the hardening block
   above: the slides structure planner and the basic-component filler.
   `InfusionToolsContext.is_workflow_run`
   (`agent/src/agents/infusion/logic/tool_helpers/context.py`'s
   `set_is_workflow_run`, default `False`; set `True` in
   `_bootstrap_workflow_infusion_context` right after `ctx.set_session_id(None)`;
   reset to `False` on every chat turn in
   `agent/src/agents/infusion/logic/tool_helpers/runtime_context.py` so a
   workflow run can never leak into a later chat turn on the same
   process) is the explicit signal those two calls read:
   - `_invoke_slides_planner_llm`
     (`agent/src/agents/infusion/logic/tool_helpers/slides_creation.py`)
     appends `WORKFLOW_PLANNER_ADDENDUM`
     (`agent/src/agents/prompts/infusion/slides_structure_planner_tool_prompt.py`)
     to the planner's system prompt only when the flag is set — its final
     line states "Where this section conflicts with the rules above, THIS
     section wins," which is what overrides the base prompt's "use them
     ALL" default for workflow runs while leaving chat behaviour
     untouched.
   - The basic-component filler's
     `build_slides_basic_component_filler_system_prompt(data_context="",
     workflow_mode=False)`
     (`agent/src/agents/prompts/infusion/slides_basic_component_filler_prompt.py`)
     appends `WORKFLOW_FILLER_ADDENDUM` when `workflow_mode=True`, passed
     from `_invoke_asset_filler_llm` off the same `is_workflow_run` flag.
     A universal rule (both chat and workflow) was also added to the base
     filler template forbidding internal processing notes in copy — the
     same UUID/fallback-prose ban the hardening blocks state and the
     reader-copy sanitizer (below) backstops deterministically.
   - **Reader-copy sanitizer (deterministic backstop, both paths).**
     `agent/src/agents/infusion/logic/tool_helpers/reader_copy.py`'s
     `sanitize_reader_copy`/`sanitize_reader_copy_config` drop any sentence
     containing a UUID from the prose fields of a slide/briefing component
     config, regardless of what the prompts above did or didn't prevent.
     Wired at `slides_draft.py`'s `set_asset_config`,
     `briefing_draft.py`'s `set_frame_text`/`add_frame`,
     `briefing_creation.py`'s `build_briefing_persist_payload` /
     `create_briefing_with_frames`, and `tools/briefings_slides.py`'s `plan_briefing_draft`
     — five write points across both chat and workflow paths. See
     [`../slides/overview.md`](../slides/overview.md) and
     [`../briefings/overview.md`](../briefings/overview.md).
   - **Base-asset exclusion (slides only, both chat and workflow).**
     `EXCLUDED_BASIC_ASSET_SUBTYPES = {"image", "video", "link_button",
     "modal_button"}`
     (`agent/src/agents/infusion/logic/tool_helpers/slides_materials.py`)
     is filtered out of the material catalog at the one place base-assets
     enter it (`fetch_basic_asset_materials`) plus the two raw-lookup
     paths (`refine_slides_draft`'s pre-hydration,
     `_load_saved_slides_as_draft`'s catalog return) via
     `filter_excluded_basic_assets`. This applies at the catalog boundary,
     not behind `is_workflow_run` — chat-authored decks are covered too.
     The briefing side does not have an equivalent filter — a known,
     currently-accepted asymmetry (see
     [`../briefings/overview.md`](../briefings/overview.md)).
6. **Branch on kind.** Neither branch persists anything agent-side — the
   agent only resolves an in-memory draft into a persist-ready payload
   and returns it; the worker owns every write.
   - **Slides.** Read `SlidesDraftStore.as_dict()` after the run. When
     populated (`draft.get("chapters")` truthy), attach it as `draft` on
     the response. When empty, attach a `warning` instead.
   - **Briefing.** Read `BriefingDraftStore.get_draft()` after the run.
     When it has frames, resolve it via
     `build_briefing_persist_payload(draft_obj, ctx.supabase)`
     (`agent/src/agents/infusion/logic/tool_helpers/briefing_creation.py`)
     — this is where backgrounds, widget layout, and each asset's
     `config_override` get computed — and attach the result as `draft`.
     When empty, attach a `warning` instead. There is no
     `create_briefing` tool call to look for any more; the subagent's
     only persistence-relevant tool is `plan_briefing_draft`, which just
     builds the in-memory `BriefingDraft`.
7. **Worker persists both kinds.** `persistSlidesDraft`
   (`worker/internal/worker/slides_persist.go`) calls the
   `create_slides_with_workspace` RPC, then inserts each chapter,
   slide, and slide_asset row; on failure it rolls back in reverse
   order. `persistBriefingDraft`
   (`worker/internal/worker/briefing_persist.go`) mirrors this via the
   `create_briefing_with_workspace` RPC plus `frame` and `frame_asset`
   inserts (briefings are **workspace-only** — the RPC has no
   private-workspace path, so a private-scoped run fails persistence
   outright rather than silently no-op'ing). For both kinds, a failed
   asset-link insert never rolls back the parent (a partial deck/briefing
   is still useful) but is counted and surfaced as a warning
   (`AssetLinkFailures` / `FailedAssetIDs` on the result struct). If
   *nothing* was persisted — no slides/briefing id at all —
   `runInfusionOutputWorkflowAgent` fails the step with
   `WF_OUTPUT_NOT_PERSISTED` (see *Failure modes* below); it does **not**
   silently succeed with `created_entity_id: null` any more.

## Response contract (agent → worker)

```jsonc
{
  "status": "success",
  "data": {
    "text": "<final assistant text>",
    "output": "<duplicate of text for back-compat>",
    "created_entity_id": null, // always null here — the worker stamps the persisted id after it writes `draft`
    "created_entity_kind": "slides" | "briefing",
    "draft": { /* SlidesDraft.as_dict() (slides) or build_briefing_persist_payload(...) (briefing) — present iff the store was populated */ },
    "warning": "<human note>"  // optional; emitted when nothing was persisted, or when persistence partially degraded
  },
  "usage": { "input_tokens": …, "output_tokens": …, "model": "…" }
}
```

The worker maps this into `WorkflowOutputAgentResponse` (`Draft`,
`Warning`, `CreatedEntityID`, …) and stamps the persisted `slides_id` /
`briefing_id` into `created_entity_id` itself
(`persistSlidesDraftFromAgent` / `persistBriefingDraftFromAgent` in
`worker/internal/worker/agent_runtime.go`). The step's output document also
carries `created_entity_title`, the draft's own `title`, when it has one, so a
reader (the chat answer of an agent's temporary run, for one) can name and link
the saved deck or briefing without another lookup. Every run mode persists:
a builder or `workflow_preview` run saves the deck or briefing exactly as a
production run does.

For `data_analyst_agent` the same envelope is reused, but
`created_entity_kind` is **null**, no `draft` is present, and `text`
carries the verdict JSON (possibly inside a markdown fence, which the
worker strips). See
[data-analyst-node.md → Verdict contract](data-analyst-node.md#verdict-contract-agent--worker).

## Failure modes

For slides and briefing the contract is **strict at the top, lenient
underneath**: if the node ends up with *no* persisted entity at all, the
step fails; if it ends up with a persisted entity that is missing some
asset links, the step succeeds with a warning. This split lives in
`runInfusionOutputWorkflowAgent`
(`worker/internal/worker/agent_runtime.go`): after the kind-specific
persist call runs, `createdEntityID == ""` triggers

```go
return nil, fmt.Errorf("WF_OUTPUT_NOT_PERSISTED: %s", detail)
```

which fails the step with error code `WF_OUTPUT_NOT_PERSISTED` (`detail`
is the accumulated warning, or a generic message if none was set). This
replaced the old lenient contract where the step always succeeded with
`created_entity_id: null` — that behaviour no longer exists for slides or
briefing.

- **Empty instructions** — agent short-circuits with
  `{status: "error", error_message: "instructions empty"}` before
  invoking the LLM. Worker surfaces as a step error.
- **Subagent build raises** — logged with stack trace; worker receives
  `status: "error"` and fails the step.
- **`slides_builder` / `briefing_creator` produces no draft** — agent
  returns `warning: "…did not populate a draft …"` and no `draft`.
  `persistSlidesDraftFromAgent` / `persistBriefingDraftFromAgent` see an
  empty draft, return no id, and the step fails with
  `WF_OUTPUT_NOT_PERSISTED: <warning>`.
- **Persistence failure (slides or briefing)** — `persistSlidesDraft` /
  `persistBriefingDraft` return an error; the worker logs it and folds it
  into the `WF_OUTPUT_NOT_PERSISTED` detail (e.g.
  `"failed to persist slides draft: <reason>"`). Mid-flight failures
  trigger a best-effort rollback (slides → chapters → workspace junction
  → slides; frames → workspace junction → briefing for the briefing
  path).
- **Asset-link failure (slides or briefing) — lenient.** A `slide_asset`
  / `frame_asset` insert failing does **not** roll back the parent
  slides/briefing (the chat-side save, content's
  `POST /api/content/v1/slides/from-draft`, likewise skips an asset it cannot
  link and reports it as `rejected_asset_ids`) and does **not** trigger
  `WF_OUTPUT_NOT_PERSISTED` — the parent id is non-empty, so the step
  succeeds. `result.AssetLinkFailures` / `FailedAssetIDs` are folded into
  a warning — `"slides persisted but N asset link(s) failed to insert
  (asset ids: …)"` for slides, `"N asset link(s) failed to insert (asset
  ids: …)"` joined onto any existing warning for briefing
  (`persistSlidesDraftFromAgent` / `persistBriefingDraftFromAgent`), so a
  deck/briefing that silently lost some of its visuals never looks fully
  green.
- **Owner unknown** (`workflow_definition.created_by IS NULL`) — the
  worker emits a warning (`"workflow owner is unknown … draft was
  generated but not persisted"`) and, since nothing was persisted, the
  step fails with `WF_OUTPUT_NOT_PERSISTED`. This can happen for very
  old workflow definitions; we do not auto-attribute to a placeholder
  user.
- **Briefing in a private workspace** — `runInfusionOutputWorkflowAgent`
  fails the step with `WF_BRIEFING_TEAM_WORKSPACE_REQUIRED` *before*
  calling the agent, so no tokens are spent on a draft that cannot be
  saved. The code is permanent: a retry would hit the same workspace.
  `persistBriefingDraft` (`worker/internal/worker/briefing_persist.go`)
  keeps the same refusal as a backstop. This is a product decision, not
  a bug.
- **Token parse failure** — `parse_agent_response` returns a
  best-effort dict even on malformed JSON; the response's
  `created_entity_id` field itself is not what decides success — the
  worker's own `createdEntityID` guard (above) is what fails or passes
  the step.

Note the bias above: story and briefing failures are mostly **lenient**
(the step succeeds with a warning, because a drafted-but-unpersisted
story is still worth showing) — including the asset-link carve-out, where
a deck persists with a warning even if some `slide_asset` inserts fail.
**`data_analyst_agent` inverts this** — a failed mint, a claimed hard
failure, or an empty verdict all fail the step, with no lenient carve-out,
because an unverifiable verdict that renders green is worse than a red
one. Do not extend the lenient pattern to it. See
[data-analyst-node.md → Failure modes and edge cases](data-analyst-node.md#failure-modes-and-edge-cases).

## Validation checklist

- `slides_agent` and `briefing_agent` must be in the `dispatchAgentKind`
  switch (worker — extracted out of `runAgent`) routing to
  `runInfusionOutputWorkflowAgent`, **not** `runUnstructuredAgent`.
  `data_analyst_agent` must route to `runDataAnalystWorkflowAgent`, which
  deliberately has **no** persistence tail — if it ever reaches the
  output-agent runner it will try to persist a verdict as content.
- `REGISTRY.get("slides_builder")` and `REGISTRY.get("briefing_creator")`
  must each return a spec; the workflow path reads `spec.prompt` directly
  and, for a spec with `Capability.LISTS_TOOLS`, appends a `## Tools`
  section itself so the LLM sees the tool docs.
- The spec's `tool_names` must list every tool the subagent prompt
  references — there is no orchestrator fallback, so unlisted tools
  are simply unavailable and the LLM will fail/skip the step.
  `_WORKFLOW_TOOL_ALLOWLIST["slides_builder"]` /
  `["briefing_creator"]` (`agent/src/agents/workflow/workflow_output_agent.py`)
  then prunes that set further for the workflow path only — if a tool a
  subagent prompt's mandatory sequence depends on is missing from the
  allowlist, the workflow run will fail/skip that step even though chat
  works fine.
- The worker's `Executor.Supabase` field must be wired in `main.go` to
  a `NewSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …)`.
  When `nil` (e.g. unit tests), the persist call returns an error and the
  step fails with `WF_OUTPUT_NOT_PERSISTED` rather than crashing.
- `RunContext.OwnerUserID` is populated from
  `workflow_definition.created_by`; if you add a new workflow ingress,
  make sure that column is set so persistence has someone to attribute
  to.
- Agent tests live in `agent/tests/test_workflow_output_agent.py`,
  `agent/tests/test_workflow_output_agent_build.py`, and
  `agent/tests/test_workflow_output_agent_asset_ids.py` (asset-id
  hydration into the prompt); worker tests live in
  `worker/internal/worker/slides_persist_test.go`,
  `worker/internal/worker/briefing_persist_test.go`,
  `worker/internal/worker/source_ancestors_test.go` (source/asset id
  extraction from document inputs), and
  `worker/internal/worker/agent_runtime_test.go` (the integration
  `runInfusionOutputWorkflowAgent_*` group, including the
  `WF_OUTPUT_NOT_PERSISTED` cases).

## Chat-side persistence (reference)

The chat path that creates a slides from a draft (content's `POST
/api/content/v1/slides/from-draft`, `content/internal/api/services/slides/from_draft.go`) is
**unchanged** by this design. The worker's `persistSlidesDraft`
deliberately mirrors that flow so the two paths produce identical row
shapes; if you change one, change the other.

One partial-save behaviour is worth knowing about on the chat side, since
it changes what "identical row shapes" means when an asset link is
rejected: the `replace_slides_from_draft` Postgres function
(`supabase/migrations/004_functions.sql`) now **skips** (rather than
aborts the whole save on) an asset that fails
`check_slide_asset_source_access` for the acting user, and returns the
skipped ids in its jsonb result under `rejected_asset_ids`. The from-draft
handler (`content/internal/api/handlers/slides_from_draft.go`) reads that key, logs it,
and — when non-empty — includes it as `rejected_asset_ids` on the
response so the UI can report a partial save instead of a silent one.
Older databases that have not applied the corresponding delta simply
have no `rejected_asset_ids` key in the RPC result, which the handler
treats the same as "nothing was rejected".
