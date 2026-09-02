# Career Workbench Architecture

Status: target architecture for the initial implementation

This document is the shortest useful map of Career Workbench. It explains the
major parts, their dependency direction, the boundaries that must remain
visible, and where a change belongs. It deliberately avoids details that are
expected to change frequently.

`SPEC.md` is normative. `MILESTONES.md` describes the sequence for reaching this
architecture. Directories named below are introduced by those milestones; their
absence in an early checkout is not an alternative architecture.

## Bird's-eye view

Career Workbench turns user-approved career evidence and untrusted opportunity
material into inspectable decisions and artifacts.

```text
                         Career Workbench

  Web UI ----------------------------------------------------------+
    | structured commands, queries, approvals, corrections         |
    v                                                              |
  Application API -----> deterministic domain core -----> storage  |
    |                         |                          |           |
    |                         | validated proposals      | events    |
    v                         v                          v           |
  DSH Cordis plugin -----> DeepSeek Harness --------> activity feed+
                              |
                              +--> ordinary domain tools
                              +--> native continuable subagents
                              +--> ipython / ctx.rlm when selected
                                        |
                                        +--> DSH host bridge

  Career Ops importer -----> versioned import boundary -----> domain core
```

The deterministic domain core is authoritative for career data and business
state. DSH is authoritative for agent execution. The web application presents
both without becoming the owner of either.

## Ground state and derived state

The architecture distinguishes data that can authorize behavior from data that
can be recomputed.

Ground state:

- the versioned workspace configuration;
- user-approved profile facts and their provenance;
- captured source documents and content identities;
- opportunities and applications;
- accepted and rejected evidence;
- workflow and approval state;
- immutable domain events and artifact identities; and
- DSH-owned session, tool, and child records within the DSH store.

Derived state:

- search indexes;
- denormalized summaries and dashboard counts;
- recalculated evaluation aggregates;
- cached source projections;
- display-specific view models; and
- the live Python namespace and its snapshots.

**Architecture invariant:** derived state never authorizes a candidate fact, an
external action, or a domain transition by itself.

## Dependency direction

```text
contracts <- domain <- application services <- API / DSH / import adapters
                    <- storage ports         <- SQLite / artifact adapters
```

Dependencies point toward the domain. The domain does not import HTTP, DSH,
Cordis, Jupyter, browser, database-driver, or frontend code.

The outer adapters translate external representations into domain commands and
queries. They do not reimplement domain policy.

## Code map

### `apps/web`

The purpose-built browser interface. It renders opportunities, evaluations,
evidence, applications, artifacts, approvals, conversations, and running work.
It consumes versioned API contracts and an event stream.

**API boundary:** frontend data types come from `packages/contracts`; the web
application does not import storage records or DSH internals.

**Architecture invariant:** the frontend is not required for backend
correctness. A disconnected or stale client cannot authorize a mutation.

### `apps/server`

The local application host. It assembles the domain services, storage adapters,
HTTP API, event delivery, import support, and DSH plugin configuration.

For the bounded in-page profile organizer, the loopback server composes the
published DSH Agent loop, DSH credential store, model adapter, and native Career
Workbench plugin. A same-origin browser command may start that one turn, but
only the exact DSH Agent can call the source-bound proposal tools; the server
returns canonical operation/result identities after the DSH terminal.

This is an entry point and composition root. It may know concrete packages; no
core package may depend on it.

**Architecture invariant:** the server does not call a model provider. Model
work is requested through DSH-owned services.

### `packages/contracts`

Serializable request, response, event, and error schemas shared by adapters and
clients. Contracts are versioned and tested as data.

**API boundary:** public HTTP and Cordis payloads cross here. Internal domain
objects do not leak automatically merely because their fields are convenient.

### `packages/domain`

The deterministic center of the product. It defines identifiers, value types,
entities, invariants, commands, queries, state machines, scoring arithmetic,
evidence rules, approval requirements, and domain errors.

