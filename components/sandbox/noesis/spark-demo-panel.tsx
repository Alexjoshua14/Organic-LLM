"use client";

import type { NoesisSpark } from "@/lib/sandbox/noesis/sparks/types";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ChatModels } from "@/lib/schemas/chat";
// NOTE: import the CLIENT mirror, never `./demo/config` — see config.client.ts for why
// (sharing config.ts with these client components breaks Clerk auth in the demo routes).
import {
  DEMO_DEFAULT_MODEL_ID,
  DEMO_REPLY_CYCLES,
  DEMO_TOKEN_BUDGET,
} from "@/lib/sandbox/noesis/demo/config.client";

type DemoTurn = { role: "user" | "assistant"; text: string };

/** Concatenated text of a UIMessage's text parts. */
function messageText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p)
    .map((p) => p.text)
    .join("");
}

/** Reads the `totalTokens` attached as assistant message metadata in demo-turn. */
function readTotalTokens(m: UIMessage): number {
  const meta = (m as { metadata?: unknown }).metadata;

  if (meta && typeof meta === "object" && "totalTokens" in meta) {
    const v = (meta as { totalTokens?: unknown }).totalTokens;

    return typeof v === "number" ? v : 0;
  }

  return 0;
}

function toTranscript(messages: UIMessage[]): DemoTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", text: messageText(m) }))
    .filter((t) => t.text.length > 0);
}

type PanelProps = {
  spark: NoesisSpark;
  /** Possibly-edited system prompt from the editor. */
  systemPrompt: string;
  /** Possibly-edited kickoff message from the editor. */
  kickoff: string;
  /** Return to the edit view (same modal pane). */
  onBack: () => void;
};

/**
 * Condensed, in-modal demo runner for an authored spark. Auto-runs a short conversation
 * (kickoff → spark reply, then NPC user → spark reply ×2) on an ultracheap model under the
 * token budget, rendered as a compact transcript — not the full chat view. Content-addressed
 * cache: identical inputs replay instantly. Selecting a different model or hitting Re-run
 * remounts the inner runner with a fresh key so a new run starts cleanly.
 */
export function SparkDemoPanel({ spark, systemPrompt, kickoff, onBack }: PanelProps) {
  const [runId, setRunId] = useState(0);
  const [modelId, setModelId] = useState<string>(DEMO_DEFAULT_MODEL_ID);

  return (
    <DemoRun
      key={`${runId}:${modelId}`}
      kickoff={kickoff}
      modelId={modelId}
      spark={spark}
      systemPrompt={systemPrompt}
      onBack={onBack}
      onModelChange={setModelId}
      onRerun={() => setRunId((n) => n + 1)}
    />
  );
}

