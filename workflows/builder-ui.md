---
topic: workflows
services: [engine, frontend]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow builder UI

## Audience and goal

React-Flow builder under `frontend/src/components/pages/workflows`. Syncs
with the content service's Flow definitions API and enforces node-kind validations
client-side per `workflowService.ts`. This page covers the library, the
canvas shell, node addition, and the node-config modal; node-kind-specific
editor behavior lives on the per-kind pages ([node-catalog.md](node-catalog.md),
[transform-nodes.md](transform-nodes.md), [ancestor-refs.md](ancestor-refs.md)).

## Read first (ordered)

1. `frontend/src/components/pages/workflows/WorkflowLibraryPage.tsx` — library list.
2. `frontend/src/components/pages/workflows/WorkflowBuilderShell.tsx` — canvas shell, node-config modal orchestration, trigger-first gating.
3. `frontend/src/components/pages/workflows/WorkflowAddNodeDrawer.tsx` — node picker.
4. `frontend/src/features/workflows/catalog/nodeCatalog.ts` — node kind catalog metadata (`singleInstance`, `isTrigger`, etc).
5. `frontend/src/services/workflowService.ts`

## How it works

The builder is a single-page React-Flow canvas shell composed of a
library list, a canvas + node-config modal, datasource/asset pickers,
and a version-history panel — the subsections below cover each in
turn.

### Library

The workflow library list is **not** a bespoke component — it's the shared
`LlumenCardGrid` (`frontend/src/components/common/LlumenGrid`), the same grid
primitive used elsewhere in the app, wired with workflow-specific sort/filter
adapters in `WorkflowLibraryPage.tsx`. `WorkflowLibraryFilters.tsx` exists in
the same directory and exports a filter-bar component, but it is **dead
code** — nothing renders `<WorkflowLibraryFilters>` anywhere in the tree;
`WorkflowLibraryPage.tsx` only imports its `SortKey` type, not the component.
Don't describe it as the active filter UI.

### The library card's minimap reads the canvas's palette

`minimapVisuals.ts` takes every node colour from `getWorkflowNodeAsset` — the
registry the canvas itself uses — because the minimap used to carry its own
category palette and it had drifted: **Output Agents were purple in the minimap
and orange (`#fda022`) on the canvas; Actions were slate against orange.** The
same workflow was two different pictures depending on where you looked, and
adding a node kind meant updating a list nobody knew existed.

`__tests__/minimapVisuals.test.ts` walks the whole `NODE_CATALOG` and asserts
every kind's minimap fill equals its registry `tileBackground`, so the two
cannot diverge again. Annotations are still drawn faint, but by **fading the
registry colour** rather than substituting one — muting is a decision about
emphasis at thumbnail scale, not a second opinion about hue.

Three geometry rules earn their place, each fixing something a real workflow
exposed:

- **Node size follows the same scale as position** (`minimapProjection.ts`). The
  projection used to scale the layout but draw every node at a fixed 28x14, so a
  40-node workflow rendered as a few solid slabs with every edge hidden
  underneath. The footprint comes from the canvas's own `DEFAULT_NODE_WIDTH` /
  `CLEANUP_COL_GAP` / `CLEANUP_ROW_GAP`, so a change to canvas spacing moves the
  minimap with it. A floor keeps a very large graph's nodes visible rather than
  sub-pixel; a graph dense enough to hit it overlaps slightly, which is honest —
  it says "this is a big workflow" rather than pretending each node has room.
- **The zoom is capped.** Unbounded fit-to-box magnified a three-node workflow
  until its nodes were quarter-card slabs. Capping the SCALE rather than the size
  keeps the canvas's relative geometry and simply renders small workflows at a
  sane zoom, centred in the leftover room.
- **Annotations do not frame the picture.** Sticky notes are usually parked in a
  banner row well above the graph; including them in the bounds stretched the box
  upward and squashed the actual workflow into the bottom third of the card. The
  bounds now come from executable nodes whenever there are any — notes are still
  projected with the same transform and simply clip at the frame. A test asserts
  that adding a sticky note moves no node at all.

