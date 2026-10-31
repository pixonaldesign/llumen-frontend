---
topic: workflows
services: [content, engine]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Engine internal API (HTTP)

## Audience and goal

Server-to-server contract between the **engine** (Go) and the services that
drive it — chiefly **content**, and the **runner** for ETL Flow runs — plus
the **worker** (Go). Public product APIs stay on the browser-facing surfaces —
this page covers the engine's internal control plane, mounted under base path
`/internal/v1` in `engine/internal/httpapi/server.go`.

## Read first (ordered)

1. `engine/internal/httpapi/server.go` — route table (search the
   `gr.Post(...)` / `ir.Post(...)` calls below).
2. `contracts/engine/openapi.yaml` — OpenAPI stub (subset of the
   routes below).
3. `content/internal/engine/client.go` — the content service's caller
   (`Client`): `CreateVersion`, `Compile`, `MaterializeTriggers`,
   `UnmaterializeTriggers`, `PurgeDefinition`, `CreateRun`, `CreateStepTest`,
   `CancelRun`, `ChatResume`, `MaterializeETLSource` and the usage probes,
   behind the Flow routes in [../services/content.md](../services/content.md#flows-definitions-and-runs).
   The same client serves content's Flow chat (`CreateRun`, `ChatResume`),
   the webhook ingress (`CreateRun`) and assistant proposals (`Compile`).

## How it works

Authentication: when `ENGINE_API_KEY` (alias `WORKFLOW_ENGINE_API_KEY`) is set
on the engine, every `/internal/v1/*` request must carry `X-Engine-Key:
<shared secret>`; unset skips auth (local dev only). Tracing: `X-Trace-Id` /
`X-Correlation-Id` are equivalent aliases the engine echoes back; forward the
same value on downstream calls.

`GET /health` returns `{"status":"ok","service":"engine"}`.

## Critical paths (routes)

- **`POST /internal/v1/workflow-definitions/{definitionId}/versions`**
  (`createVersion`, `engine/internal/service/createversion.go`, gated on the
  `workflows` licence feature) — writes a new version of a definition and
  makes it the latest. It is what an autosave, a restore and a new
  definition's first version call, so the version number is allocated in the
  same transaction that inserts the row.
  - Body: either `document` (the authored graph, a JSON object) or
    `restore_from_version_id` (a version of the same definition, whose graph
    is copied), plus optional `version_label`, `created_by` (user UUID) and
    `compile` (default `true`). A restore's label defaults to
    `Restored from v<N>`; a blank label is stored as `NULL`.
  - Under a `FOR UPDATE` lock on the `workflow_definition` row it takes
    `max(version_no) + 1`, inserts the `authored_workflow` document row and the
    `pending` version row, uploads the gzip object to
    `workflow-definitions/{id}/{N}/authored.json.gz`, and sets
    `latest_version_id` (and `updated_by` when `created_by` is sent). Concurrent
    saves get consecutive numbers and each keeps its own bytes. The upload
    comes after the version row, so a `WF_VERSION_CONFLICT` never overwrites the
    object of the version that took the number.
  - The compile runs after the commit, so a graph that does not compile is
    still saved. The response reports what the compiler persisted.
  - `201 {workflow_definition_id, workflow_version_id, version_no,
    version_label, authored_document_id, compilation_status,
    compilation_error_code, compilation_error_message, node_diagnostics}`.
    `compilation_status` is `pending` without a compile, else the persisted
    `valid`/`invalid`; `node_diagnostics` is `null` or the per-node map.
  - Errors: `400 WF_VERSION_DOCUMENT_REQUIRED` / `_DOCUMENT_INVALID` /
    `_SOURCE_CONFLICT`; `404 WF_VERSION_DEFINITION_NOT_FOUND` /
    `_SOURCE_NOT_FOUND`; `409 WF_VERSION_CONFLICT` (only a writer that skips
    the lock can cause it; retry); `500` for storage or database failures.
- **`POST /internal/v1/workflow-versions/{versionId}/compile`** — loads the
  authored document referenced by `workflow_version.authored_document_id`,
  validates and compiles it, writes the compiled plan object, updates
  `workflow_version.compilation_status`. `200 {"status":"ok","workflow_version_id":"<uuid>"}`;
  `400`/`404` `{"error":"<WF_* code>"}`. See [engine-compile.md](engine-compile.md).
- **`POST /internal/v1/workflow-versions/{versionId}/materialize-triggers`** —
  walks `triggerPlans` in the compiled plan and idempotently upserts
  `workflow_schedule` (for `schedule_trigger`, keyed by
  `(workflow_definition_id, workflow_version_id, trigger_node_id)`, hash in
  `schedule_spec_hash`, `next_fire_at` recomputed only when the hash changes)
  and `workflow_webhook_endpoint` (for `webhook_trigger`, reusing any existing
  `path_key`/`secret_ref`) rows. Bindings for a removed trigger node are
  flipped to `enabled = false`, not deleted, so `workflow_run.trigger_node_id`
  stays resolvable. Content calls this on every successful publish. See
  [schedules.md](schedules.md), [webhooks.md](webhooks.md).
- **`POST /internal/v1/workflow-definitions/{definitionId}/unmaterialize-triggers`**
  — disables (`enabled = false`) every `workflow_schedule` /
  `workflow_webhook_endpoint` row for the definition; called by content on
  unpublish (content also keeps a direct-table fallback for when the engine is
  unreachable).
- **`POST /internal/v1/workflow-definitions/{definitionId}/purge`**
  (`purgeDefinition`, `engine/internal/service/purgeworkflow.go`, not
  licence-gated) — deletes the definition with the documents, blobs and
  unshared webhook secrets its cascade cannot reach. It locks the definition
  row first and refuses with `409 WF_PURGE_RUNS_IN_FLIGHT` while any run is
  `queued`, `running` or `waiting`. The caller checks this too, but only the
  check under the lock covers a run a schedule starts in between.
  `200 {status, workflow_definition_id, purged}`; an unknown definition is a
  no-op.
- **`POST /internal/v1/workflow-runs`** (handler `createRun`,
  `engine/internal/service/createrun.go`) — creates a durable `workflow_run` +
  initial `workflow_step_run` rows against a compiled version. Accepts
  `trigger_type` ∈ `manual`/`chat`/`schedule`/`webhook`, `root_input_document_id`
  (webhook/fixture payload), and `chat_session_id` (required — `400
  WF_RUN_CHAT_SESSION_REQUIRED` — whenever `trigger_type=chat`, so the
  content's chat ingress active-run probe on
  `workflow_run.workflow_chat_session_id` never double-fires).
  - `trigger_node_id` is optional. Without it the engine picks the compiled
    plan's first trigger of the most preferred executable kind: manual, then
    schedule, then webhook (`resolveDefaultTriggerNodeID`); a plan with none
    is `400 WF_RUN_NO_EXECUTABLE_TRIGGER`.
  - `fixture_input` is an optional JSON object (at most 1 MiB compacted) that
    becomes the run's root input: an `other` document at
    `workflow-definitions/{id}/builder-fixtures/{hex}.json`, inserted in the
    run's transaction. A refused or deduplicated create stores nothing. `400
    WF_RUN_FIXTURE_INVALID_JSON` / `_TOO_LARGE`, and `_CONFLICT` when
    `root_input_document_id` is also sent; `500 WF_RUN_FIXTURE_PUT` /
    `_DOC` when it cannot be stored.
  - `X-Idempotency-Key` (a scheduled fire's key, or an assistant preview's
    reserved key) converges a retry on the run the key already started.
  - `201 {workflow_run_id}`.
- **`POST /internal/v1/workflow-runs/{runId}/chat-resume`** (`chatResumeRun`)
  — forwards a user reply to a run parked on a `send_and_wait`
  `send_chat_message` step (`workflow_step_run.wait_kind = 'chat_response'`);
  flips `waiting` → `succeeded` in one transaction, persists the reply as the
  step's `default`-channel artifact, emits `step_resumed`/`step_succeeded`,
  enqueues newly-ready steps. `400 WF_CHAT_RESUME_BAD_RESPONSE` /
  `WF_CHAT_RESUME_RESPONSE_TYPE_MISMATCH` (validated against
  `plan.StepPlans[nodeID].Bindings["spec"].responseType`,
  `engine/internal/service/chatresume.go` `validateResponseMatchesSpec`) /
  `404 WF_CHAT_RESUME_RUN_NOT_FOUND` / `409 WF_CHAT_RESUME_RUN_NOT_WAITING`.
- **`POST /internal/v1/workflow-runs/{runId}/cancel`** (`cancelRun`,
  `engine/internal/httpapi/cancel_run_test.go` exercises the route) —
  two-phase cancel: request phase flips `queued`/`running`/`waiting` →
  `cancelling`, promotes queued/waiting steps to `cancelled`, fast-path
  finalizes to `cancelled` if no `leased`/`running` step remains
  (`finalised: true`); otherwise the sweeper's `sweepCancellingRuns`
  (`engine/internal/service/sweeper.go`) finalizes once running steps observe
  the status via heartbeat. Idempotent; `409 WF_RUN_CANCEL_ALREADY_TERMINAL` on
  a terminal run. Side-effect actions already journaled as `succeeded` in
  `workflow_action_outbound` are **not** rolled back by cancellation.
- **`POST /internal/v1/workflow-step-tests`** (`createStepTest`,
  `engine/internal/service/steptest.go`) — creates a `run_mode =
  "builder_step_test"` run scoped to one `target_node_id`. `input_mode` ∈
  `reuse_prior_outputs` (copies ancestor step_runs/artifacts from
  `source_run_id`), `recompute_ancestors`, `fixture_input` (JSON object only;
  `400 WF_STEP_TEST_FIXTURE_INVALID_JSON` / `_REQUIRED` / `_TOO_LARGE` at 1
  MiB). Side-effect action kinds (`send_chat_message`, `send_email`,
  `send_api_request`) require `confirm_live_execution: true` or reject `403
  WF_STEP_TEST_ACTION_CONFIRM_REQUIRED` (FR-037); content relays the code. `409 WF_RUN_ALREADY_ACTIVE` if a non-terminal run already exists for
  the definition.

## Retention class defaults

`retention_class` is optional on `POST /internal/v1/workflow-runs`/
`workflow-step-tests`; when omitted the engine derives a default from
`run_mode` in `createrun.go` (`isBuilderRunMode`, `isValidRetentionClass`):

| `run_mode` | Default `retention_class` | Deadline |
|---|---|---|
| `production` (and any other non-builder, non-`dataflow` mode) | `standard` | `created_at + 30 days` |
| `builder_debug`, `builder_step_test`, `builder_replay` | `debug_short` | `created_at + 7 days` |
| `dataflow` | `debug_short` | `created_at + 7 days` |
| explicit `"retention_class": "pinned"` | `pinned` | no deadline until released |

The `dataflow` run mode is not a builder mode but still gets `debug_short`
because DataFlow-triggered runs are ephemeral cache-fill executions, not
audited automations (`createrun.go` comment, R2). An explicit but invalid
`retention_class` is rejected with `400 WF_RUN_INVALID_RETENTION_CLASS`. The
deadline is materialized into `workflow_run.retain_until` and drives the
sweeper's retention pass (`sweepExpiredRuns`) — see
[engine-sweeper.md](engine-sweeper.md).

## Failure modes and edge cases

- Non-2xx responses are JSON `{"error": "<WF_* code>"}` (sometimes
  `"detail"`); content's `engine.AsError` parses either field. Content maps a `WF_*` refusal onto its own
  `{error, code}` answer.
- Cancellation cannot unsend an already-acknowledged email/webhook — only the
  outbound journal's idempotency key prevents double-firing on retry.
- `chat-resume` response-type mismatches (approval step given free-text, or
  vice versa) are rejected rather than silently coerced.

## Integration map

- [../contracts/engine-internal-api.md](../contracts/engine-internal-api.md) — notes on `contracts/engine/openapi.yaml`'s coverage gaps vs. this page.
- [engine-compile.md](engine-compile.md) — compile pipeline detail.
- [engine-sweeper.md](engine-sweeper.md) — cancellation settle phase, retention
  sweep.
- [schedules.md](schedules.md), [webhooks.md](webhooks.md),
  [chat-ingress.md](chat-ingress.md) — the three trigger materialization
  targets.
- [runs-and-executions.md](runs-and-executions.md) — run lifecycle consuming
  these endpoints.

## Validation checklist

- Regenerate or diff `contracts/engine/openapi.yaml` when adding
  routes; update the caller (`content/internal/engine/client.go`) in the
  same PR.
- `engine/internal/httpapi/cancel_run_test.go`, `engine/internal/service/chatresume_test.go`,
  `engine/internal/service/createrun_test.go` cover the behaviors above —
  re-run after touching `createrun.go`, `chatresume.go`, `cancelrun.go`, or
  `sweeper.go`.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
