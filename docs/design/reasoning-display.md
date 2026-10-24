# Reasoning display

A message's process (provider reasoning summaries and process tools) renders as one
collapsed activity trail, separate from answer prose, in
`components/chat/chat-activity-trail.tsx`. The trail preserves the reader's open/closed
choice through streaming and completion.

## Activity trail

Grouping lives in `lib/chat/activity-trail.ts`, shared by the client and the server timer.

- **Members:** reasoning parts and process tools (web, memory, research reads, chat history
  and similar lookups). These are inspectable but not presented to the user.
- **Breakers:** visible answer text and every other tool. Presentational tools (gen-UI,
  boards, plans, diagrams, task writes) present content to the user, so they stay inline.
  Unknown tools also stay inline. Whitespace-only text and step or data parts do not split a trail.
- **Header while live:** the latest complete summary heading (else the latest complete
  sentence), or the in-flight tool's label, on one truncated line in a fixed-width slot. The
  icon, activity dot and chevron hold still; the width changes once, on settle. The header is
  not a live region; screen readers get a stable "Reasoning in progress".
- **Settled header:** "Thought for 14s" when the trail has reasoning, plus "searched N
  sources" for unique web and research search URLs. Tool-only trails name what they did
  (for example "Checked memories"). Older messages without timing fall back to these labels.
- **Duration:** measured on the server in stream order. A trail runs from the start of the
  model step that opened it (first-token wait included) to its first breaker or the end of
  the stream, so tool time inside the trail counts. Durations are saved in message metadata,
  keyed by trail position.
- **Pinning:** a pinned result keeps its trail open; collapsing the trail releases those
  pins. A pinned row stays sticky only within the trail's own height.
- **Text between steps** stays visible for now. Folding interim narration into the trail
  without layout shift is an open design question.

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

`useReasoningText` animates only an open, active summary step. It preserves every character and
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
Reasoning and process tools are grouped into trails rather than shown part by part.
A stream that errors or aborts before a part's end chunk leaves it `streaming`; the saved turn
finalizes those parts so a reloaded message never shows reasoning as still in progress.

OpenAI reasoning-capable models request `reasoningSummary: "auto"`, which asks for the
most detailed supported summary. This is a provider summary, not the raw internal reasoning;
its length does not measure the number of reasoning tokens spent. Explicitly disabling
reasoning remains respected. [Official OpenAI documentation](https://developers.openai.com/api/docs/guides/reasoning).

Anthropic adaptive thinking requests summarized display, and supported Google models request
included thoughts. These options request provider-visible material; they cannot guarantee
that every model or request emits a detailed summary. No extra model call expands summaries.

Regression tests cover disclosure continuity, exact burst catch-up, reduced-motion bypass,
and SDK conversion of multiple reasoning summary deltas before and after the answer starts.
