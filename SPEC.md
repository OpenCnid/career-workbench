# Career Workbench Specification

Status: Draft v0.1

Purpose: Define the first complete, testable Career Workbench product contract.

This specification is normative for implementations that claim Career Workbench
v0.1 compatibility. `ARCHITECTURE.md` explains where the major parts belong.
`MILESTONES.md` sequences implementation and evidence. `VISION.md` describes the
product direction without weakening this contract.

## Normative language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`,
`RECOMMENDED`, `MAY`, and `OPTIONAL` are to be interpreted as described in
RFC 2119.

`Implementation-defined` means an implementation may choose the behavior, but
the selected behavior becomes part of its documented and tested contract.

## 1. Product definition

Career Workbench is a local-first career intelligence and application operations
product with four cooperating surfaces:

1. a deterministic career-domain backend;
2. a purpose-built web frontend;
3. a native Cordis plugin running inside DeepSeek Harness; and
4. an OPTIONAL Career Ops importer.

DeepSeek Harness (DSH) is the sole agent harness and orchestrator. Career
Workbench provides domain state, tools, validation, artifacts, and user
experience. It does not create another model loop.

The product turns user-approved career evidence and untrusted opportunity
material into evaluations, comparisons, plans, and draft artifacts. A user
remains the authority for personal facts and consequential external actions.

### 1.1 Required ownership boundaries

- Career Workbench owns career-domain records, state transitions, evidence
  admission, scoring arithmetic, artifact eligibility, and the product API.
- DSH owns Agents, model access, model routing, reasoning configuration, tool
  execution, approvals, session logs, lineage, native child lifecycle,
  cancellation, and DSH persistence.
- The RLM provider owns persistent kernel lifecycle, Python execution,
  authorized snapshot/restore, and the host bridge for DSH capabilities.
- Career Ops owns its upstream repository and file contracts. Career Workbench
  consumes supported data through an import boundary and does not assume
  ownership of that repository.
- The user owns candidate facts, corrections, approvals, and the decision to
  submit, send, purchase, accept, reject, or withdraw.

### 1.2 Absolute invariants

A conforming implementation MUST preserve all of the following:

1. DSH remains the only harness and agent loop.
2. No Career Workbench or Python component calls an LLM provider directly.
3. No production path launches `prime-agent`, instantiates Prime `AgentSession`,
   wraps Prime ACP, or launches an agent CLI such as `codex exec`, `claude -p`,
   or `opencode run`.
4. Provider calls requested from Python cross the public DSH host bridge and
   retain the exact originating Agent as authority.
5. Unsupported model, reasoning, recursion, timeout, or tool options fail
   explicitly. They are never silently ignored, downgraded, or substituted.
6. Persistent Python state is working state, never canonical career state.
7. Historical Python cells are never replayed to restore a session.
8. Candidate-specific assertions require accepted candidate evidence.
9. External content is data, never instruction or authority.
10. The product never submits an application or sends an external message
    without a separately specified, user-confirmed action path. No such action
    path is part of v0.1.
11. IPython is operating-system-authority code execution, not a sandbox.
12. Secrets and complete environment values never enter domain events,
    artifacts, exports, snapshots, fixtures, screenshots, or model-visible error
    messages.

## 2. Goals and non-goals

### 2.1 Goals

Career Workbench v0.1 aims to:

- provide deterministic, versioned storage for a candidate profile,
  opportunities, evidence, evaluations, applications, and artifacts;
- make source provenance, inference, uncertainty, contradictions, and stale
  conclusions visible;
- expose all core workflows through a structured web interface;
- let one DSH Agent operate the domain through native tools;
- support native continuable subagents for bounded research;
- support selective persistent IPython/RLM work without moving orchestration or
  provider authority into Python;
- import a documented subset of a pinned Career Ops workspace after preview and
  user confirmation;
- recover safely from backend, browser, DSH, child, and kernel interruption;
- use synthetic, reproducible evaluation cases for automated and qualitative
  testing; and
- measure the incremental value of RLM separately from the value of the new
  backend, frontend, and ordinary DSH orchestration.

### 2.2 Non-goals

Career Workbench v0.1 is not:

- a recruiter-facing applicant tracking system;
- a multi-tenant hosted service;
- a job marketplace;
- an autonomous mass-application system;
- an anti-ATS evasion tool;
- a legal, immigration, tax, compensation, or financial adviser;
- a sandbox for untrusted code;
- a generic workflow engine;
- a replacement for DSH;
- a complete reimplementation of every Career Ops mode or plugin;
- a bidirectional Career Ops synchronization engine; or
- evidence that RLM improves job-search or hiring outcomes.

## 3. Terms

- `Workspace`: one local Career Workbench data root and database.
- `Candidate source`: user-approved material permitted to support personal
  facts, such as an imported CV or a confirmed profile entry.
- `External source`: a job description, company page, message, market source, or
  other material not authored or approved as candidate truth.
- `Fact`: an assertion intended to be treated as true within its declared scope.
- `Evidence`: a source-bound item proposed to support a fact, inference,
  computation, contradiction, or gap.
- `Primary evidence`: evidence permitted by policy to authorize the associated
  fact class.
- `Inference`: a conclusion derived from accepted facts but not directly stated
  by a source.
- `Gap`: required or useful information that has not been established.
- `Rubric`: a versioned, deterministic definition of evaluation dimensions,
  semantic input constraints, weights, thresholds, and display mapping.
