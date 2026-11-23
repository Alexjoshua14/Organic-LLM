"use client";

import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import { GenUiInstructionPanel } from "./GenUiInstructionPanel";

import { instructionDocForArchetype } from "@/lib/sandbox/gen-ui-lab-instructions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { cn } from "@/lib/utils";

const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

export type GenUiPreviewSize = "full" | "condensed";

type ViewTab = "component" | "instructions";

type GenUiArchetypeViewTabsProps = {
  archetype: string;
  children: ReactNode;
  condensedPreview?: ReactNode;
  sizeControl?: { value: GenUiPreviewSize; onChange: (size: GenUiPreviewSize) => void };
};

/**
 * Per-archetype tabs: live component render vs structured model instructions
 * (eyebrow header + collapsible sections).
 */
export function GenUiArchetypeViewTabs({
  archetype,
  children,
  condensedPreview,
  sizeControl,
}: GenUiArchetypeViewTabsProps) {
  const [tab, setTab] = useState<ViewTab>("component");
  const [localSize, setLocalSize] = useState<GenUiPreviewSize>("full");
  const size = sizeControl?.value ?? localSize;
  const changeSize = sizeControl?.onChange ?? setLocalSize;
  const doc = useMemo(() => instructionDocForArchetype(archetype), [archetype]);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ViewTab)} className="w-full">
      <TabsList
        aria-label={`${archetype} view`}
        className="mb-stack-md h-auto min-h-11 w-full justify-start gap-inline-xs bg-muted/40 p-1"
      >
        <TabsTrigger
          value="component"
          className={cn(
            LAB_CONTROL,
            "min-h-9 flex-1 rounded-md px-inset-md text-sm shadow-none data-[state=active]:bg-background data-[state=active]:shadow-none"
          )}
        >
          Component
        </TabsTrigger>
        <TabsTrigger
          value="instructions"
          className={cn(
            LAB_CONTROL,
            "min-h-9 flex-1 rounded-md px-inset-md text-sm shadow-none data-[state=active]:bg-background data-[state=active]:shadow-none"
          )}
        >
          Model instructions
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="component"
        className="mt-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {condensedPreview || sizeControl ? (
          <label className="mb-stack-sm flex flex-wrap items-center justify-between gap-inline-sm text-sm text-muted-foreground">
            Preview size
            <select
              className="organic-focus min-h-9 rounded-md border border-border bg-background px-inset-sm text-sm text-foreground pointer-coarse:min-h-11"
              value={size}
              onChange={(event) =>
                changeSize(event.target.value === "condensed" ? "condensed" : "full")
              }
            >
              <option value="full">Full</option>
              <option value="condensed">Condensed</option>
            </select>
          </label>
        ) : null}
        <section aria-label="Component preview" className="min-w-0">
          {size === "condensed" && condensedPreview ? condensedPreview : children}
        </section>
      </TabsContent>

      <TabsContent
        value="instructions"
        className="mt-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {doc ? (
          <GenUiInstructionPanel doc={doc} />
        ) : (
          <article className="rounded-2xl bg-muted/30 p-inset-md">
            <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
              Gen UI · Model instructions
            </p>
            <h2 className="mt-stack-xs font-commissioner text-xl font-light tracking-tight text-foreground">
              {archetype}
            </h2>
            <p className="mt-stack-sm text-sm text-muted-foreground">
              No model instructions for this lab page.
            </p>
          </article>
        )}
      </TabsContent>
    </Tabs>
  );
}
