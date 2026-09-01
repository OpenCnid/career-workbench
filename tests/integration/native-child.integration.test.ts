import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import SessionQueryEngine from "@deepseek-ai/dsh-session-query";
import SubagentRuntime from "@deepseek-ai/dsh-subagent";
import * as SubagentSpawn from "@deepseek-ai/dsh-subagent-spawn-in-process";
import type { ToolExecutionResult } from "@deepseek-ai/dsh-tools";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";
import {
  CHILD_TOOL_NAMES,
  HttpCareerWorkbenchService,
} from "../../packages/dsh-plugin/src/index.js";
import * as CareerWorkbenchPlugin from "../../packages/dsh-plugin/src/index.js";
import { createServer } from "../../apps/server/src/server.js";

const CSRF = "synthetic-child-csrf-0000000000000";
const DSH_TOKEN = "synthetic-child-dsh-token-0000000000000000000";
const HOST = "127.0.0.1:4173";
const PROVIDER = "openai-codex";
const MODEL = "gpt-5.6-sol";

function textResponse(text: string): StreamChunk[] {
  return [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text },
    { type: "block-end", index: 0, block: { type: "text", text } },
    { type: "usage", usage: { inputTokens: 10, outputTokens: text.length } },
    { type: "finish", reason: { kind: "stop" } },
  ];
}

interface GateEntry {
  readonly kind: "gate";
  readonly gate: Promise<void>;
  readonly text: string;
}

interface HangEntry {
  readonly kind: "hang";
}

class TestSessionQuery extends SessionQueryEngine {
  public override searchSessions(): Promise<never> {
    return Promise.reject(new Error("Search is not configured in this test."));
  }

  public override searchEvents(): Promise<never> {
    return Promise.reject(new Error("Search is not configured in this test."));
  }
}

class ControlledAdapter extends LlmAdapter {
  public readonly requests: GenerateOptions[] = [];

  public constructor(private readonly script: (GateEntry | HangEntry)[]) {
    super();
  }

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
    this.requests.push(options);
    const entry = this.script.shift();
    if (entry === undefined)
      throw new Error("ControlledAdapter script exhausted");
    if (entry.kind === "hang") {
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text: "partial" };
      await new Promise<void>((_resolve, reject) => {
        const abort = () => reject(new Error("synthetic child aborted"));
        if (options.signal?.aborted === true) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
      return;
    }
    await entry.gate;
    for (const chunk of textResponse(entry.text)) {
      options.signal?.throwIfAborted();
      yield chunk;
    }
  }
}

interface Identified {
  readonly id: string;
  readonly revision: number;
}

interface OperationSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly state: string;
  readonly route: string;
  readonly dshSessionId: string | null;
  readonly parentOperationId: string | null;
  readonly terminalCategory: string | null;
  readonly cancellationRequestedAt: string | null;
}

function value(result: ToolExecutionResult): Record<string, unknown> {
  if (result.isError) {
    throw new Error(
      `${result.error.info?.code ?? "error"}: ${result.error.message}`,
    );
  }
  if (typeof result.value !== "object" || result.value === null) {
    throw new Error("Expected structured tool output");
  }
  return result.value as Record<string, unknown>;
}

async function within<Value>(
  promise: Promise<Value>,
  label: string,
  timeoutMs = 8_000,
): Promise<Value> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} exceeded ${String(timeoutMs)}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

