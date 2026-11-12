---
topic: workflows
services: [worker]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow action nodes

## Audience and goal

Side-effect kinds `send_chat_message`, `send_email`, `send_api_request`
(the `side_effect_actions` bucket in `contracts/workflow_node_kinds.json`).
Worker `Executor.runAction` (`worker/internal/worker/action_runtime.go`)
dispatches all three; `HTTP` and `SMTPSender` interfaces make the
`send_api_request`/`send_email` transports swappable in tests.

## Read first

- [node-catalog.md](node-catalog.md)
- `worker/internal/worker/executor.go` struct comments on `HTTP` /
  `SMTPSender`.
- `worker/internal/worker/action_runtime.go` — `runAction` dispatch,
  `computeActionIdempotencyKey`, per-kind runners
  (`runSendChatMessage`, `runSendEmail`, `runSendAPIRequest`).

## How it works

Every action step first resolves its `actionKind` + `spec` bindings and
any `{{alias}}` ancestor-ref tokens in the spec, then computes an
**idempotency key** before doing anything with side effects (see
below), writes/updates a `workflow_action_outbound` journal row keyed
on that identity, and only then dispatches to the kind-specific runner:

- **`send_chat_message`** (`runSendChatMessage`) — writes a
  `role='workflow'` chat bubble. In `send_and_wait` mode this parks the
  step (and the run) in `waiting` with `wait_kind='chat_response'`
  until [chat-ingress.md](chat-ingress.md) resumes it.
- **`send_email`** — see below.
- **`send_api_request`** — direct vs source mode, see below.

**`send_api_request` — direct vs source mode.** `send_api_request` has
two modes: **`direct`** (the request is issued straight from the
worker's `HTTP` client) and **`source`** (the request is routed through
the runner as an `api_connection`-type source query, so it gets the
same encryption/auth handling as a product API source). Mode is
inferred from the node's config shape (`mode` field, or presence of
`sourceId` implying `"source"`). Source-mode failures use a dedicated
error family: `WF_ACTION_API_SOURCE_RUNNER_UNCONFIGURED`,
`WF_ACTION_API_SOURCE_REQUIRED`, `WF_ACTION_API_SOURCE_REQUEST_REQUIRED`,
`WF_ACTION_API_SOURCE_REQUEST_MARSHAL` (defensive, should not normally
trigger), `WF_ACTION_API_SOURCE_RUNNER` (transport/runner-side
failure), `WF_ACTION_API_SOURCE_RESPONSE_MARSHAL`.

**Direct-mode SSRF guardrails.** `validateActionRequestURL` rejects
non-`http(s)` schemes and destinations resolving to loopback/RFC1918/
link-local/IPv6-ULA addresses before the request is issued; the
client's `CheckRedirect` closure re-validates on every redirect hop so
a request can't escape the guard via a 3xx to an internal address.

**`send_email` transport policy.** `decideEmailTransport` in
`action_runtime.go` decides by run mode and by whether the env-scoped SMTP
transport is configured (`WORKFLOW_SMTP_HOST` set, `EnvSMTPSender.configured()`):

| Run mode | Transport configured | No transport |
|---|---|---|
| `production`, `workflow_preview` | send | the step fails with `WF_ACTION_EMAIL_TRANSPORT_UNCONFIGURED` |
| `builder_debug`, `builder_step_test`, `builder_replay` | send | simulated: the step completes with a simulation document and writes no outbound-journal row |
| anything else (`dataflow`, blank, a newer mode) | the step fails with `WF_ACTION_EMAIL_RUN_MODE_UNSUPPORTED` | same |

A builder step test of an email node is gated upstream by the engine's
`confirm_live_execution` acknowledgement. This applies only to the env-scoped
SMTP transport; source-scoped (vault) credentials are a separate,
runner-mediated path (see the note in `action_runtime.go`).

**No run mode suppresses actions.** A `workflow_preview` run (an agent's
temporary run) performs email, chat and API actions exactly as a production
run does. A `send_chat_message` step writes its chat bubble only when the run
belongs to a workflow chat session (`rc.ChatSessionID`). In a run with none,
such as a manual or temporary run, a `send_message` step succeeds and writes no
bubble; `send_and_wait` cannot reach that case, because it compiles only in a
graph with a `chat_input_trigger`.

## Idempotency