**Nodes are drawn as canvas cards, not colour swatches.** A canvas node is a
dark card (`rgba(30,31,37,0.92)`, the registry's flat `NEUTRAL_CARD_BG`) carrying
an icon tile that is always a circle, 40px inside a 240px card. The minimap holds
that 1/6 ratio, which is what makes a shrunk node still read as the same object.
The two gradient card backgrounds are deliberately not reproduced — their radial
glow is invisible at thumbnail scale and the kind's identity is carried by the
tile.

**One design at every size — nothing switches.** There was briefly a second mode
(a solid block of the kind colour for nodes under 16 units) on the theory that a
card is illegible when small. That threshold was wrong twice over: it measured in
viewBox units while legibility depends on RENDERED pixels — the 320-unit box is
displayed 700px+ wide, so a 6-unit node is ~13px on screen, ample for a card and
a dot — and it made the library show two different thumbnail designs side by
side depending on how many nodes each workflow happened to have. Everything
scales proportionally now, including the border width, so a small node is the
same design drawn smaller. A test asserts the design is identical at 3, 6, 12, 20
and 44 units.

Edges are cubic beziers rather than straight lines, and they run **port to
port** — the right edge of the source card to the left edge of the target, as the
canvas's do. Centre-to-centre lines emerged from behind a node body and cut
diagonally across its corner, which is what made the minimap's connections look
wrong beside the canvas's. It deliberately does NOT import React Flow's
`getBezierPath`: that derives its curve from PORT positions, which a minimap does
not model (it plots node centres), so it would not reproduce the canvas path
anyway — and it would pull the whole React Flow runtime into a library page that
has no canvas on it.

The card itself is unchanged: `WorkflowGraphThumbnail` renders the minimap in
place of the flat swatch projection it used to draw, keeping its existing
`IntersectionObserver` gating and module-level fetch cache, so a long library
page still issues one request per visible workflow.

### Canvas: trigger-first node addition

`WorkflowBuilderShell.tsx` computes a `needsTrigger`-style flag as
`!nodes.some((node) => getCatalogEntry(node.data.kind)?.isTrigger)` — while
true, the canvas shows a "trigger-first" empty state ("Add a trigger
first") and `WorkflowAddNodeDrawer.tsx` is forced into trigger-only mode.
There is no separate "component library" button in the builder header —
node/asset addition goes exclusively through the footer's node-picker
entry point into `WorkflowAddNodeDrawer`. **AI Findings** is a node, not a
footer control: the terminal `ai_findings` kind in the drawer's Output Agents category
(Agentic Flow only, one per flow, hidden when the licence lacks
`ai_findings_generation`). Publishing a version that holds it turns findings on;
see [ai-findings.md](ai-findings.md).

**Single-instance kinds.** `nodeCatalog.ts` entries carry an optional
`singleInstance?: boolean` flag (currently set on trigger-ish catalog
entries). The drawer disables an already-placed single-instance entry with
an exact-copy disabled reason: `"This trigger node can only be added once"`
for trigger kinds, `"This node can only be added once"` for non-trigger
singleton kinds (`WorkflowAddNodeDrawer.tsx`, comment cites a specific Figma
frame for the copy — treat that string as UI-copy-locked, not casually
reworded).

### Node-config modal

Tabs in the output/input preview panes use these exact string labels
(`NodeOutputPreview.tsx`, `NodeInputExplorer.tsx`): `Schema`, `Table`,
`JSON`, and (input side only) `Global Vars`. Output preview states are a
fixed small set: `empty`, `executing`, `failed`, `success`,
`success_no_output` (`NodeOutputPreview.tsx` — `success_no_output` renders
"Execution completed without output" with a distinct icon/color from a
plain empty state).

### Settings tab

The node-config modal's **Settings** tab (`NodeSettingsPanel.tsx`, wired
through `WorkflowNodeConfigModal.tsx`) has six controls, and **every one of
them now has runtime effect**. It used to have five, of which one worked; the
other four persisted into the authored document and were discarded at compile.

A fifth control, **Execute once**, was **removed** rather than wired — see
the end of this section for why.

- **Timeout (seconds)** — a number input bounded to `1..86400`; empty means
  no per-step timeout. This was pure surfacing of behavior that already
  existed: the engine's `buildPolicy` (`engine/internal/engine/compile.go`)
  has always compiled `settings.timeoutSeconds` into the step's policy, and
  the worker's `computeStepTimeoutAt` has always enforced it as an absolute
  deadline — there was simply no input for it before. `sharedSettings.ts`'s
  `readTimeoutSeconds`/`applyTimeoutToSettings` are the canonical validators
  (shared with the authored-document normalizer); the panel itself
  additionally clamps an over-cap number typed into the box down to 86400
  rather than discarding it, a UI-only nicety that intentionally does not
  live in `readTimeoutSeconds`.
- **On Error** — three modes, compiled into the policy's `onError` key and
  read by the worker's failure path (`worker/internal/worker/failadvance.go`).
  `stop_workflow` is the default and unchanged: the step is marked `failed`
  and its whole transitive downstream `skipped`. `continue` marks the step
  `failed` but leaves the downstream schedulable. `continue_using_error_output`
  does the same and additionally publishes the failure as the step's `default`
  output, so a downstream node receives a JSON document carrying
  `error`/`node_id`/`error_code`/`error_message`.

  Continue is not simply "don't skip the descendants": `inputSatisfied`
  demanded a `succeeded` upstream, so the readiness predicate itself had to
  change. It did, narrowly — a `failed` node satisfies an edge only when its
  OWN compiled policy says to continue past its failure. `cancelled` in
  particular stays unsatisfied: On Error is an authoring choice about handling
  errors, not a licence to keep working after a user stops the run.

  The run's terminal status stays `failed`. `ClassifyRunTerminal` is mirrored
  in the engine sweeper, so diverging the worker's copy would make a run's
  final status depend on which finaliser won the race.

- **Always output data** — compiled as `alwaysOutputData` and read by both
  transform engines and the classification agent. Its reach is narrower than
  the label suggests, because most of the runtime already emits an empty
  output on zero rows: a source step, a non-branching transform, `noop`,
  `wait` and an empty `dataset_output` all write an output row with
  `is_empty=true`, so their downstream is already reachable and the toggle is
  a no-op for them.

  Where it bites is the channels that are deliberately skipped when empty —
  `filter`, `if_else`, `switch_cases`, and a classification agent's
  per-category channels. That skip **is** how branching works, because
  `inputSatisfied` gates on the channel key. So turning this on for a
  branching node means **every branch runs, not only the one that matched**.
  The panel copy says so, and the toggle is off by default and per-node.

  The investigation also surfaced a latent bug independent of the toggle: a
  classification agent handed zero input rows logged "emitting empty outputs"
  and then emitted none, so every category branch below it silently never ran
  — no output row, no `skipped` row, and the run still finalised `succeeded`.
  It now emits one empty output per category **when the toggle is on**;
  turning that on unconditionally would have started firing every category
  branch of every existing zero-row run.

- **Retry on fail**, with **Max attempts** (`1..10`, default 3) and **Retry
  delay** (`0..300`s, default 5) revealed underneath it. Compiled as
  `retryOnFail` / `retryMaxAttempts` / `retryDelaySeconds`. A bare on/off
  switch cannot express a retry policy, and a switch that hides its own
  parameters is how this tab became misleading in the first place.

  Max attempts counts TOTAL attempts, not retries after the first: 3 means
  try, retry, retry.

  **Retries exhaust first, then On Error applies to the final failure.** That
  ordering is the whole contract between the two settings and it is pinned by
  a test. The cancel path is untouched — a cancelled context short-circuits
  to `cancelled` before the retry path is reached, so stopping a run cannot
  be turned into a retry loop.

  See [worker-executor.md](worker-executor.md) for the runtime mechanics
  (same-row `attempt_no` bump, the non-blocking backoff, and the budget it
  shares with the sweeper's lease-expiry requeue).

**Execute once was removed, not wired.** It promised to "reuse the first
successful result inside a run instead of executing the same node multiple
times", and a node cannot execute twice in one run. Three independent
guarantees say so:

1. `workflow_step_run_unique_attempt UNIQUE (workflow_run_id, node_id,
   attempt_no)`, and no `INSERT` sets `attempt_no`, so it is always the
   column default `1` — the constraint degenerates to unique per
   `(run, node)` and the database refuses a second row.
2. `EnqueueReadyStepsScoped` skips any node that already has a step row, in
   any status, so the scheduler never tries.
3. Both requeue paths — the engine sweeper's lease expiry and the worker's
   new `retryOnFail` — bump `attempt_no` **in place** on the same row and are
   gated to non-terminal statuses, so neither re-runs a succeeded step nor
   mints a second row.

So there was no behaviour to wire, and shipping a control that cannot do
anything is the defect this work exists to remove. The setting is gone from
`SharedNodeSettings`, the panel, and the engine's `policySettings` /
`defaultPolicy`; `normalizeSharedNodeSettings` actively deletes both
`executeOnce` and `execute_once` so documents authored before the removal
stop carrying a key nothing reads. The evidence is executable rather than
just written down — `worker/internal/worker/execute_once_test.go` fails if
anyone adds a second-execution path, and
`TestBuildPolicy_DropsExecuteOnce` fails if the key returns to the compiler.

The Source node's SQL editor (`nodeConfig/WorkflowSQLQueryEditor.tsx`) and
the platform-settings component wizard's `CreateComponentWizard/editors/
SQLQueryEditor.tsx` both render through one shared Monaco theme,
`frontend/src/lib/llumenMonacoTheme.ts`'s `LLUMEN_MONACO_THEME`
(`'llumen-dark'`, registered via `ensureLlumenMonacoTheme`) — real SQL
syntax colouring (keywords, strings, numbers, comments) in place of the
stock `vs-dark` theme both editors used before. The theme also colors
the suggestion widget's selected row, making it visible when arrowing
through autocomplete entries.

That same editor also offers schema-aware autocomplete (table names,
column names, then keywords) while authoring a Source node's query —
where the schema comes from, when it is fetched, and what happens when
the fetch fails are documented in
[source-nodes.md](source-nodes.md#authoring-schema-aware-sql-autocomplete),
not duplicated here.

### Create Asset — configuration assist

The Create Asset node's config editor
(`nodeConfig/CreateAssetNodeConfigEditor.tsx`) has a "Suggest title &
chart type" button in its Asset settings card. It stays disabled until
the node's upstream schema resolves to at least one field
(`canSuggestAssetConfig`) — there is nothing to reason about with an
unconnected or still-loading source. On click it posts the upstream
columns and a few sample rows through `workflowService.suggestAssetConfig`
to the agent's `POST /api/agent/flows/{flow_definition_id}/asset-suggestions`
under the caller's JWT. No workspace or node id is sent: the agent checks
that the caller can edit the Flow, taking its scope from the definition
row, and masks the sample rows before the model sees them
([../services/agent.md](../services/agent.md#flow-asset-suggestion)). A
refusal is FastAPI `{detail}`, read by `readRequestError` through
`utils/apiErrorDetail.ts`, so the licence 402 shows a sentence. The response (name + chart type) is
applied to the node's config exactly once, from the click handler itself
rather than a render-reactive effect, so it is a proposal: the author can
edit the applied title or chart type afterwards and that edit stands —
nothing re-applies the suggestion on a later render.

**Chart type catalog.** The node's chart-type selector now offers all
sixteen members of the `chart_type` DB enum plus `table`, grouped into
sections with human-readable labels (defined in
`frontend/src/features/workflows/assets/chartTypeCatalog.ts`; the value
list is auto-derived from the DB enum so it cannot drift). The selected
value passes through the engine and worker unconstrained — the engine
passes `config.chartType` as a step binding and the worker only defaults
an empty value to `table`. Server-side validation lives in content's Flow create-asset write (the
route the worker calls to persist the node's output):
`FlowAssetCatalog` (loaded from the asset-type catalog in `contracts/asset/`
by `content/internal/api/services/assets/workflow_catalog.go`) and its
`NormalizeChartType` in `workflow_create.go`. The agent's suggestion route derives the same
14 values from `contracts/asset/` too (`suggestion_chart_types` in
`agent/src/services/flow_asset_suggestion.py`). An unrecognised value falls
back to `table`, and the legacy `kpi` value still aliases to `kpi_card`.

**Column mapping follows the chart type.** The node no longer asks for a
fixed X/Y pair. `mappingFieldsForChartType`
(`frontend/src/features/workflows/assets/mappingFields.ts`) derives the fields
for the selected type, so polar asks for direction and speed, a range chart for
X plus low and high bounds, a gauge for a single value, and a table for none.
For bar, line and area that is exactly the X/Y pair.

**Only REQUIRED fields are offered** (product decision, 2026-08-24). The optional
extras that briefly appeared — `series`, `seriesColumns`, `maxTotal`,
`referenceValue` and friends — are deleted, along with the amber
"incomplete / required" affordance, which was display-only and never gated a run.
A required field is marked by a `(required)` suffix on its label and nothing more.
The cost is real: a grouped or stacked bar, and a line with a reference band,
cannot be authored from the node. Both remain authorable on the produced asset via
**Edit asset** (below), and `update_existing` preserves those edits.

The required set is **not** restated here — it is read from the Create Asset
wizard's own `frontend/src/utils/chartMappingRules.ts`, so the node and the
wizard cannot drift apart about what a chart needs. (`pie` needs a second probe:
its rule returns as soon as the first key is missing.) Labels reuse the wizard's
wording so the two surfaces read alike.

The authored map travels as `config.dataMapping` → the engine's
`dataMappingJSON` binding (pruned and marshalled the same way the `ml_model`
node handles `featureMappingJSON`, so an empty map emits no binding and does not
rotate the bindings hash) → the worker's `data_mapping` payload field →
`query_config.dataMapping`, where the authored keys win and the values derived
from `x_column`/`y_column` fill only what is left unset. Malformed mapping JSON
logs and continues with an empty map rather than failing the step.

A chart variant travels the same way as `config.chartSubtype` → the engine's
`chartSubtype` binding → the worker's `chart_subtype` payload field →
`configuration.chartSubtype`, the key the renderer reads: a horizontal or
progress bar is `chartType: "bar"` with `chartSubtype: "horizontal"` or
`"progress"`, the same pair the component wizard and the chat agent save. The
engine accepts only the platform's `chart_subtype` values, and only on a chart
(`WF_COMPILE_CREATE_ASSET_SUBTYPE_UNSUPPORTED` on a table or a map layer). The
picker offers the two bar variants as their own choices, Horizontal Bar Chart
and Progress Bar (`chartSubtype` on a `chartTypeCatalog.ts` entry;
`catalogEntryFor` reads a stored pair back to its choice). Picking a choice
writes its subtype and drops any other; switching between an upright and a
sideways bar swaps `x` and `y`, because a sideways bar reads `x` as the value.
The mapping labels ("X Value Field", "Y Category Field"), the test-run preview
and the node title follow the subtype. A subtype that is only a styling of its
chart type (`vertical`, `donut`) shows as the chart type itself. A
node without one emits no binding, so its bindings hash is unchanged. SDK-authored
documents store it for the catalog types whose chart type alone names another
type (`horizontal_bar`, `progress_bar`).

### Create Asset — map layers

Picking a map visualization (**Points, Area, Heatmap, Arcs, Fences, Pillars, Discs,
Wind**) switches the node from chart mapping to map mapping. **No axis fields are
shown at all.** The geometry columns are detected from the upstream step's sample
rows, and styling takes platform defaults.

**No camera is authored, and that is deliberate.** A produced map layer is saved
with no `configuration.camera`, which is exactly what makes it frame its own data:
`resolveMapAssetNavigation` obeys a saved camera when one exists, and only falls
through to `fitBounds` over the layer's real coordinates when it does not (see
`frontend/src/utils/mapAssetCamera.ts`). Both cameras available at authoring time
are wrong — a fixed platform centre is right only by coincidence (an Abu Dhabi
default over Riyadh data drew a correct layer ~800km off-screen), and a camera
derived from the node's sample rows inherits the sample's bias, since sample rows
are the *first* N and a time-series ordered by entity collapses to a near-zero
bbox. `test_a_produced_map_layer_carries_no_camera` guards the absence.

Map catalog values are namespaced **`map:<subtype>`**, and this matters: `area` is
both a chart type and a map-layer subtype, so a bare value would let picking the
Area map layer silently produce an area chart. The engine's create_asset binding
builder is the single boundary that strips the prefix; nothing downstream sees it.
Content's create-asset route (`CreateFlowAsset`,
`content/internal/api/services/assets/workflow_create.go`) rejects an unknown
*or still-prefixed* `map_subtype` with a 400, which
is how a regression in that one boundary surfaces.

Detection reuses the component wizard's own machinery rather than reimplementing
it — `analyzeRows` → `proposeFieldMapping` → `LocationAdvancedSection`, wrapped by
`features/workflows/assets/mapMappingDetection.ts`. The advanced viewer (confidence
scores, per-field Override, reset-to-auto-detected) is collapsed by default; the
common path asks the author for nothing beyond the visualization.

**Detection needs one run.** Sample rows come from the upstream step's last run, so
before a workflow has run once the fields read "Not set" and the copy says so.
**Detect columns** re-runs detection against the latest upstream data.

**The first run works without the author touching anything.** Detection runs in
the browser against sample rows from a *previous* run, so a brand-new map node
necessarily sends an empty mapping. Content therefore infers the geometry column
from the output **column names** (`inferGeometryMapping` in
`workflow_create.go`): a self-contained column (`location`,
`geometry`, `geom`, `wkt`, …) is used as-is, and a latitude/longitude pair gets a
`mergeLatLng` binding with the **longitude as the primary column** — the
documented caller contract of that op, which trusts declared order rather than
guessing from magnitudes, because a latitude legitimately larger than its
longitude (most of Europe) would otherwise be teleported.

Three limits are deliberate and tested:

- It runs **only when the node sent no mapping**. An author's resolved column, or
  a wizard edit surviving the update merge, is never overridden.
- It covers **only point-geometry subtypes**. Arcs need an origin *and* a
  destination and fences need a path; picking one column by name there is a coin
  flip that yields a plausible-looking asset drawing the wrong thing.
- When nothing matches it still **fails with a 400** rather than creating an
  empty map — an asset that saves, lists and renders nothing looks like success,
  which is the worse outcome.

It is not a second detector: the browser's `proposeFieldMapping` reads column
*values* (WKT vs GeoJSON vs `"lng,lat"`) and stays strictly better. This only has
to make the common first run work. The worker no longer carries its own
`WF_CREATE_ASSET_NO_GEOMETRY` pre-flight check — the guard lives at the one layer
that owns the subtype→mapping-key table.

### GIS Correlation Agent — the result on the canvas

When a run the builder watched succeeds, a GIS Correlation Agent node that ends
the Flow (nothing after it, or only the map node added for it) shows its result on
the canvas: an **Asset** node ("Result map") after it, wired from its output and
holding the map the step kept, and a **sticky note** above it with the run's
answer. The Worker keeps that map as one asset bound to the agent node and
refreshes it on every run, so the Asset node keeps pointing at it; the builder
reads it with `assetService.getFlowNodeAsset(definitionId, nodeId)` and asks for
a map thumbnail when it has none. `planGisResultNodes` (`gisResultNodes.ts`)
decides the change; both nodes carry `config.generatedFrom` = the agent's node id.
An agent that feeds any other node than **AI Findings** gets neither; AI Findings
is a terminal no-op, so the Worker keeps the map with it too (`gisVisualAllowed`).

Adding the nodes edits the Flow, and autosave stores every edit as a new version,
so a run edits the Flow **at most once**:

- The nodes are added only when neither is on the canvas yet, and never while the
  open draft is the published version (`resolveManualRunMode` would say
  `production`). Saving there would move the Flow off its published version, so
  the next Run would become `builder_debug` and AI Findings would stop. On a Flow
  like that the answer is still in the step's output in the run detail, and the
  map is still the node's asset.
- The addition goes through undo and autosave like an edit. After that the author
  owns the nodes: a later run never rewrites them and never re-adds one they
  deleted while the other remains. Deleting both (and so the agent's edge to the
  map) makes the agent end the Flow again, and the next watched run adds them anew.
- A later run's answer is **run-time state**: `showLatestGisAnswers` draws it over
  the note on the canvas, and the saved note keeps its text, so the run saves no
  version. Once the author edits the note, their text shows instead. Reloading
  the builder shows the saved text again.

Runs the builder does not watch (scheduled, production) refresh the asset but
never edit the canvas.

### Create Asset — the produced asset, and editing it

After a **successful** run the node shows a **Produced asset** card with a live
preview and an **Edit asset** button that opens the component wizard in edit mode
on the real asset (`ProducedAssetSlide`, driven by `useProducedAssetId`, which
resolves the id from the step's output descriptor — hence "successful": a failed
run shows the empty state instead).

The canvas tile shows the produced map **as soon as the run succeeds**, without
the node being opened. Two things make that work, and both were gaps:

- The tile resolves the produced asset from the **step output** via
  `useProducedAssetId`, not from `config.producedAssetId` — that config key is
  only stamped as a side effect of the config panel capturing a thumbnail, so a
  node that had run successfully stayed blank until someone opened it.
- Nothing in the run pipeline generates a map thumbnail (the wizard screenshots
  on save; the worker has no browser), so `ProducedMapThumbnailCapture` renders
  the layer **off-screen**, screenshots it once and uploads it. It must be
  positioned off-screen with a real width/height — not `display:none`, not a
  zero-size box — because Mapbox does not paint a map with no layout area, so it
  would never fire `idle` and the capture could only wait out its deadline.

**Why the capture reported "map did not become idle".** Off-screen layout was
only half of it. `LlumenMapRef.captureScreenshot` and `prepareForThumbnail` both
read `map.loaded() === false` as "the map has not come up yet" and waited for the
**one-shot** `load` event. Mapbox also returns false from `loaded()` while a
change to the sources or style is still in flight — precisely the state a freshly
added layer leaves the map in — and `load` fired seconds earlier and never fires
again, so that wait could only expire. `captureScreenshot` reported the expiry by
rejecting, LlumenMap logged the rejection with `console.error`, and Next.js
surfaced it as an error overlay: *Screenshot timeout: map did not become idle*.
The `style.load` branch was dead the same way. Bigger produced layers hit it more
reliably, because a big layer is the one still loading when the capture asks.

Both waits now go through **`LlumenMap/waitForMapIdle.ts`**, which subscribes to
`idle` — a **repeating** event Mapbox fires after every render pass that leaves
nothing pending (`Map#idle()` is `!isMoving() && loaded()`), so it fires again
once the new source finishes. It never subscribes to a lifecycle event that may
already have fired; it forces one repaint so an already-settled map still emits
`idle`; and on expiry it **resolves** with `'timeout'` rather than throwing, so
the caller captures the best frame available and the existing "tiny or non-image
data URL" guard is what rejects a bad capture. Tests:
`LlumenMap/__tests__/waitForMapIdle.test.ts` — its fake map exposes no `once` and
knows nothing of `load`, so a regression to the one-shot wait fails loudly
instead of hanging. Both capture sites still poll `getViewState()` first, but
that only proves a map object exists; it was never able to prevent this.

The preview renders live through `ChatMultiAssetMapPanel`, and its
`configurationOverride` is **required** despite reading as optional: the panel
builds each layer with `configuration: entry.configurationOverride ?? {}`, so
omitting it hands the renderer an empty configuration and the map mounts and pans
with no layer on it — which looks like a camera problem rather than a missing
layer. The preview also screenshots itself once it settles and stores the image on
the node, so the canvas tile shows the visual the way an `asset` node does; capture
waits on `prepareForThumbnail()` first, so the capture runs against a settled map
instead of racing a fixed timer against the fitBounds flight and photographing the
camera mid-flight.

This is what makes the map story complete rather than limited: create with detected
geometry and default styling, then customize in the wizard, and `update_existing`
preserves those edits on every later run. It is also why per-node map styling is
deliberately out of scope.

`xColumn` / `yColumn` are still written and still read: `normalizeChartConfig` in
`DataAssetContainer.tsx` back-fills `dataMapping` from them on every chart
render as a documented legacy migration, and workflows authored before this
change seed their `x`/`y` keys from them on load.

**Only authorable chart types are offered.** `wind_rose`, `temperature_range`,
`horizontal_progress` and `grouped_segments` are `chart_type` enum members that
nothing can author a mapping for — no case in `chartMappingRules.ts`, no branch
in the wizard's `DataMappingSection.tsx` (`isPolar` matches `'polar'` only,
`isRange` matches `'range'` only). A wind rose is a rendering mode of polar,
which is why the wizard titles that section "Polar / wind rose". Every enum
member must be classified as authorable or explicitly vestigial, so a new one
fails a test rather than silently appearing in the picker.

### Canvas navigation

`workflowCanvasNavigationProps` (`WorkflowBuilderShell.tsx`) sets React
Flow's `panActivationKeyCode: null`, which disables hold-Space-and-drag
panning outright. This is deliberate, not a regression: React Flow's
default `'Space'` pan binding installs a window-level keydown listener
whose skip-text-fields guard is disabled while any modifier key is held,
and whose pressed-key bookkeeping gets cleared by the first Space keyup
while Shift is still physically down — so, while holding Shift, every
space typed after the first was silently swallowed inside Monaco's
textarea (and any other text field on the page: the node-name input, the
workflow title, sticky notes, the chat box). Authors holding Shift to type
`SELECT * FROM ...` lost every space after the first. If you relied on
hold-Space-to-pan, it is gone; panning still works via two-finger scroll
(`panOnScroll`), pinch-to-zoom, and middle- or right-mouse-button drag
(`panOnDrag: [1, 2]`). Full diagnosis lives in the comment above
`workflowCanvasNavigationProps`; the regression guard is
`__tests__/WorkflowBuilderShell.spacePanKey.test.tsx`.

### Datasource and asset pickers

The datasource-selection wizard is a single component,
`WorkflowSourceSelectionWizard.tsx`
(`frontend/src/components/pages/workflows/nodeConfig/`). The asset/"component"
browser modal has a **naming lag**: the file is
`WorkflowComponentBrowserModal.tsx` but its default export is
`WorkflowAssetBrowserModal` — a leftover from the same component→asset
rename discussed in [node-catalog.md](node-catalog.md); don't assume the
file name reflects the current exported symbol name.

#### Source-node modes (five cards, one per bucket)

`WorkflowSourceMode` is `query | api_request | file | dataflow | marketplace`
(`workflowWizardState.ts`). Each card maps to one bucket of
`fetchWorkflowSourceBuckets` (`workflowWizardUtils.ts`), and the mode is stored
on the node config as `mode`, which decides which editor
`NodeConfigurationPanel` opens.

Two things here are easy to break:

- **`querySources` is a NEGATIVE filter** — "everything that is not api/file/
  dataflow/marketplace". Every new source family must be subtracted from it
  explicitly or it silently appears under the **Database** card. `marketplace`
  did exactly that until 2026-08-24: a TomTom source was offered as a database
  and the node then opened a SQL editor over a JSON envelope with
  `dialect="tomtom_traffic"`.
- **`inferWorkflowSourceMode(config, source?)` takes the source**, and the
  argument is load-bearing. Its last rule — a JSON-shaped `query` means an API
  request — predates marketplace, and an envelope IS a JSON object, so a config
  with no explicit `mode` (legacy, cloned, agent-authored) used to open
  `APIRequestEditor` over `{"operation","parameters","sql"}`. Precedence is now:
  explicit `mode` → marketplace source → the JSON-shape fallback (still
  load-bearing for real API nodes). Everything this UI writes stamps a `mode`,
  so rule 2 is a legacy net rather than the steady state.

**Marketplace nodes** reuse the asset wizard's generated form,
`MarketplaceQueryBuilder` (imported from `CreateComponentWizard/` — the same
precedent as `workflowWizardUtils` importing `fetchScopedSources` from there),
with `hideRunButton` because execution is the modal header's **Execute Node**.
The raw fallback is `WorkflowSQLQueryEditor` with `language={marketplaceQueryLanguage()}`
— the shared resolver, not a source-type special case, because which language a
provider's query is authored in is declared by its query contract
(`contracts/marketplace/query_contracts.json`). No filter binding is wired: a
workflow node's `{{alias}}` placeholders come from ancestor nodes, and inserting
one appends nothing to a marketplace query (it would break the JSON) — the author
places the token inside the parameter it belongs to. See
[`../marketplace/overview.md`](../marketplace/overview.md).

Every marketplace edit goes through `buildWorkflowMarketplaceConfigPatch`, never
`buildWorkflowQueryConfigPatch`: the latter stamps `mode: 'query'` and would flip
the node to a SQL editor on the author's first keystroke.

### Version history

The builder's version-history panel calls
`workflowService.listVersions(workspaceId, definitionId, { limit: 20 })`
(`WorkflowBuilderShell.tsx`) — 20 versions per page, with further pages
fetched via the same call's `offset` parameter ("Load more" pattern, not
infinite scroll or a single unbounded list).

