# Recommendations Roadmap

Consolidated, deduplicated action plan from all audit domains. Items are grouped by priority tier.

---

## P0 — Immediate (security & cost abuse)

| # | Action | Domain | Effort |
|---|--------|--------|--------|
| 1 | **Sanitize `articleHtml`** before `dangerouslySetInnerHTML` in `RabbitHoleArticle.tsx` (DOMPurify allowlist) | XSS | Small |
| 2 | **Change Mermaid to `securityLevel: "strict"`** + DOMPurify or sandboxed iframe | XSS | Small |
| 3 | **Apply URL safety to rabbit-hole fetch** — reuse `assertSafePublicHttpsUrl` + DNS/IP validation in `lib/exa/sources.ts` | SSRF | Medium |
| 4 | **Add `auth()` + TTS rate limits** to all four TTS routes (`tts`, `tts-v2`, `tts/stream`, `tts/transform`) | Auth/Cost | Small |
| 5 | **Harden or remove `/api/chat/prometheus`** — add `requireLlmChatActor`, Zod schema, rate limit | Auth/Cost | Small |
| 6 | **Gate sandbox on admin** — default `getShowSandboxGateway` to `false`; enforce in `proxy.ts` for `/sandbox` and `/api/sandbox/*` | Auth | Medium |
| 7 | **Make memory encryption required in production** — fail startup/health if `MEMORY_ENCRYPTION_*` unset | Encryption | Small |
| 8 | **Add security headers and CSP** in `next.config.js` | Infra | Medium |

---

## P1 — High priority (defense-in-depth & architecture)

| # | Action | Domain | Effort |
|---|--------|--------|--------|
| 9 | **Add `assertThreadOwned(chatId, sbUserId)`** helper; use in all chat routes before save/read/stream | IDOR | Medium |
| 10 | **Add `owner_id` check to `prototypes/strata/route.ts`** when `pageId` provided | IDOR | Small |
| 11 | **Verify rabbit-hole session ownership** before generate/resume | IDOR | Small |
| 12 | **Remove Aion step JSON from client notifications** — log server-side only | Info leak | Small |
| 13 | **Add Zod schemas to remy, spark, wine-line-list**; bound `system` string length | Validation | Medium |
| 14 | **Add `auth()` to server actions** (`tasks.ts`, `ideas.ts`) | Auth | Small |
| 15 | **Consolidate chat routes** — make `/api/chat` + `runLLMChatStream` the single production path | Architecture | Large |
| 16 | **Fix inverted dependency** — move `RabbitHoleSessionMetadata` to `lib/schemas/` | Architecture | Small |
| 17 | **Remove dead code** — `data/local/rabbitholes.ts`, `new-chat.tsx`, `new-chat-new.tsx`, `getMessagesForChatPrompt` | Hygiene | Small |
| 18 | **Expand CI** — add `lint:check`, `next build`, `bun audit` | CI | Small |
| 19 | **Add integration test for `/api/chat`** | Testing | Medium |
| 20 | **Remove npm `crypto` and `fs` packages** | Supply chain | Trivial |
| 21 | **Remove unused deps** — `@blocknote/*`, `radix-ui`, `remark-directive*` | Supply chain | Small |
| 22 | **Fix documentation** — split chat vs memory crypto on `/blog/memory-encryption` | Docs | Small |
| 23 | **Strengthen `ORGANIC_LLM_ROOT_SECRET` validation** — minimum 32 random bytes | Encryption | Small |
| 24 | **Replace proxy in-memory rate limit** with Upstash | Rate limit | Small |
| 25 | **Replace Strata `(supabaseServer()) as any`** with typed queries | TypeScript | Medium |

---

## P2 — Medium priority (quality & operations)

