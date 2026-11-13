# API Routes & Authorization Audit

Complete inventory of **42** `route.ts` files under `app/api/` plus **3** server action modules under `app/actions/`.

Global auth is enforced via Clerk in `proxy.ts` for all `/api/*` except `/api/webhooks/*` and `/api/good-news/cron`.

---

## Auth Status Legend

| Status | Meaning |
|--------|---------|
| **Protected** | `auth()` or `requireLlmChatActor` in handler; returns 401 |
| **Partial** | Proxy-only auth and/or missing ownership/rate-limit layers |
| **Public** | Intentionally unauthenticated (webhook signature or cron secret) |

---

## Complete Route Inventory

| Route | Method(s) | Auth | Validation | Rate limit | Notes |
|-------|-----------|------|------------|------------|-------|
| `/api/chat` | POST | Protected | `ChatRequestSchema` | `checkLlmMessageLimit` | No explicit chat ownership check (RLS) |
| `/api/chat/spark` | POST | Protected | None | `checkLlmMessageLimit` | Legacy; no Zod |
| `/api/chat/prometheus` | POST | **Partial** | None | **None** | **No `auth()` in handler** |
| `/api/chat/[id]/stream` | GET | Protected | Path param | None | No ownership check on `id` |
| `/api/chat/[id]/generate-title` | POST | Protected | None | `checkTitleGenerationLimit` | Relies on RLS |
| `/api/chats` | GET | Protected | N/A | `checkChatsListLimit` | Explicit `ownerId` filter |
| `/api/ai/aion` | POST | Protected | `ChatRequestSchema` | `checkLlmMessageLimit` | Step payloads leaked to client |
| `/api/ai/core` | POST | Protected | `ChatRequestSchema` | `checkLlmMessageLimit` | Stream `onError` returns `error.message` |
| `/api/ai/remy` | POST | Protected | None | `checkLlmMessageLimit` | Accepts client `tools`; unvalidated body |
| `/api/ai/speech` | POST | Protected | Manual | `checkLlmMessageLimit` | Good error sanitization |
| `/api/ai/export-prompt` | POST | Protected | `ExportPromptRequestSchema` | `checkLlmMessageLimit` | Telemetry excludes `sourceText` |
| `/api/ai/ideas` | POST | Partial | None | None | Stub (`Hello, world!`) |
| `/api/ai/tts` | POST | **Partial** | Manual | **None** | Proxy-only auth |
| `/api/ai/tts-v2` | POST | **Partial** | Manual | **None** | LLM + ElevenLabs |
| `/api/ai/tts/stream` | POST | **Partial** | Manual | **None** | SSE TTS |
| `/api/ai/tts/transform` | POST | **Partial** | Manual | **None** | LLM-only |
| `/api/profile/tree` | GET/POST/PATCH | Protected | Zod | Edit limits | PATCH may leak `error.message` |
| `/api/profile/summary` | POST | Protected | Zod | `checkProfileTreeGenerationLimit` | |
| `/api/profile/knowledge` | POST | Protected | Zod | `checkLlmMessageLimit` | |
| `/api/profile/knowledge/classify` | POST | Protected | Zod | `checkLlmMessageLimit` | |
| `/api/memory/lens-overview` | POST | Protected | Zod | `checkLlmMessageLimit` | **Explicit IDOR check** |
| `/api/homepage/plan-intent` | POST | Protected | Zod | `checkHomepageOllamaLimit` | |
| `/api/homepage/route-preview` | POST | Protected | Zod | `checkHomepageOllamaLimit` | |
| `/api/launcher/candidates` | GET | Protected | Query param | None | May return `error.message` on 500 |
| `/api/rabbitholes/[sessionId]/generate` | POST | Protected | Partial | `checkRabbitHoleNodeLimit` | No session ownership check |
| `/api/rabbitholes/[sessionId]/resume` | POST | Protected | Path param | None | No session ownership check |
| `/api/prototypes/strata` | POST | Protected | Zod | **None** | **No owner check** on `pageId` |
| `/api/prototypes/strata/ingest` | POST | Protected | Zod | `checkStrataIngestLimit` | Owner check + SSRF guard |
| `/api/prototypes/strata/link-block` | POST | Protected | Zod | `checkStrataIngestLimit` | Owner check |
| `/api/prototypes/strata/elaborated-speech-summary` | POST | Protected | Zod | **None** | Optional `pageId` not ownership-checked |
| `/api/prototypes/strata/clipboard-source-title` | POST | Protected | Zod | Limit | Owner check |
| `/api/prototypes/strata/[id]/generate-title` | POST | Protected | Zod | Limit | Owner check (403) |
| `/api/prototypes/strata/notes/yjs` | GET/POST | Protected | Zod + UUID | Limit | Owner check; 512KB cap |
| `/api/prototypes/wine-line-list` | POST | Protected | Manual | `checkLlmMessageLimit` | No chat ownership check |
| `/api/sandbox/memory-migration-test` | POST | Protected | Zod | Memory + LLM | May return internal errors |
| `/api/sandbox/topic-explore/*` (4) | POST | Protected | Zod | Via gate | Good pattern |
| `/api/status` | GET | Protected | Query | None | Admin gate |
| `/api/webhooks/clerk` | POST | Public | `verifyWebhook` | N/A | Correct |
| `/api/good-news/cron` | GET/POST | Public | Bearer `CRON_SECRET` | N/A | `timingSafeEqual` |

