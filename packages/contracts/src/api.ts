import { Type, type Static } from "@sinclair/typebox";
import { ErrorCodeSchema, RevisionSchema } from "./schemas.js";

const BoundedText = (maximum = 2000) =>
  Type.String({ minLength: 1, maxLength: maximum });
const OptionalText = (maximum = 2000) =>
  Type.Optional(Type.String({ minLength: 1, maxLength: maximum }));
const EmbeddedEntityIdSchema = Type.String({
  minLength: 10,
  maxLength: 80,
  pattern: "^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$",
});

export const SourceLocatorSchema = Type.Object(
  {
    sourceId: EmbeddedEntityIdSchema,
    start: Type.Integer({ minimum: 0, maximum: 1_048_576 }),
    end: Type.Integer({ minimum: 1, maximum: 1_048_576 }),
    quote: BoundedText(10_000),
  },
  { additionalProperties: false },
);

export const CreateWorkspaceBodySchema = Type.Object(
  {
    displayName: BoundedText(120),
    candidateName: Type.Optional(BoundedText(300)),
    targetRole: Type.Optional(BoundedText(500)),
    targetPriorities: Type.Optional(BoundedText(2000)),
    locationPreference: Type.Optional(BoundedText(300)),
    deferTargetPreferences: Type.Optional(Type.Boolean()),
    rubricPreset: Type.Optional(Type.Literal("balanced_fit")),
    locale: Type.String({
      pattern: "^[a-z]{2,3}(?:-[A-Z]{2})?$",
      maxLength: 10,
    }),
    timezone: BoundedText(100),
  },
  { $id: "CreateWorkspaceBody", additionalProperties: false },
);

export const CaptureSourceBodySchema = Type.Object(
  {
    kind: Type.Union(
      [
        "candidate",
        "opportunity",
        "company",
        "market",
        "message",
        "import",
      ].map((value) => Type.Literal(value)),
    ),
    trustClass: Type.Union(
      ["candidate_primary", "candidate_derived", "external"].map((value) =>
        Type.Literal(value),
      ),
    ),
    mediaType: Type.String({ pattern: "^text/[a-z0-9.+-]+$", maxLength: 100 }),
    text: BoundedText(1_048_576),
    originalLocator: OptionalText(2048),
  },
  { $id: "CaptureSourceBody", additionalProperties: false },
);

export const UploadCandidateSourceBodySchema = Type.Object(
  {
    mediaType: Type.Union([
      Type.Literal("application/pdf"),
      Type.Literal("text/plain"),
    ]),
    bytesBase64: Type.String({
      minLength: 4,
      maxLength: 6_990_508,
      pattern: "^[A-Za-z0-9+/]+={0,2}$",
    }),
    extractedText: BoundedText(49_152),
  },
  { $id: "UploadCandidateSourceBody", additionalProperties: false },
);

export const StartProfileOrganizationBodySchema = Type.Object(
  {
    sourceId: EmbeddedEntityIdSchema,
  },
  { $id: "StartProfileOrganizationBody", additionalProperties: false },
);

export const ProfileOrganizationRunResponseSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    sourceId: EmbeddedEntityIdSchema,
    sessionId: Type.String({ minLength: 1, maxLength: 200 }),
    operationId: EmbeddedEntityIdSchema,
    state: Type.Literal("succeeded"),
    proposedFactIds: Type.Array(EmbeddedEntityIdSchema, { maxItems: 24 }),
    provider: BoundedText(100),
    model: BoundedText(200),
    reasoningEffort: BoundedText(100),
  },
  { $id: "ProfileOrganizationRunResponse", additionalProperties: false },
);

export const StartJobDiscoveryBodySchema = Type.Object(
  {
    searchProfileId: EmbeddedEntityIdSchema,
  },
  { $id: "StartJobDiscoveryBody", additionalProperties: false },
);

export const JobDiscoveryRunResponseSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    searchProfileId: EmbeddedEntityIdSchema,
    sessionId: Type.String({ minLength: 1, maxLength: 200 }),
    operationId: EmbeddedEntityIdSchema,
    state: Type.Literal("succeeded"),
    leadIds: Type.Array(EmbeddedEntityIdSchema, { maxItems: 64 }),
    provider: BoundedText(100),
    model: BoundedText(200),
    reasoningEffort: BoundedText(100),
  },
  { $id: "JobDiscoveryRunResponse", additionalProperties: false },
);

