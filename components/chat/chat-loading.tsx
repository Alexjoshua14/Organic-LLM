import type { ExaSearchResultSource } from "@/lib/exa/types";

import { ComponentProps, FC } from "react";
import { ChevronDownIcon } from "lucide-react";

import ShinyText from "../ShinyText";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../third-party/ui/collapsible";

const TEXT_ANIMATION_SPEED = 1.2;

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
};

export const ChatThinking: FC<ChatThinkingProps & Partial<ComponentProps<typeof ShinyText>>> = ({
  text,
  ...props
}) => {
  return (
    <ShinyText
      disabled={false}
      speed={TEXT_ANIMATION_SPEED}
      text={text ?? "Thinking..."}
      {...props}
    />
  );
};

type ChatReasoningProps = {
  text?: string;
};

export const ChatReasoning: FC<ChatReasoningProps & Partial<ComponentProps<typeof ShinyText>>> = ({
  text,
  ...props
}) => {
  return (
    <ShinyText
      disabled={false}
      speed={TEXT_ANIMATION_SPEED}
      text={text ?? "Reasoning..."}
      {...props}
    />
  );
};

type ChatSearchingProps = {
  text?: string;
  query?: string;
  sources?: ExaSearchResultSource[];
};

export const ChatSearching: FC<ChatSearchingProps & Partial<ComponentProps<typeof ShinyText>>> = ({
  text,
  query,
  sources,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2 py-2">
      <ShinyText
        disabled={false}
        speed={TEXT_ANIMATION_SPEED}
        text={text ?? "Reasoning..."}
        {...props}
      />
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
