"use client";

import type { Dispatch, SetStateAction } from "react";
import type { StrataPageWithSections, StrataSectionKey } from "@/lib/schemas/strata";

import { SectionCard } from "../SectionCard";

import { NOTEBOOK_FOCUS_CLASS } from "./strata-shell-model";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function StrataSettingsTab({
  localOnlyMode,
  dbAvailable,
  onLocalOnlyChange,
  labels,
  sections,
  setSections,
  onSaveSection,
}: {
  localOnlyMode: boolean;
  dbAvailable: boolean;
  onLocalOnlyChange: (enabled: boolean) => void;
  labels: {
    design_instructions: { title: string; subtitle: string };
    ai_instructions: { title: string; subtitle: string };
  };
  sections: StrataPageWithSections["sections"];
  setSections: Dispatch<SetStateAction<StrataPageWithSections["sections"]>>;
  onSaveSection: (key: StrataSectionKey, content: string) => void;
}) {
  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
        <input
          id="strata-local-only"
          aria-describedby="strata-local-only-hint"
          checked={localOnlyMode}
          className="mt-1 shrink-0"
          disabled={!dbAvailable}
          type="checkbox"
          onChange={(e) => onLocalOnlyChange(e.target.checked)}
        />
        <label className="flex min-w-0 cursor-pointer flex-col gap-1" htmlFor="strata-local-only">
          <span className="font-medium text-foreground">Local-only for this page (ZDR)</span>
          <span className="text-xs text-muted-foreground" id="strata-local-only-hint">
            When enabled, this page stays on your device and is not written to Supabase.
          </span>
        </label>
      </div>

      <SectionCard
        subtitle={labels.design_instructions.subtitle}
        title={labels.design_instructions.title}
        variant="system"
      >
        <div className="flex flex-col gap-3">
          <textarea
            data-dim-background="full"
            className={cn(
              "min-h-[22dvh] w-full resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
              NOTEBOOK_FOCUS_CLASS
            )}
            value={sections.design_instructions.content}
            onChange={(e) =>
              setSections((prev) => ({
                ...prev,
                design_instructions: {
                  ...prev.design_instructions,
                  content: e.target.value,
                },
              }))
            }
          />
          <button
            className={cn(
              glass({ opaque: true }),
              "w-fit rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            )}
            type="button"
            onClick={() =>
              onSaveSection("design_instructions", sections.design_instructions.content)
            }
          >
            Save design instructions
          </button>
        </div>
      </SectionCard>

      <SectionCard
        subtitle={labels.ai_instructions.subtitle}
        title={labels.ai_instructions.title}
        variant="system"
      >
        <div className="flex flex-col gap-3">
          <textarea
            data-dim-background="full"
            className={cn(
              "min-h-[22dvh] w-full resize-y rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-6 text-muted-foreground",
              NOTEBOOK_FOCUS_CLASS
            )}
            value={sections.ai_instructions.content}
            onChange={(e) =>
              setSections((prev) => ({
                ...prev,
                ai_instructions: { ...prev.ai_instructions, content: e.target.value },
              }))
            }
          />
          <button
            className={cn(
              glass({ opaque: true }),
              "w-fit rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            )}
            type="button"
            onClick={() => onSaveSection("ai_instructions", sections.ai_instructions.content)}
          >
            Save AI instructions
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
