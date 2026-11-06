---
topic: workflows
services: [worker, frontend]
status: current
---
# AI Findings — platform handoff & agent contract

What the **platform PR** ships, what the **agent service** is expected to expose (implemented on a separate agent branch — not in our PR), and how the two connect.

## What is on the platform branch (what we push)

| Layer | On platform branch? | Role |
|-------|---------------------|------|
| **Schema** | Yes | `ai_finding` table, `workflow_definition.ai_findings_enabled`, RLS, `ai-findings` bucket |
| **Worker** | Yes | After a run reaches `succeeded` **and the definition passes the local eligibility check**, fire-and-forget `POST` to the agent |
| **Frontend** | Yes | Workspaces **All** carousel, the AI Findings builder node, Tell Me More → assistant |
| **Agent** | **Yes, now** | `POST /api/internal/ai-findings/generate` is implemented (`agent/src/api/routers/internal.py`), backed by the same `ai_finding_job` queue the scheduler drains |

The endpoint now exists, so the worker call succeeds. It shares `process_claimed` with the scheduler scan — one decision tree, one queue row — so the worker path makes a finding appear in seconds while the queue remains the safety net for the terminal states the worker never reports (failed / cancelled / timed_out) and for the engine's chat-resume finalisation, which has no agent client. See the "Known gap" note below: the queue closes it.

