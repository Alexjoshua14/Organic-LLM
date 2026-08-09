# Speak — voice agent

Speak is Organic LLM's voice surface and the **first large-scale workstream** under the
[product hub](../hub/README.md). Voice is the primary channel; visuals are supporting evidence.

This doc is the **public, operational** half: what exists today, which files own what, and where
the current state diverges from text chat. Product intent — scope, acceptance criteria,
roadmap — is private and lives in `.context/hub/speak/`.

| Doc | Holds |
|-----|-------|
| [Tool behavior](./tool-behavior.md) | Locked acknowledgment and visual rules |
| [`decisions/`](./decisions/) | ADRs for Speak technical decisions |
| `.context/hub/speak/product-spec.md` | Product intent (private, gitignored) |
| `.context/hub/speak/open-questions.md` | Unresolved product direction (private) |

For UI and motion work, read the [design backbone](../design/README.md) first.

## ⚠️ Legacy docs

`docs/speak-page-architecture.md` and `docs/speak-page-workflow.md` describe the **pre-Realtime
TTS pipeline**. They are superseded and must not be used to describe or extend the current
system. The code paths below are the source of truth.

## Structure

```
app/speak/page.tsx → SpeakShell
├── LiveVoiceStage (default)  — OpenAI Realtime voice over WebRTC
└── ReadAloudStage            — TTS read-aloud, a separate mode
```

| Area | Path |
|------|------|
| Shell | `app/speak/_components/SpeakShell.tsx` |
| Live voice UI | `app/speak/_components/LiveVoiceStage.tsx` |
| Read aloud | `app/speak/_components/ReadAloudStage.tsx` |
| Realtime hook | `hooks/use-realtime-voice.ts` |
| Session mint | `app/api/ai/speak/realtime/session/route.ts` |
| Tool compile | `lib/llm/compile-speak-tools.ts` |
| Tool execution | `lib/speak/execute-speak-tool.ts` |
| Realtime instructions | `lib/system-prompt/speak-realtime.ts` |
| Modality schema | `lib/schemas/speak-modalities.ts` |

## Session behavior today

Verified against `app/api/ai/speak/realtime/session/route.ts`:

1. A chat thread is created on session start (`createChat()`).
2. Instructions come from `buildSpeakRealtimeInstructions(modalities)` **only** — no memory or
   prior-context injection.
3. Tools come from `compileSpeakRealtimeTools(modalities)` — modality-gated.
4. Transport is OpenAI Realtime over WebRTC, driven by `useRealtimeVoice`.

## Current state vs. text chat

Factual gap analysis, not a plan. Roadmap is private.

| Dimension | Text chat | Speak Live today |
|-----------|-----------|------------------|
| Tools | ~20 via `compile-chat-tools.ts` | 7 via `compile-speak-tools.ts` |
| Memory | `search_memories`, context assembled before `streamText` | Not available; no injection into session instructions |
| Persistence | Messages saved to the thread | Thread exists; voice turns not persisted to chat |
| Resume | Open thread, full history | Each session largely fresh |
| Visuals | Gen UI inline in the message | Optional side panel, gated by modality toggles |

**Speak tools:** `update_display_text`, `render_gen_ui`, `refresh_component`, `upsert_ui_state`,
`show_web_preview`, `update_thread_title`, `summarize_thread`.

**Chat tools** include `search_memories`, `web_search`, `manage_tasks`, `gather_restaurant`,
`make_mermaid_diagram`, `render_gen_ui`, chat-history fetchers, and experience-gated sets
(kanban, mise, recipes, Strata, Delphi, rabbit hole). See [chat tools](../chat-tools.md).

**Exactly one tool overlaps: `render_gen_ui`.** Speak's other six are presentation and
thread-metadata nanobots; none of chat's capability tools are reachable from voice today.

## Working on Speak

1. Read the [hub README](../hub/README.md) and this file.
2. Check `.context/hub/speak/open-questions.md` before assuming product direction — thread
   model, entity identity, and resume UX are deliberately unresolved.
3. Follow [tool-behavior.md](./tool-behavior.md) for anything that speaks or shows a card.
4. Record decisions per the [maintenance protocol](../hub/maintenance-protocol.md).
