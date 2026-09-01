import { mkdir } from "node:fs/promises";
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
  readonly opportunities: readonly { readonly id: string }[];
  readonly evaluations: readonly {
    readonly id: string;
    readonly state: string;
  }[];
}

async function responseJson<Value>(response: APIResponse): Promise<Value> {
  const raw: unknown = await response.json();
  return raw as Value;
}

test.describe.configure({ mode: "serial" });

async function createWorkspaceIfNeeded(page: Page) {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Create local workspace" });
  if (await create.isVisible()) {
    await create.click();
    await expect(
      page.getByRole("heading", {
        name: "Good work starts with good evidence.",
      }),
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

  await page.evaluate(() => {
    localStorage.setItem(
      "career-workbench-authority",
      JSON.stringify({ verifiedFacts: 99, approvals: ["all"] }),
    );
  });
  await page.reload();
  await expect(
    page.getByText("Verified facts").locator("..").locator("strong"),
  ).toHaveText("0");

  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Capture source" }).click();
  await expect(page.locator("#fact-source option")).toHaveCount(2);
  await page.getByRole("button", { name: "Propose for verification" }).click();
  const proposed = page
    .locator(".fact-card")
    .filter({ hasText: "TypeScript services" });
  await expect(proposed).toContainText("proposed");
  await proposed.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(proposed).toContainText("verified");

  await page.getByRole("link", { name: "Opportunities" }).click();
  await page.getByRole("button", { name: "Capture opportunity" }).click();
  await expect(
    page.getByRole("heading", { name: "Platform Engineer" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Evaluations" }).click();
  await page.getByRole("button", { name: "Run evaluation" }).click();
  const evaluation = page
    .locator(".evaluation-card")
    .filter({ hasText: "Platform Engineer" });
  await expect(evaluation.locator(".score strong")).toHaveText("78");
  await evaluation.getByRole("tab", { name: "Evidence" }).click();
  await expect(
    evaluation.locator(".evidence-list li").filter({
      hasText: "Avery Example built TypeScript services",
    }),
  ).toBeVisible();
  await evaluation.getByRole("tab", { name: "Gaps" }).click();
  await expect(evaluation).toContainText("Preferences not established");
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
  await application.getByLabel("Record next state").selectOption("preparing");
  await application.getByRole("button", { name: "Record transition" }).click();
  await expect(application).toContainText("preparing");

  await page.getByRole("link", { name: "Drafts" }).click();
  await page.getByLabel("Artifact type").selectOption("draft_cover_letter");
  await page.getByRole("button", { name: "Generate staged draft" }).click();
  const draft = page
    .locator(".draft-card")
    .filter({ hasText: "draft cover letter" });
  await expect(draft).toContainText("staged");
  await draft
    .getByRole("button", { name: "Inspect content and provenance" })
    .click();
  await expect(draft).toContainText("[NON-FACTUAL STYLE]");
  await expect(draft).toContainText("accepted evidence");
  await draft.getByRole("button", { name: "Mark reviewed and seal" }).click();
  await expect(draft).toContainText("reviewed · sealed");
  await page.screenshot({
    path: join(productEvidenceRoot, "reviewed-draft-provenance.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Pipeline" }).click();
  await application
    .getByLabel("Record next state")
    .selectOption("ready_for_review");
  await application.getByRole("button", { name: "Record transition" }).click();
  await expect(application).toContainText("ready for review");

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
    await page.getByRole("button", { name: "Run evaluation" }).click();
    await expect(
      page.locator(".evaluation-card").filter({ hasText: roleTitle }),
    ).toBeVisible();
  }

  const comparisonSnapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const evaluationIds = comparisonSnapshot.evaluations
    .filter((item) => item.state === "completed")
    .map((item) => item.id);
  expect(evaluationIds).toHaveLength(3);
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
  await page.getByRole("button", { name: "Accept comparison" }).click();
  await expect(page.locator(".comparison-card").first()).toContainText(
    "accepted",
  );
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
  await page.getByRole("button", { name: "Confirm and import" }).click();
  await expect(
    page.getByText("already imported", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 manifests")).toBeVisible();
  await page.screenshot({
    path: join(importEvidenceRoot, "career-ops-imported.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Profile" }).click();
  const verified = page
    .locator(".fact-card")
    .filter({ hasText: "TypeScript services" });
  await verified.getByRole("button", { name: "Correct verified fact" }).click();
  await expect(verified).toContainText(
    "dependent evaluation or artifact records stale",
  );
  await verified.getByLabel("Corrected value").fill("JavaScript services");
  await verified.getByRole("button", { name: "Save correction" }).click();
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
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download workspace JSON" }).click();
  expect((await download).suggestedFilename()).toBe(
    "career-workbench-export.json",
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
  await page.getByRole("link", { name: "Profile" }).focus();
  await expect(page.getByRole("link", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Profile evidence" }),
  ).toBeVisible();
});
