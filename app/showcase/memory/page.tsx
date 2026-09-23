"use client";

/**
 * Showcase snapshot: Memory UI.
 * Layout/content is fixed here until you rebase from app/sandbox/memory/page.tsx.
 * Shared components (MemoryLens, MemoryLensCard, etc.) update automatically.
 */

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { MemoryLens } from "@/components/memory/memory-lens";
import { MemoryLensCard } from "@/components/memory/memory-lens-card";
import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import { PhoneMockup } from "@/components/sandbox/phone-mockup";
import { sampleMemories } from "@/test-data/sampleData";

const initialSampleItems = sampleMemories[0].results.slice(0, 4);
const sampleRetrieved = [
  { memory: "User prefers dark mode for all applications and interfaces." },
  { memory: "User is working on a web application with AI chat and memory." },
];
const sampleAdded = [{ memory: "User asked to preview memory UI components in the sandbox." }];

export default function MemoryShowcasePage() {
  return (
    <Page
      liquidChromeBackground
      transparentBackground
      className="items-stretch justify-start overflow-hidden"
    >
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame>
          <PageNavBack className="mb-8" href="/showcase">
            ← Showcase
          </PageNavBack>

          <div className="mb-10 text-center sm:text-left">
            <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              Memory UI preview
            </h1>
            <p className="mx-auto max-w-2xl select-none text-sm text-muted-foreground sm:mx-0">
              Persisted memory lens, cards, and ephemeral in-chat components.
            </p>
          </div>

          {/* Live Memory Lens: semantic search, 5 results (signed-in user) */}
          <section className="mb-14">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
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
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Memory lens cards (sample)
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Click Remove to see the exit animation.
            </p>
            <div className="flex flex-col gap-3">
              {initialSampleItems.map((m) => (
                <MemoryLensCard key={m.id} compact={false} previewRemove memory={m} />
              ))}
            </div>
          </section>

          {/* Compact card */}
          <section className="mb-14">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Compact card
            </h2>
            <div className="max-w-md">
              <MemoryLensCard compact previewRemove memory={initialSampleItems[0]} />
            </div>
          </section>

          {/* Ephemeral cards */}
          <section>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Ephemeral cards (in-chat)
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Shown when memory is retrieved or updated in a thread. Auto-dismiss disabled in this
              preview.
            </p>
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <MemoryEphemeralCards
                added={sampleAdded}
                autoClearMs={0}
                retrieved={sampleRetrieved}
              />
            </div>
          </section>

          {/* Phone mockup: desktop/tablet only (hidden on phone viewports) */}
          <section
            aria-labelledby="phone-preview-heading"
            className="mb-14 mt-14 hidden md:flex md:flex-col md:items-center"
          >
            <h2 className="sr-only" id="phone-preview-heading">
              Phone preview
            </h2>
            <PhoneMockup label="Memory lens + ephemeral cards">
              <div className="flex flex-col gap-3 text-[11px]">
                <header className="space-y-0.5">
                  <h3 className="bg-linear-to-b from-cyan-400 to-emerald-500 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
                    Persisted memory
                  </h3>
                  <p className="leading-snug text-muted-foreground">
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
        </PageContentFrame>
      </div>
    </Page>
  );
}
