"use client";

import type { SandboxInputMode } from "@/lib/sandbox/scenarios/registry";

import { useCallback, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatStatus } from "ai";
import { Button } from "@heroui/button";

import { CoreInput } from "@/components/chat/core-input";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";

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
        message &&
        typeof message === "object" &&
        "text" in message &&
        typeof (message as { text?: string }).text === "string"
          ? (message as { text: string }).text.trim()
          : message &&
              typeof message === "object" &&
              "parts" in message &&
              Array.isArray((message as { parts: { type: string; text?: string }[] }).parts)
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
        <CoreInput
          disabled={effectiveDisabled}
          modelRef={modelRef}
          sendMessage={sendMessage as ReturnType<typeof useChat>["sendMessage"]}
          status={effectiveStatus}
          stop={stop}
          useMemoriesRef={useMemoriesRef}
          useWebSearchRef={useWebSearchRef}
        />
      </PromptInputProvider>
    );
  }

  if (inputMode === "hybrid" && hybridOptions) {
    const { articles, selectedIndex, onSelectedIndexChange } = hybridOptions;

    return (
      <div className="flex flex-col gap-3 w-full max-w-xl">
        <label className="text-sm font-medium text-foreground">Article context</label>
        <select
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          disabled={effectiveDisabled}
          value={selectedIndex}
          onChange={(e) => onSelectedIndexChange(Number(e.target.value))}
        >
          {articles.map((a, i) => (
            <option key={a.id} value={i}>
              {a.title}
            </option>
          ))}
        </select>
        <Button
          className="w-fit"
          isDisabled={effectiveDisabled}
          isLoading={isSubmitting}
          onPress={handleButtonRun}
        >
          {buttonLabel}
        </Button>
      </div>
    );
  }

  if (inputMode === "button") {
    return (
      <Button isDisabled={effectiveDisabled} isLoading={isSubmitting} onPress={handleButtonRun}>
        {buttonLabel}
      </Button>
    );
  }

  return null;
}
