---
topic: workflows
services: [engine, frontend, supabase, worker]
status: current
---
# Workflow backlog — two-developer split

> Divides the remaining backlog (`planned-features.md`: E5–E8, E10–E13, plus the two E1
> deferred tails) into **two parallel workstreams with zero file overlap**. Every item's
> file footprint was re-scouted against the current working tree of
> `feat/workflow-enhancments` (audit line numbers had drifted), and the partition was
> adversarially checked for hidden coupling beyond raw file intersection (shared stores,
> import graphs, contract sync tests, cross-stream feature deps). Verdict: **sound,
> provided the ownership rules in §5 are followed.**

## 0. TL;DR

| | Stream A — Canvas & ergonomics | Stream B — Data semantics & runtime |
|---|---|---|
| **Items** | E6 → E7 → E5 → E10 → E11, then E12* | Land E1-core → clone-remap helper → E1-preview → E8(a) → E13 → E1-join (design first) |
| **Territory** | `WorkflowBuilderShell.tsx`, `canvas/*`, run-detail drawer | `nodeConfig/*`, `contracts/*`, `engine/`, `worker/`, content/agent services |
| **Skills** | React / React Flow (E12 adds Go + Python) | TS + Go (+ SQL gen, DuckDB) |
| **Raw file overlap** | — | **none** (verified: A touches 22 files, B touches 47, intersection empty) |

\* E12 sits in Stream A purely for load-balancing — see §6.

## 1. Gate 0 — land the branch first (blocks both streams)

The ~5,000-line uncommitted working tree (E1 core + E2 + E3) spans **both** streams'
territories: `WorkflowBuilderShell.tsx`, `WorkflowNodeConfigModal.tsx`, engine
`compile.go`/`ancestor_refs.go`, worker `transform_runtime.go`/`agent_runtime.go`,
`vitest.config.mts`, and the still-untracked `contracts/data_reference.json` +
`docs/workflows/feature-audit/`. **Neither stream can branch until this lands** — even
"unblocked" E8 starts from a `transform_runtime.go` carrying 170 uncommitted lines.

