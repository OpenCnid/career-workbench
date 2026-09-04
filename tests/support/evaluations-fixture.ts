import type { SnapshotResponse } from "../../packages/contracts/src/api.js";

export const evaluationFixtureSeed = "evaluations-self-play-v1";
export const selectedOpportunityId = "opportunity_0000000001";

const candidateSourceId = "source_0000000001";
const opportunitySourceId = "source_0000000002";
const companySourceId = "source_0000000003";
const longToken = `SYNTHETIC${"X".repeat(180)}`;
const longClaim =
  "Synthetic exact claim: led a cross-functional migration across twelve services while preserving every audit control and documenting deterministic rollback evidence for each release boundary.";

function padded(index: number): string {
  return String(index).padStart(10, "0");
}

function runTimestamp(run: number, minute = 0): string {
  return `2026-08-${String(20 + run).padStart(2, "0")}T15:${String(minute).padStart(2, "0")}:00.000Z`;
}

const opportunities: SnapshotResponse["opportunities"] = Array.from(
  { length: 50 },
  (_, index) => {
    const number = index + 1;
    const duplicate = number <= 2;
    const sameRole = number === 3;
    const long = number === 50;
    return {
      id: `opportunity_${padded(number)}`,
      revision: 1,
      sourceDocumentId: opportunitySourceId,
      organization: duplicate
        ? "Synthetic Labs"
        : sameRole
          ? "Northstar Fabrication"
          : long
            ? `Organization${longToken}`
            : `Synthetic Organization ${String(number).padStart(2, "0")}`,
      roleTitle:
        duplicate || sameRole
          ? "Platform Engineer"
          : long
            ? `Role${longToken}`
            : number === 49
              ? "Principal     Applied     Systems     Researcher"
              : `Synthetic Role ${String(number).padStart(2, "0")}`,
      originalUrl: `https://synthetic.invalid/jobs/${String(number)}`,
      location: number % 2 === 0 ? "Remote" : "Chicago, IL",
      workArrangement: number % 2 === 0 ? "remote" : "hybrid",
      advertisedCompensation: "$100,000–$150,000 synthetic range",
      requisitionId: duplicate
        ? `SYN-DUP-${String(number)}`
        : `SYN-${String(number).padStart(3, "0")}`,
      sourceStatus: "current",
      legitimacyStatus: "verified",
      workflowState: "saved",
    };
  },
);

const acceptedEvidenceIds = Array.from(
  { length: 7 },
  (_, index) => `evidence_${padded(index + 1)}`,
);

const scoreSeries = [61, 64, 63, 67, 70, 72, 71, 74, 76, 79] as const;

const evaluations: SnapshotResponse["evaluations"] = scoreSeries.map(
  (score, index) => {
    const run = index + 1;
    const requiredExperience = score + 4;
    const rolePriorities = score - 6;
    return {
      id: `evaluation_${padded(run)}`,
      revision: 1,
      createdAt: runTimestamp(run),
      updatedAt: runTimestamp(run, 5),
      opportunityId: selectedOpportunityId,
      rubricId: "rubric_0000000001",
      acceptedEvidenceIds,
      dimensionScores: [
        {
          dimensionKey: "required_experience",
          inputBasisPoints: requiredExperience * 100,
          weightedNumerator: requiredExperience * 100 * 6_000,
          weightBasisPoints: 6_000,
          missing: false,
        },
        {
          dimensionKey: "role_priorities",
          inputBasisPoints: rolePriorities * 100,
          weightedNumerator: rolePriorities * 100 * 4_000,
          weightBasisPoints: 4_000,
          missing: false,
        },
      ],
      aggregateScoreBasisPoints: score * 100,
      displayScore: String(score),
      arithmeticExplanation: `${String(score)}% = ((${String(requiredExperience)}% required experience × 60%) + (${String(rolePriorities)}% role priorities × 40%)), rounded only after fixed-point aggregation.`,
      state: "completed",
      gaps: Array.from({ length: 12 }, (_, finding) =>
        finding === 0
          ? `Gap 1: no accepted evidence yet demonstrates the posting's required regulated deployment ownership. ${longToken}`
          : `Gap ${String(finding + 1)}: synthetic missing requirement ${String(finding + 1)}.`,
      ),
      contradictions: Array.from({ length: 12 }, (_, finding) =>
        finding === 0
          ? "Contradiction 1: the job requires five years of direct ownership while accepted evidence establishes three."
          : `Contradiction ${String(finding + 1)}: synthetic evidence conflict ${String(finding + 1)}.`,
      ),
      criticalFindings: [
        "Authoritative critical finding: required production incident ownership is not established by accepted candidate facts.",
        "Secondary critical finding: the location expectation needs confirmation.",
      ],
      operationId: `operation_${padded(run)}`,
      staleReason: null,
    };
  },
);