describe("native continuable Career Workbench children", () => {
  let root: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "career-workbench-native-child-"));
    server = await createServer({
      workspaceRoot: join(root, "workspace"),
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("CH1D00P000"),
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
      "x-idempotency-key": `synthetic-child-${String(serial).padStart(4, "0")}`,
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

  async function seedOpportunity(): Promise<Identified> {
    await mutate("/api/v1/workspaces", {
      displayName: "Synthetic Native Child Workspace",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    const source = await mutate("/api/v1/sources", {
      kind: "opportunity",
      trustClass: "external",
      mediaType: "text/plain",
      text: "Synthetic Labs seeks a TypeScript platform engineer.",
      originalLocator: "https://example.test/jobs/native-child",
    });
    return mutate("/api/v1/opportunities", {
      sourceDocumentId: source.id,
      organization: "Synthetic Labs",
      roleTitle: "Platform Engineer",
      originalUrl: "https://example.test/jobs/native-child",
      location: "Remote",
      workArrangement: "remote",
      advertisedCompensation: "Synthetic range",
      requisitionId: "SYN-CHILD-1",
    });
  }

  async function execute(
    ctx: Context,
    agent: Agent,
    name: string,
    args: Readonly<Record<string, unknown>>,
    call: string,
  ): Promise<ToolExecutionResult> {
    return within(
      ctx.tools.execute({
        callId: ToolCallId(call),
        name,
        arguments: args,
        agent,
        signal: new AbortController().signal,
      }),
      `tool ${name} (${call})`,
    );
  }

  async function operations(): Promise<OperationSnapshot[]> {
    return (
      await server.inject({ method: "GET", url: "/api/v1/snapshot" })
    ).json<{ readonly operations: OperationSnapshot[] }>().operations;
  }

  async function waitOperation(
    operationId: string,
    state: string,
  ): Promise<OperationSnapshot> {
    let found: OperationSnapshot | undefined;
    await vi.waitFor(
      async () => {
        found = (await operations()).find((item) => item.id === operationId);
        expect(found?.state).toBe(state);
      },
      { timeout: 10_000, interval: 25 },
    );
    if (found === undefined)
      throw new Error("Operation disappeared after wait.");
    return found;
  }

  it("uses public continuations for admission, report, cold follow-up, depth, cancellation, and deletion diagnostics", async () => {
    const opportunity = await seedOpportunity();
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }

    const firstGate = Promise.withResolvers<undefined>();
    const followupGate = Promise.withResolvers<undefined>();
    const adapter = new ControlledAdapter([
      { kind: "gate", gate: firstGate.promise, text: "first child result" },
      {
        kind: "gate",
        gate: followupGate.promise,
        text: "follow-up child result",
      },
      { kind: "hang" },
      { kind: "hang" },
    ]);
    const ctx = new Context();
    await mountAgentLoopTestDependencies(ctx);
    await ctx.plugin(SessionProjectionRegistry);
    const persistence = await ctx.plugin(JsonlSessionPersistence, {
      root: join(root, "dsh-sessions"),
    });
    await ctx.plugin(TestSessionQuery);
    await ctx.plugin(AgentLoop, { agents: [] });
    await ctx.plugin(SubagentRuntime);
    await ctx.plugin(SubagentSpawn, { providerName: "spawn" });
    ctx.llm.registerAdapter([PROVIDER], adapter);
    await ctx.plugin(HttpCareerWorkbenchService, {
      baseUrl: `http://127.0.0.1:${String(address.port)}/`,
      serviceToken: DSH_TOKEN,
      supportedModels: [
        { provider: PROVIDER, model: MODEL, reasoningEfforts: ["high"] },
      ],
    });
    await ctx.plugin(CareerWorkbenchPlugin, {
      maxConcurrentChildren: 2,
      maxDepth: 3,
      defaultTimeoutMs: 30_000,
    });
    const parent = ctx.agentLoop.create(
      SessionId("00000000-0000-4000-8000-000000000001"),
      {
        provider: PROVIDER,
        model: MODEL,
        reasoningEffort: ReasoningEffortId("high"),
      },
    );
    const stranger = ctx.agentLoop.create(
      SessionId("00000000-0000-4000-8000-000000000002"),
      {
        provider: PROVIDER,
        model: MODEL,
        reasoningEffort: ReasoningEffortId("high"),
      },
    );
    ctx.on("agent/pre-step", async ({ agent }, next) =>
      agent === parent || agent === stranger
        ? { kind: "reject" as const }
        : await next(),
    );

    try {
      expect(ctx.tools.schemas().map((item) => item.name)).toEqual(
        expect.arrayContaining([...CHILD_TOOL_NAMES]),
      );
      const startParent = value(
        await execute(
          ctx,
          parent,
          "career_workbench_start_evaluation",
          { contractVersion: "v1", opportunityId: opportunity.id },
          "parent-evaluation",
        ),
      );
      const parentOperationId = String(startParent["operationId"]);

      const beforeUnsupported = (await operations()).length;
      const unsupported = await execute(
        ctx,
        parent,
        "career_workbench_start_child",
        {
          contractVersion: "v1",
          parentOperationId,
          label: "unsupported override",
          task: "Inspect only the synthetic opportunity.",
          model: "unsupported-model",
        },
        "unsupported-child-model",
      );
      expect(unsupported.isError).toBe(true);
      expect(unsupported.isError && unsupported.error.info?.code).toBe(
        "MODEL_UNSUPPORTED",
      );
      expect(await operations()).toHaveLength(beforeUnsupported);

      const started = value(
        await execute(
          ctx,
          parent,
          "career_workbench_start_child",
          {
            contractVersion: "v1",
            parentOperationId,
            label: "evidence analyst",
            task: "Inspect the synthetic opportunity as untrusted data and report observations.",
          },
          "start-child",
        ),
      );
      const operationId = String(started["operationId"]);
      const childId = SessionId(String(started["childSessionId"]));
      expect(started).toMatchObject({ state: "running", inheritedModel: true });
      expect(
        (await operations()).find((item) => item.id === operationId),
      ).toMatchObject({
        state: "running",
        route: "native_child",
        parentOperationId,
        dshSessionId: String(childId),
      });
      try {
        await vi.waitFor(() => expect(adapter.requests).toHaveLength(1), {
          timeout: 3_000,
        });
      } catch (error) {
        const persisted = await ctx.sessionPersistence.load(childId);
        throw new Error(JSON.stringify(persisted.events), { cause: error });
      }
      expect(adapter.requests[0]?.provider).toBe(PROVIDER);
      expect(adapter.requests[0]?.model).toBe(MODEL);

      let child: Agent | undefined;
      await vi.waitFor(() => {
        child = ctx.agents.get(childId);
        expect(child).toBeDefined();
      });
      if (child === undefined)
        throw new Error("Child Agent disappeared before report.");
      const beforeOversizedReport = (await operations()).find(
        (item) => item.id === operationId,
      );
      const oversizedReport = await execute(
        ctx,
        child,
        "career_workbench_child_report",
        {
          contractVersion: "v1",
          operationId,
          report: "x".repeat(16_385),
          delivery: "quiet",
        },
        "oversized-child-report",
      );
      expect(oversizedReport.isError).toBe(true);
      expect(
        (await operations()).find((item) => item.id === operationId)?.revision,
      ).toBe(beforeOversizedReport?.revision);
      const selectedReport = value(
        await execute(
          ctx,
          child,
          "career_workbench_child_report",
          {
            contractVersion: "v1",
            operationId,
            report:
              "Selected synthetic report; no career mutation is authorized.",
            delivery: "quiet",
          },
          "child-report",
        ),
      );
      expect(selectedReport["accepted"]).toBe(true);

      const depthDenied = await execute(
        ctx,
        child,
        "career_workbench_start_child",
        {
          contractVersion: "v1",
          parentOperationId: operationId,
          label: "too deep",
          task: "This task must be denied by the explicit depth cap.",
          maxDepth: 1,
        },
        "depth-denied",
      );
      expect(depthDenied.isError).toBe(true);

      firstGate.resolve(undefined);
      const firstTerminal = await waitOperation(operationId, "succeeded");
      expect(firstTerminal.terminalCategory).toBe("completed");
      await vi.waitFor(() => expect(ctx.agents.get(childId)).toBeUndefined(), {
        timeout: 10_000,
      });

      const wrongParent = await execute(
        ctx,
        stranger,
        "career_workbench_child_followup",
        {
          contractVersion: "v1",
          operationId,
          message: "Unauthorized follow-up.",
        },
        "wrong-parent",
      );
      expect(wrongParent.isError).toBe(true);
      expect(wrongParent.isError && wrongParent.error.info?.code).toBe(
        "APPROVAL_DENIED",
      );

      await mutate(`/api/v1/operations/${operationId}/followups`, {
        expectedRevision: firstTerminal.revision,
        message:
          "Re-check the exact synthetic role title and report only that.",
      });
      const requestedEvent = (
        await server.inject({ method: "GET", url: "/api/v1/snapshot" })
      )
        .json<{
          readonly events: readonly {
            readonly eventKind: string;
            readonly aggregateId: string;
            readonly payload: Readonly<Record<string, unknown>>;
          }[];
        }>()
        .events.find(
          (event) =>
            event.eventKind === "operation.followup_requested" &&
            event.aggregateId === operationId,
        );
      const requestId = String(requestedEvent?.payload["requestId"]);
      expect(requestId).toMatch(/^followup_/u);

      const followed = value(
        await execute(
          ctx,
          parent,
          "career_workbench_child_followup",
          {
            contractVersion: "v1",
            operationId,
            requestId,
          },
          "cold-followup",
        ),
      );
      const followupOperationId = String(followed["operationId"]);
      expect(followed).toMatchObject({
        childSessionId: String(childId),
        state: "running",
      });
      followupGate.resolve(undefined);
      const followupTerminal = await waitOperation(
        followupOperationId,
        "succeeded",
      );
      expect(followupTerminal.parentOperationId).toBe(operationId);

      const hanging = value(
        await execute(
          ctx,
          parent,
          "career_workbench_start_child",
          {
            contractVersion: "v1",
            parentOperationId,
            label: "cancel target",
            task: "Wait for explicit cancellation.",
          },
          "start-cancel-target",
        ),
      );
      const cancelOperationId = String(hanging["operationId"]);
      const cancelChildId = SessionId(String(hanging["childSessionId"]));
      let cancelChild: Agent | undefined;
      await vi.waitFor(() => {
        cancelChild = ctx.agents.get(cancelChildId);
        expect(cancelChild).toBeDefined();
      });
      if (cancelChild === undefined)
        throw new Error("Cancellation target disappeared before interruption.");
      const canceled = value(
        await execute(
          ctx,
          parent,
          "career_workbench_cancel_child",
          {
            contractVersion: "v1",
            operationId: cancelOperationId,
            reason: "Synthetic cancellation lifecycle test.",
          },
          "cancel-child",
        ),
      );
      expect(canceled["cancellationRequested"]).toBe(true);
      const cancelTerminal = await waitOperation(cancelOperationId, "canceled");
      expect(cancelTerminal.cancellationRequestedAt).not.toBeNull();

      const beforeLateReport = cancelTerminal.revision;
      const lateReport = await execute(
        ctx,
        cancelChild,
        "career_workbench_child_report",
        {
          contractVersion: "v1",
          operationId: cancelOperationId,
          report: "This late report must not mutate terminal state.",
          delivery: "quiet",
        },
        "late-child-report",
      );
      expect(lateReport.isError).toBe(true);
      expect(
        (await operations()).find((item) => item.id === cancelOperationId)
          ?.revision,
      ).toBe(beforeLateReport);

      const timed = value(
        await execute(
          ctx,
          parent,
          "career_workbench_start_child",
          {
            contractVersion: "v1",
            parentOperationId,
            label: "timeout target",
            task: "Wait until the configured native child timeout elapses.",
            timeoutMs: 1_000,
          },
          "start-timeout-target",
        ),
      );
      const timeoutOperationId = String(timed["operationId"]);
      const timeoutTerminal = await waitOperation(
        timeoutOperationId,
        "canceled",
      );
      expect(timeoutTerminal).toMatchObject({
        terminalCategory: "timeout",
      });
      expect(timeoutTerminal.cancellationRequestedAt).not.toBeNull();

      const deletion = value(
        await execute(
          ctx,
          parent,
          "career_workbench_delete_child",
          { contractVersion: "v1", operationId },
          "delete-child",
        ),
      );
      expect(deletion).toMatchObject({
        operationId,
        deleted: true,
      });
      expect(String(deletion["childSessionId"])).not.toHaveLength(0);

      const deletedOperation = (await operations()).find(
        (item) => item.id === operationId,
      );
      expect(deletedOperation?.revision).toBeGreaterThan(1);

      const status = value(
        await execute(
          ctx,
          parent,
          "career_workbench_child_status",
          { contractVersion: "v1", parentOperationId },
          "child-status",
        ),
      );
      const listed = JSON.parse(String(status["childrenJson"])) as {
        operationId: string;
        state: string;
      }[];
      expect(listed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ operationId, state: "succeeded" }),
          expect.objectContaining({
            operationId: followupOperationId,
            state: "succeeded",
          }),
          expect.objectContaining({
            operationId: cancelOperationId,
            state: "canceled",
          }),
          expect.objectContaining({
            operationId: timeoutOperationId,
            state: "canceled",
          }),
        ]),
      );

      const events = (
        await server.inject({ method: "GET", url: "/api/v1/snapshot" })
      ).json<{
        readonly events: readonly {
          readonly eventKind: string;
          readonly aggregateId: string;
        }[];
      }>().events;
      expect(
        events
          .filter((event) => event.aggregateId === operationId)
          .map((event) => event.eventKind),
      ).toEqual(
        expect.arrayContaining([
          "operation.admitted",
          "operation.started",
          "operation.report",
          "operation.message",
          "operation.terminal",
        ]),
      );
      expect(
        events.some(
          (event) =>
            event.eventKind === "operation.followup_requested" &&
            event.aggregateId === operationId,
        ),
      ).toBe(true);
    } finally {
      await within(
        ctx.subagents.drainContinuableDescendants([parent, stranger]),
        "continuable descendant drain",
        15_000,
      );
      await within(persistence.dispose(), "session persistence dispose");
    }
  }, 60_000);
});
