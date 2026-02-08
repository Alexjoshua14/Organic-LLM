# Chat: LLM transparency in the UI

This document describes how the chat UI exposes what the LLM is doing—reasoning, tool use, and backend events—so users get insight into the “black box” instead of only seeing the final reply.

## Why expose the process?

- **Trust**: Users can see when the model is searching the web, using memory, or thinking, instead of wondering if it’s stuck or guessing.
- **Clarity**: Tool calls (e.g. web search) and their results (e.g. source list) are visible, so answers feel grounded.
- **Reasoning**: When the model uses reasoning tokens (e.g. extended thinking), the UI can show a “Reasoning…” state so users know work is in progress.

The same ideas apply to any backend-emitted data: notifications, step updates, or future signals can be surfaced in one place.

---

## Overview of the data flow

1. **Backend** (e.g. `/api/chat/[persona]`) runs `streamText` and uses a **stream writer** to push UI-oriented events alongside the normal message stream.
2. Events are sent as **custom data parts** on the UI message stream: `data-aiAction` and `data-notification`.
3. The **client** (`useChat` in `components/chat/chat.tsx`) receives these in **`onData`**, updates local state (e.g. `aiAction`), and passes that state into the thread.
4. **Message UI** (`chat-message.tsx`, `chat-loading.tsx`) renders the current action (thinking, reasoning, search with sources, etc.) and message parts (reasoning vs text).

So: backend emits → client `onData` → `aiAction` (and optionally notifications) → components render.

---

## Backend: what gets emitted

### 1. `data-aiAction` (primary UI state)

The chat API uses `createUIMessageStream<ChatUIMessage>` and writes `data-aiAction` with a payload that includes:

- **`action`**: One of `ChatAIActionEnum` (see below).
- **`message`**: Optional short label (e.g. “Gathering context”, “Thinking…”, “Using tool: web_search”).
- **`sources`**: Optional (for search): list of `ExaSearchResultSource` so the UI can show “Searching the web…” and a collapsible list of sources.

**Where it’s emitted:**

- **Route start** (`app/api/chat/route.ts`):  
  `action: Processing`, `message: "Gathering context"` then later `"Thinking..."`.
- **Stream chunks** (`onChunk`):
  - `reasoning-delta` → `action: Reasoning`.
  - `tool-call` → `action: Tool`, `message: "Using tool: <toolName>"`.
- **Web search tool** (`lib/llm/llm-tool-kit.ts`):  
  When the tool runs and has results, it uses the injected `writer` to send `action: Search` and `sources` (so the UI can show live source list while the model continues).

The client maps specific tool names to richer UI:

- `web_search` → treat as **Search** and merge/display `sources`.
- `memory_search` → **Memory** (“Searching memories…”).
- Other tools → generic **Tool** (“Using a tool…”).

### 2. `data-notification`

Used for informational messages that don’t drive the main “action” pill (e.g. “Using model X”, “Request completed”, “Gathering context” in some paths). Emitted with `message` and `level` (e.g. `info`). Currently the client **receives** these in `onData` and can log them; they are **not** yet rendered in the chat UI. They are available for toasts, status bars, or debug panels.

### 3. Message stream: reasoning vs text parts

The AI SDK message stream can produce **message parts** with different `type` values:

- **`reasoning`**: Model is in a reasoning/thinking phase. When `state === "streaming"`, the UI shows a “Reasoning…” indicator (see below).
- **`text`**: Final answer text, rendered as markdown.

So the backend doesn’t only drive “current action” via `data-aiAction`; the **structure of the streamed message** (reasoning vs text parts) also controls what the user sees (e.g. reasoning placeholder vs actual reply).

---

## Client: how it’s consumed

### `onData` in `components/chat/chat.tsx`

- **`data.type === "data-aiAction"`**:  
  Parses `action`, `message`, `sources` and calls `setAiAction(...)`. For `Tool`, it derives the tool name from `message` and may set `action` to `Search` or `Memory` and merge `sources` for web search.
- **`data.type === "data-notification"`**:  
  Currently only logged; no state update for UI (ready for future use).
- **`onFinish`**:  
  Clears the current action: `setAiAction(undefined)`.

### Thread and message components

- **`ChatThread`** receives `aiActionPayload` (the current `aiAction`) and passes it only to the **last** message’s `ChatMessage`.
- **`ChatMessage`** (assistant):
  - If the message already has **text parts**, it renders those and, for any **reasoning** part with `state === "streaming"`, shows the reasoning placeholder.
  - If there are **no text parts yet**, it renders **`ChatAIAction`** using `aiActionPayload` (so the user sees “Thinking…”, “Searching the web…”, “Reasoning…”, etc., until the reply arrives).

So: one “live” action state per turn, shown on the last message; once the model streams text, that message shows reasoning + text as dictated by parts.

---

