"use client";

import Link from "next/link";
import { useRef } from "react";

import Page from "@/components/layout/page";
import { ReturnButton } from "@/components/ReturnButton";
import { TermWithDefinition } from "@/components/blog/term-with-definition";
import { DecryptedText } from "@/components/privacy/DecryptedText";
import { PrivacyFeatureCard } from "@/components/privacy/PrivacyFeatureCard";
import { ScrollOutDisappear } from "@/components/privacy/ScrollOutDisappear";
import { glass } from "@/components/design-system/primitives";
import { PROSE_CLASS } from "@/components/blog/blog-prose";
import { cn } from "@/lib/utils";

const onThisPageCardClass = cn(
  glass(),
  "relative flex min-h-0 min-w-0 w-full shrink cursor-pointer items-center justify-center rounded-lg no-underline px-4 py-2 text-sm text-foreground transition-transform duration-200 hover:scale-105",
  "after:absolute after:bottom-2 after:left-2 after:right-2 after:block after:h-0.5 after:scale-x-0 after:bg-foreground after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 after:origin-center",
);

export default function PrivacyAndSecurityPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <Page>
      <div className="flex w-full items-center justify-between border-b border-border pl-20 pr-4 py-3 md:pl-8 md:pr-8">
        <ReturnButton />
        <h1 className="text-lg font-semibold text-foreground">
          Privacy & Security
        </h1>
        <div aria-hidden className="w-20" />
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 w-full overflow-auto scroll-smooth px-4 py-6 md:px-8"
      >
        <div
          className={cn(
            "mx-auto max-w-2xl space-y-10 [&_a]:no-underline",
            PROSE_CLASS,
          )}
        >
          <div className="space-y-2">
            <p className="text-2xl font-medium text-foreground">
              We take privacy and security seriously.
            </p>
            <p className="text-sm italic leading-tight text-muted-foreground">
              This page explains how Organic LLM handles your data, what we
              store, what we send to third-party services, and the choices you
              have.
            </p>
          </div>

          <nav aria-label="On this page" className="rounded-lg border border-border/50 bg-background-tertiary/25 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">On this page</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              <a href="#what-we-do" className={onThisPageCardClass}>
                What we do
              </a>
              <a href="#data-we-store" className={onThisPageCardClass}>
                Data we store
              </a>
              <a href="#third-parties" className={onThisPageCardClass}>
                Third parties
              </a>
              <a href="#security" className={onThisPageCardClass}>
                Security
              </a>
              <a href="#your-choices" className={onThisPageCardClass}>
                Your choices
              </a>
              <a href="#encryption" className={onThisPageCardClass}>
                Encryption
              </a>
              <a href="#contact" className={onThisPageCardClass}>
                Contact
              </a>
            </div>
          </nav>

          <section id="what-we-do">
            <h2 className="text-foreground">What we do</h2>
            <div className="mx-auto mt-2 w-full max-w-384">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PrivacyFeatureCard
                  title={<DecryptedText text="Encryption" speed={60} loop />}
                  subtitle="Your data stays protected"
                  body="Conversations and personalized content are encrypted at rest using AES-256, so sensitive data stays protected in our systems."
                />
                <PrivacyFeatureCard
                  title={
                    <span className="font-mono text-foreground">
                      [REDACTION]
                    </span>
                  }
                  subtitle="Common personal data is redacted before even leaving your device"
                  body="Safeguards ensure that even if you accidentally enter personal information such as emails, phone numbers, SSNs, and credit cards, we will never look at it."
                />
                <PrivacyFeatureCard
                  title="We don't sell your data"
                  subtitle="We will never share or sell your data for ads"
                  body="We do not sell or share your data for advertising. We use analytics only to improve Organic LLM, and your conversation content is not included in analytics."
                />
                <ScrollOutDisappear scrollContainerRef={scrollContainerRef}>
                  <PrivacyFeatureCard
                    title="Zero Data Retention"
                    subtitle="We support third-party ZDR"
                    body="You can opt in to zero data retention at any time. When enabled, we instruct supported external LLM providers not to retain your prompts, outputs, or other request data after processing—so your conversations stay yours."
                  />
                </ScrollOutDisappear>
              </div>
            </div>
          </section>

          <section id="data-we-store">
            <h2 className="text-foreground">Data we store</h2>
            <p className="text-foreground">
              We store your threads and messages in our database.
              Message and summary content is protected with{" "}
              <TermWithDefinition
                term="encryption at rest"
                definition="Data is encrypted before being written to the database (AES-256-GCM). Only the application can decrypt it with the correct keys; database admins see ciphertext only."
              />
              . Access to your data is restricted by{" "}
              <TermWithDefinition
                term="Row Level Security"
                definition="Row Level Security; database policies that ensure each user can only read or write their own rows (e.g. their own threads and messages)."
              />
              —you only see and modify your own conversations. We also store
              preferences and some session data in your browser (localStorage);
              that data stays on your device and is not sent to our servers
              except as part of normal requests (e.g. settings you choose).
            </p>
            <p className="mt-2 text-foreground">
              The Zero Data Retention setting applies to external LLM providers
              (so they do not retain your data). It does not change how long
              Organic LLM keeps your threads and messages in our own database;
              you can delete threads and use the options in Settings to control
              memory and retention. Organic LLM aims to provide you full control
              over your data and privacy.
            </p>
          </section>

          <section id="third-parties">
            <h2 className="text-foreground">Data we send to third parties</h2>
            <p className="text-foreground">
              To provide chat, search, voice, and memory, we send certain data
              to trusted partners:
            </p>
            <ul className="list-inside list-disc space-y-1 text-foreground">
              <li>
                <strong>LLM providers</strong> (e.g. OpenAI, Anthropic): Your
                conversation context is sent so the model can respond. When Zero
                Data Retention is on, we request that they do not retain your
                data.
              </li>
              <li>
                <strong>Exa</strong>: Search queries (and optionally URLs) for
                web search and research features.
              </li>
              <li>
                <strong>ElevenLabs</strong>: Text you choose to convert to
                speech (TTS).
              </li>
              <li>
                <strong>Memory (Mem0 Platform)</strong>: When memory is
                enabled, we use Mem0 Platform to store and retrieve
                conversation-based memory so the assistant can remember context
                across threads. We are moving toward Mem0 Platform for
                production use and are considering allowing users to host their
                own memory databases in the future; memory configuration may
                evolve.
              </li>
              <li>
                <strong>Analytics</strong>: We will never sell or share your
                data for ads, and we do not include your conversation content in
                analytics. We use analytics only for product improvement—things
                like page views and performance metrics—and we're transparent
                about that.
              </li>
            </ul>
          </section>

          <section id="security">
            <h2 className="text-foreground">Security measures</h2>
            <div className="mt-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Authentication
                </h3>
                <p className="mt-1 text-foreground">
                  We use Clerk as our authentication provider. Clerk supports
                  passkeys and biometrics so you can sign in without passwords
                  when you choose. All access to the app is gated by your
                  verified identity.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Data access
                </h3>
                <p className="mt-1 text-foreground">
                  Access to your data is scoped by your identity. Our database
                  enforces{" "}
                  <TermWithDefinition
                    term="RLS"
                    definition="Row Level Security; database policies that ensure each user can only read or write their own rows (e.g. their own threads and messages)."
                  />{" "}
                  so that you can only access your own threads, messages, and
                  related data.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Rate limiting
                </h3>
                <p className="mt-1 text-foreground">
                  We apply rate limits to protect against abuse and to keep the
                  service stable for everyone.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Secure connections
                </h3>
                <p className="mt-1 text-foreground">
                  All traffic between your device and our servers is encrypted
                  in transit (TLS).
                </p>
              </div>
            </div>
          </section>

          <section id="your-choices">
            <h2 className="text-foreground">Your choices</h2>
            <p className="text-foreground">
              In Settings you can enable{" "}
              <TermWithDefinition
                term="Zero Data Retention"
                definition="When enabled, we instruct external LLM providers not to retain your prompts, outputs, or other data after the request. Your data is not used to train their models or stored on their side."
              />
              {" "}so that external LLMs do not retain your data. You can also
              control whether we redact common{" "}
              <TermWithDefinition
                term="Personally Identifiable Information"
                definition="Personally Identifiable Information; data that can identify an individual, such as email, phone number, SSN, or credit card number. We redact these with placeholders before sending text to external services when the option is on."
              />{" "}
              before sending text to external services (default on). You can
              disable memory or delete threads to limit what is stored. Account
              deletion is not yet implemented in the app; to request deletion of
              your account and data, please contact us at{" "}
              <a
                href="mailto:coalescencelabs@gmail.com"
                className="text-foreground hover:text-foreground/90"
              >
                coalescencelabs@gmail.com
              </a>
              .
            </p>
          </section>

          <section id="encryption">
            <h2 className="text-foreground">Encryption</h2>
            <p className="text-foreground">
              Sensitive chat and summary content is encrypted before being
              stored in our database (application-layer encryption with
              AES-256-GCM). That means even with access to the database, your
              message content appears as ciphertext. Data in transit between you
              and our servers is protected with TLS. We do not use end-to-end
              encryption for the main chat flow (the server and LLM providers
              need to process plaintext to generate responses); the encryption we
              use protects your data at rest in our systems.
            </p>
          </section>

          <section>
            <h2 className="text-foreground">Logging</h2>
            <p className="text-foreground">
              When we use third-party logging or monitoring, we only send
              non-sensitive operational data—such as performance and usage
              metrics—not your conversation content, memories, or other
              private data.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-foreground">Contact</h2>
            <p className="text-foreground">
              For deletion requests, privacy questions, or security concerns,
              contact us at{" "}
              <a
                href="mailto:coalescencelabs@gmail.com"
                className="text-foreground hover:text-foreground/90"
              >
                coalescencelabs@gmail.com
              </a>
              .
            </p>
          </section>

          <nav className="pt-4">
            <Link
              href="/settings"
              className="text-sm text-foreground hover:text-foreground/90"
            >
              ← Back to Settings
            </Link>
          </nav>
        </div>
      </div>
    </Page>
  );
}