| # | Action | Domain | Effort |
|---|--------|--------|--------|
| 26 | Rate-limit `prototypes/strata/route.ts`, `elaborated-speech-summary`, `rabbitholes/resume` | Cost | Small |
| 27 | Sanitize all 500/stream errors — generic client message, log server-side | Info leak | Medium |
| 28 | Remove Zod `flatten()` from 400 responses in production | Info leak | Small |
| 29 | Delete or protect `/api/ai/ideas` stub | Hygiene | Trivial |
| 30 | Standardize error handling via `serializeError` across all API routes | Quality | Medium |
| 31 | Replace `z.any()` in chat/llm-context schemas with UIMessage Zod schema | TypeScript | Medium |
| 32 | Implement or remove knowledge-graph stubs (`strata-knowledge-graph-tools.ts`) | Tech debt | Medium |
| 33 | Remove `console.log("TOOL_CALL")` from `chat-experimental.tsx` | Hygiene | Trivial |
| 34 | Per-user memory keys + contextual AAD for memory encryption | Encryption | Large |
| 35 | Ship memory key rotation script (scroll Qdrant, `reencryptMemory`) | Encryption | Medium |
| 36 | Expose wipe-all memory in Settings wired to `wipeMemoryForCurrentUser` | Product | Small |
| 37 | Require `MEMORY_API_SECRET` when Qdrant host is not localhost | Security | Small |
| 38 | Unify Qdrant client factories (HTTPS config mismatch) | Config | Small |
| 39 | Commit Supabase RLS migrations for `threads`/`messages` to repo | Auditability | Small |
| 40 | Configure Mem0/OpenAI for ZDR on fact extraction | Privacy | Small |
| 41 | Remove/downgrade `addInteractionToMemory` result logging | Privacy | Trivial |
| 42 | Frozen lockfile in `prebuild` and morph-physics CI | Supply chain | Trivial |
| 43 | Add `.github/dependabot.yml` | Supply chain | Trivial |
| 44 | Pin Bun version in CI (not `latest`) | CI | Trivial |
| 45 | Re-enable `react-hooks/exhaustive-deps` incrementally | React | Medium |
| 46 | Parallelize Strata section upserts and legacy context fetches | Performance | Small |
| 47 | Dynamic-import `mermaid` in blog component | Performance | Small |
| 48 | Split morph-physics Three dependency to webgl subpath only | Bundle | Medium |

---

## P3 — Longer-term (strategic)

| # | Action | Domain | Effort |
|---|--------|--------|--------|
| 49 | KMS/HSM for root secrets | Encryption | Large |
| 50 | Qdrant collection-level or per-tenant ACLs | Security | Large |
| 51 | Replace VectorStoreFactory monkey-patch with upstream hook | Maintainability | Medium |
| 52 | Replace rabbit-hole polling with Supabase Realtime or SSE | Performance | Large |
| 53 | Consolidate TTS routes behind single versioned API | Architecture | Medium |
| 54 | Add Playwright e2e to CI (or nightly) | Testing | Medium |
| 55 | Add tests for `profile-generation`, `exa/client`, `remy/thread-matching`, `good-news/pipeline` | Testing | Medium |
| 56 | Add CodeQL for JavaScript/TypeScript | Security | Small |
| 57 | Add `eslint-plugin-security` | Security | Small |
| 58 | Memory export API with same auth boundary as list/delete | Product | Medium |
| 59 | Clerk webhook idempotency by `svix-id` | Reliability | Small |
| 60 | Document env tiers (demo-only vs full local vs production) | Docs | Small |

---

## Quick Wins (< 1 hour each)

- Remove `crypto` and `fs` npm packages
- Delete `/api/ai/ideas` stub
- Remove `console.log` from production paths
- Add `auth()` to server actions
- Default `getShowSandboxGateway` to `false`
- Add `bun audit` to CI
- Pin Bun version in workflows
- Remove unused `@blocknote/*` and `radix-ui` deps

---

## Risk Matrix

```
                    LOW EFFORT          HIGH EFFORT
                 ┌─────────────────┬─────────────────┐
    HIGH IMPACT  │ P0: XSS, SSRF,  │ P1: Consolidate │
                 │ TTS auth, CSP,  │ chat routes,    │
                 │ sandbox gate    │ per-user memory │
                 ├─────────────────┼─────────────────┤
    LOW IMPACT   │ P2: Logging,    │ P3: KMS,        │
                 │ dead code, CI   │ Realtime, e2e   │
                 └─────────────────┴─────────────────┘
```

---

## Tracking

When implementing fixes, consider creating GitHub issues grouped by P0/P1/P2 with cross-references to the detailed reports in this folder:

- [Security Vulnerabilities](./security-vulnerabilities.md)
- [API Routes & Authorization](./api-routes-auth.md)
- [Memory & Encryption](./memory-encryption.md)
- [Code Quality & Architecture](./code-quality-architecture.md)
- [Dependencies & Supply Chain](./dependencies-supply-chain.md)
