"use client";

import type { UIMessage } from "ai";

import { motion, useReducedMotion } from "framer-motion";
import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { ChatMessageMarkdown } from "../chat-message-markdown";

import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { getChatErrorMessage } from "@/lib/chat/error-messages";
import { messagePlainText } from "@/lib/chat/btw-context";
import { cn } from "@/lib/utils";

/** Entrance settles; exit clears faster (design backbone principle 2). */
const BTW_PANEL_ENTER_S = 0.2;
const BTW_PANEL_EXIT_S = 0.14;

type BtwPanelProps = {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error?: Error;
  onClose: () => void;
};

/**
 * The `/btw` side thread, docked above CoreInput. While it is open CoreInput sends here,
 * with its own settings; closing drops the exchange and snaps CoreInput back.
 */
export function BtwPanel({ messages, status, error, onClose }: BtwPanelProps) {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const waiting = status === "submitted";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // An open menu (e.g. the model picker) takes this Escape for itself.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Follow the answer as it streams; the panel is short enough that this never fights reading.
  useEffect(() => {
    const el = scrollRef.current;

    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <motion.section
      animate={{ opacity: 1, y: 0, transition: { duration: BTW_PANEL_ENTER_S, ease: "easeOut" } }}
      aria-label="Side question"
      className={cn(glass({ opaque: true }), "w-full overflow-hidden rounded-xl")}
      data-btw-panel
      exit={{
        opacity: 0,
        y: reduceMotion ? 0 : 4,
        transition: { duration: BTW_PANEL_EXIT_S, ease: "easeIn" },
      }}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
    >
      <header className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground/80">
          /btw
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          Side question · sees a compact snapshot of this thread · not saved
        </p>
        <button
          aria-label="Close side question"
          className="-mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          title="Close (Esc)"
          type="button"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </button>
      </header>
      {/* Announce the state, not every streamed chunk. */}
      <span aria-live="polite" className="sr-only" role="status">
        {waiting || status === "streaming"
          ? "Answering side question"
          : status === "ready" && messages.some((m) => m.role === "assistant")
            ? "Side answer ready"
            : ""}
      </span>
      <div
        ref={scrollRef}
        className="max-h-[min(40dvh,22rem)] space-y-stack-md overflow-y-auto px-3 py-2.5 text-sm"
      >
        {messages.length === 0 && !waiting ? (
          <p className="text-muted-foreground">
            Ask anything on the side. The thread keeps its place; close this to return.
          </p>
        ) : null}
        {messages.map((message) => {
          const text = messagePlainText(message);

          if (!text) return null;

          return message.role === "user" ? (
            <p key={message.id} className="text-muted-foreground">
              {text}
            </p>
          ) : (
            <div key={message.id} className="prose prose-sm dark:prose-invert max-w-none">
              <ChatMessageMarkdown wrapCodeBlocks content={text} id={`btw-${message.id}`} />
            </div>
          );
        })}
        {waiting ? <ShinyText className="text-sm" text="Thinking" /> : null}
        {status === "error" && error ? (
          <p className="text-xs text-destructive" role="alert">
            {getChatErrorMessage(error)}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}
