import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
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
  { to: "/profile", label: "Career", icon: UserRound },
  { to: "/discover", label: "Jobs", icon: Search },
] as const;

const moreNav = [
  { to: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { to: "/evaluations", label: "Evaluations", icon: FileCheck2 },
  { to: "/comparisons", label: "Compare", icon: Scale },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/drafts", label: "Drafts", icon: FilePenLine },
  { to: "/imports", label: "Import", icon: FolderInput },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings2 },
  { to: "/diagnostics", label: "Diagnostics", icon: Database },
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

function Layout({
  snapshot,
  streamState,
}: {
  readonly snapshot: SnapshotResponse;
  readonly streamState: string;
}): React.JSX.Element {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMoreLinkRef = useRef<HTMLAnchorElement>(null);
  const moreRouteIsActive = moreNav.some(
    (item) => item.to === location.pathname,
  );
  const setupComplete = careerSetupComplete(snapshot);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    firstMoreLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      moreButtonRef.current?.focus();
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
              <span>Career Workbench</span>
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
            <small>Local · private</small>
          </div>
          <nav className="desktop-primary-nav" aria-label="Primary">
            {primaryNav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <details className="desktop-more-nav">
              <summary className={moreRouteIsActive ? "active" : ""}>
                <Menu aria-hidden="true" />
                <span>More</span>
              </summary>
              <div>
                {moreNav.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </details>
          </nav>
          <div className="sidebar-foot">
            <span className={`stream-dot ${streamState}`} aria-hidden="true" />
            <span>Activity {streamState}</span>
          </div>
          <nav className="mobile-primary-nav" aria-label="Mobile primary">
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
              role="region"
              aria-label="More destinations"
            >
              <header>
                <strong>More destinations</strong>
                <small>All Workbench tools remain available.</small>
              </header>
              <nav aria-label="More destinations">
                {moreNav.map(({ to, label, icon: Icon }, index) => (
                  <NavLink
                    key={to}
                    ref={index === 0 ? firstMoreLinkRef : undefined}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
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
            CW_
          </Link>
        </header>
      )}
      <main className="content" id="main-content" tabIndex={-1}>
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
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}): React.JSX.Element {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
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
              ? `Welcome, ${candidateFirstName}`
              : (snapshot.workspace?.displayName ?? "Career Workbench")
          }
          title="Build the case for what comes next."
          description="Your experience is the starting point. You decide where it leads."
        />
      </div>
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
                  ? "DSH connected"
                  : "DSH unavailable"}
              </StatusPill>
            </div>
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
      (fact.factType === "experience" ||
        fact.factType === "achievement" ||
        fact.factType === "education" ||
        fact.factType === "skill") &&
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
        <p className="eyebrow">Résumé ready</p>
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
        eyebrow="Candidate record"
        title="Add your career history"
        description="Start with a résumé, rough notes, or one role. Workbench organizes it into a summary you can keep, edit, or leave out. Identity and search preferences live in Settings."
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
      <div className="profile-settings-link">
        <Settings2 aria-hidden="true" />
        <span>
          Looking for your name, target roles, or location preferences?{" "}
          <Link to="/settings">Manage them in Settings.</Link>
        </span>
      </div>
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
                The file stays local. AI can organize it into a summary you
                control.
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
                  The DSH-backed organizer turns your text into a concise
                  summary. You choose what to keep, edit, or leave out.
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
                  This browser asks the server to run one DSH-owned turn; it
                  never calls an LLM provider directly.
                </small>
                {organizeCareerSource.isPending && (
                  <div
                    className="ai-run-progress"
                    role="status"
                    aria-live="polite"
                  >
                    <RefreshCw className="spin" aria-hidden="true" />
                    <div>
                      <strong>DSH is organizing this source now.</strong>
                      <p>The review list will update here when it finishes.</p>
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
                  Résumé text saved locally. Choose Continue with AI to organize
                  it here, or add a role manually.
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
                  Workbench saves your words locally. AI may organize them, and
                  you choose what stays in your career record.
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
                  The DSH-backed organizer turns what you wrote into a concise
                  summary without adding new details.
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
                  The browser never contacts an LLM provider directly.
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
                One achievement per line. You can edit or leave out anything in
                the summary before moving on.
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
                  Role added. Review the organized summary in the next section.
                </span>
              </div>
            )}
            <ErrorNotice error={addHistory.error} />
          </Tabs.Content>
        </Tabs.Root>
      </section>
      {verifiedCareerFacts.length > 0 && (
        <details
          className="panel profile-record-details"
          id="confirmed-career-record"
        >
          <summary>
            <span>
              <strong>Your career record</strong>
              <small>The details you chose to keep.</small>
            </span>
            <StatusPill tone="good">
              {verifiedCareerFacts.length} saved
            </StatusPill>
          </summary>
          <div className="compact-fact-list">
            {verifiedCareerFacts.map((fact) => (
              <FactCard
                key={fact.id}
                fact={fact}
                sources={snapshot.sources}
                affectedOutputs={affectedOutputCount(snapshot, fact.id)}
              />
            ))}
          </div>
        </details>
      )}
      {historicalCareerFacts.length > 0 && (
        <details className="panel profile-record-details">
          <summary>
            <span>
              <strong>Past decisions and replaced details</strong>
              <small>Kept in history; not used in your current record.</small>
            </span>
            <StatusPill>{historicalCareerFacts.length} archived</StatusPill>
          </summary>
          <div className="compact-fact-list">
            {historicalCareerFacts.map((fact) => (
              <FactCard
                key={fact.id}
                fact={fact}
                sources={snapshot.sources}
                affectedOutputs={affectedOutputCount(snapshot, fact.id)}
              />
            ))}
          </div>
        </details>
      )}
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
  included = true,
  onIncludedChange,
}: {
  readonly fact: ProfileFactView;
  readonly sources: readonly SourceView[];
  readonly affectedOutputs: number;
  readonly compact?: boolean;
  readonly included?: boolean;
  readonly onIncludedChange?: (included: boolean) => void;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [corrected, setCorrected] = useState(String(fact.value ?? ""));
  const [showCorrection, setShowCorrection] = useState(false);
  const factClaim = `${fact.subject} ${fact.predicate} ${String(fact.value)}`;
  useEffect(() => {
    setCorrected(String(fact.value ?? ""));
    if (fact.status !== "verified" && fact.status !== "proposed") {
      setShowCorrection(false);
    }
  }, [fact.revision, fact.status, fact.value]);
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
                    : source.kind === "candidate"
                      ? "From your saved career material"
                      : "From a saved source"}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
        <small>Revision {fact.revision}</small>
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
        <small>Revision {fact.revision}</small>
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
        eyebrow="Workspace settings"
        title="Identity and search preferences"
        description="Keep your name and search preferences here, separate from your career history."
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
              <p>
                Your name labels this workbench and the materials you create.
              </p>
            </div>
          </header>
          <div className="compact-fact-list">
            {displayedIdentityFacts.length === 0 ? (
              <Empty>No identity record is available.</Empty>
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
              <p>
                Target roles, priorities, and work style prefill Jobs and guide
                matching. These are your choices and are used as-is.
              </p>
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
                  ? "Finish your deferred search direction"
                  : "Add your first target role"}
            </summary>
            <p>
              These are your choices and Workbench uses them as-is to find and
              compare roles.
            </p>
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
                disabled={
                  completePreferences.isPending ||
                  targetRoleText.trim().length === 0
                }
              >
                {completePreferences.isPending
                  ? "Saving preferences…"
                  : "Save search preferences"}
              </button>
            </form>
            {completePreferences.isSuccess && (
              <div className="notice" role="status">
                <Check aria-hidden="true" />
                <span>
                  Search preferences saved. Jobs will use them as defaults.
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
        eyebrow="Jobs"
        title="Find your next role."
        description="Start broad. You can narrow the search anytime."
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
                  className="search-editor-toggle"
                  type="button"
                  disabled={searchEditorOpen && hasUnsavedChanges}
                  onClick={() => setSearchEditorOpen((open) => !open)}
                >
                  {searchEditorOpen ? "Done" : "Edit"}
                </button>
              )}
            </header>
            {(!hasDiscoveryLeads || searchEditorOpen) && (
              <>
                <div className="discovery-basics">
                  <label htmlFor="discovery-target-roles">
                    Roles <span>one per line</span>
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
                  </label>
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
                    disabled={
                      save.isPending ||
                      splitLines(targetRoles).length === 0 ||
                      workArrangements.length === 0 ||
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
                <button
                  ref={searchActionRef}
                  className="primary discovery-refresh-button"
                  type="button"
                  disabled={discover.isPending || !dshAvailable}
                  onClick={() => discover.mutate()}
                >
                  <Sparkles aria-hidden="true" />
                  {discover.isPending ? "Finding jobs…" : "Find new matches"}
                </button>
              ) : (
                <section
                  className="discovery-next-action"
                  aria-labelledby="discovery-next-action-title"
                >
                  <div>
                    <p className="step-kicker">Next</p>
                    <h3 id="discovery-next-action-title">Find matching jobs</h3>
                  </div>
                  <button
                    ref={searchActionRef}
                    className="primary"
                    type="button"
                    disabled={discover.isPending || !dshAvailable}
                    onClick={() => discover.mutate()}
                  >
                    <Sparkles aria-hidden="true" />
                    {discover.isPending ? "Finding jobs…" : "Find jobs"}
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
                  Matches
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
                          const fitReasons = lead.whyFound.filter(
                            (reason) =>
                              !reason.startsWith("Current listing from "),
                          );
                          const primaryReason =
                            fitReasons[0] ?? "Matches your saved search.";
                          const additionalReasons = fitReasons.slice(1);
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
                              <p className="lead-summary">{primaryReason}</p>
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
                                  >
                                    Evaluate
                                  </Link>
                                )}
                              </div>
                              <details className="lead-more">
                                <summary>More</summary>
                                <div className="lead-more-content">
                                  {additionalReasons.length > 0 && (
                                    <section>
                                      <h4>Why it might fit</h4>
                                      <ul>
                                        {additionalReasons.map((reason) => (
                                          <li key={reason}>{reason}</li>
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
                                  {(lead.gaps.length > 0 ||
                                    lead.risks.length > 0) && (
                                    <section>
                                      <h4>Things to check</h4>
                                      <ul>
                                        {[...lead.gaps, ...lead.risks].map(
                                          (item) => (
                                            <li key={item}>{item}</li>
                                          ),
                                        )}
                                      </ul>
                                    </section>
                                  )}
                                  <p className="lead-source-note">
                                    Found on Remotive. Open the job for the full
                                    listing.
                                  </p>
                                  {lead.state === "new" && (
                                    <div className="lead-decision">
                                      <label htmlFor={`triage-note-${lead.id}`}>
                                        Add a note <span>optional</span>
                                        <input
                                          id={`triage-note-${lead.id}`}
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
                              </details>
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
        eyebrow="Opportunity intelligence"
        title="Captured opportunities"
        description="Save the original posting before comparing it with your career history."
      />
      <section className="panel">
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
          <label htmlFor="job-source">Posting text</label>
          <textarea
            id="job-source"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Paste the complete job description here. Career Workbench saves a local copy for comparison."
            required
          />
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
      <dl>
        <div>
          <dt>Location</dt>
          <dd>{opportunity.location ?? "Not stated"}</dd>
        </div>
        <div>
          <dt>Arrangement</dt>
          <dd>{opportunity.workArrangement ?? "Not stated"}</dd>
        </div>
        <div>
          <dt>Compensation</dt>
          <dd>{opportunity.advertisedCompensation ?? "Not stated"}</dd>
        </div>
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
        <summary>View saved posting</summary>
        <div className="source-inspection-body">
          {source === undefined ? (
            <Empty>The preserved source is unavailable in this snapshot.</Empty>
          ) : (
            <>
              {source.inlineText === null ? (
                <Empty>The saved posting text is not shown here.</Empty>
              ) : (
                <pre>{source.inlineText}</pre>
              )}
            </>
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
      <ErrorNotice error={update.error} />
    </article>
  );
}

function Evaluations({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const location = useLocation();
  const requestedOpportunityId = new URLSearchParams(location.search).get(
    "opportunity",
  );
  const requestedOpportunity = snapshot.opportunities.find(
    (opportunity) => opportunity.id === requestedOpportunityId,
  );
  const [opportunityId, setOpportunityId] = useState(
    requestedOpportunity?.id ?? snapshot.opportunities[0]?.id ?? "",
  );
  const hasVerifiedCareerFact = snapshot.profileFacts.some(
    (fact) =>
      fact.status === "verified" &&
      (fact.factType === "experience" || fact.factType === "achievement"),
  );
  const selectedEvaluations = [...snapshot.evaluations]
    .reverse()
    .filter((evaluation) => evaluation.opportunityId === opportunityId);
  const selectedEvaluation = selectedEvaluations[0];
  const previousEvaluations = selectedEvaluations.slice(1);
  useEffect(() => {
    if (
      requestedOpportunity !== undefined &&
      opportunityId !== requestedOpportunity.id
    ) {
      setOpportunityId(requestedOpportunity.id);
      return;
    }
    if (
      requestedOpportunity === undefined &&
      !snapshot.opportunities.some(
        (opportunity) => opportunity.id === opportunityId,
      )
    ) {
      setOpportunityId(snapshot.opportunities[0]?.id ?? "");
    }
  }, [opportunityId, requestedOpportunity, snapshot.opportunities]);
  const run = useMutation({
    mutationFn: () => mutate("/api/v1/evaluations/fixture", { opportunityId }),
    onSuccess: refresh,
  });
  return (
    <>
      <PageHeader
        eyebrow="Next step"
        title="Check the fit."
        description="See how a saved job matches your experience."
      />
      <section className="panel run-panel">
        <div>
          <h2>Choose a saved job</h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate();
          }}
        >
          <label htmlFor="evaluation-opportunity">Saved job</label>
          <select
            id="evaluation-opportunity"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select an opportunity
            </option>
            {snapshot.opportunities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.roleTitle} · {item.organization}
              </option>
            ))}
          </select>
          <button
            className="primary"
            type="submit"
            disabled={
              run.isPending || opportunityId === "" || !hasVerifiedCareerFact
            }
          >
            {run.isPending
              ? "Checking…"
              : selectedEvaluation === undefined
                ? "Check fit"
                : "Check again"}
          </button>
        </form>
        {!hasVerifiedCareerFact ? (
          <p className="field-help">
            Add your experience in Career before checking the fit.
          </p>
        ) : null}
        <ErrorNotice error={run.error} />
      </section>
      <div className="card-list">
        {snapshot.opportunities.length === 0 ? (
          <Empty>Save a job first.</Empty>
        ) : !hasVerifiedCareerFact ? (
          <Empty>Add your experience first.</Empty>
        ) : selectedEvaluation === undefined ? null : (
          <>
            <div className="current-evaluation">
              <EvaluationCard
                key={selectedEvaluation.id}
                evaluation={selectedEvaluation}
                snapshot={snapshot}
              />
            </div>
            {previousEvaluations.length > 0 && (
              <details className="evaluation-history">
                <summary>
                  Previous{" "}
                  {previousEvaluations.length === 1 ? "check" : "checks"}
                  {" · "}
                  {previousEvaluations.length}
                </summary>
                <div className="card-list">
                  {previousEvaluations.map((evaluation) => (
                    <EvaluationCard
                      key={evaluation.id}
                      evaluation={evaluation}
                      snapshot={snapshot}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
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
      aria-label={`${effectKind.replaceAll(".", " ")} approval`}
    >
      <header>
        <div>
          <strong>Explicit approval</strong>
          <p>
            Requesting records the exact effect and revision. A separate approve
            or deny decision is required before execution.
          </p>
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
            onClick={() => decideApproval.mutate("approved")}
          >
            Approve exact request
          </button>
          <button
            className="secondary"
            type="button"
            disabled={decideApproval.isPending}
            onClick={() => decideApproval.mutate("denied")}
          >
            Deny request
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
  return (
    <article className={`comparison-card ${comparison.state}`}>
      <header>
        <div>
          <p className="eyebrow">Policy {comparison.policyVersion}</p>
          <h2>Three-opportunity sensitivity comparison</h2>
        </div>
        <StatusPill tone={tone}>{comparison.state}</StatusPill>
      </header>
      <p className="comparison-binding">
        Bound to exact evaluation revisions. Scenario scores below were
        recomputed by Career Workbench; notebook output did not authorize this
        record.
      </p>
      {comparison.staleReason !== null && (
        <div className="notice warning" role="status">
          <RefreshCw aria-hidden="true" />
          <span>Stale: {comparison.staleReason}</span>
        </div>
      )}
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
      {comparison.tradeoffs.length > 0 && (
        <div className="tradeoffs">
          <h3>Trade-offs to review</h3>
          <ul>
            {comparison.tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            ))}
          </ul>
        </div>
      )}
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
        eyebrow="Decision support"
        title="Opportunity comparisons"
        description="Review sensitivity across user-defined priorities before explicitly accepting a durable result."
      />
      <div className="notice warning rlm-authority" role="note">
        <AlertTriangle aria-hidden="true" />
        <span>
          RLM is optional. When enabled, IPython and its subprocesses have full
          operating-system authority and are not sandboxed. Only validated
          structured proposals can reach canonical Career Workbench state.
        </span>
      </div>
      <div className="card-list">
        {snapshot.comparisons.length === 0 ? (
          <section className="panel comparison-empty">
            <h2>Prepare a three-opportunity comparison</h2>
            <p>
              A comparison is proposed by the exact originating DSH Agent and
              accepted here only after Career Workbench validates it.
            </p>
            <ul className="comparison-prerequisites">
              <li>
                <StatusPill tone={currentEvaluations >= 3 ? "good" : "warning"}>
                  {currentEvaluations >= 3 ? "ready" : "needed"}
                </StatusPill>
                <span>
                  <strong>
                    {Math.min(currentEvaluations, 3)} of 3 current evaluations
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
                    DSH {dshAvailable ? "available" : "unavailable"}
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
                    RLM {rlmAvailable ? "available" : "unavailable"}
                  </strong>
                  <Link to="/diagnostics">Open diagnostics</Link>
                </span>
              </li>
            </ul>
            <div className="comparison-next-action">
              <strong>Exact next action</strong>
              <p>
                {currentEvaluations < 3
                  ? "Complete three current evaluations, then return here."
                  : !dshAvailable || !rlmAvailable
                    ? "Enable DSH with RLM in the owning host profile, then ask the exact originating Agent to compare three current evaluations."
                    : "Ask the exact originating DSH Agent to compare three current evaluations with RLM; the structured proposal will appear here for review."}
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

function compactEvaluationText(value: string): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length <= 180
    ? compact
    : `${compact.slice(0, 179).trimEnd()}…`;
}

function EvaluationCard({
  evaluation,
  snapshot,
}: {
  readonly evaluation: EvaluationView;
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const seal = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/evaluations/${evaluation.id}/artifacts`, {}),
    onSuccess: refresh,
  });
  const opportunity = snapshot.opportunities.find(
    (item) => item.id === evaluation.opportunityId,
  );
  const artifacts = snapshot.artifacts.filter((item) =>
    item.evaluationIds.includes(evaluation.id),
  );
  const operation =
    evaluation.operationId === null
      ? undefined
      : snapshot.operations.find((item) => item.id === evaluation.operationId);
  const acceptedEvidence = evaluation.acceptedEvidenceIds.flatMap((id) => {
    const evidence = snapshot.evidence.find((item) => item.id === id);
    return evidence === undefined ? [] : [evidence];
  });
  const relatedSourceIds = new Set(
    acceptedEvidence.flatMap((item) =>
      item.sourceId === null ? [] : [item.sourceId],
    ),
  );
  const relatedFactIds = new Set(
    acceptedEvidence.flatMap((item) =>
      item.candidateFactId === null ? [] : [item.candidateFactId],
    ),
  );
  if (opportunity !== undefined)
    relatedSourceIds.add(opportunity.sourceDocumentId);
  const rejectedEvidence = snapshot.evidence.filter(
    (item) =>
      item.decision === "rejected" &&
      ((item.sourceId !== null && relatedSourceIds.has(item.sourceId)) ||
        (item.candidateFactId !== null &&
          relatedFactIds.has(item.candidateFactId))),
  );
  const careerEvidence = acceptedEvidence.filter(
    (item) => item.classification === "candidate_fact",
  );
  const additionalEvidenceCount = acceptedEvidence.filter(
    (item) =>
      item.classification !== "candidate_fact" &&
      item.classification !== "opportunity_fact",
  ).length;
  const isLocalDemonstration = operation?.route === "deterministic";
  return (
    <article className={`evaluation-card ${evaluation.state}`}>
      <header>
        <div>
          <p className="eyebrow">
            {opportunity?.organization ?? "Opportunity"}
          </p>
          <h2>{opportunity?.roleTitle ?? "Evaluation"}</h2>
        </div>
        <div className="score">
          <strong>{evaluation.displayScore}</strong>
          <span>/ 100</span>
        </div>
      </header>
      {isLocalDemonstration && (
        <div className="notice warning evaluation-disclaimer" role="note">
          <AlertTriangle aria-hidden="true" />
          <strong>Fit estimate, not a recommendation.</strong>
        </div>
      )}
      {operation !== undefined && operation.state !== "succeeded" && (
        <div className="operation-status" aria-label="Evaluation operation">
          <StatusPill
            tone={
              operation.state === "succeeded"
                ? "good"
                : operation.state === "running"
                  ? "warning"
                  : "neutral"
            }
          >
            {operation.route.replaceAll("_", " ")} · {operation.state}
          </StatusPill>
          <span>
            {operation.terminalMessage ?? "Authoritative operation in progress"}
          </span>
        </div>
      )}
      {evaluation.state === "stale" && (
        <div className="notice warning">
          <RefreshCw aria-hidden="true" />
          <span>Stale: {evaluation.staleReason}</span>
        </div>
      )}
      <Tabs.Root defaultValue="score">
        <Tabs.List aria-label="Evaluation details">
          <Tabs.Trigger value="score">Score</Tabs.Trigger>
          <Tabs.Trigger value="evidence">Used</Tabs.Trigger>
          <Tabs.Trigger value="gaps">Gaps</Tabs.Trigger>
          <Tabs.Trigger value="artifacts">Artifacts</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="score">
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
          <details className="evaluation-math">
            <summary>How this was calculated</summary>
            <p className="math">{evaluation.arithmeticExplanation}</p>
          </details>
        </Tabs.Content>
        <Tabs.Content value="evidence">
          <div className="evaluation-input-summary">
            <section>
              <Check aria-hidden="true" />
              <div>
                <h3>Your experience</h3>
                {careerEvidence.slice(0, 2).map((evidence) => (
                  <p key={evidence.id}>
                    {compactEvaluationText(evidence.claim)}
                  </p>
                ))}
                {careerEvidence.length > 2 && (
                  <small>
                    +{careerEvidence.length - 2} more career details
                  </small>
                )}
              </div>
            </section>
            <section>
              <Check aria-hidden="true" />
              <div>
                <h3>Saved job</h3>
                <p>
                  {opportunity?.roleTitle ?? "Role"}
                  {opportunity?.organization === undefined
                    ? ""
                    : ` at ${opportunity.organization}`}
                </p>
                {additionalEvidenceCount > 0 && (
                  <small>
                    +{additionalEvidenceCount} additional matched{" "}
                    {additionalEvidenceCount === 1 ? "detail" : "details"}
                  </small>
                )}
              </div>
            </section>
          </div>
          {rejectedEvidence.length > 0 && (
            <details className="evaluation-unused-details">
              <summary>Not used · {rejectedEvidence.length}</summary>
              <ul className="evidence-list">
                {rejectedEvidence.map((evidence) => (
                  <li key={evidence.id}>
                    <AlertTriangle aria-hidden="true" />
                    <span>
                      {evidence.claim}
                      <small>
                        {evidence.classification.replaceAll("_", " ")}
                        {evidence.decisionReason === null
                          ? " · rejected"
                          : ` · ${evidence.decisionReason}`}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Tabs.Content>
        <Tabs.Content value="gaps">
          <div className="evaluation-findings">
            <section>
              <h3>Critical findings and gaps</h3>
              {evaluation.gaps.length === 0 ? (
                <Empty>
                  No blocking gaps. Missing inputs received the rubric’s
                  documented treatment.
                </Empty>
              ) : (
                <ul>
                  {evaluation.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>Contradictions</h3>
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
            <button
              className="secondary"
              onClick={() => seal.mutate()}
              disabled={seal.isPending}
            >
              Seal immutable report
            </button>
          ) : (
            artifacts.map((artifact) => (
              <ArtifactRow key={artifact.id} artifact={artifact} />
            ))
          )}
          <ErrorNotice error={seal.error} />
        </Tabs.Content>
      </Tabs.Root>
    </article>
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

function Pipeline({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const missing = snapshot.opportunities.filter(
    (opportunity) =>
      !snapshot.applications.some(
        (application) => application.opportunityId === opportunity.id,
      ),
  );
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
        eyebrow="Human-controlled workflow"
        title="Application pipeline"
        description="Track state transitions and next actions without submitting, messaging, accepting, rejecting, or withdrawing anything on an external service."
      />
      {missing.length > 0 && (
        <section className="panel run-panel">
          <div>
            <h2>Start tracking an opportunity</h2>
            <p>The initial canonical state is considering.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label htmlFor="pipeline-opportunity">Opportunity</label>
            <select
              id="pipeline-opportunity"
              value={opportunityId}
              onChange={(event) => setOpportunityId(event.target.value)}
              required
            >
              {missing.map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.roleTitle} · {opportunity.organization}
                </option>
              ))}
            </select>
            <button
              className="primary"
              type="submit"
              disabled={create.isPending}
            >
              Start pipeline record
            </button>
          </form>
          <ErrorNotice error={create.error} />
        </section>
      )}
      <div className="pipeline-board">
        {snapshot.applications.length === 0 ? (
          <Empty>No applications are being tracked yet.</Empty>
        ) : (
          snapshot.applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              snapshot={snapshot}
            />
          ))
        )}
      </div>
    </>
  );
}

function ApplicationCard({
  application,
  snapshot,
}: {
  readonly application: ApplicationView;
  readonly snapshot: SnapshotResponse;
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
  const history = snapshot.events.filter(
    (event) =>
      event.aggregateId === application.id &&
      (event.eventKind === "application.created" ||
        event.eventKind === "application.imported" ||
        event.eventKind === "career_ops.application.imported" ||
        event.eventKind === "application.transitioned"),
  );
  const nextAction = nextApplicationAction(application, snapshot);
  return (
    <article className="application-card">
      <header>
        <div>
          <p className="eyebrow">
            {opportunity?.organization ?? "Opportunity"}
          </p>
          <h2>{opportunity?.roleTitle ?? application.opportunityId}</h2>
        </div>
        <StatusPill
          tone={
            ["interview", "offer", "hired"].includes(application.state)
              ? "good"
              : ["rejected", "withdrawn", "closed"].includes(application.state)
                ? "neutral"
                : "warning"
          }
        >
          {application.state.replaceAll("_", " ")}
        </StatusPill>
      </header>
      <p className="next-action">
        <strong>Next action:</strong>{" "}
        <Link to={nextAction.to}>{nextAction.label}</Link>
      </p>
      <small>
        Entity revision {application.revision} · state revision{" "}
        {application.stateRevision} · effective {application.effectiveDate}
      </small>
      {allowed.length > 0 && (
        <>
          <form
            className="application-transition"
            onSubmit={(event) => {
              event.preventDefault();
              transition.mutate();
            }}
          >
            <label>
              Record next state
              <select
                value={nextState}
                onChange={(event) => setNextState(event.target.value)}
              >
                {allowed.map((state) => (
                  <option key={state} value={state}>
                    {state.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local note
              <input
                value={note}
                maxLength={2_000}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button
              className="secondary"
              type="submit"
              disabled={transition.isPending}
            >
              {nextState === "applied"
                ? "Record as applied. Does not submit."
                : "Record transition"}
            </button>
          </form>
          <ApprovalGate
            effectKind="application.transition"
            targetId={application.id}
            targetRevision={application.revision}
            actionLabel="Continue in DSH"
            requestLabel={`Authorize ${nextState} for the DSH Agent`}
            canRequest={nextState !== ""}
            requestDetails={{
              applicationTransition: {
                state: nextState,
                effectiveDate,
                ...(note.trim().length === 0 ? {} : { note: note.trim() }),
              },
            }}
            approvedMessage="Exact transition approved for five minutes. Return to the originating DSH conversation and ask it to continue; the approval is single-use."
          />
        </>
      )}
      <details>
        <summary>Transition history ({history.length})</summary>
        <ol className="compact-history">
          {history.map((event) => (
            <li key={event.sequence}>
              <span>{event.eventKind.replaceAll("_", " ")}</span>
              <time>{new Date(event.timestamp).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      </details>
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
        eyebrow="Application writing"
        title="Drafts and review"
        description="Generate local drafts from the career details you selected. Style notes guide tone; every draft stays under your control and nothing is submitted."
      />
      <section className="panel draft-builder">
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
          <label>
            Non-factual style direction
            <textarea
              value={styleNote}
              maxLength={1_000}
              onChange={(event) => setStyleNote(event.target.value)}
            />
          </label>
          <p className="trust-note">
            {eligibleFacts.length} career details are ready. Generation stores a
            staged local draft; it sends nothing.
          </p>
          <button
            className="primary"
            type="submit"
            disabled={
              generate.isPending ||
              opportunityId === "" ||
              eligibleFacts.length === 0
            }
          >
            Generate staged draft
          </button>
        </form>
        <ErrorNotice error={generate.error} />
      </section>
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
          <p className="eyebrow">Revision {artifact.revision}</p>
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
      <div className="actions">
        <button
          type="button"
          onClick={() => inspect.mutate()}
          disabled={inspect.isPending}
        >
          Inspect draft
        </button>
      </div>
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
        eyebrow="Read-only migration"
        title="Import Career Ops"
        description="Discover a local Career Ops directory, review every supported mapping, then confirm one exact source fingerprint. No Career Ops scripts, agents, credentials, or browser state are executed or imported."
      />
      <section className="panel import-discovery">
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
        <p className="trust-note">
          The directory path stays server-side. The preview expires after 15
          minutes, and apply fails if any selected byte changes.
        </p>
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
          <p className="import-identity">
            Career Ops {preview.observedVersion ?? "version unavailable"}
          </p>
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

          <div className="two-column import-columns">
            <article className="panel">
              <h3>Selected source bytes</h3>
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
            <article className="panel">
              <h3>Explicitly unsupported</h3>
              <ul className="check-list">
                {preview.unsupported.map((item) => (
                  <li key={item}>
                    <ShieldCheck aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

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
                    <small>
                      {mapping.type.replaceAll("_", " ")} · {mapping.source}
                    </small>
                    <small>{mapping.note}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <section className="panel import-table-wrap">
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
            <code>{manifest.sourceFingerprint.slice(0, 16)}…</code>
            <details>
              <summary>Mapping receipt ({manifest.mappings.length})</summary>
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
  const [operationLimit, setOperationLimit] = useState(5);
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
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  return (
    <>
      <PageHeader
        eyebrow="Ordered event log"
        title="Activity"
        description="The browser resumes from the last observed sequence after a disconnect."
      />
      <div className="notice">
        <span className={`stream-dot ${streamState}`} aria-hidden="true" />
        <span>
          Live stream {streamState}. Latest sequence:{" "}
          {snapshot.events.at(-1)?.sequence ?? 0}
        </span>
      </div>
      <section className="section-head activity-head">
        <div>
          <p className="eyebrow">Durable audit</p>
          <h2>Ordered events</h2>
          <p>
            Newest events appear first. Move through a bounded page instead of
            an endless log.
          </p>
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
                <p>
                  {event.eventKind} · record {event.aggregateId}
                </p>
                <time>{new Date(event.timestamp).toLocaleString()}</time>
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
      <section className="section-head operation-head">
        <div>
          <p className="eyebrow">Agent lineage</p>
          <h2>Authoritative operations</h2>
          <p>
            Admission, inbox start, reports, cancellation, and terminal state
            remain distinct.
          </p>
        </div>
        <StatusPill>{snapshot.operations.length} operations</StatusPill>
      </section>
      <div className="operation-tree" aria-label="Agent operation lineage">
        {rootOperations.length === 0 ? (
          <Empty>No DSH operations recorded yet.</Empty>
        ) : (
          rootOperations
            .slice(0, operationLimit)
            .map((operation) => (
              <OperationNode
                key={operation.id}
                operation={operation}
                snapshot={snapshot}
                depth={0}
              />
            ))
        )}
      </div>
      {rootOperations.length > 5 && (
        <div className="operation-controls">
          <p>
            Showing {Math.min(operationLimit, rootOperations.length)} of{" "}
            {rootOperations.length} root operations
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              setOperationLimit((current) =>
                current >= rootOperations.length ? 5 : current + 5,
              )
            }
          >
            {operationLimit >= rootOperations.length
              ? "Show recent 5"
              : "Show 5 more"}
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
            <span className="operation-route">
              {operation.route.replaceAll("_", " ")}
            </span>
            <h3>{operation.kind.replaceAll("_", " ")}</h3>
          </div>
          <StatusPill tone={tone}>
            {operation.state.replaceAll("_", " ")}
          </StatusPill>
        </header>
        <dl>
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
        eyebrow="Compatibility and trust"
        title="Diagnostics"
        description="This surface reports capabilities without exposing credentials or sensitive paths."
      />
      {diagnostics.isLoading ? (
        <p role="status">Checking local services…</p>
      ) : diagnostics.error !== null ? (
        <ErrorNotice error={diagnostics.error} />
      ) : (
        diagnostics.data !== undefined && (
          <>
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
            <section className="panel">
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
            <section className="panel">
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
