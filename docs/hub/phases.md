# Phases

How the hub gets built out. **Do not build a phase without an explicit request.**

Phases are **not a ladder.** Phase 4 runs independently; Phase 3 and Phase 7+ both queue behind
a single product decision. Numbering is historical, not an order of execution.

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0–2** | Hub canon, agent wiring, Speak intent | ✅ Complete — 2026-08-08 |
| **4** | Notion vision layer | 🟢 **Live, incomplete** — 2026-08-08 |
| **3** | Linear execution spine | 🟡 **Partially live** — context capture only; implementation still gated |
| **5** | In-app dev-docs pointer at `/dev/docs/product-hub` | Unblocked; low value until the hub settles |
| **6** | `docs/llms.txt` index for the in-app LLM | Queued behind 5 |
| **7+** | Speak implementation pillars | ⛔ Gated — continuity model undecided |

## What gates what

```
thread / continuity model            ← the single blocker
        ↓
first implementation slice     ──→   SM-1 / SM-2 become fillable
        ↓
real work exists               ──→   Phase 3 earns its place
        ↓
Phase 7+ — Speak pillars
```

Phase 4 sits outside this chain: vision does not wait on execution.

Both gates are **product decisions, not engineering work.** Nothing unblocks them except the
user choosing. See `organic-llm-hub/speak/open-questions.md`.

## Phase 4 — Notion vision layer (live)

The **Vision Keeper** agent is published with edit access to the Organic LLM Notion space and a
GitHub MCP connection. Mention-triggered only — nothing distils automatically, so the vision
layer updates when someone remembers to invoke it.

Remaining work:

- **Migrate** the positioning section out of `organic-llm-hub/README.md` — move it, do not copy it,
  and leave a pointer behind. Two live copies is precisely the drift the hub exists to prevent.
- Settle which side is authoritative for vision during the overlap —
  [open-questions.md](./open-questions.md#notion-authority-during-the-vision-migration).

Constraint for any Notion agent holding repo access: **`.context/` is not on GitHub.** It is
gitignored and local-only. Such an agent can verify `docs/` paths and can *never* verify
`.context/` paths. Private paths are recorded as-is — never validated, never "repaired."

## Phase 3 — Linear (partially live)

**Speak — Voice Agent** exists in the Coalescence Labs team, stood up 2026-08-09 at the user's
explicit request, overriding the gate below. Rationale:
`organic-llm-hub/decisions/20260809-linear-speak-project.md`.

Scope is **context capture, not execution.** Its issues are open product questions (COA-185
through COA-190), each carrying a `spec:` path and linking rather than restating. Implementation
work is still gated on the thread model and first-slice choice.

The original gating argument still holds for everything else, and was immediately vindicated:
the project description shipped carrying restated strategy and was stale against
`product-spec.md` within a day. It has since been trimmed to a pointer.

Rules that survived the override:

- Issues **link** to specs; they never carry spec content —
  [linking-conventions.md](./linking-conventions.md#linear-issues-phase-3).
- Project descriptions are pointers, not summaries. Anything restated goes stale.
- The Notion vision agent stays **without** Linear write access. Noting a missing link is the
  right power level; a vision-layer agent creating execution items crosses the layer boundary
  the hub is built on.
- Do not open implementation issues until a first slice is chosen. Backlog issues that describe
  unchosen work are the empty scaffolding this gate exists to prevent.

## Phase 5 — dev-docs (carries a trap)

`/dev/docs/product-hub` must be a **pointer page, not a mirror.** Copying `docs/hub/` into
`content/dev-docs/` creates a second canonical home — the same pattern already broken across
`docs/` and `.context/docs/`, logged at
[open-questions.md](./open-questions.md#doc-duplication-cleanup).

Public operational canon only. Nothing from `organic-llm-hub/` reaches an in-app surface.

## Phase 6 — `llms.txt`

Curated doc index so the in-app LLM can navigate the hub. Queued behind 5 and low value until
the hub's shape stops moving.

## Phase 7+ — Speak implementation

The five roadmap pillars live in `organic-llm-hub/speak/product-spec.md`. Every candidate first
slice touches continuity, so picking one before the thread model is settled means guessing at
the foundation and rebuilding.
