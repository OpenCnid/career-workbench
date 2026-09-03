import { randomBytes, timingSafeEqual } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  RandomIdFactory,
  SystemClock,
  WorkbenchService,
  type IdFactory,
} from "@career-workbench/application";
import type { CareerOpsDiscovery } from "@career-workbench/career-ops-import";
import {
  ContractValidationError,
  CreateWorkspaceBodySchema,
  DiagnosticsResponseSchema,
  JobDiscoveryRunResponseSchema,
  ProfileOrganizationRunResponseSchema,
  StartJobDiscoveryBodySchema,
  StartProfileOrganizationBodySchema,
  parseJsonWithoutDuplicateKeys,
  type CreateWorkspaceBody,
  type DiagnosticsResponse,
  type JobDiscoveryRunResponse,
  type ProfileOrganizationRunResponse,
  type StartJobDiscoveryBody,
  type StartProfileOrganizationBody,
} from "@career-workbench/contracts";
import {
  DomainError,
  type CommandContext,
  type EntityId,
  type Workspace,
} from "@career-workbench/domain";
import {
  ContentAddressedArtifactStore,
  SqliteWorkspaceStore,
  STORAGE_SCHEMA_VERSION,
} from "@career-workbench/storage";
import {
  buildCompatibilityDiagnostics,
  CAREER_WORKBENCH_VERSION,
} from "./compatibility.js";
import { registerDomainRoutes } from "./routes.js";
import {
  DiscoveryRunError,
  EmbeddedDiscoveryRunner,
  type DiscoveryRunner,
} from "./discovery-runner.js";
import {
  EmbeddedProfileOrganizationRunner,
  ProfileOrganizationRunError,
  type ProfileOrganizationRunner,
} from "./profile-organization-runner.js";
import { registerEventRoutes } from "./sse.js";

export interface ServerOptions {
  readonly workspaceRoot: string;
  readonly webRoot?: string;
  readonly csrfToken?: string;
  readonly dshToken?: string;
  readonly rlmEnabled?: boolean;
  readonly idFactory?: IdFactory;
  readonly profileOrganizationRunner?: ProfileOrganizationRunner;
  readonly discoveryRunner?: DiscoveryRunner;
  readonly dshProvider?: string;
  readonly dshModel?: string;
  readonly dshReasoningEffort?: string;
}

export interface Runtime {
  store: SqliteWorkspaceStore | null;
  artifacts: ContentAddressedArtifactStore | null;
  service: WorkbenchService | null;
  workspace: Workspace | null;
  recentErrorCategories: DomainError["code"][];
  profileOrganizationsInFlight: Set<string>;
  jobDiscoveriesInFlight: Set<string>;
  careerOpsPreviews: Map<
    string,
    {
      readonly sourceDirectory: string;
      readonly discovery: CareerOpsDiscovery;
      readonly expiresAt: number;
    }
  >;
}

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const requestAuthorities = new WeakMap<
  FastifyRequest,
  {
    readonly actor: "browser" | "dsh_agent";
    readonly sessionId?: string;
    readonly operationId?: string;
  }
>();
const knownApiPaths = [
  /^\/api\/v1\/session$/u,
  /^\/api\/v1\/diagnostics$/u,
  /^\/api\/v1\/snapshot$/u,
  /^\/api\/v1\/events(?:\/stream)?$/u,
  /^\/api\/v1\/workspaces$/u,
  /^\/api\/v1\/(?:sources|profile-facts|search-profiles|discovery-leads|opportunities|evidence|rubrics|evaluations|artifacts|operations)$/u,
  /^\/api\/v1\/profile-organizations$/u,
  /^\/api\/v1\/job-discoveries$/u,
  /^\/api\/v1\/(?:applications|search|export)$/u,
  /^\/api\/v1\/approvals(?:\/[^/]+\/decision)?$/u,
  /^\/api\/v1\/applications\/[^/]+\/transitions$/u,
  /^\/api\/v1\/opportunities\/[^/]+\/signals$/u,
  /^\/api\/v1\/discovery-leads\/[^/]+\/triage$/u,
  /^\/api\/v1\/artifacts\/(?:candidate-drafts|[^/]+\/(?:review|content))$/u,
  /^\/api\/v1\/comparison-projections$/u,
  /^\/api\/v1\/comparisons\/[^/]+\/accept$/u,
  /^\/api\/v1\/imports\/career-ops\/(?:preview|[^/]+\/apply)$/u,
  /^\/api\/v1\/profile-facts\/[^/]+\/(?:confirm|corrections)$/u,
  /^\/api\/v1\/evidence\/[^/]+\/decision$/u,
  /^\/api\/v1\/evaluations\/(?:fixture|[^/]+\/artifacts)$/u,
  /^\/api\/v1\/operations\/[^/]+\/(?:activity|terminal|cancellation|followups|comparisons)$/u,
  /^\/api\/v1\/operations\/[^/]+\/cancellation-requests$/u,
];

