"use client";

import type { ComponentProps } from "react";

import { glass } from "@/components/design-system/primitives";
import { PromptInputButton } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

import { useComposerChipLumen, useComposerChipLumenHostRef } from "./use-composer-chip-lumen";

export type ComposerToolId = "search" | "memory" | "speech" | "preview";

export type ComposerToolChipProps = ComponentProps<typeof PromptInputButton> & {
  active: boolean;
  tool: ComposerToolId;
};

export function ComposerToolChip({
  active,
  tool,
  className,
  children,
  ...props
}: ComposerToolChipProps) {
  const hostRef = useComposerChipLumenHostRef();
  useComposerChipLumen(hostRef);

  return (
    <span ref={hostRef} className="composer-tool-chip-host inline-flex shrink-0 overflow-visible">
      <span className="composer-tool-chip-stage relative inline-flex shrink-0">
        <span
          aria-hidden
          className={cn(
            "lumen-rim-backlight",
            active ? "lumen-rim-backlight--on" : "lumen-rim-backlight--hover"
          )}
        />
        <PromptInputButton
          aria-pressed={active}
          data-adaptive-active={active ? "true" : undefined}
          data-tool={tool}
          size="dynamic-sm"
          variant="ghost"
          className={cn(
            "composer-tool-chip relative z-10 box-border h-8 min-w-8 shrink-0 rounded-md border border-transparent ring-1 ring-transparent",
            "motion-safe:transition-[color,opacity] motion-safe:duration-200",
            "motion-safe:ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
            "hover:text-foreground hover:bg-muted/25 dark:hover:bg-transparent",
            active
              ? cn(glass({ chip: true }), "composer-tool-chip-active font-medium")
              : "text-muted-foreground/70",
            className
          )}
          {...props}
        >
          {children}
        </PromptInputButton>
      </span>
    </span>
  );
}