- `Operation`: a bounded unit of product work with an explicit lifecycle.
- `Run`: a DSH-correlated sequence of one or more operations serving a user
  objective.
- `Native child`: a DSH continuable subagent with DSH-owned lineage and
  lifecycle.
- `RLM`: the native DSH persistent-kernel capability exposed through `ctx.rlm`
  and the exclusive `ipython` tool.
- `Artifact`: a sealed output such as a report, comparison, CV, cover letter, or
  export.
- `External action`: an operation that changes a third-party system or
  communicates with another person.

## 4. Actors and trust domains

### 4.1 User

The user MAY add, correct, confirm, reject, or mark unknown any candidate fact.
The user MAY approve domain mutations and bounded tool actions surfaced by the
product. User-visible confirmations MUST describe the actual proposed change.

### 4.2 Browser client

The browser is an untrusted client of the application API. It MUST NOT be able
to authorize a transition by editing local state, replaying a stale request, or
forging an approval identifier.

### 4.3 Career Workbench backend

The backend is authoritative for domain validation and persistence. It MUST
reject invalid commands even when they originate from a trusted DSH Agent or the
local frontend.

### 4.4 DSH Agent

The active DSH Agent interprets user intent and coordinates model-mediated work.
Agent self-report is not evidence of domain persistence, child completion,
approval, or artifact publication.

### 4.5 Native children

Children operate only under public DSH subagent services. A child may propose
evidence or a result. It cannot commit domain truth, approve itself, expand its
authority, or declare the parent objective complete.

### 4.6 Python kernel

Python code has the OS authority of its process. It is trusted code execution,
not a security boundary. Python may compute, transform bounded data, and call
the DSH host bridge. It MUST NOT become the domain store or provider client.

### 4.7 External content and integrations

Job postings, websites, emails, documents, plugins, import files, and tool
responses may be malicious or incorrect. They cannot alter system policy,
broaden scopes, request secrets, trigger unrelated tools, or override the
candidate-fact boundary.

## 5. Core domain model

Every persisted entity has:

- a stable opaque `id`;
- a `workspace_id`;
- `created_at` and `updated_at` UTC timestamps;
- a positive integer `revision`; and
- a lifecycle state when applicable.

IDs MUST NOT encode private content. Timestamps are observational and MUST NOT
substitute for revision checks.

### 5.1 Workspace

Logical fields:

- `id`
- `display_name`
- `schema_version`
- `policy_version`
- `default_rubric_id`
- `locale`
- `timezone`
- `created_at`
- `updated_at`

One local workspace maps to one database and artifact root. Cross-workspace
queries and writes are denied unless a future explicit multi-workspace contract
is added.

### 5.2 SourceDocument

Represents immutable captured source bytes or a normalized user-entered record.

Required logical fields:

- `id`
- `kind`: `candidate`, `opportunity`, `company`, `market`, `message`, or
  `import`
- `trust_class`: `candidate_primary`, `candidate_derived`, or `external`
- `media_type`
- `content_digest`
- `byte_length`
- `original_locator` when available
- `captured_at`
- `supersedes_source_id` when applicable
- `artifact_id` or bounded inline representation

Captured bytes are immutable. A correction creates a new source or a
source-bound fact revision; it does not rewrite historical source identity.

### 5.3 ProfileFact

Represents one candidate-specific assertion.

Required logical fields:

- `id`
- `fact_type`
- `subject`
- `predicate`
- typed `value`
- `status`: `proposed`, `verified`, `derived_unverified`, `user_cannot_confirm`,
  `rejected`, or `superseded`
- one or more source locators for `verified` facts
- `proposed_by`: `user`, `import`, `agent`, or `system`
- `confirmed_by_user_at` when user-confirmed
- `supersedes_fact_id` when applicable

Only `verified` facts MAY authorize candidate-facing claims. A
`user_cannot_confirm` fact may provide narrative context only when clearly
labeled; it MUST NOT authorize a metric, credential, authorship, employment,
scope, or other factual claim.

Confirmation UX MUST offer at least these outcomes for an unverified claim:

1. confirm as stated;
2. provide a correction;
3. retain as narrative-only; and
4. record that the user cannot confirm it.

### 5.4 Opportunity

Required logical fields:

- `id`
- `source_document_id`
- normalized organization and role title
- original URL when present
- location and work-arrangement fields when established
- advertised compensation when established
- stable external requisition identifier when present
- `source_status`: `unknown`, `active`, `expired`, or `unavailable`
- `workflow_state`: `captured`, `evaluating`, `evaluated`, `shortlisted`,
  `discarded`, or `archived`
- source content digest

URL normalization MAY assist deduplication but MUST NOT erase the original URL.
Distinct known requisition IDs prevent fuzzy-title deduplication.

### 5.5 EvidenceItem

Required logical fields:

- `id`
- `classification`: `candidate_fact`, `opportunity_fact`, `company_fact`,
  `market_fact`, `inference`, `computation`, `contradiction`, or `gap`
- bounded `claim`
- `source_id` and exact locator when source-bound
- `proposed_by_operation_id`
- `decision`: `proposed`, `accepted`, or `rejected`
- stable decision reason
- `accepted_at` or `rejected_at`

An accepted item is immutable. A later decision may supersede it and mark
dependent outputs stale, but the historical decision remains auditable.

