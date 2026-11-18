import Link from "next/link";

import { BlogCode } from "@/components/blog/blog-code";
import { BlogFigure } from "@/components/blog/blog-figure";
import { BlogTable } from "@/components/blog/blog-table";
import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { PipelineAnimation } from "@/components/blog/pipeline-animation";
import { PipelineDiagram, type PipelineSection } from "@/components/blog/pipeline-diagram";
import { Term } from "@/components/blog/term-with-definition";

/** Top-down and short: three layers, one job each. */
const LAYERS_MERMAID = `flowchart TD
  config["Config: root secret, active key id, key registry"]
  crypto["Crypto module: derive a key per user, encrypt, decrypt"]
  data["Data layer"]
  llm["LLM layer"]
  config --> crypto
  crypto --> data
  crypto --> llm
`;

const PIPELINE_SECTIONS: PipelineSection[] = [
  { boundary: "You", steps: [] },
  {
    tunnel: {
      from: "You",
      to: "Next.js server",
      label: "Your message, protected in transit (TLS 1.3)",
    },
  },
  {
    boundary: "Next.js server",
    steps: [
      "Message sent to the model you chose; the reply returns to you over TLS",
      "In parallel: a per-user key is derived, the text is encrypted with AES-256-GCM, and the ciphertext is sent to the database",
    ],
  },
  {
    tunnel: {
      from: "Next.js server",
      to: "Database",
      label: "Ciphertext, over TLS to Supabase",
    },
  },
  {
    boundary: "Database",
    steps: ["Supabase (AES-256 disk encryption underneath)"],
  },
];

const PAYLOAD = "enc:v1:<keyId>:<ivBase64>:<tagBase64>:<ciphertextBase64>";

export function MemoryEncryptionOutroContent() {
  return (
    <>
      <BlogSection>
        <h2>What we built</h2>

        <h3>What is encrypted, and when</h3>
      </BlogSection>

      <BlogTable
        head={["What", "When"]}
        rows={[
          ["Message content", "Encrypted on insert; decrypted on read"],
          ["Thread summary", "Encrypted when written; decrypted when building context"],
          ["Conversation summary", "Encrypted on update; decrypted on read"],
        ]}
      />

      <BlogSection>
        <p>
          <strong>Left readable:</strong> primary keys, timestamps, roles, thread titles and short
          excerpts.
        </p>
        <p>
          Encryption runs when a deployment has key material configured. Rows written before that,
          or without it, are stored and read as plaintext. That is the point of the mixed-mode
          rollout below, and it is also a limit: the protection is only as complete as the rows it
          has reached.
        </p>

        <h3>Keys</h3>
        <ul>
          <li>
            A <strong>root secret</strong> supplied at deploy time, plus an optional{" "}
            <strong>active key id</strong> and <strong>key registry</strong> so keys can be rotated.
          </li>
          <li>
            <Term>HKDF</Term>-SHA256 derives a 32-byte key per user from the root secret. No
            per-user keys are stored. Compromise of the root secret still exposes every user, which
            is why a key management service is the next step.
          </li>
          <li>
            <Term>AAD</Term> binds each ciphertext to its user id, thread id and field name, so
            ciphertext copied into another record fails to decrypt.
          </li>
          <li>The crypto module is server-only and never imported by client code.</li>
        </ul>

        <h3>The stored format</h3>
        <p>
          Every encrypted value describes itself: a version, the key that sealed it, the{" "}
          <Term>IV</Term>, the authentication tag and the ciphertext. That is what allows algorithm
          upgrades, key rotation and mixed rows. A value that does not start with <code>enc:</code>{" "}
          is returned as plaintext.
        </p>
        <BlogCode caption="One encrypted value." code={PAYLOAD} language="text" />

        <h3>Long-term memory</h3>
        <p>
          Long-term memory lives in a separate vector store (Mem0 on Qdrant). A server-side wrapper
          can encrypt the readable text fields on the way in and decrypt them on search. The{" "}
          <Term>embedding</Term> that makes semantic search work stays readable by design:
          scrambling it would break the search. Embeddings are numbers, not words, but they can
          still reveal what a memory is about, so this is a trade-off, not a guarantee. It uses
          AES-256-GCM with its own key material and its own wire format. The reader-friendly version
          is <Link href="/blog/how-we-secure-memory">How we protect your memories</Link>.
        </p>

        <h3>Where it runs</h3>
        <BlogFigure caption="Three layers, one job each. The data layer holds messages and both summaries. The LLM layer decrypts a summary for context and encrypts it again after an update.">
          <MermaidDiagram code={LAYERS_MERMAID} />
        </BlogFigure>

        <h2>Where data is encrypted</h2>
        <p>
          A message crosses two protected links and rests once, as ciphertext. The animation shows
          the same path in motion.
        </p>
        <BlogFigure>
          <PipelineDiagram sections={PIPELINE_SECTIONS} />
        </BlogFigure>
        <BlogFigure caption="Your message and the encrypted payloads move through TLS; the boundaries stay still.">
          <PipelineAnimation />
        </BlogFigure>

        <h3>What this gets us</h3>
        <ul>
          <li>
            <strong>A leaked database copy</strong> shows ciphertext for message content and
            summaries.
          </li>
          <li>
            <strong>Swapped or tampered rows</strong> are detected by the authentication tag and the
            bound AAD.
          </li>
          <li>
            <strong>A narrower blast radius</strong> for a single user&apos;s key, though not for
            the root secret.
          </li>
          <li>
            <strong>A safe rollout</strong>: mixed plaintext and encrypted rows, no downtime, no
            one-shot migration.
          </li>
        </ul>

        <h3>What it does not do</h3>
        <ul>
          <li>It does not protect against a compromised server or its secrets.</li>
          <li>It does not hide anything from the model provider you choose for a turn.</li>
          <li>It does not encrypt titles, timestamps or identifiers.</li>
        </ul>
      </BlogSection>
    </>
  );
}
