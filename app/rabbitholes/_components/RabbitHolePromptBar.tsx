"use client";

import { useState, useCallback, KeyboardEvent, useRef } from "react";
import { PressEvent } from "@heroui/button";

import { UnifiedChatInput } from "@/components/chat/unified-chat-input";

interface RabbitHolePromptBarProps {
  onStart: (question: string) => void;
  onReset: () => void;
  hasSession: boolean;
  isLoading: boolean;
}

export function RabbitHolePromptBar({
  onStart,
  onReset,
  hasSession,
  isLoading,
}: RabbitHolePromptBarProps) {
  const input = useRef("")
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
    (e?: React.FormEvent | PressEvent) => {
      if (e && "preventDefault" in e) {
        e.preventDefault();
      }
      if (input.current.trim().length === 0) {
        setError(true);
        return;
      }
      setError(false);
      onStart(input.current.trim());
      input.current = "";
    },
    [input, onStart],
  );

  return (
    <UnifiedChatInput
      value={input.current}
      onValueChange={(v) => {
        input.current = v
        if (error && v.trim().length > 0) {
          setError(false);
        }
      }}
      onSubmit={handleSubmit}
      placeholder={
        hasSession
          ? "Dive deeper into this topic..."
          : "What would you like to explore?"
      }
      error={error}
      isLoading={isLoading}
      variant="rabbit-hole"
      hasSession={hasSession}
      onReset={onReset}
      isMobile
    />
  );
}