### 5.6 Rubric

Required logical fields:

- `id` and semantic `version`
- named dimensions
- allowed semantic input shape for each dimension
- deterministic weights and aggregation rules
- missing-input behavior
- critical-failure predicates
- thresholds and user-facing display mapping

Rubrics MUST be immutable after use. Changes create a new version.

Scores are stored as integers in basis points from `0` through `10000`. Display
scales such as `0–100` or `1–5` are pure rubric-defined projections. Models do
not calculate or persist the aggregate score.

### 5.7 Evaluation

Required logical fields:

- `id`
- `opportunity_id`
- `rubric_id`
- profile revision and source identities used
- accepted evidence identities
- dimension inputs and computed dimension scores
- aggregate score in basis points
- `state`: `pending`, `running`, `waiting_for_user`, `completed`, `failed`,
  `canceled`, or `stale`
- gaps, contradictions, and critical findings
- related run and operation IDs

`completed` means the deterministic completion predicates passed. It does not
mean the user should apply.

### 5.8 Application

Required logical fields:

- `id`
- `opportunity_id`
- `state`: `considering`, `preparing`, `ready_for_review`, `applied`,
  `responded`, `interview`, `offer`, `hired`, `rejected`, `withdrawn`, or
  `closed`
- state revision
- effective date
- source and user note references

Every transition MUST be validated against a closed transition table. A stale
expected revision fails with `revision_conflict` rather than overwriting newer
state.

### 5.9 Artifact

Required logical fields:

- `id`
- `kind`
- `media_type`
- content digest and byte length
- producer identity and version
- source, fact, evidence, rubric, evaluation, and operation identities that
  authorize the content
- `state`: `staged`, `sealed`, `stale`, or `revoked`
- local relative path

Only a `sealed` artifact may be presented as ready for use. A dependency
correction marks affected artifacts `stale`; it never silently rewrites them.

### 5.10 Run and Operation

A `Run` correlates one user objective with DSH session identity and one or more
domain operations.

An `Operation` has:

- `id`
- `kind`
- bounded input identity
- requested capabilities
- DSH session and Agent lineage when model-mediated
- state: `queued`, `running`, `waiting_for_user`, `succeeded`, `failed`,
  `canceled`, or `indeterminate`
- timestamps and bounded accounting
- terminal category and message
- result and artifact identities when present

Exactly one terminal record exists per operation. An operation with a provider-
or worker-reachable dispatch but no trusted terminal becomes `indeterminate`; it
is not silently replayed.

### 5.11 Approval

Required logical fields:

- `id`
- exact command or operation identity
- human-readable summary
- bounded effect description
- expected domain revisions
- state: `pending`, `approved`, `denied`, `expired`, or `consumed`
- expiry
- approving user interaction identity

Approval is single-use and bound to the displayed effect. It cannot authorize a
different revision, recipient, artifact, destination, or amount.

### 5.12 DomainEvent

Every successful mutation appends an immutable event in the same transaction.
Events include:

- sequence number;
- event kind and schema version;
- aggregate identity and revision;
- causal command and operation identities;
- bounded payload;
- timestamp; and
- actor class.

Events support audit and UI updates. The current normalized tables remain the
query model; v0.1 does not require full event-sourced reconstruction.

## 6. Workspace and persistence contract

### 6.1 Layout

The default local workspace layout is:

```text
<workspace>/
  career-workbench.sqlite
  artifacts/
  exports/
  backups/
  config.toml
```

The effective root MUST be absolute and MUST NOT be a drive root, home root,
profile root, repository root, DSH home, Codex home, browser-profile directory,
or credential directory.

The implementation MUST reject path escape through `..`, symbolic links,
junctions, alternate streams, or replacement after validation where the host OS
exposes those conditions.

### 6.2 Canonical storage

SQLite is canonical for structured v0.1 domain state. The artifact directory is
canonical for sealed large bytes. Markdown, JSON, TSV, and PDF are import or
export representations unless registered as sealed artifacts.

The database MUST:

- enable foreign-key enforcement;
- apply ordered schema migrations;
- use transactions for every mutation;
- maintain monotonic entity revisions;
- use uniqueness constraints for stable identities;
- serialize conflicting writes; and
- preserve an audit event for every successful mutation.

### 6.3 Artifact sealing

Artifact creation follows:

```text
write to a workspace-owned staging path
  -> enforce byte and media-type limits
  -> compute digest
  -> atomically place immutable content
  -> commit sealed artifact metadata
```

Interrupted staging files are not artifacts and are recoverable garbage. A
record whose bytes cannot be resolved by digest fails inspection.

### 6.4 Backups and migrations

Before a migration that can destroy or reinterpret user data, the application
MUST create and verify a workspace-local backup or refuse the migration.

Migration failure leaves the previous version usable or reports a blocked state
with the backup location. It MUST NOT partially advance the schema version.

### 6.5 Export

The product MUST support a credential-free, documented export containing:

- profile facts and provenance;
- opportunities and source identities;
- evaluations, evidence decisions, and rubric versions;
- applications and transition history;
- artifact metadata and selected artifact bytes; and
- an export manifest with schema version and digests.

Exports MUST exclude provider credentials, DSH secrets, Jupyter connection keys,
browser sessions, and complete environment values.

### 6.6 Python and DSH persistence

