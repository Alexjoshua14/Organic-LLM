"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  composerLumenButtonClasses,
} from "@/components/chat/composer-action-button";
import { useComposerChipLumen, useComposerChipLumenHostRef } from "@/components/chat/use-composer-chip-lumen";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type ErgonTaskActionButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  engaged?: boolean;
  /** Icon + optional short label for the action chip. */
  children: ReactNode;
  /** Destructive hover treatment (e.g. delete). */
  danger?: boolean;
};

export function ErgonTaskActionButton({
  engaged = false,
  danger = false,
  className,
  children,
  size = "sm",
  variant = "ghost",
  ...props
}: ErgonTaskActionButtonProps) {
  const hostRef = useComposerChipLumenHostRef();
  useComposerChipLumen(hostRef);

  return (
    <span ref={hostRef} className="composer-tool-chip-host inline-flex shrink-0 overflow-visible">
      <span className="composer-tool-chip-stage relative inline-flex shrink-0">
        <span
          aria-hidden
          className={cn(
            "lumen-rim-backlight",
            engaged ? "lumen-rim-backlight--on" : "lumen-rim-backlight--hover"
          )}
        />
        <Button
          aria-pressed={engaged || undefined}
          className={cn(
            composerLumenButtonClasses(engaged),
            "h-8 gap-1.5 px-2.5 text-xs",
            danger &&
              "hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15",
            className
          )}
          size={size}
          variant={variant}
          {...props}
        >
          {children}
        </Button>
      </span>
    </span>
  );
}
