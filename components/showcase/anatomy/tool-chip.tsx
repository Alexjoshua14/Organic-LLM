"use client";

import type { LucideIcon } from "lucide-react";

import { Database, GitBranch, History, Search } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const TOOL_META: Record<string, { label: string; Icon: LucideIcon }> = {
  web_search: { label: "Web search", Icon: Search },
  search_memories: { label: "Memory search", Icon: Database },
  memory_search: { label: "Memory search", Icon: Database },
  get_full_chat_history: { label: "Chat history", Icon: History },
  get_more_chat_history: { label: "More history", Icon: History },
  get_messages_from_date: { label: "History by date", Icon: History },
  make_mermaid_diagram: { label: "Mermaid", Icon: GitBranch },
};

function metaFor(toolName: string) {
  const key = toolName.toLowerCase();

  if (TOOL_META[key]) return TOOL_META[key];
  const readable = toolName.replace(/_/g, " ").trim() || "Tool";

  return {
    label: readable.length ? `${readable[0]!.toUpperCase()}${readable.slice(1)}` : "Tool",
    Icon: GitBranch,
  };
}

export function ToolChip({
  toolName,
  className,
  size = "md",
}: {
  toolName: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { label, Icon } = metaFor(toolName);
  const small = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 font-medium text-foreground/90",
        glass(),
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <Icon className={cn("shrink-0 text-muted-foreground", small ? "size-3" : "size-3.5")} />
      {label}
    </span>
  );
}
