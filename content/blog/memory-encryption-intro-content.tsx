import Link from "next/link";

import { BlogFigure } from "@/components/blog/blog-figure";
import { BlogSection } from "@/components/blog/blog-section";
import { Term } from "@/components/blog/term-with-definition";

/** Who can read what, stated plainly. The honest version is the one a reader can trust. */
const READERS: ReadonlyArray<readonly [who: string, sees: string]> = [
  ["You", "Everything. The app decrypts it for you."],
  [
    "The Organic LLM server",
    "Readable text while it serves your request. It has to be: the model cannot answer text it cannot read.",
  ],
  [
    "The model provider you chose",
    "The text of the turn it is asked to answer. Zero data retention limits which providers are used.",
  ],
  [
    "Someone with a copy of the database",
    "Ciphertext for message content and summaries, plus what we leave readable: IDs, timestamps, roles and thread titles.",
  ],
  [
    "Someone with a copy of the database and the server's secrets",
    "Everything. Encryption at the application layer does not defend against a compromised server.",
  ],
];

function WhoCanReadWhat() {
  return (
    <BlogFigure caption="Who can read what, with encryption on.">
      <div className="overflow-hidden rounded-xl border border-border bg-secondary/40">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-inset-lg py-stack-md font-medium">Who</th>
              <th className="px-inset-lg py-stack-md font-medium">Can read</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {READERS.map(([who, sees]) => (
              <tr key={who} className="align-top">
                <th className="w-2/5 px-inset-lg py-stack-md font-medium text-foreground">{who}</th>
                <td className="px-inset-lg py-stack-md text-foreground/90">{sees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlogFigure>
  );
}

export function MemoryEncryptionIntroContent() {
  return (
    <BlogSection>
      <h1>Memory encryption, in depth</h1>
      <p className="text-lg leading-relaxed text-foreground/90">
        Message content and summaries are stored as <Term>ciphertext</Term>. This is why we chose
        that design, what we built, and where it stops. For a shorter version written for everyone,
        read <Link href="/blog/how-we-secure-memory">How we protect your memories</Link>.
      </p>

      <WhoCanReadWhat />

      <p>
        Encrypting <Term>at rest</Term> protects data from someone who gets the database, not from
        someone who gets the running server. We say so first because it is the most important limit,
        and the rest of this post is about working inside it.
      </p>

      <h2>The problem</h2>
      <p>
        Conversations and the summaries the AI writes about them are some of the most personal data
        in the product. Stored as plain text, they are exposed if the database leaks, is
        misconfigured, or is read by someone with administrator access. We wanted{" "}
        <em>application-layer</em> encryption: the app scrambles the text before it ever reaches the
        database. The design had to fit a Next.js and Supabase stack, avoid risky migrations, and
        leave room for key rotation and a key management service later.
      </p>
      <p>
        Sensitive text lives in two places at rest. <strong>Messages and summaries</strong> are in
        our primary database (Supabase), which most of this post covers.{" "}
        <strong>Long-term memory</strong> is in a separate vector store (Mem0 on Qdrant) and is
        protected by its own layer, described near the end.
      </p>

      <h2>What we found</h2>
      <p>
        We read public documentation for several major AI products, with ChatGPT Atlas to speed up
        the search. Their stated protections are the standard ones: <Term>TLS 1.2/1.3</Term> in
        transit, <Term>AES-256-GCM</Term>-class encryption on disk, and a <Term>KMS</Term> for keys.
        We did not find application-layer encryption described. That is a limit of public
        documentation, not proof of what any company does, but it told us the layer was worth
        building ourselves.
      </p>

      <h2>What we encrypt and what we leave readable</h2>
      <p>
        We encrypt <strong>message content</strong>, <strong>thread summaries</strong>, and the{" "}
        <strong>conversation summary</strong>. We leave identifiers, timestamps, roles and{" "}
        <strong>thread titles</strong> readable. Titles are a trade-off, not a free choice: a title
        can be personal, and it is readable by anyone with the database. We keep them readable so
        the thread list stays fast and sortable, and we say so plainly here.
      </p>

      <h2>The decisions</h2>
      <p>
        Each choice below was weighed against alternatives. Open any row for the options, what each
        cost, and the verdict.
      </p>
    </BlogSection>
  );
}
