# Lyra research adapters and inspectable evidence

**Date:** 2026-10-10

Lyra's fixed persona binds to the existing `agent-researcher` slot through an optional
`rosterSlotId`. Canonical lab shells keep `subagent-researcher`; dispatch resolves both names
to the existing slot so no second Lyra appears and existing child threads remain usable.

Her toolbox uses direct HTTP adapters for Exa, Firecrawl v2 and an existing Docling Serve
service. No MCP client dependency or local document-service process is introduced. Tool policy
is selected on the server and applied consistently to live, queued and delegated turns.

Snapshots and claims live in an encrypted, owner-scoped ledger on the thread. Immutable
snapshots preserve the text under prior citations. Optimistic revision checks reapply changes
after concurrent writes. Exact normalized quote/page checks enforce traceability while leaving
source quality and interpretation to the researcher and reader.

`research_publish` constructs the Gen UI report from saved ids; model input supplies synopses
and takeaways rather than inventing URLs or evidence. Source text loads through an owned,
uncached endpoint on demand. Delegated workers persist native research tool parts, allowing the
same renderer and model replay path as direct chat without introducing a second transcript store.

Configuration, limits, migration and tool contracts live in the
[research guide](../../../lib/llm/subagents/research/README.md).

The storage placement and reuse contract above are superseded by
[independent ledgers and permission-controlled reuse](20261010-lyra-ledger-reuse.md).
