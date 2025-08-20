"use client";

import { Input, Textarea } from "@heroui/input";
import { glass } from "../primitives";
import { Button, PressEvent } from "@heroui/button";
import {
  ArrowUpIcon,
  ChevronDown,
  File,
  Globe,
  PaperclipIcon,
  SendIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { CreateUIMessage, UIMessage, useChat } from "@ai-sdk/react";

type ChatInputProps = {
  id: string;
  sendMessage: ({ text }: { text: string }) => Promise<void>;
};

export const ChatInput: React.FC<ChatInputProps> = ({ id, sendMessage }) => {
  const [input, setInput] = useState("");
  //const { sendMessage, stop } = useChat({ id });

  const handleSendMessage = useCallback(
    async (e: React.FormEvent | PressEvent): Promise<void> => {
      // if (e instanceof React.FormEvent) {
      //   e.preventDefault();
      // }
      sendMessage({ text: input });
      setInput("a");
    },
    [input, sendMessage],
  );

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 min-h-32 w-full min-w-2xl max-w-3xl">
      <div className={`${glass()} px-2 pt-2`}>
        <div className={`${glass()} px-4 pt-2 `}>
          <div>
            <form onSubmit={(e) => handleSendMessage(e)}>
              <Textarea
                classNames={{
                  input: ["bg-transparent", "hover:bg-transparent"],
                  innerWrapper: ["bg-transparent", "hover:bg-transparent"],
                  inputWrapper: [
                    "bg-transparent",
                    "hover:bg-transparent",
                    "group-data-[focus=true]:bg-transparent",
                    "data-[hover=true]:bg-transparent",
                  ],
                  mainWrapper: [
                    "bg-transparent",
                    "focus-within:bg-transparent",
                  ],
                }}
                maxRows={8}
                placeholder="Type your message here..."
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
              />
              <div className="h-12 flex items-center justify-between py-2">
                <div className="flex items-center gap-3 ">
                  <div className="w-20 flex justify-between items-center">
                    <p>GPT 5</p>
                    <ChevronDown size={20} />
                  </div>
                  <div>
                    <Button className="text-xs bg-transparent text-foreground">
                      <Globe size={16} />
                      <p>Search</p>
                    </Button>
                  </div>
                  <div>
                    <Button className="min-w-4 bg-transparent">
                      <PaperclipIcon size={14} />
                    </Button>
                  </div>
                </div>
                <div>
                  <Button onPress={(e) => handleSendMessage(e)} isIconOnly>
                    <ArrowUpIcon size={20} />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
