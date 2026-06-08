"use client";

import type { OpenInChatProvider } from "@/lib/export/prompts";

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
  triggerClassName?: string;
};

export function OpenInChat({
  query,
  providers,
  presetId,
  disabled,
  triggerLabel = "Open in chat",
  triggerClassName,
}: OpenInChatProps) {
  if (providers.length === 0) return null;

  const sorted = sortOpenInProvidersByLastUsed(presetId, providers);

  return (
    <OpenIn query={query}>
      <OpenInTrigger asChild>
        <Button
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
                onClick={() => writeLastOpenInProvider(presetId, id)}
              >
                <span className="shrink-0">{meta.icon}</span>
                <span className="flex-1">{meta.title}</span>
                <ExternalLinkIcon className="size-4 shrink-0" />
              </a>
            </OpenInItem>
          );
        })}
      </OpenInContent>
    </OpenIn>
  );
}
