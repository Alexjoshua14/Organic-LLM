# Security Vulnerabilities

Read-only review of authentication, authorization, injection, SSRF, rate limiting, and encryption weaknesses.

---

## Severity Summary

| Severity | Count |
|----------|------:|
| Critical | 0* |
| High | 4 |
| Medium | 6 |
| Low | 4 |
| Info (positive) | 5 |

\* XSS findings in rabbit-hole HTML and Mermaid are rated Critical in the dependencies audit due to exploitability; this report rates stored XSS in rabbit holes as Medium (self-XSS minimum unless articles are shared).

---

## High Severity

### H-1: TTS endpoints lack authentication checks and rate limiting

**Files:**
- `app/api/ai/tts/route.ts` (lines 19–117)
- `app/api/ai/tts-v2/route.ts` (lines 56–249)
- `app/api/ai/tts/stream/route.ts` (lines 34–236)
- `app/api/ai/tts/transform/route.ts` (lines 15–53)

**Description:** Handlers accept arbitrary text and call ElevenLabs and/or LLM transforms. None call `auth()`, `requireLlmChatActor()`, or any rate limiter. Compare with `app/api/ai/speech/route.ts`, which does both.

**Impact:** Any authenticated user can burn ElevenLabs and LLM quota at scale. `tts-v2` caches responses in-process for 7 days, amplifying storage use per instance.

**Recommendation:** Add `requireLlmChatActor()` or equivalent, plus a dedicated TTS rate limit (chars/minute or requests/hour).

---

### H-2: Legacy Prometheus chat route lacks auth and rate limiting

**File:** `app/api/chat/prometheus/route.ts` (lines 29–93)

**Description:** `POST` streams from OpenAI with no `auth()`, no `checkLlmMessageLimit()`, and no ownership check on `id`. Protection relies solely on `proxy.ts` middleware.

**Impact:** Authenticated users can invoke an unmonitored LLM path outside the standard chat rate-limit bucket.

**Recommendation:** Deprecate or align with main chat: add `requireLlmChatActor()`, verify thread ownership, share rate-limit infrastructure. Remove if unused.

---

### H-3: Server-side SSRF in rabbit-hole webpage fetch

**Files:**
- `lib/exa/sources.ts` (lines 55–108)
- `lib/rabbit-holes/actions.ts` (lines 198–215)
- `app/rabbitholes/actions.ts` (similar `analyzeSource` path)

**Description:** `getWebpageContent(sourceUrl)` falls back to `fetch(sourceUrl, …)` with no `assertSafePublicHttpsUrl()` (used elsewhere in Strata). `analyzeSource` passes user-controlled `sourceUrl` directly.

```77:85:lib/exa/sources.ts
  if (!webpageContent) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });
```

**Impact:** Authenticated users can probe internal networks (`169.254.169.254`, `127.0.0.1`, RFC1918) from the server.

**Recommendation:** Reuse `assertSafePublicHttpsUrl()` before any direct fetch; resolve hostnames and block private/reserved IPs (DNS rebinding mitigation). Prefer Exa-only fetching.

---

### H-4: Sandbox/lab APIs accessible to all authenticated users

**Files:**
- `proxy.ts` (lines 7–17, 54–65) — `/sandbox(.*)` requires sign-in only
- `data/supabase/profiles.ts` (lines 374–385) — `getShowSandboxGateway` defaults to `true`
- `app/api/sandbox/memory-migration-test/route.ts`
- `app/api/sandbox/topic-explore/*/route.ts`

**Description:** README describes sandbox as an "internal lab," but `getShowSandboxGateway` returns `true` when profile is missing and when `admin !== false` (unset admin = allowed). Only `/api/status?deep=1` checks admin.

**Impact:** Any Clerk user can run memory migration tests, topic-explore LLM flows, and experimental features.

**Recommendation:** Enforce `getShowSandboxGateway()` (default **deny**) in `proxy.ts` for `/sandbox` and `/api/sandbox/*`. Change default to `admin === true` only.

---

## Medium Severity

### M-1: Stored XSS risk — LLM HTML via `dangerouslySetInnerHTML`

**Files:**
- `app/rabbitholes/_components/RabbitHoleArticle.tsx` (lines 312–316)
- `lib/system-prompt/rabbit-hole.ts` (lines 1–39)
- `lib/schemas/rabbitHoleSchemas.ts` (lines 64–67)

**Description:** LLM-generated `articleHtml` is injected without server- or client-side HTML sanitization. Prompts discourage `<script>`/`<iframe>`, but that is not enforcement.

**Impact:** Prompt injection or model failure could emit `<img onerror=…>`, `<svg onload=…>`, or `javascript:` hrefs → stored XSS.

**Recommendation:** Sanitize with DOMPurify (allowlist: `h2`, `h3`, `p`, `span`, `em`, `strong`, `a` with safe `href`).

---

### M-2: Defense-in-depth — middleware-only protection on sensitive routes

**Files:** `proxy.ts`, TTS routes, `app/api/chat/prometheus/route.ts`, `app/api/ai/ideas/route.ts`

