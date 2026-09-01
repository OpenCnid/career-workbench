import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../apps/server/src/server.js";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";

const CSRF = "synthetic-approval-csrf-0000000000000";
const HOST = "127.0.0.1:4173";
const DSH_TOKEN = "synthetic-approval-dsh-token-000000000000000";

interface Entity {
  readonly id: string;
  readonly revision: number;
}

interface Approval extends Entity {
  readonly commandId: string;
  readonly effectKind: string;
  readonly targetId: string;
  readonly expectedRevisions: Readonly<Record<string, number>>;
  readonly state: string;
  readonly approvingInteractionId: string | null;
}

interface ErrorBody {
  readonly error: { readonly code: string };
}

describe("approval lifecycle", () => {
  let parent: string;
  let workspace: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-approval-"));
    workspace = join(parent, "workspace");
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("APPR0VA100"),
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
      "x-idempotency-key": `synthetic-approval-${String(serial).padStart(4, "0")}`,
      "sec-fetch-site": "same-origin",
    };
  }

  function dshHeaders(): Record<string, string> {
    serial += 1;
    return {
      authorization: `CW-DSH ${DSH_TOKEN}`,
      "content-type": "application/json",
      "x-cw-dsh-session": "synthetic-approval-session",
      "x-idempotency-key": `synthetic-approval-dsh-${String(serial).padStart(4, "0")}`,
    };
  }

  async function post(url: string, payload: Readonly<Record<string, unknown>>) {
    return server.inject({ method: "POST", url, headers: headers(), payload });
  }

  async function seedDraft(): Promise<{
    readonly draft: Entity;
    readonly application: Entity;
  }> {
    expect(
      (
        await post("/api/v1/workspaces", {
          displayName: "Synthetic Approval Workspace",
          locale: "en-US",
          timezone: "America/Chicago",
        })
      ).statusCode,
    ).toBe(201);
    const claim = "Avery Example built synthetic TypeScript services";
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
        subject: "Avery Example",
        predicate: "built",
        value: "synthetic TypeScript services",
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
    ).json<Entity>();
    const confirmedFact = (
      await post(`/api/v1/profile-facts/${fact.id}/confirm`, {
        expectedRevision: fact.revision,
        outcome: { kind: "confirm" },
      })
    ).json<Entity>();
    const evidence = (
      await post("/api/v1/evidence", {
        classification: "candidate_fact",
        claim,
        sourceId: source.id,
        locator: {
          sourceId: source.id,
          start: 0,
          end: claim.length,
          quote: claim,
        },
        candidateFactId: confirmedFact.id,
      })
    ).json<Entity>();
    expect(
      (
        await post(`/api/v1/evidence/${evidence.id}/decision`, {
          expectedRevision: evidence.revision,
          decision: "accepted",
          reason: "Synthetic candidate-primary source matches exactly.",
        })
      ).statusCode,
    ).toBe(200);
    const opportunityText = "Synthetic Systems lists a Platform Engineer role.";
    const opportunitySource = (
      await post("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: opportunityText,
      })
    ).json<Entity>();
    const opportunity = (
      await post("/api/v1/opportunities", {
        sourceDocumentId: opportunitySource.id,
        organization: "Synthetic Systems",
        roleTitle: "Platform Engineer",
      })
    ).json<Entity>();
    const application = (
      await post("/api/v1/applications", {
        opportunityId: opportunity.id,
        effectiveDate: "2026-09-01",
      })
    ).json<Entity>();
    const response = await post("/api/v1/artifacts/candidate-drafts", {
      kind: "draft_cover_letter",
      opportunityId: opportunity.id,
      factIds: [confirmedFact.id],
    });
    expect(response.statusCode, response.body).toBe(201);
    return { draft: response.json<Entity>(), application };
  }

  async function requestApproval(
    target: Entity,
    expiresInSeconds?: number,
  ): Promise<Approval> {
    const response = await post("/api/v1/approvals", {
      effectKind: "artifact.review",
      targetId: target.id,
      expectedRevision: target.revision,
      ...(expiresInSeconds === undefined ? {} : { expiresInSeconds }),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<Approval>();
  }

  async function decide(
    approval: Approval,
    decision: "approved" | "denied",
  ): Promise<Approval> {
    const response = await post(`/api/v1/approvals/${approval.id}/decision`, {
      expectedRevision: approval.revision,
      decision,
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<Approval>();
  }

  it("binds, decides, expires, persists, and atomically consumes approvals", async () => {
    const { draft, application } = await seedDraft();

    const dshWithoutApproval = await server.inject({
      method: "POST",
      url: `/api/v1/applications/${application.id}/transitions`,
      headers: dshHeaders(),
      payload: {
        expectedRevision: application.revision,
        state: "preparing",
        effectiveDate: "2026-09-02",
        note: "Synthetic DSH-assisted local tracking update.",
      },
    });
    expect(dshWithoutApproval.statusCode).toBe(403);
    expect(dshWithoutApproval.json<ErrorBody>().error.code).toBe(
      "approval_required",
    );
    const applicationApproval = await decide(
      (
        await post("/api/v1/approvals", {
          effectKind: "application.transition",
          targetId: application.id,
          expectedRevision: application.revision,
          applicationTransition: {
            state: "preparing",
            effectiveDate: "2026-09-02",
            note: "Synthetic DSH-assisted local tracking update.",
          },
        })
      ).json<Approval>(),
      "approved",
    );
    const alteredEffect = await server.inject({
      method: "POST",
      url: `/api/v1/applications/${application.id}/transitions`,
      headers: dshHeaders(),
      payload: {
        expectedRevision: application.revision,
        state: "preparing",
        effectiveDate: "2026-09-02",
        note: "A different note was not approved.",
        approvalId: applicationApproval.id,
        expectedApprovalRevision: applicationApproval.revision,
      },
    });
    expect(alteredEffect.statusCode).toBe(409);
    expect(alteredEffect.json<ErrorBody>().error.code).toBe("approval_stale");
    const exactTransition = await server.inject({
      method: "POST",
      url: `/api/v1/applications/${application.id}/transitions`,
      headers: dshHeaders(),
      payload: {
        expectedRevision: application.revision,
        state: "preparing",
        effectiveDate: "2026-09-02",
        note: "Synthetic DSH-assisted local tracking update.",
        approvalId: applicationApproval.id,
        expectedApprovalRevision: applicationApproval.revision,
      },
    });
    expect(exactTransition.statusCode, exactTransition.body).toBe(200);
    expect(exactTransition.json()).toMatchObject({
      state: "preparing",
      revision: application.revision + 1,
    });

    const missing = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision,
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json<ErrorBody>().error.code).toBe("approval_required");

    const denied = await decide(await requestApproval(draft), "denied");
    expect(denied).toMatchObject({ state: "denied", revision: 2 });
    const deniedUse = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision,
      approvalId: denied.id,
      expectedApprovalRevision: denied.revision,
    });
    expect(deniedUse.statusCode).toBe(403);
    expect(deniedUse.json<ErrorBody>().error.code).toBe("approval_denied");

    const approvedForBinding = await decide(
      await requestApproval(draft),
      "approved",
    );
    expect(approvedForBinding.approvingInteractionId).toMatch(/^command_/u);
    const wrongRevision = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision + 1,
      approvalId: approvedForBinding.id,
      expectedApprovalRevision: approvedForBinding.revision,
    });
    expect(wrongRevision.statusCode).toBe(409);
    expect(wrongRevision.json<ErrorBody>().error.code).toBe("approval_stale");
    const staleDecision = await post(
      `/api/v1/approvals/${approvedForBinding.id}/decision`,
      { expectedRevision: 1, decision: "denied" },
    );
    expect(staleDecision.statusCode).toBe(409);
    expect(staleDecision.json<ErrorBody>().error.code).toBe("approval_stale");

    const expiring = await requestApproval(draft, 1);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const expiredUse = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision,
      approvalId: expiring.id,
      expectedApprovalRevision: expiring.revision,
    });
    expect(expiredUse.statusCode).toBe(409);
    expect(expiredUse.json<ErrorBody>().error.code).toBe("approval_stale");
    const expired = (
      await server.inject({ method: "GET", url: "/api/v1/approvals" })
    )
      .json<{ approvals: Approval[] }>()
      .approvals.find((item) => item.id === expiring.id);
    expect(expired).toMatchObject({ state: "expired", revision: 2 });

    const durableApproval = await decide(
      await requestApproval(draft),
      "approved",
    );
    await server.close();
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("APPR0VA110"),
    });
    const afterRestart = (
      await server.inject({ method: "GET", url: "/api/v1/approvals" })
    )
      .json<{ approvals: Approval[] }>()
      .approvals.find((item) => item.id === durableApproval.id);
    expect(afterRestart).toEqual(durableApproval);

    const reviewed = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision,
      approvalId: durableApproval.id,
      expectedApprovalRevision: durableApproval.revision,
    });
    expect(reviewed.statusCode, reviewed.body).toBe(200);
    expect(reviewed.json()).toMatchObject({ state: "sealed", revision: 2 });

    const reused = await post(`/api/v1/artifacts/${draft.id}/review`, {
      expectedRevision: draft.revision,
      approvalId: durableApproval.id,
      expectedApprovalRevision: durableApproval.revision,
    });
    expect(reused.statusCode).toBe(409);
    expect(reused.json<ErrorBody>().error.code).toBe("approval_stale");

    const approvalAfterUse = (
      await server.inject({ method: "GET", url: "/api/v1/approvals" })
    )
      .json<{ approvals: Approval[] }>()
      .approvals.find((item) => item.id === durableApproval.id);
    expect(approvalAfterUse).toMatchObject({ state: "consumed", revision: 3 });

    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      events: {
        eventKind: string;
        aggregateId: string;
        commandId: string;
      }[];
    }>();
    const consumed = snapshot.events.find(
      (item) =>
        item.eventKind === "approval.consumed" &&
        item.aggregateId === durableApproval.id,
    );
    const reviewedEvent = snapshot.events.find(
      (item) =>
        item.eventKind === "artifact.reviewed" && item.aggregateId === draft.id,
    );
    expect(consumed?.commandId).toBe(durableApproval.commandId);
    expect(reviewedEvent?.commandId).toBe(durableApproval.commandId);
    expect(snapshot.events.map((item) => item.eventKind)).toEqual(
      expect.arrayContaining([
        "approval.requested",
        "approval.approved",
        "approval.denied",
        "approval.expired",
        "approval.consumed",
      ]),
    );
  });
});