export const ProposeProfileFactBodySchema = Type.Object(
  {
    factType: BoundedText(80),
    subject: BoundedText(300),
    predicate: BoundedText(200),
    value: Type.Union([
      Type.String({ maxLength: 2000 }),
      Type.Number(),
      Type.Boolean(),
      Type.Null(),
    ]),
    sourceLocators: Type.Array(SourceLocatorSchema, {
      minItems: 1,
      maxItems: 16,
    }),
    proposedBy: Type.Union(
      ["user", "import", "agent", "system"].map((value) => Type.Literal(value)),
    ),
  },
  { $id: "ProposeProfileFactBody", additionalProperties: false },
);

export const AddCareerHistoryEntryBodySchema = Type.Object(
  {
    personName: BoundedText(300),
    roleTitle: BoundedText(300),
    organization: BoundedText(300),
    dateRange: BoundedText(200),
    achievements: Type.Array(BoundedText(2_000), {
      maxItems: 8,
    }),
  },
  { $id: "AddCareerHistoryEntryBody", additionalProperties: false },
);

export const ConfirmProfileFactBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    outcome: Type.Union([
      Type.Object(
        { kind: Type.Literal("confirm") },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          kind: Type.Literal("correct"),
          value: Type.Union([
            Type.String({ maxLength: 2000 }),
            Type.Number(),
            Type.Boolean(),
            Type.Null(),
          ]),
          locator: SourceLocatorSchema,
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { kind: Type.Literal("narrative_only") },
        { additionalProperties: false },
      ),
      Type.Object(
        { kind: Type.Literal("cannot_confirm") },
        { additionalProperties: false },
      ),
    ]),
  },
  { $id: "ConfirmProfileFactBody", additionalProperties: false },
);

export const CaptureOpportunityBodySchema = Type.Object(
  {
    sourceDocumentId: EmbeddedEntityIdSchema,
    organization: BoundedText(300),
    roleTitle: BoundedText(300),
    originalUrl: OptionalText(2048),
    location: OptionalText(300),
    workArrangement: OptionalText(100),
    advertisedCompensation: OptionalText(300),
    requisitionId: OptionalText(200),
  },
  { $id: "CaptureOpportunityBody", additionalProperties: false },
);

const SearchSenioritySchema = Type.Union(
  [
    "entry",
    "mid",
    "senior",
    "staff",
    "principal",
    "lead",
    "manager",
    "director",
    "flexible",
  ].map((value) => Type.Literal(value)),
);

const WorkArrangementSchema = Type.Union(
  ["remote", "hybrid", "onsite"].map((value) => Type.Literal(value)),
);

export const UpsertSearchProfileBodySchema = Type.Object(
  {
    expectedRevision: Type.Optional(RevisionSchema),
    targetRoles: Type.Array(BoundedText(160), {
      minItems: 1,
      maxItems: 12,
      uniqueItems: true,
    }),
    seniority: Type.Array(SearchSenioritySchema, {
      minItems: 1,
      maxItems: 9,
      uniqueItems: true,
    }),
    locations: Type.Array(BoundedText(160), {
      maxItems: 12,
      uniqueItems: true,
    }),
    workArrangements: Type.Array(WorkArrangementSchema, {
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
    }),
    minimumCompensation: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 10_000_000 }),
    ),
    compensationCurrency: Type.Optional(Type.String({ pattern: "^[A-Z]{3}$" })),
    aiFocus: OptionalText(1_000),
    priorities: Type.Array(BoundedText(300), {
      maxItems: 12,
      uniqueItems: true,
    }),
    exclusions: Type.Array(BoundedText(300), {
      maxItems: 12,
      uniqueItems: true,
    }),
    active: Type.Boolean(),
  },
  { $id: "UpsertSearchProfileBody", additionalProperties: false },
);

export const RecordDiscoveryLeadBodySchema = Type.Object(
  {
    organization: BoundedText(300),
    roleTitle: BoundedText(300),
    originalUrl: Type.String({
      minLength: 1,
      maxLength: 2048,
      pattern: "^https?://",
    }),
    postingText: BoundedText(1_048_576),
    location: OptionalText(300),
    workArrangement: OptionalText(300),
    advertisedCompensation: OptionalText(300),
    requisitionId: OptionalText(300),
    whyFound: Type.Array(BoundedText(500), { maxItems: 8 }),
    matchedCriteria: Type.Array(BoundedText(300), { maxItems: 12 }),
    gaps: Type.Array(BoundedText(500), { maxItems: 12 }),
    risks: Type.Array(BoundedText(500), { maxItems: 12 }),
  },
  { $id: "RecordDiscoveryLeadBody", additionalProperties: false },
);

export const TriageDiscoveryLeadBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    decision: Type.Union([
      Type.Literal("new"),
      Type.Literal("shortlisted"),
      Type.Literal("dismissed"),
    ]),
    note: OptionalText(1_000),
  },
  { $id: "TriageDiscoveryLeadBody", additionalProperties: false },
);

export const ProposeEvidenceBodySchema = Type.Object(
  {
    classification: Type.Union(
      [
        "candidate_fact",
        "opportunity_fact",
        "company_fact",
        "market_fact",
        "inference",
        "computation",
        "contradiction",
        "gap",
      ].map((value) => Type.Literal(value)),
    ),
    claim: BoundedText(2000),
    sourceId: Type.Optional(EmbeddedEntityIdSchema),
    locator: Type.Optional(SourceLocatorSchema),
    candidateFactId: Type.Optional(EmbeddedEntityIdSchema),
    proposedByOperationId: Type.Optional(EmbeddedEntityIdSchema),
  },
  { $id: "ProposeEvidenceBody", additionalProperties: false },
);

export const DecideEvidenceBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    decision: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
    reason: BoundedText(500),
  },
  { $id: "DecideEvidenceBody", additionalProperties: false },
);

export const CreateRubricBodySchema = Type.Object(
  {
    semanticVersion: Type.String({
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      maxLength: 30,
    }),
    name: BoundedText(200),
    dimensions: Type.Array(
      Type.Object(
        {
          key: Type.String({ pattern: "^[a-z][a-z0-9_]*$", maxLength: 80 }),
          label: BoundedText(120),
          weightBasisPoints: Type.Integer({ minimum: 1, maximum: 10_000 }),
          missingInput: Type.Union(
            ["block", "zero", "neutral"].map((value) => Type.Literal(value)),
          ),
          criticalMinimumBasisPoints: Type.Union([
            Type.Integer({ minimum: 0, maximum: 10_000 }),
            Type.Null(),
          ]),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 32 },
    ),
    thresholds: Type.Record(
      Type.String({ maxLength: 80 }),
      Type.Integer({ minimum: 0, maximum: 10_000 }),
      {
        maxProperties: 20,
      },
    ),
    displayScale: Type.Union([Type.Literal(5), Type.Literal(100)]),
  },
  { $id: "CreateRubricBody", additionalProperties: false },
);

export const EvaluateBodySchema = Type.Object(
  {
    opportunityId: EmbeddedEntityIdSchema,
    rubricId: EmbeddedEntityIdSchema,
    operationId: Type.Optional(EmbeddedEntityIdSchema),
    dimensionInputs: Type.Array(
      Type.Object(
        {
          dimensionKey: BoundedText(80),
          semanticScoreBasisPoints: Type.Union([
            Type.Integer({ minimum: 0, maximum: 10_000 }),
            Type.Null(),
          ]),
          evidenceIds: Type.Array(EmbeddedEntityIdSchema, {
            maxItems: 64,
            uniqueItems: true,
          }),
          disposition: Type.Union([
            Type.String({ maxLength: 500 }),
            Type.Null(),
          ]),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 32 },
    ),
    contradictions: Type.Optional(
      Type.Array(BoundedText(500), { maxItems: 20 }),
    ),
  },
  { $id: "EvaluateBody", additionalProperties: false },
);

export const StartOperationBodySchema = Type.Object(
  {
    kind: BoundedText(80),
    inputIdentity: EmbeddedEntityIdSchema,
    requestedCapabilities: Type.Array(BoundedText(80), {
      maxItems: 16,
      uniqueItems: true,
    }),
    route: Type.Union(
      ["ordinary_dsh", "native_child", "rlm"].map((value) =>
        Type.Literal(value),
      ),
    ),
    dshSessionId: BoundedText(200),
    parentOperationId: Type.Optional(EmbeddedEntityIdSchema),
    provider: BoundedText(100),
    model: BoundedText(200),
    reasoningEffort: OptionalText(50),
    admissionOnly: Type.Optional(Type.Boolean()),
  },
  { $id: "StartOperationBody", additionalProperties: false },
);

export const OperationActivityBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    phase: Type.Union(
      [
        "started",
        "report",
        "message",
        "followup",
        "deleted",
        "cell",
        "bridge",
        "snapshot",
        "restore",
        "interrupt",
        "restart",
      ].map((value) => Type.Literal(value)),
    ),
    message: OptionalText(16_384),
    messageId: OptionalText(200),
    requestId: Type.Optional(EmbeddedEntityIdSchema),
  },
  { $id: "OperationActivityBody", additionalProperties: false },
);

