# Performance and resource ceilings

The preview ceiling profile is an ordinary local workspace with 250
opportunities, 250 source documents, and at least 500 audit events. On each
supported platform, the automated representative-workspace test requires:

- creation within 20 seconds;
- canonical listing within 2 seconds;
- normalized credential-free export within 5 seconds;
- SQLite database below 32 MiB before large sealed artifacts; and
- process RSS growth below 384 MiB for the test.

SSE returns at most 1,000 events per request. Import, artifact, child, RLM,
context, output, and request sizes have separate hard bounds in code. These are
preview safety ceilings, not throughput promises. Workspaces beyond them may
remain usable but are outside the verified profile. Record platform-specific
measurements without weakening thresholds.
