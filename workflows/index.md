# Workflows — index

## Read first

- [overview.md](overview.md)

## Pages

- [overview.md](overview.md) — Product feature for automation graphs: persisted as workflow_definition / workflow_version rows, compiled JSON in Supabase Storage, execution state in Postgres tables updated by worker under leases claimed from engine.
- [action-nodes.md](action-nodes.md) — Side-effect kinds send_chat_message, send_email, send_api_request (the side_effect_actions bucket in contracts/workflow_node_kinds.json).
- [agent-nodes.md](agent-nodes.md) — Steps invoking the agent service (LangGraph tools, prompts).
- [ai-findings.md](ai-findings.md) — Opt-in per-workflow AI report generated after a run completes: findings, opportunities, anomalies and remediation across every node. Covers the toggle, the enqueue trigger, the ai_finding_job queue and the scheduler scan.
- [ancestor-refs.md](ancestor-refs.md) — Nodes need access to fields from non-adjacent upstream steps — e.g. a slides node that must reference the original metric even though an aggregation node sits between them.
- [artifacts-storage.md](artifacts-storage.md) — Where workflow bytes actually live: the Supabase Storage bucket (default workflow) holding authored JSON, compiled plans, and step output artifacts, and the on-disk format the worker writes for durable step outputs (Parquet, not Arrow IPC).
- [builder-ui.md](builder-ui.md) — React-Flow builder under frontend/src/components/pages/workflows.
- [chat-ingress.md](chat-ingress.md) — How a chat_input_trigger workflow talks to a human over a conversational window: session lifecycle, the create-vs-resume decision on every posted message, and how the reply reaches the parked send_chat_message send_and_wait step.
- [data-analyst-node.md](data-analyst-node.md) — The data_analyst_agent node (builder label Data Analyst, category Analysis Agents) runs the Infusion data_analyst subagent non-interactively inside a workflow.
- [gis-correlation-node.md](gis-correlation-node.md) — The gis_correlation_agent node (builder label GIS Correlation Agent, category Analysis Agents) compares an upper map layer with the land layer under it and writes a verdict document naming the method used.
- [deployment.md](deployment.md) — Operating the workflow runtime — the engine (request/response API) and worker (queue-pulling executor) — in a deployed (Kubernetes/Helm) cluster: rollout order, secret bootstrap, post-deploy smoke tests, and rollback.
- [document-model.md](document-model.md) — Tables and storage objects representing definitions, versions, runs, and step runs.
- [engine-compile.md](engine-compile.md) — Compilation turns a workflow version authored graph into executable plans and artifacts.
- [engine-scheduler.md](engine-scheduler.md) — This page's original premise is superseded.
- [engine-sweeper.md](engine-sweeper.md) — The engine's in-process background loop (service.Sweeper) that reclaims expired step leases, enforces step/run timeouts, settles cancellations, cleans up stranded rows, and purges retention-expired runs.
- [internal-api.md](internal-api.md) — Server-to-server contract between the content service, the engine (Go), and the worker (Go).
- [local-dev.md](local-dev.md) — Running content, engine, worker and runner together on a developer machine for workflow feature work.
- [node-catalog.md](node-catalog.md) — Authoritative taxonomy for node kinds lives in contracts/workflow_node_kinds.json with _schema_version and four buckets: triggers, executable_triggers, side_effect_actions, non_executable.
- [output-agents.md](output-agents.md) — Slides and briefing output nodes (slides_agent, briefing_agent) are non-interactive agent runs that author real content via the Infusion subagents (slides_builder, briefing_creator).
- [permissions-matrix.md](permissions-matrix.md) — Who may read, write, execute, publish/unpublish, schedule/webhook, and delete workflows — the workspace-scoped RBAC matrix — plus the separate, differently-gated cross-workspace admin reporting surface.
- [runs-and-executions.md](runs-and-executions.md) — The lifecycle of a workflow_run and its child workflow_step_run rows from creation through a terminal state, the content-service routes that expose that lifecycle to the builder/library UI, and the separate cross-workspace admin reporting surface.
- [schedules.md](schedules.md) — How a schedule_trigger node's authored recurrence config becomes a firing schedule: the guided (non-cron-text) authoring fields, engine compilation into ScheduleSpec, and materialization on publish into the unified scheduled_job table.
- [source-nodes.md](source-nodes.md) — The source node kind: a step that runs an author-written query against a registered product source through the runner, the same encryption/auth/timeout handling as any other source-execution path.
- [transform-nodes.md](transform-nodes.md) — In-worker data-shaping steps (filter, if_else, switch_cases, edit_fields, aggregate, merge, and JQ-style document transforms) run by Executor.runTransform / executeTransformRuntime (worker/internal/worker/executor.go, worker/internal/worker/transform_runtime.go).
- [triggers.md](triggers.md) — The four trigger node kinds (manual_trigger, schedule_trigger, chat_input_trigger, webhook_trigger), how they differ in the compiled plan and in the builder, and which subset the content service can fire directly via POST .../runs versus which need an external ingress.
- [webhooks.md](webhooks.md) — The public HTTP ingress for webhook_trigger nodes: auth modes, rate-limiting, method enforcement, and how the captured request body becomes a workflow run's root input.
- [worker-executor.md](worker-executor.md) — worker/internal/worker/executor.go package doc and Executor struct define how leased step tickets become persisted results.
- [agent-authored-workflows.md](agent-authored-workflows.md) — How a chat turn becomes a workflow: the planner's routing decision, the workflow_builder / workflow_answerer subagents, the review card, running the reviewed workflow and collecting its answer, and saving it as a real definition.
- [authoring-sdk.md](authoring-sdk.md) — The typed Python builder (workflow_sdk/) the agent writes programs in: what each call means, what it checks at author time, and what it emits as an authored document.
- [sdk-delivery-record.md](sdk-delivery-record.md) — What the authoring SDK was measured against and what the numbers were.
