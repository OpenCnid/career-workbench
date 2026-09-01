# QA evidence

Evidence files record commands, UTC timestamps, platform, exit status, bounded
test summaries, and artifact digests. They never contain credentials, personal
data, raw environment values, unrestricted source content, browser profiles, or
Jupyter connection data.

Generated evidence belongs in `docs/qa/generated/` and is ignored until a
reviewer intentionally promotes a scrubbed record. A milestone status of `unmet`
remains visible until behavior, automated tests, applicable real tests, and
synchronized documentation all pass.
