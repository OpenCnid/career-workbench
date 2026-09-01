# Career Workbench Vision

Status: product direction

Career Workbench is a human-directed workspace for making better career
decisions. It combines a structured career system of record, an evidence-first
analysis backend, a purpose-built web interface, and a DeepSeek Harness agent
that can research, calculate, delegate, and explain without becoming the owner
of the user's data or decisions.

## The problem

Modern job searches generate more state than a chat transcript or folder of
documents can reliably hold. A person may need to maintain a career history,
evaluate hundreds of opportunities, compare changing priorities, tailor
materials, prepare for interviews, and remember what happened across a long
pipeline.

Existing agent-driven career tools often put critical behavior in prompt files
or skills. That makes a prototype flexible, but it leaves important facts,
state transitions, validation rules, and recovery behavior implicit. Terminal
interfaces compound the problem: they hide parallel work, evidence,
uncertainty, approvals, and durable state behind a stream of text.

The result can feel capable without feeling dependable. Users cannot always
tell what is known, what was inferred, what is still running, what changed, or
how to correct it.

## The product promise

Career Workbench will make the system's state and reasoning inspectable.

A user should be able to:

- maintain one verified body of career evidence;
- collect and normalize opportunities without losing the original source;
- understand why an opportunity does or does not fit;
- compare opportunities using both stable preferences and situational goals;
- see the evidence behind every candidate-specific assertion;
- correct a fact once and know which conclusions are affected;
- watch delegated research progress and intervene when necessary;
- prepare application and interview artifacts without fabricated experience;
- resume interrupted work without silently replaying model requests; and
- remain the final authority over submissions, messages, purchases, and other
  consequential actions.

## Product principles

### Deterministic core, generative edge

Code owns identifiers, schemas, state machines, scoring arithmetic,
provenance, validation, persistence, migrations, approval gates, and artifact
lifecycle. Models perform semantic analysis, research, explanation, and
drafting within those boundaries.

A model response is a proposal until the deterministic backend validates and
records it.

### Evidence before assertion

Career facts must come from user-approved sources. Job and company facts must
retain their sources. Inferences must remain distinguishable from extracted
facts. A plausible citation is not sufficient when the cited material does
not support the complete claim.

Missing evidence should produce a visible gap, not an invented bridge.

### Human direction is a feature

The product helps a person decide and act; it does not optimize for autonomous
application volume. The user can inspect, correct, reject, retry, cancel, and
approve work. Career Workbench never silently submits an application or sends
a message on the user's behalf.

### Structured interface, conversational control

Chat is useful for expressing intent and asking questions, but it is not a
replacement for a product interface. Opportunities, evaluations, evidence,
applications, artifacts, approvals, and running work receive dedicated views.
Conversation complements those views instead of being the only way to operate
them.

### One orchestrator

DeepSeek Harness is the sole agent harness. It owns model access, tools,
approvals, sessions, lineage, persistence, cancellation, and child lifecycle.
Career Workbench adds domain services and user experience; it does not add a
second agent loop.

### Recursion when it earns its cost

Native subagents and the RLM/IPython capability are selective tools, not a
default ceremony. Simple work should remain simple. Persistent computation or
recursive research is appropriate only when it produces clearer evidence,
better recovery, or materially better results than an ordinary DSH turn.

### User-owned, portable data

The initial product is local-first. Career data is stored in a documented,
versioned workspace and can be exported without a hosted account. Provider
credentials are not career data and never enter exports, model-visible
artifacts, or RLM snapshots.

### Upstream learning without permanent coupling

Career Ops is the initial domain reference. Career Workbench will preserve the
useful workflows, safety lessons, and importable user artifacts while moving
core behavior into deterministic services. It is not a fork whose architecture
must forever mirror Career Ops, and it is not a wrapper that leaves prompt
files as the backend.

## The intended experience

The primary screen is a workbench, not a chatbot. It presents:

- an opportunity inbox and comparison surface;
- a verified career profile and evidence ledger;
- an explainable evaluation workspace;
- an application pipeline and next-action view;
- generated documents and their supporting facts;
- a live activity timeline for DSH operations, native children, and RLM work;
- explicit gaps, contradictions, approvals, failures, and recovery choices;
- a conversational panel for asking the orchestrator to act across those
  surfaces.

The user should never need to understand Cordis, DSH, subagent APIs, Jupyter,
or recursive language models to complete a career task. Those mechanisms are
successful when the interface makes the work easier to understand and control.

## Who it is for

Career Workbench is initially designed for an individual conducting a serious,
selective job search. It should also remain useful between searches as a place
to maintain accomplishments, evidence, preferences, and career history.

The first product is not a recruiter-facing applicant tracking system,
employer screening product, labor marketplace, or autonomous application
service.

## What success means

Success is not the number of generated applications. Success means that users:

- reach defensible decisions faster;
- understand and trust the evidence behind recommendations;
- spend less effort reconstructing context and correcting repeated mistakes;
- can recover from interruptions without losing or replaying work;
- produce stronger materials without inventing facts;
- feel more control than they did in the terminal-first workflow; and
- choose recursion because it helps, not because the architecture requires it.

Product evaluation will compare the upstream Career Ops experience, Career
Workbench with ordinary DSH orchestration, and the same product with RLM
available. The comparison must separate the value of the interface and
deterministic backend from the incremental value of RLM.

## Non-goals

Career Workbench does not aim to:

- automate indiscriminate or high-volume applications;
- evade employer screening systems;
- fabricate experience, metrics, credentials, or authorship;
- make employment, legal, immigration, compensation, or financial decisions
  for the user;
- treat IPython as a security sandbox;
- replace DSH with a product-owned model loop;
- make model output or notebook memory the canonical database;
- require a particular model forever; or
- preserve every Career Ops implementation detail when a smaller deterministic
  contract is safer and easier to use.

## North star

Career Workbench should feel like a calm, inspectable operating environment for
a consequential personal process: structured where correctness matters,
adaptive where judgment matters, and always under the user's control.
