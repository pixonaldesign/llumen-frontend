---
topic: workflows
services: [runner, worker]
status: current
verified_against: "a1aa8c862"
verified_on: 2026-08-25
---
# Workflow source nodes

## Audience and goal

The `source` node kind: a step that runs an author-written query
against a registered product source through the **runner**, the same
encryption/auth/timeout handling as any other source-execution path.
Covers `Executor.runSource` only — the `asset` node kind (a *bound*
asset reference, not an ad-hoc query) is documented in
[node-catalog.md](node-catalog.md) under "asset node — bound-asset
lifecycle", not here.

## Read first

- [../sources/runner-service.md](../sources/runner-service.md)
- `worker/internal/worker/executor.go` — `runSource`,
  `persistSourceParquet`, `persistSourceJSON`.
- `worker/internal/runnerclient/client.go` — `Client.Execute`.
- `runner/internal/api/handlers/query.go` — `wantsParquet`,
  `acceptsJSON`, `isParquetEligible`; `queryRequest.Variables`.
- `runner/internal/substitution/variables.go` — `SubstituteVariables`
  (per-source-type dispatch), `SubstituteSQLTemplateVars`,
  `FormatSQLValue`.
- [ancestor-refs.md](ancestor-refs.md) — `{{alias}}` token resolution in
  the authored query text before it ships to the runner.

## How it works

A `source` step's authored `config` carries `sourceId` and a literal
query string (`step.Bindings["sourceId"]` / `["query"]`). Before
dispatch, `runSource` resolves the step's `{{alias}}` ancestor
references (see [ancestor-refs.md](ancestor-refs.md)) and splits them
by what the RUNNER can bind:

- **Bindable** — the reference resolved to a JSON scalar or a flat
  single-type array. The token is **left in the query** and the typed
  value is forwarded in the runner request's `variables` map, so the
  runner formats it for the target source type: SQL string quoting and
  escaping, an array expanded into a real `IN` list, JSON escaping for a
  value that lands inside an API request document. Authors do **not**
  quote these tokens themselves — a quoted `'{{alias}}'` is accepted and
  its quotes are absorbed by the formatter, so queries written under the
  old contract keep working and gain escaping.
- **Not bindable** — a whole-output table, a nested document, a non-JSON
  payload. These keep the original verbatim splice: the value is
  substituted into the query text as-is, and `checkResolvedTextBudget`
  bounds the fully-resolved text so a query repeating a large token
  can't multiply past a sane payload size.

The split is decided by `isRunnerVariableEligible`
(`worker/internal/worker/ref_tokens.go`), which mirrors the runner's
`ValidateVariables` contract and is deliberately conservative: anything
it declines falls back to the pre-existing text path, so a shape the
runner would reject never reaches it.

**Why the split exists.** Splicing every value in as text meant the
worker had to reproduce the runner's per-dialect formatting and did not:
a value carrying a quote corrupted the API request JSON it was spliced
into, and every authored SQL query had to quote its own tokens. Handing
the value over instead reuses the formatting the runner already owns.

`{{name}}` is accepted as a placeholder for **every** source type, not
just API connections. It is the shape a flow author already writes in
agent instructions and action specs, and it is not valid SQL in any
dialect, so treating it as a placeholder there is unambiguous. Each type
formats it its own way:

| source type | pass | formatting |
|---|---|---|
| SQL (default) | `SubstituteSQLTemplateVars` | `FormatSQLValue` — quoted/escaped, arrays expand to an `IN` list |
| `api_connection` / `api` | `SubstituteTemplateVars` | JSON-escaped into the request document |
| `mongodb` | `substituteJSONTemplateVars` | JSON-encoded into the filter document |
| `fusion` | `SubstituteFusionVars` | JSON-encoded, datetimes tz-normalised |

The pre-existing per-type shapes are unchanged and still run first, so a
query may mix them: SQL still honours `$name`, Mongo still honours
`$$name`.

**Where a SQL token sits changes what it renders as.** A token wrapped
exactly in quotes (`region = '{{region}}'`) absorbs them and the whole
literal comes from the formatter — that is what lets queries written
under the old verbatim contract keep working and gain escaping, and what
turns `IN ('{{ids}}')` into a real `IN ('a', 'b')`. A token *embedded*
in a literal (`LIKE '%{{term}}%'`, `'prefix-{{id}}'`) is one piece of the
author's literal, so the value is escaped but **not** quoted. A bare
token in ordinary code gets the full formatted literal. The code mask
(`substitution.codeMask`) tells the last two apart.

