---
topic: workflows
services: [content, engine, frontend, scheduler]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow schedules

## Audience and goal

How a `schedule_trigger` node's authored recurrence config becomes a
firing schedule: the guided (non-cron-text) authoring fields, engine
compilation into `ScheduleSpec`, and materialization on publish into the
unified `scheduled_job` table. Does not cover schedule *firing* itself
(claiming/dispatching due jobs) — that is the `scheduler/` service, see
[../services/scheduler.md](../services/scheduler.md).

**Correction:** an earlier revision of this page said an in-engine
scheduler tick wakes due work, and that materialization writes
`workflow_schedule` rows — both are stale. The in-engine polling loop
was retired (issue #311), and materialization today writes directly
into `scheduled_job`; `workflow_schedule` is legacy and is only ever
disabled going forward. See [engine-scheduler.md](engine-scheduler.md)
for the full correction.

## Read first

- [triggers.md](triggers.md)
- `content/internal/api/handlers/flows_definitions.go` — `FlowsHandler.Publish`,
  which calls `engine.Client.MaterializeTriggers`
  (`content/internal/engine/client.go`).
- `engine/internal/engine/compile.go` — `ScheduleSpec` (the compiled
  recurrence shape: `Every`, `Unit`, `AtMinute`, `AtHour`, `Weekday`,
  `Day`, `Timezone`).
- `engine/internal/service/materialize.go` — `upsertSchedule` (writes
  `scheduled_job`, preserves `next_fire_at` across a no-op republish).
- [engine-scheduler.md](engine-scheduler.md) — materialization vs
  firing split, and the `workflow_schedule` → `scheduled_job` cutover.
- [../schedulers/workflow-scheduler.md](../schedulers/workflow-scheduler.md)
  — end-to-end firing wiring.

## How it works

Authors configure a `schedule_trigger` node through guided fields in
the builder (`frontend/src/components/pages/workflows/nodeConfig/NodeConfigurationPanel.tsx`):
`scheduleEvery`, `scheduleUnit` (e.g. `"days"`), `scheduleAtHour`,
`scheduleAtMinute`, `scheduleWeekday`, `scheduleMonthDay`,
`scheduleTimezone` — there is no free-text cron field. On save, the
builder converts these into the node's authored `config` JSON, and
reconstructs the guided fields from it on load.

At **compile** time, the engine's compiler turns that authored config
into `engine.ScheduleSpec` (`Every int`, `Unit string` —
`seconds|minutes|hours|days|weeks|months`, `AtMinute`, `AtHour`,
`Weekday`, `Day` (1..28, capped to avoid a Feb-29 skip), `Timezone` —
IANA, defaults to UTC at fire time) as part of the node's
`CompiledTrigger`.

At **publish** time, the content service calls the engine's
`POST /internal/v1/workflow-versions/{id}/materialize-triggers`, which
drives `TriggerMaterializer.MaterializeVersion`
(`engine/internal/service/materialize.go`): for each `schedule`-type
`CompiledTrigger`, `upsertSchedule` computes a content hash of the spec
(`ScheduleSpecHash`), serializes the full spec into
`scheduled_job.schedule_spec` (`job_kind='workflow'`,
`target_ref=<workflow_version_id>`,
`target_extra->>'trigger_node_id'=<node id>`), and computes
`next_fire_at` via `engine.ComputeNextFireAt` — **unless** an existing
row has the identical spec hash and is still enabled, in which case its
current `next_fire_at` is preserved so an already-due fire is never
pushed back by a no-op republish. Any `scheduled_job` binding from a
prior version of the same definition that isn't in the new plan is
disabled in the same transaction. See
[engine-scheduler.md](engine-scheduler.md) for the full mechanics
(including the one-shot legacy backfill of pre-cutover
`workflow_schedule` rows).

Firing is entirely the unified `scheduler/` service's job: it polls
`scheduled_job` (`FOR UPDATE SKIP LOCKED`) and dispatches per
`job_kind` — for `job_kind='workflow'` rows, into the engine's
create-run path. See [../services/scheduler.md](../services/scheduler.md)
and [../schedulers/workflow-scheduler.md](../schedulers/workflow-scheduler.md).

## Critical paths

1. **Author** — builder's guided schedule fields → node `config` JSON.
2. **Compile** — authored config → `engine.ScheduleSpec` inside the
   node's `CompiledTrigger`.
3. **Publish** — content's `FlowsHandler.Publish` → engine `materialize-triggers` →
   `TriggerMaterializer.MaterializeVersion` → `upsertSchedule` →
   `scheduled_job` row inserted/updated (`next_fire_at` computed or
   preserved).
4. **Fire** — `scheduler/` service claims the due `scheduled_job` row →
   dispatches to engine → new `workflow_run` (`trigger_type='schedule'`).
5. **Republish with an unchanged spec** — `upsertSchedule` detects the
   same `schedule_spec_hash` and keeps the existing `next_fire_at`
   rather than recomputing a later one.

## Configuration and operations

- `workflow_schedule` columns (`last_fired_at`, `last_run_id`,
  `consecutive_failures`, `last_error_code`, `last_error_at`) are still
  present in the schema as observability columns for drift detection,
  but the table itself is legacy for *new* firing — see
  [document-model.md](document-model.md).
- There is no per-workflow override of the scheduler's poll cadence;
  that cadence is a `scheduler/` service-level config — see
  [../services/scheduler.md](../services/scheduler.md).
- A schedule's timezone defaults to UTC when the authored `Timezone` is
  empty; there is no workspace-level default timezone.

## Failure modes and edge cases

- **`WF_MATERIALIZE_SCHEDULE_MISSING_SPEC`** — a compiled trigger is
  typed `schedule` but carries no `ScheduleSpec`; a compile-time
  invariant violation, not a normal runtime failure.
- **Unpublish** — `UnmaterializeDefinition` disables both the legacy
  `workflow_schedule` row and any `scheduled_job` row for the
  definition; a disabled schedule never fires regardless of
  `next_fire_at`.
- **DataFlow definitions** — cannot carry a `schedule_trigger` at all;
  `dataflow.allowed_trigger_kinds` in `contracts/workflow_node_kinds.json`
  restricts dataflows to `manual_trigger` only.
- **Day-of-month scheduling** — `Day` is capped at 1..28 specifically to
  avoid a schedule silently skipping short months.
- Firing-side failure modes (claim contention, dispatch errors,
  `consecutive_failures` bookkeeping) belong to the `scheduler/`
  service — see [../services/scheduler.md](../services/scheduler.md).

## Integration map

- [triggers.md](triggers.md) — `schedule_trigger` as one of the four
  trigger kinds.
- [engine-scheduler.md](engine-scheduler.md) — the materialization
  mechanics and the `workflow_schedule` → `scheduled_job` cutover this
  page's authoring-side view builds on.
- [../services/scheduler.md](../services/scheduler.md),
  [../schedulers/workflow-scheduler.md](../schedulers/workflow-scheduler.md)
  — the firing service.
- [document-model.md](document-model.md) — `workflow_schedule` columns
  still used for observability.
- [webhooks.md](webhooks.md) — the sibling externally-fired trigger,
  materialized by the same `MaterializeVersion` call but into
  `workflow_webhook_endpoint` rather than `scheduled_job`.

## Validation checklist

- Changing the guided schedule fields' shape must stay compatible with
  `engine.ScheduleSpec` and `ComputeNextFireAt` — add engine unit tests
  for any new field.
- Any change to `upsertSchedule`'s hash-preservation logic needs a
  republish-with-unchanged-spec regression case.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
