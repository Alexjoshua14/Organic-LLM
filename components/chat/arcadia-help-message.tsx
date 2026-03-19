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
    { key: "concise", label: "Brief answers; expand on request." },
    { key: "tools-first", label: "Tools over long paragraphs." },
    { key: "mermaid", label: "Flowcharts and diagrams inline." },
  ],
  sandbox: {
    lines: ["New prompts", "New tools", "New UI ideas", "land here first"],
    sub: "Main chat stays safe.",
  },
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
        <section className={cn(glass(), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="size-3.5 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Capabilities</h3>
          </div>
          <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs items-baseline">
            {CONTENT.capabilities.map((item) => (
              <li key={item.key} className="contents">
                <span className="font-mono shrink-0" style={{ color: FOREST.helpText }}>{item.key}</span>
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(glass(), "rounded-xl border p-3")}>
          <div className="flex items-center gap-2 mb-2">
            <Box className="size-3.5 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">Sandbox</h3>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-light text-foreground leading-tight tracking-wide text-left pl-0">
              {CONTENT.sandbox.lines[0]}
            </p>
            <p className="text-sm font-light text-foreground leading-tight tracking-wide text-center pl-3">
              {CONTENT.sandbox.lines[1]}
            </p>
            <p className="text-sm font-light text-foreground leading-tight tracking-wide text-right pl-6">
              {CONTENT.sandbox.lines[2]}
            </p>
            <p className="text-xs font-semibold text-foreground leading-tight tracking-wide w-full text-center py-0.5 border-t border-border/50 mt-1">
              {CONTENT.sandbox.lines[3]}
            </p>
            <p className="text-[11px] italic text-muted-foreground leading-tight pt-0.5 text-center">
              {CONTENT.sandbox.sub}
            </p>
          </div>
        </section>

        <section className={cn(glass(), "rounded-xl border p-3")}>
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

        <section className={cn(glass(), "rounded-xl border p-3")}>
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
        <section className={cn(glass(), "rounded-xl border p-4")}>
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid className="size-4 shrink-0" style={{ color: FOREST.accent }} aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Capabilities</h3>
          </div>
          <ul className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm items-baseline">
            {CONTENT.capabilities.map((item) => (
              <li key={item.key} className="contents">
                <span className="font-mono shrink-0" style={{ color: FOREST.helpText }}>{item.key}</span>
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(glass(), "rounded-xl border p-4")}>
          <div className="flex items-center gap-2 mb-3">
            <Box className="size-4 text-amber-500/80 shrink-0" aria-hidden />
            <h3 className="text-sm font-medium uppercase tracking-wider text-foreground-secondary">Sandbox</h3>
          </div>
          <div className="space-y-1">
            <p className="text-base font-light text-foreground leading-tight tracking-wide text-left pl-0">
              {CONTENT.sandbox.lines[0]}
            </p>
            <p className="text-base font-light text-foreground leading-tight tracking-wide text-center pl-4">
              {CONTENT.sandbox.lines[1]}
            </p>
            <p className="text-base font-light text-foreground leading-tight tracking-wide text-right pl-8">
              {CONTENT.sandbox.lines[2]}
            </p>
            <p className="text-sm font-semibold text-foreground leading-tight tracking-wide w-full text-center py-1 border-t border-border/50 mt-1.5">
              {CONTENT.sandbox.lines[3]}
            </p>
            <p className="text-xs italic text-muted-foreground leading-tight pt-0.5 text-center">
              {CONTENT.sandbox.sub}
            </p>
          </div>
        </section>

        <section className={cn(glass(), "rounded-xl border p-4 sm:col-span-2")}>
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

        <section className={cn(glass(), "rounded-xl border p-4 sm:col-span-2")}>
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
