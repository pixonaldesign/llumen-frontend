---
topic: workflows
services: [content, engine]
status: current
verified_on: 2026-10-04
---
# Flow webhooks

## Audience and goal

The public HTTP ingress for `webhook_trigger` nodes: auth modes,
rate limiting, method enforcement, and how the captured request becomes a
Flow run's root input. Materialization (allocating `path_key`/`secret_ref`,
mapping definition → version → trigger node) is owned by the engine (see
[engine-scheduler.md](engine-scheduler.md)); the ingress only reads the
materialized binding rows.

## Read first

- `content/internal/api/handlers/flow_webhooks.go` — `FlowWebhookHandler`
  (`Register`, `Receive`, `Options`, `Head`).
- `content/internal/api/services/flowwebhook/` — `LoadBinding`,
  `Authenticate`, `ResolveSecret`, `Verifier` (OAuth2 + JWKS cache),
  `RedisLimiter`/`MemoryLimiter`, `ReadBody`/`BuildCapture`.
- `content/internal/api/handlers/flow_triggers.go` — the trigger list and
  the webhook secret routes the Flow detail page uses.
- `engine/internal/engine/compile.go` — `WebhookSpec`, `WebhookOAuth2Spec`.

## How it works

The public path is `/api/workflow-webhooks/{path_key}`. Third-party systems
hold it, so it never changes. Content serves it outside `/api/content/v1`;
the Helm Ingress and the compose Traefik routes send it to content ahead of
the `/api` catch-all (see [../deployment/ingress.md](../deployment/ingress.md)).
There is no user session: every read and write uses the service role, and
the route needs the `workflows` licence (402 otherwise).

`Receive` (GET/POST/PUT/PATCH/DELETE) runs cheap checks before expensive or
sensitive ones:

1. **Load binding** — `workflow_webhook_endpoint` by `path_key`. Unknown →
   `404 WF_WEBHOOK_NOT_FOUND`; disabled → `410 WF_WEBHOOK_DISABLED`.
2. **Method** — the binding's `method` (default `POST`) must match, else
   `405 WF_WEBHOOK_METHOD_NOT_ALLOWED` with `Allow`. Checked before auth so a
   401-vs-405 difference never says whether a secret was right.
3. **Auth and rate limit.** For `auth_mode = none` the rate-limit token is
   taken first. For every other mode the sender is authenticated first and
   the token taken after, so a sender without the secret cannot spend the
   real sender's budget. Failed authentications spend a separate bucket per
   binding and sender address (30 burst, refilling one every 2 s); once it is
   empty that sender gets `429 WF_WEBHOOK_RATE_LIMITED` before the secret is
   even read, right key or not. A 401 for a secret that is not provisioned is
   not counted, since there is nothing to guess.
   - `basic` / `api_key` / `bearer` compare against the binding's secret,
     decrypted from `workflow_webhook_secret` with `CONNECTION_ENCRYPTION_KEY`.
     The comparison hashes both sides and compares in constant time, so any
     bytes are safe. A value that does not decrypt is treated as **not
     provisioned** (401) and is never compared as plaintext.
   - `oauth2` verifies a bearer JWT against `oauth2_config` (camelCase
     `jwksUri`/`requiredClaims` as the engine writes it; snake_case also
     read). See OAuth2 below.
4. **Body** — read to at most 1 MiB + 1 byte; larger is
   `413 WF_WEBHOOK_BODY_TOO_LARGE` with `max_bytes` (and `received_bytes`
   when a Content-Length was sent). A body declared JSON
   (`application/json` or `+json`) must parse, else
   `400 WF_WEBHOOK_BODY_NOT_JSON`; any other body is captured as
   `{"raw_base64": …}`.
5. **Persist and run.** The capture `{received_at, method, path, query,
   headers, body}` is stored through the storage door at
   `workflow-definitions/{id}/webhook-inputs/{leaf}` and recorded as a
   `workflow_document` (`other`, uncompressed). The engine then creates a
   `production` run with `trigger_type = webhook` and
   `root_input_document_id` set. The answer is
   `200 {workflow_run_id, root_input_document_id, trace_id}`.

Credentials never reach the stored capture: `authorization`,
`proxy-authorization`, `x-api-key`, `cookie`, `set-cookie` and any header
whose name contains `signature`, `token`, `secret` or `api-key` are stored
as `[redacted]`, as are query parameters named like a credential (`token`,
`access_token`, `api_key`, `apikey`, `key`, `secret`, `signature`, `sig`,
`password`, `auth`, or containing `token`/`secret`/`password`/`signature`).

**No orphan documents.** The engine is checked before anything is stored
(`503` if it is not configured). When the engine definitely refuses the run
(a 4xx), the document row and its object are deleted, best effort: `409
WF_RUN_ALREADY_ACTIVE`, `410` for `WF_RUN_WORKFLOW_NOT_PUBLISHED` /
`WF_RUN_VERSION_NOT_PUBLISHED`, `502` for anything else.

