# Project Knowledge — Holistic View

This document is the **single place** to see Organic LLM’s goals, design, and how the codebase fits together. Use it to orient yourself (or an AI) and to jump to detailed docs.

**See also:** [Documentation index →](./INDEX.md)

---

## 1. Vision & North Star

**Organic LLM** is:

- **UI Lab** — Reimagining human–AI chat: fluid, organic-futuristic-modernism, glass/gradient/particle, alive.
- **Cognition Lab** — Prototyping memory and context: efficient context windows, safe deep history, trust (export, forget, transparency).

**North Star:** A chat experience that feels _alive_, _remembers meaningfully_, and balances _speed_ with _depth_ — portable into other projects (Spark, Stratum, Ascend).

---

## 2. Design Pillars

### UI

- **Organic-futuristic-modernism** — Not generic “AI slop”; distinct visual language.
- **Glass / gradient / particle** — Depth and atmosphere without clutter.
- **Fluid chat** — Smooth, responsive, transparent about what the model is doing (thinking, search, tools).

### Cognition

- **Efficient memory** — Last-N window + rolling summaries; token-aware context.
- **Safe deep pulls** — On-demand history when summary + last-N aren’t enough.
- **Trust** — Export, forget, transparency (show reasoning, tool use, sources).

---

## 3. Core Concepts (from README)

| Concept                | Meaning                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| **Threads**            | Container for conversations (chat sessions).                          |
| **Messages**           | Canonical turn log (user, assistant, system, tool).                   |
| **Last-N window**      | Only ~10 recent messages sent to the model.                           |
| **Rolling summaries**  | Compact narrative that grows with the thread (v1).                    |
| **Deep history tools** | Safe, on-demand retrieval when summary + last-N aren’t enough (v2).   |
| **UI contract**        | Show full history to user (infinite scroll); keep model context lean. |

---

## 4. Architecture Map

### App surface (routes & pages)

| Area               | Path                                          | Purpose                                                                   |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| **Home / Chat**    | `app/page.tsx` → `components/pages/home`      | Main chat entry; thread list, message thread.                             |
| **Chat by slug**   | `app/chat/[slug]/`                            | Per-thread chat UI.                                                       |
| **Remy**           | `app/remy/`, `app/remy/[slug]/`               | Remy persona chat (thread matching, etc.).                                |
| **Rabbit Holes**   | `app/rabbitholes/`, `app/rabbitholes/browse/` | Explore questions → nodes, path, sources; session state.                  |
| **Speak**          | `app/speak/`, `app/speak/v2/`                 | Text → (optional transform) → TTS → playback; segments, progress.         |
| **Aion (sandbox)** | `app/sandbox/aion/`                           | Aion API + archetypes + persisted schemas.                                |
| **Archetype**      | `app/archetype/`, `app/sandbox/archetype/`    | Event/layout experiments; MorphSurface, archetype payloads.               |
| **Settings**       | `app/settings/`                               | User/site settings.                                                       |
| **Sandbox**        | `app/sandbox/`                                | Prototypes: background, LLM states, ideas, tasks, Prometheus, Spark, TTS. |

### API

| Area         | Path                                             | Purpose                                                           |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| **Chat**     | `app/api/chat/route.ts`, `spark/`, `prometheus/` | Main chat stream; Spark persona; Prometheus.                      |
| **AI**       | `app/api/ai/`                                    | Aion, Remy, core, ideas, speech, TTS (stream, transform), TTS-v2. |
| **Webhooks** | `app/api/webhooks/clerk/`                        | Clerk auth webhooks.                                              |

### Data & state

| Area              | Path                                                                     | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Supabase**      | `data/supabase/`, `lib/supabase/`                                        | Chats, threads, profiles, ideas, tasks, AI jobs, rabbitholes; RLS. |
| **Local**         | `data/local/`                                                            | Local/fallback chat, rabbitholes, remy-chats.                      |
| **Organic state** | `lib/supabase/organicStateStore.ts`, `lib/schemas/organicStateSchema.ts` | Key insights, tech stack, goals, checkpoints (Spark / Aion).       |
| **Memory**        | `lib/memory/`, Mem0 config                                               | Memory operations, integration.                                    |

### LLM & tools

| Area                       | Path                                       | Purpose                                                            |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| **Context & prompts**      | `lib/llm/context.ts`, `lib/system-prompt/` | Model context, persona prompts, tool prompts, Aion, rabbit-hole.   |
| **Tools**                  | `lib/llm/llm-tool-kit.ts`, `lib/llm/core/` | Web search (Exa), core toolkit; tool definitions.                  |
| **Organic state protocol** | `lib/llm/organicStateProtocol.ts`          | Ops from model text (add_key_insight, add_goal, etc.); extraction. |
| **Rabbit hole generation** | `lib/llm/rabbit-hole/generation.ts`        | Rabbit hole node content generation.                               |
| **TTS**                    | `lib/llm/text-to-speech.ts`, `lib/tts/`    | TTS helpers, token calculator, clip store.                         |

