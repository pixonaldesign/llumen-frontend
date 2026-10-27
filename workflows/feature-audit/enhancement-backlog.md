---
topic: workflows
services: [worker]
status: current
---
# Workflow enhancement backlog — prioritized

> Consolidated, prioritized plan combining **CTO-requested items** (any-ancestor data
> access, ancestor-ref UX, aggregate types, input/output tabs, var highlighting, field
> dropdowns, modal nav) and the **prototype-vs-impl audit gaps** (G1–G10 from
> `prototype-vs-current-diff.md`). Each item carries source, impact, effort, the exact
> code touch-points, dependencies, and any product decision it is blocked on.
>
> **Grounding:** scoped in code via three research reports —
> `/tmp/wf_research/scope-item1-ancestor-access.md`,
> `scope-item34-types-tabs.md`, `scope-item567-vars-nav-canvas.md` — plus the feature
> audit. All `file:line` references trace to those.

## How this is ordered

By **impact ÷ effort**, with **huge / architectural** items surfaced first regardless of
effort. "Effort" = engineering size (XS/S/M/L), "Impact" = how much it restores the
prototype's authoring feel or unblocks a real user task. Items blocked on a **product
decision** are flagged 🔒 — settle those before building.

| # | Item | Source | Impact | Effort | 🔒 Decision? |
|---|------|--------|--------|--------|--------------|
| **E1** | **Unified any-ancestor field picker** | CTO #1+#2+#6, G9, G10 | **Very High** | **L** (FE) | 🔒 Yes — semantics |
| E2 | Input/Output tabs show only the actual data shape | CTO #4 | High | **LOW** | — |
| E3 | Config-modal prev/next node navigation | CTO #7, G8 | High | M-Low | — |
| E4 | Var color highlighting — SQL editor (phase 1) | CTO #5 | High | **LOW** | partial |
| E5 | Per-node context menu + action surface | G3 | High | L-Med | — |
| E6 | Marquee + multi-select | G1 | Med | **LOW** | — |
| E7 | Node copy / paste / duplicate | G2 | Med | M | — |
| E8 | Aggregate / JQ type behavior | CTO #3 | Med | M | 🔒 Yes — type policy |
| E9 | Var highlighting — plain inputs/textareas (phase 2) | CTO #5 | Med | M-High | — |
| E10 | Sticky-note resize | G4 | Low-Med | **LOW** | — |
| E11 | Minimap + connection-handle micro-states | G10 | Low | LOW | — |
| E12 | `dashboard_agent` durable output | G6 | Med | M-High | 🔒 Yes — output target |
| E13 | First-class `aggregate` operator | G7 | Med | **H** | depends on E8 |

Legend — Effort: XS < S < LOW < M < L < H.

---

## Tier 0 — Flagship (huge, decide the semantics first)

### E1 — Unified any-ancestor field picker  🔒
**Source:** CTO #1 (any parent's data), #2 (ancestor-ref UX is confusing), #6 (field
dropdown in conditions); audit G9/G10. **Impact: very high. Effort: Frontend L, Engine XS,
Worker S. Blocked on a product decision (below).**

**The key reframe:** our runtime *already* supports pulling a field from any transitive
ancestor. `config.ancestor_refs[]` → engine `ancestor_refs.go` reverse-BFS-validates ancestry
and compiles `CompiledInput{ToInput:"$ref:"+alias, FieldPath, IsAncestorRef}` (`:155-207`) →
worker builds a `ref_<alias>` DuckDB view (`transform_runtime.go:620-714`). The
`AncestorFieldPicker` is even schema-aware. **So E1 is not new capability — it is (a)
authoring-UX unification and (b) one semantic decision.**

**What's wrong today (two disjoint pickers):**
1. The per-condition "Field name" box (`TransformNodeConfigEditor.tsx:712-747`) is free-text
   bound to the **immediate input only** (`clause.left` → `input.col`); ancestor fields are
   only reachable by drag-drop from the immediate `NodeInputExplorer` tree.
