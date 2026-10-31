---
topic: workflows
services: [agent, config, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Data Analyst workflow node

## Audience and goal

The `data_analyst_agent` node (builder label **Data Analyst**, category
*Analysis Agents*) runs the Infusion `data_analyst` subagent
non-interactively inside a workflow. It **diagnoses** upstream data —
baselines, thresholds, correlations, patterns — and returns an
evidence-backed **verdict document**. It authors no content and persists
no entity.

It shares the non-interactive runtime with the slides/briefing output
nodes ([output-agents.md](output-agents.md)) but differs in three ways
that matter: it mints its own owner session, it persists nothing, and its
failures are **fatal** rather than lenient.

Its Worker runner shares one verdict path, `runDiagnosticWorkflowAgent`,
with the GIS correlation node ([gis-correlation-node.md](gis-correlation-node.md)).

## Read first (ordered)

1. `agent/src/agents/workflow/workflow_output_agent.py` — the shared
   entry point. `_SUBAGENT_KEY_BY_KIND` maps the wire `kind` to a
   subagent key; the analyst branch returns early from a
   `langchain.agents.create_agent` build.
2. `agent/src/services/workflow_owner_session.py` —
   `mint_workflow_owner_session(workflow_run_id)` and
   `revoke_workflow_owner_session(session)`, in the agent's own process.
3. `worker/internal/worker/agent_runtime.go` — `dispatchAgentKind`
   routes `data_analyst` to `runDataAnalystWorkflowAgent`.
4. [output-agents.md](output-agents.md) — the shared plumbing and the
   design decisions this node deliberately qualifies.
5. [ancestor-refs.md](ancestor-refs.md) — how an author feeds the node
   more than one upstream dataset.

## How it works

### Why the node needs a session (and why it is not admin)

The analyst's tools read real data through the same query paths the chat
agent uses, so they need a caller identity. The workflow runtime has no
end-user request to borrow a token from — a scheduled run has no browser
session at all.

Rather than hand the subagent's tools an admin client (which would bypass
RLS and let a poisoned LLM read across tenants), the agent mints a
short-lived session for the workflow's owner, in its own process:

```
Worker ──POST /api/internal/workflow/output_agent──► Agent
                                                      │
                              mint_workflow_owner_session(run_id)
                                                      │
                     service role: workflow_run → workflow_definition
                     .created_by → auth user's email (admin/users/{id})
                                                      │
                     GoTrue: admin/generate_link (service key),
                     then verify (anon key) ──► access token
                                                      │
                              the subagent runs with that token
                                                      │
                              revoke_workflow_owner_session(session)
                              GoTrue: logout?scope=local
```

The owner is resolved **from the run id**, never from a user id in the
request, so a caller cannot ask for someone else's identity. The agent
already holds both keys the exchange needs (`SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`), so no other service and no shared secret is
involved. The resulting token is a normal user JWT, so **RLS still
decides** what the analyst can read.

What the session's lifetime is:

- Only the access token is kept; the refresh token in GoTrue's reply is
  dropped.
