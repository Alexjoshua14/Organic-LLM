# Dependencies & Supply Chain Audit

Review of `package.json`, `bun.lock`, `.env.example`, `vercel.json`, `next.config.js`, `.github/workflows`, and XSS-relevant render paths.

---

## Severity Summary

| Severity | Count | Top themes |
|----------|-------|------------|
| Critical | 2 | LLM HTML unsanitized; Mermaid `securityLevel: "loose"` |
| High | 7 | No security headers; fake npm `crypto`/`fs`; CI gaps; unused deps |
| Medium | 8 | Clerk rate-limit bypass; duplicate lockfile risk; env blast radius |
| Low | 6 | Hygiene / informational |
| Positive | 6 | Good patterns observed |

---

## Critical Findings

### C-1: RabbitHoleArticle — unsanitized LLM HTML

```312:315:app/rabbitholes/_components/RabbitHoleArticle.tsx
      <div
        dangerouslySetInnerHTML={{ __html: articleHtml }}
        ref={articleRef}
```

- `articleHtml` is LLM-generated, stored in Supabase, validated only as `z.string()`
- Prompt forbids `<script>`, `<style>`, `<iframe>`, `<img>` but **allows `<a>`** with no `href` scheme restriction
- No DOMPurify before render

**Recommendation:** Sanitize with allowlist; restrict `a` hrefs to `https?` only.

### C-2: Mermaid `securityLevel: "loose"` + `innerHTML`

```231:251:components/blog/mermaid-diagram.tsx
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
      });
      containerRef.current.innerHTML = svgMarkup;
```

- **`securityLevel: "loose"`** allows HTML in `foreignObject` nodes — classic Mermaid XSS vector
- Used for LLM-generated Mermaid in chat (`make_mermaid_diagram` tool) — untrusted input
- `stripSecurityLevelInitDirectives` blocks `%%init` overrides but does not fix loose-mode HTML injection

**Recommendation:** Use `securityLevel: "strict"` with DOMPurify; or sandboxed iframe rendering.

---

## High Severity Findings

### H-1: No security headers or CSP

`next.config.js` and `vercel.json` have no `headers()`, CSP, `X-Frame-Options`, HSTS, `Referrer-Policy`, or `Permissions-Policy`. `vercel.json` only defines a cron.

**Recommendation:** Add security headers in `next.config.js` or Vercel project settings.

### H-2: Deprecated npm `crypto@1.0.1` package

**File:** `package.json:81`

Official npm placeholder ("npm is no longer shipping Node core modules"). Not imported anywhere; all code uses Node built-in `import … from "crypto"`.

**Recommendation:** Remove from dependencies.

### H-3: Placeholder `fs@0.0.1-security` package

**File:** `package.json:85`

Same pattern as `crypto`. No app imports from npm `fs`.

**Recommendation:** Remove from dependencies.

### H-4: Unused heavy dependencies

No source imports found for:

- `@blocknote/core`, `@blocknote/react`, `@blocknote/shadcn`
- `radix-ui` meta-package (app uses individual `@radix-ui/*`)
- `remark-directive`, `remark-directive-rehype`

Large transitive trees with zero runtime use.

### H-5: `prebuild` runs unfrozen nested install

```8:8:package.json
"prebuild": "cd llm/morph-physics && bun install && bun run build"
```

No `--frozen-lockfile`. Every production build can resolve new transitive versions.

### H-6: No dependency audit in CI

`.github/workflows/test.yml` only runs tests. No `bun audit`, OSV-Scanner, or CodeQL. `SECURITY.md` references Dependabot but **no `.github/dependabot.yml` exists**.

### H-7: Morph-physics CI unfrozen

`morph-physics.yml` runs `bun install` without `--frozen-lockfile`.

---

## Medium Severity Findings

### M-1: `streamdown` pulls `rehype-raw` (latent XSS)

