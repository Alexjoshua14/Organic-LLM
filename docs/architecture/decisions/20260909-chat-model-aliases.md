# Chat model aliases as a developer index

**Status:** Accepted
**Date:** 2026-09-09
**Affects:** `lib/schemas/chat-models.ts`, Auto routing, production `generateText` / `streamText` call sites

## Context

The composer picker already had a catalog of gateway models (`ChatModel.id` + `name`), but app code still hardcoded slugs such as `google/gemini-3.8-flash`. A flat `Latest.*` index conflated family with version tracking and flattened providers into camelCase prefixes.

## Decision

Index models as **provider → family** under a parent export `models` (avoids colliding with `@ai-sdk/openai`’s `openai()`):

```ts
import { models } from "@/lib/schemas/chat-models";

generateText({ model: models.openai.luna.id });
getDefaultModel: () => models.anthropic.sonnet;
```

- **Catalog:** `lib/schemas/chat-models.ts`, re-exported from `lib/schemas/chat.ts`.
- **Alias strings:** dotted (`openai.flagship`, `moonshotai.kimiCode`). Every catalog row has exactly one alias.
- **Picker:** Auto plus rows with `picker !== false`. Labels stay `name`.
- **Storage / API:** gateway ids (or `organic-llm/auto`). Aliases are never persisted.
- **Effort, cost, context windows:** still keyed by concrete gateway id.

## Upgrade a family

1. Edit the catalog row: new gateway `id` + `name` (and ZDR if it changed). Leave `alias` in place.
2. Add the new id to `lib/rate-limit/llm-cost.ts` and `lib/chat/context-budget.ts` if windows or prices differ.
3. Extend `lib/schemas/chat-effort.ts` only if the new slug needs new effort rules (slug prefixes, not aliases).
4. Do not grep the repo for the old version unless dropping a pin.

## Consequences

App code tracks families via `models.provider.family`. The composer still lists and displays concrete gateway names. Message badges resolve stored ids via `getModelDisplayName`.
