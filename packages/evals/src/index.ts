export const FIXTURE_POLICY = "synthetic-only" as const;

export const STUDY_CONDITIONS = [
  "career-ops",
  "workbench-no-rlm",
  "workbench-rlm",
] as const;

export const STUDY_TASKS = [
  "onboard-profile",
  "compare-opportunities",
  "explain-evidence",
  "inspect-follow-up-child",
  "correct-fact",
  "cancel-work",
  "restart-resume",
  "choose-reviewed-artifact",
] as const;

export const OBSERVABLE_STATES = [
  "admitted",
  "running",
  "waiting",
  "completed",
  "failed",
  "canceled",
  "indeterminate",
  "stale",
] as const;

export type StudyCondition = (typeof STUDY_CONDITIONS)[number];
export type StudyTask = (typeof STUDY_TASKS)[number];
export type ObservableState = (typeof OBSERVABLE_STATES)[number];

export interface ConsentRecord {
  syntheticDataOnly: true;
  thinkAloud: boolean;
  screenRecording: boolean;
  participantMayWithdraw: true;
  recordedAt: string;
}

export interface TaskObservation {
  task: StudyTask;
  completed: boolean;
  usedTerminal: boolean;
  coachingCount: number;
  repairTurns: number;
  elapsedMs: number;
  factualErrors: number;
  provenanceErrors: number;
  stateErrors: number;
  recoveryErrors: number;
  criticalCandidateFactFailure: boolean;
  consequentialExternalAction: boolean;
}

export interface StatePrediction {
  expected: ObservableState;
  predicted: ObservableState;
}

export interface StudySession {
  schemaVersion: 1;
  sessionId: string;
  participantCode: string;
  condition: StudyCondition;
  firstTimeUser: boolean;
  productTeam: boolean;
  startedAt: string;
  completedAt: string;
  consent: ConsentRecord;
  tasks: TaskObservation[];
  statePredictions: StatePrediction[];
  ratings: {
    effort: number;
    control: number;
    trust: number;
  };
  routePreference: StudyCondition | "no-preference";
  findingCodes: string[];
}

export interface StudySummary {
  sessionCount: number;
  firstTimeUserCount: number;
  conditionCounts: Record<StudyCondition, number>;
  taskCompletionRate: number;
  uncoachedNoTerminalCompletionRate: number;
  statePredictionAccuracy: number;
  stateAccuracy: Record<ObservableState, number | null>;
  medianTimeToFirstUsefulResultMs: number | null;
  byCondition: Record<StudyCondition, ConditionMetrics>;
  criticalCandidateFactFailures: number;
  consequentialExternalActions: number;
  thresholds: {
    threeIndependentFirstTimeUsers: boolean;
    coreFlowWithoutTerminal: boolean;
    stateUnderstanding: boolean;
    noCriticalSafetyFailure: boolean;
  };
}

export interface ConditionMetrics {
  sessions: number;
  taskCompletionRate: number;
  medianTimeToFirstUsefulResultMs: number | null;
  medianRepairTurns: number | null;
  factualErrors: number;
  provenanceErrors: number;
  stateErrors: number;
  recoveryErrors: number;
  meanEffort: number | null;
  meanControl: number | null;
  meanTrust: number | null;
}

export const PREREGISTERED_THRESHOLDS = Object.freeze({
  independentFirstTimeUsers: 3,
  uncoachedNoTerminalCompletionRate: 0.8,
  overallStatePredictionAccuracy: 0.8,
  perObservedStateAccuracy: 2 / 3,
  maximumCriticalCandidateFactFailures: 0,
  maximumConsequentialExternalActions: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: string[],
): boolean =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
  !Number.isNaN(Date.parse(value));

const isBoundedInteger = (value: unknown, maximum = 1_000): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;

const isStudyCondition = (value: unknown): value is StudyCondition =>
  STUDY_CONDITIONS.some((condition) => condition === value);

const isStudyTask = (value: unknown): value is StudyTask =>
  STUDY_TASKS.some((task) => task === value);

const isObservableState = (value: unknown): value is ObservableState =>
  OBSERVABLE_STATES.some((state) => state === value);

const assertConsent: (value: unknown) => asserts value is ConsentRecord = (
  value,
) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "syntheticDataOnly",
      "thinkAloud",
      "screenRecording",
      "participantMayWithdraw",
      "recordedAt",
    ]) ||
    value["syntheticDataOnly"] !== true ||
    typeof value["thinkAloud"] !== "boolean" ||
    typeof value["screenRecording"] !== "boolean" ||
    value["participantMayWithdraw"] !== true ||
    !isIsoTimestamp(value["recordedAt"])
  ) {
    throw new Error("Invalid consent record.");
  }
};

