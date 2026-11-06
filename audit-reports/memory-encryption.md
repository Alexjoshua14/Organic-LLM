# Memory & Encryption Audit

Organic LLM splits **chat persistence (Supabase)** from **long-term memory (Mem0 + Qdrant)**. Memory encryption is **optional**, uses a **different threat model** than chat encryption, and several **blog/privacy claims overstate** what the code guarantees.

---

## Architecture Overview

```
Client (Memory Lens / Chat UI)
    │
    ▼ server actions
lib/memory/operations.ts  ← sole public API (auth + rate limits + schema validation)
    │
    ▼
lib/memory/store.ts → mem0ai/oss Memory
    │
    ├─► EncryptedVectorStore (optional, monkey-patched)
    │       └─► lib/crypto/memory-encryption.ts → Qdrant
    ├─► OpenAI (fact extraction on ingest)
    └─► Ollama (embeddings)
```

**Contract (well implemented):**

- `operations.ts` is the only public server API for memory
- Identity resolved server-side only; client never sends `userId`
- All operations rate-limited in `lib/rate-limit/memory.ts`
- Results validated with Zod at boundary

**Boundary leak:** `app/api/sandbox/memory-migration-test/route.ts` imports `getAllMemories` from `store.ts` directly.

---

## Encryption Comparison: Chat vs Memory

| Property | Chat (`message-encryption.ts`) | Memory (`memory-encryption.ts`) |
|----------|-------------------------------|--------------------------------|
| Algorithm | AES-256-GCM | AES-256-GCM |
| Key model | Per-user HKDF from root secret | **Global** deployment key `MEMORY_ENCRYPTION_KEY_K{n}` |
| AAD | `{userId}:{threadId}:{fieldName}` | **Fixed** `"organic-llm-memory:v1"` |
| Wire format | `enc:v1:keyId:iv:tag:ciphertext` | `v1:k{n}:iv:tag:ciphertext` |
| Required in prod | Expected | **Optional** (env vars) |
| What's encrypted | Message content, summaries | `data`, `textLemmatized` only |
| What's plaintext | Thread titles, metadata | Embeddings, `userId`, hash, timestamps, metadata |

---

## High Severity Findings

### 1. Memory encryption is optional

```14:25:lib/memory/install-mem0-vector-encryption.ts
export function isMemoryEncryptionConfigured(): boolean {
  const current = process.env.MEMORY_ENCRYPTION_CURRENT_KEY?.trim();
  return Boolean(raw && raw.length > 0);
}
```

If `MEMORY_ENCRYPTION_*` is unset, Qdrant stores **plaintext** memory text. `.env.example` marks this as `[OPTIONAL]`.

**Recommendation:** Fail startup or health check if unset when memory is enabled in production.

### 2. Global memory keys — not per-user

One compromised `MEMORY_ENCRYPTION_KEY_K*` decrypts **all users'** memory text. Blog describes per-user HKDF keys — that applies to chat messages, not memory.

**Recommendation:** Derive per-user keys from root + `userId` (like messages) or envelope-encrypt a DEK per record.

### 3. OpenAI fact extraction on ingest

Default `memory.add()` uses `infer: true`, sending conversation text to OpenAI. No ZDR options configured in `config/mem0-config.ts`.

**Recommendation:** Configure Mem0/OpenAI for ZDR where supported, or document that fact extraction is not ZDR-aligned.

### 4. Qdrant shared API key — no store-level ACLs

`MEMORY_API_SECRET` grants full collection access. Defense relies on app-layer `userId` filtering and optional field encryption.

**Recommendation:** Require `MEMORY_API_SECRET` when host is not localhost; consider per-tenant collections.

---

## Medium Severity Findings

### 5. Blog/docs overstate memory crypto model

| Claim (blog) | Actual for memory | Actual for chat |
|--------------|-------------------|-----------------|
| Per-user HKDF keys | ❌ Global key | ✅ Per-user HKDF |
| AAD binds user/thread/field | ❌ Fixed AAD | ✅ Contextual AAD |
| Format `enc:v1:...` | ❌ Uses `v1:kN:...` | ✅ `enc:v1:...` |

Files: `content/blog/memory-encryption.md`, `memory-encryption-outro-content.tsx`

### 6. No automated memory key rotation job

`reencryptMemory()` exists in library with unit tests, but no batch scroll/re-encrypt script for Qdrant (unlike `migrate-memories-v2.ts` for collection migration).

### 7. Weak memory AAD

Ciphertext not bound to `userId`, memory id, or field name. Ciphertext swapping between records is not cryptographically prevented.

