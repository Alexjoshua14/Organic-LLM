"use client";

import type { ComponentProps, ComponentType, ReactElement } from "react";

import { glass } from "@/components/design-system/primitives";
import { PromptInputButton } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

import { useComposerChipLumen, useComposerChipLumenHostRef } from "./use-composer-chip-lumen";

export function composerLumenButtonClasses(engaged: boolean, className?: string) {
  return cn(
    "composer-tool-chip relative z-10 box-border h-8 min-w-8 shrink-0 rounded-md border border-transparent ring-1 ring-transparent",
    "motion-safe:transition-[color,opacity] motion-safe:duration-200",
    "motion-safe:ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
    "hover:text-foreground hover:bg-muted/25 dark:hover:bg-transparent",
    engaged
      ? cn(glass({ chip: true }), "composer-tool-chip-active font-medium text-foreground")
      : "text-muted-foreground/70",
    className
  );
}

type TriggerWrapperProps = {
  asChild?: boolean;
  children: ReactElement;
};

export type ComposerActionButtonProps = ComponentProps<typeof PromptInputButton> & {
  engaged?: boolean;
  /** Gentle lumen opacity breathe while engaged (e.g. mic listening). */
  rimPulse?: boolean;
  /** Wrap the button for Radix triggers (DropdownMenuTrigger, etc.). */
  wrapTrigger?: ComponentType<TriggerWrapperProps>;
};

export function ComposerActionButton({
  engaged = false,
  rimPulse = false,
  wrapTrigger: WrapTrigger,
  className,
  children,
  ...props
}: ComposerActionButtonProps) {
  const hostRef = useComposerChipLumenHostRef();
  useComposerChipLumen(hostRef);

  const button = (
    <PromptInputButton
      aria-pressed={engaged || undefined}
      size="dynamic-sm"
      variant="ghost"
      className={composerLumenButtonClasses(engaged, className)}
      {...props}
    >
      {children}
    </PromptInputButton>
  );

  const control = WrapTrigger ? <WrapTrigger asChild>{button}</WrapTrigger> : button;

  return (
    <span ref={hostRef} className="composer-tool-chip-host inline-flex shrink-0 overflow-visible">
      <span className="composer-tool-chip-stage relative inline-flex shrink-0">
        <span
          aria-hidden
          className={cn(
            "lumen-rim-backlight",
            engaged ? "lumen-rim-backlight--on" : "lumen-rim-backlight--hover",
            rimPulse && engaged && "lumen-rim-backlight--pulse"
          )}
        />
        {control}
      </span>
    </span>
  );
}
