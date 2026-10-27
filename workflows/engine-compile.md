---
topic: workflows
services: [content, engine, frontend, worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Engine compile

## Audience and goal

Compilation turns a **workflow version** authored graph into executable plans and artifacts. A Flow save, restore or create compiles inside the engine's version route; assistant proposals compile through the separate compile route.

## Read first (ordered)

1. `engine/internal/service/createversion.go` — the version route (`POST /internal/v1/workflow-definitions/{id}/versions`, called by content), which compiles after it commits.
2. `engine/internal/httpapi` — HTTP handlers for `/internal/v1/workflow-versions/{id}/compile`, called by content's `engine.Client.Compile` for assistant proposals (prepare and save).
3. `engine/internal/service` — compile pipeline implementation (search `Compile` symbols).

## How it works

Both routes run the compile pipeline (`engine/internal/service`, `Compile*`
symbols) — authored-graph validation, node-kind classification via the
`contracts/workflow_node_kinds.json`-backed helpers in
`engine/internal/engine/nodekinds.go`, arity/fan-in checks, per-step
policy (timeout) computation, ancestor-ref validation, and output-channel
assignment — and persists the result as a `CompiledPlan` the worker and
sweeper consume at run time. The subsections below cover the
non-obvious parts of that output shape and its validation rules; see
[node-catalog.md](node-catalog.md) for the node-kind catalog the
classification step draws on.

## Critical paths

1. **Save** — content `PUT .../flow-definitions/{id}/authored` → engine version route → compile after commit, with optional trace headers (`X-Trace-Id`, `X-Correlation-Id`). The response reports the persisted `compilation_status`.
2. **Publish and materialise** — content's publish requires a `valid`
   compile, then calls the engine's `materialize-triggers` route, which
   writes the firing bindings for the compiled plan's trigger nodes — see
   [engine-scheduler.md](engine-scheduler.md), [webhooks.md](webhooks.md).

## Compile outputs used by the worker

`CompiledPlan` carries two structures the worker relies on beyond the
per-step lease payload:

- `AncestorIndex` — `map[stepNodeId][]stepNodeId` produced by
  `subgraph.BuildAncestorStepIndex` (memoised predecessor closure, same
  ancestor set as repeated `AncestorsOf` calls). Used by
  `worker/internal/worker/ancestor_context.go` to build the markdown
  narrative for agent/output nodes.
- `CompiledInput.IsAncestorRef` + `FieldPath` — synthetic inputs emitted
  for each `config.ancestor_refs[]` entry. These are **exempt** from
  `maxInputsForKind` so a node's wired arity is unchanged by
  references. See [ancestor-refs.md](ancestor-refs.md).

## Input arity and fan-in

`maxInputsForKind` (`engine/internal/engine/validate.go`) caps the number of
distinct non-trigger inbound edges per node, raising
`WF_COMPILE_MAX_INPUTS_EXCEEDED: <node> (max <n>, got <count>)` when
exceeded. There is a **trigger fan-in exception**: `inboundNonTriggerCount`
only counts edges from non-trigger nodes, so any node whose inbound edges are
*all* from trigger nodes (i.e. `inboundNonTriggerCount[nodeID] == 0`) skips
the check entirely — only `merge` nodes are exempt from `maxInputsForKind`
outright regardless of source. The frontend mirrors this policy client-side
in `frontend/src/features/workflows/graph/connectionPolicy.ts`
(`isFanInAllowed`), and the node's advertised max-input count is computed
separately in `frontend/src/components/pages/workflows/nodeConfig/workflowNodeConfigState.ts`
(`maxInputsForNode`) — **the same limit is duplicated in Go and TypeScript,
not contract-driven**, so a future change to `maxInputsForKind` must be
mirrored by hand in `workflowNodeConfigState.ts` or the builder will allow
edges the engine then rejects at compile time.

## Per-step timeout policy

`buildPolicy` (`engine/internal/engine/compile.go`) reads an authored
node's timeout into the compiled step policy, clamped to
`maxCompiledTimeoutSeconds = 24*60*60` (24 hours): a timeout that is `nil`,
`<= 0`, or `> 24h` is silently **dropped** from the compiled policy (not
clamped to the boundary — the key is simply absent, so the worker falls back
to its own default). The worker reads the compiled value in
`computeStepTimeoutAt` (`worker/internal/worker/executor.go`) to stamp
`workflow_step_run.timeout_at` at transition-to-running. **There is
currently no timeout input in the builder's node settings UI**
(`frontend/src/components/pages/workflows/nodeConfig/NodeSettingsPanel.tsx`)
— authors cannot set a per-node timeout through the UI today even though the
engine/worker contract fully supports one; treat this as a known gap, not a
UI you can point users at.

## Canonical output channel keys

Compiled step outputs use a small fixed vocabulary of channel keys — no
generic `"error"` channel exists anywhere in the compiler. Seen in
`engine/internal/engine/compile.go`: `"default"` (most kinds), `"true"`/`"false"`
(`if_else`), `"kept"`/`"discarded"` (`filter`), dynamic per-case ids for
`switch_cases`/classification kinds, and the reserved fallback
`"_unclassified"` channel (always exposed alongside a classifier's declared
cases so the worker has somewhere to route an unmatched row/document).

## Configuration and operations

- `maxCompiledTimeoutSeconds` = 24h — the only compile-time-enforced
  timeout ceiling; there is no env var for it (see "Per-step timeout
  policy" above).
- Node-kind classification (`triggers`/`executable_triggers`/
  `side_effect_actions`/`non_executable`/`dataflow` buckets) is entirely
  contract-driven from `contracts/workflow_node_kinds.json` — see
  `CLAUDE.md` "Synced contracts" and [triggers.md](triggers.md).
- `maxInputsForKind`'s per-kind limits are duplicated by hand in the
  frontend (`workflowNodeConfigState.ts`) rather than contract-driven —
  see "Input arity and fan-in" above; there is no single source of
  truth for this particular limit today.

## Failure modes and edge cases

- **EngineRequestError** — Non-2xx responses parsed for `error`/`detail`
  JSON fields; surface to UI as structured failures.
- **`WF_COMPILE_MAX_INPUTS_EXCEEDED`** — a node's non-trigger inbound
  edge count exceeds `maxInputsForKind`, subject to the trigger fan-in
  exception described above.
- **`WF_COMPILE_INVALID_ANCESTOR_REF`** — a `config.ancestor_refs[]`
  entry points at a node that is not a transitive ancestor of its
  owner. Raised by `ValidateAncestorRefsInAuthored` inside
  `ValidateAuthored`.
- **`WF_COMPILE_INVALID_ANCESTOR_ALIAS`** — alias does not match
  `[A-Za-z_][A-Za-z0-9_]{0,63}`.
- **`WF_COMPILE_DUPLICATE_ANCESTOR_ALIAS`** / **`WF_COMPILE_DUPLICATE_ANCESTOR_REF_ID`**
  — duplicate `alias` or `ref_id` within the same node's `ancestor_refs`.
- Nodes whose `config` is not valid JSON are skipped by the
  ancestor-ref validator so the node-kind specific validator can emit
  the precise `WF_COMPILE_COMPONENT_CONFIG` error instead.

## Integration map

- [node-catalog.md](node-catalog.md) — the node-kind catalog the
  compiler classifies against.
- [triggers.md](triggers.md) — the trigger fan-in exception and
  contract-driven classification this page's "Input arity and fan-in"
  section describes.
- [ancestor-refs.md](ancestor-refs.md) — the `ancestor_refs[]`
  validation rules and the `WF_COMPILE_INVALID_ANCESTOR_*` error family.
- [worker-executor.md](worker-executor.md) — `computeStepTimeoutAt`,
  the sole consumer of the compiled per-step timeout policy.
- [engine-scheduler.md](engine-scheduler.md) — materialization, the
  step that follows a successful compile on publish.
- [builder-ui.md](builder-ui.md) — the frontend's independently
  duplicated `maxInputsForKind`/timeout-UI gaps this page calls out.

## Validation checklist

- Compare engine OpenAPI snippet with the callers' URL strings
  (`content/internal/engine/client.go`)
  after route refactors.
- `engine/internal/engine/ancestor_refs_test.go` covers the happy path
  plus rejection of non-ancestor and malformed-config preemption.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
