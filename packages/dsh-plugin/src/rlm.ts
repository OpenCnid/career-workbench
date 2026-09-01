import { createHash } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { ToolDefinition, ToolRunContext } from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-rlm/dsh-rlm";
import type {
  RlmKernelLifecycleEvent,
  RlmSnapshotResult,
} from "@deepseek-rlm/dsh-rlm";
import {
  CareerWorkbenchError,
  type AgentAuthority,
  type ComparisonProposalCommand,
  type StartedOperation,
} from "./service.js";
import { agentAuthority, type OperationAuthorities } from "./tools.js";

const ID_PATTERN = /^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$/u;
const MAX_SCENARIOS = 8;

interface RlmEntry {
  readonly agent: Agent;
  readonly authority: AgentAuthority;
  readonly evaluationIds: readonly string[];
  operation: StartedOperation;
  tail: Promise<void>;
  activitySequence: number;
}

function invalid(message: string): never {
  throw new CareerWorkbenchError(message, "INVALID_ARGS");
}

function object(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid("arguments must be an object.");
  }
  const parsed = value as Record<string, unknown>;
  if (Object.keys(parsed).some((key) => !allowed.includes(key))) {
    return invalid("arguments contain unknown fields.");
  }
  if (parsed["contractVersion"] !== "v1") {
    return invalid("contractVersion must be v1.");
  }
  return parsed;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    return invalid(`${label} is not a valid entity identity.`);
  }
  return value;
}

function ids(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((item) => typeof item !== "string" || !ID_PATTERN.test(item)) ||
    new Set(value).size !== 3
  ) {
    return invalid(`${label} must contain exactly three distinct identities.`);
  }
  return value as string[];
}

function text(value: unknown, label: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    return invalid(`${label} is missing or exceeds its supported bound.`);
  }
  return value;
}

function proposal(value: unknown): ComparisonProposalCommand {
  const parsed = object(value, [
    "contractVersion",
    "operationId",
    "evaluationIds",
    "policyVersion",
    "scenarios",
    "tradeoffs",
  ]);
  const rawScenarios = parsed["scenarios"];
  if (
    !Array.isArray(rawScenarios) ||
    rawScenarios.length === 0 ||
    rawScenarios.length > MAX_SCENARIOS
  ) {
    return invalid("scenarios must contain one through eight entries.");
  }
  const scenarios = rawScenarios.map((raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return invalid("scenario must be an object.");
    }
    const scenario = raw as Record<string, unknown>;
    if (
      Object.keys(scenario).some(
        (key) => key !== "label" && key !== "weightsBasisPoints",
      )
    ) {
      return invalid("scenario contains unknown fields.");
    }
    const rawWeights = scenario["weightsBasisPoints"];
    if (
      typeof rawWeights !== "object" ||
      rawWeights === null ||
      Array.isArray(rawWeights)
    ) {
      return invalid("scenario weights must be an object.");
    }
    const weightsBasisPoints: Record<string, number> = {};
    for (const [key, weight] of Object.entries(rawWeights)) {
      if (
        !/^[a-z][a-z0-9_]{0,79}$/u.test(key) ||
        !Number.isSafeInteger(weight) ||
        (weight as number) < 0 ||
        (weight as number) > 10_000
      ) {
        return invalid("scenario weight is invalid.");
      }
      weightsBasisPoints[key] = weight as number;
    }
    return {
      label: text(scenario["label"], "scenario label", 120),
      weightsBasisPoints,
    };
  });
  const rawTradeoffs = parsed["tradeoffs"];
  if (
    !Array.isArray(rawTradeoffs) ||
    rawTradeoffs.length > 16 ||
    rawTradeoffs.some(
      (item) =>
        typeof item !== "string" ||
        item.trim().length === 0 ||
        item.length > 1_000,
    )
  ) {
    return invalid("tradeoffs exceed their supported bound.");
  }
  const policyVersion = text(parsed["policyVersion"], "policyVersion", 30);
  if (!/^\d+\.\d+\.\d+$/u.test(policyVersion)) {
    return invalid("policyVersion must be semantic version text.");
  }
  return {
    evaluationIds: ids(parsed["evaluationIds"], "evaluationIds"),
    policyVersion,
    scenarios,
    tradeoffs: rawTradeoffs as string[],
  };
}