const operations: SnapshotResponse["operations"] = [
  ...scoreSeries.map((_score, index) => {
    const run = index + 1;
    return {
      id: `operation_${padded(run)}`,
      revision: 1,
      kind: "evaluation" as const,
      state: "succeeded" as const,
      route: "deterministic" as const,
      inputIdentity: selectedOpportunityId,
      inputRevision: 1,
      inputDigest: `synthetic-input-${String(run)}`,
      resourceLimits: { wallClockMs: 30_000 },
      requestedCapabilities: [],
      dshSessionId: null,
      parentOperationId: null,
      startedAt: runTimestamp(run, 1),
      lastActivityAt: runTimestamp(run, 5),
      terminalAt: runTimestamp(run, 5),
      terminalCategory: "completed" as const,
      terminalMessage: "Synthetic deterministic evaluation completed.",
      resultIds: [`evaluation_${padded(run)}`],
      artifactIds: [`artifact_${padded(run)}`],
      cancellationRequestedAt: null,
    };
  }),
  {
    id: "operation_0000000051",
    revision: 1,
    kind: "profile_organization",
    state: "succeeded",
    route: "deterministic",
    inputIdentity: candidateSourceId,
    inputRevision: 1,
    inputDigest: "synthetic-profile-organization",
    resourceLimits: { wallClockMs: 30_000 },
    requestedCapabilities: [],
    dshSessionId: null,
    parentOperationId: null,
    startedAt: "2026-08-03T13:00:00.000Z",
    lastActivityAt: "2026-08-03T13:00:05.000Z",
    terminalAt: "2026-08-03T13:00:05.000Z",
    terminalCategory: "completed",
    terminalMessage: "Synthetic career record organization completed.",
    resultIds: ["fact_0000000001"],
    artifactIds: [],
    cancellationRequestedAt: null,
  },
];

