---
topic: workflows
services: [content, engine, runner, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow artifacts storage

## Audience and goal

Where workflow bytes actually live: the fixed `workflow` Supabase Storage
bucket holding authored JSON, compiled plans, and step
output artifacts, and the on-disk **format** the worker writes for
durable step outputs (Parquet, not Arrow IPC).

## Read first

- `engine/internal/service/createversion.go` — writes every authored
  version's object for a Flow save, restore or create.
- `content/internal/storagedoor/workflow.go` — `WorkflowBucket`,
  `AuthoredPath`, `PutWorkflowObject`, `FetchWorkflowObject`,
  `FetchWorkflowPath`.
- [../data/object-storage.md](../data/object-storage.md)
- `worker/internal/worker/parquet_rows.go` — `serializeRowsToParquet`,
  `inferParquetColumnType`.
- `runner/internal/api/handlers/parquet.go` — `serializeToParquet`,
  `isParquetEligible`.

## How it works

**Authored versions.** A Flow save, restore or create goes through
content to the engine's `POST /internal/v1/workflow-definitions/{id}/versions`,
which allocates the version number under a row lock and uploads
`workflow-definitions/{id}/{version_no}/authored.json.gz` in the same
transaction (see [internal-api.md](internal-api.md)). A manual run's inline
`fixture_input` is stored by the engine too, under
`workflow-definitions/{id}/builder-fixtures/`.

**Content-side object helpers.** Content's Flow chat, webhook ingress and
assistant-proposal services reach the bucket through the storage service's
narrow doors, never Supabase Storage directly, using
`content/internal/storagedoor/workflow.go`. `WorkflowBucket` is the fixed
`"workflow"` constant; `AuthoredPath(definitionID, versionNo)` computes the
canonical authored-version path; `PutWorkflowObject`,
`FetchWorkflowObject` and `DeleteWorkflowObject` address a
`workflow-definitions/{definition_id}/{kind}/{leaf}` object by its parts,
where `kind` is a version number or one of `chat-inputs`, `webhook-inputs`
and `builder-fixtures`; `FetchWorkflowRunPreview`, `FetchWorkflowRunOutput`
and `FetchWorkflowPath` read run outputs. No object key crosses the wire
whole. See [chat-ingress.md](chat-ingress.md) and [webhooks.md](webhooks.md).

**Durable step output format (Parquet).** The worker writes terminal
step outputs as **Parquet**, not Arrow IPC — Arrow IPC for
intra-worker hand-off was evaluated and deferred (see
`_records/workflow/arrow-ipc-status.md` for the rationale); it is not
implemented as of this writing.

- Writer / type inference: `worker/internal/worker/parquet_rows.go`
  (`serializeRowsToParquet`, `inferParquetColumnType`; row
  normalization from the worker's `[]map[string]any` plan shape, first
  `typeInferenceSampleSize` (100) rows drive column typing).
- Compression: snappy, via
  `github.com/parquet-go/parquet-go/compress/snappy`.
- Executor wiring: `worker/internal/worker/executor.go`
  (`persistSourceParquet`).
- Runner-side read/serialize path:
  `runner/internal/api/handlers/parquet.go` (`serializeToParquet`,
  `isParquetEligible`).
- `workflow_artifact.format` is a plain `TEXT NOT NULL` column (no
  `CHECK` constraint / enum) — the values actually produced by
  worker/engine code today are `"parquet"` and `"json"` only (see e.g.
  `worker/internal/worker/ml_model_runtime.go`,
  `dataset_output_runtime.go`). There is no `arrow_ipc` / `arrow_schema`
  value in current code or schema.

**Worker ↔ runner / agent wire transport is JSON today**, not Arrow
IPC: `worker/internal/runnerclient/client.go` (transform/preview
requests) and `worker/internal/agentclient/client.go`
(structured/unstructured LLM requests) both send `application/json`.

## Critical paths

1. **Save an authored version** — content → engine `createVersion` →
   gzip object at `workflow-definitions/{id}/{version_no}/authored.json.gz`
   → `authored_workflow` document row and `workflow_version` row in one
   transaction.
2. **Step output persistence** — worker materializes a step's result →
   `serializeRowsToParquet`/`inferParquetColumnType` (tabular) or a
   plain JSON document → uploaded under
   `workflow-runs/{run_id}/steps/{step_run_id}/output/{channel}/...` →
   `workflow_artifact` row records `bucket`/`path`/`format`.
3. **Read back** — the builder and the Agent read step previews and JSON
   outputs through content's `GET .../flow-runs/{run}/previews/{doc}` and
   `.../documents/{artifact}`; Parquet outputs go through the runner's
   artifact-fetch handler.
4. **Retention purge** — [engine-sweeper.md](engine-sweeper.md)'s
   `purgeRun` deletes every object a terminal run referenced before
   deleting the DB rows.

## Configuration and operations

- The bucket is the fixed `workflow`, declared as a constant in each service that
  touches it (`storage.WorkflowBucket` in engine and worker, `config.WorkflowBucket`
  in runner, `storagedoor.WorkflowBucket` in content). It is
  not configurable — see [../data/object-storage.md](../data/object-storage.md).
- Bucket provisioning is idempotent and owned by the Go storage service
  (`storage/internal/bootstrap`), which declares the same name.
- `typeInferenceSampleSize` = 100 rows — the sample the worker's
  Parquet writer uses to infer column types; not currently
  configurable via env var.

## Failure modes and edge cases

- **Bucket name mismatch across services** — a step written by the worker under one
  bucket but read back by a service naming a different one fails as a not-found
  object, not a clear "bucket mismatch" error. The name is now a compiled-in constant
  in all four services precisely so this cannot be a deployment-time mistake; a
  mismatch would mean one service's constant was edited alone.
- **Non-tabular query result forced through the Parquet path** —
  `isParquetEligible` exists precisely to route these to the JSON
  fallback instead (see [source-nodes.md](source-nodes.md)); assuming
  every artifact is Parquet will break on these.
- **If Arrow IPC work resumes** — re-verify the format-column claim
  above; a `CHECK` constraint would need to be added since none exists
  today, and the wire-transport claim (JSON today) would also need
  re-verification.

## Integration map

- [../data/object-storage.md](../data/object-storage.md) — the
  underlying Supabase Storage mechanics this page's bucket sits on.
- [source-nodes.md](source-nodes.md) — the parquet/JSON dual-mode
  content negotiation that decides which format a `source` step's
  artifact takes.
- [worker-executor.md](worker-executor.md) — the general
  `workflow_step_output`/`workflow_artifact` model this page's storage
  layer backs.
- [engine-sweeper.md](engine-sweeper.md) — retention purge, the other
  major writer/deleter of these objects besides step execution.
- [chat-ingress.md](chat-ingress.md), [webhooks.md](webhooks.md) —
  other callers that write into the same bucket outside the
  `authored_path`/step-output conventions.

## Validation checklist

- The `workflow` constant must agree across content, engine, worker and runner, and appear in the storage service's `StaticBucketDefs`.
- If Arrow IPC work resumes, re-verify the format-column claim above — a
  `CHECK` constraint would need to be added since none exists today.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
