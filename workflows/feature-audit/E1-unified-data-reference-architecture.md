---
topic: workflows
services: [frontend]
status: current
---
# E1 — Unified cross-ancestor data-reference architecture

> **Flagship workflow enhancement.** Make **any consuming node reference data from any
> ancestor node** (not just its wired predecessor) through **one clean model**, not per-node
> patches. Covers transforms (filter / if_else / switch / edit_fields / aggregate / merge),
> `create_asset`, `ml_model`, agents, actions, and the `source` query.
>
> **Grounded in** five code+industry research reports under `/tmp/wf_research/`
> (`arch-consume-map.md`, `arch-ref-model.md`, `arch-authoring.md`, `arch-operators.md`,
> `arch-industry.md`). All `file:line` trace to those. See also `enhancement-backlog.md` (E1).

## Confirmed decisions (CTO)

1. Operands (**left and right**) can reference any ancestor field.
2. Add **membership operators** `is one of` / `is not one of` (we don't have them today).
3. Scalar comparison requires a **single-row / aggregate** ancestor source — **no per-field
   reductions** in v1.
4. Apply to **all consuming nodes at once**, one unified reference model.

## The reframe (the mental model)

A node **always iterates its immediate input row-by-row** — that never changes. Item #1 only
enriches **what an operand or binding may reference**. Ancestor data enters as an operand in one
of three *explicit* modes (never guessed):

| Mode | Meaning | SQL it generates | When |
|---|---|---|---|
| **Broadcast (scalar)** | ancestor reduces to ONE value, applied to every input row | `(SELECT "col" FROM "ref_x" LIMIT 1)` | single-row / aggregate ancestor (a KPI, an aggregate, an agent answer) — decision #3 |
| **Membership (list)** | the whole ancestor column as a set | `"L" IN (SELECT "value" FROM "ref_x")` | new `is one of` / `is not one of` — decision #2 |
| **Whole (table/document)** | the entire ancestor output | a `ref_<alias>` view / `{{alias}}` token / prompt block | agent context, `create_asset` series, today's `ancestor_refs` default |

**Explicitly deferred:** the **linked / per-item join** mode (n8n's `pairedItem` — "match this
input row to the corresponding ancestor row"). The industry survey shows this is the single
biggest source of bugs (n8n's filed merge/loop `pairedItem` failures, `arch-industry.md` §1.3) —
it stays in the `merge` node / advanced SQL (decision #3: keyed joins are advanced-only). Avoiding
it in v1 sidesteps an entire bug class.

## Why one model is possible (today there are five)

Five structurally-incompatible "how a value gets into the node" mechanisms coexist
(`arch-consume-map.md` §8):

1. **DuckDB view** — transforms: ancestor = `ref_<alias>` view (`transform_runtime.go:633-667`).
2. **Mustache `{{alias}}`** — slides/briefing instructions only (`agent_runtime.go:407-432`).
3. **Prompt-context block** — all agents summarise inputs into the LLM prompt.
4. **Column-name mapping** — `create_asset` `xColumn`/`yColumn`, `ml_model` `featureMappingJSON`.
5. **NONE** — actions and `source` query are static config; **actions never even load
   upstream artifacts** — the single biggest gap.

But all five already sit on **one shared substrate**: the engine emits
`CompiledInput{ToInput:"$ref:"+alias, FieldPath, IsAncestorRef}` for **every** node kind
(`ancestor_refs.go:197-204`), and `LoadUpstreamArtifacts` loads an ancestor ref **identically to a
direct edge** (`claim.go:143-203`). The clean design = **define the reference once, resolve it once,
and adapt only the last mile per kind** — instead of five divergent paths.

There is also a **duality** to collapse: cross-ancestor refs (`config.ancestor_refs[]`) are wholly
separate from intra-node field refs (`clause.left/right`, bare strings resolved against the local
`input`). A node can hold `ancestor_refs=[{alias:"metric",…}]` **and** a condition
`WHERE "region"='EU'` that is oblivious to `ref_metric`. The UI even *claims* conditions substitute
`{{alias}}` — but **that substitution is unimplemented in the worker SQL path**
(`arch-ref-model.md` §1.3/§4.3). This dead promise is exactly the seam we formalize.

## Architecture — four layers

```
                         ┌───────────────────────────────────────────────┐
  CONTRACT (new)         │ contracts/data_reference.json                 │
  one source of truth    │  • usage enum: scalar | list | table | document
                         │  • static channel map (kind → channels[])     │
                         └───────────────────────────────────────────────┘
                                          │ mirrored + sync-test (like the 2 existing contracts)
                         ┌────────────────┴──────────────────────────────┐
  ENGINE                 │ datareference.go  (generalize ancestor_refs.go)│
  graph-shaped logic     │  DataReference{RefID,FromNode,Channel,Field,   │
                         │     Alias, Usage}   (Usage additive, default   │
                         │     table|document = today's behavior)         │
                         │  reuse: reverse-BFS closure · alias rules ·    │
                         │  appendRefInputs (ALREADY runs for every kind) │
                         │  ⇒ ZERO change to the engine→worker wire       │
                         └────────────────┬──────────────────────────────┘
                                          │ $ref:alias + FieldPath + IsAncestorRef (unchanged)
                         ┌────────────────┴──────────────────────────────┐
  WORKER                 │ resolveReferences(step, inputs, sink)  (NEW —  │
  one shared resolver    │ unifies the 5 last-mile sinks)                 │
                         │  sink: duckdbView  (transforms — exists)       │
                         │        textSubst   ({{alias}} — extend to ALL  │
                         │                     agents, not just slides)    │
                         │        binding     (NEW — create_asset cols,  │
                         │                     ml features, ACTION fields,│
                         │                     source query params)  │
                         │  usage picks the sink (scalar→LIMIT 1, list→IN)│
                         └────────────────┬──────────────────────────────┘
                                          │
                         ┌────────────────┴──────────────────────────────┐
  FRONTEND               │ DataReferencePicker  (ONE component, replaces  │
  one picker + operands  │   AncestorFieldPicker + condition free-text/   │
                         │   drag boxes + ML/CreateAsset column selects) │
                         │ operand model: clause.{left,right}SourceRefId  │
                         │ new ops: value__is_one_of / is_not_one_of      │
                         └───────────────────────────────────────────────┘
```

### Layer 1 — Contract `contracts/data_reference.json` (new)

Only the **closed, drift-prone enums** become a contract (mirroring the existing
`workflow_node_kinds.json` / `license_tiers.json` pattern + Go sync-test): the **usage taxonomy**
(`scalar|list|table|document`) and the **static channel map** (`kind → channels[]`) so the frontend
`channelsForKind` and engine `allowedOutputChannelsForNode` stop re-deriving it independently
(`arch-ref-model.md` §3). **Code-only** (not contract): reverse-BFS closure, alias allocation, the
`$ref:`/`ref_` wire encoding, and dynamic channel sets (switch case ids, classification category
ids are data-driven). Cost: one more mirror+test — pays for itself now that the duality is growing.

### Layer 2 — Engine `datareference.go` (generalize `ancestor_refs.go`)

`DataReference{RefID, FromNodeID, FromChannel, FieldPath, Alias, Usage}`. `Usage` is **additive**;
absent → `table|document` (today's exact behavior). Reuse the reverse-BFS ancestor validation, alias
rules, and `appendRefInputs` — which **already emits synthetic inputs for every node kind**, so the
engine→worker bridge needs **zero structural change**. Fix the one inconsistency: `field_path` is
*required* in validation (`ancestor_refs.go:143`) but treated as *optional / whole-output* by the UI
and the input builder — pick one rule (recommend optional = whole output).

### Layer 3 — Worker: one shared `resolveReferences(step, inputs, sink)`

The single missing primitive (`arch-ref-model.md` §4.4). It unifies what are today three inlined /
two absent mechanisms, choosing a **sink** per consuming field:

- **`duckdbView`** — already built (`ref_<alias>` views, `transform_runtime.go:620-714`). Reused
  for transform conditions, `create_asset`/`ml_model` tabular refs.
- **`textSubstitution`** — `{{alias}}` replace; today only slides/briefing call it. **Extend the
  expander to all agents** (general/insight/classification/dashboard) so `{{alias}}` works in any
  agent prompt.
- **`binding`** — **NEW**. A string-templating + value-resolution hook for the kinds that have **no
  injection point today**: action fields (`subject`/`body`/`url`/`headers`/`message`),
  `source` query params, and `create_asset`/`ml_model` column/feature references that point at
  a non-immediate ancestor. **This is where actions finally start loading upstream artifacts.**

`usage` selects the sink: `scalar`→ binding/text via `(SELECT col FROM ref LIMIT 1)`; `list`→ view
via `IN (...)`; `table|document`→ view or prompt block.

### Layer 4 — Frontend: one `DataReferencePicker` + operand model

A single controlled component (`arch-authoring.md` §5) replacing **three** disjoint UXs: the
`AncestorFieldPicker` alias card, the condition free-text+drag boxes, and the bespoke column
`<select>`s in ML/CreateAsset. Composition (all from existing code): node selector ("This input"
default + `collectAncestorSummaries`, each row with `getWorkflowNodeAsset(kind).icon`) → channel
selector (`channelsForKind`) → schema-aware property list (`useAncestorSchemaResolver`,
`FieldRow`/`WholeOutputRow`) → a **usage chip** ("broadcast" / "all" / "whole output") so behavior
is legible (industry P3/P7). Two modes: `binding` (writes `{nodeId,channel,fieldPath}`) and `alias`
(writes `config.*_refs[]` + emits `{{alias}}`).

Operand model (`arch-operators.md` §5): `WorkflowConditionClause` gains optional
`leftSourceRefId` / `rightSourceRefId` (absent = current input — back-compatible); the editor
auto-creates + auto-GCs the matching `ancestor_refs[]` entry; `conditionClauseToSql` emits the ref
subquery; **force SQL** (disable JQ) whenever any clause references a ref (v1 keeps JQ-with-ref out).
New operators `value__is_one_of` / `value__is_not_one_of`.

**Reference by stable node id** (already `from_node_id`), display label resolved separately — so
references survive node renames (industry P1; avoids n8n's by-name fragility).

## Per-node application

| Node | Fields that take a reference | Mode(s) | Worker sink | New work |
|---|---|---|---|---|
| transform filter/if_else/switch | `clause.left`, `clause.right` | broadcast, membership | duckdbView | operand model + ops + SQL-gen |
| transform edit_fields | `rule.value` | broadcast | duckdbView | picker on value |
| transform aggregate | `rule.field`, include/exclude | broadcast, list | duckdbView | picker (multi for include/exclude) |
| transform merge | `fieldMatches[].input1/2` | per-slot binding | duckdbView | per-input-slot picker (not generic) |
| **agents** (all 6) | instructions / examples / fields | whole, broadcast | textSubst + prompt | extend `{{alias}}` to all agents |
| **create_asset** | `xColumn`, `yColumn`, name | whole (series), broadcast (name) | binding | unlock non-immediate ancestor; value templating |
| **ml_model** | `featureMapping` columns | whole/column | binding | unlock non-immediate ancestor |
| **actions** (email/chat/api) | subject/body/url/headers/message | broadcast, whole | **binding (NEW)** | load upstream + `{{alias}}` templating — biggest gap |
| **source** | `query` params | broadcast | **binding (NEW)** | optional query-param substitution |

## Runtime/SQL semantics (the load-bearing details)

- **Scalar (broadcast):** `TRY_CAST("amount" AS DOUBLE) > (SELECT "threshold" FROM "ref_budget"
  LIMIT 1)`. The `LIMIT 1` is **load-bearing** — it makes the subquery provably ≤1 row so DuckDB
  binds it as a scalar regardless of ancestor cardinality, eliminating the "more than one row"
  binder error (`arch-operators.md` §6).
- **Membership:** `CAST("region" AS VARCHAR) IN (SELECT "value" FROM "ref_allowed")` — full column,
  **no LIMIT**. `NOT IN` guards the SQL-NULL trap: `NOT IN (SELECT "value" FROM ref WHERE "value" IS
  NOT NULL)`.
- **Arity rule (one line, prevents the whole bug class):** scalar comparison ops ⇒ always `LIMIT 1`
  on a ref subquery; membership ops ⇒ full column, never `LIMIT`. Enforced at SQL generation + a
  `clauseArity(op)` editor guard.
- **Safety screen: no change required.** `IN`, `(SELECT …)`, `LIMIT`, `JOIN`, CTEs all pass the
  denylist; `safety_test.go` already locks this in (`arch-operators.md` §3). *Optional* additive
  hardening: an allowlist that any generated subquery targets a `ref_*`/`input` view.
- **JQ:** for v1, references force the node to SQL (table payloads). JQ-with-ref (via `--argjson`
  variable binding) is deferred.

## Backward compatibility / migration

`config.ancestor_refs[]` is **not migrated** — it is reinterpreted as `DataReference[]` with implicit
`usage = table|document`. Old plans compile and run **identically** (same `$ref:` / `ref_<alias>`
output). Every new capability is **purely additive**: an optional `usage` field, the per-side clause
discriminant, and new worker sinks. The engine bridge changes **zero** structurally.

## Build order (ships as ONE complete capability — no half-wired modes)

Per the "ship complete, no phasing" rule, this lands as a single cohesive feature; the order below is
*implementation* sequencing, not staged releases:

1. **Shared worker `resolveReferences` + `binding` sink** — unblocks actions / source / asset /
   ml (the kinds with no injection point) and makes the dead "`{{alias}}` in conditions" promise real.
2. **`DataReferencePicker`** component (subsumes the three disjoint pickers).
3. **Operand model + new operators + SQL-gen** for transform conditions.
4. **Wire the picker into every editor** (conditions, edit/agg/merge, agents, actions, ml,
   create_asset) — the "all nodes at once" deliverable.
5. **Contract + engine `Usage` field** (formalize; enables `scalar` single-row enforcement).

## Risks & mitigations

- **Multi-row scalar → binder error** → `LIMIT 1` + arity rule (above).
- **`NOT IN` + NULL** → filter NULLs in the subquery.
- **Type mismatch ref vs input** → `CAST` to VARCHAR/DOUBLE as existing ops do.
- **Fan-in lineage fragility** (n8n's `pairedItem` bug class) → **avoided entirely** by not doing
  per-item linking in v1.
- **`field_path` required-vs-optional inconsistency** → unify the rule in `datareference.go`.
- **Picker regressions on a heavily-used modal** → keep drag-drop as a secondary affordance; the
  picker is additive, type inference preserved.

## Open questions (for the design discussion)

1. **Modes:** confirm v1 = broadcast + membership + whole; per-item "linked join" deferred to
   `merge` / advanced SQL. (Believed yes per decision #3.)
2. **Expression mode:** guided-picker only (matches the prototype) for v1, or also a raw `{{ }}`
   expression editor (n8n-style, sharing the same resolver) now?
3. **Action / source templating:** confirm we want `{{alias}}` token templating in action
   string fields (email body, API url/body, chat message) and `source` query params — this is
   net-new behavior (those nodes have zero injection point today).
4. **Contract file:** OK to add `contracts/data_reference.json` (one more mirror + sync-test)?

## Sources
- Code research: `/tmp/wf_research/arch-consume-map.md`, `arch-ref-model.md`, `arch-authoring.md`,
  `arch-operators.md`. Industry: `arch-industry.md` (n8n / Zapier / Make).
- Backlog + audit: `docs/workflows/feature-audit/enhancement-backlog.md`,
  `current-functionalities.md`, `prototype-vs-current-diff.md`.

---

## Decision log + design addendum (LOCKED 2026-06)

The four open questions are resolved:

1. **Modes — per-item linked join DEFERRED.** v1 ships **broadcast + membership + whole** only.
   Keyed row-wise joins stay in the `merge` node / advanced SQL. No `pairedItem`-style lineage in
   v1 → avoids n8n's fan-in/loop bug class.
2. **Authoring — PICKER *and* RAW EXPRESSION (both in v1).** See the unified dual-authoring design
   below.
3. **Actions + `source` query — IN SCOPE now** via the new worker `binding` sink (the heaviest
   net-new piece; these kinds have zero injection point today).
4. **Contract — proceeding** with `contracts/data_reference.json` (usage enum + static channel map),
   unless objected.

### Dual authoring: guided picker AND raw expression, ONE resolver

Decision #2 means every reference-bearing field offers a **fixed / expression toggle** (n8n's model;
industry P5). The non-negotiable rule: **one reference AST, one evaluator — the picker and the
expression editor must never diverge into two resolvers.**

- **Canonical form (what is stored):** a `DataReference{nodeId, channel, fieldPath, usage}` carried
  as a `config.ancestor_refs[]` entry with an allocated `alias`. This is the single source of truth.
  Both authoring modes are just two editors over the **same** entries.
- **Guided picker** writes the entry structurally (node → channel → property → usage chip) and, for
  a condition, sets `clause.{left,right}SourceRefId` to it.
- **Expression editor** is sugar over the alias. Surface syntax reuses the existing `{{ }}` token
  family (`utils/sqlVariables.ts`): `{{ NodeLabel.field }}` (a field) and `{{ NodeLabel }}` (whole
  output). On insert/parse, the editor **ensures the matching `ancestor_refs` entry exists** (same
  auto-create/auto-GC as the picker) and resolves the node by **stable id** (label is display-only,
  rename-safe). Parsing an expression therefore *populates the same AST* the picker produces.
- **Compilation is shared:** whichever mode authored it, the reference compiles via the **one**
  `resolveReferences` path — scalar → `(SELECT col FROM ref_x LIMIT 1)`, membership →
  `IN (SELECT … FROM ref_x)`, whole → `ref_<alias>` view / `{{alias}}` text. No second code path.
- **Highlighting + live preview (merge with E4):** the expression editor reuses the **existing
  Monaco variable-decoration system** (`CreateComponentWizard/useVariableBindingDecorations.tsx`,
  driven by `extractDeclaredVariables`) for token highlighting — so **E1's expression mode and E4
  (var color highlighting) share the same component**. Live resolved-value preview (n8n data-pinning,
  industry P6) reuses the already-wired `outputDescriptorsByNode` → `useAncestorSchemaResolver`
  sampled-preview pipeline.

**Scope impact:** front-end effort rises from **L** to **L+** (adds an expression parser/serializer
to/from the reference AST, the per-field fixed/expression toggle, token highlighting reused from E4,
and inline resolved-value preview). Engine/worker unchanged from the core plan. **E4 (var
highlighting) is now absorbed into E1's expression editor** rather than a separate item.

### Revised build order (one cohesive ship)

1. Shared worker `resolveReferences` + `binding` sink (unblocks actions / source / asset / ml;
   makes `{{alias}}`-in-conditions real).
2. The reference AST + `DataReference` engine type + `contracts/data_reference.json`.
3. `DataReferencePicker` (guided) **and** the `{{ }}` expression editor over the **same** AST
   (highlighting + live preview shared with E4).
4. Operand model + `is one of` / `is not one of` + SQL-gen for transform conditions.
5. Wire both authoring modes into every editor: transform conditions / edit_fields / aggregate /
   merge, agents, **actions**, ml_model, create_asset, source query — the "all nodes at once"
   deliverable.

---

## Implementation status

### Shipped: condition-operand references (transforms)

`filter` / `if_else` / `switch_cases` guided conditions can reference an ancestor
field as either operand, plus two new operators — implemented entirely in
`frontend/src/components/pages/workflows/nodeConfig/workflowNodeConfigState.ts`
(condition → SQL/JQ generation), riding the existing engine validation + worker
`ref_<alias>` view plumbing with **no server-side change**:

- `WorkflowConditionClause.leftSourceAlias` / `rightSourceAlias` resolve an operand
  to the runtime `ref_<alias>` view (column `value`).
- Scalar broadcast → `<op-cast>((SELECT "value" FROM "ref_x" LIMIT 1))`; the cast
  matches the operator (`TRY_CAST … AS DOUBLE` for number ops, `CAST … AS VARCHAR`
  otherwise) so a numeric ancestor column never raises a type-mismatch binder error.
- `is one of` / `is not one of` → `IN` / `NOT IN (SELECT CAST("value" AS VARCHAR) …)`,
  with a `WHERE "value" IS NOT NULL` guard on the negated form; inline comma-lists
  are also supported. An empty set folds to a constant predicate.
- Aliases are honoured only when they match `^[A-Za-z_][A-Za-z0-9_]{0,63}$` (the same
  pattern the engine validates), so a generated reference can never point at a view
  the runtime did not create.

Covered by unit tests in the sibling `__tests__/workflowNodeConfigState.test.ts`
(scalar L/R, membership IN/NOT-IN with the NULL guard, inline list, empty-set
constants, invalid-alias fallback, switch-case cross-node path, jq behaviour, and a
no-alias regression guard). Adversarially reviewed against DuckDB.

### Resolved constraints (formerly carry-forward)

- **Force SQL when a condition references an ancestor — live, and broadened.** Any
  ancestor reference (guided operand binding or card-added entry) pins the node's
  preferred language to SQL, and the engine rejects compiling a jq transform that
  declares `ancestor_refs` (`WF_COMPILE_ANCESTOR_REF_REQUIRES_SQL`), so the worker's
  "jq transforms require exactly 1 input" runtime failure is unreachable from authored
  configs.
- **The `value` column now exists for every single-value payload.** The worker
  normalises JSON ref views: a bare scalar or array-of-scalars extract (the shapes
  `read_json_auto` exposes as a single auto-named `json` column) is aliased to
  `value` (`json` kept for compatibility), so document-ancestor field refs work, not
  just parquet columns. Object payloads keep their own keys (whole-document table
  usage). A missing ref artifact (e.g. a skipped-empty upstream channel) fails with a
  clear error naming the reference instead of a missing-table binder error.
- **Membership compares in a normalised domain.** Both sides of `IN` project through
  the same fixed-scale DECIMAL-or-text expression, so numerically-equal values match
  across storage types (`DOUBLE 1` ∈ `{INTEGER 1}`) while text/bool/date values
  compare textually. Verified empirically against DuckDB.
- **Scalar broadcasts fail loudly on multi-row ancestors.** The subquery aggregates
  to exactly one row and raises `error('ancestor reference "<alias>" returned
  multiple rows…')` instead of silently comparing an arbitrary row. Empty source →
  NULL (unchanged).
- **Alias contract unified.** `ANCESTOR_REF_ALIAS_RE` and the sanitizers are defined
  once in `ancestorRefWiring.ts` and shared by SQL generation and both pickers
  (mirroring the engine's `validAncestorAliasPattern`), so no layer can mint an alias
  another layer rejects.
- **Reference lifecycle is owned by the data layer.** `normalizeConditionClause`
  drops right-side bindings on operators whose SQL ignores them; reconcile drops
  stamped aliases with no backing `ancestor_refs` entry, keeps auto refs alive while
  the custom program text still references `ref_<alias>` / `{{alias}}`, and the
  manual ref card writes through normalize — so no writer can persist SQL against a
  view that will never be created.

### Operand semantics (confirmed): left = row domain, right = comparison value

The two operand sides carry different semantics — confirmed after the first
broadcast-only implementation proved wrong for the left side:

- **Left bound to ancestor X.field → X becomes the row domain.** The condition
  iterates X's rows (the way it iterates `input` by default) and **Kept /
  Discarded / case channels emit X's rows** — the wired input edge becomes
  execution-ordering only. This is the literal "take input data from any
  ancestor" ask. Mechanics: reconcile mints ONE whole-output `ancestor_refs`
  entry per domain (`field_path: ''`), every left-bound clause shares its
  alias, the left side compiles as a plain column, normalize records
  `transformState.rowSource = "ref_<alias>"`, the engine validates it against
  the declared aliases (`WF_COMPILE_INVALID_ROW_SOURCE`) and passes it as a
  step binding, and the worker swaps the query's `FROM input` for the ref view.
- **One row domain per node.** The first left binding (document order) wins;
  left bindings to any other node are dropped by reconcile, and the editor pins
  further left pickers/tokens to the domain node. For `switch_cases` the domain
  spans ALL cases (a switch routes one stream). Correlating two row streams in
  one condition is the deferred per-item linked join.
- **Right bound to ancestor X.field → comparison value.** Scalar broadcast
  (single-row guarded) or membership set, unchanged.
- The editor shows a banner naming the row-source node whenever a left binding
  is active, since the output-rows change is otherwise invisible.
- Whole-output refs (`field_path: ''`) are now valid at compile — the engine's
  former blanket "missing field_path" rejection contradicted both the worker
  (which supports no-projection refs) and the ancestor-ref card's "Whole
  output" option.

### Shipped: guided picker + typed expression editor (operands)

A condition operand binds to any ancestor field through two interchangeable authoring
modes that write the same `clause.{left,right}Source` and resolve through one path — no
second resolver:

- **Guided picker** (`DataReferencePicker.tsx`) — a node → channel → field popover on each
  operand chip.
- **Typed expression** (`ReferenceExpressionInput.tsx` + `dataReferenceExpression.ts`) — type
  `{{ Node.field }}` (or `{{ Node }}` for whole output) directly; the value parses to the same
  source, resolving the node by stable id (label is display-only, rename-safe). The left
  operand is always reference-aware; the right operand reuses its existing literal/field
  toggle as the fixed/expression switch (`field` mode + a ref-supporting operator). Tokens
  render as pills reusing the SQL editor's `varbind-pill` styling.
- Both modes flow through `normalizeWorkflowNodeConfig → reconcileGuidedAncestorRefs`, which
  derives the alias + `ancestor_refs[]` entry and garbage-collects auto-created refs.
- A field-less `{{ Node }}` token is rejected for a scalar operand (it can't be compared as a
  single value). The same `resolveScalarOperandToken` predicate drives both the pill colour and
  the bind decision, so the UI never shows a bound pill the operand would refuse.
- Leaving ref context — switching to a non-ref operator, or the right mode back to literal —
  clears the operand's reference and any stale token, so nothing orphans an `ancestor_refs`
  entry or compiles as a literal.

Front-end only; no engine/worker change. Tests: `dataReferenceExpression.test.ts`
(parse / format / resolve / scalar-operand), `ReferenceExpressionInput.test.tsx` (pill
bound/unbound, onChange, custom predicate), plus the existing operand SQL-gen + reconcile
suites. Adversarially reviewed (regex determinism, caret/pill alignment, the whole-output
trap, and stale-state clearing).

### Shipped: every consumer node ("all nodes at once")

The reference system now reaches every consuming kind, each through the
mechanism that fits its runtime:

| Consumer | Mechanism |
|---|---|
| `edit_fields` values | per-rule scalar binding (`valueSource`/`valueSourceAlias`, usage `scalar`) compiled as the guarded single-row subquery, picker + `{{ }}` input on the value field |
| `aggregate` | node-level "Source rows" (`guided.aggregateSource`, usage `row_domain`) — generator swaps `FROM input` for the ref view inside its full-SELECT |
| `merge` | per-slot ancestor source (`slot.source`, usage `whole`); wired-table numbering counts only un-bound slots; a slot both bound AND wired is rejected at compile (`WF_COMPILE_MERGE_SLOT_CONFLICT`) and blocked in the editor |
| `create_asset` | "Data from" — top-level `config.rowSource = "ref_<alias>"` (whole-output entry) → step binding → worker selects the artifact by alias; column dropdowns follow the referenced ancestor's schema |
| `ml_model` | same `rowSource` contract for "Features from", plus per-feature scalar refs `config.featureRefs` → `featureRefsJSON` binding → worker broadcasts the value as a column before predict; mutually exclusive with `featureMapping` per feature |
| agents (all kinds) | worker resolves `{{alias}}` in instructions for general / dashboard / insight / classification / slides / briefing; parquet whole-output refs render as JSON rows; instructions editor paints tokens as pills (`ReferenceExpressionTextarea`) |
| actions (chat / email / api) | worker `ref_tokens.go` sink: loads `$ref` artifacts, renders text values (scalar → bare, `{"values":[v]}` → unwrapped, other JSON → compact, parquet → JSON rows, 256KiB cap), substitutes into spec string fields before the idempotency fingerprint; editors mount the reference card + token-pill inputs |
| `source` | same sink substitutes `{{alias}}` into the query (verbatim) before the runner executes it |

Formalization shipped with it: **`contracts/data_reference.json`** (usage enum,
alias grammar, channel map; byte-identical mirrors enforced by
`TestDataReferenceContractCopiesAreIdentical`), `usage` stamped by every
frontend mint and validated at compile (enum + field-path coherence), a
per-kind consumer allowlist (`WF_COMPILE_ANCESTOR_REF_UNSUPPORTED_KIND`),
generalized `rowSource` validation (whole-output required for asset / ml),
and an undeclared-token compile check (`WF_COMPILE_UNDECLARED_REF_TOKEN`)
that activates only once a node declares at least one reference — `{{...}}`
text on nodes with no refs keeps compiling as plain text.

### Remaining (deferred, unchanged)

Per-item linked join (correlating two row streams in one condition). Live
resolved-value preview shipped in its sample-based form: bound operands, ref
chips and the pickers show `≈ value` badges from the last materialised run
(`resolvedRefValue.ts` / `ResolvedRefValueBadge.tsx`); exact re-evaluation
against the current config (n8n data-pinning) is still future work.
