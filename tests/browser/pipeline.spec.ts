import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type {
  ApprovalView,
  SnapshotResponse,
} from "../../packages/contracts/src/api.js";
import { createEvaluationsFixture } from "../support/evaluations-fixture.js";

const pipelineEvidenceRoot = join(
  "docs",
  "qa",
  "generated",
  "pipeline-selfplay",
  "final",
);

function pipelineFixture({
  opportunityIndex = 0,
  withHistory = false,
}: {
  readonly opportunityIndex?: number;
  readonly withHistory?: boolean;
} = {}): SnapshotResponse {
  const base = createEvaluationsFixture();
  const opportunity = base.opportunities[opportunityIndex];
  if (opportunity === undefined)
    throw new Error("Synthetic pipeline opportunity is unavailable.");
  const application = {
    id: "application_pipeline_selfplay_0001",
    revision: withHistory ? 3 : 1,
    opportunityId: opportunity.id,
    state: withHistory ? "ready_for_review" : "considering",
    stateRevision: withHistory ? 3 : 1,
    effectiveDate: withHistory ? "2026-09-03" : "2026-09-01",
    sourceIds: ["source_pipeline_selfplay_0001"],
    note: "Synthetic local pipeline note.",
  } as const;
  return {
    ...base,
    applications: [application],
    events: [
      {
        sequence: 1,
        eventKind: "application.created",
        aggregateId: application.id,
        aggregateRevision: 1,
        timestamp: "2026-09-01T14:00:00.000Z",
        actor: "synthetic-fixture",
        payload: {
          opportunityId: opportunity.id,
          state: "considering",
          effectiveDate: "2026-09-01",
        },
      },
      ...(withHistory
        ? [
            {
              sequence: 2,
              eventKind: "application.transitioned",
              aggregateId: application.id,
              aggregateRevision: 2,
              timestamp: "2026-09-02T14:00:00.000Z",
              actor: "synthetic-fixture",
              payload: {
                from: "considering",
                to: "preparing",
                stateRevision: 2,
                effectiveDate: "2026-09-02",
              },
            },
            {
              sequence: 3,
              eventKind: "application.transitioned",
              aggregateId: application.id,
              aggregateRevision: 3,
              timestamp: "2026-09-03T14:00:00.000Z",
              actor: "synthetic-fixture",
              payload: {
                from: "preparing",
                to: "ready_for_review",
                stateRevision: 3,
                effectiveDate: "2026-09-03",
              },
            },
          ]
        : []),
    ],
  };
}

function pendingApproval(targetId: string, revision: number): ApprovalView {
  return {
    id: "approval_pipeline_selfplay_0001",
    revision: 1,
    commandId: "command_pipeline_selfplay_0001",
    effectKind: "application.transition",
    targetId,
    effectDigest: "sha256:pipeline-selfplay-synthetic-effect",
    summary: "Move application from considering to preparing",
    effectDescription:
      "Record a synthetic local transition from considering to preparing.",
    expectedRevisions: { [targetId]: revision },
    state: "pending",
    expiresAt: "2099-09-04T15:00:00.000Z",
    approvingInteractionId: null,
  };
}

async function routePipeline(
  page: Page,
  snapshot: SnapshotResponse,
  approvals: readonly ApprovalView[] = [],
): Promise<void> {
  await page.route("**/api/v1/snapshot", async (route) => {
    await route.fulfill({ json: snapshot });
  });
  await page.route("**/api/v1/approvals", async (route) => {
    await route.fulfill({ json: { contractVersion: "v1", approvals } });
  });
}

async function openPipeline(page: Page): Promise<void> {
  await page.goto("/pipeline");
  await expect(
    page.getByRole("heading", { name: "Application pipeline", exact: true }),
  ).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

async function expectAboveMobileNavigation(
  page: Page,
  locator: ReturnType<Page["locator"]>,
): Promise<void> {
  const [box, navigationBox] = await Promise.all([
    locator.boundingBox(),
    page.locator(".sidebar").boundingBox(),
  ]);
  expect(box).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
}

test("pipeline hierarchy is compact, unboxed, and keeps the current decision visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await routePipeline(page, pipelineFixture());
  await openPipeline(page);

  const application = page.getByRole("article", {
    name: "Platform Engineer",
  });
  const status = application.locator(".application-current-state .pill");
  const statusBox = await status.boundingBox();
  expect(statusBox?.height).toBeLessThanOrEqual(28);
  await expect(status).toHaveCSS("border-radius", "0px");

  const taskDisclosure = page.locator(
    ".pipeline-add-opportunity .task-disclosure",
  );
  await expect(taskDisclosure).toHaveCSS("border-radius", "0px");
  await expect(taskDisclosure).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  const nextAction = application.locator(":scope > .next-action");
  await expect(nextAction).toHaveCSS("border-radius", "0px");
  await expect(nextAction).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const required = [
    application.getByText("Synthetic Labs", { exact: true }),
    application.getByRole("heading", {
      name: "Platform Engineer",
      exact: true,
    }),
    application.getByText("Current status", { exact: true }),
    application.getByText("Considering", { exact: true }),
    application.getByText("Next action", { exact: true }),
    application.getByRole("link", { name: "Prepare tailored materials" }),
    application.locator(":scope > .progressive-details > summary"),
  ];
  for (const item of required) {
    await expect(item).toBeVisible();
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(720.5);
  }
  await expectNoDocumentOverflow(page);

  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await openPipeline(page);
    const mobileApplication = page.getByRole("article", {
      name: "Platform Engineer",
    });
    for (const item of [
      mobileApplication.getByText("Synthetic Labs", { exact: true }),
      mobileApplication.getByRole("heading", {
        name: "Platform Engineer",
        exact: true,
      }),
      mobileApplication.getByText("Considering", { exact: true }),
      mobileApplication.getByRole("link", {
        name: "Prepare tailored materials",
      }),
      mobileApplication.locator(":scope > .progressive-details > summary"),
      mobileApplication.getByText(
        "A DSH Agent can change this local status only after you approve the exact change and revision.",
        { exact: true },
      ),
      mobileApplication.getByRole("button", {
        name: /Review change to Preparing for Platform Engineer/u,
      }),
    ]) {
      await expect(item).toBeVisible();
      await expectAboveMobileNavigation(page, item);
    }
    await expectNoDocumentOverflow(page);
  }
});

