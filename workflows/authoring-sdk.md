# Workflow authoring SDK

## Audience and goal

This page is the technical reference for **`workflow_sdk/`**, the Python
builder used when Llumen's agent authors a workflow. It explains the complete
path from live source metadata to an authored workflow document, including the
model prompt, validation, source-id resolution, and the boundary between the
SDK and the workflow engine.

It does not describe the workflow builder UI. The UI and the SDK author the
same document model, but they are separate authoring surfaces. Read
[document-model.md](document-model.md) for that shared JSON format and
[agent-authored-workflows.md](agent-authored-workflows.md) for the agent path.

## Read first

1. [overview.md](overview.md) — workflow ownership and the runtime path.
2. [document-model.md](document-model.md) — nodes, edges, configurations, and
   versions.
3. `workflow_sdk/llumen_wf/__init__.py` — supported names exposed to an
   authoring program.
4. `workflow_sdk/llumen_wf/workflow.py` — `Workflow`, graph construction,
   source/asset inputs, joins, references, and stream aggregates.
5. `workflow_sdk/llumen_wf/nodes.py` — row transforms and `create_asset`.
6. `workflow_sdk/execute.py` — program validation and child-process protocol.
7. `workflow_sdk/pack/sdk_pack.md` — generated, model-facing API reference and
   runnable examples. This is the exact pack the authoring model sees.

## What the SDK is

The SDK is a **typed, constrained authoring language**, not a second workflow
runtime. A short Python program creates an AuthoredDoc JSON object; the normal
engine compiles it and the normal worker executes it. That gives agent-authored
and UI-authored workflows the same node kinds, compiler, scheduler, worker
adapters, storage model, permissions, and run history.

```
live source summaries
        │
        ▼
typed Schema  ──►  inspect_workflow_sources  ─┐
        │            (index of every table,   │  the authoring agent reads
        │             then per-table detail)   │  what it needs, in its own
        │                                      │  tool loop
        ▼                                      │
authoring agent writes restricted Python  ◄────┘
        │
        ▼
present_workflow_draft → workflow_sdk.execute
        │        ▲                      │
        │        └──── exact error ─────┘  (repair in the same context)
        ▼
AuthoredDoc JSON with $SRC:<source-name> markers
        │
        ▼
markers resolved against this chat's allowed sources
        │
        ▼
registered native proposal revision → review card
        │
        ▼
card's Run → content prepare + run route → engine compile → worker run
```

Authoring is a tool loop, not a single generation. The agent that writes the
program is the subagent itself (`workflow_builder` / `workflow_answerer`), so
discovery, authoring and validation share one context and a repair keeps
everything already learned. Running is the review card's action, not the
author's. See [agent-authored-workflows.md](agent-authored-workflows.md) for
the tools and the Run/collect path.

## Request conformance for analytical workflows

A workflow that answers an analysis of source data carries a contract. The
author writes only the program; it does not write the request or the review
prose. After the program is built, `derive_request` in
`agent/src/agents/infusion/logic/tool_helpers/_workflow_derived_request.py`
reads the `answerFacts` the SDK recorded (below) and states what the program
does as a `WorkflowRequestDraft`. Each of its rules is the reverse of a
comparison in `_workflow_request_conformance.py` and reuses that module's
readers. Agent code resolves the draft against the permission-filtered,
relation-scoped `Grounding`, checks the resolved request back against the same
document, and binds the hash-checked `ResolvedWorkflowRequest` to the
registered revision as its execution contract. A program that declares no
answer is refused as `WF_DRAFT_ANSWER_UNDECLARED`, to the author and never to
the user. A program the rules cannot state, or whose derived request the round
trip does not accept, registers instead with the answers its document stamps
as the contract (a `FactsExecutionContract`), unless the resolver found units
that cannot be combined or a window outside the data; see
[agent-authored-workflows.md](agent-authored-workflows.md#what-a-draft-is-checked-against-before-it-is-registered).

The SDK builds the normal AuthoredDoc, and its trusted
`answerFacts` producer carries ordered read bindings, operation facts,
predicate/value lineage, an unambiguous `measureProjection`, and an `answerOf`
on every artifact that delivers a declared answer. A document with one unnamed
answer is stamped `llumen_wf/5`; one declaring several named answers is
stamped `llumen_wf/6` (`NAMED_ANSWERS_PRODUCER`), each `answerOf` carrying its
`name`. Both are in `READABLE_PRODUCERS` in
`workflow_sdk/llumen_wf/answer_facts.py`.
The Agent's `_workflow_request_conformance.compare_request_to_document` checks
the whole document once — trigger, actions, agent steps, and that every node
reaches a declared end — then compares each answer with its own analysis
(`_compare_answer`), and finally the flow between analyses: which answer each
agent step reads, merges, and deliveries (`_flow_semantics`). A period
comparison is checked on its own answer's lineage
(`_comparison_document_conformance`), so another analysis in the same document
is not counted against it. Extra branches, reads, columns, unknown operations,
raw nodes and changed semantics are refused before the proposal is registered,
and checked again before a run starts. A delivering terminal whose facts are
missing or stale cannot be read, so its program has no request and is refused.

An analysis whose only deliverables are actions states no answer and no
`output`: an unconditional `action` (with any `filters`), or decisions whose
every arm sends an `action` or `stops` (`only_actions_follow` and
`delivers_only_actions` in `workflow_request_contract.py`). The SDK still reads
an action carrying a measured row as an answer, so such a program declares
`wf.answers(...)` and marks its first action `answers=True`. The conformance
gate accepts the designated terminal when it is one of the arms' actions and
compares every arm's end in `_decision_semantics`. With more than one thing
delivered, an action is paired with the analysis it sends from, not by
`answers=`; declared answers and marked terminals that do not pair one to one
are refused with the reason `pairing`.

An action's `ancestor_refs` are numbered by the SDK with one counter per
workflow, so the second action's first reference is `r2`. Conformance accepts
any id the SDK mints (`is_sdk_ref_id` in `_workflow_request_conformance.py`) and
compares what the reference reads: its token, producer, channel and column.

A request that pairs a period with a row-preserving detector (`baseline`,
`seasonal_baseline`) judges the period rather than reading it
(`detector_judged_window` in `workflow_request_contract.py`). The program reads
from `history_start` — the period's start moved back by the detector's history,
or `season_length × cycles` periods for a seasonal baseline — runs the detector
over all of it, and keeps the period with a filter after the detector.
Conformance accepts that window filter after the detector
(`_window_follows_detector`), and a Fusion read must start at or before
`history_start` and end where the period ends. The SDK checks the same order at
`build()` (`check_history_kept` in `workflow_sdk/llumen_wf/rules.py`): a lower
bound on the detector's time column above the detector must start at or before
the window kept after it, moved back by the history, or the build is refused
with `HISTORY_CUT_BEFORE_DETECTOR`.

A baseline's `<value>_unusual` verdict keeps unusual readings either way. To
keep one side, filter the detector's signed score instead:
`("<value>_deviation", ">=", 3)` for the unusually high readings and
`("<value>_deviation", "<=", -3)` for the unusually low ones. These are the only
thresholds accepted on the score (`DETECTOR_SIDE_FILTERS` and
`check_detector_verdict_filter` in
`agent/src/agents/shared/workflow_detector_rules.py`). When the request names
one side (`anomaly_direction`) and the program keeps the two-sided verdict, the
draft is refused with `WF_DRAFT_DIRECTION_MISMATCH`; see
[agent-authored-workflows.md](agent-authored-workflows.md#anomalies-and-rankings).

A request of several analyses is read through `request_parts` in
`agent/src/agents/shared/workflow_request_contract.py`. The derived request gets
one part per analysis the program's delivering terminals belong to (`_partition`
in `_workflow_derived_request.py`), so a program with several parts, each with
its own answer or its own email, is one request.

A ranking is read from the program: a `sort` keeps every row, and a `top_n`
carries its `n` as the output's `limit`. Nothing adds a row cap the program
does not write. A ranking placed before a detector is refused, because a
detector judges each period against the ones before it
(`_refuse_ordering_before_detector`).

The same checker returns an immutable, total mapping from each structural
output role to its actual delivered column name. When a run of the reviewed
workflow has finished and its answers are collected, `compare_answer_to_result`
checks each answer's own channel (found by its name in the run's document) and
schema against that mapping before any render command or answer can escape.
A result is never refused for its size. Empty is an honest, separate result; a
mismatched result, or one computed from a read that stopped at the runner's row
ceiling (`WF_REQUEST_RESULT_INCOMPLETE`), is replaced by a code-owned response
(`result_gate_decision`).