## Critical paths

1. **Node addition** — footer node-picker → `WorkflowAddNodeDrawer`
   (trigger-only mode if no trigger placed yet, per `needsTrigger`) →
   node added to the React-Flow canvas.
2. **Autosave** — any graph mutation → 1.8s debounce
   (`autosaveTimeoutRef`, `WorkflowBuilderShell.tsx`) → `performAutosave`
   → content's `PUT .../authored` → engine stores the version and recompiles →
   `compilationStatus` updates from the response.
3. **Publish gate** — publish action is blocked while
   `compilationStatus === 'invalid'` (the "Fix errors to run" label);
   an already-invalid *unrelated* node elsewhere in the graph does not
   block a step-test targeting a valid subgraph — the engine gate
   (`WF_STEP_TEST_TARGET_SUBGRAPH_INVALID`) is authoritative for that
   narrower case.
4. **Version history load-more** — panel calls
   `workflowService.listVersions(..., { limit: 20 })`, then re-calls with
   `offset` for older pages.

## Configuration and operations

- No builder-specific env vars; validation limits
  (`maxInputsForKind`/`maxInputsForNode`) are duplicated by hand between
  `engine/internal/engine/validate.go` and
  `workflowNodeConfigState.ts` — see [engine-compile.md](engine-compile.md).