**Description:** Post–Next.js 16 guidance recommends not relying solely on proxy/middleware for authorization. Several routes have no route-level `auth()`.

**Impact:** Proxy bypass bugs or misconfiguration could expose endpoints. Not a confirmed current bypass.

**Recommendation:** Add `auth()` / `requireLlmChatActor()` in every `/api` handler.

---

### M-3: Chat stream resume lacks explicit thread ownership check

**File:** `app/api/chat/[id]/stream/route.ts` (lines 11–45)

**Description:** `GET` verifies Clerk session and calls `readChat(id)` but never compares `thread.owner_id` to the caller's Supabase user ID.

**Impact:** If Supabase RLS is misconfigured, an attacker could resume another user's active stream by UUID.

**Recommendation:** After `readChat`, verify `thread.owner_id === sbUserId` and return 403 on mismatch.

---

### M-4: Strata SSRF guard does not mitigate DNS rebinding

**Files:** `lib/strata/safe-url.ts` (lines 68–104), `lib/strata/fetch-url-exa.ts`

**Description:** Validation checks literal hostname strings but does not resolve DNS and validate the resulting IP before fetch.

**Impact:** Hostname resolving to internal IP after validation could bypass literal checks.

**Recommendation:** Resolve hostname at request time; block private/link-local/metadata IPs.

---

### M-5: Sandbox admin flag defaults permissive

**File:** `data/supabase/profiles.ts` (lines 379–384)

```379:384:data/supabase/profiles.ts
export async function getShowSandboxGateway(clerkUserId: string): Promise<boolean> {
  const result = await getProfile(clerkUserId);
  if (result.error || !result.data) return true;
  return result.data.admin !== false;
}
```

**Impact:** Users without a profile row, or with `admin` unset/null, are treated as admins for UI gateway purposes.

**Recommendation:** Default to `false`; require explicit `admin: true`.

---

### M-6: Message encryption accepts low-entropy root secrets

**Files:** `lib/crypto/message-encryption.ts` (lines 63–85, 168–203), `.env.example` (lines 41–47)

**Description:** `ORGANIC_LLM_ROOT_SECRET` is accepted as any non-empty UTF-8 string. Unlike `memory-encryption.ts` (requires ≥32 bytes of base64 random material), there is no minimum entropy requirement.

**Impact:** Weak dev/passphrase secrets undermine AES-256-GCM protection for chat messages at rest in production.

**Recommendation:** Enforce minimum 32 random bytes (base64-encoded, matching memory encryption).

---

## Low Severity

### L-1: Proxy `/chat` rate limiter is in-memory and uses spoofable identifier

**File:** `proxy.ts` (lines 24–48)

In-memory `Map` keyed on `x-clerk-user-id` or `x-forwarded-for`. Not distributed across instances; ineffective on serverless.

**Recommendation:** Use Upstash (as elsewhere) and derive identity from Clerk session inside the proxy.

---

### L-2: Rabbit-hole session routes rely on RLS without explicit ownership checks

**Files:** `app/api/rabbitholes/[sessionId]/generate/route.ts`, `app/api/rabbitholes/[sessionId]/resume/route.ts`

Routes authenticate but do not verify `sessionId` belongs to the caller before scheduling/resuming generation.

---

### L-3: Upstash rate-limit failures cause HTTP 500 (fail-closed)

**File:** `lib/rate-limit/run-limiter.ts` (lines 20–30)

Good for security; bad for availability during Redis outages.

---

### L-4: `deleteMessage` has no caller-side auth wrapper

**Files:** `data/supabase/chat.ts` (lines 950–964), `lib/chat/chat-store.ts` (lines 313–342)

Deletes by `messageId` only, relying on Supabase RLS.

---

## Positive Security Practices

| Practice | Location |
|----------|----------|
| Global auth proxy | `proxy.ts` — Clerk `auth.protect()` on product routes and `/api/*` |
| Central LLM gate | `lib/api/chat-llm-gate.ts` |
| Upstash rate limits | `lib/rate-limit/*` across LLM, memory, profile, Strata |
| Chat/message encryption | Per-user HKDF, contextual AAD, AES-256-GCM |
| Strata input safety | `lib/strata/input-safety.ts` |
| No raw SQL | Supabase client with parameterized queries |
| Secrets hygiene | `.env.example` documents vars without real values |
| Safe markdown rendering | `react-markdown` without `rehype-raw` in chat |
| Cron endpoint secured | `timingSafeEqual` + fail-closed when secret unset |
| Clerk webhook verification | `verifyWebhook(req)` in `app/api/webhooks/clerk/route.ts` |
| Admin message upsert validates ownership | `data/supabase/chat-admin.ts` |

---

## Areas Reviewed With No Confirmed Issue

| Area | Notes |
|------|-------|
| SQL injection | Supabase query builder only |
| Hardcoded API keys | No live secrets in source |
| CORS/CSRF | No custom permissive CORS; cookie-based Clerk sessions |
| Client secret exposure | Only `NEXT_PUBLIC_*` keys in client code |
