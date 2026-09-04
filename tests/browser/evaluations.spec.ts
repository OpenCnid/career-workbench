import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SnapshotResponse } from "../../packages/contracts/src/api.js";
import {
  createEvaluationsFixture,
  createEvaluationsLifecycleFixture,
  createNoEvidenceFixture,
  createNoJobsFixture,
  createUnevaluatedFixture,
  evaluationFixtureSeed,
  selectedOpportunityId,
} from "../support/evaluations-fixture.js";

const evaluationEvidenceRoot = join(
  "docs",
  "qa",
  "generated",
  "evaluations-selfplay",
  "final",
);

const requiredViewports = [
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
  { width: 320, height: 812 },
] as const;

async function routeSnapshot(
  page: Page,
  fixture: SnapshotResponse,
): Promise<void> {
  await page.route("**/api/v1/snapshot", async (route) => {
    await route.fulfill({ json: fixture });
  });
}

async function openCompletedEvaluation(page: Page): Promise<void> {
  await page.goto(`/evaluations?opportunity=${selectedOpportunityId}`);
  await expect(
    page.getByRole("heading", { name: "Platform Engineer", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("[data-evaluation-state='completed']"),
  ).toBeVisible();
}

async function expectInsideViewport(
  locator: Locator,
  width: number,
  height: number,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (box === null)
    throw new Error(
      `Visible element has no box: ${await locator.evaluate((node) => node.outerHTML)}`,
    );
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
  const fixedSidebar = locator.page().locator(".sidebar");
  if (width <= 720 && (await fixedSidebar.isVisible())) {
    const sidebarBox = await fixedSidebar.boundingBox();
    if (sidebarBox === null)
      throw new Error("The visible mobile navigation must be measurable.");
    expect(box.y + box.height).toBeLessThanOrEqual(sidebarBox.y + 0.5);
  }
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

async function expectMinimumHitbox(locator: Locator): Promise<void> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (!(await item.isVisible())) continue;
    const box = await item.boundingBox();
    if (box === null)
      throw new Error(
        `Visible control has no box: ${(await item.getAttribute("aria-label")) ?? "unnamed"}`,
      );
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
  }
}

for (const viewport of requiredViewports) {
  test(`completed summary keeps the whole decision above the fold at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await routeSnapshot(page, createEvaluationsFixture());
    await openCompletedEvaluation(page);

    const pageHeader = page.locator(".evaluation-page-header");
    await expect(pageHeader).toHaveClass(/\bpage-header\b/);
    expect(
      await pageHeader
        .locator(":scope > *")
        .evaluateAll((elements) =>
          elements.map((element) =>
            [element.tagName.toLowerCase(), element.getAttribute("class")]
              .filter(Boolean)
              .join("."),
          ),
        ),
    ).toEqual([
      "p.eyebrow",
      "h1",
      "p.page-description",
      "nav.journey-rail",
      "section.page-story",
    ]);
    await expect(pageHeader.getByText("How this helps")).toBeVisible();
    await expect(pageHeader.getByText("Uses", { exact: true })).toBeVisible();
    await expect(
      pageHeader.getByText("Creates", { exact: true }),
    ).toBeVisible();
    const titleBox = await pageHeader
      .getByRole("heading", { level: 1 })
      .boundingBox();
    const descriptionBox = await pageHeader
      .locator(".page-description")
      .boundingBox();
    if (titleBox === null || descriptionBox === null)
      throw new Error(
        "The evaluation title and description must be measurable.",
      );
    expect(Math.abs(titleBox.x - descriptionBox.x)).toBeLessThanOrEqual(0.5);
    expect(descriptionBox.y).toBeGreaterThanOrEqual(
      titleBox.y + titleBox.height,
    );
    await expectInsideViewport(
      pageHeader.locator(".page-story"),
      viewport.width,
      viewport.height,
    );

    const workflow = page.getByRole("navigation", {
      name: "Career workflow",
    });
    await expect(workflow).toBeVisible();
    await expect(workflow.getByRole("link")).toHaveCount(5);
    await expect(
      workflow.getByRole("link", { name: "3 Evaluate and compare" }),
    ).toHaveAttribute("aria-current", "step");
    await expectInsideViewport(workflow, viewport.width, viewport.height);
    await expectMinimumHitbox(workflow.getByRole("link"));

    const card = page.locator(".evaluation-summary-card");
    const required = [
      card.locator(".evaluation-job-identity h2"),
      card.locator(".evaluation-job-identity .eyebrow"),
      card.locator(".evaluation-current-score"),
      card.locator(".evaluation-state-line .pill"),
      card.locator(".evaluation-caveat"),
      card.locator(".evaluation-primary-concern"),
      card.locator("[data-next-action]"),
    ];
    for (const item of required)
      await expectInsideViewport(item, viewport.width, viewport.height);

    await expect(card.locator(".evaluation-primary-concern > p")).toHaveCount(
      1,
    );
    const concernOverflow = await card
      .locator(".evaluation-primary-concern > p")
      .evaluate((element) => ({
        client: element.clientHeight,
        scroll: element.scrollHeight,
      }));
    expect(concernOverflow.scroll).toBeLessThanOrEqual(concernOverflow.client);
    await expect(card).toContainText("Authoritative critical finding");
    await expect(card).toContainText("not an application recommendation");
    await expect(page.locator(".evaluation-history")).not.toHaveAttribute(
      "open",
    );
    await expectNoDocumentOverflow(page);
    await expectMinimumHitbox(
      page.locator(
        ".evaluation-toolbar button, .evaluation-summary-card button, .evaluation-history > summary",
      ),
    );
  });
}

test("Fit check inherits the shared desktop page-header, eyebrow, and content gutter geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await routeSnapshot(page, createEvaluationsFixture());
  const readHeader = async () =>
    page.locator(".page-header").evaluate((header) => {
      const eyebrow = header.querySelector<HTMLElement>(":scope > .eyebrow");
      const title = header.querySelector<HTMLElement>(":scope > h1");
      const description = header.querySelector<HTMLElement>(
        ":scope > .page-description",
      );
      const rail = header.querySelector<HTMLElement>(":scope > .journey-rail");
      const story = header.querySelector<HTMLElement>(":scope > .page-story");
      if (
        eyebrow === null ||
        title === null ||
        description === null ||
        rail === null ||
        story === null
      )
        throw new Error("The shared page-header hierarchy must be complete.");
      const headerBox = header.getBoundingClientRect();
      const eyebrowBox = eyebrow.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const style = (element: Element) => getComputedStyle(element);
      return {
        geometry: {
          x: headerBox.x,
          width: headerBox.width,
          eyebrowTitleGap: titleBox.top - eyebrowBox.bottom,
        },
        styles: {
          headerMaxWidth: style(header).maxWidth,
          headerMarginBottom: style(header).marginBottom,
          eyebrowFontSize: style(eyebrow).fontSize,
          eyebrowMarginBottom: style(eyebrow).marginBottom,
          titleFontSize: style(title).fontSize,
          titleLineHeight: style(title).lineHeight,
          titleMarginBottom: style(title).marginBottom,
          descriptionFontSize: style(description).fontSize,
          descriptionLineHeight: style(description).lineHeight,
          descriptionMaxWidth: style(description).maxWidth,
          railMarginTop: style(rail).marginTop,
          storyMarginTop: style(story).marginTop,
          storyPaddingTop: style(story).paddingTop,
          storyPaddingBottom: style(story).paddingBottom,
        },
      };
    });

  await page.goto("/discover");
  await expect(
    page.getByRole("heading", {
      name: "Research roles worth considering.",
    }),
  ).toBeVisible();
  const discoverHeader = await readHeader();

  await openCompletedEvaluation(page);
  const evaluationHeader = await readHeader();
  expect(evaluationHeader.styles).toEqual(discoverHeader.styles);
  expect(evaluationHeader.geometry.x).toBeCloseTo(discoverHeader.geometry.x, 1);
  expect(evaluationHeader.geometry.width).toBeCloseTo(
    discoverHeader.geometry.width,
    1,
  );
  expect(evaluationHeader.geometry.eyebrowTitleGap).toBeCloseTo(
    discoverHeader.geometry.eyebrowTitleGap,
    1,
  );
  const contentGutter = await page
    .locator("main.content")
    .evaluate((content) => {
      const sidebar = document.querySelector<HTMLElement>(".sidebar");
      const header = content.querySelector<HTMLElement>(".page-header");
      if (sidebar === null || header === null)
        throw new Error(
          "The desktop shell and page header must both be visible.",
        );
      const contentStyle = getComputedStyle(content);
      return {
        left: Number.parseFloat(contentStyle.paddingLeft),
        right: Number.parseFloat(contentStyle.paddingRight),
        visibleInset:
          header.getBoundingClientRect().left -
          sidebar.getBoundingClientRect().right,
      };
    });
  expect(contentGutter.left).toBeCloseTo(contentGutter.right, 1);
  expect(contentGutter.visibleInset).toBeCloseTo(contentGutter.left, 1);
  expect(contentGutter.visibleInset).toBeGreaterThanOrEqual(24);
  expect(contentGutter.visibleInset).toBeLessThanOrEqual(48);
});

test("searchable picker scales to 50 jobs, disambiguates duplicates, and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await routeSnapshot(page, createEvaluationsFixture());
  await openCompletedEvaluation(page);
  const opener = page.getByRole("button", { name: /Change selected job/ });

  await opener.press(" ");
  const search = page.getByRole("searchbox", { name: "Search saved jobs" });
  await expect(search).toBeFocused();
  await expect(page.getByRole("option")).toHaveCount(50);
  await search.press("Shift+Tab");
  const closePicker = page.getByRole("button", {
    name: "Close saved job picker",
  });
  await expect(closePicker).toBeFocused();
  await closePicker.press("Tab");
  await expect(search).toBeFocused();
  await search.press("Tab");
  await expect(page.getByRole("option").first()).toBeFocused();
  await page.getByRole("option").first().press("Shift+Tab");
  await expect(search).toBeFocused();
  const searchBox = await search.boundingBox();
  const firstResultBox = await page.getByRole("option").first().boundingBox();
  if (searchBox === null || firstResultBox === null)
    throw new Error("The mobile picker controls must have measurable boxes.");
  expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(812);
  expect(firstResultBox.y + firstResultBox.height).toBeLessThanOrEqual(812);

  await search.fill("Platform Engineer");
  const matching = page.getByRole("option");
  await expect(matching).toHaveCount(3);
  const labels = await matching.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")),
  );
  expect(new Set(labels).size).toBe(3);
  expect(labels).toEqual(
    expect.arrayContaining([
      "Platform Engineer — Synthetic Labs · requisition SYN-DUP-1",
      "Platform Engineer — Synthetic Labs · requisition SYN-DUP-2",
      "Platform Engineer — Northstar Fabrication",
    ]),
  );

  await search.fill("RoleSYNTHETIC");
  const longResult = page.getByRole("option");
  await expect(longResult).toHaveCount(1);
  const longResultWidths = await longResult.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    text: element.textContent,
  }));
  expect(longResultWidths.scroll).toBeLessThanOrEqual(longResultWidths.client);
  expect(longResultWidths.text).toContain("X".repeat(180));
  await longResult.click();
  await expect(opener).toBeFocused();
  const longTitle = page.locator(".evaluation-job-identity h2");
  await expect(longTitle).toContainText("X".repeat(180));
  const longTitleBox = await longTitle.boundingBox();
  const longScoreBox = await page
    .locator(".evaluation-current-score")
    .boundingBox();
  if (longTitleBox === null || longScoreBox === null)
    throw new Error("The long title and score must have measurable boxes.");
  expect(longTitleBox.x + longTitleBox.width).toBeLessThanOrEqual(
    longScoreBox.x,
  );
  await expectNoDocumentOverflow(page);
  await opener.click();
  await expect(search).toBeFocused();

  await search.fill("Principal Applied Systems Researcher");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText(
    "Principal Applied Systems Researcher",
  );

  await search.fill("no synthetic result can match this");
  await expect(
    page.getByText("No saved jobs match that role or organization."),
  ).toBeVisible();
  await search.fill("Synthetic Organization 20");
  await search.press("ArrowDown");
  await expect(page.getByRole("option")).toBeFocused();
  await page.getByRole("option").press(" ");
  await expect(opener).toBeFocused();
  await expect(page).toHaveURL(/opportunity=opportunity_0000000020/);

  await opener.press("Enter");
  await expect(search).toBeFocused();
  await search.press("Escape");
  await expect(opener).toBeFocused();
  await expect(
    page.getByRole("dialog", { name: "Choose a saved job" }),
  ).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test("deep-linked job selection survives refresh and Check fit targets the intended job", async ({
  page,
}) => {
  const fixture = createEvaluationsFixture();
  await routeSnapshot(page, fixture);
  let requestedOpportunity = "";
  await page.route("**/api/v1/session", async (route) => {
    await route.fulfill({
      json: { contractVersion: "v1", csrfToken: "synthetic-csrf-token" },
    });
  });
  await page.route("**/api/v1/evaluations/fixture", async (route) => {
    const body = route.request().postDataJSON() as { opportunityId: string };
    requestedOpportunity = body.opportunityId;
    await route.fulfill({
      json: {
        contractVersion: "v1",
        id: "operation_9999999999",
        revision: 1,
      },
    });
  });
  await openCompletedEvaluation(page);

  const opener = page.getByRole("button", { name: /Change selected job/ });
  await opener.click();
  const search = page.getByRole("searchbox", { name: "Search saved jobs" });
  await search.fill("Synthetic Organization 20");
  await search.press("ArrowDown");
  await page.getByRole("option").press("Enter");
  await expect(page).toHaveURL(/opportunity=opportunity_0000000020/);
  await expect(page.locator(".evaluation-job-identity")).toContainText(
    "Synthetic Organization 20",
  );

  await page.reload();
  await expect(page).toHaveURL(/opportunity=opportunity_0000000020/);
  await expect(page.locator(".evaluation-job-identity")).toContainText(
    "Synthetic Organization 20",
  );
  await page
    .getByRole("button", { name: /Check fit for Synthetic Role 20/ })
    .first()
    .click();
  await expect.poll(() => requestedOpportunity).toBe("opportunity_0000000020");
});

test("history starts at five rows, recovers all nine, and keeps one bounded detail open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await routeSnapshot(page, createEvaluationsFixture());
  await openCompletedEvaluation(page);
  const history = page.locator(".evaluation-history");
  await history.locator("summary").click();
  const rows = history.locator(".evaluation-history-list > li");
  await expect(rows).toHaveCount(5);
  await expect(rows.first().getByRole("button")).toHaveAccessibleName(
    /Open run 9.*Platform Engineer.*Synthetic Labs.*Completed.*76\/100.*\+2 pp/,
  );
  await expect(rows.first().locator("time")).toHaveAttribute(
    "datetime",
    "2026-08-29T15:00:00.000Z",
  );
  await history.getByRole("button", { name: "Show all 9 runs" }).click();
  await expect(rows).toHaveCount(9);
  await expect(rows.last()).toContainText("New");

  const firstTrigger = rows.first().getByRole("button");
  await firstTrigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  const dimensions = await dialog.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    viewport: window.innerHeight,
  }));
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewport * 0.65 + 2);
  await dialog.getByRole("tab", { name: /Evidence details/ }).click();
  const scrollRegion = dialog.locator(".evaluation-dialog-scroll");
  const scrollDimensions = await scrollRegion.evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
  }));
  expect(scrollDimensions.scroll).toBeGreaterThan(scrollDimensions.client);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(firstTrigger).toBeFocused();
});

test("current and historical detail recover complete evidence, findings, arithmetic, and artifacts @a11y", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await routeSnapshot(page, createEvaluationsFixture());
  await openCompletedEvaluation(page);
  const trigger = page.getByRole("button", {
    name: /Review full fit evidence for Platform Engineer/,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const tabs = dialog.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  const tabBoxes = await tabs.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, width: box.width, height: box.height };
    }),
  );
  expect(new Set(tabBoxes.map((box) => Math.round(box.top))).size).toBe(1);
  for (const box of tabBoxes) expect(box.height).toBeGreaterThanOrEqual(40);

  await tabs.nth(0).press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  const evidencePanel = dialog.getByRole("tabpanel", { name: /Evidence/ });
  await expect(
    evidencePanel
      .getByRole("heading", { name: "Accepted candidate facts · 4" })
      .locator("+ ul > li"),
  ).toHaveCount(4);
  await expect(
    evidencePanel
      .getByRole("heading", { name: "Additional accepted evidence · 3" })
      .locator("+ ul > li"),
  ).toHaveCount(3);
  await expect(
    evidencePanel
      .getByRole("heading", { name: "Rejected evidence · 2" })
      .locator("+ ul > li"),
  ).toHaveCount(2);
  await expect(evidencePanel).toContainText(
    "The source establishes team ownership, not sole ownership.",
  );
  await expect(evidencePanel).toContainText("synthetic://candidate/");
  await expect(evidencePanel).toContainText("characters 0–19");
  await expect(evidencePanel).toContainText(
    "Accepted synthetic candidate fact 2",
  );
  await expect(evidencePanel).toContainText("Synthetic source quote 2");
  await expect(evidencePanel).toContainText(
    "Rejected candidate claim for run 10",
  );
  await expect(evidencePanel).not.toContainText(
    "Rejected candidate claim for run 9",
  );
  const overflowingEvidence = await evidencePanel.evaluate((element) =>
    [...element.querySelectorAll("*")]
      .filter((item) => {
        const style = getComputedStyle(item);
        return (
          style.display !== "none" &&
          item.clientWidth > 0 &&
          item.scrollWidth > item.clientWidth + 1
        );
      })
      .map((item) => item.tagName),
  );
  expect(overflowingEvidence).toEqual([]);

  await dialog.getByRole("tab", { name: /Findings for/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "Gaps · 12" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Gaps · 12" }).locator("+ ul > li"),
  ).toHaveCount(12);
  await expect(
    dialog
      .getByRole("heading", { name: "Contradictions · 12" })
      .locator("+ ul > li"),
  ).toHaveCount(12);

  await dialog.getByRole("tab", { name: /Score details/ }).click();
  await expect(dialog.locator(".dimension")).toHaveCount(2);
  await expect(dialog.locator(".dimension").nth(0)).toContainText(
    "83% · weight 60%",
  );
  await expect(dialog.locator(".dimension").nth(1)).toContainText(
    "73% · weight 40%",
  );
  await expect(dialog.locator(".evaluation-arithmetic")).toContainText(
    "79% = ((83% required experience × 60%) + (73% role priorities × 40%))",
  );
  await dialog.getByRole("tab", { name: /Artifacts for/ }).click();
  await expect(dialog.locator(".artifact")).toHaveCount(1);
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".evaluation-detail-dialog")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.locator(".evaluation-history > summary").click();
  const historicalTrigger = page
    .locator(".evaluation-history-list > li")
    .first()
    .getByRole("button");
  await historicalTrigger.click();
  const historicalDialog = page.getByRole("dialog");
  await historicalDialog.getByRole("tab", { name: /Evidence details/ }).click();
  await expect(historicalDialog).toContainText("Accepted candidate facts · 4");
  await expect(historicalDialog).toContainText(
    "Rejected candidate claim for run 9",
  );
  await expect(historicalDialog).not.toContainText(
    "Rejected candidate claim for run 10",
  );
  await historicalDialog.getByRole("tab", { name: /Artifacts for/ }).click();
  await expect(historicalDialog.locator(".artifact")).toHaveCount(1);
});

test("picker and mobile evaluation surfaces pass focused accessibility checks @a11y", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await routeSnapshot(page, createEvaluationsFixture());
  await openCompletedEvaluation(page);
  await page.getByRole("button", { name: /Change selected job/ }).click();
  const pickerResults = await new AxeBuilder({ page })
    .include(".evaluation-picker-dialog")
    .analyze();
  expect(pickerResults.violations).toEqual([]);
  await page.keyboard.press("Escape");
  const mobileResults = await new AxeBuilder({ page })
    .include(".evaluation-toolbar")
    .include(".evaluation-summary-card")
    .analyze();
  expect(mobileResults.violations).toEqual([]);
});

for (const state of [
  "pending",
  "running",
  "waiting_for_user",
  "stale",
  "failed",
  "canceled",
  "queued",
  "indeterminate",
] as const) {
  test(`${state} remains explicit without presenting the non-final 0/100 @a11y`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await routeSnapshot(page, createEvaluationsLifecycleFixture(state));
    await page.goto(`/evaluations?opportunity=${selectedOpportunityId}`);
    const summary = page.locator(".evaluation-summary-card");
    await expect(summary).toHaveAttribute("data-evaluation-state", state);
    await expect(summary).not.toContainText("0/100");
    await expect(summary).toContainText(
      state === "stale" ? "Stale result" : "Last completed",
    );
    await expect(summary).toContainText(
      state === "stale" ? "79/100" : "76/100",
    );
    await expect(summary).toContainText("not an application recommendation");
    const toolbarCheck = page.locator(
      ".evaluation-toolbar .evaluation-check-button",
    );
    if (["pending", "queued", "running", "waiting_for_user"].includes(state))
      await expect(toolbarCheck).toBeDisabled();
    else await expect(toolbarCheck).toBeEnabled();
    await expect(
      summary.getByRole("button", {
        name:
          state === "stale"
            ? /Review stale fit evidence/
            : /Review last completed fit evidence/,
      }),
    ).toBeVisible();
    if (state !== "stale") {
      const reviewCurrentRun = summary.getByRole("button", {
        name: new RegExp(
          `Review ${state.replaceAll("_", " ")} run evidence`,
          "i",
        ),
      });
      await expect(reviewCurrentRun).toBeVisible();
      await reviewCurrentRun.click();
      const dialog = page.getByRole("dialog");
      const detailState =
        state === "waiting_for_user"
          ? "Waiting for user"
          : `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
      await expect(dialog.locator(".evaluation-detail-state")).toContainText(
        detailState,
      );
      if (state === "indeterminate") {
        await expect(dialog.locator(".evaluation-terminal-message")).toHaveText(
          "Synthetic operation ended without a trusted terminal.",
        );
      }
      if (state === "failed") {
        await dialog.getByRole("tab", { name: /Evidence details/ }).click();
        await expect(dialog).toContainText("Accepted candidate facts · 4");
        await expect(dialog).toContainText(
          "Rejected candidate claim for run 10",
        );
        await dialog.getByRole("tab", { name: /Artifacts for/ }).click();
        await expect(dialog).toContainText("evaluation_report");
        await expect(dialog).toContainText("5010 bytes");
      }
      const detailAccessibility = await new AxeBuilder({ page })
        .include(".evaluation-detail-dialog")
        .analyze();
      expect(detailAccessibility.violations).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(reviewCurrentRun).toBeFocused();
    }
    const expectedConcern: Readonly<Record<string, string>> = {
      pending: "No fit result exists until the admitted check finishes.",
      running: "Do not treat the in-progress check as a final fit result.",
      waiting_for_user: "The requested input is blocking a trustworthy result.",
      stale: "Accepted evidence changed after evaluation.",
      failed: "Synthetic evaluation failed before a new result was accepted.",
      canceled: "Synthetic evaluation was canceled by the user.",
      queued: "No fit result exists until the queued check finishes.",
      indeterminate: "Synthetic operation ended without a trusted terminal.",
    };
    await expect(summary.locator(".evaluation-primary-concern")).toContainText(
      expectedConcern[state] ?? state,
    );
    if (state === "waiting_for_user") {
      await expect(summary.locator("[data-next-action] strong")).toContainText(
        "Review the requested input",
      );
      await expect(
        summary.getByRole("link", { name: /Review requested input/ }),
      ).toBeVisible();
    }
    if (state === "running") {
      await page.locator(".evaluation-history > summary").click();
      await expect(
        page
          .locator(".evaluation-history-list > li")
          .first()
          .getByRole("button"),
      ).toHaveAccessibleName(/Open run 9.*76\/100/);
    }
    for (const item of [
      summary.locator(".evaluation-job-identity"),
      summary.locator(".evaluation-current-score"),
      summary.locator(".evaluation-state-line"),
      summary.locator(".evaluation-caveat"),
      summary.locator(".evaluation-primary-concern"),
      summary.locator("[data-next-action]"),
    ])
      await expectInsideViewport(item, 320, 812);
    await expectNoDocumentOverflow(page);
    const accessibility = await new AxeBuilder({ page })
      .include(".evaluation-summary-card")
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

test("a lone stale evaluation keeps its score, reason, and detail recoverable", async ({
  page,
}) => {
  const fixture = createEvaluationsLifecycleFixture("stale");
  const latest = fixture.evaluations.find(
    (evaluation) => evaluation.id === "evaluation_0000000010",
  );
  const latestOperation = fixture.operations.find(
    (operation) => operation.id === "operation_0000000010",
  );
  if (latest === undefined || latestOperation === undefined)
    throw new Error("Synthetic stale evaluation is missing.");
  const single: SnapshotResponse = {
    ...fixture,
    evaluations: [latest],
    operations: [latestOperation],
    artifacts: fixture.artifacts.filter((artifact) =>
      artifact.evaluationIds.includes(latest.id),
    ),
  };
  await routeSnapshot(page, single);
  await page.goto(`/evaluations?opportunity=${selectedOpportunityId}`);
  const summary = page.locator(".evaluation-summary-card");
  await expect(summary).toHaveAttribute("data-evaluation-state", "stale");
  await expect(summary).toContainText("Stale result");
  await expect(summary).toContainText("79/100");
  await expect(summary).toContainText(
    "Accepted evidence changed after evaluation.",
  );
  await expect(page.locator(".evaluation-history")).toHaveCount(0);
  await summary
    .getByRole("button", { name: /Review stale fit evidence/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Stale");
  await expect(dialog).toContainText("79/100 · stale fit estimate");
  await expect(dialog).toContainText(
    "Stale reason: Accepted evidence changed after evaluation.",
  );
  await dialog.getByRole("tab", { name: /Evidence details/ }).click();
  await expect(dialog).toContainText("Accepted candidate facts · 4");
  await dialog.getByRole("tab", { name: /Artifacts for/ }).click();
  await expect(dialog.locator(".artifact")).toContainText("stale");
});

test("a lone failed evaluation keeps its partial detail recoverable", async ({
  page,
}) => {
  const fixture = createEvaluationsLifecycleFixture("failed");
  const latest = fixture.evaluations.find(
    (evaluation) => evaluation.id === "evaluation_0000000010",
  );
  const latestOperation = fixture.operations.find(
    (operation) => operation.id === "operation_0000000010",
  );
  if (latest === undefined || latestOperation === undefined)
    throw new Error("Synthetic failed evaluation is missing.");
  const single: SnapshotResponse = {
    ...fixture,
    evaluations: [latest],
    operations: [latestOperation],
    artifacts: fixture.artifacts.filter((artifact) =>
      artifact.evaluationIds.includes(latest.id),
    ),
  };
  await page.setViewportSize({ width: 320, height: 812 });
  await routeSnapshot(page, single);
  await page.goto(`/evaluations?opportunity=${selectedOpportunityId}`);
  const summary = page.locator(".evaluation-summary-card");
  await expect(summary).toHaveAttribute("data-evaluation-state", "failed");
  await expect(summary.locator(".evaluation-current-score")).toContainText(
    "Not final",
  );
  await expect(page.locator(".evaluation-history")).toHaveCount(0);
  const trigger = summary.getByRole("button", {
    name: /Review failed run evidence/,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".evaluation-detail-state")).toContainText(
    "Failed",
  );
  await dialog.getByRole("tab", { name: /Evidence details/ }).click();
  await expect(dialog).toContainText("Accepted candidate facts · 4");
  await expect(dialog).toContainText("Rejected candidate claim for run 10");
  await dialog.getByRole("tab", { name: /Findings for/ }).click();
  await expect(dialog).toContainText("Gaps · 12");
  await expect(dialog).toContainText("Contradictions · 12");
  await dialog.getByRole("tab", { name: /Artifacts for/ }).click();
  await expect(dialog).toContainText("evaluation_report");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("a resultless terminal operation does not relabel the prior completed result", async ({
  page,
}) => {
  const fixture = createEvaluationsLifecycleFixture("indeterminate");
  const resultless: SnapshotResponse = {
    ...fixture,
    evaluations: fixture.evaluations.filter(
      (evaluation) => evaluation.id !== "evaluation_0000000010",
    ),
    artifacts: fixture.artifacts.filter(
      (artifact) => !artifact.evaluationIds.includes("evaluation_0000000010"),
    ),
  };
  await routeSnapshot(page, resultless);
  await page.goto(`/evaluations?opportunity=${selectedOpportunityId}`);
  const summary = page.locator(".evaluation-summary-card");
  await expect(summary).toHaveAttribute(
    "data-evaluation-state",
    "indeterminate",
  );
  await expect(summary).toContainText("Last completed");
  await expect(summary).toContainText("76/100");
  await expect(
    summary.getByRole("button", { name: /Review indeterminate run evidence/ }),
  ).toHaveCount(0);
  const trigger = summary.getByRole("button", {
    name: /Review last completed fit evidence/,
  });
  await trigger.click();
  const dialogState = page
    .getByRole("dialog")
    .locator(".evaluation-detail-state");
  await expect(dialogState).toContainText("Completed");
  await expect(dialogState).not.toContainText("Indeterminate");
  await expect(dialogState).not.toContainText(
    "Synthetic operation ended without a trusted terminal.",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("empty, no-evidence, unevaluated, and completed states give an explicit next action", async ({
  page,
}) => {
  const cases: readonly {
    fixture: SnapshotResponse;
    expectedState?: string;
    expectedText: string;
  }[] = [
    {
      fixture: createNoJobsFixture(),
      expectedText: "Save a job before checking fit",
    },
    {
      fixture: createNoEvidenceFixture(),
      expectedState: "no_evidence",
      expectedText: "Career evidence needed",
    },
    {
      fixture: createUnevaluatedFixture(),
      expectedState: "not_evaluated",
      expectedText: "Run the first fit check",
    },
    {
      fixture: createEvaluationsFixture(),
      expectedState: "completed",
      expectedText: "Review the concern",
    },
  ];
  for (const [index, lifecycle] of cases.entries()) {
    await page.unrouteAll({ behavior: "wait" });
    await routeSnapshot(page, lifecycle.fixture);
    await page.goto(
      `/evaluations?opportunity=${selectedOpportunityId}&case=${String(index)}`,
    );
    if (lifecycle.expectedState !== undefined) {
      await expect(page.locator(".evaluation-summary-card")).toHaveAttribute(
        "data-evaluation-state",
        lifecycle.expectedState,
      );
    }
    await expect(
      page.getByText(lifecycle.expectedText, { exact: false }),
    ).toBeVisible();
    await expect(page.locator("[data-next-action]")).toBeVisible();
    if (lifecycle.expectedState === undefined) {
      const empty = page.locator(".evaluation-empty-state");
      await expect(empty.locator(".evaluation-current-score")).toContainText(
        "Not available",
      );
      await expect(empty.locator(".evaluation-state-line")).toContainText(
        "No saved jobs",
      );
      await expect(empty.locator(".evaluation-primary-concern")).toContainText(
        "There is no saved job to evaluate yet.",
      );
    }
  }
});

test("history marks a completed run without a prior comparable rubric", async ({
  page,
}) => {
  const fixture = createEvaluationsFixture();
  const mismatched: SnapshotResponse = {
    ...fixture,
    evaluations: fixture.evaluations.map((evaluation) =>
      evaluation.id === "evaluation_0000000009"
        ? { ...evaluation, rubricId: "rubric_9999999999" }
        : evaluation,
    ),
  };
  await routeSnapshot(page, mismatched);
  await openCompletedEvaluation(page);
  await page.locator(".evaluation-history > summary").click();
  await expect(
    page.locator(".evaluation-history-list > li").first(),
  ).toContainText("Not comparable");
});

test(`retain exact-viewport synthetic evaluation evidence (${evaluationFixtureSeed})`, async ({
  page,
}) => {
  test.setTimeout(60_000);
  await mkdir(evaluationEvidenceRoot, { recursive: true });
  let activeFixture = createEvaluationsFixture();
  await page.route("**/api/v1/snapshot", async (route) => {
    await route.fulfill({ json: activeFixture });
  });
  let caseNumber = 0;
  const openCase = async (
    fixture: SnapshotResponse,
    viewport: { width: number; height: number },
  ): Promise<void> => {
    activeFixture = fixture;
    caseNumber += 1;
    await page.setViewportSize(viewport);
    await page.goto(
      `/evaluations?opportunity=${selectedOpportunityId}&evidence=${String(caseNumber)}`,
    );
    await expect(
      page.getByRole("heading", { name: "Fit check" }),
    ).toBeVisible();
  };
  const capture = async (name: string): Promise<void> => {
    await page.screenshot({ path: join(evaluationEvidenceRoot, name) });
  };

  await openCase(createNoJobsFixture(), { width: 1280, height: 720 });
  await capture("evaluations-1280x720-empty.png");

  for (const viewport of requiredViewports) {
    await openCase(createEvaluationsFixture(), viewport);
    await expect(
      page.locator("[data-evaluation-state='completed']"),
    ).toBeVisible();
    await capture(
      `evaluations-${String(viewport.width)}x${String(viewport.height)}-completed.png`,
    );
  }

  await openCase(createEvaluationsFixture(), { width: 375, height: 812 });
  await page.getByRole("button", { name: /Change selected job/ }).click();
  await expect(page.getByRole("option")).toHaveCount(50);
  await capture("evaluations-375x812-picker-50-jobs.png");
  await page
    .getByRole("searchbox", { name: "Search saved jobs" })
    .fill("Synthetic Labs");
  await expect(page.getByRole("option")).toHaveCount(2);
  await capture("evaluations-375x812-picker-duplicates.png");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Review full fit evidence/ }).click();
  await capture("evaluations-375x812-current-detail.png");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator(".evaluation-history > summary").click();
  await expect(page.locator(".evaluation-history-list > li")).toHaveCount(5);
  await capture("evaluations-768x1024-history-five-rows.png");
  await page.setViewportSize({ width: 375, height: 812 });
  await page
    .locator(".evaluation-history-list > li")
    .first()
    .getByRole("button")
    .click();
  await capture("evaluations-375x812-history-detail.png");
  await page.keyboard.press("Escape");

  for (const state of ["pending", "running", "failed", "canceled"] as const) {
    await openCase(createEvaluationsLifecycleFixture(state), {
      width: 1280,
      height: 720,
    });
    await expect(page.locator(".evaluation-summary-card")).toHaveAttribute(
      "data-evaluation-state",
      state,
    );
    await capture(`evaluations-1280x720-${state}.png`);
  }
});
