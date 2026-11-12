---
topic: workflows
services: [content, engine, frontend]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow chat ingress

## Audience and goal

How a `chat_input_trigger` Flow talks to a human over a conversational
window: session lifecycle, the create-vs-resume decision on every posted
message, and how the reply reaches the parked `send_chat_message`
`send_and_wait` step. Does not cover the chat *agent* subsystem
(`agent_nodes`/Infusion chat) — see [../ai-agents/chat-agent.md](../ai-agents/chat-agent.md)
for that. Does not cover `send_chat_message` itself as a node kind — see
[action-nodes.md](action-nodes.md).

## Read first

- `content/internal/api/handlers/flow_chat.go` — `FlowChatHandler`:
  `Start`, `PostMessage`, `GetSession`, and the helpers `openSession`,
  `ownedSession`, `activeRun`, `resume` and `create`.
- `content/internal/api/services/flowchat/flowchat.go` — the pure logic:
  `TriggerNodeID`, `TargetVersion`, `ParseReply`, `MismatchRefusal`,
  `BuildPage`, `RootInput` and `EngineAnswer`.
- `content/internal/api/flow_extra_routes.go` — `registerFlowChatRoutes`.
- `engine/internal/service/chatresume.go` — `ChatResumer`, the
  engine-side counterpart that completes the parked step.
- [triggers.md](triggers.md) — `chat_input_trigger` as one of the four
  trigger kinds.
- [action-nodes.md](action-nodes.md) — the `send_chat_message` node that
  parks a run in `waiting`.
- `frontend/src/components/pages/workflows/WorkflowChatWindow.tsx` — the
  chat UI, which calls these routes through `workflowService.ts`
  (`startChatSession`, `getChatSession`, `postChatMessage`).
- [../services/content.md](../services/content.md) — the content service
  that serves these routes.

## How it works

A chat-triggered Flow is driven entirely through the content service, under
`/api/content/v1/workspaces/{workspace_id}/...`, behind the `workflows`
licence feature. The workspace segment and its role gate are the Flow routes'
own (`flows.ResolveScope`), and the definition is read as the caller, so RLS
decides whether the Flow is visible. The chat tables have no INSERT or UPDATE
policy, so session and message writes, and the session and run reads, use the
service role; a session is then served only to the user who created it.
State lives in two tables: `workflow_chat_session` (one row per
user+Flow conversation) and `workflow_chat_message` (the rendered
bubbles, `sequence_no` BIGSERIAL for deterministic ordering).

**Session open** (`POST .../flow-definitions/{definition_id}/chat/start`,
`Start`): needs only read access, and is idempotent. It resolves the Flow's
published version (`TargetVersion`; chat runs always target
`published_version_id`, the same rule as webhook and schedule triggers), finds
the singleton `chat_input_trigger` node id in that version
(`TriggerNodeID`), then `openSession` looks up the caller's own most-recent
`status='active'` session for that definition or inserts one. A republish
while the user was idle moves an existing session to the new version. A partial
unique index (`idx_workflow_chat_session_active_unique` on
`(workflow_definition_id, created_by) WHERE status='active'`) makes concurrent
first-opens race-safe: a losing insert's unique violation is caught and the
winner's row is re-read. The answer carries the session id, the trigger node,
the latest conversation page and the active run.

**Posting a message** (`POST .../flow-chat-sessions/{session_id}/messages`,
`PostMessage`, write access) is the create-vs-resume decision point. It
always checks the session against the caller's workspace and user first
(`ownedSession`), refuses a closed session, validates the body
(`ParseReply`), and re-reads the Flow as the caller. Then:

1. `activeRun` looks for a `workflow_run` on this session with status in
   `(queued, running, waiting)`.
2. **If that run is `waiting`** — the user's reply is a resume. Content
   cross-checks the reply's `type` (`free_text`/`approval`) against the
   waiting step's `expected_response_type` (`MismatchRefusal`, a fast local
   400 before ever calling the engine), then calls the engine client's
   `ChatResume` (`content/internal/engine/client.go`).
   `ChatResumer.Resume` (`chatresume.go`) is a single transaction: it
   validates the run is genuinely parked on `wait_kind='chat_response'`,
   writes the reply as the step's default-channel artifact (so downstream
   nodes read it exactly like any other upstream output), transitions the
   step `waiting → succeeded`, inserts the user's chat bubble in the same
   transaction, and re-enqueues every step whose inputs are now satisfied.
   The engine — not content — owns the user-message insert on this path,
   because it must be atomic with the step transition. The answer's
   `action` is `resumed`.
3. **If no run is active** — a fresh production run is created. The
   message is stored as a `workflow_document` (`storeRootInput`, written
   through `storagedoor.PutWorkflowObject` to the `workflow` bucket under
   `workflow-definitions/{id}/chat-inputs/...json`) and the engine client's
   `StartRun` is called with `trigger_type="chat"`, `run_mode="production"`,
   and `root_input_document_id` pointing at it — the same mechanism the
   webhook ingress uses to hand the trigger node's `default` channel its
   payload. The run is created under the idempotency key
   `chat:{document id}` with a 60 s timeout, and asked once more under the
   same key when the first answer leaves its existence unknown (timeout,
   transport error, 5xx). Only a definite engine refusal (a 4xx) removes the
   stored input again (`dropRootInput`); otherwise the input is kept, because
   a run may be reading it. Content inserts the user bubble itself here (only
   after the run is created, so a rejected run never leaves a ghost bubble) and
   stamps `workflow_chat_session.last_run_id` / `last_message_at`. The
   answer's `action` is `created`.
4. **If a run is `queued`/`running`** (not yet parked) — rejected with
   `409` rather than starting a second, parallel run.
5. **An `approval` reply with no waiting run** — also `409`: an
   approval only makes sense against a parked step.

