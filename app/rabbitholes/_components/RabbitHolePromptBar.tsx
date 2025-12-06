"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { ArrowUpIcon, RotateCcw } from "lucide-react";
import { glass } from "@/components/design-system/primitives";

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
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (input.trim().length === 0) {
        setError(true);
        return;
      }
      setError(false);
      onStart(input.trim());
      setInput("");
    },
    [input, onStart],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="sticky bottom-0 w-full mt-8 z-10">
      <div className="bg-white/90 dark:bg-[#1C1E1F]/90 backdrop-blur-md border border-[#DCDDDC] dark:border-[#2A2C2D] w-full px-6 py-4 rounded-lg shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <Textarea
              classNames={{
                input: [
                  "bg-transparent",
                  "hover:bg-transparent",
                  "font-satoshi text-base",
                  "resize-none",
                  "text-[#2D2B26] dark:text-[#F3F4F3]",
                  "placeholder:text-[#5C5E5E]/50 dark:placeholder:text-[#A0A2A2]/50",
                ],
                innerWrapper: ["bg-transparent", "hover:bg-transparent"],
                inputWrapper: [
                  "bg-transparent",
                  "hover:bg-transparent",
                  "group-data-[focus=true]:bg-transparent",
                  "data-[hover=true]:bg-transparent",
                  "border-[#DCDDDC] dark:border-[#2A2C2D]",
                ],
                mainWrapper: ["bg-transparent", "focus-within:bg-transparent"],
              }}
              isInvalid={error}
              maxRows={4}
              minRows={1}
              placeholder={
                hasSession
                  ? "Dive deeper into this topic..."
                  : "What would you like to explore?"
              }
              value={input}
              onKeyDown={handleKeyDown}
              onValueChange={(v) => {
                setInput(v);
                if (error && v.trim().length > 0) {
                  setError(false);
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            {hasSession && (
              <Button
                isIconOnly
                variant="ghost"
                onPress={onReset}
                isDisabled={isLoading}
                className="text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]"
              >
                <RotateCcw size={18} />
              </Button>
            )}
            <Button
              isIconOnly
              type="submit"
              isDisabled={isLoading || !input.trim()}
              className="bg-[#2D2B26] dark:bg-[#F3F4F3] text-[#F3F4F3] dark:text-[#2D2B26] hover:opacity-80 disabled:opacity-50 aspect-square"
            >
              <ArrowUpIcon size={20} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

