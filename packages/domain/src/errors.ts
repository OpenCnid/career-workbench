export type DomainErrorCode =
  | "invalid_request"
  | "unsupported_contract_version"
  | "workspace_not_found"
  | "workspace_unsafe"
  | "entity_not_found"
  | "revision_conflict"
  | "duplicate_identity"
  | "invalid_transition"
  | "evidence_unsupported"
  | "evidence_locator_invalid"
  | "artifact_unsealed"
  | "artifact_limit_exceeded"
  | "approval_required"
  | "approval_stale"
  | "approval_denied"
  | "capability_unavailable"
  | "model_unsupported"
  | "reasoning_unsupported"
  | "operation_canceled"
  | "operation_indeterminate"
  | "import_unsupported"
  | "external_content_rejected"
  | "internal_error";

export class DomainError extends Error {
  public constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertDomain(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): asserts condition {
  if (!condition) throw new DomainError(code, message, false, details);
}