The resolved query is sent to the runner via
`worker/internal/runnerclient.Client.Execute`, which asks for
**parquet, falling back to JSON**, via content negotiation rather than
a fixed format: it sends `Accept: application/vnd.apache.parquet,
application/json;q=0.9`. On the runner side
(`runner/internal/api/handlers/query.go`), `wantsParquet(r)` and
`acceptsJSON(r)` parse that header; `isParquetEligible(dsType, result)`
decides whether the query result can actually be serialized as columnar
parquet (some source types/shapes cannot — e.g. an API/Mongo source
returning a single column of nested objects). When the result is not
parquet-eligible but the caller's `Accept` also allows JSON, the runner
**silently falls back to a JSON envelope**
(`{"status":"success","data":...,"columns":...,"row_count":...}`)
instead of `406` — this is what lets `source` nodes consume non-tabular
API/Mongo-shaped payloads. `runSource` then dispatches on
`res.Format`: `"parquet"` → `persistSourceParquet` (the tabular path,
same Parquet artifact convention as every other worker output — see
[artifacts-storage.md](artifacts-storage.md)), `"json"` →
`persistSourceJSON` (a document artifact instead). Any other reported
format fails the step with `WF_RUNNER_QUERY`.

A strict parquet-only caller (`Accept: application/vnd.apache.parquet`
alone, no JSON quality value) still gets a plain `406
{"status":"error","message":"result cannot be encoded as parquet"}` —
there is a separate `ExecuteQueryParquet` client method that always
sends the strict parquet-only `Accept` header for callers that require
it (`runSource` does not use it; it uses the dual-mode `Execute`).

The `asset` node kind (a *different*, bound-reference node — see
[node-catalog.md](node-catalog.md)) makes the same non-tabular
fallback trade-off in its own runtime, `worker/internal/worker/asset_runtime.go`
— don't assume the two node kinds share code, only the trade-off.

Runner-side query-result caching (the source content-address cache)
writes back **parquet only** — the JSON-fallback path exists for the
immediate request/response, not for the cache.

## Critical paths

1. **Execute** — worker leases a `source` step →
   `Executor.runSource` resolves ancestor refs → `runnerclient.Execute`
   (`Accept: parquet, json;q=0.9`) → runner executes against the
   registered source → `wantsParquet`/`acceptsJSON`/`isParquetEligible`
   decide the response shape → worker persists via
   `persistSourceParquet` or `persistSourceJSON`.
2. **Non-tabular API/Mongo source** — runner determines the result
   isn't parquet-eligible → falls back to the JSON envelope (since the
   caller's `Accept` allows it) → worker's JSON path persists a document
   artifact instead of a table.

## Configuration and operations

- `RUNNER_SERVICE_TIMEOUT_SECONDS` — align with the expected max query
  duration for heavy SQL steps (see [local-dev.md](local-dev.md) for
  the full env-var table).
- `RUNNER_SERVICE_URL` / `RUNNER_SERVICE_API_KEY` — required at worker
  startup for any source step to be reachable at all.
- Encryption/auth for the underlying source connection is the same
  path every other runner-mediated source query uses — see
  [../sources/runner-service.md](../sources/runner-service.md); this
  page does not duplicate that.

## Failure modes and edge cases

- **Missing `sourceId`/`query` in the authored config** —
  `WF_SOURCE_BINDING`.
- **Ancestor-ref resolution failure** (bad alias, missing value) —
  `WF_SOURCE_REF_RESOLVE`; a resolved-text budget violation from a
  repeated large token also fails with this code. Only the **verbatim**
  aliases are resolved here — a bindable alias is forwarded to the
  runner, so a typo in one surfaces as an unsubstituted token rather
  than this error.
- **Undeclared `{{token}}` at compile** — `WF_COMPILE_UNDECLARED_REF_TOKEN`
  (see [ancestor-refs.md](ancestor-refs.md)). **API-request source nodes
  are exempt**: their `query` is the serialized request document, where
  `{{name}}` is *also* the API connection's own collection-variable
  syntax. The two are indistinguishable by shape, so scanning that
  document would reject every collection variable the moment the node
  declared one reference. They need no separation — the runner layers
  them, request variables first and collection variables last
  (`APIRunner.variables`), so an alias binds and any token it does not
  claim falls through to the collection layer.
- **Runner call failure** (transport error, source-side error) —
  `WF_RUNNER_QUERY`.
- **Runner reports an unsupported/unexpected format string** — also
  `WF_RUNNER_QUERY`, defensive (should not normally trigger given the
  two formats the runner actually returns).
- **Strict-parquet caller against a non-eligible result** — `406` at
  the runner (not applicable to `runSource`, which always uses the
  dual-mode `Accept`; relevant only to callers of the strict
  `ExecuteQueryParquet` client method).

## Authoring: an ETL Flow source

