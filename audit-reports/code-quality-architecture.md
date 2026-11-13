# Code Quality & Architecture Audit

Organic LLM v0.5.0 — Next.js 16 + Bun monorepo with ~230 `lib/` modules, 42 API routes, and an extracted `@organic-llm/morph-physics` package.

---

## Executive Summary

Strong pockets of engineering discipline (memory boundary enforcement, `serializeError`, L1 memory cache, morph-physics isolation) alongside accumulated architectural drift: multiple parallel chat/LLM route stacks, inverted type dependencies, dead modules, and CI that runs only a subset of tests.

---

## 1. Code Organization & Module Boundaries

### Strengths

- **`lib/`** is the primary domain layer with sensible sub-packages: `llm/`, `memory/`, `chat/`, `api/`, `schemas/`, `health/`, `rate-limit/`, `strata/`
- **`lib/api/`** extracts shared chat-stream logic used by modern `/api/chat`
- **Memory boundary enforced** via ESLint `no-restricted-imports` blocking `@/lib/memory/store` from `app/` and `components/`
- **`llm/morph-physics`** is cleanly separated from app LLM code in `lib/llm/`

### Issues

#### P0 — Inverted dependency: `data/` imports types from `app/`

`RabbitHoleSessionMetadata` is defined in `app/rabbitholes/_lib/sessionStorage.ts` but consumed by:

- `data/supabase/rabbitholes.ts`
- `data/supabase/rabbitHoleBrowseMetadata.ts`
- `data/local/rabbitholes.ts`

**Recommendation:** Move to `lib/schemas/rabbitHoleSchemas.ts` or `types/`.

#### P0 — Parallel, diverging chat/LLM stacks

| Route | Handler | Status |
|-------|---------|--------|
| `/api/chat` | `runLLMChatStream` + `loadMainChatTurnContext` | Primary |
| `/api/ai/aion` | `createAionHandler` | "COPIED FROM CHAT 12/28/25" |
| `/api/ai/core` | Inline `streamText` | No message persistence (TODOs) |
| `/api/chat/spark`, `/api/chat/prometheus` | Legacy `getContextAndMessagesChatPrompt` | Older context path |

#### P1 — Dead / orphaned modules

| File | Evidence |
|------|----------|
| `data/local/rabbitholes.ts` (~349 lines) | Only in docs; superseded by Supabase + sessionStorage |
| `components/chat/new-chat.tsx` | No imports found |
| `components/chat/new-chat-new.tsx` | No imports found |
| `getMessagesForChatPrompt` in `lib/chat/chat-store.ts` | Marked "OLD FUNCTION"; test-only |

#### P1 — `packages/organic-ui` (4 files)

Sandbox-only with `as any` in `MorphSurface.tsx`. Promote or fold into `components/`.

---

## 2. TypeScript Strictness

- Root `tsconfig.json`: **`"strict": true`** ✓
- morph-physics: **`"strict": true`** ✓
- ESLint: **`react-hooks/exhaustive-deps`: `"off"`** — disables major React safety net

### Production `any` / unsafe casts

| Location | Pattern | Risk |
|----------|---------|------|
| `data/supabase/strata.ts` (6×), `strata-notepad.ts` (6×) | `(await supabaseServer()) as any` | Bypasses generated types |
| `app/api/ai/aion/route.ts:21` | `auth: (() => auth()) as any` | Masks Clerk typing |
| `app/api/ai/remy/route.ts` | `validMessages as any` | Mem0 shape unchecked |
| `lib/api/aion-handler.ts` | `AionDeps` uses `any` | Leaks to production |
| `lib/profile.ts` | `user: any` | Clerk webhook untyped |
| Form handlers | `handleSubmit(e as any)` | Event type erasure |

### Schema-level `z.any()`

```111:124:lib/schemas/chat.ts
  content: z.any(),
```

```118:122:lib/schemas/llm-context.ts
 * TODO, replace z.any in messages with Zod schema for UIMessage
  messages: z.array(z.any())
```

### `@ts-ignore` / `eslint-disable`

- `@ts-ignore`: 1 instance (e2e test only)
- `@ts-expect-error`: 2 instances (intentional invalid-arg tests)
- `eslint-disable`: Mostly justified (a11y for TTS audio)

---

## 3. Error Handling

### Strengths

- `lib/llm/log-error.ts` — structured `serializeError` with truncation and cause chains
- Used in `lib/api/run-llm-chat-stream.ts`
- Remy continues without Mem0 on search failure (graceful degradation)

### Issues

| Issue | File | Severity |
|-------|------|----------|
| `serializeError` only in one stream path | Various API routes | P1 |
| Fire-and-forget optimistic save with no client notification | `app/api/chat/route.ts:147-155` | P1 |
| Silent catch (undocumented) | `lib/remy/thread-matching.ts:70-72` | P2 |
| `catch (error: any)` instead of `unknown` | `data/supabase/profiles.ts` (5×) | P2 |
| `console.log` on `NoObjectGeneratedError` | `lib/llm/rabbit-hole/generation.ts` | P2 |

---

## 4. Test Coverage Gaps

### What runs in CI

```yaml
# .github/workflows/test.yml
run: bun run test
```

**No lint, no `next build`, no Playwright e2e.**

### API route coverage (42 routes)

| Has integration test | Route |
|---------------------|-------|
| ✓ | `ai/aion`, `chats`, `profile/summary`, `profile/tree`, `prototypes/strata`, `ai/tts/stream` |
| ✗ | **`chat` (main!)**, `ai/remy`, `ai/core`, all `rabbitholes/*`, `good-news/cron`, `webhooks/clerk`, `homepage/*`, `memory/lens-overview`, all `sandbox/*`, most Strata sub-routes |

