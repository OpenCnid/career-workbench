import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent, AgentOptions } from "@deepseek-ai/dsh-agent";
import type {
  SubagentRunEndInfo,
  SubagentRuntime,
} from "@deepseek-ai/dsh-subagent";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import type {
  JsonSchemaNode,
  ToolDefinition,
  ToolRunContext,
} from "@deepseek-ai/dsh-tools";
import type { OperationView } from "@career-workbench/contracts";
import {
  CareerWorkbenchError,
  type AgentAuthority,
  type StartedOperation,
} from "./service.js";
import { agentAuthority } from "./tools.js";
import type { OperationAuthorities } from "./tools.js";

const ID_PATTERN = /^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$/u;
const TERMINAL_STATES = new Set([
  "succeeded",
  "failed",
  "canceled",
  "indeterminate",
]);
const MAX_REPORT_LENGTH = 16_384;

type JsonRecord = Record<string, unknown>;

export interface NativeChildConfig {
  readonly provider?: string;
  readonly maxConcurrentChildren?: number;
  readonly maxDepth?: number;
  readonly defaultTimeoutMs?: number;
}

interface ResolvedNativeChildConfig {
  readonly provider: string;
  readonly maxConcurrentChildren: number;
  readonly maxDepth: number;
  readonly defaultTimeoutMs: number;
}

interface ChildEntry {
  readonly childId: ReturnType<typeof SessionId>;
  readonly parent: Agent;
  readonly authority: AgentAuthority;
  readonly depth: number;
  operation: StartedOperation;
  accepted: boolean;
  pendingEnd?: SubagentRunEndInfo;
  forcedCategory?: string;
  timeout?: ReturnType<typeof setTimeout>;
  settling?: Promise<void>;
}

function invalid(message: string): never {
  throw new CareerWorkbenchError(message, "INVALID_ARGS");
}

function object(value: unknown, allowed: readonly string[]): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid("arguments must be an object.");
  }
  const result = value as JsonRecord;
  if (Object.keys(result).some((key) => !allowed.includes(key))) {
    return invalid("arguments contain unknown fields.");
  }
  if (result["contractVersion"] !== "v1") {
    return invalid("contractVersion must be v1.");
  }
  return result;
}

function text(value: unknown, name: string, maximum: number): string;
function text(
  value: unknown,
  name: string,
  maximum: number,
  optional: true,
): string | undefined;
function text(
  value: unknown,
  name: string,
  maximum: number,
  optional = false,
): string | undefined {
  if (value === undefined && optional) return undefined;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum
  ) {
    return invalid(`${name} is missing or outside its supported bound.`);
  }
  return value;
}

function requiredText(value: unknown, name: string, maximum: number): string {
  return text(value, name, maximum);
}

function id(value: unknown, name: string): string {
  const result = requiredText(value, name, 80);
  if (!ID_PATTERN.test(result)) return invalid(`${name} is invalid.`);
  return result;
}

function integer(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    return invalid(`${name} is outside its supported bound.`);
  }
  return value as number;
}

const stringSchema = (description: string): JsonSchemaNode => ({
  type: "string",
  description,
});
const idSchema = (description: string): JsonSchemaNode =>
  stringSchema(`${description} Runtime maximum: 80 characters.`);
const contractVersionSchema: JsonSchemaNode = {
  type: "string",
  const: "v1",
};
const outputSchema = (
  properties: Record<string, JsonSchemaNode>,
  required: string[],
): JsonSchemaNode => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const renderJson = (value: unknown): { type: "text"; text: string }[] => [
  { type: "text", text: JSON.stringify(value) },
];

function resolveConfig(config: NativeChildConfig): ResolvedNativeChildConfig {
  const result = {
    provider: config.provider ?? "spawn",
    maxConcurrentChildren: config.maxConcurrentChildren ?? 4,
    maxDepth: config.maxDepth ?? 3,
    defaultTimeoutMs: config.defaultTimeoutMs ?? 120_000,
  };
  if (
    result.provider.length === 0 ||
    result.provider.length > 100 ||
    !Number.isSafeInteger(result.maxConcurrentChildren) ||
    result.maxConcurrentChildren < 1 ||
    result.maxConcurrentChildren > 16 ||
    !Number.isSafeInteger(result.maxDepth) ||
    result.maxDepth < 1 ||
    result.maxDepth > 8 ||
    !Number.isSafeInteger(result.defaultTimeoutMs) ||
    result.defaultTimeoutMs < 1_000 ||
    result.defaultTimeoutMs > 600_000
  ) {
    throw new CareerWorkbenchError(
      "Native-child configuration is invalid.",
      "CAPABILITY_UNAVAILABLE",
    );
  }
  return result;
}

