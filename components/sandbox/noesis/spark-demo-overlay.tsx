"use client";

import type { NoesisSpark } from "@/lib/sandbox/noesis/sparks/types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ChatThread } from "@/components/chat/chat-thread";
import { CoreInput } from "@/components/chat/core-input";
import {
  Conversation,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import { Dialog, DialogContent } from "@/components/third-party/ui/dialog";
import { ChatModel, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import {
  DEMO_DEFAULT_MODEL,
  DEMO_REPLY_CYCLES,
  DEMO_TOKEN_BUDGET,
} from "@/lib/sandbox/noesis/demo/config";

/** ChatModel object for the default demo model (falls back if the id ever changes). */
const DEMO_MODEL: ChatModel =
  ChatModels.find((m) => m.id === DEMO_DEFAULT_MODEL) ?? DEFAULT_CHAT_MODEL;

type DemoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spark: NoesisSpark;
  /** Possibly-edited system prompt from the editor. */
  systemPrompt: string;
  /** Possibly-edited kickoff message from the editor. */
  kickoff: string;
};

/** Concatenated text of a UIMessage's text parts. */
function messageText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p)
    .map((p) => p.text)
    .join("");
}

/** Reads the `totalTokens` we attach as assistant message metadata in demo-turn. */
function readTotalTokens(m: UIMessage): number {
  const meta = (m as { metadata?: unknown }).metadata;

  if (meta && typeof meta === "object" && "totalTokens" in meta) {
    const v = (meta as { totalTokens?: unknown }).totalTokens;

    return typeof v === "number" ? v : 0;
  }

  return 0;
}

type DemoTurn = { role: "user" | "assistant"; text: string };

function toTranscript(messages: UIMessage[]): DemoTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", text: messageText(m) }))
    .filter((t) => t.text.length > 0);
}

/**
 * Chat-pane-only overlay that auto-runs a demo conversation for a spark: kickoff →
 * spark reply, then NPC user → spark reply (×2), on the ultracheap model, under the
 * token budget. Content-addressed cache: identical inputs replay instantly (no LLM).
 */
export function SparkDemoOverlay(props: DemoProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] gap-0 overflow-hidden p-0"
        overlayClassName="bg-black/70"
      >
        {props.open ? <DemoRunner {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DemoRunner({ spark, systemPrompt, kickoff }: DemoProps) {
  const chatId = useMemo(() => crypto.randomUUID(), []);
  const modelRef = useRef<ChatModel>(DEMO_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);
  const useSpeechFriendlyRef = useRef(false);

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
        return { body: { messages, systemPrompt, model: modelRef.current.id } };
      },
    }),
    onError: () => {
      toast.error("Demo turn failed");
      phaseRef.current = "done";
      setRunning(false);
    },
  });

  const finalize = useCallback(async () => {
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
          model: modelRef.current.id,
        }),
      });
    } catch {
      /* non-fatal: cache save is best-effort */
    }
  }, [messages]);

  // On open: cache lookup → replay a hit, or kick off a fresh run.
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
            model: modelRef.current.id,
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
    // Run once per open (fresh mount).
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
            model: modelRef.current.id,
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

  return (
    <div className="flex h-[80vh] w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="truncate text-sm font-medium text-foreground">
          Demo — {spark.userFacingText}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {cacheHit ? (
            <span className="rounded bg-accent/15 px-2 py-0.5 font-medium text-accent">cached</span>
          ) : null}
          <span className="tabular-nums">
            {tokensUsed.toLocaleString()} / {DEMO_TOKEN_BUDGET.toLocaleString()} tokens
          </span>
          {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
        </div>
      </div>

      <Conversation className="relative flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overscroll-x-none">
        <ChatThread messages={messages} />
        <ConversationScrollButton className="bottom-14" />
      </Conversation>

      <div className="-mt-10 w-full shrink-0 px-4 pb-3">
        <CoreInput
          defaultModel={DEMO_MODEL}
          modelLocalStorageKey="noesis-demo-model"
          modelRef={modelRef}
          sendMessage={sendMessage}
          status={status}
          stop={stop}
          useMemoriesRef={useMemoriesRef}
          useSpeechFriendlyRef={useSpeechFriendlyRef}
          useWebSearchRef={useWebSearchRef}
          variant="compact"
        />
      </div>
    </div>
  );
}
