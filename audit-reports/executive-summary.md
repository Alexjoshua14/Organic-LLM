# Executive Summary

## Overview

Organic LLM is a Next.js 16 application with Clerk authentication, Supabase persistence, Mem0/Qdrant long-term memory, and extensive AI integrations (OpenAI, ElevenLabs, Exa). The codebase demonstrates strong engineering in several areas — memory boundary enforcement, chat encryption, centralized rate limiting on newer routes — but has accumulated security and architectural debt, particularly around legacy API routes, sandbox access controls, and documentation that overstates memory encryption guarantees.

**Overall risk posture:** Moderate. No confirmed unauthenticated bypass was found (Clerk `proxy.ts` protects `/api/*` except webhooks and cron), but authenticated abuse vectors (cost exhaustion, SSRF, XSS) and over-reliance on Supabase RLS without route-level ownership checks create meaningful risk.

---

## Top 10 Findings (by priority)

| # | Severity | Finding | Primary files |
|---|----------|---------|---------------|
| 1 | **Critical** | LLM-generated HTML rendered via `dangerouslySetInnerHTML` without sanitization | `app/rabbitholes/_components/RabbitHoleArticle.tsx` |
| 2 | **Critical** | Mermaid `securityLevel: "loose"` + `innerHTML` on LLM/user content | `components/blog/mermaid-diagram.tsx` |
| 3 | **High** | Server-side SSRF in rabbit-hole webpage fetch (no URL safety checks) | `lib/exa/sources.ts`, `lib/rabbit-holes/actions.ts` |
| 4 | **High** | TTS endpoints lack route-level auth and rate limits (ElevenLabs/LLM cost abuse) | `app/api/ai/tts*/route.ts` |
| 5 | **High** | Sandbox/lab accessible to all authenticated users (admin defaults permissive) | `proxy.ts`, `data/supabase/profiles.ts` |
| 6 | **High** | Memory encryption optional — plaintext Qdrant if env vars unset | `lib/memory/install-mem0-vector-encryption.ts` |
| 7 | **High** | No security headers or CSP configured | `next.config.js`, `vercel.json` |
| 8 | **High** | Legacy `/api/chat/prometheus` — no handler auth, validation, or rate limits | `app/api/chat/prometheus/route.ts` |
| 9 | **Medium** | Blog/docs conflate chat encryption (per-user) with memory encryption (global) | `content/blog/memory-encryption.md` |
| 10 | **Medium** | Parallel chat/LLM route stacks with diverging behavior | `app/api/chat/`, `app/api/ai/` |

---

## Severity Distribution (deduplicated)

```
Critical  ██                    2
High      ██████████████████   ~18
Medium    █████████████████████████  ~25
Low       ███████████████      ~15
Info      ██████████           ~10
```

---

## Domain Scores

| Domain | Grade | Rationale |
|--------|-------|-----------|
| Authentication (global) | **B+** | Clerk middleware covers most routes; webhook/cron exceptions are correct |
| Authorization (per-resource) | **C** | Heavy RLS reliance; inconsistent route-level ownership checks |
| Input validation | **C+** | Strong on newer routes (Zod); weak on legacy chat/TTS/remy |
| Rate limiting | **B-** | Upstash on main paths; gaps on TTS, Prometheus, some Strata routes |
| Encryption at rest | **B** | Chat messages well-encrypted; memory encryption optional with weaker model |
| XSS prevention | **C-** | Markdown safe; rabbit-hole HTML and Mermaid are weak points |
| SSRF prevention | **C** | Strata has guards; rabbit-hole direct fetch does not |
| Code architecture | **C+** | Good lib/ structure; drift in chat routes and inverted dependencies |
| Test coverage | **C** | Strong unit tests in pockets; main `/api/chat` untested; no e2e in CI |
| CI/CD | **D+** | Tests only; no lint, build, audit, or e2e gates |

---

## What's Working Well

1. **`requireLlmChatActor()`** — Single gate combining auth, profile resolution, and LLM rate limits
2. **Memory operations boundary** — `lib/memory/operations.ts` as sole public API; ESLint enforces it
3. **Chat message encryption** — Per-user HKDF keys, contextual AAD, AES-256-GCM (`lib/crypto/message-encryption.ts`)
4. **Cron protection** — `CRON_SECRET` with `timingSafeEqual`; endpoint closed when secret unset
5. **Clerk webhooks** — `verifyWebhook()` from `@clerk/nextjs/webhooks`
6. **Memory IDOR pattern** — `lens-overview` validates memory IDs against ownership snapshot before LLM call
7. **Strata security** — URL safety checks, owner verification, ingest rate limits on newer endpoints
8. **morph-physics** — Clean package boundary with dedicated CI and good test coverage

---

## Immediate Actions (P0)

1. Sanitize `articleHtml` before `dangerouslySetInnerHTML` in rabbit-hole articles
2. Change Mermaid to `securityLevel: "strict"` and add DOMPurify or sandboxed rendering
3. Apply `assertSafePublicHttpsUrl` (plus DNS/IP validation) to `getWebpageContent`
4. Add `auth()` + dedicated TTS rate limits to all four TTS routes
5. Gate `/sandbox` and `/api/sandbox/*` on `profiles.admin === true` (default deny)
6. Make `MEMORY_ENCRYPTION_*` required in production (fail startup if unset)
7. Add security headers and CSP in `next.config.js`
8. Harden or remove `/api/chat/prometheus`

---

## Audit Methodology

Five parallel read-only audits were conducted:

- **Security** — Auth bypass, secrets, injection, SSRF, rate limits, webhooks, encryption
- **API routes** — All 42 `route.ts` files + 3 server action modules inventoried
- **Memory/encryption** — Full crypto stack, Mem0/Qdrant, docs vs implementation
- **Code quality** — Architecture, TypeScript, tests, performance, tech debt
- **Dependencies** — Supply chain, XSS render paths, CI, security headers

Supplementary manual review covered `proxy.ts`, RLS migration SQL in `docs/migrations/`, and `next.config.js`.
