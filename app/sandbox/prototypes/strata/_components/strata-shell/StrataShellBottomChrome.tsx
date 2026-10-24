"use client";

import type { StrataMainTab } from "./strata-shell-model";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function StrataShellBottomChrome({
  showGenerationStrip,
  overwriteElaborated,
  setOverwriteElaborated,
  isGenerating,
  onGenerate,
  mode,
  tabDefs,
  activeTab,
  setActiveTab,
}: {
  showGenerationStrip: boolean;
  overwriteElaborated: boolean;
  setOverwriteElaborated: (v: boolean) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  mode: "create" | "update";
  tabDefs: { id: StrataMainTab; label: string }[];
  activeTab: StrataMainTab;
  setActiveTab: (tab: StrataMainTab) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {showGenerationStrip ? (
        <div
          className={cn(
            glass({ opaque: true }),
            "pointer-events-auto flex w-fit max-w-md flex-wrap items-center justify-center gap-3 rounded-xl border px-3 py-2.5 shadow-md sm:justify-end"
          )}
        >
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              checked={overwriteElaborated}
              type="checkbox"
              onChange={(e) => setOverwriteElaborated(e.target.checked)}
            />
            Overwrite elaborated when updating
          </label>
          <button
            data-dim-background
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={isGenerating}
            type="button"
            onClick={onGenerate}
          >
            {isGenerating ? "Working…" : mode === "create" ? "Generate" : "Regenerate"}
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          glass({ opaque: true }),
          "pointer-events-auto inline-flex gap-1 rounded-full border border-border/70 p-1 shadow-md"
        )}
        role="tablist"
        aria-label="Strata main sections"
      >
        {tabDefs.map((t) => (
          <button
            key={t.id}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              activeTab === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            role="tab"
            type="button"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