const assertTask: (value: unknown) => asserts value is TaskObservation = (
  value,
) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "task",
      "completed",
      "usedTerminal",
      "coachingCount",
      "repairTurns",
      "elapsedMs",
      "factualErrors",
      "provenanceErrors",
      "stateErrors",
      "recoveryErrors",
      "criticalCandidateFactFailure",
      "consequentialExternalAction",
    ]) ||
    !isStudyTask(value["task"]) ||
    typeof value["completed"] !== "boolean" ||
    typeof value["usedTerminal"] !== "boolean" ||
    !isBoundedInteger(value["coachingCount"]) ||
    !isBoundedInteger(value["repairTurns"]) ||
    !isBoundedInteger(value["elapsedMs"], 86_400_000) ||
    !isBoundedInteger(value["factualErrors"]) ||
    !isBoundedInteger(value["provenanceErrors"]) ||
    !isBoundedInteger(value["stateErrors"]) ||
    !isBoundedInteger(value["recoveryErrors"]) ||
    typeof value["criticalCandidateFactFailure"] !== "boolean" ||
    typeof value["consequentialExternalAction"] !== "boolean"
  ) {
    throw new Error("Invalid task observation.");
  }
};

const assertPrediction: (value: unknown) => asserts value is StatePrediction = (
  value,
) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["expected", "predicted"]) ||
    !isObservableState(value["expected"]) ||
    !isObservableState(value["predicted"])
  ) {
    throw new Error("Invalid state prediction.");
  }
};

/** Validates the closed, consent-safe retained record format. */
export const validateStudySession = (value: unknown): StudySession => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "sessionId",
      "participantCode",
      "condition",
      "firstTimeUser",
      "productTeam",
      "startedAt",
      "completedAt",
      "consent",
      "tasks",
      "statePredictions",
      "ratings",
      "routePreference",
      "findingCodes",
    ]) ||
    value["schemaVersion"] !== 1 ||
    typeof value["sessionId"] !== "string" ||
    !/^session-[a-z0-9-]{6,64}$/u.test(value["sessionId"]) ||
    typeof value["participantCode"] !== "string" ||
    !/^P\d{2}$/u.test(value["participantCode"]) ||
    !isStudyCondition(value["condition"]) ||
    typeof value["firstTimeUser"] !== "boolean" ||
    typeof value["productTeam"] !== "boolean" ||
    !isIsoTimestamp(value["startedAt"]) ||
    !isIsoTimestamp(value["completedAt"]) ||
    Date.parse(value["completedAt"]) < Date.parse(value["startedAt"]) ||
    !Array.isArray(value["tasks"]) ||
    value["tasks"].length !== STUDY_TASKS.length ||
    !Array.isArray(value["statePredictions"]) ||
    value["statePredictions"].length < OBSERVABLE_STATES.length ||
    !isRecord(value["ratings"]) ||
    !hasExactKeys(value["ratings"], ["effort", "control", "trust"]) ||
    !isBoundedInteger(value["ratings"]["effort"], 7) ||
    !isBoundedInteger(value["ratings"]["control"], 7) ||
    !isBoundedInteger(value["ratings"]["trust"], 7) ||
    value["ratings"]["effort"] < 1 ||
    value["ratings"]["control"] < 1 ||
    value["ratings"]["trust"] < 1 ||
    !(
      isStudyCondition(value["routePreference"]) ||
      value["routePreference"] === "no-preference"
    ) ||
    !Array.isArray(value["findingCodes"]) ||
    !value["findingCodes"].every(
      (finding) =>
        typeof finding === "string" && /^F-[A-Z0-9-]{1,32}$/u.test(finding),
    )
  ) {
    throw new Error("Invalid study session.");
  }

  const session = value as unknown as StudySession;
  assertConsent(session.consent);
  session.tasks.forEach(assertTask);
  session.statePredictions.forEach(assertPrediction);

  const taskSet = new Set(session.tasks.map((observation) => observation.task));
  if (
    taskSet.size !== STUDY_TASKS.length ||
    STUDY_TASKS.some((task) => !taskSet.has(task))
  ) {
    throw new Error("Each preregistered task must be recorded exactly once.");
  }
  const stateSet = new Set(
    session.statePredictions.map((prediction) => prediction.expected),
  );
  if (OBSERVABLE_STATES.some((state) => !stateSet.has(state))) {
    throw new Error("Each observable state must be tested at least once.");
  }

  return session;
};

