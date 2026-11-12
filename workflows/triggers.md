---
topic: workflows
services: [content, engine, frontend, scheduler]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow triggers

## Audience and goal

The four trigger node kinds (`manual_trigger`, `schedule_trigger`,
`chat_input_trigger`, `webhook_trigger`), how they differ in the
compiled plan and in the builder, and which subset a run request can fire
directly via `POST .../runs` versus which need an external ingress. Each
trigger's own ingress protocol is documented on its dedicated page —
this page is the cross-cutting overview.

## Read first

- `contracts/workflow_node_kinds.json` — `triggers.kinds` (all 4) vs
  `executable_triggers.kinds` (3 of 4 — no chat).
- `engine/internal/engine/nodekinds.go` — `NodeKindTriggers`,
  `NodeKindExecutableTriggers` (contract-backed, with hardcoded
  defensive fallbacks matching the contract).
- `frontend/src/features/workflows/catalog/nodeCatalog.ts` — per-kind
  `isTrigger`, `singleInstance`, `excludeFromManualTriggerPicker` flags.
- `engine/internal/service/createrun.go` — `defaultTriggerPreference`,
  `defaultExecutableTriggerKinds`, `resolveDefaultTriggerNodeID`.
- [node-catalog.md](node-catalog.md) — the full node-kind catalog this
  page's kinds are a subset of.
- [schedules.md](schedules.md), [webhooks.md](webhooks.md),
  [chat-ingress.md](chat-ingress.md) — per-kind detail pages.

## How it works

All four trigger kinds are declared in `contracts/workflow_node_kinds.json`
under `triggers.kinds` — the single source of truth mirrored (byte-for-byte,
test-enforced) into the engine's and the frontend's generated copies (see
`CLAUDE.md` "Shared contracts"). A node with a
trigger kind enters the compiled plan as one of `CompiledPlan.Triggers`,
**not** as a `StepPlan` — the engine's step-test path explicitly rejects
targeting a trigger node with `WF_STEP_TEST_TARGET_NOT_EXECUTABLE`
(`engine/internal/service/steptest.go`).

