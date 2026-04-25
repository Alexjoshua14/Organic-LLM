"use client";

import type { RankedPrototype } from "@/lib/prototypes/ranking";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function PrototypesSidebarNav({ prototypes }: { prototypes: RankedPrototype[] }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-col gap-2">
      {prototypes.map((prototype, index) => {
        const active = pathname === prototype.href || pathname.startsWith(`${prototype.href}/`);

        return (
          <Link
            className={cn(
              "group rounded-lg border px-3 py-2.5 transition-colors",
              active
                ? "border-accent/35 bg-accent/10 text-foreground"
                : "border-border/50 bg-background/35 text-muted-foreground hover:bg-background hover:text-foreground"
            )}
            href={prototype.href}
            key={prototype.slug}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="truncate text-sm font-medium">{prototype.title}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {prototype.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                {Math.round(prototype.score)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {prototype.reasons.map((reason) => (
                <span
                  className="rounded-full bg-background-tertiary/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                  key={reason}
                >
                  {reason}
                </span>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
