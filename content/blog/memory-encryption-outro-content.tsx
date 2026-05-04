import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { PipelineDiagram, type PipelineSection } from "@/components/blog/pipeline-diagram";
import { PipelineAnimation } from "@/components/blog/pipeline-animation";

/** Mem0 stack: app → operations → store → vector DB, with encryption at the vector-store boundary. */
const ARCH_MERMAID = `flowchart LR
  routes[Server routes]
  ops[Memory operations]
  store[Mem0 client]
  wrap[EncryptedVectorStore]
  qdrant[(Qdrant)]

  routes --> ops
  ops --> store
  store --> wrap
  wrap --> qdrant
`;

const PIPELINE_SECTIONS: PipelineSection[] = [
  { boundary: "User", steps: [] },
  {
    tunnel: {
      from: "User",
      to: "Next.js server",
      label: "TLS",
    },
  },
  {
    boundary: "Next.js server",
    steps: [
      "Clerk auth + profile id; rate limits and schema validation on memory APIs",
      "Mem0 adds and searches memories; sensitive text fields encrypted before Qdrant writes",
    ],
  },
  {
    tunnel: {
      from: "Next.js server",
      to: "Memory database (Qdrant)",
      label: "TLS; ciphertext for protected text fields",
    },
  },
  {
    boundary: "Memory database (Qdrant)",
    steps: [
      "AES-256-GCM ciphertext for configured string fields (e.g. memory body text)",
      "Embedding vectors stored for semantic search (not encrypted—required for similarity search)",
    ],
  },
];

export function MemoryEncryptionOutroContent() {
  return (
    <BlogSection>
      <div className="not-prose mb-6 text-xs text-muted-foreground">Last updated: May 2026</div>

      <h2>Implemented solution</h2>

      <h3>Where encryption runs</h3>
      <p>
        When memory encryption is configured, we patch Mem0&apos;s vector store factory so every
        created store is wrapped in an <code>EncryptedVectorStore</code>. The wrapper encrypts
        selected string fields on <code>insert</code> and <code>update</code> and decrypts them on{" "}
        <code>search</code>, <code>get</code>, <code>list</code>, and keyword search paths. Mem0 and
        application code otherwise behave the same; encryption is transparent at the persistence
        boundary.
      </p>

      <h3>What is encrypted</h3>
      <table>
        <thead>
          <tr>
            <th>Field (payload)</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>data</code> (main memory text)
            </td>
            <td>
              Encrypted before write to the memory database; decrypted when read back into the app
            </td>
          </tr>
          <tr>
            <td>Secondary memory text field (used with hybrid search)</td>
            <td>
              Same as <code>data</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Not encrypted at this layer:</strong> Embedding vectors (required for semantic
        search), point IDs, filters, and other non-text metadata Mem0/Qdrant need unchanged.
      </p>

      <h3>Crypto module</h3>
      <p>
        The <code>lib/crypto/memory-encryption</code> module implements AES-256-GCM. Key material
        comes from versioned deployment secrets: an active key id plus matching env-provided random
        key material, run through HKDF to produce the AES key. Ciphertext is a single
        self-describing string: version, key id, IV, authentication tag, and ciphertext (so older
        rows can stay plaintext until rewritten, and key rotation can coexist with old ciphertexts).
      </p>

      <h3>Server-only</h3>
      <p>
        Memory encryption and the Mem0 client run only on the server. They are not imported from
        client bundles.
      </p>

      <h3>Public API boundary</h3>
      <p>
        UI and routes call a dedicated memory operations layer: identity comes from Clerk plus a
        server-resolved profile id (not from the client), operations apply rate limits, responses
        are validated against a schema, and deletes verify ownership before calling Mem0 delete. The
        low-level store has no auth and is only used behind that boundary.
      </p>

      <p className="text-sm text-muted-foreground">
        <strong>Logging:</strong> We do not log raw memory content in production.
      </p>

      <h3>How components connect</h3>
      <MermaidDiagram code={ARCH_MERMAID} />

      <hr />

      <h2>Pipeline and security properties</h2>
      <p className="mb-1">End-to-end pipeline:</p>
      <PipelineDiagram sections={PIPELINE_SECTIONS} />
      <p className="mt-4 mb-1 text-sm text-muted-foreground">
        Animated flow (payloads move through TLS; boundaries static):
      </p>
      <PipelineAnimation />

      <h3>Security properties</h3>
      <ul>
        <li>
          <strong>Memory database exposure:</strong> Protected string fields appear as ciphertext
          without application keys; embedding vectors remain for search and are not treated as
          secret text at this layer.
        </li>
        <li>
          <strong>Tampering:</strong> AES-GCM authentication fails if ciphertext or associated data
          is altered.
        </li>
        <li>
          <strong>User isolation:</strong> Enforced by authenticated APIs and Mem0&apos;s user
          scoping—not by a separate data-encryption key per user in the current design.
        </li>
        <li>
          <strong>Rollout:</strong> Mixed plaintext and encrypted field values are supported during
          migration.
        </li>
      </ul>

      <h3>Why this fits Organic LLM</h3>
      <p>
        Organic LLM stores personal conversation-derived memory. This approach reduces readable
        exposure at the vector database while preserving semantic search, keeps keys and crypto off
        the client, and leaves room to evolve toward KMS or stricter models later.
      </p>
    </BlogSection>
  );
}