export const TerminalOperationBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    state: Type.Union(
      ["succeeded", "failed", "canceled", "indeterminate"].map((value) =>
        Type.Literal(value),
      ),
    ),
    category: BoundedText(100),
    message: BoundedText(16_384),
    resultIds: Type.Array(EmbeddedEntityIdSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    artifactIds: Type.Array(EmbeddedEntityIdSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { $id: "TerminalOperationBody", additionalProperties: false },
);

export const CancelOperationBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    reason: BoundedText(500),
  },
  { $id: "CancelOperationBody", additionalProperties: false },
);

export const RequestChildFollowupBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    message: BoundedText(8_000),
  },
  { $id: "RequestChildFollowupBody", additionalProperties: false },
);

export const CorrectFactBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    value: Type.Union([
      Type.String({ maxLength: 2000 }),
      Type.Number(),
      Type.Boolean(),
      Type.Null(),
    ]),
    sourceText: BoundedText(10_000),
  },
  { $id: "CorrectFactBody", additionalProperties: false },
);

export const ComparisonProjectionBodySchema = Type.Object(
  {
    evaluationIds: Type.Array(EmbeddedEntityIdSchema, {
      minItems: 3,
      maxItems: 3,
      uniqueItems: true,
    }),
  },
  { $id: "ComparisonProjectionBody", additionalProperties: false },
);

const ComparisonScenarioSchema = Type.Object(
  {
    label: BoundedText(120),
    weightsBasisPoints: Type.Record(
      Type.String({ pattern: "^[a-z][a-z0-9_]*$", maxLength: 80 }),
      Type.Integer({ minimum: 0, maximum: 10_000 }),
      { minProperties: 1, maxProperties: 32 },
    ),
  },
  { additionalProperties: false },
);

export const ProposeComparisonBodySchema = Type.Object(
  {
    evaluationIds: Type.Array(EmbeddedEntityIdSchema, {
      minItems: 3,
      maxItems: 3,
      uniqueItems: true,
    }),
    policyVersion: Type.String({
      pattern: "^\\d+\\.\\d+\\.\\d+$",
      maxLength: 30,
    }),
    scenarios: Type.Array(ComparisonScenarioSchema, {
      minItems: 1,
      maxItems: 8,
    }),
    tradeoffs: Type.Array(BoundedText(1_000), { maxItems: 16 }),
  },
  { $id: "ProposeComparisonBody", additionalProperties: false },
);

export const AcceptComparisonBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    approvalId: Type.Optional(EmbeddedEntityIdSchema),
    expectedApprovalRevision: Type.Optional(RevisionSchema),
  },
  { $id: "AcceptComparisonBody", additionalProperties: false },
);

export const RequestApprovalBodySchema = Type.Object(
  {
    effectKind: Type.Union([
      Type.Literal("comparison.accept"),
      Type.Literal("artifact.review"),
      Type.Literal("application.transition"),
    ]),
    targetId: EmbeddedEntityIdSchema,
    expectedRevision: RevisionSchema,
    expiresInSeconds: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 3_600 }),
    ),
    applicationTransition: Type.Optional(
      Type.Object(
        {
          state: Type.Union(
            [
              "considering",
              "preparing",
              "ready_for_review",
              "applied",
              "responded",
              "interview",
              "offer",
              "hired",
              "rejected",
              "withdrawn",
              "closed",
            ].map((value) => Type.Literal(value)),
          ),
          effectiveDate: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
          note: OptionalText(2_000),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: "RequestApprovalBody", additionalProperties: false },
);

export const DecideApprovalBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    decision: Type.Union([Type.Literal("approved"), Type.Literal("denied")]),
  },
  { $id: "DecideApprovalBody", additionalProperties: false },
);

export const ExportWorkspaceBodySchema = Type.Object(
  {
    selectedArtifactIds: Type.Array(EmbeddedEntityIdSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { $id: "ExportWorkspaceBody", additionalProperties: false },
);

export const PreviewCareerOpsImportBodySchema = Type.Object(
  {
    sourceDirectory: Type.String({ minLength: 3, maxLength: 4096 }),
  },
  { $id: "PreviewCareerOpsImportBody", additionalProperties: false },
);

export const ApplyCareerOpsImportBodySchema = Type.Object(
  {
    sourceFingerprint: Type.String({ pattern: "^[0-9a-f]{64}$" }),
    confirm: Type.Literal(true),
    selectedMappingIds: Type.Optional(
      Type.Array(BoundedText(500), {
        maxItems: 512,
        uniqueItems: true,
      }),
    ),
  },
  { $id: "ApplyCareerOpsImportBody", additionalProperties: false },
);

export const CreateApplicationBodySchema = Type.Object(
  {
    opportunityId: EmbeddedEntityIdSchema,
    effectiveDate: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
    note: OptionalText(2_000),
  },
  { $id: "CreateApplicationBody", additionalProperties: false },
);

export const TransitionApplicationBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    state: Type.Union(
      [
        "considering",
        "preparing",
        "ready_for_review",
        "applied",
        "responded",
        "interview",
        "offer",
        "hired",
        "rejected",
        "withdrawn",
        "closed",
      ].map((value) => Type.Literal(value)),
    ),
    effectiveDate: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
    note: OptionalText(2_000),
    approvalId: Type.Optional(EmbeddedEntityIdSchema),
    expectedApprovalRevision: Type.Optional(RevisionSchema),
  },
  { $id: "TransitionApplicationBody", additionalProperties: false },
);

export const UpdateOpportunitySignalsBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    sourceStatus: Type.Union(
      ["unknown", "active", "expired", "unavailable"].map((value) =>
        Type.Literal(value),
      ),
    ),
    legitimacyStatus: Type.Union(
      ["unknown", "high_confidence", "needs_review", "concern"].map((value) =>
        Type.Literal(value),
      ),
    ),
  },
  { $id: "UpdateOpportunitySignalsBody", additionalProperties: false },
);

export const CreateCandidateArtifactBodySchema = Type.Object(
  {
    kind: Type.Union(
      [
        "draft_cv",
        "draft_cover_letter",
        "draft_outreach",
        "draft_interview_prep",
      ].map((value) => Type.Literal(value)),
    ),
    opportunityId: EmbeddedEntityIdSchema,
    factIds: Type.Array(EmbeddedEntityIdSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    styleNote: OptionalText(1_000),
  },
  { $id: "CreateCandidateArtifactBody", additionalProperties: false },
);

export const ReviewArtifactBodySchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
    approvalId: Type.Optional(EmbeddedEntityIdSchema),
    expectedApprovalRevision: Type.Optional(RevisionSchema),
  },
  { $id: "ReviewArtifactBody", additionalProperties: false },
);

export const IdParameterSchema = Type.Object(
  { id: EmbeddedEntityIdSchema },
  { additionalProperties: false },
);

export type CreateWorkspaceBody = Static<typeof CreateWorkspaceBodySchema>;
export type CaptureSourceBody = Static<typeof CaptureSourceBodySchema>;
export type UploadCandidateSourceBody = Static<
  typeof UploadCandidateSourceBodySchema
>;
export type StartProfileOrganizationBody = Static<
  typeof StartProfileOrganizationBodySchema
>;
export type ProfileOrganizationRunResponse = Static<
  typeof ProfileOrganizationRunResponseSchema
>;
export type StartJobDiscoveryBody = Static<typeof StartJobDiscoveryBodySchema>;
export type JobDiscoveryRunResponse = Static<
  typeof JobDiscoveryRunResponseSchema
>;
export type ProposeProfileFactBody = Static<
  typeof ProposeProfileFactBodySchema
>;
export type AddCareerHistoryEntryBody = Static<
  typeof AddCareerHistoryEntryBodySchema
>;
export type ConfirmProfileFactBody = Static<
  typeof ConfirmProfileFactBodySchema
>;
export type CaptureOpportunityBody = Static<
  typeof CaptureOpportunityBodySchema
>;
export type UpsertSearchProfileBody = Static<
  typeof UpsertSearchProfileBodySchema
>;
export type RecordDiscoveryLeadBody = Static<
  typeof RecordDiscoveryLeadBodySchema
>;
export type TriageDiscoveryLeadBody = Static<
  typeof TriageDiscoveryLeadBodySchema
>;
export type ProposeEvidenceBody = Static<typeof ProposeEvidenceBodySchema>;
export type DecideEvidenceBody = Static<typeof DecideEvidenceBodySchema>;
export type CreateRubricBody = Static<typeof CreateRubricBodySchema>;
export type EvaluateBody = Static<typeof EvaluateBodySchema>;
export type StartOperationBody = Static<typeof StartOperationBodySchema>;
export type OperationActivityBody = Static<typeof OperationActivityBodySchema>;
export type TerminalOperationBody = Static<typeof TerminalOperationBodySchema>;
export type CancelOperationBody = Static<typeof CancelOperationBodySchema>;
export type RequestChildFollowupBody = Static<
  typeof RequestChildFollowupBodySchema
>;
export type CorrectFactBody = Static<typeof CorrectFactBodySchema>;
export type ComparisonProjectionBody = Static<
  typeof ComparisonProjectionBodySchema
