"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";
import type { StrataPageAssistantSession } from "@/lib/strata/assistant-session";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { toast } from "sonner";

import { Conversation, ConversationScrollButton } from "../third-party/ai-elements/conversation";

import { ChatThread, MEMORY_PANEL_RESERVE_PADDING } from "./chat-thread";
import { CoreInput } from "./core-input";

import { MemoryEphemeralCards } from "@/components/memory/memory-ephemeral-cards";
import { MemoryLens } from "@/components/memory/memory-lens";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/third-party/ui/sheet";
import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { getSettings } from "@/lib/user-settings";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getStrataAssistantPersona } from "@/lib/personas/strata-assistant";
import { ChatAIActionEnum } from "@/types/ai";
import { getChatErrorMessage } from "@/lib/chat/error-messages";
const logger = createLogger("components/chat/chat");

export type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  /** Prefills the composer without sending (e.g. homepage semantic route). */
  initialDraft?: string;
  persona?: "prometheus" | "spark" | "aion" | "remy" | "strata";
  endpoint?: string;
  experience?: string;
  /** When using the Strata page assistant, the server loads this page for grounding. */
  strataPageId?: string;
  /** Strata page: tool + persona controls from Source tab session. */
  assistantSession?: StrataPageAssistantSession | null;
};