The package operates against explicit ports for time, identity generation,
storage, and artifact access so its behavior is deterministic under test.

**Architecture invariants:**

- the domain performs no network or filesystem I/O;
- model prose is never a domain command;
- every mutation passes schema and state-transition validation;
- candidate-specific claims require accepted primary evidence; and
- scoring aggregation is code, even when semantic inputs were proposed by a
  model.

### `packages/storage`

Implements the durable workspace using SQLite plus a content-addressed artifact
directory. It owns schema migrations, transactions, concurrency control,
backups, and export/import plumbing.

SQLite is the canonical structured store for Career Workbench. Human-readable
JSON and Markdown are supported export formats, not a second writable source of
truth.

**Architecture invariant:** a successful mutation commits its domain records and
audit event atomically. Artifacts use staged writes and content identities so a
database record never claims an unsealed artifact.

### `packages/application`

Coordinates use cases across the domain and its ports: onboarding, source
capture, opportunity evaluation, comparison, application tracking, correction,
artifact generation, approval, and recovery.

It is responsible for idempotency and transaction boundaries, not for HTTP or
DSH transport details.

### `packages/dsh-plugin`

The native Cordis integration installed into a compatible DSH profile. It
registers Career Workbench services, tools, prompt guidance, and event
translation.

DSH remains the sole harness. The plugin uses the exact originating DSH Agent
for model, tool, approval, session, lineage, child, cancellation, and
persistence authority.

**API boundary:** structured domain tools enter and leave through this package.
It translates domain errors into stable tool failures without hiding them.

**Architecture invariants:**

- the plugin never launches another agent CLI or agent loop;
- the plugin and backend never call an LLM provider directly;
- model and reasoning selections are passed exactly or rejected as unsupported;
- native children use public `ctx.subagents` services;
- RLM uses public `ctx.rlm` and the exclusive `ipython` tool; and
- no compatibility path accesses DSH continuation-manager private fields.

### `packages/career-ops-import`

A one-way, version-aware boundary for importing supported Career Ops workspaces.
It discovers source files, reports unsupported or ambiguous input, constructs a
preview, and applies only user-approved import commands.

It may contain upstream-specific parsing. The rest of Career Workbench may not.

**Architecture invariant:** import is not synchronization. After a successful
import, Career Workbench owns the resulting records. It never writes back to the
source Career Ops workspace unless a future, separately specified exporter is
introduced.

### `packages/evals`

Synthetic cases, scoring fixtures, task scripts, usability protocols, and
comparison reducers. It tests upstream Career Ops, ordinary DSH orchestration,
and DSH with RLM as distinct routes.

Evaluator-only truth and expected results never enter model-visible input.

### `docs`

Longer installation, security, API, migration, evaluation, and operations
guides. Stable architecture belongs here only when it would make this map too
detailed.

## Principal flows

### Capture and evaluate an opportunity

```text
User or scanner
  -> API captures immutable source bytes
  -> domain normalizes an Opportunity
  -> DSH Agent receives a bounded evaluation objective
  -> ordinary tools, children, or RLM propose evidence
  -> domain validates evidence and computes the rubric
  -> storage commits evaluation + evidence + audit event
  -> web UI renders result, gaps, provenance, and activity
```

### Correct a candidate fact

```text
User submits correction
  -> domain records superseding fact and provenance
  -> dependency query identifies affected evaluations and artifacts
  -> affected outputs become stale
  -> user may request bounded re-evaluation
  -> old evidence remains auditable but cannot re-enter as accepted truth
```

### Use RLM

```text
DSH Agent selects ipython for a bounded reason
  -> ctx.rlm executes in the Agent-owned persistent kernel
  -> Python may compute or request DSH-hosted capabilities through the bridge
  -> provider and child calls remain native DSH operations
  -> structured proposals return to domain validation
  -> durable career state is committed outside the notebook
```

The Python namespace can help carry an investigation. It is not the durable
career ledger, approval service, or workflow state machine.

