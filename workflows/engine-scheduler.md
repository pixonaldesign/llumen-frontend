---
topic: workflows
services: [engine, scheduler]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Engine scheduler

## Audience and goal

**This page's original premise is superseded.** There is no in-process
`service.Scheduler` with a polling tick wired in `engine/cmd/engine/main.go`
any more — `engine/cmd/engine/main.go` has no `Scheduler` construction at
all today (verified: no `Scheduler` symbol appears in that file). What the
engine *does* still run in-process is the **sweeper** (`service.Sweeper`,
`TickInterval: cfg.SweeperInterval`) — a different responsibility (lease
reclaim, step timeouts, cancellation settle, retention), documented at
[engine-sweeper.md](engine-sweeper.md). Do not confuse the two: the sweeper
never fires schedule triggers.

## Read first

- `engine/cmd/engine/main.go` — startup wiring (materializer backfill +
  sweeper only; no scheduler tick).
- `engine/internal/service/materialize.go` — `TriggerMaterializer`,
  `MaterializeVersion`, `upsertSchedule`.
- `engine/internal/service/schedule_backfill.go` — `BackfillSchedules`.
- `engine/internal/service/createrun.go` — `validateRunEligibility`.
- [../services/scheduler.md](../services/scheduler.md) — the actual
  schedule-firing service.
- [schedules.md](schedules.md) — the `schedule_trigger` authoring side
  of the same materialization this page describes.

## How it works

