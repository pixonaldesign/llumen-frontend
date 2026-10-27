---
topic: workflows
services: [engine, frontend, supabase, worker]
status: current
verified_against: "c9e9a1231de73d1f304c2016849f07b2625b915b"
verified_on: 2026-07-31
---
# Worker executor

## Audience and goal

`worker/internal/worker/executor.go` package doc and `Executor` struct define how **leased step tickets** become persisted results. Main loop lives in `worker/cmd/worker/main.go` calling into this package.

## Read first (ordered)

1. `worker/internal/worker/executor.go` — `Executor` fields (`Runner`, `Agent`, `Store`, `Bucket`, `HTTP`, `SMTPSender`, `ChatPromptTimeout`), method `HandleStep`.
2. `worker/internal/worker/` — per-kind runners live directly in this
   package (`runSource`, `runTransform`, `runAction`, `dispatchAgentKind`,
   `runMLPrediction`), **not** under a separate `worker/internal/adapter/`
   package — that path does not exist in the current tree (an earlier
   revision of this page pointed there; verified no such directory).
3. `worker/internal/lifecycle` — `ShouldAbortStep` referenced in docstring.

## How it works

**Dispatch sequence.** `HandleStep` (`worker/internal/worker/executor.go`)
runs the same sequence for every step kind before handing off to a
per-adapter runner: (1) if `LicenseGate` is set, refuse with
`WF_LICENSE_LOCKED` when the `workflows` feature is locked — this is
defense-in-depth since the content service's Flow routes and engine already gate
workflow operations, but the worker leases steps directly from Postgres on
a poll loop and would otherwise keep grinding queued runs invisibly on an
expired license; (2) load the run context and the compiled plan blob
(`wdb.LoadRunContext`, `wdb.LoadCompiledPlanRef` + `Store.Get` +
`storage.DecodePayload` + `plan.ParseCompiled`), failing the step with a
distinct `WF_LOAD_PLAN_REF`/`WF_LOAD_PLAN`/`WF_DECODE_PLAN`/`WF_PARSE_PLAN`
code per failure point; (3) flip `workflow_run`/`workflow_step_run` to
`running` (idempotent `UPDATE ... WHERE status IN (...)`, so a second
worker racing the same row is a no-op) and emit `run_started`/`step_started`
run events exactly once, on the actual transition; (4) compute an absolute
`timeout_at` via `computeStepTimeoutAt` and stamp it on the row for the
engine sweeper; (5) find the step's compiled `plan.Step` by `NodeID` and
`switch` on `step.AdapterKey` (`llumen.runner.query` → `runSource`,
`llumen.transform` → `runTransform`, `llumen.agent`/`llumen.output_agent` →
`runAgent(..., isOutput)`, `llumen.action` → `runAction`, `llumen.ml_model` →
`runMLModel`, `llumen.ml.predict` → `runMLPrediction`, `llumen.asset` →
`runAsset`, `llumen.create_asset` → `runCreateAsset`, `llumen.dataset_output` →
`runDatasetOutput`, `llumen.wait` → `runWait`, `llumen.stop_error` →
`runStopError`, `llumen.noop` → `runNoop`; an unrecognized key fails with
`WF_ADAPTER_UNSUPPORTED`). Each per-kind runner is responsible for its own
transactional persist of the step's result.

