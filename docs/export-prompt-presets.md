# Export Prompt Presets

This document describes the centralized export feature used by `TextCopyModal` for sending refined prompts/instructions to external systems.

## Overview

The export modal supports:

- Copy source text directly.
- Generic export callback (`onExport`) for app-local behavior (e.g. download).
- Preset-driven external export:
  - **Open in chat** — AI Elements `OpenIn` / `OpenInChat` wrapper: user prepares a prompt (server or deterministic builder), it is copied to the clipboard, then the user picks **ChatGPT**, **Claude**, **T3**, **v0**, or **Scira** from the dropdown (URL-length and encoding handled by the component).
  - **Cursor** — instruction package is **copied only** (no custom deep-link in Organic LLM); optional LLM rewrite via the same API with `exportFormat: "cursor"`.

Primary implementation points:

- Modal: `[components/design-system/TextCopyModal.tsx](../components/design-system/TextCopyModal.tsx)`
- Open-in-chat UI: `[components/design-system/OpenInChat.tsx](../components/design-system/OpenInChat.tsx)` (wraps `[components/ai-elements/open-in-chat.tsx](../components/ai-elements/open-in-chat.tsx)`)
- Preset registry/builders: `[lib/export/prompts.ts](../lib/export/prompts.ts)`
- API handler: `[lib/export/handle-export-prompt-post.ts](../lib/export/handle-export-prompt-post.ts)` · route `[app/api/ai/export-prompt/route.ts](../app/api/ai/export-prompt/route.ts)`
- Last provider persistence: `[lib/export/last-provider-storage.ts](../lib/export/last-provider-storage.ts)`
- First adopter: `[app/sandbox/prototypes/glass-fonts/_components/glass-fonts-lab.tsx](../app/sandbox/prototypes/glass-fonts/_components/glass-fonts-lab.tsx)`

## Preset model

Each preset is typed as `ExportIntentPreset` in `[lib/export/prompts.ts](../lib/export/prompts.ts)`:

- `id`
- `version` — bump when semantics change (included in server telemetry).
- `targets` — ordered list of export destinations (see below).
- `buttonLabel` — primary external action label (e.g. prepare-and-copy for open-in-chat, or sole CTA for clipboard-only presets).
- `label`, `descriptor?`, `question`, `requestedFormat`, `contextPlaceholder?`
- `validate?` — optional `(sourceText) => { ok: true } | { ok: false; message }`; the modal and API both enforce this.

### `targets` shape

`ExportTarget` is a discriminated union:

1. **Open in chat**
  `{ kind: "open-in-chat", providers: OpenInChatProvider[] }`
   `OpenInChatProvider` is one of: `"chatgpt"`, `"claude"`, `"t3"`, `"v0"`, `"scira"`.
   List every provider you want in the dropdown. The UI sorts options so the **last-used** provider (per preset) appears first; persistence key: `organic-llm:export:lastProvider:<presetId>` in `localStorage`.
2. **Cursor clipboard**
  `{ kind: "clipboard", app: "cursor" }`
   Renders a separate “Copy Cursor instruction” control in the modal (alongside open-in-chat when both are present).

`inferExportFormat(preset)` returns `"open_in_chat"` if any target is `open-in-chat`, otherwise `"cursor"` if a Cursor clipboard target exists.

## Current presets

Shipped in `EXPORT_INTENT_PRESETS`:

- Storyboard script (ChatGPT)
- Polished script (**ChatGPT + Claude**), with `minLength: 40` validation on `sourceText`
- Cursor code analysis (clipboard + API `exportFormat: "cursor"`)
- Architecture brief (ChatGPT)
- Career-profile extraction (ChatGPT)

## Prompt generation

Builders (deterministic fallbacks):

- `buildChatGptPrompt({ preset, sourceText, userContext })`
- `buildCursorInstruction({ preset, sourceText, userContext })`

### API (`POST /api/ai/export-prompt`)

JSON body (Zod):

- `presetId` (string)
- `sourceText` (1–30_000 chars)
- `userContext?` (≤10_000 chars)
- `exportFormat?` — `"open_in_chat"`  `"cursor"`; if omitted, inferred from `targets`.
- `provider?` — optional string for telemetry (e.g. last open-in-chat provider); **never** logged with `sourceText`.

Responses:

- **200** — `{ prompt, degraded?, reason? }`. On LLM rate limit: deterministic `prompt`, `degraded: true`, `reason: "rate_limited"` (no 429).
- **400** — validation failure (`code: "validation_failed"`) or invalid body.
- **401** / **404** — auth / unknown preset.

Telemetry (stdout, JSON line): `event: "export-prompt"`, `presetId`, `presetVersion`, `provider`, `sourceLength`, `degraded`, `latencyMs`, optional `reason`. **Never** includes `sourceText`.

### Modal flow (open-in-chat)

1. User clicks the prepare action → optional `generateExternalPrompt` calls the API (`exportFormat: "open_in_chat"`) → result copied to clipboard → `OpenInChat` is enabled with `query={prompt}`.
2. User chooses a provider in `OpenInChat`; choice is persisted for that `presetId`.

### Adding providers to a preset

1. Open `[lib/export/prompts.ts](../lib/export/prompts.ts)`.
2. On the relevant `{ kind: "open-in-chat", ... }` target, extend `providers` (e.g. add `"t3"` or `"v0"`).
3. Ensure `[components/ai-elements/open-in-chat.tsx](../components/ai-elements/open-in-chat.tsx)` includes that provider (it ships with ChatGPT, Claude, T3, Scira, v0, Cursor links).
4. Bump `version` on the preset if behavior or wording contract changes.

## Limitations

- Cursor remains clipboard-first in Organic LLM; the shared AI Elements menu can open Cursor via URL elsewhere, but this product keeps Cursor handoff as copy-only beside `OpenInChat`.