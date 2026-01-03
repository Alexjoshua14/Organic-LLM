"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useEffect, useRef } from "react";

import { ChatThread } from "./chat-thread";

import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { NewChatInput } from "./new-chat-input";
import { Conversation, ConversationScrollButton } from "../third-party/ai-elements/conversation";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { ChatProps } from "./chat";
import { sampleArchetypeData } from "@/test-data/sampleData";

const logger = createLogger("components/chat/aionChat");

export const AionChat: React.FC<ChatProps> = ({
  chatData,
  endpoint,
  persona,
}) => {

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const usePersistedSchemas = useRef<boolean>(persona === 'aion');

  const { setArchetypeData, open: openArchetype, close: closeArchetype, setAndOpen, archetypeData, showArchetype } = useArchetypeContext();

  const handleViewArchetype = useCallback(() => {
    return archetypeData;
  }, [archetypeData])

  const { messages, sendMessage, id, stop, status, setMessages, addToolOutput, error, clearError } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: persona === 'aion' ? '/api/ai/aion' : endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        const req = {
          body: {
            message: messages[messages.length - 1],
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            // Only include persistedSchemas in payload if true
            ...(usePersistedSchemas.current ? { persistedSchemas: true } : {}),
          },
        }
        logger.log("chat", `Request being sent: ${JSON.stringify(req, null, 2)}`)
        return req;
      },
    }),
    // sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      logger.log("chat", `TOOL_CALL ${JSON.stringify(toolCall, null, 2)}`);

      logger.log("chat", `TOOL_CALL Name: ${toolCall.toolName}`);


      // If expecting tool call on UI side add output here
      switch (toolCall.toolName) {
        case "set_state_archetype":

          let error: string | undefined = undefined;

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
          } catch (error) {
            logger.error("chat", `Error opening archetype: ${error}`);
          } finally {
            logger.log("chat", `Returning Tool Output: Archetype state changed: ${new_archetype_state ? "opened" : "closed"}`);
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                state: new_archetype_state,
              },
              errorText: error,
            })
          }

          break;
        case "view_archetype":
          const currentArchetype = handleViewArchetype();
          const archetypeState = showArchetype;

          logger.log("chat", `TOOL_CALL OUTPUT: view_archetype | archetype: ${JSON.stringify(currentArchetype)}, state: ${archetypeState}`);
          if (currentArchetype) {
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                archetype: currentArchetype,
                state: archetypeState,
              },
            })
          } else {
            addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                message: "No archetype is currently active",
                state: archetypeState,
              },
            })
          }
          break;

      }
    },
    onData: (data) => {
      logger.log("chat", JSON.stringify(data, null, 2))
    },
  });


  useEffect(() => {
    if (error) {
      logger.error("chat", `Error: ${error}`);
    }
  }, [error])

  const handleStop = useCallback(async () => {
    // Remove the latest user message and partially completed AI message from messages
    // Remove the latest user message and any partially completed AI response
    stop();
    setMessages((prevMessages) => {
      // Find the last user message
      const lastUserIndex = [...prevMessages]
        .reverse()
        .findIndex((msg) => msg.role === "user");
      if (lastUserIndex === -1) {
        return prevMessages;
      }
      // Calculate the index in the original array
      const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;

      // Remove the last user message and any AI message immediately after it (if exists)
      let newMessages = prevMessages.slice(0, lastUserMsgIdx);
      // Check if there's an AI message after the last user
      if (
        prevMessages[lastUserMsgIdx + 1] &&
        prevMessages[lastUserMsgIdx + 1].role === "assistant"
      ) {
        // Remove the AI message as well
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      } else {
        // If not, just slice off including the user message
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      }
      return newMessages;
    });
  }, [messages])

  return (
    <div
      className={[
        "w-full",
        "max-w-232",
        "h-full",
        "max-h-[calc(100dvh-2rem)]",
        "flex",
        "items-center",
        "justify-center",
        "overflow-hidden",
        "overscroll-x-none",
        "relative",
      ].join(" ")}
    >
      <Conversation
        className={
          [
            "h-full",
            "w-full",
            "relative",
            "flex",
            "flex-col",
            "items-center",
            "overflow-x-hidden",
            "overscroll-x-none",
          ].join(" ")
        }
        style={{ paddingBottom: "8rem" }}
      >
        <ChatThread messages={messages} />
        <ConversationScrollButton className="bottom-40" />
      </Conversation>
      <NewChatInput
        modelRef={selectedModelRef}
        useWebSearchRef={useWebSearchRef}
        useMemoriesRef={useMemoriesRef}
        sendMessage={sendMessage}
        stop={handleStop}
        status={status}
        className="absolute bottom-1 md:bottom-4 px-4 sm:px-7 w-full"
      />
    </div>
  );
};
