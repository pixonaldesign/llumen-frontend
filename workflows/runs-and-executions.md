---
topic: workflows
services: [content, engine, frontend, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Runs and executions

## Audience and goal

The lifecycle of a `workflow_run` and its child `workflow_step_run` rows
from creation through a terminal state, the content service routes that expose
that lifecycle to the builder/library UI, and the separate cross-workspace
admin reporting surface. Column-level schema (which fields exist on which
table) lives in [document-model.md](document-model.md); this page covers
state transitions and the HTTP surface around them, not the schema
itself.

## Read first

- [document-model.md](document-model.md) — `workflow_run_status` (8
  values) / `workflow_step_status` (9 values) enums.
- `content/internal/api/handlers/flows_runs.go` — `CreateRun`,
  `CreateStepTest`, `ListRuns`, `GetRun`, `GetRunPreview`,
  `GetRunDocument`, `CancelRun` (routes in
  [../services/content.md](../services/content.md#flows-definitions-and-runs)).
- `engine/internal/service/createrun.go` — `createRun`, default-trigger
  resolution and the active-run refusal.
- `engine/internal/service/runtxhelpers.go` — `finalizeRunTx`,
  `maybeFinalizeRunTx`, `enqueueReadyStepsTx`.
- `engine/internal/service/runfinalize.go` — `classifyRunTerminal`
  (mirrored, not imported, by `worker/internal/worker/finalize.go`'s
  `ClassifyRunTerminal`).
- `engine/internal/service/cancelrun.go` — `RunCanceller.Cancel`.
- `telemetry/internal/api/flowruns.go` — the separate cross-workspace
  reporting surface (see below).

## How it works

**Creation.** Every run — manual, chat, webhook, schedule, replay, or
retry — is created the same way: the caller resolves the target
version, then calls the engine's `POST /internal/v1/workflow-runs`,
which picks the default trigger node when none is named, inserts the
`workflow_run` row (`status` defaults to `queued`) and enqueues the
trigger node's step(s). For the builder and the Agent the caller is
content's `CreateRun` (`POST .../flow-definitions/{id}/runs`), the one
endpoint that covers manual/builder-debug/replay: `run_mode` selects
between `production`, `builder_debug`, `builder_step_test`,
`builder_replay` and `workflow_preview` (`flows.RunModes`; `dataflow` runs
come only from the runner). The builder's single-node test uses
`POST .../flow-definitions/{id}/step-tests` instead.
**There is no separate retry/replay HTTP endpoint** — both are the same
run call with an extra field: `retry_of_run_id` links a fresh run back
to the one it retries (any run mode), and `run_mode="builder_replay"`
additionally *requires* `source_run_id` (enforced with a `400` if
absent). An inline `fixture_input` becomes the run's root input, stored
by the engine. The engine refuses a new run (`409 WF_RUN_ALREADY_ACTIVE`)
while the definition already has one in flight. Chat and webhook runs
are also created through the content service, by the Flow chat routes and
the public webhook ingress, and are documented separately — see
[chat-ingress.md](chat-ingress.md) and [webhooks.md](webhooks.md).

**Step execution** is the worker's job — see
[worker-executor.md](worker-executor.md) for `HandleStep` and the lease
cycle (`queued → leased → running → succeeded|failed|skipped|cancelled|timed_out`
on `workflow_step_run`). This page covers what happens at the *run*
level as steps settle.

**Fan-out / fan-in.** `enqueueReadyStepsTx` (`runtxhelpers.go`) is the
shared primitive that finds every step whose upstream dependencies (all
inbound non-suppressed edges) are `succeeded` and enqueues it — called
after a step completes, and again after a chat-resume artifact write.

**Run finalization.** A run has no separate "compute my status" step;
instead, `finalizeRunTx` recomputes it from step-level counts whenever
it's called: it counts non-terminal (`pending`) steps plus how many
steps landed `failed` / `timed_out` / `cancelled`, and — only when
`pending == 0` — calls `classifyRunTerminal(pending, failed, timedOut,
cancelled)`, whose priority order is **failed > timed_out > cancelled >
succeeded**. Independent in-flight branches keep a run non-terminal
until *every* branch settles; nothing is abandoned early. The `UPDATE
... WHERE status IN ('queued','running','waiting')` guard makes this
race-safe — a concurrent finalize (e.g. from the sweeper) that already
flipped the run is a silent no-op, not a double-write. This exact
priority table is duplicated (not imported — engine and worker are
separate Go modules) as `worker/internal/worker/finalize.go`'s
`ClassifyRunTerminal`; the two test suites
(`engine/internal/service/runfinalize_test.go`,
`worker/internal/worker/finalize_test.go`) assert the same case table
and **must be changed together**.

Terminal transitions to `failed`/`timed_out`/`cancelled` also emit a
`role='system'` chat bubble for chat-triggered runs (`runTerminalChatBubble`)
— success transitions are deliberately silent, since the workflow's own
`send_chat_message`/output node already carries the happy-path response.

**Cancellation** (content's `POST .../flow-runs/{run_id}/cancel`,
proxied to the engine's `RunCanceller.Cancel`) is two-phase:

1. **Request** — under a row lock on `workflow_run`, every `queued`/
   `waiting` step is flipped straight to `cancelled` and the run moves
   to `cancelling`; if nothing was in flight the run finalizes to
   `cancelled` immediately (`finalised=true` in the response).
2. **Settle** — any `leased`/`running` step is *not* synchronously
   aborted. The worker observes `run.status='cancelling'` on its own
   heartbeat and stops cleanly; if it doesn't, the sweeper reclaims the
   step once its lease expires (see [engine-sweeper.md](engine-sweeper.md)
   `sweepCancellingRuns`). `finalised=false` means this phase is still
   pending.

Re-cancelling an already-`cancelling` run is a no-op; cancelling a
terminal run rejects with `WF_RUN_CANCEL_ALREADY_TERMINAL`.

**Step output previews (run-detail drawer).** The builder's run-detail
drawer (`WorkflowRunDetailDrawer.tsx`, opened from both the per-workflow
Executions tab and the workspace-level cross-workflow Executions view)
lazy-loads each step output's preview body from content's
`.../flow-runs/{run_id}/previews/{doc_id}` (`workflowService.getRunPreview`) and hands
it to `StepOutputPreviewBody.tsx`, which shape-sniffs the body rather than
trusting `payload_kind`: tabular bodies (`sample_rows` present) render
through the same `DataTable` (`nodeConfig/DataTable.tsx`) the node-config
output panel uses, document bodies render their `snippet` — pretty-printed
when it parses as JSON — and anything unrecognised falls back to
pretty-printed JSON. Before this, every step output was dumped as raw
stringified JSON into a small `<pre>` regardless of shape. The drawer
still never fetches full artifact bodies either way — heavy payloads stay
behind the separate "download artifact" flow.

**A step's whole JSON document.** A document preview's `snippet` is only the
first 4 KiB of the output. Content's `GET .../flow-runs/{run}/documents/{artifact_id}`
returns `{artifact_id, body}`, the whole document for a `document` artifact in JSON format that
belongs to the run. The agent reads an AI step's text through
it when the output is larger than its snippet, so a long reading is shown in
chat whole rather than dropped.

**Which rows a tabular preview holds.** `sample_rows` are the first 50 rows
of the output, except when a categorical chart (a `create_asset` bar or pie)
reads it: then they are the 50 rows with the largest measure, ordered over the
whole output before the limit (`previewOrderFor` / `sampleParquetRowsInOrder`
in `worker/internal/worker/`). A date or numeric category keeps the output's
order, and so do charts that disagree about their columns.

## Critical paths

1. **Create** — content `POST .../flow-definitions/{id}/runs` → engine
   `POST /internal/v1/workflow-runs` (active-run check, default trigger,
   fixture) → engine inserts `workflow_run` (`queued`) → trigger step(s)
   enqueued. An optional `idempotency_key` (a UUID) in the body reaches the
   Engine, which admits one run per definition and key; the active-run guard
   ignores a run carrying that same key, so a retry gets the existing run
   back. `run_mode: "workflow_preview"` is accepted only for a temporary
   definition or a saved assistant proposal's definition — this is how an
   approved proposal runs (see
   [agent-authored-workflows.md](agent-authored-workflows.md#how-a-run-is-carried-out)).
   When the Engine refuses such a run, content answers 400 with
   `{error, code}` carrying the Engine's `WF_RUN_PREVIEW_*` code.
2. **Progress** — worker leases a step → executes → writes
   `workflow_step_output`/`workflow_artifact` rows → step → `succeeded`
   (or terminal-failure state) → `enqueueReadyStepsTx` enqueues newly
   ready downstream steps.
3. **Finish** — last pending step settles → `finalizeRunTx` (or the
   worker's own equivalent) computes the run's terminal status →
   `workflow_run.status`/`finished_at` set → `run_completed` event
   appended.
4. **Cancel** — content `POST .../flow-runs/{run_id}/cancel` →
   `RunCanceller.Cancel` (request phase) → sweeper `sweepCancellingRuns`
   (settle phase, if needed) → terminal `cancelled`.
5. **Inspect** — builder/library polls content's `GET
   .../flow-runs/{run_id}` (`GetRun`), which joins
   `workflow_step_run` + `workflow_step_output` + `workflow_artifact` +
   `workflow_event` into a `step_timeline` for the run detail view; `GET
   .../flow-runs` (`ListRuns`) is the cross-Flow list for the workspace,
   newest first.

## Configuration and operations

- `ListRuns` defaults `limit` to 50, caps it at 200 and paginates via
  `offset`.
- `GetRun`'s `events` list is the run's first 50 events by
  `sequence_no`; there is no route for the full event stream.
- Retention of terminal runs/artifacts (`retain_until`,
  `workflow_retention_class`) is swept by the engine — see
  [engine-sweeper.md](engine-sweeper.md).
- `CancelRun`'s `reason` body field is free text, truncated to
  500 characters before being handed to the engine. Cancel is not
  licence-gated, so a tenant whose licence lapsed can still stop a run.

## Failure modes and edge cases

- **`WF_RUN_ALREADY_ACTIVE`** — the engine refuses a manual run while the
  definition already has one queued/running/waiting; content relays the
  `409` and code.
- **`builder_replay` without `source_run_id`** — `400` from content,
  before reaching the engine.
- **Cross-workspace run id guess** — content's `loadRun` reads the run on
  the caller's client and re-checks workspace scope on its *definition*,
  returning `404` (not `403`) so a run in a workspace the caller can't
  reach doesn't even reveal its existence.
- **`WF_RUN_CANCEL_ALREADY_TERMINAL`** — cancelling a run already in a
  terminal state.
- **Engine unavailable** — content answers `503` when the engine is not
  configured and `502` when it cannot be reached.
- **Independent branches** — a run with one failed branch and other
  branches still in flight stays non-terminal (`pending > 0`) until
  every branch settles; it does not fail early just because one branch
  did.
- **Concurrent finalize race** — the sweeper and `maybeFinalizeRunTx`
  (chat-resume path) can both attempt to finalize the same run; the
  `WHERE status IN (...)` guard makes the loser's write a no-op rather
  than a conflicting double-transition.

## Integration map

- [document-model.md](document-model.md) — the underlying
  `workflow_run`/`workflow_step_run` schema and enum values this page's
  transitions operate over.
- [worker-executor.md](worker-executor.md) — step-level execution
  mechanics (`HandleStep`, leasing) that this page's run-level view sits
  on top of.
- [engine-sweeper.md](engine-sweeper.md) — lease reclaim, cancellation
  settle, and retention; the sweeper is the other writer of run-terminal
  transitions besides `finalizeRunTx`.
- [chat-ingress.md](chat-ingress.md) — the `waiting`/chat-resume path
  that also calls `maybeFinalizeRunTx`.
- [webhooks.md](webhooks.md) / [triggers.md](triggers.md) — the other
  ways a run gets created.
- [permissions-matrix.md](permissions-matrix.md) — the separate
  cross-workspace reporting gate referenced below.

## Cross-workspace admin reporting surface

Telemetry's `/api/telemetry/audit/flow-runs` routes
(`telemetry/internal/api/flowruns.go` over `internal/auditread/flowruns.go`)
are a **separate, read-only** surface from content's workspace-scoped
Flow run routes, purpose-built for Platform Settings ▸ Reporting's "Workflow Runs"
tab (`frontend/src/components/pages/platform-settings/PlatformSettingsReporting/WorkflowRunsTab.tsx`).
Three routes: list (`GET /flow-runs`), filter options
(`GET /flow-runs/filter-options`), and detail (`GET /flow-runs/{runId}`) — all
gated on system_admin **or** security_admin (`requireAuditAdmin`) and on the
`workflow_runs` licence feature. The role check crosses workspace boundaries by
design, unlike the workspace-scoped surface. It's intentionally read-only:
no cancel/retry/replay here (those stay attributed to the workspace-scoped
caller), and the detail endpoint returns run/step metadata only — no
artifact bytes; an operator drills into the workspace-scoped run page for
parquet/JSON payload previews. The list view's column projection
(`flowRunListColumns`) deliberately omits `cancel_reason`/`trace_id`/`correlation_id`
to keep list responses small; those appear only in the detail response.

## Validation checklist

- `engine/internal/service/runfinalize_test.go` and
  `worker/internal/worker/finalize_test.go` — the shared
  `classifyRunTerminal` case table; change both together.
- `engine/internal/httpapi/cancel_run_test.go` covers the two-phase
  cancel contract at the HTTP layer (finalised-immediately,
  still-cancelling, already-terminal-409, not-found-404, trace
  propagation) — re-run after touching `RunCanceller.Cancel`.
- `__tests__/WorkflowRunDetailDrawer.outputPreview.test.tsx` and
  `__tests__/StepOutputPreviewBody.test.tsx` — the shape-aware preview
  rendering (table / formatted JSON / plain text); re-run when touching
  either component.
- Load test concurrent runs to observe row-level contention on hot
  indexes (`idx_workflow_run_status`) — watch DB metrics.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
