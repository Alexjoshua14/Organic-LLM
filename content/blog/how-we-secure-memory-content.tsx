import Link from "next/link";

import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";

const MEMORY_FLOW_MERMAID = `flowchart LR
  user[User]
  appServer["App server"]
  enc[Encrypt text fields]
  vectorDb[(Vector store)]
  dec[Decrypt for reads]
  user -->|"TLS"| appServer
  appServer --> enc
  enc --> vectorDb
  vectorDb --> dec
  dec --> appServer
`;

export function HowWeSecureMemoryContent() {
  return (
    <div className="space-y-10">
      <BlogSection>
        <h1>How we secure user memory</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          Organic LLM treats long-term memory as sensitive data. We combine strict access controls
          on the server with application-layer encryption for the human-readable text we store
          alongside search vectors—so a storage leak is much less likely to spill readable
          conversations and summaries.
        </p>

        <h2>Why this matters</h2>
        <p>
          Memory systems remember context across sessions: preferences, projects, and phrasing that
          is inherently personal. That usefulness creates risk if data is ever exposed through a
          misconfiguration, insider access, or upstream incident. We invest here because trust is
          part of the product, not an afterthought.
        </p>
      </BlogSection>

      <div className="not-prose rounded-xl border border-border bg-secondary/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-base font-semibold text-foreground tracking-tight">At a glance</h2>
        <ul className="mt-4 space-y-3 text-sm text-foreground/90 leading-relaxed">
          <li className="flex gap-3">
            <span className="font-medium text-foreground shrink-0">Access</span>
            <span>
              Memory APIs resolve the signed-in user on the server only; clients do not supply
              identity for reads or writes. Deletes are checked against what already belongs to you.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-medium text-foreground shrink-0">Abuse</span>
            <span>
              Rate limits and response validation sit at the public boundary so automated or buggy
              clients cannot hammer memory or receive malformed payloads unchecked.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-medium text-foreground shrink-0">Storage</span>
            <span>
              When enabled, sensitive string fields in the vector payload are encrypted with
              AES-256-GCM before persistence and decrypted inside the app when search or UI needs
              the text. Keys are versioned deployment secrets so we can rotate without rewriting the
              whole story in one shot.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-medium text-foreground shrink-0">Operations</span>
            <span>
              We avoid logging raw memory content in production paths where it would not add value.
              Optional PII redaction can run before persistence when that mode is on.
            </span>
          </li>
        </ul>
      </div>

      <BlogSection>
        <h2>How it fits together</h2>
        <p>
          Organic LLM uses Mem0 on top of a vector database (Qdrant in our setup). Mem0 still writes
          embedding vectors for semantic search; what we additionally protect is the readable text
          stored in the payload (for example the main memory text and lemmatized text used for
          hybrid retrieval). A thin wrapper around the vector store encrypts those fields on the way
          in and decrypts them on the way out, so the rest of the application keeps a normal Mem0
          mental model.
        </p>
        <p className="text-sm text-muted-foreground">
          Embeddings stay in cleartext at the vector layer by design: encrypting them would break
          standard similarity search. The tradeoff is intentional—we reduce exposure of{" "}
          <em>readable</em> memory text at rest while keeping relevance and performance.
        </p>

        <figure className="my-8 not-prose rounded-lg border border-border/60 bg-muted/20 p-4">
          <figcaption className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Simplified flow
          </figcaption>
          <MermaidDiagram code={MEMORY_FLOW_MERMAID} />
        </figure>

        <h2>What we claim—and what we do not</h2>
        <ul>
          <li>
            <strong>We do claim</strong> a meaningful layer of protection for stored memory{" "}
            <em>text</em> if someone obtains database payloads without application keys, plus a
            disciplined server boundary (auth, limits, validation, ownership checks).
          </li>
          <li>
            <strong>We do not claim</strong> that encryption replaces TLS, authentication, secure
            hosting, or careful vendor configuration. It is defense in depth, not a single magic
            switch.
          </li>
        </ul>

        <h2>Further reading</h2>
        <p>
          For a longer write-up on the problem space, industry context, and design options we
          explored, see{" "}
          <Link
            className="underline decoration-foreground/40 hover:decoration-foreground"
            href="/blog/memory-encryption"
          >
            Memory Encryption
          </Link>
          . That article reflects research and design narrative; this page tracks the{" "}
          <em>current</em> production-oriented shape (vector payload field encryption plus the
          operations boundary described above).
        </p>
      </BlogSection>
    </div>
  );
}