export function createEvaluationsFixture(): SnapshotResponse {
  return structuredClone({
    contractVersion: "v1",
    workspace: {
      id: "workspace_0000000001",
      displayName: "Synthetic Evaluation Workspace",
      revision: 1,
      defaultRubricId: "rubric_0000000001",
      locale: "en-US",
      timezone: "America/Chicago",
    },
    sources: [
      {
        id: candidateSourceId,
        revision: 1,
        createdAt: "2026-08-01T12:00:00.000Z",
        kind: "candidate",
        trustClass: "candidate_primary",
        contentDigest: "a".repeat(64),
        byteLength: 2_048,
        inlineText: longClaim,
        originalLocator: `synthetic://candidate/${longToken}`,
      },
      {
        id: opportunitySourceId,
        revision: 1,
        createdAt: "2026-08-02T12:00:00.000Z",
        kind: "opportunity",
        trustClass: "external",
        contentDigest: "b".repeat(64),
        byteLength: 4_096,
        inlineText:
          "Synthetic job posting used only for deterministic browser tests.",
        originalLocator: `https://synthetic.invalid/postings/${longToken}`,
      },
      {
        id: companySourceId,
        revision: 1,
        createdAt: "2026-08-03T12:00:00.000Z",
        kind: "company",
        trustClass: "external",
        contentDigest: "c".repeat(64),
        byteLength: 1_024,
        inlineText: "Synthetic company source.",
        originalLocator: "synthetic://company/research/primary-source",
      },
    ],
    profileFacts: Array.from({ length: 4 }, (_, index) => ({
      id: `fact_${padded(index + 1)}`,
      revision: 1,
      factType: index === 0 ? "experience" : "achievement",
      subject: "Synthetic Candidate",
      predicate: `verified achievement ${String(index + 1)}`,
      value:
        index === 0
          ? longClaim
          : `Accepted synthetic candidate fact ${String(index + 1)}`,
      status: "verified",
      proposedBy: "user" as const,
      sourceLocators: [
        {
          sourceId: candidateSourceId,
          start: index * 10,
          end: index * 10 + 9,
          quote: `Synthetic source quote ${String(index + 1)}`,
        },
      ],
      supersedesFactId: null,
    })),
    searchProfiles: [],
    discoveryLeads: [],
    opportunities,
    evidence: [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `evidence_${padded(index + 1)}`,
        revision: 1,
        classification: "candidate_fact",
        claim:
          index === 0
            ? longClaim
            : `Accepted candidate claim ${String(index + 1)}.`,
        sourceId: candidateSourceId,
        locator: {
          sourceId: candidateSourceId,
          start: index * 20,
          end: index * 20 + 19,
          quote:
            index === 0
              ? longClaim
              : `Exact candidate quote ${String(index + 1)}.`,
        },
        candidateFactId: `fact_${padded(index + 1)}`,
        proposedByOperationId: null,
        decision: "accepted",
        decisionReason:
          "Verified candidate fact accepted for this synthetic run.",
      })),
      {
        id: "evidence_0000000005",
        revision: 1,
        classification: "opportunity_requirement",
        claim:
          "Accepted posting requirement: own production incident response.",
        sourceId: opportunitySourceId,
        locator: {
          sourceId: opportunitySourceId,
          start: 100,
          end: 155,
          quote: "Own production incident response and regulated deployments.",
        },
        candidateFactId: null,
        proposedByOperationId: null,
        decision: "accepted",
        decisionReason:
          "Exact requirement recovered from the synthetic posting.",
      },
      {
        id: "evidence_0000000006",
        revision: 1,
        classification: "company_fact",
        claim:
          "Accepted company evidence: the synthetic team works in a regulated environment.",
        sourceId: companySourceId,
        locator: {
          sourceId: companySourceId,
          start: 10,
          end: 60,
          quote: "The synthetic team operates in a regulated environment.",
        },
        candidateFactId: null,
        proposedByOperationId: null,
        decision: "accepted",
        decisionReason: "The first-party synthetic company source supports it.",
      },
      {
        id: "evidence_0000000007",
        revision: 1,
        classification: "computation",
        claim:
          "Accepted derived evidence: two verified facts map to a required dimension.",
        sourceId: null,
        locator: null,
        candidateFactId: null,
        proposedByOperationId: null,
        decision: "accepted",
        decisionReason:
          "Deterministic fixed-point computation from accepted inputs.",
      },
      ...scoreSeries.flatMap((_score, index) => {
        const run = index + 1;
        return [
          {
            id: `evidence_${padded(100 + run * 2)}`,
            revision: 1,
            classification: "candidate_fact",
            claim: `Rejected candidate claim for run ${String(run)}: personally automated every deployment without review.`,
            sourceId: candidateSourceId,
            locator: {
              sourceId: candidateSourceId,
              start: 200 + run,
              end: 245 + run,
              quote: "Automated every deployment without review.",
            },
            candidateFactId: "fact_0000000001",
            proposedByOperationId: `operation_${padded(run)}`,
            decision: "rejected",
            decisionReason:
              "The source establishes team ownership, not sole ownership.",
          },
          {
            id: `evidence_${padded(101 + run * 2)}`,
            revision: 1,
            classification: "opportunity_requirement",
            claim: `Rejected posting inference for run ${String(run)}: ${longToken}`,
            sourceId: opportunitySourceId,
            locator: {
              sourceId: opportunitySourceId,
              start: 300 + run,
              end: 360 + run,
              quote: `Exact rejected source quote ${longToken}`,
            },
            candidateFactId: null,
            proposedByOperationId: `operation_${padded(run)}`,
            decision: "rejected",
            decisionReason:
              "The posting does not support the inferred mandatory credential.",
          },
        ];
      }),
    ],
    rubrics: [{ id: "rubric_0000000001", name: "Synthetic balanced fit" }],
    evaluations,
    comparisons: [],
    applications: [],
    importManifests: [],
    artifacts: scoreSeries.map((_score, index) => {
      const run = index + 1;
      return {
        id: `artifact_${padded(run)}`,
        revision: 1,
        kind: "evaluation_report",
        mediaType: "application/pdf",
        contentDigest: String(run).repeat(64).slice(0, 64),
        byteLength: 5_000 + run,
        evaluationIds: [`evaluation_${padded(run)}`],
        sourceIds: [candidateSourceId, opportunitySourceId, companySourceId],
        factIds: Array.from(
          { length: 4 },
          (_, fact) => `fact_${padded(fact + 1)}`,
        ),
        evidenceIds: acceptedEvidenceIds,
        state: "current",
        staleReason: null,
      };
    }),
    operations,
    events: [],
  } satisfies SnapshotResponse);
}

