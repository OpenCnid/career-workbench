import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

const evidenceRoot = join("docs", "qa", "generated", "milestone-2");
const childEvidenceRoot = join("docs", "qa", "generated", "milestone-4");
const rlmEvidenceRoot = join("docs", "qa", "generated", "milestone-5");
const importEvidenceRoot = join("docs", "qa", "generated", "milestone-6");
const productEvidenceRoot = join("docs", "qa", "generated", "milestone-7");
const DSH_TOKEN = "synthetic-e2e-dsh-token-00000000000000000000";
const DSH_SESSION = "00000000-0000-4000-8000-000000000101";

interface OperationResponse {
  readonly id: string;
  readonly revision: number;
}

interface BrowserSnapshot {
  readonly searchProfiles: readonly { readonly id: string }[];
  readonly discoveryLeads: readonly {
    readonly id: string;
    readonly state: string;
  }[];
  readonly opportunities: readonly { readonly id: string }[];
  readonly rubrics: readonly { readonly id: string }[];
  readonly evidence: readonly {
    readonly id: string;
    readonly decision: string;
  }[];
  readonly operations: readonly {
    readonly id: string;
    readonly route: string;
  }[];
  readonly evaluations: readonly {
    readonly id: string;
    readonly state: string;
    readonly operationId: string | null;
  }[];
  readonly importManifests: readonly {
    readonly mappings: readonly { readonly disposition: string }[];
  }[];
}

async function responseJson<Value>(response: APIResponse): Promise<Value> {
  const raw: unknown = await response.json();
  return raw as Value;
}

test.describe.configure({ mode: "serial" });

