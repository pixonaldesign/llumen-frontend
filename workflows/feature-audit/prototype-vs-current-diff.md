---
topic: workflows
services: [engine, frontend, worker]
status: current
---
# Workflow prototype vs. current implementation — gap analysis

> **Definitive gap analysis** between the interactive HTML **prototype**
> (`http://prototype.llumen.io/workflow/979669f6a773bc14ee5e3b19.html` — local
> copy `/tmp/wf_research/prototype.html`, 20,921 lines, single-file HTML + inline
> JS; the *target/desired* UX) and the **current implementation** across the
> React/Next.js frontend, the server-side Flow REST surface (the content
> service), the Go workflow engine, and the Go worker. Evidence citations to
> `report-backend` below are research-pass references; the routes they describe
> are served by the content service.
>
> **Evidence sources (all complete at this revision).** Six research reports under
> `/tmp/wf_research/`: `report-prototype.md`, `report-frontend.md`,
> `report-engine.md`, `report-worker.md`, `report-backend.md`,
> `report-archive-docs.md`. **`report-frontend.md` is now authoritative for the
> builder canvas UI** and corrects earlier ad-hoc source reads. The archive-docs
> report is used to decide whether a prototype-only item was *intentionally
> dropped* (e.g. `error_trigger`, Screenshot Node) versus a real gap. Where a
> contract is the ground truth it is cited directly
> (`contracts/workflow_node_kinds.json`, `contracts/license_tiers.json`).

---

## 1. Executive summary — verdict

**The current implementation is a faithful realization of the prototype's screen
taxonomy and a vastly more capable *real* product on every runtime axis — while
deliberately trading away a slice of the prototype's canvas direct-manipulation
ergonomics.** The prototype is a static, mock-data HTML page: it draws every
screen and wires the *interactions* in inline JS, but has no backend, no real
execution, no persistence, and several stubbed affordances. The implementation
reproduces the prototype's asset language and screen set (trigger-first empty
state, three-column node-config modal, category add-node drawer, executions
table, version history, workflow chat) and then goes **well beyond it**: a real
compile → materialize → run engine, a poll-loop worker executing 12 adapter
kinds, durable artifacts/previews, RLS/RBAC, license gating, webhook + schedule +
chat ingress, immutable server-side version history with restore, and cross-version
step-test replay.

**Closeness rating by area:**

| Area | Match | One-line verdict |
| --- | --- | --- |
| Node catalogue (palette kinds) | ~98% | All 24 prototype-selectable kinds are in the builder palette; impl *adds* `ml_model` + `create_asset` (palette) and `ml_predict` (compiled-only). Only `error_trigger` (prototype non-palette stub) absent — intentional. |
| Execution flow / runtime | 130% | Prototype fakes execution with timers; impl has a real engine + worker + sweeper + retention + idempotency. |
| Node config modal | ~90% | Three-column Input / Configuration / Output, Settings tab, Execute-Node, 3-mode step-test all present. Column resizers (the prototype HAS them) + some expression sub-modes are thinner; modal prev/next nav not built. |
| Toolbar / footer | ~98% | Undo/redo, zoom in/out, fit, execute + trigger picker, chat toggle, add-node all present. |
| Executions view + run detail | 120% | Prototype is mock rows with dead actions; impl has live runs, a Run Detail Drawer, real cancel/retry/copy/debug. |
| Version history + publish | 115% | Prototype was a 20-cap in-memory list + cosmetic toggle; impl persists immutable server-side versions with real restore, and publish/unpublish drives actual trigger eligibility. |
| **Canvas direct-manipulation** | **~50%** | **Biggest gap.** No marquee/box-select, no multi-select, no node copy/paste/duplicate, no right-click context menu, no minimap, no sticky-note resize. |
| Component Library showcase modal | ~5% | The prototype's design-system showcase modal is not built (and was never intended to ship — the header button opens the global component library instead). |

**Bottom line:** nothing *executable* in the prototype is missing from the
implementation, and the runtime is dramatically more real. The remaining gaps are
almost entirely *canvas ergonomics* — marquee/multi-select, node copy/paste/
duplicate, a right-click context menu, a minimap, and sticky-note resize.
Cross-referencing the archive docs (§5), the largest of these were
**explicitly deferred for v1**, so they read as intentional scope cuts rather
than oversights. The one genuine ergonomic regression worth questioning is the
absence of **a per-node action surface** (the prototype's floating
Execute/Configure/More buttons + right-click menu collapsed into
double-click-to-configure, with no canvas surface for per-node Execute /
Duplicate / Delete).

### Reconciliation of cross-report discrepancies (read this first)

Three facts were inconsistent across earlier reads; the authoritative resolution:

1. **Node count / catalogue.** There is no single number. Three layers exist and
   are reconciled in the **one authoritative catalogue in §2.1**:
   - **Builder palette** (`frontend/src/features/workflows/catalog/nodeCatalog.ts`,
     authoritative for what an author can drag onto the canvas): **26 kinds**,
     including `ml_model` and `create_asset` which the prototype lacks.
   - **Compiled kinds** (`engine/internal/engine/compile.go` + the four buckets in
     `contracts/workflow_node_kinds.json`): the engine compiles **18 executable
     adapter kinds** plus 4 triggers; this set includes `ml_predict`, which is
     **compiled-only** (it has a compile path + worker runtime but is *not* in the
     builder palette).
   - **Archive/intended spec** (`report-archive-docs.md`): lists **25 intended
     kinds**. The delta vs the shipped palette is bookkeeping (the spec folds
     `ml_predict` differently and predates the `ml_model`/`create_asset` split).
   Each node in §2.1 is tagged **in-palette**, **compiled-only**, or
   **doc-only/aspirational**.

