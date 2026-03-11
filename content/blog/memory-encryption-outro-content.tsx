import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { CodeBlock } from "@/components/blog/code-block";

const LAYERS_MERMAID = `flowchart LR
  subgraph env [Config]
    root[root secret]
    keyId[active key id]
    registry[key registry]
  end

  subgraph crypto [Crypto module]
    build[Build service]
    getService[Get encrypt/decrypt]
    encrypt[Encrypt]
    decrypt[Decrypt]
  end

  subgraph data [Data layer]
    owner[Resolve thread owner]
    encMsg[Encrypt message]
    decMsg[Decrypt message]
    encSum[Encrypt summary]
    decSum[Decrypt summary]
    encConv[Encrypt conversation summary]
    decConv[Decrypt conversation summary]
  end

  subgraph helpers [LLM layer]
    decSummary[Decrypt summary for context]
    encSummary[Encrypt summary after update]
  end

  root --> build
  keyId --> build
  registry --> build
  build --> getService
  getService --> encrypt
  getService --> decrypt

  owner --> encMsg
  owner --> decMsg
  owner --> encSum
  owner --> decSum
  owner --> encConv
  owner --> decConv
  encrypt --> encMsg
  decrypt --> decMsg
  encrypt --> encSum
  decrypt --> decSum
  encrypt --> encConv
  decrypt --> decConv
  encrypt --> encSummary
  decrypt --> decSummary
`;

const PIPELINE_CODE = `User
 │
TLS 1.3
 │
Next.js server
 │
HKDF-derived user encryption keys
 │
AES-256-GCM field encryption
 │
Supabase (AES-256 at rest)
 │
disk
`;

export function MemoryEncryptionOutroContent() {
  return (
    <BlogSection>
      <h2>Implemented solution</h2>

      <h3>What is encrypted</h3>
      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Message content</td>
            <td>Encrypted on insert; decrypted on read</td>
          </tr>
          <tr>
            <td>Thread summary</td>
            <td>Encrypted when writing; decrypted when building context</td>
          </tr>
          <tr>
            <td>Conversation summary</td>
            <td>Encrypted in update; decrypted when reading</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Not encrypted:</strong> Primary keys, timestamps, role,
        thread titles, short excerpts, etc.
      </p>

      <h3>Server-only</h3>
      <p>
        The crypto module is server-only and is never imported by client code.
      </p>

      <h3>Key derivation and AAD</h3>
      <ul>
        <li>
          <strong>Root secret:</strong> Key derivation and AAD use a{" "}
          <strong>root secret</strong> (supplied at deploy time). Optional: an{" "}
          <strong>active key id</strong> and a <strong>key registry</strong>{" "}
          for rotation or multiple keys.
        </li>
        <li>
          <strong>Per-user key:</strong> HKDF-SHA256 derives a 32-byte key per
          user from the root secret (with salt and a fixed info string). No
          per-user keys are stored.
        </li>
        <li>
          <strong>AAD:</strong> Ciphertext is bound to user id, thread id, and
          field name so it cannot be reused in another context.
        </li>
      </ul>

      <h3>Payload format and legacy</h3>
      <ul>
        <li>
          <strong>Encrypted value:</strong>{" "}
          <code>enc:v1:&lt;keyId&gt;:&lt;ivBase64&gt;:&lt;tagBase64&gt;:&lt;ciphertextBase64&gt;</code>
        </li>
        <li>
          <strong>Legacy:</strong> Values not starting with <code>enc:</code>{" "}
          are returned as plaintext.
        </li>
      </ul>

      <h3>Where it runs</h3>
      <ul>
        <li>
          <strong>Crypto module:</strong> Encrypt/decrypt API and key
          derivation; server-only.
        </li>
        <li>
          <strong>Data layer:</strong> Encrypt/decrypt messages and both
          summary fields; resolves thread owner first.
        </li>
        <li>
          <strong>LLM layer:</strong> Decrypt/encrypt summary text when
          building or updating context.
        </li>
      </ul>

      <p>How the layers fit together:</p>
      <MermaidDiagram code={LAYERS_MERMAID} />

      <hr />

      <h2>Final architecture and security properties</h2>
      <p>End-to-end pipeline:</p>
      <CodeBlock code={PIPELINE_CODE} language="text" />

      <p>
        <strong>Ciphertext format:</strong> A versioned prefix, key id, then
        IV, tag, and ciphertext (e.g.{" "}
        <code>enc:v1:&lt;keyId&gt;:&lt;iv&gt;:&lt;tag&gt;:&lt;ciphertext&gt;</code>).
      </p>
      <p>
        <strong>Encrypted fields:</strong> Message content, thread summary,
        conversation summary.
      </p>

      <h3>Security properties achieved</h3>
      <ul>
        <li>
          <strong>Database compromise:</strong> Attackers see ciphertext only.
        </li>
        <li>
          <strong>Row swapping / tampering:</strong> Detected by AEAD
          authentication tag.
        </li>
        <li>
          <strong>Partial compromise:</strong> User-scoped keys reduce blast
          radius.
        </li>
        <li>
          <strong>Operational rollout:</strong> Mixed plaintext/encrypted rows
          supported.
        </li>
      </ul>

      <h3>Why this fits Organic LLM</h3>
      <p>
        Organic LLM stores personal conversations, long-term AI memory, research
        notes, and summaries. This architecture protects those while still
        allowing AI reasoning, efficient queries, and gradual system evolution.
      </p>
    </BlogSection>
  );
}
