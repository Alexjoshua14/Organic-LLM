---
name: organic-llm-hub
description: >-
  Files product decisions, ADRs, open questions, and feature-spec updates into the Organic LLM
  product hub, routing each to its canonical home and keeping strategy out of the public repo.
  Use when recording a decision, writing an ADR, updating a feature spec under
  docs/<feature>/ or organic-llm-hub/<feature>/, standing up a new workstream, or syncing canon
  to Ergon/Notion. Read docs/hub/README.md first.
---

# Organic LLM hub maintenance

Canon: [`docs/hub/README.md`](../../../docs/hub/README.md) and
[`maintenance-protocol.md`](../../../docs/hub/maintenance-protocol.md). Read both before acting.
This skill is the **workflow**; the docs are the truth. Do not restate them here.

Broad routing lives in `AGENTS.md`, which is always loaded. This skill covers the deliberate
acts of writing to canon.

## 1. Triage sensitivity — always first

`Alexjoshua14/Organic-LLM` is a **public** repository. Ask: *would I mind a competitor reading
this?*

- **Yes** → the `organic-llm-hub` private repo (sibling clone). Strategy, roadmap, moat, scope,
  ACs, unresolved product direction.
- **No** → `docs/`. Operational rules, code maps, technical ADRs, locked behaviors.
- **Unsure** → private. Publishing later is cheap; unpublishing is not.

## 2. Route by what changed

| What happened | Where it goes |
|---------------|---------------|
| Product intent changed (scope, AC, UX) | `organic-llm-hub/<feature>/product-spec.md`; bump `spec_revision` |
| Technical decision made | `docs/<feature>/decisions/YYYYMMDD-short-title.md` |
| Behavioral rule locked | Feature reference doc, marked **Locked** with the date |
| Something is unresolved | An `open-questions.md` — private if it exposes direction |
| Vision or feel | Notion (live); `organic-llm-hub/` only until its positioning migrates |
| A unit of work | Ergon; link the owning spec and follow `AGENTS.md` tracking requirements |

Full table: [`ownership.md`](../../../docs/hub/ownership.md).

## 3. Write it

- **Link, never restate.** Copying a paragraph between hub docs means you should have linked.
- **Durable IDs.** `AC-n`, `SM-n` never get renumbered — retire and add.
- **ADRs are append-only.** Supersede with a new file that links back; never rewrite.
- **Private docs carry the header** — see
  [`linking-conventions.md`](../../../docs/hub/linking-conventions.md).
- **Record the question, not an invented answer.** Open questions close with the user.

## 4. Keep work tracking current

Ergon tracks implementation work. Follow `AGENTS.md` for issue reuse, progress updates,
blockers, validation, and review handoff; routine tracking does not require separate approval.
Legacy phase gates in hub docs do not override that tracking requirement.

Ask before creating Notion resources. When Notion MCP is unavailable, anything an agent must
read while coding has to be a file, not solely a Notion page.

## 5. Standing up a new workstream

```
docs/<feature>/README.md          # what it is, code paths, current state, links
docs/<feature>/decisions/         # ADRs
organic-llm-hub/<feature>/product-spec.md
organic-llm-hub/<feature>/open-questions.md
```

Then list it under *Feature workstreams* in `docs/hub/README.md` and add it to `docs/INDEX.md`.
Use [`docs/speak/`](../../../docs/speak/README.md) as the reference shape.

## Before finishing

Commit only when the user asks. Never stage `.handover/`, `.context/`, or `.private/`.
