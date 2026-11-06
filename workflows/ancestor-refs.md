---
topic: workflows
services: [engine, frontend, worker]
status: current
---
# Ancestor references (`config.ancestor_refs`)

## Audience and goal

Nodes need access to fields from **non-adjacent** upstream steps — e.g.
a slides node that must reference the original metric even though an
aggregation node sits between them. Ancestor refs make this explicit
without forcing authors to draw extra edges that would distort the
execution flow.

## Shape

Every node's `config.ancestor_refs` is an optional array of:

```json
{
  "ref_id": "r_abc",
  "from_node_id": "<ancestor node id>",
  "from_channel": "default",
  "field_path": "metric.value",
  "alias": "metric"
}
```

- `from_node_id` — **must be a transitive ancestor** of the node on the
  authored graph. Engine compile rejects anything else with
  `WF_COMPILE_INVALID_ANCESTOR_REF`.
- `from_channel` — authored output channel on the source node
  (`default`, `true`/`false` for `if_else`, case ids for
  `switch_cases`, …). Mirrors
  `engine/internal/engine/validate.go::allowedOutputChannelsForNode`.
- `field_path` — path into the ancestor artifact. **JSON** documents support
  dotted keys, bracket indices (`rows[0].name`), and `*` wildcards over
  arrays (`items.*.value`). **Parquet** tables: a column name selects the
  **full column** as `{"values":[…]}` (all rows); empty path returns all
  rows as an array of row objects.
- `alias` — must match `[A-Za-z_][A-Za-z0-9_]{0,63}` (compile-time
  `WF_COMPILE_INVALID_ANCESTOR_ALIAS` if not). **Unique per node**
  (`WF_COMPILE_DUPLICATE_ANCESTOR_ALIAS`); `ref_id` must be unique when
  present (`WF_COMPILE_DUPLICATE_ANCESTOR_REF_ID`).

## Compile and validate

- `engine/internal/engine/ancestor_refs.go` — payload structs and
  `ValidateAncestorRefsInAuthored` (called from `ValidateAuthored`).
- Nodes whose `config` is malformed JSON are silently skipped here; the
  node-kind specific validator then raises the real
  `WF_COMPILE_COMPONENT_CONFIG`.
- `appendAncestorRefInputs` emits synthetic `CompiledInput` entries with
  `IsAncestorRef=true` and `FieldPath=<path>`. These inputs are
  **exempt from `maxInputsForKind`** so adding a reference never
  changes the effective arity of a node.
- `BuildAncestorStepIndex` in `engine/internal/engine/subgraph.go`
  populates `CompiledPlan.AncestorIndex` — `map[stepNodeId][]stepNodeId`
  used by the worker to assemble ancestor context.

## Worker resolution

- `worker/internal/db/claim.go::UpstreamArtifact` carries `FieldPath`
  and `IsAncestorRef` alongside the artifact pointer.
- `worker/internal/worker/field_extract.go` performs projection: JSON via
  `walkJSONPath` / `parseJSONPath`, Parquet via DuckDB
  `readParquetColumn` → `{"values":[…]}`.
- **SQL transforms:** `registerDuckDBInputs` creates `input_1…input_N` only
  for **wired** (non-ref) inputs; each ancestor ref gets a view
  `ref_<alias>`. JSON slices shaped `{"values":[…]}` use
  `unnest(values) AS value` so `SELECT AVG(value) FROM ref_metric` works.
  Ref-only transforms alias `input` to the first `ref_*` view.