Per `engine/cmd/engine/main.go` (comment citing issue #311): **"the unified
`./scheduler` service now owns workflow-schedule firing — the engine's
in-process polling loop has been retired."** Schedule firing is fully
owned by the separate Go `scheduler/` service (port `:8088`), which polls
`scheduled_job` under `FOR UPDATE SKIP LOCKED` and dispatches per
`job_kind` — see [../services/scheduler.md](../services/scheduler.md)
and [../schedulers/workflow-scheduler.md](../schedulers/workflow-scheduler.md)
for the full firing path.

**Materialization writes `scheduled_job` directly, not `workflow_schedule`.**
`TriggerMaterializer.MaterializeVersion` (called by the content service on
publish via the engine's `materialize-triggers` route) walks the compiled
plan's `TriggerPlans`; for each `schedule`-type trigger,
`upsertSchedule` serializes the full recurrence spec and
`INSERT ... ON CONFLICT` s it straight into `scheduled_job`
(`job_kind='workflow'`, `target_ref=<version_id>`,
`target_extra->>'trigger_node_id'`), computing `next_fire_at` via
`engine.ComputeNextFireAt` — and **preserving** the existing
`next_fire_at` across a no-op republish (same `schedule_spec_hash`) so a
fire that was already due isn't skipped. `workflow_schedule` is legacy:
`MaterializeVersion` only ever `UPDATE`s it to `enabled = FALSE` for the
definition being (re)published — **no code path inserts new
`workflow_schedule` rows anymore**. Each definition is enabled in
exactly one of the two tables at a time; there is no dual-fire. The
same file's `upsertWebhook` does the analogous thing for
`webhook_trigger`, still against `workflow_webhook_endpoint` (see
[webhooks.md](webhooks.md) — webhooks were not migrated to
`scheduled_job`).

**One-shot legacy backfill.** The engine's only schedule-related startup
work is a one-shot, backgrounded `TriggerMaterializer.BackfillSchedules`
call: it reads every `workflow_schedule` row still `enabled = TRUE` (a
holdover from before the #311 cutover) and re-materializes each
referenced version through the same `MaterializeVersion` path, moving it
into `scheduled_job` so deployments that predate the unified scheduler
keep firing without an explicit republish. It runs once and never blocks
startup; it does not run on a tick and is not the "scheduler" this page's
title might suggest.

**Publish-status enforcement happens at run creation, not
materialization.** `TriggerMaterializer` does **not** itself check
whether the workflow is published — it only writes/updates
`scheduled_job` / `workflow_webhook_endpoint` rows on every successful
publish call from the content service. The actual "only a published version may
run in production mode" guarantee is enforced later, at run-creation
time, by `validateRunEligibility` (`engine/internal/service/createrun.go`):
for `run_mode="production"` it requires `workflow_definition.status =
'published'`, a non-empty `published_version_id`, and that the requested
version id matches the published one — rejecting with
`WF_RUN_WORKFLOW_NOT_PUBLISHED`, `WF_RUN_PUBLISHED_VERSION_REQUIRED`, or
`WF_RUN_VERSION_NOT_PUBLISHED` otherwise. Non-production run modes
(builder debug/step-test/replay, dataflow) skip this check entirely.

## Critical paths

1. **Publish** — content's `FlowsHandler.Publish` → engine `materialize-triggers`
   → `TriggerMaterializer.MaterializeVersion` → `upsertSchedule`/`upsertWebhook`
   per trigger node in the compiled plan → stale bindings from prior
   versions disabled.
2. **Unpublish** — `UnmaterializeDefinition` disables every
   `workflow_schedule` / `scheduled_job` / `workflow_webhook_endpoint`
   row for the definition.
3. **Startup (one-shot)** — `engine/cmd/engine/main.go` →
   `BackfillSchedules` → any legacy enabled `workflow_schedule` row is
   re-materialized into `scheduled_job`.
4. **Firing** (owned elsewhere) — `scheduler/` service claims a due
   `scheduled_job` row → dispatches to the engine's create-run path —
   see [../services/scheduler.md](../services/scheduler.md).
5. **Run creation gate** — engine `POST /internal/v1/workflow-runs` →
   `validateRunEligibility` enforces the published-version rule for
   `production` run mode.

## Configuration and operations

- No scheduler-specific env vars live in the engine itself — schedule
  *firing* configuration (poll interval, lease TTL, etc.) belongs to the
  `scheduler/` service; see [../services/scheduler.md](../services/scheduler.md).
- `BackfillSchedules` takes no configuration; it runs unconditionally,
  once, at engine startup, and only touches rows still `enabled = TRUE`
  in the legacy `workflow_schedule` table.

## Failure modes and edge cases

- **A page or comment describing an in-engine schedule polling loop** —
  it is describing the pre-#311 architecture; verify against
  `engine/cmd/engine/main.go` before trusting it.
- **`WF_MATERIALIZE_SCHEDULE_MISSING_SPEC` /
  `WF_MATERIALIZE_WEBHOOK_MISSING_SPEC`** — a compiled `TriggerPlan`
  claims `schedule`/`webhook` type but carries no spec; treated as a
  compile-time invariant violation.
- **Republishing an unchanged schedule** — `upsertSchedule` detects the
  same `schedule_spec_hash` and reuses the existing `next_fire_at`
  rather than recomputing it, so an already-due fire is not silently
  pushed back.
- **DataFlow definitions** — `MaterializeVersion` returns immediately
  for `definition_kind='dataflow'`; dataflows have no external triggers
  to materialize (manual-only, per
  `dataflow.allowed_trigger_kinds` in `contracts/workflow_node_kinds.json`).
- **Publishing a `production`-mode run against a stale version id after
  republish** — rejected by `validateRunEligibility` with
  `WF_RUN_VERSION_NOT_PUBLISHED`.

## Integration map

- [engine-sweeper.md](engine-sweeper.md) — the tick loop that *does*
  still run in-engine; unrelated to schedule firing.
- [schedules.md](schedules.md) — `schedule_trigger` authoring/config
  fields on the workflow side; this page is the materialization
  mechanics underneath it.
- [webhooks.md](webhooks.md) — the sibling trigger type materialized by
  the same `MaterializeVersion` call, into `workflow_webhook_endpoint`
  rather than `scheduled_job`.
- [runs-and-executions.md](runs-and-executions.md) — `validateRunEligibility`
  and the run-creation gate this page's publish-status section
  describes.
- [internal-api.md](internal-api.md) — `materialize-triggers` /
  `unmaterialize-triggers` engine routes.
- [../services/scheduler.md](../services/scheduler.md),
  [../schedulers/workflow-scheduler.md](../schedulers/workflow-scheduler.md)
  — the actual firing service and its end-to-end wiring.

## Validation checklist

- If you find another page or comment describing an in-engine schedule
  polling loop, it is describing the pre-#311 architecture — verify
  against `engine/cmd/engine/main.go` before trusting it.
- Any change to `upsertSchedule`'s hash-preservation logic should be
  re-checked against a republish-with-unchanged-spec test case.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