const rate = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle];
  if (right === undefined) return null;
  if (sorted.length % 2 === 1) return right;
  const left = sorted[middle - 1];
  return left === undefined ? null : (left + right) / 2;
};

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

const summarizeCondition = (
  sessions: readonly StudySession[],
): ConditionMetrics => {
  const tasks = sessions.flatMap((session) => session.tasks);
  return {
    sessions: sessions.length,
    taskCompletionRate: rate(
      tasks.filter((task) => task.completed).length,
      tasks.length,
    ),
    medianTimeToFirstUsefulResultMs: median(
      sessions.map((session) => session.tasks[0]?.elapsedMs ?? 0),
    ),
    medianRepairTurns: median(tasks.map((task) => task.repairTurns)),
    factualErrors: tasks.reduce((total, task) => total + task.factualErrors, 0),
    provenanceErrors: tasks.reduce(
      (total, task) => total + task.provenanceErrors,
      0,
    ),
    stateErrors: tasks.reduce((total, task) => total + task.stateErrors, 0),
    recoveryErrors: tasks.reduce(
      (total, task) => total + task.recoveryErrors,
      0,
    ),
    meanEffort: mean(sessions.map((session) => session.ratings.effort)),
    meanControl: mean(sessions.map((session) => session.ratings.control)),
    meanTrust: mean(sessions.map((session) => session.ratings.trust)),
  };
};

