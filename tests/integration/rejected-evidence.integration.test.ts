import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
} from "../../packages/storage/src/index.js";

const NOW = "2026-09-01T12:00:00.000Z" as UtcTimestamp;
const roots: string[] = [];
const stores: SqliteWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of stores.splice(0)) {
    await store.close();
  }
  for (const root of roots.splice(0)) {
    if (root.startsWith(tmpdir())) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

function command(ids: DeterministicIdFactory, key: string): CommandContext {
  return {
    commandId: ids.entity("command"),
    actor: "user",
    idempotencyKey: `synthetic-rejection-${key.padEnd(16, "0")}`,
  };
}

function locator(
  sourceId: EntityId,
  sourceText: string,
  quote: string,
): SourceLocator {
  const start = sourceText.indexOf(quote);
  if (start < 0) throw new Error("Synthetic quote is absent from its source.");
  return { sourceId, start, end: start + quote.length, quote };
}

async function setup(label: string): Promise<{
  ids: DeterministicIdFactory;
  service: WorkbenchService;
  store: SqliteWorkspaceStore;
}> {
  const parent = await mkdtemp(join(tmpdir(), `career-workbench-${label}-`));
  roots.push(parent);
  const workspaceRoot = join(parent, "workspace");
  const ids = new DeterministicIdFactory("REJEC7ED00");
  const workspaceId = ids.workspace();
  const store = await SqliteWorkspaceStore.create(workspaceRoot, NOW);
  stores.push(store);
  const service = new WorkbenchService(
    workspaceId,
    store,
    new ContentAddressedArtifactStore(workspaceRoot),
    ids,
    new FixedClock(NOW),
  );
  await service.initializeWorkspace(
    {
      displayName: "Synthetic rejected-evidence workspace",
      locale: "en-US",
      timezone: "America/Chicago",
    },
    command(ids, "workspace"),
  );
  return { ids, service, store };
}

describe("rejected evidence identity", () => {
  it("bars a normalized retry under a fresh generated evidence id", async () => {
    const { ids, service, store } = await setup("normalized-retry");
    const rejectedProposal = await service.proposeEvidence(
      { classification: "inference", claim: "The team is certainly ideal." },
      command(ids, "reject-propose"),
    );
    await service.decideEvidence(
      rejectedProposal.id,
      rejectedProposal.revision,
      "rejected",
      "Unsupported certainty.",
      command(ids, "reject-decide"),
    );

    const retryContext = command(ids, "retry-propose");
    const retry = await service.proposeEvidence(
      {
        classification: "inference",
        claim: "  THE team  is certainly ideal.\n",
      },
      retryContext,
    );
    const idempotentRetry = await service.proposeEvidence(
      {
        classification: "inference",
        claim: "  THE team  is certainly ideal.\n",
      },
      { ...retryContext, commandId: ids.entity("command") },
    );
    expect(idempotentRetry.id).toBe(retry.id);
    await expect(
      service.decideEvidence(
        retry.id,
        retry.revision,
        "accepted",
        "A generated identity must not erase rejection.",
        command(ids, "retry-accept"),
      ),
    ).rejects.toMatchObject({
      code: "evidence_unsupported",
      details: { rejectedEvidenceId: rejectedProposal.id },
    });
    await expect(store.get("evidence", retry.id)).resolves.toMatchObject({
      revision: 1,
      decision: "proposed",
    });
  });

  it("does not mistake a copied source id for new evidence, but permits new source bytes", async () => {
    const { ids, service } = await setup("source-identity");
    const claim = "Synthetic Labs supports remote work.";
    const firstSource = await service.captureSource(
      {
        kind: "company",
        trustClass: "external",
        mediaType: "text/plain",
        text: claim,
        originalLocator: "https://example.test/company/first",
      },
      command(ids, "source-first"),
    );
    const firstProposal = await service.proposeEvidence(
      {
        classification: "company_fact",
        claim,
        sourceId: firstSource.id,
        locator: locator(firstSource.id, claim, claim),
      },
      command(ids, "source-reject-propose"),
    );
    await service.decideEvidence(
      firstProposal.id,
      firstProposal.revision,
      "rejected",
      "The first capture was rejected.",
      command(ids, "source-reject-decide"),
    );

    const copiedSource = await service.captureSource(
      {
        kind: "company",
        trustClass: "external",
        mediaType: "text/plain",
        text: claim,
        originalLocator: "https://example.test/company/copied-id",
      },
      command(ids, "source-copy"),
    );
    expect(copiedSource.id).not.toBe(firstSource.id);
    expect(copiedSource.contentDigest).toBe(firstSource.contentDigest);
    const copiedProposal = await service.proposeEvidence(
      {
        classification: "company_fact",
        claim,
        sourceId: copiedSource.id,
        locator: locator(copiedSource.id, claim, claim),
      },
      command(ids, "source-copy-propose"),
    );
    await expect(
      service.decideEvidence(
        copiedProposal.id,
        copiedProposal.revision,
        "accepted",
        "A copied source identity is not new support.",
        command(ids, "source-copy-accept"),
      ),
    ).rejects.toMatchObject({ code: "evidence_unsupported" });

    const newSourceText = `Independent corroboration: ${claim}`;
    const newSource = await service.captureSource(
      {
        kind: "company",
        trustClass: "external",
        mediaType: "text/plain",
        text: newSourceText,
        originalLocator: "https://example.test/company/corroboration",
      },
      command(ids, "source-new"),
    );
    expect(newSource.contentDigest).not.toBe(firstSource.contentDigest);
    const distinctProposal = await service.proposeEvidence(
      {
        classification: "company_fact",
        claim,
        sourceId: newSource.id,
        locator: locator(newSource.id, newSourceText, claim),
      },
      command(ids, "source-new-propose"),
    );
    await expect(
      service.decideEvidence(
        distinctProposal.id,
        distinctProposal.revision,
        "accepted",
        "Independent source bytes create a distinct proposal.",
        command(ids, "source-new-accept"),
      ),
    ).resolves.toMatchObject({ decision: "accepted" });
  });

  it("permits the same source-bound identity only through linked user correction", async () => {
    const { ids, service } = await setup("user-correction");
    const claim = "Avery Example built TypeScript services";
    const source = await service.captureSource(
      {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: claim,
        originalLocator: "user-entry://synthetic-correction",
      },
      command(ids, "candidate-source"),
    );
    const sourceLocator = locator(source.id, claim, claim);
    const proposedFact = await service.proposeProfileFact(
      {
        factType: "experience",
        subject: "Avery Example",
        predicate: "built",
        value: "TypeScript services",
        sourceLocators: [sourceLocator],
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
    const rejected = await service.proposeEvidence(
      {
        classification: "candidate_fact",
        claim,
        sourceId: source.id,
        locator: sourceLocator,
        candidateFactId: fact.id,
      },
      command(ids, "candidate-reject-propose"),
    );
    await service.decideEvidence(
      rejected.id,
      rejected.revision,
      "rejected",
      "User requested correction before acceptance.",
      command(ids, "candidate-reject-decide"),
    );
    const uncorrectedRetry = await service.proposeEvidence(
      {
        classification: "candidate_fact",
        claim,
        sourceId: source.id,
        locator: sourceLocator,
        candidateFactId: fact.id,
      },
      command(ids, "candidate-retry-propose"),
    );
    await expect(
      service.decideEvidence(
        uncorrectedRetry.id,
        uncorrectedRetry.revision,
        "accepted",
        "A retry alone remains barred.",
        command(ids, "candidate-retry-accept"),
      ),
    ).rejects.toMatchObject({ code: "evidence_unsupported" });

    const correction = await service.correctVerifiedFact(
      fact.id,
      fact.revision,
      fact.value,
      sourceLocator,
      command(ids, "fact-correction"),
    );
    const correctedProposal = await service.proposeEvidence(
      {
        classification: "candidate_fact",
        claim,
        sourceId: source.id,
        locator: sourceLocator,
        candidateFactId: correction.fact.id,
      },
      command(ids, "corrected-propose"),
    );
    await expect(
      service.decideEvidence(
        correctedProposal.id,
        correctedProposal.revision,
        "accepted",
        "Linked user correction creates a distinct proposal.",
        command(ids, "corrected-accept"),
      ),
    ).resolves.toMatchObject({ decision: "accepted" });
  });
});
