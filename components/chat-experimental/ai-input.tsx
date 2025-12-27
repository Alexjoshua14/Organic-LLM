'use client'

import React, { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AiInputForm } from "./ai-input-form";
import { useAion } from "@/hooks/use-aion";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ai-input");

/**
 * AI Input component for one-off prompts that interact with Aion core intelligence.
 * Aion can route users, orchestrate workflows, and handle complex requests through its tools.
 */
export const AIInput: React.FC = () => {
  const router = useRouter();

  const aion = useAion({
    onFinish: ({ message }) => {
      logger.log("onFinish", `Message finished streaming ${JSON.stringify(message, null, 2)}`);

      // Aion will handle routing through its tools if needed
      // The response will contain the result of any tool calls
    },
    onToolCall: (params) => {
      logger.log("onToolCall", `Tool called ${JSON.stringify(params, null, 2)}`);

      // Handle navigation tool calls
      if (params.toolCall.toolName === "navigate") {
        const { page } = params.toolCall.args as { page: string; reason?: string };

        switch (page) {
          case "chat":
            // Aion will create/route to chat - navigation can happen after response
            break;
          case "rabbit-hole":
            // Aion will create rabbit hole session
            break;
          case "settings":
            router.push("/settings");
            break;
        }
      }
    },
    onError: (error) => {
      logger.error("onError", `Error in Aion request ${error.message}`);
    },
  });

  const handleSubmit = useCallback(async (prompt: string) => {
    if (!prompt.trim() || aion.status !== "ready") return;

    try {
      logger.log("handleSubmit", `Sending message to Aion ${prompt}`);
      aion.sendMessage({ text: prompt });
    } catch (error) {
      logger.error("handleSubmit", `Error sending message ${error}`);
    }
  }, [aion]);

  // Determine loading state from useAion status
  const isProcessing = aion.status === "streaming" || aion.status === "submitted";


  return (
    <AiInputForm
      onSubmit={handleSubmit}
      isLoading={isProcessing}
      className="w-full max-w-xl"
    />
  );
};