The picker's **ETL Flow** card lists `etl_flow` sources, and those rows
come in two shapes: a flow's **catalog row** (`dataflow_definition_id` +
`dataflow_version_id`) and the **dataset row** minted per (flow,
paramset) (`metadata.store_table`, `dataflow_dataset: true`). That split
is the work of "ETL read is just SQL" — workstream 9 of the Store DB
plan, `docs/_records/plans/store-db/ws9-etl-read-is-just-sql.md`, cited
as WS9 below. Only the
second is executable — `resolver.normalizeSourceType` leaves a catalog
row typed `etl_flow`, `runner.NewFactoryRunner` has no case for that, and
`/query/execute` answers `501 unsupported source type`.

So the pick is **resolved before it becomes a selection**:
`WorkflowSourceSelectionWizard.handlePick` calls
`assetService.resolveEtlDataset` (content's
`SourcesHandler.ETLDataset`, `POST /sources/{id}/etl-dataset`) with
`materialize: true`, and
`buildWorkflowSourceSelectionPatch` stores the returned
`source_id` — the dataset row — plus its `default_query`
(`sources.DefaultQueryForDataset`, `SELECT * FROM "etl_flows"."etlb_…"`).
The node is then an ordinary Store SQL step, read exactly like a
file-upload source, and `NodeConfigurationPanel`'s `dataflow` branch
renders the same `WorkflowSQLQueryEditor` the other SQL modes use.

When the engine cannot start the flow, the answer still succeeds and carries
`materialize_error`, which the wizards show as written. A licence refusal from
the engine (`etl_flows` not included) is only its sentence, e.g. "This
deployment's license does not include ETL Flows.", and so is an older engine's
code-only `license_locked`; any other failure keeps the engine's method, path
and detail (`materializeErrorText` in
`content/internal/api/handlers/sources.go`).

The seed is load-bearing: `engine/internal/engine/compile.go` rejects an
empty query on **any** source node
(`WF_COMPILE_SOURCE_MISSING_QUERY`) and that is a whole-plan failure, so
an unseeded ETL node makes every step-test on the version return
`WF_STEP_TEST_NOT_COMPILED`. Re-picking the same flow preserves an
edited query (`sameSource` is compared against the *resolved* id).

> **Known gap — `materialize: true` starts the flow but does not wait for
> it.** Content's `MaterializeETLSource`
> (`content/internal/engine/client.go`) does not send `wait`, and the
> engine's `/internal/v1/etl-source-runs` defaults that to false and
> answers **202 Accepted** as soon as the run row exists. So the pick is
> accepted in about a second however long the pipeline takes, and
> `materialize_error` can only report a failure to *start* the run — a run
> that starts and then dies is never surfaced at all.
>
> This matters because the runner's 42P01 cold start
> (`etl_cold_start.go`) is wired only to `/asset/data`, never to the
> `/query/execute` a source step uses. A node picked before its table
> finishes building therefore compiles and then fails at run time with
> `WF_RUNNER_QUERY`; the same window can also surface a raw
> `28P01 password authentication failed`, because the Store's per-tenant
> role is created at materialisation too. Re-picking the flow once the run
> has finished is the workaround. The runner's cold start compares:
> it asks for `wait: true` explicitly
> (`runner/internal/engineclient/client.go`).

Resolving is opt-in (`resolveFlowDataset`) because it RUNS the flow, and
only a consumer that authors a query over the result has any use for
that. Two consumers do not, and both are opted out:
`ActionNodeConfigEditor` mounts the same wizard for an API-request
action's source and ignores the dataset; and `NodeConfigurationPanel`
passes `resolveFlowDataset={flavor !== 'dataflow'}`, because `source` is
an allowed kind in the **ETL builder** too — running a whole pipeline
there only to have the compile refuse it with
`WF_COMPILE_DATAFLOW_NO_NESTING` is minutes of compute for a guaranteed
error.

Nesting is still refused: `service.ValidateDataFlowNoNesting` keys on
`source.type = 'etl_flow'`, which the dataset row also carries, so an ETL
source node inside a `definition_kind='dataflow'` graph fails with
`WF_COMPILE_DATAFLOW_NO_NESTING`.

### Nodes saved before the picker resolved datasets

A node authored earlier still holds the **catalog** row id, and nothing
migrates it — the id lives in an authored graph blob. Handing such a node
a SQL editor would be worse than the bug it replaced: the query compiles
and then fails at RUN time with the 501, later and less clearly than the
`WF_COMPILE_SOURCE_MISSING_QUERY` it used to get. So the panel detects
that state (`isEtlCatalogSource` — typed `etl_flow` **without**
`metadata.dataflow_dataset`) and shows a repair prompt instead: **Change
source** → pick the same flow, which rebinds and reseeds. The repair
replaces the node's query, and the prompt says so.

