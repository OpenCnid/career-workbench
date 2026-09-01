import { describe, expect, it } from "vitest";
import { decodeContract, DiagnosticsResponseSchema } from "../src/index.js";

const version = {
  expected: "1.0.0",
  resolved: "1.0.0",
  state: "ready",
} as const;

const upstream = {
  expected: {
    revision: "1111111111111111111111111111111111111111",
    tag: null,
    version: "1.0.0",
  },
  resolved: {
    revision: "1111111111111111111111111111111111111111",
    tag: null,
    version: "1.0.0",
  },
  state: "ready",
} as const;

const patches = [
  "0002-a.patch",
  "0003-b.patch",
  "0004-c.patch",
  "0005-d.patch",
].map((identity, index) => ({
  identity,
  sha256: String(index + 1).repeat(64),
  resolvedSha256: String(index + 1).repeat(64),
  application: index === 3 ? "bundle_host" : "runtime_package",
  state: "ready",
}));

const diagnostics = {
  contractVersion: "v1",
  version: "0.1.0-preview.0",
  workspaceConfigured: false,
  schemaVersion: 6,
  storage: "not_initialized",
  journalMode: "unavailable",
  capabilities: { deterministic: true, dsh: false },
  security: { loopbackOnly: true },
  runtimeVersions: {
    node: version,
    pnpm: version,
    typescript: version,
    careerWorkbench: version,
  },
  compatibility: {
    state: "ready",
    mismatches: [],
    deepSeekHarness: upstream,
    nativeRlm: upstream,
    careerOps: upstream,
    cordis: version,
    patches,
  },
  recentErrorCategories: ["invalid_request"],
} as const;

describe("diagnostics response contract", () => {
  it("accepts exact bounded runtime, upstream, patch, and readiness data", () => {
    expect(decodeContract(DiagnosticsResponseSchema, diagnostics)).toEqual(
      diagnostics,
    );
  });

  it("rejects omitted patches, unknown fields, and unrestricted mismatch text", () => {
    expect(() =>
      decodeContract(DiagnosticsResponseSchema, {
        ...diagnostics,
        compatibility: {
          ...diagnostics.compatibility,
          patches: patches.slice(0, 3),
        },
      }),
    ).toThrow(/does not match/u);
    expect(() =>
      decodeContract(DiagnosticsResponseSchema, {
        ...diagnostics,
        credential: "synthetic-never-accepted",
      }),
    ).toThrow(/does not match/u);
    expect(() =>
      decodeContract(DiagnosticsResponseSchema, {
        ...diagnostics,
        compatibility: {
          ...diagnostics.compatibility,
          state: "mismatch",
          mismatches: ["contains a private path"],
        },
      }),
    ).toThrow(/does not match/u);
  });
});