test("pipeline selection, history, and controls remain distinct and contextual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const baseSnapshot = pipelineFixture({
    opportunityIndex: 2,
    withHistory: true,
  });
  const snapshot: SnapshotResponse = {
    ...baseSnapshot,
    opportunities: baseSnapshot.opportunities.map((opportunity) =>
      opportunity.id === "opportunity_0000000002"
        ? { ...opportunity, requisitionId: "SYN-DUP-1" }
        : opportunity,
    ),
  };
  await routePipeline(page, snapshot);
  await openPipeline(page);

  const addAnother = page.locator(
    ".pipeline-add-opportunity .task-disclosure > summary",
  );
  await expect(addAnother).toContainText("Add another job");
  await expect(addAnother).toContainText("Open form");
  await addAnother.focus();
  await page.keyboard.press("Enter");
  await expect(addAnother).toContainText("Close form");
  const opportunity = page.getByLabel("Saved job", { exact: true });
  await expect(opportunity).toBeVisible();
  const duplicateLabels = await opportunity
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((option) => option.textContent.trim())
        .filter((label) =>
          label.startsWith("Platform Engineer — Synthetic Labs"),
        ),
    );
  expect(duplicateLabels).toHaveLength(2);
  expect(new Set(duplicateLabels).size).toBe(2);
  expect(duplicateLabels).toEqual([
    "Platform Engineer — Synthetic Labs · requisition SYN-DUP-1 · duplicate 1 of 2",
    "Platform Engineer — Synthetic Labs · requisition SYN-DUP-1 · duplicate 2 of 2",
  ]);

  const application = page.getByRole("article", {
    name: "Platform Engineer",
  });
  const updateStatus = application.locator(
    ":scope > .progressive-details > summary",
  );
  await expect(updateStatus).toHaveAttribute(
    "aria-label",
    /Change status for Platform Engineer at Northstar Fabrication/u,
  );
  await expect(updateStatus).toContainText("Edit");
  await updateStatus.focus();
  await page.keyboard.press("Enter");
  await expect(updateStatus).toContainText("Close");
  await expect(
    application.getByLabel(
      "New status for Platform Engineer at Northstar Fabrication",
    ),
  ).toBeVisible();
  await expect(
    application.getByRole("button", {
      name: /Save status as Applied for Platform Engineer at Northstar Fabrication/u,
    }),
  ).toBeVisible();

  const history = application.locator(".application-history > summary");
  await expect(history).toContainText("Past status changes (3)");
  await expect(history).toContainText("View");
  const historyBox = await history.boundingBox();
  expect(historyBox?.height).toBeGreaterThanOrEqual(40);
  await history.focus();
  await page.keyboard.press("Enter");
  await expect(history).toContainText("Hide");
  await expect(application).toContainText("Preparing → Ready for review");
  await expect(application).toContainText("Considering → Preparing");
  await expect(application).toContainText("Started as Considering");
  const timestamps = application.locator(".compact-history time");
  await expect(timestamps).toHaveCount(3);
  await expect(timestamps.first()).toHaveAttribute(
    "datetime",
    "2026-09-03T14:00:00.000Z",
  );
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".application-card")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("mobile pending approval remains explicit before the fixed navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  const snapshot = pipelineFixture();
  const application = snapshot.applications[0];
  if (application === undefined)
    throw new Error("Synthetic pipeline application is unavailable.");
  await routePipeline(page, snapshot, [
    pendingApproval(application.id, application.revision),
  ]);
  await openPipeline(page);

  const card = page.locator(".application-card");
  const approval = card.getByLabel(
    /application transition approval for Platform Engineer/u,
  );
  await expect(approval).toContainText("Agent change approval");
  await expect(approval).toContainText(
    "Move application from considering to preparing",
  );
  await expect(
    approval.getByRole("button", {
      name: /Approve status change for Platform Engineer/u,
    }),
  ).toBeVisible();
  await expect(
    approval.getByRole("button", {
      name: /Keep current status for Platform Engineer/u,
    }),
  ).toBeVisible();
  await expectAboveMobileNavigation(
    page,
    approval.getByText("pending", { exact: true }),
  );
  await expect(approval.locator(".approval-receipt")).toHaveCSS(
    "border-radius",
    "0px",
  );
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include(".application-card")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("long mobile application identity wraps without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await routePipeline(page, pipelineFixture({ opportunityIndex: 49 }));
  await openPipeline(page);
  await expect(
    page.locator(".application-card .application-identity h2"),
  ).toHaveCSS("overflow-wrap", "anywhere");
  await expectNoDocumentOverflow(page);
});

test("retain exact-viewport synthetic pipeline evidence", async ({ page }) => {
  await mkdir(pipelineEvidenceRoot, { recursive: true });
  const snapshot = pipelineFixture();
  await routePipeline(page, snapshot);

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 375, height: 812 },
    { width: 320, height: 812 },
  ] as const) {
    await page.setViewportSize(viewport);
    await openPipeline(page);
    await page.screenshot({
      path: join(
        pipelineEvidenceRoot,
        `pipeline-${String(viewport.width)}x${String(viewport.height)}.png`,
      ),
    });
  }
});
