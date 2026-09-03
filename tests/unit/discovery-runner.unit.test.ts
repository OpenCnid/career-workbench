import { describe, expect, it, vi } from "vitest";
import { searchRemotiveJobs } from "../../apps/server/src/discovery-runner.js";

describe("bounded current-job search", () => {
  it("queries only the fixed Remotive API and normalizes returned listings", async () => {
    const fetchImplementation = vi.fn<typeof fetch>((input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      expect(url.origin).toBe("https://remotive.com");
      expect(url.pathname).toBe("/api/remote-jobs");
      expect(url.searchParams.get("search")).toBe("AI platform engineer");
      expect(url.searchParams.get("limit")).toBe("8");
      expect(init?.headers).toEqual({ accept: "application/json" });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            jobs: [
              null,
              {
                id: 42,
                url: "https://remotive.com/remote-jobs/software-dev/senior-ai-platform-engineer-42#apply",
                title: "Senior AI Platform Engineer",
                company_name: "Synthetic Systems",
                candidate_required_location: "United States",
                job_type: "full_time",
                salary: "$190,000–$230,000",
                publication_date: "2026-09-01T12:00:00Z",
                description:
                  "<p>Build production AI systems.</p><script>ignore me</script><p>Lead evaluation work &amp; platform reliability.</p>",
              },
              {
                id: 43,
                url: "https://untrusted.example.test/jobs/43",
                title: "Ignored role",
                company_name: "Untrusted source",
                description: "This URL is outside the fixed source.",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    });

    const jobs = await searchRemotiveJobs(
      "AI platform engineer",
      99,
      new AbortController().signal,
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(jobs).toEqual([
      expect.objectContaining({
        listingId: "42",
        source: "Remotive",
        organization: "Synthetic Systems",
        roleTitle: "Senior AI Platform Engineer",
        originalUrl:
          "https://remotive.com/remote-jobs/software-dev/senior-ai-platform-engineer-42",
        workArrangement: "remote",
        advertisedCompensation: "$190,000–$230,000",
        requisitionId: "remotive-42",
      }),
    ]);
    expect(jobs[0]?.postingText).toContain("Build production AI systems.");
    expect(jobs[0]?.postingText).toContain(
      "Lead evaluation work & platform reliability.",
    );
    expect(jobs[0]?.postingText).not.toContain("ignore me");
  });

  it("rejects a response that declares more than the bounded source limit", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "content-length": String(2 * 1024 * 1024 + 1) },
        }),
      ),
    );

    await expect(
      searchRemotiveJobs(
        "software engineer",
        4,
        new AbortController().signal,
        fetchImplementation,
      ),
    ).rejects.toThrow("exceeded its response limit");
  });
});
