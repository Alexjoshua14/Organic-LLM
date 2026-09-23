# Speak — voice agent

Speak is Organic LLM's voice surface and the **first large-scale workstream** under the
[product hub](../hub/README.md). Voice is the primary channel; visuals are supporting evidence.

This doc is the **public, operational** half: what exists today, which files own what, and where
the current state diverges from text chat. Product intent — scope, acceptance criteria,
roadmap — is private and lives in `organic-llm-hub/speak/`.

| Doc | Holds |
|-----|-------|
| [Tool behavior](./tool-behavior.md) | Locked acknowledgment and visual rules |
| [`decisions/`](./decisions/) | ADRs for Speak technical decisions |
| [Current Realtime setup](./current-realtime-setup.md) | Audited baseline from 2026-09-12, before continuity landed |
| `organic-llm-hub/speak/product-spec.md` | Product intent (private repo) |
| `organic-llm-hub/speak/planning-context.md` | User-provided framing from planning thread (private) |
| `organic-llm-hub/speak/open-questions.md` | Unresolved product direction (private) |
| [Linear: Speak — Voice Agent](https://linear.app/coalescence-labs/project/speak-voice-agent-1338508f6fc9) | Execution tracking + open-question issues |

For UI and motion work, read the [design backbone](../design/README.md) first.

## ⚠️ Legacy docs

`docs/speak-page-architecture.md` and `docs/speak-page-workflow.md` describe the **pre-Realtime
TTS pipeline**. They are superseded and must not be used to describe or extend the current
system. The code paths below are the source of truth.

## Structure

```
app/layout.tsx → VoiceSessionProvider   — owns the session for the whole app
├── <audio> sink                        — never unmounts; re-parenting restarts playback
├── VoiceLiveBarHost                    — portals the live bar into CoreInput, or the page-area anchor in <main>
└── children
    └── app/speak/page.tsx → SpeakShell
        ├── LiveVoiceStage (default)    — a *view* onto the provider, owns no connection
        └── ReadAloudStage              — TTS read-aloud, a separate mode
```

The provider lives in the root layout because the App Router preserves that layout across
client-side navigation. Held in a page, the peer connection dies on every route change.

| Area | Path |
|------|------|
| Session provider (app-wide) | `components/voice/voice-session-provider.tsx` |
| Live bar | `components/voice/voice-live-bar{,-host,-page-anchor,-timing}.tsx` |
| Waveform | `components/voice/voice-waveform.tsx`, `lib/speak/waveform-geometry.ts` |
| Elapsed clock | `components/voice/voice-elapsed.tsx` |
| FluidGlass material | `components/voice/voice-fluid-glass{,-canvas}.tsx`, geometry in `voice-glass-geometry.ts` |
| Audio analysis | `hooks/use-voice-audio-levels.ts` |
| Transport seam | `lib/speak/transport/voice-transport.ts` |
| Screen context | `hooks/use-voice-screen-context.ts`, `lib/speak/ambient-context.ts`, `lib/speak/ambient-item.ts` |
| Idle auto-pause | `lib/speak/voice-idle.ts` |
| Reload resume | `app/api/ai/speak/realtime/active/route.ts` |
| Voice visual state | `lib/speak/voice-visual-state.ts` |
| Perf lab | `app/sandbox/prototypes/voice-bar/` |
| Shell | `app/speak/_components/SpeakShell.tsx` |
| Live voice UI | `app/speak/_components/LiveVoiceStage.tsx` |
| Read aloud | `app/speak/_components/ReadAloudStage.tsx` |
| Realtime hook | `hooks/use-realtime-voice.ts` |
| Server-event classifier | `lib/speak/realtime-events.ts` |
| Session mint | `app/api/ai/speak/realtime/session/route.ts` |
| Thread resolution | `lib/speak/resolve-speak-thread.ts`, policy in `lib/schemas/speak-thread.ts` |
| Resume context | `lib/speak/speak-session-context.ts` |
| Turn persistence | `app/api/ai/speak/realtime/transcript/route.ts`, `lib/speak/persist-voice-turns.ts`, `lib/speak/voice-turns.ts` |
| Tool compile | `lib/llm/compile-speak-tools.ts` |
| Tool execution | `lib/speak/execute-speak-tool.ts` |
| Realtime instructions | `lib/system-prompt/speak-realtime.ts` |
| Modality schema | `lib/schemas/speak-modalities.ts` |

## Session behavior today

Verified against the session route and hook on 2026-09-17. Design rationale is in
[`decisions/20260917-voice-continuity-and-memory.md`](./decisions/20260917-voice-continuity-and-memory.md).

1. **Thread.** `resolveSpeakThread` picks the thread. Default policy `resume-latest` continues
   the newest thread tagged `feature: "speak"`; `new` (the **+** button) creates and tags one.
   The default is provisional — the continuity question stays open in the private hub.
2. **Instructions.** `buildSpeakRealtimeInstructions(modalities, { memoryEnabled, sessionContext,
   resumed })`. On resume, `loadSpeakSessionContext` gathers the thread summary, memories seeded
   from it, and the last four turns; `formatSpeakSessionContext` renders them into the prompt
   under a ~1.8k-token cap. The session runs `truncation: retention_ratio` so the preamble is
   never evicted.
3. **Tools.** `compileSpeakRealtimeTools(modalities, { memoryEnabled })` — modality-gated
   presentation tools, `search_memories` when the Memory toggle is on, and the two nanobots.
4. **Persistence.** The hook buffers completed transcript turns and posts them to
   `/transcript`, debounced after each reply, on every heartbeat, and once more on end.
   `persistSpeakVoiceTurns` writes them as ordinary `ui_message` rows tagged
   `metadata.source = "speak-realtime"`, then refreshes title and summary and ingests complete
   exchanges into memory when the session opted in.
5. **Usage.** `response.done.usage` is accumulated and sent with the next heartbeat, so metering
   bills provider tokens rather than only wall-clock minutes.
6. **Transport** is OpenAI Realtime over WebRTC, behind the `VoiceTransport` interface so a
   server-side relay can replace it without the hook or UI changing.
7. **Continuity across navigation** is structural: the session lives in the root layout, so it
   survives every client-side route change. A hard reload is covered by resume — `/active`
   reports the live session and the mint route accepts `resumeSessionId`, inheriting the thread
   and the deadline (so reloading cannot extend `SPEAK_SESSION_MAX_MINUTES`).
8. **Screen awareness.** Surfaces register what is on screen via `useVoiceScreenContext`; the
   server builds the text and the client sends it as a silent `role: "system"` item with no
   `response.create`. See
   [the ambient presence ADR](./decisions/20260922-ambient-voice-presence.md).
   `session.thinking.append` is GPT-Live only and does not exist on the Realtime API — see
   [rabbit-hole awareness](./decisions/20260922-rabbit-hole-voice-awareness.md), which also
   covers what a rabbit-hole page sends.
9. **Idle auto-pause.** After 20s with nobody speaking, no response in flight, no audio playing
   and no tool running, the call ends itself: the session is settled and the mic released. The
   bar stays up, paused, and **Resume** continues the same thread. See
   [idle auto-pause](./decisions/20260922-idle-auto-pause.md).

Memory is a per-session opt-in sent by the client, mirroring chat's composer toggle. It is
captured on the session record, so the tool gate and the ingest path read one value.

## Current state vs. text chat

Factual gap analysis, not a plan. Roadmap is private.

| Dimension | Text chat | Speak Live today |
|-----------|-----------|------------------|
| Tools | ~20 via `compile-chat-tools.ts` | 8 via `compile-speak-tools.ts` |
| Memory | `search_memories`, context assembled before `streamText` | `search_memories`; summary + memories in instructions on resume; ingest after exchanges |
| Persistence | Messages saved to the thread | Voice turns saved to a `speak` thread |
| Resume | Open thread, full history | Latest Speak thread by default; summary and last turns in instructions; **+** for a fresh one |
| Survives navigation | n/a | Yes — provider in the root layout |
| Survives page reload | Resumable SSE | Resume: same thread and clock, ~1s audio gap |
| Screen awareness | n/a | Chat summary, Strata compiled doc, open rabbit-hole node + map |
| Visuals | Gen UI inline in the message | Optional side panel, gated by modality toggles |

**Speak tools:** `update_display_text`, `render_gen_ui`, `refresh_component`, `upsert_ui_state`,
`show_web_preview`, `search_memories`, `update_thread_title`, `summarize_thread`.

**Chat tools** include `search_memories`, `web_search`, `manage_tasks`, `gather_restaurant`,
`make_mermaid_diagram`, `render_gen_ui`, chat-history fetchers, and experience-gated sets
(kanban, mise, recipes, Strata, Delphi, rabbit hole). See [chat tools](../chat-tools.md).

**Two tools overlap: `render_gen_ui` and `search_memories`.** Web search, restaurants, tasks,
diagrams, and chat-history retrieval are still not reachable from voice.

## Working on Speak

1. Read the [hub README](../hub/README.md) and this file.
2. Check `organic-llm-hub/speak/open-questions.md` before assuming product direction. The thread
   default is provisional; the branching-container question and resume UX remain open.
3. Follow [tool-behavior.md](./tool-behavior.md) for anything that speaks or shows a card.
4. Record decisions per the [maintenance protocol](../hub/maintenance-protocol.md).
