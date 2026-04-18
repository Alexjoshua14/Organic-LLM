"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StrataCreatePageForm } from "./StrataCreatePageForm";
import { StrataPageCard } from "./StrataPageCard";

import { isUntitledStrataTitle, type StrataPage, type StrataPageWithSections } from "@/lib/schemas/strata";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { getLocalStrataPage, listLocalStrataPages, saveLocalStrataPage } from "@/lib/strata/local-store";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";

function sectionsSnapshotFromFull(full: StrataPageWithSections) {
  return {
    raw_text: sanitizeRawUserInput(full.sections.raw_text.content),
    refined_text: full.sections.refined_text.content,
    elaborated: full.sections.elaborated.content,
    design_instructions: full.sections.design_instructions.content,
    ai_instructions: full.sections.ai_instructions.content,
  };
}

function refinedGeneratedTitleFromFull(full: StrataPageWithSections) {
  return (
    (full.sections.refined_text.contentJson as { generatedTitle?: string } | null)?.generatedTitle ??
    undefined
  );
}

export function StrataBrowser({
  pages,
  dbAvailable,
}: {
  pages: StrataPage[];
  dbAvailable: boolean;
}) {
  const router = useRouter();
  const [localPages, setLocalPages] = useState<StrataPage[]>([]);
  const [generatingTitleId, setGeneratingTitleId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [titleMessage, setTitleMessage] = useState<{ kind: "error" | "success"; text: string } | null>(
    null
  );

  useEffect(() => {
    listLocalStrataPages().then(setLocalPages).catch(() => setLocalPages([]));
  }, []);

  const renderedPages = dbAvailable ? pages : localPages;

  const untitledPages = useMemo(
    () => renderedPages.filter((p) => isUntitledStrataTitle(p.title)),
    [renderedPages]
  );

  const usesLocalTitleFlow = useCallback(
    (page: StrataPage) => !dbAvailable || page.id.startsWith("local-"),
    [dbAvailable]
  );

  const generateTitleForPage = useCallback(
    async (page: StrataPage) => {
      setTitleMessage(null);

      const localFlow = usesLocalTitleFlow(page);

      if (localFlow) {
        const full = await getLocalStrataPage(page.id);
        if (!full) {
          setTitleMessage({ kind: "error", text: "Could not load local page to generate a title." });
          return;
        }

        const res = await fetch(`/api/prototypes/strata/${page.id}/generate-title`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionsSnapshot: sectionsSnapshotFromFull(full),
            refinedGeneratedTitle: refinedGeneratedTitleFromFull(full),
            applyToDatabase: false,
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok || typeof payload?.data !== "string" || !payload.data.trim()) {
          setTitleMessage({
            kind: "error",
            text: typeof payload?.error === "string" ? payload.error : "Title generation failed.",
          });
          return;
        }

        const nextTitle = payload.data.trim();
        await saveLocalStrataPage({
          ...full,
          page: { ...full.page, title: nextTitle },
        });
        setLocalPages(await listLocalStrataPages());
        setTitleMessage({ kind: "success", text: `Updated title for “${nextTitle.slice(0, 48)}${nextTitle.length > 48 ? "…" : ""}”.` });
        return;
      }

      const res = await fetch(`/api/prototypes/strata/${page.id}/generate-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyToDatabase: true }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || typeof payload?.data !== "string" || !payload.data.trim()) {
        setTitleMessage({
          kind: "error",
          text: typeof payload?.error === "string" ? payload.error : "Title generation failed.",
        });
        return;
      }

      setTitleMessage({ kind: "success", text: "Title updated." });
      router.refresh();
    },
    [router, usesLocalTitleFlow]
  );

  const handleGenerateTitle = useCallback(
    async (page: StrataPage) => {
      setGeneratingTitleId(page.id);
      try {
        await generateTitleForPage(page);
      } finally {
        setGeneratingTitleId(null);
      }
    },
    [generateTitleForPage]
  );

  const handleGenerateAllMissing = useCallback(async () => {
    if (untitledPages.length === 0) return;
    setBulkGenerating(true);
    setTitleMessage(null);
    try {
      for (const page of untitledPages) {
        setGeneratingTitleId(page.id);
        await generateTitleForPage(page);
      }
    } finally {
      setGeneratingTitleId(null);
      setBulkGenerating(false);
    }
  }, [generateTitleForPage, untitledPages]);

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

      {titleMessage && (
        <p
          className={cn(
            "text-center text-sm",
            titleMessage.kind === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
          )}
          role="status"
        >
          {titleMessage.text}
        </p>
      )}

      <div className="flex w-full flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:justify-between">
        {untitledPages.length > 0 && (
          <button
            className={cn(
              glass({ opaque: true }),
              "h-10 shrink-0 rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            )}
            disabled={generatingTitleId != null || bulkGenerating}
            type="button"
            onClick={() => void handleGenerateAllMissing()}
          >
            {bulkGenerating ? "Generating titles…" : `Generate missing titles (${untitledPages.length})`}
          </button>
        )}
        <div className="flex w-full justify-end sm:w-auto">
          <StrataCreatePageForm dbAvailable={dbAvailable} onLocalPagesUpdated={setLocalPages} />
        </div>
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
                <StrataPageCard
                  isGeneratingTitle={generatingTitleId === page.id}
                  page={page}
                  onGenerateTitle={
                    isUntitledStrataTitle(page.title) ? () => handleGenerateTitle(page) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
