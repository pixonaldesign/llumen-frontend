---
topic: workflows
services: [content]
status: current
verified_against: "de58501f4a8165ce89b19a4257b8f030d01f6280"
verified_on: 2026-07-29
---
# Workflow permissions matrix

## Audience and goal

Who may read, write, execute, publish/unpublish, schedule/webhook, and
delete Flows — the workspace-scoped RBAC matrix — plus the
separate, differently-gated cross-workspace admin reporting surface.
[../authorization/workflow-rbac.md](../authorization/workflow-rbac.md)
has the full enforcement detail.

## Read first

- `content/internal/api/services/flows/scope.go` — `ResolveScope`, the
  gate on every Flow route in the content service, including the trigger
  list, webhook secrets, Flow chat and assistant proposals.
- `content/internal/api/handlers/flows_test.go` — the regression tests for
  the gate.
- `telemetry/internal/api/flowruns.go` — separate gate, see below.

## How it works

The matrix:

| role | read | write (draft) | execute (runs) | publish / unpublish | schedule / webhook | delete |
|---|---|---|---|---|---|---|
| `system_admin` | Y | Y | Y | Y | Y | Y |
| `data_admin` | Y | Y | Y | Y | Y | Y |
| `workspace_admin` | Y | Y | Y | Y | Y | Y |
| `contributor` | Y | Y | Y | Y | Y | Y |
| `editor` | Y | Y | Y | Y | Y | Y |
| `viewer` | Y | N | N | N | N | N |
| `guest` | N | N | N | N | N | N |

`workspace_admin`, `contributor`, and `editor` are **treated
identically** for workflows — a locked product decision; there is no
internal ladder between the three.

**Content (Flow definitions and runs).** Every route calls
`flows.ResolveScope(..., write)`, which resolves whether the URL's
workspace segment is a team workspace or the caller's private
workspace. For a **team** workspace a write calls the RLS function
`workflow_definition_writable` (`system_admin`, `data_admin`,
`workspace_admin`, `contributor`, `editor`) and a read asks
`is_system_admin`, `is_data_admin`, then `is_workspace_member`. Every
query then runs on the caller's JWT client, so RLS decides which rows
exist. The engine treats inbound internal calls as already authorised
(gated by `X-Engine-Key`), so the content gate is the only role check
before a run, version write, publish, cancel or purge.

The trigger list, webhook secrets, Flow chat and assistant-proposal routes
are content's too and go through the same `ResolveScope` gate.

**Private workspaces skip the role table entirely.** If the URL's
workspace segment resolves to a row in `user_private_workspace` owned
by the caller, both gates return immediately with no role check. Since
that lookup is scoped to the caller's user id, only the owner's own
private workspace can ever match; ownership *is* the check.

## A second, separate gate: cross-workspace audit reporting

The workspace-scoped matrix above governs the Flow routes only.
Telemetry's `/api/telemetry/audit/flow-runs` routes (Platform Settings ▸
Reporting's "Workflow Runs" tab) are gated entirely differently:
`requireAuditAdmin` (system_admin **or** security_admin) plus the
`workflow_runs` licence feature. The role check intentionally crosses workspace
boundaries — a security_admin who is not a member of a given workspace can
still read that workspace's run history through this surface. It's
read-only (no write/execute/publish/schedule/delete actions live here), so
it doesn't extend the workspace RBAC matrix, it sits beside it. See
[runs-and-executions.md](runs-and-executions.md).

## Critical paths

1. **Any Flow route (content)** — request →
   `flows.ResolveScope(..., write)` → private-workspace short-circuit,
   or the write/read gate → `Scope.Column` picks `workspace_id` vs
   `private_workspace_id` for the query's scope filter.
2. **Cross-workspace admin report** — `GET
   /api/telemetry/audit/flow-runs...` → telemetry's `requireAuditAdmin`
   (bypasses the workspace matrix entirely) →
   [runs-and-executions.md](runs-and-executions.md).

## Configuration and operations

- No env-var configuration; the matrix is a product decision encoded in
  `workflow_definition_writable`/`workflow_definition_deletable` and
  `flows.ResolveScope`'s read gate, not a database-driven ACL.
- Role names (`system_admin`, `data_admin`, `workspace_admin`,
  `contributor`, `editor`, `viewer`, `guest`) are the platform's shared
  workspace-role vocabulary — see [../authorization/overview.md](../authorization/overview.md).

## Failure modes and edge cases

- **Missing/insufficient role on a team workspace** — `403` from
  `ResolveScope`.
- **A new mutating endpoint that forgets the write gate** — silently
  becomes a read-gated route; there is no automatic inference from HTTP
  verb. A content handler passes `true` to `begin` (or to `ResolveScope`).
- **Role-check RPC failure** — content answers `503` (the answer is
  unknown). This is not an authorization bypass.
- **A private-workspace id that isn't the caller's own** — the
  ownership lookup simply returns no rows, so the code falls through to
  the team-workspace role check against an id that isn't a real team
  workspace either — effectively a `403`/`404`-shaped failure, not a
  cross-tenant leak.

## Integration map

- [runs-and-executions.md](runs-and-executions.md) — the cross-workspace
  telemetry flow-runs surface this page's matrix does not cover.
- [../authorization/overview.md](../authorization/overview.md) — the
  platform-wide RBAC/RLS model this page's workspace roles are drawn
  from.
- [document-model.md](document-model.md) — `workflow_definition.private_workspace_id`
  vs `workspace_id`, the two scoping columns the gates choose between.
- [../authorization/workflow-rbac.md](../authorization/workflow-rbac.md)
  — enforcement detail and licence gates.

## Validation checklist

- Any new mutating endpoint must take the write gate explicitly.
- `make test-content` after changing `ResolveScope` or the role table.
- Verified against commit `de58501f4a8165ce89b19a4257b8f030d01f6280`.
