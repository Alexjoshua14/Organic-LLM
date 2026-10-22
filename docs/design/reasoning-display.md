# Reasoning display

Provider reasoning summaries use a separate disclosure from answer prose in
`components/chat/chat-reasoning-block.tsx`. The disclosure starts collapsed and preserves
the reader's open/closed choice through streaming and completion.

The existing chat design is the visual target. Refero's bundled typography guidance supplies
the secondary text scale; its motion guidance and the [design backbone](./README.md) supply
brief, interruptible transitions. Live Refero research was unavailable during this refinement.

| Decision                                                                 | Source                                                            | Role                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| 13px body, 12px header                                                   | Owner request; typography craft scale                             | Secondary information below the 16px answer                 |
| `--muted-foreground`, including headings and emphasis                    | Existing theme; owner request                                     | Readable secondary text in both themes                      |
| Stable header and activity dot                                           | Owner's report of jumpiness; motion continuity guidance           | Activity without repeated glyph entrances or width changes  |
| 160ms enter / 120ms exit, opacity only                                   | Motion craft state-change band; faster exits                      | Disclosure feedback without moving the text                 |
| Append-only catch-up within 96ms, 24ms frames                            | Existing brief-feedback budget                                    | Soften bursty provider chunks without a long reading delay  |
| Stronger header, lightbulb icon, 72ch reading width                      | Owner's 2026-10-17 screenshot; typography and icon craft guidance | Identify reasoning and keep prose easy to scan              |
| Bounded memory result with database icon, count badge and separate query | Same screenshot; existing spacing grid                            | Distinguish retrieved evidence from thought and answer text |

Styles are scoped in `styles/ChatReasoning.css`. The `not-prose` boundary prevents answer
typography from promoting summary headings, bold text or links. Markdown remains readable,
but reasoning does not mount answer code viewers or Mermaid diagrams while streaming.

`useReasoningText` animates only an open, active summary. It preserves every character and
flushes immediately on completion, replacement, closing or reduced motion. No buffering
changes provider data, persistence, reasoning effort or model token limits. The activity dot
retains its space when idle. Opening and closing honor `prefers-reduced-motion`.

Memory search results use `styles/MemorySearchResult.css` and the existing pin control.
The query and result count are independent from the tool label. The complete query remains
available; opening the row reveals full memory text. The disclosure exposes `aria-expanded`
and its controlled details ID. Pinning does not change its open state. Empty and failed
searches retain the same structure with explicit status text.
Expanded results preserve native list semantics inside a named scroll region with its own
keyboard focus target and visible outline. Tab, Enter and Space are covered by the
disclosure-and-pin regression test. The scoped lint exception permits focus on that overflow
region, following [MDN's keyboard-scrolling guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow#accessibility).

## What is streamed

`runLLMChatStream` forwards provider `reasoning-delta` events through the AI SDK UI stream.
The installed SDK defaults `sendReasoning` to true. Live and queued main chat share this path.
Consecutive reasoning parts are grouped for display rather than selecting only the first.

OpenAI reasoning-capable models request `reasoningSummary: "auto"`, which asks for the
most detailed supported summary. This is a provider summary, not the raw internal reasoning;
its length does not measure the number of reasoning tokens spent. Explicitly disabling
reasoning remains respected. [Official OpenAI documentation](https://developers.openai.com/api/docs/guides/reasoning).

Anthropic adaptive thinking requests summarized display, and supported Google models request
included thoughts. These options request provider-visible material; they cannot guarantee
that every model or request emits a detailed summary. No extra model call expands summaries.

Regression tests cover disclosure continuity, exact burst catch-up, reduced-motion bypass,
and SDK conversion of multiple reasoning summary deltas before and after the answer starts.
