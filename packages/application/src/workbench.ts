import { createHash } from "node:crypto";
import {
  DomainError,
  assertDomain,
  calculateScore,
  canonicalJson,
  renderProfileFactClaim,
  requireApplicationTransition,
  validateEvidenceForAcceptance,
  validateRubric,
  validateSourceLocator,
  type Application,
  type Artifact,
  type CommandContext,
  type Comparison,
  type ComparisonScenarioResult,
  type DimensionInput,
  type EntityId,
  type Evaluation,
  type EvidenceClassification,
  type EvidenceItem,
  type FactConfirmationOutcome,
  type Digest,
  type ImportManifest,
  type ImportMappingRecord,
  type LegitimacyStatus,
  type Opportunity,
  type Operation,
  type OperationRoute,
  type OperationState,
  type ProfileFact,
  type ProposedBy,
  type Rubric,
  type RubricDimension,
  type SourceDocument,
  type SourceKind,
  type SourceStatus,
  type SourceLocator,
  type TrustClass,
  type Workspace,
  type WorkspaceId,
} from "@career-workbench/domain";
import type { Clock, IdFactory } from "./ids.js";
import type {
  ArtifactRepository,
  EventToAppend,
  Mutation,
  WorkspaceRepository,
} from "./ports.js";

const MAX_INLINE_SOURCE_BYTES = 1024 * 1024;

export interface CreateWorkspaceInput {
  readonly displayName: string;
  readonly locale: string;
  readonly timezone: string;
}

export interface CaptureSourceInput {
  readonly kind: SourceKind;
  readonly trustClass: TrustClass;
  readonly mediaType: string;
  readonly text: string;
  readonly originalLocator?: string;
}

export interface ProposeFactInput {
  readonly factType: string;
  readonly subject: string;
  readonly predicate: string;
  readonly value: ProfileFact["value"];
  readonly sourceLocators: readonly SourceLocator[];
  readonly proposedBy: ProposedBy;
}

export interface CaptureOpportunityInput {
  readonly sourceDocumentId: EntityId;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl?: string;
  readonly location?: string;
  readonly workArrangement?: string;
  readonly advertisedCompensation?: string;
  readonly requisitionId?: string;
}

export interface ProposeEvidenceInput {
  readonly classification: EvidenceClassification;
  readonly claim: string;
  readonly sourceId?: EntityId;
  readonly locator?: SourceLocator;
  readonly candidateFactId?: EntityId;
  readonly proposedByOperationId?: EntityId;
}

export interface CreateRubricInput {
  readonly semanticVersion: string;
  readonly name: string;
  readonly dimensions: readonly RubricDimension[];
  readonly thresholds: Readonly<Record<string, number>>;
  readonly displayScale: 5 | 100;
}

export interface EvaluateInput {
  readonly opportunityId: EntityId;
  readonly rubricId: EntityId;
  readonly dimensionInputs: readonly DimensionInput[];
  readonly contradictions?: readonly string[];
  readonly operationId?: EntityId;
}

export interface StartOperationInput {
  readonly kind: string;
  readonly inputIdentity: EntityId;
  readonly requestedCapabilities: readonly string[];
  readonly route: Exclude<OperationRoute, "deterministic">;
  readonly dshSessionId: string;
  readonly parentOperationId?: EntityId;
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: string;
  readonly admissionOnly?: boolean;
}

export interface OperationActivityInput {
  readonly expectedRevision: number;
  readonly phase:
    | "started"
    | "report"
    | "message"
    | "followup"
    | "deleted"
    | "cell"
    | "bridge"
    | "snapshot"
    | "restore"
    | "interrupt"
    | "restart";
  readonly message?: string;
  readonly messageId?: string;
  readonly requestId?: EntityId;
}

export interface TerminalOperationInput {
  readonly expectedRevision: number;
  readonly state: Extract<
    OperationState,
    "succeeded" | "failed" | "canceled" | "indeterminate"
  >;
  readonly category: string;
  readonly message: string;
  readonly resultIds: readonly EntityId[];
  readonly artifactIds: readonly EntityId[];
}

export interface CancelOperationInput {
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface RequestChildFollowupInput {
  readonly expectedRevision: number;
  readonly message: string;
}

export interface ComparisonScenarioProposalInput {
  readonly label: string;
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
}

export interface ProposeComparisonInput {
  readonly evaluationIds: readonly EntityId[];
  readonly policyVersion: string;
  readonly scenarios: readonly ComparisonScenarioProposalInput[];
  readonly tradeoffs: readonly string[];
}

export interface CreateApplicationInput {
  readonly opportunityId: EntityId;
  readonly effectiveDate: string;
  readonly note?: string;
}

export interface TransitionApplicationInput {
  readonly expectedRevision: number;
  readonly state: Application["state"];
  readonly effectiveDate: string;
  readonly note?: string;
}

export interface UpdateOpportunitySignalsInput {
  readonly expectedRevision: number;
  readonly sourceStatus: SourceStatus;
  readonly legitimacyStatus: LegitimacyStatus;
}

export type CandidateArtifactKind =
  "draft_cv" | "draft_cover_letter" | "draft_outreach" | "draft_interview_prep";

export interface CreateCandidateArtifactInput {
  readonly kind: CandidateArtifactKind;
  readonly opportunityId: EntityId;
  readonly factIds: readonly EntityId[];
  readonly styleNote?: string;
}

export interface CareerOpsImportFileInput {
  readonly relativePath: string;
  readonly mediaType: string;
  readonly kind: SourceKind;
  readonly trustClass: TrustClass;
  readonly bytes: Uint8Array;
  readonly contentDigest: Digest;
}

export interface CareerOpsProfileFactInput {
  readonly sourceRelativePath: string;
  readonly factType: string;
  readonly subject: string;
  readonly predicate: string;
  readonly value: ProfileFact["value"];
  readonly start: number;
  readonly end: number;
  readonly quote: string;
}

export interface CareerOpsApplicationInput {
  readonly sourceRelativePath: string;
  readonly sourceIdentity: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl: string | null;
  readonly location: string | null;
  readonly state: Application["state"];
  readonly effectiveDate: string;
  readonly note: string | null;
  readonly reportRelativePath: string | null;
  readonly originalStatus: string;
  readonly originalScore: string | null;
}

export interface CareerOpsPassiveMappingInput {
  readonly sourceType: ImportMappingRecord["sourceType"];
  readonly sourceIdentity: string;
  readonly sourceRelativePath: string;
  readonly disposition: ImportMappingRecord["disposition"];
  readonly originalStatus: string | null;
  readonly originalScore: string | null;
  readonly note: string | null;
}

export interface ApplyCareerOpsImportInput {
  readonly upstreamRevision: string;
  readonly observedVersion: string | null;
  readonly sourceIdentityDigest: Digest;
  readonly sourceFingerprint: Digest;
  readonly sourceLabel: string;
  readonly files: readonly CareerOpsImportFileInput[];
  readonly profileFacts: readonly CareerOpsProfileFactInput[];
  readonly applications: readonly CareerOpsApplicationInput[];
  readonly passiveMappings: readonly CareerOpsPassiveMappingInput[];
  readonly warnings: readonly string[];
  readonly unsupported: readonly string[];
}

function event(
  context: CommandContext,
  timestamp: ReturnType<Clock["now"]>,
  eventKind: string,
  aggregateId: string,
  aggregateRevision: number,
  payload: Readonly<Record<string, unknown>>,
): EventToAppend {
  return {
    eventKind,
    aggregateId,
    aggregateRevision,
    payload,
    timestamp,
    actor: context.actor,
    ...(context.operationId === undefined
      ? {}
      : { operationId: context.operationId }),
  };
}

function updated<
  Entity extends { readonly revision: number; readonly updatedAt: string },
>(
  entity: Entity,
  timestamp: ReturnType<Clock["now"]>,
  values: Partial<Entity>,
): Entity {
  return {
    ...entity,
    ...values,
    revision: entity.revision + 1,
    updatedAt: timestamp,
  };
}

export class WorkbenchService {
  public constructor(
    public readonly workspaceId: WorkspaceId,
    private readonly repository: WorkspaceRepository,
    private readonly artifacts: ArtifactRepository,
    private readonly ids: IdFactory,
    private readonly clock: Clock,
  ) {}

