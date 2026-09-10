# Speak — tool behavior

How Speak behaves when it uses a tool: what it says, and what it shows.

**Status:** Locked principles, starter per-tool defaults. Locked 2026-08-08. The four principles
are settled; the per-tool table is a starting point to refine with the user, tool by tool. Do not
relitigate the principles without an explicit decision — see the
[maintenance protocol](../hub/maintenance-protocol.md).

## Principles (locked)

1. **Speech carries the relationship; visuals carry the evidence.** The conversation is the
   product. A card supports what was said; it never replaces it.
2. **Acknowledge before latency; stay silent when instant.** If a tool returns in under ~1s,
   say nothing — narrating a fast lookup is noise. If it will take longer, acknowledge *before*
   the wait, not after.
3. **One visual anchor per tool turn.** Multiple cards for one turn splits attention and reads
   as a dashboard, not a conversation.
4. **Long-running tools: brief ack → working state → result card.** Never a silent gap; never a
   monologue while waiting.

The silent-under-1s rule is the one most easily lost in implementation. A spoken "let me check"
on a 300ms memory hit makes the agent feel slower than it is.

## Per-tool defaults (starter)

Refine per tool with the user. These are defaults, not contracts.

| Tool / capability | Spoken acknowledgment | Visual treatment |
|-------------------|----------------------|------------------|
| Memory search | Silent if fast. If slow: "Let me check what I remember about that" | Usually none; optional brief caption |
| Web search | "I'll look that up" / "Give me a second" | Citation strip or compact source card; full web preview only if the user asks to see the page |
| Restaurant gather | "Let me find some options" | `RestaurantCard` in the side panel — `components/chat/gen-ui/blocks/restaurant-card/` |
| Task capture (Ergon) | "Got it — I'll add that" | Small confirmation card |
| Gen UI (plans, lists, cards) | Speak the gist in 1–2 sentences | Full card in the panel. **Do not narrate the UI** |
| Thread / history recall | "Pulling up what we talked about last time" | Optional condensed caption on resume |
| Mermaid / diagrams | "I'll sketch that out" | Diagram in the panel |
| Errors / timeouts | "That didn't work — want me to try again?" | Subtle error state on the orb or panel |

## Notes

- **Resume UX is deferred** — deliberately unresolved, not an oversight. The history-recall row
  above describes a tool acknowledgment, not a resume design. See
  `organic-llm-hub/speak/open-questions.md`.
- Several rows describe tools **not yet reachable from voice** (memory, web search, restaurant,
  tasks, mermaid). They are specified now so behavior is decided before implementation, not
  retrofitted after. Current tool inventory: [README](./README.md#current-state-vs-text-chat).
- Panel default state — hidden until a tool fires, or always present but empty — is unresolved.
- Motion, timing, and presence for these states follow the
  [design backbone](../design/README.md); this doc does not restate them.