>;
export type ProposeComparisonBody = Static<typeof ProposeComparisonBodySchema>;
export type AcceptComparisonBody = Static<typeof AcceptComparisonBodySchema>;
export type RequestApprovalBody = Static<typeof RequestApprovalBodySchema>;
export type DecideApprovalBody = Static<typeof DecideApprovalBodySchema>;
export type ExportWorkspaceBody = Static<typeof ExportWorkspaceBodySchema>;
export type PreviewCareerOpsImportBody = Static<
  typeof PreviewCareerOpsImportBodySchema
>;
export type ApplyCareerOpsImportBody = Static<
  typeof ApplyCareerOpsImportBodySchema
>;
export type CreateApplicationBody = Static<typeof CreateApplicationBodySchema>;
export type TransitionApplicationBody = Static<
  typeof TransitionApplicationBodySchema
>;
export type UpdateOpportunitySignalsBody = Static<
  typeof UpdateOpportunitySignalsBodySchema
>;
export type CreateCandidateArtifactBody = Static<
  typeof CreateCandidateArtifactBodySchema
>;
export type ReviewArtifactBody = Static<typeof ReviewArtifactBodySchema>;

export interface ApprovalView {
  readonly id: string;
  readonly revision: number;
  readonly commandId: string;
  readonly effectKind:
    "comparison.accept" | "artifact.review" | "application.transition";
  readonly targetId: string;
  readonly effectDigest: string;
  readonly summary: string;
  readonly effectDescription: string;
  readonly expectedRevisions: Readonly<Record<string, number>>;
  readonly state: "pending" | "approved" | "denied" | "expired" | "consumed";
  readonly expiresAt: string;
  readonly approvingInteractionId: string | null;
}

export interface ApprovalListResponse {
  readonly contractVersion: "v1";
  readonly approvals: readonly ApprovalView[];
}

export interface WorkspaceView {
  readonly id: string;
  readonly displayName: string;
  readonly revision: number;
  readonly defaultRubricId: string | null;
  readonly locale: string;
  readonly timezone: string;
}

export interface SourceView {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly kind: string;
  readonly trustClass: string;
  readonly contentDigest: string;
  readonly byteLength: number;
  readonly inlineText: string | null;
  readonly originalLocator: string | null;
}

export interface ProfileFactView {
  readonly id: string;
  readonly revision: number;
  readonly factType: string;
  readonly subject: string;
  readonly predicate: string;
  readonly value: string | number | boolean | null;
  readonly status: string;
  readonly proposedBy: "user" | "import" | "agent" | "system";
  readonly sourceLocators: readonly Static<typeof SourceLocatorSchema>[];
  readonly supersedesFactId: string | null;
}

export interface OpportunityView {
  readonly id: string;
  readonly revision: number;
  readonly sourceDocumentId: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl: string | null;
  readonly location: string | null;
  readonly workArrangement: string | null;
  readonly advertisedCompensation: string | null;
  readonly requisitionId: string | null;
  readonly sourceStatus: string;
  readonly legitimacyStatus: string;
  readonly workflowState: string;
}

export interface SearchProfileView {
  readonly id: string;
  readonly revision: number;
  readonly targetRoles: readonly string[];
  readonly seniority: readonly string[];
  readonly locations: readonly string[];
  readonly workArrangements: readonly string[];
  readonly minimumCompensation: number | null;
  readonly compensationCurrency: string | null;
  readonly aiFocus: string | null;
  readonly priorities: readonly string[];
  readonly exclusions: readonly string[];
  readonly active: boolean;
}

export interface DiscoveryLeadView {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly sourceDocumentId: string;
  readonly sourceContentDigest: string;
  readonly searchProfileId: string;
  readonly searchProfileRevision: number;
  readonly searchCriteriaDigest: string;
  readonly operationId: string;
  readonly organization: string;
  readonly roleTitle: string;
  readonly originalUrl: string;
  readonly normalizedUrl: string;
  readonly location: string | null;
  readonly workArrangement: string | null;
  readonly advertisedCompensation: string | null;
  readonly requisitionId: string | null;
  readonly whyFound: readonly string[];
  readonly matchedCriteria: readonly string[];
  readonly gaps: readonly string[];
  readonly risks: readonly string[];
  readonly state: "new" | "shortlisted" | "dismissed";
  readonly triageNote: string | null;
  readonly resultOpportunityId: string | null;
}

export interface EvidenceView {
  readonly id: string;
  readonly revision: number;
  readonly classification: string;
  readonly claim: string;
  readonly sourceId: string | null;
  readonly locator: Static<typeof SourceLocatorSchema> | null;
  readonly candidateFactId: string | null;
  readonly proposedByOperationId: string | null;
  readonly decision: string;
  readonly decisionReason: string | null;
}

