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