The SDK deliberately checks facts the compiler cannot know at compile time:
source and field names, field types, value vocabularies, observed ranges,
branch/output wiring, required action fields, invalid trigger settings, and
unsupported node/config combinations. The engine remains the final authority
for document validity and execution.

## Package layout and ownership

| Path | Owns |
| --- | --- |
| `workflow_sdk/__init__.py` | Public package identity. The agent imports `workflow_sdk`; do not introduce a second `llumen_wf` import identity. |
| `workflow_sdk/llumen_wf/` | Typed builder, graph construction, validation, and document emission. |
| `workflow_sdk/llumen_wf/sqlnames.py` | Identifier quoting for emitted SQL, per engine. |
| `workflow_sdk/execute.py` | Restricted program extraction, AST validation, child execution, framed stdout protocol, and timeout. |
| `workflow_sdk/pack/gen_pack.py` | Generates the SDK reference carried by the authoring subagent's system prompt. |
| `workflow_sdk/pack/sdk_pack.md` | Generated model-facing API reference. Do not hand-edit its generated region. |
| `workflow_sdk/tests/` | Builder, executor, pack, contract, and regression coverage. |
| `contracts/guided_vocabulary.json` | Shared transform/operator vocabulary read by the SDK and compiler. |
| `contracts/data_reference.json` | Shared ancestor-reference usages, aliases, and output-channel vocabulary. |

The agent image copies `workflow_sdk/` from the repository root and sets the
same `/app` import root used by `contracts/`. `LLUMEN_CONTRACTS_DIR` points the
SDK at the image's shared contracts. See `agent/Dockerfile`, repo-root
`.dockerignore`, and `workflow_sdk/llumen_wf/contracts.py`.

## Authoring program contract

The program receives these names already defined:

```python
Workflow, Schema, Col, Manual, Schedule, Webhook, ChatInput, schema
```

It must create a workflow and finish with `wf.build()`. It must not import
anything, access files or environment variables, make network calls, define
functions/classes, use `while`, use Python `if`, or print. Row branching belongs
in workflow nodes, not Python control flow.

Allowed Python is intentionally small: literals, assignments, calls,
subscripts, f-strings, column arithmetic, and bounded iteration over literal or
named immutable-sized sequences. The AST gate is implemented in
`workflow_sdk/execute.py`; its error messages state the supported replacement
instead of merely naming rejected syntax.

### Security boundary

`execute.py` runs the program in a child interpreter with an isolated Python
mode, a stripped environment and builtins, an AST allowlist, a framed stdout
protocol, and a timeout. This prevents ordinary accidental escapes and keeps
model output deterministic. It is **not** a kernel, filesystem, or network
sandbox: the child still runs as the agent service user. A hostile-code threat
model requires a container, micro-VM, or equivalent isolation around the child
process.

## Grounded schema and source identity

`agent/src/agents/infusion/logic/tool_helpers/_workflow_schema.py`
builds a `Schema` from each attached, access-filtered source's normal summary
layers. It does not use benchmark DDL or a static sample schema.

For a relational source it carries:

- every authorable table and its physical relation;
- columns mapped into the SDK's operator types: `string`, `number`, `boolean`,
  `date`, `datetime`, and `time`;
- bounded categorical values and samples where they are useful for validation;
- profiler statistics such as min/max/mean/quantiles, null fraction, estimated
  distinct values, and temporal granularity;
- profile completeness, so a capped/sampled value list is never treated as a
  complete domain.

