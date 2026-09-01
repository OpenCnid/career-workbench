import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../apps/server/src/server.js";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";
import type {
  DomainEvent,
  Operation,
  UtcTimestamp,
} from "../../packages/domain/src/index.js";
import { SqliteWorkspaceStore } from "../../packages/storage/src/index.js";

const CSRF = "synthetic-recovery-csrf-000000000000";
const DSH_TOKEN = "synthetic-recovery-dsh-token-000000000000";
const DSH_SESSION = "synthetic-recovery-session";
const HOST = "127.0.0.1:4173";
const RECOVERY_CATEGORY = "backend_restart_without_terminal";
const RECOVERY_MESSAGE =
  "Operation became indeterminate during backend restart because no trusted terminal was recorded. No work was replayed.";

interface Identified {
  readonly id: string;
  readonly revision: number;
}

interface Snapshot {
  readonly operations: readonly Operation[];
  readonly events: readonly DomainEvent[];
}

describe("backend startup operation recovery", () => {
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
      "x-idempotency-key": `synthetic-recovery-browser-${String(serial)}`,
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
      "x-idempotency-key": `synthetic-recovery-dsh-${String(serial)}`,
      ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
    };
  }

  async function snapshot(): Promise<Snapshot> {
    if (server === null) throw new Error("Synthetic server is not running.");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    expect(response.statusCode).toBe(200);
    return response.json<Snapshot>();
  }

  it("terminalizes persisted queued, running, and waiting operations exactly once without replay", async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-recovery-"));
    const workspaceRoot = join(parent, "workspace");
    server = await createServer({
      workspaceRoot,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("SYN7HREC00"),
    });

    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: browserHeaders(),
      payload: {
        displayName: "Synthetic recovery workspace",
        locale: "en-US",
        timezone: "America/Chicago",
      },
    });
    expect(workspaceResponse.statusCode, workspaceResponse.body).toBe(201);

    const sourceResponse = await server.inject({
      method: "POST",
      url: "/api/v1/sources",
      headers: browserHeaders(),
      payload: {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: "Synthetic Labs seeks a recovery-aware platform engineer.",
        originalLocator: "https://example.test/jobs/recovery",
      },
    });
    expect(sourceResponse.statusCode, sourceResponse.body).toBe(201);
    const source = sourceResponse.json<Identified>();

    const opportunityResponse = await server.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: browserHeaders(),
      payload: {
        sourceDocumentId: source.id,
        organization: "Synthetic Labs",
        roleTitle: "Recovery-aware Platform Engineer",
        originalUrl: "https://example.test/jobs/recovery",
      },
    });
    expect(opportunityResponse.statusCode, opportunityResponse.body).toBe(201);
    const opportunity = opportunityResponse.json<Identified>();

    const startOperation = async (
      kind: string,
      admissionOnly: boolean,
    ): Promise<Operation> => {
      if (server === null) throw new Error("Synthetic server is not running.");
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/operations",
        headers: dshHeaders(),
        payload: {
          kind,
          inputIdentity: opportunity.id,
          requestedCapabilities: ["evaluation"],
          route: "ordinary_dsh",
          dshSessionId: DSH_SESSION,
          provider: "openai-codex",
          model: "gpt-5.6-sol",
          reasoningEffort: "high",
          admissionOnly,
        },
      });
      expect(response.statusCode, response.body).toBe(201);
      return response.json<Operation>();
    };

    const queued = await startOperation("synthetic_queued", true);
    const running = await startOperation("synthetic_running", false);
    const waiting = await startOperation("synthetic_waiting", false);
    const completed = await startOperation("synthetic_completed", false);
    const completedResponse = await server.inject({
      method: "POST",
      url: `/api/v1/operations/${completed.id}/terminal`,
      headers: dshHeaders(completed.id),
      payload: {
        expectedRevision: completed.revision,
        state: "succeeded",
        category: "completed",
        message: "Synthetic trusted terminal.",
        resultIds: [],
        artifactIds: [],
      },
    });
    expect(completedResponse.statusCode, completedResponse.body).toBe(200);
    const trustedTerminal = completedResponse.json<Operation>();

    await server.close();
    server = null;

    const fixtureTimestamp = new Date().toISOString() as UtcTimestamp;
    const fixtureStore = await SqliteWorkspaceStore.open(
      workspaceRoot,
      fixtureTimestamp,
    );
    const workspace = await fixtureStore.findWorkspace();
    if (workspace === null) throw new Error("Synthetic workspace disappeared.");
    const persistedWaiting = await fixtureStore.get("operation", waiting.id);
    const waitingForUser: Operation = {
      ...persistedWaiting,
      state: "waiting_for_user",
      revision: persistedWaiting.revision + 1,
      updatedAt: fixtureTimestamp,
      lastActivityAt: fixtureTimestamp,
    };
    await fixtureStore.commit({
      workspaceId: workspace.id,
      context: {
        actor: "system",
        commandId: new DeterministicIdFactory("SYN7HREC01").entity("command"),
        idempotencyKey: "synthetic-waiting-fixture",
        operationId: waiting.id,
      },
      command: {
        kind: "test.operation.waiting_for_user",
        operationId: waiting.id,
      },
      mutations: [
        {
          action: "update",
          kind: "operation",
          entity: waitingForUser,
          expectedRevision: persistedWaiting.revision,
        },
      ],
      events: [
        {
          eventKind: "operation.waiting_for_user",
          aggregateId: waiting.id,
          aggregateRevision: waitingForUser.revision,
          payload: { reason: "Synthetic restart boundary." },
          timestamp: fixtureTimestamp,
          actor: "system",
          operationId: waiting.id,
        },
      ],
      result: waitingForUser,
    });
    await fixtureStore.close();

    server = await createServer({
      workspaceRoot,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("SYN7HREC02"),
    });
    const recovered = await snapshot();
    const recoveredById = new Map(
      recovered.operations.map((operation) => [operation.id, operation]),
    );
    for (const original of [queued, running, waitingForUser]) {
      expect(recoveredById.get(original.id)).toMatchObject({
        state: "indeterminate",
        revision: original.revision + 1,
        terminalCategory: RECOVERY_CATEGORY,
        terminalMessage: RECOVERY_MESSAGE,
        resultIds: original.resultIds,
        artifactIds: original.artifactIds,
      });
      expect(recoveredById.get(original.id)?.terminalAt).not.toBeNull();
    }
    expect(recoveredById.get(queued.id)?.startedAt).toBeNull();
    expect(recoveredById.get(trustedTerminal.id)).toEqual(trustedTerminal);

    const recoveryEvents = recovered.events.filter(
      (event) => event.payload["category"] === RECOVERY_CATEGORY,
    );
    expect(recoveryEvents).toHaveLength(3);
    for (const original of [queued, running, waitingForUser]) {
      expect(
        recoveryEvents.find((event) => event.aggregateId === original.id),
      ).toMatchObject({
        eventKind: "operation.terminal",
        aggregateId: original.id,
        aggregateRevision: original.revision + 1,
        operationId: original.id,
        actor: "system",
        payload: {
          state: "indeterminate",
          category: RECOVERY_CATEGORY,
          previousState: original.state,
          replayed: false,
        },
      });
    }
    const lastSequence = recovered.events.at(-1)?.sequence;
    const firstRecoveryOperations = recovered.operations;

    await server.close();
    server = await createServer({
      workspaceRoot,
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      idFactory: new DeterministicIdFactory("SYN7HREC03"),
    });
    const reopenedAgain = await snapshot();
    expect(reopenedAgain.operations).toEqual(firstRecoveryOperations);
    expect(reopenedAgain.events.at(-1)?.sequence).toBe(lastSequence);
    expect(
      reopenedAgain.events.filter(
        (event) => event.payload["category"] === RECOVERY_CATEGORY,
      ),
    ).toHaveLength(3);
  });
});
