import type {
  ApprovalState,
  ApplicationState,
  EvaluationState,
  OperationState,
} from "./entities.js";
import { DomainError } from "./errors.js";

const applicationTransitions: Readonly<
  Record<ApplicationState, readonly ApplicationState[]>
> = {
  considering: ["preparing", "withdrawn", "closed"],
  preparing: ["ready_for_review", "withdrawn", "closed"],
  ready_for_review: ["applied", "withdrawn", "closed"],
  applied: ["responded", "interview", "rejected", "withdrawn", "closed"],
  responded: ["interview", "offer", "rejected", "withdrawn", "closed"],
  interview: ["offer", "rejected", "withdrawn", "closed"],
  offer: ["hired", "withdrawn", "closed"],
  hired: [],
  rejected: [],
  withdrawn: [],
  closed: [],
};

const evaluationTransitions: Readonly<
  Record<EvaluationState, readonly EvaluationState[]>
> = {
  pending: ["running"],
  running: ["completed", "waiting_for_user", "failed", "canceled"],
  waiting_for_user: ["running", "canceled"],
  completed: ["stale"],
  failed: ["pending"],
  canceled: ["pending"],
  stale: ["pending"],
};

const operationTransitions: Readonly<
  Record<OperationState, readonly OperationState[]>
> = {
  queued: ["running", "canceled", "indeterminate"],
  running: [
    "waiting_for_user",
    "succeeded",
    "failed",
    "canceled",
    "indeterminate",
  ],
  waiting_for_user: ["running", "failed", "canceled", "indeterminate"],
  succeeded: [],
  failed: [],
  canceled: [],
  indeterminate: [],
};

const approvalTransitions: Readonly<
  Record<ApprovalState, readonly ApprovalState[]>
> = {
  pending: ["approved", "denied", "expired"],
  approved: ["expired", "consumed"],
  denied: [],
  expired: [],
  consumed: [],
};

function requireTransition<State extends string>(
  graph: Readonly<Record<State, readonly State[]>>,
  from: State,
  to: State,
  kind: string,
): void {
  if (!graph[from].includes(to)) {
    throw new DomainError(
      "invalid_transition",
      `${kind} cannot transition from ${from} to ${to}.`,
      false,
      { from, to },
    );
  }
}

export function requireApplicationTransition(
  from: ApplicationState,
  to: ApplicationState,
): void {
  requireTransition(applicationTransitions, from, to, "Application");
}

export function requireEvaluationTransition(
  from: EvaluationState,
  to: EvaluationState,
): void {
  requireTransition(evaluationTransitions, from, to, "Evaluation");
}

export function requireOperationTransition(
  from: OperationState,
  to: OperationState,
): void {
  requireTransition(operationTransitions, from, to, "Operation");
}

export function requireApprovalTransition(
  from: ApprovalState,
  to: ApprovalState,
): void {
  requireTransition(approvalTransitions, from, to, "Approval");
}

export const APPLICATION_TRANSITIONS = applicationTransitions;
export const EVALUATION_TRANSITIONS = evaluationTransitions;
export const OPERATION_TRANSITIONS = operationTransitions;
export const APPROVAL_TRANSITIONS = approvalTransitions;