export type EvaluationFixtureState =
  | "pending"
  | "running"
  | "waiting_for_user"
  | "completed"
  | "stale"
  | "failed"
  | "canceled"
  | "queued"
  | "indeterminate";

export function createEvaluationsLifecycleFixture(
  state: EvaluationFixtureState,
): SnapshotResponse {
  const snapshot = createEvaluationsFixture();
  if (state === "completed") return snapshot;
  const currentEvaluation = snapshot.evaluations.find(
    (evaluation) => evaluation.id === "evaluation_0000000010",
  );
  const currentOperation = snapshot.operations.find(
    (operation) => operation.id === "operation_0000000010",
  );
  if (currentEvaluation === undefined || currentOperation === undefined)
    throw new Error("Synthetic lifecycle fixture is incomplete.");
  const evaluationState =
    state === "queued" || state === "indeterminate" ? "running" : state;
  const operationState =
    state === "pending" ? "queued" : state === "stale" ? "succeeded" : state;
  const currentEvaluationIndex =
    snapshot.evaluations.indexOf(currentEvaluation);
  const currentOperationIndex = snapshot.operations.indexOf(currentOperation);
  const evaluationUpdatedAt = runTimestamp(10, state === "pending" ? 7 : 5);
  const operationUpdatedAt = runTimestamp(10, state === "pending" ? 6 : 8);
  const replacementEvaluation = {
    ...currentEvaluation,
    state: evaluationState,
    updatedAt: evaluationUpdatedAt,
    ...(state === "stale"
      ? {}
      : {
          aggregateScoreBasisPoints: 0,
          displayScore: "0",
          dimensionScores: [],
          arithmeticExplanation:
            "No final arithmetic exists for this synthetic non-final run.",
        }),
    staleReason:
      state === "stale" ? "Accepted evidence changed after evaluation." : null,
  };
  const replacementOperation = {
    ...currentOperation,
    state: operationState,
    lastActivityAt: operationUpdatedAt,
    terminalAt: ["failed", "canceled", "indeterminate"].includes(state)
      ? operationUpdatedAt
      : null,
    terminalCategory: ["failed", "canceled", "indeterminate"].includes(state)
      ? state
      : null,
    terminalMessage:
      state === "failed"
        ? "Synthetic evaluation failed before a new result was accepted."
        : state === "canceled"
          ? "Synthetic evaluation was canceled by the user."
          : state === "indeterminate"
            ? "Synthetic operation ended without a trusted terminal."
            : null,
    resultIds: [],
    artifactIds: [],
  };
  const nextEvaluations = [...snapshot.evaluations];
  nextEvaluations[currentEvaluationIndex] = replacementEvaluation;
  const nextOperations = [...snapshot.operations];
  nextOperations[currentOperationIndex] = replacementOperation;
  return {
    ...snapshot,
    evaluations: nextEvaluations,
    operations: nextOperations,
    artifacts:
      state === "stale"
        ? snapshot.artifacts.map((artifact) =>
            artifact.evaluationIds.includes(currentEvaluation.id)
              ? {
                  ...artifact,
                  state: "stale",
                  staleReason: "Accepted evidence changed after evaluation.",
                }
              : artifact,
          )
        : snapshot.artifacts,
  };
}

export function createNoJobsFixture(): SnapshotResponse {
  return {
    ...createEvaluationsFixture(),
    opportunities: [],
    evaluations: [],
    artifacts: [],
    operations: [],
  };
}

export function createNoEvidenceFixture(): SnapshotResponse {
  const snapshot = createEvaluationsFixture();
  return {
    ...snapshot,
    profileFacts: snapshot.profileFacts.map((fact) => ({
      ...fact,
      status: "proposed",
    })),
    evaluations: [],
    artifacts: [],
    operations: [],
  };
}

export function createUnevaluatedFixture(): SnapshotResponse {
  return {
    ...createEvaluationsFixture(),
    evaluations: [],
    artifacts: [],
    operations: [],
  };
}
