# Agent-authored workflows

## Audience and goal

This page documents how the Llumen chat agent uses the workflow SDK to answer
complex requests and to create automations. It covers routing, source grounding,
the authoring tool loop, the review card, running a reviewed workflow and
collecting its answer, and saving a workflow. It is deliberately about product
behaviour, not the Python API; read [authoring-sdk.md](authoring-sdk.md) for the
latter.

## Read first

1. [../services/agent.md](../services/agent.md) — agent graph and service
   boundaries.
2. [authoring-sdk.md](authoring-sdk.md) — builder/program contract.
3. `agent/src/agents/llumen/logic/planner.py` — structured plan validation
   and the subagent/tool allowlist.
4. `agent/src/agents/infusion/logic/subagents/registry.py` — registered
   workflow subagents, one `SubagentSpec` each in `_subagent_specs()`
   (exposed as `REGISTRY`), carrying the prompt, model group, capabilities
   and tool names.
5. `agent/src/agents/infusion/logic/tool_helpers/_workflow_plan_present.py` —
   what `present_workflow_draft` does with a program: build it, derive its
   request, check the user's words, register it.
6. `agent/src/agents/infusion/logic/tool_helpers/_workflow_derived_request.py`
   — the typed request read back from the program's own facts.
7. `agent/src/agents/infusion/logic/tool_helpers/_workflow_candidate_actions.py`
   and `_workflow_sdk.py` — start a reviewed candidate's run, then read the
   finished run once, gate it and render its answer.
8. `agent/src/agents/infusion/logic/tool_helpers/_workflow_schema.py` — live
   source-summary to SDK-schema conversion.

## Product behaviour

The user does **not** need to say “build a workflow.” The planner may choose a
workflow as an internal execution tool when a request requires a dependency
shape that the ordinary query path cannot answer reliably, for example:

- an aggregate-relative comparison followed by classification or branching;
- several dependent transforms or a join;
- an agent reasoning over computed rows;
- a durable automation with a trigger, schedule, or action;
- a result needing more than one related output branch.

This is a structured planner decision (`execution_strategy` and workflow
intent), not a primary regex for the word “workflow.” Deterministic routing
guards still protect clear trigger, schedule, and action requests.

Two workflow subagents share one registered tool family and **one review
protocol**; they differ in what the user most likely wants to do with the
reviewed workflow:

| Subagent | When used | What the user sees |
| --- | --- | --- |
| `workflow_answerer` | The agent needs a workflow to answer a complex data question. | The typed **workflow proposal** card. **Run temporarily** runs the reviewed workflow once and the answer is posted in the chat when the run finishes. |
| `workflow_builder` | The user explicitly asks for automation/a workflow. | The same card. **Save workflow** keeps the reviewed workflow as an inactive draft; Run is offered too when the server says the candidate is runnable. |

Both targets author the native document, validate it and register it before
anything runs or is kept, so the card always names a real, reviewed revision.
`tools_for_route` in `agent/src/agents/shared/workflow_execution_route.py` is
the one place that decides a route's tools; `may_present_sdk_draft` is the
proposal tool's own guard. Ordinary direct-query answers are unchanged: a
workflow is used only when the planner routes the request to one.

### What a matched, decided answer can currently do

Proven end to end — model-authored SDK, both conformance gates, one preview run, Engine and Worker delivery, and a Parquet
artifact whose every value matched an independently computed gold — but not yet
exercised live through the review card's Run:

- an answer that reads **two sources at once** and matches them on a shared key;
- the same shape over **two Fusion datasets of one source**;
- a **decision** on a calculated result, with a main answer and a supporting
  result, both arms delivering.

The bounds are real and are recorded per variant in
`contracts/workflow_authoring_capabilities.json`, not rounded up to the node
family:

- Only an **inner** match is proven. Keeping rows from either side compiles, but
  the facts that would tell an author which side was left blank, or that a join
  replicated rows, are incomplete (`WF_CAP_JOIN_SEMANTIC_FACTS_INCOMPLETE`).
- Only **`if_else`** has run live. A multi-case switch and an arm that stops are
  enabled and covered by the deterministic gates but have never executed against
  a real run (`WF_CAP_DECISION_ARM_NOT_LIVE_PROVEN`).