## System boundaries

### Browser boundary

The browser is untrusted input. The server validates every command, binds
mutations to the active workspace, protects local endpoints against cross-site
requests, and never trusts client-side approval state.

### External-content boundary

Job postings, company pages, emails, forms, plugin responses, and imported text
are data. They may contribute evidence but cannot issue instructions, broaden
authority, reveal secrets, or trigger unrelated mutations.

### DSH boundary

Career Workbench requests model-mediated work through public DSH services. DSH
owns the live Agent and its lifecycle. Career Workbench owns domain admission
and validation before and after model work.

### Python boundary

IPython executes with operating-system authority. It is not constrained by DSH
tool policy merely because it was reached through a DSH tool. Only calls routed
back through the DSH bridge regain DSH tool guards, approvals, logging, and
telemetry.

### Upstream boundary

Career Ops is external input. A pinned compatibility profile and fixtures
describe what an importer supports. DSH and the RLM bundle are also external
systems selected atomically at tested revisions.

## Cross-cutting concerns

### Provenance

Every accepted evidence item retains a source identity, locator, proposer,
classification, validation decision, and revision. Generated artifacts record
the exact accepted evidence and rubric revision that authorized them.

### Cancellation

Cancellation flows from DSH or the user interface to the active operation.
Canceled work may preserve already committed evidence, but it cannot publish an
unvalidated terminal artifact. A kernel generation that ignores interruption is
retired and fenced by the RLM provider.

### Recovery

Domain recovery is event- and transaction-based. DSH recovery is session-based.
RLM recovery uses authorized snapshots and never replays historical cells. These
mechanisms may correlate identities but do not impersonate one another.

### Observability

The product exposes closed operation states, child lineage, tool activity,
accepted and rejected evidence counts, approvals, failures, cancellation, and
resource use. Humanized summaries are display data; state transitions depend on
typed events.

### Privacy and secrets

Career data may contain highly sensitive personal information. Logs, fixtures,
screenshots, exports, and test evidence use synthetic or scrubbed data. Provider
credentials, connection keys, and full environment values never enter the
workspace database, artifacts, snapshots, or model-visible events.

### Testing

Tests concentrate at boundaries:

- data-driven domain tests for invariants and state machines;
- storage contract tests against real SQLite transactions and migrations;
- import tests against pinned synthetic and upstream-compatible fixtures;
- API schema and browser integration tests;
- DSH plugin contract tests and real profile composition;
- real Jupyter persistence, cancellation, and restore tests; and
- task-based usability comparisons with synthetic career data.

### Upgrades

An upstream upgrade changes an explicit compatibility record. DSH package sets
are atomic. Career Ops import profiles are versioned. Database migrations are
forward-only and backed up before destructive transformation. No dependency
range is widened merely because installation succeeds.

## Where a change belongs

| Change                                                | Owner                        |
| ----------------------------------------------------- | ---------------------------- |
| Candidate-fact or evidence rule                       | `packages/domain`            |
| Evaluation arithmetic or state transition             | `packages/domain`            |
| Use-case transaction or idempotency                   | `packages/application`       |
| SQLite schema, migration, backup, or artifact sealing | `packages/storage`           |
| Public JSON/event shape                               | `packages/contracts`         |
| HTTP route or local server lifecycle                  | `apps/server`                |
| Screen, interaction, or client state                  | `apps/web`                   |
| DSH service, tool, prompt, or event translation       | `packages/dsh-plugin`        |
| Career Ops parsing or compatibility                   | `packages/career-ops-import` |
| Provider, Agent, or native child semantics            | upstream DSH public seam     |
| Kernel, snapshot, or Python bridge semantics          | the RLM bundle public seam   |

## Architectural nonclaims

This design does not claim that SQLite is a security boundary, that local-first
means sandboxed, that IPython is constrained, that model explanations are proof,
that every Career Ops workflow will be reproduced, or that RLM improves career
outcomes. Those claims require separate controls and evidence.
