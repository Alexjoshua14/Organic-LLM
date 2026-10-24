# Hard-set subagents

A **hard-set subagent** is a fixed, code-defined agent: its own identity, instructions, tool
policy, and reflexive help menu. You develop one by talking to it in its **shell**, a thread
where every turn runs as that subagent, until it does what you want.

This README is the contract. The local `new-subagent` skill follows it step by step.

## Anatomy

One file per subagent in `agents/<slug>.ts`, built with `defineHardSetSubagent` (`types.ts`):

| Field | What it is |
|-------|------------|
| `id` | `subagent-<slug>`. It is stored on the shell thread (`threads.subagent_agent_id`), so never rename it. |
| `name`, `role`, `blurb` | Identity. The blurb is the one line shown in the lab. |
| `instructions` | The subagent's own system prompt fragment, sent on every model turn in its shell. |
| `helpMenu` | Markdown sent as the reflex, with no model call. It also seeds every new shell. It must not start with Arcadia's help prefix. |
| `tools` | `webSearch`, `memory`, `chatHistory`, `research`, `chronos`, `ergon`. Each flag forces a capability on or off. An omitted flag follows the turn's defaults; `chronos` and `ergon` default off. The research toolbox is server-selected, and the connected-app sets are owner-gated ([chat tools](../../../../docs/chat-tools.md#connected-app-tools-hard-set-tool-policy)). |
| `roster` | Include the fixed persona in orchestration. |
| `rosterSlotId` | Optional binding to an existing `agent-*` slot; dispatch uses that id and does not add a duplicate roster entry. |

Register the subagent in `registry.ts`. `tests/unit/hard-set-subagents.test.ts` checks every
definition: valid schema, unique id, no clash with the orchestrator's roster, and a help menu
that won't render as Arcadia's help card.

`agents/architect.ts` defines Archer. `agents/coder.ts` defines Reed and `agents/planner.ts` defines
Mira, Ergon's representative; both are bound to existing slots and use connected-app tools.
`agents/researcher.ts` defines Lyra, bound to the existing
researcher slot. Her [research guide](../research/README.md) owns provider setup, evidence
storage and the browsable research UI.

## Shells

**Sandbox → Subagent lab** (`/sandbox/subagents`, admin only) lists every hard-set subagent.
**Open a new shell** creates an ordinary Arcadia thread with no parent, sets its
`subagent_agent_id`, seeds it with the help menu, and opens it. No migration is needed; it reuses
the COA-251 thread columns.

Every live send in a shell (`/api/chat`) goes through these steps:

1. **Reflex gate.** Jev, with ZDR forced (`reflex.ts`), decides whether the message only asks
   for help or orientation and needs no intelligence to answer.
   - **Yes**, with probability above `HELP_REFLEX_CONFIDENCE`: the help menu is streamed and
     saved as the reply, with `metadata.source = "subagent-reflex"` and no model call.
   - **Anything else** passes through to the normal turn: a less confident answer, a Jev error,
     or a timeout past `HELP_REFLEX_TIMEOUT_MS`.
   - **Jev is skipped** (pass-through) for messages longer than `HELP_REFLEX_MAX_CHARS` or with
     attachments. Skips only ever go toward the normal path.
   - **Privacy and cost:** Jev sees only the latest message and the subagent's name and role.
     Its usage is recorded as `subagent_reflex`.
   - **Latency:** the check runs alongside context loading.
2. **Normal turn.** The existing Arcadia path runs unchanged: memory context, model picker, and
   tools. A `[Subagent shell: <name>]` fragment carrying the subagent's `instructions` is
   appended, and the tool policy is applied.
3. **Never orchestrates.** The shell binding is checked before the Multiagent flag. A shell
   never gets `dispatch_subagent`, `worktable`, or thought routing.

### Limits (current)

- Queued direct sends (`/api/chat/queue`) skip the reflex gate but apply the fixed persona
  and tool policy. Delegated background runs also use that policy.
- The Arcadia base system prompt still sits under the shell fragment. The fragment tells the
  model to follow the subagent's instructions over any general persona.
- `roster: true` enables dispatch by id, name or role. A bound `rosterSlotId` preserves an
  existing slot; otherwise the canonical subagent id is used.

## Probing a subagent

In a fresh shell, try:

- **Reflex:** "help", "what can you do?", "I'm not sure where to start". Each should get the
  menu instantly.
- **Pass-through:** "help me with <a real task>", or a question about its domain. Each should
  get a real answer, not the menu.
- **In role:** a typical task from its blurb. Check the shape and quality of the answer.
- **Boundaries:** something it should decline or hand back. Check that it stays in role.
- **Tools:** a task that needs (or must not use) search or memory, matching its tool policy.
