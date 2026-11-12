---
topic: workflows
services: [engine, frontend, worker]
status: current
---
# Ancestor Data References — Implementation Reference

How the unified ancestor data-reference system is built: any consuming node in a
workflow can read data produced by any of its ancestor nodes (not just its wired
predecessor) through one declaration model, one compile path, and a small set of
per-kind runtime sinks. This is the engineering companion to
`E1-unified-data-reference-architecture.md` (design/status); everything below is
grounded in the source files cited.

## Table of contents

1. [Mental model](#1-mental-model)
2. [Data model & contracts](#2-data-model--contracts)
3. [Frontend wiring layer (`ancestorRefWiring.ts`)](#3-frontend-wiring-layer)
4. [Expression & picker UI](#4-expression--picker-ui)
5. [SQL generation (`workflowNodeConfigState.ts`)](#5-sql-generation)
6. [Engine: validation & compilation](#6-engine-validation--compilation)
7. [Worker: runtime sinks](#7-worker-runtime-sinks)
8. [Runtime semantics & failure modes](#8-runtime-semantics--failure-modes)
9. [Testing map](#9-testing-map)
10. [Known limitations / deferred](#10-known-limitations--deferred)

---

## 1. Mental model

A node still iterates its immediate wired input row-by-row. A **reference** is an
explicit, declared way for ancestor data to enter the node in one of a few modes:

| Mode (usage) | Meaning | Runtime shape |
|---|---|---|
| `scalar` | ancestor field reduced to ONE value, broadcast against every row | guarded single-row subquery over `ref_<alias>` |
| `membership` | ancestor column consumed as an `IN` / `NOT IN` candidate set | full-column subquery over `ref_<alias>` |
| `row_domain` | the ancestor's whole output **becomes the rows the node iterates** | `FROM input` swapped for `FROM ref_<alias>` |
| `whole` | whole ancestor output as a table/document artifact | `ref_<alias>` DuckDB view / artifact selection |
| `text` | rendered value substituted into a `{{alias}}` token in a string field | text substitution before the side effect |

Every reference, however it is consumed, is stored the same way: an entry in the
node's `config.ancestor_refs[]` with an `alias`. The engine compiles each entry
into one **synthetic step input** (`$ref:<alias>`); the worker loads that input
exactly like a wired edge and adapts only the last mile per node kind. There is
deliberately **no per-item linked join** (correlating input row N with ancestor
row N) — see §10.

End-to-end flow:

```
editor (picker / {{ }} expression)
  → config.ancestor_refs[] entry + alias stamped on the consuming field
    → normalizeWorkflowNodeConfig → reconcileGuidedAncestorRefs (frontend, every write)
      → engine ValidateAncestorRefsInAuthored (compile-time rejection)
      → engine appendAncestorRefInputs → CompiledInput{ToInput:"$ref:<alias>", IsAncestorRef}
        → worker LoadUpstreamArtifacts (same path as wired edges)
          → per-kind sink: DuckDB ref view | rowSource swap | artifact selector |
            featureRefs broadcast | {{alias}} text substitution
```

---

## 2. Data model & contracts

### 2.1 The `config.ancestor_refs[]` entry

One JSON shape, mirrored field-for-field across frontend and engine:

- Frontend: `AncestorRef` in
  `frontend/src/components/pages/workflows/nodeConfig/AncestorFieldPicker.tsx`.
- Engine: `authoredAncestorRef` in `engine/internal/engine/ancestor_refs.go`.

```ts
export type AncestorRef = {
  ref_id: string;        // stable per-entry id (lifecycle marker, see §3.1)
  from_node_id: string;  // ancestor node id (stable across renames)
  from_channel: string;  // output channel, defaults to "default"
  field_path: string;    // "" = whole output; non-empty = one extracted field
  alias: string;         // names the ref_<alias> view / {{alias}} token
  usage?: string;        // optional consumption intent (contract vocabulary)
};
```

`AncestorRefSource = {fromNodeId, fromChannel, fieldPath}` (in
`ancestorRefWiring.ts`) is the *unsaved* operand-side projection of an entry: it
is what pickers and expression parsing produce, and what clause fields
(`clause.leftSource` / `clause.rightSource`, `rule.valueSource`, `slot.source`,
`guided.aggregateSource`) persist alongside the derived alias. Reconciliation
(§3.5) is what turns sources into `ancestor_refs[]` entries.

### 2.2 The shared contract: `contracts/data_reference.json`

Authoritative file for the three drift-prone enums:

- **`usages.values`** — `row_domain | scalar | membership | whole | text`, with
  per-usage `field_path` coherence notes (row_domain/whole ⇒ empty path,
  scalar/membership ⇒ non-empty, text ⇒ unconstrained).
- **`alias`** — the single alias grammar `^[A-Za-z_][A-Za-z0-9_]{0,63}$`, plus the
  view prefix `ref_` and the wire input prefix `$ref:`.
- **`channel_map.static`** — output channels per node kind (e.g. `filter:
  ["kept","discarded"]`, `if_else: ["true","false"]`); kinds whose channels are
  config-derived (`switch_cases`, `data_classification_agent`) are listed under
  `dynamic` and stay code-resolved.

Byte-identical mirrors (edit only the root contract; re-sync with `cp`):

| Mirror | Consumer |
|---|---|
| `engine/internal/engine/generated/data_reference.json` | embedded via `go:embed` in `engine/internal/engine/datareference.go` |
| `frontend/src/generated/data_reference.json` | imported by `nodeConfig/dataReferenceContract.ts` |

Enforcement is two-layered:

- `TestDataReferenceContractCopiesAreIdentical`
  (`engine/internal/engine/datareference_contract_sync_test.go`) fails when any
  mirror's bytes drift, printing the `cp` command to re-sync.
- `engine/internal/engine/datareference_test.go` asserts the JSON agrees with the
  engine's **own registries** — `alias.pattern` equals
  `validAncestorAliasPattern`, the channel map matches
  `allowedOutputChannelsForNode` — so the contract cannot silently disagree with
  the code that enforces it.

Engine-side access goes through `DataReferenceUsageValues()` /
`DataReferenceUsages()` in `datareference.go`, which lazily parse the embedded
JSON and fall back to a hardcoded copy (`dataReferenceFallbackUsages`) if the
embed is malformed, so a bad mirror cannot crash the engine at startup.
Frontend access goes through `isAncestorRefUsage()` / `ANCESTOR_REF_USAGES` in
`dataReferenceContract.ts` (the `AncestorRefUsage` TS union is hand-mirrored).

### 2.3 The wire form

`appendAncestorRefInputs` (`ancestor_refs.go`) compiles every entry into a
synthetic input appended to the node's `CompiledStep.Inputs` after structural
edge wiring:

```go
CompiledInput{
  FromNodeID:    ref.FromNodeID,
  FromChannel:   ref.FromChannel,   // "" defaulted to "default"
  ToInput:       "$ref:" + alias,   // alias sanitized via aliasSanitize
  FieldPath:     ref.FieldPath,     // "" = whole output, no extraction
  IsAncestorRef: true,
}
```

The worker sees this as `plan.Input`; `isAncestorRefPlanInput`
(`worker/internal/worker/ref_tokens.go`) and `isAncestorRefInput`
(`transform_runtime.go`) recognize it by `IsAncestorRef` **or** the `$ref:`
prefix (belt and suspenders), and `ancestorRefAliasFromToInput` recovers the
alias. Because it is an ordinary step input, `wdb.LoadUpstreamArtifacts` loads
the referenced artifact identically to a wired edge, and a non-empty `FieldPath`
goes through the same field-extraction path wired inputs use (producing the
`{"values":[...]}` envelope normalized in §7.1).

---

## 3. Frontend wiring layer

All in `frontend/src/components/pages/workflows/nodeConfig/ancestorRefWiring.ts`.
This module owns the *lifecycle* of `ancestor_refs[]` entries; editors never
mutate the array directly.

### 3.1 Entry provenance: `ref_id` prefixes

| Prefix | Minted by | GC'd? |
|---|---|---|
| `auto_` (`AUTO_REF_ID_PREFIX`) | operand pickers / expression parsing via `ensureAncestorRef` | yes — collected when unreferenced |
| `ext_` (`EXTERNAL_REF_ID_PREFIX`) | `readAncestorRefs` for entries that arrived without a `ref_id` (API / other clients) | never |
| anything else | the standalone ancestor-ref card (`AncestorFieldPicker`) | never |

Only `auto_` entries are garbage-collected, so a manually added or externally
authored reference is never removed underneath the author.

### 3.2 Alias allocation

- `ANCESTOR_REF_ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/` — the single
  frontend definition of the contract grammar (mirrors the engine's
  `validAncestorAliasPattern` and the worker's `rowSourcePattern`).
- `sanitizeAlias(raw)` coerces free text into the grammar: trim, replace illegal
  runs with `_`, prefix a leading digit with `_`, slice to 64, fall back to
  `"ref"`.
- `makeUniqueAlias(desired, taken)` suffixes `_2`…`_999` for uniqueness. The
  base is pre-trimmed to 60 chars before suffixing — a near-64-char base would
  otherwise slice every suffixed candidate back to the already-taken base.

### 3.3 `ensureAncestorRef(refs, source, aliasHint, usage?)`

The single mint/reuse primitive. Dedupe key is the full **source triple**
(`from_node_id`, `from_channel`, `field_path`) — the same field picked twice
shares one alias/view. Usage stamping rules:

- New entry: stamp the caller's `usage` (if given).
- Existing entry: re-stamp **only** when the entry has no usage yet or its
  `ref_id` starts with `auto_` (an operator toggling between scalar and
  membership re-stamps its own auto entry); a manual entry's declared usage is
  never overwritten.

### 3.4 Read / write / collect / GC

- `readAncestorRefs(config)` — acceptance deliberately mirrors the **engine's**
  minimum (`from_node_id` + `alias`; `field_path` may be empty), not a stricter
  local rule: anything the engine would compile must survive an editor
  round-trip. Defaults: missing `from_channel` → `"default"`, missing `ref_id`
  → `ext_<alias>`, non-contract `usage` dropped via `isAncestorRefUsage`.
- `writeAncestorRefs(config, refs)` — writes the array, deleting the key
  entirely when empty.
- `collectUsedAliases(guided)` — every alias the guided model references:
  condition and switch-case operands (`leftSourceAlias`/`rightSourceAlias`),
  `edit_fields` rule `valueSourceAlias`, `aggregateSourceAlias`, merge
  `inputSlots[].sourceAlias`.
- `collectTextAliases(text, out)` — aliases a hand-written program keeps alive,
  in either consumable form: `\bref_<alias>\b` (custom SQL view name) or
  `{{alias}}` (template token).
- `gcAncestorRefs(refs, guided, programText?)` — drops `auto_` entries
  referenced by neither; returns the input array identity when nothing changes.

### 3.5 `reconcileGuidedAncestorRefs(guided, existingRefs, programText?)`

The reconciliation pass that runs on **every** normalize (§3.6). Semantics:

- **Left operand ⇒ row domain.** The first left-bound clause in document order
  (conditions first, then switch cases) establishes the node's row domain
  (`guidedRowDomain` is the read-only twin used by editors). One whole-output
  entry (`field_path: ''`, usage `row_domain`, alias hint `"row_domain"` — the
  hint argument is the node id) is minted per domain; every left-bound clause in
  that domain shares its alias and has `clause.left` kept in sync with the bound
  column (`fieldPath`). Left bindings to any **other** node are dropped
  (first-wins; one node iterates one stream), and a bare `leftSourceAlias`
  without a backing `leftSource` is cleared.
- **Right operand ⇒ comparison value.** Each right source gets its own
  field-path entry via `ensureAncestorRef`, usage derived from the operator
  (`membership` for `value__is_one_of`/`value__is_not_one_of`, else `scalar`).
- **`edit_fields` rule `valueSource`** ⇒ field-path entry, usage `scalar`.
- **`aggregateSource`** ⇒ whole-output entry, usage `row_domain` (normalized via
  `normalizeWholeOutputSource`, which forces `fieldPath: ''`).
- **Merge `slot.source`** ⇒ whole-output entry, usage `whole`.
- **Dangling-alias drop:** a stamped alias with no usable source must still
  point at a real entry (`aliasIsBacked`) — the standalone card can supply one —
  otherwise it is cleared, because its SQL would reference a runtime view that
  is never created.
- **GC last:** `gcAncestorRefs` runs over the reconciled guided state plus the
  custom program text.
- **Identity short-circuit:** every sub-step returns the original object when
  nothing changed, so an unchanged config produces referentially identical
  `guided`/`refs` and no spurious store writes.

Returns `{guided, refs, rowSourceAlias?}` — `rowSourceAlias` is the domain alias
normalization persists as `transformState.rowSource` (§3.6).

`normalizeOperandSource` / `normalizeWholeOutputSource` are the input
validators: an operand source needs a non-empty `fieldPath`; a whole-output
source normalizes `fieldPath` to `''`; both default `fromChannel` to
`"default"` and preserve identity when already normalized.

### 3.6 The normalize pipeline

`normalizeWorkflowNodeConfig(kind, rawConfig)`
(`nodeConfig/workflowNodeConfigState.ts`) is the single config writer for
transform kinds. Order matters:

1. `normalizeGuided` — shape the guided model (incl. `normalizeConditionClause`,
   §5.6).
2. `reconcileGuidedAncestorRefs(guidedRaw, readAncestorRefs(input), customSource)`
   — derive entries/aliases; the custom program text is passed so hand-written
   `ref_<alias>` / `{{alias}}` keep their refs alive.
3. `usesAncestorRef = guidedUsesAncestorRef(guided) || refs.length > 0` →
   `preferredLanguageFor(...)` pins the node to SQL whenever any reference
   exists (§5.7).
4. `rowSource` stamping: `...(reconciled.rowSourceAlias ? { rowSource:
   "ref_<alias>" } : {})` on `transformState`.
5. `generatedProgramsFor(kind, guided)` — regenerate SQL/JQ programs (§5).
6. `writeAncestorRefs(input, reconciled.refs)` writes the array back.

Every editor mutation funnels through this function (the manual ref card writes
through it too), so no writer can persist a clause alias, rowSource, or program
that disagrees with `ancestor_refs[]`.

---

## 4. Expression & picker UI

### 4.1 Token grammar & resolution — `dataReferenceExpression.ts`

Two token shapes, reusing the builder's `{{ }}` family:
`{{ Node }}` (whole output) and `{{ Node.field.path }}` (one field). Mechanics:

- `TOKEN_RE_G = /\{\{([^{}]*)\}\}/g` — `[^{}]` forbids nested braces so a stray
  `{` cannot swallow the rest of the string. `hasReferenceToken` uses its own
  non-global regex (a shared `/g` regex carries `lastIndex` across `.test()`
  calls and would alternate results).
- `resolveNodeSegment`: stable **node id wins**, then unique exact label, then
  unique case-insensitive label; ambiguity ⇒ null. References therefore survive
  node renames (the label is display-only sugar).
- `resolveReferenceToken`: tries the whole segment as a node first (handles
  labels containing dots), then splits at the **first** dot into node + field
  (the field may itself be a dotted JSON path). Channel = the ancestor's first
  channel.
- `parseReferenceExpression`: the value must be exactly ONE token with nothing
  but whitespace around it — operands are single references, not interpolated
  text.
- `formatReferenceExpression`: emits the label only when unambiguous and
  dot-free (round-trips cleanly), else the node id.
- Scalar-operand predicates: `resolveScalarOperandToken` /
  `parseScalarOperandReference` additionally require a non-empty `fieldPath` — a
  whole-output token cannot be compared as a single value. The same predicate
  drives both the pill color and the bind decision, so the UI never shows a
  bound pill the operand would refuse.

### 4.2 `ReferenceExpressionInput.tsx` (single line) / `ReferenceExpressionTextarea.tsx` (multiline)

A transparent `<input>` (text color transparent, visible caret) layered over a
**mirror element** that paints the same characters with tokens rendered as
pills (`varbind-pill-bound` blue / `varbind-pill-unbound` dashed; CSS lives in
`frontend/src/components/common/variableBindingPills/variableBindingPills.css`,
shared with the SQL editor's variable pills). Load-bearing details:

- The mirror is scroll-synced to the input (`mirrorRef.scrollLeft =
  inputRef.scrollLeft`) so pills stay under the caret on long values.
- Pills have **zero horizontal padding** (`PILL_STYLE`): any horizontal padding
  would widen the mirror's glyph advance relative to the input's plain text,
  desynchronizing caret position from the painted text. Vertical padding is
  safe.
- The bound/unbound predicate is injectable (`isTokenBound` prop), defaulting to
  the scalar-operand rule; the textarea variant applies the same mirror trick to
  a `<textarea>` for agent instructions / action bodies.

### 4.3 `DataReferencePicker.tsx`

The guided popover: node → channel → field. Key props/behaviors:

- `allowWholeOutput` adds a "whole output" row; `wholeOutputOnly` restricts the
  picker to node+channel selection (used by row-domain/"data from" selectors);
  `wholeOutputEnabled = allowWholeOutput || wholeOutputOnly`.
- **Open-gated schema resolution:** the field list resolves
  `schemaForAncestor(nodeId, channel)` only while the popover is open and a
  draft ancestor is selected (`if (!open || wholeOutputOnly || ...) return
  null`), so closed pickers never trigger sampled-schema fetches.
- **Draft reseeding:** the draft node/channel state only matters while open and
  re-seeds from the current value each time the popover opens; dismissal
  discards the draft without touching the bound value.
- Emits an `AncestorRefSource`; the caller (operand chip, value field, slot
  selector) passes it into the normalize pipeline — the picker itself never
  writes `ancestor_refs[]`.

### 4.4 `AncestorFieldPicker.tsx` (the standalone card)

The per-node "Ancestor references" card: lists `config.ancestor_refs[]`,
lets authors add/edit/remove entries by hand (including the "Whole output"
option ⇒ `field_path: ''`), edit aliases (validated against
`ANCESTOR_REF_ALIAS_RE`), and optionally emits the `{{alias}}` token to an
instruction editor via its insert callback. Entries created here get
non-`auto_` ref_ids, so GC never collects them; writes go through the same
normalize pipeline.

---

## 5. SQL generation

All in `frontend/src/components/pages/workflows/nodeConfig/workflowNodeConfigState.ts`.
The frontend generates the full SQL the worker executes; the worker only swaps
`FROM` targets and creates views.

### 5.1 Scalar broadcast — `ancestorScalarSubquerySql(alias)`

```sql
(SELECT CASE WHEN COUNT(*) > 1
        THEN error('ancestor reference "x" returned multiple rows; ...')
        ELSE ANY_VALUE("value") END
 FROM "ref_x")
```

Why this shape: the aggregate form returns **exactly one row whatever the
ancestor's cardinality**, so DuckDB binds it as a scalar (no "more than one row
returned by a subquery" binder error). A single-row source yields its value, an
empty source yields NULL, and a multi-row source fails loudly via `error()`
naming the reference — silently comparing against an arbitrary row would
corrupt results with no signal. Aliases failing `ANCESTOR_REF_ALIAS_RE` return
null (callers fall back to literal handling), so generated SQL can never name a
view the runtime would not create.

### 5.2 Casts — `ancestorScalarOperandSql` / `ancestorScalarValueSql`

- `ancestorScalarOperandSql(alias, operator)` wraps the subquery in the same
  cast the operator applies to its other side: `TRY_CAST(... AS DOUBLE)` for
  `number__*`, else `CAST(... AS VARCHAR)` — without it a numeric ancestor
  column vs. a VARCHAR-cast operand raises a type-mismatch binder error.
- `ancestorScalarValueSql(alias, propertyType)` is the `edit_fields` variant,
  casting to the rule's declared property type: `TRY_CAST` for number/boolean
  (unparseable ⇒ NULL rather than failing the query), plain `CAST(...AS
  VARCHAR)` for text.

### 5.3 Membership — `membershipValueSql` / `ancestorListSubquerySql`

Both sides of `IN` project through one normalizing expression:

```sql
COALESCE(CAST(TRY_CAST(CAST(expr AS VARCHAR) AS DECIMAL(38,10)) AS VARCHAR),
         CAST(expr AS VARCHAR))
```

- **Why DECIMAL(38,10):** plain VARCHAR casts render `DOUBLE 1` as `'1.0'` but
  `INTEGER 1` as `'1'`, silently failing membership for numerically equal
  values. Values that parse as numbers re-render at a fixed scale (`'1'`, `1`,
  `1.0` all become `'1.0000000000'`); everything else (text/bool/date) compares
  textually via the COALESCE fallback.
- **Why the VARCHAR hop** before `TRY_CAST(... AS DECIMAL)`: keeps the cast
  bindable for column types DECIMAL does not accept directly.
- **Tradeoff:** numeric-looking text is compared numerically, so `'007'` equals
  `'7'` — leading zeros are not membership-distinct.
- `ancestorListSubquerySql(alias, excludeNull)` emits `(SELECT
  <membership("value")> FROM "ref_x"[ WHERE "value" IS NOT NULL])`; the NULL
  guard applies on the negated form only, avoiding the three-valued-logic trap
  where one NULL makes `NOT IN` return zero rows. `inlineMembershipListSql`
  handles comma-separated literals through the same projection. An empty set
  folds to a constant: `is one of {}` ⇒ `FALSE`, `is not one of {}` ⇒ `TRUE`
  (`conditionClauseToSql`, `value__is_one_of` branch).

### 5.4 Row domain & per-kind generation

- **Conditions (`conditionClauseToSql`):** the left side is always a **plain
  column** of the row domain (`sqlIdentifier(clause.left)`); only the right side
  resolves through subqueries (`rightSourceAlias` →
  `ancestorScalarOperandSql(...) ?? sqlValueReference(...)`). When the left
  operand is bound, normalization records `transformState.rowSource =
  "ref_<alias>"` and the **worker** swaps `FROM input` for the ref view (§7.2)
  — predicate programs carry only the WHERE expression, so the frontend cannot
  embed the FROM itself.
- **`edit_fields` (`generatedProgramsFor`):** a rule with `valueSourceAlias`
  projects `ancestorScalarValueSql(...) AS <field>` — the binding owns the
  value regardless of `valueMode` while it exists.
- **`aggregate`:** full-SELECT generators embed the FROM directly: `from =
  ancestorRefViewIdentifier(aggregateSourceAlias) | 'input'` — no worker-side
  swap needed, unlike predicate transforms.
- **`merge`:** per-slot table map. A bound slot reads `ref_<alias>`; wired
  slots take `input_<n>` where **n counts only un-bound slots in slot order**
  (`slotTables` with `wiredCount`). This must match the worker exactly: the
  worker orders merge inputs by slot (`orderTransformInputs`) and numbers views
  per non-ref input — ancestor-ref inputs become `ref_<alias>` views and never
  consume a number (§7.1). The engine rejects a slot that is both bound and
  wired (§6.2) precisely because that would desynchronize the two numbering
  schemes.

### 5.5 Operator gating — `operatorSupportsRightRef`

Right-side bindings are allowed only on operators whose SQL consumes the right
operand as an expression: `string__is_equal_to`, `string__is_not_equal_to`,
`number__*`, and the membership pair. Temporal and pattern operators
(contains/starts/ends) bake the right side in as a typed literal, so a binding
there would be silently ignored. This one predicate drives the operand UI, the
data-layer gating in `normalizeConditionClause`, and matches exactly which
branches of `conditionClauseToSql` read `rightSourceAlias`.

### 5.6 Data-layer invariants — `normalizeConditionClause`

Run on every clause from any writer (paste, API, older clients):

- Unknown operator → `string__is_equal_to`.
- `leftSourceAlias` / `rightSourceAlias` pass `sanitizeSourceAlias` (grammar
  check, not coercion — invalid aliases are dropped, never rewritten).
- Right binding dropped when `!operatorSupportsRightRef(operator)` — a config
  can never carry a binding the generated SQL would ignore while keeping a
  phantom ref view alive.
- Membership with no binding forces `rightMode: 'literal'` (a same-row "field"
  right mode is meaningless against a list).

### 5.7 Language forcing — `preferredLanguageFor`

First rule: `if (usesAncestorRef) return 'sql'` — a `ref_<alias>` view exists
only in the DuckDB runtime, never jq. `guidedUsesAncestorRef` covers all five
binding surfaces (condition/case operands, edit rules, aggregate source, merge
slots); `normalizeWorkflowNodeConfig` additionally ORs in `refs.length > 0` so
even card-only refs pin SQL. The engine backstops this with
`WF_COMPILE_ANCESTOR_REF_REQUIRES_SQL` (§6.1).

---

## 6. Engine: validation & compilation

All in `engine/internal/engine/` (`ancestor_refs.go` unless noted).

### 6.1 `ValidateAncestorRefsInAuthored(doc)` — the compile-time walk

Per non-trigger, non-sticky node with config (malformed config JSON is skipped
here — the kind-specific validator owns that diagnostic):

1. **rowSource** (`nodeRowSourceFor`, `compile.go` — transform kinds carry it at
   `transformState.rowSource`, create_asset/ml_model at top-level
   `config.rowSource`): must be `ref_<alias>` with a grammar-valid alias AND
   match a declared entry (`WF_COMPILE_INVALID_ROW_SOURCE`). For
   `create_asset`/`ml_model` the matched entry must be whole-output
   (`field_path` empty) — node-level data selection swaps the entire data input,
   not one extracted field.
2. **Undeclared tokens** (`validateRefTokensDeclared`): scans the fields the
   worker substitutes (`refTokenScanFields` — agent instructions; chat message;
   email to/cc/bcc/subject/body; API url/body/header values; source
   query) for `{{alias}}` (`refTokenPattern`, mirroring the worker's regex) and
   rejects aliases not declared on the node
   (`WF_COMPILE_UNDECLARED_REF_TOKEN`). **Activation rule:** only once the node
   declares ≥1 reference — `{{...}}`-shaped text on ref-less nodes is
   long-standing plain text (agent prompts), not a broken reference. Transform
   SQL/jq and asset/ml expression inputs are deliberately not scanned: `{{ }}`
   carries other meanings there.
3. **Merge slots** (`validateMergeSlotSources`): a slot with a `sourceAlias`
   that also has a wired edge (edge `ToInput` = slot id) →
   `WF_COMPILE_MERGE_SLOT_CONFLICT` (see §5.4 for the numbering rationale).
4. **ML feature refs** (`validateMLModelFeatureRefs`): every non-blank
   `config.featureRefs` value must name a declared alias, and a feature may not
   appear in both `featureRefs` and `featureMapping` (ambiguous broadcast) —
   both `WF_COMPILE_INVALID_ANCESTOR_REF`.
5. **Consumer allowlist** (`ancestorRefConsumerKinds`): declaring refs on any
   kind outside the set (transforms, agents, create_asset, ml_model, actions,
   source) → `WF_COMPILE_ANCESTOR_REF_UNSUPPORTED_KIND`. **`ml_predict` is
   intentionally excluded**: its runtime reads only modelId/inputsJson bindings
   — no rowSource, featureRefs, or token substitution — so declared refs would
   add scheduling gates (§8.1) with zero data effect.
6. **jq rejection**: a transform whose `transformLanguageFor` resolves to jq
   cannot declare refs (`WF_COMPILE_ANCESTOR_REF_REQUIRES_SQL`) — the worker's
   jq path requires exactly one input and would hard-fail on synthetic inputs.
7. **Per-entry checks** against the reverse-BFS ancestry closure
   (`authoredUpstreamMemo` — predecessors map + memoized per-target closure,
   computed once per doc): `from_node_id` non-empty and inside the closure;
   alias non-empty, grammar-valid, unique per node; non-empty `ref_id` unique
   per node; `usage` (when present) in the contract vocabulary
   (`DataReferenceUsages`) **and** coherent with `field_path` —
   row_domain/whole ⇒ empty, scalar/membership ⇒ non-empty
   (`WF_COMPILE_ANCESTOR_REF_USAGE_FIELD_MISMATCH`). An empty `field_path` is
   the valid whole-output form.

### 6.2 Compilation

- `appendAncestorRefInputs` (§2.3) re-checks ancestry (defense in depth) and
  appends the synthetic inputs after edge wiring.
- **Bindings** (`compile.go`): transforms pass `rowSource` in **both** authoring
  modes (guided and advanced custom); create_asset passes top-level
  `config.rowSource` when ≠ `"input"`; ml_model passes `rowSource` plus
  `featureRefsJSON` — featureRefs are pruned of blank keys/values (so a
  round-tripped empty map does not rotate the bindings hash) and serialized
  with `json.Marshal`, whose sorted map keys make the binding byte-deterministic
  for idempotency hashing.

---

## 7. Worker: runtime sinks

All in `worker/internal/worker/`.

### 7.1 DuckDB views — `registerDuckDBInputs` (`transform_runtime.go`)

For every SQL transform, inputs split into wired edges (`input_<n>` views,
`input` aliased to `input_1`) and ancestor refs (`ref_<alias>` views). Ref view
creation by payload:

| Materialized payload | View body (`refViewSelect`) |
|---|---|
| parquet table | `SELECT * FROM read_parquet(...)` |
| JSON `{"values":[...]}` (field-extraction envelope) | `SELECT unnest(values) AS value FROM read_json_auto(...)` — one row per element |
| JSON bare scalar / array of scalars / null | `SELECT json AS value, json FROM read_json_auto(...)` — `read_json_auto` exposes one auto-named `json` column; aliased so `value` exists (and `json` kept for older hand-written SQL) |
| JSON object / array of objects | `SELECT * FROM read_json_auto(...)` — the object's keys are the columns; no single value to expose |
| unparseable bytes | `SELECT * FROM read_json_auto(...)` (best effort) |

The contract: generated SQL compares against `ref_<alias>.value`, so every
shape that HAS a single value must surface it under that name.

Missing artifacts are pre-checked by `requireAncestorRefArtifactsMatching(step,
inputs, needed)`, gated by `transformProgramUsesRef` — a ref is *needed* only
when the program text mentions `ref_<alias>` or the `rowSource` binding selects
it. Needed-but-absent → a clear "ancestor reference %q: upstream node %s
produced no data on channel %s" instead of an opaque DuckDB "Table ref_x does
not exist" binder error; not-needed refs stay silently absent. Ref-only
transforms (zero wired edges) wire `input` to the first ref view so guided SQL
saying `FROM input` keeps working.

### 7.2 Row-domain FROM swap — `transformRowSource` + `buildSQLOutputQueries`

`transformRowSource(step)` reads `step.Bindings["rowSource"]` (default
`"input"`; otherwise must match `rowSourcePattern =
^ref_[A-Za-z_][A-Za-z0-9_]{0,63}$`). Predicate kinds then template it into every
output query:

- `filter`: `SELECT * FROM <rowSrc> WHERE (p)` / `WHERE NOT ((p))` → kept /
  discarded, both `SkipEmpty`.
- `if_else`: same for true / false.
- `switch_cases` (`buildSwitchSQLOutputQueries`): per-case `SELECT * FROM
  <rowSrc> WHERE (cond)`; when `SendToAllMatchingCases` is off, each case ANDs
  `NOT (previous conditions)` (first-match exclusivity); the else channel is
  `SELECT * FROM <rowSrc> [WHERE NOT (all conditions)]`.

So binding a condition's left operand to an ancestor literally makes that
ancestor's rows the data being filtered/routed; the wired edge degrades to an
execution-ordering dependency.

### 7.3 Artifact selectors — create_asset & ml_model

`selectRowSourceUpstream(step, upstream)` (`ref_tokens.go`) resolves the
node-level `rowSource` binding: absent/`"input"` → `pickTabularUpstream`, which
**skips ancestor-ref artifacts** — refs added for token substitution or
broadcast must never shadow the wired table; `ref_<alias>` → the matching ref
artifact, required to be parquet (clear errors distinguish "not tabular",
"produced no data on channel", and "no such alias on this step").

- `selectCreateAssetSource` (`create_asset_runtime.go`) applies it to pick the
  table the asset is built from; column dropdowns in the editor follow the
  referenced ancestor's schema.
- `selectMLModelSource` (`ml_model_runtime.go`) picks the feature table, then
  `applyFeatureRefValues` broadcasts each `featureRefsJSON` entry: the
  referenced scalar (a whole-table ref is rejected — "bind a single field so
  one value can be broadcast") is written onto **every** input row as the
  feature column before batch prediction. Failures use
  `WF_ML_MODEL_FEATURE_REF`.

### 7.4 Text substitution — `ref_tokens.go`

The shared sink for source queries and action specs.

- `loadAncestorRefValues(ctx, ticket, step)` filters `$ref:` inputs, loads them
  via `wdb.LoadUpstreamArtifacts`, materializes into a temp dir, renders each to
  text keyed by alias. Steps without ref inputs return nil without touching DB
  or storage; the returned cleanup is always safe to defer.
- `renderRefValueText` — the value-rendering contract:
  - whole-output parquet → compact JSON array of row objects (≤
    `refValueMaxRows` = 2000; read limit is rows+1 so "at cap" vs "over cap" is
    distinguishable without materializing everything);
  - JSON string scalar → bare string (no quotes); number/bool/null → literal
    text; `{"values":[v]}` single element → unwrapped; multiple → compact JSON
    array; **empty → error** ("field extraction produced no value");
  - other JSON → compact JSON; non-JSON bytes → verbatim trimmed.
  Every rendered value passes `capRefValueText` (`refValueMaxBytes` = 256 KiB,
  fails loudly rather than truncating — a clipped JSON inside a SQL string is
  far harder to diagnose); the fully-resolved text additionally passes
  `checkResolvedTextBudget` (`refResolvedTextMaxBytes` = 1 MiB) since repeated
  tokens multiply.
- `resolveRefTokens(text, vals)` — **verbatim** substitution (the author writes
  any quoting the surrounding syntax needs); an unknown alias is an error: a
  half-substituted query or outbound payload must never reach an external
  system.
- `resolveRefTokensInActionSpec(actionKind, specJSON, vals)` — per-kind fields:
  chat `message`; email `to/cc/bcc/subject/body`; API `url/body/header values`.
  Header-bound email fields substitute through `stripCRLFFromValues` (CR/LF
  removed) so referenced data can never inject SMTP headers (e.g. an
  attacker-controlled cell adding a Bcc); the body keeps newlines. The
  source-mode `apiRequest` blob is passed through untouched (a saved
  request definition, not author text). Re-marshalling via structs keeps field
  order deterministic.
- **Timing** (`action_runtime.go`): substitution runs **before** the
  idempotency fingerprint (`sha256(specJSON)`) is computed, so the fingerprint
  covers the payload that actually leaves the system. Step artifacts are
  immutable within a run, so a retry re-renders identical values and hashes to
  the same key (short-circuit still fires), while the action journal records
  real outbound content instead of an unresolved template.
- **source** (`executor.go`, `runSource`): same sink resolves
  `{{alias}}` in the query text before it ships to the runner, with the same
  per-value and total budgets (`WF_SOURCE_REF_RESOLVE` on failure).

### 7.5 Agent instructions — `agent_runtime.go`

`expandWorkflowInstructionAliases(ctx, instr, inputs)` substitutes `{{alias}}`
in agent instructions: whole-output parquet refs render as JSON row objects
(sampled to `agentSampleRowCount*2` and per-field truncated like
`buildAgentContext` — raw parquet bytes are useless in a prompt); everything
else substitutes file contents verbatim; each value is clipped to
`agentRefInlineBudget` on a rune boundary (`safeTruncate`).

Unlike actions/queries, substitution is **per-token lenient**
(`expandAgentInstructionsLenient`): prompts are free-form text, so unresolved
tokens stay verbatim with a warning log, and an unreadable ref artifact falls
back to the raw instructions instead of failing the step. Call sites cover the
general/insight/classification/dashboard runner and the Infusion slides/briefing
path (`agent_runtime.go:389`, `:695`, `:748`), i.e. every agent kind.

---

## 8. Runtime semantics & failure modes

### 8.1 Scheduling gates from synthetic inputs

A step is enqueued only when **every** `CompiledInput` is satisfied — including
synthetic `$ref:` inputs. The readiness rule (engine
`enqueueReadyStepsTx` in `engine/internal/service/runtxhelpers.go`, mirrored by
the worker's `EnqueueReadyStepsScoped` in `worker/internal/worker/enqueue.go`):
the source step must be `succeeded` AND have emitted an output on the requested
channel; a succeeded step with **no** channel outputs at all is treated as
satisfied (pure control flow).

Consequences for references:

- Referencing an ancestor adds an execution-ordering dependency even when no
  edge exists — the consumer cannot start before the referenced node finishes.
- A **skipped-empty channel** (e.g. a filter's `kept` with zero rows —
  `SkipEmpty` outputs in `transform_runtime.go` write no artifact) on a node
  that emitted other channels leaves the ref input unsatisfied: the consuming
  step is **never enqueued** (it ends the run unstarted, not failed).
- If the referenced node emitted no channels at all, the gate passes and the
  **missing-artifact** check fires instead at run time (§7.1/§7.4): "ancestor
  reference %q: upstream node %s produced no data on channel %s" — the same
  error text across the transform-view, token, and rowSource paths by design.

### 8.2 Named error codes

| Code | Layer | Trigger |
|---|---|---|
| `WF_COMPILE_INVALID_ANCESTOR_REF` | engine | missing `from_node_id` / non-ancestor source / undeclared or conflicting ml featureRef |
| `WF_COMPILE_INVALID_ANCESTOR_ALIAS` | engine | alias fails the contract grammar |
| `WF_COMPILE_DUPLICATE_ANCESTOR_ALIAS` / `..._REF_ID` | engine | duplicate alias / ref_id on one node |
| `WF_COMPILE_INVALID_ANCESTOR_REF_USAGE` | engine | usage outside the contract vocabulary |
| `WF_COMPILE_ANCESTOR_REF_USAGE_FIELD_MISMATCH` | engine | usage vs. `field_path` coherence violation |
| `WF_COMPILE_INVALID_ROW_SOURCE` | engine | rowSource not `ref_<alias>` / no matching entry / non-whole-output entry on asset/ml |
| `WF_COMPILE_ANCESTOR_REF_UNSUPPORTED_KIND` | engine | refs declared on a kind outside `ancestorRefConsumerKinds` |
| `WF_COMPILE_ANCESTOR_REF_REQUIRES_SQL` | engine | jq transform declaring refs |
| `WF_COMPILE_UNDECLARED_REF_TOKEN` | engine | `{{alias}}` token with no declared alias (once ≥1 ref declared) |
| `WF_COMPILE_MERGE_SLOT_CONFLICT` | engine | merge slot both bound and wired |
| `WF_COMPILE_ML_MODEL_REFS_MARSHAL` | engine | featureRefs binding serialization failure |
| `WF_ACTION_REF_RESOLVE` | worker | action ref load/render/substitution failure |
| `WF_SOURCE_REF_RESOLVE` | worker | query ref load/render/substitution/budget failure |
| `WF_ML_MODEL_FEATURE_REF` | worker | feature ref load or broadcast failure |

Transform-path failures (missing ref artifact, multi-row scalar via DuckDB
`error(...)`, invalid rowSource binding) surface through the generic transform
step-failure path with the explicit message text rather than a dedicated code.

---

## 9. Testing map

| Suite | What it locks in |
|---|---|
| `frontend/.../nodeConfig/__tests__/workflowNodeConfigState.test.ts` | operand SQL-gen: scalar L/R, membership IN/NOT-IN + NULL guard, inline lists, empty-set constants, invalid-alias fallback, switch cross-node paths, jq behavior, rowSource stamping, no-alias regressions |
| `__tests__/ancestorRefWiring.test.ts` | ensure/GC/reconcile lifecycle, alias allocation, row-domain first-wins, dangling-alias drops, read/write leniency |
| `__tests__/dataReferenceExpression.test.ts` | token parse/format/resolve round-trips, scalar-operand predicates |
| `__tests__/ReferenceExpressionInput.test.tsx`, `__tests__/DataReferencePicker.test.tsx` | pill bound/unbound rendering, onChange, custom predicates; picker draft/whole-output/schema gating |
| `__tests__/AncestorFieldPicker.test.tsx`, `TransformNodeConfigEditor.refs.test.tsx`, `CreateAssetNodeConfigEditor.test.tsx`, `MLModelNodeConfigEditor.test.tsx`, `AgentNodeConfigEditor.test.tsx`, `ActionNodeConfigEditor.test.tsx` | per-editor wiring of the card, pickers and token inputs |
| `engine/internal/engine/ancestor_refs_test.go` | the full validation walk + `appendAncestorRefInputs` wire form |
| `engine/internal/engine/datareference_test.go` + `datareference_contract_sync_test.go` | contract↔registry agreement; byte-identical mirrors |
| `worker/internal/worker/ref_tokens_test.go` | value rendering, caps, action-spec substitution, CRLF stripping, rowSource selection |
| `worker/internal/worker/transform_runtime_test.go` | ref view shapes, missing-artifact gating, FROM swap, merge ordering |
| `worker/internal/worker/agent_runtime_test.go`, `ml_model_runtime_test.go`, `create_asset_runtime_test.go`, `action_runtime_test.go` | per-kind sink behavior |

Run with `make test-engine`, worker Go tests, and `frontend/` vitest (see
`frontend/vitest.config.mts`).

---

## 10. Known limitations / deferred

- **Per-item linked join.** Correlating input row N with ancestor row N
  (n8n-style `pairedItem`) is deliberately unsupported; keyed row-wise joins
  live in the `merge` node or hand-written SQL. This sidesteps the fan-in
  lineage bug class entirely — one node iterates exactly one row stream.
- **Live value preview — shipped (last-run samples).** Bound operands, ref
  chips, row-source labels and the pickers show `≈ value` badges resolved from
  the last materialised run's preview (`nodeConfig/resolvedRefValue.ts` +
  `ResolvedRefValueBadge.tsx`, fed by `useAncestorSchemaResolver`). These are
  samples, not a live evaluation — the badge tooltip says so — and degrade to
  nothing when the upstream has never run. Exact re-evaluation against current
  config (n8n data-pinning) remains future work.
- **`ml_predict`.** Excluded from `ancestorRefConsumerKinds` because its
  runtime consumes nothing a reference could feed; re-add once it can.
- **Verbatim substitution semantics.** `{{alias}}` substitution into source
  queries, API URLs/bodies and chat/email text is intentionally verbatim — the
  author owns quoting, so referenced data can shape SQL/URLs (the runner
  executes the query under the source's own permissions). The guards that
  DO exist: per-value 256 KiB and total 1 MiB budgets, the 2000-row table cap,
  hard failure on unknown aliases (never a half-substituted payload), CR/LF
  stripping in SMTP header fields, compile-time token/alias validation, and
  fingerprinting the *resolved* action spec for idempotency. There is no
  per-dialect escaping layer.
- **Agent context double-feed.** A whole-output reference on an agent both
  substitutes into `{{alias}}` tokens and (like any input) contributes to the
  generic prompt-context block, so the same rows can reach the prompt twice in
  different renderings.
