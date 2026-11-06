---
name: subagent-card-lab
description: >-
  Use for ANY work on the subagent card in the multiagent view or Organic's Subagent lab
  (/sandbox/subagents/cards): card styling, text, spacing, borders, the Speak button or its
  waveform, mobile or desktop card, the Current vs Next comparison page, or the word "promote".
  Establishes that design changes go to the Next fork only and what "promote" does. Load it
  before editing any subagent-card, subagent-swipe-row, subagent-speak-glass-bar, or lab file.
---

# Subagent card lab

Canon: [`docs/design/subagent-card-lab.md`](../../../docs/design/subagent-card-lab.md). Read it
first. It owns the file map, the rules, and what "promote" does. This skill does not restate it.

The short version:

- **Edit Next only.** Design requests go to `app/sandbox/subagents/cards/_components/next-*`.
  Never apply the same edit to the live card in `app/sandbox/arcadia/_components/`.
- **"Promote"** copies Next over Current (rename `NextSubagentCard` to `SubagentCard`, fix the
  speak-bar import). Next and the lab stay in place. Never delete them.
- Shared files (the Speak glass bar, `components/voice/*`) get opt-in props so Current is
  unchanged until promotion.
- Be precise: the user directs each visual change. Do exactly what is asked, report anything you
  had to adapt, and do not commit unless asked.
