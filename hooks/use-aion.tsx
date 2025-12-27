"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, tool, UIMessage } from "ai";
import { useRef } from "react";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { useRouter } from "next/navigation";
import { createLogger } from "@/lib/logger";
import { NavigateToolInputSchema } from "@/lib/llm/core/coreToolKit";
import z from "zod";

const logger = createLogger("use-aion");


export interface UseAionOptions {
  /**
   * Optional conversation ID. If not provided, a new one will be generated.
   */
  id?: string;

  /**
   * Initial messages to start the conversation with
   */
  initialMessages?: UIMessage[];

  /**
   * Chat model to use for requests
   */
  model?: ChatModel;

  /**
   * Whether to enable memory search
   */
  memory?: boolean;

  /**
   * Callback when a message finishes streaming
   */
  onFinish?: (params: { message: UIMessage }) => void;

  /**
   * Callback when a tool is called
   */
  onToolCall?: (params: { toolCall: any }) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Hook for interacting with the Aion core intelligence endpoint.
 * Provides a useChat-like interface for sending messages to /api/ai/core
 * and receiving streamed responses.
 * 
 * @example
 * ```tsx
 * const { messages, sendMessage, status, stop } = useAion({
 *   model: DEFAULT_CHAT_MODEL,
 *   memory: true,
 *   onFinish: ({ message }) => {
 *     console.log("Message finished:", message);
 *   }
 * });
 * 
 * // Send a message
 * sendMessage({ text: "Hello, Aion!" });
 * ```
 */
export function useAion(options: UseAionOptions = {}) {
  const {
    id,
    initialMessages = [],
    model = DEFAULT_CHAT_MODEL,
    memory = true,
    onFinish,
    onToolCall,
    onError,
  } = options;

  // Use refs to ensure we always send the latest model/memory settings
  const modelRef = useRef<ChatModel>(model);
  const memoryRef = useRef<boolean>(memory);
  const { push } = useRouter()

  // Update refs when options change
  if (modelRef.current !== model) {
    modelRef.current = model;
  }
  if (memoryRef.current !== memory) {
    memoryRef.current = memory;
  }

  const navigate = (route: string) => {
    push(route);
  }

  const chat = useChat({
    id: id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/core",
      prepareSendMessagesRequest({ messages, id: conversationId }) {
        // Get the last message (the one being sent)
        const lastMessage = messages[messages.length - 1];

        // Ensure we have a valid UUID for the request
        // Use conversationId from useChat if it's a valid UUID, otherwise generate one
        let requestId: string;
        if (conversationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
          requestId = conversationId;
        } else if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          requestId = id;
        } else {
          requestId = crypto.randomUUID();
        }

        return {
          body: {
            message: lastMessage,
            id: requestId,
            model: modelRef.current,
            memory: memoryRef.current,
          },
        };
      },
    }),
    onFinish: ({ message }) => {
      try {
        logger.log("onFinish", JSON.stringify(message, null, 2));

        // Handle navigation from tool results in the message
        if (message?.parts) {
          for (const part of message.parts) {
            // Check for tool-result parts with navigate tool
            if (part.type === "tool-navigate") {
              const toolResultPart = part as { output?: unknown };
              if (toolResultPart.output) {
                const result = toolResultPart.output as { route?: string; success?: boolean; reason?: string; message?: string };
                if (result?.route) {
                  logger.log("onFinish", `Navigating to: ${result.route}`);
                  navigate(result.route)
                }
              }
            }
          }
        }

        // Call user's onFinish callback if provided
        onFinish?.({ message });
      } catch (err) {
        logger.error("onFinish", `Error: ${err}`);
      }
    },
    onToolCall: (params) => {
      try {
        logger.log("onToolCall", `Tool call object ${JSON.stringify(params.toolCall, null, 2)}`);

        // Call user's onToolCall callback if provided
        onToolCall?.(params);
      } catch (err) {
        logger.error("onToolCall", `Error: ${err}`);
      }
    },
    onData: (data) => {
      logger.log("Data Recieved in useAion's useChat", JSON.stringify(data, null, 2))
    },
    onError: onError,
  });

  return {
    ...chat,
    // Expose current model and memory settings for convenience
    model: modelRef.current,
    memory: memoryRef.current,
    navigate,
  };
}