Every findings read and the action write go to the agent, from both the worker and the frontend (see [Read APIs](#read-apis)).

**The worker pre-filters before calling.** `maybeTriggerAIFindings` runs one indexed query (`workflow_run` → `workflow_definition`) and dispatches only when `run_mode = 'production'` **and** `ai_findings_enabled = true` **and** `definition_kind = 'workflow'` — the same three facts the enqueue trigger and the agent's `precheck_for_run` check. This is a load filter, not a trust boundary — the agent must still enforce its own gates, because the worker's check is advisory and the endpoint is reachable independently. Without it, every succeeded run in the fleet POSTs to the agent, including the ones that never opted in and every builder step-test.

**Known gap:** the engine's chat-resume path (`finalizeRunTx`, `engine/internal/service/runtxhelpers.go`) can also finalize a run to `succeeded`, and the engine has no agent client — so a flow whose final node was a chat-waiting step generates no finding. Documented, not fixed: wiring an agent dependency into the engine touches all six env surfaces.

## What the agent owner delivers (separate branch)

- **`POST /api/internal/ai-findings/generate`** — worker trigger (contract below).
- Persistence: `ai_finding` row + `{finding_id}/content.json` in the `ai-findings` bucket.
- **`finding_id`** on the agent chat POST — the Tell Me More hand-off. Shipped:
  the endpoint declares it, attaches it to `chat.selected_findings`, and resolves
  the report into the prompt on every turn of that conversation. The earlier
  sketch (posting the rendered prose as `finding_context`) is gone; see
  [../ai-agents/chat-agent.md](../ai-agents/chat-agent.md#the-ai-findings-hand-off).

## End-to-end flow

```text
1. User adds the AI Findings node to an Agentic Flow and publishes it.
2. Flow runs in production and finishes succeeded.
3. Worker → POST agent /api/internal/ai-findings/generate  { workflow_run_id }
4. Agent writes DB row + storage JSON.
5. Admin → Workspaces All → agent `GET /api/agent/findings?exclude_dismissed=true` (carousel), then `?ids=…&include_content=true` (body prefetch); `GET /api/agent/findings/{id}` on **Tell Me More** when the prefetch did not load the body
```

## Agent generate API — contract

### Request (worker → agent)

```http
POST /api/internal/ai-findings/generate
X-Agent-API-Key: <AGENT_SERVICE_API_KEY>
Content-Type: application/json

{ "workflow_run_id": "<uuid>" }
```

Caller: `worker/internal/agentclient/client.go` → `GenerateAIFinding`.

### Response (HTTP 202)

**The endpoint answers before it generates.** The cheap refusals are decided
synchronously by `precheck_for_run` — a handful of indexed reads — and generation
itself runs on a bounded background pool.

It used to run entirely inline, and that did not survive contact with the caller.
The worker dispatches under a 30s deadline (`aiFindingsDispatchTimeout`,
`worker/internal/worker/enqueue.go`) while the work behind it is a full newsroom
pass of several model calls. The deadline expired on essentially every real generation,
so the worker recorded `workflow_ai_findings_dispatch_total{result="error"}` and
logged a warning for findings that had generated perfectly. The work always
completed (a sync FastAPI route in the threadpool is not cancelled by a client
disconnect), so only the signal was wrong — which is the worst kind of wrong for a
metric whose stated purpose is to make "findings silently stopped generating"
observable.

| `status` | Meaning |
|----------|---------|
| `accepted` | Gates passed; generation is under way (`reason`: `generating`, `already_in_progress`, or `queued_for_scan` when the pool is saturated) |
| `skipped` | Gates not met (`reason`: e.g. `ai_findings_disabled`, `run_not_succeeded`) |
| `exists` | Idempotent — finding already exists for this run (`finding_id`, `content_path`, optional `entity_type` / `entity_id`) |

`accepted` no longer carries `finding_id`: the finding does not exist yet when the
response is written. A caller that needs the id reads it from
`GET /api/agent/findings?workflow_run_id=…` once generation completes — which is
what the run drawer already does.

**The worker reads `status` and nothing else from the body.** It has to: every
refusal is a 202, so a client that watched only the transport would count "the
licence does not include AI Findings" as a successful dispatch and leave
`workflow_ai_findings_dispatch_total{result="dispatched"}` healthy while nothing
generates. `skipped` is counted as `skipped`; `accepted` and `exists` are counted
as `dispatched`; an unreadable or statusless body is treated as `accepted`,
because the call did reach the agent and inventing a refusal is its own wrong
signal.

Pool overflow is not a failure. The database trigger has already enqueued every
one of these runs, so the `ai_finding_scan` loop is the backstop; the fast path is
an optimisation, never the only route.

### Gates (agent boundary)

- Run `succeeded`; definition `definition_kind = 'workflow'`; `ai_findings_enabled = true`.
- Exactly one of `workspace_id` / `private_workspace_id`.
- One finding per run (`trigger_type = 'workflow_run'`, `trigger_id = workflow_run_id`).

## Outputs the agent must persist

**`ai_finding` row:** `summary` (the finding's headline), `content_path`, `trigger_type`, `trigger_id`, workspace scope. The outputs it links to live in `ai_finding_entity`.

**`ai-findings/{finding_id}/content.json`**, the body the agent writes (`schema_version` 2):

```json
{
  "schema_version": 2,
  "headline": "Northgate store's March returns jump 26.5% to 1,240",
  "lead": "Returns across the chain are mostly one store's story. ...",
  "sections": [{ "heading": "One store, one problem", "text": "...", "asset_id": "<asset uuid or null>" }],
  "actions": [{ "action": "Audit Northgate's March returns by product line.", "why": "..." }],
  "how_we_know": "March 2026, compared with the previous run.",
  "data_health": "Set only when the run did not finish.",
  "angles": { "context": "store returns", "time": "March 2026", "location": "Northgate store" },
  "title": "<the headline>", "short_summary": "<the headline>", "story": "<the sections' text>",
  "outputs": [ ], "visual_asset_id": "...", "newsroom": { }, "usage": { }, "timing": { }
}
```

The authoritative shape is `AiFindingBody` in `frontend/src/services/aiFindingsService.ts`,
mirroring `ai_findings_v2.pipeline.build_body`. Full detail is in
[ai-findings.md](ai-findings.md).

**Three body shapes reach the reader, and all render.** Current findings are
`schema_version` 2. Findings written by the earlier statistical pipeline are
`schema_version` 1 (`story`, `highlights`, `recommendations`) and stay in
storage, so every reader keeps rendering them. The platform branch's
placeholder bodies carry `sections: [{title, body}]`. `findingCardModel` checks
`schema_version` 2 first, then the version 1 fields, then the placeholder
`sections`; `findingCardModel.test.ts` pins each path.

- The **carousel card** paints from the feed row alone: the `ai_finding.summary` column for its headline copy, and the row's `entities` list (the `ai_finding_entity` links) for the outputs menu and the chart/thumbnail visual. It does not wait for `content.json` — which is exactly why the asset to show comes from the ROW: a run that produced a briefing *and* a chart points its subject at the briefing, and the card could not otherwise learn the chart exists. The bodies arrive afterwards in one `ids` prefetch, which only sharpens the card text; the body carries the same assets plus a full `outputs` list.
- **Tell Me More** uses the prefetched body, or fetches `GET /api/agent/findings/{id}` when the prefetch did not load it, and renders the whole report into the assistant panel (`findingCardModel.formatFindingAssistantBody`): for a version 2 body, the lead, the incomplete-run caveat when present, then each section with an `{{asset:<id>}}` marker so its chart sits under its text, then `## What to do`. Older bodies render as before.
  That copy is **display only**. What reaches the model is the finding **id**, sent
  once as `finding_id` on the first turn; the agent re-reads the report itself
  behind an RLS check and remembers the id on `chat.selected_findings` so the
  report stays in context for the whole conversation. Do not "fix" a context gap
  by posting the prose — the browser is not a trusted source for text the prompt
  will label as a platform report.
- The emphasised figure on the card is presentation-only: `findingCardModel.parseFindingText` underlines the first `%` token in the headline, or failing that its first figure. Do not add markup or sentinel characters to stored bodies to drive it.

## Read APIs

The agent serves every AI Findings read and the action write (route detail in
[../services/agent.md](../services/agent.md#ai-findings-read-surface)).
`frontend/src/services/aiFindingsService.ts` is the one client, for both the
carousel and the run drawer (`WorkflowRunFindingPanel.tsx`):

| Need | Client method | Agent route |
|---|---|---|
| Feed: newest visible findings, the caller's dislikes skipped, `viewer_action` on each | `listRecent(5)` | `GET /api/agent/findings?exclude_dismissed=true&limit=5` → `{findings, count}` |
| Bodies prefetch, at most 20 per request | `getContentsBatch(ids)` | `GET /api/agent/findings?ids=<id,…>&include_content=true` → `{findings: [{id, content, content_unavailable, …}]}` |
| One body (Tell Me More) | `getContent(id)` | `GET /api/agent/findings/{id}` → `{content, …}` |
| The run drawer's finding | `list({workflowRunId})`, `get(id)` | `GET /api/agent/findings?workflow_run_id=…`, `GET /api/agent/findings/{id}` |
| Like, dislike, tell me more, clear | `setAction`, `dismiss`, `undismiss` | `PUT /api/agent/findings/{id}/action` → `{finding_id, action}` |

`getContentsBatch` returns a body per id, `null` for a row whose body could not
be read (`content_unavailable`), and nothing for an id RLS hides. The carousel
retries only the `null` ones through `getContent`: an id that is absent would
just 404. When the whole prefetch fails it falls back to `getContent` per card.

Errors are FastAPI `{detail}`, read through `utils/apiErrorDetail.ts`. The
licence refusal is a 402 `{error: "feature_locked", feature: "ai_findings_generation", message, …}`;
`installQuotaFetchInterceptor` opens the upgrade dialog for it.

## Integration (agent owner)

1. Merge platform branch.
2. Implement `POST /api/internal/ai-findings/generate` per contract.
3. Enable AI Findings on an Agentic Flow; complete a succeeded production run.
4. Verify carousel on Workspaces → All.

## Platform file references

| Area | Path |
|------|------|
| Worker trigger | `worker/internal/worker/enqueue.go` |
| Worker client | `worker/internal/agentclient/client.go` |
| Read API | `agent/src/api/routers/agent.py` (`/api/agent/findings`), `agent/src/services/ai_findings_feed.py` |
| Frontend | `frontend/src/components/pages/workspaces/AIFindings/` |
| Schema | `supabase/deltas/081_2026.09.10.sql` (plus the baseline it mirrors) |
