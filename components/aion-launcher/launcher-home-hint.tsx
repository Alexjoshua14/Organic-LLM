"use client";

import { Button } from "@heroui/button";
import { Keyboard } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { useAionLauncher } from "@/components/aion-launcher/aion-launcher";
import { cn } from "@/lib/utils";

export function LauncherHomeHint() {
  const { setOpen } = useAionLauncher();

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-foreground/80 max-w-sm">
        Press{" "}
        <kbd className="rounded border border-border bg-background-secondary px-1.5 py-0.5 font-mono text-xs">
          {typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)
            ? "⌘"
            : "Ctrl"}
          K
        </kbd>{" "}
        anywhere to search threads, Strata pages, and shortcuts.
      </p>
      <Button
        className={cn(glass({ opaque: true }), "font-medium")}
        size="md"
        variant="flat"
        onPress={() => setOpen(true)}
      >
        <Keyboard className="size-4" />
        Open launcher
      </Button>
    </div>
  );
}