It also carries the source's **engine** and keeps the database schema and table
name separate, because the SDK emits SQL for that engine (see
[Emitted SQL and the dialect boundary](#emitted-sql-and-the-dialect-boundary)).

For a **Fusion** source the catalog is realms → datasets → columns instead, so
`build_grounding` reads the `datasets` layer rather than `tables` and names each
dataset `<source>.<dataset>` (qualified by realm when one dataset name appears in
two). Each entry carries `realm`, `dataset`, `time_series` and `data_window` —
the facts a ticket cannot be written without — plus the raw Arrow type per
column beside the SDK type, because the Flight server compares by Arrow kernel
and the SDK vocabulary cannot express that distinction. Fusion columns are never
profiled (the ingestion path enriches only the relational family), so any value
vocabulary comes from the sample rows.

`_sdk_type` therefore understands **Arrow spellings** as well as SQL ones.
Reading `int32`, `int64`, `float32`, `float64`, `uint32` and `date32` as text
would mistype hundreds of columns on a real Fusion source, and that is a silent
wrong answer rather than a failure: a comparison the builder authorises as
numeric would run lexicographically, where `"9"` is greater than `"100"`.

The authoring name can be a source name for a one-table source or a qualified
`source.table` name for a multi-table source. `Workflow.source()` emits
`$SRC:<source-name>` rather than inventing a UUID. After the program succeeds,
the agent resolves that marker only from the sources attached to the current
chat. An unknown, missing, or marker-in-the-wrong-config-field is a hard error
before engine compilation.

Existing saved assets are different: `Workflow.asset()` accepts only an opaque
saved-asset alias supplied by the code-owned inspected authoring schema. The
model must not provide a UUID or display name, and it cannot declare the
asset's output columns. The Agent resolves that alias to its resource identity
and revalidates it against the current user's visible assets before save. There
is intentionally no `$ASSET:` name resolution.

## Public builder surface

The generated pack is the exhaustive call-level reference. This section is the
conceptual map a maintainer should use when changing it.

### Workflow roots and graph operations

| API | Meaning |
| --- | --- |
| `Workflow(name, schema, trigger=...)` | Creates one workflow with exactly one trigger; default is `Manual()`. |
| `wf.source(name, select=...)` | Starts a row-bearing branch from a grounded SQL source/table. Refuses a Fusion dataset. |
| `wf.fusion_source(name, columns=, window=, where=, group_by=, aggs=, order_by=, top=, zone=)` | Starts a branch from a Fusion dataset, emitting a JSON ticket. See [Fusion sources](#fusion-sources-a-second-query-language). |
| `wf.asset(asset_alias)` | Starts an independent branch from an existing saved asset using an opaque alias from inspected authoring schema; UUIDs, display names, and model-declared columns are refused. |
| `wf.merge(handles)` | Append-merges compatible streams. |
| `wf.join(left, right, on, how, output="both", suffixes=None)` | Combines two streams by one or more compatible key pairs. `how` is required; `inner` and `full` are supported. |
| `wf.ref(...)` | Declares an ancestor value/reference used by a later condition, text template, membership test, or linked lookup. |
| `wf.avg/max/min/sum/count(handle, ...)` | Mints a stream aggregate reference without mutating the source handle. |
| `wf.node_raw(...)` | Narrow escape hatch for a known engine kind/config; it cannot be used to bypass typed rules for supported kinds. |
| `wf.build()` | Wires root sources and reference dependencies, then returns an AuthoredDoc dictionary. |

Every row-bearing call returns a `NodeHandle`. The handle carries the current
column frame, value domains, and profiler statistics. A later call therefore
fails immediately if it names a missing column, uses the wrong type of
operator, or tries to read rows after a control step that produces no row
artifact.

#### `wf.join` — `how` is required, and suffixes rename whole sides

`Workflow.join` (`workflow_sdk/llumen_wf/workflow.py`) takes `how` with **no
default**, deliberately. Every other merge setting fails visibly when it is
wrong — pick the wrong `output` and the columns you wanted are simply absent
and the next call errors on the missing name. `how="inner"` is the one setting
that produces a complete, well-formed, plausible artifact with rows silently
deleted, and the deleted rows are systematically the interesting ones. Nothing
downstream can report the loss: the worker records only `row_count` on
`workflow_step_output`, never a matched/unmatched count. The engine's merge
vocabulary is two-valued (`keep_matches` → `INNER JOIN`, `keep_everything` →
`FULL OUTER JOIN`; no LEFT/RIGHT/SEMI/ANTI), so an author's SQL habit of
reaching for `LEFT JOIN` as the safe enrichment default has nowhere to land —
a default `how` would select the *most* lossy option while the author believed
they held the least lossy one. Requiring the argument does not make an inner
join safe; it makes the choice a visible token at the call site that a diff, a
reviewer, or a re-read can question.

**Leave `suffixes` out.** When `output="both"` and the two inputs share a name,
the RIGHT copy alone is renamed — to `<column>_right` — and every name the left
input carried survives untouched (`_default_join_suffix`,
`workflow_sdk/llumen_wf/workflow.py`). The asymmetry is the point: suffixing
both sides would break chained joins, because a program that joins A to B and
then joins the result to C would find its join key renamed out from under the
second join. Chained joins are ordinary and authors build them left to right, so
every left-hand name has to survive.

Naming the pair yourself renames **every** column of the left input to
`<column>_a` and every column of the right to `<column>_b` — the join keys
included. Suffix-on-collision is not expressible, because the engine has no
compile-time column knowledge, so an explicit rename is all-or-nothing per side
and downstream nodes must reference the suffixed names (`on=("id", "id")` yields
`id_a` and `id_b`). Each suffix is letters, digits and underscores, at most 32
characters; both must be present, they must differ, and neither may be a
string-suffix of the other. Passing `suffixes` with `output="left"` or
`output="right"` raises: those forms project one side only and cannot collide,
and naming a pair when the inputs share no column raises for the same reason.

An inner join on equal keys therefore leaves one key under its own name and a
second copy under `<key>_right`. They hold the same value — that is what the
join matched on — so group by, declare and display only the first. Carrying both
makes one thing read as two, and repairing it afterwards with a rename node adds
a node the answer does not need.

The pack is generated from the `Workflow.join` docstring, so the docstring and
this section must describe the same default. If they disagree, the model is
taught a form the code does not use and can spend its whole authoring budget on
the consequences.

A `how="full"` join leaves the unmatched side blank, and a blank fails every
comparison — so `Col("late") - Col("early")` is blank rather than growth, and a
later `filter` drops that row without saying so. Read the gap as a number with
`Col("late").fill(0)` (`workflow_sdk/llumen_wf/conditions.py`).

### Transforms and branching

| Handle API | Output |
| --- | --- |
| `filter(clauses, logical="AND")` | `(kept, discarded)` handles. |
| `if_else(clauses, logical="AND")` | `(true_handle, false_handle)` handles. |
| `switch(cases, else_case=False)` | Mapping of named branch handles. |
| `aggregate(group_by, aggs)` | One rolled-up handle. |
| `edit_fields(rename=..., set=..., drop=...)` | One edited handle with updated frame. |

Conditions are typed tuples such as `("amount", ">=", 500)`. They may use
literals, `Col("other_column")`, lists for membership, or a compatible
`wf.ref()`. The SDK rejects values such as a raw `NodeHandle`, `None` where a
literal is required, or a reference in an operator position the engine cannot
honour. Existence checks use the one spelling
`("email", "exists", None)` / `("email", "not_exists", None)`.

Aggregate-relative comparisons use `wf.avg(...)`, `wf.max(...)`, and related
helpers. They mint a separate reduction node/reference rather than rewriting
the rows being charted or filtered. This is critical: a comparison to a
network-wide average must preserve the original row stream.

### Assets and outputs

| Handle API | Meaning |
| --- | --- |
| `create_asset(name, chart=..., mapping=..., rows=..., answers=...)` | Terminal visual asset of any authorable asset-catalog type, chart or map layer. |
| `dataset_output(name, columns=...)` | Terminal persisted dataflow output. |

`create_asset` reads the asset catalog in `contracts/asset/` at call time
(`workflow_sdk/llumen_wf/assets.py`), so a type added to the catalog is
authorable without an SDK change. A type is authorable when its engine chart
type is in `engine_chart_types` in `contracts/asset/index.json` and it is not
listed in `NOT_CREATE_ASSET` (grouped cards, and the map layers the engine does
not produce). `mapping` binds each catalog slot to a column; required slots
must be mapped, and a slot the catalog marks `numeric` needs a number column.
`x`/`y` remain shorthand for a plain `bar` or `line`.

What the node stores follows the saved-asset configuration (`chart_config`,
`map_config`): a plain `bar` or `line` keeps its axes in `xColumn`/`yColumn`;
every other chart, including the bar and line variants (`horizontal_bar`,
`progress_bar`, `area_chart`), keeps its slots in `dataMapping`; a chart whose
chart type alone would name a sibling also stores its `chartSubtype`
(`horizontal_bar` is `bar` + `horizontal`); a map layer stores `map:<subtype>`
with its slots in `mapMapping`. `chart` defaults to `table` when omitted.

A map layer whose positions are not longitude/latitude passes
`coordinate_system="EPSG:3997"` (any code in `contracts/coordinate_systems.json`).
The node stores only the code, as `mapCoordinateSystem`; the default (WGS84)
stores nothing, and a chart or an unknown code is refused. Content derives the
declared columns from the layer's mapping, so a `{"lng", "lat"}` pair is then
the easting and the northing. See [../map/coordinate-systems.md](../map/coordinate-systems.md).

### Named answers

`wf.answers(about, measure, ..., name=None)` declares what the answer is. A
workflow with one answer calls it once, unnamed, and passes `answers=True` on
the one artifact that delivers it. A workflow with several answers calls it
once per answer with a `name=`, and each delivering artifact passes
`answers="<name>"`; mixing named and unnamed declarations, or delivering one
declaration twice, is refused. Each named answer is checked on its own against
the artifact that carries it.

### Ranking

`sort(by, direction)` orders rows and keeps all of them; `top_n(by, n,
direction)` orders and keeps at most `n`. `direction` is `"highest"`,
`"lowest"` or `"largest"`, which orders by distance from zero (a detector's
`<value>_deviation`: spikes and dips together) and needs a number column. A
ranking of a detector's result is declared in the request as `rank` on that
detector and written straight after the detector and its verdict filter.

### Triggers

| Trigger value | Starts when |
| --- | --- |
| `Manual()` | A user runs the workflow. |
| `Schedule(every, unit, ...)` | A validated minutes/hours/days/weeks/months schedule. |
| `Webhook(...)` | An inbound HTTP webhook with validated method/auth configuration. |
| `ChatInput()` | A workflow initiated by a chat message. |

The builder owns trigger creation and root wiring. A program must never draw
edges into a trigger. Schedule configuration is validated against the selected
unit and timezone at author time so unused fields cannot silently alter the
schedule.

### Actions and control

| Handle API | Meaning |
| --- | --- |
| `send_email(...)` | Sends a validated email action. |
| `send_api_request(...)` | Sends an HTTP request with author-time URL/header/body validation and worker egress safeguards. |
| `send_chat_message(...)` | Posts a chat message action. |
| `wait(duration, unit)` | Holds a branch for a bounded delay. |
| `stop_error(message)` | Stops the downstream branch with an explicit failure. |
| `no_operation(label)` | A control/join point that emits no rows. |

Control handles cannot be fed into row transforms or visual creation because
the worker intentionally produces a control signal, not a tabular artifact.
Actions may follow them because they do not consume the incoming row frame.

### Agent, ML, and output nodes

| Handle API | Engine node |
| --- | --- |
| `agent(instructions, text_refs=...)` | `general_agent` |
| `insight(instructions, fields, text_refs=...)` | `insight_generator_agent` |
| `classify(instructions, categories, text_refs=...)` | `data_classification_agent`, returning category handles |
| `slides(...)`, `briefing(...)`, `dashboard(...)` | Output-agent nodes |
| `ml_model(model_alias, ...)` | SDK surface for registered-model scoring; currently withheld from the Agent pack pending an exact runtime output contract |
| `ml_predict(...)` | Compiled-only prediction surface; unavailable to the Agent |

Every AI step returns a handle, so a program can continue past it: append two
AI outputs, or pass one step's text into another step's instructions. The
handle names only the keys the Worker is guaranteed to write
(`worker/internal/worker/agent_runtime.go`): `kind` and `text` for the general,
dashboard, slides and briefing agents; `answer` for `data_analyst`; exactly the
requested `fields` for `insight`. `workflow_sdk/tests/test_ai_handles.py` pins
each frame and compiles every shape.

Text references are explicit aliases for values from earlier nodes. The alias
is declared in configuration and expanded by the worker at execution time; the
SDK wires the necessary ancestor dependency edges.

### Exact SDK-draft approval route

`present_workflow_draft` derives a code-owned approval manifest from the exact
submitted program and canonical document, records both submitted and executable
program hashes, and registers a native proposal revision holding those bytes.
The card's Run and Save act on that registered revision, identified by its
review hash; neither takes program text, so nothing can re-author what was
reviewed. See [agent-authored-workflows.md](agent-authored-workflows.md).

Before registering, `present_sdk_draft` also compares the document with the
schedule and email the user's words stated (`automation_contradiction` in
`_workflow_request_requirements.py`). The SDK's `schedule_trigger` and
`send_email` are the only nodes that satisfy them; a missing time, timezone or
address is asked for, never filled with a default. An action's subject, body
or text is exactly what the program wrote: the request is derived from the
program, so nothing rewrites it before the build.

Request conformance accepts a two-way decision written as its exact
opposite with the arms swapped (`rest, over = t.if_else([("n", "<=", 3000)])`
for "over 3000"), but only when the tested value is a count. The false arm of
an `if_else` takes every row whose condition is not true, so for a value that
can be null the two spellings route that null to different arms; those stay
refused, with a hint to write the stated condition directly.

A registered draft is one candidate that can be **run temporarily** or
**saved inactive**, in either order, without authoring again. Both actions load
the registered canonical bytes by proposal identity and review digest; neither
accepts a program. Run needs the candidate's immutable execution contract (the
`ResolvedWorkflowRequest` derived from the program, wrapped as
`CandidateExecutionContract` in
`agent/src/agents/shared/workflow_candidate_contract.py`, or, when no request
could be derived, the stamped answers as a `FactsExecutionContract` in the same
module), because that is what the delivered result is checked against. A revision registered without one is
saveable and reports Run as unavailable (`execution_contract_missing`). The
product behaviour, recovery rules and current limits are in
[agent-authored-workflows.md](agent-authored-workflows.md#run-temporarily-and-save-inactive).

Resource methods accept only aliases from the code-owned authoring schema.
`wf.asset("asset_001")` gets its UUID and output columns from the saved-asset
registry; a UUID or invented columns are refused. The SDK groundwork for
`rows.ml_model("model_001", ...)` uses a separate registered-model registry,
validates declared feature names/types and preserves ordered feature bindings,
target, prediction type and output column in the document. That method remains
withheld from the Agent pack: the current Engine/Worker/content path does not
runtime-bind or verify the reviewed target, prediction type and prediction
column, so `WF_CAP_AGENT_ML_MODEL_OUTPUT_CONTRACT_UNAVAILABLE` stays closed.
The saved-asset runtime still carries
`WF_CAP_ASSET_READ_AUTHORIZATION_WIDENED_V1`; this route does not claim
caller-equivalent Worker authorization.

Two variants intentionally stay outside the typed request vocabulary:

- `wf.sticky_note(...)` appends a canvas annotation with exact position, colour
  and sizing bytes. It has no handle, ports, edges or runtime step.
- `wf.pair_by_position(left, right, left_order=..., right_order=...)` requires
  one to four explicit order terms on each side. The Worker refuses duplicate
  ordered identities instead of pairing nondeterministically; right-side name
  collisions are renamed deterministically and bound into approval.

`create_asset(...)` always emits an explicit update mode. Its default is
`update_existing`: first run creates the durable asset and later runs refresh
the same workflow-node-owned asset. `always_create` is an explicit opt-in only.

The custom SQL steps (`filter_sql`, `if_else_sql`, `switch_sql`,
`aggregate_sql`, `compute_sql`, `merge_sql`) take an optional keyword
`purpose=`: one plain sentence saying what the step is for. It is kept under
the node's `authoringState`, and the derived request states the step by it
(`_custom_step_purpose` in `_workflow_derived_request.py`), so the review names
the step by what it does; without one the step is named by its method. A blank
or non-string purpose is refused.

## Emitted SQL and the dialect boundary

The builder emits SQL in two places that are executed by two different engines,
and they are quoted differently on purpose (`workflow_sdk/llumen_wf/sqlnames.py`).

| Emitted by | Runs on | Quoting |
| --- | --- | --- |
| `Workflow.source()`, and the one-row reduction behind `wf.avg/max/min/sum/count` and `wf.ref(agg=...)` | the **customer's** database, via the runner | the source's own engine: `[brackets]` for SQL Server, `` `backticks` `` for MySQL/MariaDB and the Spark family, ANSI `"double quotes"` otherwise |
| `edit_fields`, scalar arithmetic, `ref.filter_sql` views | **DuckDB**, inside the worker | ANSI `"double quotes"` always |

Every identifier is quoted. Unquoted, Postgres folds `Bus` to `bus` and the run
fails with `column "bus" does not exist` on a document that compiled clean —
one real source carries 342 mixed-case columns, so this is the ordinary case. The
engine matters just as much as the quoting: ANSI double quotes are identifier
quotes on Postgres but *string literals* on MySQL and on SQL Server without
`QUOTED_IDENTIFIER`, where `MAX("quota")` silently returns the constant `'quota'`
and every comparison against it is wrong with no error. The rules mirror
`quoteIdentifier` in `runner/internal/filterdomain/dialect.go`, which is the
service that executes these queries.

A source's engine reaches the SDK through the grounded schema: the layered
summary already records it, `_summary_access.resolve_layer` returns it, and
`_workflow_schema.build_grounding` puts it in `relations[<name>]["engine"]`
alongside a separate `"schema"` and `"table"`. Keeping those two apart is
deliberate — joined into one string, a table whose *name* contains a dot cannot
be told from a schema qualifier. An unnamed engine falls back to ANSI quotes.

## Safe numeric conversion (`as_number()`)

A bare `TRY_CAST(x AS DOUBLE)` is the right thing for a scalar and quietly wrong
for anything else: `TRY_CAST` answers NULL rather than failing, so over an
array, a struct, a map, a JSON document, a UUID, a boolean or a date it succeeds
structurally and returns blank on EVERY row. Nothing raises, the step succeeds,
and the sum of a million blanks is reported as an answer.

So `Col("x").as_number()` (`workflow_sdk/llumen_wf/conditions.py`) has one
rule: the SDK refuses it when the step is built unless the column is a number
or text. Every other type, including a column whose type is unknown, is
refused before any SQL exists.

When it is allowed, the emitted value is one inline expression
(`as_number_sql` in `workflow_sdk/llumen_wf/cast_facts.py`):

```sql
CASE WHEN isfinite(TRY_CAST(<source> AS DOUBLE)) THEN TRY_CAST(<source> AS DOUBLE) END
```

A value that does not convert, or that converts to `NaN` or infinity, is blank,
so it cannot poison a later sum, average or ranking. There is no run-time guard
behind it: the Engine and Worker treat the expression as ordinary SQL.

Numeric-looking text that a Fusion read already flattened from a compound is
outside what the rule can see. `runner/internal/runner/fusion.go` flattens a
compound Arrow value to text before the SDK ever sees it, and text that looks
numeric is indistinguishable from text that is.

### Reductions

`sum`, `avg` and a rebucket mean go through one shared numeric-measure rule
(`vocab.check_numeric_measure`), and so do `min`/`max`. Two refusals come
from there rather than from a type check:

* a **physically compound** column cannot be reduced, however the builder's
  coarse vocabulary types it — `numeric(10,2)[]` reads as `number`;
* a **fixed-precision decimal** cannot be `min`/`max`ed before conversion,
  because it arrives as text and text order is lexical: `"10"` sorts before
  `"2"`, so the run succeeds and answers the wrong row.
* an **identifier** cannot be summed or averaged (`_check_identifier_measure`
  in `vocab.py`). Its values label rows, so a total of complaint ids is a large,
  confident, meaningless figure; the refusal names the count to use instead. A
  column is an identifier only when the warehouse declares it one: the Agent's
  grounding (`_workflow_schema.py`) stamps `"identifier": "primary_key"` from the
  catalog's `is_primary_key` and `"foreign_key"` from its declared foreign keys
  into the column's stats (`IDENTIFIER_DECLARATIONS`). It is never guessed from a
  column's name or values.

An **average at a wider period** is never an average of averages. On a plain
table a monthly average is each day's `("avg", x)` taken with `("count", x)` in
the same `aggregate`, then `rebucket(..., measures={"x_avg": ("mean", "x_count")})`,
which computes `sum(mean * count) / sum(count)` — the month's own average. The
SDK refuses a mean weighted by anything else (`_rebucket_weight_refusal` in
`nodes.py`: another column, or a row count that also counts blank values), and
`aggregate` refuses `("avg", <an average>)`; both refusals name this fix. The
weight is recorded on the rebucket's `AggregateFact.weight` and as the mean's
second lineage operand, which is how request conformance
(`_is_exact_weighted_mean`, `_exact_mean_weights`) reads the pair as the one
`avg` the request states.

## Fusion sources: a second query language

A Fusion (Apache Arrow Flight) source is not queried with SQL. Its query is one
JSON object — a "ticket" — in which projection, filtering, grouping and ordering
are all keys. The transport is unchanged: a source node still carries
`{sourceId, query}`, the engine still treats `query` as an opaque non-empty
string (`compile.go`), the worker still forwards it, and `FusionRunner.Execute`
sends it verbatim as the Flight `DoGet` payload. **The engine, worker and runner
need no Fusion-specific handling** — this is entirely an SDK and grounding
concern.

`Schema` therefore carries a **family** per authoring name, `sql` or `fusion`.
A Fusion entry holds `realm`, `dataset`, `time_series`, `data_window` and the raw
`arrow_types`, and has no `table`, `parts` or `engine`. `relation_of`,
`relation_parts_of` and `engine_of` **raise** for it rather than falling back to a
default: quoting a realm as though it were a table produces plausible SQL that is
then sent to a Flight server, and the whole point of the family axis is to make
that failure loud at the call site.

### What is pushed down, and what is not

Only what the author writes inside `fusion_source(...)` is computed by Fusion.
Everything done to the returned handle — `filter`, `aggregate`, `edit_fields`,
`create_asset` — runs in DuckDB inside the worker, exactly as for a SQL source.
This is deliberate. The two operator vocabularies overlap rather than nest
(the DSL has `= == != > >= < <= in` and nothing else); Fusion has no `NULL` — a
missing value *is* the empty string, so `!=` keeps rows DuckDB would drop; there
is no `HAVING`, so a threshold on an aggregate is inexpressible; and the `OR`
form has a confirmed server bug in which the OR branch bypasses the date range.
Lowering the generic chain methods would make one typed call mean two different
things depending on which source it ran against.

### Why the ticket builder validates so much

Nothing downstream inspects the ticket. The engine checks only that the string is
non-empty, and `FusionRunner.Validate` returns valid unconditionally without
contacting the server. `workflow_sdk/llumen_wf/fusion.py` is the only enforcement
point that exists, and it checks shape rather than trusting the server to
complain, because the server's characteristic failure is **silence**:

| Written | What the server does | What the builder does |
| --- | --- | --- |
| `groupby` without `aggregations` | ignores both, returns a raw row scan | refuses, naming `aggs=` |
| `("severity", "in", "major")` | splits the string into `["m","a",…]`, matches nothing | refuses, requires a list |
| `top` without `sortby` | ignores the limit, returns everything | refuses, naming `order_by=` |
| `limit`, `order_by`, `having`, `filter` | ignores the key entirely | never emitted; the keys do not exist in the API |
| an unbounded time-series read | hangs | refuses, quoting the dataset's own data window |
| a window outside the data | `row_count: 0`, `columns: null` — **not an error** | refuses, quoting the span that does hold data |
| a date range on a static dataset | `No match for FieldRef.Name(timestamp)` | refuses |
| `2024-01-01T00:00:00Z` | fails on the tz-aware kernel | refuses, printing the naive spelling |
| a filter literal the column's measured vocabulary excludes | zero rows, no error | refuses, listing the values the column holds |

Aggregate output naming is the other half. The DSL has **no alias**: the server
names an aggregate `<column>_<function>`, so `aggs=[("sum", "clean_count")]`
yields `clean_count_sum`. `fusion.agg_output_name` is the single point of truth,
and the ticket and the frame are built together by `fusion.build_ticket` so the
columns the builder promises downstream cannot drift from the ones the read asks
for. The frame is always a **subset** of what returns — a frame naming a column
that will not come back breaks every downstream reference at run time.

### The empty window, and why the grounding carries a sibling span

The costliest Fusion mistake is not a malformed ticket, it is a well-formed one
aimed at the wrong dates. The server answers a window with no data by returning
`row_count: 0` and `columns: null`. That is not an error at any layer: the step
succeeds, the runner's result is not parquet-eligible so the worker stores a
`{data, row_count}` envelope instead of a table, and the run finally dies several
nodes later with `create_asset node requires a tabular (parquet) upstream input`
or a DuckDB `Referenced column "<x>" not found ... Candidate bindings: "data",
"row_count"`. Nothing in that chain names the real cause.

The typical cause is an author dating a read from the current month against
datasets whose data ends in the past. Many datasets report no `data_window`,
because the probe that fills it (`fetchSamplesAndWindow`, 25s per dataset) is
best-effort. With no span to anchor to, "now" is the natural guess and always
wrong on a historical deployment.

So `build_grounding` also computes a **covering span** across the datasets on a
source that did report one, and stores it as `source_data_window`. `check_window`
uses the dataset's own span when it has one and the covering span otherwise, and
refuses a window that does not overlap. The covering span is the weaker fact and
is described as such in the error; it only ever rejects a read that could not
have returned anything, which is the read that would otherwise fail confusingly
much later.

### Reading a dataset that replicates its entities

A static dataset can hold the same entity more than once — once per scenario, or
per plan version, or per modelled year. Aggregating one without pinning that
dimension adds the copies together, which does not fail: it returns a number
several times too large, so a ranking on it ranks by size rather than by change.

The SDK does **not** guess when this is happening. A read's grain is only known
where it was proven — a Fusion grouped read returns one row per `group_by`
combination, and that is a fact about the server, not about how many times the
underlying rows repeat an entity. Nothing measured reaches the builder that says
a static dataset replicates its rows across a dimension, so there is no rule
here to key off, and a rule keyed off column names instead (`year`, `scenario`,
`version`) refuses correct reads on datasets where such a column is an ordinary
attribute and misses every dataset that spells the dimension anything else.

An author working with a dataset like this pins the dimension with `where=` or
puts it in `group_by=` to compare the copies; comparing them is also where the
change between them is.

Two consequences worth knowing when changing the Fusion path:

- `wf.avg/max/min/sum/count` over a Fusion read does **not** append a second
  source node. `_reads_a_source()` excludes Fusion, so the reduction routes
  through the ordinary DuckDB frame aggregate. A second ticket could not work:
  it would return `clean_count_max` while the reference declares `clean_count`,
  and `wf.count()` has no expression in the DSL at all.
- A Fusion source node also carries `"mode": "query"`. The engine ignores it; the
  workflow **builder UI** does not — `inferWorkflowSourceMode` decides a node's
  kind by JSON-parsing its query, and a Fusion ticket parses, so without this the
  saved workflow reopens as an API Request node.

`time_aggregations`, `groupby2/3`, `map_filter`, `divide_by`,
`calculate_los_on_column`, `aggregate_recurrency` and `day_time_filter` are
deliberately not exposed: none has a documented effect on the returned column
names, and a key whose frame cannot be computed must not be emitted. For a
monthly trend, group by the native `year`/`month` partition columns instead.

## Validation stack

The same request is checked at several levels, each with a different job:

1. **SDK schema/frame validation** catches invented sources/columns, invalid
   types, impossible domains/ranges where the profile is complete, bad join
   pairs, unsafe graph shapes, and missing required node configuration. It
   also refuses four program mistakes at build time, each naming the node and
   the fix (`workflow_sdk/llumen_wf/rules.py`, `nodes.py`, `workflow.py`):
   - `STEP_REACHES_NOTHING` (`check_every_step_is_used`): a step whose rows
     reach no answer, action or AI step. An unused read is still reported first
     as `READ_REACHES_NOTHING`. Triggers, `sticky_note`, `no_operation` and
     `wait` are exempt.
   - A non-count aggregate that names no column, through the typed aggregate or
     `wf.sum/avg/min/max(handle, None)`.
   - An average of averages, through the typed aggregate or `wf.avg(...)`
     (`check_not_an_average`). Sum, min and max of averages, sum of sums and
     count-then-sum still build.
   - `WINDOW_ON_ONE_SIDE` (`check_window_on_one_side`): a join or scalar
     reference that combines a read bounded to a date window with a dated read
     totalled over all its dates. Stacking with `wf.merge` is not affected.
     A dated read joined only for its labels is exempt (`_attribute_only_reads`)
     when the join matches on every column its catalog declares the primary
     key (`stats[...]["identifier"] == "primary_key"`) and no measure's lineage
     reads it. Only aggregates downstream of that read are held to further
     conditions: each output stays a column, and a row count (`("count", None,
     ...)`) passes only when every join keeps matches alone (`how="inner"`),
     since a full join adds the read's unmatched rows from all its dates. A
     count taken on the windowed side before the join never sees the read's
     rows. A read with no declared key, or joined on part of its key (a time
     series joined on its site alone), is still refused, since each windowed
     row would repeat once per date it holds.
2. **Program executor validation** restricts the model-authored Python to the
   builder language and gives only framed document output to the parent.
3. **Agent marker resolution** replaces `$SRC:` only with the current chat's
   allowed source IDs.
4. **Agent request derivation and conformance** reads the request back from
   the document's facts, resolves it against the grounding, and checks it
   against the same document; then the user's words are checked against the
   derived request and the document. See
   [agent-authored-workflows.md](agent-authored-workflows.md#what-a-draft-is-checked-against-before-it-is-registered).
5. **Engine compilation** validates the final document against current graph,
   contracts, lowering, and adapter rules.
6. **Worker execution** validates runtime facts such as artifact availability,
   credentials, outbound action egress, and trigger payload availability.
7. **Agent result reading** follows authored terminal edges and channels. A
   zero-row terminal is reported as a zero-row result; it is never replaced by
   an upstream source table.

This layering is intentional. A compile-successful document can still be
semantically wrong; source/profile checks and post-run warnings cover the
classes the compiler cannot see.

## Prompt pack generation

The SDK prompt is a product artifact, not benchmark data. `gen_pack.py` builds
the generated reference from public builder docstrings, then combines it with
the hand-maintained authoring rules and examples. The agent adds the current
request and compact live source grounding through
`_workflow_sdk._build_prompt`.

Do not add a literal user test request or benchmark task into the pack. It
teaches the model a particular answer instead of the underlying API and makes
later quality measurements misleading. Examples use reserved illustrative
sources and explain patterns, not scored answers or live customer data.

When changing public methods:

1. update the method/docstring and its tests;
2. regenerate/check `workflow_sdk/pack/sdk_pack.md` with the supported pack
   tooling;
3. run pack freshness and example-execution tests;
4. update this page only for a behaviour or architectural change, not every
   wording adjustment.

## Matched multi-read answers, and where they stop

The Agent's accepted analytical path authors a matched subset: any number of
reads joined as one tree of matches (N reads, N - 1 matches), any number of keys
per match, and each side grouped by exactly its match keys so one side is
provably one row per key. Conformance assigns program reads to declared inputs
by bipartite matching (`_read_slot_assignment` in
`_workflow_request_conformance.py`), so the check scales with the number of
reads. The authority
is `contracts/workflow_authoring_capabilities.json` (gap
`WF_CAP_AGENT_MULTI_READ_BOUNDED`, which records what remains unavailable); this
section describes only what a live run has shown.

Proven end to end, program through Engine and Worker to a delivered Parquet
artifact whose every value matched an independently computed gold:

- **two relational sources** in one answer;
- **two Fusion datasets of one source**, matched on a shared key;
- an **inner** match (`only_matching`, unmatched excluded);
- one **`if_else`** decision with a main outcome and a supporting outcome, both
  arms delivering.

Not proven, and not to be described as working:

- **`switch_cases` and `stop_error`.** Enabled and covered by the deterministic
  gates; never executed against a real run. Gap
  `WF_CAP_DECISION_ARM_NOT_LIVE_PROVEN`.
- **`full` joins and `replicate`.** The runtime compiles them, but the
  cardinality facts that would tell an author a join replicated rows, and the
  disclosure a full join owes for the side it left blank, are incomplete. Gap
  `WF_CAP_JOIN_SEMANTIC_FACTS_INCOMPLETE`.
- **Two distinct Fusion sources.** The two-source path is proven for
  relational sources only.

Refused by name rather than staged: **several inputs cannot read a Fusion
dataset recorded over time.** A Fusion read carries its time bound as the window
on its own query, and a request states one window through `period` — which
several inputs already refuse, because one window cannot bound two reads. The
program's derived request is refused at resolution
(`_refuse_unwindowable_fusion_reads`), before anything is registered, with a
sentence naming the choice. Static Fusion datasets take no window and match
normally.

## Known boundaries

- The SDK can author current engine node types, but a node is useful only when
  its worker adapter and the agent's grounding can support it.
- Source summaries are the production grounding boundary. A source without a
  usable relational summary is refused rather than guessed.
- Profile min/max may be sampled for very large sources; hard failures based
  on sampled extrema must remain conservative.
- Preview runs do not fire schedules or webhooks, which are materialised only
  for a published version. They do perform email, chat and API actions for
  real, and slides and briefing steps save their output, exactly as a
  production run does; with no workflow SMTP transport an email step fails with
  `WF_ACTION_EMAIL_TRANSPORT_UNCONFIGURED`. `create_asset` is the exception: a
  preview, like a builder run, saves no asset and emits the upstream table
  (`isBuilderRunMode`). This includes a native draft's *Run temporarily*, which
  runs in preview mode.
- A saved native draft keeps its schedule trigger and `send_email` nodes and is
  compiled by Save, but nothing is registered or sent until it is published.
- Cache recovery can replay only a safe dependency closure from a manual or
  scheduled workflow. A webhook/chat input cannot be reconstructed after its
  original payload is gone.
- `create_asset` authors only the catalog types whose engine chart type the
  engine accepts; grouped cards, `waterCurrent` and `outfalls` are refused by
  name (`NOT_CREATE_ASSET` in `workflow_sdk/llumen_wf/assets.py`).

## Validation checklist

- `make test-sdk`
- focused agent tests for source grounding, marker resolution, author/retry,
  routing, and result-channel selection
- `make test-engine` whenever emitted configuration, node kinds, or lowering
  changes
- `git diff --check`
- inspect `workflow_sdk/pack/sdk_pack.md` and run its freshness/example tests
  after a public SDK or docstring change

## Integration map

- [agent-authored-workflows.md](agent-authored-workflows.md) — how the agent
  decides to use the SDK, runs a preview, and runs or saves a native draft.
- [ancestor-refs.md](ancestor-refs.md) — the engine contract behind `wf.ref`.
- [triggers.md](triggers.md) and [action-nodes.md](action-nodes.md) — runtime
  details after the SDK emits those nodes.
