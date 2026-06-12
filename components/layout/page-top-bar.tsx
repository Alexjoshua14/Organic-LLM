import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { pageTopBarInsets } from "@/lib/layout/nav-chrome";

type PageTopBarProps = {
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function PageTopBar({ title, leading, trailing, className }: PageTopBarProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between border-b border-border py-3",
        pageTopBarInsets,
        className
      )}
    >
      <div className="flex min-w-0 items-center">{leading}</div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex min-w-0 items-center justify-end">{trailing ?? <span aria-hidden className="w-20" />}</div>
    </div>
  );
}