- The session is signed out (`scope=local`, this session only, never the
  owner's browser sessions) as soon as the subagent finishes, whether it
  succeeded or not. Sign-out ends the session and its refresh token. The
  access token itself stays valid until it expires (GoTrue's JWT expiry,
  one hour by default), because PostgREST checks only its signature and
  expiry.
- The exchange calls GoTrue over HTTP, not through supabase-py: verifying
  on the shared anon client would switch that client's `Authorization`
  header to the owner's token for every later caller.
- Every mint and revoke is logged with the run id and the owner's user id.
  No `audit_log` row is written yet.

**Mint failure is fatal.** If the mint fails, the node fails the step. It
does not fall back to an admin client and does not return a verdict
computed from nothing — a confident-looking answer derived from no data
is worse than a red step.

### Fidelity: the same guardrails as chat

The point of the node is that it behaves like the chat `data_analyst`,
not a watered-down copy. The analyst branch builds with
`langchain.agents.create_agent` (**not** the deprecated
`langgraph.prebuilt.create_react_agent` the slides/briefing branches use)
specifically because it needs middleware support:

- `DataAnalystFailureMarkerMiddleware` — vetoes a *false* hard-failure
  claim and re-drives the agent once.
- `InvestigationDisciplineMiddleware` — rejects a shallow single-pass
  verdict and re-drives, so the node actually investigates instead of
  guessing from the prompt. It also vetoes an `ANALYSIS_TOOL_FAILURE`
  emitted with **zero** analytics calls: that marker reports a tool that
  ran and errored, so with nothing attempted it is a refusal, not a
  failure report. Bounded to one combined re-drive per turn.
- `TodoListMiddleware` — supplies the `write_todos` planning tool the
  chat subagent has.

All three are the same classes the chat path uses
(`agent/src/agents/infusion/logic/deep_agent.py`) — imported, not
reimplemented. A workflow-specific hardening preamble is appended on top
of the shared subagent prompt.

### Data plane: the upstream node's output, not the source

When the node's **wired** input carries a tabular artifact (parquet /
json / ndjson), that artifact — not the registered source — is the data
the analyst computes over. The upstream node's query already *is* the
dataset the workflow author chose; re-querying the source can return
different numbers than the node's own input, and on a large table costs
minutes per tool call.

The binding is enforced structurally, not by asking the model nicely:

| Layer | What it does | Where |
|-------|--------------|-------|
| Worker | selects the wired (non-ancestor-ref) artifact, DESCRIBEs the local file for its ordered schema, sends both plus `size_bytes` + `workflow_run_id` | `upstreamArtifactPayload` / `upstreamArtifactColumns` (`agent_runtime.go`) |
| Agent transport | stamps `artifact` onto **every** MetricSpec in the payload | `_stamp_upstream_artifact` (`agent/src/services/backend_analytics_client.py`) |
| Agent schema tool | `get_summary_layer` serves the artifact's schema instead of any source's | `_upstream_layer` (`tool_helpers/_summary_access.py`) |
| Analytics service | authorizes the plane, compiles the SQL, **dispatches to the runner**, computes stats over the ≤10k-row series | `_resolve_artifact_grant` (`analytics/analytics/api/routers/functions.py`), `run_artifact_query` (`analytics/analytics/services/analytics_functions/series.py`) |
| Runner | streams the artifact to local disk, gates it against a hard byte cap, binds it as the table `upstream`, runs the *same* compiled SQL | `POST /api/runner/v1/query/artifact` (`api/handlers/artifact.go`, `internal/artifactquery`) |

Stamping lives in the transport, not in the tools, so no tool — and no
model — can opt out and silently fall back to the source.

#### Why the runner executes it, not the analytics service

The artifact has no bounded size, so an in-process scan in an API service
is an availability risk, not just a slow path. The runner already embeds
DuckDB, already imports `llumen/storage` and `llumen/profiling`, and is the
service sized for bulk I/O. Concretely, it provides:

- **Streaming, not buffering.** `supabase.Client.StreamObjectToFile`
  writes straight to disk and returns the byte count, rather than holding
  the whole object in memory.
- **A hard size gate,** checked twice — against the producer-declared
  `size_bytes` *before* the download, and against the bytes actually
  written after (a declared size can be absent or wrong).
  `RUNNER_ARTIFACT_MAX_BYTES`, default 256 MiB. Over the cap the tool
  returns a clear analyst-readable error; it never silently truncates.
- **A bounded DuckDB session** — explicit `memory_limit` and
  `temp_directory`, so spill lands on the configured volume rather than
  the container root filesystem.
- **A local file cache** keyed on `(bucket, path)`, so one node run
  downloads each object once instead of once per tool call. The analyst
  makes many calls per node, and `threshold` / `correlation` /
  `validate_hypothesis` each fetch two series, so an uncached plane would
  pull the same artifact 10–20× per run — trading "re-querying the source
  costs minutes" for "re-downloading the artifact", which is no win.
  The key needs no version component: artifact object keys are
  step-run-scoped (`workflow-runs/{run_id}/steps/{step_run_id}/…`), so a
  given `(bucket, path)` is write-once.

