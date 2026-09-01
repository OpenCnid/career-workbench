import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCompatibilityDiagnostics,
  CAREER_WORKBENCH_VERSION,
} from "../../apps/server/src/compatibility.js";
import { createServer } from "../../apps/server/src/server.js";
import {
  decodeContract,
  DiagnosticsResponseSchema,
  type DiagnosticsResponse,
} from "../../packages/contracts/src/index.js";

const CSRF = "synthetic-diagnostics-csrf-0000000000";
const DSH_TOKEN = "synthetic-diagnostics-dsh-token-00000000";
const HOST = "127.0.0.1:4173";

describe("compatibility diagnostics API", () => {
  let parent: string;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-diagnostics-"));
    server = await createServer({
      workspaceRoot: join(parent, "workspace"),
      csrfToken: CSRF,
      dshToken: DSH_TOKEN,
      rlmEnabled: true,
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(parent, { recursive: true, force: true });
  });

  it("reports exact compatible pins and bounded recent errors without credential data", async () => {
    const malformed = await server.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: {
        host: HOST,
        origin: `http://${HOST}`,
        "content-type": "application/json",
        cookie: `cw_csrf=${CSRF}`,
        "x-cw-csrf": CSRF,
        "x-idempotency-key": "synthetic-diagnostics-invalid-request",
        "sec-fetch-site": "same-origin",
      },
      payload: {},
    });
    expect(malformed.statusCode).toBe(400);

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/diagnostics",
    });
    expect(response.statusCode, response.body).toBe(200);
    const diagnostics = decodeContract(
      DiagnosticsResponseSchema,
      response.json<DiagnosticsResponse>(),
    );
    expect(diagnostics).toMatchObject({
      contractVersion: "v1",
      version: CAREER_WORKBENCH_VERSION,
      schemaVersion: 6,
      capabilities: { dsh: true, rlm: true },
      runtimeVersions: {
        node: {
          expected: "24.19.0",
          resolved: process.versions.node,
          state: "ready",
        },
        pnpm: { expected: "11.24.0", resolved: "11.24.0", state: "ready" },
        typescript: { expected: "6.0.3", resolved: "6.0.3", state: "ready" },
      },
      compatibility: {
        state: "ready",
        mismatches: [],
        deepSeekHarness: {
          expected: {
            revision: "dd6322d604e00eec1ba5e0c8541159906a21094a",
            tag: "dsh-v0.1.2-alpha.3",
            version: "0.1.2-alpha.3",
          },
          state: "ready",
        },
        nativeRlm: {
          expected: {
            revision: "0e9f030300f9e5b37b76cdcd3d39bc490a251e79",
            version: "0.1.0-preview.0",
          },
          state: "ready",
        },
        careerOps: {
          expected: {
            revision: "3a067ee580b7982cf5dd6edf7895112e4e99600b",
            version: "1.31.0",
          },
          state: "ready",
        },
        cordis: { expected: "4.0.2", resolved: "4.0.2", state: "ready" },
      },
      recentErrorCategories: ["invalid_request"],
    });
    expect(
      diagnostics.compatibility.patches.map((patch) => patch.identity),
    ).toEqual([
      "0002-continuable-child-deletion.patch",
      "0003-public-ignorable-session-events.patch",
      "0004-pi-ai-agent-session-cleanup.patch",
      "0005-bounded-process-shutdown.patch",
    ]);
    expect(
      diagnostics.compatibility.patches.every(
        (patch) =>
          patch.state === "ready" && patch.sha256 === patch.resolvedSha256,
      ),
    ).toBe(true);
    expect(response.body).not.toContain(DSH_TOKEN);
    expect(response.body).not.toMatch(/credential|cookie|authorization/iu);
  });

  it("reports stable mismatch identities instead of silently substituting", () => {
    const result = buildCompatibilityDiagnostics({
      node: "24.18.0",
      deepSeekHarness: { version: "0.1.2-alpha.2" },
      patchSha256: {
        "0005-bounded-process-shutdown.patch": "0".repeat(64),
      },
    });
    expect(result.compatibility).toMatchObject({
      state: "mismatch",
      mismatches: [
        "runtime.node",
        "upstream.deepSeekHarness",
        "patch.0005-bounded-process-shutdown.patch",
      ],
      deepSeekHarness: { state: "mismatch" },
    });
    expect(result.runtimeVersions.node.state).toBe("mismatch");
    expect(result.compatibility.patches.at(-1)?.state).toBe("mismatch");
  });
});
