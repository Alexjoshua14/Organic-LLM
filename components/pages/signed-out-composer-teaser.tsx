"use client";

import { FormEvent } from "react";

import { PromptInputSubmit } from "@/components/chat/core-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputProvider,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export function SignedOutComposerTeaser({ className }: { className?: string }) {
  const preventSubmit = (_message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <PromptInputProvider>
      <PromptInput className={cn("w-full", className)} onSubmit={preventSubmit}>
        <PromptInputBody>
          <div className="relative w-full">
            <PromptInputTextarea
              readOnly
              aria-disabled
              className={cn(
                "pointer-events-none text-lg! md:text-lg! placeholder:text-lg! caret-transparent w-full placeholder:text-foreground/80",
                "!pb-[2.875rem] !pr-[2.75rem] opacity-90"
              )}
              maxRows={4}
              minRows={1}
              placeholder="What do you want to explore?"
              tabIndex={-1}
              value=""
            />
            <div className="absolute bottom-2 right-2 z-10 flex items-end justify-end pointer-events-none">
              <PromptInputSubmit disabled status="ready" />
            </div>
          </div>
        </PromptInputBody>
      </PromptInput>
    </PromptInputProvider>
  );
}
