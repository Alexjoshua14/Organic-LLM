"use client";

import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import { instructionDocForArchetype } from "@/lib/sandbox/gen-ui-lab-instructions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { cn } from "@/lib/utils";

import { GenUiInstructionPanel } from "./GenUiInstructionPanel";

const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

type ViewTab = "component" | "instructions";

type GenUiArchetypeViewTabsProps = {
  archetype: string;
  children: ReactNode;
};

/**
 * Per-archetype tabs: live component render vs structured model instructions
 * (eyebrow header + collapsible sections).
 */
export function GenUiArchetypeViewTabs({ archetype, children }: GenUiArchetypeViewTabsProps) {
  const [tab, setTab] = useState<ViewTab>("component");
  const doc = useMemo(() => instructionDocForArchetype(archetype), [archetype]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as ViewTab)}
      className="w-full"
    >
      <TabsList
        aria-label={`${archetype} view`}
        className="mb-stack-md h-auto min-h-11 w-full justify-start gap-1 bg-muted/40 p-1"
      >
        <TabsTrigger
          value="component"
          className={cn(
            LAB_CONTROL,
            "min-h-9 flex-1 rounded-md px-3 text-sm shadow-none data-[state=active]:bg-background data-[state=active]:shadow-none"
          )}
        >
          Component
        </TabsTrigger>
        <TabsTrigger
          value="instructions"
          className={cn(
            LAB_CONTROL,
            "min-h-9 flex-1 rounded-md px-3 text-sm shadow-none data-[state=active]:bg-background data-[state=active]:shadow-none"
          )}
        >
          Model instructions
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="component"
        className="mt-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {children}
      </TabsContent>

      <TabsContent
        value="instructions"
        className="mt-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {doc ? (
          <GenUiInstructionPanel doc={doc} />
        ) : (
          <article className="rounded-2xl bg-muted/30 p-inset-md">
            <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Gen UI · Model instructions
            </p>
            <h2 className="mt-1 font-commissioner text-xl font-light tracking-tight text-foreground">
              {archetype}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No model instructions for this lab page.
            </p>
          </article>
        )}
      </TabsContent>
    </Tabs>
  );
}