**Reading state** (`GET .../flow-chat-sessions/{session_id}`,
`GetSession`) is what the chat window reads: session status, a page of
messages, and the currently-active run (if any) including
`expected_response_type` so the frontend can render the right composer
(free-text box vs Approve/Reject) without re-deriving it from history.
`expected_response_type` is read off the *most recent* `role='workflow'`
message row rather than off the run, because that row is written in the
same transaction as the step's transition to `waiting` and so cannot lag.

There is no close route. A session stays `active` until something else
changes its status; posting into a session whose status is not `active` is
refused with `409`.

## Critical paths

1. **First message** — `WorkflowChatWindow.tsx` → `POST .../chat/start`
   → `openSession` → `POST .../messages` (create branch) →
   `storeRootInput` → engine `CreateRun` → engine creates `workflow_run`
   (`trigger_type='chat'`) → worker executes until it either finishes or
   hits a `send_chat_message` `send_and_wait` step.
2. **Reply to a parked step** — `POST .../messages` (resume branch) →
   engine `ChatResume` → `ChatResumer.Resume` (single transaction: artifact
   write + step `waiting→succeeded` + user-bubble insert) → engine
   re-enqueues downstream steps → worker resumes execution.
3. **Live updates** — the realtime service streams a `flow_chat` change for
   every message and session update, authorizing the socket through content's
   `/flow-chat-sessions/{id}/access` probe (`WorkflowChatHandler.SessionAccess`
   in `content/internal/api/handlers/workflow_chat.go`). On each change, or on
   a polling interval when the socket is down, `WorkflowChatWindow.tsx` calls
   `GET .../flow-chat-sessions/{id}`, paging older history via
   `?before_sequence_no=` when the user scrolls up (`conversation` and
   `BuildPage`, cursor-based on `sequence_no`).

## Configuration and operations

- `MaxMessageBytes` = 64 KiB — hard cap on a single free-text message body
  (`flowchat.go`); attachments are out of scope for the chat trigger.
- `DefaultPageSize` = 200 / `MaxPageSize` = 500 — default vs. maximum page
  size for `GET .../flow-chat-sessions/{id}` (`?limit=` is clamped by
  `PageLimit`).
- Chat runs always target `workflow_definition.published_version_id`;
  `Start` and `PostMessage` reject an unpublished Flow with `400`.
- Storage: chat-input documents land in the same `workflow` bucket as
  every other workflow artifact — see [artifacts-storage.md](artifacts-storage.md).
  Content reaches it through the storage service (`STORAGE_SERVICE_URL`,
  `STORAGE_INTERNAL_KEY` on content); an unconfigured storage client is a
  `503`.

## Failure modes and edge cases

- **Flow not published** — `TargetVersion` refuses with `400` before a
  session can even open.
- **No `chat_input_trigger` node in the published version** —
  `TriggerNodeID` refuses with `400`.
- **Session belongs to a different workspace/user** — `ownedSession`
  cross-checks `workspace_id`/`private_workspace_id` and `created_by` and
  returns `403` rather than trusting the session id alone. An unknown or
  malformed session id is `404`.
- **Posting into a closed session** — `409`.
- **Reply shape mismatches the waiting step's `expected_response_type`**
  — short-circuited locally as `400` before calling the engine; the
  engine re-validates authoritatively and would otherwise surface
  `WF_CHAT_RESUME_RESPONSE_TYPE_MISMATCH` (mapped to `400` by
  `EngineAnswer`).
- **A run is queued/running but not yet parked** — new messages are
  rejected `409` rather than piling up a second run.
- **Engine not configured** — `503` before either the create or resume
  path is attempted.
- **`WF_RUN_ALREADY_ACTIVE`** (engine, `createrun.go`) — mapped to `409`.
- **`WF_CHAT_RESUME_RUN_NOT_WAITING`** (engine — the run moved on, e.g.
  another reply already resumed it) — mapped to `409`.
- **`WF_CHAT_RESUME_BAD_RESPONSE`** (engine — empty/invalid payload) —
  mapped to `400`.
- An engine `402` is answered as the `workflows` feature lock; any other
  engine 4xx carrying a `WF_` code is relayed with its status and code;
  everything else is `502`.

## Integration map

- [triggers.md](triggers.md) — `chat_input_trigger` is one of the four
  trigger kinds; this page is its dedicated ingress protocol.
- [action-nodes.md](action-nodes.md) — `send_chat_message` is the node
  that parks a run in `waiting` for this ingress to resume.
- [runs-and-executions.md](runs-and-executions.md) — `waiting` is a
  first-class `workflow_run`/`workflow_step_run` state; this page is
  the one path that transitions a run out of it via chat.
- [artifacts-storage.md](artifacts-storage.md) — chat-input documents
  and the user's message artifact are stored the same way as any other
  workflow document.
- [../ai-agents/chat-agent.md](../ai-agents/chat-agent.md) — the
  product's general chat agent; unrelated code path from this one,
  mentioned here only to disambiguate the name.
- [webhooks.md](webhooks.md) — the sibling trigger whose inbound-payload
  pattern (`root_input_document_id`) this ingress reuses for the
  create-run path.

## Validation checklist

- `content/internal/api/handlers/flow_chat_test.go` (`TestFlowChat*`)
  exercises the start, create, resume, mismatch and 409 paths, and
  `content/internal/api/services/flowchat/flowchat_test.go` covers the pure
  logic — run `make test-content` when touching either.
- `engine/internal/service/chatresume_test.go` covers `ChatResumer.Resume`.
- If `expected_response_type` handling changes, re-check that content's
  local short-circuit and the engine's authoritative validation stay in
  agreement — a drift here manifests as a fast-400-then-502 double round
  trip.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
