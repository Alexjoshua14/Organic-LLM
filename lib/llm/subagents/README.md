# Subagent System — Master Thoughts

> The swarm-of-experts layer sitting between Aion (L0) and specialized tools.

---

## Philosophy

<!-- Why swarms over a single monolithic agent? What's the long-term vision? -->


## Layer Model

<!-- 
  L0: Aion (user-facing)
  L1: Domain orchestrators (code, speech, ...?)
  L2: Niche specialists

  Thoughts on the layer boundaries — what belongs at each tier?
  Should L1 agents ever talk to each other, or strictly through L0?
  Can L2 agents span multiple L1 parents?
-->


## Domain Map

<!-- 
  Which L1 domains exist or are planned?
  Known: code, speech
  Possible: research/learning, data analysis, creative, planning, ...?
  What's the criteria for "this deserves its own L1 agent" vs. "Aion handles it directly"?
-->


## Cross-Cutting Concerns

### Error Handling & Graceful Degradation
<!-- What happens when an L2 agent fails? L1 retries? Falls back to doing it itself? -->

### Cost & Token Budgets
<!-- Per-agent token caps? Per-request budgets? How to prevent runaway chains? -->

### Timeouts & Latency
<!-- Max acceptable round-trip for L0→L1→L2→L1→L0? Streaming partial results? -->

### Observability
<!-- How to surface what's happening to the user? data-notifications? Agent trace logs? -->


## Agent Identity & Personality

<!-- 
  Do subagents have names/identities (like Aion does)?
  Or are they invisible infrastructure that Aion presents as its own capability?
  Does the user ever "talk to" an L1/L2 agent directly?
-->


## Shared Context & Memory

<!-- 
  Do agents share memory (Mem0)?
  Does L1 accumulate project-specific knowledge over time?
  How does context flow — does Aion pass everything, or do agents fetch what they need?
-->


## Open Questions

<!-- Dump anything that doesn't fit above -->