### 8. Mem0 VectorStoreFactory monkey-patch

```27:49:lib/memory/install-mem0-vector-encryption.ts
 * Coupled to mem0ai internals; an upstream vectorStoreWrapper hook would be preferable.
```

mem0ai upgrades could bypass or break the patch.

### 9. Wipe memory API without UI

`wipeMemoryForCurrentUser()` exists with strict rate limits (3/hour). Blog claims "wipe memory in the product." Settings shows per-card delete only — no wipe-all control.

### 10. Chat RLS policies not in repo

`data/supabase/chat.ts` asserts RLS on `threads`/`messages`, but no `CREATE POLICY` migrations for those tables exist in the repository. Rabbit hole and Strata RLS **are** documented in `docs/migrations/`.

### 11. Qdrant HTTPS config mismatch

`memory-qdrant-client.ts` sets `https: true` always; `qdrant-config.ts` uses HTTPS only when host ≠ localhost.

### 12. Privacy page "Mem0 Platform" wording

Code uses `mem0ai/oss` with self-hosted Qdrant + Ollama — not Mem0's hosted platform API.

---

## Low Severity Findings

| # | Finding | File |
|---|---------|------|
| 13 | `addInteractionToMemory` logs full results at info level | `lib/memory/store.ts:176` |
| 14 | Query rewriter logs raw/rewritten search strings | `lib/memory/query-rewriter.ts` |
| 15 | Delete ownership via `getAll` (limit 2000) — users with >2000 memories may fail to delete | `lib/memory/operations.ts` |
| 16 | `getMemoriesOwnershipSnapshotForUser` skips list rate limit | Intended for trusted routes |

---

## Data at Rest & In Transit

### At rest

| Store | Content | Protection |
|-------|---------|------------|
| Supabase `messages` | Chat content | `enc:v1:` per-user AES-GCM |
| Supabase `threads` | Titles, metadata | Plaintext (documented) |
| Qdrant `memories_v2` | Memory text | Optional `v1:kN:` AES-GCM |
| Qdrant | Embeddings, `userId` | Plaintext |
| In-process L1 cache | Search results | Per-user `enc:v1:` via message encryption |

### In transit

| Hop | Protection | Notes |
|-----|------------|-------|
| Browser ↔ Next.js | TLS (assumed) | Standard |
| Next.js ↔ Qdrant | HTTPS (remote) | Localhost config inconsistent |
| Next.js ↔ Ollama | HTTP default locally | Embeddings in plaintext |
| Next.js ↔ OpenAI (Mem0) | HTTPS | Plaintext prompts for fact extraction |

---

## Client vs Server Encryption Boundaries

| Data | Client encrypts? | Server encrypts at rest? | Server sees plaintext? |
|------|------------------|--------------------------|------------------------|
| Chat messages | No | Yes | Yes (for LLM) |
| Memory text | No | Optional | Yes (always) |
| Memory L1 cache | N/A | Yes (per-user) | Yes |
| Strata local drafts | Yes | N/A | No |
| Arcadia draft | Client ciphertext | Stored opaque | No |

**Not E2EE** — server-side defense-in-depth at rest, as documented in `how-we-secure-memory` blog.

---

## Positive Practices

- Clear `operations` / `store` separation with auth + rate limits
- Schema validation at boundary (`SearchResultSchema`)
- `deleteMemoryForCurrentUser` ownership check before global Mem0 delete
- Mixed plaintext/ciphertext rollout supported
- PII redaction layer before memory ingest (`lib/pii/redact.ts`)
- Memory search L1 cache encrypts cached payloads per-user
- Lens overview validates memory IDs against ownership snapshot
- Comprehensive unit tests for memory crypto and `EncryptedVectorStore`
- Blog "how we secure memory" is largely honest about tradeoffs

---

## Key File Reference

| Purpose | Path |
|---------|------|
| Public memory API | `lib/memory/operations.ts` |
| Low-level Mem0 store | `lib/memory/store.ts` |
| Memory AES-GCM | `lib/crypto/memory-encryption.ts` |
| Chat AES-GCM | `lib/crypto/message-encryption.ts` |
| Qdrant encryption wrapper | `lib/memory/encrypted-vector-store.ts` |
| Mem0 patch install | `lib/memory/install-mem0-vector-encryption.ts` |
| Mem0 config | `config/mem0-config.ts` |
| Migration script | `scripts/migrate-memories-v2.ts` |
| Rate limits | `lib/rate-limit/memory.ts` |