### Shared UI & behavior

| Area                   | Path                   | Purpose                                                                        |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| **Chat components**    | `components/chat/`     | Thread, message, input, loading states, AI action (thinking/search/reasoning). |
| **Ambient / presence** | `components/ambient/`  | Organic presence, adaptive presence (idle/active/thinking/responding).         |
| **TTS components**     | `components/tts/`      | Segment manager, playback, progress, clip browser.                             |
| **Packages**           | `packages/organic-ui/` | MorphSurface, archetype schemas, layout.                                       |

---

## 5. Feature Areas & Documentation

Each row is a **goal/design** plus **where it’s implemented** and **doc links**.

| Goal / feature                     | Implementation                                                                              | Docs                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat that feels alive**          | Home, chat thread, organic presence, adaptive background                                    | [organic-presence](./organic-presence.md), [organic-presence-integration-examples](./organic-presence-integration-examples.md), [adaptive-background](./adaptive-background.md), [adaptive-background-timing](./adaptive-background-timing.md)                                                           |
| **Transparent model behavior**     | `data-aiAction` / `data-notification` in stream; ChatThinking, ChatReasoning, ChatSearching | [chat-llm-transparency](./chat-llm-transparency.md)                                                                                                                                                                                                                                                      |
| **Threads, messages, context**     | Supabase persistence, last-N, (v1 summaries)                                                | README roadmap; `lib/chat/`, `data/supabase/`                                                                                                                                                                                                                                                            |
| **Rabbit Holes**                   | Sessions, nodes, path, edges; explore question → preview → full node; Exa sources           | [rabbithole-architecture](../app/rabbitholes/rabbithole-architecture.md), [rabbit-hole-session-size-estimate](./rabbit-hole-session-size-estimate.md), [rabbit-hole-localstorage-quota-fix](./rabbit-hole-localstorage-quota-fix.md)                                                                     |
| **Extended markdown (directives)** | `::name{ key="val" }` → AST → component resolution                                          | [SYNTAX_ARCHITECTURE](./SYNTAX_ARCHITECTURE.md); [prototype README](../app/prototypes/markdown-directives/README.md)                                                                                                                                                                                     |
| **Speak (TTS)**                    | Input → optional transform → generate → playback; segments; SSE with JSON audio             | [speak-page-architecture](./speak-page-architecture.md), [speak-page-workflow](./speak-page-workflow.md); TTS token tracker: [summary](./tts-token-tracker-summary.md), [visual](./tts-token-tracker-visual-guide.md), [main](./tts-token-tracker.md), [maintenance](./tts-token-tracker-maintenance.md) |
| **Organic state (Spark / Aion)**   | Insights, tech stack, goals, checkpoints; ops from model; Supabase store                    | `lib/llm/organicStateProtocol.ts`, `lib/schemas/organicStateSchema.ts`, [organic-presence-integration-examples](./organic-presence-integration-examples.md)                                                                                                                                              |
| **E2EE**                           | (Design/approach)                                                                           | [e2ee](./e2ee.md)                                                                                                                                                                                                                                                                                        |
| **MCP**                            | (Sequence / integration)                                                                    | [MCPsequenceDiagram](./MCPsequenceDiagram.md)                                                                                                                                                                                                                                                            |

---

## 6. Development Principles (from README)

- **Iterative spine** — Working baseline at each step.
- **Composable** — Additive features; threads/messages stay stable.
- **Token-aware** — Context always respects budgets.
- **Transparency** — Inspectable model context (citations, debug).
- **User-first** — Full history visible; lean context is an optimization.

---

## 7. Tech Stack (summary)

- **Frontend:** Next.js 16, React 19, Tailwind, HeroUI, Framer Motion, etc.
- **State:** React state, Zustand, React Query where used.
- **Backend / DB:** Supabase (Postgres, RLS, optional pgvector).
- **Auth:** Clerk (passkeys, biometrics).
- **AI:** Vercel AI SDK, OpenAI, ElevenLabs (TTS), Mem0 (memory), Exa (search).
- **Infra:** Vercel; optional Redis (v1), Upstash.

---

## 8. How to Use This

- **Onboard** — Read §1–3, skim §4–5; open [INDEX](./INDEX.md) and pick deep-dives.
- **Implement** — Use §4–5 to find the right app/API/data/LLM area and the linked doc.
- **Review** — Use this + INDEX as the structured knowledge set; keep INDEX and this file updated when adding or retiring docs.

---

_Last updated to reflect repo structure and existing docs. Link new docs from [INDEX.md](./INDEX.md) and, if they define a major feature, from §5 above._
