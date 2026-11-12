"use client";

import { useState } from "react";
import { Clipboard } from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/third-party/ui/dropdown-menu";

/**
 * "Reference a thread" entry for the composer's `+` menu. Opening the submenu lists the recent
 * copied threads; choosing one attaches it as a reference.
 */
export function ThreadClipboardSubmenu({ onSelect }: { onSelect: (id: string) => void }) {
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
    <DropdownMenuSub
      onOpenChange={(open) => {
        if (open) void load();
      }}
    >
      <DropdownMenuSubTrigger>
        <Clipboard className="mr-2 size-4" /> Reference a thread
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-80 w-72 overflow-y-auto">
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
            onSelect={(event) => {
              event.preventDefault();
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