---

## Critical Issues

### 1. `/api/chat/prometheus` — unprotected handler

```29:49:app/api/chat/prometheus/route.ts
export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();
  const res = await getContext({ chatId: id, message, persona: "prometheus" });
```

No `auth()`, no rate limit, no Zod schema. Can read/write arbitrary `id` chat threads subject to RLS.

### 2–5. TTS stack — proxy-only auth, no rate limits

All four TTS routes lack `auth()` and `checkLlmMessageLimit`. Any authenticated user can burn ElevenLabs/OpenAI quota.

---

## High Severity Issues

### Chat IDOR — ownership not verified in route handlers

Affected routes pass client-supplied `id` / `chatId` without comparing to authenticated user:

- `app/api/chat/route.ts`
- `app/api/chat/[id]/stream/route.ts`
- `app/api/chat/spark/route.ts`
- `app/api/chat/prometheus/route.ts`
- `app/api/prototypes/wine-line-list/route.ts`
- `app/api/ai/remy/route.ts`
- `app/api/ai/aion/route.ts` (via `lib/api/aion-handler.ts`)

Mitigation today is **Supabase RLS**. If RLS is misconfigured, these become direct IDOR.

**Best IDOR pattern in codebase:**

```68:77:app/api/memory/lens-overview/route.ts
  for (const id of memoryIds) {
    const text = byId.get(id);
    if (text === undefined) {
      return Response.json({ error: "Invalid memory selection" }, { status: 403 });
    }
```

### Rabbit hole session IDOR

- `generate/route.ts` — schedules generation for any readable `sessionId`
- `resume/route.ts` — `getSessionById` with no explicit `owner_id` comparison

### Strata generate — missing owner check

Unlike `ingest`, `link-block`, and `yjs`, `prototypes/strata/route.ts` does not compare `pageData.page.owner_id` to `sbUserId` when `pageId` is provided.

### Aion handler leaks tool/step internals

```275:284:lib/api/aion-handler.ts
          onStepFinish(step: any) {
            writer.write({
              type: "data-notification",
              data: { message: `STEP_FINISH ${JSON.stringify(step, null, 2)}` },
```

Full step objects sent to the browser.

### Remy — unvalidated body

Accepts raw `system` string and `tools` object from client JSON with no length/schema bounds.

### Server actions — no explicit `auth()`

`app/actions/tasks.ts` and `app/actions/ideas.ts` rely on proxy + RLS only. `patch: any` at action boundary.

---

## Medium Severity Issues

### Missing rate limits on expensive routes

| Route | Cost |
|-------|------|
| `prototypes/strata/route.ts` | 2× LLM calls |
| `prototypes/strata/elaborated-speech-summary/route.ts` | LLM script generation |
| `rabbitholes/.../resume/route.ts` | Full generation pipeline |
| `launcher/candidates/route.ts` | DB reads |
| All TTS routes | Third-party + LLM |

### Error / info leakage

| Location | Leak |
|----------|------|
| `launcher/candidates/route.ts` | `res.error.message` in 500 |
| `profile/tree/route.ts` | `result.error?.message` in 500 |
| `chat/[id]/generate-title/route.ts` | `result.error.message` |
| `prototypes/strata/route.ts` | `err.message` in 500 |
| `ai/core/route.ts` | `error.message` in UI stream |
| `ai/tts/stream/route.ts` | `error.message` in SSE |

### Zod `flatten()` in 400 responses

Multiple Strata routes return `details: parsed.error.flatten()` — reveals field names/constraints.

---

## IDOR Assessment Summary

| Resource | Route-level check? | Mitigation |
|----------|-------------------|------------|
| Chat threads | Partial | Supabase RLS + Clerk JWT |
| Memories | **Yes** (lens-overview) | Ownership snapshot |
| Strata pages | Mixed | RLS + some explicit checks |
| Rabbit holes | No | RLS on `getSessionById` |
| Profile tree | Via `*ForCurrentUser` | Clerk → profile resolution |
| Resumable streams | No | RLS on thread read |

---

## Server Actions Summary

| File | Auth in action | Validation | Rate limit | Risk |
|------|----------------|------------|------------|------|
| `tasks.ts` | Proxy only | Zod in data layer | None | Medium |
| `ideas.ts` | Proxy only | Zod in data layer | None | Medium |
| `ai-jobs.ts` | **`auth()`** | Function enum | None | Medium |

---

## Positive Patterns

1. `requireLlmChatActor()` — auth + profile + rate limit in one gate
2. Explicit `ownerId` filter on `/api/chats`
3. Strata ownership checks on ingest, link-block, yjs, clipboard-title, generate-title
4. SSRF protection via `assertSafePublicHttpsUrl`
5. Cron auth with `timingSafeEqual`
6. Webhook verification via Clerk `verifyWebhook`
7. Export prompt telemetry never logs `sourceText`
8. Yjs payload cap (512KB)
9. Centralized Upstash rate limits
