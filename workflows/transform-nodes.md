---
topic: workflows
services: [worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow transform nodes

## Audience and goal

In-worker data-shaping steps (`filter`, `if_else`, `switch_cases`,
`edit_fields`, `aggregate`, `merge`, and JQ-style document transforms)
run by `Executor.runTransform` / `executeTransformRuntime`
(`worker/internal/worker/executor.go`,
`worker/internal/worker/transform_runtime.go`). **Correction:** an
earlier revision of this page pointed at `worker/internal/adapter` for
the handler implementations — that package does not exist in the
current tree (verified: no `worker/internal/adapter` directory).
Transform execution lives directly under `worker/internal/worker/`.

## Read first

- [worker-executor.md](worker-executor.md)
- [ancestor-refs.md](ancestor-refs.md) — transforms can read fields
  from non-adjacent upstream nodes via `config.ancestor_refs[]`; these
  bindings register in DuckDB as `ref_<alias>` and are exempt from
  the `maxInputsForKind` limit.
- `worker/internal/plan` — compiled step decoding.
- `worker/internal/worker/transform_runtime.go` — DuckDB registration:
  wired inputs become `input_1`, `input_2`, … and `CREATE VIEW input AS
  SELECT * FROM input_1`. Ancestor refs become **`ref_<alias>`** views
  (JSON `{"values":[…]}` → `unnest(values) AS value`). Ref-only graphs
  map `input` to the first `ref_*` view so existing `FROM input` SQL
  still runs.
- `worker/internal/worker/executor.go` — `runTransform` (dispatch,
  upstream-artifact loading, SQL-safety check for `language="sql"`
  steps, output materialization).

## How it works

`runTransform` first loads every wired upstream artifact
(`wdb.LoadUpstreamArtifacts`) — a transform step with no upstream
artifacts fails immediately (`WF_TRANSFORM_NO_INPUT`). The step's
authored config carries `language` (`sql` or a jq-like document
language) and `source` (the query/expression text); a SQL-language step
is passed through `ValidateTransformSQL` before execution, rejecting
unsafe constructs with `WF_TRANSFORM_SQL_UNSAFE`. Execution itself
(`executeTransformRuntime`) registers every wired input plus any
`ref_<alias>` ancestor-ref views in an in-process DuckDB session (see
[worker-executor.md](worker-executor.md) for the general step-output
model) and runs the authored SQL/jq against them.

**Condition and case editors.** Filter / if_else / switch_cases /
edit_fields / aggregate / merge condition cards use the same
`AncestorFieldPicker` as agent nodes. A single condition can therefore
reference a field from one ancestor on the left-hand side and a field
from a different ancestor on the right-hand side — the engine does not
require condition operands to come from the same upstream node.

**Aggregate grouping.** The guided aggregate supports an optional
**Group By** field list (both modes). Group keys are deduped, projected
alongside the metrics / list, and emitted as `GROUP BY` in the
generated SQL — `SELECT "region", SUM("amount") AS "total" FROM input
GROUP BY "region"` — with a jq mirror (`group_by([…]) | map({keys} +
{aggregates})`) for document payloads. Empty keeps the original
collapse-to-one-row behavior. In list mode without explicit include
fields, whole rows are packed via `LIST(<from>)` (the relation as a
struct — `LIST(*)` is not valid DuckDB). Authoring: `groupByFields` in
the guided state (`workflowNodeConfigState.ts`), comma-separated input
with append-on-drop in `TransformNodeConfigEditor.tsx`.

**Output type behavior.** The type policy is: **integer data stays
integral end-to-end**; SQL widening within the integer family is
accepted.

- **SQL aggregates.** DuckDB computes `SUM` over `BIGINT`/`INTEGER` as
  `HUGEINT` (int128). Parquet has no int128, and DuckDB's writer would
  silently materialise such columns as `DOUBLE` (`SUM(qty)=12` →
  `12.0`). `copyQueryToParquet` (worker `transform_runtime.go`,
  `narrowHugeintColumns`) therefore DESCRIBEs every materialised query
  and casts `HUGEINT`→`BIGINT` / `UHUGEINT`→`UBIGINT` via a
  `SELECT * REPLACE (…)` wrapper. A sum genuinely exceeding int64 fails
  the step with a loud DuckDB conversion error instead of silently
  losing precision as a float. Queries with no 128-bit column pass
  through unchanged. `COUNT`→`BIGINT` and `AVG`/`SUM(DOUBLE)`→`DOUBLE`
  are correct SQL and are kept as-is.
- **Guided SUM/AVG run on the column's native type.** The generator
  previously emitted `SUM(TRY_CAST(col AS DOUBLE))`, which both forced
  integer sums to floats and silently EXCLUDED unparseable values from
  the total. It now emits `SUM(col)` / `AVG(col)`; a text-typed column
  fails the step with a clear binder error instead of summing wrong.
- **JQ transforms.** gojq only accepts `int` / `float64` / `*big.Int`
  numbers. Both payload sources used to violate that — document inputs
  were decoded with plain `json.Unmarshal` (every number → `float64`)
  and table inputs carry `int64` from the DuckDB scan (undefined
  behaviour in gojq). `loadJQInputPayload` now decodes documents with
  `UseNumber`, and `normalizeJQInput` (worker `safety.go`) converts the
  payload to gojq's vocabulary at the `RunJQWithTimeout` boundary,
  keeping integral values integral — so an integer field survives a JQ
  transform and re-materialises as an `INT64` parquet column
  (`inferParquetColumnType` already classifies `int` correctly).
- Filter / if_else / switch_cases are `SELECT *` passthroughs and
  preserve types by construction.

## Critical paths

1. **Execute** — worker leases a transform step → `runTransform` loads
   upstream artifacts → `executeTransformRuntime` registers DuckDB
   views (`input_N`, `ref_<alias>`) → runs authored SQL/jq → materializes
   output → step `succeeded`.
2. **SQL safety gate** — `language="sql"` steps run through
   `ValidateTransformSQL` before any DuckDB execution; unsafe
   constructs never reach the database.

## Configuration and operations

- No dedicated env vars; transform behavior is entirely driven by the
  authored node config (`language`, `source`, `groupByFields`, etc.)
  and the compiled step's wired/ancestor-ref inputs.
- `worker/internal/worker/safety.go` — `normalizeJQInput`,
  `RunJQWithTimeout` — the JQ execution boundary and its timeout.

## Failure modes and edge cases

- **No upstream artifacts wired** — `WF_TRANSFORM_NO_INPUT`.
- **Missing `source`/`language` binding** — `WF_TRANSFORM_BINDING`.
- **Unsafe SQL** (`language="sql"`) — `WF_TRANSFORM_SQL_UNSAFE`,
  rejected before execution.
- **Runtime execution failure** (bad SQL, jq error, DuckDB error) —
  `WF_TRANSFORM_EXECUTION`.
- **Sum exceeding int64 after HUGEINT narrowing** — a loud DuckDB
  conversion error, by design, rather than silently losing precision as
  a float.
- **Aggregate over a text-typed column with guided SUM/AVG** — a clear
  binder error rather than a silently wrong (TRY_CAST-excluding) total.
- Engine compile output must include the schemas the transform adapter
  expects — version compiled artifacts when changing field names.
- Transforms that declare `ancestor_refs` must still compile when the
  referenced ancestor emits JSON (not only Parquet); see
  `extractFieldToJSONFile` tests in `worker/internal/worker/`.

## Integration map

- [worker-executor.md](worker-executor.md) — the general step-output
  model (`workflow_step_output`/`workflow_artifact`) transform steps
  write into.
- [ancestor-refs.md](ancestor-refs.md) — `ref_<alias>` DuckDB views and
  the `maxInputsForKind` exemption they carry.
- [engine-compile.md](engine-compile.md) — the fan-in/arity rules
  transform node compilation enforces.
- [source-nodes.md](source-nodes.md) — the typical upstream producer of
  a transform step's wired input.
- [agent-nodes.md](agent-nodes.md) — shares the `AncestorFieldPicker`
  authoring component for condition/case editors.

## Validation checklist

- Engine compile output must include schemas the transform runtime
  expects — version compiled artifacts when changing field names.
- Transforms that declare `ancestor_refs` must still compile when the
  referenced ancestor emits JSON (not only Parquet); see
  `extractFieldToJSONFile` tests in `worker/internal/worker/`.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
