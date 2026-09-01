import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverCareerOps,
  mapCareerOpsStatus,
  normalizeKey,
} from "../src/index.js";

const fixture = resolve("tests/fixtures/career-ops-v1.18");
const temporary: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "career-ops-import-unit-"));
  temporary.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Career Ops read-only discovery", () => {
  it("maps the exact pinned upgrade fixture without mutating its bytes", async () => {
    const before = await discoverCareerOps(fixture);
    const after = await discoverCareerOps(fixture);

    expect(before.preview.sourceFingerprint).toBe(
      "d7b6954e58775950c97ba66e0a211aea64552ae92d0b0963f70b6a0930fb88d9",
    );
    expect(after.preview.sourceFingerprint).toBe(
      before.preview.sourceFingerprint,
    );
    expect(before.preview.files).toHaveLength(5);
    expect(before.preview.applications).toHaveLength(6);
    expect(before.preview.applications.map((row) => row.mappedState)).toEqual([
      "applied",
      "interview",
      "closed",
      "considering",
      "rejected",
      "applied",
    ]);
    expect(before.preview.profileFacts.length).toBeGreaterThan(8);
    expect(
      before.preview.profileFacts.map((fact) => fact.confirmationRequired),
    ).toEqual(Array(before.preview.profileFacts.length).fill(true));
    expect(
      before.plan.passiveMappings.filter(
        (item) => item.sourceType === "evaluation_report",
      ),
    ).toHaveLength(2);
  });

  it("handles partial, customized, multilingual, duplicate, and unsupported input visibly", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(
      join(root, "data", "applications.md"),
      [
        "| # | Fecha | Empresa | Puesto | Location | Score | Status | Notes |",
        "|---|---|---|---|---|---|---|---|",
        "| 1 | 2026-07-01 | 株式会社光 | SRE | 東京 | 4.1/5 | Mülakat | first |",
        "| 1 | 2026-07-01 | 株式会社光 | SRE | 東京 | 4.1/5 | Mülakat | duplicate |",
        "| 2 | 2026-07-02 | Örnek | Platform | Remote | 4.0/5 | bilinmiyor | unknown |",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, ".env"),
      "OPENAI_API_KEY=synthetic-never-import\n",
      "utf8",
    );
    await writeFile(
      join(root, "worker.mjs"),
      "throw new Error('never execute');\n",
      "utf8",
    );

    const result = await discoverCareerOps(root);

    expect(result.preview.applications).toEqual([
      expect.objectContaining({
        organization: "株式会社光",
        mappedState: "interview",
      }),
    ]);
    expect(result.preview.warnings.join(" ")).toMatch(/Duplicate tracker row/u);
    expect(result.preview.warnings.join(" ")).toMatch(/unsupported status/u);
    expect(result.preview.files.map((file) => file.relativePath)).toEqual([
      "data/applications.md",
    ]);
    expect(result.preview.unsupported.join(" ")).toMatch(/credentials/u);
    expect(normalizeKey("İstanbul Tekstil")).toBe(
      normalizeKey("Istanbul Tekstil"),
    );
    expect(normalizeKey("株式会社光")).not.toBe("");
  });

  it("rejects corrupt required YAML and never guesses", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "config"), { recursive: true });
    await writeFile(
      join(root, "config", "profile.yml"),
      "candidate: [unterminated\n",
      "utf8",
    );
    await expect(discoverCareerOps(root)).rejects.toMatchObject({
      code: "external_content_rejected",
    });
  });

  it("keeps the pinned English, Spanish, and Turkish status mapping explicit", () => {
    expect(mapCareerOpsStatus("Applied 2026-03-12")).toBe("applied");
    expect(mapCareerOpsStatus("Rechazado")).toBe("rejected");
    expect(mapCareerOpsStatus("Başvuruldu")).toBe("applied");
    expect(mapCareerOpsStatus("Değerlendirildi")).toBe("considering");
    expect(mapCareerOpsStatus("unknown custom state")).toBeNull();
  });

  it("detects a changed source fingerprint", async () => {
    const root = await tempRoot();
    await cp(fixture, root, { recursive: true });
    const first = await discoverCareerOps(root);
    await writeFile(join(root, "cv.md"), "# Synthetic changed CV\n", "utf8");
    const second = await discoverCareerOps(root);
    expect(second.preview.sourceFingerprint).not.toBe(
      first.preview.sourceFingerprint,
    );
    expect(second.plan.sourceIdentityDigest).toBe(
      first.plan.sourceIdentityDigest,
    );
  });

  it("never invents an application date for malformed or impossible input", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(
      join(root, "data", "applications.md"),
      [
        "| # | Date | Company | Role | Score | Status |",
        "|---|---|---|---|---|---|",
        "| 1 | someday | Synthetic One | Engineer | 4/5 | Applied |",
        "| 2 | 2026-02-31 | Synthetic Two | Engineer | 4/5 | Applied |",
        "| 3 | 2026-02-28 | Synthetic Three | Engineer | 4/5 | Applied |",
      ].join("\n"),
      "utf8",
    );

    const result = await discoverCareerOps(root);

    expect(result.preview.applications).toEqual([
      expect.objectContaining({ organization: "Synthetic Three" }),
    ]);
    expect(result.preview.warnings.join(" ")).toMatch(
      /row 1.*invalid or missing date/u,
    );
    expect(result.preview.warnings.join(" ")).toMatch(
      /row 2.*invalid or missing date/u,
    );
    expect(JSON.stringify(result.plan)).not.toContain("1970-01-01");
  });
});
