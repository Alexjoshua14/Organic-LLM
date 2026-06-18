"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Page from "@/components/layout/page";
import { MemoryLens } from "@/components/memory/memory-lens";
import { MemoryLensCard } from "@/components/memory/memory-lens-card";
import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import { InChatMemoryDemo } from "@/components/sandbox/in-chat-memory-demo";
import { PhoneMockup } from "@/components/sandbox/phone-mockup";
import { sampleMemories } from "@/test-data/sampleData";

const initialSampleItems = sampleMemories[0].results.slice(0, 4);
const sampleRetrieved = [
  { memory: "User prefers dark mode for all applications and interfaces." },
  { memory: "User is working on a web application with AI chat and memory." },
];
const sampleAdded = [{ memory: "User asked to preview memory UI components in the sandbox." }];

export default function MemorySandboxPage() {
  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <div className="w-full max-w-2xl mx-auto p-6">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          href="/sandbox"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">Memory UI preview</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Persisted memory lens, cards, and ephemeral in-chat components.
        </p>

        {/* In-chat Memory UI: streaming messages + ephemeral cards */}
        <section aria-labelledby="in-chat-demo-heading" className="mb-14">
          <h2
            className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4"
            id="in-chat-demo-heading"
          >
            In-chat memory UI (demo)
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-xl">
            Simulated Remy chat: user message, then retrieved memories, then the assistant reply
            streaming in with new memories saved mid-stream. Use &quot;View persisted memory&quot;
            to open the lens sheet.
          </p>
          <InChatMemoryDemo className="w-full max-w-xl" />
        </section>

        {/* Live Memory Lens: semantic search, 5 results (signed-in user) */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Memory Lens (live)
          </h2>
          <MemoryLens
            searchLimit={5}
            searchQuery="Organic LLM elevator pitch, career ambitions, and what matters to me"
            variant="inline"
          />
        </section>

        {/* Card preview with sample data */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Memory lens cards (sample)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Click Remove to see the exit animation.
          </p>
          <div className="flex flex-col gap-3">
            {initialSampleItems.map((m) => (
              <MemoryLensCard key={m.id} previewRemove compact={false} memory={m} />
            ))}
          </div>
        </section>

        {/* Compact card */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Compact card
          </h2>
          <div className="max-w-md">
            <MemoryLensCard compact previewRemove memory={initialSampleItems[0]} />
          </div>
        </section>

        {/* Ephemeral cards */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Ephemeral cards (in-chat)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Shown when memory is retrieved or updated in a thread. Auto-dismiss disabled in this
            preview.
          </p>
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <MemoryEphemeralCards added={sampleAdded} autoClearMs={0} retrieved={sampleRetrieved} />
          </div>
        </section>

        {/* Phone mockup: desktop/tablet only (hidden on phone viewports) */}
        <section
          aria-labelledby="phone-preview-heading"
          className="mt-14 mb-14 hidden md:flex md:flex-col md:items-center"
        >
          <h2 className="sr-only" id="phone-preview-heading">
            Phone preview
          </h2>
          <PhoneMockup label="Memory lens + ephemeral cards">
            <div className="flex flex-col gap-3 text-[11px]">
              <header className="space-y-0.5">
                <h3 className="text-sm font-semibold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-cyan-400 to-emerald-500">
                  Persisted memory
                </h3>
                <p className="text-muted-foreground leading-snug">
                  Stored and retrievable across any thread.
                </p>
              </header>
              <div className="flex flex-col gap-2">
                {initialSampleItems.slice(0, 2).map((m) => (
                  <MemoryLensCard key={m.id} compact previewRemove memory={m} />
                ))}
              </div>
              <MemoryEphemeralCards
                added={sampleAdded}
                autoClearMs={0}
                retrieved={sampleRetrieved}
              />
            </div>
          </PhoneMockup>
        </section>
        </div>
      </div>
    </Page>
  );
}
