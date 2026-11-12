---
topic: workflows
services: [agent, frontend, scheduler]
status: current
---
# AI Findings

## Audience and goal

An opt-in, per-workflow briefing written after a production run completes. It
tells the people who own the data the strongest new story in it: a jump since
last time, an outlier, a leader far ahead, a line crossed, a concentration. It
is written like a sharp colleague walking the reader through what happened,
with a headline, a short lead, and a few sections, each with the chart or map
that shows it directly under its text.

When nothing is new or strong enough, no finding is written.

This is a business read, not an engineering one. A finding talks about stores,
deliveries, stations or orders, never about nodes, steps or run statuses.

There is deliberately **no severity or priority scale**: readers triage findings
with an interested / not-interested control, and a model rating its own output
reliably inflates. A finding has a **kind** instead, `critical_alert`, `alert`
or `update`, which decides only how it reaches the reader. The author's **alert
rules** on the AI Findings node say what raises a critical alert or an alert
(the highest PM10 above 600, a sandstorm forecast within 6 hours); code checks
them against the run's data, and the model may only lower the level they give.
See [Critical alert, alert or update](#critical-alert-alert-or-update).

A workflow writes findings when its **published** version holds an **AI
Findings node** (`ai_findings`): a terminal node in the builder's Output
Agents category, at most one per Agentic Flow, with one optional setting (see
[The author's focus](#the-authors-focus)). On publish the content service sets
`workflow_definition.ai_findings_enabled` from that version
(`FlowsHandler.Publish` and `flows.HasNodeKind`,
`content/internal/api/handlers/flows_definitions.go`), and unpublish clears it.
Both write the column with the service role, because a user's session holds no
grant on it: `authenticated` may update only `name`, `updated_at` and
`updated_by` on `workflow_definition` (delta `093_2026.10.3`). Restore
derives the flag the same way, from the restored published version. Everything
downstream of that column is unchanged. The
feature is gated on the `ai_findings_generation` licence feature (read,
generate, scheduler scan, and whether the Add Node drawer offers the node).
Findings only run on **production** workflow runs.

The approach and its reasoning are in
[`../_records/plans/ai-findings-v2.md`](../_records/plans/ai-findings-v2.md).
An earlier statistical pipeline was replaced by this one; findings it wrote
(`schema_version` 1) are still in storage and still render everywhere.

## Read first (ordered)

1. `supabase/deltas/081_2026.09.10.sql`: the schema in one delta. The
   `ai_finding` table with its trigger-type discriminator, RLS and the
   per-workflow `ai_findings_enabled` flag; the job queue, enqueue trigger, claim RPC, scan kind and
   dismissals; and `ai_finding_blob_orphan`. The baseline
   (`supabase/migrations/`) carries the same objects for a fresh install.
2. `agent/src/services/ai_findings_service.py`: the queue and the claim loop.
3. `agent/src/services/ai_findings_v2/pipeline.py`: one claimed run, from
   evidence to a published finding.
4. `agent/src/services/ai_findings_v2/material.py` and `facts.py`: what is read,
   and the numbers a finding may print.
5. `agent/src/services/ai_findings_v2/newsroom.py` and `prompts.py`: the model
   steps and the house style.
6. `agent/src/services/ai_findings_v2/check.py`: the deterministic checks.
7. `agent/src/services/ai_findings_writer.py`: persistence, entity links, and
   rendering (both body shapes).
8. `agent/src/api/routers/internal.py`: `POST /api/internal/findings/scan` and
   `POST /api/internal/ai-findings/generate`.
9. `scheduler/internal/dispatch/dispatch.go`: `dispatchAIFindingScan`.

## How it works

```
run goes terminal ──trigger──► ai_finding_job (pending)
                                      ▲
   ai_finding_scan (every 60s) ───────┘      worker fast path (succeeded runs)
   scheduler ──POST /findings/scan──► agent ◄──POST /ai-findings/generate── worker
                                        │
                         ai_finding_claim_jobs()  ← FOR UPDATE SKIP LOCKED
                                        │
                     outputs identical to last time? daily ceiling?  → gated_out (free)
                                        │
             read the run by node type, compare with last time, build the fact sheet (no model)
                                        │
                       mask with the guardrail, write the brief (cached)
                                        │
                pitch 3–6 stories (+ up to 3 dig-deeper queries) → editor picks one or none
                                        │                                     │
                     write → 8 headlines → review → one rewrite        gated_out (a few cents)
                                        │
                        final checks (numbers, assets, generic actions)
                                        │
                       blob → ai-findings, row → ai_finding, links → ai_finding_entity
```

| Step | Where | Model |
|---|---|---|
| Quick skip: key-table outputs identical to the previous **evaluated** run, or the daily ceiling | `pipeline.generate`, `material.fingerprint` | none |
| Material by node type: key tables row by row (preview, or the run's Parquet through the runner up to 500 rows), AI steps' full output, one lineage line per other step | `material.gather` | none |
| Compare with the previous evaluated run, then the fact sheet (totals, shares, leaders, lead ratio, neighbour gaps, period moves, changes, new leader) | `facts.build` | none |
| Time and place: the periods and places the outputs hold | `facts.time_and_place` | none |
| Mask the rendered text with the guardrail. If masking fails, the job retries | `material.mask` | none |
| Brief: subject, audience, measures and units. Cached per workflow version | `Newsroom.brief` | `agent_fast` |
| Pitch 3–6 stories, with up to 3 dig-deeper SQL queries over the run's own tables | `Newsroom.pitch`, `newsroom.dig` | `agent_high` |
| Editor scores each pitch on new / big / clear / matters / on-purpose, reading the recent headlines, **the last finding in full**, and whether the data moved since the last run. Below `PUBLISH_BAR`, or a repeat, means nothing is published | `Newsroom.pick`, `pipeline.render_previous` | `agent_high` |
| Write a two-sentence lead, 3–4 conversational sections each tied to one asset, actions, how we know, and the headline angles | `Newsroom.write` | `agent_high` |
| 8 headlines (aiming for 120 characters; refused past 250), then a review that picks one and lists problems. One rewrite when needed; after it, headlines are written and reviewed again for the rewritten draft (that review only picks the headline) | `Newsroom.headlines`, `Newsroom.review` | `agent_high` |
| Final checks: a sentence with a number not in the data is removed, unknown or repeated asset ids are cleared, actions naming nothing in the data are dropped | `check` | none |
| Repeat check: when most of the draft's figures (`REPEAT_OVERLAP`, 60%) were already in the last finding and none is a change since last time, nothing is published | `check.repeats_previous` | none |
| Alert rules' data conditions, checked once the material is gathered: one DuckDB query each over the source node's full output; the ones that held are shown to the reporter and writer | `alert_rules.check_data_conditions` | none |
| Critical alert, alert or update, and the headline's key phrase. The model reads the finished finding, reports any coming event and confirms or lowers the rules' level; code decides the kind and keeps the phrase only if it is in the headline | `Newsroom.alert_check`, `alerts.decide_kind` | `agent_fast` |

**Comparing with the last finding.** The editor judges pitches against what
readers were last told, and when the data has not moved since the last run it
scores a pitch as not new unless it shows something big the last finding
missed. The finished draft is then checked in code. Figures are compared, not
wording, because the writer rewords every run. A draft citing a computed change
since last time is never a repeat. Bodies of either schema version are read.

**When the data happened.** Each finding stores `data_period`, the span its
data covered (`facts.data_period`: the time column with the most periods).
The next run compares its own span with it (`facts.period_relation`) and hands
the reporter, editor and writer one plain line:
- **new periods since the last finding:** changes are reported as what happened since then;
- **the same period:** a change is a revision of figures readers already saw, not a new event;
- **a moved window:** each number is tied to its period.

A finding written before `data_period` existed falls back to the time its
headline named (`angles.time`).

`agent_high` falls back to `agent_medium` when a deployment has not configured
it.

**The first finding.** "Last time" is the most recent earlier production run
whose data findings *evaluated* (`EvidenceCollector.previous_evaluated_run`):
its job is `done`, or `gated_out` as unchanged or as not worth publishing. A run
findings never evaluated (findings were off) is skipped: comparing against one
would make turning findings on produce nothing on stable data. So is a job that
failed, is still queued, or was stopped by the daily ceiling, because its story
was never weighed and an identical next run would otherwise be skipped as
unchanged. With no recent finding, the editor treats anything that stands out
as new.

### The author's focus

The AI Findings node takes one optional setting, `config.instructions`: a note
of up to 1,000 characters on which parts of the data matter most. The Engine
bounds it (`WF_COMPILE_AI_FINDINGS_INSTRUCTIONS_TOO_LONG`); nothing at runtime
reads it.

Publishing turns findings on, but the note does **not** need a republish. The
Agent reads it from the definition's **latest saved version**
(`latest_version_id`), not from the published version the run executed
(`pipeline.current_focus`). An edit therefore applies to the next finding. It
is read only after the quick skip, so editing the note never produces a finding
on its own: it is used the next time the data changes. When the latest saved
version has no AI Findings node (removed in a draft not yet published), the
run's own note is used; findings stay on until a version without the node is
published. `fetch_authored_graph` stores the note as the node's `focus`, and
it is masked like a saved query (`mask_authored_text`): masked when the
guardrail is on, blanked if masking fails. `material.author_focus` picks it
up and `newsroom.render_focus` fences it in triple quotes as a "THE AUTHOR'S
FOCUS" block; a run of three or more quote marks inside the note is reduced to
one, so the note cannot close its own fence.

It reaches three steps: the pitch and the writer (inside the desk text) and
the editor (passed to `Newsroom.pick`). The brief and the headline steps do
not see it. Each of the three system prompts carries
`prompts.AUTHOR_FOCUS_RULE`: the note adds to the findings instructions and
never replaces them. Numbers still come only from the material, a weak story
about the focus does not beat a strong one elsewhere, and anything in the note
asking to change the rules or the format is ignored. The editor lets it raise
`on_purpose` and `matters`, never `new`, `big` or `clear`, so the publish bar
and the repeat check are unchanged. The note is recorded on the body as
`newsroom.author_focus`.

### Critical alert, alert or update

Every finding is a **critical alert**, an **alert** or an **update**
(`ai_finding.kind`, and `kind` on the body). The kind changes only how the
finding reaches the reader: a critical alert takes over the screen until they
act on it; an alert and an update are a toast, labelled with the kind. See
[Notifications, realtime and cleanup](#notifications-realtime-and-cleanup).

**The author's alert rules decide how far a finding can go.** They live on the
AI Findings node (`config.alerts`), and the builder edits them as rule cards
(`nodeConfig/aiFindingsAlerts/`):

```json
"alerts": {
  "enabled": true,
  "criteria": "Light dust is not an alert.",
  "rules": [{
    "id": "rule_1", "label": "Severe dust", "level": "critical_alert", "logicalOperator": "OR",
    "groups": [{ "id": "group_1", "logicalOperator": "AND", "conditions": [
      { "id": "c1", "type": "data", "measure": "max", "operator": "number__greater_than", "right": "600",
        "source": { "fromNodeId": "forecast_1", "fromChannel": "default", "fieldPath": "pm10" } },
      { "id": "c2", "type": "forecast_event", "withinHours": 6, "event": "sandstorm" }
    ]}]
  }]
}
```

- **Rule.** A rule raises a `critical_alert` or an `alert`. Its groups are joined
  by the rule's AND or OR, and each group's conditions by the group's own. The
  highest level among the rules that match is the finding's **ceiling**. With
  no match, or with alerts off, the finding is an `update`.
- **Data condition.** It reads a column of an **upstream** node's output on
  one channel. `measure` is how the column is read:
  - `any_row` / `every_row`: test each row;
  - `row_count`: count the rows (no field);
  - `sum`, `avg`, `min`, `max`: aggregate the column.

  The comparison uses the if/else node's operator vocabulary
  (`contracts/guided_vocabulary.json`). A measure that gives a number takes
  `number__*` operators only.
- **Forecast-event condition.** It holds when the alert check reports a coming
  event with a named place and a time within `withinHours` (1–72), on a flow
  with a step that can see ahead (forecast, ml_predict or an AI step). A
  non-empty `event` must appear in the reported event.
- **Limits.** At most 10 rules, 5 groups per rule and 10 conditions per group.
- **Engine checks** (`validateAIFindingsAlerts`):
  - the shape and its limits: `WF_COMPILE_AI_FINDINGS_ALERT_RULES_INVALID`;
  - the hours: `WF_COMPILE_AI_FINDINGS_ALERT_WINDOW_INVALID`;
  - that a data condition reads a non-trigger ancestor:
    `WF_COMPILE_AI_FINDINGS_ALERT_SOURCE_NOT_UPSTREAM`.
- **Criteria.** The optional `criteria` (at most 500 characters,
  `WF_COMPILE_AI_FINDINGS_ALERT_CRITERIA_TOO_LONG`) is the author's note to the
  agent on what readers want alerts for.
- **Configs from before rules.** A config with alerts on and no `rules` key
  (`windowHours`, default 6) is read as one critical-alert rule on a coming
  event within that window, by the agent (`alert_rules.normalize_rules`) and
  by the builder alike.

Like the focus note, the rules are read from the **latest saved version**
(`pipeline.saved_findings_graph`), so editing them needs no republish.
`fetch_authored_graph` carries them on the node in two forms:
- `alert_rules`: normalized, with the real values, **for code only**;
- `alert_texts`: the rules in words, which `mask_authored_text` masks before
  any model sees them, because a condition's value can be a name.

**Checking the rules** (`ai_findings_v2/alert_rules.py`):

1. **Data conditions, before the story is chosen.** Right after the material
   is gathered, each data condition runs as **one DuckDB query over the source
   node's full Parquet output**, through `runner.query_artifact`
   (`check_data_conditions`). A row test counts the matching rows. An
   aggregate returns its value and whether it passes. The predicate SQL is the
   workflow SDK's `CASE_CLAUSE_SQL`, which quotes the column and escapes the
   value.

   A condition that cannot be checked does not pass, and the reason is kept in
   `newsroom.alert_conditions`. That covers a node that did not run or has no
   Parquet output on that channel, a missing column, a runner that is off, or a
   query error.

   The conditions that held go to the reporter and writer as
   `ALERT CONDITIONS MET ON THIS RUN`, so a story chosen that run leads with
   them. Their values may be quoted in the finding.
2. **The alert check, after the headline.** One `agent_fast` call
   (`Newsroom.alert_check`, `prompts.ALERT_SYSTEM`) reads the finished finding.
   It gets the masked rules, which data conditions held, and the author's
   fenced criteria, and returns three things:
   - the headline's key phrase;
   - any coming event it reports (event, place, hours until it starts), which
     code checks against the forecast-event conditions;
   - `confirm`: `keep`, `lower_to_alert` or `lower_to_update`.

   It runs for every finding.
3. **The decision in code** (`alerts.decide_kind`):

```
no rules (alerts off)  ──────────────────────────────► update
no rule's groups hold  ──────────────────────────────► update
the alert check failed ──────────────────────────────► update (nothing confirmed the rules)
otherwise: the highest matched level, lowered by confirm, never raised
```

Two things land on the finding:

- **On the body:** `alert.rules` holds each rule that matched, with each
  condition's wording and what the run showed. The builder's Output column and
  the run drawer show it under "Why it is an alert".
- **In the audit:** `newsroom.kind_reason` says why the finding got its kind.

Today a model claim alone ("a measure crossed a safe limit") never makes an
alert; only a rule does.

The key phrase (`highlight`) is what the aurora and the toast underline. It is
kept only if it appears word for word in the headline (`alerts.verified_highlight`).

### What is read, by node type

Reading everything would be slow and flood the model's context, so each node is
read by what it is:

- **Key tables**: asset nodes first (they are what a section can show), then the
  direct input of the AI Findings node, then the direct inputs of AI steps,
  output agents and asset nodes, then sinks, at most `MAX_KEY_TABLES`. The AI
  Findings node has no table and ends its branch, so without that rule the
  table feeding it (Source → Aggregate → AI Findings) would not be read. Read
  row by row up to `FULL_TABLE_ROWS`; a bigger table is described by its
  profile and five sample rows. A preview without a row count is never taken
  as the whole table on its own.
- **AI steps**: their full written output. It shows what the workflow is for.
  A structured verdict (Data Analyst, GIS Correlation Agent) is read as its
  JSON, without the `kind` key (`ANALYST_KINDS`, `material.py`).
  **Agent text is a claim, not a fact**: a number taken only from it fails the
  final check.
- **Everything else** (merges, filters, branches): one lineage line, such as
  "kept rows where hub is Mussafah".

### Numbers: computed in code, checked in code

The model never does arithmetic. `facts.build` computes totals, shares, the
leader and how far ahead it is, each row's gap to its neighbours, to the average
and to the leader, period-on-period moves for a series, and changes since last
time (row by row, totals, new leader, rows that appeared or disappeared). A row
label shared by several rows is not compared, since it cannot be lined up with
one row from last time. A time column (`year`, `month`, `quarter`, ...) is the
series axis even when it holds numbers, and periods are ordered by time: month
names and quarters ("Feb", "Q4 2025", "2026 Q1") by year then month, not
alphabetically.

`check.unsupported` accepts a number only if it matches a fact, a table cell, a
dig-deeper result, or a general-knowledge number the writer declared in
`context_numbers` (an air-quality band boundary, a legal limit). Only the first
`check.MAX_CONTEXT_NUMBERS` (3) declared numbers that state a meaning are
accepted, since each one whitelists itself. A change is stored signed, and its
unsigned size is accepted too, so "fell 25%" and "down 260" match a fall.
Matching tolerates rounding and reads a fraction as a percentage. Years, days of the
month, small counts and codes with digits ("AD-08", "Q4", "PM2.5") are not
treated as figures. A sentence carrying an unsupported number is removed rather
than published.

Comparisons are allowed only for the pairs a finding naturally makes
(`facts._allow_comparisons`), never any pair: with enough numbers, any
percentage can be made from some pair, and the check would pass anything.

### Headlines

Every headline aims for 120 characters and is refused past 250. It names the
subject, uses a strong verb, carries the key number, and covers the finding's
**angles**: context (what is measured), time (the period) and location (the
place), whenever the data has them. `facts.time_and_place` lists the periods and
places the outputs hold; the writer leaves time or location empty only when that
list has none. `check.choose_headline` prefers a headline that names the given
time and location and falls back to the reviewer's pick rather than lose the
finding.

On the hub card a headline over about 150 characters is cut off after five
lines; it shows in full in the run drawer and in Tell Me More.

### Confidentiality

- Columns that read as a person or an identifier are dropped in code
  (`material.keep_columns`), because the guardrail masks contact details but not
  people's names. A column named just `name` is kept unless the table also has
  personal columns. A date is never mistaken for a phone number.
- Everything bound for a model is masked with the in-process guardrail and
  **fails closed** (`ai_findings_content.mask_payloads`): if masking fails,
  nothing is sent and the job retries.
- Saved queries and filter conditions are masked in place before anything reads
  them (`mask_authored_text`); if masking fails they are blanked.
- Dig-deeper queries name a table alias, never a path. The alias maps to this
  run's own Parquet artifacts (`pipeline._bindings`), each query must be one
  read-only SELECT (`ai_findings_v2.sql.validate_sql`), and every result loses
  its personal and identifier columns (`material.keep_columns`) and is then
  masked (`sql.mask_result`). Masking fails closed: on any error the rows are
  dropped.

### The body

`schema_version: 2`:

| Field | What it is |
|---|---|
| `headline`, `lead` | the headline and a two-sentence lead |
| `kind`, `highlight` | `critical_alert`, `alert` or `update`, and the headline's key phrase (`""` when none was verified) |
| `alert` | `{event, place, hours_until, reason, rules}` for a critical alert or an alert, otherwise null. `rules` lists the author's rules that matched: `{id, label, level, conditions: [{text, passed, observed, error}]}` |
| `sections[{heading, text, asset_id}]` | 3–4 sections, each with the one asset that shows it |
| `actions[{action, why}]` | 0–2 concrete actions naming something in the data |
| `how_we_know` | the period covered and what it was compared with |
| `data_health` | set only when the run did not finish (`writer.incomplete_run_caveat`), shown above the story |
| `angles` | the context, time and location the headline was asked to carry |
| `data_period` | `{column, from, to}`: the span of time the data covered, or null when it has no periods |
| `context_numbers` | general-knowledge numbers the writer declared |
| `title`, `short_summary`, `story` | the headline (twice) and the joined section text, for readers of the older shape |
| `outputs`, `visual_asset_id` | every produced entity, and the first section's asset |
| `newsroom` | audit: brief, pitches, scores, dig-deeper queries, headlines, review, removed sentences and actions |
| `usage`, `timing` | model tokens and calls, and seconds |

JSON is the source of truth; `content.md` beside it is rendered from it
(`writer.render_markdown`) and never parsed back.

## The queue

`ai_finding_job`, keyed on `workflow_run_id` so enqueue is exactly-once. It is
separate from `ai_finding` because that table's `summary` and `content_path` are
`NOT NULL`, and because it records the decision *not* to publish too:
`gate_decision` is `unchanged` when the outputs were identical to last time and
`changed` otherwise, and `gate_reason` says why nothing was published.

**Enqueue is a database trigger, not Go.**
`trg_ai_finding_enqueue_on_run_terminal` (AFTER UPDATE on `workflow_run`). A run
reaches a terminal state from four places (the worker's `MaybeFinalizeRun`, the
engine's chat-resume `finalizeRunTx`, the sweeper's cancelling pass, and the
executor's direct cancel), and one trigger covers all four. It enqueues only
when the status is terminal, the status actually changed, `run_mode =
'production'`, and the definition's `ai_findings_enabled` is true. Failed, cancelled and
timed-out runs are enqueued too; their findings carry the incomplete-run
caveat.

**The trigger node type is not a condition.** A `manual`, `schedule`, `webhook`
or `chat` run all enqueue identically; only `run_mode` decides.
`resolveManualRunMode` (`frontend/src/components/pages/workflows/manualRunMode.ts`)
launches a **production** run from the builder only when the workflow is
published and the open draft is the published version. "Run schedule now" and
"Send Test Webhook" stay builder runs.

**The worker fast path.** `maybeTriggerAIFindings` posts to
`/api/internal/ai-findings/generate` when a run finalizes to `succeeded`, so a
finding appears in seconds. It shares `process_claimed` with the scan, so there
is one decision tree; the queue stays the backstop. See
[ai-findings-integration.md](ai-findings-integration.md).

**The claim is an RPC.** `public.ai_finding_claim_jobs(p_limit, p_lease_seconds)`,
because PostgREST cannot express `FOR UPDATE SKIP LOCKED`. N replicas may scan
concurrently and each row goes to exactly one. `attempts` counts failed
attempts, not claims. Every write back is guarded on `claim_token`, so a scan
that stalled past its lease cannot clobber a row another scan has re-claimed.

**The lease is renewed in Python.** The batch runs its jobs one after another,
so the scan restarts each job's lease (`AIFindingsService.renew_lease`, a
guarded update of `claimed_at`) just before running it, and skips a job another
scan has already taken over. The pipeline renews it again right before writing
and checks once more for an existing finding. A claim lost while drafting
(`lost_claim`) or a finding written meanwhile stops the write, so a second
writer never overwrites a finding or notifies twice. What remains is cost, not
duplication: a single job that outlasts `LEASE_SECONDS` can be drafted by two
scans, and only one of them writes.

**One recurring scan, not a job per run.** `scheduled_job` is built for
cadences; the per-run work lives in `ai_finding_job`.

## Configuration and operations

| Setting | Where | Default |
|---|---|---|
| Scan cadence | `scheduled_job` row, `job_kind='ai_finding_scan'` | 60s interval |
| Daily ceiling per workflow | `MAX_FINDINGS_PER_DEFINITION_PER_DAY` (`ai_findings_service.py`) | 24 findings / 24h |
| Publishing a team workflow that turns findings on | `system_admin` / `data_admin`, or a private-workspace owner on their own workflow. Republishing a flow whose findings are already on, or publishing one that turns them off, is not gated | — |
| Batch size | `SCAN_BATCH_SIZE` | 5 |
| Lease | `LEASE_SECONDS` | 600 |
| Retry cap | `MAX_ATTEMPTS` | 5 |
| Backoff | `BACKOFF_BASE_SECONDS` / `BACKOFF_MAX_SECONDS` | 60s → 1h |
| Key tables read / rows read in full | `MAX_KEY_TABLES` / `FULL_TABLE_ROWS` (`ai_findings_v2/material.py`) | 8 / 500 |
| Dig-deeper queries / rows | `MAX_DIG_QUERIES` / `MAX_DIG_ROWS` (`newsroom.py`) | 3 / 20 |
| Publish bar | `PUBLISH_BAR` (`newsroom.py`) | 3.4 of 5 |
| Headline target / limit | `SOFT_HEADLINE_CHARS` / `MAX_HEADLINE_CHARS` (`check.py`) | 120 / 250 |
| Models | `agent_high` (pitch, editor, writer, headlines, review), `agent_fast` (brief) | from the `ai_model` table |

These are module constants, not environment variables.

A published finding costs roughly $0.50–$1.10 in model calls. A run whose
outputs are identical costs nothing; one where the editor finds no strong story
costs a few cents.

Inspect the queue:

```sql
-- How many runs were evaluated, and what came of them.
SELECT state, gate_decision, count(*) FROM ai_finding_job GROUP BY 1, 2;

-- Why a specific run was or was not published.
SELECT workflow_run_id, state, gate_decision, gate_reason
  FROM ai_finding_job ORDER BY created_at DESC LIMIT 20;
```

Preview findings for real runs without publishing anything:

```
cd agent && PYTHONPATH=src pipenv run python scripts/preview_ai_findings.py --definition <workflow_id> --last 5 --judge
```

It drafts with `pipeline.generate(dry_run=True)`, which writes and notifies
nothing, and `--judge` scores each draft on a fixed rubric.

**Metrics.** `ai_findings_outcomes_total{outcome}` counts terminal scan outcomes
(`generated` / `gated_out` / `ceiling_reached` / `abandoned` /
`retryable_failure` / `lost_claim`) through the shared telemetry registry.

## Failure modes and edge cases

- **`AGENT_SERVICE_URL` unset**: the scheduler's dispatch errors *retryably*, so
  findings resume when the variable is fixed.
- **A scan outlasts the 60s fire interval**: the agent answers **409**, which the
  scheduler treats as a benign skip.
- **A scan hangs**: the in-process slot expires after `LEASE_SECONDS` and the
  next tick takes it, logging at ERROR. Every queue write is guarded on
  `claim_token`, so a doubled scan is harmless.
- **No runner configured**: tables beyond the preview's 50 rows are read from the
  preview only, and there are no dig-deeper queries. Findings are still written.
- **A model call fails, or masking fails**: a transient failure. The job retries
  with backoff, up to `MAX_ATTEMPTS`.
- **The definition has no workspace**: `UnscopeableFinding`, parked after one
  attempt because a retry would fail the same way.
- **A crash between writing the finding and marking the job done**: the lease
  re-claims the job, and the existing finding is found and reused rather than
  paid for again.
- **A node fails in the run**: whatever data the run did produce is read, and
  the finding carries the incomplete-run caveat.
- **Org-workspace visibility is admin-only for now**: `is_system_admin` or
  `is_data_admin`. A private-workspace owner sees their own findings. When it
  widens, `public.workflow_definition_readable` (`004_functions.sql`) is the
  drop-in predicate.

## Critical paths

1. **Opt in**: add the AI Findings node, then
   content's `POST /api/content/v1/workspaces/{ws}/flow-definitions/{id}/publish` reads the
   published version's graph and sets `workflow_definition.ai_findings_enabled`.
   Turning findings on is gated (see the table above); `/unpublish` turns them
   off. `PATCH` on the definition no longer accepts the flag. At runtime the node
   compiles to a terminal no-op (`llumen.noop`, no output channels).
2. **Enqueue**: run goes terminal → `trg_ai_finding_enqueue_on_run_terminal` →
   `ai_finding_job` (`pending`).
3. **Claim**: scheduler fires `ai_finding_scan` → `POST /api/internal/findings/scan`
   → `ai_finding_claim_jobs()` → `process_claimed` → `ai_findings_v2.pipeline.generate`.

## Storage

Body in the `ai-findings` bucket at `{finding_id}/content.json`, with
`content.md` beside it; the path is recorded in `ai_finding.content_path`. The
bucket has no `storage.objects` policies, so every read goes through an API that
checks the row first. A separate bucket rather than a path inside `workflow`,
because workflow objects are deleted by the engine's retention purge.

## The read API

Browser-direct on the agent service. Every route is gated on the
**`ai_findings_generation`** licence feature, matching the scheduler's
`ai_finding_scan` kind. The hub carousel and the run drawer both use these
routes, through one client — see
[ai-findings-integration.md](ai-findings-integration.md#read-apis).

| Route | Returns |
|---|---|
| `GET /api/agent/findings` | list, filterable by `workflow_run_id`, `workflow_definition_id`, `entity_type`+`entity_id`, or `ids` (comma-separated, at most 20); `dismissed` and `viewer_action` resolved per caller. **`exclude_dismissed=true`** drops the caller's dislikes, walking the feed in pages of 50 (up to 20 pages) so a long run of dislikes cannot empty it. **`include_content=true`** inlines each finding's full body and rendered Markdown (capped at 20 bodies per call) |
| `GET /api/agent/findings/{id}` | `{title, subtitle, content}` plus `content_markdown`. For a version 2 body the title is the headline and the subtitle the lead |
| `PUT /api/agent/findings/{id}/action` | `{action: like \| dislike \| tell_me_more \| clear}` for the calling user only; like and dislike replace each other, clear removes either. Written atomically by the `set_ai_finding_action` RPC |
| `POST /api/agent/users/{user_id}/finding-threads` | open the caller's finding thread for `flow_id` or for `finding_id`'s Flow; returns `{chat_id, flow_id, appended}` (see [Finding threads](#finding-threads)) |

The Findings tab's list is not an agent route: the browser calls the
`list_finding_threads` RPC directly, under its own JWT.

**Authorization order is load-bearing.** Each route reads the `ai_finding` row
under the caller's own JWT first, so RLS decides; only then is the body fetched
with the admin client. An admin-first read would be an unauthenticated read of
anyone's finding.

## The entity rule

`uq_ai_finding_one_per_workflow_run` (a partial unique index on `trigger_id`
`WHERE trigger_type = 'workflow_run'`) allows one finding per run, but a run can
produce several outputs. `ai_finding_entity` links them all, strongest first,
with the order stamped in `created_at` (the junction has no rank column):

1. The subject (`resolve_entity`): the asset under the first section when the
   run produced it, else succeeded terminal outputs by kind precedence
   (briefing > slides > dashboard > asset > dataset), ties broken on node id,
   else the workflow itself.
2. The visual asset (the first section's asset), so it is the card's picture.
3. Every other produced output, then every asset a section shows.

## Notifications, realtime and cleanup

**Notifications** fire once per written finding: the headline as the title and
the lead as the message. The "View finding" link carries `?workspace=`,
`?workspaceType=` and `?run=`; all three are required, since
`/workflow/[definitionId]/page.tsx` renders "Invalid workflow link." without a
workspace, and `?run=` opens the run drawer whose top panel is the finding.
Recipients match the RLS exactly. The metadata carries what the browser needs
to draw the finding without fetching it: `ai_finding_id`, `workflow_run_id`,
`workflow_definition_id`, `finding_kind`, `headline`, `highlight` and `domain`
(the Flow's name). The bell entry is `variant="error"` for a critical alert,
`"warning"` for an alert and `"default"` for an update (`_NOTIFICATION_LOOK`);
`variant` is the `notification_type` enum, so any other value fails the insert.

**Realtime**: `ai_finding` is deliberately **not** in the `supabase_realtime`
publication. Every surface reads it through the APIs above. A new finding
reaches the browser as its `notification` row's INSERT, and only that INSERT
shows it live (`frontend/src/stores/findingAlertStore.ts`): a **critical alert**
as the blocking aurora, an **alert** or an **update** as a toast above the
assistant bar. All three go to the bell inbox without the usual top-right toast. Nothing is replayed: a reader
who was offline finds it in the inbox only.

**Cleanup**: a finding is a row plus two objects, removed by different
mechanisms. The row goes with `trg_ai_finding_workflow_run_delete` (a trigger,
because `trigger_id` is polymorphic and carries no foreign key). That trigger
first records the body in **`ai_finding_blob_orphan`**, and the engine sweeper's
`finding_blobs` pass (`sweepOrphanFindingBlobs`) deletes both objects, then the
tombstone. A tombstone that fails five times is kept with `last_error` set. The
job row cascades with its run at 30 days.

## UI

- **Opt in**: the AI Findings node, in the Add Node drawer's Output Agents category.
  Hidden when the licence lacks `ai_findings_generation`. Its panel holds the
  focus note and the **"This Flow can raise alerts"** switch with the alert
  rules (`nodeConfig/aiFindingsAlerts/AlertRulesEditor.tsx`: a field from an
  upstream node picked with `DataReferencePicker`, how it is read, a comparison
  and a value, in AND / OR groups) and the notes for the agent.
- **The node's Output column** (`nodeConfig/NodeFindingOutput.tsx`): the step
  emits nothing, so the column shows the finding written for the run the
  builder shows (`RunFindingView`). A test run gets none and says so. Until the
  finding exists it shows "Writing the finding…", re-checked every 5 seconds
  for up to 3 minutes, and refreshed at once when the finding's notification
  for that run arrives (`findingAlertStore.arrivedRunIds`). When none was
  written, it gives the job's gate reason to a caller who may read the queue
  (`job` on the list route). A critical alert or alert shows the rules that
  raised it, each condition with what the run showed.
- **Live findings** (`frontend/src/components/common/FindingAlerts/`, mounted by
  `AssistantRoot`): every finding carries a coloured type label
  (`FindingKindLabel`: red critical alert, amber alert, blue update). An
  **alert** or an **update** is a stack of cards above the assistant bar; the
  page stays usable. Updates close after 10 seconds, a countdown that waits while
  the pointer or keyboard focus is on the stack and while the assistant panel is
  open; alerts stay until the reader closes them. ✕ and the buttons close one
  card. A **critical alert** is an aurora
  along the bottom of the screen with the headline over it. The aurora opens
  outwards from the middle of the screen and, on close, folds back into the
  middle before it fades. It blocks the page
  (clicks, keys and scrolling) until the reader presses ✕ or Esc, or opens the
  finding. With several, each of those closes the one showing and the next takes
  its place; the aurora folds away with the last. Both offer Tell me more (the hub's hand-off), 👍 / 👎 (saved as
  `like` / `dislike`) and View: the finding's slides, or its Flow run when it
  made none.
- **Per-run report**: `WorkflowRunFindingPanel`, in the run detail drawer above
  the step timeline, renders the same `RunFindingView`. A version 2 body renders with `FindingReport`
  (`frontend/src/components/pages/workspaces/AIFindings/`): headline, lead, the
  incomplete-run caveat when present, then each section with its asset directly
  under its text. Older bodies render from their Markdown. Its "no finding"
  state says why, because an empty panel reads as broken.
- **Hub carousel**: the workspaces **All** tab. The card face is the row's
  `summary` (the headline), with its first percentage or figure emphasised, over
  the first asset link (a live chart, or a map backdrop for a map layer). Bodies
  are prefetched after the cards paint and reused by Tell Me More.
- **Tell Me More**: opens the finding's Flow thread (below). Each finding in the
  thread is shown with its assets under their sections
  (`render_markdown(asset_markers=True)`). If the thread cannot be opened (the
  agent is down, for example) the panel falls back to a one-off chat seeded with
  the finding (`openWithFinding`); see
  [../ai-agents/chat-agent.md](../ai-agents/chat-agent.md#the-ai-findings-hand-off).
- **Findings tab**: the assistant's history panel has two tabs, **Chats** and
  **Findings** (`SessionsPanel.tsx`). Findings lists one row per Flow, newest
  finding first; see [Finding threads](#finding-threads).
- **Client**: `frontend/src/services/aiFindingsService.ts`, and
  `findingThreadsService.ts` for threads.

## Finding threads

A finding thread is a `chat` row with `kind = 'findings'` and `findings_flow_id`
set: one per user per Flow (`uq_chat_findings_thread`), private like any chat.
Delta `096_2026.10.10` added both columns. Normal conversations have
`kind = 'chat'`, and the Chats tab filters on it.

**The list** (`list_finding_threads`, SECURITY INVOKER) is built from
`ai_finding` → `workflow_run` → `workflow_definition`, one row per Flow with its
newest finding, plus the caller's `chat_id` when a thread exists. Because the
list comes from findings and not from chats, a Flow keeps its row when its
thread is cleared. It pages by `(latest_created_at, flow_id)` (`p_before`,
`p_before_flow_id`; `findingThreadCursor` in the client), so Flows whose
latest findings share a timestamp are not lost between pages, and it matches
the search term literally (`%` and `_` are escaped).

**Opening a thread** (`agent/src/services/finding_threads.py::open_finding_thread`):

1. Resolve the Flow, from `flow_id` or through the finding's run.
2. `get_or_create_findings_chat(flow_id)`. It is race-safe on the unique index.
3. A new or cleared thread is seeded with **one** finding: the one clicked, or the
   latest. Otherwise the visible findings newer than the newest one already in
   the thread are appended, oldest first, at most `MAX_APPENDED_PER_OPEN` (3):
   after a long gap only the newest three join, and the rest stay in the list.
4. Each appended finding is saved as an opener message carrying `finding_id`,
   and pushed onto `chat.selected_findings`. A finding opens a chat at most once
   (`uq_message_finding_opener`), so two opens racing each other (Tell Me More
   while the panel reopens the thread, two tabs) cannot append it twice: the
   losing insert fails and that call skips it.

Findings join a thread when it is opened, not when they are published. Every
read and write runs under the caller's JWT, so RLS decides what lands in their
transcript; a publish-time fan-out would run as the service role.

"Opened" includes the assistant panel opening on a thread: `AssistantRoot`
calls the same route with `chat_id` once per panel open
(`findingThreadStore.wasSyncedSinceOpen`), so a finding published while the
thread was on screen appears after a close and reopen. Nothing is appended while
the agent is answering in the thread. The client waits for the turn to end, and
the server refuses on its own (`turn_in_flight`: the newest message is the
user's, or an AI message with no text yet) and returns `deferred: true`.

**Telling findings apart.** Each opener carries `finding_id` and
`finding_created_at`, and the transcript draws a `FindingDivider` above it with
the publish time:

- "New finding", in the brand colour, for findings that joined on the latest
  sync (a thread's first finding is never "new"). The panel scrolls to the first
  of them.
- "Latest finding" for the newest one loaded.
- "Earlier finding" for the rest.

**Context.** `selected_findings` keeps only the newest
`MAX_THREAD_FINDINGS_IN_CONTEXT` (3) for a thread, the opposite end from a
Tell Me More chat. Opener messages never reach the model through the history
(`_to_langchain_history` skips anything with `finding_id`), so an older finding
leaves the context but stays in the transcript. Each turn also carries a Flow
block (`resolve_flow_context`): the Flow's steps and the status and outputs of
the run behind the newest finding, capped at 4 000 characters. Saved queries
and filter conditions are left out, because they can hold literal customer
values. Only the parts every reader sees (the authored graph and the finding's
outputs) are cached; step rows and output titles are read under the caller's
JWT on every turn, so one reader's view never reaches another.

**Clearing** a thread deletes its `chat` row (the existing chat delete). The
`ai_finding` rows are never touched, and the next open starts over from the
latest finding.

**Deleting the Flow** does not delete anyone's thread. The foreign key sets
`findings_flow_id` to NULL and `trg_chat_release_findings_thread` turns the
thread into a normal chat, so it moves to the Chats tab with its conversation
intact.


## Validation checklist

- `make test-agent`: `tests/test_ai_findings_v2.py` (material, facts, checks,
  editor, a full run with fake models), `test_ai_findings_service.py` (queue
  semantics), `test_ai_findings_writer.py` (entity links, persistence, rendering
  of stored version 1 bodies), `test_ai_findings_content.py` (masking and the
  authored workflow), `test_ai_findings_collector.py`, and
  `test_finding_chat_context.py` (the Tell Me More hand-off).
- `cd frontend && bun run test -- --run src/components/pages/workspaces/AIFindings src/stores/__tests__/assistantFindingStore.test.ts`.
- `make test-storage`: the `ai-findings` bucket must stay in `StaticBucketDefs`.
- `make test-scheduler`: dispatch target, 409 handling, licence gating.
- `make test-engine`: `sweeper_findings_test.go` pins the orphan-blob drain.
- `make lint-deltas` and `make schema-check` after any schema edit. The
  trigger's four conditions are all load-bearing.

## Integration map

- [ai-findings-integration.md](ai-findings-integration.md): the worker contract.
- [runs-and-executions.md](runs-and-executions.md): the terminal transition this
  hangs off.
- [engine-sweeper.md](engine-sweeper.md): retention and the orphan-blob drain.
- [../services/scheduler.md](../services/scheduler.md): the `ai_finding_scan` job kind.
- [../services/profiling.md](../services/profiling.md): the column profiles the
  material reads for big tables and the run signature.
- [../ai-agents/chat-agent.md](../ai-agents/chat-agent.md#the-ai-findings-hand-off):
  Tell Me More.
