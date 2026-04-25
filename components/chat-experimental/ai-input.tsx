"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { motion } from "framer-motion";

import { glass } from "../design-system/primitives";

import { AiInputForm } from "./ai-input-form";

import { useAion } from "@/hooks/use-aion";
import { createLogger } from "@/lib/logger";
import { createChat } from "@/lib/chat/chat-store";
import { routeHomepagePrompt } from "@/lib/chat/thread-routing";
import { appendDraftQueryParam } from "@/lib/chat/thread-routing-candidates";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { getSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

const logger = createLogger("ai-input");

/**
 * AI Input component for one-off prompts that interact with Aion core intelligence.
 * Aion can route users, orchestrate workflows, and handle complex requests through its tools.
 */
export const AIInput: React.FC = () => {
  const router = useRouter();
  const elementActive = useRef<boolean>(false);
  const { refreshSidebarChats } = useSharedChatContext();
  const [creating, setCreating] = useState(false);
  const [routing, setRouting] = useState(false);

  const handleLetsChat = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleLetsChat", res.error ? res.error.message : "Chat ID is null");

        return;
      }
      const id = res.data;

      refreshSidebarChats();
      router.push(`/chat/${id}`);
    } catch (error) {
      logger.error("handleLetsChat", `Error creating chat: ${error}`);
    } finally {
      setCreating(false);
    }
  }, [creating, refreshSidebarChats, router]);

  const aion = useAion({
    onFinish: ({ message }) => {
      logger.log(
        "onFinish",
        `Message finished streaming, role=${message?.role} parts=${message?.parts?.length ?? 0}`
      );

      // Aion will handle routing through its tools if needed
      // The response will contain the result of any tool calls
    },
    onToolCall: (params) => {
      logger.log("onToolCall", `Tool called ${JSON.stringify(params, null, 2)}`);

      // Handle navigation tool calls
      if (params.toolCall.toolName === "navigate" && params.toolCall.input) {
        const { page } = params.toolCall.input as {
          page: string;
          reason?: string;
        };

        switch (page) {
          case "chat":
            // Aion will create/route to chat - navigation can happen after response
            void handleLetsChat();
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

  const handleSubmit = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || routing || aion.status === "streaming" || aion.status === "submitted") {
        return;
      }

      const clientStart = performance.now();

      try {
        setRouting(true);
        const coalescenceMode = getSettings().coalescenceMode;
        const routeRes = await routeHomepagePrompt({ prompt: trimmed, coalescenceMode });
        const clientRoundTripMs = performance.now() - clientStart;

        if (routeRes.error || !routeRes.data) {
          logger.error(
            "handleSubmit",
            `Semantic routing failed: ${routeRes.error?.message ?? "unknown"}`
          );

          return;
        }

        const { metrics } = routeRes.data;

        logger.log(
          "handleSubmit",
          JSON.stringify({
            event: "homepage_route_client",
            clientRoundTripMs,
            serverTotalMs: metrics.totalServerMs,
            serverClassificationMs: metrics.classificationMs,
            serverFetchCandidatesMs: metrics.fetchCandidatesMs,
            outcome: routeRes.data.outcome,
            candidateCount: metrics.candidateCount,
            coalescenceMode,
          })
        );

        if (routeRes.data.outcome === "match") {
          refreshSidebarChats();
          router.push(appendDraftQueryParam(routeRes.data.href, trimmed));

          return;
        }

        refreshSidebarChats();
        router.push(appendDraftQueryParam(`/chat/${routeRes.data.chatId}`, trimmed));
      } catch (error) {
        logger.error("handleSubmit", `Error routing homepage prompt ${error}`);
      } finally {
        setRouting(false);
      }
    },
    [aion.status, refreshSidebarChats, router, routing]
  );

  const isProcessing = routing || aion.status === "streaming" || aion.status === "submitted";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 0.97 }}
      className="flex flex-col w-full gap-4"
      whileFocus={{ scale: 1 }}
      // If element active and submit button not disabled, opacity animation should happen on click
      // Else, scale animation can happen
      // Ensentially differentiate interactions, like user click on submit button versus user focusing in on main component for text input
      initial={{ opacity: 0, y: 32, scale: 0.94 }}
      tabIndex={-1}
      transition={{ type: "spring", stiffness: 120, damping: 18, duration: 0.7 }}
      whileTap={elementActive.current ? { opacity: 0.92 } : { scale: 1.03 }}
    >
      <AiInputForm
        className="w-full max-w-xl rounded-xl"
        isLoading={isProcessing}
        status={routing ? "submitted" : aion.status}
        onSubmit={handleSubmit}
      />
      <div className="flex gap-10 justify-center">
        <ActionButton isDisabled={creating} title="Let's Chat" onPress={handleLetsChat} />
        <ActionButton title="Rabbit Holes" onPress={() => aion.navigate("/rabbitholes/browse")} />
        <ActionButton title="Settings" onPress={() => aion.navigate("/settings")} />
      </div>
    </motion.div>
  );
};

const ActionButton = ({
  title,
  onPress,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { title: string }) => {
  return (
    <Button
      className={cn(
        `${glass()} backdrop-invert-25 hover:backdrop-invert-100 transition-all hover:scale-110 duration-1000`,
        className
      )}
      onPress={onPress}
      {...props}
    >
      {title}
    </Button>
  );
};
