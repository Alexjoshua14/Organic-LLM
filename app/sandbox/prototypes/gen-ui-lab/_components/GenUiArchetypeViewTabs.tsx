"use client";

import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import { instructionDocForArchetype } from "@/lib/sandbox/gen-ui-lab-instructions";
import { packedStageRect } from "@/lib/stage/layout";
import { STAGE_CONTENT_RECT } from "@/lib/stage/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { cn } from "@/lib/utils";

import { TOOLBAR_CONTROL } from "./GenUiArrangementToolbar";
import { GenUiInstructionPanel } from "./GenUiInstructionPanel";

const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const STAGE_SIZES = [
  { name: "Quarter", rect: packedStageRect(0, 4) },
  { name: "Half", rect: packedStageRect(0, 2) },
  { name: "Full", rect: packedStageRect(0, 1) },
] as const;

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
  const [sizeIndex, setSizeIndex] = useState(STAGE_SIZES.length - 1);
  const doc = useMemo(() => instructionDocForArchetype(archetype), [archetype]);
  const { w: columns, h: rows } = STAGE_SIZES[sizeIndex].rect;
  const { w: stageColumns, h: stageRows } = STAGE_CONTENT_RECT;

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
        <label className="mb-stack-sm flex flex-wrap items-center justify-between gap-inline-sm text-sm text-muted-foreground">
          Stage size
          <select
            className={cn(
              "min-h-9 rounded-md border border-border bg-background px-inset-sm text-sm pointer-coarse:min-h-11",
              TOOLBAR_CONTROL
            )}
            value={sizeIndex}
            onChange={(event) => setSizeIndex(Number(event.target.value))}
          >
            {STAGE_SIZES.map(({ name, rect }, index) => (
              <option key={name} value={index}>
                {name} · {rect.w} × {rect.h} cells
              </option>
            ))}
          </select>
        </label>
        {/* Use Stage cell spans on a normalized grid that scales with the gallery width. */}
        <div
          className="grid w-full grid-rows-1 place-items-center"
          style={{ aspectRatio: `${stageColumns} / ${stageRows}` }}
        >
          <section
            aria-label="Stage preview"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The named overflow region needs focus for keyboard scrolling.
            tabIndex={0}
            className="organic-focus @container min-h-0 min-w-0 overflow-auto rounded-xl border border-border/60"
            style={{
              width: `${(columns / stageColumns) * 100}%`,
              aspectRatio: `${columns} / ${rows}`,
            }}
          >
            {children}
          </section>
        </div>
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