2. **Licensing is feature-level, not per-node.** Neither the node-kind contract
   nor the frontend catalogue carries a per-node tier field (grep for
   `licenseTier|requiredTier|nodeTier` in the workflows feature returns nothing —
   `report-frontend.md §1`). The whole **`workflows`** family of features
   (`workflows`, `workflow_runs`, `schedules`) is gated to the **`command`** tier
   and above (`false` for `signal`/`core`, `true` for `command`/`citadel`;
   `contracts/license_tiers.json`, `report-engine.md §7`). So a node never has its
   own tier — the *entire builder* requires `command`+. Do not present per-node
   tiers anywhere.

3. **Builder UI ground truth (corrects earlier ad-hoc reads).** Per
   `report-frontend.md §4, §10`:
   - **Undo/redo EXISTS** (footer buttons, `WorkflowBuilderShell.tsx:2489,2497`).
   - **Publish/unpublish IS the activation mechanism** — there is no separate
     `active` boolean (grep `is_active|setIsActive|activate` → 0 hits;
     `report-frontend.md §10`).
   - **NOT implemented:** marquee/box-select, multi-select, copy/paste/duplicate
     of nodes, right-click context menu, minimap (and React Flow `<Controls>`),
     and config-modal prev/next navigation.
   - **Sticky notes have no resize** (fixed 280×180, "intentionally out of scope
     for v1", `StickyNoteNode.tsx:16-19`).
   - The **config modal is 3-column** (Input / Configuration / Output).
   - **Node step-test has 3 input modes**: `reuse_prior_outputs`,
     `recompute_ancestors`, `fixture_input` (`report-frontend.md §8`,
     `report-engine.md §6a`).

---

## 2. Side-by-side feature matrix

Status legend: ✅ Matches · 🟡 Partial · ❌ Missing · ➕ Extra-in-impl.

### 2.1 One authoritative node catalogue

Layer tags: **[palette]** = in the builder add-node drawer
(`nodeCatalog.ts`); **[compiled-only]** = engine compiles + worker runs it but it
is not in the palette; **[doc-only]** = appears only in spec/prototype, never
shipped. Licensing is feature-level (the whole builder needs `command`+); there
is **no per-node tier**.

| Node kind | Layer | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `manual_trigger` | [palette] | ✅ | ✅ `nodeCatalog.ts:19`; engine trigger `report-engine §1` | ✅ | Single-instance. |
| `schedule_trigger` | [palette] | ✅ every/unit + minute/hour/weekday/day | ✅ `nodeCatalog.ts:20`; real compile + materialize + scheduler `report-engine §5` | ✅ | Impl validates IANA tz, `every≤10000`, rejects `seconds` unit. |
| `chat_input_trigger` | [palette] | ✅ excluded from execute picker | ✅ `nodeCatalog.ts:21`; singleton; live chat ingress | ✅ | Single-instance, excluded from manual trigger picker. |
| `webhook_trigger` | [palette] | ✅ readonly URL `webhook.llumen.io/{id}`, method, auth | ✅ `nodeCatalog.ts:22`; real `path_key`/secret/oauth2 ingress `report-backend` | ✅ | Hardcoded URL replaced by allocated `path_key` + Fernet secret. |
| `component` | [palette] | ✅ selector + preview; Configure = "soon" toast | ✅ `nodeCatalog.ts:23`; re-renders saved asset w/ cache TTL `report-worker §3.8` | ✅ | Impl Configure fully wired (cache hit/miss/fallback). |
| `source` | [palette] | ✅ Database/API wizard + mock sources | ✅ `nodeCatalog.ts:24`; runner dual-mode parquet/json `report-worker §3.2` | ✅ | Mocks replaced by real source wizard (database/api/file/dataflow). |
| `ml_model` | [palette] | ❌ | ➕ `nodeCatalog.ts:25`; Snowflake/MLflow batch predict `report-worker §3.3` | ➕ | Not in prototype. |
| `create_asset` | [palette] | ❌ | ➕ `nodeCatalog.ts:26`; ingest source + asset + cache `report-worker §3.9` | ➕ | Not in prototype. |
| `no_operation` | [palette] | ✅ pass-through | ✅ `nodeCatalog.ts:27` | ✅ | |
| `filter` | [palette] | ✅ conditions; output `Kept` | ✅ `nodeCatalog.ts:28` port `kept` (runtime also `discarded`) `report-worker §3.5` | ✅ | `discarded` is implicit/runtime-only by design. |
| `if_else` | [palette] | ✅ True/False | ✅ `nodeCatalog.ts:29` ports `true`/`false` | ✅ | |
| `switch_cases` | [palette] | ✅ drag-drop case cards + Else | ✅ `nodeCatalog.ts:30`; dynamic per-case channels `report-engine §1a` | ✅ | |
| `edit_fields` | [palette] | ✅ field list + uniqueness | ✅ `nodeCatalog.ts:31` | ✅ | |
| `aggregate` | [palette] | ✅ Mode + include/exclude builders | 🟡 `nodeCatalog.ts:32`; **no dedicated aggregate operator** — author's raw SQL/JQ on `default` channel `report-worker §3.5` | 🟡 | See §3 / G7. |
| `merge` | [palette] | ✅ Append/Combine + combine-by | ✅ `nodeCatalog.ts:33`; slot-ordered union `report-worker §3.5` | ✅ | Strict per-slot input cap. |
| `wait` | [palette] | ✅ For + unit (sec/min/hr) | ✅ `nodeCatalog.ts:34`; run→waiting then re-leases `report-worker §3.6` | ✅ | |
| `stop_error` | [palette] | ✅ error message editor | ✅ `nodeCatalog.ts:35`; deliberate `WF_STOP_ERROR` fail | ✅ | Sink node (no outputs). |
| `sticky_note` | [palette] | ✅ inline-edit + **resizable**, 280×180 | 🟡 `nodeCatalog.ts:36`; inline-edit, **resize out of scope v1** (`StickyNoteNode.tsx:16-19`, fixed 280×180) | 🟡 | See §3 / G4. |
| `general_agent` | [palette] | ✅ instructions + tool toggles (UI not surfaced) | ✅ `nodeCatalog.ts:37`; unstructured text agent `report-worker §3.10` | ✅ | Prototype tool UI was a non-rendered stub; impl agent is real (plain text at MVP). |
| `data_classification_agent` | [palette] | ✅ category cards → per-category ports | ✅ `nodeCatalog.ts:38`; per-category + `_unclassified` channels `report-worker §3.10` | ✅ | |
| `insight_generator_agent` | [palette] | ✅ insight-type + fields | ✅ `nodeCatalog.ts:39`; structured JSON agent | ✅ | |
| `slides_agent` | [palette] | ✅ instructions | ✅➕ `nodeCatalog.ts:40`; **real Supabase slides persistence** (RPC + REST inserts) `report-worker §3.11` | ✅➕ | Impl actually creates a slides; lenient on failure. |
| `dashboard_agent` | [palette] | ✅ instructions | 🟡 `nodeCatalog.ts:41`; emits **text document only**, no durable dashboard `report-worker §3.10` | 🟡 | Node exists; durable dashboard not produced by worker. See §3 / G6. |
| `briefing_agent` | [palette] | ✅ instructions | ✅ `nodeCatalog.ts:42`; agent self-persists briefing `report-worker §3.11` | ✅ | |
| `send_chat_message` | [palette] | ✅ Send / Send-and-Wait + Free-Text/Approval | ✅ `nodeCatalog.ts:43`; bubble + waiting + resume `report-worker §3.12` | ✅ | Side-effect (step-test needs `confirm_live_execution`). |
| `send_email` | [palette] | ✅ To/Cc/Bcc/Subject/Body | ✅ `nodeCatalog.ts:44`; real SMTP or simulated `report-worker §3.12` | ✅ | Side-effect. |
| `send_api_request` | [palette] | ✅ API-only source variant | ✅ `nodeCatalog.ts:45`; direct (SSRF-guarded) + source modes `report-worker §3.12` | ✅ | Side-effect. |
| `ml_predict` | [compiled-only] | ❌ | ➕ compiles `llumen.ml.predict`; ML inference service `report-engine §1a`, `report-worker §3.4` | ➕ | Compile + runtime exist; **not** in the builder palette. |
| `error_trigger` | [doc-only] | 🟡 renderer exists, **not in palette** (`prototype.md:96`) | ❌ not shipped | ❌→intended | Explicitly out of scope for v1 (`report-archive-docs §4`). |
| Screenshot Node | [doc-only] | 🟡 component-library example only | ❌ never in catalog/compiler/runner | ❌→intended | Abandoned (T157; `report-archive-docs §4`). |

Palette total = **26 kinds** (24 prototype-matching + `ml_model` + `create_asset`).
Compiled executable adapter kinds = **18** (adds `ml_predict`, drops the 4 triggers
and `sticky_note`). Intended-spec list = **25** (`report-archive-docs §1.2`).

### 2.2 Toolbar / header / footer actions

| Action | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Back link | ✅ | ✅ shell header | ✅ | |
| Editable title / workspace chip | ✅ | ✅ inline title edit | ✅ | |
| Status chip (Draft/Published) | ✅ "Draft"/"Active" | ✅ `defStatus` | ✅ | Impl status reflects real publish state. |
| Builder / Executions tabs | ✅ | ✅ `BuilderMainTab='builder'|'executions'` `report-frontend §4` | ✅ | |
| Publish / activation toggle | ✅ cosmetic toggle | ✅➕ real publish→`materialize_triggers`, unpublish→`unmaterialize` `report-frontend §10`, `report-backend` | ✅➕ | **Publish/unpublish IS activation — no separate `active` boolean.** |
| Component Library button | ✅ opens **design-system showcase modal** | 🟡 header button present; opens the *global* component library, **not** a showcase | 🟡 | Intentional repurpose (`report-archive-docs §4`). See §3 / G5. |
| Version history button + menu | ✅ in-memory 20-cap list | ✅➕ paginated popover, real **restore** `report-frontend §10` | ✅➕ | |
| Execute Workflow + trigger caret | ✅ play/spinner + trigger menu | ✅ run orchestration; footer trigger `<select>` only when ≥2 executable (non-chat) triggers `report-frontend §8` | ✅ | |
| Show/Hide Chat | ✅ label flips | ✅ pill, only when `chat_input_trigger` present `report-frontend §9` | ✅ | |
| + Node | ✅ opens drawer | ✅ `WorkflowAddNodeDrawer.tsx` `report-frontend §7` | ✅ | |
| Undo / Redo | ✅ history stack | ✅ footer buttons `WorkflowBuilderShell.tsx:2489,2497` | ✅ | **Undo/redo EXISTS** (corrects earlier reads). |
| Zoom in / out / Fit | ✅ | ✅ `zoomIn`/`zoomOut`/`fitView` from `useReactFlow()` + auto-fit on load `report-frontend §4` | ✅ | |

### 2.3 Canvas interactions

| Interaction | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Pan / zoom / wheel | ✅ custom transform layer | ✅ React Flow defaults `report-frontend §4` | ✅ | |
| Node drag | ✅ from body + action buttons | ✅ React Flow draggable; `onNodeDragStart/Stop` | ✅ | |
| Connection handles + states | ✅ rich CSS (ready/occupied/reroute-hover) | 🟡 React Flow `Handle` + `isValidConnection`; micro-states thinner `report-frontend §6` | 🟡 | Cardinality + fan-in enforced; cosmetic handle polish thinner. |
| Plus-connect / "add node after" | ✅ `.plus-connect-btn` | ✅ on selected node, "+" per outbound port `WorkflowRfNode.tsx:224-241` (T161) | ✅ | Source handle itself also clickable to add. |
| Output port labels (True/False/Kept/per-category) | ✅ | ✅ color-coded port labels `WorkflowRfNode.tsx:255-271` | ✅ | |
| Background grid | ✅ | ✅ `<Background variant=Dots>` `report-frontend §4` | ✅ | |
| Auto-connect on add | ✅ drawer-insert wiring | ✅ `graph/autoConnect.ts` `report-frontend §3` | ✅ | |
| Connection cardinality + trigger fan-in policy | ✅ | ✅ `graph/connectionPolicy.ts` mirrors `WF_COMPILE_MAX_INPUTS_EXCEEDED` `report-frontend §2` | ✅ | |
| Dynamic ports (switch cases / classification cats / merge slots) | ✅ | ✅ derived at runtime `WorkflowRfNode.tsx:80-90` `report-frontend §6` | ✅ | |
| Sticky note inline edit | ✅ | ✅ `StickyNoteNode.tsx`, stripped from compile | ✅ | |
| **Sticky note resize** | ✅ resize handle, "Resized sticky note" | ❌ "intentionally out of scope for v1" `StickyNoteNode.tsx:16-19` | ❌→intended | See §3 / G4. |
| **Marquee / box-select** | ✅ `state.isMarqueeSelecting`, body-class UI-lock | ❌ no `selectionOnDrag`/`SelectionMode`/`onSelectionChange` `report-frontend §4` | ❌ | See §3 / G1. |
| **Multi-select** | ✅ `Set` of selected ids | ❌ only single-node `activeNodeId` `report-frontend §4` | ❌ | See §3 / G1. |
| **Copy / paste of nodes** | ✅ clone w/ new ids, +40px offset, re-center, skip single-instance | ❌ no node clipboard `report-frontend §4` | ❌ | "Copy" hits are *copy-run-to-builder* replay, not node clipboard. See §3 / G2. |
| **Duplicate node** | ✅ context-menu Duplicate | ❌ no duplicate affordance `report-frontend §4` | ❌ | See §3 / G2. |
| **Right-click context menu (canvas/nodes)** | ✅ `openNodeContextMenu` | ❌ no `onContextMenu`/`NodeContextMenu` `report-frontend §4` | ❌ | See §3 / G3. |
| **Minimap / Controls panel** | ✅ — (n/a; custom) | ❌ no `<MiniMap>` / `<Controls>` `report-frontend §4` | ❌ | Footer buttons cover zoom/fit; no minimap. |
| Overlap / capacity resolution | ✅ `resolveNodeOverlaps` | ✅ `graph/overlap.ts` (+tests) | ✅ | |

### 2.4 Per-node actions (canvas affordances)

| Affordance | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Per-node Execute / Step-test button | ✅ floating `execute-button` on node | 🟡 step-test launched from **Node Config modal** ("Execute Node"), not a node-body button `report-frontend §5,§8` | 🟡 | See §3 / G3. |
| Per-node Configure button | ✅ floating `configure-button` | 🟡 opens via **double-click** (`onNodeDoubleClick`) `report-frontend §4` | 🟡 | |
| Per-node Edit (sticky) button | ✅ floating `edit-button` | 🟡 sticky edited by clicking into the note | 🟡 | |
| Per-node More-actions (`more_vert`) | ✅ opens context menu | ❌ no floating more-actions button `report-frontend §4` | ❌ | See §3 / G3. |
| Selected-node "+" chain affordance | ✅ (via plus-connect) | ✅ circular "+" per outbound port when selected `WorkflowRfNode.tsx:224-241` | ✅ | |
| Per-node status badge (running/success/error/cancelled) | ✅ success/error badge | ✅➕ status border + corner icon `WorkflowRfNode.tsx:100-164` | ✅➕ | Impl adds a `cancelled` state (T215) the prototype lacked. |
| Node Duplicate / Delete from canvas | ✅ context-menu items | ❌ no menu; delete only via RF selection + key `report-frontend §4` | ❌ | Folded out with the context menu. |

### 2.5 Execution flow

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Node execution status constants | ✅ Not/Executing/Succeeded/Failed | ✅➕ running/succeeded/failed/**cancelled** `WorkflowRfNode.tsx:100-164` | ✅➕ | |
| Animated executing + succeeded/failed assets | ✅ dual-ring keyframes | ✅ status border + spinner icon | ✅ | |
| Run with spinner + disable during run | ✅ | ✅ `ACTIVE_RUN_STATUSES=queued|running|waiting` gating `report-frontend §9` | ✅ | |
| Real compile of authored graph | ❌ (mock) | ➕ `engine.Compile` → immutable `CompiledPlan` `report-engine §2` | ➕ | |
| Real run lifecycle (queue→lease→run→finalize) | ❌ (timers) | ➕ `CreateManualRun` + worker claim/lease `report-engine §6`, `report-worker §1` | ➕ | |
| Step leasing / heartbeat / sweeper | ❌ | ➕ worker lease (`FOR UPDATE SKIP LOCKED`) + engine sweeper `report-worker §1`, `report-engine §6e` | ➕ | |
| Chat-driven execution + approval pending | ✅ mock | ✅➕ real chat ingress → create_run/resume, waiting+resume `report-engine §6b`, `report-backend` | ✅➕ | |
| Workflow chat window (expand/close/messages/input/typing) | ✅ | ✅ `WorkflowChatWindow.tsx` (free-text + approval) `report-frontend §9` | ✅ | |
| Trigger fan-in / initial-step computation | ❌ | ➕ multi-trigger fan-in `report-engine §6` | ➕ | |
| Cancel run | 🟡 mock action | ➕ two-phase cancel, license-ungated `report-engine §6d` | ➕ | |
| Compile-error surfacing | ❌ | ➕ red pill → humanized popover; execute disabled "Fix errors to run" `report-frontend §4` | ➕ | |

### 2.6 Executions view + run detail

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Table columns Date&Time/Status/Duration/Actions | ✅ | ✅ `WorkflowExecutionsView.tsx` `report-frontend §8` | ✅ | |
| Status pills (green check / red error) | ✅ | ✅ `WorkflowExecutionStatusBadge` | ✅ | |
| Datetime + duration formatting | ✅ | ✅ `formatRunTimestamp`/`formatRunDuration` | ✅ | |
| Succeeded → Copy to Builder | ✅ (no wired handler) | ✅➕ live `onCopyToBuilder` | ✅➕ | |
| Failed → Retry + Debug in Builder | ✅ (no wired handler) | ✅➕ live `onRetry`/`onDebugToBuilder` | ✅➕ | |
| In-flight → Cancel Run | ❌ | ➕ `onCancel` for queued/running/waiting | ➕ | |
| Run detail drill-in (step timeline, artifacts) | ❌ ("no deeper drill-in wired") | ➕ `WorkflowRunDetailDrawer.tsx` (Phase 18/US16) — timeline + preview drill-down `report-frontend §8` | ➕ | Never fetches full artifact bodies; uses `/previews/{doc}`. |

### 2.7 Version history + publish

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| History dropdown | ✅ | ✅ `ClockCounterClockwise` popover `report-frontend §10` | ✅ | |
| 20-cap + empty state | ✅ in-memory cap | ✅ "recent 20 + load-more" over immutable server-side versions (`versionHistoryHasMore`) | ✅ | Cap is a UI default over unlimited durable history. |
| Restore a version | ❌ (label only) | ➕ `restoreVersion` → `POST .../versions/{ver}/restore` `report-backend workflows.py:662` | ➕ | Restore = new latest version cloned from snapshot. |
| Publish/unpublish as activation | ✅ cosmetic | ✅➕ `publishDefinition`/`unpublishDefinition`; no separate `active` flag `report-frontend §10` | ✅➕ | |

### 2.8 Node configuration modal

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| 3-column Input / Configuration / Output | ✅ | ✅ `WorkflowNodeConfigModal.tsx` via `NodeConfigLayout` `report-frontend §5` | ✅ | Left column dropped for input-less nodes. |
| Input tabs Schema/Table/JSON/Global Vars + node filter + search | ✅ | 🟡 `NodeInputExplorer` (Schema/Table/JSON/Global Vars) `report-frontend §5` | 🟡 | Global Vars present; the prototype's "All Nodes" filter not separately confirmed. |
| Output tabs Schema/Table/JSON + status + per-branch | ✅ | ✅ `NodeOutputPreview` per-branch tabs `report-frontend §5` | ✅ | |
| Always-present Label (maxlength 100) | ✅ | ✅ `NodeSettingsPanel` | ✅ | |
| Type-specific config fields | ✅ dispatch per kind | ✅➕ `NodeConfigurationPanel` routes to Action/Agent/Transform/MLModel/CreateAsset editors `report-frontend §5` | ✅➕ | Impl adds ML/create-asset editors. |
| Settings tab: Always output / Execute once / Retry on fail / On Error | ✅ | ✅ `NodeSettingsPanel` (`stop_workflow`/`continue`/`continue_using_error_output`) `report-frontend §5` | ✅ | Exact match. |
| Execute Node button (+ trigger variants) | ✅ | ✅ label switches Execute Node / Test Chat / Run Schedule Now / Send Test Webhook `report-frontend §5` | ✅ | |
| Step-test input modes | 🟡 single "Execute" | ➕ **3 modes**: reuse_prior_outputs / recompute_ancestors / **fixture_input** `report-frontend §8`, `report-engine §6a` | ➕ | "With fixture input" button when `onExecuteWithFixture` provided. |
| Side-effect confirm-live-execution | ❌ | ➕ `confirm_live_execution` ack for action step-tests `report-engine §6a` | ➕ | |
| Column resizers (Input/Config/Output) | ✅ | ❌ not built `report-frontend §4` | ❌→likely intended | Prototype has them; impl modal controls are Execute + Config↔Settings + (no column resizers). |
| Prev / next node nav arrows | ✅ | ❌ no prev/next in modal `report-frontend §4` | ❌ | See §3 / G8. |
| Source sub-modal (Database/API) | ✅ + mocks | ✅➕ `WorkflowSourceSelectionWizard` (real sources, 4 modes) `report-frontend §5` | ✅➕ | |
| Expression editor Fixed/Expression + String/Number/DateTime/Select; 6-group operators dropdown | ✅ | 🟡 real SQL/JQ editors + `AncestorFieldPicker`; not a 1:1 fixed-mode picker or standalone 6-group dropdown `report-frontend §5` | 🟡 | Functional need covered; prototype's exact widgets not reproduced. See §3 / G9. |

### 2.9 Component / workflow library page

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| Library page (search/filter/sort/grid-list/create/per-card menu) | ✅ (listing context) | ✅ `WorkflowLibraryPage.tsx` (Workflows + Executions tabs, URL-synced) `report-frontend §11` | ✅ | |
| Workflow card (thumbnail/status/last-updated/overflow) | ✅ | ✅ `WorkflowCard.tsx` overflow: Execute/Open/Publish-toggle/Delete `report-frontend §11` | ✅ | |
| Cross-workflow Executions view (workspace level) | 🟡 per-workflow only | ➕ real cross-workflow Executions tab (FR-011) `report-frontend §11` | ➕ | |
| Component browser modal (for `component` node) | 🟡 selector only | ➕ `WorkflowComponentBrowserModal` + preview `report-frontend §5` | ➕ | |
| Design-system **showcase** modal | ✅ rich showcase `prototype.md §9` | ❌ no showcase modal | ❌→intended | Header button opens global component library instead. See §3 / G5. |

### 2.10 Config / cross-cutting (mostly extras)

| Feature | In Prototype | In Current Impl | Status | Notes |
| --- | --- | --- | --- | --- |
| RBAC / workspace + private-workspace isolation | ❌ | ➕ `_resolve_workflow_route_context` `report-backend RBAC` | ➕ | |
| License gating (feature-level, not per-node) | ❌ | ➕ engine HTTP 402 + scheduler + worker re-check `report-engine §7` | ➕ | `command`+ for `workflows`/`workflow_runs`/`schedules`. |
| Webhook ingress (auth modes, Fernet secrets, SSRF) | 🟡 URL display only | ➕ real ingress + OAuth2 JWKS `report-backend`, `report-worker §3.12` | ➕ | |
| Schedule cron firing | 🟡 config only | ➕ scheduler tick + tz-aware next-fire-at `report-engine §5b` | ➕ | |
| Ancestor refs ({{alias}} from transitive upstream) | ❌ | ➕ `ancestor_refs.go` + `AncestorFieldPicker` `report-engine §4` | ➕ | |
| Run retention / purge | ❌ | ➕ sweeper retention (30d/7d/pinned) `report-engine §6e` | ➕ | |
| Idempotency journal for actions | ❌ | ➕ `workflow_action_outbound` (short-circuit + park) `report-worker §3.12` | ➕ | |
| Admin/audit cross-workspace run reporting | ❌ | ➕ telemetry `flowruns.go` | ➕ | |
| `alertMessage` toasts | ✅ | ✅ shell toasts | ✅ | |
| Preserved typos ("Swtich Cases","Aggergate") | ✅ | ✅ corrected in impl labels | ✅ | Cosmetic fix, not a gap. |

---

## 3. Detailed gaps (❌ Missing / 🟡 Partial)

### G1 — Marquee box-select + multi-select ❌ (canvas)
- **Prototype:** `state.isMarqueeSelecting` (`prototype.html:2535`), `body.marquee-selecting` disables UI during the drag (`:616-626`), a `Set` of selected node ids (`:2513`); copy/paste/duplicate operate over that set.
- **Current:** None. `<ReactFlow>` is mounted (`WorkflowBuilderShell.tsx:2371-2395`) without `selectionOnDrag` / `SelectionMode` / `multiSelectionKeyCode` / `onSelectionChange`; only single-node selection drives `activeNodeId` (`report-frontend §4`).
- **Where it would live:** `WorkflowBuilderShell.tsx` `<ReactFlow>` props (enable `selectionOnDrag` + `onSelectionChange`) plus a selection-state slice. React Flow supports this natively, so it is a low-effort enablement that pairs with G2.

### G2 — Node copy / paste / duplicate ❌ (canvas)
- **Prototype:** copy (`:20054-20083`) / paste (`:20086+`) — clones with new ids, +40px × paste-count offset, re-centers, skips single-instance kinds on paste (`:20099`); context-menu Duplicate (`:20001`) clones with offset and copies sticky content/size.
- **Current:** No node clipboard and no duplicate action (`report-frontend §4`). The "copy" hits are *copy-run-to-builder* replay (`copyRunToBuilder`), not a node clipboard; "Paste" strings are JSON-fixture textarea hints.
- **Where it would live:** keydown handlers + a clipboard slice in `WorkflowBuilderShell.tsx`, reusing the id-remap logic that already exists for replay/copy-to-builder. Duplicate is the same clone path bound to a single node.

### G3 — Per-node action surface + right-click context menu ❌/🟡 (canvas)
- **Prototype:** every node carries floating buttons — Execute/Step-test (`:17431`), Configure (`:17465`), Edit-sticky (`:17488`), More-actions `more_vert`→`openNodeContextMenu` (`:17514`) — plus a right-click context menu (`openNodeContextMenu :19976`) with Edit / Configure / Execute / Duplicate / Delete.
- **Current:** The node body (`WorkflowRfNode.tsx`) renders only a status badge (`:100-164`) and the selected-node "+" chain button (`:224-241`). Configuration opens via **double-click** (`onNodeDoubleClick`); step-test launches from inside the **Node Config modal** ("Execute Node"). There is no `onNodeContextMenu`, no `more_vert` button, and no `WorkflowNodeContextMenu` (`report-frontend §4`). **Consequence:** there is no canvas surface for per-node Execute, Duplicate, or an explicit Delete menu item.
- **Where it would live:** a new `WorkflowNodeContextMenu` mounted on `onNodeContextMenu` in `WorkflowBuilderShell.tsx`, and/or hover action buttons in `WorkflowRfNode.tsx`; wire Execute→existing step-test orchestration (`startStepTestRun`), Duplicate→G2 clone helper, Delete→React Flow node removal.

### G4 — Sticky note resize ❌ (intended)
- **Prototype:** resize handle (`:470-484`, `:17243-17272`) pushing a "Resized sticky note" history entry; default 280×180 but user-resizable.
- **Current:** `StickyNoteNode.tsx:16-19` — *"Resize is intentionally out of scope for v1… fixed default dimensions"*; fixed `STICKY_NOTE_WIDTH=280`/`HEIGHT=180` (`report-frontend §4`).
- **Where it would live:** `StickyNoteNode.tsx` (add `@xyflow/react` `NodeResizer`) + persist width/height into the node's authored config. **Marked intentional** by the in-code comment — but cheap to revisit (Tier-1 recommendation).

### G5 — Component Library showcase modal ❌ (intended)
- **Prototype:** a full design-system showcase modal (`prototype.md §9`) demoing reusable field primitives (text+counter, datetime, dropdowns, expression drop-tree, conditions, tag selector, toggles) — a developer reference, not an end-user feature.
- **Current:** No showcase modal. Per the archive spec the header "Component Library" button opens the existing/global component library experience, not a per-builder showcase (`report-archive-docs §4 — builder-spec coverage gaps`).
- **Verdict:** intentional — the showcase was prototype scaffolding.

### G6 — `dashboard_agent` durable output 🟡
- **Prototype:** "Create a dashboard item."
- **Current:** the node exists and compiles (`llumen.output_agent`), but the worker's `dashboard` agent path emits a **text JSON document only — no durable dashboard is created** (`report-worker §3.10`, checklist "dashboard → text JSON document only"). Slides and briefing output agents *do* persist durable entities; dashboard does not.
- **Where it would live:** `worker/internal/worker/agent_runtime.go` (a dashboard persistence path analogous to `runInfusionOutputWorkflowAgent` slides/briefing) + a content internal persistence route.

### G7 — `aggregate` node has no dedicated operator 🟡
- **Prototype:** Aggregate config with Mode (Individual Fields / All Items into Single List) + include/exclude builders.
- **Current:** the node is in the palette (`nodeCatalog.ts:32`) and compiles to `llumen.transform`, but the runtime has **no dedicated aggregate operator** — it runs the author's raw SQL/JQ on the `default` channel (`report-worker §3.5`, checklist "generic SQL (join/aggregate/map) → single default channel… no dedicated join/aggregate operator"). The prototype's structured include/exclude builder does not map to a first-class aggregate transform.
- **Where it would live:** `engine/internal/engine/compile.go` transform bindings + worker transform runtime, plus a structured aggregate config editor in `nodeConfig/`.

### G8 — Config modal prev/next navigation + column resizers ❌
- **Prototype:** prev/next node nav arrows (`:1999,2187`) and drag-resizers between Input/Config and Config/Output columns (`:2073-2076`).
- **Current:** `WorkflowNodeConfigModal.tsx` has no prev/next props or buttons, and no column resizers (`report-frontend §4`). Modal-level controls are Execute, Configuration↔Settings toggle.
- **Where it would live:** `WorkflowNodeConfigModal.tsx` / `NodeConfigLayout.tsx`. Low effort; high day-to-day modal polish.

### G9 — Expression fixed sub-modes + grouped operators dropdown 🟡
- **Prototype:** Fixed↔Expression switch with fixed sub-modes String/Number/Date-Time/Select (`:1355-1399`) and a 6-group operators dropdown `OPERATORS_DROPDOWN_DEFINITION` (`:2397-2508`).
- **Current:** real SQL/JQ editing (`WorkflowSQLQueryEditor`, `TransformNodeConfigEditor`) and an `AncestorFieldPicker`, but **not** a 1:1 reproduction of the prototype's fixed-mode pickers or a standalone six-type operators dropdown (`report-frontend §5`). Conditions are handled inside per-kind transform editors.
- **Where it would live:** `nodeConfig/` editors; the operator vocabulary exists conceptually but is not surfaced as the prototype's grouped dropdown.

### G10 — Connection-handle micro-states + input "All Nodes" filter / minimap 🟡/❌
- **Prototype:** bespoke handle CSS for ready-target/ready-source/occupied/reroute-hover (`:488-561`); input "All Nodes" filter (`:2038-2045`).
- **Current:** React Flow handles cover ready/connected states with thinner occupied/reroute polish; no minimap; the input-explorer "All Nodes" filter is not separately confirmed (`report-frontend §4-6`). Cosmetic.
- **Where it would live:** `canvas/WorkflowRfNode.tsx` / `WorkflowRfEdge.tsx` (handle states), `<MiniMap>` in the shell, `NodeInputExplorer.tsx` (filter).

---

## 4. Extras in current implementation (➕ not in the prototype)

The prototype is a UI mock; the implementation is a full product. Major extras:

**Node kinds / runtimes**
- `ml_model` [palette] — Snowflake/MLflow batch predict, 50k-row cap, parquet contract (`report-worker §3.3`).
- `create_asset` [palette] — ingests a workflow-produced table as a real source + dashboard asset + cache (`report-worker §3.9`).
- `ml_predict` [compiled-only] — catalog-model inference via the ML inference service (`report-engine §1a`, `report-worker §3.4`).
- Real durable **slides** persistence from `slides_agent` (RPC + REST inserts, `report-worker §3.11`).

**Engine / runtime (entirely absent from the prototype)**
- Real **compile** authored→immutable `CompiledPlan` with 40+ `WF_COMPILE_*` validations (cycles, fan-in, ports, merge slots, agent/action/transform state) — `report-engine §2-3`.
- **Run lifecycle:** create-run with eligibility + `ALREADY_ACTIVE` lock, initial-step fan-in, events, chat bubbles — `report-engine §6`.
- **Worker:** claim/lease with `FOR UPDATE SKIP LOCKED`, heartbeat, 12 adapter-key runtimes, artifact/preview persistence, branch-aware enqueue — `report-worker §1-4`.
- **Sweeper:** lease reclaim, step + chat-prompt timeouts, cancelling-run finalize, retention purge — `report-engine §6e`.
- **Scheduler:** claim-due soft-lease tick, license gate, backoff/auto-disable, tz-aware next-fire-at — `report-engine §5`.
- **Step-test** with three input modes (reuse_prior_outputs / recompute_ancestors / **fixture_input**) + side-effect `confirm_live_execution` — `report-engine §6a`.
- **Chat resume** of `send_and_wait` steps (single-writer journal lock) — `report-engine §6b`.
- **Ancestor refs** ({{alias}} from transitive upstream) + `AncestorFieldPicker` — `report-engine §4`.

**Platform**
- RBAC / workspace + private-workspace isolation — `report-backend RBAC`.
- License gating (feature-level: `workflows`/`workflow_runs`/`schedules` → `command`/`citadel`) at HTTP 402 + scheduler + worker — `report-engine §7`.
- Webhook ingress with per-binding auth (none/basic/api_key/bearer/oauth2 + JWKS), Fernet secrets, SSRF guards — `report-backend`, `report-worker §3.12`.
- Idempotency journal `workflow_action_outbound` (short-circuit + park) — `report-worker §3.12`.
- Run Detail Drawer with step timeline; live cancel/retry/copy/debug — `report-frontend §8`.
- Persisted immutable version history with **restore** — `report-backend workflows.py:662`.
- Admin/audit cross-workspace run reporting — telemetry `telemetry/internal/api/flowruns.go`.
- Run **retention/purge** + object-storage artifact lifecycle (30d/7d/pinned) — `report-engine §6e`.
- Full REST surface: definitions/versions/authored CRUD, publish/unpublish, triggers list, webhook-secret set/delete, runs/events/previews/cancel, chat start/message/close — `report-backend`.

---

## 5. Prototype-only concepts intentionally dropped

Cross-referenced against `report-archive-docs.md` (synthesizing
`docs/_archive/workflow/workflow-builder-spec.md`,
`WORKFLOW_FEATURES_AND_USER_STORIES.md`, `WORKFLOW_TASKS.md`). These were
**explicitly decided out of scope**, not forgotten:

| Prototype concept | Decision | Evidence (`report-archive-docs`) |
| --- | --- | --- |
| `error_trigger` node | Prototype-only; NOT shipping in v1 (reserved single-instance). | §4 Non-Goals |
| Screenshot Node | ABANDONED — component-library example only; never in catalog/compiler/runner (T157). | §4 Non-Goals |
| Component Library **showcase** modal | Header button repurposed to open the existing/global component library, not a design-system showcase. | §1.13 / builder-spec gaps |
| Visible `filter.discarded` output channel | Resolved v1: `filter` shows only `Kept` on canvas; `discarded` is runtime-only. | §4 (FR-121) |
| Sticky-note resize | Out of scope v1 (in-code comment); fixed default dims. | §4; `StickyNoteNode.tsx:16-19` |
| Per-message chat attachments | Out of scope for chat MVP (T192); text-only, 64 KiB cap. | §4 Non-Goals |
| Unifying LlumenChat + WorkflowChatWindow | Rejected for v1 (kept separate, D26.6/T213). | §4 Non-Goals |
| App-input primitives (file/text/JSON/CSV) + analytics transforms in drawer | Hidden from the workflow add-node drawer (T158/D28.2). | §4 |
| Per-workflow timeout / concurrency UI | Stays engine-configured; no builder control yet (T159/D28.3). | §4 |
| General-agent tool toggles UI (Web Search/SQL/etc.) | Prototype had a non-rendered `generalAgentTools` stub; agent output is plain text at MVP (T165/D28.6). | §4; `prototype.md:100` |
| Hardcoded webhook URL `webhook.llumen.io/{id}` | Replaced by real `path_key` allocation + Fernet secret. | `report-engine §5a`; `prototype.md:99` |
| Cross-host re-rooting of webhook URLs / schedule targets on restore | Not a goal; schedules restored PAUSED; URLs re-shared. | §4 Non-Goals |

Note: marquee, multi-select, node copy/paste/duplicate, right-click context menu,
and config-modal prev/next are **gaps, not documented exclusions** — the archive
docs (§1.1) list FR-069 "Node overflow/context menu" and undo/redo, but do not
record a decision to *drop* selection/clipboard ergonomics. Treat G1–G3 and G8 as
real, closable gaps (§6).

---

## 6. Prioritized recommendations to close the gap

Tiered by (impact ÷ effort). "Impact" = how much it restores the prototype's
authoring feel or unblocks a real user task.

### Tier 1 — High impact, low/medium effort (do first)
1. **Per-node action surface + right-click context menu (G3).** The only
   *ergonomic regression with no equivalent*. Add a `WorkflowNodeContextMenu`
   (mount on `onNodeContextMenu`) and/or hover buttons in `WorkflowRfNode.tsx`
   exposing Configure / Execute(step-test) / Duplicate / Delete. Wire to existing
   step-test + clone + delete logic. *Effort: medium.*
2. **Node copy / paste / duplicate (G2).** Keyboard copy/paste + duplicate of
   selected nodes with id remap (the remap logic already exists for replay/
   copy-to-builder). High daily value for repetitive graphs. *Effort: low–medium.*
3. **Sticky-note resize (G4).** Add `@xyflow/react` `NodeResizer` + persist
   width/height. Small, self-contained; the prototype shipped it. *Effort: low.*
   (Deferred v1, but cheap to revisit.)

### Tier 2 — Medium impact, medium effort
4. **Marquee + multi-select (G1).** Enable React Flow `selectionOnDrag` +
   `onSelectionChange`; pairs naturally with copy/paste (#2) and multi-delete.
   *Effort: low (RF native) — value compounds with #2.*
5. **Config-modal prev/next nav + column resizers (G8).** Polish of the most-used
   modal; the prototype has both. *Effort: low–medium.*
6. **`dashboard_agent` durable output (G6).** Make the dashboard agent actually
   create a durable dashboard (parity with slides/briefing) instead of emitting
   text only. Closes a *semantic* gap users hit at runtime. *Effort: medium–high.*

### Tier 3 — Lower priority / cosmetic
7. **First-class `aggregate` operator (G7).** Replace raw-SQL passthrough with a
   structured aggregate transform + include/exclude config UI. *Effort: high;*
   current raw-SQL path is a functional workaround.
8. **Expression fixed sub-modes + grouped operators dropdown (G9).** Parity polish;
   today's SQL/JQ + ancestor picker covers the functional need.
9. **Minimap + connection-handle micro-states + input "All Nodes" filter (G10).**
   Cosmetic. `<MiniMap>` is a one-line RF add. *Effort: low, impact low.*

### Explicitly do NOT build (confirmed out of scope — see §5)
- `error_trigger`, Screenshot Node, Component Library showcase modal, visible
  `filter.discarded` channel, per-message chat attachments, app-input primitives
  in the drawer, per-workflow timeout/concurrency UI, hardcoded webhook URL.
  Closing these would contradict product decisions, not the prototype.

---

## Sources

- `/tmp/wf_research/report-prototype.md` — prototype functionality inventory (target/desired UX).
- `/tmp/wf_research/report-frontend.md` — **authoritative** for the builder canvas UI / palette (`nodeCatalog.ts`).
- `/tmp/wf_research/report-engine.md` — Go engine (compile, validate, schedule, runs, sweeper, license).
- `/tmp/wf_research/report-worker.md` — Go worker (claim/lease, 12 adapter runtimes, artifacts).
- `/tmp/wf_research/report-backend.md` — FastAPI surface (REST, RBAC, ingress, engine client).
- `/tmp/wf_research/report-archive-docs.md` — intended spec + intentional-drop decisions.
- Contracts: `contracts/workflow_node_kinds.json`, `contracts/license_tiers.json`.
- Prototype URL: `http://prototype.llumen.io/workflow/979669f6a773bc14ee5e3b19.html`.
