# Stage Ergon access via Mira

**Status:** Accepted  
**Date:** 2026-11-20

## Context

Stage’s central agent and its generic workers only had memory and web search. Connected Ergon
(docs, briefs, hooks, agent runs) lived in chat through Mira (`agent-planner`) and, for voice
outside Stage, as Speak `read_ergon`. Users on Stage still needed Ergon lookups without leaving
the canvas.

## Decision

Stage reaches Ergon **only through a Mira-shaped Stage subagent**:

- The parent assigns `{ name: "Mira", agentId: "agent-planner", goal }` (or a worker named Mira).
- That worker loads Mira’s hard-set instructions and `createErgonAgentTools` (agents scope).
- Results still publish as Stage reply + pieces; the parent never mounts Ergon tools itself.
- Ticket **writes** stay in main chat. Mira on Stage does not get `createErgonTicketTools`.
- Speak Stage sessions keep `stage_turn` / `read_stage` only; they do not re-enable `read_ergon`.

If Ergon is not connected with `agents` scope, Mira settles immediately with a connect prompt
instead of inventing workspace state.

## Consequences

- One Ergon representative (Mira) across chat and Stage; no second hard-set Ergon agent.
- Stage workers remain bounded (two slots); Ergon work competes for the same child capacity.
- Implementation: [`lib/stage/subagents.ts`](../../../lib/stage/subagents.ts),
  [`lib/stage/schema.ts`](../../../lib/stage/schema.ts),
  [`lib/stage/agent.ts`](../../../lib/stage/agent.ts).
