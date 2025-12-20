"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Textarea } from "@heroui/input";
import { Button, PressEvent } from "@heroui/button";
import { ArrowUpIcon, Pause, RotateCcw } from "lucide-react";

import { ModelSelector } from "./model-selector";
import { KeypressEffect } from "./keypress-effect";
import {
  categorizeKey,
  KeyAnimationConfig,
} from "@/lib/utils/key-categorization";
import { ChatModelType } from "@/lib/schemas/chat";

export type UnifiedChatInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent | PressEvent) => void | Promise<void>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: "chat" | "rabbit-hole" | "custom";
  status?: "ready" | "submitted" | "streaming" | string;
  onStop?: () => void;
  selectedModel?: ChatModelType;
  onModelChange?: (model: ChatModelType) => void;
  hasSession?: boolean;
  onReset?: () => void;
  enableKeypressEffects?: boolean;
  isMobile?: boolean;
  className?: string;
  widthState?: string;
};

type KeypressState = (KeyAnimationConfig & { id: number }) | null;

export const UnifiedChatInput: React.FC<UnifiedChatInputProps> = ({
  value,
  onValueChange,
  onSubmit,
  onKeyDown,
  placeholder,
  error,
  isLoading,
  isDisabled,
  variant = "chat",
  status = "ready",
  onStop,
  selectedModel,
  onModelChange,
  hasSession,
  onReset,
  enableKeypressEffects = false,
  isMobile = false,
  className = "",
  widthState,
}) => {
  const [keypressEffect, setKeypressEffect] = useState<KeypressState>(null);

  const shouldShowEffects = enableKeypressEffects && isMobile;

  const handleKeyDownInternal = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (shouldShowEffects && e.key) {
        const config = categorizeKey(e.key);
        setKeypressEffect({ ...config, id: Date.now() });
      }
      onKeyDown?.(e);
    },
    [onKeyDown, shouldShowEffects],
  );

  useEffect(() => {
    if (!keypressEffect) return;
    const timeout = setTimeout(() => setKeypressEffect(null), keypressEffect.duration);
    return () => clearTimeout(timeout);
  }, [keypressEffect]);

  const containerWidth = useMemo(() => {
    if (isMobile) return "w-full px-4";
    if (widthState === "collapsed") return "md:w-[calc(100dvw-34rem)]";
    if (widthState === "expanded") return "md:w-[calc(100dvw-32rem)]";
    return "w-[calc(100dvw-6rem)]";
  }, [isMobile, widthState]);

  const showModelSelector = variant === "chat" && selectedModel && onModelChange;

  const baseWrapperClasses =
    "bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-lg transition-colors duration-150";

  const inputClassNames = {
    input: [
      "bg-transparent",
      "hover:bg-transparent",
      "text-base",
      "resize-none",
      "text-foreground",
      "placeholder:text-muted-foreground/60",
    ],
    innerWrapper: ["bg-transparent", "hover:bg-transparent"],
    inputWrapper: [
      "bg-transparent",
      "hover:bg-transparent",
      "group-data-[focus=true]:bg-transparent",
      "data-[hover=true]:bg-transparent",
      "border-border",
    ],
    mainWrapper: ["bg-transparent", "focus-within:bg-transparent"],
  };

  const sendDisabled = isDisabled || isLoading || value.trim().length === 0;

  const renderSendIcon = status === "ready" ? (
    <ArrowUpIcon size={18} />
  ) : (
    <Pause size={18} />
  );

  const handlePress = (e: React.FormEvent | PressEvent) => {
    if (status === "ready") {
      onSubmit(e);
    } else {
      onStop?.();
    }
  };

  return (
    <div
      className={`fixed bottom-0 shrink-0 min-h-10 ${containerWidth} max-w-3xl sm:max-w-4xl ${isMobile ? "mobile-safe-bottom" : ""} ${className}`}
    >
      <div className={`${baseWrapperClasses} w-full px-5 py-4`}>
        <form onSubmit={(e) => onSubmit(e)}>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <Textarea
                classNames={inputClassNames}
                isInvalid={error}
                maxRows={isMobile ? 8 : 10}
                minRows={isMobile ? 1 : 2}
                placeholder={placeholder}
                value={value}
                onKeyDown={handleKeyDownInternal}
                onValueChange={onValueChange}
              />
              <div className="flex flex-col gap-2">
                {hasSession && onReset ? (
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={onReset}
                    isDisabled={isLoading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw size={18} />
                  </Button>
                ) : null}
                <Button
                  isIconOnly
                  isDisabled={sendDisabled && status === "ready"}
                  className={`aspect-square ${status === "ready" ? "bg-foreground text-background hover:opacity-85" : "bg-background text-foreground border border-border"} `}
                  onPress={handlePress}
                  type="submit"
                >
                  {renderSendIcon}
                </Button>
              </div>
            </div>
            {!isMobile ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {showModelSelector ? (
                    <ModelSelector
                      selectedModel={selectedModel}
                      handleModelSelection={onModelChange}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </form>
      </div>
      {shouldShowEffects ? <KeypressEffect effect={keypressEffect} /> : null}
    </div>
  );
};

