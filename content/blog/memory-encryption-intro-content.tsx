import Link from "next/link";

import { BlogSection } from "@/components/blog/blog-section";

export function MemoryEncryptionIntroContent() {
  return (
    <BlogSection>
      <h1>Memory Encryption</h1>
      <p>
        Organic LLM encrypts sensitive chat and summary data at rest. This page explains the problem
        we solved, the research and options we weighed, and the architecture we implemented.
      </p>
      <p>
        Sensitive text also lives in two different places at rest:{" "}
        <strong>thread messages and related summaries</strong> in our primary database
        (Supabase)—the focus of most of this article—and <strong>long-term memory</strong> in a
        separate vector memory backend (Mem0 on Qdrant) when field encryption is enabled. For a
        concise overview of how we protect stored memory text and the product boundary around it,
        see{" "}
        <Link
          className="underline decoration-foreground/40 hover:decoration-foreground"
          href="/blog/how-we-secure-memory"
        >
          How we protect your memories
        </Link>
        .
      </p>

      <h2>Problem statement</h2>
      <p>
        Conversations and AI-generated summaries are high-sensitivity data. Storing them in
        plaintext in a database exposes users to risk if the database is compromised, leaked, or
        accessed by admins. We wanted application-layer encryption so that even with database
        access, attackers see only ciphertext. The solution had to fit our Next.js and Supabase
        stack, avoid risky migrations, and stay compatible with future key rotation or KMS.
      </p>

      <h2>Research</h2>
      <p>
        We investigated how to design a practical, production-ready encryption layer for Organic
        LLM.
      </p>

      <h3>Goal of the research</h3>
      <p>
        The goal was to protect stored AI conversation data and summaries while integrating cleanly
        with the existing stack, avoiding high-risk migrations, and remaining compatible with future
        improvements like KMS and key rotation.
      </p>

      <h3>Survey of security practices in major AI applications</h3>
      <p>
        We looked at how leading AI systems secure chat data: ChatGPT, Claude, Gemini, Cursor,
        Notion AI, Perplexity.
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Typical technology</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Transport encryption</td>
            <td>TLS 1.2 / TLS 1.3</td>
          </tr>
          <tr>
            <td>Storage encryption</td>
            <td>AES-256</td>
          </tr>
          <tr>
            <td>Key management</td>
            <td>KMS / HSM</td>
          </tr>
        </tbody>
      </table>
      <p>
        Most rely on transport and disk encryption but{" "}
        <strong>rarely use application-layer encryption</strong>—so plaintext prompts are often
        stored in databases. That gap meant application-layer encryption would significantly
        strengthen Organic LLM.
      </p>

      <h3>Encryption model evaluation</h3>
      <h3 className="text-base font-semibold mt-4">Option A — Database-only encryption</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Protects physical disk.
        <br />
        Does not protect against database compromise or admin access.
        <br />
        <em className="font-semibold">Insufficient.</em>
      </div>
      <h3 className="text-base font-semibold mt-4">Option B — Application-layer encryption</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Encrypt before writing to the DB.
        <br />
        Protects against DB leaks.
        <br />
        Common in privacy-focused apps; adds moderate complexity.
        <br />
        <em className="font-semibold">Best approach.</em>
      </div>

      <h3>Encryption algorithm research</h3>
      <h3 className="text-base font-semibold mt-4">Option A — AES-256-GCM</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Hardware-accelerated, built into Node.js.
        <br />
        Authenticated encryption (AEAD), widely audited.
        <br />
        The initialization vector, which varies ciphertext per encryption, must be unique and
        correctly generated each time.
        <br />
        <em className="font-semibold">Chosen</em> for Node, built-in primitives, fewer dependencies.
      </div>
      <h3 className="text-base font-semibold mt-4">Option B — XChaCha20-Poly1305</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Forgiving nonce model, excellent design.
        <br />
        Requires external library; slower on systems with AES acceleration.
        <br />
        <em className="font-semibold">Good alternative</em> but unnecessary for this rollout.
      </div>

      <h3>Key management research</h3>
      <h3 className="text-base font-semibold mt-4">Option A — Single global key</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        One compromise exposes all users.
        <br />
        <em className="font-semibold">Rejected.</em>
      </div>
      <h3 className="text-base font-semibold mt-4">Option B — HKDF-derived per-user keys</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Root secret → HKDF → user key.
        <br />
        Isolates user data, no extra key storage.
        <br />
        Root compromise still affects all.
        <br />
        <em className="font-semibold">Chosen</em> for near-term.
      </div>
      <h3 className="text-base font-semibold mt-4">Option C — Per-user stored DEKs (KMS)</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Strong isolation.
        <br />
        Requires key storage and KMS.
        <br />
        <em className="font-semibold">Future improvement.</em>
      </div>

      <h3>Data sensitivity analysis</h3>
      <h3 className="text-base font-semibold mt-4">Sensitive</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Message content, thread summaries (raw conversations, summaries, insights), and long-term
        memory text stored for retrieval across sessions.
      </div>
      <h3 className="text-base font-semibold mt-4">Non-sensitive</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Short excerpts, thread titles, timestamps, IDs.
      </div>
      <p className="mt-2">
        <strong>Conclusion:</strong> Field-level encryption.
      </p>

      <h3>Safe deployment strategy</h3>
      <h3 className="text-base font-semibold mt-4">Option A — Full migration</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Encrypt all rows at once.
        <br />
        Downtime and risk.
        <br />
        <em className="font-semibold">Rejected.</em>
      </div>
      <h3 className="text-base font-semibold mt-4">Option B — Mixed-mode</h3>
      <div className="pl-4 text-sm text-foreground/90 space-y-0.5">
        Rows may be plaintext or <code>enc:v1:</code> ciphertext.
        <br />
        Decrypt when prefix present; otherwise treat as plaintext.
        <br />
        Zero downtime, gradual rollout.
        <br />
        <em className="font-semibold">Chosen.</em>
      </div>

      <h3>Ciphertext versioning</h3>
      <p>
        Self-describing format: a versioned prefix, key id, then initialization vector (IV), tag,
        and ciphertext. Supports algorithm upgrades, key rotation, and mixed data.
      </p>

      <h3>Logging and operational security</h3>
      <p>
        Real-world incidents show logs often leak prompts and conversations. We log only metadata
        (message ID, token counts, model, timings) and never plaintext.
      </p>

      <h3>Integrity protection</h3>
      <p>
        AES-GCM provides ciphertext authentication. We also use AAD (additional authenticated data)
        to bind <code>user_id</code>, <code>thread_id</code>, and <code>field_name</code> so
        ciphertext cannot be copied between records.
      </p>

      <h3>Outcome</h3>
      <p>
        The design provides protection against database compromise, authenticated integrity,
        user-scoped key compartmentalization, safe rollout without migration risk, and compatibility
        with future key rotation and KMS—while staying simple enough to implement in the current
        stack.
      </p>
      <p>
        <em>Research accelerated with ChatGPT Atlas.</em>
      </p>

      <hr />

      <h2>Design space (options we weighed)</h2>
    </BlogSection>
  );
}
