import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../apps/server/src/server.js";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";
import type {
  DiscoveryLead,
  Opportunity,
  Operation,
  SearchProfile,
  SourceDocument,
} from "../../packages/domain/src/index.js";

const CSRF = "synthetic-discovery-csrf-000000000000";
const DSH_TOKEN = "synthetic-discovery-dsh-token-000000000000";
const DSH_SESSION = "synthetic-discovery-session";
const HOST = "127.0.0.1:4173";

interface Snapshot {
  readonly searchProfiles: readonly SearchProfile[];
  readonly discoveryLeads: readonly DiscoveryLead[];
  readonly opportunities: readonly Opportunity[];
  readonly sources: readonly SourceDocument[];
  readonly operations: readonly Operation[];
}

describe("search profile and DSH discovery inbox", () => {
  let parent: string | null = null;
  let server: Awaited<ReturnType<typeof createServer>> | null = null;
  let serial = 0;

  afterEach(async () => {
    await server?.close();
    if (parent !== null) await rm(parent, { recursive: true, force: true });
  });

  function browserHeaders(): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      cookie: `cw_csrf=${CSRF}`,
      "x-cw-csrf": CSRF,
      "x-idempotency-key": `synthetic-discovery-browser-${String(serial)}`,
      "sec-fetch-site": "same-origin",
    };
  }

  function dshHeaders(operationId?: string): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      authorization: `CW-DSH ${DSH_TOKEN}`,
      "content-type": "application/json",
      "x-cw-dsh-session": DSH_SESSION,
      "x-idempotency-key": `synthetic-discovery-dsh-${String(serial)}`,
      ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
    };
  }

  async function snapshot(): Promise<Snapshot> {
    if (server === null) throw new Error("Synthetic server is not running.");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<Snapshot>();
  }

  it("persists user-owned criteria, admits only DSH ingestion, deduplicates, and promotes only by user triage", async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-discovery-"));
    const workspaceRoot = join(parent, "workspace");
    server = await createServer({
      workspaceRoot,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("SYN7HD5C00"),
    });

    const workspace = await server.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: browserHeaders(),
      payload: {
        displayName: "Synthetic AI career search",
        candidateName: "Morgan Example",
        targetRole: "Senior Software Engineer · AI Platform Engineer",
        targetPriorities:
          "Production AI systems and strong engineering culture",
        locationPreference: "Remote in the United States",
        deferTargetPreferences: false,
        rubricPreset: "balanced_fit",
        locale: "en-US",
        timezone: "America/Chicago",
      },
    });
    expect(workspace.statusCode, workspace.body).toBe(201);

    const profileResponse = await server.inject({
      method: "POST",
      url: "/api/v1/search-profiles",
      headers: browserHeaders(),
      payload: {
        targetRoles: ["Senior Software Engineer", "AI Platform Engineer"],
        seniority: ["senior"],
        locations: ["United States"],
        workArrangements: ["remote", "hybrid"],
        minimumCompensation: 180000,
        compensationCurrency: "USD",
        aiFocus: "Production AI systems, evaluation, and agent infrastructure",
        priorities: ["Strong engineering culture", "Hands-on technical work"],
        exclusions: ["Commission-only roles"],
        active: true,
      },
    });
    expect(profileResponse.statusCode, profileResponse.body).toBe(200);
    const profile = profileResponse.json<SearchProfile>();

    const operationResponse = await server.inject({
      method: "POST",
      url: "/api/v1/operations",
      headers: dshHeaders(),
      payload: {
        kind: "job_discovery",
        inputIdentity: profile.id,
        requestedCapabilities: ["external_research", "discovery_lead.record"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    });
    expect(operationResponse.statusCode, operationResponse.body).toBe(201);
    const operation = operationResponse.json<Operation>();
    expect(operation).toMatchObject({
      kind: "job_discovery",
      state: "running",
      inputRevision: profile.revision,
      resourceLimits: {
        maximumLeads: 64,
        maximumLeadsPerHost: 20,
        maximumSourceBytes: 8 * 1024 * 1024,
      },
    });
    expect(operation.inputDigest).toMatch(/^[a-f0-9]{64}$/u);

    const postingText =
      "Synthetic Systems seeks a Senior AI Platform Engineer to build production evaluation and agent infrastructure. Remote in the United States. Salary $190,000-$230,000.";
    const leadPayload = {
      organization: "Synthetic Systems",
      roleTitle: "Senior AI Platform Engineer",
      originalUrl:
        "https://jobs.example.test/roles/ai-platform?utm_source=fixture",
      postingText,
      location: "United States",
      workArrangement: "remote",
      advertisedCompensation: "$190,000-$230,000",
      requisitionId: "SYN-AI-42",
      whyFound: [
        "The title and production AI scope match the saved direction.",
      ],
      matchedCriteria: ["Senior", "Remote", "AI platform"],
      gaps: ["On-call expectations are not stated."],
      risks: ["Posting liveness has not yet been independently confirmed."],
    };

    for (const originalUrl of [
      "https://synthetic-user:synthetic-password@jobs.example.test/private",
      "https://jobs.example.test/private?access_token=synthetic-secret",
      "https://jobs.example.test/private?signature=synthetic-signature",
    ]) {
      const unsafeUrl = await server.inject({
        method: "POST",
        url: "/api/v1/discovery-leads",
        headers: dshHeaders(operation.id),
        payload: { ...leadPayload, originalUrl },
      });
      expect(unsafeUrl.statusCode, unsafeUrl.body).toBe(400);
    }

    const browserForgery = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: browserHeaders(),
      payload: leadPayload,
    });
    expect(browserForgery.statusCode).toBe(403);

    const leadResponse = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(operation.id),
      payload: leadPayload,
    });
    expect(leadResponse.statusCode, leadResponse.body).toBe(201);
    const lead = leadResponse.json<DiscoveryLead>();
    expect(lead).toMatchObject({
      state: "new",
      operationId: operation.id,
      searchProfileId: profile.id,
      searchProfileRevision: profile.revision,
      searchCriteriaDigest: operation.inputDigest,
      normalizedUrl: "https://jobs.example.test/roles/ai-platform",
    });

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(operation.id),
      payload: {
        ...leadPayload,
        originalUrl:
          "https://jobs.example.test/roles/ai-platform?utm_campaign=again",
      },
    });
    expect(duplicate.statusCode).toBe(409);

    const recordedLeadIds = [lead.id];
    for (let index = 2; index <= 20; index += 1) {
      const boundedLead = await server.inject({
        method: "POST",
        url: "/api/v1/discovery-leads",
        headers: dshHeaders(operation.id),
        payload: {
          ...leadPayload,
          originalUrl: `https://jobs.example.test/roles/ai-platform-${String(index)}`,
          requisitionId: `SYN-AI-${String(index)}`,
        },
      });
      expect(boundedLead.statusCode, boundedLead.body).toBe(201);
      recordedLeadIds.push(boundedLead.json<DiscoveryLead>().id);
    }
    const hostLimit = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(operation.id),
      payload: {
        ...leadPayload,
        originalUrl: "https://jobs.example.test/roles/host-limit",
        requisitionId: "SYN-AI-HOST-LIMIT",
      },
    });
    expect(hostLimit.statusCode, hostLimit.body).toBe(400);

    const beforeRediscovery = await snapshot();
    const priorVersion = beforeRediscovery.discoveryLeads.find(
      (item) => item.id === recordedLeadIds[1],
    );
    if (priorVersion === undefined)
      throw new Error("Synthetic rediscovery lead is missing.");
    const rediscoveryOperationResponse = await server.inject({
      method: "POST",
      url: "/api/v1/operations",
      headers: dshHeaders(),
      payload: {
        kind: "job_discovery",
        inputIdentity: profile.id,
        requestedCapabilities: ["external_research", "discovery_lead.record"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    });
    expect(
      rediscoveryOperationResponse.statusCode,
      rediscoveryOperationResponse.body,
    ).toBe(201);
    const rediscoveryOperation = rediscoveryOperationResponse.json<Operation>();
    const rediscoveredResponse = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(rediscoveryOperation.id),
      payload: {
        ...leadPayload,
        originalUrl: "https://jobs.example.test/roles/ai-platform-2",
        postingText: `${postingText} Updated synthetic responsibilities.`,
        requisitionId: "SYN-AI-2",
      },
    });
    expect(rediscoveredResponse.statusCode, rediscoveredResponse.body).toBe(
      201,
    );
    const rediscovered = rediscoveredResponse.json<DiscoveryLead>();
    expect(rediscovered).toMatchObject({
      id: priorVersion.id,
      revision: priorVersion.revision + 1,
      state: "new",
    });
    expect(rediscovered.sourceDocumentId).not.toBe(
      priorVersion.sourceDocumentId,
    );
    const rediscoveryTerminal = await server.inject({
      method: "POST",
      url: `/api/v1/operations/${rediscoveryOperation.id}/terminal`,
      headers: dshHeaders(rediscoveryOperation.id),
      payload: {
        expectedRevision: rediscoveryOperation.revision,
        state: "succeeded",
        category: "completed",
        message: "Synthetic changed listing rediscovered in a later run.",
        resultIds: [rediscovered.id],
        artifactIds: [],
      },
    });
    expect(rediscoveryTerminal.statusCode, rediscoveryTerminal.body).toBe(200);

    const changedProfileResponse = await server.inject({
      method: "POST",
      url: "/api/v1/search-profiles",
      headers: browserHeaders(),
      payload: {
        expectedRevision: profile.revision,
        targetRoles: profile.targetRoles,
        seniority: profile.seniority,
        locations: profile.locations,
        workArrangements: profile.workArrangements,
        minimumCompensation: profile.minimumCompensation,
        compensationCurrency: profile.compensationCurrency,
        aiFocus: profile.aiFocus,
        priorities: [...profile.priorities, "AI-forward product direction"],
        exclusions: profile.exclusions,
        active: true,
      },
    });
    expect(changedProfileResponse.statusCode, changedProfileResponse.body).toBe(
      200,
    );
    const changedProfile = changedProfileResponse.json<SearchProfile>();
    const staleOperationWrite = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(operation.id),
      payload: {
        ...leadPayload,
        originalUrl: "https://jobs.example.test/roles/stale-search",
      },
    });
    expect(staleOperationWrite.statusCode, staleOperationWrite.body).toBe(409);

    const beforeTriage = await snapshot();
    expect(beforeTriage.discoveryLeads).toHaveLength(20);
    expect(beforeTriage.opportunities).toHaveLength(0);
    const capturedSource = beforeTriage.sources.find(
      (source) => source.id === lead.sourceDocumentId,
    );
    expect(capturedSource).toMatchObject({
      trustClass: "external",
      inlineText: postingText,
      originalLocator: leadPayload.originalUrl,
    });
    expect(
      beforeTriage.sources.find(
        (source) => source.id === rediscovered.sourceDocumentId,
      ),
    ).toMatchObject({ supersedesSourceId: priorVersion.sourceDocumentId });

    const exported = await server.inject({
      method: "GET",
      url: "/api/v1/export",
    });
    expect(exported.statusCode, exported.body).toBe(200);
    expect(exported.body).not.toContain(leadPayload.originalUrl);
    expect(exported.body).not.toMatch(
      /"(?:originalUrl|normalizedUrl|originalLocator)":"https?:/u,
    );

    const dshCannotShortlist = await server.inject({
      method: "POST",
      url: `/api/v1/discovery-leads/${lead.id}/triage`,
      headers: dshHeaders(operation.id),
      payload: { expectedRevision: lead.revision, decision: "shortlisted" },
    });
    expect(dshCannotShortlist.statusCode).toBe(403);

    const reconsideredLead = beforeTriage.discoveryLeads.find(
      (item) => item.id === recordedLeadIds[1],
    );
    if (reconsideredLead === undefined)
      throw new Error("Synthetic reconsideration lead is missing.");
    const dismissedResponse = await server.inject({
      method: "POST",
      url: `/api/v1/discovery-leads/${reconsideredLead.id}/triage`,
      headers: browserHeaders(),
      payload: {
        expectedRevision: reconsideredLead.revision,
        decision: "dismissed",
        note: "Synthetic first-pass dismissal.",
      },
    });
    expect(dismissedResponse.statusCode, dismissedResponse.body).toBe(200);
    const dismissedLead = dismissedResponse.json<{
      readonly lead: DiscoveryLead;
    }>().lead;
    const reopenedResponse = await server.inject({
      method: "POST",
      url: `/api/v1/discovery-leads/${reconsideredLead.id}/triage`,
      headers: browserHeaders(),
      payload: {
        expectedRevision: dismissedLead.revision,
        decision: "new",
        note: "Synthetic reconsideration after reviewing the source.",
      },
    });
    expect(reopenedResponse.statusCode, reopenedResponse.body).toBe(200);
    expect(
      reopenedResponse.json<{ readonly lead: DiscoveryLead }>().lead,
    ).toMatchObject({
      state: "new",
      triageNote: "Synthetic reconsideration after reviewing the source.",
    });

    const triageResponse = await server.inject({
      method: "POST",
      url: `/api/v1/discovery-leads/${lead.id}/triage`,
      headers: browserHeaders(),
      payload: { expectedRevision: lead.revision, decision: "shortlisted" },
    });
    expect(triageResponse.statusCode, triageResponse.body).toBe(200);
    const triaged = triageResponse.json<{
      readonly lead: DiscoveryLead;
      readonly opportunity: Opportunity;
    }>();
    expect(triaged.lead).toMatchObject({
      state: "shortlisted",
      resultOpportunityId: triaged.opportunity.id,
    });
    expect(triaged.opportunity).toMatchObject({
      workflowState: "shortlisted",
      sourceDocumentId: lead.sourceDocumentId,
      sourceContentDigest: lead.sourceContentDigest,
    });

    const invalidTerminal = await server.inject({
      method: "POST",
      url: `/api/v1/operations/${operation.id}/terminal`,
      headers: dshHeaders(operation.id),
      payload: {
        expectedRevision: operation.revision,
        state: "succeeded",
        category: "completed",
        message: "Synthetic invalid discovery result identity.",
        resultIds: [profile.id],
        artifactIds: [],
      },
    });
    expect(invalidTerminal.statusCode).toBe(404);

    const terminal = await server.inject({
      method: "POST",
      url: `/api/v1/operations/${operation.id}/terminal`,
      headers: dshHeaders(operation.id),
      payload: {
        expectedRevision: operation.revision,
        state: "succeeded",
        category: "completed",
        message:
          "Synthetic discovery completed with one source-preserved lead.",
        resultIds: recordedLeadIds.filter((id) => id !== rediscovered.id),
        artifactIds: [],
      },
    });
    expect(terminal.statusCode, terminal.body).toBe(200);

    const cancelableOperationResponse = await server.inject({
      method: "POST",
      url: "/api/v1/operations",
      headers: dshHeaders(),
      payload: {
        kind: "job_discovery",
        inputIdentity: changedProfile.id,
        requestedCapabilities: ["external_research", "discovery_lead.record"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    });
    expect(
      cancelableOperationResponse.statusCode,
      cancelableOperationResponse.body,
    ).toBe(201);
    const cancelableOperation = cancelableOperationResponse.json<Operation>();
    const cancellation = await server.inject({
      method: "POST",
      url: `/api/v1/operations/${cancelableOperation.id}/cancellation-requests`,
      headers: browserHeaders(),
      payload: {
        expectedRevision: cancelableOperation.revision,
        reason: "Synthetic user stopped this discovery run.",
      },
    });
    expect(cancellation.statusCode, cancellation.body).toBe(200);
    const canceledWrite = await server.inject({
      method: "POST",
      url: "/api/v1/discovery-leads",
      headers: dshHeaders(cancelableOperation.id),
      payload: {
        ...leadPayload,
        originalUrl: "https://jobs.example.test/roles/after-cancel",
      },
    });
    expect(canceledWrite.statusCode, canceledWrite.body).toBe(400);

    await server.close();
    server = await createServer({
      workspaceRoot,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("SYN7HD5C01"),
    });
    const afterRestart = await snapshot();
    expect(afterRestart.searchProfiles).toHaveLength(1);
    expect(afterRestart.discoveryLeads).toHaveLength(20);
    expect(afterRestart.opportunities).toHaveLength(1);
    expect(afterRestart.operations).toContainEqual(
      expect.objectContaining({ id: operation.id, state: "succeeded" }),
    );
  });
});
