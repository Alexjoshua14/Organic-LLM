"use client";

import type { HomepageRoutePreview } from "@/lib/homepage/ollama-schemas";

import React, { FormEvent, useEffect, useState } from "react";
import { ChatStatus } from "ai";
import { AnimatePresence, motion } from "framer-motion";

import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputProvider,
  usePromptInputController,
} from "../third-party/ai-elements/prompt-input";
import { PromptInputSubmit } from "../chat/core-input";
import { HomeComposerLumenShell } from "../chat/home-composer-lumen-shell";
import ShinyText from "../ShinyText";

import { cn } from "@/lib/utils";

export interface AiInputFormProps
  extends Omit<React.HTMLAttributes<HTMLFormElement>, "onSubmit" | "onError"> {
  onSubmit: (prompt: string) => void | Promise<void>;
  isLoading?: boolean;
  status?: ChatStatus;
  className?: string;
  /** When false (e.g. plan mode), keep textarea text after submit. Default true. */
  clearAfterSubmit?: boolean;
  /** Larger composer / typography */
  fullView?: boolean;
  /** Fires on every textarea change */
  onTextChange?: (text: string) => void;
  /** Cmd/Ctrl+Enter from textarea */
  onStrataShortcut?: (text: string) => void | Promise<void>;
  /** Shift+Tab while textarea focused */
  onPlanModeToggle?: () => void;
  /** Wrap form for double-tap-to-expand */
  onComposerDoubleTap?: () => void;
  /** Optional route preview chips (full view) */
  previewIntent?: HomepageRoutePreview | null;
  /** Submit button status (defaults to `status`). */
  submitStatus?: ChatStatus;
  /** Keep textarea visible during loading (e.g. plan-mode fetch). */
  forceReadyInput?: boolean;
}

/** Max length to display in the "preserved" state to avoid layout/performance issues; full text is still sent. */
const DISPLAY_MAX_LENGTH = 2000;

const FORM_CROSS_FADE = { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const };

const AiInputFormContent: React.FC<AiInputFormProps> = ({
  onSubmit,
  isLoading = false,
  className,
  status,
  fullView = false,
  onTextChange,
  onStrataShortcut,
  onPlanModeToggle,
  onComposerDoubleTap,
  previewIntent,
  clearAfterSubmit = true,
  submitStatus,
  forceReadyInput = false,
  ...props
}) => {
  const { textInput } = usePromptInputController();
  const [userQuery, setUserQuery] = useState<string>("");
  const lastTapRef = React.useRef<number>(0);

  useEffect(() => {
    if (status === "ready") {
      setUserQuery("");
    }
  }, [status]);

  const handleSubmit = async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasText = Boolean(message.text.trim());

    if (!hasText || isLoading) {
      return;
    }
    setUserQuery(message.text);

    await onSubmit(message.text);
    if (clearAfterSubmit) {
      textInput.clear();
    }
  };

  const displayText =
    userQuery.length > DISPLAY_MAX_LENGTH
      ? `${userQuery.slice(0, DISPLAY_MAX_LENGTH)}\u2026`
      : userQuery || " ";

  const handleComposerPointerDown = () => {
    if (!onComposerDoubleTap) return;
    const now = Date.now();

    if (now - lastTapRef.current < 320) {
      onComposerDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const textAreaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      onPlanModeToggle?.();

      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const v = textInput.value?.trim();

      if (v && onStrataShortcut) {
        void onStrataShortcut(textInput.value);
      }
    }
  };

  const compactComposer = !fullView;
  const minRows = fullView ? 12 : 1;
  const maxRows = fullView ? 40 : 4;
  const showFullViewCharCount = fullView && (status === "ready" || (forceReadyInput && isLoading));

  const submitDisabled = !textInput.value.trim() || isLoading;
  const submitStatusResolved = submitStatus ?? status ?? "ready";

  return (
    <div className={cn("w-full", fullView && "flex min-h-0 flex-1 flex-col")}>
      <HomeComposerLumenShell className={fullView ? "flex min-h-0 flex-1 flex-col" : undefined}>
        <PromptInput
          multiple
          className={cn(className, fullView && "flex flex-col flex-1 min-h-0")}
          onSubmit={handleSubmit}
          {...props}
        >
        <PromptInputBody onPointerDown={handleComposerPointerDown}>
          <div
            className={cn(
              "relative w-full",
              !compactComposer &&
                "transition-[min-height,max-height,font-size] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            )}
          >
            {status === "ready" || (forceReadyInput && isLoading) ? (
              <PromptInputTextarea
                // eslint-disable-next-line jsx-a11y/no-autofocus -- homepage composer entry
                autoFocus
                className={cn(
                  "text-lg! md:text-lg! placeholder:text-lg! caret-accent w-full placeholder:text-foreground/80",
                  "!pb-[2.875rem] !pr-[2.75rem]",
                  fullView &&
                    "min-h-[70vh]! max-h-[min(70vh,11in)]! text-xl! md:text-xl! placeholder:text-xl! flex-1"
                )}
                disabled={isLoading}
                maxRows={maxRows}
                minRows={minRows}
                placeholder="What do you want to explore?"
                onChange={(ev) => onTextChange?.(ev.currentTarget.value)}
                onKeyDown={textAreaKeyDown}
              />
            ) : status === "submitted" || status === "streaming" ? (
              <div className="w-full">
                <ShinyText
                  className={cn("w-full h-24 p-4 min-h-24 overflow-auto", "!pb-11 !pr-11")}
                  text={displayText}
                />
              </div>
            ) : (
              <h2 className="text-warning">An error has occured..</h2>
            )}
            <div className="absolute bottom-2 right-2 z-10 flex items-end justify-end">
              <PromptInputSubmit disabled={submitDisabled} status={submitStatusResolved} />
            </div>
          </div>
          <AnimatePresence initial={false} mode="sync">
            {fullView && previewIntent ? (
              <motion.div
                key="preview-intent"
                animate={{ opacity: 1 }}
                className="flex flex-wrap gap-2 px-3 pb-2 text-xs text-muted-foreground"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={FORM_CROSS_FADE}
              >
                <span className="rounded-md border border-border/60 bg-background/40 px-2 py-0.5">
                  {previewIntent.label}
                </span>
                <span className="rounded-md border border-border/40 px-2 py-0.5 opacity-80">
                  {previewIntent.intent.replace(/_/g, " ")} ·{" "}
                  {Math.round(previewIntent.confidence * 100)}%
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </PromptInputBody>
        {showFullViewCharCount ? (
          <PromptInputFooter className="min-w-0 flex w-full flex-row items-end justify-start gap-3">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key="word-count"
                animate={{ opacity: 1 }}
                className="shrink-0 pl-3 text-[11px] text-muted-foreground/80 tabular-nums"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={FORM_CROSS_FADE}
              >
                {textInput.value.length} characters
              </motion.div>
            </AnimatePresence>
          </PromptInputFooter>
        ) : null}
      </PromptInput>
      </HomeComposerLumenShell>
    </div>
  );
};

export const AiInputForm: React.FC<AiInputFormProps> = (props) => {
  return (
    <PromptInputProvider>
      <AiInputFormContent {...props} />
    </PromptInputProvider>
  );
};

AiInputForm.displayName = "AiInputForm";
