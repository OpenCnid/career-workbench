import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  DeterministicIdFactory,
  FixedClock,
  WorkbenchService,
} from "../../packages/application/src/index.js";
import type {
  CommandContext,
  EntityId,
  SourceLocator,
  UtcTimestamp,
} from "../../packages/domain/src/index.js";
import {
  ContentAddressedArtifactStore,
  SqliteWorkspaceStore,
  restoreWorkspaceBackup,
} from "../../packages/storage/src/index.js";

const NOW = "2026-01-15T12:00:00.000Z" as UtcTimestamp;
const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (root.startsWith(tmpdir()))
      await rm(root, { recursive: true, force: true });
  }
});

function command(ids: DeterministicIdFactory, key: string): CommandContext {
  return {
    commandId: ids.entity("command"),
    actor: "user",
    idempotencyKey: `synthetic-command-${key.padEnd(16, "0")}`,
  };
}

function locator(
  sourceId: EntityId,
  text: string,
  quote: string,
): SourceLocator {
  const start = text.indexOf(quote);
  if (start < 0) throw new Error("Synthetic locator quote is absent.");
  return { sourceId, start, end: start + quote.length, quote };
}

async function createFixture(label: string): Promise<{
  root: string;
  store: SqliteWorkspaceStore;
  artifacts: ContentAddressedArtifactStore;
  service: WorkbenchService;
  ids: DeterministicIdFactory;
  factId: EntityId;
  opportunityId: EntityId;
  evaluationId: EntityId;
  artifactId: EntityId;
  rejectedEvidenceId: EntityId;
}> {
  const parent = await mkdtemp(join(tmpdir(), `career-workbench-${label}-`));
  roots.push(parent);
  const root = join(parent, "workspace");
  const ids = new DeterministicIdFactory("SYN7HE71C0");
  const workspaceId = ids.workspace();
  const store = await SqliteWorkspaceStore.create(root, NOW);
  const artifacts = new ContentAddressedArtifactStore(root, 1024 * 1024);
  const service = new WorkbenchService(
    workspaceId,
    store,
    artifacts,
    ids,
    new FixedClock(NOW),
  );
  await service.initializeWorkspace(
    {
      displayName: "Synthetic Search",
      locale: "en-US",
      timezone: "America/Chicago",
    },
    command(ids, "workspace"),
  );

  const candidateText = "Avery Example built TypeScript services.";
  const candidateSource = await service.captureSource(
    {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: candidateText,
      originalLocator: "synthetic://candidate/cv",
    },
    command(ids, "candidate-source"),
  );
  const candidateLocator = locator(
    candidateSource.id,
    candidateText,
    "Avery Example built TypeScript services",
  );
  const proposedFact = await service.proposeProfileFact(
    {
      factType: "experience",
      subject: "Avery Example",
      predicate: "built",
      value: "TypeScript services",
      sourceLocators: [candidateLocator],
      proposedBy: "system",
    },
    command(ids, "fact-propose"),
  );
  const fact = await service.confirmProfileFact(
    proposedFact.id,
    proposedFact.revision,
    { kind: "confirm" },
    command(ids, "fact-confirm"),
  );

  const jobText =
    "Synthetic Labs seeks TypeScript expertise. The work is remote within the United States.";
  const jobSource = await service.captureSource(
    {
      kind: "opportunity",
      trustClass: "external",
      mediaType: "text/plain",
      text: jobText,
      originalLocator: "https://example.test/jobs/SYN-100",
    },
    command(ids, "job-source"),
  );
  const opportunity = await service.captureOpportunity(
    {
      sourceDocumentId: jobSource.id,
      organization: "Synthetic Labs",
      roleTitle: "Platform Engineer",
      originalUrl: "https://example.test/jobs/SYN-100",
      workArrangement: "remote",
      requisitionId: "SYN-100",
    },
    command(ids, "opportunity"),
  );

  const candidateEvidence = await service.proposeEvidence(
    {
      classification: "candidate_fact",
      claim: "Avery Example built TypeScript services",
      sourceId: candidateSource.id,
      locator: candidateLocator,
      candidateFactId: fact.id,
    },
    command(ids, "candidate-evidence"),
  );
  const acceptedCandidateEvidence = await service.decideEvidence(
    candidateEvidence.id,
    candidateEvidence.revision,
    "accepted",
    "Exact primary candidate support.",
    command(ids, "candidate-evidence-accept"),
  );
  const jobQuote = "TypeScript expertise";
  const jobEvidence = await service.proposeEvidence(
    {
      classification: "opportunity_fact",
      claim: jobQuote,
      sourceId: jobSource.id,
      locator: locator(jobSource.id, jobText, jobQuote),
    },
    command(ids, "job-evidence"),
  );
  const acceptedJobEvidence = await service.decideEvidence(
    jobEvidence.id,
    jobEvidence.revision,
    "accepted",
    "Exact opportunity source support.",
    command(ids, "job-evidence-accept"),
  );
  const rejected = await service.proposeEvidence(
    { classification: "inference", claim: "The team is certainly ideal." },
    command(ids, "rejected-evidence"),
  );
  const rejectedEvidence = await service.decideEvidence(
    rejected.id,
    rejected.revision,
    "rejected",
    "Unsupported certainty.",
    command(ids, "rejected-evidence-decide"),
  );

  const rubric = await service.createRubric(
    {
      semanticVersion: "1.0.0",
      name: "Synthetic balanced fit",
      dimensions: [
        {
          key: "skills",
          label: "Skills evidence",
          weightBasisPoints: 7000,
          missingInput: "block",
          criticalMinimumBasisPoints: null,
        },
        {
          key: "preferences",
          label: "Preference evidence",
          weightBasisPoints: 3000,
          missingInput: "neutral",
          criticalMinimumBasisPoints: null,
        },
      ],
      thresholds: { strong: 7500 },
      displayScale: 100,
    },
    command(ids, "rubric"),
  );
  const evaluation = await service.evaluate(
    {
      opportunityId: opportunity.id,
      rubricId: rubric.id,
      dimensionInputs: [
        {
          dimensionKey: "skills",
          semanticScoreBasisPoints: 9000,
          evidenceIds: [acceptedCandidateEvidence.id, acceptedJobEvidence.id],
          disposition: null,
        },
        {
          dimensionKey: "preferences",
          semanticScoreBasisPoints: null,
          evidenceIds: [],
          disposition: "Preference not established",
        },
      ],
    },
    command(ids, "evaluation"),
  );
  const artifact = await service.sealEvaluationReport(
    evaluation.id,
    command(ids, "artifact"),
  );
  return {
    root,
    store,
    artifacts,
    service,
    ids,
    factId: fact.id,
    opportunityId: opportunity.id,
    evaluationId: evaluation.id,
    artifactId: artifact.id,
    rejectedEvidenceId: rejectedEvidence.id,
  };
}

