"use client";

import { useCallback, useRef, useState } from "react";
import { ClipboardPaste, FileUp, Link2, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  STRATA_TEXT_SOURCES_MAX,
  type StrataTextSourceNode,
} from "@/lib/schemas/strata";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";
import { clientRandomUUID } from "@/lib/client-uuid";

type IngestMode = "text" | "search" | "url";

type SearchHit = { title: string; url: string; snippet: string };

export function StrataSourceIngestBar({
  pageId,
  ingestEnabled,
  onAppendNodes,
}: {
  pageId: string;
  ingestEnabled: boolean;
  onAppendNodes: (nodes: StrataTextSourceNode[]) => void;
}) {
  const [mode, setMode] = useState<IngestMode>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlPreview, setUrlPreview] = useState<{ text: string; suggestedTitle: string; href: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canUseNetwork = ingestEnabled;

  const appendChecked = useCallback(
    (nodes: StrataTextSourceNode[]) => {
      if (nodes.length === 0) return;
      onAppendNodes(nodes);
      toast.success(
        nodes.length === 1 ? "Added source to page content" : `Added ${nodes.length} sources`
      );
      setTitle("");
      setBody("");
      setUrlInput("");
      setUrlPreview(null);
      setSearchHits([]);
      setSearchQuery("");
    },
    [onAppendNodes]
  );

  const submitText = useCallback(() => {
    const t = title.trim() || "Pasted text";
    const b = body.trim();
    if (!b) {
      toast.error("Enter some text to add.");
      return;
    }
    const node: StrataTextSourceNode = {
      id: clientRandomUUID(),
      kind: "user_text",
      title: t.slice(0, 512),
      body: sanitizeRawUserInput(b),
      createdAt: new Date().toISOString(),
    };
    appendChecked([node]);
  }, [appendChecked, body, title]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        toast.message("Clipboard empty", {
          description: "Copy text first, or paste with ⌘V in the text area.",
        });
        return;
      }
      const node: StrataTextSourceNode = {
        id: clientRandomUUID(),
        kind: "clipboard",
        title: title.trim() || "From clipboard",
        body: sanitizeRawUserInput(text),
        createdAt: new Date().toISOString(),
      };
      appendChecked([node]);
    } catch {
      toast.error("Could not read clipboard", {
        description: "Allow clipboard permission or paste with ⌘V into the text area.",
      });
    }
  }, [appendChecked, title]);

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
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
    },
    [appendChecked]
  );

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
      if (!data.results?.length) toast.message("No results", { description: "Try different words." });
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
          [hit.snippet?.trim() || "(no snippet)", "", `Source URL: ${safe.ok ? safe.href : hit.url}`].join("\n")
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
          title: title.trim() || undefined,
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
  }, [appendChecked, canUseNetwork, pageId, title, urlInput]);

  return (
    <div className={cn(glass({ opaque: true }), "flex flex-col gap-3 rounded-xl border border-border/60 p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        {(["text", "search", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              mode === m
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setMode(m)}
          >
            {m === "text" ? "Text" : m === "search" ? "Web search" : "URL"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={pasteFromClipboard}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Clipboard
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          Files
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.html,.css,.xml,.yaml,.yml"
          onChange={(e) => void onPickFiles(e.target.files)}
        />
      </div>

      {mode === "text" ? (
        <div className="flex flex-col gap-2">
          <input
            className={cn(
              glass(),
              "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            )}
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={cn(
              glass(),
              "min-h-[120px] w-full resize-y rounded-md border border-border/60 bg-background/40 p-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            )}
            placeholder="Raw notes, export from ChatGPT / Notebook LM / Perplexity…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className={cn(
              glass({ opaque: true }),
              "inline-flex items-center justify-center gap-2 self-end rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            )}
            onClick={submitText}
          >
            <Send className="h-4 w-4" />
            Add as source
          </button>
        </div>
      ) : null}

      {mode === "search" ? (
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          {searchHits.length > 0 ? (
            <ul className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-muted/10 p-2">
              {searchHits.map((h) => (
                <li key={h.url} className="flex flex-col gap-1 rounded-md border border-border/40 bg-background/50 p-2 text-xs">
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
          />
          <input
            className={cn(
              glass(),
              "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            placeholder="Title override (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
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
    </div>
  );
}