Neither the DSH store nor an RLM snapshot replaces the workspace database.
Career Workbench may correlate their public identities for inspection and
recovery. It MUST NOT read DSH private persistence structures.

## 7. Command, query, and error contract

### 7.1 Commands

All mutations are typed commands. A command includes:

- workspace identity;
- command kind and schema version;
- actor class;
- idempotency key when retryable;
- expected revisions for affected aggregates;
- bounded payload; and
- causal run or operation identity when present.

Duplicate commands with the same idempotency key and identical content return
the original result. Reuse with different content fails.

### 7.2 Queries

Queries are side-effect free. Pagination order MUST be stable and use opaque
cursors. Query filters are validated; unknown filters fail rather than being
silently ignored.

### 7.3 Errors

Public failures use a stable code, human-readable message, retryability, and
OPTIONAL structured details. Required initial codes include:

- `invalid_request`
- `unsupported_contract_version`
- `workspace_not_found`
- `workspace_unsafe`
- `entity_not_found`
- `revision_conflict`
- `duplicate_identity`
- `invalid_transition`
- `evidence_unsupported`
- `evidence_locator_invalid`
- `artifact_unsealed`
- `artifact_limit_exceeded`
- `approval_required`
- `approval_stale`
- `approval_denied`
- `capability_unavailable`
- `model_unsupported`
- `reasoning_unsupported`
- `operation_canceled`
- `operation_indeterminate`
- `import_unsupported`
- `external_content_rejected`
- `internal_error`

Errors MUST NOT include secrets, full environment values, Jupyter connection
data, raw provider payloads containing private data, or unrestricted source
content.

## 8. Core workflows

### 8.1 Onboarding

The minimum usable workspace requires:

- one user-confirmed identity/profile record;
- at least one candidate primary source or confirmed fact set;
- explicit target preferences or a recorded decision to defer them; and
- a selected evaluation rubric.

Onboarding MAY extract proposed facts from imported documents. It MUST present
those proposals for review before they become `verified`.

### 8.2 Candidate-source intake

```text
capture immutable source
  -> parse/extract proposed facts
  -> validate exact source locators
  -> present confirmation outcomes
  -> commit accepted facts and rejections
```

Documents supplied for intake do not automatically become primary truth. The
user-approved facts derived from them do.

### 8.3 Opportunity capture

Opportunity content may be pasted, imported, or fetched by an authorized tool.
The implementation MUST retain the original source bytes or an explicit reason
why they could not be captured.

Liveness and authenticity are distinct:

- `source_status=active` means the captured source appears available;
- legitimacy evidence concerns whether the posting and organization appear
  credible; and
- neither establishes that an employer will respond or that a role is suitable.

### 8.4 Evaluation

The evaluation state machine is:

```text
pending -> running -> completed
                   -> waiting_for_user -> running
                   -> failed
                   -> canceled

completed -> stale
failed | canceled | stale -> pending  (new operation, same evaluation lineage)
```

An evaluation MAY use ordinary DSH work, native children, RLM, or no model. The
selected route is recorded.

Completion requires:

- a valid opportunity source;
- a fixed rubric version;
- a fixed candidate-profile revision;
- all mandatory dimension inputs or explicit missing-input dispositions;
- accepted evidence for candidate-facing facts;
- no unresolved critical contradiction;
- deterministic score computation;
- a sealed result artifact or complete structured result; and
- a trusted operation terminal.

### 8.5 Comparison

A comparison binds exact evaluation revisions and a comparison-policy version.
It MUST identify stale or incomparable inputs. It MAY calculate relative ranks,
tradeoffs, and sensitivity, but it MUST retain the underlying dimension values
and not reduce the decision to an unexplained rank.

### 8.6 Correction and invalidation

Correcting or rejecting a fact triggers a deterministic dependency query. Any
evaluation, comparison, or artifact whose eligibility depended on the old fact
becomes `stale` before new model work starts.

The product MUST show what changed and which outputs need review.

### 8.7 Application tracking

Application state changes are explicit user or tool commands. An evaluation does
not automatically create an application. Generating a document does not mark an
application applied.

The initial transition graph permits:

```text
considering -> preparing -> ready_for_review -> applied
considering | preparing | ready_for_review -> withdrawn | closed
applied -> responded | interview | rejected | withdrawn | closed
responded -> interview | offer | rejected | withdrawn | closed
interview -> offer | rejected | withdrawn | closed
offer -> hired | withdrawn | closed
```

Imports MAY map an upstream state into the closest state and retain the original
label. Ambiguous mappings require user review.

### 8.8 Artifact generation

Candidate-facing content is generated only from:

- verified candidate facts;
- user-provided statements in the active confirmed request;
- approved style and procedure settings; and
- accepted opportunity/company evidence when appropriate.

Keywords may be reformulated but facts may not be invented. The product MUST not
claim the user authored, led, built, measured, or achieved something unless
accepted evidence supports the complete assertion.

### 8.9 External actions

Application submission, form submission, email or message sending, purchases,
calendar invitations, and public posting are unavailable in v0.1. The product
MAY prepare drafts or checklists and MUST stop at review.

## 9. Evidence and scoring contract

### 9.1 Evidence admission

Syntactic validity and a valid-looking locator are insufficient. The complete
assertion must be supported by the referenced material under the declared
classification.

For v0.1:

- candidate facts require extractive support from candidate primary evidence or
  explicit user confirmation;