Every action node computes an idempotency key before issuing its side
effect: `computeActionIdempotencyKey(runID, nodeID, fingerprint)` =
`sha256(runID + ":" + nodeID + ":" + fingerprint)` hex-encoded
(`action_runtime.go`). The journal write (`workflow_action_outbound`,
unique on `idempotency_key`) happens **before** the side effect fires,
using `INSERT ... ON CONFLICT (idempotency_key) DO UPDATE` plus
`attempt_no`, so a retried step reuses the same key rather than
double-firing — see [internal-api.md](internal-api.md)'s note that
already-`succeeded` outbound journal rows are not rolled back by run
cancellation.

## Critical paths

1. **Dispatch** — worker leases an action step → `runAction` resolves
   `actionKind`/`spec`/ancestor refs → idempotency key computed →
   `workflow_action_outbound` journal row upserted → kind-specific
   runner invoked.
2. **`send_api_request` direct mode** — URL validated
   (`validateActionRequestURL`) → body-size guard
   (`actionRequestBodyMaxBytes`, mirroring the engine's compile-time
   `WF_COMPILE_ACTION_API_BODY_TOO_LARGE` cap) → HTTP request issued →
   response body truncated to `actionBodyReadBudget` → journal +
   step finalized.
3. **`send_chat_message` send_and_wait** — bubble written → step/run
   transition to `waiting` → [chat-ingress.md](chat-ingress.md)'s
   resume path completes the step later.

## Configuration and operations

- `WORKFLOW_SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_TLS` /
  `_FROM` — `EnvSMTPSender`'s env-scoped SMTP transport
  (`action_runtime.go`); host unset ⇒ a production or preview email fails and a
  builder email is simulated (see above).
- `actionRequestBodyMaxBytes` / `actionBodyReadBudget` /
  `actionSummaryBudget` — compile-time-mirrored size caps on
  `send_api_request` direct-mode bodies/responses.
- The step-test UI must require `confirm_live_execution` acknowledgement
  for any kind in `side_effect_actions` — engine enforces via
  `IsSideEffectActionKind`.

## Failure modes and edge cases

- **`WF_ACTION_KIND_UNKNOWN` / `WF_ACTION_SPEC_MISSING`** — the step's
  compiled bindings are missing `actionKind`/`spec` entirely (should
  not happen for a validly compiled plan).
- **`WF_ACTION_REF_RESOLVE`** — ancestor-ref token resolution failed.
- **`WF_ACTION_KIND_UNSUPPORTED`** — a compiled `actionKind` string the
  worker doesn't recognize.
- **`send_chat_message`**: `WF_ACTION_CHAT_MESSAGE_EMPTY` (blank
  message), `WF_ACTION_STEP_WAITING`/`WF_ACTION_RUN_WAITING` (failed to
  transition into `waiting`), `WF_ACTION_CHAT_BUBBLE_INSERT`.
- **`send_email`**: `WF_ACTION_EMAIL_TO_EMPTY`,
  `WF_ACTION_EMAIL_SUBJECT_EMPTY`, `WF_ACTION_EMAIL_BODY_EMPTY`,
  `WF_ACTION_EMAIL_SEND_FAILED` (only when a real SMTP transport is
  configured and rejects the send — the unconfigured case does not
  fail).
- **`send_api_request` direct mode**: `WF_ACTION_API_URL_REQUIRED`,
  `WF_ACTION_API_URL_DISALLOWED` (SSRF guard tripped),
  `WF_ACTION_API_BODY_TOO_LARGE`, `WF_ACTION_API_REQUEST_BUILD`,
  `WF_ACTION_API_REQUEST_FAILED` (transport error; a non-2xx/3xx HTTP
  response is recorded but is a distinct "unsuccessful response" path,
  not this error code).
- **`send_api_request` source mode**: see the dedicated error family
  above.

## Integration map

- [node-catalog.md](node-catalog.md) — the full node-kind catalog;
  action kinds are the `side_effect_actions` contract bucket.
- [chat-ingress.md](chat-ingress.md) — resumes a run parked by
  `send_chat_message` in `send_and_wait` mode.
- [ancestor-refs.md](ancestor-refs.md) — `{{alias}}` token resolution in
  action spec fields.
- [internal-api.md](internal-api.md) — the `workflow_action_outbound`
  journal and its interaction with run cancellation.
- [source-nodes.md](source-nodes.md) — the runner-mediated path
  `send_api_request`'s `source` mode reuses for encryption/auth.
- [engine-compile.md](engine-compile.md) — the compile-time
  `WF_COMPILE_ACTION_API_BODY_TOO_LARGE` cap this page's runtime guard
  mirrors.

## Validation checklist

- Step-test UI must require `confirm_live_execution` acknowledgement—engine enforces via `IsSideEffectActionKind`.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
