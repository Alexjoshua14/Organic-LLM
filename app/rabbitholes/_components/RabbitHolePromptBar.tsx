"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { ArrowUpIcon, RotateCcw } from "lucide-react";
import { glass } from "@/components/design-system/primitives";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/third-party/ui/tooltip";

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
      <div className="bg-card/90 backdrop-blur-md border border-border w-full px-6 py-4 rounded-lg shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <Textarea
              classNames={{
                input: [
                  "bg-transparent",
                  "hover:bg-transparent",
                  "text-base",
                  "resize-none",
                  "text-foreground",
                  "placeholder:text-muted-foreground/50",
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={onReset}
                    isDisabled={isLoading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start new rabbit hole</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  isIconOnly
                  type="submit"
                  isDisabled={isLoading || !input.trim()}
                  className="bg-foreground text-background hover:opacity-80 disabled:opacity-50 aspect-square"
                >
                  <ArrowUpIcon size={20} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{hasSession ? "Explore deeper" : "Start exploration"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </form>
      </div>
    </div>
  );
}

