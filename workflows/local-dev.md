---
topic: workflows
services: [content, engine, supabase, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow local development

## Audience and goal

Running content, engine, worker and runner together on a developer
machine for workflow feature work. Default ports (see each service's
`internal/config/config.go`): content `8089`, engine `8085`, runner
`8081`, worker `8091` (health; otherwise polls the DB, no request port).
Prefer `make run-content` / `make run-engine` / `make run-worker` /
`make run-runner` over ad-hoc commands. Generic cross-service DX concerns
(the `Makefile`, OpenAPI, general auth failure modes) live on
[../dx/workflow-local-dev.md](../dx/workflow-local-dev.md); this page is
workflow-specific bootstrap and env-var wiring.

## Read first

- Repository `Makefile` — `run-content`, `run-engine`, `run-worker`,
  `run-runner`.
- `content/internal/config/config.go`, `engine/internal/config/config.go`,
  `worker/internal/config/config.go` — each service's config.
- [../dx/workflow-local-dev.md](../dx/workflow-local-dev.md) — generic
  DX page (`Makefile`, OpenAPI, auth failure modes).

## How it works

A workflow run touches four services with no shared in-process state:
the **content** service (Go, `:8089`) owns the Flow authoring, definition,
run, chat, webhook and assistant-proposal routes and brokers to the engine;
the **engine** (Go, `:8085`) compiles versions and owns run/step-run
persistence; the **worker** (Go, no request port — it polls the DB for
leasable steps) executes steps and calls out to the **runner** (`:8081`,
source queries), the agent service (LLM/GraphRAG steps) and content's
internal routes (create-asset, ML batch-predict). Locally these are separate
processes sharing one Postgres (`DATABASE_URL`) and one Supabase Storage
bucket (the fixed `workflow`); there is no local message broker or shared
cache in this path (see [engine-sweeper.md](engine-sweeper.md) "No Redis in
this runtime"). Each service validates its own required env vars at startup
and fails fast rather than degrading silently — see the worker's
`RUNNER_SERVICE_URL`/`RUNNER_SERVICE_API_KEY` requirement below.

## Environment variables

Shared across engine/worker: `DATABASE_URL` (Postgres), `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The workflow objects live in the fixed
`workflow` bucket — a compiled-in constant in every service, with no env var
— provisioned by the Go storage service at startup
(`storage/internal/bootstrap`).

Inter-service (verified in `content/internal/config/config.go` and
`worker/internal/config/config.go`):

| Variable | Used by | Purpose |
|---|---|---|
| `ENGINE_INTERNAL_URL` | content | Engine base URL for every Flow route, including chat, the webhook ingress and assistant proposals (`content/internal/engine/client.go`) |
| `ENGINE_API_KEY` (alias `WORKFLOW_ENGINE_API_KEY` on the engine) | content, runner, engine | `X-Engine-Key` header when non-empty |
| `CONTENT_SERVICE_URL` + `INTERNAL_API_SECRET` | worker | Content's internal routes behind `create_asset` and `ml_model` steps (`X-Internal-API-Secret`); unset makes those steps fail, the worker still starts |
| `RUNNER_SERVICE_URL` | worker | Runner base URL — **required** at worker startup (`config.Load` errors `RUNNER_SERVICE_URL is required` if empty) |
| `RUNNER_SERVICE_API_KEY` | worker | `X-Runner-API-Key` — **required** at worker startup |
| `RUNNER_SERVICE_TIMEOUT_SECONDS` | worker | HTTP client timeout (worker default 120s) |
| `AGENT_SERVICE_URL` | worker | Agent base URL. When empty, `agentclient.New` returns a client with `IsStub() == true` that answers deterministically instead of calling the agent service — see [agent-nodes.md](agent-nodes.md) and `worker/internal/agentclient/client.go`. Not required at startup. |
| `AGENT_SERVICE_API_KEY` | worker | `X-Agent-API-Key`; optional locally when the agent process itself has no `AGENT_API_KEYS` configured |
| `AGENT_SERVICE_TIMEOUT_SECONDS` | worker | HTTP client timeout for agent calls, default 300s (see [data-analyst-node.md](data-analyst-node.md) for why this default was raised from 120s) |
| `WORKFLOW_WORKER_ID` | worker | `workflow_step_run.worker_id` lease owner, default `worker-1` |
| `WORKFLOW_LEASE_TTL_SECONDS` | worker | Lease duration, default 120s |
| `WORKFLOW_WORKER_POLL_MS` | worker | Idle poll interval, default 500ms |
| `WORKFLOW_SWEEPER_INTERVAL_SECONDS` / `WORKFLOW_SWEEPER_MAX_ATTEMPTS` | engine | Sweeper tick/retry ceiling — see [engine-sweeper.md](engine-sweeper.md) |

## Bootstrap checklist

1. `make reset-db` (applies the current baseline + deltas under
   `supabase/migrations/` and `supabase/deltas/` — see
   [schema-baseline-and-deltas](../data/schema-baseline-and-deltas.md);
   storage buckets are provisioned separately, see above).
2. Run `make gen-env` so every service's `.env` shares the same secrets.
3. Start `storage` (`make run-storage`) so the `workflow` bucket exists.
4. Start `content` (`make run-content`) with `ENGINE_INTERNAL_URL` and
   `ENGINE_API_KEY` set.
5. Start `runner` (`make run-runner`) with a valid `RUNNER_API_KEYS`
   matching `RUNNER_SERVICE_API_KEY`.
6. Start `engine` (`make run-engine`) with `DATABASE_URL`,
   `SUPABASE_*`, optional `ENGINE_API_KEY`.
7. Start `worker` (`make run-worker`) with DB, Supabase,
   `RUNNER_SERVICE_URL`/`RUNNER_SERVICE_API_KEY` (required),
   `CONTENT_SERVICE_URL` + `INTERNAL_API_SECRET`, and — for live (non-stub)
   agent nodes — `AGENT_SERVICE_URL` + `AGENT_SERVICE_API_KEY`.

## Critical paths

1. **Author + publish** — content serves the builder API as the caller
   (RLS decides); a save and a publish call the engine
   (`ENGINE_INTERNAL_URL`) to compile and materialize triggers (see
   [engine-compile.md](engine-compile.md), [engine-scheduler.md](engine-scheduler.md)).
2. **Run** — content (manual runs, Flow chat, the webhook ingress) or the
   engine scheduler creates a `workflow_run` via the engine; the worker
   polls Postgres for leasable steps and executes them, calling the runner
   for `source` steps and the agent service for agent-kind steps.
3. **Local-only shortcut** — with `AGENT_SERVICE_URL` unset, agent
   nodes run against the worker's built-in stub client instead of a
   live agent process, so workflow feature work that doesn't touch
   agent-node behavior doesn't require running the agent service at
   all.

## Configuration and operations

See the Environment variables table above; there is no separate
config file beyond each service's own `config.Load` reading these
variables. Ports are configurable per service via `PORT` but default as
listed in Audience and goal.

## Failure modes and edge cases

- **Worker started without `RUNNER_SERVICE_URL`/`RUNNER_SERVICE_API_KEY`**
  — `config.Load` fails fast at startup rather than starting in a
  degraded state.
- **Inconsistent `ENGINE_API_KEY`/`WORKFLOW_ENGINE_API_KEY` across
  processes** — content's calls to the engine are rejected at the
  `X-Engine-Key` check; symptoms show up as engine `401`s on
  publish/run-create rather than at worker startup.
- **`AGENT_SERVICE_URL` unset** — not a failure: agent nodes silently
  run in stub mode (`IsStub() == true`), which can mask a real
  agent-integration bug in local testing if you forget it's unset.
- **Storage bucket not provisioned** — publish/run creation fails when
  the engine, worker or content try to read/write the `workflow` bucket.
  The Go storage service creates it on startup, so start it
  (`make run-storage`, or `make run-all` which includes it) and check its
  `component=bootstrap` logs. `make reset-db` alone does **not** create
  buckets.

## Integration map

- [../dx/workflow-local-dev.md](../dx/workflow-local-dev.md) — generic
  cross-service DX (Makefile, OpenAPI, general auth failure modes) this
  page doesn't duplicate.
- [engine-compile.md](engine-compile.md), [engine-scheduler.md](engine-scheduler.md)
  — what publish wires up once the engine is reachable.
- [worker-executor.md](worker-executor.md) — the poll/lease loop this
  page's worker bootstrap step starts.
- [agent-nodes.md](agent-nodes.md) — the stub-mode behavior when
  `AGENT_SERVICE_URL` is unset.
- [deployment.md](deployment.md) — the production counterpart of this
  local topology (Helm-managed, not `make run-*`).

## Validation checklist

- Ensure local `.env` files share consistent `ENGINE_API_KEY` /
  `WORKFLOW_ENGINE_API_KEY`, `INTERNAL_API_SECRET`, `RUNNER_SERVICE_API_KEY`,
  and Supabase keys across processes (`make gen-env` writes them).
- Confirm `RUNNER_SERVICE_URL`/`RUNNER_SERVICE_API_KEY` are set before
  starting the worker — `config.Load` fails fast otherwise.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
