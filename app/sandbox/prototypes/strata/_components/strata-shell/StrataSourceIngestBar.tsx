"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardPaste, FileUp, Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  STRATA_CLIPBOARD_PASTE_MAX_CHARS,
  STRATA_TEXT_SOURCES_MAX,
  type StrataTextSourceNode,
} from "@/lib/schemas/strata";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";
import { clientRandomUUID } from "@/lib/client-uuid";

export type StrataIngestMode = "web" | "url" | "files" | "clipboard";

/** Labels reused by `StrataSourceInput` segmented control. */
export const STRATA_INGEST_MODE_LABEL: Record<StrataIngestMode, string> = {
  web: "Web search",
  url: "URL",
  files: "Files",
  clipboard: "Clipboard",
};

/** Icons for each ingest mode (sidebar / segmented UI). */
export function strataIngestModeIcon(mode: StrataIngestMode) {
  return mode === "web"
    ? Search
    : mode === "url"
      ? Link2
      : mode === "files"
        ? FileUp
        : ClipboardPaste;
}

type SearchHit = { title: string; url: string; snippet: string };

/**
 * Ingest panels only (web / URL / files / clipboard) — no outer chrome or mode switcher.
 * Parent owns which mode is active (`StrataSourceInput` unified shell).
 */
export function StrataSourceIngestPanels({
  pageId,
  ingestEnabled,
  reduceMotion,
  mode,
  onModeChange,
  onAppendNodes,
  onClipboardPasteToNotepad,
}: {
  pageId: string;
  ingestEnabled: boolean;
  reduceMotion?: boolean | null;
  mode: StrataIngestMode;
  onModeChange: (next: StrataIngestMode | null) => void;
  onAppendNodes: (nodes: StrataTextSourceNode[]) => void;
  onClipboardPasteToNotepad: (text: string, suggestedTitle: string) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [urlPreview, setUrlPreview] = useState<{
    text: string;
    suggestedTitle: string;
    href: string;
  } | null>(null);
  const [urlTitleOverride, setUrlTitleOverride] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [clipboardTitleBusy, setClipboardTitleBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filesAutoOpenedRef = useRef(false);
  const clipboardAutoFiredRef = useRef(false);

  const canUseNetwork = ingestEnabled;
  /** Size-only layout + tween avoids spring overshoot clipping against overflow-hidden. */
  const layoutTransition = Boolean(reduceMotion)
    ? { duration: 0, layout: { duration: 0 } as const }
    : {
        layout: {
          type: "tween" as const,
          duration: 0.22,
          ease: [0.25, 0.1, 0.25, 1] as const,
        },
      };

  const appendChecked = useCallback(
    (nodes: StrataTextSourceNode[]) => {
      if (nodes.length === 0) return;
      onAppendNodes(nodes);
      toast.success(
        nodes.length === 1 ? "Added source to page content" : `Added ${nodes.length} sources`
      );
      setUrlInput("");
      setUrlTitleOverride("");
      setUrlPreview(null);
      setSearchHits([]);
      setSearchQuery("");
    },
    [onAppendNodes]
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      const raw = await navigator.clipboard.readText();

      if (!raw?.trim()) {
        toast.message("Clipboard empty", {
          description: "Copy text first, or paste with ⌘V into the notepad.",
        });

        return;
      }
      let excerpt = raw;

      if (raw.length > STRATA_CLIPBOARD_PASTE_MAX_CHARS) {
        excerpt = raw.slice(0, STRATA_CLIPBOARD_PASTE_MAX_CHARS);
        toast.message("Clipboard truncated", {
          description: `Using the first ${STRATA_CLIPBOARD_PASTE_MAX_CHARS.toLocaleString()} characters.`,
        });
      }

      let title = "From clipboard";

      if (ingestEnabled) {
        setClipboardTitleBusy(true);
        try {
          const res = await fetch("/api/prototypes/strata/clipboard-source-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId, excerpt }),
          });
          let data: { title?: unknown } = {};

          try {
            data = (await res.json()) as { title?: unknown };
          } catch {
            data = {};
          }
          if (res.ok && typeof data.title === "string" && data.title.trim().length > 0) {
            title = data.title.trim().slice(0, 512);
          }
        } finally {
          setClipboardTitleBusy(false);
        }
      }

      onClipboardPasteToNotepad(sanitizeRawUserInput(excerpt), title);
    } catch {
      toast.error("Could not read clipboard", {
        description: "Allow clipboard permission, or paste with ⌘V into the notepad.",
      });
    } finally {
      onModeChange(null);
    }
  }, [ingestEnabled, onClipboardPasteToNotepad, onModeChange, pageId]);

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) {
        onModeChange(null);

        return;
      }
      const nodes: StrataTextSourceNode[] = [];

      for (const file of Array.from(files)) {
        if (nodes.length >= STRATA_TEXT_SOURCES_MAX) break;
        const text = await file.text();

        nodes.push({
          id: clientRandomUUID(),
          kind: "file",
          title: file.name.slice(0, 512),
          body: sanitizeRawUserInput(text),
          createdAt: new Date().toISOString(),
          meta: { filename: file.name },
        });
      }
      appendChecked(nodes);
      if (fileRef.current) fileRef.current.value = "";
      onModeChange(null);
    },
    [appendChecked, onModeChange]
  );

  useEffect(() => {
    if (mode === "files" && !filesAutoOpenedRef.current) {
      filesAutoOpenedRef.current = true;
      fileRef.current?.click();
    }
    if (mode !== "files") {
      filesAutoOpenedRef.current = false;
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "clipboard" && !clipboardAutoFiredRef.current) {
      clipboardAutoFiredRef.current = true;
      void pasteFromClipboard();
    }
    if (mode !== "clipboard") {
      clipboardAutoFiredRef.current = false;
    }
  }, [mode, pasteFromClipboard]);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();

    if (!q) {
      toast.error("Enter a search query.");

      return;
    }
    if (!canUseNetwork) {
      toast.error("Search needs a synced page (not local-only).");

      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/prototypes/strata/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, op: "search", query: q }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Search failed");
      }
      setSearchHits((data.results ?? []) as SearchHit[]);
      if (!data.results?.length)
        toast.message("No results", { description: "Try different words." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }, [canUseNetwork, pageId, searchQuery]);

  const addSearchHitAsSource = useCallback(
    (hit: SearchHit) => {
      const safe = assertSafePublicHttpsUrl(hit.url);
      const node: StrataTextSourceNode = {
        id: clientRandomUUID(),
        kind: "web_query",
        title: hit.title.slice(0, 512),
        body: sanitizeRawUserInput(
          [
            hit.snippet?.trim() || "(no snippet)",
            "",
            `Source URL: ${safe.ok ? safe.href : hit.url}`,
          ].join("\n")
        ),
        createdAt: new Date().toISOString(),
        meta: { url: hit.url, query: searchQuery.trim() || undefined },
      };

      appendChecked([node]);
    },
    [appendChecked, searchQuery]
  );

  const previewUrl = useCallback(async () => {
    if (!canUseNetwork) {
      toast.error("URL import needs a synced page (not local-only).");

      return;
    }
    setBusy(true);
    setUrlPreview(null);
    try {
      const res = await fetch("/api/prototypes/strata/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, op: "url_preview", url: urlInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Preview failed");
      }
      setUrlPreview({
        text: data.previewText ?? "",
        suggestedTitle: data.suggestedTitle ?? "",
        href: data.canonicalUrl ?? urlInput.trim(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }, [canUseNetwork, pageId, urlInput]);

  const commitUrl = useCallback(async () => {
    if (!canUseNetwork) {
      toast.error("URL import needs a synced page (not local-only).");

      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/prototypes/strata/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          op: "url_commit",
          url: urlInput.trim(),
          title: urlTitleOverride.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Import failed");
      }
      if (data.node) appendChecked([data.node as StrataTextSourceNode]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }, [appendChecked, canUseNetwork, pageId, urlInput, urlTitleOverride]);

  const showClipboardLoader = mode === "clipboard" && clipboardTitleBusy;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.html,.css,.xml,.yaml,.yml"
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      <motion.div
        layout="size"
        initial={false}
        className={cn(
          "rounded-md",
          /** URL flows can exceed a flex-shrink slot; clipping hid preview/actions. */
          mode === "url"
            ? "min-h-min w-full shrink-0 overflow-visible"
            : "min-h-0 flex-1 overflow-hidden"
        )}
        transition={layoutTransition}
      >
        {mode === "web" ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className={cn(
                  glass(),
                  "min-w-0 flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                placeholder="Search the web (Exa)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                ref={(node) => {
                  if (node && document.activeElement !== node) node.focus();
                }}
              />
              <button
                type="button"
                disabled={busy || !canUseNetwork}
                title={!canUseNetwork ? "Requires synced page" : undefined}
                className={cn(
                  glass({ opaque: true }),
                  "inline-flex shrink-0 items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                )}
                onClick={() => void runSearch()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
            {searchHits.length > 0 ? (
              <ul className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-muted/10 p-2">
                {searchHits.map((h) => (
                  <li
                    key={h.url}
                    className="flex flex-col gap-1 rounded-md border border-border/40 bg-background/50 p-2 text-xs"
                  >
                    <span className="font-medium text-foreground">{h.title}</span>
                    <span className="line-clamp-2 text-muted-foreground">{h.snippet}</span>
                    <button
                      type="button"
                      className="self-start text-[11px] font-medium text-primary hover:underline"
                      onClick={() => addSearchHitAsSource(h)}
                    >
                      Approve snippet import
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {mode === "url" ? (
          <div className="flex flex-col gap-2">
            <input
              className={cn(
                glass(),
                "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              placeholder="https://…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              ref={(node) => {
                if (node && document.activeElement !== node) node.focus();
              }}
            />
            <input
              className={cn(
                glass(),
                "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              placeholder="Title override (optional)"
              value={urlTitleOverride}
              onChange={(e) => setUrlTitleOverride(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !canUseNetwork}
                className={cn(
                  glass({ opaque: true }),
                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                )}
                onClick={() => void previewUrl()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Preview
              </button>
              {!urlPreview ? (
                <button
                  type="button"
                  disabled={busy || !canUseNetwork}
                  className={cn(
                    glass({ opaque: true }),
                    "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                  )}
                  onClick={() => void commitUrl()}
                >
                  Import full page (Exa)
                </button>
              ) : null}
            </div>
            {urlPreview ? (
              <div className="space-y-2 rounded-md border border-border/50 bg-muted/10 p-3">
                <div className="max-h-40 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">{urlPreview.suggestedTitle}</p>
                  {urlPreview.text}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Preview looks good? Approve to persist this imported text as a source.
                  </p>
                  <button
                    type="button"
                    disabled={busy || !canUseNetwork}
                    className={cn(
                      glass({ opaque: true }),
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    )}
                    onClick={() => void commitUrl()}
                  >
                    Approve import
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "files" ? (
          <p className="text-sm text-muted-foreground">
            Choose one or more text files to add as sources.
          </p>
        ) : null}

        {mode === "clipboard" ? (
          <p className="text-sm text-muted-foreground">
            {showClipboardLoader ? "Reading clipboard and suggesting a title…" : "Reading clipboard…"}
          </p>
        ) : null}
      </motion.div>

      {!ingestEnabled && (mode === "web" || mode === "url") ? (
        <p className="text-xs text-muted-foreground">
          Web search and URL import require a synced page (turn off local-only and ensure you are
          online), then refresh.
        </p>
      ) : null}
    </div>
  );
}
