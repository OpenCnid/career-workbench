export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};
export type WorkspaceId = Brand<string, "WorkspaceId">;
export type EntityId = Brand<string, "EntityId">;
export type UtcTimestamp = Brand<string, "UtcTimestamp">;
export type Digest = Brand<string, "Sha256Digest">;

export interface EntityBase {
  readonly id: EntityId;
  readonly workspaceId: WorkspaceId;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly revision: number;
}

export interface Workspace {
  readonly id: WorkspaceId;
  readonly displayName: string;
  readonly schemaVersion: number;
  readonly policyVersion: string;
  readonly defaultRubricId: EntityId | null;
  readonly locale: string;
  readonly timezone: string;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly revision: number;
}

export type SourceKind =
  "candidate" | "opportunity" | "company" | "market" | "message" | "import";
export type TrustClass = "candidate_primary" | "candidate_derived" | "external";

export interface SourceDocument extends EntityBase {
  readonly kind: SourceKind;
  readonly trustClass: TrustClass;
  readonly mediaType: string;
  readonly contentDigest: Digest;
  readonly byteLength: number;
  readonly originalLocator: string | null;
  readonly capturedAt: UtcTimestamp;
  readonly supersedesSourceId: EntityId | null;
  readonly inlineText: string | null;
  readonly artifactId: EntityId | null;
}

export type JsonPrimitive = string | number | boolean | null;
export type ProfileFactStatus =
  | "proposed"
  | "verified"
  | "derived_unverified"
  | "user_cannot_confirm"
  | "rejected"
  | "superseded";
export type ProposedBy = "user" | "import" | "agent" | "system";

export interface SourceLocator {
  readonly sourceId: EntityId;
  readonly start: number;
  readonly end: number;
  readonly quote: string;
}

export interface ProfileFact extends EntityBase {
  readonly factType: string;
  readonly subject: string;
  readonly predicate: string;
  readonly value: JsonPrimitive;
  readonly status: ProfileFactStatus;
  readonly sourceLocators: readonly SourceLocator[];
  readonly proposedBy: ProposedBy;
  readonly confirmedByUserAt: UtcTimestamp | null;
  readonly supersedesFactId: EntityId | null;
}

export type SourceStatus = "unknown" | "active" | "expired" | "unavailable";
export type LegitimacyStatus =
  "unknown" | "high_confidence" | "needs_review" | "concern";
export type OpportunityWorkflowState =
  | "captured"
  | "evaluating"
  | "evaluated"
  | "shortlisted"
  | "discarded"
  | "archived";

export interface Opportunity extends EntityBase {
  readonly sourceDocumentId: EntityId;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl: string | null;
  readonly location: string | null;
  readonly workArrangement: string | null;
  readonly advertisedCompensation: string | null;
  readonly requisitionId: string | null;
  readonly sourceStatus: SourceStatus;
  readonly legitimacyStatus: LegitimacyStatus;
  readonly workflowState: OpportunityWorkflowState;
  readonly sourceContentDigest: Digest;
}

export type EvidenceClassification =
  | "candidate_fact"
  | "opportunity_fact"
  | "company_fact"
  | "market_fact"
  | "inference"
  | "computation"
  | "contradiction"
  | "gap";
export type EvidenceDecision = "proposed" | "accepted" | "rejected";

export interface EvidenceItem extends EntityBase {
  readonly classification: EvidenceClassification;
  readonly claim: string;
  readonly sourceId: EntityId | null;
  readonly locator: SourceLocator | null;
  readonly candidateFactId: EntityId | null;
  readonly proposedByOperationId: EntityId | null;
  readonly decision: EvidenceDecision;
  readonly decisionReason: string | null;
  readonly acceptedAt: UtcTimestamp | null;
  readonly rejectedAt: UtcTimestamp | null;
}

export type MissingInputBehavior = "block" | "zero" | "neutral";
export interface RubricDimension {
  readonly key: string;
  readonly label: string;
  readonly weightBasisPoints: number;
  readonly missingInput: MissingInputBehavior;
  readonly criticalMinimumBasisPoints: number | null;
}

export interface Rubric extends EntityBase {
  readonly semanticVersion: string;
  readonly name: string;
  readonly dimensions: readonly RubricDimension[];
  readonly thresholds: Readonly<Record<string, number>>;
  readonly displayScale: 5 | 100;
  readonly usedAt: UtcTimestamp | null;
}

export interface DimensionInput {
  readonly dimensionKey: string;
  readonly semanticScoreBasisPoints: number | null;
  readonly evidenceIds: readonly EntityId[];
  readonly disposition: string | null;
}

export interface DimensionScore {
  readonly dimensionKey: string;
  readonly inputBasisPoints: number;
  readonly weightedNumerator: number;
  readonly weightBasisPoints: number;
  readonly missing: boolean;
}

export type EvaluationState =
  | "pending"
  | "running"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "canceled"
  | "stale";

export interface Evaluation extends EntityBase {
  readonly opportunityId: EntityId;
  readonly rubricId: EntityId;
  readonly profileRevision: number;
  readonly sourceIds: readonly EntityId[];
  readonly acceptedEvidenceIds: readonly EntityId[];
  readonly dimensionInputs: readonly DimensionInput[];
  readonly dimensionScores: readonly DimensionScore[];
  readonly aggregateScoreBasisPoints: number;
  readonly displayScore: string;
  readonly arithmeticExplanation: string;
  readonly state: EvaluationState;
  readonly gaps: readonly string[];
  readonly contradictions: readonly string[];
  readonly criticalFindings: readonly string[];
  readonly runId: EntityId | null;
  readonly operationId: EntityId | null;
  readonly staleReason: string | null;
}

