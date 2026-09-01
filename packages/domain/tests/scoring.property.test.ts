import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calculateScore,
  type EntityId,
  type Rubric,
  type UtcTimestamp,
  type WorkspaceId,
} from "../src/index.js";

const baseRubric: Rubric = {
  id: "rubric_01K3YV3Q50" as EntityId,
  workspaceId: "workspace_01K3YV3Q4Z" as WorkspaceId,
  createdAt: "2026-01-01T00:00:00.000Z" as UtcTimestamp,
  updatedAt: "2026-01-01T00:00:00.000Z" as UtcTimestamp,
  revision: 1,
  semanticVersion: "1.0.0",
  name: "Property rubric",
  dimensions: [
    {
      key: "a",
      label: "A",
      weightBasisPoints: 5000,
      missingInput: "zero",
      criticalMinimumBasisPoints: null,
    },
    {
      key: "b",
      label: "B",
      weightBasisPoints: 5000,
      missingInput: "zero",
      criticalMinimumBasisPoints: null,
    },
  ],
  thresholds: {},
  displayScale: 100,
  usedAt: null,
};

describe("score properties", () => {
  it("always remains within the basis-point range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (a, b) => {
          const score = calculateScore(
            baseRubric,
            [
              {
                dimensionKey: "a",
                semanticScoreBasisPoints: a,
                evidenceIds: [],
                disposition: null,
              },
              {
                dimensionKey: "b",
                semanticScoreBasisPoints: b,
                evidenceIds: [],
                disposition: null,
              },
            ],
            [],
          );
          expect(score.aggregateScoreBasisPoints).toBeGreaterThanOrEqual(0);
          expect(score.aggregateScoreBasisPoints).toBeLessThanOrEqual(10_000);
        },
      ),
    );
  });
});
