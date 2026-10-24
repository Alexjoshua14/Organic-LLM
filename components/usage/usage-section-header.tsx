import type { ReactNode } from "react";

import { usageSectionCaption, usageSectionTitle } from "./usage-typography";

import { cn } from "@/lib/utils";

type UsageSectionHeaderProps = {
  title: string;
  caption?: string;
  className?: string;
  aside?: ReactNode;
};

export function UsageSectionHeader({ title, caption, className, aside }: UsageSectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-2", className)}>
      <div className="space-y-0.5">
        <p className={usageSectionTitle}>{title}</p>
        {caption ? <p className={usageSectionCaption}>{caption}</p> : null}
      </div>
      {aside}
    </div>
  );
}