export interface DimensionScoreView {
  readonly dimensionKey: string;
  readonly inputBasisPoints: number;
  readonly weightedNumerator: number;
  readonly weightBasisPoints: number;
  readonly missing: boolean;
}

export interface EvaluationView {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly opportunityId: string;
  readonly rubricId: string;
  readonly acceptedEvidenceIds: readonly string[];
  readonly dimensionScores: readonly DimensionScoreView[];
  readonly aggregateScoreBasisPoints: number;
  readonly displayScore: string;
  readonly arithmeticExplanation: string;
  readonly state: string;
  readonly gaps: readonly string[];
  readonly contradictions: readonly string[];
  readonly criticalFindings: readonly string[];
  readonly operationId: string | null;
  readonly staleReason: string | null;
}

export interface ArtifactView {
  readonly id: string;
  readonly revision: number;
  readonly kind: string;
  readonly mediaType: string;
  readonly contentDigest: string;
  readonly byteLength: number;
  readonly evaluationIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly factIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly state: string;
  readonly staleReason: string | null;
}

export interface OperationView {
  readonly id: string;
  readonly revision: number;
  readonly kind: string;
  readonly state: string;
  readonly route: string;
  readonly inputIdentity: string | null;
  readonly inputRevision: number | null;
  readonly inputDigest: string | null;
  readonly resourceLimits: Readonly<Record<string, number>>;
  readonly requestedCapabilities: readonly string[];
  readonly dshSessionId: string | null;
  readonly parentOperationId: string | null;
  readonly startedAt: string | null;
  readonly lastActivityAt: string;
  readonly terminalAt: string | null;
  readonly terminalCategory: string | null;
  readonly terminalMessage: string | null;
  readonly resultIds: readonly string[];
  readonly artifactIds: readonly string[];
  readonly cancellationRequestedAt: string | null;
}

export interface ComparisonView {
  readonly id: string;
  readonly revision: number;
  readonly policyVersion: string;
  readonly evaluationInputs: readonly Readonly<Record<string, unknown>>[];
  readonly scenarios: readonly Readonly<Record<string, unknown>>[];
  readonly tradeoffs: readonly string[];
  readonly state: string;
  readonly operationId: string;
  readonly acceptedAt: string | null;
  readonly staleReason: string | null;
}

export interface ApplicationView {
  readonly id: string;
  readonly revision: number;
  readonly opportunityId: string;
  readonly state: string;
  readonly stateRevision: number;
  readonly effectiveDate: string;
  readonly sourceIds: readonly string[];
  readonly note: string | null;
}

export interface ImportManifestView {
  readonly id: string;
  readonly revision: number;
  readonly provider: string;
  readonly upstreamRevision: string;
  readonly observedVersion: string | null;
  readonly sourceFingerprint: string;
  readonly sourceLabel: string;
  readonly sources: readonly Readonly<Record<string, unknown>>[];
  readonly mappings: readonly Readonly<Record<string, unknown>>[];
  readonly warnings: readonly string[];
  readonly unsupported: readonly string[];
}