function operationFromView(view: OperationView): StartedOperation {
  if (view.dshSessionId === null) {
    throw new CareerWorkbenchError(
      "Native child operation has no durable DSH session identity.",
      "OPERATION_INDETERMINATE",
    );
  }
  return {
    id: view.id,
    revision: view.revision,
    state: view.state,
    route: view.route,
    dshSessionId: view.dshSessionId,
    parentOperationId: view.parentOperationId,
    inputIdentity: view.inputIdentity,
    cancellationRequestedAt: view.cancellationRequestedAt,
  };
}

function boundedAssistantText(info: SubagentRunEndInfo): string | undefined {
  const joined = (info.lastAssistantMessage ?? [])
    .flatMap((block) =>
      block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("\n")
    .trim();
  if (joined.length === 0) return undefined;
  return joined.length <= MAX_REPORT_LENGTH
    ? joined
    : `${joined.slice(0, MAX_REPORT_LENGTH - 16)}\n[truncated]`;
}

function terminalFor(info: SubagentRunEndInfo, forced?: string) {
  if (forced === "timeout") {
    return {
      state: "canceled" as const,
      category: "timeout",
      message:
        "Native child exceeded its configured time bound and was interrupted.",
    };
  }
  switch (info.stopReason) {
    case "completed":
      return {
        state: "succeeded" as const,
        category: "completed",
        message: "Native child completed its admitted work.",
      };
    case "aborted":
      return {
        state: "canceled" as const,
        category: "aborted",
        message: "Native child stopped after cancellation.",
      };
    case "max-tokens":
      return {
        state: "failed" as const,
        category: "max_tokens",
        message: "Native child reached its output-token bound.",
      };
    case "refusal":
      return {
        state: "failed" as const,
        category: "refusal",
        message: "Native child declined the admitted work.",
      };
    default:
      return {
        state: "failed" as const,
        category: "child_error",
        message: "Native child failed before producing a trusted terminal.",
      };
  }
}

export class NativeChildCoordinator {
  private readonly config: ResolvedNativeChildConfig;
  private readonly byOperation = new Map<string, ChildEntry>();
  private readonly byChild = new Map<string, ChildEntry>();
  private sequence = 0;

  public constructor(
    private readonly ctx: Context,
    private readonly owners: OperationAuthorities,
    config: NativeChildConfig = {},
  ) {
    this.config = resolveConfig(config);
    ctx.on("subagent/end", (info) => {
      const entry = this.byChild.get(String(info.id));
      if (entry === undefined) return;
      if (!entry.accepted) {
        entry.pendingEnd = info;
        return;
      }
      this.queueSettlement(entry, info);
    });
  }

  private command(kind: string, operationId: string): string {
    this.sequence += 1;
    return `${kind}:${operationId}:${String(this.sequence)}`;
  }

  private activeFor(parent: Agent): number {
    return [...this.byOperation.values()].filter(
      (entry) =>
        entry.parent === parent && !TERMINAL_STATES.has(entry.operation.state),
    ).length;
  }

  private async loadOperation(
    liveAgent: Agent,
    operationId: string,
    signal: AbortSignal,
  ): Promise<{ operation: OperationView; context: readonly OperationView[] }> {
    const authority = agentAuthority(liveAgent);
    const snapshot = await this.ctx.careerWorkbench.context(
      authority,
      undefined,
      signal,
    );
    const operation = snapshot.operations.find(
      (item) => item.id === operationId,
    );
    if (operation === undefined) {
      throw new CareerWorkbenchError(
        "Operation is outside the bounded authoritative context.",
        "ENTITY_NOT_FOUND",
      );
    }
    return { operation, context: snapshot.operations };
  }

  private async resolveDelegatingParent(
    operationId: string,
    agent: Agent | undefined,
    signal: AbortSignal,
  ): Promise<{
    agent: Agent;
    authority: AgentAuthority;
    operation: OperationView;
    depth: number;
  }> {
    if (agent === undefined) {
      throw new CareerWorkbenchError(
        "Native child tools require one live DSH Agent.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    const loaded = await this.loadOperation(agent, operationId, signal);
    if (
      !this.owners.ownedBy(operationId, agent) &&
      loaded.operation.dshSessionId !== String(agent.id)
    ) {
      throw new CareerWorkbenchError(
        "Only the exact live Agent represented by the parent operation may delegate.",
        "APPROVAL_DENIED",
      );
    }
    let depth = 0;
    let cursor: OperationView | undefined = loaded.operation;
    const seen = new Set<string>();
    while (cursor?.route === "native_child") {
      if (seen.has(cursor.id)) {
        throw new CareerWorkbenchError(
          "Native child lineage contains a cycle.",
          "OPERATION_INDETERMINATE",
        );
      }
      seen.add(cursor.id);
      depth += 1;
      cursor =
        cursor.parentOperationId === null
          ? undefined
          : loaded.context.find(
              (item) => item.id === cursor?.parentOperationId,
            );
    }
    return {
      agent,
      authority: agentAuthority(agent),
      operation: loaded.operation,
      depth,
    };
  }

  private async entryForParent(
    operationId: string,
    agent: Agent | undefined,
    signal: AbortSignal,
  ): Promise<ChildEntry> {
    const cached = this.byOperation.get(operationId);
    if (cached !== undefined) {
      if (agent === undefined || cached.parent !== agent) {
        throw new CareerWorkbenchError(
          "Only the exact live direct parent may control this child.",
          "APPROVAL_DENIED",
        );
      }
      return cached;
    }
    if (agent === undefined) {
      throw new CareerWorkbenchError(
        "Native child controls require one live parent Agent.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    const loaded = await this.loadOperation(agent, operationId, signal);
    if (loaded.operation.route !== "native_child") {
      throw new CareerWorkbenchError(
        "Operation is not a native continuable child.",
        "INVALID_ARGS",
      );
    }
    let cursor: OperationView | undefined = loaded.operation;
    let authorized = false;
    let depth = 0;
    const seen = new Set<string>();
    while (cursor !== undefined) {
      if (seen.has(cursor.id) || depth > this.config.maxDepth + 8) break;
      seen.add(cursor.id);
      if (cursor.dshSessionId === String(agent.id)) authorized = true;
      if (cursor.route === "native_child") depth += 1;
      cursor =
        cursor.parentOperationId === null
          ? undefined
          : loaded.context.find(
              (item) => item.id === cursor?.parentOperationId,
            );
    }
    if (!authorized) {
      throw new CareerWorkbenchError(
        "The live Agent is not in this child's authoritative lineage.",
        "APPROVAL_DENIED",
      );
    }
    const parsedOperation = operationFromView(loaded.operation);
    const entry: ChildEntry = {
      childId: SessionId(parsedOperation.dshSessionId),
      parent: agent,
      authority: agentAuthority(agent),
      depth,
      operation: parsedOperation,
      accepted: true,
    };
    this.byOperation.set(operationId, entry);
    this.byChild.set(String(entry.childId), entry);
    return entry;
  }

  private queueSettlement(entry: ChildEntry, info: SubagentRunEndInfo): void {
    entry.settling = (entry.settling ?? Promise.resolve())
      .then(async () => this.settle(entry, info))
      .catch((error: unknown) => {
        this.ctx.logger.warn(
          `career-workbench: native child settlement failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private async settle(
    entry: ChildEntry,
    info: SubagentRunEndInfo,
  ): Promise<void> {
    if (entry.timeout !== undefined) clearTimeout(entry.timeout);
    if (TERMINAL_STATES.has(entry.operation.state)) return;
    const output = boundedAssistantText(info);
    if (output !== undefined) {
      entry.operation = await this.ctx.careerWorkbench.recordChildActivity(
        entry.authority,
        entry.operation.id,
        {
          expectedRevision: entry.operation.revision,
          phase: "message",
          message: output,
        },
        this.command("child-message", entry.operation.id),
        new AbortController().signal,
      );
    }
    const terminal = terminalFor(info, entry.forcedCategory);
    entry.operation = await this.ctx.careerWorkbench.settleChildOperation(
      entry.authority,
      entry.operation.id,
      { expectedRevision: entry.operation.revision, ...terminal },
      this.command("child-terminal", entry.operation.id),
      new AbortController().signal,
    );
  }

  private armTimeout(entry: ChildEntry, timeoutMs: number): void {
    entry.timeout = setTimeout(() => {
      if (TERMINAL_STATES.has(entry.operation.state)) return;
      entry.forcedCategory = "timeout";
      void this.ctx.careerWorkbench
        .requestChildCancellation(
          entry.authority,
          entry.operation.id,
          entry.operation.revision,
          "Configured child timeout elapsed.",
          this.command("child-timeout", entry.operation.id),
          new AbortController().signal,
        )
        .then((operation) => {
          entry.operation = operation;
          this.ctx.subagents.interrupt(entry.childId, {
            kind: "ancestor",
            agent: entry.parent,
          });
        })
        .catch((error: unknown) => {
          this.ctx.logger.warn(
            `career-workbench: native child timeout failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }, timeoutMs);
  }

  public async start(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, [
      "contractVersion",
      "parentOperationId",
      "label",
      "task",
      "provider",
      "model",
      "reasoningEffort",
      "maxDepth",
      "timeoutMs",
    ]);
    const parentOperationId = id(
      parsed["parentOperationId"],
      "parentOperationId",
    );
    const parent = await this.resolveDelegatingParent(
      parentOperationId,
      exec.agent,
      exec.signal,
    );
    if (parent.depth + 1 > this.config.maxDepth) {
      throw new CareerWorkbenchError(
        "Native child depth exceeds the configured product bound.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    if (this.activeFor(parent.agent) >= this.config.maxConcurrentChildren) {
      throw new CareerWorkbenchError(
        "Native child concurrency exceeds the configured product bound.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    if (parent.operation.inputIdentity === null) {
      throw new CareerWorkbenchError(
        "Parent operation has no bounded input identity.",
        "OPERATION_INDETERMINATE",
      );
    }
    const label = requiredText(parsed["label"], "label", 120);
    const task = requiredText(parsed["task"], "task", 8_000);
    const explicitProvider = text(parsed["provider"], "provider", 100, true);
    const explicitModel = text(parsed["model"], "model", 200, true);
    const explicitEffort = text(
      parsed["reasoningEffort"],
      "reasoningEffort",
      50,
      true,
    );
    const provider = explicitProvider ?? parent.authority.provider;
    const model = explicitModel ?? parent.authority.model;
    const routeChanged =
      provider !== parent.authority.provider ||
      model !== parent.authority.model;
    const reasoningEffort =
      explicitEffort ??
      (routeChanged ? undefined : parent.authority.reasoningEffort);
    const maxDepth = integer(
      parsed["maxDepth"],
      "maxDepth",
      1,
      this.config.maxDepth,
      this.config.maxDepth,
    );
    const timeoutMs = integer(
      parsed["timeoutMs"],
      "timeoutMs",
      1_000,
      600_000,
      this.config.defaultTimeoutMs,
    );
    const childId = SessionId(randomUUID());
    const admitted = await this.ctx.careerWorkbench.admitChildOperation(
      parent.authority,
      {
        parentOperationId,
        inputIdentity: parent.operation.inputIdentity,
        childSessionId: String(childId),
        provider,
        model,
        ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
      },
      this.command("child-admit", parentOperationId),
      exec.signal,
    );
    const entry: ChildEntry = {
      childId,
      parent: parent.agent,
      authority: parent.authority,
      depth: parent.depth + 1,
      operation: admitted,
      accepted: false,
    };
    this.byOperation.set(admitted.id, entry);
    this.byChild.set(String(childId), entry);
    try {
      const agentOptions: AgentOptions | undefined =
        explicitProvider === undefined &&
        explicitModel === undefined &&
        explicitEffort === undefined
          ? undefined
          : {
              provider,
              model,
              ...(reasoningEffort === undefined
                ? {}
                : { reasoningEffort: ReasoningEffortId(reasoningEffort) }),
            };
      const accepted = await this.ctx.subagents.startContinuable({
        provider: this.config.provider,
        label,
        childId,
        request: {
          prompt: [{ type: "text", text: task }],
          parent: parent.agent,
          maxDepth,
          ...(agentOptions === undefined ? {} : { agentOptions }),
        },
        signal: exec.signal,
      });
      entry.operation = await this.ctx.careerWorkbench.recordChildActivity(
        parent.authority,
        admitted.id,
        {
          expectedRevision: admitted.revision,
          phase: "started",
          messageId: String(accepted.messageId),
        },
        this.command("child-start", admitted.id),
        exec.signal,
      );
      entry.accepted = true;
      this.armTimeout(entry, timeoutMs);
      if (entry.pendingEnd !== undefined)
        this.queueSettlement(entry, entry.pendingEnd);
      return {
        contractVersion: "v1",
        operationId: entry.operation.id,
        childSessionId: String(accepted.childId),
        messageId: String(accepted.messageId),
        state: entry.operation.state,
        inheritedModel:
          explicitProvider === undefined && explicitModel === undefined,
      };
    } catch (error) {
      entry.accepted = true;
      entry.operation = await this.ctx.careerWorkbench.settleChildOperation(
        parent.authority,
        admitted.id,
        {
          expectedRevision: admitted.revision,
          state: exec.signal.aborted ? "canceled" : "failed",
          category: exec.signal.aborted ? "start_canceled" : "start_failed",
          message:
            "Native child failed before DSH accepted its initial message.",
        },
        this.command("child-start-failed", admitted.id),
        new AbortController().signal,
      );
      throw error;
    }
  }

  public async followup(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, [
      "contractVersion",
      "operationId",
      "message",
      "requestId",
      "timeoutMs",
    ]);
    const previous = await this.entryForParent(
      id(parsed["operationId"], "operationId"),
      exec.agent,
      exec.signal,
    );
    const requestId =
      parsed["requestId"] === undefined
        ? undefined
        : id(parsed["requestId"], "requestId");
    const suppliedMessage = text(parsed["message"], "message", 8_000, true);
    let message = suppliedMessage;
    if (requestId !== undefined) {
      const context = await this.ctx.careerWorkbench.context(
        previous.authority,
        undefined,
        exec.signal,
      );
      const pending = context.pendingFollowups.find(
        (item) =>
          item.requestId === requestId &&
          item.operationId === previous.operation.id,
      );
      if (pending === undefined) {
        throw new CareerWorkbenchError(
          "Follow-up request is absent, already delivered, or belongs to another child.",
          "APPROVAL_DENIED",
        );
      }
      if (message !== undefined && message !== pending.message) {
        throw new CareerWorkbenchError(
          "Supplied follow-up does not exactly match the recorded user request.",
          "APPROVAL_DENIED",
        );
      }
      message = pending.message;
    }
    if (message === undefined) {
      return invalid("message or requestId is required.");
    }
    const timeoutMs = integer(
      parsed["timeoutMs"],
      "timeoutMs",
      1_000,
      600_000,
      this.config.defaultTimeoutMs,
    );
    if (previous.operation.inputIdentity === null) {
      throw new CareerWorkbenchError(
        "Child operation has no bounded input identity.",
        "OPERATION_INDETERMINATE",
      );
    }
    const admitted = await this.ctx.careerWorkbench.admitChildOperation(
      previous.authority,
      {
        parentOperationId: previous.operation.id,
        inputIdentity: previous.operation.inputIdentity,
        childSessionId: String(previous.childId),
        provider: previous.authority.provider,
        model: previous.authority.model,
        ...(previous.authority.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: previous.authority.reasoningEffort }),
      },
      this.command("child-followup-admit", previous.operation.id),
      exec.signal,
    );
    const next: ChildEntry = {
      childId: previous.childId,
      parent: previous.parent,
      authority: previous.authority,
      depth: previous.depth,
      operation: admitted,
      accepted: false,
    };
    this.byOperation.set(admitted.id, next);
    this.byChild.set(String(next.childId), next);
    try {
      const messageId = await this.ctx.subagents.followup(
        next.parent,
        next.childId,
        [{ type: "text", text: message }],
        {
          source: {
            kind: "coordinator",
            form: "relay",
            senderSessionId: next.parent.id,
          },
          signal: exec.signal,
        },
      );
      next.operation = await this.ctx.careerWorkbench.recordChildActivity(
        next.authority,
        next.operation.id,
        {
          expectedRevision: next.operation.revision,
          phase: "followup",
          message,
          messageId: String(messageId),
          ...(requestId === undefined ? {} : { requestId }),
        },
        this.command("child-followup", next.operation.id),
        exec.signal,
      );
      next.accepted = true;
      this.armTimeout(next, timeoutMs);
      if (next.pendingEnd !== undefined)
        this.queueSettlement(next, next.pendingEnd);
      return {
        contractVersion: "v1",
        operationId: next.operation.id,
        childSessionId: String(next.childId),
        messageId: String(messageId),
        state: next.operation.state,
      };
    } catch (error) {
      next.accepted = true;
      next.operation = await this.ctx.careerWorkbench.settleChildOperation(
        next.authority,
        next.operation.id,
        {
          expectedRevision: next.operation.revision,
          state: exec.signal.aborted ? "canceled" : "failed",
          category: exec.signal.aborted
            ? "followup_canceled"
            : "followup_failed",
          message: "DSH did not accept the native child follow-up.",
        },
        this.command("child-followup-failed", next.operation.id),
        new AbortController().signal,
      );
      throw error;
    }
  }

  public async report(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, [
      "contractVersion",
      "operationId",
      "report",
      "delivery",
    ]);
    const operationId = id(parsed["operationId"], "operationId");
    const entry = this.byOperation.get(operationId);
    if (
      entry === undefined ||
      exec.agent === undefined ||
      String(exec.agent.id) !== String(entry.childId)
    ) {
      throw new CareerWorkbenchError(
        "Only the exact live child Agent may report for this operation.",
        "APPROVAL_DENIED",
      );
    }
    if (TERMINAL_STATES.has(entry.operation.state)) {
      throw new CareerWorkbenchError(
        "A terminal child operation cannot accept another report.",
        "INVALID_TRANSITION",
      );
    }
    const report = requiredText(parsed["report"], "report", MAX_REPORT_LENGTH);
    const delivery = parsed["delivery"] ?? "quiet";
    if (delivery !== "quiet" && delivery !== "next-step") {
      return invalid("delivery must be quiet or next-step.");
    }
    const messageId = await this.ctx.subagents.reportFrom(
      exec.agent,
      [{ type: "text", text: report }],
      { delivery, signal: exec.signal },
    );
    entry.operation = await this.ctx.careerWorkbench.recordChildActivity(
      agentAuthority(exec.agent),
      operationId,
      {
        expectedRevision: entry.operation.revision,
        phase: "report",
        message: report,
        messageId: String(messageId),
      },
      this.command("child-report", operationId),
      exec.signal,
    );
    return {
      contractVersion: "v1",
      operationId,
      messageId: String(messageId),
      accepted: true,
    };
  }

  public async cancel(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, ["contractVersion", "operationId", "reason"]);
    const entry = await this.entryForParent(
      id(parsed["operationId"], "operationId"),
      exec.agent,
      exec.signal,
    );
    const reason = requiredText(parsed["reason"], "reason", 500);
    entry.operation = await this.ctx.careerWorkbench.requestChildCancellation(
      entry.authority,
      entry.operation.id,
      entry.operation.revision,
      reason,
      this.command("child-cancel", entry.operation.id),
      exec.signal,
    );
    this.ctx.subagents.interrupt(entry.childId, {
      kind: "ancestor",
      agent: entry.parent,
    });
    return {
      contractVersion: "v1",
      operationId: entry.operation.id,
      childSessionId: String(entry.childId),
      cancellationRequested: true,
    };
  }

  public async delete(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, ["contractVersion", "operationId"]);
    const entry = await this.entryForParent(
      id(parsed["operationId"], "operationId"),
      exec.agent,
      exec.signal,
    );
    const runtime = this.ctx.subagents as SubagentRuntime & {
      deleteContinuable?: SubagentRuntime["deleteContinuable"];
    };
    if (typeof runtime.deleteContinuable !== "function") {
      throw new CareerWorkbenchError(
        "Native child deletion requires the pinned public DSH deletion seam patch.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    await runtime.deleteContinuable(entry.parent, entry.childId, {
      signal: exec.signal,
    });
    // A terminal settlement can finish after the status poll that preceded
    // deletion. Refresh the authoritative backend revision after DSH has
    // durably deleted the child so the audit activity never races a stale
    // cached projection.
    const refreshed = await this.loadOperation(
      entry.parent,
      entry.operation.id,
      exec.signal,
    );
    entry.operation = operationFromView(refreshed.operation);
    entry.operation = await this.ctx.careerWorkbench.recordChildActivity(
      entry.authority,
      entry.operation.id,
      { expectedRevision: entry.operation.revision, phase: "deleted" },
      this.command("child-delete", entry.operation.id),
      exec.signal,
    );
    return {
      contractVersion: "v1",
      operationId: entry.operation.id,
      childSessionId: String(entry.childId),
      deleted: true,
    };
  }

  public async status(
    args: unknown,
    exec: ToolRunContext,
  ): Promise<Readonly<Record<string, unknown>>> {
    const parsed = object(args, ["contractVersion", "parentOperationId"]);
    const parentOperationId = id(
      parsed["parentOperationId"],
      "parentOperationId",
    );
    const parent = await this.resolveDelegatingParent(
      parentOperationId,
      exec.agent,
      exec.signal,
    );
    const context = await this.ctx.careerWorkbench.context(
      parent.authority,
      undefined,
      exec.signal,
    );
    const children = context.operations
      .filter((item) => item.route === "native_child")
      .filter((item) => {
        let cursor: OperationView | undefined = item;
        const seen = new Set<string>();
        while (cursor !== undefined && !seen.has(cursor.id)) {
          if (cursor.parentOperationId === parentOperationId) return true;
          seen.add(cursor.id);
          cursor =
            cursor.parentOperationId === null
              ? undefined
              : context.operations.find(
                  (candidate) => candidate.id === cursor?.parentOperationId,
                );
        }
        return false;
      })
      .slice(-128)
      .map((item) => ({
        operationId: item.id,
        childSessionId: item.dshSessionId,
        parentOperationId: item.parentOperationId,
        state: item.state,
        revision: item.revision,
        startedAt: item.startedAt,
        terminalAt: item.terminalAt,
        terminalCategory: item.terminalCategory,
        cancellationRequestedAt: item.cancellationRequestedAt,
      }));
    const encoded = JSON.stringify(children);
    const pending = JSON.stringify(
      context.pendingFollowups.filter((item) =>
        children.some((child) => child.operationId === item.operationId),
      ),
    );
    if (
      new TextEncoder().encode(encoded).byteLength > 64 * 1024 ||
      new TextEncoder().encode(pending).byteLength > 64 * 1024
    ) {
      throw new CareerWorkbenchError(
        "Native child status exceeds the supported response bound.",
        "CAPABILITY_UNAVAILABLE",
      );
    }
    return {
      contractVersion: "v1",
      parentOperationId,
      childrenJson: encoded,
      pendingFollowupsJson: pending,
    };
  }
}

export const CHILD_TOOL_NAMES = [
  "career_workbench_start_child",
  "career_workbench_child_status",
  "career_workbench_child_followup",
  "career_workbench_child_report",
  "career_workbench_cancel_child",
  "career_workbench_delete_child",
] as const;

function commonOutput(
  properties: Record<string, JsonSchemaNode>,
  required: string[],
) {
  return { schema: outputSchema(properties, required), render: renderJson };
}

export function createNativeChildTools(
  coordinator: NativeChildCoordinator,
): readonly ToolDefinition[] {
  const operation = idSchema("Authoritative native child operation.");
  return [
    {
      name: CHILD_TOOL_NAMES[0],
      description:
        "Admit a bounded native continuable DSH child. Receipt means the child inbox accepted the task, not that work completed.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          parentOperationId: idSchema("Authoritative parent operation."),
          label: stringSchema(
            "Short child label; runtime maximum 120 characters.",
          ),
          task: stringSchema(
            "Bounded untrusted-data-aware task; runtime maximum 8,000 characters.",
          ),
          provider: stringSchema(
            "Optional explicit child LLM provider override.",
          ),
          model: stringSchema("Optional explicit child model override."),
          reasoningEffort: stringSchema(
            "Optional explicit reasoning override.",
          ),
          maxDepth: { type: "integer" },
          timeoutMs: { type: "integer" },
        },
        required: ["contractVersion", "parentOperationId", "label", "task"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          operationId: operation,
          childSessionId: stringSchema("Durable DSH child session identity."),
          messageId: stringSchema("Accepted initial inbox message identity."),
          state: stringSchema("Authoritative operation state."),
          inheritedModel: { type: "boolean" },
        },
        [
          "contractVersion",
          "operationId",
          "childSessionId",
          "messageId",
          "state",
          "inheritedModel",
        ],
      ),
      execute: (args, exec) => coordinator.start(args, exec),
    },
    {
      name: CHILD_TOOL_NAMES[1],
      description:
        "Read bounded authoritative child lineage and lifecycle status. A start handle is not completion.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          parentOperationId: idSchema("Authoritative parent operation."),
        },
        required: ["contractVersion", "parentOperationId"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          parentOperationId: idSchema("Authoritative parent operation."),
          childrenJson: stringSchema("Bounded JSON lifecycle projection."),
          pendingFollowupsJson: stringSchema(
            "Bounded JSON user requests awaiting exact-parent delivery.",
          ),
        },
        [
          "contractVersion",
          "parentOperationId",
          "childrenJson",
          "pendingFollowupsJson",
        ],
      ),
      isConcurrencySafe: () => true,
      execute: (args, exec) => coordinator.status(args, exec),
    },
    {
      name: CHILD_TOOL_NAMES[2],
      description:
        "Deliver one exact follow-up to a durable continuable child through its exact live direct parent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          operationId: operation,
          message: stringSchema(
            "Follow-up text; runtime maximum 8,000 characters.",
          ),
          requestId: idSchema("Optional recorded browser follow-up request."),
          timeoutMs: { type: "integer" },
        },
        required: ["contractVersion", "operationId"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          operationId: operation,
          childSessionId: stringSchema("Durable DSH child session identity."),
          messageId: stringSchema("Accepted follow-up inbox message identity."),
          state: stringSchema("Authoritative operation state."),
        },
        [
          "contractVersion",
          "operationId",
          "childSessionId",
          "messageId",
          "state",
        ],
      ),
      execute: (args, exec) => coordinator.followup(args, exec),
    },
    {
      name: CHILD_TOOL_NAMES[3],
      description:
        "Report bounded selected content from the exact live child to its direct parent without granting mutation authority.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          operationId: operation,
          report: stringSchema(
            "Selected report; runtime maximum 16,384 characters.",
          ),
          delivery: { type: "string", enum: ["quiet", "next-step"] },
        },
        required: ["contractVersion", "operationId", "report"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          operationId: operation,
          messageId: stringSchema("Parent-accepted message identity."),
          accepted: { type: "boolean", const: true },
        },
        ["contractVersion", "operationId", "messageId", "accepted"],
      ),
      execute: (args, exec) => coordinator.report(args, exec),
    },
    {
      name: CHILD_TOOL_NAMES[4],
      description:
        "Request cancellation and issue a public DSH interrupt. The receipt is not terminal settlement.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          operationId: operation,
          reason: stringSchema(
            "Cancellation reason; runtime maximum 500 characters.",
          ),
        },
        required: ["contractVersion", "operationId", "reason"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          operationId: operation,
          childSessionId: stringSchema("Durable DSH child session identity."),
          cancellationRequested: { type: "boolean", const: true },
        },
        [
          "contractVersion",
          "operationId",
          "childSessionId",
          "cancellationRequested",
        ],
      ),
      execute: (args, exec) => coordinator.cancel(args, exec),
    },
    {
      name: CHILD_TOOL_NAMES[5],
      description:
        "Permanently revoke a continuable child through the pinned public DSH deletion seam while retaining audit history.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          contractVersion: contractVersionSchema,
          operationId: operation,
        },
        required: ["contractVersion", "operationId"],
      },
      output: commonOutput(
        {
          contractVersion: contractVersionSchema,
          operationId: operation,
          childSessionId: stringSchema("Durable DSH child session identity."),
          deleted: { type: "boolean", const: true },
        },
        ["contractVersion", "operationId", "childSessionId", "deleted"],
      ),
      execute: (args, exec) => coordinator.delete(args, exec),
    },
  ];
}
