import { Service, type Context } from "@deepseek-ai/cordis";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import type {
  EvidenceView,
  OperationView,
  OpportunityView,
  SearchProfileView,
} from "@career-workbench/contracts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    careerWorkbench: CareerWorkbenchService;
  }
}

export interface AgentAuthority {
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}

export interface SourceExcerpt {
  readonly id: string;
  readonly kind: string;
  readonly trustClass: string;
  readonly contentDigest: string;
  readonly text: string;
  readonly truncated: boolean;
}

export interface WorkbenchContext {
  readonly contractVersion: "v1";
  readonly workspace: Readonly<Record<string, unknown>>;
  readonly opportunity: OpportunityView | null;
  readonly searchProfile: SearchProfileView | null;
  readonly discoverySummary: Readonly<Record<string, number>>;
  readonly verifiedFacts: readonly Readonly<Record<string, unknown>>[];
  readonly sources: readonly SourceExcerpt[];
  readonly rubrics: readonly Readonly<Record<string, unknown>>[];
  readonly evidence: readonly EvidenceView[];
  readonly operations: readonly OperationView[];
  readonly pendingFollowups: readonly PendingChildFollowup[];
  readonly truncated: boolean;
}

export interface PendingChildFollowup {
  readonly requestId: string;
  readonly operationId: string;
  readonly message: string;
  readonly requestedAt: string;
}

export interface StartedOperation {
  readonly id: string;
  readonly revision: number;
  readonly state: string;
  readonly route: string;
  readonly dshSessionId: string;
  readonly parentOperationId: string | null;
  readonly inputIdentity: string | null;
  readonly cancellationRequestedAt: string | null;
}

export type ChildTerminalState =
  "succeeded" | "failed" | "canceled" | "indeterminate";

export interface ChildOperationAdmission {
  readonly parentOperationId: string;
  readonly inputIdentity: string;
  readonly childSessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}

export interface ChildOperationActivity {
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
  readonly requestId?: string;
}

export interface ChildOperationTerminal {
  readonly expectedRevision: number;
  readonly state: ChildTerminalState;
  readonly category: string;
  readonly message: string;
  readonly resultIds?: readonly string[];
  readonly artifactIds?: readonly string[];
}

export interface EvidenceProposal {
  readonly id: string;
  readonly revision: number;
  readonly decision: string;
  readonly claim: string;
  readonly classification: string;
}

export interface EvaluationResult {
  readonly id: string;
  readonly operationId: string | null;
  readonly state: string;
  readonly displayScore: string;
  readonly arithmeticExplanation: string;
  readonly acceptedEvidenceIds: readonly string[];
  readonly gaps: readonly string[];
}

export interface CaptureExternalSourceCommand {
  readonly kind: "opportunity" | "company" | "market";
  readonly mediaType: string;
  readonly text: string;
  readonly originalLocator?: string;
}

export interface CapturedSource {
  readonly id: string;
  readonly revision: number;
  readonly contentDigest: string;
  readonly byteLength: number;
}

export interface CaptureOpportunityCommand {
  readonly sourceDocumentId: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl?: string;
  readonly location?: string;
  readonly workArrangement?: string;
  readonly advertisedCompensation?: string;
  readonly requisitionId?: string;
}

export interface CapturedOpportunity {
  readonly id: string;
  readonly revision: number;
  readonly sourceDocumentId: string;
  readonly organization: string;
  readonly roleTitle: string;
}

export interface RecordDiscoveryLeadCommand {
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl: string;
  readonly postingText: string;
  readonly location?: string;
  readonly workArrangement?: string;
  readonly advertisedCompensation?: string;
  readonly requisitionId?: string;
  readonly whyFound: readonly string[];
  readonly matchedCriteria: readonly string[];
  readonly gaps: readonly string[];
  readonly risks: readonly string[];
}

export interface RecordedDiscoveryLead {
  readonly id: string;
  readonly revision: number;
  readonly sourceDocumentId: string;
  readonly operationId: string;
  readonly state: string;
  readonly organization: string;
  readonly roleTitle: string;
}

export type InspectableEntityKind =
  "source" | "opportunity" | "evaluation" | "application" | "artifact";

export interface EntityInspection {
  readonly id: string;
  readonly revision: number;
  readonly contextJson: string;
}

export interface OperationInspection extends EntityInspection {
  readonly operationKind: string;
  readonly state: string;
  readonly route: string;
}

export interface DraftArtifactCommand {
  readonly kind:
    | "draft_cv"
    | "draft_cover_letter"
    | "draft_outreach"
    | "draft_interview_prep";
  readonly opportunityId: string;
  readonly factIds: readonly string[];
  readonly styleNote?: string;
}

export interface DraftedArtifact {
  readonly id: string;
  readonly revision: number;
  readonly state: string;
  readonly contentDigest: string;
  readonly byteLength: number;
}

export interface TransitionApplicationCommand {
  readonly expectedRevision: number;
  readonly state: string;
  readonly effectiveDate: string;
  readonly note?: string;
  readonly approvalId: string;
  readonly expectedApprovalRevision: number;
}