export interface DomainEventView {
  readonly sequence: number;
  readonly eventKind: string;
  readonly aggregateId: string;
  readonly aggregateRevision: number;
  readonly timestamp: string;
  readonly actor: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SnapshotResponse {
  readonly contractVersion: "v1";
  readonly workspace: WorkspaceView | null;
  readonly sources: readonly SourceView[];
  readonly profileFacts: readonly ProfileFactView[];
  readonly searchProfiles: readonly SearchProfileView[];
  readonly discoveryLeads: readonly DiscoveryLeadView[];
  readonly opportunities: readonly OpportunityView[];
  readonly evidence: readonly EvidenceView[];
  readonly rubrics: readonly Readonly<Record<string, unknown>>[];
  readonly evaluations: readonly EvaluationView[];
  readonly comparisons: readonly ComparisonView[];
  readonly applications: readonly ApplicationView[];
  readonly importManifests: readonly ImportManifestView[];
  readonly artifacts: readonly ArtifactView[];
  readonly operations: readonly OperationView[];
  readonly events: readonly DomainEventView[];
}

const CompatibilityStateSchema = Type.Union([
  Type.Literal("ready"),
  Type.Literal("mismatch"),
]);

const VersionCompatibilitySchema = Type.Object(
  {
    expected: BoundedText(100),
    resolved: BoundedText(100),
    state: CompatibilityStateSchema,
  },
  { additionalProperties: false },
);

const UpstreamCompatibilitySchema = Type.Object(
  {
    expected: Type.Object(
      {
        revision: Type.String({ pattern: "^[0-9a-f]{40}$" }),
        tag: Type.Union([BoundedText(100), Type.Null()]),
        version: BoundedText(100),
      },
      { additionalProperties: false },
    ),
    resolved: Type.Object(
      {
        revision: Type.String({ pattern: "^[0-9a-f]{40}$" }),
        tag: Type.Union([BoundedText(100), Type.Null()]),
        version: BoundedText(100),
      },
      { additionalProperties: false },
    ),
    state: CompatibilityStateSchema,
  },
  { additionalProperties: false },
);

const PatchCompatibilitySchema = Type.Object(
  {
    identity: Type.String({
      minLength: 1,
      maxLength: 100,
      pattern: "^[0-9]{4}-[a-z0-9-]+\\.patch$",
    }),
    sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
    resolvedSha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
    application: Type.Union([
      Type.Literal("runtime_package"),
      Type.Literal("bundle_host"),
    ]),
    state: CompatibilityStateSchema,
  },
  { additionalProperties: false },
);

export const DiagnosticsResponseSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    version: BoundedText(100),
    workspaceConfigured: Type.Boolean(),
    schemaVersion: Type.Integer({ minimum: 1 }),
    storage: BoundedText(100),
    journalMode: BoundedText(100),
    capabilities: Type.Record(
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Boolean(),
      { maxProperties: 32 },
    ),
    security: Type.Record(
      Type.String({ minLength: 1, maxLength: 80 }),
      Type.Boolean(),
      { maxProperties: 32 },
    ),
    runtimeVersions: Type.Object(
      {
        node: VersionCompatibilitySchema,
        pnpm: VersionCompatibilitySchema,
        typescript: VersionCompatibilitySchema,
        careerWorkbench: VersionCompatibilitySchema,
      },
      { additionalProperties: false },
    ),
    compatibility: Type.Object(
      {
        state: CompatibilityStateSchema,
        mismatches: Type.Array(
          Type.String({
            minLength: 1,
            maxLength: 160,
            pattern: "^[A-Za-z0-9_.-]+$",
          }),
          { maxItems: 32, uniqueItems: true },
        ),
        deepSeekHarness: UpstreamCompatibilitySchema,
        nativeRlm: UpstreamCompatibilitySchema,
        careerOps: UpstreamCompatibilitySchema,
        cordis: VersionCompatibilitySchema,
        patches: Type.Array(PatchCompatibilitySchema, {
          minItems: 4,
          maxItems: 4,
        }),
      },
      { additionalProperties: false },
    ),
    recentErrorCategories: Type.Array(ErrorCodeSchema, {
      maxItems: 16,
      uniqueItems: true,
    }),
  },
  { $id: "DiagnosticsResponse", additionalProperties: false },
);

export type DiagnosticsResponse = Static<typeof DiagnosticsResponseSchema>;

export const API_SCHEMAS = [
  CreateWorkspaceBodySchema,
  CaptureSourceBodySchema,
  UploadCandidateSourceBodySchema,
  StartProfileOrganizationBodySchema,
  ProfileOrganizationRunResponseSchema,
  StartJobDiscoveryBodySchema,
  JobDiscoveryRunResponseSchema,
  ProposeProfileFactBodySchema,
  AddCareerHistoryEntryBodySchema,
  ConfirmProfileFactBodySchema,
  CaptureOpportunityBodySchema,
  UpsertSearchProfileBodySchema,
  RecordDiscoveryLeadBodySchema,
  TriageDiscoveryLeadBodySchema,
  ProposeEvidenceBodySchema,
  DecideEvidenceBodySchema,
  CreateRubricBodySchema,
  EvaluateBodySchema,
  ComparisonProjectionBodySchema,
  ProposeComparisonBodySchema,
  AcceptComparisonBodySchema,
  RequestApprovalBodySchema,
  DecideApprovalBodySchema,
  ExportWorkspaceBodySchema,
  PreviewCareerOpsImportBodySchema,
  ApplyCareerOpsImportBodySchema,
  CreateApplicationBodySchema,
  TransitionApplicationBodySchema,
  UpdateOpportunitySignalsBodySchema,
  CreateCandidateArtifactBodySchema,
  ReviewArtifactBodySchema,
  StartOperationBodySchema,
  OperationActivityBodySchema,
  TerminalOperationBodySchema,
  CancelOperationBodySchema,
  RequestChildFollowupBodySchema,
  CorrectFactBodySchema,
  DiagnosticsResponseSchema,
] as const;
