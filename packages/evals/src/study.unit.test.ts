import { describe, expect, it } from "vitest";

import {
  OBSERVABLE_STATES,
  STUDY_TASKS,
  renderStudyReport,
  summarizeStudy,
  validateStudySession,
  type StudyCondition,
  type StudySession,
} from "./index.js";

const makeSession = (
  participantCode: string,
  condition: StudyCondition,
): StudySession => ({
  schemaVersion: 1,
  sessionId: `session-synthetic-${participantCode.toLowerCase()}`,
  participantCode,
  condition,
  firstTimeUser: true,
  productTeam: false,
  startedAt: "2026-08-01T10:00:00.000Z",
  completedAt: "2026-08-01T10:40:00.000Z",
  consent: {
    syntheticDataOnly: true,
    thinkAloud: true,
    screenRecording: false,
    participantMayWithdraw: true,
    recordedAt: "2026-08-01T09:59:00.000Z",
  },
  tasks: STUDY_TASKS.map((task) => ({
    task,
    completed: true,
    usedTerminal: false,
    coachingCount: 0,
    repairTurns: 0,
    elapsedMs: 10_000,
    factualErrors: 0,
    provenanceErrors: 0,
    stateErrors: 0,
    recoveryErrors: 0,
    criticalCandidateFactFailure: false,
    consequentialExternalAction: false,
  })),
  statePredictions: OBSERVABLE_STATES.map((state) => ({
    expected: state,
    predicted: state,
  })),
  ratings: { effort: 4, control: 5, trust: 5 },
  routePreference: condition,
  findingCodes: [],
});

describe("qualitative study records", () => {
  it("accepts a closed consent-safe record and summarizes preregistered gates", () => {
    const sessions = [
      makeSession("P01", "career-ops"),
      makeSession("P02", "workbench-no-rlm"),
      makeSession("P03", "workbench-rlm"),
    ];
    expect(validateStudySession(sessions[0])).toEqual(sessions[0]);
    expect(summarizeStudy(sessions)).toMatchObject({
      sessionCount: 3,
      firstTimeUserCount: 3,
      taskCompletionRate: 1,
      statePredictionAccuracy: 1,
      thresholds: {
        threeIndependentFirstTimeUsers: true,
        coreFlowWithoutTerminal: true,
        stateUnderstanding: true,
        noCriticalSafetyFailure: true,
      },
    });
    const report = renderStudyReport(sessions);
    expect(report).toContain("Career Ops vs Workbench without RLM");
    expect(report).toContain("Critical candidate-fact failures: 0");
    expect(report).not.toContain("P01");
  });

  it("cannot pass independent-user gates with an empty or product-team-only sample", () => {
    expect(summarizeStudy([]).thresholds).toEqual({
      threeIndependentFirstTimeUsers: false,
      coreFlowWithoutTerminal: false,
      stateUnderstanding: false,
      noCriticalSafetyFailure: true,
    });
    const session = makeSession("P01", "workbench-no-rlm");
    session.productTeam = true;
    session.firstTimeUser = false;
    expect(summarizeStudy([session]).thresholds).toMatchObject({
      threeIndependentFirstTimeUsers: false,
      coreFlowWithoutTerminal: false,
      stateUnderstanding: false,
    });
  });

  it("rejects omitted tasks, free-form fields, invalid codes, and missing states", () => {
    const omitted = makeSession("P01", "career-ops");
    omitted.tasks = omitted.tasks.slice(1);
    expect(() => validateStudySession(omitted)).toThrow();
    expect(() =>
      validateStudySession({
        ...makeSession("P01", "career-ops"),
        participantName: "not retained",
      }),
    ).toThrow();
    const badCode = makeSession("P99", "career-ops");
    badCode.findingCodes = ["free form notes are forbidden"];
    expect(() => validateStudySession(badCode)).toThrow();
    const missingState = makeSession("P02", "workbench-rlm");
    missingState.statePredictions = missingState.statePredictions.slice(1);
    expect(() => validateStudySession(missingState)).toThrow();
  });

  it("retains negative safety outcomes instead of allowing them to pass", () => {
    const unsafe = makeSession("P01", "workbench-rlm");
    const first = unsafe.tasks[0];
    if (first === undefined) throw new Error("fixture task missing");
    first.criticalCandidateFactFailure = true;
    first.consequentialExternalAction = true;
    const summary = summarizeStudy([unsafe]);
    expect(summary.criticalCandidateFactFailures).toBe(1);
    expect(summary.consequentialExternalActions).toBe(1);
    expect(summary.thresholds.noCriticalSafetyFailure).toBe(false);
  });
});
