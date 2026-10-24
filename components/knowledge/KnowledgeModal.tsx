"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { useKnowledgeCache } from "@/hooks/use-knowledge-cache";
import { cn } from "@/lib/utils";

function renderPlainKnowledgeText(text: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  const buf: string[] = [];

  const flush = () => {
    if (!buf.length) return;
    const paragraph = buf.join("\n").trimEnd();

    if (paragraph) {
      out.push(
        <p key={out.length} className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {paragraph}
        </p>
      );
    }
    buf.length = 0;
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flush();
      out.push(
        <h2 key={out.length} className="text-base font-semibold text-foreground pt-3 first:pt-0">
          {line.slice(2).trim()}
        </h2>
      );
    } else {
      buf.push(line);
    }
  }

  flush();

  return out;
}

type KnowledgeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string | null;
};

export function KnowledgeModal({ open, onOpenChange, displayName }: KnowledgeModalProps) {
  const { cached, setCached } = useKnowledgeCache();
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreamed("");
      setError(null);
      setLoading(false);

      return;
    }

    if (cached != null) {
      return;
    }

    const ac = new AbortController();

    abortRef.current = ac;
    setStreamed("");
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/profile/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
          body: JSON.stringify({
            displayName: displayName?.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");

          setError(errText || `Request failed (${res.status})`);
          setLoading(false);

          return;
        }

        if (!res.body) {
          setError("No response body");
          setLoading(false);

          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreamed(full);
        }

        setCached(full);
        setLoading(false);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Something went wrong");
        setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [open, cached, displayName, setCached]);

  const bodyText = cached ?? streamed;
  const showSpinner = loading && !bodyText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] flex flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-2 pr-8 text-left">
          <DialogTitle className="text-lg font-semibold leading-snug">
            Here&apos;s what Organic LLM remembers about you
          </DialogTitle>
          <DialogDescription className="sr-only">
            Plain-text summary from your profile and stored memories.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "mt-2 min-h-[12rem] max-h-[min(60dvh,28rem)] overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-3 font-mono text-[13px]"
          )}
        >
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : showSpinner ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : bodyText ? (
            <div className="space-y-1 font-sans">{renderPlainKnowledgeText(bodyText)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
