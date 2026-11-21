"use client";

import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import {
  LAB_DIAGRAM_INSTRUCTION_MARKDOWN,
  modelInstructionMarkdownForBlock,
} from "@/lib/sandbox/gen-ui-lab-instructions";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/third-party/ui/tabs";
import { isGenUIBlockType, type GenUIBlockType } from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

import { LAB_DIAGRAM_ARCHETYPE } from "./GenUiMermaidDiagramDemo";

const LAB_CONTROL =
  "transition-colors outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

type ViewTab = "component" | "instructions";

type GenUiArchetypeViewTabsProps = {
  archetype: string;
  children: ReactNode;
};

function instructionMarkdown(archetype: string): string {
  if (archetype === LAB_DIAGRAM_ARCHETYPE) return LAB_DIAGRAM_INSTRUCTION_MARKDOWN;
  if (isGenUIBlockType(archetype)) return modelInstructionMarkdownForBlock(archetype);

  return `# ${archetype}\n\n_No model instructions for this lab page._`;
}

/**
 * Per-archetype tabs: live component render vs the markdown model instructions Arcadia/Aion see.
 */
export function GenUiArchetypeViewTabs({ archetype, children }: GenUiArchetypeViewTabsProps) {
  const [tab, setTab] = useState<ViewTab>("component");
  const markdown = useMemo(() => instructionMarkdown(archetype), [archetype]);
  const blockType = isGenUIBlockType(archetype) ? (archetype as GenUIBlockType) : null;

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
        <article
          className={cn(
            "rounded-2xl bg-muted/30 p-inset-md",
            "prose prose-sm max-w-none dark:prose-invert",
            "prose-headings:text-foreground prose-p:text-muted-foreground",
            "prose-code:text-foreground prose-pre:bg-muted/50"
          )}
        >
          <ChatMessageMarkdown
            content={markdown}
            id={`lab-instructions-${blockType ?? archetype}`}
            wrapCodeBlocks
          />
        </article>
      </TabsContent>
    </Tabs>
  );
}