export const summarizeStudy = (values: readonly unknown[]): StudySummary => {
  const sessions = values.map(validateStudySession);
  const tasks = sessions.flatMap((session) => session.tasks);
  const predictions = sessions.flatMap((session) => session.statePredictions);
  const independent = sessions.filter(
    (session) => session.firstTimeUser && !session.productTeam,
  );
  const stateAccuracy = Object.fromEntries(
    OBSERVABLE_STATES.map((state) => {
      const observations = predictions.filter(
        (prediction) => prediction.expected === state,
      );
      return [
        state,
        observations.length === 0
          ? null
          : rate(
              observations.filter(
                (prediction) => prediction.expected === prediction.predicted,
              ).length,
              observations.length,
            ),
      ];
    }),
  ) as Record<ObservableState, number | null>;
  const completionWithoutCoaching = tasks.filter(
    (task) => task.completed && !task.usedTerminal && task.coachingCount === 0,
  ).length;
  const statePredictionAccuracy = rate(
    predictions.filter(
      (prediction) => prediction.expected === prediction.predicted,
    ).length,
    predictions.length,
  );
  const criticalCandidateFactFailures = tasks.filter(
    (task) => task.criticalCandidateFactFailure,
  ).length;
  const consequentialExternalActions = tasks.filter(
    (task) => task.consequentialExternalAction,
  ).length;
  const perStateThresholdPassed = OBSERVABLE_STATES.every((state) => {
    const value = stateAccuracy[state];
    return (
      value !== null &&
      value >= PREREGISTERED_THRESHOLDS.perObservedStateAccuracy
    );
  });
  const independentTasks = independent.flatMap((session) => session.tasks);

  return {
    sessionCount: sessions.length,
    firstTimeUserCount: independent.length,
    conditionCounts: Object.fromEntries(
      STUDY_CONDITIONS.map((condition) => [
        condition,
        sessions.filter((session) => session.condition === condition).length,
      ]),
    ) as Record<StudyCondition, number>,
    taskCompletionRate: rate(
      tasks.filter((task) => task.completed).length,
      tasks.length,
    ),
    uncoachedNoTerminalCompletionRate: rate(
      completionWithoutCoaching,
      tasks.length,
    ),
    statePredictionAccuracy,
    stateAccuracy,
    medianTimeToFirstUsefulResultMs: median(
      sessions.map((session) => session.tasks[0]?.elapsedMs ?? 0),
    ),
    byCondition: Object.fromEntries(
      STUDY_CONDITIONS.map((condition) => [
        condition,
        summarizeCondition(
          sessions.filter((session) => session.condition === condition),
        ),
      ]),
    ) as Record<StudyCondition, ConditionMetrics>,
    criticalCandidateFactFailures,
    consequentialExternalActions,
    thresholds: {
      threeIndependentFirstTimeUsers:
        independent.length >=
        PREREGISTERED_THRESHOLDS.independentFirstTimeUsers,
      coreFlowWithoutTerminal:
        independent.length >=
          PREREGISTERED_THRESHOLDS.independentFirstTimeUsers &&
        rate(
          independentTasks.filter(
            (task) =>
              task.completed && !task.usedTerminal && task.coachingCount === 0,
          ).length,
          independentTasks.length,
        ) >= PREREGISTERED_THRESHOLDS.uncoachedNoTerminalCompletionRate,
      stateUnderstanding:
        independent.length >=
          PREREGISTERED_THRESHOLDS.independentFirstTimeUsers &&
        statePredictionAccuracy >=
          PREREGISTERED_THRESHOLDS.overallStatePredictionAccuracy &&
        perStateThresholdPassed,
      noCriticalSafetyFailure:
        criticalCandidateFactFailures <=
          PREREGISTERED_THRESHOLDS.maximumCriticalCandidateFactFailures &&
        consequentialExternalActions <=
          PREREGISTERED_THRESHOLDS.maximumConsequentialExternalActions,
    },
  };
};

const printable = (value: number | null): string =>
  value === null ? "not measured" : value.toFixed(2);

/** Renders all outcomes, including failures, without participant identifiers. */
export const renderStudyReport = (values: readonly unknown[]): string => {
  const summary = summarizeStudy(values);
  const conditionRows = STUDY_CONDITIONS.map((condition) => {
    const metrics = summary.byCondition[condition];
    return `| ${condition} | ${String(metrics.sessions)} | ${printable(metrics.taskCompletionRate)} | ${printable(metrics.medianTimeToFirstUsefulResultMs)} | ${printable(metrics.medianRepairTurns)} | ${String(metrics.factualErrors)} | ${String(metrics.provenanceErrors)} | ${String(metrics.stateErrors)} | ${String(metrics.recoveryErrors)} | ${printable(metrics.meanEffort)} | ${printable(metrics.meanControl)} | ${printable(metrics.meanTrust)} |`;
  });
  const gates = Object.entries(summary.thresholds)
    .map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "UNMET"}`)
    .join("\n");
  return [
    "# Qualitative comparison report",
    "",
    `Independent first-time participants: ${String(summary.firstTimeUserCount)}`,
    "",
    "| Condition | Sessions | Completion | Time to first result (ms) | Repair turns | Factual errors | Provenance errors | State errors | Recovery errors | Effort | Control | Trust |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...conditionRows,
    "",
    "## Preregistered gates",
    "",
    gates,
    "",
    "## Safety outcomes",
    "",
    `- Critical candidate-fact failures: ${String(summary.criticalCandidateFactFailures)}`,
    `- Consequential external actions: ${String(summary.consequentialExternalActions)}`,
    "",
    "## Interpretation boundaries",
    "",
    "Career Ops vs Workbench without RLM isolates the product interface and authoritative backend. Workbench without RLM vs Workbench with RLM isolates incremental RLM value while keeping DSH as the sole orchestrator. No route is preferred unless a named preregistered dimension improves without a safety or comprehension regression.",
    "",
  ].join("\n");
};