**P0 gap:** `/api/chat` — primary production endpoint — has **no dedicated route integration test**.

### `lib/` modules with weak/no direct tests

| Module | ~Lines | Test status |
|--------|--------|-------------|
| `lib/profile-generation.ts` | 801 | No unit tests |
| `lib/rabbit-holes/actions.ts` | 440 | No direct tests |
| `lib/llm/llm-tool-kit.ts` | 681 | No direct tests |
| `lib/good-news/pipeline.ts` | 287 | Schema only |
| `lib/exa/client.ts` | 140 | No tests |
| `lib/remy/thread-matching.ts` | 253 | No tests |
| `data/supabase/chat.ts` | 1129 | `getNMessages.test.ts` only |

### E2E

3 Playwright specs — **not in CI**. `playwright.config.ts` sets `AION_TEST_MODE=1`.

### morph-physics

9 test files — good relative coverage; separate CI workflow.

---

## 5. Performance Concerns

| Issue | Location | Severity |
|-------|----------|----------|
| Sequential DB writes in Strata section upserts | `data/supabase/strata.ts:291-298` | P1 |
| Legacy context loader serializes I/O (TODO to parallelize) | `lib/chat/chat-store.ts:456` | P1 |
| Rabbit hole generation polling every 2.5s | `useGenerationCompletion` | P2 |
| Static `mermaid` import in blog | `components/blog/mermaid-diagram.tsx` | P2 |
| Static `three` in morph-physics main entry | `llm/morph-physics/src/morphUtils.ts` | P2 |
| `gsap` + ScrollTrigger in reactbits | Sandbox/marketing only | P2 |

**Positive:** `optimizePackageImports` in `next.config.js`; 45s L1 encrypted memory cache; tab title digest cache.

---

## 6. Tech Debt (TODO/FIXME)

| File | Note |
|------|------|
| `lib/llm/chat-helpers.ts:920` | "CLEAN UP estimateTokenCount" |
| `lib/llm/strata-knowledge-graph-tools.ts` | 4× stubs return fake data |
| `lib/chat/chat-store.ts:145,456` | Stream resumption; parallelize summary |
| `app/api/ai/core/route.ts` | Stream resumable; save messages |
| `components/chat/chat-scroll-button.tsx:8` | `//TODO: MAKE THIS WORK` |
| `components/chat/new-chat*.tsx` | Prompt generation unimplemented |
| `lib/schemas/llm-context.ts:118` | Replace `z.any` in messages |

### `console.log` in production paths

| File | Context |
|------|---------|
| `components/chat-experimental/chat-experimental.tsx:68` | Unconditional `TOOL_CALL` log |
| `lib/llm/rabbit-hole/generation.ts` | `NoObjectGeneratedError` debug dumps |
| `app/rabbitholes/_lib/useRabbitHoleSession.ts:152` | "Saving session" |

---

## 7. React Patterns

| Issue | File | Severity |
|-------|------|----------|
| `exhaustive-deps` disabled globally | `eslint.config.mjs` | P1 |
| Empty deps array misses `initialMessage`, `sendMessage` | `chat-experimental.tsx:81-87` | P2 |
| Index keys on memories | `components/archetype/interfaces/memory.tsx:199` | P2 |
| `ChatScrollButton` typo + non-functional | `chat-scroll-button.tsx` | P2 |

---

## 8. Duplicate Logic

| Duplication | Locations |
|-------------|-----------|
| New chat UI | `new-chat.tsx` ≈ `new-chat-new.tsx` |
| Create-chat flow | `sidebar-new-chat`, `aion-launcher`, `remy/page`, `home-page-shell`, `chat/page` |
| Rabbit hole storage | `data/local/rabbitholes` (dead) vs `sessionStorage.ts` vs Supabase |
| Chat streaming | `runLLMChatStream` vs `createAionHandler` vs `core/route.ts` |
| TTS endpoints | 5 routes: `tts`, `tts-v2`, `tts/stream`, `tts/transform`, `speech` |
| Context loading | `getContext` vs `getContextAndMessagesChatPrompt` vs dead `getMessagesForChatPrompt` |

---

## 9. morph-physics Package

### Strengths

- Clean subpath exports: `.`, `./react`, `./webgl`, `./layout-relaxation`
- Strict TypeScript, Zod schemas, 9 Vitest test files
- Dedicated CI (`build` + `test` + `npm pack --dry-run`)
- Apache-2.0 license

### Issues

- `sideEffects: true` + unconditional Three import in `morphUtils.ts` — DOM consumers pay for Three.js
- `console.error` in `validateVector` without debug flag gate
- Broad peer dep range (`react: ^18 || ^19`, `zod: ^3 || ^4`)

**Overall:** Above average for an extracted internal library.

---

## 10. CI/CD Pipeline

### `.github/workflows/test.yml`

- Triggers: push/PR to `main`
- Steps: checkout → Bun → `bun install --frozen-lockfile` → `bun run test`
- **Missing:** `lint:check`, `next build`, Playwright e2e, typecheck, `bun audit`

### `.github/workflows/morph-physics.yml`

- Path-filtered; good — but `bun install` without `--frozen-lockfile`

### Deployment

- `vercel.json`: cron for good-news at 11:00 UTC
- No deployment workflow in repo (Vercel Git integration assumed)

---

## Search Pattern Summary

| Pattern | Production occurrences |
|---------|----------------------|
| `TODO` | ~25 |
| `FIXME` / `HACK` | 0 |
| `@ts-ignore` | 0 (prod) |
| `any` / `as any` | ~35+ sites |
| `eslint-disable` | ~12 |
| `console.log` | ~8 prod paths |