2. A **separate** "Ancestor references → + Reference from ancestor" alias block
   (`AncestorFieldPicker.tsx`) writes `ancestor_refs[]` and inserts `{{alias}}` — disconnected
   from the condition editor. Guided conditions can't reference those aliases at all
   (worker conditions run `SELECT * FROM input WHERE (...)`, never joining `ref_<alias>`).

The prototype collapses both into one **"All Nodes" dropdown + "Select property"** picker.

**🔒 The semantic crux (this is the decision to make first).** An ancestor ref materializes as
a **whole table/column** (`{"values":[...]}`), not a scalar aligned to the current row. So
"use `Source.colX` in an If/Else" has three possible meanings, and the guided editor
supports none today:
- **(a) Scalar broadcast** — ancestor yields one value (KPI/agent scalar), compared to every
  input row → emit `(SELECT "field" FROM ref_alias LIMIT 1)`.
- **(b) Set membership** — `input.region IN (SELECT region FROM ref_alias)` → needs new
  `is one of` / `is not one of` operators. Only meaning that works for multi-row ancestors
  without a join key.
- **(c) Keyed row-wise join** — match input row to ancestor row by key. No reliable join key
  on uploaded data (per project memory) → **recommend out of scope for guided**; keep in
  `merge`/advanced SQL.

**Recommended default:** scalar-broadcast for single-row/aggregate ancestors + add membership
operators for multi-row; keyed joins stay advanced. Picking wrong silently corrupts results
(row explosion or a DuckDB "more than one row" binder error).

**Scope:**
- **Frontend (L):** new two-level node→property picker replacing the free-text `clause.left`
  (`TransformNodeConfigEditor.tsx:712-747`); extend `WorkflowConditionClause` with
  `leftSourceNodeId?` (`workflowNodeConfigState.ts:169`, backward-compatible — absent = immediate
  input); auto-create + auto-GC `ancestor_refs[]` when a clause picks an ancestor field (reuse
  `makeUniqueAlias`); teach `conditionClauseToSql` (`:682-762`) + `conditionClauseToJq` to emit
  broadcast/membership SQL against `ref_<alias>`. Apply to filter/if_else/switch_cases and the
  `edit_fields`/`aggregate` field inputs. Reuse `useAncestorSchemaResolver` as-is.
- **Engine (XS):** reuse `$ref:alias` contract; no schema change.
- **Worker (S):** no change *if* the FE emits self-contained subquery SQL (views already
  registered before `buildSQLOutputQueries`); only **M** if we add server-side single-row
  guards or keyed joins.
- **Migration:** layers on top of `ancestor_refs[]` (auto-creates the same rows) → fully
  backward-compatible; no stored-config migration.

**Decisions to confirm:** (1) default meaning — broadcast vs membership; (2) allow multi-row
ancestors in guided conditions at all, or restrict the picker to single-row/aggregate outputs;
(3) keep the explicit "Ancestor references" panel as an advanced affordance or hide it once
conditions self-wire; (4) is the immediate input also listed as a named node in the dropdown.

---

## Tier 1 — High impact, low effort (quick wins)

### E2 — Input/Output tabs show only the actual data shape
**Source:** CTO #4. **Impact: high (clarity). Effort: LOW (frontend-only, signal already
exists).** Both panels hard-render Schema/Table/JSON (`NodeInputExplorer.tsx:294-297`,
`NodeOutputPreview.tsx:324-326`) but **already compute** the shape: `previewKind:
'table'|'document'` (`:149` / `:203`) from `OutputDescriptor.payloadKind` (stamped by the worker
— `transform_runtime.go:209/330/354`, `preview.go`), refined by `documentSnippetIsJson`. Gate
the `TabButton` list off `previewKind` (table → Table/JSON/Schema; plain document → JSON only;
JSON-array doc → Table+Schema+JSON; object → Schema+JSON) and auto-redirect the active tab when
it's hidden (the shell already resets tabs on node switch at `WorkflowBuilderShell.tsx:1044-45`).
No server-side change. Watch the in-memory-replay branch (no descriptor → keep all tabs).

