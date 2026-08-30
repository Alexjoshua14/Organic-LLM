"use client";

import type { ChatErrorInfo } from "@/lib/chat/error-messages";

import { useCallback, useState } from "react";
import { ClipboardCopy, ExternalLink, X } from "lucide-react";

import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { cn } from "@/lib/utils";

type ChatErrorPanelProps = {
  info: ChatErrorInfo | null;
  onDismiss: () => void;
  className?: string;
};

const IS_DEV = process.env.NODE_ENV !== "production";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-2xs leading-relaxed">
      <span className="shrink-0 w-24 text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="min-w-0 break-all font-mono">{value}</span>
    </div>
  );
}

/**
 * Developer-facing failure detail for the current turn.
 *
 * Regular users only ever see the toast; this renders for admins (profiles.admin) and
 * in development, where the server also attaches its full report. It exists because a
 * masked "An error occurred" gives no way to tell an auth failure from a Redis outage
 * from a model-gateway 400.
 */
export function ChatErrorPanel({ info, onDismiss, className }: ChatErrorPanelProps) {
  const isAdmin = useIsAdmin();
  const [copied, setCopied] = useState(false);

  const copyReport = useCallback(async () => {
    if (!info) return;
    const ok = await copyTextToClipboard(JSON.stringify(info, null, 2));

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [info]);

  if (!info) return null;
  if (!IS_DEV && isAdmin !== true) return null;

  const { detail } = info;

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs",
        className
      )}
      data-testid="chat-error-panel"
      role="status"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-destructive">Request failed</span>
            {info.stage ? (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-2xs text-destructive">
                {info.stage}
              </span>
            ) : null}
            {info.status ? (
              <span className="font-mono text-2xs text-muted-foreground">HTTP {info.status}</span>
            ) : null}
          </div>
          <p className="mt-1 text-muted-foreground">{info.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Copy error report"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            title={copied ? "Copied" : "Copy error report"}
            type="button"
            onClick={copyReport}
          >
            <ClipboardCopy className="size-3.5" />
          </button>
          <a
            aria-label="Open recent server errors"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            href="/admin/errors"
            rel="noreferrer"
            target="_blank"
            title="Recent server errors"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            aria-label="Dismiss error"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            type="button"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {info.errorId ? <Row label="Error id" value={info.errorId} /> : null}
        {info.nextDigest ? <Row label="Next digest" value={info.nextDigest} /> : null}
        {detail?.name ? <Row label="Error" value={`${detail.name}: ${detail.message}`} /> : null}
        {detail?.code ? <Row label="Code" value={detail.code} /> : null}
        {detail?.statusCode ? <Row label="Upstream" value={String(detail.statusCode)} /> : null}
        {detail?.url ? <Row label="URL" value={detail.url} /> : null}
        {detail?.cause ? <Row label="Cause" value={detail.cause} /> : null}
        {detail?.context ? <Row label="Context" value={JSON.stringify(detail.context)} /> : null}
      </div>

      {info.errorId && !detail ? (
        <p className="mt-2 text-2xs text-muted-foreground">
          Full detail is admin-only. Search the server logs for{" "}
          <span className="font-mono">{info.errorId}</span>, or open{" "}
          <span className="font-mono">/admin/errors</span>.
        </p>
      ) : null}

      {detail?.stack || info.raw ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
            {detail?.stack ? "Stack trace" : "Raw response"}
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-background/60 p-2 text-2xs leading-relaxed whitespace-pre-wrap break-all">
            {detail?.stack ?? info.raw}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
