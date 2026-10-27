---
topic: workflows
services: [config, content, engine, runner, supabase, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow deployment and operations

## Audience and goal

Operating the workflow runtime — the `engine` (request/response API) and
`worker` (queue-pulling executor) — in a deployed (Kubernetes/Helm) cluster:
rollout order, secret bootstrap, post-deploy smoke tests, and rollback. This
page covers the workflow-specific runtime contract; general Helm/K8s
authoring lives in [../deployment/overview.md](../deployment/overview.md).

## Read first (ordered)

1. `engine/internal/httpapi/server.go` — route table incl. `/health`,
   `/ready`, `/live/sweeper`.
2. `engine/internal/config/config.go`, `worker/internal/config/config.go` —
   required/optional env vars.
3. `deploy/charts/engine/`, `deploy/charts/worker/`, `deploy/charts/llumen/`
   (umbrella) — Helm subcharts.
4. `config/pkg/deploycontract/values_service.go` — llumen-config operator app
   emits engine/worker Helm values from a single source of truth.
5. [internal-api.md](internal-api.md), [engine-sweeper.md](engine-sweeper.md).

## How it works

**Service map.** Default container ports: frontend `3000`, content `8089`,
runner `8081`, agent `8082`, engine `8085`, worker `8091` (probes/metrics
only — the worker pulls work from the database; nothing should send it a
request). In-cluster K8s Service DNS follows `<release>-<service>:<port>`.

**Rollout order.** For both clean installs and upgrades: (1) provision
cluster prerequisites, (2) bootstrap the `ENGINE_API_KEY` shared secret
before any engine/worker pod starts (they crash-loop with `missing
ENGINE_API_KEY` otherwise, per `engine/internal/config/config.go`'s
`Load`), (3) provision the Supabase Storage bucket named `workflow` (see
below), (4) apply database migrations (current baseline:
`supabase/migrations/` + `supabase/deltas/`, applied via `make reset-db` /
`make apply-deltas` — see
[schema-baseline-and-deltas](../data/schema-baseline-and-deltas.md); do not
look for the old numbered `038_workflow_enums.sql` / `039_workflow_tables.sql`
files an older revision of this doc cited — the baseline has since been
squashed into `000_`-`011_`), (5) deploy the umbrella chart with engine+worker
enabled, (6) wait for both to report `Ready` on `/health`+`/ready`, (7) run
the post-deploy smoke checks below. **Never upgrade the worker ahead of the
engine** — downgrade order is the reverse: quiesce workers (scale to 0, wait
for in-flight leases to drain) before rolling the engine backwards.

**Bucket provisioning.** The workflow runtime stores chat artifacts and
step I/O snapshots in a single Supabase Storage bucket named `workflow`. The name
is a compiled-in constant in content, the engine, worker, runner and the
**storage service** — there is nothing to configure, and nothing for an operator
to keep in sync (see [../data/object-storage.md](../data/object-storage.md)). The
storage service provisions the bucket on startup
(`storage/internal/bootstrap`), in every environment including local dev; no seed
step or manual `supabase storage buckets create` is needed.

**Worker → agent service env contract.** Workflow nodes with `kind=agent`
dispatch through the agent service; the worker is the only caller on this
path (the engine never talks to agent directly). Three env vars, emitted by
both `deploy/charts/worker/values.yaml` and the umbrella chart:

- `AGENT_SERVICE_URL` — when empty, `deploy/charts/worker/templates/deployment.yaml`
  resolves it via a `$agentURL` ternary to `http://<release>-agent:8082`.
  Trailing `/` is stripped at load. When unset *and* unresolved, a
  worker with `ENVIRONMENT=development` falls into stub agent mode
  (`agentclient.IsStub() == true`) and every agent node emits a
  deterministic placeholder; any other `ENVIRONMENT` refuses to start —
  see [agent-nodes.md](agent-nodes.md).
- `AGENT_SERVICE_API_KEY` — sent as `X-Agent-API-Key`; reuses the shared
  `AGENT_API_KEYS` secret the agent service itself accepts (no second key
  needed). Required outside development.
- `AGENT_SERVICE_TIMEOUT_SECONDS` — default `120` in Helm values (worker's
  own Go default when unset entirely is `300`, see
  [local-dev.md](local-dev.md)); the Go client clamps to 60s only when the
  parsed timeout is `<= 0`.

**Secret bootstrap.** `ENGINE_API_KEY` authenticates the content → engine
internal API boundary (`X-Engine-Key`; the runner uses it too). Unlike the
plural, rotation-window `RUNNER_API_KEYS` / `AGENT_API_KEYS`
(`runner/internal/config/config.go` `RunnerAPIKeys: splitCSV(...)`), the
engine's `config.go` reads exactly one `ENGINE_API_KEY` value. Rotation:
update the shared secret, roll the engine deployment first (starts accepting
the new key), then roll content (and the runner) so new pods use it — there
is a brief overlap window where old-key caller pods can't reach new-key engine
pods.

**Webhook secrets at rest.** `workflow_webhook_secret.secret_value` is
Fernet-encrypted with `CONNECTION_ENCRYPTION_KEY` (content's copy of the same
key that protects AI model API keys, SMTP passwords, and datasource connection
details). Encryption happens at content's `PUT
/api/content/v1/workspaces/{workspace_id}/flow-definitions/{definition_id}/webhook-bindings/{trigger_node_id}/secret`
(`content/internal/api/handlers/flow_triggers.go`, sealing with
`flowwebhook.SealSecret`); decryption happens at ingress in
`flowwebhook.ResolveSecret` immediately before the constant-time compare
against the inbound credential. A stored value that does not decrypt is
**not** used as plaintext: it is reported as not provisioned, so the binding
refuses until its owner sets the secret again. There is no automatic rekey
pass — rotating `CONNECTION_ENCRYPTION_KEY` requires re-running the secret-set
endpoint for every webhook binding.

## Critical paths

1. **Post-deploy smoke — engine.** `GET /health` (unconditional `{"status":"ok"}`)
   and `GET /ready` (DB ping, `{"status":"ready","service":"engine"}`) on port
   `8085`. `GET /live/sweeper` (`engine/internal/httpapi/server.go`
   `liveSweeper`, test coverage in `sweeper_liveness_test.go`) returns `200
   {"status":"live", "last_tick_at", "age_seconds", "threshold_seconds"}` when
   the sweeper ticked within `3 × WORKFLOW_SWEEPER_INTERVAL`, else `503
   {"status":"stale", ...}`. Point a **separate** liveness probe at this
   endpoint (not the pod's main one) — a DB outage stalling the sweeper would
   otherwise restart every engine pod.
2. **Post-deploy smoke — worker.** `GET /health` / `GET /ready` on port
   `8091`; `/ready` hits the same DB pool the queue poller uses.
3. **Post-deploy smoke — end to end.** Trigger any workflow via the frontend
   or `POST /api/workflows/<id>/run`, poll until a terminal status
   (`succeeded`/`failed`/`cancelled`/`timed_out`/`skipped`).
4. **Rollback.** Scale worker to 0 first, wait `2 × WORKFLOW_LEASE_TTL_SECONDS`
   (default 120s → 4 min) for held leases to expire, `helm rollback`, then
   scale the worker back up once the engine is stable. Never roll the engine
   forward while an old-version worker still runs against it.

## Configuration and operations

Sweeper metrics (`engine/internal/metrics/registry.go`; confirmed present):
`workflow_sweeper_ticks_total{result="ok|error"}` (counter),
`workflow_sweeper_rows_total{pass=...}` (counter; passes are
`expired_leases`, `step_timeouts`, `cancelling_runs`,
`stranded_terminal_steps`, and `retention` — see
`engine/internal/service/sweeper.go` `runPass` call sites),
`workflow_sweeper_pass_duration_seconds{pass=...}` (histogram),
`workflow_sweeper_last_tick_unix_seconds` (gauge). A sustained non-zero rate
on the `expired_leases` pass suggests a worker-side regression (workers not
completing/renewing leases).

`workflow_step_run.timeout_at` is the absolute deadline enforced by the
engine's `sweepStepTimeouts` pass (`engine/internal/service/sweeper.go`); the
worker stamps it at transition-to-running (from the step's compiled
`timeoutSeconds` policy) and at transition-to-waiting for chat prompts (from
`WORKFLOW_CHAT_PROMPT_TIMEOUT_SECONDS`, default 7 days —
`worker/internal/config/config.go` `ChatPromptTimeout`).

## Failure modes and edge cases

| Scenario | Expected behavior |
|---|---|
| Engine pod killed mid-run | Worker lease expires after `WORKFLOW_LEASE_TTL_SECONDS`; engine sweeper re-queues on next tick |
| Worker pod killed mid-step | Same lease path; another worker replica picks up the step |
| Both engine replicas killed simultaneously | Content → engine 5xx until a replica returns; DB state untouched |
| Wrong `ENGINE_API_KEY` on content | Content → engine returns 401; the Flow route fails until the key is fixed and content restarts |
| Missing `workflow` storage bucket | Engine/worker log `bucket not found`; runs fail fast |

## Integration map

- [internal-api.md](internal-api.md) — the HTTP contract these deploys expose.
- [engine-sweeper.md](engine-sweeper.md) — lease reclaim, retention, and the
  `/live/sweeper` probe this page operationalizes.
- [local-dev.md](local-dev.md) — the same env vars in an unclustered dev
  setup.
- [agent-nodes.md](agent-nodes.md) — stub-mode behavior referenced above.

## Validation checklist

- After `helm upgrade`, verify the rendered worker Deployment carries all
  three `AGENT_SERVICE_*` vars.
- `RUNNER_API_KEYS` and `AGENT_API_KEYS` are independent secrets — rotating
  one does not affect the other.
- `engine/internal/httpapi/sweeper_liveness_test.go` covers `/live/sweeper`;
  re-run after touching the sweeper tick loop.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
