import { PressEvent } from "@heroui/button";
import { useCallback, useState, KeyboardEvent, useRef } from "react";
import { useChat } from "@ai-sdk/react";

import { useSidebar } from "../third-party/ui/sidebar";

import { UnifiedChatInput } from "./unified-chat-input";
import { ChatModel } from "@/lib/schemas/chat";

type ChatInputProps = {
  id: string;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  selectedModelRef: React.MutableRefObject<ChatModel>;
  stop: ReturnType<typeof useChat>["stop"];
  status: ReturnType<typeof useChat>["status"];
};

/**
 * @deprecated Use NewChatInput instead. This component is a thin wrapper around UnifiedChatInput
 * and lacks attachments, speech input, web search/memory toggles, and persisted preferences (localStorage).
 * NewChatInput uses the ai-elements PromptInput and is the supported chat input going forward.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  id: _id,
  sendMessage,
  stop,
  status,
  selectedModelRef,
}) => {
  const { isMobile, state } = useSidebar();
  const [input, setInput] = useState("");
  const [error, setError] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ChatModel>(
    selectedModelRef.current
  );
  // Store the last sent message text to restore on abort
  const lastSentMessageRef = useRef<string>("");

  const handleSendMessage = useCallback(
    async (_e?: React.FormEvent | PressEvent): Promise<void> => {
      if (input.trim().length === 0) {
        setError(true);

        return;
      } else {
        setError(false);
      }
      // Store the message before clearing
      lastSentMessageRef.current = input;
      // Update the ref so prepareSendMessagesRequest can access it
      selectedModelRef.current = selectedModel;
      sendMessage({ text: input });
      setInput("");
    },
    [input, sendMessage, selectedModel, selectedModelRef],
  );

  const handleStop = useCallback(async () => {
    stop();
    // Restore the last sent message to the input field
    if (lastSentMessageRef.current) {
      setInput(lastSentMessageRef.current);
      lastSentMessageRef.current = ""; // Clear the ref after restoring
    }

    // And clean up UI since we are not persistencing aborted messages

  }, [stop]);

  const handleModelSelection = useCallback(
    (m: ChatModel) => {
      setSelectedModel(m);
      selectedModelRef.current = m;
    },
    [selectedModelRef]
  );

  const handleInputChange = useCallback((v: string) => {
    if (error && v.trim().length > 0) {
      setError(false);
    }
    setInput(v);
  }, []);

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
    <UnifiedChatInput
      value={input}
      onValueChange={handleInputChange}
      onSubmit={handleSendMessage}
      onKeyDown={handleKeyDown}
      placeholder={isMobile ? "Type your message here..." : "What would you like to say..."}
      error={error}
      variant="chat"
      status={status}
      onStop={handleStop}
      selectedModel={selectedModel}
      onModelChange={handleModelSelection}
      isMobile={isMobile}
      widthState={state}
    />
  );
};
