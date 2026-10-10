# Open questions — operational

Unsettled decisions about **how we work**: tooling, formats, structure, cleanup.

Questions about **product direction** are private — see `organic-llm-hub/` and each feature's
own `open-questions.md`.

Recording a question is the deliverable. Do not close one by inventing an answer; open
questions close deliberately, with the user, and the resolution gets written down. See
[maintenance-protocol.md](./maintenance-protocol.md).

---

## Adopt ProductSpec formally?

**Status:** Open — leaning yes, deferred until a first implementation slice exists.

`organic-llm-hub/speak/product-spec.md` currently uses ProductSpec's **section skeleton and ID
conventions** (`AC-n`, `SM-n`) without claiming compliance. Full v0.1 compliance would require
`artifact_type`, `author`, `created_at`, `updated_at` frontmatter, fenced
`productspec-*` blocks, and a populated `success_metrics` section.

Blocked on: success metrics can't be filled honestly until a first slice is chosen.

Cost of adopting later: mechanical conversion, not a rewrite — the section names and IDs
already line up. ProductSpec is v0.1 and young; there is no urgency to bind to it.

---

## Doc duplication cleanup

**Status:** Open — identified 2026-08-08, not yet resolved.

Nine docs exist in **both** `docs/` and `.context/docs/` with no rule for which is canonical:

`adaptive-background.md` · `adaptive-background-timing.md` · `organic-presence.md` ·
`organic-presence-integration-examples.md` · `speak-page-workflow.md` ·
`tts-token-tracker.md` · `tts-token-tracker-maintenance.md` ·
`tts-token-tracker-summary.md` · `tts-token-tracker-visual-guide.md`

This is exactly the drift the hub exists to prevent. Resolution needs a per-doc decision: is
each public operational reference, or private working material? Some may legitimately be
neither and should be deleted.

---

## Hub durability across machines

**Status:** ✅ **Resolved 2026-08-09** — private sibling repo.

Intent moved from the gitignored `.context/hub/` into `Alexjoshua14/organic-llm-hub`, a private
repository cloned alongside this one. Version controlled, greppable, syncs to every machine, and
readable with no MCP or network dependency.

Rationale and the alternatives rejected — Notion, and staying in `.context/` — are recorded in
`organic-llm-hub/decisions/20260809-intent-layer-in-private-repo.md`.

**Still open:** whether to add one-way `repo → Notion` publishing for visibility. Not needed
while authorship is single-person.

---

## Agent config is not version controlled

**Status:** Open — deliberate for now.

`.cursor/` and `.claude/` are both gitignored, so the `organic-llm-hub` skill exists only on
this machine. `AGENTS.md` and `CLAUDE.md` are tracked and carry the load-bearing routing, which
is why the [Vercel eval finding](./surfaces/cursor.md) matters — always-on files beat on-demand
skills. Revisit once the hub is stood up.

---

## Notion authority during the vision migration

**Status:** Open — narrowed 2026-08-08.

**Resolved:** the workspace exists. The *Vision Keeper* agent has edit access to the Organic LLM
Notion space, GitHub MCP, and mention-only triggers.

**Still open:**

- Which side is authoritative for vision while both hold it — Notion or `organic-llm-hub/`. Two
  live copies is the drift this hub exists to prevent, and it exists right now.
- Page structure: where the hub parent sits and how Speak nests under it.

Next action: **move** the positioning section out of `organic-llm-hub/README.md` rather than
copying it, and leave a pointer behind. See [phases.md](./phases.md#phase-4--notion-vision-layer-live).

---

## Linear team and project naming

**Status:** Open — Phase 3.

Which team owns Speak, and whether workstreams map to Linear projects one-to-one.

---

## Arcadia multitask Speak thread tagging

**Status:** Open — identified 2026-09-25 with the multitask shell sandbox slice.

Speak-to from an Arcadia subagent mints a **new** Speak Realtime session (`threadPolicy: "new"`)
using the existing `feature: "speak"` thread resolver. Unresolved:

- Should subagent Speak sessions use a dedicated `threads.feature` (e.g. `arcadia-multitask`)
  so they do not collide with ordinary Speak Live resume-latest continuity?
- When a production multi-agent runtime replaces the sandbox roster, does each subagent own a
  durable thread, or only ephemeral Speak sessions?

Recorded rather than assumed. See
[`docs/speak/decisions/20260925-multitask-subagent-speak.md`](../speak/decisions/20260925-multitask-subagent-speak.md)
and [`docs/arcadia.md`](../arcadia.md#multitask-shell).

---

## Max plan monthly spend ceiling

**Status:** Open — identified 2026-09-25 with multi-mode message queue.

`max` plan users (Clerk ids in `MAX_PLAN_CLERK_USER_IDS`) are not subject to the free $40
calendar-month cap. No numeric max ceiling is defined in billing tables or product canon yet.
Code records `monthlyBudgetUsd: null` and does not invent a dollar limit.

Also open: should queued file attachments be supported, or text-only for the first slice?

See [`docs/message-send-queue.md`](../message-send-queue.md) and
[`docs/architecture/decisions/20260925-message-send-queue.md`](../architecture/decisions/20260925-message-send-queue.md).

---

## Max plan simultaneous stream cap

**Status:** Open — identified 2026-09-25 with the signed-in `/plans` page.

Free publishes **5 simultaneous LLM streams** (enforced by counting non-null
`threads.active_stream_id` in the shared chat LLM gate). Max currently shares that same
ceiling so the page does not invent “unlimited streams.” Unresolved: should max keep the
free stream cap, raise it, or leave streams uncapped while the dollar budget stays unset?

---

## Orchestrator router model “jev”

**Status:** ✅ **Resolved 2026-09-25** — catalogued and wired.

House catalog entry: `typesafe-ai/jev` (`alias: typesafe.jev`, `picker: false`,
`supportsZeroDataRetention: true`, `requiresZeroDataRetention: true`). Primary router is
`createJevThoughtRouter` with `jevRouterCallConfig()` forcing AI Gateway
`zeroDataRetention: true` on the request. Heuristic remains only as a labeled fallback when
the Jev call throws (`usedHeuristicFallback` on the routing result).

See [`docs/aion/decisions/20260925-orchestrator-worker-identity.md`](../aion/decisions/20260925-orchestrator-worker-identity.md).

---

## Live multitask roster on chat requests

**Status:** Open — identified 2026-09-25.

Orchestrator thought-routing matches workers by id/role/goal. The Arcadia chat path currently
seeds matches from `createDemoSubagents()` on the server. Unresolved: should the dashboard
send the live roster (or worker ids) with each turn so routing tracks real shell state?
