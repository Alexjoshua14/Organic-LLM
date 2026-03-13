"use client";

import { useCallback, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatStatus } from "ai";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";
import { Button } from "@heroui/button";
import type { SandboxInputMode } from "@/lib/sandbox/scenarios/registry";

export type AdaptiveSandboxInputProps = {
  inputMode: SandboxInputMode;
  onSubmit: (input: unknown) => Promise<void>;
  disabled?: boolean;
  status?: ChatStatus;
  placeholder?: string;
  buttonLabel?: string;
  /** For hybrid mode: article list and selection for branch scenario */
  hybridOptions?: {
    articles: { id: string; title: string; content: string }[];
    selectedIndex: number;
    onSelectedIndexChange: (index: number) => void;
    rootQuestion?: string;
    pathHistory?: string;
  };
};

export function AdaptiveSandboxInput({
  inputMode,
  onSubmit,
  disabled = false,
  status = "ready",
  placeholder,
  buttonLabel = "Generate",
  hybridOptions,
}: AdaptiveSandboxInputProps) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const effectiveDisabled = disabled || isSubmitting;
  const effectiveStatus: ChatStatus = status === "streaming" || isSubmitting ? "streaming" : status;

  const sendMessage = useCallback(
    async (message?: unknown, _options?: unknown) => {
      const text =
        message && typeof message === "object" && "text" in message && typeof (message as { text?: string }).text === "string"
          ? (message as { text: string }).text.trim()
          : message && typeof message === "object" && "parts" in message && Array.isArray((message as { parts: { type: string; text?: string }[] }).parts)
          ? (message as { parts: { type: string; text?: string }[] }).parts
              .map((p) => (p.type === "text" && p.text ? p.text : ""))
              .filter(Boolean)
              .join(" ")
              .trim()
          : "";
      if (!text) return undefined;
      setSubmitting(true);
      try {
        await onSubmit({ text });
      } finally {
        setSubmitting(false);
      }
      return undefined as Awaited<ReturnType<ReturnType<typeof useChat>["sendMessage"]>>;
    },
    [onSubmit]
  );

  const stop = useCallback(async () => {}, []);

  const handleButtonRun = useCallback(async () => {
    if (inputMode === "button" || inputMode === "hybrid") {
      setSubmitting(true);
      try {
        if (inputMode === "hybrid" && hybridOptions) {
          const article = hybridOptions.articles[hybridOptions.selectedIndex];
          await onSubmit({
            context: article?.content ?? "",
            rootQuestion: hybridOptions.rootQuestion,
            pathHistory: hybridOptions.pathHistory,
          });
        } else {
          await onSubmit({});
        }
      } finally {
        setSubmitting(false);
      }
    }
  }, [inputMode, hybridOptions, onSubmit]);

  if (inputMode === "chat") {
    return (
      <PromptInputProvider>
        <NewChatInput
          modelRef={modelRef}
          useWebSearchRef={useWebSearchRef}
          useMemoriesRef={useMemoriesRef}
          sendMessage={sendMessage as ReturnType<typeof useChat>["sendMessage"]}
          stop={stop}
          status={effectiveStatus}
          disabled={effectiveDisabled}
        />
      </PromptInputProvider>
    );
  }

  if (inputMode === "hybrid" && hybridOptions) {
    const { articles, selectedIndex, onSelectedIndexChange } = hybridOptions;
    return (
      <div className="flex flex-col gap-3 w-full max-w-xl">
        <label className="text-sm font-medium text-foreground">
          Article context
        </label>
        <select
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          value={selectedIndex}
          onChange={(e) => onSelectedIndexChange(Number(e.target.value))}
          disabled={effectiveDisabled}
        >
          {articles.map((a, i) => (
            <option key={a.id} value={i}>
              {a.title}
            </option>
          ))}
        </select>
        <Button
          onPress={handleButtonRun}
          isDisabled={effectiveDisabled}
          isLoading={isSubmitting}
          className="w-fit"
        >
          {buttonLabel}
        </Button>
      </div>
    );
  }

  if (inputMode === "button") {
    return (
      <Button
        onPress={handleButtonRun}
        isDisabled={effectiveDisabled}
        isLoading={isSubmitting}
      >
        {buttonLabel}
      </Button>
    );
  }

  return null;
}