Auto-resolving on open was rejected deliberately: it would run a whole
ETL pipeline because somebody looked at a node.

### Known gap: a workflow-bound dataset never refreshes

The content service's `ShortestCadence`
(`content/internal/api/services/assets/schedule.go`) computes an ETL
refresh cadence as the minimum `update_frequency` over every **asset** on
the source, and `SyncETLRefreshSchedule` is called only from asset
create/update/delete. A workflow source node is not an
asset, so a dataset reached only from a workflow gets **no `etl_refresh`
job**: its table is frozen at the moment someone picked the flow, and a
nightly workflow re-reads the same snapshot every night with nothing in
the UI saying so. Re-picking the flow is the only refresh. Unlike the
sweeper's C3 gap (`docs/services/scheduler.md`), this one is not yet
closed.

## Authoring: schema-aware SQL autocomplete

The Source node's query editor (`WorkflowSQLQueryEditor.tsx`) offers
Monaco autocomplete over the node's own selected source: table names,
that table's column names, and generic SQL keywords, in that priority
order (`frontend/src/features/workflows/sql/sqlCompletions.ts` —
`tableCompletions`, `columnCompletions`, `keywordCompletions`; schema
names sort ahead of keywords via `sortPrefix`). The cursor position
decides the shape offered: immediately after `FROM`/`JOIN` it's table
names, everywhere else it's columns, scoped to whichever tables the
query already names (`sqlCompletionProvider.ts` —
`buildCompletionsForPosition`, `TABLE_POSITION_TAIL`). A join across
several tables (`FROM a JOIN b ON ...`) offers columns from both sides,
via `tableNamesInQuery`'s scan for every `FROM`/`JOIN` reference, not
just the first.

The completion provider is registered once per Monaco instance (a
`WeakSet` guard in `ensureSqlCompletionProvider`, since
`registerCompletionItemProvider` is global per language, not
per-editor-mount) and reads the *active* schema from module state set
by `setActiveSqlSchema`/`clearActiveSqlSchema`. `WorkflowSQLQueryEditor`
sets that state on mount from its optional `schema` prop and clears it
on unmount, so a table list from one Source node's editor never leaks
into the next node's suggestions.

**Duplicate column names.** A column name that exists on several tables
collapses to a single autocomplete entry whose detail explains the
ambiguity ("appears on more than one table"); when a table is already
in scope in the query, the entry still names that table to disambiguate
which occurrence is being offered.

The schema itself comes from `NodeConfigurationPanel.tsx`, which calls
`sourceSchemaService.describeSource()` — the same runner
`/schema/describe` endpoint used elsewhere in the app — but only
**lazily**: the fetch fires once a Source node's config panel is open
and its selected source has resolved, never on canvas load, and the
result is cached by source id (`sourceSchemaCacheRef`) so reopening the
same node, or opening a second node against the same source, never
re-hits the runner.

**A failed schema fetch degrades silently to keyword-only
suggestions.** No error banner, no thrown rejection, nothing that
blocks query authoring — a source the caller can't describe (missing
runner access, an unsupported engine, a transient network failure) is
treated as a normal condition, not a fault. The completion provider is
already null-safe against a missing schema (`tableCompletions`/
`columnCompletions` both return `[]` for a `null` model), so the widget
still appears with keywords alone.

## Integration map

- [../sources/runner-service.md](../sources/runner-service.md) — the
  shared runner execution path this node reuses (encryption, auth,
  timeouts).
- [node-catalog.md](node-catalog.md) — the sibling `asset` node kind
  (bound reference, not an ad-hoc query) and its own non-tabular
  fallback.
- [ancestor-refs.md](ancestor-refs.md) — `{{alias}}` token substitution
  in the authored query text.
- [artifacts-storage.md](artifacts-storage.md) — the Parquet/JSON
  artifact conventions `persistSourceParquet`/`persistSourceJSON` write
  into.
- [transform-nodes.md](transform-nodes.md) — the downstream node kinds
  that consume a source step's output as `input`/`input_N` in DuckDB.
- [builder-ui.md](builder-ui.md) — where the query editor sits in the
  node-config modal; this page owns the autocomplete behaviour itself.

## Validation checklist

- Align `RUNNER_SERVICE_TIMEOUT_SECONDS` with expected max query
  duration for heavy SQL steps.
- If the runner's parquet-eligibility rules change, re-check
  `persistSourceJSON`'s document-artifact shape still matches what
  downstream transform/agent nodes expect for a non-tabular source.
- Verified against commit `a1aa8c862`.
