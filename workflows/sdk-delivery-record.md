# Workflow SDK delivery record

## Audience and goal

This is a factual record of the workflow SDK initiative: what was built, why
the architecture changed, how it was validated, and which safety decisions now
bind the product. It is not a future plan and it is not a replacement for the
detailed local benchmark artefacts. For current source of truth, always read
the code and the three companion pages:
[authoring-sdk.md](authoring-sdk.md) and
[agent-authored-workflows.md](agent-authored-workflows.md).

## What changed

### Validation origin: SDK versus JSON benchmark

Before production packaging, the builder was evaluated locally against the
previous JSON-authoring surface. The benchmark was intentionally a research
scaffold, not production code. It compared one-shot and retry authoring for
both surfaces across product and flagship model legs, then assessed each result
in four layers:

1. **L1:** the real workflow compiler accepts the document;
2. **L2:** required structural facts are present in the authored graph;
3. **L3:** the document executes on the live stack;
4. **L4:** its outcome is equivalent to the requested result.

That work exposed real SDK defects, corpus/gold defects, prompt-pack leakage,
and genuine model errors rather than treating every failure as one category.
The corrected flagship SDK leg reached full functional success in its final
local measurement, with no SDK compile or execution failures. The benchmark,
its sample data, JSON comparison mode, and task-specific prompt packs remain
outside the production package by decision; only the general fixes and tests
that protect production behaviour were ported.

### 1. The SDK moved from an experiment into a product package

The builder, executor, and prompt pack now live at repository root in
`workflow_sdk/`, are imported by the agent as `workflow_sdk`, and read shared
workflow contracts through the normal contract path. Production authoring no
longer depends on benchmark harnesses, seed DDL, or a JSON-vs-SDK selector.

The public vocabulary follows current product terminology:

- `source`, not legacy datasource naming;
- `create_asset`, not legacy visual/component naming;
- `asset`, not a name-based pseudo-source;
- `slides`, not legacy story naming.

The old public aliases were intentionally not carried forward because no
production workflows depend on them.

### 2. The builder became a constrained, typed authoring language

The SDK now carries a column frame across every node and validates sources,
fields, operator/type compatibility, domains, profile ranges, output columns,
join pairs, actions, triggers, references, and graph topology at author time.
It rejects silent-stringification paths, invalid `None`/list/object values,
unusable reference positions, and control-to-row transitions that would
otherwise compile then run with no input.

Aggregate references no longer mutate a previously authored source node. They
create a separate reduction/reference so charts and filters retain their real
upstream rows. The SDK also supports stream aggregate helpers (`avg`, `max`,
`min`, `sum`, `count`) for aggregate-relative workflow logic.

### 3. Engine support was aligned with the SDK

Guided transform lowering and validation were aligned with the current
workflow node vocabulary and shared contracts. The engine/compiler path now
accepts the typed document shapes produced by the SDK across transforms,
branches, joins, ancestor references, triggers, actions, controls, agent
nodes, ML nodes, outputs, and the narrow `create_asset` contract.

The supported builder trigger family is manual, schedule, webhook, and chat
input. Action nodes include email, chat messages, and outbound API requests.
Control nodes include wait, stop-error, and no-operation. The SDK's typed
surface covers current engine capabilities rather than requiring the model to
invent undocumented nested configuration objects.

### 4. Workflow visual output was redesigned around cache, not files

The first implementation created a source/file-style artifact per visual run.
That was rejected. The shipped design creates/updates normal asset metadata and
stores the already-produced Parquet in the normal asset cache. It never creates
a File row, source, source version, Store table, or ML ingestion record for a
workflow visual.

On a cache miss, safe manual/scheduled workflows replay the minimum dependency
closure that rebuilds the asset. Webhook/chat workflows cannot replay absent
payloads and remain unavailable until their real trigger fires. Recovery never
runs external actions.

### 5. Agent authoring became live-grounded and implicit when appropriate

The agent constructs an SDK schema from live source summary/profile data rather
than a fixed benchmark schema. It resolves source placeholders only against the
sources attached and authorised for the conversation. It performs bounded
repair from concrete SDK/compiler feedback and reads exact result channels.

The planner can choose a short-lived workflow for a complex question without
the user having to ask for one. This is based on requested dependency shape,
not merely a keyword. Explicit automation requests still produce a saveable
workflow preview; implicit answer workflows return answers/assets without
unnecessary workflow product UI.

### 6. Preview workflows have a safe, understandable lifecycle

