"use client";

import { useEffect, useState } from "react";

import { StrataCreatePageForm } from "./StrataCreatePageForm";
import { StrataPageCard } from "./StrataPageCard";

import type { StrataPage } from "@/lib/schemas/strata";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { listLocalStrataPages } from "@/lib/strata/local-store";

export function StrataBrowser({
  pages,
  dbAvailable,
}: {
  pages: StrataPage[];
  dbAvailable: boolean;
}) {
  const [localPages, setLocalPages] = useState<StrataPage[]>([]);

  useEffect(() => {
    listLocalStrataPages().then(setLocalPages).catch(() => setLocalPages([]));
  }, []);

  const renderedPages = dbAvailable ? pages : localPages;

  return (
    <div className="space-y-10">
      <div className="text-center mb-2">
        <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          Strata
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto select-none">
          Transforms raw thoughts into structured, readable artifacts through layered AI orchestration.
        </p>
      </div>

      {!dbAvailable && (
        <p className="text-center text-xs font-light text-amber-700 dark:text-amber-300 select-none">
          Supabase Strata tables are unavailable. Running in encrypted local-device mode only (ZDR).
        </p>
      )}
      <div className="w-full flex justify-end items-center">
        <StrataCreatePageForm dbAvailable={dbAvailable} onLocalPagesUpdated={setLocalPages} />
      </div>

      <section className="space-y-4" aria-label="Strata pages">
        {renderedPages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No Strata pages yet. Create your first page to get started.
          </p>
        ) : (
          <ul className="grid w-full grid-cols-1 gap-4">
            {renderedPages.map((page) => (
              <li key={page.id}>
                <StrataPageCard page={page} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
