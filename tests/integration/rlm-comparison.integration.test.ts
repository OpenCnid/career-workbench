import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import { mountAgentLoopTestDependencies } from "@deepseek-ai/dsh-agent-loop-testkit";
import {
  LlmAdapter,
  ReasoningEffortId,
  ToolCallId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import SessionQueryEngine from "@deepseek-ai/dsh-session-query";
import SubagentRuntime from "@deepseek-ai/dsh-subagent";
import * as SubagentSpawn from "@deepseek-ai/dsh-subagent-spawn-in-process";
import type { ToolExecutionResult } from "@deepseek-ai/dsh-tools";
import JupyterRlmRuntime from "@deepseek-rlm/dsh-rlm-jupyter";
import * as IpythonTool from "@deepseek-rlm/dsh-tool-ipython";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";
import {
  HttpCareerWorkbenchService,
  RLM_TOOL_NAMES,
} from "../../packages/dsh-plugin/src/index.js";
import * as CareerWorkbenchPlugin from "../../packages/dsh-plugin/src/index.js";
import { createServer } from "../../apps/server/src/server.js";
import { resolveUvDirectory } from "../support/runtime-tools.js";

const CSRF = "synthetic-rlm-csrf-000000000000000";
const DSH_TOKEN = "synthetic-rlm-dsh-token-000000000000000000";
const HOST = "127.0.0.1:4173";
const PROVIDER = "openai-codex";
const MODEL = "gpt-5.6-sol";

interface Identified {
  readonly id: string;
  readonly revision: number;
}

interface EvaluationProjection {
  readonly evaluationId: string;
  readonly dimensionValues: Readonly<Record<string, number>>;
}

class TestSessionQuery extends SessionQueryEngine {
  public override searchSessions(): Promise<never> {
    return Promise.reject(new Error("Search is not configured in this test."));
  }

  public override searchEvents(): Promise<never> {
    return Promise.reject(new Error("Search is not configured in this test."));
  }
}

class ModelOnlyAdapter extends LlmAdapter {
  public override resolveModel(
    provider: string,
    model: string,
  ): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [{ id: ReasoningEffortId("high"), name: "High" }],
        defaultEffort: ReasoningEffortId("high"),
      },
    });
  }

  public async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    options.signal?.throwIfAborted();
    await Promise.resolve();
    yield* [] as StreamChunk[];
    throw new Error("The RLM integration must not create a model loop.");
  }
}

function value(result: ToolExecutionResult): Record<string, unknown> {
  if (result.isError) {
    throw new Error(
      `${result.error.info?.code ?? "error"}: ${result.error.message}`,
    );
  }
  if (typeof result.value !== "object" || result.value === null) {
    throw new Error("Expected structured tool output.");
  }
  return result.value as Record<string, unknown>;
}