The declared column-type overrides come from `profiling.ParquetScan` —
the shared `llumen/profiling` module, which is the single source of truth
for that map. Do not copy it into a consuming service; drift there
surfaces as *"the analyst says your date column is text"*, the exact bug
the overrides exist to fix.

The endpoint is **server-to-server only**: it rejects any request in JWT
auth mode. The caller names `bucket`/`path` directly, and the only
authorization in the path is the analytics service's run-scoped check below — a
browser reaching the route with its own JWT would have bypassed it.

**Ancestor refs are skipped, and sources go out of scope entirely.** The
wired edge is the node's primary dataset; refs are supporting lookups. A
node with no usable wired artifact falls back to the source plane, which
is the pre-existing behaviour.

Be aware of the cost of that choice while an artifact **is** bound: every
spec is stamped, the Runtime Source IDs block is suppressed, and
`get_summary_layer` short-circuits to the artifact schema — so a node with
both a wired input and ancestor refs cannot query those refs' sources at
all, and `compute_correlation` / `validate_hypothesis` can only correlate
two columns of the *same* artifact. This is the safer default over letting
the model half-opt-out, but it is a real capability loss. The planned fix
is to bind **every** materialised tabular input as its own table, using the
transform runtime's namespace (`upstream`, `input_N`, `ref_<alias>` — see
`registerDuckDBInputs` in `transform_runtime.go` and the alias grammar in
`contracts/data_reference.json`). The runner's wire shape is already a
**list** of inputs for exactly this reason, so that change is additive.
See `docs/plans/analytics-artifact-plane-runner.md`.

**A dot in `table` is a schema separator on both sides of the wire.** The
analytics service's `metric_spec._quote_table` splits `spec.table` on `.` and emits
`FROM "public"."sensor"`, so the runner must bind the same two-part
reference (`qualifiedView` in `artifactquery.go`) and `CREATE SCHEMA IF NOT
EXISTS` the qualifier — DuckDB's default schema is `main`, so unlike
Postgres it does not exist already. Binding the whole string as a single
identifier yields `CREATE VIEW "public.sensor"` against a query saying
`FROM "public"."sensor"`, and DuckDB answers `Catalog Error: Table with
name "public.sensor" does not exist because schema "public" does not
exist` — a hard step failure. The prompt steers the analyst to the
unqualified `upstream`, so this is a guard against a spec that qualifies
anyway, not the common path.

**Cached artifacts are pinned while in use.** `FileCache.Acquire` / `Put`
return a `release` the handler defers until *after* the query has read
every input. Handing back a path and letting a concurrent `Put` evict it
mid-scan is reachable at the shipped defaults (a 2 GiB budget over a
256 MiB per-input cap evicts once ~8 artifacts are in flight) and would
surface as an intermittent step failure with no bad input to blame.
Eviction marks a pinned entry *doomed* and skips it — briefly over budget,
bounded by concurrent requests × the per-input cap — and the last release
collects it. Eviction is LRU, not FIFO, so a hit protects the artifact a
multi-tool-call run keeps coming back to. `Put` is get-or-put rather than
overwrite: every insertion for a key resolves to the same destination
filename, so re-copying would truncate a file a reader holds, and keys are
write-once (step-run-scoped paths) so the resident copy is already correct.

**The prompt must not fight the analyst's own rules.** `data_analyst`
rules mandate schema-first discovery via `get_summary_layer` and forbid
guessing an identifier. An early revision of the upstream block instead
said *"do NOT call `get_summary_layer`"*, which contradicted that plus the
Runtime Source IDs block and every analytics tool docstring. A real run
resolved the contradiction by calling `get_summary_layer` anyway, seeing
only source tables, and aborting the node with
`ANALYSIS_TOOL_FAILURE: upstream schema is not exposed via get_summary_layer`
— **without ever attempting an analytics call**. The schema step is
therefore *satisfied*, never forbidden: the artifact's real columns are
inlined in the prompt, the schema tool returns that same schema, and the
Runtime Source IDs block is suppressed while an artifact is bound.