### E3 — Config-modal prev/next node navigation (with node icon)
**Source:** CTO #7 / audit G8. **Impact: high (most-used modal). Effort: M-Low (plumbing).**
No prev/next exists (`WorkflowModalShell.tsx:36-55` = icon+title+close only). Open node is
`activeNodeId` (`WorkflowBuilderShell.tsx:640`); the view model + tab reset already react to it
(`:1043-1048`). Add `onNavigatePrev/Next` props down to the shell header, compute neighbor ids
over a **layout sort** (mirror `orderEdges.ts` y-then-x comparator on `node.position`, exclude
`sticky_note`), and render the target node's glyph via `getWorkflowNodeAsset(kind).icon`
(already used in the header). No new state.

### E4 — Var color highlighting (phase 1: SQL editor)
**Source:** CTO #5. **Impact: high. Effort: LOW — reuse existing machinery.** A full Monaco
inline-decoration system already exists at
`platform-settings/.../CreateComponentWizard/useVariableBindingDecorations.tsx` (+ `.css`),
driven by `extractDeclaredVariables()` (`utils/sqlVariables.ts`: `{{alias}}` / `$name` / `$$name`,
mirrored in the runner's `internal/substitution` — do not drift). `WorkflowSQLQueryEditor.tsx` is already Monaco with
no decoration → wire a highlight-only fork of the hook (`onMount` to capture editor ref). **Note
🔒-lite:** `$llumen`/`$vars` are display-only trees with no worker substitution — highlight the
load-bearing `{{alias}}`/`$name` tokens; treat `$llumen/$vars` highlighting as optional UI sugar.

### E5 — Per-node context menu + action surface
**Source:** audit G3 (also the prototype's floating Execute/Configure/More buttons). **Impact:
high (the one ergonomic regression with no equivalent). Effort: L-Med.** Today the node body
(`WorkflowRfNode.tsx`) has only a status badge + the selected-node "+" chain; config opens via
double-click; step-test only from inside the modal. Mount `onNodeContextMenu` on the
`<ReactFlow>` (`WorkflowBuilderShell.tsx:2371-2395`) → portaled menu (reuse existing
click-outside/Escape popover patterns) with Configure (`setActiveNodeId`) / Execute
(`startStepTestRun`) / Duplicate (E7) / Delete (node change). Bumps toward Med if it hosts
Duplicate (depends on E7).

### E6 — Marquee + multi-select
**Source:** audit G1. **Impact: med. Effort: LOW — RF-native.** Add `selectionOnDrag`,
`selectionMode`, `panOnDrag={[1,2]}`, `onSelectionChange` on the `<ReactFlow>` mount
(`:2371`); multi-select state comes free via `onNodesChange`. Compounds with E7 (paste/delete
many).

---

## Tier 2 — Medium impact / effort

### E7 — Node copy / paste / duplicate
**Source:** audit G2. **Impact: med (repetitive graphs). Effort: M.** No node clone/id-remap
exists today (the "copy" hits are run-replay, not a node clipboard). Build a clone+id-remap util
(regenerate node id via `randomId`, +offset position, remap internal edge endpoints old→new),
a clipboard slice, and paste-at-cursor; reuse `capturePast()` undo + `screenToFlowPosition`.
Skip single-instance kinds on paste. Pairs with E5 (Duplicate) and E6 (paste many).

### E8 — Aggregate / JQ type behavior  🔒
**Source:** CTO #3. **Impact: med (correctness perception). Effort: M. Blocked on a type
policy decision.** **Diagnosis:** the "aggregate changes types" report is mostly *correct SQL
behavior* — DuckDB promotes aggregates (`COUNT→BIGINT`, `AVG→DOUBLE`, `SUM(int)→HUGEINT`) and
`copyQueryToParquet` writes them faithfully (`transform_runtime.go:801`); filter/if_else/switch
are `SELECT *` passthroughs that **preserve** types. The genuinely lossy path is **JQ**
(`parquet_rows.go:inferParquetColumnType`): JSON numbers → DOUBLE, mixed → STRING, timestamps →
STRING. **🔒 Decide:** (a) accept aggregate widening as correct + only tighten the JQ
re-inference (LOW, low-risk) — *recommended*; or (b) force aggregate output back to input type
via `CAST(... AS <type>)` (Med, **risk: SUM overflow / AVG precision loss + ripples into every
downstream read** — not recommended as default).

### E9 — Var highlighting — plain inputs/textareas (phase 2)
**Source:** CTO #5 cont. **Impact: med. Effort: M-High.** Action/Agent/Transform value & body
fields are plain `<input>`/`<textarea>` (can't decorate inline). Build a shared
`<HighlightedTextArea>` (transparent textarea over a tokenized mirror `<div>`, scroll/caret
sync) reusing `extractDeclaredVariables`. Fiddly (IME/selection/scroll) → ship after E4.

### E10 — Sticky-note resize
**Source:** audit G4 (was an explicit v1 cut, cheap to revisit). **Impact: low-med. Effort:
LOW.** Add `@xyflow/react` `NodeResizer` to `StickyNoteNode.tsx` (currently fixed 280×180,
`:16-19`) + persist width/height into the node's authored config.

### E11 — Minimap + connection-handle micro-states
**Source:** audit G10. **Impact: low (cosmetic). Effort: LOW.** `<MiniMap>` is a ~1-line RF
add; richer handle states (ready/occupied/reroute-hover) in `WorkflowRfNode/Edge`. Optional.

---

## Tier 3 — Larger / semantic (lower urgency)

### E12 — `dashboard_agent` durable output  🔒
**Source:** audit G6. **Impact: med (runtime semantic gap). Effort: M-High.** `dashboard_agent`
compiles + runs but emits **text only** — no durable dashboard (slides/briefing *do* persist).
Add a dashboard persistence path in `worker/internal/worker/agent_runtime.go` (analogous to the
Infusion slides/briefing path) + a content internal persistence route. **🔒 Decide** what a
"dashboard" entity is in the product before building.

### E13 — First-class `aggregate` operator
**Source:** audit G7 (related to E8). **Impact: med. Effort: H. Depends on E8 decision.**
Replace the raw-SQL passthrough with a structured aggregate transform (group-by + agg-function
config UI in `nodeConfig/`, typed bindings in `compile.go` + worker). Large; current raw-SQL
path is a functional workaround.

---

## Explicitly OUT OF SCOPE (confirmed product decisions — do not build)

Cross-referenced to `docs/_archive/workflow/` (see `prototype-vs-current-diff.md` §5):
`error_trigger`, Screenshot Node, Component-Library **showcase** modal, visible
`filter.discarded` channel, per-message chat attachments, LlumenChat/WorkflowChatWindow
unification, app-input primitives (file/text/JSON/CSV) in the drawer, per-workflow
timeout/concurrency UI, hardcoded `webhook.llumen.io/{id}` URL. Closing these would contradict
product decisions, not the prototype.

---

## Product decisions to settle before building

1. **E1 ancestor-field semantics** (the flagship blocker): scalar-broadcast vs set-membership
   as the default for `Ancestor.field` in a guided condition; whether multi-row ancestors are
   allowed in guided at all; whether keyed joins stay advanced-only.
2. **E8 type policy**: accept DuckDB aggregate widening (fix only JQ lossiness) vs force-CAST
   aggregate outputs back to input types (overflow/precision risk).
3. **E12**: what a durable "dashboard" entity is, before wiring `dashboard_agent` persistence.
4. **E4/E9**: confirm we only highlight load-bearing `{{alias}}`/`$name` tokens (since
   `$llumen`/`$vars` have no runtime substitution).

## Suggested sequencing

1. **Decide E1 semantics**, then build E1 (flagship).
2. In parallel / interleaved quick wins: **E2 → E4 → E3 → E6** (all LOW / M-Low, independent).
3. **E5 + E7** together (context menu + copy/paste/duplicate reinforce each other), then **E6**
   multi-select compounds.
4. **E8** after a type-policy call; **E9, E10, E11** as polish.
5. **E12, E13** as scoped semantic work later.

## Sources
- Audit: `docs/workflows/feature-audit/current-functionalities.md`,
  `docs/workflows/feature-audit/prototype-vs-current-diff.md`.
- Scoping reports: `/tmp/wf_research/scope-item1-ancestor-access.md`,
  `scope-item34-types-tabs.md`, `scope-item567-vars-nav-canvas.md`.
- Prototype: http://prototype.llumen.io/workflow/979669f6a773bc14ee5e3b19.html
