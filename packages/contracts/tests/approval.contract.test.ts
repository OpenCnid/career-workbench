import { describe, expect, it } from "vitest";
import {
  AcceptComparisonBodySchema,
  DecideApprovalBodySchema,
  RequestApprovalBodySchema,
  ReviewArtifactBodySchema,
  TransitionApplicationBodySchema,
  parseContract,
} from "../src/index.js";

describe("approval API contracts", () => {
  it("accepts only a bounded exact effect request", () => {
    const request = {
      effectKind: "artifact.review",
      targetId: "artifact_01K3YV3Q50",
      expectedRevision: 3,
      expiresInSeconds: 300,
    } as const;
    expect(
      parseContract(RequestApprovalBodySchema, JSON.stringify(request)),
    ).toEqual(request);
    expect(() =>
      parseContract(
        RequestApprovalBodySchema,
        JSON.stringify({ ...request, effectKind: "application.submit" }),
      ),
    ).toThrow(/does not match/u);
    expect(() =>
      parseContract(
        RequestApprovalBodySchema,
        JSON.stringify({ ...request, recipient: "external@example.test" }),
      ),
    ).toThrow(/does not match/u);
  });

  it("carries the displayed application transition and later consumption proof", () => {
    const request = {
      effectKind: "application.transition",
      targetId: "application_01K3YV3Q50",
      expectedRevision: 2,
      applicationTransition: {
        state: "ready_for_review",
        effectiveDate: "2026-09-01",
        note: "Synthetic user-reviewed transition.",
      },
    } as const;
    expect(
      parseContract(RequestApprovalBodySchema, JSON.stringify(request)),
    ).toEqual(request);
    const consumption = {
      expectedRevision: 2,
      state: "ready_for_review",
      effectiveDate: "2026-09-01",
      note: "Synthetic user-reviewed transition.",
      approvalId: "approval_01K3YV3Q51",
      expectedApprovalRevision: 2,
    } as const;
    expect(
      parseContract(
        TransitionApplicationBodySchema,
        JSON.stringify(consumption),
      ),
    ).toEqual(consumption);
  });

  it("accepts closed user decisions", () => {
    expect(
      parseContract(
        DecideApprovalBodySchema,
        JSON.stringify({ expectedRevision: 1, decision: "approved" }),
      ),
    ).toEqual({ expectedRevision: 1, decision: "approved" });
    expect(() =>
      parseContract(
        DecideApprovalBodySchema,
        JSON.stringify({ expectedRevision: 1, decision: "maybe" }),
      ),
    ).toThrow(/does not match/u);
  });

  it("allows gated endpoints to report approval_required when proof is absent", () => {
    expect(
      parseContract(
        AcceptComparisonBodySchema,
        JSON.stringify({ expectedRevision: 2 }),
      ),
    ).toEqual({ expectedRevision: 2 });
    expect(
      parseContract(
        ReviewArtifactBodySchema,
        JSON.stringify({ expectedRevision: 4 }),
      ),
    ).toEqual({ expectedRevision: 4 });
  });
});
