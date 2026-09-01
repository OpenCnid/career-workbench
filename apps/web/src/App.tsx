import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CircleGauge,
  Columns3,
  Database,
  Download,
  FileCheck2,
  FilePenLine,
  FolderInput,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { NavLink, Navigate, Route, Routes } from "react-router";
import type {
  ArtifactView,
  ComparisonView,
  EvaluationView,
  OperationView,
  OpportunityView,
  ProfileFactView,
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

const nav = [
  { to: "/overview", label: "Overview", icon: CircleGauge },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { to: "/evaluations", label: "Evaluations", icon: FileCheck2 },
  { to: "/comparisons", label: "Compare", icon: Scale },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/drafts", label: "Drafts", icon: FilePenLine },
  { to: "/imports", label: "Import", icon: FolderInput },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/diagnostics", label: "Diagnostics", icon: Database },
] as const;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed.";
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

function Onboarding({
  onReady,
}: {
  readonly onReady: () => Promise<void>;
}): React.JSX.Element {
  const [displayName, setDisplayName] = useState("My Career Workspace");
  const create = useMutation({
    mutationFn: () =>
      mutate("/api/v1/workspaces", {
        displayName,
        locale: "en-US",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    onSuccess: onReady,
  });
  return (
    <main className="onboarding">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-mark large" aria-hidden="true">
          CW
        </div>
        <p className="eyebrow">Local-first career intelligence</p>
        <h1 id="welcome-title">Build decisions on evidence you control.</h1>
        <p className="lede">
          Career Workbench stores verified career facts, opportunity sources,
          deterministic scores, and sealed reports on this computer.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label htmlFor="workspace-name">Workspace name</label>
          <input
            id="workspace-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={120}
          />
          <button className="primary" disabled={create.isPending} type="submit">
            {create.isPending ? "Creating…" : "Create local workspace"}
          </button>
        </form>
        <ErrorNotice error={create.error} />
        <p className="trust-note">
          <ShieldCheck aria-hidden="true" /> Mutations require same-origin CSRF
          proof. Nothing is submitted externally.
        </p>
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
  return (
    <div className="shell">
      <aside className="sidebar">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">
            CW
          </span>
          <span>
            Career
            <br />
            Workbench
          </span>
        </header>
        <nav aria-label="Primary">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className={`stream-dot ${streamState}`} aria-hidden="true" />
          <span>Activity {streamState}</span>
        </div>
      </aside>
      <main className="content" id="main-content">
        <Routes>
          <Route path="/overview" element={<Overview snapshot={snapshot} />} />
          <Route path="/profile" element={<Profile snapshot={snapshot} />} />
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
  const verified = snapshot.profileFacts.filter(
    (fact) => fact.status === "verified",
  ).length;
  const current = snapshot.evaluations.filter(
    (evaluation) => evaluation.state === "completed",
  ).length;
  const [searchTerm, setSearchTerm] = useState("");
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
      query<Readonly<Record<string, unknown>>>("/api/v1/export"),
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
      <PageHeader
        eyebrow="Workspace"
        title={`Good work starts with good evidence.`}
        description={`${snapshot.workspace?.displayName ?? "Local workspace"} keeps every claim traceable, revisable, and private.`}
      />
      <section className="stat-grid" aria-label="Workspace summary">
        <article>
          <span>Verified facts</span>
          <strong>{verified}</strong>
          <small>
            {snapshot.profileFacts.length - verified} awaiting or superseded
          </small>
        </article>
        <article>
          <span>Opportunities</span>
          <strong>{snapshot.opportunities.length}</strong>
          <small>captured source records</small>
        </article>
        <article>
          <span>Current evaluations</span>
          <strong>{current}</strong>
          <small>
            {
              snapshot.evaluations.filter((item) => item.state === "stale")
                .length
            }{" "}
            stale
          </small>
        </article>
        <article>
          <span>Sealed artifacts</span>
          <strong>
            {
              snapshot.artifacts.filter((item) => item.state === "sealed")
                .length
            }
          </strong>
          <small>immutable, content-addressed</small>
        </article>
      </section>
      <section className="panel next-step">
        <div>
          <p className="eyebrow">Suggested next step</p>
          <h2>
            {verified === 0
              ? "Verify one profile fact"
              : snapshot.opportunities.length === 0
                ? "Capture an opportunity"
                : "Run a deterministic evaluation"}
          </h2>
          <p>
            The workbench will preserve the source and show exactly how each
            accepted fact affects the result.
          </p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </section>
      <div className="two-column workspace-tools">
        <section className="panel">
          <h2>Search canonical records</h2>
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
          <h2>Credential-free export</h2>
          <p>
            Download normalized canonical records, ordered audit events, schema
            versions, and manifest digests. Sealed source bytes are excluded by
            default.
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            <Download aria-hidden="true" />
            {download.isPending ? "Preparing…" : "Download workspace JSON"}
          </button>
          <ErrorNotice error={download.error} />
        </section>
      </div>
    </>
  );
}

function Profile({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [sourceText, setSourceText] = useState(
    "Avery Example built TypeScript services",
  );
  const [sourceId, setSourceId] = useState("");
  const [subject, setSubject] = useState("Avery Example");
  const [predicate, setPredicate] = useState("built");
  const [value, setValue] = useState("TypeScript services");
  const capture = useMutation({
    mutationFn: () =>
      mutate<SourceView>("/api/v1/sources", {
        kind: "candidate",
        trustClass: "candidate_primary",
        mediaType: "text/plain",
        text: sourceText,
        originalLocator: "user-entry://profile",
      }),
    onSuccess: async (source) => {
      setSourceId(source.id);
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
  return (
    <>
      <PageHeader
        eyebrow="Candidate record"
        title="Profile evidence"
        description="A fact is usable only after you verify the exact source-backed claim."
      />
      <div className="two-column">
        <section className="panel">
          <h2>1. Capture a candidate source</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              capture.mutate();
            }}
          >
            <label htmlFor="candidate-source">Source text</label>
            <textarea
              id="candidate-source"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              required
            />
            <button
              className="secondary"
              type="submit"
              disabled={capture.isPending}
            >
              Capture source
            </button>
          </form>
          <ErrorNotice error={capture.error} />
        </section>
        <section className="panel">
          <h2>2. Propose a fact</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              propose.mutate();
            }}
          >
            <label htmlFor="fact-source">Candidate source</label>
            <select
              id="fact-source"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              required
            >
              <option value="">Select a source</option>
              {snapshot.sources
                .filter((item) => item.kind === "candidate")
                .map((source) => (
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
              Propose for verification
            </button>
          </form>
          <ErrorNotice error={propose.error} />
        </section>
      </div>
      <section className="section-head">
        <div>
          <p className="eyebrow">Fact ledger</p>
          <h2>Candidate assertions</h2>
        </div>
        <StatusPill tone="good">
          {
            snapshot.profileFacts.filter((fact) => fact.status === "verified")
              .length
          }{" "}
          verified
        </StatusPill>
      </section>
      <div className="card-list">
        {snapshot.profileFacts.length === 0 ? (
          <Empty>No facts captured yet.</Empty>
        ) : (
          snapshot.profileFacts.map((fact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              affectedOutputs={
                snapshot.evaluations.length + snapshot.artifacts.length
              }
            />
          ))
        )}
      </div>
    </>
  );
}

function FactCard({
  fact,
  affectedOutputs,
}: {
  readonly fact: ProfileFactView;
  readonly affectedOutputs: number;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [corrected, setCorrected] = useState(String(fact.value ?? ""));
  const [showCorrection, setShowCorrection] = useState(false);
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
  return (
    <article className="fact-card">
      <div className="fact-body">
        <div>
          <StatusPill tone={tone}>
            {fact.status.replaceAll("_", " ")}
          </StatusPill>
          <h3>
            {fact.subject} <span>{fact.predicate}</span> {String(fact.value)}
          </h3>
        </div>
        <small>Revision {fact.revision}</small>
      </div>
      {fact.status === "proposed" && (
        <div className="actions" aria-label="Confirmation outcomes">
          <button onClick={() => decide.mutate("confirm")}>
            <Check aria-hidden="true" />
            Confirm
          </button>
          <button onClick={() => setShowCorrection(true)}>Correct</button>
          <button onClick={() => decide.mutate("narrative_only")}>
            Narrative only
          </button>
          <button onClick={() => decide.mutate("cannot_confirm")}>
            Cannot confirm
          </button>
        </div>
      )}
      {fact.status === "verified" && (
        <div className="actions">
          <button onClick={() => setShowCorrection((value) => !value)}>
            Correct verified fact
          </button>
        </div>
      )}
      {showCorrection && (
        <div className="correction-preview">
          <p>
            This creates a new verified revision and marks {affectedOutputs}{" "}
            dependent evaluation or artifact records stale. History is kept.
          </p>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              correct.mutate();
            }}
          >
            <label htmlFor={`correct-${fact.id}`}>Corrected value</label>
            <input
              id={`correct-${fact.id}`}
              value={corrected}
              onChange={(event) => setCorrected(event.target.value)}
            />
            <button className="primary" type="submit">
              Save correction
            </button>
          </form>
        </div>
      )}
      <ErrorNotice error={decide.error ?? correct.error} />
    </article>
  );
}

function Opportunities({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const [organization, setOrganization] = useState("Synthetic Labs");
  const [roleTitle, setRoleTitle] = useState("Platform Engineer");
  const [description, setDescription] = useState(
    "Synthetic Labs needs a Platform Engineer to build TypeScript services.",
  );
  const capture = useMutation({
    mutationFn: async () => {
      const source = await mutate<SourceView>("/api/v1/sources", {
        kind: "opportunity",
        trustClass: "external",
        mediaType: "text/plain",
        text: description,
        originalLocator: "https://example.test/jobs/platform-engineer",
      });
      return mutate("/api/v1/opportunities", {
        sourceDocumentId: source.id,
        organization,
        roleTitle,
        originalUrl: "https://example.test/jobs/platform-engineer",
        location: "Remote",
        workArrangement: "remote",
      });
    },
    onSuccess: refresh,
  });
  return (
    <>
      <PageHeader
        eyebrow="Opportunity intelligence"
        title="Captured opportunities"
        description="Preserve the original posting before comparing it with verified candidate evidence."
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
            <label>
              Organization
              <input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                required
              />
            </label>
            <label>
              Role title
              <input
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                required
              />
            </label>
          </div>
          <label htmlFor="job-source">Posting text</label>
          <textarea
            id="job-source"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))
        )}
      </div>
    </>
  );
}

function OpportunityCard({
  opportunity,
}: {
  readonly opportunity: OpportunityView;
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
      </dl>
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
          Legitimacy evidence
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
  const [opportunityId, setOpportunityId] = useState(
    snapshot.opportunities[0]?.id ?? "",
  );
  useEffect(() => {
    if (opportunityId === "" && snapshot.opportunities[0] !== undefined)
      setOpportunityId(snapshot.opportunities[0].id);
  }, [opportunityId, snapshot.opportunities]);
  const run = useMutation({
    mutationFn: () => mutate("/api/v1/evaluations/fixture", { opportunityId }),
    onSuccess: refresh,
  });
  return (
    <>
      <PageHeader
        eyebrow="Deterministic assessment"
        title="Evidence-led evaluations"
        description="Scores are integer arithmetic over a versioned rubric. Missing inputs remain visible."
      />
      <section className="panel run-panel">
        <div>
          <h2>Run the balanced-fit workflow</h2>
          <p>
            Uses one verified candidate fact and the captured opportunity
            source. The result is reproducible.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate();
          }}
        >
          <label htmlFor="evaluation-opportunity">Opportunity</label>
          <select
            id="evaluation-opportunity"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
            required
          >
            <option value="">Select an opportunity</option>
            {snapshot.opportunities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.roleTitle} · {item.organization}
              </option>
            ))}
          </select>
          <button
            className="primary"
            type="submit"
            disabled={run.isPending || opportunityId === ""}
          >
            {run.isPending ? "Evaluating…" : "Run evaluation"}
          </button>
        </form>
        <ErrorNotice error={run.error} />
      </section>
      <div className="card-list">
        {snapshot.evaluations.length === 0 ? (
          <Empty>
            No evaluations yet. Verify a profile fact and capture an opportunity
            first.
          </Empty>
        ) : (
          [...snapshot.evaluations]
            .reverse()
            .map((evaluation) => (
              <EvaluationCard
                key={evaluation.id}
                evaluation={evaluation}
                snapshot={snapshot}
              />
            ))
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

function ComparisonCard({
  comparison,
  snapshot,
}: {
  readonly comparison: ComparisonView;
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
  const refresh = useRefresh();
  const accept = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/comparisons/${comparison.id}/accept`, {
        expectedRevision: comparison.revision,
      }),
    onSuccess: refresh,
  });
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
      {comparison.state === "proposed" && (
        <div className="comparison-approval">
          <div>
            <strong>User decision required</strong>
            <p>
              Accepting preserves this reviewed result. It does not apply,
              message anyone, or perform another external action.
            </p>
          </div>
          <button
            className="primary"
            type="button"
            disabled={accept.isPending}
            onClick={() => accept.mutate()}
          >
            {accept.isPending ? "Accepting…" : "Accept comparison"}
          </button>
        </div>
      )}
      <ErrorNotice error={accept.error} />
    </article>
  );
}

function Comparisons({
  snapshot,
}: {
  readonly snapshot: SnapshotResponse;
}): React.JSX.Element {
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
          <Empty>
            No comparison proposals yet. A live DSH Agent can select the RLM
            route for exactly three current evaluations; ordinary evaluations
            remain available when RLM is unavailable.
          </Empty>
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
      {operation !== undefined && (
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
          <Tabs.Trigger value="evidence">Evidence</Tabs.Trigger>
          <Tabs.Trigger value="gaps">Gaps</Tabs.Trigger>
          <Tabs.Trigger value="artifacts">Artifacts</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="score">
          <p className="math">{evaluation.arithmeticExplanation}</p>
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
        </Tabs.Content>
        <Tabs.Content value="evidence">
          <ul className="evidence-list">
            {evaluation.acceptedEvidenceIds.map((id) => {
              const evidence = snapshot.evidence.find((item) => item.id === id);
              return (
                <li key={id}>
                  <Check aria-hidden="true" />
                  <span>
                    {evidence?.claim ?? id}
                    <small>
                      {evidence?.classification.replaceAll("_", " ")}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </Tabs.Content>
        <Tabs.Content value="gaps">
          {evaluation.gaps.length === 0 ? (
            <Empty>
              No blocking gaps. Missing preference data received the rubric’s
              neutral treatment.
            </Empty>
          ) : (
            <ul>
              {evaluation.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          )}
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

function nextApplicationAction(state: string): string {
  const labels: Readonly<Record<string, string>> = {
    considering: "Prepare evidence-backed materials",
    preparing: "Move completed drafts to review",
    ready_for_review: "Submit outside Workbench, then record it here",
    applied: "Track response and follow-up date",
    responded: "Prepare for the next conversation",
    interview: "Record interview outcome",
    offer: "Review the offer; Workbench will not accept it",
    hired: "No next action",
    rejected: "No next action",
    withdrawn: "No next action",
    closed: "No next action",
  };
  return labels[state] ?? "Review current state";
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
  const transition = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/applications/${application.id}/transitions`, {
        expectedRevision: application.revision,
        state: nextState,
        effectiveDate: new Date().toISOString().slice(0, 10),
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
        <strong>Next action:</strong> {nextApplicationAction(application.state)}
      </p>
      <small>
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
              ? "Record as applied — does not submit"
              : "Record transition"}
          </button>
        </form>
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
        eyebrow="Evidence-backed writing"
        title="Drafts and review"
        description="Generate immutable candidate-facing drafts only from verified facts with accepted evidence. Style text is explicitly labeled non-factual and every draft requires human review."
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
                <option value="draft_cv">CV evidence draft</option>
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
            {eligibleFacts.length} verified facts have accepted candidate
            evidence and are eligible. Generation stores a staged local draft;
            it sends nothing.
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
  const refresh = useRefresh();
  const [content, setContent] = useState<string | null>(null);
  const inspect = useMutation({
    mutationFn: () =>
      query<{ readonly text: string }>(
        `/api/v1/artifacts/${artifact.id}/content`,
      ),
    onSuccess: (result) => setContent(result.text),
  });
  const review = useMutation({
    mutationFn: () =>
      mutate(`/api/v1/artifacts/${artifact.id}/review`, {
        expectedRevision: artifact.revision,
      }),
    onSuccess: refresh,
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
          <span>verified facts</span>
        </div>
        <div>
          <strong>{artifact.evidenceIds.length}</strong>
          <span>accepted evidence</span>
        </div>
        <div>
          <strong>{artifact.sourceIds.length}</strong>
          <span>immutable sources</span>
        </div>
      </div>
      <div className="actions">
        <button
          type="button"
          onClick={() => inspect.mutate()}
          disabled={inspect.isPending}
        >
          Inspect content and provenance
        </button>
        {artifact.state === "staged" && (
          <button
            className="primary"
            type="button"
            onClick={() => review.mutate()}
          >
            Mark reviewed and seal
          </button>
        )}
      </div>
      {content !== null && (
        <div className="artifact-inspection">
          <pre>{content}</pre>
          <h3>Bound profile facts</h3>
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
      <ErrorNotice error={inspect.error ?? review.error} />
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
    readonly predicate: string;
    readonly value: string | number | boolean | null;
    readonly confirmationRequired: true;
  }[];
  readonly applications: readonly {
    readonly sourceIdentity: string;
    readonly organization: string;
    readonly roleTitle: string;
    readonly originalStatus: string;
    readonly mappedState: string;
    readonly originalScore: string | null;
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
  const discover = useMutation({
    mutationFn: () =>
      mutate<CareerOpsPreview>("/api/v1/imports/career-ops/preview", {
        sourceDirectory,
      }),
    onSuccess: setPreview,
  });
  const apply = useMutation({
    mutationFn: async () => {
      if (preview === null) throw new Error("Review a current preview first.");
      return mutate<{ readonly id: string }>(
        `/api/v1/imports/career-ops/${preview.previewId}/apply`,
        { sourceFingerprint: preview.sourceFingerprint, confirm: true },
      );
    },
    onSuccess: async () => {
      await refresh();
      setPreview((current) =>
        current === null ? null : { ...current, alreadyImported: true },
      );
    },
  });
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
              <p className="eyebrow">Exact preview</p>
              <h2>{preview.sourceLabel}</h2>
            </div>
            <StatusPill tone={preview.alreadyImported ? "good" : "warning"}>
              {preview.alreadyImported
                ? "already imported"
                : "confirmation required"}
            </StatusPill>
          </div>
          <p className="import-identity">
            Career Ops {preview.observedVersion ?? "version unavailable"} · pin{" "}
            <code>{preview.upstreamRevision.slice(0, 12)}</code> · fingerprint{" "}
            <code>{preview.sourceFingerprint.slice(0, 16)}…</code>
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
                      <td>{application.originalScore ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h3>Candidate-fact gate</h3>
            <p>
              {preview.profileFacts.length} scalar profile values will be
              proposed, not verified. Each requires the normal candidate
              confirmation and accepted-evidence flow before candidate-facing
              use.
            </p>
            <div className="import-confirm">
              <div>
                <strong>Confirm this exact preview</strong>
                <p>
                  This writes local canonical state only. It cannot submit an
                  application, send a message, or start a Career Ops worker.
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
                    : "Confirm and import"}
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
          </article>
        ))}
        {snapshot.importManifests.length === 0 && (
          <Empty>No confirmed Career Ops imports yet.</Empty>
        )}
      </div>
    </>
  );
}

function ActivityPage({
  snapshot,
  streamState,
}: {
  readonly snapshot: SnapshotResponse;
  readonly streamState: string;
}): React.JSX.Element {
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
      <section className="section-head operation-head">
        <div>
          <p className="eyebrow">Agent lineage</p>
          <h2>Authoritative operations</h2>
          <p>
            Admission, inbox start, reports, cancellation, and terminal state
            are separate. A child handle is never shown as completion.
          </p>
        </div>
        <StatusPill>
          {
            snapshot.operations.filter((item) => item.route === "native_child")
              .length
          }{" "}
          native child epochs
        </StatusPill>
      </section>
      <div className="operation-tree" aria-label="Agent operation lineage">
        {snapshot.operations.length === 0 ? (
          <Empty>No DSH operations recorded yet.</Empty>
        ) : (
          snapshot.operations
            .filter((item) => item.parentOperationId === null)
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
      <section className="section-head">
        <div>
          <p className="eyebrow">Durable audit</p>
          <h2>Ordered events</h2>
        </div>
      </section>
      <ol className="timeline">
        {[...snapshot.events].reverse().map((event) => (
          <li key={event.sequence}>
            <span>{event.sequence}</span>
            <div>
              <strong>{event.eventKind}</strong>
              <p>{event.aggregateId}</p>
              <time>{new Date(event.timestamp).toLocaleString()}</time>
            </div>
          </li>
        ))}
      </ol>
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
    stream.onopen = () => setState("connected");
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