async function createWorkspaceIfNeeded(page: Page) {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Start Career Workbench" });
  if (await create.isVisible()) {
    await expect(
      page.getByText(/one private local workbench at a time/u),
    ).toBeVisible();
    await expect(page.getByLabel("Workbench name")).toHaveValue(
      "My Career Workbench",
    );
    await expect(
      page.getByText(/does not create a switchable project/u),
    ).toBeVisible();
    await page.getByLabel("Your name").fill("Avery Example");
    await page
      .getByLabel("I am still exploring and want to set target roles later")
      .check();
    await create.click();
    await expect(
      page.getByRole("heading", {
        name: "Make your next move with evidence.",
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Current workbench: My Career Workbench"),
    ).toBeVisible();
  }
}

test("complete source-to-sealed-artifact flow survives correction and exposes activity", async ({
  page,
}) => {
  await mkdir(evidenceRoot, { recursive: true });
  await mkdir(childEvidenceRoot, { recursive: true });
  await mkdir(rlmEvidenceRoot, { recursive: true });
  await mkdir(importEvidenceRoot, { recursive: true });
  await mkdir(productEvidenceRoot, { recursive: true });
  await createWorkspaceIfNeeded(page);
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.getByRole("heading", {
      name: "From career history to a clear next move.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/of 6 stages complete/u)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Add career history/u }).first(),
  ).toHaveAttribute("href", "/profile");

  await page.evaluate(() => {
    localStorage.setItem(
      "career-workbench-authority",
      JSON.stringify({ verifiedFacts: 99, approvals: ["all"] }),
    );
  });
  await page.reload();
  await expect(
    page.getByText("Verified facts").locator("..").locator("strong"),
  ).toHaveText("2");

  await page.getByRole("link", { name: "Profile" }).click();
  const careerDirection = page.getByRole("region", {
    name: "Targets and preferences",
  });
  await expect(careerDirection).toContainText(
    "Complete the target roles deferred during setup.",
  );
  await careerDirection
    .getByLabel("Target role")
    .fill("Senior Software Engineer focused on AI platforms");
  await careerDirection
    .getByLabel(/Priorities/u)
    .fill("Hands-on AI systems and strong engineering culture");
  await careerDirection
    .getByLabel(/Location or work style/u)
    .fill("Remote in the United States");
  await careerDirection
    .getByRole("button", { name: "Add preferences for review" })
    .click();
  await expect(careerDirection).toContainText("Preference proposals saved.");
  for (const claim of [
    "Avery Example targets Senior Software Engineer focused on AI platforms",
    "Avery Example prioritizes Hands-on AI systems and strong engineering culture",
    "Avery Example prefers Remote in the United States",
  ]) {
    const proposedPreference = page
      .locator(".fact-card")
      .filter({ hasText: claim });
    await expect(proposedPreference).toContainText("proposed");
    await proposedPreference
      .getByRole("button", { name: `Confirm ${claim}`, exact: true })
      .click();
    await expect(proposedPreference).toContainText("verified");
  }
  await expect(careerDirection).toContainText(
    "Senior Software Engineer focused on AI platforms",
  );
  await expect(careerDirection).toContainText(
    "Hands-on AI systems and strong engineering culture",
  );
  await expect(
    careerDirection.getByRole("link", { name: "Review preference facts" }),
  ).toHaveAttribute("href", "#profile-fact-review");
  await page.getByRole("tab", { name: "Add a role manually" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Avery Example");
  await page.getByLabel("Your name").fill("Avery Example");
  await page.getByLabel("Role title").fill("Software Engineer");
  await page.getByLabel("Organization").fill("Synthetic Systems");
  await page.getByLabel("Dates").fill("2021 to 2024");
  await page.getByLabel(/Achievements/u).fill("built TypeScript services");
  await page.getByRole("button", { name: "Add role for review" }).click();
  await expect(page.getByText("Role added.")).toBeVisible();
  const proposed = page
    .locator(".fact-card")
    .filter({ hasText: "TypeScript services" });
  await expect(proposed).toContainText("proposed");
  await proposed
    .getByRole("button", {
      name: "Confirm Avery Example built TypeScript services",
      exact: true,
    })
    .click();
  await expect(proposed).toContainText("verified");
  const factProvenance = proposed.getByLabel(
    "Source provenance for Avery Example built TypeScript services",
  );
  await expect(factProvenance).toContainText(
    "Avery Example built TypeScript services",
  );
  await expect(factProvenance).toContainText("candidate primary");

  await page.getByRole("tab", { name: "Paste résumé or CV" }).click();
  await page
    .getByLabel("Résumé or CV text")
    .fill("Avery Example documented synthetic release notes");
  await page.getByRole("button", { name: "Save résumé text" }).click();
  await expect(
    page.getByText(/Résumé text saved as an immutable source/u),
  ).toBeVisible();
  await page
    .getByText("Advanced: add an exact statement from a saved source")
    .click();
  await page.getByLabel("Predicate").fill("documented");
  await page.getByLabel("Value").fill("synthetic release notes");
  await page.getByRole("button", { name: "Add statement for review" }).click();
  const correctionCandidate = page
    .locator(".fact-card")
    .filter({ hasText: "Avery Example documented synthetic release notes" });
  await correctionCandidate
    .getByRole("button", {
      name: "Correct Avery Example documented synthetic release notes",
    })
    .click();
  await correctionCandidate
    .getByLabel("Corrected value")
    .fill("reviewed synthetic release notes");
  await correctionCandidate
    .getByRole("button", {
      name: "Save correction for Avery Example documented synthetic release notes",
    })
    .click();
  await expect(correctionCandidate).toContainText("superseded");
  await expect(
    page.locator(".fact-card").filter({
      hasText: "Avery Example documented reviewed synthetic release notes",
    }),
  ).toContainText("verified");

  await page.getByRole("link", { name: "Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "Find roles worth your time" }),
  ).toBeVisible();
  await expect(page.getByLabel("Target roles")).toHaveValue(
    "Senior Software Engineer focused on AI platforms",
  );
  await page.getByLabel("Seniority").selectOption("senior");
  await page
    .getByLabel("AI direction")
    .fill("Production AI platforms, evaluation, and agent infrastructure");
  await page
    .getByLabel(/Exclusions/u)
    .fill("Commission-only roles\nMandatory relocation");
  await page.getByRole("button", { name: "Save search direction" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy DSH discovery request" }),
  ).toBeEnabled();

  const discoverySeed = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const searchProfile = discoverySeed.searchProfiles[0];
  if (searchProfile === undefined)
    throw new Error("Expected the browser to persist search criteria.");
  let discoveryCommand = 0;
  const discoveryHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-e2e-discovery-${String(++discoveryCommand).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  const discoveryOperationResponse = await page.request.post(
    "/api/v1/operations",
    {
      headers: discoveryHeaders(),
      data: {
        kind: "job_discovery",
        inputIdentity: searchProfile.id,
        requestedCapabilities: ["external_research", "discovery_lead.record"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    },
  );
  expect(discoveryOperationResponse.ok()).toBe(true);
  const discoveryOperation = await responseJson<OperationResponse>(
    discoveryOperationResponse,
  );
  const discoveryLeadIds: string[] = [];
  for (let index = 1; index <= 9; index += 1) {
    const leadResponse = await page.request.post("/api/v1/discovery-leads", {
      headers: discoveryHeaders(discoveryOperation.id),
      data: {
        organization: `Synthetic AI Company ${String(index)}`,
        roleTitle: `Senior AI Platform Engineer ${String(index)}`,
        originalUrl: `https://jobs.example.test/discovery/${String(index)}`,
        postingText: `Synthetic AI Company ${String(index)} seeks a remote Senior AI Platform Engineer to build production evaluation infrastructure.`,
        location: "United States",
        workArrangement: "remote",
        advertisedCompensation: "$190,000-$225,000",
        requisitionId: `SYN-DISC-${String(index)}`,
        whyFound: ["The title and production AI scope match saved criteria."],
        matchedCriteria: ["Senior", "Remote", "AI platform"],
        gaps: ["On-call expectations are not stated."],
        risks: ["Posting liveness needs review."],
      },
    });
    expect(leadResponse.ok()).toBe(true);
    discoveryLeadIds.push(
      (await responseJson<{ readonly id: string }>(leadResponse)).id,
    );
  }
  const discoveryTerminal = await page.request.post(
    `/api/v1/operations/${discoveryOperation.id}/terminal`,
    {
      headers: discoveryHeaders(discoveryOperation.id),
      data: {
        expectedRevision: discoveryOperation.revision,
        state: "succeeded",
        category: "completed",
        message: "Recorded nine source-preserved synthetic discovery leads.",
        resultIds: discoveryLeadIds,
        artifactIds: [],
      },
    },
  );
  expect(discoveryTerminal.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText("9 to review")).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Senior AI Platform Engineer 9" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("heading", { name: "Senior AI Platform Engineer 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous" }).click();
  await page
    .locator(".discovery-card")
    .filter({ hasText: "Senior AI Platform Engineer 9" })
    .getByRole("button", { name: "Dismiss" })
    .click();
  await expect(page.getByText("8 to review")).toBeVisible();
  await page.getByRole("tab", { name: /Dismissed/u }).click();
  await expect(
    page.getByRole("heading", { name: "Senior AI Platform Engineer 9" }),
  ).toBeVisible();
  await page.screenshot({
    path: join(productEvidenceRoot, "discovery-inbox.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Return to inbox" }).click();
  await expect(
    page.getByText(/returned to the inbox for another look/u),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Inbox · 9/u })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Find roles worth your time" }),
  ).toBeVisible();
  await expect(page.getByLabel("Target roles")).toBeVisible();
  await page.screenshot({
    path: join(productEvidenceRoot, "discovery-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("link", { name: "Opportunities" }).click();
  await page.getByLabel("Organization").fill("Synthetic Labs");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page
    .getByLabel("Posting URL")
    .fill("https://example.test/jobs/platform-engineer");
  await page.getByLabel("Location").fill("Remote");
  await page.getByLabel("Work arrangement").selectOption("remote");
  await page
    .getByLabel("Posting text")
    .fill(
      "Synthetic Labs needs a Platform Engineer to build TypeScript services.",
    );
  await page.getByRole("button", { name: "Capture opportunity" }).click();
  await expect(
    page.getByRole("heading", { name: "Platform Engineer" }),
  ).toBeVisible();
  const capturedOpportunity = page
    .locator(".opportunity-card")
    .filter({ hasText: "Platform Engineer" });
  await capturedOpportunity
    .getByText("View preserved posting and provenance")
    .click();
  await expect(capturedOpportunity.locator(".source-metadata")).toContainText(
    "external",
  );
  await expect(
    capturedOpportunity.locator(".source-inspection pre"),
  ).toHaveText(
    "Synthetic Labs needs a Platform Engineer to build TypeScript services.",
  );

  await page.getByRole("link", { name: "Evaluations" }).click();
  await expect(
    page.getByLabel("Opportunity").locator('option[value=""]'),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Run local demonstration" }).click();
  const evaluation = page
    .locator(".evaluation-card")
    .filter({ hasText: "Platform Engineer" })
    .filter({
      hasText: "Local evidence-gate demonstration · not a fit recommendation",
    });
  await expect(evaluation.locator(".score strong")).toHaveText("78");
  await expect(evaluation).toContainText(
    "Local evidence-gate demonstration · not a fit recommendation",
  );
  await evaluation.getByRole("tab", { name: "Evidence" }).click();
  await expect(
    evaluation.getByRole("heading", { name: "Accepted evidence" }),
  ).toBeVisible();
  await expect(
    evaluation.locator(".evidence-list li").filter({
      hasText: "Avery Example built TypeScript services",
    }),
  ).toBeVisible();
  await expect(
    evaluation.getByRole("heading", {
      name: "Rejected evidence linked to evaluated sources",
    }),
  ).toBeVisible();
  await evaluation.getByRole("tab", { name: "Gaps" }).click();
  await expect(
    evaluation.getByRole("heading", { name: "Critical findings and gaps" }),
  ).toBeVisible();
  await expect(evaluation).toContainText(
    "Preference matching requires a live DSH semantic evaluation",
  );
  await expect(
    evaluation.getByRole("heading", { name: "Contradictions" }),
  ).toBeVisible();
  await expect(evaluation).toContainText("No contradictions recorded.");
  await evaluation.getByRole("tab", { name: "Artifacts" }).click();
  await evaluation
    .getByRole("button", { name: "Seal immutable report" })
    .click();
  await expect(evaluation).toContainText("sealed");
  await page.screenshot({
    path: join(evidenceRoot, "evaluation-sealed.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Opportunities" }).click();
  const firstOpportunity = page
    .locator(".opportunity-card")
    .filter({ hasText: "Platform Engineer" })
    .first();
  await firstOpportunity.getByLabel("Posting liveness").selectOption("active");
  await firstOpportunity
    .getByLabel("Legitimacy evidence")
    .selectOption("high_confidence");
  await firstOpportunity.getByRole("button", { name: "Save signals" }).click();
  await expect(firstOpportunity).toContainText("liveness active");
  await expect(firstOpportunity).toContainText("legitimacy high confidence");

  await page.getByRole("link", { name: "Pipeline" }).click();
  await page.getByRole("button", { name: "Start pipeline record" }).click();
  const application = page
    .locator(".application-card")
    .filter({ hasText: "Platform Engineer" });
  await expect(application).toContainText("considering");
  await expect(
    application.getByRole("link", {
      name: "Prepare evidence-backed materials",
    }),
  ).toHaveAttribute("href", "/drafts");
  await application.getByLabel("Record next state").selectOption("preparing");
  await application.getByRole("button", { name: "Record transition" }).click();
  await expect(application).toContainText("preparing");
  await expect(
    application.getByRole("link", {
      name: "Review and seal the current drafts",
    }),
  ).toHaveAttribute("href", "/drafts");
  await expect(application.getByLabel("Record next state")).toHaveValue(
    "ready_for_review",
  );
  await application.getByRole("button", { name: "Record transition" }).click();
  await expect(application).toContainText("ready for review");

  await page.getByRole("link", { name: "Drafts", exact: true }).click();
  await page.getByLabel("Artifact type").selectOption("draft_cover_letter");
  await page.getByRole("button", { name: "Generate staged draft" }).click();
  const draft = page
    .locator(".draft-card")
    .filter({ hasText: "draft cover letter" });
  await expect(draft).toContainText("staged");
  const artifactApproval = draft.getByLabel("artifact review approval");
  const requestArtifactApproval = artifactApproval.getByRole("button", {
    name: "Request approval to review and seal",
  });
  await expect(requestArtifactApproval).toBeDisabled();
  await expect(artifactApproval).toContainText(
    "Inspect the current content and provenance before requesting approval.",
  );
  await draft
    .getByRole("button", { name: "Inspect content and provenance" })
    .click();
  await expect(draft).toContainText("[NON-FACTUAL STYLE]");
  await expect(draft).toContainText("accepted evidence");
  await expect(requestArtifactApproval).toBeEnabled();
  await requestArtifactApproval.click();
  await expect(
    artifactApproval.getByText("pending", { exact: true }),
  ).toBeVisible();
  await expect(artifactApproval).toContainText("artifact.review");
  await expect(artifactApproval).toContainText("Bound revision");
  await expect(
    artifactApproval.getByText("Expires", { exact: true }),
  ).toBeVisible();
  await artifactApproval.getByRole("button", { name: "Deny request" }).click();
  await expect(
    artifactApproval.getByText("denied", { exact: true }),
  ).toBeVisible();
  const artifactTargetId = await artifactApproval.locator("code").textContent();
  if (artifactTargetId === null) throw new Error("Missing artifact target ID.");
  const browserSession = await responseJson<{ readonly csrfToken: string }>(
    await page.request.get("/api/v1/session"),
  );
  const expiringApproval = await page.request.post("/api/v1/approvals", {
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:4173",
      "sec-fetch-site": "same-origin",
      "x-cw-csrf": browserSession.csrfToken,
      "x-idempotency-key": "synthetic-e2e-expiring-artifact-approval",
    },
    data: {
      effectKind: "artifact.review",
      targetId: artifactTargetId,
      expectedRevision: 1,
      expiresInSeconds: 1,
    },
  });
  expect(expiringApproval.ok()).toBe(true);
  await page.waitForTimeout(1_200);
  await page.reload();
  await expect(
    artifactApproval.getByText("expired", { exact: true }),
  ).toBeVisible();
  await expect(requestArtifactApproval).toBeDisabled();
  await draft
    .getByRole("button", { name: "Inspect content and provenance" })
    .click();
  await artifactApproval
    .getByRole("button", { name: "Request approval to review and seal" })
    .click();
  await artifactApproval
    .getByRole("button", { name: "Approve exact request" })
    .click();
  await expect(
    artifactApproval.getByText("approved", { exact: true }),
  ).toBeVisible();
  await artifactApproval
    .getByRole("button", { name: "Mark reviewed and seal" })
    .click();
  await expect(draft).toContainText("reviewed · sealed");
  await expect(
    artifactApproval.getByText("consumed", { exact: true }),
  ).toBeVisible();
  await expect(artifactApproval).toContainText(
    "Seal draft_cover_letter artifact",
  );
  await page.screenshot({
    path: join(productEvidenceRoot, "reviewed-draft-provenance.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Pipeline" }).click();
  await application.getByLabel("Record next state").selectOption("applied");
  await application
    .getByRole("button", { name: "Record as applied — does not submit" })
    .click();
  await expect(application).toContainText("applied");
  await application
    .getByRole("button", { name: "Authorize responded for the DSH Agent" })
    .click();
  const transitionApproval = application.getByLabel(
    "application transition approval",
  );
  await expect(transitionApproval).toContainText("pending");
  await expect(transitionApproval).toContainText("to responded");
  await transitionApproval
    .getByRole("button", { name: "Approve exact request" })
    .click();
  await expect(transitionApproval).toContainText("approved");
  await expect(transitionApproval).toContainText(
    "Return to the originating DSH conversation",
  );
  await expect(
    application.getByRole("link", {
      name: "Review evidence and gaps while tracking a response",
    }),
  ).toHaveAttribute("href", "/evaluations");

  await page.getByRole("link", { name: "Opportunities" }).click();
  for (const [organization, roleTitle] of [
    ["Synthetic Systems", "Developer Experience Engineer"],
    ["Synthetic Tools", "Staff TypeScript Engineer"],
  ] as const) {
    await page.getByLabel("Organization").fill(organization);
    await page.getByLabel("Role title").fill(roleTitle);
    await page
      .getByLabel("Posting text")
      .fill(`${organization} needs a ${roleTitle} with TypeScript experience.`);
    await page.getByRole("button", { name: "Capture opportunity" }).click();
    await expect(page.getByRole("heading", { name: roleTitle })).toBeVisible();
  }
  await page.getByRole("link", { name: "Evaluations" }).click();
  for (const roleTitle of [
    "Developer Experience Engineer",
    "Staff TypeScript Engineer",
  ]) {
    const optionValue = await page
      .getByLabel("Opportunity")
      .locator("option")
      .filter({ hasText: roleTitle })
      .getAttribute("value");
    if (optionValue === null) throw new Error(`Missing ${roleTitle} option.`);
    await page.getByLabel("Opportunity").selectOption(optionValue);
    await page.getByRole("button", { name: "Run local demonstration" }).click();
    await expect(
      page.locator(".evaluation-card").filter({ hasText: roleTitle }),
    ).toBeVisible();
  }

  const fixtureSnapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const rubric = fixtureSnapshot.rubrics[0];
  const evidenceIds = fixtureSnapshot.evidence
    .filter((item) => item.decision === "accepted")
    .slice(0, 2)
    .map((item) => item.id);
  if (rubric === undefined || evidenceIds.length === 0)
    throw new Error("Synthetic browser seed did not create accepted evidence.");
  let semanticCommand = 0;
  const semanticHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-e2e-semantic-${String(++semanticCommand).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  for (const [index, opportunity] of fixtureSnapshot.opportunities.entries()) {
    const operationResponse = await page.request.post("/api/v1/operations", {
      headers: semanticHeaders(),
      data: {
        kind: "evaluation",
        inputIdentity: opportunity.id,
        requestedCapabilities: ["evaluation.complete"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    });
    expect(operationResponse.ok()).toBe(true);
    const operation = await responseJson<OperationResponse>(operationResponse);
    const evaluationResponse = await page.request.post("/api/v1/evaluations", {
      headers: semanticHeaders(operation.id),
      data: {
        opportunityId: opportunity.id,
        rubricId: rubric.id,
        operationId: operation.id,
        dimensionInputs: [
          {
            dimensionKey: "skills",
            semanticScoreBasisPoints: 8_000 - index * 500,
            evidenceIds,
            disposition: null,
          },
          {
            dimensionKey: "preferences",
            semanticScoreBasisPoints: 6_000 + index * 500,
            evidenceIds,
            disposition: null,
          },
        ],
      },
    });
    expect(evaluationResponse.ok()).toBe(true);
  }
  const comparisonSnapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const evaluationIds = comparisonSnapshot.evaluations
    .filter((item) => {
      const operation = comparisonSnapshot.operations.find(
        (candidate) => candidate.id === item.operationId,
      );
      return item.state === "completed" && operation?.route === "ordinary_dsh";
    })
    .map((item) => item.id);
  expect(evaluationIds).toHaveLength(3);
  await page.getByRole("link", { name: "Compare" }).click();
  const comparisonEmpty = page.locator(".comparison-empty");
  await expect(
    comparisonEmpty.getByRole("heading", {
      name: "Prepare a three-opportunity comparison",
    }),
  ).toBeVisible();
  await expect(comparisonEmpty).toContainText("3 of 3 current evaluations");
  await expect(
    comparisonEmpty.getByRole("link", { name: "Review evaluations" }),
  ).toHaveAttribute("href", "/evaluations");
  await expect(comparisonEmpty.getByText("Exact next action")).toBeVisible();
  await expect(
    comparisonEmpty.getByRole("link", { name: "Open diagnostics" }).first(),
  ).toHaveAttribute("href", "/diagnostics");
  let comparisonCommand = 0;
  const comparisonHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-e2e-comparison-${String(++comparisonCommand).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  const comparisonOperationResponse = await page.request.post(
    "/api/v1/operations",
    {
      headers: comparisonHeaders(),
      data: {
        kind: "comparison",
        inputIdentity: comparisonSnapshot.opportunities[0]?.id,
        requestedCapabilities: ["rlm", "ipython", "comparison.propose"],
        route: "rlm",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    },
  );
  expect(comparisonOperationResponse.ok()).toBe(true);
  const comparisonOperation = await responseJson<OperationResponse>(
    comparisonOperationResponse,
  );
  const comparisonResponse = await page.request.post(
    `/api/v1/operations/${comparisonOperation.id}/comparisons`,
    {
      headers: comparisonHeaders(comparisonOperation.id),
      data: {
        evaluationIds,
        policyVersion: "1.0.0",
        scenarios: [
          {
            label: "Skills forward",
            weightsBasisPoints: { skills: 8000, preferences: 2000 },
          },
          {
            label: "Preferences forward",
            weightsBasisPoints: { skills: 2000, preferences: 8000 },
          },
        ],
        tradeoffs: [
          "Review how missing preference evidence affects the tie before deciding.",
        ],
      },
    },
  );
  expect(comparisonResponse.ok()).toBe(true);
  const comparison = await responseJson<OperationResponse>(comparisonResponse);
  const comparisonTerminal = await page.request.post(
    `/api/v1/operations/${comparisonOperation.id}/terminal`,
    {
      headers: comparisonHeaders(comparisonOperation.id),
      data: {
        expectedRevision: comparisonOperation.revision,
        state: "succeeded",
        category: "comparison_proposed",
        message: "Structured comparison persisted for explicit user review.",
        resultIds: [comparison.id],
        artifactIds: [],
      },
    },
  );
  expect(comparisonTerminal.ok()).toBe(true);
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(
    page.getByRole("heading", { name: "Opportunity comparisons" }),
  ).toBeVisible();
  await expect(page.getByText("operating-system authority")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Skills forward" }),
  ).toBeVisible();
  const comparisonApproval = page
    .locator(".comparison-card")
    .first()
    .getByLabel("comparison accept approval");
  await comparisonApproval
    .getByRole("button", { name: "Request approval to accept comparison" })
    .click();
  await expect(
    comparisonApproval.getByText("pending", { exact: true }),
  ).toBeVisible();
  await expect(comparisonApproval).toContainText("comparison.accept");
  await comparisonApproval
    .getByRole("button", { name: "Approve exact request" })
    .click();
  await expect(
    comparisonApproval.getByText("approved", { exact: true }),
  ).toBeVisible();
  await comparisonApproval
    .getByRole("button", { name: "Accept comparison" })
    .click();
  await expect(page.locator(".comparison-card").first()).toContainText(
    "accepted",
  );
  await expect(
    comparisonApproval.getByText("consumed", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(rlmEvidenceRoot, "comparison-accepted.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Import" }).click();
  await page
    .getByLabel("Career Ops directory")
    .fill(resolve("tests/fixtures/career-ops-v1.18"));
  await page.getByRole("button", { name: "Discover read-only" }).click();
  await expect(
    page.getByRole("heading", { name: "career-ops-v1.18" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Application mappings" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Globex");
  await expect(page.getByText("agent skills and prompts")).toBeVisible();
  const importMappings = page
    .getByRole("group", { name: "Career Ops mappings" })
    .getByRole("checkbox");
  expect(await importMappings.count()).toBeGreaterThan(1);
  await importMappings.last().uncheck();
  await page.getByRole("button", { name: "Confirm and import" }).click();
  await expect(
    page.getByText("already imported", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 manifests")).toBeVisible();
  const importedSnapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  expect(importedSnapshot.importManifests[0]?.mappings).toContainEqual(
    expect.objectContaining({ disposition: "skipped" }),
  );
  const importReceipt = page.locator(".import-receipt").first();
  await importReceipt.getByText(/Mapping receipt/u).click();
  await expect(
    importReceipt.getByText("skipped", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(importEvidenceRoot, "career-ops-imported.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Profile" }).click();
  const verified = page
    .locator(".fact-card")
    .filter({ hasText: "TypeScript services" });
  await verified
    .getByRole("button", {
      name: "Correct verified fact Avery Example built TypeScript services",
    })
    .click();
  await expect(verified).toContainText(
    "dependent evaluation or artifact records stale",
  );
  await verified.getByLabel("Corrected value").fill("JavaScript services");
  await verified
    .getByRole("button", {
      name: "Save correction for Avery Example built TypeScript services",
    })
    .click();
  await expect(
    page.locator(".fact-card").filter({ hasText: "JavaScript services" }),
  ).toContainText("verified");

  await page.getByRole("link", { name: "Evaluations" }).click();
  await expect(evaluation).toContainText("Stale:");
  await evaluation.getByRole("tab", { name: "Artifacts" }).click();
  await expect(evaluation).toContainText("stale");

  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page.locator(".comparison-card").first()).toContainText("stale");

  await page.getByRole("link", { name: "Drafts" }).click();
  await expect(draft).toContainText("stale");
  await expect(draft).toContainText("was superseded");

  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByLabel("Search term").fill("platform");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".search-results")).toContainText(
    "Platform Engineer",
  );
  const exportArtifacts = page
    .getByRole("group", { name: "Include artifact bytes" })
    .getByRole("checkbox");
  expect(await exportArtifacts.count()).toBeGreaterThan(0);
  await exportArtifacts.first().check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download with 1 artifact" }).click();
  const completedDownload = await download;
  expect(completedDownload.suggestedFilename()).toBe(
    "career-workbench-export.json",
  );
  const downloadPath = await completedDownload.path();
  const exported = JSON.parse(await readFile(downloadPath, "utf8")) as {
    readonly selectedArtifacts: readonly {
      readonly artifactId: string;
      readonly bytesBase64: string;
      readonly contentDigest: string;
    }[];
  };
  expect(exported.selectedArtifacts).toHaveLength(1);
  expect(exported.selectedArtifacts[0]?.bytesBase64.length).toBeGreaterThan(0);
  expect(exported.selectedArtifacts[0]?.contentDigest).toMatch(
    /^[0-9a-f]{64}$/u,
  );

  const snapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const opportunity = snapshot.opportunities[0];
  if (opportunity === undefined)
    throw new Error("Expected captured opportunity.");
  const opportunityId = opportunity.id;
  let command = 0;
  const dshHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-e2e-dsh-${String(++command).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  const parentOperationResponse = await page.request.post(
    "/api/v1/operations",
    {
      headers: dshHeaders(),
      data: {
        kind: "evaluation",
        inputIdentity: opportunityId,
        requestedCapabilities: ["workspace.read"],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    },
  );
  expect(parentOperationResponse.ok()).toBe(true);
  const parentOperation = await responseJson<OperationResponse>(
    parentOperationResponse,
  );
  const childSession = "00000000-0000-4000-8000-000000000102";
  const childAdmissionResponse = await page.request.post("/api/v1/operations", {
    headers: dshHeaders(),
    data: {
      kind: "native_child",
      inputIdentity: opportunityId,
      requestedCapabilities: ["dsh.subagents.startContinuable"],
      route: "native_child",
      dshSessionId: childSession,
      parentOperationId: parentOperation.id,
      provider: "openai-codex",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      admissionOnly: true,
    },
  });
  expect(childAdmissionResponse.ok()).toBe(true);
  const childOperation = await responseJson<OperationResponse>(
    childAdmissionResponse,
  );
  const childStartedResponse = await page.request.post(
    `/api/v1/operations/${childOperation.id}/activity`,
    {
      headers: dshHeaders(childOperation.id),
      data: {
        expectedRevision: childOperation.revision,
        phase: "started",
        messageId: "synthetic-e2e-inbox-message",
      },
    },
  );
  expect(childStartedResponse.ok()).toBe(true);
  const childStarted =
    await responseJson<OperationResponse>(childStartedResponse);
  const childTerminalResponse = await page.request.post(
    `/api/v1/operations/${childOperation.id}/terminal`,
    {
      headers: dshHeaders(childOperation.id),
      data: {
        expectedRevision: childStarted.revision,
        state: "succeeded",
        category: "completed",
        message:
          "Synthetic native child completed through the authoritative backend.",
        resultIds: [],
        artifactIds: [],
      },
    },
  );
  expect(childTerminalResponse.ok()).toBe(true);

  await page.getByRole("link", { name: "Activity" }).click();
  await expect(page.getByText(/Latest sequence: [1-9]/u)).toBeVisible();
  await expect(page.locator(".timeline li").first()).toBeVisible();
  await expect(page.locator(".timeline li")).toHaveCount(10);
  await expect(page.locator(".timeline li").first().locator("p")).toContainText(
    "record",
  );
  expect(
    await page.locator(".timeline li").first().locator("strong").textContent(),
  ).not.toContain(".");
  await expect(
    page.getByText(/showing 10 of \d+ loaded events/u),
  ).toBeVisible();
  const newestSequence = Number(
    await page.locator(".timeline li > span").first().textContent(),
  );
  await page.getByRole("button", { name: "Older" }).click();
  await expect(page.getByText(/Page 2 of/u)).toBeVisible();
  const olderSequence = Number(
    await page.locator(".timeline li > span").first().textContent(),
  );
  expect(olderSequence).toBeLessThan(newestSequence);
  await page.getByLabel("Events per page").selectOption("25");
  await expect(page.getByText(/Page 1 of/u)).toBeVisible();
  expect(await page.locator(".timeline li").count()).toBeLessThanOrEqual(25);
  await page.getByLabel("Events per page").selectOption("10");
  await expect(page.locator(".timeline li")).toHaveCount(10);
  const childCard = page
    .locator(".operation-card")
    .filter({ hasText: childOperation.id });
  await expect(childCard).toContainText("native child");
  await expect(childCard).toContainText("succeeded");
  await expect(childCard).toContainText("admitted → started → terminal");
  await childCard
    .getByLabel("Request a follow-up from the originating DSH Agent")
    .fill("Re-check the synthetic role title only.");
  await childCard.getByRole("button", { name: "Queue request" }).click();
  await expect(childCard).toContainText(
    "1 recorded request; only the exact live parent Agent can deliver",
  );
  const parentCard = page
    .locator(".operation-card")
    .filter({ hasText: parentOperation.id })
    .first();
  await parentCard
    .getByRole("button", { name: "Request cancellation" })
    .click();
  await expect(parentCard).toContainText(
    "Cancellation requested; waiting for DSH terminal settlement.",
  );
  await page.screenshot({
    path: join(childEvidenceRoot, "native-child-lineage.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByText(/Latest sequence: [1-9]/u)).toBeVisible();
  await page.screenshot({
    path: join(evidenceRoot, "activity-recovered.png"),
    fullPage: true,
  });
});

test("@a11y key routes have no serious axe violations and support keyboard navigation", async ({
  page,
}) => {
  await createWorkspaceIfNeeded(page);
  for (const route of [
    "overview",
    "profile",
    "discover",
    "opportunities",
    "evaluations",
    "comparisons",
    "pipeline",
    "drafts",
    "imports",
    "activity",
    "diagnostics",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(
        (item) => item.impact === "serious" || item.impact === "critical",
      ),
      `${route}: ${results.violations.map((item) => item.id).join(", ")}`,
    ).toEqual([]);
  }

  await page.goto("/overview");
  await expect(
    page.getByRole("heading", { name: "Make your next move with evidence." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("link", { name: "Profile" }).focus();
  await expect(page.getByRole("link", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Add your career history" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/overview");
  const mobilePrimary = page.getByRole("navigation", {
    name: "Mobile primary",
  });
  await expect(mobilePrimary).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByLabel("Current workbench: My Career Workbench"),
  ).toBeVisible();
  await expect(page.locator(".sidebar-foot")).toContainText("Activity");
  const more = mobilePrimary.getByRole("button", { name: "More" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  const moreDestinations = page.getByRole("navigation", {
    name: "More destinations",
  });
  await expect(moreDestinations).toBeVisible();
  await expect(moreDestinations.getByRole("link")).toHaveCount(7);
  await expect(
    moreDestinations.getByRole("link", { name: "Evaluations" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();
  await page.keyboard.press("Enter");
  await moreDestinations.getByRole("link", { name: "Drafts" }).click();
  await expect(
    page.getByRole("heading", { name: "Drafts and review" }),
  ).toBeVisible();
  await expect(more).toHaveAttribute("aria-current", "page");
});
