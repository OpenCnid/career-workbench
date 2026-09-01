import { describe, expect, it } from "vitest";
import {
  validateEvidenceForAcceptance,
  type Digest,
  type EntityId,
  type EvidenceItem,
  type ProfileFact,
  type SourceDocument,
  type UtcTimestamp,
  type WorkspaceId,
} from "../src/index.js";

const timestamp = "2026-01-01T00:00:00.000Z" as UtcTimestamp;
const workspaceId = "workspace_01K3YV3Q4Z" as WorkspaceId;
const sourceId = "source_01K3YV3Q50" as EntityId;
const factId = "fact_01K3YV3Q500" as EntityId;
const text = "Avery Example built TypeScript services";
const source: SourceDocument = {
  id: sourceId,
  workspaceId,
  createdAt: timestamp,
  updatedAt: timestamp,
  revision: 1,
  kind: "candidate",
  trustClass: "candidate_primary",
  mediaType: "text/plain",
  contentDigest: "0".repeat(64) as Digest,
  byteLength: text.length,
  originalLocator: null,
  capturedAt: timestamp,
  supersedesSourceId: null,
  inlineText: text,
  artifactId: null,
};
const fact: ProfileFact = {
  id: factId,
  workspaceId,
  createdAt: timestamp,
  updatedAt: timestamp,
  revision: 2,
  factType: "experience",
  subject: "Avery Example",
  predicate: "built",
  value: "TypeScript services",
  status: "verified",
  sourceLocators: [{ sourceId, start: 0, end: text.length, quote: text }],
  proposedBy: "user",
  confirmedByUserAt: timestamp,
  supersedesFactId: null,
};
const evidence: EvidenceItem = {
  id: "evidence_01K3YV3Q51" as EntityId,
  workspaceId,
  createdAt: timestamp,
  updatedAt: timestamp,
  revision: 1,
  classification: "candidate_fact",
  claim: text,
  sourceId,
  locator: { sourceId, start: 0, end: text.length, quote: text },
  candidateFactId: factId,
  proposedByOperationId: null,
  decision: "proposed",
  decisionReason: null,
  acceptedAt: null,
  rejectedAt: null,
};

describe("candidate evidence admission", () => {
  it("accepts exact complete support", () => {
    expect(() =>
      validateEvidenceForAcceptance(evidence, source, fact),
    ).not.toThrow();
  });

  it.each([
    ["combined fragments", `${text} and led 40 engineers`],
    ["unsupported metric", "Avery Example improved latency by 90%"],
    ["unsupported authorship", "Avery Example authored TypeScript"],
    [
      "unsupported qualifier",
      "Avery Example independently built every TypeScript service",
    ],
  ])("rejects %s even with a valid-looking locator", (_label, claim) => {
    expect(() =>
      validateEvidenceForAcceptance({ ...evidence, claim }, source, fact),
    ).toThrow(/complete fact/u);
  });

  it.each(["derived_unverified", "user_cannot_confirm", "rejected"] as const)(
    "rejects candidate status %s",
    (status) => {
      expect(() =>
        validateEvidenceForAcceptance(evidence, source, { ...fact, status }),
      ).toThrow(/verified fact/u);
    },
  );

  it("rejects a locator whose quote is not the immutable source slice", () => {
    expect(() =>
      validateEvidenceForAcceptance(
        {
          ...evidence,
          locator: {
            sourceId,
            start: 0,
            end: text.length,
            quote: "Avery Example built a different system",
          },
        },
        source,
        fact,
      ),
    ).toThrow(/does not match/u);
  });
});
