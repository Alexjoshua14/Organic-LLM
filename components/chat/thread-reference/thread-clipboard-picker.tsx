"use client";

import { useState } from "react";
import { Clipboard } from "lucide-react";
import { PromptInputButton } from "@/components/third-party/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";

export function ThreadClipboardPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; title: string | null }>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const load = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/thread-clipboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const body = await response.json();
      setItems(body.data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load();
      }}
    >
      <DropdownMenuTrigger asChild>
        <PromptInputButton aria-label="Saved thread clipboard" title="Saved thread clipboard">
          <Clipboard className="size-4" />
        </PromptInputButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuLabel>Thread clipboard</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-foreground-secondary">
          Recent copied threads across your signed-in devices.
        </p>
        <DropdownMenuSeparator />
        {status === "loading" ? (
          <p className="p-2 text-xs" role="status">
            Loading saved threads…
          </p>
        ) : status === "error" ? (
          <DropdownMenuItem
            onSelect={() => {
              void load();
            }}
          >
            Unavailable · try again
          </DropdownMenuItem>
        ) : items.length ? (
          items.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)}>
              <span className="truncate">{item.title || "Untitled thread"}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="p-2 text-xs text-foreground-secondary">
            Use Copy thread in a thread’s options menu.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
