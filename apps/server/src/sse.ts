import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "@career-workbench/domain";
import { requireStore, type Runtime } from "./server.js";

export function registerEventRoutes(
  server: FastifyInstance,
  runtime: Runtime,
): void {
  server.get<{ Querystring: { after?: string; limit?: string } }>(
    "/api/v1/events",
    async (request) => {
      const workspace = runtime.workspace;
      if (workspace === null) {
        throw new DomainError(
          "workspace_not_found",
          "Create a workspace before reading activity.",
        );
      }
      const after = Number(request.query.after ?? "0");
      const limit = Number(request.query.limit ?? "100");
      if (
        !Number.isInteger(after) ||
        after < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 1000
      ) {
        throw new DomainError(
          "invalid_request",
          "Event cursor or limit is invalid.",
        );
      }
      return {
        events: await requireStore(runtime).eventsAfter(
          workspace.id,
          after,
          limit,
        ),
      };
    },
  );

  server.get<{ Querystring: { after?: string } }>(
    "/api/v1/events/stream",
    async (request, reply) => streamEvents(request, reply, runtime),
  );
}

async function streamEvents(
  request: FastifyRequest<{ Querystring: { after?: string } }>,
  reply: FastifyReply,
  runtime: Runtime,
): Promise<void> {
  if (runtime.store === null || runtime.workspace === null) {
    throw new DomainError(
      "workspace_not_found",
      "Create a workspace before opening activity.",
    );
  }
  const store = runtime.store;
  const workspace = runtime.workspace;
  const header = request.headers["last-event-id"];
  const rawCursor =
    request.query.after ?? (typeof header === "string" ? header : "0");
  let cursor = Number(rawCursor);
  if (!Number.isInteger(cursor) || cursor < 0) {
    throw new DomainError("invalid_request", "Event resume cursor is invalid.");
  }
  reply.hijack();
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  let polling = false;
  const poll = async (): Promise<void> => {
    if (polling || reply.raw.destroyed) return;
    polling = true;
    try {
      const events = await store.eventsAfter(workspace.id, cursor, 100);
      for (const item of events) {
        reply.raw.write(`id: ${String(item.sequence)}\n`);
        reply.raw.write("event: domain\n");
        reply.raw.write(`data: ${JSON.stringify(item)}\n\n`);
        cursor = item.sequence;
      }
    } finally {
      polling = false;
    }
  };
  await poll();
  const timer = setInterval(() => void poll(), 250);
  const heartbeat = setInterval(() => {
    if (!reply.raw.destroyed) reply.raw.write(": heartbeat\n\n");
  }, 15_000);
  request.raw.once("close", () => {
    clearInterval(timer);
    clearInterval(heartbeat);
  });
}