**Access control.** The runner fetches the object with a *service-role*
client, which has no notion of who asked, so the analytics router is the
only place the caller is checked — and an artifact-backed spec carries no
`source_id` to check. `_resolve_artifact_grant` requires
`(bucket, path, workflow_run_id)` to resolve to a `workflow_artifact` row
the caller's **own** token can SELECT (`workflow_artifact_select`,
`007_policies.sql`). User-scoped client authorizes, runner fetches — the
same split the workflow preview route uses.

The `workflow_run_id` is load-bearing, not decoration.
`workflow_artifact_select` grants every run of a definition the caller can
read, so matching `(bucket, path)` alone would let anyone who can read a
definition aggregate *any* artifact from *any* of its runs. An analytics
call is effectively a full read of the artifact (`group_by` + `LIMIT
10000`), not the bounded preview the preview route deliberately restricts
itself to. A spec arriving without a run id is refused with a 400 rather
than silently widened back to definition scope.

`workflow_run_id` carries the run **making the call** (the worker sends its
own `ticket.RunID`), *not* the run that produced the artifact. The two
differ on `reuse_prior_outputs` step tests, which is exactly why the grant
has a second stage. Sending the producing run instead would make stage 1
match unconditionally and quietly restore the definition-wide grant the
400 exists to prevent.

Stage 2 compares the run id **in Python** over an embedded
`workflow_step_run!inner(workflow_run_id)`, rather than as a PostgREST
dotted embedded filter. That matches the only other embedded-ownership
check in the codebase (the preview route in `workflows.py`), and it avoids
a failure mode that is easy to ship: a mistake in the dotted syntax would
be swallowed by the surrounding `except Exception` into a 403 "could not
be verified" — a denial for a caller who *does* have access, reachable
only in `reuse_prior_outputs` step tests, and invisible to tests that mock
the query builder.

Indexed by `idx_workflow_artifact_run_bucket_path`
(`037_2026.07.13.sql`) — `workflow_run_id` leads, so it also serves the
run-scoped lookups `idx_workflow_artifact_run` already covered. Without
it every analytics tool call was a seq scan plus the RLS `EXISTS`
subquery, on a table that grows with every workflow run.

### Verdict contract (agent → worker)

The analyst returns its verdict as JSON in the response `text`. Keys are
identical to the chat verdict shape:

```jsonc
{
  "answer":         "<direct answer to the question asked>",
  "classification": "<the label the instructions asked for, if any>",
  "reasoning":      "<how the numbers support the answer>",
  "key_metrics":    { /* the computed numbers behind the verdict */ },
  "confidence":     "high | medium | low",
  "caveats":        "<what would change this conclusion>"
}
```

`created_entity_kind` is **null** for this kind — nothing is persisted.
The worker writes the verdict as the step's JSON document on the
`default` output channel (`writeAgentJSONDocument`).

