---
topic: workflows
services: [engine]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Engine sweeper

## Audience and goal

The engine's in-process background loop (`service.Sweeper`) that
reclaims expired step leases, enforces step/run timeouts, settles
cancellations, cleans up stranded rows, and purges retention-expired
runs. Distinct from workflow-schedule *firing*, which the sweeper never
does — see [engine-scheduler.md](engine-scheduler.md) for that split.

## Read first

- `engine/internal/service/sweeper.go` — `Sweeper.Tick`, the five passes
  (`sweepExpiredLeases`, `sweepStepTimeouts`, `sweepCancellingRuns`,
  `sweepStrandedTerminalRunSteps`, `sweepExpiredRuns`).
- `engine/internal/config/config.go` — `SweeperInterval`,
  `SweeperMaxAttempts` (`WORKFLOW_SWEEPER_INTERVAL_SECONDS` default
  15s, `WORKFLOW_SWEEPER_MAX_ATTEMPTS` default `3` — the single global
  retry ceiling; there is no per-node retry policy, see
  [worker-executor.md](worker-executor.md)).
- `engine/internal/service/runfinalize.go` — `classifyRunTerminal`, the
  priority ordering the sweeper's passes all defer to when a run has an
  independent branch that hasn't settled yet.
- [engine-scheduler.md](engine-scheduler.md) — why this is not the
  schedule-firing loop.

## How it works

`Sweeper.Tick` runs five passes every tick (`interval()`, default 15s),
each wrapped by the shared `runPass` helper (metrics + error
aggregation so one pass's failure doesn't block the rest):

1. **`expired_leases`** (`sweepExpiredLeases`) — picks
   `workflow_step_run` rows `leased`/`running` whose
   `lease_expires_at` has passed (`FOR UPDATE SKIP LOCKED`, batch size
   `batchSize()` default 50). If `attempt_no < maxAttempts()` the step
   is requeued (`status='queued'`, lease/timeout columns nulled,
   `attempt_no` incremented) for the worker to retry. Once the retry
   ceiling is exhausted the step is terminalized `failed` with
   `error_code='WF_LEASE_EXPIRED'` and the shared failure cascade
   (`terminalizeStepCascadeTx`) skips its transitive descendants while
   independent branches keep running — the run itself is **not**
   force-flipped; it reaches its terminal status later, through the
   same `finalizeRunTx` path documented in
   [runs-and-executions.md](runs-and-executions.md), once every step
   has settled.
2. **`step_timeouts`** (`sweepStepTimeouts`) — distinct from lease
   reclaim: a step can have a perfectly healthy heartbeat and still
   overrun its compiled `timeout_at` (see
   [engine-compile.md](engine-compile.md) "Per-step timeout policy").
   Overrunning steps are forced to `timed_out`; descendants become
   `skipped` via the same cascade helper. The run settles to
   `timed_out` rather than `failed` **unless** an independent branch
   already failed first — `classifyRunTerminal` prioritises `failed`
   over `timed_out`.
3. **`cancelling_runs`** (`sweepCancellingRuns`) — the settle phase of
   two-phase cancellation (see [runs-and-executions.md](runs-and-executions.md)
   "Cancellation"): once every `leased`/`running` step of a
   `cancelling` run has exited, this pass finalizes the run to
   `cancelled`.
4. **`stranded_terminal_steps`** (`sweepStrandedTerminalRunSteps`) —
   cleans up steps left in a non-terminal row state whose run has
   already gone terminal by some other path, so a rare ordering race
   doesn't leave orphaned `queued`/`leased` step rows on a finished run.
5. **`retention`** (`sweepExpiredRuns`) — purges runs whose
   `retain_until` has passed and whose `retention_class <> 'pinned'`,
   batch size `retentionBatchSize()` (default 10). A run is skipped if
   another surviving run replays from it (`source_run_id`) or an
   *active* retry chain still references it (`retry_of_run_id` with the
   child not yet terminal) — terminal retries don't keep the parent
   alive. `purgeRun` first deletes every object-storage blob the run
   references (compiled plan, authored doc, step outputs, artifacts,
   event bundles — logged-but-non-fatal on failure, since leaving a
   blob is safer than leaving a DB row) and then `DELETE FROM
   workflow_run`, relying on FK cascades for `step_run`/`step_output`/
   `artifact`/`event`/`action_outbound`; `workflow_document` rows are
   deleted explicitly since documents can outlive a run and aren't part
   of the cascade graph.