function callIdentity(exec: ToolRunContext, suffix: string): string {
  return `${String(exec.callId)}:${suffix}`;
}

const contractVersion: Record<string, unknown> = {
  type: "string",
  const: "v1",
};
const identity: Record<string, unknown> = { type: "string" };
const evaluationIds: Record<string, unknown> = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  uniqueItems: true,
  items: identity,
};

function rendered(value: unknown): { type: "text"; text: string }[] {
  return [{ type: "text", text: JSON.stringify(value) }];
}

function snapshotView(
  snapshot: RlmSnapshotResult | undefined,
): Record<string, unknown> {
  return snapshot === undefined
    ? { available: false }
    : {
        available: true,
        digest: snapshot.digest,
        bytes: snapshot.bytes,
        saved: snapshot.saved,
        skipped: snapshot.skipped,
        generation: snapshot.generation,
      };
}

export const RLM_TOOL_NAMES = [
  "career_workbench_start_comparison",
  "career_workbench_comparison_inputs",
  "career_workbench_propose_comparison",
  "career_workbench_rlm_snapshot",
  "career_workbench_rlm_restart",
  "career_workbench_rlm_status",
] as const;

export class NativeRlmCoordinator {
  private readonly byOperation = new Map<string, RlmEntry>();
  private readonly bySession = new Map<string, RlmEntry>();

  public constructor(
    private readonly ctx: Context,
    private readonly owners: OperationAuthorities,
  ) {
    ctx.on("rlm/kernel", (lifecycle) => this.onKernel(lifecycle));
    ctx.on("session/event", (session, event) => {
      const typed = event as unknown as {
        readonly type: string;
        readonly data: Readonly<Record<string, unknown>>;
      };
      const entry = this.bySession.get(String(session.id));
      if (entry === undefined) return;
      if (typed.type === "rlm/host-request") {
        this.queueActivity(
          entry,
          "bridge",
          "Authenticated RLM host request settled.",
        );
      } else if (typed.type === "rlm/kernel-snapshot") {
        const digest = typed.data["digest"];
        const bytes = typed.data["bytes"];
        this.queueActivity(
          entry,
          "snapshot",
          `Authorized RLM snapshot recorded${typeof digest === "string" ? ` (${digest})` : ""}${typeof bytes === "number" ? `, ${String(bytes)} bytes` : ""}.`,
        );
      } else if (typed.type === "rlm/kernel-restore") {
        const digest = typed.data["digest"];
        this.queueActivity(
          entry,
          "restore",
          `RLM restore authorization checked${typeof digest === "string" ? ` (${digest})` : ""}.`,
        );
      }
    });
  }

  private onKernel(lifecycle: RlmKernelLifecycleEvent): void {
    const entry = this.bySession.get(String(lifecycle.sessionId));
    if (entry === undefined) return;
    const phase =
      lifecycle.phase === "busy"
        ? "cell"
        : lifecycle.phase === "interrupt"
          ? "interrupt"
          : lifecycle.phase === "restart"
            ? "restart"
            : undefined;
    if (phase !== undefined) {
      this.queueActivity(
        entry,
        phase,
        `RLM kernel ${lifecycle.phase}; generation ${String(lifecycle.generation)}.`,
      );
    }
  }

