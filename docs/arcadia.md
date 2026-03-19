# Arcadia

Arcadia is a **sandbox chat experience** inside Organic LLM: a safe lab for experimenting with system prompts, context compilation, toolkits, response styles, and UI variants—without destabilizing the main chat.

## Why it exists
- A place to iterate quickly on high-risk UX + LLM changes (prompt/tool/context shifts) with minimal coupling.
- A proving ground for changes that later graduate into the main chat route and shared components.

## What Arcadia is (scope)
- Uses the shared chat shell (`components/chat/chat.tsx`) and the shared thread persistence model (Supabase `threads` + `messages`).
- Threads created from Arcadia are tagged with routing metadata (`threads.feature`, `threads.path`) so the sidebar can route correctly.
- Arcadia-specific UI variants can exist (e.g. sidebar row styling) while still sharing core primitives and contracts.

## What Arcadia is not (non-goals)
- Not a separate persistence stack or separate auth model.
- Not guaranteed-stable UX; breakage here is acceptable as part of iteration.

## UX contract
- Thread list API (`GET /api/chats`) returns thread metadata including `feature/path`.
- Sidebar rendering can be filtered via **Coalescence Mode**:
  - OFF: show main chat threads only
  - ON: show threads from all features (including Arcadia)

## Tech + design (3 lines)
- **Stack**: Next.js (App Router) + React + AI SDK streaming + Clerk + Supabase
- **LLM**: shared `/api/chat` pipeline (context + tools + streaming UI events)
- **Design**: forest-chrome text hint + brown-glass cards (Arcadia sidebar variant)