**No Redis in this runtime.** The workflow engine/worker runtime does
**not** use Redis anywhere. A long-superseded design comment in
`engine/internal/service/compiledcache.go` notes Redis was floated as a
"Phase-2 optimisation" for the compiled-plan cache, but no such
integration was ever built — the compiled-plan cache is in-process
only. There are no `workflow_redis_hits_total` /
`workflow_redis_misses_total` metrics or any other Redis-backed caching
in this runtime; don't confuse this with the runner's source-query
cache (which does use Redis) or the realtime service's Redis Streams
hub — those are different subsystems.

## Critical paths

1. **Lease reclaim** — worker crashes or stalls mid-step →
   `lease_expires_at` passes → next `Tick`'s `sweepExpiredLeases` either
   requeues (attempt budget remains) or fails the step and cascades.
2. **Timeout** — a step runs past its compiled `timeout_at` while still
   heartbeating → `sweepStepTimeouts` forces `timed_out` + cascade.
3. **Cancel settle** — `RunCanceller.Cancel` flips a run to `cancelling`
   → in-flight steps exit on their own heartbeat check → next `Tick`'s
   `sweepCancellingRuns` finalizes the run once nothing is left running.
4. **Retention purge** — `workflow_run.retain_until` passes →
   `sweepExpiredRuns` picks it up (unless a live replay/retry still
   points at it) → `purgeRun` deletes storage objects then the DB row.

## Configuration and operations

- `WORKFLOW_SWEEPER_INTERVAL_SECONDS` — tick interval, default 15s
  (`Sweeper.interval()`).
- `WORKFLOW_SWEEPER_MAX_ATTEMPTS` — global per-step retry ceiling,
  default 3 (`Sweeper.maxAttempts()`); there is no per-node override.
- Batch sizes are constructor fields, not separate env vars as of this
  writing: `Sweeper.batchSize()` defaults to 50 (lease/timeout/cancel
  passes), `Sweeper.retentionBatchSize()` defaults to 10 (retention
  pass) — both fall back to these defaults whenever the corresponding
  struct field is `<= 0`.
- Retention itself (`retain_until`, `workflow_retention_class`:
  `standard`/`debug_short`/`pinned`) is set at run-creation time
  elsewhere in the engine, not by the sweeper — the sweeper only
  enforces the deadline once it has passed.

## Failure modes and edge cases

- **Lease-expired, retry budget exhausted** —
  `error_code='WF_LEASE_EXPIRED'`, step `failed`, cascade skips
  descendants, independent branches unaffected.
- **Step timeout with an already-failed sibling branch** — run settles
  `failed`, not `timed_out` (`classifyRunTerminal` priority order).
- **One sweeper pass fails** — `runPass`'s wrapping means the remaining
  four passes still run that tick; the failure is aggregated, not
  silently swallowed.
- **Retention purge failure on one run** — logged and skipped; does not
  stall the rest of the retention batch (`sweepExpiredRuns` continues
  the loop over `runIDs`).
- **A run referenced by a still-active retry** — retention leaves the
  parent alone until the retry chain itself goes terminal.

## Integration map

- [engine-scheduler.md](engine-scheduler.md) — the other in-engine
  background concern; explicitly *not* the same loop as the sweeper.
- [runs-and-executions.md](runs-and-executions.md) — run finalization
  (`finalizeRunTx`/`classifyRunTerminal`) and the two-phase cancel
  contract the sweeper's `cancelling_runs` pass completes.
- [engine-compile.md](engine-compile.md) — per-step `timeout_at`
  compilation, which `sweepStepTimeouts` enforces at runtime.
- [worker-executor.md](worker-executor.md) — the lease/heartbeat cycle
  the sweeper reclaims when a worker goes silent.
- [artifacts-storage.md](artifacts-storage.md) — the object-storage
  paths `purgeRun` deletes during retention.

## Validation checklist

- `engine/internal/service/sweeper_failcascade_test.go`,
  `engine/internal/integration/sweeper_failure_cascade_test.go`,
  `engine/internal/integration/sweeper_stranded_terminal_test.go`,
  `engine/internal/httpapi/sweeper_liveness_test.go` — re-run after
  touching `Tick`/`runPass` or any individual pass.
- Property tests referenced in worker executor comments
  (`timeout_property_test.go`) relate to sweeper-visible deadlines — run
  when changing timeout math.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
