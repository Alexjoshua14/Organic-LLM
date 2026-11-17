---
name: code-walkthrough-domains
description: >-
  Organic LLM domain maps for code walkthroughs (chat, gen-ui / tool
  compilation, restaurant and other tools, rabbit-hole branching, CoreInput
  frontend/backend, Aion core). Use with the code-walkthrough skill when the
  user asks to walk through, tour, or review these areas, a PR touching them,
  or names chat tools, gen-ui, CoreInput, rabbit holes, Chronos/branching, or
  restaurant gather.
---

# Code walkthrough — organic-llm domains

This is a **thin overlay**. Follow the personal **code-walkthrough** skill protocol for pacing, tone, templates, and nav (do not reinvent those rules here).

Use this skill to:

1. Resolve informal names → real entry points (see [domains.md](domains.md))
2. Seed the **outline spine** with a known read order instead of rediscovering from scratch
3. Note cross-area handoffs (composer → API → tools → message render)

## Name aliases

| User says | Treat as |
|-----------|----------|
| chronos, chronos branching | Rabbit hole generation + branch suggestions (`lib/rabbit-holes/`) — there is no module named Chronos |
| chat tools / tool compilation | `lib/llm/compile-chat-tools.ts` + per-tool modules |
| gen-ui | `render_gen_ui` tool → schemas → registry → `GenUIRenderer` |
| coreinput / core input | Composer UI + request body fields on chat POST (not a separate CoreInput API) |
| aion core | `/api/ai/core` + `coreToolKit` (distinct from main Arcadia chat) |
| restaurant tool | `gather_restaurant` → pipeline → card block → `render_gen_ui` |

## Workflow add-on

1. Read [domains.md](domains.md) for the matched domain (or multiple if the ask spans them).
2. Build the outline from that domain’s **walkthrough order**; trim sections that are out of scope.
3. For PR/recent mode: still **flow-anchor** — pick the domain spine that matches user-visible behavior, then overlay which outline nodes the diff touched.
4. Proceed with normal chunk template from the personal skill.

## Do not

- Duplicate the personal skill’s templates here
- Invent domains not in [domains.md](domains.md) without verifying paths still exist
- Walk rabbit holes as if they were wired through `CoreInput` (they are a parallel subsystem)
