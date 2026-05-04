import Link from "next/link";

import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { PipelineDiagram, type PipelineSection } from "@/components/blog/pipeline-diagram";
import { PipelineAnimation } from "@/components/blog/pipeline-animation";

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

const PIPELINE_SECTIONS: PipelineSection[] = [
  { boundary: "User", steps: [] },
  {
    tunnel: {
      from: "User",
      to: "Next.js server",
      label: "Message encapsulated in transit (TLS 1.3)",
    },
  },
  {
    boundary: "Next.js server",
    steps: [
      "Message sent to external LLM; response returned to user via TLS",
      "In parallel: HKDF-derived user keys → AES-256-GCM encryption → send to Supabase",
    ],
  },
  {
    tunnel: {
      from: "Next.js server",
      to: "Database",
      label: "Encrypted payload (TLS to Supabase)",
    },
  },
  {
    boundary: "Database",
    steps: ["Supabase (AES-256 at rest)"],
  },
];

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
        <strong>Not encrypted:</strong> Primary keys, timestamps, role, thread titles, short
        excerpts, etc.
      </p>

      <h3>Long-term memory (Mem0 / Qdrant)</h3>
      <p>
        In addition to the message and summary fields above, Organic LLM can encrypt sensitive{" "}
        <strong>string fields</strong> on memory records before they are written to the vector
        memory database (Qdrant via Mem0). When configured, a server-side wrapper encrypts those
        fields on insert/update and decrypts them on search and reads; embedding vectors stay
        available for semantic search and are not encrypted at that layer.
      </p>
      <ul>
        <li>
          <strong>Algorithm:</strong> AES-256-GCM with versioned deployment key material (separate
          wire format from the <code>enc:v1:</code> message payload style described above).
        </li>
        <li>
          <strong>Scope:</strong> Readable memory text at rest; not a replacement for the
          authenticated memory APIs, rate limits, or TLS described on the companion page.
        </li>
        <li>
          <strong>More detail:</strong>{" "}
          <Link
            className="underline decoration-foreground/40 hover:decoration-foreground"
            href="/blog/how-we-secure-memory"
          >
            How we protect your memories
          </Link>
          .
        </li>
      </ul>

      <h3>Server-only</h3>
      <p>The crypto module is server-only and is never imported by client code.</p>

      <h3>Key derivation and AAD</h3>
      <ul>
        <li>
          <strong>Root secret:</strong> Key derivation and AAD use a <strong>root secret</strong>{" "}
          (supplied at deploy time). Optional: an <strong>active key id</strong> and a{" "}
          <strong>key registry</strong> for rotation or multiple keys.
        </li>
        <li>
          <strong>Per-user key:</strong> HKDF-SHA256 derives a 32-byte key per user from the root
          secret (with salt and a fixed info string). No per-user keys are stored.
        </li>
        <li>
          <strong>AAD:</strong> Ciphertext is bound to user id, thread id, and field name so it
          cannot be reused in another context.
        </li>
      </ul>

      <h3>Payload format and legacy</h3>
      <ul>
        <li>
          <strong>Encrypted value:</strong>{" "}
          <code>
            enc:v1:&lt;keyId&gt;:&lt;ivBase64&gt;:&lt;tagBase64&gt;:&lt;ciphertextBase64&gt;
          </code>
        </li>
        <li>
          <strong>Legacy:</strong> Values not starting with <code>enc:</code> are returned as
          plaintext.
        </li>
      </ul>

      <h3>Where it runs</h3>
      <ul>
        <li>
          <strong>Crypto module:</strong> Encrypt/decrypt API and key derivation; server-only.
        </li>
        <li>
          <strong>Data layer:</strong> Encrypt/decrypt messages and both summary fields; resolves
          thread owner first.
        </li>
        <li>
          <strong>LLM layer:</strong> Decrypt/encrypt summary text when building or updating
          context.
        </li>
      </ul>

      <p>How the layers fit together:</p>
      <MermaidDiagram code={LAYERS_MERMAID} />

      <hr />

      <h2>Final architecture and security properties</h2>
      <p className="mb-1">End-to-end pipeline:</p>
      <PipelineDiagram sections={PIPELINE_SECTIONS} />
      <p className="mt-4 mb-1 text-sm text-muted-foreground">
        Animated flow (message and encrypted payloads move through TLS; boundaries static):
      </p>
      <PipelineAnimation />

      <p>
        <strong>Ciphertext format:</strong> A versioned prefix, key id, then initialization vector
        (IV), tag, and ciphertext (e.g.{" "}
        <code>enc:v1:&lt;keyId&gt;:&lt;iv&gt;:&lt;tag&gt;:&lt;ciphertext&gt;</code>
        ).
      </p>
      <p>
        <strong>Encrypted fields (Supabase path):</strong> Message content, thread summary,
        conversation summary. Long-term memory text may additionally be encrypted in the vector
        memory store as described above.
      </p>

      <h3>Security properties achieved</h3>
      <ul>
        <li>
          <strong>Database compromise:</strong> Attackers see ciphertext only.
        </li>
        <li>
          <strong>Row swapping / tampering:</strong> Detected by AEAD authentication tag.
        </li>
        <li>
          <strong>Partial compromise:</strong> User-scoped keys reduce blast radius.
        </li>
        <li>
          <strong>Operational rollout:</strong> Mixed plaintext/encrypted rows supported.
        </li>
      </ul>

      <h3>Why this fits Organic LLM</h3>
      <p>
        Organic LLM stores personal conversations, long-term AI memory, research notes, and
        summaries. This architecture protects those while still allowing AI reasoning, efficient
        queries, and gradual system evolution.
      </p>
    </BlogSection>
  );
}
