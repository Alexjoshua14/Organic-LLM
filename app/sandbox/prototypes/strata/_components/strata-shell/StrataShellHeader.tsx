"use client";

import type { SourceSaveState, StrataMainTab } from "./strata-shell-model";

import { StrataAssistantOpenHint } from "../StrataWorkspace";

import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { cn } from "@/lib/utils";

export function StrataShellHeader({
  title,
  activeTab,
  sourceSaveLabel,
  sourceSaveState,
  localOnlyMode,
  dbAvailable,
}: {
  title: string;
  activeTab: StrataMainTab;
  sourceSaveLabel: string | null;
  sourceSaveState: SourceSaveState;
  localOnlyMode: boolean;
  dbAvailable: boolean;
}) {
  return (
    <PageContentFrame className="shrink-0 pb-0">
      <PageNavBack
        className="mb-4"
        href="/sandbox/prototypes/strata"
        trailing={<StrataAssistantOpenHint />}
      >
        ← Strata pages
      </PageNavBack>

      <header className="mb-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {activeTab === "source" && sourceSaveLabel ? (
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs tabular-nums",
                sourceSaveState === "saving" &&
                  "border-border/60 bg-muted/30 text-muted-foreground",
                sourceSaveState === "saved" &&
                  "border-emerald-500/35 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
                sourceSaveState === "error" &&
                  "border-destructive/40 bg-destructive/10 text-destructive"
              )}
              role="status"
            >
              {sourceSaveLabel}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {localOnlyMode ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
              ZDR compliant — local-only encrypted storage
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
              Sync mode — Supabase + encrypted local backup
            </span>
          )}
          {!dbAvailable && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
              Supabase unavailable: local fallback active
            </span>
          )}
        </div>
      </header>
    </PageContentFrame>
  );
}