function statusFor(code: DomainError["code"]): number {
  if (code === "entity_not_found" || code === "workspace_not_found") return 404;
  if (
    code === "revision_conflict" ||
    code === "duplicate_identity" ||
    code === "approval_stale"
  )
    return 409;
  if (code === "approval_required" || code === "approval_denied") return 403;
  if (code === "capability_unavailable") return 503;
  if (code === "internal_error") return 500;
  return 400;
}

function recordErrorCategory(
  runtime: Runtime,
  code: DomainError["code"],
): void {
  runtime.recentErrorCategories = [
    ...runtime.recentErrorCategories.filter((item) => item !== code),
    code,
  ].slice(-16);
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (header === undefined) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function requireMutationSecurity(
  request: FastifyRequest,
  csrfToken: string,
  dshToken: string | undefined,
): void {
  if (
    !request.headers["content-type"]
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new DomainError(
      "invalid_request",
      "Mutation requires application/json content.",
    );
  }
  const authorization = request.headers.authorization;
  if (authorization !== undefined) {
    const prefix = "CW-DSH ";
    const supplied = authorization.startsWith(prefix)
      ? authorization.slice(prefix.length)
      : "";
    const expectedBytes = dshToken === undefined ? null : Buffer.from(dshToken);
    const suppliedBytes = Buffer.from(supplied);
    const valid =
      expectedBytes?.length === suppliedBytes.length &&
      timingSafeEqual(suppliedBytes, expectedBytes);
    if (!valid) {
      throw new DomainError(
        "approval_denied",
        "DSH service authentication failed.",
      );
    }
    const sessionId = request.headers["x-cw-dsh-session"];
    if (
      typeof sessionId !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,200}$/u.test(sessionId)
    ) {
      throw new DomainError(
        "invalid_request",
        "DSH session correlation is missing or invalid.",
      );
    }
    const operationId = request.headers["x-cw-operation"];
    if (
      operationId !== undefined &&
      (typeof operationId !== "string" ||
        !/^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$/u.test(operationId))
    ) {
      throw new DomainError(
        "invalid_request",
        "Operation correlation is invalid.",
      );
    }
    requestAuthorities.set(request, {
      actor: "dsh_agent",
      sessionId,
      ...(typeof operationId === "string" ? { operationId } : {}),
    });
    return;
  }
  const host = request.headers.host;
  const origin = request.headers.origin;
  if (host === undefined || origin === undefined) {
    throw new DomainError(
      "external_content_rejected",
      "Mutation requires an explicit same-origin request.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new DomainError(
      "external_content_rejected",
      "Mutation origin is invalid.",
    );
  }
  if (
    parsed.origin !== `http://${host}` ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
  ) {
    throw new DomainError(
      "external_content_rejected",
      "Cross-origin mutation was rejected.",
    );
  }
  const fetchSite = request.headers["sec-fetch-site"];
  if (
    fetchSite !== undefined &&
    fetchSite !== "same-origin" &&
    fetchSite !== "none"
  ) {
    throw new DomainError(
      "external_content_rejected",
      "Cross-site mutation was rejected.",
    );
  }
  const headerToken = request.headers["x-cw-csrf"];
  const cookieToken = cookieValue(request.headers.cookie, "cw_csrf");
  if (headerToken !== csrfToken || cookieToken !== csrfToken) {
    throw new DomainError(
      "approval_required",
      "CSRF proof is missing or invalid.",
    );
  }
  requestAuthorities.set(request, { actor: "browser" });
}

