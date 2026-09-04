import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

const evidenceRoot = join("docs", "qa", "generated", "milestone-2");
const childEvidenceRoot = join("docs", "qa", "generated", "milestone-4");
const rlmEvidenceRoot = join("docs", "qa", "generated", "milestone-5");
const importEvidenceRoot = join("docs", "qa", "generated", "milestone-6");
const productEvidenceRoot = join("docs", "qa", "generated", "milestone-7");
const moreEvidenceRoot = join("docs", "qa", "generated", "more-panel-selfplay");
const DSH_TOKEN = "synthetic-e2e-dsh-token-00000000000000000000";
const DSH_SESSION = "00000000-0000-4000-8000-000000000101";

interface OperationResponse {
  readonly id: string;
  readonly revision: number;
}

interface BrowserSnapshot {
  readonly sources: readonly {
    readonly id: string;
    readonly artifactId: string | null;
    readonly inlineText: string | null;
    readonly mediaType: string;
  }[];
  readonly profileFacts: readonly {
    readonly id: string;
    readonly revision: number;
    readonly status: string;
    readonly subject: string;
    readonly predicate: string;
    readonly value: string | number | boolean | null;
    readonly sourceLocators: readonly { readonly sourceId: string }[];
  }[];
  readonly searchProfiles: readonly {
    readonly id: string;
    readonly locations: readonly string[];
    readonly priorities: readonly string[];
    readonly exclusions: readonly string[];
  }[];
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
    readonly kind: string;
    readonly revision: number;
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

interface RoutedSnapshot extends Readonly<Record<string, unknown>> {
  readonly workspace: null | {
    readonly id: string;
    readonly displayName: string;
  };
}

async function responseJson<Value>(response: APIResponse): Promise<Value> {
  const raw: unknown = await response.json();
  return raw as Value;
}

function syntheticPdf(lines: readonly string[]): Buffer {
  const escapePdfText = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  const textCommands = lines
    .map(
      (line, index) =>
        `${index === 0 ? "" : "0 -18 Td "}(${escapePdfText(line)}) Tj`,
    )
    .join("\n");
  const stream = `BT /F1 11 Tf 72 720 Td\n${textCommands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${String(Buffer.byteLength(stream, "ascii"))} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body, "ascii"));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${String(objects.length + 1)}\n`;
  body += "0000000000 65535 f \n";
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

test.describe.configure({ mode: "serial" });

async function createWorkspaceIfNeeded(page: Page) {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Continue" });
  if (await create.isVisible()) {
    await expect(
      page.getByRole("heading", {
        name: "Turn your experience into your next move.",
      }),
    ).toBeVisible();
    await expect(page.locator(".welcome-promise")).toContainText(
      "nothing is sent or submitted automatically",
    );
    await expect(page.getByLabel("Workbench name")).toHaveCount(0);
    await expect(page.getByLabel("Roles you want next")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "What’s your name?", exact: true })
      .fill("Avery Example");
    await create.click();
    await expect(
      page.getByRole("heading", {
        name: "Make your next move with evidence, not guesswork.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Your workflow · Welcome, Avery", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Welcome, Avery Example", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Go to setup" }),
    ).toHaveAttribute("href", "/overview");
  }
}

async function completeCareerSetupIfNeeded(page: Page): Promise<void> {
  await page.goto("/overview");
  await page
    .getByRole("link", { name: "Career record" })
    .waitFor({ state: "visible", timeout: 2_000 })
    .catch(() => undefined);
  if ((await page.getByRole("link", { name: "Career record" }).count()) > 0)
    return;

  const browserSession = await responseJson<{ readonly csrfToken: string }>(
    await page.request.get("/api/v1/session"),
  );
  let command = 0;
  const browserHeaders = () => ({
    "content-type": "application/json",
    origin: "http://127.0.0.1:4173",
    "sec-fetch-site": "same-origin",
    "x-cw-csrf": browserSession.csrfToken,
    "x-idempotency-key": `synthetic-a11y-browser-${String(++command).padStart(4, "0")}`,
  });
  const dshHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-a11y-dsh-${String(++command).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  const careerText =
    "Avery Example worked as a software engineer building reliable systems.";
  const sourceResponse = await page.request.post("/api/v1/sources", {
    headers: browserHeaders(),
    data: {
      kind: "candidate",
      trustClass: "candidate_primary",
      mediaType: "text/plain",
      text: careerText,
      originalLocator: "synthetic://a11y-career-source",
    },
  });
  expect(sourceResponse.ok()).toBe(true);
  const source = await responseJson<{ readonly id: string }>(sourceResponse);
  const operationResponse = await page.request.post("/api/v1/operations", {
    headers: dshHeaders(),
    data: {
      kind: "profile_organization",
      inputIdentity: source.id,
      requestedCapabilities: ["candidate_source.read", "profile_fact.propose"],
      route: "ordinary_dsh",
      dshSessionId: DSH_SESSION,
      provider: "openai-codex",
      model: "gpt-5.6-sol",
      reasoningEffort: "low",
    },
  });
  expect(operationResponse.ok()).toBe(true);
  const operation = await responseJson<OperationResponse>(operationResponse);
  const factResponse = await page.request.post("/api/v1/profile-facts", {
    headers: dshHeaders(operation.id),
    data: {
      factType: "experience",
      subject: "Avery Example",
      predicate: "worked as",
      value: "a software engineer building reliable systems.",
      sourceLocators: [
        {
          sourceId: source.id,
          start: 0,
          end: careerText.length,
          quote: careerText,
        },
      ],
      proposedBy: "agent",
    },
  });
  expect(factResponse.ok()).toBe(true);
  const fact = await responseJson<{
    readonly id: string;
    readonly revision: number;
  }>(factResponse);
  const terminalResponse = await page.request.post(
    `/api/v1/operations/${operation.id}/terminal`,
    {
      headers: dshHeaders(operation.id),
      data: {
        expectedRevision: operation.revision,
        state: "succeeded",
        category: "completed",
        message: "Prepared a synthetic accessibility setup fact.",
        resultIds: [fact.id],
        artifactIds: [],
      },
    },
  );
  expect(terminalResponse.ok()).toBe(true);
  const confirmResponse = await page.request.post(
    `/api/v1/profile-facts/${fact.id}/confirm`,
    {
      headers: browserHeaders(),
      data: { expectedRevision: fact.revision, outcome: { kind: "confirm" } },
    },
  );
  expect(confirmResponse.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("link", { name: "Career record" })).toBeVisible();
}

async function openMoreDestination(page: Page, name: string): Promise<void> {
  const more = page.locator(".desktop-more-nav");
  if ((await more.getAttribute("open")) === null) {
    await more.locator("summary").click();
  }
  const menu = more.locator(":scope > .more-menu");
  await expect(page.locator(".sidebar")).toHaveCSS("z-index", "40");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("background-color", "rgb(18, 21, 18)");
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(menu).toHaveCSS("backdrop-filter", "none");
  await more.getByRole("link", { name, exact: true }).click();
}

async function openTaskDisclosure(page: Page, name: string): Promise<void> {
  const disclosure = page
    .locator("details.task-disclosure")
    .filter({ hasText: name })
    .first();
  await disclosure
    .waitFor({ state: "attached", timeout: 1_000 })
    .catch(() => undefined);
  if ((await disclosure.count()) === 0) return;
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.locator(":scope > summary").click();
  }
  await expect(disclosure).toHaveAttribute("open", "");
}

async function chooseEvaluationJob(
  page: Page,
  roleTitle: string,
  organization: string,
): Promise<void> {
  await page.getByRole("button", { name: /Change selected job/u }).click();
  const search = page.getByRole("searchbox", { name: "Search saved jobs" });
  await expect(search).toBeFocused();
  await search.fill(roleTitle);
  await page
    .getByRole("option")
    .filter({ hasText: roleTitle })
    .filter({ hasText: organization })
    .first()
    .click();
}

test("complete source-to-sealed-artifact flow survives correction and exposes activity", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mkdir(evidenceRoot, { recursive: true });
  await mkdir(childEvidenceRoot, { recursive: true });
  await mkdir(rlmEvidenceRoot, { recursive: true });
  await mkdir(importEvidenceRoot, { recursive: true });
  await mkdir(productEvidenceRoot, { recursive: true });
  await createWorkspaceIfNeeded(page);
  await expect(
    page.getByRole("heading", { name: "Add your résumé or career story" }),
  ).toBeVisible();
  await expect(page.getByText(/of 6 stages/u)).toHaveCount(0);
  await expect(page.getByText(/Your progress/u)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upload résumé" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Paste résumé" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Tell my story" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Tell my story" }).click();
  await expect(page.getByLabel("Tell us what you’ve done")).toBeVisible();
  await page.getByRole("button", { name: "Paste résumé" }).click();
  await expect(
    page.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Upload résumé" }).click();

  const syntheticCareerLines = [
    "Avery Example worked as Software Engineer at Synthetic Systems from 2021 to 2024.",
    "Avery Example built TypeScript services.",
    "Avery Example earned the Synthetic Cloud Practitioner certification.",
  ] as const;
  await page.getByLabel("Upload a résumé file").setInputFiles({
    name: "synthetic-resume.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPdf(syntheticCareerLines),
  });
  await expect(page.getByText(/synthetic-resume\.pdf/u)).toBeVisible();
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Let AI organize what you shared" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with AI" }),
  ).toBeEnabled();

  const finishInPageOrganization = Promise.withResolvers<undefined>();
  let requestedOrganizerSourceId = "";
  await page.route("**/api/v1/profile-organizations", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      readonly sourceId: string;
    };
    requestedOrganizerSourceId = requestBody.sourceId;
    await finishInPageOrganization.promise;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "v1",
        sourceId: requestBody.sourceId,
        sessionId: "synthetic-browser-profile-session",
        operationId: "operation_0000000001",
        state: "succeeded",
        proposedFactIds: [],
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      }),
    });
  });
  await page.getByRole("button", { name: "Continue with AI" }).click();
  await expect(
    page.getByRole("button", { name: "Organizing your résumé…" }),
  ).toBeDisabled();
  await expect(
    page.getByText("AI is organizing your source in this window."),
  ).toBeVisible();
  await expect(
    page.getByText(/send it to your connected DSH Agent/iu),
  ).toHaveCount(0);
  finishInPageOrganization.resolve(undefined);
  await expect(
    page.getByRole("button", { name: "Continue with AI" }),
  ).toBeEnabled();
  await page.unroute("**/api/v1/profile-organizations");

  const organizerSeed = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const careerSource = organizerSeed.sources.find(
    (source) =>
      source.mediaType === "application/pdf" && source.artifactId !== null,
  );
  if (careerSource === undefined)
    throw new Error(
      "Expected upload to seal the PDF and preserve extracted text.",
    );
  expect(requestedOrganizerSourceId).toBe(careerSource.id);
  const syntheticCareerSource = careerSource.inlineText;
  if (syntheticCareerSource === null)
    throw new Error("Expected the uploaded PDF to retain extracted text.");
  expect(syntheticCareerSource).toContain(syntheticCareerLines[0]);
  expect(syntheticCareerSource).toContain(syntheticCareerLines[1]);
  expect(syntheticCareerSource).toContain(syntheticCareerLines[2]);
  let organizerCommand = 0;
  const organizerHeaders = (operationId?: string) => ({
    authorization: `CW-DSH ${DSH_TOKEN}`,
    "content-type": "application/json",
    "x-cw-dsh-session": DSH_SESSION,
    "x-idempotency-key": `synthetic-e2e-organizer-${String(++organizerCommand).padStart(4, "0")}`,
    ...(operationId === undefined ? {} : { "x-cw-operation": operationId }),
  });
  const organizerOperationResponse = await page.request.post(
    "/api/v1/operations",
    {
      headers: organizerHeaders(),
      data: {
        kind: "profile_organization",
        inputIdentity: careerSource.id,
        requestedCapabilities: [
          "candidate_source.read",
          "profile_fact.propose",
        ],
        route: "ordinary_dsh",
        dshSessionId: DSH_SESSION,
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
      },
    },
  );
  expect(organizerOperationResponse.ok()).toBe(true);
  const organizerOperation = await responseJson<OperationResponse>(
    organizerOperationResponse,
  );
  const organizerFactIds: string[] = [];
  for (const proposedFact of [
    {
      factType: "experience",
      subject: "Avery Example",
      predicate: "worked as",
      value: "Software Engineer at Synthetic Systems from 2021 to 2024.",
      quote:
        "Avery Example worked as Software Engineer at Synthetic Systems from 2021 to 2024.",
    },
    {
      factType: "achievement",
      subject: "Avery Example",
      predicate: "built",
      value: "TypeScript services.",
      quote: "Avery Example built TypeScript services.",
    },
    {
      factType: "certification",
      subject: "Avery Example",
      predicate: "earned",
      value: "the Synthetic Cloud Practitioner certification.",
      quote:
        "Avery Example earned the Synthetic Cloud Practitioner certification.",
    },
  ] as const) {
    const start = syntheticCareerSource.indexOf(proposedFact.quote);
    const factResponse = await page.request.post("/api/v1/profile-facts", {
      headers: organizerHeaders(organizerOperation.id),
      data: {
        factType: proposedFact.factType,
        subject: proposedFact.subject,
        predicate: proposedFact.predicate,
        value: proposedFact.value,
        sourceLocators: [
          {
            sourceId: careerSource.id,
            start,
            end: start + proposedFact.quote.length,
            quote: proposedFact.quote,
          },
        ],
        proposedBy: "agent",
      },
    });
    expect(factResponse.ok()).toBe(true);
    organizerFactIds.push(
      (await responseJson<{ readonly id: string }>(factResponse)).id,
    );
  }
  const organizerTerminal = await page.request.post(
    `/api/v1/operations/${organizerOperation.id}/terminal`,
    {
      headers: organizerHeaders(organizerOperation.id),
      data: {
        expectedRevision: organizerOperation.revision,
        state: "succeeded",
        category: "completed",
        message: "Organized exact source-backed career claims for review.",
        resultIds: organizerFactIds,
        artifactIds: [],
      },
    },
  );
  expect(organizerTerminal.ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Check the AI summary" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Review the summary" }).click();
  const summaryReview = page.getByRole("region", {
    name: "Review your résumé",
  });
  await expect(
    page.getByRole("heading", { name: "How would you like to start?" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Manage them in Settings/u)).toHaveCount(0);
  await expect(summaryReview).toContainText(
    "Avery Example built TypeScript services.",
  );
  await expect(summaryReview.locator(".fact-card")).toHaveCount(3);
  await expect(summaryReview.getByRole("checkbox")).toHaveCount(3);
  await expect(summaryReview.getByRole("checkbox").first()).toBeChecked();
  await expect(
    summaryReview.getByRole("button", { name: /^Keep /u }),
  ).toHaveCount(0);
  await expect(
    summaryReview.getByRole("button", { name: /^Remove /u }),
  ).toHaveCount(0);
  await expect(
    summaryReview.getByText("Source", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    summaryReview.getByLabel(
      "Source details for Avery Example built TypeScript services.",
    ),
  ).toBeHidden();
  await summaryReview.screenshot({
    path: join(evidenceRoot, "profile-claim-review.png"),
  });
  await summaryReview
    .getByRole("button", {
      name: "Continue",
    })
    .click();
  await expect(summaryReview).toHaveCount(0);
  await expect(page).toHaveURL(/\/overview$/u);
  await expect(
    page.getByRole("heading", {
      name: "What kind of role should we look for?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary", exact: true }),
  ).toBeVisible();
  const roleCombobox = page.getByRole("combobox", { name: "Role" });
  await roleCombobox.focus();
  await expect(
    page.getByRole("listbox", { name: "Suggested roles" }),
  ).toBeVisible();
  await roleCombobox.fill("soft");
  await expect(
    page.getByRole("option", { name: /Software Engineer/u }),
  ).toBeVisible();
  await roleCombobox.press("Enter");
  await expect(roleCombobox).toHaveValue("Software Engineer");
  await expect(
    page.getByRole("button", { name: "Use this role" }),
  ).toBeEnabled();

  await page.evaluate(() => {
    localStorage.setItem(
      "career-workbench-authority",
      JSON.stringify({ verifiedFacts: 99, approvals: ["all"] }),
    );
  });
  await page.reload();
  const persistedSummary = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  expect(
    persistedSummary.profileFacts.filter((fact) => fact.status === "verified")
      .length,
  ).toBeGreaterThanOrEqual(3);

  await page.getByRole("link", { name: "Career record" }).click();
  await expect(page.locator(".page-header")).toContainText(
    "Review the experience Workbench can use",
  );
  await openTaskDisclosure(page, "Add more career history");
  await expect(
    page.getByRole("link", {
      name: "Manage identity and search preferences.",
    }),
  ).toHaveAttribute("href", "/settings");
  await expect(
    page.getByText("1 career source", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Saved candidate source").locator("option"),
  ).toHaveCount(2);
  await openMoreDestination(page, "Preferences");
  await expect(
    page.getByRole("heading", { name: "Identity and search preferences" }),
  ).toBeVisible();
  const identitySettings = page.getByRole("region", { name: "Identity" });
  await expect(identitySettings).toContainText("Name");
  await expect(identitySettings).toContainText("Avery Example");
  await expect(identitySettings).not.toContainText("Candidate is");
  await expect(identitySettings).not.toContainText("verified");
  await expect(identitySettings).not.toContainText("Check source");
  await page.setViewportSize({ width: 880, height: 900 });
  await identitySettings.getByRole("button", { name: "Edit name" }).click();
  const nameInput = identitySettings.getByRole("textbox", { name: "Name" });
  const nameInputBox = await nameInput.boundingBox();
  expect(nameInputBox?.width ?? 0).toBeGreaterThan(300);
  await page.screenshot({
    path: join(evidenceRoot, "profile-settings-narrow-editor.png"),
    fullPage: true,
  });
  await identitySettings.getByRole("button", { name: "Cancel" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  const searchPreferences = page.getByRole("region", {
    name: "Search preferences",
  });
  await expect(searchPreferences).toContainText("Add your search direction");
  await expect(searchPreferences).toContainText(
    "Enter a target role before saving",
  );
  await expect(
    searchPreferences.getByRole("button", {
      name: "Save search preferences",
    }),
  ).toHaveAttribute("aria-describedby", "settings-target-role-help");
  await page.screenshot({
    path: join(evidenceRoot, "profile-settings.png"),
    fullPage: true,
  });
  await searchPreferences
    .getByRole("textbox", { name: "Target role", exact: true })
    .fill("Senior Software Engineer focused on AI platforms");
  await searchPreferences
    .getByRole("textbox", { name: /Priorities/u })
    .fill("Hands-on AI systems and strong engineering culture");
  await searchPreferences
    .getByRole("textbox", { name: /Location or work style/u })
    .fill("Remote in the United States");
  await searchPreferences
    .getByRole("button", { name: "Save search preferences" })
    .click();
  await expect(searchPreferences).toContainText("Search preferences saved.");
  await expect(searchPreferences).toContainText(
    "Senior Software Engineer focused on AI platforms",
  );
  await expect(searchPreferences).toContainText(
    "Hands-on AI systems and strong engineering culture",
  );
  await expect(searchPreferences).not.toContainText("verified");
  await expect(searchPreferences).not.toContainText("Check source");
  await expect(
    searchPreferences.getByRole("link", {
      name: "Open active job-search criteria",
    }),
  ).toHaveAttribute("href", "/discover");
  await page.getByRole("link", { name: "Career record" }).click();
  await openTaskDisclosure(page, "Add more career history");
  await page.getByRole("tab", { name: "Add a role manually" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Avery Example");
  await page.getByLabel("Your name").fill("Avery Example");
  await page.getByLabel("Role title").fill("Software Engineer");
  await page.getByLabel("Organization").fill("Synthetic Systems");
  await page.getByLabel("Dates").fill("2021 to 2024");
  await page
    .getByRole("textbox", { name: "Achievements optional" })
    .fill("mentored synthetic developers");
  await page.getByRole("button", { name: "Add role for review" }).click();
  await expect(page.getByText("Role added.")).toBeVisible();
  const manualRoleSnapshot = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const manualRoleSourceId = manualRoleSnapshot.profileFacts
    .find((fact) =>
      `${fact.subject} ${fact.predicate} ${String(fact.value)}`.includes(
        "mentored synthetic developers",
      ),
    )
    ?.sourceLocators.at(0)?.sourceId;
  if (manualRoleSourceId === undefined)
    throw new Error("Expected the manual role fact to retain its source ID.");
  const proposed = page
    .locator(".fact-card")
    .filter({ hasText: "mentored synthetic developers" });
  await expect(proposed).toContainText("suggested");
  await proposed.getByText("Check source", { exact: true }).click();
  const factSource = proposed.getByLabel(
    "Source details for Avery Example mentored synthetic developers",
  );
  await expect(factSource).toContainText(
    "Avery Example mentored synthetic developers",
  );
  await expect(factSource).toContainText("Career source · captured");
  await expect(factSource).toContainText(`ID ${manualRoleSourceId}`);
  await expect(factSource).toContainText("fingerprint");
  await proposed
    .getByRole("button", {
      name: "Keep Avery Example mentored synthetic developers",
      exact: true,
    })
    .click();
  await expect(proposed).toContainText("saved");

  await page.getByRole("tab", { name: "Paste résumé or CV" }).click();
  await page
    .getByLabel("Résumé or CV text")
    .fill("Avery Example documented synthetic release notes");
  await page.getByRole("button", { name: "Save résumé text" }).click();
  await expect(page.getByText(/Résumé text saved locally/u)).toBeVisible();
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
      name: "Edit Avery Example documented synthetic release notes",
    })
    .click();
  await correctionCandidate
    .getByLabel("Updated value")
    .fill("reviewed synthetic release notes");
  await correctionCandidate
    .getByRole("button", {
      name: "Save correction for Avery Example documented synthetic release notes",
    })
    .click();
  await expect(correctionCandidate).toContainText("replaced");
  await expect(
    page.locator(".fact-card").filter({
      hasText: "Avery Example documented reviewed synthetic release notes",
    }),
  ).toContainText("saved");

  await page.getByRole("link", { name: "Find roles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Research roles worth considering." }),
  ).toBeVisible();
  await expect(page.getByLabel("Roles", { exact: true })).toHaveValue(
    "Senior Software Engineer focused on AI platforms",
  );
  const roleField = await page
    .locator(".discovery-field-control")
    .nth(0)
    .boundingBox();
  const locationField = await page
    .locator(".discovery-field-control")
    .nth(1)
    .boundingBox();
  expect(roleField?.height).toBe(locationField?.height);
  await page.getByLabel("Add a location").selectOption("Chicago, IL");
  await expect(
    page.getByRole("button", { name: "Remove location Chicago, IL" }),
  ).toBeVisible();
  await expect(page.getByLabel("Seniority")).toBeHidden();
  await page.getByText("More preferences", { exact: true }).click();
  await page.getByLabel("Seniority").selectOption("senior");
  await page
    .getByLabel("AI direction")
    .fill("Production AI platforms, evaluation, and agent infrastructure");
  await page.getByRole("button", { name: "Career growth" }).click();
  await page.getByRole("button", { name: "Commission-only roles" }).click();
  await page.getByRole("button", { name: "Mandatory relocation" }).click();
  await page.getByRole("button", { name: "Save search" }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", {
      name: "Research roles from this direction",
    }),
  ).toBeVisible();
  const startSearch = page.getByRole("button", {
    name: "Ask AI to research roles",
  });
  await expect(startSearch).toBeEnabled();
  await expect(startSearch).toBeFocused();
  const finishInPageDiscovery = Promise.withResolvers<undefined>();
  let requestedSearchProfileId = "";
  await page.route("**/api/v1/job-discoveries", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      readonly searchProfileId: string;
    };
    requestedSearchProfileId = requestBody.searchProfileId;
    await finishInPageDiscovery.promise;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "v1",
        searchProfileId: requestBody.searchProfileId,
        sessionId: "synthetic-in-page-discovery",
        operationId: "operation_00000000000000000000000031",
        state: "succeeded",
        leadIds: [],
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningEffort: "low",
      }),
    });
  });
  await startSearch.click();
  await expect(
    page.getByRole("button", { name: "Researching roles…" }),
  ).toBeDisabled();
  finishInPageDiscovery.resolve(undefined);
  await expect(
    page.getByText(
      "No matching jobs found this time. Try broader roles or locations.",
    ),
  ).toBeVisible();
  await page.unroute("**/api/v1/job-discoveries");
  await page.getByText("More preferences", { exact: true }).click();

  const discoverySeed = await responseJson<BrowserSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  const searchProfile = discoverySeed.searchProfiles[0];
  if (searchProfile === undefined)
    throw new Error("Expected the browser to persist search criteria.");
  expect(requestedSearchProfileId).toBe(searchProfile.id);
  expect(searchProfile.locations).toContain("Chicago, IL");
  expect(searchProfile.priorities).toContain("Career growth");
  expect(searchProfile.exclusions).toEqual(
    expect.arrayContaining(["Commission-only roles", "Mandatory relocation"]),
  );
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
        whyFound: [
          `Current listing from Synthetic discovery feed ${String(index)}.${index === 9 ? ` ${"S".repeat(430)}` : ""}`,
          index === 9
            ? `The title and production AI scope match saved criteria. ${"X".repeat(430)}`
            : "The title and production AI scope match saved criteria.",
        ],
        matchedCriteria:
          index === 9
            ? ["Senior", "Remote", "AI platform", "Z".repeat(300)]
            : ["Senior", "Remote", "AI platform"],
        gaps: ["On-call expectations are not stated."],
        risks:
          index === 9
            ? ["Posting liveness needs review.", "Y".repeat(450)]
            : ["Posting liveness needs review."],
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
  await expect(page.getByText("9 new")).toBeVisible();
  await expect(
    page.getByText("On-call expectations are not stated.").first(),
  ).toBeVisible();
  const firstDiscoveryPage = page.locator(".discovery-card");
  await expect(firstDiscoveryPage).toHaveCount(5);
  expect(
    await firstDiscoveryPage.evaluateAll((cards) =>
      cards.every((card) => card.getBoundingClientRect().height <= 280),
    ),
  ).toBe(true);
  const leadNine = firstDiscoveryPage.filter({
    hasText: "Senior AI Platform Engineer 9",
  });
  const leadEight = firstDiscoveryPage.filter({
    hasText: "Senior AI Platform Engineer 8",
  });
  await expect(
    leadNine.getByText("Posting liveness needs review."),
  ).toBeHidden();
  await leadNine
    .getByRole("button", {
      name: "Review details for Senior AI Platform Engineer 9 at Synthetic AI Company 9",
    })
    .click();
  await expect(
    leadNine.getByText("Posting liveness needs review."),
  ).toBeVisible();
  await expect(leadNine).toContainText(
    "Current listing from Synthetic discovery feed 9.",
  );
  await expect(leadNine).toContainText("X".repeat(100));
  await expect(leadNine).toContainText("Y".repeat(100));
  await expect(leadNine).toContainText("Z".repeat(100));
  await expect(leadNine).toContainText("S".repeat(100));
  const expandedLayout = await page.evaluate(() => ({
    horizontalOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    overflowingElements: [...document.querySelectorAll<HTMLElement>("*")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .sort(
        (left, right) =>
          right.scrollWidth -
          right.clientWidth -
          (left.scrollWidth - left.clientWidth),
      )
      .slice(0, 8)
      .map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
      })),
  }));
  expect(
    expandedLayout.horizontalOverflow,
    JSON.stringify(expandedLayout.overflowingElements),
  ).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 375, height: 812 });
  const narrowDetails = await leadNine
    .locator(".lead-more-content")
    .evaluate((details) => ({
      clientHeight: details.clientHeight,
      scrollHeight: details.scrollHeight,
      viewportHeight: window.innerHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
  expect(narrowDetails.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(narrowDetails.clientHeight).toBeLessThanOrEqual(
    Math.ceil(narrowDetails.viewportHeight * 0.65) + 2,
  );
  expect(narrowDetails.scrollHeight).toBeGreaterThan(
    narrowDetails.clientHeight,
  );
  const sourceNote = leadNine.locator(".lead-source-note");
  await sourceNote.scrollIntoViewIfNeeded();
  await expect(sourceNote).toContainText("S".repeat(100));
  expect(
    await leadNine
      .locator(".lead-more-content")
      .evaluate((details) => details.scrollTop),
  ).toBeGreaterThan(0);
  await leadNine
    .locator(".lead-more-content")
    .evaluate((details) => details.scrollTo({ top: 0 }));
  await page.setViewportSize({ width: 320, height: 812 });
  const narrowestDetails = await leadNine
    .locator(".lead-more-content")
    .evaluate((details) => ({
      clientHeight: details.clientHeight,
      scrollHeight: details.scrollHeight,
      viewportHeight: window.innerHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
  expect(narrowestDetails.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(narrowestDetails.clientHeight).toBeLessThanOrEqual(
    Math.ceil(narrowestDetails.viewportHeight * 0.65) + 2,
  );
  expect(narrowestDetails.scrollHeight).toBeGreaterThan(
    narrowestDetails.clientHeight,
  );
  const mobileLeadActions = leadNine.locator(
    ".lead-actions > a, .lead-actions > button",
  );
  expect(
    await mobileLeadActions.evaluateAll((actions) =>
      actions.every((action) => action.getBoundingClientRect().height >= 40),
    ),
  ).toBe(true);
  const viewLeadNine = leadNine.getByRole("link", {
    name: "View Senior AI Platform Engineer 9 at Synthetic AI Company 9 (opens in a new tab)",
  });
  const saveLeadNine = leadNine.getByRole("button", {
    name: "Save Senior AI Platform Engineer 9 at Synthetic AI Company 9",
  });
  const passLeadNine = leadNine.getByRole("button", {
    name: "Pass on Senior AI Platform Engineer 9 at Synthetic AI Company 9",
  });
  const hideLeadNineDetails = leadNine.getByRole("button", {
    name: "Hide details for Senior AI Platform Engineer 9 at Synthetic AI Company 9",
  });
  await viewLeadNine.focus();
  await page.keyboard.press("Tab");
  await expect(saveLeadNine).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passLeadNine).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(hideLeadNineDetails).toBeFocused();
  await hideLeadNineDetails.click();
  const newDiscoveryTab = page.getByRole("tab", { name: "New · 9" });
  const savedDiscoveryTab = page.getByRole("tab", { name: "Saved · 0" });
  await newDiscoveryTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(savedDiscoveryTab).toBeFocused();
  await expect(savedDiscoveryTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(newDiscoveryTab).toBeFocused();
  const nextDiscoveryPage = page.getByRole("button", { name: "Next" });
  await nextDiscoveryPage.scrollIntoViewIfNeeded();
  expect(
    await nextDiscoveryPage.evaluate((nextButton) => {
      const footer = document.querySelector<HTMLElement>(".sidebar");
      if (footer === null) return false;
      return (
        nextButton.getBoundingClientRect().bottom <=
        footer.getBoundingClientRect().top + 1
      );
    }),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await leadEight
    .getByRole("button", {
      name: "Review details for Senior AI Platform Engineer 8 at Synthetic AI Company 8",
    })
    .click();
  await expect(
    leadNine.getByText("Posting liveness needs review."),
  ).toBeHidden();
  await expect(
    page.locator('.lead-more-toggle[aria-expanded="true"]'),
  ).toHaveCount(1);
  await leadEight
    .getByRole("button", {
      name: "Hide details for Senior AI Platform Engineer 8 at Synthetic AI Company 8",
    })
    .click();
  const compactSearch = page.getByRole("region", {
    name: "Job search setup",
  });
  await expect(compactSearch).toContainText(
    "Senior Software Engineer focused on AI platforms",
  );
  await expect(
    compactSearch.getByRole("button", { name: "Research again" }),
  ).toBeVisible();
  await expect(compactSearch.getByLabel("Roles", { exact: true })).toBeHidden();
  await compactSearch
    .getByRole("button", { name: "Edit search criteria" })
    .click();
  await expect(
    compactSearch.getByLabel("Roles", { exact: true }),
  ).toBeVisible();
  await compactSearch
    .getByRole("button", { name: "Finish editing search criteria" })
    .click();
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
    .getByRole("button", { name: "Pass" })
    .click();
  await expect(page.getByText("8 new")).toBeVisible();
  await page.getByRole("tab", { name: /Passed/u }).click();
  await expect(
    page.getByRole("heading", { name: "Senior AI Platform Engineer 9" }),
  ).toBeVisible();
  await page.screenshot({
    path: join(productEvidenceRoot, "discovery-inbox.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Move Senior AI Platform Engineer 9 at Synthetic AI Company 9 to New",
    })
    .click();
  await expect(page.getByText(/moved back to New/u)).toBeVisible();
  await expect(page.getByRole("tab", { name: /New · 9/u })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Research roles worth considering." }),
  ).toBeVisible();
  await compactSearch
    .getByRole("button", { name: "Edit search criteria" })
    .click();
  await expect(page.getByLabel("Roles", { exact: true })).toBeVisible();
  await page.screenshot({
    path: join(productEvidenceRoot, "discovery-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await openMoreDestination(page, "Saved jobs");
  await openTaskDisclosure(page, "Add another saved job");
  await page.getByLabel("Organization").fill("Synthetic Labs");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await expect(page.getByLabel("Posting URL")).toBeHidden();
  await page.getByText("Add posting details", { exact: true }).click();
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
  const capturedOpportunity = page.locator(".opportunity-card").filter({
    has: page.getByRole("heading", {
      name: "Platform Engineer",
      exact: true,
    }),
  });
  await expect(
    capturedOpportunity.getByRole("link", { name: "Evaluate this job" }),
  ).toHaveAttribute("href", /\/evaluations\?opportunity=/);
  await expect(
    capturedOpportunity.getByText("View saved posting"),
  ).toBeHidden();
  await capturedOpportunity
    .getByText("Review posting and signals", { exact: true })
    .click();
  await capturedOpportunity.getByText("View saved posting").click();
  await expect(
    capturedOpportunity.locator(".source-inspection pre"),
  ).toHaveText(
    "Synthetic Labs needs a Platform Engineer to build TypeScript services.",
  );

  await openMoreDestination(page, "Fit analysis");
  await chooseEvaluationJob(page, "Platform Engineer", "Synthetic Labs");
  await page
    .locator(".evaluation-toolbar")
    .getByRole("button", { name: /Check fit for Platform Engineer/u })
    .click();
  const evaluation = page.locator(".evaluation-summary-card");
  await expect(
    evaluation.locator(".evaluation-current-score strong"),
  ).toHaveText("78");
  await expect(evaluation).toContainText("not an application recommendation");
  await expect(
    evaluation.locator(".evaluation-primary-concern p"),
  ).not.toBeEmpty();
  await expect(
    evaluation.getByRole("button", { name: /Review full fit evidence/u }),
  ).toBeVisible();
  await page
    .locator(".evaluation-toolbar")
    .getByRole("button", { name: /Check fit again for Platform Engineer/u })
    .click();
  await expect(page.locator(".evaluation-summary-card")).toHaveCount(1);
  await expect(page.locator(".evaluation-history")).not.toHaveAttribute(
    "open",
    "",
  );
  await evaluation
    .getByRole("button", { name: /Review full fit evidence/u })
    .click();
  const evaluationDialog = page.getByRole("dialog");
  await evaluationDialog
    .getByRole("tab", { name: /Evidence details/u })
    .click();
  await expect(
    evaluationDialog.getByRole("heading", {
      name: /Accepted candidate facts/u,
    }),
  ).toBeVisible();
  await expect(
    evaluationDialog.getByText("Avery Example built TypeScript services.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    evaluationDialog.getByRole("heading", {
      name: /Additional accepted evidence/u,
    }),
  ).toBeVisible();
  await expect(evaluationDialog).toContainText("Synthetic Labs");
  await expect(evaluationDialog.getByText(/Details left out/u)).toHaveCount(0);
  await evaluationDialog.getByRole("tab", { name: /Findings for/u }).click();
  await expect(
    evaluationDialog.getByRole("heading", {
      name: "Authoritative critical findings",
    }),
  ).toBeVisible();
  await expect(evaluationDialog).toContainText(
    "Preference matching requires a live DSH semantic evaluation",
  );
  await expect(
    evaluationDialog.getByRole("heading", { name: /Contradictions/u }),
  ).toBeVisible();
  await expect(evaluationDialog).toContainText("No contradictions recorded.");
  await evaluationDialog.getByRole("tab", { name: /Artifacts for/u }).click();
  await evaluationDialog
    .getByRole("button", { name: /Seal immutable report/u })
    .click();
  await expect(evaluationDialog).toContainText("sealed");
  await page.screenshot({
    path: join(evidenceRoot, "evaluation-sealed.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(evaluationDialog).toHaveCount(0);

  await openMoreDestination(page, "Saved jobs");
  const firstOpportunity = page.locator(".opportunity-card").filter({
    has: page.getByRole("heading", {
      name: "Platform Engineer",
      exact: true,
    }),
  });
  await firstOpportunity
    .getByText("Review posting and signals", { exact: true })
    .click();
  await firstOpportunity.getByLabel("Posting liveness").selectOption("active");
  await firstOpportunity
    .getByLabel("Legitimacy signals")
    .selectOption("high_confidence");
  await firstOpportunity.getByRole("button", { name: "Save signals" }).click();
  await expect(firstOpportunity).toContainText("liveness active");
  await expect(firstOpportunity).toContainText("legitimacy high confidence");

  await openMoreDestination(page, "Application progress");
  await page
    .getByLabel("Saved job", { exact: true })
    .selectOption({ label: "Platform Engineer — Synthetic Labs" });
  await page.getByRole("button", { name: "Add to pipeline" }).click();
  const application = page.locator(".application-card").filter({
    has: page.getByRole("heading", {
      name: "Platform Engineer",
      exact: true,
    }),
  });
  const transitionApproval = application.getByLabel(
    "application transition approval",
  );
  await expect(
    application.getByText("Considering", { exact: true }),
  ).toBeVisible();
  await expect(
    application.getByRole("link", {
      name: "Prepare tailored materials",
    }),
  ).toHaveAttribute("href", "/drafts");
  await expect(transitionApproval).toBeVisible();
  await expect(application.getByLabel("New status")).toBeHidden();
  await application.getByText("Change status", { exact: true }).click();
  await application.getByLabel("New status").selectOption("preparing");
  await application.getByRole("button", { name: "Save status" }).click();
  await expect(
    application.getByText("Preparing", { exact: true }),
  ).toBeVisible();
  await expect(
    application.getByRole("link", {
      name: "Review and seal the current drafts",
    }),
  ).toHaveAttribute("href", "/drafts");
  await expect(application.getByLabel("New status")).toHaveValue(
    "ready_for_review",
  );
  await application.getByRole("button", { name: "Save status" }).click();
  await expect(
    application.getByText("Ready for review", { exact: true }),
  ).toBeVisible();

  await openMoreDestination(page, "Materials");
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
    "Inspect the current content before requesting approval.",
  );
  await draft.getByRole("button", { name: "Inspect draft" }).click();
  await expect(draft).toContainText("[NON-FACTUAL STYLE]");
  await draft.getByText("Review supporting records", { exact: true }).click();
  await expect(draft).toContainText("supporting references");
  await expect(requestArtifactApproval).toBeEnabled();
  await requestArtifactApproval.click();
  await expect(
    artifactApproval.getByText("pending", { exact: true }),
  ).toBeVisible();
  await expect(
    artifactApproval.getByText("Review and seal the candidate artifact", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(artifactApproval).toContainText("Bound revision");
  await expect(
    artifactApproval.getByText("Expires", { exact: true }),
  ).toBeVisible();
  const artifactTechnicalReceipt = artifactApproval.locator(
    "details.approval-technical",
  );
  await expect(artifactTechnicalReceipt.locator("code").first()).toBeHidden();
  await expect(artifactTechnicalReceipt.locator("code").last()).toBeHidden();
  await artifactTechnicalReceipt
    .getByText("Technical receipt", { exact: true })
    .click();
  await expect(
    artifactTechnicalReceipt.getByText("artifact.review", { exact: true }),
  ).toBeVisible();
  const artifactTargetId = await artifactTechnicalReceipt
    .locator("code")
    .first()
    .textContent();
  if (artifactTargetId === null) throw new Error("Missing artifact target ID.");
  await artifactTechnicalReceipt
    .getByText("Technical receipt", { exact: true })
    .click();
  await artifactApproval.getByRole("button", { name: "Deny request" }).click();
  await expect(
    artifactApproval.getByText("denied", { exact: true }),
  ).toBeVisible();
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
  await draft.getByRole("button", { name: "Inspect draft" }).click();
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
  await expect(
    artifactTechnicalReceipt.getByText(/Seal draft_cover_letter artifact/u),
  ).toBeHidden();
  await page.screenshot({
    path: join(productEvidenceRoot, "reviewed-draft-provenance.png"),
    fullPage: true,
  });

  await openMoreDestination(page, "Application progress");
  await application.getByText("Change status", { exact: true }).click();
  await application.getByLabel("New status").selectOption("applied");
  await application
    .getByRole("button", { name: "Save status as Applied" })
    .click();
  await expect(application.getByText("Applied", { exact: true })).toBeVisible();
  await application
    .getByRole("button", {
      name: /Review change to Responded for Platform Engineer at Synthetic Labs/u,
    })
    .click();
  await expect(transitionApproval).toContainText("pending");
  await expect(
    transitionApproval.getByText("Move application from applied to responded", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    transitionApproval.locator("details.approval-technical code").first(),
  ).toBeHidden();
  await expect(
    transitionApproval.locator("details.approval-technical code").last(),
  ).toBeHidden();
  await transitionApproval
    .getByRole("button", { name: "Approve status change" })
    .click();
  await expect(transitionApproval).toContainText("approved");
  await expect(transitionApproval).toContainText(
    "Return to the originating DSH conversation",
  );
  await expect(
    application.getByRole("link", {
      name: "Review the evaluation while tracking a response",
    }),
  ).toHaveAttribute("href", "/evaluations");

  await openMoreDestination(page, "Saved jobs");
  for (const [organization, roleTitle] of [
    ["Synthetic Systems", "Developer Experience Engineer"],
    ["Synthetic Tools", "Staff TypeScript Engineer"],
  ] as const) {
    await openTaskDisclosure(page, "Add another saved job");
    await page.getByLabel("Organization").fill(organization);
    await page.getByLabel("Role title").fill(roleTitle);
    await page
      .getByLabel("Posting text")
      .fill(`${organization} needs a ${roleTitle} with TypeScript experience.`);
    await page.getByRole("button", { name: "Capture opportunity" }).click();
    await expect(page.getByRole("heading", { name: roleTitle })).toBeVisible();
  }
  await openMoreDestination(page, "Fit analysis");
  for (const [organization, roleTitle] of [
    ["Synthetic Systems", "Developer Experience Engineer"],
    ["Synthetic Tools", "Staff TypeScript Engineer"],
  ] as const) {
    await chooseEvaluationJob(page, roleTitle, organization);
    await page
      .locator(".evaluation-toolbar")
      .getByRole("button", {
        name: new RegExp(`Check fit for ${roleTitle}`, "u"),
      })
      .click();
    await expect(
      page.locator(".evaluation-summary-card").filter({ hasText: roleTitle }),
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
  await openMoreDestination(page, "Compare roles");
  const comparisonEmpty = page.locator(".comparison-empty");
  await expect(
    comparisonEmpty.getByRole("heading", {
      name: "Before you compare",
    }),
  ).toBeVisible();
  await expect(comparisonEmpty).toContainText("3 of 3 agent-evaluated roles");
  await expect(
    comparisonEmpty.getByRole("link", { name: "Review evaluations" }),
  ).toHaveAttribute("href", "/evaluations");
  await expect(comparisonEmpty.getByText("Next action")).toBeVisible();
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
  await openMoreDestination(page, "Compare roles");
  await expect(
    page.getByRole("heading", { name: "Opportunity comparisons" }),
  ).toBeVisible();
  await expect(page.getByText("access to your computer")).toBeVisible();
  await expect(
    page.getByText(
      "Review how missing preference evidence affects the tie before deciding.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Skills forward" }),
  ).toBeHidden();
  await page
    .locator(".comparison-card")
    .first()
    .getByText("Review exact rankings", { exact: true })
    .click();
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
  await expect(
    comparisonApproval.getByText("Accept the proposed comparison", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    comparisonApproval.locator("details.approval-technical code").first(),
  ).toBeHidden();
  await expect(
    comparisonApproval.locator("details.approval-technical code").last(),
  ).toBeHidden();
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

  await openMoreDestination(page, "Import data");
  await page
    .getByLabel("Career Ops directory")
    .fill(resolve("tests/fixtures/career-ops-v1.18"));
  await page.getByRole("button", { name: "Discover read-only" }).click();
  await expect(
    page.getByRole("heading", { name: "career-ops-v1.18" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Application mappings" }),
  ).toBeHidden();
  await expect(page.getByText("agent skills and prompts")).toBeVisible();
  await page
    .getByText("Review application state mapping", { exact: true })
    .click();
  await page.getByText("Inspect selected source", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Application mappings" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Globex");
  const importMappings = page
    .getByRole("group", { name: "Career Ops mappings" })
    .getByRole("checkbox");
  expect(await importMappings.count()).toBeGreaterThan(1);
  await importMappings.last().uncheck();
  await page.getByRole("button", { name: "Import selected" }).click();
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
  const mappingReceipt = importReceipt.getByText(/Mapping receipt/u);
  await expect(importReceipt.locator(".receipt-fingerprint")).toBeHidden();
  await mappingReceipt.click();
  await expect(importReceipt.locator(".receipt-fingerprint")).toBeVisible();
  await expect(
    importReceipt.getByText("skipped", { exact: true }),
  ).toBeVisible();
  await mappingReceipt.click();
  await expect(importReceipt.locator(".receipt-fingerprint")).toBeHidden();
  await page
    .getByLabel("Career Ops directory")
    .fill("fixtures/career-ops-v1.18");
  await page.screenshot({
    path: join(importEvidenceRoot, "career-ops-imported.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Career record" }).click();
  const careerRecord = page
    .locator(".profile-record-details")
    .filter({ hasText: "Your career record" });
  if ((await careerRecord.getAttribute("open")) === null) {
    await careerRecord.locator(":scope > summary").click();
  }
  const compactGroups = await careerRecord
    .locator(".career-fact-group")
    .evaluateAll((groups) =>
      groups.map((group) => ({
        visibleRows: [
          ...group.querySelectorAll<HTMLElement>(
            ":scope > .career-fact-rows > .career-fact-row",
          ),
        ].filter((row) => row.checkVisibility()).length,
        visibleRowHeights: [
          ...group.querySelectorAll<HTMLElement>(
            ":scope > .career-fact-rows > .career-fact-row",
          ),
        ]
          .filter((row) => row.checkVisibility())
          .map((row) => Math.round(row.getBoundingClientRect().height)),
      })),
    );
  expect(compactGroups.length).toBeGreaterThan(0);
  expect(compactGroups.every((group) => group.visibleRows <= 3)).toBe(true);
  expect(
    compactGroups
      .flatMap((group) => group.visibleRowHeights)
      .every((height) => height <= 90),
  ).toBe(true);
  await expect(
    careerRecord.getByRole("heading", { name: "Other", exact: true }),
  ).toBeVisible();
  await expect(careerRecord).toContainText(
    "the Synthetic Cloud Practitioner certification.",
  );
  await expect(careerRecord.getByText("Edit", { exact: true })).toHaveCount(0);
  const verified = page
    .locator(".fact-card")
    .filter({ hasText: "TypeScript services" });
  const containingOverflow = careerRecord
    .locator("details.career-fact-overflow")
    .filter({ has: verified });
  if ((await containingOverflow.count()) > 0 && !(await verified.isVisible())) {
    await containingOverflow.locator(":scope > summary").click();
  }
  const sourceDetails = verified.getByLabel(
    "Source details for Avery Example built TypeScript services",
  );
  const certification = careerRecord
    .locator(".career-fact-row")
    .filter({ hasText: "Synthetic Cloud Practitioner certification" });
  const certificationSourceDetails = certification.getByLabel(
    "Source details for Avery Example earned the Synthetic Cloud Practitioner certification",
  );
  await verified
    .getByRole("button", {
      name: "Check source for Avery Example built TypeScript services",
    })
    .click();
  await expect(sourceDetails).toBeVisible();
  await expect(sourceDetails).toContainText("Career source · captured");
  await expect(sourceDetails).toContainText(`ID ${careerSource.id}`);
  await expect(sourceDetails).toContainText("fingerprint");
  await certification
    .getByRole("button", {
      name: "Edit saved career detail Avery Example earned the Synthetic Cloud Practitioner certification",
    })
    .click();
  await expect(sourceDetails).toBeHidden();
  await expect(
    careerRecord.locator('button[aria-expanded="true"]'),
  ).toHaveCount(1);
  await verified
    .getByRole("button", {
      name: "Check source for Avery Example built TypeScript services",
    })
    .click();
  await expect(certification.getByLabel("Updated value")).toBeHidden();
  await certification
    .getByRole("button", {
      name: "Check source for Avery Example earned the Synthetic Cloud Practitioner certification",
    })
    .click();
  await expect(sourceDetails).toBeHidden();
  await expect(certificationSourceDetails).toBeVisible();
  await expect(
    careerRecord.locator('button[aria-expanded="true"]'),
  ).toHaveCount(1);
  await verified
    .getByRole("button", {
      name: "Edit saved career detail Avery Example built TypeScript services",
    })
    .click();
  await expect(certificationSourceDetails).toBeHidden();
  await expect(verified).toContainText(
    "dependent items will be marked out of date",
  );
  const longCorrection = `JavaScript services. ${"Reliable platform work across teams and systems. ".repeat(24)}${"X".repeat(700)}`;
  await verified.getByLabel("Updated value").fill(longCorrection);
  await verified
    .getByRole("button", {
      name: "Save correction for Avery Example built TypeScript services",
    })
    .click();
  await expect(
    page.locator(".fact-card").filter({ hasText: "JavaScript services" }),
  ).toContainText("saved");
  const correctedLongFact = careerRecord
    .locator(".career-fact-row")
    .filter({ hasText: "JavaScript services" });
  await expect(
    correctedLongFact.getByRole("button", { name: "Show full detail" }),
  ).toBeVisible();
  expect(
    await correctedLongFact.evaluate((row) =>
      Math.round(row.getBoundingClientRect().height),
    ),
  ).toBeLessThanOrEqual(90);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await correctedLongFact
    .getByRole("button", { name: "Show full detail" })
    .click();
  await expect(
    correctedLongFact.getByRole("button", { name: "Show less" }),
  ).toBeVisible();
  await expect(correctedLongFact).toContainText("X".repeat(100));
  await correctedLongFact.getByRole("button", { name: "Show less" }).click();
  expect(
    await correctedLongFact.evaluate((row) =>
      Math.round(row.getBoundingClientRect().height),
    ),
  ).toBeLessThanOrEqual(90);

  await openMoreDestination(page, "Fit analysis");
  await chooseEvaluationJob(page, "Platform Engineer", "Synthetic Labs");
  await expect(page.locator(".evaluation-summary-card")).toHaveAttribute(
    "data-evaluation-state",
    "stale",
  );
  const evaluationHistory = page.locator(".evaluation-history");
  await evaluationHistory.locator(":scope > summary").click();
  const staleLocalEvaluation = evaluationHistory
    .locator(".evaluation-history-list > li")
    .filter({ hasText: "Stale" })
    .first();
  await expect(staleLocalEvaluation).toContainText("Stale");
  await staleLocalEvaluation.getByRole("button").click();
  const staleEvaluationDialog = page.getByRole("dialog");
  await staleEvaluationDialog
    .getByRole("tab", { name: /Artifacts for/u })
    .click();
  await expect(staleEvaluationDialog).toContainText("stale");
  await page.keyboard.press("Escape");

  await openMoreDestination(page, "Compare roles");
  await expect(page.locator(".comparison-card").first()).toContainText("stale");

  await openMoreDestination(page, "Materials");
  await expect(draft).toContainText("stale");
  await expect(draft).toContainText("was superseded");

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByText("Search or export your records", { exact: true })
    .click();
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

  for (let index = 1; index <= 6; index += 1) {
    const completedRootResponse = await page.request.post(
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
    expect(completedRootResponse.ok()).toBe(true);
    const completedRoot = await responseJson<OperationResponse>(
      completedRootResponse,
    );
    const completedRootTerminal = await page.request.post(
      `/api/v1/operations/${completedRoot.id}/terminal`,
      {
        headers: dshHeaders(completedRoot.id),
        data: {
          expectedRevision: completedRoot.revision,
          state: "succeeded",
          category: "completed",
          message: `Synthetic completed root ${String(index)}.`,
          resultIds: [],
          artifactIds: [],
        },
      },
    );
    expect(completedRootTerminal.ok()).toBe(true);
  }

  await openMoreDestination(page, "Agent activity");
  await expect(page.getByText(/Activity is connected/u)).toBeVisible();
  await page.getByText("View audit history", { exact: true }).click();
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
  await page.getByRole("button", { name: "Older", exact: true }).click();
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
  await expect(
    page.getByText(/active operation (?:branch|branches) shown first/u),
  ).toBeVisible();
  const parentCard = page
    .locator(".operation-card")
    .filter({ hasText: parentOperation.id })
    .first();
  await expect(parentCard).toBeVisible();
  await expect(
    parentCard.getByRole("button", { name: "Request cancellation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show 3 older completed" }),
  ).toBeVisible();
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
  await expect(page.getByText(/Activity is connected/u)).toBeVisible();
  await page.screenshot({
    path: join(evidenceRoot, "activity-recovered.png"),
    fullPage: true,
  });

  await page.goto("/discover");
  await page
    .locator(".discovery-card")
    .filter({ hasText: "Senior AI Platform Engineer 9" })
    .getByRole("button", { name: "Save" })
    .click();
  const evaluationHandoff = page.getByRole("region", {
    name: "Evaluate 1 saved job",
  });
  await expect(evaluationHandoff).toBeVisible();
  await evaluationHandoff.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/evaluations\?opportunity=/u);
  await expect(page.locator(".evaluation-job-identity")).toContainText(
    "Senior AI Platform Engineer 9",
  );
  await expect(page.locator(".evaluation-job-identity")).toContainText(
    "Synthetic AI Company 9",
  );
});

test("dark refresh keeps every canonical route readable and resilient", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await mkdir(evidenceRoot, { recursive: true });
  await createWorkspaceIfNeeded(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/overview");
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "--cw-canvas",
        "--cw-sidebar",
        "--cw-surface-1",
        "--cw-surface-2",
        "--cw-line",
        "--cw-text",
        "--cw-muted",
        "--cw-phosphor",
        "--cw-phosphor-ink",
        "--cw-signal",
        "--cw-warning",
        "--cw-danger",
        "--cw-focus",
      ].map((name) => [name, style.getPropertyValue(name).trim()]),
    );
  });
  expect(tokens).toEqual({
    "--cw-canvas": "#0b0d0c",
    "--cw-sidebar": "#080a09",
    "--cw-surface-1": "#121512",
    "--cw-surface-2": "#191d19",
    "--cw-line": "#343a34",
    "--cw-text": "#edf1e6",
    "--cw-muted": "#a9b0a3",
    "--cw-phosphor": "#c8f169",
    "--cw-phosphor-ink": "#11150b",
    "--cw-signal": "#9eb8ff",
    "--cw-warning": "#f3bd78",
    "--cw-danger": "#ff9b91",
    "--cw-focus": "#ffe082",
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(11, 13, 12)",
  );
  await expect(page.locator(".workspace-identity")).toContainText(
    "Local records · private",
  );
  await expect(
    page.getByRole("link", { name: "Go to overview" }),
  ).toHaveAttribute("href", "/overview");
  await page.goto("/settings");
  await page.getByRole("link", { name: "Go to overview" }).click();
  await expect(page).toHaveURL(/\/overview$/u);
  await expect(page.locator(".focus-card .primary")).toHaveCount(1);
  await expect(page.getByText(/Your progress/u)).toHaveCount(0);
  await expect(page.locator(".workflow-grid")).toHaveCount(0);
  await page.screenshot({
    path: join(evidenceRoot, "dark-home.png"),
    fullPage: true,
  });

  await page.goto("/overview");
  await expect(
    page.getByRole("heading", {
      name: "Make your next move with evidence, not guesswork.",
    }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const focusTarget = page.locator(":focus");
  await expect(focusTarget).toHaveCount(1);
  const focusStyle = await focusTarget.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focusStyle.style).toBe("solid");
  expect(focusStyle.width).toBe("3px");
  expect(focusStyle.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(focusStyle.color).not.toBe("rgb(11, 13, 12)");

  const screenshotRoutes = [
    ["profile", "dark-career-intake.png"],
    ["settings", "dark-settings.png"],
    ["discover", "dark-jobs.png"],
    ["activity", "dark-activity.png"],
    ["diagnostics", "dark-diagnostics.png"],
  ] as const;
  for (const [route, filename] of screenshotRoutes) {
    await page.goto(`/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    await page.screenshot({
      path: join(evidenceRoot, filename),
      fullPage: true,
    });
  }

  const widths = [320, 375, 768, 1024, 1440] as const;
  const routes = [
    "overview",
    "profile",
    "settings",
    "discover",
    "activity",
    "diagnostics",
  ] as const;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`/${route}`);
      await expect(page.locator("h1")).toBeVisible();
      const layout = await page.evaluate(() => {
        const controls = [
          ...document.querySelectorAll<HTMLElement>(
            'main input:not([type="checkbox"]):not([type="radio"]), main textarea',
          ),
        ].filter((element) => {
          const box = element.getBoundingClientRect();
          return element.checkVisibility() && box.width > 0 && box.height > 0;
        });
        return {
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          narrowestControl:
            controls.length === 0
              ? null
              : Math.min(
                  ...controls.map((element) =>
                    Math.round(element.getBoundingClientRect().width),
                  ),
                ),
        };
      });
      expect(
        layout.overflow,
        `${route} at ${String(width)}px`,
      ).toBeLessThanOrEqual(0);
      if (layout.narrowestControl !== null) {
        expect(
          layout.narrowestControl,
          `${route} input width at ${String(width)}px`,
        ).toBeGreaterThanOrEqual(280);
      }
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/overview");
  await page.screenshot({
    path: join(evidenceRoot, "dark-home-375.png"),
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page
    .locator("button")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationLimited: style.animationDuration
          .split(",")
          .every((value) => Number.parseFloat(value) <= 0.00001),
        transitionLimited: style.transitionDuration
          .split(",")
          .every((value) => Number.parseFloat(value) <= 0.00001),
      };
    });
  expect(reducedMotion.animationLimited).toBe(true);
  expect(reducedMotion.transitionLimited).toBe(true);

  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "no-preference",
  });
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
  ).toBe(true);
  await expect(page.locator(".focus-card")).toHaveCSS(
    "border-left-style",
    "solid",
  );
  await expect(page.locator(".focus-card .primary")).toHaveCSS(
    "border-top-style",
    "solid",
  );
  await page.emulateMedia({ forcedColors: "none" });
});

test("activity reconnection replaces a stale browser snapshot", async ({
  page,
}) => {
  const liveSnapshot = await responseJson<RoutedSnapshot>(
    await page.request.get("/api/v1/snapshot"),
  );
  if (liveSnapshot.workspace === null)
    throw new Error("Expected the synthetic browser workspace to exist.");

  const canonicalName = liveSnapshot.workspace.displayName;
  let snapshotRequests = 0;
  await page.route("**/api/v1/snapshot", async (route) => {
    snapshotRequests += 1;
    if (snapshotRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...liveSnapshot,
          workspace: {
            ...liveSnapshot.workspace,
            displayName: "Stale browser copy",
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/overview");
  await expect(
    page.getByLabel(`Current workbench: ${canonicalName}`),
  ).toBeVisible();
  expect(snapshotRequests).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Activity connected")).toBeVisible();
});

test("More panel makes the career order and support boundary explicit", async ({
  page,
}) => {
  await mkdir(moreEvidenceRoot, { recursive: true });
  await createWorkspaceIfNeeded(page);
  await completeCareerSetupIfNeeded(page);

  const expectedJourney = [
    "Career record",
    "Find roles",
    "Saved jobs",
    "Fit analysis",
    "Compare roles",
    "Application progress",
    "Materials",
  ];
  const expectedSupport = [
    "Import data",
    "Agent activity",
    "Preferences",
    "System status",
  ];
  const expectPanelModel = async (panel: ReturnType<Page["locator"]>) => {
    await expect(
      panel.getByRole("heading", { name: "Career path" }),
    ).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Career journey" }),
    ).toHaveClass(/sr-only/);
    for (const [index, label] of [
      "Career evidence",
      "Find roles",
      "Evaluate and compare",
      "Track progress",
      "Prepare materials",
    ].entries()) {
      await expect(
        panel.getByRole("heading", {
          name: `Stage ${String(index + 1)} of 5: ${label}`,
        }),
      ).toHaveClass(/sr-only/);
    }
    await expect(
      panel.getByRole("heading", { name: "Workspace support" }),
    ).toBeVisible();
    await expect(panel.getByText("Five stages", { exact: true })).toHaveCount(
      0,
    );
    await expect(panel.getByText("Work top to bottom.")).toHaveCount(0);
    await expect(panel.getByText("Use when needed.")).toHaveCount(0);
    await expect(
      panel.getByText("See your fit, main concern, and next action"),
    ).toHaveClass(/sr-only/);
    expect(
      await panel
        .locator(".more-journey-group a")
        .evaluateAll((links) => links.map((link) => link.ariaLabel)),
    ).toEqual(expectedJourney);
    expect(
      await panel
        .locator(".more-support-grid a")
        .evaluateAll((links) => links.map((link) => link.ariaLabel)),
    ).toEqual(expectedSupport);
    expect(
      await panel.locator("a").evaluateAll((links) =>
        links.every((link) => {
          const bounds = link.getBoundingClientRect();
          return bounds.width >= 40 && bounds.height >= 40;
        }),
      ),
    ).toBe(true);
  };

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/discover");
  const desktopMore = page.locator(".desktop-more-nav");
  const desktopTrigger = desktopMore.locator(":scope > summary");
  await desktopTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(desktopMore).toHaveAttribute("open", "");
  await expect(desktopTrigger).toHaveCSS("color", "rgb(200, 241, 105)");
  await expect(desktopTrigger).toHaveCSS("background-color", "rgb(18, 21, 18)");
  const desktopPanel = desktopMore.locator(":scope > .more-menu");
  await expectPanelModel(desktopPanel);
  const desktopBounds = await desktopPanel.boundingBox();
  expect(desktopBounds).not.toBeNull();
  expect(desktopBounds?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (desktopBounds?.y ?? 0) + (desktopBounds?.height ?? 0),
  ).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: join(moreEvidenceRoot, "more-panel-1280x720.png"),
  });
  await page.keyboard.press("Escape");
  await expect(desktopTrigger).toBeFocused();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/discover");
  const tabletMore = page.locator(".desktop-more-nav");
  await tabletMore.locator(":scope > summary").click();
  const tabletPanel = tabletMore.locator(":scope > .more-menu");
  await expectPanelModel(tabletPanel);
  const tabletBounds = await tabletPanel.boundingBox();
  expect(tabletBounds).not.toBeNull();
  expect(tabletBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (tabletBounds?.x ?? 0) + (tabletBounds?.width ?? 0),
  ).toBeLessThanOrEqual(768);
  expect(
    (tabletBounds?.y ?? 0) + (tabletBounds?.height ?? 0),
  ).toBeLessThanOrEqual(1024);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: join(moreEvidenceRoot, "more-panel-768x1024.png"),
  });

  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/discover");
    const moreTrigger = page
      .getByRole("navigation", { name: "Mobile primary" })
      .getByRole("button", { name: "More" });
    await moreTrigger.focus();
    await page.keyboard.press("Enter");
    const mobilePanel = page.getByRole("dialog", {
      name: "Career path",
    });
    await expectPanelModel(mobilePanel);
    await expect(moreTrigger).toHaveCSS("color", "rgb(200, 241, 105)");
    await expect(moreTrigger).toHaveCSS("background-color", "rgb(18, 21, 18)");
    await expect(moreTrigger).toHaveAttribute("aria-haspopup", "dialog");
    await expect(mobilePanel).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#main-content")).toHaveAttribute("inert", "");
    await expect(page.locator(".mobile-primary-nav")).toHaveAttribute(
      "inert",
      "",
    );
    await expect(
      mobilePanel.getByText("See your fit, main concern, and next action"),
    ).toHaveClass(/sr-only/);
    if (width === 375) {
      const session = await page.context().newCDPSession(page);
      const { nodes } = await session.send("Accessibility.getFullAXTree");
      const exposedNodes = nodes.filter((node) => !node.ignored);
      expect(
        exposedNodes.some(
          (node) =>
            node.role?.value === "dialog" && node.name?.value === "Career path",
        ),
      ).toBe(true);
      expect(
        exposedNodes.some(
          (node) =>
            node.role?.value === "heading" &&
            node.name?.value === "Stage 1 of 5: Career evidence",
        ),
      ).toBe(true);
      const fitAnalysisNode = exposedNodes.find(
        (node) =>
          node.role?.value === "link" && node.name?.value === "Fit analysis",
      );
      expect(fitAnalysisNode?.description?.value).toBe(
        "See your fit, main concern, and next action",
      );
      expect(
        exposedNodes.some(
          (node) =>
            node.role?.value === "heading" &&
            node.name?.value === "Research roles worth considering.",
        ),
      ).toBe(false);
      await session.detach();
    }
    const panelBounds = await mobilePanel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(moreEvidenceRoot, `more-panel-${String(width)}x812.png`),
    });
    const lastLink = mobilePanel.getByRole("link", { name: "System status" });
    await lastLink.scrollIntoViewIfNeeded();
    const lastLinkBounds = await lastLink.boundingBox();
    expect(lastLinkBounds).not.toBeNull();
    expect(lastLinkBounds?.y ?? -1).toBeGreaterThanOrEqual(panelBounds?.y ?? 0);
    expect(
      (lastLinkBounds?.y ?? 0) + (lastLinkBounds?.height ?? 0),
    ).toBeLessThanOrEqual(
      (panelBounds?.y ?? 0) + (panelBounds?.height ?? 0) + 1,
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (item) => item.impact === "serious" || item.impact === "critical",
      ),
      results.violations.map((item) => item.id).join(", "),
    ).toEqual([]);
    await page.screenshot({
      path: join(
        moreEvidenceRoot,
        `more-panel-${String(width)}x812-support.png`,
      ),
    });
    await page.keyboard.press("Escape");
    await expect(moreTrigger).toBeFocused();
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/activity");
  const activityMoreTrigger = page.locator(".desktop-more-nav > summary");
  await expect(activityMoreTrigger).toHaveCSS("color", "rgb(200, 241, 105)");
  await activityMoreTrigger.click();
  const currentDestination = page.getByRole("link", {
    name: "Agent activity",
  });
  await expect(currentDestination).toHaveAttribute("aria-current", "page");
  await expect(currentDestination.locator(".more-current-label")).toBeVisible();
  await page.screenshot({
    path: join(moreEvidenceRoot, "more-panel-activity-1280x720.png"),
  });
});

test("@a11y key routes have no serious axe violations and support keyboard navigation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mkdir(evidenceRoot, { recursive: true });
  await createWorkspaceIfNeeded(page);
  await completeCareerSetupIfNeeded(page);
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
    "settings",
    "diagnostics",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    if (route === "overview") {
      await expect(
        page.getByRole("heading", {
          name: "One evidence trail. Five clearer decisions.",
        }),
      ).toBeVisible();
      await expect(page.locator(".product-journey li")).toHaveCount(5);
    } else if (route === "evaluations") {
      await expect(
        page.locator(".evaluation-summary-card, .evaluation-empty-state"),
      ).toBeVisible();
      await expect(page.locator("[data-next-action]")).toBeVisible();
      const workflow = page.getByRole("navigation", {
        name: "Career workflow",
      });
      await expect(workflow).toBeVisible();
      await expect(workflow.getByRole("link")).toHaveCount(5);
      await expect(
        workflow.getByRole("link", { name: "3 Evaluate and compare" }),
      ).toHaveAttribute("aria-current", "step");
    } else {
      const workflow = page.getByRole("navigation", {
        name: "Career workflow",
      });
      await expect(workflow).toBeVisible();
      await expect(workflow.getByRole("link")).toHaveCount(5);
      const pageStory = page.getByLabel("How this page helps");
      await expect(pageStory).toBeVisible();
      await expect(pageStory.getByText("Uses", { exact: true })).toBeVisible();
      await expect(
        pageStory.getByText("Creates", { exact: true }),
      ).toBeVisible();
    }
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
    page.getByRole("heading", {
      name: "Make your next move with evidence, not guesswork.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Evidence-backed career decisions.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Local records · private · nothing sent automatically", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Career evidence", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Evaluate and compare", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("link", { name: "Career record" }).focus();
  await expect(page.getByRole("link", { name: "Career record" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your career record" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Next: Find roles" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/overview");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
  await expect(moreDestinations.getByRole("link")).toHaveCount(11);
  await expect(
    moreDestinations.getByRole("link", { name: "Career record" }),
  ).toBeFocused();
  const moreLabels = [
    "Career record",
    "Find roles",
    "Saved jobs",
    "Fit analysis",
    "Compare roles",
    "Application progress",
    "Materials",
    "Import data",
    "Agent activity",
    "Preferences",
    "System status",
  ] as const;
  for (const [index, label] of moreLabels.entries()) {
    await expect(
      moreDestinations.getByRole("link", { name: label }),
    ).toBeFocused();
    if (index < moreLabels.length - 1) await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Tab");
  await expect(
    moreDestinations.getByRole("link", { name: "Career record" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    moreDestinations.getByRole("link", { name: "System status" }),
  ).toBeFocused();
  const mobileMoreBounds = await page
    .locator(".mobile-more-panel")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: Math.round(bounds.bottom),
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
  expect(mobileMoreBounds.left).toBeGreaterThanOrEqual(0);
  expect(mobileMoreBounds.top).toBeGreaterThanOrEqual(0);
  expect(mobileMoreBounds.right).toBeLessThanOrEqual(
    mobileMoreBounds.viewportWidth,
  );
  expect(mobileMoreBounds.bottom).toBeLessThanOrEqual(
    mobileMoreBounds.viewportHeight,
  );
  await page.screenshot({
    path: join(evidenceRoot, "mobile-more.png"),
  });
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();
  await page.keyboard.press("Enter");
  await moreDestinations.getByRole("link", { name: "Materials" }).click();
  await expect(
    page.getByRole("heading", { name: "Drafts and review" }),
  ).toBeVisible();
  const mobileDraftCard = page.locator(".draft-card").first();
  const mobileMeasuredCard =
    (await mobileDraftCard.count()) > 0
      ? mobileDraftCard
      : page.getByLabel("How this page helps");
  await expect(mobileMeasuredCard).toBeVisible();
  if ((await mobileDraftCard.count()) > 0) {
    const mobileDraftAction = mobileDraftCard.getByRole("button", {
      name: "Inspect draft",
    });
    await mobileDraftAction.focus();
    await expect(mobileDraftAction).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const action = document.activeElement?.getBoundingClientRect();
          const footer = document
            .querySelector(".sidebar")
            ?.getBoundingClientRect();
          return (
            action !== undefined &&
            footer !== undefined &&
            action.bottom <= footer.top + 1
          );
        }),
      )
      .toBe(true);
  }
  const mobileDraftLayout = await mobileMeasuredCard.evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    return {
      cardLeft: Math.round(bounds.left),
      cardRight: Math.round(bounds.right),
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(mobileDraftLayout.overflow).toBeLessThanOrEqual(0);
  expect(mobileDraftLayout.cardLeft).toBeGreaterThanOrEqual(0);
  expect(mobileDraftLayout.cardRight).toBeLessThanOrEqual(
    mobileDraftLayout.viewportWidth,
  );
  await expect(more).toHaveAttribute("aria-current", "page");
});
