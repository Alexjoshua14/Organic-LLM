"use client";

import type { AionEvent } from "@/lib/schemas/aion-presence";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useEffect, useRef } from "react";

import { Conversation, ConversationScrollButton } from "../third-party/ai-elements/conversation";

import { ChatThread } from "./chat-thread";
import { CoreInput } from "./core-input";
import { ChatProps } from "./chat";

import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { getSettings } from "@/lib/user-settings";
import { createLogger } from "@/lib/logger";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { useArchetypeContext } from "@/lib/context/archetype-context";

const logger = createLogger("components/chat/aionChat");

export type AionChatProps = ChatProps & {
  /**
   * Presence layer registers a send fn so Tier-2 events (kind: message) can drive
   * a full chat turn with an optional trigger stamped on the request body.
   */
  onRegisterSend?: (send: ((text: string, trigger?: AionEvent) => void) | null) => void;
};

export const AionChat: React.FC<AionChatProps> = ({
  chatData,
  endpoint,
  persona,
  onRegisterSend,
}) => {
  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const usePersistedSchemas = useRef<boolean>(persona === "aion");
  const triggerRef = useRef<AionEvent | null>(null);

  const {
    open: openArchetype,
    close: closeArchetype,
    archetypeData,
    showArchetype,
  } = useArchetypeContext();

  const handleViewArchetype = useCallback(() => {
    return archetypeData;
  }, [archetypeData]);

  const { messages, sendMessage, stop, status, setMessages, addToolOutput, error } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: persona === "aion" ? "/api/ai/aion" : (endpoint ?? `/api/chat/${persona ?? ""}`),
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        const message = isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;
        const trigger = triggerRef.current;

        triggerRef.current = null;
        const req = {
          body: {
            message,
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            zeroDataRetention: getSettings().zeroDataRetention,
            ...(usePersistedSchemas.current ? { persistedSchemas: true } : {}),
            ...(trigger
              ? {
                  trigger: {
                    id: trigger.id,
                    kind: trigger.kind,
                    surface: trigger.surface,
                    label: trigger.label,
                    at: trigger.at,
                  },
                }
              : {}),
          },
        };

        logger.log("chat", `Request being sent: ${JSON.stringify(req, null, 2)}`);

        return req;
      },
    }),
    onToolCall({ toolCall }) {
      logger.log("chat", `TOOL_CALL ${JSON.stringify(toolCall, null, 2)}`);
      logger.log("chat", `TOOL_CALL Name: ${toolCall.toolName}`);

      switch (toolCall.toolName) {
        case "set_state_archetype":
          let errorText: string | undefined = undefined;
          let new_archetype_state: boolean = false;

          try {
            const { open } = toolCall.input as { open: boolean };

            if (open) {
              openArchetype();
              new_archetype_state = true;
            } else {
              closeArchetype();
              new_archetype_state = false;
            }
          } catch (err) {
            logger.error("chat", `Error opening archetype: ${err}`);
          } finally {
            logger.log(
              "chat",
              `Returning Tool Output: Archetype state changed: ${new_archetype_state ? "opened" : "closed"}`
            );
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                state: new_archetype_state,
              },
              errorText,
            });
          }

          break;
        case "view_archetype":
          const currentArchetype = handleViewArchetype();
          const archetypeState = showArchetype;

          logger.log(
            "chat",
            `TOOL_CALL OUTPUT: view_archetype | archetype: ${JSON.stringify(currentArchetype)}, state: ${archetypeState}`
          );
          if (currentArchetype) {
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                archetype: currentArchetype,
                state: archetypeState,
              },
            });
          } else {
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                message: "No archetype is currently active",
                state: archetypeState,
              },
            });
          }
          break;
      }
    },
    onData: (data) => {
      logger.log("chat", JSON.stringify(data, null, 2));
    },
  });

  useEffect(() => {
    if (error) {
      logger.error("chat", `Error: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    if (!onRegisterSend) return;

    const send = (text: string, trigger?: AionEvent) => {
      triggerRef.current = trigger ?? null;
      void sendMessage({ text });
    };

    onRegisterSend(send);

    return () => onRegisterSend(null);
  }, [onRegisterSend, sendMessage]);

  const handleStop = useCallback(async () => {
    stop();
    setMessages((prevMessages) => {
      const lastUserIndex = [...prevMessages].reverse().findIndex((msg) => msg.role === "user");

      if (lastUserIndex === -1) {
        return prevMessages;
      }
      const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;

      if (
        prevMessages[lastUserMsgIdx + 1] &&
        prevMessages[lastUserMsgIdx + 1].role === "assistant"
      ) {
        return prevMessages.slice(0, lastUserMsgIdx);
      }

      return prevMessages.slice(0, lastUserMsgIdx);
    });
  }, [stop, setMessages]);

  return (
    <div
      className={[
        "w-full",
        "max-w-232",
        "h-full",
        "max-h-full",
        "min-h-0",
        "flex",
        "items-center",
        "justify-center",
        "overflow-hidden",
        "overscroll-x-none",
        "relative",
      ].join(" ")}
    >
      <Conversation
        className={[
          "h-full",
          "w-full",
          "relative",
          "flex",
          "flex-col",
          "items-center",
          "overflow-x-hidden",
          "overscroll-x-none",
        ].join(" ")}
        style={{ paddingBottom: "8rem" }}
      >
        <ChatThread messages={messages} status={status} />
        <ConversationScrollButton className="bottom-46" />
      </Conversation>
      <CoreInput
        className="absolute bottom-8 md:bottom-4 px-4 sm:px-7 w-full"
        modelRef={selectedModelRef}
        sendMessage={sendMessage}
        status={status}
        stop={handleStop}
        useMemoriesRef={useMemoriesRef}
        useWebSearchRef={useWebSearchRef}
      />
    </div>
  );
};
