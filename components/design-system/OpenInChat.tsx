"use client";

import type { OpenInChatProvider } from "@/lib/export/prompts";

import { useState } from "react";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";

import {
  OpenIn,
  OpenInContent,
  OpenInItem,
  OpenInTrigger,
  getOpenInProviderHref,
  getOpenInProviderMeta,
  type OpenInChatLinkableId,
} from "@/components/ai-elements/open-in-chat";
import { Button } from "@/components/third-party/ui/button";
import {
  sortOpenInProvidersByLastUsed,
  writeLastOpenInProvider,
} from "@/lib/export/last-provider-storage";
import { cn } from "@/lib/utils";

export type OpenInChatProps = {
  query: string;
  providers: OpenInChatProvider[];
  presetId: string;
  disabled?: boolean;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerClassName?: string;
};

export function OpenInChat({
  query,
  providers,
  presetId,
  disabled,
  triggerLabel = "Open in chat",
  triggerClassName,
  triggerAriaLabel,
}: OpenInChatProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (providers.length === 0) return null;

  const sorted = sortOpenInProvidersByLastUsed(presetId, providers);

  return (
    <OpenIn open={open} query={query} onOpenChange={setOpen}>
      <OpenInTrigger asChild>
        <Button
          aria-label={triggerAriaLabel}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-400/12 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-sky-300",
            triggerClassName
          )}
          disabled={disabled}
          type="button"
          variant="outline"
        >
          {triggerLabel}
          <ChevronDownIcon className="size-3.5" />
        </Button>
      </OpenInTrigger>
      <OpenInContent>
        {sorted.map((id) => {
          const href = getOpenInProviderHref(id as OpenInChatLinkableId, query);
          const meta = getOpenInProviderMeta(id as OpenInChatLinkableId);

          return (
            <OpenInItem key={id} asChild>
              <a
                className="flex items-center gap-2"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                onClick={async (event) => {
                  setFeedback(null);
                  if (!meta.copyBeforeOpen) {
                    writeLastOpenInProvider(presetId, id);

                    return;
                  }

                  event.preventDefault();
                  setOpen(false);
                  // Open synchronously while user activation is available (including on Safari).
                  const popup = window.open("about:blank", "_blank");

                  if (popup) popup.opener = null;
                  try {
                    await navigator.clipboard.writeText(query);
                    writeLastOpenInProvider(presetId, id);
                    if (popup) {
                      popup.location.href = href;
                      setFeedback(
                        "Prompt copied. Paste it into Gemini, then paste the reply here."
                      );
                    } else {
                      setFeedback("Prompt copied. Allow popups or open Gemini and paste it there.");
                    }
                  } catch {
                    popup?.close();
                    setFeedback("Couldn’t copy the prompt. Allow clipboard access and try again.");
                  }
                }}
              >
                <span className="shrink-0">{meta.icon}</span>
                <span className="flex-1">{meta.title}</span>
                <ExternalLinkIcon className="size-4 shrink-0" />
              </a>
            </OpenInItem>
          );
        })}
      </OpenInContent>
      {feedback && (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {feedback}
        </p>
      )}
    </OpenIn>
  );
}