- The node picker's single-instance/trigger-first gating reads
  `nodeCatalog.ts` metadata client-side; there is no server round-trip
  to check whether a singleton kind is already placed.

## Failure modes and edge cases

- **Compile failure surfaced to the author** — `compilationStatus`
  flips to `'invalid'`; the builder shows a `compilationError`
  (code + message) dialog and blocks publish, but does not block
  step-testing a valid subgraph elsewhere in the same authored document.
- **Client-side fan-in/arity checks drifting from the engine's** —
  because the limit is hand-duplicated (see
  [engine-compile.md](engine-compile.md)), a builder that allows an
  edge the engine then rejects at compile time is a known failure
  mode, not a bug class that's been eliminated.
- **`WorkflowLibraryFilters.tsx`** — dead code (see "Library" above);
  don't wire new filter behavior into it expecting it to render.
- **`WorkflowComponentBrowserModal.tsx` / `WorkflowAssetBrowserModal`
  naming lag** — don't assume the file name reflects the current
  exported symbol name when searching for this component.

## Integration map

- [node-catalog.md](node-catalog.md) — node-kind metadata
  (`singleInstance`, `isTrigger`) the library/canvas/drawer read.
- [engine-compile.md](engine-compile.md) — the compile gate this page's
  autosave/publish flow depends on, including the duplicated
  `maxInputsForKind` limit.
