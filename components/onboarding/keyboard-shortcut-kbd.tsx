import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function KeyboardShortcutKbd({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-6 items-center justify-center rounded-md border border-border/60",
        "bg-background/80 px-2 py-0.5 font-mono text-[10px] font-medium leading-none text-foreground/90",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.06)]",
        "dark:bg-background/40 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
        wide && "min-w-[4.5rem] px-2.5",
        className
      )}
    >
      {children}
    </kbd>
  );
}
