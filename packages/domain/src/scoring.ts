import type {
  DimensionInput,
  DimensionScore,
  EntityId,
  EvidenceItem,
  Rubric,
} from "./entities.js";
import { assertDomain } from "./errors.js";

export interface ScoreResult {
  readonly dimensionScores: readonly DimensionScore[];
  readonly aggregateScoreBasisPoints: number;
  readonly displayScore: string;
  readonly arithmeticExplanation: string;
  readonly gaps: readonly string[];
  readonly criticalFindings: readonly string[];
  readonly acceptedEvidenceIds: readonly EntityId[];
}

export function validateRubric(rubric: Rubric): void {
  assertDomain(
    /^\d+\.\d+\.\d+$/u.test(rubric.semanticVersion),
    "invalid_request",
    "Rubric version must be semantic.",
  );
  assertDomain(
    rubric.dimensions.length > 0 && rubric.dimensions.length <= 32,
    "invalid_request",
    "Rubric must have between 1 and 32 dimensions.",
  );
  const keys = new Set(rubric.dimensions.map((dimension) => dimension.key));
  assertDomain(
    keys.size === rubric.dimensions.length,
    "duplicate_identity",
    "Rubric dimension keys must be unique.",
  );
  const weight = rubric.dimensions.reduce(
    (sum, dimension) => sum + dimension.weightBasisPoints,
    0,
  );
  assertDomain(
    weight === 10_000,
    "invalid_request",
    "Rubric weights must total 10000 basis points.",
  );
  for (const dimension of rubric.dimensions) {
    assertDomain(
      dimension.weightBasisPoints > 0,
      "invalid_request",
      "Rubric weights must be positive.",
    );
    assertDomain(
      dimension.criticalMinimumBasisPoints === null ||
        (dimension.criticalMinimumBasisPoints >= 0 &&
          dimension.criticalMinimumBasisPoints <= 10_000),
      "invalid_request",
      "Critical minima must be basis points.",
    );
  }
}

export function calculateScore(
  rubric: Rubric,
  inputs: readonly DimensionInput[],
  evidence: readonly EvidenceItem[],
): ScoreResult {
  validateRubric(rubric);
  const inputByKey = new Map(
    inputs.map((input) => [input.dimensionKey, input]),
  );
  assertDomain(
    inputByKey.size === inputs.length,
    "duplicate_identity",
    "Dimension inputs must be unique.",
  );
  assertDomain(
    inputs.every((input) =>
      rubric.dimensions.some(
        (dimension) => dimension.key === input.dimensionKey,
      ),
    ),
    "invalid_request",
    "Unknown rubric dimension input.",
  );
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const accepted = new Set<EntityId>();
  const gaps: string[] = [];
  const criticalFindings: string[] = [];
  const dimensionScores: DimensionScore[] = [];

  for (const dimension of rubric.dimensions) {
    const input = inputByKey.get(dimension.key);
    let score = input?.semanticScoreBasisPoints ?? null;
    const missing = score === null;
    if (missing) {
      assertDomain(
        dimension.missingInput !== "block",
        "evidence_unsupported",
        `Missing required input: ${dimension.key}.`,
      );
      score = dimension.missingInput === "neutral" ? 5_000 : 0;
      gaps.push(input?.disposition ?? `Missing ${dimension.label}`);
    }
    assertDomain(
      score !== null,
      "invalid_request",
      `Dimension ${dimension.key} did not resolve to a score.`,
    );
    assertDomain(
      Number.isInteger(score) && score >= 0 && score <= 10_000,
      "invalid_request",
      `Dimension ${dimension.key} must be integer basis points.`,
    );
    for (const evidenceId of input?.evidenceIds ?? []) {
      const item = evidenceById.get(evidenceId);
      assertDomain(
        item?.decision === "accepted",
        "evidence_unsupported",
        `Dimension ${dimension.key} references evidence that is not accepted.`,
      );
      accepted.add(evidenceId);
    }
    if (
      dimension.criticalMinimumBasisPoints !== null &&
      score < dimension.criticalMinimumBasisPoints
    ) {
      criticalFindings.push(
        `${dimension.label} is below its critical minimum.`,
      );
    }
    dimensionScores.push({
      dimensionKey: dimension.key,
      inputBasisPoints: score,
      weightedNumerator: score * dimension.weightBasisPoints,
      weightBasisPoints: dimension.weightBasisPoints,
      missing,
    });
  }
  assertDomain(
    criticalFindings.length === 0,
    "evidence_unsupported",
    "A critical rubric predicate failed.",
    { criticalFindings },
  );
  const numerator = dimensionScores.reduce(
    (sum, item) => sum + item.weightedNumerator,
    0,
  );
  const aggregateScoreBasisPoints = Math.round(numerator / 10_000);
  const displayScore =
    rubric.displayScale === 100
      ? (aggregateScoreBasisPoints / 100).toFixed(0)
      : (aggregateScoreBasisPoints / 2_000).toFixed(1);
  const arithmeticExplanation = `${dimensionScores
    .map(
      (item) =>
        `${item.dimensionKey}:${String(item.inputBasisPoints)}×${String(item.weightBasisPoints)}`,
    )
    .join(
      " + ",
    )} = ${String(numerator)}; round(${String(numerator)}/10000) = ${String(aggregateScoreBasisPoints)}`;
  return {
    dimensionScores,
    aggregateScoreBasisPoints,
    displayScore,
    arithmeticExplanation,
    gaps,
    criticalFindings,
    acceptedEvidenceIds: [...accepted].sort(),
  };
}
