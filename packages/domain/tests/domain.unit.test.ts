import { describe, expect, it } from "vitest";
import {
  APPLICATION_TRANSITIONS,
  EVALUATION_TRANSITIONS,
  OPERATION_TRANSITIONS,
  calculateScore,
  canonicalJson,
  requireApplicationTransition,
  requireEvaluationTransition,
  requireOperationTransition,
  type ApplicationState,
  type EvaluationState,
  type EntityId,
  type EvidenceItem,
  type OperationState,
  type Rubric,
  type UtcTimestamp,
  type WorkspaceId,
} from "../src/index.js";

const base = {
  workspaceId: "workspace_01K3YV3Q4Z" as WorkspaceId,
  createdAt: "2026-01-01T00:00:00.000Z" as UtcTimestamp,
  updatedAt: "2026-01-01T00:00:00.000Z" as UtcTimestamp,
  revision: 1,
} as const;

const rubric: Rubric = {
  ...base,
  id: "rubric_01K3YV3Q50" as EntityId,
  semanticVersion: "1.0.0",
  name: "Synthetic fit",
  dimensions: [
    {
      key: "skills",
      label: "Skills",
      weightBasisPoints: 6000,
      missingInput: "block",
      criticalMinimumBasisPoints: null,
    },
    {
      key: "values",
      label: "Values",
      weightBasisPoints: 4000,
      missingInput: "neutral",
      criticalMinimumBasisPoints: null,
    },
  ],
  thresholds: { strong: 7500 },
  displayScale: 100,
  usedAt: null,
};

const evidence: EvidenceItem = {
  ...base,
  id: "evidence_01K3YV3Q51" as EntityId,
  classification: "opportunity_fact",
  claim: "TypeScript is required",
  sourceId: "source_01K3YV3Q52" as EntityId,
  locator: null,
  candidateFactId: null,
  proposedByOperationId: null,
  decision: "accepted",
  decisionReason: "Exact source support",
  acceptedAt: base.createdAt,
  rejectedAt: null,
};

describe("closed state machines", () => {
  for (const [from, allowed] of Object.entries(APPLICATION_TRANSITIONS)) {
    for (const to of Object.keys(APPLICATION_TRANSITIONS)) {
      const action = (): void =>
        requireApplicationTransition(
          from as ApplicationState,
          to as ApplicationState,
        );
      if (allowed.includes(to as ApplicationState)) {
        it(`accepts application ${from} -> ${to}`, () =>
          expect(action).not.toThrow());
      } else {
        it(`rejects application ${from} -> ${to}`, () =>
          expect(action).toThrow(/cannot transition/));
      }
    }
  }
  for (const [from, allowed] of Object.entries(EVALUATION_TRANSITIONS)) {
    for (const to of Object.keys(EVALUATION_TRANSITIONS)) {
      const action = (): void =>
        requireEvaluationTransition(
          from as EvaluationState,
          to as EvaluationState,
        );
      if (allowed.includes(to as EvaluationState)) {
        it(`accepts evaluation ${from} -> ${to}`, () =>
          expect(action).not.toThrow());
      } else {
        it(`rejects evaluation ${from} -> ${to}`, () =>
          expect(action).toThrow(/cannot transition/));
      }
    }
  }
  for (const [from, allowed] of Object.entries(OPERATION_TRANSITIONS)) {
    for (const to of Object.keys(OPERATION_TRANSITIONS)) {
      const action = (): void =>
        requireOperationTransition(
          from as OperationState,
          to as OperationState,
        );
      if (allowed.includes(to as OperationState)) {
        it(`accepts operation ${from} -> ${to}`, () =>
          expect(action).not.toThrow());
      } else {
        it(`rejects operation ${from} -> ${to}`, () =>
          expect(action).toThrow(/cannot transition/));
      }
    }
  }
});

describe("deterministic scoring", () => {
  it("aggregates integer basis points and applies neutral missing input", () => {
    expect(
      calculateScore(
        rubric,
        [
          {
            dimensionKey: "skills",
            semanticScoreBasisPoints: 8000,
            evidenceIds: [evidence.id],
            disposition: null,
          },
          {
            dimensionKey: "values",
            semanticScoreBasisPoints: null,
            evidenceIds: [],
            disposition: "Not established",
          },
        ],
        [evidence],
      ),
    ).toMatchObject({
      aggregateScoreBasisPoints: 6800,
      displayScore: "68",
      gaps: ["Not established"],
    });
  });

  it("does not allow rejected evidence to influence a score", () => {
    expect(() =>
      calculateScore(
        rubric,
        [
          {
            dimensionKey: "skills",
            semanticScoreBasisPoints: 8000,
            evidenceIds: [evidence.id],
            disposition: null,
          },
        ],
        [
          {
            ...evidence,
            decision: "rejected",
            acceptedAt: null,
            rejectedAt: base.createdAt,
          },
        ],
      ),
    ).toThrow(/not accepted/);
  });

  it("produces byte-equivalent canonical output", () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":2}',
    );
  });
});
