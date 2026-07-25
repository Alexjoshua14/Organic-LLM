"use client";

import type { ComponentProps, ReactNode } from "react";

import { useComposerChipLumen, useComposerChipLumenHostRef } from "@/components/chat/use-composer-chip-lumen";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type DmzLumeButtonProps = ComponentProps<typeof Button> & {
  children: ReactNode;
  pulse?: boolean;
};

/** Primary DMZ action with gentle lumen rim pulse (dark mode). */
export function DmzLumeButton({ className, children, pulse = true, ...props }: DmzLumeButtonProps) {
  const hostRef = useComposerChipLumenHostRef();

  useComposerChipLumen(hostRef);

  return (
    <span ref={hostRef} className="dmz-lume-host relative inline-flex w-full overflow-visible">
      <span className="dmz-lume-stage relative inline-flex w-full">
        <span
          aria-hidden
          className={cn(
            "lumen-rim-backlight lumen-rim-backlight--on rounded-xl",
            pulse && "lumen-rim-backlight--pulse"
          )}
        />
        <Button
          className={cn(
            "relative z-10 h-11 w-full rounded-xl text-sm font-semibold shadow-sm",
            className
          )}
          {...props}
        >
          {children}
        </Button>
      </span>
    </span>
  );
}
