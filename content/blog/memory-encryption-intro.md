# Memory Encryption

Organic LLM encrypts sensitive chat and summary data at rest. This page explains the problem we solved, the research and options we weighed, and the architecture we implemented.

## Problem statement

Conversations and AI-generated summaries are high-sensitivity data. Storing them in plaintext in a database exposes users to risk if the database is compromised, leaked, or accessed by admins. We wanted application-layer encryption so that even with database access, attackers see only ciphertext. The solution had to fit our Next.js and Supabase stack, avoid risky migrations, and stay compatible with future key rotation or KMS.

## Research

We investigated how to design a practical, production-ready encryption layer for Organic LLM.

### Goal of the research

The goal was to protect stored AI conversation data and summaries while integrating cleanly with the existing stack, avoiding high-risk migrations, and remaining compatible with future improvements like KMS and key rotation.

### Survey of security practices in major AI applications

We looked at how leading AI systems secure chat data: ChatGPT, Claude, Gemini, Cursor, Notion AI, Perplexity.

| Layer                | Typical technology   |
|----------------------|----------------------|
| Transport encryption | TLS 1.2 / TLS 1.3    |
| Storage encryption   | AES-256              |
| Key management       | KMS / HSM            |

Most rely on transport and disk encryption but **rarely use application-layer encryption**—so plaintext prompts are often stored in databases. That gap meant application-layer encryption would significantly strengthen Organic LLM.

### Encryption model evaluation

**Database-only encryption**
Protects physical disk.  
Does not protect against database compromise or admin access.
**Insufficient.**

**Application-layer encryption**
Encrypt before writing to the DB.  
Protects against DB leaks.  
Common in privacy-focused apps; adds moderate complexity.
**Best approach.**

### Encryption algorithm research

- **AES-256-GCM:** Hardware-accelerated, built into Node.js, authenticated encryption (AEAD), widely audited. Requires careful IV handling. **Chosen** for Node, built-in primitives, fewer dependencies.
- **XChaCha20-Poly1305:** Forgiving nonce model, excellent design. Requires external library; slower on systems with AES acceleration. Good alternative but unnecessary for this rollout.

### Key management research

- **Single global key:** One compromise exposes all users. **Rejected.**
- **HKDF-derived per-user keys:** Root secret → HKDF → user key. Isolates user data, no extra key storage. Root compromise still affects all. **Chosen** for near-term.
- **Per-user stored DEKs (KMS):** Strong isolation. Requires key storage and KMS. **Future improvement.**

### Data sensitivity analysis

**Sensitive:** Message content and thread summaries (raw conversations, summaries, insights).

**Non-sensitive:** Short excerpts, thread titles, timestamps, IDs.

**Conclusion:** Field-level encryption.

### Safe deployment strategy

- **Full migration:** Encrypt all rows at once. Downtime and risk. **Rejected.**
- **Mixed-mode:** Rows may be plaintext or `enc:v1:` ciphertext. Decrypt when prefix present; otherwise treat as plaintext. Zero downtime, gradual rollout. **Chosen.**

### Ciphertext versioning

Self-describing format: a versioned prefix, key id, then IV, tag, and ciphertext. Supports algorithm upgrades, key rotation, and mixed data.

### Logging and operational security

Real-world incidents show logs often leak prompts and conversations. We log only metadata (message ID, token counts, model, timings) and never plaintext.

### Integrity protection

AES-GCM provides ciphertext authentication. We also use AAD (additional authenticated data) to bind `user_id`, `thread_id`, and `field_name` so ciphertext cannot be copied between records.

### Outcome

The design provides protection against database compromise, authenticated integrity, user-scoped key compartmentalization, safe rollout without migration risk, and compatibility with future key rotation and KMS—while staying simple enough to implement in the current stack.

*Research accelerated with ChatGPT Atlas.*

---

## Design space (options we weighed)