- **Output agents:** `expandWorkflowInstructionAliases` substitutes
  `{{alias}}`. On the slides, briefing and data analyst agents, a declared
  ref whose artifact cannot be read fails the step with
  **`WF_AGENT_MISSING_REF`** (the step's `error_code`). An undeclared
  `{{name}}` is caught earlier: when the node declares any ancestor refs,
  compile fails with **`WF_COMPILE_UNDECLARED_REF_TOKEN`**; when it
  declares none, the token is plain text and is passed to the agent
  verbatim (the worker logs a warning).
- **Action nodes:** `resolveRefTokensInActionSpec` in
  `worker/internal/worker/ref_tokens.go` substitutes the spec's text fields.
  In the prose a person reads — an email body, a chat message — tokens are
  resolved line by line (`resolveProseRefTokens`). A line holding several
  references over several values, all read from the same upstream node and
  channel (`refRowSources`), is written once per row ("High complaints on
  2025-04-17: 240" for `on {{date}}: {{count}}`). Any other reference over
  several values is written one value per line as a block of its own: text
  before it on the line ends that line and text after it starts a new one.
  References from different rows are never paired by position. A reference
  holding one value is substituted in place. A subject is one header line,
  so several values are joined by `"; "` there (`proseRefValues`).
  Addresses and API requests keep the rendered text, so a request body
  still receives a JSON array. The agent's "would have said" text for an
  unsent message mirrors these rules
  (`_workflow_candidate_actions.render_message_text`). The authoring SDK
  reads a message's measure of grouped rows through one `edit_fields` step
  labelled `message_lines` that adds `<measure>_lines` ("Jan 2026: 9,262"
  per row, `workflow_sdk/llumen_wf/actions.py::message_line_sql`), so those
  lines carry their labels — unless the measure's line also names another
  column of the same rows, which the worker already writes once per row;
  the agent's request comparison folds that step away
  (`_workflow_sdk.fold_message_lines`).
- **Source nodes:** the odd one out — a source query is not author prose,
  it is executed by another service that already knows how to format a
  value for the target dialect. So `runSource` does **not** splice every
  reference in as text. A reference resolving to a scalar or a flat
  single-type array keeps its token in the query and travels to the
  runner in the request's `variables` map; the runner substitutes it with
  SQL quoting/escaping, `IN`-list expansion, or JSON escaping as the
  source type requires. Only references the runner cannot bind (a whole
  table, a nested document) still splice verbatim. See
  [source-nodes.md](source-nodes.md) for the split and its rationale.

## Authoring UI

- `frontend/src/features/workflows/graph/ancestors.ts` —
  `useAncestorSummaries` hook (BFS over inbound edges, cycle-safe,
  excludes triggers and stickies).
- `frontend/src/components/pages/workflows/nodeConfig/AncestorFieldPicker.tsx`
  — shared popover used by agent/output instruction editors and
  transform condition cards. Inserts `{{alias}}` tokens into prompts
  when `onAliasInserted` is provided by the caller.
  - "What to pull in" (`field_path`) is **optional**: empty means the
    entire upstream output (parquet → all rows; JSON → the whole
    document).
  - **Schema-aware field picker.** When the caller supplies a
    `schemaForAncestor` resolver and the picked source has produced a
    preview on the latest run, the popover renders a clickable list
    of fields (column names for parquet, dotted JSON paths for
    documents) plus a "Whole output" pill — the author never has to
    type a path. Fields are typed-tagged (`string`, `number`, `date`,
    `object`, `array`, …) and labelled with a sample value when one
    is available in the preview's `sample_rows` / parsed snippet.
    A "Custom path…" toggle reveals the free-text fallback for the
    rare case where the desired path isn't enumerable (e.g.
    `items.*.value` wildcards, deep nesting beyond the picker's depth
    cap).
  - Resolution path: `WorkflowBuilderShell` exposes
    `outputDescriptorsByNode` from `buildNodePreviewState`, then
    `useAncestorSchemaResolver`
    (`frontend/src/components/pages/workflows/nodeConfig/useAncestorSchemaResolver.ts`)
    lazily fetches each upstream's preview blob via
    `workflowService.getRunPreview` and converts it into
    `AncestorField[]`. The resolver is cached by
    `(runId, previewDocumentId)` so opening / reopening the picker
    or switching source nodes never re-fetches.
  - When the upstream hasn't produced a preview yet (or the schema
    resolver is omitted, e.g. in tests), the picker falls back to a
    free-text input with placeholder + path-syntax examples, so the
    feature degrades gracefully.
