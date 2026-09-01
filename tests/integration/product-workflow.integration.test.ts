import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../apps/server/src/server.js";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";

const CSRF = "synthetic-product-csrf-000000000000000";
const HOST = "127.0.0.1:4173";

interface Entity {
  readonly id: string;
  readonly revision: number;
}

interface Approval extends Entity {
  readonly state: string;
  readonly effectKind: string;
  readonly targetId: string;
}

interface Fact extends Entity {
  readonly subject: string;
  readonly predicate: string;
  readonly value: string;
  readonly sourceLocators: readonly {
    readonly sourceId: string;
    readonly start: number;
    readonly end: number;
    readonly quote: string;
  }[];
}

describe("coherent day-to-day product workflow", () => {
  let parent: string;
  let workspace: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-product-"));
    workspace = join(parent, "workspace");
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("SYN7HPD000"),
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(parent, { recursive: true, force: true });
  });

  function headers(): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      cookie: `cw_csrf=${CSRF}`,
      "x-cw-csrf": CSRF,
      "x-idempotency-key": `synthetic-product-${String(serial).padStart(4, "0")}`,
      "sec-fetch-site": "same-origin",
    };
  }

  async function post(url: string, payload: Readonly<Record<string, unknown>>) {
    return server.inject({ method: "POST", url, headers: headers(), payload });
  }

  async function createFact(
    claim: string,
    subject: string,
    predicate: string,
    value: string,
  ): Promise<Fact> {
    const source = (
      await post("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: claim,
      })
    ).json<Entity>();
    const fact = (
      await post("/api/v1/profile-facts", {
        factType: "experience",
        subject,
        predicate,
        value,
        sourceLocators: [
          {
            sourceId: source.id,
            start: 0,
            end: claim.length,
            quote: claim,
          },
        ],
        proposedBy: "user",
      })
    ).json<Fact>();
    return (
      await post(`/api/v1/profile-facts/${fact.id}/confirm`, {
        expectedRevision: fact.revision,
        outcome: { kind: "confirm" },
      })
    ).json<Fact>();
  }

  async function acceptFactEvidence(fact: Fact): Promise<Entity> {
    const evidence = (
      await post("/api/v1/evidence", {
        classification: "candidate_fact",
        claim: `${fact.subject} ${fact.predicate} ${fact.value}`,
        sourceId: fact.sourceLocators[0]?.sourceId,
        locator: fact.sourceLocators[0],
        candidateFactId: fact.id,
      })
    ).json<Entity>();
    return (
      await post(`/api/v1/evidence/${evidence.id}/decision`, {
        expectedRevision: evidence.revision,
        decision: "accepted",
        reason: "Synthetic complete verified candidate fact.",
      })
    ).json<Entity>();
  }

  async function createOpportunity(
    organization: string,
    roleTitle: string,
  ): Promise<Entity> {
    const text = `${organization} lists one ${roleTitle} role.`;
    const source = (
      await post("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text,
      })
    ).json<Entity>();
    return (
      await post("/api/v1/opportunities", {
        sourceDocumentId: source.id,
        organization,
        roleTitle,
        originalUrl: `https://${organization.toLowerCase()}.example.test/jobs/1`,
      })
    ).json<Entity>();
  }

  it("tracks transitions, reviews factual drafts, scopes correction staleness, searches, exports, and restarts", async () => {
    expect(
      (
        await post("/api/v1/workspaces", {
          displayName: "Synthetic Product Workspace",
          locale: "en-US",
          timezone: "America/Chicago",
        })
      ).statusCode,
    ).toBe(201);
    const factA = await createFact(
      "Avery Example built TypeScript services",
      "Avery Example",
      "built",
      "TypeScript services",
    );
    const factB = await createFact(
      "Avery Example led incident reviews",
      "Avery Example",
      "led",
      "incident reviews",
    );
    await acceptFactEvidence(factA);
    await acceptFactEvidence(factB);
    const opportunityA = await createOpportunity(
      "Synthetic Labs",
      "Platform Engineer",
    );
    const opportunityB = await createOpportunity(
      "Example Systems",
      "Reliability Engineer",
    );

    const signaled = await post(
      `/api/v1/opportunities/${opportunityA.id}/signals`,
      {
        expectedRevision: opportunityA.revision,
        sourceStatus: "active",
        legitimacyStatus: "needs_review",
      },
    );
    expect(signaled.json()).toMatchObject({
      sourceStatus: "active",
      legitimacyStatus: "needs_review",
    });

    const application = (
      await post("/api/v1/applications", {
        opportunityId: opportunityA.id,
        effectiveDate: "2026-09-01",
      })
    ).json<Entity & { state: string }>();
    const preparing = await post(
      `/api/v1/applications/${application.id}/transitions`,
      {
        expectedRevision: application.revision,
        state: "preparing",
        effectiveDate: "2026-09-01",
        note: "Preparing local evidence-backed drafts.",
      },
    );
    expect(preparing.json()).toMatchObject({
      state: "preparing",
      stateRevision: 2,
    });
    const race = await post(
      `/api/v1/applications/${application.id}/transitions`,
      {
        expectedRevision: application.revision,
        state: "withdrawn",
        effectiveDate: "2026-09-01",
      },
    );
    expect(race.statusCode).toBe(409);
    expect(race.json()).toMatchObject({ error: { code: "revision_conflict" } });

    const draftA = (
      await post("/api/v1/artifacts/candidate-drafts", {
        kind: "draft_cover_letter",
        opportunityId: opportunityA.id,
        factIds: [factA.id],
        styleNote: "Warm but concise; this is style, not a factual claim.",
      })
    ).json<
      Entity & { state: string; factIds: string[]; evidenceIds: string[] }
    >();
    const draftB = (
      await post("/api/v1/artifacts/candidate-drafts", {
        kind: "draft_interview_prep",
        opportunityId: opportunityB.id,
        factIds: [factB.id],
      })
    ).json<Entity & { state: string }>();
    expect(draftA).toMatchObject({ state: "staged", factIds: [factA.id] });
    expect(draftA.evidenceIds).toHaveLength(1);
    const draftAEvidenceId = draftA.evidenceIds[0];
    if (draftAEvidenceId === undefined) {
      throw new Error("Expected one accepted evidence identity.");
    }

    const pendingApprovalA = (
      await post("/api/v1/approvals", {
        effectKind: "artifact.review",
        targetId: draftA.id,
        expectedRevision: draftA.revision,
      })
    ).json<Approval>();
    const pendingApprovalB = (
      await post("/api/v1/approvals", {
        effectKind: "artifact.review",
        targetId: draftB.id,
        expectedRevision: draftB.revision,
      })
    ).json<Approval>();
    expect(pendingApprovalA).toMatchObject({
      state: "pending",
      effectKind: "artifact.review",
      targetId: draftA.id,
    });

    await server.close();
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("SYN7HPD100"),
    });
    const persistedApprovals = (
      await server.inject({ method: "GET", url: "/api/v1/approvals" })
    ).json<{ approvals: Approval[] }>().approvals;
    expect(persistedApprovals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pendingApprovalA.id, state: "pending" }),
        expect.objectContaining({ id: pendingApprovalB.id, state: "pending" }),
      ]),
    );
    const content = await server.inject({
      method: "GET",
      url: `/api/v1/artifacts/${draftA.id}/content`,
    });
    expect(content.statusCode).toBe(200);
    const markdown = content.json<{ text: string }>().text;
    expect(markdown).toContain("DRAFT — explicit human review required");
    expect(markdown).toContain(
      `[fact ${factA.id}; evidence ${draftAEvidenceId}]`,
    );
    expect(markdown).toContain("[NON-FACTUAL STYLE]");
    expect(markdown).toContain("No application was submitted");
    expect(markdown.match(/^# /gmu)).toHaveLength(1);

    const approvedA = (
      await post(`/api/v1/approvals/${pendingApprovalA.id}/decision`, {
        expectedRevision: pendingApprovalA.revision,
        decision: "approved",
      })
    ).json<Approval>();
    const approvedB = (
      await post(`/api/v1/approvals/${pendingApprovalB.id}/decision`, {
        expectedRevision: pendingApprovalB.revision,
        decision: "approved",
      })
    ).json<Approval>();
    const reviewedA = await post(`/api/v1/artifacts/${draftA.id}/review`, {
      expectedRevision: draftA.revision,
      approvalId: approvedA.id,
      expectedApprovalRevision: approvedA.revision,
    });
    const reviewedB = await post(`/api/v1/artifacts/${draftB.id}/review`, {
      expectedRevision: draftB.revision,
      approvalId: approvedB.id,
      expectedApprovalRevision: approvedB.revision,
    });
    expect(reviewedA.json()).toMatchObject({ state: "sealed", revision: 2 });
    expect(reviewedB.json()).toMatchObject({ state: "sealed", revision: 2 });

    const search = await server.inject({
      method: "GET",
      url: "/api/v1/search?q=platform",
    });
    expect(search.statusCode).toBe(200);
    expect(search.json<{ results: { kind: string }[] }>().results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "opportunity" }),
      ]),
    );

    const correction = await post(
      `/api/v1/profile-facts/${factA.id}/corrections`,
      {
        expectedRevision: factA.revision,
        value: "JavaScript services",
        sourceText: "Avery Example built JavaScript services",
      },
    );
    expect(correction.statusCode).toBe(200);
    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      artifacts: { id: string; state: string }[];
      events: { eventKind: string }[];
    }>();
    expect(
      snapshot.artifacts.find((item) => item.id === draftA.id)?.state,
    ).toBe("stale");
    expect(
      snapshot.artifacts.find((item) => item.id === draftB.id)?.state,
    ).toBe("sealed");
    expect(
      snapshot.events.filter(
        (event) => event.eventKind === "application.transitioned",
      ),
    ).toHaveLength(1);

    const exported = await server.inject({
      method: "GET",
      url: "/api/v1/export",
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["cache-control"]).toBe("no-store");
    const exportBody = exported.json<{
      normalized: {
        records: {
          source: {
            inlineText: string | null;
            originalLocator: string | null;
          }[];
        };
        manifest: { digest: string };
      };
      exportManifest: { credentialFree: boolean; digest: string };
    }>();
    expect(exportBody.exportManifest.credentialFree).toBe(true);
    expect(exportBody.normalized.manifest.digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      exportBody.normalized.records.source.every(
        (item) => item.inlineText === null && item.originalLocator === null,
      ),
    ).toBe(true);
    const exportWithArtifact = await post("/api/v1/export", {
      selectedArtifactIds: [draftB.id],
    });
    expect(exportWithArtifact.statusCode).toBe(200);
    expect(
      exportWithArtifact.json<{
        selectedArtifacts: {
          artifactId: string;
          bytesBase64: string;
          contentDigest: string;
        }[];
      }>().selectedArtifacts,
    ).toEqual([
      expect.objectContaining({
        artifactId: draftB.id,
        contentDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
        bytesBase64: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/u),
      }),
    ]);
  });

  it("rejects draft generation when a verified fact lacks accepted evidence", async () => {
    await post("/api/v1/workspaces", {
      displayName: "Synthetic Draft Gate",
      locale: "en-US",
      timezone: "UTC",
    });
    const fact = await createFact(
      "Taylor Example maintained Go services",
      "Taylor Example",
      "maintained",
      "Go services",
    );
    const opportunity = await createOpportunity("Gate Labs", "Go Engineer");
    const response = await post("/api/v1/artifacts/candidate-drafts", {
      kind: "draft_cv",
      opportunityId: opportunity.id,
      factIds: [fact.id],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "evidence_unsupported" },
    });
  });
});
