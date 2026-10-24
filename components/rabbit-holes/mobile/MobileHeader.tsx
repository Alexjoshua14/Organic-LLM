"use client";

import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@heroui/button";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";

export interface MobileHeaderProps {
  session: RabbitHoleSession | null;
  activeNodeId: string | null;
  onNewRabbitHole: () => void;
  getCurrentPathIndex: () => number;
  onNodeSelect: (nodeId: string) => void;
}

export function MobileHeader({
  session,
  activeNodeId,
  onNewRabbitHole,
  getCurrentPathIndex,
  onNodeSelect,
}: MobileHeaderProps) {
  const pathLen = session?.path.length ?? 0;
  const idx = getCurrentPathIndex();
  const showPathPill = session && pathLen > 0 && idx >= 0;

  return (
    <header
      className={cn(
        "rabbit-hole-mobile-header z-30 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2",
        glass({ opaque: true, border: "none" })
      )}
    >
      <Link
        className="flex min-h-11 min-w-11 items-center justify-start text-muted-foreground transition-colors hover:text-foreground"
        href="/rabbitholes/browse"
      >
        <span className="sr-only">Back to browse</span>
        <ChevronLeft aria-hidden className="size-6" />
      </Link>

      {showPathPill ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "font-commissioner text-xs font-medium tracking-wide text-foreground",
                "rounded-full border border-border/60 bg-card/60 px-3 py-1.5",
                "min-h-9 min-w-[4.5rem] transition-colors active:bg-card/80"
              )}
              type="button"
            >
              <span className="text-muted-foreground">●</span>{" "}
              <span>
                {idx + 1} / {pathLen}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="max-h-[min(60vh,320px)] w-[min(92vw,280px)] overflow-y-auto"
          >
            {session.path.map((seg) => (
              <DropdownMenuItem
                key={seg.nodeId}
                className={cn(seg.nodeId === activeNodeId && "bg-muted/50")}
                onSelect={() => onNodeSelect(seg.nodeId)}
              >
                <span className="line-clamp-2 text-left text-sm">{seg.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="font-commissioner text-sm font-light tracking-wide text-foreground">
          Rabbit Hole
        </span>
      )}

      <Button
        isIconOnly
        aria-label="New rabbit hole"
        className="min-h-11 min-w-11 text-muted-foreground"
        variant="ghost"
        onPress={onNewRabbitHole}
      >
        <Plus className="size-5" />
      </Button>
    </header>
  );
}