export interface ComparisonEvaluationInput {
  readonly evaluationId: EntityId;
  readonly evaluationRevision: number;
  readonly opportunityId: EntityId;
  readonly aggregateScoreBasisPoints: number;
  readonly dimensionValues: Readonly<Record<string, number>>;
}

export interface ComparisonScenarioResult {
  readonly label: string;
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  readonly rankedEvaluationIds: readonly EntityId[];
  readonly scoresBasisPoints: Readonly<Record<string, number>>;
}

export type ComparisonState = "proposed" | "accepted" | "stale";

export interface Comparison extends EntityBase {
  readonly policyVersion: string;
  readonly evaluationInputs: readonly ComparisonEvaluationInput[];
  readonly scenarios: readonly ComparisonScenarioResult[];
  readonly tradeoffs: readonly string[];
  readonly state: ComparisonState;
  readonly operationId: EntityId;
  readonly acceptedAt: UtcTimestamp | null;
  readonly staleReason: string | null;
}

export type ApplicationState =
  | "considering"
  | "preparing"
  | "ready_for_review"
  | "applied"
  | "responded"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "closed";

export interface Application extends EntityBase {
  readonly opportunityId: EntityId;
  readonly state: ApplicationState;
  readonly stateRevision: number;
  readonly effectiveDate: string;
  readonly sourceIds: readonly EntityId[];
  readonly note: string | null;
}

export type ImportMappingDisposition = "imported" | "skipped" | "unsupported";

export interface ImportSourceRecord {
  readonly relativePath: string;
  readonly mediaType: string;
  readonly contentDigest: Digest;
  readonly byteLength: number;
  readonly sourceId: EntityId;
  readonly artifactId: EntityId;
}

export interface ImportMappingRecord {
  readonly sourceType:
    | "profile"
    | "cv"
    | "application"
    | "job_description"
    | "evaluation_report"
    | "story"
    | "preference";
  readonly sourceIdentity: string;
  readonly disposition: ImportMappingDisposition;
  readonly targetKind:
    "source" | "profileFact" | "opportunity" | "application" | null;
  readonly targetId: EntityId | null;
  readonly originalStatus: string | null;
  readonly originalScore: string | null;
  readonly note: string | null;
}

/** Durable receipt for one confirmed, read-only external import. */
export interface ImportManifest extends EntityBase {
  readonly provider: "career-ops";
  readonly upstreamRevision: string;
  readonly observedVersion: string | null;
  /** Hash of the local locator; the raw path is deliberately not canonical. */
  readonly sourceIdentityDigest: Digest;
  readonly sourceFingerprint: Digest;
  readonly sourceLabel: string;
  readonly sources: readonly ImportSourceRecord[];
  readonly mappings: readonly ImportMappingRecord[];
  readonly warnings: readonly string[];
  readonly unsupported: readonly string[];
}

export type ArtifactState = "staged" | "sealed" | "stale" | "revoked";
export interface Artifact extends EntityBase {
  readonly kind: string;
  readonly mediaType: string;
  readonly contentDigest: Digest;
  readonly byteLength: number;
  readonly producer: string;
  readonly producerVersion: string;
  readonly sourceIds: readonly EntityId[];
  readonly factIds: readonly EntityId[];
  readonly evidenceIds: readonly EntityId[];
  readonly rubricIds: readonly EntityId[];
  readonly evaluationIds: readonly EntityId[];
  readonly operationIds: readonly EntityId[];
  readonly state: ArtifactState;
  readonly relativePath: string;
  readonly staleReason: string | null;
}

export type OperationRoute =
  "deterministic" | "ordinary_dsh" | "native_child" | "rlm";
export type OperationState =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "succeeded"
  | "failed"
  | "canceled"
  | "indeterminate";

export interface Operation extends EntityBase {
  readonly kind: string;
  readonly inputIdentity: EntityId | null;
  readonly requestedCapabilities: readonly string[];
  readonly dshSessionId: string | null;
  readonly parentOperationId: EntityId | null;
  readonly state: OperationState;
  readonly route: OperationRoute;
  readonly startedAt: UtcTimestamp | null;
  readonly lastActivityAt: UtcTimestamp;
  readonly terminalAt: UtcTimestamp | null;
  readonly terminalCategory: string | null;
  readonly terminalMessage: string | null;
  readonly resultIds: readonly EntityId[];
  readonly artifactIds: readonly EntityId[];
  readonly cancellationRequestedAt: UtcTimestamp | null;
}

export type ApprovalState =
  "pending" | "approved" | "denied" | "expired" | "consumed";
export interface Approval extends EntityBase {
  readonly commandId: EntityId;
  readonly summary: string;
  readonly effectDescription: string;
  readonly expectedRevisions: Readonly<Record<string, number>>;
  readonly state: ApprovalState;
  readonly expiresAt: UtcTimestamp;
  readonly approvingInteractionId: string | null;
}

export type ActorClass =
  "user" | "browser" | "dsh_agent" | "dsh_child" | "import" | "system";
export interface DomainEvent {
  readonly sequence: number;
  readonly eventKind: string;
  readonly schemaVersion: number;
  readonly workspaceId: WorkspaceId;
  readonly aggregateId: EntityId | WorkspaceId;
  readonly aggregateRevision: number;
  readonly commandId: EntityId;
  readonly operationId: EntityId | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: UtcTimestamp;
  readonly actor: ActorClass;
}

export interface CommandContext {
  readonly commandId: EntityId;
  readonly actor: ActorClass;
  readonly idempotencyKey: string;
  readonly operationId?: EntityId;
  /** Authenticated live DSH session correlation; never sourced from command bodies. */
  readonly dshSessionId?: string;
}
