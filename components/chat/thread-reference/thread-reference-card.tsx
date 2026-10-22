"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Mic, X } from "lucide-react";
import { toast } from "sonner";
import type { ThreadReference } from "@/lib/chat/thread-reference";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";

/** Compact source chip: the UUID remains the canonical payload, never the generated label. */
export function ThreadReferenceCard({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const [reference, setReference] = useState<ThreadReference | null>(null);
  const [failed, setFailed] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const voice = useVoiceSessionOptional();
  const speak = async () => {
    if (!voice || voicePending) return;
    setVoicePending(true);
    try {
      const response = await fetch("/api/thread-references", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: id, variant: "voice" }) });
      if (!response.ok) throw new Error("Thread unavailable");
      const body = await response.json();
      await voice.speakToSubagent(body.voiceSeed);
    } catch { toast.error("Couldn’t start voice from this thread"); }
    finally { setVoicePending(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/thread-references", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: id }), signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const body = await response.json();
        setReference(body.data);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id]);
  return <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-accent/25 bg-accent/10 px-2 py-1 text-xs text-accent">
    <MessageSquare aria-hidden="true" className="size-3.5 shrink-0" />
    <span className="min-w-0" aria-live="polite">
      <a className="block truncate font-medium hover:underline focus-visible:outline focus-visible:outline-2" href={`/chat/${id}`} target="_blank" rel="noopener noreferrer" title={reference?.title ?? id}>
        {reference?.essence ?? (failed ? "Thread unavailable · remove or retry paste" : "Preparing thread reference…")}
      </a>
      {reference?.source === "fallback" ? <span className="block text-[10px] text-foreground-secondary">Source label · {reference.title}</span> : null}
    </span>
    {voice && reference ? <button aria-label="Start a new voice conversation from this thread" title="Speak from this thread · starts a new voice conversation" disabled={voicePending || voice.connecting} className="grid size-6 shrink-0 place-content-center rounded hover:bg-accent/15 disabled:opacity-40 focus-visible:outline focus-visible:outline-2" type="button" onClick={() => { void speak(); }}><Mic className="size-3" /></button> : null}
    {onRemove ? <button aria-label="Remove thread reference" className="grid size-6 shrink-0 place-content-center rounded hover:bg-accent/15 focus-visible:outline focus-visible:outline-2" type="button" onClick={onRemove}><X className="size-3" /></button> : null}
  </span>;
}
