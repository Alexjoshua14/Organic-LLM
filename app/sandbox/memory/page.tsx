"use client";

import Link from "next/link";
import Page from "@/components/layout/page";
import { MemoryLens } from "@/components/memory/memory-lens";
import { MemoryLensCard } from "@/components/memory/memory-lens-card";
import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import { sampleMemories } from "@/test-data/sampleData";
import { ArrowLeft } from "lucide-react";

const sampleItems = sampleMemories[0].results.slice(0, 4);
const sampleRetrieved = [
  { memory: "User prefers dark mode for all applications and interfaces." },
  { memory: "User is working on a web application with AI chat and memory." },
];
const sampleAdded = [
  { memory: "User asked to preview memory UI components in the sandbox." },
];

export default function MemorySandboxPage() {
  return (
    <Page>
      <div className="w-full max-w-2xl mx-auto p-6 pb-16">
        <Link
          href="/sandbox"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Memory UI preview
        </h1>
        <p className="text-muted-foreground text-sm mb-10">
          Persisted memory lens, cards, and ephemeral in-chat components.
        </p>

        {/* Live Memory Lens (uses getCurrentUserMemories when signed in) */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Memory Lens (live)
          </h2>
          <MemoryLens variant="inline" />
        </section>

        {/* Card preview with sample data */}
        <section className="mb-14">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Memory lens cards (sample)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Delete does not run in this preview — cards use sample data.
          </p>
          <div className="flex flex-col gap-3">
            {sampleItems.map((m) => (
              <MemoryLensCard key={m.id} memory={m} compact={false} />
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
              memory={sampleItems[0]}
              compact
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
      </div>
    </Page>
  );
}
