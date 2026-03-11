import { BlogSection } from "@/components/blog/blog-section";

export function MemoryEncryptionIntroContent() {
  return (
    <BlogSection>
      <h1>Memory Encryption</h1>
      <p>
        Organic LLM encrypts sensitive chat and summary data at rest. This page
        explains the problem we solved, the research and options we weighed,
        and the architecture we implemented.
      </p>

      <h2>Problem statement</h2>
      <p>
        Conversations and AI-generated summaries are high-sensitivity data.
        Storing them in plaintext in a database exposes users to risk if the
        database is compromised, leaked, or accessed by admins. We wanted
        application-layer encryption so that even with database access,
        attackers see only ciphertext. The solution had to fit our Next.js and
        Supabase stack, avoid risky migrations, and stay compatible with future
        key rotation or KMS.
      </p>

      <h2>Research</h2>
      <p>
        We investigated how to design a practical, production-ready
        encryption layer for Organic LLM.
      </p>

      <h3>Goal of the research</h3>
      <p>
        The goal was to protect stored AI conversation data and summaries while
        integrating cleanly with the existing stack, avoiding high-risk
        migrations, and remaining compatible with future improvements like KMS
        and key rotation.
      </p>

      <h3>Survey of security practices in major AI applications</h3>
      <p>
        We looked at how leading AI systems secure chat data: ChatGPT, Claude,
        Gemini, Cursor, Notion AI, Perplexity.
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
        <strong>rarely use application-layer encryption</strong>—so plaintext
        prompts are often stored in databases. That gap meant application-layer
        encryption would significantly strengthen Organic LLM.
      </p>

      <h3>Encryption model evaluation</h3>
      <p>
        <strong>Database-only encryption</strong>
        <br />
        Protects physical disk.
        <br />
        Does not protect against database compromise or admin access.
        <br />
        <strong>Insufficient.</strong>
      </p>
      <p>
        <strong>Application-layer encryption</strong>
        <br />
        Encrypt before writing to the DB.
        <br />
        Protects against DB leaks.
        <br />
        Common in privacy-focused apps; adds moderate complexity.
        <br />
        <strong>Best approach.</strong>
      </p>

      <h3>Encryption algorithm research</h3>
      <ul>
        <li>
          <strong>AES-256-GCM:</strong> Hardware-accelerated, built into
          Node.js, authenticated encryption (AEAD), widely audited. Requires
          careful IV handling. <strong>Chosen</strong> for Node, built-in
          primitives, fewer dependencies.
        </li>
        <li>
          <strong>XChaCha20-Poly1305:</strong> Forgiving nonce model, excellent
          design. Requires external library; slower on systems with AES
          acceleration. Good alternative but unnecessary for this rollout.
        </li>
      </ul>

      <h3>Key management research</h3>
      <ul>
        <li>
          <strong>Single global key:</strong> One compromise exposes all users.{" "}
          <strong>Rejected.</strong>
        </li>
        <li>
          <strong>HKDF-derived per-user keys:</strong> Root secret → HKDF →
          user key. Isolates user data, no extra key storage. Root compromise
          still affects all. <strong>Chosen</strong> for near-term.
        </li>
        <li>
          <strong>Per-user stored DEKs (KMS):</strong> Strong isolation.
          Requires key storage and KMS. <strong>Future improvement.</strong>
        </li>
      </ul>

      <h3>Data sensitivity analysis</h3>
      <p>
        <strong>Sensitive:</strong> Message content and thread summaries (raw
        conversations, summaries, insights).
      </p>
      <p>
        <strong>Non-sensitive:</strong> Short excerpts, thread titles,
        timestamps, IDs.
      </p>
      <p>
        <strong>Conclusion:</strong> Field-level encryption.
      </p>

      <h3>Safe deployment strategy</h3>
      <ul>
        <li>
          <strong>Full migration:</strong> Encrypt all rows at once. Downtime
          and risk. <strong>Rejected.</strong>
        </li>
        <li>
          <strong>Mixed-mode:</strong> Rows may be plaintext or{" "}
          <code>enc:v1:</code> ciphertext. Decrypt when prefix present;
          otherwise treat as plaintext. Zero downtime, gradual rollout.{" "}
          <strong>Chosen.</strong>
        </li>
      </ul>

      <h3>Ciphertext versioning</h3>
      <p>
        Self-describing format: a versioned prefix, key id, then IV, tag, and
        ciphertext. Supports algorithm upgrades, key rotation, and mixed data.
      </p>

      <h3>Logging and operational security</h3>
      <p>
        Real-world incidents show logs often leak prompts and conversations. We
        log only metadata (message ID, token counts, model, timings) and never
        plaintext.
      </p>

      <h3>Integrity protection</h3>
      <p>
        AES-GCM provides ciphertext authentication. We also use AAD (additional
        authenticated data) to bind <code>user_id</code>,{" "}
        <code>thread_id</code>, and <code>field_name</code> so ciphertext cannot
        be copied between records.
      </p>

      <h3>Outcome</h3>
      <p>
        The design provides protection against database compromise,
        authenticated integrity, user-scoped key compartmentalization, safe
        rollout without migration risk, and compatibility with future key
        rotation and KMS—while staying simple enough to implement in the
        current stack.
      </p>
      <p>
        <em>Research accelerated with ChatGPT Atlas.</em>
      </p>

      <hr />

      <h2>Design space (options we weighed)</h2>
    </BlogSection>
  );
}
