# Organic LLM — Full Audit Report

**Audit date:** June 17, 2026  
**Scope:** `/workspace` (Organic LLM v0.5.0)  
**Method:** Read-only review via parallel specialized audits — no source code was modified.

## Purpose

This folder contains a comprehensive audit of the Organic LLM codebase covering security vulnerabilities, API/auth posture, memory/encryption architecture, code quality, dependencies, and infrastructure. Findings are organized by domain with severity ratings and actionable recommendations.

## Reports

| Report | Description |
|--------|-------------|
| [Executive Summary](./executive-summary.md) | Top-level findings, severity counts, and priority remediation order |
| [Security Vulnerabilities](./security-vulnerabilities.md) | Auth bypass surfaces, SSRF, XSS, rate limiting, sandbox exposure |
| [API Routes & Authorization](./api-routes-auth.md) | Per-route auth status, IDOR risks, input validation |
| [Memory & Encryption](./memory-encryption.md) | Qdrant/Mem0 crypto model, key management, docs vs implementation |
| [Code Quality & Architecture](./code-quality-architecture.md) | Module boundaries, TypeScript, tests, tech debt, CI gaps |
| [Dependencies & Supply Chain](./dependencies-supply-chain.md) | npm packages, XSS render paths, security headers, CI |
| [Recommendations Roadmap](./recommendations-roadmap.md) | Consolidated prioritized action plan |

## Severity Legend

| Level | Meaning |
|-------|---------|
| **Critical** | Exploitable vulnerability or immediate production risk |
| **High** | Significant security, cost-abuse, or reliability risk |
| **Medium** | Defense-in-depth gaps, documentation mismatches, moderate risk |
| **Low** | Minor issues, hygiene items, or risks mitigated by other controls |
| **Info** | Positive practices or informational notes |

## Aggregate Severity Counts

| Severity | Security | API/Auth | Memory | Code Quality | Dependencies | **Total (deduplicated)** |
|----------|----------|----------|--------|--------------|--------------|--------------------------|
| Critical | 0 | 5 routes* | 0† | 0 | 2 | **2** |
| High | 4 | 8+ | 4 | 4 | 7 | **~18** |
| Medium | 6 | 10+ | 8 | 10+ | 8 | **~25** |
| Low | 4 | Several | 4 | 6+ | 6 | **~15** |
| Info | 5 | — | 5+ | — | 6 | **~10** |

\* API audit counts unprotected TTS routes and legacy Prometheus as Critical at the route level; deduplicated security report rates them High (middleware still applies).  
† Memory encryption is optional in code — becomes Critical if unset in production.

## Key Themes

1. **Defense-in-depth gaps** — Clerk proxy protects most routes, but several expensive handlers lack route-level `auth()` and rate limits.
2. **SSRF in rabbit-hole URL fetching** — Direct `fetch(sourceUrl)` without the Strata-style URL safety checks.
3. **Sandbox overexposure** — Any signed-in user can access internal lab routes; admin flag defaults permissive.
4. **XSS surfaces** — LLM-generated HTML (`RabbitHoleArticle`) and Mermaid `securityLevel: "loose"` are the highest-risk render paths.
5. **Memory crypto ≠ chat crypto** — Blog/docs conflate per-user message encryption with global optional memory encryption.
6. **Architectural drift** — Multiple parallel chat/LLM route stacks, inverted type dependencies, dead modules.
7. **CI gaps** — No lint, build, audit, or e2e in the main workflow.

## Positive Highlights

- Centralized LLM gate (`requireLlmChatActor`) on modern chat routes
- Memory boundary enforced via ESLint (`operations` vs `store`)
- Strong chat message encryption (per-user HKDF + contextual AAD)
- Clerk webhook verification, cron bearer-token gating with `timingSafeEqual`
- Strata ingest SSRF controls and ownership checks
- Explicit memory IDOR check in lens-overview route
- morph-physics package is well-isolated with its own CI

## Next Steps

See [Recommendations Roadmap](./recommendations-roadmap.md) for a prioritized remediation plan. This audit is informational only — no code changes were made during the review.
