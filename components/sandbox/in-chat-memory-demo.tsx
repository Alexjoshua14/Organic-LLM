"use client";

import type { UIMessage } from "ai";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatThread } from "@/components/chat/chat-thread";
import { CoreInput } from "@/components/chat/core-input";
import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import {
  Conversation,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import { glass } from "@/components/design-system/primitives";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

const USER_MSG = "What do you remember about my preferences?";
const ASSISTANT_FULL =
  "I've pulled a couple of memories for this reply. You prefer dark mode across apps and you're working on a web app with AI chat and memory. I've also saved that you asked to preview the memory UI — that's now in your persisted memory for future threads.";

const USER_MSG_2 = "Can you remind me what you just saved?";
const ASSISTANT_FULL_2 =
  "I just saved that you asked to preview the memory UI in the sandbox. That’s stored in your persisted memory now, so any thread can use it. Want to open “View persisted memory” to see the full list?";

const SAMPLE_RETRIEVED = [
  { memory: "User prefers dark mode for all applications and interfaces." },
  { memory: "User is working on a web application with AI chat and memory." },
];
const SAMPLE_ADDED = [{ memory: "User asked to preview memory UI components in the sandbox." }];
const SAMPLE_RETRIEVED_2 = [
  { memory: "User asked to preview memory UI components in the sandbox." },
];

/** Shown at end of demo as “just persisted” */
const SAMPLE_ADDED_END = [
  {
    memory: "User asked to be reminded what was just saved in the conversation.",
  },
  {
    memory: "User reviewed the in-chat memory UI demo with streaming and ephemeral cards.",
  },
  { memory: "User is exploring Organic LLM memory features in the sandbox." },
];

const STREAM_CHAR_MS = 28;
const DELAY_BEFORE_STREAM_MS = 1200;
const DELAY_BEFORE_ADDED_MS = 2200;
const DELAY_BEFORE_ROUND_2_MS = 1800;

const DEMO_USER_1_ID = "demo-user-1";
const DEMO_ASSISTANT_1_ID = "demo-assistant-1";
const DEMO_USER_2_ID = "demo-user-2";
const DEMO_ASSISTANT_2_ID = "demo-assistant-2";

function createUserMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function createAssistantMessage(id: string, text: string): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

export function InChatMemoryDemo({ className }: { className?: string }) {
  const [round, setRound] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<"idle" | "retrieved" | "streaming" | "done">("idle");
  const [streamedText, setStreamedText] = useState("");
  const [retrieved, setRetrieved] = useState<{ memory: string }[]>([]);
  const [added, setAdded] = useState<{ memory: string }[]>([]);
  const streamIndexRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);
  const useSpeechFriendlyRef = useRef(false);

  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);

  const onMemoryPanelOpenChange = useCallback((opened: boolean) => {
    setMemoryPanelOpen(opened);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setRound(1);
    setPhase("idle");
    setStreamedText("");
    setRetrieved([]);
    setAdded([]);
    streamIndexRef.current = 0;
  }, [clearTimers]);

  const runDemo = useCallback(() => {
    clearTimers();
    streamIndexRef.current = 0;
    setRound(1);
    setStreamedText("");
    setAdded([]);
    setRetrieved(SAMPLE_RETRIEVED);
    setPhase("retrieved");

    const runRound1 = () => {
      setPhase("streaming");
      const chars = ASSISTANT_FULL.split("");
      const addedShown = { current: false };

      streamIntervalRef.current = setInterval(() => {
        streamIndexRef.current += 1;
        const next = chars.slice(0, streamIndexRef.current).join("");

        setStreamedText(next);
        if (
          !addedShown.current &&
          streamIndexRef.current * STREAM_CHAR_MS >= DELAY_BEFORE_ADDED_MS
        ) {
          addedShown.current = true;
          setAdded(SAMPLE_ADDED);
        }
        if (streamIndexRef.current >= chars.length) {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          setPhase("done");
        }
      }, STREAM_CHAR_MS);
    };

    const runRound2 = () => {
      setRound(2);
      setStreamedText("");
      setAdded([]);
      setRetrieved(SAMPLE_RETRIEVED_2);
      setPhase("retrieved");
      streamIndexRef.current = 0;

      const t2a = setTimeout(() => {
        setPhase("streaming");
        const chars = ASSISTANT_FULL_2.split("");

        streamIntervalRef.current = setInterval(() => {
          streamIndexRef.current += 1;
          const next = chars.slice(0, streamIndexRef.current).join("");

          setStreamedText(next);
          if (streamIndexRef.current >= chars.length) {
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            setPhase("done");
            setAdded(SAMPLE_ADDED_END);
          }
        }, STREAM_CHAR_MS);
      }, DELAY_BEFORE_STREAM_MS);

      timersRef.current.push(t2a);
    };

    const t1 = setTimeout(runRound1, DELAY_BEFORE_STREAM_MS);

    timersRef.current.push(t1);

    const round1Duration =
      DELAY_BEFORE_STREAM_MS + ASSISTANT_FULL.length * STREAM_CHAR_MS + DELAY_BEFORE_ROUND_2_MS;
    const tAfterRound1 = setTimeout(runRound2, round1Duration);

    timersRef.current.push(tAfterRound1);
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const messages: UIMessage[] = useMemo(() => {
    const user1 = createUserMessage(DEMO_USER_1_ID, USER_MSG);
    const asst1Text = round === 1 ? streamedText : ASSISTANT_FULL;
    const hasAsst1 = round === 1 ? phase !== "idle" && phase !== "retrieved" : true;
    const user2 = createUserMessage(DEMO_USER_2_ID, USER_MSG_2);
    const asst2 = createAssistantMessage(DEMO_ASSISTANT_2_ID, streamedText);

    const out: UIMessage[] = [user1];

    if (hasAsst1) out.push(createAssistantMessage(DEMO_ASSISTANT_1_ID, asst1Text));
    if (round >= 2) {
      out.push(user2);
      if (phase === "streaming" || phase === "done") out.push(asst2);
    }

    return out;
  }, [round, phase, streamedText]);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-border bg-background/80 overflow-hidden",
        "w-full max-w-232 h-[520px] min-h-0",
        className
      )}
    >
      <div className="w-full h-full max-h-[calc(100%-0px)] flex flex-col overflow-hidden">
        <Conversation
          className={[
            `flex-1 min-h-0 w-full relative flex flex-col items-center overflow-x-hidden overscroll-x-none ${memoryPanelOpen ? "pb-32" : "pb-4"} transition-padding duration-300`,
          ].join(" ")}
        >
          <ChatThread messages={messages} />
          <ConversationScrollButton className="bottom-14" />
        </Conversation>
        <div className="shrink-0 px-4 sm:px-7 pb-1 md:pb-4 w-full -mt-10 flex flex-col gap-2 relative z-20">
          <MemoryEphemeralCards
            added={phase === "streaming" || phase === "done" ? added : []}
            autoClearMs={0}
            className={cn(
              glass(),
              "absolute bottom-full left-1/2 -translate-x-1/2 w-[90%] h-32 overflow-y-auto z-10 rounded-t-2xl py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]",
              "bg-background-tertiary/20 dark:bg-background-tertiary/12",
              "transition-transform duration-300"
            )}
            retrieved={retrieved}
            onOpenChange={onMemoryPanelOpenChange}
          />
          <div className="relative z-20">
            <CoreInput
              disabled
              modelRef={modelRef}
              sendMessage={async () => {
                await Promise.resolve();
              }}
              status="ready"
              stop={async () => {
                await Promise.resolve();
              }}
              useMemoriesRef={useMemoriesRef}
              useSpeechFriendlyRef={useSpeechFriendlyRef}
              useWebSearchRef={useWebSearchRef}
            />
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-4 z-10 flex gap-2">
        {phase === "idle" && round === 1 ? (
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 transition-colors"
            type="button"
            onClick={runDemo}
          >
            Play demo
          </button>
        ) : round === 2 && phase === "done" ? (
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            type="button"
            onClick={reset}
          >
            Replay
          </button>
        ) : null}
      </div>
    </div>
  );
}
