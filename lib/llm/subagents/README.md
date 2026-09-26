# Subagent System

Runtime roles and orchestration live under this tree (not docs-only):

| Concern | Path |
|---------|------|
| Roles `orchestrator` \| `worker` | `roles.ts` |
| Delegate + 7s return budget | `orchestrator/` |
| Multi-thought routing (ZDR, **Jev** `openai/gpt-6-jev`) | `orchestrator/thought-router.ts`, `dispatch-inbound.ts`, `router-zdr.ts` |
| Worker progress / milestones / completion | `worker/run.ts` + awareness bus |
| Abstract identity images | `identity/` |

Arcadia display roles (`researcher`, `coder`, …) and Speak voice assignment stay in
`lib/arcadia/multitask/`. Condensed cards expose `identityImageUrl`; bind
`ensureSubagentIdentityImage` on create.

See [ADR](../../../docs/aion/decisions/20260925-orchestrator-worker-identity.md).
