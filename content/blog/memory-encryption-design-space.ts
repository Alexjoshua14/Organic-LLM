export const MEMORY_ENCRYPTION_DESIGN_SPACE = [
  {
    title: "Encryption scope",
    overview:
      "Encrypt whole DB vs rows vs field-level; field-level chosen for balance of security and operational simplicity.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A — Encrypt entire database | Simplest; no app changes | DB compromise exposes all; admins/backups see plaintext | Rejected |
| B — Encrypt entire rows/tables | Stronger than DB-only | Breaks queryability; harder migrations | Not necessary |
| **C — Field-level** | Protects high-value content; metadata searchable; minimal schema disruption | Slightly more app logic | **Chosen** |`,
  },
  {
    title: "Encryption algorithm",
    overview:
      "AES-256-GCM chosen for Node built-in support and hardware acceleration; XChaCha20-Poly1305 considered.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A — AES-256-GCM** | Hardware-accelerated; Node built-in; AEAD; widely audited | Careful IV handling | **Chosen** |
| B — XChaCha20-Poly1305 | Safe nonce model; IV misuse resistant | Needs libsodium; slower on AES-NI | Good alternative |`,
  },
  {
    title: "Key architecture",
    overview: "Single key rejected; HKDF-derived user keys chosen; per-user DEKs deferred.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A — Single global key | Simplest | One compromise = entire DB | Too risky |
| **B — HKDF-derived user keys** | Compartmentalizes users; no extra key storage | Root compromise affects all | **Chosen** |
| C — Per-user stored DEKs | Stronger isolation | Key storage; KMS; ops | Future improvement |`,
  },
  {
    title: "Key management",
    overview: "Env variable chosen for now; Cloud KMS planned for later.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A — Env variable** | Simple; deployable now | Server compromise exposes root | **Chosen for now** |
| B — Cloud KMS | Hardware-backed; rotation; audit | Infra; cost | Future step |`,
  },
  {
    title: "Ciphertext format",
    overview:
      "Versioned payload chosen for key rotation and algorithm upgrades; raw format rejected.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A — Raw (iv+tag+ciphertext) | Minimal storage | No versioning; brittle | Too fragile |
| **B — Versioned payload** | Key rotation; algorithm upgrades; mixed rollout | Slightly larger | **Chosen** |`,
  },
  {
    title: "Rollout strategy",
    overview: "Mixed-mode chosen for zero downtime; full migration rejected.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A — Full DB migration | Clean state | Risk; downtime | Rejected |
| **B — Mixed-mode** | Zero downtime; gradual | Temporary mixed rows | **Chosen** |`,
  },
  {
    title: "Encryption location",
    overview: "Server-side chosen; client-side impossible for AI chat.",
    tableMarkdown: `| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A — Client-side | Strongest privacy | LLM cannot process encrypted text | Impossible for AI chat |
| **B — Server-side** | Protects DB compromise; LLM can read in server memory | Server must be trusted | **Chosen** |`,
  },
  {
    title: "Logging security",
    overview: "Log only metadata; never plaintext prompts or conversation content.",
    tableMarkdown: `Log only metadata (message ID, thread ID, token counts, model, timings). Never log plaintext prompts.`,
  },
  {
    title: "AAD (additional authenticated data)",
    overview:
      "Bind user_id, thread_id, field_name to ciphertext to prevent swapping; implemented in code.",
    tableMarkdown: `Bind \`user_id\`, \`thread_id\`, \`field_name\` to ciphertext (AES-GCM AAD). Prevents ciphertext swapping. Implemented in code.`,
  },
] as const;
