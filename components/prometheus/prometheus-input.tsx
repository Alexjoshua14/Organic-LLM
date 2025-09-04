"use client";

import { Textarea } from "@heroui/input";
import { Button, PressEvent } from "@heroui/button";
import { ArrowUpIcon } from "lucide-react";
import { useCallback, useState, KeyboardEvent } from "react";

type PrometheusInputProps = {
  onSendMessage: ({ text }: { text: string }) => Promise<void>;
};

export const PrometheusInput: React.FC<PrometheusInputProps> = ({
  onSendMessage,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(
    async (_e: React.FormEvent | PressEvent): Promise<void> => {
      if (input.trim().length === 0) {
        setError(true);

        return;
      } else {
        setError(false);
      }

      setIsLoading(true);
      try {
        await onSendMessage({ text: input });
        setInput("");
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [input, onSendMessage],
  );

  const handleInputChange = useCallback(
    (v: string) => {
      if (error && v.trim().length > 0) {
        setError(false);
      }
      setInput(v);
    },
    [error],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e as any);
      }
    },
    [handleSendMessage],
  );

  return (
    <div className="w-full px-8 pb-6">
      <div className="max-w-5xl mx-auto">
        <div
          className="rounded-2xl backdrop-blur-xl border overflow-hidden shadow-2xl"
          style={{
            background: "rgba(156, 175, 136, 0.1)",
            borderColor: "rgba(156, 175, 136, 0.2)",
            boxShadow: `
              0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `,
          }}
        >
          <form onSubmit={(e) => handleSendMessage(e)}>
            <div className="p-6">
              <Textarea
                classNames={{
                  input: [
                    "bg-transparent",
                    "hover:bg-transparent",
                    "text-lg",
                    "placeholder:text-foreground/40",
                    "font-light",
                  ],
                  innerWrapper: ["bg-transparent", "hover:bg-transparent"],
                  inputWrapper: [
                    "bg-transparent",
                    "hover:bg-transparent",
                    "group-data-[focus=true]:bg-transparent",
                    "data-[hover=true]:bg-transparent",
                    "border-none",
                    "shadow-none",
                  ],
                  mainWrapper: [
                    "bg-transparent",
                    "focus-within:bg-transparent",
                  ],
                }}
                disabled={isLoading}
                isInvalid={error}
                maxRows={6}
                minRows={1}
                placeholder="Enter your query for Prometheus..."
                value={input}
                onKeyDown={handleKeyDown}
                onValueChange={handleInputChange}
              />
            </div>

            <div className="flex justify-between items-center px-6 pb-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-light">Ready to process</span>
              </div>

              <Button
                isIconOnly
                className="bg-gradient-to-r from-[#9CAF88] to-[#C4A484] text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                disabled={isLoading || input.trim().length === 0}
                onPress={(e) => handleSendMessage(e)}
              >
                <ArrowUpIcon size={20} />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
