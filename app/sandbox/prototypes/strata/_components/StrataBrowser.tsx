"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createAndOpenStrataPageAction } from "../actions";

import type { StrataPage } from "@/lib/schemas/strata";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { createLocalStrataPage, listLocalStrataPages } from "@/lib/strata/local-store";

export function StrataBrowser({
  pages,
  dbAvailable,
}: {
  pages: StrataPage[];
  dbAvailable: boolean;
}) {
  const router = useRouter();
  const [localPages, setLocalPages] = useState<StrataPage[]>([]);

  useEffect(() => {
    listLocalStrataPages().then(setLocalPages).catch(() => setLocalPages([]));
  }, []);

  const renderedPages = dbAvailable ? pages : localPages;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Strata</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Segment raw notes into refined layers and elaborated output.
        </p>
      </header>

      {!dbAvailable && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Supabase Strata tables are unavailable. Running in encrypted local-device mode only (ZDR).
        </p>
      )}

      {dbAvailable ? (
        <form action={createAndOpenStrataPageAction} className="flex flex-col gap-3 sm:flex-row">
          <input
            className={cn(
              glass(),
              "h-10 flex-1 rounded-lg border px-3 text-sm text-foreground placeholder:text-muted-foreground"
            )}
            name="title"
            placeholder="Optional title"
            type="text"
          />
          <button
            className={cn(
              glass({ opaque: true }),
              "h-10 rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            )}
            type="submit"
          >
            Create new page
          </button>
        </form>
      ) : (
        <button
          className={cn(
            glass({ opaque: true }),
            "h-10 rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          )}
          type="button"
          onClick={async () => {
            const page = await createLocalStrataPage();
            setLocalPages(await listLocalStrataPages());
            router.push(`/sandbox/prototypes/strata/${page.page.id}`);
          }}
        >
          Create new local page
        </button>
      )}

      <section className="space-y-2" aria-label="Strata pages">
        {renderedPages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Strata pages yet. Create your first page to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {renderedPages.map((page) => (
              <li key={page.id}>
                <Link
                  className={cn(
                    glass(),
                    "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
                  )}
                  href={`/sandbox/prototypes/strata/${page.id}`}
                >
                  <span className="font-medium text-foreground">{page.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(page.updated_at).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