Agent-authored temporary runs are hidden, expire after 24 hours, compile/run
through the real engine/worker, and do not fire schedules or webhooks or save
workflow assets. Emails, chat messages and API calls are sent for real, and
slides and briefing steps save their output. A user can save the
reviewed proposal as a draft without regenerating it; saving never publishes or
activates it.

### 7. Workflow assets now explain their real lineage

The assistant no longer shows an unrelated saved-source SQL query for a
workflow-created visual. It records producing definition/version/run/node
provenance and presents a read-only full workflow graph in the asset inspector.
The producing asset node and its upstream lineage are highlighted. Chat stays
non-editable; users save then open the normal Workflow Builder to edit.

## Important fixes made while proving the flow

- De-leaked SDK examples and prompt packs so examples teach the API rather than
  benchmark answers.
- Corrected source/field/value validation and reduced false authoring refusals.
- Added arithmetic expressions and validated `edit_fields` values rather than
  allowing arbitrary Python object representations into generated SQL.
- Fixed ancestor-reference wiring to preserve output channels and avoid invalid
  multi-input/cyclic graphs.
- Added full trigger/action/control/agent typed APIs where the platform already
  had supported runtime node kinds.
- Removed generated “query” prose caused by treating workflow output as the
  ordinary query-generation mode.
- Fixed result selection to follow authored output channels, preventing a
  filtered request from displaying its discarded/upstream rows.
- Added warnings for degenerate split results so an all-rows-on-one-branch
  condition is visible rather than silently narrated as a successful analysis.
- Replaced workflow visual ingestion through the ML path. The cache-backed
  asset path this originally used was later withdrawn in favour of the
  Store-backed `create_asset` described in [overview.md](overview.md); what
  survives is that the ML ingestion path is no longer involved.
- Added preview provenance/version handling so a later workflow edit cannot
  silently rewrite the graph shown for an earlier chat asset.

## Product decisions that remain binding

1. Staging/current product architecture is authoritative; old prototype work
   is reference material only.
2. The SDK exposes canonical current vocabulary only; no legacy aliases.
3. Workflow `create_asset` is limited to `table`, `bar`, `line`, and `kpi`.
   Full catalog-driven asset authoring is a separate product refactor.
4. Workflow assets are independent of ML ingestion and of the file-upload
   path. They ARE Store-backed: `create_asset` writes its terminal dataset to
   the Store and mints an `agentic_flow` source for it — see
   [overview.md](overview.md). The earlier cache-backed variant recorded here
   was withdrawn.
5. Complex requests may use the workflow internally; explicit wording is not
   required.
6. Previews last 24 hours, are saveable as drafts, and never publish/activate
   themselves.
7. Production source grounding is live summary/profile data, never benchmark
   data.
8. Production SDK work excludes JSON comparison mode, benchmarks, sample data,
   and benchmark prompt packs.
9. Source names resolve through `$SRC:` only from the current authorized chat
   context; saved assets require exact IDs.
10. Existing saved assets begin independent workflow branches; they are not
    transforms of a preceding handle.

## What is deliberately not claimed as finished

- `create_asset` still defaults omitted `chart` to `table`. The agreed next
  hardening is explicit critical chart/config selection, with the model given
  the valid choices rather than a silent fallback.
- The workflow asset surface is intentionally not the entire Llumen asset
  catalog. Map layers require their own correct configuration/modeling work.
- The child Python executor is defense in depth, not a full hostile-code
  sandbox.
- Cache recovery cannot reconstruct webhook or chat payloads.
- A run that compiles and succeeds can still reveal a questionable analytic
  choice; source statistics and run warnings reduce this risk but do not turn
  the product into a semantic proof system.

## How to validate the delivered flow

1. Run `make test-sdk` for builder, pack, executor, and regression coverage.
2. Run the engine/worker/runner/content suites for a cross-service change.
3. Run agent grounding/routing/authoring tests after a prompt or helper change.
4. Run frontend tests/build after preview/asset inspector changes.
5. Manually verify both paths on a real attached source:
   - ask a dependent analysis without saying “workflow” and ensure it returns
     an answer without a workflow card;
   - ask for an explicit automation, save the preview, open the draft, publish
     only after review, and verify a real scheduled/triggered run is required
     for actions.

## Integration map

- [authoring-sdk.md](authoring-sdk.md)
- [agent-authored-workflows.md](agent-authored-workflows.md)
- [overview.md](overview.md)