**Executable vs ingress-fired.** Of the four kinds, only three
(`manual_trigger`, `schedule_trigger`, `webhook_trigger` — the
`executable_triggers` contract bucket) can be fired by a direct run
request with no external event: content's `POST
.../flow-definitions/{id}/runs` with no explicit `trigger_node_id`
reaches the engine's `POST /internal/v1/workflow-runs`, which resolves
one of these via `resolveDefaultTriggerNodeID`, walking
`defaultTriggerPreference` (`manual_trigger`, `schedule_trigger`,
`webhook_trigger`, filtered to the contract's executable kinds) and
returning the first trigger of the first kind present in the compiled
plan. `chat_input_trigger` is
deliberately excluded from this preference list — a chat run always
needs an active `workflow_chat_session` (see
[chat-ingress.md](chat-ingress.md)), so there is no "just fire it"
shortcut for chat the way there is for the other three (e.g. the
builder's "Run Schedule Now" / "Send Test Webhook" dispatchers, which
use this same manual-run endpoint with a `fixture_input` body — see
[runs-and-executions.md](runs-and-executions.md)).

**Singleton vs repeatable.** In the builder catalog
(`nodeCatalog.ts`), `manual_trigger` and `chat_input_trigger` are
`singleInstance: true` — a workflow can have at most one of each.
`schedule_trigger` and `webhook_trigger` are **not** singleton: a
workflow can carry several independent schedules or several webhook
endpoints, each becoming its own trigger entry in the compiled plan
(see [schedules.md](schedules.md), [webhooks.md](webhooks.md)).
`chat_input_trigger` additionally sets
`excludeFromManualTriggerPicker: true`, so it never appears as a
selectable target in manual-run pickers — consistent with it being
excluded from the engine's `defaultTriggerPreference`.

**Trigger-first authoring.** The builder canvas requires at least one
trigger node to exist before non-trigger nodes can be added — see
[builder-ui.md](builder-ui.md) "Canvas: trigger-first node addition".

**Trigger fan-in exception at compile time.** A node whose inbound
edges are *all* from trigger nodes is exempt from the normal
`maxInputsForKind` cap — see [engine-compile.md](engine-compile.md)
"Input arity and fan-in".

## Critical paths

1. **Default trigger resolution** — content `POST
   .../flow-definitions/{id}/runs` with no `trigger_node_id` → engine
   `resolveDefaultTriggerNodeID` walks the preference order → first
   matching trigger node in the compiled plan is used.
2. **Compile** — engine compiler classifies each authored node kind via
   `NodeKindTriggers()`; trigger kinds become `CompiledPlan.Triggers`
   entries rather than `StepPlan`s.
3. **Fire** — each kind has its own ingress: manual is a direct
   run request through content (see [runs-and-executions.md](runs-and-executions.md)),
   schedule is fired by the unified `scheduler/` service (see
   [schedules.md](schedules.md), [engine-scheduler.md](engine-scheduler.md)),
   webhook is fired by an inbound HTTP request (see
   [webhooks.md](webhooks.md)), chat is fired by a posted chat message
   (see [chat-ingress.md](chat-ingress.md)).

## Configuration and operations

- Adding a trigger kind is a contract change:
  `contracts/workflow_node_kinds.json` `triggers.kinds` (and, if it
  should be directly firable, `executable_triggers.kinds`), verified by
  `TestNodeKindContractCopiesAreIdentical` (see `CLAUDE.md`) plus the
  frontend catalog entry in `nodeCatalog.ts` and any engine-side
  compile-time gating (e.g. dataflow's `allowed_trigger_kinds`).
- DataFlow definitions (`definition_kind='dataflow'`) restrict triggers
  further still: `dataflow.allowed_trigger_kinds` in the same contract
  file is `["manual_trigger"]` only — a dataflow cannot carry a
  schedule/webhook/chat trigger at all (`engine/internal/engine/dataflow_validate.go`
  requires exactly one `manual_trigger`).

## Failure modes and edge cases

- **No executable trigger in the graph** — the engine answers `400
  WF_RUN_NO_EXECUTABLE_TRIGGER` if none of
  `manual_trigger`/`schedule_trigger`/`webhook_trigger` is present;
  content relays the status and code.
- **Step-testing a trigger node directly** — rejected with
  `WF_STEP_TEST_TARGET_NOT_EXECUTABLE`; triggers are entry points, not
  steps.
- **Dataflow with a non-manual trigger, or more/less than one manual
  trigger** — rejected at compile (`dataflow_validate.go`).
- Per-kind failure modes (invalid schedule config, webhook auth
  failures, chat session/run-state mismatches) are documented on each
  kind's own page, not duplicated here.

## Integration map

- [node-catalog.md](node-catalog.md) — the full node-kind catalog;
  triggers are one contract bucket within it.
- [engine-compile.md](engine-compile.md) — how trigger kinds are
  classified at compile time and the fan-in exception they grant.
- [builder-ui.md](builder-ui.md) — trigger-first canvas gating and the
  single-instance UI treatment.
- [schedules.md](schedules.md) — `schedule_trigger` materialization and
  firing.
- [webhooks.md](webhooks.md) — `webhook_trigger` HTTP ingress.
- [chat-ingress.md](chat-ingress.md) — `chat_input_trigger` session
  protocol.
- [runs-and-executions.md](runs-and-executions.md) — manual-run
  creation and the default-trigger fallback.

## Validation checklist

- Adding a trigger kind requires the contract update above plus an
  engine test (`engine/internal/engine/nodekinds_test.go` —
  `TestNodeKindRegistryMatchesContracts`) and a TS assertion update in
  `frontend/src/services/workflowService.ts`, per the contract file's
  own `_comment`.
- If a new kind should be directly firable without external ingress,
  add it to `executable_triggers.kinds` and reconsider the engine's
  `defaultTriggerPreference` ordering.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
