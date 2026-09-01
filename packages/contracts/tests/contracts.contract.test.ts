import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
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
});
