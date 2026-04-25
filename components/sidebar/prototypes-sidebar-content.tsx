import Link from "next/link";

import { PrototypesSidebarNav } from "./prototypes-sidebar-nav";

import { getPrototypeHref, prototypes } from "@/app/sandbox/prototypes/_config/prototypes";
import { rankPrototypes } from "@/lib/prototypes/ranking";

export function PrototypesSidebarFallback() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="h-10 rounded-lg bg-background-tertiary/40" />
      <div className="h-20 rounded-lg bg-background-tertiary/30" />
      <div className="h-20 rounded-lg bg-background-tertiary/30" />
      <div className="h-20 rounded-lg bg-background-tertiary/30" />
    </div>
  );
}

export function PrototypesSidebarContent() {
  const rankedPrototypes = rankPrototypes(prototypes, getPrototypeHref);

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-4">
      <div className="mb-4 rounded-xl border border-border/60 bg-background/45 p-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Prototype area
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">Ranked prototypes</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Sorted server-side by importance, usage signal, creation date, and latest update.
        </p>
      </div>

      <Link
        className="mb-3 rounded-lg border border-border/60 bg-background-tertiary px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-background"
        href="/sandbox/prototypes"
      >
        Prototype gallery
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <PrototypesSidebarNav prototypes={rankedPrototypes} />
      </div>
    </div>
  );
}
