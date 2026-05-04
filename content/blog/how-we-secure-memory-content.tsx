import Link from "next/link";

import { BlogSection } from "@/components/blog/blog-section";

function DatabaseVsAppComparison() {
  const rows: [string, string][] = [
    ["Encrypted blobs", "Your memories, readable"],
    ["Search numbers", "Relevant results"],
    ["No readable text", "Normal experience"],
  ];

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border border-border bg-muted/10">
      <figcaption className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What a database-only attacker does not get
      </figcaption>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="bg-secondary/25 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          Without app keys
        </div>
        <div className="bg-secondary/25 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          With Organic LLM
        </div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(([left, right]) => (
          <div key={left} className="grid grid-cols-2 divide-x divide-border">
            <div className="px-4 py-3 text-sm text-foreground/90">{left}</div>
            <div className="px-4 py-3 text-sm text-foreground/90">{right}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HowWeSecureMemoryContent() {
  return (
    <div className="space-y-10">
      <BlogSection>
        <h1>How we protect your memories</h1>
        <div className="not-prose -mt-2 mb-5 text-xs text-muted-foreground">
          Last updated: May 2026
        </div>
        <p className="text-lg leading-relaxed text-foreground/90">
          Organic LLM treats long-term memory as sensitive data. We combine strict access controls
          on the server with application-layer encryption for the human-readable text we store in
          the memory database alongside the numeric fingerprints we use for search—so a storage leak
          is much less likely to spill readable conversations and summaries.
        </p>

        <h2>Why this matters</h2>
        <p>
          Memory systems remember context across sessions: preferences, projects, and phrasing that
          is inherently personal. That usefulness creates risk if data is ever exposed through a
          misconfiguration, a compromised host, or an upstream incident. We invest here because
          trust is part of the product, not an afterthought.
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
              When enabled, sensitive text fields in the memory database are encrypted with
              AES-256-GCM before persistence and decrypted inside the app when search or UI needs
              the text. Keys are versioned deployment secrets so we can rotate without rewriting the
              whole system in one shot.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-medium text-foreground shrink-0">Logging</span>
            <span>We do not log raw memory content in production.</span>
          </li>
        </ul>
      </div>

      <BlogSection>
        <h2>How it fits together</h2>
        <p>
          Organic LLM uses Mem0 with a memory database (Qdrant in our setup). Mem0 still writes
          numeric fingerprints for semantic search; what we additionally protect is the readable
          text stored with those records—for example the main memory text. A thin wrapper encrypts
          those fields on the way into the memory database and decrypts them on the way out, so the
          rest of the application keeps a normal Mem0 mental model.
        </p>
        <p className="text-sm text-muted-foreground">
          Those search fingerprints stay readable at the database layer by design: locking them down
          would break ordinary similarity search. The tradeoff is intentional—we reduce exposure of{" "}
          <em>readable</em> memory text at rest while keeping relevance and performance.
        </p>

        <DatabaseVsAppComparison />

        <h2>Deletion and retention</h2>
        <p>
          When you delete individual memories or wipe memory in the product, we remove those records
          from the memory database on the backend. Full account deletion is available on request
          through our privacy contact flow.
        </p>

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
          For more depth on the problem space, industry context, and design tradeoffs—including how
          we chose our encryption approach, how it deploys, and where it lives in the stack—see{" "}
          <Link
            className="underline decoration-foreground/40 hover:decoration-foreground"
            href="/blog/memory-encryption"
          >
            Memory Encryption
          </Link>
          .
        </p>
      </BlogSection>
    </div>
  );
}
