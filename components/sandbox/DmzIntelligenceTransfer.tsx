"use client";

import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Loader2,
  RotateCcw,
  Send,
  Shield,
} from "lucide-react";
import { useCallback, useState } from "react";

import { OpenInChat } from "@/components/design-system/OpenInChat";
import { DmzLumeButton } from "@/components/sandbox/DmzLumeButton";
import { Button } from "@/components/third-party/ui/button";
import { DMZ_CONNECTIONS, type DmzConnectionProvider } from "@/lib/security/dmz";
import {
  measureDmzClipboard,
  type DmzClipboardMetrics,
} from "@/lib/security/dmz/clipboard-metrics";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

type ClipboardPhase = "idle" | "grabbing" | "summarizing" | "processing" | "done" | "error";

type DmzIntelligenceTransferProps = {
  slug: string;
  subjectTitle: string;
  question: string;
  context: string;
};

type IntakeEntry = {
  id: string;
  status: string;
  findings: Array<{ severity: string; message: string }>;
};

export function DmzIntelligenceTransfer({
  slug,
  subjectTitle,
  question,
  context,
}: DmzIntelligenceTransferProps) {
  const [selectedProvider, setSelectedProvider] = useState<DmzConnectionProvider>("notion");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "preparing" | "sent">("idle");
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [outboundPrompt, setOutboundPrompt] = useState<string | null>(null);

  const [clipboardPhase, setClipboardPhase] = useState<ClipboardPhase>("idle");
  const [clipboardMetrics, setClipboardMetrics] = useState<DmzClipboardMetrics | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<IntakeEntry | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  const connection = DMZ_CONNECTIONS.find((c) => c.id === selectedProvider);
  const openInProviders =
    selectedProvider === "chatgpt"
      ? (["chatgpt"] as const)
      : selectedProvider === "claude"
        ? (["claude"] as const)
        : [];

  const handleSendQuestion = useCallback(async () => {
    setSendState("preparing");
    setSendNote(null);

    try {
      const res = await fetch("/api/dmz/outbound-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          subjectKey: slug,
          subjectTitle,
          question,
          context,
        }),
      });

      const data = (await res.json()) as { prompt?: string; error?: string; label?: string };

      if (!res.ok || !data.prompt) {
        setSendNote(data.error ?? "Could not prepare question");
        setSendState("idle");

        return;
      }

      setOutboundPrompt(data.prompt);

      if (openInProviders.length > 0) {
        setSendNote(`Ready — open ${data.label ?? connection?.label} below.`);
        setSendState("sent");

        return;
      }

      const copied = await copyTextToClipboard(data.prompt);

      setSendNote(
        copied
          ? `Copied for ${data.label ?? connection?.label}. Paste it there, then bring the answer back below.`
          : "Prompt ready — copy failed; use Preview question and copy manually."
      );
      setSendState("sent");
    } catch {
      setSendNote("Could not prepare question");
      setSendState("idle");
    }
  }, [selectedProvider, slug, subjectTitle, question, context, openInProviders, connection?.label]);

  const approveEntry = useCallback(async (entryId: string) => {
    const res = await fetch("/api/dmz/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, action: "approve" }),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as { entry?: { status: string } };

    setActiveEntry((prev) =>
      prev ? { ...prev, id: entryId, status: data.entry?.status ?? "approved" } : prev
    );

    return true;
  }, []);

  const handleGrabClipboard = useCallback(async () => {
    setClipboardPhase("grabbing");
    setClipboardError(null);
    setClipboardMetrics(null);
    setIntakeSummary(null);
    setActiveEntry(null);

    let raw = "";

    try {
      raw = await navigator.clipboard.readText();
    } catch {
      setClipboardPhase("error");
      setClipboardError("Allow clipboard access, or paste with ⌘V in your external tool first.");

      return;
    }

    if (!raw.trim()) {
      setClipboardPhase("error");
      setClipboardError("Clipboard is empty — copy the external answer first.");

      return;
    }

    const metrics = measureDmzClipboard(raw);

    setClipboardMetrics(metrics);
    setClipboardPhase("summarizing");

    let summary: string | null = null;

    try {
      const summaryRes = await fetch("/api/dmz/intake-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excerpt: raw,
          subjectKey: slug,
          provider: selectedProvider,
        }),
      });

      const summaryData = (await summaryRes.json()) as { summary?: string };

      if (summaryRes.ok && summaryData.summary) {
        summary = summaryData.summary;
        setIntakeSummary(summaryData.summary);
      }
    } catch {
      // Summary is optional — intake still proceeds.
    }

    setClipboardPhase("processing");

    try {
      const intakeRes = await fetch("/api/dmz/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          subjectKey: slug,
          text: raw,
          intakeSummary: summary ?? undefined,
          clipboardMeta: metrics,
        }),
      });

      const intakeData = (await intakeRes.json()) as {
        entry?: IntakeEntry;
        alert?: string | null;
        canAutoApprove?: boolean;
        error?: string;
      };

      if (!intakeRes.ok || !intakeData.entry) {
        setClipboardPhase("error");
        setClipboardError(intakeData.error ?? "Could not process clipboard");

        return;
      }

      setActiveEntry(intakeData.entry);

      if (intakeData.canAutoApprove && intakeData.entry.status === "pending") {
        await approveEntry(intakeData.entry.id);
      }

      setClipboardPhase("done");
    } catch {
      setClipboardPhase("error");
      setClipboardError("Could not process clipboard");
    }
  }, [approveEntry, selectedProvider, slug]);

  const handleUndo = useCallback(async () => {
    if (!activeEntry?.id) return;

    setUndoBusy(true);

    try {
      await fetch("/api/dmz/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: activeEntry.id }),
      });

      setClipboardPhase("idle");
      setClipboardMetrics(null);
      setIntakeSummary(null);
      setActiveEntry(null);
    } finally {
      setUndoBusy(false);
    }
  }, [activeEntry?.id]);

  const handleManualApprove = useCallback(async () => {
    if (!activeEntry?.id || activeEntry.status === "approved") return;

    setClipboardPhase("processing");
    const ok = await approveEntry(activeEntry.id);

    setClipboardPhase(ok ? "done" : "error");
    if (!ok) setClipboardError("Approval failed");
  }, [activeEntry, approveEntry]);

  const isClipboardBusy =
    clipboardPhase === "grabbing" ||
    clipboardPhase === "summarizing" ||
    clipboardPhase === "processing";

  return (
    <section className="space-y-5 rounded-xl border border-border/50 bg-muted/15 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Shield className="size-4 text-sky-300/90" />
        <p className="text-xs font-medium uppercase tracking-wide">DMZ intelligence transfer</p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Collection</span>
        <select
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value as DmzConnectionProvider);
            setSendState("idle");
            setSendNote(null);
            setOutboundPrompt(null);
          }}
        >
          {DMZ_CONNECTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setPreviewOpen((v) => !v)}
      >
        <span>Preview question (read-only)</span>
        <ChevronDown className={cn("size-3.5 transition-transform", previewOpen && "rotate-180")} />
      </button>

      {previewOpen ? (
        <p className="rounded-lg border border-border/40 bg-background/50 px-3 py-2.5 text-sm leading-relaxed text-foreground/90">
          {question}
        </p>
      ) : null}

      <div className="space-y-2">
        {openInProviders.length > 0 && sendState === "sent" && outboundPrompt ? (
          <OpenInChat
            presetId={`dmz-${slug}`}
            providers={[...openInProviders]}
            query={outboundPrompt}
            triggerLabel="Open in chat"
          />
        ) : null}

        <DmzLumeButton disabled={sendState === "preparing"} type="button" onClick={() => void handleSendQuestion()}>
          {sendState === "preparing" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Send question
        </DmzLumeButton>

        {sendNote ? <p className="text-center text-xs text-muted-foreground">{sendNote}</p> : null}
      </div>

      <div className="space-y-2 border-t border-border/40 pt-4">
        <p className="text-xs text-muted-foreground">Bring the answer back</p>

        {clipboardPhase === "idle" || clipboardPhase === "error" ? (
          <Button
            className="h-9 w-full justify-center gap-2 text-xs"
            disabled={isClipboardBusy}
            type="button"
            variant="outline"
            onClick={() => void handleGrabClipboard()}
          >
            <ClipboardPaste className="size-3.5" />
            Grab from clipboard
          </Button>
        ) : null}

        {clipboardError ? <p className="text-xs text-destructive">{clipboardError}</p> : null}

        {isClipboardBusy ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {clipboardPhase === "grabbing"
              ? "Reading clipboard…"
              : clipboardPhase === "summarizing"
                ? "Condensing for review…"
                : "Processing securely…"}
          </p>
        ) : null}

        {clipboardMetrics && clipboardPhase !== "idle" ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
              clipboardPhase === "done"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-border/50 bg-background/40 text-muted-foreground"
            )}
          >
            {clipboardPhase === "done" ? (
              <Check className="size-3.5 shrink-0 text-emerald-400" />
            ) : null}
            <span>
              Grabbed · {clipboardMetrics.lineCount.toLocaleString()} lines · ~
              {clipboardMetrics.estimatedTokens.toLocaleString()} tokens
            </span>
          </div>
        ) : null}

        {intakeSummary ? (
          <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Review summary
            </p>
            <p className="whitespace-pre-line text-sm leading-snug text-foreground/90">{intakeSummary}</p>
          </div>
        ) : null}

        {activeEntry?.status === "pending" && clipboardPhase === "done" ? (
          <Button
            className="h-9 w-full text-xs"
            type="button"
            onClick={() => void handleManualApprove()}
          >
            Approve &amp; add to Organic LLM
          </Button>
        ) : null}

        {activeEntry && clipboardPhase === "done" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-300/90">
              {activeEntry.status === "approved" ? "Added to Organic LLM" : "Quarantined for review"}
            </p>
            <Button
              className="h-8 gap-1.5 text-xs"
              disabled={undoBusy}
              type="button"
              variant="ghost"
              onClick={() => void handleUndo()}
            >
              <RotateCcw className="size-3.5" />
              Undo
            </Button>
          </div>
        ) : null}

        {activeEntry?.findings && activeEntry.findings.length > 0 ? (
          <ul className="space-y-1 text-[11px] text-amber-200/90">
            {activeEntry.findings.map((f, i) => (
              <li key={i}>
                {f.severity}: {f.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
