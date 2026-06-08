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
            <div className="flex w-full justify-center">
              <div className="inline-flex min-w-0 max-w-full items-center justify-center gap-2 text-center">
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="min-w-0 truncate text-sm font-medium">{prototype.title}</p>
                <span className="shrink-0 rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {Math.round(prototype.score)}
                </span>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-center text-xs leading-4 text-muted-foreground">
              {prototype.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
