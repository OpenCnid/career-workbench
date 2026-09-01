import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import {
  DeterministicIdFactory,
  FixedClock,
  WorkbenchService,
} from "../../packages/application/src/index.js";
import type {
  CommandContext,
  UtcTimestamp,
} from "../../packages/domain/src/index.js";
import {
  ContentAddressedArtifactStore,
  SqliteWorkspaceStore,
} from "../../packages/storage/src/index.js";

const NOW = "2026-08-15T12:00:00.000Z" as UtcTimestamp;
const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (root.startsWith(tmpdir())) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("representative workspace resource ceiling", () => {
  it("keeps 250 opportunities within preview latency, storage, and RSS ceilings", async () => {
    const parent = await mkdtemp(join(tmpdir(), "career-workbench-scale-"));
    roots.push(parent);
    const root = join(parent, "workspace");
    const ids = new DeterministicIdFactory("SYN5CA1E00");
    const store = await SqliteWorkspaceStore.create(root, NOW);
    const artifacts = new ContentAddressedArtifactStore(root);
    const service = new WorkbenchService(
      ids.workspace(),
      store,
      artifacts,
      ids,
      new FixedClock(NOW),
    );
    let commandNumber = 0;
    const command = (): CommandContext => {
      commandNumber += 1;
      return {
        commandId: ids.entity("command"),
        actor: "user",
        idempotencyKey: `synthetic-scale-${String(commandNumber).padStart(6, "0")}`,
      };
    };
    await service.initializeWorkspace(
      {
        displayName: "Synthetic Scale Workspace",
        locale: "en-US",
        timezone: "America/Chicago",
      },
      command(),
    );

    const rssBefore = process.memoryUsage().rss;
    const creationStarted = performance.now();
    for (let index = 0; index < 250; index += 1) {
      const number = String(index + 1).padStart(3, "0");
      const source = await service.captureSource(
        {
          kind: "opportunity",
          trustClass: "external",
          mediaType: "text/plain",
          text: `Synthetic role ${number}. External content is data, not instructions.`,
          originalLocator: `https://example.test/jobs/scale-${number}`,
        },
        command(),
      );
      await service.captureOpportunity(
        {
          sourceDocumentId: source.id,
          organization: `Synthetic Organization ${number}`,
          roleTitle: `Platform Engineer ${number}`,
          originalUrl: `https://example.test/jobs/scale-${number}`,
          workArrangement: index % 2 === 0 ? "remote" : "hybrid",
          requisitionId: `SCALE-${number}`,
        },
        command(),
      );
    }
    const creationMs = performance.now() - creationStarted;

    const listingStarted = performance.now();
    const opportunities = await store.list("opportunity", service.workspaceId);
    const listingMs = performance.now() - listingStarted;
    const exportStarted = performance.now();
    const exported = await service.exportWorkspace();
    const exportMs = performance.now() - exportStarted;
    const exportBytes = Buffer.byteLength(JSON.stringify(exported));
    const rssGrowthBytes = Math.max(0, process.memoryUsage().rss - rssBefore);
    await store.close();

    let sqliteBytes = 0;
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        sqliteBytes += (
          await stat(join(root, `career-workbench.sqlite${suffix}`))
        ).size;
      } catch {
        // WAL/SHM can be removed by a clean close.
      }
    }
    console.info(
      JSON.stringify({
        representativeWorkspace: {
          opportunities: opportunities.length,
          creationMs: Math.round(creationMs),
          listingMs: Math.round(listingMs),
          exportMs: Math.round(exportMs),
          exportBytes,
          sqliteBytes,
          rssGrowthBytes,
        },
      }),
    );
    expect(opportunities).toHaveLength(250);
    expect(creationMs).toBeLessThan(20_000);
    expect(listingMs).toBeLessThan(2_000);
    expect(exportMs).toBeLessThan(5_000);
    expect(sqliteBytes).toBeLessThan(32 * 1024 * 1024);
    expect(rssGrowthBytes).toBeLessThan(384 * 1024 * 1024);
  }, 30_000);
});