export function commandContext(
  request: FastifyRequest,
  ids: IdFactory,
  suffix = "",
): CommandContext {
  const key = request.headers["x-idempotency-key"];
  if (typeof key !== "string" || key.length < 16 || key.length > 128) {
    throw new DomainError(
      "invalid_request",
      "Mutation requires a bounded idempotency key.",
    );
  }
  const authority = requestAuthorities.get(request);
  return {
    commandId: ids.entity("command"),
    actor: authority?.actor ?? "browser",
    idempotencyKey: suffix.length === 0 ? key : `${key}:${suffix}`,
    ...(authority?.operationId === undefined
      ? {}
      : { operationId: authority.operationId as EntityId }),
    ...(authority?.sessionId === undefined
      ? {}
      : { dshSessionId: authority.sessionId }),
  };
}

export function dshSessionFor(request: FastifyRequest): string | null {
  return requestAuthorities.get(request)?.sessionId ?? null;
}

export function subcommand(
  base: CommandContext,
  ids: IdFactory,
  suffix: string,
): CommandContext {
  return {
    commandId: ids.entity("command"),
    actor: base.actor,
    idempotencyKey: `${base.idempotencyKey}:${suffix}`,
    ...(base.operationId === undefined
      ? {}
      : { operationId: base.operationId }),
    ...(base.dshSessionId === undefined
      ? {}
      : { dshSessionId: base.dshSessionId }),
  };
}

export function requireService(runtime: Runtime): WorkbenchService {
  if (runtime.service === null) {
    throw new DomainError(
      "workspace_not_found",
      "Create a workspace before using this route.",
    );
  }
  return runtime.service;
}