describe("native RLM comparison workflow", () => {
  let root: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "career-workbench-rlm-"));
    server = await createServer({
      workspaceRoot: join(root, "workspace"),
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      rlmEnabled: true,
      idFactory: new DeterministicIdFactory("R1MPR00F00"),
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  function browserHeaders(): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      cookie: `cw_csrf=${CSRF}`,
      "x-cw-csrf": CSRF,
      "x-idempotency-key": `synthetic-rlm-${String(serial).padStart(4, "0")}`,
      "sec-fetch-site": "same-origin",
    };
  }

  async function mutate(
    url: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<Identified> {
    const response = await server.inject({
      method: "POST",
      url,
      headers: browserHeaders(),
      payload: body,
    });
    expect(response.statusCode, `${url}: ${response.body}`).toBeLessThan(300);
    return response.json<Identified>();
  }

  async function mutateAsDsh(
    url: string,
    body: Readonly<Record<string, unknown>>,
    operationId?: string,
  ): Promise<Identified> {
    serial += 1;
    const response = await server.inject({
      method: "POST",
      url,
      headers: {
        host: HOST,
        authorization: `CW-DSH ${DSH_TOKEN}`,
        "content-type": "application/json",
        "x-cw-dsh-session": "00000000-0000-4000-8000-000000000051",
        "x-idempotency-key": `synthetic-rlm-dsh-${String(serial).padStart(4, "0")}`,
        ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
      },
      payload: body,
    });
    expect(response.statusCode, `${url}: ${response.body}`).toBeLessThan(300);
    return response.json<Identified>();
  }

  async function seedEvaluations(): Promise<Identified[]> {
    await mutate("/api/v1/workspaces", {
      displayName: "Synthetic RLM Workspace",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    const candidateText = "Avery Example built reliable TypeScript services";
    const source = await mutate("/api/v1/sources", {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: candidateText,
      originalLocator: "user-entry://synthetic-rlm",
    });
    const fact = await mutate("/api/v1/profile-facts", {
      factType: "experience",
      subject: "Avery Example",
      predicate: "built",
      value: "reliable TypeScript services",
      sourceLocators: [
        {
          sourceId: source.id,
          start: 0,
          end: candidateText.length,
          quote: candidateText,
        },
      ],
      proposedBy: "user",
    });
    await mutate(`/api/v1/profile-facts/${fact.id}/confirm`, {
      expectedRevision: fact.revision,
      outcome: { kind: "confirm" },
    });

    const opportunities: Identified[] = [];
    for (const [index, title] of [
      "Platform Engineer",
      "Developer Experience Engineer",
      "Staff TypeScript Engineer",
    ].entries()) {
      const text = `Synthetic Labs ${String(index + 1)} seeks a ${title}.`;
      const opportunitySource = await mutate("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text,
        originalLocator: `https://example.test/jobs/rlm-${String(index + 1)}`,
      });
      const opportunity = await mutate("/api/v1/opportunities", {
        sourceDocumentId: opportunitySource.id,
        organization: `Synthetic Labs ${String(index + 1)}`,
        roleTitle: title,
        originalUrl: `https://example.test/jobs/rlm-${String(index + 1)}`,
        location: "Remote",
        workArrangement: "remote",
      });
      opportunities.push(opportunity);
      await mutate("/api/v1/evaluations/fixture", {
        opportunityId: opportunity.id,
      });
    }

    const snapshot = (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{
      readonly rubrics: readonly Identified[];
      readonly evidence: readonly (Identified & {
        readonly decision: string;
      })[];
    }>();
    const rubric = snapshot.rubrics[0];
    const evidenceIds = snapshot.evidence
      .filter((item) => item.decision === "accepted")
      .slice(0, 2)
      .map((item) => item.id);
    if (rubric === undefined || evidenceIds.length === 0) {
      throw new Error("Synthetic RLM seed did not create accepted evidence.");
    }
    const values = [
      [9_000, 4_000],
      [7_000, 9_000],
      [6_000, 7_000],
    ] as const;
    return await Promise.all(
      opportunities.map(async (opportunity, index) => {
        const operation = await mutateAsDsh("/api/v1/operations", {
          kind: "evaluation",
          inputIdentity: opportunity.id,
          requestedCapabilities: ["evaluation.complete"],
          dshSessionId: "00000000-0000-4000-8000-000000000051",
          provider: PROVIDER,
          model: MODEL,
          reasoningEffort: "high",
          route: "ordinary_dsh",
        });
        return await mutateAsDsh(
          "/api/v1/evaluations",
          {
            opportunityId: opportunity.id,
            rubricId: rubric.id,
            operationId: operation.id,
            dimensionInputs: [
              {
                dimensionKey: "skills",
                semanticScoreBasisPoints: values[index]?.[0],
                evidenceIds,
                disposition: null,
              },
              {
                dimensionKey: "preferences",
                semanticScoreBasisPoints: values[index]?.[1],
                evidenceIds,
                disposition: null,
              },
            ],
          },
          operation.id,
        );
      }),
    );
  }

  async function execute(
    ctx: Context,
    agent: Agent,
    name: string,
    argumentsValue: Readonly<Record<string, unknown>>,
    callId: string,
  ): Promise<ToolExecutionResult> {
    return await ctx.tools.execute({
      callId: ToolCallId(callId),
      name,
      arguments: argumentsValue,
      agent,
      signal: new AbortController().signal,
    });
  }

  it("restores Python without replay and persists an explicitly accepted deterministic proposal", async () => {
    const evaluations = await seedEvaluations();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected a TCP server address.");
    }

    const previousPath = process.env["PATH"];
    const uvDirectory = await resolveUvDirectory();
    if (uvDirectory !== undefined) {
      process.env["PATH"] = `${uvDirectory}${delimiter}${previousPath ?? ""}`;
    }
    const ctx = new Context();
    await mountAgentLoopTestDependencies(ctx);
    const projectionFiber = await ctx.plugin(SessionProjectionRegistry);
    const queryFiber = await ctx.plugin(TestSessionQuery);
    const loopFiber = await ctx.plugin(AgentLoop, { agents: [] });
    const subagentsFiber = await ctx.plugin(SubagentRuntime);
    const spawnFiber = await ctx.plugin(SubagentSpawn, {
      providerName: "rlm-spawn",
    });
    ctx.llm.registerAdapter([PROVIDER], new ModelOnlyAdapter());
    const rlmFiber = await ctx.plugin(JupyterRlmRuntime, {
      artifactRoot: join(root, "rlm-artifacts"),
      managedRuntimeRoot: join(root, "rlm-runtime"),
      subagentProvider: "rlm-spawn",
      snapshot: {
        policy: "after-cell",
        maxBytes: 8 * 1024 * 1024,
        maxVariableBytes: 2 * 1024 * 1024,
      },
      maxOutputBytes: 256 * 1024,
      interruptGraceMs: 1_000,
      shutdownGraceMs: 5_000,
    });
    const serviceFiber = await ctx.plugin(HttpCareerWorkbenchService, {
      baseUrl: `http://127.0.0.1:${String(address.port)}/`,
      serviceToken: DSH_TOKEN,
      supportedModels: [
        { provider: PROVIDER, model: MODEL, reasoningEfforts: ["high"] },
      ],
    });
    const careerFiber = await ctx.plugin(CareerWorkbenchPlugin);
    const ipythonFiber = await ctx.plugin(IpythonTool);
    let rlmDisposed = false;
    const agent = ctx.agentLoop.create(
      SessionId("00000000-0000-4000-8000-000000000051"),
      {
        provider: PROVIDER,
        model: MODEL,
        reasoningEffort: ReasoningEffortId("high"),
      },
    );

    try {
      expect(ctx.tools.schemas().map((item) => item.name)).toEqual(
        expect.arrayContaining(["ipython", ...RLM_TOOL_NAMES]),
      );
      const started = value(
        await execute(
          ctx,
          agent,
          "career_workbench_start_comparison",
          {
            contractVersion: "v1",
            evaluationIds: evaluations.map((item) => item.id),
          },
          "rlm-start-comparison",
        ),
      );
      const operationId = String(started["operationId"]);
      expect(started).toMatchObject({
        route: "rlm",
        osAuthority: true,
        state: "running",
      });

      const assigned = value(
        await execute(
          ctx,
          agent,
          "ipython",
          { code: "x = 41" },
          "rlm-python-assign",
        ),
      );
      expect(assigned).toMatchObject({ status: "ok", generation: 1 });

      const projected = value(
        await execute(
          ctx,
          agent,
          "career_workbench_comparison_inputs",
          { contractVersion: "v1", operationId },
          "rlm-comparison-inputs",
        ),
      );
      const projections = projected[
        "evaluations"
      ] as readonly EvaluationProjection[];
      expect(projections).toHaveLength(3);
      const projectionsJson = JSON.stringify(projections);
      const pythonProposal = value(
        await execute(
          ctx,
          agent,
          "ipython",
          {
            code: [
              "import json",
              `evaluations = json.loads(${JSON.stringify(projectionsJson)})`,
              "proposal = {",
              `  'evaluationIds': [item['evaluationId'] for item in evaluations],`,
              "  'policyVersion': '1.0.0',",
              "  'scenarios': [",
              "    {'label': 'skills-forward', 'weightsBasisPoints': {'skills': 8000, 'preferences': 2000}},",
              "    {'label': 'preferences-forward', 'weightsBasisPoints': {'skills': 2000, 'preferences': 8000}},",
              "  ],",
              "  'tradeoffs': ['Skills leadership changes when preferences receive greater weight.'],",
              "}",
              "proposal_json = json.dumps(proposal, separators=(',', ':'), sort_keys=True)",
              "print(proposal_json)",
            ].join("\n"),
          },
          "rlm-python-sensitivity",
        ),
      );
      const proposal = JSON.parse(
        String(pythonProposal["stdout"]).trim(),
      ) as Record<string, unknown>;

      const snapshot = value(
        await execute(
          ctx,
          agent,
          "career_workbench_rlm_snapshot",
          { contractVersion: "v1", operationId },
          "rlm-snapshot",
        ),
      );
      expect(snapshot).toMatchObject({ available: true, generation: 1 });
      expect(snapshot).not.toHaveProperty("path");
      expect(snapshot).not.toHaveProperty("manifestPath");

      value(
        await execute(
          ctx,
          agent,
          "career_workbench_rlm_restart",
          { contractVersion: "v1", operationId },
          "rlm-restart",
        ),
      );
      const restored = value(
        await execute(
          ctx,
          agent,
          "ipython",
          { code: "x + 1" },
          "rlm-python-restored",
        ),
      );
      expect(restored).toMatchObject({
        status: "ok",
        result: "42",
        generation: 2,
      });
      const restoredProposal = value(
        await execute(
          ctx,
          agent,
          "ipython",
          { code: "print(proposal_json)" },
          "rlm-python-restored-proposal",
        ),
      );
      expect(JSON.parse(String(restoredProposal["stdout"]).trim())).toEqual(
        proposal,
      );

      const proposed = value(
        await execute(
          ctx,
          agent,
          "career_workbench_propose_comparison",
          {
            contractVersion: "v1",
            operationId,
            ...proposal,
          },
          "rlm-propose-comparison",
        ),
      );
      expect(proposed).toMatchObject({
        comparisonState: "proposed",
        operationState: "succeeded",
      });

      const comparisonId = String(proposed["comparisonId"]);
      const comparisonRevision = Number(proposed["comparisonRevision"]);
      const requestedApproval = await server.inject({
        method: "POST",
        url: "/api/v1/approvals",
        headers: browserHeaders(),
        payload: {
          effectKind: "comparison.accept",
          targetId: comparisonId,
          expectedRevision: comparisonRevision,
        },
      });
      expect(requestedApproval.statusCode, requestedApproval.body).toBe(201);
      const pendingApproval = requestedApproval.json<Identified>();
      const decisionResponse = await server.inject({
        method: "POST",
        url: `/api/v1/approvals/${pendingApproval.id}/decision`,
        headers: browserHeaders(),
        payload: {
          expectedRevision: pendingApproval.revision,
          decision: "approved",
        },
      });
      expect(decisionResponse.statusCode, decisionResponse.body).toBe(200);
      const approvedApproval = decisionResponse.json<Identified>();
      const acceptedResponse = await server.inject({
        method: "POST",
        url: `/api/v1/comparisons/${comparisonId}/accept`,
        headers: browserHeaders(),
        payload: {
          expectedRevision: comparisonRevision,
          approvalId: approvedApproval.id,
          expectedApprovalRevision: approvedApproval.revision,
        },
      });
      expect(acceptedResponse.statusCode, acceptedResponse.body).toBe(200);
      expect(acceptedResponse.json()).toMatchObject({
        id: comparisonId,
        state: "accepted",
        revision: comparisonRevision + 1,
      });

      await rlmFiber.dispose();
      rlmDisposed = true;

      const durable = (
        await server.inject({ method: "GET", url: "/api/v1/snapshot" })
      ).json<{
        readonly comparisons: readonly {
          readonly id: string;
          readonly state: string;
          readonly scenarios: readonly {
            readonly scoresBasisPoints: Readonly<Record<string, number>>;
            readonly rankedEvaluationIds: readonly string[];
          }[];
        }[];
        readonly operations: readonly {
          readonly id: string;
          readonly state: string;
          readonly route: string;
        }[];
        readonly events: readonly {
          readonly eventKind: string;
          readonly aggregateId: string;
          readonly payload: Readonly<Record<string, unknown>>;
        }[];
      }>();
      expect(durable.comparisons).toHaveLength(1);
      expect(durable.comparisons[0]).toMatchObject({
        id: comparisonId,
        state: "accepted",
      });
      expect(durable.comparisons[0]?.scenarios).toHaveLength(2);
      expect(durable.comparisons[0]?.scenarios[0]?.rankedEvaluationIds[0]).toBe(
        evaluations[0]?.id,
      );
      expect(durable.comparisons[0]?.scenarios[1]?.rankedEvaluationIds[0]).toBe(
        evaluations[1]?.id,
      );
      expect(
        durable.operations.find((item) => item.id === operationId),
      ).toMatchObject({ state: "succeeded", route: "rlm" });
      expect(
        durable.events
          .filter((event) => event.aggregateId === operationId)
          .map((event) => event.eventKind),
      ).toEqual(
        expect.arrayContaining([
          "operation.cell",
          "operation.snapshot",
          "operation.restart",
          "operation.restore",
          "operation.terminal",
        ]),
      );
      expect(JSON.stringify(durable.events)).not.toContain("x = 41");
      const rlmEvents = agent.session.events.filter((event) =>
        event.type.startsWith("rlm/"),
      );
      expect(rlmEvents.length).toBeGreaterThan(0);
      expect(rlmEvents.every((event) => event.ignorable === true)).toBe(true);
    } finally {
      await ipythonFiber.dispose();
      await careerFiber.dispose();
      await serviceFiber.dispose();
      if (!rlmDisposed) await rlmFiber.dispose();
      await spawnFiber.dispose();
      await subagentsFiber.dispose();
      await loopFiber.dispose();
      await queryFiber.dispose();
      await projectionFiber.dispose();
      process.env["PATH"] = previousPath;
    }
  }, 300_000);
});
