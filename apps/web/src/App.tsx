import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleGauge,
  Columns3,
  Database,
  Download,
  FileCheck2,
  FileText,
  FilePenLine,
  FolderInput,
  ListPlus,
  Menu,
  Pencil,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import type {
  ApprovalListResponse,
  ApprovalView,
  ArtifactView,
  ComparisonView,
  DomainEventView,
  DiscoveryLeadView,
  EvidenceView,
  EvaluationView,
  JobDiscoveryRunResponse,
  OperationView,
  OpportunityView,
  ProfileOrganizationRunResponse,
  ProfileFactView,
  SearchProfileView,
  ApplicationView,
  SnapshotResponse,
  SourceView,
} from "@career-workbench/contracts";
import {
  ApiError,
  loadDiagnostics,
  loadSnapshot,
  mutate,
  query,
} from "./api.js";

const primaryNav = [
  { to: "/overview", label: "Home", icon: CircleGauge },
  { to: "/profile", label: "Career record", icon: UserRound },
  { to: "/discover", label: "Find roles", icon: Search },
] as const;

const moreJourneyStages = [
  {
    step: "1",
    label: "Career evidence",
    description: "Build a trusted record",
    destinations: [
      {
        to: "/profile",
        label: "Career record",
        description: "Review the experience you approved",
        icon: UserRound,
      },
    ],
  },
  {
    step: "2",
    label: "Find roles",
    description: "Research and save roles",
    destinations: [
      {
        to: "/discover",
        label: "Find roles",
        description: "Search from your evidence and priorities",
        icon: Search,
      },
      {
        to: "/opportunities",
        label: "Saved jobs",
        description: "Review roles you chose to keep",
        icon: BriefcaseBusiness,
      },
    ],
  },
  {
    step: "3",
    label: "Evaluate and compare",
    description: "Check fit and trade-offs",
    destinations: [
      {
        to: "/evaluations",
        label: "Fit analysis",
        description: "See your fit, main concern, and next action",
        icon: FileCheck2,
      },
      {
        to: "/comparisons",
        label: "Compare roles",
        description: "Weigh evaluated roles side by side",
        icon: Scale,
      },
    ],
  },
  {
    step: "4",
    label: "Track progress",
    description: "Keep status and next action clear",
    destinations: [
      {
        to: "/pipeline",
        label: "Application progress",
        description: "Track status after you choose to pursue",
        icon: Columns3,
      },
    ],
  },
  {
    step: "5",
    label: "Prepare materials",
    description: "Create reviewable drafts",
    destinations: [
      {
        to: "/drafts",
        label: "Materials",
        description: "Prepare evidence-grounded drafts",
        icon: FilePenLine,
      },
    ],
  },
] as const;

const moreSupportItems = [
  {
    to: "/imports",
    label: "Import data",
    description: "Bring in supported records",
    icon: FolderInput,
  },
  {
    to: "/activity",
    label: "Agent activity",
    description: "Review work and recovery",
    icon: Activity,
  },
  {
    to: "/settings",
    label: "Preferences",
    description: "Update identity and search direction",
    icon: Settings2,
  },
  {
    to: "/diagnostics",
    label: "System status",
    description: "Check local analysis readiness",
    icon: Database,
  },
] as const;

const moreRoutePaths = new Set([
  "/opportunities",
  "/evaluations",
  "/comparisons",
  "/pipeline",
  "/drafts",
  "/imports",
  "/activity",
  "/settings",
  "/diagnostics",
]);

const pageStories = {
  profile: {
    helps:
      "Build one trusted record so every fit check and draft starts from experience you approved.",
    uses: "Your résumé and experience",
    creates: "Verified career evidence",
    next: { label: "Next: Find roles", to: "/discover" },
  },
  discover: {
    helps:
      "Use your evidence and priorities to focus on roles that deserve your time.",
    uses: "Career evidence and direction",
    creates: "A focused role shortlist",
  },
  opportunities: {
    helps:
      "Preserve the posting you actually saw so later analysis stays tied to its source.",
    uses: "A job posting",
    creates: "A saved opportunity",
  },
  evaluations: {
    helps: "See why this job fits, what supports it, and what remains unknown.",
    uses: "Career evidence + saved job",
    creates: "Explainable fit view",
  },
  comparisons: {
    helps:
      "Compare trade-offs across roles while keeping the final career decision yours.",
    uses: "Evaluated roles and priorities",
    creates: "A decision-ready comparison",
  },
  pipeline: {
    helps:
      "Keep every application state and next move clear without submitting anything for you.",
    uses: "A role you chose to pursue",
    creates: "A clear next action",
  },
  drafts: {
    helps:
      "Prepare reviewable materials grounded only in career evidence you approved.",
    uses: "Verified evidence and fit analysis",
    creates: "A reviewable local draft",
  },
  imports: {
    helps:
      "Bring supported Career Ops records into one durable workbench after a safe preview.",
    uses: "A Career Ops workspace",
    creates: "Selected local records",
  },
  activity: {
    helps:
      "See what changed, what is still running, and where your attention is needed.",
    uses: "Workbench and agent operations",
    creates: "Traceable progress",
  },
  settings: {
    helps:
      "Set the identity and priorities that keep search and matching aligned with your direction.",
    uses: "Your identity and priorities",
    creates: "Consistent search defaults",
  },
  diagnostics: {
    helps:
      "Know whether local research and analysis are ready before you depend on them.",
    uses: "Local service state",
    creates: "A clear recovery step",
  },
} as const;

const productJourney = [
  {
    title: "Career evidence",
    description:
      "Turn the experience you approve into a trusted career record.",
    uses: "Your experience",
    creates: "Verified evidence",
    to: "/profile",
  },
  {
    title: "Find roles",
    description: "Use that record and your direction to focus the search.",
    uses: "Evidence and priorities",
    creates: "Focused roles",
    to: "/discover",
  },
  {
    title: "Evaluate and compare",
    description: "See fit, gaps, and trade-offs without surrendering judgment.",
    uses: "Evidence and postings",
    creates: "Explainable decisions",
    to: "/evaluations",
  },
  {
    title: "Track",
    description: "Keep application states and next moves in one place.",
    uses: "Roles you choose",
    creates: "Clear next actions",
    to: "/pipeline",
  },
  {
    title: "Prepare",
    description:
      "Draft from verified facts, then inspect and approve the result.",
    uses: "Approved evidence",
    creates: "Reviewable materials",
    to: "/drafts",
  },
] as const;

const roleOptions = [
  {
    title: "Software Engineer",
    description: "Build software products and systems",
    signals: ["software", "developer", "programming", "computer science"],
  },
  {
    title: "iOS Developer",
    description: "Create apps for iPhone and iPad",
    signals: ["swift", "ios", "mobile", "apple"],
  },
  {
    title: "Technical Trainer",
    description: "Teach people how to use technical products",
    signals: ["tutor", "teach", "training", "mentor", "education"],
  },
  {
    title: "Customer Success Manager",
    description: "Help customers get value from a product",
    signals: ["customer", "client", "community", "support", "relationship"],
  },
  {
    title: "Community Manager",
    description: "Grow and support an engaged community",
    signals: ["community", "social", "events", "esports", "engagement"],
  },
  {
    title: "Developer Advocate",
    description: "Connect developers, communities, and products",
    signals: ["developer", "community", "teach", "content", "technical"],
  },
  {
    title: "Instructional Designer",
    description: "Design learning programs and materials",
    signals: ["education", "teach", "curriculum", "training", "learning"],
  },
  {
    title: "Technical Support Engineer",
    description: "Solve technical problems for customers",
    signals: ["support", "troubleshoot", "customer", "technical", "software"],
  },
  {
    title: "Solutions Engineer",
    description: "Match technical solutions to customer needs",
    signals: ["client", "technical", "presentation", "software", "sales"],
  },
  {
    title: "Program Manager",
    description: "Coordinate people and long-running initiatives",
    signals: ["program", "coordinate", "operations", "community", "lead"],
  },
  {
    title: "Project Manager",
    description: "Plan and deliver projects across teams",
    signals: ["project", "coordinate", "schedule", "delivery", "lead"],
  },
  {
    title: "Product Manager",
    description: "Guide what a product team builds next",
    signals: ["product", "strategy", "research", "roadmap", "software"],
  },
  {
    title: "Operations Specialist",
    description: "Improve the systems that keep work moving",
    signals: ["operations", "process", "coordinate", "administration"],
  },
  {
    title: "Business Analyst",
    description: "Turn business needs into clear requirements",
    signals: ["analysis", "requirements", "process", "data", "business"],
  },
  {
    title: "Data Analyst",
    description: "Use data to answer business questions",
    signals: ["data", "analytics", "reporting", "research", "excel"],
  },
  {
    title: "Marketing Specialist",
    description: "Create campaigns that reach the right audience",
    signals: ["marketing", "content", "social", "campaign", "brand"],
  },
  {
    title: "UX Designer",
    description: "Make digital products easier to use",
    signals: ["design", "user", "research", "prototype", "product"],
  },
  {
    title: "QA Engineer",
    description: "Improve software quality through testing",
    signals: ["test", "quality", "software", "automation", "technical"],
  },
] as const;

const locationOptions = [
  "Anywhere in the United States",
  "Chicago, IL",
  "New York, NY",
  "San Francisco, CA",
  "Los Angeles, CA",
  "Seattle, WA",
  "Austin, TX",
  "Boston, MA",
  "Denver, CO",
  "Atlanta, GA",
  "Washington, DC",
  "Canada",
  "United Kingdom",
  "Europe",
  "Worldwide",
] as const;

const priorityOptions = [
  "Higher compensation",
  "Work-life balance",
  "Career growth",
  "Remote flexibility",
  "Strong team culture",
  "Learning and mentorship",
  "Mission-driven work",
  "Company stability",
] as const;

const exclusionOptions = [
  "Commission-only roles",
  "Mandatory relocation",
  "Frequent travel",
  "Nights or weekends",
  "Contract-only roles",
  "On-site only",
  "Unclear compensation",
  "Heavy sales quota",
] as const;

function suggestedRoles(
  snapshot: SnapshotResponse,
  queryText: string,
): readonly (typeof roleOptions)[number][] {
  const query = queryText.trim().toLocaleLowerCase();
  const careerText = snapshot.profileFacts
    .filter(
      (fact) =>
        fact.status === "verified" &&
        ["experience", "achievement", "education", "skill"].includes(
          fact.factType,
        ),
    )
    .map((fact) =>
      `${fact.subject} ${fact.predicate} ${String(fact.value)}`.toLocaleLowerCase(),
    )
    .join(" ");
  return roleOptions
    .map((option, originalIndex) => {
      const searchable =
        `${option.title} ${option.description} ${option.signals.join(" ")}`.toLocaleLowerCase();
      const queryScore =
        query.length === 0
          ? 0
          : option.title.toLocaleLowerCase().startsWith(query)
            ? 4
            : option.title.toLocaleLowerCase().includes(query)
              ? 3
              : searchable.includes(query)
                ? 2
                : query
                    .split(/\s+/u)
                    .filter((term) => searchable.includes(term)).length;
      const careerScore = option.signals.filter((signal) =>
        careerText.includes(signal),
      ).length;
      return { option, originalIndex, queryScore, careerScore };
    })
    .filter(({ queryScore }) => query.length === 0 || queryScore > 0)
    .sort(
      (left, right) =>
        right.queryScore - left.queryScore ||
        right.careerScore - left.careerScore ||
        left.originalIndex - right.originalIndex,
    )
    .slice(0, 7)
    .map(({ option }) => option);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed.";
}

function completedProfileOrganizationFactIds(
  snapshot: SnapshotResponse,
): ReadonlySet<string> {
  return new Set(
    snapshot.operations
      .filter(
        (operation) =>
          operation.kind === "profile_organization" &&
          operation.state === "succeeded",
      )
      .flatMap((operation) => operation.resultIds),
  );
}

const MAX_CANDIDATE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CANDIDATE_TEXT_BYTES = 48 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

async function extractCandidateFile(file: File): Promise<{
  readonly mediaType: "application/pdf" | "text/plain";
  readonly bytesBase64: string;
  readonly extractedText: string;
}> {
  if (file.size === 0 || file.size > MAX_CANDIDATE_FILE_BYTES) {
    throw new ApiError(
      400,
      "invalid_request",
      "Choose a non-empty PDF or text file no larger than 5 MB.",
    );
  }
  const lowerName = file.name.toLowerCase();
  const mediaType =
    file.type === "application/pdf" || lowerName.endsWith(".pdf")
      ? "application/pdf"
      : file.type === "text/plain" || lowerName.endsWith(".txt")
        ? "text/plain"
        : null;
  if (mediaType === null) {
    throw new ApiError(
      400,
      "invalid_request",
      "This file type is not supported yet. Choose a PDF or plain-text file.",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extractedText: string;
  if (mediaType === "text/plain") {
    try {
      extractedText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError(
        400,
        "invalid_request",
        "The selected text file is not valid UTF-8.",
      );
    }
  } else {
    const { getDocument, GlobalWorkerOptions } =
      await import("pdfjs-dist/legacy/build/pdf.mjs");
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const loadingTask = getDocument({
      data: bytes.slice(),
      stopAtErrors: true,
      useWorkerFetch: false,
    });
    const document = await loadingTask.promise.catch(async () => {
      await loadingTask.destroy();
      throw new ApiError(
        400,
        "invalid_request",
        "This PDF could not be read. It may be damaged or password protected; paste the résumé text instead.",
      );
    });
    try {
      const pages: string[] = [];
      for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
      ) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replaceAll(/\s+/gu, " ")
            .trim(),
        );
        page.cleanup();
      }
      extractedText = pages.filter((page) => page.length > 0).join("\n");
    } finally {
      await loadingTask.destroy();
    }
  }
  const normalized = extractedText.trim();
  if (normalized.length === 0) {
    throw new ApiError(
      400,
      "invalid_request",
      mediaType === "application/pdf"
        ? "No selectable text was found in this PDF. Paste the résumé text or use Tell my story instead."
        : "The selected text file is empty.",
    );
  }
  if (
    new TextEncoder().encode(normalized).byteLength > MAX_CANDIDATE_TEXT_BYTES
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "The extracted résumé text exceeds the 48 KiB intake limit.",
    );
  }
  return {
    mediaType,
    bytesBase64: bytesToBase64(bytes),
    extractedText: normalized,
  };
}

function useRefresh(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(
    async () => client.invalidateQueries({ queryKey: ["snapshot"] }),
    [client],
  );
}