- opportunity and company facts require source-bound support;
- inferences are labeled and cannot be promoted through repetition;
- computations retain inputs and formula identity;
- contradictions retain both sides; and
- gaps remain explicit.

Two supported fragments MUST NOT be combined into a stronger unsupported
candidate assertion.

### 9.2 Rejected evidence

A rejected evidence identity remains barred from later synthesis unless a new
source or user correction creates a distinct proposal. Compaction, retry,
recovery, import, child output, or RLM output cannot silently revive it.

### 9.3 Semantic model output

Model-mediated evaluation returns a closed structured proposal. Unknown fields,
duplicate keys, missing identities, oversized content, invalid locators, and
unsupported classifications fail validation.

Free-form explanation MAY accompany a valid proposal but cannot repair an
invalid structured result.

### 9.4 Deterministic aggregation

Rubric code:

1. validates dimension inputs;
2. applies missing-value and critical-failure rules;
3. calculates dimension scores;
4. aggregates integer basis points;
5. computes the display projection; and
6. emits an explanation of the arithmetic.

The same validated inputs and rubric version MUST produce byte-equivalent
canonical score output.

### 9.5 Staleness

An evaluation becomes stale when any bound profile fact, source, evidence
decision, rubric, or critical policy is superseded. Staleness is deterministic
and precedes optional re-evaluation.

## 10. DeepSeek Harness integration

### 10.1 Service composition

The native Cordis package provides a service provisionally named
`ctx.careerWorkbench`. It exposes typed application commands and queries to DSH
consumers. A separate consumer registers model-facing tools.

The installable bundle MUST use the DSH profile's Cordis and DSH packages as
peers. It MUST NOT install shadow copies that split service symbols or session
authority.

Plugin readiness requires:

- Career Workbench backend connectivity;
- schema compatibility;
- DSH tool runtime;
- public subagent services for child-enabled workflows; and
- `ctx.rlm` only for RLM-enabled workflows.

Missing optional capabilities leave their workflows explicitly unavailable.

### 10.2 Tool surface

The initial model-facing tool families are:

- workspace/profile inspection;
- source and opportunity capture/inspection;
- evaluation start/inspect/cancel;
- evidence proposal and gap recording;
- comparison creation;
- application inspection and user-authorized state change;
- artifact draft/inspect; and
- operation/activity inspection.

Tool schemas MUST be closed, bounded, versioned, and JSON-safe. Mutating tools
require expected revisions. Tools return stable domain errors without converting
failure into prose success.

The plugin MUST preserve DSH tool guards, approval behavior, logging, and
telemetry. Direct filesystem access from Python does not traverse those guards.

### 10.3 Agent authority

One exact live DSH Agent is the authority for an invocation. The plugin MUST not
fabricate a new Agent to perform work or resolve model settings outside an
active request.

Active-request model inheritance follows native DSH semantics. Explicit model or
reasoning overrides are passed exactly and rejected when unsupported.

### 10.4 Native children

Delegated work uses public `ctx.subagents.startContinuable()` semantics.

The product MUST distinguish:

- child admission;
- child start;
- child report/message;
- child terminal;
- continuation/follow-up;
- cancellation; and
- deletion.

Returning a child handle or initial report does not mean the child completed.
The frontend and domain operation timeline MUST preserve that distinction.

Children inherit or receive explicit model and reasoning according to DSH public
contracts. Depth limits, admission limits, cancellation, cold restore,
messaging, and deletion remain DSH operations.

Career Workbench MUST NOT access continuation-manager private fields.

### 10.5 DSH events and correlation

Career Workbench stores only public, bounded correlation data needed to connect
a domain operation with DSH sessions, tool calls, and child lineage. It does not
duplicate DSH's complete event log or claim ownership of DSH accounting.

## 11. RLM and IPython contract

### 11.1 Selection

RLM is OPTIONAL per operation. The DSH Agent may select it when persistent
computation, iterative source analysis, or supervised recursive research is
expected to help.

Availability MUST NOT imply automatic selection. The route and selection reason
are observable.

### 11.2 Kernel ownership

One exact live DSH Agent owns one lazy Jupyter kernel. One DSH `SessionId` owns
its artifact directory. Kernel creation, restart, snapshot, restore, and
disposal use the public `ctx.rlm` contract.

### 11.3 Python authority

The product MUST state prominently that IPython has OS authority. The kernel
starts with an empty-by-default environment. Only validated, explicitly
allowlisted configuration and RLM-owned paths may be passed.

Jupyter transport remains HMAC-authenticated and loopback-only. Protocol frames
and output, variable, snapshot, queue, timeout, and aggregate resource limits
are enforced by the RLM provider.

### 11.4 Host bridge

Managed Python may request host capabilities only through the project-owned
bridge. Requests translate to public `ctx.llm`, `ctx.subagents`, and OPTIONAL
`ctx.tools` services using the originating DSH Agent.

- Python never reads provider credentials.
- Python never calls a provider SDK or HTTP model endpoint.
- Bridge requests have bounded schemas and timeouts.
- Cancellation flows through the originating DSH request.
- Stale kernel generations cannot publish results.

### 11.5 Durable results

Python returns structured proposals. Career Workbench validates and commits them
through ordinary domain commands. A variable existing in the notebook is not a
persisted fact or completed operation.

### 11.6 Snapshot and restore

