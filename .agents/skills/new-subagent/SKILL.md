---
name: new-subagent
description: >-
  Scaffolds one new hard-set subagent for Organic LLM: its definition (identity, instructions,
  tool policy, reflexive help menu), registry entry, and a shell to talk to it in Organic's
  Subagent lab. Use when the user wants to create, add, or start developing a new subagent,
  specialist agent, or "hard-set" agent they will probe in Organic.
---

# New hard-set subagent

Canon: [`lib/llm/subagents/hard-set/README.md`](../../../lib/llm/subagents/hard-set/README.md).
Read it first. It owns the contract: fields, reflex gate, shells, and limits. This skill is the
workflow and does not restate the contract.

One subagent per run.

## 1. Pin down the subagent

You need everything below. Take what the user already gave you. Ask **one** round of questions
for anything that changes the design. Fill everything else with a stated default.

- **Name and role.** A short human name, and a one-word role (e.g. `architect`).
- **Purpose.** One sentence; it becomes the `blurb`.
- **Behaviour.** How it works, what it produces, its output shape, and what it must not do.
- **Tools.** Should `webSearch`, `memory`, or `chatHistory` be forced on or off? Default: none
  forced, so each follows the composer toggles.
- **Help menu.** What it does, 3–4 "Try asking" prompts, what helps it, and what it won't do.

## 2. Write the definition

1. Create `lib/llm/subagents/hard-set/agents/<slug>.ts`. Mirror `agents/architect.ts`, which is
   the sample:
   - `defineHardSetSubagent({...})` with `id: "subagent-<slug>"`.
   - `instructions` in second person ("You are …"). Cover role, method, output shape, and
     boundaries. Keep it concise, with no persona fluff.
   - `helpMenu` in markdown, starting with `**<Name>** · <role> subagent`. Never start it with
     Arcadia's help prefix.
2. Add it to `HARD_SET_SUBAGENTS` in `lib/llm/subagents/hard-set/registry.ts`.
3. Check whether the id is already taken (`grep -r "subagent-<slug>" lib/`). Never rename an
   existing id, because shell threads store it.

## 3. Verify

```bash
bun run test:unit tests/unit/hard-set-subagents.test.ts
bun run lint:check   # the repo has pre-existing errors; make sure yours add none
```

Run the full `bun run test:unit` before handing back. Do not start a dev server or build unless
the user asks.

## 4. Hand it to the user

Tell them:

- **Where to open it:** Sandbox → **Subagent lab** → **Open a new shell** for `<Name>`. It's
  admin only and needs a running app on this branch.
- **A probe script**, taken from the README's "Probing a subagent" section and tailored to this
  subagent: reflex prompts, pass-through prompts, two in-role tasks, one boundary test, and one
  tool test.
- **What to change when a probe fails:**
  - Wrong answer shape or role drift → `instructions`.
  - Menu wording → `helpMenu`.
  - A help request answered by the model, or a task answered with the menu → the Jev gate in
    `reflex.ts`. That gate is shared by every subagent, so call it out instead of tuning it per
    subagent.

Follow `AGENTS.md`: commit only when asked, and never put Claude attribution in a PR body.
