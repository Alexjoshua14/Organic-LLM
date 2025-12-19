import { Textarea } from "@heroui/input";
import { Button, PressEvent } from "@heroui/button";
import { ArrowUpIcon, Globe, PaperclipIcon, Pause } from "lucide-react";
import { useCallback, useState, KeyboardEvent, useRef } from "react";
import { useChat } from "@ai-sdk/react";

import { glass } from "../design-system/primitives";
import { useSidebar } from "../third-party/ui/sidebar";

import { ModelSelector } from "./model-selector";
import { ChatModelType, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";

type ChatInputProps = {
  id: string;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  selectedModelRef: React.MutableRefObject<ChatModelType>;
  stop: ReturnType<typeof useChat>["stop"];
  status: ReturnType<typeof useChat>["status"];
};

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
  const [selectedModel, setSelectedModel] = useState<ChatModelType>(
    selectedModelRef.current
  );
  // Store the last sent message text to restore on abort
  const lastSentMessageRef = useRef<string>("");

  const handleSendMessage = useCallback(
    async (_e: React.FormEvent | PressEvent): Promise<void> => {
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
  }, [stop]);

  const handleModelSelection = useCallback(
    (m: ChatModelType) => {
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
    <>
      {isMobile ? (
        <ChatInputMobile
          error={error}
          handleInputChange={handleInputChange}
          handleKeyDown={handleKeyDown}
          handleSendMessage={handleSendMessage}
          input={input}
          state={state}
          selectedModel={selectedModel}
          handleModelSelection={handleModelSelection}
          stop={handleStop}
          status={status}
        />
      ) : (
        <ChatInputDesktop
          error={error}
          handleInputChange={handleInputChange}
          handleKeyDown={handleKeyDown}
          handleSendMessage={handleSendMessage}
          input={input}
          state={state}
          selectedModel={selectedModel}
          handleModelSelection={handleModelSelection}
          stop={handleStop}
          status={status}
        />
      )}
    </>
  );
};

type ChatInputFieldProps = {
  handleSendMessage: (e: React.FormEvent | PressEvent) => Promise<void>;
  error: boolean;
  input: string;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleInputChange: (v: string) => void;
  state: string;
  selectedModel: ChatModelType;
  handleModelSelection: (m: ChatModelType) => void;
  stop: ReturnType<typeof useChat>["stop"];
  status: ReturnType<typeof useChat>["status"];
};

const ChatInputDesktop = ({
  handleSendMessage,
  error,
  input,
  handleKeyDown,
  handleInputChange,
  state,
  selectedModel,
  handleModelSelection,
  stop,
  status
}: ChatInputFieldProps) => {
  return (
    <div
      className={`fixed bottom-0 flex-shrink-0 min-h-10 w-[calc(100dvw-6rem)] max-w-lg sm:max-w-xl md:max-w-3xl ${state === "collapsed" ? "md:w-[calc(100dvw-34rem)]" : "md:w-[calc(100dvw-32rem)]"} transition-size duration-150 ease-linear`}
    >
      <div
        className={`${glass()} border-t-1 border-x-1.5 border-white/25 h-full px-2 pt-2`}
      >
        <form onSubmit={(e) => handleSendMessage(e)}>
          <Textarea
            classNames={{
              input: ["bg-transparent", "hover:bg-transparent", "text-base"],
              innerWrapper: ["bg-transparent", "hover:bg-transparent"],
              inputWrapper: [
                "bg-transparent",
                "hover:bg-transparent",
                "group-data-[focus=true]:bg-transparent",
                "data-[hover=true]:bg-transparent",
              ],
              mainWrapper: ["bg-transparent", "focus-within:bg-transparent"],
            }}
            isInvalid={error}
            maxRows={8}
            placeholder="What would you like to say..."
            value={input}
            onKeyDown={handleKeyDown}
            onValueChange={handleInputChange}
          />
          <div className="hidden sm:flex h-12 items-center justify-between py-2">
            <div className="flex items-center gap-1 ">
              <ModelSelector selectedModel={selectedModel} handleModelSelection={handleModelSelection} />
              <Button
                isIconOnly
                className="lg:hidden text-xs bg-transparent text-foreground"
              >
                <Globe size={16} />
              </Button>
              <Button className="hidden lg:flex text-xs bg-transparent text-foreground">
                <Globe size={16} />
                <p>Search</p>
              </Button>
              <Button className="min-w-4 bg-transparent">
                <PaperclipIcon size={14} />
              </Button>
            </div>
            <div>
              <Button
                isIconOnly
                className={`${glass()} border-t-1 border-x-1.5 border-b-1.5 border-white/25  aspect-square`}
                onPress={(e) => {
                  if (status === "submitted" || status === "streaming") {
                    stop();
                  } else {
                    handleSendMessage(e);
                  }
                }}
              >
                {status === 'submitted' || status == 'streaming' ?
                  <Pause size={20} />
                  : <ArrowUpIcon size={20} />}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChatInputMobile = ({
  handleSendMessage,
  error,
  input,
  handleKeyDown,
  handleInputChange,
  selectedModel,
  handleModelSelection,
  stop,
  status,
}: ChatInputFieldProps) => {
  return (
    <div
      className={`fixed bottom-0 flex-shrink-0 min-h-10 w-full max-w-lg sm:max-w-xl px-4`}
    >
      <div
        className={`${glass()} border-t-1 border-x-1.5 border-white/25 h-full w-full px-2 py-4`}
      >
        <form onSubmit={(e) => handleSendMessage(e)}>
          <div className="flex gap-2">
            <Textarea
              classNames={{
                input: ["bg-transparent", "hover:bg-transparent", "text-base"],
                innerWrapper: ["bg-transparent", "hover:bg-transparent"],
                inputWrapper: [
                  "bg-transparent",
                  "hover:bg-transparent",
                  "group-data-[focus=true]:bg-transparent",
                  "data-[hover=true]:bg-transparent",
                ],
                mainWrapper: ["bg-transparent", "focus-within:bg-transparent"],
              }}
              isInvalid={error}
              maxRows={8}
              minRows={1}
              placeholder="Type your message here..."
              value={input}
              onKeyDown={handleKeyDown}
              onValueChange={handleInputChange}
            />
            <div>
              <Button
                isIconOnly
                className={`${glass()}`}
                onPress={(e) => {
                  if (status === "submitted" || status === "streaming") {
                    stop();
                  } else {
                    handleSendMessage(e);
                  }
                }}
              >
                {status === 'submitted' || status == 'streaming' ?
                  <Pause size={20} />
                  : <ArrowUpIcon size={20} />}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