export function requireStore(runtime: Runtime): SqliteWorkspaceStore {
  if (runtime.store === null || runtime.workspace === null) {
    throw new DomainError(
      "workspace_not_found",
      "Create a workspace before using this route.",
    );
  }
  return runtime.store;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function createServer(
  options: ServerOptions,
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
    forceCloseConnections: true,
    ajv: { customOptions: { removeAdditional: false, allErrors: true } },
    bodyLimit: 7_100_000,
  });
  const csrfToken = options.csrfToken ?? randomBytes(32).toString("base64url");
  if (options.dshToken !== undefined && options.dshToken.length < 32) {
    throw new Error("DSH service token must contain at least 32 characters.");
  }
  const ids = options.idFactory ?? new RandomIdFactory();
  const clock = new SystemClock();
  const runtime: Runtime = {
    store: null,
    artifacts: null,
    service: null,
    workspace: null,
    recentErrorCategories: [],
    profileOrganizationsInFlight: new Set(),
    jobDiscoveriesInFlight: new Set(),
    careerOpsPreviews: new Map(),
  };
  const profileOrganizationRunner =
    options.profileOrganizationRunner ??
    (options.dshToken === undefined
      ? null
      : new EmbeddedProfileOrganizationRunner({
          serviceToken: options.dshToken,
          provider: options.dshProvider ?? "openai-codex",
          model: options.dshModel ?? "gpt-5.6-sol",
          reasoningEffort: options.dshReasoningEffort ?? "low",
        }));
  const discoveryRunner =
    options.discoveryRunner ??
    (options.dshToken === undefined
      ? null
      : new EmbeddedDiscoveryRunner({
          serviceToken: options.dshToken,
          provider: options.dshProvider ?? "openai-codex",
          model: options.dshModel ?? "gpt-5.6-sol",
          reasoningEffort: options.dshReasoningEffort ?? "low",
        }));

  if (
    await pathExists(join(options.workspaceRoot, "career-workbench.sqlite"))
  ) {
    runtime.store = await SqliteWorkspaceStore.open(
      options.workspaceRoot,
      clock.now(),
    );
    runtime.workspace = await runtime.store.findWorkspace();
    if (runtime.workspace !== null) {
      runtime.artifacts = new ContentAddressedArtifactStore(
        options.workspaceRoot,
      );
      runtime.service = new WorkbenchService(
        runtime.workspace.id,
        runtime.store,
        runtime.artifacts,
        ids,
        clock,
      );
      await runtime.service.reconcileInterruptedOperations({
        actor: "system",
        commandId: ids.entity("command"),
        idempotencyKey: "startup-recovery",
      });
    }
  }

  server.removeContentTypeParser("application/json");
  server.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        done(
          null,
          parseJsonWithoutDuplicateKeys(
            typeof body === "string" ? body : body.toString("utf8"),
          ),
        );
      } catch (error) {
        done(error as Error);
      }
    },
  );

  server.addHook("onRequest", (request, _reply, done) => {
    if (mutationMethods.has(request.method)) {
      requireMutationSecurity(request, csrfToken, options.dshToken);
    }
    done();
  });

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      recordErrorCategory(runtime, error.code);
      void reply.status(statusFor(error.code)).send({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
      return;
    }
    if (
      error instanceof ContractValidationError ||
      (error as { validation?: unknown }).validation !== undefined
    ) {
      recordErrorCategory(runtime, "invalid_request");
      void reply.status(400).send({
        error: {
          code: "invalid_request",
          message: "Request does not match the closed API contract.",
          retryable: false,
        },
      });
      return;
    }
    recordErrorCategory(runtime, "internal_error");
    void reply.status(500).send({
      error: {
        code: "internal_error",
        message: "Internal operation failed.",
        retryable: false,
      },
    });
  });

  server.get("/api/v1/session", async (_request, reply) => {
    reply.header(
      "set-cookie",
      `cw_csrf=${csrfToken}; Path=/api/v1; HttpOnly; SameSite=Strict`,
    );
    reply.header("cache-control", "no-store");
    return { contractVersion: "v1", csrfToken };
  });

  server.post<{ Body: CreateWorkspaceBody }>(
    "/api/v1/workspaces",
    { schema: { body: CreateWorkspaceBodySchema } },
    async (request, reply) => {
      if (runtime.workspace !== null) {
        throw new DomainError(
          "duplicate_identity",
          "This local server already owns a workspace.",
        );
      }
      runtime.store = await SqliteWorkspaceStore.create(
        options.workspaceRoot,
        clock.now(),
      );
      runtime.artifacts = new ContentAddressedArtifactStore(
        options.workspaceRoot,
      );
      const workspaceId = ids.workspace();
      runtime.service = new WorkbenchService(
        workspaceId,
        runtime.store,
        runtime.artifacts,
        ids,
        clock,
      );
      runtime.workspace = await runtime.service.initializeWorkspace(
        request.body,
        commandContext(request, ids),
      );
      return reply.status(201).send(runtime.workspace);
    },
  );

  server.get("/api/v1/snapshot", async () => {
    const workspace = runtime.workspace;
    if (workspace === null) {
      return {
        contractVersion: "v1",
        workspace: null,
        sources: [],
        profileFacts: [],
        searchProfiles: [],
        discoveryLeads: [],
        opportunities: [],
        evidence: [],
        rubrics: [],
        evaluations: [],
        comparisons: [],
        applications: [],
        importManifests: [],
        artifacts: [],
        operations: [],
        events: [],
      };
    }
    const repository = requireStore(runtime);
    const [
      sources,
      profileFacts,
      searchProfiles,
      discoveryLeads,
      opportunities,
      evidence,
      rubrics,
      evaluations,
      comparisons,
      applications,
      importManifests,
      artifacts,
      operations,
      events,
    ] = await Promise.all([
      repository.list("source", workspace.id),
      repository.list("profileFact", workspace.id),
      repository.list("searchProfile", workspace.id),
      repository.list("discoveryLead", workspace.id),
      repository.list("opportunity", workspace.id),
      repository.list("evidence", workspace.id),
      repository.list("rubric", workspace.id),
      repository.list("evaluation", workspace.id),
      repository.list("comparison", workspace.id),
      repository.list("application", workspace.id),
      repository.list("importManifest", workspace.id),
      repository.list("artifact", workspace.id),
      repository.list("operation", workspace.id),
      repository.recentEvents(workspace.id, 1000),
    ]);
    return {
      contractVersion: "v1",
      workspace: await repository.get("workspace", workspace.id),
      sources,
      profileFacts,
      searchProfiles,
      discoveryLeads,
      opportunities,
      evidence,
      rubrics,
      evaluations,
      comparisons,
      applications,
      importManifests,
      artifacts,
      operations,
      events,
    };
  });

  server.post<{ Body: StartProfileOrganizationBody }>(
    "/api/v1/profile-organizations",
    {
      schema: {
        body: StartProfileOrganizationBodySchema,
        response: { 200: ProfileOrganizationRunResponseSchema },
      },
    },
    async (request): Promise<ProfileOrganizationRunResponse> => {
      commandContext(request, ids);
      requireService(runtime);
      const repository = requireStore(runtime);
      if (profileOrganizationRunner === null) {
        throw new DomainError(
          "capability_unavailable",
          "The in-page DSH organizer is not configured. Start Career Workbench with DSH enabled.",
        );
      }
      const source = await repository.get("source", request.body.sourceId);
      if (
        source.kind !== "candidate" ||
        source.trustClass !== "candidate_primary"
      ) {
        throw new DomainError(
          "invalid_request",
          "Profile organization requires a saved candidate-primary source.",
        );
      }
      if (runtime.profileOrganizationsInFlight.has(source.id)) {
        throw new DomainError(
          "duplicate_identity",
          "This source is already being organized by DSH.",
        );
      }
      const origin = request.headers.origin;
      if (origin === undefined) {
        throw new DomainError(
          "external_content_rejected",
          "The in-page organizer requires an explicit same-origin request.",
        );
      }
      const controller = new AbortController();
      const abort = (): void => controller.abort();
      request.raw.once("aborted", abort);
      runtime.profileOrganizationsInFlight.add(source.id);
      try {
        const run = await profileOrganizationRunner.run(
          source.id,
          new URL(`${origin}/`),
          controller.signal,
        );
        const operation = (
          await repository.list("operation", source.workspaceId)
        ).find(
          (item) =>
            item.kind === "profile_organization" &&
            item.inputIdentity === source.id &&
            item.dshSessionId === run.sessionId &&
            item.state === "succeeded",
        );
        if (operation === undefined) {
          throw new DomainError(
            "operation_indeterminate",
            "DSH ended without a canonical completed organization operation. Retry the source organization.",
          );
        }
        return {
          contractVersion: "v1",
          sourceId: source.id,
          sessionId: run.sessionId,
          operationId: operation.id,
          state: "succeeded",
          proposedFactIds: [...operation.resultIds],
          provider: run.provider,
          model: run.model,
          reasoningEffort: run.reasoningEffort,
        };
      } catch (error) {
        if (error instanceof ProfileOrganizationRunError) {
          if (error.code === "CAPABILITY_UNAVAILABLE") {
            throw new DomainError("capability_unavailable", error.message);
          }
          if (error.code === "RUN_ABORTED") {
            throw new DomainError("operation_canceled", error.message);
          }
          throw new DomainError("operation_indeterminate", error.message);
        }
        throw error;
      } finally {
        request.raw.off("aborted", abort);
        runtime.profileOrganizationsInFlight.delete(source.id);
      }
    },
  );

  server.post<{ Body: StartJobDiscoveryBody }>(
    "/api/v1/job-discoveries",
    {
      schema: {
        body: StartJobDiscoveryBodySchema,
        response: { 200: JobDiscoveryRunResponseSchema },
      },
    },
    async (request): Promise<JobDiscoveryRunResponse> => {
      commandContext(request, ids);
      requireService(runtime);
      const repository = requireStore(runtime);
      if (discoveryRunner === null) {
        throw new DomainError(
          "capability_unavailable",
          "In-page job discovery is not configured. Start Career Workbench with DSH enabled.",
        );
      }
      const searchProfile = await repository.get(
        "searchProfile",
        request.body.searchProfileId,
      );
      if (!searchProfile.active) {
        throw new DomainError(
          "invalid_request",
          "Activate the saved search before finding jobs.",
        );
      }
      if (runtime.jobDiscoveriesInFlight.has(searchProfile.id)) {
        throw new DomainError(
          "duplicate_identity",
          "This saved search is already looking for current jobs.",
        );
      }
      const origin = request.headers.origin;
      if (origin === undefined) {
        throw new DomainError(
          "external_content_rejected",
          "In-page job discovery requires an explicit same-origin request.",
        );
      }
      const careerContext = (
        await repository.list("profileFact", searchProfile.workspaceId)
      )
        .filter(
          (fact) =>
            fact.status === "verified" &&
            ["experience", "achievement", "education", "skill"].includes(
              fact.factType,
            ),
        )
        .slice(0, 48)
        .map((fact) => ({
          factType: fact.factType,
          subject: fact.subject,
          predicate: fact.predicate,
          value: fact.value,
        }));
      const controller = new AbortController();
      const abort = (): void => controller.abort();
      request.raw.once("aborted", abort);
      runtime.jobDiscoveriesInFlight.add(searchProfile.id);
      try {
        const run = await discoveryRunner.run(
          {
            searchProfileId: searchProfile.id,
            criteria: {
              targetRoles: searchProfile.targetRoles,
              seniority: searchProfile.seniority,
              locations: searchProfile.locations,
              workArrangements: searchProfile.workArrangements,
              minimumCompensation: searchProfile.minimumCompensation,
              compensationCurrency: searchProfile.compensationCurrency,
              aiFocus: searchProfile.aiFocus,
              priorities: searchProfile.priorities,
              exclusions: searchProfile.exclusions,
            },
            careerContext,
          },
          new URL(`${origin}/`),
          controller.signal,
        );
        const operation = (
          await repository.list("operation", searchProfile.workspaceId)
        ).find(
          (item) =>
            item.kind === "job_discovery" &&
            item.inputIdentity === searchProfile.id &&
            item.dshSessionId === run.sessionId &&
            item.state === "succeeded",
        );
        if (operation === undefined) {
          throw new DomainError(
            "operation_indeterminate",
            "DSH ended without a completed job discovery operation. Retry the search.",
          );
        }
        return {
          contractVersion: "v1",
          searchProfileId: searchProfile.id,
          sessionId: run.sessionId,
          operationId: operation.id,
          state: "succeeded",
          leadIds: [...operation.resultIds],
          provider: run.provider,
          model: run.model,
          reasoningEffort: run.reasoningEffort,
        };
      } catch (error) {
        if (error instanceof DiscoveryRunError) {
          if (error.code === "CAPABILITY_UNAVAILABLE") {
            throw new DomainError("capability_unavailable", error.message);
          }
          if (error.code === "RUN_ABORTED") {
            throw new DomainError("operation_canceled", error.message);
          }
          throw new DomainError("operation_indeterminate", error.message);
        }
        throw error;
      } finally {
        request.raw.off("aborted", abort);
        runtime.jobDiscoveriesInFlight.delete(searchProfile.id);
      }
    },
  );

  server.get(
    "/api/v1/diagnostics",
    { schema: { response: { 200: DiagnosticsResponseSchema } } },
    async (): Promise<DiagnosticsResponse> => {
      const health =
        runtime.store === null ? null : await runtime.store.health();
      return {
        contractVersion: "v1",
        version: CAREER_WORKBENCH_VERSION,
        workspaceConfigured: runtime.workspace !== null,
        schemaVersion: health?.schemaVersion ?? STORAGE_SCHEMA_VERSION,
        storage: health === null ? "not_initialized" : health.integrity,
        journalMode: health?.journalMode ?? "unavailable",
        capabilities: {
          deterministic: true,
          dsh: options.dshToken !== undefined,
          nativeChildren: false,
          nativeChildBackend: options.dshToken !== undefined,
          rlm: options.rlmEnabled === true,
          careerOpsImport: true,
        },
        security: {
          loopbackOnly: true,
          sameOriginMutations: true,
          ipythonOsAuthority: true,
        },
        ...buildCompatibilityDiagnostics(),
        recentErrorCategories: [...runtime.recentErrorCategories],
      };
    },
  );

  registerDomainRoutes(server, runtime, ids);
  registerEventRoutes(server, runtime);

  server.addHook("onClose", async () => {
    await discoveryRunner?.close();
    await profileOrganizationRunner?.close();
    await runtime.store?.close();
  });

  if (options.webRoot !== undefined) {
    await server.register(fastifyStatic, {
      root: options.webRoot,
      wildcard: false,
    });
  }
  server.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?", 1)[0] ?? request.url;
    if (
      request.url.startsWith("/api/v1/") &&
      knownApiPaths.some((pattern) => pattern.test(pathname))
    ) {
      return reply.status(405).send({
        error: {
          code: "invalid_request",
          message: "HTTP method is not supported.",
          retryable: false,
        },
      });
    }
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({
        error: {
          code: "entity_not_found",
          message: "API route does not exist.",
          retryable: false,
        },
      });
    }
    if (options.webRoot !== undefined) return reply.sendFile("index.html");
    return reply.status(404).send("Web application is not built.");
  });
  return server;
}