**Metrics.** `HandleStep` increments the `wmetrics.WorkflowWorkerActiveSteps`
gauge for the duration of processing (SRE saturation signal, paired with
the engine's `workflow_worker_lease_reclaims_total`) and observes
`WorkflowStepDurationSeconds(ticket.NodeKind)` on exit; a separate
`WorkflowRunQueueWaitSeconds` histogram fires exactly once per run, the
first time a step flips it out of `queued`, computed from `queued_at`
rather than threaded through the lease payload.

**Side effects.** `HTTP` and `SMTPSender` interfaces let tests stub
`send_api_request` / `send_email` actions without a real network/SMTP
port; production defaults are described in the `Executor` struct's field
comments (`EnvSMTPSender{}` reading `WORKFLOW_SMTP_*` env vars, a default
`http.Client` with a bounded timeout). `Backend` (the worker's client for
content's internal routes, `worker/internal/backendclient` — the name is
kept), `MLInference`, and `Supabase` are all optional collaborators consulted only by specific
adapters (`llumen.ml_model`, ML prediction, and Slides output persistence
respectively) and degrade to an explicit error code or a graceful
`created_entity_id: null` rather than panicking when nil — see the
corresponding field comments in `executor.go` for the exact fallback per
field.

**Registered-model scoring.** `runMLModel` downloads the upstream Parquet,
converts its rows to the internal batch-predict request, calls content's
`POST /api/content/internal/v1/ml-models/batch-predict` (through the `Backend`
client) with the compiled model ID and feature mapping, and persists the
returned Parquet as the step's default artifact. This does not make ML
scoring authorable by the Agent: the compiled runtime sends the model ID and
feature mapping but does not bind or verify the SDK-reviewed target, prediction
type, or prediction-column name. That separate output-contract gap is recorded
as `WF_CAP_AGENT_ML_MODEL_OUTPUT_CONTRACT_UNAVAILABLE`.

**Deterministic position merge.** A combine-by-position transform carries one
to four explicit `(column, asc|desc)` order terms for each of exactly two input
slots. Before executing the compiled full-outer positional SQL,
`executeSQLTransform` probes each input view for duplicate ordered identities.
Duplicates fail closed with
`WF_TRANSFORM_MERGE_POSITION_IDENTITY_NOT_UNIQUE`; a malformed or failed probe
is also fatal. The error names the slot but never logs identity values or raw
SQL. This guard prevents byte-identical or null-key duplicates from being paired
arbitrarily across runs.

## Critical paths

1. **Step ticket** — DB lease → `HandleStep` → adapter dispatch → transactional persist (see function body for `pgx` usage).

## Step output ("handle") shape

There is no typed "handle" object passed between steps — a completed step's
result is a `workflow_step_output` row (`channel_key`, `payload_kind`,
`payload_format`, pointer to a `workflow_artifact`) plus the referenced
`workflow_artifact` row itself. Downstream steps resolve their wired inputs
by reading these two tables, not an in-memory handle.

`workflow_payload_kind` has five enum values (`supabase/migrations/002_enums.sql`):
`table`, `document`, `message`, `artifact`, `control` — but only `table`,
`document`, and `control` are actually written by current worker code;
`message` and `artifact` are dormant (declared in the enum, no runtime path
currently produces them). Don't assume a node kind can emit `message`- or
`artifact`-kind output today just because the enum allows it.

Preview truncation thresholds (row/byte caps shown in the builder's output
preview) are hardcoded in `worker/internal/worker/preview.go`, not exposed as
an env var or per-workflow config.

## Per-node settings the worker actually honors

`worker/internal/plan/plan.go` compiles each step's policy into an opaque
`Policy json.RawMessage` blob. **All of it is now read.** This section used to
say the opposite, and correctly: for a long time the only consumer was
`computeStepTimeoutAt` reading `timeoutSeconds`, while the builder's Settings
panel rendered four other controls that nothing honoured.

Every policy reader now lives in **one** file,
`worker/internal/worker/steppolicy.go`. That is deliberate: the same key gets
read from several unrelated places — the failure path, the readiness
predicate, both transform engines, the agent adapters — and a second decoder
is exactly how "the UI writes `retryOnFail`, the compiler emits `retryMode`"
happened. `timeoutSeconds` is the one exception, still read by
`computeStepTimeoutAt` in `executor.go`, which predates the file.

The shared discipline across every reader: **an unreadable policy decodes to
the OLD behaviour, never the new one.** An empty policy, malformed JSON, a
missing key, a wrong JSON type and a value the engine never emits all collapse
to the conservative default. A policy we cannot parse must not start
unblocking downstream steps or emitting extra channels.

### `timeoutSeconds`

Unchanged. `computeStepTimeoutAt` stamps an absolute `timeout_at` at
transition-to-running, and the engine sweeper's timeout pass enforces it. Note
it is re-stamped on **every** transition to running, so under `retryOnFail`
the compiled timeout is **per attempt**, not per step.

### `onError` — the failure/advance and readiness change

`failStepAndAdvance` (`failadvance.go`) previously always marked the failing
step `failed` and its transitive downstream `skipped`. Now:

| mode | failing step | downstream | error payload |
|---|---|---|---|
| `stop_workflow` (default) | `failed` | `skipped` (unchanged) | none |
| `continue` | `failed` | left schedulable, becomes ready | none |
| `continue_using_error_output` | `failed` | left schedulable, becomes ready | published on `default` |

**Continue required the readiness predicate to change**, which is the
riskiest part of the feature. `inputSatisfied` (`enqueue.go`) demanded the
upstream be exactly `succeeded`, so merely declining to mint `skipped` rows
would have left the descendants permanently unready. The relaxation is
deliberately narrow: a `failed` node satisfies an edge **only** when its own
compiled policy says to continue past its failure. Every other non-succeeded
status stays unsatisfied, and each exclusion is load-bearing —

- `cancelled`: the user stopped the run. `onError` is an authoring choice
  about handling *errors*, not a licence to keep working after a cancel.
- `timed_out`: owned by the engine sweeper, which is driving the run to
  `timed_out` regardless.
- `skipped`: already ruled out by an ancestor failing under `stop_workflow`.
  Treating it as satisfied would resurrect genuinely-blocked work.

`ready()` ANDs across all inputs, which is what keeps the relaxation
contained: unblocking one failed ancestor does not unblock a node whose other
ancestor is still blocking.

**Declining to mint `skipped` rows cannot hang the run.** `MaybeFinalizeRun`
counts `workflow_step_run` ROWS, so a plan node with no row contributes
nothing to `pending`. The `skipped` rows only ever existed so the UI could
render blocked nodes grey.

**The run's terminal status stays `failed`** when a step failed, even under
continue. `ClassifyRunTerminal` is mirrored in the engine sweeper, so
diverging the worker's copy would make a run's final status depend on which
finaliser won the race. Nondeterminism is worse than pessimism, and a step
did fail.

`continue_using_error_output` additionally writes the failure as the step's
`default` output (`writeErrorOutput`), following the normal output path
rather than a second one: same object-path convention, same
`writeInlineDocumentPreview`, same `workflow_artifact` +
`workflow_step_output` column lists as `writeJSONDocument`. It does **not**
touch the step's status — the step stays `failed`, which is the point. Every
error in it is swallowed after logging, and that is a correctness requirement
rather than laziness: it runs between marking the step failed and advancing
the run, so returning an error would skip the advance and strand the run with
pending rows forever.

**Reading that payload** needed the artifact loaders to change too, since
`LoadUpstreamArtifacts` / `LoadLatestArtifactsForStepNodes`
(`internal/db/claim.go`) filtered `sr.status = 'succeeded'`. They now also
admit `failed` steps, gated on a **node allowlist** the worker builds from the
compiled policy (`errorOutputNodeIDs`, `continue_using_error_output` only). A
blanket `status IN ('succeeded','failed')` was rejected: it would also expose
the partial `default` output an adapter may have written before failing later
in its run, and would do so under plain `continue` too, where the author asked
for the downstream to run but not to be fed.

The loaders also gained a tie-break, because `(node, channel)` is not unique
across a run once `attempt_no` can exceed 1: `preferUpstreamRow` ranks
`succeeded` above `failed` regardless of which finished later, so a retry that
eventually succeeded can never be shadowed by its own earlier error output.

### `alwaysOutputData`

Read by `skipEmptyChannels(step)`, the single decision both transform engines
consult (`executeJQTransform` → `materializeJQOutput`, `executeSQLTransform` →
`buildSQLOutputQueries`) before dropping a channel that produced no rows, plus
`runClassificationAgent` for its per-category channels.

Only a **branching** kind ever skips an empty channel, and that skip is how
branching works — `inputSatisfied` gates on the channel key, so only the taken
branch's downstream becomes ready. Turning the toggle on therefore means every
branch fires. Everything else in the runtime already emits an empty output on
zero rows (source steps, non-branching transforms, `noop`, `wait`, empty
`dataset_output`), so the toggle is a no-op for them.

One latent bug was fixed here: `runClassificationAgent` with zero input rows
logged "emitting empty outputs" and emitted none, leaving every category
branch never enqueued **and** never skipped while the run still finalised
`succeeded`. It now emits one empty output per category when the toggle is on.

### `retryOnFail` / `retryMaxAttempts` / `retryDelaySeconds`

`maybeRetryStep` (`failadvance.go`) runs **before** anything is marked
`failed`, so `onError` only ever sees the final failure. Ordering: **retries
exhaust first, then `onError` applies.**

The claim that no step-retry infrastructure existed was not quite right — the
engine sweeper's `sweepExpiredLeases` already implements one for lease
expiry, and the retry path deliberately mirrors its shape rather than
inventing a second:

- **Same row, `attempt_no` bumped in place.** A second `workflow_step_run`
  row was the obvious alternative and is wrong: `MaybeFinalizeRun` and
  `ClassifyRunTerminal` count rows, so the first attempt's `failed` row would
  survive and classify the run `failed` even after the retry succeeded.
- **`worker_id` / `heartbeat_at` / `started_at` / `timeout_at` nulled**, plus
  `error_code` / `error_message` / `finished_at`. Nulling `timeout_at` is
  load-bearing: the worker re-stamps it on every transition to `running`, so
  leaving the old absolute deadline behind would make the sweeper fire
  against a step that has not started yet.
- **`status = 'waiting'` with a future `lease_expires_at`**, which is the one
  difference from the sweeper's immediate `queued` requeue. `queued` has no
  time gate in the claim query, so the delay needs the `waiting` branch
  (`sr.status = 'waiting' AND sr.lease_expires_at <= NOW()`). **No worker slot
  is held for the backoff** — the worker returns immediately and any worker
  re-claims the row when the lease elapses. `waiting` also counts as pending
  in `MaybeFinalizeRun`, so the run stays open, and the cancel sweeper already
  covers `waiting` rows, so cancelling during a backoff works.
- **`wait_kind = 'retry_backoff'`** discriminates the backoff from an
  `llumen.wait` node's own deferral. This is not cosmetic: `runWait` reads
  `PriorStatus == "waiting"` as "the interval elapsed, complete the step", so
  without the marker a retried wait node would be completed instead of
  re-run. The column exists for exactly this and already carries
  `chat_response`. It is cleared on the way to `running` so a retry marker
  cannot outlive its backoff.

**`retryMaxAttempts` counts TOTAL attempts** (`attemptNo < MaxAttempts`,
1-indexed), matching the sweeper's `if p.attempt < ceiling`. Both budgets
bound the **same** `attempt_no` column, so a node that burned attempts on
`retryOnFail` has fewer lease-expiry requeues left and vice versa. That
sharing is deliberate and bounded in the safe direction — it can only reduce
the total, never multiply it. Independent counters would need a second column,
i.e. a schema change.

The worker re-clamps every parameter rather than trusting the blob it did not
compile: a hand-edited or downgraded-engine policy must not produce a
10000-attempt loop or a multi-hour backoff. `p == nil` callers (the license
gate, plan load/decode/parse failures) never retry — those are not transient.
Every failure inside the requeue falls through to the ordinary failure path;
failing a step that could have been retried is visible and recoverable, while
parking a step that was never actually requeued would strand the run.

`decodeRetryPolicy` decodes key-by-key through a `map[string]json.RawMessage`
rather than into a typed struct, mirroring the engine's
`decodePolicySettings`. A single `json.Unmarshal` into a multi-field struct
errors when **any** one key has the wrong type, so
`{"retryOnFail":true,"retryMaxAttempts":"seven"}` would disable retries
entirely instead of falling back to the baseline count. A test caught exactly
that.

### `executeOnce` — removed, not wired

A node cannot execute twice in one run, so there was nothing to honour. See
[builder-ui.md](builder-ui.md) for the three guarantees and the tripwire
tests that fail if a second-execution path is ever added.

## Integration map

- [source-nodes.md](source-nodes.md), [transform-nodes.md](transform-nodes.md),
  [action-nodes.md](action-nodes.md), [agent-nodes.md](agent-nodes.md) —
  the per-kind runners `HandleStep` dispatches to.
- [runs-and-executions.md](runs-and-executions.md) — the run-level view
  (finalization, cancellation) built on top of this page's per-step
  lease/execute/persist cycle.
- [engine-compile.md](engine-compile.md) — `computeStepTimeoutAt`'s
  compiled-policy input.
- [engine-sweeper.md](engine-sweeper.md) — the engine-side counterpart
  that reclaims a step whose lease this executor fails to renew.
- [artifacts-storage.md](artifacts-storage.md) — the
  `workflow_step_output`/`workflow_artifact` persistence model this
  page's "Step output" section describes.

## Validation checklist

- Read entire `HandleStep` when adding new `wait_kind` values or terminal state transitions.
- `retry_backoff` is now a `wait_kind`. A new one must not collide with
  `runWait`'s "PriorStatus == waiting means the interval elapsed" reading.
- Changes to `inputSatisfied` or `MaybeFinalizeRun` need a test that would
  fail without them AND a mutation check. A hanging run is worse than a
  failing one.
- Verified against commit `c9e9a1231de73d1f304c2016849f07b2625b915b`.
