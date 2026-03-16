"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/third-party/ui/collapsible";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-start gap-2 rounded-md py-2 text-left",
          "hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {open ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-foreground">{title}</span>
          {!open && summary && (
            <span className="text-sm font-normal text-muted-foreground">{summary}</span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 pl-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
