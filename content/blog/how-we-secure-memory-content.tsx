import Link from "next/link";

import { BlogFigure } from "@/components/blog/blog-figure";
import { BlogSection } from "@/components/blog/blog-section";
import { Term } from "@/components/blog/term-with-definition";

/** What a copy of the memory database holds, next to what you see in the app. */
function DatabaseVsApp() {
  const rows: ReadonlyArray<readonly [attacker: string, you: string]> = [
    ["Scrambled blocks of text", "Your memories, readable"],
    ["Lists of numbers used for search", "Relevant results when you ask"],
    ["No readable text to read", "A normal conversation"],
  ];

  return (
    <BlogFigure caption="The database holds the left column. The app, with its keys, shows you the right.">
      <div className="overflow-hidden rounded-xl border border-border bg-secondary/40">
        <div className="grid grid-cols-2 divide-x divide-border bg-secondary/60 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <div className="px-inset-lg py-stack-md text-center">
            Someone with a database copy sees
          </div>
          <div className="px-inset-lg py-stack-md text-center">You see</div>
        </div>
        <div className="divide-y divide-border/60">
          {rows.map(([attacker, you]) => (
            <div key={attacker} className="grid grid-cols-2 divide-x divide-border/60">
              <div className="px-inset-lg py-stack-md text-center text-sm text-foreground/90">
                {attacker}
              </div>
              <div className="px-inset-lg py-stack-md text-center text-sm text-foreground/90">
                {you}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlogFigure>
  );
}

const GLANCE: ReadonlyArray<readonly [label: string, body: string]> = [
  [
    "Access",
    "Memory requests are tied to the signed-in user on the server. A client cannot claim to be someone else, and a delete only works on what already belongs to you.",
  ],
  [
    "Abuse",
    "Rate limits and checks on every response stop a buggy or automated client from hammering memory or receiving malformed data.",
  ],
  [
    "Storage",
    "When encryption keys are configured, the readable text of a memory is encrypted with AES-256-GCM before it is saved and decrypted by the app when you need it. Keys are kept apart from the data, so a copy of the database alone is not enough.",
  ],
  ["Logging", "By design we log metadata, not the content of your memories."],
];

export function HowWeSecureMemoryContent() {
  return (
    <div className="space-y-stack-3xl">
      <BlogSection>
        <h1>How we protect your memories</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          Organic LLM remembers things about you so it can help you better. We treat that memory as
          sensitive. The readable text of a memory is encrypted before it reaches the memory
          database.
        </p>
        <p>
          This post is about the <strong>memory store</strong>. Chat messages and summaries have
          their own protection, covered in{" "}
          <Link href="/blog/memory-encryption">Memory encryption, in depth</Link>.
        </p>

        <h2>Why this matters</h2>
        <p>
          Memory holds preferences, projects and phrasing that are personal. That is what makes it
          useful, and it is what makes a leak costly, whether from a misconfiguration, a compromised
          host or an incident upstream. Trust is part of the product, so we start from the
          assumption that the database could be exposed.
        </p>
      </BlogSection>

      <BlogFigure>
        <div className="rounded-xl border border-border bg-secondary/40 p-inset-xl">
          <h2 className="text-base font-semibold tracking-tight text-foreground">At a glance</h2>
          <dl className="mt-stack-lg divide-y divide-border/50 text-sm leading-relaxed">
            {GLANCE.map(([label, body]) => (
              <div
                key={label}
                className="grid grid-cols-1 gap-stack-xs py-stack-lg first:pt-0 last:pb-0 sm:grid-cols-[7rem_1fr] sm:gap-x-inline-lg"
              >
                <dt className="font-medium text-foreground">{label}</dt>
                <dd className="text-foreground/90">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </BlogFigure>

      <BlogSection>
        <h2>How it fits together</h2>
        <p>
          Organic LLM uses Mem0, a memory layer, on top of Qdrant, a database built for searching by
          meaning. To search by meaning, each memory is stored with an <Term>embedding</Term>. We
          additionally protect the readable text kept with it. A thin wrapper encrypts that text on
          the way in and decrypts it on the way out, so the rest of the app can treat memory like
          any other Mem0 store.
        </p>
        <p>
          The embeddings stay readable on purpose, because encrypting them would break similarity
          search. They are numbers, not words, but they can still hint at what a memory is about. We
          chose to protect the <em>readable text</em> and keep relevance and speed, and we want you
          to know that is the trade.
        </p>

        <DatabaseVsApp />

        <h2>Who can read what</h2>
        <p>
          The app server decrypts memory in order to use it, so the people who run Organic LLM can
          technically read it. Memory text is also included in the prompt sent to the model provider
          when it is relevant to your question. Encryption at rest protects you if the database is
          exposed. It is not a promise that nobody inside the system can ever read your memory.
        </p>

        <h2>Deleting memories</h2>
        <p>
          When you delete a memory, or clear memory in the product, we remove those records from the
          memory database. Account deletion is available on request through our privacy contact
          flow. We have not described how long backups or provider-side copies persist here, and we
          would rather say that than imply it.
        </p>

        <h2>What we claim, and where it fits</h2>
        <ul>
          <li>
            <strong>We do claim</strong> a real layer of protection for the stored text of memories
            if someone obtains the database without the application keys, along with a careful
            server boundary: authentication, limits, validation and ownership checks.
          </li>
          <li>
            <strong>Encryption is one layer, not the whole.</strong> Organic LLM is served over TLS,
            sign-in is handled by a dedicated identity service, and the hosting and configuration
            are set up with care. The encryption described here sits behind those, for the case
            where one of them fails. It adds to them and does not replace them.
          </li>
        </ul>
      </BlogSection>
    </div>
  );
}
