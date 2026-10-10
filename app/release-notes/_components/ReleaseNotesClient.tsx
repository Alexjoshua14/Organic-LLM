"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatThinking } from "@/components/chat/chat-loading";
import { Button } from "@/components/third-party/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { cn } from "@/lib/utils";

type VersionRow = { version: string; sha: string };

type NotesPayload = {
  fromSha: string;
  toSha: string;
  fromVersion: string | null;
  toVersion: string | null;
  commitCount: number;
  notes: {
    headline: string;
    summary: string;
    highlights: Array<{ title: string; detail: string }>;
  };
  model: string;
  generatedAt: string;
};

type ApiResult =
  | { status: "ok"; cached: boolean; payload: NotesPayload }
  | {
      status: "empty";
      reason: string;
      message: string;
      fromSha?: string | null;
      toSha?: string | null;
      commitCount?: number;
    };

type CatalogResponse = {
  versions: VersionRow[];
  currentVersion: string;
  previousVersion: string | null;
  result?: ApiResult;
  error?: string;
  message?: string;
};

type Mode = "version" | "compare";

function versionLabel(v: string) {
  return v.startsWith("v") ? v : `v${v}`;
}

export function ReleaseNotesClient() {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [previousVersion, setPreviousVersion] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("version");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [compareFrom, setCompareFrom] = useState<string>("");
  const [compareTo, setCompareTo] = useState<string>("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async (params: URLSearchParams) => {
    setLoadingNotes(true);
    setError(null);

    try {
      const res = await fetch(`/api/release-notes?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as CatalogResponse;

      if (!res.ok && !data.result) {
        setError(data.message ?? data.error ?? "Could not load release notes.");
        setResult(null);

        return;
      }

      if (data.versions?.length) setVersions(data.versions);
      if (data.currentVersion) setCurrentVersion(data.currentVersion);
      if (data.previousVersion !== undefined) setPreviousVersion(data.previousVersion);
      setResult(data.result ?? null);
    } catch {
      setError("Could not reach the release notes API.");
      setResult(null);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  // Catalog on mount, then notes for the latest increment — generation only when asked.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingCatalog(true);
      setError(null);

      try {
        const res = await fetch("/api/release-notes", { cache: "no-store" });
        const data = (await res.json()) as CatalogResponse;

        if (cancelled) return;

        if (!res.ok) {
          setError(data.message ?? data.error ?? "Could not load versions.");
          setLoadingCatalog(false);

          return;
        }

        setVersions(data.versions ?? []);
        setCurrentVersion(data.currentVersion);
        setPreviousVersion(data.previousVersion);
        setSelectedVersion(data.currentVersion);
        setCompareTo(data.currentVersion);
        setCompareFrom(data.previousVersion ?? data.currentVersion);
        setLoadingCatalog(false);

        if (data.currentVersion) {
          await loadNotes(new URLSearchParams({ version: data.currentVersion }));
        }
      } catch {
        if (!cancelled) {
          setError("Could not load version history.");
          setLoadingCatalog(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadNotes]);

  const onSelectVersion = (version: string) => {
    setSelectedVersion(version);
    setMode("version");
    void loadNotes(new URLSearchParams({ version }));
  };

  const onCompare = () => {
    if (!compareFrom || !compareTo) return;
    setMode("compare");
    void loadNotes(new URLSearchParams({ from: compareFrom, to: compareTo }));
  };

  const quietLoading = loadingCatalog || loadingNotes;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Product updates
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Release notes
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Plain-language summaries of what changed between Organic LLM versions, drawn from the
          public git history.
        </p>
        {currentVersion ? (
          <p className="text-xs text-muted-foreground">
            You are on {versionLabel(currentVersion)}
            {previousVersion
              ? ` · latest step from ${versionLabel(previousVersion)}`
              : " · no earlier version to compare"}
          </p>
        ) : null}
      </header>

      <section className="space-y-4 rounded-xl border border-border/50 bg-background-tertiary/20 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            variant={mode === "version" ? "default" : "ghost"}
            onClick={() => setMode("version")}
          >
            By version
          </Button>
          <Button
            size="sm"
            type="button"
            variant={mode === "compare" ? "default" : "ghost"}
            onClick={() => setMode("compare")}
          >
            Compare
          </Button>
        </div>

        {mode === "version" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs text-muted-foreground sm:w-28" htmlFor="rn-version">
              Version
            </label>
            <Select
              disabled={versions.length === 0 || loadingNotes}
              value={selectedVersion}
              onValueChange={onSelectVersion}
            >
              <SelectTrigger className="w-full sm:max-w-xs" id="rn-version" size="sm">
                <SelectValue placeholder="Choose a version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={v.version}>
                    {versionLabel(v.version)}
                    {v.version === currentVersion ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-muted-foreground sm:w-28" htmlFor="rn-from">
                From
              </label>
              <Select
                disabled={versions.length === 0 || loadingNotes}
                value={compareFrom}
                onValueChange={setCompareFrom}
              >
                <SelectTrigger className="w-full sm:max-w-xs" id="rn-from" size="sm">
                  <SelectValue placeholder="Earlier version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={`from-${v.version}`} value={v.version}>
                      {versionLabel(v.version)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-muted-foreground sm:w-28" htmlFor="rn-to">
                To
              </label>
              <Select
                disabled={versions.length === 0 || loadingNotes}
                value={compareTo}
                onValueChange={setCompareTo}
              >
                <SelectTrigger className="w-full sm:max-w-xs" id="rn-to" size="sm">
                  <SelectValue placeholder="Later version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={`to-${v.version}`} value={v.version}>
                      {versionLabel(v.version)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="self-start"
              disabled={!compareFrom || !compareTo || loadingNotes}
              size="sm"
              type="button"
              onClick={onCompare}
            >
              Show changes
            </Button>
          </div>
        )}
      </section>

      {quietLoading ? (
        <div className="py-6">
          <ChatThinking
            text={loadingCatalog ? "Loading versions…" : "Preparing release notes…"}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}

      {!quietLoading && result?.status === "empty" ? (
        <div
          className="rounded-xl border border-border/40 bg-background-tertiary/15 px-4 py-5 text-sm leading-relaxed text-muted-foreground"
          role="status"
        >
          {result.message}
        </div>
      ) : null}

      {!quietLoading && result?.status === "ok" ? (
        <article className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              {result.payload.fromVersion
                ? versionLabel(result.payload.fromVersion)
                : result.payload.fromSha.slice(0, 7)}
              {" → "}
              {result.payload.toVersion
                ? versionLabel(result.payload.toVersion)
                : result.payload.toSha.slice(0, 7)}
              <span className="mx-2 text-border">·</span>
              {result.payload.commitCount} commit
              {result.payload.commitCount === 1 ? "" : "s"}
              {result.cached ? (
                <span className="ml-2 text-muted-foreground/70">cached</span>
              ) : null}
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {result.payload.notes.headline}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
              {result.payload.notes.summary}
            </p>
          </div>

          {result.payload.notes.highlights.length > 0 ? (
            <ul className="space-y-3">
              {result.payload.notes.highlights.map((h) => (
                <li
                  key={`${h.title}-${h.detail.slice(0, 24)}`}
                  className={cn(
                    "rounded-lg border border-border/40 bg-background/40 px-4 py-3"
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{h.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