- **Resolved-value badges** —
  `frontend/src/components/pages/workflows/nodeConfig/resolvedRefValue.ts`
  (pure resolution) + `ResolvedRefValueBadge.tsx` (shared `≈ value` badge
  and the `ResolvedRefValuesRow` line). Every binding surface shows what a
  reference resolved to on the **last materialised run**: condition
  operands (a values line under the clause), edit_fields values, the
  aggregate source and merge slots, agent/action `{{alias}}` ref chips,
  the asset/ml row-source labels and per-feature bindings, and the
  `DataReferencePicker` itself (per-field sample hints, a whole-output
  row-count summary, and a "Current value" line).
  - Values are derived entirely from the schema resolver's cached preview
    (per-field `sample`, `rowCount`/`columnCount`, `wholeSample`) — no new
    endpoint, display-only. They are samples, not a live evaluation; the
    badge tooltip carries that caveat, and surfaces degrade to nothing
    (or "Run the upstream node to preview values") when no run exists.
  - Expression inputs can't host inline values or tooltips (their pill
    mirror must match the typed text glyph-for-glyph under a transparent
    input), which is why values render on a separate line / on the ref
    chips below the field.

## Cloning nodes (duplicate / copy-paste)

- `frontend/src/components/pages/workflows/nodeConfig/cloneRemap.ts` —
  `remapNodeConfigForClone(kind, config, idMap, { unmappedReferences })`
  is the ONE entry point for rewriting a cloned node's config. Node ids
  occur in configs only as `ancestor_refs[].from_node_id` and as
  `fromNodeId` inside guided binding objects (`AncestorRefSource`); the
  remap is structural over those two key names, so new binding fields
  are covered automatically as long as they keep the naming. Compile-time
  `*_SOURCE_KEYS` records in that module plus a sentinel sweep test
  (`__tests__/cloneRemap.test.ts`) fail when a binding field is added
  without acknowledging the clone path.
- Policy: `keep` (default) for clones pasted into the same workflow —
  refs to nodes outside the cloned set still name real nodes; `drop`
  for cross-workflow paste — the binding object and its
  `ancestor_refs` entry are removed, alias-valued consumers
  (`rowSource`, `featureRefs`, `*SourceAlias`) are cleared, and
  `{{alias}}` tokens in free text are left for the editors / compile
  errors to surface.
- Aliases never change on clone (generated and hand-written SQL
  reference `ref_<alias>` views by name), so a duplicated node's view
  names may still derive from the source node's id — cosmetic only.

## Integration map

- [action-nodes.md](action-nodes.md), [agent-nodes.md](agent-nodes.md),
  [transform-nodes.md](transform-nodes.md), [source-nodes.md](source-nodes.md) —
  the node kinds whose runtimes resolve `{{alias}}` tokens/`ref_<alias>`
  views built from `config.ancestor_refs[]`.
- [data-analyst-node.md](data-analyst-node.md) — how an author feeds the
  node more than one upstream dataset via this mechanism.
- [engine-compile.md](engine-compile.md) — the
  `WF_COMPILE_INVALID_ANCESTOR_REF`/`WF_COMPILE_INVALID_ANCESTOR_ALIAS`/
  `WF_COMPILE_DUPLICATE_ANCESTOR_*` validation family and the
  `maxInputsForKind` exemption ancestor refs get.
- [node-catalog.md](node-catalog.md) — "Cross-cutting: per-node config
  extensions" cites this page for the `ancestor_refs` key.

## Validation checklist

- A ref whose `from_node_id` is not in the ancestor closure of its
  owner must be rejected at compile, **not** silently ignored.
- The picker's source list must equal the ancestor closure — never the
  full node set — because sibling branches aren't proven upstream at
  runtime.
- The authoring UI sanitises aliases; the engine enforces the stricter
  pattern above and duplicate checks at compile time.
