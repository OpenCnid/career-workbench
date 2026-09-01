import { describe, expect, it } from "vitest";
import {
  AddCareerHistoryEntryBodySchema,
  CommandEnvelopeSchema,
  CreateWorkspaceBodySchema,
  parseContract,
  parseJsonWithoutDuplicateKeys,
} from "../src/index.js";

const validCommand = {
  contractVersion: "v1",
  workspaceId: "workspace_01K3YV3Q4Z",
  commandId: "command_01K3YV3Q50",
  commandKind: "profile.confirm",
  actor: "user",
  expectedRevisions: {},
  payload: {},
} as const;

describe("public command contract", () => {
  it("accepts a closed valid example", () => {
    expect(
      parseContract(CommandEnvelopeSchema, JSON.stringify(validCommand)),
    ).toEqual(validCommand);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseContract(
        CommandEnvelopeSchema,
        JSON.stringify({ ...validCommand, ignored: true }),
      ),
    ).toThrow(/does not match/);
  });

  it("rejects duplicate JSON keys before parsing", () => {
    expect(() =>
      parseJsonWithoutDuplicateKeys('{"payload":{},"payload":{}}'),
    ).toThrow(/duplicate/);
  });

  it("accepts only the closed guided career-history shape", () => {
    const entry = {
      personName: "Avery Example",
      roleTitle: "Software Engineer",
      organization: "Synthetic Systems",
      dateRange: "2021 to 2024",
      achievements: ["built TypeScript services"],
    };
    expect(
      parseContract(AddCareerHistoryEntryBodySchema, JSON.stringify(entry)),
    ).toEqual(entry);
    expect(() =>
      parseContract(
        AddCareerHistoryEntryBodySchema,
        JSON.stringify({ ...entry, autoVerify: true }),
      ),
    ).toThrow(/does not match/u);
  });

  it("accepts a closed guided workspace setup", () => {
    const setup = {
      displayName: "AI Engineering Search",
      candidateName: "Morgan Example",
      targetRole: "Senior Software Engineer focused on AI platforms",
      targetPriorities: "Hands-on AI systems and strong engineering culture",
      locationPreference: "Remote in the United States",
      deferTargetPreferences: false,
      rubricPreset: "balanced_fit",
      locale: "en-US",
      timezone: "America/Chicago",
    } as const;
    expect(
      parseContract(CreateWorkspaceBodySchema, JSON.stringify(setup)),
    ).toEqual(setup);
    expect(() =>
      parseContract(
        CreateWorkspaceBodySchema,
        JSON.stringify({ ...setup, rubricPreset: "model_decides" }),
      ),
    ).toThrow(/does not match/u);
  });
});