## UI components (what the user sees)

Defined in **`components/chat/chat-loading.tsx`** and used in **`components/chat/chat-message.tsx`**:

| Action / Part              | Component       | User-facing behavior                                                                  |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `processing`               | `ChatThinking`  | Animated “Processing…” / “Gathering context” / “Thinking…”                            |
| `reasoning`                | `ChatReasoning` | Animated “Reasoning…” (from `data-aiAction` or from a streaming `reasoning` part)     |
| `search`                   | `ChatSearching` | “Searching the web…” + collapsible “N sources” with titles/URLs when `sources` is set |
| `memory`                   | `ChatThinking`  | “Searching memories…”                                                                 |
| `tool`                     | `ChatThinking`  | “Using a tool…”                                                                       |
| (streaming reasoning part) | `ChatReasoning` | Same “Reasoning…” while that part is streaming                                        |

- **ChatThinking / ChatReasoning**: Use `ShinyText` for a subtle animated label.
- **ChatSearching**: Same label plus a collapsible list of `sources` (from Exa web search) so users see which pages were found.

---

## Types and enums

- **`ChatAIActionEnum`** (`types/ai.ts`): `Processing`, `Search`, `Memory`, `Tool`, `Reasoning`, `Typing`, `Errored`.
- **`ChatUIMessage`**: Extends `UIMessage` with optional `notification` and `aiAction` data part types (used for typing the stream).
- **`WebSearchStreamWriter`** (`lib/llm/llm-tool-kit.ts`): Minimal writer interface so the web search tool can push `data-aiAction` with `action: Search` and `sources` without depending on the full chat route.

---

## End-to-end example: web search

1. User sends a message with web search enabled.
2. Route starts stream, sends `data-aiAction`: `Processing` (“Gathering context”), then `Processing` (“Thinking…”).
3. Model decides to call `web_search`. Stream emits a `tool-call` chunk → route’s `onChunk` sends `data-aiAction`: `Tool`, `message: "Using tool: web_search"`.
4. Client maps `web_search` to `Search` and sets `aiAction` to `Search` (message can stay or be updated).
5. `createWebSearchTool` runs; when Exa returns, it uses `writer.write({ type: "data-aiAction", data: { action: Search, sources } })`.
6. Client merges `sources` into `aiAction` (and dedupes by source id). UI shows “Searching the web…” and a collapsible “N sources” list.
7. Tool result goes back to the model; model streams text. Message gets text parts (and possibly reasoning parts). UI switches from `ChatAIAction` to markdown + any “Reasoning…” for streaming reasoning parts.
8. On finish, `onFinish` clears `aiAction`.

So the user sees: gathering → thinking → “Using a tool” / “Searching the web…” with sources → then the final answer.

---

## Other backends (Aion, Remy, etc.)

- **Aion** (`lib/api/aion-handler.ts`) uses `data-notification` for steps like “Determining AI model selection”, “Gathering context”, “Request completed”, and step finish (with step payload). It does **not** currently send `data-aiAction` in the same way; the main chat UI that relies on `ChatAIActionEnum` is wired to the default chat route.
- **Remy** and other personas that use the same `useChat` + `onData` contract can expose the same UX by emitting `data-aiAction` (and optionally `data-notification`) from their stream.

---

## Possible improvements

- **Notifications in the UI**: Surface `data-notification` (e.g. in a toast or a small status line) so “Using model X” or “Request completed” is visible.
- **Richer reasoning**: If the provider exposes reasoning content (e.g. decrypted reasoning tokens), show a collapsible “Reasoning” section or a short summary instead of only “Reasoning…”.
- **Tool results summary**: Optionally show a one-line summary or icon per tool call (e.g. “Searched: 3 results”) in the message, not only while streaming.
- **Aion / Remy parity**: Add `data-aiAction` (and possibly tool-specific writers) to other routes so all chat UIs can show the same transparency (search, memory, reasoning, tool).
- **Error state**: `ChatAIActionEnum.Errored` is set in `onError`; ensure it’s rendered (e.g. with `ChatThinking` or a dedicated error state) so the user sees that something went wrong.

---

## File reference

| Area             | File(s)                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| Stream emission  | `app/api/chat/route.ts`, `lib/llm/llm-tool-kit.ts` (web search writer)          |
| Client state     | `components/chat/chat.tsx` (`onData`, `aiAction`, `setAiAction`)                |
| Thread / message | `components/chat/chat-thread.tsx`, `components/chat/chat-message.tsx`           |
| Action UI        | `components/chat/chat-loading.tsx` (ChatThinking, ChatReasoning, ChatSearching) |
| Types            | `types/ai.ts` (ChatAIActionEnum, ChatUIMessage)                                 |
| Prototype / dev  | `app/sandbox/prototypes/llm-states/page.tsx` (all action states in one place)   |