**Fence tolerance.** LLMs habitually wrap JSON in a ```` ```json ````
fence, and the agent service returns the text raw. The worker therefore
strips a surrounding fence (`stripMarkdownCodeFence`) before parsing.
Without it a fenced verdict would fail `json.Valid` and collapse into a
single `{"answer": "```json…"}` blob, silently losing
`classification`, `key_metrics`, `confidence`, and `caveats`.

## Failure modes and edge cases

Unlike the slides/briefing paths, this node is **strict** — there is no
lenient "succeed with a warning" outcome, because a verdict nobody can
trust is not a partial success:

- **Session mint failed** — step fails. No admin fallback.
- **Agent reports a hard failure** (failure marker present, or
  `response_type` signals failure) — step fails. There is no orchestrator
  here, so unlike chat the marker has no fetch-flow fallback to redirect
  to: it ends the run. That is why a marker emitted without attempting a
  tool is vetoed rather than trusted.
- **Empty verdict** — a blank or whitespace-only `answer` fails the
  step rather than emitting an empty document.
- **Malformed, non-JSON verdict** — the raw text is wrapped as
  `{"answer": <text>}` so the run still shows what the agent said, but
  the structured fields are absent. Treat missing `classification` /
  `key_metrics` as "the agent did not produce a structured verdict."

## Configuration and operations

### Timeout

`AGENT_SERVICE_TIMEOUT_SECONDS` defaults to **300s** (raised from 120s)
because a real investigation is several structured LLM turns plus
multiple query-tool round trips. The value is emitted explicitly by both
Helm charts and `config/pkg/deploycontract/values_service.go`, so raising
the Go default alone is **not** enough — those must move together or the
raise is inert in every deployed environment.

### Runner artifact plane

`RUNNER_ARTIFACT_MAX_BYTES` (default 256 MiB) — hard cap on an artifact
the runner will stream for analytics; checked before and after download
(see "Why the runner executes it, not the analytics service" above). The runner's
`FileCache` budget (2 GiB total in the shipped defaults) bounds how many
distinct artifacts can be pinned concurrently before LRU eviction
kicks in.

## Critical paths

1. **Node dispatch** — `dispatchAgentKind` routes `data_analyst` →
   `runDataAnalystWorkflowAgent` (worker) → calls the agent service's
   output-agent endpoint with `kind="data_analyst"` → the agent mints an
   owner session, runs the subagent, then signs the session out.
2. **Data access** — if the node has a wired upstream artifact, every
   analytics tool call is stamped to read that artifact (via the
   runner's artifact-query endpoint) instead of the registered source —
   see "Data plane" above.
3. **Verdict** — agent returns JSON-in-`text` → worker strips any
   markdown fence → parses into the verdict shape → writes it as the
   step's `default`-channel JSON document.
4. **Failure** — any of session-mint failure, a hard-failure marker, or
   an empty verdict fails the step outright; there is no lenient
   partial-success outcome (see Failure modes below).

## Integration map

- [agent-nodes.md](agent-nodes.md) — the general agent-node dispatch
  table this node's `agentKind: "data_analyst"` entry belongs to.
- [output-agents.md](output-agents.md) — the shared non-interactive
  runtime plumbing (session-minting pattern, prompt context) this node
  qualifies with strict failure semantics and no persistence.
- [ancestor-refs.md](ancestor-refs.md) — how an author feeds the node
  more than one upstream dataset via `config.ancestor_refs[]`.
- [artifacts-storage.md](artifacts-storage.md) — the Parquet artifact
  format the runner's artifact-query plane reads.
- [../ai-agents/overview.md](../ai-agents/overview.md) — the
  chat-side `data_analyst` subagent this node deliberately mirrors in
  fidelity (shared middleware classes).
- `docs/plans/analytics-artifact-plane-runner.md` — the planned fix for
  the "only the wired artifact, no ancestor refs" capability gap
  described under "Data plane" above.

## Validation checklist

- `data_analyst_agent` must be in `dispatchAgentKind` (worker) routing to
  `runDataAnalystWorkflowAgent` — **not** `runInfusionOutputWorkflowAgent`
  (which persists) and not `runUnstructuredAgent`.
- The engine maps node kind `data_analyst_agent` → binding
  `agentKind: "data_analyst"` (`compile.go`); the worker const
  (`agentKindDataAnalyst`) and the agent-service kind literal must match
  that string exactly. All three drift independently — check all three.
- `data_analyst_agent` is a plain executable node: it does **not** belong
  in `contracts/workflow_node_kinds.json`, which enumerates only
  triggers, side-effect actions, non-executables, and DataFlow-allowed
  kinds. No agent kind appears there.
- It **does** need an entry in `contracts/data_reference.json`
  `channel_map.static` (`["default"]`) plus the three mirrors.
- A missing `summaryForAgent` case in the frontend degrades the builder
  label to a generic "Agent" **silently** — assert the exact label in
  tests rather than `toBeTruthy()`.
- Multi-input authoring goes through `config.ancestor_refs[]` and
  `{{alias}}` tokens, not extra wired edges — see
  [ancestor-refs.md](ancestor-refs.md).
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
