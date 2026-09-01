import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../apps/server/src/server.js";
import { DeterministicIdFactory } from "../../packages/application/src/ids.js";

const CSRF = "synthetic-csrf-proof-import-0000000000";
const HOST = "127.0.0.1:4173";
const fixture = resolve("tests/fixtures/career-ops-v1.18");

describe("Career Ops API import boundary", () => {
  let parent: string;
  let source: string;
  let workspace: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let serial = 0;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "career-workbench-import-"));
    source = join(parent, "career-ops-source");
    workspace = join(parent, "workspace");
    await cp(fixture, source, { recursive: true });
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("SYN7H1MP00"),
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(parent, { recursive: true, force: true });
  });

  function headers(): Record<string, string> {
    serial += 1;
    return {
      host: HOST,
      origin: `http://${HOST}`,
      "content-type": "application/json",
      cookie: `cw_csrf=${CSRF}`,
      "x-cw-csrf": CSRF,
      "x-idempotency-key": `synthetic-import-${String(serial).padStart(4, "0")}`,
      "sec-fetch-site": "same-origin",
    };
  }

  async function post(url: string, payload: Readonly<Record<string, unknown>>) {
    return server.inject({ method: "POST", url, headers: headers(), payload });
  }

  async function initialize(): Promise<void> {
    const response = await post("/api/v1/workspaces", {
      displayName: "Synthetic Import Workspace",
      locale: "en-US",
      timezone: "America/Chicago",
    });
    expect(response.statusCode).toBe(201);
  }

  it("previews, confirms once, preserves bytes, survives restart, and is idempotent", async () => {
    await initialize();
    const previewResponse = await post("/api/v1/imports/career-ops/preview", {
      sourceDirectory: source,
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json<{
      previewId: string;
      sourceFingerprint: string;
      applications: unknown[];
      alreadyImported: boolean;
      changedSource: boolean;
    }>();
    expect(preview).toMatchObject({
      alreadyImported: false,
      changedSource: false,
    });
    expect(preview.applications).toHaveLength(6);

    const apply = await post(
      `/api/v1/imports/career-ops/${preview.previewId}/apply`,
      { sourceFingerprint: preview.sourceFingerprint, confirm: true },
    );
    expect(apply.statusCode).toBe(201);
    const manifest = apply.json<{
      id: string;
      sourceFingerprint: string;
      sources: { relativePath: string; contentDigest: string }[];
      mappings: { sourceType: string; originalScore: string | null }[];
    }>();
    expect(manifest.sourceFingerprint).toBe(preview.sourceFingerprint);
    expect(manifest.sources).toHaveLength(5);
    expect(
      manifest.mappings.filter(
        (mapping) => mapping.sourceType === "application",
      ),
    ).toHaveLength(6);
    expect(
      manifest.mappings.some((mapping) => mapping.originalScore === "4.5/5"),
    ).toBe(true);

    for (const imported of manifest.sources) {
      const original = await readFile(
        join(source, ...imported.relativePath.split("/")),
      );
      const sealed = await readFile(
        join(
          workspace,
          "artifacts",
          "sha256",
          imported.contentDigest.slice(0, 2),
          imported.contentDigest,
        ),
      );
      expect(sealed.equals(original)).toBe(true);
      expect(createHash("sha256").update(sealed).digest("hex")).toBe(
        imported.contentDigest,
      );
    }

    const repeated = await post(
      `/api/v1/imports/career-ops/${preview.previewId}/apply`,
      { sourceFingerprint: preview.sourceFingerprint, confirm: true },
    );
    expect(repeated.statusCode).toBe(201);
    expect(repeated.json<{ id: string }>().id).toBe(manifest.id);

    const beforeRestart = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    const snapshot = beforeRestart.json<{
      applications: unknown[];
      opportunities: unknown[];
      importManifests: unknown[];
      profileFacts: { status: string }[];
    }>();
    expect(snapshot.applications).toHaveLength(6);
    expect(snapshot.opportunities).toHaveLength(6);
    expect(snapshot.importManifests).toHaveLength(1);
    expect(
      snapshot.profileFacts.every((fact) => fact.status === "proposed"),
    ).toBe(true);

    await server.close();
    server = await createServer({
      workspaceRoot: workspace,
      csrfToken: CSRF,
      idFactory: new DeterministicIdFactory("SYN7H2MP00"),
    });
    const afterRestart = await server.inject({
      method: "GET",
      url: "/api/v1/snapshot",
    });
    expect(
      afterRestart.json<{ importManifests: unknown[] }>().importManifests,
    ).toHaveLength(1);

    const nextPreview = await post("/api/v1/imports/career-ops/preview", {
      sourceDirectory: source,
    });
    expect(nextPreview.json()).toMatchObject({
      alreadyImported: true,
      changedSource: false,
    });
  });

  it("rejects apply when source bytes change after preview and then reports the changed source", async () => {
    await initialize();
    const first = (
      await post("/api/v1/imports/career-ops/preview", {
        sourceDirectory: source,
      })
    ).json<{ previewId: string; sourceFingerprint: string }>();
    await writeFile(join(source, "cv.md"), "# Changed synthetic CV\n", "utf8");
    const stale = await post(
      `/api/v1/imports/career-ops/${first.previewId}/apply`,
      {
        sourceFingerprint: first.sourceFingerprint,
        confirm: true,
      },
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: { code: "revision_conflict" },
    });
  });
});