**A slow engine does not lose the run.** The run is created under the
idempotency key `webhook:{document id}`, with a 60 s timeout. When the answer
leaves it unknown whether the run exists (a timeout, a transport error, a
5xx), content asks once more under the same key, which returns the run the
first call created or creates it. If that is still unknown, the answer is
`502` and the capture is kept, because a run may be reading it.

`OPTIONS` answers method discovery with `Allow`,
`Access-Control-Allow-Methods`, `Access-Control-Allow-Headers` and
`Access-Control-Max-Age: 600`. A browser preflight (one carrying `Origin`
and `Access-Control-Request-Method`) is answered by content's global CORS
middleware before it reaches the handler; it allows `X-Api-Key`, so an
`api_key` binding works from a browser. `HEAD` is a reachability probe.
Neither creates a run or takes a rate-limit token; both still answer
404/410.

### OAuth2

- Algorithms: only `RS256/384/512`, `PS256/384/512`, `ES256/384/512`;
  default `["RS256"]`. HMAC is never accepted.
- `exp` and `iat` are required; `iss` and `aud` must match.
- JWKS URI: `jwksUri`, else `{issuer}/.well-known/jwks.json`. It must be
  `https` (plain `http` only when the handler's `AllowInsecureJWKS` is set,
  for local development). Link-local and cloud-metadata addresses are
  refused, at parse time and again at connect time (which covers DNS
  rebinding and redirects); private on-prem IdP addresses are allowed.
- Keys: RSA and EC (P-256/384/521), picked by `kid`, or the only key when
  the token has none. The key set is cached per URI for 300 s; an unknown
  `kid` refetches at most once every 30 s.
- Required claims: list claims match by membership, others by exact text
  (numbers as written, booleans `True`/`False`).
- Failures are 401 with `WF_WEBHOOK_OAUTH2_*` codes: `NOT_CONFIGURED`,
  `BEARER_REQUIRED`, `JWKS_UNAVAILABLE`, `INVALID_JWKS_URI`,
  `INVALID_TOKEN`, `TOKEN_EXPIRED`, `AUDIENCE_MISMATCH`, `ISSUER_MISMATCH`,
  `ALG_NOT_ALLOWED`, `CLAIM_MISSING`, `CLAIM_MISMATCH`.

## Trigger and secret routes

Under the Flow routes (`workflows` licence, workspace scope checked under
the caller's own client; binding and secret rows use the service role):

- `GET /api/content/v1/workspaces/{ws}/flow-definitions/{id}/triggers` →
  `{schedules, webhooks}`. Schedules come from `scheduled_job`, or the legacy
  `workflow_schedule` table. Each webhook carries `public_url`
  (`APP_URL` + the public path; without `APP_URL`, the request's forwarded
  scheme and host) and `secret_provisioned`. The secret is never returned.
- `PUT …/webhook-bindings/{triggerNodeId}/secret` with
  `{"secret_value": "…"}` (basic: `username:password`) stores it
  Fernet-encrypted → `{secret_ref, secret_provisioned: true}`. 400 for
  `auth_mode none` and for a secret shorter than 16 characters (the password
  half for basic; secrets set before this rule keep working), 409 when no
  `secret_ref` is allocated, 500 when `CONNECTION_ENCRYPTION_KEY` is missing.
- `DELETE` the same path → 204; the webhook then answers 401.

## Configuration and operations

- Rate limit: a token bucket per `path_key`, 60 burst, refilling 1 per
  second, shared across content replicas in Redis
  (`llumen:content:flow-webhook:rate:{path_key}`, one Lua script). The
  failed-login bucket uses the same script under
  `llumen:content:flow-webhook:auth-fail:{path_key}|{sender}`. Without
  `REDIS_URL`, or while Redis fails, each replica limits on its own instead
  of refusing calls. A 429 carries `Retry-After` (seconds until one token
  is back), `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  and `retry_after_seconds` in the body.
- The rate, the JWKS TTL (300 s) and the JWKS timeout (5 s) are constants in
  `flowwebhook`; there are no environment variables for them.
- `workflow_webhook_endpoint.auth_mode` is a Postgres enum: `none`, `basic`,
  `api_key`, `bearer`, `oauth2`. An `oauth2` row must carry
  `oauth2_config` (table constraint).
- Errors use content's envelope: `{"error": "<sentence>", "code": "WF_…"}`
  plus any extra fields (`allow`, `retry_after_seconds`, `max_bytes`,
  `received_bytes`) at the top level.

## Integration map

- [triggers.md](triggers.md) — `webhook_trigger` is one of the four
  trigger kinds.
- [engine-scheduler.md](engine-scheduler.md) — materialization of
  `workflow_webhook_endpoint` rows on publish/unpublish.
- [chat-ingress.md](chat-ingress.md) — the sibling ingress with the same
  "capture as `workflow_document`, set `root_input_document_id`" pattern.
- [runs-and-executions.md](runs-and-executions.md) — the
  `create_run` / `WF_RUN_ALREADY_ACTIVE` contract.

## Validation checklist

- After changing the codes, statuses or headers, re-read this page: senders
  outside Llumen branch on them.
- `go test ./internal/api/services/flowwebhook/ ./internal/api/handlers/ -run 'FlowWebhook|FlowTriggers'`
  in `content/`.