function ErrorNotice({
  error,
}: {
  readonly error: unknown;
}): React.JSX.Element | null {
  if (error === null || error === undefined) return null;
  return (
    <div className="notice error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <span>{message(error)}</span>
    </div>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  readonly children: React.ReactNode;
  readonly tone?: "neutral" | "good" | "warning";
}): React.JSX.Element {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Empty({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <p className="empty">{children}</p>;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? "";
}

function careerSetupComplete(snapshot: SnapshotResponse): boolean {
  const factsById = new Map(
    snapshot.profileFacts.map((fact) => [fact.id, fact] as const),
  );
  return snapshot.operations.some(
    (operation) =>
      operation.kind === "profile_organization" &&
      operation.state === "succeeded" &&
      operation.resultIds.length > 0 &&
      operation.resultIds.every((factId) => {
        const fact = factsById.get(factId);
        return fact !== undefined && fact.status !== "proposed";
      }),
  );
}

function Onboarding({
  onReady,
}: {
  readonly onReady: () => Promise<void>;
}): React.JSX.Element {
  const [candidateName, setCandidateName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      mutate("/api/v1/workspaces", {
        displayName: "My Career Workbench",
        candidateName,
        deferTargetPreferences: true,
        rubricPreset: "balanced_fit",
        locale: "en-US",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    onSuccess: onReady,
  });
  return (
    <main className="onboarding">
      <section
        className="welcome-card welcome-card-minimal"
        aria-labelledby="welcome-title"
      >
        <div className="brand-mark large" aria-hidden="true">
          CW_
        </div>
        <h1 id="welcome-title">Turn your experience into your next move.</h1>
        <p className="welcome-promise">
          Build a trusted career record, research fitting roles, compare the
          evidence, and prepare your next move. Records are stored in your
          private local workspace; nothing is sent or submitted automatically.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="onboarding-fields">
            <label htmlFor="candidate-name">What’s your name?</label>
            <input
              id="candidate-name"
              value={candidateName}
              onChange={(event) => setCandidateName(event.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              autoFocus
              required
              maxLength={300}
            />
          </div>
          <button
            className="primary"
            disabled={create.isPending || candidateName.trim().length === 0}
            type="submit"
          >
            {create.isPending ? "Starting…" : "Continue"}
            {!create.isPending && <ArrowRight aria-hidden="true" />}
          </button>
        </form>
        <ErrorNotice error={create.error} />
      </section>
    </main>
  );
}

function MoreDestinations({
  firstLinkRef,
  lastLinkRef,
  onNavigate,
  surface,
}: {
  readonly firstLinkRef?: RefObject<HTMLAnchorElement | null>;
  readonly lastLinkRef?: RefObject<HTMLAnchorElement | null>;
  readonly onNavigate: () => void;
  readonly surface: "desktop" | "mobile";
}): React.JSX.Element {
  return (
    <>
      <header className="more-menu-intro">
        <h2 id={`${surface}-more-title`}>Career path</h2>
        <p id={`${surface}-more-description`} className="sr-only">
          Five ordered stages followed by optional workspace support.
        </p>
      </header>
      <div className="more-menu-groups">
        <section
          className="more-journey-group"
          aria-labelledby={`${surface}-more-journey-title`}
        >
          <h2 id={`${surface}-more-journey-title`} className="sr-only">
            Career journey
          </h2>
          <ol className="more-stage-list">
            {moreJourneyStages.map((stage) => (
              <li className="more-stage" key={stage.step}>
                <div className="more-stage-heading">
                  <span className="more-step" aria-hidden="true">
                    {stage.step}
                  </span>
                  <h3 className="sr-only">
                    <span className="sr-only">Stage {stage.step} of 5: </span>
                    {stage.label}
                  </h3>
                  <small className="sr-only">{stage.description}</small>
                </div>
                <div className="more-stage-actions">
                  {stage.destinations.map(
                    ({ to, label, description, icon: Icon }) => {
                      const descriptionId = `${surface}-more-${to.slice(1)}-description`;
                      return (
                        <NavLink
                          key={to}
                          ref={to === "/profile" ? firstLinkRef : undefined}
                          to={to}
                          aria-label={label}
                          aria-describedby={descriptionId}
                          onClick={onNavigate}
                        >
                          <Icon aria-hidden="true" />
                          <span className="more-destination-copy">
                            <strong>{label}</strong>
                            <small id={descriptionId} className="sr-only">
                              {description}
                            </small>
                          </span>
                          <span
                            className="more-current-label"
                            aria-hidden="true"
                          >
                            Current
                          </span>
                        </NavLink>
                      );
                    },
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="more-support-group"
          aria-labelledby={`${surface}-more-support-title`}
        >
          <header className="more-group-heading">
            <h2 id={`${surface}-more-support-title`}>Workspace support</h2>
          </header>
          <div className="more-support-grid">
            {moreSupportItems.map(({ to, label, description, icon: Icon }) => {
              const descriptionId = `${surface}-more-${to.slice(1)}-description`;
              return (
                <NavLink
                  key={to}
                  ref={to === "/diagnostics" ? lastLinkRef : undefined}
                  to={to}
                  aria-label={label}
                  aria-describedby={descriptionId}
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" />
                  <span className="more-destination-copy">
                    <strong>{label}</strong>
                    <small id={descriptionId} className="sr-only">
                      {description}
                    </small>
                  </span>
                  <span className="more-current-label" aria-hidden="true">
                    Current
                  </span>
                </NavLink>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function Layout({
  snapshot,
  streamState,
}: {
  readonly snapshot: SnapshotResponse;
  readonly streamState: string;
}): React.JSX.Element {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const desktopMoreRef = useRef<HTMLDetailsElement>(null);
  const desktopMoreSummaryRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMoreLinkRef = useRef<HTMLAnchorElement>(null);
  const lastMoreLinkRef = useRef<HTMLAnchorElement>(null);
  const moreRouteIsActive = moreRoutePaths.has(location.pathname);
  const setupComplete = careerSetupComplete(snapshot);
  useEffect(() => {
    if (mobileMenuOpen) firstMoreLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (mobileMenuOpen && event.key === "Tab") {
        if (event.shiftKey && event.target === firstMoreLinkRef.current) {
          event.preventDefault();
          lastMoreLinkRef.current?.focus();
        } else if (
          !event.shiftKey &&
          event.target === lastMoreLinkRef.current
        ) {
          event.preventDefault();
          firstMoreLinkRef.current?.focus();
        }
        return;
      }
      if (event.key !== "Escape") return;
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        window.requestAnimationFrame(() => moreButtonRef.current?.focus());
        return;
      }
      if (desktopMoreRef.current?.open === true) {
        desktopMoreRef.current.open = false;
        desktopMoreSummaryRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);
  return (
    <div className={`shell${setupComplete ? "" : " guided-shell"}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {setupComplete ? (
        <aside className="sidebar">
          <header className="brand">
            <Link
              className="brand-home"
              to="/overview"
              aria-label="Go to overview"
            >
              <span className="brand-mark" aria-hidden="true">
                CW_
              </span>
              <span className="brand-copy">
                <strong>Career Workbench</strong>
                <small>Evidence-backed career decisions.</small>
              </span>
            </Link>
          </header>
          <div
            className="workspace-identity"
            aria-label={`Current workbench: ${snapshot.workspace?.displayName ?? "Local workbench"}`}
            title={snapshot.workspace?.displayName ?? "Local workbench"}
          >
            <strong>
              {snapshot.workspace?.displayName ?? "Local workbench"}
            </strong>
            <small>Local records · private · nothing sent automatically</small>
          </div>
          <nav className="desktop-primary-nav" aria-label="Primary">
            {primaryNav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <details ref={desktopMoreRef} className="desktop-more-nav">
              <summary
                ref={desktopMoreSummaryRef}
                className={moreRouteIsActive ? "active" : ""}
              >
                <Menu aria-hidden="true" />
                <span>More</span>
              </summary>
              <div
                className="more-menu"
                role="region"
                aria-labelledby="desktop-more-title"
                aria-describedby="desktop-more-description"
              >
                <MoreDestinations
                  surface="desktop"
                  onNavigate={() => {
                    if (desktopMoreRef.current !== null)
                      desktopMoreRef.current.open = false;
                  }}
                />
              </div>
            </details>
          </nav>
          <div className="sidebar-foot">
            <span className={`stream-dot ${streamState}`} aria-hidden="true" />
            <span>Activity {streamState}</span>
          </div>
          <nav
            className="mobile-primary-nav"
            aria-label="Mobile primary"
            inert={mobileMenuOpen}
          >
            {primaryNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <button
              ref={moreButtonRef}
              className={`mobile-more-trigger${moreRouteIsActive ? " active" : ""}`}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-more-destinations"
              aria-current={moreRouteIsActive ? "page" : undefined}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu aria-hidden="true" />
              <span>More</span>
            </button>
          </nav>
          {mobileMenuOpen && (
            <div
              className="mobile-more-panel"
              id="mobile-more-destinations"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-title"
              aria-describedby="mobile-more-description"
            >
              <nav aria-label="More destinations">
                <MoreDestinations
                  surface="mobile"
                  firstLinkRef={firstMoreLinkRef}
                  lastLinkRef={lastMoreLinkRef}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </nav>
            </div>
          )}
        </aside>
      ) : (
        <header className="guided-header">
          <Link
            className="guided-brand"
            to="/overview"
            aria-label="Go to setup"
          >
            <span aria-hidden="true">CW_</span>
            <span className="brand-copy">
              <strong>Career Workbench</strong>
              <small>Evidence-backed career decisions.</small>
            </span>
          </Link>
        </header>
      )}
      <main
        className="content"
        id="main-content"
        inert={mobileMenuOpen}
        tabIndex={-1}
        onFocusCapture={(event) => {
          if (!window.matchMedia("(max-width: 720px)").matches) return;
          const focused = event.target;
          if (!(focused instanceof HTMLElement)) return;
          window.requestAnimationFrame(() => {
            const footer = document.querySelector<HTMLElement>(".sidebar");
            if (footer === null) return;
            const overlap =
              focused.getBoundingClientRect().bottom +
              6 -
              footer.getBoundingClientRect().top;
            if (overlap > 0) window.scrollBy({ top: overlap + 10 });
          });
        }}
      >
        <Routes>
          <Route path="/overview" element={<Overview snapshot={snapshot} />} />
          <Route path="/profile" element={<Profile snapshot={snapshot} />} />
          <Route path="/discover" element={<Discover snapshot={snapshot} />} />
          <Route
            path="/opportunities"
            element={<Opportunities snapshot={snapshot} />}
          />
          <Route
            path="/evaluations"
            element={<Evaluations snapshot={snapshot} />}
          />
          <Route
            path="/comparisons"
            element={<Comparisons snapshot={snapshot} />}
          />
          <Route path="/imports" element={<Imports snapshot={snapshot} />} />
          <Route path="/pipeline" element={<Pipeline snapshot={snapshot} />} />
          <Route path="/drafts" element={<Drafts snapshot={snapshot} />} />
          <Route
            path="/activity"
            element={
              <ActivityPage snapshot={snapshot} streamState={streamState} />
            }
          />
          <Route path="/settings" element={<Settings snapshot={snapshot} />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<Navigate replace to="/overview" />} />
        </Routes>
      </main>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  story,
  journeyStep,
  className,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly story?: {
    readonly helps: string;
    readonly uses: string;
    readonly creates: string;
    readonly next?: { readonly label: string; readonly to: string };
  };
  readonly journeyStep?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <header className={["page-header", className].filter(Boolean).join(" ")}>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      {story !== undefined && (
        <>
          <JourneyRail journeyStep={journeyStep} />
          <section className="page-story" aria-label="How this page helps">
            <div className="page-story-benefit">
              <span>How this helps</span>
              <p>{story.helps}</p>
              {story.next !== undefined && (
                <Link className="page-story-next" to={story.next.to}>
                  {story.next.label} <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>
            <div
              className="page-story-flow"
              aria-label={`${story.uses} becomes ${story.creates}`}
            >
              <span>
                <small>Uses</small>
                <strong>{story.uses}</strong>
              </span>
              <ArrowRight aria-hidden="true" />
              <span>
                <small>Creates</small>
                <strong>{story.creates}</strong>
              </span>
            </div>
          </section>
        </>
      )}
    </header>
  );
}

function JourneyRail({
  journeyStep,
}: {
  readonly journeyStep: number | undefined;
}): React.JSX.Element {
  return (
    <nav className="journey-rail" aria-label="Career workflow">
      {productJourney.map((step, index) => (
        <Link
          key={step.title}
          to={step.to}
          aria-current={journeyStep === index + 1 ? "step" : undefined}
        >
          <span>{index + 1}</span>
          {step.title}
        </Link>
      ))}
    </nav>
  );
}

function ProgressiveDetails({
  summary,
  hint,
  children,
  className = "",
  summaryLabel,
  closedCue,
  openCue = "Close",
}: {
  readonly summary: string;
  readonly hint: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly summaryLabel?: string;
  readonly closedCue?: string;
  readonly openCue?: string;
}): React.JSX.Element {
  return (
    <details
      className={`progressive-details${closedCue === undefined ? "" : " has-disclosure-cue"}${className.length > 0 ? ` ${className}` : ""}`}
    >
      <summary aria-label={summaryLabel}>
        <span>{summary}</span>
        <small>{hint}</small>
        {closedCue !== undefined && (
          <DisclosureCue closedLabel={closedCue} openLabel={openCue} />
        )}
      </summary>
      <div className="progressive-details-body">{children}</div>
    </details>
  );
}

function TaskDisclosure({
  collapsed,
  summary,
  hint,
  children,
  closedCue,
  openCue = "Close",
}: {
  readonly collapsed: boolean;
  readonly summary: string;
  readonly hint: string;
  readonly children: React.ReactNode;
  readonly closedCue?: string;
  readonly openCue?: string;
}): React.JSX.Element {
  if (!collapsed) return <>{children}</>;
  return (
    <details className="task-disclosure">
      <summary>
        <span>
          <strong>{summary}</strong>
          <small>{hint}</small>
        </span>
        {closedCue !== undefined && (
          <DisclosureCue closedLabel={closedCue} openLabel={openCue} />
        )}
      </summary>
      <div className="task-disclosure-body">{children}</div>
    </details>
  );
}

function DisclosureCue({
  closedLabel,
  openLabel,
}: {
  readonly closedLabel: string;
  readonly openLabel: string;
}): React.JSX.Element {
  return (
    <span className="disclosure-cue">
      <span className="disclosure-cue-closed">{closedLabel}</span>
      <span className="disclosure-cue-open">{openLabel}</span>
      <ChevronDown aria-hidden="true" />
    </span>
  );
}

function Overview({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: loadDiagnostics,
  });
  const verifiedCareerHistory = snapshot.profileFacts.filter(
    (fact) =>
      fact.status === "verified" &&
      (fact.factType === "experience" || fact.factType === "achievement"),
  ).length;
  const candidateName = String(
    snapshot.profileFacts.find(
      (fact) => fact.factType === "identity" && fact.status === "verified",
    )?.value ?? "",
  );
  const candidateFirstName = firstName(candidateName);
  const setupComplete = careerSetupComplete(snapshot);
  const onboardingSourceIds = new Set(
    snapshot.profileFacts
      .filter(
        (fact) =>
          fact.factType === "identity" || fact.factType === "preference",
      )
      .flatMap((fact) =>
        fact.sourceLocators.map((locator) => locator.sourceId),
      ),
  );
  const careerSources = snapshot.sources.filter(
    (source) =>
      source.kind === "candidate" && !onboardingSourceIds.has(source.id),
  );
  const completedOrganizerFactIds =
    completedProfileOrganizationFactIds(snapshot);
  const proposedCareerFacts = snapshot.profileFacts.filter(
    (fact) =>
      fact.status === "proposed" &&
      (fact.factType === "experience" ||
        fact.factType === "achievement" ||
        fact.factType === "education" ||
        fact.factType === "skill") &&
      (fact.proposedBy !== "agent" || completedOrganizerFactIds.has(fact.id)),
  );
  const latestCareerSource = careerSources.at(-1);
  const activeSearchProfile = snapshot.searchProfiles.find(
    (profile) => profile.active,
  );
  const currentJourneyStep =
    verifiedCareerHistory === 0
      ? 0
      : activeSearchProfile === undefined
        ? 1
        : snapshot.discoveryLeads.length === 0 &&
            snapshot.opportunities.length === 0
          ? 1
          : snapshot.evaluations.length === 0
            ? 2
            : snapshot.applications.length === 0
              ? 3
              : 4;
  const organizerOperation = [...snapshot.operations]
    .reverse()
    .find(
      (operation) =>
        operation.kind === "profile_organization" &&
        operation.inputIdentity === latestCareerSource?.id,
    );
  const candidateOutputs = snapshot.artifacts.filter(
    (artifact) => !artifact.kind.endsWith("_source_bytes"),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [careerStory, setCareerStory] = useState("");
  const [careerInputMode, setCareerInputMode] = useState<
    "upload" | "resume" | "story"
  >("upload");
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);
  const [targetRole, setTargetRole] = useState("");
  const [roleSuggestionsOpen, setRoleSuggestionsOpen] = useState(false);
  const [activeRoleSuggestionIndex, setActiveRoleSuggestionIndex] = useState(0);
  const availableRoleSuggestions = suggestedRoles(snapshot, targetRole);
  const highlightedRoleSuggestionIndex = Math.min(
    activeRoleSuggestionIndex,
    Math.max(availableRoleSuggestions.length - 1, 0),
  );
  const captureCareerStory = useMutation({
    mutationFn: () => {
      const text = careerStory.trim();
      if (text.length === 0)
        throw new ApiError(
          400,
          "invalid_request",
          "Paste a résumé or tell us something about your work first.",
        );
      return mutate<SourceView>("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text,
        originalLocator:
          careerInputMode === "resume"
            ? "user-entry://career-history/resume"
            : "user-entry://career-history/story",
      });
    },
    onSuccess: async () => {
      setCareerStory("");
      await refresh();
    },
  });
  const uploadCandidateFile = useMutation({
    mutationFn: async () => {
      if (candidateFile === null) {
        throw new ApiError(
          400,
          "invalid_request",
          "Choose a PDF or text résumé file first.",
        );
      }
      const extracted = await extractCandidateFile(candidateFile);
      return mutate<SourceView>("/api/v1/sources/upload", extracted);
    },
    onSuccess: async () => {
      setCandidateFile(null);
      if (candidateFileInputRef.current !== null) {
        candidateFileInputRef.current.value = "";
      }
      await refresh();
    },
  });
  const saveSearchDirection = useMutation({
    mutationFn: (direction: string) =>
      mutate<SearchProfileView>("/api/v1/search-profiles", {
        ...(snapshot.searchProfiles[0] === undefined
          ? {}
          : { expectedRevision: snapshot.searchProfiles[0].revision }),
        targetRoles: [direction],
        seniority: ["flexible"],
        locations: [],
        workArrangements: ["remote", "hybrid"],
        priorities: [],
        exclusions: [],
        active: true,
      }),
    onSuccess: refresh,
  });
  const organizeCareerSource = useMutation({
    mutationFn: () => {
      if (latestCareerSource === undefined) {
        throw new ApiError(
          400,
          "invalid_request",
          "Save your résumé or career story first.",
        );
      }
      return mutate<ProfileOrganizationRunResponse>(
        "/api/v1/profile-organizations",
        { sourceId: latestCareerSource.id },
      );
    },
    onSuccess: refresh,
  });
  const exportableArtifacts = candidateOutputs.filter(
    (artifact) => artifact.state === "sealed" || artifact.state === "stale",
  );
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<
    readonly string[]
  >([]);
  const search = useMutation({
    mutationFn: () =>
      query<{
        readonly results: readonly {
          readonly kind: string;
          readonly id: string;
          readonly label: string;
          readonly state: string;
        }[];
      }>(`/api/v1/search?q=${encodeURIComponent(searchTerm)}`),
  });
  const download = useMutation({
    mutationFn: () =>
      mutate<Readonly<Record<string, unknown>>>("/api/v1/export", {
        selectedArtifactIds,
      }),
    onSuccess: (body) => {
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "career-workbench-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  return (
    <>
      <div className="overview-intro">
        <PageHeader
          eyebrow={
            candidateFirstName.length > 0
              ? `Your workflow · Welcome, ${candidateFirstName}`
              : "Your workflow"
          }
          title="Make your next move with evidence, not guesswork."
          description="Career Workbench turns the experience you approve into focused role research, explainable decisions, organized applications, and reviewable materials—with local records and user-controlled actions."
        />
      </div>
      <section className="product-journey" aria-labelledby="journey-title">
        <header>
          <div>
            <p className="eyebrow">How Career Workbench works</p>
            <h2 id="journey-title">
              One evidence trail. Five clearer decisions.
            </h2>
            <p>
              Each step reuses what you approved, so the work gets more useful
              without becoming harder to trust.
            </p>
          </div>
          <div className="journey-boundary">
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>Records stay local and private.</strong> AI runs only when
              you start it; nothing is submitted automatically.
            </span>
          </div>
        </header>
        <ol>
          {productJourney.map((step, index) => (
            <li
              key={step.title}
              className={
                index < currentJourneyStep
                  ? "complete"
                  : index === currentJourneyStep
                    ? "current"
                    : ""
              }
              aria-current={index === currentJourneyStep ? "step" : undefined}
            >
              <span className="journey-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className="journey-flow">
                  <span>{step.uses}</span>
                  <ArrowRight aria-hidden="true" />
                  <strong>{step.creates}</strong>
                </div>
              </div>
              <Link to={step.to}>
                {index === currentJourneyStep ? "Continue here" : "Open"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section className="focus-card" aria-labelledby="focus-title">
        <header className="focus-card-head">
          <div>
            <p className="eyebrow">Your next move</p>
            <h2 id="focus-title">
              {careerSources.length === 0
                ? "Add your résumé or career story"
                : proposedCareerFacts.length > 0
                  ? "Check the AI summary"
                  : verifiedCareerHistory === 0
                    ? "Let AI organize what you shared"
                    : activeSearchProfile === undefined
                      ? "What kind of role should we look for?"
                      : snapshot.discoveryLeads.length === 0 &&
                          snapshot.opportunities.length === 0
                        ? "Find roles that fit your direction"
                        : "Review the roles you found"}
            </h2>
          </div>
        </header>

        {careerSources.length === 0 ? (
          <div className="quick-career-intake">
            <div
              className="quick-career-choice"
              role="group"
              aria-label="Choose how to add your career history"
            >
              <button
                type="button"
                aria-label="Upload résumé"
                aria-pressed={careerInputMode === "upload"}
                onClick={() => setCareerInputMode("upload")}
              >
                <FileText aria-hidden="true" /> Upload file
              </button>
              <button
                type="button"
                aria-label="Paste résumé"
                aria-pressed={careerInputMode === "resume"}
                onClick={() => setCareerInputMode("resume")}
              >
                <FileText aria-hidden="true" /> Paste text
              </button>
              <button
                type="button"
                aria-pressed={careerInputMode === "story"}
                onClick={() => setCareerInputMode("story")}
              >
                <Sparkles aria-hidden="true" /> Tell my story
              </button>
            </div>
            {careerInputMode === "upload" ? (
              <form
                className="resume-file-upload"
                onSubmit={(event) => {
                  event.preventDefault();
                  uploadCandidateFile.mutate();
                }}
              >
                <div>
                  <FileText aria-hidden="true" />
                  <div>
                    <label htmlFor="quick-resume-file">
                      Choose your résumé
                    </label>
                    <p>PDF or text · 5 MB max</p>
                  </div>
                </div>
                <input
                  ref={candidateFileInputRef}
                  id="quick-resume-file"
                  aria-label="Upload a résumé file"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={(event) =>
                    setCandidateFile(event.target.files?.[0] ?? null)
                  }
                />
                {candidateFile !== null && (
                  <p className="selected-file" role="status">
                    {candidateFile.name} ·{" "}
                    {(candidateFile.size / 1024).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    KB
                  </p>
                )}
                <button
                  className="primary"
                  type="submit"
                  disabled={
                    candidateFile === null || uploadCandidateFile.isPending
                  }
                >
                  {uploadCandidateFile.isPending
                    ? "Reading résumé…"
                    : "Upload and continue"}
                  {!uploadCandidateFile.isPending && (
                    <ArrowRight aria-hidden="true" />
                  )}
                </button>
                <ErrorNotice error={uploadCandidateFile.error} />
              </form>
            ) : (
              <form
                className="quick-career-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  captureCareerStory.mutate();
                }}
              >
                <label htmlFor="quick-career-story">
                  {careerInputMode === "resume"
                    ? "Paste your résumé text"
                    : "Tell us what you’ve done"}
                </label>
                <textarea
                  id="quick-career-story"
                  value={careerStory}
                  onChange={(event) => setCareerStory(event.target.value)}
                  placeholder={
                    careerInputMode === "resume"
                      ? "Paste the text from your résumé."
                      : "Roles, projects, and results. Rough notes are fine."
                  }
                  rows={7}
                  maxLength={49_152}
                  required
                />
                <p className="field-help">
                  Saved locally. You’ll choose which AI-organized details to
                  keep.
                </p>
                <button
                  className="primary"
                  type="submit"
                  disabled={captureCareerStory.isPending}
                >
                  {captureCareerStory.isPending
                    ? "Saving…"
                    : "Save and continue"}
                  {!captureCareerStory.isPending && (
                    <ArrowRight aria-hidden="true" />
                  )}
                </button>
                <ErrorNotice error={captureCareerStory.error} />
              </form>
            )}
          </div>
        ) : proposedCareerFacts.length > 0 ? (
          <div className="focus-action">
            <p>
              {proposedCareerFacts.length} AI-organized{" "}
              {proposedCareerFacts.length === 1 ? "detail is" : "details are"}{" "}
              ready. You choose what stays in your career record.
            </p>
            <Link
              className="button-link primary"
              to="/profile#profile-summary-review"
            >
              Review the summary <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : verifiedCareerHistory === 0 ? (
          <div className="focus-action">
            <p>
              Your source is saved. Let AI turn it into a summary you control.
            </p>
            <div className="focus-action-row">
              <button
                className="primary"
                type="button"
                onClick={() => organizeCareerSource.mutate()}
                disabled={
                  diagnostics.isLoading ||
                  diagnostics.data?.capabilities["dsh"] !== true ||
                  organizeCareerSource.isPending
                }
              >
                <Sparkles aria-hidden="true" />
                {organizeCareerSource.isPending
                  ? "Organizing your résumé…"
                  : "Continue with AI"}
              </button>
              <StatusPill
                tone={
                  diagnostics.data?.capabilities["dsh"] === true
                    ? "good"
                    : "warning"
                }
              >
                {diagnostics.data?.capabilities["dsh"] === true
                  ? "AI ready"
                  : "AI unavailable"}
              </StatusPill>
            </div>
            <p className="ai-action-boundary">
              Starting AI sends this source to your configured provider through
              the local agent service. You review every proposed detail before
              it enters your record.
            </p>
            {organizerOperation !== undefined && (
              <p className="operation-note">
                Latest organization run:{" "}
                {organizerOperation.state.replaceAll("_", " ")}.
              </p>
            )}
            {organizeCareerSource.isPending && (
              <div className="ai-run-progress" role="status" aria-live="polite">
                <RefreshCw className="spin" aria-hidden="true" />
                <div>
                  <strong>AI is organizing your source in this window.</strong>
                  <p>You’ll choose what to keep when it is ready.</p>
                </div>
              </div>
            )}
            {organizeCareerSource.data?.proposedFactIds.length === 0 && (
              <div className="notice warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <span>
                  AI finished but found no clear career details in this source.
                  Add clearer résumé text or organize it manually.
                </span>
              </div>
            )}
            <ErrorNotice error={organizeCareerSource.error} />
            <Link to="/profile">Or organize it manually</Link>
          </div>
        ) : activeSearchProfile === undefined ? (
          <div className="focus-action">
            <p>
              Start typing, or choose a role suggested from your experience.
            </p>
            <form
              className="quick-direction-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveSearchDirection.mutate(targetRole.trim());
              }}
            >
              <label htmlFor="quick-target-role">Role</label>
              <div className="quick-direction-row">
                <div
                  className="role-suggestion-combobox"
                  onBlur={(event) => {
                    if (
                      !(event.relatedTarget instanceof Node) ||
                      !event.currentTarget.contains(event.relatedTarget)
                    ) {
                      setRoleSuggestionsOpen(false);
                    }
                  }}
                >
                  <div className="role-suggestion-input">
                    <Search aria-hidden="true" />
                    <input
                      id="quick-target-role"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={
                        roleSuggestionsOpen &&
                        availableRoleSuggestions.length > 0
                      }
                      aria-controls="role-suggestions"
                      aria-activedescendant={
                        roleSuggestionsOpen &&
                        availableRoleSuggestions.length > 0
                          ? `role-suggestion-${String(highlightedRoleSuggestionIndex)}`
                          : undefined
                      }
                      value={targetRole}
                      onFocus={() => {
                        setActiveRoleSuggestionIndex(0);
                        setRoleSuggestionsOpen(true);
                      }}
                      onChange={(event) => {
                        setTargetRole(event.target.value);
                        setActiveRoleSuggestionIndex(0);
                        setRoleSuggestionsOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (availableRoleSuggestions.length === 0) return;
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setActiveRoleSuggestionIndex((current) =>
                            roleSuggestionsOpen
                              ? (current + 1) % availableRoleSuggestions.length
                              : 0,
                          );
                          setRoleSuggestionsOpen(true);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setActiveRoleSuggestionIndex((current) =>
                            roleSuggestionsOpen
                              ? (current -
                                  1 +
                                  availableRoleSuggestions.length) %
                                availableRoleSuggestions.length
                              : availableRoleSuggestions.length - 1,
                          );
                          setRoleSuggestionsOpen(true);
                        } else if (
                          event.key === "Enter" &&
                          roleSuggestionsOpen
                        ) {
                          const suggestion =
                            availableRoleSuggestions[
                              highlightedRoleSuggestionIndex
                            ];
                          if (suggestion !== undefined) {
                            event.preventDefault();
                            setTargetRole(suggestion.title);
                            setRoleSuggestionsOpen(false);
                          }
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setRoleSuggestionsOpen(false);
                        }
                      }}
                      placeholder="Start typing a role"
                      autoComplete="off"
                      required
                      maxLength={300}
                    />
                  </div>
                  {roleSuggestionsOpen &&
                    availableRoleSuggestions.length > 0 && (
                      <ul
                        className="role-suggestions"
                        id="role-suggestions"
                        role="listbox"
                        aria-label="Suggested roles"
                      >
                        {availableRoleSuggestions.map((suggestion, index) => (
                          <li
                            id={`role-suggestion-${String(index)}`}
                            key={suggestion.title}
                            role="option"
                            aria-selected={
                              index === highlightedRoleSuggestionIndex
                            }
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setTargetRole(suggestion.title);
                              setRoleSuggestionsOpen(false);
                            }}
                          >
                            <strong>{suggestion.title}</strong>
                            <small>{suggestion.description}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
                <button
                  className="primary"
                  type="submit"
                  disabled={
                    saveSearchDirection.isPending ||
                    targetRole.trim().length === 0
                  }
                >
                  Use this role
                </button>
              </div>
            </form>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                saveSearchDirection.mutate(
                  "Explore roles aligned with my confirmed experience",
                )
              }
              disabled={saveSearchDirection.isPending}
            >
              I’m not sure yet
            </button>
            <ErrorNotice error={saveSearchDirection.error} />
          </div>
        ) : snapshot.discoveryLeads.length === 0 &&
          snapshot.opportunities.length === 0 ? (
          <div className="focus-action">
            <p>Your search direction is ready.</p>
            <Link className="button-link primary" to="/discover">
              Find matching roles <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="focus-action">
            <p>
              {snapshot.discoveryLeads.length} found ·{" "}
              {snapshot.opportunities.length} shortlisted
            </p>
            <Link className="button-link primary" to="/discover">
              Review jobs <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
      {setupComplete && (
        <details className="workspace-tools-details">
          <summary>Search or export your records</summary>
          <div className="two-column workspace-tools">
            <section className="panel">
              <h2>Search records</h2>
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  search.mutate();
                }}
              >
                <label htmlFor="workspace-search">
                  Search term
                  <input
                    id="workspace-search"
                    type="search"
                    minLength={2}
                    maxLength={100}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" disabled={search.isPending}>
                  <Search aria-hidden="true" /> Search
                </button>
              </form>
              <ul className="search-results" aria-live="polite">
                {search.data?.results.map((result) => (
                  <li key={`${result.kind}-${result.id}`}>
                    <div>
                      <strong>{result.label}</strong>
                      <small>{result.kind}</small>
                    </div>
                    <StatusPill>{result.state}</StatusPill>
                  </li>
                ))}
              </ul>
              <ErrorNotice error={search.error} />
            </section>
            <section className="panel export-panel">
              <h2>Export workspace</h2>
              <p>
                Download a credential-free copy of your canonical workspace.
              </p>
              {exportableArtifacts.length > 0 ? (
                <fieldset className="export-artifact-list">
                  <legend>Include artifact bytes</legend>
                  {exportableArtifacts.map((artifact) => (
                    <label key={artifact.id}>
                      <input
                        type="checkbox"
                        checked={selectedArtifactIds.includes(artifact.id)}
                        onChange={(event) =>
                          setSelectedArtifactIds((current) =>
                            event.target.checked
                              ? [...current, artifact.id]
                              : current.filter((id) => id !== artifact.id),
                          )
                        }
                      />
                      <span>
                        {artifact.kind.replaceAll("_", " ")} · {artifact.state}
                        <small>
                          {artifact.byteLength.toLocaleString()} bytes · digest{" "}
                          {artifact.contentDigest.slice(0, 12)}…
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <small>
                  No sealed artifact bytes are available to include yet.
                </small>
              )}
              <button
                className="secondary"
                type="button"
                onClick={() => download.mutate()}
                disabled={download.isPending}
              >
                <Download aria-hidden="true" />
                {download.isPending
                  ? "Preparing…"
                  : selectedArtifactIds.length === 0
                    ? "Download workspace JSON"
                    : `Download with ${String(selectedArtifactIds.length)} artifact${selectedArtifactIds.length === 1 ? "" : "s"}`}
              </button>
              <ErrorNotice error={download.error} />
            </section>
          </div>
        </details>
      )}
    </>
  );
}

function affectedOutputCount(
  snapshot: SnapshotResponse,
  factId: string,
): number {
  const factEvidenceIds = new Set(
    snapshot.evidence
      .filter((item) => item.candidateFactId === factId)
      .map((item) => item.id),
  );
  const affectedEvaluationIds = new Set(
    snapshot.evaluations
      .filter((evaluation) =>
        evaluation.acceptedEvidenceIds.some((id) => factEvidenceIds.has(id)),
      )
      .map((evaluation) => evaluation.id),
  );
  const affectedArtifactCount = snapshot.artifacts.filter(
    (artifact) =>
      artifact.factIds.includes(factId) ||
      artifact.evidenceIds.some((id) => factEvidenceIds.has(id)) ||
      artifact.evaluationIds.some((id) => affectedEvaluationIds.has(id)),
  ).length;
  return affectedEvaluationIds.size + affectedArtifactCount;
}

const careerFactSections = [
  { factType: "experience", label: "Experience" },
  { factType: "achievement", label: "Achievements" },
  { factType: "education", label: "Education" },
  { factType: "skill", label: "Skills" },
] as const;

interface CareerRecordDisclosure {
  readonly factId: string;
  readonly kind: "edit" | "source";
}

function CareerFactCollection({
  facts,
  snapshot,
  showStatus = false,
}: {
  readonly facts: readonly ProfileFactView[];
  readonly snapshot: SnapshotResponse;
  readonly showStatus?: boolean;
}): React.JSX.Element {
  const [activeDisclosure, setActiveDisclosure] =
    useState<CareerRecordDisclosure | null>(null);
  const knownFactTypes = new Set(
    careerFactSections.map((section) => section.factType as string),
  );
  const groups = [
    ...careerFactSections.map((section) => ({
      ...section,
      facts: facts.filter((fact) => fact.factType === section.factType),
    })),
    {
      factType: "other",
      label: "Other",
      facts: facts.filter((fact) => !knownFactTypes.has(fact.factType)),
    },
  ].filter((section) => section.facts.length > 0);
  return (
    <div className="career-fact-groups">
      {groups.map((group) => {
        const visible = group.facts.slice(0, 3);
        const additional = group.facts.slice(3);
        return (
          <section
            className="career-fact-group"
            aria-labelledby={`career-fact-group-${group.factType}${showStatus ? "-history" : ""}`}
            key={group.factType}
          >
            <header>
              <h3
                id={`career-fact-group-${group.factType}${showStatus ? "-history" : ""}`}
              >
                {group.label}
              </h3>
              <span>{group.facts.length}</span>
            </header>
            <div className="career-fact-rows">
              {visible.map((fact) => (
                <FactCard
                  key={fact.id}
                  fact={fact}
                  sources={snapshot.sources}
                  affectedOutputs={affectedOutputCount(snapshot, fact.id)}
                  recordRow
                  showStatus={showStatus}
                  recordDisclosure={activeDisclosure}
                  onRecordDisclosureChange={setActiveDisclosure}
                />
              ))}
              {additional.length > 0 && (
                <details className="career-fact-overflow">
                  <summary>
                    <span className="career-more-closed">
                      Show {additional.length} more
                    </span>
                    <span className="career-more-open">
                      Hide additional details
                    </span>
                  </summary>
                  <div className="career-fact-rows">
                    {additional.map((fact) => (
                      <FactCard
                        key={fact.id}
                        fact={fact}
                        sources={snapshot.sources}
                        affectedOutputs={affectedOutputCount(snapshot, fact.id)}
                        recordRow
                        showStatus={showStatus}
                        recordDisclosure={activeDisclosure}
                        onRecordDisclosureChange={setActiveDisclosure}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Profile({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const verifiedIdentityName = String(
    snapshot.profileFacts.find(
      (fact) => fact.factType === "identity" && fact.status === "verified",
    )?.value ?? "",
  );
  const setupSourceIds = new Set(
    snapshot.profileFacts
      .filter(
        (fact) =>
          fact.factType === "identity" || fact.factType === "preference",
      )
      .flatMap((fact) =>
        fact.sourceLocators.map((locator) => locator.sourceId),
      ),
  );
  const careerSources = snapshot.sources.filter(
    (source) => source.kind === "candidate" && !setupSourceIds.has(source.id),
  );
  const completedOrganizerFactIds =
    completedProfileOrganizationFactIds(snapshot);
  const visibleCareerFacts = snapshot.profileFacts.filter(
    (fact) =>
      fact.factType !== "identity" &&
      fact.factType !== "preference" &&
      !(
        fact.status === "proposed" &&
        fact.proposedBy === "agent" &&
        !completedOrganizerFactIds.has(fact.id)
      ),
  );
  const proposedCareerFacts = visibleCareerFacts.filter(
    (fact) => fact.status === "proposed",
  );
  const verifiedCareerFacts = visibleCareerFacts.filter(
    (fact) => fact.status === "verified",
  );
  const historicalCareerFacts = visibleCareerFacts.filter(
    (fact) => fact.status !== "proposed" && fact.status !== "verified",
  );
  const setupComplete = careerSetupComplete(snapshot);
  const guidedSummaryReview = !setupComplete && proposedCareerFacts.length > 0;
  const latestCareerSource = careerSources.at(-1);
  const [sourceText, setSourceText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [subject, setSubject] = useState("");
  const [predicate, setPredicate] = useState("");
  const [value, setValue] = useState("");
  const [personName, setPersonName] = useState(verifiedIdentityName);
  const [roleTitle, setRoleTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [careerInputMode, setCareerInputMode] = useState<
    "upload" | "resume" | "story" | "manual"
  >("upload");
  const [excludedSummaryFactIds, setExcludedSummaryFactIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);
  const capture = useMutation({
    mutationFn: () => {
      const text = sourceText.trim();
      if (text.length === 0)
        throw new ApiError(
          400,
          "invalid_request",
          "Paste some résumé or CV text before saving it.",
        );
      return mutate<SourceView>("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text,
        originalLocator:
          careerInputMode === "story"
            ? "user-entry://career-history/story"
            : "user-entry://career-history/resume",
      });
    },
    onSuccess: async (source) => {
      setSourceId(source.id);
      await refresh();
    },
  });
  const uploadCandidateFile = useMutation({
    mutationFn: async () => {
      if (candidateFile === null) {
        throw new ApiError(
          400,
          "invalid_request",
          "Choose a PDF or text résumé file first.",
        );
      }
      const extracted = await extractCandidateFile(candidateFile);
      return mutate<SourceView>("/api/v1/sources/upload", extracted);
    },
    onSuccess: async (source) => {
      setCandidateFile(null);
      setSourceId(source.id);
      if (candidateFileInputRef.current !== null) {
        candidateFileInputRef.current.value = "";
      }
      await refresh();
    },
  });
  const addHistory = useMutation({
    mutationFn: () =>
      mutate<{
        readonly source: SourceView;
        readonly facts: readonly ProfileFactView[];
      }>("/api/v1/profile/history-entries", {
        personName,
        roleTitle,
        organization,
        dateRange,
        achievements: achievementsText
          .split(/\r?\n/u)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      }),
    onSuccess: async ({ source, facts }) => {
      setSourceId(source.id);
      const first = facts[0];
      if (first !== undefined) {
        setSubject(first.subject);
        setPredicate(first.predicate);
        setValue(String(first.value));
      }
      await refresh();
    },
  });
  const propose = useMutation({
    mutationFn: () => {
      const claim = `${subject} ${predicate} ${value}`;
      const source = snapshot.sources.find((item) => item.id === sourceId);
      const start = source?.inlineText?.indexOf(claim) ?? -1;
      if (start < 0)
        throw new ApiError(
          400,
          "evidence_locator_invalid",
          "The source must contain the exact complete claim.",
        );
      return mutate("/api/v1/profile-facts", {
        factType: "experience",
        subject,
        predicate,
        value,
        sourceLocators: [
          { sourceId, start, end: start + claim.length, quote: claim },
        ],
        proposedBy: "user",
      });
    },
    onSuccess: refresh,
  });
  const confirmSummary = useMutation({
    mutationFn: async () => {
      for (const fact of proposedCareerFacts) {
        await mutate(`/api/v1/profile-facts/${fact.id}/confirm`, {
          expectedRevision: fact.revision,
          outcome: {
            kind: excludedSummaryFactIds.has(fact.id)
              ? "cannot_confirm"
              : "confirm",
          },
        });
      }
    },
    onSuccess: async () => {
      await refresh();
      await navigate("/overview");
    },
    onError: refresh,
  });
  const organizeCareerSource = useMutation({
    mutationFn: () => {
      if (latestCareerSource === undefined) {
        throw new ApiError(
          400,
          "invalid_request",
          "Save your résumé or career story first.",
        );
      }
      return mutate<ProfileOrganizationRunResponse>(
        "/api/v1/profile-organizations",
        { sourceId: latestCareerSource.id },
      );
    },
    onSuccess: refresh,
  });
  const includedSummaryFactCount = proposedCareerFacts.filter(
    (fact) => !excludedSummaryFactIds.has(fact.id),
  ).length;
  if (guidedSummaryReview) {
    return (
      <section
        className="panel profile-summary-review guided-summary-review"
        id="profile-summary-review"
        aria-labelledby="profile-summary-title"
      >
        <header>
          <div>
            <h1 id="profile-summary-title">Review your résumé</h1>
            <p>Everything is included. Uncheck anything you don’t want.</p>
          </div>
        </header>
        <div className="claim-review-list">
          {proposedCareerFacts.map((fact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              sources={snapshot.sources}
              affectedOutputs={0}
              compact
              included={!excludedSummaryFactIds.has(fact.id)}
              onIncludedChange={(included) =>
                setExcludedSummaryFactIds((current) => {
                  const next = new Set(current);
                  if (included) next.delete(fact.id);
                  else next.add(fact.id);
                  return next;
                })
              }
            />
          ))}
        </div>
        <div className="profile-summary-actions">
          <span>{includedSummaryFactCount} included</span>
          <button
            className="primary"
            type="button"
            onClick={() => confirmSummary.mutate()}
            disabled={confirmSummary.isPending}
          >
            {confirmSummary.isPending ? "Saving…" : "Continue"}
            {!confirmSummary.isPending && <ArrowRight aria-hidden="true" />}
          </button>
        </div>
        <ErrorNotice error={confirmSummary.error} />
      </section>
    );
  }
  if (setupComplete && location.hash === "#profile-summary-review") {
    return (
      <section className="guided-summary-complete">
        <p className="eyebrow">Career record ready</p>
        <h1>Now, tell us what you want next.</h1>
        <Link className="button-link primary" to="/overview">
          Choose your direction <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Step 1 of 5 · Build your record"
        title={setupComplete ? "Your career record" : "Add your career history"}
        description={
          setupComplete
            ? "Review the experience Workbench can use, or add more when something changes."
            : "Start with a résumé, rough notes, or one role. Review what Workbench finds before anything becomes part of your record."
        }
        story={pageStories.profile}
        journeyStep={1}
      />
      {proposedCareerFacts.length > 0 && (
        <section
          className="panel profile-summary-review"
          id="profile-summary-review"
          aria-labelledby="profile-summary-title"
        >
          <header>
            <div>
              <p className="eyebrow">Step 2 · Shape your career record</p>
              <h2 id="profile-summary-title">
                Review the AI-organized summary
              </h2>
              <p>
                Keep what fits, edit anything you want, or leave a line out.
                Your original text stays available under Check source.
              </p>
            </div>
            <StatusPill tone="warning">
              {proposedCareerFacts.length} left
            </StatusPill>
          </header>
          <div className="claim-review-list">
            {proposedCareerFacts.map((fact) => (
              <FactCard
                key={fact.id}
                fact={fact}
                sources={snapshot.sources}
                affectedOutputs={0}
              />
            ))}
          </div>
          <div className="profile-summary-actions">
            <button
              className="primary"
              type="button"
              onClick={() => confirmSummary.mutate()}
              disabled={confirmSummary.isPending}
            >
              {confirmSummary.isPending
                ? "Confirming…"
                : `Keep all ${String(proposedCareerFacts.length)}`}
            </button>
            <small>
              Use the controls on a claim when only that line needs work.
            </small>
          </div>
          <ErrorNotice error={confirmSummary.error} />
        </section>
      )}
      {verifiedCareerFacts.length > 0 && (
        <details
          className="panel profile-record-details"
          id="confirmed-career-record"
          open={setupComplete}
        >
          <summary>
            <span>
              <strong>Your career record</strong>
              <small>
                Scan the essentials. Edit or check a source only when needed.
              </small>
            </span>
            <StatusPill tone="good">
              {verifiedCareerFacts.length} saved
            </StatusPill>
          </summary>
          <CareerFactCollection
            facts={verifiedCareerFacts}
            snapshot={snapshot}
          />
        </details>
      )}
      {historicalCareerFacts.length > 0 && (
        <details className="panel profile-record-details profile-record-history">
          <summary>
            <span>
              <strong>Past decisions</strong>
              <small>Replaced or omitted details; not used now.</small>
            </span>
            <StatusPill>{historicalCareerFacts.length} archived</StatusPill>
          </summary>
          <CareerFactCollection
            facts={historicalCareerFacts}
            snapshot={snapshot}
            showStatus
          />
        </details>
      )}
      <div className="profile-settings-link">
        <Settings2 aria-hidden="true" />
        <span>
          Looking for your name, target roles, or location preferences?{" "}
          <Link to="/settings">Manage identity and search preferences.</Link>
        </span>
      </div>
      <TaskDisclosure
        collapsed={setupComplete && verifiedCareerFacts.length > 0}
        summary="Add more career history"
        hint="Upload, paste, tell your story, or add a role"
      >
        <section className="panel history-intake">
          <header className="history-intake-head">
            <div>
              <p className="eyebrow">Step 1 · Bring in your experience</p>
              <h2>How would you like to start?</h2>
              <p>
                Use the path that requires the least effort today. You can add
                more sources and roles later.
              </p>
            </div>
            <StatusPill>
              {careerSources.length} career{" "}
              {careerSources.length === 1 ? "source" : "sources"}
            </StatusPill>
          </header>
          <Tabs.Root
            className="history-tabs"
            value={careerInputMode}
            onValueChange={(value) =>
              setCareerInputMode(
                value as "upload" | "resume" | "story" | "manual",
              )
            }
          >
            <Tabs.List aria-label="Career history input method">
              <Tabs.Trigger value="upload">
                <FileText aria-hidden="true" /> Upload résumé
              </Tabs.Trigger>
              <Tabs.Trigger value="resume" aria-label="Paste résumé or CV">
                <FileText aria-hidden="true" /> Paste text
              </Tabs.Trigger>
              <Tabs.Trigger value="story">
                <Sparkles aria-hidden="true" /> Tell my story
              </Tabs.Trigger>
              <Tabs.Trigger value="manual" aria-label="Add a role manually">
                <ListPlus aria-hidden="true" /> Add role
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="upload">
              <form
                className="resume-file-upload career-file-upload"
                onSubmit={(event) => {
                  event.preventDefault();
                  uploadCandidateFile.mutate();
                }}
              >
                <div>
                  <FileText aria-hidden="true" />
                  <div>
                    <label htmlFor="career-resume-file">
                      Upload a résumé file
                    </label>
                    <p>PDF or plain text · up to 5 MB</p>
                  </div>
                </div>
                <input
                  ref={candidateFileInputRef}
                  id="career-resume-file"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={(event) =>
                    setCandidateFile(event.target.files?.[0] ?? null)
                  }
                />
                {candidateFile !== null && (
                  <p className="selected-file" role="status">
                    Selected: {candidateFile.name} ·{" "}
                    {(candidateFile.size / 1024).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    KB
                  </p>
                )}
                <button
                  className="primary"
                  type="submit"
                  disabled={
                    candidateFile === null || uploadCandidateFile.isPending
                  }
                >
                  {uploadCandidateFile.isPending
                    ? "Reading résumé…"
                    : "Upload résumé"}
                </button>
                <p className="field-help">
                  The file is stored locally. Starting AI sends its text to your
                  configured provider; you review every proposed detail.
                </p>
                <ErrorNotice error={uploadCandidateFile.error} />
              </form>
              {uploadCandidateFile.data !== undefined && (
                <div className="notice" role="status">
                  <Check aria-hidden="true" />
                  <span>
                    Résumé saved locally. Continue with AI to organize it, or
                    choose another intake mode.
                  </span>
                </div>
              )}
            </Tabs.Content>
            <Tabs.Content value="resume">
              <div className="history-method-grid">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    capture.mutate();
                  }}
                >
                  <label htmlFor="candidate-source">Résumé or CV text</label>
                  <textarea
                    id="candidate-source"
                    className="resume-text"
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder="Paste the text from your résumé or CV here. Formatting does not need to be perfect."
                    required
                  />
                  <p className="field-help">
                    Saved locally as your career history.
                  </p>
                  <button
                    className="primary"
                    type="submit"
                    disabled={capture.isPending}
                  >
                    {capture.isPending ? "Saving…" : "Save résumé text"}
                  </button>
                </form>
                <aside className="assist-boundary">
                  <Sparkles aria-hidden="true" />
                  <h3>Where AI can help</h3>
                  <p>
                    AI can turn the selected source into proposed career
                    details. You choose what to keep, edit, or leave out.
                  </p>
                  {latestCareerSource !== undefined && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => organizeCareerSource.mutate()}
                      disabled={organizeCareerSource.isPending}
                    >
                      {organizeCareerSource.isPending
                        ? "Organizing in this window…"
                        : "Continue with AI"}
                    </button>
                  )}
                  <small>
                    Starting this sends the selected source to your configured
                    AI provider through the local agent service.
                  </small>
                  {organizeCareerSource.isPending && (
                    <div
                      className="ai-run-progress"
                      role="status"
                      aria-live="polite"
                    >
                      <RefreshCw className="spin" aria-hidden="true" />
                      <div>
                        <strong>AI is organizing this source now.</strong>
                        <p>
                          The review list will update here when it finishes.
                        </p>
                      </div>
                    </div>
                  )}
                  {organizeCareerSource.data?.proposedFactIds.length === 0 && (
                    <div className="notice warning" role="status">
                      <AlertTriangle aria-hidden="true" />
                      <span>
                        AI finished but found no clear career details in this
                        source. Add clearer résumé text or use the manual form.
                      </span>
                    </div>
                  )}
                  <ErrorNotice error={organizeCareerSource.error} />
                </aside>
              </div>
              {capture.data !== undefined && (
                <div className="notice" role="status">
                  <Check aria-hidden="true" />
                  <span>
                    Résumé text saved locally. Choose Continue with AI to
                    organize it here, or add a role manually.
                  </span>
                </div>
              )}
              <ErrorNotice error={capture.error} />
            </Tabs.Content>
            <Tabs.Content value="story">
              <div className="history-method-grid">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    capture.mutate();
                  }}
                >
                  <label htmlFor="candidate-story">
                    Describe your work in your own words
                  </label>
                  <textarea
                    id="candidate-story"
                    className="resume-text"
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder="Rough notes are fine. Describe the roles, projects, and outcomes you remember."
                    required
                  />
                  <p className="field-help">
                    Workbench saves your words locally. AI may organize them,
                    and you choose what stays in your career record.
                  </p>
                  <button
                    className="primary"
                    type="submit"
                    disabled={capture.isPending}
                  >
                    {capture.isPending ? "Saving…" : "Save career story"}
                  </button>
                </form>
                <aside className="assist-boundary">
                  <Sparkles aria-hidden="true" />
                  <h3>Organize without rewriting your story</h3>
                  <p>
                    AI can turn what you wrote into proposed career details
                    without adding new claims.
                  </p>
                  {latestCareerSource !== undefined && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => organizeCareerSource.mutate()}
                      disabled={organizeCareerSource.isPending}
                    >
                      {organizeCareerSource.isPending
                        ? "Organizing in this window…"
                        : "Continue with AI"}
                    </button>
                  )}
                  <small>
                    Starting this sends the selected source to your configured
                    AI provider through the local agent service.
                  </small>
                </aside>
              </div>
              {capture.data !== undefined && careerInputMode === "story" && (
                <div className="notice" role="status">
                  <Check aria-hidden="true" />
                  <span>Career story saved as an immutable local source.</span>
                </div>
              )}
              <ErrorNotice error={capture.error} />
            </Tabs.Content>
            <Tabs.Content value="manual">
              <form
                className="history-entry-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  addHistory.mutate();
                }}
              >
                <div className="field-row">
                  <label>
                    Your name
                    <input
                      value={personName}
                      onChange={(event) => setPersonName(event.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label>
                    Role title
                    <input
                      value={roleTitle}
                      onChange={(event) => setRoleTitle(event.target.value)}
                      placeholder="Senior Product Designer"
                      required
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label>
                    Organization
                    <input
                      value={organization}
                      onChange={(event) => setOrganization(event.target.value)}
                      placeholder="Example Company"
                      required
                    />
                  </label>
                  <label>
                    Dates
                    <input
                      value={dateRange}
                      onChange={(event) => setDateRange(event.target.value)}
                      placeholder="March 2021 to present"
                      required
                    />
                  </label>
                </div>
                <label htmlFor="career-achievements">
                  Achievements <span className="optional">optional</span>
                </label>
                <textarea
                  id="career-achievements"
                  value={achievementsText}
                  onChange={(event) => setAchievementsText(event.target.value)}
                  placeholder={
                    "Start each line with an action verb.\nBuilt a reusable design system\nReduced onboarding time by 30%"
                  }
                />
                <p className="field-help">
                  One achievement per line. You can edit or leave out anything
                  in the summary before moving on.
                </p>
                <button
                  className="primary"
                  type="submit"
                  disabled={addHistory.isPending}
                >
                  {addHistory.isPending ? "Adding…" : "Add role for review"}
                </button>
              </form>
              {addHistory.data !== undefined && (
                <div className="notice" role="status">
                  <Check aria-hidden="true" />
                  <span>
                    Role added. Review the organized summary in the next
                    section.
                  </span>
                </div>
              )}
              <ErrorNotice error={addHistory.error} />
            </Tabs.Content>
          </Tabs.Root>
        </section>
      </TaskDisclosure>
      <details className="panel exact-fact-builder">
        <summary>Advanced: add an exact statement from a saved source</summary>
        <p>
          Use this when a saved résumé contains a specific statement you want to
          review now. The complete subject, action, and value must appear
          exactly in the source.
        </p>
        <div className="exact-fact-body">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              propose.mutate();
            }}
          >
            <label htmlFor="fact-source">Saved candidate source</label>
            <select
              id="fact-source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              required
            >
              <option value="">Select a saved source</option>
              {careerSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.inlineText?.slice(0, 64)}
                </option>
              ))}
            </select>
            <div className="field-row">
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label>
                Predicate
                <input
                  value={predicate}
                  onChange={(event) => setPredicate(event.target.value)}
                />
              </label>
            </div>
            <label htmlFor="fact-value">Value</label>
            <input
              id="fact-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <button
              className="primary"
              type="submit"
              disabled={propose.isPending}
            >
              Add statement for review
            </button>
          </form>
          <ErrorNotice error={propose.error} />
        </div>
      </details>
    </>
  );
}

function FactCard({
  fact,
  sources,
  affectedOutputs,
  compact = false,
  recordRow = false,
  showStatus = false,
  recordDisclosure = null,
  onRecordDisclosureChange,
  included = true,
  onIncludedChange,
}: {
  readonly fact: ProfileFactView;
  readonly sources: readonly SourceView[];
  readonly affectedOutputs: number;
  readonly compact?: boolean;
  readonly recordRow?: boolean;
  readonly showStatus?: boolean;
  readonly recordDisclosure?: CareerRecordDisclosure | null;
  readonly onRecordDisclosureChange?: (
    disclosure: CareerRecordDisclosure | null,
  ) => void;
  readonly included?: boolean;
  readonly onIncludedChange?: (included: boolean) => void;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [corrected, setCorrected] = useState(String(fact.value ?? ""));
  const [showCorrection, setShowCorrection] = useState(false);
  const factClaim = `${fact.subject} ${fact.predicate} ${String(fact.value)}`;
  const [showFullClaim, setShowFullClaim] = useState(false);
  const [claimIsOverflowing, setClaimIsOverflowing] = useState(false);
  const claimRef = useRef<HTMLParagraphElement>(null);
  const recordSourceId = `record-source-${fact.id}`;
  const correctionVisible = recordRow
    ? recordDisclosure?.factId === fact.id && recordDisclosure.kind === "edit"
    : showCorrection;
  const recordSourceVisible =
    recordRow &&
    recordDisclosure?.factId === fact.id &&
    recordDisclosure.kind === "source";
  useEffect(() => {
    setCorrected(String(fact.value ?? ""));
    setShowFullClaim(false);
    if (fact.status !== "verified" && fact.status !== "proposed") {
      setShowCorrection(false);
    }
  }, [fact.revision, fact.status, fact.value]);
  useEffect(() => {
    const claim = claimRef.current;
    if (claim === null || showFullClaim) return;
    const measure = (): void => {
      setClaimIsOverflowing(claim.scrollHeight > claim.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(claim);
    return () => observer.disconnect();
  }, [factClaim, showFullClaim]);
  const decide = useMutation({
    mutationFn: (kind: "confirm" | "narrative_only" | "cannot_confirm") =>
      mutate(`/api/v1/profile-facts/${fact.id}/confirm`, {
        expectedRevision: fact.revision,
        outcome: { kind },
      }),
    onSuccess: refresh,
  });
  const correct = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/profile-facts/${fact.id}/corrections`, {
        expectedRevision: fact.revision,
        value: corrected,
        sourceText: `${fact.subject} ${fact.predicate} ${corrected}`,
      }),
    onSuccess: async () => {
      setShowCorrection(false);
      onRecordDisclosureChange?.(null);
      await refresh();
    },
  });
  const tone =
    fact.status === "verified"
      ? "good"
      : fact.status === "proposed"
        ? "warning"
        : "neutral";
  const statusLabel =
    fact.status === "verified"
      ? "saved"
      : fact.status === "proposed"
        ? "suggested"
        : fact.status === "derived_unverified"
          ? "not used"
          : fact.status === "user_cannot_confirm" || fact.status === "rejected"
            ? "left out"
            : "replaced";
  const sourceExcerpt = (
    <div
      className="source-provenance fact-source-provenance"
      aria-label={`Source details for ${factClaim}`}
    >
      {fact.sourceLocators.length === 0 ? (
        <small>No matching source excerpt is stored for this line.</small>
      ) : (
        <ul>
          {fact.sourceLocators.map((locator, index) => {
            const source = sources.find((item) => item.id === locator.sourceId);
            return (
              <li key={`${locator.sourceId}-${String(index)}`}>
                <q>{locator.quote}</q>
                <small>
                  {source === undefined
                    ? "Saved source unavailable"
                    : `${source.kind === "candidate" ? "Career source" : "Saved source"} · captured ${new Date(source.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })} · ID ${source.id} · fingerprint ${source.contentDigest.slice(0, 10)}`}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
  if (recordRow) {
    return (
      <article className={`fact-card fact-card-${fact.status} career-fact-row`}>
        <div className="career-fact-row-main">
          {showStatus && <StatusPill tone={tone}>{statusLabel}</StatusPill>}
          {!showStatus && <span className="sr-only">{statusLabel}</span>}
          <p
            ref={claimRef}
            className={`career-fact-claim${showFullClaim ? " career-fact-claim-expanded" : ""}`}
          >
            {fact.subject} <span>{fact.predicate}</span> {String(fact.value)}
          </p>
          {(claimIsOverflowing || showFullClaim) && (
            <button
              className="career-fact-expand"
              type="button"
              aria-expanded={showFullClaim}
              onClick={() => setShowFullClaim((visible) => !visible)}
            >
              {showFullClaim ? "Show less" : "Show full detail"}
            </button>
          )}
        </div>
        <div className="career-fact-row-actions">
          {fact.status === "verified" && (
            <button
              className="career-icon-button"
              type="button"
              aria-label={`Edit saved career detail ${factClaim}`}
              aria-expanded={correctionVisible}
              title="Edit detail"
              onClick={() => {
                onRecordDisclosureChange?.(
                  correctionVisible ? null : { factId: fact.id, kind: "edit" },
                );
              }}
            >
              <Pencil aria-hidden="true" />
            </button>
          )}
          <button
            className="career-icon-button"
            type="button"
            aria-label={`Check source for ${factClaim}`}
            aria-expanded={recordSourceVisible}
            aria-controls={recordSourceId}
            title="Check source"
            onClick={() => {
              onRecordDisclosureChange?.(
                recordSourceVisible
                  ? null
                  : { factId: fact.id, kind: "source" },
              );
            }}
          >
            <FileText aria-hidden="true" />
          </button>
        </div>
        {correctionVisible && (
          <div className="correction-preview career-row-expansion">
            <p>
              This updates your career record.{" "}
              {affectedOutputs === 0 ? (
                <>Nothing else will be marked out of date.</>
              ) : (
                <>
                  {affectedOutputs} dependent{" "}
                  {affectedOutputs === 1 ? "item will" : "items will"} be marked
                  out of date.
                </>
              )}{" "}
              The previous version stays in history.
            </p>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                correct.mutate();
              }}
            >
              <label htmlFor={`correct-${fact.id}`}>Updated value</label>
              <input
                id={`correct-${fact.id}`}
                value={corrected}
                onChange={(event) => setCorrected(event.target.value)}
              />
              <button
                aria-label={`Save correction for ${factClaim}`}
                className="primary"
                type="submit"
                disabled={correct.isPending}
              >
                {correct.isPending ? "Saving…" : "Save correction"}
              </button>
            </form>
          </div>
        )}
        {recordSourceVisible && (
          <div
            className="career-row-expansion career-row-source"
            id={recordSourceId}
          >
            {sourceExcerpt}
            <small>Career detail revision {fact.revision}</small>
          </div>
        )}
        <ErrorNotice error={correct.error} />
      </article>
    );
  }
  if (compact) {
    return (
      <article
        className={`fact-card fact-card-${fact.status} fact-card-compact`}
      >
        <div className="guided-fact-main">
          <label className="guided-fact-choice">
            <input
              type="checkbox"
              checked={included}
              onChange={(event) => onIncludedChange?.(event.target.checked)}
            />
            <span className="guided-fact-copy">
              {fact.subject} <span>{fact.predicate}</span> {String(fact.value)}
            </span>
          </label>
          <div className="guided-fact-actions">
            <button
              className="text-button"
              aria-label={`Edit ${factClaim}`}
              onClick={() => setShowCorrection((visible) => !visible)}
            >
              Edit
            </button>
            <details className="fact-source-details">
              <summary>
                <FileText aria-hidden="true" /> Source
              </summary>
              {sourceExcerpt}
            </details>
          </div>
        </div>
        {showCorrection && (
          <form
            className="inline-form guided-fact-edit"
            onSubmit={(event) => {
              event.preventDefault();
              correct.mutate();
            }}
          >
            <label htmlFor={`correct-${fact.id}`}>Edit detail</label>
            <input
              id={`correct-${fact.id}`}
              value={corrected}
              onChange={(event) => setCorrected(event.target.value)}
            />
            <button
              aria-label={`Save correction for ${factClaim}`}
              className="primary"
              type="submit"
              disabled={correct.isPending}
            >
              {correct.isPending ? "Saving…" : "Save"}
            </button>
          </form>
        )}
        <ErrorNotice error={correct.error} />
      </article>
    );
  }
  return (
    <article className={`fact-card fact-card-${fact.status}`}>
      <div className="fact-body">
        <div>
          <div className="fact-meta">
            <StatusPill tone={tone}>{statusLabel}</StatusPill>
            <span>{fact.factType.replaceAll("_", " ")}</span>
          </div>
          <h3>
            {fact.subject} <span>{fact.predicate}</span> {String(fact.value)}
          </h3>
        </div>
      </div>
      {fact.status === "proposed" && (
        <div className="actions" aria-label="Career detail choices">
          <button
            className="fact-confirm"
            aria-label={`Keep ${factClaim}`}
            disabled={decide.isPending}
            onClick={() => decide.mutate("confirm")}
          >
            <Check aria-hidden="true" />
            Looks right
          </button>
          <button
            aria-label={`Edit ${factClaim}`}
            disabled={decide.isPending}
            onClick={() => setShowCorrection(true)}
          >
            Edit
          </button>
          <button
            aria-label={`Mark ${factClaim} as narrative only`}
            disabled={decide.isPending}
            onClick={() => decide.mutate("narrative_only")}
          >
            Keep as note
          </button>
          <button
            aria-label={`Leave out ${factClaim}`}
            disabled={decide.isPending}
            onClick={() => decide.mutate("cannot_confirm")}
          >
            Leave out
          </button>
        </div>
      )}
      {fact.status === "verified" && (
        <div className="actions">
          <button
            aria-label={`Edit saved career detail ${factClaim}`}
            onClick={() => setShowCorrection((value) => !value)}
          >
            Edit
          </button>
        </div>
      )}
      <details className="fact-source-details">
        <summary>
          <FileText aria-hidden="true" />
          Check source
        </summary>
        {sourceExcerpt}
        <small>Career detail revision {fact.revision}</small>
      </details>
      {showCorrection && (
        <div className="correction-preview">
          <p>
            This updates your career record. {affectedOutputs} dependent{" "}
            {affectedOutputs === 1 ? "item will" : "items will"} be marked out
            of date. The previous version stays in history.
          </p>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              correct.mutate();
            }}
          >
            <label htmlFor={`correct-${fact.id}`}>Updated value</label>
            <input
              id={`correct-${fact.id}`}
              value={corrected}
              onChange={(event) => setCorrected(event.target.value)}
            />
            <button
              aria-label={`Save correction for ${factClaim}`}
              className="primary"
              type="submit"
            >
              Save correction
            </button>
          </form>
        </div>
      )}
      <ErrorNotice error={decide.error ?? correct.error} />
    </article>
  );
}

function settingLabel(fact: ProfileFactView): string {
  if (fact.factType === "identity") return "Name";
  if (fact.predicate === "targets") return "Target role";
  if (fact.predicate === "prioritizes") return "Priorities";
  if (fact.predicate === "prefers") return "Location or work style";
  return "Search preference";
}

function SettingFactRow({
  fact,
  affectedOutputs,
}: {
  readonly fact: ProfileFactView;
  readonly affectedOutputs: number;
}): React.JSX.Element {
  const refresh = useRefresh();
  const label = settingLabel(fact);
  const value = String(fact.value ?? "");
  const [corrected, setCorrected] = useState(value);
  const [showCorrection, setShowCorrection] = useState(false);
  useEffect(() => {
    setCorrected(String(fact.value ?? ""));
    if (fact.status !== "verified" && fact.status !== "proposed") {
      setShowCorrection(false);
    }
  }, [fact.revision, fact.status, fact.value]);
  const confirm = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/profile-facts/${fact.id}/confirm`, {
        expectedRevision: fact.revision,
        outcome: { kind: "confirm" },
      }),
    onSuccess: refresh,
  });
  const correct = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/profile-facts/${fact.id}/corrections`, {
        expectedRevision: fact.revision,
        value: corrected,
        sourceText: `${fact.subject} ${fact.predicate} ${corrected}`,
      }),
    onSuccess: async () => {
      setShowCorrection(false);
      await refresh();
    },
  });
  return (
    <article className="setting-fact-row">
      <header>
        <div>
          <span className="setting-fact-label">{label}</span>
          <strong>{value}</strong>
        </div>
      </header>
      {fact.status === "proposed" && (
        <div className="setting-pending">
          <p>This imported setting is ready to use or edit.</p>
          <div className="actions">
            <button
              className="primary"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              Use this setting
            </button>
            <button onClick={() => setShowCorrection(true)}>Edit</button>
          </div>
        </div>
      )}
      {fact.status === "verified" && !showCorrection && (
        <div className="setting-fact-actions">
          <button onClick={() => setShowCorrection(true)}>
            Edit {label.toLocaleLowerCase()}
          </button>
        </div>
      )}
      {showCorrection && (
        <form
          className="settings-correction-form"
          onSubmit={(event) => {
            event.preventDefault();
            correct.mutate();
          }}
        >
          <p>
            Saving updates this setting
            {affectedOutputs > 0
              ? ` and marks ${String(affectedOutputs)} dependent result${affectedOutputs === 1 ? "" : "s"} for refresh.`
              : "."}
          </p>
          <small>Current record revision {fact.revision}</small>
          <label htmlFor={`setting-${fact.id}`}>{label}</label>
          <input
            id={`setting-${fact.id}`}
            value={corrected}
            onChange={(event) => setCorrected(event.target.value)}
            required
          />
          <div className="settings-form-actions">
            <button
              className="primary"
              type="submit"
              disabled={correct.isPending || corrected.trim().length === 0}
            >
              {correct.isPending
                ? "Saving…"
                : `Save ${label.toLocaleLowerCase()}`}
            </button>
            <button type="button" onClick={() => setShowCorrection(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <ErrorNotice error={confirm.error ?? correct.error} />
    </article>
  );
}

function Settings({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const identityFacts = snapshot.profileFacts.filter(
    (fact) => fact.factType === "identity",
  );
  const preferenceFacts = snapshot.profileFacts.filter(
    (fact) => fact.factType === "preference",
  );
  const displayedIdentityFacts = identityFacts.filter(
    (fact) => fact.status === "verified" || fact.status === "proposed",
  );
  const displayedPreferenceFacts = preferenceFacts.filter(
    (fact) =>
      fact.predicate !== "deferred" &&
      (fact.status === "verified" || fact.status === "proposed"),
  );
  const verifiedIdentityName = String(
    identityFacts.find((fact) => fact.status === "verified")?.value ?? "",
  );
  const hasVerifiedTarget = preferenceFacts.some(
    (fact) =>
      fact.status === "verified" &&
      fact.predicate === "targets" &&
      String(fact.value).trim().length > 0,
  );
  const targetWasDeferred =
    !hasVerifiedTarget &&
    preferenceFacts.some(
      (fact) => fact.status === "verified" && fact.predicate === "deferred",
    );
  const [targetRoleText, setTargetRoleText] = useState("");
  const [targetPrioritiesText, setTargetPrioritiesText] = useState("");
  const [locationPreferenceText, setLocationPreferenceText] = useState("");
  const completePreferences = useMutation({
    mutationFn: async () => {
      if (verifiedIdentityName.length === 0)
        throw new ApiError(
          400,
          "identity_required",
          "Add your name before saving search preferences.",
        );
      const specifications = [
        {
          predicate: "targets",
          value: targetRoleText.trim(),
        },
        ...(targetPrioritiesText.trim().length === 0
          ? []
          : [
              {
                predicate: "prioritizes",
                value: targetPrioritiesText.trim(),
              },
            ]),
        ...(locationPreferenceText.trim().length === 0
          ? []
          : [
              {
                predicate: "prefers",
                value: locationPreferenceText.trim(),
              },
            ]),
      ];
      const claims = specifications.map(
        (item) =>
          verifiedIdentityName + " " + item.predicate + " " + item.value,
      );
      const source = await mutate<SourceView>("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: claims.join("\n"),
        originalLocator: "user-entry://profile/target-preferences",
      });
      let offset = 0;
      for (const [index, item] of specifications.entries()) {
        const quote = claims[index] ?? "";
        const fact = await mutate<ProfileFactView>("/api/v1/profile-facts", {
          factType: "preference",
          subject: verifiedIdentityName,
          predicate: item.predicate,
          value: item.value,
          sourceLocators: [
            {
              sourceId: source.id,
              start: offset,
              end: offset + quote.length,
              quote,
            },
          ],
          proposedBy: "user",
        });
        await mutate(`/api/v1/profile-facts/${fact.id}/confirm`, {
          expectedRevision: fact.revision,
          outcome: { kind: "confirm" },
        });
        offset += quote.length + 1;
      }
    },
    onSuccess: async () => {
      setTargetRoleText("");
      setTargetPrioritiesText("");
      setLocationPreferenceText("");
      await refresh();
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Support · Preferences"
        title="Identity and search preferences"
        description="Keep the few choices that shape job search and matching up to date."
        story={pageStories.settings}
      />
      <div className="settings-grid">
        <section
          className="panel settings-card"
          aria-labelledby="identity-title"
        >
          <header className="settings-card-header">
            <span className="settings-card-icon" aria-hidden="true">
              <UserRound />
            </span>
            <div>
              <h2 id="identity-title">Identity</h2>
              <p>The name used across this workbench.</p>
            </div>
          </header>
          <div className="compact-fact-list">
            {displayedIdentityFacts.length === 0 ? (
              <Empty>
                No identity record is available.{" "}
                <Link to="/profile">Add your career record</Link>.
              </Empty>
            ) : (
              displayedIdentityFacts.map((fact) => (
                <SettingFactRow
                  key={fact.id}
                  fact={fact}
                  affectedOutputs={affectedOutputCount(snapshot, fact.id)}
                />
              ))
            )}
          </div>
        </section>
        <section
          className="panel settings-card"
          aria-labelledby="preference-title"
        >
          <header className="settings-card-header">
            <span className="settings-card-icon sky" aria-hidden="true">
              <Search />
            </span>
            <div>
              <h2 id="preference-title">Search preferences</h2>
              <p>Targets and priorities used to guide job matching.</p>
            </div>
          </header>
          {displayedPreferenceFacts.length > 0 && (
            <div className="compact-fact-list">
              {displayedPreferenceFacts.map((fact) => (
                <SettingFactRow
                  key={fact.id}
                  fact={fact}
                  affectedOutputs={affectedOutputCount(snapshot, fact.id)}
                />
              ))}
            </div>
          )}
          <details
            className="settings-preference-editor"
            open={!hasVerifiedTarget}
          >
            <summary>
              {hasVerifiedTarget
                ? "Add another target or preference"
                : targetWasDeferred
                  ? "Add your search direction"
                  : "Add your first target role"}
            </summary>
            <p>Choose only what matters now. You can change it later.</p>
            <form
              className="preference-entry-form"
              onSubmit={(event) => {
                event.preventDefault();
                completePreferences.mutate();
              }}
            >
              <label htmlFor="settings-target-role">Target role</label>
              <input
                id="settings-target-role"
                value={targetRoleText}
                onChange={(event) => setTargetRoleText(event.target.value)}
                placeholder="Senior Software Engineer focused on AI platforms"
                maxLength={500}
                required
              />
              <label htmlFor="settings-target-priorities">
                Priorities <span className="optional">optional</span>
              </label>
              <textarea
                id="settings-target-priorities"
                value={targetPrioritiesText}
                onChange={(event) =>
                  setTargetPrioritiesText(event.target.value)
                }
                placeholder="Hands-on AI systems, strong engineering culture"
                maxLength={2_000}
              />
              <label htmlFor="settings-location-preference">
                Location or work style{" "}
                <span className="optional">optional</span>
              </label>
              <input
                id="settings-location-preference"
                value={locationPreferenceText}
                onChange={(event) =>
                  setLocationPreferenceText(event.target.value)
                }
                placeholder="Remote in the United States"
                maxLength={300}
              />
              <button
                className="primary"
                type="submit"
                aria-describedby={
                  targetRoleText.trim().length === 0
                    ? "settings-target-role-help"
                    : undefined
                }
                disabled={
                  completePreferences.isPending ||
                  targetRoleText.trim().length === 0
                }
              >
                {completePreferences.isPending
                  ? "Saving preferences…"
                  : "Save search preferences"}
              </button>
              {targetRoleText.trim().length === 0 && (
                <p id="settings-target-role-help" className="field-help">
                  Enter a target role before saving these preferences.
                </p>
              )}
            </form>
            {completePreferences.isSuccess && (
              <div className="notice" role="status">
                <Check aria-hidden="true" />
                <span>
                  Search preferences saved. Role research will use them as
                  defaults.
                </span>
              </div>
            )}
            <ErrorNotice error={completePreferences.error} />
          </details>
          <Link className="settings-jobs-link" to="/discover">
            Open active job-search criteria <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toggleLine(value: string, option: string): string {
  const lines = splitLines(value);
  const existing = lines.findIndex(
    (line) => line.toLocaleLowerCase() === option.toLocaleLowerCase(),
  );
  if (existing >= 0) {
    return lines.filter((_, index) => index !== existing).join("\n");
  }
  return [...lines, option].join("\n");
}

function appendLine(value: string, option: string): string {
  const cleanOption = option.trim();
  if (cleanOption.length === 0) return value;
  const lines = splitLines(value);
  if (
    lines.some(
      (line) => line.toLocaleLowerCase() === cleanOption.toLocaleLowerCase(),
    )
  ) {
    return lines.join("\n");
  }
  return [...lines, cleanOption].join("\n");
}

function uniqueSignals(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    const normalized = clean.toLocaleLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(clean);
  }
  return unique;
}

function listingSourceHost(originalUrl: string): string {
  try {
    return new URL(originalUrl).hostname.replace(/^www\./u, "");
  } catch {
    return "the original listing";
  }
}

function Discover({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: loadDiagnostics,
  });
  const dshAvailable = diagnostics.data?.capabilities["dsh"] === true;
  const current: SearchProfileView | undefined = snapshot.searchProfiles[0];
  const initialTarget = snapshot.profileFacts.find(
    (fact) => fact.status === "verified" && fact.predicate === "targets",
  )?.value;
  const initialLocation = snapshot.profileFacts.find(
    (fact) => fact.status === "verified" && fact.predicate === "prefers",
  )?.value;
  const initialPriorities = snapshot.profileFacts.find(
    (fact) => fact.status === "verified" && fact.predicate === "prioritizes",
  )?.value;
  const [targetRoles, setTargetRoles] = useState(
    current?.targetRoles.join("\n") ??
      (typeof initialTarget === "string"
        ? initialTarget.replaceAll(" · ", "\n")
        : ""),
  );
  const [seniority, setSeniority] = useState(
    current?.seniority[0] ?? "flexible",
  );
  const [locations, setLocations] = useState(
    current?.locations.join("\n") ??
      (typeof initialLocation === "string" ? initialLocation : ""),
  );
  const [workArrangements, setWorkArrangements] = useState<readonly string[]>(
    current?.workArrangements ?? ["remote", "hybrid"],
  );
  const [minimumCompensation, setMinimumCompensation] = useState(
    current?.minimumCompensation === null ||
      current?.minimumCompensation === undefined
      ? ""
      : String(current.minimumCompensation),
  );
  const [currency, setCurrency] = useState(
    current?.compensationCurrency ?? "USD",
  );
  const [aiFocus, setAiFocus] = useState(current?.aiFocus ?? "");
  const [priorities, setPriorities] = useState(
    current?.priorities.join("\n") ??
      (typeof initialPriorities === "string" ? initialPriorities : ""),
  );
  const [exclusions, setExclusions] = useState(
    current?.exclusions.join("\n") ?? "",
  );
  const [customPriority, setCustomPriority] = useState("");
  const [customExclusion, setCustomExclusion] = useState("");
  const [active, setActive] = useState(current?.active ?? true);
  const [discoveryNotice, setDiscoveryNotice] = useState("");
  const [triageNotice, setTriageNotice] = useState("");
  const [triageNotes, setTriageNotes] = useState<Record<string, string>>({});
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const hasDiscoveryLeads = snapshot.discoveryLeads.length > 0;
  const [searchEditorOpen, setSearchEditorOpen] = useState(!hasDiscoveryLeads);
  const [selectedInboxState, setSelectedInboxState] = useState<
    "new" | "shortlisted" | "dismissed"
  >(() =>
    snapshot.discoveryLeads.length === 0 ||
    snapshot.discoveryLeads.some((lead) => lead.state === "new")
      ? "new"
      : snapshot.discoveryLeads.some((lead) => lead.state === "shortlisted")
        ? "shortlisted"
        : "dismissed",
  );
  const inboxTitleRef = useRef<HTMLHeadingElement>(null);
  const searchActionRef = useRef<HTMLButtonElement>(null);
  const evaluationActionRef = useRef<HTMLAnchorElement>(null);
  const focusSearchAfterSaveRef = useRef(false);
  const focusInboxAfterDiscoveryRef = useRef(false);
  const focusEvaluationAfterSaveRef = useRef(false);
  const [pageByState, setPageByState] = useState<Record<string, number>>({
    new: 0,
    shortlisted: 0,
    dismissed: 0,
  });
  const save = useMutation({
    mutationFn: () => {
      const amount = minimumCompensation.trim();
      return mutate<SearchProfileView>("/api/v1/search-profiles", {
        ...(current === undefined
          ? {}
          : { expectedRevision: current.revision }),
        targetRoles: splitLines(targetRoles),
        seniority: [seniority],
        locations: splitLines(locations),
        workArrangements,
        ...(amount.length === 0
          ? {}
          : {
              minimumCompensation: Number(amount),
              compensationCurrency: currency.trim().toUpperCase(),
            }),
        ...(aiFocus.trim().length === 0 ? {} : { aiFocus: aiFocus.trim() }),
        priorities: splitLines(priorities),
        exclusions: splitLines(exclusions),
        active,
      });
    },
    onSuccess: async () => {
      setDiscoveryNotice("Search saved. Ready to find jobs.");
      focusSearchAfterSaveRef.current = true;
      if (hasDiscoveryLeads) setSearchEditorOpen(false);
      await refresh();
    },
  });
  const discover = useMutation({
    mutationFn: () => {
      if (current === undefined) {
        throw new ApiError(
          400,
          "invalid_request",
          "Save the search before finding jobs.",
        );
      }
      return mutate<JobDiscoveryRunResponse>("/api/v1/job-discoveries", {
        searchProfileId: current.id,
      });
    },
    onSuccess: async (result) => {
      setDiscoveryNotice(
        result.leadIds.length === 0
          ? snapshot.discoveryLeads.length === 0
            ? "No matching jobs found this time. Try broader roles or locations."
            : "No new matches this time. Your existing results are still below."
          : `Found ${String(result.leadIds.length)} matching ${result.leadIds.length === 1 ? "job" : "jobs"}.`,
      );
      setSelectedInboxState("new");
      focusInboxAfterDiscoveryRef.current = true;
      setSearchEditorOpen(false);
      await refresh();
    },
  });
  const triage = useMutation({
    mutationFn: ({
      lead,
      decision,
    }: {
      readonly lead: DiscoveryLeadView;
      readonly decision: "new" | "shortlisted" | "dismissed";
    }) =>
      mutate(`/api/v1/discovery-leads/${lead.id}/triage`, {
        expectedRevision: lead.revision,
        decision,
        ...(triageNotes[lead.id]?.trim()
          ? { note: triageNotes[lead.id]?.trim() }
          : {}),
      }),
    onSuccess: async (_result, { lead, decision }) => {
      setExpandedLeadId(null);
      setPageByState((pages) => ({ ...pages, [lead.state]: 0 }));
      setTriageNotice(
        decision === "new"
          ? `${lead.roleTitle} moved back to New.`
          : decision === "shortlisted"
            ? `${lead.roleTitle} saved.`
            : `Passed on ${lead.roleTitle}.`,
      );
      setSelectedInboxState(decision);
      focusEvaluationAfterSaveRef.current = decision === "shortlisted";
      await refresh();
      if (decision !== "shortlisted") inboxTitleRef.current?.focus();
    },
  });
  const candidateReady = snapshot.profileFacts.some(
    (fact) =>
      fact.status === "verified" &&
      (fact.factType === "experience" || fact.factType === "achievement"),
  );
  const savedDiscoveryLeads = snapshot.discoveryLeads
    .filter(
      (lead) =>
        lead.state === "shortlisted" && lead.resultOpportunityId !== null,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const nextSavedOpportunityId =
    savedDiscoveryLeads[0]?.resultOpportunityId ?? null;
  const pageSize = 5;
  const amount = minimumCompensation.trim();
  const draftSignature = JSON.stringify({
    targetRoles: splitLines(targetRoles),
    seniority: [seniority],
    locations: splitLines(locations),
    workArrangements,
    minimumCompensation: amount.length === 0 ? null : Number(amount),
    compensationCurrency:
      amount.length === 0 ? null : currency.trim().toUpperCase(),
    aiFocus: aiFocus.trim().length === 0 ? null : aiFocus.trim(),
    priorities: splitLines(priorities),
    exclusions: splitLines(exclusions),
    active,
  });
  const savedSignature =
    current === undefined
      ? null
      : JSON.stringify({
          targetRoles: current.targetRoles,
          seniority: current.seniority,
          locations: current.locations,
          workArrangements: current.workArrangements,
          minimumCompensation: current.minimumCompensation,
          compensationCurrency: current.compensationCurrency,
          aiFocus: current.aiFocus,
          priorities: current.priorities,
          exclusions: current.exclusions,
          active: current.active,
        });
  const hasUnsavedChanges =
    savedSignature !== null && draftSignature !== savedSignature;
  useEffect(() => {
    if (
      focusSearchAfterSaveRef.current &&
      current?.active === true &&
      !hasUnsavedChanges
    ) {
      searchActionRef.current?.focus();
      focusSearchAfterSaveRef.current = false;
    }
  }, [current?.active, current?.revision, hasUnsavedChanges]);
  useEffect(() => {
    if (!focusInboxAfterDiscoveryRef.current) return;
    if (snapshot.discoveryLeads.length > 0) {
      inboxTitleRef.current?.focus();
    } else {
      searchActionRef.current?.focus();
    }
    focusInboxAfterDiscoveryRef.current = false;
  }, [snapshot.discoveryLeads.length]);
  useEffect(() => {
    if (
      focusEvaluationAfterSaveRef.current &&
      nextSavedOpportunityId !== null
    ) {
      evaluationActionRef.current?.focus();
      focusEvaluationAfterSaveRef.current = false;
    }
  }, [nextSavedOpportunityId]);
  const selectedLocations = splitLines(locations);
  const selectedPriorities = splitLines(priorities);
  const selectedExclusions = splitLines(exclusions);
  const missingSearchBasics =
    splitLines(targetRoles).length === 0 || workArrangements.length === 0;
  const searchRoleSummary =
    splitLines(targetRoles).join(", ") || "Choose a role";
  const searchContextSummary = [
    selectedLocations.join(", ") || "Any location",
    workArrangements
      .map((arrangement) =>
        arrangement === "onsite"
          ? "On-site"
          : `${arrangement[0]?.toUpperCase() ?? ""}${arrangement.slice(1)}`,
      )
      .join(", "),
  ]
    .filter((item) => item.length > 0)
    .join(" · ");
  const displayedPriorities = [
    ...priorityOptions,
    ...selectedPriorities.filter(
      (priority) =>
        !priorityOptions.some(
          (option) =>
            option.toLocaleLowerCase() === priority.toLocaleLowerCase(),
        ),
    ),
  ];
  const displayedExclusions = [
    ...exclusionOptions,
    ...selectedExclusions.filter(
      (exclusion) =>
        !exclusionOptions.some(
          (option) =>
            option.toLocaleLowerCase() === exclusion.toLocaleLowerCase(),
        ),
    ),
  ];
  const addCustomPriority = (): void => {
    setPriorities((value) => appendLine(value, customPriority));
    setCustomPriority("");
  };
  const addCustomExclusion = (): void => {
    setExclusions((value) => appendLine(value, customExclusion));
    setCustomExclusion("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Step 2 of 5 · Find roles"
        title="Research roles worth considering."
        description="Use your direction to find and save roles that merit a closer look."
        story={pageStories.discover}
        journeyStep={2}
      />
      {!candidateReady && (
        <section className="notice warning discovery-readiness">
          <AlertTriangle aria-hidden="true" />
          <span>
            Discovery works best after you add at least one experience or
            achievement. <Link to="/profile">Finish your career history</Link>,
            or save criteria now and return later.
          </span>
        </section>
      )}
      <div
        className={`discovery-flow${snapshot.discoveryLeads.length > 0 ? " has-leads" : ""}`}
      >
        <section className="discovery-layout" aria-label="Job search setup">
          <form
            className={`panel discovery-profile${hasDiscoveryLeads && !searchEditorOpen ? " compact" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <header>
              <div>
                <h2>Your search</h2>
                {hasDiscoveryLeads && !searchEditorOpen ? (
                  <div className="discovery-search-summary">
                    <strong>{searchRoleSummary}</strong>
                    <span>{searchContextSummary}</span>
                  </div>
                ) : (
                  <p>Give us a starting point.</p>
                )}
              </div>
              {hasDiscoveryLeads && (
                <button
                  className={`search-editor-toggle${searchEditorOpen ? "" : " icon-only"}`}
                  type="button"
                  aria-label={
                    searchEditorOpen
                      ? "Finish editing search criteria"
                      : "Edit search criteria"
                  }
                  title={
                    searchEditorOpen ? "Finish editing" : "Edit search criteria"
                  }
                  disabled={searchEditorOpen && hasUnsavedChanges}
                  onClick={() => setSearchEditorOpen((open) => !open)}
                >
                  {searchEditorOpen ? "Done" : <Pencil aria-hidden="true" />}
                </button>
              )}
            </header>
            {(!hasDiscoveryLeads || searchEditorOpen) && (
              <>
                <div className="discovery-basics">
                  <div className="discovery-role-field">
                    <label htmlFor="discovery-target-roles">
                      Roles <span>one per line</span>
                    </label>
                    <textarea
                      className="discovery-field-control"
                      id="discovery-target-roles"
                      aria-label="Roles"
                      value={targetRoles}
                      onChange={(event) => setTargetRoles(event.target.value)}
                      placeholder={"Software Engineer\nProduct Manager"}
                      rows={2}
                      required
                    />
                  </div>
                  <div className="discovery-location-field">
                    <label htmlFor="discovery-location-picker">
                      Locations <span>choose any</span>
                    </label>
                    <div className="location-selector discovery-field-control">
                      <select
                        id="discovery-location-picker"
                        aria-label="Add a location"
                        value=""
                        onChange={(event) => {
                          setLocations((value) =>
                            appendLine(value, event.target.value),
                          );
                        }}
                      >
                        <option value="">Add a location…</option>
                        {locationOptions
                          .filter(
                            (option) =>
                              !selectedLocations.some(
                                (location) =>
                                  location.toLocaleLowerCase() ===
                                  option.toLocaleLowerCase(),
                              ),
                          )
                          .map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                      </select>
                      <div className="selected-locations" aria-live="polite">
                        {selectedLocations.map((location) => (
                          <button
                            className="selection-chip"
                            type="button"
                            key={location}
                            aria-label={`Remove location ${location}`}
                            onClick={() =>
                              setLocations((value) =>
                                toggleLine(value, location),
                              )
                            }
                          >
                            {location} <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <fieldset className="arrangement-options">
                  <legend>Work style</legend>
                  {[
                    ["remote", "Remote"],
                    ["hybrid", "Hybrid"],
                    ["onsite", "On-site"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={workArrangements.includes(value ?? "")}
                        onChange={(event) =>
                          setWorkArrangements((selected) =>
                            event.target.checked
                              ? [...selected, value ?? ""]
                              : selected.filter((item) => item !== value),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <details className="discovery-advanced">
                  <summary>
                    <span>More preferences</span>
                    <small>Seniority, pay, priorities and exclusions</small>
                  </summary>
                  <div className="discovery-advanced-fields">
                    <div className="field-row">
                      <label htmlFor="discovery-seniority">
                        Seniority
                        <select
                          id="discovery-seniority"
                          value={seniority}
                          onChange={(event) => setSeniority(event.target.value)}
                        >
                          {[
                            "flexible",
                            "mid",
                            "senior",
                            "staff",
                            "principal",
                            "lead",
                            "manager",
                            "director",
                            "entry",
                          ].map((value) => (
                            <option key={value} value={value}>
                              {value[0]?.toUpperCase()}
                              {value.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label htmlFor="discovery-ai-focus">
                        AI direction <span>optional</span>
                        <input
                          id="discovery-ai-focus"
                          value={aiFocus}
                          onChange={(event) => setAiFocus(event.target.value)}
                          placeholder="Production AI, agents, ML platforms"
                          maxLength={1000}
                        />
                      </label>
                    </div>
                    <div className="field-row compensation-fields">
                      <label htmlFor="discovery-compensation">
                        Minimum pay <span>optional</span>
                        <input
                          id="discovery-compensation"
                          type="number"
                          min={0}
                          step={1000}
                          value={minimumCompensation}
                          onChange={(event) =>
                            setMinimumCompensation(event.target.value)
                          }
                          placeholder="180000"
                        />
                      </label>
                      <label htmlFor="discovery-currency">
                        Currency
                        <input
                          id="discovery-currency"
                          value={currency}
                          onChange={(event) => setCurrency(event.target.value)}
                          maxLength={3}
                          pattern="[A-Za-z]{3}"
                        />
                      </label>
                    </div>
                    <div className="field-row preference-choice-fields">
                      <section
                        className="preference-choice-group"
                        aria-labelledby="discovery-priorities-label"
                      >
                        <header>
                          <h3 id="discovery-priorities-label">Priorities</h3>
                          <span>Choose any</span>
                        </header>
                        <div
                          className="preference-choice-buttons"
                          role="group"
                          aria-label="Priority options"
                        >
                          {displayedPriorities.map((priority) => {
                            const selected = selectedPriorities.some(
                              (item) =>
                                item.toLocaleLowerCase() ===
                                priority.toLocaleLowerCase(),
                            );
                            return (
                              <button
                                className="preference-choice"
                                type="button"
                                key={priority}
                                aria-pressed={selected}
                                onClick={() =>
                                  setPriorities((value) =>
                                    toggleLine(value, priority),
                                  )
                                }
                              >
                                {priority}
                              </button>
                            );
                          })}
                        </div>
                        <details className="custom-choice">
                          <summary>Add your own</summary>
                          <div>
                            <input
                              aria-label="Custom priority"
                              value={customPriority}
                              onChange={(event) =>
                                setCustomPriority(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addCustomPriority();
                                }
                              }}
                              placeholder="Another priority"
                            />
                            <button
                              type="button"
                              disabled={customPriority.trim().length === 0}
                              onClick={addCustomPriority}
                            >
                              Add
                            </button>
                          </div>
                        </details>
                      </section>
                      <section
                        className="preference-choice-group"
                        aria-labelledby="discovery-exclusions-label"
                      >
                        <header>
                          <h3 id="discovery-exclusions-label">Avoid</h3>
                          <span>Choose any</span>
                        </header>
                        <div
                          className="preference-choice-buttons"
                          role="group"
                          aria-label="Exclusion options"
                        >
                          {displayedExclusions.map((exclusion) => {
                            const selected = selectedExclusions.some(
                              (item) =>
                                item.toLocaleLowerCase() ===
                                exclusion.toLocaleLowerCase(),
                            );
                            return (
                              <button
                                className="preference-choice"
                                type="button"
                                key={exclusion}
                                aria-pressed={selected}
                                onClick={() =>
                                  setExclusions((value) =>
                                    toggleLine(value, exclusion),
                                  )
                                }
                              >
                                {exclusion}
                              </button>
                            );
                          })}
                        </div>
                        <details className="custom-choice">
                          <summary>Add your own</summary>
                          <div>
                            <input
                              aria-label="Custom exclusion"
                              value={customExclusion}
                              onChange={(event) =>
                                setCustomExclusion(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addCustomExclusion();
                                }
                              }}
                              placeholder="Something else to avoid"
                            />
                            <button
                              type="button"
                              disabled={customExclusion.trim().length === 0}
                              onClick={addCustomExclusion}
                            >
                              Add
                            </button>
                          </div>
                        </details>
                      </section>
                    </div>
                    <label className="check-row" htmlFor="discovery-active">
                      <input
                        id="discovery-active"
                        type="checkbox"
                        checked={active}
                        onChange={(event) => setActive(event.target.checked)}
                      />
                      Keep this search active
                    </label>
                  </div>
                </details>
                <div className="discovery-command-actions">
                  <button
                    className="primary"
                    type="submit"
                    aria-describedby={
                      missingSearchBasics
                        ? "discovery-search-required-help"
                        : undefined
                    }
                    disabled={
                      save.isPending ||
                      missingSearchBasics ||
                      (current !== undefined && !hasUnsavedChanges)
                    }
                  >
                    {save.isPending
                      ? "Saving…"
                      : current === undefined
                        ? "Save search"
                        : hasUnsavedChanges
                          ? "Save changes"
                          : "Saved"}
                  </button>
                </div>
                {missingSearchBasics && (
                  <p id="discovery-search-required-help" className="field-help">
                    Add at least one role and choose a work style before saving
                    this search.
                  </p>
                )}
                {hasUnsavedChanges && (
                  <p className="notice warning" role="status">
                    Save your changes before finding jobs.
                  </p>
                )}
                {diagnostics.data !== undefined && !dshAvailable && (
                  <p
                    className="notice warning discovery-runtime-status"
                    role="note"
                  >
                    DSH is not connected.{" "}
                    <Link to="/diagnostics">Check it here</Link>.
                  </p>
                )}
              </>
            )}
            {current?.active &&
              !hasUnsavedChanges &&
              (hasDiscoveryLeads && !searchEditorOpen ? (
                <div className="discovery-refresh-action">
                  {dshAvailable ? (
                    <button
                      ref={searchActionRef}
                      className="primary discovery-refresh-button"
                      type="button"
                      disabled={discover.isPending}
                      onClick={() => discover.mutate()}
                    >
                      <Sparkles aria-hidden="true" />
                      {discover.isPending
                        ? "Researching roles…"
                        : "Research again"}
                    </button>
                  ) : (
                    <small role="note">
                      <Sparkles aria-hidden="true" /> Role research is
                      unavailable. <Link to="/diagnostics">System status</Link>
                    </small>
                  )}
                </div>
              ) : (
                <section
                  className="discovery-next-action"
                  aria-labelledby="discovery-next-action-title"
                >
                  <div>
                    <p className="step-kicker">Next</p>
                    <h3 id="discovery-next-action-title">
                      Research roles from this direction
                    </h3>
                  </div>
                  <button
                    ref={searchActionRef}
                    className="primary"
                    type="button"
                    disabled={discover.isPending || !dshAvailable}
                    onClick={() => discover.mutate()}
                  >
                    <Sparkles aria-hidden="true" />
                    {discover.isPending
                      ? "Researching roles…"
                      : "Ask AI to research roles"}
                  </button>
                </section>
              ))}
            {discoveryNotice.length > 0 && (
              <p className="copy-status" role="status" aria-live="polite">
                {discoveryNotice}
              </p>
            )}
            <ErrorNotice error={save.error} />
            <ErrorNotice error={discover.error} />
          </form>
        </section>

        {snapshot.discoveryLeads.length > 0 && (
          <section
            className="discovery-inbox"
            aria-labelledby="discovery-inbox-title"
          >
            <header className="activity-head">
              <div>
                <p className="step-kicker">Results</p>
                <h2
                  id="discovery-inbox-title"
                  ref={inboxTitleRef}
                  tabIndex={-1}
                >
                  Roles to consider
                </h2>
              </div>
              <StatusPill
                tone={
                  snapshot.discoveryLeads.some((lead) => lead.state === "new")
                    ? "warning"
                    : "neutral"
                }
              >
                {
                  snapshot.discoveryLeads.filter((lead) => lead.state === "new")
                    .length
                }{" "}
                new
              </StatusPill>
            </header>
            {triageNotice.length > 0 && (
              <p className="notice good" role="status" aria-live="polite">
                {triageNotice}
              </p>
            )}
            {nextSavedOpportunityId !== null && (
              <section
                className="discovery-evaluation-handoff"
                aria-labelledby="discovery-evaluation-handoff-title"
              >
                <div>
                  <p className="step-kicker">Next</p>
                  <h3 id="discovery-evaluation-handoff-title">
                    Evaluate {savedDiscoveryLeads.length} saved{" "}
                    {savedDiscoveryLeads.length === 1 ? "job" : "jobs"}
                  </h3>
                </div>
                <Link
                  ref={evaluationActionRef}
                  className="button-link primary"
                  to={`/evaluations?opportunity=${encodeURIComponent(nextSavedOpportunityId)}`}
                >
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Link>
              </section>
            )}
            <Tabs.Root
              value={selectedInboxState}
              onValueChange={(value) =>
                setSelectedInboxState(
                  value as "new" | "shortlisted" | "dismissed",
                )
              }
            >
              <Tabs.List
                className="discovery-tabs"
                aria-label="Discovery lead state"
              >
                {[
                  ["new", "New"],
                  ["shortlisted", "Saved"],
                  ["dismissed", "Passed"],
                ].map(([state, label]) => (
                  <Tabs.Trigger key={state} value={state ?? "new"}>
                    {label} ·{" "}
                    {
                      snapshot.discoveryLeads.filter(
                        (lead) => lead.state === state,
                      ).length
                    }
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {["new", "shortlisted", "dismissed"].map((state) => {
                const matching = snapshot.discoveryLeads
                  .filter((lead) => lead.state === state)
                  .sort((left, right) =>
                    right.createdAt.localeCompare(left.createdAt),
                  );
                const page = Math.min(
                  pageByState[state] ?? 0,
                  Math.max(0, Math.ceil(matching.length / pageSize) - 1),
                );
                const visible = matching.slice(
                  page * pageSize,
                  (page + 1) * pageSize,
                );
                return (
                  <Tabs.Content key={state} value={state}>
                    {visible.length === 0 ? (
                      <Empty>
                        {state === "new"
                          ? "No new listings yet. Save your direction and run the DSH discovery request."
                          : `No ${state} listings.`}
                      </Empty>
                    ) : (
                      <div className="discovery-card-grid">
                        {visible.map((lead) => {
                          const sourceReasons = uniqueSignals(
                            lead.whyFound.filter((reason) =>
                              reason
                                .trim()
                                .toLocaleLowerCase()
                                .startsWith("current listing from "),
                            ),
                          );
                          const fitReasons = uniqueSignals(
                            lead.whyFound.filter(
                              (reason) =>
                                !reason
                                  .trim()
                                  .toLocaleLowerCase()
                                  .startsWith("current listing from "),
                            ),
                          );
                          const primaryReason =
                            fitReasons[0] ?? "Matches your saved search.";
                          const concerns = uniqueSignals([
                            ...lead.gaps,
                            ...lead.risks,
                          ]);
                          const primaryConcern =
                            concerns[0] ??
                            "No specific concern recorded — verify the listing before saving.";
                          const detailsOpen = expandedLeadId === lead.id;
                          const detailsId = `discovery-lead-details-${lead.id}`;
                          const sourceSummary =
                            sourceReasons.length > 0
                              ? sourceReasons.join(" ")
                              : `Current listing from ${listingSourceHost(lead.originalUrl)}.`;
                          return (
                            <article className="discovery-card" key={lead.id}>
                              <header>
                                <div>
                                  <p>{lead.organization}</p>
                                  <h3>{lead.roleTitle}</h3>
                                </div>
                              </header>
                              <p className="lead-meta">
                                {[
                                  lead.location,
                                  lead.workArrangement,
                                  lead.advertisedCompensation,
                                ]
                                  .filter((item) => item !== null)
                                  .join(" · ") || "Details not stated"}
                              </p>
                              <div className="lead-quick-read">
                                <section className="lead-signal">
                                  <h4>Why it surfaced</h4>
                                  <p className="lead-summary">
                                    {primaryReason}
                                  </p>
                                </section>
                                <section className="lead-signal lead-key-check">
                                  <h4>
                                    Check first
                                    {concerns.length > 1 && (
                                      <span>+{concerns.length - 1} more</span>
                                    )}
                                  </h4>
                                  <p>{primaryConcern}</p>
                                </section>
                              </div>
                              <div className="lead-actions">
                                <a
                                  className="lead-job-link"
                                  href={lead.originalUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  aria-label={`View ${lead.roleTitle} at ${lead.organization} (opens in a new tab)`}
                                >
                                  View job
                                </a>
                                {lead.state === "new" && (
                                  <>
                                    <button
                                      className="primary"
                                      type="button"
                                      aria-label={`Save ${lead.roleTitle} at ${lead.organization}`}
                                      disabled={triage.isPending}
                                      onClick={() =>
                                        triage.mutate({
                                          lead,
                                          decision: "shortlisted",
                                        })
                                      }
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Pass on ${lead.roleTitle} at ${lead.organization}`}
                                      disabled={triage.isPending}
                                      onClick={() =>
                                        triage.mutate({
                                          lead,
                                          decision: "dismissed",
                                        })
                                      }
                                    >
                                      Pass
                                    </button>
                                  </>
                                )}
                                {lead.state === "dismissed" && (
                                  <button
                                    type="button"
                                    aria-label={`Move ${lead.roleTitle} at ${lead.organization} to New`}
                                    disabled={triage.isPending}
                                    onClick={() =>
                                      triage.mutate({ lead, decision: "new" })
                                    }
                                  >
                                    Move to New
                                  </button>
                                )}
                                {lead.resultOpportunityId !== null && (
                                  <Link
                                    to={`/evaluations?opportunity=${encodeURIComponent(lead.resultOpportunityId)}`}
                                    aria-label={`Evaluate ${lead.roleTitle} at ${lead.organization}`}
                                  >
                                    Evaluate
                                  </Link>
                                )}
                                <button
                                  className="lead-more-toggle"
                                  type="button"
                                  aria-label={`${detailsOpen ? "Hide" : "Review"} details for ${lead.roleTitle} at ${lead.organization}`}
                                  aria-expanded={detailsOpen}
                                  aria-controls={detailsId}
                                  onClick={() =>
                                    setExpandedLeadId((activeId) =>
                                      activeId === lead.id ? null : lead.id,
                                    )
                                  }
                                >
                                  {detailsOpen ? "Hide details" : "Details"}
                                  <span>
                                    {concerns.length === 0
                                      ? "Context"
                                      : concerns.length === 1
                                        ? "1 check"
                                        : `${String(concerns.length)} checks`}
                                  </span>
                                </button>
                              </div>
                              {detailsOpen && (
                                <div
                                  className="lead-more-content"
                                  id={detailsId}
                                >
                                  {fitReasons.length > 0 && (
                                    <section>
                                      <h4>Why it surfaced</h4>
                                      <ul>
                                        {fitReasons.map((reason) => (
                                          <li key={reason}>{reason}</li>
                                        ))}
                                      </ul>
                                    </section>
                                  )}
                                  {concerns.length > 0 && (
                                    <section>
                                      <h4>Things to verify</h4>
                                      <ul>
                                        {concerns.map((concern) => (
                                          <li key={concern}>{concern}</li>
                                        ))}
                                      </ul>
                                    </section>
                                  )}
                                  {lead.matchedCriteria.length > 0 && (
                                    <section>
                                      <h4>Matches</h4>
                                      <p>{lead.matchedCriteria.join(" · ")}</p>
                                    </section>
                                  )}
                                  <p className="lead-source-note">
                                    <strong>Source</strong> {sourceSummary} Open
                                    the job for the full listing.
                                  </p>
                                  {lead.state === "new" && (
                                    <div className="lead-decision">
                                      <label htmlFor={`triage-note-${lead.id}`}>
                                        Add a note <span>optional</span>
                                        <input
                                          id={`triage-note-${lead.id}`}
                                          aria-label={`Note for ${lead.roleTitle} at ${lead.organization}`}
                                          value={triageNotes[lead.id] ?? ""}
                                          onChange={(event) =>
                                            setTriageNotes((notes) => ({
                                              ...notes,
                                              [lead.id]: event.target.value,
                                            }))
                                          }
                                          maxLength={1000}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                    {matching.length > pageSize && (
                      <nav
                        className="pagination"
                        aria-label={`${state} discovery pages`}
                      >
                        <button
                          type="button"
                          disabled={page === 0}
                          onClick={() =>
                            setPageByState((pages) => ({
                              ...pages,
                              [state]: page - 1,
                            }))
                          }
                        >
                          Previous
                        </button>
                        <span role="status" aria-live="polite">
                          Page {page + 1} of{" "}
                          {Math.ceil(matching.length / pageSize)}
                        </span>
                        <button
                          type="button"
                          disabled={(page + 1) * pageSize >= matching.length}
                          onClick={() =>
                            setPageByState((pages) => ({
                              ...pages,
                              [state]: page + 1,
                            }))
                          }
                        >
                          Next
                        </button>
                      </nav>
                    )}
                  </Tabs.Content>
                );
              })}
            </Tabs.Root>
            <ErrorNotice error={triage.error} />
          </section>
        )}
      </div>
    </>
  );
}

function Opportunities({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [organization, setOrganization] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [postingUrl, setPostingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [advertisedCompensation, setAdvertisedCompensation] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [description, setDescription] = useState("");
  const capture = useMutation({
    mutationFn: async () => {
      const originalLocator =
        postingUrl.trim().length > 0
          ? postingUrl.trim()
          : "user-entry://opportunity";
      const source = await mutate<SourceView>("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: description.trim(),
        originalLocator,
      });
      return mutate("/api/v1/opportunities", {
        sourceDocumentId: source.id,
        organization: organization.trim(),
        roleTitle: roleTitle.trim(),
        ...(postingUrl.trim().length > 0
          ? { originalUrl: postingUrl.trim() }
          : {}),
        ...(location.trim().length > 0 ? { location: location.trim() } : {}),
        ...(workArrangement.length > 0 ? { workArrangement } : {}),
        ...(advertisedCompensation.trim().length > 0
          ? { advertisedCompensation: advertisedCompensation.trim() }
          : {}),
        ...(requisitionId.trim().length > 0
          ? { requisitionId: requisitionId.trim() }
          : {}),
      });
    },
    onSuccess: async () => {
      setOrganization("");
      setRoleTitle("");
      setPostingUrl("");
      setLocation("");
      setWorkArrangement("");
      setAdvertisedCompensation("");
      setRequisitionId("");
      setDescription("");
      await refresh();
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Step 2 of 5 · Save roles"
        title="Captured opportunities"
        description="Save job postings here before you evaluate them."
        story={pageStories.opportunities}
        journeyStep={2}
      />
      <TaskDisclosure
        collapsed={snapshot.opportunities.length > 0}
        summary="Add another saved job"
        hint="Paste the posting when you’re ready"
      >
        <section className="panel task-panel">
          <header>
            <div>
              <p className="eyebrow">Do this now</p>
              <h2>Add a saved job</h2>
            </div>
            <small>Role, organization, and posting text are enough.</small>
          </header>
          <form
            className="opportunity-form"
            onSubmit={(event) => {
              event.preventDefault();
              capture.mutate();
            }}
          >
            <div className="field-row">
              <label htmlFor="opportunity-organization">
                Organization
                <input
                  id="opportunity-organization"
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Company or organization"
                  maxLength={300}
                  required
                />
              </label>
              <label htmlFor="opportunity-role">
                Role title
                <input
                  id="opportunity-role"
                  value={roleTitle}
                  onChange={(event) => setRoleTitle(event.target.value)}
                  placeholder="Senior AI Platform Engineer"
                  maxLength={300}
                  required
                />
              </label>
            </div>
            <label htmlFor="job-source">Posting text</label>
            <textarea
              id="job-source"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Paste the complete job description here. Career Workbench saves a local copy for comparison."
              required
            />
            <ProgressiveDetails
              className="form-details"
              summary="Add posting details"
              hint="Optional · location, compensation, URL, and requisition"
            >
              <div className="field-row">
                <label htmlFor="opportunity-location">
                  Location <span>optional</span>
                  <input
                    id="opportunity-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Chicago, IL · United States"
                    maxLength={300}
                  />
                </label>
                <label htmlFor="work-arrangement">
                  Work arrangement <span>optional</span>
                  <select
                    id="work-arrangement"
                    value={workArrangement}
                    onChange={(event) => setWorkArrangement(event.target.value)}
                  >
                    <option value="">Not stated</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="on-site">On-site</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </label>
              </div>
              <label htmlFor="advertised-compensation">
                Advertised compensation <span>optional</span>
                <input
                  id="advertised-compensation"
                  value={advertisedCompensation}
                  onChange={(event) =>
                    setAdvertisedCompensation(event.target.value)
                  }
                  placeholder="$180,000–$230,000 plus equity"
                  maxLength={300}
                />
              </label>
              <div className="field-row">
                <label htmlFor="posting-url">
                  Posting URL <span>optional</span>
                  <input
                    id="posting-url"
                    type="url"
                    value={postingUrl}
                    onChange={(event) => setPostingUrl(event.target.value)}
                    placeholder="https://company.example/jobs/123"
                    maxLength={2048}
                  />
                </label>
                <label htmlFor="requisition-id">
                  Requisition ID <span>optional</span>
                  <input
                    id="requisition-id"
                    value={requisitionId}
                    onChange={(event) => setRequisitionId(event.target.value)}
                    placeholder="REQ-12345"
                    maxLength={200}
                  />
                </label>
              </div>
            </ProgressiveDetails>
            <button
              className="primary"
              type="submit"
              disabled={capture.isPending}
            >
              Capture opportunity
            </button>
          </form>
          <ErrorNotice error={capture.error} />
        </section>
      </TaskDisclosure>
      <div className="card-grid">
        {snapshot.opportunities.length === 0 ? (
          <Empty>No opportunities captured yet.</Empty>
        ) : (
          snapshot.opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              source={snapshot.sources.find(
                (item) => item.id === opportunity.sourceDocumentId,
              )}
            />
          ))
        )}
      </div>
    </>
  );
}

function OpportunityCard({
  opportunity,
  source,
}: {
  readonly opportunity: OpportunityView;
  readonly source: SourceView | undefined;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [sourceStatus, setSourceStatus] = useState(opportunity.sourceStatus);
  const [legitimacyStatus, setLegitimacyStatus] = useState(
    opportunity.legitimacyStatus,
  );
  const update = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/opportunities/${opportunity.id}/signals`, {
        expectedRevision: opportunity.revision,
        sourceStatus,
        legitimacyStatus,
      }),
    onSuccess: refresh,
  });
  return (
    <article className="opportunity-card">
      <div className="signal-pills">
        <StatusPill
          tone={opportunity.sourceStatus === "active" ? "good" : "neutral"}
        >
          liveness {opportunity.sourceStatus}
        </StatusPill>
        <StatusPill
          tone={
            opportunity.legitimacyStatus === "high_confidence"
              ? "good"
              : opportunity.legitimacyStatus === "concern"
                ? "warning"
                : "neutral"
          }
        >
          legitimacy {opportunity.legitimacyStatus.replaceAll("_", " ")}
        </StatusPill>
      </div>
      <h2>{opportunity.roleTitle}</h2>
      <p>{opportunity.organization}</p>
      <div className="record-snapshot" aria-label="Opportunity summary">
        <span>{opportunity.location ?? "Location not stated"}</span>
        <span>{opportunity.workArrangement ?? "Arrangement not stated"}</span>
        <span>
          {opportunity.advertisedCompensation ?? "Compensation not stated"}
        </span>
      </div>
      <Link
        className="button-link secondary opportunity-evaluate-link"
        to={`/evaluations?opportunity=${opportunity.id}`}
      >
        Evaluate this job <ArrowRight aria-hidden="true" />
      </Link>
      <ProgressiveDetails
        summary="Review posting and signals"
        hint="Saved source, identifiers, and verification controls"
      >
        <dl>
          <div>
            <dt>Requisition</dt>
            <dd>{opportunity.requisitionId ?? "Not stated"}</dd>
          </div>
          <div>
            <dt>Source URL</dt>
            <dd className="source-url">
              {opportunity.originalUrl ?? "Pasted without a URL"}
            </dd>
          </div>
        </dl>
        <details className="source-inspection">
          <summary>View saved posting text</summary>
          <div className="source-inspection-body">
            {source === undefined ? (
              <Empty>
                The preserved source is unavailable in this snapshot.
              </Empty>
            ) : source.inlineText === null ? (
              <Empty>The saved posting text is not shown here.</Empty>
            ) : (
              <pre>{source.inlineText}</pre>
            )}
          </div>
        </details>
        <form
          className="signal-form"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate();
          }}
        >
          <label>
            Posting liveness
            <select
              value={sourceStatus}
              onChange={(event) => setSourceStatus(event.target.value)}
            >
              {["unknown", "active", "expired", "unavailable"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Legitimacy signals
            <select
              value={legitimacyStatus}
              onChange={(event) => setLegitimacyStatus(event.target.value)}
            >
              {["unknown", "high_confidence", "needs_review", "concern"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <button type="submit" disabled={update.isPending}>
            Save signals
          </button>
        </form>
        <small>
          Revision {opportunity.revision}. Liveness and legitimacy are
          independent.
        </small>
      </ProgressiveDetails>
      <ErrorNotice error={update.error} />
    </article>
  );
}

interface OpportunityChoice {
  readonly opportunity: OpportunityView;
  readonly label: string;
  readonly searchText: string;
}

function normalizeEvaluationSearch(value: string, locale: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase(locale);
}

function opportunityChoices(
  opportunities: readonly OpportunityView[],
  locale: string,
): readonly OpportunityChoice[] {
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  const sorted = [...opportunities].sort(
    (left, right) =>
      collator.compare(left.roleTitle, right.roleTitle) ||
      collator.compare(left.organization, right.organization) ||
      collator.compare(left.requisitionId ?? "", right.requisitionId ?? "") ||
      left.id.localeCompare(right.id),
  );
  const baseCounts = new Map<string, number>();
  const requisitionCounts = new Map<string, number>();
  for (const item of sorted) {
    const base = `${item.roleTitle} — ${item.organization}`;
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
    if (item.requisitionId !== null) {
      const requisitionKey = `${base}\u0000${item.requisitionId}`;
      requisitionCounts.set(
        requisitionKey,
        (requisitionCounts.get(requisitionKey) ?? 0) + 1,
      );
    }
  }
  const seen = new Map<string, number>();
  const requisitionSeen = new Map<string, number>();
  return sorted.map((opportunity) => {
    const base = `${opportunity.roleTitle} — ${opportunity.organization}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    const duplicateCount = baseCounts.get(base) ?? 1;
    let discriminator = `saved job ${String(occurrence)} of ${String(duplicateCount)}`;
    if (opportunity.requisitionId !== null) {
      const requisitionKey = `${base}\u0000${opportunity.requisitionId}`;
      const sameRequisitionCount = requisitionCounts.get(requisitionKey) ?? 1;
      const requisitionOccurrence =
        (requisitionSeen.get(requisitionKey) ?? 0) + 1;
      requisitionSeen.set(requisitionKey, requisitionOccurrence);
      discriminator = `requisition ${opportunity.requisitionId}${
        sameRequisitionCount > 1
          ? ` · duplicate ${String(requisitionOccurrence)} of ${String(sameRequisitionCount)}`
          : ""
      }`;
    }
    return {
      opportunity,
      label: duplicateCount === 1 ? base : `${base} · ${discriminator}`,
      searchText: normalizeEvaluationSearch(
        `${opportunity.roleTitle} ${opportunity.organization}`,
        locale,
      ),
    };
  });
}

function JobPicker({
  choices,
  selectedId,
  locale,
  onSelect,
}: {
  readonly choices: readonly OpportunityChoice[];
  readonly selectedId: string;
  readonly locale: string;
  readonly onSelect: (opportunityId: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const openerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = choices.find(
    (choice) => choice.opportunity.id === selectedId,
  );
  const normalizedQuery = normalizeEvaluationSearch(queryText, locale);
  const filtered = choices.filter((choice) =>
    choice.searchText.includes(normalizedQuery),
  );
  useEffect(() => setActiveIndex(0), [queryText]);
  const select = (opportunityId: string): void => {
    onSelect(opportunityId);
    setOpen(false);
  };
  const move = (nextIndex: number): void => {
    if (filtered.length === 0) return;
    const bounded = (nextIndex + filtered.length) % filtered.length;
    setActiveIndex(bounded);
    optionRefs.current[bounded]?.focus();
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setQueryText("");
          setActiveIndex(0);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="evaluation-picker-trigger"
          type="button"
          ref={openerRef}
          aria-label={`Change selected job. Current job: ${selected?.label ?? "none"}`}
        >
          <Search aria-hidden="true" />
          <span>{selected === undefined ? "Choose job" : "Change job"}</span>
          <small>{choices.length} saved</small>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="evaluation-dialog-overlay" />
        <Dialog.Content
          className="evaluation-dialog evaluation-picker-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          <div className="evaluation-dialog-heading">
            <div>
              <Dialog.Title>Choose a saved job</Dialog.Title>
              <Dialog.Description>
                Search by role or organization. Results are ordered by role,
                then organization.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close saved job picker">
                Close
              </button>
            </Dialog.Close>
          </div>
          <label className="evaluation-picker-search">
            Search saved jobs
            <input
              ref={searchRef}
              type="search"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(0);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(filtered.length - 1);
                }
              }}
              aria-controls="evaluation-job-results"
              autoComplete="off"
            />
          </label>
          <p className="evaluation-picker-count" aria-live="polite">
            {filtered.length === 0
              ? "No matching saved jobs"
              : `${String(filtered.length)} matching ${filtered.length === 1 ? "job" : "jobs"}`}
          </p>
          {filtered.length === 0 ? (
            <p className="evaluation-picker-empty" role="status">
              No saved jobs match that role or organization.
            </p>
          ) : (
            <div
              className="evaluation-picker-results"
              id="evaluation-job-results"
              role="listbox"
              aria-label="Saved jobs"
            >
              {filtered.map((choice, index) => (
                <button
                  key={choice.opportunity.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`evaluation-job-${choice.opportunity.id}`}
                  type="button"
                  role="option"
                  aria-selected={choice.opportunity.id === selectedId}
                  aria-label={choice.label}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => select(choice.opportunity.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      move(index + 1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      move(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      move(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      move(filtered.length - 1);
                    } else if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(choice.opportunity.id);
                    }
                  }}
                >
                  <strong>{choice.opportunity.roleTitle}</strong>
                  <span>{choice.opportunity.organization}</span>
                  {choice.label !==
                    `${choice.opportunity.roleTitle} — ${choice.opportunity.organization}` && (
                    <small>
                      {choice.label.slice(
                        `${choice.opportunity.roleTitle} — ${choice.opportunity.organization} · `
                          .length,
                      )}
                    </small>
                  )}
                </button>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function timestampValue(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAbsoluteTimestamp(
  timestamp: string,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(new Date(timestamp));
}

function evaluationStateLabel(state: string): string {
  if (state === "not_evaluated") return "Not evaluated";
  if (state === "waiting_for_user") return "Waiting for user";
  return `${state.slice(0, 1).toUpperCase()}${state.slice(1).replaceAll("_", " ")}`;
}

function evaluationStateMessage(state: string): string {
  const messages: Readonly<Record<string, string>> = {
    canceled: "The latest check was canceled; no new result was committed.",
    completed: "The latest fit check completed with an authoritative result.",
    failed:
      "The latest check failed; any earlier completed result remains separate.",
    indeterminate:
      "The latest operation has no trusted terminal and will not be replayed silently.",
    not_evaluated: "This saved job has not been checked yet.",
    pending: "The check is admitted but has not started.",
    queued: "The check is queued and has not produced a result.",
    running:
      "A new check is running; any score shown is the last completed result.",
    stale: "The saved result no longer reflects the current evidence.",
    waiting_for_user: "The check needs user input before it can continue.",
  };
  return messages[state] ?? `Authoritative evaluation state: ${state}.`;
}

function criticalEvaluationFinding(
  evaluation: EvaluationView | undefined,
  state: string,
  operation: OperationView | undefined,
): string {
  if (
    (state === "failed" || state === "canceled" || state === "indeterminate") &&
    operation?.terminalMessage !== null &&
    operation?.terminalMessage !== undefined
  )
    return operation.terminalMessage;
  const staleReason = evaluation?.staleReason;
  if (state === "stale" && staleReason !== null && staleReason !== undefined)
    return staleReason;
  const fallbacks: Readonly<Record<string, string>> = {
    not_evaluated: "No completed fit evidence exists for this saved job.",
    pending: "No fit result exists until the admitted check finishes.",
    queued: "No fit result exists until the queued check finishes.",
    running: "Do not treat the in-progress check as a final fit result.",
    stale: "The prior result is stale and should be checked again.",
    waiting_for_user: "The requested input is blocking a trustworthy result.",
  };
  if (state !== "completed")
    return (
      fallbacks[state] ?? "No final fit result is available for this check."
    );
  const authoritative = evaluation?.criticalFindings[0];
  if (authoritative !== undefined) return authoritative;
  const contradiction = evaluation?.contradictions[0];
  if (contradiction !== undefined) return contradiction;
  const gap = evaluation?.gaps[0];
  if (gap !== undefined) return gap;
  const completedFallback =
    "No critical contradiction is recorded; compare the result with your priorities.";
  return completedFallback;
}

function evaluationDelta(
  evaluation: EvaluationView,
  newestFirst: readonly EvaluationView[],
): string {
  if (evaluation.state !== "completed") return "Not comparable";
  const position = newestFirst.findIndex((item) => item.id === evaluation.id);
  const olderCompleted = newestFirst
    .slice(position + 1)
    .filter((item) => item.state === "completed");
  const preceding = olderCompleted.find(
    (item) => item.rubricId === evaluation.rubricId,
  );
  if (preceding === undefined)
    return olderCompleted.length === 0 ? "New" : "Not comparable";
  const points =
    (evaluation.aggregateScoreBasisPoints -
      preceding.aggregateScoreBasisPoints) /
    100;
  const formatted = Number.isInteger(points)
    ? points.toFixed(0)
    : points.toFixed(1);
  return `${points > 0 ? "+" : ""}${formatted} pp`;
}

function evaluationHasRecordedScore(evaluation: EvaluationView): boolean {
  return evaluation.state === "completed" || evaluation.state === "stale";
}

function Evaluations({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = snapshot.workspace?.locale ?? "en-US";
  const timezone = snapshot.workspace?.timezone ?? "UTC";
  const choices = opportunityChoices(snapshot.opportunities, locale);
  const requestedOpportunityId = new URLSearchParams(location.search).get(
    "opportunity",
  );
  const requestedOpportunity = snapshot.opportunities.find(
    (opportunity) => opportunity.id === requestedOpportunityId,
  );
  const opportunityId =
    requestedOpportunity?.id ?? choices[0]?.opportunity.id ?? "";
  const opportunity = snapshot.opportunities.find(
    (item) => item.id === opportunityId,
  );
  const hasVerifiedCareerFact = snapshot.profileFacts.some(
    (fact) =>
      fact.status === "verified" &&
      (fact.factType === "experience" || fact.factType === "achievement"),
  );
  const selectedEvaluations = snapshot.evaluations
    .filter((evaluation) => evaluation.opportunityId === opportunityId)
    .toSorted(
      (left, right) =>
        timestampValue(right.createdAt) - timestampValue(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  const latestEvaluation = selectedEvaluations[0];
  const latestCompleted = selectedEvaluations.find(
    (evaluation) => evaluation.state === "completed",
  );
  const relevantOperations = snapshot.operations
    .filter(
      (operation) =>
        operation.kind === "evaluation" &&
        operation.inputIdentity === opportunityId,
    )
    .toSorted(
      (left, right) =>
        timestampValue(right.lastActivityAt) -
          timestampValue(left.lastActivityAt) ||
        right.id.localeCompare(left.id),
    );
  const latestOperation = relevantOperations[0];
  const operationIsCurrent =
    latestOperation !== undefined &&
    latestOperation.state !== "succeeded" &&
    timestampValue(latestOperation.lastActivityAt) >=
      timestampValue(latestEvaluation?.updatedAt);
  const currentOperation = operationIsCurrent
    ? latestOperation
    : latestEvaluation?.operationId === null ||
        latestEvaluation?.operationId === undefined
      ? undefined
      : snapshot.operations.find(
          (operation) => operation.id === latestEvaluation.operationId,
        );
  const currentState = operationIsCurrent
    ? latestOperation.state
    : (latestEvaluation?.state ?? "not_evaluated");
  const checkIsActive = [
    "pending",
    "queued",
    "running",
    "waiting_for_user",
  ].includes(currentState);
  const summaryEvaluation =
    latestEvaluation?.state === "completed" ||
    latestEvaluation?.state === "stale"
      ? latestEvaluation
      : (latestCompleted ?? latestEvaluation);
  const historyEvaluations = selectedEvaluations.filter(
    (evaluation) => evaluation.id !== latestEvaluation?.id,
  );
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [detailEvaluationId, setDetailEvaluationId] = useState<string | null>(
    null,
  );
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setShowAllHistory(false);
    setDetailEvaluationId(null);
  }, [opportunityId]);
  useEffect(() => {
    if (
      requestedOpportunity === undefined &&
      opportunityId !== "" &&
      requestedOpportunityId !== opportunityId
    ) {
      void navigate(
        `/evaluations?opportunity=${encodeURIComponent(opportunityId)}`,
        { replace: true },
      );
    }
  }, [navigate, opportunityId, requestedOpportunity, requestedOpportunityId]);
  const selectOpportunity = (nextOpportunityId: string): void => {
    void navigate(
      `/evaluations?opportunity=${encodeURIComponent(nextOpportunityId)}`,
      { replace: true },
    );
  };
  const run = useMutation({
    mutationFn: () => mutate("/api/v1/evaluations/fixture", { opportunityId }),
    onSuccess: refresh,
  });
  const openDetails = (evaluationId: string, trigger: HTMLElement): void => {
    detailTriggerRef.current = trigger;
    setDetailEvaluationId(evaluationId);
  };
  const detailEvaluation = snapshot.evaluations.find(
    (evaluation) => evaluation.id === detailEvaluationId,
  );
  const detailUsesCurrentOperation =
    currentOperation !== undefined &&
    detailEvaluation?.operationId === currentOperation.id;
  const detailIsCurrent =
    detailEvaluation?.id === latestEvaluation?.id &&
    (!operationIsCurrent || detailUsesCurrentOperation);
  const visibleHistory = showAllHistory
    ? historyEvaluations
    : historyEvaluations.slice(0, 5);
  return (
    <>
      <PageHeader
        className="evaluation-page-header"
        eyebrow="Step 3 of 5 · Check fit"
        title="Fit check"
        description="See the current fit, the concern that matters most, and what to do next."
        story={pageStories.evaluations}
        journeyStep={3}
      />
      {snapshot.opportunities.length === 0 ? (
        <section className="evaluation-empty-state" aria-labelledby="no-jobs">
          <header>
            <div className="evaluation-job-identity">
              <p className="eyebrow">Current job · none</p>
              <h2 id="no-jobs">Save a job before checking fit</h2>
            </div>
            <div className="evaluation-current-score" aria-label="Fit result">
              <small>Fit result</small>
              <strong className="evaluation-no-score">Not available</strong>
            </div>
          </header>
          <div className="evaluation-state-line">
            <StatusPill tone="neutral">No saved jobs</StatusPill>
            <span>No evaluation can start until a saved job is selected.</span>
          </div>
          <p className="evaluation-caveat" role="note">
            <AlertTriangle aria-hidden="true" />
            Fit evidence supports your decision—it is not an application
            recommendation.
          </p>
          <section className="evaluation-primary-concern" role="note">
            <small>Most important concern</small>
            <p>There is no saved job to evaluate yet.</p>
          </section>
          <div className="evaluation-next-action" data-next-action>
            <span>
              <small>Next action</small>
              <strong>Add a role you want to evaluate.</strong>
            </span>
            <Link className="button-link primary" to="/opportunities">
              Save a job
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section
            className="evaluation-toolbar"
            aria-label="Fit check controls"
          >
            <JobPicker
              choices={choices}
              selectedId={opportunityId}
              locale={locale}
              onSelect={selectOpportunity}
            />
            <button
              className="primary evaluation-check-button"
              type="button"
              disabled={
                run.isPending ||
                checkIsActive ||
                opportunityId === "" ||
                !hasVerifiedCareerFact
              }
              aria-label={`${latestEvaluation === undefined ? "Check fit" : "Check fit again"} for ${opportunity?.roleTitle ?? "selected job"} at ${opportunity?.organization ?? "selected organization"}`}
              onClick={() => run.mutate()}
            >
              {run.isPending
                ? "Checking…"
                : currentState === "waiting_for_user"
                  ? "Input needed"
                  : checkIsActive
                    ? "Check in progress"
                    : latestEvaluation === undefined
                      ? "Check fit"
                      : "Check again"}
            </button>
          </section>
          <ErrorNotice error={run.error} />
          {opportunity !== undefined && (
            <section className="current-evaluation">
              <EvaluationSummary
                opportunity={opportunity}
                evaluation={summaryEvaluation}
                currentEvaluation={latestEvaluation}
                currentState={
                  hasVerifiedCareerFact ? currentState : "no_evidence"
                }
                operation={currentOperation}
                runPending={run.isPending}
                hasVerifiedCareerFact={hasVerifiedCareerFact}
                onRun={() => run.mutate()}
                onOpenDetails={openDetails}
              />
            </section>
          )}
          {historyEvaluations.length > 0 && opportunity !== undefined && (
            <details className="evaluation-history">
              <summary
                aria-label={`Evaluation history for ${opportunity.roleTitle} at ${opportunity.organization}, ${String(historyEvaluations.length)} runs`}
              >
                History · {historyEvaluations.length}
                <small>Newest first</small>
              </summary>
              <div className="evaluation-history-body">
                <p>
                  Times shown in {locale} · {timezone}
                </p>
                <ol className="evaluation-history-list">
                  {visibleHistory.map((evaluation) => (
                    <EvaluationHistoryRow
                      key={evaluation.id}
                      evaluation={evaluation}
                      opportunity={opportunity}
                      allEvaluations={selectedEvaluations}
                      locale={locale}
                      timezone={timezone}
                      runNumber={
                        selectedEvaluations.length -
                        selectedEvaluations.findIndex(
                          (item) => item.id === evaluation.id,
                        )
                      }
                      onOpenDetails={openDetails}
                    />
                  ))}
                </ol>
                {historyEvaluations.length > 5 && (
                  <button
                    className="evaluation-history-more"
                    type="button"
                    aria-expanded={showAllHistory}
                    onClick={() => setShowAllHistory((current) => !current)}
                  >
                    {showAllHistory
                      ? "Show five most recent"
                      : `Show all ${String(historyEvaluations.length)} runs`}
                  </button>
                )}
              </div>
            </details>
          )}
        </>
      )}
      <Dialog.Root
        open={detailEvaluation !== undefined}
        onOpenChange={(open) => {
          if (!open) setDetailEvaluationId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="evaluation-dialog-overlay" />
          {detailEvaluation !== undefined && opportunity !== undefined && (
            <Dialog.Content
              className="evaluation-dialog evaluation-detail-dialog"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                detailTriggerRef.current?.focus();
              }}
            >
              <EvaluationDetail
                key={detailEvaluation.id}
                evaluation={detailEvaluation}
                opportunity={opportunity}
                snapshot={snapshot}
                locale={locale}
                timezone={timezone}
                isCurrent={detailIsCurrent}
                displayState={
                  detailUsesCurrentOperation
                    ? currentState
                    : detailEvaluation.state
                }
                operation={
                  detailUsesCurrentOperation ? currentOperation : undefined
                }
              />
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function EvaluationSummary({
  opportunity,
  evaluation,
  currentEvaluation,
  currentState,
  operation,
  runPending,
  hasVerifiedCareerFact,
  onRun,
  onOpenDetails,
}: {
  readonly opportunity: OpportunityView;
  readonly evaluation: EvaluationView | undefined;
  readonly currentEvaluation: EvaluationView | undefined;
  readonly currentState: string;
  readonly operation: OperationView | undefined;
  readonly runPending: boolean;
  readonly hasVerifiedCareerFact: boolean;
  readonly onRun: () => void;
  readonly onOpenDetails: (evaluationId: string, trigger: HTMLElement) => void;
}): React.JSX.Element {
  const hasValidScore =
    evaluation !== undefined && evaluationHasRecordedScore(evaluation);
  const stateLabel =
    currentState === "no_evidence"
      ? "Career evidence needed"
      : evaluationStateLabel(currentState);
  const critical =
    currentState === "no_evidence"
      ? "A fit result cannot be trusted until career evidence is accepted."
      : criticalEvaluationFinding(evaluation, currentState, operation);
  const canReview = evaluation !== undefined;
  const activeState = [
    "pending",
    "queued",
    "running",
    "waiting_for_user",
  ].includes(currentState);
  const reviewPreservedResult =
    hasValidScore && currentState !== "completed" && canReview;
  const reviewCurrentRun =
    currentEvaluation !== undefined &&
    (!evaluationHasRecordedScore(currentEvaluation) ||
      currentEvaluation.id !== evaluation?.id);
  return (
    <article
      className={`evaluation-summary-card state-${currentState}`}
      data-evaluation-state={currentState}
    >
      <header>
        <div className="evaluation-job-identity">
          <p className="eyebrow">{opportunity.organization}</p>
          <h2>{opportunity.roleTitle}</h2>
        </div>
        <div className="evaluation-current-score" aria-label="Fit result">
          <small>
            {hasValidScore
              ? currentState === "completed"
                ? "Current fit"
                : currentState === "stale"
                  ? "Stale result"
                  : "Last completed"
              : "Fit result"}
          </small>
          {hasValidScore ? (
            <span>
              <strong>{evaluation.displayScore}</strong>
              <b>/100</b>
            </span>
          ) : (
            <strong className="evaluation-no-score">Not final</strong>
          )}
        </div>
      </header>
      <div className="evaluation-state-line">
        <StatusPill
          tone={
            currentState === "completed"
              ? "good"
              : currentState === "failed" || currentState === "canceled"
                ? "warning"
                : "neutral"
          }
        >
          {stateLabel}
        </StatusPill>
        <span>
          {currentState === "no_evidence"
            ? "Add accepted experience before running a fit check."
            : evaluationStateMessage(currentState)}
        </span>
      </div>
      <p className="evaluation-caveat" role="note">
        <AlertTriangle aria-hidden="true" />
        Fit evidence supports your decision—it is not an application
        recommendation.
      </p>
      <section className="evaluation-primary-concern" role="note">
        <small>Most important concern</small>
        <p>{critical}</p>
      </section>
      <div className="evaluation-next-action" data-next-action>
        <span>
          <small>Next action</small>
          <strong>
            {!hasVerifiedCareerFact
              ? "Add career evidence, then return to this job."
              : currentState === "completed"
                ? "Review the concern and its supporting evidence."
                : currentState === "waiting_for_user"
                  ? "Review the requested input and continue the check."
                  : activeState
                    ? "Follow the check until it reaches a trusted terminal."
                    : currentState === "not_evaluated"
                      ? "Run the first fit check for this job."
                      : "Run a new check while keeping the prior result visible."}
          </strong>
        </span>
        <div className="evaluation-next-actions">
          {reviewCurrentRun && (
            <button
              className="secondary"
              type="button"
              aria-label={`Review ${evaluationStateLabel(currentState).toLocaleLowerCase()} run evidence for ${opportunity.roleTitle} at ${opportunity.organization}`}
              onClick={(event) =>
                onOpenDetails(currentEvaluation.id, event.currentTarget)
              }
            >
              Review current run
            </button>
          )}
          {reviewPreservedResult && (
            <button
              className="secondary"
              type="button"
              aria-label={`${currentState === "stale" ? "Review stale fit evidence" : "Review last completed fit evidence"} for ${opportunity.roleTitle} at ${opportunity.organization}`}
              onClick={(event) =>
                onOpenDetails(evaluation.id, event.currentTarget)
              }
            >
              {currentState === "stale"
                ? "Review stale result"
                : "Review last result"}
            </button>
          )}
          {!hasVerifiedCareerFact ? (
            <Link className="button-link secondary" to="/profile">
              Add evidence
            </Link>
          ) : currentState === "completed" && canReview ? (
            <button
              className="secondary"
              type="button"
              aria-label={`Review full fit evidence for ${opportunity.roleTitle} at ${opportunity.organization}`}
              onClick={(event) =>
                onOpenDetails(evaluation.id, event.currentTarget)
              }
            >
              Review evidence
            </button>
          ) : activeState ? (
            <Link
              className="button-link secondary"
              to="/activity"
              aria-label={`${currentState === "waiting_for_user" ? "Review requested input" : "View evaluation activity"} for ${opportunity.roleTitle} at ${opportunity.organization}`}
            >
              {currentState === "waiting_for_user"
                ? "Review request"
                : "View activity"}
            </Link>
          ) : (
            <button
              className="secondary"
              type="button"
              disabled={runPending}
              aria-label={`Check fit for ${opportunity.roleTitle} at ${opportunity.organization}`}
              onClick={onRun}
            >
              {runPending ? "Checking…" : "Check fit"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EvaluationHistoryRow({
  evaluation,
  opportunity,
  allEvaluations,
  locale,
  timezone,
  runNumber,
  onOpenDetails,
}: {
  readonly evaluation: EvaluationView;
  readonly opportunity: OpportunityView;
  readonly allEvaluations: readonly EvaluationView[];
  readonly locale: string;
  readonly timezone: string;
  readonly runNumber: number;
  readonly onOpenDetails: (evaluationId: string, trigger: HTMLElement) => void;
}): React.JSX.Element {
  const timestamp = evaluation.createdAt;
  const formattedTimestamp = formatAbsoluteTimestamp(
    timestamp,
    locale,
    timezone,
  );
  const score = evaluationHasRecordedScore(evaluation)
    ? `${evaluation.displayScore}/100${evaluation.state === "stale" ? " · stale" : ""}`
    : "No final score";
  const delta = evaluationDelta(evaluation, allEvaluations);
  return (
    <li>
      <button
        type="button"
        aria-label={`Open run ${String(runNumber)} for ${opportunity.roleTitle} at ${opportunity.organization}, ${formattedTimestamp}, ${evaluationStateLabel(evaluation.state)}, ${score}, ${delta}`}
        onClick={(event) => onOpenDetails(evaluation.id, event.currentTarget)}
      >
        <span className="evaluation-history-identity">
          <strong>
            Run {runNumber} · {opportunity.roleTitle}
          </strong>
          <small>{opportunity.organization}</small>
          <time dateTime={timestamp}>{formattedTimestamp}</time>
        </span>
        <span className="evaluation-history-metrics">
          <b>{evaluationStateLabel(evaluation.state)}</b>
          <strong>{score}</strong>
          <small>{delta}</small>
        </span>
      </button>
    </li>
  );
}

function EvaluationEvidenceItem({
  evidence,
  snapshot,
}: {
  readonly evidence: EvidenceView;
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const source =
    evidence.sourceId === null
      ? undefined
      : snapshot.sources.find((item) => item.id === evidence.sourceId);
  const candidateFact =
    evidence.candidateFactId === null
      ? undefined
      : snapshot.profileFacts.find(
          (item) => item.id === evidence.candidateFactId,
        );
  return (
    <li className="evaluation-evidence-item">
      <strong>{evidence.claim}</strong>
      {candidateFact !== undefined && (
        <section className="evaluation-candidate-fact">
          <span>Accepted candidate fact</span>
          <p>{String(candidateFact.value ?? "No recorded value")}</p>
          <dl>
            {candidateFact.sourceLocators.map((locator, index) => {
              const factSource = snapshot.sources.find(
                (item) => item.id === locator.sourceId,
              );
              return (
                <div key={`${locator.sourceId}-${String(index)}`}>
                  <dt>Fact provenance {index + 1}</dt>
                  <dd>
                    {factSource?.originalLocator ?? locator.sourceId} ·
                    characters {locator.start}–{locator.end} · {locator.quote}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
      <dl>
        <div>
          <dt>Classification</dt>
          <dd>{evidence.classification.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>
            {evidence.decision}
            {evidence.decisionReason === null
              ? ""
              : ` · ${evidence.decisionReason}`}
          </dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>
            {source?.originalLocator ??
              evidence.sourceId ??
              "No source locator"}
          </dd>
        </div>
        <div>
          <dt>Exact locator</dt>
          <dd>
            {evidence.locator === null
              ? "No source-bound locator"
              : `characters ${String(evidence.locator.start)}–${String(evidence.locator.end)} · ${evidence.locator.quote}`}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function EvaluationDetail({
  evaluation,
  opportunity,
  snapshot,
  locale,
  timezone,
  isCurrent,
  displayState,
  operation,
}: {
  readonly evaluation: EvaluationView;
  readonly opportunity: OpportunityView;
  readonly snapshot: SnapshotResponse;
  readonly locale: string;
  readonly timezone: string;
  readonly isCurrent: boolean;
  readonly displayState: string;
  readonly operation: OperationView | undefined;
}): React.JSX.Element {
  const refresh = useRefresh();
  const seal = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/evaluations/${evaluation.id}/artifacts`, {}),
    onSuccess: refresh,
  });
  const acceptedEvidence = evaluation.acceptedEvidenceIds.flatMap((id) => {
    const evidence = snapshot.evidence.find((item) => item.id === id);
    return evidence === undefined ? [] : [evidence];
  });
  const acceptedCandidate = acceptedEvidence.filter(
    (item) => item.classification === "candidate_fact",
  );
  const acceptedAdditional = acceptedEvidence.filter(
    (item) => item.classification !== "candidate_fact",
  );
  const rejectedEvidence = snapshot.evidence.filter(
    (item) =>
      item.decision === "rejected" &&
      evaluation.operationId !== null &&
      item.proposedByOperationId === evaluation.operationId,
  );
  const artifacts = snapshot.artifacts.filter((item) =>
    item.evaluationIds.includes(evaluation.id),
  );
  const timestamp = formatAbsoluteTimestamp(
    evaluation.createdAt,
    locale,
    timezone,
  );
  const context = `${opportunity.roleTitle} at ${opportunity.organization}, ${timestamp}`;
  const hasRecordedScore = evaluationHasRecordedScore(evaluation);
  return (
    <>
      <div className="evaluation-dialog-heading">
        <div>
          <Dialog.Title>{opportunity.roleTitle}</Dialog.Title>
          <Dialog.Description>
            {opportunity.organization} ·{" "}
            <time dateTime={evaluation.createdAt}>{timestamp}</time>
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label={`Close evaluation details for ${context}`}
          >
            Close
          </button>
        </Dialog.Close>
      </div>
      <div className="evaluation-dialog-scroll">
        <div className="evaluation-detail-state">
          <StatusPill tone={displayState === "completed" ? "good" : "warning"}>
            {evaluationStateLabel(displayState)}
          </StatusPill>
          <span>
            {hasRecordedScore
              ? `${evaluation.displayScore}/100 · ${evaluation.state === "stale" ? "stale fit estimate" : "fit estimate"}, not a recommendation`
              : "No final score is presented for this run."}
          </span>
          {evaluation.state === "stale" && evaluation.staleReason !== null && (
            <span className="evaluation-stale-reason">
              Stale reason: {evaluation.staleReason}
            </span>
          )}
          {operation?.terminalMessage !== null &&
            operation?.terminalMessage !== undefined && (
              <span className="evaluation-terminal-message">
                {operation.terminalMessage}
              </span>
            )}
        </div>
        <Tabs.Root defaultValue="score">
          <Tabs.List aria-label={`Evaluation details for ${context}`}>
            <Tabs.Trigger
              value="score"
              aria-label={`Score details for ${context}`}
            >
              Score
            </Tabs.Trigger>
            <Tabs.Trigger
              value="evidence"
              aria-label={`Evidence details for ${context}`}
            >
              Evidence
            </Tabs.Trigger>
            <Tabs.Trigger
              value="findings"
              aria-label={`Findings for ${context}`}
            >
              Findings
            </Tabs.Trigger>
            <Tabs.Trigger
              value="artifacts"
              aria-label={`Artifacts for ${context}`}
            >
              Artifacts
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="score">
            {!hasRecordedScore && (
              <p className="evaluation-nonfinal-note">
                This run has no valid aggregate result.
              </p>
            )}
            {evaluation.dimensionScores.map((dimension) => (
              <div className="dimension" key={dimension.dimensionKey}>
                <div>
                  <strong>{dimension.dimensionKey}</strong>
                  <span>
                    {dimension.inputBasisPoints / 100}% · weight{" "}
                    {dimension.weightBasisPoints / 100}%
                  </span>
                </div>
                <meter min="0" max="10000" value={dimension.inputBasisPoints}>
                  {dimension.inputBasisPoints / 100}%
                </meter>
              </div>
            ))}
            <section className="evaluation-arithmetic">
              <h3>Score arithmetic</h3>
              <p className="math">{evaluation.arithmeticExplanation}</p>
            </section>
          </Tabs.Content>
          <Tabs.Content value="evidence">
            <section className="evaluation-evidence-section">
              <h3>Accepted candidate facts · {acceptedCandidate.length}</h3>
              {acceptedCandidate.length === 0 ? (
                <Empty>
                  No accepted candidate facts were bound to this run.
                </Empty>
              ) : (
                <ul>
                  {acceptedCandidate.map((evidence) => (
                    <EvaluationEvidenceItem
                      key={evidence.id}
                      evidence={evidence}
                      snapshot={snapshot}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section className="evaluation-evidence-section">
              <h3>
                Additional accepted evidence · {acceptedAdditional.length}
              </h3>
              {acceptedAdditional.length === 0 ? (
                <Empty>
                  No additional accepted evidence was bound to this run.
                </Empty>
              ) : (
                <ul>
                  {acceptedAdditional.map((evidence) => (
                    <EvaluationEvidenceItem
                      key={evidence.id}
                      evidence={evidence}
                      snapshot={snapshot}
                    />
                  ))}
                </ul>
              )}
            </section>
            <section className="evaluation-evidence-section rejected-evidence">
              <h3>Rejected evidence · {rejectedEvidence.length}</h3>
              {rejectedEvidence.length === 0 ? (
                <Empty>No related evidence was rejected.</Empty>
              ) : (
                <ul>
                  {rejectedEvidence.map((evidence) => (
                    <EvaluationEvidenceItem
                      key={evidence.id}
                      evidence={evidence}
                      snapshot={snapshot}
                    />
                  ))}
                </ul>
              )}
            </section>
          </Tabs.Content>
          <Tabs.Content value="findings">
            <div className="evaluation-findings">
              <section>
                <h3>Authoritative critical findings</h3>
                {evaluation.criticalFindings.length === 0 ? (
                  <Empty>No critical findings recorded.</Empty>
                ) : (
                  <ul>
                    {evaluation.criticalFindings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3>Gaps · {evaluation.gaps.length}</h3>
                {evaluation.gaps.length === 0 ? (
                  <Empty>No gaps recorded.</Empty>
                ) : (
                  <ul>
                    {evaluation.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3>Contradictions · {evaluation.contradictions.length}</h3>
                {evaluation.contradictions.length === 0 ? (
                  <Empty>No contradictions recorded.</Empty>
                ) : (
                  <ul>
                    {evaluation.contradictions.map((contradiction) => (
                      <li key={contradiction}>{contradiction}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </Tabs.Content>
          <Tabs.Content value="artifacts">
            {artifacts.length === 0 ? (
              isCurrent && evaluation.state === "completed" ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => seal.mutate()}
                  disabled={seal.isPending}
                  aria-label={`Seal immutable report for ${context}`}
                >
                  {seal.isPending ? "Sealing…" : "Seal immutable report"}
                </button>
              ) : (
                <Empty>No artifact was recorded for this run.</Empty>
              )
            ) : (
              artifacts.map((artifact) => (
                <ArtifactRow key={artifact.id} artifact={artifact} />
              ))
            )}
            <ErrorNotice error={seal.error} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </>
  );
}

function comparisonText(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function comparisonNumber(
  record: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

function approvalState(approval: ApprovalView): ApprovalView["state"] {
  if (
    (approval.state === "pending" || approval.state === "approved") &&
    Date.parse(approval.expiresAt) <= Date.now()
  )
    return "expired";
  return approval.state;
}

function ApprovalGate({
  effectKind,
  targetId,
  targetRevision,
  actionLabel,
  requestLabel,
  canRequest,
  ready = true,
  readinessMessage,
  requestDetails,
  approvedMessage,
  execute,
  contextLabel,
  heading = "Explicit approval",
  description = "Your approval is bound to this exact local change and revision before the DSH Agent can continue.",
  approveLabel = "Approve exact request",
  denyLabel = "Deny request",
}: {
  readonly effectKind: ApprovalView["effectKind"];
  readonly targetId: string;
  readonly targetRevision: number;
  readonly actionLabel: string;
  readonly requestLabel: string;
  readonly canRequest: boolean;
  readonly ready?: boolean;
  readonly readinessMessage?: string;
  readonly requestDetails?: Readonly<Record<string, unknown>>;
  readonly approvedMessage?: string;
  readonly execute?: (approval: ApprovalView) => Promise<unknown>;
  readonly contextLabel?: string;
  readonly heading?: string;
  readonly description?: string;
  readonly approveLabel?: string;
  readonly denyLabel?: string;
}): React.JSX.Element {
  const refresh = useRefresh();
  const client = useQueryClient();
  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => query<ApprovalListResponse>("/api/v1/approvals"),
  });
  const related = [...(approvals.data?.approvals ?? [])]
    .filter(
      (item) => item.effectKind === effectKind && item.targetId === targetId,
    )
    .reverse();
  const exact = related.find(
    (item) => item.expectedRevisions[targetId] === targetRevision,
  );
  const approval = (canRequest ? exact : undefined) ?? related[0];
  const state = approval === undefined ? null : approvalState(approval);
  const bindingIsCurrent =
    approval?.expectedRevisions[targetId] === targetRevision;
  const updateApprovals = async () => {
    await client.invalidateQueries({ queryKey: ["approvals"] });
  };
  const requestApproval = useMutation({
    mutationFn: () =>
      mutate<ApprovalView>("/api/v1/approvals", {
        effectKind,
        targetId,
        expectedRevision: targetRevision,
        expiresInSeconds: 300,
        ...requestDetails,
      }),
    onSuccess: updateApprovals,
  });
  const decideApproval = useMutation({
    mutationFn: (decision: "approved" | "denied") => {
      if (approval === undefined)
        throw new Error("Request a current approval first.");
      return mutate<ApprovalView>(`/api/v1/approvals/${approval.id}/decision`, {
        expectedRevision: approval.revision,
        decision,
      });
    },
    onSuccess: updateApprovals,
  });
  const executeApproval = useMutation({
    mutationFn: () => {
      if (approval === undefined || state !== "approved")
        throw new Error("Approve the current request before continuing.");
      if (execute === undefined)
        throw new Error(
          "This approval is consumed by the originating DSH Agent.",
        );
      return execute(approval);
    },
    onSuccess: async () => {
      await Promise.all([refresh(), updateApprovals()]);
    },
  });
  const showRequest =
    canRequest &&
    (approval === undefined ||
      !bindingIsCurrent ||
      state === "denied" ||
      state === "expired" ||
      state === "consumed");
  return (
    <section
      className="approval-gate"
      aria-label={`${effectKind.replaceAll(".", " ")} approval${contextLabel === undefined ? "" : ` for ${contextLabel}`}`}
    >
      <header>
        <div>
          <strong>{heading}</strong>
          <p>{description}</p>
        </div>
        <StatusPill
          tone={
            state === "approved" || state === "consumed"
              ? "good"
              : state === "pending"
                ? "warning"
                : "neutral"
          }
        >
          {state ?? "not requested"}
        </StatusPill>
      </header>
      {approval !== undefined && (
        <div className="approval-receipt" aria-live="polite">
          <strong>{approval.summary}</strong>
          <dl>
            <div>
              <dt>Bound revision</dt>
              <dd>{approval.expectedRevisions[targetId] ?? "unavailable"}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>
                <time dateTime={approval.expiresAt}>
                  {new Date(approval.expiresAt).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <ProgressiveDetails
            className="approval-technical"
            summary="Technical receipt"
            hint="Exact effect and machine identifiers"
          >
            <p>{approval.effectDescription}</p>
            <dl>
              <div>
                <dt>Effect</dt>
                <dd>{approval.effectKind}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>
                  <code>{approval.targetId}</code>
                </dd>
              </div>
              <div>
                <dt>Effect digest</dt>
                <dd>
                  <code>{approval.effectDigest}</code>
                </dd>
              </div>
            </dl>
          </ProgressiveDetails>
          {!bindingIsCurrent && canRequest && (
            <p className="approval-binding-warning">
              This receipt is not bound to current target revision{" "}
              {targetRevision}.
            </p>
          )}
        </div>
      )}
      {!ready && readinessMessage !== undefined && (
        <small
          className="approval-readiness"
          id={`approval-readiness-${targetId}`}
        >
          {readinessMessage}
        </small>
      )}
      {showRequest && (
        <button
          className="secondary"
          type="button"
          disabled={requestApproval.isPending || !ready}
          aria-describedby={
            !ready && readinessMessage !== undefined
              ? `approval-readiness-${targetId}`
              : undefined
          }
          aria-label={
            contextLabel === undefined
              ? undefined
              : `${requestLabel} for ${contextLabel}`
          }
          onClick={() => requestApproval.mutate()}
        >
          {requestApproval.isPending ? "Requesting…" : requestLabel}
        </button>
      )}
      {state === "pending" && bindingIsCurrent && (
        <div className="approval-decisions">
          <button
            className="primary"
            type="button"
            disabled={decideApproval.isPending}
            aria-label={
              contextLabel === undefined
                ? undefined
                : `${approveLabel} for ${contextLabel}`
            }
            onClick={() => decideApproval.mutate("approved")}
          >
            {approveLabel}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={decideApproval.isPending}
            aria-label={
              contextLabel === undefined
                ? undefined
                : `${denyLabel} for ${contextLabel}`
            }
            onClick={() => decideApproval.mutate("denied")}
          >
            {denyLabel}
          </button>
        </div>
      )}
      {state === "approved" && bindingIsCurrent && execute === undefined && (
        <p className="approval-readiness" role="status">
          {approvedMessage ??
            "Approved for the exact originating DSH Agent. Return to that conversation and ask it to continue."}
        </p>
      )}
      {state === "approved" &&
        bindingIsCurrent &&
        canRequest &&
        execute !== undefined && (
          <button
            className="primary"
            type="button"
            disabled={executeApproval.isPending}
            aria-label={
              contextLabel === undefined
                ? undefined
                : `${actionLabel} for ${contextLabel}`
            }
            onClick={() => executeApproval.mutate()}
          >
            {executeApproval.isPending ? "Executing…" : actionLabel}
          </button>
        )}
      <ErrorNotice
        error={
          approvals.error ??
          requestApproval.error ??
          decideApproval.error ??
          executeApproval.error
        }
      />
    </section>
  );
}

function ComparisonCard({
  comparison,
  snapshot,
}: {
  readonly comparison: ComparisonView;
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const evaluationLabel = (evaluationId: string): string => {
    const input = comparison.evaluationInputs.find(
      (item) => comparisonText(item, "evaluationId") === evaluationId,
    );
    const opportunity = snapshot.opportunities.find(
      (item) => item.id === comparisonText(input ?? {}, "opportunityId"),
    );
    return opportunity === undefined
      ? evaluationId
      : `${opportunity.roleTitle} · ${opportunity.organization}`;
  };
  const tone =
    comparison.state === "accepted"
      ? "good"
      : comparison.state === "stale"
        ? "warning"
        : "neutral";
  const highlights = comparison.scenarios.map((scenario, index) => {
    const label = comparisonText(scenario, "label") || "Scenario";
    const rankingValue = scenario["rankedEvaluationIds"];
    const evaluationId = Array.isArray(rankingValue)
      ? rankingValue.find((item): item is string => typeof item === "string")
      : undefined;
    const scoresValue = scenario["scoresBasisPoints"];
    const scores =
      typeof scoresValue === "object" &&
      scoresValue !== null &&
      !Array.isArray(scoresValue)
        ? (scoresValue as Readonly<Record<string, unknown>>)
        : {};
    return {
      key: `${label}-${String(index)}`,
      label,
      winner:
        evaluationId === undefined
          ? "No ranked opportunity"
          : evaluationLabel(evaluationId),
      score:
        evaluationId === undefined
          ? null
          : comparisonNumber(scores, evaluationId) / 100,
    };
  });
  return (
    <article className={`comparison-card ${comparison.state}`}>
      <header>
        <div>
          <p className="eyebrow">Sensitivity comparison</p>
          <h2>Three-opportunity sensitivity comparison</h2>
        </div>
        <StatusPill tone={tone}>{comparison.state}</StatusPill>
      </header>
      {comparison.staleReason !== null && (
        <div className="notice warning" role="status">
          <RefreshCw aria-hidden="true" />
          <span>Stale: {comparison.staleReason}</span>
        </div>
      )}
      <div className="comparison-highlights" aria-label="Scenario leaders">
        {highlights.map((highlight) => (
          <section key={highlight.key}>
            <span>{highlight.label}</span>
            <strong>{highlight.winner}</strong>
            {highlight.score !== null && <small>{highlight.score}% fit</small>}
          </section>
        ))}
      </div>
      {comparison.tradeoffs.length > 0 && (
        <div className="tradeoffs comparison-critical-tradeoffs">
          <h3>Trade-offs to review</h3>
          <ul>
            {comparison.tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            ))}
          </ul>
        </div>
      )}
      <ProgressiveDetails
        summary="Review exact rankings"
        hint="All scenarios, exact scores, and record binding"
      >
        <p className="comparison-binding">
          Bound to exact evaluation revisions. Scenario scores below were
          recomputed by Career Workbench; notebook output did not authorize this
          record. Policy {comparison.policyVersion}.
        </p>
        <div className="comparison-tables">
          {comparison.scenarios.map((scenario, index) => {
            const label = comparisonText(scenario, "label") || "Scenario";
            const scoresValue = scenario["scoresBasisPoints"];
            const scores =
              typeof scoresValue === "object" &&
              scoresValue !== null &&
              !Array.isArray(scoresValue)
                ? (scoresValue as Readonly<Record<string, unknown>>)
                : {};
            const rankingValue = scenario["rankedEvaluationIds"];
            const ranking = Array.isArray(rankingValue)
              ? rankingValue.filter(
                  (item): item is string => typeof item === "string",
                )
              : [];
            return (
              <table key={`${label}-${String(index)}`}>
                <caption>{label}</caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Scenario score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((evaluationId, rank) => (
                    <tr key={evaluationId}>
                      <td>{rank + 1}</td>
                      <th scope="row">{evaluationLabel(evaluationId)}</th>
                      <td>{comparisonNumber(scores, evaluationId) / 100}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </div>
      </ProgressiveDetails>
      {comparison.state !== "stale" && (
        <ApprovalGate
          effectKind="comparison.accept"
          targetId={comparison.id}
          targetRevision={comparison.revision}
          actionLabel="Accept comparison"
          requestLabel="Request approval to accept comparison"
          canRequest={comparison.state === "proposed"}
          execute={(approval) =>
            mutate(`/api/v1/comparisons/${comparison.id}/accept`, {
              expectedRevision: comparison.revision,
              approvalId: approval.id,
              expectedApprovalRevision: approval.revision,
            })
          }
        />
      )}
    </article>
  );
}

function Comparisons({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: loadDiagnostics,
  });
  const currentEvaluations = snapshot.evaluations.filter((evaluation) => {
    const operation = snapshot.operations.find(
      (item) => item.id === evaluation.operationId,
    );
    return (
      evaluation.state === "completed" &&
      operation !== undefined &&
      operation.route !== "deterministic"
    );
  }).length;
  const dshAvailable = diagnostics.data?.capabilities["dsh"] === true;
  const rlmAvailable = diagnostics.data?.capabilities["rlm"] === true;
  return (
    <>
      <PageHeader
        eyebrow="Step 3 of 5 · Compare"
        title="Opportunity comparisons"
        description="Compare evaluated roles using your priorities. You make the decision."
        story={pageStories.comparisons}
        journeyStep={3}
      />
      <div className="notice warning rlm-authority" role="note">
        <AlertTriangle aria-hidden="true" />
        <span>
          Advanced comparison is optional. When enabled, it can run local code
          with access to your computer and is not sandboxed. Only results that
          pass Workbench checks can update your records.
        </span>
      </div>
      <div className="card-list">
        {snapshot.comparisons.length === 0 ? (
          <section className="panel comparison-empty">
            <h2>Before you compare</h2>
            <p>
              Prepare three agent-evaluated roles and check that analysis is
              ready.
            </p>
            <ul className="comparison-prerequisites">
              <li>
                <StatusPill tone={currentEvaluations >= 3 ? "good" : "warning"}>
                  {currentEvaluations >= 3 ? "ready" : "needed"}
                </StatusPill>
                <span>
                  <strong>
                    {Math.min(currentEvaluations, 3)} of 3 agent-evaluated roles
                  </strong>
                  <Link to="/evaluations">Review evaluations</Link>
                </span>
              </li>
              <li>
                <StatusPill tone={dshAvailable ? "good" : "warning"}>
                  {diagnostics.isLoading
                    ? "checking"
                    : dshAvailable
                      ? "ready"
                      : "unavailable"}
                </StatusPill>
                <span>
                  <strong>
                    Agent connection {dshAvailable ? "ready" : "unavailable"}
                  </strong>
                  <Link to="/diagnostics">Open diagnostics</Link>
                </span>
              </li>
              <li>
                <StatusPill tone={rlmAvailable ? "good" : "warning"}>
                  {diagnostics.isLoading
                    ? "checking"
                    : rlmAvailable
                      ? "ready"
                      : "unavailable"}
                </StatusPill>
                <span>
                  <strong>
                    Advanced analysis {rlmAvailable ? "ready" : "unavailable"}
                  </strong>
                  <Link to="/diagnostics">Open diagnostics</Link>
                </span>
              </li>
            </ul>
            <div className="comparison-next-action">
              <strong>Next action</strong>
              <p>
                {diagnostics.isLoading
                  ? "Checking the agent and advanced analysis status…"
                  : !dshAvailable || !rlmAvailable
                    ? "Open System status and reconnect the missing analysis tools first."
                    : currentEvaluations < 3
                      ? "Complete three agent-assisted evaluations, then return here."
                      : "Ask your agent to compare the three roles. The result will appear here for review."}
              </p>
            </div>
          </section>
        ) : (
          [...snapshot.comparisons]
            .reverse()
            .map((comparison) => (
              <ComparisonCard
                key={comparison.id}
                comparison={comparison}
                snapshot={snapshot}
              />
            ))
        )}
      </div>
    </>
  );
}

function ArtifactRow({
  artifact,
}: {
  readonly artifact: ArtifactView;
}): React.JSX.Element {
  return (
    <div className="artifact">
      <FileCheck2 aria-hidden="true" />
      <div>
        <strong>{artifact.kind}</strong>
        <small>
          {artifact.contentDigest.slice(0, 18)}… · {artifact.byteLength} bytes
        </small>
      </div>
      <StatusPill tone={artifact.state === "sealed" ? "good" : "warning"}>
        {artifact.state}
      </StatusPill>
    </div>
  );
}

const applicationTransitions: Readonly<Record<string, readonly string[]>> = {
  considering: ["preparing", "withdrawn", "closed"],
  preparing: ["ready_for_review", "withdrawn", "closed"],
  ready_for_review: ["applied", "withdrawn", "closed"],
  applied: ["responded", "interview", "rejected", "withdrawn", "closed"],
  responded: ["interview", "offer", "rejected", "withdrawn", "closed"],
  interview: ["offer", "rejected", "withdrawn", "closed"],
  offer: ["hired", "withdrawn", "closed"],
  hired: [],
  rejected: [],
  withdrawn: [],
  closed: [],
};

function nextApplicationAction(
  application: ApplicationView,
  snapshot: SnapshotResponse,
): { readonly label: string; readonly to: "/drafts" | "/evaluations" } {
  const evaluation = snapshot.evaluations.find(
    (item) =>
      item.opportunityId === application.opportunityId &&
      item.state === "completed",
  );
  if (application.state === "considering" && evaluation === undefined) {
    return {
      label: "Evaluate this opportunity before preparing materials",
      to: "/evaluations",
    };
  }
  const draftLabels: Readonly<Record<string, string>> = {
    considering: "Prepare tailored materials",
    preparing: "Review and seal the current drafts",
    ready_for_review: "Inspect reviewed materials before submitting elsewhere",
  };
  const draftLabel = draftLabels[application.state];
  if (draftLabel !== undefined) return { label: draftLabel, to: "/drafts" };
  const evaluationLabels: Readonly<Record<string, string>> = {
    applied: "Review the evaluation while tracking a response",
    responded: "Review the evaluation before the next conversation",
    interview: "Review evaluation gaps before the interview",
    offer: "Review the evaluation before considering the offer",
    hired: "Review the retained evaluation record",
    rejected: "Review the evaluation before closing the loop",
    withdrawn: "Review the evaluation retained for this decision",
    closed: "Review the evaluation retained for this record",
  };
  return {
    label: evaluationLabels[application.state] ?? "Review current evaluation",
    to: "/evaluations",
  };
}

function applicationStateLabel(state: string): string {
  const words = state.replaceAll("_", " ");
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

function applicationHistoryLabel(event: DomainEventView): string {
  const from = event.payload["from"];
  const to = event.payload["to"];
  const state = event.payload["state"];
  if (
    event.eventKind === "application.transitioned" &&
    typeof from === "string" &&
    typeof to === "string"
  ) {
    return `${applicationStateLabel(from)} → ${applicationStateLabel(to)}`;
  }
  if (event.eventKind === "application.created" && typeof state === "string") {
    return `Started as ${applicationStateLabel(state)}`;
  }
  if (
    (event.eventKind === "application.imported" ||
      event.eventKind === "career_ops.application.imported") &&
    typeof state === "string"
  ) {
    return `Imported as ${applicationStateLabel(state)}`;
  }
  return applicationStateLabel(event.eventKind.replaceAll(".", " "));
}

function Pipeline({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const locale = snapshot.workspace?.locale ?? "en-US";
  const timezone = snapshot.workspace?.timezone ?? "UTC";
  const missing = snapshot.opportunities.filter(
    (opportunity) =>
      !snapshot.applications.some(
        (application) => application.opportunityId === opportunity.id,
      ),
  );
  const missingChoices = opportunityChoices(missing, locale);
  const [opportunityId, setOpportunityId] = useState(missing[0]?.id ?? "");
  useEffect(() => {
    if (opportunityId === "" && missing[0] !== undefined) {
      setOpportunityId(missing[0].id);
    }
  }, [missing, opportunityId]);
  const create = useMutation({
    mutationFn: () =>
      mutate("/api/v1/applications", {
        opportunityId,
        effectiveDate: new Date().toISOString().slice(0, 10),
        note: "Created through the local Workbench pipeline.",
      }),
    onSuccess: refresh,
  });
  return (
    <>
      <PageHeader
        eyebrow="Step 4 of 5 · Track progress"
        title="Application pipeline"
        description="Keep each opportunity’s current status and next action clear. Nothing here submits externally."
        story={pageStories.pipeline}
        journeyStep={4}
        className="pipeline-page-header"
      />
      <div className="pipeline-board">
        {snapshot.applications.length === 0 ? (
          snapshot.opportunities.length === 0 ? (
            <section className="empty-next-action">
              <h2>Save a job first</h2>
              <p>Add a job you want to track, then return to the pipeline.</p>
              <Link className="button-link primary" to="/opportunities">
                Go to saved jobs <ArrowRight aria-hidden="true" />
              </Link>
            </section>
          ) : (
            <Empty>Choose a saved job below to start tracking it.</Empty>
          )
        ) : (
          snapshot.applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              snapshot={snapshot}
              locale={locale}
              timezone={timezone}
            />
          ))
        )}
      </div>
      {missing.length > 0 && (
        <div className="pipeline-add-opportunity">
          <TaskDisclosure
            collapsed={snapshot.applications.length > 0}
            summary="Add another job"
            hint={`${String(snapshot.applications.length)} ${snapshot.applications.length === 1 ? "job" : "jobs"} tracked`}
            closedCue="Open form"
            openCue="Close form"
          >
            <section className="panel run-panel task-panel">
              <div>
                <p className="eyebrow">Do this now</p>
                <h2>Add a job to your pipeline</h2>
                <p>
                  It starts in Considering. You can change the status later.
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate();
                }}
              >
                <label htmlFor="pipeline-opportunity">Saved job</label>
                <select
                  id="pipeline-opportunity"
                  value={opportunityId}
                  onChange={(event) => setOpportunityId(event.target.value)}
                  required
                >
                  {missingChoices.map((choice) => (
                    <option
                      key={choice.opportunity.id}
                      value={choice.opportunity.id}
                    >
                      {choice.label}
                    </option>
                  ))}
                </select>
                <button
                  className="primary"
                  type="submit"
                  disabled={create.isPending}
                >
                  Add to pipeline
                </button>
              </form>
              <ErrorNotice error={create.error} />
            </section>
          </TaskDisclosure>
        </div>
      )}
    </>
  );
}

function ApplicationCard({
  application,
  snapshot,
  locale,
  timezone,
}: {
  readonly application: ApplicationView;
  readonly snapshot: SnapshotResponse;
  readonly locale: string;
  readonly timezone: string;
}): React.JSX.Element {
  const refresh = useRefresh();
  const allowed = applicationTransitions[application.state] ?? [];
  const [nextState, setNextState] = useState(allowed[0] ?? "");
  const [note, setNote] = useState(application.note ?? "");
  const effectiveDate = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    setNextState(allowed[0] ?? "");
  }, [application.state]);
  const transition = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/applications/${application.id}/transitions`, {
        expectedRevision: application.revision,
        state: nextState,
        effectiveDate,
        ...(note.trim().length === 0 ? {} : { note: note.trim() }),
      }),
    onSuccess: refresh,
  });
  const opportunity = snapshot.opportunities.find(
    (item) => item.id === application.opportunityId,
  );
  const history = snapshot.events
    .filter(
      (event) =>
        event.aggregateId === application.id &&
        (event.eventKind === "application.created" ||
          event.eventKind === "application.imported" ||
          event.eventKind === "career_ops.application.imported" ||
          event.eventKind === "application.transitioned"),
    )
    .sort((left, right) => right.sequence - left.sequence);
  const nextAction = nextApplicationAction(application, snapshot);
  const organization = opportunity?.organization ?? "Opportunity";
  const roleTitle = opportunity?.roleTitle ?? application.opportunityId;
  const applicationLabel = `${roleTitle} at ${organization}`;
  const applicationTitleId = `application-${application.id}-title`;
  return (
    <article className="application-card" aria-labelledby={applicationTitleId}>
      <header>
        <div className="application-identity">
          <p className="eyebrow">{organization}</p>
          <h2 id={applicationTitleId}>{roleTitle}</h2>
        </div>
        <span className="application-current-state">
          <small>Current status</small>
          <StatusPill
            tone={
              ["interview", "offer", "hired"].includes(application.state)
                ? "good"
                : ["rejected", "withdrawn", "closed"].includes(
                      application.state,
                    )
                  ? "neutral"
                  : "warning"
            }
          >
            {applicationStateLabel(application.state)}
          </StatusPill>
        </span>
      </header>
      <p className="next-action">
        <small>Next action</small>
        <Link to={nextAction.to}>{nextAction.label}</Link>
      </p>
      <ProgressiveDetails
        summary={allowed.length > 0 ? "Change status" : "View status history"}
        hint={`${String(history.length)} ${history.length === 1 ? "update" : "updates"} recorded`}
        summaryLabel={`${allowed.length > 0 ? "Change status" : "View status history"} for ${applicationLabel}. ${String(history.length)} ${history.length === 1 ? "update" : "updates"} recorded`}
        closedCue={allowed.length > 0 ? "Edit" : "View"}
      >
        <small className="application-record-meta">
          Entity revision {application.revision} · state revision{" "}
          {application.stateRevision} · effective {application.effectiveDate}
        </small>
        {allowed.length > 0 && (
          <form
            className="application-transition"
            onSubmit={(event) => {
              event.preventDefault();
              transition.mutate();
            }}
          >
            <label>
              New status
              <select
                aria-label={`New status for ${applicationLabel}`}
                value={nextState}
                onChange={(event) => setNextState(event.target.value)}
              >
                {allowed.map((state) => (
                  <option key={state} value={state}>
                    {applicationStateLabel(state)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local note
              <input
                aria-label={`Local note for ${applicationLabel}`}
                value={note}
                maxLength={2_000}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button
              className="secondary"
              type="submit"
              disabled={transition.isPending}
              aria-label={`Save status as ${applicationStateLabel(nextState)} for ${applicationLabel}`}
            >
              Save status
            </button>
          </form>
        )}
        <details className="application-history">
          <summary
            aria-label={`Transition history for ${applicationLabel}, ${String(history.length)} recorded change${history.length === 1 ? "" : "s"}`}
          >
            <span>Past status changes ({history.length})</span>
            <DisclosureCue closedLabel="View" openLabel="Hide" />
          </summary>
          <ol className="compact-history">
            {history.map((event) => (
              <li key={event.sequence}>
                <strong>{applicationHistoryLabel(event)}</strong>
                <time dateTime={event.timestamp}>
                  {formatAbsoluteTimestamp(event.timestamp, locale, timezone)}
                </time>
              </li>
            ))}
          </ol>
        </details>
      </ProgressiveDetails>
      {allowed.length > 0 && (
        <ApprovalGate
          effectKind="application.transition"
          targetId={application.id}
          targetRevision={application.revision}
          actionLabel="Continue in DSH"
          requestLabel={`Review change to ${applicationStateLabel(nextState)}`}
          canRequest={nextState !== ""}
          contextLabel={applicationLabel}
          heading="Agent change approval"
          description="A DSH Agent can change this local status only after you approve the exact change and revision."
          approveLabel="Approve status change"
          denyLabel="Keep current status"
          requestDetails={{
            applicationTransition: {
              state: nextState,
              effectiveDate,
              ...(note.trim().length === 0 ? {} : { note: note.trim() }),
            },
          }}
          approvedMessage="Exact transition approved for five minutes. Return to the originating DSH conversation and ask it to continue; the approval is single-use."
        />
      )}
      <ErrorNotice error={transition.error} />
    </article>
  );
}

function Drafts({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [kind, setKind] = useState("draft_cv");
  const [opportunityId, setOpportunityId] = useState(
    snapshot.opportunities[0]?.id ?? "",
  );
  const [styleNote, setStyleNote] = useState(
    "Direct and concise; preserve every qualifier.",
  );
  const acceptedFactIds = new Set(
    snapshot.evidence
      .filter(
        (item) =>
          item.classification === "candidate_fact" &&
          item.decision === "accepted" &&
          item.candidateFactId !== null,
      )
      .flatMap((item) =>
        item.candidateFactId === null ? [] : [item.candidateFactId],
      ),
  );
  const eligibleFacts = snapshot.profileFacts.filter(
    (fact) => fact.status === "verified" && acceptedFactIds.has(fact.id),
  );
  const generate = useMutation({
    mutationFn: () =>
      mutate("/api/v1/artifacts/candidate-drafts", {
        kind,
        opportunityId,
        factIds: eligibleFacts.map((fact) => fact.id),
        styleNote,
      }),
    onSuccess: refresh,
  });
  const drafts = snapshot.artifacts.filter((artifact) =>
    artifact.kind.startsWith("draft_"),
  );
  return (
    <>
      <PageHeader
        eyebrow="Step 5 of 5 · Prepare materials"
        title="Drafts and review"
        description="Create a local draft, inspect it, and decide when it is ready. Nothing is submitted."
        story={pageStories.drafts}
        journeyStep={5}
      />
      <TaskDisclosure
        collapsed={drafts.length > 0}
        summary="Create another draft"
        hint={`${String(drafts.length)} ${drafts.length === 1 ? "draft" : "drafts"} ready to review`}
      >
        <section className="panel draft-builder task-panel">
          <header>
            <div>
              <p className="eyebrow">Do this now</p>
              <h2>Prepare a draft</h2>
            </div>
            <small>Choose the material and the job it supports.</small>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              generate.mutate();
            }}
          >
            <div className="field-row">
              <label>
                Artifact type
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  <option value="draft_cv">CV draft</option>
                  <option value="draft_cover_letter">Cover-letter draft</option>
                  <option value="draft_outreach">Outreach draft</option>
                  <option value="draft_interview_prep">
                    Interview-preparation draft
                  </option>
                </select>
              </label>
              <label>
                Opportunity
                <select
                  value={opportunityId}
                  onChange={(event) => setOpportunityId(event.target.value)}
                  required
                >
                  {snapshot.opportunities.map((opportunity) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {opportunity.roleTitle} · {opportunity.organization}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ProgressiveDetails
              className="form-details"
              summary="Adjust writing style"
              hint="Optional · tone only, never candidate facts"
            >
              <label>
                Non-factual style direction
                <textarea
                  value={styleNote}
                  maxLength={1_000}
                  onChange={(event) => setStyleNote(event.target.value)}
                />
              </label>
            </ProgressiveDetails>
            <p className="trust-note">
              {eligibleFacts.length}{" "}
              {eligibleFacts.length === 1
                ? "career detail is"
                : "career details are"}{" "}
              ready. Generation stores a staged local draft; it sends nothing.
            </p>
            <button
              className="primary"
              type="submit"
              aria-describedby={
                opportunityId === "" || eligibleFacts.length === 0
                  ? "draft-prerequisite-help"
                  : undefined
              }
              disabled={
                generate.isPending ||
                opportunityId === "" ||
                eligibleFacts.length === 0
              }
            >
              Generate staged draft
            </button>
            {(opportunityId === "" || eligibleFacts.length === 0) && (
              <div id="draft-prerequisite-help" className="prerequisite-help">
                {opportunityId === "" && (
                  <p>
                    <Link to="/opportunities">Save a job first</Link> so the
                    draft has a target.
                  </p>
                )}
                {eligibleFacts.length === 0 && (
                  <p>
                    <Link to="/evaluations">Complete a fit check</Link> that
                    uses accepted career evidence before drafting.
                  </p>
                )}
              </div>
            )}
          </form>
          <ErrorNotice error={generate.error} />
        </section>
      </TaskDisclosure>
      <div className="card-list">
        {[...drafts].reverse().map((artifact) => (
          <DraftCard
            key={artifact.id}
            artifact={artifact}
            snapshot={snapshot}
          />
        ))}
        {drafts.length === 0 && <Empty>No candidate-facing drafts yet.</Empty>}
      </div>
    </>
  );
}

function DraftCard({
  artifact,
  snapshot,
}: {
  readonly artifact: ArtifactView;
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null);
  const [inspectedDigest, setInspectedDigest] = useState<string | null>(null);
  useEffect(() => {
    setContent(null);
    setInspectedDigest(null);
  }, [artifact.contentDigest]);
  const inspect = useMutation({
    mutationFn: () =>
      query<{ readonly text: string }>(
        `/api/v1/artifacts/${artifact.id}/content`,
      ),
    onSuccess: (result) => {
      setContent(result.text);
      setInspectedDigest(artifact.contentDigest);
    },
  });
  return (
    <article className={`draft-card ${artifact.state}`}>
      <header>
        <div>
          <p className="eyebrow">Local material</p>
          <h2>{artifact.kind.replaceAll("_", " ")}</h2>
        </div>
        <StatusPill
          tone={
            artifact.state === "sealed"
              ? "good"
              : artifact.state === "stale"
                ? "warning"
                : "neutral"
          }
        >
          {artifact.state === "sealed" ? "reviewed · sealed" : artifact.state}
        </StatusPill>
      </header>
      {artifact.staleReason !== null && (
        <div className="notice warning">
          <RefreshCw aria-hidden="true" /> {artifact.staleReason}
        </div>
      )}
      <p className="record-line">
        Built from {artifact.factIds.length} verified career detail
        {artifact.factIds.length === 1 ? "" : "s"}.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => inspect.mutate()}
          disabled={inspect.isPending}
        >
          Inspect draft
        </button>
      </div>
      <ProgressiveDetails
        summary="Review supporting records"
        hint="Career details, evidence, and saved sources"
      >
        <small>Artifact revision {artifact.revision}</small>
        <div className="provenance-grid">
          <div>
            <strong>{artifact.factIds.length}</strong>
            <span>career details</span>
          </div>
          <div>
            <strong>{artifact.evidenceIds.length}</strong>
            <span>supporting references</span>
          </div>
          <div>
            <strong>{artifact.sourceIds.length}</strong>
            <span>saved sources</span>
          </div>
        </div>
      </ProgressiveDetails>
      {artifact.state !== "stale" && (
        <ApprovalGate
          effectKind="artifact.review"
          targetId={artifact.id}
          targetRevision={artifact.revision}
          actionLabel="Mark reviewed and seal"
          requestLabel="Request approval to review and seal"
          canRequest={artifact.state === "staged"}
          ready={inspectedDigest === artifact.contentDigest}
          readinessMessage="Inspect the current content before requesting approval."
          execute={(approval) =>
            mutate(`/api/v1/artifacts/${artifact.id}/review`, {
              expectedRevision: artifact.revision,
              approvalId: approval.id,
              expectedApprovalRevision: approval.revision,
            })
          }
        />
      )}
      {content !== null && (
        <div className="artifact-inspection">
          <pre>{content}</pre>
          <h3>Career details used</h3>
          <ul>
            {artifact.factIds.map((id) => {
              const fact = snapshot.profileFacts.find((item) => item.id === id);
              return (
                <li key={id}>
                  {fact === undefined
                    ? id
                    : `${fact.subject} ${fact.predicate} ${String(fact.value)}`}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ErrorNotice error={inspect.error} />
    </article>
  );
}

interface CareerOpsPreview {
  readonly previewId: string;
  readonly expiresAt: string;
  readonly sourceLabel: string;
  readonly sourceFingerprint: string;
  readonly upstreamRevision: string;
  readonly observedVersion: string | null;
  readonly alreadyImported: boolean;
  readonly changedSource: boolean;
  readonly files: readonly {
    readonly relativePath: string;
    readonly purpose: string;
    readonly byteLength: number;
    readonly contentDigest: string;
  }[];
  readonly profileFacts: readonly {
    readonly sourceIdentity: string;
    readonly sourceRelativePath: string;
    readonly predicate: string;
    readonly value: string | number | boolean | null;
    readonly confirmationRequired: true;
  }[];
  readonly applications: readonly {
    readonly sourceIdentity: string;
    readonly sourceRelativePath: string;
    readonly organization: string;
    readonly roleTitle: string;
    readonly originalStatus: string;
    readonly mappedState: string;
    readonly originalScore: string | null;
  }[];
  readonly passiveMappings: readonly {
    readonly sourceType: string;
    readonly sourceIdentity: string;
    readonly sourceRelativePath: string;
    readonly disposition: string;
    readonly originalStatus: string | null;
    readonly originalScore: string | null;
    readonly note: string | null;
  }[];
  readonly warnings: readonly string[];
  readonly unsupported: readonly string[];
}

function Imports({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [sourceDirectory, setSourceDirectory] = useState("");
  const [preview, setPreview] = useState<CareerOpsPreview | null>(null);
  const [selectedMappingIds, setSelectedMappingIds] = useState<
    readonly string[]
  >([]);
  const discover = useMutation({
    mutationFn: () =>
      mutate<CareerOpsPreview>("/api/v1/imports/career-ops/preview", {
        sourceDirectory,
      }),
    onSuccess: (nextPreview) => {
      setPreview(nextPreview);
      setSelectedMappingIds([
        ...nextPreview.profileFacts.map((item) => item.sourceIdentity),
        ...nextPreview.applications.map((item) => item.sourceIdentity),
        ...nextPreview.passiveMappings.map((item) => item.sourceIdentity),
      ]);
    },
  });
  const apply = useMutation({
    mutationFn: async () => {
      if (preview === null) throw new Error("Review a current preview first.");
      return mutate<{ readonly id: string }>(
        `/api/v1/imports/career-ops/${preview.previewId}/apply`,
        {
          sourceFingerprint: preview.sourceFingerprint,
          selectedMappingIds,
          confirm: true,
        },
      );
    },
    onSuccess: async () => {
      await refresh();
      setPreview((current) =>
        current === null ? null : { ...current, alreadyImported: true },
      );
    },
  });
  const supportedMappings =
    preview === null
      ? []
      : [
          ...preview.profileFacts.map((item) => ({
            id: item.sourceIdentity,
            type: "profile",
            label: `${item.predicate}: ${String(item.value)}`,
            source: item.sourceRelativePath,
            note: "Adds a career detail for you to keep, edit, or leave out.",
          })),
          ...preview.applications.map((item) => ({
            id: item.sourceIdentity,
            type: "application",
            label: `${item.roleTitle} at ${item.organization}`,
            source: item.sourceRelativePath,
            note: `${item.originalStatus} → ${item.mappedState.replaceAll("_", " ")}`,
          })),
          ...preview.passiveMappings.map((item) => ({
            id: item.sourceIdentity,
            type: item.sourceType,
            label: item.sourceIdentity,
            source: item.sourceRelativePath,
            note: item.note ?? item.disposition,
          })),
        ];
  const toggleMapping = (identity: string, selected: boolean) => {
    setSelectedMappingIds((current) =>
      selected
        ? [...new Set([...current, identity])]
        : current.filter((item) => item !== identity),
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Setup tool · Import"
        title="Import Career Ops"
        description="Preview what can move into Workbench, choose the records, then import once."
        story={pageStories.imports}
      />
      <ol className="process-strip" aria-label="Import process">
        <li>
          <span>1</span>
          <strong>Choose folder</strong>
        </li>
        <li>
          <span>2</span>
          <strong>Review records</strong>
        </li>
        <li>
          <span>3</span>
          <strong>Confirm import</strong>
        </li>
      </ol>
      <section className="panel import-discovery task-panel">
        <header>
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Choose your Career Ops folder</h2>
          </div>
          <small>Discovery is read-only.</small>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPreview(null);
            discover.mutate();
          }}
        >
          <label htmlFor="career-ops-directory">
            Career Ops directory
            <input
              id="career-ops-directory"
              value={sourceDirectory}
              onChange={(event) => setSourceDirectory(event.target.value)}
              placeholder="Absolute path to the Career Ops data directory"
              required
              maxLength={4096}
              autoComplete="off"
            />
          </label>
          <button
            className="secondary"
            type="submit"
            disabled={discover.isPending}
          >
            <FolderInput aria-hidden="true" />
            {discover.isPending ? "Discovering…" : "Discover read-only"}
          </button>
        </form>
        <p className="trust-note import-safety-boundary">
          Nothing is imported until you confirm. Scripts and agents are never
          run; credentials and browser data are never imported.
        </p>
        <ProgressiveDetails
          summary="How the preview stays safe"
          hint="Local path handling, expiry, and change detection"
        >
          <p>
            The directory path stays server-side. The preview expires after 15
            minutes, and apply fails if any selected byte changes.
          </p>
        </ProgressiveDetails>
        <ErrorNotice error={discover.error} />
      </section>

      {preview !== null && (
        <section className="import-preview" aria-live="polite">
          <div className="section-head">
            <div>
              <p className="eyebrow">Import preview</p>
              <h2>{preview.sourceLabel}</h2>
            </div>
            <StatusPill tone={preview.alreadyImported ? "good" : "warning"}>
              {preview.alreadyImported ? "already imported" : "ready to import"}
            </StatusPill>
          </div>
          {preview.changedSource && (
            <div className="notice warning" role="alert">
              <RefreshCw aria-hidden="true" />
              <span>
                This directory differs from its last confirmed import. Review
                every mapping before importing the new immutable revision.
              </span>
            </div>
          )}
          {preview.warnings.map((warning) => (
            <div className="notice warning" role="status" key={warning}>
              <AlertTriangle aria-hidden="true" />
              <span>{warning}</span>
            </div>
          ))}

          {preview.unsupported.length > 0 && (
            <section className="panel import-exclusions">
              <h3>Never imported</h3>
              <ul className="check-list">
                {preview.unsupported.map((item) => (
                  <li key={item}>
                    <ShieldCheck aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ProgressiveDetails
            summary="Inspect selected source"
            hint={`${String(preview.files.length)} supported file${preview.files.length === 1 ? "" : "s"}`}
          >
            <article className="panel">
              <h3>Selected source bytes</h3>
              <p className="import-identity">
                Career Ops {preview.observedVersion ?? "version unavailable"}
              </p>
              <ul className="import-list">
                {preview.files.map((file) => (
                  <li key={file.relativePath}>
                    <div>
                      <strong>{file.relativePath}</strong>
                      <small>{file.purpose}</small>
                    </div>
                    <span>{file.byteLength.toLocaleString()} bytes</span>
                  </li>
                ))}
              </ul>
            </article>
          </ProgressiveDetails>

          <section className="panel import-mapping-selection">
            <div className="section-head">
              <div>
                <h3>Choose supported mappings</h3>
                <p>
                  Source files stay saved locally. Unchecked mappings are
                  recorded as skipped and create no career, opportunity, or
                  pipeline record.
                </p>
              </div>
              <StatusPill tone="warning">
                {selectedMappingIds.length} of {supportedMappings.length}
              </StatusPill>
            </div>
            <div className="actions">
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setSelectedMappingIds(
                    supportedMappings.map((mapping) => mapping.id),
                  )
                }
              >
                Select all
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setSelectedMappingIds([])}
              >
                Select none
              </button>
            </div>
            <fieldset>
              <legend className="sr-only">Career Ops mappings</legend>
              {supportedMappings.map((mapping) => (
                <label key={`${mapping.type}-${mapping.id}`}>
                  <input
                    type="checkbox"
                    checked={selectedMappingIds.includes(mapping.id)}
                    onChange={(event) =>
                      toggleMapping(mapping.id, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{mapping.label}</strong>
                    <small>{mapping.type.replaceAll("_", " ")}</small>
                    <small>{mapping.note}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <ProgressiveDetails
            summary="Review application state mapping"
            hint={`${String(preview.applications.length)} application record${preview.applications.length === 1 ? "" : "s"}`}
          >
            <section className="import-table-wrap">
              <h3>Application mappings</h3>
              {preview.applications.length === 0 ? (
                <Empty>No supported application rows were found.</Empty>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Opportunity</th>
                      <th scope="col">Career Ops status</th>
                      <th scope="col">Workbench state</th>
                      <th scope="col">Original score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.applications.map((application) => (
                      <tr key={application.sourceIdentity}>
                        <th scope="row">
                          {application.roleTitle}
                          <small>{application.organization}</small>
                        </th>
                        <td>{application.originalStatus}</td>
                        <td>{application.mappedState.replaceAll("_", " ")}</td>
                        <td>{application.originalScore ?? "Not scored"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </ProgressiveDetails>

          <section className="panel">
            <h3>Career details</h3>
            <p>
              {preview.profileFacts.length} profile values are ready to review.
              You choose which ones become part of your career record.
            </p>
            <div className="import-confirm">
              <div>
                <strong>Import the selected records</strong>
                <p>
                  This writes {selectedMappingIds.length} selected mappings to
                  local canonical state and records the rest as skipped. It
                  cannot submit an application, send a message, or start a
                  Career Ops worker.
                </p>
              </div>
              <button
                className="primary"
                type="button"
                disabled={apply.isPending || preview.alreadyImported}
                onClick={() => apply.mutate()}
              >
                {apply.isPending
                  ? "Importing…"
                  : preview.alreadyImported
                    ? "Imported"
                    : "Import selected"}
              </button>
            </div>
            <ErrorNotice error={apply.error} />
          </section>
        </section>
      )}

      <section className="section-head">
        <div>
          <p className="eyebrow">Durable receipts</p>
          <h2>Import history</h2>
        </div>
        <StatusPill>{snapshot.importManifests.length} manifests</StatusPill>
      </section>
      <div className="card-list">
        {[...snapshot.importManifests].reverse().map((manifest) => (
          <article className="panel import-receipt" key={manifest.id}>
            <div>
              <strong>{manifest.sourceLabel}</strong>
              <small>
                {manifest.sources.length} files · {manifest.mappings.length}{" "}
                mappings
              </small>
            </div>
            <details>
              <summary>Mapping receipt ({manifest.mappings.length})</summary>
              <p className="receipt-fingerprint">
                Source fingerprint <code>{manifest.sourceFingerprint}</code>
              </p>
              <ul className="compact-history import-mapping-receipt">
                {manifest.mappings.map((mapping, index) => {
                  const identity =
                    comparisonText(mapping, "sourceIdentity") ||
                    `mapping-${String(index + 1)}`;
                  const disposition =
                    comparisonText(mapping, "disposition") || "recorded";
                  return (
                    <li key={`${identity}-${String(index)}`}>
                      <span>
                        <strong>{identity}</strong>
                        {comparisonText(mapping, "note")}
                      </span>
                      <StatusPill
                        tone={disposition === "skipped" ? "warning" : "good"}
                      >
                        {disposition}
                      </StatusPill>
                    </li>
                  );
                })}
              </ul>
            </details>
          </article>
        ))}
        {snapshot.importManifests.length === 0 && (
          <Empty>No confirmed Career Ops imports yet.</Empty>
        )}
      </div>
    </>
  );
}

const activityEventLabels: Readonly<Record<string, string>> = {
  "profile_fact.proposed": "Career detail suggested",
  "profile_fact.confirmed": "Career detail saved",
  "profile_fact.decided": "Career detail choice recorded",
  "profile_fact.corrected": "Career detail updated",
  "profile_fact.superseded": "Career detail replaced",
  "opportunity.captured": "Opportunity captured",
  "opportunity.signals.updated": "Opportunity signals updated",
  "opportunity.evaluating": "Opportunity evaluation started",
  "opportunity.evaluated": "Opportunity evaluation completed",
  "evaluation.started": "Evaluation started",
  "evaluation.completed": "Evaluation completed",
  "evaluation.failed": "Evaluation failed",
  "evaluation.stale": "Evaluation marked stale",
  "artifact.drafted": "Draft artifact created",
  "artifact.reviewed": "Artifact review recorded",
  "artifact.sealed": "Artifact sealed",
  "artifact.stale": "Artifact marked stale",
  "application.created": "Pipeline record started",
  "application.transitioned": "Pipeline state changed",
  "career_ops.application.imported": "Career Ops pipeline record imported",
  "career_ops.opportunity.imported": "Career Ops opportunity imported",
};

function activityEventLabel(eventKind: string): string {
  const known = activityEventLabels[eventKind];
  if (known !== undefined) return known;
  const words = eventKind.replaceAll(/[._]/gu, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function activityResource(
  event: DomainEventView,
  snapshot: SnapshotResponse,
): { readonly to: string; readonly label: string } | null {
  if (event.eventKind.startsWith("profile_fact.")) {
    const fact = snapshot.profileFacts.find(
      (item) => item.id === event.aggregateId,
    );
    return fact === undefined
      ? { to: "/profile", label: "Open career details" }
      : {
          to: "/profile",
          label: `${fact.subject} ${fact.predicate} ${String(fact.value)}`,
        };
  }
  if (
    event.eventKind.startsWith("opportunity.") ||
    event.eventKind === "career_ops.opportunity.imported"
  ) {
    const opportunity = snapshot.opportunities.find(
      (item) => item.id === event.aggregateId,
    );
    return opportunity === undefined
      ? { to: "/opportunities", label: "Open opportunities" }
      : {
          to: "/opportunities",
          label: `${opportunity.roleTitle} at ${opportunity.organization}`,
        };
  }
  if (event.eventKind.startsWith("evaluation.")) {
    const evaluation = snapshot.evaluations.find(
      (item) => item.id === event.aggregateId,
    );
    const opportunity = snapshot.opportunities.find(
      (item) => item.id === evaluation?.opportunityId,
    );
    return {
      to: "/evaluations",
      label:
        opportunity === undefined
          ? "Open evaluations"
          : `${opportunity.roleTitle} at ${opportunity.organization}`,
    };
  }
  if (event.eventKind.startsWith("artifact.")) {
    const artifact = snapshot.artifacts.find(
      (item) => item.id === event.aggregateId,
    );
    return {
      to: "/drafts",
      label:
        artifact === undefined
          ? "Open drafts"
          : artifact.kind.replaceAll("_", " "),
    };
  }
  if (
    event.eventKind.startsWith("application.") ||
    event.eventKind === "career_ops.application.imported"
  ) {
    const application = snapshot.applications.find(
      (item) => item.id === event.aggregateId,
    );
    const opportunity = snapshot.opportunities.find(
      (item) => item.id === application?.opportunityId,
    );
    return {
      to: "/pipeline",
      label:
        opportunity === undefined
          ? "Open application pipeline"
          : `${opportunity.roleTitle} at ${opportunity.organization}`,
    };
  }
  return null;
}

function ActivityPage({
  snapshot,
  streamState,
}: {
  readonly snapshot: SnapshotResponse;
  readonly streamState: string;
}): React.JSX.Element {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [completedOperationLimit, setCompletedOperationLimit] = useState(3);
  const [olderEvents, setOlderEvents] = useState<readonly DomainEventView[]>(
    [],
  );
  const [hasEarlierEvents, setHasEarlierEvents] = useState(
    snapshot.events.length >= 1000,
  );
  const eventBySequence = new Map<number, DomainEventView>();
  for (const event of [...olderEvents, ...snapshot.events])
    eventBySequence.set(event.sequence, event);
  const orderedEvents = [...eventBySequence.values()].sort(
    (left, right) => right.sequence - left.sequence,
  );
  const earliestSequence = orderedEvents.at(-1)?.sequence;
  const loadEarlier = useMutation({
    mutationFn: () => {
      if (earliestSequence === undefined)
        throw new Error("No activity cursor is available.");
      return query<{ readonly events: readonly DomainEventView[] }>(
        `/api/v1/events?before=${String(earliestSequence)}&limit=1000`,
      );
    },
    onSuccess: (body) => {
      setOlderEvents((current) => [...body.events, ...current]);
      setHasEarlierEvents(body.events.length === 1000);
    },
  });
  useEffect(() => {
    if (olderEvents.length === 0)
      setHasEarlierEvents(snapshot.events.length >= 1000);
  }, [olderEvents.length, snapshot.events.length]);
  const totalPages = Math.max(1, Math.ceil(orderedEvents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleEvents = orderedEvents.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const rootOperations = snapshot.operations
    .filter((item) => item.parentOperationId === null)
    .reverse();
  const operationById = new Map(
    snapshot.operations.map((operation) => [operation.id, operation]),
  );
  const attentionRootIds = new Set<string>();
  for (const operation of snapshot.operations.filter(
    (item) => item.terminalAt === null,
  )) {
    let branch: OperationView | undefined = operation;
    const visited = new Set<string>();
    while (
      branch?.parentOperationId !== null &&
      branch?.parentOperationId !== undefined &&
      !visited.has(branch.id)
    ) {
      visited.add(branch.id);
      branch = operationById.get(branch.parentOperationId);
    }
    if (branch !== undefined) attentionRootIds.add(branch.id);
  }
  const attentionRootOperations = rootOperations.filter((operation) =>
    attentionRootIds.has(operation.id),
  );
  const completedRootOperations = rootOperations.filter(
    (operation) => !attentionRootIds.has(operation.id),
  );
  const visibleRootOperations = [
    ...attentionRootOperations,
    ...completedRootOperations.slice(0, completedOperationLimit),
  ];
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  return (
    <>
      <PageHeader
        eyebrow="Support · Recent work"
        title="Activity"
        description="See what changed recently and whether agent work still needs attention."
        story={pageStories.activity}
      />
      <div className="notice">
        <span className={`stream-dot ${streamState}`} aria-hidden="true" />
        <span>
          Activity is {streamState}. New changes appear here automatically.
        </span>
      </div>
      <ProgressiveDetails
        className="activity-audit"
        summary="View audit history"
        hint={`${String(orderedEvents.length)} ordered changes`}
      >
        <section className="section-head activity-head">
          <div>
            <p className="eyebrow">Audit history</p>
            <h2>Ordered events</h2>
            <p>Newest changes appear first.</p>
          </div>
          <label className="page-size" htmlFor="activity-page-size">
            Events per page
            <select
              id="activity-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </section>
        <ol className="timeline">
          {visibleEvents.map((event) => {
            const resource = activityResource(event, snapshot);
            return (
              <li key={event.sequence}>
                <span>{event.sequence}</span>
                <div>
                  <strong>{activityEventLabel(event.eventKind)}</strong>
                  {resource !== null && (
                    <Link className="activity-resource" to={resource.to}>
                      {resource.label}
                    </Link>
                  )}
                  <time>{new Date(event.timestamp).toLocaleString()}</time>
                  <details className="event-details">
                    <summary>Technical details</summary>
                    <p>
                      {event.eventKind} · record {event.aggregateId}
                    </p>
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
        {visibleEvents.length === 0 && <Empty>No activity recorded yet.</Empty>}
        <nav className="pagination" aria-label="Activity pages">
          <p aria-live="polite">
            Page {safePage} of {totalPages} · showing {visibleEvents.length} of{" "}
            {orderedEvents.length} loaded events
          </p>
          <div>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Newer
            </button>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Older
            </button>
          </div>
        </nav>
        {hasEarlierEvents && earliestSequence !== undefined && (
          <div className="operation-controls">
            <p>Earlier history is available on the server.</p>
            <button
              className="secondary"
              type="button"
              disabled={loadEarlier.isPending}
              onClick={() => loadEarlier.mutate()}
            >
              {loadEarlier.isPending
                ? "Loading earlier activity…"
                : "Load up to 1,000 earlier events"}
            </button>
            <ErrorNotice error={loadEarlier.error} />
          </div>
        )}
      </ProgressiveDetails>
      <section className="section-head operation-head">
        <div>
          <p className="eyebrow">
            {attentionRootOperations.length > 0 ? "Needs attention" : "Recent"}
          </p>
          <h2>
            {attentionRootOperations.length > 0
              ? "Work in progress"
              : "Recent work"}
          </h2>
          <p>
            Open a card only when you need its lifecycle or technical details.
          </p>
        </div>
        <StatusPill
          tone={attentionRootOperations.length > 0 ? "warning" : "neutral"}
        >
          {attentionRootOperations.length > 0
            ? `${String(attentionRootOperations.length)} active`
            : `${String(Math.min(3, completedRootOperations.length))} recent`}
        </StatusPill>
      </section>
      {attentionRootOperations.length > 0 && (
        <div className="notice warning" role="status">
          <span className="stream-dot connecting" aria-hidden="true" />
          <span>
            {attentionRootOperations.length} active operation{" "}
            {attentionRootOperations.length === 1 ? "branch" : "branches"} shown
            first.
          </span>
        </div>
      )}
      <div className="operation-tree" aria-label="Agent operation lineage">
        {rootOperations.length === 0 ? (
          <Empty>No DSH operations recorded yet.</Empty>
        ) : (
          visibleRootOperations.map((operation) => (
            <OperationNode
              key={operation.id}
              operation={operation}
              snapshot={snapshot}
              depth={0}
            />
          ))
        )}
      </div>
      {completedRootOperations.length > 3 && (
        <div className="operation-controls">
          <p>
            {attentionRootOperations.length > 0 && (
              <>All {attentionRootOperations.length} active shown · </>
            )}
            Showing{" "}
            {Math.min(completedOperationLimit, completedRootOperations.length)}{" "}
            of {completedRootOperations.length} completed
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              setCompletedOperationLimit((current) =>
                current >= completedRootOperations.length ? 3 : current + 3,
              )
            }
          >
            {completedOperationLimit >= completedRootOperations.length
              ? "Show recent 3 completed"
              : "Show 3 older completed"}
          </button>
        </div>
      )}
    </>
  );
}

function OperationNode({
  operation,
  snapshot,
  depth,
}: {
  readonly operation: OperationView;
  readonly snapshot: SnapshotResponse;
  readonly depth: number;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [followup, setFollowup] = useState("");
  const request = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/operations/${operation.id}/followups`, {
        expectedRevision: operation.revision,
        message: followup,
      }),
    onSuccess: async () => {
      setFollowup("");
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/operations/${operation.id}/cancellation-requests`, {
        expectedRevision: operation.revision,
        reason: "User requested cancellation from the local activity view.",
      }),
    onSuccess: refresh,
  });
  const events = snapshot.events.filter(
    (event) => event.aggregateId === operation.id,
  );
  const deliveredRequestIds = new Set(
    snapshot.events
      .filter((event) => event.eventKind === "operation.followup")
      .flatMap((event) =>
        typeof event.payload["requestId"] === "string"
          ? [event.payload["requestId"]]
          : [],
      ),
  );
  const pending = events.filter(
    (event) =>
      event.eventKind === "operation.followup_requested" &&
      typeof event.payload["requestId"] === "string" &&
      !deliveredRequestIds.has(event.payload["requestId"]),
  ).length;
  const children = snapshot.operations.filter(
    (item) => item.parentOperationId === operation.id,
  );
  const terminal = operation.terminalAt !== null;
  const tone =
    operation.state === "succeeded"
      ? "good"
      : operation.state === "running" || operation.state === "queued"
        ? "warning"
        : "neutral";
  return (
    <div
      className="operation-branch"
      style={{ "--depth": depth } as React.CSSProperties}
    >
      <article className="operation-card">
        <header>
          <div>
            <h3>{operation.kind.replaceAll("_", " ")}</h3>
          </div>
          <StatusPill tone={tone}>
            {operation.state.replaceAll("_", " ")}
          </StatusPill>
        </header>
        <ProgressiveDetails
          summary="Operation details"
          hint={`Last updated ${new Date(operation.lastActivityAt).toLocaleString()}`}
        >
          <dl>
            <div>
              <dt>Execution route</dt>
              <dd>{operation.route.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Operation</dt>
              <dd>{operation.id}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>
                {operation.startedAt === null
                  ? "Admitted; waiting for inbox start"
                  : new Date(operation.startedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Last activity</dt>
              <dd>{new Date(operation.lastActivityAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>
                {events
                  .map((event) => event.eventKind.split(".").at(-1))
                  .join(" → ")}
              </dd>
            </div>
          </dl>
        </ProgressiveDetails>
        {operation.cancellationRequestedAt !== null && !terminal && (
          <div className="notice warning" role="status">
            Cancellation requested; waiting for DSH terminal settlement.
          </div>
        )}
        {!terminal && operation.cancellationRequestedAt === null && (
          <div className="actions">
            <button
              type="button"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              Request cancellation
            </button>
            <small>
              This records intent for the owning DSH runtime; terminal state is
              shown only after authoritative settlement.
            </small>
          </div>
        )}
        {terminal && (
          <p className="operation-terminal">
            <strong>{operation.terminalCategory ?? operation.state}</strong>{" "}
            {operation.terminalMessage}
          </p>
        )}
        {operation.route === "native_child" && (
          <form
            className="followup-form"
            onSubmit={(event) => {
              event.preventDefault();
              request.mutate();
            }}
          >
            <label htmlFor={`followup-${operation.id}`}>
              Request a follow-up from the originating DSH Agent
            </label>
            <div>
              <input
                id={`followup-${operation.id}`}
                value={followup}
                onChange={(event) => setFollowup(event.target.value)}
                maxLength={8_000}
                placeholder="Ask the child to re-check one bounded point"
                required
              />
              <button type="submit" disabled={request.isPending}>
                Queue request
              </button>
            </div>
            <small>
              {pending > 0
                ? `${String(pending)} recorded request${pending === 1 ? "" : "s"}; only the exact live parent Agent can deliver them.`
                : "This records user intent only. The browser cannot call or impersonate the child."}
            </small>
            <ErrorNotice error={request.error} />
          </form>
        )}
        <ErrorNotice error={cancel.error} />
      </article>
      {children.length > 0 && (
        <div className="operation-children">
          {children.map((child) => (
            <OperationNode
              key={child.id}
              operation={child}
              snapshot={snapshot}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Diagnostics(): React.JSX.Element {
  const diagnostics = useQuery({
    queryKey: ["diagnostics"],
    queryFn: loadDiagnostics,
  });
  return (
    <>
      <PageHeader
        eyebrow="Support · System status"
        title="System status"
        description="See what is ready, what is unavailable, and what you can do next."
        story={pageStories.diagnostics}
      />
      {diagnostics.isLoading ? (
        <p role="status">Checking local services…</p>
      ) : diagnostics.error !== null ? (
        <>
          <ErrorNotice error={diagnostics.error} />
          <div className="comparison-next-action diagnostic-next-action">
            <div>
              <strong>Next action</strong>
              <p>Check the local server connection, then try again.</p>
            </div>
            <button
              className="secondary"
              disabled={diagnostics.isFetching}
              onClick={() => void diagnostics.refetch()}
            >
              {diagnostics.isFetching ? "Checking…" : "Check again"}
            </button>
          </div>
        </>
      ) : (
        diagnostics.data !== undefined && (
          <>
            <section className="panel diagnostic-overview">
              <span className="diagnostic-icon" aria-hidden="true">
                <ShieldCheck />
              </span>
              <div>
                <p className="eyebrow">Local system</p>
                <h2>Core workbench ready</h2>
                <p>
                  Your local records are available. Agent features are{" "}
                  {diagnostics.data.capabilities["dsh"] === true
                    ? "ready"
                    : "currently unavailable"}
                  .
                </p>
              </div>
            </section>
            {diagnostics.data.capabilities["dsh"] !== true && (
              <div className="comparison-next-action diagnostic-next-action">
                <div>
                  <strong>Next action</strong>
                  <p>
                    Start or reconnect the local agent service, then check its
                    status again.
                  </p>
                </div>
                <button
                  className="secondary"
                  type="button"
                  disabled={diagnostics.isFetching}
                  onClick={() => void diagnostics.refetch()}
                >
                  {diagnostics.isFetching ? "Checking…" : "Check again"}
                </button>
              </div>
            )}
            <div className="diagnostic-callouts">
              <div className="notice warning" role="note">
                <AlertTriangle aria-hidden="true" />
                <span>
                  Advanced analysis can run code with access to your computer
                  when enabled. It is not sandboxed.
                </span>
              </div>
              <div className="notice" role="note">
                <ShieldCheck aria-hidden="true" />
                <span>
                  Workbench can prepare local work, but it cannot submit, send,
                  purchase, accept, reject, or withdraw for you.
                </span>
              </div>
            </div>
            <ProgressiveDetails
              summary="View technical details"
              hint="Versions, trust boundaries, and optional capabilities"
            >
              <section className="stat-grid">
                <article>
                  <span>Storage</span>
                  <strong className="word">{diagnostics.data.storage}</strong>
                  <small>SQLite {diagnostics.data.journalMode}</small>
                </article>
                <article>
                  <span>Schema</span>
                  <strong>{diagnostics.data.schemaVersion}</strong>
                  <small>contract {diagnostics.data.contractVersion}</small>
                </article>
                <article>
                  <span>Workbench</span>
                  <strong className="word">{diagnostics.data.version}</strong>
                  <small>local preview</small>
                </article>
              </section>
              <section className="diagnostic-section">
                <h2>Trust boundary</h2>
                <ul className="check-list">
                  <li>
                    <Check aria-hidden="true" />
                    Loopback-only HTTP and same-origin mutations
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    Canonical state lives in SQLite and immutable artifacts
                  </li>
                  <li>
                    <AlertTriangle aria-hidden="true" />
                    IPython, when enabled, has operating-system authority and is
                    not a sandbox
                  </li>
                  <li>
                    <ShieldCheck aria-hidden="true" />
                    No v0.1 route performs consequential external actions
                  </li>
                </ul>
              </section>
              <section className="diagnostic-section">
                <h2>Optional capabilities</h2>
                <dl className="capabilities">
                  {Object.entries(diagnostics.data.capabilities).map(
                    ([key, enabled]) => (
                      <div key={key}>
                        <dt>{key.replaceAll(/([A-Z])/gu, " $1")}</dt>
                        <dd>
                          <StatusPill tone={enabled ? "good" : "neutral"}>
                            {enabled ? "available" : "unavailable"}
                          </StatusPill>
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            </ProgressiveDetails>
          </>
        )
      )}
    </>
  );
}

function useActivityStream(
  snapshot: SnapshotResponse | undefined,
  refresh: () => Promise<void>,
): string {
  const [state, setState] = useState("connecting");
  const initialAfter = useRef(snapshot?.events.at(-1)?.sequence ?? 0);
  const workspaceId = snapshot?.workspace?.id;
  useEffect(() => {
    if (workspaceId === undefined) return undefined;
    const stream = new EventSource(
      `/api/v1/events/stream?after=${String(initialAfter.current)}`,
    );
    stream.onopen = () => {
      setState("connected");
      void refresh();
    };
    stream.onerror = () => setState("reconnecting");
    stream.addEventListener("domain", () => {
      void refresh();
    });
    return () => stream.close();
  }, [refresh, workspaceId]);
  return state;
}

export function App(): React.JSX.Element {
  const snapshot = useQuery({ queryKey: ["snapshot"], queryFn: loadSnapshot });
  const refresh = useRefresh();
  const streamState = useActivityStream(snapshot.data, refresh);
  const data = snapshot.data;
  if (snapshot.isLoading || data === undefined)
    return (
      <main className="loading" role="status">
        <span className="brand-mark large">CW</span>
        <p>Opening local workspace…</p>
      </main>
    );
  if (snapshot.error !== null)
    return (
      <main className="fatal">
        <h1>Career Workbench could not start</h1>
        <ErrorNotice error={snapshot.error} />
        <button className="secondary" onClick={() => void snapshot.refetch()}>
          Try again
        </button>
      </main>
    );
  if (data.workspace === null) return <Onboarding onReady={refresh} />;
  return <Layout snapshot={data} streamState={streamState} />;
}
