# Ownership — one canonical home per kind of truth

Every kind of information has exactly one home. Write it there and link from everywhere else.
Two copies means one is already wrong; you just don't know which yet.

See [maintenance-protocol.md](./maintenance-protocol.md) for *when* to write, and
[linking-conventions.md](./linking-conventions.md) for *how* to reference across systems.

## Two axes

Routing is decided by two questions, in this order:

1. **Is it sensitive?** This repo is public. Strategy, roadmap, moat, and unresolved product
   direction must not be in `docs/`.
2. **What kind of truth is it?** Intent, decision, rule, work item, or code.

Sensitivity wins. A product decision that reveals unshipped direction goes to `organic-llm-hub/`
even though decisions normally live in the repo.

## The sensitivity test

Ask: **would I mind a competitor reading this?**

| Private — `organic-llm-hub/` or Notion | Public — `docs/` |
|---|---|
| Why we are building it; business motivation | How the code is organized |
| Competitive positioning; what is commodity vs. ours | Commands, conventions, boundaries |
| Roadmap, phase ordering, unshipped plans | Locked behavioral rules already visible in the product |
| Scope, acceptance criteria, success metrics | Current-state facts derivable by reading public code |
| Open questions exposing strategic uncertainty | Operational open questions (tooling, format, cleanup) |
| Cost and vendor constraints | Technical ADRs about code structure |

When genuinely unsure, default to `organic-llm-hub/` and link a neutral pointer from `docs/`.
Moving a doc from private to public is cheap; unpublishing is not.

## Ownership table

| Information | Canonical home | Written via | Example |
|-------------|----------------|-------------|---------|
| Vision, feel, motivation, assets | Notion (live); `organic-llm-hub/` until positioning migrates | Notion agent / file edit | Why Speak should feel like a colleague, not a tool |
| Product strategy, moat, roadmap | `organic-llm-hub/` | Commit to private repo | Which capabilities are differentiators vs. baseline |
| Product intent, scope, ACs, success metrics | `organic-llm-hub/<feature>/product-spec.md` | Commit to private repo | "Voice turns persist to the thread" |
| Unresolved product direction | `organic-llm-hub/<feature>/open-questions.md` | Commit to private repo | "One eternal voice thread, or fresh per session?" |
| Hub-wide rules and maintenance | `docs/hub/` | Git commit | This table |
| Locked behavioral rules | `docs/<feature>/` reference doc | Git commit | [Speak tool behavior](../speak/tool-behavior.md) — ack before latency |
| Technical decisions (ADRs) | `docs/<feature>/decisions/` | Git commit | "WebRTC over WebSocket transport because …" |
| Code-path maps, current-state facts | `docs/<feature>/README.md` | Git commit | Which file mints the realtime session |
| Operational open questions | [`docs/hub/open-questions.md`](./open-questions.md) | Git commit | "Adopt ProductSpec formally?" |
| Active work, bugs, sprint status | Linear (Phase 3+) | Linear MCP | "SPK-14 — inject memory into session instructions" |
| Code and tests | Repo | Git commit | `lib/speak/execute-speak-tool.ts` |
| UI, motion, spacing standards | [`docs/design/`](../design/README.md) | Git commit | Stack/gap/inset tokens, stagger budgets |
| Commands, conventions, agent boundaries | [`AGENTS.md`](../../AGENTS.md) | Git commit | `bun run test:unit` |
| Setup, environment, PR process | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) | Git commit | `bun install`, env var names |

## Resolving "where does this go?"

Work down the list; the first match wins.

1. **Sensitive by the test above?** → `organic-llm-hub/`. Stop here.
2. **A fact about the code?** → the code, or a doc beside it. Not the hub.
3. **A rule agents follow while coding?** → `AGENTS.md` or [`docs/design/`](../design/README.md).
4. **A technical decision we may be asked to justify?** → an ADR in `docs/<feature>/decisions/`.
5. **What we intend to build, or what "done" means?** → `organic-llm-hub/<feature>/product-spec.md`.
6. **Something we have *not* decided?** → an `open-questions.md` — private if it exposes
   direction, public if it is operational. Recording the question is the deliverable; do not
   invent an answer to close it.
7. **A unit of work?** → Linear when it exists. Not a spec section.

## Anti-patterns

- **Strategy in a public doc.** The repo is public. Route by sensitivity first.
- **Spec content inside an issue body.** Issues link to specs; they do not carry them.
- **A hub doc restating the design backbone.** Link to [`docs/design/`](../design/README.md).
- **Duplicating the maintenance protocol into a surface adapter.** Adapters link.
- **The same doc in `docs/` and `.context/docs/`.** This already happened nine times; see
  [open-questions.md](./open-questions.md#doc-duplication-cleanup). Pick one home.
- **Answering an open question in passing.** Open questions close deliberately, with the user,
  and the resolution gets recorded — not assumed mid-task.
