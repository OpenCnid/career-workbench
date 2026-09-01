import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";
import { createServer } from "../../apps/server/src/server.js";

const CSRF = "synthetic-csrf-proof-0000000000000000";
const HOST = "127.0.0.1:4173";

interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

interface Identified {
  readonly id: string;
  readonly revision: number;
}

describe("local /api/v1 boundary", () => {
  let parent: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-api-"));
    server = await createServer({
      workspaceRoot: join(parent, "workspace"),
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("SYN7HAP100"),
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(parent, { recursive: true, force: true });
  });

  function mutationHeaders(key?: string): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      cookie: `cw_csrf=${CSRF}`,
      "x-cw-csrf": CSRF,
      "x-idempotency-key":
        key ?? `synthetic-idempotency-${String(serial).padStart(4, "0")}`,
      "sec-fetch-site": "same-origin",
    };
  }

  async function injectMutation(
    url: string,
    payload: string | Readonly<Record<string, unknown>>,
    key?: string,
  ) {
    return await server.inject({
      method: "POST",
      url,
      headers: mutationHeaders(key),
      payload,
    });
  }

  async function initialize(): Promise<Identified> {
    const response = await injectMutation("/api/v1/workspaces", {
      displayName: "Synthetic API Workspace",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<Identified>();
  }

  it("serves a no-store CSRF session and an empty versioned snapshot", async () => {
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
    });
    expect(session.statusCode).toBe(200);
    expect(session.headers["cache-control"]).toBe("no-store");
    expect(session.headers["set-cookie"]).toContain("HttpOnly");
    expect(session.json()).toEqual({ contractVersion: "v1", csrfToken: CSRF });

    const snapshot = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    expect(snapshot.json()).toMatchObject({
      contractVersion: "v1",
      workspace: null,
      events: [],
    });
  });

  it("atomically creates guided identity, target preferences, and a selected rubric", async () => {
    const response = await injectMutation("/api/v1/workspaces", {
      displayName: "AI Engineering Search",
      candidateName: "Morgan Example",
      targetRole: "Senior Software Engineer focused on AI platforms",
      targetPriorities: "Hands-on AI systems and strong engineering culture",
      locationPreference: "Remote in the United States",
      deferTargetPreferences: false,
      rubricPreset: "balanced_fit",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    expect(response.statusCode, response.body).toBe(201);
    expect(
      response.json<{ readonly defaultRubricId: string }>().defaultRubricId,
    ).toMatch(/^rubric_/u);

    const snapshot = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    const body = snapshot.json<{
      readonly sources: readonly {
        readonly trustClass: string;
        readonly originalLocator: string;
      }[];
      readonly profileFacts: readonly {
        readonly factType: string;
        readonly status: string;
        readonly confirmedByUserAt: string | null;
      }[];
      readonly rubrics: readonly { readonly name: string }[];
    }>();
    expect(body.sources).toEqual([
      expect.objectContaining({
        trustClass: "candidate_primary",
        originalLocator: "user-entry://onboarding/preferences",
      }),
    ]);
    expect(body.profileFacts).toHaveLength(4);
    expect(body.profileFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factType: "identity", status: "verified" }),
        expect.objectContaining({ factType: "preference", status: "verified" }),
      ]),
    );
    expect(
      body.profileFacts.every((fact) => fact.confirmedByUserAt !== null),
    ).toBe(true);
    expect(body.rubrics).toEqual([
      expect.objectContaining({ name: "Balanced fit" }),
    ]);
  });

  it("fails guided setup closed when no target or explicit deferral is provided", async () => {
    const response = await injectMutation("/api/v1/workspaces", {
      displayName: "Incomplete Guided Setup",
      candidateName: "Morgan Example",
      deferTargetPreferences: false,
      rubricPreset: "balanced_fit",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error).toMatchObject({
      code: "invalid_request",
      message: "Choose a target role or explicitly defer target preferences.",
    });
    const snapshot = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    expect(
      snapshot.json<{ readonly workspace: unknown }>().workspace,
    ).toBeNull();
  });

  it("atomically turns a guided history entry into a primary source and reviewable claims", async () => {
    await initialize();
    const response = await injectMutation(
      "/api/v1/profile/history-entries",
      {
        personName: "Avery Example",
        roleTitle: "Software Engineer",
        organization: "Synthetic Systems",
        dateRange: "2021 to 2024",
        achievements: [
          "built TypeScript services",
          "reduced synthetic onboarding time by 30%",
        ],
      },
      "synthetic-career-history-0001",
    );
    expect(response.statusCode).toBe(201);
    const body = response.json<{
      readonly source: { readonly id: string; readonly inlineText: string };
      readonly facts: readonly {
        readonly id: string;
        readonly predicate: string;
        readonly value: string;
        readonly status: string;
        readonly sourceLocators: readonly {
          readonly sourceId: string;
          readonly start: number;
          readonly end: number;
          readonly quote: string;
        }[];
      }[];
    }>();
    expect(body.facts).toHaveLength(3);
    expect(body.facts.map((fact) => fact.status)).toEqual([
      "proposed",
      "proposed",
      "proposed",
    ]);
    expect(body.facts[1]).toMatchObject({
      predicate: "built",
      value: "TypeScript services",
    });
    for (const fact of body.facts) {
      const locator = fact.sourceLocators[0];
      expect(locator?.sourceId).toBe(body.source.id);
      expect(body.source.inlineText.slice(locator?.start, locator?.end)).toBe(
        locator?.quote,
      );
    }

    const repeated = await injectMutation(
      "/api/v1/profile/history-entries",
      {
        personName: "Avery Example",
        roleTitle: "Software Engineer",
        organization: "Synthetic Systems",
        dateRange: "2021 to 2024",
        achievements: [
          "built TypeScript services",
          "reduced synthetic onboarding time by 30%",
        ],
      },
      "synthetic-career-history-0001",
    );
    expect(repeated.json()).toEqual(body);

    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      readonly sources: readonly unknown[];
      readonly profileFacts: readonly unknown[];
    }>();
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.profileFacts).toHaveLength(3);
  });

  it("rejects a local evaluation when only identity and preference facts are verified", async () => {
    const setup = await injectMutation("/api/v1/workspaces", {
      displayName: "Synthetic Preference-Only Workspace",
      candidateName: "Avery Example",
      targetRole: "Senior AI Platform Engineer",
      deferTargetPreferences: false,
      rubricPreset: "balanced_fit",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    expect(setup.statusCode, setup.body).toBe(201);
    const jobSource = (
      await injectMutation("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: "Synthetic Labs needs a Senior AI Platform Engineer.",
        originalLocator: "https://example.test/jobs/ai-platform",
      })
    ).json<Identified>();
    const opportunity = (
      await injectMutation("/api/v1/opportunities", {
        sourceDocumentId: jobSource.id,
        organization: "Synthetic Labs",
        roleTitle: "Senior AI Platform Engineer",
        originalUrl: "https://example.test/jobs/ai-platform",
        location: "Remote",
        workArrangement: "remote",
      })
    ).json<Identified>();

    const response = await injectMutation("/api/v1/evaluations/fixture", {
      opportunityId: opportunity.id,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorBody>().error).toMatchObject({
      code: "evidence_unsupported",
      message:
        "Local demonstration requires a verified experience or achievement fact.",
    });
    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      readonly evidence: readonly unknown[];
      readonly evaluations: readonly unknown[];
    }>();
    expect(snapshot.evidence).toEqual([]);
    expect(snapshot.evaluations).toEqual([]);
  });

  it("persists the full HTTP fixture flow and reports ordered activity", async () => {
    await initialize();
    const sourceResponse = await injectMutation("/api/v1/sources", {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: "Avery Example built TypeScript services",
      originalLocator: "user-entry://synthetic",
    });
    expect(sourceResponse.statusCode).toBe(201);
    const source = sourceResponse.json<Identified>();

    const factResponse = await injectMutation("/api/v1/profile-facts", {
      factType: "experience",
      subject: "Avery Example",
      predicate: "built",
      value: "TypeScript services",
      sourceLocators: [
        {
          sourceId: source.id,
          start: 0,
          end: 39,
          quote: "Avery Example built TypeScript services",
        },
      ],
      proposedBy: "user",
    });
    expect(factResponse.statusCode).toBe(201);
    const fact = factResponse.json<Identified>();
    expect(
      (
        await injectMutation(`/api/v1/profile-facts/${fact.id}/confirm`, {
          expectedRevision: fact.revision,
          outcome: { kind: "confirm" },
        })
      ).statusCode,
    ).toBe(200);

    const jobSource = (
      await injectMutation("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: "Synthetic Labs needs a Platform Engineer to build TypeScript services.",
        originalLocator: "https://example.test/jobs/platform",
      })
    ).json<Identified>();
    const opportunity = (
      await injectMutation("/api/v1/opportunities", {
        sourceDocumentId: jobSource.id,
        organization: "Synthetic Labs",
        roleTitle: "Platform Engineer",
        originalUrl: "https://example.test/jobs/platform",
        location: "Remote",
        workArrangement: "remote",
      })
    ).json<Identified>();
    const evaluationResponse = await injectMutation(
      "/api/v1/evaluations/fixture",
      { opportunityId: opportunity.id },
    );
    expect(evaluationResponse.statusCode).toBe(201);
    const evaluation = evaluationResponse.json<
      Identified & { readonly displayScore: string }
    >();
    expect(evaluation.displayScore).toBe("78");
    const artifactResponse = await injectMutation(
      `/api/v1/evaluations/${evaluation.id}/artifacts`,
      {},
    );
    expect(artifactResponse.statusCode).toBe(201);

    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      readonly evaluations: readonly { readonly state: string }[];
      readonly artifacts: readonly { readonly state: string }[];
      readonly events: readonly { readonly sequence: number }[];
    }>();
    expect(snapshot.evaluations).toHaveLength(1);
    expect(snapshot.artifacts[0]?.state).toBe("sealed");
    expect(
      snapshot.events.every(
        (event, index) =>
          index === 0 ||
          event.sequence > (snapshot.events[index - 1]?.sequence ?? 0),
      ),
    ).toBe(true);

    const after = snapshot.events[2]?.sequence ?? 0;
    const resumed = (
      await server.inject({
        method: "GET",
        url: `/api/v1/events?after=${String(after)}&limit=2`,
      })
    ).json<{
      readonly events: readonly { readonly sequence: number }[];
    }>();
    expect(resumed.events).toHaveLength(2);
    expect(resumed.events[0]?.sequence).toBeGreaterThan(after);
    const before = snapshot.events.at(-1)?.sequence ?? 1;
    const historical = (
      await server.inject({
        method: "GET",
        url: `/api/v1/events?before=${String(before)}&limit=2`,
      })
    ).json<{
      readonly events: readonly { readonly sequence: number }[];
    }>();
    expect(historical.events).toHaveLength(2);
    expect(historical.events.at(-1)?.sequence).toBeLessThan(before);
    expect(historical.events[0]?.sequence).toBeLessThan(
      historical.events[1]?.sequence ?? 0,
    );
  });

  it("rejects cross-origin, missing-CSRF, wrong media type, and missing idempotency proof", async () => {
    const base = {
      method: "POST" as const,
      url: "/api/v1/workspaces",
      payload: { displayName: "Synthetic", locale: "en-US", timezone: "UTC" },
    };
    const crossOrigin = await server.inject({
      ...base,
      headers: { ...mutationHeaders(), origin: "https://hostile.example" },
    });
    expect(crossOrigin.json<ErrorBody>().error.code).toBe(
      "external_content_rejected",
    );
    const missingCsrf = await server.inject({
      ...base,
      headers: { ...mutationHeaders(), "x-cw-csrf": "wrong" },
    });
    expect(missingCsrf.statusCode).toBe(403);
    const media = await server.inject({
      ...base,
      headers: { ...mutationHeaders(), "content-type": "text/plain" },
    });
    expect(media.json<ErrorBody>().error.code).toBe("invalid_request");
    const noIdentity = mutationHeaders();
    delete noIdentity["x-idempotency-key"];
    const identity = await server.inject({ ...base, headers: noIdentity });
    expect(identity.json<ErrorBody>().error.code).toBe("invalid_request");
  });

  it("rejects unknown and duplicate JSON fields before domain code", async () => {
    const unknown = await injectMutation("/api/v1/workspaces", {
      displayName: "Synthetic",
      locale: "en-US",
      timezone: "UTC",
      injected: "untrusted instructions",
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json<ErrorBody>().error.code).toBe("invalid_request");

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: mutationHeaders(),
      payload:
        '{"displayName":"Synthetic","displayName":"Changed","locale":"en-US","timezone":"UTC"}',
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json<ErrorBody>().error.code).toBe("invalid_request");
  });

  it("enforces optimistic revisions and idempotency identity", async () => {
    await initialize();
    const key = "synthetic-repeat-identity-0001";
    const body = {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: "Avery Example built TypeScript services",
    };
    const first = await injectMutation("/api/v1/sources", body, key);
    const repeated = await injectMutation("/api/v1/sources", body, key);
    expect(repeated.json<Identified>().id).toBe(first.json<Identified>().id);
    const changed = await injectMutation(
      "/api/v1/sources",
      { ...body, text: "Changed synthetic input" },
      key,
    );
    expect(changed.statusCode).toBe(409);

    const source = first.json<Identified>();
    const fact = (
      await injectMutation("/api/v1/profile-facts", {
        factType: "experience",
        subject: "Avery Example",
        predicate: "built",
        value: "TypeScript services",
        sourceLocators: [
          {
            sourceId: source.id,
            start: 0,
            end: 39,
            quote: "Avery Example built TypeScript services",
          },
        ],
        proposedBy: "user",
      })
    ).json<Identified>();
    const stale = await injectMutation(
      `/api/v1/profile-facts/${fact.id}/confirm`,
      { expectedRevision: fact.revision + 1, outcome: { kind: "confirm" } },
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json<ErrorBody>().error.code).toBe("revision_conflict");
  });

  it("corrects a proposed fact and rejects a stale retry before creating a source", async () => {
    await initialize();
    const source = (
      await injectMutation("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: "Avery Example built TypeScript services",
      })
    ).json<Identified>();
    const fact = (
      await injectMutation("/api/v1/profile-facts", {
        factType: "experience",
        subject: "Avery Example",
        predicate: "built",
        value: "TypeScript services",
        sourceLocators: [
          {
            sourceId: source.id,
            start: 0,
            end: 39,
            quote: "Avery Example built TypeScript services",
          },
        ],
        proposedBy: "user",
      })
    ).json<Identified>();

    const correction = await injectMutation(
      `/api/v1/profile-facts/${fact.id}/corrections`,
      {
        expectedRevision: fact.revision,
        value: "JavaScript services",
        sourceText: "Avery Example built JavaScript services",
      },
    );
    expect(correction.statusCode).toBe(200);
    const afterCorrection = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      readonly profileFacts: readonly {
        readonly supersedesFactId: string | null;
        readonly status: string;
        readonly value: unknown;
      }[];
      readonly sources: readonly unknown[];
    }>();
    expect(afterCorrection.profileFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "superseded",
          value: "TypeScript services",
        }),
        expect.objectContaining({
          status: "verified",
          supersedesFactId: fact.id,
          value: "JavaScript services",
        }),
      ]),
    );
    expect(afterCorrection.sources).toHaveLength(2);

    const stale = await injectMutation(
      `/api/v1/profile-facts/${fact.id}/corrections`,
      {
        expectedRevision: fact.revision,
        value: "Rust services",
        sourceText: "Avery Example built Rust services",
      },
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json<ErrorBody>().error.code).toBe("revision_conflict");
    const afterStaleRetry = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{ readonly sources: readonly unknown[] }>();
    expect(afterStaleRetry.sources).toHaveLength(2);
  });

  it("distinguishes unsupported methods, unknown routes, and malformed cursors", async () => {
    await initialize();
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/api/v1/snapshot",
          headers: mutationHeaders(),
          payload: {},
        })
      ).statusCode,
    ).toBe(405);
    expect(
      (await server.inject({ method: "GET", url: "/api/v1/not-real" }))
        .statusCode,
    ).toBe(404);
    const malformed = await server.inject({
      method: "GET",
      url: "/api/v1/events?after=NaN",
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json<ErrorBody>().error.code).toBe("invalid_request");
  });

  it("delivers real ordered SSE frames from the resume cursor", async () => {
    await initialize();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected TCP server address.");
    const controller = new AbortController();
    const response = await fetch(
      `http://127.0.0.1:${String(address.port)}/api/v1/events/stream?after=0`,
      { signal: controller.signal },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error("Expected SSE response body.");
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("SSE frame timeout")), 5_000);
    });
    const first = await Promise.race([reader.read(), timeout]);
    const frame = new TextDecoder().decode(first.value);
    expect(frame).toContain("id: 1");
    expect(frame).toContain("event: domain");
    expect(frame).toContain('"eventKind":"workspace.created"');
    controller.abort();
  });

  it("disconnects an active stream on restart and resumes from persisted sequence", async () => {
    await initialize();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const firstAddress = server.server.address();
    if (firstAddress === null || typeof firstAddress === "string")
      throw new Error("Expected TCP server address.");
    const port = firstAddress.port;
    const firstController = new AbortController();
    const firstResponse = await fetch(
      `http://127.0.0.1:${String(port)}/api/v1/events/stream?after=0`,
      { signal: firstController.signal },
    );
    const firstReader = firstResponse.body?.getReader();
    if (firstReader === undefined) throw new Error("Expected first SSE body.");
    const firstFrame = new TextDecoder().decode(
      (await firstReader.read()).value,
    );
    expect(firstFrame).toContain("id: 1");

    await server.close();
    firstController.abort();
    server = await createServer({
      workspaceRoot: join(parent, "workspace"),
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("RE57AR7000"),
    });
    await server.listen({ host: "127.0.0.1", port });
    const source = await injectMutation("/api/v1/sources", {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: "Synthetic reconnect evidence",
    });
    expect(source.statusCode).toBe(201);

    const resumedController = new AbortController();
    const resumedResponse = await fetch(
      `http://127.0.0.1:${String(port)}/api/v1/events/stream?after=1`,
      { signal: resumedController.signal },
    );
    const resumedReader = resumedResponse.body?.getReader();
    if (resumedReader === undefined)
      throw new Error("Expected resumed SSE body.");
    const resumedFrame = new TextDecoder().decode(
      (await resumedReader.read()).value,
    );
    expect(resumedFrame).toContain("id: 2");
    expect(resumedFrame).toContain('"eventKind":"source.captured"');
    resumedController.abort();
  });
});
