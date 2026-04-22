"use client";

import { Info } from "lucide-react";
import { useCallback, useState } from "react";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import {
  STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS,
  type StrataAssistantPersonaGuideSection,
} from "@/lib/strata/assistant-persona-guide";
import { cn } from "@/lib/utils";

const TOOLTIP_HINT =
  "Persona shapes system prompt tone, default model (until you change the picker), and default tool toggles when you switch on the Source tab — not your saved Strata sources.";

function tocLineClassName(level: StrataAssistantPersonaGuideSection["level"]): string {
  switch (level) {
    case 1:
      return "h-[3px] w-[4.5rem] shrink-0 rounded-full bg-foreground/45 transition-[width,background-color] duration-200 ease-out group-hover:w-32 group-hover:bg-foreground/60";
    case 2:
      return "h-[3px] w-[3.25rem] shrink-0 rounded-full bg-foreground/40 transition-[width,background-color] duration-200 ease-out group-hover:w-28 group-hover:bg-foreground/55";
    default:
      return "h-[3px] w-9 shrink-0 rounded-full bg-foreground/35 transition-[width,background-color] duration-200 ease-out group-hover:w-24 group-hover:bg-foreground/50";
  }
}

function tocIndentClassName(level: StrataAssistantPersonaGuideSection["level"]): string {
  if (level === 2) return "pl-3";
  if (level === 3) return "pl-6";
  return "pl-0";
}

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export type StrataAssistantPersonaGuideProps = {
  className?: string;
};

export function StrataAssistantPersonaGuide({ className }: StrataAssistantPersonaGuideProps) {
  const [open, setOpen] = useState(false);

  const handleOpenGuide = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <div className={cn("flex items-center justify-end gap-1.5", className)}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Open Strata assistant persona guide"
            onClick={handleOpenGuide}
          >
            <Info className="size-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(20rem,calc(100vw-2rem))] text-pretty">
          {TOOLTIP_HINT}
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90dvh,48rem)] max-w-[min(42rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>Strata assistant persona</DialogTitle>
            <DialogDescription>
              How persona settings affect the page assistant and what stays unchanged in your sources.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[min(72dvh,40rem)] flex-col gap-0 sm:flex-row sm:items-stretch">
            <nav
              aria-label="Guide sections"
              className="shrink-0 border-b border-border px-3 py-3 sm:w-[10rem] sm:border-b-0 sm:border-r sm:py-4 md:w-[11rem]"
            >
              <ul className="flex flex-col gap-1">
                {STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={cn(
                        "group flex w-full min-w-0 items-center gap-2 rounded-md py-2 pr-1 text-left transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        tocIndentClassName(section.level)
                      )}
                      aria-label={`Jump to ${section.title}`}
                      onClick={() => scrollToSection(section.id)}
                    >
                      <span className={tocLineClassName(section.level)} aria-hidden />
                      <span
                        className="min-w-0 max-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-foreground/80 opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover:max-w-[10rem] group-hover:opacity-100"
                        title={section.title}
                      >
                        {section.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS.map((section) => {
                  const HeadingTag = section.level === 1 ? "h2" : "h3";
                  return (
                    <section
                      key={section.id}
                      id={section.id}
                      className="scroll-mt-4 border-b border-border/60 pb-6 last:border-b-0 last:pb-0"
                    >
                      <HeadingTag
                        className={cn(
                          "font-semibold tracking-tight text-foreground",
                          section.level === 1 ? "text-base" : "text-sm"
                        )}
                      >
                        {section.title}
                      </HeadingTag>
                      <div className="mt-2">
                        <ChatMessageMarkdown
                          content={section.bodyMarkdown}
                          id={`${section.id}-body`}
                          wrapCodeBlocks
                        />
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