- Owner: **Stream B** (it's their domain); Stream A reviews the shell/canvas-adjacent hunks.
- The E12 scouting must be refreshed after landing: the working tree already routes
  `agentKindDashboard` through `runInfusionOutputWorkflowAgent`
  (`worker/internal/worker/agent_runtime.go`), shrinking E12's worker half to persistence only.

## 2. Stream A — Canvas & ergonomics (frontend-only until E12)

Owns the React Flow surface. All five canvas items rewrite the same neighborhoods
(`WorkflowBuilderShell.tsx` ReactFlow mount / `renderedNodes` memo / drag-undo handlers;
`canvas/WorkflowRfNode.tsx` handle + selected-state affordance lines), so they are
**strictly serial within the stream** — one dev, sequential PRs, no parallel canvas PRs.

### Order and footprints

1. **E6 — Marquee + multi-select** (LOW). `WorkflowBuilderShell.tsx`: `selectionOnDrag`,
   `SelectionMode.Partial`, `panOnDrag={[1,2]}`, `onSelectionChange`, `deleteKeyCode`;
   switch `onNodeDragStop` to React Flow v12's third `nodes` arg so `resolveOverlaps`
   anchors **all** dragged ids (today's single-id `Set` would nudge co-dragged nodes apart);
   wire `onSelectionDragStart/Stop`. Gate the `+` chain affordance in `WorkflowRfNode.tsx`
   during multi-selection. Test: multi-anchor case in `graph/overlap.test.ts`.
   ⚠ Needs design sign-off: left-drag becomes marquee, panning moves to middle/right button.
2. **E7 — Copy / paste / duplicate** (M). New clipboard-shortcuts hook + paste-at-cursor
   (`screenToFlowPosition`, pointer ref), undo via `capturePast()`, skip single-instance
   kinds. **The clone/id-remap core is NOT built here** — it consumes the Stream-B-owned
   helper (§5 rule 3). Shortcuts must gate off the config modal (which owns window-level
   Alt+Arrow), drawers, and text inputs.
3. **E5 — Per-node context menu** (L-Med). `onNodeContextMenu`/`onPaneContextMenu` →
   new portaled `canvas/WorkflowNodeContextMenu.tsx`: Configure (`setActiveNodeId`),
   Execute (`startStepTestRun(nodeId, 'reuse_prior_outputs')` — side-effect confirm comes
   free), Duplicate (E7 util; disabled for single-instance kinds), Delete (mint RF `remove`
   changes through `handleNodesChange` so undo matches keyboard delete). `sticky_note` →
   Delete only. Copy click-outside/Escape pattern from `DataReferencePicker.tsx`.
4. **E10 — Sticky-note resize** (LOW). `NodeResizer` in `canvas/StickyNoteNode.tsx`;
   persist `config.width/height` (engine treats sticky config as opaque — verified, no
   contract/engine change); stamp initial dimensions in `document/authoredBridge.ts`
   `toFlowNodes`; prefer persisted size in the shell's overlap-nudge fallbacks; `capturePast`
   on the first `dimensions` change.
5. **E11 — Minimap + handle micro-states** (LOW). `<MiniMap>` themed via
   `getWorkflowNodeAsset(kind)` (mirror the `DataFlowEditor.tsx` precedent); new
   `canvas/handleAssetState.ts` + greenfield `canvas/workflowCanvas.css` for
   occupied/ready handle states (occupied derived in the shell's `renderedNodes` memo, like
   `onAddFromHandle`); reroute-hover styling on `WorkflowRfEdge.tsx`.
   ⚠ Decide: hover styling only, or full `edgesReconnectable` drag-to-rewire (bigger).
6. **E12 — `dashboard_agent` durable output** (M-High, decision-gated — see §6). Worker
   `persistDashboardFromAgent` mirroring `persistSlidesDraftFromAgent` + `backendclient`
   `CreateDashboard`; content internal route mirroring `/flow-assets` (`CreateFlowAsset`); agent-service
   `dashboard_creator` subagent (prompt + draft tools, mirrors the slides path); new
   `supabase/migrations/` dashboard table; run-view entity chip in
   `WorkflowRunDetailDrawer.tsx`. Groundwork already exists: `entity_type` enum has
   `dashboard`, audit enums exist, engine already compiles `dashboard_agent`, and the
   contract maps it — zero engine/contract work.

## 3. Stream B — Data semantics & runtime (nodeConfig + Go + contracts)

Owns the data-reference model end to end. The three big items rewrite the same worker
function neighborhood (`buildSQLOutputQueries` in `transform_runtime.go`) and the same
three frontend test suites — **strictly serial: E8 → E13 → E1-join**. Do not add a second
contributor to this stream; that recreates exactly the conflicts the split avoids.

### Order and footprints

1. **Gate 0** — land the E1-core branch (§1).
2. **Clone-remap helper** ✅ **shipped** — `nodeConfig/cloneRemap.ts`:
   `remapNodeConfigForClone(kind, config, idMap, { unmappedReferences: 'keep' | 'drop' })`.
   Structural remap over the two node-id key names (`from_node_id`, `fromNodeId`), so new
   binding fields are covered automatically; compile-time `*_SOURCE_KEYS` records +
   a sentinel sweep test (`__tests__/cloneRemap.test.ts`) fail when a binding field
   appears without acknowledging the clone path. Drop mode also clears alias-valued
   bindings (`rowSource`, `featureRefs`) and pipes through `normalizeWorkflowNodeConfig`
   for the transform cascade. Stream A consumes this from E7/E5 and never hand-rolls
   ref remapping.
3. **E1-preview — live resolved-value preview** ✅ **shipped**. `resolvedRefValue.ts`
   (pure resolution from the schema resolver's cached previews) + `ResolvedRefValueBadge.tsx`
   (badge + values-row), threaded through condition operands, edit_fields, aggregate/merge
   sources, agent/action ref chips, asset/ml row-source labels + feature bindings, and the
   picker (field samples, whole-output row counts, current-value line). Resolver change was
   additive only (`rowCount`/`columnCount`/`wholeSample`/`sampleIsValue` on the returned
   schema — call signature untouched, §5 rule 2 held). Display-only; values are last-run
   samples with the caveat in the badge tooltip. Expression inputs surface values on a
   separate line because the pill mirror can't host inline text or tooltips.
4. **E8 — numeric type integrity** ✅ **shipped** (with a refined diagnosis: the real bug
   was DuckDB materialising `HUGEINT` aggregate results as `DOUBLE` in parquet — parquet
   has no int128 — not "widening to accept"). Worker-only: `narrowHugeintColumns` wraps
   every materialised query with `SELECT * REPLACE (CAST(… AS BIGINT))` for 128-bit
   columns (loud overflow error beyond int64, pass-through otherwise), `UseNumber()`
   document decode, and `normalizeJQInput` in `safety.go` converting payloads to gojq's
   legal number vocabulary so integers survive JQ. Force-CAST to input types rejected;
   ISO-timestamp re-inference deliberately not done (false-positive risk, no reported
   need).
5. **E13 — first-class aggregate** ✅ **shipped slim** (re-scoped after E8 removed its main
   justification). Built: guided `groupByFields` (deduped keys projected + `GROUP BY` /
   jq `group_by` mirror, both modes), native-type `SUM`/`AVG` (the generator's
   `TRY_CAST AS DOUBLE` both floated integer sums and silently dropped unparseable values
   from totals), and the invalid `LIST(*)` list-mode fallback → `LIST(<from>)`.
   Deliberately NOT built: the worker-side structured program / typed engine validation —
   user-invisible architecture, revisit only if authoring opens to less-trusted users.
   Existing configs untouched (same raw-SQL pipeline, additive keys).
6. **E1-join — per-item linked join** ✅ **shipped** (deferral reversed, built via
   audit→implement→adversarial-review workflow). Realised as a frontend-generated
   correlated guarded subquery (not the design's worker JOIN — an audit proved FROM
   aliasing breaks saved advanced predicates), a `linked` contract usage with distinct
   engine validation codes, the worker's `IS NOT TRUE` negated-channel fix for NULL-row
   conservation, and a `JoinKeyPicker` UI. Join keys use an identity-preserving
   `CAST AS VARCHAR` projection (not the membership DECIMAL normaliser — that fuzzes
   `'1'`/`'01'`/`'1.0'`). Known limitations (empty lookup upstream, self-target
   degradation, the routing-change blast radius) documented in `E1-linked-join-design.md`.

## 4. Why this partition

- **Raw file intersection between streams: empty** (Stream A 22 files, Stream B 47).
- It is also a **skill split**: A is React/React-Flow interaction work; B is the
  data-reference model spanning TS state ↔ Go engine/worker ↔ synced contracts.
- The canvas hot files (`WorkflowBuilderShell.tsx`, `WorkflowRfNode.tsx`) are all-A; the
  data hot files (`workflowNodeConfigState.ts`, `ancestorRefWiring.ts`,
  `TransformNodeConfigEditor.tsx`, `transform_runtime.go`, `contracts/*`) are all-B.

## 5. Ownership rules (the conditions that keep the overlap at zero)

1. **Territory is exclusive.** A never edits `nodeConfig/*`, `contracts/*`, `engine/`,
   `worker/` (E12 excepted, §6); B never edits `WorkflowBuilderShell.tsx` or `canvas/*`.
   If an item seems to need the other territory, hand that part across rather than editing.
2. **Frozen import surfaces.** B may extend but not break the exports A's shell imports:
   `buildDefaultNodeConfig`, `isTransformNodeKind`, `maxInputsForNode`,
   `deriveRuntimeOutputPorts` (from `workflowNodeConfigState.ts`) and
   `useAncestorSchemaResolver` / `schemaForAncestor` (E1-preview must stay additive to the
   hook's return type — any signature change drags B into A's hottest file mid-flight).
3. **The clone-remap helper is B-owned, A-consumed.** It lives in `nodeConfig/`, ships
   with the shape-exhaustiveness test, and **every B PR that adds a node-id-bearing config
   field (E13 group-by, E1-join keys) must extend it in the same PR.** A's E7/E5 call it
   and never hand-roll ref remapping.
4. **Contracts are single-owner (B).** All four synced contracts + mirrors + Go sync tests.
   Verified A is contract-free (sticky `width`/`height` ride opaque config).
5. **Keyboard arbitration.** A's E7 shortcut hook gates off `INPUT`/`TEXTAREA`/`SELECT`/
   `contentEditable` and the open config modal; B's new focusable popovers
   (`JoinKeyPicker`, preview badges) must keep using standard focusable elements so the
   gate keeps working. Cross-stream smoke test: copy/paste inside config fields.
6. **Engine compile is a shared runtime contract.** B's new compile validations
   (`WF_COMPILE_AGGREGATE_*`, linked-usage rules) change which authored configs compile —
   B announces each new error code so A can re-run its Execute/Duplicate QA.
7. **Shared doc files.** Both streams flip statuses in `planned-features.md` /
   `enhancement-backlog.md` and add notes to `docs/workflows/builder-ui.md` (A) vs
   `ancestor-refs.md`/`transform-nodes.md` (B) — trivial, but rebase docs last in each PR.

## 6. The E12 placement (load-balancing call)

Without E12, the split is roughly **1 : 3**: A is ~2–3 weeks of LOW/M frontend work,
fully unblocked after Gate 0; B is the Gate-0 landing + E8 + E13 + E1-preview + E1-join —
7–10+ weeks gated on four separate decisions. E12 is the one B-flavored item with
**verified zero overlap with B's hot zone** (`agent_runtime.go`/`backendclient`/agent
service/migration/run drawer vs B's `transform_runtime.go`/`nodeConfig`), and its blocking
decision resolves independently — so it moves to A as the back-half of that stream.

- **Caveat:** it needs Go + Python + SQL. If the Stream A dev is frontend-only, E12 stays
  in B and the imbalance is accepted (or E12 waits for whoever frees up first).
- **Do not move E1-preview instead** — it shares `TransformNodeConfigEditor`,
  `DataReferencePicker`, and the wiring test suites with E13/E1-join and would manufacture
  real conflicts.
- E12's Supabase migration regenerates `frontend/src/types/database.generated.ts`;
  coordinate so no unrelated migration lands mid-E12.

## 7. Decision gates (settle early; none block day-1 work)

| Gate | Blocks | Owner asks |
|---|---|---|
| ~~E8 type policy~~ resolved: integer data stays integral (HUGEINT narrowing + JQ fix shipped) | — | E13 unblocked |
| Dashboard entity definition (table shape, placement, viewer surface) | E12 (A back-half) | Product; minimal schema = M-High, viewer page pushes it to High |
| E1-join deferral reversal + join-key semantics | building E1-join | CTO; design doc delivered (`E1-linked-join-design.md`, decisions D1–D6) |
| `panOnDrag` remap (left-drag = marquee) | E6 ship | Design sign-off; changes the default canvas gesture |
| Reroute-hover: styling vs full edge reconnection | E11 scope | Design; reconnection adds shell state + undo work |
| Preview staleness labeling + membership truncation copy | E1-preview polish | Product (non-blocking; ship with sensible defaults) |

## 8. Sources

- Footprints: per-item scouting of the `feat/workflow-enhancments` working tree (2026-06).
- Items + estimates: `planned-features.md`, `enhancement-backlog.md`.
- E1 ground truth: `E1-unified-data-reference-architecture.md`, `E1-implementation-details.md`.
