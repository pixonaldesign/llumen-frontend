---
topic: workflows
services: [worker]
status: current
---
# Workflow — planned features (master roadmap)

> Single consolidated list of everything planned for the workflow builder, merging the
> **CTO-requested items** and the **prototype-vs-implementation audit gaps**, with current status,
> effort, scope decisions, and dependencies. Companion docs in this folder:
> `enhancement-backlog.md` (original prioritized backlog), `E1-unified-data-reference-architecture.md`
> (flagship design), `current-functionalities.md` + `prototype-vs-current-diff.md` (the audit),
> `two-dev-workstreams.md` (the remaining items partitioned into two conflict-free dev streams).

## Status legend

| Status | Meaning |
|---|---|
| 🟢 Designed | Architecture locked, ready to implement |
| 🔵 Ready | Scoped (files + approach known), small enough to start directly |
| 🟠 Needs decision | Blocked on a product call before building |
| 🟣 Merged | Folded into another item (no longer standalone) |
| ⚪ Dependent | Waiting on another item |

Effort: XS < S < LOW < M < L < L+ < H.

## Master table

| ID | Feature | Source | Status | Effort | Notes |
|---|---|---|---|---|---|
| **E1** | **Unified cross-ancestor data references** (any node references any ancestor field) | CTO #1, #2, #6 + audit G9/G10 (+ absorbs E4, E9) | 🟢 Designed | FE **L+**, Eng XS, Wkr S–M | Flagship. Dedicated design doc. Decisions locked. |
| E2 | Input/Output tabs show only the **actual data shape** | CTO #4 | ✅ Shipped | **LOW** | Signal (`previewKind`) already computed; gate tab buttons. |
| E3 | Config-modal **prev/next node navigation** (with node icon) | CTO #7 / G8 | ✅ Shipped | M-Low | Reuse `activeNodeId` + `orderEdges` sort + `getWorkflowNodeAsset`. |
| E4 | Var **color highlighting** — SQL/expression | CTO #5 | 🟣 Merged → E1 | — | Expression editor reuses the Monaco decorator; no standalone item. |
| E5 | **Per-node context menu** + action surface | audit G3 | 🔵 Ready | L-Med | `onNodeContextMenu` → portaled menu; the one ergonomic regression with no equivalent. |
| E6 | **Marquee + multi-select** | audit G1 | 🔵 Ready | **LOW** | RF-native props on the `<ReactFlow>` mount. |
| E7 | **Node copy / paste / duplicate** | audit G2 | 🔵 Ready | M | New clone+id-remap util + clipboard + paste-at-cursor. |
| E8 | **Aggregate / JQ type behavior** | CTO #3 | ✅ Shipped (numeric) | M | Root cause was HUGEINT→DOUBLE at the parquet boundary + JQ float decode; both fixed. Timestamp re-inference not done (false-positive risk, no reported need). |
| E9 | Var highlighting in **plain inputs/textareas** | CTO #5 (phase 2) | 🟣 Merged → E1 | — | Reference-bearing fields become highlighted expression editors. |
| E10 | **Sticky-note resize** | audit G4 | 🔵 Ready | **LOW** | Add `NodeResizer` + persist w/h. (was an explicit v1 cut.) |
| E11 | **Minimap** + connection-handle micro-states | audit G10 | 🔵 Ready | LOW | `<MiniMap>` is ~1 line; handle polish optional. |
| E12 | **`dashboard_agent` durable output** | audit G6 | 🟠 Needs decision | M-High | Today emits text only; slides/briefing persist, dashboard doesn't. Define the entity. |
| E13 | First-class **`aggregate` operator** | audit G7 | ✅ Shipped (slim) | M-Low | Guided GROUP BY + native-type SUM/AVG + `LIST(*)` fix, in the existing frontend SQL pipeline. Worker-side structured program (the H-sized rest) deliberately not built — no user-facing gap left. |

---

## E1 — Unified cross-ancestor data references (flagship) 🟢

**Goal.** Any consuming node (transforms, `create_asset`, `ml_model`, agents, actions, `source`
query) can reference data from **any ancestor node**, not just the wired predecessor — through **one
clean model**, not per-node patches. Absorbs CTO #1 (any-parent data), #2 (ancestor-ref UX), #6
(field dropdown), and the var-highlighting items (E4/E9, via the expression editor).

