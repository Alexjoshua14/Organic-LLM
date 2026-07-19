# Stratum (beta)

Stratum is an **Arcadia chat style** for product discovery: a structured interview that uncovers the full picture of a software idea — concept, users, features, architecture — and maintains a living product spec the user can hand off to other systems (Cursor, agents, developers).

## Why it exists
- Ideas usually enter chat as prose and get consumed into a generic AI shape. Stratum forces the model to *ask* instead of *assume*.
- The end product is not a conversation but a spec: prioritized features, architecture components, risks, open questions, and **handoff chunks** — self-contained briefs that can be pasted into another tool without the thread as context.

## How it works
- Selected from the Arcadia style picker (`/sandbox/arcadia`), like Ergon/Remy/Scribe. The style is sent as `chatStyle: "stratum"` on each `/api/chat` request.
- Two style-scoped tools (`lib/llm/stratum-tool.ts`, registered in `compileChatTools` for Arcadia-style experiences):
  - `discovery_form` — renders one round of questions as an interactive form. Field kinds: `text`, `long_text`, `single_select`, `multi_select`, `scale`. Max one call per turn, 1–6 fields (guidance says 2–4).
  - `product_spec` — renders/refreshes the living spec sheet. Always receives the **full** spec (replace, not delta).
- System prompt behavior lives in `lib/system-prompt/stratum.ts` (appended in `appendMainChatPostToolSystemFragments` for `chatStyle === "stratum"`): stage order (concept → users → features → architecture → spec), no invented details, reflect-then-ask cadence, keep the spec current.

## Client contract
- Schemas in `lib/schemas/stratum.ts` (zod, strict tool-output wrappers `{ kind: "stratum-form" | "stratum-spec", … }`, markdown fallbacks).
- `components/chat/stratum/`:
  - `StratumFormToolResult` — interactive form. Submitting serializes answers via `formatStratumFormAnswers` into a deterministic user message (`Discovery answers — …`) and sends it through `ChatSendContext` (`components/chat/chat-send-context.tsx`, provided by the chat shell). Forms outside the latest assistant message collapse to an "answered in chat" chip.
  - `StratumSpecToolResult` — spec sheet: coverage bar, must/should/could features, architecture components + data flows, risks, open questions, and copyable handoff chunks (plus "Copy as Markdown" for the whole spec).
  - Both surfaces carry a tiny lightweight **beta** marker (`StratumBetaBadge`) while the UX is in development.

## Non-goals (v1)
- No durable Stratum-specific persistence: the spec lives in the thread's tool outputs; answers live in user messages. (A Supabase-backed spec record, like the mise plan, is the natural v2.)
- No cross-thread spec aggregation or export pipeline yet — handoff is copy/paste by design for the MVP.