- Each side of a match is grouped by exactly its match keys, so one side is
  provably one row per key. The request code caps neither the number of reads
  nor the keys per match (see
  [authoring-sdk.md](authoring-sdk.md#matched-multi-read-answers-and-where-they-stop));
  the capability contract's gap `WF_CAP_AGENT_MULTI_READ_BOUNDED` records what
  remains unavailable: arbitrary join semantics, replication-aware joins and an
  explicit mapping relation.
- **Several inputs cannot read a Fusion dataset recorded over time.** Its time
  bound is the window on its own query, and a request states one window, which
  cannot bound two reads. The program's derived request is refused when it is
  resolved (`_refuse_unwindowable_fusion_reads` in
  `_workflow_request_resolution.py`), before anything is registered. Static
  Fusion datasets match normally.

#### Lookup attributes: a zone's boundary, a type's name

A map of a measure per zone, where the boundary lives in a zone table, and a
chart labelled by a name rather than an id, are one shape: a **lookup** input
nothing is calculated from, matched on its key, whose columns are shown beside
the result unaggregated. The plan names those columns in `attributes`
(`{"input": "zones", "column": "geometry"}`), groups the lookup by exactly its
match keys like any matched input, and maps them with
`{"kind": "attribute", "index": 1}` — for example into a map's
`geometryField` or a pie's `category`.

- **Uniqueness is proved, never assumed.** Resolution reads the lookup's
  primary key from the grounding's identifier facts
  (`_resolve_attributes` in `_workflow_request_resolution.py`) and refuses by
  name (leaf `attribute.binding`) a lookup with no declared key, a lookup
  matched on only part of its key (`_refuse_a_lookup_not_matched_on_its_key`),
  and a Fusion dataset. The resolved request carries the key as
  `ResolvedAttribute.unique_key`.
- **The program reads the lookup without reducing it.** Its limb is a read (and
  its own row filter, when one tests it); the columns are carried through the
  match under the name the match gives them.
- **Conformance traces the lineage.** The delivered column must be the lookup
  read's own column, reached through row filters and renames only; an
  aggregated copy of it does not conform. The lookup's side of the join is one
  row per key by its declared key (`_lookup_grain` in
  `_workflow_request_conformance.py`).
- A catalog shape (a map, a pie) names the measure each slot shows, so further
  measures are delivered beside it; only `kpi`, `bar` and `line` are limited to
  one (`_ONE_MEASURE_SHAPES` in `workflow_request_contract.py`).

A decision the workflow contains is a decision the user reads on the review
card before anything runs. That is the control that catches a workflow built on
the wrong quantity — so the review names the measure the decision tests, and
pressing Run is a real decision rather than a formality.

### Several answers in one request

The request derived from a program (see
[What a draft is checked against](#what-a-draft-is-checked-against-before-it-is-registered))
is a small graph of analyses rather than one chain
(`ResolvedWorkflowRequest` in
`agent/src/agents/shared/workflow_request_contract.py`, read through
`request_parts` and `request_answers`):

- **Parts.** Each delivering terminal of the program — a `create_asset` that
  carries a declared answer, or an action — is grouped into an analysis by the
  facts the SDK recorded for it (`_partition` in `_workflow_derived_request.py`).
  Independent analyses become `parts`, each a complete request body with its
  own inputs, measures, grouping, detectors and named `outcomes`. An action sent
  from a decision arm belongs to that decision's analysis, an action that reads
  a named result is a delivery, and any other action answers an analysis of its
  own, so a program with several parts can send each part its own email. The
  request contract caps no collection by count and no text by size.
- **Answers.** Every result the person will read is declared in the program with
  `wf.answers(name=...)`, and the artifact that delivers it passes
  `answers="<name>"` (`answers=True` when only one is declared). A program with
  exactly one answer leaves it unnamed, and its one declaration is paired with
  it whatever it is called, even beside analyses that only act (`_claim` in
  `_workflow_request_conformance.py`, as `proved_answer` does for a run). An
  action that carries no declaration of its own is judged by what it receives
  — its stated rows and the columns reaching it — never by the declaration
  beside it (`_action_declared_block`). When the declared answers and the steps
  marked as answers do not pair one to one, the conformance reason is
  `pairing`, and the author is told which declaration nothing delivers or which
  marked step has no declaration left (`_pairing_text`).
- **Merges** match or stack two named results — outcomes, agent steps or other
  merges — and may be answers themselves. **Deliveries** send an action after a
  named result, with `references[].of` naming the results it reads: the
  program makes each one an ancestor of the action, either by sending it from
  `wf.merge([...])` of exactly what it reads or by referencing the results
  directly.
- **Agent steps** name what they read with `explains`: one answer, a merge, or
  the answers a `wf.merge([...])` stacks for the step to summarise.
- **Outputs** take an asset-catalog type id as `shape` and bind its slots with
  `mapping`. No row cap is added: an output or a detector ranking carries a
  `limit` only when the program writes one, and a `sort` keeps every row.

Document conformance compares each answer with its own analysis, then the flow
between them; the result gate checks each answer's result on its own. See
[authoring-sdk.md](authoring-sdk.md#request-conformance-for-analytical-workflows).

### Anomalies and rankings

Words asking for anomalies, outliers, spikes, dips or "what stands out" ask for
a time axis even when they name no time unit, and so do words asking whether one
measure leads or lags another (`anomaly_requested` and `lead_lag_requested` in
`_workflow_request_requirements.py`); ranking the readings that stand out is not
a category split. On daily data "unusual" compares each day with the same
weekday (`seasonal_baseline`); `baseline`, which compares with the previous
periods, is used only when the person asks for that. A ranking of a detector's
result — "the top 3 anomalies" — is declared as `rank` on the detector
(`check_detector_rank` in `agent/src/agents/shared/workflow_detector_rules.py`):
`largest` ranks by distance from usual in either direction, and a lag
correlation is never ranked.

A baseline's `<value>_unusual` verdict is two-sided: it is true when the
reading's deviation score is at least 3 either way. Words that ask for one side
only — "unusually high", "spikes", "above normal", or "unusually low", "dips",
"drops" — are recorded as `anomaly_direction` (`high` or `low`, empty for
either side) on the stated requirements in `_workflow_request_requirements.py`.
The one-sided test is a filter on the detector's signed score:
`("<value>_deviation", ">=", 3)` keeps exactly the unusually high readings and
`("<value>_deviation", "<=", -3)` exactly the unusually low ones.
`DETECTOR_SIDE_FILTERS` in `workflow_detector_rules.py` names the column each
baseline algorithm allows this on, and `check_detector_verdict_filter` accepts
only those two comparisons; any other threshold on the score is a second
analysis and is refused, naming the two forms. When the words name one side
and the program still filters on the two-sided verdict, or ranks the other side
first, `present_workflow_draft` refuses with `WF_DRAFT_DIRECTION_MISMATCH` and
says which condition to use instead (`_side_contradiction`). A baseline whose
every row is delivered, flagged either way, keeps nothing to judge and is not
refused.

A period on a request with a baseline detector is the window the detector
**judges**, not the rows it reads: the program reads the history before the
period, runs the detector, and keeps the period after it
(`detector_judged_window`; see
[authoring-sdk.md](authoring-sdk.md#request-conformance-for-analytical-workflows)).

### What a draft is checked against before it is registered

The model writes only the `llumen_wf` program; `present_workflow_draft` takes
nothing else. `_present_sdk_draft` in `_workflow_plan_present.py` runs one fixed
order: build and validate the document, project it into the native document
(which admits only the config variants in `ENABLED_CONFIG_VARIANTS`,
`agent/src/agents/shared/workflow_config_variants.py`), derive the request,
check the user's words, ask the intent judge, then register.

- **A builder refusal names its rule.** When the SDK refuses the program, the
  refusal's `code` is `WF_SDK_<RULE>` (for example `WF_SDK_WINDOW_ON_ONE_SIDE`),
  so the turn guard and the turn record count the rule that fired. An error
  nothing expected while checking a draft is refused as
  `WF_DRAFT_CHECK_FAILED` (`present_workflow_draft`), so a draft is never
  registered past a check that crashed.
- **The request is read from the program.** The SDK stamps every delivering
  terminal with an `answerFacts` block: its reads, ordered operations, the
  lineage of every delivered column and the channel the answer leaves on.
  `derive_request` in `_workflow_derived_request.py` reads those blocks and
  states what the program does as a `WorkflowRequestDraft`; `resolve_request`
  binds it to the grounding like any other request, and
  `compare_request_to_document` checks the resolved request against the same
  document (a round trip). When that succeeds, the request is the revision's
  execution contract. Refusals go back to the author, never to the user:
  `WF_DRAFT_ANSWER_UNDECLARED` for a program that declares no answer (and where
  the declaration goes), and `WF_DRAFT_UNSUPPORTED_SHAPE` for two resolver
  findings that are wrong in any draft (`_RESOLVER_FINDINGS_REFUSED` in
  `_workflow_plan_present.py`): adding or subtracting quantities whose units
  differ or are unknown (`measure.unit`), and a window outside the dates the
  data holds (`period.start`).
- **A draft no typed request describes still registers.** Any other derivation
  refusal — a construct no request can state (`WF_DRAFT_UNSUPPORTED_SHAPE`), a
  request the contract rejects, or a round trip that did not agree
  (`WF_DRAFT_UNCHECKABLE`) — is logged and the draft goes on without a request.
  The word checks below that read only the document still run; the ones that
  need a request pass. It registers with a `FactsExecutionContract`
  (`agents/shared/workflow_candidate_contract.py`, built by
  `facts_contract_for` in `_workflow_candidate.py`): one `FactsAnswer` per
  answer the SDK stamped, with its terminal, the output its rows come from and
  the columns it delivers. Registration accepts it only when it equals the
  contract the document itself produces, and a Run rebuilds it from the
  approved bytes and refuses `WF_CANDIDATE_RUN_REQUEST_MISMATCH` if it differs.
  After the run, `_facts_gate` (`_workflow_candidate_actions.py`) applies the
  same structural result checks as a typed contract (answer found, preview from
  the answer's own step, columns equal to the stamped ones, row counts agree,
  values scalar and JSON-safe) and withholds an answer computed from a read cut
  at the runner's row ceiling as `WF_REQUEST_RESULT_INCOMPLETE`. An action
  answer, or a decision on the answer's own lineage that sent its rows
  elsewhere, is reported by `facts_effect_decision`.
- **The data the words named.** The stated-requirements interpreter reads the
  data subjects the question names (`data_subjects`) and whether it asks about
  all the data (`all_data_requested`)
  (`StatedRequirements` in `_workflow_request_requirements.py`).
  `subject_contradiction` then refuses a program that leaves out a named
  subject (`WF_DRAFT_SUBJECT_MISSING`), or sends an email subject or body, chat message,
  request body or AI instruction that claims data the program does not read
  (`WF_DRAFT_TEXT_OVERCLAIMS`). A text or subject naming a source ("Energy") is
  covered by a read of any one of that source's tables; a text naming a
  particular table needs that table (`unread_claims`). Reading the data
  somewhere is not enough for a summary: each text is also held to the reads
  that reach its own step, and when the words ask for the results to be sent
  (`delivery.reports_results`) the messages sent must draw on every named
  subject, or the draft is refused as `WF_DRAFT_SUMMARY_PARTIAL` with how to
  give the step every part (`_summary_coverage`). Subjects and texts are matched to tables by one
  fast-model call, `match_subjects` (`AGENT_FAST`), whose table names are kept
  only when they are in the catalog; an unreadable match pauses the turn with
  a question to the user rather than passing it. Words asking about "all the
  data" name no subject, so they are not compared with the sources read; the
  intent judge reads them against the card instead.
- **What the words ask for, read once.** Every screen that depends on the
  user's words reads the extractor's fields (`StatedRequirements`), never a word
  pattern, and compares them with the derived request or the document
  (`_words_against_built` in `_workflow_plan_present.py`):
  - `analysis_contradiction` — anomalies, a lead/lag, a baseline, two periods,
    several measures, a trend or a projected ceiling the words ask for and the
    program does not compute (`WF_DRAFT_ANALYSIS_MISSING`), and a one-sided
    anomaly built two-sided (`WF_DRAFT_DIRECTION_MISMATCH`, above);
  - `zero_fill_contradiction` — a match or comparison that writes 0 into a
    missing value nobody asked to count as zero (`WF_DRAFT_ZERO_FILL_UNASKED`);
  - `chart_contradiction` — a table where a chart was asked for
    (`WF_DRAFT_CHART_MISSING`), or another kind than the one named
    (`WF_DRAFT_CHART_KIND_MISMATCH`);
  - `results_message_contradiction` — a message asked to carry a summary or
    the numbers whose text references no measure or AI step's text
    (`WF_DRAFT_MESSAGE_WITHOUT_RESULTS`). Without a typed request it reads the
    document's messages against the SDK's stamped column facts: a message
    counts as carrying no result when it has no tokens, or when every token is
    a proven key, label or period;
  - `condition_contradiction` — a stated condition the program does not test
    (`WF_DRAFT_CONDITION_MISSING`), or no branch when the other case does
    something (`WF_DRAFT_DECISION_MISSING`);
  - `comparison_shape` — `unclear` asks the one shape question;
    `row_stacking_requested`, `raw_sql_requested` and
    `list_expansion_requested` feed the structure screen
    (`_request_shape_screen`), which needs a typed request. A threshold taken
    from the data ("above average") is built, not refused.

  The reading is taken before any screen can end the turn, and
  `requirements_for` remembers every turn merged with what stood before
  (`standing_requirements`): a period, schedule or delivery stated in any
  earlier turn stands until a turn states or clears it. Words that could not be
  read are checked against nothing: the draft registers, and the card says so.
- **"You asked".** The extractor also copies each separate ask, in the user's
  own words, into `asks`. Before the program is written they are given to the
  author as a checklist (`asks_checklist`, `_author_checklist` in
  `deep_agent.py`). On a registered draft they become the review card's **You
  asked** section (`asked_section` in `_workflow_communication.py`), sent beside
  the proposal as `workflow_asked` (`{asks: [...]}`, or a `notice` when the
  words could not be read) on the WebSocket frame and the saved assistant
  message. The card shows it above *What this workflow does*, which is built
  from the program, so the person compares the two.
- **The intent judge.** After the fixed checks, every draft with a question —
  described by a typed request or not — goes to `check_intent` in
  `_workflow_intent_judge.py` (model tier `AGENT_MEDIUM`, a code constant with
  no setting, a 60-second deadline per call). It reads the user's words, the
  whole plan card, the SDK's facts per node and the schema of the tables read,
  all as text built by `_workflow_intent_inputs.py`. An approval reply such as
  "yes, go ahead" is not the request, except when it answers a question the
  assistant asked just before it (`answered_question`); the question is then
  shown beside the reply. The model rates each ask `met` / `not_met` /
  `unclear` and each row-narrowing step `asked` / `no_effect` / `unasked` /
  `unsure`; code decides. `not_met` refuses only with a step that does
  something else or a stated absence, plus a quote that is mostly the user's
  own words; `unasked` refuses only with a reason and a matching card or facts
  line. Anything weaker, and any model error, parse error or timeout, lets the
  draft go on. The refusal, `WF_DRAFT_INTENT_MISMATCH`, goes to the author
  with each failed ask and restriction and what to change.
- **The card quotes each email.** The *What it produces and sends* section
  shows an email's subject and its body (cut at 300 characters), and says what
  fills each `{{alias}}` in an email or chat message — a column of a named
  result, or the AI step's text — or that the message is fixed text
  (`_message_references` in `_workflow_business_review.py`).
- **Charts of codes.** When a chart's category is a foreign key whose
  referenced table holds a text column (the grounding records the reference in
  the column's stats as `references`), the author is told once
  (`WF_DRAFT_CATEGORY_IS_A_CODE`) to match that table and chart the name. It is
  a hint: the same draft submitted again registers.
- **Identifiers are not amounts.** A sum or average of a column the warehouse
  declares a primary or foreign key is refused by the SDK
  ([authoring-sdk.md](authoring-sdk.md#reductions)).
- **Actions without an answer.** A request whose only deliverables are actions
  names no `output`: "over 3000 email ops, otherwise do nothing" is a filter
  plus an `action` (the email is held back when no row passes), and "over 3000
  email ops, otherwise email finance" is a decision whose arms each send an
  action or stop. An arm that stops (`stops: true`) does nothing — the program
  leaves that `if_else`/`switch` side unused — and cannot hold first
  (`waits_for`). The card then says what each arm sends.

### The authoring tools

Authoring is model-assisted; running and saving are code-owned actions on the
card. The route narrows the registered family:

| Tool | Where | Budget per turn |
| --- | --- | --- |
| `inspect_workflow_sources` | either target, proposal turn; reads permission-filtered grounding | unbounded; a call identical to an earlier one this turn is answered with a pointer to that result rather than the schema again (`inspect_sources_in_turn`) |
| `present_workflow_draft` | either target, proposal turn; takes only the program: builds and validates it, derives its request, checks the user's words against both, derives the review, registers the exact bytes | once registered; a refusal is repaired in the same turn |
| `report_workflow_limitation` | either target, proposal turn; closed reason hint, independently code-proven | once |
| `ask_workflow_clarification` | either target, proposal turn; one short question in the author's own words, when the sources cannot settle the request (`_workflow_clarify.py`) | once per request, plus one more on a resumed turn whose refusal (`WF_DRAFT_SUBJECT_MISSING`) tells the author to ask the user to choose. A question may repeat only numbers the user wrote; after such a refusal it may also repeat the dates of the user's stated period, of that refusal and of the left-out sources' measured data (`_stated_facts`) |
| `save_approved_workflow_draft` | after a typed Save approval of the card; takes no arguments | once |

Inspection with no argument names **every** authorable table; with a name it
returns that table's column types, observed values and measured ranges. Nothing
is elided, because a table the agent cannot see is one it will report to the
user as absent from the database.

Discovery and repair happen in the author's own tool loop rather than in a
separate model call, for two reasons: a schema pre-rendered into one prompt gets
truncated, which shows up as a confident false refusal; and a repair started from
an empty context loses everything the author had already learned.

## One path: author, review, then Run or Save

Every workflow request — a one-time answer or something to keep — takes the
same path, and running and saving are two separate actions on its result.

| | Run temporarily | Save workflow |
|---|---|---|
| Typical request | a number, now (`workflow_answerer`) | something kept (`workflow_builder`) |
| Consent is for | **executing** the reviewed document once | **keeping** the reviewed document |
| Afterwards | an **ephemeral** definition and a run: `is_ephemeral=true`, bound to the chat, `expires_at` 24 hours out, and the answer posted in the chat | one saved draft, `is_ephemeral=false`, compiled, unpublished, **zero runs** |

Either action may follow the other on the same revision; see
[Run temporarily and Save inactive](#run-temporarily-and-save-inactive). A run
is not discarded the moment its answer is shown: until its temporary definition
expires, the card's Save keeps that exact definition as a draft, so "one-time"
means "not kept **by default**", not "gone".

**One native proposal means one PENDING proposal.** While a proposal is awaiting
an answer, a further presentation in that conversation appends a revision to it
rather than starting a second root, so a user can never hold two independently
approvable cards at once. Once that proposal is settled — saved, declined or
invalidated — a later independent request in the same conversation is free to
create a new proposal. It is a rule about what may be pending at one time, not a
lifetime limit per conversation.

Which intent a turn takes is decided by the Planner's typed output, never by
matching phrases — see `_reconcile_routing_with_the_request` in
`agent/src/agents/llumen/logic/planner.py` and the routing matrix in
`agent/tests/test_planner_routing_semantics.py`.

## End-to-end path

1. **Chat request enters the agent graph.** The normal Llumen path reaches the
   planner and then Infusion. There is no separate SDK endpoint.
2. **Planner selects strategy.** It validates the selected subagent and tool
   against `INFUSION_SUBAGENT_TOOL_MAP`, which `planner.py` builds from each
   registry spec's `tool_names`. Defining a tool in the
   `agent/src/agents/infusion/logic/tools/` package alone is insufficient; the
   subagent's spec must also name it.
3. **Grounding is built once for the turn.** `source_map` filters source
   metadata already allowed in this chat; `build_grounding` reads the normal
   source summary layers into the SDK `Schema`, relations, values and
   statistics, and is cached on the request context so the tools serve the
   same facts the SDK will validate against.
4. **The subagent inspects, authors and proposes.** It writes one `llumen_wf`
   program against the SDK reference (`builder_reference()` in
   `deep_agent.py`), with the user's asks as a checklist, and calls
   `present_workflow_draft` with the program alone. Code builds and validates
   the document, derives the request from it, checks the user's words against
   the request and the document, and registers the exact bytes (the revision,
   its review and its execution contract). A refusal goes back to the author
   with the exact reason, in the same turn. When the words need one choice only
   the user can make (a schedule time, an address, a period the data cannot
   settle), code asks one focused question instead and registers nothing; the
   reply is read together with the earlier words and the author proposes again.
   The author may also ask one question of its own with
   `ask_workflow_clarification`; it must be short, end in a question mark and
   state no number the user did not write, and the user's reply resumes the
   same request.
5. **The review card is the turn's answer.** It is derived from the document by
   code, never from model prose. Nothing has run or been saved.
6. **Run.** The card's Run press arrives as a typed `workflow_action` on the next
   chat turn. The Agent prepares the revision (content checks workspace scope,
   reserves the attempt's key, materializes a temporary definition and compiles
   it) and starts one `workflow_preview` run through the editor's run route —
   then the turn ends: "Started a temporary run of this workflow. Its answer is
   posted in this chat when the run finishes." The reply names the event, not a
   state, so it stays true in the transcript; the card shows whether the run is
   still going.
7. **The card watches the run.** It polls the run-detail route with backoff
   (2 s rising to 15 s, no cap, paused while the tab is hidden) and stops when
   the run is terminal.
8. **Collect.** On a terminal status the card sends one `collect` action for that
   attempt's generation and key. The Agent reads the attempt back (bytes,
   execution contract, the run started under the key), reads the finished run
   once, proves it is that attempt's run on that version, and gates the result
   against the execution contract. It uses authored edges and channels to
   identify the correct terminal artifact; filters and branches have distinct
   output channels, and matching row counts are never enough to pick one.
9. **The answer is posted once.** The collection is recorded by compare-and-set
   per generation, so a second tab or a reload cannot post it again. Each
   delivered answer is natural, code-owned copy with the caveats its receipt
   measured, plus an answer card — the answer's rows saved to the chat's data
   ledger and shown through the ordinary `render_asset` command, configured
   from its `create_asset` node (`_workflow_answer_display.py`) — and the
   agent-step prose that explains it, labelled unverified. Each card is sent
   with the next turn position (`place_in_turn`), and its prose follows it as a
   narration beat that names the card (`_emit_collected_answers` in
   `agents/llumen/logic/node_functions.py`), so the prose sits under the answer
   it explains, live and after a reload. The closing reply holds the
   code-owned text; with several answers it has one section per answer, in
   request order, headed by its name (`answer_sections` in
   `_workflow_candidate_actions.py`). An empty or
   mismatched answer, and a failed, cancelled or timed-out run, gets its own
   code-owned reply; an answer is never refused for its size.
10. **Save.** The card's Save adopts the same revision as an unpublished draft,
   keeping the definition a Run already materialized. Nothing is rebuilt,
   published or scheduled by chat.

## Source grounding and refusal policy

The helper authorises only sources present in the current chat context. It
cannot use an arbitrary source UUID or infer a table not in the summary. A
source is skipped/refused when its summary is unavailable, its data family is
neither `relational` nor `fusion`, or it has no usable table/column layer.

Both authorable families appear in one index under one naming scheme, so the
agent chooses a dataset the same way whichever it is. The index states, per
Fusion dataset, that it is read with `wf.fusion_source` and whether it needs a
time window — neither is inferable from the columns, and both fail the run if
guessed. On a chat with a Fusion source attached, the two workflow subagents also
receive a short Fusion note (`fusion_addendum_for`). It is ~380 tokens, not the
~6.1k ticket grammar the chat-path subagents get: the authoring agent never
writes a ticket, the builder does, and the builder refuses at author time
everything that grammar's error catalog exists to recover from.

The authoring agent is expected to use judgment for labels, grouping,
presentation, thresholds that source statistics support, and source choice
among attached sources. It should not ask the user for those routine choices.
It may ask only when a required external fact cannot be inferred, such as a
missing email recipient for `send_email`, or the time and timezone of a
requested schedule — see
[A requested schedule or email is bound, not invented](#a-requested-schedule-or-email-is-bound-not-invented).

Before reporting that data cannot be linked, it must inspect the candidate
mapping/hierarchy tables and name what it checked: ids, codes and names are
routinely reconciled by a table holding both (a `location` beside a
`parent_location`). A metric that is not pre-computed but is derivable from
inspected columns is a derivation to author, not a missing fact. Claiming a
table or column does not exist without having inspected it is a defect, not a
refusal.

## Repair and failure behaviour

Repair is the loop itself: a refused `present_workflow_draft` returns the SDK's
exact error to an agent that still has its inspection results, and it fixes that
specific thing. A turn that keeps drawing refusals is ended with a bounded
explanation rather than looping: `count_refusal` in `_workflow_plan_present.py`
answers `WF_TURN_ATTEMPTS_EXHAUSTED` when the same refusal comes back
`workflow_refusal_repeats_before_stop` (3) times — the same code and detail for
the same program (by its digest), or the same code with word-for-word the same
refusal text whatever was sent — or after `workflow_max_refusals_per_turn` (15)
refusals of any kind. Both are workflow-authoring turn guards
(`agents/shared/workflow_turn_guards.py`): agent settings, set by the
`WORKFLOW_REFUSAL_REPEATS_BEFORE_STOP` and `WORKFLOW_MAX_REFUSALS_PER_TURN`
env vars, that a caller can override for the turns it drives (see
[../services/agent.md](../services/agent.md#workflow-authoring-turn-guards)).

The turn then ends on one code-owned message (`end_turn_unbuilt` and
`give_up_text` in `_workflow_plan_present.py`). It names the scope the user
asked for — all their data, or the data their words name — or, only when the
words name none, the sources the last draft read or the turn inspected. It then
says what kept failing, read from the refusal codes (`_stuck_because`): one kind
of refusal is said of every version ("every version left out part of the data
you named"), several kinds are each counted, most frequent first ("3 of the 5
versions ..., and 2 ..."). Codes that mean the same thing to the person, such as
`WF_DRAFT_UNSUPPORTED_SHAPE`, `WF_DRAFT_UNCHECKABLE` and
`WF_DRAFT_CHECK_FAILED`, are one kind, and every `WF_SDK_<RULE>` is one kind; a
code not in `_STUCK_BECAUSE` is the generic kind. A turn also ends early when
its refusals go round in a cycle — two or more different codes in the same
order twice in a row, such as A, B, A, B (`_refusal_cycle`) — since each fix
brought back a check an earlier fix had passed; the message then says that
parts of the workflow need opposite things. It ends with a suggestion: one
source at a time when several were asked for, else a simpler first version. A
turn a `WF_DRAFT_SUBJECT_MISSING` refusal told to settle with the user ends on
that question instead (`ask_for_the_scope`). The turn's `workflow_authoring_turn` record
(`_workflow_events.record`) is written with `WF_TURN_ATTEMPTS_EXHAUSTED`, the
most frequent refusal code as its rule, and `plan_asked` set. Every refusal is
logged as a `[workflow_refusal]` line with its code and bounded text. An
invalid program is never registered, so it never reaches the engine.

An author that stops without calling `present_workflow_draft`,
`ask_workflow_clarification` or `report_workflow_limitation` is re-prompted
inside the same run, `WORKFLOW_PLAN_OWED_REPROMPTS` (1) times
(`plan_owed_middleware` in `_workflow_authoring.py`, attached to both workflow
subagents in `deep_agent.py`). When it stops again the turn ends on the same
`give_up_text` message; a turn that was never refused says "I could not prepare
a safe workflow" rather than that a build failed.

A workflow subagent holds only its phase's tools (`tools_for_route`).
`WorkflowPhaseToolSurfaceMiddleware` in `deep_agent.py` holds that at both
doors: the model call is narrowed to the phase's allow-list, with the
filesystem prompt deepagents injects removed, and a call to any other tool —
`grep`, `glob`, `write_file` — is refused with a tool message naming the tools
the turn has, before it runs.

A reviewed candidate is immutable, so nothing re-authors it after it has run.
When its date window selected nothing because the window lies outside the data
the source holds, its answer is not delivered and the user is told why and asked
to restate the dates; `present_workflow_draft` already refuses a window it can
see is outside the data before anything is registered.

Important behaviour rules:

- A zero-row terminal output is a correct answer. Do not fall back to an
  upstream source table.
- A filter's `kept` and `discarded` outputs, and branch outputs, are distinct
  even if they have the same number of rows.
- A preview performs its email/API/chat actions for real, exactly as a
  production run does, and a slides or briefing step saves its deck or
  briefing.
- An explicit workflow draft is not active until the user reviews and
  publishes it. A schedule does not begin merely because a preview compiled.
- Run warnings, including a degenerate all-rows-on-one-branch split, are shown
  faithfully rather than hidden behind a successful-looking narrative.

## The native proposal

Every workflow request creates a native proposal. When the user asks for
something to be **kept** — saved, scheduled, or made to act outside the
conversation — the turn goes to `workflow_builder`; the user need not say
"workflow": "email me these totals every Monday" takes that route, because a
one-time run cannot hold a schedule or send anything.

Saving is not running. A saved workflow is stored **inactive**: it is a draft
with no published version and no runs, and nothing about it executes until it is
separately published or run. "Saved", "compiled", "executed" and "enabled" are
four different states, and the proposal card reports the first two without
implying either of the last two.

1. **Propose.** The model inspects the authorized sources and writes one
   `llumen_wf` program. `present_workflow_draft` compiles it, validates the
   document, derives the native projection and the six-section business review,
   and registers the exact canonical bytes with the content service
   (`POST /api/content/internal/v1/flow-proposals`, gated by the `workflows`
   licence feature like the editor's Flow routes). The proposal is stored
   `awaiting_approval` and a save key is **reserved** at `status=open`.
   Nothing is uploaded to object storage yet.
2. **Approve.** The card's Save button calls content's save route directly.
   A typed reply right after the card is classified into one closed verdict; an
   approval that names Save installs a route carrying only opaque identities —
   the program text is never copied back into a model prompt — and a typed
   "run it" is told to press Run on the card.
3. **Save.** `save_approved_workflow_draft` takes **no arguments**. Code spends
   the reserved key against the immutable registered revision, uploads its
   canonical bytes using the storage service's numeric-version path and overwrite
   convention, verifies them, and then adopts the reference atomically with the
   definition, version, document and receipt rows. The pending revision is
   immutable; the object store is not an immutable store.

### Four states, and they are not the same state

Conflating any two of these leads to the "it's saved so it must be running"
class of bug.

| State | What exists | What does not |
| --- | --- | --- |
| **Proposed** | a durable revision + reserved save key + reserved run key | no definition, no version, no stored object |
| **Saved** | definition, version, authored document, receipt | `status=draft`; no published version |
| **Compiled** | a compiled document and node/edge/trigger counts | still not enabled; no trigger registered |
| **Executed** | `workflow_run` rows | — |

A saved draft is **inactive**: it has not run, is not published, is not
enabled, and no schedule or webhook has been registered. Inactive means *not
activated*, not *missing functionality*: a requested schedule trigger and
`send_email` node stay in the saved document, and nothing registers or sends
them until the owner publishes the workflow.

Save does compile the saved version. After adoption,
`compileSaved` in `content/internal/api/services/flowproposals/service.go`
asks the Engine to compile it, the same way the builder's own save does, so the
editor can run it, test a node of it and publish it without an edit or re-save.
Compiling activates nothing. A compile that fails or never reaches the Engine
does not change the save outcome, because the receipt is already durable; the
card then reports the version's real `compilation_status`.

### Three save outcomes, because two would be a lie

`save_agent_draft` answers `saved`, `not_saved` or **`unknown`**. `unknown` is
mandatory: if the row was committed and the reply was lost, reporting failure
sends the user to save again and creates a second workflow. On `unknown` the
reservation is **kept** and the user is told the outcome is unresolved; retrying
with the same key resolves to whatever actually happened rather than repeating
it. Only a durable `not_saved` releases the reservation.

So: **a failed request does not mean nothing was saved.** Any documentation or
message that says otherwise is wrong, and reconciliation reads the receipt the
proposal's own snapshot carries (below).

### Reload, decline and recovery

Content owns the lifecycle endpoints under
`/api/content/v1/workspaces/{scope_id}/flow-proposals`
(`content/internal/api/handlers/flow_proposals.go`, logic in
`content/internal/api/services/flowproposals/`). They use the caller's bearer
identity and the resolved team/private destination, not an owner supplied in a
request body.

- `GET /flow-proposals?chat_id=...` recovers the caller's conversation
  proposals using durable originating-turn identities even when a chat-JSON
  pointer is missing. Each entry is the current revision's typed review
  snapshot, without canonical document bytes, program text or storage paths. It
  is not a workspace-wide listing of other users' proposals, and it is the only
  proposal read: the Agent picks one proposal out of it by id, and every other
  question about a proposal is answered from its snapshot.
- `POST /flow-proposals/{proposal_id}/invalidate` accepts the expected
  revision, review hash, state sequence and `decline`/`unrelated` reason. The
  database transaction invalidates consent and rejects the same open reservation
  together; it cannot undo a completed Save.

A Save whose reply was lost is checked read-only from the same list
(`reconcileSave` in `frontend/src/services/workflowProposalService.ts`): the
snapshot of that exact revision carries its `receipt` once saved. Only a
receipt issued under the original key, or a declined/invalidated proposal,
settles the operation. Anything else — still open, missing, a list that could
not be read, a lost login — keeps the original key unknown, because none of
those proves that nothing was saved.

The candidate graph route (`GET /flow-proposals/{proposal_id}/revisions/{revision}/graph`)
and the save route (`POST /flow-proposals/{proposal_id}/save`) sit beside them,
under the same scope and bearer rules. Running a proposal uses the Agent-only prepare route and the
ordinary run route, described in
[Run temporarily and Save inactive](#run-temporarily-and-save-inactive).

Registration, adoption and invalidation serialize on the owned chat before
their proposal/save row locks. Read snapshots use a consistent database view.
The receipt is immutable; the compilation observation belongs to its exact
version and can change independently. None of these routes publishes, enables
or runs a workflow.

### What the review card is, and what it is not

The card is derived from the authored document by code — never from model prose.
It carries triggers, resources, computation, outputs/effects, agent
instructions and limitations. It is a **restatement of declared configuration**,
not a correctness verdict: `assurance.runtime_findings_quality` is `not_run`
because nothing ran.

`_derive_business_review` in
`agent/src/agents/infusion/logic/tool_helpers/_workflow_business_review.py`
writes each fact in two halves:

- `summary` is for a business reader. Sources are named by the display name
  from the approval manifest (`resource_display_names`, passed in by
  `NativeProposalService.register_validated_native`), falling back to a
  humanized table name — never an id. Columns are humanized
  (`complaint_id` → "complaint ID"), conditions use the builder's operator
  labels, inclusive bounds on one column read as "between", ISO dates read as
  "1 Sep 2026", and decisions read as "If …, …; otherwise …". A summary never
  contains a node id, port name, operator token, SQL, hash or authorization
  detail; `test_no_summary_leaks_wiring_identity_or_query_text` checks every
  delivered SDK capability for this.
- `technical_details` (the node's canonical config JSON), `node_paths` and
  `binding_ids` are the exact provenance. The resource bindings themselves are
  in the snapshot's `resource_bindings`, so no fact restates them.

Limitations hold at most two caveats (results are checked only when the
workflow runs; a temporary run really sends its emails, chat messages or API
requests, or else starts straight away while the schedule or webhook applies
only once published — `_limitations`), plus any sticky notes on the canvas.

### A requested schedule or email is bound, not invented

Before a native draft is registered, `present_sdk_draft` in
`agent/src/agents/infusion/logic/tool_helpers/_workflow_plan_present.py` checks
the built document against what the request stated, using
`agent/src/agents/infusion/logic/tool_helpers/_workflow_request_requirements.py`:

- `StatedRequirements` carries a `StatedSchedule` (cadence, weekday, time,
  timezone) and a `StatedDelivery` (channel, recipient, address) beside the date
  period. A model call fills them from the words of the request, with no regex;
  each detail is filled only from words the request actually used. "Morning" is
  not a time and "me" is not an address.
- `automation_contradiction` compares them with the document in both
  directions. A requested schedule or email that the document lacks is refused,
  and so is a schedule or email nobody asked for. Only `send_email` satisfies a
  request to email; `create_asset` never does. `_schedule_disagreement` checks
  the trigger's weekday, time and timezone against the stated values.
- When the request never gave a time, a timezone or an address, the verdict's
  `needs_user` flag is set and the turn stops with a question
  (`WF_REQUEST_AUTOMATION_UNRESOLVED`) instead of guessing. The answer on the
  next turn is merged with the earlier turn, so the obligation ("every Monday")
  and the detail ("07:00 Europe/London") can come from different messages.
- Explicitly declining ("do not schedule it") clears the obligation; saying
  nothing about it on a later turn does not.

These checks run on the native draft route only. They make the saved document
carry the requested schedule and email; they do not register the schedule or
send anything.

## Run temporarily and Save inactive

A registered native proposal is **one reviewed candidate with two independent
actions**. Both name the same revision and review digest, and neither accepts
program text, replacement document bytes or source overrides.

| Action | What it does | What it does not do |
| --- | --- | --- |
| **Run temporarily** | materializes the reviewed document as an ephemeral, chat-bound definition that expires 24 hours later, compiles it, and starts one `workflow_preview` run with a manual trigger | save, publish or register a schedule. Its email, chat and API actions are sent for real, and a slides or briefing step saves its output |
| **Save** (the card's *Save workflow* button) | stores the same document as an unpublished draft and compiles it | run, publish or enable anything |
| **Save & publish**, or **Publish** on a saved card | the same Save, then — once the saved version compiles `valid` — the editor's publish route pinned to the receipt's version | run anything; publish when the compile is invalid or unsettled, or undo the Save when publishing fails |

What a temporary run does with each effect (`worker/internal/worker/`):

- **Email.** `decideEmailTransport` in `action_runtime.go` treats
  `workflow_preview` like `production`: the email is sent when the deployment
  has a workflow SMTP transport (`WORKFLOW_SMTP_HOST`), and otherwise the step
  fails with `WF_ACTION_EMAIL_TRANSPORT_UNCONFIGURED`. Builder runs send the
  same way when a transport exists and simulate when none does.
- **Chat message and API request.** Performed for real. A chat message is
  written as a bubble only when the run belongs to a workflow chat session
  (a `chat_input_trigger` run); a temporary run started from the card has none,
  so a `send_message` step succeeds and writes no bubble.
- **Slides and briefing steps** save their deck or briefing
  (`runInfusionOutputWorkflowAgent` in `agent_runtime.go`), and the step's
  output records `created_entity_id` and, when the draft had one,
  `created_entity_title`.
- **`create_asset`** is the exception: like a builder run, a
  `workflow_preview` run saves no asset, source or Store table and emits the
  upstream table instead (`isBuilderRunMode` in `create_asset_runtime.go`).
  The answer is shown in the chat from that table.

The two can happen in either order.

- **Run, then Save** keeps the same definition, version and authored document.
  Content's prepare and save both call `deriveArtifacts`
  (`content/internal/api/services/flowproposals/derive.go`), which derives the
  artifact ids from the proposal id, revision and purpose, and
  `workflow_adopt_agent_draft_save` promotes what the run already materialized:
  it clears the ephemeral flag and the expiry, and refuses ids that differ from
  the ones the run built. Nothing is authored again.
- **Save, then Run** is allowed when the server reports the candidate eligible.
  It runs the **saved** definition and version, which stay a non-ephemeral,
  unpublished draft; no temporary copy is made. The Engine normally refuses a
  `workflow_preview` run on a non-ephemeral definition
  (`WF_RUN_PREVIEW_DEFINITION_REQUIRED`). `validatePreviewRunEligibility` in
  `engine/internal/service/createrun.go` makes one exception: the version a
  saved proposal revision recorded, when the run carries that revision's
  reserved run key. The draft, manual-trigger and latest-version checks still
  apply, so a published workflow, or one edited in the builder since, is
  refused. The saved receipt stays final; a later run observation sits beside it.
- An asset a Run produced is saved through the proposal card's Save; the asset
  lineage panel offers no Save of its own.

### How a Run is carried out

The browser never starts the run itself. The card's button sends a typed
`workflow_action` on the normal authenticated Agent chat turn
(`useAssistantChat.submitWorkflowAction` → `postAgentChatTurn`). The Agent
validates it with `accepted_workflow_action`
(`_workflow_action_transport.py`) against the chat's current proposal pointer
before the turn starts, and acts on it in `workflow_plan_resolution`
(`agent/src/agents/llumen/logic/node_functions.py`). It never parses an action
out of prose. A Run or Run again is **submitted, and the turn ends**;
`submit_approved_workflow` in `_workflow_candidate_actions.py`:

1. **Prepare.** Content's `POST /api/content/internal/v1/flow-proposals/{proposal_id}/revisions/{revision}/prepare`
   (`X-Internal-API-Secret` plus the forwarded user bearer) with the workspace, the
   review digest, the expected generation and, for Run again only, a rotation
   operation id. It returns the definition, version, scope, generation and
   reserved key, the registered bytes and the execution contract. The Agent
   checks that the bytes hash to the reviewed digest and that a first Run got
   exactly the generation and key its action named.
2. builds the result gate from the execution contract **before** running, so
   bytes that no longer satisfy their own request refuse without spending the
   key;
3. **Run.** Content's `POST /api/content/v1/workspaces/{scope_id}/flow-definitions/{definition_id}/runs`
   — the editor's own run route (`BackendWorkflowClient.create_manual_run`,
   which calls content) — with `run_mode: "workflow_preview"`, the
   prepared version, a manual trigger and the reserved `idempotency_key`.

The reply is "Started a temporary run of this workflow. Its answer is posted in
this chat when the run finishes." Nothing waits on the run.

When a Run is not started, the reply is closed text chosen by the refusal's
code (`_RUN_REFUSAL_REPLIES` and `_run_refusal_reply` in `node_functions.py`);
nothing content or the Engine wrote reaches the person. A prepare refusal
carries content's own `WF_*` code. The run route relays the Engine's own
temporary-run checks (`validatePreviewRunEligibility` in
`engine/internal/service/createrun.go`) as a 400 carrying the code, so
`WF_RUN_PREVIEW_EXPIRED`, `WF_RUN_PREVIEW_DEFINITION_REQUIRED`,
`WF_RUN_PREVIEW_MANUAL_TRIGGER_REQUIRED`, `WF_RUN_PREVIEW_DRAFT_REQUIRED` and
`WF_RUN_PREVIEW_LATEST_VERSION_REQUIRED` each get their own reply. Any other
refusal from the run route is `WF_CANDIDATE_RUN_NOT_SUBMITTED`, and a 5xx or a
network failure is `WF_CANDIDATE_RUN_OUTCOME_UNKNOWN`. A code with no reply of its own gets "This workflow could not be started
as it was reviewed, so nothing ran."

The card learns the outcome from that reply. The chat hook passes the reply
that ended the latest workflow-action turn to the card
(`workflowActionReply` in `useAssistantChat.ts`, the card's `actionReply`
prop). A card waiting on its own Run reads its run once when a newer reply
arrives: a run of the requested generation means it started; no such run means
nothing ran, and the card offers Run again with the reply as the reason.
Run again resends the same reserved request, so it cannot run twice.

### Collecting the answer

The card watches the current attempt: it polls `observeProposalRun`
(`workflowProposalService.ts` — the chat's proposal list, then the editor's
run-detail route) with backoff from 2 s up to 15 s, with no hard cap, paused
while `document.visibilityState` is hidden, and stops on a terminal status
(`succeeded`, `failed`, `cancelled`, `timed_out`). When the run it was watching
finishes, it sends one `workflow_action = {kind: "collect", identity,
generation, idempotency_key}`. A card that loads with a finished run whose
answer was never posted offers **Show result**, which sends the same action.

`collect_approved_workflow` in `_workflow_candidate_actions.py`:

1. **Read the attempt.** Content's `POST …/flow-proposals/{proposal_id}/revisions/{revision}/collect`
   (`X-Internal-API-Secret` plus bearer, read-only) with the workspace, chat,
   review digest, generation and key. Content refuses an attempt that is no longer the current one
   (`WF_RUN_COLLECT_SUPERSEDED`) or a revision of another chat, and returns the
   registered bytes, the execution contract, the attempt's definition and
   version, the run started under the key (or none) and whether its answer was
   already collected. Prepare is not called and nothing is submitted.
2. **Read the run once.** A run that has not finished answers "still running";
   an attempt with no run answers that none was found. A finished run is read
   once (`read_run_outcome` in `_workflow_sdk.py`); its rows must name the
   attempt's run, definition and version, and the result gate compares it with
   the execution contract. A correct run id on the wrong version delivers no
   answer.

   A **failed** run is not thrown away. `_produced_part` in `_workflow_sdk.py`
   reads the part of it that finished — its succeeded steps and their outputs —
   as a finished run, and keeps each declared answer whose own terminal step
   succeeded, since every step it reads from ran before it. Those answers are
   measured, gated and shown exactly as a succeeded run's are, and the reply
   adds "The run then stopped at a later step: …", naming each failed step the
   way the person reads the workflow (the email with its subject and
   recipients, the AI step, the chart by its title) and its reason
   (`step_failure_text` and `_failed_step_clause` in
   `_workflow_candidate_actions.py`). `WF_ACTION_EMAIL_TRANSPORT_UNCONFIGURED`
   reads "because no email transport is configured on this deployment"; any
   other failure quotes the error the step recorded. When no answer was produced
   before the failure, the reply says the run failed before it produced a
   result, and offers "You can run it again from the card" unless every failure
   is one a rerun cannot fix (`_RERUN_CANNOT_FIX`). When the unsent email or chat
   message was itself the result, the reply first shows what it would have said:
   its text with each `{{alias}}` filled from the values the referenced step
   produced, laid out as the worker lays them out (`render_message_text`, see
   [ancestor-refs.md](ancestor-refs.md)), noting when only the first of many
   values were available or when part of it was written by an AI step
   (`_unsent_message_text`).
3. **Record, then post.** `POST …/revisions/{revision}/collected` sets
   `result_collected_generation` by compare-and-set
   (`workflow_mark_agent_draft_run_collected`). Only the caller that wins posts
   the answer; every other caller — a second tab, a reload — is told it was
   already posted. The snapshot's `run_observation.result_collected` then hides
   Show result.
4. **Show the answer as a chat asset.** The winner's delivered answers
   (`_workflow_answer_display.py`, a list in answer order; one today) are shown
   the way the chat shows its own assets: each answer's rows go through
   `query_display.save_asset_data_and_reference` into the chat's data ledger,
   and a `render_asset` command (`origin: "workflow_run"`) references them by
   `data_message_id`. Its configuration comes from the answer's `create_asset`
   node — the catalog chart type, the axes and mapping, and the node's name as
   the title — and falls back to a data table when the rows cannot draw it.
   The answer's own `create_asset` preview is dropped; supporting visuals keep
   theirs. The text reply stays short (what was computed, the row count and the
   caveats), and the AI-step narrative is placed under its card. A chart's rows
   are put in time order when its category axis holds dates; any other axis
   keeps the answer's order. A type the catalog colours only per category (the
   pie) gets that colouring and a legend, as a chat pie does. A map layer with
   a mapped value is coloured by it, `sequential` with stops at the rows'
   quartiles (`_value_colours`; the editor's test-run preview writes the same
   block in `mapLayerPreview.ts`), and a heatmap keeps its density ramp. A
   saved run writes the same block onto the map-layer asset: the worker reads
   the mapped columns' quartiles from the full output
   (`mapValueQuantiles`, `worker/internal/worker/create_asset_map_values.go`)
   and content builds `configuration.colors` from them
   (`mapValueColours` in `content/internal/api/services/assets/workflow_create.go`),
   refreshing it on each re-run unless the author restyled the layer. The
   worker's preview sample of a date axis is its latest 50 periods in date
   order (`previewOrder.sampleQuery` in `worker/internal/worker/preview_order.go`),
   and a categorical chart's is its 50 largest categories. The card holds
   the rows the run handed back, which is the worker's preview sample. When
   that is fewer than the run produced, a table says "Shows 50 of the 541 rows
   this workflow run returned." and a chart or map says "Preview of 50 of 541
   rows. Save and run the workflow to see the full chart." (`sample_sentence`),
   on the card and in the reply. The "requested period" coverage caveat is
   stated only when the answer declared a period or the request asked for one.
   The AI-step prose is not in the reply's text, so the saved assistant message
   keeps it as `answer_narrative` (`_collected_narrative` in
   `agent/src/agents/llumen/logic/node_functions.py`, persisted by
   `build_ai_message`). Later turns read it in their history beside that turn's
   text, as `resolved_queries` are read (`_ai_content_with_resolved_queries` in
   `agent/src/api/routers/agent.py`), so a follow-up such as "why was the 28th
   unusual?" has what the AI step said. The answer's rows go into that history
   too, as a plain-text table (`answer_rows_record` in
   `_workflow_answer_display.py`) written the way the card shows them: numbers
   with thousands separators and at most two decimals (two significant digits
   under 0.01), and timestamps as a date, with the time of day only when it has
   one. A follow-up then repeats the figures the person saw.

   **AI step text is read whole.** A step output's preview holds only the first
   4 KiB of its document. When the output is larger than that snippet,
   `step_output_document` in `_workflow_sdk.py` reads the whole JSON document
   through content's
   `GET /api/content/v1/workspaces/{ws}/flow-runs/{run}/documents/{artifact_id}`
   (`BackendWorkflowClient.get_run_document`), which content serves from the
   storage service's `POST /api/storage/internal/workflow-run-output/get`. A
   long AI reading is then shown in full rather than cut off or dropped.

   **Saved decks and briefings are linked.** A slides or briefing step's
   output carries the id the worker saved the entity under
   (`created_entity_id`) and its title (`created_entity_title`). The reply
   shows "This run saved the slides deck "<title>": [open it](/slides/<id>)" (or
   `/briefings/<id>`) outside the unverified AI label (`_created_entity_line`),
   and the step's own prose is taken from the `narration` of its JSON envelope,
   never the raw JSON (`_output_agent_prose`). Ids the model itself wrote are
   never linked.

An analysis that only acts has no answer to check: its outcome is what it sent
(`effect_result_decision` in `_workflow_request_conformance.py`). The reply says
which arm ran and what it sent ("The workflow ran: usage was 3,500, so it took
the branch that emails ops@example.com."), that an unconditional action ran, or
"The workflow ran. The condition was not met, so nothing was sent." The arm is found by what its action does,
so two arms that both email are told apart. An arm that stops does nothing: its
decision channel is left unconnected, the run succeeds, and the reply reads
"The workflow ran: usage was 1,200, so nothing was sent." (`routed_arm` in
`_workflow_sdk.py` reports it with kind `ARM_DOES_NOTHING`). It is never
lowered to `stop_error`, which fails the run, and a program that puts one there
is refused (`decision_arms`). "Otherwise do nothing" said in one turn is often
a filter on the measure in front of the action rather than a decision; when
that filter keeps no row, `routed_arm` reports its discarded row the same way
and the reply states the value it tested in the same words. Only a filter that
tests no measure (a row filter) keeps the plain "condition was not met" reply.

Each refused result is logged once as a `[workflow_result_gate] rejected:` line
with its closed reason and code (`_result_rejected`); the person is told only
that the result did not match, so that line is where the cause is kept.

The run observation in the snapshot is paired strictly with the current
attempt's reserved key (`reserved_run_generation` / `reserved_run_idempotency_key`),
so after Run again the previous attempt's run is never shown or collected as the
new one.

In content, the prepare route (`FlowProposalsHandler.Prepare` in
`content/internal/api/handlers/flow_proposals.go`) reads the revision through
`LoadReviewed` (`content/internal/api/services/flowproposals/service.go`,
owner **and** destination, review digest checked, stored bytes re-hashed), and
then `Service.Prepare` runs one fixed order: reserve approval in the database →
store and verify the bytes → materialize → compile. Store and materialize are
skipped when an earlier run or a save already materialized the revision. It
starts nothing. Access is the workspace write scope (`flows.ResolveScope`),
exactly as for an editor run; there is no separate per-source check (see
[../services/content.md](../services/content.md)). A definite refusal is a 409
carrying its `WF_RUN_*` code (`WF_RUN_ENGINE_UNAVAILABLE` is a 503); an unclear
failure is a 503 `WF_RUN_PREPARE_UNAVAILABLE` that is safe to retry, because
every step is idempotent for the same expected generation or rotation id.

The run route (content's `FlowsHandler.CreateRun`, gated by the
`workflow_runs` licence feature) passes `workflow_preview` through and targets
the latest version; the Engine accepts it only for a temporary definition or a
saved proposal's definition and decides expiry, draft status and the
latest-version rule. Content forwards the optional `idempotency_key` to the
Engine, whose active-run guard ignores a run carrying that same key, so a
retried request gets the run it already started instead of a 409.

The snapshot carries the reserved key as `reserved_run_idempotency_key` (the
run counterpart of `reserved_idempotency_key` for Save), and the card sends
exactly it on a first Run; Run again gets a fresh key from the rotation instead.
The Engine's unique index on `(workflow_definition_id, idempotency_key)` is what
makes one generation produce at most one run.

### Who decides whether Run is offered

Run availability is derived by the database in `workflow_agent_draft_ui_state`
(`supabase/migrations/004_functions.sql`) and delivered in the proposal
snapshot as `run_availability`: `eligible`, `unavailable` with a closed reason,
or `expired`. The frontend does not guess it from a badge, and a missing or
unreadable value never enables the button. Today the function emits these
reasons, in this order:

| Condition | Result |
| --- | --- |
| the temporary candidate was swept | `expired` |
| the revision was rejected or superseded | `unavailable`, `version_changed` |
| no execution contract was registered | `unavailable`, `execution_contract_missing` |
| the materialized version failed to compile | `unavailable`, `compile_invalid` |
| otherwise | `eligible` |

A compile that is still **pending is not a reason to refuse**: an approved Run
compiles first. The protocol also defines `trigger_input_unsupported`,
`capability_unavailable`, `binding_changed` and `not_authorized`
(`contracts/workflow_proposal_protocol.json`), but the read function does not
emit them yet.

The execution contract is the request derived from the built program and
round-trip checked against it (`CandidateExecutionContract` in
`agent/src/agents/shared/workflow_candidate_contract.py`), bound immutably at
registration (`execution_contract_for` in `_workflow_candidate.py`). A program
whose request cannot be derived or checked gets a `FactsExecutionContract`
instead: the answers its document stamps, rebuilt from the approved bytes at
Run (`facts_contract_for`). Only a document whose answer blocks cannot be read
registers with no contract; `execution_contract_missing` is what such a
revision reports, rather than being run unchecked.

### Recovery: unknown is checked, never retried as new

If a reply is lost, the run may already exist. Nothing is retried as a new run:
the same key can only ever name one run. After a Run was sent, the card watches
the run and also offers **Check run status**, never a fresh Run. Both are
strictly reads (`observeProposalRun` in `workflowProposalService.ts`): they
re-read the chat's proposal list, take the exact revision's `run_observation`
(its `run_id`, generation and key, which must equal the snapshot's reserved
ones), and read that run through the editor's own run-detail route
(content's `GET /api/content/v1/workspaces/{scope_id}/flow-runs/{run_id}`). A snapshot with no
run yet stays recoverable; absence is not proof that a delayed request will not
arrive. If the chat turn carrying the action could not be sent, the card's retry
reuses the same key and rotation id (`handleRun` in `WorkflowProposalCard.tsx`),
because a send that looked failed may still have reached the Agent.

**Run again** is a new generation, not a retry. Its prepare call carries the
expected generation and its own rotation operation id, and no key.
`workflow_reserve_agent_draft_preview_run` rotates only after the **current
attempt's** run — the run started under the reserved key — is terminal
(`succeeded`, `failed`, `cancelled` or `timed_out`). Replaying the same rotation
id returns the generation and key it already minted.

When a temporary candidate expires, the Engine sweeper
(`engine/internal/service/preview_sweeper.go`) deletes it only if it still has
no active run, and writes `candidate_expired_at` on the revision in the same
transaction. That marker survives the deleted run rows, so a late dispatch is
refused and the card shows `expired`.

### The graph the card shows, and the bytes it never sees

**Show workflow graph** on the card reads
content's `GET …/flow-proposals/{id}/revisions/{revision}/graph?review_sha256=…`
(`FlowProposalsHandler.Graph`, built by `RedactedGraph` in
`content/internal/api/services/flowproposals/service.go`). It is bound to the exact
revision and review digest, so a stale card cannot read a newer graph. It is a
redacted projection built from an allowlist — `id`, `kind` and `name` on nodes;
`id`, `source`, `target` and the two handles on edges — so configuration,
connection options, headers and bound resource ids never reach the browser. The
frontend re-applies the same allowlist. Reading it uploads, materializes and
compiles nothing. `WorkflowCandidateInspector.tsx` draws it without the builder
shell or autosave.

The canonical document bytes cross only a service boundary: the prepare and
collect routes above, under content's `/api/content/internal/v1/flow-proposals`.
They need `X-Internal-API-Secret` **and** the forwarded user bearer, refuse a stale
review digest (`WF_RUN_REVIEW_MISMATCH`), and are the only routes that return
the bytes or the execution contract. Every browser-facing proposal route stays
free of both.

### What is not yet proven

- **The graph route has not been read in a running product.** Run, prepare,
  collect, Save and Publish have been exercised live from chat; reading a
  proposal through the graph route is proven by route tests only.
- **A saved version that was never compiled stays uncompiled.** Its
  `compilation_status` remains `pending`. The builder says so and refuses Run,
  Execute Node and Publish for it without sending a request, but there is no
  in-product way to compile it.
- **An answer is posted only while someone is looking.** The collect action is
  sent by the card, so a run that finishes with no chat open is collected when
  the chat is reopened (the card offers **Show result**), not before.
- **An action after a truncated read still runs.** The result gate withholds an
  answer computed from a read cut at the runner's row ceiling
  (`WF_REQUEST_RESULT_INCOMPLETE`), but it acts only on the chat reply. An
  email, chat message or API call downstream of such a read is sent by the
  run itself; the reply then adds a sentence that what it sent was partial
  (`_partial_note` in `_workflow_request_conformance.py`), on both the typed
  and the facts contract path.

### Gates

- `make test-workflow-proposal-contract` — Agent, Content and Frontend proposal
  suites, with the test collection asserted and any skip failing the gate.
- `make test-workflow-proposal-postgres` — the register/invalidate/prepare/
  save/collect transactions against a disposable Postgres container, driven
  through content's proposal service by the Go integration test
  `TestProposalLifecyclePostgres`
  (`content/internal/api/services/flowproposals/lifecycle_integration_test.go`).
  Separate on purpose:
  atomicity cannot be shown with doubles, and folding it into the umbrella would
  let a green report stand in for a database that was never reachable.

## Temporary definition lifecycle

A Run materializes the reviewed revision as a hidden ephemeral definition with a
24-hour lifetime, bound to the chat by `ephemeral_chat_id`. A `workflow_preview`
run analyses data and produces transient visual output. It does not materialize
schedules or webhooks and does not persist workflow-generated asset rows, but it
does perform its email, chat and API actions and saves any slides deck or
briefing (see [Run temporarily and Save inactive](#run-temporarily-and-save-inactive)).
The engine sweeper removes expired temporary definitions and short-lived
artifacts, and marks the revision `candidate_expired_at`; the proposal's Save
adopts the same definition, clears the ephemeral state and protects the draft
from that sweeper.

## User interface contract

The chat is an answer surface, not a second workflow editor.

- Every workflow request displays the typed **workflow proposal** card
  (`WorkflowProposalCard.tsx`). The card is bound to a registered proposal
  identity, so each action names a revision rather than asking the model to
  author one again.
- The card keeps independent sections for the review, Save, compilation and
  Run (`workflowProposalSections.ts`). *Save workflow* and *Run temporarily*
  are gated separately: a saved card still shows an eligible Run, and *Run
  again* appears only after the current run is terminal. While a run is live
  the card says the answer will be posted in the chat when it finishes; a
  finished run whose answer was never posted offers **Show result**. See
  [Run temporarily and Save inactive](#run-temporarily-and-save-inactive).
- Above the review, **You asked** lists the user's asks in their own words
  (the `asked` prop, from `workflow_asked`), or a notice that the request could
  not be read back; a proposal with neither hides the section.
- The review is titled *What this workflow does*. Each non-empty section has a
  plain heading — *When it runs*, *Data it reads*, *What it calculates*, *What
  it produces*, *AI steps*, *Good to know* — and shows only the fact summaries.
  Node paths, binding ids and technical details stay in the review model (they
  are part of the hashed, approved review) but are never rendered.
- The status chip reads *Not saved*, *Draft* or *Published*; the compile chip
  reads *Checking…*, *Ready*, *Has errors* or *Couldn't check*.
- Buttons, by state (the Run buttons are unaffected by any of these):

  | Card state | Buttons |
  | --- | --- |
  | Not saved | **Save workflow** · **Save & publish** |
  | Saving / publishing | the clicked button reads *Saving…* or *Publishing…*; both are disabled |
  | Saved draft | **Open workflow** · **Publish** |
  | Save & publish stopped at a draft | **Open workflow** · **Publish**, with *Saved as a draft — it has errors to fix before publishing* (compile invalid) or *…it couldn't be published yet* (compile unavailable or unsettled after the 60 s compile poll) |
  | Publish refused | **Open workflow** · **Publish**, with a plain message: 403 no permission, 409 changed (open it to publish), 402 licence, 400/422 errors to fix, anything else *try again* |
  | Published | **Open workflow** · a non-clickable *Published* status |
  | Edited in the editor since the save | **Open workflow** only, with *Edited in the editor* |

  *Open workflow* navigates to `/workflow/{definition_id}?workspace=…&workspaceType=…`
  (`workflowEditorHref`). Publishing calls `publishSavedProposal` in
  `workflowProposalService.ts`, which sends `workflowService.publishDefinition`
  with the receipt's `version_id`, so a newer, unreviewed version is never
  published from the chat. A card reloaded after its save reads the definition
  once (`readSavedWorkflowPublication`) to learn whether it is published, or
  whether its `latest_version_id` has moved past the receipt's version. Publish
  happens only from a button click on the card, never from a typed chat reply,
  and a failed publish leaves the saved draft exactly as it was.
- Workflow-created assets use an **Asset / Workflow** inspector rather than a
  misleading source SQL tab.
- The Workflow inspector shows the complete authored graph read-only, highlights
  the producing `create_asset` node and all of its upstream edges/nodes, and
  mutes unrelated branches.
- The graph is loaded by exact definition version, not the latest document, so
  it matches the asset the user is inspecting.
- Only generic node status/duration/row-count information is shown in the
  compact details tray. Editing stays in the Workflow Builder after Save.
- If a temporary definition expires while the card or inspector is open, its
  actions disappear. Chat never exposes edit/publish controls for it, and the
  asset lineage panel offers no Save: an asset a Run produced is kept through
  the proposal card's Save.

The implementation lives in `WorkflowProposalCard.tsx`,
`workflowProposalSections.ts`, `workflowProposalService.ts`,
`WorkflowAssetLineagePanel.tsx`, `workflowLineage.ts`,
`ComponentDetailPanel.tsx`, and the assistant reply adapter/types.

## Operational dependencies

- Agent image must contain `workflow_sdk/` and shared `contracts/`.
- Source summary/profile layers must be available through the normal agent
  summary access path.
- Content's internal proposal routes (register, prepare, collect, collected)
  and the engine/worker services must be reachable with the ordinary internal
  service credentials (`INTERNAL_API_SECRET` on the agent and content).
- Redis/object storage support run artifacts and asset-cache reads; no
  workflow-created file/source/Store-table is created for visual assets.

## Validation checklist

- agent tests for grounding, source markers, authoring/retry, routing, and
  result channel selection
- `make test-sdk`, `make test-agent`, `make test-engine`, and `make test-worker`
  after cross-boundary changes
- manual smoke: attach a real source, ask a dependent analysis without the word
  “workflow,” press Run on the card and verify the turn ends at once and the
  answer is posted when the run finishes (and only once with two tabs open);
  then ask an explicit automation, save it, open its draft, and verify Save
  alone ran nothing
- ensure generated chat content does not contain a fake “Generated Query” text
  block or raw model/tool envelope

## Integration map

- [authoring-sdk.md](authoring-sdk.md) — constrained builder and source schema.
- [schedules.md](schedules.md), [webhooks.md](webhooks.md), and
  [action-nodes.md](action-nodes.md) — trigger and action runtime.