describe("deterministic SQLite and filesystem vertical slice", () => {
  it("persists a completed evidence-gated evaluation and sealed artifact across restart", async () => {
    const fixture = await createFixture("restart");
    const evaluation = await fixture.store.get(
      "evaluation",
      fixture.evaluationId,
    );
    expect(evaluation).toMatchObject({
      state: "completed",
      aggregateScoreBasisPoints: 7800,
      displayScore: "78",
      gaps: ["Preference not established"],
    });
    expect(evaluation.acceptedEvidenceIds).not.toContain(
      fixture.rejectedEvidenceId,
    );
    const artifact = await fixture.store.get("artifact", fixture.artifactId);
    expect(artifact.state).toBe("sealed");
    const bytes = await fixture.artifacts.read(artifact);
    expect(new TextDecoder().decode(bytes)).toContain(
      "Deterministic total: 7800 basis points",
    );
    expect(await fixture.store.health()).toMatchObject({
      schemaVersion: 4,
      foreignKeys: true,
      journalMode: "wal",
      integrity: "ok",
    });
    await fixture.store.close();

    const reopened = await SqliteWorkspaceStore.open(fixture.root, NOW);
    const restored = await reopened.get("evaluation", fixture.evaluationId);
    expect(restored).toEqual(evaluation);
    const restoredArtifact = await reopened.get("artifact", fixture.artifactId);
    await expect(fixture.artifacts.read(restoredArtifact)).resolves.toEqual(
      bytes,
    );
    const events = await reopened.eventsAfter(restored.workspaceId, 0, 1000);
    expect(events.at(-1)?.eventKind).toBe("artifact.sealed");
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
    await reopened.close();
  });

  it("marks only dependent completed results stale after a verified-fact correction", async () => {
    const fixture = await createFixture("correction");
    const original = await fixture.store.get("profileFact", fixture.factId);
    const correctedText = "Avery Example built JavaScript services.";
    const source = await fixture.service.captureSource(
      {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: correctedText,
      },
      command(fixture.ids, "correction-source"),
    );
    const result = await fixture.service.correctVerifiedFact(
      original.id,
      original.revision,
      "JavaScript services",
      locator(
        source.id,
        correctedText,
        "Avery Example built JavaScript services",
      ),
      command(fixture.ids, "correction"),
    );
    expect(result.staleEvaluationIds).toEqual([fixture.evaluationId]);
    expect(result.staleArtifactIds).toEqual([fixture.artifactId]);
    await expect(
      fixture.store.get("evaluation", fixture.evaluationId),
    ).resolves.toMatchObject({
      state: "stale",
    });
    await expect(
      fixture.store.get("artifact", fixture.artifactId),
    ).resolves.toMatchObject({
      state: "stale",
    });
    const historicalEvidence = await fixture.store.list(
      "evidence",
      original.workspaceId,
    );
    expect(
      historicalEvidence.filter((item) => item.decision === "accepted"),
    ).toHaveLength(2);
    await fixture.store.close();
  });

  it("exports deterministic credential-free state with verified artifact bytes", async () => {
    const fixture = await createFixture("export");
    const exported = await fixture.service.exportWorkspace([
      fixture.artifactId,
    ]);
    expect(exported).toMatchObject({
      contractVersion: "v1",
      exportManifest: { schemaVersion: 1, credentialFree: true },
    });
    expect(canonicalString(exported)).not.toMatch(
      /token|cookie|authorization|jupyter.*key/iu,
    );
    await fixture.store.close();
  });

  it("creates equivalent normalized exports from independently built fixtures", async () => {
    const first = await createFixture("equivalent-a");
    const second = await createFixture("equivalent-b");
    const [left, right] = await Promise.all([
      first.store.normalizedExport(
        (await first.store.get("workspace", first.service.workspaceId)).id,
      ),
      second.store.normalizedExport(
        (await second.store.get("workspace", second.service.workspaceId)).id,
      ),
    ]);
    expect(left).toEqual(right);
    await first.store.close();
    await second.store.close();
  });

  it("creates and verifies a workspace-local backup", async () => {
    const fixture = await createFixture("backup");
    const relativePath = await fixture.store.backup("before-upgrade");
    expect(relativePath).toBe("backups/before-upgrade.sqlite");
    expect(
      (await readFile(join(fixture.root, relativePath))).byteLength,
    ).toBeGreaterThan(0);
    await fixture.store.close();
  });

  it("upgrades v3 opportunity rows and restores a verified backup with rollback", async () => {
    const fixture = await createFixture("upgrade-restore");
    await fixture.store.close();

    const databasePath = join(fixture.root, "career-workbench.sqlite");
    const downgraded = new Database(databasePath);
    downgraded
      .prepare(
        "UPDATE opportunities SET record_json = json_remove(record_json, '$.legitimacyStatus')",
      )
      .run();
    downgraded.prepare("DELETE FROM schema_migrations WHERE version = 4").run();
    downgraded.close();

    const upgraded = await SqliteWorkspaceStore.open(fixture.root, NOW);
    await expect(
      upgraded.get("opportunity", fixture.opportunityId),
    ).resolves.toMatchObject({ legitimacyStatus: "unknown" });
    expect(await upgraded.health()).toMatchObject({
      schemaVersion: 4,
      integrity: "ok",
    });
    await upgraded.backup("release-rehearsal");
    await upgraded.close();

    const altered = new Database(databasePath);
    altered
      .prepare(
        "UPDATE opportunities SET record_json = json_set(record_json, '$.organization', 'Altered Synthetic Org')",
      )
      .run();
    altered.close();

    const restored = await restoreWorkspaceBackup(
      fixture.root,
      "release-rehearsal",
      NOW,
    );
    await expect(
      restored.store.get("opportunity", fixture.opportunityId),
    ).resolves.toMatchObject({
      organization: "Synthetic Labs",
      legitimacyStatus: "unknown",
    });
    await expect(
      access(join(fixture.root, restored.rollbackRelativePath)),
    ).resolves.toBeUndefined();
    await restored.store.close();
  });

  it("returns an identical prior result for a matching idempotency key and rejects changed content", async () => {
    const fixture = await createFixture("idempotency");
    const sharedContext = command(fixture.ids, "idempotent-source");
    const input = {
      kind: "candidate" as const,
      trustClass: "candidate_primary" as const,
      mediaType: "text/plain",
      text: "Synthetic idempotency source.",
    };
    const first = await fixture.service.captureSource(input, sharedContext);
    const second = await fixture.service.captureSource(input, sharedContext);
    expect(second).toEqual(first);
    await expect(
      fixture.service.captureSource(
        { ...input, text: "Changed content under the same key." },
        sharedContext,
      ),
    ).rejects.toMatchObject({ code: "duplicate_identity" });
    await fixture.store.close();
  });

  it("rolls back every record and event when one mutation in a transaction conflicts", async () => {
    const fixture = await createFixture("rollback");
    const existing = (
      await fixture.store.list("source", fixture.service.workspaceId)
    )[0];
    if (existing === undefined)
      throw new Error("Synthetic fixture source is missing.");
    const uncommittedId = fixture.ids.entity("source");
    const uncommitted = { ...existing, id: uncommittedId };
    const context = command(fixture.ids, "rollback-command");
    const eventBase = {
      eventKind: "source.captured",
      aggregateRevision: 1,
      payload: {},
      timestamp: NOW,
      actor: "user" as const,
    };
    await expect(
      fixture.store.commit({
        workspaceId: fixture.service.workspaceId,
        context,
        command: { kind: "synthetic.rollback" },
        mutations: [
          { action: "insert", kind: "source", entity: uncommitted },
          { action: "insert", kind: "source", entity: existing },
        ],
        events: [
          { ...eventBase, aggregateId: uncommitted.id },
          { ...eventBase, aggregateId: existing.id },
        ],
        result: { inserted: uncommitted.id },
      }),
    ).rejects.toMatchObject({ code: "duplicate_identity" });
    await expect(
      fixture.store.get("source", uncommittedId),
    ).rejects.toMatchObject({
      code: "entity_not_found",
    });
    await fixture.store.close();
  });

  it("serializes competing corrections and rejects the stale revision", async () => {
    const fixture = await createFixture("concurrency");
    const original = await fixture.store.get("profileFact", fixture.factId);
    const originalLocator = original.sourceLocators[0];
    if (originalLocator === undefined)
      throw new Error("Synthetic fact locator is missing.");
    const competingStore = await SqliteWorkspaceStore.open(fixture.root, NOW);
    const competingIds = new DeterministicIdFactory("C0MPE71NG0");
    const competingService = new WorkbenchService(
      fixture.service.workspaceId,
      competingStore,
      fixture.artifacts,
      competingIds,
      new FixedClock(NOW),
    );
    try {
      const results = await Promise.allSettled([
        fixture.service.correctVerifiedFact(
          original.id,
          original.revision,
          "TypeScript service platforms",
          originalLocator,
          command(fixture.ids, "race-a"),
        ),
        competingService.correctVerifiedFact(
          original.id,
          original.revision,
          "TypeScript systems",
          originalLocator,
          command(competingIds, "race-b"),
        ),
      ]);
      expect(
        results.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(1);
      const rejection = results.find((item) => item.status === "rejected");
      expect(rejection).toMatchObject({
        reason: { code: "revision_conflict" },
      });
    } finally {
      await competingStore.close();
      await fixture.store.close();
    }
  });

  it("persists all four candidate-fact confirmation outcomes without laundering uncertainty", async () => {
    const fixture = await createFixture("confirmation-outcomes");
    const source = (
      await fixture.store.list("source", fixture.service.workspaceId)
    ).find((item) => item.kind === "candidate");
    if (source?.inlineText === null || source === undefined) {
      throw new Error("Synthetic candidate source is missing.");
    }
    const sourceLocator = locator(
      source.id,
      source.inlineText,
      "Avery Example built TypeScript services",
    );
    const makeFact = async (suffix: string) =>
      fixture.service.proposeProfileFact(
        {
          factType: "experience",
          subject: "Avery Example",
          predicate: "described",
          value: suffix,
          sourceLocators: [sourceLocator],
          proposedBy: "agent",
        },
        command(fixture.ids, `outcome-${suffix}`),
      );
    const narrative = await makeFact("narrative");
    const cannotConfirm = await makeFact("unknown");
    const correction = await makeFact("incorrect");
    await expect(
      fixture.service.confirmProfileFact(
        narrative.id,
        narrative.revision,
        { kind: "narrative_only" },
        command(fixture.ids, "outcome-narrative-decide"),
      ),
    ).resolves.toMatchObject({ status: "derived_unverified" });
    await expect(
      fixture.service.confirmProfileFact(
        cannotConfirm.id,
        cannotConfirm.revision,
        { kind: "cannot_confirm" },
        command(fixture.ids, "outcome-unknown-decide"),
      ),
    ).resolves.toMatchObject({ status: "user_cannot_confirm" });
    await expect(
      fixture.service.confirmProfileFact(
        correction.id,
        correction.revision,
        { kind: "correct", value: "corrected", locator: sourceLocator },
        command(fixture.ids, "outcome-correct-decide"),
      ),
    ).resolves.toMatchObject({
      status: "verified",
      value: "corrected",
      supersedesFactId: correction.id,
    });
    await fixture.store.close();
  });
});

function canonicalString(value: unknown): string {
  return JSON.stringify(value);
}