  public async initializeWorkspace(
    input: CreateWorkspaceInput,
    context: CommandContext,
  ): Promise<Workspace> {
    assertDomain(
      input.displayName.trim().length >= 1 && input.displayName.length <= 120,
      "invalid_request",
      "Workspace display name is invalid.",
    );
    assertDomain(
      /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(input.locale),
      "invalid_request",
      "Workspace locale is invalid.",
    );
    assertDomain(
      input.timezone.length >= 1 && input.timezone.length <= 100,
      "invalid_request",
      "Workspace timezone is invalid.",
    );
    const now = this.clock.now();
    const workspace: Workspace = {
      id: this.workspaceId,
      displayName: input.displayName.trim(),
      schemaVersion: 1,
      policyVersion: "v1",
      defaultRubricId: null,
      locale: input.locale,
      timezone: input.timezone,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "workspace.create", input },
      mutations: [{ action: "insert", kind: "workspace", entity: workspace }],
      events: [
        event(context, now, "workspace.created", workspace.id, 1, {
          schemaVersion: 1,
          policyVersion: "v1",
        }),
      ],
      result: workspace,
    });
  }

  public async captureSource(
    input: CaptureSourceInput,
    context: CommandContext,
  ): Promise<SourceDocument> {
    const bytes = new TextEncoder().encode(input.text);
    assertDomain(
      bytes.byteLength > 0 && bytes.byteLength <= MAX_INLINE_SOURCE_BYTES,
      "invalid_request",
      "Source content is empty or exceeds the inline source limit.",
    );
    assertDomain(
      /^text\/[a-z0-9.+-]+$/iu.test(input.mediaType),
      "invalid_request",
      "Inline sources require a text media type.",
    );
    if (input.kind === "candidate") {
      assertDomain(
        input.trustClass !== "external",
        "invalid_request",
        "Candidate sources require a candidate trust class.",
      );
    } else {
      assertDomain(
        input.trustClass === "external" || input.kind === "import",
        "invalid_request",
        "Non-candidate sources are untrusted external data.",
      );
    }
    const now = this.clock.now();
    const source: SourceDocument = {
      id: this.ids.entity("source"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      kind: input.kind,
      trustClass: input.trustClass,
      mediaType: input.mediaType,
      contentDigest: createHash("sha256")
        .update(bytes)
        .digest("hex") as SourceDocument["contentDigest"],
      byteLength: bytes.byteLength,
      originalLocator: input.originalLocator ?? null,
      capturedAt: now,
      supersedesSourceId: null,
      inlineText: input.text,
      artifactId: null,
    };
    return this.commitInsert(
      "source",
      source,
      context,
      "source.capture",
      input,
      "source.captured",
      {
        kind: source.kind,
        trustClass: source.trustClass,
        contentDigest: source.contentDigest,
        byteLength: source.byteLength,
      },
    );
  }

  public async proposeProfileFact(
    input: ProposeFactInput,
    context: CommandContext,
  ): Promise<ProfileFact> {
    assertDomain(
      input.subject.trim().length > 0 && input.predicate.trim().length > 0,
      "invalid_request",
      "Fact subject and predicate are required.",
    );
    for (const locator of input.sourceLocators) {
      const source = await this.repository.get("source", locator.sourceId);
      validateSourceLocator(source, locator);
    }
    const now = this.clock.now();
    const fact: ProfileFact = {
      id: this.ids.entity("fact"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      factType: input.factType,
      subject: input.subject.trim(),
      predicate: input.predicate.trim(),
      value: input.value,
      status: "proposed",
      sourceLocators: input.sourceLocators,
      proposedBy: input.proposedBy,
      confirmedByUserAt: null,
      supersedesFactId: null,
    };
    return this.commitInsert(
      "profileFact",
      fact,
      context,
      "profile_fact.propose",
      input,
      "profile_fact.proposed",
      { factType: fact.factType, status: fact.status },
    );
  }

  public async confirmProfileFact(
    factId: EntityId,
    expectedRevision: number,
    outcome: FactConfirmationOutcome,
    context: CommandContext,
  ): Promise<ProfileFact> {
    const fact = await this.repository.get("profileFact", factId);
    assertDomain(
      fact.workspaceId === this.workspaceId,
      "entity_not_found",
      "Fact does not belong to this workspace.",
    );
    assertDomain(
      fact.revision === expectedRevision,
      "revision_conflict",
      "Fact revision is stale.",
    );
    assertDomain(
      fact.status === "proposed" || fact.status === "derived_unverified",
      "invalid_transition",
      "Only an unverified fact can use the confirmation flow.",
    );
    const now = this.clock.now();
    if (outcome.kind === "correct") {
      const source = await this.repository.get(
        "source",
        outcome.locator.sourceId,
      );
      validateSourceLocator(source, outcome.locator);
      assertDomain(
        source.trustClass === "candidate_primary",
        "evidence_unsupported",
        "A corrected candidate fact requires primary evidence or a user-entered primary source.",
      );
      const prior = updated(fact, now, { status: "superseded" });
      const correction: ProfileFact = {
        ...fact,
        id: this.ids.entity("fact"),
        value: outcome.value,
        status: "verified",
        sourceLocators: [outcome.locator],
        proposedBy: "user",
        confirmedByUserAt: now,
        supersedesFactId: fact.id,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      return await this.repository.commit({
        workspaceId: this.workspaceId,
        context,
        command: {
          kind: "profile_fact.confirm",
          factId,
          expectedRevision,
          outcome,
        },
        mutations: [
          {
            action: "update",
            kind: "profileFact",
            entity: prior,
            expectedRevision,
          },
          { action: "insert", kind: "profileFact", entity: correction },
        ],
        events: [
          event(
            context,
            now,
            "profile_fact.superseded",
            fact.id,
            prior.revision,
            {
              supersededBy: correction.id,
            },
          ),
          event(context, now, "profile_fact.corrected", correction.id, 1, {
            supersedesFactId: fact.id,
            status: correction.status,
          }),
        ],
        result: correction,
      });
    }
    if (outcome.kind === "confirm") {
      assertDomain(
        fact.sourceLocators.length > 0,
        "evidence_unsupported",
        "A verified fact requires a source locator.",
      );
      for (const locator of fact.sourceLocators) {
        const source = await this.repository.get("source", locator.sourceId);
        validateSourceLocator(source, locator);
        assertDomain(
          source.trustClass === "candidate_primary",
          "evidence_unsupported",
          "A verified fact requires candidate primary evidence.",
        );
      }
    }
    const status =
      outcome.kind === "confirm"
        ? "verified"
        : outcome.kind === "narrative_only"
          ? "derived_unverified"
          : "user_cannot_confirm";
    const decided = updated(fact, now, {
      status,
      confirmedByUserAt: outcome.kind === "confirm" ? now : null,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "profile_fact.confirm",
        factId,
        expectedRevision,
        outcome,
      },
      mutations: [
        {
          action: "update",
          kind: "profileFact",
          entity: decided,
          expectedRevision,
        },
      ],
      events: [
        event(context, now, "profile_fact.decided", fact.id, decided.revision, {
          status,
          outcome: outcome.kind,
        }),
      ],
      result: decided,
    });
  }

  public async captureOpportunity(
    input: CaptureOpportunityInput,
    context: CommandContext,
  ): Promise<Opportunity> {
    const source = await this.repository.get("source", input.sourceDocumentId);
    assertDomain(
      source.workspaceId === this.workspaceId &&
        source.kind === "opportunity" &&
        source.trustClass === "external",
      "invalid_request",
      "Opportunity must bind an external opportunity source.",
    );
    const duplicates = await this.repository.list(
      "opportunity",
      this.workspaceId,
    );
    if (
      input.requisitionId !== undefined &&
      duplicates.some(
        (item) =>
          item.organization.toLowerCase() ===
            input.organization.toLowerCase() &&
          item.requisitionId === input.requisitionId,
      )
    ) {
      throw new DomainError(
        "duplicate_identity",
        "Opportunity requisition identity already exists.",
      );
    }
    const now = this.clock.now();
    const opportunity: Opportunity = {
      id: this.ids.entity("opportunity"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      sourceDocumentId: source.id,
      organization: input.organization.trim(),
      roleTitle: input.roleTitle.trim(),
      originalUrl: input.originalUrl ?? null,
      location: input.location ?? null,
      workArrangement: input.workArrangement ?? null,
      advertisedCompensation: input.advertisedCompensation ?? null,
      requisitionId: input.requisitionId ?? null,
      sourceStatus: "unknown",
      legitimacyStatus: "unknown",
      workflowState: "captured",
      sourceContentDigest: source.contentDigest,
    };
    assertDomain(
      opportunity.organization.length > 0 && opportunity.roleTitle.length > 0,
      "invalid_request",
      "Opportunity organization and role are required.",
    );
    return this.commitInsert(
      "opportunity",
      opportunity,
      context,
      "opportunity.capture",
      input,
      "opportunity.captured",
      {
        sourceDocumentId: source.id,
        sourceContentDigest: source.contentDigest,
      },
    );
  }

  public async proposeEvidence(
    input: ProposeEvidenceInput,
    context: CommandContext,
  ): Promise<EvidenceItem> {
    assertDomain(
      input.claim.length > 0 && input.claim.length <= 2000,
      "invalid_request",
      "Evidence claim is empty or exceeds the configured limit.",
    );
    if (input.locator !== undefined) {
      assertDomain(
        input.sourceId === input.locator.sourceId,
        "evidence_locator_invalid",
        "Evidence source and locator do not match.",
      );
    }
    if (input.proposedByOperationId !== undefined) {
      const operation = await this.repository.get(
        "operation",
        input.proposedByOperationId,
      );
      assertDomain(
        operation.state === "running",
        "invalid_transition",
        "Evidence can only be attributed to a running operation.",
      );
      assertDomain(
        context.operationId === operation.id &&
          context.dshSessionId === operation.dshSessionId &&
          (context.actor === "dsh_agent" || context.actor === "dsh_child"),
        "approval_required",
        "Evidence attribution requires the operation's DSH authority.",
      );
    }
    const now = this.clock.now();
    const evidence: EvidenceItem = {
      id: this.ids.entity("evidence"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      classification: input.classification,
      claim: input.claim,
      sourceId: input.sourceId ?? null,
      locator: input.locator ?? null,
      candidateFactId: input.candidateFactId ?? null,
      proposedByOperationId: input.proposedByOperationId ?? null,
      decision: "proposed",
      decisionReason: null,
      acceptedAt: null,
      rejectedAt: null,
    };
    return this.commitInsert(
      "evidence",
      evidence,
      context,
      "evidence.propose",
      input,
      "evidence.proposed",
      { classification: evidence.classification },
    );
  }

  public async decideEvidence(
    evidenceId: EntityId,
    expectedRevision: number,
    decision: "accepted" | "rejected",
    reason: string,
    context: CommandContext,
  ): Promise<EvidenceItem> {
    assertDomain(
      reason.length > 0 && reason.length <= 500,
      "invalid_request",
      "Evidence decision reason is required and bounded.",
    );
    const evidence = await this.repository.get("evidence", evidenceId);
    if (evidence.proposedByOperationId !== null) {
      const operation = await this.repository.get(
        "operation",
        evidence.proposedByOperationId,
      );
      assertDomain(
        operation.state === "running" &&
          context.operationId === operation.id &&
          context.dshSessionId === operation.dshSessionId &&
          (context.actor === "dsh_agent" || context.actor === "dsh_child"),
        "approval_required",
        "Only the originating DSH session may decide operation evidence.",
      );
    }
    assertDomain(
      evidence.revision === expectedRevision,
      "revision_conflict",
      "Evidence revision is stale.",
    );
    const source =
      evidence.sourceId === null
        ? null
        : await this.repository.get("source", evidence.sourceId);
    const fact =
      evidence.candidateFactId === null
        ? null
        : await this.repository.get("profileFact", evidence.candidateFactId);
    if (decision === "accepted") {
      validateEvidenceForAcceptance(evidence, source, fact);
    } else {
      assertDomain(
        evidence.decision === "proposed",
        "invalid_transition",
        "Only proposed evidence can be rejected.",
      );
    }
    const now = this.clock.now();
    const decided = updated(evidence, now, {
      decision,
      decisionReason: reason,
      acceptedAt: decision === "accepted" ? now : null,
      rejectedAt: decision === "rejected" ? now : null,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "evidence.decide",
        evidenceId,
        expectedRevision,
        decision,
        reason,
      },
      mutations: [
        {
          action: "update",
          kind: "evidence",
          entity: decided,
          expectedRevision,
        },
      ],
      events: [
        event(context, now, "evidence.decided", evidence.id, decided.revision, {
          decision,
          reason,
        }),
      ],
      result: decided,
    });
  }

  public async createRubric(
    input: CreateRubricInput,
    context: CommandContext,
  ): Promise<Rubric> {
    const now = this.clock.now();
    const rubric: Rubric = {
      id: this.ids.entity("rubric"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      semanticVersion: input.semanticVersion,
      name: input.name,
      dimensions: input.dimensions,
      thresholds: input.thresholds,
      displayScale: input.displayScale,
      usedAt: null,
    };
    validateRubric(rubric);
    const existing = await this.repository.list("rubric", this.workspaceId);
    assertDomain(
      !existing.some((item) => item.semanticVersion === rubric.semanticVersion),
      "duplicate_identity",
      "Rubric version already exists.",
    );
    const workspace = await this.repository.get("workspace", this.workspaceId);
    const selectedWorkspace = updated(workspace, now, {
      defaultRubricId: rubric.id,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "rubric.create", input },
      mutations: [
        { action: "insert", kind: "rubric", entity: rubric },
        {
          action: "update",
          kind: "workspace",
          entity: selectedWorkspace,
          expectedRevision: workspace.revision,
        },
      ],
      events: [
        event(context, now, "rubric.created", rubric.id, 1, {
          semanticVersion: rubric.semanticVersion,
        }),
        event(
          context,
          now,
          "workspace.default_rubric_selected",
          workspace.id,
          selectedWorkspace.revision,
          { rubricId: rubric.id },
        ),
      ],
      result: rubric,
    });
  }

  public async evaluate(
    input: EvaluateInput,
    context: CommandContext,
  ): Promise<Evaluation> {
    const opportunity = await this.repository.get(
      "opportunity",
      input.opportunityId,
    );
    const rubric = await this.repository.get("rubric", input.rubricId);
    const now = this.clock.now();
    const existingOperation =
      input.operationId === undefined
        ? null
        : await this.repository.get("operation", input.operationId);
    if (existingOperation !== null) {
      assertDomain(
        existingOperation.state === "running",
        "invalid_transition",
        "Only a running operation can complete an evaluation.",
      );
      assertDomain(
        existingOperation.kind === "evaluation" &&
          existingOperation.inputIdentity === opportunity.id,
        "invalid_request",
        "Operation identity does not match the evaluation opportunity.",
      );
      assertDomain(
        existingOperation.route !== "deterministic" &&
          context.actor === "dsh_agent" &&
          context.operationId === existingOperation.id &&
          context.dshSessionId === existingOperation.dshSessionId,
        "approval_required",
        "A model-routed operation requires DSH Agent authority.",
      );
    }
    const operationId = existingOperation?.id ?? this.ids.entity("operation");
    const evaluationId = this.ids.entity("evaluation");
    const admittedOperation: Operation =
      existingOperation === null
        ? {
            id: operationId,
            workspaceId: this.workspaceId,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            kind: "evaluation",
            inputIdentity: opportunity.id,
            requestedCapabilities: [],
            dshSessionId: null,
            parentOperationId: null,
            state: "running",
            route: "deterministic",
            startedAt: now,
            lastActivityAt: now,
            terminalAt: null,
            terminalCategory: null,
            terminalMessage: null,
            resultIds: [],
            artifactIds: [],
            cancellationRequestedAt: null,
          }
        : updated(existingOperation, now, { lastActivityAt: now });
    const operationContext: CommandContext = {
      ...context,
      operationId,
    };
    const profileEvents = await this.repository.eventsAfter(
      this.workspaceId,
      0,
      1000,
    );
    const profileRevision =
      profileEvents
        .filter((item) => item.eventKind.startsWith("profile_fact."))
        .at(-1)?.sequence ?? 0;
    const pendingEvaluation: Evaluation = {
      id: evaluationId,
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      opportunityId: opportunity.id,
      rubricId: rubric.id,
      profileRevision,
      sourceIds: [opportunity.sourceDocumentId],
      acceptedEvidenceIds: [],
      dimensionInputs: input.dimensionInputs,
      dimensionScores: [],
      aggregateScoreBasisPoints: 0,
      displayScore: "0",
      arithmeticExplanation: "pending",
      state: "running",
      gaps: [],
      contradictions: input.contradictions ?? [],
      criticalFindings: [],
      runId: null,
      operationId,
      staleReason: null,
    };
    const evaluatingOpportunity = updated(opportunity, now, {
      workflowState: "evaluating",
    });
    const operationMutation: Mutation =
      existingOperation === null
        ? { action: "insert", kind: "operation", entity: admittedOperation }
        : {
            action: "update",
            kind: "operation",
            entity: admittedOperation,
            expectedRevision: existingOperation.revision,
          };
    const admitted = await this.repository.commit({
      workspaceId: this.workspaceId,
      context: {
        ...context,
        idempotencyKey: `${context.idempotencyKey}:admit`,
      },
      command: { kind: "evaluation.admit", input },
      mutations: [
        operationMutation,
        { action: "insert", kind: "evaluation", entity: pendingEvaluation },
        {
          action: "update",
          kind: "opportunity",
          entity: evaluatingOpportunity,
          expectedRevision: opportunity.revision,
        },
      ],
      events: [
        event(
          operationContext,
          now,
          existingOperation === null
            ? "operation.admitted"
            : "operation.activity",
          operationId,
          admittedOperation.revision,
          { route: admittedOperation.route },
        ),
        event(operationContext, now, "evaluation.started", evaluationId, 1, {
          opportunityId: opportunity.id,
        }),
        event(
          operationContext,
          now,
          "opportunity.evaluating",
          opportunity.id,
          evaluatingOpportunity.revision,
          {},
        ),
      ],
      result: {
        operation: admittedOperation,
        evaluation: pendingEvaluation,
        opportunity: evaluatingOpportunity,
      },
    });

    try {
      assertDomain(
        admitted.evaluation.contradictions.length === 0,
        "evidence_unsupported",
        "An evaluation cannot complete with an unresolved critical contradiction.",
      );
      const requestedEvidenceIds = [
        ...new Set(
          input.dimensionInputs.flatMap((dimension) => dimension.evidenceIds),
        ),
      ];
      const evidence = await Promise.all(
        requestedEvidenceIds.map((id) => this.repository.get("evidence", id)),
      );
      const score = calculateScore(rubric, input.dimensionInputs, evidence);
      const terminalAt = this.clock.now();
      const completedEvaluation = updated(admitted.evaluation, terminalAt, {
        dimensionScores: score.dimensionScores,
        aggregateScoreBasisPoints: score.aggregateScoreBasisPoints,
        displayScore: score.displayScore,
        arithmeticExplanation: score.arithmeticExplanation,
        state: "completed",
        gaps: score.gaps,
        criticalFindings: score.criticalFindings,
        acceptedEvidenceIds: score.acceptedEvidenceIds,
      });
      const completedOperation = updated(admitted.operation, terminalAt, {
        state: "succeeded",
        lastActivityAt: terminalAt,
        terminalAt,
        terminalCategory: "completed",
        terminalMessage: `${admitted.operation.route} evaluation committed.`,
        resultIds: [evaluationId],
      });
      const evaluatedOpportunity = updated(admitted.opportunity, terminalAt, {
        workflowState: "evaluated",
      });
      const usedRubric = updated(rubric, terminalAt, {
        usedAt: rubric.usedAt ?? terminalAt,
      });
      return await this.repository.commit({
        workspaceId: this.workspaceId,
        context: {
          commandId: this.ids.entity("command"),
          actor: context.actor,
          idempotencyKey: `${context.idempotencyKey}:complete`,
          operationId,
        },
        command: { kind: "evaluation.complete", evaluationId, input },
        mutations: [
          {
            action: "update",
            kind: "evaluation",
            entity: completedEvaluation,
            expectedRevision: admitted.evaluation.revision,
          },
          {
            action: "update",
            kind: "operation",
            entity: completedOperation,
            expectedRevision: admitted.operation.revision,
          },
          {
            action: "update",
            kind: "opportunity",
            entity: evaluatedOpportunity,
            expectedRevision: admitted.opportunity.revision,
          },
          {
            action: "update",
            kind: "rubric",
            entity: usedRubric,
            expectedRevision: rubric.revision,
          },
        ],
        events: [
          event(
            operationContext,
            terminalAt,
            "evaluation.completed",
            evaluationId,
            completedEvaluation.revision,
            {
              aggregateScoreBasisPoints: score.aggregateScoreBasisPoints,
              acceptedEvidenceIds: score.acceptedEvidenceIds,
            },
          ),
          event(
            operationContext,
            terminalAt,
            "operation.terminal",
            operationId,
            completedOperation.revision,
            { state: "succeeded", category: "completed" },
          ),
          event(
            operationContext,
            terminalAt,
            "opportunity.evaluated",
            opportunity.id,
            evaluatedOpportunity.revision,
            { evaluationId },
          ),
          event(
            operationContext,
            terminalAt,
            "rubric.used",
            rubric.id,
            usedRubric.revision,
            { evaluationId },
          ),
        ],
        result: completedEvaluation,
      });
    } catch (error) {
      await this.failOperation(
        admitted.operation,
        admitted.evaluation,
        operationContext,
        error,
      );
      throw error;
    }
  }

  public async startOperation(
    input: StartOperationInput,
    context: CommandContext,
  ): Promise<Operation> {
    assertDomain(
      context.actor === "dsh_agent" || context.actor === "dsh_child",
      "approval_required",
      "Only an authenticated DSH Agent may start a model operation.",
    );
    assertDomain(
      input.kind.length > 0 && input.kind.length <= 80,
      "invalid_request",
      "Operation kind is invalid.",
    );
    assertDomain(
      input.dshSessionId.length > 0 && input.dshSessionId.length <= 200,
      "invalid_request",
      "DSH session identity is invalid.",
    );
    assertDomain(
      input.provider.length > 0 &&
        input.provider.length <= 100 &&
        input.model.length > 0 &&
        input.model.length <= 200 &&
        (input.reasoningEffort?.length ?? 0) <= 50,
      "invalid_request",
      "DSH model selection is invalid.",
    );
    assertDomain(
      input.requestedCapabilities.length <= 16 &&
        input.requestedCapabilities.every(
          (item) => item.length > 0 && item.length <= 80,
        ),
      "invalid_request",
      "Requested capabilities are invalid.",
    );
    await this.repository.get("opportunity", input.inputIdentity);
    const parentOperation =
      input.parentOperationId === undefined
        ? null
        : await this.repository.get("operation", input.parentOperationId);
    if (input.route === "native_child") {
      assertDomain(
        parentOperation !== null,
        "invalid_request",
        "Native child admission requires a parent operation.",
      );
      assertDomain(
        context.dshSessionId !== undefined &&
          (await this.operationLineageIncludesSession(
            parentOperation,
            context.dshSessionId,
          )),
        "approval_denied",
        "Only the originating parent DSH session may admit a native child.",
      );
    } else {
      assertDomain(
        context.dshSessionId === input.dshSessionId,
        "approval_denied",
        "Operation session must match the authenticated DSH session.",
      );
    }
    const now = this.clock.now();
    const operation: Operation = {
      id: this.ids.entity("operation"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      kind: input.kind,
      inputIdentity: input.inputIdentity,
      requestedCapabilities: [...input.requestedCapabilities],
      dshSessionId: input.dshSessionId,
      parentOperationId: input.parentOperationId ?? null,
      state: "queued",
      route: input.route,
      startedAt: null,
      lastActivityAt: now,
      terminalAt: null,
      terminalCategory: null,
      terminalMessage: null,
      resultIds: [],
      artifactIds: [],
      cancellationRequestedAt: null,
    };
    const operationContext: CommandContext = {
      ...context,
      operationId: operation.id,
    };
    const admitted = await this.repository.commit({
      workspaceId: this.workspaceId,
      context: {
        ...operationContext,
        idempotencyKey: `${context.idempotencyKey}:admit`,
      },
      command: { kind: "operation.admit", input },
      mutations: [{ action: "insert", kind: "operation", entity: operation }],
      events: [
        event(
          operationContext,
          now,
          "operation.admitted",
          operation.id,
          operation.revision,
          {
            route: operation.route,
            dshSessionId: operation.dshSessionId,
            provider: input.provider,
            model: input.model,
            ...(input.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: input.reasoningEffort }),
          },
        ),
      ],
      result: operation,
    });
    if (input.admissionOnly === true) return admitted;
    const startedAt = this.clock.now();
    const started = updated(admitted, startedAt, {
      state: "running",
      startedAt,
      lastActivityAt: startedAt,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context: {
        ...operationContext,
        idempotencyKey: `${context.idempotencyKey}:started`,
      },
      command: { kind: "operation.start", operationId: admitted.id },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: started,
          expectedRevision: admitted.revision,
        },
      ],
      events: [
        event(
          operationContext,
          startedAt,
          "operation.started",
          started.id,
          started.revision,
          {},
        ),
      ],
      result: started,
    });
  }

  public async recordOperationActivity(
    operationId: EntityId,
    input: OperationActivityInput,
    context: CommandContext,
  ): Promise<Operation> {
    const operation = await this.authorizeOperation(operationId, context);
    assertDomain(
      input.expectedRevision === operation.revision,
      "revision_conflict",
      "Operation revision changed before the activity was recorded.",
    );
    assertDomain(
      input.message === undefined || input.message.length <= 16_384,
      "invalid_request",
      "Operation activity message exceeds the supported bound.",
    );
    assertDomain(
      input.messageId === undefined || input.messageId.length <= 200,
      "invalid_request",
      "Operation activity message identity exceeds the supported bound.",
    );
    const terminal = [
      "succeeded",
      "failed",
      "canceled",
      "indeterminate",
    ].includes(operation.state);
    assertDomain(
      !terminal || input.phase === "deleted",
      "invalid_transition",
      "A terminal operation only accepts a deletion audit event.",
    );
    const now = this.clock.now();
    const next = updated(operation, now, {
      ...(input.phase === "started" || input.phase === "followup"
        ? { state: "running" as const, startedAt: operation.startedAt ?? now }
        : {}),
      lastActivityAt: now,
    });
    const operationContext = { ...context, operationId };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context: operationContext,
      command: { kind: `operation.${input.phase}`, operationId, input },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: next,
          expectedRevision: operation.revision,
        },
      ],
      events: [
        event(
          operationContext,
          now,
          `operation.${input.phase}`,
          operationId,
          next.revision,
          {
            ...(input.message === undefined ? {} : { message: input.message }),
            ...(input.messageId === undefined
              ? {}
              : { messageId: input.messageId }),
            ...(input.requestId === undefined
              ? {}
              : { requestId: input.requestId }),
          },
        ),
      ],
      result: next,
    });
  }

  public async terminateOperation(
    operationId: EntityId,
    input: TerminalOperationInput,
    context: CommandContext,
  ): Promise<Operation> {
    const operation = await this.authorizeOperation(operationId, context);
    assertDomain(
      input.expectedRevision === operation.revision,
      "revision_conflict",
      "Operation revision changed before terminal settlement.",
    );
    assertDomain(
      !["succeeded", "failed", "canceled", "indeterminate"].includes(
        operation.state,
      ),
      "invalid_transition",
      "Operation already reached a terminal state.",
    );
    assertDomain(
      input.category.length > 0 &&
        input.category.length <= 100 &&
        input.message.length > 0 &&
        input.message.length <= 16_384 &&
        input.resultIds.length <= 64 &&
        input.artifactIds.length <= 64,
      "invalid_request",
      "Operation terminal payload exceeds the supported bound.",
    );
    const now = this.clock.now();
    const terminal = updated(operation, now, {
      state: input.state,
      lastActivityAt: now,
      terminalAt: now,
      terminalCategory: input.category,
      terminalMessage: input.message,
      resultIds: [...input.resultIds],
      artifactIds: [...input.artifactIds],
    });
    const operationContext = { ...context, operationId };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context: operationContext,
      command: { kind: "operation.terminal", operationId, input },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: terminal,
          expectedRevision: operation.revision,
        },
      ],
      events: [
        event(
          operationContext,
          now,
          "operation.terminal",
          operationId,
          terminal.revision,
          { state: terminal.state, category: input.category },
        ),
      ],
      result: terminal,
    });
  }

  public async requestOperationCancellation(
    operationId: EntityId,
    input: CancelOperationInput,
    context: CommandContext,
  ): Promise<Operation> {
    const operation = await this.authorizeOperation(operationId, context);
    assertDomain(
      input.expectedRevision === operation.revision,
      "revision_conflict",
      "Operation revision changed before cancellation was requested.",
    );
    assertDomain(
      !["succeeded", "failed", "canceled", "indeterminate"].includes(
        operation.state,
      ),
      "invalid_transition",
      "A terminal operation cannot be canceled.",
    );
    assertDomain(
      input.reason.length > 0 && input.reason.length <= 500,
      "invalid_request",
      "Cancellation reason exceeds the supported bound.",
    );
    const now = this.clock.now();
    const requested = updated(operation, now, {
      lastActivityAt: now,
      cancellationRequestedAt: operation.cancellationRequestedAt ?? now,
    });
    const operationContext = { ...context, operationId };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context: operationContext,
      command: { kind: "operation.cancel", operationId, input },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: requested,
          expectedRevision: operation.revision,
        },
      ],
      events: [
        event(
          operationContext,
          now,
          "operation.cancellation_requested",
          operationId,
          requested.revision,
          { reason: input.reason },
        ),
      ],
      result: requested,
    });
  }

  public async requestUserOperationCancellation(
    operationId: EntityId,
    input: CancelOperationInput,
    context: CommandContext,
  ): Promise<Operation> {
    assertDomain(
      context.actor === "browser",
      "approval_denied",
      "Only an authenticated same-origin user interaction may request cancellation.",
    );
    const operation = await this.repository.get("operation", operationId);
    assertDomain(
      input.expectedRevision === operation.revision,
      "revision_conflict",
      "Operation revision changed before cancellation was requested.",
    );
    assertDomain(
      !["succeeded", "failed", "canceled", "indeterminate"].includes(
        operation.state,
      ),
      "invalid_transition",
      "A terminal operation cannot be canceled.",
    );
    assertDomain(
      input.reason.trim().length > 0 && input.reason.length <= 500,
      "invalid_request",
      "Cancellation reason exceeds the supported bound.",
    );
    const now = this.clock.now();
    const requested = updated(operation, now, {
      lastActivityAt: now,
      cancellationRequestedAt: operation.cancellationRequestedAt ?? now,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "operation.user_cancellation_request",
        operationId,
        input,
      },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: requested,
          expectedRevision: operation.revision,
        },
      ],
      events: [
        event(
          context,
          now,
          "operation.cancellation_requested",
          operationId,
          requested.revision,
          { reason: input.reason, dispatchRequired: true },
        ),
      ],
      result: requested,
    });
  }

  public async requestChildFollowup(
    operationId: EntityId,
    input: RequestChildFollowupInput,
    context: CommandContext,
  ): Promise<Operation> {
    assertDomain(
      context.actor === "browser",
      "approval_denied",
      "Only an authenticated same-origin user interaction may request a follow-up.",
    );
    const operation = await this.repository.get("operation", operationId);
    assertDomain(
      operation.route === "native_child" && operation.dshSessionId !== null,
      "invalid_transition",
      "Follow-up requests apply only to native continuable children.",
    );
    assertDomain(
      input.expectedRevision === operation.revision,
      "revision_conflict",
      "Operation revision changed before the follow-up request was recorded.",
    );
    assertDomain(
      input.message.trim().length > 0 && input.message.length <= 8_000,
      "invalid_request",
      "Follow-up message exceeds the supported bound.",
    );
    const now = this.clock.now();
    const requested = updated(operation, now, { lastActivityAt: now });
    const requestId = this.ids.entity("followup");
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "operation.followup_request", operationId, input },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: requested,
          expectedRevision: operation.revision,
        },
      ],
      events: [
        event(
          context,
          now,
          "operation.followup_requested",
          operationId,
          requested.revision,
          { requestId, message: input.message },
        ),
      ],
      result: requested,
    });
  }

  private async authorizeOperation(
    operationId: EntityId,
    context: CommandContext,
  ): Promise<Operation> {
    assertDomain(
      (context.actor === "dsh_agent" || context.actor === "dsh_child") &&
        context.operationId === operationId &&
        context.dshSessionId !== undefined,
      "approval_denied",
      "Operation mutation requires authenticated DSH authority.",
    );
    const operation = await this.repository.get("operation", operationId);
    if (operation.route !== "native_child") {
      assertDomain(
        context.dshSessionId === operation.dshSessionId,
        "approval_denied",
        "Only the originating DSH session may mutate this operation.",
      );
      return operation;
    }
    assertDomain(
      await this.operationLineageIncludesSession(
        operation,
        context.dshSessionId,
      ),
      "approval_denied",
      "Only the native child or an originating ancestor may mutate this operation.",
    );
    return operation;
  }

  private async operationLineageIncludesSession(
    operation: Operation,
    sessionId: string,
  ): Promise<boolean> {
    let cursor: Operation | null = operation;
    const seen = new Set<string>();
    for (let depth = 0; cursor !== null && depth <= 16; depth += 1) {
      if (seen.has(cursor.id)) return false;
      seen.add(cursor.id);
      if (cursor.dshSessionId === sessionId) return true;
      cursor =
        cursor.parentOperationId === null
          ? null
          : await this.repository.get("operation", cursor.parentOperationId);
    }
    return false;
  }

  private async failOperation(
    operation: Operation,
    evaluation: Evaluation,
    context: CommandContext,
    failure: unknown,
  ): Promise<void> {
    const now = this.clock.now();
    const message =
      failure instanceof DomainError ? failure.code : "internal_error";
    const failedOperation = updated(operation, now, {
      state: "failed",
      lastActivityAt: now,
      terminalAt: now,
      terminalCategory: message,
      terminalMessage: "Evaluation failed before a result was committed.",
    });
    const failedEvaluation = updated(evaluation, now, { state: "failed" });
    await this.repository.commit({
      workspaceId: this.workspaceId,
      context: {
        commandId: this.ids.entity("command"),
        actor: context.actor,
        idempotencyKey: `${context.idempotencyKey}:failed`,
        operationId: operation.id,
      },
      command: {
        kind: "evaluation.fail",
        evaluationId: evaluation.id,
        category: message,
      },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: failedOperation,
          expectedRevision: operation.revision,
        },
        {
          action: "update",
          kind: "evaluation",
          entity: failedEvaluation,
          expectedRevision: evaluation.revision,
        },
      ],
      events: [
        event(
          context,
          now,
          "operation.terminal",
          operation.id,
          failedOperation.revision,
          { state: "failed", category: message },
        ),
        event(
          context,
          now,
          "evaluation.failed",
          evaluation.id,
          failedEvaluation.revision,
          { category: message },
        ),
      ],
      result: { operationId: operation.id, evaluationId: evaluation.id },
    });
  }

  public async sealEvaluationReport(
    evaluationId: EntityId,
    context: CommandContext,
  ): Promise<Artifact> {
    const evaluation = await this.repository.get("evaluation", evaluationId);
    assertDomain(
      evaluation.state === "completed",
      "artifact_unsealed",
      "Only a completed evaluation can produce a ready report.",
    );
    const opportunity = await this.repository.get(
      "opportunity",
      evaluation.opportunityId,
    );
    const acceptedEvidence = await Promise.all(
      evaluation.acceptedEvidenceIds.map((id) =>
        this.repository.get("evidence", id),
      ),
    );
    assertDomain(
      acceptedEvidence.every((item) => item.decision === "accepted"),
      "evidence_unsupported",
      "A report cannot include evidence that is not accepted.",
    );
    const report = [
      "# Evaluation report",
      "",
      `Organization: ${opportunity.organization}`,
      `Role: ${opportunity.roleTitle}`,
      `Score: ${evaluation.displayScore}`,
      `Deterministic total: ${String(evaluation.aggregateScoreBasisPoints)} basis points`,
      "",
      "## Accepted evidence",
      ...acceptedEvidence.map((item) => `- ${item.claim} [${item.id}]`),
      "",
      "## Gaps",
      ...(evaluation.gaps.length === 0
        ? ["- None recorded"]
        : evaluation.gaps.map((gap) => `- ${gap}`)),
      "",
      "## Arithmetic",
      evaluation.arithmeticExplanation,
      "",
    ].join("\n");
    const sealed = await this.artifacts.seal(
      new TextEncoder().encode(report),
      "text/markdown",
    );
    const now = this.clock.now();
    const candidateFactIds = acceptedEvidence
      .map((item) => item.candidateFactId)
      .filter((id): id is EntityId => id !== null);
    const artifact: Artifact = {
      id: this.ids.entity("artifact"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      kind: "evaluation_report",
      mediaType: "text/markdown",
      contentDigest: sealed.contentDigest,
      byteLength: sealed.byteLength,
      producer: "career-workbench",
      producerVersion: "0.1.0-preview.0",
      sourceIds: evaluation.sourceIds,
      factIds: candidateFactIds,
      evidenceIds: evaluation.acceptedEvidenceIds,
      rubricIds: [evaluation.rubricId],
      evaluationIds: [evaluation.id],
      operationIds:
        evaluation.operationId === null ? [] : [evaluation.operationId],
      state: "sealed",
      relativePath: sealed.relativePath,
      staleReason: null,
    };
    return this.commitInsert(
      "artifact",
      artifact,
      context,
      "artifact.seal",
      { evaluationId, contentDigest: sealed.contentDigest },
      "artifact.sealed",
      {
        kind: artifact.kind,
        contentDigest: artifact.contentDigest,
        byteLength: artifact.byteLength,
      },
    );
  }

  public async correctVerifiedFact(
    factId: EntityId,
    expectedRevision: number,
    newValue: ProfileFact["value"],
    locator: SourceLocator,
    context: CommandContext,
  ): Promise<{
    readonly fact: ProfileFact;
    readonly staleEvaluationIds: readonly EntityId[];
    readonly staleComparisonIds: readonly EntityId[];
    readonly staleArtifactIds: readonly EntityId[];
  }> {
    const fact = await this.repository.get("profileFact", factId);
    assertDomain(
      fact.status === "verified",
      "invalid_transition",
      "Only a verified fact can be corrected.",
    );
    assertDomain(
      fact.revision === expectedRevision,
      "revision_conflict",
      "Fact revision is stale.",
    );
    const source = await this.repository.get("source", locator.sourceId);
    validateSourceLocator(source, locator);
    assertDomain(
      source.trustClass === "candidate_primary",
      "evidence_unsupported",
      "Correction requires candidate primary evidence.",
    );
    const now = this.clock.now();
    const oldFact = updated(fact, now, { status: "superseded" });
    const correction: ProfileFact = {
      ...fact,
      id: this.ids.entity("fact"),
      value: newValue,
      status: "verified",
      sourceLocators: [locator],
      proposedBy: "user",
      confirmedByUserAt: now,
      supersedesFactId: fact.id,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    const evidence = await this.repository.list("evidence", this.workspaceId);
    const dependentEvidenceIds = new Set(
      evidence
        .filter(
          (item) =>
            item.candidateFactId === fact.id && item.decision === "accepted",
        )
        .map((item) => item.id),
    );
    const evaluations = await this.repository.list(
      "evaluation",
      this.workspaceId,
    );
    const staleEvaluations = evaluations
      .filter(
        (item) =>
          item.state === "completed" &&
          item.acceptedEvidenceIds.some((id) => dependentEvidenceIds.has(id)),
      )
      .map((item) =>
        updated(item, now, {
          state: "stale",
          staleReason: `Profile fact ${fact.id} was superseded.`,
        }),
      );
    const staleEvaluationIds = new Set(staleEvaluations.map((item) => item.id));
    const comparisons = await this.repository.list(
      "comparison",
      this.workspaceId,
    );
    const staleComparisons = comparisons
      .filter(
        (item) =>
          item.state !== "stale" &&
          item.evaluationInputs.some((input) =>
            staleEvaluationIds.has(input.evaluationId),
          ),
      )
      .map((item) =>
        updated(item, now, {
          state: "stale" as const,
          staleReason: `Profile fact ${fact.id} was superseded.`,
        }),
      );
    const artifacts = await this.repository.list("artifact", this.workspaceId);
    const staleArtifacts = artifacts
      .filter(
        (item) =>
          item.state === "sealed" &&
          (item.factIds.includes(fact.id) ||
            item.evaluationIds.some((id) => staleEvaluationIds.has(id))),
      )
      .map((item) =>
        updated(item, now, {
          state: "stale",
          staleReason: `Profile fact ${fact.id} was superseded.`,
        }),
      );
    const mutations: Mutation[] = [
      {
        action: "update",
        kind: "profileFact",
        entity: oldFact,
        expectedRevision,
      },
      { action: "insert", kind: "profileFact", entity: correction },
      ...staleEvaluations.map((entity): Mutation => ({
        action: "update",
        kind: "evaluation",
        entity,
        expectedRevision: entity.revision - 1,
      })),
      ...staleComparisons.map((entity): Mutation => ({
        action: "update",
        kind: "comparison",
        entity,
        expectedRevision: entity.revision - 1,
      })),
      ...staleArtifacts.map((entity): Mutation => ({
        action: "update",
        kind: "artifact",
        entity,
        expectedRevision: entity.revision - 1,
      })),
    ];
    const events: EventToAppend[] = [
      event(
        context,
        now,
        "profile_fact.superseded",
        fact.id,
        oldFact.revision,
        { supersededBy: correction.id },
      ),
      event(context, now, "profile_fact.corrected", correction.id, 1, {
        supersedesFactId: fact.id,
      }),
      ...staleEvaluations.map((item) =>
        event(context, now, "evaluation.stale", item.id, item.revision, {
          dependencyFactId: fact.id,
        }),
      ),
      ...staleComparisons.map((item) =>
        event(context, now, "comparison.stale", item.id, item.revision, {
          dependencyFactId: fact.id,
        }),
      ),
      ...staleArtifacts.map((item) =>
        event(context, now, "artifact.stale", item.id, item.revision, {
          dependencyFactId: fact.id,
        }),
      ),
    ];
    const result = {
      fact: correction,
      staleEvaluationIds: staleEvaluations.map((item) => item.id),
      staleComparisonIds: staleComparisons.map((item) => item.id),
      staleArtifactIds: staleArtifacts.map((item) => item.id),
    };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "profile_fact.correct_verified",
        factId,
        expectedRevision,
        newValue,
        locator,
      },
      mutations,
      events,
      result,
    });
  }

  public async comparisonProjections(
    evaluationIds: readonly EntityId[],
  ): Promise<Comparison["evaluationInputs"]> {
    assertDomain(
      evaluationIds.length === 3 && new Set(evaluationIds).size === 3,
      "invalid_request",
      "A comparison requires exactly three distinct evaluations.",
    );
    const evaluations = await Promise.all(
      evaluationIds.map((id) => this.repository.get("evaluation", id)),
    );
    assertDomain(
      evaluations.every(
        (evaluation) =>
          evaluation.state === "completed" && evaluation.staleReason === null,
      ),
      "invalid_transition",
      "Comparison inputs must be current completed evaluations.",
    );
    const keys = evaluations[0]?.dimensionScores
      .map((score) => score.dimensionKey)
      .sort();
    assertDomain(
      keys !== undefined &&
        evaluations.every(
          (evaluation) =>
            JSON.stringify(
              evaluation.dimensionScores
                .map((score) => score.dimensionKey)
                .sort(),
            ) === JSON.stringify(keys),
        ),
      "invalid_transition",
      "Evaluation dimensions are incomparable.",
    );
    return evaluations.map((evaluation) => ({
      evaluationId: evaluation.id,
      evaluationRevision: evaluation.revision,
      opportunityId: evaluation.opportunityId,
      aggregateScoreBasisPoints: evaluation.aggregateScoreBasisPoints,
      dimensionValues: Object.fromEntries(
        evaluation.dimensionScores.map((score) => [
          score.dimensionKey,
          score.inputBasisPoints,
        ]),
      ),
    }));
  }

  public async proposeComparison(
    operationId: EntityId,
    input: ProposeComparisonInput,
    context: CommandContext,
  ): Promise<Comparison> {
    const operation = await this.authorizeOperation(operationId, context);
    assertDomain(
      operation.route === "rlm" &&
        (operation.state === "queued" || operation.state === "running"),
      "invalid_transition",
      "Structured comparison proposals require an active RLM operation.",
    );
    assertDomain(
      /^\d+\.\d+\.\d+$/u.test(input.policyVersion) &&
        input.policyVersion.length <= 30,
      "invalid_request",
      "Comparison policy version is invalid.",
    );
    assertDomain(
      input.scenarios.length > 0 &&
        input.scenarios.length <= 8 &&
        input.tradeoffs.length <= 16 &&
        input.tradeoffs.every(
          (tradeoff) => tradeoff.trim().length > 0 && tradeoff.length <= 1_000,
        ),
      "invalid_request",
      "Comparison proposal exceeds its supported bounds.",
    );
    const evaluationInputs = await this.comparisonProjections(
      input.evaluationIds,
    );
    const dimensionKeys = Object.keys(
      evaluationInputs[0]?.dimensionValues ?? {},
    ).sort();
    const scenarios: ComparisonScenarioResult[] = input.scenarios.map(
      (scenario) => {
        const suppliedKeys = Object.keys(scenario.weightsBasisPoints).sort();
        const weights = Object.values(scenario.weightsBasisPoints);
        assertDomain(
          scenario.label.trim().length > 0 &&
            scenario.label.length <= 120 &&
            JSON.stringify(suppliedKeys) === JSON.stringify(dimensionKeys) &&
            weights.every(
              (weight) =>
                Number.isSafeInteger(weight) && weight >= 0 && weight <= 10_000,
            ) &&
            weights.reduce((sum, weight) => sum + weight, 0) === 10_000,
          "invalid_request",
          "Scenario weights must cover the comparable dimensions and total 10,000 basis points.",
        );
        const scoresBasisPoints = Object.fromEntries(
          evaluationInputs.map((evaluation) => {
            const numerator = dimensionKeys.reduce(
              (sum, key) =>
                sum +
                (evaluation.dimensionValues[key] ?? 0) *
                  (scenario.weightsBasisPoints[key] ?? 0),
              0,
            );
            return [evaluation.evaluationId, Math.round(numerator / 10_000)];
          }),
        );
        const rankedEvaluationIds = evaluationInputs
          .map((evaluation) => evaluation.evaluationId)
          .sort(
            (left, right) =>
              (scoresBasisPoints[right] ?? 0) -
                (scoresBasisPoints[left] ?? 0) || left.localeCompare(right),
          );
        return {
          label: scenario.label,
          weightsBasisPoints: { ...scenario.weightsBasisPoints },
          rankedEvaluationIds,
          scoresBasisPoints,
        };
      },
    );
    const now = this.clock.now();
    const comparison: Comparison = {
      id: this.ids.entity("comparison"),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      policyVersion: input.policyVersion,
      evaluationInputs,
      scenarios,
      tradeoffs: [...input.tradeoffs],
      state: "proposed",
      operationId,
      acceptedAt: null,
      staleReason: null,
    };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "comparison.propose", operationId, input },
      mutations: [{ action: "insert", kind: "comparison", entity: comparison }],
      events: [
        event(
          context,
          now,
          "comparison.proposed",
          comparison.id,
          comparison.revision,
          {
            operationId,
            policyVersion: comparison.policyVersion,
            evaluationIds: comparison.evaluationInputs.map(
              (evaluation) => evaluation.evaluationId,
            ),
          },
        ),
      ],
      result: comparison,
    });
  }

  public async acceptComparison(
    comparisonId: EntityId,
    expectedRevision: number,
    context: CommandContext,
  ): Promise<Comparison> {
    assertDomain(
      context.actor === "browser" || context.actor === "user",
      "approval_required",
      "A user interaction is required to accept a comparison.",
    );
    const comparison = await this.repository.get("comparison", comparisonId);
    assertDomain(
      comparison.revision === expectedRevision,
      "revision_conflict",
      "Comparison revision changed before acceptance.",
    );
    assertDomain(
      comparison.state === "proposed",
      "invalid_transition",
      "Only a current proposed comparison can be accepted.",
    );
    const currentInputs = await this.comparisonProjections(
      comparison.evaluationInputs.map((input) => input.evaluationId),
    );
    assertDomain(
      currentInputs.every(
        (current, index) =>
          current.evaluationRevision ===
          comparison.evaluationInputs[index]?.evaluationRevision,
      ),
      "revision_conflict",
      "A comparison input changed before acceptance.",
    );
    const now = this.clock.now();
    const accepted = updated(comparison, now, {
      state: "accepted" as const,
      acceptedAt: now,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "comparison.accept", comparisonId, expectedRevision },
      mutations: [
        {
          action: "update",
          kind: "comparison",
          entity: accepted,
          expectedRevision,
        },
      ],
      events: [
        event(
          context,
          now,
          "comparison.accepted",
          comparisonId,
          accepted.revision,
          { operationId: comparison.operationId },
        ),
      ],
      result: accepted,
    });
  }

  public async createApplication(
    input: CreateApplicationInput,
    context: CommandContext,
  ): Promise<Application> {
    const opportunity = await this.repository.get(
      "opportunity",
      input.opportunityId,
    );
    const existing = await this.repository.list(
      "application",
      this.workspaceId,
    );
    assertDomain(
      !existing.some((item) => item.opportunityId === opportunity.id),
      "duplicate_identity",
      "This opportunity already has an application pipeline record.",
    );
    assertDomain(
      /^\d{4}-\d{2}-\d{2}$/u.test(input.effectiveDate),
      "invalid_request",
      "Application effective date must use YYYY-MM-DD.",
    );
    assertDomain(
      input.note === undefined || input.note.length <= 2_000,
      "invalid_request",
      "Application note exceeds the supported limit.",
    );
    const now = this.clock.now();
    const note = input.note?.trim();
    const application: Application = {
      id: this.ids.entity("application"),
      workspaceId: this.workspaceId,
      opportunityId: opportunity.id,
      state: "considering",
      stateRevision: 1,
      effectiveDate: input.effectiveDate,
      sourceIds: [opportunity.sourceDocumentId],
      note: note === undefined || note.length === 0 ? null : note,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "application.create", input },
      mutations: [
        { action: "insert", kind: "application", entity: application },
      ],
      events: [
        event(context, now, "application.created", application.id, 1, {
          opportunityId: opportunity.id,
          state: application.state,
          effectiveDate: application.effectiveDate,
        }),
      ],
      result: application,
    });
  }

  public async transitionApplication(
    applicationId: EntityId,
    input: TransitionApplicationInput,
    context: CommandContext,
  ): Promise<Application> {
    const application = await this.repository.get("application", applicationId);
    assertDomain(
      application.revision === input.expectedRevision,
      "revision_conflict",
      "Application revision is stale.",
    );
    assertDomain(
      /^\d{4}-\d{2}-\d{2}$/u.test(input.effectiveDate),
      "invalid_request",
      "Application effective date must use YYYY-MM-DD.",
    );
    assertDomain(
      input.note === undefined || input.note.length <= 2_000,
      "invalid_request",
      "Application note exceeds the supported limit.",
    );
    requireApplicationTransition(application.state, input.state);
    const now = this.clock.now();
    const note = input.note?.trim();
    const transitioned = updated(application, now, {
      state: input.state,
      stateRevision: application.stateRevision + 1,
      effectiveDate: input.effectiveDate,
      note: note === undefined || note.length === 0 ? null : note,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "application.transition", applicationId, input },
      mutations: [
        {
          action: "update",
          kind: "application",
          entity: transitioned,
          expectedRevision: input.expectedRevision,
        },
      ],
      events: [
        event(
          context,
          now,
          "application.transitioned",
          application.id,
          transitioned.revision,
          {
            from: application.state,
            to: transitioned.state,
            stateRevision: transitioned.stateRevision,
            effectiveDate: transitioned.effectiveDate,
          },
        ),
      ],
      result: transitioned,
    });
  }

  public async updateOpportunitySignals(
    opportunityId: EntityId,
    input: UpdateOpportunitySignalsInput,
    context: CommandContext,
  ): Promise<Opportunity> {
    const opportunity = await this.repository.get("opportunity", opportunityId);
    assertDomain(
      opportunity.revision === input.expectedRevision,
      "revision_conflict",
      "Opportunity revision is stale.",
    );
    const now = this.clock.now();
    const signaled = updated(opportunity, now, {
      sourceStatus: input.sourceStatus,
      legitimacyStatus: input.legitimacyStatus,
    });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "opportunity.signals.update", opportunityId, input },
      mutations: [
        {
          action: "update",
          kind: "opportunity",
          entity: signaled,
          expectedRevision: input.expectedRevision,
        },
      ],
      events: [
        event(
          context,
          now,
          "opportunity.signals.updated",
          opportunity.id,
          signaled.revision,
          {
            sourceStatus: signaled.sourceStatus,
            legitimacyStatus: signaled.legitimacyStatus,
          },
        ),
      ],
      result: signaled,
    });
  }

  public async createCandidateArtifact(
    input: CreateCandidateArtifactInput,
    context: CommandContext,
  ): Promise<Artifact> {
    assertDomain(
      [
        "draft_cv",
        "draft_cover_letter",
        "draft_outreach",
        "draft_interview_prep",
      ].includes(input.kind),
      "invalid_request",
      "Candidate artifact kind is unsupported.",
    );
    assertDomain(
      input.factIds.length > 0 &&
        input.factIds.length <= 32 &&
        new Set(input.factIds).size === input.factIds.length,
      "invalid_request",
      "Candidate artifact requires one to 32 unique facts.",
    );
    assertDomain(
      input.styleNote === undefined || input.styleNote.length <= 1_000,
      "invalid_request",
      "Non-factual style note exceeds the supported limit.",
    );
    const opportunity = await this.repository.get(
      "opportunity",
      input.opportunityId,
    );
    const facts = await Promise.all(
      input.factIds.map((id) => this.repository.get("profileFact", id)),
    );
    assertDomain(
      facts.every((fact) => fact.status === "verified"),
      "evidence_unsupported",
      "Candidate drafts require current verified profile facts.",
    );
    const allEvidence = await this.repository.list(
      "evidence",
      this.workspaceId,
    );
    const evidenceByFact = new Map<EntityId, EvidenceItem>();
    for (const item of allEvidence) {
      if (
        item.classification === "candidate_fact" &&
        item.candidateFactId !== null &&
        item.decision === "accepted" &&
        !evidenceByFact.has(item.candidateFactId)
      ) {
        evidenceByFact.set(item.candidateFactId, item);
      }
    }
    const acceptedEvidence = facts.map((fact) => evidenceByFact.get(fact.id));
    assertDomain(
      acceptedEvidence.every(
        (item): item is EvidenceItem => item !== undefined,
      ),
      "evidence_unsupported",
      "Every candidate-facing fact requires accepted candidate evidence.",
    );
    const titleByKind: Readonly<Record<CandidateArtifactKind, string>> = {
      draft_cv: "CV evidence draft",
      draft_cover_letter: "Cover-letter evidence draft",
      draft_outreach: "Outreach evidence draft",
      draft_interview_prep: "Interview-preparation evidence draft",
    };
    const styleNote = input.styleNote?.trim();
    const lines = [
      `# ${titleByKind[input.kind]}`,
      "",
      "DRAFT — explicit human review required before use.",
      "",
      `Opportunity context: ${opportunity.roleTitle} at ${opportunity.organization} [source ${opportunity.sourceDocumentId}]`,
      "",
      "## Evidence-backed candidate statements",
      ...facts.map(
        (fact, index) =>
          `- ${renderProfileFactClaim(fact)} [fact ${fact.id}; evidence ${acceptedEvidence[index]?.id ?? "unreachable"}]`,
      ),
      "",
      "## Non-factual style direction",
      `[NON-FACTUAL STYLE] ${styleNote === undefined || styleNote.length === 0 ? "Clear, concise, and grounded only in the evidence above." : styleNote}`,
      "",
      "No application was submitted and no message was sent by generating this draft.",
      "",
    ];
    const bytes = new TextEncoder().encode(lines.join("\n"));
    const sealed = await this.artifacts.seal(bytes, "text/markdown");
    const now = this.clock.now();
    const artifact: Artifact = {
      id: this.ids.entity("artifact"),
      workspaceId: this.workspaceId,
      kind: input.kind,
      mediaType: "text/markdown",
      contentDigest: sealed.contentDigest,
      byteLength: sealed.byteLength,
      producer: "career-workbench",
      producerVersion: "0.1.0-preview.0",
      sourceIds: [
        opportunity.sourceDocumentId,
        ...new Set(
          facts.flatMap((fact) =>
            fact.sourceLocators.map((item) => item.sourceId),
          ),
        ),
      ],
      factIds: facts.map((fact) => fact.id),
      evidenceIds: acceptedEvidence.map((item) => item.id),
      rubricIds: [],
      evaluationIds: [],
      operationIds: [],
      state: "staged",
      relativePath: sealed.relativePath,
      staleReason: null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "artifact.candidate_draft.create",
        input: {
          ...input,
          styleNote:
            input.styleNote === undefined
              ? null
              : "[bounded non-factual style]",
        },
      },
      mutations: [{ action: "insert", kind: "artifact", entity: artifact }],
      events: [
        event(context, now, "artifact.drafted", artifact.id, 1, {
          kind: artifact.kind,
          opportunityId: opportunity.id,
          factIds: artifact.factIds,
          evidenceIds: artifact.evidenceIds,
          contentDigest: artifact.contentDigest,
          reviewRequired: true,
        }),
      ],
      result: artifact,
    });
  }

  public async reviewCandidateArtifact(
    artifactId: EntityId,
    expectedRevision: number,
    context: CommandContext,
  ): Promise<Artifact> {
    const artifact = await this.repository.get("artifact", artifactId);
    assertDomain(
      artifact.state === "staged" && artifact.kind.startsWith("draft_"),
      "invalid_transition",
      "Only a staged candidate draft can be marked reviewed.",
    );
    assertDomain(
      artifact.revision === expectedRevision,
      "revision_conflict",
      "Artifact revision is stale.",
    );
    const now = this.clock.now();
    const reviewed = updated(artifact, now, { state: "sealed" as const });
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: { kind: "artifact.review", artifactId, expectedRevision },
      mutations: [
        {
          action: "update",
          kind: "artifact",
          entity: reviewed,
          expectedRevision,
        },
      ],
      events: [
        event(
          context,
          now,
          "artifact.reviewed",
          artifact.id,
          reviewed.revision,
          {
            contentDigest: reviewed.contentDigest,
            factIds: reviewed.factIds,
            evidenceIds: reviewed.evidenceIds,
          },
        ),
      ],
      result: reviewed,
    });
  }

  public async readArtifact(artifactId: EntityId): Promise<{
    readonly artifact: Artifact;
    readonly text: string;
  }> {
    const artifact = await this.repository.get("artifact", artifactId);
    assertDomain(
      artifact.mediaType.startsWith("text/"),
      "invalid_request",
      "Only bounded text artifacts can be inspected in the browser.",
    );
    const bytes = await this.artifacts.read({
      contentDigest: artifact.contentDigest,
      byteLength: artifact.byteLength,
      relativePath: artifact.relativePath,
    });
    return {
      artifact,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  }

  public async applyCareerOpsImport(
    input: ApplyCareerOpsImportInput,
    context: CommandContext,
  ): Promise<ImportManifest> {
    assertDomain(
      /^[0-9a-f]{40}$/u.test(input.upstreamRevision),
      "invalid_request",
      "Career Ops revision must be an exact Git commit.",
    );
    assertDomain(
      input.files.length > 0 && input.files.length <= 512,
      "invalid_request",
      "Career Ops import file count is outside the supported limit.",
    );
    assertDomain(
      input.sourceLabel.length > 0 && input.sourceLabel.length <= 120,
      "invalid_request",
      "Career Ops source label is invalid.",
    );
    const priorManifests = await this.repository.list(
      "importManifest",
      this.workspaceId,
    );
    const identical = priorManifests.find(
      (item) =>
        item.sourceIdentityDigest === input.sourceIdentityDigest &&
        item.sourceFingerprint === input.sourceFingerprint,
    );
    if (identical !== undefined) return identical;

    const normalizedFiles = [...input.files].sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, "en"),
    );
    const uniquePaths = new Set(
      normalizedFiles.map((item) => item.relativePath),
    );
    assertDomain(
      uniquePaths.size === normalizedFiles.length,
      "duplicate_identity",
      "Career Ops import contains duplicate file identities.",
    );
    let totalBytes = 0;
    for (const file of normalizedFiles) {
      assertDomain(
        /^[A-Za-z0-9_.@+() -]+(?:\/[A-Za-z0-9_.@+() -]+)*$/u.test(
          file.relativePath,
        ) && !file.relativePath.split("/").includes(".."),
        "invalid_request",
        "Career Ops import relative path is invalid.",
      );
      totalBytes += file.bytes.byteLength;
      assertDomain(
        file.bytes.byteLength > 0 && file.bytes.byteLength <= 5 * 1024 * 1024,
        "artifact_limit_exceeded",
        "Career Ops source file exceeds the per-file limit.",
      );
      const digest = createHash("sha256").update(file.bytes).digest("hex");
      assertDomain(
        digest === file.contentDigest,
        "artifact_unsealed",
        "Career Ops source bytes do not match the preview digest.",
      );
    }
    assertDomain(
      totalBytes <= 25 * 1024 * 1024,
      "artifact_limit_exceeded",
      "Career Ops import exceeds the aggregate byte limit.",
    );
    const fingerprint = createHash("sha256")
      .update(
        canonicalJson(
          normalizedFiles.map((file) => ({
            relativePath: file.relativePath,
            mediaType: file.mediaType,
            contentDigest: file.contentDigest,
            byteLength: file.bytes.byteLength,
          })),
        ),
      )
      .digest("hex");
    assertDomain(
      fingerprint === input.sourceFingerprint,
      "revision_conflict",
      "Career Ops source changed after preview.",
    );

    const now = this.clock.now();
    const mutations: Mutation[] = [];
    const events: EventToAppend[] = [];
    const sourceByPath = new Map<string, SourceDocument>();
    const importSources: ImportManifest["sources"][number][] = [];
    const mappings: ImportMappingRecord[] = [];

    for (const file of normalizedFiles) {
      const sealed = await this.artifacts.seal(file.bytes, file.mediaType);
      assertDomain(
        sealed.contentDigest === file.contentDigest &&
          sealed.byteLength === file.bytes.byteLength,
        "artifact_unsealed",
        "Career Ops source did not seal to the preview identity.",
      );
      let inlineText: string | null = null;
      if (
        file.mediaType.startsWith("text/") &&
        file.bytes.byteLength <= MAX_INLINE_SOURCE_BYTES
      ) {
        try {
          inlineText = new TextDecoder("utf-8", { fatal: true }).decode(
            file.bytes,
          );
        } catch {
          inlineText = null;
        }
      }
      const artifactId = this.ids.entity("artifact");
      const sourceId = this.ids.entity("source");
      const artifact: Artifact = {
        id: artifactId,
        workspaceId: this.workspaceId,
        kind: "career_ops_source_bytes",
        mediaType: file.mediaType,
        contentDigest: sealed.contentDigest,
        byteLength: sealed.byteLength,
        producer: "@career-workbench/career-ops-import",
        producerVersion: "0.1.0-preview.0",
        sourceIds: [],
        factIds: [],
        evidenceIds: [],
        rubricIds: [],
        evaluationIds: [],
        operationIds: [],
        state: "sealed",
        relativePath: sealed.relativePath,
        staleReason: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      const source: SourceDocument = {
        id: sourceId,
        workspaceId: this.workspaceId,
        kind: file.kind,
        trustClass: file.trustClass,
        mediaType: file.mediaType,
        contentDigest: file.contentDigest,
        byteLength: file.bytes.byteLength,
        originalLocator: `career-ops:${file.relativePath}`,
        capturedAt: now,
        supersedesSourceId: null,
        inlineText,
        artifactId,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      sourceByPath.set(file.relativePath, source);
      importSources.push({
        relativePath: file.relativePath,
        mediaType: file.mediaType,
        contentDigest: file.contentDigest,
        byteLength: file.bytes.byteLength,
        sourceId,
        artifactId,
      });
      mutations.push(
        { action: "insert", kind: "artifact", entity: artifact },
        { action: "insert", kind: "source", entity: source },
      );
      events.push(
        event(context, now, "career_ops.source_bytes.sealed", artifactId, 1, {
          contentDigest: file.contentDigest,
          byteLength: file.bytes.byteLength,
          mediaType: file.mediaType,
        }),
        event(context, now, "career_ops.source.captured", sourceId, 1, {
          relativePath: file.relativePath,
          contentDigest: file.contentDigest,
          trustClass: file.trustClass,
        }),
      );
    }

    for (const proposal of input.profileFacts) {
      const source = sourceByPath.get(proposal.sourceRelativePath);
      assertDomain(
        source?.inlineText !== null && source?.inlineText !== undefined,
        "evidence_locator_invalid",
        "Imported profile fact source is unavailable as UTF-8 text.",
      );
      const locator: SourceLocator = {
        sourceId: source.id,
        start: proposal.start,
        end: proposal.end,
        quote: proposal.quote,
      };
      validateSourceLocator(source, locator);
      const fact: ProfileFact = {
        id: this.ids.entity("fact"),
        workspaceId: this.workspaceId,
        factType: proposal.factType,
        subject: proposal.subject,
        predicate: proposal.predicate,
        value: proposal.value,
        status: "proposed",
        sourceLocators: [locator],
        proposedBy: "import",
        confirmedByUserAt: null,
        supersedesFactId: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      mutations.push({ action: "insert", kind: "profileFact", entity: fact });
      events.push(
        event(context, now, "career_ops.profile_fact.proposed", fact.id, 1, {
          factType: fact.factType,
          sourceId: source.id,
          confirmationRequired: true,
        }),
      );
      mappings.push({
        sourceType: "profile",
        sourceIdentity: `${proposal.sourceRelativePath}:${proposal.predicate}`,
        disposition: "imported",
        targetKind: "profileFact",
        targetId: fact.id,
        originalStatus: null,
        originalScore: null,
        note: "Imported as proposed; user confirmation remains required.",
      });
    }

    for (const row of input.applications) {
      const tracker = sourceByPath.get(row.sourceRelativePath);
      assertDomain(
        tracker !== undefined,
        "entity_not_found",
        "Imported application tracker source is unavailable.",
      );
      const opportunity: Opportunity = {
        id: this.ids.entity("opportunity"),
        workspaceId: this.workspaceId,
        sourceDocumentId: tracker.id,
        organization: row.organization,
        roleTitle: row.roleTitle,
        originalUrl: row.originalUrl,
        location: row.location,
        workArrangement: null,
        advertisedCompensation: null,
        requisitionId: null,
        sourceStatus: "unknown",
        legitimacyStatus: "unknown",
        workflowState: "captured",
        sourceContentDigest: tracker.contentDigest,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      const reportSource =
        row.reportRelativePath === null
          ? undefined
          : sourceByPath.get(row.reportRelativePath);
      const application: Application = {
        id: this.ids.entity("application"),
        workspaceId: this.workspaceId,
        opportunityId: opportunity.id,
        state: row.state,
        stateRevision: 1,
        effectiveDate: row.effectiveDate,
        sourceIds: [
          tracker.id,
          ...(reportSource === undefined ? [] : [reportSource.id]),
        ],
        note: row.note,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      mutations.push(
        { action: "insert", kind: "opportunity", entity: opportunity },
        { action: "insert", kind: "application", entity: application },
      );
      events.push(
        event(
          context,
          now,
          "career_ops.opportunity.imported",
          opportunity.id,
          1,
          {
            sourceId: tracker.id,
          },
        ),
        event(
          context,
          now,
          "career_ops.application.imported",
          application.id,
          1,
          {
            opportunityId: opportunity.id,
            state: application.state,
            originalStatus: row.originalStatus,
            originalScore: row.originalScore,
          },
        ),
      );
      mappings.push({
        sourceType: "application",
        sourceIdentity: row.sourceIdentity,
        disposition: "imported",
        targetKind: "application",
        targetId: application.id,
        originalStatus: row.originalStatus,
        originalScore: row.originalScore,
        note: row.note,
      });
    }

    for (const passive of input.passiveMappings) {
      const source = sourceByPath.get(passive.sourceRelativePath);
      mappings.push({
        sourceType: passive.sourceType,
        sourceIdentity: passive.sourceIdentity,
        disposition: passive.disposition,
        targetKind: source === undefined ? null : "source",
        targetId: source?.id ?? null,
        originalStatus: passive.originalStatus,
        originalScore: passive.originalScore,
        note: passive.note,
      });
    }

    const manifest: ImportManifest = {
      id: this.ids.entity("import"),
      workspaceId: this.workspaceId,
      provider: "career-ops",
      upstreamRevision: input.upstreamRevision,
      observedVersion: input.observedVersion,
      sourceIdentityDigest: input.sourceIdentityDigest,
      sourceFingerprint: input.sourceFingerprint,
      sourceLabel: input.sourceLabel,
      sources: importSources,
      mappings,
      warnings: input.warnings,
      unsupported: input.unsupported,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    mutations.push({
      action: "insert",
      kind: "importManifest",
      entity: manifest,
    });
    events.push(
      event(context, now, "career_ops.import.completed", manifest.id, 1, {
        upstreamRevision: input.upstreamRevision,
        sourceFingerprint: input.sourceFingerprint,
        sourceCount: importSources.length,
        mappingCount: mappings.length,
        warningCount: input.warnings.length,
        unsupportedCount: input.unsupported.length,
      }),
    );
    return this.repository.commit({
      workspaceId: this.workspaceId,
      context,
      command: {
        kind: "career_ops.import.apply",
        sourceIdentityDigest: input.sourceIdentityDigest,
        sourceFingerprint: input.sourceFingerprint,
        upstreamRevision: input.upstreamRevision,
      },
      mutations,
      events,
      result: manifest,
    });
  }

  public async exportWorkspace(
    selectedArtifactIds: readonly EntityId[] = [],
  ): Promise<Readonly<Record<string, unknown>>> {
    const rawNormalized = await this.repository.normalizedExport(
      this.workspaceId,
    );
    const rawRecords = rawNormalized["records"];
    const records =
      typeof rawRecords === "object" && rawRecords !== null
        ? ({ ...rawRecords } as Record<string, unknown>)
        : {};
    const rawSources = records["source"];
    if (Array.isArray(rawSources)) {
      const sourceItems: unknown[] = rawSources;
      records["source"] = sourceItems.map((item): unknown => {
        if (typeof item !== "object" || item === null) return item;
        return {
          ...(item as Readonly<Record<string, unknown>>),
          originalLocator: null,
          inlineText: null,
        };
      });
    }
    const normalizedBody = {
      schemaVersion: rawNormalized["schemaVersion"],
      records,
      events: rawNormalized["events"],
    };
    const normalized = {
      ...normalizedBody,
      manifest: {
        schemaVersion: 1,
        digest: createHash("sha256")
          .update(canonicalJson(normalizedBody))
          .digest("hex"),
      },
    };
    const selected = await Promise.all(
      selectedArtifactIds.map(async (id) => {
        const artifact = await this.repository.get("artifact", id);
        assertDomain(
          artifact.state === "sealed" || artifact.state === "stale",
          "artifact_unsealed",
          "Only sealed historical bytes can be exported.",
        );
        const bytes = await this.artifacts.read({
          contentDigest: artifact.contentDigest,
          byteLength: artifact.byteLength,
          relativePath: artifact.relativePath,
        });
        return {
          artifactId: id,
          contentDigest: artifact.contentDigest,
          byteLength: artifact.byteLength,
          mediaType: artifact.mediaType,
          bytesBase64: Buffer.from(bytes).toString("base64"),
        };
      }),
    );
    const body = {
      contractVersion: "v1",
      normalized,
      selectedArtifacts: selected,
    };
    return {
      ...body,
      exportManifest: {
        schemaVersion: 1,
        digest: createHash("sha256").update(canonicalJson(body)).digest("hex"),
        credentialFree: true,
      },
    };
  }

  private async commitInsert<
    Entity extends
      | SourceDocument
      | ProfileFact
      | Opportunity
      | EvidenceItem
      | Rubric
      | Artifact,
  >(
    kind:
      | "source"
      | "profileFact"
      | "opportunity"
      | "evidence"
      | "rubric"
      | "artifact",
    entity: Entity,
    context: CommandContext,
    commandKind: string,
    commandInput: unknown,
    eventKind: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Entity> {
    return this.repository.commit<Entity>({
      workspaceId: this.workspaceId,
      context,
      command: { kind: commandKind, input: commandInput },
      mutations: [{ action: "insert", kind, entity }],
      events: [
        event(context, entity.createdAt, eventKind, entity.id, 1, payload),
      ],
      result: entity,
    });
  }
}

export function factClaim(fact: ProfileFact): string {
  return renderProfileFactClaim(fact);
}
