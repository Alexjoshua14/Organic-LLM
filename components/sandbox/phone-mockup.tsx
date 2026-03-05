"use client";

import { cn } from "@/lib/utils";

const SCREEN_WIDTH = 280;
const SCREEN_ASPECT = 19.5 / 9; // height/width, phone-ish

export type PhoneMockupProps = {
  children: React.ReactNode;
  className?: string;
  /** Optional label under the device */
  label?: string;
};

export function PhoneMockup({ children, className, label }: PhoneMockupProps) {
  const height = Math.round(SCREEN_WIDTH * SCREEN_ASPECT);
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "relative rounded-[2.25rem] p-2.5",
          "bg-neutral-800 dark:bg-neutral-900",
          "border-10 border-neutral-700 dark:border-neutral-800",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
        )}
      >
        {/* Notch / dynamic island */}
        <div
          className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-950 dark:bg-neutral-950"
          aria-hidden
        />
        <div
          className="overflow-hidden rounded-[1.25rem] bg-background"
          style={{
            width: SCREEN_WIDTH,
            height,
          }}
        >
          <div className="h-full w-full overflow-y-auto overflow-x-hidden pt-7 pb-4 px-3">
            {children}
          </div>
        </div>
      </div>
      {label && (
        <p className="text-xs text-muted-foreground">{label}</p>
      )}
    </div>
  );
}
