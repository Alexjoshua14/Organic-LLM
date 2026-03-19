"use client";

import { FC } from "react";
import { LayoutGrid, Box, PanelRightOpen, Sparkles } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/** Forest green palette from Arcadia help foundation (dark green fabric). */
const FOREST = {
  /** Headers / accents — brightened for readability */
  accent: "#2e7d46",
  /** Highlight / raised ridges */
  highlight: "#1b4d2e",
  /** Help text — desaturated light green */
  helpText: "#a8c9b2",
} as const;

const CONTENT = {
  tagline: "Sandbox chat inside Organic LLM. Same app, same threads; a dedicated place to experiment.",
  capabilities: [
    { key: "concise", label: "Short answers (~1 screen on mobile). Offer to expand if you need depth." },
    { key: "tools-first", label: "Prefer tool use over long prose. I synthesize; I don't dump raw output." },
    { key: "mermaid", label: "Ask for a diagram → I generate Mermaid (flowcharts, sequences). Renders inline." },
  ],
  sandbox: [
    "New prompts, context shapes, tools, or UI ideas land here first.",
    "Main chat stays stable. If something breaks, it's only in Arcadia.",
  ],
  sidebar: [
    "On: One list — main + Arcadia threads (Arcadia rows: forest-green hint, brown-glass on hover).",
    "Off: Main chat only. Arcadia threads still exist; open via sandbox or direct link.",
  ],
  tryExamples: [
    "Draw a flowchart for X",
    "Summarize Y in three bullets.",
  ],
};

export const ArcadiaHelpMessage: FC<{ className?: string }> = ({ className }) => {
  return (
    <article
      className={cn("arcadia-help not-prose w-full overflow-hidden", className)}
      aria-label="Arcadia capabilities and usage"
    >
      {/* Header: same on mobile and desktop */}
      <header className="mb-3 sm:mb-4">
        <h2
          className="text-base sm:text-lg font-semibold tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(to right, ${FOREST.highlight}, ${FOREST.accent}, var(--foreground))`,
          }}
        >
          Arcadia
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug max-w-xl">
          {CONTENT.tagline}
        </p>
      </header>

      {/* Mobile: single column, compact cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="size-3.5 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Capabilities</h3>
          </div>
          <ul className="space-y-1.5 text-xs text-foreground">
            {CONTENT.capabilities.map((item) => (
              <li key={item.key} className="flex gap-2">
                <span className="font-mono shrink-0" style={{ color: FOREST.helpText }}>{item.key}</span>
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-2">
            <Box className="size-3.5 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Sandbox</h3>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            {CONTENT.sandbox.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-2">
            <PanelRightOpen className="size-3.5 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Sidebar (Coalescence)</h3>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            {CONTENT.sidebar.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="size-3.5 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Try</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            &ldquo;{CONTENT.tryExamples[0]}&rdquo; or &ldquo;{CONTENT.tryExamples[1]}&rdquo;
          </p>
        </section>
      </div>

      {/* Desktop: two-column grid, slightly larger */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-3">
        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-4")}>
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid className="size-4 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Capabilities</h3>
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            {CONTENT.capabilities.map((item) => (
              <li key={item.key} className="flex gap-2">
                <span className="font-mono shrink-0" style={{ color: FOREST.helpText }}>{item.key}</span>
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-4")}>
          <div className="flex items-center gap-2 mb-3">
            <Box className="size-4 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Sandbox</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            {CONTENT.sandbox.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-4 sm:col-span-2")}>
          <div className="flex items-center gap-2 mb-3">
            <PanelRightOpen className="size-4 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Sidebar (Coalescence Mode)</h3>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            {CONTENT.sidebar.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className={cn(glass({ tone: "brown", border: "all" }), "rounded-xl border p-4 sm:col-span-2")}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Try</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            &ldquo;{CONTENT.tryExamples[0]}&rdquo; or &ldquo;{CONTENT.tryExamples[1]}&rdquo;
          </p>
        </section>
      </div>
    </article>
  );
};