Snapshots require matching durable digest authorization. Restore never replays
historical cells. Corrupt, orphaned, oversized, unauthorized, or mismatched
snapshots fail closed.

If a kernel ignores interrupt, the provider retires the generation, kills its
process tree, fences stale work, and restarts lazily.

## 12. Web application and API

### 12.1 Product surfaces

The v0.1 web application MUST provide:

- onboarding and workspace health;
- profile facts with source and verification state;
- opportunity list, capture, detail, and source view;
- evaluation detail with rubric dimensions, accepted evidence, rejected
  evidence, contradictions, and gaps;
- side-by-side opportunity comparison;
- application pipeline and transition history;
- artifact list and stale/ready status;
- operation timeline with parent/child/RLM distinctions;
- pending approvals and correction flows; and
- a DSH-backed conversational surface.

Chat MUST NOT be the only way to inspect or mutate core entities.

### 12.2 Lifecycle presentation

The frontend uses the closed operation states from Section 5.10. It MUST make
the following differences legible:

- queued versus running;
- child admitted versus child completed;
- waiting for user versus stalled;
- canceled versus failed;
- failed versus indeterminate;
- completed versus stale; and
- draft artifact versus sealed artifact.

### 12.3 Corrections and undo

Every mutable view shows the current revision. Corrections show the proposed
effect and affected outputs. An undo is a new validated command that supersedes
prior state; it is not history deletion.

### 12.4 HTTP API

The local server exposes a versioned JSON API under `/api/v1`. The exact route
catalog is implementation-defined but MUST cover every required query and
command without relying on browser-only logic.

Requirements:

- schemas come from `packages/contracts`;
- errors use the stable envelope and codes from Section 7.3;
- mutations require content type, origin/CSRF protection, idempotency where
  retryable, and expected revisions;
- unsupported methods return `405`;
- unknown fields in command payloads fail validation;
- pagination is bounded; and
- responses do not expose absolute sensitive paths by default.

### 12.5 Event stream

The server exposes a resumable Server-Sent Events or equivalent ordered event
stream. Events include monotonically increasing workspace sequence numbers.
Clients reconnect using the last accepted sequence and fall back to a fresh
query if history is unavailable.

The event stream is an observability/update surface, not a command channel.

### 12.6 Local binding and access

The initial server binds loopback by default. Non-loopback binding is disabled
unless explicitly configured with an authentication and threat model.

Browser requests require same-origin protection. A malicious website opened in
the user's browser must not be able to operate the local API.

### 12.7 Accessibility and responsiveness

Core workflows MUST be keyboard operable, expose semantic labels, meet WCAG 2.2
AA color-contrast requirements, and remain usable at common laptop widths.
Activity and evidence state cannot rely on color alone.

## 13. Career Ops compatibility and import

### 13.1 Role of Career Ops

Career Ops is an upstream behavior and data reference. Career Workbench does not
embed its agent skills as the production domain backend and does not run its
headless model workers.

### 13.2 Initial reference revision

The first compatibility profile targets:

- repository: `https://github.com/santifer/career-ops`;
- revision: `3a067ee580b7982cf5dd6edf7895112e4e99600b`; and
- observed package version: `1.31.0`.

The profile is exact. A later upstream revision requires fixture and import
contract review before being labeled supported.

### 13.3 Import phases

Import follows:

```text
inspect source read-only
  -> identify compatibility profile
  -> parse into bounded intermediate records
  -> validate and deduplicate
  -> produce a complete preview with warnings and unsupported items
  -> obtain user confirmation
  -> apply one idempotent transaction
  -> emit import manifest and audit events
```

The importer MUST NOT modify the source workspace.

### 13.4 Initial import scope

The first supported scope SHOULD include:

- candidate CV/profile sources;
- targeting and preference configuration;
- application tracker rows;
- captured job descriptions;
- evaluation reports and their original scoring labels;
- interview story records with their existing provenance markers; and
- user-authored custom workflow preferences.

Executable scripts, agent instructions, provider credentials, browser profiles,
generated dependency directories, and old Recursus evaluation/runtime evidence
are not imported as executable product behavior.

### 13.5 Ambiguity

Unrecognized states, duplicate opportunities, unresolved report links,
unsupported source formats, or candidate facts without adequate provenance are
reported. The importer MUST NOT guess silently.

## 14. Configuration and compatibility

### 14.1 Configuration domains

Career Workbench configuration includes only product settings such as:

- workspace root;
- server host and port;
- artifact and operation limits;
- locale and timezone;
- selected rubric;
- import profile; and
- feature availability.

Provider credentials, models, reasoning, DSH tool policy, and DSH session
settings remain DSH configuration.

### 14.2 Initial DSH/RLM baseline

The first implementation targets:

- DeepSeek Harness `dsh-v0.1.2-alpha.3` at
  `dd6322d604e00eec1ba5e0c8541159906a21094a`, with the public seam patches
  required by the RLM preview;
- Career Workbench's RLM dependency from
  `https://github.com/OpenCnid/deepseek-rlm` at
  `0e9f030300f9e5b37b76cdcd3d39bc490a251e79`; and
- the RLM bundle version provided by that revision.

The DSH package set is atomic. The implementation MUST record exact resolved
package and patch identities in its lock and runtime diagnostics.

The initial live acceptance profile uses the DSH `openai-codex` provider with
Codex OAuth and configured model `gpt-5.6-sol`. The configured reasoning level
is recorded per test. No provider-reported identity is invented when the adapter
does not supply one.

