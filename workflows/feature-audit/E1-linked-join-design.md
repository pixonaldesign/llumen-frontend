---
topic: workflows
services: []
status: current
---
# Per-item linked join — design proposal (decision input, not a committed plan)

> The unified data-reference architecture deliberately deferred one capability: comparing each
> iterated row against **the matching row** of another ancestor (n8n's `pairedItem` analog). This
> doc gives the deferral-reversal decision something concrete to weigh: exact semantics, the layer
> split, effort, and the open product calls. Status: **deferred stands until decided** — nothing
> here is being built.

## 1. What it is, and what already works

Today a condition operand bound to an ancestor resolves in one of two shapes:

- **RIGHT = scalar broadcast** — one value compared against every row (single-row guarded,
  `ancestorScalarSubquerySql` errors loudly on multi-row ancestors); or **membership** —
  `IN (SELECT … FROM ref_x)`.
- **LEFT = row-domain switch** — the ancestor's rows *become* the iterated input
  (`transformState.rowSource` → worker FROM swap).

What none of these can express: *"for each order row, look up **that customer's** credit limit in
the Customers node and keep the order if `amount > customers.credit_limit`."* That requires
correlating two row streams by a key — a JOIN, not a broadcast. The documented workaround is the
`merge` node (combine by matching fields) or hand-written SQL; linked join brings it into guided
conditions.

## 2. Proposed model

### Contract (`contracts/data_reference.json` — 4-file sync + both agreement tests)

- Add `linked` to the `usages` enum: *keyed row-wise lookup; the ref must be whole-output and carry
  a join key pair.*
- Add a join vocabulary to the entry shape: `ancestor_refs[]` entries with `usage: "linked"` carry
  `join: { left_key: "<field on the iterated rows>", right_key: "<field on the ancestor>" }`.
- This is the first **additive entry-shape change** since the contract shipped; mirrors re-sync by
  `cp` as usual. Older engines reject unknown usage values loudly (usage validation), so no silent
  downgrade path exists — acceptable for a single-deploy product, but see open decision D6.

### Authoring (frontend)

- Right-operand picker gains a **"Match rows by key"** mode (only for operators whose SQL consumes
  the right side; never for membership). Picking it opens a `JoinKeyPicker`: left key (field list of
  the iterated domain — wired input or row-domain ancestor) × right key (field list of the lookup
  ancestor), both via the existing `useAncestorSchemaResolver` field lists.
- Clause model: `rightSource` stays; a new `rightJoin?: { leftKey, rightKey }` rides next to it.
  `reconcileGuidedAncestorRefs` mints the backing entry with `usage: 'linked'` + the `join` block,
  GCs it with the same auto/manual rules, and drops the join block when the operator changes to one
  that can't consume it (same pattern as `rightRefClearPatch`).
- The generated SQL's right operand becomes the joined column (`ref_<alias>."credit_limit"`) instead
  of a scalar subquery — `conditionClauseToSql` only changes which *expression* it emits; the JOIN
  itself is not the frontend's to write (next section).

### Compile (engine)

- `ancestor_refs.go`: validate `linked` coherence — whole-output wire shape (empty `field_path` on
  the entry is NOT required; the compared field rides the clause), join keys present and non-empty,
  consumer kind is a SQL predicate transform (`filter` / `if_else` / `switch_cases` only in v1).
  New codes: `WF_COMPILE_LINKED_REF_REQUIRES_KEYS`, `WF_COMPILE_LINKED_REF_UNSUPPORTED_KIND`.
- `compile.go`: serialize the join specs into one step binding, e.g.
  `bindings["refJoins"] = [{"alias":"customers","leftKey":"customer_id","rightKey":"id"}]` (JSON,
  same pattern as `featureRefsJSON`). `Bindings` is `map[string]string`, so **no plan-schema
  change**.

### Runtime (worker)

- New `ref_joins.go`: parse `refJoins`, and in `buildSQLOutputQueries` /
  `buildSwitchSQLOutputQueries` extend the FROM clause:
  `FROM <rowSrc> LEFT JOIN ref_<alias> ON <normalized key match>` — composing with the existing
  row-domain FROM swap (`transformRowSource`). Key comparison reuses the membership normalization
  (`COALESCE(TRY_CAST(… AS DECIMAL(38,10))…)` on both sides) so an INTEGER key matches a DOUBLE key.
- `transformProgramUsesRef` / `requireAncestorRefArtifactsMatching` treat join-bound aliases as
  used (artifact gating + scheduling semantics identical to other refs).
- **LEFT JOIN** so an unmatched row compares against `NULL` (falls into Discarded/False/Else) rather
  than disappearing — preserving the invariant that predicate transforms never change the row set,
  only route it.

## 3. The critical implementation finding (changes the naive estimate)

Guided condition SQL is generated in the **frontend** (`conditionClauseToSql` in
`workflowNodeConfigState.ts`); the worker only wraps it with `FROM <src> WHERE (…)`. The JOIN
therefore **splits across both layers**: the frontend emits the ON-able operand expression and the
engine/worker own the FROM/JOIN assembly from the `refJoins` binding. Any design that puts the whole
JOIN in one layer either breaks advanced-mode parity (frontend) or requires the worker to parse
generated SQL (worker). The split is clean but means the three layers must ship together.

## 4. Open decisions (the actual CTO call — D1 gates everything)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Reverse the v2 deferral at all? | Only on a real user ask; merge-by-matching-fields covers many cases today |
| D2 | Duplicate right-keys: error loudly (like the scalar guard) or first-match? | **Error loudly** — silent row multiplication through LEFT JOIN is the classic correctness trap |
| D3 | NULL / unmatched keys | LEFT JOIN → comparison against NULL → row routed to the negative channel (keeps row-set invariant) |
| D4 | How many linked refs per node? | One per clause, multiple per node (each its own JOIN); revisit if SQL size becomes an issue |
| D5 | Interplay with row-domain left binding | Allowed: domain supplies `leftKey`'s table; forbidden only when the lookup ancestor IS the domain node (self-join — pointless in guided) |
| D6 | Contract governance: does the usage-enum bump need `_schema_version` / rollback slides? | Single-deploy product: no version field; old engines fail loudly on unknown usage, which is the desired behavior |

Duplicate-key guard sketch (D2): wrap the lookup side as
`(SELECT <rightKey>, ANY_VALUE(<col>) … GROUP BY <rightKey> HAVING COUNT(*) <= 1 …)` — or cheaper,
a pre-flight `CASE WHEN EXISTS (SELECT <rightKey> FROM ref_x GROUP BY <rightKey> HAVING COUNT(*) > 1)
THEN error(…)` guard column, mirroring `ancestorScalarSubquerySql`'s loud-error idiom.

## 5. Effort (design-level)

| Layer | Size | Bulk of the work |
|---|---|---|
| Frontend | **L** (~1–1.5 wk) | clause model + normalize + SQL-gen + `JoinKeyPicker` + picker mode + reconcile/GC + 3 test suites |
| Engine | **S–M** (~2–3 d) | `linked` validation + `refJoins` binding + contract sync + agreement tests |
| Worker | **M** (~3–5 d) | JOIN assembly, duplicate-key guard, used-ref detection, real-DuckDB tests |
| Contracts | XS | enum + join vocabulary, 4 synced files |

**Total ≈ 3 weeks single-engineer**, strictly after E13 (both rewrite `AggregateEditor`-adjacent
state, `conditionClauseToSql` neighborhoods, and the same three frontend test suites).

## 6. What we explicitly do NOT build (even if approved)

- Linked refs in `edit_fields` values / aggregates / agents / actions (v1 = predicate transforms).
- Multi-key (composite) joins — single key pair only.
- JQ-language linked refs (refs already force SQL).
- Any UI for join *type* — always LEFT JOIN with the D2 duplicate guard.

---

## 7. Shipped (2026-06)

Implemented as a **correlated guarded subquery** generated by the frontend, not a worker-assembled
JOIN — the design above's §2 "worker JOIN assembly" was superseded by an audit that proved aliasing
the worker FROM relation breaks saved advanced predicates. The realised shape:

- **Contract:** `linked` added to `usages.values` (+ 3 synced mirrors). Join keys + compared column
  live in the guided clause (`rightJoin: { leftKey, rightKey }`), never on the `ancestor_refs` entry.
- **Engine** (`ancestor_refs.go`): a distinct `linked` coherence branch — empty `field_path`
  (`WF_COMPILE_LINKED_REF_FIELD_PATH`) and declaring kind ∈ {filter, if_else, switch_cases}
  (`WF_COMPILE_LINKED_REF_UNSUPPORTED_KIND`).
- **Worker** (`transform_runtime.go`): the only behavioural change is the negated channel templates
  becoming `… IS NOT TRUE` (was `NOT (…)`), so a NULL predicate — which a zero-match lookup
  produces — routes the row to the negative channel instead of dropping it from both. No FROM
  aliasing; the outer row is qualified by the frontend with the real relation name (`input` or
  `ref_<domain>`).
- **Frontend:** `conditionClauseToSql` emits the correlated subquery; keys use an
  **identity-preserving** `CAST(key AS VARCHAR)` projection (an integer key matches its string form,
  but `'1'`, `'01'`, `'1.0'` stay distinct — the membership DECIMAL normaliser is deliberately NOT
  reused for join identity). `JoinKeyPicker` provides the two schema-aware key choosers.

### Known limitations (accepted, by design)

- **Empty lookup upstream fails the step.** If the lookup ancestor produced *no* output (e.g. its
  own filter matched zero rows), no artifact exists and the step fails loudly
  ("upstream node … produced no data on channel …"). This is pre-existing behaviour shared by every
  ancestor-ref kind (the worker cannot synthesise a typed empty view for columns it has never seen),
  and surfacing the empty upstream is arguably safer than silently routing every row to the negative
  channel. Row conservation holds for a **present** lookup with zero *matches*, not for a *missing*
  lookup table.
- **Self-targeting a linked lookup at the row-domain node degrades to a scalar broadcast.** Probing
  the iterated stream for "this row's match in itself" has no meaning, so reconcile drops the join;
  the residual scalar broadcast then errors at run time on any multi-row domain. The UI does not yet
  warn the author up front.
- **The `IS NOT TRUE` routing fix changes behaviour for pre-existing non-linked workflows too:** any
  filter/if_else/switch whose predicate can evaluate to NULL (e.g. a number comparison against
  unparseable text) used to drop such rows from both channels and now routes them to
  discarded/false/else. This is the intended row-conservation semantics and worth a release note for
  anyone with downstream row-count expectations.
- **The resolved-value badge** beside a linked operand still shows the rightSource column's last-run
  row-0 sample, which is a single broadcast value rather than the per-row lookup result — cosmetic;
  the "Matched by … → …" summary states the real semantics.
