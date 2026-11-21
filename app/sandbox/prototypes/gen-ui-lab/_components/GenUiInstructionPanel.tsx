"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { LabInstructionDoc, LabInstructionSection } from "@/lib/sandbox/gen-ui-lab-instructions";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { glass } from "@/components/design-system/primitives";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/third-party/ui/collapsible";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus outline-none focus-visible:bg-muted/40 focus-visible:outline-none";

const PROSE_BODY = cn(
  "prose prose-sm max-w-none dark:prose-invert",
  "prose-headings:scroll-mt-4 prose-headings:text-foreground",
  "prose-h2:mb-stack-sm prose-h2:mt-0 prose-h2:text-sm prose-h2:font-semibold prose-h2:tracking-tight",
  "prose-h3:mb-1.5 prose-h3:mt-stack-md prose-h3:text-sm prose-h3:font-medium",
  "prose-p:leading-relaxed prose-p:text-muted-foreground",
  "prose-li:text-muted-foreground",
  "prose-code:text-foreground prose-pre:bg-muted/50"
);

function InstructionSection({
  section,
  docId,
}: {
  section: LabInstructionSection;
  docId: string;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-border/50 bg-background/40"
    >
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-start gap-inline-md rounded-xl px-inset-md py-inset-md text-left transition-colors",
          "hover:bg-muted/30",
          FOCUS
        )}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            "group-data-[state=closed]:-rotate-90"
          )}
        />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-sm font-medium tracking-tight text-foreground">
            {section.title}
          </span>
          {!open && section.summary ? (
            <span className="block truncate text-xs text-muted-foreground">{section.summary}</span>
          ) : null}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
        <div className={cn("border-t border-border/40 px-inset-md py-inset-md", PROSE_BODY)}>
          <ChatMessageMarkdown
            content={section.body}
            id={`${docId}-${section.id}`}
            wrapCodeBlocks
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type GenUiInstructionPanelProps = {
  doc: LabInstructionDoc;
};

/**
 * Quiet eyebrow + light title, then collapsible instruction sections — matches newer lab/
 * Strata disclosure patterns instead of a single heavy prose h1 page.
 */
export function GenUiInstructionPanel({ doc }: GenUiInstructionPanelProps) {
  const docId = `lab-instructions-${doc.typeId}`;

  return (
    <article className={cn(glass({ opaque: true }), "space-y-stack-md rounded-2xl p-inset-md")}>
      <header className="space-y-stack-xs">
        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
          {doc.eyebrow}
        </p>
        <h2 className="font-commissioner text-xl font-light tracking-tight text-foreground sm:text-2xl">
          {doc.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <code className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">
            {doc.typeId}
          </code>
          <span className="text-muted-foreground"> — {doc.hint}</span>
        </p>
      </header>

      <div className="space-y-stack-sm">
        {doc.sections.map((section) => (
          <InstructionSection key={section.id} docId={docId} section={section} />
        ))}
      </div>
    </article>
  );
}