### 14.3 Compatibility failures

Missing Cordis services, mismatched package symbols, unsupported DSH revision,
missing patches, unsupported model/reasoning, or incompatible database schema
block affected startup or features with stable diagnostics. The product MUST not
install a fallback runtime or silently disable a requested capability.

## 15. Security and privacy

### 15.1 Personal data

Career data may include contact details, employment history, compensation, work
authorization, private correspondence, and third-party personal data. The
default workspace is private to the local OS user.

Fixtures, screenshots, examples, telemetry, and retained QA evidence use
synthetic or scrubbed data.

### 15.2 Secrets

Secrets are resolved by their owning runtime. Career Workbench stores opaque
references only when necessary. It MUST NOT:

- copy DSH or Codex credential stores;
- read credential values for diagnostics;
- expose them to Python or the frontend;
- serialize them in an import/export;
- log headers, cookies, tokens, or Jupyter keys; or
- pass the complete host environment to a child process.

### 15.3 Prompt injection

External source text is wrapped and labeled as untrusted data in every model
projection. Imperative text aimed at an AI is preserved as content or flagged as
an anomaly; it is never executed as policy.

Source content cannot choose tools, models, reasoning, destinations, approval
scope, or files outside its operation.

### 15.4 Filesystem and process authority

The local backend and Python kernel operate with OS authority. Path validation,
empty-by-default kernel environments, loopback transport, resource limits, and
approval gates reduce risk but do not create a sandbox.

Documentation and the UI MUST state this boundary accurately.

### 15.5 Network authority

Backend network adapters are explicit and allowlisted by feature. Python has no
declared network containment guarantee in v0.1; deployments requiring that
guarantee need an external process/container policy not claimed by this spec.

Only DSH-owned provider paths may perform model requests.

### 15.6 External actions

No v0.1 tool submits, sends, purchases, accepts, declines, withdraws, or posts
to a third-party system. Read-only opportunity discovery MAY be added with
source-specific rate limits and trust labeling.

## 16. Lifecycle, cancellation, and recovery

### 16.1 Operation admission

Before work starts, the backend records the bounded operation, input revision,
requested capabilities, and resource limits. DSH-mediated work records public
session correlation after admission.

### 16.2 Cancellation

Cancellation is idempotent. The backend marks cancellation requested, DSH
cancels active Agent/child work, and RLM interrupts the kernel when relevant.

Already committed evidence remains auditable. Unsealed results are not
published. Late work from a canceled or retired generation is fenced by
operation and generation identity.

### 16.3 Restart recovery

On backend restart:

- committed domain state is loaded from SQLite;
- operations left `running` are reconciled with public DSH state when possible;
- dispatched work without a trusted terminal becomes `indeterminate`;
- staged artifacts are inspected or removed safely;
- no provider request is replayed merely because the process restarted; and
- the frontend receives a new state snapshot followed by ordered events.

### 16.4 DSH and child recovery

Child continuation, messages, cancellation, deletion, cold restoration, and
lineage use public DSH semantics. Career Workbench may propose a follow-up only
after inspecting the current child state.

### 16.5 RLM recovery

The product may request restore only when the RLM provider has matching durable
snapshot authorization. Restore failure leaves the operation recoverable by a
new, explicitly admitted strategy; historical cells are not replayed.

### 16.6 Retry policy

Deterministic, non-effectful reads MAY use bounded automatic retries. Provider,
child, RLM, and mutation retries are explicit operations with fresh identities
unless the underlying public contract proves no dispatch or commit occurred.

Authentication, permission, invalid-request, evidence-safety, schema, identity,
approval, and artifact-integrity failures are not automatically retried.

## 17. Observability

### 17.1 Required activity data

The application exposes:

- operation kind and state;
- parent/child lineage;
- DSH session correlation safe for display;
- route: deterministic, ordinary DSH, native child, or RLM;
- started, last-activity, and terminal timestamps;
- accepted, rejected, contradictory, and unresolved evidence counts;
- pending approval or user-input reason;
- cancellation state;
- bounded model/tool accounting supplied by DSH; and
- stable terminal category.

### 17.2 Logs

Structured logs include workspace, command, operation, entity, and public DSH
correlation IDs when relevant. Large source content is referenced by digest, not
logged by default.

Redaction occurs before values enter a sink. A sink failure does not corrupt
domain state.

### 17.3 Diagnostics

The product exposes a scrubbed diagnostics report containing versions,
capability readiness, schema state, workspace health, DSH/RLM compatibility, and
recent stable error categories. It excludes credentials, raw personal content,
absolute private paths by default, and connection secrets.

## 18. Validation profiles

### 18.1 Core conformance

Provider-free deterministic tests are REQUIRED for:

- entity schemas and identifier normalization;
- every state transition and rejected transition;
- optimistic concurrency and idempotency;
- candidate-fact support and the four-outcome confirmation flow;
- inference, contradiction, gap, and rejected-evidence behavior;
- deterministic rubric arithmetic;
- correction-driven staleness;
- SQLite transactions, migrations, backup, and recovery;
- artifact staging, sealing, corruption, and size limits;
- workspace path and browser-origin safety;
- API schema and error envelopes;
- ordered event resumption;
- import preview, ambiguity, idempotency, and no-write-to-source behavior; and
- secret and synthetic-fixture hygiene.