`streamdown@1.6.11` pulls `rehype-raw`, `mermaid`, `marked`. Only used via `ReasoningContent` which is **not imported anywhere** in production. Dead attack surface today.

### M-2: Duplicate `mermaid` versions in lockfile

Direct `mermaid@11.15.0`; nested `streamdown/mermaid@11.12.2`.

### M-3: In-memory `/chat` rate limit in proxy

**File:** `proxy.ts:24-48`

Comment says "use Redis in production"; still uses `Map` + `x-forwarded-for`. Ineffective on serverless, spoofable.

### M-4: `mem0ai@2.4.6` large transitive tree

Brings `axios`, `openai`, and many optional peer deps. Pin and audit if production-critical.

### M-5: `bun-version: "latest"` in CI

Non-reproducible CI builds.

### M-6: No lint in CI

`lint:check` exists in `package.json` but not run in workflows.

### M-7: Clerk webhook minimal handler

Only handles `user.created`; no visible idempotency/dedup by `svix-id`.

### M-8: Environment variable blast radius

`.env.example` documents many high-privilege secrets (`CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, encryption keys). Well documented but high blast radius if leaked.

---

## Low Severity Findings

| Finding | Details |
|---------|---------|
| `marked` used only as lexer | Rendering via `react-markdown` — safe |
| `react-syntax-highlighter` | Code as text children — safe in current usage |
| `ngrok` in script but not a dependency | `webhook:local` calls `ngrok http 3000` |
| `.npmrc` has `package-lock=true` | Project uses `bun.lock` |
| No `eslint-plugin-security` | No automated secret/XSS lint rules |
| Transitive `napi-postinstall` | Via ESLint toolchain — standard |

---

## XSS Render Path Assessment

| Library | Usage | Risk |
|---------|-------|------|
| `react-markdown` + `remark-gfm` | Chat messages | **Low** — no `rehype-raw` |
| `marked` | Block splitting lexer only | **Low** |
| `react-syntax-highlighter` | Blog + code blocks | **Low** — escaped text |
| `mermaid` | Blog + chat diagrams | **Critical** — loose mode + innerHTML |
| `dangerouslySetInnerHTML` | Rabbit hole articles | **Critical** — raw LLM HTML |
| `streamdown` / `rehype-raw` | Unused Reasoning UI | **Medium (latent)** |

---

## Positive Practices

| Practice | Location |
|----------|----------|
| Frozen lockfile in main test CI | `.github/workflows/test.yml` |
| No root postinstall scripts | `package.json` |
| No malicious packages in lockfile | `bun.lock` audit |
| Gen-UI URL hardening | `lib/schemas/gen-ui/shared.ts` — blocks `javascript:` |
| Strata input sanitization | `lib/strata/input-safety.ts` |
| Cron auth | `timingSafeEqual` + fail-closed |
| Chat encryption | `ORGANIC_LLM_ROOT_SECRET` for at-rest messages |
| Clerk webhook verification | `verifyWebhook(req)` |
| Version pinning via overrides | `react@19.2.0`, `@qdrant/js-client-rest@1.17.0` |

---

## Clerk Integration

| Item | Status |
|------|--------|
| Version | `@clerk/nextjs@6.39.5` (current v6 line) |
| Middleware | `proxy.ts` with `clerkMiddleware` + `auth.protect()` |
| Protected routes | APIs, chat, rabbitholes, sandbox, settings, etc. |
| Public exceptions | `/api/webhooks/*`, `/api/good-news/cron` |
| Webhooks | `verifyWebhook(req)` — correct |
| Provider | `ClerkProvider` in `app/layout.tsx` |

---

## CI Recommendations

1. Pin Bun version (not `latest`)
2. Add `bun audit` (fail on high/critical)
3. Run `bun run lint:check`
4. Add `bun run build`
5. Add `.github/dependabot.yml`
6. Consider CodeQL for JavaScript/TypeScript
7. Use `--frozen-lockfile` in morph-physics CI and prebuild
