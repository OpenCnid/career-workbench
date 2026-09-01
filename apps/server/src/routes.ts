import type { FastifyInstance } from "fastify";
import {
  factClaim,
  type CaptureOpportunityInput,
  type CaptureSourceInput,
  type CreateRubricInput,
  type EvaluateInput,
  type IdFactory,
  type ProposeEvidenceInput,
  type ProposeFactInput,
  type ProposeComparisonInput,
  type CancelOperationInput,
  type CreateApplicationInput,
  type CreateCandidateArtifactInput,
  type OperationActivityInput,
  type RequestChildFollowupInput,
  type StartOperationInput,
  type TerminalOperationInput,
  type TransitionApplicationInput,
  type UpdateOpportunitySignalsInput,
} from "@career-workbench/application";
import { discoverCareerOps } from "@career-workbench/career-ops-import";
import {
  AcceptComparisonBodySchema,
  ApplyCareerOpsImportBodySchema,
  CancelOperationBodySchema,
  CaptureOpportunityBodySchema,
  CaptureSourceBodySchema,
  ConfirmProfileFactBodySchema,
  ComparisonProjectionBodySchema,
  CorrectFactBodySchema,
  CreateApplicationBodySchema,
  CreateCandidateArtifactBodySchema,
  CreateRubricBodySchema,
  DecideEvidenceBodySchema,
  EvaluateBodySchema,
  IdParameterSchema,
  OperationActivityBodySchema,
  ProposeEvidenceBodySchema,
  ProposeComparisonBodySchema,
  ProposeProfileFactBodySchema,
  PreviewCareerOpsImportBodySchema,
  RequestChildFollowupBodySchema,
  StartOperationBodySchema,
  TerminalOperationBodySchema,
  TransitionApplicationBodySchema,
  UpdateOpportunitySignalsBodySchema,
  ReviewArtifactBodySchema,
  type CaptureOpportunityBody,
  type AcceptComparisonBody,
  type ApplyCareerOpsImportBody,
  type CancelOperationBody,
  type CaptureSourceBody,
  type ConfirmProfileFactBody,
  type ComparisonProjectionBody,
  type CorrectFactBody,
  type CreateApplicationBody,
  type CreateCandidateArtifactBody,
  type CreateRubricBody,
  type DecideEvidenceBody,
  type EvaluateBody,
  type ProposeEvidenceBody,
  type ProposeComparisonBody,
  type ProposeProfileFactBody,
  type PreviewCareerOpsImportBody,
  type OperationActivityBody,
  type RequestChildFollowupBody,
  type StartOperationBody,
  type TerminalOperationBody,
  type TransitionApplicationBody,
  type UpdateOpportunitySignalsBody,
  type ReviewArtifactBody,
} from "@career-workbench/contracts";
import {
  DomainError,
  type EntityId,
  type FactConfirmationOutcome,
} from "@career-workbench/domain";
import {
  commandContext,
  dshSessionFor,
  requireService,
  requireStore,
  subcommand,
  type Runtime,
} from "./server.js";

interface FixtureBody {
  readonly opportunityId: EntityId;
}

const EmptyBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

const FixtureBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["opportunityId"],
  properties: {
    opportunityId: {
      type: "string",
      minLength: 10,
      maxLength: 80,
      pattern: "^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$",
    },
  },
} as const;

// Runtime TypeBox validation has narrowed this wire value; this adapter applies
// domain brands without allowing transport types into the application layer.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function validatedBody<Value>(value: unknown): Value {
  return value as Value;
}