**Mental model.** A node still iterates its immediate input row-by-row; ancestor data enters as an
**operand/binding** in one of three explicit modes:
- **Broadcast (scalar)** → `(SELECT col FROM ref_x LIMIT 1)` — single-row/aggregate ancestors.
- **Membership (list)** → `IN (SELECT value FROM ref_x)` — new `is one of` / `is not one of`.
- **Whole (table/document)** → `ref_<alias>` view / `{{alias}}` token — agent context, chart series.

**Locked decisions (2026-06):**
1. Per-item **linked join** (n8n `pairedItem` / keyed row-wise) **deferred** to `merge`/advanced SQL.
2. **Dual authoring** in v1: guided `DataReferencePicker` **and** a `{{ }}` raw-expression editor,
   sharing **one** reference AST + resolver (never two). Expression highlighting reuses the existing
   Monaco decorator (this is why E4/E9 fold in).
3. **Actions + `source` query in scope** via the new worker `binding` sink (they have zero
   injection point today; actions don't even load upstream).
4. Add `contracts/data_reference.json` (usage enum + channel map).

**Architecture (4 layers).**
- **Contract** `contracts/data_reference.json` — `usage: scalar|list|table|document` + static
  channel map (mirror + sync-test like the existing two contracts).
- **Engine** `datareference.go` generalizing `ancestor_refs.go` — additive `Usage`; reuse reverse-BFS
  closure, alias rules, `appendRefInputs` (already runs for every kind); **zero wire change**.
- **Worker** one shared `resolveReferences(step, inputs, sink)` unifying the five legacy injection
  mechanisms into three sinks: `duckdbView` (exists), `textSubst` (extend `{{alias}}` to all agents),
  **`binding` (NEW — actions / source / asset / ml)**.
- **Frontend** one `DataReferencePicker` + a `{{ }}` expression editor over **one** reference AST;
  operand model gains `clause.{left,right}SourceRefId`; new operators `is one of`/`is not one of`;
  force SQL when a clause references an ancestor (JQ-with-ref deferred).

**Runtime rule (prevents the whole bug class):** scalar ops ⇒ always `LIMIT 1` on the ref subquery;
membership ops ⇒ full column, never `LIMIT`. SQL safety screen needs **no change** (`IN`/subquery/
`LIMIT` already pass; verified against `safety_test.go`).

**Backward-compatible:** `ancestor_refs[]` is reinterpreted (implicit `usage=table|document`), not
migrated; old workflows run identically.

**Effort:** Frontend **L+** (picker + expression parser/serializer ↔ AST + per-field fixed/expression
toggle + live resolved-value preview), Engine **XS**, Worker **S–M** (the `binding` sink for
actions/source is the bulk).

**Build order (one cohesive ship — no half-wired modes):**
1. Worker `resolveReferences` + `binding` sink (unblocks actions/source/asset/ml; makes the
   dead "`{{alias}}` in conditions" promise real).
2. Reference AST + `DataReference` engine type + `contracts/data_reference.json`.
3. `DataReferencePicker` (guided) **and** the `{{ }}` expression editor over the same AST (highlight +
   live preview).
4. Operand model + `is one of`/`is not one of` + SQL-gen for transform conditions.
5. Wire both authoring modes into **every** editor (conditions / edit_fields / aggregate / merge,
   agents, actions, ml_model, create_asset, source) — the "all nodes at once" deliverable.

Full detail: **`E1-unified-data-reference-architecture.md`**.

---

## E2 — Input/Output tabs show only the actual data shape 🔵

**What.** Stop showing Schema/Table/JSON unconditionally; show only the tab(s) matching the real
payload (JSON-only for a plain document, Table+Schema+JSON for tabular, etc.).
**Why.** Empty/irrelevant tabs are confusing (CTO #4).
**Scope.** Frontend-only. Both panels already compute `previewKind: 'table'|'document'`
(`NodeInputExplorer.tsx:149`, `NodeOutputPreview.tsx:203`) from `OutputDescriptor.payloadKind`
(worker-stamped). Gate the `TabButton` list off it (+ `documentSnippetIsJson`) and auto-redirect the
active tab when hidden (shell already resets tabs on node switch, `WorkflowBuilderShell.tsx:1044`).
Keep all tabs for in-memory replay (no descriptor). **Effort: LOW.** No server-side change.

## E3 — Config-modal prev/next node navigation 🔵

**What.** Prev/next buttons in the modal header (showing the target node's icon) to jump between
nodes without closing.
**Scope.** `activeNodeId` already drives the modal (`WorkflowBuilderShell.tsx:640`); add
`onNavigatePrev/Next` props to the modal shell, compute neighbor ids via a layout sort (mirror
`orderEdges.ts` y-then-x on `node.position`, exclude `sticky_note`), render glyph via
`getWorkflowNodeAsset(kind).icon`. No new state. **Effort: M-Low.**

## E5 — Per-node context menu + action surface 🔵

**What.** Right-click (and/or hover) menu on canvas nodes: Configure / Execute (step-test) /
Duplicate / Delete — restoring the prototype's per-node floating actions.
**Why.** The one ergonomic regression with **no equivalent** today (config is double-click only;
step-test only from inside the modal).
**Scope.** Mount `onNodeContextMenu` on the `<ReactFlow>` (`WorkflowBuilderShell.tsx:2371-2395`) →
portaled menu; wire to `setActiveNodeId` / `startStepTestRun` / E7 clone / node-remove. **Effort:
L-Med** (Med if it hosts Duplicate → depends on E7).

## E6 — Marquee + multi-select 🔵

**What.** Drag-select a region; multi-select nodes.
**Scope.** RF-native: add `selectionOnDrag`, `selectionMode`, `panOnDrag={[1,2]}`,
`onSelectionChange` to the mount; multi-select state comes free from `onNodesChange`. **Effort: LOW.**
Compounds with E7 (paste/delete many).

## E7 — Node copy / paste / duplicate 🔵

**What.** Clipboard copy/paste and duplicate of nodes (with internal-edge remap for multi-node paste).
**Scope.** No node clone/id-remap exists today. New clone+id-remap util (regenerate `randomId`,
offset position, remap edge endpoints), clipboard slice, paste-at-cursor; reuse `capturePast()` undo +
`screenToFlowPosition`; skip single-instance kinds on paste. **Effort: M.** Pairs with E5 + E6.

## E8 — Aggregate / JQ type behavior ✅ Shipped (numeric integrity)

**Refined diagnosis (2026-06).** The audit's "aggregate widening is correct SQL, accept it" framing
missed the real bug: DuckDB computes `SUM(BIGINT/INTEGER)` as `HUGEINT` (int128) and **the parquet
writer silently materialises HUGEINT as DOUBLE** (parquet has no int128) — so `SUM(qty)=12` came out
as `12.0`. Neither option (a) nor (b) as originally framed; the fix is narrowing at the
materialisation boundary.

**Shipped:**
- Worker `narrowHugeintColumns` (`transform_runtime.go`): every materialised query is DESCRIBEd and
  `HUGEINT`→`BIGINT` / `UHUGEINT`→`UBIGINT` columns are cast via `SELECT * REPLACE`; overflow beyond
  int64 errors loudly instead of silently degrading. Non-128-bit queries pass through unchanged.
- JQ integer preservation: `UseNumber` document decode + `normalizeJQInput` (`safety.go`) converting
  payloads to gojq's legal vocabulary (`int`/`float64`/`*big.Int`) — integer fields survive JQ and
  re-materialise as `INT64`. (DuckDB `int64` rows were previously undefined behaviour in gojq.)
- `COUNT→BIGINT`, `AVG→DOUBLE`, `SUM(DOUBLE)→DOUBLE` kept as-is (correct SQL). Force-CAST to input
  types (old option (b)) rejected.

**Not done:** ISO-timestamp string → `TIMESTAMP` re-inference for JQ outputs — real false-positive
risk on free-text columns and no reported need; revisit if a user hits it. Policy detail in
`docs/workflows/transform-nodes.md` § Output type behavior.

## E10 — Sticky-note resize 🔵

**What.** Make sticky notes resizable (currently fixed 280×180, an explicit v1 cut).
**Scope.** Add `@xyflow/react` `NodeResizer` to `StickyNoteNode.tsx` + persist width/height into the
node's authored config. **Effort: LOW.**

## E11 — Minimap + connection-handle micro-states 🔵

**What.** A `<MiniMap>` and richer handle states (ready/occupied/reroute-hover).
**Scope.** `<MiniMap>` ~1-line RF add; handle polish in `WorkflowRfNode/Edge`. **Effort: LOW**
(cosmetic).

## E12 — `dashboard_agent` durable output 🟠 (needs decision)

**What.** `dashboard_agent` compiles + runs but emits **text only** — no durable dashboard (slides and
briefing agents *do* persist their entities).
**Scope.** Add a dashboard persistence path in `worker/internal/worker/agent_runtime.go` (analogous to
the Infusion slides/briefing path) + a content internal persistence route. **🔒 Decision:** define what
a durable "dashboard" entity is before building. **Effort: M-High.**

## E13 — First-class `aggregate` operator ✅ Shipped (slim, 2026-06)

**Re-scoped after E8.** The original H-sized item bundled three things: the type complaint (fixed
by E8's HUGEINT narrowing — no per-function cast policy needed), an architectural migration of SQL
generation to the worker (invisible to users; deliberately NOT built), and the one real user-facing
gap — **grouped aggregation in the guided editor**. Only the last was built:

- `groupByFields` in the guided aggregate state: keys are deduped, projected alongside the
  metrics / list, and emitted as `GROUP BY` (SQL) / `group_by([…]) | map(…)` (jq), both modes.
- Guided `SUM`/`AVG` now run on the column's **native type** (the old `TRY_CAST(col AS DOUBLE)`
  forced integer sums to floats and silently excluded unparseable values from totals); text-typed
  columns fail loudly instead of summing wrong.
- Fixed the list-mode fallback emitting invalid `LIST(*)` — whole rows pack via `LIST(<from>)`.

Existing aggregate configs are untouched (same raw-SQL pipeline; new keys are additive). The
worker-side structured program remains available as future architecture work if workflow authoring
is ever opened to less-trusted users. Detail: `docs/workflows/transform-nodes.md` § Aggregate
grouping.

---

## Explicitly OUT OF SCOPE (confirmed product decisions — do not build)

Cross-referenced to `docs/_archive/workflow/` (`prototype-vs-current-diff.md` §5): `error_trigger`,
Screenshot Node, Component-Library **showcase** modal, visible `filter.discarded` channel,
per-message chat attachments, LlumenChat/WorkflowChatWindow unification, app-input primitives
(file/text/JSON/CSV) in the add-node drawer, per-workflow timeout/concurrency UI, hardcoded
`webhook.llumen.io/{id}` URL. Closing these would contradict product decisions, not the prototype.

## Open product decisions still needed

1. **E12** — what a durable "dashboard" entity is, before wiring `dashboard_agent` persistence.
2. **E1-join** — reverse the v2 deferral or not; design doc being produced to inform the call.

(E8 type policy resolved 2026-06: integer data stays integral end-to-end — HUGEINT narrowing at the
parquet boundary + JQ integer preservation; force-CAST rejected; timestamp re-inference deferred.)

## Suggested sequencing

1. **E1 flagship** — start with the worker `resolveReferences` + `binding` sink (foundation +
   closes the actions/source gap that has no workaround), then build outward through the 5-step
   order. Ships as one cohesive capability.
2. **Quick wins in parallel:** E2 (tabs) → E6 (marquee) → E3 (modal nav) → E10 (sticky resize) →
   E11 (minimap) — all LOW / independent.
3. **Canvas ergonomics together:** E5 (context menu) + E7 (copy/paste/duplicate); E6 multi-select
   compounds.
4. **E8** after the type-policy call; **E12, E13** as scoped semantic work later.

## Source docs
- `E1-unified-data-reference-architecture.md` — flagship design (locked).
- `enhancement-backlog.md` — original prioritized backlog + per-item scope.
- `current-functionalities.md`, `prototype-vs-current-diff.md` — the audit this plan derives from.
