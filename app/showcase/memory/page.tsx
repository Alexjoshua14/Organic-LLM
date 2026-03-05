"use client";

/**
 * Showcase snapshot: Memory UI.
 * Layout/content is fixed here until you rebase from app/sandbox/memory/page.tsx.
 * Shared components (MemoryLens, MemoryLensCard, etc.) update automatically.
 */

import Link from "next/link";
import Page from "@/components/layout/page";
import { MemoryLens } from "@/components/memory/memory-lens";
import { MemoryLensCard } from "@/components/memory/memory-lens-card";
import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import { PhoneMockup } from "@/components/sandbox/phone-mockup";
import { sampleMemories } from "@/test-data/sampleData";
import { ArrowLeft } from "lucide-react";

const initialSampleItems = sampleMemories[0].results.slice(0, 4);
const sampleRetrieved = [
  { memory: "User prefers dark mode for all applications and interfaces." },
  { memory: "User is working on a web application with AI chat and memory." },
];
const sampleAdded = [
  { memory: "User asked to preview memory UI components in the sandbox." },
];

export default function MemoryShowcasePage() {
  return (
    <Page>
      <div className="w-full max-w-2xl mx-auto p-6 pb-16">
        <Link
          href="/showcase"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" />
          Showcase
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Memory UI preview
        </h1>
        <p className="text-muted-foreground text-sm mb-10">
          Persisted memory lens, cards, and ephemeral in-chat components.
        </p>

        {/* Live Memory Lens: semantic search, 5 results (signed-in user) */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Memory Lens (live)
          </h2>
          <MemoryLens
            variant="inline"
            searchQuery="Organic LLM elevator pitch, career ambitions, and what matters to me"
            searchLimit={5}
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
              <MemoryLensCard
                key={m.id}
                memory={m}
                compact={false}
                previewRemove
              />
            ))}
          </div>
        </section>

        {/* Compact card */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Compact card
          </h2>
          <div className="max-w-md">
            <MemoryLensCard
              memory={initialSampleItems[0]}
              compact
              previewRemove
            />
          </div>
        </section>

        {/* Ephemeral cards */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Ephemeral cards (in-chat)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Shown when memory is retrieved or updated in a thread. Auto-dismiss
            disabled in this preview.
          </p>
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <MemoryEphemeralCards
              retrieved={sampleRetrieved}
              added={sampleAdded}
              autoClearMs={0}
            />
          </div>
        </section>

        {/* Phone mockup: desktop/tablet only (hidden on phone viewports) */}
        <section className="mt-14 mb-14 hidden md:flex md:flex-col md:items-center" aria-labelledby="phone-preview-heading">
          <h2 id="phone-preview-heading" className="sr-only">
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
                  <MemoryLensCard
                    key={m.id}
                    memory={m}
                    compact
                    previewRemove
                  />
                ))}
              </div>
              <MemoryEphemeralCards
                retrieved={sampleRetrieved}
                added={sampleAdded}
                autoClearMs={0}
              />
            </div>
          </PhoneMockup>
        </section>
      </div>
    </Page>
  );
}