- [transform-nodes.md](transform-nodes.md),
  [ancestor-refs.md](ancestor-refs.md) — node-kind-specific editor
  behavior this page intentionally does not cover.
- [triggers.md](triggers.md) — the trigger-first gating and
  single-instance rules this page's canvas section describes.
- [action-nodes.md](action-nodes.md) — the `confirm_live_execution`
  acknowledgement this page's node-config modal must enforce for
  side-effect kinds.
- [worker-executor.md](worker-executor.md) — "Per-node settings the worker
  actually honors": the runtime mechanics behind every Settings control, plus
  the failure/advance and readiness semantics `onError` changed.
- [source-nodes.md](source-nodes.md) — the Source-node query editor's
  schema-aware autocomplete: what it offers, where the schema comes from,
  and the silent keyword-only degradation on a failed fetch.

## Validation checklist

- UI must respect side-effect confirmation flags for kinds listed in `workflow_node_kinds.json` `side_effect_actions`.
- `nodeConfig/__tests__/NodeSettingsPanel.timeout.test.tsx` — timeout input
  bounds/clamping; re-run when touching the Settings tab.
- `__tests__/WorkflowBuilderShell.spacePanKey.test.tsx` — the Shift+Space
  regression guard; re-run before touching `panActivationKeyCode` or
  upgrading `@xyflow/react`.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
