# Organic LLM product hub

The hub is the **canon** for Organic LLM: who owns which kind of truth, and how agents record
new truth. It covers the **whole product** — Chat, Memory, Rabbit Holes, Ergon, Speak — not any
single feature.

Agents: read this file **before** product or feature-spec work. For commands and code
conventions see [AGENTS.md](../../AGENTS.md). For UI, motion, and spacing see the
[design backbone](../design/README.md).

## This repository is public

`Alexjoshua14/Organic-LLM` is a **public** repository. Everything under `docs/` is world
readable. The hub is therefore split by sensitivity:

| Half | Location | Holds |
|------|----------|-------|
| **Public — operational** | `docs/hub/`, `docs/<feature>/` | How agents work: ownership, protocol, conventions, code maps, locked behavioral rules |
| **Private — intent** | `.context/hub/` (gitignored) | Product strategy, roadmap, moat, scope, acceptance criteria, unresolved direction |
| **Private — vision** | Notion (Phase 4+) | Feel, motivation, mood boards, assets, decision "why" |

Before writing anything into `docs/`, ask: **would I mind a competitor reading this?** If yes,
it belongs in `.context/hub/`. [ownership.md](./ownership.md) has the full routing table and
[maintenance-protocol.md](./maintenance-protocol.md) has the triage step.

`.context/` is gitignored and machine-local — it does not sync across machines. Treat it as
authoritative but not durable; vision migrates to Notion at Phase 4.

## Why the hub exists

Organic LLM is built across many surfaces — Cursor, Claude Code, Codex, Notion, and Organic
LLM itself — over many sessions. Without one canonical home per kind of truth, every surface
accumulates its own drifting copy. The standard failure: a spec lands in a tracker, goes stale,
someone makes a shadow copy elsewhere, and now two systems disagree and neither is trusted.

This is not hypothetical here. Nine docs currently exist in **both** `docs/` and
`.context/docs/` with no rule for which wins — see
[open-questions.md](./open-questions.md#doc-duplication-cleanup).

The hub prevents that with one rule:

> **Canon lives in exactly one place. Every surface is a thin adapter that points at it.**

Adapters summarize and link. Adapters never restate canon. If you are copying a paragraph from
one hub doc into another, stop and link instead.

## Four layers

```
LAYER 0  VISION          Notion              why it should feel like this
             ↓            (Phase 4+)          essays, mood boards, assets, decision log
LAYER 1  INTENT          .context/hub/       what we are building and what "done" means
             ↓            + docs/hub/         private strategy | public operating rules
LAYER 2  EXECUTION       Linear              what is being worked on right now
             ↓            (Phase 3+)          projects, issues, sprints
LAYER 3  IMPLEMENTATION  this repo           the code itself
                          app/, lib/, components/
```

| Layer | Home | Status |
|-------|------|--------|
| 0 — Vision | Notion | Not stood up (Phase 4+) |
| 1 — Intent | `.context/hub/` (private) + `docs/hub/` (public) | **Active** |
| 2 — Execution | Linear | Not stood up (Phase 3+) |
| 3 — Implementation | Repo code | Ongoing |

Layers 0 and 2 are designed for but deliberately not built — see [future phases](#future-phases).
Until they exist, anything that would live there is recorded in `.context/hub/` rather than
going unrecorded.

## Feature workstreams

| Workstream | Public docs | Private intent | Status |
|------------|-------------|----------------|--------|
| **Speak** — voice agent | [`docs/speak/`](../speak/README.md) | `.context/hub/speak/` | **Active** — first large-scale workstream |
| Chat, Memory, Rabbit Holes, Ergon, Noesis | — | — | Not yet migrated into the hub |

Speak is the first feature large enough to populate and stress-test the hub. Its docs are the
reference shape for every workstream that follows.

Existing feature docs ([chat tools](../chat-tools.md), [Noesis](../noesis.md),
[Ergon](../ergon-spec.md)) remain valid where they sit. Migrate them into hub shape when a
workstream becomes active, not preemptively.

## Hub documents

| Doc | When to read |
|-----|--------------|
| [Ownership](./ownership.md) | Deciding *where* a piece of information belongs |
| [Maintenance protocol](./maintenance-protocol.md) | You learned or decided something and must record it |
| [Linking conventions](./linking-conventions.md) | Creating an issue, ADR, or spec reference; linking across the public/private line |
| [Open questions](./open-questions.md) | Unsettled operational decisions (product direction is private) |
| [Surface adapters](./surfaces/) | Working from Cursor, Claude Code, Notion, or in-app |

## Legacy docs — do not treat as current

These describe the **pre-Realtime TTS pipeline** and no longer reflect how Speak works:

- `docs/speak-page-architecture.md`
- `docs/speak-page-workflow.md`

For current Speak architecture read the live code paths in
[`docs/speak/README.md`](../speak/README.md). Do not use the legacy docs as a basis for
implementation or for describing the system.

## Future phases

Documented so agents recognize the destination — **do not build these without an explicit
request.**

| Phase | Deliverable |
|-------|-------------|
| 3 | Linear project for Speak; issue template carrying `notion:` + `spec:` |
| 4 | Notion "Organic LLM Hub"; migrate vision out of `.context/hub/` |
| 5 | Organic LLM dev-docs mirror (`content/dev-docs/product-hub.md`) |
| 6 | `docs/llms.txt` index for the in-app LLM |
| 7+ | Speak implementation pillars |

## How to extend the hub

1. New feature workstream → `docs/<feature>/` for public operational docs, `.context/hub/<feature>/`
   for intent. List it under [Feature workstreams](#feature-workstreams).
2. New hub-wide rule → add a focused doc here and link it from the table above.
3. New surface → add a thin adapter under [`surfaces/`](./surfaces/), under 80 lines, links only.
4. Keep this README structural and public-safe. Strategy belongs in `.context/hub/`.