### 18.2 DSH plugin conformance

Tests with a real compatible DSH composition are REQUIRED for:

- one exact originating Agent authority;
- service readiness and failure when capabilities are missing;
- tool schemas, guards, approval, logging, and domain error mapping;
- exact model and reasoning forwarding;
- unsupported option failures;
- native child admission, reports, follow-up, terminal, cancellation, and
  deletion;
- depth and concurrency limits;
- session persistence and cold restore; and
- absence of a plugin-owned model loop or provider client.

### 18.3 RLM conformance

Real Jupyter integration tests are REQUIRED for:

- persistent state vertical slice: `x = 41`, then `x + 1` yields `42`;
- structured domain proposals from Python;
- host bridge calls through the originating Agent;
- no provider credentials or full environment inheritance;
- HMAC and loopback transport;
- output, variable, queue, timeout, and snapshot limits;
- interrupt, unresponsive-kernel retirement, process-tree cleanup, and
  generation fencing;
- digest-authorized snapshot/restore; and
- restoration without historical cell replay.

### 18.4 Live integration profile

Before a release claim, run at least one live DSH interaction with:

- authenticated Codex OAuth;
- provider `openai-codex`;
- configured model `gpt-5.6-sol`;
- an explicitly recorded supported reasoning level;
- one ordinary domain-tool route;
- one native child route; and
- one RLM route when RLM is included in the claim.

The run uses synthetic career data. Success requires verified domain state and
artifacts, not only assistant prose.

### 18.5 Usability profile

The initial qualitative comparison has three conditions:

1. pinned upstream Career Ops in its normal agent-skill workflow;
2. Career Workbench with the same DSH profile and RLM unavailable; and
3. Career Workbench with RLM available.

All conditions use the same synthetic candidate, opportunities, task intent,
configured provider/model/reasoning where applicable, and human test script.

Required scenarios include:

- onboarding and source confirmation;
- evaluating and comparing at least three opportunities;
- locating the evidence behind a recommendation;
- correcting one candidate fact and observing invalidation;
- inspecting a child that is admitted but not complete;
- sending one follow-up to a continuing child;
- canceling a deliberately long operation;
- restarting and resuming without duplicate work; and
- distinguishing a draft from a ready artifact.

Collect at least:

- task completion without coaching;
- time to first useful result;
- clarification and repair turns;
- factual and provenance errors;
- correct user understanding of what is still running;
- successful correction and recovery;
- perceived effort, control, and trust; and
- route preference with reasons.

RLM is not preferred merely because a participant likes the final prose. It must
improve a named dimension without unacceptable reliability, latency, cost,
safety, or comprehension regressions.

### 18.6 Security profile

Required adversarial cases include:

- prompt injection in a job description, company page, email, and imported file;
- unsupported candidate claims with valid-looking locators;
- combined fragments that overstate a fact;
- rejected evidence reappearing after retry, compaction, child output, or RLM;
- stale approvals and revision races;
- cross-workspace IDs and path escape;
- malicious browser origins and CSRF;
- oversized, malformed, and duplicate-key payloads;
- logs, errors, screenshots, and exports containing secret-like values;
- canceled child and stale-kernel late output; and
- attempts by Python to represent direct OS access as DSH tool-policy
  enforcement.

## 19. Initial acceptance criteria

The v0.1 vertical product slice is accepted only when a clean installation can:

1. create a safe local workspace;
2. ingest a synthetic candidate source and confirm facts;
3. capture three synthetic job descriptions;
4. evaluate them through a real DSH Agent;
5. show accepted evidence, gaps, dimension scores, and deterministic totals in
   the web UI;
6. delegate at least one bounded research task to a native continuable child;
7. show child admission separately from child completion;
8. send a follow-up to the same child and consume its explicit report;
9. use persistent IPython for an eligible comparison computation;
10. persist the result outside Python;
11. restart backend and DSH processes and recover without replaying historical
    cells or duplicating provider work;
12. correct a candidate fact and mark affected results stale;
13. cancel an active operation and fence late results;
14. import the supported subset of a pinned Career Ops fixture after preview;
15. export a credential-free workspace package; and
16. pass core, browser, DSH, RLM, live, security, packaging, and usability gates
    applicable to the slice.

## 20. Definition of done

Career Workbench v0.1 is done when:

- every required component is implemented as working code, not a prompt-only
  placeholder;
- all normative entities, transitions, errors, and security boundaries are
  represented in code and tests;
- DSH is demonstrably the sole harness;
- the installable DSH plugin composes with the pinned profile without shadow
  packages;
- the frontend supports the complete vertical workflow without requiring a
  terminal;
- a clean-machine installation and migration path are documented and tested;
- the complete validation profiles pass or any skipped environment-dependent
  gate is reported as unmet rather than passed;
- exact upstream revisions, patches, licenses, adapted files, and package
  contents are recorded;
- security documentation states that IPython and the local backend have OS
  authority;
- no real personal data or credential material is present in repository or QA
  evidence;
- qualitative evidence reports both successes and observed usability failures;
  and
- every unmet criterion has concrete evidence and a named next change.

## Appendix A. Writing influences

The organization of this specification was informed by the explicit normative
language, state, failure, adapter, observability, and validation contracts in
OpenAI Symphony's public service specification. Career Workbench's domain,
architecture, requirements, and wording are original to this project.