export function registerDomainRoutes(
  server: FastifyInstance,
  runtime: Runtime,
  ids: IdFactory,
): void {
  server.post<{ Body: PreviewCareerOpsImportBody }>(
    "/api/v1/imports/career-ops/preview",
    { schema: { body: PreviewCareerOpsImportBodySchema } },
    async (request) => {
      const repository = requireStore(runtime);
      const discovery = await discoverCareerOps(request.body.sourceDirectory);
      const manifests = await repository.list(
        "importManifest",
        requireService(runtime).workspaceId,
      );
      const priorForSource = manifests.filter(
        (manifest) =>
          manifest.sourceIdentityDigest === discovery.plan.sourceIdentityDigest,
      );
      const previewId = ids.entity("preview");
      const now = Date.now();
      for (const [id, preview] of runtime.careerOpsPreviews) {
        if (preview.expiresAt <= now) runtime.careerOpsPreviews.delete(id);
      }
      if (runtime.careerOpsPreviews.size >= 8) {
        const oldest = runtime.careerOpsPreviews.keys().next().value;
        if (oldest !== undefined) runtime.careerOpsPreviews.delete(oldest);
      }
      runtime.careerOpsPreviews.set(previewId, {
        sourceDirectory: request.body.sourceDirectory,
        discovery,
        expiresAt: now + 15 * 60 * 1000,
      });
      return {
        contractVersion: "v1",
        previewId,
        expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        alreadyImported: priorForSource.some(
          (manifest) =>
            manifest.sourceFingerprint === discovery.plan.sourceFingerprint,
        ),
        changedSource:
          priorForSource.length > 0 &&
          priorForSource.every(
            (manifest) =>
              manifest.sourceFingerprint !== discovery.plan.sourceFingerprint,
          ),
        ...discovery.preview,
      };
    },
  );

  server.post<{
    Params: { id: EntityId };
    Body: ApplyCareerOpsImportBody;
  }>(
    "/api/v1/imports/career-ops/:id/apply",
    {
      schema: {
        params: IdParameterSchema,
        body: ApplyCareerOpsImportBodySchema,
      },
    },
    async (request, reply) => {
      const preview = runtime.careerOpsPreviews.get(request.params.id);
      if (preview === undefined || preview.expiresAt <= Date.now()) {
        runtime.careerOpsPreviews.delete(request.params.id);
        throw new DomainError(
          "entity_not_found",
          "Career Ops preview expired or does not exist. Discover it again.",
        );
      }
      if (
        request.body.sourceFingerprint !==
        preview.discovery.plan.sourceFingerprint
      ) {
        throw new DomainError(
          "revision_conflict",
          "Confirmation does not match the server-owned Career Ops preview.",
        );
      }
      const current = await discoverCareerOps(preview.sourceDirectory);
      if (current.plan.sourceFingerprint !== request.body.sourceFingerprint) {
        throw new DomainError(
          "revision_conflict",
          "Career Ops source changed after preview. Review a fresh preview.",
        );
      }
      const base = commandContext(request, ids);
      return reply.status(201).send(
        await requireService(runtime).applyCareerOpsImport(current.plan, {
          ...base,
          actor: "import",
        }),
      );
    },
  );

  server.post<{ Body: CreateApplicationBody }>(
    "/api/v1/applications",
    { schema: { body: CreateApplicationBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).createApplication(
            validatedBody<CreateApplicationInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: TransitionApplicationBody;
  }>(
    "/api/v1/applications/:id/transitions",
    {
      schema: {
        params: IdParameterSchema,
        body: TransitionApplicationBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).transitionApplication(
        request.params.id,
        validatedBody<TransitionApplicationInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: UpdateOpportunitySignalsBody;
  }>(
    "/api/v1/opportunities/:id/signals",
    {
      schema: {
        params: IdParameterSchema,
        body: UpdateOpportunitySignalsBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).updateOpportunitySignals(
        request.params.id,
        validatedBody<UpdateOpportunitySignalsInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{ Body: CreateCandidateArtifactBody }>(
    "/api/v1/artifacts/candidate-drafts",
    { schema: { body: CreateCandidateArtifactBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).createCandidateArtifact(
            validatedBody<CreateCandidateArtifactInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: ReviewArtifactBody;
  }>(
    "/api/v1/artifacts/:id/review",
    {
      schema: { params: IdParameterSchema, body: ReviewArtifactBodySchema },
    },
    async (request) =>
      requireService(runtime).reviewCandidateArtifact(
        request.params.id,
        request.body.expectedRevision,
        commandContext(request, ids),
      ),
  );

  server.get<{ Params: { id: EntityId } }>(
    "/api/v1/artifacts/:id/content",
    { schema: { params: IdParameterSchema } },
    async (request) => requireService(runtime).readArtifact(request.params.id),
  );

  server.get<{
    Querystring: { q?: string };
  }>(
    "/api/v1/search",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 2, maxLength: 100 },
          },
        },
      },
    },
    async (request) => {
      const term = request.query.q?.trim().toLocaleLowerCase() ?? "";
      if (term.length < 2) {
        throw new DomainError(
          "invalid_request",
          "Search requires at least two non-space characters.",
        );
      }
      const repository = requireStore(runtime);
      const workspaceId = requireService(runtime).workspaceId;
      const [facts, opportunities, applications, artifacts] = await Promise.all(
        [
          repository.list("profileFact", workspaceId),
          repository.list("opportunity", workspaceId),
          repository.list("application", workspaceId),
          repository.list("artifact", workspaceId),
        ],
      );
      const opportunityById = new Map(
        opportunities.map((opportunity) => [opportunity.id, opportunity]),
      );
      const results = [
        ...facts.map((fact) => ({
          kind: "profileFact",
          id: fact.id,
          label: `${fact.predicate}: ${String(fact.value)}`,
          state: fact.status,
        })),
        ...opportunities.map((opportunity) => ({
          kind: "opportunity",
          id: opportunity.id,
          label: `${opportunity.roleTitle} at ${opportunity.organization}`,
          state: opportunity.workflowState,
        })),
        ...applications.map((application) => {
          const opportunity = opportunityById.get(application.opportunityId);
          return {
            kind: "application",
            id: application.id,
            label: `${opportunity?.roleTitle ?? "Opportunity"} at ${opportunity?.organization ?? "unknown"}`,
            state: application.state,
          };
        }),
        ...artifacts.map((artifact) => ({
          kind: "artifact",
          id: artifact.id,
          label: artifact.kind.replaceAll("_", " "),
          state: artifact.state,
        })),
      ]
        .filter((item) =>
          `${item.kind} ${item.label} ${item.state}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .slice(0, 50);
      return { contractVersion: "v1", query: request.query.q, results };
    },
  );

  server.get("/api/v1/export", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header(
      "content-disposition",
      'attachment; filename="career-workbench-export.json"',
    );
    return requireService(runtime).exportWorkspace();
  });

  server.post<{
    Params: { id: EntityId };
    Body: CancelOperationBody;
  }>(
    "/api/v1/operations/:id/cancellation-requests",
    {
      schema: {
        params: IdParameterSchema,
        body: CancelOperationBodySchema,
      },
    },
    (request) =>
      requireService(runtime).requestUserOperationCancellation(
        request.params.id,
        validatedBody<CancelOperationInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{ Body: CaptureSourceBody }>(
    "/api/v1/sources",
    { schema: { body: CaptureSourceBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).captureSource(
            validatedBody<CaptureSourceInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{ Body: ProposeProfileFactBody }>(
    "/api/v1/profile-facts",
    { schema: { body: ProposeProfileFactBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).proposeProfileFact(
            validatedBody<ProposeFactInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: ConfirmProfileFactBody;
  }>(
    "/api/v1/profile-facts/:id/confirm",
    {
      schema: {
        params: IdParameterSchema,
        body: ConfirmProfileFactBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).confirmProfileFact(
        request.params.id,
        request.body.expectedRevision,
        validatedBody<FactConfirmationOutcome>(request.body.outcome),
        commandContext(request, ids),
      ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: RequestChildFollowupBody;
  }>(
    "/api/v1/operations/:id/followups",
    {
      schema: {
        params: IdParameterSchema,
        body: RequestChildFollowupBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).requestChildFollowup(
        request.params.id,
        validatedBody<RequestChildFollowupInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{ Body: CaptureOpportunityBody }>(
    "/api/v1/opportunities",
    { schema: { body: CaptureOpportunityBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).captureOpportunity(
            validatedBody<CaptureOpportunityInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{ Body: ProposeEvidenceBody }>(
    "/api/v1/evidence",
    { schema: { body: ProposeEvidenceBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).proposeEvidence(
            validatedBody<ProposeEvidenceInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: DecideEvidenceBody;
  }>(
    "/api/v1/evidence/:id/decision",
    {
      schema: {
        params: IdParameterSchema,
        body: DecideEvidenceBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).decideEvidence(
        request.params.id,
        request.body.expectedRevision,
        request.body.decision,
        request.body.reason,
        commandContext(request, ids),
      ),
  );

  server.post<{ Body: CreateRubricBody }>(
    "/api/v1/rubrics",
    { schema: { body: CreateRubricBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).createRubric(
            validatedBody<CreateRubricInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{ Body: EvaluateBody }>(
    "/api/v1/evaluations",
    { schema: { body: EvaluateBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).evaluate(
            validatedBody<EvaluateInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{ Body: StartOperationBody }>(
    "/api/v1/operations",
    { schema: { body: StartOperationBodySchema } },
    async (request, reply) => {
      const sessionId = dshSessionFor(request);
      if (sessionId === null) {
        throw new DomainError(
          "approval_denied",
          "Operation admission requires an authenticated DSH Agent.",
        );
      }
      return reply
        .status(201)
        .send(
          await requireService(runtime).startOperation(
            validatedBody<StartOperationInput>(request.body),
            commandContext(request, ids),
          ),
        );
    },
  );

  server.post<{ Body: ComparisonProjectionBody }>(
    "/api/v1/comparison-projections",
    { schema: { body: ComparisonProjectionBodySchema } },
    async (request) => {
      if (dshSessionFor(request) === null) {
        throw new DomainError(
          "approval_denied",
          "Comparison projections require an authenticated DSH Agent.",
        );
      }
      return {
        contractVersion: "v1",
        evaluations: await requireService(runtime).comparisonProjections(
          validatedBody<readonly EntityId[]>(request.body.evaluationIds),
        ),
      };
    },
  );

  server.post<{
    Params: { id: EntityId };
    Body: ProposeComparisonBody;
  }>(
    "/api/v1/operations/:id/comparisons",
    {
      schema: {
        params: IdParameterSchema,
        body: ProposeComparisonBodySchema,
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).proposeComparison(
            request.params.id,
            validatedBody<ProposeComparisonInput>(request.body),
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: AcceptComparisonBody;
  }>(
    "/api/v1/comparisons/:id/accept",
    {
      schema: {
        params: IdParameterSchema,
        body: AcceptComparisonBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).acceptComparison(
        request.params.id,
        request.body.expectedRevision,
        commandContext(request, ids),
      ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: OperationActivityBody;
  }>(
    "/api/v1/operations/:id/activity",
    {
      schema: {
        params: IdParameterSchema,
        body: OperationActivityBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).recordOperationActivity(
        request.params.id,
        validatedBody<OperationActivityInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: TerminalOperationBody;
  }>(
    "/api/v1/operations/:id/terminal",
    {
      schema: {
        params: IdParameterSchema,
        body: TerminalOperationBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).terminateOperation(
        request.params.id,
        validatedBody<TerminalOperationInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: CancelOperationBody;
  }>(
    "/api/v1/operations/:id/cancellation",
    {
      schema: {
        params: IdParameterSchema,
        body: CancelOperationBodySchema,
      },
    },
    async (request) =>
      requireService(runtime).requestOperationCancellation(
        request.params.id,
        validatedBody<CancelOperationInput>(request.body),
        commandContext(request, ids),
      ),
  );

  server.post<{ Params: { id: EntityId }; Body: Record<string, never> }>(
    "/api/v1/evaluations/:id/artifacts",
    { schema: { params: IdParameterSchema, body: EmptyBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await requireService(runtime).sealEvaluationReport(
            request.params.id,
            commandContext(request, ids),
          ),
        ),
  );

  server.post<{
    Params: { id: EntityId };
    Body: CorrectFactBody;
  }>(
    "/api/v1/profile-facts/:id/corrections",
    {
      schema: { params: IdParameterSchema, body: CorrectFactBodySchema },
    },
    async (request) => {
      const repository = requireStore(runtime);
      const domain = requireService(runtime);
      const fact = await repository.get("profileFact", request.params.id);
      const claim = `${fact.subject} ${fact.predicate} ${String(request.body.value)}`;
      const start = request.body.sourceText.indexOf(claim);
      if (start < 0) {
        throw new DomainError(
          "evidence_locator_invalid",
          "Correction source must contain the complete corrected claim.",
        );
      }
      const base = commandContext(request, ids);
      const source = await domain.captureSource(
        {
          kind: "candidate",
          trustClass: "candidate_primary",
          mediaType: "text/plain",
          text: request.body.sourceText,
          originalLocator: "user-entry://profile-correction",
        },
        subcommand(base, ids, "source"),
      );
      return domain.correctVerifiedFact(
        fact.id,
        request.body.expectedRevision,
        request.body.value,
        {
          sourceId: source.id,
          start,
          end: start + claim.length,
          quote: claim,
        },
        subcommand(base, ids, "correct"),
      );
    },
  );

  server.post<{ Body: FixtureBody }>(
    "/api/v1/evaluations/fixture",
    { schema: { body: FixtureBodySchema } },
    async (request, reply) => {
      const base = commandContext(request, ids);
      const repository = requireStore(runtime);
      const domain = requireService(runtime);
      const opportunity = await repository.get(
        "opportunity",
        request.body.opportunityId,
      );
      const facts = await repository.list(
        "profileFact",
        opportunity.workspaceId,
      );
      const fact = facts.find((item) => item.status === "verified");
      if (fact?.sourceLocators[0] === undefined) {
        throw new DomainError(
          "evidence_unsupported",
          "Fixture evaluation requires a verified candidate fact.",
        );
      }
      const candidateLocator = fact.sourceLocators[0];
      const candidateEvidence = await domain.proposeEvidence(
        {
          classification: "candidate_fact",
          claim: factClaim(fact),
          sourceId: candidateLocator.sourceId,
          locator: candidateLocator,
          candidateFactId: fact.id,
        },
        subcommand(base, ids, "candidate-evidence"),
      );
      const acceptedCandidate = await domain.decideEvidence(
        candidateEvidence.id,
        candidateEvidence.revision,
        "accepted",
        "Complete verified candidate fact.",
        subcommand(base, ids, "candidate-accept"),
      );
      const opportunitySource = await repository.get(
        "source",
        opportunity.sourceDocumentId,
      );
      if (opportunitySource.inlineText === null) {
        throw new DomainError(
          "evidence_locator_invalid",
          "Fixture opportunity source is unavailable.",
        );
      }
      const opportunityEvidence = await domain.proposeEvidence(
        {
          classification: "opportunity_fact",
          claim: opportunitySource.inlineText,
          sourceId: opportunitySource.id,
          locator: {
            sourceId: opportunitySource.id,
            start: 0,
            end: opportunitySource.inlineText.length,
            quote: opportunitySource.inlineText,
          },
        },
        subcommand(base, ids, "opportunity-evidence"),
      );
      const acceptedOpportunity = await domain.decideEvidence(
        opportunityEvidence.id,
        opportunityEvidence.revision,
        "accepted",
        "Complete captured opportunity source.",
        subcommand(base, ids, "opportunity-accept"),
      );
      let rubric = (
        await repository.list("rubric", opportunity.workspaceId)
      )[0];
      rubric ??= await domain.createRubric(
        {
          semanticVersion: "1.0.0",
          name: "Fixture balanced fit",
          dimensions: [
            {
              key: "skills",
              label: "Skills evidence",
              weightBasisPoints: 7000,
              missingInput: "block",
              criticalMinimumBasisPoints: null,
            },
            {
              key: "preferences",
              label: "Preferences",
              weightBasisPoints: 3000,
              missingInput: "neutral",
              criticalMinimumBasisPoints: null,
            },
          ],
          thresholds: { strong: 7500 },
          displayScale: 100,
        },
        subcommand(base, ids, "rubric"),
      );
      const evaluation = await domain.evaluate(
        {
          opportunityId: opportunity.id,
          rubricId: rubric.id,
          dimensionInputs: [
            {
              dimensionKey: "skills",
              semanticScoreBasisPoints: 9000,
              evidenceIds: [acceptedCandidate.id, acceptedOpportunity.id],
              disposition: null,
            },
            {
              dimensionKey: "preferences",
              semanticScoreBasisPoints: null,
              evidenceIds: [],
              disposition: "Preferences not established",
            },
          ],
        },
        subcommand(base, ids, "evaluation"),
      );
      return reply.status(201).send(evaluation);
    },
  );
}