  private queueActivity(
    entry: RlmEntry,
    phase: "cell" | "bridge" | "snapshot" | "restore" | "interrupt" | "restart",
    message: string,
  ): void {
    entry.activitySequence += 1;
    const activitySequence = entry.activitySequence;
    entry.tail = entry.tail
      .then(async () => {
        if (
          ["succeeded", "failed", "canceled", "indeterminate"].includes(
            entry.operation.state,
          )
        ) {
          return;
        }
        entry.operation =
          await this.ctx.careerWorkbench.recordOperationActivity(
            entry.authority,
            entry.operation.id,
            { expectedRevision: entry.operation.revision, phase, message },
            `rlm-${createHash("sha256")
              .update(
                `${entry.operation.id}:${String(activitySequence)}:${phase}:${message}`,
              )
              .digest("hex")}`,
            new AbortController().signal,
          );
      })
      .catch((error: unknown) => {
        this.ctx.logger.warn(
          `career-workbench: RLM activity correlation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private entry(operationId: string, agent: Agent | undefined): RlmEntry {
    const entry = this.byOperation.get(operationId);
    if (entry === undefined || agent === undefined || entry.agent !== agent) {
      throw new CareerWorkbenchError(
        "The exact originating live DSH Agent is required for this RLM operation.",
        "APPROVAL_DENIED",
      );
    }
    this.owners.require(operationId, agent);
    return entry;
  }

  public async start(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Record<string, unknown>> {
    const parsed = object(args, ["contractVersion", "evaluationIds"]);
    if (exec.agent === undefined) {
      throw new CareerWorkbenchError(
        "RLM requires an exact live Agent.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    const selectedIds = ids(parsed["evaluationIds"], "evaluationIds");
    const authority = agentAuthority(exec.agent);
    const operation = await this.ctx.careerWorkbench.startRlmComparison(
      authority,
      selectedIds,
      callIdentity(exec, "rlm-comparison"),
      exec.signal,
    );
    const entry: RlmEntry = {
      agent: exec.agent,
      authority,
      evaluationIds: selectedIds,
      operation,
      tail: Promise.resolve(),
      activitySequence: 0,
    };
    this.byOperation.set(operation.id, entry);
    this.bySession.set(String(exec.agent.id), entry);
    this.owners.bind(operation.id, exec.agent);
    return {
      contractVersion: "v1",
      operationId: operation.id,
      state: operation.state,
      route: operation.route,
      evaluationIds: selectedIds,
      osAuthority: true,
    };
  }

  public async inputs(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Record<string, unknown>> {
    const parsed = object(args, ["contractVersion", "operationId"]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.entry(operationId, exec.agent);
    return {
      contractVersion: "v1",
      operationId,
      evaluations: await this.ctx.careerWorkbench.comparisonProjections(
        entry.authority,
        entry.evaluationIds,
        callIdentity(exec, "comparison-inputs"),
        exec.signal,
      ),
    };
  }

  public async propose(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Record<string, unknown>> {
    const parsed = object(args, [
      "contractVersion",
      "operationId",
      "evaluationIds",
      "policyVersion",
      "scenarios",
      "tradeoffs",
    ]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.entry(operationId, exec.agent);
    const command = proposal(parsed);
    if (
      JSON.stringify(command.evaluationIds) !==
      JSON.stringify(entry.evaluationIds)
    ) {
      return invalid(
        "evaluationIds must exactly match the admitted RLM operation.",
      );
    }
    await entry.tail;
    const comparison = await this.ctx.careerWorkbench.proposeComparison(
      entry.authority,
      operationId,
      command,
      callIdentity(exec, "comparison-proposal"),
      exec.signal,
    );
    entry.operation = await this.ctx.careerWorkbench.settleOperation(
      entry.authority,
      operationId,
      {
        expectedRevision: entry.operation.revision,
        state: "succeeded",
        category: "comparison_proposed",
        message:
          "Structured comparison proposal persisted for explicit user acceptance.",
        resultIds: [comparison.id],
      },
      callIdentity(exec, "comparison-terminal"),
      exec.signal,
    );
    return {
      contractVersion: "v1",
      operationId,
      comparisonId: comparison.id,
      comparisonRevision: comparison.revision,
      comparisonState: comparison.state,
      operationState: entry.operation.state,
    };
  }

  public async snapshot(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Record<string, unknown>> {
    const parsed = object(args, ["contractVersion", "operationId"]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.entry(operationId, exec.agent);
    const snapshot = await this.ctx.rlm.snapshot(entry.agent, exec.signal);
    await entry.tail;
    return { contractVersion: "v1", operationId, ...snapshotView(snapshot) };
  }

  public async restart(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Record<string, unknown>> {
    const parsed = object(args, ["contractVersion", "operationId"]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.entry(operationId, exec.agent);
    await this.ctx.rlm.restart(entry.agent, exec.signal);
    await entry.tail;
    return { contractVersion: "v1", operationId, restarted: true };
  }

  public status(args: unknown, exec: ToolRunContext): Record<string, unknown> {
    const parsed = object(args, ["contractVersion", "operationId"]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.entry(operationId, exec.agent);
    const info = this.ctx.rlm.info(entry.agent);
    return {
      contractVersion: "v1",
      operationId,
      available: true,
      kernel:
        info === undefined
          ? null
          : {
              generation: info.generation,
              state: info.state,
              runtimeVersion: info.runtimeVersion,
            },
      osAuthority: true,
    };
  }
}

export function createRlmTools(
  coordinator: NativeRlmCoordinator,
): readonly ToolDefinition[] {
  const operationParameters = {
    type: "object" as const,
    additionalProperties: false,
    properties: { contractVersion, operationId: identity },
    required: ["contractVersion", "operationId"],
  };
  const definition = (
    name: (typeof RLM_TOOL_NAMES)[number],
    description: string,
    parameters: Record<string, unknown>,
    execute: (
      args: unknown,
      exec: ToolRunContext,
    ) => Record<string, unknown> | Promise<Record<string, unknown>>,
  ): ToolDefinition => ({
    name,
    description,
    parameters,
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => rendered(value),
    },
    execute: async (args, exec) => await execute(args, exec),
  });
  return [
    definition(
      RLM_TOOL_NAMES[0],
      "Admit a bounded three-evaluation comparison on the native RLM route. IPython has operating-system authority and is not a sandbox.",
      {
        type: "object",
        additionalProperties: false,
        properties: { contractVersion, evaluationIds },
        required: ["contractVersion", "evaluationIds"],
      },
      (args, exec) => coordinator.start(args, exec),
    ),
    definition(
      RLM_TOOL_NAMES[1],
      "Read the three revision-bound completed evaluation projections admitted for this RLM comparison.",
      operationParameters,
      (args, exec) => coordinator.inputs(args, exec),
    ),
    definition(
      RLM_TOOL_NAMES[2],
      "Ingest a bounded structured comparison proposal. Career Workbench recomputes every scenario score; user acceptance remains separate.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion,
          operationId: identity,
          evaluationIds,
          policyVersion: { type: "string" },
          scenarios: {
            type: "array",
            minItems: 1,
            maxItems: MAX_SCENARIOS,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                weightsBasisPoints: {
                  type: "object",
                  additionalProperties: { type: "integer" },
                },
              },
              required: ["label", "weightsBasisPoints"],
            },
          },
          tradeoffs: { type: "array", maxItems: 16, items: { type: "string" } },
        },
        required: [
          "contractVersion",
          "operationId",
          "evaluationIds",
          "policyVersion",
          "scenarios",
          "tradeoffs",
        ],
      },
      (args, exec) => coordinator.propose(args, exec),
    ),
    definition(
      RLM_TOOL_NAMES[3],
      "Request a digest-authorized best-effort snapshot through public ctx.rlm without exposing its filesystem path.",
      operationParameters,
      (args, exec) => coordinator.snapshot(args, exec),
    ),
    definition(
      RLM_TOOL_NAMES[4],
      "Snapshot when possible, stop the current kernel generation, and prepare a lazy restore without replaying cells.",
      operationParameters,
      (args, exec) => coordinator.restart(args, exec),
    ),
    definition(
      RLM_TOOL_NAMES[5],
      "Inspect non-secret native RLM readiness and generation state.",
      operationParameters,
      (args, exec) => coordinator.status(args, exec),
    ),
  ];
}
