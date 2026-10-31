---
topic: workflows
services: [content, engine, supabase]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow document model

## Audience and goal

Tables and storage objects representing **definitions**, **versions**, **runs**, and **step runs**. Precise column lists evolve—use migrations plus ORM models as truth.

## Read first (ordered)

1. `supabase/migrations/` — search `workflow_definition`, `workflow_version`, `workflow_run`, `workflow_step_run`.
2. `content/internal/api/services/flows/columns.go` — `DefinitionColumns`, `VersionSummaryColumns`, `RunListColumns`, `RunDetailColumns`: the safe projections the Flow routes in [../services/content.md](../services/content.md#flows-definitions-and-runs) return.
3. `engine/internal/service/createversion.go` — writes the authored object and version row for every save, restore and create (see [artifacts-storage.md](artifacts-storage.md)).

## How it works

**Hot rows vs blobs.** List endpoints intentionally omit large JSON from `workflow_definition` / `workflow_version` to keep library UI fast; full graphs live in Storage under `workflow-definitions/{id}/{version_no}/authored.json.gz`.

**Version linkage.** Fields `latest_version_id`, `published_version_id` on definitions (in `DefinitionColumns`) drive builder tabs and production execution selection. `DefinitionColumns` also includes `ai_findings_enabled`, which content's publish sets to whether the published version holds an `ai_findings` node and unpublish clears (default false). `PATCH .../flow-definitions/{id}` on content accepts `name` only.

**Private workspaces.** `workflow_definition.private_workspace_id` (FK to
`user_private_workspace`, nullable) exists alongside `workspace_id` — a
definition can live in a user's private workspace rather than a shared team
workspace, mirroring the same pattern used by `slides`/`asset`/`source`/`filter`
private-workspace tables (`supabase/migrations/003_tables.sql`).

**Key columns not yet listed elsewhere in this wiki** (all in
`supabase/migrations/003_tables.sql`):

- `workflow_run`: `trace_id`, `correlation_id` (request tracing — see
  [internal-api.md](internal-api.md)); `cancel_requested_at`,
  `cancel_requested_by`, `cancel_reason` (cancellation, see
  [internal-api.md](internal-api.md)); `retain_until` (retention deadline,
  see [engine-sweeper.md](engine-sweeper.md)); `workflow_chat_session_id`
  (chat-triggered run linkage). `token_input`/`token_output` (`BIGINT`) are
  real, populated columns for LLM usage accounting — there is **no**
  `estimated_cost_usd` column (a dollar-cost column was drafted at some
  point and removed before landing; don't assume cost-in-dollars is
  available anywhere in the workflow run model).
- `workflow_run_mode` enum has 5 values: `production`, `builder_debug`,
  `builder_step_test`, `builder_replay`, `dataflow`.
- `workflow_run_status` enum has 8 values: `queued`, `running`, `waiting`,
  `cancelling`, `succeeded`, `failed`, `cancelled`, `timed_out`. Note
  `skipped` is deliberately **not** in this enum — that's a
  `workflow_step_status` value only; a run as a whole always settles into
  one of the 8 above.
- `workflow_step_run`: `wait_kind`, `wait_handle`, `resume_after` — the
  `send_and_wait` contract (see [action-nodes.md](action-nodes.md),
  [internal-api.md](internal-api.md) chat-resume).
- `workflow_payload_kind` enum (on `workflow_step_output.payload_kind`) has
  5 values: `table`, `document`, `message`, `artifact`, `control` — see
  [worker-executor.md](worker-executor.md) for which are actually in use.
- `workflow_schedule`: `last_fired_at`, `last_run_id`,
  `consecutive_failures`, `last_error_code`, `last_error_at` (observability
  columns for drift detection — see [schedules.md](schedules.md)).
- `workflow_webhook_endpoint`: `method` (`TEXT NOT NULL DEFAULT 'POST'`,
  constrained to `GET`/`POST`/`PUT`/`PATCH`/`DELETE`), `oauth2_config`
  (`JSONB`, required when `auth_mode='oauth2'`) — see [webhooks.md](webhooks.md).

## Integration map
- [runs-and-executions.md](runs-and-executions.md) — the
  `workflow_run`/`workflow_step_run` lifecycle built on the enums
  documented here.
- [chat-ingress.md](chat-ingress.md) — `workflow_run.workflow_chat_session_id`
  and the chat-session/message tables.
- [schedules.md](schedules.md), [webhooks.md](webhooks.md) —
  `workflow_schedule` and `workflow_webhook_endpoint` columns.
- [action-nodes.md](action-nodes.md) — `wait_kind`/`wait_handle`/
  `resume_after` on `workflow_step_run`.
- [worker-executor.md](worker-executor.md) — `workflow_payload_kind`
  usage in practice (which of the 5 enum values are actually written).
- [artifacts-storage.md](artifacts-storage.md) — the object-storage
  paths for authored versions and run outputs.


## Validation checklist

- When adding columns, update `DefinitionColumns` in `content/internal/api/services/flows/columns.go` if the column should appear in library API responses.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
