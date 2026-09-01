import { Type, type Static } from "@sinclair/typebox";

const OpaqueId = Type.String({
  minLength: 10,
  maxLength: 80,
  pattern: "^[a-z][a-z0-9_]*_[0-9A-HJKMNP-TV-Z]{10,64}$",
});

export const WorkspaceIdSchema = Type.Unsafe<string>({
  ...OpaqueId,
  $id: "WorkspaceId",
});
export const EntityIdSchema = Type.Unsafe<string>({
  ...OpaqueId,
  $id: "EntityId",
});
export const RevisionSchema = Type.Integer({ minimum: 1 });
export const SequenceSchema = Type.Integer({ minimum: 1 });
export const UtcTimestampSchema = Type.String({
  format: "date-time",
  maxLength: 40,
});

export const ErrorCodeSchema = Type.Union(
  [
    "invalid_request",
    "unsupported_contract_version",
    "workspace_not_found",
    "workspace_unsafe",
    "entity_not_found",
    "revision_conflict",
    "duplicate_identity",
    "invalid_transition",
    "evidence_unsupported",
    "evidence_locator_invalid",
    "artifact_unsealed",
    "artifact_limit_exceeded",
    "approval_required",
    "approval_stale",
    "approval_denied",
    "capability_unavailable",
    "model_unsupported",
    "reasoning_unsupported",
    "operation_canceled",
    "operation_indeterminate",
    "import_unsupported",
    "external_content_rejected",
    "internal_error",
  ].map((value) => Type.Literal(value)),
  { $id: "ErrorCode" },
);

export const PublicErrorSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: ErrorCodeSchema,
        message: Type.String({ minLength: 1, maxLength: 500 }),
        retryable: Type.Boolean(),
        details: Type.Optional(
          Type.Record(Type.String({ maxLength: 80 }), Type.Unknown()),
        ),
      },
      { additionalProperties: false },
    ),
  },
  { $id: "PublicError", additionalProperties: false },
);

export const ActorClassSchema = Type.Union(
  ["user", "browser", "dsh_agent", "dsh_child", "import", "system"].map(
    (value) => Type.Literal(value),
  ),
);

export const CommandEnvelopeSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    workspaceId: WorkspaceIdSchema,
    commandId: EntityIdSchema,
    commandKind: Type.String({
      minLength: 1,
      maxLength: 80,
      pattern: "^[a-z][a-z0-9_.-]*$",
    }),
    actor: ActorClassSchema,
    idempotencyKey: Type.Optional(
      Type.String({ minLength: 16, maxLength: 128 }),
    ),
    expectedRevisions: Type.Record(EntityIdSchema, RevisionSchema, {
      maxProperties: 32,
    }),
    operationId: Type.Optional(EntityIdSchema),
    payload: Type.Record(Type.String({ maxLength: 80 }), Type.Unknown(), {
      maxProperties: 64,
    }),
  },
  { $id: "CommandEnvelope", additionalProperties: false },
);

export const QueryEnvelopeSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    workspaceId: WorkspaceIdSchema,
    queryKind: Type.String({
      minLength: 1,
      maxLength: 80,
      pattern: "^[a-z][a-z0-9_.-]*$",
    }),
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    limit: Type.Integer({ minimum: 1, maximum: 100 }),
    filters: Type.Record(Type.String({ maxLength: 80 }), Type.Unknown(), {
      maxProperties: 16,
    }),
  },
  { $id: "QueryEnvelope", additionalProperties: false },
);

export const DomainEventSchema = Type.Object(
  {
    contractVersion: Type.Literal("v1"),
    sequence: SequenceSchema,
    eventKind: Type.String({
      minLength: 1,
      maxLength: 100,
      pattern: "^[a-z][a-z0-9_.-]*$",
    }),
    schemaVersion: Type.Integer({ minimum: 1 }),
    workspaceId: WorkspaceIdSchema,
    aggregateId: EntityIdSchema,
    aggregateRevision: RevisionSchema,
    commandId: EntityIdSchema,
    operationId: Type.Optional(EntityIdSchema),
    actor: ActorClassSchema,
    timestamp: UtcTimestampSchema,
    payload: Type.Record(Type.String({ maxLength: 80 }), Type.Unknown(), {
      maxProperties: 64,
    }),
  },
  { $id: "DomainEvent", additionalProperties: false },
);

export type PublicError = Static<typeof PublicErrorSchema>;
export type CommandEnvelope = Static<typeof CommandEnvelopeSchema>;
export type QueryEnvelope = Static<typeof QueryEnvelopeSchema>;
export type DomainEvent = Static<typeof DomainEventSchema>;

export const PUBLIC_SCHEMAS = [
  WorkspaceIdSchema,
  EntityIdSchema,
  ErrorCodeSchema,
  PublicErrorSchema,
  CommandEnvelopeSchema,
  QueryEnvelopeSchema,
  DomainEventSchema,
] as const;