export const Chat: React.FC<ChatProps> = ({
  chatData,
  endpoint,
  persona,
  initialMessage,
  initialDraft,
  experience,
  strataPageId,
  assistantSession,
}) => {
  const { refreshSidebarChats } = useSharedChatContext();

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const useSpeechFriendlyRef = useRef<boolean>(false);
  const assistantSessionRef = useRef<StrataPageAssistantSession | null | undefined>(
    assistantSession
  );

  assistantSessionRef.current = assistantSession;
  const usePersistedSchemas = useRef<boolean>(persona === "aion" || persona === "strata");
  const initialMessageSent = useRef<boolean>(false);
  const [aiAction, setAiAction] = useState<
    | {
        action: ChatAIActionEnum;
        message?: string;
        sources?: ExaSearchResultSource[];
      }
    | undefined
  >(undefined);
  const [mem0Retrieved, setMem0Retrieved] = useState<{ memory: string }[]>([]);
  const [mem0Added, setMem0Added] = useState<{ memory: string }[]>([]);
  const errorRef = useRef<Error | undefined>(undefined);
  /** Stored when onError runs; useChat may not expose error/status for pre-stream failures (e.g. 429). */
  const [chatError, setChatError] = useState<unknown>(undefined);
  const [experimentalArcadiaMarkdownPreview, setExperimentalArcadiaMarkdownPreview] = useState(
    () => getSettings().experimentalArcadiaMarkdownPreview
  );

  useEffect(() => {
    const sync = () =>
      setExperimentalArcadiaMarkdownPreview(getSettings().experimentalArcadiaMarkdownPreview);

    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  useEffect(() => {
    if (experience !== "strata_page" || !assistantSession) return;
    selectedModelRef.current = getStrataAssistantPersona(
      assistantSession.personaId
    ).getDefaultModel();
  }, [assistantSession, experience]);

  // Temporary
  const stop = () => logger.log("chat", "stop called but functionality is currently disabled");

  const { messages, sendMessage, id, status, setMessages, addToolOutput, error, clearError } =
    useChat({
      id: chatData?.thread.id ?? "",
      messages: chatData?.messages ?? [],
      resume: true,
      transport: new DefaultChatTransport({
        api:
          persona === "aion"
            ? "/api/ai/aion"
            : persona === "remy"
              ? "/api/ai/remy"
              : persona === "strata"
                ? "/api/chat"
                : (endpoint ?? `/api/chat/${persona ?? ""}`),
        prepareSendMessagesRequest({ messages, id }) {
          const lastMessage = messages[messages.length - 1];
          const message = isClientPIIRedactionEnabled()
            ? redactUIMessages([lastMessage])[0]
            : lastMessage;
          const sess = assistantSessionRef.current;
          const strataPageTools =
            experience === "strata_page" && sess
              ? {
                  webSearch: sess.tools.toolWebSearch,
                  memory: sess.tools.toolMemory,
                  messageSearch: sess.tools.toolMessageSearch,
                  knowledgeSearch: sess.tools.toolKnowledgeSearch,
                  strataAssistantPersona: sess.personaId,
                }
              : {
                  webSearch: useWebSearchRef.current,
                  memory: useMemoriesRef.current,
                  messageSearch: true as const,
                  knowledgeSearch: false as const,
                };

          const req = {
            body: {
              message,
              id,
              model: selectedModelRef.current,
              ...strataPageTools,
              speechFriendly: useSpeechFriendlyRef.current,
              experience,
              ...(strataPageId ? { strataPageId } : {}),
              zeroDataRetention: getSettings().zeroDataRetention,
              // Only include persistedSchemas in payload if true
              ...(usePersistedSchemas.current ? { persistedSchemas: true } : {}),
            },
          };

          logger.log("chat", `Request being sent: ${JSON.stringify(req, null, 2)}`);

          return req;
        },
      }),
      onData: (data) => {
        /** Side channel for UI events */
        logger.log("chat", JSON.stringify(data, null, 2));

        if (data.type === "data-mem0-get") {
          const payload = data.data as { memories?: { memory: string }[] };

          setMem0Retrieved(payload.memories ?? []);
          setMem0Added([]);
        } else if (data.type === "data-mem0-update") {
          const payload = data.data as { memories?: { memory: string }[] };

          setMem0Added(payload.memories ?? []);
        } else if (data.type === "data-notification") {
          logger.log("chat", `DATA_NOTIFICATION ${JSON.stringify(data.data, null, 2)}`);
          const dataObject = data.data as { message?: string };

          if (dataObject.message === "chat-title-generated") {
            refreshSidebarChats();
          }
        } else if (data.type === "data-aiAction") {
          logger.log("chat", `DATA_AIACTION ${JSON.stringify(data.data, null, 2)}`);

          const dataObject = data.data as {
            action: ChatAIActionEnum;
            message?: string;
            sources?: ExaSearchResultSource[];
            /** Emitted by memory search tool progress (server stream). */
            query?: string;
          };

          switch (dataObject.action) {
            case ChatAIActionEnum.Reasoning:
              setAiAction({
                action: ChatAIActionEnum.Reasoning,
                message: dataObject.message,
              });
              break;
            case ChatAIActionEnum.Tool:
              let toolName = undefined;

              if (dataObject.message) {
                toolName = dataObject.message.split(": ")[1];
              }
              switch (toolName) {
                case "web_search":
                  setAiAction((prev) => {
                    let sources: ExaSearchResultSource[] | undefined = undefined;

                    if (prev && prev.action === ChatAIActionEnum.Search) {
                      sources = [...(prev.sources ?? []), ...(dataObject.sources ?? [])];
                      // Make sources unique based on id
                      sources = sources.filter(
                        (source, index, self) => index === self.findIndex((t) => t.id === source.id)
                      );
                    } else {
                      sources = dataObject.sources;
                    }

                    return {
                      action: ChatAIActionEnum.Search,
                      message: dataObject.message,
                      sources: sources,
                    };
                  });
                  break;
                case "memory_search":
                  setAiAction({
                    action: ChatAIActionEnum.Memory,
                    message: dataObject.message,
                  });
                  break;
                default:
                  setAiAction({
                    action: ChatAIActionEnum.Tool,
                    message: dataObject.message,
                  });
                  break;
              }
              break;
            case ChatAIActionEnum.Memory: {
              const q = dataObject.query?.trim();

              setAiAction({
                action: ChatAIActionEnum.Memory,
                message:
                  q && q.length > 0
                    ? `Searching memories for "${q.length > 56 ? `${q.slice(0, 56)}…` : q}"`
                    : (dataObject.message ?? "Searching memories..."),
              });
              break;
            }
            default:
              setAiAction({
                action: dataObject.action,
                message: dataObject.message,
                sources: dataObject.sources,
              });
              break;
          }
        }
      },
      onError: (error) => {
        logger.error("chat", `ERROR ${JSON.stringify(error, null, 2)}`);
        setAiAction({ action: ChatAIActionEnum.Errored, message: undefined });
        errorRef.current = error;
        setChatError(error);
        const errorMessage = getChatErrorMessage(error);

        toast.error(errorMessage);
        logger.error("chat", `Chat onError: ${errorMessage}`);
      },
      onFinish: () => {
        setAiAction(undefined);
      },
    });

  // Send initial message if provided
  useEffect(() => {
    if (
      initialMessage &&
      !initialMessageSent.current &&
      messages.length === 0 &&
      status === "ready"
    ) {
      initialMessageSent.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, messages.length, status, sendMessage]);

  const handleStop = useCallback(async () => {
    // Remove the latest user message and partially completed AI message from messages
    // Remove the latest user message and any partially completed AI response
    stop();

    /** The following commented out section would revert messages, fully aborting current generation */
    // setMessages((prevMessages) => {
    //   // Find the last user message
    //   const lastUserIndex = [...prevMessages]
    //     .reverse()
    //     .findIndex((msg) => msg.role === "user");
    //   if (lastUserIndex === -1) {
    //     return prevMessages;
    //   }
    //   // Calculate the index in the original array
    //   const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;

    //   // Remove the last user message and any AI message immediately after it (if exists)
    //   let newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   // Check if there's an AI message after the last user
    //   if (
    //     prevMessages[lastUserMsgIdx + 1] &&
    //     prevMessages[lastUserMsgIdx + 1].role === "assistant"
    //   ) {
    //     // Remove the AI message as well
    //     newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   } else {
    //     // If not, just slice off including the user message
    //     newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   }
    //   return newMessages;
    // });
  }, [messages]);

  return (
    <div
      className={[
        "w-full",
        "min-w-0",
        "h-full",
        "sm:max-h-[calc(100dvh-2rem)]",
        "flex",
        "flex-col",
        "overflow-x-hidden",
      ].join(" ")}
    >
      <Conversation
        className={[
          "flex-1",
          "min-h-0",
          "w-full",
          "relative",
          "flex",
          "flex-col",
          "items-center",
          "overflow-x-hidden",
          "overscroll-x-none",
        ].join(" ")}
      >
        <ChatThread
          aiActionPayload={aiAction}
          contentClassName={persona === "remy" ? MEMORY_PANEL_RESERVE_PADDING : undefined}
          messages={messages}
        />
        {persona === "remy" && (
          <MemoryEphemeralCards
            overlay
            added={mem0Added}
            autoClearMs={12000}
            retrieved={mem0Retrieved}
          />
        )}
        <ConversationScrollButton className="bottom-14" />
      </Conversation>
      <div className="shrink-0 px-4 sm:px-7 pb-1 md:pb-4 w-full -mt-10 flex flex-col gap-2">
        <div className="sm:max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-24rem)] lg:max-w-4xl mx-auto w-full flex flex-col gap-2">
          {persona === "remy" && (
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  type="button"
                >
                  <BrainCircuit className="size-3.5" />
                  View persisted memory
                </button>
              </SheetTrigger>
              <SheetContent
                overlayPriority
                className="w-full sm:max-w-md overflow-y-auto flex flex-col top-0 bottom-20 right-0 h-auto border-t-0"
                side="right"
              >
                <SheetHeader>
                  <SheetTitle className="sr-only">Persisted memory</SheetTitle>
                </SheetHeader>
                <MemoryLens className="flex-1 min-h-0" variant="sheet" />
              </SheetContent>
            </Sheet>
          )}
          <CoreInput
            chatId={chatData?.thread.id}
            clearError={clearError}
            enableMarkdownInputPreview={
              experience === "arcadia" && experimentalArcadiaMarkdownPreview
            }
            error={error ?? chatError}
            hideWebMemorySpeechToggles={experience === "strata_page" && Boolean(assistantSession)}
            initialDraft={initialDraft}
            isBlankChat={messages.length === 0 && persona !== "strata"}
            modelRef={selectedModelRef}
            sendMessage={sendMessage}
            status={status}
            stop={handleStop}
            useMemoriesRef={useMemoriesRef}
            useSpeechFriendlyRef={useSpeechFriendlyRef}
            useWebSearchRef={useWebSearchRef}
            onErrorCleared={() => setChatError(undefined)}
          />
        </div>
      </div>
    </div>
  );
};
