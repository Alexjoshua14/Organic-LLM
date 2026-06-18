import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { pageTopBarInsets, triggerInsetY, triggerRowAlignY } from "@/lib/layout/nav-chrome";

type PageTopBarLayout = "split" | "stacked";

type PageTopBarProps = {
  title: ReactNode;
  leading?: ReactNode;
  /** Shown above the title when `layout="stacked"` (e.g. breadcrumbs). */
  eyebrow?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** Clears global sidebar trigger / safe-area on full-bleed pages. */
  withTopClearance?: boolean;
  /** Bottom border under the header bar. */
  withBorder?: boolean;
  /** `split`: leading | centered title | trailing. `stacked`: eyebrow + title top-left. */
  layout?: PageTopBarLayout;
};

export function PageTopBar({
  title,
  leading,
  eyebrow,
  trailing,
  className,
  withTopClearance = false,
  withBorder = false,
  layout = "split",
}: PageTopBarProps) {
  const borderClass = withBorder ? "border-b border-border/60" : undefined;

  if (layout === "stacked") {
    return (
      <div
        className={cn(
          "w-full",
          borderClass,
          pageTopBarInsets,
          className
        )}
      >
        <div
          className={cn(
            "flex w-full items-center justify-between",
            withTopClearance ? triggerRowAlignY : "py-3"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center">{eyebrow}</div>
          <div className="flex min-w-0 shrink-0 items-center justify-end">
            {trailing ?? <span aria-hidden className="w-20" />}
          </div>
        </div>
        <div className="pt-1 pb-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h1>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between py-3",
        borderClass,
        pageTopBarInsets,
        withTopClearance && triggerInsetY,
        className
      )}
    >
      <div className="flex min-w-0 items-center">{leading}</div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex min-w-0 items-center justify-end">
        {trailing ?? <span aria-hidden className="w-20" />}
      </div>
    </div>
  );
}