function DemoRun({
  spark,
  systemPrompt,
  kickoff,
  modelId,
  onBack,
  onModelChange,
  onRerun,
}: PanelProps & {
  modelId: string;
  onModelChange: (id: string) => void;
  onRerun: () => void;
}) {
  const chatId = useMemo(() => crypto.randomUUID(), []);

  const [cacheHit, setCacheHit] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [running, setRunning] = useState(false);

  const phaseRef = useRef<"idle" | "running" | "npc" | "done">("idle");
  const npcTokensRef = useRef(0);
  const hashRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => void (mountedRef.current = false), []);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/sandbox/topic-explore/demo-turn",
      prepareSendMessagesRequest({ messages }) {
        return { body: { messages, systemPrompt, model: modelId } };
      },
    }),
    onError: () => {
      toast.error("Demo turn failed");
      phaseRef.current = "done";
      setRunning(false);
    },
  });

  const finalize = async () => {
    if (!hashRef.current) return;
    const transcript = toTranscript(messages);

    if (transcript.length === 0) return;

    const sparkTokens = messages
      .filter((m) => m.role === "assistant")
      .reduce((sum, m) => sum + readTotalTokens(m), 0);
    const total = sparkTokens + npcTokensRef.current;

    try {
      await fetch("/api/sandbox/topic-explore/demo-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          hash: hashRef.current,
          transcript,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: total },
          model: modelId,
        }),
      });
    } catch {
      /* non-fatal: cache save is best-effort */
    }
  };

  // On mount: cache lookup → replay a hit, or kick off a fresh run.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sandbox/topic-explore/demo-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "lookup",
            systemPrompt,
            kickoff,
            model: modelId,
            cycles: DEMO_REPLY_CYCLES,
          }),
        });
        const data = (await res.json()) as {
          hit?: boolean;
          hash?: string;
          transcript?: DemoTurn[] | null;
          usage?: { totalTokens?: number } | null;
        };

        if (!mountedRef.current) return;
        hashRef.current = data.hash ?? null;

        if (data.hit && Array.isArray(data.transcript)) {
          setMessages(
            data.transcript.map(
              (t, i) =>
                ({
                  id: `cache-${i}`,
                  role: t.role,
                  parts: [{ type: "text", text: t.text }],
                }) as UIMessage
            )
          );
          setCacheHit(true);
          setTokensUsed(data.usage?.totalTokens ?? 0);
          phaseRef.current = "done";

          return;
        }

        phaseRef.current = "running";
        setRunning(true);
        void sendMessage({ text: kickoff });
      } catch {
        if (mountedRef.current) toast.error("Could not start demo");
      }
    })();
    // Fresh mount per run (parent re-keys on Re-run / model change).
  }, []);

  // Drive the loop: after each spark reply, either stop or fetch the next NPC user turn.
  useEffect(() => {
    if (phaseRef.current !== "running" || status !== "ready") return;

    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    const repliesDone = assistantMsgs.length;

    if (repliesDone === 0) return;

    const sparkTokens = assistantMsgs.reduce((sum, m) => sum + readTotalTokens(m), 0);
    const total = sparkTokens + npcTokensRef.current;

    setTokensUsed(total);

    if (repliesDone >= DEMO_REPLY_CYCLES || total >= DEMO_TOKEN_BUDGET) {
      phaseRef.current = "done";
      setRunning(false);
      void finalize();

      return;
    }

    phaseRef.current = "npc";
    void (async () => {
      try {
        const res = await fetch("/api/sandbox/topic-explore/npc-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: toTranscript(messages),
            sparkContext: spark.userFacingText,
            model: modelId,
          }),
        });
        const data = (await res.json()) as { text?: string; usage?: { totalTokens?: number } };

        if (!mountedRef.current) return;

        if (!res.ok || !data.text) {
          phaseRef.current = "done";
          setRunning(false);
          void finalize();

          return;
        }

        npcTokensRef.current += data.usage?.totalTokens ?? 0;
        phaseRef.current = "running";
        void sendMessage({ text: data.text });
      } catch {
        if (!mountedRef.current) return;
        phaseRef.current = "done";
        setRunning(false);
        void finalize();
      }
    })();
  }, [status, messages]);

  const handleBack = () => {
    stop();
    onBack();
  };

  // Compact transcript rows: label user turns (first = the kickoff, rest = NPC).
  let userSeen = 0;
  const rows = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = messageText(m);

      if (m.role === "assistant") {
        return { id: m.id, role: "assistant" as const, label: "spark", text };
      }
      userSeen += 1;

      return { id: m.id, role: "user" as const, label: userSeen === 1 ? "you" : "you · npc", text };
    });

  const budgetPct = Math.min(100, Math.round((tokensUsed / DEMO_TOKEN_BUDGET) * 100));

  return (
    <div className="flex flex-col">
      {/* Header row 1: title + live budget */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium text-foreground">
          Demo — {spark.userFacingText}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {cacheHit ? (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-medium text-accent">
              cached
            </span>
          ) : null}
          <span className="tabular-nums">
            {tokensUsed.toLocaleString()} / {DEMO_TOKEN_BUDGET.toLocaleString()}
          </span>
          {running ? <Loader2 className="size-3.5 animate-spin text-accent" /> : null}
        </div>
      </div>

      {/* Thin budget meter */}
      <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-border/50">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            running ? "bg-accent" : "bg-accent/50"
          )}
          style={{ width: `${budgetPct}%` }}
        />
      </div>

      {/* Header row 2: back + model switch + re-run */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          type="button"
          onClick={handleBack}
        >
          <ChevronLeft className="size-3.5" />
          Edit
        </button>
        <div className="flex items-center gap-2">
          <select
            aria-label="Demo model"
            className="max-w-[9rem] truncate rounded-md border border-border/60 bg-background-secondary/40 px-1.5 py-1 text-xs text-foreground focus:border-accent/50 focus:outline-none"
            value={modelId}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {ChatModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            aria-label="Re-run demo"
            className="flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            disabled={running}
            type="button"
            onClick={onRerun}
          >
            <RefreshCw className={cn("size-3.5", running && "animate-spin")} />
            Re-run
          </button>
        </div>
      </div>

      {/* Condensed transcript */}
      <div className="mt-3 flex max-h-[50vh] min-h-[8rem] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-background/30 p-2">
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Starting demo…
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-2.5 py-1.5",
                row.role === "assistant"
                  ? "bg-background-secondary/50"
                  : "bg-accent/5 border border-accent/10"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  row.role === "assistant" ? "text-muted-foreground" : "text-accent/80"
                )}
              >
                {row.label}
              </span>
              <span className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {row.text.length > 0 ? row.text : <span className="text-muted-foreground">…</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
