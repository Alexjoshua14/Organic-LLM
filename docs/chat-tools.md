# Chat tools

Organic LLM’s chat assistant does more than stream text. It can search memory and the web, pull older thread history on demand, render structured UI blocks, drive a live kanban board, and publish validated Mermaid diagrams—all wired through the Vercel AI SDK `tool()` API and compiled per request.

This guide is the product-facing catalog. Implementation lives in [`lib/llm/compile-chat-tools.ts`](../lib/llm/compile-chat-tools.ts), with individual tools in [`lib/llm/llm-tool-kit.ts`](../lib/llm/llm-tool-kit.ts), [`lib/llm/gen-ui-tool.ts`](../lib/llm/gen-ui-tool.ts), [`lib/llm/kanban-tool.ts`](../lib/llm/kanban-tool.ts), and experience-specific modules under [`lib/llm/`](../lib/llm/).

---

## How tools are assembled

On each chat turn, `compileChatTools()` builds a `ToolSet` plus a **Tool Instructions** appendix for the system prompt. The chat route passes in user toggles and an optional experience token; the compiler turns those into capabilities:

| Setting | What it enables |
|---------|-----------------|
| `useMemory` | Long-term recall on demand — vector search over Mem0/Qdrant with relevance tiers and L1 cache, instead of injecting the full corpus every turn. |
| `useSearch` | Fresh web context — [Exa](https://exa.ai) natural-language search with highlight excerpts (not full pages); cited sources stream to the thread. |
| `useGetMoreMessages` + `chatId` | Deep thread access when the last-N window and rolling summary are not enough. |
| `experience` | Changes the *mix* of tools: **Delphi** (propose/commit memory workflow), **Arcadia** / **topic explore** (Mermaid + Gen UI; **Ergon** chat style adds live kanban), **Strata hub** (navigate/search pages), **Strata page** (optional KG when knowledge search is on). Plain chat uses only the toggles above. |
| `useKnowledgeSearch` | On **Strata page** only — experimental knowledge-graph tools; persistence is incomplete, so summarizing page content is usually better. |

Many tools accept a **stream writer** so the UI can show live state—search sources, tool labels, kanban commands—while the model continues. See [Chat LLM transparency](./chat-llm-transparency.md).

Parallel tool calls are encouraged when searches are independent (e.g. memory + web in one turn) to reduce latency.

---

## Core tools (main chat)

These are available when the corresponding chat settings are enabled and the experience is not Delphi-only.

### `search_memories`

Vector search over the user’s long-term memory (Mem0 / Qdrant). Relevance tiers and caching keep context useful without sending the full corpus every turn.

Memory text is **encrypted at rest** in Qdrant (AES-256-GCM via [`EncryptedVectorStore`](../lib/memory/encrypted-vector-store.ts)); embeddings stay unencrypted so vector search still works. The server decrypts hits before returning them to the model. See [E2EE overview](./e2ee.md).

- Implementation: [`createMemorySearchTool`](../lib/llm/llm-tool-kit.ts) → [`lib/memory/operations.ts`](../lib/memory/operations.ts)

### `web_search`

[Exa](https://exa.ai) natural-language search (built for how AI assistants search and read the web) with `type: auto`, ~3 results, and `contents: { highlights: true }` — query-relevant page excerpts, not full text — streamed as cited sources.

- Implementation: [`createWebSearchTool`](../lib/llm/llm-tool-kit.ts) → [`searchWebWithQuery`](../lib/exa/client.ts)

### Deep history

On-demand retrieval when the last-N window and rolling summary are not enough (token-capped):

| Tool | Used when |
|------|----------|
| `get_more_chat_history` | User refers to earlier turns; pass a limit (e.g. 5–10). |
| `get_full_chat_history` | User explicitly wants the whole thread or a full recap (up to ~24k tokens). |
| `get_messages_from_date` | User asks what was said on a specific date (`YYYY-MM-DD`). |

Requires `useGetMoreMessages` and a `chatId`. See also [Context building](./architecture/context-building.md) and [Thread & session architecture](./thread-session-architecture.md).

---

## Arcadia-style affordances

*Arcadia is the sandbox where chat goes beyond prose — the model can publish diagrams, structured UI blocks, and live boards so replies are easier to scan, compare, and act on in-thread.* See [Arcadia](./arcadia.md).

Registered when `experience` is **arcadia** or **topic explore**.

### `make_mermaid_diagram`

Single **generator** call (plans + emits in one pass) with syntax validation and a bounded repair loop. The model publishes diagrams the UI renders from `mermaid` code blocks—process flows, architecture, relationships. Generation targets the renderer's strict, sanitized environment (no HTML labels, no `click`, quoted special-character labels). Server-side `mermaid.parse` validation **fails open** when the runtime can't validate (no DOM/DOMPurify), so the browser renderer is the final arbiter.

- Implementation: [`createMermaidDiagramTool`](../lib/llm/llm-tool-kit.ts) · prompts: [`lib/system-prompt/mermaid-diagram-prompt.ts`](../lib/system-prompt/mermaid-diagram-prompt.ts) · source utils: [`lib/mermaid/source.ts`](../lib/mermaid/source.ts)

### `render_gen_ui`

Structured blocks as first-class UI, not markdown-only. Block types (Zod schemas in [`lib/schemas/gen-ui/`](../lib/schemas/gen-ui/)):

| Block type | Purpose |
|------------|---------|
| **answer-card** | Focused answer with optional metadata |
| **decision-matrix** | Compare options in a grid |
| **plan-timeline** | Phased plans with milestones |
| **audio-snippet** | Short audio-oriented payloads in-thread |

- Implementation: [`createRenderGenUiTool`](../lib/llm/gen-ui-tool.ts) · prompt hints: [`lib/system-prompt/gen-ui.ts`](../lib/system-prompt/gen-ui.ts)

### `kanban_board` (Ergon chat style)

When `chatStyle === "ergon"`, the model drives a **live** kanban board over a transient `data-kanban` stream channel: initiate, upsert items, move, remove, show filtered views. Multiple tool calls per turn are normal (init → hydrate → show)—a puppet UI backed by client state, not a one-shot card.

- Implementation: [`createKanbanBoardTool`](../lib/llm/kanban-tool.ts) · [`lib/schemas/kanban`](../lib/schemas/kanban.ts)

### `manage_tasks` (durable Ergon todos)

Always available in the main chat. Lets Aion manage the user's **durable** todo list (the `/ergon` page) via the Supabase data layer (RLS-scoped): `CREATE_TASKS`, `UPDATE_TASK`, `COMPLETE_TASK`, `LIST_TASKS`. Categories are passed by name (resolve-or-create). Returns a compact `{ kind: "ergon-tasks", action, tasks }` payload rendered by [`ErgonTaskResult`](../components/ergon/ErgonTaskResult.tsx) with a link to `/ergon`. Distinct from `kanban_board`: that is a client-side puppet board; `manage_tasks` writes through to the database.

- Implementation: [`createManageTasksTool`](../lib/llm/ergon-tasks-tool.ts) · executor [`executeManageTasks`](../lib/llm/ergon-tasks-execute.ts) · schema [`lib/schemas/ergon-tasks.ts`](../lib/schemas/ergon-tasks.ts) · prompt hints [`lib/system-prompt/ergon.ts`](../lib/system-prompt/ergon.ts)

---

## Delphi experience

Delphi uses a dedicated tool set for intentional memory curation ([`createDelphiMemoryTools`](../lib/llm/delphi-memory-tools.ts)):

| Tool | Role |
|------|------|
| `search_memories` | Corpus search (Delphi-specific description when enabled) |
| `propose_memory` | Validate and echo a candidate; does not write to Mem0 |
| `commit_memory` | Hard commit after user confirmation |

Deferred (not registered until persistence ships): `link_memories`, `flag_for_followup`, `flag_for_review` — see [`createDelphiDeferredMemoryTools`](../lib/llm/delphi-memory-tools.ts).

---

## Strata

| Experience | Tools |
|------------|--------|
| **strata_hub** | `navigate_to_strata_page` (UUID or title fragment), `search_strata_pages` |
| **strata_page** + `useKnowledgeSearch` | Knowledge-graph tools from [`strata-knowledge-graph-tools.ts`](../lib/llm/strata-knowledge-graph-tools.ts) — experimental; stubs may return placeholder data |

Hub tools: [`createStrataHubAssistantTools`](../lib/llm/strata-assistant-tools.ts). Prototype UI: [`app/sandbox/prototypes/strata/`](../app/sandbox/prototypes/strata/).

---

## Export prompts (not a model tool)

Export is a **user/UI** feature, not part of `compileChatTools`, but it pairs well with the chat story: one-click packaging of the thread into provider-specific prompts (ChatGPT, Claude, Cursor, and others).

- API: [`POST /api/ai/export-prompt`](../app/api/ai/export-prompt/route.ts)
- Handler: [`lib/export/handle-export-prompt-post.ts`](../lib/export/handle-export-prompt-post.ts)
- Docs: [Export prompt presets](./export-prompt-presets.md) · [blog](https://organic.coalescencelabs.app/blog/export-prompt-presets)

---

## Experience summary

| Experience | Typical tools |
|------------|----------------|
| **Main chat** | Memory, web, history (per settings); Arcadia-style tools when configured |
| **Arcadia** | + Mermaid, Gen UI; + kanban when Ergon style |
| **Delphi** | Memory search + propose/commit/link/flag workflow |
| **Strata hub** | Navigate + search Strata pages |
| **Strata page** | Optional KG stubs when knowledge search is on |

---

## Related reading

- [Context building](./architecture/context-building.md) — last-N, summaries, memory injection before `streamText`
- [Thread & session architecture](./thread-session-architecture.md) — persistence and encryption
- [Arcadia](./arcadia.md) — sandbox experience
- [Chat LLM transparency](./chat-llm-transparency.md) — how tool activity appears in the UI
- [Chat message flow (blog)](https://organic.coalescencelabs.app/blog/chat-message-flow)
- [End-to-end encryption](./e2ee.md)