export interface TransitionedApplication {
  readonly id: string;
  readonly revision: number;
  readonly state: string;
  readonly stateRevision: number;
  readonly effectiveDate: string;
}

export interface ProposeEvidenceCommand {
  readonly classification: string;
  readonly claim: string;
  readonly sourceId?: string;
  readonly locator?: {
    readonly sourceId: string;
    readonly start: number;
    readonly end: number;
    readonly quote: string;
  };
  readonly candidateFactId?: string;
}

export interface CompleteEvaluationCommand {
  readonly opportunityId: string;
  readonly rubricId: string;
  readonly dimensionInputs: readonly {
    readonly dimensionKey: string;
    readonly semanticScoreBasisPoints: number | null;
    readonly evidenceIds: readonly string[];
    readonly disposition: string | null;
  }[];
  readonly contradictions?: readonly string[];
}

export interface ComparisonScenarioProposal {
  readonly label: string;
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
}

export interface ComparisonProposalCommand {
  readonly evaluationIds: readonly string[];
  readonly policyVersion: string;
  readonly scenarios: readonly ComparisonScenarioProposal[];
  readonly tradeoffs: readonly string[];
}

export interface ComparisonProjection {
  readonly evaluationId: string;
  readonly evaluationRevision: number;
  readonly opportunityId: string;
  readonly aggregateScoreBasisPoints: number;
  readonly dimensionValues: Readonly<Record<string, number>>;
}

export interface ComparisonResult {
  readonly id: string;
  readonly revision: number;
  readonly state: string;
  readonly operationId: string;
}

export class CareerWorkbenchError extends HarnessError {
  public constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options);
    this.name = "CareerWorkbenchError";
  }
}

export abstract class CareerWorkbenchService extends Service {
  protected constructor(ctx: Context) {
    super(ctx, "careerWorkbench");
  }

  public abstract readiness(
    authority: AgentAuthority,
    signal: AbortSignal,
  ): Promise<void>;

  public abstract context(
    authority: AgentAuthority,
    opportunityId: string | undefined,
    signal: AbortSignal,
  ): Promise<WorkbenchContext>;

  public abstract captureExternalSource(
    authority: AgentAuthority,
    command: CaptureExternalSourceCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<CapturedSource>;

  public abstract captureOpportunity(
    authority: AgentAuthority,
    command: CaptureOpportunityCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<CapturedOpportunity>;

  public abstract inspectEntity(
    authority: AgentAuthority,
    kind: InspectableEntityKind,
    entityId: string,
    signal: AbortSignal,
  ): Promise<EntityInspection>;

  public abstract inspectOperation(
    authority: AgentAuthority,
    operationId: string,
    signal: AbortSignal,
  ): Promise<OperationInspection>;

  public abstract draftArtifact(
    authority: AgentAuthority,
    command: DraftArtifactCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<DraftedArtifact>;

  public abstract transitionApplication(
    authority: AgentAuthority,
    applicationId: string,
    command: TransitionApplicationCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<TransitionedApplication>;

  public abstract startEvaluation(
    authority: AgentAuthority,
    opportunityId: string,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract startDiscovery(
    authority: AgentAuthority,
    searchProfileId: string,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract recordDiscoveryLead(
    authority: AgentAuthority,
    operationId: string,
    command: RecordDiscoveryLeadCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<RecordedDiscoveryLead>;

  public abstract admitChildOperation(
    authority: AgentAuthority,
    input: ChildOperationAdmission,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract startRlmComparison(
    authority: AgentAuthority,
    evaluationIds: readonly string[],
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract comparisonProjections(
    authority: AgentAuthority,
    evaluationIds: readonly string[],
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<readonly ComparisonProjection[]>;

  public abstract proposeComparison(
    authority: AgentAuthority,
    operationId: string,
    command: ComparisonProposalCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<ComparisonResult>;

  public abstract recordOperationActivity(
    authority: AgentAuthority,
    operationId: string,
    input: ChildOperationActivity,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract settleOperation(
    authority: AgentAuthority,
    operationId: string,
    input: ChildOperationTerminal,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract recordChildActivity(
    authority: AgentAuthority,
    operationId: string,
    input: ChildOperationActivity,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract settleChildOperation(
    authority: AgentAuthority,
    operationId: string,
    input: ChildOperationTerminal,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract requestChildCancellation(
    authority: AgentAuthority,
    operationId: string,
    expectedRevision: number,
    reason: string,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<StartedOperation>;

  public abstract proposeEvidence(
    authority: AgentAuthority,
    operationId: string,
    command: ProposeEvidenceCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<EvidenceProposal>;

  public abstract decideEvidence(
    authority: AgentAuthority,
    operationId: string,
    evidenceId: string,
    expectedRevision: number,
    decision: "accepted" | "rejected",
    reason: string,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<EvidenceProposal>;

  public abstract completeEvaluation(
    authority: AgentAuthority,
    operationId: string,
    command: CompleteEvaluationCommand,
    commandIdentity: string,
    signal: AbortSignal,
  ): Promise<EvaluationResult>;
}
