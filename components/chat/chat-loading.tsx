"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../third-party/ui/collapsible";

import { ProcessingTextBurn } from "./processing-text-burn";

export const ChatLoading = () => {
  return (
    <div className="flex gap-2 py-2 w-full items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-[667ms]" />
      <div className="w-2 h-2 rounded-full bg-foreground animate-pulse delay-[1333ms]" />
    </div>
  );
};

type ChatThinkingProps = {
  text?: string;
  className?: string;
  as?: "p" | "span";
};

/** Processing / tool / memory status label — burn in, then sustain shimmer while in flight. */
export const ChatThinking: FC<ChatThinkingProps> = ({ text, className, as }) => {
  return <ProcessingTextBurn as={as} className={className} text={text ?? "Thinking..."} />;
};

type ChatReasoningProps = {
  text?: string;
  className?: string;
  as?: "p" | "span";
};

export const ChatReasoning: FC<ChatReasoningProps> = ({ text, className, as }) => {
  return <ProcessingTextBurn as={as} className={className} text={text ?? "Reasoning..."} />;
};

type ChatSearchingProps = {
  text?: string;
  query?: string;
  sources?: ExaSearchResultSource[];
  className?: string;
  as?: "p" | "span";
};

export const ChatSearching: FC<ChatSearchingProps> = ({ text, sources, className, as }) => {
  return (
    <div className="flex flex-col gap-2 py-2">
      <ProcessingTextBurn as={as} className={className} text={text ?? "Searching..."} />
      {sources && sources.length > 0 && (
        <Collapsible className="pl-2 space-y-1">
          <CollapsibleTrigger className="text-xs text-muted-foreground line-clamp-1 text-ellipsis flex gap-1.5 items-center justify-start pr-10 cursor-pointer group">
            {`${sources.length} sources`}
            <ChevronDownIcon className="size-3 transition-transform group-data-[state=open]:rotate-180 group-hover:scale-110" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-2">
            {sources.map((source) => (
              <p
                key={source.id}
                className="text-xs text-muted-foreground line-clamp-1 text-ellipsis"
              >
                {source.title ?? source.url ?? source.id}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
