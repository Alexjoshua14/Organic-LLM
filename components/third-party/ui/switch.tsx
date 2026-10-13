"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { organicSwitchThumb, organicSwitchTrack } from "@/components/design-system/switch-styles";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      organicSwitchTrack,
      "peer relative inline-flex shrink-0 cursor-pointer items-center px-0.5 shadow-sm transition-colors after:absolute after:-inset-x-1 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary/80 motion-reduce:transition-none",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        organicSwitchThumb,
        "pointer-events-none block ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
